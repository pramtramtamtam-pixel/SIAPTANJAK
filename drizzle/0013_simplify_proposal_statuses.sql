-- Preserve the previous active status in metadata. Historical reviews remain unchanged.
UPDATE usulan SET payload=json_set(payload,'$.previousWorkflowStatus',status),status=CASE
 WHEN status='Terverifikasi' THEN 'Disetujui POKJA Provinsi'
 WHEN status IN ('Tidak disetujui POKJA Provinsi','Ditolak') THEN 'Menunggu Pembahasan POKJA'
 WHEN status='Perlu Perbaikan' AND EXISTS (SELECT 1 FROM review_usulan r WHERE r.usulan_id=usulan.id AND r.stage='POKJA' AND r.to_status='Perlu Perbaikan' AND r.created=(SELECT MAX(created) FROM review_usulan WHERE usulan_id=usulan.id)) THEN 'Menunggu Pembahasan POKJA'
 WHEN status='Perlu Perbaikan' AND origin='Provinsi' THEN 'Draft'
 ELSE 'Menunggu Verifikasi Bappeda Provinsi' END
WHERE status IN ('Belum diverifikasi','Dalam Verifikasi Bappeda','Diajukan','Dalam Verifikasi','Perlu Perbaikan','Tidak disetujui POKJA Provinsi','Ditolak','Terverifikasi');
