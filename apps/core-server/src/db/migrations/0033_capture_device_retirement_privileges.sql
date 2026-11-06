-- Custom SQL migration file, put your code below! --
-- 0033_capture_device_retirement_privileges (hand-written; task 4, retiring a capture device,
-- contract revision dbc-16; the 0005 / 0016 / 0031 pattern; MG-2, MG-5). Design
-- docs/2026-10-12_input_av_core_adapter_plan/masterplan/07_design_retire_readopt.md section 4.1
-- and its security points 1 and 5; decision C147 of decisions/decisions.md. Migration set 16:
-- 0032 (generated) + this file.
--
-- No statement names the owner role or the provisioning superuser (MG-9, OW-9): the two functions
-- and the two triggers belong to the role that applies the set, as those of 0002 and 0005 do.
--
-- 1. TWO GRANTS. 0032 adds capture_devices.retired_at / retired_by and
-- capture_audio_inputs.retired_at. The runtime role reads and inserts both tables by the
-- table-level SELECT and INSERT of 0005 / 0016, which cover a new column; its UPDATE is a column
-- list there, so the new columns are named here. Still NO DELETE and NO TRUNCATE on either table:
-- a retired device is kept, never removed (design 07 section 2).
GRANT UPDATE (retired_at, retired_by) ON capture_devices TO dems_app;
--> statement-breakpoint
GRANT UPDATE (retired_at) ON capture_audio_inputs TO dems_app;
--> statement-breakpoint
-- 2. THE GUARD (design 07 section 4.1, security point 5). A row whose retired_at is set is never
-- changed again, for every role: the registry row keeps the model and firmware a pending seal
-- reads, the input row keeps its card, and retired_at is never cleared (no un-retire). The two
-- columns of the registry that state presence, last_seen_at and enabled, may still move. The rule
-- compares whole row images without those two columns, so a column added later is held too, and
-- an UPDATE that writes a retired row's values again unchanged is no change and passes. Invoker
-- rights: it reads nothing but OLD and NEW. Precedent: the guards of 0002.
CREATE FUNCTION public.dems_capture_retired_row_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF OLD.retired_at IS NOT NULL
     AND (to_jsonb(NEW) - 'last_seen_at' - 'enabled') IS DISTINCT FROM (to_jsonb(OLD) - 'last_seen_at' - 'enabled') THEN
    RAISE EXCEPTION '%: a retired row is not changed', TG_TABLE_NAME
      USING ERRCODE = 'ZD001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.dems_capture_retired_row_guard() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER capture_devices_retired_guard
  BEFORE UPDATE ON public.capture_devices
  FOR EACH ROW EXECUTE FUNCTION public.dems_capture_retired_row_guard();
--> statement-breakpoint
CREATE TRIGGER capture_audio_inputs_retired_guard
  BEFORE UPDATE ON public.capture_audio_inputs
  FOR EACH ROW EXECUTE FUNCTION public.dems_capture_retired_row_guard();
--> statement-breakpoint
-- The two triggers fire in every session mode, as the three of 0002 do.
ALTER TABLE public.capture_devices      ENABLE ALWAYS TRIGGER capture_devices_retired_guard;
--> statement-breakpoint
ALTER TABLE public.capture_audio_inputs ENABLE ALWAYS TRIGGER capture_audio_inputs_retired_guard;
--> statement-breakpoint
-- 3. THE DESTROY PATH OF A CREDENTIAL (design 07 section 4.1, security point 1): the mirror of the
-- reveal function of 0005. Owner-defined and SECURITY DEFINER, so it deletes from the table the
-- runtime role may not delete from; one device per call, the device id arrives as a bind
-- parameter. It deletes ONLY the credential of a device whose registry row is already retired
-- (the retire unit writes retired_at first, then calls this), so it cannot wipe the credential of
-- a camera in service. It answers the number of rows deleted, 0 or 1. A rollback of the unit
-- restores the row.
CREATE FUNCTION public.dems_capture_credential_destroy(p_device_id text)
RETURNS integer
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH gone AS (
    DELETE FROM public.capture_device_credentials AS c
     WHERE c.device_id = p_device_id
       AND EXISTS (SELECT 1 FROM public.capture_devices AS d WHERE d.id = c.device_id AND d.retired_at IS NOT NULL)
    RETURNING 1
  )
  SELECT count(*)::integer FROM gone
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.dems_capture_credential_destroy(text) FROM PUBLIC;
--> statement-breakpoint
-- The sole runtime role holds EXECUTE, as for the reveal function (SEC35-02 applied alternative;
-- D-DB-07 forbids a further database role). It still holds no DELETE on the table.
GRANT EXECUTE ON FUNCTION public.dems_capture_credential_destroy(text) TO dems_app;
--> statement-breakpoint
-- MG-5: the last file of the set carries the version; DB_SCHEMA_VERSION / DB_CONTRACT_REVISION
-- in src/db/schema/meta.ts change in the same commit (boot check B-3 compares them). The step is
-- taken: code that reads the retirement columns answers 42703 on a database without 0032, and code
-- older than the set must not start on a registry that may hold retired rows it would treat as
-- in service.
UPDATE public.schema_meta SET schema_version = 15, contract_revision = 'dbc-16' WHERE singleton;