import {recordCoversRegion} from './report-state';
import {isDeleted,canReadProposal} from './workflow';
export const managementRoles=['Administrator','Bappeda Provinsi'];
export const timelineRoles=[...managementRoles,'Perusahaan','Perangkat Daerah','POKJA Forum CSR','Bappeda Kab/Kota'];
export function workspaceMenus(role:string){
 const common=['dashboard','usulan'];
 if(role==='Administrator')return ['dashboard','homepage','email','pengguna','jadwal','master','audit','rencana','usulan','laporan','monitoring','penilaian'];
 if(role==='Bappeda Provinsi')return ['dashboard','jadwal','pokja','rencana','laporan','monitoring','penilaian'];
 if(role==='Perusahaan')return ['dashboard','rencana','usulan','laporan','monitoring'];
 if(['Perangkat Daerah','POKJA Forum CSR'].includes(role))return [...common,'pokja','rencana','laporan','monitoring'];
 if(role==='Bappeda Kab/Kota')return [...common,'laporan','monitoring'];
 return [];
}
export function visibleRecords(u:any,records:any[],proposals:any[],reportYear=u.planning_year){
 return records.filter(r=>{
  const p=r.payload||{},proposal=proposals.find(v=>v.id===r.usulan_id);
  if(r.type==='csr_book'||isDeleted(r)||r.type!=='rencana_tjsl'&&Number(p.year||proposal?.year||String(p.actualStart||p.start||r.created).slice(0,4))!==Number(r.type==='laporan'?reportYear:u.planning_year))return false;
  if(r.type==='rencana_tjsl')return ['Perangkat Daerah','POKJA Forum CSR'].includes(u.role)&&p.bidang===u.bidang||managementRoles.includes(u.role)||u.role==='Perusahaan'&&r.owner_id===u.id;
  if(managementRoles.includes(u.role))return true;
  if(u.role==='Perusahaan')return r.owner_id===u.id;
  if(['laporan','evaluasi'].includes(r.type)){
   if(u.role==='Bappeda Kab/Kota')return recordCoversRegion(p,u.wilayah,proposal?.wilayah);
   if(['Perangkat Daerah','POKJA Forum CSR'].includes(u.role))return (p.bidang||proposal?.bidang)===u.bidang;
  }
  return !!proposal&&canReadProposal(u,proposal);
 });
}
export function visibleCompanies(u:any,companies:any[],records:any[],proposals:any[]){
 if(managementRoles.includes(u.role))return companies;
 if(u.role==='Perusahaan')return companies.filter(c=>c.user_id===u.id);
 const owners=new Set(records.map(r=>r.owner_id)),ids=new Set(proposals.map(p=>p.company_id).filter(Boolean));
 return companies.filter(c=>owners.has(c.user_id)||ids.has(c.id));
}

