/**
 * Stand-in and recording pools for the tests of the reset routine (plan row W29; not a test
 * file; nothing here imports Vitest).
 *
 *   stubPools       no database at all: a script answers every statement. For the role check of
 *                   R-0 (T-RS-4: a superuser answer, with no real superuser connection, HC-1) and
 *                   for the refusals that cannot be provoked on the real server without one.
 *   recordingPools  the real owner pools, with every statement text written down before it is
 *                   sent: the proof of what the routine sends, and to which databases.
 */
import type { Pool } from 'pg';
import { createOwnerPool, readOwnerConnection } from '../../commands/owner-connection';
import type { ResetInternals } from '../routine';

type OpenPool = NonNullable<ResetInternals['openPool']>;

export interface Sent {
  readonly database: string;
  readonly text: string;
}

// ── A stub ─────────────────────────────────────────────────────────────────────────────────────

export type StubRow = Record<string, unknown>;
/** Answers one statement: rows, or an error to throw. `undefined` means "no row". */
export type StubScript = (text: string, values: readonly unknown[], database: string) => StubRow[] | Error | undefined;

export interface StubPools {
  readonly openPool: OpenPool;
  /** Every statement the routine sent, in order. */
  readonly sent: Sent[];
  /** The databases a pool was asked for, in order. */
  readonly opened: string[];
  readonly counts: { connected: number; released: number; ended: number };
  /**
   * The listeners the routine registered for the pool event `remove` (the driver's "this
   * connection has ended"). A test calls them to stand for the driver; they are only registered
   * when the pool says that it holds connections (`held`).
   */
  readonly removeListeners: Array<() => void>;
}

/**
 * Pools that talk to nothing. `connect` can be made to fail with `connectError`. A statement the
 * script does not answer gets no row.
 */
export function stubPools(script: StubScript, options: { connectError?: Error; held?: number } = {}): StubPools {
  const sent: Sent[] = [];
  const opened: string[] = [];
  const counts = { connected: 0, released: 0, ended: 0 };
  const removeListeners: Array<() => void> = [];
  const run = (database: string) => async (text: string, values: readonly unknown[] = []) => {
    sent.push({ database, text });
    const answer = script(text, values, database);
    if (answer instanceof Error) throw answer;
    const rows = answer ?? [];
    return { rows, rowCount: rows.length };
  };
  const openPool: OpenPool = (database) => {
    opened.push(database);
    const query = run(database);
    const client = {
      query,
      release: () => {
        counts.released += 1;
      },
      on: () => client,
      removeListener: () => client,
    };
    const pool = {
      query,
      connect: async () => {
        if (options.connectError !== undefined) throw options.connectError;
        counts.connected += 1;
        return client;
      },
      end: async () => {
        counts.ended += 1;
      },
      on: (event: string, listener: () => void) => {
        if (event === 'remove') removeListeners.push(listener);
        return pool;
      },
      removeListener: () => pool,
      // `held`: how many connections the pool says it holds when it is ended. Without it the
      // stand-in has no such count, like a pool that never connected.
      ...(options.held === undefined ? {} : { totalCount: options.held }),
    };
    return pool as unknown as Pool;
  };
  return { openPool, sent, opened, counts, removeListeners };
}

/** The answers of a healthy server up to R-2, for scripts that change one of them. */
export const healthy = {
  role: (): StubRow[] => [{ rolname: 'dems_owner', rolsuper: false }],
  lock: (): StubRow[] => [{ locked: true }],
  version: (): StubRow[] => [{ version: '18.4' }],
  noSession: (): StubRow[] => [],
};

/** A script from fragments of statement text: the first fragment a statement contains answers it. */
export function scriptOf(answers: ReadonlyArray<readonly [fragment: string, answer: StubRow[] | Error]>): StubScript {
  return (text) => answers.find(([fragment]) => text.includes(fragment))?.[1];
}

// ── A recorder ─────────────────────────────────────────────────────────────────────────────────

export interface RecordingPools {
  readonly openPool: OpenPool;
  readonly sent: Sent[];
  readonly opened: string[];
}

function textOf(argument: unknown): string {
  if (typeof argument === 'string') return argument;
  if (typeof argument === 'object' && argument !== null && 'text' in argument && typeof argument.text === 'string') return argument.text;
  return '<no text>';
}

/**
 * The real owner pools of the database commands, with every statement recorded before it is
 * sent: those of the routine itself, of the migrator and of the seed alike, because all of them
 * go through `query` of a pool or of a client checked out of one.
 */
export function recordingPools(dataDir: string): RecordingPools {
  const owner = readOwnerConnection(dataDir);
  const sent: Sent[] = [];
  const opened: string[] = [];
  const wrap = <T extends object>(target: T, database: string): T =>
    new Proxy(target, {
      get(object, property) {
        const value: unknown = Reflect.get(object, property, object);
        if (typeof value !== 'function') return value;
        const method = value as (...parameters: unknown[]) => unknown;
        if (property === 'query') {
          return (...parameters: unknown[]) => {
            sent.push({ database, text: textOf(parameters[0]) });
            return method.apply(object, parameters);
          };
        }
        if (property === 'connect') {
          return async (...parameters: unknown[]) => wrap((await method.apply(object, parameters)) as object, database);
        }
        return method.bind(object);
      },
    });
  return {
    sent,
    opened,
    openPool: (database, applicationName) => {
      opened.push(database);
      return wrap(createOwnerPool(owner, database, applicationName), database);
    },
  };
}

// ── A watcher of connections ───────────────────────────────────────────────────────────────────

export interface WatchedConnection {
  readonly database: string;
  /** True once the driver has closed the connection (the client's `end` event). */
  ended: boolean;
}

export interface WatchedPools {
  readonly openPool: OpenPool;
  /** Every connection a pool of the routine opened, in the order they were opened. */
  readonly connections: WatchedConnection[];
}

/**
 * The real owner pools, with every connection they open written down, and whether the driver
 * has closed it. For the question "when the routine settles, are its connections closed?",
 * which needs no polling: it is answered by the driver's own events, in this process.
 */
export function watchedPools(dataDir: string): WatchedPools {
  const owner = readOwnerConnection(dataDir);
  const connections: WatchedConnection[] = [];
  return {
    connections,
    openPool: (database, applicationName) => {
      const pool = createOwnerPool(owner, database, applicationName);
      pool.on('connect', (client) => {
        const entry: WatchedConnection = { database, ended: false };
        connections.push(entry);
        client.once('end', () => {
          entry.ended = true;
        });
      });
      return pool;
    },
  };
}

/** The first keyword of a statement, upper case. */
export function verbOf(text: string): string {
  return (/^\s*([A-Za-z]+)/.exec(text)?.[1] ?? '').toUpperCase();
}

/**
 * True for a statement that changes or removes rows of one of the two append-only tables: an
 * UPDATE or DELETE whose target, or a TRUNCATE whose list, is `audit_log` or
 * `audit_chain_history`. A trigger definition that only names those words is not one.
 */
export function rewritesAppendOnlyTable(text: string): boolean {
  const table = '(?:(?:"?public"?\\.)?"?(?:audit_log|audit_chain_history)"?)(?![a-z_])';
  return (
    new RegExp(`^\\s*UPDATE\\s+(?:ONLY\\s+)?${table}`, 'i').test(text) ||
    new RegExp(`^\\s*DELETE\\s+FROM\\s+(?:ONLY\\s+)?${table}`, 'i').test(text) ||
    new RegExp(`^\\s*TRUNCATE\\b[^;]*${table}`, 'i').test(text)
  );
}
