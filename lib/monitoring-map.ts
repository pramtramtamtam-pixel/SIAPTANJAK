import {latestActiveReports,recordCoversRegion} from './report-state';
// Combine authorized proposal rows and saved realization locations for the map.
export const mapLocationKinds=['Sedang dilaksanakan','Selesai dilaksanakan','Usulan TJSL'];
export const mapLocationColors:Record<string,string>={'Sedang dilaksanakan':'#d81e28','Selesai dilaksanakan':'#327569','Usulan TJSL':'#bc962b'};
export function mapLocationKind(row:any){return row.status==='Selesai'?mapLocationKinds[1]:row.status==='Dalam Pelaksanaan'?mapLocationKinds[0]:mapLocationKinds[2];}
export function monitoringMapData(proposals:any[],records:any[],filters:any={}){
 const valid=(p:any)=>p?.lat!==''&&p?.lng!==''&&Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lng))&&Number(p.lat)>=-5&&Number(p.lat)<=-1&&Number(p.lng)>=102&&Number(p.lng)<=107;
 const reports=latestActiveReports(records);
 const latest=new Map<string,any>();
 for(const r of [...reports].sort((a,b)=>String(b.created).localeCompare(String(a.created))||b.id.localeCompare(a.id))){if(r.usulan_id&&!latest.has(r.usulan_id))latest.set(r.usulan_id,r);}
 const rows=proposals.filter(r=>!r.payload?.deletedAt).map(r=>{
  const report=latest.get(r.id),p=report?.payload;
  if(p)r={...r,mapActualPayload:p};
  return p&&valid(p)&&r.status!=='Dibatalkan'?{...r,payload:{...r.payload,wilayah:p.wilayah||r.wilayah,wilayahs:p.wilayahs,lat:Number(p.lat),lng:Number(p.lng),kecamatan:p.kecamatan,desa:p.desa},mapLocationSource:'Lokasi laporan realisasi'}:r;
 });
 const standalone=new Map<string,any>();for(const report of [...reports].sort((a,b)=>String(b.created).localeCompare(String(a.created))||b.id.localeCompare(a.id)).filter(r=>!r.usulan_id)){const key=report.payload?.activityId||report.id;if(!standalone.has(key))standalone.set(key,report);}
 const reopened=records.filter(r=>r.type==='laporan'&&!r.usulan_id&&!r.payload?.deletedAt&&r.payload?.completionRevokedAt&&!r.payload?.replacedBy).map(r=>({...r,payload:{...r.payload,physical:0,amount:0}}));
 const orphanReports=reports.filter(r=>r.usulan_id&&!proposals.some(p=>p.id===r.usulan_id));
 for(const report of [...standalone.values(),...reopened,...orphanReports]){
  const p=report.payload||{};
  rows.push({id:'laporan:'+report.id,title:report.title,bidang:p.bidang,wilayah:p.wilayah,year:Number(p.year||String(p.actualStart||report.created).slice(0,4)),status:Number(p.physical)===100?'Selesai':'Dalam Pelaksanaan',progress:Number(p.physical||0),payload:p,mapReport:report,mapLocationSource:report.usulan_id?'Lokasi laporan realisasi':'Kegiatan mandiri',company_name:report.company_name||report.owner_name});
 }
 const q=String(filters.query||'').trim().toLowerCase();
 const statuses=Array.isArray(filters.status)?filters.status:filters.status?[filters.status]:[],kinds=Array.isArray(filters.kinds)?filters.kinds:[];
 return rows.filter(r=>r.status!=='Dibatalkan'&&valid(r.payload)&&(!filters.year||String(r.year)===String(filters.year))&&(!statuses.length||statuses.includes(r.status))&&(!kinds.length||kinds.includes(mapLocationKind(r)))&&(!filters.wilayah||recordCoversRegion(r.payload,filters.wilayah,r.wilayah))&&(!filters.bidang||r.bidang===filters.bidang)&&(!q||[r.title,r.id,r.wilayah,r.company_name,r.payload.kecamatan,r.payload.desa].filter(Boolean).join(' ').toLowerCase().includes(q)));
}
