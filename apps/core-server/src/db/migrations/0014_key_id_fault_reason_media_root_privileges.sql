-- Custom SQL migration file, put your code below! --
-- 0014_key_id_fault_reason_media_root_privileges (hand-written; database contract section N
-- erratum PE-0013-01, contract revision dbc-7; the 0005 / 0009 / 0012 pattern; MG-2, MG-5, MG-6).
-- Controller rulings D146 (fault key), D162 (key-id form), D166 (media store root).
-- Migration set 7: 0013 (generated) + this file. The rulings call the set "migration 0013".
--
-- No statement names the owner role or the provisioning superuser (MG-9, OW-9). dems_app exists
-- before this file runs (OW-8). The table and the column exist (0013).
--
-- NO blanket "GRANT SELECT ON ALL TABLES": it would re-open the SELECT carve-outs of
-- capture_device_credentials (0005, 0010) and of the three hidden columns of stt_config (0007).
--
-- core_media_store (T-43) holds ONE row: the absolute path of the media store root of the Core
-- that uses this database. The runtime role writes it at every boot with one statement,
--   INSERT ... ON CONFLICT (singleton) DO UPDATE SET media_root = ..., recorded_at = ...
-- which needs SELECT (the conflict target is read), INSERT, and UPDATE on the two value columns.
-- It holds no DELETE: the fact is replaced, never removed. The row is a path and nothing else
-- (core_media_store_root_check); nothing of it is secret.
GRANT SELECT, INSERT ON core_media_store TO dems_app;
--> statement-breakpoint
GRANT UPDATE (media_root, recorded_at) ON core_media_store TO dems_app;
--> statement-breakpoint
-- Boundary pin (a no-op today, the 0007 / 0009 / 0012 precedent): the row is never removed and
-- the key column never changed.
REVOKE DELETE, TRUNCATE ON core_media_store FROM dems_app;
--> statement-breakpoint
-- Boundary pin (a no-op today): alerts.reason is written once, in the INSERT of its alert. The
-- UPDATE grant of 0003 stays the three life-cycle columns (active, acknowledged, resolved_at).
REVOKE UPDATE (reason) ON alerts FROM dems_app;
--> statement-breakpoint
-- MG-5: the last file of the set carries the version; DB_SCHEMA_VERSION / DB_CONTRACT_REVISION
-- in src/db/schema/meta.ts change in the same commit (boot check B-3 compares them). The step is
-- taken: code that writes alerts.reason or core_media_store fails at its first statement on a
-- database without 0013, and a revision signed with the product key is refused there (23514).
UPDATE public.schema_meta SET schema_version = 6, contract_revision = 'dbc-7' WHERE singleton;
