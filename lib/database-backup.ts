import {env} from 'cloudflare:workers';
import {zipSync,strToU8} from 'fflate';
import {assert,audit,now} from './server';
export async function downloadDatabaseBackup(u:any){
 assert(u.role==='Administrator','Backup database hanya dapat diunduh Administrator',403);
 assert(typeof (env as any).databaseBackup==='function','Backup SQLite tidak tersedia pada server ini',503);
 await audit(u,'Unduh backup seluruh database SQLite','Semua tahun');
 const result=await (env as any).databaseBackup(),created=now(),stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(created)).replace(/[^0-9]/g,'');
 const info={application:'SIAP TANJAK',format:'SQLite',version:1,created,timezone:'Asia/Jakarta',scope:'Seluruh tabel dan seluruh tahun',...result.info};
 const notes='BACKUP DATABASE SIAP TANJAK\n\nIsi: siaptanjak.sqlite dan informasi-backup.json.\nDatabase mencakup seluruh tahun, akun, usulan, RKA, laporan, evaluasi, konfigurasi homepage, dan audit.\nFoto serta berkas unggahan tidak termasuk; cadangkan folder /var/lib/siaptanjak/objects secara terpisah.\n\nPemulihan oleh pengelola server:\n1. Hentikan layanan siaptanjak.service.\n2. Cadangkan database aktif beserta berkas WAL/SHM sebelum mengganti database.\n3. Pastikan tidak ada koneksi database terbuka. Pindahkan berkas WAL/SHM lama ke arsip.\n4. Pasang siaptanjak.sqlite hasil ekstraksi ke /var/lib/siaptanjak/siaptanjak.sqlite.\n5. Sesuaikan pemilik berkas dengan akun layanan siap-tanjak dan izin 600.\n6. Pulihkan folder objects dari backup berkas yang sesuai bila diperlukan.\n7. Jalankan layanan dan periksa hasilnya.\n\nSimpan backup di tempat yang hanya dapat diakses pengelola yang berwenang.\n';
 const zip=zipSync({'siaptanjak.sqlite':result.bytes,'informasi-backup.json':strToU8(JSON.stringify(info,null,2)),'PETUNJUK.txt':strToU8(notes)},{level:6});
 return new Response(new Uint8Array(zip),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="SIAP-TANJAK-Database-${stamp}-WIB.zip"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
