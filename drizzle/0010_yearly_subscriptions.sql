CREATE TABLE `member_subscriptions` (
	`member_id` integer NOT NULL,
	`year` integer NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`member_id`, `year`),
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
