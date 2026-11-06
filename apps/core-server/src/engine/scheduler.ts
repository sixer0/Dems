/**
 * The scheduler of the engine host (plan row W26; spec ENG-1, ENG-5, §8.7).
 *
 * It decides WHEN a tick is submitted; the host decides what a tick does. Three rules:
 *
 *   one in flight   a timer call submits nothing while the last tick (or probe) is still queued
 *                   or running: at most one unit of work of the engine is between "changed" and
 *                   "committed" (ENG-1). The call is counted as skipped; the next tick carries
 *                   the elapsed time, which the engine supports;
 *   suspension      a tick whose unit was not committed suspends the ticks (ENG-5): the engine's
 *                   state was set back, and ticking on would move a state that cannot be written.
 *                   While suspended, the scheduler sends a PROBE at most once in
 *                   `probeIntervalMs` of the server clock: a unit that asks the database
 *                   something. The first probe that commits resumes the ticks;
 *   no own time     the timer says when to look; every instant read here comes from the injected
 *                   clock. Nothing waits, nothing sleeps.
 *
 * Pure of the database and of the simulator: `tick` and `probe` are the host's.
 */
import type { Clock } from '../core';
import type { EngineTimer } from './timer';

export interface SchedulerDependencies {
  readonly timer: EngineTimer;
  readonly clock: Clock;
  readonly intervalMs: number;
  readonly probeIntervalMs: number;
  /** One tick as one unit of work. Rejects when the unit was not committed. */
  tick(): Promise<void>;
  /** One unit that only asks the database. Rejects when it could not commit. */
  probe(): Promise<void>;
  /** Called when a tick's unit was not committed, with what it rejected with. */
  onSuspended(error: unknown): void;
  onResumed(): void;
}

export interface SchedulerStats {
  readonly running: boolean;
  readonly suspended: boolean;
  readonly ticks: number;
  readonly ticksFailed: number;
  readonly skipped: number;
  readonly probes: number;
}

export interface Scheduler {
  /** Starts the timer. Idempotent. */
  start(): void;
  /** Stops the timer. What is in flight ends by itself: see `idle()`. Idempotent. */
  stop(): void;
  /** Resolves when no tick and no probe of this scheduler is queued or running. Never rejects. */
  idle(): Promise<void>;
  /** One timer call, as the timer makes it. For a caller that drives the engine by hand. */
  fire(): void;
  /** Leaves the suspension: a write of the engine committed. */
  resume(): void;
  stats(): SchedulerStats;
}

export function createScheduler(dependencies: SchedulerDependencies): Scheduler {
  const { clock } = dependencies;
  let cancel: (() => void) | null = null;
  let inFlight: Promise<void> | null = null;
  let suspended = false;
  let lastProbeAt = Number.NEGATIVE_INFINITY;
  let ticks = 0;
  let ticksFailed = 0;
  let skipped = 0;
  let probes = 0;

  function resume(): void {
    if (!suspended) return;
    suspended = false;
    dependencies.onResumed();
  }

  function track(work: Promise<void>): void {
    const settled = work.finally(() => {
      if (inFlight === settled) inFlight = null;
    });
    inFlight = settled;
  }

  function fire(): void {
    if (cancel === null) return;
    if (inFlight !== null) {
      skipped += 1;
      return;
    }
    if (suspended) {
      const now = clock.now();
      if (now - lastProbeAt < dependencies.probeIntervalMs) return;
      lastProbeAt = now;
      probes += 1;
      track(
        dependencies.probe().then(resume, () => {
          // Still not writable: stay suspended. The pipeline has reported the failure.
        }),
      );
      return;
    }
    ticks += 1;
    track(
      dependencies.tick().catch((error: unknown) => {
        ticksFailed += 1;
        if (!suspended) {
          suspended = true;
          // The first probe waits a whole interval: the failure was just seen.
          lastProbeAt = clock.now();
          dependencies.onSuspended(error);
        }
      }),
    );
  }

  return {
    start() {
      if (cancel !== null) return;
      cancel = dependencies.timer.every(dependencies.intervalMs, fire);
    },
    stop() {
      cancel?.();
      cancel = null;
    },
    idle: async () => {
      while (inFlight !== null) await inFlight;
    },
    fire,
    resume,
    stats: () => ({ running: cancel !== null, suspended, ticks, ticksFailed, skipped, probes }),
  };
}
