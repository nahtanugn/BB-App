ALTER TABLE `members` ADD COLUMN `nric` text NOT NULL DEFAULT '';
ALTER TABLE `members` ADD COLUMN `birth_date` text NOT NULL DEFAULT '';
ALTER TABLE `members` ADD COLUMN `passport_photo_object_key` text NOT NULL DEFAULT '';
ALTER TABLE `members` ADD COLUMN `sensitive_verified_at` text;
ALTER TABLE `members` ADD COLUMN `sensitive_verified_by_user_id` integer;
ALTER TABLE `users` ADD COLUMN `contact_number` text NOT NULL DEFAULT '';

CREATE TABLE `presidents_badge_templates` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `layout_profile` text NOT NULL,
  `form_code` text NOT NULL,
  `object_key` text NOT NULL UNIQUE,
  `sha256` text NOT NULL,
  `file_size` integer NOT NULL,
  `page_count` integer NOT NULL,
  `active` integer NOT NULL DEFAULT 1,
  `uploaded_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`)
);
CREATE UNIQUE INDEX `presidents_badge_templates_profile_hash_idx` ON `presidents_badge_templates` (`layout_profile`,`sha256`);

CREATE TABLE `presidents_badge_settings` (
  `id` integer PRIMARY KEY CHECK (`id` = 1),
  `company_number` text NOT NULL DEFAULT '',
  `official_company_name` text NOT NULL DEFAULT '',
  `malaysian_state` text NOT NULL DEFAULT '',
  `company_stamp_object_key` text NOT NULL DEFAULT '',
  `updated_by_user_id` integer,
  `updated_at` text NOT NULL
);
CREATE TABLE `company_annual_compliance` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `reporting_year` integer NOT NULL,
  `brigade_dues_date` text NOT NULL DEFAULT '',
  `ros_return_date` text NOT NULL DEFAULT '',
  `statistics_return_date` text NOT NULL DEFAULT '',
  `updated_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL,
  UNIQUE (`reporting_year`)
);

CREATE TABLE `member_camp_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `camp_year` integer NOT NULL,
  `camp_level` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE
);
CREATE INDEX `member_camp_history_member_idx` ON `member_camp_history` (`member_id`,`camp_year`);

CREATE TABLE `presidents_badge_applications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_id` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'requested',
  `application_year` integer NOT NULL,
  `exco_meeting_date` text NOT NULL DEFAULT '',
  `owner_user_id` integer,
  `awards_officer_user_id` integer,
  `captain_user_id` integer,
  `template_id` integer,
  `include_company_stamp` integer NOT NULL DEFAULT 0,
  `notes` text NOT NULL DEFAULT '',
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `finalised_at` text,
  `submitted_at` text,
  `closed_at` text,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`),
  FOREIGN KEY (`template_id`) REFERENCES `presidents_badge_templates`(`id`)
);
CREATE INDEX `presidents_badge_applications_member_idx` ON `presidents_badge_applications` (`member_id`,`status`);

CREATE TABLE `presidents_badge_assessments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `application_id` integer NOT NULL,
  `assessor_type` text NOT NULL,
  `completion_mode` text NOT NULL DEFAULT 'web',
  `assessor_name` text NOT NULL DEFAULT '',
  `assessor_relationship` text NOT NULL DEFAULT '',
  `ratings_json` text NOT NULL DEFAULT '{}',
  `reasons_json` text NOT NULL DEFAULT '[]',
  `remarks` text NOT NULL DEFAULT '',
  `signature_object_key` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'pending',
  `submitted_at` text,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`application_id`) REFERENCES `presidents_badge_applications`(`id`) ON DELETE CASCADE,
  UNIQUE (`application_id`,`assessor_type`)
);

CREATE TABLE `presidents_badge_assessment_invitations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `assessment_id` integer NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `expires_at` text NOT NULL,
  `revoked_at` text,
  `last_accessed_at` text,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`assessment_id`) REFERENCES `presidents_badge_assessments`(`id`) ON DELETE CASCADE
);

CREATE TABLE `staff_signature_profiles` (
  `user_id` integer PRIMARY KEY NOT NULL,
  `object_key` text NOT NULL,
  `sha256` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE `presidents_badge_versions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `application_id` integer NOT NULL,
  `version_number` integer NOT NULL,
  `object_key` text NOT NULL UNIQUE,
  `sha256` text NOT NULL,
  `input_snapshot_json` text NOT NULL,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `superseded_at` text,
  FOREIGN KEY (`application_id`) REFERENCES `presidents_badge_applications`(`id`) ON DELETE CASCADE,
  UNIQUE (`application_id`,`version_number`)
);

CREATE TABLE `presidents_badge_outcomes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `application_id` integer NOT NULL,
  `outcome` text NOT NULL,
  `outcome_date` text NOT NULL,
  `reference` text NOT NULL DEFAULT '',
  `returned_document_object_key` text NOT NULL DEFAULT '',
  `confirmed_external_decision` integer NOT NULL DEFAULT 0,
  `notes` text NOT NULL DEFAULT '',
  `recorded_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`application_id`) REFERENCES `presidents_badge_applications`(`id`) ON DELETE CASCADE
);
