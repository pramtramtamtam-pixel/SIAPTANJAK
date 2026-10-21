export function numberDraft(value:string,decimal=true,maxDigits=15){
 const cleaned=value.replace(/[^\d,\-]/g,'');const negative=cleaned.startsWith('-');const parts=cleaned.replace(/-/g,'').split(',');
 const whole=parts[0].slice(0,maxDigits).replace(/^0+(?=\d)/,'');const fraction=decimal&&parts.length>1?parts.slice(1).join('').slice(0,6):null;
 const prefix=negative?'-':'';const integer=whole||((fraction!==null)?'0':'');
 return {display:prefix+integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(fraction!==null?','+fraction:''),raw:prefix+integer+(fraction!==null?'.'+fraction:'')};
}
export function numberDisplay(value:unknown){if(value===null||value===undefined||value==='')return '';const s=String(value);return numberDraft(s.replace('.',','),true).display;}
export function numberError(raw:string,min?:number|string,max?:number|string,step?:number|string){
 if(!raw||raw==='-')return raw==='-'?'Masukkan angka yang valid.':'';const n=Number(raw);if(!Number.isFinite(n))return 'Masukkan angka yang valid.';
 if(min!==undefined&&n<Number(min))return 'Nilai minimal '+numberDisplay(min)+'.';if(max!==undefined&&n>Number(max))return 'Nilai maksimal '+numberDisplay(max)+'.';
 if(step!==undefined&&step!=='any'){const ratio=(n-Number(min||0))/Number(step);if(Math.abs(ratio-Math.round(ratio))>1e-7)return 'Gunakan kelipatan '+numberDisplay(step)+'.';}return '';
}
