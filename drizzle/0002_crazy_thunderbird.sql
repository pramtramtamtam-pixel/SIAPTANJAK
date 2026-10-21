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
--> statement-breakpoint
CREATE INDEX `idx_keputusan_usulan` ON `keputusan_perusahaan` (`usulan_id`);--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX `idx_review_usulan` ON `review_usulan` (`usulan_id`);--> statement-breakpoint
CREATE TABLE `usulan_program` (
	`usulan_id` text NOT NULL,
	`program_id` text NOT NULL,
	FOREIGN KEY (`usulan_id`) REFERENCES `usulan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `master`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_usulan_program` ON `usulan_program` (`usulan_id`);--> statement-breakpoint
CREATE TABLE `usulan_sdgs` (
	`usulan_id` text NOT NULL,
	`goal` integer NOT NULL,
	FOREIGN KEY (`usulan_id`) REFERENCES `usulan`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_usulan_sdgs` ON `usulan_sdgs` (`usulan_id`);--> statement-breakpoint
ALTER TABLE `dokumen` ADD `category` text DEFAULT 'Data dukung lainnya' NOT NULL;--> statement-breakpoint
ALTER TABLE `dokumen` ADD `extension` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `dokumen` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `dokumen` ADD `sha256` text;--> statement-breakpoint
CREATE INDEX `idx_dokumen_usulan` ON `dokumen` (`usulan_id`);--> statement-breakpoint
ALTER TABLE `usulan` ADD `origin` text DEFAULT 'Kab/Kota' NOT NULL;--> statement-breakpoint
ALTER TABLE `usulan` ADD `musrenbang_year` integer;--> statement-breakpoint
ALTER TABLE `usulan` ADD `musrenbang_reference` text;--> statement-breakpoint
ALTER TABLE `usulan` ADD `funding_clear` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `usulan` ADD `pokja_assigned_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `usulan` ADD `committed_amount` real;--> statement-breakpoint
ALTER TABLE `usulan` ADD `actual_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_usulan_origin_status` ON `usulan` (`origin`,`status`);