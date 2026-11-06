/**
 * Timers that let the event queue go first after the JS thread was held up (closing-fix row CF-M1,
 * defects R-P-2 and R-S-2 of the re-test round; decision D214).
 *
 * ## What went wrong
 *
 * The Live source judges the link with wall-clock deadlines that a timer checks:
 *
 * - the socket client's housekeeping (`live-socket-client.ts`, every 500 ms) marks the link STALE when
 *   no message came for 2,500 ms (`HEARTBEAT_STALE_AFTER_MS`), and gives a socket up (SYNC_TIMEOUT,
 *   then a reconnect) when `hello` or a snapshot did not come within 4,000 ms;
 * - the command gate asks for a resync when an answered command's delta did not come in time (CL-17).
 *
 * On the emulator the JS thread is starved for seconds at a time (host load; R-P-2's back-guard
 * dialog appeared 5-9 s after Back). During such a stall the Core's messages keep arriving and wait
 * in the JS queue BEHIND a timer task that was queued earlier. When the thread is free again the
 * timer runs first, reads the wall clock, finds the deadline passed and declares the link lost; the
 * waiting heartbeat runs a moment later and brings it back. On the device: "Core link lost", then
 * "Resynced", with no close and no open on the Core (R-P-2, and the banner before the R-P-1 crash);
 * after a pairing hand-off, a SYNC_TIMEOUT `waiting: 'hello'` 5 s after the Core had opened the socket
 * and sent `hello`, then a self-made socket gap that Login showed as "Core server unreachable"
 * (R-S-2). Reproduced on dems2_phone with a 3.5 s JS stall injected through the Hermes inspector.
 *
 * ## The rule
 *
 * A callback that fires more than `STALL_LATENESS_MS` after its due time has been held up by the JS
 * thread, not by the network. It does not run in that turn: it is re-armed for `STALL_YIELD_MS`, so
 * every task already queued (the socket messages that arrived during the stall) runs first, and then
 * it runs and judges the link from what has really arrived. A callback that is late again after its
 * yield (the thread is still starved) yields again, but only while less than `STALL_MAX_POSTPONE_MS`
 * has passed since it first fired late (and at most `STALL_MAX_YIELDS` times), so a deadline is never
 * postponed by more than about a second. A callback on time runs at once, exactly as before;
 * cancelling works in every phase. An interval keeps its period from the run that happened.
 *
 * ## The bound is wall time, not a count (closing-fix row CF2-A, defects RF-PH-1 / RF-T-3, RF-PH-2)
 *
 * CF-M1 bounded the yields by their NUMBER (20 x 50 ms, "about a second"). On a starved emulator a
 * 50 ms yield itself fires hundreds of milliseconds late, so 20 late yields in a row postponed a
 * callback by 20 x (50 ms + its lateness): with every task 400 ms late, 9 s instead of 1 s. The Live
 * source's 100 ms clock publication runs on these timers, so under host load 9-14 the monitor timer
 * held one value for 5-21 s and then jumped (RF-PH-1); the socket client's housekeeping (the pending
 * `resync`, the sync deadline) runs on them too, so the replica learnt a web stop seconds late
 * (RF-PH-2, once about 71 s). The yields now stop once `STALL_MAX_POSTPONE_MS` has passed since the
 * first late firing, whatever each yield's own lateness: the queue still goes first once (the CF-M1
 * rule), and the callback runs at most about a second after it was first due-and-late.
 *
 * Nothing here knows about sockets: the timer functions of the Live source (`createMobileLive`) are
 * wrapped once, so the socket client, the command gate, the Live source's own timers and the
 * secure-store budgets all follow the rule. The clock is the one the timers are measured against
 * (`Date.now` in the app, the fake transport's clock in a test).
 */
import type { LiveSocketTimers } from '@dems/shared/realtime';

/** A callback this much later than its due time was held up by the JS thread (ms). */
export const STALL_LATENESS_MS = 250;
/** How long a late callback yields to the queued tasks before it runs (ms). */
export const STALL_YIELD_MS = 50;
/** The most yields in a row for one callback; then it runs whatever the clock says. */
export const STALL_MAX_YIELDS = 20;
/** No yield starts later than this after the callback first fired late (ms): the wall-time bound of the rule (CF2-A). */
export const STALL_MAX_POSTPONE_MS = 1_000;

interface Slot {
  inner: unknown;
  cancelled: boolean;
}

function isSlot(handle: unknown): handle is Slot {
  return typeof handle === 'object' && handle !== null && 'cancelled' in handle && 'inner' in handle;
}

/** Calls `run` at `due`, yielding while the thread is late (the rule above). */
function arm(timers: LiveSocketTimers, now: () => number, slot: Slot, delayMs: number, run: () => void): void {
  let due = now() + delayMs;
  let yields = 0;
  /** When the callback first fired late; the yields stop `STALL_MAX_POSTPONE_MS` after it (CF2-A). */
  let firstLateAt: number | null = null;
  const fire = (): void => {
    if (slot.cancelled) return;
    const at = now();
    const late = at - due;
    if (late > STALL_LATENESS_MS) {
      if (firstLateAt === null) firstLateAt = at;
      if (yields < STALL_MAX_YIELDS && at - firstLateAt < STALL_MAX_POSTPONE_MS) {
        yields += 1;
        due = at + STALL_YIELD_MS;
        slot.inner = timers.setTimeout(fire, STALL_YIELD_MS);
        return;
      }
    }
    run();
  };
  slot.inner = timers.setTimeout(fire, delayMs);
}

/** `timers` with the rule of this file's header. The handles are this file's own; pass them back to its clear functions. */
export function createStallTolerantTimers(timers: LiveSocketTimers, now: () => number): LiveSocketTimers {
  const clear = (handle: unknown): void => {
    if (!isSlot(handle)) return;
    handle.cancelled = true;
    timers.clearTimeout(handle.inner);
  };
  return {
    setTimeout(callback, delayMs) {
      const slot: Slot = { inner: null, cancelled: false };
      arm(timers, now, slot, Math.max(0, Number.isFinite(delayMs) ? delayMs : 0), () => callback());
      return slot;
    },
    clearTimeout: clear,
    setInterval(callback, intervalMs) {
      const every = Math.max(1, Number.isFinite(intervalMs) ? intervalMs : 1);
      const slot: Slot = { inner: null, cancelled: false };
      const tick = (): void => {
        // The next period starts before the callback, so a callback that clears the interval ends it.
        arm(timers, now, slot, every, tick);
        callback();
      };
      arm(timers, now, slot, every, tick);
      return slot;
    },
    clearInterval: clear,
  };
}
