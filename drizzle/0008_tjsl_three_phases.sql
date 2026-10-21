ALTER TABLE planning_schedules RENAME TO planning_schedules_legacy;
--> statement-breakpoint
CREATE TABLE planning_schedules (id text PRIMARY KEY NOT NULL,year integer NOT NULL,phase integer NOT NULL CHECK(phase BETWEEN 0 AND 2),opens text NOT NULL,closes text NOT NULL,enabled integer NOT NULL DEFAULT 0,updated_by text NOT NULL REFERENCES users(id),updated text NOT NULL,UNIQUE(year,phase));
--> statement-breakpoint
CREATE TABLE planning_events (year integer PRIMARY KEY NOT NULL,payload text NOT NULL,updated_by text NOT NULL REFERENCES users(id),updated text NOT NULL);
--> statement-breakpoint
ALTER TABLE proposal_revisions ADD COLUMN workflow_version integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE INDEX idx_revision_workflow_phase ON proposal_revisions(year,workflow_version,phase);
--> statement-breakpoint
UPDATE users SET role='Perangkat Daerah' WHERE role='POKJA Forum CSR';
