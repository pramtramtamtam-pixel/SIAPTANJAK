// Runs SQLite requests on a dedicated Node worker, retaining atomic batches.
export const sqliteWorkerSource=String.raw`
const {parentPort,workerData}=require('node:worker_threads');
const {DatabaseSync,backup}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto');
const db=new DatabaseSync(workerData.file);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA cache_size=-8192; PRAGMA temp_store=MEMORY; PRAGMA wal_autocheckpoint=1000;');
async function execute(message){
 const {action,sql,args=[],statements=[]}=message;
 if(action==='all')return {results:db.prepare(sql).all(...args),success:true};
 if(action==='first'){const row=db.prepare(sql).get(...args);return message.column?row?.[message.column]??null:row??null;}
 if(action==='run'){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
 if(action==='batch'){db.exec('BEGIN IMMEDIATE');try{const out=statements.map(s=>{const r=db.prepare(s.sql).run(...s.args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};});db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}
 if(action==='backup'){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'siaptanjak-backup-'));const file=path.join(dir,'siaptanjak.sqlite');fs.chmodSync(dir,0o700);
  try{await backup(db,file);fs.chmodSync(file,0o600);const bytes=new Uint8Array(fs.readFileSync(file));const copy=new DatabaseSync(file,{readOnly:true});try{const integrity=Object.values(copy.prepare('PRAGMA quick_check').get())[0];if(integrity!=='ok')throw Error('Backup integrity failed');const tables=copy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);return {bytes,info:{tables,tableCount:tables.length,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),integrity}};}finally{copy.close();}}
  finally{for(const name of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,name));fs.rmdirSync(dir);}
 }
 throw Error('Unknown database worker action');
}
let queue=Promise.resolve();parentPort.on('message',message=>{queue=queue.then(async()=>{try{parentPort.postMessage({id:message.id,result:await execute(message)});}catch(error){parentPort.postMessage({id:message.id,error:{message:error.message,code:error.code}});}});});
`;
