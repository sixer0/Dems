-- Custom SQL migration file, put your code below! --
-- 0016_capture_streams_audio_inputs_privileges (hand-written; schema set A of task 4, contract
-- revision dbc-8; the 0005 / 0009 / 0012 / 0014 pattern; MG-2, MG-5, MG-6). Schema design
-- sections 2.1 to 2.3 with design addendum 1.4 #1 and 7.2; decisions U8, U11, C9, C14.
-- Migration set 8: 0015 (generated) + this file.
--
-- No statement names the owner role or the provisioning superuser (MG-9, OW-9). dems_app exists
-- before this file runs (OW-8). The two tables and the column exist (0015).
--
-- NO blanket "GRANT SELECT ON ALL TABLES": it would re-open the SELECT carve-outs of
-- capture_device_credentials (0005, 0010) and of the three hidden columns of stt_config (0007).
-- No new role, and no DELETE on a new table: the runtime role deletes from active_session only.
--
-- capture_config: NOTHING is granted or revoked. 0015 made its six slot columns nullable; the
-- UPDATE the runtime role holds on them is the one of 0005, and it still neither inserts nor
-- deletes the selector row.
--
-- capture_device_streams (T-44): one row per stream statement of an adopted camera. The runtime
-- role reads, inserts and re-reads (UPDATE on every column but the two key columns, device_id
-- and profile). A stream a camera no longer offers stays as a row.
GRANT SELECT, INSERT ON capture_device_streams TO dems_app;
--> statement-breakpoint
GRANT UPDATE (onvif_profile_token, video_source_token, lens, stream_role, codec, width, height, read_at)
  ON capture_device_streams TO dems_app;
--> statement-breakpoint
-- Boundary pin (a no-op today, the 0007 / 0009 / 0012 / 0014 precedent): a row is never removed.
REVOKE DELETE, TRUNCATE ON capture_device_streams FROM dems_app;
--> statement-breakpoint
-- capture_audio_inputs (T-45): one row per registered sound-card input. The runtime role reads,
-- inserts and changes the card or the input of a registered microphone. It holds no UPDATE on
-- the key (device_id) and none on sample_rate: the audio contract is one rate, and the CHECK of
-- 0015 admits that one value.
GRANT SELECT, INSERT ON capture_audio_inputs TO dems_app;
--> statement-breakpoint
GRANT UPDATE (usb_id, card_id, card_device, input_number, native_channels, sample_bits, updated_by, updated_at)
  ON capture_audio_inputs TO dems_app;
--> statement-breakpoint
-- Boundary pins (no-ops today): the rate is never changed and a row is never removed.
REVOKE UPDATE (sample_rate) ON capture_audio_inputs FROM dems_app;
--> statement-breakpoint
REVOKE DELETE, TRUNCATE ON capture_audio_inputs FROM dems_app;
--> statement-breakpoint
-- session_capture_sources.source_facts: the table-level SELECT and INSERT of 0009 cover the new
-- column, so nothing is granted. Boundary pin (a no-op today): the facts are written in the
-- INSERT of the session start and never changed; the table stays INSERT-only.
REVOKE UPDATE (source_facts) ON session_capture_sources FROM dems_app;
--> statement-breakpoint
-- MG-5: the last file of the set carries the version; DB_SCHEMA_VERSION / DB_CONTRACT_REVISION
-- in src/db/schema/meta.ts change in the same commit (boot check B-3 compares them). The step is
-- taken: code that writes a stream row, a sound-card input or source_facts fails at its first
-- statement on a database without 0015, and code older than the set must not read a selector row
-- that may now hold an unassigned slot.
UPDATE public.schema_meta SET schema_version = 7, contract_revision = 'dbc-8' WHERE singleton;
