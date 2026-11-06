/**
 * The sign-in lockout of a console (plan row W24; spec §5.1 ID-P1 to ID-P3, §5.2 ID-5, §8.2
 * ENG-24; SR-22, SR-25, SR-72; database contract §5.6 AT-6, AT-C1).
 *
 * 5 attempts of one console within 300 s lock it for 60 s. The key is the console: `web` for the
 * web console, the registry ID for a paired device; never an address, because every client
 * arrives from 127.0.0.1. The counters are memory state and reset at a restart (SR-25).
 *
 * AN ATTEMPT IS TAKEN BEFORE IT IS VERIFIED (ENG-24). The order of a sign-in is:
 *
 *   take()      one attempt leaves the counter, or the console is locked and nothing is verified;
 *   (the password hash is computed)
 *   succeed()   the attempt was right: the count and the lock of the console are cleared; or
 *   fail()      the attempt was wrong: it stays counted, and the fifth failure is the locking one.
 *
 * So n attempts that arrive together are n counted attempts, whatever the order in which their
 * verifications end: of 20 at once, five are taken and verified and 15 find the console locked.
 *
 * THE ARITHMETIC.
 *   - A window opens at the console's first taken attempt and ends 300 s later; a success or the
 *     end of a lock closes it earlier. A new window is a fresh count.
 *   - Taking the FIFTH attempt of a window locks the console at once, for 60 s from that moment:
 *     the limit is reached, and whoever comes next is refused although the five verifications
 *     may still be running. If one of the five turns out right, the lock is lifted with the
 *     count (a success clears the counter).
 *   - `attemptsRemaining` is 5 minus the FAILURES recorded in the window, as in the simulator;
 *     the failure that makes it 0 is the one whose audit row says it locked.
 *   - A lock that has ended starts a fresh count.
 *
 * Both counters are memory limiters of `rate-limiter-flexible`; nothing here counts by hand. The
 * library measures its own windows with the system time and takes no clock, so, exactly as the
 * throttle does, the window is decided by the SERVER clock (`core/windows.ts`) and
 * named in the key the library counts under. The lock's end is an instant of the server clock.
 *
 * The module calls `take`, `fail` and `succeed` inside units of the serial pipeline, so they
 * never interleave. They do not depend on that: each one changes the counters before its first
 * `await`, and a refusal that finds no lock recorded sets one (it fails closed).
 */
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { counterName, createFixedWindows, type OpenWindow } from '../../core';
import { LOCKOUT_DURATION_MS, LOCKOUT_MAX_ATTEMPTS, LOCKOUT_WINDOW_MS } from './limits';

/** One attempt that left the counter. It is handed back to `fail`. */
export interface AttemptTicket {
  readonly kind: 'TAKEN';
  /** The window the attempt was counted in. */
  readonly windowId: number;
}

/** The console is locked: nothing is verified. */
export interface LockRefusal {
  readonly kind: 'LOCKED';
  /** End of the lock, epoch milliseconds of the server clock. */
  readonly lockedUntil: number;
  readonly retryInMs: number;
}

/** What a failed attempt leaves behind. */
export interface FailureOutcome {
  /** Failures left before the lock; 0 for the failure that locks and while the console is locked. */
  readonly attemptsRemaining: number;
  /** Set when this failure is the locking one, or when the console is locked anyway. */
  readonly lockedUntil: number | null;
  readonly retryInMs: number;
}

/** The members of the simulator's `LockoutStatus` (`packages/shared/src/sim/auth.ts`). */
export interface ConsoleLockStatus {
  readonly locked: boolean;
  readonly lockedUntil: number | null;
  readonly retryInMs: number;
  readonly attemptsRemaining: number;
}

export interface ConsoleLockout {
  /** Takes one attempt of the console, BEFORE its verification. */
  take(key: string, now: number): Promise<AttemptTicket | LockRefusal>;
  /** The verification of a taken attempt failed. */
  fail(key: string, ticket: AttemptTicket, now: number): Promise<FailureOutcome>;
  /** A taken attempt was verified: the count and the lock of the console are cleared. */
  succeed(key: string): void;
  /** The lock state of a console. Takes nothing. */
  status(key: string, now: number): Promise<ConsoleLockStatus>;
  /** Forgets one console, or every console (a test; a restart does the same). */
  reset(key?: string): void;
}

export function createConsoleLockout(): ConsoleLockout {
  const options = { points: LOCKOUT_MAX_ATTEMPTS, duration: LOCKOUT_WINDOW_MS / 1000 };
  const attempts = new RateLimiterMemory({ keyPrefix: 'sign-in-attempts', ...options });
  const failures = new RateLimiterMemory({ keyPrefix: 'sign-in-failures', ...options });
  const windows = createFixedWindows(LOCKOUT_WINDOW_MS);
  /** Console key to the end of its lock. */
  const locks = new Map<string, number>();

  /** The end of the console's lock at `now`; null when it is not locked. An ended lock is forgotten with its count. */
  function lockOf(key: string, now: number): number | null {
    const lockedUntil = locks.get(key);
    if (lockedUntil === undefined) return null;
    if (now < lockedUntil) return lockedUntil;
    locks.delete(key);
    windows.forget(key);
    return null;
  }

  function lock(key: string, now: number): number {
    const lockedUntil = now + LOCKOUT_DURATION_MS;
    locks.set(key, lockedUntil);
    return lockedUntil;
  }

  const refusal = (lockedUntil: number, now: number): LockRefusal => ({
    kind: 'LOCKED',
    lockedUntil,
    retryInMs: Math.max(0, lockedUntil - now),
  });

  /** What the library holds under a counter, never more than the limit. Rejects only if the limiter itself failed. */
  async function count(limiter: RateLimiterMemory, name: string): Promise<number> {
    try {
      return (await limiter.consume(name)).consumedPoints;
    } catch (rejection) {
      if (rejection instanceof RateLimiterRes) return LOCKOUT_MAX_ATTEMPTS + 1;
      throw rejection;
    }
  }

  async function takeIn(key: string, window: OpenWindow, now: number): Promise<AttemptTicket | LockRefusal> {
    const taken = await count(attempts, counterName(key, window));
    if (taken > LOCKOUT_MAX_ATTEMPTS) {
      // The counter is at its limit. The lock was set when the fifth attempt was taken; if none
      // is recorded, set one now: the answer is a refusal either way.
      return refusal(locks.get(key) ?? lock(key, now), now);
    }
    if (taken === LOCKOUT_MAX_ATTEMPTS) lock(key, now);
    return { kind: 'TAKEN', windowId: window.id };
  }

  return {
    async take(key, now) {
      const lockedUntil = lockOf(key, now);
      if (lockedUntil !== null) return refusal(lockedUntil, now);
      return takeIn(key, windows.open(key, now), now);
    },

    async fail(key, ticket, now) {
      const lockedUntil = lockOf(key, now);
      let window = windows.current(key, now);
      if (window === null || window.id !== ticket.windowId) {
        // The window the attempt was taken in is over: a success cleared it, its lock ended or
        // its 300 s passed. The failure is still a failure, so it counts where the console
        // stands NOW. Order therefore does not matter: what remains after a burst is the number
        // of failures since the last success.
        if (lockedUntil !== null) return { attemptsRemaining: 0, lockedUntil, retryInMs: Math.max(0, lockedUntil - now) };
        window = windows.open(key, now);
        const again = await takeIn(key, window, now);
        if (again.kind === 'LOCKED') return { attemptsRemaining: 0, lockedUntil: again.lockedUntil, retryInMs: again.retryInMs };
      }
      const failed = Math.min(await count(failures, counterName(key, window)), LOCKOUT_MAX_ATTEMPTS);
      if (failed < LOCKOUT_MAX_ATTEMPTS) return { attemptsRemaining: LOCKOUT_MAX_ATTEMPTS - failed, lockedUntil: null, retryInMs: 0 };
      // The fifth failure of the window: the locking one. Five failures mean five taken
      // attempts, so the lock stands since the fifth was taken.
      const until = locks.get(key) ?? lock(key, now);
      return { attemptsRemaining: 0, lockedUntil: until, retryInMs: Math.max(0, until - now) };
    },

    succeed(key) {
      locks.delete(key);
      windows.forget(key);
    },

    async status(key, now) {
      const lockedUntil = lockOf(key, now);
      if (lockedUntil !== null) return { locked: true, lockedUntil, retryInMs: lockedUntil - now, attemptsRemaining: 0 };
      const window = windows.current(key, now);
      const failed = window === null ? 0 : ((await failures.get(counterName(key, window)))?.consumedPoints ?? 0);
      return {
        locked: false,
        lockedUntil: null,
        retryInMs: 0,
        attemptsRemaining: Math.max(0, LOCKOUT_MAX_ATTEMPTS - failed),
      };
    },

    reset(key) {
      if (key === undefined) locks.clear();
      else locks.delete(key);
      windows.forget(key);
    },
  };
}
