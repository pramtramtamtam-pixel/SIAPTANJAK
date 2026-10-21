import { all, one, db, uid, now, assert, validText, hash, audit } from './server';
import { roles } from './data';
/** Save the account and its company profile together, after validating all input. */
type UserWriteInput={action?:string;confirm?:boolean;name?:string;email?:string;username?:string;password?:string;role:string;instansi?:string;wilayah?:string;bidang?:string;active?:boolean};
export async function handleUserWrite(actor: {id:string;role:string}, id: string | undefined, input: UserWriteInput) {
    assert(actor.role === 'Administrator', 'Hanya administrator yang dapat mengelola pengguna.', 403);
    const b = { ...input }, old = id ? await one('SELECT * FROM users WHERE id=? AND deleted_at IS NULL', id) : null;
    if (id)
        assert(old, 'Akun tidak ditemukan', 404);
    assert(b.action === undefined || b.action === 'delete', 'Tindakan pengguna tidak valid');
    if (b.action === 'delete') {
        assert(b.confirm === true, 'Konfirmasi penghapusan wajib diberikan');
        assert(id !== actor.id, 'Akun yang sedang digunakan tidak dapat dihapus.');
        const saved = await db().batch([
            db().prepare("UPDATE users SET active=0,deleted_at=? WHERE id=? AND deleted_at IS NULL AND (role<>'Administrator' OR active<>1 OR (SELECT COUNT(*) FROM users WHERE role='Administrator' AND active=1 AND deleted_at IS NULL)>1)").bind(now(), id),
            db().prepare("UPDATE perusahaan SET status='Nonaktif' WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND deleted_at IS NOT NULL)").bind(id, id),
            db().prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND deleted_at IS NOT NULL)').bind(id, id)
        ]);
        assert(saved[0].meta.changes === 1, 'Administrator aktif terakhir tidak dapat dihapus.');
        await audit(actor, 'Hapus pengguna (arsip)', id!);
        return Response.json({ ok: true });
    }
    assert(roles.includes(b.role), 'Role tidak valid');
    const name = validText(b.name, 'Nama', 120), instansi = validText(b.instansi, 'Instansi', 200);
    const username = String(b.username || '').trim().toLowerCase();
    const email = String(b.email || '').trim().toLowerCase() || old?.email || ('user-' + uid() + '@akun-siaptanjak.invalid');
    assert(username || b.email || old?.email, 'Isi username jika email dikosongkan.');
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Isi alamat email lengkap.');
    assert(!username || /^[a-z0-9._-]{3,40}$/.test(username) || username.length <= 180 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username), 'Username harus alamat email atau 3–40 huruf, angka, titik, garis bawah atau tanda hubung');
    for (const login of [email, username].filter(Boolean))
        assert(!await one('SELECT id FROM users WHERE (email=? OR username=?) AND id<>?', login, login, id || ''), 'Email atau username sudah digunakan', 409);
    if (!old || b.password)
        assert(typeof b.password === 'string' && b.password.length >= 8, 'Kata sandi minimal 8 karakter');
    const password = b.password ? await hash(b.password) : old.password, accountId = id || uid(), active = b.active ? 1 : 0;
    const statements = old ? [
        db().prepare("UPDATE users SET name=?,role=?,instansi=?,wilayah=?,bidang=?,active=?,email=?,username=?,password=? WHERE id=? AND deleted_at IS NULL AND (role<>'Administrator' OR active<>1 OR (?='Administrator' AND ?=1) OR (SELECT COUNT(*) FROM users WHERE role='Administrator' AND active=1 AND deleted_at IS NULL)>1)").bind(name, b.role, instansi, b.wilayah || '', b.bidang || '', active, email, username || null, password, accountId, b.role, active)
    ] : [db().prepare('INSERT INTO users(id,name,email,password,role,instansi,wilayah,bidang,active,username) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(accountId, name, email, password, b.role, instansi, b.wilayah || '', b.bidang || '', active, username || null)];
    const company = await one('SELECT * FROM perusahaan WHERE user_id=?', accountId);
    if (b.role === 'Perusahaan') {
        const status = active ? 'Disetujui' : 'Nonaktif';
        statements.push(company ? db().prepare('UPDATE perusahaan SET name=?,status=? WHERE id=? AND changes()=1').bind(instansi, status, company.id) : db().prepare("INSERT INTO perusahaan(id,user_id,name,jenis,status,payload) SELECT ?,?,?,'Swasta',?,? WHERE changes()=1").bind(uid(), accountId, instansi, status, JSON.stringify({ contact: name, email: email.endsWith('.invalid') ? '' : email })));
    }
    else if (company)
        statements.push(db().prepare("UPDATE perusahaan SET status='Nonaktif' WHERE user_id=? AND changes()=1").bind(accountId));
    if (old && (b.password || old.role !== b.role || old.active !== active || old.wilayah !== (b.wilayah || '') || old.bidang !== (b.bidang || '')))
        statements.push(db().prepare('DELETE FROM sessions WHERE user_id=?').bind(accountId));
    const saved = await db().batch(statements);
    assert(saved[0].meta.changes === 1, 'Administrator aktif terakhir tidak dapat dinonaktifkan.');
    await audit(actor, old ? 'Ubah pengguna' : 'Tambah pengguna', accountId);
    return Response.json({ ok: true, id: accountId }, { headers: { 'Cache-Control': 'no-store' } });
}
