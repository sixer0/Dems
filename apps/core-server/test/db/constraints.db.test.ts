// Constraints by behaviour (database contract CL-02, CL-03, CL-04): one REFUSED row for every
// named CHECK, one for every foreign key, one for every reachable uniqueness rule; and the valid
// rows are ACCEPTED, so no CHECK is stricter than the contract.
//
// Rows are written as `dems_owner` (several tables are closed to the runtime role, and a CHECK
// binds every role alike). A CHECK is evaluated before a key or a foreign key is looked at, so
// each refused row differs from a valid one in exactly the column that breaks the rule under
// test, and the test asserts the NAME of the constraint that refused it.
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { readInventory } from './contract-inventory';
import {
  AUDIT_INSERT,
  EVIDENCE_ID,
  SESSION_ID,
  T,
  activeSession,
  alert,
  authSession,
  biometricToken,
  consoleSettings,
  coreDevice,
  coreState,
  deviceCredential,
  eventRow,
  evidenceCustody,
  evidenceItem,
  evidenceTrack,
  exportRecord,
  hardwareSnapshot,
  hash32,
  healthSnapshot,
  insertDevice,
  insertRbac,
  insertRow,
  json,
  lineageRow,
  nextAuditRow,
  operator,
  operatorCredential,
  pairedDevice,
  pairingCode,
  sessionHistory,
  storagePolicy,
  type Row,
} from './fixtures';
import { SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: 'schema' });
const inventory = readInventory();
let owner: Pool;

beforeAll(() => {
  owner = db.ownerPool();
});

const ZEROS = '0'.repeat(64);
/** An audit row that continues the empty chain, with some columns replaced. */
const auditRow = (overrides: Row): Row => ({ ...nextAuditRow({ seq: 0, hash: ZEROS }), ...overrides });

/** `[check, table, row]`: the row breaks exactly that CHECK. */
const REFUSED_BY_CHECK: ReadonlyArray<readonly [string, string, Row]> = [
  ['roles_id_check', 'roles', { id: 'ADMIN', sort_order: 9 }],
  ['permissions_id_check', 'permissions', { id: 'lower_case', sort_order: 99 }],
  ['operators_id_check', 'operators', operator('OPR-9', 'fixture.nine', 'SUPERVISOR')],
  ['operators_username_check', 'operators', operator('OPR-009', 'Upper.Case', 'SUPERVISOR')],
  ['operators_name_check', 'operators', operator('OPR-009', 'fixture.nine', 'SUPERVISOR', { initials: 'ABCDE' })],
  ['operator_credentials_algorithm_check', 'operator_credentials', operatorCredential('OPR-002', { algorithm: 'bcrypt' })],
  ['operator_credentials_params_check', 'operator_credentials', operatorCredential('OPR-002', { memory_kib: 19_455 })],
  ['operator_credentials_lengths_check', 'operator_credentials', operatorCredential('OPR-002', { hash: Buffer.alloc(31, 1) })],
  ['auth_sessions_token_hash_check', 'auth_sessions', authSession('c', { token_hash: Buffer.alloc(31, 1) })],
  ['auth_sessions_method_check', 'auth_sessions', authSession('c', { method: 'SECURITY_KEY' })],
  ['auth_sessions_biometric_device_check', 'auth_sessions', authSession('c', { method: 'BIOMETRIC', device_id: null })],
  ['auth_sessions_times_check', 'auth_sessions', authSession('c', { last_seen_at: T - 1 })],
  ['auth_sessions_end_check', 'auth_sessions', authSession('c', { ended_at: T + 1, end_reason: null })],
  ['auth_sessions_end_reason_check', 'auth_sessions', authSession('c', { ended_at: T + 1, end_reason: 'KICKED' })],
  ['auth_sessions_token_reuse_check', 'auth_sessions', authSession('c', { ended_at: T + 1, end_reason: 'TOKEN_REUSE', method: 'PASSWORD' })],
  ['pairing_codes_id_check', 'pairing_codes', pairingCode('PCD-12')],
  ['pairing_codes_code_hash_check', 'pairing_codes', pairingCode('PCD-000099', { code_hash: Buffer.alloc(16, 1) })],
  ['pairing_codes_state_check', 'pairing_codes', pairingCode('PCD-000099', { state: 'USED' })],
  ['pairing_codes_times_check', 'pairing_codes', pairingCode('PCD-000099', { expires_at: T })],
  ['pairing_codes_attempts_check', 'pairing_codes', pairingCode('PCD-000099', { failed_attempts: 6 })],
  ['pairing_codes_closed_check', 'pairing_codes', pairingCode('PCD-000099', { state: 'ACTIVE' })],
  ['paired_devices_id_check', 'paired_devices', pairedDevice('DEV-1', 'PCD-000001')],
  ['paired_devices_text_check', 'paired_devices', pairedDevice('DEV-0099', 'PCD-000001', { name: '' })],
  ['paired_devices_lifecycle_check', 'paired_devices', pairedDevice('DEV-0099', 'PCD-000001', { state: 'REVOKED' })],
  ['device_credentials_lengths_check', 'device_credentials', deviceCredential('DEV-0001', { next_hash: hash32('device-credential:DEV-0001') })],
  ['biometric_tokens_token_hash_check', 'biometric_tokens', biometricToken('c', { token_hash: Buffer.alloc(8, 1) })],
  ['biometric_tokens_times_check', 'biometric_tokens', biometricToken('c', { expires_at: T })],
  ['biometric_tokens_revoke_check', 'biometric_tokens', biometricToken('c', { revoked_at: T + 1, revoke_reason: 'BECAUSE' })],
  ['registry_counters_name_check', 'registry_counters', { name: 'session', next_value: 1 }],
  ['registry_counters_value_check', 'registry_counters', { name: 'device', next_value: 0 }],
  ['audit_log_id_check', 'audit_log', auditRow({ id: 'AUD-1' })],
  ['audit_log_type_check', 'audit_log', auditRow({ type: 'lowercase' })],
  ['audit_log_category_check', 'audit_log', auditRow({ category: 'NETWORK' })],
  ['audit_log_severity_check', 'audit_log', auditRow({ severity: 'FATAL' })],
  ['audit_log_hashes_check', 'audit_log', auditRow({ hash: ZEROS })],
  ['audit_log_details_flat_check', 'audit_log', auditRow({ details: json({ a: { b: 1 } }) })],
  ['audit_log_details_no_secret_keys_check', 'audit_log', auditRow({ details: json({ token: 'x' }) })],
  ['audit_chain_head_singleton_check', 'audit_chain_head', { singleton: false, seq: 0, hash: ZEROS }],
  ['audit_chain_head_values_check', 'audit_chain_head', { singleton: true, seq: -1, hash: ZEROS }],
  ['events_seq_check', 'events', eventRow(0)],
  ['events_id_check', 'events', eventRow(1, { id: 'LOG-1' })],
  ['events_type_check', 'events', eventRow(1, { type: 'bad type' })],
  ['events_category_check', 'events', eventRow(1, { category: 'PAIRING' })],
  ['events_severity_check', 'events', eventRow(1, { severity: 'FATAL' })],
  ['events_params_flat_check', 'events', eventRow(1, { params: json([1]) })],
  ['events_params_no_secret_keys_check', 'events', eventRow(1, { params: json({ password: 'x' }) })],
  ['active_session_singleton_check', 'active_session', activeSession({ singleton: false })],
  ['active_session_id_check', 'active_session', activeSession({ id: 'SES-1' })],
  ['active_session_state_check', 'active_session', activeSession({ state: 'PAUSED' })],
  ['active_session_input_check', 'active_session', activeSession({ subject_type: 'ANAK' })],
  ['active_session_time_source_check', 'active_session', activeSession({ start_time_source: 'GPS' })],
  ['active_session_counts_check', 'active_session', activeSession({ marker_count: -1 })],
  ['active_session_json_check', 'active_session', activeSession({ timeline: json({}) })],
  ['session_history_id_check', 'session_history', sessionHistory({ case_number: 'LP/26/1-1' })],
  ['session_history_outcome_check', 'session_history', sessionHistory({ fault_kind: 'POWER_FAIL' })],
  ['session_history_input_check', 'session_history', sessionHistory({ profile_id: 'UHD' })],
  ['session_history_values_check', 'session_history', sessionHistory({ duration_ms: -1 })],
  ['session_history_time_source_check', 'session_history', sessionHistory({ end_time_source: 'GPS' })],
  ['evidence_items_id_check', 'evidence_items', evidenceItem({ id: 'EV-1' })],
  ['evidence_items_status_check', 'evidence_items', evidenceItem({ status: 'DELETED' })],
  ['evidence_items_input_check', 'evidence_items', evidenceItem({ case_type: 'ANAK' })],
  ['evidence_items_hashes_check', 'evidence_items', evidenceItem({ manifest_hash: 'xyz' })],
  ['evidence_items_signature_check', 'evidence_items', evidenceItem({ signature_simulated: false })],
  ['evidence_items_verification_check', 'evidence_items', evidenceItem({ verification_status: 'PASS', verification_at: null })],
  ['evidence_items_tamper_check', 'evidence_items', evidenceItem({ tampered_track_id: 'VIDEO-09' })],
  ['evidence_items_values_check', 'evidence_items', evidenceItem({ size_bytes: -1 })],
  ['evidence_items_sources_check', 'evidence_items', evidenceItem({ integrity_source: 'REAL' })],
  ['evidence_items_json_check', 'evidence_items', evidenceItem({ markers: json({}) })],
  ['evidence_tracks_track_check', 'evidence_tracks', evidenceTrack('VIDEO-01', 5)],
  ['evidence_tracks_values_check', 'evidence_tracks', evidenceTrack('VIDEO-01', 1, { sha256: 'nothex' })],
  ['evidence_custody_values_check', 'evidence_custody', evidenceCustody(0)],
  ['exports_id_check', 'exports', exportRecord('EXP-1')],
  ['exports_scope_check', 'exports', exportRecord('EXP-000001', { scope: 'AUDIT' })],
  ['exports_text_check', 'exports', exportRecord('EXP-000001', { reason: '  ab  ' })],
  ['alerts_id_check', 'alerts', alert('ALR-1')],
  ['alerts_kind_check', 'alerts', alert('ALR-000001', { kind: 'UNKNOWN' })],
  ['alerts_params_check', 'alerts', alert('ALR-000001', { params: json({ a: [1] }) })],
  ['storage_policy_singleton_check', 'storage_policy', storagePolicy({ singleton: false })],
  ['storage_policy_values_check', 'storage_policy', storagePolicy({ retention_days: 0 })],
  ['console_settings_singleton_check', 'console_settings', consoleSettings({ singleton: false })],
  ['console_settings_time_format_check', 'console_settings', consoleSettings({ time_format: '25' })],
  ['engine_counters_name_check', 'engine_counters', { name: 'device', next_value: 1 }],
  ['engine_counters_value_check', 'engine_counters', { name: 'event', next_value: 0 }],
  ['core_device_singleton_check', 'core_device', coreDevice({ singleton: false })],
  ['core_state_singleton_check', 'core_state', coreState({ singleton: false })],
  ['core_state_values_check', 'core_state', coreState({ epoch: -1 })],
  ['hardware_snapshot_singleton_check', 'hardware_snapshot', hardwareSnapshot({ singleton: false })],
  ['hardware_snapshot_camera_check', 'hardware_snapshot', hardwareSnapshot({ active_camera_id: 'AUDIO-01' })],
  ['hardware_snapshot_shapes_check', 'hardware_snapshot', hardwareSnapshot({ cameras: json({}) })],
  ['health_snapshots_cause_check', 'health_snapshots', healthSnapshot({ fault_kind: 'TAMPER' })],
  ['health_snapshots_states_check', 'health_snapshots', healthSnapshot({ active_faults: -1 })],
  ['schema_meta_singleton_check', 'schema_meta', { singleton: false, schema_version: 1, contract_revision: 'dbc-2' }],
  ['audit_chain_history_numbers_check', 'audit_chain_history', lineageRow(0, { epoch: 0 })],
  ['audit_chain_history_head_hash_check', 'audit_chain_history', lineageRow(1, { head_hash: 'zz' })],
  ['audit_chain_history_values_check', 'audit_chain_history', lineageRow(1, { row_count: 0 })],
  ['audit_chain_history_reason_check', 'audit_chain_history', lineageRow(1, { reason: 'MANUAL' })],
];

/**
 * CHECKs that no single row can break alone, with what refuses the row first. They are part of
 * the contract and of the catalog (the catalog test compares their text); here the test shows
 * what a row that breaks them actually meets.
 */
const SHADOWED: ReadonlyArray<readonly [string, string, Row, string, string | undefined]> = [
  // The guard trigger runs before the CHECKs and refuses a sequence that does not continue the head.
  ['audit_log_seq_check', 'audit_log', auditRow({ seq: 0, id: 'AUD-000000' }), SQLSTATE.chainDiscontinuity, undefined],
  // The lifecycle rule lists the three states, so an unknown state breaks it too; CHECKs run in name order.
  ['paired_devices_state_check', 'paired_devices', pairedDevice('DEV-0099', 'PCD-000001', { state: 'LOST' }), SQLSTATE.checkViolation, 'paired_devices_lifecycle_check'],
];

async function insert(table: string, row: Row): Promise<void> {
  if (table === 'audit_log') await owner.query(AUDIT_INSERT, Object.values(row));
  else await insertRow(owner, table, row);
}

describe('CL-03: one refused row per named CHECK', () => {
  it('the list covers all 98 CHECKs of the contract: 96 directly, 2 that another rule refuses first', () => {
    const named = inventory.tables.flatMap((table) => table.constraints.filter((constraint) => constraint.kind === 'CHECK').map((constraint) => constraint.name));
    const covered = [...REFUSED_BY_CHECK.map(([name]) => name), ...SHADOWED.map(([name]) => name)];
    expect(named).toHaveLength(98);
    expect(REFUSED_BY_CHECK).toHaveLength(96);
    expect([...covered].sort()).toEqual([...named].sort());
    for (const [name, table] of [...REFUSED_BY_CHECK, ...SHADOWED]) expect(name.startsWith(`${table}_`), name).toBe(true);
  });

  it.each(REFUSED_BY_CHECK.map(([name, table, row]) => [name, table, row] as const))('%s refuses the row (23514)', async (name, table, row) => {
    await expectRefused(() => insert(table, row), SQLSTATE.checkViolation, name);
  });

  it.each(SHADOWED.map(([name, table, row, code, constraint]) => [name, code, constraint ?? 'the chain guard', table, row] as const))(
    '%s: a row that breaks it is refused with %s by %s',
    async (_name, code, by, table, row) => {
      await expectRefused(() => insert(table, row), code, by === 'the chain guard' ? undefined : by);
    },
  );

  it('nothing was written by the refused rows', async () => {
    for (const table of inventory.tables.map((entry) => entry.name)) {
      const expected = table === 'audit_chain_head' || table === 'schema_meta' ? 1 : 0;
      const { rows } = await owner.query<{ rows: number }>(`SELECT count(*)::int AS rows FROM public.${table}`);
      expect(rows[0]?.rows, table).toBe(expected);
    }
  });
});

describe('the valid rows are accepted: no CHECK is stricter than the contract', () => {
  it('one valid row in each of the 30 tables', async () => {
    await insertRbac(owner);
    await insertDevice(owner, 'DEV-0001', 'PCD-000001');
    await insertRow(owner, 'pairing_codes', pairingCode('PCD-000050'));
    await insertRow(owner, 'auth_sessions', authSession('valid'));
    await insertRow(owner, 'auth_sessions', authSession('valid-ended', { ended_at: T + 5, end_reason: 'SIGNED_OUT' }));
    await insertRow(owner, 'auth_sessions', authSession('valid-reuse', { method: 'BIOMETRIC', device_id: 'DEV-0001', ended_at: T + 5, end_reason: 'TOKEN_REUSE' }));
    await insertRow(owner, 'biometric_tokens', biometricToken('valid'));
    await insertRow(owner, 'registry_counters', { name: 'device', next_value: 2 });
    await insertRow(owner, 'registry_counters', { name: 'pairingCode', next_value: 51 });
    await insert('audit_log', nextAuditRow({ seq: 0, hash: ZEROS }, { actorId: 'OPR-002', details: { reason: 'fixture', manifestHash: ZEROS, attempts: 3, ok: true, none: null } }));
    await insertRow(owner, 'events', eventRow(1, { params: json({ kind: 'fixture', value: 1.5 }) }));
    await insertRow(owner, 'session_history', sessionHistory());
    await insertRow(owner, 'session_history', sessionHistory({ id: 'SES-20261001-0003', outcome: 'INCOMPLETE', fault_kind: 'POWER_FAIL', started_at: null, start_time_source: null }));
    await insertRow(owner, 'evidence_items', evidenceItem());
    for (const [position, track] of ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'].entries()) {
      await insertRow(owner, 'evidence_tracks', evidenceTrack(track, position + 1));
    }
    await insertRow(owner, 'evidence_custody', evidenceCustody(1));
    await insertRow(owner, 'exports', exportRecord('EXP-000001'));
    await insertRow(owner, 'exports', exportRecord('EXP-000002', { scope: 'AUDIT', evidence_id: null }));
    await insertRow(owner, 'alerts', alert('ALR-000001', { params: json({ kind: 'STORAGE_LOW', target: null }) }));
    await insertRow(owner, 'alerts', alert('ALR-000002', { kind: 'SYSTEM' }));
    await insertRow(owner, 'storage_policy', storagePolicy());
    await insertRow(owner, 'console_settings', consoleSettings());
    for (const name of ['event', 'session', 'caseNumber', 'evidence', 'item', 'export']) {
      await insertRow(owner, 'engine_counters', { name, next_value: 1 });
    }
    await insertRow(owner, 'core_device', coreDevice());
    await insertRow(owner, 'core_state', coreState());
    await insertRow(owner, 'hardware_snapshot', hardwareSnapshot());
    await insertRow(owner, 'health_snapshots', healthSnapshot());
    await insertRow(owner, 'health_snapshots', healthSnapshot({ cause: 'FAULT_RAISED', fault_kind: 'TAMPER', session_state: 'RECORDING', active_faults: 1 }));
    await insertRow(owner, 'active_session', activeSession());
    await insertRow(owner, 'audit_chain_history', lineageRow(1, { actor_id: 'OPR-002' }));

    const { rows } = await owner.query<{ empty: string }>(
      inventory.tables.map((table) => `SELECT '${table.name}' AS empty WHERE NOT EXISTS (SELECT 1 FROM public.${table.name})`).join(' UNION ALL '),
    );
    expect(rows).toEqual([]);
  });

  it('the defaults of the contract are what an INSERT without the column gets', async () => {
    await owner.query(
      "INSERT INTO operators (id, username, name, display_name, initials, role_id, created_at, updated_at) VALUES ('OPR-070', 'fixture.defaults', 'D', 'D', 'D', 'TECHNICIAN', 1, 1)",
    );
    expect((await owner.query("SELECT enabled, rank, last_sign_in_at FROM operators WHERE id = 'OPR-070'")).rows).toEqual([
      { enabled: true, rank: null, last_sign_in_at: null },
    ]);
    const generated = await owner.query(
      "INSERT INTO auth_sessions (token_hash, operator_id, method, issued_at, last_seen_at, absolute_expires_at) VALUES ($1, 'OPR-070', 'PASSWORD', 1, 1, 2) RETURNING id",
      [hash32('defaults')],
    );
    expect(generated.rows[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const code = await owner.query(
      "INSERT INTO pairing_codes (id, code_hash, state, issued_by_operator_id, issued_at, expires_at, closed_at) VALUES ('PCD-000070', $1, 'EXPIRED', 'OPR-070', 1, 2, 3) RETURNING failed_attempts",
      [hash32('defaults-code')],
    );
    expect(code.rows).toEqual([{ failed_attempts: 0 }]);
    const event = await owner.query(
      "INSERT INTO events (seq, id, at, type, category, severity, message) VALUES (2, 'LOG-000002', 1, 'SESSION_CREATED', 'SESSION', 'INFO', 'm') RETURNING params",
    );
    expect(event.rows).toEqual([{ params: {} }]);
    const item = await owner.query(
      "SELECT signature_simulated, verification_status, tampered, markers, notes FROM evidence_items",
    );
    expect(item.rows).toEqual([{ signature_simulated: true, verification_status: 'NOT_RUN', tampered: false, markers: [], notes: [] }]);
  });
});

describe('CL-02: every reference is a foreign key with ON DELETE RESTRICT', () => {
  /** `[foreign key, table, row]`: a valid row whose parent does not exist. */
  const UNKNOWN_PARENT: ReadonlyArray<readonly [string, string, Row]> = [
    ['role_permissions_role_id_fkey', 'role_permissions', { role_id: 'NOBODY', permission_id: 'USER_ADMIN' }],
    ['role_permissions_permission_id_fkey', 'role_permissions', { role_id: 'TECHNICIAN', permission_id: 'UNKNOWN_PERMISSION' }],
    ['operators_role_id_fkey', 'operators', operator('OPR-050', 'fixture.fifty', 'NOBODY')],
    ['operator_credentials_operator_id_fkey', 'operator_credentials', operatorCredential('OPR-777')],
    ['auth_sessions_operator_id_fkey', 'auth_sessions', authSession('fk-1', { operator_id: 'OPR-777' })],
    ['auth_sessions_device_id_fkey', 'auth_sessions', authSession('fk-2', { device_id: 'DEV-7777' })],
    ['pairing_codes_issued_by_operator_id_fkey', 'pairing_codes', pairingCode('PCD-000777', { issued_by_operator_id: 'OPR-777' })],
    ['pairing_codes_closed_by_operator_id_fkey', 'pairing_codes', pairingCode('PCD-000778', { state: 'CANCELLED', closed_by_operator_id: 'OPR-777' })],
    ['paired_devices_paired_with_code_id_fkey', 'paired_devices', pairedDevice('DEV-0777', 'PCD-777777')],
    [
      'paired_devices_revoked_by_operator_id_fkey',
      'paired_devices',
      pairedDevice('DEV-0778', 'PCD-000050', { state: 'REVOKED', revoked_at: T + 2_000, revoked_by_operator_id: 'OPR-777', revoke_reason: 'fixture reason' }),
    ],
    ['device_credentials_device_id_fkey', 'device_credentials', deviceCredential('DEV-7777')],
    ['biometric_tokens_device_id_fkey', 'biometric_tokens', biometricToken('fk-1', { device_id: 'DEV-7777' })],
    ['biometric_tokens_operator_id_fkey', 'biometric_tokens', biometricToken('fk-2', { operator_id: 'OPR-777' })],
    ['active_session_investigator_id_fkey', 'active_session', activeSession({ investigator_id: 'OPR-777' })],
    ['active_session_created_by_fkey', 'active_session', activeSession({ created_by: 'OPR-777' })],
    ['session_history_investigator_id_fkey', 'session_history', sessionHistory({ id: 'SES-20261001-0777', investigator_id: 'OPR-777' })],
    ['evidence_items_session_id_fkey', 'evidence_items', evidenceItem({ id: 'EV-20261001-0777', session_id: 'SES-20261001-0999' })],
    ['evidence_items_investigator_id_fkey', 'evidence_items', evidenceItem({ id: 'EV-20261001-0778', session_id: 'SES-20261001-0003', investigator_id: 'OPR-777' })],
    ['evidence_tracks_evidence_id_fkey', 'evidence_tracks', evidenceTrack('VIDEO-01', 1, { evidence_id: 'EV-20261001-0999' })],
    ['evidence_custody_evidence_id_fkey', 'evidence_custody', evidenceCustody(1, { evidence_id: 'EV-20261001-0999' })],
    ['evidence_custody_actor_id_fkey', 'evidence_custody', evidenceCustody(9, { actor_id: 'OPR-777' })],
    ['exports_evidence_id_fkey', 'exports', exportRecord('EXP-000777', { evidence_id: 'EV-20261001-0999' })],
    ['exports_operator_id_fkey', 'exports', exportRecord('EXP-000778', { operator_id: 'OPR-777' })],
    ['audit_chain_history_actor_id_fkey', 'audit_chain_history', lineageRow(9, { actor_id: 'OPR-777' })],
  ];

  it('the list covers all 25 foreign keys of the contract', () => {
    const named = inventory.tables.flatMap((table) => table.constraints.filter((constraint) => constraint.kind === 'FOREIGN KEY').map((constraint) => constraint.name));
    expect(named).toHaveLength(25);
    expect([...UNKNOWN_PARENT.map(([name]) => name), 'audit_log_actor_id_fkey'].sort()).toEqual([...named].sort());
  });

  it.each(UNKNOWN_PARENT.map(([name, table, row]) => [name, table, row] as const))('%s refuses a row whose parent does not exist (23503)', async (name, table, row) => {
    // `active_session` holds its one row already; the foreign key is still what refuses first? No:
    // the primary key would. The test therefore removes that row for the two active_session cases.
    if (table === 'active_session') await owner.query('DELETE FROM active_session');
    try {
      await expectRefused(() => insert(table, row), SQLSTATE.foreignKeyViolation, name);
    } finally {
      if (table === 'active_session') await insertRow(owner, 'active_session', activeSession());
    }
  });

  it('audit_log_actor_id_fkey refuses an audit row that names an unknown operator (23503)', async () => {
    const head = (await owner.query<{ seq: string; hash: string }>('SELECT seq, hash FROM audit_chain_head')).rows[0];
    const row = nextAuditRow({ seq: Number(head?.seq), hash: String(head?.hash) }, { actorId: 'OPR-777' });
    await expectRefused(() => insert('audit_log', row), SQLSTATE.foreignKeyViolation, 'audit_log_actor_id_fkey');
  });

  it('a referenced row cannot be deleted: SQLSTATE 23001 on PostgreSQL 18, never a cascade (K-2, D38)', async () => {
    const before = await owner.query<{ total: number }>(
      `SELECT (SELECT count(*) FROM operators)::int + (SELECT count(*) FROM auth_sessions)::int + (SELECT count(*) FROM evidence_tracks)::int AS total`,
    );
    const statements = [
      "DELETE FROM operators WHERE id = 'OPR-002'",
      "DELETE FROM roles WHERE id = 'SUPERVISOR'",
      "DELETE FROM permissions WHERE id = 'USER_ADMIN'",
      "DELETE FROM pairing_codes WHERE id = 'PCD-000001'",
      "DELETE FROM paired_devices WHERE id = 'DEV-0001'",
      `DELETE FROM session_history WHERE id = '${SESSION_ID}'`,
      `DELETE FROM evidence_items WHERE id = '${EVIDENCE_ID}'`,
    ];
    for (const statement of statements) {
      const refusal = await expectRefused(() => owner.query(statement), SQLSTATE.restrictViolation);
      expect(refusal.message, statement).toContain('violates RESTRICT setting of foreign key constraint');
    }
    // ON UPDATE NO ACTION: a key that is referenced cannot be changed either (23503).
    await expectRefused(() => owner.query("UPDATE operators SET id = 'OPR-099' WHERE id = 'OPR-002'"), SQLSTATE.foreignKeyViolation);
    const after = await owner.query<{ total: number }>(
      `SELECT (SELECT count(*) FROM operators)::int + (SELECT count(*) FROM auth_sessions)::int + (SELECT count(*) FROM evidence_tracks)::int AS total`,
    );
    expect(after.rows).toEqual(before.rows);
  });
});

describe('CL-04: business uniqueness is in the database', () => {
  /** `[constraint or index, statement]`: each breaks exactly that rule. */
  const duplicate = (name: string, work: () => Promise<unknown>) => expectRefused(work, SQLSTATE.uniqueViolation, name);

  it('one username; one sort position; one row per token hash and credential hash', async () => {
    await duplicate('operators_username_key', () => insertRow(owner, 'operators', operator('OPR-060', 'fixture.investigator', 'INVESTIGATOR')));
    await duplicate('roles_sort_order_key', () => owner.query("UPDATE roles SET sort_order = 1 WHERE id = 'SUPERVISOR'"));
    await duplicate('permissions_sort_order_key', () => insertRow(owner, 'permissions', { id: 'EXTRA_PERMISSION', sort_order: 1 }));
    await duplicate('auth_sessions_token_hash_key', () => insertRow(owner, 'auth_sessions', authSession('valid', { operator_id: 'OPR-001' })));
    await duplicate('biometric_tokens_token_hash_key', () =>
      insertRow(owner, 'biometric_tokens', biometricToken('valid', { used_at: T + 1 })),
    );
    // A second device needs a code of its own, so the credential rules are shown on a second device.
    await insertRow(owner, 'paired_devices', pairedDevice('DEV-0002', 'PCD-000050'));
    await duplicate('device_credentials_current_hash_key', () =>
      insertRow(owner, 'device_credentials', deviceCredential('DEV-0002', { current_hash: hash32('device-credential:DEV-0001') })),
    );
    await owner.query("UPDATE device_credentials SET next_hash = $1 WHERE device_id = 'DEV-0001'", [hash32('next')]);
    await duplicate('device_credentials_next_hash_key', () => insertRow(owner, 'device_credentials', deviceCredential('DEV-0002', { next_hash: hash32('next') })));
    await insertRow(owner, 'device_credentials', deviceCredential('DEV-0002'));
    await duplicate('device_credentials_pkey', () => insertRow(owner, 'device_credentials', deviceCredential('DEV-0002', { current_hash: hash32('another') })));
  });

  it('one device per code; one evidence item per session; one track per position; one discarded chain per epoch', async () => {
    await duplicate('paired_devices_paired_with_code_id_key', () => insertRow(owner, 'paired_devices', pairedDevice('DEV-0003', 'PCD-000001')));
    await duplicate('evidence_items_session_id_key', () => insertRow(owner, 'evidence_items', evidenceItem({ id: 'EV-20261001-0002' })));
    await owner.query("DELETE FROM evidence_tracks WHERE track_id = 'AUDIO-02'");
    await duplicate('evidence_tracks_evidence_id_position_key', () => insertRow(owner, 'evidence_tracks', evidenceTrack('AUDIO-02', 1)));
    await duplicate('evidence_tracks_pkey', () => insertRow(owner, 'evidence_tracks', evidenceTrack('VIDEO-01', 4)));
    await duplicate('audit_chain_history_epoch_key', () => insertRow(owner, 'audit_chain_history', lineageRow(2, { epoch: 0 })));
    await duplicate('role_permissions_pkey', () => insertRow(owner, 'role_permissions', { role_id: 'SUPERVISOR', permission_id: 'USER_ADMIN' }));
  });

  it('one active session per Core: a second row of active_session is refused', async () => {
    await duplicate('active_session_pkey', () => insertRow(owner, 'active_session', activeSession({ id: 'SES-20261001-0009', case_number: 'LP/2026/1001-0009' })));
  });

  it('a unique index with a WHERE clause binds only the rows that satisfy it (PG-08)', async () => {
    // One ACTIVE code at a time; any number of closed ones.
    await insertRow(owner, 'pairing_codes', pairingCode('PCD-000060', { state: 'ACTIVE', closed_at: null }));
    await duplicate('pairing_codes_one_active_key', () => insertRow(owner, 'pairing_codes', pairingCode('PCD-000061', { state: 'ACTIVE', closed_at: null })));
    await insertRow(owner, 'pairing_codes', pairingCode('PCD-000062', { state: 'EXPIRED' }));
    await insertRow(owner, 'pairing_codes', pairingCode('PCD-000063', { state: 'EXPIRED' }));

    // One live biometric token per device and operator; any number of used or revoked ones.
    await duplicate('biometric_tokens_one_live_key', () => insertRow(owner, 'biometric_tokens', biometricToken('second-live')));
    await insertRow(owner, 'biometric_tokens', biometricToken('used-1', { used_at: T + 1 }));
    await insertRow(owner, 'biometric_tokens', biometricToken('used-2', { used_at: T + 1 }));
    await insertRow(owner, 'biometric_tokens', biometricToken('revoked-1', { revoked_at: T + 1, revoke_reason: 'DISABLED' }));
    // The same device with another operator is another key.
    await insertRow(owner, 'biometric_tokens', biometricToken('other-operator', { operator_id: 'OPR-001' }));
  });

  it('a hash can appear in the chain once: a row that continues the head with an earlier hash is refused (G-5)', async () => {
    const rows = (await owner.query<{ seq: string; hash: string }>('SELECT seq, hash FROM audit_log ORDER BY seq')).rows;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const next = nextAuditRow({ seq: Number(last?.seq), hash: String(last?.hash) });
    // With one row in the log the earlier hash is also the head, which the hashes CHECK refuses; add a row first.
    await insert('audit_log', next);
    const forged = { ...nextAuditRow({ seq: Number(next['seq']), hash: String(next['hash']) }), hash: String(first?.hash) };
    await duplicate('audit_log_hash_key', () => insert('audit_log', forged));
  });
});
