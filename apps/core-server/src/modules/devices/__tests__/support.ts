/**
 * Test support of the devices module (plan row W36; not a test file). Other rows may import it.
 *
 *   unit tests       the real app factory with no database: a principal the test chooses behind
 *                    stage 4, the REAL access rule (stage 6), and a recording stand-in behind the
 *                    seam `engine` that holds a state the test gives it;
 *   database tests   the real app factory on a clone of the seed, as `dems_app`, with EVERY
 *                    stage as the server has it, the engine BOOTED on a manual clock and a manual
 *                    timer, the three seeded operators signed in on the web console.
 *
 * No credential is printed: a session cookie is taken from an answer and handed on in a header.
 */
import { CORE_API_OPERATIONS, type CoreApiRegistryOperation } from '@dems/shared/api';
import {
  DEFAULT_SEED,
  OPERATORS,
  ROLE_PERMISSIONS,
  buildScenarioState,
  createIdleState,
  type AuditRow,
  type OperatorRole,
  type Permission,
  type ScenarioName,
  type SimState,
} from '@dems/shared/sim';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse, RouteOptions } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../../app';
import { readTrail } from '../../../../test/support/core';
import { pickDurable } from '../../../db/mapping';
import { engineControl, type EngineControl, type EngineHost, type EngineMeterFrame, type EngineStateChange } from '../../../engine';
import { countingPool, manualTimer, type CountingPool, type ManualTimer } from '../../../../test/support/engine';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, createFakePool, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import type { Publication } from '../../../realtime';
import { WEB_ORIGIN, identityApp, signInOnWeb, type Headers, type IdentityApp, type IdentityTarget, type ManualClock } from '../../../../test/support/identity';
import { DEVICES_OPERATIONS, type CommittedState, type DevicesOperation } from '../index';

/** The fixed instant the shared suites use: 2026-10-01 10:00:00 WIB. */
export const FIXED_NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
export const TICK_MS = 50;

export const HEALTH = '/api/v1/device/health';
export const AUDIO = '/api/v1/audio/status';
export const VIDEO = '/api/v1/video/status';
export const INVENTORY = '/api/v1/device/inventory';
export const ACTIVE_CAMERA = '/api/v1/video/active-camera';
export const CLIP_RESET = '/api/v1/audio/clip/reset';
export const restart = (id: string): string => `/api/v1/device/${id}/restart`;
export const testSignal = (id: string): string => `/api/v1/device/${id}/test-signal`;
export const identify = (id: string): string => `/api/v1/device/${id}/identify`;

/** The registry entries of operations 44 to 52, in registry order. */
export function registryEntries(): CoreApiRegistryOperation[] {
  return CORE_API_OPERATIONS.filter((operation) => (DEVICES_OPERATIONS as readonly string[]).includes(operation.operationId));
}

/** The operation number the registry entry names in its `source` (operations 47 to 52), or null (44 to 46 are design-book operations). */
export function operationNumber(operation: CoreApiRegistryOperation): number | null {
  const found = /operation (\d+)/.exec(operation.source);
  return found?.[1] === undefined ? null : Number(found[1]);
}

/** `METHOD /path operationId`: how the gate prints a route and a registry entry. */
export const signature = (method: string, path: string, operationId: string): string => `${method.toUpperCase()} ${path} ${operationId}`;

// ── States ─────────────────────────────────────────────────────────────────────────────────────

/** The whole simulator state of a scenario at `now`, as the shared builders make it. */
export function scenarioState(name: ScenarioName, now: number = FIXED_NOW): SimState {
  return buildScenarioState(name, createIdleState({ now, seed: DEFAULT_SEED }));
}

/** What `app.engine.state()` would return for a simulator state: its 28 durable slices and nothing else. */
export function committedOf(state: SimState): CommittedState {
  return pickDurable(state);
}

// ── Unit tests: the app without a database ─────────────────────────────────────────────────────

export interface RecordedCommand {
  readonly principal: Principal;
  readonly action: string;
  readonly args: readonly unknown[];
}

/** A stand-in behind the seam `engine`: it holds a committed state and records the commands. */
export interface EngineDouble {
  readonly host: EngineHost;
  readonly commands: RecordedCommand[];
  /** The state the reads answer from. */
  state: CommittedState;
  /** When set, the next command rejects with it (and it is cleared). */
  refuseWith: unknown;
  /** When false, `state()`, `slice()` and `command()` throw what the test put into `notRunning`. */
  running: boolean;
  notRunning: unknown;
  /** How often `state()` or `slice()` was read. */
  reads: number;
}

export const DOUBLE_EPOCH = 7;
export const DOUBLE_REVISION = 41;

export function engineDouble(state: CommittedState): EngineDouble {
  const unused = (member: string) => (): never => {
    throw new Error(`the devices module must not call engine.${member}`);
  };
  let revision = DOUBLE_REVISION;
  const double: EngineDouble = {
    commands: [],
    state,
    refuseWith: undefined,
    running: true,
    notRunning: new Error('the engine double is not running'),
    reads: 0,
    host: {
      get epoch() {
        return DOUBLE_EPOCH;
      },
      get revision() {
        return revision;
      },
      get running() {
        return double.running;
      },
      state() {
        if (!double.running) throw double.notRunning;
        double.reads += 1;
        return double.state;
      },
      slice(name) {
        if (!double.running) throw double.notRunning;
        double.reads += 1;
        return double.state[name];
      },
      command: (async (principal: Principal, action: string, ...args: unknown[]) => {
        if (!double.running) throw double.notRunning;
        double.commands.push({ principal, action, args });
        if (double.refuseWith !== undefined) {
          const refusal = double.refuseWith;
          double.refuseWith = undefined;
          throw refusal;
        }
        revision += 1;
        return { value: undefined, epoch: DOUBLE_EPOCH, revision };
      }) as EngineHost['command'],
      run: unused('run'),
      setTabletLink: unused('setTabletLink'),
      mirrorOperators: unused('mirrorOperators'),
      start: unused('start'),
      reload: unused('reload'),
      stop: async () => undefined,
      meters: () => null,
      stats: unused('stats'),
    },
  };
  return double;
}

export interface UnitApp {
  readonly app: FastifyInstance;
  /** Every route the units registered, in order. */
  readonly registered: RouteOptions[];
  readonly log: CapturedLog;
  readonly engine: EngineDouble;
  /** Every statement the app sent to its (stand-in) pool. */
  readonly queries: string[];
  /** The principal stage 4 gives the next requests. */
  actAs(principal: Principal): void;
}

export const ANONYMOUS: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };

/** An OPERATOR principal as stage 4 builds it, with the permissions the test names (default: the role's). */
export function operatorOf(role: OperatorRole, permissions: readonly Permission[] = ROLE_PERMISSIONS[role]): Principal {
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
  return { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'unit-test-session', deviceId: null, role, permissions };
}

/**
 * The real app factory with no database. Stage 4 is a stand-in that hands out the principal the
 * test chose; stage 6 is the REAL access rule; the engine is the double. Close it with
 * `app.close()`.
 */
export async function unitApp(state: CommittedState = committedOf(scenarioState('idle'))): Promise<UnitApp> {
  const log = captureLog();
  const fake = createFakePool();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream });
  const registered: RouteOptions[] = [];
  // Before the units load: every route they add is seen.
  app.addHook('onRoute', (route) => void registered.push(route));
  let current: Principal = ANONYMOUS;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  const engine = engineDouble(state);
  app.seams.replace('engine', engine.host);
  return { app, registered, log, engine, queries: fake.queries, actAs: (principal) => void (current = principal) };
}

/** The routes of this module among the registered ones: those that name one of its operations. */
export function moduleRoutes(registered: readonly RouteOptions[]): RouteOptions[] {
  return registered.filter((route) => (DEVICES_OPERATIONS as readonly string[]).includes(String(route.config?.operationId)));
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
    // No JSON body: a 204.
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

// ── Database tests: the booted server on a clone ───────────────────────────────────────────────

export interface DevicesTarget extends IdentityTarget {
  ownerPool(): Pool;
}

export interface DevicesApp {
  readonly app: FastifyInstance;
  readonly identity: IdentityApp;
  readonly engine: EngineHost & EngineControl;
  /** The server clock of this app: it moves only when the test moves it. */
  readonly clock: ManualClock;
  readonly timer: ManualTimer;
  readonly log: CapturedLog;
  readonly database: CountingPool;
  readonly owner: Pool;
  /** Everything handed to `app.publish`, in order. */
  readonly publications: Publication[];
  /** The web sessions of the three seeded operators: the cookie header of each. */
  readonly sessions: Readonly<Record<OperatorRole, Headers>>;
  /** The length of the stored trail once the app has booted and the three operators signed in. */
  readonly rowsAtStart: number;
  /** A read of the web console: the cookie, no `Origin`. */
  get(role: OperatorRole | null, url: string): Promise<LightMyRequestResponse>;
  /** A command of the web console: the cookie and the web console `Origin`. */
  post(role: OperatorRole | null, url: string, payload?: InjectOptions['payload']): Promise<LightMyRequestResponse>;
  /** Advances the clock `stepMs` at a time, fires the timer after each step and waits for the tick's unit. */
  drive(ms: number, stepMs?: number): Promise<void>;
  /** The stored audit rows from position `from` on, as `dems_owner`. */
  since(from: number): Promise<AuditRow[]>;
  trailLength(): Promise<number>;
  stateChanges(): EngineStateChange[];
  meterFrames(): EngineMeterFrame[];
  /** The principal of a seeded operator, for `app.engine.command` in a test's own preparation. */
  principal(role: OperatorRole): Extract<Principal, { kind: 'OPERATOR' }>;
}

const USERNAME: Readonly<Record<OperatorRole, string>> = {
  INVESTIGATOR: OPERATORS[0]!.username,
  SUPERVISOR: OPERATORS[1]!.username,
  TECHNICIAN: OPERATORS[2]!.username,
};

/**
 * The real app on a clone of the seed, booted: the engine is rehydrated and RUNS on a manual
 * timer, so it ticks exactly when a test fires it. The three seeded operators are signed in on
 * the web console. Every count a test makes is relative to `rowsAtStart`: the first start on a
 * fresh seed writes a row of its own, and each sign-in writes one.
 */
export async function devicesApp(target: DevicesTarget): Promise<DevicesApp> {
  const database = countingPool();
  const identity = await identityApp(target, { createPool: database.factory });
  const { app, clock, log } = identity;
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
    INVESTIGATOR: (await signInOnWeb(identity, USERNAME.INVESTIGATOR)).cookie,
    SUPERVISOR: (await signInOnWeb(identity, USERNAME.SUPERVISOR)).cookie,
    TECHNICIAN: (await signInOnWeb(identity, USERNAME.TECHNICIAN)).cookie,
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
      app.inject({ method: 'POST', url, headers: { ...headers(role), origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) }),
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
    meterFrames: () => publications.flatMap((publication) => (publication.kind === 'meters' ? [publication.frame] : [])),
    principal(role) {
      const operator = engine.slice('operators').find((candidate) => candidate.role === role);
      if (operator === undefined) throw new Error(`no operator with role ${role}`);
      return { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'test-preparation', deviceId: null, role, permissions: ROLE_PERMISSIONS[role] };
    },
  };
}

export type { DevicesOperation };
