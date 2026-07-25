CREATE TABLE `custom_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#2878d4' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_roles_name_unique` ON `custom_roles` (`name`);--> statement-breakpoint
CREATE TABLE `stock_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_key` text NOT NULL,
	`name` text NOT NULL,
	`stock_type` text NOT NULL,
	`section` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`variant` text DEFAULT '' NOT NULL,
	`condition` text DEFAULT 'current' NOT NULL,
	`reorder_level` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_items_source_key_unique` ON `stock_items` (`source_key`);--> statement-breakpoint
CREATE TABLE `stock_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`transaction_type` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`member_id` integer,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` integer NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_custom_roles` (
	`user_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`expires_at` text,
	`assigned_by` integer NOT NULL,
	`assigned_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `role_id`)
);
