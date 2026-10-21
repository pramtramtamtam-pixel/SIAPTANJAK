import {IDLE_TIMEOUT_MS,auditIp} from './request-security';
export {hash,verifyPassword,passwordNeedsUpgrade,canUpgradePassword} from './passwords';
import {env} from 'cloudflare:workers';
import {seedUsulan,companies,bidang,wilayah,programs} from './data';
import {canReadProposal} from './workflow';
export function db(){if(!env.DB)throw new Error('Penyimpanan tidak tersedia. Silakan coba kembali.');return env.DB;}
export const now=()=>new Date().toISOString();
export const uid=()=>crypto.randomUUID();
export async function all(sql:string,...args:any[]){return (await db().prepare(sql).bind(...args).all()).results as any[];}
export async function one(sql:string,...args:any[]){return await db().prepare(sql).bind(...args).first() as any;}
export async function run(sql:string,...args:any[]){return db().prepare(sql).bind(...args).run();}
export function unpack(r:any){return {...r,payload:JSON.parse(r.payload||'{}')};}
let activeProfilesSynchronized=false;
export async function seed(){
 if(!activeProfilesSynchronized){const repaired=await run("UPDATE perusahaan SET status='Disetujui' WHERE status='Menunggu Persetujuan' AND user_id IN (SELECT id FROM users WHERE role='Perusahaan' AND active=1)");if(repaired.meta.changes)await audit(null,'Sinkronisasi profil perusahaan yang sudah diaktifkan Administrator',String(repaired.meta.changes));activeProfilesSynchronized=true;}
 if(await one('SELECT id FROM master LIMIT 1')||(env as any).SIAP_SEED_EXAMPLE_DATA!=='1')return;
 const queries=[];
 for(let i=0;i<companies.length;i++)queries.push(db().prepare('INSERT OR IGNORE INTO perusahaan (id,name,jenis,status,payload) VALUES (?,?,?,?,?)').bind(`co-${i}`,companies[i][0],companies[i][1],'Disetujui',JSON.stringify({demo:true,operasional:'Sumatera Selatan',pusat:'Data contoh'})));
 for(const r of seedUsulan)queries.push(db().prepare('INSERT OR IGNORE INTO usulan (id,title,bidang,wilayah,year,budget,status,progress,company_id,payload,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(r.id,r.title,r.bidang,r.wilayah,r.year,r.budget,r.status,r.progress,r.company_id,JSON.stringify(r.payload),r.created));
 for(const [type,values] of [['bidang',bidang],['wilayah',wilayah],['tahun',['2027','2028','2029']],['kategori',['Sarana dan prasarana','Pemberdayaan masyarakat','Bantuan sosial']],['opd',['Bappeda Provinsi Sumatera Selatan','Dinas Pendidikan','Dinas Kesehatan','Dinas Sosial','Dinas Perumahan dan Kawasan Permukiman','Dinas Lingkungan Hidup']],['sdgs',Array.from({length:17},(_,i)=>`SDGs ${i+1}`)] ] as [string,string[]][]){for(let i=0;i<values.length;i++)queries.push(db().prepare('INSERT OR IGNORE INTO master (id,type,name,active) VALUES (?,?,?,1)').bind(`${type}-${i}`,type,values[i]));}
 for(let i=0;i<programs.length;i++)queries.push(db().prepare('INSERT OR IGNORE INTO master (id,type,name,active) VALUES (?,?,?,1)').bind(`program-${i+1}`,'program',programs[i]));
 await db().batch(queries);
}
export async function user(req:Request){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)siap_session=([^;]+)/)?.[1];if(!token)return null;const stamp=Date.now();const row=await one('SELECT u.id,u.name,u.email,u.username,u.role,u.instansi,u.wilayah,u.bidang,u.active,s.planning_year,s.last_activity,s.expires AS session_expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.active=1 AND u.deleted_at IS NULL',token);if(!row)return null;if(row.session_expires<=stamp||row.last_activity<=stamp-IDLE_TIMEOUT_MS){const removed=await run('DELETE FROM sessions WHERE id=? AND (expires<=? OR last_activity<=?)',token,stamp,stamp-IDLE_TIMEOUT_MS);if(removed.meta.changes)await audit(row,'Sesi berakhir otomatis','session');return null;}const {last_activity,...account}=row;return {...account,idle_deadline:last_activity+IDLE_TIMEOUT_MS};}
export async function audit(u:any,action:string,entity:string){await run('INSERT INTO audit_log (id,user_id,action,entity,created,ip_address) VALUES (?,?,?,?,?,?)',uid(),u?.id||null,action,entity,now(),auditIp());}
export function canSee(u:any,r:any){return canReadProposal(u,r);}
export async function notify(userId:string,message:string){await run('INSERT INTO notifications (id,user_id,message,created) VALUES (?,?,?,?)',uid(),userId,message,now());const recipient=await one('SELECT email FROM users WHERE id=?',userId);if(recipient&&!recipient.email.endsWith('.invalid'))await run('INSERT INTO email_outbox (id,email,message,status,created) VALUES (?,?,?,?,?)',uid(),recipient.email,message,'Menunggu',now());}
export function assert(v:any,message:string,status=400):asserts v {if(!v)throw Object.assign(new Error(message),{status});}
export async function jsonBody(req:Request):Promise<any>{assert(Number(req.headers.get('content-length')||0)<200000,'Permintaan terlalu besar',413);const reader=req.body?.getReader();assert(reader,'Isi permintaan wajib diberikan.');let total=0,text='';const decoder=new TextDecoder();while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>=200000){await reader.cancel();assert(false,'Permintaan terlalu besar',413);}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();let body:any;try{body=JSON.parse(text);}catch{assert(false,'Format permintaan JSON tidak valid.');}assert(body&&typeof body==='object'&&!Array.isArray(body),'Isi permintaan harus berupa objek JSON.');return body;}
export function validText(v:any,label:string,max=1000){assert(typeof v==='string'&&v.trim().length>0&&v.length<=max,`${label} wajib diisi (maks. ${max} karakter)`);return v.trim();}
export function safeUser(u:any){const {password,...rest}=u;return {...rest,role:rest.role==='POKJA Forum CSR'?'Perangkat Daerah':rest.role};}
