CREATE TABLE `automation_action_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dedupe_key` text NOT NULL,
	`rule_key` text NOT NULL,
	`recipient_user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`target_url` text DEFAULT '/' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`due_at` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`last_seen_run_id` integer,
	`last_notified_at` text,
	`snoozed_until` text,
	`resolved_at` text,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_action_items_dedupe_unique` ON `automation_action_items` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `automation_action_items_recipient_status_idx` ON `automation_action_items` (`recipient_user_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `automation_locks` (
	`lock_key` text PRIMARY KEY NOT NULL,
	`locked_until` text NOT NULL,
	`owner` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `automation_rules` (
	`rule_key` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`reminder_days` text DEFAULT '[3,7]' NOT NULL,
	`recipient_roles` text DEFAULT '[]' NOT NULL,
	`due_month_day` text DEFAULT '' NOT NULL,
	`updated_by` integer,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `automation_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_type` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_count` integer DEFAULT 0 NOT NULL,
	`resolved_count` integer DEFAULT 0 NOT NULL,
	`notification_count` integer DEFAULT 0 NOT NULL,
	`error_message` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `automation_schedule_runs` (
	`schedule_key` text PRIMARY KEY NOT NULL,
	`ran_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `automation_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`daily_time` text DEFAULT '08:00' NOT NULL,
	`weekly_time` text DEFAULT '08:00' NOT NULL,
	`updated_by` integer,
	`updated_at` text NOT NULL
);
