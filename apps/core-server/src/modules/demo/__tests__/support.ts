/**
 * Test support of the demo-control module (plan row W43; not a test file). Other rows may import
 * it.
 *
 *   recording host   the `ResetHost` of `reset.ts` as a stand-in that writes down, in order, what
 *                    a reset asked of the server, and that can be made to fail at any member;
 *   unit app         the real app factory with no database: a principal the test chooses behind
 *                    stage 4, the REAL access rule (stage 6), a recording stand-in behind the seam
 *                    `engine`, a pool that answers the two reads of the module;
 *   database app     the real app factory on a clone of the seed, as `dems_app`, with EVERY stage
 *                    as the server has it, the engine BOOTED on a manual clock and a manual timer,
 *                    the three seeded operators signed in on the web console.
 *
 * WHICH DATABASE A TEST RESETS. Only a clone the test helper created for the test's own run. The
 * routine's name guard refuses such a name unless the seam `testRunPrefix` of the routine names
 * that run; `testRoutine` below is the one place of this folder that sets it, and it reaches the
 * module through `demoControl(app).replace`, which nothing of the server calls. `dems_demo` and
 * the lanes are never named here.
 *
 * No credential is printed: a session cookie is taken from an answer and handed on in a header;
 * the connection files are read by the helper and by the routine themselves.
 */
import { CORE_API_OPERATIONS, type CoreApiRegistryOperation } from '@dems/shared/api';
import {
  DEFAULT_SEED,
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  ROLE_PERMISSIONS,
  buildScenarioState,
  createIdleState,
  createManualClock,
  type AuditRow,
  type OperatorRole,
  type Permission,
  type ScenarioName,
  type SimState,
} from '@dems/shared/sim';
import type { FastifyBaseLogger, FastifyInstance, InjectOptions, LightMyRequestResponse, RouteOptions } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../../app';
import type { DatabaseConnection } from '../../../config';
import { readTrail } from '../../../../test/support/core';
import { pickDurable, type DurableSlices } from '../../../db/mapping';
import { ResetError, resetDatabase, type ResetCheckpoint, type ResetErrorCode, type ResetOptions, type ResetReport, type ResetStep } from '../../../db/reset';
import { PATIENT_MS, sessionsOf } from '../../../../test/support/reset';
import { engineControl, type EngineControl, type EngineHost, type EngineStateChange } from '../../../engine';
import { countingPool, manualTimer, type CountingPool, type ManualTimer } from '../../../../test/support/engine';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import type { ErrorLogEntry } from '../../../plugins/logger';
import type { Publication } from '../../../realtime';
import { CLOCK_START, WEB_ORIGIN, cookieValue, webSignIn, type Headers, type ManualClock } from '../../../../test/support/identity';
import { DEMO_MODULE_OPERATIONS, demoControl, type GrantRow, type OperatorRoleRow, type ResetHost, type ResetRoutine } from '../index';

export const STATUS = '/api/v1/demo/status';
export const SCENARIO = '/api/v1/demo/scenario';
export const FAULTS = '/api/v1/demo/faults';
export const FAULTS_CLEAR = '/api/v1/demo/faults/clear';
export const RESET = '/api/v1/demo/reset';

/** Method and URL of each operation of the module, with a body the schema stage accepts. */
export const CALLS = [
  { operationId: 'getDemoStatus', method: 'GET', url: STATUS, payload: undefined },
  { operationId: 'loadScenario', method: 'POST', url: SCENARIO, payload: { name: 'recording' } },
  { operationId: 'injectFault', method: 'POST', url: FAULTS, payload: { kind: 'MIC_NO_SIGNAL' } },
  { operationId: 'clearFault', method: 'POST', url: FAULTS_CLEAR, payload: { kind: 'MIC_NO_SIGNAL' } },
  { operationId: 'resetDemo', method: 'POST', url: RESET, payload: undefined },
] as const;

export const ROLES = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const satisfies readonly OperatorRole[];
export const SUPERVISOR_ID = 'OPR-002';

/** The registry entries of operations 71 to 75, in registry order. */
export function registryEntries(): CoreApiRegistryOperation[] {
  return CORE_API_OPERATIONS.filter((operation) => (DEMO_MODULE_OPERATIONS as readonly string[]).includes(operation.operationId));
}

/** The operation number the registry entry names in its `source`. */
export function operationNumber(operation: CoreApiRegistryOperation): number | null {
  const found = /operation (\d+)/.exec(operation.source);
  return found?.[1] === undefined ? null : Number(found[1]);
}

/** `METHOD /path operationId`: how the gate prints a route and a registry entry. */
export const signature = (method: string, path: string, operationId: string): string => `${method.toUpperCase()} ${path} ${operationId}`;

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

// ── A report of the routine ────────────────────────────────────────────────────────────────────

const NO_STEP_MS: Record<ResetStep, number> = { 'R-0': 0, 'R-1': 0, 'R-2': 0, 'R-3': 0, 'R-4': 0, 'R-5': 0, 'R-6': 0, 'R-7': 0, 'R-8': 0, 'R-9': 0 };

/** A report as the routine resolves with, for a stand-in routine. */
export function reportOf(overrides: Partial<ResetReport> = {}): ResetReport {
  return {
    database: 'dems_demo',
    role: 'dems_owner',
    serverVersion: '18.4',
    firstBuild: false,
    now: CLOCK_START,
    scenario: 'idle',
    reason: 'RESET',
    actorId: SUPERVISOR_ID,
    previousEpoch: 4,
    epoch: 5,
    kept: {},
    cancelledPairingCodes: 0,
    operatorsWithSignIn: 0,
    lineage: { carried: 0, appended: null, total: 1 },
    scenarioLoadedSeq: 83,
    auditHead: { seq: 83, hash: 'a'.repeat(64) },
    counts: {},
    leftoversRemoved: [],
    previousDropped: true,
    stepMs: NO_STEP_MS,
    totalMs: 0,
    ...overrides,
  };
}

/** A failure of the routine, as it rejects with. */
export function resetError(code: ResetErrorCode, step: ResetStep, targetUntouched = true): ResetError {
  return new ResetError(code, step, `${step}: ${code} (a stand-in of the test)`, { targetUntouched });
}

// ── A recording logger ─────────────────────────────────────────────────────────────────────────

export interface LoggedLine {
  readonly level: string;
  readonly fields: Record<string, unknown>;
  readonly text: string;
}

export interface RecordingLogger {
  readonly log: FastifyBaseLogger;
  readonly lines: LoggedLine[];
}

/** A logger that keeps what it was given, as it was given: the object and the text of each call. */
export function recordingLogger(onLine: (line: LoggedLine) => void = () => undefined): RecordingLogger {
  const lines: LoggedLine[] = [];
  const at = (level: string) => (fields: Record<string, unknown>, text: string) => {
    const line = { level, fields, text };
    lines.push(line);
    onLine(line);
  };
  const log = { trace: at('trace'), debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error'), fatal: at('fatal'), level: 'trace' };
  return { log: log as unknown as FastifyBaseLogger, lines };
}

// ── The recording host ─────────────────────────────────────────────────────────────────────────

export type HostMember = 'drain' | 'operatorRoles' | 'stopEngine' | 'closePool' | 'reopenPool' | 'bootChecks' | 'reloadMatrix' | 'reloadEngine' | 'resyncEngine';

export interface RecordingHost {
  readonly host: ResetHost;
  /** What the reset asked of the server, in order. */
  readonly trace: string[];
  readonly publications: Publication[];
  readonly persisted: ErrorLogEntry[];
  /** The options of every call of the routine. */
  readonly calls: ResetOptions[];
  /** Holds that were taken and not released. */
  heldNow(): number;
  /** A member that rejects with the value given, once it is called. */
  readonly failing: Partial<Record<HostMember, unknown>>;
  /** What the routine does once it was called. */
  routine: ResetRoutine;
  /**
   * The engine's epoch. `reloadEngine` sets it to `epochAfterReload` (what the routine wrote into
   * the rebuilt database) when that is a number; `resyncEngine` adds 1 to it, as the engine's
   * resync start does with the stored epoch.
   */
  epoch: number;
  epochAfterReload: number | null;
  now: number;
  /** What the operators table holds: read once in the quiesce, once after the resume. */
  roles: OperatorRoleRow[];
  /** What the operators table holds from the reopened pool on; null: the same as before. */
  rolesAfterReopen: OperatorRoleRow[] | null;
  grants: GrantRow[];
}

export const SEED_ROLES: OperatorRoleRow[] = [
  { id: 'OPR-001', role: 'INVESTIGATOR' },
  { id: 'OPR-002', role: 'SUPERVISOR' },
  { id: 'OPR-003', role: 'TECHNICIAN' },
];

/** The stored grants in the order of the stored matrix: by role, then by permission, as the shared table lists them. */
export function sharedGrants(): GrantRow[] {
  return ROLES.flatMap((role) => ROLE_PERMISSIONS[role].map((permission: Permission) => ({ role, permission })));
}

/**
 * A routine that behaves as the real one does towards its caller: it announces R-0, calls the
 * quiesce at R-1 and turns a quiesce that throws into `RESET_QUIESCE_FAILED`, reads the clock
 * once after the quiesce, then resolves with a report or rejects with what the test gives it.
 */
export function standInRoutine(
  trace: string[],
  script: { readonly refuse?: unknown; readonly fail?: unknown; readonly report?: Partial<ResetReport>; readonly beforeQuiesce?: () => Promise<void> | void } = {},
): ResetRoutine {
  return async (options) => {
    trace.push('routine:R-0');
    if (script.refuse !== undefined) throw script.refuse;
    await script.beforeQuiesce?.();
    trace.push('routine:R-1');
    try {
      await options.quiesce?.();
    } catch {
      throw resetError('RESET_QUIESCE_FAILED', 'R-1');
    }
    const now = options.clock?.() ?? 0;
    trace.push(`routine:clock ${now}`);
    trace.push('routine:R-2..R-8');
    if (script.fail !== undefined) throw script.fail;
    trace.push('routine:R-9');
    return reportOf({ now, scenario: options.scenario ?? 'idle', reason: options.reason ?? 'RESET', actorId: options.actorId ?? null, ...script.report });
  };
}

export function recordingHost(): RecordingHost {
  const trace: string[] = [];
  const publications: Publication[] = [];
  const persisted: ErrorLogEntry[] = [];
  const calls: ResetOptions[] = [];
  let held = 0;
  let reopened = false;

  const step = async <T>(member: HostMember, name: string, value: () => T): Promise<T> => {
    trace.push(name);
    if (member in recording.failing) throw recording.failing[member];
    return value();
  };

  const recording: RecordingHost = {
    trace,
    publications,
    persisted,
    calls,
    heldNow: () => held,
    failing: {},
    routine: standInRoutine(trace),
    epoch: 4,
    epochAfterReload: 5,
    now: CLOCK_START,
    roles: SEED_ROLES.map((row) => ({ ...row })),
    rolesAfterReopen: null,
    grants: sharedGrants(),
    host: {
      database: 'dems_demo',
      dataDir: '/nonexistent/dems-unit-test-data',
      now: () => recording.now,
      epoch: () => recording.epoch,
      routine: (options) => {
        calls.push(options);
        return recording.routine(options);
      },
      hold: () => {
        trace.push('hold');
        held += 1;
        let released = false;
        return () => {
          if (released) return;
          released = true;
          held -= 1;
          trace.push('release');
        };
      },
      drain: () => step('drain', 'drain', () => undefined),
      operatorRoles: () => step('operatorRoles', 'roles', () => (reopened && recording.rolesAfterReopen !== null ? recording.rolesAfterReopen : recording.roles)),
      stopEngine: () => step('stopEngine', 'engine.stop', () => undefined),
      closePool: () => step('closePool', 'pool.close', () => undefined),
      reopenPool: () =>
        step('reopenPool', 'pool.reopen', () => {
          reopened = true;
        }),
      bootChecks: () => step('bootChecks', 'boot.checks', () => undefined),
      reloadMatrix: () => step('reloadMatrix', 'rbac.matrix', () => recording.grants),
      reloadEngine: () =>
        step('reloadEngine', 'engine.reload', () => {
          if (recording.epochAfterReload !== null) recording.epoch = recording.epochAfterReload;
        }),
      resyncEngine: () =>
        step('resyncEngine', 'engine.resync', () => {
          recording.epoch += 1;
        }),
      publish: (publication) => {
        publications.push(publication);
        trace.push(`publish:${publication.kind}`);
      },
      persist: (entry) => void persisted.push(entry),
    },
  };
  return recording;
}

// ── States ─────────────────────────────────────────────────────────────────────────────────────

/** The fixed instant the shared suites use: 2026-10-01 10:00:00 WIB. */
export const FIXED_NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
export const TICK_MS = 50;

/** The whole simulator state of a scenario at `now`, as the shared builders make it. */
export function scenarioState(name: ScenarioName, now: number = FIXED_NOW): SimState {
  return buildScenarioState(name, createIdleState({ now, seed: DEFAULT_SEED }));
}

/** What `app.engine.state()` would return for a simulator state: its durable slices. */
export function committedOf(state: SimState): DurableSlices {
  return pickDurable(state);
}

// ── Unit tests: the app without a database ─────────────────────────────────────────────────────

export interface RecordedCommand {
  readonly principal: Principal;
  readonly action: string;
  readonly args: readonly unknown[];
}

/** A stand-in behind the seam `engine`: a committed state, the commands, and `stop`, `reload` and a resync start written down. */
export interface EngineDouble {
  readonly host: EngineHost;
  readonly commands: RecordedCommand[];
  /** `engine.stop`, `engine.reload` and `engine.resync` (a start in that mode), in the order they were called. */
  readonly lifecycle: string[];
  state: DurableSlices;
  epoch: number;
  revision: number;
  /** When set, the next command rejects with it (and it is cleared). */
  refuseWith: unknown;
  running: boolean;
  /** What `state()` and `command()` throw while not running. */
  notRunning: unknown;
}

export function engineDouble(state: DurableSlices, onLifecycle: (name: string) => void = () => undefined): EngineDouble {
  const unused = (member: string) => (): never => {
    throw new Error(`the demo-control module must not call engine.${member}`);
  };
  const double: EngineDouble = {
    commands: [],
    lifecycle: [],
    state,
    epoch: 7,
    revision: 41,
    refuseWith: undefined,
    running: true,
    notRunning: new Error('the engine double is not running'),
    host: {
      get epoch() {
        return double.epoch;
      },
      get revision() {
        return double.revision;
      },
      get running() {
        return double.running;
      },
      state() {
        if (!double.running) throw double.notRunning;
        return double.state;
      },
      slice(name) {
        if (!double.running) throw double.notRunning;
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
        double.revision += 1;
        return { value: undefined, epoch: double.epoch, revision: double.revision };
      }) as EngineHost['command'],
      run: unused('run'),
      setTabletLink: unused('setTabletLink'),
      mirrorOperators: unused('mirrorOperators'),
      start: async (mode) => {
        // The one start a reset may ask for: a resync, the stored epoch plus 1. Never a process start.
        if (mode !== 'resync') throw new Error(`the demo-control module must not call engine.start('${mode}')`);
        double.lifecycle.push('engine.resync');
        onLifecycle('engine.resync');
        double.running = true;
        double.epoch += 1;
        double.revision = 0;
      },
      reload: async () => {
        double.lifecycle.push('engine.reload');
        onLifecycle('engine.reload');
        double.running = true;
        double.revision = 0;
      },
      stop: async () => {
        // The close hooks of the app stop the engine too: only a stop of a running engine counts.
        if (!double.running) return;
        double.lifecycle.push('engine.stop');
        onLifecycle('engine.stop');
        double.running = false;
      },
      meters: () => null,
      stats: unused('stats'),
    },
  };
  return double;
}

/** What the stand-in pool of a unit app answers: the module's two reads, and nothing else. */
export interface PoolScript {
  /** The row of `core_state` operation 71 reads; null: no row. */
  seedFacts: { seeded_at: string; last_reset_at: string | null } | null;
  operators: OperatorRoleRow[];
  /** When set, every statement rejects with it. */
  failWith: unknown;
}

export interface UnitApp {
  readonly app: FastifyInstance;
  /** Every route the units registered, in order. */
  readonly registered: RouteOptions[];
  readonly log: CapturedLog;
  readonly engine: EngineDouble;
  /** Every statement the app sent to its (stand-in) pools. */
  readonly queries: string[];
  /** Pools built (1 after `ready()`, one more per reopen) and pools ended. */
  readonly pools: { built: number; ended: number };
  readonly script: PoolScript;
  /** What happened, in order, across the engine double, the pools and the parts a test replaced. */
  readonly trace: string[];
  /** The principal stage 4 gives the next requests. */
  actAs(principal: Principal): void;
}

export const ANONYMOUS: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };

/** An OPERATOR principal as stage 4 builds it, with the permissions the test names (default: the role's). */
export function operatorOf(role: OperatorRole, permissions: readonly Permission[] = ROLE_PERMISSIONS[role]): Extract<Principal, { kind: 'OPERATOR' }> {
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
  return { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'unit-test-session', deviceId: null, role, permissions };
}

/**
 * The real app factory with no database. Stage 4 is a stand-in that hands out the principal the
 * test chose; stage 6 is the REAL access rule; the engine is the double; the pool answers the
 * module's two reads. Close it with `app.close()`.
 */
export async function unitApp(options: { demoControls: boolean; state?: DurableSlices; withoutAccessRule?: boolean }): Promise<UnitApp> {
  const log = captureLog();
  const queries: string[] = [];
  const pools = { built: 0, ended: 0 };
  const trace: string[] = [];
  const script: PoolScript = { seedFacts: { seeded_at: String(FIXED_NOW), last_reset_at: null }, operators: SEED_ROLES.map((row) => ({ ...row })), failWith: undefined };

  const createPool = (): Pool => {
    pools.built += 1;
    if (pools.built > 1) trace.push('pool.reopen');
    const pool = {
      async query(query: string | { text: string }) {
        const text = typeof query === 'string' ? query : query.text;
        queries.push(text);
        if (script.failWith !== undefined) throw script.failWith;
        if (text.includes('FROM public.core_state')) return { rows: script.seedFacts === null ? [] : [script.seedFacts] };
        if (text.includes('FROM public.operators')) {
          trace.push('roles');
          return { rows: script.operators };
        }
        return { rows: [] };
      },
      on: () => pool,
      async end() {
        pools.ended += 1;
        trace.push('pool.close');
      },
    };
    return pool as unknown as Pool;
  };

  const app = buildApp({ config: unitTestConfig({ logLevel: 'info', demoControls: options.demoControls }), createPool, logStream: log.stream });
  const registered: RouteOptions[] = [];
  // Before the units load: every route they add is seen.
  app.addHook('onRoute', (route) => void registered.push(route));
  let current: Principal = ANONYMOUS;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  // Only for the test of what a handler does when stage 6 did not run: a defect of the server.
  if (options.withoutAccessRule === true) app.stages.replace('accessRule', () => undefined);
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  // The server clock of the app: it moves only when a test moves it.
  app.seams.replace('clock', createManualClock(CLOCK_START));
  const engine = engineDouble(options.state ?? committedOf(scenarioState('idle')), (name) => void trace.push(name));
  app.seams.replace('engine', engine.host);
  // The real pipeline, with its drain written down.
  const pipeline = app.pipeline;
  app.seams.replace('pipeline', {
    ...pipeline,
    drain: () => {
      trace.push('drain');
      return pipeline.drain();
    },
  });
  return { app, registered, log, engine, queries, pools, script, trace, actAs: (principal) => void (current = principal) };
}

/** The routes of this module among the registered ones: those that name one of its operations. */
export function moduleRoutes(registered: readonly RouteOptions[]): RouteOptions[] {
  return registered.filter((route) => (DEMO_MODULE_OPERATIONS as readonly string[]).includes(String(route.config?.operationId)));
}

// ── Database tests: the booted server on a clone ───────────────────────────────────────────────

export interface DemoTarget {
  /** The clone's name. */
  readonly name: string;
  /** Role `dems_app` on the clone. */
  readonly runtime: DatabaseConnection;
  ownerPool(): Pool;
}

export interface DemoAppOptions {
  readonly demoControls: boolean;
  /** The directory the configuration names for the connection files. */
  readonly dataDir: string;
}

/**
 * Every statement the runtime role sends, in order: `read: …` for a statement on the pool itself
 * (a read outside a unit of work, a probe, a boot check), `unit: …` for one on a connection that
 * a unit of work checked out. Text only, never a parameter.
 */
function recordingFactory(inner: (connection: DatabaseConnection) => Pool, sql: string[]): (connection: DatabaseConnection) => Pool {
  const textOf = (query: unknown): string => (typeof query === 'string' ? query : typeof query === 'object' && query !== null && 'text' in query ? String(query.text) : '<no text>');
  const recorded = <T extends object>(target: T, kind: 'read' | 'unit'): T =>
    new Proxy(target, {
      get(object, property, receiver) {
        const value: unknown = Reflect.get(object, property, receiver);
        if (typeof value !== 'function') return value;
        const method = value as (...parameters: unknown[]) => unknown;
        if (property === 'query') {
          return (...parameters: unknown[]) => {
            sql.push(`${kind}: ${textOf(parameters[0])}`);
            return method.apply(object, parameters);
          };
        }
        if (property === 'connect' && kind === 'read') {
          return async (...parameters: unknown[]) => recorded((await method.apply(object, parameters)) as object, 'unit');
        }
        return method.bind(object);
      },
    });
  return (connection) => recorded(inner(connection), 'read');
}

export interface DemoApp {
  readonly app: FastifyInstance;
  /** Every statement of the runtime role, in order (see `recordingFactory`). */
  readonly sql: string[];
  readonly engine: EngineHost & EngineControl;
  /** The server clock of this app: it moves only when the test moves it. */
  readonly clock: ManualClock;
  readonly timer: ManualTimer;
  readonly log: CapturedLog;
  readonly database: CountingPool;
  /** Everything handed to `app.publish`, in order. */
  readonly publications: Publication[];
  /** The web sessions of the three seeded operators: the cookie header of each. */
  readonly sessions: Readonly<Record<OperatorRole, Headers>>;
  /** A read of the web console: the cookie, no `Origin`. */
  get(role: OperatorRole | null, url: string): Promise<LightMyRequestResponse>;
  /** A command of the web console: the cookie and the web console `Origin`. */
  post(role: OperatorRole | null, url: string, payload?: InjectOptions['payload']): Promise<LightMyRequestResponse>;
  /** Any of the five operations, as `CALLS` lists it. */
  call(role: OperatorRole | null, call: (typeof CALLS)[number]): Promise<LightMyRequestResponse>;
  /** Advances the clock `stepMs` at a time, fires the timer after each step and waits for the tick's unit. */
  drive(ms: number, stepMs?: number): Promise<void>;
  stateChanges(): EngineStateChange[];
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
 * the web console. The caller closes the app (`await app.close()`) BEFORE its database is
 * dropped; it is not registered with the test helper, because the helper would then close it
 * together with the test's own pools.
 */
export async function demoApp(target: DemoTarget, options: DemoAppOptions): Promise<DemoApp> {
  const log = captureLog();
  const database = countingPool();
  const sql: string[] = [];
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: options.dataDir, logLevel: 'debug', port: 4420, demoControls: options.demoControls }),
    logStream: log.stream,
    createPool: recordingFactory(database.factory, sql),
  });
  await app.ready();
  const clock = createManualClock(CLOCK_START);
  app.seams.replace('clock', clock);
  const publications: Publication[] = [];
  app.seams.replace('publish', (publication) => void publications.push(publication));
  const engine = engineControl(app);
  const timer = manualTimer();
  engine.useTimer(timer.timer);
  await app.readiness.boot();
  await engine.idle();
  await app.pipeline.drain();

  const signIn = async (role: OperatorRole): Promise<Headers> => {
    const response = await webSignIn(app, USERNAME[role], DEMO_OPERATOR_PASSWORD);
    if (response.statusCode !== 200) throw new Error(`the sign-in of the seeded ${role} answered ${response.statusCode}`);
    const token = cookieValue(response, app.config.sessionCookieName);
    if (token === null) throw new Error('the web sign-in set no session cookie');
    return { cookie: `${app.config.sessionCookieName}=${token}` };
  };
  const sessions: Record<OperatorRole, Headers> = {
    INVESTIGATOR: await signIn('INVESTIGATOR'),
    SUPERVISOR: await signIn('SUPERVISOR'),
    TECHNICIAN: await signIn('TECHNICIAN'),
  };
  await app.pipeline.drain();
  const headers = (role: OperatorRole | null): Headers => (role === null ? {} : sessions[role]);
  const get: DemoApp['get'] = (role, url) => app.inject({ method: 'GET', url, headers: headers(role) });
  const post: DemoApp['post'] = (role, url, payload) =>
    app.inject({ method: 'POST', url, headers: { ...headers(role), origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) });

  return {
    app,
    sql,
    engine,
    clock,
    timer,
    log,
    database,
    publications,
    sessions,
    get,
    post,
    call: (role, call) => (call.method === 'GET' ? get(role, call.url) : post(role, call.url, call.payload)),
    async drive(ms, stepMs = TICK_MS) {
      for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
        clock.advance(stepMs);
        timer.fire();
        await engine.idle();
      }
    },
    stateChanges: () => publications.flatMap((publication) => (publication.kind === 'state' ? [publication.change] : [])),
    principal(role) {
      const operator = OPERATORS.find((candidate) => candidate.role === role);
      if (operator === undefined) throw new Error(`no operator with role ${role}`);
      return { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'test-preparation', deviceId: null, role, permissions: ROLE_PERMISSIONS[role] };
    },
  };
}

/** The stored audit rows of a database, read as `dems_owner`. */
export async function trailOf(pool: Pool): Promise<AuditRow[]> {
  return readTrail(pool);
}

// ── The routine of a database test ─────────────────────────────────────────────────────────────

/** What a database test needs of the helper's handle of the database it resets. */
export interface ResettableDatabase {
  readonly name: string;
  /** Closes the pools the helper handed out on this database (and what was registered with it). */
  closeResources(): Promise<unknown>;
}

export interface TestRoutineOptions {
  /** The prefix of the test's own run: the routine then accepts a per-file database of that run. */
  readonly runPrefix: string;
  /** `application_name` of the routine's connections: unique to the run and the file (finding F63). */
  readonly applicationName: string;
  /** A pool of `dems_owner` on the maintenance database, of the test itself. */
  readonly maintenance: Pool;
  /** Called at each checkpoint of the routine, in order. If it throws, that part counts as failed. */
  readonly onCheckpoint?: (checkpoint: ResetCheckpoint) => Promise<void> | void;
  /** Called with the report after the routine resolved; what it throws is what the caller sees. */
  readonly afterResolve?: (report: ResetReport) => Promise<void> | void;
  /** The routine's wait for sessions to end. Default: patient; a test that holds a session on purpose passes a short one. */
  readonly sessionDrainMs?: number;
  /** Leaves the test's own pools on the target open: for the test that holds a session on purpose. */
  readonly keepTestPools?: boolean;
}

/** The `application_name` of the server's runtime pool (`SERVICE_NAME` of the configuration). */
const SERVER_APPLICATION = 'dems-core-server';

/**
 * Polls until the only sessions the server lists on the database are those of the app under test.
 * The test's own pools on it were closed by then; the driver reports "ended" before the server
 * has dropped the backend, so this asks the server, and asks again (finding F63, lesson 2).
 */
export async function untilOnlyServerSessions(maintenance: Pool, database: string, capMs: number = PATIENT_MS): Promise<void> {
  const started = Date.now();
  let pause = 10;
  for (;;) {
    const others = (await sessionsOf(maintenance, { databases: [database] })).filter((row) => !(row.role === 'dems_app' && row.application === SERVER_APPLICATION));
    if (others.length === 0) return;
    const waited = Date.now() - started;
    if (waited >= capMs) {
      const who = [...new Set(others.map((row) => `role ${row.role}, application ${row.application === '' ? '(none)' : row.application}`))].join('; ');
      throw new Error(`sessions of the test on ${database}: still connected after ${waited} ms: ${who}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pause));
    pause = Math.min(pause * 2, 250);
  }
}

/**
 * The routine of `src/db/reset` for a database test: the REAL routine, with the seam that
 * accepts a database of the test's own run. Before it calls the routine it closes the test's own
 * pools on the target and waits until the server lists none of them: the routine refuses a
 * database that is in use and ends nobody's session, and a fixture pool of the test is a session
 * too.
 */
export function testRoutine(target: ResettableDatabase, options: TestRoutineOptions): ResetRoutine {
  return async (routineOptions) => {
    if (routineOptions.database !== target.name) throw new Error('refused: a test resets only the database it was given by the helper');
    if (options.keepTestPools !== true) {
      await target.closeResources();
      await untilOnlyServerSessions(options.maintenance, target.name);
    }
    const report = await resetDatabase(
      {
        ...routineOptions,
        applicationName: options.applicationName,
        sessionDrainMs: options.sessionDrainMs ?? PATIENT_MS,
        ...(options.onCheckpoint === undefined ? {} : { onCheckpoint: (checkpoint: ResetCheckpoint) => options.onCheckpoint?.(checkpoint) }),
      },
      { testRunPrefix: options.runPrefix },
    );
    await options.afterResolve?.(report);
    return report;
  };
}

/** Puts a routine of the test behind the module's reset, for this app. */
export function useRoutine(app: FastifyInstance, routine: ResetRoutine): void {
  demoControl(app).replace({ routine });
}
