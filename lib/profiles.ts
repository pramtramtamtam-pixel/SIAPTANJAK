import {hasInstitutionPic} from './profile-contacts';
import {env} from 'cloudflare:workers';
import {one,db,assert,jsonBody,validText,audit,hash,verifyPassword,now,unpack} from './server';
import {emailConfigured,queueConfirmation} from './registration-services';
import {companyProfile} from './company-offices';
import {registrationBody,storeCompanyLogo} from './company-logos';
export async function handleProfile(req:Request,u:any){
 const savedProfile=await one('SELECT * FROM user_profiles WHERE user_id=?',u.id)||{};
 const company=u.role==='Perusahaan'?await one('SELECT * FROM perusahaan WHERE user_id=?',u.id):null;
 if(req.method==='GET')return Response.json({user:u,profile:savedProfile,company:company?unpack(company):null},{headers:{'Cache-Control':'no-store'}});
 assert(req.method==='POST','Metode tidak diizinkan',405);
 const multipart=req.headers.get('content-type')?.includes('multipart/form-data')?await registrationBody(req):null,b=multipart?multipart.body:await jsonBody(req);
 if(b.contactOnly===true){
  assert(hasInstitutionPic(u.role),'Pengaturan kontak PIC khusus instansi pengusul',403);
  assert(!multipart?.logo,'Kontak PIC tidak menerima logo',400);
  const picName=validText(b.pic_name,'Nama PIC',200),phone=validText(b.phone,'No. HP',50);
  await db().prepare('INSERT INTO user_profiles(user_id,pic_name,phone,updated) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET pic_name=excluded.pic_name,phone=excluded.phone,updated=excluded.updated').bind(u.id,picName,phone,now()).run();
  await audit(u,'Ubah kontak PIC instansi pengusul',u.id);
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }
 const name=validText(b.name,'Nama tampilan',120),email=validText(b.email,'Email',180).toLowerCase();assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Format email tidak valid');
 const username=String(b.username||'').trim().toLowerCase();assert(!username||/^[a-z0-9._-]{3,40}$/.test(username)||username.length<=180&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username),'Username harus berupa alamat email lengkap atau 3–40 huruf, angka, titik, garis bawah, atau tanda hubung');
 assert(!await one('SELECT id FROM users WHERE (email=? OR username=?) AND id<>? AND deleted_at IS NULL',email,email,u.id),'Email sudah digunakan sebagai alamat email atau nama pengguna',409);
 if(username)assert(!await one('SELECT id FROM users WHERE (username=? OR email=?) AND id<>? AND deleted_at IS NULL',username,username,u.id),'Nama pengguna sudah digunakan',409);
 const fields=['signer_name','signer_nip','signer_position','phone'];const values=fields.map(k=>String(b[k]||'').trim());assert(values.every(v=>v.length<=200),'Isian profil maksimal 200 karakter');
 let picName=String(savedProfile.pic_name||'');
 if(hasInstitutionPic(u.role)&&b.pic_name!==undefined){picName=validText(b.pic_name,'Nama PIC',200);values[3]=validText(b.phone,'No. HP PIC',50);}
 if(hasInstitutionPic(u.role)&&b.phone===undefined)values[3]=savedProfile.phone||'';
 let passwordHash:string|undefined;if(b.password){assert(typeof b.password==='string'&&b.password.length>=8&&b.password.length<=200,'Kata sandi baru minimal 8 karakter');const old=await one('SELECT password FROM users WHERE id=?',u.id);assert(await verifyPassword(String(b.currentPassword||''),old.password),'Kata sandi saat ini belum benar',403);passwordHash=await hash(b.password);}
 let instansi=u.role==='Perusahaan'?u.instansi:validText(b.instansi||u.instansi,'Instansi',200),clean:any=null,companyPayload:any=null;
 if(b.companyProfile!==undefined){assert(u.role==='Perusahaan'&&company,'Profil perusahaan tidak ditemukan',403);clean=companyProfile(b.companyProfile);instansi=validText(b.companyName,'Nama perusahaan',200);assert(['Swasta','BUMN','BUMD'].includes(b.jenis),'Jenis perusahaan tidak valid');companyPayload={...JSON.parse(company.payload||'{}')};for(const key of ['pusat','operasional','latPusat','lngPusat','latOperasional','lngOperasional'])delete companyPayload[key];Object.assign(companyPayload,clean,{email});values[3]=clean.phone;picName=clean.pic;
 if(companyPayload.nib!==JSON.parse(company.payload||'{}').nib||instansi!==company.name)delete companyPayload.oss;
 if(b.ossLookupId){const lookup=await one('SELECT * FROM nib_lookups WHERE id=? AND nib=? AND expires>?',b.ossLookupId,clean.nib,Date.now());assert(lookup,'Pemeriksaan NIB kedaluwarsa');const info=JSON.parse(lookup.data);assert(info.companyName===instansi,'Nama perusahaan harus sesuai hasil OSS');companyPayload.oss=info;}
 }else if(company){companyPayload={...JSON.parse(company.payload||'{}'),email,phone:values[3]};}
 if(companyPayload&&email!==u.email){companyPayload.emailVerified=false;companyPayload.emailVerificationRequired=emailConfigured()?1:0;}
 assert(!multipart?.logo||u.role==='Perusahaan','Logo hanya untuk perusahaan',403);
 let logo:any=null;try{
 logo=await storeCompanyLogo(multipart?.logo,u.id);if(logo){assert(companyPayload,'Profil perusahaan tidak ditemukan');companyPayload.logoId=logo.id;}
 const statements=[db().prepare('UPDATE users SET name=?,email=?,username=?,instansi=? WHERE id=?').bind(name,email,username||null,instansi,u.id),db().prepare('INSERT INTO user_profiles(user_id,signer_name,signer_nip,signer_position,phone,updated,pic_name) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET signer_name=excluded.signer_name,signer_nip=excluded.signer_nip,signer_position=excluded.signer_position,phone=excluded.phone,updated=excluded.updated,pic_name=excluded.pic_name').bind(u.id,...values,now(),picName)];
 if(companyPayload)statements.push(db().prepare('UPDATE perusahaan SET name=?,jenis=?,payload=? WHERE id=? AND user_id=?').bind(instansi,clean?b.jenis:company.jenis,JSON.stringify(companyPayload),company.id,u.id));
 if(logo)statements.push(db().prepare('INSERT INTO company_logos(id,owner_id,name,mime,size,created) VALUES(?,?,?,?,?,?)').bind(logo.id,u.id,logo.name,logo.mime,logo.size,now()));
 if(passwordHash)statements.push(db().prepare('UPDATE users SET password=? WHERE id=?').bind(passwordHash,u.id),db().prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id));
 await db().batch(statements);
 }catch(error){if(logo)await env.BUCKET?.delete('company-logos/'+logo.id);throw error;}
 await audit(u,'Ubah profil, identitas perusahaan dan penandatangan cetak',u.id);
 let confirmationPending=false;if(companyPayload&&email!==u.email&&emailConfigured()){try{await queueConfirmation(req,u.id,email);}catch{confirmationPending=true;}}
 return Response.json({ok:true,passwordChanged:!!b.password,confirmationPending});
}
