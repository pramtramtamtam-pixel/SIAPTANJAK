import {cloudDocumentUrl} from './cloud-document-links';
import {supportFileType} from './upload-policy';
import {requireYear,requireOpen,requireProposalYear,requireProposalOpen,requireReadableProposalYear} from './planning';
import {canEditProposal,isDeleted} from './workflow';
import {env} from 'cloudflare:workers';
import {one,run,uid,now,assert,audit,canSee} from './server';
import {documentCategories,previewType,readyStatuses} from './workflow';
export const MAX_DOCUMENT_BYTES=25*1024*1024;
const inlineMimes:Record<string,string>={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime'};
export async function handleDocument(req:Request,u:any,id:string|undefined){
 if(req.method==='GET'){
  const d=await one('SELECT * FROM dokumen WHERE id=?',id);assert(d,'Dokumen tidak ditemukan',404);
  const r=d.usulan_id?await one('SELECT * FROM usulan WHERE id=?',d.usulan_id):null;
  if(r){await requireReadableProposalYear(u,r.year);if(['Bappeda Kab/Kota','Perangkat Daerah','POKJA Forum CSR'].includes(u.role))assert(canSee(u,r),'Dokumen di luar kewenangan lokasi / POKJA',403);}
  const c=r?.company_id?await one('SELECT user_id FROM perusahaan WHERE id=?',r.company_id):null;
  assert(u.role==='Administrator'||d.owner_id===u.id||r&&canSee(u,r)||c?.user_id===u.id||u.role==='Perusahaan'&&r&&!isDeleted(r)&&readyStatuses.includes(r.status),'Tidak berwenang membaca dokumen',403);
  if(d.external_url)return Response.redirect(cloudDocumentUrl(d.external_url),302);
  const object=await env.BUCKET?.get(id!);assert(object,'Berkas tidak tersedia',404);
  const preview=new URL(req.url).searchParams.get('preview')==='1';const type=previewType(d.name),ext=d.name.split('.').pop()?.toLowerCase()||'';
  const inline=preview&&type!=='download';
  // Text is always served as plain text, never executable HTML/SVG/JavaScript.
  const mime=inline?(type==='text'?'text/plain; charset=utf-8':inlineMimes[ext]||'application/octet-stream'):'application/octet-stream';
  return new Response(object.body,{headers:{'Content-Type':mime,'Content-Length':String(object.size),'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(d.name)}`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'private, no-store'}});
 }
 assert(req.method==='POST','Metode tidak diizinkan',405);
 if(req.headers.get('content-type')?.includes('application/json')){
  assert(['Administrator','Bappeda Kab/Kota','Perangkat Daerah','POKJA Forum CSR','Perusahaan'].includes(u.role),'Tidak berwenang menambahkan tautan',403);
  const b:any=await req.json(),url=cloudDocumentUrl(b.url);
  const r=await one('SELECT * FROM usulan WHERE id=?',String(b.usulanId||''));assert(r&&!isDeleted(r),'Usulan tidak ditemukan',404);
  await requireProposalYear(u,r.year);
  const company=await one('SELECT id FROM perusahaan WHERE user_id=?',u.id);
  const owner=canEditProposal(u,r)&&(r.owner_id===u.id||u.role==='Administrator'||u.role==='Perangkat Daerah');
  assert(owner||u.role==='Perusahaan'&&r.company_id===company?.id&&r.status==='Dalam Pelaksanaan','Tidak berwenang menambahkan data dukung pada tahap ini',403);
  if(owner)await requireProposalOpen(u,r.origin);
  const category=String(b.category||'Data dukung lainnya'),name=String(b.name||'Data dukung cloud').trim(),description=String(b.description||'').trim();
  assert(documentCategories.includes(category),'Jenis data dukung tidak valid');assert(name.length>0&&name.length<=180,'Nama dokumen maksimal 180 karakter');assert(description.length<=1000,'Keterangan maksimal 1.000 karakter');
  const existing=await one('SELECT id,name FROM dokumen WHERE usulan_id=? AND category=? AND external_url=?',r.id,category,url);if(existing)return Response.json({ok:true,...existing,external_url:url,alreadyUploaded:true});
  const newId=uid();await run('INSERT INTO dokumen(id,owner_id,usulan_id,name,mime,size,category,extension,description,sha256,created,external_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',newId,u.id,r.id,name,'text/uri-list',0,category,'link',description,'',now(),url);
  await audit(u,'Tambah tautan data dukung: '+category,newId);return Response.json({ok:true,id:newId,name,external_url:url,size:0,description});
 }
assert(env.BUCKET,'Penyimpanan berkas tidak tersedia',503);
 assert(Number(req.headers.get('content-length')||0)<=MAX_DOCUMENT_BYTES+1000000,'Maksimal 25 MB per berkas',413);
 const form=await req.formData(),file=form.get('file'),proposalId=String(form.get('usulanId')||'');
 assert(file&&typeof file!=='string'&&typeof file.arrayBuffer==='function','Pilih berkas yang akan diunggah');assert(file.size>0&&file.size<=MAX_DOCUMENT_BYTES,'Ukuran berkas harus 1 byte sampai 25 MB',413);
 const r=await one('SELECT * FROM usulan WHERE id=?',proposalId);assert(r&&!isDeleted(r),'Usulan tidak ditemukan',404);
 await requireProposalYear(u,r.year);if(r.owner_id===u.id||u.role==='Administrator')await requireProposalOpen(u,r.origin);
 const c=await one('SELECT id FROM perusahaan WHERE user_id=?',u.id);
 const ownerCanUpload=r.owner_id===u.id&&['Draft','Ditolak Bappeda Provinsi'].includes(r.status);
 assert(u.role==='Administrator'||ownerCanUpload||r.company_id===c?.id&&r.status==='Dalam Pelaksanaan','Tidak berwenang melampirkan berkas pada tahap ini',403);
 const category=String(form.get('category')||'Data dukung lainnya');assert(documentCategories.includes(category),'Jenis data dukung tidak valid');const description=String(form.get('description')||'').trim();assert(description.length<=1000,'Keterangan maksimal 1000 karakter');
 const name=file.name.replace(/[\x00-\x1f\x7f]/g,'').split(/[\\/]/).pop()?.slice(0,180)||'dokumen';if(file.name.includes(':'))assert(false,'Nama berkas tidak valid');
 const bytes=await file.arrayBuffer();const {extension,mime}=supportFileType(file.name,new Uint8Array(bytes),file.type,category);const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');const newId=uid();
 await env.BUCKET.put(newId,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
 try{await run('INSERT INTO dokumen (id,owner_id,usulan_id,name,mime,size,category,extension,description,sha256,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)',newId,u.id,r.id,name,mime,file.size,category,extension,description,sha256,now());}catch(e){await env.BUCKET.delete(newId);throw e;}
 await audit(u,'Unggah data dukung: '+category,newId);return Response.json({ok:true,id:newId,name},{headers:{'Cache-Control':'no-store'}});
}
