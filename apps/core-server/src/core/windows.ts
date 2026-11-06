/**
 * Fixed windows measured by the server clock (plan row W23; spec ID-P12, ID-P13; ENG-13, ENG-16).
 *
 * Clock arithmetic with no dependency. It lives in the core, beside the clock, because three
 * units count in such windows: the throttle with its denial budget (`plugins/throttle`), the
 * sign-in lockout (`modules/identity`) and the redeem lock (`modules/pairing`). Each imports it
 * from the core's index (review finding CPB1-16, decision D78 DN-11).
 *
 * The two limiter libraries count; this file only says WHICH window a key is in. Both libraries
 * measure their own windows with the system time and have no option to take a clock, so a test
 * that drives the server clock by hand (the seam `clock`) could not move them. A counter
 * therefore names the window in the key it counts under: `<key>#<window id>`.
 * A new window is a new counter; the old one is left to the library's own expiry.
 *
 * A window opens at the first counted event of its key and ends `lengthMs` later, by the time
 * the caller passes in. With the production clock (the wall clock) that is the fixed window the
 * libraries would keep by themselves; with a manual clock the window follows the test.
 *
 * Keys are never values a caller supplies (SR-75): a principal's ID or one of two fixed
 * classes. So the map holds at most one entry per operator, per device and per class.
 */

export interface OpenWindow {
  /** Unique within its `FixedWindows`; part of the counter name, so a new window counts afresh. */
  readonly id: number;
  readonly startedAt: number;
  /** The first instant that no longer belongs to the window. */
  readonly endsAt: number;
  /** Set by the owner once it has logged that the window's limit was reached. */
  announced: boolean;
}

export interface FixedWindows {
  readonly lengthMs: number;
  /** The key's open window at `now`, or null when none is open. Opens nothing. */
  current(key: string, now: number): OpenWindow | null;
  /** The key's open window at `now`; opens one when none is open. */
  open(key: string, now: number): OpenWindow;
  /** Closes the window of one key, or of every key. The next event opens a new one. */
  forget(key?: string): void;
}

export function createFixedWindows(lengthMs: number): FixedWindows {
  const windows = new Map<string, OpenWindow>();
  let lastId = 0;

  function current(key: string, now: number): OpenWindow | null {
    const window = windows.get(key);
    if (window === undefined) return null;
    // The server clock never moves backwards (ENG-14). A time before the window's start means
    // that the clock itself was replaced, and the window belongs to the old one.
    if (now >= window.startedAt && now < window.endsAt) return window;
    windows.delete(key);
    return null;
  }

  return {
    lengthMs,
    current,
    open(key, now) {
      const existing = current(key, now);
      if (existing !== null) return existing;
      lastId += 1;
      const opened: OpenWindow = { id: lastId, startedAt: now, endsAt: now + lengthMs, announced: false };
      windows.set(key, opened);
      return opened;
    },
    forget(key) {
      if (key === undefined) windows.clear();
      else windows.delete(key);
    },
  };
}

/** The name a limiter library counts under: the key and the window it is in. */
export function counterName(key: string, window: OpenWindow): string {
  return `${key}#${window.id}`;
}

/** `retry-after` in whole seconds: at least 1, so a client never retries at once. */
export function retryAfterSeconds(window: OpenWindow, now: number): number {
  return Math.max(1, Math.ceil((window.endsAt - now) / 1000));
}
