ALTER TABLE `members` ADD COLUMN `organisation` text NOT NULL DEFAULT 'BB';
CREATE INDEX IF NOT EXISTS `members_organisation_band_idx` ON `members` (`organisation`, `band_member`, `name`);
