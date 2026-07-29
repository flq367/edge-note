ALTER TABLE `notes` ADD COLUMN `is_pinned` integer DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX `is_pinned_idx` ON `notes` (`is_pinned`);
