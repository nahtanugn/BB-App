CREATE TABLE `band_subscriptions` (
	`member_id` integer NOT NULL,
	`year` integer NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`member_id`, `year`),
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `members` ADD `band_member` integer DEFAULT false NOT NULL;