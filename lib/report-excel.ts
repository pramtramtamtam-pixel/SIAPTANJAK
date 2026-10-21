import {reportOutput} from './report-options';
export function reportExcelData(rows:any[],documents:any[],ownerId:string,year:number,filters:any[],origin=''){
 const reports=rows.filter(r=>r.owner_id===ownerId&&Number(r.payload?.year)===Number(year));
 const ids=new Set(reports.map(r=>r.id));
 const number=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
 const details=reports.map((r,i)=>{const p=r.payload||{};return {'No.':i+1,'ID laporan':r.id,'Judul kegiatan':r.title,'Perusahaan':r.company_name||r.owner_name||'','Sumber kegiatan TJSL':r.usulan_id?'Tindak Lanjut Usulan':'Laporan Mandiri Perusahaan','ID usulan':r.usulan_id||'','Tahun':number(p.year),'Periode':p.period||'','POKJA':p.bidang||'','Kab/Kota':p.wilayahs?.join(', ')||p.wilayah||'','Kecamatan':p.kecamatan||'','Desa/Kelurahan':p.desa||'','Realisasi mulai':p.actualStart||'','Realisasi sampai':p.actualEnd||'','Realisasi pendanaan (Rp)':number(p.amount),'Realisasi fisik (%)':number(p.physical),'Output':reportOutput(p),'Jumlah penerima manfaat (Orang)':number(p.beneficiaries),'Kendala':p.obstacles||'','Hasil / outcome':p.outcome||'','Status pelaksanaan':r.displayStatus||'','Arsip':p.deletedAt||p.completionRevokedAt||p.cancelledAt||p.replacedBy?'Ya':'Tidak'};});
 const attachments=documents.filter(d=>ids.has(d.report_id)).map((d,i)=>({'No.':i+1,'ID laporan':d.report_id,'Nama lampiran':d.name,'Keterangan':d.description||'','Tautan':d.external_url||origin+'/api/report-documents/'+encodeURIComponent(d.id)}));
 return {metadata:[['Laporan','Laporan Realisasi Kegiatan TJSL'],['Tahun',String(year)],['Jumlah laporan',String(reports.length)],...filters,['Keterangan','Realisasi bersifat kumulatif per kegiatan. Jangan menjumlahkan laporan lama dan terbaru untuk kegiatan yang sama.']],details,attachments};
}
