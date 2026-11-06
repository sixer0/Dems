-- Custom SQL migration file, put your code below! --
-- 0025_installation_acceptance_privileges (hand-written; schema set C of task 4, contract revision
-- dbc-12; the 0005 / 0009 / 0012 / 0014 / 0016 / 0018 pattern; MG-2, MG-5, MG-6). Schema design
-- section 2.6; decisions U11 (OQ-2), C2, C9; security finding S13-13.
-- Migration set 12: 0024 (generated) + this file.
--
-- No statement names the owner role or the provisioning superuser (MG-9, OW-9). dems_app exists
-- before this file runs (OW-8). The table exists (0024).
--
-- NO blanket "GRANT SELECT ON ALL TABLES": it would re-open the SELECT carve-outs of
-- capture_device_credentials (0005, 0010) and of the three hidden columns of stt_config (0007).
-- No new role, and no DELETE on a new table: the runtime role deletes from active_session only.
--
-- installation_acceptances (T-48): the record that an installation was accepted. The runtime
-- role reads it, writes an acceptance, and revokes one. It holds no UPDATE on what was accepted
-- (id, accepted_at, accepted_by, software_version, core_device_id, site_name, room,
-- site_address, steps, diagnostics): an acceptance is a record of what stood, and it is never
-- rewritten into another one. The operation that writes it is the acceptance operation of
-- WP-26b (decision C2), under the commissioning permission; the grant here is the table's.
GRANT SELECT, INSERT ON installation_acceptances TO dems_app;
--> statement-breakpoint
GRANT UPDATE (revoked_at, revoked_by, revoke_reason) ON installation_acceptances TO dems_app;
--> statement-breakpoint
-- Boundary pin (a no-op today, the 0007 / 0009 / 0012 / 0014 / 0016 / 0018 precedent): an
-- acceptance is never removed - the history stays, revoked or in force.
REVOKE DELETE, TRUNCATE ON installation_acceptances FROM dems_app;
--> statement-breakpoint
-- MG-5: the last file of the set carries the version; DB_SCHEMA_VERSION / DB_CONTRACT_REVISION
-- in src/db/schema/meta.ts change in the same commit (boot check B-3 compares them). The step is
-- taken: code that reads or writes an acceptance fails at its first statement on a database
-- without 0024, and db:status of older code would not count the table.
UPDATE public.schema_meta SET schema_version = 11, contract_revision = 'dbc-12' WHERE singleton;