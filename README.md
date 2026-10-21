# SIAP TANJAK — paket GitHub

Source aplikasi terbaru untuk repositori GitHub, dengan pengujian/build otomatis.
Lihat [PANDUAN-GITHUB.md](PANDUAN-GITHUB.md) untuk upload dan mengambil hasil build.

## Menjalankan source

Gunakan Node.js 22.13 atau lebih baru dalam seri 22.

```sh
npm ci --include=dev
npm run typecheck
npm test
npm run build
npm start
```

Backend memerlukan SQLite dan direktori data persisten. GitHub Pages hanya melayani
situs statis sehingga tidak menjalankan seluruh aplikasi ini. Gunakan server Node.js
untuk menjalankan backend. Dokumentasi: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

## Hasil build untuk server

Workflow `.github/workflows/ci.yml` menguji aplikasi, membangun versi Linux, membuat
runtime beserta dependensinya dan menguji API/CAPTCHA/aset secara terpisah. Unduh
artifact dari tab Actions setelah workflow berhasil. Tidak perlu npm ci pada artifact
runtime lengkap; Node.js tetap harus terpasang pada server.

```sh
npm run package:release
npm run verify:release
```

Build runtime mengikuti sistem operasi pembuatnya. Untuk server Linux, gunakan hasil
GitHub Actions ubuntu-latest. Instruksi server tersedia di [PANDUAN-DEPLOY.md](PANDUAN-DEPLOY.md).

Database, sesi, lampiran privat dan kredensial email tidak berada dalam repositori.
Data lama tetap dipindahkan terpisah atau dipertahankan pada server yang sudah ada.
Tampilan sambutan Beranda 120%, bagian Tentang 110%, dan CAPTCHA wajib aktif.
