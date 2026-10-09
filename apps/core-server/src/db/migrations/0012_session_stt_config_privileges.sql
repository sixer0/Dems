-- Custom SQL migration file, put your code below! --
-- 0012_session_stt_config_privileges (hand-written; database contract section N erratum
-- PE-129b-01; the 0005 / 0009 pattern; MG-2, MG-5, MG-6). Requirement R-8 AC-4, check
-- M6-STTCFG-NEXT; controller-added row 129b (D109). Migration set 6: 0011 (generated) + this file.
--
-- No statement names the owner role or the provisioning superuser (MG-9, OW-9). dems_app exists
-- before this file runs (OW-8). The table exists (0011).
--
-- NO blanket "GRANT SELECT ON ALL TABLES": it would re-open the SELECT carve-outs of
-- capture_device_credentials (0005, 0010) and of the three hidden columns of stt_config (0007).
--
-- session_stt_config (T-42) is INSERT-ONLY for the runtime role: SELECT and INSERT, no UPDATE
-- and no DELETE. "One snapshot per session, written once at its start" is therefore held by the
-- database: a second INSERT for the session meets the primary key (23505, or nothing with
-- ON CONFLICT DO NOTHING), a change or a removal answers 42501 - the pattern of
-- session_capture_sources (0009), recording_fragments and transcripts.
GRANT SELECT, INSERT ON session_stt_config TO dems_app;
--> statement-breakpoint
-- Boundary pin (a no-op today, the 0007 / 0009 precedent): nothing of a snapshot is ever changed.
REVOKE UPDATE, DELETE, TRUNCATE ON session_stt_config FROM dems_app;
--> statement-breakpoint
-- MG-5: the last file of the set carries the version; DB_SCHEMA_VERSION / DB_CONTRACT_REVISION
-- in src/db/schema/meta.ts change in the same commit (boot check B-3 compares them).
UPDATE public.schema_meta SET schema_version = 5, contract_revision = 'dbc-6' WHERE singleton;
