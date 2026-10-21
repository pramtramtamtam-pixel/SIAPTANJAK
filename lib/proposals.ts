import {validateAlignment} from './alignment';
import {isIsoDate} from './date-policy';
import {reopenCompletion} from './reports';
import {auditIp} from './request-security';
import {requireProposalYear,requireReadableProposalYear,requireYear,requireOpen,requireProposalOpen,activePhase,requireWorkflowAction,currentRevisionStatement} from './planning';
import {all,one,db,uid,now,assert,validText,audit,notify} from './server';
import {isBappeda,isPokja,canPropose,readyStatuses,validGoalSelection,canDeleteProposal,isDeleted,ownerEditableProposalStatuses} from './workflow';

export async function handleProposal(u:any,id:string|undefined,b:any){
 assert(b.action!=='decline','Perusahaan tidak memiliki tindakan penolakan usulan. Pilih komitmen pada kegiatan yang akan didukung.',403);
 assert(b.action===undefined||['verify','commit','delete','cancel-execution','reopen-completion'].includes(b.action),'Tindakan usulan tidak valid',400);
 if(b.action==='verify')assert(u.role!=='Administrator','Administrator tidak memiliki kewenangan verifikasi usulan.',403);
 if(b.action==='verify'&&b.stage==='Bappeda')assert(u.role==='Bappeda Provinsi','Verifikasi Bappeda dan penetapan POKJA hanya dapat dilakukan Bappeda Provinsi.',403);
 const old=id?await one('SELECT * FROM usulan WHERE id=?',id):null;
 if(id){assert(old&&!isDeleted(old),'Usulan tidak ditemukan',404);await ((b.action==='reopen-completion'||u.role==='Perusahaan'&&['commit','cancel-execution'].includes(b.action))?requireReadableProposalYear:requireProposalYear)(u,old.year);}else await requireProposalYear(u,b.year);
 const originForWindow=old?.origin||(u.role==='Bappeda Kab/Kota'?'Kab/Kota':'Provinsi');
 const phase=b.action==='delete'?await requireProposalOpen(u,originForWindow):b.action?await requireWorkflowAction(u,b.action==='verify'?(b.stage==='Bappeda'?'verify-bappeda':'verify-pokja'):b.action):await requireProposalOpen(u,originForWindow);
 const snapshotStatement=(proposalId:string)=>currentRevisionStatement(u,proposalId,phase,b.action||b.status||'Simpan');
 const respond=(value:any)=>Response.json(value,{headers:{'Cache-Control':'no-store'}});
 if(b.action==='reopen-completion'){const report=await one("SELECT id FROM records WHERE usulan_id=? AND type='laporan' AND status='Selesai' AND json_extract(payload,'$.deletedAt') IS NULL AND json_extract(payload,'$.completionRevokedAt') IS NULL AND json_extract(payload,'$.cancelledAt') IS NULL AND json_extract(payload,'$.replacedBy') IS NULL ORDER BY created DESC,id DESC LIMIT 1",id);assert(report,'Laporan akhir tidak ditemukan',404);return respond(await reopenCompletion(u,report.id,b));}
 if(b.action==='cancel-execution'){
  assert(u.role==='Perusahaan','Pembatalan hanya dapat dilakukan perusahaan pelaksana',403);
  const c=await one('SELECT * FROM perusahaan WHERE user_id=?',u.id);
  assert(c&&old?.company_id===c.id,'Kegiatan bukan tanggung jawab perusahaan Anda',403);
  assert(b.confirm===true,'Konfirmasi pembatalan diperlukan');
  assert(old.status==='Dalam Pelaksanaan','Hanya kegiatan yang sedang dilaksanakan dapat dibatalkan',409);
  const reason=String(b.notes||'').trim();assert(reason.length<=2000,'Catatan maksimal 2.000 karakter');const stamp=now();
  const result=await db().batch([
   db().prepare("UPDATE usulan SET status='Disetujui POKJA Provinsi',company_id=NULL,committed_amount=0,actual_amount=0,progress=0,payload=json_set(payload,'$.actual',0,'$.cancelledAt',?,'$.cancelledBy',?,'$.cancellationNotes',?) WHERE id=? AND company_id=? AND status='Dalam Pelaksanaan'").bind(stamp,u.id,reason,id,c.id),
   db().prepare("UPDATE records SET status='Dibatalkan',payload=json_set(payload,'$.cancelledAt',?,'$.cancellationNotes',?) WHERE type IN ('komitmen','laporan') AND usulan_id=? AND owner_id=? AND status IN ('Aktif','Selesai') AND EXISTS(SELECT 1 FROM usulan WHERE id=? AND json_extract(payload,'$.cancelledAt')=?)").bind(stamp,reason,id,u.id,id,stamp),db().prepare("UPDATE keputusan_perusahaan SET decision='Dibatalkan' WHERE usulan_id=? AND company_id=? AND decision='Berkomitmen' AND EXISTS(SELECT 1 FROM usulan WHERE id=? AND json_extract(payload,'$.cancelledAt')=?)").bind(id,c.id,id,stamp),snapshotStatement(id!)
  ]);assert(result[0].meta.changes===1,'Status kegiatan sudah berubah. Muat ulang daftar.',409);
  await audit(u,'Batalkan pelaksanaan kegiatan',id!);return respond({ok:true});
 }
 if(b.action==='delete'){
  assert(old,'Usulan tidak ditemukan',404);assert(b.confirm===true,'Konfirmasi hapus usulan diperlukan');
  assert(canDeleteProposal(u,old),'Hanya pemilik atau administrator dapat menghapus usulan yang belum memiliki komitmen / pelaksanaan',403);
  assert(!await one("SELECT id FROM records WHERE usulan_id=? AND type IN ('komitmen','laporan') LIMIT 1",id),'Usulan dengan komitmen atau laporan tidak dapat dihapus',409);
  const deletedAt=now();const result=await db().batch([
   db().prepare("UPDATE usulan SET payload=json_set(payload,'$.deletedAt',?,'$.deletedBy',?) WHERE id=? AND status=? AND company_id IS NULL AND json_extract(payload,'$.deletedAt') IS NULL").bind(deletedAt,u.id,id,old.status),
   db().prepare("INSERT INTO audit_log (id,user_id,action,entity,created,ip_address) SELECT ?,?,'Hapus usulan (arsip)',?,?,? WHERE EXISTS (SELECT 1 FROM usulan WHERE id=? AND json_extract(payload,'$.deletedAt')=? AND json_extract(payload,'$.deletedBy')=?)").bind(uid(),u.id,id,deletedAt,auditIp(),id,deletedAt,u.id),snapshotStatement(id!)
  ]);assert(result[0].meta.changes===1,'Usulan sudah berubah, muat ulang daftar.',409);return respond({ok:true});
 }
 if(b.action==='verify'){
  const stage=b.stage;
  assert(stage==='Bappeda'||stage==='POKJA','Tahap verifikasi tidak valid');
  assert(stage==='Bappeda'?u.role==='Bappeda Provinsi':u.role==='Perangkat Daerah'&&isPokja(u,old),'Tidak berwenang pada tahap atau POKJA ini',403);
  const allowed=stage==='Bappeda'?['Menunggu Verifikasi Bappeda Provinsi']:['Menunggu Pembahasan POKJA'];
  assert(allowed.includes(old.status),'Tahap verifikasi tidak sesuai',409);
  const targets=stage==='Bappeda'?['Ditolak Bappeda Provinsi','Menunggu Pembahasan POKJA']:['Disetujui POKJA Provinsi','Ditolak POKJA Provinsi'];
  assert(targets.includes(b.status),'Keputusan tidak valid');
  assert(b.notes==null||typeof b.notes==='string','Catatan tidak valid');
  const notes=String(b.notes||'').trim();assert(notes.length<=3000,'Catatan maksimal 3000 karakter');
  const advancing=['Menunggu Pembahasan POKJA','Disetujui POKJA Provinsi'].includes(b.status);
  const previousPayload=JSON.parse(old.payload);
  const alignment=stage==='Bappeda'?await validateAlignment({program:b.program,sdgs:b.sdgs},previousPayload):null;
  if(advancing&&stage==='POKJA')await validateAlignment(previousPayload,previousPayload);
  let pokja=old.bidang,meetingId=null;
  const statements=[];
  if(stage==='Bappeda'){
   pokja=validText(b.bidang,'POKJA',200);assert(await one("SELECT id FROM master WHERE type='bidang' AND name=? AND active=1",pokja),'POKJA tidak valid');
  }else assert(b.confirm===true,'Konfirmasi keputusan POKJA diperlukan');
  // Status compare prevents two reviewers from overwriting a decision simultaneously.
  const reviewId=uid();
  statements.push(db().prepare('INSERT INTO review_usulan (id,usulan_id,stage,reviewer_id,meeting_id,from_status,to_status,notes,checks,created) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM usulan WHERE id=? AND status=? AND json_extract(payload,\'$.deletedAt\') IS NULL)').bind(reviewId,id,stage,u.id,meetingId,old.status,b.status,notes,JSON.stringify({confirmed:stage==='POKJA'&&b.confirm===true,technical:!!b.technical,program:!!b.program,overlap:!!b.overlap,...(alignment||{})}),now(),id,old.status));
  statements.push(db().prepare('UPDATE usulan SET status=?,bidang=?,payload=?,funding_clear=CASE WHEN ? THEN 1 ELSE funding_clear END,pokja_assigned_by=CASE WHEN ?=\'Bappeda\' THEN ? ELSE pokja_assigned_by END WHERE id=? AND status=? AND json_extract(payload,\'$.deletedAt\') IS NULL AND EXISTS (SELECT 1 FROM review_usulan WHERE id=?)').bind(b.status,pokja,JSON.stringify({...previousPayload,...(alignment||{})}),stage==='Bappeda'&&b.overlap?1:0,stage,u.id,id,old.status,reviewId));
  if(alignment){
   statements.push(db().prepare('DELETE FROM usulan_program WHERE usulan_id=? AND EXISTS(SELECT 1 FROM review_usulan WHERE id=?)').bind(id,reviewId),db().prepare('DELETE FROM usulan_sdgs WHERE usulan_id=? AND EXISTS(SELECT 1 FROM review_usulan WHERE id=?)').bind(id,reviewId));
   for(const pr of alignment.program)statements.push(db().prepare('INSERT INTO usulan_program(usulan_id,program_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM review_usulan WHERE id=?)').bind(id,pr,reviewId));
   for(const goal of alignment.sdgs)statements.push(db().prepare('INSERT INTO usulan_sdgs(usulan_id,goal) SELECT ?,? WHERE EXISTS(SELECT 1 FROM review_usulan WHERE id=?)').bind(id,Number(goal),reviewId));
  }
  const result=await db().batch([...statements,snapshotStatement(id!)]);assert(result[1].meta.changes===1,'Usulan telah diproses pengguna lain. Muat ulang daftar.',409);
  if(old.owner_id)await notify(old.owner_id,`${old.title}: ${b.status}. ${notes}`);await audit(u,`${stage}: ${b.status}`,id!);return respond({ok:true});
 }
 if(b.action==='commit'){
  assert(u.role==='Perusahaan','Hanya perusahaan dapat memilih komitmen',403);
  const c=await one("SELECT * FROM perusahaan WHERE user_id=? AND status='Disetujui'",u.id);assert(c,'Profil perusahaan belum disetujui',403);
  assert(readyStatuses.includes(old.status)&&!old.company_id,'Usulan sudah memiliki komitmen atau belum disetujui POKJA',409);
  const notes=validText(b.notes,'Catatan keputusan / rencana dukungan',3000);const decisionId=uid();
  const amount=Number(b.amount);assert(Number.isFinite(amount)&&amount>0&&amount<=1e14,'Alokasi komitmen tidak valid');assert(b.fullOutput===true&&b.fullBeneficiaries===true,'Komitmen wajib mencakup seluruh output dan penerima manfaat dalam satu usulan');assert(isIsoDate(b.start)&&isIsoDate(b.end)&&b.end>=b.start,'Jadwal tidak valid');
  const result=await db().batch([
   db().prepare("UPDATE usulan SET status='Dalam Pelaksanaan',company_id=?,committed_amount=?,payload=json_remove(payload,'$.cancelledAt','$.cancelledBy','$.cancellationNotes','$.completionRevokedAt','$.completionRevokedBy','$.reopeningNotes') WHERE id=? AND status IN ('Terverifikasi','Disetujui POKJA Provinsi') AND company_id IS NULL AND json_extract(payload,'$.deletedAt') IS NULL").bind(c.id,amount,id),
   db().prepare("INSERT INTO keputusan_perusahaan (id,usulan_id,company_id,decision,amount,full_output,full_beneficiaries,notes,created) SELECT ?,?,?,'Berkomitmen',?,1,1,?,? WHERE EXISTS (SELECT 1 FROM usulan WHERE id=? AND company_id=? AND committed_amount=?) AND NOT EXISTS (SELECT 1 FROM keputusan_perusahaan WHERE usulan_id=? AND decision='Berkomitmen')").bind(decisionId,id,c.id,amount,notes,now(),id,c.id,amount,id),
   db().prepare("INSERT INTO records (id,type,owner_id,usulan_id,title,status,payload,created) SELECT ?,'komitmen',?,?,?,'Aktif',?,? WHERE EXISTS (SELECT 1 FROM keputusan_perusahaan WHERE id=?)").bind(uid(),u.id,id,old.title,JSON.stringify({...b,year:old.year,planningYear:u.planning_year,planningPhase:phase?.phase??null,planningPhaseVersion:2,companyId:c.id}),now(),decisionId),snapshotStatement(id!)
  ]);assert(result[0].meta.changes===1,'Usulan sudah dipilih perusahaan lain.',409);if(old.owner_id)await notify(old.owner_id,`${c.name} berkomitmen mendukung ${old.title}`);await audit(u,'Komitmen seluruh output dan penerima manfaat',id!);return respond({ok:true});
 }
 assert(canPropose(u),'Peran tidak dapat mengusulkan',403);
 const pdCanEdit=!!old&&u.role==='Perangkat Daerah'&&isPokja(u,old)&&!old.company_id&&!['Dalam Pelaksanaan','Selesai','Dibatalkan','Ditolak POKJA Provinsi'].includes(old.status);
 if(old){assert(old.status!=='Ditolak POKJA Provinsi','Usulan ditolak POKJA dan terkunci.',409);assert(u.role==='Administrator'||old.owner_id===u.id||pdCanEdit,'Usulan bukan milik Anda atau POKJA akun Anda',403);assert(!old.company_id&&!['Dalam Pelaksanaan','Selesai','Dibatalkan'].includes(old.status),'Usulan yang sudah berkomitmen atau selesai tidak dapat diubah',409);assert(u.role==='Administrator'||pdCanEdit||ownerEditableProposalStatuses(u).includes(old.status),'Usulan sudah diverifikasi Bappeda Provinsi dan tidak dapat diedit oleh pengusul',409);}
 const origin=old?.origin|| (u.role==='Bappeda Kab/Kota'?'Kab/Kota':'Provinsi');assert(['Kab/Kota','Provinsi'].includes(origin),'Asal usulan tidak valid');
 const title=validText(b.title,'Judul',220),p=b.payload||{};

 const reference=old?.musrenbang_reference||'';
 const year=Number(b.year);assert(Number.isInteger(year)&&year>=2027,'Tahun usulan minimal 2027');const musrenbangYear=year-1;
 assert(await one("SELECT id FROM master WHERE type='wilayah' AND name=? AND active=1",b.wilayah),'Wilayah tidak valid');await requireProposalYear(u,b.year);
 if(u.role==='Bappeda Kab/Kota')assert(b.wilayah===u.wilayah,'Usulan harus sesuai wilayah akun');
 // Kab/Kota supplies a theme suggestion; only Bappeda assigns the formal POKJA.
 let pokja=origin==='Kab/Kota'?(pdCanEdit?old.bidang:'Belum ditetapkan'):u.role==='Administrator'?(u.bidang&&u.bidang!=='Semua'?u.bidang:old?.bidang||(await one("SELECT name FROM master WHERE type='bidang' AND active=1 ORDER BY id LIMIT 1"))?.name):u.bidang;
 if(origin==='Provinsi'){assert(isPokja(u,{bidang:pokja}),'Usulan Provinsi harus sesuai POKJA akun',403);assert(await one("SELECT id FROM master WHERE type='bidang' AND name=? AND active=1",pokja),'POKJA tidak valid');}
 const budget=Number(b.budget);assert(Number.isFinite(budget)&&budget>0&&budget<=1e14,'Estimasi biaya tidak valid');assert(Number.isInteger(Number(p.beneficiaries))&&Number(p.beneficiaries)>0,'Penerima manfaat wajib bilangan bulat positif');assert(Number(p.lat)>=-5&&Number(p.lat)<=-1&&Number(p.lng)>=102&&Number(p.lng)<=107,'Koordinat harus berada di Sumatera Selatan');assert(validGoalSelection(p.sdgs),'Pilih minimal satu dari 17 SDGs yang valid');assert(Array.isArray(p.program)&&p.program.length>0&&new Set(p.program).size===p.program.length,'Pilih program strategis yang valid');
 for(const pr of p.program)assert(await one("SELECT id FROM master WHERE id=? AND type='program' AND active=1",pr),'Program strategis tidak valid');
 assert(['Draft','Diajukan',...(old?[old.status]:[])].includes(b.status),'Status simpan tidak valid');let status=b.status==='Draft'&&!pdCanEdit? 'Draft':b.status==='Diajukan'?origin==='Kab/Kota'?u.role==='Perangkat Daerah'?'Menunggu Pembahasan POKJA':'Menunggu Verifikasi Bappeda Provinsi':'Disetujui POKJA Provinsi':old?.status||'Draft';
 const newId=id||`USL-${b.year}-${uid().slice(0,8).toUpperCase()}`;delete p.demo;delete p.actual;delete p.deletedAt;delete p.deletedBy;
 const statements=[];
 if(old)statements.push(db().prepare('UPDATE usulan SET title=?,bidang=?,wilayah=?,year=?,budget=?,status=?,origin=?,musrenbang_year=?,musrenbang_reference=?,payload=? WHERE id=? AND status=? AND company_id IS NULL AND json_extract(payload,\'$.deletedAt\') IS NULL').bind(title,pokja,b.wilayah,Number(b.year),budget,status,origin,musrenbangYear,reference,JSON.stringify(p),newId,old.status));
 else statements.push(db().prepare('INSERT INTO usulan (id,owner_id,title,bidang,wilayah,year,budget,status,origin,musrenbang_year,musrenbang_reference,funding_clear,payload,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?)').bind(newId,u.id,title,pokja,b.wilayah,Number(b.year),budget,status,origin,musrenbangYear,reference,JSON.stringify(p),now()));
 statements.push(db().prepare('DELETE FROM usulan_sdgs WHERE usulan_id=?').bind(newId),db().prepare('DELETE FROM usulan_program WHERE usulan_id=?').bind(newId));
 for(const goal of p.sdgs)statements.push(db().prepare('INSERT INTO usulan_sdgs (usulan_id,goal) VALUES (?,?)').bind(newId,Number(goal)));
 for(const program of p.program)statements.push(db().prepare('INSERT INTO usulan_program (usulan_id,program_id) VALUES (?,?)').bind(newId,program));
 const saved=await db().batch([...statements,snapshotStatement(newId)]);assert(saved[0].meta.changes===1,'Usulan telah berubah, muat ulang sebelum menyimpan',409);await audit(u,status==='Disetujui POKJA Provinsi'?'Usulan Perangkat Daerah langsung disetujui POKJA':old?'Perbarui usulan':'Tambah draft usulan',newId);return respond({ok:true,id:newId});
}


