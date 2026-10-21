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
--> statement-breakpoint
CREATE TABLE `assessment_history` (
 `id` text PRIMARY KEY NOT NULL,
 `assessment_id` text NOT NULL REFERENCES `company_assessments`(`id`),
 `actor_id` text NOT NULL REFERENCES `users`(`id`),
 `action` text NOT NULL,
 `snapshot` text NOT NULL,
 `created` text NOT NULL
);
