import {wilayah as regions} from './data';
const normalize=(name:string)=>String(name||'').toLowerCase().replace(/kabupaten|kota|regency|city|kab\./g,'').replace(/\s+/g,' ').trim();
export const regionName=(name:string)=>regions.find(r=>normalize(r)===normalize(name))||'';
const cleanDistrict=(name:string)=>String(name||'').replace(/^kecamatan\s+/i,'').trim();
const cleanVillage=(name:string)=>String(name||'').replace(/^RW\s*\d+\s*(?:Kel\.?|Kelurahan)\s*/i,'').replace(/^(desa|kelurahan)\s+/i,'').trim();
export function locationAddress(p:any,source:'photon'|'nominatim'){
 if(!p)return null;
 const municipality=[p.city,p.county,p.state_district,p.admin?.level5,p.admin?.level6].map(regionName).find(Boolean)||'';
 const country=String(p.countrycode||p.country_code||'').toUpperCase();
 // A missing province label is not evidence that a known Sumsel city lies elsewhere.
 const state=String(p.state||p.admin?.level4||'');
 if(country!=='ID'||(state?!/sumatera selatan|south sumatra/i.test(state):!municipality))return null;
 let district=cleanDistrict(p.district||p.city_district||p.subdistrict||p.admin?.level7||'');
 if(!district&&p.admin?.level6&&!regionName(p.admin.level6))district=cleanDistrict(p.admin.level6);
 let village=source==='photon'&&['village','hamlet','suburb','quarter'].includes(p.osm_value)?p.name:p.locality||p.village||p.suburb||p.admin?.level8||p.admin?.level9||'';
 if(!village&&Number(p.extra?.admin_level)>=8&&!regionName(p.city))village=p.city||'';
 village=cleanVillage(village);
 // A pure neighbourhood/RW number alone is not a reliable village name.
 if(/^RW\s*\d+$/i.test(village))village='';
 return {wilayah:municipality,kecamatan:district,desa:village,source};
}
