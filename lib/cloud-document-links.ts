export function cloudDocumentUrl(value:unknown){
 const fail=()=>{throw Object.assign(Error('Masukkan tautan HTTPS Google Drive atau penyimpanan cloud yang valid.'),{status:400});};
 if(typeof value!=='string'||!value.trim()||value.length>3000||/[\x00-\x20\x7f]/.test(value.trim()))return fail();
 let url:URL;try{url=new URL(value.trim());}catch{return fail();}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||!host.includes('.')||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.invalid')||host.includes(':')||/^\d+(\.\d+){3}$/.test(host)||/^\[/.test(host)||url.port&&url.port!=='443')return fail();
 return url.href;
}
export function cloudDocumentUrls(value:string){const list=value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);if(list.length>20)throw Error('Maksimal 20 tautan sekali simpan.');return [...new Set(list.map(cloudDocumentUrl))];}
