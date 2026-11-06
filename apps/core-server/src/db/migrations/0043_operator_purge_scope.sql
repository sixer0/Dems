-- Custom SQL migration file, put your code below!
-- 0043_operator_purge_scope (hand-written; the 0038 pattern; DF-28, decisions D22(1), D22(4), D38 DR-1, D43; row 95).
--
-- WHY THIS FILE EXISTS. The purge of 0036 erased EVERY audit row an operator wrote, so an erased
-- investigator took the evidence-chain record of his own sessions, seals and exports with him
-- (DF-28: the export row AUD-000228 is gone on the bench; that loss is recorded as history, not
-- rewritten). Decision D22(4): a purge must NOT remove evidence-chain audit events; its scope is the
-- operator's personal rows. 0036 and 0038 are applied files and stay untouched (D22(1)): the
-- function is replaced whole here, with the same signature, the same guards and the same return
-- keys, plus `accountKept` (D38 DR-1).
--
-- WHAT CHANGES, AND NOTHING ELSE:
--   1. The 28 kept audit types (register E5, D38 DR-8) are never deleted. The list below is the
--      same list as `PURGE_KEPT_AUDIT_TYPES` of `src/modules/admin/statements.ts`; a static test
--      pins the two equal.
--   2. The re-seal starts at the first REMOVED sequence, not at the first row the operator wrote:
--      a kept row below the first removed one keeps its hash. The ticket, the ledger range and the
--      answer carry that sequence; `audit_purge_reseal` (0038) is unchanged and seals every
--      surviving row above it, the kept rows of the operator included.
--   3. The ledger range is first..last REMOVED sequence. A kept row inside that range is present
--      and chained, so boot check B-8 forgives exactly the holes the erasure made.
--   4. D38 DR-1: `audit_log.actor_id` and `audit_chain_history.actor_id` are ON DELETE RESTRICT by
--      design (append-only and hashed; never set to NULL). When kept rows still name the operator,
--      the account row stays as a DISABLED row (credentials, sign-ins, tokens and pairing codes
--      are deleted as before) and the answer says `accountKept: true`; otherwise the row is
--      deleted as before.
--   5. D43: a purge whose target is a party of the active session (investigator, creator, starter
--      or stopper) is refused before any write (SQLSTATE ZA007). The active session is never
--      deleted by a purge any more; `activeSessions` stays in the answer and is always 0.
--
--   6. Cycle 3 (decision D67; DB window DBW1 finding R-1): `audit_purge_reseal` is replaced too, with
--      the 0038 body plus ONE branch. When the removed rows are the newest rows of the chain, the
--      tail is empty and 0038 set the head to (-1, NULL), which the NOT NULL and CHECK of
--      `audit_chain_head` refuse. The head now goes back to the newest surviving row, or to the
--      genesis state (0, 64 zeros) when none survives. 0038 stays untouched (D22(1)); the search
--      path is the one 0038 pinned, and CREATE OR REPLACE keeps the owner and the 0036 grants.
--
-- `audit_chain_history` rows are chain-reset records (RESET / SCENARIO_LOAD, 0001_tables.sql) with
-- no audit type; their reset row is not an E5 type, so they go with the account as in 0036.
--
-- NO version step (the 0038 pattern): no table, column or constraint changes, so the pair pinned by
-- boot check B-3 stays. No grant change: CREATE OR REPLACE keeps the owner and the EXECUTE grants
-- of 0036 (revoked from PUBLIC, granted to dems_app).
CREATE OR REPLACE FUNCTION public.audit_purge_operator(p_operator_id text, p_actor_id text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  -- The evidence-chain types a purge never removes (D22(4); register E5).
  v_kept CONSTANT text[] := ARRAY[
    'SESSION_CREATED', 'PRECHECK_PASSED', 'PRECHECK_BLOCKED', 'RECORDING_STARTED', 'RECORDING_STOPPED',
    'SESSION_CANCELLED', 'SESSION_INCOMPLETE', 'SUMMARY_ACKNOWLEDGED', 'MARKER_ADDED', 'NOTE_ADDED',
    'SNAPSHOT_TAKEN', 'AUDIO_SOURCE_SWITCHED', 'RECOVERY_STARTED', 'RECOVERY_COMPLETED',
    'EVIDENCE_SEALED', 'FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED',
    'EVIDENCE_VERIFIED', 'EVIDENCE_VERIFY_FAILED',
    'EVIDENCE_EXPORTED', 'EVIDENCE_EXPORT_FAILED', 'EXPORT_DENIED', 'AUDIT_EXPORTED', 'EVIDENCE_ARCHIVED',
    'EVIDENCE_REVIEW_OPENED', 'EVIDENCE_MEDIA_SERVED', 'TRANSCRIPT_REVISED'
  ];
  v_root         text;
  v_session      text;
  v_first        bigint;
  v_last         bigint;
  v_audit        integer := 0;
  v_lineage      integer := 0;
  v_signins      integer := 0;
  v_tokens       integer := 0;
  v_credential   integer := 0;
  v_codes        integer := 0;
  v_sessions     integer := 0;
  v_account_kept boolean := false;
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
  -- holding USER_ADMIN (the administrator is whoever's ROLE holds the USER_ADMIN PERMISSION).
  IF EXISTS (SELECT 1 FROM public.operators AS t JOIN public.role_permissions AS rp ON rp.role_id = t.role_id
              WHERE rp.permission_id = 'USER_ADMIN' AND t.id = p_operator_id AND t.enabled)
     AND NOT EXISTS (SELECT 1 FROM public.operators AS t JOIN public.role_permissions AS rp ON rp.role_id = t.role_id
              WHERE rp.permission_id = 'USER_ADMIN' AND t.id <> p_operator_id AND t.enabled) THEN
    RAISE EXCEPTION 'operator purge: % is the last enabled operator holding USER_ADMIN', p_operator_id
      USING ERRCODE = 'ZA005';
  END IF;

  -- D43: never under a running session. A party of the active session is refused before anything
  -- is written; the engine refuses it first (409 INVALID_STATE), this is the database's own guard.
  SELECT s.id INTO v_session FROM public.active_session AS s
   WHERE s.investigator_id = p_operator_id OR s.created_by = p_operator_id
      OR s.started_by = p_operator_id OR s.stopped_by = p_operator_id;
  IF v_session IS NOT NULL THEN
    RAISE EXCEPTION 'operator purge: % is a party of the active session %', p_operator_id, v_session
      USING ERRCODE = 'ZA007';
  END IF;

  -- The removed range: the operator's rows that are NOT evidence-chain rows.
  SELECT min(seq), max(seq) INTO v_first, v_last FROM public.audit_log
   WHERE actor_id = p_operator_id AND type <> ALL (v_kept);

  -- Garbage-collect tickets left behind by purges that committed without a re-seal.
  DELETE FROM public.audit_purge_ticket WHERE xact_id <> pg_current_xact_id();

  -- The ticket: one row, stamped with this transaction; it opens the append-only guards and names
  -- the first removed sequence the re-seal starts from.
  INSERT INTO public.audit_purge_ticket (operator_id, reseal_from, xact_id)
  VALUES (p_operator_id, v_first, pg_current_xact_id());

  DELETE FROM public.audit_chain_history  WHERE actor_id = p_operator_id;
  GET DIAGNOSTICS v_lineage  = ROW_COUNT;
  DELETE FROM public.audit_log            WHERE actor_id = p_operator_id AND type <> ALL (v_kept);
  GET DIAGNOSTICS v_audit    = ROW_COUNT;
  DELETE FROM public.auth_sessions        WHERE operator_id = p_operator_id;
  GET DIAGNOSTICS v_signins  = ROW_COUNT;
  DELETE FROM public.biometric_tokens     WHERE operator_id = p_operator_id;
  GET DIAGNOSTICS v_tokens   = ROW_COUNT;
  DELETE FROM public.operator_credentials WHERE operator_id = p_operator_id;
  GET DIAGNOSTICS v_credential = ROW_COUNT;
  DELETE FROM public.pairing_codes        WHERE issued_by_operator_id = p_operator_id;
  GET DIAGNOSTICS v_codes    = ROW_COUNT;
  -- D43: the active session is not deleted; the refusal above guarantees no row names the target.

  -- The ledger entry, only when rows actually went: the table records erasures, not no-ops.
  IF v_first IS NOT NULL THEN
    INSERT INTO public.audit_purge_log (operator_id, actor_id, at, first_seq, last_seq, rows_removed, reason)
    VALUES (p_operator_id, p_actor_id, (extract(epoch from clock_timestamp()) * 1000)::bigint,
            v_first, v_last, v_audit, btrim(p_reason));
  END IF;

  -- D38 DR-1: kept rows name the operator through a RESTRICT key that is never set to NULL, so the
  -- account row stays, disabled, while one of them exists. Otherwise it goes, and every reference
  -- of the unit that still points here answers SET NULL as before.
  v_account_kept := EXISTS (SELECT 1 FROM public.audit_log WHERE actor_id = p_operator_id);
  IF v_account_kept THEN
    UPDATE public.operators
       SET enabled = false, updated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
     WHERE id = p_operator_id;
  ELSE
    DELETE FROM public.operators WHERE id = p_operator_id;
  END IF;

  RETURN jsonb_build_object(
    'operatorId', p_operator_id,
    'auditRows', v_audit,
    'lineageRows', v_lineage,
    'signInRows', v_signins,
    'biometricTokens', v_tokens,
    'credentialsRemoved', v_credential,
    'pairingCodes', v_codes,
    'activeSessions', v_sessions,
    'resealFromSeq', v_first,
    'accountKept', v_account_kept);
END
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.audit_purge_reseal(p_operator_id text, p_rows jsonb)
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

  -- 0043 (row 95 cycle 3, D67): an EMPTY tail. The removed rows were the newest, so no row follows
  -- them and the loop above never ran (v_last_seq -1, v_last_hash NULL). The head goes back to the
  -- newest surviving row below the removed range, or to the genesis state of an empty log (0002:
  -- seq 0, 64 zero digits). Never NULL.
  IF v_count = 0 THEN
    SELECT l.seq, l.hash INTO v_last_seq, v_last_hash FROM public.audit_log AS l
     WHERE l.seq < v_reseal_from ORDER BY l.seq DESC LIMIT 1;
    IF NOT FOUND THEN
      v_last_seq := 0; v_last_hash := repeat('0', 64);
    END IF;
  END IF;
  UPDATE public.audit_chain_head SET seq = v_last_seq, hash = v_last_hash WHERE singleton;
  -- The seal is done: close the ticket so no later statement in this transaction can delete again.
  DELETE FROM public.audit_purge_ticket WHERE xact_id = pg_current_xact_id();
  RETURN jsonb_build_object('headSeq', v_last_seq, 'headHash', v_last_hash, 'rows', v_count, 'operatorId', v_from);
END
$$;
