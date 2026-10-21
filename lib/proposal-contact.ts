import {one,assert,unpack,canSee} from './server';
import {isDeleted} from './workflow';
export async function handleProposalContact(req:Request,u:any,id:string){
 assert(req.method==='GET','Metode tidak diizinkan',405);
 const stored=await one('SELECT * FROM usulan WHERE id=?',id);
 assert(stored,'Usulan tidak ditemukan',404);
 const proposal=unpack(stored),company=proposal.company_id?await one('SELECT * FROM perusahaan WHERE id=?',proposal.company_id):null;
 assert(!isDeleted(proposal)&&proposal.year>=2024&&proposal.year<=Number(u.planning_year)+1,'Usulan di luar jangkauan sesi',403);
 assert(u.role==='Perusahaan'?(company?.user_id===u.id||proposal.status==='Disetujui POKJA Provinsi'&&!proposal.company_id):canSee(u,proposal)||proposal.owner_id===u.id,'Tidak berwenang melihat kontak usulan ini',403);
 const companyContact=!!proposal.company_id;
 const owner=await one('SELECT id,name,instansi,role FROM users WHERE id=?',companyContact?company?.user_id:proposal.owner_id);
 const profile=owner?await one('SELECT phone,pic_name FROM user_profiles WHERE user_id=?',owner.id):null;
 const payload=company?unpack(company).payload:{};
 return Response.json({contact:{kind:companyContact?'perusahaan':'pengusul',name:companyContact?payload.pic||profile?.pic_name||owner?.name||'':profile?.pic_name||owner?.name||'',institution:companyContact?company?.name||'':owner?.instansi||'',phone:companyContact?payload.phone||payload.picPhone||profile?.phone||'':profile?.phone||''}},{headers:{'Cache-Control':'private, no-store'}});
}
