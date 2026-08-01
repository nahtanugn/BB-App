CREATE TABLE `company_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `event_date` text NOT NULL,
  `end_date` text,
  `location` text DEFAULT '' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `section` text DEFAULT 'all' NOT NULL,
  `attendance_session_id` integer,
  `created_by_user_id` integer NOT NULL,
  `created_by_name` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `cancelled_at` text
);
--> statement-breakpoint
CREATE TABLE `event_rsvps` (
  `event_id` integer NOT NULL,
  `member_id` integer NOT NULL,
  `status` text DEFAULT 'going' NOT NULL,
  `note` text DEFAULT '' NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY(`event_id`, `member_id`),
  FOREIGN KEY (`event_id`) REFERENCES `company_events`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member_goals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `title` text NOT NULL,
  `category` text DEFAULT 'Personal' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `company_events_section_date_idx` ON `company_events` (`section`,`event_date`);
--> statement-breakpoint
CREATE INDEX `member_goals_member_status_idx` ON `member_goals` (`member_id`,`status`);
