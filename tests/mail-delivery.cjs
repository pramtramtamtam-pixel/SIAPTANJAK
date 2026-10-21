const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function mailer(env,mails){
 const updates=[],queries=[];
 const code=ts.transpileModule(fs.readFileSync('lib/maintenance.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,require:n=>n==='./email-settings'?{readEmailSettings:async()=>({settings:{fromEmail:'siaptanjak@gmail.com',fromName:'SIAP TANJAK',replyTo:'siaptanjak@gmail.com'}})}:n==='cloudflare:workers'?{env}:n==='./server'?{all:async(...q)=>{queries.push(q);return mails;},run:async(...q)=>updates.push(q)}:{},console:{error(){}},AbortSignal});
 return {...exports,updates,queries};
}
test('SMTP sends new queued mail and marks sent only after acceptance',async()=>{
 const sent=[];const m=mailer({localMailConfigured:()=>true,localMailStart:()=> '2026-10-20',sendLocalMail:async b=>sent.push(b)},[{id:'new',email:'real@company.co.id',message:'Kepada Yth. Company'}]);
 await m.flushEmail();assert.equal(sent.length,1);assert.match(sent[0].subject,/Terima Kasih/);assert.equal(m.queries[0][1],'2026-10-20');assert.equal(m.updates[0][1],'new');
});
test('SMTP failure leaves message queued; reserved scenario recipients are skipped',async()=>{
 let calls=0;const m=mailer({localMailConfigured:()=>true,localMailStart:()=>'',sendLocalMail:async()=>{calls++;throw Error('failure');}},[{id:'test',email:'sample@example.test',message:'sample'},{id:'real',email:'real@company.co.id',message:'hello'}]);
 await m.flushEmail();assert.equal(calls,1);assert.equal(m.updates.length,0);
});
test('Unconfigured transport does not process the queue',async()=>{
 const m=mailer({},[]);await m.flushEmail();assert.equal(m.queries.length,0);
});
