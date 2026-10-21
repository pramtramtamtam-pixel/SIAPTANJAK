import {latestActiveReports} from './report-state';
import {sdgGoals} from './sdg-goals';
export function alignmentSummary(records:any[],proposals:any[],master:any[],year:number){
 const reports=latestActiveReports(records.filter(r=>Number(r.payload?.year)===Number(year)));
 const proposalPayloads=new Map(proposals.map(p=>[p.id,p.payload||{}]));
 const programs=master.filter(m=>m.type==='program').map(m=>({id:String(m.id),name:m.name}));
 const summarize=(choices:{id:string;name:string}[],key:'program'|'sdgs')=>choices.map(choice=>{
  const rows=reports.filter(r=>{const source=proposalPayloads.get(r.usulan_id)||{},values=r.payload?.[key]??source[key]??[];return Array.isArray(values)&&new Set(values.map(String)).has(choice.id);});
  return {...choice,count:rows.length,amount:rows.reduce((n,r)=>{const a=Number(r.payload?.amount);return n+(Number.isFinite(a)&&a>=0?a:0);},0)};
 });
 return {year,activityCount:reports.length,amount:reports.reduce((n,r)=>{const a=Number(r.payload?.amount);return n+(Number.isFinite(a)&&a>=0?a:0);},0),programs:summarize(programs,'program'),sdgs:summarize(sdgGoals.map((name,i)=>({id:String(i+1),name})),'sdgs')};
}
