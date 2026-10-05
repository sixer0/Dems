/**
 * The denial budget (plan row W23; spec §5.1 ID-P13, §4.6 RB-4 and RB-6; SR-71; assumption
 * SA-14): per throttle key at most 20 audited refusals within 60 s. The counter is a memory
 * limiter of `rate-limiter-flexible`; nothing here counts by hand.
 *
 * Two questions are asked of it:
 *   - `take`   by the row that is about to write a refusal's audit row: is there a place left?
 *              The place is taken BEFORE the row is written, so that refusals which arrive
 *              together cannot write more than 20 rows between them;
 *   - `check`  by stage 5 for every REST request: has the key used up its budget? Then the
 *              request is answered 429 before it reaches the guard, and writes no row.
 *
 * Time. The library measures its windows with the system time and takes no clock. The window is
 * therefore named in the counter's key (`core/windows.ts`): it opens at the key's first refusal and
 * ends 60 s later by the server clock, which a test can drive by hand (SA-14: "advanced by a
 * test"). `reset` forgets the window (SA-14: "reset by a test").
 */
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { DENIAL_BUDGET_MAX, DENIAL_BUDGET_WINDOW_MS, type ThrottleKey } from './limits';
import { counterName, createFixedWindows, retryAfterSeconds, type OpenWindow } from '../../core';

/** The budget of one key as stage 5 sees it at one instant. */
export interface DenialBudgetSnapshot {
  readonly key: ThrottleKey;
  /** 20 (ID-P13). */
  readonly limit: number;
  /** Refusals that took a place in the open window; 0 when no window is open. */
  readonly used: number;
  readonly remaining: number;
  /** True while the key holds `limit` refusals: its REST requests answer 429, except health. */
  readonly exhausted: boolean;
  /** When the open window ends, by the server clock (epoch milliseconds); null when none is open. */
  readonly windowEndsAt: number | null;
}

/** The budget has no place left for the key. */
export interface BudgetRefusal {
  /** For the `retry-after` header: whole seconds until the key's window ends. */
  readonly retryAfterSeconds: number;
  /** True once per window: the first time the key is turned away in it (for one log line). */
  readonly first: boolean;
}

export interface KeyedDenialBudget {
  /** Takes one of the key's places. Null when a place was taken; a refusal when none is left. */
  take(key: ThrottleKey, now: number): Promise<BudgetRefusal | null>;
  /** Null while the key has a place left; a refusal once it holds `limit` refusals. Takes nothing. */
  check(key: ThrottleKey, now: number): Promise<BudgetRefusal | null>;
  inspect(key: ThrottleKey, now: number): Promise<DenialBudgetSnapshot>;
  /** Forgets the window of one key, or of every key. */
  reset(key?: ThrottleKey): void;
}

export function createDenialBudget(): KeyedDenialBudget {
  const limiter = new RateLimiterMemory({
    keyPrefix: 'denial-budget',
    points: DENIAL_BUDGET_MAX,
    duration: DENIAL_BUDGET_WINDOW_MS / 1000,
  });
  const windows = createFixedWindows(DENIAL_BUDGET_WINDOW_MS);

  function refusal(window: OpenWindow, now: number): BudgetRefusal {
    const first = !window.announced;
    window.announced = true;
    return { retryAfterSeconds: retryAfterSeconds(window, now), first };
  }

  /** What the library holds for the window, never more than the limit. */
  async function usedIn(key: ThrottleKey, window: OpenWindow): Promise<number> {
    const state = await limiter.get(counterName(key, window));
    return Math.min(state?.consumedPoints ?? 0, DENIAL_BUDGET_MAX);
  }

  return {
    async take(key, now) {
      const window = windows.open(key, now);
      try {
        await limiter.consume(counterName(key, window));
        return null;
      } catch (rejection) {
        // The library rejects with its result object when the points are used up, and with an
        // error when the limiter itself failed.
        if (rejection instanceof RateLimiterRes) return refusal(window, now);
        throw rejection;
      }
    },

    async check(key, now) {
      const window = windows.current(key, now);
      if (window === null) return null;
      return (await usedIn(key, window)) >= DENIAL_BUDGET_MAX ? refusal(window, now) : null;
    },

    async inspect(key, now) {
      const window = windows.current(key, now);
      const used = window === null ? 0 : await usedIn(key, window);
      return {
        key,
        limit: DENIAL_BUDGET_MAX,
        used,
        remaining: DENIAL_BUDGET_MAX - used,
        exhausted: used >= DENIAL_BUDGET_MAX,
        windowEndsAt: window === null ? null : window.endsAt,
      };
    },

    reset(key) {
      windows.forget(key);
    },
  };
}
