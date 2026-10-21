UPDATE users SET role='Perangkat Daerah' WHERE role='POKJA Forum CSR';
--> statement-breakpoint
INSERT INTO review_usulan (id,usulan_id,stage,reviewer_id,from_status,to_status,notes,checks,created)
SELECT 'pd-auto-' || usulan.id,usulan.id,'POKJA',owner_id,status,'Disetujui POKJA Provinsi','Usulan Perangkat Daerah disetujui langsung sesuai alur akun PD sebagai POKJA.','{"automaticPD":true}',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM usulan
WHERE origin='Provinsi' AND status='Menunggu Pembahasan POKJA' AND json_extract(payload,'$.deletedAt') IS NULL AND owner_id IN (SELECT id FROM users WHERE role='Perangkat Daerah') AND EXISTS (SELECT 1 FROM dokumen WHERE usulan_id=usulan.id);
--> statement-breakpoint
UPDATE usulan SET status='Disetujui POKJA Provinsi' WHERE id IN (SELECT usulan_id FROM review_usulan WHERE id='pd-auto-' || usulan_id);

