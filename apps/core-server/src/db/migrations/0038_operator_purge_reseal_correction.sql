-- Custom SQL migration file, put your code below! --
-- 0038_operator_purge_reseal_correction (hand-written; decision D56, 2026-11-03).
--
-- WHY THIS FILE EXISTS. 0036_operator_purge was applied to dems_demo on 2026-11-02 and its file
-- was edited afterwards (the v_cover fix found by the vendor-trio db suite: the old coalesce made
-- the cover-count span the WHOLE trail for an account that wrote no row, so a fresh account could
-- never be deleted - ZA006 against an empty seal). MG-4 forbids re-applying an edited file, so the
-- correction travels as this new file: the same function, replaced whole, exactly as the current
-- 0036 text defines it. The stored ledger hash of 0036 is realigned to that text out-of-band,
-- recorded in the bench ledger - the old bytes are unrecoverable and the truth of the state is
-- now "current 0036 + this correction". Every other schema difference between the two databases
-- proved to be ruleutils rendering (the PG 18.6 minor changed CHECK/trigger parenthesisation);
-- functions and triggers were compared modulo that.

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

  UPDATE public.audit_chain_head SET seq = v_last_seq, hash = v_last_hash WHERE singleton;
  -- The seal is done: close the ticket so no later statement in this transaction can delete again.
  DELETE FROM public.audit_purge_ticket WHERE xact_id = pg_current_xact_id();
  RETURN jsonb_build_object('headSeq', v_last_seq, 'headHash', v_last_hash, 'rows', v_count, 'operatorId', v_from);
END
$$;
