ALTER TABLE `company_events` ADD COLUMN `audience` text NOT NULL DEFAULT 'section_members';
--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD COLUMN `audience` text NOT NULL DEFAULT 'section_members';
