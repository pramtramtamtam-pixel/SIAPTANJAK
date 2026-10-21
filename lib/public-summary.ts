import {latestActiveReports} from './report-state';
export function publicSummary(proposals:any[],records:any[],companies:any[],pokjaCount:number){
 const reports=latestActiveReports(records),byProposal=new Map(reports.filter(r=>r.usulan_id).map(r=>[r.usulan_id,r]));
 const companyByOwner=new Map(companies.map(c=>[c.user_id,c.id])),supported=new Set<string>();let completed=0,beneficiaries=0;
 const count=(value:any)=>{const n=Number(value);return Number.isFinite(n)&&n>=0?n:0;};
 for(const p of proposals.filter(p=>p.status==='Selesai'&&!p.payload?.deletedAt)){completed++;const report=byProposal.get(p.id);beneficiaries+=count(report?report.payload?.beneficiaries:p.payload?.beneficiaries);if(p.company_id&&companies.some(c=>c.id===p.company_id))supported.add(p.company_id);}
 for(const r of reports.filter(r=>!r.usulan_id&&Number(r.payload?.physical)===100&&companyByOwner.has(r.owner_id))){completed++;beneficiaries+=count(r.payload?.beneficiaries);supported.add(companyByOwner.get(r.owner_id)!);}
 return {completed,supportingCompanies:supported.size,beneficiaries,pokjaCount};
}
