CREATE TABLE `award_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submitted_by_user_id` integer NOT NULL,
	`submitted_by_email` text NOT NULL,
	`member_name` text NOT NULL,
	`award_code` text NOT NULL,
	`award_name` text NOT NULL,
	`level` text NOT NULL,
	`evidence_url` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text
);
