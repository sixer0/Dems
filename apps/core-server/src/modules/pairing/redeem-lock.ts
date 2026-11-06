/**
 * The redeem lock (plan row W32; spec §6.1 PR-P4, §8.2 ENG-24; SR-27, SR-72; database contract
 * §5.6 AT-4, AT-6, AT-C2; assumption DA-05).
 *
 * 3 failed redeems within 300 s lock redeeming for 60 s. The key is GLOBAL: unpaired callers
 * cannot be told apart on loopback, so there is one count for all of them and never a value a
 * caller supplies. The count is memory state, like the sign-in lockout, and a restart clears it
 * (AT-6). The count toward CLOSING a code (5 per code) is not here: it is the column
 * `failed_attempts`, moved by the consuming statement of `store.ts`.
 *
 * AN ATTEMPT IS TAKEN BEFORE IT IS COMPARED (ENG-24, AT-4). The order of a redeem is:
 *
 *   take()      one attempt leaves the counter, or redeeming is locked and nothing is compared;
 *   (the consuming statement, then the comparison)
 *   succeed()   the code was right: the count and the lock are cleared; or
 *   fail()      it was not: the attempt stays counted, and the third failure is the locking one.
 *
 * So n redeems that arrive together are n counted attempts: of 20 at once, three are taken and
 * compared and 17 find redeeming locked.
 *
 * THE ARITHMETIC (the same shape as the sign-in lockout, with the numbers of PR-P4).
 *   - A window opens at the first taken attempt and ends 300 s later; a success or the end of a
 *     lock closes it earlier. A new window is a fresh count.
 *   - Taking the THIRD attempt of a window locks redeeming at once, for 60 s from that moment:
 *     the limit is reached, and whoever comes next is refused although the three comparisons
 *     may not have ended. If one of the three turns out right, the lock is lifted with the
 *     count (a success clears the counter).
 *   - `attemptsRemaining` is 3 minus the FAILURES recorded in the window, as in the simulator
 *     (`packages/shared/src/sim/pairing.ts`); the failure that makes it 0 is the locking one.
 *   - A lock that has ended starts a fresh count.
 *
 * Both counters are memory limiters of `rate-limiter-flexible`; nothing here counts by hand. The
 * library measures its own windows with the system time and takes no clock, so, exactly as the
 * throttle and the sign-in lockout do, the window is decided by the SERVER clock
 * (`core/windows.ts`) and named in the key the library counts under. The lock's end
 * is an instant of the server clock.
 *
 * The module calls `take`, `fail` and `succeed` inside units of the serial pipeline, so they
 * never interleave. They do not depend on that: each one changes the counters before its first
 * `await`, and a refusal that finds no lock recorded sets one (it fails closed).
 */
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { counterName, createFixedWindows, type OpenWindow } from '../../core';
import { REDEEM_LOCK_DURATION_MS, REDEEM_LOCK_KEY, REDEEM_LOCK_MAX_FAILURES, REDEEM_LOCK_WINDOW_MS } from './limits';

/** One attempt that left the counter. It is handed back to `fail`. */
export interface RedeemTicket {
  readonly kind: 'TAKEN';
  /** The window the attempt was counted in. */
  readonly windowId: number;
}

/** Redeeming is locked: nothing is compared. */
export interface RedeemLockRefusal {
  readonly kind: 'LOCKED';
  /** End of the lock, epoch milliseconds of the server clock. */
  readonly lockedUntil: number;
  readonly retryInMs: number;
}

/** What a failed redeem leaves behind. */
export interface RedeemFailure {
  /** Failures left before the lock; 0 for the failure that locks. */
  readonly attemptsRemaining: number;
  /** Set when this failure is the locking one, or when redeeming is locked anyway. */
  readonly lockedUntil: number | null;
  readonly retryInMs: number;
}

export interface RedeemLockStatus {
  readonly locked: boolean;
  readonly lockedUntil: number | null;
  readonly retryInMs: number;
  readonly attemptsRemaining: number;
}

export interface RedeemLock {
  /** Takes one attempt, BEFORE the code is compared. */
  take(now: number): Promise<RedeemTicket | RedeemLockRefusal>;
  /** A taken attempt did not redeem a code. */
  fail(ticket: RedeemTicket, now: number): Promise<RedeemFailure>;
  /** A taken attempt redeemed a code: the count and the lock are cleared. */
  succeed(): void;
  /** The lock state. Takes nothing. */
  status(now: number): Promise<RedeemLockStatus>;
  /** Forgets the count and the lock (a test; a restart does the same). */
  reset(): void;
}

export function createRedeemLock(): RedeemLock {
  const key = REDEEM_LOCK_KEY;
  const options = { points: REDEEM_LOCK_MAX_FAILURES, duration: REDEEM_LOCK_WINDOW_MS / 1000 };
  const attempts = new RateLimiterMemory({ keyPrefix: 'redeem-attempts', ...options });
  const failures = new RateLimiterMemory({ keyPrefix: 'redeem-failures', ...options });
  const windows = createFixedWindows(REDEEM_LOCK_WINDOW_MS);
  /** The end of the lock; null while redeeming is not locked. */
  let lockedUntil: number | null = null;

  /** The end of the lock at `now`; null when not locked. An ended lock is forgotten with its count. */
  function lockAt(now: number): number | null {
    if (lockedUntil === null) return null;
    if (now < lockedUntil) return lockedUntil;
    lockedUntil = null;
    windows.forget(key);
    return null;
  }

  function lock(now: number): number {
    lockedUntil = now + REDEEM_LOCK_DURATION_MS;
    return lockedUntil;
  }

  const refusal = (until: number, now: number): RedeemLockRefusal => ({ kind: 'LOCKED', lockedUntil: until, retryInMs: Math.max(0, until - now) });

  /** What the library holds under a counter after one more point. Rejects only if the limiter itself failed. */
  async function count(limiter: RateLimiterMemory, name: string): Promise<number> {
    try {
      return (await limiter.consume(name)).consumedPoints;
    } catch (rejection) {
      if (rejection instanceof RateLimiterRes) return REDEEM_LOCK_MAX_FAILURES + 1;
      throw rejection;
    }
  }

  async function takeIn(window: OpenWindow, now: number): Promise<RedeemTicket | RedeemLockRefusal> {
    const taken = await count(attempts, counterName(key, window));
    if (taken > REDEEM_LOCK_MAX_FAILURES) {
      // The counter is at its limit. The lock was set when the third attempt was taken; if none
      // is recorded, set one now: the answer is a refusal either way.
      return refusal(lockedUntil ?? lock(now), now);
    }
    if (taken === REDEEM_LOCK_MAX_FAILURES) lock(now);
    return { kind: 'TAKEN', windowId: window.id };
  }

  return {
    async take(now) {
      const until = lockAt(now);
      if (until !== null) return refusal(until, now);
      return takeIn(windows.open(key, now), now);
    },

    async fail(ticket, now) {
      const until = lockAt(now);
      let window = windows.current(key, now);
      if (window === null || window.id !== ticket.windowId) {
        // The window the attempt was taken in is over: a success cleared it, its lock ended or
        // its 300 s passed. The failure is still a failure, so it counts where the lock stands
        // NOW: what remains after a burst is the number of failures since the last success.
        if (until !== null) return { attemptsRemaining: 0, lockedUntil: until, retryInMs: Math.max(0, until - now) };
        window = windows.open(key, now);
        const again = await takeIn(window, now);
        if (again.kind === 'LOCKED') return { attemptsRemaining: 0, lockedUntil: again.lockedUntil, retryInMs: again.retryInMs };
      }
      const failed = Math.min(await count(failures, counterName(key, window)), REDEEM_LOCK_MAX_FAILURES);
      if (failed < REDEEM_LOCK_MAX_FAILURES) return { attemptsRemaining: REDEEM_LOCK_MAX_FAILURES - failed, lockedUntil: null, retryInMs: 0 };
      // The third failure of the window: the locking one. Three failures mean three taken
      // attempts, so the lock stands since the third was taken.
      const locked = lockedUntil ?? lock(now);
      return { attemptsRemaining: 0, lockedUntil: locked, retryInMs: Math.max(0, locked - now) };
    },

    succeed() {
      lockedUntil = null;
      windows.forget(key);
    },

    async status(now) {
      const until = lockAt(now);
      if (until !== null) return { locked: true, lockedUntil: until, retryInMs: until - now, attemptsRemaining: 0 };
      const window = windows.current(key, now);
      const failed = window === null ? 0 : ((await failures.get(counterName(key, window)))?.consumedPoints ?? 0);
      return { locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: Math.max(0, REDEEM_LOCK_MAX_FAILURES - failed) };
    },

    reset() {
      lockedUntil = null;
      windows.forget(key);
    },
  };
}
