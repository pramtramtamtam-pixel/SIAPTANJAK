type RegisteredCompany={name:string;payload?:any};
export function registrationWelcomeEmail(company:RegisteredCompany,confirmationUrl:string){
 const p=company.payload||{},name=company.name,contact=p.pic||'Pimpinan Perusahaan',office=p.offices?.find((o:any)=>o.type==='Kantor pusat')||p.offices?.[0],address=office?[office.address,office.wilayah].filter(Boolean).join(', '):p.pusat||p.operasional||'';
 return `Kepada Yth.
${contact}
${name}
${address}

Dengan hormat,

Atas nama Pemerintah Provinsi Sumatera Selatan dan Tim Pengelola SIAP-TANJAK (Sistem Informasi Alokasi Pendanaan - Tanggung Jawab Sosial Korporasi), kami menyampaikan apresiasi serta ucapan terima kasih yang sebesar-besarnya kepada ${name} atas partisipasi dan pendaftarannya dalam sistem ini.

Kami menyambut baik bergabungnya ${name} dalam inisiatif strategis Tanggung Jawab Sosial dan Lingkungan (TJSL). Langkah nyata ini merupakan bentuk komitmen dalam mendukung pembangunan berkelanjutan serta peningkatan kesejahteraan masyarakat di Provinsi Sumatera Selatan.

CATATAN PENTING TERKAIT TAHAPAN SELANJUTNYA

1. Konfirmasi email
Silakan buka tautan berikut dalam 24 jam untuk mengonfirmasi alamat email perusahaan:
${confirmationUrl}

2. Verifikasi data
Data pendaftaran yang telah dikirimkan melalui platform SIAP-TANJAK akan diverifikasi oleh tim pengelola. Konfirmasi email belum berarti akun disetujui; akun dapat digunakan setelah persetujuan Administrator.

3. Koordinasi lanjutan
Petugas penghubung (liaison officer) kami akan menghubungi pihak ${name} untuk koordinasi program, penjadwalan audiensi, maupun pemilihan fokus program pembangunan/sosial yang bersinergi.

Apabila terdapat pertanyaan atau hal yang memerlukan koordinasi lebih lanjut, Bapak/Ibu dapat menghubungi layanan bantuan kami melalui email siaptanjak@gmail.com atau nomor telepon 085822222262.

Sekali lagi, terima kasih atas kolaborasi dan kepedulian yang diberikan. Bersama SIAP-TANJAK, mari kita wujudkan Sumatera Selatan yang semakin maju, mandiri, dan sejahtera.

Hormat kami,

Tim Pengelola SIAP-TANJAK
Provinsi Sumatera Selatan

Abaikan pesan ini jika Anda tidak melakukan pendaftaran.`;
}
