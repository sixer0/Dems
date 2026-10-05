/**
 * The `touchSession` throttle (HB-14; backend task 04_client_integration_spec §2.5 CL-27; 01_specs
 * ID-P9: the server extends the idle time-out on a POST or a touch, never on a GET or the socket).
 *
 * The shells call `touch()` on every pointer and key event. The server needs to hear about
 * activity at most once a minute:
 *
 * | Situation | What is sent |
 * |-----------|--------------|
 * | Activity, and no period is open (the first one, or the last period ended at least `intervalMs` ago) | One touch, at once. A period of `intervalMs` opens |
 * | Activity inside the period | Nothing now; the activity is remembered |
 * | The period ends and activity was remembered | One trailing touch, which opens the next period. The last activity is therefore always reported, at most `intervalMs` late |
 * | The period ends and nothing was remembered | Nothing. An open page with no activity sends no touch at all, so it cannot keep itself alive |
 * | Another POST of this client succeeded (`posted`) | Nothing: the server counted that POST as activity. The period starts again from now and what was remembered is forgotten |
 * | Activity while the link is not ONLINE | Nothing now; it is remembered **with its time** |
 * | The link is back (`flush`) | The remembered activity is sent when it is at most `intervalMs` old ("at most 60 s late", CL-27). Older activity is forgotten and nothing is sent: it would reach the server as activity of NOW and move the idle time-out by the whole time the link was down |
 * | Not signed in | Nothing, and nothing is remembered, as the simulator's `touch` does nothing then |
 *
 * Framework-free. The clock and the timer functions are injected.
 */
import type { GateTimers } from './command-gate';

export interface TouchThrottleOptions {
  readonly intervalMs: number;
  now(): number;
  readonly timers: GateTimers;
  /** True while an operator is signed in. */
  signedIn(): boolean;
  /** True while a request can be sent (the link is ONLINE). */
  online(): boolean;
  /** Sends one `touchSession`. It must not throw. */
  send(): void;
}

export interface TouchThrottle {
  /** Operator activity. True when a touch was sent now. */
  activity(): boolean;
  /** A POST of this client was answered 2xx. */
  posted(): void;
  /** The link is back: sends the touch that is owed, when one is and it is not older than the interval. */
  flush(): void;
  /** Sign-out and stop: closes the period and forgets what was remembered. */
  reset(): void;
  /** True while activity is remembered and not yet reported. */
  readonly pending: boolean;
}

export function createTouchThrottle(options: TouchThrottleOptions): TouchThrottle {
  const { intervalMs, timers } = options;
  /** When the open period started: a sent touch, or a successful POST. Null while no period was ever opened. */
  let periodStart: number | null = null;
  /** When the latest activity that was not reported yet happened; null when there is none. */
  let rememberedAt: number | null = null;
  let timer: { readonly handle: unknown } | null = null;

  const clearTimer = (): void => {
    if (timer === null) return;
    timers.clearTimeout(timer.handle);
    timer = null;
  };

  const periodOpen = (at: number): boolean => periodStart !== null && at - periodStart < intervalMs;

  /** Activity older than the interval is not reported any more: the server would count it as activity of now. */
  const fresh = (at: number): boolean => rememberedAt !== null && at - rememberedAt <= intervalMs;

  const fire = (at: number): void => {
    periodStart = at;
    rememberedAt = null;
    clearTimer();
    options.send();
  };

  const onPeriodEnd = (): void => {
    timer = null;
    if (rememberedAt === null) return;
    if (!options.signedIn()) {
      rememberedAt = null;
      return;
    }
    // Offline: the activity stays remembered, with its time; `flush` sends it when the link is back in time.
    if (options.online()) fire(options.now());
  };

  /** Arms the timer for the end of the open period. */
  const arm = (at: number): void => {
    if (timer !== null || periodStart === null) return;
    timer = { handle: timers.setTimeout(onPeriodEnd, Math.max(0, periodStart + intervalMs - at)) };
  };

  return {
    activity() {
      if (!options.signedIn()) return false;
      const at = options.now();
      if (periodOpen(at)) {
        rememberedAt = at;
        arm(at);
        return false;
      }
      if (!options.online()) {
        rememberedAt = at;
        return false;
      }
      fire(at);
      return true;
    },
    posted() {
      if (!options.signedIn()) return;
      periodStart = options.now();
      rememberedAt = null;
      clearTimer();
    },
    flush() {
      if (rememberedAt === null || !options.signedIn() || !options.online()) return;
      const at = options.now();
      if (!fresh(at)) {
        rememberedAt = null;
        return;
      }
      if (periodOpen(at)) arm(at);
      else fire(at);
    },
    reset() {
      periodStart = null;
      rememberedAt = null;
      clearTimer();
    },
    get pending() {
      return rememberedAt !== null;
    },
  };
}
