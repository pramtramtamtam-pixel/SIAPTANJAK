export const WORKFLOW_VERSION=2;
export function wibInputDate(value:unknown){
 if(typeof value!=='string'||!value.trim())return '';
 const instant=Date.parse(value);
 return Number.isFinite(instant)?new Date(instant+7*3600000).toISOString().slice(0,16):'';
}
export const phases=['Tahap Perencanaan Kab/Kota','Tahap Pembahasan Forum PD dan Musrenbang TJSL Prov.','Pasca Musrenbang CSR Prov.'];
export const legacyPhases=['Pra Musrenbang Kab/Kota','Musrenbang Kab/Kota','Pra Musrenbang Provinsi','Musrenbang Provinsi'];
export const phaseOutputs=['Usulan TJSL Kab/Kota','Usulan TJSL Kab/Kota yang telah diverifikasi POKJA dan Usulan TJSL Provinsi yang difasilitasi dalam Musrenbang / akan dilaksanakan perusahaan','Laporan Kegiatan TJSL Provinsi Sumatera Selatan'];
export const phaseDescriptions=[
 'Waktu dibuka dan ditutup ditetapkan Administrator atau Bappeda Provinsi. Jadwal dapat disimpan tanpa menunggu tahap lain dibuka. Semua peran pengusul dapat menyampaikan usulan sesuai kewenangan.',
 'Waktu dibuka dan ditutup ditetapkan Administrator atau Bappeda Provinsi secara mandiri. Perangkat Daerah membahas usulan Kab/Kota serta mengajukan usulan Provinsi sesuai kewenangan.',
 'Checklist tidak dicentang: dibuka otomatis setelah Musrenbang TJSL Provinsi selesai. Checklist dicentang: tetap aktif secara manual untuk pelaporan perusahaan. Tidak ditutup otomatis pada akhir tahun perencanaan.'
];
export function parseWib(value:any){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Isi tanggal dan jam jadwal (WIB).');const date=new Date(value+':00+07:00');if(!Number.isFinite(date.getTime())||new Date(date.getTime()+7*3600000).toISOString().slice(0,16)!==value)throw new Error('Tanggal jadwal tidak valid.');return date.toISOString();}
export function deriveSchedules(value:any,year=2027,forcePost=false){
 const date=(key:string)=>value?.[key]?parseWib(value[key]):null;
 const kab=date('kabStart'),kabEnd=date('kabEnd'),forum=date('forumStart'),forumEnd=date('forumEnd'),prov=date('provinceStart'),provEnd=date('provinceEnd');
 const requested={kabStart:kab,kabEnd,forumStart:forum,forumEnd,provinceStart:prov,provinceEnd:provEnd};
 const schedules:any[]=[];
 if(kab&&(kabEnd||forum)){
  const cutoff=kabEnd||new Date(new Date(forum!).getTime()-3*86400000).toISOString();
  if(!(kab<cutoff))throw new Error('Penutupan Tahap Perencanaan Kab/Kota harus setelah waktu pembukaannya.');
  schedules.push({phase:0,opens:kab,closes:cutoff});
 }
 if(forum&&(forumEnd||provEnd||prov)){
  const end=forumEnd||provEnd||prov!;
  if(!(forum<end))throw new Error('Penutupan Forum PD dan Musrenbang TJSL Provinsi harus setelah waktu pembukaannya.');
  schedules.push({phase:1,opens:forum,closes:end});
 }
 if(provEnd&&prov&&!(prov<provEnd))throw new Error('Musrenbang TJSL Provinsi selesai harus setelah tanggal mulai.');
 if(provEnd||forcePost)schedules.push({phase:2,opens:provEnd||'1970-01-01T00:00:00.000Z',closes:'9999-12-31T23:59:59.999Z',continuous:true});

 return {events:requested,schedules};
}

export function effectivePlanningSchedules(rows:any[],events:any=null){
 return rows.map(row=>{
  if(row.phase===1&&!events?.forumEnd&&events?.provinceEnd)return {...row,closes:events.provinceEnd};
  if(row.phase!==2)return row;
  const manual=!!row.enabled,opens=events?events.provinceEnd:row.opens;
  return {...row,manualEnabled:manual,continuous:true,enabled:manual||!!opens?1:0,opens:manual?'1970-01-01T00:00:00.000Z':opens||row.opens,closes:'9999-12-31T23:59:59.999Z'};
 });
}
export function postReportingOpen(rows:any[],events:any=null,clock=Date.now()){
 return effectivePlanningSchedules(rows,events).some(s=>s.phase===2&&s.enabled&&Date.parse(s.opens)<=clock);
}

export const workflowStagePolicy:Record<string,number[]>={plan:[0,1,2],'verify-bappeda':[0,1],'verify-pokja':[1],commit:[1,2],decline:[1,2],report:[2],'cancel-execution':[2],'reopen-completion':[2]};
export function workflowActionGate(state:any,action:string){
 if(!state)return {enabled:false,reason:'Menunggu informasi jadwal tahapan.'};
 const post=['report','cancel-execution','reopen-completion'].includes(action);
 const allowed=workflowStagePolicy[action];
 const enabled=!!allowed&&(post?!!state.postReportingOpen:!!openScheduledStage(state.schedules||[state.active].filter(Boolean),allowed,Date.now()+Number(state.clockOffset||0)));
 return {enabled,reason:enabled?'':post?'Tahap Pasca Musrenbang belum dibuka untuk pelaporan.':'Tindakan ini ditutup pada tahapan saat ini.'};
}

export function openScheduledStage(schedules:any[],allowed:number[],clock=Date.now()){
 return schedules.find(s=>allowed.includes(s.phase)&&s.enabled&&Date.parse(s.opens)<=clock&&clock<Date.parse(s.closes))||null;
}
