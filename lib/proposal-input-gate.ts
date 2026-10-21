import {openScheduledStage} from './planning-phases';
export function proposalInputGate(role:string,planning:any,year:any,demo=false,clock=Date.now()){
 if(demo)return {enabled:false,reason:'Pratinjau hanya untuk melihat data. Masuk dengan akun aktif untuk mengusulkan.'};
 if(!planning||Number(planning.year)!==Number(year))return {enabled:false,reason:'Jadwal penginputan belum dibuka atau sedang diperiksa.'};
 const allowed=role==='Administrator'?[0,1,2]:role==='Bappeda Kab/Kota'?[0]:role==='Perangkat Daerah'?[0,1]:[];
 const serverClock=clock+Number(planning.clockOffset||0),active=openScheduledStage(planning.schedules||[planning.active].filter(Boolean),allowed,serverClock);
 if(!active||!active.enabled||!Number.isFinite(Date.parse(active.opens))||!Number.isFinite(Date.parse(active.closes))||serverClock<Date.parse(active.opens)||serverClock>=Date.parse(active.closes))return {enabled:false,reason:'Penginputan usulan ditutup. Menunggu jadwal dibuka Bappeda Provinsi.'};

 if(!allowed.length)return {enabled:false,reason:'Peran ini tidak memiliki kewenangan menambah usulan.'};
 if(!allowed.includes(active.phase))return {enabled:false,reason:role==='Bappeda Kab/Kota'&&active.phase===1?'Penginputan Bappeda Kab/Kota ditutup pada Tahap Pembahasan Forum PD dan Musrenbang TJSL Prov.':active.phase===2&&role!=='Administrator'?'Penginputan usulan ditutup setelah Musrenbang TJSL Provinsi.':`Penginputan usulan untuk peran ini tidak dibuka pada ${['Tahap Perencanaan Kab/Kota','Tahap Pembahasan Forum PD dan Musrenbang TJSL Prov.','Pasca Musrenbang CSR Prov.'][active.phase]}.`};
 return {enabled:true,reason:''};
}
