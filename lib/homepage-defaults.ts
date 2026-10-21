import {legalDocuments} from './legal';
export const homepageDefaults={
 heroTitle:'Selamat Datang di',heroTagline:'BERSAMA MEMBANGUN SUMATERA SELATAN',heroIntro:'Mari bersama-sama bergabung dalam program Tanggung Jawab Sosial dan Lingkungan (TJSL) untuk berkontribusi bagi pembangunan dan kesejahteraan masyarakat di Provinsi Sumatera Selatan.',
 about:'Aplikasi Siaptanjak adalah sebuah platform digital yang dirancang untuk memfasilitasi manajemen perusahaan dalam melaporkan kegiatan TJSL nya agar lebih mudah, efektif dan transparan.',whatsapp:'6285822222262',email:'pramtramtamtam@gmail.com',logo:'/visual/SIAP-TANJAK-horizontal.png',provinceLogo:'/visual/pemprov-horizontal.png',
 goals:[{title:'Efisiensi Pelaporan',description:'Mempermudah perusahaan dalam menyusun, merencanakan, melacak, melaporkan dan mengevaluasi kegiatan TJSL secara mudah, efisien, sistematis, profesional dan aman.'},{title:'Transparan',description:'Menyediakan akses informasi yang jelas bagi pemangku kepentingan terkait pelaksanaan program TJSL, sehingga membangun kepercayaan publik.'},{title:'Mendukung Tujuan Pembangunan Berkelanjutan (SDGs)',description:'Mendorong pelaksanaan program TJSL yang selaras dengan tujuan pembangunan berkelanjutan.'},{title:'Membangun Kolaborasi dan Sinergi menjadi Lebih Baik',description:'Memfasilitasi sinergi antara perusahaan, pemerintah, dan masyarakat dalam pelaksanaan kegiatan TJSL.'}],
 activities:[
  {
    "theme": "Infrastruktur",
    "title": "Pembangunan transportasi dan sarana olahraga",
    "intro": "",
    "photos": [
      [
        "/visual/kegiatan/mini-trans.png",
        "Pembangunan Stasiun Mini Trans",
        "PT Bukit Asam Tbk"
      ],
      [
        "/visual/kegiatan/bowling-pertamina.png",
        "Sarana olahraga bowling",
        "Pertamina"
      ],
      [
        "/visual/kegiatan/olahraga-bowling.png",
        "Pemanfaatan sarana olahraga",
        "Dokumentasi kegiatan"
      ],
      [
        "/visual/kegiatan/olahraga-bukit-asam.png",
        "Dukungan kegiatan sepak bola",
        "PT Bukit Asam Tbk"
      ]
    ]
  },
  {
    "theme": "Sosial dan Pengentasan Kemiskinan",
    "title": "Rumah layak, kehidupan lebih baik",
    "intro": "Contoh dukungan perbaikan rumah dan bantuan sosial untuk masyarakat.",
    "photos": [
      [
        "/visual/kegiatan/bedah-rumah.png",
        "Program bedah rumah dan GEBRAK",
        "Bukit Asam, Bank Sumsel Babel, KAI, dan mitra lainnya"
      ],
      [
        "/visual/kegiatan/bpr-sumsel.png",
        "Penyaluran bantuan TJSL",
        "Bank BPR Sumsel"
      ]
    ]
  },
  {
    "theme": "Pengendalian Inflasi",
    "title": "Kolaborasi menjaga kebutuhan masyarakat",
    "intro": "Contoh operasi pasar murah untuk mendukung ketersediaan bahan pokok dan stabilitas harga.",
    "photos": [
      [
        "/visual/kegiatan/pasar-murah.png",
        "Operasi Pasar Murah Provinsi Sumatera Selatan",
        "Kolaborasi pemangku kepentingan"
      ],
      [
        "/visual/kegiatan/pasar-sumsel-energi.png",
        "Operasi Pasar Murah KM 5",
        "PT Sumsel Energi Gemilang"
      ]
    ]
  },
  {
    "theme": "Usaha Ekonomi Kerakyatan",
    "title": "Menguatkan usaha dan kemandirian pangan",
    "intro": "Contoh dukungan Sumsel Mandiri Pangan dan pemberdayaan pembudidaya ikan.",
    "photos": [
      [
        "/visual/kegiatan/gsm-bank-sumsel.png",
        "Gerakan Sumsel Mandiri Pangan",
        "Bank Sumsel Babel"
      ],
      [
        "/visual/kegiatan/gsm-mandiri.png",
        "Dukungan Sumatera Selatan Mandiri Pangan",
        "Bank Mandiri"
      ],
      [
        "/visual/kegiatan/perikanan-pertamina.png",
        "Pemberdayaan pembudidaya ikan",
        "Kilang Pertamina Plaju"
      ]
    ]
  },
  {
    "theme": "Pendidikan dan Kesehatan",
    "title": "Investasi untuk generasi yang lebih sehat",
    "intro": "Dokumentasi pendidikan dan pelayanan kesehatan di Sumatera Selatan.",
    "photos": [
      [
        "/visual/kegiatan/beasiswa.jpg",
        "Program beasiswa studi kedokteran",
        "Dokumentasi pendidikan"
      ],
      [
        "/visual/kegiatan/sekolah.jpg",
        "Peresmian sarana pendidikan",
        "Dokumentasi pendidikan"
      ],
      [
        "/visual/kegiatan/layanan-kesehatan.jpg",
        "Kunjungan pelayanan kesehatan masyarakat",
        "Dokumentasi kesehatan"
      ],
      [
        "/visual/kegiatan/kunjungan-kesehatan.jpg",
        "Dukungan pelayanan kesehatan",
        "Dokumentasi kesehatan"
      ]
    ]
  },
  {
    "theme": "Lingkungan Hidup dan Kedaruratan Bencana",
    "title": "Lingkungan terjaga, masyarakat tangguh",
    "intro": "Dokumentasi koordinasi dan penanganan kebakaran hutan dan lahan (karhutla).",
    "photos": [
      [
        "/visual/kegiatan/koordinasi-bencana.jpg",
        "Koordinasi penanggulangan bencana",
        "Dokumentasi koordinasi"
      ],
      [
        "/visual/kegiatan/rapat-karhutla.jpg",
        "Rapat koordinasi penanggulangan karhutla",
        "Dokumentasi koordinasi"
      ],
      [
        "/visual/kegiatan/relawan-karhutla.jpg",
        "Dukungan relawan karhutla",
        "Dokumentasi lapangan"
      ],
      [
        "/visual/kegiatan/tinjauan-karhutla.jpg",
        "Peninjauan lokasi karhutla",
        "Dokumentasi lapangan"
      ]
    ]
  }
],laws:legalDocuments.map(l=>({...l,file:'/dokumen/'+l.file,extra:l.extra?'/dokumen/'+l.extra:''}))
};
