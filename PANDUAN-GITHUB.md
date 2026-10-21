# Upload SIAP TANJAK ke GitHub

## Yang diunggah

Ekstrak SIAP-TANJAK-GitHub-2026-10-21.zip. Isi folder SIAP-TANJAK adalah root
repositori: package.json, app/, lib/, public/, drizzle/, tests/ dan .github/.
Jangan mengunggah file ZIP sebagai pengganti source. Jangan menyertakan node_modules,
data/, .env atau build komputer lokal. Pastikan folder tersembunyi .github ikut diunggah.

## Upload melalui Git

Buat repositori GitHub kosong dengan nama yang dipilih sendiri. Dari folder source
hasil ekstraksi, jalankan perintah berikut dan ganti USERNAME/REPO dengan repo tujuan:

```sh
git init
git add .
git commit -m "SIAP TANJAK: source dan workflow build"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

Jika memakai repo yang sudah ada, gunakan checkout repo tersebut dan tinjau perubahannya;
jangan memaksa push atau mengganti riwayat. Anda juga dapat memakai GitHub Desktop:
Add local repository, pilih folder source, lalu Publish repository.

## Mendapatkan paket server Linux

1. Buka tab Actions pada repo GitHub.
2. Pilih workflow "Test dan Build SIAP TANJAK". Workflow otomatis berjalan saat push
   atau pull request, dan dapat dijalankan dari tombol Run workflow.
3. Tunggu sampai pemasangan dependensi, typecheck, test, build dan verifikasi runtime berhasil.
4. Buka run tersebut dan unduh artifact `siap-tanjak-linux-x64-<commit>`.
5. Ekstrak ZIP artifact, lalu ekstrak siap-tanjak-linux-x64.tar.gz. Verifikasi SHA256
   jika ingin memeriksa transfer. Folder SIAP-TANJAK hasil ekstraksi adalah paket server.
6. Ikuti PANDUAN-DEPLOY.md untuk environment, SQLite persisten, systemd, Nginx dan HTTPS.

Workflow hanya menguji dan membuat artifact. Workflow tidak meminta kredensial server,
tidak melakukan publish website, tidak mengubah database server, dan belum dijalankan
pada akun GitHub Anda oleh paket ini. Server tujuan perlu dipilih/disiapkan terpisah.

GitHub Pages adalah hosting statis; backend Node.js dan SQLite SIAP TANJAK memerlukan
server yang mendukungnya. Jangan mengaktifkan Pages sebagai pengganti backend.
Referensi: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

Untuk update source: commit dan push perubahannya, unduh artifact baru setelah workflow
berhasil, cadangkan data server, lalu ganti rilis sambil mempertahankan SIAP_DATA_DIR.

## Perbaikan paket ini

- Source dipisahkan dari hasil build Windows dan dependensi lokal.
- next-env.d.ts tidak lagi mengacu ke .next/types yang tidak ada pada checkout bersih.
- Workflow menginstal dependensi dev untuk build agar vinext tidak hilang ketika NODE_ENV production.
- Artifact runtime berisi semua dependensi standalone, public/, drizzle/ dan utilitas admin.
- Probe menjalankan API, CAPTCHA dan aset dari direktori runtime dengan database uji kosong.
- Pengaturan rahasia dan data operasional tetap tidak dimasukkan ke GitHub.
