'use client';
import {useEffect,useState} from 'react';
import CompanyOffices from './CompanyOffices';
export default function CompanyRegistration({initial}:any={}){
 const [nib,setNib]=useState(initial?.nib||''),[name,setName]=useState(initial?.name||''),[jenis,setJenis]=useState(initial?.jenis||'Swasta'),[result,setResult]=useState<any>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  setResult(null);setMessage('');setBusy(false);
  if(nib.length!==13||initial&&nib===initial.nib)return;
  const controller=new AbortController();let current=true;
  setBusy(true);
  const timer=setTimeout(async()=>{
   try{const response=await fetch('/api/oss?nib='+encodeURIComponent(nib),{signal:controller.signal});const data:any=await response.json();if(!response.ok)throw Error(data.error||'Data NIB belum dapat diperoleh.');if(!current)return;setResult(data);setName(data.data.companyName);setJenis(data.data.jenis);setMessage('Data perusahaan terisi dari OSS. Periksa dan lengkapi lokasi kantor pada peta.');}
   catch(e:any){if(current&&!controller.signal.aborted)setMessage(e.message);}
   finally{if(current)setBusy(false);}
  },500);
  return()=>{current=false;clearTimeout(timer);controller.abort();};
 },[nib]);
 return <><label className="field"><span>NIB perusahaan</span><input name="nib" inputMode="numeric" value={nib} onChange={e=>{setNib(e.target.value.replace(/\D/g,'').slice(0,13));if(result){setName('');setJenis('Swasta');}setResult(null);}} minLength={13} maxLength={13} pattern="[0-9]{13}" required/><small>13 digit angka. Pengecekan data OSS berjalan otomatis setelah NIB lengkap.</small></label>{(busy||message)&&<p className="nibstatus" role="status" aria-live="polite">{busy?'Memeriksa data NIB…':message}</p>}<input type="hidden" name="ossLookupId" value={result?.lookupId||''}/><input type="hidden" name="ossBusy" value={busy?'1':'0'}/><label className="field"><span>Nama perusahaan</span><input name="companyName" value={name} onChange={e=>setName(e.target.value)} readOnly={!!result} required/></label><label className="field"><span>Jenis perusahaan</span><select name="jenis" value={jenis} onChange={e=>setJenis(e.target.value)}><option>Swasta</option><option>BUMN</option><option>BUMD</option></select></label>{initial?.logoId&&<img src={'/api/company-logos/'+initial.logoId} alt="Logo perusahaan saat ini" style={{maxWidth:180,maxHeight:80,objectFit:'contain'}}/>}<label className="field"><span>Logo Perusahaan (opsional)</span><input type="file" name="logo" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file&&file.size>2*1024*1024){e.target.value='';setMessage('Logo maksimal 2 MB.');}}}/><small>PNG, JPG atau WebP, maksimal 2 MB. Logo ditampilkan setelah perusahaan disetujui.</small></label><CompanyOffices key={result?.lookupId||'manual'} initial={result?.data||initial?.offices}/><div className="formgrid"><label className="field"><span>Nama PIC</span><input name="pic" defaultValue={initial?.pic||''} required/></label><label className="field"><span>Nomor telepon PIC</span><input name="phone" type="tel" defaultValue={initial?.phone||''} required/></label></div></>;
}

