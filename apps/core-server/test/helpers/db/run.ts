/**
 * One run of the database tests (database contract §10).
 *
 * A run is created once, by the global setup of the Vitest project `db` (`TestRun.start`): it
 * checks that PostgreSQL answers, reads the two connection files, takes a fresh run prefix and
 * the "this run is alive" lock, sweeps stale databases and builds the templates. Every test
 * file then attaches to that run from its own worker process (`TestRun.attach`), clones a
 * template for itself and drops the clone when it is done. At the end the owner of the run
 * drops everything that carries the run prefix (`teardown`).
 *
 * What a run may touch is decided by the name guard alone (`names.ts`): databases of its own
 * prefix, and, in the sweep, databases of a run that is older than six hours and not alive.
 *
 * Roles (TI-9, TI-17): the run's own session and its fixture pools are `dems_owner`; the pool
 * and the connection fields it hands to the code under test are `dems_app`.
 */
import type { Pool } from 'pg';
import type { DatabaseConnection } from '../../../src/config';
import {
  APP_POOL_MAX,
  CLUSTER_QUIET_BUDGET_MS,
  DEAD_RUN_SETTLE_MS,
  DEFAULT_LOCK_TIMEOUT_MS,
  DEFAULT_SESSION_DRAIN_MS,
  ENV_TEST_STEP,
  LOCK_CLASS,
  OWNER_POOL_MAX,
  OWNER_ROLE,
  TEST_DATABASE_PREFIX,
} from './constants';
import { DEFAULT_DATA_DIR, readAppCredentials, readOwnerCredentials, type RoleCredentials } from './credentials';
import {
  backendsOn,
  clientsOfOtherRoles,
  cloneDatabase,
  createEmptyDatabase,
  describeBackends,
  describeSessions,
  dropDatabase,
  findDatabase,
  listDatabasesWithPrefix,
  lockTemplate,
  notifyRun,
  QUIET_NOT_ASKED,
  releaseCloneLock,
  releaseLivenessLock,
  sessionRolesWithPrefix,
  takeCloneLock,
  tryLivenessLock,
  unlockTemplate,
  waitForQuietCluster,
  waitForSessionsToEnd,
  type ClusterQuiet,
  type DatabaseRow,
  type DropRetryPolicy,
} from './ddl';
import { PROJECT_ENDPOINT, assertServerReachable, type Endpoint } from './endpoint';
import { DbGuardError, DbTestHelperError, errorCode, errorMessage } from './errors';
import { conventionResolver, templateNotAvailable, type DefinitionResolver, type TemplateDefinition } from './hooks';
import {
  classifyForSweep,
  createRunIdentity,
  fileDatabaseName,
  guardDeadRunDatabase,
  guardOwnDatabase,
  guardStaleDatabase,
  isTemplateName,
  livenessKey,
  lowestFreeCounter,
  newStamp,
  parseRunPrefix,
  runLabel,
  templateDatabaseName,
  type DeadRunClaim,
  type GuardedDatabaseName,
  type RunIdentity,
  type StaleClaim,
} from './names';
import { OwnerSession, createRolePool, type ClientFactory, type SessionFacts } from './session';

const PREFIX_ATTEMPTS = 16;
const LOCK_NOT_AVAILABLE = '55P03';

export interface RunOptions {
  /** The directory of the connection files. Default: `<repository>/.data`. */
  readonly dataDir?: string;
  /** Finds template definitions. Default: the hook modules by convention (`hooks.ts`). */
  readonly resolveDefinition?: DefinitionResolver;
  /** Longest wait for the clone lock, in milliseconds. */
  readonly lockTimeoutMs?: number;
  /** Longest wait for the sessions of a database to end, in milliseconds. */
  readonly sessionDrainMs?: number;
  /**
   * The bounded retry of a forced drop that PostgreSQL refuses while a background worker of the
   * server is on the database (`ddl.ts`). Default: 20 attempts, 250 ms apart. Tests shorten it.
   */
  readonly dropRetry?: Partial<DropRetryPolicy>;
  /**
   * How long a clone request that asks for a quiet cluster may look for an empty clone-lock
   * queue (decision D134). Default: 5 s. Tests shorten it.
   */
  readonly clusterQuietBudgetMs?: number;
  /** The clock, in milliseconds since the epoch. A test passes an old one to make a stale run. */
  readonly now?: () => number;
  /** Seam for tests of the role refusals: builds the driver client of the run's own session. */
  readonly clientFactory?: ClientFactory;
}

export interface StartOptions extends RunOptions {
  /** Where `DEMS_TEST_STEP` is read from. Default: `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /**
   * Test seam: the address the reachability probe connects to. The probe sends nothing. Only
   * `127.0.0.1` is accepted, and never the foreign default port.
   */
  readonly probeTarget?: Endpoint;
  /**
   * Test seam: replaces the reachability probe itself, for tests that run the helper on a fake
   * driver with no socket at all. Default: one TCP connect to the target (`endpoint.ts`).
   */
  readonly probe?: (target: Endpoint) => Promise<void>;
}

export interface TemplateTiming {
  readonly key: string;
  readonly database: string;
  /** `CREATE DATABASE` of the template, in milliseconds. */
  readonly createMs: number;
  /** The hook, in milliseconds. */
  readonly hookMs: number;
  /** Everything: lock wait, create, hook, session drain, lock. */
  readonly totalMs: number;
}

export interface CloneTiming {
  /** Waiting for the clone lock, in milliseconds. */
  readonly lockWaitMs: number;
  /** `CREATE DATABASE ... TEMPLATE`, in milliseconds. */
  readonly cloneMs: number;
  /**
   * `performance.now()` when the clone lock was held and when the copy had finished (the lock
   * is released after `to`). Two clones of one process never overlap in this window (TI-7).
   */
  readonly window: { readonly from: number; readonly to: number };
  /**
   * What the request for a quiet cluster found (decision D134). `budgetMs` 0 means the caller
   * asked for nothing, which is the case of every file that does not state the need: the helper
   * then reads nothing and waits for nothing.
   */
  readonly quiet: ClusterQuiet;
}

export interface SweepReport {
  readonly dropped: readonly string[];
  /** Of another run that is not older than the threshold: a parallel row may be using it. */
  readonly keptYounger: readonly string[];
  /** Older than the threshold, but a live session holds the run's liveness lock. */
  readonly keptLive: readonly string[];
  /** Start with `dems_test_` but are not of the naming scheme. */
  readonly unrecognised: readonly string[];
  readonly failed: ReadonlyArray<{ readonly name: string; readonly reason: string }>;
}

export interface DeadRunReport {
  /** The run that was named. */
  readonly prefix: string;
  readonly dropped: readonly string[];
  /** Databases with that prefix that still exist, read from `pg_database` after the drops. */
  readonly remaining: readonly string[];
  readonly failed: ReadonlyArray<{ readonly name: string; readonly reason: string }>;
  readonly ms: number;
}

export interface DropDeadRunOptions {
  /** How far apart the two looks for client sessions are, in milliseconds. Default: 3 s. */
  readonly settleMs?: number;
}

/** A forced drop that PostgreSQL refused at first and that went through at a later attempt. */
export interface RetriedDrop {
  readonly name: string;
  /** How often the server refused it before it went through. */
  readonly refusals: number;
}

export interface TeardownReport {
  readonly dropped: readonly string[];
  /** Databases with the run prefix that still exist, read from `pg_database` after the drops. Empty when the run cleaned up. */
  readonly remaining: readonly string[];
  readonly failed: ReadonlyArray<{ readonly name: string; readonly reason: string }>;
  /**
   * The drops of the whole run that needed a retry: the ones of this process and the ones the
   * test files reported from their own processes. Informational; such a drop succeeded.
   */
  readonly retriedDrops: readonly RetriedDrop[];
  readonly ms: number;
}

export interface CreateDatabaseOptions {
  /** `schema`, `seed`, `bulk`, or the key of a private template (`x_<name>`). */
  readonly template: string;
  /** Goes into the database name: usually the test file's base name. */
  readonly slug: string;
  /**
   * Look for a quiet cluster before the clone (decision D134): at most `clusterQuietBudgetMs`
   * of waiting for an empty clone-lock queue, then the clone happens anyway. The outcome is in
   * the timings of the database. Default false: no read, no wait.
   */
  readonly quiet?: boolean;
  /**
   * Longest wait for a connection on this database, for the two pools the helper hands out from
   * it (`TestDatabase.appPool`, `ownerPool`). Default the helper's constant; never below it.
   */
  readonly connectTimeoutMs?: number;
}

type Closer = () => Promise<unknown> | unknown;

/** Of a caller's stated needs, what one clone carries with it (`TestDatabase`, decision D134). */
export interface CloneNeeds {
  readonly connectTimeoutMs?: number;
}

/** One database of a run, cloned from a template. Created by `TestRun.createDatabase`. */
export class TestDatabase {
  readonly name: string;
  /** The template key it was cloned from. */
  readonly template: string;
  readonly timings: CloneTiming;
  readonly #run: TestRun;
  readonly #guarded: GuardedDatabaseName;
  readonly #closers: Closer[] = [];
  /** What the request that made this database stated of the caller's needs (decision D134). */
  readonly #needs: CloneNeeds;
  #appPool: Pool | undefined;
  #ownerPool: Pool | undefined;
  #dropped = false;

  /** @internal Use `TestRun.createDatabase`. */
  constructor(run: TestRun, guarded: GuardedDatabaseName, template: string, timings: CloneTiming, needs: CloneNeeds = {}) {
    this.#run = run;
    this.#guarded = guarded;
    this.name = guarded;
    this.template = template;
    this.timings = timings;
    this.#needs = needs;
  }

  get dropped(): boolean {
    return this.#dropped;
  }

  /**
   * The connection of the code under test: role `dems_app` on this database, as the five
   * discrete fields the server's `createConfig` takes. The password is a `Secret`.
   */
  get runtime(): DatabaseConnection {
    return this.#run.connectionOn(this.#guarded, 'app');
  }

  /** A pool of `dems_app` on this database (at most five connections, TI-14). Closed by `drop()`. */
  appPool(): Pool {
    this.#assertUsable();
    this.#appPool ??= this.#run.poolOn(this.#guarded, 'app', undefined, this.#needs.connectTimeoutMs);
    return this.#appPool;
  }

  /**
   * A pool of `dems_owner` on this database, for fixtures and assertions of the test itself.
   * Never hand it to the code under test (TI-17). Closed by `drop()`.
   */
  ownerPool(): Pool {
    this.#assertUsable();
    this.#ownerPool ??= this.#run.poolOn(this.#guarded, 'owner', undefined, this.#needs.connectTimeoutMs);
    return this.#ownerPool;
  }

  /**
   * Registers something that holds a connection to this database and must be closed before the
   * drop: the app under test (`db.onCleanup(() => app.close())`), a pool the test built itself.
   */
  onCleanup(close: Closer): void {
    this.#closers.push(close);
  }

  /** Closes everything registered and the two pools. Errors are collected, not thrown. */
  async closeResources(): Promise<string[]> {
    const problems: string[] = [];
    for (const close of this.#closers.splice(0).reverse()) {
      try {
        await close();
      } catch (error) {
        problems.push(errorMessage(error));
      }
    }
    for (const pool of [this.#appPool, this.#ownerPool]) {
      if (pool === undefined) continue;
      try {
        await this.#run.endPool(pool);
      } catch (error) {
        problems.push(errorMessage(error));
      }
    }
    this.#appPool = undefined;
    this.#ownerPool = undefined;
    return problems;
  }

  /**
   * TI-10: closes every pool this database handed out and everything registered, waits for the
   * sessions to end, then drops the database. A session of another role that stays open makes
   * the drop fail (`SESSIONS_REMAIN`): the file is then reported as failed, and the run's
   * teardown removes the database.
   */
  async drop(): Promise<void> {
    if (this.#dropped) return;
    const problems = await this.closeResources();
    await this.#run.dropDatabase(this.name);
    this.#dropped = true;
    this.#run.forget(this);
    if (problems.length > 0) {
      throw new DbTestHelperError('CLEANUP_INCOMPLETE', `${this.name} was dropped, but closing its resources failed: ${problems.join('; ')}`);
    }
  }

  #assertUsable(): void {
    if (this.#dropped) throw new DbTestHelperError('DATABASE_NOT_READY', `${this.name} has been dropped.`);
  }
}

export class TestRun {
  readonly identity: RunIdentity;
  /** True for the process that created the run; false for a test file that attached to it. */
  readonly isOwner: boolean;
  readonly dataDir: string;
  /** What the run's own session reported about itself: role, address, port, server version. */
  readonly server: SessionFacts;
  readonly #session: OwnerSession;
  readonly #owner: RoleCredentials;
  readonly #app: RoleCredentials;
  readonly #resolve: DefinitionResolver;
  readonly #drainMs: number;
  readonly #dropRetry: Partial<DropRetryPolicy>;
  readonly #quietBudgetMs: number;
  readonly #now: () => number;
  readonly #databases = new Set<TestDatabase>();
  readonly #templateTimings: TemplateTiming[] = [];
  readonly #retriedDrops: RetriedDrop[] = [];
  #chain: Promise<void> = Promise.resolve();
  #closed = false;

  private constructor(fields: {
    identity: RunIdentity;
    isOwner: boolean;
    dataDir: string;
    session: OwnerSession;
    owner: RoleCredentials;
    app: RoleCredentials;
    options: RunOptions;
  }) {
    this.identity = fields.identity;
    this.isOwner = fields.isOwner;
    this.dataDir = fields.dataDir;
    this.server = fields.session.facts;
    this.#session = fields.session;
    this.#owner = fields.owner;
    this.#app = fields.app;
    this.#resolve = fields.options.resolveDefinition ?? conventionResolver();
    this.#drainMs = fields.options.sessionDrainMs ?? DEFAULT_SESSION_DRAIN_MS;
    this.#dropRetry = fields.options.dropRetry ?? {};
    this.#quietBudgetMs = Math.max(0, fields.options.clusterQuietBudgetMs ?? CLUSTER_QUIET_BUDGET_MS);
    this.#now = fields.options.now ?? Date.now;
  }

  // ── Creating and attaching ───────────────────────────────────────────────────────────────────

  /**
   * Starts a new run. Fails, with a message that says how to start the server, when PostgreSQL
   * does not answer (TI-1): the caller's tests then fail; they are not skipped.
   */
  static async start(options: StartOptions = {}): Promise<TestRun> {
    const label = runLabel((options.env ?? process.env)[ENV_TEST_STEP]);
    await (options.probe ?? assertServerReachable)(options.probeTarget ?? PROJECT_ENDPOINT);
    const dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
    const owner = readOwnerCredentials(dataDir);
    const app = readAppCredentials(dataDir);
    const session = await OwnerSession.open(owner, sessionOptions(options, 'dems-test-run'));
    try {
      const now = options.now ?? Date.now;
      for (let attempt = 0; attempt < PREFIX_ATTEMPTS; attempt += 1) {
        const identity = createRunIdentity(label, newStamp(now()));
        const key = livenessKey(identity.stamp);
        // Held by this session until the run ends or its process dies: "this run is alive".
        if (!(await tryLivenessLock(session, key))) continue;
        if ((await listDatabasesWithPrefix(session, identity.prefix)).length === 0) {
          const run = new TestRun({ identity, isOwner: true, dataDir, session, owner, app, options });
          // The test files drop their databases in processes of their own; a drop that needed a
          // retry is reported to this session, on the channel named like the run prefix.
          await session.listen(identity.prefix, (payload) => run.#heardRetriedDrop(payload));
          return run;
        }
        await releaseLivenessLock(session, key);
      }
      throw new DbTestHelperError('RUN_PREFIX_UNAVAILABLE', `No free run prefix was found in ${PREFIX_ATTEMPTS} attempts.`);
    } catch (error) {
      await session.close();
      throw error;
    }
  }

  /** Attaches a test file's process to a run that the global setup started. */
  static async attach(identity: RunIdentity, options: RunOptions = {}): Promise<TestRun> {
    const checked = createRunIdentity(identity.label, identity.stamp);
    const dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
    const owner = readOwnerCredentials(dataDir);
    const app = readAppCredentials(dataDir);
    const session = await OwnerSession.open(owner, sessionOptions(options, 'dems-test-file'));
    return new TestRun({ identity: checked, isOwner: false, dataDir, session, owner, app, options });
  }

  // ── Facts ────────────────────────────────────────────────────────────────────────────────────

  get closed(): boolean {
    return this.#closed;
  }

  /** How many statements the run's own session has sent. A refused request leaves it unchanged. */
  get statementCount(): number {
    return this.#session.statementCount;
  }

  get templateTimings(): readonly TemplateTiming[] {
    return this.#templateTimings;
  }

  /**
   * The forced drops that needed a retry, as far as this process knows: its own, and for the
   * owner of a run also the ones its test files have reported so far.
   */
  get retriedDrops(): readonly RetriedDrop[] {
    return this.#retriedDrops;
  }

  /** The runtime role's credentials, for the role check of the global setup. */
  get appCredentials(): RoleCredentials {
    return this.#app;
  }

  /** The databases of this run, from `pg_database`: name, owner (`datdba`), template flags. */
  async listDatabases(): Promise<DatabaseRow[]> {
    this.#assertOpen();
    return listDatabasesWithPrefix(this.#session, this.identity.prefix);
  }

  /** The roles that have a session on a database of this run (T-TI-3). */
  async sessionRoles(): Promise<string[]> {
    this.#assertOpen();
    return sessionRolesWithPrefix(this.#session, this.identity.prefix);
  }

  // ── Templates (TI-4, TI-5; §10.1) ────────────────────────────────────────────────────────────

  /**
   * Makes sure a template exists and is locked. If it does not exist, it is built from its
   * definition: its base first, then a copy of the base, the hook, the lock.
   *
   * `whole-build` (default) holds the clone lock from the check to the lock of the template, so
   * that two test files asking at the same time build it once (§10.1, `tpl_bulk`).
   * `create-only` holds it around `CREATE DATABASE` alone (TI-7); the owner of a run uses it
   * before any test file exists.
   */
  async ensureTemplate(key: string, mode: 'whole-build' | 'create-only' = 'whole-build'): Promise<void> {
    this.#assertOpen();
    const name = templateDatabaseName(this.identity, key);
    const guarded = guardOwnDatabase(name, this.identity, 'clone');
    if (isReadyTemplate(await findDatabase(this.#session, name))) return;

    const definition = await this.#resolve(key);
    if (definition === null) throw templateNotAvailable(key);
    if (definition.key !== key) {
      throw new DbTestHelperError('TEMPLATE_HOOK_INVALID', `The definition found for tpl_${key} carries the key ${definition.key}.`);
    }
    if (definition.base !== 'empty') await this.ensureTemplate(definition.base, mode);

    const started = performance.now();
    let createMs = 0;
    let hookMs = 0;
    /** Under the clone lock. False when another process finished the template meanwhile. */
    const create = async (): Promise<boolean> => {
      const existing = await findDatabase(this.#session, name);
      if (isReadyTemplate(existing)) return false;
      // A leftover of a build that did not finish: builders hold the lock, so nobody is on it.
      if (existing !== null) await this.#dropGuarded(guarded);
      const t = performance.now();
      if (definition.base === 'empty') {
        await createEmptyDatabase(this.#session, guarded);
      } else {
        const base = guardOwnDatabase(templateDatabaseName(this.identity, definition.base), this.identity, 'clone');
        await cloneDatabase(this.#session, guarded, base);
      }
      createMs = performance.now() - t;
      return true;
    };
    const finish = async (): Promise<void> => {
      const t = performance.now();
      try {
        await this.#runHook(definition, guarded);
        hookMs = performance.now() - t;
        const remaining = await waitForSessionsToEnd(this.#session, name, this.#drainMs);
        if (remaining.length > 0) {
          throw new DbTestHelperError(
            'TEMPLATE_BUILD_FAILED',
            `The hook of ${name} left sessions open (${describeSessions(remaining)}). A template must have none when it is locked (TI-5).`,
          );
        }
        await lockTemplate(this.#session, guarded);
      } catch (error) {
        // Never leave a half-built template behind: the next request would copy it.
        await this.#dropGuarded(guarded).catch(() => undefined);
        if (error instanceof DbTestHelperError) throw error;
        throw new DbTestHelperError('TEMPLATE_BUILD_FAILED', `Building ${name} failed: ${errorMessage(error)}`, { cause: error });
      }
    };

    let built: boolean;
    if (mode === 'create-only') {
      built = (await this.withCloneLock(create)).value;
      if (built) await finish();
    } else {
      built = (
        await this.withCloneLock(async () => {
          if (!(await create())) return false;
          await finish();
          return true;
        })
      ).value;
    }
    if (built) {
      this.#templateTimings.push({ key, database: name, createMs, hookMs, totalMs: performance.now() - started });
    }
  }

  async #runHook(definition: TemplateDefinition, guarded: GuardedDatabaseName): Promise<void> {
    const pool = this.poolOn(guarded, 'owner', 'dems-test-template');
    try {
      await definition.build({
        template: definition.key,
        database: guarded,
        pool,
        connection: this.connectionOn(guarded, 'owner'),
        run: this.identity,
      });
    } finally {
      await this.endPool(pool).catch(() => undefined);
    }
  }

  // ── Clones (TI-6, TI-7, TI-8) ────────────────────────────────────────────────────────────────

  /**
   * Clones a template into a new database of this run. One clone at a time, across all runs.
   *
   * `quiet` (decision D134) asks for the cluster to be quiet first: the helper looks for an empty
   * clone-lock queue for at most `clusterQuietBudgetMs` before it queues for the lock. It takes
   * nothing for that and blocks nobody, and whatever it found is in `timings.quiet`.
   */
  async createDatabase(options: CreateDatabaseOptions): Promise<TestDatabase> {
    this.#assertOpen();
    await this.ensureTemplate(options.template);
    const quiet = options.quiet === true ? await waitForQuietCluster(this.#session, this.#quietBudgetMs) : QUIET_NOT_ASKED;
    const template = guardOwnDatabase(templateDatabaseName(this.identity, options.template), this.identity, 'clone');
    const { value, lockWaitMs } = await this.withCloneLock(async () => {
      const from = performance.now();
      const existing = await listDatabasesWithPrefix(this.#session, this.identity.prefix);
      const counter = lowestFreeCounter(
        existing.map((row) => row.name),
        this.identity,
      );
      const name = guardOwnDatabase(fileDatabaseName(this.identity, counter, options.slug), this.identity, 'create');
      const t = performance.now();
      await cloneDatabase(this.#session, name, template);
      const to = performance.now();
      return { name, cloneMs: to - t, window: { from, to } };
    });
    const database = new TestDatabase(
      this,
      value.name,
      options.template,
      { lockWaitMs, cloneMs: value.cloneMs, window: value.window, quiet },
      { connectTimeoutMs: options.connectTimeoutMs },
    );
    this.#databases.add(database);
    return database;
  }

  /**
   * Drops a database of this run. Any other name is refused by the guard before a statement
   * is sent: the demo database, a lane, the maintenance database, a template of PostgreSQL,
   * a proof database, a database of another run (T-TI-2).
   */
  async dropDatabase(name: string): Promise<void> {
    const guarded = guardOwnDatabase(name, this.identity, 'drop');
    this.#assertOpen();
    await this.#dropGuarded(guarded);
  }

  async #dropGuarded(guarded: GuardedDatabaseName): Promise<void> {
    const row = await findDatabase(this.#session, guarded);
    if (row === null) return;
    if (row.isTemplate) await unlockTemplate(this.#session, guarded);
    // Sessions of the owner role are ended by the forced drop. A session of another role
    // cannot be ended by `dems_owner` (PG-26): give it time to close, then refuse.
    const foreign = await waitForSessionsToEnd(this.#session, guarded, this.#drainMs, (session) => session.role !== OWNER_ROLE);
    if (foreign.length > 0) {
      // Role and application name of what is still open, so that the owning test can be found.
      const named = clientsOfOtherRoles(await backendsOn(this.#session, guarded));
      throw new DbTestHelperError(
        'SESSIONS_REMAIN',
        `${guarded} cannot be dropped: sessions are still open on it (${named.length > 0 ? describeBackends(named) : describeSessions(foreign)}). ` +
          'Close the app or the pool under test in the cleanup of the file (db.onCleanup). ' +
          "The database is removed by the run's teardown, or by the stale sweep of a later run.",
      );
    }
    // Refused while a background worker of the server is on the database: repeated, bounded.
    const outcome = await dropDatabase(this.#session, guarded, this.#dropRetry);
    if (outcome.refusals > 0) await this.#noteRetriedDrop({ name: guarded, refusals: outcome.refusals });
  }

  /** The drop went through after a retry: counted here by the owner of the run, reported to it by a test file. */
  async #noteRetriedDrop(drop: RetriedDrop): Promise<void> {
    this.#retriedDrops.push(drop);
    if (this.isOwner) return;
    // Informational: a report that cannot be sent must not fail a drop that succeeded.
    await notifyRun(this.#session, this.identity.prefix, JSON.stringify(drop)).catch(() => undefined);
  }

  /** A test file's report of a retried drop, received on the run's channel. Anything else is ignored. */
  #heardRetriedDrop(payload: string): void {
    let report: unknown;
    try {
      report = JSON.parse(payload);
    } catch {
      return;
    }
    if (typeof report !== 'object' || report === null) return;
    const { name, refusals } = report as { name?: unknown; refusals?: unknown };
    if (typeof name !== 'string' || !name.startsWith(TEST_DATABASE_PREFIX)) return;
    if (typeof refusals !== 'number' || !Number.isInteger(refusals) || refusals < 1) return;
    this.#retriedDrops.push({ name, refusals });
  }

  // ── Connections on a database of the run ─────────────────────────────────────────────────────

  /**
   * @internal Five discrete fields of one role on a database of this run. Any other database
   * is refused: the helper hands out no connection to the demo database, a lane or the
   * maintenance database (TI-17).
   */
  connectionOn(database: string, role: 'owner' | 'app'): DatabaseConnection {
    const guarded = guardOwnDatabase(database, this.identity, 'connect to');
    const credentials = role === 'owner' ? this.#owner : this.#app;
    return Object.freeze({
      host: credentials.host,
      port: credentials.port,
      database: guarded,
      user: credentials.user,
      password: credentials.password,
    });
  }

  /** @internal A pool of one role on a database of this run; any other database is refused. The caller closes it. */
  poolOn(database: string, role: 'owner' | 'app', applicationName?: string, connectTimeoutMs?: number): Pool {
    const guarded = guardOwnDatabase(database, this.identity, 'connect to');
    this.#assertOpen();
    return role === 'owner'
      ? createRolePool(this.#owner, guarded, { max: OWNER_POOL_MAX, applicationName: applicationName ?? 'dems-test-fixture', connectTimeoutMs })
      : createRolePool(this.#app, guarded, { max: APP_POOL_MAX, applicationName: applicationName ?? 'dems-test-app', connectTimeoutMs });
  }

  /**
   * @internal Ends a pool, but waits no longer than the session drain time: a pool whose client
   * was checked out and never released would otherwise wait forever. What is still connected
   * afterwards shows up as a session, and the drop or the template lock deals with it.
   */
  async endPool(pool: Pool): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const waited = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.#drainMs);
    });
    const ended = pool.end();
    // If the wait gives up first, a later failure of `end()` must not go unhandled.
    ended.catch(() => undefined);
    try {
      await Promise.race([ended, waited]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** @internal */
  forget(database: TestDatabase): void {
    this.#databases.delete(database);
  }

  // ── Stale sweep (TI-12) ──────────────────────────────────────────────────────────────────────

  /**
   * Drops the test databases of runs that are older than six hours and not alive. A database
   * of a younger run is never dropped, and neither is one whose run still holds its liveness
   * lock, nor a name that is not of the scheme.
   */
  async sweepStale(): Promise<SweepReport> {
    this.#assertOpen();
    this.#assertOwner('sweep stale databases');
    const nowSeconds = Math.floor(this.#now() / 1000);
    const all = await listDatabasesWithPrefix(this.#session, TEST_DATABASE_PREFIX);
    const plan = classifyForSweep(
      all.map((row) => row.name),
      this.identity,
      nowSeconds,
    );
    const dropped: string[] = [];
    const keptLive: string[] = [];
    const failed: Array<{ name: string; reason: string }> = [];
    for (const stale of plan.stale) {
      const key = livenessKey(stale.run.stamp);
      if (!(await tryLivenessLock(this.#session, key))) {
        keptLive.push(...stale.databases);
        continue;
      }
      try {
        const claim: StaleClaim = { stamp: stale.run.stamp, nowSeconds };
        for (const name of clonesFirst(stale.databases)) {
          try {
            await this.#dropGuarded(guardStaleDatabase(name, this.identity, claim));
            dropped.push(name);
          } catch (error) {
            failed.push({ name, reason: errorMessage(error) });
          }
        }
      } finally {
        await releaseLivenessLock(this.#session, key);
      }
    }
    return { dropped, keptYounger: plan.younger, keptLive, unrecognised: plan.unrecognised, failed };
  }

  // ── A dead run, removed by name (row W11b, decision D111) ────────────────────────────────────

  /**
   * Drops the databases of ONE other run that somebody names, after showing that it is dead.
   * It is for a run that was stopped before its teardown and is younger than the six hours the
   * stale sweep waits.
   *
   * The sweep runs unattended at the start of every `test:db` and must never touch a run that a
   * parallel row may be using, so it asks for age AND a free liveness lock. Here somebody who
   * knows that a run was stopped names it, and the helper proves what it can prove:
   *
   *   1. the text is exactly a run prefix, `dems_test_<label>_<stamp>_`, and not the caller's
   *      own. The demo database, a lane, the maintenance database and the templates of
   *      PostgreSQL are no run prefixes: refused before any statement;
   *   2. no session holds the run's liveness lock, so the process that owned the run is gone
   *      (`RUN_ALIVE` otherwise). The caller takes the lock and holds it while it works;
   *   3. no client session of any role is on a database of the run, now and again after
   *      `settleMs`: nobody is still working in it (`SESSIONS_REMAIN` otherwise). Nothing is
   *      ended to get there, not even a session of the owner role.
   *
   * Then every database with the prefix is dropped as the teardown does it: clones first,
   * templates after `IS_TEMPLATE false`, each name through the guard, each drop with the
   * bounded retry.
   */
  async dropDeadRun(prefix: string, options: DropDeadRunOptions = {}): Promise<DeadRunReport> {
    const dead = parseRunPrefix(prefix);
    if (dead === null) {
      const shown = typeof prefix === 'string' ? JSON.stringify(prefix) : `a value of type ${typeof prefix}`;
      throw new DbGuardError(
        'GUARD_NOT_A_TEST_DATABASE',
        String(prefix),
        `refused before any statement: ${shown} is not the prefix of a test run (${TEST_DATABASE_PREFIX}<label>_<stamp>_, with its last underscore).`,
      );
    }
    if (dead.prefix === this.identity.prefix) {
      throw new DbGuardError(
        'GUARD_NOT_STALE',
        dead.prefix,
        `refused before any statement: ${dead.prefix}* is this run; a run removes its own databases with its teardown.`,
      );
    }
    this.#assertOpen();
    this.#assertOwner('drop the databases of a dead run');
    const settleMs = Math.max(0, options.settleMs ?? DEAD_RUN_SETTLE_MS);
    const started = performance.now();
    const key = livenessKey(dead.stamp);
    if (!(await tryLivenessLock(this.#session, key))) {
      throw new DbTestHelperError(
        'RUN_ALIVE',
        `refused: the run ${dead.prefix}* is alive: a session holds its liveness lock (advisory lock ${LOCK_CLASS}, ${key} ` +
          'on the maintenance database). Nothing was dropped. A run that was stopped releases the lock when its process ends.',
      );
    }
    try {
      let busy = await this.#clientSessionsOf(dead.prefix);
      if (busy === '') {
        await pause(settleMs);
        busy = await this.#clientSessionsOf(dead.prefix);
      }
      if (busy !== '') {
        throw new DbTestHelperError(
          'SESSIONS_REMAIN',
          `refused: sessions are open on databases of the run ${dead.prefix}* (${busy}): somebody is still working in it. ` +
            'Nothing was dropped and no session was ended.',
        );
      }
      const claim: DeadRunClaim = { run: dead };
      const dropped: string[] = [];
      const failed: Array<{ name: string; reason: string }> = [];
      const rows = await listDatabasesWithPrefix(this.#session, dead.prefix);
      for (const name of clonesFirst(rows.map((row) => row.name))) {
        try {
          await this.#dropGuarded(guardDeadRunDatabase(name, this.identity, claim));
          dropped.push(name);
        } catch (error) {
          failed.push({ name, reason: errorMessage(error) });
        }
      }
      const remaining = (await listDatabasesWithPrefix(this.#session, dead.prefix)).map((row) => row.name);
      return { prefix: dead.prefix, dropped, remaining, failed, ms: performance.now() - started };
    } finally {
      await releaseLivenessLock(this.#session, key).catch(() => undefined);
    }
  }

  /** The client sessions on the databases of a run, described; the empty text when there is none. */
  async #clientSessionsOf(prefix: string): Promise<string> {
    if ((await sessionRolesWithPrefix(this.#session, prefix)).length === 0) return '';
    const parts: string[] = [];
    for (const row of await listDatabasesWithPrefix(this.#session, prefix)) {
      const clients = (await backendsOn(this.#session, row.name)).filter((group) => group.role !== null);
      if (clients.length > 0) parts.push(`${describeBackends(clients)} on ${row.name}`);
    }
    // Seen a moment ago and gone at the second look: still not quiet.
    return parts.length > 0 ? parts.join('; ') : 'a session that had left again when the helper looked';
  }

  // ── The end of a run (TI-11) ─────────────────────────────────────────────────────────────────

  /**
   * Drops every database with the run prefix, clones first, then templates; then closes the
   * run. `remaining` lists what could not be dropped; the stale sweep of a later run takes it.
   */
  async teardown(): Promise<TeardownReport> {
    this.#assertOpen();
    this.#assertOwner('tear the run down');
    const started = performance.now();
    for (const database of this.#databases) await database.closeResources();
    const dropped: string[] = [];
    const failed: Array<{ name: string; reason: string }> = [];
    try {
      const rows = await listDatabasesWithPrefix(this.#session, this.identity.prefix);
      for (const name of clonesFirst(rows.map((row) => row.name))) {
        try {
          await this.#dropGuarded(guardOwnDatabase(name, this.identity, 'drop'));
          dropped.push(name);
        } catch (error) {
          failed.push({ name, reason: errorMessage(error) });
        }
      }
      // Read from the catalog after the drops: a database that a refused drop left is listed here.
      const remaining = (await listDatabasesWithPrefix(this.#session, this.identity.prefix)).map((row) => row.name);
      return { dropped, remaining, failed, retriedDrops: [...this.#retriedDrops], ms: performance.now() - started };
    } finally {
      await this.close();
    }
  }

  /**
   * Closes the run's connections and nothing else. For a test file's attached run this is the
   * normal end. For the owner of a run it releases the liveness lock and leaves the databases:
   * call `teardown()` instead, unless a crash is being simulated.
   */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    for (const database of this.#databases) await database.closeResources();
    await this.#session.close();
  }

  // ── Internals ────────────────────────────────────────────────────────────────────────────────

  /**
   * TI-7: one `CREATE DATABASE` at a time. The advisory lock serialises sessions (the two
   * workers, rows that test at the same time); it is re-entrant within a session, so the
   * calls of this process queue on a promise chain first.
   *
   * @internal The helper's own tests hold the lock through this to prove that a clone waits.
   * `work` must not ask the same run for a template or a clone: it would wait for itself.
   */
  async withCloneLock<T>(work: () => Promise<T>): Promise<{ value: T; lockWaitMs: number }> {
    this.#assertOpen();
    const previous = this.#chain;
    let release = (): void => undefined;
    this.#chain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const started = performance.now();
      try {
        await takeCloneLock(this.#session);
      } catch (error) {
        if (errorCode(error) === LOCK_NOT_AVAILABLE) {
          throw new DbTestHelperError(
            'CLONE_LOCK_TIMEOUT',
            'The clone lock (advisory lock 442002, 0 on the maintenance database) was not free in time: ' +
              'another run holds it. Nothing was created.',
            { cause: error },
          );
        }
        throw error;
      }
      const lockWaitMs = performance.now() - started;
      try {
        return { value: await work(), lockWaitMs };
      } finally {
        await releaseCloneLock(this.#session).catch(() => undefined);
      }
    } finally {
      release();
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw new DbTestHelperError('RUN_CLOSED', `The run ${this.identity.prefix}* is closed.`);
  }

  #assertOwner(action: string): void {
    if (!this.isOwner) {
      throw new DbTestHelperError('RUN_NOT_OWNER', `Only the process that started the run ${this.identity.prefix}* may ${action}.`);
    }
  }
}

function sessionOptions(options: RunOptions, applicationName: string): {
  applicationName: string;
  lockTimeoutMs: number;
  clientFactory?: ClientFactory;
} {
  return {
    applicationName,
    lockTimeoutMs: options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
    ...(options.clientFactory === undefined ? {} : { clientFactory: options.clientFactory }),
  };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** A template that is finished: flagged as one and closed to connections (TI-5). */
function isReadyTemplate(row: DatabaseRow | null): boolean {
  return row !== null && row.isTemplate && !row.allowConnections;
}

/** Per-file databases before templates. */
function clonesFirst(names: readonly string[]): string[] {
  const sorted = [...names].sort();
  return [...sorted.filter((name) => !isTemplateName(name)), ...sorted.filter((name) => isTemplateName(name))];
}
