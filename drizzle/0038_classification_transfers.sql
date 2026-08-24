CREATE TABLE IF NOT EXISTS `classification_transfers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `source_type` text NOT NULL,
  `source_id` integer NOT NULL,
  `associate_id` integer NOT NULL,
  `linked_user_id` integer,
  `previous_section` text,
  `previous_rank` text,
  `previous_squad` text,
  `previous_user_role` text,
  `previous_user_active` integer,
  `previous_account_status` text,
  `target_classification` text NOT NULL,
  `effective_date` text NOT NULL,
  `reason` text NOT NULL,
  `created_by` integer NOT NULL,
  `created_at` text NOT NULL,
  `reversed_at` text,
  `reversed_by` integer,
  `reversal_reason` text,
  FOREIGN KEY (`associate_id`) REFERENCES `associates_and_alumni` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`linked_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`reversed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `classification_transfer_active_source_idx`
ON `classification_transfers` (`source_type`, `source_id`) WHERE `reversed_at` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `classification_transfer_associate_idx`
ON `classification_transfers` (`associate_id`);
