/**
 * The reset and carry-over routine, steps R-0 to R-9 (plan row W29; hand-built element HB-3;
 * database contract §8.5, §6.6, §4.30; spec §12.4, DC-4 to DC-9, SR-56, SR-58, SR-68, SR-78).
 *
 * A reset never changes the live database. It builds a new one beside it, copies the kept rows
 * into it, swaps the two names, and drops the old database LAST:
 *
 *   R-0  guard      the name; the owner file; ONE connection as `dems_owner` on `postgres`;
 *                   the role check; the advisory lock (442001, slot)
 *   R-1  quiesce    the caller's hook (the server closes its pool); no session on the target
 *   R-2  leftovers  `<t>_next`, `<t>_prev` of an earlier run
 *   R-3  read       the kept data of `<t>`, one REPEATABLE READ, READ ONLY transaction; the
 *                   real-evidence guard of `dbc-3` §E.2 runs here as `dems_owner` (a REAL sealed
 *                   package in the database or on disk refuses with `RESET_BLOCKED_REAL_EVIDENCE`,
 *                   before R-4 creates anything, so the target is untouched). The server-side
 *                   caller refuses earlier still — before it quiesces — through
 *                   `assertNoRealSealedEvidence` on its own pool (operation 75 / `loadScenario`)
 *   R-4  create     `<t>_next`
 *   R-5  build      migrations; then ONE transaction: seed, carry-over, ACTIVE code closed,
 *                   last sign-in, lineage row, SCENARIO_LOADED
 *   R-6  verify     `<t>_next` holds what R-3 read, row image for row image, and is guarded
 *   R-7  swap       BEGIN; `<t>` becomes `<t>_prev`; `<t>_next` becomes `<t>`; COMMIT
 *   R-8  drop       `<t>_prev`: the discarded chain is gone, its lineage row is in `<t>`
 *   R-9  resume     the lock is released, the owner connection closed
 *
 * ROLES. Every statement is sent as `dems_owner`. Each connection the routine opens asks who it
 * is before anything else and stops with `RESET_ROLE_PRIVILEGED` when the answer is a superuser
 * or another role; on the first connection that is the first statement of the routine at all.
 * The routine never reads the superuser's password file and never connects as the runtime role.
 * It holds at most two connections at a time: the one on `postgres`, and one on `<t>` or
 * `<t>_next`; none after R-9. The owner's credentials live in a local variable of one call.
 *
 * WHAT IT NEVER SENDS. No UPDATE, DELETE or TRUNCATE of `audit_log` or `audit_chain_history`:
 * the new chain is INSERTED through the append protocol, the lineage rows are INSERTED into a
 * database that does not hold them yet, and the old chain goes with its database. No statement
 * that ends another session: a database that is in use is not reset (R-1, R-7). No DROP of the
 * target's own name: `dropStatement` takes a staging or previous name only.
 *
 * A FAILURE BEFORE THE SWAP HAS COMMITTED leaves `<t>` as it was: the routine has only read it.
 * The staging database is dropped (best effort; R-2 of the next run removes what is left), the
 * lock is released, the connections are closed, and a `ResetError` names the step.
 *
 * WHAT THE CALLER DOES. From the command line: nothing more (`cli.ts`). Inside the server: see
 * `index.ts`; the server-side parts of R-1 and R-9 are the caller's and reach this routine
 * through `quiesce` and through its return.
 */
import { performance } from 'node:perf_hooks';
import { recordActivity } from '@dems/shared/sim';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { DatabaseConnection } from '../../config';
import { evidenceStoreRoot, type EvidenceStoreScan } from '../commands/evidence-store';
import { applyMigrations, readSchemaVersion } from '../commands/migrations';
import {
  DbCommandError,
  MAINTENANCE_DATABASE,
  OWNER_ROLE,
  connectionFailure,
  createOwnerPool,
  readOwnerConnection,
  scrubDriverEnvironment,
} from '../commands/owner-connection';
import { diffStored, pickDurable, MappingError } from '../mapping';
import type { ChainDiscardReason, ScenarioValue } from '../schema';
import {
  BootCheckError,
  EXPECTED_AUDIT_TRIGGERS,
  EXPECTED_RUNTIME_ROLE,
  TRIGGER_MODE_ALWAYS,
  checkOwnerRole,
} from '../schema/boot-checks';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../schema';
import { SeedError, prepareSeed, writeSeed, type SeedDependencies } from '../seed';
import { StoreError, applyChanges, countAllTables } from '../store';
import {
  ResetError,
  describeAnswer,
  serverAnswer,
  stepOf,
  systemErrorCode,
  type ResetCheckpoint,
  type ResetErrorCode,
  type ResetStep,
} from './errors';
import {
  CANCEL_ACTIVE_CODES_STATEMENT,
  KEPT_TABLES,
  LAST_SIGN_IN_STATEMENT,
  LINEAGE,
  LINEAGE_INSERT_STATEMENT,
  NEWEST_LINEAGE_STATEMENT,
  PAIRING_CODES,
  READ_PAIRING_CODES_STATEMENT,
  carryStatement,
  chunked,
  compareCarried,
  imagesAsJsonArray,
  keptCounts,
  readImagesStatement,
  type KeptImages,
  type PairingCodeImage,
} from './kept-tables';
import { RESET_LOCK_CLASS, createStagingStatement, dropStatement, guardResetTarget, recoverStatement, swapStatements, type DisposableDatabase, type ResetTarget } from './names';
import { assertNow, planReset, resolveRequest, scenarioLoadedActivity, type LineageRow, type ResetPlan, type ResetRequest, type SourceFacts } from './plan';
import { findRealSealedEvidence, realEvidenceDetails, realEvidenceMessage } from './real-evidence';

/** `application_name` of every connection of the routine, unless the caller names another. */
export const RESET_APPLICATION_NAME = 'dems-db-reset';
/** Longest wait for the sessions of a database to end before the routine refuses (R-1, R-7). */
export const DEFAULT_SESSION_DRAIN_MS = 3_000;
/** Longest wait for the driver to report that a connection of the routine has ended. */
export const CONNECTION_CLOSE_WAIT_MS = 5_000;

/** The role check of R-0, as the contract words it. The first statement of every connection. */
export const ROLE_CHECK_STATEMENT = 'SELECT rolname::text AS rolname, rolsuper FROM pg_roles WHERE rolname = current_user';
const TRY_LOCK_STATEMENT = 'SELECT pg_try_advisory_lock($1::int, $2::int) AS locked';
const UNLOCK_STATEMENT = 'SELECT pg_advisory_unlock($1::int, $2::int) AS unlocked';
const SERVER_VERSION_STATEMENT = "SELECT current_setting('server_version') AS version";
/**
 * The client sessions on some databases, by database and role. A role sees the database and the
 * role of every session, but not the backend type or the state of another role's session, so
 * "has a role" is the test for a client session (an autovacuum worker has none).
 */
const SESSIONS_STATEMENT =
  'SELECT datname::text AS database, usename::text AS role, count(*)::int AS sessions FROM pg_stat_activity ' +
  'WHERE datname = ANY($1::text[]) AND usename IS NOT NULL AND pid <> pg_backend_pid() GROUP BY 1, 2 ORDER BY 1, 2';
const CATALOG_STATEMENT =
  'SELECT datname::text AS name, pg_get_userbyid(datdba)::text AS owner, datistemplate AS template ' +
  'FROM pg_database WHERE datname = ANY($1::text[])';
const SOURCE_FACTS_STATEMENT =
  'SELECT (SELECT epoch::text FROM public.core_state) AS epoch, h.seq::text AS head_seq, h.hash AS head_hash, ' +
  '(SELECT min(seq)::text FROM public.audit_log) AS first_seq, (SELECT count(*)::text FROM public.audit_log) AS row_count, ' +
  '(SELECT count(*)::int FROM public.audit_chain_history) AS lineage_rows, ' +
  '(SELECT max(reset_no)::text FROM public.audit_chain_history) AS max_reset_no, ' +
  '(SELECT max(epoch)::text FROM public.audit_chain_history) AS max_lineage_epoch ' +
  'FROM public.audit_chain_head AS h';
const BUILT_STATE_STATEMENT =
  'SELECT h.seq::text AS head_seq, h.hash AS head_hash, (SELECT count(*)::text FROM public.audit_log) AS audit_rows, ' +
  '(SELECT count(*)::text FROM public.audit_chain_history) AS lineage_rows, ' +
  '(SELECT max(reset_no)::text FROM public.audit_chain_history) AS max_reset_no, ' +
  '(SELECT epoch::text FROM public.core_state) AS epoch, (SELECT last_reset_at::text FROM public.core_state) AS last_reset_at, ' +
  '(SELECT scenario FROM public.core_state) AS scenario FROM public.audit_chain_head AS h';
/** LN-3: the SCENARIO_LOADED row of the new chain that names the discarded head. */
const SCENARIO_LOADED_STATEMENT =
  "SELECT seq::text AS seq, details ->> 'previousRows' AS previous_rows FROM public.audit_log " +
  "WHERE type = 'SCENARIO_LOADED' AND details ->> 'previousHead' = $1";
/** B-5 for the runtime role, asked by the owner: what `dems_app` must NOT hold on the guarded tables. */
const RUNTIME_PRIVILEGES_STATEMENT =
  'SELECT x.table_name AS object, x.privilege_name AS privilege, ' +
  'has_table_privilege($1::name, x.table_name, x.privilege_name) ' +
  "OR (x.privilege_name IN ('UPDATE', 'INSERT') AND has_any_column_privilege($1::name, x.table_name, x.privilege_name)) AS granted " +
  "FROM (VALUES ('public.audit_log', 'UPDATE'), ('public.audit_log', 'DELETE'), ('public.audit_log', 'TRUNCATE'), " +
  "('public.audit_chain_history', 'UPDATE'), ('public.audit_chain_history', 'DELETE'), ('public.audit_chain_history', 'TRUNCATE'), " +
  "('public.audit_chain_history', 'INSERT'), ('public.audit_chain_head', 'UPDATE')) AS x(table_name, privilege_name) ORDER BY 1, 2";
const TRIGGERS_STATEMENT =
  'SELECT tgname::text AS tgname, tgenabled::text AS tgenabled FROM pg_trigger ' +
  "WHERE tgrelid IN ('public.audit_log'::regclass, 'public.audit_chain_history'::regclass) AND NOT tgisinternal ORDER BY tgname";

// ── The call ───────────────────────────────────────────────────────────────────────────────────

export interface ResetLogEntry {
  readonly level: 'info' | 'warn' | 'error';
  /** For example `RESET_CHAIN_DISCARDED`, `RESET_ROLE_PRIVILEGED`, `RESET_PREVIOUS_LEFT`. */
  readonly code: string;
  readonly message: string;
  /** Names, counts and integrity values only. Never a secret, never a row of a kept table. */
  readonly details: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ResetCheckpointContext {
  readonly target: string;
  readonly staging: string;
  readonly previous: string;
  readonly applicationName: string;
}

export interface ResetOptions {
  /** The ONE database to reset: `dems_demo`, `dems_lane_1`, `dems_lane_2` or `dems_lane_3`. */
  readonly database: string;
  /** The server clock. Read ONCE, after R-1 (DR-1). Default: the real clock. */
  readonly clock?: (() => number) | undefined;
  /** The operator who called `resetDemo` or `loadScenario`. Null or absent from the command line (DC-9). */
  readonly actorId?: string | null | undefined;
  /** `RESET` (default) or `SCENARIO_LOAD`: the reason of the lineage row. */
  readonly reason?: ChainDiscardReason | undefined;
  /** The scenario to load. Default `idle`. */
  readonly scenario?: ScenarioValue | undefined;
  /** The directory of the owner connection file. Default: `<repository>/.data`. */
  readonly dataDir?: string | undefined;
  /**
   * The server-side part of R-1, called after R-0 passed and before anything is read: readiness
   * off, the pipeline drained, the hardware snapshot written, the runtime pool CLOSED. The
   * command line passes none. If it throws, nothing was changed.
   */
  readonly quiesce?: (() => Promise<void> | void) | undefined;
  /** Where the routine's log lines go (DC-7). A line never holds a secret. */
  readonly log?: ((entry: ResetLogEntry) => void) | undefined;
  /**
   * Called before each part of the routine, in the order of `RESET_CHECKPOINTS`. For progress
   * lines and for tests. If it throws, the part it announces counts as failed.
   */
  readonly onCheckpoint?: ((checkpoint: ResetCheckpoint, context: ResetCheckpointContext) => Promise<void> | void) | undefined;
  /** `application_name` of the routine's connections. Default `dems-db-reset`. */
  readonly applicationName?: string | undefined;
  /** Longest wait, in milliseconds, for the sessions of the target to end (R-1, R-7). */
  readonly sessionDrainMs?: number | undefined;
  /**
   * The environment whose driver variables (`PG*`) R-0 removes before the owner file is read, so
   * that the driver takes every field from that file (decision D26). The command line passes
   * `process.env`. The server passes nothing: its entry removed them once at start
   * (`src/index.ts`), so a request (`loadScenario`, `resetDemo`) never changes the process
   * environment (review findings CPB1-22, W91-7). Omitted: nothing is removed.
   */
  readonly driverEnvironment?: Record<string, string | undefined> | undefined;
  /**
   * The evidence-store package directory the real-evidence guard of R-0 reads (`dbc-3` §E.2).
   * Default: `<dataDir>/media/sessions`, the media root of `cap` §H.
   */
  readonly evidenceStoreDir?: string | undefined;
}

/** Seams for tests. No entry point sets any of them, and no argument or environment variable reaches them. */
export interface ResetInternals {
  /** The prefix of the calling test run: a per-file test database of that run is accepted as a target. */
  readonly testRunPrefix?: string | undefined;
  /** Builds the pool of a connection. Default: the owner pool of the database commands. */
  readonly openPool?: ((database: string, applicationName: string) => Pool) | undefined;
  /** Another migration folder. */
  readonly migrationsFolder?: string | undefined;
  /** Another password hasher for the seed. */
  readonly seedDependencies?: SeedDependencies | undefined;
  /** Another reader of the evidence-store directory, for the disk side of the R-0 guard. */
  readonly readEvidenceStore?: ((root: string) => EvidenceStoreScan) | undefined;
}

export interface ResetReport {
  readonly database: string;
  /** The role of every connection of the routine. */
  readonly role: string;
  readonly serverVersion: string;
  /** True when the target did not exist: a first build, nothing carried, nothing discarded. */
  readonly firstBuild: boolean;
  readonly now: number;
  readonly scenario: ScenarioValue;
  readonly reason: ChainDiscardReason;
  readonly actorId: string | null;
  readonly previousEpoch: number | null;
  /** The epoch of the new database: the previous one plus 1, or 0. */
  readonly epoch: number;
  /** Rows carried over, per kept table (SQL names). All zero for a first build. */
  readonly kept: Readonly<Record<string, number>>;
  /** Pairing codes that were ACTIVE and are now CANCELLED. */
  readonly cancelledPairingCodes: number;
  /** Operators whose `last_sign_in_at` was set from a carried session. */
  readonly operatorsWithSignIn: number;
  readonly lineage: {
    readonly carried: number;
    /** The row of the chain this reset discarded; null when nothing was discarded (LN-1). */
    readonly appended: LineageRow | null;
    readonly total: number;
  };
  /** The sequence of the SCENARIO_LOADED row in the new chain; null for a first build. */
  readonly scenarioLoadedSeq: number | null;
  readonly auditHead: { readonly seq: number; readonly hash: string };
  /** The row count of each of the 30 tables of the new database, by SQL name. */
  readonly counts: Readonly<Record<string, number>>;
  /** Databases of an earlier, unfinished run that R-2 removed. */
  readonly leftoversRemoved: readonly string[];
  /** True when R-8 dropped `<t>_prev`; false when it is left for R-2 of the next run; null for a first build. */
  readonly previousDropped: boolean | null;
  /** Milliseconds per step, and for the whole call. */
  readonly stepMs: Readonly<Record<ResetStep, number>>;
  readonly totalMs: number;
}

/** What a statement of the routine needs of a connection: a pool and a checked-out client both have it. */
interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}
interface SessionGroup {
  readonly database: string;
  readonly role: string;
  readonly sessions: number;
}

/** The code of a failure that is not a `ResetError` already, by the step it happened in. */
const STEP_FAILURE: Readonly<Record<ResetStep, ResetErrorCode>> = {
  'R-0': 'RESET_DATABASE_UNREACHABLE',
  'R-1': 'RESET_QUIESCE_FAILED',
  'R-2': 'RESET_LEFTOVER_FAILED',
  'R-3': 'RESET_READ_FAILED',
  'R-4': 'RESET_CREATE_FAILED',
  'R-5': 'RESET_BUILD_FAILED',
  'R-6': 'RESET_VERIFY_FAILED',
  'R-7': 'RESET_SWAP_FAILED',
  'R-8': 'RESET_SWAP_FAILED',
  'R-9': 'RESET_SWAP_FAILED',
};

const noop = (): void => undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Ends a pool and waits until the driver has CLOSED its connections.
 *
 * The pool's own `end()` resolves when it has ASKED its clients to close: it drops them from its
 * list and calls their `end`, and does not wait for a socket to end. A routine that went on at
 * that moment would report "the owner connection is closed" (R-9) while the driver was still
 * closing it. The pool emits `remove` for a client when that client's connection has ended, so
 * this waits for one `remove` per connection the pool held.
 *
 * The wait is bounded: a socket that never reports its end must not hold a reset, whose work is
 * done by then. False means that the bound was reached.
 *
 * What it cannot wait for is the server: a backend leaves `pg_stat_activity` a moment after its
 * connection ended. Where that matters to the routine itself (R-1, R-7) it asks the server.
 */
async function closePool(pool: Pool): Promise<boolean> {
  const held = typeof pool.totalCount === 'number' ? pool.totalCount : 0;
  let removed = 0;
  let settle: (closed: boolean) => void = noop;
  const allRemoved = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const onRemove = (): void => {
    removed += 1;
    if (removed >= held) settle(true);
  };
  if (held === 0) settle(true);
  else pool.on('remove', onRemove);

  let timer: NodeJS.Timeout | undefined;
  try {
    await pool.end().catch(noop);
    return await Promise.race([
      allRemoved,
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), CONNECTION_CLOSE_WAIT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (held > 0) pool.removeListener('remove', onRemove);
  }
}

function describeSessions(groups: readonly SessionGroup[]): string {
  return groups.map((group) => `${group.sessions} of role ${group.role} on ${group.database}`).join(', ');
}

/**
 * Turns whatever was thrown inside a step into a `ResetError`. Messages of this project's own
 * error classes are safe by their rows' design and are passed on; of every other error only the
 * class name and the server's SQLSTATE, constraint and table are used.
 */
function asResetError(error: unknown, step: ResetStep, targetUntouched: boolean): ResetError {
  if (error instanceof ResetError) return error;
  const answer = serverAnswer(error);
  const facts = { ...answer, targetUntouched };
  const code = STEP_FAILURE[step];
  if (error instanceof SeedError || error instanceof StoreError || error instanceof DbCommandError || error instanceof BootCheckError || error instanceof MappingError) {
    const store = error instanceof StoreError ? { sqlState: error.sqlState, constraint: error.constraint, table: error.table, targetUntouched } : facts;
    return new ResetError(code, step, `${step} failed: ${error.message}`, store);
  }
  const name = error instanceof Error ? error.name : 'a thrown value';
  const system = systemErrorCode(error);
  const what = answer.sqlState !== undefined ? describeAnswer(answer) : system !== undefined ? `the connection failed (${system})` : `${name}`;
  return new ResetError(code, step, `${step} failed: ${what}.`, facts);
}

/**
 * Resets ONE database: builds a new one beside it, carries the kept tables over, swaps the
 * names, drops the old one. Resolves with a report after R-9; rejects with a `ResetError` that
 * names the step. When it rejects before the swap, the target is exactly what it was.
 */
export async function resetDatabase(options: ResetOptions, internals: ResetInternals = {}): Promise<ResetReport> {
  const started = performance.now();
  const stepMs: Record<ResetStep, number> = { 'R-0': 0, 'R-1': 0, 'R-2': 0, 'R-3': 0, 'R-4': 0, 'R-5': 0, 'R-6': 0, 'R-7': 0, 'R-8': 0, 'R-9': 0 };

  // Before R-0 opens anything: the options and the name. A refusal here has read no file.
  const request: ResetRequest = resolveRequest(options);
  const target: ResetTarget = guardResetTarget(options.database, { testRunPrefix: internals.testRunPrefix });
  const applicationName = options.applicationName ?? RESET_APPLICATION_NAME;
  const drainMs = options.sessionDrainMs ?? DEFAULT_SESSION_DRAIN_MS;
  const log = (entry: ResetLogEntry): void => {
    try {
      options.log?.(entry);
    } catch {
      // A log sink that throws must not change what the routine does.
    }
  };
  const context: ResetCheckpointContext = Object.freeze({
    target: target.name,
    staging: target.staging,
    previous: target.previous,
    applicationName,
  });

  let step: ResetStep = 'R-0';
  let stepStarted = started;
  const enter = async (checkpoint: ResetCheckpoint): Promise<void> => {
    const next = stepOf(checkpoint);
    if (next !== step) {
      const now = performance.now();
      stepMs[step] += now - stepStarted;
      stepStarted = now;
      step = next;
    }
    await options.onCheckpoint?.(checkpoint, context);
  };

  /** The ONE owner connection on the maintenance database: role check, lock, catalog, DDL (R-0 to R-9). */
  let maintenancePool: Pool | undefined;
  let maintenance: PoolClient | undefined;
  /** The second connection: on `<t>` (R-3) or on `<t>_next` (R-5, R-6). Never both. */
  let side: Pool | undefined;
  let sideDatabase: string = target.name;
  let locked = false;
  let stagingMayExist = false;
  let swapped = false;
  /** False once the swap's COMMIT was sent and its outcome is not known. */
  let targetUntouched = true;

  /** Closes a pool of the routine and waits for the driver to have closed its connections. */
  const close = async (pool: Pool, database: string): Promise<void> => {
    if (await closePool(pool)) return;
    log({
      level: 'warn',
      code: 'RESET_CONNECTION_SLOW_TO_CLOSE',
      message: `a connection of the reset on ${database} had not reported its end after ${CONNECTION_CLOSE_WAIT_MS} ms; the routine went on.`,
      details: { database },
    });
  };
  const closeSide = async (): Promise<void> => {
    const pool = side;
    side = undefined;
    if (pool !== undefined) await close(pool, sideDatabase);
  };

  const sessionsOn = async (client: Queryable, databases: readonly string[]): Promise<SessionGroup[]> => {
    const { rows } = await client.query<SessionGroup>(SESSIONS_STATEMENT, [databases]);
    return rows;
  };
  /** Waits until no client session is left on the databases, at most `drainMs`. Returns what remains. */
  const waitForNoSession = async (client: Queryable, databases: readonly string[]): Promise<SessionGroup[]> => {
    const deadline = performance.now() + drainMs;
    let pause = 10;
    for (;;) {
      const remaining = await sessionsOn(client, databases);
      if (remaining.length === 0 || performance.now() >= deadline) return remaining;
      await sleep(pause);
      pause = Math.min(pause * 2, 200);
    }
  };

  /** The first statement of every connection: `dems_owner`, and not a superuser. */
  const assertOwnerRole = async (client: Queryable): Promise<void> => {
    const { rows } = await client.query<{ rolname: string; rolsuper: boolean }>(ROLE_CHECK_STATEMENT);
    const row = rows[0];
    if (rows.length !== 1 || row === undefined || row.rolname !== OWNER_ROLE || row.rolsuper !== false) {
      const untouched = step === 'R-0' ? 'Nothing was touched.' : `${target.name} was not changed.`;
      const message = `refused: the reset runs as ${OWNER_ROLE}, which is not a superuser; this connection is not that role. ${untouched}`;
      log({ level: 'error', code: 'RESET_ROLE_PRIVILEGED', message, details: { database: target.name, step } });
      throw new ResetError('RESET_ROLE_PRIVILEGED', step, message);
    }
  };

  let owner: DatabaseConnection | undefined;
  const openPool = (database: string): Pool => {
    if (internals.openPool !== undefined) return internals.openPool(database, applicationName);
    if (owner === undefined) throw new ResetError('RESET_OWNER_CREDENTIALS', 'R-0', 'the owner connection was not read.');
    return createOwnerPool(owner, database, applicationName);
  };

  const dropDisposable = async (client: Queryable, name: DisposableDatabase): Promise<void> => {
    await client.query(dropStatement(name));
  };

  try {
    // ── R-0 Guard ──────────────────────────────────────────────────────────────────────────────
    await enter('R-0');
    // The driver must take every field from the owner file, and none from a variable of its own.
    // The caller names the environment to clean; the server's was cleaned at its start (W91-7).
    if (options.driverEnvironment !== undefined) scrubDriverEnvironment(options.driverEnvironment);
    if (internals.openPool === undefined) {
      try {
        // HC-3: only now is the owner file read; the fields stay in this call.
        owner = readOwnerConnection(options.dataDir);
      } catch (error) {
        if (error instanceof DbCommandError) throw new ResetError('RESET_OWNER_CREDENTIALS', 'R-0', error.message);
        throw error;
      }
    }
    maintenancePool = openPool(MAINTENANCE_DATABASE);
    try {
      maintenance = await maintenancePool.connect();
    } catch (error) {
      const failure = owner === undefined ? error : connectionFailure(error, owner, MAINTENANCE_DATABASE);
      if (failure instanceof DbCommandError) throw new ResetError('RESET_DATABASE_UNREACHABLE', 'R-0', failure.message);
      throw failure;
    }
    // A connection the server ends must not crash the process.
    maintenance.on('error', noop);
    const main: PoolClient = maintenance;

    // The role check is the first statement of the routine: a superuser connection sends nothing else.
    await assertOwnerRole(main);
    const lock = await main.query<{ locked: boolean }>(TRY_LOCK_STATEMENT, [RESET_LOCK_CLASS, target.lockSlot]);
    if (lock.rows[0]?.locked !== true) {
      throw new ResetError(
        'RESET_ALREADY_RUNNING',
        'R-0',
        `refused: another reset of ${target.name} is running (advisory lock ${RESET_LOCK_CLASS}, ${target.lockSlot}). Nothing was touched.`,
      );
    }
    locked = true;
    const version = await main.query<{ version: string }>(SERVER_VERSION_STATEMENT);
    const serverVersion = version.rows[0]?.version ?? 'unknown';

    // The real-evidence guard of `dbc-3` §E.2 is authoritative here as `dems_owner`, but it runs at
    // the start of R-3 (inside the one read-only pass over the target), not on a separate R-0
    // connection: the routine touches the target exactly once, after R-1 quieted it, and a refusal
    // still happens before R-4 creates any staging database, so the target is left untouched. The
    // server-side caller refuses BEFORE it quiesces (operation 75 / `loadScenario` call
    // `assertNoRealSealedEvidence` on its own pool; C3 §4 answers 409), which is where the audited
    // pre-quiesce refusal lives (`OD-19`, RK-16). A database that was never migrated reports
    // `RESET_SCHEMA_MISMATCH` first, because that check precedes the guard inside R-3.

    // ── R-1 Quiesce ────────────────────────────────────────────────────────────────────────────
    await enter('R-1');
    if (options.quiesce !== undefined) {
      try {
        await options.quiesce();
      } catch {
        throw new ResetError('RESET_QUIESCE_FAILED', 'R-1', `the caller could not quiesce ${target.name}; nothing was changed.`);
      }
    }
    const busy = await waitForNoSession(main, [target.name]);
    if (busy.length > 0) {
      throw new ResetError(
        'RESET_TARGET_IN_USE',
        'R-1',
        `refused: ${target.name} is in use (${describeSessions(busy)}). The reset ends nobody's session: stop the server of this database, or close its pool, and run again. Nothing was changed.`,
      );
    }
    // DR-1: the clock is read once, when the target is quiet, and the instant is passed down.
    const now = assertNow((options.clock ?? Date.now)());

    // ── R-2 Leftovers ──────────────────────────────────────────────────────────────────────────
    await enter('R-2');
    const catalog = await main.query<{ name: string; owner: string; template: boolean }>(CATALOG_STATEMENT, [
      [target.name, target.staging, target.previous],
    ]);
    const found = new Map(catalog.rows.map((row) => [row.name, row] as const));
    for (const row of catalog.rows) {
      if (row.owner !== OWNER_ROLE || row.template) {
        throw new ResetError(
          'RESET_TARGET_NOT_OURS',
          'R-2',
          `refused: the database ${row.name} ${row.template ? 'is a template' : `belongs to ${row.owner}, not to ${OWNER_ROLE}`}. The reset touches only databases of the owner role. Nothing was changed.`,
        );
      }
    }
    const leftoversRemoved: string[] = [];
    const removeLeftover = async (name: DisposableDatabase): Promise<void> => {
      try {
        await dropDisposable(main, name);
      } catch (error) {
        throw new ResetError(
          'RESET_LEFTOVER_FAILED',
          'R-2',
          `the leftover database ${name} of an earlier run could not be removed: ${describeAnswer(serverAnswer(error))}. Nothing else was changed.`,
          serverAnswer(error),
        );
      }
      leftoversRemoved.push(name);
      log({ level: 'warn', code: 'RESET_LEFTOVER_REMOVED', message: `removed ${name}, left by an earlier run.`, details: { database: name } });
    };
    if (found.has(target.staging)) await removeLeftover(target.staging);
    const targetExists = found.has(target.name);
    if (found.has(target.previous)) {
      if (targetExists) {
        await removeLeftover(target.previous);
      } else {
        // An earlier swap lost the target's name: give the previous database its name back and stop.
        try {
          await main.query(recoverStatement(target));
        } catch (error) {
          throw new ResetError(
            'RESET_LEFTOVER_FAILED',
            'R-2',
            `${target.name} is missing and ${target.previous} could not be renamed back: ${describeAnswer(serverAnswer(error))}.`,
            serverAnswer(error),
          );
        }
        log({
          level: 'warn',
          code: 'RESET_RECOVERED_PREVIOUS',
          message: `${target.name} was missing; ${target.previous} was renamed back to it.`,
          details: { database: target.name },
        });
        throw new ResetError(
          'RESET_RECOVERED_PREVIOUS',
          'R-2',
          `${target.name} was missing and its previous database existed: it has its name back, with the data it had. Nothing was reset. Run the reset again.`,
        );
      }
    }

    // ── R-3 Read the kept data ─────────────────────────────────────────────────────────────────
    await enter('R-3');
    let carried: KeptImages | null = null;
    let facts: SourceFacts | null = null;
    if (targetExists) {
      sideDatabase = target.name;
      side = openPool(target.name);
      const read = await readSource(side, target, assertOwnerRole, {
        log,
        storeRoot: options.evidenceStoreDir ?? evidenceStoreRoot(options.dataDir),
        readStore: internals.readEvidenceStore,
      });
      carried = read.kept;
      facts = read.facts;
      await closeSide();
    }
    const plan: ResetPlan = planReset(facts, request, now);

    // ── R-4 Create ─────────────────────────────────────────────────────────────────────────────
    await enter('R-4');
    stagingMayExist = true;
    await main.query(createStagingStatement(target));

    // ── R-5 Build ──────────────────────────────────────────────────────────────────────────────
    await enter('R-5a');
    sideDatabase = target.staging;
    side = openPool(target.staging);
    await assertOwnerRole(side);
    await applyMigrations(side, internals.migrationsFolder);
    // The password derivations run before the transaction, which then holds the chain lock only while it writes.
    const prepared = await prepareSeed(
      { now, scenario: request.scenario, epoch: plan.epoch, lastResetAt: now },
      internals.seedDependencies,
    );

    let cancelledPairingCodes = 0;
    let operatorsWithSignIn = 0;
    await enter('R-5b');
    const build = await side.connect();
    build.on('error', noop);
    try {
      await build.query('BEGIN');
      const executor = drizzle(build);
      // (b) The seed, through the append protocol: the chain lock, then one INSERT per audit row.
      await writeSeed(executor, prepared);

      if (carried !== null && plan.scenarioLoaded !== null) {
        // (c) The carry-over, in the order of the contract: counters and settings (seeded rows
        // take the carried values), then the rows the seed leaves empty, parents first.
        await enter('R-5c');
        for (const table of KEPT_TABLES) {
          const images = table.name === PAIRING_CODES ? carried.pairingCodes.map((code) => code.image) : (carried.images[table.name] ?? []);
          const statement = carryStatement(table);
          for (const chunk of chunked(images)) {
            const result = await build.query(statement, [imagesAsJsonArray(chunk)]);
            if (result.rowCount !== chunk.length) {
              throw new ResetError(
                'RESET_BUILD_FAILED',
                'R-5',
                `R-5 failed: ${table.name}: ${chunk.length} carried row(s) were sent and ${String(result.rowCount)} were written.`,
                { table: table.name },
              );
            }
          }
        }

        // (d) An ACTIVE code is closed by the reset, with no audit row of its own; the last
        // sign-in of an operator is the newest issue time of the sessions just carried.
        await enter('R-5d');
        const cancelled = await build.query(CANCEL_ACTIVE_CODES_STATEMENT, [String(now), request.actorId]);
        cancelledPairingCodes = cancelled.rowCount ?? 0;
        const signedIn = await build.query(LAST_SIGN_IN_STATEMENT);
        operatorsWithSignIn = signedIn.rowCount ?? 0;

        // (e) The lineage row of the chain being discarded.
        await enter('R-5e');
        if (plan.lineage !== null) {
          const row = plan.lineage;
          await build.query(LINEAGE_INSERT_STATEMENT, [
            row.resetNo,
            row.epoch,
            row.headHash,
            row.rowCount,
            row.firstSeq,
            row.lastSeq,
            row.resetAt,
            row.actorId,
            row.reason,
            row.scenario,
          ]);
        }

        // (f) SCENARIO_LOADED: built by the shared code on the seeded state, written through the
        // append protocol (the head the lock returns must be the seed's own head).
        await enter('R-5f');
        const seeded = prepared.state;
        const loaded = { ...seeded, ...recordActivity(seeded, now, scenarioLoadedActivity(request, plan.scenarioLoaded)) };
        await applyChanges(executor, diffStored(pickDurable(seeded), pickDurable(loaded), now), { expectedHead: prepared.expectedHead });
      }

      await enter('R-5:commit');
      await build.query('COMMIT');
    } catch (error) {
      await build.query('ROLLBACK').catch(noop);
      throw error;
    } finally {
      build.removeListener('error', noop);
      build.release();
    }

    // ── R-6 Verify ─────────────────────────────────────────────────────────────────────────────
    await enter('R-6');
    const verified = await verifyBuilt(side, { carried, plan, request, now });
    const counts = await countAllTables(drizzle(side));
    await closeSide();

    // ── R-7 Swap ───────────────────────────────────────────────────────────────────────────────
    await enter('R-7');
    const inTheWay = await waitForNoSession(main, [target.name, target.staging]);
    if (inTheWay.length > 0) {
      throw new ResetError(
        'RESET_TARGET_IN_USE',
        'R-7',
        `refused: a session was opened during the reset (${describeSessions(inTheWay)}). The reset ends nobody's session. ${target.name} was not changed.`,
      );
    }
    await enter('R-7:rename');
    await main.query('BEGIN');
    try {
      for (const statement of swapStatements(target, targetExists)) await main.query(statement);
    } catch (error) {
      await main.query('ROLLBACK').catch(noop);
      throw new ResetError(
        'RESET_SWAP_FAILED',
        'R-7',
        `R-7 failed: the names were not swapped (${describeAnswer(serverAnswer(error))}); the transaction was rolled back. ${target.name} was not changed.`,
        serverAnswer(error),
      );
    }
    try {
      await main.query('COMMIT');
    } catch (error) {
      const answer = serverAnswer(error);
      // An answer of the server means the transaction did not commit. No answer means that the
      // connection was lost while it committed: the outcome is not known, and R-2 of the next
      // run puts either outcome right.
      targetUntouched = answer.sqlState !== undefined;
      throw new ResetError(
        'RESET_SWAP_FAILED',
        'R-7',
        targetUntouched
          ? `R-7 failed: the swap did not commit (${describeAnswer(answer)}). ${target.name} was not changed.`
          : `R-7 failed: the connection was lost while the swap committed; whether ${target.name} is the old or the new database is not known. Run the reset again: its step R-2 repairs either state.`,
        { ...answer, targetUntouched },
      );
    }
    swapped = true;
    stagingMayExist = false;

    // ── R-8 Drop the old ───────────────────────────────────────────────────────────────────────
    // From here on the reset has succeeded: a failure is logged, and R-2 of the next run cleans up.
    let previousDropped: boolean | null = null;
    try {
      await enter('R-8');
      if (targetExists) {
        await dropDisposable(main, target.previous);
        previousDropped = true;
      }
    } catch (error) {
      if (targetExists) {
        previousDropped = false;
        log({
          level: 'warn',
          code: 'RESET_PREVIOUS_LEFT',
          message: `the reset of ${target.name} succeeded, but ${target.previous} could not be dropped (${describeAnswer(serverAnswer(error))}); the next reset removes it.`,
          details: { database: target.previous },
        });
      }
    }
    if (plan.lineage !== null) {
      const row = plan.lineage;
      // DC-7: one log line with the values of the lineage row. The head hash is an integrity value, not a secret.
      log({
        level: 'info',
        code: 'RESET_CHAIN_DISCARDED',
        message: `audit chain of ${target.name} discarded: ${row.rowCount} row(s), head ${row.headHash}.`,
        details: {
          database: target.name,
          resetNo: row.resetNo,
          epoch: row.epoch,
          rowCount: row.rowCount,
          firstSeq: row.firstSeq,
          lastSeq: row.lastSeq,
          headHash: row.headHash,
          resetAt: row.resetAt,
          actorId: row.actorId,
          reason: row.reason,
          scenario: row.scenario,
        },
      });
    }

    // ── R-9 Resume (the routine's part) ────────────────────────────────────────────────────────
    try {
      await enter('R-9');
    } catch {
      // An observer cannot undo a finished reset.
    }
    const finished = performance.now();
    stepMs[step] += finished - stepStarted;
    return {
      database: target.name,
      role: OWNER_ROLE,
      serverVersion,
      firstBuild: plan.firstBuild,
      now,
      scenario: request.scenario,
      reason: request.reason,
      actorId: request.actorId,
      previousEpoch: plan.previousEpoch,
      epoch: plan.epoch,
      kept: carried === null ? Object.fromEntries(KEPT_TABLES.map((table) => [table.name, 0])) : keptCounts(carried),
      cancelledPairingCodes,
      operatorsWithSignIn,
      lineage: {
        carried: carried === null ? 0 : (carried.images[LINEAGE] ?? []).length,
        appended: plan.lineage,
        total: verified.lineageRows,
      },
      scenarioLoadedSeq: verified.scenarioLoadedSeq,
      auditHead: verified.auditHead,
      counts,
      leftoversRemoved,
      previousDropped,
      stepMs,
      totalMs: finished - started,
    };
  } catch (error) {
    const failure = asResetError(error, step, targetUntouched);
    await closeSide();
    // "Drop <t>_next (best effort; R-2 removes it next time)": only a staging database, only
    // before the swap, and only when this call may have created it.
    if (stagingMayExist && !swapped && maintenance !== undefined) {
      const main: PoolClient = maintenance;
      try {
        await waitForNoSession(main, [target.staging]);
        await main.query(dropStatement(target.staging, { ifExists: true }));
      } catch (dropError) {
        log({
          level: 'warn',
          code: 'RESET_STAGING_LEFT',
          message: `${target.staging} could not be removed after the failure (${describeAnswer(serverAnswer(dropError))}); the next reset removes it.`,
          details: { database: target.staging },
        });
      }
    }
    throw failure;
  } finally {
    // R-9, and the end of every refusal: the lock is released, the owner connection closed, and
    // the owner's fields go out of scope with this call (HC-3).
    await closeSide();
    if (maintenance !== undefined) {
      if (locked) await maintenance.query(UNLOCK_STATEMENT, [RESET_LOCK_CLASS, target.lockSlot]).catch(noop);
      maintenance.removeListener('error', noop);
      maintenance.release();
    }
    // The promise of this call settles only after the driver has closed the owner connection:
    // "none after R-9" is then true of the connections, not only of the intention.
    if (maintenancePool !== undefined) await close(maintenancePool, MAINTENANCE_DATABASE);
    owner = undefined;
  }
}

// ── R-3 ────────────────────────────────────────────────────────────────────────────────────────

async function readKept(client: Queryable): Promise<KeptImages> {
  const images: Record<string, readonly string[]> = {};
  let pairingCodes: PairingCodeImage[] = [];
  for (const table of KEPT_TABLES) {
    if (table.name === PAIRING_CODES) {
      const { rows } = await client.query<{ id: string; state: string; image: string; rest: string; closed_at: string | null; closed_by: string | null }>(
        READ_PAIRING_CODES_STATEMENT,
      );
      pairingCodes = rows.map((row) => ({ id: row.id, state: row.state, image: row.image, rest: row.rest, closedAt: row.closed_at, closedBy: row.closed_by }));
      images[table.name] = pairingCodes.map((code) => code.image);
    } else {
      const { rows } = await client.query<{ image: string }>(readImagesStatement(table));
      images[table.name] = rows.map((row) => row.image);
    }
  }
  return { images, pairingCodes };
}

/**
 * R-3: everything the routine needs of the old database, in ONE transaction at REPEATABLE READ,
 * READ ONLY: the twelve kept tables, the epoch, and the facts of the chain being discarded. The
 * transaction changes nothing; the connection is released before the function returns.
 */
async function readSource(
  pool: Pool,
  target: ResetTarget,
  assertOwnerRole: (client: Queryable) => Promise<void>,
  guard: { log: (entry: ResetLogEntry) => void; storeRoot: string; readStore: ((root: string) => EvidenceStoreScan) | undefined },
): Promise<{ kept: KeptImages; facts: SourceFacts }> {
  const client = await pool.connect();
  client.on('error', noop);
  try {
    await assertOwnerRole(client);
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      const migrated = await client.query<{ present: boolean }>("SELECT to_regclass('public.schema_meta') IS NOT NULL AS present");
      const meta =
        migrated.rows[0]?.present === true
          ? await client.query<{ schema_version: number; contract_revision: string }>('SELECT schema_version, contract_revision FROM public.schema_meta')
          : { rows: [] };
      const version = meta.rows[0];
      if (version === undefined || version.schema_version !== DB_SCHEMA_VERSION || version.contract_revision !== DB_CONTRACT_REVISION) {
        const state = version === undefined ? 'has no schema' : `is at schema version ${version.schema_version} (${version.contract_revision})`;
        throw new ResetError(
          'RESET_SCHEMA_MISMATCH',
          'R-3',
          `refused: ${target.name} ${state}; this code builds version ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Migrate first: npm run db:migrate -w @dems/core-server -- --database ${target.name}. Nothing was changed.`,
        );
      }
      // The authoritative real-evidence guard of `dbc-3` §E.2, as `dems_owner`, inside this one
      // read-only pass and before R-4 creates any staging database: a REAL sealed item in the
      // database or on disk refuses with the target untouched. It runs after the schema-version
      // check above, so an unmigrated database still reports `RESET_SCHEMA_MISMATCH` first.
      const evidence = await findRealSealedEvidence(client, { database: target.name, storeRoot: guard.storeRoot, readStore: guard.readStore });
      if (evidence.blocked) {
        const refusal = realEvidenceMessage(evidence);
        guard.log({ level: 'warn', code: 'RESET_BLOCKED_REAL_EVIDENCE', message: refusal, details: realEvidenceDetails(evidence) });
        throw new ResetError('RESET_BLOCKED_REAL_EVIDENCE', 'R-3', refusal);
      }
      const kept = await readKept(client);
      const read = await client.query<{
        epoch: string | null;
        head_seq: string;
        head_hash: string;
        first_seq: string | null;
        row_count: string;
        lineage_rows: number;
        max_reset_no: string | null;
        max_lineage_epoch: string | null;
      }>(SOURCE_FACTS_STATEMENT);
      const row = read.rows[0];
      if (read.rows.length !== 1 || row === undefined) {
        throw new ResetError('RESET_READ_FAILED', 'R-3', `${target.name} has no chain head row; the chain being discarded cannot be recorded. Nothing was changed.`);
      }
      await client.query('COMMIT');
      return {
        kept,
        facts: {
          epoch: row.epoch,
          headSeq: row.head_seq,
          headHash: row.head_hash,
          firstSeq: row.first_seq,
          rowCount: row.row_count,
          lineageRows: row.lineage_rows,
          maxResetNo: row.max_reset_no,
          maxLineageEpoch: row.max_lineage_epoch,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(noop);
      throw error;
    }
  } finally {
    client.removeListener('error', noop);
    client.release();
  }
}

// ── R-6 ────────────────────────────────────────────────────────────────────────────────────────

interface Verified {
  readonly auditHead: { readonly seq: number; readonly hash: string };
  readonly lineageRows: number;
  readonly scenarioLoadedSeq: number | null;
}

/**
 * R-6: the staging database is checked before it may take the target's name. Every problem is
 * collected; one or more stop the routine with `RESET_VERIFY_FAILED`, and the staging database
 * is dropped.
 */
async function verifyBuilt(
  pool: Pool,
  expected: { carried: KeptImages | null; plan: ResetPlan; request: ResetRequest; now: number },
): Promise<Verified> {
  const { carried, plan, request, now } = expected;
  const problems: string[] = [];

  // The kept tables: every carried row is, text for text, the row R-3 read.
  const built = await readKept(pool);
  if (carried !== null) {
    problems.push(...compareCarried(carried, built, { now: String(now), actorId: request.actorId, lineageAppended: plan.lineage !== null }));
  } else {
    for (const table of KEPT_TABLES) {
      if (table.mode === 'insert' && (built.images[table.name] ?? []).length !== 0) {
        problems.push(`${table.name}: a first build must leave the table empty.`);
      }
    }
  }

  const state = await pool.query<{
    head_seq: string;
    head_hash: string;
    audit_rows: string;
    lineage_rows: string;
    max_reset_no: string | null;
    epoch: string | null;
    last_reset_at: string | null;
    scenario: string | null;
  }>(BUILT_STATE_STATEMENT);
  const row = state.rows[0];
  if (state.rows.length !== 1 || row === undefined) {
    throw new ResetError('RESET_VERIFY_FAILED', 'R-6', 'R-6 failed: the new database has no chain head row.');
  }
  // The head agrees with the table.
  if (row.head_seq !== row.audit_rows) problems.push(`the chain head is at sequence ${row.head_seq}, and audit_log holds ${row.audit_rows} row(s).`);
  // The lineage: its highest number is its row count.
  if ((row.max_reset_no ?? '0') !== row.lineage_rows) {
    problems.push(`audit_chain_history holds ${row.lineage_rows} row(s), and its highest reset_no is ${row.max_reset_no ?? 'none'}.`);
  }
  if (row.epoch !== String(plan.epoch)) problems.push(`core_state.epoch is ${row.epoch ?? 'missing'}; the reset writes ${plan.epoch}.`);
  if (row.last_reset_at !== String(now)) problems.push('core_state.last_reset_at is not the instant of this reset.');
  if (row.scenario !== request.scenario) problems.push(`core_state.scenario is ${row.scenario ?? 'missing'}; the reset loads ${request.scenario}.`);

  // The newest lineage row is what R-3 read (LN-2) and agrees with the SCENARIO_LOADED row (LN-3).
  let scenarioLoadedSeq: number | null = null;
  if (plan.lineage !== null) {
    const want = plan.lineage;
    const newest = await pool.query<{
      reset_no: string;
      epoch: string;
      head_hash: string;
      row_count: string;
      first_seq: string;
      last_seq: string;
      reset_at: string;
      actor_id: string | null;
      reason: string;
      scenario: string;
    }>(NEWEST_LINEAGE_STATEMENT);
    const got = newest.rows[0];
    const same =
      got !== undefined &&
      got.reset_no === want.resetNo &&
      got.epoch === want.epoch &&
      got.head_hash === want.headHash &&
      got.row_count === want.rowCount &&
      got.first_seq === want.firstSeq &&
      got.last_seq === want.lastSeq &&
      got.reset_at === want.resetAt &&
      got.actor_id === want.actorId &&
      got.reason === want.reason &&
      got.scenario === want.scenario;
    if (!same) problems.push('the newest lineage row is not the row of the chain that was read (LN-2).');
  }
  if (plan.scenarioLoaded !== null) {
    const loaded = await pool.query<{ seq: string; previous_rows: string | null }>(SCENARIO_LOADED_STATEMENT, [plan.scenarioLoaded.previousHead]);
    const entry = loaded.rows[0];
    if (loaded.rows.length !== 1 || entry === undefined || entry.previous_rows !== String(plan.scenarioLoaded.previousRows)) {
      problems.push('the new chain does not hold exactly one SCENARIO_LOADED row that names the discarded head and its row count (LN-3).');
    } else {
      scenarioLoadedSeq = Number(entry.seq);
    }
  }

  // The schema version is the code's.
  const version = await readSchemaVersion(pool);
  if (version === null || version.schemaVersion !== DB_SCHEMA_VERSION || version.contractRevision !== DB_CONTRACT_REVISION) {
    problems.push(`the schema version is ${version?.schemaVersion ?? 'none'}; this code expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}).`);
  }

  // B-5: the three triggers, each ENABLE ALWAYS; the runtime role holds none of the eight privileges.
  const triggers = await pool.query<{ tgname: string; tgenabled: string }>(TRIGGERS_STATEMENT);
  const foundTriggers = triggers.rows.map((trigger) => `${trigger.tgname}=${trigger.tgenabled}`);
  const expectedTriggers = EXPECTED_AUDIT_TRIGGERS.map((name) => `${name}=${TRIGGER_MODE_ALWAYS}`);
  if (foundTriggers.length !== expectedTriggers.length || foundTriggers.some((entry, index) => entry !== expectedTriggers[index])) {
    problems.push(`the audit triggers are [${foundTriggers.join(', ')}]; expected exactly [${expectedTriggers.join(', ')}] (B-5).`);
  }
  const privileges = await pool.query<{ object: string; privilege: string; granted: boolean }>(RUNTIME_PRIVILEGES_STATEMENT, [EXPECTED_RUNTIME_ROLE]);
  const held = privileges.rows.filter((entry) => entry.granted !== false).map((entry) => `${entry.privilege} on ${entry.object}`);
  if (privileges.rows.length !== 8 || held.length > 0) {
    problems.push(
      held.length > 0
        ? `the runtime role ${EXPECTED_RUNTIME_ROLE} holds ${held.join(', ')}; it must hold none of them (B-5).`
        : 'the privilege question returned an unexpected number of rows (B-5).',
    );
  }
  // B-9: the owner role is not a superuser and owns the database and the guarded objects.
  try {
    await checkOwnerRole(pool);
  } catch (error) {
    if (!(error instanceof BootCheckError)) throw error;
    problems.push(error.message);
  }

  if (problems.length > 0) {
    throw new ResetError('RESET_VERIFY_FAILED', 'R-6', `R-6 failed: the new database is not swapped in. ${problems.join(' ')}`);
  }
  return {
    auditHead: { seq: Number(row.head_seq), hash: row.head_hash },
    lineageRows: Number(row.lineage_rows),
    scenarioLoadedSeq,
  };
}
