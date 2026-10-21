'use client';
import {useEffect,useMemo,useState} from 'react';
import MapDashboard from './MapDashboard';
import {Search} from 'lucide-react';
import StatusFilter from './StatusFilter';
import {bidang,wilayah} from '../lib/data';
import {reportYears,calendarYearWIB} from '../lib/report-options';
import {monitoringMapData,mapLocationKinds,mapLocationColors} from '../lib/monitoring-map';

export default function MonitoringMap({session,year,refresh,MapComponent,onSelect,onPrintSnapshot}:any){
 const [activityYear,setActivityYear]=useState(String(Number(year)||calendarYearWIB())),[kinds,setKinds]=useState<string[]>([]),[query,setQuery]=useState(''),[chosenRegion,setRegion]=useState(''),[chosenTheme,setTheme]=useState(''),[loaded,setLoaded]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const region=session?.role==='Bappeda Kab/Kota'?session.wilayah:chosenRegion;
 const theme=session?.role==='Perangkat Daerah'?session.bidang:chosenTheme;
 useEffect(()=>{setActivityYear(String(Math.min(Number(year)||2026,calendarYearWIB())));setLoaded(null);},[year,session?.id]);
 useEffect(()=>{if(!session)return;let active=true;setBusy(true);setLoaded(null);setError('');fetch('/api/monitoring?map=1&year='+activityYear).then(async response=>{const data:any=await response.json();if(!response.ok)throw Error(data.error||'Peta belum dapat dimuat');return data;}).then(data=>{if(active)setLoaded(data);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[activityYear,session?.id,refresh]);
 const rows=useMemo(()=>monitoringMapData(session?loaded?.proposals||[]:refresh.usulan||[],session?loaded?.records||[]:refresh.records||[],{year:activityYear,kinds,query,wilayah:region,bidang:theme}),[session,loaded,refresh,activityYear,kinds,query,region,theme]);
 const snapshot=JSON.stringify({scope:'peta',year:activityYear,mapRows:rows,records:[],proposals:[],filters:[['Tahun',activityYear],['Jenis lokasi',kinds.join(', ')||'Semua jenis lokasi'],['Kabupaten/kota',region||'Semua kab/kota'],['POKJA',theme||'Semua POKJA'],['Pencarian',query||'Semua kegiatan']]});
 useEffect(()=>{onPrintSnapshot?.(busy?null:JSON.parse(snapshot));},[snapshot,busy]);
 return <section className="monitor-map" aria-label="Filter dan peta kegiatan TJSL">
  <div className="map-filter-panel">
   <div className="map-filter-heading"><strong>Lokasi kegiatan TJSL</strong><span>Pilih satu atau beberapa kategori lokasi.</span></div>
   <div className="map-filter-grid">
    <label>Tahun<select aria-label="Tahun peta" value={activityYear} onChange={e=>setActivityYear(e.target.value)}>{reportYears(Number(year)||2027).map(y=><option key={y}>{y}</option>)}</select></label>
    <div className="map-category-field"><span>Jenis lokasi</span><StatusFilter options={mapLocationKinds} colors={mapLocationColors} value={kinds} onChange={setKinds} label="Semua jenis lokasi" id="map-location-options"/></div>
    <label>Kabupaten/kota<select aria-label="Kabupaten/kota peta" value={region} onChange={e=>setRegion(e.target.value)}><option value="" disabled={session?.role==='Bappeda Kab/Kota'}>Semua kab/kota</option>{wilayah.map(v=><option key={v} disabled={session?.role==='Bappeda Kab/Kota'&&v!==session.wilayah}>{v}</option>)}</select></label>
    <label>POKJA<select aria-label="POKJA peta" value={theme} onChange={e=>setTheme(e.target.value)}><option value="" disabled={session?.role==='Perangkat Daerah'}>Semua bidang</option>{bidang.map(v=><option key={v} disabled={session?.role==='Perangkat Daerah'&&v!==session.bidang}>{v}</option>)}</select></label>
   </div>
   <div className="search"><Search size={17}/><input aria-label="Cari lokasi kegiatan" placeholder="Cari judul, ID, atau lokasi…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
   <div className="map-color-legend">{mapLocationKinds.map(kind=><span key={kind}><i style={{background:mapLocationColors[kind]}}/>{kind}</span>)}</div>
  </div>
  {error&&<p className="formerror" role="alert">{error}</p>}{busy&&<p role="status">Memuat lokasi kegiatan…</p>}
  <MapDashboard rows={rows} kinds={kinds} onKinds={setKinds} theme={theme} onTheme={setTheme} region={region} onRegion={setRegion}/><div className="panel mapwrap"><MapComponent rows={rows} onSelect={onSelect}/><div className="maplegend">{rows.length} titik · Tahun {activityYear} · Sesuai kewenangan akun · Klik titik untuk detail</div></div>
  {!busy&&!error&&!rows.length&&<p className="map-empty">Belum ada titik dengan koordinat pada tahun dan kategori yang dipilih.</p>}
 </section>;
}

