-- Custom SQL migration file, put your code below! --
-- 0009_capture_sources_privileges (hand-written; database contract dbc-4 section N.8; the 0005
-- pattern; MG-2, MG-5, MG-6). R-9..R-11 (D73, D78, D83); blueprint row 129.
--
-- No statement names the owner role or the provisioning superuser (MG-9, OW-9). dems_app exists
-- before this file runs (OW-8). The table exists (0008).
--
-- NO blanket "GRANT SELECT ON ALL TABLES": it would re-open the SELECT carve-outs of
-- capture_device_credentials (0005) and of the three hidden columns of stt_config (0007). The
-- table-level SELECT and INSERT dems_app already holds on capture_devices and evidence_items
-- cover the two columns 0008 added, so nothing is granted for them here.
--
-- session_capture_sources (T-41) is INSERT-ONLY for the runtime role: SELECT and INSERT, no
-- UPDATE and no DELETE, so "written once at session start, never updated" is enforced by the
-- database (42501), the pattern of recording_fragments and transcripts.
GRANT SELECT, INSERT ON session_capture_sources TO dems_app;
--> statement-breakpoint
-- Boundary pins (no-ops today, the 0007 precedent): the two new columns are written once. The
-- UPDATE list of capture_devices stays the 10 columns of 0005 (not id, not kind, not
-- adapter_kind) and the UPDATE list of evidence_items stays the 7 columns of 0003.
REVOKE UPDATE (adapter_kind) ON capture_devices FROM dems_app;
--> statement-breakpoint
REVOKE UPDATE (development_sources) ON evidence_items FROM dems_app;
--> statement-breakpoint
-- MG-5: the last file of the set carries the version; DB_SCHEMA_VERSION / DB_CONTRACT_REVISION
-- in src/db/schema/meta.ts change in the same commit (boot check B-3 compares them).
UPDATE public.schema_meta SET schema_version = 3, contract_revision = 'dbc-4' WHERE singleton;
