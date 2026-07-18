CREATE TABLE `resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`url` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
