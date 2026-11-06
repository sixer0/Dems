-- Custom SQL migration file, put your code below!
-- 0042_capture_config_constraint_repair (hand-written; the 0041 pattern; MG-4, KD-46, DF-30, D22(1)).
--
-- THE REPAIR OF AN EDITED APPLIED MIGRATION. Commit c7cd3679 appended two foreign keys to 0039
-- (capture_config_video_03/04_device_id_fkey) and two constraint renames to 0040
-- (capture_config_mic_primary_id_fkey -> capture_config_mic_01_id_fkey, and the standby key ->
-- capture_config_mic_02_id_fkey) AFTER both files had been applied to the production database.
-- The migrator never re-runs an applied file, so that database lacks the two video keys and keeps
-- the two old mic key names, while a fresh install has the names of src/db/schema/capture.ts.
--
-- Every step below is conditional on pg_constraint, so the file is a no-op on a fresh install (0039
-- and 0040 already gave it the right names) and on any lane migrated from below 0039, and it brings
-- a database applied before c7cd3679 to the fresh-install shape. The definitions are those of
-- 0039 and 0040 (ON DELETE RESTRICT ON UPDATE NO ACTION). A key is added NOT VALID and then
-- validated, the standard two-step form; the stored selector row already satisfies it.
--
-- A rename happens only when the old name exists and the new one does not. If both exist the
-- database holds a duplicate key that no migration of this set created; it is left alone here and
-- shows up in the constraint-name probe of the report, not repaired blind.
--
-- NO version step: like 0039 to 0041 this changes no readable fact, so the pair (15, 'dbc-16')
-- stays pinned by boot check B-3 and src/db/schema/meta.ts. No grant change: constraint names are
-- not privileges, and the column grants of 0041 already stand. No data change.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.capture_config'::regclass AND conname = 'capture_config_mic_primary_id_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.capture_config'::regclass AND conname = 'capture_config_mic_01_id_fkey') THEN
    ALTER TABLE "capture_config" RENAME CONSTRAINT "capture_config_mic_primary_id_fkey" TO "capture_config_mic_01_id_fkey";
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.capture_config'::regclass AND conname = 'capture_config_mic_standby_id_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.capture_config'::regclass AND conname = 'capture_config_mic_02_id_fkey') THEN
    ALTER TABLE "capture_config" RENAME CONSTRAINT "capture_config_mic_standby_id_fkey" TO "capture_config_mic_02_id_fkey";
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.capture_config'::regclass AND conname = 'capture_config_video_03_device_id_fkey') THEN
    ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_video_03_device_id_fkey" FOREIGN KEY ("video_03_device_id") REFERENCES "capture_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
    ALTER TABLE "capture_config" VALIDATE CONSTRAINT "capture_config_video_03_device_id_fkey";
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.capture_config'::regclass AND conname = 'capture_config_video_04_device_id_fkey') THEN
    ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_video_04_device_id_fkey" FOREIGN KEY ("video_04_device_id") REFERENCES "capture_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
    ALTER TABLE "capture_config" VALIDATE CONSTRAINT "capture_config_video_04_device_id_fkey";
  END IF;
END
$$;
--> statement-breakpoint
-- The two channel keys of 0040 were never part of the edit (production holds both), but the set of
-- six names this file answers for is checked as a whole, so a database that lost them is repaired
-- the same way.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.capture_config'::regclass AND conname = 'capture_config_mic_03_id_fkey') THEN
    ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_mic_03_id_fkey" FOREIGN KEY ("mic_03_id") REFERENCES "capture_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
    ALTER TABLE "capture_config" VALIDATE CONSTRAINT "capture_config_mic_03_id_fkey";
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.capture_config'::regclass AND conname = 'capture_config_mic_04_id_fkey') THEN
    ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_mic_04_id_fkey" FOREIGN KEY ("mic_04_id") REFERENCES "capture_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
    ALTER TABLE "capture_config" VALIDATE CONSTRAINT "capture_config_mic_04_id_fkey";
  END IF;
END
$$;
