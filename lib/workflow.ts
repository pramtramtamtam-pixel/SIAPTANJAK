export const readyStatuses=['Terverifikasi','Disetujui POKJA Provinsi'];
export const proposalStatuses=['Draft','Menunggu Verifikasi Bappeda Provinsi','Menunggu Pembahasan POKJA','Disetujui POKJA Provinsi','Dalam Pelaksanaan','Selesai','Ditolak Bappeda Provinsi','Ditolak POKJA Provinsi'];
export const documentCategories=['Proposal','DED','Gambar teknis','Sertifikat Lahan CnC','AMDAL','Berita acara Musrenbang','Notulen / berita acara POKJA','Data dukung lainnya'];
export const isBappeda=(u:any)=>['Administrator','Bappeda Provinsi'].includes(u?.role);
export const isPokja=(u:any,r:any)=>u?.role==='Administrator'||['POKJA Forum CSR','Perangkat Daerah'].includes(u?.role)&&u.bidang===r?.bidang;
export const canReviewBappeda=(u:any,r:any)=>u?.role==='Bappeda Provinsi'&&['Menunggu Verifikasi Bappeda Provinsi'].includes(r?.status);
export const canReviewPokja=(u:any,r:any)=>u?.role==='Perangkat Daerah'&&isPokja(u,r)&&r?.status==='Menunggu Pembahasan POKJA';
export const originOf=(r:any)=>r.origin||r.payload?.origin||'Kab/Kota';
export const canPropose=(u:any)=>['Administrator','Bappeda Kab/Kota','POKJA Forum CSR','Perangkat Daerah'].includes(u?.role);
export const isDeleted=(r:any)=>!!(typeof r?.payload==='string'?JSON.parse(r.payload||'{}'):r?.payload)?.deletedAt;
export const canDeleteProposal=(u:any,r:any)=>!!r&&!isDeleted(r)&&!r.company_id&&!['Dalam Pelaksanaan','Selesai','Ditolak POKJA Provinsi'].includes(r.status)&&(u?.role==='Administrator'||canPropose(u)&&r.owner_id===u?.id);
export const ownerEditableProposalStatuses=(u:any)=>u?.role==='Bappeda Kab/Kota'?['Draft','Menunggu Verifikasi Bappeda Provinsi','Ditolak Bappeda Provinsi']:['Draft','Ditolak Bappeda Provinsi'];
export const canEditProposal=(u:any,r:any)=>!!r&&!isDeleted(r)&&!r.company_id&&!['Dalam Pelaksanaan','Selesai','Dibatalkan','Ditolak POKJA Provinsi'].includes(r.status)&&(u?.role==='Administrator'||u?.role==='Perangkat Daerah'&&isPokja(u,r)||canPropose(u)&&r.owner_id===u?.id&&ownerEditableProposalStatuses(u).includes(r.status));
export const canReadProposal=(u:any,r:any)=>!!r&&!isDeleted(r)&&(isBappeda(u)||isPokja(u,r)||u?.role==='Bappeda Kab/Kota'&&r.wilayah===u.wilayah||(!['Bappeda Kab/Kota','Perangkat Daerah','POKJA Forum CSR'].includes(u?.role)&&r.owner_id===u?.id)||u?.role==='Perusahaan'&&readyStatuses.includes(r.status));
export function validGoalSelection(goals:any){return Array.isArray(goals)&&goals.length>0&&goals.every((g:any)=>/^([1-9]|1[0-7])$/.test(String(g)))&&new Set(goals.map(String)).size===goals.length;}
export function previewType(name:string){const ext=name.split('.').pop()?.toLowerCase();return ext==='pdf'?'pdf':['png','jpg','jpeg','gif','webp','bmp'].includes(ext||'')?'image':['mp4','webm','mov'].includes(ext||'')?'video':['txt','csv','log','json','md','xml','yaml','yml'].includes(ext||'')?'text':'download';}
