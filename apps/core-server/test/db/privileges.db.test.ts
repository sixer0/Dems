// Roles and privileges (database contract §7; CL-11; SR-68, AC-B-54, AC-B-87): T-PV-1 and T-PV-2.
//
// The expected matrix below is written from the table of contract §7.3, not from the migration
// file. T-PV-1 compares it with the catalog (`has_table_privilege`, `has_column_privilege`) and
// then with LIVE statements as `dems_app`: for every table one SELECT, INSERT, DELETE and
// TRUNCATE, and one UPDATE for each of the 498 columns. The statements match no row
// (`WHERE false`), so an allowed one changes nothing; a privilege is checked before any row is
// looked at, so a forbidden one fails with 42501 all the same.
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { readInventory } from './contract-inventory';
import { SQLSTATE, connect, expectRefused, refusalOf } from './support';

const db = useTestDatabase({ template: 'schema' });
const inventory = readInventory();
let app: Pool;
let owner: Pool;

beforeAll(() => {
  app = db.appPool();
  owner = db.ownerPool();
});

interface Grant {
  readonly insert?: true;
  /** False where the runtime role holds NO table-level SELECT (dbc-3 §D carve-out, §B.13). */
  readonly select?: false;
  /**
   * When `select` is false: the columns that DO carry a column-level SELECT (0007 :14-16). The
   * statement probes below must factor this in: an UPDATE that reads the row cannot touch a
   * column the role cannot read, even where the UPDATE grant itself exists.
   */
  readonly selectColumns?: readonly string[];
  /** The columns the runtime role may update; `all` for `active_session`. */
  readonly update?: readonly string[] | 'all';
  readonly delete?: true;
}

/**
 * Contract §7.3 composed with dbc-3 §D/§B.13 (ruling D44 R1: the closed task-2 table is the base;
 * 0005/0007 write the v2 rows). SELECT is granted on every table except the two write-only secret
 * stores; TRUNCATE, REFERENCES and TRIGGER on none.
 */
const MATRIX: Readonly<Record<string, Grant>> = {
  roles: {},
  permissions: {},
  role_permissions: {},
  operators: { update: ['role_id', 'enabled', 'last_sign_in_at', 'role_changed_at', 'updated_at'] },
  operator_credentials: { update: ['algorithm', 'memory_kib', 'passes', 'parallelism', 'salt', 'hash', 'hashed_at'] },
  auth_sessions: { insert: true, update: ['last_seen_at', 'ended_at', 'end_reason'] },
  pairing_codes: { insert: true, update: ['state', 'failed_attempts', 'closed_at', 'closed_by_operator_id'] },
  paired_devices: {
    insert: true,
    update: ['state', 'last_seen_at', 'revoked_at', 'revoked_by_operator_id', 'revoke_reason', 'unpaired_at', 'updated_at'],
  },
  device_credentials: { insert: true, update: ['current_hash', 'next_hash', 'rotated_at'] },
  biometric_tokens: { insert: true, update: ['used_at', 'revoked_at', 'revoke_reason'] },
  registry_counters: { update: ['next_value'] },
  audit_log: { insert: true },
  audit_chain_head: {},
  events: { insert: true },
  active_session: { insert: true, update: 'all', delete: true },
  session_history: { insert: true },
  evidence_items: {
    insert: true,
    update: ['status', 'lifecycle_stage', 'verification_status', 'verification_at', 'tampered', 'tampered_track_id', 'updated_at'],
  },
  evidence_tracks: { insert: true },
  evidence_custody: { insert: true },
  exports: { insert: true },
  alerts: { insert: true, update: ['active', 'acknowledged', 'resolved_at'] },
  storage_policy: { update: ['retention_policy', 'retention_days', 'auto_archive', 'updated_at'] },
  console_settings: { update: ['presentation_mode', 'time_format', 'notify_warnings', 'notify_sound', 'updated_at'] },
  engine_counters: { insert: true, update: ['next_value'] },
  core_device: { update: ['software_version', 'core_software_version', 'updated_at'] },
  core_state: { update: ['epoch', 'last_sealed_session_id', 'last_sealed_acknowledged', 'updated_at'] },
  hardware_snapshot: {
    update: [
      'tablet_link', 'active_camera_id', 'cameras', 'mics', 'storage', 'time_status', 'network', 'security',
      'services', 'health', 'other_devices', 'ports', 'faults', 'diagnostics', 'software_update', 'written_at',
    ],
  },
  health_snapshots: { insert: true },
  schema_meta: {},
  audit_chain_history: {},
  // ── schema v2 (dbc-3 §D in 0005, §B.13 in 0007). The credential store holds no table-level
  //    SELECT at all: the reveal goes through dems_capture_credential_reveal(text) only;
  //    stt_config holds column-level SELECT/UPDATE over the non-secret columns (0007 :14-26). ──
  capture_config: {
    update: ['video_01_device_id', 'video_01_profile', 'video_02_device_id', 'video_02_profile',
      'mic_primary_id', 'mic_standby_id', 'revision', 'updated_by', 'updated_at'],
  },
  capture_devices: {
    insert: true,
    update: ['transport', 'model', 'firmware', 'address', 'mac', 'onvif_uuid', 'profiles', 'poe_port', 'enabled', 'last_seen_at'],
  },
  capture_device_credentials: {
    select: false,
    // 0010 (row 129a, erratum PE-129a-01; finding F-84-1): the key column alone, so that a stored
    // credential can be replaced (`WHERE device_id`, `ON CONFLICT (device_id)`). Nothing else.
    selectColumns: ['device_id'],
    insert: true,
    update: ['username', 'encryption', 'secret_ciphertext', 'nonce', 'key_ref', 'rotated_at'],
  },
  session_audio_intervals: { insert: true, update: ['to_media_ms', 'to_at'] },
  recording_fragments: { insert: true },
  transcript_chunks: { insert: true, update: ['status', 'segments', 'embedding_ref', 'model_id', 'computed_at'] },
  transcripts: { insert: true },
  transcript_revisions: { insert: true },
  sealing_jobs: {
    insert: true,
    update: ['status', 'progress', 'eta_ms', 'attempt', 'checkpoint', 'error_code', 'updated_at'],
  },
  stt_config: {
    select: false,
    selectColumns: ['singleton', 'enabled', 'backend', 'endpoint', 'model', 'language', 'diarization',
      'credential_kind', 'revision', 'updated_by', 'updated_at'],
    update: ['singleton', 'enabled', 'backend', 'endpoint', 'model', 'language', 'diarization',
      'credential_kind', 'credential_ref', 'secret_ciphertext', 'nonce', 'revision', 'updated_by', 'updated_at'],
  },
  // ── schema v3 (dbc-4 §N.8, `0009`). T-41 is INSERT-ONLY: SELECT and INSERT, no UPDATE, no
  //    DELETE. The two columns 0008 added join NO update list above: `capture_devices` stays at
  //    its 10 columns (not `adapter_kind`) and `evidence_items` at its 7 (not
  //    `development_sources`) - the per-column probes below prove both as dems_app (M4-MT-11). ──
  session_capture_sources: { insert: true },
  // ── schema v5 (erratum PE-129b-01, `0012`). T-42 is INSERT-ONLY too: SELECT and INSERT. ──
  session_stt_config: { insert: true },
  // ── schema v6 (erratum PE-0013-01, `0014`). T-43 holds one row the Core replaces at boot:
  //    SELECT, INSERT and UPDATE on its two value columns; no DELETE. `alerts.reason` joins NO
  //    update list: `alerts` stays at its three life-cycle columns. ──
  core_media_store: { insert: true, update: ['media_root', 'recorded_at'] },
  // ── schema v7 (task 4 schema set A, `0016`). T-44 and T-45: SELECT, INSERT, and UPDATE on every
  //    column but the key columns - and, for T-45, but `sample_rate`; no DELETE.
  //    `session_capture_sources.source_facts` joins NO update list: T-41 stays INSERT-only. The
  //    update list of `capture_config` above is unchanged: its six slot columns became nullable,
  //    their grant is the one of 0005. ──
  capture_device_streams: {
    insert: true,
    update: ['onvif_profile_token', 'video_source_token', 'lens', 'stream_role', 'codec', 'width', 'height', 'read_at'],
  },
  // Since schema v8 (`0018`) the list of T-45 also holds `usb_serial` and `usb_port`: card facts
  // like `usb_id`, updated with it.
  capture_audio_inputs: {
    insert: true,
    update: ['usb_id', 'card_id', 'card_device', 'input_number', 'native_channels', 'sample_bits', 'updated_by', 'updated_at', 'usb_serial', 'usb_port'],
  },
  // ── schema v8 (task 4 schema set B, `0018`). T-46 holds one row: SELECT, INSERT (the default row
  //    at first use) and UPDATE on every column but the key; no DELETE. T-47: SELECT, INSERT, and
  //    UPDATE on the lifetime and the four removal columns only - what the alias IS (interface,
  //    address, reason, who added it and when) is never rewritten; no DELETE. ──
  capture_network_config: {
    insert: true,
    // `onvif_ports` since schema v14 (`0031`): the same rule, every column but the key.
    update: ['interface_name', 'camera_subnet', 'factory_addresses', 'alias_host', 'alias_minutes', 'camera_ip_start', 'revision', 'updated_by', 'updated_at', 'onvif_ports'],
  },
  host_network_aliases: {
    insert: true,
    update: ['expires_at', 'removed_at', 'remove_reason', 'removed_by', 'remove_error'],
  },
  // ── schema v11 (task 4 schema set C, `0025`). T-48: SELECT, INSERT, and UPDATE on the three
  //    revoke columns only - what was accepted (who, when, the version, the site, the steps, the
  //    diagnostics) is never rewritten; no DELETE. ──
  installation_acceptances: {
    insert: true,
    update: ['revoked_at', 'revoked_by', 'revoke_reason'],
  },
};

const columnsOf = (table: string): string[] => inventory.tables.find((entry) => entry.name === table)?.columns.map((column) => column.name) ?? [];
const mayUpdate = (table: string, column: string): boolean => {
  const update = MATRIX[table]?.update;
  return update === 'all' || (update?.includes(column) ?? false);
};
/** Can the runtime role read this column at all (table-level SELECT or the §B.13 column list)? */
const readable = (table: string, column: string): boolean => {
  const grant = MATRIX[table] ?? {};
  return grant.select !== false || (grant.selectColumns?.includes(column) ?? false);
};

describe('T-PV-1: the privileges of dems_app equal the matrix of contract §7.3', () => {
  it('the matrix names all 48 tables; INSERT on 32 of them, not on audit_chain_history (D18; dbc-3 §D; dbc-4 §N.11; PE-129b-01; PE-0013-01; task 4 schema sets A, B and C)', () => {
    expect(Object.keys(MATRIX).sort()).toEqual(inventory.tables.map((table) => table.name).sort());
    const insertable = Object.entries(MATRIX).filter(([, grant]) => grant.insert === true).map(([table]) => table);
    expect(insertable).toHaveLength(32);
    expect(insertable).not.toContain('audit_chain_history');
    for (const [table, grant] of Object.entries(MATRIX)) {
      if (Array.isArray(grant.update)) for (const column of grant.update) expect(columnsOf(table), `${table}.${column}`).toContain(column);
    }
  });

  it('catalog: for every table and every privilege, has_table_privilege equals the matrix', async () => {
    const { rows } = await owner.query<Record<string, string | boolean>>(
      `SELECT c.relname::text AS table_name,
              has_table_privilege('dems_app', c.oid, 'SELECT') AS "SELECT",
              has_table_privilege('dems_app', c.oid, 'INSERT') AS "INSERT",
              has_table_privilege('dems_app', c.oid, 'UPDATE') AS "UPDATE",
              has_table_privilege('dems_app', c.oid, 'DELETE') AS "DELETE",
              has_table_privilege('dems_app', c.oid, 'TRUNCATE') AS "TRUNCATE",
              has_table_privilege('dems_app', c.oid, 'REFERENCES') AS "REFERENCES",
              has_table_privilege('dems_app', c.oid, 'TRIGGER') AS "TRIGGER",
              has_table_privilege('dems_app', c.oid, 'MAINTAIN') AS "MAINTAIN",
              has_any_column_privilege('dems_app', c.oid, 'INSERT') AS any_column_insert,
              has_any_column_privilege('dems_app', c.oid, 'REFERENCES') AS any_column_references,
              pg_get_userbyid(c.relowner)::text AS owner
         FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' ORDER BY 1`,
    );
    const expected = Object.keys(MATRIX)
      .sort()
      .map((table) => ({
        table_name: table,
        SELECT: MATRIX[table]?.select !== false,
        INSERT: MATRIX[table]?.insert === true,
        UPDATE: MATRIX[table]?.update === 'all',
        DELETE: MATRIX[table]?.delete === true,
        TRUNCATE: false,
        REFERENCES: false,
        TRIGGER: false,
        MAINTAIN: false,
        any_column_insert: MATRIX[table]?.insert === true,
        any_column_references: false,
        owner: 'dems_owner',
      }));
    expect(rows).toEqual(expected);
  });

  it('catalog: for each of the 498 columns, has_column_privilege(UPDATE) equals the matrix', async () => {
    const { rows } = await owner.query<{ table_name: string; column_name: string; can_update: boolean }>(
      `SELECT c.relname::text AS table_name, a.attname::text AS column_name,
              has_column_privilege('dems_app', c.oid, a.attnum, 'UPDATE') AS can_update
         FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY 1, a.attnum`,
    );
    expect(rows).toHaveLength(498);
    const wrong = rows.filter((row) => row.can_update !== mayUpdate(row.table_name, row.column_name));
    expect(wrong).toEqual([]);
    const granted = rows.filter((row) => row.can_update).length;
    console.info(`[w17] T-PV-1: UPDATE is granted on ${granted} of 498 columns (30 of them are every column of active_session, 14 every column of stt_config)`);
  });

  it('LIVE as dems_app: SELECT, INSERT, DELETE and TRUNCATE on every table behave as the matrix says', async () => {
    const outcomes: string[] = [];
    const attempt = async (statement: string): Promise<string> => {
      try {
        await app.query(statement);
        return 'ok';
      } catch (error) {
        return refusalOf(error).code ?? 'error';
      }
    };
    for (const table of Object.keys(MATRIX).sort()) {
      const grant = MATRIX[table] ?? {};
      const got = {
        select: await attempt(`SELECT count(*) FROM public.${table}`),
        insert: await attempt(`INSERT INTO public.${table} SELECT * FROM public.${table} WHERE false`),
        delete: await attempt(`DELETE FROM public.${table} WHERE false`),
        truncate: await attempt(`TRUNCATE public.${table}`),
      };
      const want = {
        // A table-level SELECT is granted on every matrix table except the two secret stores. For
        // stt_config the column-level SELECT of 0007 suffices for a `count(*)` (measured), and since
        // 0010 so does the one key column of capture_device_credentials. The INSERT probe (`INSERT ... SELECT *
        // FROM ... WHERE false`) additionally reads every column of the source, so it is refused
        // wherever the role cannot read the table even though the INSERT grant itself exists -
        // the catalog test above pins the grants, this test pins the statement behaviour.
        select: grant.select === false && grant.selectColumns === undefined ? SQLSTATE.insufficientPrivilege : 'ok',
        insert: grant.insert === true && grant.select !== false ? 'ok' : SQLSTATE.insufficientPrivilege,
        delete: grant.delete === true ? 'ok' : SQLSTATE.insufficientPrivilege,
        truncate: SQLSTATE.insufficientPrivilege,
      };
      if (JSON.stringify(got) !== JSON.stringify(want)) outcomes.push(`${table}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    }
    expect(outcomes).toEqual([]);
    // The §B.13 column carve-out of stt_config, probed on columns directly: the runtime role reads
    // the configuration columns and none of the three credential columns (0007 :14-18).
    await expectRefused(() => app.query('SELECT secret_ciphertext FROM public.stt_config'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('SELECT nonce FROM public.stt_config'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('SELECT credential_ref FROM public.stt_config'), SQLSTATE.insufficientPrivilege);
    expect((await app.query('SELECT enabled, backend, model, language FROM public.stt_config')).rows).toEqual([]);
    // The credential store of T-33 stays unreadable by column too (reveal function only, §B.3).
    await expectRefused(() => app.query('SELECT secret_ciphertext FROM public.capture_device_credentials'), SQLSTATE.insufficientPrivilege);
  });

  it('catalog + LIVE: has_column_privilege(SELECT) equals the matrix on all 498 columns; of the credential store only device_id is readable (0010, PE-129a-01)', async () => {
    const { rows } = await owner.query<{ table_name: string; column_name: string; can_select: boolean }>(
      `SELECT c.relname::text AS table_name, a.attname::text AS column_name,
              has_column_privilege('dems_app', c.oid, a.attnum, 'SELECT') AS can_select
         FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY 1, a.attnum`,
    );
    expect(rows).toHaveLength(498);
    expect(rows.filter((row) => row.can_select !== readable(row.table_name, row.column_name))).toEqual([]);
    // The unreadable columns of the whole schema are exactly these nine: six of T-33, three of T-40.
    expect(rows.filter((row) => !row.can_select).map((row) => `${row.table_name}.${row.column_name}`).sort()).toEqual([
      'capture_device_credentials.encryption',
      'capture_device_credentials.key_ref',
      'capture_device_credentials.nonce',
      'capture_device_credentials.rotated_at',
      'capture_device_credentials.secret_ciphertext',
      'capture_device_credentials.username',
      'stt_config.credential_ref',
      'stt_config.nonce',
      'stt_config.secret_ciphertext',
    ]);
    // LIVE, one statement per column of T-33, and the whole-row form.
    for (const column of columnsOf('capture_device_credentials')) {
      const read = app.query(`SELECT "${column}" FROM public.capture_device_credentials`);
      if (column === 'device_id') expect((await read).rows).toEqual([]);
      else await expectRefused(() => read, SQLSTATE.insufficientPrivilege);
    }
    await expectRefused(() => app.query('SELECT * FROM public.capture_device_credentials'), SQLSTATE.insufficientPrivilege);
  });

  it('LIVE as dems_app: one UPDATE per column, 498 statements; allowed exactly where the matrix grants it', async () => {
    const wrong: string[] = [];
    let allowed = 0;
    let refused = 0;
    for (const table of inventory.tables) {
      for (const column of table.columns) {
        let outcome = 'ok';
        try {
          await app.query(`UPDATE public.${table.name} SET "${column.name}" = "${column.name}" WHERE false`);
        } catch (error) {
          outcome = refusalOf(error).code ?? 'error';
        }
        // The probe reads the column itself (`SET x = x WHERE false`), so a column with an UPDATE
        // grant the role cannot read is refused by the privilege algebra (measured: stt_config's
        // three credential columns). The catalog test pins the grant; this test pins the statement.
        const want = mayUpdate(table.name, column.name) && readable(table.name, column.name) ? 'ok' : SQLSTATE.insufficientPrivilege;
        if (outcome === 'ok') allowed += 1;
        else refused += 1;
        if (outcome !== want) wrong.push(`${table.name}.${column.name}: ${outcome}, expected ${want}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(allowed + refused).toBe(498);
    console.info(`[w17] T-PV-1 live: ${allowed} column UPDATEs allowed, ${refused} refused with 42501, 0 unexpected`);
  });

  it('functions: dems_app may execute audit_chain_lock(), dems_jsonb_is_flat(jsonb) and the two reveal functions only; PUBLIC none (OW-4, PG-17; dbc-3 §B.3, §B.13)', async () => {
    const { rows } = await owner.query(
      `SELECT p.proname::text AS name, has_function_privilege('dems_app', p.oid, 'EXECUTE') AS app,
              has_function_privilege('public', p.oid, 'EXECUTE') AS everyone
         FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY 1`,
    );
    expect(rows).toEqual([
      { name: 'audit_chain_history_refuse_change', app: false, everyone: false },
      { name: 'audit_chain_lock', app: true, everyone: false },
      { name: 'audit_log_guard_insert', app: false, everyone: false },
      { name: 'audit_log_refuse_change', app: false, everyone: false },
      { name: 'dems_capture_credential_reveal', app: true, everyone: false },
      { name: 'dems_jsonb_is_flat', app: true, everyone: false },
      { name: 'dems_stt_credential_reveal', app: true, everyone: false },
    ]);
    // Live: the functions it may call answer (the reveals on the empty databases return no row -
    // EXECUTE holds, the secret columns stay behind the SECURITY DEFINER fence); the three trigger
    // functions are refused by privilege.
    expect((await app.query(`SELECT username FROM public.dems_capture_credential_reveal('CAM-01')`)).rows).toEqual([]);
    expect((await app.query(`SELECT credential_kind FROM public.dems_stt_credential_reveal()`)).rows).toEqual([]);
    expect((await app.query(`SELECT public.dems_jsonb_is_flat('{"a": 1, "b": null}'::jsonb) AS flat, public.dems_jsonb_is_flat('{"a": {"b": 1}}'::jsonb) AS nested, public.dems_jsonb_is_flat('[1]'::jsonb) AS list`)).rows).toEqual([
      { flat: true, nested: false, list: false },
    ]);
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      expect((await client.query('SELECT seq::int AS seq, hash FROM public.audit_chain_lock()')).rows).toEqual([{ seq: 0, hash: '0'.repeat(64) }]);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    for (const name of ['audit_log_guard_insert', 'audit_log_refuse_change', 'audit_chain_history_refuse_change']) {
      await expectRefused(() => app.query(`SELECT public.${name}()`), SQLSTATE.insufficientPrivilege);
    }
  });

  it('a trigger function fires for dems_app without EXECUTE on it; a function called by a CHECK is checked for the inserting role (PG-17)', async () => {
    // The guard fires on an INSERT by dems_app, which holds no EXECUTE on audit_log_guard_insert():
    // a row that does not continue the head is refused by the trigger, not by a privilege.
    await expectRefused(
      () =>
        app.query(
          "INSERT INTO audit_log (seq, id, at, type, category, severity, message, prev_hash, hash) VALUES (7, 'AUD-000007', 1, 'SYSTEM_BOOT', 'SYSTEM', 'INFO', 'm', repeat('0', 64), repeat('1', 64))",
        ),
      SQLSTATE.chainDiscontinuity,
    );
    // The CHECK of events calls dems_jsonb_is_flat as the inserting role: with EXECUTE granted the
    // CHECK is evaluated and refuses a nested map.
    await expectRefused(
      () =>
        app.query(
          `INSERT INTO events (seq, id, at, type, category, severity, message, params) VALUES (1, 'LOG-000001', 1, 'SESSION_CREATED', 'SESSION', 'INFO', 'm', '{"a": {"b": 1}}')`,
        ),
      SQLSTATE.checkViolation,
      'events_params_flat_check',
    );
  });

  it('PG-17, the other half: without EXECUTE on the function a CHECK calls, an INSERT by dems_app is refused; the owner is not affected', async () => {
    const clone = await db.another({ slug: 'priv_no_execute' });
    await clone.ownerPool().query('REVOKE EXECUTE ON FUNCTION public.dems_jsonb_is_flat(jsonb) FROM dems_app');
    const insert = `INSERT INTO events (seq, id, at, type, category, severity, message, params) VALUES (1, 'LOG-000001', 1, 'SESSION_CREATED', 'SESSION', 'INFO', 'm', '{}')`;
    const refusal = await expectRefused(() => clone.appPool().query(insert), SQLSTATE.insufficientPrivilege);
    expect(refusal.message).toBe('permission denied for function dems_jsonb_is_flat');
    await clone.ownerPool().query(insert);
    // This is why 0003_privileges grants EXECUTE on that one function to the runtime role.
    await clone.ownerPool().query('GRANT EXECUTE ON FUNCTION public.dems_jsonb_is_flat(jsonb) TO dems_app');
    await clone.appPool().query(insert.replace('(1, \'LOG-000001\'', '(2, \'LOG-000002\''));
  });

  it('dems_app cannot create an object, a schema or a database, and has nothing on schema drizzle (OW-3, OW-5, PG-15)', async () => {
    await expectRefused(() => app.query('CREATE TABLE public.w17_denied (id integer)'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('CREATE SCHEMA w17_denied'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`CREATE DATABASE ${db.run.identity.prefix}x_denied`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('CREATE ROLE w17_denied'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('SELECT id, hash, created_at FROM drizzle.__drizzle_migrations'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_append_only'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('ALTER FUNCTION public.audit_chain_lock() SECURITY INVOKER'), SQLSTATE.insufficientPrivilege);

    // A GRANT to itself is NOT an error for a role that holds some privilege on the table without
    // the grant option: PostgreSQL answers with the warning 01007 and grants nothing. (Contract
    // §6.2 expected 42501 here; the outcome it wants, no new privilege, holds.) With no privilege
    // at all on the object the same statement is an error.
    const session = await connect(db.runtime, 'dems-w17-grant');
    try {
      const notices: Array<{ code: string | undefined; message: string | undefined }> = [];
      session.on('notice', (notice) => notices.push({ code: notice.code, message: notice.message }));
      await session.query('GRANT UPDATE ON public.audit_log TO dems_app');
      await session.query('GRANT INSERT ON public.audit_chain_history TO dems_app');
      expect(notices).toEqual([
        { code: '01007', message: 'no privileges were granted for "audit_log"' },
        { code: '01007', message: 'no privileges were granted for "audit_chain_history"' },
      ]);
    } finally {
      await session.end();
    }
    await expectRefused(() => app.query('GRANT EXECUTE ON FUNCTION public.audit_log_refuse_change() TO dems_app'), SQLSTATE.insufficientPrivilege);
    const unchanged = await owner.query(
      `SELECT has_any_column_privilege('dems_app', 'public.audit_log', 'UPDATE') AS audit_update,
              has_table_privilege('dems_app', 'public.audit_chain_history', 'INSERT') AS lineage_insert,
              has_function_privilege('dems_app', 'public.audit_log_refuse_change()', 'EXECUTE') AS refuse_execute`,
    );
    expect(unchanged.rows).toEqual([{ audit_update: false, lineage_insert: false, refuse_execute: false }]);

    const { rows } = await owner.query(
      `SELECT has_schema_privilege('dems_app', 'public', 'USAGE') AS public_usage,
              has_schema_privilege('dems_app', 'public', 'CREATE') AS public_create,
              has_schema_privilege('public', 'public', 'USAGE') AS everyone_public_usage,
              has_schema_privilege('dems_app', 'drizzle', 'USAGE') AS drizzle_usage,
              has_schema_privilege('dems_app', 'drizzle', 'CREATE') AS drizzle_create,
              has_database_privilege('dems_app', current_database(), 'CREATE') AS database_create,
              has_database_privilege('dems_app', current_database(), 'CONNECT') AS database_connect,
              has_database_privilege('dems_app', current_database(), 'TEMPORARY') AS database_temporary`,
    );
    expect(rows).toEqual([
      {
        public_usage: true,
        public_create: false,
        everyone_public_usage: false,
        drizzle_usage: false,
        drizzle_create: false,
        database_create: false,
        // PG-15, PG-10: a new database lets every role connect and create temporary tables; those
        // two database-level defaults are not part of the matrix and no migration changes them.
        database_connect: true,
        database_temporary: true,
      },
    ]);
  });

  it('PG-10: the privileges came with the clone; a table added without grants would be closed to dems_app (OW-6)', async () => {
    const { rows } = await owner.query<{ datname: string }>('SELECT current_database()::text AS datname');
    expect(rows[0]?.datname).toBe(db.name);
    await owner.query('CREATE TABLE public.w17_later_table (id integer PRIMARY KEY)');
    try {
      await expectRefused(() => app.query('SELECT * FROM public.w17_later_table'), SQLSTATE.insufficientPrivilege);
      const defaults = await owner.query('SELECT count(*)::int AS rows FROM pg_default_acl');
      expect(defaults.rows).toEqual([{ rows: 0 }]); // no ALTER DEFAULT PRIVILEGES (OW-6)
    } finally {
      await owner.query('DROP TABLE public.w17_later_table');
    }
  });
});

describe('T-PV-2: roles, memberships and ownership (OW-1, OW-2, OW-9; SR-68)', () => {
  it('dems_owner: CREATEDB only; dems_app: no attribute; neither is a member of a role or has members', async () => {
    const roles = await owner.query(
      `SELECT rolname::text AS rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
         FROM pg_roles WHERE rolname IN ('dems_owner', 'dems_app') ORDER BY 1`,
    );
    expect(roles.rows).toEqual([
      { rolname: 'dems_app', rolcanlogin: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false },
      { rolname: 'dems_owner', rolcanlogin: true, rolsuper: false, rolcreatedb: true, rolcreaterole: false, rolreplication: false, rolbypassrls: false },
    ]);
    const memberships = await owner.query(
      `SELECT count(*)::int AS rows FROM pg_auth_members m
        WHERE m.roleid IN (SELECT oid FROM pg_roles WHERE rolname IN ('dems_owner', 'dems_app'))
           OR m.member IN (SELECT oid FROM pg_roles WHERE rolname IN ('dems_owner', 'dems_app'))`,
    );
    expect(memberships.rows).toEqual([{ rows: 0 }]);
    const settings = await owner.query(
      `SELECT count(*)::int AS rows FROM pg_db_role_setting s
        WHERE s.setrole IN (SELECT oid FROM pg_roles WHERE rolname IN ('dems_owner', 'dems_app'))
           OR s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())`,
    );
    expect(settings.rows).toEqual([{ rows: 0 }]);
  });

  it('every object belongs to dems_owner: the database, every table, index and function of public, and schema drizzle with its table', async () => {
    const { rows } = await owner.query<{ kind: string; owner: string; total: number }>(
      `SELECT kind, owner, count(*)::int AS total FROM (
         SELECT 'database' AS kind, pg_get_userbyid(datdba)::text AS owner FROM pg_database WHERE datname = current_database()
         UNION ALL
         SELECT 'public ' || CASE c.relkind WHEN 'r' THEN 'table' WHEN 'i' THEN 'index' ELSE 'relation ' || c.relkind::text END,
                pg_get_userbyid(c.relowner)::text
           FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
         UNION ALL
         SELECT 'public function', pg_get_userbyid(p.proowner)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
         UNION ALL
         SELECT 'schema drizzle', pg_get_userbyid(n.nspowner)::text FROM pg_namespace n WHERE n.nspname = 'drizzle'
         UNION ALL
         SELECT 'drizzle ' || CASE c.relkind WHEN 'r' THEN 'table' WHEN 'i' THEN 'index' WHEN 'S' THEN 'sequence' ELSE 'relation ' || c.relkind::text END,
                pg_get_userbyid(c.relowner)::text
           FROM pg_class c WHERE c.relnamespace = 'drizzle'::regnamespace
       ) AS objects GROUP BY 1, 2 ORDER BY 1, 2`,
    );
    expect(rows).toEqual([
      { kind: 'database', owner: 'dems_owner', total: 1 },
      { kind: 'drizzle index', owner: 'dems_owner', total: 1 },
      { kind: 'drizzle sequence', owner: 'dems_owner', total: 1 },
      { kind: 'drizzle table', owner: 'dems_owner', total: 1 },
      { kind: 'public function', owner: 'dems_owner', total: 7 },
      { kind: 'public index', owner: 'dems_owner', total: 95 },
      { kind: 'public table', owner: 'dems_owner', total: 48 },
      { kind: 'schema drizzle', owner: 'dems_owner', total: 1 },
    ]);
    // Schema public itself belongs to the pseudo-role "the owner of the database" (PG-15).
    const schema = await owner.query("SELECT pg_get_userbyid(nspowner)::text AS owner FROM pg_namespace WHERE nspname = 'public'");
    expect(schema.rows).toEqual([{ owner: 'pg_database_owner' }]);
    console.info(`[w17] T-PV-2 ownership in ${db.name}:\n${rows.map((row) => `  ${row.kind.padEnd(18)} ${row.owner}  x${row.total}`).join('\n')}`);
  });

  it('dems_owner is not a superuser: CREATE ROLE, the trigger-skipping session setting and a rename of another database fail with 42501', async () => {
    await expectRefused(() => owner.query('CREATE ROLE w17_x'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => owner.query('SET session_replication_role = replica'), SQLSTATE.insufficientPrivilege);
    const rename = await expectRefused(() => owner.query('ALTER DATABASE postgres RENAME TO w17_y'), SQLSTATE.insufficientPrivilege);
    expect(rename.message).toBe('must be owner of database postgres');
    const still = await owner.query("SELECT count(*)::int AS rows FROM pg_database WHERE datname = 'postgres'");
    expect(still.rows).toEqual([{ rows: 1 }]);
  });
});
