import { validateAlignment } from './alignment';
import { isIsoDate } from './date-policy';
import { all, one, run, db, uid, now, assert, validText, audit, canSee } from './server';
import { requireReportYear, requireLinkedReportYear, requireYear, currentRevisionStatement, activePhase, isPostReportingOpen, requireWorkflowAction, workflowContext } from './planning';
import { reportProposalStatement, reopenCompletion } from './reports';
import { isDeleted } from './workflow';
import { isStandaloneReportYear } from './report-options';
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function handleRecord(u: {id:string;role:string;planning_year:number}, id: string | undefined, b: any) {
    assert(b.action === undefined || ['reopen-completion', 'delete-plan', 'plan-progress', 'delete-report', 'validate'].includes(b.action), 'Tindakan laporan tidak valid');
    if (b.type === 'rencana_tjsl')
        b.usulanId = null;
    const old = id ? await one('SELECT * FROM records WHERE id=?', id) : null;
    if (id)
        assert(old, 'Data tidak ditemukan', 404);
    if (old && ['laporan', 'rencana_tjsl'].includes(old.type)) {
        const saved = JSON.parse(old.payload || '{}');
        assert(!saved.deletedAt && !saved.cancelledAt && !saved.completionRevokedAt && !saved.replacedBy, 'Data yang diarsipkan atau dibatalkan tidak dapat diubah', 409);
    }
    const r = b.usulanId ? await one('SELECT * FROM usulan WHERE id=?', b.usulanId) : null;
    if (['rencana_tjsl', 'laporan'].includes(b.type) || ['rencana_tjsl', 'laporan'].includes(old?.type)) {
        assert(u.role === 'Perusahaan', 'Hanya perusahaan yang dapat menginput atau mengubah RKA dan laporan realisasi TJSL.', 403);
        if (old)
            assert(old.owner_id === u.id, 'Data bukan milik perusahaan Anda.', 403);
    }
    const planningPhase = (b.type === 'rencana_tjsl' || old?.type === 'rencana_tjsl') ? await requireWorkflowAction(u, 'plan') : null;
    const reportingPhase = (b.type === 'laporan' || old?.type === 'laporan') ? await requireWorkflowAction(u, 'report') : null;
    if (b.action === 'reopen-completion')
        return response(await reopenCompletion(u, id!, b));
    if (old && old.type !== 'rencana_tjsl')
        await (old.type === 'laporan' ? (old.usulan_id?requireLinkedReportYear:requireReportYear) : requireYear)(u, JSON.parse(old.payload).year || (old.usulan_id ? (await one('SELECT year FROM usulan WHERE id=?', old.usulan_id))?.year : Number(old.created.slice(0, 4))));
    if (r)
        await (b.type === 'laporan' || old?.type === 'laporan' ? requireLinkedReportYear : requireYear)(u, r.year);
    if (b.usulanId)
        assert(r && !isDeleted(r), 'Usulan tidak ditemukan', 404);
    if (old?.type === 'laporan' && !b.action)
        assert(String(b.usulanId || '') === String(old.usulan_id || ''), 'Sumber kegiatan laporan tidak dapat diubah');
    if (b.action === 'delete-plan') assert(false,'RKA yang sudah dibuat hanya dapat diedit; penghapusan tidak tersedia.',409);
    if (b.action === 'plan-progress') {
        assert(old?.type === 'rencana_tjsl' && (old.owner_id === u.id || u.role === 'Administrator'), 'Tidak berwenang mengubah rencana', 403);
        const p = JSON.parse(old.payload);
        p.workflowContext=workflowContext(u,planningPhase);
        assert(Number.isInteger(b.index) && p.tasks?.[b.index], 'Tahapan tidak ditemukan');
        p.tasks[b.index].done = !!b.done;
        const completed = p.tasks.filter((t: {done?:boolean}) => t.done).length;
        const status = completed === p.tasks.length ? 'Selesai' : completed ? 'Dalam Pelaksanaan' : 'Terencana';
        await run('UPDATE records SET payload=?,status=? WHERE id=?', JSON.stringify(p), status, id);
        await audit(u, 'Perbarui milestone proyek', id!);
        return response({ ok: true });
    }
    if (b.action === 'delete-report') {
        assert(old?.type === 'laporan' && !isDeleted(old), 'Laporan tidak ditemukan', 404);
        assert(old.owner_id === u.id || u.role === 'Administrator', 'Tidak berwenang menghapus laporan', 403);
        assert(b.confirm === true, 'Konfirmasi penghapusan wajib diberikan');
        const statements = [db().prepare("UPDATE records SET payload=json_set(payload,'$.deletedAt',?,'$.deletedBy',?) WHERE id=? AND payload=? AND owner_id=?").bind(now(), u.id, id, old.payload, old.owner_id)];
        const prior = JSON.parse(old.payload).previousReportId;
        if (prior)
            statements.push(db().prepare("UPDATE records SET payload=json_remove(payload,'$.replacedBy') WHERE id=? AND json_extract(payload,'$.replacedBy')=?").bind(prior, id));
        if (old.usulan_id) {
            const statement = await reportProposalStatement(old.usulan_id, undefined, id!, true);
            if (statement)
                statements.push(statement);
            statements.push(currentRevisionStatement(u, old.usulan_id, reportingPhase, 'Hapus laporan realisasi', true));
        }
        const deleted = await db().batch(statements);
        assert(deleted[0].meta.changes === 1, 'Laporan sudah berubah; muat ulang sebelum menghapus', 409);
        await audit(u, 'Hapus laporan realisasi (arsip)', id!);
        return response({ ok: true });
    }
    if (b.action === 'validate')
        return response({ error: 'Laporan langsung selesai; verifikasi tidak diperlukan.' }, 409);
    assert(['rencana_tjsl', 'laporan', 'evaluasi'].includes(b.type), 'Jenis tidak valid');
    if (old)
        assert(old.type === b.type, 'Jenis laporan tidak dapat diubah');
    const p = { ...(b.payload || {}) };
    if (planningPhase) {p.workflowContext=workflowContext(u,planningPhase);p.planningPhase=planningPhase.phase;p.planningPhaseVersion=2;}
    if (reportingPhase) {p.workflowContext=workflowContext(u,reportingPhase);p.planningPhase=2;p.planningPhaseVersion=2;}
    if (old?.type === 'laporan') {
        const priorPayload = JSON.parse(old.payload);
        p.previousReportId = priorPayload.previousReportId;
        p.activityId = priorPayload.activityId;
    }
    for (const key of ['deletedAt', 'deletedBy', 'cancelledAt', 'cancelledBy', 'cancellationNotes', 'completionRevokedAt', 'completionRevokedBy', 'reopeningNotes', 'replacedBy', 'seedBatch', 'demo']) {
        delete p[key];
        if (old && Object.prototype.hasOwnProperty.call(JSON.parse(old.payload || '{}'), key))
            p[key] = JSON.parse(old.payload)[key];
    }
    if (b.type === 'laporan' && r) {
        p.wilayah = r.wilayah;
        p.wilayahs = [r.wilayah];
    }
    if (['rencana_tjsl', 'laporan'].includes(b.type) && p.wilayahs !== undefined) {
        assert(Array.isArray(p.wilayahs) && p.wilayahs.length > 0 && p.wilayahs.length <= 17 && new Set(p.wilayahs).size === p.wilayahs.length, 'Pilih lokasi kegiatan yang valid');
        for (const wilayah of p.wilayahs)
            assert(await one("SELECT id FROM master WHERE type='wilayah' AND active=1 AND name=?", wilayah), 'Lokasi kegiatan tidak valid');
        assert(p.wilayahs.includes(p.wilayah), 'Lokasi utama harus termasuk wilayah kegiatan');
    }
    if (b.type === 'laporan') {
        if(r){const source=JSON.parse(r.payload||'{}');p.program=source.program||[];p.sdgs=source.sdgs||[];}else Object.assign(p,await validateAlignment(p,old?JSON.parse(old.payload||'{}'):{}));
        p.year = Number(p.year || u.planning_year);
        await (r?requireLinkedReportYear:requireReportYear)(u, p.year);
        if (!r)
            assert(isStandaloneReportYear(p.year, u.planning_year, Date.now(), await isPostReportingOpen(u.planning_year)), 'Tahun laporan belum dibuka. Pelaporan sampai Tahun Perencanaan tersedia setelah Tahap Pasca Musrenbang dibuka otomatis atau diaktifkan manual.', 403);
        if (r)
            assert(Number(r.year) === p.year, 'Tahun laporan harus sama dengan tahun kegiatan yang dikomitmenkan.');
        if (p.outputType === 'satuan') {
            assert(p.outputQuantity !== '' && Number.isFinite(Number(p.outputQuantity)) && Number(p.outputQuantity) >= 0, 'Jumlah output wajib diisi dan tidak boleh negatif');
            p.outputQuantity = Number(p.outputQuantity);
            validText(p.output, 'Satuan output', 80);
            p.outputNotes = String(p.outputNotes || '').slice(0, 1500);
        }
        p.enteredPlanningYear = Number(u.planning_year);
        if (p.previousReportId) {
            const prior = await one("SELECT * FROM records WHERE id=? AND type='laporan'", p.previousReportId);
            assert(prior, 'Kegiatan mandiri sebelumnya tidak ditemukan', 404);
            const prev = JSON.parse(prior.payload);
            assert(!prior.usulan_id && prior.owner_id === u.id && !prev.deletedAt && prev.completionRevokedAt && (!prev.replacedBy || prev.replacedBy === id), 'Kegiatan mandiri tidak dapat dilanjutkan', 409);
            assert(Number(prev.year) === p.year, 'Tahun harus sama');
            p.activityId = prev.activityId || prior.id;
        }
        else if (!old)
            delete p.activityId;
    }
    if (b.type === 'evaluasi') {
        assert(r && ['Administrator', 'Bappeda Provinsi', 'POKJA Forum CSR', 'Perangkat Daerah'].includes(u.role) && canSee(u, r), 'Tidak berwenang mengevaluasi', 403);
        for (const k of ['output', 'outcome', 'targeting', 'sustainability'])
            assert(Number(p[k]) >= 1 && Number(p[k]) <= 5, 'Skor harus 1–5');
        validText(p.recommendation, 'Rekomendasi', 3000);
    }
    else {
        assert(['Perusahaan', 'Administrator'].includes(u.role), 'Hanya perusahaan dapat melaporkan atau merencanakan', 403);
        if (u.role === 'Perusahaan') {
            const c = await one("SELECT * FROM perusahaan WHERE user_id=? AND status='Disetujui'", u.id);
            assert(c, 'Profil belum disetujui', 403);
            if (r)
                assert(r.company_id === c.id, 'Kegiatan bukan tanggung jawab perusahaan Anda', 403);
        }
        assert(Number(p.amount) >= 0 && Number(p.amount) <= 1e14, 'Anggaran tidak valid');
        if (b.type === 'laporan') {
            assert(await one("SELECT id FROM master WHERE type='wilayah' AND active=1 AND name=?", p.wilayah), 'Lokasi kegiatan wajib dipilih');
            assert(p.lat !== '' && p.lng !== '' && Number(p.lat) >= -5 && Number(p.lat) <= -1 && Number(p.lng) >= 102 && Number(p.lng) <= 107, 'Pilih titik lokasi kegiatan di Sumatera Selatan');
            p.lat = Number(p.lat);
            p.lng = Number(p.lng);
            p.kecamatan = String(p.kecamatan || '').slice(0, 250);
            p.desa = String(p.desa || '').slice(0, 250);
            if (p.actualStart || p.actualEnd)
                assert(isIsoDate(p.actualStart) && isIsoDate(p.actualEnd) && p.actualEnd >= p.actualStart, 'Tanggal realisasi tidak valid');
            if (r) {
                if (!old)
                    assert(r.status === 'Dalam Pelaksanaan', 'Kegiatan belum berjalan');
                if (!old)
                    assert(Number(p.physical) >= Number(r.progress || 0) && Number(p.amount) >= Number(JSON.parse(r.payload || '{}').actual || 0), 'Realisasi kumulatif tidak boleh turun');
                p.bidang = r.bidang;
            }
            else {
                validText(p.bidang, 'Klasifikasi POKJA', 250);
                validText(p.wilayah, 'Lokasi kegiatan', 250);
                assert(await one("SELECT id FROM master WHERE type='bidang' AND active=1 AND name=?", p.bidang), 'Klasifikasi POKJA wajib dipilih');
                assert(await one("SELECT id FROM master WHERE type='wilayah' AND active=1 AND name=?", p.wilayah), 'Lokasi kegiatan wajib dipilih');
            }
            assert([0, 33, 50, 66, 100].includes(Number(p.physical)), 'Pilih realisasi fisik 0%, 33%, 50%, 66%, atau 100%');
            if (Number(p.physical) === 100)
                assert(p.fullOutput === true && (!r || Number(p.beneficiaries) >= Number(JSON.parse(r.payload).beneficiaries)), 'Laporan akhir wajib memenuhi seluruh output dan target penerima manfaat');
            validText(p.output, 'Output tercapai', 1500);
            assert(Number(p.beneficiaries) >= 0, 'Jumlah penerima manfaat tidak valid');
        }
        else {
            assert(p.start && p.end && p.end >= p.start, 'Jadwal wajib diisi');
            assert(await one("SELECT id FROM master WHERE type='bidang' AND active=1 AND name=?", p.bidang), 'Klasifikasi POKJA wajib dipilih');
            validText(p.target, 'Target', 1000);
        }
    }
    if (b.type === 'rencana_tjsl') {
        const currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date()));
        assert(Number.isInteger(Number(p.year)) && Number(p.year) >= 1900 && Number(p.year) <= 9999 && Number(p.year) !== currentYear + 2, 'Tahun RKA tidak valid; tahun berjalan + 2 tidak diperbolehkan.');
        if(old)assert(p.bidang===JSON.parse(old.payload).bidang,'POKJA RKA yang sudah dibuat tidak dapat diganti. Gunakan Edit pada RKA POKJA terkait.',409);
        const sameOriginal=old&&Number(JSON.parse(old.payload).year)===Number(p.year)&&JSON.parse(old.payload).bidang===p.bidang;
        if(!sameOriginal)assert(!await one("SELECT id FROM records WHERE type='rencana_tjsl' AND owner_id=? AND CAST(json_extract(payload,'$.year') AS INTEGER)=? AND json_extract(payload,'$.bidang')=? AND id<>? AND json_extract(payload,'$.deletedAt') IS NULL",u.id,Number(p.year),p.bidang,id||''),'RKA untuk POKJA dan Tahun ini sudah ada. Gunakan Edit pada RKA yang tersimpan.',409);
        b.usulanId = null;
        delete p.usulanId;
        assert(!p.unit || p.unit === 'Orang', 'Satuan RKA harus Orang');
        delete p.rkpd;
        delete p.milestones;
        delete p.tasks;
        assert(isIsoDate(p.start) && isIsoDate(p.end), 'Tanggal rencana tidak valid');
    }
    if (old) {
        assert(old.owner_id === u.id || u.role === 'Administrator', 'Tidak berwenang mengubah data', 403);
        assert(old.type === b.type, 'Jenis data tidak dapat diubah');
        p.year = Number(p.year || u.planning_year);
        if (b.type === 'laporan') {
            const peers = await all("SELECT * FROM records WHERE type='laporan' AND owner_id=? AND id<>? AND json_extract(payload,'$.deletedAt') IS NULL AND json_extract(payload,'$.completionRevokedAt') IS NULL AND json_extract(payload,'$.cancelledAt') IS NULL ORDER BY created,id", u.id, id);
            const same = peers.filter(v => old.usulan_id ? v.usulan_id === old.usulan_id : !v.usulan_id && (JSON.parse(v.payload).activityId || v.id) === (JSON.parse(old.payload).activityId || old.id));
            const before = same.filter(v => v.created < old.created || v.created === old.created && v.id < old.id).at(-1), after = same.find(v => v.created > old.created || v.created === old.created && v.id > old.id);
            for (const [peer, lower] of [[before, true], [after, false]] as const) {
                if (peer) {
                    const q = JSON.parse(peer.payload);
                    assert(lower ? Number(p.physical) >= Number(q.physical) && Number(p.amount) >= Number(q.amount) : Number(p.physical) <= Number(q.physical) && Number(p.amount) <= Number(q.amount), 'Realisasi kumulatif harus berurutan terhadap laporan sebelumnya dan berikutnya', 409);
                }
            }
        }
        const statements = [db().prepare("UPDATE records SET title=?,payload=? WHERE id=? AND owner_id=? AND payload=? AND status=? AND (?='' OR EXISTS(SELECT 1 FROM usulan WHERE id=? AND company_id=? AND progress=? AND COALESCE(actual_amount,0)=? AND status=?))").bind(validText(b.title, 'Judul', 220), JSON.stringify(p), id, old.owner_id, old.payload, old.status, r?.id || '', r?.id || '', r?.company_id || '', Number(r?.progress || 0), Number(r?.actual_amount || 0), r?.status || '')];
        if (b.type === 'laporan' && old.usulan_id) {
            const sync = await reportProposalStatement(old.usulan_id, undefined, undefined, true);
            if (sync)
                statements.push(sync);
            statements.push(currentRevisionStatement(u, old.usulan_id, reportingPhase, 'Edit laporan realisasi', true));
        }
        const saved = await db().batch(statements);
        assert(saved[0].meta.changes === 1, 'Data telah berubah; muat ulang sebelum menyimpan', 409);
        await audit(u, 'Edit ' + b.type, id!);
        return response({ ok: true, id });
    }
    const recordId = uid();
    p.year = Number(p.year || u.planning_year);
    if (b.type === 'laporan')
        await (r?requireLinkedReportYear:requireReportYear)(u, p.year);
    else if (b.type !== 'rencana_tjsl')
        await requireYear(u, p.year);
    if (!['rencana_tjsl','laporan'].includes(b.type)) {
        p.planningPhase = (await activePhase(p.year))?.phase ?? null;
        p.planningPhaseVersion = 2;
    }
    const statements = [db().prepare("INSERT INTO records (id,type,owner_id,usulan_id,title,status,payload,created) SELECT ?,?,?,?,?,?,?,? WHERE (?='' OR EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(payload,'$.replacedBy') IS NULL AND json_extract(payload,'$.completionRevokedAt') IS NOT NULL)) AND (?='' OR EXISTS(SELECT 1 FROM usulan WHERE id=? AND company_id=? AND status='Dalam Pelaksanaan' AND progress=? AND COALESCE(actual_amount,0)=?)) AND (?<>'rencana_tjsl' OR NOT EXISTS(SELECT 1 FROM records WHERE type='rencana_tjsl' AND owner_id=? AND CAST(json_extract(payload,'$.year') AS INTEGER)=? AND json_extract(payload,'$.bidang')=? AND json_extract(payload,'$.deletedAt') IS NULL))").bind(recordId, b.type, u.id, b.type === 'rencana_tjsl' ? null : r?.id || null, validText(b.title, 'Judul', 220), b.type === 'rencana_tjsl' ? 'Terencana' : 'Selesai', JSON.stringify(p), now(), String(p.previousReportId || ''), String(p.previousReportId || ''), r?.id || '', r?.id || '', r?.company_id || '', Number(r?.progress || 0), Number(r?.actual_amount || 0),b.type,u.id,Number(p.year),p.bidang||'' )];
    if (p.previousReportId)
        statements.push(db().prepare("UPDATE records SET payload=json_set(payload,'$.replacedBy',?) WHERE id=? AND EXISTS(SELECT 1 FROM records WHERE id=?)").bind(recordId, p.previousReportId, recordId));
    if (b.type === 'laporan' && r) {
        const statement = await reportProposalStatement(r.id, { payload: p }, undefined, true);
        if (statement)
            statements.push(statement);
        statements.push(currentRevisionStatement(u, r.id, reportingPhase, 'Laporan realisasi', true));
    }
    const saved = await db().batch(statements);
    assert(saved[0].meta.changes === 1, 'Kegiatan telah dilaporkan pengguna lain', 409);
    await audit(u, 'Simpan ' + b.type, recordId);
    return response({ ok: true, id: recordId });
}
