CREATE TABLE IF NOT EXISTS `app_branding` (
  `id` integer PRIMARY KEY CHECK (`id` = 1),
  `app_name` text NOT NULL,
  `short_name` text NOT NULL,
  `company_name` text NOT NULL,
  `subtitle` text NOT NULL,
  `logo_data_url` text,
  `updated_by_user_id` integer,
  `updated_at` text NOT NULL
);

INSERT INTO `app_branding`
  (`id`, `app_name`, `short_name`, `company_name`, `subtitle`, `updated_at`)
VALUES
  (1, 'BB App', 'BB App', 'Your BB Company', 'BB Section Tracker', datetime('now'))
ON CONFLICT(`id`) DO NOTHING;
