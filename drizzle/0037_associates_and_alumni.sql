CREATE TABLE IF NOT EXISTS `associates_and_alumni` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `classification` text NOT NULL DEFAULT 'associate_member',
  `gender` text NOT NULL DEFAULT 'M',
  `work_status` text NOT NULL DEFAULT 'working',
  `ethnicity` text NOT NULL DEFAULT '',
  `religion` text NOT NULL DEFAULT '',
  `spiritual_status` text NOT NULL DEFAULT '',
  `notes` text NOT NULL DEFAULT '',
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `associates_alumni_active_idx`
ON `associates_and_alumni` (`active`, `classification`);
