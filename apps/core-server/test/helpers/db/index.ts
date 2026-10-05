/**
 * Template-clone test helper: the API for database test files (plan row W11, HB-12; database
 * contract §10).
 *
 * A database test file belongs to the Vitest project `db`: its name ends in `.db.test.ts`, or
 * it lies under `test/acceptance/`. It runs through `npm run test:db`, never through
 * `npm test`. One database per test file, cloned from a template (TI-8):
 *
 *   import { useTestDatabase } from '<...>/test/helpers/db';
 *
 *   const db = useTestDatabase({ template: 'seed' });      // at the top level of the file
 *
 *   it('...', async () => {
 *     const app = buildApp({ config: createConfig({ ..., database: db.runtime }) });
 *     db.onCleanup(() => app.close());                     // closed before the drop
 *     const rows = await db.ownerPool().query('SELECT ...');  // fixtures and assertions
 *   });
 *
 * `db.runtime` is role `dems_app` on the file's own clone: the code under test connects exactly
 * as in the demo. `db.ownerPool()` is role `dems_owner` and is for the test's own fixtures and
 * assertions, never for the code under test (TI-17). The clone is dropped after the last test
 * of the file, also when a test throws.
 *
 * A row labels its databases with `DEMS_TEST_STEP=<row>` (02_plan §3.4):
 *
 *   DEMS_TEST_STEP=41 npm run test:db -w @dems/core-server -- src/modules/identity
 *
 * LIMITS (decision D114). A test file that imports this module in a run of the database tests
 * gets 120 s per test and 180 s per hook instead of the runner's 5 s and 10 s, without a line of
 * its own (`applyDatabaseTestLimits` below; the two numbers are in `constants.ts`). They are
 * CAPS, not waits: a clone or a template that a test asks for waits for the clone lock, which
 * another run on the host may hold for seconds, and with 5 s such a wait failed healthy tests
 * under load. The price: a database test that hangs is reported after 120 s, not after 5 s.
 * The helper only RAISES a limit, and only once, when this module is evaluated, which is before
 * any hook or test of the importing file is registered. So a limit that is already higher
 * stays, "no limit" stays no limit (the runner reads zero that way: `--test-timeout=0` under a
 * debugger), and whatever the file sets for itself afterwards (`vi.setConfig` in its body, or
 * a limit on one test or hook) wins, lower or higher.
 *
 * NEEDS (decision D134). A file that needs more than the caps, or that needs something else of
 * the cluster, states it once in the call instead of writing runner details in its own body:
 *
 *   const db = useTestDatabase({ template: 'seed', needs: { connectTimeoutMs: 20_000, quietCluster: true } });
 *
 * `needs.testTimeoutMs` and `needs.hookTimeoutMs` are floors the helper raises to (never
 * anything down, never above `DB_NEED_MAX_MS`); `needs.connectTimeoutMs` is the floor for the
 * wait of a connection on the file's clone, also the wait for a free one out of a pool; and
 * `needs.quietCluster` asks the helper to look for an empty clone-lock queue before each of the
 * file's clones, within a bound, and to say in `db.timings.quiet` whether it got it. Every part
 * is optional, so `useTestDatabase({ template })` keeps exactly the shape it always had.
 */
import type { Pool } from 'pg';
import { afterAll, beforeAll, expect, inject, vi } from 'vitest';
import type { DatabaseConnection } from '../../../src/config';
import {
  CONNECT_TIMEOUT_MS,
  DB_HOOK_TIMEOUT_MS,
  DB_NEED_MAX_MS,
  DB_TEST_TIMEOUT_MS,
  PROVIDE_KEY,
  type StandardTemplate,
} from './constants';
import { DbTestHelperError } from './errors';
import { conventionResolver, type DefinitionResolver, type TemplateDefinition } from './hooks';
import { createRunIdentity, slugFromFile, type RunIdentity } from './names';
import type { ProvidedTestRun } from './provided';
import { TestRun, type CloneTiming, type TestDatabase } from './run';

export { STANDARD_TEMPLATES, type StandardTemplate } from './constants';
export { DbGuardError, DbTestHelperError, type DbTestHelperErrorCode } from './errors';
export {
  TEMPLATE_HOOK_MODULES,
  type TemplateDefinition,
  type TemplateHook,
  type TemplateHookContext,
} from './hooks';
export type { RunIdentity } from './names';
export type { ProvidedTestRun } from './provided';
export { TestDatabase, TestRun, type CloneNeeds, type CloneTiming, type CreateDatabaseOptions, type TemplateTiming } from './run';
export type { ClusterQuiet } from './ddl';

// ── The limits of a database test file (decision D114) ─────────────────────────────────────────

/** The two limits of the runner that apply to a test file: milliseconds per test and per hook. */
export interface TestLimits {
  readonly testTimeout: number;
  readonly hookTimeout: number;
}

/**
 * The limits the runner holds at this instant for the file that is being collected in this
 * worker, or `null` where they cannot be read.
 *
 * Vitest can set and reset the two values (`vi.setConfig`, `vi.resetConfig`) but offers no way
 * to read them (5.0.3). They are read where `vi.setConfig` itself writes them: the configuration
 * of the worker's state. That object is not part of Vitest's declared API: `limits.test.ts`
 * fails if a later version keeps it elsewhere, and where it cannot be read, `null` makes the
 * helper set the caps as they are.
 */
export function currentTestLimits(): TestLimits | null {
  const state = (globalThis as { __vitest_worker__?: { config?: { testTimeout?: unknown; hookTimeout?: unknown } } }).__vitest_worker__;
  const testTimeout = state?.config?.testTimeout;
  const hookTimeout = state?.config?.hookTimeout;
  return typeof testTimeout === 'number' && typeof hookTimeout === 'number' ? { testTimeout, hookTimeout } : null;
}

/**
 * True for a limit that is none: to the runner zero, a negative number and infinity all mean
 * "never stop this test". Nothing is higher than that.
 */
export function isNoLimit(limit: number): boolean {
  return limit <= 0 || limit === Number.POSITIVE_INFINITY;
}

function raisedLimit(current: number | undefined, cap: number): number {
  if (current === undefined || Number.isNaN(current)) return cap;
  return isNoLimit(current) ? current : Math.max(current, cap);
}

/**
 * Each limit raised to its cap where it is below it. A limit at or above its cap is kept, and
 * so is "no limit": the helper never lowers.
 */
export function raisedTestLimits(current: TestLimits | null): TestLimits {
  return {
    testTimeout: raisedLimit(current?.testTimeout, DB_TEST_TIMEOUT_MS),
    hookTimeout: raisedLimit(current?.hookTimeout, DB_HOOK_TIMEOUT_MS),
  };
}

// ── What a caller states it needs (decision D134) ──────────────────────────────────────────────

/**
 * What one call of the helper states the file needs, so that the helper applies it instead of
 * every file writing runner details in its own body. Every part is optional.
 *
 * The three limits are FLOORS, never ceilings: the helper raises a limit to what is stated and
 * never brings anything down, not a cap it set itself, not a value the file set on its own after
 * the import. A stated limit is bounded by `DB_NEED_MAX_MS`: a need is never "unlimited", so one
 * file cannot hang a whole run for ever.
 */
export interface DatabaseNeeds {
  /** Floor of the runner's limit per test of this file. Default: the cap of 120 s. */
  readonly testTimeoutMs?: number;
  /**
   * Floor of the runner's limit per hook of this file, and of the helper's own two hooks, which
   * always keep at least their own 180 s whatever a file states. Default: the cap of 180 s.
   */
  readonly hookTimeoutMs?: number;
  /**
   * Floor of the wait for a connection on this file's clone, which in a pool is also the wait
   * for a free connection out of it. Default: the helper's 5 s (`CONNECT_TIMEOUT_MS`).
   */
  readonly connectTimeoutMs?: number;
  /**
   * The caller needs the cluster quiet for its clones: look for an empty clone-lock queue before
   * each of them, within `CLUSTER_QUIET_BUDGET_MS`, and report in `timings.quiet` whether the
   * cluster was quiet. It takes no lock for that and blocks no other run. Default false.
   */
  readonly quietCluster?: boolean;
}

/** True for a needs object that states at least one of the two runner limits. */
function statesARunnerLimit(needs: DatabaseNeeds): boolean {
  return needs.testTimeoutMs !== undefined || needs.hookTimeoutMs !== undefined;
}

function validatedNeed(value: number | undefined, what: string, cap: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new DbTestHelperError(
      'NEEDS_INVALID',
      `needs.${what} must be a whole number of milliseconds of at least 1, or left out for the helper's cap of ${cap} ms; the file stated ${String(value)}.`,
    );
  }
  if (value > DB_NEED_MAX_MS) {
    throw new DbTestHelperError(
      'NEEDS_INVALID',
      `needs.${what} is ${value} ms; a stated need is at most ${DB_NEED_MAX_MS} ms. Leave it out for the helper's cap of ${cap} ms.`,
    );
  }
  return value;
}

/** The floor a stated need asks for, applied to what the runner holds: never anything lower. */
function limitWithStatedNeed(current: number | undefined, cap: number, need: number | undefined, what: string): number {
  const stated = validatedNeed(need, what, cap);
  if (stated === undefined) return raisedLimit(current, cap);
  // Where the runner's limits cannot be read, assume nothing higher than the cap.
  if (current === undefined || Number.isNaN(current)) return Math.max(stated, cap);
  return isNoLimit(current) ? current : Math.max(current, stated);
}

/**
 * The two runner limits of the file as they stand now, with the stated needs applied. Where a
 * need is not stated, the rule of decision D114 holds: raised to the cap, never lowered.
 */
export function limitsWithNeeds(current: TestLimits | null, needs: DatabaseNeeds): TestLimits {
  return {
    testTimeout: limitWithStatedNeed(current?.testTimeout, DB_TEST_TIMEOUT_MS, needs.testTimeoutMs, 'testTimeoutMs'),
    hookTimeout: limitWithStatedNeed(current?.hookTimeout, DB_HOOK_TIMEOUT_MS, needs.hookTimeoutMs, 'hookTimeoutMs'),
  };
}

/**
 * The limit the helper's own two hooks carry: their cap, raised by a stated hook need, and never
 * below it. A file that states a short hook need shortens its own hooks, not the clone and the
 * drop of the helper.
 */
export function helperHookTimeout(needs: DatabaseNeeds): number {
  const applied = limitWithStatedNeed(currentTestLimits()?.hookTimeout, DB_HOOK_TIMEOUT_MS, needs.hookTimeoutMs, 'hookTimeoutMs');
  return isNoLimit(applied) ? applied : Math.max(applied, DB_HOOK_TIMEOUT_MS);
}

/**
 * The connect wait for the pools of one clone, or `undefined` for the helper's own default.
 * `undefined` stays `undefined` so that the pools of a caller that stated nothing are exactly
 * the pools they were before decision D134.
 */
export function connectTimeoutWithNeed(needs: DatabaseNeeds): number | undefined {
  const stated = validatedNeed(needs.connectTimeoutMs, 'connectTimeoutMs', CONNECT_TIMEOUT_MS);
  return stated === undefined ? undefined : Math.max(stated, CONNECT_TIMEOUT_MS);
}

/**
 * The needs of one call, checked and reduced to what it states. A limit that is no whole number
 * of milliseconds between 1 and `DB_NEED_MAX_MS` is refused here, at the top level of the file,
 * before the helper has asked the cluster for anything; so is a `quietCluster` that is neither a
 * truthy value nor left out.
 */
export function normalizeNeeds(needs: DatabaseNeeds = {}): DatabaseNeeds {
  if (needs.quietCluster !== undefined && typeof needs.quietCluster !== 'boolean') {
    throw new DbTestHelperError('NEEDS_INVALID', `needs.quietCluster is true, false, or left out; the file stated ${String(needs.quietCluster)}.`);
  }
  return Object.freeze({
    testTimeoutMs: validatedNeed(needs.testTimeoutMs, 'testTimeoutMs', DB_TEST_TIMEOUT_MS),
    hookTimeoutMs: validatedNeed(needs.hookTimeoutMs, 'hookTimeoutMs', DB_HOOK_TIMEOUT_MS),
    connectTimeoutMs: validatedNeed(needs.connectTimeoutMs, 'connectTimeoutMs', CONNECT_TIMEOUT_MS),
    quietCluster: needs.quietCluster === true,
  });
}

/**
 * What an inner request states wins; what it leaves out stays the file's. Takes the inner object
 * as it was written (a normalised one holds a definite `false` where nothing was stated).
 */
function needsOf(inner: DatabaseNeeds, file: DatabaseNeeds): DatabaseNeeds {
  return {
    testTimeoutMs: inner.testTimeoutMs ?? file.testTimeoutMs,
    hookTimeoutMs: inner.hookTimeoutMs ?? file.hookTimeoutMs,
    connectTimeoutMs: inner.connectTimeoutMs ?? file.connectTimeoutMs,
    quietCluster: inner.quietCluster === undefined ? file.quietCluster : inner.quietCluster === true,
  };
}

/** Raises the two runner limits when, and only when, the call states one of them. */
function applyStatedNeeds(needs: DatabaseNeeds): void {
  if (!statesARunnerLimit(needs)) return;
  vi.setConfig(limitsWithNeeds(currentTestLimits(), needs));
}

/**
 * Raises the runner's two limits for the test file that imports this module. Called once, right
 * here, when the module is evaluated: the runner evaluates the imports of a test file before the
 * file's own statements, so this runs before a hook or a test of the file is registered, and
 * before anything the file sets itself. The runner gives every test file a fresh copy of the
 * modules it imports and puts its own limits back after each file, so the next file starts from
 * the runner's values again.
 *
 * Only in a run of the database tests: there the global setup has provided the run. A file of
 * the database-free project that reaches this module keeps the runner's limits.
 */
function applyDatabaseTestLimits(): void {
  if (inject(PROVIDE_KEY) === undefined) return;
  vi.setConfig(raisedTestLimits(currentTestLimits()));
}

applyDatabaseTestLimits();

// ── The run of this worker process ─────────────────────────────────────────────────────────────

/** Private templates that test files of this process defined (`x_<name>`). */
const privateTemplates = new Map<string, TemplateDefinition>();
const byConvention = conventionResolver();
const resolveDefinition: DefinitionResolver = async (key) => privateTemplates.get(key) ?? byConvention(key);

let shared: { readonly run: Promise<TestRun>; users: number } | undefined;

/** The run the global setup started, as the test file sees it. */
export function providedRun(): ProvidedTestRun {
  const provided = inject(PROVIDE_KEY) as ProvidedTestRun | undefined;
  if (provided === undefined) {
    throw new DbTestHelperError(
      'RUN_NOT_PROVIDED',
      'No test run is provided. A database test runs in the Vitest project "db" (npm run test:db): ' +
        'name the file *.db.test.ts, or put it under test/acceptance/.',
    );
  }
  return provided;
}

function providedIdentity(): RunIdentity {
  const provided = providedRun();
  return createRunIdentity(provided.label, provided.stamp);
}

async function acquireRun(): Promise<TestRun> {
  shared ??= { run: TestRun.attach(providedIdentity(), { resolveDefinition }), users: 0 };
  const holder = shared;
  holder.users += 1;
  try {
    return await holder.run;
  } catch (error) {
    if (shared === holder) shared = undefined;
    throw error;
  }
}

async function releaseRun(): Promise<void> {
  const holder = shared;
  if (holder === undefined) return;
  holder.users -= 1;
  if (holder.users > 0) return;
  shared = undefined;
  const run = await holder.run.catch(() => undefined);
  await run?.close();
}

function templateKey(template: StandardTemplate | TemplateDefinition): string {
  if (typeof template === 'string') return template;
  const known = privateTemplates.get(template.key);
  if (known !== undefined && known !== template && (known.base !== template.base || known.build !== template.build)) {
    throw new DbTestHelperError('TEMPLATE_HOOK_INVALID', `Two different definitions of the template ${template.key} in one test file.`);
  }
  privateTemplates.set(template.key, template);
  return template.key;
}

function currentTestFile(): string {
  const path = expect.getState().testPath;
  return typeof path === 'string' ? path : 'file';
}

// ── One database per test file ─────────────────────────────────────────────────────────────────

export interface TestDatabaseOptions {
  /**
   * `schema` for migration, guard and privilege tests; `seed` for module and acceptance tests;
   * `bulk` for paging, the role-by-endpoint matrix and the contract test (§10.1). A private
   * template is passed as its definition (`{ key: 'x_<name>', base, build }`).
   */
  readonly template: StandardTemplate | TemplateDefinition;
  /** Goes into the database name. Default: the test file's base name. */
  readonly slug?: string;
  /**
   * What this file needs of the runner and of the cluster (decision D134): a floor for the two
   * runner limits and for the wait of a connection, and whether it needs the cluster quiet for
   * its clones. Optional: `{ template }` is the call it always was.
   */
  readonly needs?: DatabaseNeeds;
}

export interface TestDatabaseHandle {
  /** The clone's name: `dems_test_<label>_<stamp>_f<nn>_<slug>`. */
  readonly name: string;
  /** Role `dems_app` on the clone, as the five fields the server's `createConfig` takes. */
  readonly runtime: DatabaseConnection;
  readonly timings: CloneTiming;
  /** The underlying objects, for the rare test that needs more. */
  readonly database: TestDatabase;
  readonly run: TestRun;
  /** A pool of `dems_app` on the clone; closed before the drop. */
  appPool(): Pool;
  /** A pool of `dems_owner` on the clone, for fixtures and assertions only (TI-17). */
  ownerPool(): Pool;
  /** Registers something to close before the drop, for example `() => app.close()`. */
  onCleanup(close: () => Promise<unknown> | unknown): void;
  /** Another untouched clone for one test (TI-8). It is dropped with the file, or earlier by `drop()`. */
  another(options?: Partial<TestDatabaseOptions>): Promise<TestDatabase>;
}

/**
 * Call at the top level of a database test file. Before the first test the file gets its own
 * clone of the template; after the last one, pass or fail, every pool is closed and the clone
 * is dropped (TI-8, TI-10).
 *
 * A stated `needs` is applied right here, while the file is still being collected: the two
 * runner limits are raised to their floors, the helper's own two hooks take the hook floor (never
 * below their own 180 s), and the clone request carries the connect floor and the request for a
 * quiet cluster. A need stated later (`db.another({ needs })`, `withTestDatabase`) applies from
 * that moment on: it reaches the pools, the clones and the hooks that come after it, not the
 * limit of the test that is already running.
 */
export function useTestDatabase(options: TestDatabaseOptions): TestDatabaseHandle {
  const key = templateKey(options.template);
  const needs = normalizeNeeds(options.needs);
  applyStatedNeeds(needs);
  const hookTimeoutMs = helperHookTimeout(needs);
  let run: TestRun | undefined;
  let database: TestDatabase | undefined;
  const extras: TestDatabase[] = [];

  const ready = (): { run: TestRun; database: TestDatabase } => {
    if (run === undefined || database === undefined) {
      throw new DbTestHelperError(
        'DATABASE_NOT_READY',
        'The test database exists from the first test of the file on: use it inside a test or a hook, not at the top level.',
      );
    }
    return { run, database };
  };

  beforeAll(async () => {
    run = await acquireRun();
    database = await run.createDatabase({
      template: key,
      slug: options.slug ?? slugFromFile(currentTestFile()),
      quiet: needs.quietCluster,
      connectTimeoutMs: connectTimeoutWithNeed(needs),
    });
  }, hookTimeoutMs);

  afterAll(async () => {
    const problems: unknown[] = [];
    for (const target of [...extras.reverse(), database]) {
      if (target === undefined) continue;
      try {
        await target.drop();
      } catch (error) {
        problems.push(error);
      }
    }
    if (run !== undefined) await releaseRun();
    run = undefined;
    database = undefined;
    if (problems.length > 0) throw problems[0];
  }, hookTimeoutMs);

  return {
    get name() {
      return ready().database.name;
    },
    get runtime() {
      return ready().database.runtime;
    },
    get timings() {
      return ready().database.timings;
    },
    get database() {
      return ready().database;
    },
    get run() {
      return ready().run;
    },
    appPool: () => ready().database.appPool(),
    ownerPool: () => ready().database.ownerPool(),
    onCleanup: (close) => ready().database.onCleanup(close),
    async another(more = {}) {
      const state = ready();
      const inner = normalizeNeeds(more.needs);
      applyStatedNeeds(inner);
      const merged = needsOf(more.needs ?? {}, needs);
      const extra = await state.run.createDatabase({
        template: more.template === undefined ? key : templateKey(more.template),
        slug: more.slug ?? `${state.database.name.slice(state.run.identity.prefix.length + 4)}_more`,
        quiet: merged.quietCluster,
        connectTimeoutMs: connectTimeoutWithNeed(merged),
      });
      extras.push(extra);
      return extra;
    },
  };
}

/**
 * A clone for the duration of `body`: created before it, dropped after it, also when it throws.
 * For a single test that needs an untouched database of its own. A stated `needs` applies to this
 * clone (its connect wait, its request for a quiet cluster) and, from here on, to the runner
 * limits of the file: the limit of the running test itself is the one held when it was registered.
 */
export async function withTestDatabase<T>(options: TestDatabaseOptions, body: (database: TestDatabase, run: TestRun) => Promise<T>): Promise<T> {
  const key = templateKey(options.template);
  const needs = normalizeNeeds(options.needs);
  applyStatedNeeds(needs);
  const run = await acquireRun();
  try {
    const database = await run.createDatabase({
      template: key,
      slug: options.slug ?? slugFromFile(currentTestFile()),
      quiet: needs.quietCluster,
      connectTimeoutMs: connectTimeoutWithNeed(needs),
    });
    let result: T;
    try {
      result = await body(database, run);
    } catch (error) {
      // The body's error is the one to report; the drop is still attempted.
      await database.drop().catch(() => undefined);
      throw error;
    }
    await database.drop();
    return result;
  } finally {
    await releaseRun();
  }
}
