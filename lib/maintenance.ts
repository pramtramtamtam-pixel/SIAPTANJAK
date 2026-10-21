import {readEmailSettings} from './email-settings';
import {databaseDomains,sharedTables} from './database-domains';
import {env} from 'cloudflare:workers';
import {all,one,run,now,uid} from './server';
export async function databaseSnapshot(){const snapshot:any={created:now(),version:2,domains:databaseDomains,sharedTables};for(const table of Array.from(new Set([...sharedTables,...databaseDomains.flatMap(d=>d.tables)])))snapshot[table]=await all(`SELECT * FROM ${table}`);return snapshot;}
export async function dailyBackup(){if(!env.BUCKET)return;const key=`backup/${now().slice(0,10)}-v2.json`;if(await env.BUCKET.head(key))return;await env.BUCKET.put(key,JSON.stringify(await databaseSnapshot()),{httpMetadata:{contentType:'application/json'}});}
let emailFlushRunning=false;
export async function flushEmail(){
 const e=env as any,local=!!e.localMailConfigured?.();
 if(emailFlushRunning||(!local&&(!e.MAIL_RELAY_URL||!e.MAIL_RELAY_TOKEN||!e.MAIL_FROM_EMAIL)))return;
 emailFlushRunning=true;
 try{
  const {settings}=await readEmailSettings();
  const since=local?e.localMailStart():'';
  const mails=await all("SELECT * FROM email_outbox WHERE status='Menunggu' AND created>=? ORDER BY created,id LIMIT 10",since);
  for(const mail of mails){
   // Reserved example domains never receive scenario messages.
   if(/@[^@]*\.(invalid|test|example)$/i.test(mail.email)||/@example\.(com|net|org)$/i.test(mail.email))continue;
   const message={to:mail.email,subject:mail.subject||(mail.message.startsWith('Kepada Yth.')?'Terima Kasih atas Pendaftaran Perusahaan di SIAP-TANJAK':'Notifikasi SIAP TANJAK'),text:mail.message};
   try{
    let sent=false;
    if(local){await e.sendLocalMail({...message,fromName:settings.fromName,replyTo:settings.replyTo,fromEmail:settings.fromEmail});sent=true;}
    else{const res=await fetch(e.MAIL_RELAY_URL,{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${e.MAIL_RELAY_TOKEN}`,'Content-Type':'application/json','Idempotency-Key':mail.id},body:JSON.stringify({from:settings.fromEmail,fromName:settings.fromName,replyTo:settings.replyTo,...message})});sent=res.ok;}
    if(sent)await run("UPDATE email_outbox SET status='Terkirim' WHERE id=? AND status='Menunggu'",mail.id);
   }catch{console.error('Pengiriman email gagal; pesan tetap dalam antrean. Periksa konfigurasi SMTP/relay.');}
  }
 }finally{emailFlushRunning=false;}
}
