-- Custom SQL migration file, put your code below! --
-- 0010_credential_replace_privileges (hand-written; database contract section N erratum
-- PE-129a-01; the 0005 / 0009 pattern; MG-2, MG-4, MG-5). Finding F-84-1 of blueprint row 84,
-- controller-added row 129a (D99). Migration set 5: this one file.
--
-- No statement names the owner role or the provisioning superuser (MG-9, OW-9). dems_app exists
-- before this file runs (OW-8). The table exists (0004). 0005 is not edited (MG-4): the
-- correction is this new file.
--
-- THE DEFECT. 0005 gave the runtime role INSERT and a six-column UPDATE on
-- capture_device_credentials and revoked SELECT on the whole table. PostgreSQL asks for SELECT
-- on every column a statement READS, and "WHERE device_id = $1" and the conflict target of
-- "ON CONFLICT (device_id)" both read device_id. So the first INSERT worked and every statement
-- that replaces a stored credential answered 42501: the rotation of operation 89 (section B.3,
-- "one UPDATE") was not reachable.
--
-- THE FIX. SELECT on the key column alone. device_id is not a secret: it is capture_devices.id,
-- which the role reads already, and "this camera has a credential" is the credentialSet fact
-- the API publishes. The five columns that carry the credential, and rotated_at, stay
-- unreadable; the one read path stays dems_capture_credential_reveal(text).
--
-- NO blanket "GRANT SELECT ON ALL TABLES" and no table-level SELECT here: either would re-open
-- this carve-out and the three hidden columns of stt_config (0007).
--
-- stt_config needs nothing: its write is "UPDATE ... WHERE singleton AND revision = $n", and
-- 0007 granted SELECT on both of those columns.
GRANT SELECT (device_id) ON capture_device_credentials TO dems_app;
--> statement-breakpoint
-- Boundary pin (a no-op today, the 0007 precedent): the other six columns hold no SELECT.
REVOKE SELECT (username, encryption, secret_ciphertext, nonce, key_ref, rotated_at)
  ON capture_device_credentials FROM dems_app;
--> statement-breakpoint
-- MG-5: the last file of the set carries the version; DB_SCHEMA_VERSION / DB_CONTRACT_REVISION
-- in src/db/schema/meta.ts change in the same commit (boot check B-3 compares them). The step is
-- taken, not re-affirmed as 0007 did: a reader exists (the credential store of row 84 and the
-- rotation of row 142), so B-3 must refuse the replacing code on a database without this grant.
UPDATE public.schema_meta SET schema_version = 4, contract_revision = 'dbc-5' WHERE singleton;
