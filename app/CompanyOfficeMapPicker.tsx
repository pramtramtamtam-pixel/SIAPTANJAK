'use client';
import {addMapSearch} from '../lib/map-search';
import {useEffect,useRef,useState} from 'react';
import {Check,MapPin,X} from 'lucide-react';
import CompanyFilterDialog from './CompanyFilterDialog';
import {customReferenceOffice} from '../lib/commitment-filters';
import type {OfficeOption} from '../lib/commitment-filters';
export default function CompanyOfficeMapPicker({offices,selectedKey,customOffice,onChoose,onClose}:{offices:OfficeOption[];selectedKey:string;customOffice?:OfficeOption|null;onChoose:(office:OfficeOption)=>void;onClose:()=>void}){
 const [pending,setPending]=useState(selectedKey),[failed,setFailed]=useState(false);
 const [custom,setCustom]=useState(customOffice||null);
 const choices=custom?[...offices,custom]:offices;
 const canvas=useRef<HTMLDivElement>(null);
 const selected=choices.find(o=>o.key===pending);
 useEffect(()=>{let cancelled=false;let map:any;let detach:()=>void=()=>{};
  (async()=>{const L=await import('leaflet');if(cancelled||!canvas.current)return;
   map=L.map(canvas.current,{zoomAnimation:false}).setView([-3.25,104.15],7);
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(map);
   choices.forEach(office=>{const label=document.createElement('span');label.textContent=office.type+' — '+office.wilayah;
    L.circleMarker([office.lat,office.lng],{radius:office.key===pending?12:9,color:office.key===pending?'#d81e28':'#2563eb',fillOpacity:.85}).addTo(map!).bindTooltip(label,{permanent:true,direction:'top'}).on('click',()=>setPending(office.key));
   });
   if(choices.length)map.fitBounds(L.latLngBounds(choices.map(o=>[o.lat,o.lng] as [number,number])),{padding:[45,45],maxZoom:13});
   addMapSearch(L,map,{hint:'Tekan lama pada peta untuk memilih titik acuan.'});
   const element=canvas.current;let timer:ReturnType<typeof setTimeout>|undefined,start:{x:number;y:number}|undefined;
   const cancel=()=>{clearTimeout(timer);timer=undefined;start=undefined;};
   const down=(event:PointerEvent)=>{cancel();if(!event.isPrimary||event.button!==0||(event.target as HTMLElement).closest('.leaflet-control'))return;start={x:event.clientX,y:event.clientY};const point=map.mouseEventToLatLng(event);timer=setTimeout(()=>{const office=customReferenceOffice(point);if(office){setCustom(office);setPending(office.key);}cancel();},650);};
   const move=(event:PointerEvent)=>{if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)cancel();};
   const context=(event:Event)=>event.preventDefault();
   element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);element.addEventListener('contextmenu',context);window.addEventListener('pointerup',cancel);window.addEventListener('pointercancel',cancel);
   detach=()=>{cancel();element.removeEventListener('pointerdown',down);element.removeEventListener('pointermove',move);element.removeEventListener('contextmenu',context);window.removeEventListener('pointerup',cancel);window.removeEventListener('pointercancel',cancel);};
   requestAnimationFrame(()=>{if(!cancelled)map?.invalidateSize();});
  })().catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;detach();map?.remove();};
 },[offices,pending,custom]);
 return <CompanyFilterDialog className="company-office-map-dialog" labelledBy="company-office-map-title" onClose={onClose}><section className="company-office-map-content">
  <div className="company-filter-heading"><strong id="company-office-map-title">Pilih kantor acuan jarak</strong><button type="button" className="iconbutton" aria-label="Tutup peta kantor" onClick={onClose}><X size={18}/></button></div>
  <p>Pilih kantor terdaftar, atau tekan lama pada peta untuk membuat titik acuan baru.</p>
  <div ref={canvas} className="company-office-map" aria-label="Peta lokasi kantor acuan"/>
  {failed&&<p role="status">Peta belum dapat dimuat. Pilih kantor melalui daftar berikut.</p>}
  <div className="company-office-options">{choices.map(office=><button type="button" key={office.key} aria-pressed={pending===office.key} className={pending===office.key?'is-selected':''} onClick={()=>setPending(office.key)}><MapPin size={18}/><span><strong>{office.type} — {office.wilayah}</strong><small>{office.address}</small></span></button>)}</div>
  <div className="company-office-map-actions"><button type="button" className="primary" disabled={!selected} onClick={()=>selected&&onChoose(selected)}><Check size={16}/>Gunakan kantor ini</button></div>
 </section></CompanyFilterDialog>;
}
