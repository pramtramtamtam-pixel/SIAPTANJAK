export function paginationRequest(params:URLSearchParams,defaultLimit=25){
 const parse=(key:string,fallback:number,max:number)=>{const raw=params.get(key);if(raw===null)return fallback;if(!/^\d+$/.test(raw))throw Object.assign(Error('Parameter '+key+' harus bilangan bulat positif'),{status:400});const n=Number(raw);if(!Number.isSafeInteger(n)||n<1||n>max)throw Object.assign(Error('Parameter '+key+' di luar batas'),{status:400});return n;};
 const page=parse('page',1,1000000),limit=parse('limit',defaultLimit,100);return {page,limit,offset:(page-1)*limit};
}
export function paginationResult(page:number,limit:number,total:number){const pages=Math.max(1,Math.ceil(total/limit)),actualPage=Math.min(page,pages);return {page:actualPage,limit,total,pages,offset:(actualPage-1)*limit};}
