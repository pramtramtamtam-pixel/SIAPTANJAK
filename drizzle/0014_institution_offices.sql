CREATE TABLE IF NOT EXISTS institution_offices (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 payload TEXT NOT NULL DEFAULT '{}',
 updated TEXT NOT NULL
);
