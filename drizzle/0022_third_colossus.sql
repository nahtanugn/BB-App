CREATE TABLE `privacy_notice_versions` (
	`version` integer PRIMARY KEY NOT NULL,
	`notice_text` text NOT NULL,
	`require_reacknowledgement` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` text NOT NULL
);
