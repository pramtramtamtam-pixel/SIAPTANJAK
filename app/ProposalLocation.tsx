'use client';
import {addMapSearch} from '../lib/map-search';
import {useEffect,useRef,useState} from 'react';
import {MapPin} from 'lucide-react';

export default function ProposalLocation({initial={},wilayah,regions=[],onRegion,title="Titik lokasi usulan"}:any){
 const [open,setOpen]=useState(false),[location,setLocation]=useState({lat:initial.lat||'',lng:initial.lng||'',kecamatan:initial.kecamatan||'',desa:initial.desa||''}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const mapRef=useRef<any>(null),markerRef=useRef<any>(null),skipRegion=useRef(false),previousRegion=useRef(wilayah),pendingPoint=useRef<any>(null);
 const container=useRef<HTMLDivElement>(null),handler=useRef<(lat:number,lng:number)=>void>(()=>{}),request=useRef<AbortController|null>(null),generation=useRef(0);
 handler.current=async(lat,lng)=>{
  const version=++generation.current;request.current?.abort();
  if(lat< -5||lat> -1||lng<102||lng>107){setBusy(false);setMessage('Pilih titik di Sumatera Selatan.');return;}
  const point={lat:Number(lat.toFixed(6)),lng:Number(lng.toFixed(6))};
  setLocation({...point,kecamatan:'',desa:''});setBusy(true);setMessage('Mengambil alamat lokasi…');
  const controller=new AbortController();request.current=controller;
  try{const response=await fetch(`/api/location?lat=${point.lat}&lng=${point.lng}`,{signal:controller.signal,cache:'no-store'});const value:any=await response.json();if(!response.ok)throw new Error(value.error||'Alamat belum tersedia');if(version!==generation.current)return;
   setLocation({...point,kecamatan:value.kecamatan||'',desa:value.desa||''});
   const normalize=(name:string)=>name.toLowerCase().replace(/kabupaten|kota|regency|city/g,'').trim();const match=regions.find((name:string)=>normalize(name)===normalize(value.wilayah||''));if(match&&match!==wilayah){skipRegion.current=true;onRegion?.(match);}
   setMessage(value.address+(value.kecamatan&&value.desa?'':' · Lengkapi nama kecamatan atau desa / kelurahan yang belum tersedia.')+(!match&&value.wilayah&&!value.wilayah.toLowerCase().includes(wilayah?.toLowerCase()||'')?' · Sesuaikan Lokasi Usulan dengan kabupaten / kota titik ini.':''));
  }catch(e:any){if(version===generation.current&&e.name!=='AbortError')setMessage(e.message+'. Koordinat sudah terisi; alamat dapat dilengkapi.');}finally{if(version===generation.current)setBusy(false);}
 };
 useEffect(()=>{if(!open)return;let map:any,cancelled=false;async function start(){const L:any=await import('leaflet');if(cancelled||!container.current)return;
  const center=[Number(location.lat)||-2.976,Number(location.lng)||104.775];map=L.map(container.current).setView(center,location.lat?14:9);mapRef.current=map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',maxZoom:18}).addTo(map);
  const marker=L.circleMarker(center,{radius:10,color:'#fff',weight:3,fillColor:'#d81e28',fillOpacity:1}).addTo(map);
  markerRef.current=marker;if(pendingPoint.current){const point=pendingPoint.current;map.setView([point.lat,point.lng],point.zoom);marker.setLatLng([point.lat,point.lng]);pendingPoint.current=null;}
  addMapSearch(L,map,{hint:'Klik titik pada peta untuk mengisi lokasi.'});
  map.on('click',(e:any)=>{marker.setLatLng(e.latlng);handler.current(e.latlng.lat,e.latlng.lng);});
 }start().catch(()=>setMessage('Peta belum dapat dimuat. Coba buka kembali.'));return()=>{cancelled=true;map?.remove();mapRef.current=null;markerRef.current=null;};},[open]);
 useEffect(()=>()=>{generation.current++;request.current?.abort();},[]);
 async function locate(level:'wilayah'|'kecamatan'|'desa'){
  setOpen(true);const version=++generation.current;request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);
  const q=[level==='desa'?location.desa:'',level!=='wilayah'?location.kecamatan:'',wilayah,'Sumatera Selatan'].filter(Boolean).join(', ');
  try{const response=await fetch('/api/location/search?q='+encodeURIComponent(q),{signal:controller.signal});const value:any=await response.json();if(!response.ok)throw new Error(value.error);if(version!==generation.current)return;const zoom=level==='desa'?15:level==='kecamatan'?12:10;pendingPoint.current={...value,zoom};if(mapRef.current){mapRef.current.flyTo([value.lat,value.lng],zoom);markerRef.current?.setLatLng([value.lat,value.lng]);pendingPoint.current=null;}setLocation(current=>({...current,lat:Number(value.lat.toFixed(6)),lng:Number(value.lng.toFixed(6))}));setMessage(value.address+' · Pilih titik tepat usulan pada peta.');}
  catch(e:any){if(e.name!=='AbortError'&&version===generation.current)setMessage(e.message);}finally{if(version===generation.current)setBusy(false);}
 }
 useEffect(()=>{if(previousRegion.current===wilayah)return;previousRegion.current=wilayah;if(skipRegion.current){skipRegion.current=false;return;}setLocation(current=>({...current,kecamatan:'',desa:''}));locate('wilayah');},[wilayah]);
 return <section className="proposal-location"><div className="sectionhead"><strong>{title}</strong><button className="secondary" type="button" onClick={()=>setOpen(!open)}><MapPin size={16}/>{open?'Tutup peta':'Pilih lokasi di peta'}</button></div>
 <div className="formgrid">{[['kecamatan','Kecamatan'],['desa','Desa / kelurahan'],['lat','Latitude'],['lng','Longitude']].map(([key,label])=><label className="field" key={key}><span>{label}</span><input name={key} value={(location as any)[key]} onFocus={()=>setOpen(true)} onChange={e=>setLocation({...location,[key]:e.target.value})} onBlur={()=>{if((key==='kecamatan'||key==='desa')&&(location as any)[key])locate(key);}} readOnly={key==='lat'||key==='lng'} required={key==='lat'||key==='lng'} placeholder={key==='lat'||key==='lng'?'Pilih titik pada peta':'Pilih lokasi atau lengkapi nama'}/></label>)}</div>
 {open&&<><p className="muted">Klik satu titik di peta. Koordinat dan alamat lokasi akan terisi otomatis. Nama alamat dapat diperbaiki bila perlu.</p><div ref={container} className="proposal-map" aria-label={title==='Titik lokasi kegiatan'?'Peta pemilihan lokasi kegiatan':'Peta pemilihan lokasi usulan'}/><small className="muted">Alamat: OpenStreetMap (Photon / Nominatim).</small></>}
 <button type="button" className="textbutton" disabled={busy} onClick={()=>locate(location.desa?'desa':location.kecamatan?'kecamatan':'wilayah')}>Cari alamat dan perbesar peta</button><p className="location-message" role="status" aria-live="polite">{busy?'Mengambil alamat lokasi…':message}</p><input type="hidden" data-dirty-ignore name="locationBusy" value={busy?'1':'0'}/>
 </section>;
}


