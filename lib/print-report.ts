import {readYearRecords} from './domain-records';
import {all,assert,unpack,now,canSee} from './server';
import {phases,requireYear,requireReportYear,requireReportViewYear,planningScheduleState} from './planning';
import {canPrintPhase} from './print-phase-access';
import {legacyPhases} from './planning-phases';
import {visibleRecords,visibleCompanies,timelineRoles,workspaceMenus} from './access';
import {isDeleted} from './workflow';
export async function handlePrintReport(req:Request,u:any){
 await requireYear(u,u.planning_year);
 const params=new URL(req.url).searchParams,scope=params.get('scope')||'usulan',phase=scope==='usulan'?params.get('phase')||'all':'all';
 assert(['usulan','rencana','laporan','monitoring','peta'].includes(scope),'Jenis cetak tidak valid');
 assert(scope==='peta'?timelineRoles.includes(u.role):(workspaceMenus(u.role).includes(scope)||scope==='usulan'&&workspaceMenus(u.role).includes('pokja')),'Tidak berwenang mencetak halaman ini',403);
 const reportYear=Number(params.get('reportYear')||params.get('year')||Number(u.planning_year)+1);assert(Number.isInteger(reportYear)&&reportYear>=1900&&reportYear<=9999,'Tahun cetak tidak valid');if(scope==='usulan')assert(reportYear>=2024&&reportYear<=Number(u.planning_year)+1,'Tahun usulan di luar jangkauan sesi',403);else if(scope!=='rencana'&&reportYear!==Number(u.planning_year)+1)await requireReportViewYear(u,reportYear);
 const legacy=phase.startsWith('legacy'),index=Number(legacy?phase.slice(6):phase);
 assert(phase==='all'||/^[0-2]$/.test(phase)||/^legacy[0-3]$/.test(phase),'Pilih tahapan yang tersedia');
 assert(canPrintPhase(u.role,phase),'Tahapan cetak ini tidak tersedia untuk peran Anda',403);
 const companies=(await all('SELECT * FROM perusahaan')).map(unpack),own=companies.find(c=>c.user_id===u.id);
 const allowed=(r:any)=>u.role==='Perusahaan'?(!!own&&r.company_id===own.id||r.status==='Disetujui POKJA Provinsi'&&!r.company_id):canSee(u,r);
 const accessible=(await all('SELECT * FROM usulan WHERE year=?',reportYear)).map(unpack).filter(allowed);
 const current=accessible.filter(r=>!isDeleted(r));
 let proposals=current;let archivedSchedule:any=null;
 if(phase!=='all'){
  const versions=(await all('SELECT snapshot,usulan_id,phase,created FROM proposal_revisions WHERE year=? AND phase<=? AND phase IS NOT NULL AND workflow_version=? ORDER BY created DESC,rowid DESC',reportYear,index,legacy?1:2)).filter(v=>{const context=JSON.parse(v.snapshot).workflowContext;return !context||Number(context.planningYear)===reportYear-1;}),seen=new Set();
  archivedSchedule=versions.filter(v=>v.phase===index).map(v=>JSON.parse(v.snapshot).workflowContext?.schedule).find(Boolean)||null;
  proposals=versions.filter(v=>{if(seen.has(v.usulan_id))return false;seen.add(v.usulan_id);return true;}).map(v=>JSON.parse(v.snapshot)).filter(r=>!isDeleted(r)&&allowed(r));
 }
 proposals=proposals.map(r=>({...r,company_name:companies.find(c=>c.id===r.company_id)?.name,company_owner_id:companies.find(c=>c.id===r.company_id)?.user_id}));
 let records=visibleRecords({...u,planning_year:reportYear},await readYearRecords({...u,planning_year:reportYear},reportYear),current,reportYear);
 if(phase!=='all')records=records.filter(r=>r.payload.planningPhase===index&&(legacy?!r.payload.planningPhaseVersion||r.payload.planningPhaseVersion===1:r.payload.planningPhaseVersion===2));
 if(scope==='rencana')records=records.filter(r=>r.type==='rencana_tjsl');
 if(scope==='laporan')records=records.filter(r=>r.type==='laporan');
 const schedule=archivedSchedule||(scope==='usulan'&&phase!=='all'?(await planningScheduleState(reportYear-1)).schedules.find((s:any)=>s.phase===index):null);
 return Response.json({schedule,scheduleSource:archivedSchedule?'archive':'current',scope,year:reportYear,planningYear:scope==='usulan'?reportYear-1:u.planning_year,phase,name:phase==='all'?'Seluruh data tahun terpilih':legacy?'Arsip tahapan lama · '+legacyPhases[index]:phases[index],proposals,records,companies:visibleCompanies(u,companies,records,proposals).map(c=>({id:c.id,name:c.name})),generated:now(),note:phase==='all'?'Data sesuai Tahun Perencanaan dan kewenangan pengguna.':'Status menggunakan arsip terakhir sampai tahapan terpilih, termasuk usulan yang belum berubah sejak tahap sebelumnya. Perubahan pada tahap berikutnya tidak dimasukkan. Jadwal menggunakan salinan arsip jika tersedia, dengan keterangan sumber; jika belum tersedia menggunakan pengaturan saat cetak; data tanpa arsip tahapan tidak direkonstruksi dan hanya tersedia pada seluruh data tahun terpilih.'},{headers:{'Cache-Control':'no-store'}});
}

