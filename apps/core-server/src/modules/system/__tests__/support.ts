/**
 * Test support of the system module and the alerts module (plan row W40; not a test file;
 * nothing here imports Vitest). The alerts tests import it too: both folders are this row's.
 *
 *   engine double   for the database-free tests: a REAL headless `Sim` of the shared simulator
 *                   behind the seam `engine`, with the engine host's own actor scope and its own
 *                   refusal mapping (both exported by `src/engine`). `command` and `run` are
 *                   units as the host's are: all or nothing. What it leaves out is PostgreSQL:
 *                   nothing is stored, the "committed" state is the simulator's store. It
 *                   records every unit and every hosted action a module runs;
 *   module app      the real app factory with that double, a stand-in database for the denial
 *                   rows of stage 6, a manual clock, and stage 4 as a stand-in (the caller is who
 *                   the test says). Stages 2, 3, 5, 6 and 7 are the real ones;
 *   bare routes     what a module registers on an empty Fastify instance: its whole route list;
 *   booted server   for the database tests: the real app factory on a clone, as `dems_app`, with
 *                   EVERY stage as the server has it and the REAL engine host on a manual clock
 *                   and a manual timer, booted as the entry point boots it, the three seeded
 *                   operators signed in on the web console;
 *   log readers     the lines of the captured log, by message and by member name.
 *
 * Credentials. A database test signs the seeded operators in through the identity row's support:
 * the shared demo password is used by name there and never printed; a cookie is taken from an
 * answer and handed on in a header.
 */
import { CORE_API_OPERATIONS, CoreApiTag, type CoreApiRegistryOperation } from '@dems/shared/api';
import {
  ALWAYS_VISIBLE,
  DEFAULT_SEED,
  OPERATORS,
  ROLE_PERMISSIONS,
  createManualClock,
  createSim,
  type AuditRow,
  type ControllableClock,
  type OperatorRole,
  type ScenarioName,
  type Sim,
  type SimOperator,
  type SimState,
} from '@dems/shared/sim';
import Fastify, { type FastifyInstance, type FastifyPluginAsync, type InjectOptions, type LightMyRequestResponse, type RouteOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Pool } from 'pg';
import { buildApp } from '../../../app';
import { readTrail, standInDatabase, type StandInDatabase } from '../../../../test/support/core';
import { DURABLE_SLICE_KEYS, pickDurable, type DurableSliceKey, type DurableSlices } from '../../../db/mapping';
import {
  engineControl,
  simRefusal,
  withActorScope,
  type EngineControl,
  type EngineHost,
  type EngineOutcome,
  type EngineStateChange,
  type EngineUnit,
  type HostedActionName,
} from '../../../engine';
import { countingPool, manualTimer, type CountingPool, type ManualTimer } from '../../../../test/support/engine';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { ApiFailure } from '../../../plugins/error-envelope';
import type { Publication } from '../../../realtime';
import { WEB_ORIGIN, identityApp, signInOnWeb, type Headers, type IdentityApp, type IdentityTarget, type ManualClock } from '../../../../test/support/identity';

/** A start for the manual clock that no wall clock of this decade can give: 2031-01-01T00:00:00Z. */
export const CLOCK_START = Date.UTC(2031, 0, 1);
export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
/** The engine's timer period: one scheduler call per 50 ms of the clock. */
export const TICK_MS = 50;

export { WEB_ORIGIN };

export const SYSTEM_STATUS = '/api/v1/system/status';
export const DIAGNOSTICS = '/api/v1/system/diagnostics';
export const SERVICES_RESTART = '/api/v1/system/services/restart';
export const UPDATE = '/api/v1/system/update';
export const SETTINGS = '/api/v1/settings';
export const ALERTS = '/api/v1/alerts';
export const acknowledge = (alertId: string): string => `${ALERTS}/${alertId}/acknowledge`;

export const ROLES = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const satisfies readonly OperatorRole[];

/** The seeded operator of a role (`@dems/shared/sim` `OPERATORS`: one per role). */
export function seeded(role: OperatorRole): SimOperator {
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
  return operator;
}

// ── Principals of the database-free tests ──────────────────────────────────────────────────────

export const ANONYMOUS: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
export const PAIRED_DEVICE: Principal = { kind: 'DEVICE', deviceId: 'DEV-0001' };

/** An OPERATOR as stage 4 builds it for the seeded operator of `role`, with the grants of the shared table. */
export function operatorOf(role: OperatorRole, deviceId: string | null = null): Extract<Principal, { kind: 'OPERATOR' }> {
  return { kind: 'OPERATOR', operatorId: seeded(role).id, sessionId: `session-of-${role}`, deviceId, role, permissions: ROLE_PERMISSIONS[role] };
}

// ── The registry side of the module gate ───────────────────────────────────────────────────────

/** `METHOD /path operationId` of a route, in the form both sides of the gate are printed in. */
export const signature = (method: string, path: string, operationId: string): string => `${method.toUpperCase()} ${path} ${operationId}`;

/** The registry operations of one tag, in table order. */
export function registryOperationsOf(tag: CoreApiTag): readonly CoreApiRegistryOperation[] {
  return CORE_API_OPERATIONS.filter((operation) => operation.tag === tag);
}

/** The route list the registry asks of a module: one line per operation of its tag, the path in the router's form. */
export function registrySignatures(tag: CoreApiTag): string[] {
  return registryOperationsOf(tag).map((operation) => signature(operation.method, operation.path.replace(/\{(\w+)\}/g, ':$1'), operation.operationId));
}

/** The lines of routes as Fastify was given them. A route with several methods gives one line per method. */
export function routeSignatures(routes: readonly RouteOptions[]): string[] {
  return routes.flatMap((route) =>
    (Array.isArray(route.method) ? route.method : [route.method]).map((method) => signature(String(method), route.url, String(route.config?.operationId))),
  );
}

/**
 * Everything a module plugin registers, on an empty Fastify instance with the server's two zod
 * compilers: no other unit is loaded, so every recorded route is the module's.
 */
export async function bareRoutes(plugin: FastifyPluginAsync): Promise<RouteOptions[]> {
  const bare = Fastify({ exposeHeadRoutes: false });
  bare.setValidatorCompiler(validatorCompiler);
  bare.setSerializerCompiler(serializerCompiler);
  const routes: RouteOptions[] = [];
  bare.addHook('onRoute', (route) => void routes.push(route));
  await bare.register(plugin);
  await bare.ready();
  await bare.close();
  return routes;
}

// ── The engine double ──────────────────────────────────────────────────────────────────────────

/** One hosted action a module ran. */
export interface RecordedAction {
  /** The label of the unit it ran in: `engine.<action>` for `command`, the module's label for `run`. */
  readonly unit: string;
  readonly principal: Principal;
  readonly action: string;
  readonly args: readonly unknown[];
}

/** One unit of work, as it ended. */
export interface RecordedUnit {
  readonly label: string;
  readonly committed: boolean;
  /** The hosted actions that ran in it, in order. */
  readonly actions: readonly string[];
  /** How often the unit read the pending state. */
  readonly pendingReads: number;
}

export interface EngineDouble {
  /** What goes behind the seam `engine`. */
  readonly host: EngineHost;
  /** The real shared simulator the double runs: its store is the double's committed state. */
  readonly sim: Sim;
  /** Every hosted action, as the module ran it, in order. */
  readonly actions: RecordedAction[];
  /** Every unit of work, in order. */
  readonly units: RecordedUnit[];
  /** How often `state()` was called, and the names `slice()` was called with. */
  readonly reads: { state: number; slices: string[] };
  /** What `epoch` and `revision` answer. A unit that changed a durable slice moves the revision by 1. */
  position: { epoch: number; revision: number };
  /** False: `state()`, `slice()`, `command()` and `run()` refuse as a host that is not running does (503). */
  running: boolean;
  /** True: the double stops right after its next unit committed, as a reset or a shutdown that begins then does. */
  stopAfterUnit: boolean;
  /** The next `state()`, `slice()`, `command()` or `run()` throws this, once. */
  failNext(error: unknown): void;
  /** The next unit fails at its commit with this, once: its work ran, and the state is set back. */
  failNextCommit(error: unknown): void;
  /** One engine step at the clock's instant: the simulator's own tick, as the scheduler runs it. */
  tick(): void;
  /** Runs simulator actions as the seeded operator of a role, outside any request: a test's preparation. */
  act<Value>(role: OperatorRole, work: (actions: Sim['actions']) => Value): Value;
  /** The simulator's whole state. */
  state(): SimState;
}

const notRunning = (): ApiFailure => new ApiFailure(503, 'NOT_READY', 'The server is not ready. Try again shortly.');
const notUsed = (member: string) => (): never => {
  throw new Error(`the engine double has no ${member}: the modules of plan row W40 do not call it`);
};

export async function engineDouble(clock: ControllableClock, scenario?: ScenarioName): Promise<EngineDouble> {
  const sim = createSim({
    seed: DEFAULT_SEED,
    ...(scenario === undefined ? {} : { scenario }),
    clock,
    // Inert adapters, as the engine host passes them: nothing is scheduled, nothing is persisted.
    scheduler: () => () => undefined,
    timers: { setTimeout: () => null, clearTimeout: () => undefined },
    storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    authStorage: null,
    visibility: ALWAYS_VISIBLE,
    onError: (report) => {
      throw new Error(`the simulator of the engine double reported an error in ${report.source}`);
    },
  });
  await sim.ready;

  const actions: RecordedAction[] = [];
  const units: RecordedUnit[] = [];
  const reads = { state: 0, slices: [] as string[] };
  let failure: { error: unknown } | null = null;
  let commitFailure: { error: unknown } | null = null;
  const take = (held: { error: unknown } | null, clear: () => void): void => {
    if (held === null) return;
    clear();
    throw held.error;
  };
  const takeFailure = (): void => take(failure, () => void (failure = null));

  /** One hosted action as the caller: the simulator's own action, its refusal mapped as the host maps it. */
  function perform(unit: string, ran: string[], principal: Principal, action: HostedActionName, args: readonly unknown[]): unknown {
    actions.push({ unit, principal, action, args });
    ran.push(action);
    if (principal.kind !== 'OPERATOR') throw new ApiFailure(401, 'NOT_SIGNED_IN', 'Sign in to continue.');
    const run = sim.actions[action] as (...parameters: readonly unknown[]) => unknown;
    try {
      // The host's own actor scope: the caller for exactly this action, signed out afterwards.
      return withActorScope(sim.store, principal.operatorId, clock.now(), () => run(...args));
    } catch (error) {
      // The host's own mapping of a refusal the simulator throws (spec §7.2).
      throw simRefusal(error) ?? error;
    }
  }

  /** One unit: all or nothing, as the host's (ENG-5). */
  async function inUnit<Value>(label: string, work: (ran: string[], pending: () => DurableSlices) => Promise<Value> | Value): Promise<EngineOutcome<Value>> {
    takeFailure();
    if (!double.running) throw notRunning();
    const before = sim.store.getState();
    const ran: string[] = [];
    let pendingReads = 0;
    const pending = (): DurableSlices => {
      pendingReads += 1;
      return pickDurable(sim.store.getState());
    };
    try {
      const value = await work(ran, pending);
      take(commitFailure, () => void (commitFailure = null));
      const after = sim.store.getState();
      if (DURABLE_SLICE_KEYS.some((key) => before[key] !== after[key])) double.position = { ...double.position, revision: double.position.revision + 1 };
      units.push({ label, committed: true, actions: ran, pendingReads });
      if (double.stopAfterUnit) {
        double.stopAfterUnit = false;
        double.running = false;
      }
      return { value, epoch: double.position.epoch, revision: double.position.revision };
    } catch (error) {
      sim.store.setState(before, true);
      units.push({ label, committed: false, actions: ran, pendingReads });
      throw error;
    }
  }

  const committed = (): DurableSlices => {
    takeFailure();
    if (!double.running) throw notRunning();
    return pickDurable(sim.store.getState());
  };

  const double: EngineDouble = {
    sim,
    actions,
    units,
    reads,
    position: { epoch: 7, revision: 40 },
    running: true,
    stopAfterUnit: false,
    failNext(error) {
      failure = { error };
    },
    failNextCommit(error) {
      commitFailure = { error };
    },
    tick: () => sim.tick(),
    act: (role, work) => withActorScope(sim.store, seeded(role).id, clock.now(), () => work(sim.actions)),
    state: () => sim.store.getState(),
    host: {
      get epoch() {
        return double.position.epoch;
      },
      get revision() {
        return double.position.revision;
      },
      get running() {
        return double.running;
      },
      command: (principal, action, ...args) =>
        inUnit(`engine.${action}`, (ran) => perform(`engine.${action}`, ran, principal, action, args)) as Promise<EngineOutcome<never>>,
      run: (label, work) =>
        inUnit(label, (ran, pending) => {
          const scope: EngineUnit = {
            // These modules own no row of their own: they must not reach for the unit's writers.
            get unit(): never {
              throw new Error('the modules of plan row W40 must not use the unit of work itself');
            },
            command: async (principal, action, ...args) => perform(label, ran, principal, action, args) as never,
            pending,
          };
          return work(scope);
        }),
      state() {
        reads.state += 1;
        return committed();
      },
      slice<Key extends DurableSliceKey>(name: Key): DurableSlices[Key] {
        reads.slices.push(name);
        return committed()[name];
      },
      setTabletLink: notUsed('setTabletLink'),
      mirrorOperators: notUsed('mirrorOperators'),
      start: notUsed('start'),
      reload: notUsed('reload'),
      stop: async () => undefined,
      meters: () => null,
      stats: notUsed('stats'),
    },
  };
  return double;
}

// ── The app of the database-free tests ─────────────────────────────────────────────────────────

export interface ModuleApp {
  readonly app: FastifyInstance;
  /** Every route the server registered, in order, as Fastify was given it. */
  readonly registered: RouteOptions[];
  readonly log: CapturedLog;
  /** The server clock of this app: it moves only when the test moves it (ENG-16). */
  readonly clock: ControllableClock;
  readonly engine: EngineDouble;
  /** The stand-in database: what stage 6 committed for a denial is in `database.committed`. */
  readonly database: StandInDatabase;
  /** Who the next requests come from (stage 4 as a stand-in). */
  actAs(principal: Principal): void;
}

export interface ModuleAppOptions {
  /** The scenario the double's simulator starts in. Default: idle. */
  readonly scenario?: ScenarioName;
  /** File of the persistent error log. Default: none. */
  readonly errorLogFile?: string;
}

/**
 * The real app factory with the engine double. The caller closes it (`app.close()`).
 * Stage 4 is a stand-in; the access rule (stage 6), the readiness stage, the Origin guard, the
 * throttle, the JSON parser and the zod compilers are the server's own.
 */
export async function moduleApp(options: ModuleAppOptions = {}): Promise<ModuleApp> {
  const log = captureLog();
  const database = standInDatabase();
  const app = buildApp({
    config: unitTestConfig({ logLevel: 'info' }),
    createPool: () => database.pool,
    logStream: log.stream,
    ...(options.errorLogFile === undefined ? {} : { errorLogFile: options.errorLogFile }),
  });
  const registered: RouteOptions[] = [];
  // Before the units load: every route they add is seen.
  app.addHook('onRoute', (route) => void registered.push(route));
  let current: Principal = ANONYMOUS;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  const clock = createManualClock(CLOCK_START);
  app.seams.replace('clock', clock);
  const engine = await engineDouble(clock, options.scenario);
  app.seams.replace('engine', engine.host);
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  return {
    app,
    registered,
    log,
    clock,
    engine,
    database,
    actAs(principal) {
      current = principal;
    },
  };
}

/** A POST as the web console sends it: its `Origin`, and a JSON body when one is given. A string is sent as the raw body. */
export function post(app: FastifyInstance, url: string, payload?: unknown, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url,
    headers: { origin: WEB_ORIGIN, ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
}

export interface ErrorOf {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, string | number | boolean | null>;
  readonly requestId?: string;
}

/** `[status, error code]` of an answer; the code is null for an answer that is no error envelope. */
export function outcome(response: LightMyRequestResponse): [number, string | null] {
  let code: string | null = null;
  try {
    code = (response.json() as { error?: { code?: string } }).error?.code ?? null;
  } catch {
    // No JSON body: a 202 or a 204 without one.
  }
  return [response.statusCode, code];
}

export function errorOf(response: LightMyRequestResponse): ErrorOf {
  return (response.json() as { error: ErrorOf }).error;
}

/** The body of an answer for `validateCoreApiResponse`: undefined for an answer without one. */
export function bodyOf(response: LightMyRequestResponse): unknown {
  return response.body === '' ? undefined : response.json();
}

// ── Readers of the captured log ────────────────────────────────────────────────────────────────

export type LogLine = Record<string, unknown>;

/** The members every line of the server's logger has, whatever it says. */
export const LOGGER_MEMBERS: readonly string[] = ['level', 'time', 'pid', 'hostname', 'reqId', 'msg'];

/** The lines with this message, in order. */
export const linesWith = (log: CapturedLog, message: string): LogLine[] => log.lines().filter((line) => line['msg'] === message);

/** The members of a line that the caller of the logger put there: everything but the logger's own. */
export function ownMembers(line: LogLine): LogLine {
  return Object.fromEntries(Object.entries(line).filter(([key]) => !LOGGER_MEMBERS.includes(key)));
}

/** Every member name of a value, at any depth, with the values of arrays included. */
export function memberNames(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) memberNames(item, found);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, member] of Object.entries(value)) {
      found.add(key);
      memberNames(member, found);
    }
  }
  return found;
}

/** Every string value of a value, at any depth. */
export function stringValues(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) for (const item of value) stringValues(item, found);
  else if (typeof value === 'object' && value !== null) for (const member of Object.values(value)) stringValues(member, found);
  return found;
}

// ── The app of the database tests ──────────────────────────────────────────────────────────────

export interface ServerTarget extends IdentityTarget {
  ownerPool(): Pool;
}

export interface BootedServerOptions {
  /** Where the manual clock stands at the boot. Default: `CLOCK_START`. */
  readonly startAt?: number;
}

export interface BootedServer {
  readonly app: FastifyInstance;
  readonly identity: IdentityApp;
  readonly engine: EngineHost & EngineControl;
  /** The server clock of this app: it moves only when the test moves it. */
  readonly clock: ManualClock;
  readonly timer: ManualTimer;
  readonly log: CapturedLog;
  readonly database: CountingPool;
  /** Role `dems_owner` on the clone: assertions only. */
  readonly owner: Pool;
  /** Everything handed to `app.publish`, in order. */
  readonly publications: Publication[];
  /** The web sessions of the three seeded operators: the cookie header of each. */
  readonly sessions: Readonly<Record<OperatorRole, Headers>>;
  /** The length of the stored trail once the app has booted and the three operators signed in. */
  readonly rowsAtStart: number;
  /** A read of the web console: the cookie, no `Origin`. */
  get(role: OperatorRole | null, url: string): Promise<LightMyRequestResponse>;
  /** A command of the web console: the cookie and the web console `Origin`. A string is sent as the raw body. */
  post(role: OperatorRole | null, url: string, payload?: InjectOptions['payload']): Promise<LightMyRequestResponse>;
  /** Advances the clock `stepMs` at a time, fires the timer after each step and waits for the tick's unit. */
  drive(ms: number, stepMs?: number): Promise<void>;
  /** The stored audit rows from position `from` on, as `dems_owner`. */
  since(from: number): Promise<AuditRow[]>;
  trailLength(): Promise<number>;
  stateChanges(): EngineStateChange[];
  /** The principal of a seeded operator, for `app.engine.command` in a test's own preparation. */
  principal(role: OperatorRole): Extract<Principal, { kind: 'OPERATOR' }>;
}

/**
 * The real app on a clone, booted: the engine is rehydrated and RUNS on a manual timer, so it
 * ticks exactly when a test fires it. No stage is replaced and no route is a stand-in. The three
 * seeded operators are signed in on the web console. Every count a test makes is relative to
 * `rowsAtStart`: the first start on a fresh seed writes a row of its own, and each sign-in
 * writes one. The app is closed before the clone is dropped.
 */
export async function bootedServer(target: ServerTarget, options: BootedServerOptions = {}): Promise<BootedServer> {
  const database = countingPool();
  const identity = await identityApp(target, { createPool: database.factory });
  const { app, clock, log } = identity;
  if (options.startAt !== undefined) clock.set(options.startAt);
  const publications: Publication[] = [];
  app.seams.replace('publish', (publication) => void publications.push(publication));
  const engine = engineControl(app);
  const timer = manualTimer();
  engine.useTimer(timer.timer);
  await app.readiness.boot();
  await engine.idle();
  await app.pipeline.drain();

  const owner = target.ownerPool();
  const sessions: Record<OperatorRole, Headers> = {
    INVESTIGATOR: (await signInOnWeb(identity, seeded('INVESTIGATOR').username)).cookie,
    SUPERVISOR: (await signInOnWeb(identity, seeded('SUPERVISOR').username)).cookie,
    TECHNICIAN: (await signInOnWeb(identity, seeded('TECHNICIAN').username)).cookie,
  };
  await app.pipeline.drain();
  const rowsAtStart = (await readTrail(owner)).length;
  const headers = (role: OperatorRole | null): Headers => (role === null ? {} : sessions[role]);

  return {
    app,
    identity,
    engine,
    clock,
    timer,
    log,
    database,
    owner,
    publications,
    sessions,
    rowsAtStart,
    get: (role, url) => app.inject({ method: 'GET', url, headers: headers(role) }),
    post: (role, url, payload) =>
      app.inject({
        method: 'POST',
        url,
        headers: { ...headers(role), origin: WEB_ORIGIN, ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}) },
        ...(payload === undefined ? {} : { payload }),
      }),
    async drive(ms, stepMs = TICK_MS) {
      for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
        clock.advance(stepMs);
        timer.fire();
        await engine.idle();
      }
    },
    since: async (from) => (await readTrail(owner)).slice(from),
    trailLength: async () => (await readTrail(owner)).length,
    stateChanges: () => publications.flatMap((publication) => (publication.kind === 'state' ? [publication.change] : [])),
    principal(role) {
      const operator = engine.slice('operators').find((candidate) => candidate.role === role);
      if (operator === undefined) throw new Error(`no operator with role ${role}`);
      return { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'test-preparation', deviceId: null, role, permissions: ROLE_PERMISSIONS[role] };
    },
  };
}

// ── Audit rows ─────────────────────────────────────────────────────────────────────────────────

/** An audit row without its place in a chain: what two trails of different length can share. */
export const content = (row: AuditRow) => ({
  at: row.at,
  type: row.type,
  category: row.category,
  severity: row.severity,
  actorId: row.actorId,
  message: row.message,
  sessionId: row.sessionId ?? null,
  evidenceId: row.evidenceId ?? null,
  deviceId: row.deviceId ?? null,
  details: row.details,
});

/** The whole row, as stored and as the simulator builds it. */
export const whole = (row: AuditRow) => ({ seq: row.seq, id: row.id, ...content(row), prevHash: row.prevHash, hash: row.hash });
