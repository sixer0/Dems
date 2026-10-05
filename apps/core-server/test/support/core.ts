/**
 * Test support of the core services (plan row W21; not a test file): the readers of the stored
 * trail, the recording error log, the server's logger in memory, and the stand-in for the runtime
 * pool. The app builder of the core's own database tests (`coreApp`) is not here: it is private to
 * `src/core/__tests__/support.ts`.
 *
 * NEUTRAL TEST SUPPORT (fix round B1, review finding CPB1-12). This file lives in
 * `apps/core-server/test/support/` because tests of several rows use it; it moved here from
 * `src/core/__tests__/support.ts`, which re-exports it for one round. No production source imports
 * anything under `test/` (static test `test/static/imports.test.ts`).
 *
 * Two kinds of test use it:
 *   - database tests (`*.db.test.ts`, project `db`): an app built by the real factory on the
 *     file's own clone, connected as `dems_app`, on a manual clock; and readers of the stored
 *     trail, which run as `dems_owner` or `dems_app` and only SELECT;
 *   - database-free tests (project `unit`): a stand-in pool that speaks the few statements the
 *     pipeline and the writers issue, keeps a head and a counter, and applies a transaction's
 *     writes at COMMIT only. It proves the control flow; the database tests prove the database.
 */
import { createManualClock, verifyAuditChain, type AuditRow, type ChainVerifyResult, type SimEvent } from '@dems/shared/sim';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool, QueryConfig } from 'pg';
import { buildApp } from '../../src/app';
import type { LogLevel } from '../../src/config';
import { captureLog, unitTestConfig, type CapturedLog } from './config';
import { RUNTIME_SEARCH_PATH, SEARCH_PATH_QUESTION } from '../../src/plugins/db';
import type { ErrorLog, ErrorLogEntry } from '../../src/plugins/logger';
import type { ChainHead } from '../../src/core/types';

/** A start for the manual clock that no wall clock of this decade can give: 2031-01-01T00:00:00Z. */
export const CLOCK_START = Date.UTC(2031, 0, 1);
/** 64 zero digits: the head of an empty chain. */
export const GENESIS = '0'.repeat(64);

export type ManualClock = ReturnType<typeof createManualClock>;

/** The nine boot checks of the database contract (§7.4), in the order in which they run. */
export const BOOT_CHECKS = ['B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-8', 'B-9'] as const;

/**
 * Of the boot steps that passed, those a test names, in the order in which they passed.
 *
 * A test compares this with the steps it expects: "these passed, in this order, and no other of
 * mine". A step that another unit adds to the boot, before, between or after them, does not
 * change the answer, so the test does not pin the list of ALL boot steps of the server (standing
 * rule M10; checkpoint CP-B1, finding CPB1-13).
 */
export function passedAmong(passed: readonly unknown[], steps: readonly string[]): string[] {
  return passed.filter((step): step is string => typeof step === 'string' && steps.includes(step));
}

/** What a stand-in pool answers so that boot step B-1 passes: the probe, and the pinned search path. */
export function answersBootStepOne(text: string): { rows: unknown[] } | undefined {
  if (text === 'SELECT 1') return { rows: [{ one: 1 }] };
  if (text === SEARCH_PATH_QUESTION) return { rows: [{ search_path: RUNTIME_SEARCH_PATH }] };
  return undefined;
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ── Database tests: readers of the stored trail (SELECT only) ─────────────────────────────────

interface AuditRecord {
  seq: string;
  id: string;
  at: string;
  type: string;
  category: string;
  severity: string;
  actor_id: string | null;
  message: string;
  session_id: string | null;
  evidence_id: string | null;
  device_id: string | null;
  details: AuditRow['details'];
  prev_hash: string;
  hash: string;
}

/** Every stored audit row in sequence order, in the shared row shape. */
export async function readTrail(pool: Pick<Pool, 'query'>): Promise<AuditRow[]> {
  const { rows } = await pool.query<AuditRecord>(
    'SELECT seq, id, at, type, category, severity, actor_id, message, session_id, evidence_id, device_id, details, prev_hash, hash ' +
      'FROM public.audit_log ORDER BY seq',
  );
  return rows.map((row) => ({
    seq: Number(row.seq),
    id: row.id,
    at: Number(row.at),
    type: row.type as AuditRow['type'],
    category: row.category as AuditRow['category'],
    severity: row.severity as AuditRow['severity'],
    actorId: row.actor_id,
    message: row.message,
    sessionId: row.session_id,
    evidenceId: row.evidence_id,
    deviceId: row.device_id,
    details: row.details,
    prevHash: row.prev_hash,
    hash: row.hash,
  }));
}

export async function readHead(pool: Pick<Pool, 'query'>): Promise<ChainHead> {
  const { rows } = await pool.query<{ seq: string; hash: string }>('SELECT seq, hash FROM public.audit_chain_head');
  const row = rows[0];
  if (row === undefined) throw new Error('audit_chain_head has no row');
  return { seq: Number(row.seq), hash: row.hash };
}

interface EventRecord {
  seq: string;
  id: string;
  at: string;
  type: string;
  category: string;
  severity: string;
  message: string;
  params: SimEvent['params'];
  session_id: string | null;
  device_id: string | null;
}

/** Every stored event in sequence order, with the derived category column. */
export async function readEvents(pool: Pick<Pool, 'query'>): Promise<Array<SimEvent & { category: string }>> {
  const { rows } = await pool.query<EventRecord>(
    'SELECT seq, id, at, type, category, severity, message, params, session_id, device_id FROM public.events ORDER BY seq',
  );
  return rows.map((row) => ({
    seq: Number(row.seq),
    id: row.id,
    at: Number(row.at),
    type: row.type as SimEvent['type'],
    category: row.category,
    severity: row.severity as SimEvent['severity'],
    message: row.message,
    params: row.params,
    sessionId: row.session_id,
    deviceId: row.device_id,
  }));
}

export async function readEventCounter(pool: Pick<Pool, 'query'>): Promise<number | null> {
  const { rows } = await pool.query<{ next_value: string }>("SELECT next_value FROM public.engine_counters WHERE name = 'event'");
  return rows[0] === undefined ? null : Number(rows[0].next_value);
}

/** The SHARED verification over ALL stored rows: nothing dropped, the head as stored. */
export function verifyTrail(rows: readonly AuditRow[], head: ChainHead): ChainVerifyResult {
  return verifyAuditChain({ rows: [...rows], head: head.hash, total: head.seq, dropped: 0 });
}

/** The link rule, stated without the shared code: gap-free from 1, each row on its predecessor. */
export function linkProblems(rows: readonly AuditRow[]): string[] {
  const problems: string[] = [];
  rows.forEach((row, index) => {
    if (row.seq !== index + 1) problems.push(`position ${index} holds sequence ${row.seq}`);
    const expected = index === 0 ? GENESIS : rows[index - 1]?.hash;
    if (row.prevHash !== expected) problems.push(`sequence ${row.seq} does not link to its predecessor`);
  });
  return problems;
}

// ── Database-free tests ────────────────────────────────────────────────────────────────────────

export interface RecordingErrorLog extends ErrorLog {
  readonly entries: ErrorLogEntry[];
}

export function recordingErrorLog(): RecordingErrorLog {
  const entries: ErrorLogEntry[] = [];
  return { file: null, entries, append: (entry) => void entries.push(entry) };
}

export interface TestLogger {
  readonly log: FastifyBaseLogger;
  readonly captured: CapturedLog;
  close(): Promise<void>;
}

/** The server's own logger (serializers, redaction, the log-method hook) writing into memory. */
export function testLogger(level: LogLevel = 'trace'): TestLogger {
  const captured = captureLog();
  const app = buildApp({ config: unitTestConfig({ logLevel: level }), logStream: captured.stream });
  return { log: app.log, captured, close: () => app.close() };
}

export interface StandInOptions {
  /** Decides a statement before the stand-in answers it: return an error to make it fail. */
  readonly failOn?: (text: string, values: readonly unknown[]) => Error | undefined;
  /** Makes `connect()` fail. */
  readonly connectError?: Error;
  /** Milliseconds every statement takes. */
  readonly statementMs?: number;
  /** What the server answers to COMMIT. `ROLLBACK` is its answer for a failed transaction. */
  readonly commitAnswer?: 'COMMIT' | 'ROLLBACK';
  /** No row for the event counter: a database that was never seeded. */
  readonly withoutEventCounter?: boolean;
  /** Decides a statement on the POOL itself (the probe, a boot check): return an error to make it fail. */
  readonly failOnPool?: (text: string) => Error | undefined;
}

/** One statement as a connection of the stand-in received it. */
export interface SentStatement {
  readonly text: string;
  /** `extended` when the caller asked for the extended protocol in so many words. */
  readonly mode: 'extended' | 'default';
  readonly values: readonly unknown[];
}

export interface StandInDatabase {
  readonly pool: Pool;
  /** Every statement text that reached a connection, in order. */
  readonly statements: string[];
  /** The same statements with the protocol the caller asked for and their values. */
  readonly sent: SentStatement[];
  /** What is committed: the head, the audit rows, the events (with the category column), the next event sequence. */
  readonly committed: { head: ChainHead; auditSeqs: number[]; eventSeqs: number[]; eventCategories: string[]; eventCounter: number };
  readonly connections: { opened: number; released: number; destroyed: number };
  /** Emits `error` on the connection that is checked out, as a lost connection does. */
  breakConnection(error: Error): void;
}

interface Pending {
  head: ChainHead;
  auditSeqs: number[];
  eventSeqs: number[];
  eventCategories: string[];
  eventCounter: number;
}

/**
 * A stand-in for the runtime pool. It answers the unit's own statements, the chain lock, the
 * audit insert, the event counter and the event insert (in the form the query builder writes
 * them for the typed tables), and applies a transaction's writes at COMMIT. Every other
 * statement answers with no row.
 */
export function standInDatabase(options: StandInOptions = {}): StandInDatabase {
  const statements: string[] = [];
  const sent: SentStatement[] = [];
  const committed = {
    head: { seq: 0, hash: GENESIS } as ChainHead,
    auditSeqs: [] as number[],
    eventSeqs: [] as number[],
    eventCategories: [] as string[],
    eventCounter: 1,
  };
  const connections = { opened: 0, released: 0, destroyed: 0 };
  let errorListeners: Array<(error: Error) => void> = [];

  function client() {
    let pending: Pending | null = null;
    let released = false;
    const own: Array<(error: Error) => void> = [];

    async function query(query: string | QueryConfig, values: readonly unknown[] = []) {
      const text = typeof query === 'string' ? query : query.text;
      if (released) throw Object.assign(new Error('the connection was closed'), { code: 'ECONNRESET' });
      statements.push(text);
      const asked = typeof query === 'string' ? undefined : (query as { queryMode?: unknown }).queryMode;
      sent.push({ text, mode: asked === 'extended' ? 'extended' : 'default', values: [...values] });
      if (options.statementMs !== undefined) await sleep(options.statementMs);
      if (released) throw Object.assign(new Error('the connection was closed'), { code: 'ECONNRESET' });
      const failure = options.failOn?.(text, values);
      if (failure !== undefined) throw failure;
      const answer = (rows: unknown[], command = 'SELECT') => ({ rows, rowCount: rows.length, command, fields: [], oid: 0 });

      if (/^BEGIN\b/.test(text)) {
        pending = {
          head: committed.head,
          auditSeqs: [...committed.auditSeqs],
          eventSeqs: [...committed.eventSeqs],
          eventCategories: [...committed.eventCategories],
          eventCounter: committed.eventCounter,
        };
        return answer([], 'BEGIN');
      }
      if (text === 'COMMIT') {
        const command = options.commitAnswer ?? 'COMMIT';
        if (command === 'COMMIT' && pending !== null) Object.assign(committed, pending);
        pending = null;
        return answer([], command);
      }
      if (text === 'ROLLBACK') {
        pending = null;
        return answer([], 'ROLLBACK');
      }
      if (pending === null) return answer([]);
      if (text.includes('audit_chain_lock()')) return answer([{ seq: String(pending.head.seq), hash: pending.head.hash }]);
      if (text.startsWith('insert into "audit_log" ')) {
        const seq = Number(values[0]);
        if (seq !== pending.head.seq + 1 || values[12] !== pending.head.hash) {
          throw Object.assign(new Error('audit chain: the row does not continue the head'), { code: 'ZA001' });
        }
        pending.head = { seq, hash: String(values[13]) };
        pending.auditSeqs.push(seq);
        return answer([], 'INSERT');
      }
      if (text.startsWith('UPDATE public.engine_counters') && text.includes('next_value + $2')) {
        if (options.withoutEventCounter === true) return answer([], 'UPDATE');
        const first = pending.eventCounter;
        pending.eventCounter += Number(values[1]);
        return answer([{ first_seq: String(first) }], 'UPDATE');
      }
      if (text.startsWith('UPDATE public.engine_counters') && text.includes('GREATEST')) {
        if (options.withoutEventCounter === true) return answer([], 'UPDATE');
        pending.eventCounter = Math.max(pending.eventCounter, Number(values[1]));
        return answer([{ next_value: String(pending.eventCounter) }], 'UPDATE');
      }
      if (text.startsWith('insert into "events" ')) {
        pending.eventSeqs.push(Number(values[0]));
        pending.eventCategories.push(String(values[4]));
        return answer([], 'INSERT');
      }
      return answer([]);
    }

    return {
      query,
      on(event: string, listener: (error: Error) => void) {
        if (event === 'error') {
          own.push(listener);
          errorListeners.push(listener);
        }
        return this;
      },
      removeListener(event: string, listener: (error: Error) => void) {
        if (event === 'error') errorListeners = errorListeners.filter((candidate) => candidate !== listener);
        return this;
      },
      release(destroy?: boolean | Error) {
        if (released) throw new Error('released twice');
        released = true;
        pending = null;
        errorListeners = errorListeners.filter((candidate) => !own.includes(candidate));
        if (destroy === undefined || destroy === false) connections.released += 1;
        else connections.destroyed += 1;
      },
    };
  }

  const pool = {
    async connect() {
      if (options.connectError !== undefined) throw options.connectError;
      connections.opened += 1;
      return client();
    },
    // What the pool plugin of the scaffold needs when this stand-in is the app's pool: the
    // probe's `SELECT 1` answers, a pooled connection has the pinned search path (boot step
    // B-1), and the questions of the boot checks B-2 to B-9 answer with no row.
    async query(text: string) {
      statements.push(text);
      const failure = options.failOnPool?.(text);
      if (failure !== undefined) throw failure;
      const rows = text === SEARCH_PATH_QUESTION ? [{ search_path: RUNTIME_SEARCH_PATH }] : [];
      return { rows, rowCount: rows.length, command: 'SELECT', fields: [], oid: 0 };
    },
    on() {
      return pool;
    },
    async end() {
      /* nothing to close */
    },
  };

  return {
    pool: pool as unknown as Pool,
    statements,
    sent,
    committed,
    connections,
    breakConnection(error) {
      // A listener may remove itself while it runs: iterate over a copy.
      const current = errorListeners.slice();
      for (const listener of current) listener(error);
    },
  };
}
