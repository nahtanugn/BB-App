CREATE TABLE IF NOT EXISTS `import_job_rows` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `job_id` integer NOT NULL,
  `row_number` integer NOT NULL,
  `row_json` text NOT NULL,
  `validation_json` text NOT NULL DEFAULT '[]',
  `created_at` text NOT NULL,
  FOREIGN KEY (`job_id`) REFERENCES `import_jobs` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `import_job_rows_job_idx` ON `import_job_rows` (`job_id`, `row_number`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `import_job_members` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `job_id` integer NOT NULL,
  `member_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`job_id`) REFERENCES `import_jobs` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `report_templates` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL UNIQUE,
  `description` text NOT NULL DEFAULT '',
  `datasets_json` text NOT NULL DEFAULT '[]',
  `filters_json` text NOT NULL DEFAULT '{}',
  `created_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL,
  `active` integer NOT NULL DEFAULT 1
);
