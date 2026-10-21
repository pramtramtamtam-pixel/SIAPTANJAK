export const pokjaColors:Record<string,string>={'Infrastruktur':'#2563eb','Sosial dan Pengentasan Kemiskinan':'#15803d','Pengendalian Inflasi':'#b91c1c','Usaha Ekonomi Kerakyatan':'#7e22ce','Pendidikan dan Kesehatan':'#0e7490','Lingkungan Hidup dan Kedaruratan Bencana':'#b45309'};
export const pokjaColor=(name:string)=>pokjaColors[name.replace(/^POKJA\s+/,'')]||'#475569';
