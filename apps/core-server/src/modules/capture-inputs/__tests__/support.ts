/**
 * Test support of the capture-inputs module and of the no-device notices (blueprint row 133; not a
 * test file).
 *
 * `app.ts` does not register the module yet (P25; the request is in `file_requests.md`), so both
 * apps below register it themselves, before `ready()`:
 *
 *   unit tests       the real app factory with no database: a principal the test chooses behind
 *                    stage 4, the REAL access rule (stage 6), and behind the seam `engine` a
 *                    stand-in on a REAL shared simulator whose unit records the audit rows a
 *                    route asks for;
 *   database tests   the real app factory on a clone of the seed, as `dems_app`, with EVERY stage
 *                    as the server has it, the engine BOOTED on a manual clock and a manual
 *                    timer, the three seeded operators signed in on the web console (the form of
 *                    `devicesApp`, with this module registered).
 *
 * `stoppableFakes` is the adapter set of both: the fake registry of row 65, with a camera read
 * that answers or not as the test says ("one configured fake camera stopped").
 */
import { ROLE_PERMISSIONS, createManualClock, createSim, type AuditRow, type OperatorRole, type Sim } from '@dems/shared/sim';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { captureLog, createFakePool, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { readTrail } from '../../../../test/support/core';
import { countingPool, manualTimer, type ManualTimer } from '../../../../test/support/engine';
import { WEB_ORIGIN, identityApp, signInOnWeb, type Headers, type IdentityApp, type IdentityTarget, type ManualClock } from '../../../../test/support/identity';
import { buildApp } from '../../../app';
import { probeOfAdapters, type CaptureReachabilityProbe } from '../../../capture-notices';
import { createFakeRegistry, type CameraAdapter, type FakeRegistry } from '../../../capture/adapters';
import type { AuditEntry } from '../../../core';
import { pickDurable, type DurableSlices } from '../../../db/mapping';
import { engineControl, type EngineControl, type EngineHost, type EngineStateChange, type EngineUnit } from '../../../engine';
import type { Principal } from '../../../plugins/authenticate';
import { notReady } from '../../../plugins/error-envelope';
import type { Publication } from '../../../realtime';
import { ANONYMOUS, FIXED_NOW, TICK_MS } from '../../devices/__tests__/support';

export const RESCAN = '/api/v1/capture/inputs/rescan';

export interface StoppableFakes {
  readonly fakes: FakeRegistry;
  readonly probe: CaptureReachabilityProbe;
  /** The camera reads the probe made, by device ID. */
  readonly reads: string[];
  stop(deviceId: string, error?: unknown): void;
  start(deviceId: string): void;
}

export function stoppableFakes(): StoppableFakes {
  const fakes = createFakeRegistry({ runDir: '/nonexistent/row133' });
  const stopped = new Map<string, unknown>();
  const reads: string[] = [];
  const cameras: CameraAdapter[] = fakes.cameras.map((camera) => ({
    ...camera,
    async profiles(deviceId: string) {
      reads.push(deviceId);
      if (stopped.has(deviceId)) throw stopped.get(deviceId);
      return camera.profiles(deviceId);
    },
  }));
  return {
    fakes,
    probe: probeOfAdapters({ cameras, microphones: fakes.mics }),
    reads,
    stop: (deviceId, error = new Error('no answer')) => void stopped.set(deviceId, error),
    start: (deviceId) => void stopped.delete(deviceId),
  };
}

// ── Unit tests ─────────────────────────────────────────────────────────────────────────────────

export interface InputsUnitApp {
  readonly app: FastifyInstance;
  readonly log: CapturedLog;
  readonly sim: Sim;
  readonly clock: ReturnType<typeof createManualClock>;
  /** The audit rows the route asked a unit to append, in order. */
  readonly appended: AuditEntry[];
  /** The labels of the units `engine.run` ran. */
  readonly units: string[];
  running: boolean;
  actAs(principal: Principal): void;
  post(): Promise<LightMyRequestResponse>;
}

/** The real app factory with no database; the engine is a stand-in on a real simulator. Close it with `app.close()`. */
export async function inputsUnitApp(options: { captureMode?: 'simulated' | 'real' } = {}): Promise<InputsUnitApp> {
  const log = captureLog();
  const fake = createFakePool();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info', ...(options.captureMode === undefined ? {} : { captureMode: options.captureMode }) }), createPool: () => fake.pool, logStream: log.stream });
  // The app factory registers the module itself since decision D114 (the waived `app.ts` lines of row 132).
  let current: Principal = ANONYMOUS;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);

  const clock = createManualClock(FIXED_NOW);
  const sim = createSim({ clock, storage: null, authStorage: null });
  app.seams.replace('clock', { now: () => clock.now() });
  const unused = (member: string) => (): never => {
    throw new Error(`the capture-inputs module must not call engine.${member}`);
  };
  const committed = (): DurableSlices => pickDurable(sim.store.getState());
  const built: InputsUnitApp = {
    app,
    log,
    sim,
    clock,
    appended: [],
    units: [],
    running: true,
    actAs: (principal) => void (current = principal),
    post: () => app.inject({ method: 'POST', url: RESCAN, headers: { origin: WEB_ORIGIN } }),
  };
  const host: EngineHost = {
    epoch: 7,
    revision: 41,
    get running() {
      return built.running;
    },
    state() {
      if (!built.running) throw notReady();
      return committed();
    },
    slice(name) {
      if (!built.running) throw notReady();
      return committed()[name];
    },
    command: unused('command') as unknown as EngineHost['command'],
    async run(label, work) {
      if (!built.running) throw notReady();
      built.units.push(label);
      const scope: EngineUnit = {
        unit: { audit: { append: async (entry: AuditEntry) => void built.appended.push(entry) } } as unknown as EngineUnit['unit'],
        pending: committed,
        command: unused('command') as unknown as EngineUnit['command'],
      };
      return { value: await work(scope), epoch: 7, revision: 41 };
    },
    setTabletLink: unused('setTabletLink'),
    applyCaptureTelemetry: unused('applyCaptureTelemetry'),
    async raiseCaptureWarning(warning) {
      if (!built.running) throw notReady();
      sim.actions.raiseCaptureWarning(warning);
      return { value: undefined, epoch: 7, revision: 41 };
    },
    async clearCaptureWarning(warning) {
      if (!built.running) throw notReady();
      sim.actions.clearCaptureWarning(warning);
      return { value: undefined, epoch: 7, revision: 41 };
    },
    mirrorOperators: unused('mirrorOperators'),
    start: unused('start'),
    reload: unused('reload'),
    stop: async () => undefined,
    meters: () => null,
    stats: unused('stats'),
  };
  app.seams.replace('engine', host);
  return built;
}

// ── Database tests ─────────────────────────────────────────────────────────────────────────────

export interface NoticesTarget extends IdentityTarget {
  ownerPool(): Pool;
}

export interface NoticesApp {
  readonly app: FastifyInstance;
  readonly identity: IdentityApp;
  readonly engine: EngineHost & EngineControl;
  readonly clock: ManualClock;
  readonly timer: ManualTimer;
  readonly log: CapturedLog;
  readonly owner: Pool;
  readonly publications: Publication[];
  get(role: OperatorRole | null, url: string): Promise<LightMyRequestResponse>;
  post(role: OperatorRole | null, url: string, payload?: InjectOptions['payload']): Promise<LightMyRequestResponse>;
  /** Advances the clock `stepMs` at a time, fires the timer after each step and waits for the tick's unit. */
  drive(ms: number, stepMs?: number): Promise<void>;
  since(from: number): Promise<AuditRow[]>;
  trailLength(): Promise<number>;
  stateChanges(): EngineStateChange[];
  operatorId(role: OperatorRole): string;
}

const USERNAME: Readonly<Record<OperatorRole, string>> = { INVESTIGATOR: 'budi.santoso', SUPERVISOR: 'andi.pratama', TECHNICIAN: 'rina.wijaya' };

/** The real app with this module registered, on a clone of the seed, booted, the three seeded operators signed in on the web console. */
export async function noticesApp(target: NoticesTarget): Promise<NoticesApp> {
  const database = countingPool();
  // Registered by the app factory since decision D114: no registration here.
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
  const headers = (role: OperatorRole | null): Headers => (role === null ? {} : sessions[role]);

  return {
    app,
    identity,
    engine,
    clock,
    timer,
    log,
    owner,
    publications,
    get: (role, url) => app.inject({ method: 'GET', url, headers: headers(role) }),
    post: (role, url, payload) => app.inject({ method: 'POST', url, headers: { ...headers(role), origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) }),
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
    operatorId(role) {
      const operator = engine.slice('operators').find((candidate) => candidate.role === role);
      if (operator === undefined) throw new Error(`no operator with role ${role}`);
      return operator.id;
    },
  };
}

export { ROLE_PERMISSIONS };
