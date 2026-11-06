/**
 * The shared simulator core, headless (plan row W26; spec §8.1; decisions D11 ADQ-1, D28).
 *
 * `createSim` of `@dems/shared/sim` takes every platform adapter as an option. The host passes
 * ALL of them, because the simulator's defaults under Node 26 would use the runtime's global
 * `sessionStorage`, a real interval and real timers (finding F-7 of the headless proof):
 *
 *   clock        the server clock itself, through `engineClock` below;
 *   scheduler    inert: it keeps nothing and schedules nothing. The host calls `sim.tick()`
 *                itself, one unit of work per tick (ENG-1);
 *   timers       inert: the simulator's snapshot throttle never fires;
 *   storage      reads nothing and writes nothing. PostgreSQL is the store: the host writes the
 *                changed durable slices through the mapping module and rehydrates from it;
 *   authStorage  memory. No sign-in action is ever called on the engine (spec §7.17);
 *   visibility   always visible;
 *   onError      the server's reporter.
 *
 * Nothing here opens a connection, reads a file or names a global of the runtime.
 */
import {
  ALWAYS_VISIBLE,
  SIM_TZ,
  SIM_TZ_OFFSET_MINUTES,
  createSim,
  type CaptureLevelSource,
  type Sim,
  type SimClock,
  type SimErrorReport,
  type SimPersistStorage,
  type SimScheduler,
  type TimerAdapter,
} from '@dems/shared/sim';
import type { Clock } from '../core';

/**
 * The engine's clock: the server clock (ENG-13) in the form the simulator takes, and nothing
 * else. ONE time base per process (decision D110): the engine holds no floor and no offset of
 * its own. The instant below which no row may be stamped (the newest one a stored row was
 * written with) is the floor of the SERVER clock, raised by the host's start before this clock
 * is read for the first time, so the engine, the pipeline and every module read the same time.
 */
export function engineClock(clock: Clock): SimClock {
  return {
    now: () => clock.now(),
    tz: SIM_TZ,
    tzOffsetMinutes: SIM_TZ_OFFSET_MINUTES,
  };
}

/** Never calls `tick`: the host's own scheduler does, inside a unit of work. */
const INERT_SCHEDULER: SimScheduler = () => () => undefined;

/** Never fires: there is no snapshot to throttle. */
const INERT_TIMERS: TimerAdapter = {
  setTimeout: () => null,
  clearTimeout: () => undefined,
};

/** Holds nothing: a start is a rehydration from PostgreSQL by the host, not by the simulator. */
const NO_STORAGE: SimPersistStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export interface HeadlessSimOptions {
  /** `meta.seed` of the stored state. */
  readonly seed: number;
  readonly clock: SimClock;
  /** Receives what a subsystem threw (the simulator catches it and goes on). */
  readonly onError: (report: SimErrorReport) => void;
  /**
   * Where the meter levels come from (register CS-04): `'external'` when a real capture worker
   * measures them, so the simulator generates none. Default `'simulated'`.
   */
  readonly capture?: CaptureLevelSource;
  /**
   * How long the connecting part of a start lasts in SIMULATED capture, in ms (wave H closing pass
   * Z1; `CreateSimOptions.captureConnectMs`). A test / development control; absent = the default.
   */
  readonly captureConnectMs?: number;
}

/** A fresh `Sim` on the host's adapters. Its state is the idle dataset until the host sets the stored one. */
export async function createHeadlessSim(options: HeadlessSimOptions): Promise<Sim> {
  const sim = createSim({
    seed: options.seed,
    clock: options.clock,
    scheduler: INERT_SCHEDULER,
    timers: INERT_TIMERS,
    storage: NO_STORAGE,
    authStorage: null,
    visibility: ALWAYS_VISIBLE,
    onError: options.onError,
    capture: options.capture ?? 'simulated',
    ...(options.captureConnectMs === undefined ? {} : { captureConnectMs: options.captureConnectMs }),
  });
  // With a storage that answers at once, hydration has ended before `createSim` returns.
  await sim.ready;
  return sim;
}
