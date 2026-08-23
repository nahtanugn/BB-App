ALTER TABLE `members` ADD COLUMN `gender` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `members` ADD COLUMN `ethnicity` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `members` ADD COLUMN `accepted_christ` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `members` ADD COLUMN `baptised` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `members` ADD COLUMN `officer_work_status` text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `company_statistics` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `reporting_year` integer NOT NULL UNIQUE,
  `status` text NOT NULL DEFAULT 'draft',
  `locked_at` text,
  `locked_by_user_id` integer,
  `captain_name` text NOT NULL DEFAULT '',
  `chaplain_name` text NOT NULL DEFAULT '',
  `submission_date` text NOT NULL DEFAULT '',
  `received_by` text NOT NULL DEFAULT '',
  `date_received` text NOT NULL DEFAULT '',
  `data_entry_name` text NOT NULL DEFAULT '',
  `remarks` text NOT NULL DEFAULT '',
  `notes` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `company_statistics_inputs` (
  `statistics_id` integer PRIMARY KEY NOT NULL,
  `payload` text NOT NULL DEFAULT '{}',
  `updated_at` text NOT NULL,
  FOREIGN KEY (`statistics_id`) REFERENCES `company_statistics` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `company_statistics_member_status` (
  `statistics_id` integer NOT NULL,
  `member_id` integer NOT NULL,
  `membership_status` text NOT NULL DEFAULT 'continuing',
  `category_override` text NOT NULL DEFAULT '',
  `gender_override` text NOT NULL DEFAULT '',
  `ethnicity_override` text NOT NULL DEFAULT '',
  `updated_at` text NOT NULL,
  PRIMARY KEY (`statistics_id`, `member_id`),
  FOREIGN KEY (`statistics_id`) REFERENCES `company_statistics` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `company_statistics_audit` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `statistics_id` integer NOT NULL,
  `action` text NOT NULL,
  `actor_user_id` integer NOT NULL,
  `details` text NOT NULL DEFAULT '{}',
  `created_at` text NOT NULL,
  FOREIGN KEY (`statistics_id`) REFERENCES `company_statistics` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `company_statistics_audit_stats_idx` ON `company_statistics_audit` (`statistics_id`, `created_at`);
