CREATE TABLE `stock_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`actor_user_id` integer NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text NOT NULL
);
