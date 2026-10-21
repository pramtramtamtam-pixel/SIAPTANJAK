export type Coordinates={lat:number;lng:number};
export type OfficeOption=Coordinates&{key:string;type:string;address:string;wilayah:string};
export type CommitmentFilters={officeKey:string;customOffice?:OfficeOption|null;radiusKm:number|null;minBudget?:number|null;maxBudget:number|null};
export const emptyCommitmentFilters:CommitmentFilters={officeKey:'',radiusKm:null,minBudget:null,maxBudget:null};
export function coordinates(value:{lat?:unknown;lng?:unknown}|null|undefined):Coordinates|null{
 if(value?.lat===null||value?.lat===undefined||value?.lat===''||value?.lng===null||value?.lng===undefined||value?.lng==='')return null;
 const lat=Number(value.lat),lng=Number(value.lng);
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
export function distanceKm(a:Coordinates,b:Coordinates){const radians=(v:number)=>v*Math.PI/180,dlat=radians(b.lat-a.lat),dlng=radians(b.lng-a.lng);const h=Math.sin(dlat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dlng/2)**2;return 6371.0088*2*Math.atan2(Math.sqrt(Math.max(0,Math.min(1,h))),Math.sqrt(Math.max(0,1-h)));}
type OfficeInput={type?:string;address?:string;wilayah?:string;lat?:unknown;lng?:unknown};
type CompanyPayload={offices?:OfficeInput[];pusat?:string;operasional?:string;latPusat?:unknown;lngPusat?:unknown;latOperasional?:unknown;lngOperasional?:unknown};
export function companyOfficeOptions(payload:CompanyPayload|undefined):OfficeOption[]{
 const stored=Array.isArray(payload?.offices)&&payload.offices.length?payload.offices:[{type:'Kantor pusat',address:payload?.pusat,lat:payload?.latPusat,lng:payload?.lngPusat},{type:'Kantor operasional',address:payload?.operasional,lat:payload?.latOperasional,lng:payload?.lngOperasional}];
 return stored.flatMap((office,index)=>{const point=coordinates(office);return point?[{...point,key:String(index),type:office.type||'Kantor',address:office.address||'',wilayah:office.wilayah||''}]:[];});
}
export type ProposalLocation={budget?:unknown;payload?:{lat?:unknown;lng?:unknown}};
export function proposalDistance(proposal:ProposalLocation,office:OfficeOption|undefined){const point=coordinates(proposal.payload);return office&&point?distanceKm(office,point):null;}
export function matchesCommitmentFilters(proposal:ProposalLocation,office:OfficeOption|undefined,filters:CommitmentFilters){
 if(filters.minBudget!=null&&(!Number.isFinite(Number(proposal.budget))||Number(proposal.budget)<filters.minBudget))return false;
 if(filters.minBudget!=null&&filters.maxBudget!=null&&filters.minBudget>filters.maxBudget)return false;
 if(filters.maxBudget!==null&&(!Number.isFinite(Number(proposal.budget))||Number(proposal.budget)>filters.maxBudget))return false;
 if(filters.radiusKm!==null){const distance=proposalDistance(proposal,office);if(distance===null||distance>filters.radiusKm+1e-9)return false;}
 return true;
}
export function commitmentLimits(proposals:ProposalLocation[]=[],office?:OfficeOption){
 const budgets=proposals.map(p=>p.budget).filter(v=>v!==null&&v!==undefined&&v!==''&&['string','number'].includes(typeof v)).map(Number).filter(n=>Number.isFinite(n)&&n>=0);
 const distances=proposals.map(p=>proposalDistance(p,office)).filter((v):v is number=>v!==null);
 return {radiusMin:distances.length?Math.min(...distances):0,radiusMax:distances.length?Math.max(...distances):0,radiusStep:"any" as const,hasDistances:distances.length>0,budgetMin:budgets.length?Math.min(...budgets):0,budgetMax:budgets.length?Math.max(...budgets):0,budgetStep:1,hasBudgets:budgets.length>0};
}
export type CommitmentLimits=ReturnType<typeof commitmentLimits>;
/** Bound the radius to known locations; preserve the user-entered budget bounds. */
export function commitmentDraft(value:CommitmentFilters,limits:CommitmentLimits=commitmentLimits()):CommitmentFilters{
 const clamp=(n:number|null,min:number,max:number,fallback:number)=>n!==null&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
 return {officeKey:value.officeKey,customOffice:value.customOffice,radiusKm:limits.hasDistances?clamp(value.radiusKm,limits.radiusMin,limits.radiusMax,limits.radiusMax):null,minBudget:value.minBudget??null,maxBudget:value.maxBudget};
}

/** A map-picked point is a temporary filter reference, not a company profile edit. */
export function customReferenceOffice(point:Coordinates):OfficeOption|null{const valid=coordinates(point);return valid?{...valid,key:'custom-map-point',type:'Titik pilihan peta',wilayah:'',address:valid.lat.toFixed(6)+', '+valid.lng.toFixed(6)}:null;}
export function selectedReferenceOffice(offices:OfficeOption[],value:CommitmentFilters){return value.officeKey==='custom-map-point'&&coordinates(value.customOffice)?value.customOffice!:offices.find(o=>o.key===value.officeKey)||offices[0];}
