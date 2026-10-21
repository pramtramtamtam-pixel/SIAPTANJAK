const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {Worker}=require('node:worker_threads'),{DatabaseSync}=require('node:sqlite');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/'+file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>mocks[n]||require(n),Promise,Map,Error});return exports;}
test('SQLite worker preserves atomic transactions, backup consistency and nonblocking requests',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'siap-worker-test-')),file=path.join(dir,'test.sqlite');const db=new DatabaseSync(file);db.exec('CREATE TABLE items(id INTEGER PRIMARY KEY,value TEXT NOT NULL)');db.close();
 const source=load('sqlite-worker-source');const client=load('sqlite-worker',{'node:worker_threads':{Worker},'./sqlite-worker-source':source}).createSqliteWorker(file);
 try{
  await client.request('batch',{statements:[{sql:'INSERT INTO items VALUES(?,?)',args:[1,'one']},{sql:'INSERT INTO items VALUES(?,?)',args:[2,'two']}]});
  await assert.rejects(client.request('batch',{statements:[{sql:'INSERT INTO items VALUES(?,?)',args:[3,'three']},{sql:'INSERT INTO items VALUES(?,?)',args:[1,'duplicate']}]}));
  assert.equal((await client.request('first',{sql:'SELECT COUNT(*) n FROM items'})).n,2);
  const pragmas=await client.request('first',{sql:'PRAGMA foreign_keys'});assert.equal(pragmas.foreign_keys,1);
  const heavy=client.request('first',{sql:'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<300000) SELECT sum(x) total FROM n'});
  let heartbeat=false;await new Promise(resolve=>setTimeout(()=>{heartbeat=true;resolve();},5));assert.equal(heartbeat,true);assert.equal((await heavy).total,45000150000);
  const snapshot=await client.request('backup');assert.equal(snapshot.info.integrity,'ok');assert.ok(snapshot.bytes.length>0);
  const copyFile=path.join(dir,'copy.sqlite');fs.writeFileSync(copyFile,snapshot.bytes);const copy=new DatabaseSync(copyFile);assert.equal(copy.prepare('SELECT COUNT(*) n FROM items').get().n,2);copy.close();
 }finally{await client.close();fs.rmSync(dir,{recursive:true,force:true});}
});
