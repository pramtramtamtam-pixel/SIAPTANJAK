import {handleProposalContact} from '../../../lib/proposal-contact';
import {readAuditPage} from '../../../lib/audit-page';
import {handleEmailSettings} from '../../../lib/email-settings';
import {publicSummary} from '../../../lib/public-summary';
import {handleUserWrite} from '../../../lib/user-service';
import {handleRecord} from '../../../lib/record-service';
import {provinceDashboard} from '../../../lib/province-dashboard';
import {handleRkaParticipation} from '../../../lib/rka-participation';
import {downloadDatabaseBackup} from '../../../lib/database-backup';
import {handleProfile} from '../../../lib/profiles';
import {handleCommitmentBA} from '../../../lib/commitment-ba';
import {registrationBody,storeCompanyLogo,handleCompanyLogo} from '../../../lib/company-logos';
import {handleReportDocument,reportDocumentsFor} from '../../../lib/report-documents';
import {readYearRecords} from '../../../lib/domain-records';
import {handleHomepage,handleHomepageAsset} from '../../../lib/homepage';
import {securityContext,requestIp,auditIp,IDLE_TIMEOUT_MS,ABSOLUTE_TIMEOUT_MS,sessionCookie} from '../../../lib/request-security';
import {isSupportedPlanningYear} from '../../../lib/planning-years';
import {visibleRecords,visibleCompanies} from '../../../lib/access';
import {handlePrintReport} from '../../../lib/print-report';
import {handleAssessments} from '../../../lib/assessments';
import {planningYears,requireYear,requireReportViewYear,requireReportYear,handlePlanning,handlePhaseReport} from '../../../lib/planning';
import {robotChallenge,verifyRobot,queueConfirmation,confirmEmail,emailConfigured,lookupNib,assistantAnswer} from '../../../lib/registration-services';
import {synchronizeCompletedReports} from '../../../lib/reports';
import {handleBooks} from '../../../lib/books';
import {companyProfile} from '../../../lib/company-offices';
import {officeLocation} from '../../../lib/office-geocoding';
import {env} from 'cloudflare:workers';
import {all,one,run,db,seed,user,uid,now,unpack,hash,verifyPassword,passwordNeedsUpgrade,canUpgradePassword,assert,jsonBody,validText,safeUser,audit,notify,canSee} from '../../../lib/server';
import {roles} from '../../../lib/data';
import {handleProposal} from '../../../lib/proposals';
import {handleDocument} from '../../../lib/documents';
import {readyStatuses,isDeleted} from '../../../lib/workflow';
import {dailyBackup,flushEmail,databaseSnapshot} from '../../../lib/maintenance';
import {reverseLocation,searchLocation} from '../../../lib/geocoding';
export const dynamic='force-dynamic';
const response=(data:any,status=200,headers:any={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
async function handle(req:Request){try{
 const path=new URL(req.url).pathname.split('/').slice(2);const area=path[0],id=path[1];const write=req.method!=='GET';
 if(write){assert(req.headers.get('origin')===new URL(req.url).origin,'Asal permintaan tidak diizinkan',403);}
 await seed();await synchronizeCompletedReports();const u=await user(req);
 if(area==='email-settings')return await handleEmailSettings(req,u);
 if(area==='homepage')return await handleHomepage(req,u);
 if(area==='homepage-admin')return await handleHomepage(req,u,true);
 if(area==='homepage-assets')return await handleHomepageAsset(req,u,id);
 if(area==='company-logos')return await handleCompanyLogo(req,u,id);
 if(area==='me')return response({user:u,years:await planningYears(),setup:!(await one("SELECT id FROM users WHERE role='Administrator' LIMIT 1"))});
 if(area==='public'){const rows=(await all('SELECT * FROM usulan')).map(unpack);const summaryCompanies=await all("SELECT p.id,p.user_id FROM perusahaan p JOIN users u ON u.id=p.user_id WHERE p.status='Disetujui' AND u.role='Perusahaan' AND u.active=1 AND u.deleted_at IS NULL");const summaryRecords=(await all("SELECT id,type,owner_id,usulan_id,status,payload,created FROM records WHERE type='laporan'")).map(unpack);const summary=publicSummary(rows,summaryRecords,summaryCompanies,(await all("SELECT id FROM master WHERE type='bidang' AND active=1")).length);return response({summary,usulan:rows.filter(r=>!isDeleted(r)&&[...readyStatuses,'Dalam Pelaksanaan','Selesai'].includes(r.status)).map(({id,title,bidang,wilayah,year,budget,status,progress,company_id,origin,payload})=>({id,title,bidang,wilayah,year,budget,status,progress,company_id,origin,payload:{demo:payload.demo,lat:payload.lat,lng:payload.lng,beneficiaries:payload.beneficiaries,output:payload.output,program:payload.program,sdgs:payload.sdgs}})),companies:(await all("SELECT p.* FROM perusahaan p JOIN users u ON u.id=p.user_id WHERE p.status='Disetujui' AND u.role='Perusahaan' AND u.active=1 AND u.deleted_at IS NULL")).map(unpack).map(c=>({id:c.id,name:c.name,jenis:c.jenis,status:c.status,payload:{demo:c.payload.demo,logoId:c.payload.logoId}})),master:await all('SELECT * FROM master')});}
 if(area==='robot')return await robotChallenge(req);
 if(area==='email-confirmation')return await confirmEmail(req);
 if(area==='oss'){assert(!write,'Metode tidak diizinkan',405);return await lookupNib(req);}
 if(area==='assistant'){assert(write,'Metode tidak diizinkan',405);return await assistantAnswer(req);}
 if(area==='books')return await handleBooks(req,u,id);
 if(area==='office-location'){assert(!write,'Metode tidak diizinkan',405);return await officeLocation(req,id==='search');}
 if(area==='auth'){assert(req.method==='POST','Metode tidak diizinkan',405);
  if(id==='logout'){const token=req.headers.get('cookie')?.match(/siap_session=([^;]+)/)?.[1];if(token)await run('DELETE FROM sessions WHERE id=?',token);if(u)await audit(u,'Keluar aplikasi','session');return response({ok:true},200,{'Set-Cookie':sessionCookie(req,'',true)});}
  if(id==='activity'){assert(write,'Metode tidak diizinkan',405);assert(u,'Sesi berakhir. Silakan masuk kembali.',401);const token=req.headers.get('cookie')?.match(/siap_session=([^;]+)/)?.[1];const stamp=Date.now();const changed=await run('UPDATE sessions SET last_activity=? WHERE id=? AND user_id=? AND expires>? AND last_activity>?',stamp,token,u.id,stamp,stamp-IDLE_TIMEOUT_MS);assert(changed.meta.changes===1,'Sesi berakhir. Silakan masuk kembali.',401);return response({idleDeadline:stamp+IDLE_TIMEOUT_MS,expires:u.session_expires});}
  if(id==='year'){assert(u,'Silakan masuk.',401);return response({error:'Untuk mengganti Tahun Perencanaan, keluar lalu masuk kembali.'},409);}
  const registration=id==='register'?await registrationBody(req):null;const b=registration?registration.body:await jsonBody(req);await verifyRobot(req,b);if(id!=='register')assert((await planningYears()).includes(Number(b.year)),'Pilih Tahun Perencanaan sebelum masuk aplikasi.');const email=validText(b.email,'Email',180).toLowerCase();assert(id==='login'||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Format email tidak valid');
  const password=validText(b.password,'Kata sandi',200);
  if(id==='setup'){
   assert(req.headers.get('oai-authenticated-user-id'),'Aktivasi awal membutuhkan pemilik situs yang sudah masuk.',403);
   assert(!await one("SELECT id FROM users WHERE role='Administrator' LIMIT 1"),'Administrator sudah diaktifkan',409);assert(password.length>=8,'Kata sandi minimal 8 karakter');
   const newId='admin-initial';await run('INSERT INTO users (id,name,email,password,role,instansi,wilayah,bidang,active) VALUES (?,?,?,?,?,?,?,?,1)',newId,validText(b.name,'Nama',120),email,await hash(password),'Administrator','Bappeda Provinsi Sumatera Selatan','Sumatera Selatan','Semua');await audit({id:newId},'Aktivasi administrator','users');
  }else if(id==='register'){
   assert(password.length>=8,'Kata sandi minimal 8 karakter');assert(!await one('SELECT id FROM users WHERE email=?',email),'Email telah terdaftar',409);
   const newId=uid();const companyName=validText(b.companyName,'Nama perusahaan',200);const profile:any=companyProfile(b.profile||{});profile.emailVerified=false;profile.emailVerificationRequired=emailConfigured();if(b.ossLookupId){const lookup=await one('SELECT * FROM nib_lookups WHERE id=? AND nib=? AND expires>?',b.ossLookupId,profile.nib,Date.now());assert(lookup,'Pemeriksaan NIB kedaluwarsa. Periksa kembali.');const info=JSON.parse(lookup.data);assert(info.companyName===companyName,'Nama perusahaan harus sesuai hasil OSS.');profile.oss=info;}
   assert(['Swasta','BUMN','BUMD'].includes(b.jenis),'Jenis perusahaan tidak valid');
   const logo=await storeCompanyLogo(registration?.logo,newId);if(logo)profile.logoId=logo.id;try{await db().batch([db().prepare('INSERT INTO users (id,name,email,password,role,instansi,wilayah,bidang,active) VALUES (?,?,?,?,?,?,?,?,0)').bind(newId,profile.pic,email,await hash(password),'Perusahaan',companyName,'Sumatera Selatan','Semua'),db().prepare('INSERT INTO perusahaan (id,user_id,name,jenis,status,payload) VALUES (?,?,?,?,?,?)').bind(uid(),newId,companyName,b.jenis,'Menunggu Persetujuan',JSON.stringify({...profile,email})),...(logo?[db().prepare('INSERT INTO company_logos(id,owner_id,name,mime,size,created) VALUES(?,?,?,?,?,?)').bind(logo.id,newId,logo.name,logo.mime,logo.size,now())]:[])]);}catch(error){if(logo)await env.BUCKET?.delete('company-logos/'+logo.id);throw error;}await audit({id:newId},'Registrasi perusahaan',companyName);await queueConfirmation(req,newId,email,true);await flushEmail().catch(()=>{});return response({ok:true,message:emailConfigured()?'Registrasi tersimpan. Email konfirmasi diproses untuk dikirim; jika belum masuk, periksa Spam atau hubungi Administrator. Akun tetap memerlukan persetujuan Administrator.':'Registrasi tersimpan. Email konfirmasi menunggu konfigurasi pengiriman email Pemprov; Administrator tetap dapat meninjau akun.'});
  }else assert(id==='login','Tidak ditemukan',404);
  const key=email;const attempt=await one('SELECT * FROM login_attempts WHERE id=?',key);assert(!attempt||attempt.until<Date.now()||attempt.count<5,'Terlalu banyak percobaan. Coba lagi dalam 15 menit.',429);
  const account=await one('SELECT * FROM users WHERE (email=? OR username=?) AND deleted_at IS NULL',email,email);
  const accepted=await verifyPassword(password,account?.password||('$2b$12$'+'.'.repeat(53)));
  if(!account||!accepted||!account.active){await run('INSERT INTO login_attempts (id,count,until) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=?',key,Date.now()+900000,Date.now(),Date.now()+900000);await audit(null,'Login gagal',email);return response({error:'Email atau kata sandi salah, atau akun belum aktif.'},401);}
  const companyAccount=account.role==='Perusahaan'?await one('SELECT payload FROM perusahaan WHERE user_id=?',account.id):null;const companyData=JSON.parse(companyAccount?.payload||'{}');assert(!companyData.emailVerificationRequired||companyData.emailVerified,'Konfirmasikan email perusahaan sebelum masuk.',403);await run('DELETE FROM login_attempts WHERE id=?',key);if(passwordNeedsUpgrade(account.password)&&canUpgradePassword(password))await run('UPDATE users SET password=? WHERE id=? AND password=?',await hash(password),account.id,account.password);const token=uid()+uid(),stamp=Date.now();await run('INSERT INTO sessions (id,user_id,expires,planning_year,last_activity) VALUES (?,?,?,?,?)',token,account.id,stamp+ABSOLUTE_TIMEOUT_MS,Number(b.year),stamp);await audit(account,'Masuk aplikasi','session');return response({user:safeUser({...account,planning_year:Number(b.year),idle_deadline:stamp+IDLE_TIMEOUT_MS,session_expires:stamp+ABSOLUTE_TIMEOUT_MS})},200,{'Set-Cookie':sessionCookie(req,token)});
 }
 assert(u,'Silakan masuk untuk mengakses ruang kerja.',401);
 await requireYear(u,u.planning_year);
 if(area==='proposal-contact')return await handleProposalContact(req,u,id);
 if(area==='profile')return await handleProfile(req,u);
 if(area==='commitment-ba')return await handleCommitmentBA(req,u,id);
 if(area==='assessments')return await handleAssessments(req,u);
 if(area==='planning')return await handlePlanning(req,u,id);
 if(area==='print-report'){assert(!write,'Metode tidak diizinkan',405);return await handlePrintReport(req,u);}
 if(area==='phase-report'){assert(!write,'Metode tidak diizinkan',405);return await handlePhaseReport(req,u);}
 if(area==='location'){assert(!write,'Metode tidak diizinkan',405);return await (id==='search'?searchLocation(req,u):reverseLocation(req,u));}
 if(area==='maintenance'){assert(u.role==='Administrator','Hanya administrator',403);await dailyBackup();await flushEmail();return response({ok:true,backups:await env.BUCKET?.list({prefix:'backup/'}),email:await all('SELECT id,email,status,created FROM email_outbox ORDER BY created DESC LIMIT 100'),emailConfigured:emailConfigured()});}
 if(area==='report-documents')return await handleReportDocument(req,u,id);
 if(area==='report-list'){
  assert(!write,'Metode tidak diizinkan',405);const reportYear=Number(new URL(req.url).searchParams.get('year')||u.planning_year);await requireReportViewYear(u,reportYear);
  const source=(await all('SELECT * FROM usulan WHERE year=?',reportYear)).map(unpack);
  const reports=visibleRecords(u,await readYearRecords(u,reportYear),source,reportYear).filter(r=>r.type==='laporan');return response({year:reportYear,records:reports.map(r=>({...r,proposal_origin:source.find(p=>p.id===r.usulan_id)?.origin})),documents:await reportDocumentsFor(reports)});
 }
 if(area==='province-dashboard')return provinceDashboard(req,u);
 if(area==='dashboard-data'){assert(!write,'Metode tidak diizinkan',405);const year=Number(new URL(req.url).searchParams.get('year')||u.planning_year);await requireReportYear(u,year);const proposals=(await all('SELECT * FROM usulan WHERE year=?',year)).map(unpack).filter(r=>!isDeleted(r)&&canSee(u,r));return response({year,proposals});}
 if(area==='monitoring'){
  assert(!write,'Metode tidak diizinkan',405);assert(['Administrator','Bappeda Provinsi','Perusahaan','Perangkat Daerah','POKJA Forum CSR','Bappeda Kab/Kota'].includes(u.role),'Monitoring di luar kewenangan Anda',403);
  const year=Number(new URL(req.url).searchParams.get('year')||u.planning_year),forMap=new URL(req.url).searchParams.get('map')==='1';await requireReportYear(u,year);
  const companies=(await all('SELECT * FROM perusahaan')).map(unpack),own=companies.find(c=>c.user_id===u.id),scope={...u,planning_year:year};
  const proposals=(await all('SELECT * FROM usulan WHERE year=?',year)).map(unpack).filter(r=>!isDeleted(r)&&(u.role!=='Bappeda Kab/Kota'||r.wilayah===u.wilayah)&&(!['Perangkat Daerah','POKJA Forum CSR'].includes(u.role)||r.bidang===u.bidang)&&(u.role!=='Perusahaan'||!!own&&r.company_id===own.id||forMap&&r.status==='Disetujui POKJA Provinsi'&&!r.company_id)).map(r=>({...r,company_name:companies.find(c=>c.id===r.company_id)?.name,company_owner_id:companies.find(c=>c.id===r.company_id)?.user_id}));
  const records=visibleRecords(scope,await readYearRecords(scope,year),proposals,year);
  return response({year,records,proposals,documents:await reportDocumentsFor(records.filter(r=>r.type==='laporan')),companies:companies.filter(c=>(!['Perangkat Daerah','POKJA Forum CSR','Bappeda Kab/Kota'].includes(u.role)||records.some(r=>r.owner_id===c.user_id)||proposals.some(p=>p.company_id===c.id))&&(u.role!=='Perusahaan'||c.user_id===u.id)).map(c=>({id:c.user_id,name:c.name})),ownCompany:u.role==='Perusahaan'?{id:u.id,name:own?.name||u.instansi||u.name}:null});
 }
 if(area==='rka-participation')return await handleRkaParticipation(req,u);
 if(area==='workspace'){
  assert(!write,'Metode tidak diizinkan',405);const viewYear=Number(new URL(req.url).searchParams.get('planningYear')||u.planning_year);await requireReportYear(u,viewYear);const scopeUser={...u,planning_year:viewYear};
  if(u.role==='Administrator'){await dailyBackup().catch(e=>console.error('Backup:',e.message));await flushEmail().catch(e=>console.error('Email:',e.message));}
  const companies=(await all('SELECT * FROM perusahaan')).map(unpack);const company=companies.find(c=>c.user_id===u.id);
  const companyById=new Map(companies.map(c=>[c.id,c]));
  const rows=(u.role==='Perusahaan'?await all('SELECT * FROM usulan WHERE year BETWEEN ? AND ?',2024,Number(u.planning_year)+1):await all('SELECT * FROM usulan WHERE year=?',viewYear+1)).map(unpack).map(r=>({...r,company_name:companyById.get(r.company_id)?.name,company_owner_id:companyById.get(r.company_id)?.user_id})).filter(r=>!isDeleted(r)&&(u.role==='Perusahaan'?(r.status==='Disetujui POKJA Provinsi'&&!r.company_id||!!company&&r.company_id===company.id):canSee(u,r)));
  const records=visibleRecords(scopeUser,await readYearRecords(scopeUser),rows);
  const reportProposals=['Administrator','Perusahaan'].includes(u.role)?(await all("SELECT * FROM usulan WHERE year BETWEEN ? AND ? AND status IN ('Dalam Pelaksanaan','Selesai')",2024,Number(u.planning_year)+1)).map(unpack).filter(r=>!isDeleted(r)&&(u.role==='Administrator'||r.company_id===company?.id)):[];
  const visibleProposalIds=new Set(rows.map(r=>r.id));const scopedProposalIds=JSON.stringify([...visibleProposalIds]);const docs=await all('SELECT * FROM dokumen WHERE usulan_id IN (SELECT value FROM json_each(?))',scopedProposalIds);const seen=await one("SELECT MAX(created) AS latest FROM audit_log WHERE user_id=? AND action='Lihat RKA perusahaan'",u.id);const reportsSeen=await one("SELECT MAX(created) AS latest FROM audit_log WHERE user_id=? AND action='Lihat laporan realisasi'",u.id);const pending={reports:['Administrator','Bappeda Provinsi','Perangkat Daerah'].includes(u.role)?records.filter(r=>r.type==='laporan'&&(!reportsSeen?.latest||r.created>reportsSeen.latest)).length:0,users:u.role==='Administrator'?(await all("SELECT id FROM perusahaan WHERE status='Menunggu Persetujuan'")).length:0,plans:['Administrator','Bappeda Provinsi'].includes(u.role)?records.filter(r=>r.type==='rencana_tjsl'&&(!seen?.latest||r.created>seen.latest)).length:0};return response({user:u,viewPlanningYear:viewYear,pending,usulan:rows,reportProposals,reopenedReports:(await all("SELECT * FROM records WHERE type='laporan' AND owner_id=? AND usulan_id IS NULL AND json_extract(payload,'$.completionRevokedAt') IS NOT NULL AND json_extract(payload,'$.replacedBy') IS NULL AND json_extract(payload,'$.deletedAt') IS NULL AND CAST(json_extract(payload,'$.year') AS INTEGER) BETWEEN ? AND ?",u.id,2024,u.planning_year)).map(unpack),companies:u.role==='Administrator'?companies:u.role==='Perusahaan'?companies.filter(c=>c.user_id===u.id):visibleCompanies(u,companies,records,rows).filter(c=>c.status==='Disetujui').map(c=>({id:c.id,name:c.name,jenis:c.jenis,status:c.status,payload:{demo:c.payload.demo,logoId:c.payload.logoId}})),master:await all('SELECT * FROM master'),records,reviews:(await all('SELECT r.*,u.name AS reviewer_name FROM review_usulan r JOIN users u ON u.id=r.reviewer_id WHERE r.usulan_id IN (SELECT value FROM json_each(?)) ORDER BY r.created DESC',scopedProposalIds)).filter(r=>visibleProposalIds.has(r.usulan_id)),meetings:(await all('SELECT m.*,r.usulan_id FROM rapat_pokja m JOIN review_usulan r ON r.meeting_id=m.id WHERE r.usulan_id IN (SELECT value FROM json_each(?))',scopedProposalIds)).filter(m=>visibleProposalIds.has(m.usulan_id)&&u.role!=='Perusahaan'),decisions:(await all('SELECT k.*,p.name AS company_name FROM keputusan_perusahaan k JOIN perusahaan p ON p.id=k.company_id WHERE k.usulan_id IN (SELECT value FROM json_each(?)) ORDER BY k.created DESC',scopedProposalIds)).filter(k=>visibleProposalIds.has(k.usulan_id)&&(u.role!=='Perusahaan'||k.company_id===company?.id)),documents:docs.filter(d=>visibleProposalIds.has(d.usulan_id)&&(u.role==='Administrator'||d.owner_id===u.id||visibleProposalIds.has(d.usulan_id))),notifications:await all('SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC',u.id)});
 }
 if(area==='notifications'){if(write){const b=await jsonBody(req);if(['rencana','laporan'].includes(b.category)){await audit(u,b.category==='rencana'?'Lihat RKA perusahaan':'Lihat laporan realisasi','records');return response({ok:true});}}await run('UPDATE notifications SET read=1 WHERE user_id=?',u.id);return response({ok:true});}
 if(area==='users'){
  assert(u.role==='Administrator','Hanya administrator yang dapat mengelola pengguna.',403);
  if(!write)return response((await all('SELECT * FROM users WHERE deleted_at IS NULL')).map(safeUser));const b=await jsonBody(req);
  return await handleUserWrite(u,id,b);
 }
 if(area==='master'){assert(u.role==='Administrator','Hanya administrator',403);const b=await jsonBody(req);assert(['program','bidang','wilayah','opd','tahun','kategori','sdgs'].includes(b.type),'Jenis master tidak valid');if(b.type==='tahun')assert(isSupportedPlanningYear(b.name),'Tahun Perencanaan tersedia: 2027, 2028, 2029.');if(id)await run('UPDATE master SET name=?,active=? WHERE id=?',validText(b.name,'Nama',250),b.active?1:0,id);else await run('INSERT INTO master (id,type,name,active) VALUES (?,?,?,?)',uid(),b.type,validText(b.name,'Nama',250),b.active?1:0);await audit(u,'Kelola master',id||b.type);return response({ok:true});}
 if(area==='companies'){assert(u.role==='Administrator','Hanya administrator',403);const b=await jsonBody(req);const c=await one('SELECT * FROM perusahaan WHERE id=?',id);assert(c?.user_id,'Perusahaan tidak ditemukan',404);assert(await one('SELECT id FROM users WHERE id=? AND deleted_at IS NULL',c.user_id),'Akun perusahaan telah dihapus',409);assert(['Disetujui','Ditolak'].includes(b.status),'Status tidak valid');await db().batch([db().prepare('UPDATE perusahaan SET status=? WHERE id=?').bind(b.status,id),db().prepare('UPDATE users SET active=? WHERE id=?').bind(b.status==='Disetujui'?1:0,c.user_id)]);await notify(c.user_id,`Registrasi perusahaan: ${b.status}`);await audit(u,'Persetujuan perusahaan',id);return response({ok:true});}
 if(area==='usulan')return await handleProposal(u,id,await jsonBody(req));
 if(area==='records')return await handleRecord(u,id,await jsonBody(req));
 if(area==='documents')return await handleDocument(req,u,id);
 if(area==='audit'){
  assert(u.role==='Administrator','Hanya administrator',403);
  if(write){const b=await jsonBody(req);assert(b.action==='clear'&&b.confirm===true,'Konfirmasi bersihkan audit wajib diberikan');const batch=uid(),stamp=now();
   await db().batch([
    db().prepare('INSERT INTO audit_log_archive (id,user_id,action,entity,created,ip_address,archived_at,archived_by,batch_id) SELECT id,user_id,action,entity,created,ip_address,?,?,? FROM audit_log').bind(stamp,u.id,batch),
    db().prepare('DELETE FROM audit_log'),
    db().prepare("INSERT INTO audit_log(id,user_id,action,entity,created,ip_address) VALUES(?,?,'Bersihkan Audit Aktivitas',?,?,?)").bind(uid(),u.id,'Arsip '+batch,stamp,auditIp())
   ]);return response({ok:true});
  }
  return response(await readAuditPage(new URL(req.url).searchParams));
 }
 if(area==='backup'){assert(!write,'Metode tidak diizinkan',405);assert(u.role==='Administrator','Hanya administrator',403);if(new URL(req.url).searchParams.get('format')==='sqlite')return await downloadDatabaseBackup(u);const data=await databaseSnapshot();await audit(u,'Ekspor backup','database');return response(data,200,{'Content-Disposition':`attachment; filename="siap-tanjak-backup-${now().slice(0,10)}.json"`});}
 return response({error:'Halaman tidak ditemukan'},404);
}catch(e:any){console.error('SIAP TANJAK API:',e.message);return response({error:e.status?e.message:'Layanan belum tersedia. Silakan coba kembali.'},e.status||503);}}
const secured=(req:Request)=>securityContext.run({ip:requestIp(req)},()=>handle(req));export const GET=secured;export const POST=secured;export const PATCH=secured;






