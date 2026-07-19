ALTER TABLE `attendance_sessions` ADD `section` text DEFAULT 'senior' NOT NULL;--> statement-breakpoint
ALTER TABLE `award_definitions` ADD `section` text DEFAULT 'senior' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `section` text DEFAULT 'senior' NOT NULL;