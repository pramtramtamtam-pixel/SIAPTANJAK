import {coordinates} from './commitment-filters';

type SearchPoint={lat:number;lng:number;address:string;extent?:number[]};
type Options={rows?:any[];endpoint?:string;hint?:string};
export function mapSearchMatches(rows:any[],query:string){
 const terms=query.trim().toLocaleLowerCase('id-ID').split(/\s+/).filter(Boolean);
 if(!terms.length)return [];
 return rows.filter(row=>coordinates(row.payload)&&terms.every(term=>[row.title,row.id,row.wilayah,row.bidang,row.company_name].filter(Boolean).join(' ').toLocaleLowerCase('id-ID').includes(term))).slice(0,8);
}
export function focusSearchPoint(map:any,value:SearchPoint){
 const point=coordinates(value);if(!point)throw Error('Koordinat lokasi tidak valid.');
 const box=value.extent;
 if(Array.isArray(box)&&box.length===4&&box.every(Number.isFinite)&&box[0]<box[2]&&box[1]<box[3]&&coordinates({lat:box[1],lng:box[0]})&&coordinates({lat:box[3],lng:box[2]}))map.fitBounds([[box[1],box[0]],[box[3],box[2]]],{padding:[30,30],maxZoom:15,animate:false});
 else map.setView([point.lat,point.lng],15,{animate:false});
 return point;
}

/** Search only on explicit user action. This control never changes a form's coordinates. */
export function addMapSearch(L:any,map:any,{rows=[],endpoint='/api/location/search',hint='Peta diarahkan ke lokasi terpilih.'}:Options={}){
 const control=L.control({position:'topright'});let request:AbortController|undefined,version=0,disposed=false,highlight:any;
 control.onAdd=()=>{
  const root=document.createElement('div');root.className='map-search-control noprint';root.setAttribute('data-dirty-ignore','');root.setAttribute('role','search');root.setAttribute('aria-label','Pencarian di peta');
  root.addEventListener('click',event=>event.stopPropagation());
  const bar=document.createElement('div');bar.className='map-search-bar';
  const input=document.createElement('input');input.type='search';input.placeholder=rows.length?'Cari lokasi atau kegiatan…':'Cari lokasi / alamat…';input.setAttribute('aria-label','Cari lokasi pada peta');input.maxLength=200;input.autocomplete='off';
  const search=document.createElement('button');search.type='button';search.textContent='Cari';
  const clear=document.createElement('button');clear.type='button';clear.textContent='×';clear.setAttribute('aria-label','Hapus pencarian peta');
  const results=document.createElement('div');results.className='map-search-results';results.hidden=true;results.setAttribute('aria-label','Hasil pencarian peta');
  const status=document.createElement('div');status.className='map-search-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const initial=map.getCenter(),zoom=map.getZoom();
  const stop=()=>{version++;request?.abort();search.disabled=false;};
  const show=(message:string)=>{results.replaceChildren(status);status.textContent=message;results.hidden=false;};
  const locate=(value:SearchPoint)=>{const point=focusSearchPoint(map,value);highlight?.remove();highlight=L.circleMarker([point.lat,point.lng],{radius:13,color:'#1d4ed8',fillOpacity:.12,weight:3,dashArray:'4 3',interactive:false}).addTo(map);show(value.address+' · '+hint);};
  const choice=(title:string,run:()=>void)=>{const button=document.createElement('button');button.type='button';button.textContent=title;button.addEventListener('click',run);results.appendChild(button);};
  async function address(q:string){
   stop();const current=version;request=new AbortController();search.disabled=true;show('Mencari lokasi…');
   try{const response=await fetch(endpoint+'?q='+encodeURIComponent(q),{signal:request.signal});const value:any=await response.json();if(!response.ok)throw Error(value.error||'Pencarian lokasi belum tersedia.');if(disposed||current!==version)return;if(!coordinates(value))throw Error('Koordinat lokasi tidak valid.');show('Pilih hasil untuk menuju lokasi:');choice(value.address||q,()=>locate({...value,address:value.address||q}));}
   catch(error:any){if(!disposed&&current===version&&error.name!=='AbortError')show(error.message||'Lokasi belum dapat dicari. Coba lagi.');}
   finally{if(!disposed&&current===version)search.disabled=false;}
  }
  const run=()=>{stop();const q=input.value.trim();if(q.length<3){show('Ketik minimal 3 karakter nama lokasi atau kegiatan.');return;}const matches=mapSearchMatches(rows,q);if(!matches.length){void address(q);return;}show(matches.length+' hasil kegiatan pada peta:');for(const row of matches){choice(row.title+' — '+(row.wilayah||''),()=>locate({...coordinates(row.payload)!,address:row.title}));}choice('Cari alamat “'+q+'”',()=>{void address(q);});};
  input.addEventListener('input',()=>{stop();results.hidden=true;});
  input.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();run();}else if(event.key==='Escape'){event.preventDefault();results.hidden=true;}});
  search.addEventListener('click',run);
  clear.addEventListener('click',()=>{stop();input.value='';results.hidden=true;highlight?.remove();highlight=null;map.setView(initial,zoom,{animate:false});input.focus();});
  bar.appendChild(input);bar.appendChild(search);bar.appendChild(clear);root.appendChild(bar);root.appendChild(results);L.DomEvent.disableClickPropagation(root);L.DomEvent.disableScrollPropagation(root);return root;
 };
 control.onRemove=()=>{disposed=true;version++;request?.abort();highlight?.remove();};control.addTo(map);return control;
}
