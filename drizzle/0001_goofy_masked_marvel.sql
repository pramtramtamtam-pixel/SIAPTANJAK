CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL
);
