/**
 * Test support of the engine host (plan row W26; not a test file). Nothing here imports Vitest.
 *
 *   manual timer    the scheduler's timer, fired by hand beside a manual clock: no test waits;
 *   counting pool   the real pool of the runtime role with every statement of every connection
 *                   recorded, and a way to make one statement fail before it is sent;
 *   engine app      the real app factory on a clone, as `dems_app`, on a manual clock and the
 *                   manual timer;
 *   readers         the stored trail and the row counts, as `dems_owner` (SELECT only).
 *
 * What only the engine's own tests use (seeding a scenario, the meter frames, the replay of state
 * changes) is private to `src/engine/__tests__/support.ts`.
 *
 * NEUTRAL TEST SUPPORT (fix round B1, review finding CPB1-12). This file lives in
 * `apps/core-server/test/support/` because tests of several rows use it; it moved here from
 * `src/engine/__tests__/support.ts`, which re-exports it for one round. No production source imports
 * anything under `test/` (static test `test/static/imports.test.ts`).
 */
import { ROLE_PERMISSIONS, createManualClock, type ControllableClock, type OperatorRole, type SimOperator } from '@dems/shared/sim';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient, QueryConfig } from 'pg';
import { buildApp } from '../../src/app';
import type { ConfigInput, DatabaseConnection, LogLevel } from '../../src/config';
import { fromRows, type DurableSlices } from '../../src/db/mapping';
import { countAllTables, readStoredRows } from '../../src/db/store';
import type { Principal } from '../../src/plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from './config';
import { createRuntimePool } from '../../src/plugins/db';
import type { Publication } from '../../src/realtime';
import { engineControl, type EngineControl, type EngineHost, type EngineTimer } from '../../src/engine';

/** The fixed instant the shared suites use: 2026-10-01 10:00:00 WIB (ENG-20). */
export const FIXED_NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
export const TICK_MS = 50;

// ── The manual timer ───────────────────────────────────────────────────────────────────────────

export interface ManualTimer {
  readonly timer: EngineTimer;
  /** Calls every repeating callback that is registered, once. */
  fire(): void;
  /** How many repeating callbacks are registered now. */
  active(): number;
  /** How many were ever registered. */
  registered(): number;
}

export function manualTimer(): ManualTimer {
  const callbacks = new Set<() => void>();
  let registered = 0;
  return {
    timer: {
      every(_intervalMs, callback) {
        registered += 1;
        callbacks.add(callback);
        return () => {
          callbacks.delete(callback);
        };
      },
    },
    fire() {
      for (const callback of callbacks) callback();
    },
    active: () => callbacks.size,
    registered: () => registered,
  };
}

// ── The counting pool ──────────────────────────────────────────────────────────────────────────

export interface CountingPool {
  /** Pass as `buildApp({ createPool: counting.factory })`. A new real pool at every call (a reopen after a reset). */
  readonly factory: (connection: DatabaseConnection) => Pool;
  /** The text of every statement sent on a connection of a unit of work, in order, over every pool. */
  readonly statements: string[];
  /** Pools built, connections handed out, and how many are checked out now. */
  readonly connections: { pools: number; opened: number; inUse: number };
  /**
   * The next statement whose text matches is NOT sent: its promise rejects with an error that
   * carries `code`. Returns how many matching statements are still to fail (0 when it happened).
   */
  failNext(pattern: RegExp, code?: string): () => number;
}

const textOf = (query: string | QueryConfig): string => (typeof query === 'string' ? query : query.text);

export function countingPool(): CountingPool {
  const statements: string[] = [];
  const connections = { pools: 0, opened: 0, inUse: 0 };
  const failures: Array<{ pattern: RegExp; code: string; left: number }> = [];

  function wrap(client: PoolClient): PoolClient {
    return new Proxy(client, {
      get(target, property, receiver) {
        if (property === 'query') {
          return (query: string | QueryConfig, values?: unknown[]) => {
            const text = textOf(query);
            statements.push(text);
            const failure = failures.find((entry) => entry.left > 0 && entry.pattern.test(text));
            if (failure !== undefined) {
              failure.left -= 1;
              return Promise.reject(Object.assign(new Error('statement failed by the test'), { code: failure.code }));
            }
            const send = target.query.bind(target) as (statement: string | QueryConfig, parameters?: unknown[]) => Promise<unknown>;
            return values === undefined ? send(query) : send(query, values);
          };
        }
        if (property === 'release') {
          return (destroy?: boolean | Error) => {
            connections.inUse -= 1;
            return target.release(destroy);
          };
        }
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      },
    });
  }

  function factory(connection: DatabaseConnection): Pool {
    connections.pools += 1;
    return new Proxy(createRuntimePool(connection), {
      get(target, property, receiver) {
        if (property === 'connect') {
          return async () => {
            const client = await target.connect();
            connections.opened += 1;
            connections.inUse += 1;
            return wrap(client);
          };
        }
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      },
    });
  }

  return {
    factory,
    statements,
    connections,
    failNext(pattern, code = '08006') {
      const entry = { pattern, code, left: 1 };
      failures.push(entry);
      return () => entry.left;
    },
  };
}

// ── The app ────────────────────────────────────────────────────────────────────────────────────

export interface EngineApp {
  readonly app: FastifyInstance;
  readonly engine: EngineHost & EngineControl;
  /** The server clock of this app: it moves only when the test moves it (ENG-16). */
  readonly clock: ControllableClock;
  readonly timer: ManualTimer;
  readonly log: CapturedLog;
  readonly database: CountingPool;
  /** Everything handed to `app.publish`, in order. */
  readonly publications: Publication[];
  /**
   * Advances the clock by `ms`, `stepMs` at a time, fires the timer after each step and waits
   * until the tick's unit has ended: the engine at real cadence, without real time.
   */
  drive(ms: number, stepMs?: number): Promise<void>;
  /** A principal as stage 4 builds it for an operator of the engine's `operators` slice. */
  principal(role: OperatorRole): Extract<Principal, { kind: 'OPERATOR' }>;
  operator(role: OperatorRole): SimOperator;
}

export interface EngineAppTarget {
  /** Role `dems_app` on the clone. */
  readonly runtime: DatabaseConnection;
  onCleanup(close: () => Promise<unknown> | unknown): void;
}

export interface EngineAppOptions {
  /** Where the manual clock starts. Default: the fixed instant. */
  readonly startAt?: number;
  readonly logLevel?: LogLevel;
  /** Capture mode of the app's configuration. Default: the configuration's own (`simulated`). */
  readonly captureMode?: 'simulated' | 'real';
  /** Further configuration of the app (e.g. the worker program and data directory of a real-mode boot fixture). Wins over the options above. */
  readonly config?: Partial<ConfigInput>;
}

/**
 * The real app factory on a clone, as `dems_app`, ready, on a manual clock and a manual timer.
 * The engine is NOT started: a test calls `app.readiness.boot()` (a process start) or
 * `engine.start('reset')` (the state as stored). The app is closed before the clone is dropped.
 */
export async function engineApp(target: EngineAppTarget, dataDir: string, options: EngineAppOptions = {}): Promise<EngineApp> {
  const log = captureLog();
  const database = countingPool();
  const app = buildApp({
    config: unitTestConfig({
      database: target.runtime,
      dataDir,
      logLevel: options.logLevel ?? 'debug',
      ...(options.captureMode === undefined ? {} : { captureMode: options.captureMode }),
      ...options.config,
    }),
    logStream: log.stream,
    createPool: database.factory,
  });
  target.onCleanup(() => app.close());
  await app.ready();
  const clock = createManualClock(options.startAt ?? FIXED_NOW);
  app.seams.replace('clock', clock);
  const publications: Publication[] = [];
  app.seams.replace('publish', (publication) => void publications.push(publication));
  const engine = engineControl(app);
  const timer = manualTimer();
  engine.useTimer(timer.timer);

  const operator = (role: OperatorRole): SimOperator => {
    const found = engine.slice('operators').find((candidate) => candidate.role === role);
    if (found === undefined) throw new Error(`no operator with role ${role}`);
    return found;
  };

  return {
    app,
    engine,
    clock,
    timer,
    log,
    database,
    publications,
    async drive(ms, stepMs = TICK_MS) {
      for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
        clock.advance(stepMs);
        timer.fire();
        await engine.idle();
      }
    },
    operator,
    principal(role) {
      const found = operator(role);
      return {
        kind: 'OPERATOR',
        operatorId: found.id,
        sessionId: 'test-session',
        deviceId: null,
        role,
        permissions: ROLE_PERMISSIONS[role],
      };
    },
  };
}

/** The state changes among the publications. */
export function stateChanges(publications: readonly Publication[]) {
  return publications.flatMap((publication) => (publication.kind === 'state' ? [publication.change] : []));
}

// ── Readers (SELECT only) ──────────────────────────────────────────────────────────────────────

/** The durable slices the tables hold, read in one transaction: what a rehydration would get. */
export async function storedSlices(pool: Pool): Promise<DurableSlices> {
  return drizzle(pool).transaction(async (transaction) => fromRows(await readStoredRows(transaction)));
}

/** The row count of each of the 30 tables, by SQL name. */
export async function tableCounts(pool: Pool): Promise<Record<string, number>> {
  return countAllTables(drizzle(pool));
}

/** The tables whose count differs between two readings, with the difference. */
export function countChanges(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  const changes: Record<string, number> = {};
  for (const [table, count] of Object.entries(after)) {
    const difference = count - (before[table] ?? 0);
    if (difference !== 0) changes[table] = difference;
  }
  return changes;
}
