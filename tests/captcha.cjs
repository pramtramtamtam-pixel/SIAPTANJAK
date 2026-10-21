const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function verifier(challenge){
 const exports={},deletions=[];
 const source=ts.transpileModule(fs.readFileSync('lib/registration-services.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>name==='cloudflare:workers'?{env:{localManualLoginMode:()=>true}}:name==='./server'?{
  assert:(ok,message)=>{if(!ok)throw Error(message);},one:async()=>challenge,
  run:async(sql,id)=>{deletions.push(id);return {meta:{changes:challenge?.used?0:1}};}
 }:{},URL,Response,Date,TextEncoder,crypto:require('node:crypto').webcrypto});
 return {...exports,deletions};
}
test('Login requires CAPTCHA even when a previous local manual-mode switch is present',async()=>{
 const m=verifier(null);
 for(const url of ['http://localhost:3000/api/auth/login','https://siaptanjak.test/api/auth/login','http://localhost:3000/api/auth/register'])
  await assert.rejects(m.verifyRobot(new Request(url),{}),/Konfirmasi bahwa Anda bukan robot/);
 assert.equal(m.deletions.length,0);
});
test('CAPTCHA rejects missing, expired and reused challenges',async()=>{
 for(const challenge of [null,{expires:Date.now()-1}]){
  const m=verifier(challenge);
  await assert.rejects(m.verifyRobot(new Request('http://localhost:3000/api/auth/login'),{notRobot:true,challengeId:'missing'}),/kedaluwarsa/);
  assert.equal(m.deletions.length,0);
 }
 const m=verifier({id:'used',expires:Date.now()+60000,ip_hash:await verifier().digest('local'),used:true});
 await assert.rejects(m.verifyRobot(new Request('http://localhost:3000/api/auth/login'),{notRobot:true,challengeId:'used',robotAnswer:'0'}),/sudah digunakan/);
});
