ALTER TABLE sessions ADD COLUMN last_activity integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE audit_log ADD COLUMN ip_address text;
--> statement-breakpoint
DELETE FROM sessions;
