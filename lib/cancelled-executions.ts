import {all,db,audit} from './server';
// Upgrade company cancellations saved before proposals were offered again.
export async function restoreCancelledProposals(){
 const rows=await all("SELECT p.id FROM usulan p JOIN perusahaan c ON c.id=p.company_id WHERE p.status='Dibatalkan' AND json_extract(p.payload,'$.cancelledBy')=c.user_id AND json_extract(p.payload,'$.deletedAt') IS NULL");
 if(!rows.length)return;
 for(const {id} of rows)await db().batch([
  db().prepare("UPDATE records SET status='Dibatalkan',payload=json_set(payload,'$.cancelledAt',(SELECT json_extract(payload,'$.cancelledAt') FROM usulan WHERE id=?)) WHERE usulan_id=? AND type IN ('komitmen','laporan') AND owner_id=(SELECT json_extract(payload,'$.cancelledBy') FROM usulan WHERE id=?)").bind(id,id,id),
  db().prepare("UPDATE keputusan_perusahaan SET decision='Dibatalkan' WHERE usulan_id=? AND company_id=(SELECT company_id FROM usulan WHERE id=?) AND decision='Berkomitmen'").bind(id,id),
  db().prepare("UPDATE usulan SET status='Disetujui POKJA Provinsi',company_id=NULL,committed_amount=0,actual_amount=0,progress=0,payload=json_set(payload,'$.actual',0) WHERE id=? AND status='Dibatalkan' AND json_extract(payload,'$.deletedAt') IS NULL").bind(id)
 ]);
 await audit(null,'Kembalikan usulan dari pembatalan perusahaan ke daftar siap komitmen',String(rows.length));
}
