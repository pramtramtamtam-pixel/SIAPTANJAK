import {all,unpack} from './server';
// Fixed views keep functional groups distinct; authorization is still applied by callers.
export async function readYearRecords(u:any,reportYear=u.planning_year){
 const views=['domain_pelaporan_tjsl','domain_evaluasi_tjsl','domain_komitmen_tjsl'];
 if(['Administrator','Bappeda Provinsi','Perusahaan','Perangkat Daerah','POKJA Forum CSR'].includes(u.role))views.push('domain_rka_tjsl');
 const source=views.map(v=>'SELECT * FROM '+v).join(' UNION ALL ');
 const own=u.role==='Perusahaan'?' AND r.owner_id=?':'';
 const values:any[]=[reportYear,u.planning_year];if(own)values.push(u.id);
 return (await all(`SELECT r.*,u.name AS owner_name,COALESCE(c.name,u.instansi,u.name) AS company_name
 FROM (${source}) r LEFT JOIN users u ON u.id=r.owner_id LEFT JOIN perusahaan c ON c.user_id=r.owner_id LEFT JOIN usulan s ON s.id=r.usulan_id
 WHERE (r.type='rencana_tjsl' OR CAST(COALESCE(json_extract(r.payload,'$.year'),s.year,substr(COALESCE(NULLIF(json_extract(r.payload,'$.actualStart'),''),NULLIF(json_extract(r.payload,'$.start'),''),r.created),1,4)) AS INTEGER)=CASE WHEN r.type='laporan' THEN ? ELSE ? END)${own}
 ORDER BY r.created DESC,r.id DESC`,...values)).map(unpack);
}
