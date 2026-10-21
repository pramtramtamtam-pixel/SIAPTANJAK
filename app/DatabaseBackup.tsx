'use client';
import {useState} from 'react';
import {Download,Database} from 'lucide-react';
export default function DatabaseBackup(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 async function download(){setBusy(true);setError('');setDone(false);try{const response=await fetch('/api/backup?format=sqlite');if(!response.ok){const data:any=await response.json();throw Error(data.error||'Backup belum dapat dibuat');}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||'SIAP-TANJAK-Database.zip';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);setDone(true);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <section className="panel database-backup"><div><h3><Database size={18}/>Backup seluruh database</h3><p>Unduh salinan database semua tahun ke komputer Administrator. ZIP berisi database SQLite, informasi backup, dan petunjuk pemulihan. Foto dan berkas unggahan disimpan terpisah di server.</p>{error&&<p className="formerror" role="alert">{error}</p>}{done&&<p role="status">Backup siap. Unduhan dikirim ke browser; periksa folder Unduhan komputer Anda.</p>}</div><button className="secondary" disabled={busy} onClick={download}><Download size={16}/>{busy?'Menyiapkan backup…':'Unduh backup database'}</button></section>;
}
