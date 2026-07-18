CREATE TABLE `attendance_records` (
	`session_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`status` text DEFAULT 'unmarked' NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`session_id`, `member_id`),
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meeting_date` text NOT NULL,
	`title` text DEFAULT 'Weekly Parade' NOT NULL,
	`created_at` text NOT NULL
);
