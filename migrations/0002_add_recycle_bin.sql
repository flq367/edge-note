ALTER TABLE `notes` ADD COLUMN `deleted_at` integer;
CREATE INDEX `deleted_at_idx` ON `notes` (`deleted_at`);

-- Any existing DELETE against an active note becomes a soft delete.
-- Deleting an item that is already in the recycle bin is still allowed,
-- which enables the manual "Delete forever" action.
CREATE TRIGGER `notes_soft_delete`
BEFORE DELETE ON `notes`
WHEN OLD.`deleted_at` IS NULL
BEGIN
  UPDATE `notes`
  SET `deleted_at` = unixepoch(), `is_pinned` = 0, `is_public` = 0
  WHERE `id` = OLD.`id`;
  SELECT RAISE(IGNORE);
END;
