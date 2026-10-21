import {env} from 'cloudflare:workers';
import {assert} from './server';
import {timelineRoles} from './access';
import {canPropose} from './workflow';
import {locationAddress} from './location-address';

const cache=new Map<string,{expires:number,value:any}>();
let lastLookup=0;
export async function reverseLocation(req:Request,u:any){
 assert(canPropose(u)||u?.role==='Perusahaan','Akun tidak memiliki akses pemilihan lokasi',403);
 const query=new URL(req.url).searchParams,lat=Number(query.get('lat')),lng=Number(query.get('lng'));
 assert(query.has('lat')&&query.has('lng')&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-5&&lat<=-1&&lng>=102&&lng<=107,'Pilih lokasi di Sumatera Selatan');
 const key=`address-v2:${lat.toFixed(5)},${lng.toFixed(5)}`,cached=cache.get(key);
 if(cached&&cached.expires>Date.now())return Response.json(cached.value);
 assert(Date.now()-lastLookup>=1000,'Tunggu sebentar sebelum memilih lokasi berikutnya.',429);lastLookup=Date.now();
 const headers={Accept:'application/json','Accept-Language':'id','User-Agent':'SIAP-TANJAK-Sumsel/1.0 (+https://siap-tanjak-sumsel.spicyvole2.chatgpt.site)'};
 const url=new URL('reverse',(env as any).GEOCODING_URL||'https://photon.komoot.io/');url.searchParams.set('lat',String(lat));url.searchParams.set('lon',String(lng));url.searchParams.set('limit','5');
 let address:ReturnType<typeof locationAddress>=null,sawOutside=false;
 try{const response=await fetch(url,{headers,signal:AbortSignal.timeout(10000)});if(response.ok){const data:any=await response.json();const candidates=(data.features||[]).map((f:any)=>locationAddress(f.properties,'photon')).filter(Boolean);address=candidates[0]||null;sawOutside=!!data.features?.length&&!address;}}catch{/* Try the alternate reverse service below. */}
 // Query once per explicit map selection, only when parent address metadata is missing.
 // The endpoint is configurable; cached answers never repeat external lookups.
 if(!address?.kecamatan||!address?.desa||!address?.wilayah){
  const fallback=new URL('reverse',(env as any).REVERSE_GEOCODING_URL||'https://nominatim.openstreetmap.org/');fallback.searchParams.set('lat',String(lat));fallback.searchParams.set('lon',String(lng));fallback.searchParams.set('format','geocodejson');fallback.searchParams.set('addressdetails','1');fallback.searchParams.set('layer','address');fallback.searchParams.set('zoom','18');
  try{const response=await fetch(fallback,{headers,signal:AbortSignal.timeout(12000)});if(response.ok){const data:any=await response.json(),raw=data.features?.[0]?.properties?.geocoding,alternate=locationAddress(raw,'nominatim');if(alternate&&(!address?.wilayah||!alternate.wilayah||address.wilayah===alternate.wilayah)){address={wilayah:address?.wilayah||alternate.wilayah,kecamatan:alternate.kecamatan||address?.kecamatan||'',desa:alternate.desa||address?.desa||'',source:'nominatim'};}else if(raw&&!alternate)sawOutside=true;}}catch{/* Keep any valid partial address and the exact selected coordinates. */}
 }
 assert(address,sawOutside?'Titik ini belum dikenali sebagai wilayah Sumatera Selatan. Pilih titik yang lebih tepat.':'Layanan alamat sedang tidak tersedia. Coba kembali atau lengkapi alamat.',sawOutside?422:502);
 const value={lat,lng,...address,address:[address.desa,address.kecamatan,address.wilayah,'Sumatera Selatan'].filter(Boolean).join(', ')};
 const ttl=address.kecamatan&&address.wilayah?86400:30;
 if(cache.size>=500)cache.delete(cache.keys().next().value!);cache.set(key,{expires:Date.now()+ttl*1000,value});
 return Response.json(value,{headers:{'Cache-Control':`private, max-age=${ttl}`}});
}
export async function searchLocation(req:Request,u:any){
 assert(timelineRoles.includes(u?.role),'Akun tidak memiliki akses pemilihan lokasi',403);
 const query=new URL(req.url).searchParams,q=(query.get('q')||'').trim();assert(q.length>=3&&q.length<=200,'Isi nama lokasi yang valid');
 const key='search:'+q.toLowerCase(),hit=cache.get(key);if(hit&&hit.expires>Date.now())return Response.json(hit.value);
 const url=new URL('api',(env as any).GEOCODING_URL||'https://photon.komoot.io/');url.searchParams.set('q',q);url.searchParams.set('countrycode','ID');url.searchParams.set('bbox','102,-5,107,-1');url.searchParams.set('limit','5');
 const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'SIAP-TANJAK-Sumsel/1.0'},signal:AbortSignal.timeout(20000)});assert(response.ok,'Pencarian alamat belum tersedia. Pilih titik pada peta.',502);
 const data:any=await response.json(),feature=data.features?.find((f:any)=>/sumatera selatan|south sumatra/i.test(f.properties?.state||''));assert(feature,'Lokasi belum ditemukan. Lengkapi nama atau pilih titik pada peta.',422);
 const p=feature.properties,[lng,lat]=feature.geometry.coordinates;assert(lat>=-5&&lat<=-1&&lng>=102&&lng<=107,'Lokasi harus di Sumatera Selatan');
 const value={lat,lng,extent:p.extent,address:[p.name,p.district,p.city,p.county,p.state].filter(Boolean).join(', ')};if(cache.size>=500)cache.delete(cache.keys().next().value!);cache.set(key,{expires:Date.now()+86400000,value});return Response.json(value);
}
