/**
 * The Core server's "now" for a display that must keep up with it (closing-fix row CF2-A, defect
 * RF-PH-1 = RF-T-3: the monitor timer held one value for 5-21 s under host load while the Core
 * recorded, then jumped forward).
 *
 * ## Why the Live clock alone is not enough for a running timer
 *
 * The Live clock (`@dems/shared/live`, `clock.ts`) is the local clock plus the offset of the NEWEST
 * server-time sample, and it never moves backwards. A sample is `serverTime` against the local instant
 * the JS thread HANDLED the message. On the starved emulator a heartbeat waits in the JS queue for
 * seconds, so its sample says the server is seconds behind: the offset drops, and `now()` holds its
 * last value until local time has caught up (or a timely heartbeat lifts the offset again). Every
 * delay in the queue can only make a sample LOWER than the true offset, never higher.
 *
 * ## The estimate
 *
 * `now()` reads the Live clock and remembers the HIGHEST offset (Live clock minus local clock) seen in
 * the last one to two windows: the least-delayed reading, i.e. the best lower bound of the true offset.
 * It answers `max(Live clock, local clock + that offset)`, so it moves with the local clock (which a
 * busy JS thread does not slow down) and never runs ahead of the Core by more than the true offset
 * changed within the window (on this demo's one computer it does not change). The window lets a real
 * change of the server clock in through within two minutes.
 *
 * The Live source's own timers are stall-tolerant (they yield to the JS queue when late); a display
 * that re-reads this clock must use the plain `timers` given here, which fire as soon as the thread
 * can run them. Created per Live source by `createMobileLive`; `coreClockOf(sim)` is `null` for a
 * simulator (SIMULATED, HEARTBEAT), whose store clock is the clock.
 */
import type { LiveSocketTimers } from '@dems/shared/realtime';

/** How long one bucket of offset readings lasts (ms); the estimate keeps the current and the previous one. */
export const CORE_CLOCK_WINDOW_MS = 60_000;

export interface CoreClock {
  /** The Core's time as well as this client can tell it now (epoch ms). Also takes a reading. */
  now(): number;
  /** Takes one reading of the Live clock against the local clock (no answer). */
  sample(): void;
  /** Plain timer functions on the clock `now()` moves with (not stall-tolerant). */
  readonly timers: Pick<LiveSocketTimers, 'setTimeout' | 'clearTimeout'>;
}

interface Bucket {
  readonly start: number;
  best: number;
}

/**
 * `live`: the Live clock (`LiveSim.clock.now`); `local`: the clock the Live source was given; `timers`:
 * plain timers on `local`.
 */
export function createCoreClock(
  live: () => number,
  local: () => number,
  timers: Pick<LiveSocketTimers, 'setTimeout' | 'clearTimeout'>,
  windowMs: number = CORE_CLOCK_WINDOW_MS,
): CoreClock {
  let current: Bucket | null = null;
  let previous: Bucket | null = null;

  /** One reading; returns the Live clock and the local clock it was taken at. */
  const read = (): { liveNow: number; localNow: number } => {
    const liveNow = live();
    const localNow = local();
    if (!Number.isFinite(liveNow) || !Number.isFinite(localNow)) return { liveNow, localNow };
    const offset = liveNow - localNow;
    if (current === null || localNow - current.start >= windowMs || localNow < current.start) {
      previous = current;
      current = { start: localNow, best: offset };
    } else if (offset > current.best) {
      current.best = offset;
    }
    return { liveNow, localNow };
  };

  const bestOffset = (localNow: number): number | null => {
    if (current === null) return null;
    const keepPrevious = previous !== null && localNow - previous.start < 2 * windowMs;
    return keepPrevious && previous !== null ? Math.max(current.best, previous.best) : current.best;
  };

  return {
    now() {
      const { liveNow, localNow } = read();
      const offset = bestOffset(localNow);
      if (offset === null || !Number.isFinite(localNow)) return liveNow;
      return Math.max(liveNow, localNow + offset);
    },
    sample() {
      read();
    },
    timers,
  };
}

/**
 * The instant on THIS DEVICE's clock (`localNow`, `Date.now()` of any thread of the app) at which the Core's
 * clock read `coreMs`, by the estimate `now()` gives at this moment. A display that must run without the JS
 * thread (the recording timer's UI-thread clock, decision D247 item 5) anchors itself there. Pure given the
 * two readings; `NaN` when the clock has no finite reading.
 */
export function coreInstantOnDeviceClock(clock: Pick<CoreClock, 'now'>, coreMs: number, localNow: number = Date.now()): number {
  const coreNow = clock.now();
  if (!Number.isFinite(coreNow) || !Number.isFinite(localNow) || !Number.isFinite(coreMs)) return Number.NaN;
  return coreMs - (coreNow - localNow);
}

const coreClocks = new WeakMap<object, CoreClock>();

/** Registers the Core clock of a Live source's `Sim` (`createMobileLive`). */
export function registerCoreClock(sim: object, clock: CoreClock): void {
  coreClocks.set(sim, clock);
}

/** The Core clock of a Live source's `Sim`, or `null` (a simulator, or no runtime). */
export function coreClockOf(sim: object | null | undefined): CoreClock | null {
  return sim ? (coreClocks.get(sim) ?? null) : null;
}
