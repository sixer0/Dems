/**
 * The bounds of the connection tests of one Core: single flight, spacing, the per-minute bound and
 * the LOCK-OUT GUARD (blueprint row 142; contract C3 §2.6 "Rate limits", §7; capture spec §A.6.2
 * CT-5; decision D86 C-2; SEC35-38, SEC35-39 (1), SEC35-46 (a)).
 *
 * Operation 95 and the re-verification of operation 96 count alike. Everything here is decided
 * BEFORE a request leaves: a refusal makes 0 outbound requests and writes no audit row.
 *
 *   one test at a time per Core                           409 CONNECTION_TEST_IN_PROGRESS
 *   `minIntervalMs` between two attempts on one host,
 *     and between two tests of one operator session       429 CONNECTION_TEST_RATE_LIMITED
 *   `maxPerMinute` tests per Core                         429 CONNECTION_TEST_RATE_LIMITED
 *   `maxFailures` refused credentials per host inside
 *     `failureWindowMs`                                   429 CONNECTION_TEST_LOCKOUT_GUARD
 *
 * THE LOCK-OUT GUARD. `CAPTURE_CONNECTION_TEST_MAX_FAILURES = 2` per host in
 * `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS = 1_800_000`. This value is a conservative default
 * and is not derived from any camera's documentation. Before the first test against a real camera
 * the user is asked for that model's lock-out rule and the constant is re-pinned (class C-1 entry
 * item). What it counts is what a camera counts: REJECTED REQUESTS that carried a credential - an
 * `AUTHENTICATION_FAILED` outcome counts the requests the device refused, and at least one.
 *
 *   counted per Core BY HOST - never by account name, never by candidate, session or operator: a
 *     new search, another session or another operator does not reset it;
 *   reset by a `REACHABLE` outcome on that host;
 *   `UNREACHABLE`, `WRONG_PROFILE` and `NOT_H264` do not count;
 *   held in memory: a restart of the Core clears it (accepted: a restart needs host access and is
 *     itself in the log);
 *   the failure that fills the window is marked (`guardTripped`), so that its audit row says so.
 *
 * TIME is the caller's: `now()` is the server clock, and a test passes a manual one. The file
 * names no timer.
 */
import {
  CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS,
  CAPTURE_CONNECTION_TEST_MAX_FAILURES,
  CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE,
  CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS,
  CaptureConnectionOutcome,
  CaptureDiscoveryReason,
} from '@dems/shared/api';

export interface ConnectionTestBounds {
  readonly minIntervalMs: number;
  readonly maxPerMinute: number;
  readonly maxFailures: number;
  readonly failureWindowMs: number;
}

/** The contract's values, read by name (C3 §7). */
export const CONNECTION_TEST_BOUNDS: ConnectionTestBounds = Object.freeze({
  minIntervalMs: CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS,
  maxPerMinute: CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE,
  maxFailures: CAPTURE_CONNECTION_TEST_MAX_FAILURES,
  failureWindowMs: CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS,
});

const MINUTE_MS = 60_000;
/** Hosts and sessions remembered at most; the oldest entry leaves first. A search lists at most 64 candidates. */
const MAX_KEYS = 1_024;

export type ConnectionTestRefusalReason =
  | typeof CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS
  | typeof CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED
  | typeof CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD;

/** Why a test may not start now. `retryAfterMs` is 0 for a test in progress (it ends within the test deadline). */
export interface ConnectionTestRefusal {
  readonly reason: ConnectionTestRefusalReason;
  readonly retryAfterMs: number;
}

/** What an outcome did to the guard of its host. */
export interface GuardVerdict {
  /** True on the failure that filled the window: the next test of this host is refused. */
  readonly guardTripped: boolean;
  /** Refused credentials this host may still see before the guard closes. */
  readonly failedAttemptsRemaining: number;
}

export interface ConnectionTestTurn {
  /**
   * Ends the turn and records its outcome. `rejectedRequests` is how many requests that carried
   * the credential the device refused; `null` when the adapter does not count them.
   *
   * WHAT THE GUARD COUNTS (decision D181, ruling 3; erratum PE-FM4-03 of 03 §7): REJECTED
   * CREDENTIAL-BEARING REQUESTS, not outcomes. An `AUTHENTICATION_FAILED` test with 0 of them -
   * the camera offered only a sign-in method the Core refuses (`SCHEME_NOT_ALLOWED`), or asked
   * for a credential when none was typed - sent no credential: it cannot be a guess, a camera
   * cannot lock an account for it, and it adds nothing. It forgives nothing either (only
   * `REACHABLE` resets). `null` (unknown) counts as one: unknown is never "nothing was sent".
   * Calling it twice is a mistake of the caller and throws.
   */
  end(outcome: CaptureConnectionOutcome, rejectedRequests: number | null): GuardVerdict;
  /** Ends the turn without an outcome: the test never ran (a failure before the first request). */
  abandon(): void;
}

export interface ConnectionTestLimits {
  /** Null when a test of `host` by `sessionKey` may start now. Changes nothing. */
  refusal(host: string, sessionKey: string): ConnectionTestRefusal | null;
  /**
   * Takes the Core's one turn for a test of `host`. Throws when `refusal` would not answer null:
   * the caller asks first, in the same turn of the event loop.
   */
  begin(host: string, sessionKey: string): ConnectionTestTurn;
  /** Refused credentials `host` may still see before the guard closes. */
  remaining(host: string): number;
  /** True while a test runs. */
  busy(): boolean;
}

export function createConnectionTestLimits(options: { readonly now: () => number; readonly bounds?: Partial<ConnectionTestBounds> }): ConnectionTestLimits {
  const bounds: ConnectionTestBounds = { ...CONNECTION_TEST_BOUNDS, ...options.bounds };
  const { now } = options;
  /** When each refused credential of a host was counted, oldest first. */
  const failures = new Map<string, number[]>();
  const lastByHost = new Map<string, number>();
  const lastBySession = new Map<string, number>();
  /** The starts of the last minute, oldest first. */
  let starts: number[] = [];
  let running = false;

  const remember = (map: Map<string, number>, key: string, at: number): void => {
    map.delete(key);
    map.set(key, at);
    if (map.size > MAX_KEYS) for (const oldest of map.keys()) {
      map.delete(oldest);
      break;
    }
  };

  const liveFailures = (host: string, at: number): number[] => {
    const kept = (failures.get(host) ?? []).filter((counted) => at - counted < bounds.failureWindowMs);
    if (kept.length === 0) failures.delete(host);
    else failures.set(host, kept);
    return kept;
  };

  const remaining = (host: string): number => Math.max(0, bounds.maxFailures - liveFailures(host, now()).length);

  const refusal = (host: string, sessionKey: string): ConnectionTestRefusal | null => {
    const at = now();
    if (running) return { reason: CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS, retryAfterMs: 0 };
    // The guard first: it is the bound that protects the camera's own lock-out counter.
    const counted = liveFailures(host, at);
    if (counted.length >= bounds.maxFailures) {
      // Open again when enough of the oldest failures have left the window.
      const leaving = counted[counted.length - bounds.maxFailures] ?? at;
      return { reason: CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD, retryAfterMs: Math.max(1, leaving + bounds.failureWindowMs - at) };
    }
    const spacing = Math.max(...[lastByHost.get(host), lastBySession.get(sessionKey)].map((last) => (last === undefined ? 0 : last + bounds.minIntervalMs - at)));
    if (spacing > 0) return { reason: CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED, retryAfterMs: spacing };
    starts = starts.filter((started) => at - started < MINUTE_MS);
    if (starts.length >= bounds.maxPerMinute) return { reason: CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED, retryAfterMs: Math.max(1, (starts[0] ?? at) + MINUTE_MS - at) };
    return null;
  };

  return {
    refusal,
    remaining,
    busy: () => running,
    begin(host, sessionKey) {
      if (refusal(host, sessionKey) !== null) throw new Error('a connection test was started although the limits refuse it');
      const at = now();
      running = true;
      starts.push(at);
      remember(lastByHost, host, at);
      remember(lastBySession, sessionKey, at);
      let open = true;
      const close = (): void => {
        if (!open) throw new Error('the turn of a connection test was ended twice');
        open = false;
        running = false;
      };
      return {
        abandon: close,
        end(outcome, rejectedRequests) {
          close();
          const ended = now();
          if (outcome === CaptureConnectionOutcome.REACHABLE) {
            failures.delete(host);
            return { guardTripped: false, failedAttemptsRemaining: bounds.maxFailures };
          }
          if (outcome !== CaptureConnectionOutcome.AUTHENTICATION_FAILED) return { guardTripped: false, failedAttemptsRemaining: remaining(host) };
          const before = liveFailures(host, ended);
          // D181 (3): a test that sent no credential is not a failure of the guard.
          if (rejectedRequests === 0) return { guardTripped: false, failedAttemptsRemaining: remaining(host) };
          const added = rejectedRequests !== null && Number.isInteger(rejectedRequests) && rejectedRequests > 0 ? rejectedRequests : 1;
          const after = [...before, ...Array.from({ length: added }, () => ended)].slice(-bounds.maxFailures * 4);
          failures.delete(host);
          failures.set(host, after);
          if (failures.size > MAX_KEYS) {
            // Never the entry just written, and never a host whose guard is closed: an open, old one leaves.
            for (const [other, counted] of failures) {
              if (other !== host && counted.length < bounds.maxFailures) {
                failures.delete(other);
                break;
              }
            }
          }
          return { guardTripped: before.length < bounds.maxFailures && after.length >= bounds.maxFailures, failedAttemptsRemaining: Math.max(0, bounds.maxFailures - after.length) };
        },
      };
    },
  };
}
