CREATE TABLE email_settings (
 id TEXT PRIMARY KEY CHECK(id='registration'),
 payload TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 updated_by TEXT REFERENCES users(id),
 updated TEXT NOT NULL
);
ALTER TABLE email_outbox ADD COLUMN subject TEXT;
