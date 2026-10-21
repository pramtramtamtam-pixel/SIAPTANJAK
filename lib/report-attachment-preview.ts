import {cloudDocumentUrl} from './cloud-document-links';
type Document={id:string;name?:string;mime?:string;external_url?:string|null};
export function attachmentDisplayName(document:Document,index:number,total:number){
 const name=String(document.name||'').trim();
 return !name||/^lampiran\s+laporan(?:\s+\d+)?$/i.test(name)?total>1?'Dokumen '+(index+1):'':name;
}
export function reportAttachmentPreview(document:Document):{src:string;kind:'frame'|'image'|'video'}|null{
 if(!document.external_url){
  const src='/api/report-documents/'+encodeURIComponent(document.id)+'?preview=1';
  return document.mime==='application/pdf'?{src,kind:'frame'}:document.mime==='image/jpeg'?{src,kind:'image'}:null;
 }
 let url:URL;try{url=new URL(cloudDocumentUrl(document.external_url));}catch{return null;}
 if(url.hostname==='drive.google.com'){
  const id=url.pathname.match(/^\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1]||(/^\/(?:open|uc)$/.test(url.pathname)?url.searchParams.get('id'):null);
  if(id&&/^[a-zA-Z0-9_-]+$/.test(id)){
   const preview=new URL('https://drive.google.com/file/d/'+id+'/preview');
   if(url.searchParams.has('resourcekey'))preview.searchParams.set('resourcekey',url.searchParams.get('resourcekey')!);
   return {src:preview.href,kind:'frame'};
  }
 }
 // Embed directly from the storage provider; never send private links to a viewer proxy.
 const ext=url.pathname.split('.').pop()?.toLowerCase();
 if(['jpg','jpeg','png','webp','gif'].includes(ext||''))return {src:url.href,kind:'image'};
 if(['mp4','webm'].includes(ext||''))return {src:url.href,kind:'video'};
 if(['doc','docx','xls','xlsx','ppt','pptx','zip','rar'].includes(ext||''))return null;
 return {src:url.href,kind:'frame'};
}
