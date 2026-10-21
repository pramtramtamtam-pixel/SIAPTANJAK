export const databaseDomains=[
 {name:'Homepage',tables:['homepage_content','homepage_assets','homepage_revisions'],views:[],access:'Publik membaca konten yang diterbitkan; hanya Administrator mengubah konten dan mengunggah aset.'},
 {name:'Usulan TJSL',tables:['usulan','usulan_sdgs','usulan_program','dokumen','review_usulan','rapat_pokja','keputusan_perusahaan','commitment_ba','planning_schedules','planning_events','proposal_revisions','planning_schedules_legacy'],views:['domain_usulan_tjsl'],access:'Dibatasi tahun, lokasi Kab/Kota, POKJA dan kepemilikan perusahaan sesuai peran.'},
 {name:'RKA TJSL Perusahaan',tables:[],views:['domain_rka_tjsl'],access:'Perusahaan hanya rencananya sendiri; Administrator dan Bappeda Provinsi dapat membaca sesuai tahun.'},
 {name:'Pelaporan dan Monitoring Pelaksanaan',tables:['report_documents'],views:['domain_pelaporan_tjsl','domain_komitmen_tjsl'],access:'Laporan dan monitoring mengikuti tahun, perusahaan pelaksana, lokasi dan POKJA sesuai kewenangan.'},
 {name:'Evaluasi dan Penghargaan',tables:['company_assessments','assessment_history'],views:['domain_evaluasi_tjsl'],access:'Penilaian, peringkat dan penghargaan hanya Administrator dan Bappeda Provinsi.'}
];
export const sharedTables=['users','user_profiles','company_logos','master','perusahaan','records','audit_log','audit_log_archive','notifications','email_outbox','email_settings','email_confirmations','nib_lookups','robot_challenges','login_attempts'];
