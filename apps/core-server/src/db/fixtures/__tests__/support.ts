/**
 * Support for the tests of plan row W25 (not a test file). Nothing here imports Vitest, so the
 * pure tests and the database tests can both use it.
 */
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { countRows, fromRows, rbacRows, toRows } from '../../mapping';
import { ALL_TABLES } from '../../store';
import { buildSeedState } from '../../seed/dataset';
import type { BulkBase } from '../world';

/** The fixed instant the shared suites, the seed template and the bulk template use: 2026-10-01 10:00:00 WIB. */
export const FIXED_NOW = Date.UTC(2026, 9, 1, 3, 0, 0);

/**
 * The base of a database that was seeded at `now` with the default seed and scenario `idle`,
 * built without a database: the shared dataset through the one mapping, there and back. It is
 * what the loader reads from a clone of the seed template.
 */
export function pureBase(now: number = FIXED_NOW): BulkBase {
  const state = buildSeedState({ now });
  const rows = toRows(state, { at: now, seededAt: now, lastResetAt: null });
  const rbac = rbacRows();
  const counts: Record<string, number> = {};
  for (const { sqlName } of ALL_TABLES) counts[sqlName] = 0;
  Object.assign(counts, countRows(rows), {
    // The tables the seed writes that no slice holds.
    operator_credentials: rows.operators.length,
    registry_counters: 2,
    roles: rbac.roles.length,
    permissions: rbac.permissions.length,
    role_permissions: rbac.rolePermissions.length,
    schema_meta: 1,
    // Row 112 (R-8): the one confirmed-default `stt_config` row is seed-side and server-native.
    stt_config: 1,
  });
  const core = rows.coreDevice[0];
  if (core === undefined) throw new Error('the shared dataset maps to no core_device row');
  return { slices: fromRows(rows), seededAt: now, certificateFingerprint: core.certificateFingerprint, registryCounters: { device: 1, pairingCode: 1 }, counts };
}

/** The order a table is dumped in: its primary key, or for a generated key the columns that identify the row. */
const DUMP_ORDER: Readonly<Record<string, string>> = {
  active_session: 'singleton',
  alerts: 'id',
  audit_chain_head: 'singleton',
  audit_chain_history: 'reset_no',
  audit_log: 'seq',
  auth_sessions: 'id',
  biometric_tokens: 'id',
  console_settings: 'singleton',
  core_device: 'singleton',
  core_state: 'singleton',
  device_credentials: 'device_id',
  engine_counters: 'name',
  events: 'seq',
  evidence_custody: 'evidence_id, seq',
  evidence_items: 'id',
  evidence_tracks: 'evidence_id, track_id',
  exports: 'id',
  hardware_snapshot: 'singleton',
  health_snapshots: 'id',
  operator_credentials: 'operator_id',
  operators: 'id',
  paired_devices: 'id',
  pairing_codes: 'id',
  permissions: 'id',
  registry_counters: 'name',
  role_permissions: 'role_id, permission_id',
  roles: 'id',
  schema_meta: 'singleton',
  session_history: 'id',
  storage_policy: 'singleton',
  // schema v2 (dbc-3 §B): the ten new tables, keyed by their primary columns. The digest covers
  // them as they are - the CS-20 fixture-v2 builder fills them later, empty tables digest equal.
  capture_config: 'singleton',
  capture_devices: 'id',
  capture_device_credentials: 'device_id',
  session_audio_intervals: 'session_id, seq',
  recording_fragments: 'session_id, track_id, seq',
  transcript_chunks: 'session_id, seq',
  transcripts: 'evidence_id',
  transcript_revisions: 'evidence_id, revision_no',
  sealing_jobs: 'session_id, step',
  stt_config: 'singleton',
  // Schema v3 (dbc-4 §N.3): T-41, keyed by (session_id, slot).
  session_capture_sources: 'session_id, slot',
  // Schema v5 (PE-129b-01): T-42, one row per session.
  session_stt_config: 'session_id',
  // Schema v6 (PE-0013-01): T-43, one row.
  core_media_store: 'singleton',
  // Schema v7 (task 4 schema set A): T-44, keyed by (device_id, profile); T-45, one row per microphone.
  capture_device_streams: 'device_id, profile',
  capture_audio_inputs: 'device_id',
  // Schema v8 (task 4 schema set B): T-46, one row; T-47, one row per alias.
  capture_network_config: 'singleton',
  host_network_aliases: 'id',
  // Schema v11 (task 4 schema set C): T-48, one row per acceptance.
  installation_acceptances: 'id',
};

/**
 * A digest of each of the 41 tables over a stable, ordered dump (the recipe of contract §9.6,
 * with SHA-256): `to_jsonb` of every row, in key order. Every column is part of it, the generated
 * identifiers and the hash columns included, so two databases with equal digests hold equal rows.
 */
export async function tableDigests(pool: Pool): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};
  for (const { sqlName } of ALL_TABLES) {
    const order = DUMP_ORDER[sqlName];
    if (order === undefined) throw new Error(`no dump order for the table ${sqlName}`);
    const { rows } = await pool.query<{ digest: string; rows: string }>(
      `SELECT encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY ${order}), ''), 'UTF8')), 'hex') AS digest, count(*) AS rows FROM public.${sqlName} AS t`,
    );
    digests[sqlName] = `${rows[0]?.digest ?? ''}:${rows[0]?.rows ?? '0'}`;
  }
  return digests;
}

/** One digest over the 41 table digests. */
export function overallDigest(digests: Readonly<Record<string, string>>): string {
  const text = Object.keys(digests)
    .sort()
    .map((table) => `${table}=${digests[table] ?? ''}`)
    .join('\n');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** The first column of the first row of a statement, as a number. */
export async function count(pool: Pool, statement: string, values: readonly unknown[] = []): Promise<number> {
  const { rows } = await pool.query<Record<string, string | number>>(statement, [...values]);
  const first = rows[0];
  return first === undefined ? 0 : Number(Object.values(first)[0]);
}

/** The SQLSTATE a statement fails with, or `null` when it succeeds. */
export async function sqlStateOf(pool: Pool, statement: string, values: readonly unknown[] = []): Promise<string | null> {
  try {
    await pool.query(statement, [...values]);
    return null;
  } catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
  }
}
