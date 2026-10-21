import {alignmentSummary} from './alignment-summary';
import {recordCoversRegion} from './report-state';
import {all,assert,unpack,now} from './server';
import {requireReportYear,planningScheduleState} from './planning';
import {assessmentScore,rankAssessments} from './assessment-criteria';
export async function provinceDashboard(req:Request,u:any){
 assert(req.method==='GET','Metode tidak diizinkan',405);assert(['Administrator','Bappeda Provinsi','Perangkat Daerah','Bappeda Kab/Kota'].includes(u.role),'Dashboard di luar kewenangan Anda',403);const pd=u.role==='Perangkat Daerah',kab=u.role==='Bappeda Kab/Kota';
 const year=Number(new URL(req.url).searchParams.get('year')||u.planning_year);await requireReportYear(u,year);
 const awardYear=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date()));
 const proposals=(await all("SELECT * FROM usulan WHERE year IN (?,?) AND json_extract(payload,'$.deletedAt') IS NULL",year,year+1)).map(unpack).filter(r=>(!pd||r.bidang===u.bidang)&&(!kab||r.wilayah===u.wilayah));
 const records=(await all("SELECT r.*,c.name AS company_name FROM records r LEFT JOIN perusahaan c ON c.user_id=r.owner_id WHERE r.type IN ('rencana_tjsl','laporan') AND CAST(json_extract(r.payload,'$.year') AS INTEGER)=? AND json_extract(r.payload,'$.deletedAt') IS NULL",year)).map(unpack).filter(r=>(!pd||(r.payload.bidang||proposals.find(p=>p.id===r.usulan_id)?.bidang)===u.bidang)&&(!kab||recordCoversRegion(r.payload,u.wilayah,proposals.find(p=>p.id===r.usulan_id)?.wilayah)));
 const companies=(await all("SELECT c.id,c.user_id,c.name FROM perusahaan c JOIN users u ON u.id=c.user_id WHERE c.status='Disetujui' AND u.active=1 AND u.deleted_at IS NULL")).filter(c=>!pd&&!kab||records.some(r=>r.owner_id===c.user_id)||proposals.some(p=>p.company_id===c.id));
 const assessments=pd||kab?[]:(await all("SELECT a.*,c.name AS company_name,c.payload AS company_payload FROM company_assessments a JOIN perusahaan c ON c.id=a.company_id JOIN users u ON u.id=c.user_id WHERE a.year=? AND a.status='Final' AND c.status='Disetujui' AND u.active=1 AND u.deleted_at IS NULL",awardYear)).map(unpack).map(a=>({...a,logoId:JSON.parse(a.company_payload||'{}').logoId,...assessmentScore(a.payload.values,a.payload.finance)}));
 const administration=u.role==='Administrator'?{users:(await all("SELECT COUNT(*) n FROM users WHERE active=1 AND deleted_at IS NULL"))[0].n,companies:(await all("SELECT COUNT(*) n FROM perusahaan c JOIN users u ON u.id=c.user_id WHERE u.deleted_at IS NULL"))[0].n,pendingCompanies:(await all("SELECT COUNT(*) n FROM perusahaan c JOIN users u ON u.id=c.user_id WHERE c.status='Menunggu Persetujuan' AND u.deleted_at IS NULL"))[0].n,activity:(await all('SELECT a.action,a.created,u.name AS actor FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created DESC LIMIT 3'))}:null;
 const alignment=!pd&&!kab?alignmentSummary(records,proposals,await all("SELECT id,type,name FROM master WHERE type='program' ORDER BY rowid"),year):null;
 return Response.json({alignmentSummary:alignment,administration,year,awardYear,generated:now(),proposals,records,companies,schedules:(await planningScheduleState(year)).schedules,ranking:rankAssessments(assessments).filter(a=>a.grade==='A').slice(0,3)},{headers:{'Cache-Control':'private, no-store'}});
}
