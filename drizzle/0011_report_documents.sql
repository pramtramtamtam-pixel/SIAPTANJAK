CREATE TABLE report_documents (id TEXT PRIMARY KEY,report_id TEXT NOT NULL REFERENCES records(id),owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',sha256 TEXT NOT NULL,created TEXT NOT NULL);
CREATE INDEX report_documents_report ON report_documents(report_id,created);
CREATE UNIQUE INDEX report_documents_duplicate ON report_documents(report_id,category,sha256);
