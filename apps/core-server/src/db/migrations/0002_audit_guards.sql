-- Custom SQL migration file, put your code below! --
-- 0002_audit_guards (hand-written; database contract 8.2 order 3, the six statement groups of 6.3).
--
-- Append-only and chain serialisation of the audit table, and append-only of the lineage table.
-- Applied as the owner role, so the functions and triggers belong to it and the two SECURITY
-- DEFINER functions run without superuser rights (boot check B-9 looks for exactly that).

-- 1. The chain head: one row, the genesis state of an empty log (64 zero digits).
INSERT INTO public.audit_chain_head (singleton, seq, hash)
VALUES (true, 0, repeat('0', 64));
--> statement-breakpoint

-- 2. The lock a writer takes before it computes a row. It returns the head it must extend.
CREATE FUNCTION public.audit_chain_lock()
RETURNS TABLE (seq bigint, hash text)
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT h.seq, h.hash
    FROM public.audit_chain_head AS h
   WHERE h.singleton
     FOR UPDATE
$$;
--> statement-breakpoint

-- 3. The guard: every inserted row must continue the head; the head then moves.
CREATE FUNCTION public.audit_log_guard_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  head_seq  bigint;
  head_hash text;
BEGIN
  SELECT h.seq, h.hash INTO STRICT head_seq, head_hash
    FROM public.audit_chain_head AS h
   WHERE h.singleton
     FOR UPDATE;
  IF NEW.seq <> head_seq + 1 OR NEW.prev_hash <> head_hash THEN
    RAISE EXCEPTION 'audit chain: row % does not continue head %', NEW.seq, head_seq
      USING ERRCODE = 'ZA001';
  END IF;
  UPDATE public.audit_chain_head SET seq = NEW.seq, hash = NEW.hash WHERE singleton;
  RETURN NEW;
END
$$;
--> statement-breakpoint

CREATE TRIGGER audit_log_chain_guard
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_guard_insert();
--> statement-breakpoint

-- 4. Append-only for every role.
CREATE FUNCTION public.audit_log_refuse_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % refused', TG_OP
    USING ERRCODE = 'ZA002';
END
$$;
--> statement-breakpoint

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_refuse_change();
--> statement-breakpoint

-- 5. The lineage of discarded chains is append-only for every role, by the same mechanism.
CREATE FUNCTION public.audit_chain_history_refuse_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_chain_history is append-only: % refused', TG_OP
    USING ERRCODE = 'ZA002';
END
$$;
--> statement-breakpoint

CREATE TRIGGER audit_chain_history_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_chain_history
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_chain_history_refuse_change();
--> statement-breakpoint

-- 6. The three triggers fire in every session mode: a session that asks the server to skip
--    ordinary triggers (the replication-role session setting) does not skip these.
ALTER TABLE public.audit_log           ENABLE ALWAYS TRIGGER audit_log_chain_guard;
--> statement-breakpoint
ALTER TABLE public.audit_log           ENABLE ALWAYS TRIGGER audit_log_append_only;
--> statement-breakpoint
ALTER TABLE public.audit_chain_history ENABLE ALWAYS TRIGGER audit_chain_history_append_only;
