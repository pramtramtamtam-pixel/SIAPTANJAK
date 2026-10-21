ALTER TABLE sessions ADD COLUMN planning_year integer;
--> statement-breakpoint
CREATE TABLE planning_schedules (id text PRIMARY KEY NOT NULL,year integer NOT NULL,phase integer NOT NULL,opens text NOT NULL,closes text NOT NULL,enabled integer NOT NULL DEFAULT 0,updated_by text NOT NULL REFERENCES users(id),updated text NOT NULL,UNIQUE(year,phase));
--> statement-breakpoint
CREATE TABLE proposal_revisions (id text PRIMARY KEY NOT NULL,usulan_id text NOT NULL REFERENCES usulan(id),year integer NOT NULL,phase integer,action text NOT NULL,actor_id text NOT NULL REFERENCES users(id),snapshot text NOT NULL,created text NOT NULL);
--> statement-breakpoint
CREATE INDEX idx_proposal_revisions_year_phase ON proposal_revisions(year,phase);
--> statement-breakpoint
CREATE TABLE robot_challenges (id text PRIMARY KEY NOT NULL,answer_hash text NOT NULL,ip_hash text NOT NULL,expires integer NOT NULL,created integer NOT NULL);
--> statement-breakpoint
CREATE INDEX idx_robot_ip_created ON robot_challenges(ip_hash,created);
--> statement-breakpoint
CREATE TABLE email_confirmations (id text PRIMARY KEY NOT NULL,user_id text NOT NULL REFERENCES users(id),token_hash text NOT NULL UNIQUE,expires integer NOT NULL,confirmed text,created text NOT NULL);
--> statement-breakpoint
CREATE TABLE nib_lookups (id text PRIMARY KEY NOT NULL,nib text NOT NULL,data text NOT NULL,expires integer NOT NULL,created text NOT NULL);
