CREATE TABLE IF NOT EXISTS `private_document_usage` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `bytes` integer NOT NULL DEFAULT 0,
  `objects` integer NOT NULL DEFAULT 0,
  `writes` integer NOT NULL DEFAULT 0,
  `updated_at` text NOT NULL
);
INSERT OR IGNORE INTO `private_document_usage` (`id`, `bytes`, `objects`, `writes`, `updated_at`)
VALUES (1, 0, 0, 0, datetime('now'));
