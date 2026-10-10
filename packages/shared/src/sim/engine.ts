/**
 * Engine and `createSim` (masterplan/01_specs.md §14.7 `engine.ts`; SCR-01).
 *
 * `createSim(options)` returns `{ store, actions, clock, ready, start, stop, tick, … }`:
 * - Platform adapters are injected (storage, auth storage, visibility, scheduler, timers,
 *   clock); each has a guarded web default in `platform.ts`.
 * - `ready` resolves once the persisted snapshot has hydrated (or hydration failed and the
 *   fresh state stands). Snapshot writes stay off until then.
 * - `start()` may be called at once: the scheduler starts only after `ready`, and only while
 *   the host is visible. Hidden → pause and flush the snapshot; visible again → one catch-up
 *   tick with the elapsed `dtMs`, then resume.
 *
 * The tick runs an ordered list of subsystems (`createSubsystems`): the clock publisher and
 * the auth idle-expiry check (step 31), then the session machine's timed transitions, health
 * at 1 Hz, audio at 20 Hz, the event generator, and maintenance (diagnostics, update)
 * (step 32). Fault effects are applied by the actions themselves (faults.ts, derive.ts).
 */
import { createAudioRuntime, createAudioSubsystem, type AudioRuntime } from './audio';
import { expireIfIdle, restoreAuth } from './auth';
import { createSimClock } from './clock';
import {
  CLOCK_TICK_MS,
  DEFAULT_SEED,
  ENGINE_INTERVAL_MS,
  HEALTH_TICK_MS,
  PERSIST_THROTTLE_MS,
} from './constants';
import { createActions } from './actions';
import { handleSimApiRequest } from './api';
import { captureConnectMsOf } from './capture-session';
import { hostClockTimeTransition } from './core-facts';
import { OPERATORS } from './dataset';
import { describeError } from './errors';
import { createGeneratorSubsystem } from './generator';
import { createHealthSubsystem } from './health';
import { createIdleState } from './initial-state';
import { createMaintenanceSubsystem } from './maintenance';
import {
  createDefaultAuthStorage,
  createDefaultPersistStorage,
  createDefaultVisibility,
  createMemoryAuthStorage,
  createMemoryPersistStorage,
  createThrottledPersistStorage,
  DEFAULT_TIMERS,
  defaultScheduler,
} from './platform';
import { createRngStreams, type RngStreams } from './rng';
import { buildScenarioState } from './scenarios';
import { tickMachine } from './session-machine';
import { createSimStore, type SimStore } from './store';
import type {
  CaptureLevelSource,
  CreateSimOptions,
  DetailValue,
  SimActions,
  SimApiRequest,
  SimApiResponse,
  SimClock,
  SimErrorReport,
  SimSubsystem,
  SimTickContext,
} from './types';
import { ScenarioName } from './vocabulary';

export interface Sim {
  readonly store: SimStore;
  readonly actions: SimActions;
  readonly clock: SimClock;
  readonly rng: RngStreams;
  readonly seed: number;
  /** Resolves after hydration (never rejects). */
  readonly ready: Promise<void>;
  isReady(): boolean;
  /** True when the hydrated snapshot replaced the fresh state (a reload resumed). */
  wasRestored(): boolean;
  /** Idempotent. Subscribes to visibility; runs the scheduler once `ready` and visible. */
  start(): void;
  /** Pauses the scheduler, releases the visibility subscription, flushes the snapshot. */
  stop(): void;
  isRunning(): boolean;
  /** One engine step at `clock.now()` (tests drive the engine with this and a manual clock). */
  tick(): void;
  /** Writes the pending snapshot now. */
  flush(): void;
  /** Alias of `stop()` (kept for owners that tear the sim down for good). */
  destroy(): void;
  /** The last 50 caught errors (also passed to `onError`). */
  errors(): readonly SimErrorReport[];
  /**
   * Answers one simulated §21.2 request (api.ts; used by the API Reference `simAwareFetch`).
   * Never throws; an unexpected error becomes a 500 and is reported as `api`.
   */
  request(request: SimApiRequest): SimApiResponse;
}

/** Everything a subsystem may touch. */
export interface EngineContext {
  store: SimStore;
  clock: SimClock;
  rng: RngStreams;
  report: (
    source: string,
    error: unknown,
    context?: Record<string, DetailValue>,
    level?: SimErrorReport['level'],
  ) => void;
}

/** Publishes `clock.now` in 100 ms steps (§14.7 "clock tick 100 ms"). */
function clockSubsystem(engine: EngineContext): SimSubsystem {
  return {
    name: 'clock',
    tick({ now }) {
      const published = engine.store.getState().clock.now;
      if (now - published >= CLOCK_TICK_MS || now < published) {
        const clock = engine.store.getState().clock;
        engine.store.setState({ clock: { ...clock, now: now - (now % CLOCK_TICK_MS) } });
      }
    },
  };
}

/** Expires an idle operator session after 15 min (§14.8), checked once per second. */
function authIdleSubsystem(engine: EngineContext): SimSubsystem {
  let lastCheck = Number.NEGATIVE_INFINITY;
  return {
    name: 'auth-idle',
    tick({ now }) {
      if (now - lastCheck < HEALTH_TICK_MS) return;
      lastCheck = now;
      const patch = expireIfIdle(engine.store.getState(), now);
      if (patch) engine.store.setState(patch);
    },
  };
}

/** Runs the session machine's timed transitions (precheck checks, STOPPING, finalization, recovery). */
function machineSubsystem(engine: EngineContext, capture: CaptureLevelSource, captureConnectMs: number): SimSubsystem {
  return {
    name: 'session-machine',
    tick({ now }) {
      const state = engine.store.getState();
      if (!state.session) return;
      const next = tickMachine(state, now, engine.rng, capture, captureConnectMs);
      if (next !== state) engine.store.setState(next);
    },
  };
}

/**
 * The ordered subsystem list: clock, auth idle expiry, session machine, health (1 Hz),
 * audio (20 Hz), event generator, maintenance.
 */
export function createSubsystems(engine: EngineContext, audio: AudioRuntime = createAudioRuntime(), captureConnectMs?: number): SimSubsystem[] {
  return [
    clockSubsystem(engine),
    authIdleSubsystem(engine),
    // The machine decides a connecting start by the time only where the simulator runs its own capture.
    // `captureConnectMs` (wave H Z1): how long that connecting part lasts; the default unless the host asked otherwise.
    machineSubsystem(engine, audio.levelSource, captureConnectMsOf(captureConnectMs)),
    // Wave H Z1: where the capture is the Core's own the time slice is the host clock.
    createHealthSubsystem(engine, audio.levelSource),
    createAudioSubsystem(engine, audio),
    // G75-01: where the capture is the Core's own the generator states no integrity fact.
    createGeneratorSubsystem(engine, audio.levelSource),
    createMaintenanceSubsystem(engine),
  ];
}

const MAX_ERRORS = 50;

export function createSim(options: CreateSimOptions = {}): Sim {
  const seed = options.seed ?? DEFAULT_SEED;
  const clock = options.clock ?? createSimClock();
  const scheduler = options.scheduler ?? defaultScheduler;
  const timers = options.timers ?? DEFAULT_TIMERS;
  const errorLog: SimErrorReport[] = [];

  const report = (
    source: string,
    error: unknown,
    context?: Record<string, DetailValue>,
    level: SimErrorReport['level'] = 'error',
  ) => {
    const { message, stack } = describeError(error);
    const entry: SimErrorReport = {
      level,
      source,
      message,
      at: clock.now(),
      ...(stack ? { stack } : {}),
      ...(context ? { context } : {}),
    };
    errorLog.push(entry);
    if (errorLog.length > MAX_ERRORS) errorLog.shift();
    try {
      options.onError?.(entry);
    } catch {
      // A failing error sink must never break the engine; the entry stays in errors().
    }
  };
  const reportAdapter = (source: string, error: unknown) => report(source, error);

  const authStorage =
    options.authStorage === null
      ? createMemoryAuthStorage()
      : (options.authStorage ?? createDefaultAuthStorage(reportAdapter));
  const innerStorage =
    options.storage === null
      ? createMemoryPersistStorage()
      : (options.storage ?? createDefaultPersistStorage());
  const storage = createThrottledPersistStorage(innerStorage, {
    intervalMs: options.persistThrottleMs ?? PERSIST_THROTTLE_MS,
    timers,
    onError: reportAdapter,
  });
  const visibility = options.visibility ?? createDefaultVisibility();

  const now = clock.now();
  const auth = restoreAuth(OPERATORS, authStorage.load(), now);
  const scenarioState = buildScenarioState(
    options.scenario ?? ScenarioName.IDLE,
    createIdleState({
      now,
      seed,
      auth,
      ...(options.initialPairing ? { pairing: options.initialPairing } : {}),
    }),
  );
  // Wave H Z1 (ruling D203 (1)): a Core in its own capture never states the dataset's GNSS time, not even in its first state.
  const initialState = options.capture === 'external' ? hostClockTimeTransition(scenarioState) : scenarioState;

  const rng = createRngStreams(seed, 0);
  let hydrated = false;
  let restored = false;
  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const store = createSimStore({
    initialState,
    storage,
    onHydrated: (outcome) => {
      if (outcome.error !== undefined) report('store.hydrate', outcome.error);
      restored = outcome.restored;
      if (restored) rng.reseed(store.getState().meta.epoch);
      hydrated = true;
      storage.enable();
      resolveReady();
    },
    onRejectedSnapshot: () =>
      report(
        'store.hydrate',
        new Error('Stored snapshot rejected (schema, seed or shape); starting fresh'),
        undefined,
        'warn',
      ),
  });

  const engine: EngineContext = { store, clock, rng, report };
  const audio = createAudioRuntime(options.capture);
  const subsystems = createSubsystems(engine, audio, options.captureConnectMs);
  const actions = createActions({ store, clock, authStorage, rng, audio, deviceConsole: options.deviceConsole === true });

  let wantRunning = false;
  let cancelScheduler: (() => void) | null = null;
  let lastTickAt: number | null = null;
  let tickIndex = 0;

  const tick = () => {
    const at = clock.now();
    const context: SimTickContext = {
      now: at,
      dtMs: lastTickAt === null ? 0 : Math.max(0, at - lastTickAt),
      tickIndex,
    };
    lastTickAt = at;
    tickIndex += 1;
    for (const subsystem of subsystems) {
      try {
        subsystem.tick(context);
      } catch (error) {
        report(`engine.${subsystem.name}`, error, { tickIndex: context.tickIndex });
      }
    }
  };

  const run = () => {
    if (cancelScheduler || !wantRunning || !hydrated || visibility.isHidden()) return;
    cancelScheduler = scheduler(tick, ENGINE_INTERVAL_MS);
  };
  const pause = () => {
    if (!cancelScheduler) return;
    cancelScheduler();
    cancelScheduler = null;
  };

  let unsubscribeVisibility: (() => void) | null = null;
  const onVisibilityChange = () => {
    if (visibility.isHidden()) {
      pause();
      storage.flush();
    } else if (wantRunning && hydrated && !cancelScheduler) {
      tick(); // catch up on the time spent hidden
      run();
    }
  };
  const watchVisibility = () => {
    if (unsubscribeVisibility) return;
    try {
      unsubscribeVisibility = visibility.subscribe(onVisibilityChange);
    } catch (error) {
      report('visibility.subscribe', error);
    }
  };
  const unwatchVisibility = () => {
    unsubscribeVisibility?.();
    unsubscribeVisibility = null;
  };

  // Hydrate after every listener is wired (sync storage finishes inside this call).
  try {
    void store.persist.rehydrate();
  } catch (error) {
    report('store.rehydrate', error);
    hydrated = true;
    storage.enable();
    resolveReady();
  }

  const stop = () => {
    wantRunning = false;
    unwatchVisibility();
    pause();
    storage.flush();
  };

  return {
    store,
    actions,
    clock,
    rng,
    seed,
    ready,
    isReady: () => hydrated,
    wasRestored: () => restored,
    start() {
      wantRunning = true;
      watchVisibility();
      if (hydrated) run();
      else void ready.then(run);
    },
    stop,
    isRunning: () => cancelScheduler !== null,
    tick,
    flush: () => storage.flush(),
    destroy: stop,
    errors: () => errorLog.slice(),
    request(request) {
      const response = handleSimApiRequest({ store, actions, clock, deviceConsole: options.deviceConsole === true }, request);
      if (response.status >= 500) {
        report('api', new Error(`${request.method} ${request.path} → ${response.status}`), {
          method: request.method,
          path: request.path,
        });
      }
      return response;
    },
  };
}
