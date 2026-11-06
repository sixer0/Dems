-- Custom SQL migration file, put your code below!
-- 0036_operator_purge (hand-written; the `0018` exception class, MG-2).
--
-- WHY. Principal decision of 2026-11-02 (PT GSP, layer L0), amending RB-9: deleting an operator
-- removes the account AND the history that belongs to it. Two things follow, and this file is where
-- both become real.
--
--   * What the account IS is erased: its credential, its biometric tokens, its sign-in rows, its
--     open sessions, the pairing codes it issued, the audit rows it wrote, and the chain resets it
--     ordered.
--   * What the account DID to the unit stays. Evidence, custody, session records, exports,
--     transcript revisions, capture configuration, network aliases and the installation acceptance
--     are records OF THE UNIT, not of the person who touched them. Their rows survive and their
--     attribution becomes unknown, which is why the foreign keys below answer SET NULL instead of
--     RESTRICT and six columns drop NOT NULL. Deleting those rows would delete recordings and
--     un-accept a commissioned installation.
--
-- The chain must still verify afterwards, so the removal is followed by a re-seal: every surviving
-- row after the first removed sequence gets a new prev_hash and hash, computed by the engine with
-- the same canonicalisation it uses to append (SR-65) and applied by `audit_purge_reseal` below.
--
-- That work is deliberately NOT given to `dems_app` as an UPDATE or DELETE grant: a taken-over Core
-- would then be able to bend history into any shape it liked. The erasure and the re-seal run as two
-- SECURITY DEFINER functions owned by the schema owner, and they are the only way this database lets
-- an audit row disappear or change. The runtime role holds neither DELETE nor UPDATE on `audit_log`,
-- so it cannot reach the open path by itself; the marker below is what tells the trigger that the
-- statement comes from inside the purge function rather than from the engine's own SQL.
--
-- WHAT SURVIVES THE LOSS, and what does not. After a purge the chain no longer proves that the erased
-- account never existed: that guarantee is given up by the decision this file implements. Everything
-- else is still provable. The re-seal refuses to alter a single non-hash column, so no fact ever
-- recorded can be rewritten; and because verification recomputes the digest from the stored columns,
-- a seal laid down by a lying caller FAILS to verify instead of quietly passing. A purge is also
-- always announced: the engine appends USER_DELETED afterwards through the normal writer, naming the
-- acting root, the counts, and the sequence the chain was re-sealed from. An erasure can therefore be
-- noticed and its size measured, but not reconstructed.
--
-- The append-only triggers keep their names and their `ENABLE ALWAYS` mode (boot check B-5 checks
-- exactly that). No role name appears below: the marker is the whole condition, and the privileges of
-- the runtime role are the backstop.

--> statement-breakpoint

-- 1. The ticket that opens the guards, and the two guards that read it.
--
-- A session setting cannot be the marker: both purge functions declare `SET search_path`, and
-- PostgreSQL restores every run-time setting a function touched when that function returns, so a
-- `set_config(..., true)` made inside the purge would already be gone by the time its own DELETE ran
-- (measured, not theorised: the re-seal reported "no operator purge is open" behind a purge that had
-- just succeeded). The ticket below is transaction-scoped by its own column instead: it names the
-- transaction that bought it, and a guard accepts a statement only while that is the current one.
-- After a commit the row stays but its `xact_id` never matches again; after an abort the row is gone
-- with the transaction. Either way the open path closes itself.
--
-- `dems_app` holds no privilege on this table at all, so the runtime role cannot buy a ticket: only
-- the purge function, running as the schema owner, writes one.
CREATE TABLE IF NOT EXISTS public.audit_purge_ticket (
  operator_id text   NOT NULL,
  reseal_from bigint,
  xact_id     xid8   NOT NULL
);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.audit_purge_ticket_open()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.audit_purge_ticket AS t
                  WHERE t.xact_id = pg_current_xact_id());
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.audit_log_refuse_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') AND public.audit_purge_ticket_open() THEN
    RETURN NULL;  -- statement-level trigger: the return value is ignored, the statement proceeds
  END IF;
  RAISE EXCEPTION 'audit_log is append-only: % refused', TG_OP
    USING ERRCODE = 'ZA002';
END
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.audit_chain_history_refuse_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND public.audit_purge_ticket_open() THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'audit_chain_history is append-only: % refused', TG_OP
    USING ERRCODE = 'ZA002';
END
$$;
--> statement-breakpoint

-- 2. Six columns of unit records become able to hold "it is no longer known who" (MG-1: the column
-- type, the nullability and the constraint also live in `db/schema/*.ts`, and a boot check compares
-- the stored schema with it).
ALTER TABLE public.evidence_items           ALTER COLUMN investigator_id DROP NOT NULL;
ALTER TABLE public.exports                  ALTER COLUMN operator_id     DROP NOT NULL;
ALTER TABLE public.host_network_aliases     ALTER COLUMN added_by        DROP NOT NULL;
ALTER TABLE public.installation_acceptances ALTER COLUMN accepted_by     DROP NOT NULL;
ALTER TABLE public.session_history          ALTER COLUMN investigator_id DROP NOT NULL;
ALTER TABLE public.transcript_revisions     ALTER COLUMN author_id       DROP NOT NULL;
--> statement-breakpoint

-- 3. A reference that holds a record OF THE UNIT stops refusing the delete and drops the attribution
-- instead. The seven references that belong to the account itself keep RESTRICT: the purge function
-- deletes their rows first, and a RESTRICT left in place is what catches a future path that forgets
-- to. `audit_log.actor_id` and `audit_chain_history.actor_id` keep RESTRICT for the same reason, so
-- an operator can only ever go together with the rows it wrote.
ALTER TABLE public.active_session           DROP CONSTRAINT active_session_created_by_fkey;
ALTER TABLE public.active_session           ADD  CONSTRAINT active_session_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.active_session           DROP CONSTRAINT active_session_started_by_fkey;
ALTER TABLE public.active_session           ADD  CONSTRAINT active_session_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.active_session           DROP CONSTRAINT active_session_stopped_by_fkey;
ALTER TABLE public.active_session           ADD  CONSTRAINT active_session_stopped_by_fkey FOREIGN KEY (stopped_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.capture_audio_inputs     DROP CONSTRAINT capture_audio_inputs_updated_by_fkey;
ALTER TABLE public.capture_audio_inputs     ADD  CONSTRAINT capture_audio_inputs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.capture_config           DROP CONSTRAINT capture_config_updated_by_fkey;
ALTER TABLE public.capture_config           ADD  CONSTRAINT capture_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.capture_devices          DROP CONSTRAINT capture_devices_retired_by_fkey;
ALTER TABLE public.capture_devices          ADD  CONSTRAINT capture_devices_retired_by_fkey FOREIGN KEY (retired_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.capture_network_config   DROP CONSTRAINT capture_network_config_updated_by_fkey;
ALTER TABLE public.capture_network_config   ADD  CONSTRAINT capture_network_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.evidence_custody         DROP CONSTRAINT evidence_custody_actor_id_fkey;
ALTER TABLE public.evidence_custody         ADD  CONSTRAINT evidence_custody_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.evidence_items           DROP CONSTRAINT evidence_items_investigator_id_fkey;
ALTER TABLE public.evidence_items           ADD  CONSTRAINT evidence_items_investigator_id_fkey FOREIGN KEY (investigator_id) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.exports                  DROP CONSTRAINT exports_operator_id_fkey;
ALTER TABLE public.exports                  ADD  CONSTRAINT exports_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.host_network_aliases     DROP CONSTRAINT host_network_aliases_added_by_fkey;
ALTER TABLE public.host_network_aliases     ADD  CONSTRAINT host_network_aliases_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.host_network_aliases     DROP CONSTRAINT host_network_aliases_removed_by_fkey;
ALTER TABLE public.host_network_aliases     ADD  CONSTRAINT host_network_aliases_removed_by_fkey FOREIGN KEY (removed_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.installation_acceptances DROP CONSTRAINT installation_acceptances_accepted_by_fkey;
ALTER TABLE public.installation_acceptances ADD  CONSTRAINT installation_acceptances_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.installation_acceptances DROP CONSTRAINT installation_acceptances_revoked_by_fkey;
ALTER TABLE public.installation_acceptances ADD  CONSTRAINT installation_acceptances_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.paired_devices           DROP CONSTRAINT paired_devices_revoked_by_operator_id_fkey;
ALTER TABLE public.paired_devices           ADD  CONSTRAINT paired_devices_revoked_by_operator_id_fkey FOREIGN KEY (revoked_by_operator_id) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.pairing_codes            DROP CONSTRAINT pairing_codes_closed_by_operator_id_fkey;
ALTER TABLE public.pairing_codes            ADD  CONSTRAINT pairing_codes_closed_by_operator_id_fkey FOREIGN KEY (closed_by_operator_id) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.session_audio_intervals  DROP CONSTRAINT session_audio_intervals_switched_by_fkey;
ALTER TABLE public.session_audio_intervals  ADD  CONSTRAINT session_audio_intervals_switched_by_fkey FOREIGN KEY (switched_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.session_history          DROP CONSTRAINT session_history_investigator_id_fkey;
ALTER TABLE public.session_history          ADD  CONSTRAINT session_history_investigator_id_fkey FOREIGN KEY (investigator_id) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.stt_config               DROP CONSTRAINT stt_config_updated_by_fkey;
ALTER TABLE public.stt_config               ADD  CONSTRAINT stt_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.operators(id) ON DELETE SET NULL;
ALTER TABLE public.transcript_revisions     DROP CONSTRAINT transcript_revisions_author_id_fkey;
ALTER TABLE public.transcript_revisions     ADD  CONSTRAINT transcript_revisions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.operators(id) ON DELETE SET NULL;
--> statement-breakpoint

-- 4. The purge. One call, inside the unit that already holds the chain-head lock (AP-2). It answers
-- how many rows went with the account and the sequence the tail has to be re-sealed from; the marker
-- carries both so the re-seal can check itself against the database rather than against its caller.
CREATE FUNCTION public.audit_purge_operator(p_operator_id text, p_actor_id text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_root       text;
  v_first      bigint;
  v_last       bigint;
  v_audit      integer := 0;
  v_lineage    integer := 0;
  v_signins    integer := 0;
  v_tokens     integer := 0;
  v_credential integer := 0;
  v_codes      integer := 0;
  v_sessions   integer := 0;
BEGIN
  -- The caller must be the enabled vendor root account itself, and never its own target.
  SELECT o.id INTO v_root FROM public.operators AS o
   WHERE o.id = p_actor_id AND o.username = 'root' AND o.enabled;
  IF v_root IS NULL THEN
    RAISE EXCEPTION 'operator purge: the acting operator % is not the enabled vendor root account', p_actor_id
      USING ERRCODE = 'ZA003';
  END IF;
  IF p_operator_id = p_actor_id THEN
    RAISE EXCEPTION 'operator purge: the root account cannot purge itself' USING ERRCODE = 'ZA003';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'operator purge: a reason is required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = p_operator_id) THEN
    RAISE EXCEPTION 'operator purge: no operator %', p_operator_id USING ERRCODE = 'P0002';
  END IF;

  -- RB-8, guarded here as well as in the engine: the unit never ends up without an enabled operator
  -- holding USER_ADMIN.
  -- The administrator is whoever's ROLE holds the USER_ADMIN PERMISSION (`role_permissions`), which
  -- is exactly how the engine computes it in `statements.ts`; there is no role named USER_ADMIN.
  IF EXISTS (SELECT 1 FROM public.operators AS t JOIN public.role_permissions AS rp ON rp.role_id = t.role_id
              WHERE rp.permission_id = 'USER_ADMIN' AND t.id = p_operator_id AND t.enabled)
     AND NOT EXISTS (SELECT 1 FROM public.operators AS t JOIN public.role_permissions AS rp ON rp.role_id = t.role_id
              WHERE rp.permission_id = 'USER_ADMIN' AND t.id <> p_operator_id AND t.enabled) THEN
    RAISE EXCEPTION 'operator purge: % is the last enabled operator holding USER_ADMIN', p_operator_id
      USING ERRCODE = 'ZA005';
  END IF;

  SELECT min(seq), max(seq) INTO v_first, v_last FROM public.audit_log WHERE actor_id = p_operator_id;

  -- Garbage-collect tickets left behind by purges that committed without a re-seal: their
  -- transaction is over, so they open nothing anywhere, and they should not pile up forever.
  DELETE FROM public.audit_purge_ticket WHERE xact_id <> pg_current_xact_id();

  -- The ticket: one row, stamped with this transaction, readable by the guards and by nothing else
  -- the runtime role can reach. It is what makes the DELETE below possible and nothing else is.
  INSERT INTO public.audit_purge_ticket (operator_id, reseal_from, xact_id)
  VALUES (p_operator_id, v_first, pg_current_xact_id());

  DELETE FROM public.audit_chain_history  WHERE actor_id = p_operator_id;
  GET DIAGNOSTICS v_lineage  = ROW_COUNT;
  DELETE FROM public.audit_log            WHERE actor_id = p_operator_id;
  GET DIAGNOSTICS v_audit    = ROW_COUNT;
  DELETE FROM public.auth_sessions        WHERE operator_id = p_operator_id;
  GET DIAGNOSTICS v_signins  = ROW_COUNT;
  DELETE FROM public.biometric_tokens     WHERE operator_id = p_operator_id;
  GET DIAGNOSTICS v_tokens   = ROW_COUNT;
  DELETE FROM public.operator_credentials WHERE operator_id = p_operator_id;
  GET DIAGNOSTICS v_credential = ROW_COUNT;
  DELETE FROM public.pairing_codes        WHERE issued_by_operator_id = p_operator_id;
  GET DIAGNOSTICS v_codes    = ROW_COUNT;
  DELETE FROM public.active_session       WHERE investigator_id = p_operator_id;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  -- The ledger entry, before the account goes (its `actor_id` then rides the SET NULL rule like any
  -- other record of the unit: erasing the root that ordered a purge must not erase the record that
  -- a purge happened). Only when rows actually went: the table records erasures, not no-ops.
  IF v_first IS NOT NULL THEN
    INSERT INTO public.audit_purge_log (operator_id, actor_id, at, first_seq, last_seq, rows_removed, reason)
    VALUES (p_operator_id, p_actor_id, (extract(epoch from clock_timestamp()) * 1000)::bigint,
            v_first, v_last, v_audit, btrim(p_reason));
  END IF;

  -- The account row. Every reference of the unit that still points here now answers SET NULL.
  DELETE FROM public.operators WHERE id = p_operator_id;

  RETURN jsonb_build_object(
    'operatorId', p_operator_id,
    'auditRows', v_audit,
    'lineageRows', v_lineage,
    'signInRows', v_signins,
    'biometricTokens', v_tokens,
    'credentialsRemoved', v_credential,
    'pairingCodes', v_codes,
    'activeSessions', v_sessions,
    'resealFromSeq', v_first);
END
$$;
--> statement-breakpoint

-- 4b. The ledger of erasures: one row per purge, written by the purge itself, never deleted.
--
-- A purge leaves a hole in the sequence numbers, and the shared chain check requires consecutive
-- ones (`SEQ_GAP`), which is what boot check B-8 runs. Without this table every Core that ever
-- purged an operator would report `STORED_CHAIN_NOT_VERIFIED` for the rest of its life and the
-- console could never say the log verifies again. B-8 reads the ranges below and accepts a missing
-- sequence ONLY inside a range this ledger names; anywhere else a gap is still the alarm it was
-- designed to be. The row is inserted by the same function that does the deleting, in the same
-- transaction: an erasure that is not recorded cannot commit.
CREATE TABLE IF NOT EXISTS public.audit_purge_log (
  purge_no     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operator_id  text   NOT NULL,
  actor_id     text   REFERENCES public.operators(id) ON DELETE SET NULL,
  at           bigint NOT NULL,
  first_seq    bigint NOT NULL,
  last_seq     bigint NOT NULL,
  rows_removed integer NOT NULL CHECK (rows_removed >= 1),
  reason       text   NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  CONSTRAINT audit_purge_log_range_check CHECK (last_seq >= first_seq)
);
--> statement-breakpoint

-- 5. The re-seal: apply the new linkage to the surviving tail. Every guard here exists because the
-- caller is not trusted with the table.
--    * the marker must be set, and it must name the same operator the caller claims to be sealing;
--    * a row is matched on EVERY stored column, so the statement can only ever change prev_hash and
--      hash: a caller that misremembers one fact loses the match and the whole unit rolls back;
--    * the sequences must rise, each row's prev_hash must be the hash the previous row was sealed
--      with, and the first row must continue the newest surviving row BELOW the removed range, read
--      here from the table rather than from the caller;
--    * the array must cover EVERY surviving row above the removed range, no more and no fewer, so a
--      tail cannot be left half-sealed;
--    * the head moves only to the last row of a fully verified tail.
CREATE FUNCTION public.audit_purge_reseal(p_operator_id text, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_ticket      record;
  v_from        text;
  v_reseal_from bigint;
  v_row         jsonb;
  v_seq         bigint;
  v_prev        text;
  v_hash        text;
  v_expected    text;
  v_before      bigint;
  v_cover       integer;
  v_last_seq    bigint := -1;
  v_last_hash   text;
  v_count       integer := 0;
  v_applied     integer := 0;
BEGIN
  SELECT t.operator_id, t.reseal_from INTO v_ticket
    FROM public.audit_purge_ticket AS t
   WHERE t.xact_id = pg_current_xact_id()
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit re-seal: no operator purge is open in this transaction' USING ERRCODE = 'ZA003';
  END IF;
  v_from := v_ticket.operator_id; v_reseal_from := v_ticket.reseal_from;
  IF p_operator_id IS DISTINCT FROM v_from THEN
    RAISE EXCEPTION 'audit re-seal: the open purge targets %, not %', v_from, p_operator_id
      USING ERRCODE = 'ZA003';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'audit re-seal: the rows must arrive as an array' USING ERRCODE = '22023';
  END IF;

  -- Nothing may be sealed when the account wrote no audit row, and the tail must be complete.
  -- (Fixed 2026-11-03: the coalesce made the count cover the WHOLE trail when the account wrote no
  -- row at all, so the emptiness check below was unreachable and a fresh account could never be
  -- deleted (ZA006 against an empty seal). An account with no history has an empty tail.)
  SELECT count(*) INTO v_cover FROM public.audit_log WHERE v_reseal_from IS NOT NULL AND seq > v_reseal_from;
  IF v_cover <> jsonb_array_length(p_rows) THEN
    RAISE EXCEPTION 'audit re-seal: the tail holds % row(s), the caller sealed %', v_cover, jsonb_array_length(p_rows)
      USING ERRCODE = 'ZA006';
  END IF;
  IF v_reseal_from IS NULL THEN
    -- The account wrote no audit row: the chain never mentions it and nothing has to be sealed. The
    -- head is answered as it stands, because the caller still has to be told where the chain ends.
    IF jsonb_array_length(p_rows) > 0 THEN
      RAISE EXCEPTION 'audit re-seal: the removed account wrote no row, so there is nothing to seal' USING ERRCODE = 'ZA006';
    END IF;
    DELETE FROM public.audit_purge_ticket WHERE xact_id = pg_current_xact_id();
    RETURN jsonb_build_object('headSeq', (SELECT h.seq FROM public.audit_chain_head AS h WHERE h.singleton),
                              'headHash', (SELECT h.hash FROM public.audit_chain_head AS h WHERE h.singleton),
                              'rows', 0, 'operatorId', v_from);
  END IF;

  -- Where the new tail has to continue from: the newest surviving row below the removed range.
  SELECT l.hash INTO v_expected FROM public.audit_log AS l
   WHERE l.seq < v_reseal_from ORDER BY l.seq DESC LIMIT 1;
  IF v_expected IS NULL THEN v_expected := repeat('0', 64); END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_seq  := (v_row ->> 'seq')::bigint;
    v_prev := v_row ->> 'prevHash';
    v_hash := v_row ->> 'hash';
    IF v_seq IS NULL OR v_seq <= v_reseal_from THEN
      RAISE EXCEPTION 'audit re-seal: row % is outside the tail that starts after %', v_seq, v_reseal_from
        USING ERRCODE = 'ZA006';
    END IF;
    IF v_hash !~ '^[0-9a-f]{64}$' OR v_prev !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'audit re-seal: row % carries a hash that is not 64 lower-case hex digits', v_seq
        USING ERRCODE = 'ZA006';
    END IF;
    IF v_seq <= v_last_seq THEN
      RAISE EXCEPTION 'audit re-seal: row % does not follow row %', v_seq, v_last_seq USING ERRCODE = 'ZA006';
    END IF;
    IF v_prev <> v_expected THEN
      RAISE EXCEPTION 'audit re-seal: row % continues %, not the row before it', v_seq, v_prev USING ERRCODE = 'ZA001';
    END IF;

    -- The match on every stored column is what makes this a two-column update and nothing more.
    UPDATE public.audit_log AS l
       SET prev_hash = v_prev, hash = v_hash
     WHERE l.seq = v_seq
       AND l.id = (v_row ->> 'id')
       AND l.at = (v_row ->> 'at')::bigint
       AND l.type = (v_row ->> 'type')
       AND l.category = (v_row ->> 'category')
       AND l.severity = (v_row ->> 'severity')
       AND l.actor_id IS NOT DISTINCT FROM (v_row ->> 'actorId')
       AND l.message = (v_row ->> 'message')
       AND l.session_id IS NOT DISTINCT FROM (v_row ->> 'sessionId')
       AND l.evidence_id IS NOT DISTINCT FROM (v_row ->> 'evidenceId')
       AND l.device_id IS NOT DISTINCT FROM (v_row ->> 'deviceId')
       AND l.details IS NOT DISTINCT FROM (v_row -> 'details');
    GET DIAGNOSTICS v_applied = ROW_COUNT;
    IF v_applied <> 1 THEN
      RAISE EXCEPTION 'audit re-seal: row % is not the row the caller described', v_seq USING ERRCODE = 'ZA006';
    END IF;

    v_expected  := v_hash;
    v_last_seq  := v_seq;
    v_last_hash := v_hash;
    v_count     := v_count + 1;
  END LOOP;

  UPDATE public.audit_chain_head SET seq = v_last_seq, hash = v_last_hash WHERE singleton;
  -- The seal is done: close the ticket so no later statement in this transaction can delete again.
  DELETE FROM public.audit_purge_ticket WHERE xact_id = pg_current_xact_id();
  RETURN jsonb_build_object('headSeq', v_last_seq, 'headHash', v_last_hash, 'rows', v_count, 'operatorId', v_from);
END
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.audit_purge_operator(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_purge_reseal(text, jsonb)        FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.audit_purge_operator(text, text, text) TO dems_app;
-- The ledger is read by the engine (boot check B-8 needs the ranges to judge a gap) and written by
-- the purge function alone: `dems_app` gets SELECT and nothing else, so it cannot add a range that
-- forgives a gap it caused by other means, and cannot remove one that was recorded.
GRANT SELECT ON public.audit_purge_log TO dems_app;
GRANT  EXECUTE ON FUNCTION public.audit_purge_reseal(text, jsonb)        TO dems_app;
