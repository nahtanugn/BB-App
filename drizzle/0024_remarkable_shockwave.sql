CREATE UNIQUE INDEX `notifications_recipient_entity_unique` ON `notifications` (`recipient_user_id`,`entity_key`);--> statement-breakpoint
CREATE INDEX `notifications_user_unread_idx` ON `notifications` (`recipient_user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_active_idx` ON `push_subscriptions` (`user_id`,`active`);