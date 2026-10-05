/**
 * The statements of the test helper, issued as `dems_owner` on the maintenance database
 * (database contract §10: TI-5, TI-6, TI-7, TI-10, TI-11).
 *
 * Every statement that creates, changes or drops a database takes a `GuardedDatabaseName`.
 * Such a value comes only from the name guard (`names.ts`), which throws before this file is
 * reached; so no statement here can name the demo database, a lane, the maintenance database,
 * a template of PostgreSQL, a proof database or a database of another, younger run (TI-3).
 * A utility statement takes no bind parameter (PG-19): the name is written as a quoted
 * identifier, and the guard has limited it to `[a-z0-9_]`.
 *
 * This file and the reset routine are the only places of the server workspace that drop a
 * database (T-AO-4, LN-6).
 */
import { CLONE_LOCK_KEY, DROP_RETRY_ATTEMPTS, DROP_RETRY_PAUSE_MS, EMPTY_TEMPLATE, LOCK_CLASS, OWNER_ROLE } from './constants';
import { DbTestHelperError, errorCode, errorMessage } from './errors';
import { quoteDatabaseName, type GuardedDatabaseName } from './names';
import type { StatementRunner } from './session';

type Runner = Pick<StatementRunner, 'run'>;
/** An interface as a row type: the runner asks for an index signature. */
type Indexed<T> = T & Record<string, unknown>;

const OWNER_IDENTIFIER = `"${OWNER_ROLE}"`;

// ── Catalog reads ──────────────────────────────────────────────────────────────────────────────

export interface DatabaseRow {
  readonly name: string;
  /** `pg_database.datdba` as a role name. */
  readonly owner: string;
  readonly isTemplate: boolean;
  readonly allowConnections: boolean;
}

const DATABASE_COLUMNS =
  'SELECT d.datname::text AS name, r.rolname::text AS owner, d.datistemplate AS "isTemplate", ' +
  'd.datallowconn AS "allowConnections" FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba';

/** Every database whose name starts with `prefix` (an exact prefix: no wildcard is involved). */
export async function listDatabasesWithPrefix(runner: Runner, prefix: string): Promise<DatabaseRow[]> {
  return runner.run<Indexed<DatabaseRow>>(`${DATABASE_COLUMNS} WHERE starts_with(d.datname, $1) ORDER BY d.datname`, [prefix]);
}

export async function findDatabase(runner: Runner, name: string): Promise<DatabaseRow | null> {
  const rows = await runner.run<Indexed<DatabaseRow>>(`${DATABASE_COLUMNS} WHERE d.datname = $1`, [name]);
  return rows[0] ?? null;
}

export interface SessionCount {
  /** `pg_stat_activity.usename`; the role is visible to every role (PG-27). */
  readonly role: string;
  readonly sessions: number;
}

/**
 * The sessions of roles on one database, by role. A role sees `datname`, `pid` and `usename` of
 * every session, but not the backend type of another role's session (PG-27), so "has a role" is
 * the test: a client session has one, an autovacuum worker has none.
 */
export async function sessionsOn(runner: Runner, database: string): Promise<SessionCount[]> {
  return runner.run<Indexed<SessionCount>>(
    'SELECT usename::text AS role, count(*)::int AS sessions FROM pg_stat_activity ' +
      'WHERE datname = $1 AND usename IS NOT NULL GROUP BY 1 ORDER BY 1',
    [database],
  );
}

export interface BackendGroup {
  /**
   * `pg_stat_activity.usename`. NULL for a backend that has no role: a background worker of the
   * server on that database, which in this cluster is an autovacuum worker.
   */
  readonly role: string | null;
  /** `pg_stat_activity.application_name`; empty for a background worker. */
  readonly application: string;
  readonly backends: number;
}

/**
 * Every backend on one database, by role and application name, the ones without a role included.
 *
 * Measured on PostgreSQL 18.4 (row W11b): of a backend of another role, and of one without a
 * role, `dems_owner` sees `datid`, `datname`, `pid`, `usesysid`, `usename` and
 * `application_name`; `backend_type`, `state` and the times are NULL and the statement text is
 * withheld. So the role tells the kinds apart, not the backend type: a client session has a
 * role, an autovacuum worker has none. The statement text is never asked for.
 */
export async function backendsOn(runner: Runner, database: string): Promise<BackendGroup[]> {
  return runner.run<Indexed<BackendGroup>>(
    "SELECT usename::text AS role, coalesce(application_name, '') AS application, count(*)::int AS backends " +
      'FROM pg_stat_activity WHERE datname = $1 GROUP BY 1, 2 ORDER BY 1 NULLS FIRST, 2',
    [database],
  );
}

/** The client sessions of a role other than the owner role: what `dems_owner` may not end. */
export function clientsOfOtherRoles(groups: readonly BackendGroup[]): BackendGroup[] {
  return groups.filter((group) => group.role !== null && group.role !== OWNER_ROLE);
}

/** Names the role and the application of each group; never a statement. */
export function describeBackends(groups: readonly BackendGroup[]): string {
  return groups
    .map((group) =>
      group.role === null
        ? `${group.backends} without a role (a background worker of PostgreSQL, such as autovacuum)`
        : `${group.backends} of role ${group.role}${group.application === '' ? '' : ` (application ${JSON.stringify(group.application)})`}`,
    )
    .join(', ');
}

/** The roles that have a session on any database whose name starts with `prefix` (T-TI-3). */
export async function sessionRolesWithPrefix(runner: Runner, prefix: string): Promise<string[]> {
  const rows = await runner.run<{ role: string }>(
    'SELECT DISTINCT usename::text AS role FROM pg_stat_activity ' +
      'WHERE starts_with(datname, $1) AND usename IS NOT NULL ORDER BY 1',
    [prefix],
  );
  return rows.map((row) => row.role);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Waits until no session that `counts` accepts is left on the database, at most
 * `timeoutMs`. Returns what is still there: an empty list means "drained".
 */
export async function waitForSessionsToEnd(
  runner: Runner,
  database: string,
  timeoutMs: number,
  counts: (session: SessionCount) => boolean = () => true,
): Promise<SessionCount[]> {
  const deadline = performance.now() + timeoutMs;
  let pause = 10;
  for (;;) {
    const remaining = (await sessionsOn(runner, database)).filter(counts);
    if (remaining.length === 0 || performance.now() >= deadline) return remaining;
    await sleep(pause);
    pause = Math.min(pause * 2, 200);
  }
}

export function describeSessions(sessions: readonly SessionCount[]): string {
  return sessions.map((session) => `${session.sessions} of role ${session.role}`).join(', ');
}

// ── Advisory locks (TI-7, TI-12) ───────────────────────────────────────────────────────────────

/** Waits for the clone lock; the session's `lock_timeout` bounds the wait (SQLSTATE 55P03). */
export async function takeCloneLock(runner: Runner): Promise<void> {
  await runner.run('SELECT pg_advisory_lock($1::int, $2::int)', [LOCK_CLASS, CLONE_LOCK_KEY]);
}

export async function releaseCloneLock(runner: Runner): Promise<void> {
  await runner.run('SELECT pg_advisory_unlock($1::int, $2::int)', [LOCK_CLASS, CLONE_LOCK_KEY]);
}

/** Tries the "this run is alive" lock of a stamp. False means that a live session holds it. */
export async function tryLivenessLock(runner: Runner, key: number): Promise<boolean> {
  const rows = await runner.run<{ locked: boolean }>('SELECT pg_try_advisory_lock($1::int, $2::int) AS locked', [LOCK_CLASS, key]);
  return rows[0]?.locked === true;
}

export async function releaseLivenessLock(runner: Runner, key: number): Promise<void> {
  await runner.run('SELECT pg_advisory_unlock($1::int, $2::int)', [LOCK_CLASS, key]);
}

/**
 * How many sessions OTHER THAN THIS ONE hold or wait for the clone lock.
 *
 * The question is keyed by the reader itself (`pid <> pg_backend_pid()`), as every read of
 * `pg_stat_activity` or `pg_locks` on the shared maintenance database must be (finding F-8 of
 * `29_db_reset_routine.md`): a count that took another run's row for the caller's own would wait
 * for a queue that is not there. What it counts is not keyed to a database: the clone lock is one
 * lock for all runs on the host (TI-7), so "somebody else holds it or is queued behind it" is
 * exactly the fact a caller that needs a quiet cluster asks for. A granted row and a waiting row
 * both count: a queue is not quiet.
 */
export async function cloneLockSessionsElsewhere(runner: Runner): Promise<number> {
  const rows = await runner.run<{ others: number }>(
    'SELECT count(*)::int AS others FROM pg_locks ' +
      `WHERE locktype = 'advisory' AND classid = ${LOCK_CLASS} AND objid = ${CLONE_LOCK_KEY} AND pid <> pg_backend_pid()`,
  );
  return rows[0]?.others ?? 0;
}

/** What a request for a quiet cluster found out about it. */
export interface ClusterQuiet {
  /** How long the helper looked, in milliseconds. */
  readonly waitedMs: number;
  /** True when it saw an empty clone-lock queue. False when it gave up at the budget. */
  readonly obtained: boolean;
  /** How long it was allowed to look, in milliseconds. */
  readonly budgetMs: number;
}

/** Not asked for: no statement, no wait. */
export const QUIET_NOT_ASKED: ClusterQuiet = { waitedMs: 0, obtained: false, budgetMs: 0 };

/**
 * Waits until no other session holds or waits for the clone lock, at most `budgetMs`, and reports
 * what it saw. It takes nothing and blocks nobody: when the bound passes, the caller creates its
 * database in the queue like any other request. The read is cheap (one row of `pg_locks`) and the
 * pause grows from 10 ms to 200 ms, so a full bound is about thirty reads.
 */
export async function waitForQuietCluster(runner: Runner, budgetMs: number): Promise<ClusterQuiet> {
  const started = performance.now();
  let pause = 10;
  for (;;) {
    if ((await cloneLockSessionsElsewhere(runner)) === 0) {
      return { waitedMs: performance.now() - started, obtained: true, budgetMs };
    }
    const waited = performance.now() - started;
    if (waited >= budgetMs) return { waitedMs: waited, obtained: false, budgetMs };
    await sleep(Math.min(pause, budgetMs - waited));
    pause = Math.min(pause * 2, 200);
  }
}

// ── Statements that change a database: guarded names only ──────────────────────────────────────

/** §10.1: the first template of a run, from the empty template of PostgreSQL. */
export async function createEmptyDatabase(runner: Runner, name: GuardedDatabaseName): Promise<void> {
  await runner.run(
    `CREATE DATABASE ${quoteDatabaseName(name)} OWNER ${OWNER_IDENTIFIER} TEMPLATE ${EMPTY_TEMPLATE} ENCODING 'UTF8' LOCALE 'C'`,
  );
}

/** TI-6: a copy of a template of the same run, default copy strategy, owned by `dems_owner`. */
export async function cloneDatabase(runner: Runner, name: GuardedDatabaseName, template: GuardedDatabaseName): Promise<void> {
  await runner.run(`CREATE DATABASE ${quoteDatabaseName(name)} TEMPLATE ${quoteDatabaseName(template)} OWNER ${OWNER_IDENTIFIER}`);
}

/** TI-5: a finished template accepts no connection, so a copy never finds a session on it. */
export async function lockTemplate(runner: Runner, name: GuardedDatabaseName): Promise<void> {
  await runner.run(`ALTER DATABASE ${quoteDatabaseName(name)} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`);
}

/** TI-11: a template must stop being one before it can be dropped. */
export async function unlockTemplate(runner: Runner, name: GuardedDatabaseName): Promise<void> {
  await runner.run(`ALTER DATABASE ${quoteDatabaseName(name)} WITH IS_TEMPLATE false`);
}

const INSUFFICIENT_PRIVILEGE = '42501';
const TERMINATE_REFUSED = /permission denied to terminate process/;

/**
 * True for the one refusal the forced drop is repeated after: the server would have to end a
 * backend that the owner role may not end. Another error with the same SQLSTATE (not the owner
 * of the database, for one) is not this refusal.
 */
export function isTerminateRefusal(error: unknown): boolean {
  return errorCode(error) === INSUFFICIENT_PRIVILEGE && TERMINATE_REFUSED.test(errorMessage(error));
}

export interface DropRetryPolicy {
  /** How many times the forced drop is sent at most. */
  readonly attempts: number;
  /** The wait between two attempts, in milliseconds. */
  readonly pauseMs: number;
}

export interface DropOutcome {
  /** How often the server refused the forced drop before it went through. 0 is the normal case. */
  readonly refusals: number;
}

/**
 * TI-10: the forced form ends leftover sessions of `dems_owner`; it cannot end another role's
 * (PG-26), and it cannot end a background worker of the server either.
 *
 * The server checks every backend on the database before it ends one, and refuses the whole
 * statement with SQLSTATE 42501 "permission denied to terminate process" if the owner role may
 * not end one of them; nothing is ended and nothing is dropped. Two kinds of backend cause that
 * (measured, row W11b):
 *
 *   - an autovacuum worker. It has no role, comes by itself to a database that has just been
 *     written to, and leaves by itself after milliseconds. The helper waits and sends the same
 *     statement again, a bounded number of times;
 *   - a client session of another role (`dems_app`): a leak of the test. Waiting does not help
 *     and must not hide it: the drop fails at once and names the role and the application.
 *
 * The plain form (without FORCE) is not used first: with any session on the database it takes
 * the server five seconds to refuse it, and an autovacuum worker that asked for the database
 * meanwhile then enters the moment it fails, so that the forced drop after it is refused too.
 */
export async function dropDatabase(runner: Runner, name: GuardedDatabaseName, policy: Partial<DropRetryPolicy> = {}): Promise<DropOutcome> {
  const attempts = Math.max(1, Math.trunc(policy.attempts ?? DROP_RETRY_ATTEMPTS));
  const pauseMs = Math.max(0, policy.pauseMs ?? DROP_RETRY_PAUSE_MS);
  const started = performance.now();
  let refusals = 0;
  for (;;) {
    try {
      await runner.run(`DROP DATABASE IF EXISTS ${quoteDatabaseName(name)} WITH (FORCE)`);
      return { refusals };
    } catch (error) {
      if (!isTerminateRefusal(error)) throw error;
      refusals += 1;
      const connected = await backendsOn(runner, name);
      const clients = clientsOfOtherRoles(connected);
      if (clients.length > 0) {
        throw new DbTestHelperError(
          'SESSIONS_REMAIN',
          `${name} cannot be dropped: a session of another role is connected to it (${describeBackends(clients)}), ` +
            'and PostgreSQL refused the forced drop (SQLSTATE 42501): the owner role may not end that session. ' +
            'Close the app or the pool under test in the cleanup of the file (db.onCleanup). ' +
            "The database is removed by the run's teardown, or by the stale sweep of a later run.",
          { cause: error },
        );
      }
      if (refusals >= attempts) {
        const seen =
          connected.length === 0
            ? 'nothing was on the database any more when the helper looked'
            : `on the database: ${describeBackends(connected)}; no client session of another role`;
        throw new DbTestHelperError(
          'DROP_REFUSED',
          `${name} could not be dropped: PostgreSQL refused the forced drop ${refusals} time(s) in ${Math.round(performance.now() - started)} ms ` +
            `(SQLSTATE 42501: ${errorMessage(error)}). At the last refusal, ${seen}. ` +
            "The database is removed by the run's teardown, or by the stale sweep of a later run.",
          { cause: error },
        );
      }
      await sleep(pauseMs);
    }
  }
}

/**
 * Tells the owner of a run, on the run's notification channel of the maintenance database, that
 * a drop needed a retry. The payload holds a database name and a count.
 */
export async function notifyRun(runner: Runner, channel: string, payload: string): Promise<void> {
  await runner.run('SELECT pg_notify($1, $2)', [channel, payload]);
}
