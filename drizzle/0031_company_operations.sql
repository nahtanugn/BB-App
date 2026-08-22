CREATE TABLE IF NOT EXISTS `parade_templates` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `section` text NOT NULL DEFAULT 'senior',
  `squad` text NOT NULL DEFAULT '',
  `notes` text NOT NULL DEFAULT '',
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `parade_template_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `template_id` integer NOT NULL,
  `position` integer NOT NULL DEFAULT 0,
  `activity` text NOT NULL,
  `starts_at` text NOT NULL DEFAULT '',
  `ends_at` text NOT NULL DEFAULT '',
  `location` text NOT NULL DEFAULT '',
  `person_in_charge` text NOT NULL DEFAULT '',
  `notes` text NOT NULL DEFAULT '',
  FOREIGN KEY (`template_id`) REFERENCES `parade_templates` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `parade_plans` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer,
  `template_id` integer,
  `title` text NOT NULL,
  `plan_date` text NOT NULL,
  `section` text NOT NULL DEFAULT 'senior',
  `squad` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'draft',
  `locked_at` text,
  `published_at` text,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`event_id`) REFERENCES `company_events` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`template_id`) REFERENCES `parade_templates` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `parade_plan_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `plan_id` integer NOT NULL,
  `position` integer NOT NULL DEFAULT 0,
  `activity` text NOT NULL,
  `starts_at` text NOT NULL DEFAULT '',
  `ends_at` text NOT NULL DEFAULT '',
  `location` text NOT NULL DEFAULT '',
  `person_in_charge` text NOT NULL DEFAULT '',
  `notes` text NOT NULL DEFAULT '',
  FOREIGN KEY (`plan_id`) REFERENCES `parade_plans` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `parade_plans_scope_date_idx` ON `parade_plans` (`section`, `squad`, `plan_date`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `duty_types` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL UNIQUE COLLATE NOCASE,
  `description` text NOT NULL DEFAULT '',
  `active` integer NOT NULL DEFAULT 1,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `duty_assignments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer,
  `duty_type_id` integer NOT NULL,
  `member_id` integer,
  `section` text NOT NULL,
  `squad` text NOT NULL DEFAULT '',
  `starts_at` text NOT NULL,
  `ends_at` text,
  `status` text NOT NULL DEFAULT 'assigned',
  `availability_note` text NOT NULL DEFAULT '',
  `substituted_from_member_id` integer,
  `notes` text NOT NULL DEFAULT '',
  `assigned_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`event_id`) REFERENCES `company_events` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`duty_type_id`) REFERENCES `duty_types` (`id`),
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `duty_assignments_scope_status_idx` ON `duty_assignments` (`section`, `squad`, `status`, `starts_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL,
  `member_id` integer NOT NULL,
  `reason` text NOT NULL,
  `attachment_document_id` integer,
  `status` text NOT NULL DEFAULT 'pending_squad',
  `squad_review_status` text NOT NULL DEFAULT 'pending',
  `squad_reviewer_user_id` integer,
  `squad_reviewed_at` text,
  `final_reviewer_user_id` integer,
  `final_reviewed_at` text,
  `reviewer_notes` text NOT NULL DEFAULT '',
  `attendance_conflict` integer NOT NULL DEFAULT 0,
  `submitted_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `withdrawn_at` text,
  FOREIGN KEY (`event_id`) REFERENCES `company_events` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`attachment_document_id`) REFERENCES `member_documents` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `leave_request_active_unique` ON `leave_requests` (`event_id`, `member_id`) WHERE `withdrawn_at` IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `promotion_rules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `section` text NOT NULL,
  `target_rank` text NOT NULL,
  `minimum_attendance_percent` integer NOT NULL DEFAULT 0,
  `required_awards_json` text NOT NULL DEFAULT '[]',
  `required_training_json` text NOT NULL DEFAULT '[]',
  `minimum_service_hours` real NOT NULL DEFAULT 0,
  `officer_assessment_required` integer NOT NULL DEFAULT 0,
  `active` integer NOT NULL DEFAULT 1,
  `updated_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `promotion_rule_rank_unique` ON `promotion_rules` (`section`, `target_rank`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `promotion_waivers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `promotion_rule_id` integer NOT NULL,
  `requirement_key` text NOT NULL,
  `reason` text NOT NULL,
  `waived_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`promotion_rule_id`) REFERENCES `promotion_rules` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `promotion_waiver_unique` ON `promotion_waivers` (`member_id`, `promotion_rule_id`, `requirement_key`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `promotion_decisions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `promotion_rule_id` integer NOT NULL,
  `decision` text NOT NULL,
  `assessment_notes` text NOT NULL DEFAULT '',
  `decided_by_user_id` integer NOT NULL,
  `decided_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`promotion_rule_id`) REFERENCES `promotion_rules` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `service_hour_submissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `activity` text NOT NULL,
  `service_date` text NOT NULL,
  `duration_minutes` integer NOT NULL,
  `category` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `evidence_document_id` integer,
  `status` text NOT NULL DEFAULT 'pending_squad',
  `squad_reviewer_user_id` integer,
  `squad_reviewed_at` text,
  `squad_review_notes` text NOT NULL DEFAULT '',
  `final_reviewer_user_id` integer,
  `final_reviewed_at` text,
  `final_review_notes` text NOT NULL DEFAULT '',
  `submitted_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`evidence_document_id`) REFERENCES `member_documents` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `service_hours_member_status_idx` ON `service_hour_submissions` (`member_id`, `status`, `service_date`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `band_profiles` (
  `member_id` integer PRIMARY KEY NOT NULL,
  `instrument_section` text NOT NULL DEFAULT '',
  `proficiency` text NOT NULL DEFAULT '',
  `position` text NOT NULL DEFAULT '',
  `active` integer NOT NULL DEFAULT 1,
  `notes` text NOT NULL DEFAULT '',
  `updated_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `band_instruments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `instrument_section` text NOT NULL,
  `serial_number` text NOT NULL UNIQUE,
  `condition` text NOT NULL DEFAULT 'serviceable',
  `current_holder_member_id` integer,
  `issued_at` text,
  `due_at` text,
  `maintenance_due_at` text,
  `notes` text NOT NULL DEFAULT '',
  `active` integer NOT NULL DEFAULT 1,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`current_holder_member_id`) REFERENCES `members` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `band_instrument_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `instrument_id` integer NOT NULL,
  `member_id` integer,
  `action` text NOT NULL,
  `condition_before` text,
  `condition_after` text,
  `notes` text NOT NULL DEFAULT '',
  `performed_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`instrument_id`) REFERENCES `band_instruments` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `band_rehearsals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `rehearsal_date` text NOT NULL,
  `location` text NOT NULL DEFAULT '',
  `notes` text NOT NULL DEFAULT '',
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `band_rehearsal_attendance` (
  `rehearsal_id` integer NOT NULL,
  `member_id` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'unmarked',
  `updated_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`rehearsal_id`, `member_id`),
  FOREIGN KEY (`rehearsal_id`) REFERENCES `band_rehearsals` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `band_performances` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `performance_date` text NOT NULL,
  `location` text NOT NULL DEFAULT '',
  `notes` text NOT NULL DEFAULT '',
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `band_proficiency_assessments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `proficiency` text NOT NULL,
  `result` text NOT NULL,
  `assessed_at` text NOT NULL,
  `notes` text NOT NULL DEFAULT '',
  `assessed_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `emergency_sessions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `event_id` integer,
  `section` text NOT NULL DEFAULT 'all',
  `status` text NOT NULL DEFAULT 'active',
  `started_by_user_id` integer NOT NULL,
  `started_at` text NOT NULL,
  `closed_by_user_id` integer,
  `closed_at` text,
  FOREIGN KEY (`event_id`) REFERENCES `company_events` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `emergency_responses` (
  `session_id` integer NOT NULL,
  `member_id` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'unknown',
  `notes` text NOT NULL DEFAULT '',
  `updated_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`session_id`, `member_id`),
  FOREIGN KEY (`session_id`) REFERENCES `emergency_sessions` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `event_committees` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer,
  `name` text NOT NULL,
  `section` text NOT NULL DEFAULT 'all',
  `squad` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'active',
  `notes` text NOT NULL DEFAULT '',
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`event_id`) REFERENCES `company_events` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `committee_members` (
  `committee_id` integer NOT NULL,
  `member_id` integer NOT NULL,
  `role` text NOT NULL DEFAULT 'Member',
  `created_at` text NOT NULL,
  PRIMARY KEY (`committee_id`, `member_id`),
  FOREIGN KEY (`committee_id`) REFERENCES `event_committees` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `committee_tasks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `committee_id` integer NOT NULL,
  `title` text NOT NULL,
  `assigned_member_id` integer,
  `deadline` text,
  `status` text NOT NULL DEFAULT 'open',
  `notes` text NOT NULL DEFAULT '',
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`committee_id`) REFERENCES `event_committees` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`assigned_member_id`) REFERENCES `members` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `committee_tasks_status_deadline_idx` ON `committee_tasks` (`status`, `deadline`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `operations_idempotency_keys` (
  `request_key` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `action` text NOT NULL,
  `created_at` text NOT NULL
);
