import {assessmentCriteria,assessmentScore} from './assessment-criteria';
type Row={id:string;payload:any};
type Source={plan:number;actual:number;plans:Row[];reports:Row[]};
/** Suggestions use structured records only. Upload presence is not proof of validity. */
export function assessmentRecommendation(source:Source,documents:{id:string;report_id:string;category:string}[],year:number){
 const {plans,reports}=source,values:Record<string,{score:number;evidence:string}>={},reviewRequired:string[]=[];
 const refs=(rows:Row[])=>rows.map(r=>r.id).join(', ').slice(0,1600)||'belum ada';
 const percent=(n:number,total:number)=>total?Math.round(n/total*10000)/100:0;
 const set=(id:string,score:number,evidence:string,review=false)=>{values[id]={score:Math.min(100,Math.max(0,score)),evidence:'Rekomendasi otomatis tahun '+year+'. '+evidence};if(review)reviewRequired.push(id);};
 const missing='Belum tersedia bukti terstruktur yang dapat diverifikasi; rekomendasi awal0, perlu peninjauan evaluator.';
 set('p1',0,'RKA '+plans.length+'. Tenggat penyampaian resmi belum terhubung ke sistem. '+missing,true);
 const aligned=plans.filter(r=>Array.isArray(r.payload.sdgs)&&r.payload.sdgs.some((g:unknown)=>/^(?:[1-9]|1[0-7])$/.test(String(g))));
 set('p2',percent(aligned.length,plans.length),aligned.length+'/'+plans.length+' RKA mencantumkan SDGs valid. Kesesuaian substansi prioritas daerah perlu ditinjau. RKA: '+refs(plans),true);
 const quality=plans.length?plans.reduce((sum,r)=>sum+(Number(r.payload.target)>0?25:0)+(String(r.payload.indicator||r.payload.outcome||'').trim()?25:0)+(r.payload.rab&&typeof r.payload.rab==='object'&&Object.values(r.payload.rab).some(v=>Number(v)>0)?25:0),0)/plans.length:0;
 set('p3',quality,'Rerata unsur terisi pada RKA: target output25, indikator/outcome25, rincian RAB terstruktur25. Proposal/KAK memerlukan pemeriksaan dokumen (belum otomatis diberi25). RKA: '+refs(plans),true);
 set('p4',0,'Penetapan prioritas lokasi/Ring1 resmi belum terhubung. '+missing,true);
 set('i1',0,'Rekap anggaran RKA Rp'+source.plan+', realisasi kumulatif aktif Rp'+source.actual+'. Nilai dihitung otomatis dari realisasi/rencana, maksimal100; tanpa rencana nilainya0. Laporan: '+refs(reports));
 const physical=reports.map(r=>Number(r.payload.physical)).filter(v=>Number.isFinite(v)&&v>=0&&v<=100);
 set('i2',physical.length?physical.reduce((sum,n)=>sum+n,0)/physical.length:0,'Rerata capaian fisik yang dilaporkan pada '+physical.length+' laporan aktif terbaru. Satuan output berbeda tidak dijumlahkan. Data ini merupakan pernyataan perusahaan; verifikasi lapangan tetap diperlukan. Laporan: '+refs(reports),true);
 set('i3',0,'Catatan koordinasi tersedia pada '+reports.filter(r=>r.payload.coordination).length+' laporan. Pelaksanaan/hasil kolaborasi harus diperiksa evaluator sebelum diberi nilai.',true);
 set('i4',0,'Pernyataan K3/lingkungan tidak dianggap bukti kepatuhan terverifikasi. '+missing,true);
 set('r1',0,'Tenggat dan daftar kewajiban laporan resmi belum terhubung. Tanggal simulasi/teks isian tidak digunakan sebagai bukti ketepatan waktu. '+missing,true);
 const reportIds=new Set(reports.map(r=>r.id)),attachments=documents.filter(d=>reportIds.has(d.report_id));
 set('r2',0,attachments.length+' lampiran pada '+new Set(attachments.map(d=>d.report_id)).size+'/'+reports.length+' laporan. Keberadaan unggahan belum membuktikan keabsahan foto/GPS, BAST, penerima, RAB, dan transaksi. Periksa isi berkas sebelum memberi nilai. Lampiran: '+attachments.map(d=>d.id).join(', ').slice(0,1600),true);
 set('r3',0,reports.filter(r=>r.payload.outcome).length+' laporan memiliki uraian outcome. Dampak terukur, perubahan manfaat dan keberlanjutan perlu verifikasi bukti sebelum dinilai.',true);
 const finance={plan:source.plan,actual:source.actual},score=assessmentScore(values,finance),scenario=[...plans,...reports].some(r=>r.payload.demo||r.payload.scenario);
 return {values,finance,score,reviewRequired,scenario,notes:'Rekomendasi otomatis '+year+' dari '+plans.length+' RKA dan '+reports.length+' laporan aktif terbaru. '+(scenario?'Sumber memuat data simulasi. ':'')+'Indikator subjektif/bukti belum terverifikasi tetap perlu ditinjau evaluator. Belum menjadi penilaian final atau penetapan penghargaan.',criteriaCount:assessmentCriteria.length};
}
