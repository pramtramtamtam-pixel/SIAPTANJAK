export function proposalsForTab(rows:any[],role:string,tab:string,companyId?:string){
 return rows.filter(r=>{
  if(role==='Administrator'&&tab==='Semua')return true;
  if(tab==='Menunggu Komitmen Perusahaan')return ['Terverifikasi','Disetujui POKJA Provinsi'].includes(r.status)&&!r.company_id;
  if(tab==='Ditolak')return r.status.startsWith('Ditolak');
  if(tab==='Dalam Pelaksanaan'||tab==='Selesai')return !!r.company_id&&r.status===tab&&(role!=='Perusahaan'||!!companyId&&r.company_id===companyId);
  return !['Dalam Pelaksanaan','Selesai'].includes(r.status)&&!r.status.startsWith('Ditolak')&&(role!=='Perusahaan'||r.status==='Disetujui POKJA Provinsi'&&!r.company_id);
 });
}
