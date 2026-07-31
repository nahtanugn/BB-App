CREATE TABLE `app_settings` (
	`setting_key` text PRIMARY KEY NOT NULL,
	`setting_value` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` integer,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `onboarding_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`subject_user_id` integer,
	`subject_member_id` integer,
	`actor_user_id` integer,
	`actor_name` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile_correction_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`proposed_values` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_notes` text DEFAULT '' NOT NULL,
	`reviewed_by` integer,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `registration_details` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`section` text NOT NULL,
	`squad` text NOT NULL,
	`joined_year` text NOT NULL,
	`school` text NOT NULL,
	`contact_number` text NOT NULL,
	`emergency_contact_number` text NOT NULL,
	`parents_name` text NOT NULL,
	`suggested_member_id` integer,
	`review_notes` text DEFAULT '' NOT NULL,
	`reviewed_by` integer,
	`reviewed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `account_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `must_change_password` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_completed_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_confirmed_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `tour_completed_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `privacy_notice_version` integer DEFAULT 0 NOT NULL;