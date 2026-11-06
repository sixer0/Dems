-- Custom SQL migration file, put your code below! --
-- 0018_network_commissioning_privileges (hand-written; schema set B of task 4, contract revision
-- dbc-9; the 0005 / 0009 / 0012 / 0014 / 0016 pattern; MG-2, MG-5, MG-6). Schema design sections
-- 2.4 and 2.5; decisions U10, U11 (OQ-4), C9; plan review P12-F07; findings of rows 67 and 156.
-- Migration set 9: 0017 (generated) + this file.
--
-- No statement names the owner role or the provisioning superuser (MG-9, OW-9). dems_app exists
-- before this file runs (OW-8). The two tables and the two columns exist (0017).
--
-- NO blanket "GRANT SELECT ON ALL TABLES": it would re-open the SELECT carve-outs of
-- capture_device_credentials (0005, 0010) and of the three hidden columns of stt_config (0007).
-- No new role, and no DELETE on a new table: the runtime role deletes from active_session only.
--
-- capture_network_config (T-46): the network settings of the commissioning functions, one row.
-- The runtime role reads it, inserts the default row at first use (INSERT ... ON CONFLICT
-- (singleton) DO NOTHING, the core_media_store pattern) and updates every column but the key.
GRANT SELECT, INSERT ON capture_network_config TO dems_app;
--> statement-breakpoint
GRANT UPDATE (interface_name, camera_subnet, factory_addresses, alias_host, alias_minutes, camera_ip_start, revision, updated_by, updated_at)
  ON capture_network_config TO dems_app;
--> statement-breakpoint
-- Boundary pin (a no-op today, the 0007 / 0009 / 0012 / 0014 / 0016 precedent): the row is never removed.
REVOKE DELETE, TRUNCATE ON capture_network_config FROM dems_app;
--> statement-breakpoint
-- host_network_aliases (T-47): the state of an alias address on the camera interface. The
-- runtime role reads, opens a row, extends its lifetime and closes it. It holds no UPDATE on what
-- the alias IS (id, interface_name, address, reason, added_at, added_by): a closed row is the
-- record of an address that was on the host, and it is never rewritten into another one.
GRANT SELECT, INSERT ON host_network_aliases TO dems_app;
--> statement-breakpoint
GRANT UPDATE (expires_at, removed_at, remove_reason, removed_by, remove_error)
  ON host_network_aliases TO dems_app;
--> statement-breakpoint
-- Boundary pin (a no-op today): an alias row is never removed.
REVOKE DELETE, TRUNCATE ON host_network_aliases FROM dems_app;
--> statement-breakpoint
-- capture_audio_inputs.usb_serial, usb_port: the table-level SELECT and INSERT of 0016 cover the
-- two new columns. They are card facts like usb_id and card_id, so the runtime role updates them
-- with those (a registered microphone moved to another card or port is an UPDATE).
GRANT UPDATE (usb_serial, usb_port) ON capture_audio_inputs TO dems_app;
--> statement-breakpoint
-- The commissioning permission (decision U10: TECHNICIAN only). A permission is stored data
-- (plan review P12-F07): the boot compares the stored grants with the shared role table and
-- refuses on a difference, and no earlier file writes a role, a permission or a grant - the seed
-- does, from the shared vocabulary. So a database that is ALREADY SEEDED gets the two rows here,
-- in the set whose code names the permission; the vocabulary member lands in the same commit.
-- An empty database (roles not written yet) gets nothing: its seed writes all fifteen.
-- sort_order 15 is the member's place in the declaration, as the seed counts it. ON CONFLICT DO
-- NOTHING: a second run, or a database that already holds the row, is left as it is.
INSERT INTO public.permissions (id, sort_order)
SELECT 'CAPTURE_COMMISSION', 15
 WHERE EXISTS (SELECT 1 FROM public.roles WHERE id = 'TECHNICIAN')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'TECHNICIAN', 'CAPTURE_COMMISSION'
 WHERE EXISTS (SELECT 1 FROM public.roles WHERE id = 'TECHNICIAN')
   AND EXISTS (SELECT 1 FROM public.permissions WHERE id = 'CAPTURE_COMMISSION')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- MG-5: the last file of the set carries the version; DB_SCHEMA_VERSION / DB_CONTRACT_REVISION
-- in src/db/schema/meta.ts change in the same commit (boot check B-3 compares them). The step is
-- taken: code that reads the network settings, opens an alias row or stores the port of a sound
-- card fails at its first statement on a database without 0017, and code older than the set
-- refuses a stored matrix that holds the commissioning permission.
UPDATE public.schema_meta SET schema_version = 8, contract_revision = 'dbc-9' WHERE singleton;