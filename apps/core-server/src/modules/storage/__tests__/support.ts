/**
 * Test support of the storage module and the network-time module (plan row W37; not a test
 * file; nothing here imports Vitest). The network-time tests import it too: both folders are
 * this row's.
 *
 *   engine double   for the database-free tests: a REAL headless `Sim` of the shared simulator
 *                   behind the seam `engine`, with the engine host's own actor scope and its own
 *                   refusal mapping (both exported by `src/engine`). What it leaves out is
 *                   PostgreSQL: nothing is stored, the "committed" state is the simulator's
 *                   store. It records every call a module makes;
 *   module app      the real app factory with that double, a stand-in database for the denial
 *                   rows of stage 6, a manual clock, and stage 4 as a stand-in (the caller is who
 *                   the test says). Stages 2, 3, 5, 6 and 7 are the real ones;
 *   bare routes     what a module registers on an empty Fastify instance: its whole route list;
 *   booted app      for the database tests: the real app factory on a clone of the seed, as
 *                   `dems_app`, with EVERY stage as the server has it and the REAL engine host on
 *                   a manual clock and a manual timer, booted as the entry point boots it.
 *
 * Credentials. A database test signs the seeded operators in through the guard row's support
 * (`webOperator`, `deviceOperator`): the shared demo password is used by name there and never
 * printed; a cookie or a token is taken from an answer and handed on in a header.
 */
import { CORE_API_OPERATIONS, CoreApiTag, type CoreApiRegistryOperation } from '@dems/shared/api';
import {
  ALWAYS_VISIBLE,
  DEFAULT_SEED,
  OPERATORS,
  ROLE_PERMISSIONS,
  createManualClock,
  createSim,
  type ControllableClock,
  type OperatorRole,
  type ScenarioName,
  type Sim,
  type SimOperator,
} from '@dems/shared/sim';
import Fastify, { type FastifyInstance, type FastifyPluginAsync, type LightMyRequestResponse, type RouteOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { buildApp } from '../../../app';
import { standInDatabase, type StandInDatabase } from '../../../../test/support/core';
import { engineControl, simRefusal, withActorScope, type EngineControl, type EngineHost } from '../../../engine';
import { manualTimer, type ManualTimer } from '../../../../test/support/engine';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { ApiFailure, NOT_SIGNED_IN_TEXT } from '../../../plugins/error-envelope';
import { buildGuardApp, type GuardApp, type GuardTarget } from '../../../../test/support/guard';
import type { Publication } from '../../../realtime';

/** A start for the manual clock that no wall clock of this decade can give: 2031-01-01T00:00:00Z. */
export const CLOCK_START = Date.UTC(2031, 0, 1);
export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const YEAR = 365 * 24 * HOUR;
/** The engine's timer period: one scheduler call per 50 ms of the clock. */
export const TICK_MS = 50;

export const WEB_ORIGIN = 'http://127.0.0.1:5173';

export const [INVESTIGATOR, SUPERVISOR, TECHNICIAN] = OPERATORS as readonly [SimOperator, SimOperator, SimOperator];
export const ROLES = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const satisfies readonly OperatorRole[];

// ── Principals of the database-free tests ──────────────────────────────────────────────────────

export const ANONYMOUS: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
export const PAIRED_DEVICE: Principal = { kind: 'DEVICE', deviceId: 'DEV-0001' };

/** An OPERATOR as stage 4 builds it for a seeded operator of `role`, with the grants of the shared table. */
export function operatorOf(role: OperatorRole, deviceId: string | null = null): Extract<Principal, { kind: 'OPERATOR' }> {
  const found = OPERATORS.find((candidate) => candidate.role === role);
  if (found === undefined) throw new Error(`no seeded operator with role ${role}`);
  return { kind: 'OPERATOR', operatorId: found.id, sessionId: `session-of-${found.id}`, deviceId, role, permissions: ROLE_PERMISSIONS[role] };
}

// ── The registry side of the module gate ───────────────────────────────────────────────────────

/** `METHOD /path operationId` of a route, in the form both sides of the gate are printed in. */
export const signature = (method: string, path: string, operationId: string): string => `${method.toUpperCase()} ${path} ${operationId}`;

/** The registry operations of one tag, in table order. */
export function registryOperationsOf(tag: CoreApiTag): readonly CoreApiRegistryOperation[] {
  return CORE_API_OPERATIONS.filter((operation) => operation.tag === tag);
}

/** The route list the registry asks of a module: one line per operation of its tag. */
export function registrySignatures(tag: CoreApiTag): string[] {
  return registryOperationsOf(tag).map((operation) => signature(operation.method, operation.path, operation.operationId));
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

export interface RecordedCommand {
  readonly principal: Principal;
  readonly action: string;
  readonly args: readonly unknown[];
}

export interface EngineDouble {
  /** What goes behind the seam `engine`. */
  readonly host: EngineHost;
  /** The real shared simulator the double runs: its store is the double's committed state. */
  readonly sim: Sim;
  /** Every `command` call, as the module made it, in order. */
  readonly commands: RecordedCommand[];
  /** How often `state()` was called, and the names `slice()` was called with. */
  readonly reads: { state: number; slices: string[] };
  /** What `epoch` and `revision` answer. A command that changed a durable slice moves the revision by 1. */
  position: { epoch: number; revision: number };
  /** False: `state()`, `slice()` and `command()` refuse as a host that is not running does (503). */
  running: boolean;
  /** True: the double stops right after its next command committed, as a reset or a shutdown that begins then does. */
  stopAfterCommand: boolean;
  /** The next `state()`, `slice()` or `command()` throws this, once. */
  failNext(error: unknown): void;
  /** One engine step at the clock's instant: the simulator's own tick, as the scheduler runs it. */
  tick(): void;
}

const notRunning = (): ApiFailure => new ApiFailure(503, 'NOT_READY', 'The server is not ready. Try again shortly.');
const notUsed = (member: string) => (): never => {
  throw new Error(`the engine double has no ${member}: the modules of plan row W37 do not call it`);
};

/** The slices a command of these modules can change; a changed reference counts as a committed change. */
const WATCHED = ['storagePolicy', 'audit', 'events', 'tabletLink'] as const;

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

  const commands: RecordedCommand[] = [];
  const reads = { state: 0, slices: [] as string[] };
  let failure: { error: unknown } | null = null;
  const takeFailure = (): void => {
    if (failure === null) return;
    const { error } = failure;
    failure = null;
    throw error;
  };

  const double: EngineDouble = {
    sim,
    commands,
    reads,
    position: { epoch: 7, revision: 40 },
    running: true,
    stopAfterCommand: false,
    failNext(error) {
      failure = { error };
    },
    tick: () => sim.tick(),
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
      async command(principal, action, ...args) {
        commands.push({ principal, action, args });
        takeFailure();
        if (!double.running) throw notRunning();
        if (principal.kind !== 'OPERATOR') throw new ApiFailure(401, 'NOT_SIGNED_IN', NOT_SIGNED_IN_TEXT);
        const before = sim.store.getState();
        const run = sim.actions[action] as (...parameters: unknown[]) => unknown;
        let value: unknown;
        try {
          // The host's own actor scope: the caller for exactly this action, signed out afterwards.
          value = withActorScope(sim.store, principal.operatorId, clock.now(), () => run(...args));
        } catch (error) {
          // The host's own mapping of a refusal the simulator throws (spec §7.2).
          throw simRefusal(error) ?? error;
        }
        const after = sim.store.getState();
        if (WATCHED.some((slice) => before[slice] !== after[slice])) double.position = { ...double.position, revision: double.position.revision + 1 };
        if (double.stopAfterCommand) {
          double.stopAfterCommand = false;
          double.running = false;
        }
        return { value, epoch: double.position.epoch, revision: double.position.revision } as never;
      },
      state() {
        reads.state += 1;
        takeFailure();
        if (!double.running) throw notRunning();
        return sim.store.getState();
      },
      slice(name) {
        reads.slices.push(name);
        takeFailure();
        if (!double.running) throw notRunning();
        return sim.store.getState()[name];
      },
      run: notUsed('run'),
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

/** A POST as the web console sends it: its `Origin`, and a JSON body when one is given. */
export function post(app: FastifyInstance, url: string, payload?: unknown, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...headers }, ...(payload === undefined ? {} : { payload: payload as object }) });
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
    // No JSON body.
  }
  return [response.statusCode, code];
}

export function errorOf(response: LightMyRequestResponse): ErrorOf {
  return (response.json() as { error: ErrorOf }).error;
}

// ── The app of the database tests ──────────────────────────────────────────────────────────────

export interface BootedApp extends GuardApp {
  readonly engine: EngineHost & EngineControl;
  readonly timer: ManualTimer;
  /** Everything handed to `app.publish`, in order. */
  readonly publications: Publication[];
  /**
   * Advances the clock by `ms`, `stepMs` at a time, fires the timer after each step and waits
   * until the tick's unit has ended: the engine at its cadence, without real time.
   */
  drive(ms: number, stepMs?: number): Promise<void>;
}

export interface BootedAppOptions {
  /** Where the manual clock stands at the boot. Default: `CLOCK_START`. */
  readonly startAt?: number;
}

/**
 * The real app on a clone, ready and BOOTED as the entry point boots it (B-1 to B-9, the engine's
 * rehydration, the role matrix). No stage is replaced and no route is a stand-in. The engine's
 * timer is a manual one, set before the boot: the engine ticks only when a test fires it.
 * The app is closed before the clone is dropped.
 */
export async function bootedApp(target: GuardTarget, options: BootedAppOptions = {}): Promise<BootedApp> {
  const guard = buildGuardApp(target);
  await guard.app.ready();
  if (options.startAt !== undefined) guard.clock.set(options.startAt);
  const publications: Publication[] = [];
  guard.app.seams.replace('publish', (publication) => void publications.push(publication));
  const engine = engineControl(guard.app);
  const timer = manualTimer();
  engine.useTimer(timer.timer);
  await guard.app.readiness.boot();
  await engine.idle();
  await guard.app.pipeline.drain();
  return {
    ...guard,
    engine,
    timer,
    publications,
    async drive(ms, stepMs = TICK_MS) {
      for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
        guard.clock.advance(stepMs);
        timer.fire();
        await engine.idle();
      }
    },
  };
}

/** The state changes among publications, with the audit row types each appended. */
export function appendedAuditTypes(publications: readonly Publication[]): string[] {
  return publications.flatMap((publication) => {
    if (publication.kind !== 'state') return [];
    return publication.change.ops.flatMap((op) => (op.op === 'append' && op.slice === 'audit' ? op.rows.map((row) => row.type) : []));
  });
}
