CREATE TABLE `announcement_reads` (
	`announcement_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`read_at` text NOT NULL,
	PRIMARY KEY(`announcement_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`expires_at` text,
	`created_by_user_id` integer NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	`archived_at` text,
	`archived_by` text
);
