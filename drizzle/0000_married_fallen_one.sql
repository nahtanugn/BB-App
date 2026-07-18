CREATE TABLE `award_definitions` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`sort_order` integer NOT NULL,
	`basic_available` integer DEFAULT true NOT NULL,
	`advanced_available` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_awards` (
	`member_id` integer NOT NULL,
	`award_code` text NOT NULL,
	`level` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`awarded_at` text,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`member_id`, `award_code`, `level`),
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`award_code`) REFERENCES `award_definitions`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`rank` text DEFAULT 'Private' NOT NULL,
	`squad` text DEFAULT 'Unassigned' NOT NULL,
	`joined_at` text NOT NULL,
	`service_years` integer DEFAULT 0 NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
