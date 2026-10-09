/**
 * Test support of the capture-config routes (blueprint row 66; not a test file).
 *
 * The real app factory with no database: a principal the test chooses behind stage 4, the REAL
 * access rule (stage 6), and behind the seam `engine` a stand-in that runs a unit the way the host
 * does, on a REAL shared simulator: `pending()` is the simulator's state, `command` runs the hosted
 * action under the caller's identity with the host's own actor scope and maps a refusal with the
 * host's own table (`simRefusal`), and a unit that throws sets the state back. So the routes are
 * tested against the action they host, not against a recording of its name.
 */
import { createManualClock, createSim, type ScenarioName, type Sim } from '@dems/shared/sim';
import type { FastifyInstance, RouteOptions } from 'fastify';
import { captureLog, createFakePool, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import { pickDurable, type DurableSlices } from '../../../db/mapping';
import type { EngineHost, EngineUnit } from '../../../engine';
import { withActorScope } from '../../../engine/actor-scope';
import { simRefusal } from '../../../engine/errors';
import type { Principal } from '../../../plugins/authenticate';
import { notReady } from '../../../plugins/error-envelope';
import { ANONYMOUS, FIXED_NOW } from '../../devices/__tests__/support';

export const CONFIG = '/api/v1/capture/config';
export const DEVICES = '/api/v1/capture/devices';
export const cameraSource = (id: string): string => `/api/v1/capture/cameras/${id}/source`;
export const primaryMic = (id: string): string => `/api/v1/capture/mics/${id}/primary`;
export const CREDENTIAL = '/api/v1/capture/devices/CAM-01/credential';

export interface RecordedCommand {
  readonly principal: Principal;
  readonly action: string;
  readonly args: readonly unknown[];
}

export interface SelectorEngine {
  readonly host: EngineHost;
  readonly sim: Sim;
  /** Every hosted action a unit called, in order. */
  readonly commands: RecordedCommand[];
  /** The labels of the units that were run. */
  readonly units: string[];
  running: boolean;
  /** The simulator's state: what `pending()` and `state()` are made of. */
  state(): ReturnType<Sim['store']['getState']>;
}

export const DOUBLE_EPOCH = 7;

function selectorEngine(scenario: ScenarioName): SelectorEngine {
  const clock = createManualClock(FIXED_NOW);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const unused = (member: string) => (): never => {
    throw new Error(`the capture-config module must not call engine.${member}`);
  };
  let revision = 41;
  const committed = (): DurableSlices => pickDurable(sim.store.getState());
  const double: SelectorEngine = {
    sim,
    commands: [],
    units: [],
    running: true,
    state: () => sim.store.getState(),
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
        if (!double.running) throw notReady();
        return committed();
      },
      slice(name) {
        if (!double.running) throw notReady();
        return committed()[name];
      },
      command: unused('command') as unknown as EngineHost['command'],
      async run(label, work) {
        if (!double.running) throw notReady();
        double.units.push(label);
        const before = sim.store.getState();
        const scope: EngineUnit = {
          unit: undefined as never,
          pending: committed,
          command: (async (principal: Principal, action: string, ...args: unknown[]) => {
            if (principal.kind !== 'OPERATOR') throw new Error('a hosted action needs an operator');
            double.commands.push({ principal, action, args });
            try {
              const run = sim.actions[action as keyof Sim['actions']] as (...parameters: unknown[]) => unknown;
              return withActorScope(sim.store, principal.operatorId, clock.now(), () => run(...args));
            } catch (error) {
              throw simRefusal(error) ?? error;
            }
          }) as EngineUnit['command'],
        };
        try {
          const value = await work(scope);
          if (committed().captureConfig !== pickDurable(before).captureConfig) revision += 1;
          return { value, epoch: DOUBLE_EPOCH, revision };
        } catch (error) {
          // ENG-5: the engine's state is set back when the unit is not committed.
          sim.store.setState(before, true);
          throw error;
        }
      },
      setTabletLink: unused('setTabletLink'),
      applyCaptureTelemetry: unused('applyCaptureTelemetry'),
      raiseCaptureWarning: unused('raiseCaptureWarning'),
      clearCaptureWarning: unused('clearCaptureWarning'),
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

export interface SelectorUnitApp {
  readonly app: FastifyInstance;
  /** Every route the units registered, in order. */
  readonly registered: RouteOptions[];
  readonly log: CapturedLog;
  readonly engine: SelectorEngine;
  /** The principal stage 4 gives the next requests. */
  actAs(principal: Principal): void;
}

/** The real app factory with no database; the engine is the stand-in on a real simulator. Close it with `app.close()`. */
export async function selectorUnitApp(scenario: ScenarioName = 'idle'): Promise<SelectorUnitApp> {
  const log = captureLog();
  const fake = createFakePool();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream });
  const registered: RouteOptions[] = [];
  app.addHook('onRoute', (route) => void registered.push(route));
  let current: Principal = ANONYMOUS;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  const engine = selectorEngine(scenario);
  app.seams.replace('engine', engine.host);
  return { app, registered, log, engine, actAs: (principal) => void (current = principal) };
}
