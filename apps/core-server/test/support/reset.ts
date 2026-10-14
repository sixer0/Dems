/**
 * Support for the tests of the reset routine (plan row W29; not a test file). Nothing here
 * imports Vitest. The demo-control row, the engine row and the security-audit row use its
 * maintenance pool, its checksums and digests of the tables, and its readers of the lineage.
 *
 * NEUTRAL TEST SUPPORT (fix round B1, review finding CPB1-12). This file lives in
 * `apps/core-server/test/support/` because tests of several rows use it; it moved here from
 * `src/db/reset/__tests__/support.ts`, which re-exports it for one round. No production source imports
 * anything under `test/` (static test `test/static/imports.test.ts`).
 *
 * WHICH DATABASES THE TESTS USE. Only databases of the test's own run, created by the test
 * helper (`dems_test_<label>_<stamp>_f<nn>_<slug>`), and the staging and previous copies the
 * routine derives from those names, which carry the same run prefix and are therefore removed
 * by the helper's teardown. No test names `dems_demo` or a lane as a target. Slugs are short: a
 * target name plus `_next` must fit 63 bytes.
 */
import { createHash } from 'node:crypto';
import { appendAudit, type AuditInput } from '@dems/shared/sim';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { MAINTENANCE_DATABASE, createOwnerPool, readOwnerConnection } from '../../src/db/commands/owner-connection';
import { auditRowToRow } from '../../src/db/mapping';
import * as schema from '../../src/db/schema';
import { ALL_TABLES } from '../../src/db/store';
import type { ResetCheckpoint } from '../../src/db/reset/errors';
import { KEPT_TABLES } from '../../src/db/reset/kept-tables';
import { RESET_LOCK_CLASS } from '../../src/db/reset/names';

/** 2026-10-01 10:00:00 WIB: the instant `tpl_seed` is seeded at (DR-5). */
export const SEED_NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
const MINUTE = 60_000;
/** The instants of the two resets of T-RS-1: one and two hours after the seed. */
export const FIRST_RESET_NOW = SEED_NOW + 60 * MINUTE;
export const SECOND_RESET_NOW = SEED_NOW + 120 * MINUTE;

export const sha256 = (text: string): Buffer => createHash('sha256').update(text, 'utf8').digest();

/** Synthetic values of the fixtures. None is a real credential: they exist only as hashes in a test database. */
export const WEB_SESSION_TOKEN = 'w29-fixture-web-session';
export const DEVICE_SESSION_TOKEN = 'w29-fixture-device-session';
export const ENDED_SESSION_TOKEN = 'w29-fixture-ended-session';
export const ACTIVE_CODE_ID = 'PCD-000005';
/** 2^53 + 1, as decimal text: `Number()` of it is 9007199254740992. */
export const BEYOND_DOUBLE = '9007199254740993';
/** A device name with quotes, a backslash, accents and an astral character: 60 characters at most. */
export const AWKWARD_DEVICE_NAME = 'Tablet «Ruang 1» "A" \\ naïve 🎥 \'x\'';
/** A revoke reason with a line break and a tab. */
export const AWKWARD_REVOKE_REASON = 'Lost on site;\n\treported by the supervisor "A".';

// ── A maintenance connection of the test itself ────────────────────────────────────────────────

/**
 * A pool of `dems_owner` on the maintenance database, for what the test helper does not hand
 * out: holding the reset's advisory lock from another session, building a leftover database of
 * the test's own run, reading `pg_database` and `pg_stat_activity`. The caller ends it.
 */
export function maintenancePool(dataDir: string): Pool {
  return createOwnerPool(readOwnerConnection(dataDir), MAINTENANCE_DATABASE, 'dems-test-reset');
}

/** Refuses any name that is not of the test's own run, before it becomes statement text. */
function ownName(name: string, runPrefix: string): string {
  if (!/^dems_test_[a-z0-9_]+$/.test(name) || !name.startsWith(runPrefix) || name.length > 63) {
    throw new Error('refused: a reset test touches only databases of its own run.');
  }
  return `"${name}"`;
}

/** An empty database of the test's own run: a leftover `<t>_next` or `<t>_prev` to find. */
export async function createLeftover(maintenance: Pool, name: string, runPrefix: string): Promise<void> {
  await maintenance.query(`CREATE DATABASE ${ownName(name, runPrefix)} OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'`);
}

/** What `quiet` and `discard` need of a database of the test helper. */
export interface Discardable {
  readonly name: string;
  closeResources(): Promise<unknown>;
  drop(): Promise<void>;
}

/**
 * Makes a database of the test quiet before a reset: closes the test's own pools on it, then
 * waits until the SERVER lists no session on it.
 *
 * Closing a pool is not enough. The driver's pool reports "ended" when it has asked its clients
 * to close, and the server drops a backend from `pg_stat_activity` a moment after its connection
 * ended. The routine refuses a target that is in use (R-1), so a test that called it right after
 * closing its pools would depend on how fast that moment passes on the host of the day.
 */
export async function quiet(maintenance: Pool, database: Discardable): Promise<void> {
  await database.closeResources();
  await untilNoSession(maintenance, { databases: [database.name] }, `sessions of the test on ${database.name}, after its pools were closed`);
}

/**
 * Removes a database of the test's own run with a PLAIN `DROP DATABASE`, then lets the helper
 * note that it is gone.
 *
 * Why a plain drop: the forced form is refused (SQLSTATE 42501, "permission denied to terminate
 * process") while an autovacuum worker is connected to the database, because `dems_owner` may not
 * signal it, and a database that a reset has just built is exactly where autovacuum goes next
 * (measured in this row at 11:22:56). Since decision D76 the helper retries a refused forced drop
 * itself; the plain form stays here because it needs no retry (the server asks the worker to stop
 * and waits), ends nobody's session, and is the only form the reset routine uses. The test first
 * waits until no client session is on the database, so the drop has nothing to wait for.
 */
export async function discard(maintenance: Pool, database: Discardable, runPrefix: string): Promise<void> {
  await database.closeResources();
  await dropOwn(maintenance, database.name, runPrefix);
  await database.drop();
}

/** A plain drop of a database of the test's own run, after the server lists no client session on it. */
export async function dropOwn(maintenance: Pool, name: string, runPrefix: string): Promise<void> {
  const quoted = ownName(name, runPrefix);
  await untilNoSession(maintenance, { databases: [name] }, `sessions on ${name}, before it is dropped`);
  await maintenance.query(`DROP DATABASE IF EXISTS ${quoted}`);
}

/** Renames a database of the test's own run: the state a lost swap would leave. */
export async function renameOwn(maintenance: Pool, from: string, to: string, runPrefix: string): Promise<void> {
  await maintenance.query(`ALTER DATABASE ${ownName(from, runPrefix)} RENAME TO ${ownName(to, runPrefix)}`);
}

export interface CatalogRow {
  readonly name: string;
  readonly oid: string;
  readonly owner: string;
}

/** The catalog rows of some databases: which exist, their OID (the identity of a database) and owner. */
export async function catalogOf(pool: Pool, names: readonly string[]): Promise<Record<string, CatalogRow | undefined>> {
  const { rows } = await pool.query<CatalogRow>(
    'SELECT datname::text AS name, oid::text AS oid, pg_get_userbyid(datdba)::text AS owner FROM pg_database WHERE datname = ANY($1::text[])',
    [names],
  );
  return Object.fromEntries(rows.map((row) => [row.name, row]));
}

export interface SessionRow {
  readonly database: string;
  readonly role: string;
  readonly application: string;
}

export interface SessionFilter {
  /** `application_name` values. A name must be the caller's own: see `resetApplicationName`. */
  readonly applications?: readonly string[];
  /** Database names of the test's own run. */
  readonly databases?: readonly string[];
}

/** The client sessions with one of the application names, or on one of the databases. */
export async function sessionsOf(pool: Pool, filter: SessionFilter): Promise<SessionRow[]> {
  const { rows } = await pool.query<SessionRow>(
    'SELECT datname::text AS database, usename::text AS role, application_name AS application FROM pg_stat_activity ' +
      'WHERE datname IS NOT NULL AND usename IS NOT NULL AND pid <> pg_backend_pid() ' +
      'AND (application_name = ANY($1::text[]) OR datname = ANY($2::text[])) ORDER BY 1, 2, 3',
    [filter.applications ?? [], filter.databases ?? []],
  );
  return rows;
}

/** Whether a session holds the reset's advisory lock of a slot. */
export async function resetLockHeld(pool: Pool, slot: number): Promise<boolean> {
  const { rows } = await pool.query<{ held: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = $1::int::oid AND objid = $2::int::oid AND granted) AS held",
    [RESET_LOCK_CLASS, slot],
  );
  return rows[0]?.held === true;
}

/**
 * The `application_name` a test file gives the connections of the routine: unique to the RUN and
 * to the file.
 *
 * Every run of `test:db` shares one maintenance database, and `pg_stat_activity` lists the
 * sessions of all of them. A fixed name would make a file see the routine's connection of the
 * same file in ANOTHER run that is in flight (a second row's gate, a whole-project run) and take
 * it for its own: that is what happened between 12:32 and 12:35 with the name this file used to
 * have. The run stamp is unique among live runs, and a file runs once per run.
 */
export function resetApplicationName(runStamp: string, file: string): string {
  if (!/^[0-9a-z]{8}$/.test(runStamp) || !/^[a-z0-9]{1,12}$/.test(file)) throw new Error('an application name needs the run stamp and a short file tag.');
  return `dems-db-reset-${file}-${runStamp}`;
}

/**
 * How long a test waits, at most, for the server to drop sessions that were closed. It is a cap
 * on a poll, not a pause: the poll returns as soon as the condition holds, so a generous cap
 * costs nothing on a quiet host and makes a loaded one no reason to fail.
 */
export const PATIENT_MS = 30_000;

function describeSessionRows(rows: readonly SessionRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `role ${row.role}, application ${row.application === '' ? '(none)' : row.application}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => `${count} x ${key}`).join('; ');
}

/**
 * Polls until the server lists no client session that matches the filter, and returns then.
 * Call it only AFTER the thing that closes those sessions has itself finished (the routine's
 * promise has settled, the pool was ended): it waits for the server, not for the client.
 *
 * If sessions are still listed after `capMs`, it throws, and the message says what was still
 * connected: role and application name, with a count. Nothing else of a session is read.
 */
export async function untilNoSession(pool: Pool, filter: SessionFilter, what: string, capMs: number = PATIENT_MS): Promise<void> {
  const started = Date.now();
  let pause = 10;
  for (;;) {
    const remaining = await sessionsOf(pool, filter);
    if (remaining.length === 0) return;
    const waited = Date.now() - started;
    if (waited >= capMs) {
      throw new Error(`${what}: still connected after ${waited} ms: ${describeSessionRows(remaining)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pause));
    pause = Math.min(pause * 2, 250);
  }
}

// ── Dumps: independent of how the routine itself reads a row ───────────────────────────────────

/** The primary key each kept table's dump is ordered by: every key column, quoted and joined (two for `capture_device_streams`, I-9c). */
const KEPT_KEYS: Readonly<Record<string, string>> = Object.fromEntries(KEPT_TABLES.map((table) => [table.name, table.keys.map((column) => `"${column}"`).join(', ')]));

/**
 * A stable ordered dump of one table: every row as the text of the whole record (`t::text`, the
 * composite output of PostgreSQL), in primary-key order. It is NOT the image the routine carries
 * (`to_jsonb`), so equal dumps are an independent proof that a row is byte-equal.
 */
export async function dumpTable(pool: Pool, table: string, orderBy: string): Promise<string[]> {
  const { rows } = await pool.query<{ line: string }>(`SELECT t::text AS line FROM public.${table} AS t ORDER BY ${orderBy}`);
  return rows.map((row) => row.line);
}

/** The dumps of the eight kept tables, by SQL name. */
export async function dumpKept(pool: Pool): Promise<Record<string, string[]>> {
  const dumps: Record<string, string[]> = {};
  for (const table of KEPT_TABLES) dumps[table.name] = await dumpTable(pool, table.name, KEPT_KEYS[table.name] ?? `"${table.key}"`);
  return dumps;
}

/** The checksum of contract §9.6, for a table with a known key: `md5(string_agg(to_jsonb(t)::text ORDER BY key))`. */
export async function contractChecksum(pool: Pool, table: string): Promise<string> {
  const key = KEPT_KEYS[table];
  if (key === undefined) throw new Error(`no key for ${table}`);
  const { rows } = await pool.query<{ digest: string }>(
    `SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY ${key}), '')) AS digest FROM public.${table} AS t`,
  );
  return rows[0]?.digest ?? '';
}

/**
 * A content digest of each of the 30 tables: the SHA-256 of all row images in image order, with
 * the row count. Independent of any key, so it works for every table. Two databases with equal
 * digests of a table hold the same rows in it.
 */
export async function digestAll(pool: Pool, options: { without?: Readonly<Record<string, readonly string[]>> } = {}): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};
  for (const { sqlName } of ALL_TABLES) {
    const dropped = (options.without?.[sqlName] ?? []).map((column) => ` - '${column}'`).join('');
    const { rows } = await pool.query<{ digest: string; rows: string }>(
      `SELECT encode(sha256(convert_to(coalesce(string_agg(x.image, E'\\n' ORDER BY x.image), ''), 'UTF8')), 'hex') AS digest, count(*)::text AS rows ` +
        `FROM (SELECT (to_jsonb(t)${dropped})::text AS image FROM public.${sqlName} AS t) AS x`,
    );
    digests[sqlName] = `${rows[0]?.rows ?? '?'} row(s) ${rows[0]?.digest ?? ''}`;
  }
  return digests;
}

export interface ChainFacts {
  readonly headSeq: string;
  readonly headHash: string;
  readonly rowCount: string;
  readonly firstSeq: string | null;
  readonly epoch: string | null;
}

/** The chain and the epoch of a database, read by the test itself, before a reset discards them. */
export async function chainFacts(pool: Pool): Promise<ChainFacts> {
  const { rows } = await pool.query<{ head_seq: string; head_hash: string; row_count: string; first_seq: string | null; epoch: string | null }>(
    'SELECT h.seq::text AS head_seq, h.hash AS head_hash, (SELECT count(*)::text FROM public.audit_log) AS row_count, ' +
      '(SELECT min(seq)::text FROM public.audit_log) AS first_seq, (SELECT epoch::text FROM public.core_state) AS epoch FROM public.audit_chain_head AS h',
  );
  const row = rows[0];
  if (row === undefined) throw new Error('no chain head row');
  return { headSeq: row.head_seq, headHash: row.head_hash, rowCount: row.row_count, firstSeq: row.first_seq, epoch: row.epoch };
}

export interface LineageDump {
  readonly reset_no: string;
  readonly epoch: string;
  readonly head_hash: string;
  readonly row_count: string;
  readonly first_seq: string;
  readonly last_seq: string;
  readonly reset_at: string;
  readonly actor_id: string | null;
  readonly reason: string;
  readonly scenario: string;
}

export async function lineageRows(pool: Pool): Promise<LineageDump[]> {
  // The order names the column (`h.reset_no`), not the text of the select list.
  const { rows } = await pool.query<LineageDump>(
    'SELECT h.reset_no::text AS reset_no, h.epoch::text AS epoch, h.head_hash, h.row_count::text AS row_count, h.first_seq::text AS first_seq, ' +
      'h.last_seq::text AS last_seq, h.reset_at::text AS reset_at, h.actor_id, h.reason, h.scenario FROM public.audit_chain_history AS h ORDER BY h.reset_no',
  );
  return rows;
}

// ── Fixtures: what a used Core holds in its kept tables ────────────────────────────────────────

/**
 * Fills the kept tables of a seeded database as its owner, the way a used Core would have them
 * (T-RS-1): two paired devices (one revoked), their credentials, five pairing codes of which one
 * is ACTIVE, three sessions (web, device, ended), three biometric tokens (live, used, revoked),
 * changed settings and moved registry counters. It also changes a role and disables an operator
 * (operators are NOT kept: the seed puts both back).
 */
export async function plantKeptRows(pool: Pool): Promise<void> {
  const t = SEED_NOW;
  await pool.query('UPDATE public.registry_counters SET next_value = 3 WHERE name = $1', ['device']);
  await pool.query('UPDATE public.registry_counters SET next_value = 6 WHERE name = $1', ['pairingCode']);
  await pool.query(
    "UPDATE public.console_settings SET presentation_mode = true, time_format = '12', notify_warnings = false, notify_sound = true, updated_at = $1",
    [t + 7 * MINUTE],
  );

  const code = (id: string, state: string, issuedAt: number, failed: number, closedAt: number | null, closedBy: string | null): unknown[] => [
    id,
    sha256(`w29-fixture-code-${id}`),
    state,
    'OPR-002',
    issuedAt,
    issuedAt + 5 * MINUTE,
    failed,
    closedAt,
    closedBy,
  ];
  for (const values of [
    code('PCD-000001', 'REDEEMED', t + 1 * MINUTE, 1, t + 2 * MINUTE, null),
    code('PCD-000002', 'REDEEMED', t + 3 * MINUTE, 0, t + 4 * MINUTE, null),
    code('PCD-000003', 'EXPIRED', t + 10 * MINUTE, 3, t + 15 * MINUTE, null),
    code('PCD-000004', 'CANCELLED', t + 16 * MINUTE, 0, t + 17 * MINUTE, 'OPR-002'),
    code(ACTIVE_CODE_ID, 'ACTIVE', t + 40 * MINUTE, 2, null, null),
  ]) {
    await pool.query(
      'INSERT INTO public.pairing_codes (id, code_hash, state, issued_by_operator_id, issued_at, expires_at, failed_attempts, closed_at, closed_by_operator_id) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      values,
    );
  }

  await pool.query(
    'INSERT INTO public.paired_devices (id, name, platform, app_version, state, paired_at, paired_with_code_id, last_seen_at, revoked_at, revoked_by_operator_id, revoke_reason, unpaired_at, updated_at) ' +
      "VALUES ('DEV-0001', $1, 'android', '0.2.0', 'PAIRED', $2, 'PCD-000001', $3, NULL, NULL, NULL, NULL, $3), " +
      "('DEV-0002', 'Old tablet', 'android', '0.1.0', 'REVOKED', $4, 'PCD-000002', $5, $6, 'OPR-002', $7, NULL, $6)",
    [AWKWARD_DEVICE_NAME, t + 2 * MINUTE, t + 55 * MINUTE, t + 4 * MINUTE, t + 20 * MINUTE, t + 30 * MINUTE, AWKWARD_REVOKE_REASON],
  );
  await pool.query(
    'INSERT INTO public.device_credentials (device_id, current_hash, next_hash, rotated_at) VALUES ' +
      "('DEV-0001', $1, $2, $3), ('DEV-0002', $4, NULL, NULL)",
    [sha256('w29-fixture-credential-1'), sha256('w29-fixture-credential-1-next'), t + 50 * MINUTE, sha256('w29-fixture-credential-2')],
  );

  await pool.query(
    'INSERT INTO public.auth_sessions (token_hash, operator_id, device_id, method, issued_at, last_seen_at, absolute_expires_at, ended_at, end_reason) VALUES ' +
      "($1, 'OPR-002', NULL, 'PASSWORD', $2, $3, $4, NULL, NULL), " +
      "($5, 'OPR-001', 'DEV-0001', 'BIOMETRIC', $6, $7, $8, NULL, NULL), " +
      "($9, 'OPR-001', NULL, 'PASSWORD', $10, $11, $12, $11, 'SIGNED_OUT')",
    [
      sha256(WEB_SESSION_TOKEN),
      t + 5 * MINUTE,
      t + 50 * MINUTE,
      t + 12 * 60 * MINUTE,
      sha256(DEVICE_SESSION_TOKEN),
      t + 20 * MINUTE,
      t + 55 * MINUTE,
      t + 12 * 60 * MINUTE,
      sha256(ENDED_SESSION_TOKEN),
      t + 1 * MINUTE,
      t + 2 * MINUTE,
      // 2^53 + 1: a bigint that a JavaScript number cannot hold. Carried as text, it keeps its last digit.
      BEYOND_DOUBLE,
    ],
  );

  await pool.query(
    'INSERT INTO public.biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at, used_at, revoked_at, revoke_reason) VALUES ' +
      "($1, '11111111-1111-4111-8111-111111111111', 'DEV-0001', 'OPR-001', $2, $3, $4, NULL, NULL), " +
      "($5, '11111111-1111-4111-8111-111111111111', 'DEV-0001', 'OPR-001', $4, $3, NULL, NULL, NULL), " +
      "($6, '22222222-2222-4222-8222-222222222222', 'DEV-0002', 'OPR-002', $2, $3, NULL, $7, 'DEVICE_REVOKED')",
    [
      sha256('w29-fixture-biometric-used'),
      t + 6 * MINUTE,
      t + 30 * 24 * 60 * MINUTE,
      t + 20 * MINUTE,
      sha256('w29-fixture-biometric-live'),
      sha256('w29-fixture-biometric-revoked'),
      t + 30 * MINUTE,
    ],
  );

  // Not kept: the seed rebuilds operators. OPR-003 is a TECHNICIAN in the dataset.
  await pool.query("UPDATE public.operators SET role_id = 'SUPERVISOR', role_changed_at = $1, enabled = false, updated_at = $1 WHERE id = 'OPR-003'", [
    t + 8 * MINUTE,
  ]);
}

/**
 * Appends audit rows to a database through the append protocol, as its owner: the chain lock,
 * then one INSERT per row built by the shared `appendAudit`. After it the chain of the database
 * is no longer the seed's chain, so "the head of the discarded chain" is a value of its own.
 */
export async function appendAuditRows(pool: Pool, inputs: readonly AuditInput[], at: number): Promise<void> {
  await drizzle(pool).transaction(async (transaction) => {
    const head = await transaction.execute<{ seq: string; hash: string }>('SELECT seq, hash FROM public.audit_chain_lock()');
    const start = head.rows[0];
    if (start === undefined) throw new Error('no chain head');
    let log = { rows: [], head: start.hash, total: Number(start.seq), dropped: 0 } as Parameters<typeof appendAudit>[0];
    for (const input of inputs) {
      const appended = appendAudit(log, input, at);
      log = appended.log;
      await transaction.insert(schema.auditLog).values(auditRowToRow(appended.row));
    }
  });
}

/** Two rows a recorded session would leave. */
export const RECORDED_SESSION_ROWS: readonly AuditInput[] = [
  { type: 'SESSION_CREATED', message: 'Session created', actorId: 'OPR-001', details: { fixture: 'w29' } },
  { type: 'RECORDING_STARTED', message: 'Recording started', actorId: 'OPR-001', details: { fixture: 'w29' } },
];

// ── Fault injection ────────────────────────────────────────────────────────────────────────────

/** The error an observer throws to stand for a failure at a checkpoint. */
export class InjectedFailure extends Error {
  constructor(checkpoint: ResetCheckpoint) {
    super(`injected failure at ${checkpoint}`);
    this.name = 'InjectedFailure';
  }
}

/** An `onCheckpoint` that throws at one checkpoint and records every checkpoint it saw. */
export function failAt(checkpoint: ResetCheckpoint): { seen: ResetCheckpoint[]; onCheckpoint: (point: ResetCheckpoint) => void } {
  const seen: ResetCheckpoint[] = [];
  return {
    seen,
    onCheckpoint(point) {
      seen.push(point);
      if (point === checkpoint) throw new InjectedFailure(checkpoint);
    },
  };
}

/** How often `needle` occurs in `haystack`. */
export function occurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) count += 1;
  return count;
}
