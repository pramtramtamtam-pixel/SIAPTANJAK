import {proposalDistance} from './commitment-filters';
import type {OfficeOption,ProposalLocation} from './commitment-filters';
export function matchesProposalChoices(row:{wilayah:string;bidang:string},regions:string[],themes:string[]){
 return (!regions.length||regions.includes(row.wilayah))&&(!themes.length||themes.includes(row.bidang));
}
export function sortProposalBudget<T extends {budget:unknown}>(rows:T[],direction:string):T[]{
 if(!direction)return rows;
 return [...rows].sort((a,b)=>{const av=Number(a.budget),bv=Number(b.budget);if(!Number.isFinite(av))return Number.isFinite(bv)?1:0;if(!Number.isFinite(bv))return -1;return (av-bv)*(direction==='asc'?1:-1);});
}

/** Unknown locations remain last in either direction; each distance is calculated once. */
export function sortProposalDistance<T extends ProposalLocation>(rows:T[],direction:string,office?:OfficeOption):T[]{
 if(!direction||!office)return rows;
 return rows.map((row,index)=>({row,index,distance:proposalDistance(row,office)})).sort((a,b)=>{
  if(a.distance===null)return b.distance===null?a.index-b.index:1;
  if(b.distance===null)return -1;
  return (a.distance-b.distance)*(direction==='asc'?1:-1)||a.index-b.index;
 }).map(value=>value.row);
}
