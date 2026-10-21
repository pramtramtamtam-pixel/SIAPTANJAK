import {createSqliteWorker} from './sqlite-worker';
import {localMailConfigured,sendLocalMail,localMailStart,localMailAccount} from './local-mail';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';

const dataRoot=path.resolve(process.env.SIAP_DATA_DIR||'./data');
fs.mkdirSync(dataRoot,{recursive:true,mode:0o700});
const sqlite=new DatabaseSync(path.join(dataRoot,'siaptanjak.sqlite'));
sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; PRAGMA cache_size=-8192; PRAGMA temp_store=MEMORY; PRAGMA wal_autocheckpoint=1000;');
sqlite.exec('CREATE TABLE IF NOT EXISTS lighthouse_migrations(name TEXT PRIMARY KEY, applied TEXT NOT NULL)');
const migrations=path.resolve(process.env.SIAP_MIGRATIONS_DIR||'./drizzle');
for(const name of fs.readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort()){
 if(sqlite.prepare('SELECT name FROM lighthouse_migrations WHERE name=?').get(name))continue;
 sqlite.exec('BEGIN IMMEDIATE');try{sqlite.exec(fs.readFileSync(path.join(migrations,name),'utf8'));sqlite.prepare('INSERT INTO lighthouse_migrations VALUES(?,?)').run(name,new Date().toISOString());sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
}
sqlite.exec('PRAGMA optimize');sqlite.close();
const workerKey=Symbol.for('siaptanjak.sqlite-worker'),workerGlobal=globalThis as any;
const workerFile=path.join(dataRoot,'siaptanjak.sqlite');
if(workerGlobal[workerKey]&&workerGlobal[workerKey].file!==workerFile)throw Error('Database worker directory mismatch');
const sqliteWorker=workerGlobal[workerKey]?.client||createSqliteWorker(workerFile);
workerGlobal[workerKey]={file:workerFile,client:sqliteWorker};
class Statement{
 constructor(public sql:string,public args:any[]=[]){ }
 bind(...args:any[]){return new Statement(this.sql,args.map(v=>typeof v==='boolean'?Number(v):v));}
 async all(){return sqliteWorker.request('all',{sql:this.sql,args:this.args});}
 async first(column?:string){return sqliteWorker.request('first',{sql:this.sql,args:this.args,column});}
 async run(){return sqliteWorker.request('run',{sql:this.sql,args:this.args});}
}
const DB={prepare:(sql:string)=>new Statement(sql),async batch(statements:Statement[]){return sqliteWorker.request('batch',{statements:statements.map(s=>({sql:s.sql,args:s.args}))});}};
const objectRoot=path.join(dataRoot,'objects');fs.mkdirSync(objectRoot,{recursive:true,mode:0o700});
// Hash keys into private paths; caller-controlled names never become filesystem paths.
const objectPaths=(key:string)=>{const hash=createHash('sha256').update(key).digest('hex');return {body:path.join(objectRoot,hash+'.bin'),meta:path.join(objectRoot,hash+'.json')};};
const BUCKET={
 async put(key:string,value:any,options:any={}){const p=objectPaths(key);const bytes=typeof value==='string'?Buffer.from(value):value instanceof ReadableStream?Buffer.from(await new Response(value).arrayBuffer()):Buffer.from(value);const temp=p.body+'.'+randomUUID();fs.writeFileSync(temp,bytes,{mode:0o600});fs.renameSync(temp,p.body);fs.writeFileSync(p.meta,JSON.stringify({key,size:bytes.length,uploaded:new Date().toISOString(),httpMetadata:options.httpMetadata||{},etag:createHash('sha256').update(bytes).digest('hex')}),{mode:0o600});return {key,size:bytes.length};},
 async head(key:string){const p=objectPaths(key);if(!fs.existsSync(p.body)||!fs.existsSync(p.meta))return null;const m=JSON.parse(fs.readFileSync(p.meta,'utf8'));return {...m,uploaded:new Date(m.uploaded)};},
 async get(key:string){const p=objectPaths(key),m=await this.head(key);if(!m)return null;return {...m,body:Readable.toWeb(fs.createReadStream(p.body)),arrayBuffer:async()=>{const b=fs.readFileSync(p.body);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},text:async()=>fs.readFileSync(p.body,'utf8')};},
 async delete(key:string){const p=objectPaths(key);for(const f of [p.body,p.meta])if(fs.existsSync(f))fs.unlinkSync(f);},
 async list(options:any={}){const objects=[];for(const f of fs.readdirSync(objectRoot).filter(n=>n.endsWith('.json'))){const m=JSON.parse(fs.readFileSync(path.join(objectRoot,f),'utf8'));if(!options.prefix||m.key.startsWith(options.prefix))objects.push({...m,uploaded:new Date(m.uploaded)});}return {objects,truncated:false};}
};
async function databaseBackup(){return sqliteWorker.request('backup');}
export const env:any={...process.env,DB,BUCKET,databaseBackup,localMailConfigured,sendLocalMail,localMailStart,localMailAccount};
