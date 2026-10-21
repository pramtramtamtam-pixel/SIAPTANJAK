import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),release=path.join(root,'release','SIAP-TANJAK');
const data=fs.mkdtempSync(path.join(os.tmpdir(),'siap-release-'));
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
const child=spawn(process.execPath,['dist/standalone/server.js'],{cwd:release,env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),SIAP_DATA_DIR:data,SIAP_MIGRATIONS_DIR:path.join(release,'drizzle'),SIAP_SEED_EXAMPLE_DATA:'0',MAIL_RELAY_URL:'',MAIL_RELAY_TOKEN:'',MAIL_FROM_EMAIL:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
let errors='';child.stderr.on('data',v=>errors+=v.toString());child.stdout.resume();
try{
 const base='http://127.0.0.1:'+port;let ready=false;
 for(let i=0;i<60;i++){
  if(child.exitCode!==null)throw Error('Runtime gagal: '+errors);
  try{const r=await fetch(base+'/api/me',{signal:AbortSignal.timeout(1000)});if(r.ok){const me=await r.json();assert.equal(me.setup,true);assert.ok(me.years.includes(2027));ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(ready,'Runtime belum siap: '+errors);
 assert.equal((await fetch(base+'/api/public')).status,200);
 const challenge=await (await fetch(base+'/api/robot?purpose=login')).json();assert.ok(challenge.id);assert.ok(!challenge.disabled);
 const rejected=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:'test@example.invalid',password:'invalid',year:2027})});assert.equal(rejected.status,400);
 const asset=await fetch(base+'/favicon.svg');assert.equal(asset.status,200);assert.equal(await asset.text(),fs.readFileSync(path.join(release,'public','favicon.svg'),'utf8'));
 console.log('PASS: API, data master tahun, CAPTCHA wajib, penolakan login tanpa CAPTCHA, dan aset publik pada runtime terpisah.');
}finally{
 if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}
 const resolved=path.resolve(data);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('siap-release-'))throw Error('Direktori uji tidak valid');
 fs.rmSync(resolved,{recursive:true,force:true});
}
