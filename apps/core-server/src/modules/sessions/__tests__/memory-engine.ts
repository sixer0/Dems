/**
 * Test support of the sessions module for the `unit` project (plan row W34; not a test file).
 *
 *   memory engine   a stand-in for the seam `app.engine` that needs no database: the shared
 *                   simulator itself, headless on a manual clock (the seed row's `createHost`),
 *                   behind the engine host's interface. A hosted action is the simulator's own
 *                   action, run as the caller; a refusal it throws is mapped by the engine's own
 *                   `simRefusal`; a unit that throws sets the state back. What it leaves out is
 *                   exactly what the real host adds: PostgreSQL, the audit chain's lock, the
 *                   publication. Those are the database tests' subject.
 *   unit app        the real app factory with the real stages 2, 3, 5, 6 and 7, a stand-in for
 *                   stage 4 (the caller is who the test says, with the permissions of its role)
 *                   and the core row's stand-in pool, which stores the guard's denial rows.
 */
import { ROLE_PERMISSIONS, type OperatorRole, type SimOperator, type SimState } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../../app';
import { standInDatabase, type StandInDatabase } from '../../../core/__tests__/support';
import { DURABLE_SLICE_KEYS, pickDurable, type DurableSliceKey, type DurableSlices } from '../../../db/mapping';
import { createHost, type Host } from '../../../../test/support/seed';
import { simRefusal, type EngineHost, type EngineOutcome, type EngineUnit, type HostedActionName } from '../../../engine';
import { ANONYMOUS_PRINCIPAL, type Principal } from '../../../plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { ApiFailure } from '../../../plugins/error-envelope';
import { WEB_ORIGIN } from '../../../../test/support/identity';

/** The fixed instant of the shared suites: 2026-10-01 10:00:00 WIB. */
export const NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
/** The epoch the memory engine names in every outcome. */
export const MEMORY_EPOCH = 3;

/** One hosted action that ran. */
export interface ActionCall {
  /** The label of the unit it ran in: `engine.<action>` for `command`, the module's label for `run`. */
  readonly unit: string;
  readonly action: HostedActionName;
  readonly args: readonly unknown[];
  readonly operatorId: string;
}

/** One unit of work, as it ended. */
export interface UnitRecord {
  readonly label: string;
  readonly committed: boolean;
  /** The hosted actions that ran in it, in order. */
  readonly actions: readonly HostedActionName[];
}

export interface MemoryEngine {
  /** What goes behind the seam: `app.seams.replace('engine', memory.engine)`. */
  readonly engine: EngineHost;
  /** The shared simulator behind it, on its manual clock. */
  readonly host: Host;
  readonly calls: ActionCall[];
  readonly units: UnitRecord[];
  /** Makes the next unit fail before it runs, as a database that does not answer does. */
  failNextUnit(error: Error): void;
  /** Runs a hosted action as the operator of a role, outside any request: a test's set-up. */
  act<Value>(role: OperatorRole, work: (actions: Host['sim']['actions']) => Value): Value;
  readonly session: SimState['session'];
}

function durableChanged(before: SimState, after: SimState): boolean {
  return DURABLE_SLICE_KEYS.some((key) => before[key] !== after[key]);
}

export async function memoryEngine(): Promise<MemoryEngine> {
  const host = await createHost({ scenario: 'idle', startAt: NOW });
  const calls: ActionCall[] = [];
  const units: UnitRecord[] = [];
  let revision = 0;
  let failure: Error | null = null;
  let running = true;

  const operatorOf = (principal: Principal): SimOperator => {
    if (principal.kind !== 'OPERATOR') throw new ApiFailure(401, 'NOT_SIGNED_IN', 'Sign in to continue.');
    const operator = host.state().operators.find((candidate) => candidate.id === principal.operatorId);
    if (operator === undefined) throw new Error(`the memory engine has no operator ${principal.operatorId}`);
    return operator;
  };

  /** One hosted action as the caller: the simulator's own action, its refusal mapped as the host maps it. */
  function perform(unit: string, ran: HostedActionName[], principal: Principal, action: HostedActionName, args: readonly unknown[]): unknown {
    const operator = operatorOf(principal);
    calls.push({ unit, action, args, operatorId: operator.id });
    ran.push(action);
    const run = host.sim.actions[action] as (...parameters: readonly unknown[]) => unknown;
    try {
      return host.runAs(operator, () => run(...args));
    } catch (error) {
      throw simRefusal(error) ?? error;
    }
  }

  /** One unit: all or nothing, as the host's (ENG-5). */
  async function inUnit<Value>(label: string, work: (ran: HostedActionName[]) => Promise<Value> | Value): Promise<EngineOutcome<Value>> {
    if (!running) throw notReady();
    const before = host.sim.store.getState();
    const ran: HostedActionName[] = [];
    try {
      if (failure !== null) {
        const thrown = failure;
        failure = null;
        throw thrown;
      }
      const value = await work(ran);
      if (durableChanged(before, host.sim.store.getState())) revision += 1;
      units.push({ label, committed: true, actions: ran });
      return { value, epoch: MEMORY_EPOCH, revision };
    } catch (error) {
      host.sim.store.setState(before, true);
      units.push({ label, committed: false, actions: ran });
      throw error;
    }
  }

  const notReady = (): ApiFailure => new ApiFailure(503, 'NOT_READY', 'The server is not ready. Try again shortly.');
  /** The committed state: 503 while the engine does not run, as the host's `state()`. */
  const state = (): DurableSlices => {
    if (!running) throw notReady();
    return pickDurable(host.state());
  };
  const unsupported = (name: string) => (): never => {
    throw new Error(`the memory engine has no ${name}: the sessions module must not call it`);
  };

  const engine: EngineHost = {
    get epoch() {
      return MEMORY_EPOCH;
    },
    get revision() {
      return revision;
    },
    get running() {
      return running;
    },
    command: (principal, action, ...args) =>
      inUnit(`engine.${action}`, (ran) => perform(`engine.${action}`, ran, principal, action, args)) as Promise<EngineOutcome<never>>,
    run: (label, work) =>
      inUnit(label, (ran) => {
        const scope: EngineUnit = {
          // The module owns no row of its own: it must not reach for the unit's writers.
          get unit(): never {
            throw new Error('the sessions module must not use the unit of work itself');
          },
          command: async (principal, action, ...args) => perform(label, ran, principal, action, args) as never,
          pending: () => pickDurable(host.state()),
        };
        return work(scope);
      }),
    setTabletLink: unsupported('setTabletLink'),
    mirrorOperators: unsupported('mirrorOperators'),
    state,
    slice: <Key extends DurableSliceKey>(name: Key): DurableSlices[Key] => state()[name],
    start: unsupported('start'),
    reload: unsupported('reload'),
    async stop() {
      running = false;
    },
    meters: () => null,
    stats: unsupported('stats'),
  };

  return {
    engine,
    host,
    calls,
    units,
    failNextUnit(error) {
      failure = error;
    },
    act: (role, work) => host.runAs(host.operator(role), () => work(host.sim.actions)),
    get session() {
      return host.state().session;
    },
  };
}

// ── The app ────────────────────────────────────────────────────────────────────────────────────

export interface UnitApp {
  readonly app: FastifyInstance;
  readonly memory: MemoryEngine;
  readonly database: StandInDatabase;
  readonly log: CapturedLog;
  /** Who the next requests come from: the seeded operator of a role, or nobody. */
  actAs(caller: OperatorRole | null): void;
  /** A POST of the web console as the current caller. A string is sent as the raw body. */
  post(url: string, payload?: object | string): Promise<LightMyRequestResponse>;
  get(url: string): Promise<LightMyRequestResponse>;
  close(): Promise<void>;
}

export interface UnitAppOptions {
  /** Called with the app before `ready()`: a test that records the registered routes. */
  readonly beforeReady?: (app: FastifyInstance) => void;
  /** Replaces the stand-in pool: a test of a read that fails. */
  readonly pool?: Pool;
  /** File of the persistent error log. Default: none. */
  readonly errorLogFile?: string;
}

/**
 * The real app factory, ready, with the memory engine behind the seam and the server clock
 * following the simulator's manual clock. Stage 4 is a stand-in; every other stage is real.
 */
export async function unitApp(options: UnitAppOptions = {}): Promise<UnitApp> {
  const memory = await memoryEngine();
  const log = captureLog();
  const database = standInDatabase();
  const app = buildApp({
    config: unitTestConfig({ logLevel: 'info' }),
    createPool: () => options.pool ?? database.pool,
    logStream: log.stream,
    ...(options.errorLogFile === undefined ? {} : { errorLogFile: options.errorLogFile }),
  });
  options.beforeReady?.(app);
  let current: Principal = ANONYMOUS_PRINCIPAL;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.seams.replace('engine', memory.engine);
  app.seams.replace('clock', { now: () => memory.host.now() });
  app.readiness.set('database', true);
  app.readiness.set('engine', true);

  return {
    app,
    memory,
    database,
    log,
    actAs(caller) {
      if (caller === null) {
        current = ANONYMOUS_PRINCIPAL;
        return;
      }
      current = {
        kind: 'OPERATOR',
        operatorId: memory.host.operator(caller).id,
        sessionId: `session-${caller}`,
        deviceId: null,
        role: caller,
        permissions: ROLE_PERMISSIONS[caller],
      };
    },
    post(url, payload) {
      return app.inject({
        method: 'POST',
        url,
        headers: { origin: WEB_ORIGIN, ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}) },
        ...(payload === undefined ? {} : { payload }),
      });
    },
    get(url) {
      return app.inject({ method: 'GET', url });
    },
    close: () => app.close(),
  };
}
