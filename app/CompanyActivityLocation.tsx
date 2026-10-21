'use client';
import {addMapSearch} from '../lib/map-search';
import {useEffect,useRef,useState} from 'react';
import {MapPin,X} from 'lucide-react';
import CompanyFilterDialog from './CompanyFilterDialog';
import CompanyOfficeMapPicker from './CompanyOfficeMapPicker';
import {coordinates,proposalDistance} from '../lib/commitment-filters';
import type {OfficeOption,ProposalLocation} from '../lib/commitment-filters';
type Activity=ProposalLocation&{title:string;wilayah:string};
function ComparisonMap({activity,office}:{activity:Activity;office:OfficeOption|undefined}){
 const canvas=useRef<HTMLDivElement>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let cancelled=false;let map:any;
  (async()=>{const L=await import('leaflet');if(cancelled||!canvas.current)return;
   map=L.map(canvas.current,{zoomAnimation:false}).setView([-3.25,104.15],7);
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(map);
   const point=coordinates(activity.payload),points:[number,number][]=[];
   const add=(lat:number,lng:number,label:string,color:string,radius:number)=>{points.push([lat,lng]);const tooltip=document.createElement('span');tooltip.textContent=label;L.circleMarker([lat,lng],{radius,color,fillColor:color,fillOpacity:.85,weight:3}).addTo(map).bindTooltip(tooltip,{permanent:true,direction:'top'});};
   if(office)add(office.lat,office.lng,'Acuan: '+office.type,'#d81e28',12);
   if(point)add(point.lat,point.lng,'Kegiatan: '+activity.title,'#2563eb',8);
   if(office&&point)L.polyline([[office.lat,office.lng],[point.lat,point.lng]],{color:'#64748b',weight:2,dashArray:'7 7'}).addTo(map);
   if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[55,55],maxZoom:14});
   addMapSearch(L,map,{rows:[activity]});
   requestAnimationFrame(()=>{if(!cancelled)map?.invalidateSize();});
  })().catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;map?.remove();};
 },[activity,office]);
 return <>{failed&&<p role="status">Peta belum dapat dimuat. Informasi lokasi dan jarak tersedia di bawah.</p>}<div ref={canvas} className="company-office-map" aria-label="Peta perbandingan lokasi kegiatan dan kantor acuan"/></>;
}
export default function CompanyActivityLocation({activity,office,onChooseReference}:{activity:Activity;office:OfficeOption|undefined;onChooseReference?:(office:OfficeOption)=>void}){
 const [showReferencePicker,setShowReferencePicker]=useState(false);
 const [open,setOpen]=useState(false),distance=proposalDistance(activity,office),point=coordinates(activity.payload);
 const km=distance===null?null:distance.toLocaleString('id-ID',{maximumFractionDigits:1})+' km';
 return <><button type="button" className="activity-location-link" aria-haspopup="dialog" aria-label={'Lihat peta lokasi '+activity.title} onClick={()=>setOpen(true)}><MapPin size={14}/>{activity.wilayah}</button><small>Sumatera Selatan</small><small>{km&&office?km+' dari '+office.type.toLowerCase():!point?'Koordinat kegiatan belum tersedia':'Kantor acuan belum dipilih'}</small>
 {open&&<CompanyFilterDialog className="company-office-map-dialog" labelledBy="activity-comparison-title" onClose={()=>setOpen(false)}><section className="company-office-map-content"><div className="company-filter-heading"><strong id="activity-comparison-title">Perbandingan lokasi kegiatan dan kantor</strong><button type="button" className="iconbutton" aria-label="Tutup peta perbandingan" onClick={()=>setOpen(false)}><X size={18}/></button></div><p>{activity.title}</p>{onChooseReference&&<button type="button" className="secondary" onClick={()=>setShowReferencePicker(true)}><MapPin size={16}/>Pilih titik acuan di peta</button>}<ComparisonMap activity={activity} office={office}/><div className="activity-location-details"><p><span className="location-dot activity"/><strong>Lokasi kegiatan:</strong> {activity.wilayah}<small>{point?point.lat.toFixed(6)+', '+point.lng.toFixed(6):'Koordinat kegiatan belum tersedia.'}</small></p><p><span className="location-dot office"/><strong>Acuan:</strong> {office?.type||'Belum dipilih'}<small>{office?.address||'Pilih titik acuan di peta untuk membandingkan lokasi.'}</small></p><p><strong>Jarak garis lurus:</strong> {km||'Belum dapat dihitung'}</p></div></section></CompanyFilterDialog>}
 {showReferencePicker&&onChooseReference&&<CompanyOfficeMapPicker offices={[]} selectedKey={office?.key||''} customOffice={office} onChoose={chosen=>{onChooseReference(chosen);setShowReferencePicker(false);}} onClose={()=>setShowReferencePicker(false)}/>}
 </>;
}
