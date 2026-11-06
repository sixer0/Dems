-- Custom SQL migration file, put your code below!
-- 0041_capture_widening_privileges (hand-written; the 0005 / 0016 / 0033 pattern; MG-2, MG-5).
--
-- THE COMPANION PRIVILEGE FILE OF THE D60 / D61 WIDENING, MISSING FROM IT: 0039 added
-- capture_config.video_03_device_id / video_03_profile / video_04_device_id / video_04_profile and
-- 0040 added mic_03_id / mic_04_id (renaming the two role columns, whose column grants follow the
-- rename). The runtime role holds a TABLE-level SELECT (0005), so a new column is readable; its
-- UPDATE on the selector is a COLUMN LIST (0005), so a new column is NOT writable until named
-- here. Two write paths need it and die with 42501 without it: the fence boot correction of a
-- generated source profile (`CORRECT_GENERATED_SOURCE_PROFILES`, which states all four camera
-- profiles since D60) and the OD-10 selector edit of operation 77 (RUNTIME_UPDATABLE_COLUMNS.
-- captureConfig names the eight slot columns since D60/D61).
--
-- NO version step is taken here: 0039 and 0040 carried none (the widening changes no readable
-- fact, only the shape of what may be written), and the pair (15, 'dbc-16') stays pinned by boot
-- check B-3 and `src/db/schema/meta.ts`. No new table, no DELETE, no TRUNCATE: the selector row
-- stays a seed-born singleton that is never inserted nor removed by the runtime role (0005).
GRANT UPDATE (video_03_device_id, video_03_profile, video_04_device_id, video_04_profile,
              mic_03_id, mic_04_id)
  ON capture_config TO dems_app;
