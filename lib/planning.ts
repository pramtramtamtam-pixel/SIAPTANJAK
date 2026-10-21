import {canPrintPhase} from './print-phase-access';
import {reportYears} from './report-options';
import {auditIp} from './request-security';
import {isSupportedPlanningYear,supportedPlanningYears} from './planning-years';
import {all,one,run,db,uid,now,assert,canSee,unpack} from './server';
import {phases,legacyPhases,WORKFLOW_VERSION,deriveSchedules,effectivePlanningSchedules,postReportingOpen,workflowStagePolicy,openScheduledStage} from './planning-phases';
export {phases};
export async function planningYears(){const rows=await all("SELECT name FROM master WHERE type='tahun' AND active=1 AND name IN ('2027','2028','2029') ORDER BY CAST(name AS INTEGER)");return !rows.length&&!await one("SELECT id FROM master WHERE type='tahun' LIMIT 1")?[...supportedPlanningYears]:rows.map(r=>Number(r.name));}
export async function requireLinkedReportYear(u:any,year:any){return requireReadableProposalYear(u,year);}
export async function requireReportViewYear(u:any,year:any){return requireReadableProposalYear(u,year);}
export async function requireReportYear(u:any,year:any){await requireYear(u,u.planning_year);assert(Number.isInteger(Number(year))&&reportYears(u.planning_year).includes(Number(year)),'Tahun laporan tersedia mulai 2024 sampai Tahun Perencanaan yang dipilih.',403);}
export async function requireYear(u:any,year:any){assert(u?.planning_year,'Pilih Tahun Perencanaan sebelum masuk aplikasi.',409);assert(isSupportedPlanningYear(u.planning_year),'Tahun Perencanaan sesi ini tidak tersedia. Keluar lalu pilih tahun 2027, 2028 atau 2029.',409);assert(Number(year)===Number(u.planning_year),'Data berada di luar Tahun Perencanaan yang dipilih.',403);}
export async function requireProposalYear(u:any,year:any){await requireYear(u,u.planning_year);assert(Number.isInteger(Number(year))&&Number(year)===Number(u.planning_year)+1,'Tahun usulan harus tahun perencanaan + 1 ('+(Number(u.planning_year)+1)+').' ,403);}
export async function requireReadableProposalYear(u:any,year:any){await requireYear(u,u.planning_year);assert(Number.isInteger(Number(year))&&Number(year)>=2024&&Number(year)<=Number(u.planning_year)+1,'Tahun berada di luar jangkauan sesi ini.',403);}
export async function planningScheduleState(year:number){const events=await one('SELECT payload FROM planning_events WHERE year=?',year);const payload=events?JSON.parse(events.payload):null;const raw=await all('SELECT * FROM planning_schedules WHERE year=? ORDER BY phase',year);return {events:payload,schedules:effectivePlanningSchedules(raw,payload).map(s=>({...s,planningYear:year,scheduleVersion:events?.payload?JSON.stringify({events:payload,updated:raw.map(r=>r.updated)}):JSON.stringify(raw.map(r=>({phase:r.phase,opens:r.opens,closes:r.closes,enabled:r.enabled,updated:r.updated})))})),postReportingOpen:postReportingOpen(raw,payload,Date.parse(now()))};}
export async function isPostReportingOpen(year:number){return (await planningScheduleState(year)).postReportingOpen;}
export async function activePhase(year:number){const {schedules}=await planningScheduleState(year);const clock=Date.parse(now());return schedules.find(s=>s.enabled&&Date.parse(s.opens)<=clock&&clock<Date.parse(s.closes))||null;}
export async function requireOpen(u:any,allowed?:number[]){const phase=openScheduledStage((await planningScheduleState(u.planning_year)).schedules,allowed||[0,1,2],Date.parse(now()));assert(phase,'Penginputan usulan ditutup. Bappeda Provinsi perlu menetapkan jadwal tahapan untuk tahun ini.',409);assert(!allowed||allowed.includes(phase.phase),'Tindakan ini hanya dibuka pada '+(allowed||[]).map(i=>phases[i]).join(' / ')+'.',409);return phase;}
/** One policy for writes: verification follows stages; reporting uses its independent post-stage switch. */
export async function requireWorkflowAction(u:any,action:string){
 await requireYear(u,u.planning_year);
 if(['report','cancel-execution','reopen-completion'].includes(action)){
  const state=await planningScheduleState(u.planning_year);
  assert(state.postReportingOpen,'Pelaporan dan perubahan pelaksanaan ditutup. Buka Tahap Pasca Musrenbang atau aktifkan checklist pelaporan.',409);
  return state.schedules.find(s=>s.phase===2)!;
 }
 const allowed=workflowStagePolicy[action]||[];
 assert(allowed.length,'Tindakan tahapan tidak dikenal');return requireOpen(u,allowed);
}
export function workflowContext(u:any,phase:any){return {planningYear:Number(u.planning_year),phase:phase?.phase??null,actorId:u.id,schedule:phase?{planningYear:phase.planningYear??Number(u.planning_year),opens:phase.opens,closes:phase.closes,continuous:!!phase.continuous,manualEnabled:!!phase.manualEnabled,version:phase.scheduleVersion||null}:null};}
export async function requireProposalOpen(u:any,origin:string){
 const allowed=u.role==='Administrator'?[0,1,2]:u.role==='Bappeda Kab/Kota'?[0]:u.role==='Perangkat Daerah'?[0,1]:[];
 assert(allowed.length,'Peran ini tidak memiliki kewenangan mengusulkan',403);
 if(u.role==='Bappeda Kab/Kota')assert(origin==='Kab/Kota','Bappeda Kab/Kota hanya dapat mengajukan usulan Kab/Kota',403);
 if(u.role==='Perangkat Daerah')assert(origin==='Provinsi'||origin==='Kab/Kota','Asal usulan tidak valid',403);
 return requireOpen(u,allowed);
}
export function scheduleDates(value:any){const parse=(s:any)=>{assert(typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s),'Isi tanggal dan jam jadwal (WIB).');const date=new Date(s+':00+07:00');assert(!Number.isNaN(date.getTime()),'Jadwal tidak valid');return date.toISOString();};const opens=parse(value.opens),closes=parse(value.closes);assert(opens<closes,'Jadwal selesai harus setelah jadwal dibuka.');return {opens,closes};}
export async function handlePlanning(req:Request,u:any,id?:string){
 const year=Number(u.planning_year);await requireYear(u,year);
 if(req.method==='GET'){const state=await planningScheduleState(year);return Response.json({year,serverTime:now(),version:WORKFLOW_VERSION,phases,...state,active:await activePhase(year),legacySchedules:await all('SELECT * FROM planning_schedules_legacy WHERE year=? ORDER BY phase',year)});}
 assert(req.method==='POST','Metode tidak diizinkan',405);assert(['Administrator','Bappeda Provinsi'].includes(u.role),'Penetapan jadwal merupakan kewenangan Bappeda Provinsi.',403);const b:any=await req.json();await requireYear(u,b.year);let result:ReturnType<typeof deriveSchedules>;try{result=deriveSchedules(b.events,year,Array.isArray(b.enabled)&&b.enabled[2]===true);}catch(e:any){assert(false,e.message);}
 assert(Array.isArray(b.enabled)&&b.enabled.length===3&&b.enabled.every((v:any)=>typeof v==='boolean'),'Pilih status aktif untuk tiga tahapan.');
 for(const phase of b.enabled.map((on:boolean,i:number)=>on?i:-1).filter((i:number)=>i>=0))assert(result!.schedules.some(s=>s.phase===phase),`Lengkapi tanggal yang diperlukan untuk Tahap ${phase+1} sebelum mengaktifkannya.`);
 const stamp=now(),statements:any[]=[db().prepare('INSERT INTO planning_events(year,payload,updated_by,updated) VALUES(?,?,?,?) ON CONFLICT(year) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated=excluded.updated').bind(year,JSON.stringify(result!.events),u.id,stamp)];
 for(const s of result!.schedules)statements.push(db().prepare('INSERT INTO planning_schedules(id,year,phase,opens,closes,enabled,updated_by,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(year,phase) DO UPDATE SET opens=excluded.opens,closes=excluded.closes,enabled=excluded.enabled,updated_by=excluded.updated_by,updated=excluded.updated').bind(uid(),year,s.phase,s.opens,s.closes,b.enabled[s.phase]?1:0,u.id,stamp));
 for(const phase of [0,1,2])if(!result!.schedules.some(s=>s.phase===phase)&&!b.enabled[phase])statements.push(db().prepare('UPDATE planning_schedules SET enabled=0,updated_by=?,updated=? WHERE year=? AND phase=?').bind(u.id,stamp,year,phase));
 statements.push(db().prepare('INSERT INTO audit_log(id,user_id,action,entity,created,ip_address) VALUES(?,?,?,?,?,?)').bind(uid(),u.id,'Tetapkan jadwal tahapan TJSL',JSON.stringify({year,version:WORKFLOW_VERSION,...result!,enabled:b.enabled}),stamp,auditIp()));await db().batch(statements);return Response.json({ok:true});
}
export function revisionStatement(u:any,r:any,phase:any,action:string){return db().prepare('INSERT INTO proposal_revisions (id,usulan_id,year,phase,action,actor_id,snapshot,created,workflow_version) VALUES (?,?,?,?,?,?,?,?,2)').bind(uid(),r.id,r.year,phase?.phase??null,action,u.id,JSON.stringify({...r,workflowContext:workflowContext(u,phase)}),now());}
export function currentRevisionStatement(u:any,id:string,phase:any,action:string,guardChanges=false){return db().prepare("INSERT INTO proposal_revisions(id,usulan_id,year,phase,action,actor_id,snapshot,created,workflow_version) SELECT ?,id,year,?,?,?,json_object('id',id,'owner_id',owner_id,'title',title,'bidang',bidang,'wilayah',wilayah,'year',year,'budget',budget,'status',status,'progress',progress,'company_id',company_id,'origin',origin,'committed_amount',committed_amount,'actual_amount',actual_amount,'payload',json(payload),'workflowContext',json(?)),?,2 FROM usulan WHERE id=?"+(guardChanges?' AND changes()=1':'')).bind(uid(),phase?.phase??null,action,u.id,JSON.stringify(workflowContext(u,phase)),now(),id);}
export async function handlePhaseReport(req:Request,u:any){const phase=Number(new URL(req.url).searchParams.get('phase'));assert(Number.isInteger(phase)&&phase>=0&&phase<3,'Pilih tahapan');assert(canPrintPhase(u.role,String(phase)),'Tahapan cetak ini tidak tersedia untuk peran Anda',403);const current=(await all('SELECT * FROM usulan WHERE year=?',Number(u.planning_year)+1)).map(unpack);const company=await one('SELECT id FROM perusahaan WHERE user_id=?',u.id);const allowed=current.filter(r=>u.role==='Perusahaan'?(r.company_id===company?.id||r.status==='Disetujui POKJA Provinsi'&&!r.company_id):canSee(u,r)).map(r=>r.id);
 const versions=await all('SELECT v.*,u.name AS actor_name FROM proposal_revisions v LEFT JOIN users u ON u.id=v.actor_id WHERE v.year=? AND v.phase=? AND v.workflow_version=2 ORDER BY v.created DESC,v.rowid DESC',Number(u.planning_year)+1,phase);const seen=new Set<string>();const rows=versions.filter(v=>{if(!allowed.includes(v.usulan_id)||seen.has(v.usulan_id))return false;seen.add(v.usulan_id);return true;}).map(v=>({...v,snapshot:JSON.parse(v.snapshot)}));return Response.json({year:u.planning_year,phase,name:phases[phase],rows,changes:versions.filter(v=>allowed.includes(v.usulan_id)).length,generated:now()});}
