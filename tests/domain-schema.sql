CREATE TABLE `assessment_history` (
 `id` text PRIMARY KEY NOT NULL,
 `assessment_id` text NOT NULL REFERENCES `company_assessments`(`id`),
 `actor_id` text NOT NULL REFERENCES `users`(`id`),
 `action` text NOT NULL,
 `snapshot` text NOT NULL,
 `created` text NOT NULL
);
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`created` text NOT NULL, ip_address text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE audit_log_archive (id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, entity TEXT, created TEXT NOT NULL, ip_address TEXT, archived_at TEXT NOT NULL, archived_by TEXT NOT NULL, batch_id TEXT NOT NULL);
CREATE TABLE commitment_ba(id TEXT PRIMARY KEY,usulan_id TEXT NOT NULL REFERENCES usulan(id),company_id TEXT NOT NULL REFERENCES perusahaan(id),decision_id TEXT NOT NULL REFERENCES keputusan_perusahaan(id),owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,size INTEGER NOT NULL,created TEXT NOT NULL);
CREATE TABLE `company_assessments` (
 `id` text PRIMARY KEY NOT NULL,
 `company_id` text NOT NULL REFERENCES `perusahaan`(`id`),
 `year` integer NOT NULL,
 `status` text DEFAULT 'Draft' NOT NULL,
 `total` real DEFAULT 0 NOT NULL,
 `grade` text DEFAULT 'D' NOT NULL,
 `payload` text NOT NULL,
 `version` integer DEFAULT 1 NOT NULL,
 `updated_by` text NOT NULL REFERENCES `users`(`id`),
 `updated` text NOT NULL,
 UNIQUE(`company_id`,`year`)
);
CREATE TABLE company_logos(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created TEXT NOT NULL);
CREATE TABLE `dokumen` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`usulan_id` text,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL, `category` text DEFAULT 'Data dukung lainnya' NOT NULL, `extension` text DEFAULT '' NOT NULL, `description` text DEFAULT '' NOT NULL, `sha256` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usulan_id`) REFERENCES `usulan`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE email_confirmations (id text PRIMARY KEY NOT NULL,user_id text NOT NULL REFERENCES users(id),token_hash text NOT NULL UNIQUE,expires integer NOT NULL,confirmed text,created text NOT NULL);
CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL
);
CREATE TABLE homepage_assets(id text PRIMARY KEY NOT NULL,name text NOT NULL,mime text NOT NULL,size integer NOT NULL,user_id text NOT NULL REFERENCES users(id),created text NOT NULL);
CREATE TABLE homepage_content(id text PRIMARY KEY NOT NULL,payload text NOT NULL CHECK(json_valid(payload)),version integer NOT NULL DEFAULT 1,updated_by text REFERENCES users(id),updated text NOT NULL);
CREATE TABLE homepage_revisions(id text PRIMARY KEY NOT NULL,user_id text NOT NULL REFERENCES users(id),version integer NOT NULL UNIQUE,payload text NOT NULL CHECK(json_valid(payload)),created text NOT NULL);
CREATE TABLE `keputusan_perusahaan` (
	`id` text PRIMARY KEY NOT NULL,
	`usulan_id` text NOT NULL,
	`company_id` text NOT NULL,
	`decision` text NOT NULL,
	`amount` real,
	`full_output` integer DEFAULT 0 NOT NULL,
	`full_beneficiaries` integer DEFAULT 0 NOT NULL,
	`notes` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`usulan_id`) REFERENCES `usulan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `perusahaan`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE lighthouse_migrations(name TEXT PRIMARY KEY, applied TEXT NOT NULL);
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until` integer NOT NULL
);
CREATE TABLE `master` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
CREATE TABLE nib_lookups (id text PRIMARY KEY NOT NULL,nib text NOT NULL,data text NOT NULL,expires integer NOT NULL,created text NOT NULL);
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `perusahaan` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`jenis` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE planning_events (year integer PRIMARY KEY NOT NULL,payload text NOT NULL,updated_by text NOT NULL REFERENCES users(id),updated text NOT NULL);
CREATE TABLE planning_schedules (id text PRIMARY KEY NOT NULL,year integer NOT NULL,phase integer NOT NULL CHECK(phase BETWEEN 0 AND 2),opens text NOT NULL,closes text NOT NULL,enabled integer NOT NULL DEFAULT 0,updated_by text NOT NULL REFERENCES users(id),updated text NOT NULL,UNIQUE(year,phase));
CREATE TABLE "planning_schedules_legacy" (id text PRIMARY KEY NOT NULL,year integer NOT NULL,phase integer NOT NULL,opens text NOT NULL,closes text NOT NULL,enabled integer NOT NULL DEFAULT 0,updated_by text NOT NULL REFERENCES users(id),updated text NOT NULL,UNIQUE(year,phase));
CREATE TABLE proposal_revisions (id text PRIMARY KEY NOT NULL,usulan_id text NOT NULL REFERENCES usulan(id),year integer NOT NULL,phase integer,action text NOT NULL,actor_id text NOT NULL REFERENCES users(id),snapshot text NOT NULL,created text NOT NULL, workflow_version integer NOT NULL DEFAULT 1);
CREATE TABLE `rapat_pokja` (
	`id` text PRIMARY KEY NOT NULL,
	`pokja` text NOT NULL,
	`date` text NOT NULL,
	`forum` text NOT NULL,
	`chair` text NOT NULL,
	`secretary` text NOT NULL,
	`members` text NOT NULL,
	`minutes` text NOT NULL,
	`created_by` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`owner_id` text,
	`usulan_id` text,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usulan_id`) REFERENCES `usulan`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE report_documents (id TEXT PRIMARY KEY,report_id TEXT NOT NULL REFERENCES records(id),owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',sha256 TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE `review_usulan` (
	`id` text PRIMARY KEY NOT NULL,
	`usulan_id` text NOT NULL,
	`stage` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`meeting_id` text,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`notes` text NOT NULL,
	`checks` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`usulan_id`) REFERENCES `usulan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`meeting_id`) REFERENCES `rapat_pokja`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE robot_challenges (id text PRIMARY KEY NOT NULL,answer_hash text NOT NULL,ip_hash text NOT NULL,expires integer NOT NULL,created integer NOT NULL);
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL, planning_year integer, last_activity integer NOT NULL DEFAULT 0,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE user_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),signer_name TEXT NOT NULL DEFAULT '',signer_nip TEXT NOT NULL DEFAULT '',signer_position TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',updated TEXT NOT NULL,pic_name TEXT NOT NULL DEFAULT '');
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text NOT NULL,
	`instansi` text NOT NULL,
	`wilayah` text NOT NULL,
	`bidang` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
, deleted_at TEXT, username TEXT);
CREATE TABLE `usulan` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`title` text NOT NULL,
	`bidang` text NOT NULL,
	`wilayah` text NOT NULL,
	`year` integer NOT NULL,
	`budget` real NOT NULL,
	`status` text NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`company_id` text,
	`payload` text NOT NULL,
	`created` text NOT NULL, `origin` text DEFAULT 'Kab/Kota' NOT NULL, `musrenbang_year` integer, `musrenbang_reference` text, `funding_clear` integer DEFAULT 0 NOT NULL, `pokja_assigned_by` text REFERENCES users(id), `committed_amount` real, `actual_amount` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `perusahaan`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `usulan_program` (
	`usulan_id` text NOT NULL,
	`program_id` text NOT NULL,
	FOREIGN KEY (`usulan_id`) REFERENCES `usulan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `master`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `usulan_sdgs` (
	`usulan_id` text NOT NULL,
	`goal` integer NOT NULL,
	FOREIGN KEY (`usulan_id`) REFERENCES `usulan`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE VIEW domain_evaluasi_tjsl AS SELECT * FROM records WHERE type='evaluasi';
CREATE VIEW domain_komitmen_tjsl AS SELECT * FROM records WHERE type='komitmen';
CREATE VIEW domain_pelaporan_tjsl AS SELECT * FROM records WHERE type='laporan';
CREATE VIEW domain_rka_tjsl AS SELECT * FROM records WHERE type='rencana_tjsl';
CREATE VIEW domain_usulan_tjsl AS SELECT * FROM usulan;
CREATE TABLE IF NOT EXISTS institution_offices(user_id TEXT PRIMARY KEY REFERENCES users(id),payload TEXT NOT NULL DEFAULT '{}',updated TEXT NOT NULL);

CREATE TABLE email_settings(id TEXT PRIMARY KEY,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_by TEXT,updated TEXT NOT NULL);
ALTER TABLE email_outbox ADD COLUMN subject TEXT;

ALTER TABLE dokumen ADD COLUMN external_url TEXT;
ALTER TABLE report_documents ADD COLUMN external_url TEXT;
