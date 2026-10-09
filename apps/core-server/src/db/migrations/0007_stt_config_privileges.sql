-- Custom SQL migration file, put your code below! --
-- 0007_stt_config_privileges (hand-written; database contract dbc-3 section B.13 privileges; the 0005
-- pattern of section D; MG-2, MG-5, MG-6). R-8 (D20), confirmed as Q-STT-CFG (a) at D24; lands as row 112.
--
-- Least privilege for the runtime role dems_app over the tenth v2 table stt_config. No statement
-- names the owner role or the provisioning superuser: ownership comes from the role that applies
-- the set (MG-9, OW-9). dems_app must exist before this file runs (OW-8). The table exists (0006).
--
-- SELECT is COLUMN-LEVEL on every column EXCEPT the three credential columns section B.13 carves out --
-- secret_ciphertext, nonce and the reference target credential_ref (RK-12 pattern of B.3): the
-- runtime role configures the backend but can never read back what it wrote there. The blanket
-- SELECT of 0005 predates this table and reached nothing; the explicit REVOKE below pins the
-- boundary anyway, so a future blanket grant cannot silently re-open the carve-out.
GRANT SELECT (singleton, enabled, backend, endpoint, model, language, diarization,
              credential_kind, revision, updated_by, updated_at)
  ON stt_config TO dems_app;
--> statement-breakpoint
REVOKE SELECT (secret_ciphertext, nonce, credential_ref) ON stt_config FROM dems_app;
--> statement-breakpoint
-- UPDATE covers ALL columns (section B.13), the credential columns included: op 91 is write-only, so the
-- secret can be stored and rotated but never selected by the runtime role (the exact shape of the
-- capture_device_credentials store, section B.3). No INSERT and no DELETE: the singleton row is created by
-- the seed (row 114) and carried by a reset (KEPT, mode upsert; D-DB-08, OD-19).
GRANT UPDATE (singleton, enabled, backend, endpoint, model, language, diarization,
              credential_kind, credential_ref, secret_ciphertext, nonce,
              revision, updated_by, updated_at)
  ON stt_config TO dems_app;
--> statement-breakpoint
-- The single read path of the credential columns (SEC35-14; the B.3 reveal control mirrored).
-- Owner-defined and SECURITY DEFINER, so it reads the columns the runtime role may not; the one
-- singleton row, no parameters; an unseeded database yields no row. Precedent:
-- dems_capture_credential_reveal(text) of 0005 and audit_chain_lock() of 0002.
CREATE FUNCTION public.dems_stt_credential_reveal()
RETURNS TABLE (credential_kind text, credential_ref text, secret_ciphertext bytea, nonce bytea)
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT s.credential_kind, s.credential_ref, s.secret_ciphertext, s.nonce
    FROM public.stt_config AS s
   WHERE s.singleton
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.dems_stt_credential_reveal() FROM PUBLIC;
--> statement-breakpoint
-- SEC35-02 applied alternative (Q-SEC-3 default, as in 0005): GRANT EXECUTE is NOT revoked from
-- dems_app - a 4th DB role is forbidden by D-DB-07 - so the reach is narrowed three ways instead:
-- PUBLIC holds nothing; the call site is exactly one module, the transcriber key-loader of
-- 07_transcript_spec.md section B.2, enforced by a static rule (row 115 owns that module and its M6 static
-- test); and the value never leaves memory - no response, slice, log or audit row carries it. No
-- reveal audit type exists in the contract (C3 section 5.2 adds STT_CONFIG_CHANGED only; audit types are
-- pinned at 62 -> 63 by row 113), so the audit trail of an edit is field NAMES plus
-- credentialChanged, and the read path is narrowed by the static rule instead of an audit row.
GRANT EXECUTE ON FUNCTION public.dems_stt_credential_reveal() TO dems_app;
--> statement-breakpoint

-- MG-5 re-affirmed on the new last file of the set: 0005 :78-80 wrote the pair (2, 'dbc-3') and
-- this extension does NOT move the contract revision - table 40 still speaks schema version 2 under
-- dbc-3 section B.13, and DB_SCHEMA_VERSION/DB_CONTRACT_REVISION in src/db/schema/meta.ts stay (2, 'dbc-3')
-- (boot check B-3 compares them). The statement is the same values, so it is idempotent for every
-- database that ran 0005; it exists so "the last file of the set carries the version" stays true.
UPDATE public.schema_meta SET schema_version = 2, contract_revision = 'dbc-3' WHERE singleton;
