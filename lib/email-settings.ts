import {env} from 'cloudflare:workers';
import {one,run,assert,jsonBody,audit,now} from './server';
import {emailSettingsDefaults,emailVariables} from './email-template';
export async function readEmailSettings(){const row=await one("SELECT * FROM email_settings WHERE id='registration'");return {settings:{...emailSettingsDefaults,...(row?JSON.parse(row.payload):{})},version:row?.version||0};}
export function validateEmailSettings(value:any,smtpAccount=''){
 const clean:any={};
 for(const key of Object.keys(emailSettingsDefaults)){
  assert(typeof value?.[key]==='string',`Isi ${key} tidak valid`);
  clean[key]=value[key].trim();assert(clean[key].length>0&&clean[key].length<=(key==='body'?20000: key==='subject'?250:200),'Isi pengaturan terlalu panjang atau kosong');
 }
 for(const key of ['fromEmail','replyTo','supportEmail']){assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean[key]),'Format alamat email tidak valid');clean[key]=clean[key].toLowerCase();}
 for(const key of ['fromName','subject'])assert(!/[\r\n]/.test(clean[key]),'Nama pengirim dan subjek harus satu baris');
 if(smtpAccount)assert(clean.fromEmail===smtpAccount.toLowerCase(),'Alamat pengirim harus sama dengan akun SMTP server. Ubah akun melalui SETUP-EMAIL-GMAIL terlebih dahulu.');
 assert(/\{\{\s*tautan_konfirmasi\s*\}\}/.test(clean.body),'Isi email wajib memuat {{tautan_konfirmasi}}');
 for(const field of ['body','subject']){
  const remainder=clean[field].replace(/\{\{\s*(\w+)\s*\}\}/g,(_m:string,key:string)=>{assert(emailVariables.includes(key),'Variabel template tidak dikenal: '+key);return '';});
  assert(!remainder.includes('{{')&&!remainder.includes('}}'),'Penulisan variabel template tidak valid');
 }
 return clean;
}
export async function handleEmailSettings(req:Request,u:any){
 assert(u,'Silakan masuk',401);assert(u.role==='Administrator','Hanya Administrator dapat mengatur email',403);
 const e=env as any;
 if(req.method==='GET')return Response.json({...await readEmailSettings(),smtpAccount:e.localMailAccount?.()||'',configured:!!(e.localMailConfigured?.()||(e.MAIL_RELAY_URL&&e.MAIL_RELAY_TOKEN&&e.MAIL_FROM_EMAIL))},{headers:{'Cache-Control':'no-store'}});
 assert(req.method==='POST','Metode tidak diizinkan',405);
 const b=await jsonBody(req),settings=validateEmailSettings(b.settings,e.localMailAccount?.()||'');
 assert(Number.isInteger(b.version)&&b.version>=0,'Versi pengaturan tidak valid');
 const result=b.version===0?await run("INSERT INTO email_settings(id,payload,version,updated_by,updated) VALUES('registration',?,1,?,?) ON CONFLICT(id) DO NOTHING",JSON.stringify(settings),u.id,now()):await run("UPDATE email_settings SET payload=?,version=version+1,updated_by=?,updated=? WHERE id='registration' AND version=?",JSON.stringify(settings),u.id,now(),b.version);
 assert(result.meta.changes===1,'Pengaturan telah diubah pengguna lain. Muat ulang sebelum menyimpan.',409);
 await audit(u,'Ubah pengaturan email','email_settings:registration');
 return Response.json({ok:true,...await readEmailSettings()},{headers:{'Cache-Control':'no-store'}});
}
