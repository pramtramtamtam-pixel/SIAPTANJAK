import {latestActiveReports,reportActivityKey} from './report-state';
export function monitoringData(records:any[],proposals:any[],year='',theme='',company='',activitySource='',kind=''){
 const proposalMap=new Map(proposals.map(p=>[p.id,p])),latest=new Map<string,any>();
 const active=records.filter(r=>!r.payload?.deletedAt);const reopened=active.filter(r=>r.type==='laporan'&&r.payload?.completionRevokedAt&&!r.payload?.replacedBy&&!r.usulan_id);
 for(const r of latestActiveReports(active))latest.set(reportActivityKey(r),r);
 const source=[...reopened.map(r=>({...r,id:'reopened:'+r.id,type:'ongoing',payload:{...r.payload,physical:0,amount:0,start:r.payload.actualStart,end:r.payload.actualEnd}})),...active.filter(r=>r.type==='rencana_tjsl'),...Array.from(latest.values()).filter(r=>proposalMap.get(r.usulan_id)?.status!=='Dibatalkan')];
 const activeCommitments=new Map<string,any>();for(const r of active){if(r.type==='komitmen'&&r.status==='Aktif'&&!activeCommitments.has(r.usulan_id))activeCommitments.set(r.usulan_id,r);}
 for(const proposal of proposals.filter(p=>p.status==='Dalam Pelaksanaan'&&p.company_id&&!p.payload?.deletedAt)){
  if(latest.has('usulan:'+proposal.id))continue;
  const commitment=activeCommitments.get(proposal.id);
  source.push({id:'ongoing:'+proposal.id,type:'ongoing',usulan_id:proposal.id,title:proposal.title,owner_id:commitment?.owner_id||proposal.company_owner_id||proposal.company_id,company_name:commitment?.company_name||proposal.company_name,created:proposal.created,payload:{...proposal.payload,...commitment?.payload,bidang:proposal.bidang,wilayah:proposal.wilayah,physical:proposal.progress||0,year:proposal.year}});
 }
 const entries=source.map(r=>{
  const p=r.payload||{},proposal=proposalMap.get(r.usulan_id),completed=r.type==='laporan'&&Number(p.physical)===100&&(!proposal||proposal.status==='Selesai');
  const kind=r.type==='rencana_tjsl'?'Rencana':completed?'Realisasi':'Berjalan';
  const start=r.type==='rencana_tjsl'||r.type==='ongoing'?p.start:p.actualStart,end=r.type==='rencana_tjsl'||r.type==='ongoing'?p.end:p.actualEnd;
  const first=Date.parse(start),last=Date.parse(end),dated=Number.isFinite(first)&&Number.isFinite(last)&&last>=first;
  return {origin:proposal?.origin||p.origin,id:r.id,owner:r.owner_id,company:r.company_name||r.owner_name||'Perusahaan',title:r.title,theme:p.bidang||proposal?.bidang||'Belum diklasifikasikan',kind,source:r.usulan_id?'Tindak lanjut usulan':'Mandiri',start,end,first,last,dated,payload:p,scheduleOnly:r.type==='ongoing',year:Number(p.year||proposal?.year||String(start||r.created).slice(0,4))};
 });
 const companies=Array.from(new Map(entries.map(e=>[e.owner,{id:e.owner,name:e.company}])).values()).sort((a,b)=>a.name.localeCompare(b.name));
 const themes=Array.from(new Set(entries.map(e=>e.theme))).sort();
 const yearStart=year?Date.UTC(Number(year),0,1):0,yearEnd=year?Date.UTC(Number(year)+1,0,1):0;
 const filtered=entries.filter(e=>(!kind||e.kind===kind)&&(!theme||e.theme===theme)&&(!company||e.owner===company)&&(!activitySource||e.kind==='Rencana'||e.source===activitySource)&&(!year||(e.kind==='Rencana'&&e.dated?e.first<yearEnd&&e.last>=yearStart:String(e.year)===String(year))));
 const dates=filtered.filter(e=>e.dated).flatMap(e=>[e.first,e.last]);
 const firstYear=year?Number(year):dates.length?new Date(Math.min(...dates)).getUTCFullYear():new Date().getUTCFullYear(),lastYear=year?Number(year):dates.length?new Date(Math.max(...dates)).getUTCFullYear():firstYear;
 const base=Date.UTC(firstYear,0,1),end=Date.UTC(lastYear+1,0,1),months=Array.from({length:(lastYear-firstYear+1)*12},(_,i)=>new Date(Date.UTC(firstYear,i,1)));
 const groups=Array.from(new Set(filtered.map(e=>e.theme))).sort().map(t=>({theme:t,entries:filtered.filter(e=>e.theme===t).sort((a,b)=>a.company.localeCompare(b.company)||(a.kind===b.kind?0:a.kind==='Rencana'?-1:1)||a.first-b.first)}));
 const completed=filtered.filter(e=>e.kind==='Realisasi');
 const funding=Array.from(new Set(completed.map(e=>e.theme))).map(name=>({name,value:completed.filter(e=>e.theme===name).reduce((sum,e)=>sum+Number(e.payload.amount||0),0)}));
 return {entries:filtered,companies,themes,groups,base,end,months,funding,planCount:filtered.filter(e=>e.kind==='Rencana').length,ongoingCount:filtered.filter(e=>e.kind==='Berjalan').length,actualCount:completed.length,actualAmount:completed.reduce((a,e)=>a+Number(e.payload.amount||0),0)};
}

// Input is already limited by the monitoring filters and the account's POKJA.
export function fundingByCompany(entries:any[],companyIds:string[]=[]){
 const palette=['#2563eb','#15803d','#b91c1c','#7e22ce','#0e7490','#b45309','#be185d','#4338ca','#047857','#a16207','#0891b2','#c2410c','#4d7c0f','#a21caf','#0369a1','#e11d48','#6d28d9','#0f766e','#92400e','#475569'];
 const ids=Array.from(new Set([...companyIds,...entries.map(e=>String(e.owner||e.company||'unknown'))])).sort(),used=new Set<number>(),colors=new Map<string,string>();
 for(const id of ids){const hash=Array.from(id).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);let index=hash%palette.length;while(used.has(index)&&used.size<palette.length)index=(index+1)%palette.length;used.add(index);colors.set(id,palette[index]);}
 const groups=new Map<string,{id:string;name:string;value:number;color:string}>();
 for(const entry of entries){
  if(entry.kind!=='Realisasi')continue;
  const id=String(entry.owner||entry.company||'unknown');
  const value=Number(entry.payload?.amount||0);if(!Number.isFinite(value)||value<0)continue;
  if(!groups.has(id))groups.set(id,{id,name:entry.company||'Perusahaan',value:0,color:colors.get(id)!});
  groups.get(id)!.value+=value;
 }
 return Array.from(groups.values()).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
