# Panduan deployment SIAP TANJAK

## Isi dan kebutuhan

- Source terbaru: app/, lib/, komponen, migrations SQL 0000â€“0018 dan tests/.
- ZIP GitHub berisi source; jalankan npm ci --include=dev dan npm run build terlebih dahulu.
- Artifact GitHub Actions berisi runtime Linux lengkap dengan dependensi, aset dan migrations.
  Setelah artifact diekstrak, runtime dapat dijalankan tanpa npm ci; Node.js tetap diperlukan.
- Node.js minimal 22.13 (node:sqlite), npm, penyimpanan lokal persisten dan satu proses aplikasi.
- Cocok untuk VPS/server Node.js. Hosting statis tidak dapat menjalankan backend dan SQLite ini.
- File contoh Nginx, systemd dan environment tersedia di deploy/. Semua domain/path contoh harus disesuaikan.

## Memasang versi ini di server Linux

1. Ekstrak ZIP ke direktori rilis baru, misalnya /opt/siaptanjak/releases/20261021/.
   Folder aplikasi di dalam ZIP bernama SIAP-TANJAK. Jalankan perintah berikut dari folder tersebut:

   ```sh
   # Untuk SOURCE dari GitHub saja:
   npm ci --include=dev
   npm run build
   # Untuk ARTIFACT runtime Linux dari Actions: lewati kedua perintah di atas.
   ```

2. Arahkan /opt/siaptanjak/current ke folder SIAP-TANJAK pada rilis yang dipilih.
   Buat akun sistem `siap-tanjak` dan direktori /var/lib/siaptanjak yang hanya dapat
   ditulis akun layanan tersebut. Jangan letakkan data di public/ atau folder rilis.
3. Salin deploy/env.example ke /etc/siaptanjak/app.env. Ubah domain di
   VINEXT_TRUSTED_HOSTS, lokasi SIAP_MIGRATIONS_DIR dan direktori data bila berbeda.
   Lindungi file tersebut dengan izin 600. SIAP_SEED_EXAMPLE_DATA=0 mencegah pengisian data contoh otomatis.
4. Siapkan data sesuai bagian berikut sebelum membuka aplikasi ke publik.
5. Salin deploy/siaptanjak.service ke /etc/systemd/system/siaptanjak.service.
   Sesuaikan lokasi Node jika bukan /usr/bin/node, lalu:

   ```sh
   sudo systemctl daemon-reload
   sudo systemctl enable --now siaptanjak
   curl -f http://127.0.0.1:3101/api/me
   ```

6. Pasang domain dan sertifikat HTTPS yang valid. Gunakan deploy/nginx.conf.example
   sebagai acuan virtual host tersendiri. Ubah domain dan lokasi sertifikat terlebih dahulu,
   jalankan `nginx -t`, kemudian reload Nginx. Jangan menimpa konfigurasi aplikasi lain.
   Reverse proxy harus menimpa header IP/protokol dan menghapus header identitas OAI
   seperti contoh. Port Node hanya mendengarkan 127.0.0.1.
7. Uji akses HTTPS, CAPTCHA, masuk akun, filter lokasi, cetak/ekspor dan akses lampiran.
   `journalctl -u siaptanjak -n 100 --no-pager` dapat dipakai untuk melihat kesalahan layanan.

Untuk mencoba build tanpa systemd, dari folder aplikasi gunakan:

```sh
node --env-file=/etc/siaptanjak/app.env dist/standalone/server.js
```

## Database dan file privat

Paket aplikasi sengaja tidak menyertakan data localhost maupun rahasia SMTP.

Jika mengupdate server yang sudah berisi data: hentikan layanan, buat cadangan seluruh
direktori SIAP_DATA_DIR, pertahankan direktori data tersebut dan konfigurasi environment,
lalu ganti rilis aplikasi dan hidupkan kembali layanan. Migration baru diterapkan otomatis
pada startup. Cadangan database dan objek harus disimpan sebelum upgrade.
Rollback setelah migration memerlukan pemulihan cadangan data dan rilis yang cocok.

Jika memindahkan data localhost ke server baru: hentikan aplikasi sumber terlebih dahulu,
salin database `siaptanjak.sqlite` dan folder `objects/` dari data/ ke direktori data server.
Saat sumber berhenti, sertakan file SQLite -wal/-shm apabila masih ada. Salin sebagai satu
cadangan konsisten, jangan menyalin database yang sedang ditulis. Hapus sesi pada salinan
server sebelum go-live sehingga pengguna login kembali. Atur kepemilikan dan izin direktori.
`smtp.local.json`, manual-mode.json, backup lama dan file sementara tidak perlu dipindahkan.
Uji lampiran dan integritas database setelah transfer.

Jika instalasi benar-benar kosong, inisialisasikan admin secara lokal di server sebelum
membuka akses publik. Utilitas hanya berlaku apabila belum ada admin dan tidak mengubah
akun yang sudah ada:

```sh
sudo -u siap-tanjak /usr/bin/node --env-file=/etc/siaptanjak/app.env deploy/init-admin.mjs
```

Kata sandi dimasukkan sendiri melalui terminal tersembunyi. Tidak ada kata sandi bawaan.
Utilitas memasang data master dasar, bukan usulan/RKA/laporan contoh. Setelah masuk,
atur data master, pengguna dan jadwal tahapan melalui akun Administrator.

## Email dan layanan eksternal

Pengiriman Gmail pada Windows memakai enkripsi DPAPI sehingga file SMTP lokal tidak
bisa dipakai begitu saja pada Linux atau akun Windows lain. Untuk server Linux,
siapkan MAIL_RELAY_URL, MAIL_RELAY_TOKEN dan MAIL_FROM_EMAIL. Relay menerima POST JSON
dengan Bearer token, header Idempotency-Key, serta kolom from, fromName, replyTo, to,
subject dan text; hanya kembalikan HTTP 2xx setelah menerima pesan untuk pengiriman.
Sesuai implementasi, pesan tetap berstatus Menunggu jika relay belum dikonfigurasi/gagal.
Alamat pengirim dan template dapat diatur pada Pengaturan Email di akun Administrator.
Paket ini tidak memasang relay atau mengirim email pengujian.

Jika ingin pencarian NIB otomatis, isi OSS_LOOKUP_URL dan OSS_API_TOKEN sesuai akses yang
diotorisasi pengelola. Peta/pencarian alamat serta preview tautan cloud memerlukan koneksi internet.

## Verifikasi dan build ulang

```sh
npm ci --include=dev
npm run typecheck
npm test
npm run build
npm run package:release
npm run verify:release
npm start
```

Build ulang setelah mengubah source. Jalankan layanan dengan NODE_ENV=production.
CAPTCHA tetap diwajibkan, termasuk pada localhost; mode manual lama sudah tidak digunakan.

SHA256SUMS.json memuat checksum setiap berkas paket untuk memeriksa hasil transfer.
