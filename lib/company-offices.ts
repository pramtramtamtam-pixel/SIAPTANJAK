import {assert,validText} from './server';
export function companyProfile(profile:any){
 const cleaned:any={nib:validText(profile.nib,'NIB',13),pic:validText(profile.pic,'Nama PIC',200),phone:validText(profile.phone,'Nomor telepon PIC',50)};
 assert(/^\d{13}$/.test(cleaned.nib),'NIB harus 13 digit');
 assert(Array.isArray(profile.offices)&&profile.offices.length>=1&&profile.offices.length<=10,'Isi minimal satu alamat kantor, maksimal 10');
 cleaned.offices=profile.offices.map((o:any)=>{assert(['Kantor pusat','Kantor operasional'].includes(o.type),'Jenis kantor tidak valid');assert(o.lat!==''&&o.lng!==''&&o.lat!=null&&o.lng!=null,'Pilih titik kantor pada peta');const lat=Number(o.lat),lng=Number(o.lng);assert(Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-11&&lat<=6&&lng>=95&&lng<=141,'Lokasi kantor harus berada di Indonesia');return {type:o.type,address:validText(o.address,'Alamat kantor',1000),provinsi:validText(o.provinsi,'Provinsi',200),wilayah:validText(o.wilayah,'Kabupaten / kota',200),kecamatan:String(o.kecamatan||'').slice(0,200),desa:String(o.desa||'').slice(0,200),lat,lng};});
 // Preserve compatibility for existing profile views and exports.
 for(const [type,key,suffix] of [['Kantor pusat','pusat','Pusat'],['Kantor operasional','operasional','Operasional']]){const office=cleaned.offices.find((o:any)=>o.type===type);if(office){cleaned[key]=office.address;cleaned['lat'+suffix]=office.lat;cleaned['lng'+suffix]=office.lng;}}
 return cleaned;
}
