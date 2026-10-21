import {unzipSync} from 'fflate';
export const MAX_SUPPORT_FILE_BYTES=25*1024*1024;
export function supportFileType(name:string,bytes:Uint8Array,mime='',category=''){
 const fail=(message:string):never=>{throw Object.assign(new Error(message),{status:400});};
 if(!bytes.length||bytes.length>MAX_SUPPORT_FILE_BYTES)fail('Berkas harus berukuran 1 byte sampai 25 MB.');
 if(/[\x00-\x1f\x7f:]/.test(name))fail('Nama berkas tidak valid.');
 const extension=name.split('.').pop()?.toLowerCase();
 if(extension==='docx'&&category==='Proposal'){
  const expected='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if(mime&&![expected,'application/octet-stream'].includes(mime))fail('Jenis berkas tidak sesuai proposal DOCX.');
  try{
   const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
   for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
   if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw Error();
   const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);if(!count||count>500||offset>=end)throw Error();
   let cursor=offset,total=0;const names=new Set<string>();
   for(let i=0;i<count;i++){
    if(cursor+46>end||view.getUint32(cursor,true)!==0x02014b50)throw Error();
    const flags=view.getUint16(cursor+8,true),size=view.getUint32(cursor+24,true),length=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true);
    const path=new TextDecoder().decode(bytes.slice(cursor+46,cursor+46+length));
    total+=size;if(flags&1||size>8*1024*1024||total>40*1024*1024||names.has(path)||path.includes('..')||path.startsWith('/')||/vbaproject|activex|embeddings/i.test(path))throw Error();
    names.add(path);cursor+=46+length+extra+comment;
   }
   if(cursor!==end||!names.has('[Content_Types].xml')||!names.has('word/document.xml'))throw Error();
   const files=unzipSync(bytes,{filter:f=>/\.xml$|\.rels$/.test(f.name)});
   if(!new TextDecoder().decode(files['word/document.xml']).includes('http://schemas.openxmlformats.org/wordprocessingml/2006/main'))throw Error();
   for(const [path,value] of Object.entries(files))if(/\.rels$/.test(path)&&/TargetMode\s*=\s*["']External["']/i.test(new TextDecoder().decode(value)))throw Error();
   if(/macroEnabled|vbaProject/i.test(new TextDecoder().decode(files['[Content_Types].xml'])))throw Error();
  }catch{fail('Proposal DOCX tidak valid atau mengandung makro, objek tertanam, atau tautan eksternal. Simpan sebagai DOCX biasa atau PDF.');}
  return {extension,mime:expected};
 }
 if(extension==='pdf'){
  const header=new TextDecoder().decode(bytes.slice(0,8)),tail=new TextDecoder().decode(bytes.slice(-1024));
  if(!header.startsWith('%PDF-')||!tail.includes('%%EOF'))fail('Isi berkas tidak sesuai format PDF.');
  if(mime&&!['application/pdf','application/octet-stream'].includes(mime))fail('Jenis berkas tidak sesuai PDF.');
  return {extension,mime:'application/pdf'};
 }
 if(extension==='jpg'||extension==='jpeg'){
  if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)fail('Isi berkas tidak sesuai format JPG.');
  if(mime&&!['image/jpeg','application/octet-stream'].includes(mime))fail('Jenis berkas tidak sesuai JPG.');
  return {extension,mime:'image/jpeg'};
 }
 return fail('Data dukung berupa PDF atau JPG/JPEG. DOCX hanya diperbolehkan untuk kategori Proposal.');
}
