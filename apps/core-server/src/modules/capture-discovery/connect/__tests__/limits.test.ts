// The bounds of the connection tests on a manual clock (blueprint row 142; checks M4-SEC-CONN-4,
// M4-SEC-RATE-1 (test bounds), M4-SEC-AUD-1 (the mark of the guard); contract C3 §2.6 "Rate
// limits", §7; decision D86 C-2; SEC35-38, SEC35-39 (1)). No socket, no timer: `now()` is a number
// this file moves. Every bound has a control: the same sequence one step earlier is NOT refused.
import {
  CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS,
  CAPTURE_CONNECTION_TEST_MAX_FAILURES,
  CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE,
  CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS,
  CaptureConnectionOutcome,
  CaptureDiscoveryReason,
} from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { CONNECTION_TEST_BOUNDS, createConnectionTestLimits, type ConnectionTestLimits } from '../limits';

const HOST = '192.0.2.20';
const OTHER_HOST = '192.0.2.21';
const { AUTHENTICATION_FAILED, REACHABLE, UNREACHABLE, WRONG_PROFILE, NOT_H264 } = CaptureConnectionOutcome;

function fixture() {
  let at = 1_760_000_000_000;
  const limits = createConnectionTestLimits({ now: () => at });
  return {
    limits,
    advance(ms: number) {
      at += ms;
    },
  };
}

/** One whole test of `host` by `session`, after the spacing has passed. */
function run(f: ReturnType<typeof fixture>, host: string, session: string, outcome: CaptureConnectionOutcome, rejected = outcome === AUTHENTICATION_FAILED ? 1 : 0) {
  f.advance(CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS);
  expect(f.limits.refusal(host, session)).toBeNull();
  return f.limits.begin(host, session).end(outcome, rejected);
}

/** A session of its own for every call, so that only the bound under test can refuse. */
let sessions = 0;
const session = (): string => `S-${(sessions += 1)}`;

/** Lets the per-minute bound forget: the guard's window is far longer. */
const clearMinute = (f: ReturnType<typeof fixture>): void => f.advance(60_000);

describe('the values are the contract\'s, read by name (C3 §7; D86 C-2)', () => {
  it('2 failures per host in 30 minutes; 5 s spacing; 6 tests per minute', () => {
    expect(CONNECTION_TEST_BOUNDS).toEqual({ minIntervalMs: 5_000, maxPerMinute: 6, maxFailures: 2, failureWindowMs: 1_800_000 });
    expect(CONNECTION_TEST_BOUNDS).toEqual({
      minIntervalMs: CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS,
      maxPerMinute: CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE,
      maxFailures: CAPTURE_CONNECTION_TEST_MAX_FAILURES,
      failureWindowMs: CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS,
    });
  });
});

// Fix F-M4 follow-up (decision D181, ruling 3; erratum PE-FM4-03 of 03 §7): the guard counts
// REJECTED CREDENTIAL-BEARING REQUESTS, not outcomes. A test that ended AUTHENTICATION_FAILED with
// 0 such requests (the camera offered only a sign-in method the Core refuses: nothing was sent)
// cannot be a guess and never moves the operator towards a lock-out.
describe('D181 (3): a test in which no credential was sent is not counted by the lock-out guard', () => {
  it('ten AUTHENTICATION_FAILED tests with 0 rejected requests never close the host; the same number of real rejections does (control)', () => {
    const f = fixture();
    for (let index = 0; index < 10; index += 1) {
      clearMinute(f);
      expect(run(f, HOST, session(), AUTHENTICATION_FAILED, 0)).toEqual({ guardTripped: false, failedAttemptsRemaining: 2 });
    }
    expect(f.limits.remaining(HOST)).toBe(2);
    clearMinute(f);
    expect(f.limits.refusal(HOST, session())).toBeNull();

    const control = fixture();
    const verdicts = [];
    for (let index = 0; index < 2; index += 1) {
      clearMinute(control);
      verdicts.push(run(control, HOST, session(), AUTHENTICATION_FAILED, 1));
    }
    expect(verdicts).toEqual([{ guardTripped: false, failedAttemptsRemaining: 1 }, { guardTripped: true, failedAttemptsRemaining: 0 }]);
    clearMinute(control);
    expect(control.limits.refusal(HOST, session())).not.toBeNull();
  });

  it('a not-counted test does not forgive either: one real rejection, then one test with nothing sent, then one real rejection closes the host', () => {
    const f = fixture();
    clearMinute(f);
    expect(run(f, HOST, session(), AUTHENTICATION_FAILED, 1).failedAttemptsRemaining).toBe(1);
    clearMinute(f);
    expect(run(f, HOST, session(), AUTHENTICATION_FAILED, 0)).toEqual({ guardTripped: false, failedAttemptsRemaining: 1 });
    clearMinute(f);
    expect(run(f, HOST, session(), AUTHENTICATION_FAILED, 1)).toEqual({ guardTripped: true, failedAttemptsRemaining: 0 });
  });

  it('an adapter that does not count its requests (null) is counted as one rejection: unknown is never "nothing was sent"', () => {
    const f = fixture();
    clearMinute(f);
    expect(f.limits.begin(HOST, session()).end(AUTHENTICATION_FAILED, null).failedAttemptsRemaining).toBe(1);
  });
});

describe('M4-SEC-CONN-4: the lock-out guard', () => {
  it('two refused credentials on one host close it; the second is the one that trips the guard; a third test is refused', () => {
    const f = fixture();
    expect(f.limits.remaining(HOST)).toBe(2);
    expect(run(f, HOST, session(), AUTHENTICATION_FAILED)).toEqual({ guardTripped: false, failedAttemptsRemaining: 1 });
    // Control: after ONE failure the host is still open.
    f.advance(CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS);
    expect(f.limits.refusal(HOST, session())).toBeNull();
    expect(run(f, HOST, session(), AUTHENTICATION_FAILED)).toEqual({ guardTripped: true, failedAttemptsRemaining: 0 });
    f.advance(CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS);
    const refused = f.limits.refusal(HOST, session());
    expect(refused?.reason).toBe(CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD);
    expect(refused?.retryAfterMs).toBeGreaterThan(0);
    expect(refused?.retryAfterMs).toBeLessThanOrEqual(CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS);
    // A refused test cannot be started at all: nothing can reach the device.
    expect(() => f.limits.begin(HOST, session())).toThrow(/limits refuse/);
  });

  it('counted per Core BY HOST: another session, another operator and a new search do not reset it; another host is not touched', () => {
    const f = fixture();
    run(f, HOST, 'session-of-operator-A', AUTHENTICATION_FAILED);
    run(f, HOST, 'session-of-operator-B', AUTHENTICATION_FAILED);
    clearMinute(f);
    for (const other of ['session-of-operator-A', 'session-of-operator-C', 'the-same-operator-after-a-new-search']) {
      expect(f.limits.refusal(HOST, other)?.reason).toBe(CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD);
    }
    expect(f.limits.refusal(OTHER_HOST, session())).toBeNull();
    expect(f.limits.remaining(OTHER_HOST)).toBe(2);
  });

  it('counted per REJECTED REQUEST: one failed test whose two requests were refused closes the host by itself', () => {
    const f = fixture();
    expect(run(f, HOST, session(), AUTHENTICATION_FAILED, 2)).toEqual({ guardTripped: true, failedAttemptsRemaining: 0 });
    clearMinute(f);
    expect(f.limits.refusal(HOST, session())?.reason).toBe(CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD);
    // A failed outcome whose count is UNKNOWN still counts once: never less than what a camera may have counted.
    // Until decision D181 (ruling 3) a count of 0 was pinned here as one failure too; 0 now means "no credential was
    // sent" and is not counted (the cases of "D181 (3)" above).
    const g = fixture();
    expect(run(g, HOST, session(), AUTHENTICATION_FAILED, 0)).toEqual({ guardTripped: false, failedAttemptsRemaining: 2 });
    expect(run(g, HOST, session(), AUTHENTICATION_FAILED, Number.NaN)).toEqual({ guardTripped: false, failedAttemptsRemaining: 1 });
    expect(run(g, HOST, session(), AUTHENTICATION_FAILED, Number.NaN)).toEqual({ guardTripped: true, failedAttemptsRemaining: 0 });
  });

  it('reset by REACHABLE on that host', () => {
    const f = fixture();
    run(f, HOST, session(), AUTHENTICATION_FAILED);
    expect(run(f, HOST, session(), REACHABLE)).toEqual({ guardTripped: false, failedAttemptsRemaining: 2 });
    expect(run(f, HOST, session(), AUTHENTICATION_FAILED)).toEqual({ guardTripped: false, failedAttemptsRemaining: 1 });
    clearMinute(f);
    expect(f.limits.refusal(HOST, session())).toBeNull();
  });

  it('UNREACHABLE, WRONG_PROFILE and NOT_H264 do not count', () => {
    const f = fixture();
    run(f, HOST, session(), AUTHENTICATION_FAILED);
    for (const outcome of [UNREACHABLE, WRONG_PROFILE, NOT_H264]) {
      expect(run(f, HOST, session(), outcome)).toEqual({ guardTripped: false, failedAttemptsRemaining: 1 });
      clearMinute(f);
    }
    expect(f.limits.refusal(HOST, session())).toBeNull();
  });

  it('a failure leaves the count when the window has passed: the host opens again, and the answer says when', () => {
    const f = fixture();
    run(f, HOST, session(), AUTHENTICATION_FAILED);
    f.advance(10 * 60_000);
    run(f, HOST, session(), AUTHENTICATION_FAILED);
    clearMinute(f);
    const refused = f.limits.refusal(HOST, session());
    expect(refused?.reason).toBe(CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD);
    // One millisecond before the oldest failure leaves: still closed. Then: open, with one attempt left.
    f.advance((refused?.retryAfterMs ?? 0) - 1);
    expect(f.limits.refusal(HOST, session())?.reason).toBe(CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD);
    f.advance(1);
    expect(f.limits.refusal(HOST, session())).toBeNull();
    expect(f.limits.remaining(HOST)).toBe(1);
  });

  it('held in memory: a new object (a restart of the Core) knows nothing of it - stated, accepted', () => {
    const f = fixture();
    run(f, HOST, session(), AUTHENTICATION_FAILED, 2);
    expect(f.limits.remaining(HOST)).toBe(0);
    expect(fixture().limits.remaining(HOST)).toBe(2);
  });
});

describe('M4-SEC-RATE-1 (test bounds)', () => {
  it('one test at a time per Core: a second is refused while the first runs, on any host, for any session', () => {
    const f = fixture();
    const turn = f.limits.begin(HOST, 'A');
    expect(f.limits.busy()).toBe(true);
    f.advance(60_000);
    expect(f.limits.refusal(OTHER_HOST, 'B')).toEqual({ reason: CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS, retryAfterMs: 0 });
    turn.end(UNREACHABLE, 0);
    expect(f.limits.busy()).toBe(false);
    expect(f.limits.refusal(OTHER_HOST, 'B')).toBeNull();
    expect(() => turn.end(UNREACHABLE, 0)).toThrow(/ended twice/);
  });

  it('an abandoned turn frees the Core and counts nothing toward the guard', () => {
    const f = fixture();
    f.limits.begin(HOST, 'A').abandon();
    expect(f.limits.busy()).toBe(false);
    expect(f.limits.remaining(HOST)).toBe(2);
  });

  it('5 s between two attempts on one host, whoever asks', () => {
    const f = fixture();
    f.limits.begin(HOST, 'A').end(UNREACHABLE, 0);
    f.advance(CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS - 1);
    expect(f.limits.refusal(HOST, 'B')).toEqual({ reason: CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED, retryAfterMs: 1 });
    // Control: another host, another session: free.
    expect(f.limits.refusal(OTHER_HOST, 'B')).toBeNull();
    f.advance(1);
    expect(f.limits.refusal(HOST, 'B')).toBeNull();
  });

  it('5 s between two tests of one operator session, on any host (SEC35-39 (1))', () => {
    const f = fixture();
    f.limits.begin(HOST, 'A').end(UNREACHABLE, 0);
    f.advance(CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS - 1);
    expect(f.limits.refusal(OTHER_HOST, 'A')?.reason).toBe(CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED);
    f.advance(1);
    expect(f.limits.refusal(OTHER_HOST, 'A')).toBeNull();
  });

  it('6 tests per minute per Core, all sessions and hosts together', () => {
    const f = fixture();
    const start = (limits: ConnectionTestLimits, index: number): void => {
      limits.begin(`192.0.2.${100 + index}`, `S${index}`).end(UNREACHABLE, 0);
    };
    for (let index = 0; index < CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE; index += 1) {
      // Control: the first six are not refused.
      expect(f.limits.refusal(`192.0.2.${100 + index}`, `S${index}`)).toBeNull();
      start(f.limits, index);
      f.advance(1_000);
    }
    const seventh = f.limits.refusal('192.0.2.200', 'S-seventh');
    expect(seventh?.reason).toBe(CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED);
    // The first start was 6 s ago: 54 s until it leaves the minute.
    expect(seventh?.retryAfterMs).toBe(54_000);
    f.advance(54_000);
    expect(f.limits.refusal('192.0.2.200', 'S-seventh')).toBeNull();
  });
});
