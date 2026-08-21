CREATE TABLE IF NOT EXISTS `attendance_qr_codes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` integer NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `expires_at` text NOT NULL,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `attendance_qr_session_idx` ON `attendance_qr_codes` (`session_id`, `expires_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `attendance_sync_conflicts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` integer NOT NULL,
  `member_id` integer NOT NULL,
  `incoming_status` text NOT NULL,
  `existing_status` text NOT NULL,
  `incoming_updated_at` text NOT NULL,
  `existing_updated_at` text NOT NULL,
  `submitted_by_user_id` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `reviewed_by_user_id` integer,
  `reviewed_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `event_recurrence` (
  `event_id` integer PRIMARY KEY NOT NULL,
  `frequency` text NOT NULL,
  `interval` integer NOT NULL DEFAULT 1,
  `until_date` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`event_id`) REFERENCES `company_events` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `member_photos` (
  `member_id` integer PRIMARY KEY NOT NULL,
  `object_key` text NOT NULL,
  `content_type` text NOT NULL,
  `uploaded_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `consent_forms` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `consent_type` text NOT NULL,
  `version` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `signed_by` text NOT NULL DEFAULT '',
  `signed_at` text,
  `notes` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `consent_member_type_version_unique` ON `consent_forms` (`member_id`, `consent_type`, `version`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `member_documents` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `object_key` text NOT NULL UNIQUE,
  `file_name` text NOT NULL,
  `content_type` text NOT NULL,
  `size_bytes` integer NOT NULL DEFAULT 0,
  `document_type` text NOT NULL DEFAULT 'general',
  `uploaded_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `parent_invitations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `email` text NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `expires_at` text NOT NULL,
  `accepted_at` text,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `certificates` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `award_code` text NOT NULL,
  `level` text NOT NULL,
  `certificate_number` text NOT NULL UNIQUE,
  `issued_at` text NOT NULL,
  `issued_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `training_records` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `training_type` text NOT NULL,
  `title` text NOT NULL,
  `completed_at` text,
  `status` text NOT NULL DEFAULT 'completed',
  `notes` text NOT NULL DEFAULT '',
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `member_transfers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `from_section` text,
  `to_section` text,
  `from_squad` text,
  `to_squad` text,
  `from_rank` text,
  `to_rank` text,
  `reason` text NOT NULL DEFAULT '',
  `changed_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `equipment_holdings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `item_id` integer NOT NULL,
  `quantity` integer NOT NULL DEFAULT 1,
  `issued_at` text NOT NULL,
  `returned_at` text,
  `issued_by_user_id` integer NOT NULL,
  `returned_by_user_id` integer,
  `notes` text NOT NULL DEFAULT '',
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `message_threads` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `subject` text NOT NULL,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `messages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `thread_id` integer NOT NULL,
  `sender_user_id` integer NOT NULL,
  `recipient_user_id` integer NOT NULL,
  `body` text NOT NULL,
  `read_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`thread_id`) REFERENCES `message_threads` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `import_jobs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `status` text NOT NULL DEFAULT 'preview',
  `file_name` text NOT NULL,
  `summary_json` text NOT NULL DEFAULT '{}',
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `completed_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `public_content` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `content_type` text NOT NULL,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `published` integer NOT NULL DEFAULT 0,
  `updated_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL
);
