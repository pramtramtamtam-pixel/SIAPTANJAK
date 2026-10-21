import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const childEnvironment={...process.env};
for(const key of Object.keys(childEnvironment))if(key.toLowerCase()==='psmodulepath')delete childEnvironment[key];
import nodemailer from 'nodemailer';

const configPath=()=>path.resolve(process.env.SIAP_DATA_DIR||'./data','smtp.local.json');
function configuration(){
 try{const c=JSON.parse(fs.readFileSync(configPath(),'utf8').replace(/^\uFEFF/,''));return typeof c.user==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.user)&&typeof c.passwordProtected==='string'&&c.passwordProtected&&Number.isFinite(Date.parse(c.enabledAt))?c:null;}catch{return null;}
}
export function localMailConfigured(){return process.platform==='win32'&&!!configuration();}
export function localMailAccount(){return configuration()?.user||'';}
export function localMailStart(){return configuration()?.enabledAt||new Date().toISOString();}
export async function sendLocalMail(message:{to:string;subject:string;text:string;fromName?:string;replyTo?:string;fromEmail?:string}){
 const c=configuration();if(!c)throw Error('SMTP belum dikonfigurasi');
 // DPAPI decrypts only for the Windows account that saved this file. Never log credentials.
 const password=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from("$c=Get-Content -LiteralPath $env:SIAP_SMTP_CONFIG -Raw | ConvertFrom-Json; $s=ConvertTo-SecureString $c.passwordProtected; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}","utf16le").toString("base64")],{env:{...childEnvironment,SIAP_SMTP_CONFIG:configPath()},encoding:'utf8',windowsHide:true,timeout:10000,stdio:['ignore','pipe','ignore']}).trim();
 const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:c.user,pass:password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,tls:{minVersion:'TLSv1.2'}});
 try{if(message.fromEmail&&message.fromEmail.toLowerCase()!==c.user.toLowerCase())throw Error('Alamat pengirim tidak sesuai akun SMTP');await transport.sendMail({from:{name:message.fromName||'Tim Pengelola SIAP-TANJAK',address:c.user},to:message.to,subject:message.subject,text:message.text,replyTo:message.replyTo||c.user});}finally{transport.close();}
}
