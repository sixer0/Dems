/**
 * Database pool plugin (plan row W08; spec §2.1 C-4, §7.4; database contract §7.4, §8.5).
 *
 * `app.db` holds the one pool of the runtime role. It is lazy: creating it opens no connection,
 * so the app factory works without PostgreSQL. The first query connects.
 *
 * Connection: five discrete fields from the configuration, every one passed explicitly, TLS off
 * (loopback only). Nothing falls back to a default host or port or to a variable that the driver
 * would read on its own (decision D26). The password is handed over through a function, so the
 * options of the pool hold no copy of it. The driver does keep it once a connection is made:
 * each connected client stores what the function returned, as members that are not enumerable
 * (`_getPassword` in `node_modules/pg/lib/client.js`). So it is in no printed client and in no
 * log line, but it is in the process's memory for as long as the connection lives.
 *
 * Search path (finding F53, decision D87): every connection of the pool starts with
 * `search_path = public,pg_temp`, sent as an option of the start-up packet, so no pooled
 * connection can be without it and no round trip is added. PostgreSQL searches the session's
 * temporary schema FIRST unless the path names it; the query builder names every table without
 * its schema, and the runtime role may create temporary tables. With the temporary schema named
 * last, a temporary table called like a real one is never found before the real one. Boot step
 * B-1 reads the setting back from a pooled connection and stops the boot when it is not exactly
 * that value. A unit of work sets the same value again for its own transaction
 * (`src/core/unit-of-work.ts`), whatever happened on its connection before.
 *
 * Readiness: `probe()` asks the database `SELECT 1` and sets `ready.database` to the outcome;
 * the health operation calls it, so the answer follows the pool. A probe result is reused for
 * one second, so health polling cannot load the database. An error on an idle connection (the
 * database stopped) sets the flag off at once. So does `connectionLost()`, which the pipeline
 * calls when a unit of work lost the connection it held; it also starts a probe at once.
 *
 * Reads: `read(source, work, request?)` is how a module reads on the pool outside a unit of
 * work. A read that fails is the database's failure, not the caller's: it is logged and
 * persisted by its code, readiness is told, and the caller answers 503 `NOT_READY` by letting
 * the error go. A handler passes its request, so that the line and the entry of a failed read
 * carry the request ID of the answer.
 *
 * Reset: the reset routine closes the pool (R-1) and opens it again on the rebuilt database
 * (R-9). `app.db.pool` is therefore a getter: do not keep the pool object, or anything built
 * on it, across a `reopen()`; `generation` tells a holder that a new pool exists.
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { Pool } from 'pg';
import { SERVICE_NAME, type DatabaseConnection } from '../../config';
import { ApiFailure, notReady } from '../error-envelope';
import { describeError } from '../logger';

/**
 * The request a read on the pool belongs to: its ID and its logger, and nothing else of it.
 * A handler passes `request` itself.
 */
export type ReadContext = Pick<FastifyRequest, 'id' | 'log'>;

/** Longest wait for a connection and for the probe statement, in milliseconds. */
export const DATABASE_TIMEOUT_MS = 2_000;
/** A probe result is reused for this long, in milliseconds. */
export const PROBE_REUSE_MS = 1_000;
export const POOL_MAX_CONNECTIONS = 10;

/** ID of the boot step this plugin adds: "the database answers" (database contract §7.4). */
export const BOOT_STEP_DATABASE_ANSWERS = 'B-1';

/**
 * The search path of the runtime role: the schema of the project, then the session's temporary
 * schema, named so that it comes LAST. One value for the pool's start-up option, for the boot
 * check and for the unit of work. No space: the start-up option is split at white space.
 */
export const RUNTIME_SEARCH_PATH = 'public,pg_temp';
/** The start-up option that every pooled connection of the runtime role is opened with. */
export const RUNTIME_CONNECTION_OPTIONS = `-c search_path=${RUNTIME_SEARCH_PATH}`;
/** What boot step B-1 asks a pooled connection after the database answered. */
export const SEARCH_PATH_QUESTION = "SELECT current_setting('search_path') AS search_path";
/** The code of the boot failure when a pooled connection has another search path. */
export const SEARCH_PATH_NOT_PINNED = 'SEARCH_PATH_NOT_PINNED';

/** Boot step B-1 stops the boot with this. `code` names the reason; the text is fixed. */
export class DatabaseBootError extends Error {
  readonly code: typeof SEARCH_PATH_NOT_PINNED;

  constructor(code: typeof SEARCH_PATH_NOT_PINNED, message: string) {
    super(message);
    this.name = 'DatabaseBootError';
    this.code = code;
  }
}

export type PoolFactory = (connection: DatabaseConnection) => Pool;

export interface Database {
  /** The current pool of the runtime role. Connects on first use. */
  readonly pool: Pool;
  /** Starts at 1 and grows by 1 at every `reopen()`. */
  readonly generation: number;
  /** True when the database answered. Sets `ready.database`. `fresh` skips the one-second reuse. */
  probe(options?: { readonly fresh?: boolean }): Promise<boolean>;
  /**
   * A read on the current pool, outside a unit of work: `work` gets the pool and returns what it
   * read. When `work` rejects with anything but an `ApiFailure`, the failure is the database's:
   * one error line and one persistent entry by its code (never its message, which can quote a
   * statement), a fresh probe so that readiness follows, and the rejection is 503 `NOT_READY`.
   * An `ApiFailure` thrown by `work` passes unchanged. `source` names the reader for the log,
   * for example `identity.findSession`: a name chosen in the code, never request data.
   *
   * `context` is the request the read belongs to, when there is one (fix round B1, finding F-3):
   * the error line is then written with the request's own logger, so it carries the request ID
   * of the answer, and the persistent entry holds it as `context.requestId`. A read outside a
   * request (stage 4's lookups, a sweep, a reset) passes none and is logged by the app's logger.
   */
  read<T>(source: string, work: (pool: Pool) => Promise<T>, context?: ReadContext): Promise<T>;
  /**
   * Told by whoever held a connection of the pool when that connection went away under it (a
   * unit of work). As after an error on an idle connection: `ready.database` is off at once and
   * no earlier probe result is reused; a fresh probe is started, and the flag is on again as
   * soon as one succeeds.
   */
  connectionLost(): void;
  /** Ends the pool. Until `reopen()`, every query is rejected and `probe()` gives false. */
  close(): Promise<void>;
  /** Ends the pool if it is open and creates a new one from the same configuration. */
  reopen(): Promise<void>;
}

export interface DatabasePluginOptions {
  /** Replaces the pool factory. Tests pass a fake; production uses `createRuntimePool`. */
  readonly createPool?: PoolFactory | undefined;
}

export function createRuntimePool(connection: DatabaseConnection): Pool {
  return new Pool({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: () => connection.password.reveal(),
    ssl: false,
    application_name: SERVICE_NAME,
    // In the start-up packet of every connection the pool opens (finding F53).
    options: RUNTIME_CONNECTION_OPTIONS,
    max: POOL_MAX_CONNECTIONS,
    connectionTimeoutMillis: DATABASE_TIMEOUT_MS,
  });
}

/**
 * Removes every variable whose name starts with `PG` from an environment object and returns
 * the removed NAMES. The driver reads such variables on its own for whatever the pool options
 * leave unset (an application name, options, the TLS mode); the entry point calls this once, so
 * that the connection is exactly what the configuration says (decision D26).
 */
export function removeDriverEnvironment(env: Record<string, string | undefined>): string[] {
  const removed = Object.keys(env).filter((name) => name.startsWith('PG'));
  for (const name of removed) delete env[name];
  return removed;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'PROBE_TIMEOUT' })), ms);
    timer.unref();
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const READ_FAILED = 'a read on the pool failed';

export const dbPlugin: FastifyPluginAsync<DatabasePluginOptions> = async (app, options) => {
  const createPool = options.createPool ?? createRuntimePool;
  const connection = app.config.database;

  let pool: Pool;
  let generation = 0;
  let closed = true;
  let lastProbe: { readonly at: number; readonly ok: boolean } | null = null;
  let probing: Promise<boolean> | null = null;

  /** Logs and persists a database failure by its code, once per change from "answers" to "does not". */
  function reportFailure(source: string, error: unknown): void {
    const wasReady = app.readiness.snapshot().database;
    app.readiness.set('database', false);
    if (!wasReady && lastProbe !== null && !lastProbe.ok) return;
    const description = describeError(error);
    app.log.warn({ code: description.code ?? description.errorName }, 'the database does not answer');
    app.errorLog.append({
      level: 'warn',
      source,
      message: 'the database does not answer',
      ...description,
      context: { database: connection.database, generation },
    });
  }

  function open(): void {
    pool = createPool(connection);
    generation += 1;
    closed = false;
    lastProbe = null;
    // Without a listener, an error on an idle connection would end the process.
    pool.on('error', (error) => {
      reportFailure('db.pool', error);
      lastProbe = { at: performance.now(), ok: false };
    });
  }

  async function runProbe(): Promise<boolean> {
    if (closed) {
      app.readiness.set('database', false);
      return false;
    }
    let ok = false;
    try {
      await withTimeout(pool.query('SELECT 1'), DATABASE_TIMEOUT_MS);
      ok = true;
      app.readiness.set('database', true);
    } catch (error) {
      reportFailure('db.probe', error);
    }
    lastProbe = { at: performance.now(), ok };
    return ok;
  }

  /**
   * The second half of boot step B-1: a pooled connection has exactly the pinned search path.
   * A pool that was built without the start-up option (a factory other than `createRuntimePool`)
   * stops the boot here, before any statement of the server names a table without its schema.
   */
  async function checkSearchPath(): Promise<void> {
    let found: unknown;
    try {
      const answer = await withTimeout(pool.query<{ search_path: unknown }>(SEARCH_PATH_QUESTION), DATABASE_TIMEOUT_MS);
      found = answer.rows[0]?.search_path;
    } catch (error) {
      reportFailure('db.boot', error);
      throw new Error('the database does not answer', { cause: error });
    }
    if (found === RUNTIME_SEARCH_PATH) return;
    const message =
      `${BOOT_STEP_DATABASE_ANSWERS}: a connection of the pool does not have the search path ${RUNTIME_SEARCH_PATH}. ` +
      'The runtime pool sets it as a start-up option (createRuntimePool); a pool that is built another way must set the same option.';
    // The value found is a setting of the server, not data of a request; it is cut to a line.
    const shown = typeof found === 'string' ? found.slice(0, 120) : null;
    app.log.error({ step: BOOT_STEP_DATABASE_ANSWERS, code: SEARCH_PATH_NOT_PINNED, expected: RUNTIME_SEARCH_PATH, found: shown }, 'boot check failed');
    app.errorLog.append({
      level: 'fatal',
      source: 'db.boot',
      message,
      code: SEARCH_PATH_NOT_PINNED,
      context: { step: BOOT_STEP_DATABASE_ANSWERS, database: connection.database, generation, expected: RUNTIME_SEARCH_PATH, found: shown },
    });
    throw new DatabaseBootError(SEARCH_PATH_NOT_PINNED, message);
  }

  const database: Database = {
    get pool() {
      return pool;
    },
    get generation() {
      return generation;
    },
    probe(probeOptions) {
      const reusable = lastProbe !== null && performance.now() - lastProbe.at < PROBE_REUSE_MS;
      if (probeOptions?.fresh !== true && reusable && lastProbe !== null) return Promise.resolve(lastProbe.ok);
      probing ??= runProbe().finally(() => {
        probing = null;
      });
      return probing;
    },
    async read(source, work, context) {
      try {
        return await work(pool);
      } catch (error) {
        if (error instanceof ApiFailure) throw error;
        // The request's logger when the read belongs to a request: its line names the request ID.
        (context?.log ?? app.log).error({ err: error, source }, READ_FAILED);
        app.errorLog.append({
          level: 'error',
          source,
          message: READ_FAILED,
          ...describeError(error),
          context: { database: connection.database, generation, ...(context === undefined ? {} : { requestId: context.id }) },
        });
        // Readiness follows the pool; the probe reports its own failure and never rejects.
        void database.probe({ fresh: true });
        throw notReady();
      }
    },
    connectionLost() {
      if (closed) return;
      app.readiness.set('database', false);
      lastProbe = { at: performance.now(), ok: false };
      void database.probe({ fresh: true });
    },
    async close() {
      if (closed) return;
      closed = true;
      lastProbe = null;
      app.readiness.set('database', false);
      await pool.end();
    },
    async reopen() {
      await database.close();
      open();
    },
  };

  open();
  app.decorate('db', database);

  app.readiness.addBootStep({
    id: BOOT_STEP_DATABASE_ANSWERS,
    async run() {
      if (!(await database.probe({ fresh: true }))) throw new Error('the database does not answer');
      await checkSearchPath();
    },
  });

  // Registered first among the plugins, so it runs last at shutdown: `onClose` hooks run in
  // reverse order, and the units above still need the pool while they finish.
  app.addHook('onClose', async () => {
    await database.close();
  });
};
