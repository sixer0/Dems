/**
 * Support for the tests of plan row W20 (not a test file). Nothing here imports Vitest, so the
 * pure tests of the mapping and the database tests of the seed can both use it. Other rows use
 * its headless host (`createHost`), its dump and its checksums.
 *
 * NEUTRAL TEST SUPPORT (fix round B1, review finding CPB1-12). This file lives in
 * `apps/core-server/test/support/` because tests of several rows use it; it moved here from
 * `src/db/seed/__tests__/support.ts`, which re-exports it for one round. No production source imports
 * anything under `test/` (static test `test/static/imports.test.ts`).
 */
import { createHash } from 'node:crypto';
import {
  ALWAYS_VISIBLE,
  AuthStatus,
  DEFAULT_SEED,
  createManualClock,
  createSim,
  signedOutAuth,
  type ScenarioName,
  type Sim,
  type SimOperator,
  type SimScheduler,
  type SimState,
  type TimerAdapter,
} from '@dems/shared/sim';
import type { Pool } from 'pg';
import { DURABLE_SLICE_KEYS, pickDurable, type DurableSlices, type MappedRows, type StoredRows } from '../../src/db/mapping';
import { ALL_TABLES } from '../../src/db/store';

/** The fixed instant the shared suites use: 2026-10-01 10:00:00 WIB (ENG-20, DR-5). */
export const FIXED_NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
export const DAY_MS = 86_400_000;
export const ENGINE_TICK_MS = 50;

export const SCENARIOS = ['idle', 'recording', 'finalizing', 'fault-demo'] as const satisfies readonly ScenarioName[];

/** The row counts of contract §9.4 after a first seed of scenario `idle`: all 30 tables. */
export const EXPECTED_SEED_COUNTS: Readonly<Record<string, number>> = Object.freeze({
  active_session: 0,
  alerts: 0,
  audit_chain_head: 1,
  audit_chain_history: 0,
  audit_log: 82,
  auth_sessions: 0,
  biometric_tokens: 0,
  // Schema v2 site config (CS-21): the seed writes the one selector row and the five built-in
  // devices; the credential table stays empty (SD-8).
  capture_config: 1,
  capture_device_credentials: 0,
  capture_devices: 9, // D60: four built-in cameras; D61 (2026-11-04): four numbered microphones, the switch (was seven)
  console_settings: 1,
  core_device: 1,
  core_state: 1,
  device_credentials: 0,
  engine_counters: 5,
  events: 59,
  evidence_custody: 28,
  evidence_items: 13,
  // Fix wave J (truth rule 3a): 48 = 12 sealed items x 4 tracks. The one never-sealed item (EV ...-0006, the
  // INCOMPLETE session) has no track row: it carries no track hash (was 52 while it was built like a seal).
  evidence_tracks: 48,
  exports: 1,
  hardware_snapshot: 1,
  health_snapshots: 0,
  operator_credentials: 3,
  operators: 3,
  paired_devices: 0,
  pairing_codes: 0,
  // 15 and 23 since task 4 row 100: the commissioning permission and its one grant (TECHNICIAN).
  permissions: 15,
  registry_counters: 2,
  role_permissions: 23,
  roles: 3,
  schema_meta: 1,
  session_history: 13,
  storage_policy: 1,
  // Schema v2 data tables: the seed writes none of these except the `stt_config` singleton of
  // row 114 (R-8); they fill with capture, sealing and transcription (rows 55/63/65).
  session_audio_intervals: 0,
  recording_fragments: 0,
  transcript_chunks: 0,
  transcripts: 0,
  transcript_revisions: 0,
  sealing_jobs: 0,
  stt_config: 1,
  // Schema v3 (dbc-4 §N.10, rule S-1): no source row while the seed writes no interval.
  session_capture_sources: 0,
  // Schema v5 (erratum PE-129b-01, row 129b): the seed starts no session, so no STT snapshot.
  session_stt_config: 0,
  // Schema v6 (erratum PE-0013-01): the seed writes no media store root; the Core does, at boot.
  core_media_store: 0,
  // Schema v7 (task 4 schema set A): the seed writes no stream fact and no sound-card input; a
  // connection test and a registration do.
  capture_device_streams: 0,
  capture_audio_inputs: 0,
  // Schema v8 (task 4 schema set B): the seed writes no network settings (the row is made at first
  // use, and the camera interface is never chosen for the technician) and no alias row.
  capture_network_config: 0,
  host_network_aliases: 0,
  // Schema v11 (task 4 schema set C): the seed accepts no installation; the acceptance operation does.
  installation_acceptances: 0,
});

// ── The wire form ──────────────────────────────────────────────────────────────────────────────

/**
 * A value as a JSON column gives it back: the JSON round trip. It is what the simulator's own
 * snapshot storage does too. The only difference to the original, for the states the shared
 * code builds, is the sign of a negative zero (JSON has one zero).
 */
export function wire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The paths of every negative zero in a value. */
export function negativeZeros(value: unknown, path = '$', found: string[] = []): string[] {
  if (typeof value === 'number') {
    if (Object.is(value, -0)) found.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => negativeZeros(item, `${path}[${index}]`, found));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, member] of Object.entries(value)) negativeZeros(member, `${path}.${key}`, found);
  }
  return found;
}

/** The durable slices with every negative zero written as zero, and nothing else changed. */
export function withoutNegativeZeros(slices: DurableSlices): DurableSlices {
  const replace = (value: unknown): unknown => {
    if (typeof value === 'number') return Object.is(value, -0) ? 0 : value;
    if (Array.isArray(value)) return value.map(replace);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, member]) => [key, replace(member)]));
    }
    return value;
  };
  return replace(pickDurable(slices)) as DurableSlices;
}

/** The JSON columns of the mapped tables, by table binding and property. */
const JSON_COLUMNS: { readonly [K in keyof MappedRows]?: readonly string[] } = {
  hardwareSnapshot: [
    'tabletLink',
    'cameras',
    'mics',
    'storage',
    'timeStatus',
    'network',
    'security',
    'services',
    'health',
    'otherDevices',
    'ports',
    'faults',
    'diagnostics',
    'softwareUpdate',
  ],
  evidenceItems: ['markers', 'notes'],
  activeSession: ['precheck', 'finalization', 'timeline', 'notes', 'fault', 'recovery'],
  alerts: ['params'],
  auditLog: ['details'],
  events: ['params'],
};

/**
 * The rows as PostgreSQL would give them back, without a database: every JSON column goes
 * through the JSON round trip, and the rows of each table come in a scrambled order (a reader
 * must not depend on the order of its input). Used by the pure round-trip tests.
 */
export function asStored(rows: MappedRows): StoredRows {
  const stored: Record<string, unknown[]> = {};
  for (const [table, tableRows] of Object.entries(rows) as [keyof MappedRows, Record<string, unknown>[]][]) {
    if (table === 'exportRecords') continue;
    const jsonColumns = JSON_COLUMNS[table] ?? [];
    const copies = tableRows.map((row) => {
      const copy: Record<string, unknown> = { ...row };
      for (const column of jsonColumns) copy[column] = copy[column] === null ? null : wire(copy[column]);
      return copy;
    });
    // A fixed scramble: reverse, then move every third row to the front.
    const reversed = copies.reverse();
    stored[table] = [...reversed.filter((_, index) => index % 3 === 0), ...reversed.filter((_, index) => index % 3 !== 0)];
  }
  return stored as unknown as StoredRows;
}

export const durableKeys = DURABLE_SLICE_KEYS;

// ── A headless engine with a manual clock ──────────────────────────────────────────────────────

export interface Host {
  readonly sim: Sim;
  /**
   * Advances the manual clock by `ms`, `stepMs` at a time (default: one engine interval), and
   * calls the engine's tick after every step. A larger step makes a long run cheap: the engine
   * carries the elapsed time into its next tick.
   */
  drive(ms: number, stepMs?: number): void;
  /** Runs `command` as `operator`: the actor scope of the engine host (ENG-2). */
  runAs<R>(operator: SimOperator, command: () => R): R;
  state(): SimState;
  operator(role: SimOperator['role']): SimOperator;
  now(): number;
  readonly errors: unknown[];
}

/**
 * The engine host in miniature, as the headless proof built it: a manual clock, an injected
 * scheduler and timers, memory storage, always visible. Nothing real is scheduled.
 */
export async function createHost(options: { scenario: ScenarioName; startAt?: number }): Promise<Host> {
  const clock = createManualClock(options.startAt ?? FIXED_NOW);
  let tick: (() => void) | null = null;
  const scheduler: SimScheduler = (run) => {
    tick = run;
    return () => {
      tick = null;
    };
  };
  const pending = new Map<number, { at: number; callback: () => void }>();
  let handles = 0;
  const timers: TimerAdapter = {
    setTimeout(callback, ms) {
      handles += 1;
      pending.set(handles, { at: clock.now() + ms, callback });
      return handles;
    },
    clearTimeout(handle) {
      pending.delete(handle as number);
    },
  };
  const errors: unknown[] = [];
  const sim = createSim({
    seed: DEFAULT_SEED,
    scenario: options.scenario,
    clock,
    scheduler,
    storage: null,
    authStorage: null,
    visibility: ALWAYS_VISIBLE,
    timers,
    onError: (report) => errors.push(report),
  });
  await sim.ready;
  sim.start();
  return {
    sim,
    errors,
    now: () => clock.now(),
    state: () => sim.store.getState(),
    operator(role) {
      const found = sim.store.getState().operators.find((candidate) => candidate.role === role);
      if (found === undefined) throw new Error(`no operator with role ${role}`);
      return found;
    },
    drive(ms, stepMs = ENGINE_TICK_MS) {
      for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
        clock.advance(stepMs);
        if (tick === null) throw new Error('the engine was not started');
        tick();
        // Deleting the entry being visited is safe while a Map is iterated.
        for (const [handle, timer] of pending) {
          if (timer.at <= clock.now()) {
            pending.delete(handle);
            timer.callback();
          }
        }
      }
    },
    runAs(operator, command) {
      const at = clock.now();
      sim.store.setState({
        auth: { status: AuthStatus.SIGNED_IN, operatorId: operator.id, method: null, issuedAt: at, lastActivityAt: at },
      });
      try {
        return command();
      } finally {
        sim.store.setState({ auth: signedOutAuth() });
      }
    },
  };
}

// ── Dumps and checksums ────────────────────────────────────────────────────────────────────────

/**
 * The dump of AC-B-28 and ST-6: every row of every table of schema `public`, as `to_jsonb(row)`
 * text, one line per row, each table under a header line. A `bytea` value appears as its hex
 * form, so a hash column is searched too.
 */
export async function dumpDatabase(pool: Pool): Promise<string> {
  const lines: string[] = [];
  for (const { sqlName } of ALL_TABLES) {
    const { rows } = await pool.query<{ line: string }>(`SELECT to_jsonb(t)::text AS line FROM public.${sqlName} AS t`);
    lines.push(`-- ${sqlName}: ${rows.length} row(s)`);
    for (const row of rows) lines.push(row.line);
  }
  return lines.join('\n');
}

/** How often `needle` occurs in `haystack`. */
export function occurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) count += 1;
  return count;
}

/**
 * How often a string of digits occurs as a value of its own, that is not as part of a longer
 * run of hexadecimal digits (a hash, a timestamp, a byte count).
 */
export function standaloneOccurrences(haystack: string, digits: string): number {
  const pattern = new RegExp(`(?<![0-9a-fA-F])${digits.replace(/[^0-9]/g, '')}(?![0-9a-fA-F])`, 'g');
  return [...haystack.matchAll(pattern)].length;
}

/** The primary key each table's checksum is ordered by (contract §9.6). */
const CHECKSUM_KEYS: Readonly<Record<string, string>> = {
  active_session: 'singleton',
  alerts: 'id',
  audit_chain_head: 'singleton',
  audit_chain_history: 'reset_no',
  audit_log: 'seq',
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
};

/**
 * The content checksum of each table by the recipe of contract §9.6:
 * `md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY <key>), ''))`. Left out, as the
 * contract says: `operator_credentials` (fresh salts) and the three tables keyed by a generated
 * identifier, which a seed leaves empty.
 */
export async function tableChecksums(pool: Pool): Promise<Record<string, string>> {
  const checksums: Record<string, string> = {};
  for (const [table, key] of Object.entries(CHECKSUM_KEYS)) {
    const { rows } = await pool.query<{ digest: string }>(
      `SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY ${key}), '')) AS digest FROM public.${table} AS t`,
    );
    checksums[table] = rows[0]?.digest ?? '';
  }
  return checksums;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
