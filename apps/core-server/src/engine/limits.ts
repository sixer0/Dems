/**
 * Limits of the engine host (plan row W26). Constants only.
 *
 * None of them is configuration: no environment variable reaches them, and the frozen `config.ts`
 * holds none (the same rule as the core's `limits.ts` and the throttle's).
 */
import { ENGINE_INTERVAL_MS } from '@dems/shared/sim';

/** The engine tick: the shared simulator's own interval, 50 ms (spec §8.7; `constants.ts:22`). */
export const ENGINE_TICK_MS = ENGINE_INTERVAL_MS;

/**
 * A TICK that changed snapshot slices ONLY writes the hardware snapshot row at most once in each
 * period of this many milliseconds of the server clock: once per clock second (spec §3.1 class
 * SN, §8.7; database contract §4.27). A command, the start and the stop write their snapshot
 * change at once, and so does a tick that raised or cleared a fault, and a tick that writes a
 * record: whatever a unit commits is one cut of the whole state (finding F71, decision D104).
 */
export const SNAPSHOT_MIN_INTERVAL_MS = 1_000;

/** One health snapshot row every 60 s (spec §8.7, E-25; database contract §4.28). */
export const HEALTH_SNAPSHOT_INTERVAL_MS = 60_000;

/**
 * While ticks are suspended after a write that failed (ENG-5), the scheduler asks the database
 * at most once in this many milliseconds of the server clock whether a unit commits again.
 */
export const SUSPENDED_PROBE_INTERVAL_MS = 1_000;

/** A reload after a diverged chain head is tried again this often, until it succeeds. */
export const RESYNC_RETRY_INTERVAL_MS = 1_000;

/** The boot step of the engine host (the scaffold's readiness test names the same ID). */
export const ENGINE_BOOT_STEP = 'engine.rehydrate';

/** Labels of the units the host submits by itself. A hosted command is `engine.<action>`. */
export const ENGINE_UNIT_LABEL = {
  rehydrate: 'engine.rehydrate',
  tick: 'engine.tick',
  probe: 'engine.probe',
  stop: 'engine.stop',
  tabletLink: 'engine.setTabletLink',
  operators: 'engine.mirrorOperators',
} as const;
