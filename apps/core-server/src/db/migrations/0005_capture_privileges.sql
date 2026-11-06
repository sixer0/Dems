-- Custom SQL migration file, put your code below! --
-- 0005_capture_privileges (hand-written; database contract dbc-3 section D; matrix of section D, credential rule
-- of section B.3, version row of MG-5).
--
-- Least privilege for the runtime role dems_app over the nine tables 0004 adds, the write-only
-- credential store, and the schema-version bump. No statement names the owner role or the
-- provisioning superuser: ownership comes from the role that applies the set (MG-9, OW-9).
-- dems_app must exist before this file runs (OW-8). Because 0004 has already created the nine
-- tables, the blanket SELECT below covers them and the credential table is carved back out.
--
-- SEC35-02 (Q-SEC-3 default, applied alternative of the row-35 remediation): GRANT EXECUTE on the
-- reveal function is NOT revoked from dems_app - a 4th DB role is forbidden by D-DB-07 - so the
-- reach is narrowed three ways instead: PUBLIC holds nothing, the call site is exactly one module
-- (apps/core-server/src/modules/capture-config/credential-reveal.ts) enforced by the capture-config
-- static rule, and every invocation is audited as CAPTURE_CREDENTIAL_REVEALED with the device ID
-- and a reason code only (M2 rows 48 and 52 own that code and its static test). See dbc-3 section B.3.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dems_app;
--> statement-breakpoint
-- D-DB-06 / RK-12: the credential store is invisible to the runtime role although it is writable
-- by it. Read path is the reveal function below; M2-MT-4 asserts this fails 42501.
REVOKE SELECT ON capture_device_credentials FROM dems_app;
--> statement-breakpoint

GRANT INSERT ON
  session_audio_intervals, recording_fragments, transcript_chunks,
  transcripts, transcript_revisions, sealing_jobs,
  capture_devices, capture_device_credentials
TO dems_app;
--> statement-breakpoint
-- recording_fragments, transcripts and transcript_revisions receive INSERT only: append-only
-- checkpoints, no UPDATE and no DELETE for the runtime role (dbc-3 section B.6, section B.8, section B.9).
-- capture_config gets no INSERT and no DELETE: the singleton row is created by the seed and
-- carried by a reset; the OD-10 edit is an UPDATE (dbc-3 section B.1).

GRANT UPDATE (video_01_device_id, video_01_profile, video_02_device_id, video_02_profile,
              mic_primary_id, mic_standby_id, revision, updated_by, updated_at)
  ON capture_config TO dems_app;
--> statement-breakpoint
GRANT UPDATE (transport, model, firmware, address, mac, onvif_uuid, profiles, poe_port,
              enabled, last_seen_at) ON capture_devices TO dems_app;
--> statement-breakpoint
-- The credential row is write-only: UPDATE covers the whole secret, yet SELECT is gone, so the
-- value can be stored and rotated but never read back by the runtime role (RK-12).
GRANT UPDATE (username, encryption, secret_ciphertext, nonce, key_ref, rotated_at)
  ON capture_device_credentials TO dems_app;
--> statement-breakpoint
GRANT UPDATE (to_media_ms, to_at) ON session_audio_intervals TO dems_app;   -- closes the open interval, nothing else
--> statement-breakpoint
GRANT UPDATE (status, segments, embedding_ref, model_id, computed_at) ON transcript_chunks TO dems_app;
--> statement-breakpoint
GRANT UPDATE (status, progress, eta_ms, attempt, checkpoint, error_code, updated_at)
  ON sealing_jobs TO dems_app;
--> statement-breakpoint
-- The evidence_items UPDATE list of 0003 stays exactly as it is: the three new sealed columns
-- (manifest_version, transcript_sha256, labels_status) gain no grant, and integrity_source stays
-- outside the list because it is immutable at seal (dbc-3 section B.11).

-- The single read path of the credential store (D-DB-06). Owner-defined and SECURITY DEFINER, so
-- it reads the table the runtime role may not; one device per call, the device ID arrives as a
-- bind parameter; an unknown device yields no row. Precedent: audit_chain_lock() of 0002.
CREATE FUNCTION public.dems_capture_credential_reveal(p_device_id text)
RETURNS TABLE (username text, encryption text, secret_ciphertext bytea, nonce bytea, key_ref text)
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT c.username, c.encryption, c.secret_ciphertext, c.nonce, c.key_ref
    FROM public.capture_device_credentials AS c
   WHERE c.device_id = p_device_id
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.dems_capture_credential_reveal(text) FROM PUBLIC;
--> statement-breakpoint
-- Sole runtime role holds EXECUTE; the narrowing is application-layer + static + audited, not a
-- second DB role (SEC35-02 applied alternative; D-DB-07 forbids new DB roles).
GRANT EXECUTE ON FUNCTION public.dems_capture_credential_reveal(text) TO dems_app;
--> statement-breakpoint

-- MG-5: the last file of the set carries the version. The same commit changes
-- DB_SCHEMA_VERSION / DB_CONTRACT_REVISION in src/db/schema/meta.ts (boot check B-3 compares them).
UPDATE public.schema_meta SET schema_version = 2, contract_revision = 'dbc-3' WHERE singleton;
