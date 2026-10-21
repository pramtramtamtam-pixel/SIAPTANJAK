ALTER TABLE users ADD COLUMN deleted_at TEXT;
CREATE TABLE audit_log_archive (id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, entity TEXT, created TEXT NOT NULL, ip_address TEXT, archived_at TEXT NOT NULL, archived_by TEXT NOT NULL, batch_id TEXT NOT NULL);
CREATE INDEX audit_archive_batch ON audit_log_archive(batch_id);
