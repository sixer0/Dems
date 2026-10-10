// Fix wave I, driver A1 - re-gate 75 finding G75b-02, the server facts.
//
//   1. "Resumed after restart" was shown with NO restart: `resumed` of operation 83 was "a step is
//      at an attempt above the first", and the attempt grows with every automatic retry of the same
//      process. On a Core in real capture `resumed` is now the sealing host's fact (a START of the
//      Core or the recovery action ran the seal again).
//   2. The alert of a blocked seal carries the cause as a closed code (`params.detail`), read by
//      both clients through `sealAttentionOf` of `@dems/shared/sim`.
import { validateCoreApiResponse } from '@dems/shared/api';
import { FINALIZATION_ORDER, SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_RETRYING_EXAMPLE_FINALIZATION, sealAttentionOf, sealBlockedNoticeOf, type ActiveSession, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { SEAL_BLOCKED_REASON, raiseSealBlockedTransition, resolveSealBlockedTransition } from '../../engine/sealing-notice-doors';
import { sealBlockedNotice, sealRetryingNotice, sealWaitingNotice, sealingFailureReason } from '../../sealing';
import { sealingProgressOf } from '../progress';

type Step = ActiveSession['finalization']['steps'][number];
const NOW = 1_791_637_000_000;
const SESSION = SEAL_BLOCKED_EXAMPLE_SESSION_ID;

/** The session of re-gate 75: step 1 failed at its fourth attempt, with no restart in between. */
const retried: Step[] = FINALIZATION_ORDER.map((id, index) => ({ id, status: index === 0 ? 'error' : 'pending', startedAt: index === 0 ? NOW - 155_000 : null, completedAt: null, durationMs: null, progress: 0, etaMs: null, detail: null, attempt: 4 }));
const session = { id: SESSION, state: 'FINALIZING' as const, finalization: { steps: retried, startedAt: NOW - 155_000, completedAt: null } };

describe('G75b-02: `resumed` of operation 83 is a fact, not the attempt count', () => {
  it('REPRODUCTION (the rule before, still the rule where the host has no fact - Simulated mode): attempt 4 reads resumed', () => {
    expect(sealingProgressOf(session, NOW).resumed).toBe(true);
    expect(sealingProgressOf(session, NOW, null).resumed).toBe(true);
  });

  it('THE FIX: the host says the seal was NOT resumed (automatic retries only) - `resumed: false` at attempt 4; it says resumed - true at attempt 1 too (control)', () => {
    const body = sealingProgressOf(session, NOW, false);
    expect(body.resumed).toBe(false);
    expect(body).toMatchObject({ sessionId: SESSION, progressPct: 0, etaMs: null });
    expect(body.steps[0]?.status).toBe('error');
    expect(validateCoreApiResponse('getSealingProgress', 200, body).ok).toBe(true);
    const first = { ...session, finalization: { ...session.finalization, steps: retried.map((step) => ({ ...step, attempt: 1 })) } };
    expect(sealingProgressOf(first, NOW, true).resumed).toBe(true);
    expect(sealingProgressOf(first, NOW, false).resumed).toBe(false);
  });
});

describe('G75b-01 / G75b-02: the alert of a blocked seal names the cause as a closed code', () => {
  const state = { session: { id: SESSION, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION }, alerts: [], meta: { counters: { ALR: 4 } } } as unknown as SimState;
  const input = { sessionId: SESSION, cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS', message: sealBlockedNotice('SEALER_FAILED', { cause: 'SESSION_KEY_STORE_UNAVAILABLE' }) };
  const raised = (detail?: string): SimState => {
    try {
      return raiseSealBlockedTransition(state, NOW, detail === undefined ? input : { ...input, detail });
    } catch (error) {
      // `nextItemId` reads the counters of a whole state: a rig that is too small says so instead of passing.
      throw new Error(`the rig of this test is not a state the transition takes: ${String(error)}`);
    }
  };

  it('`params.detail` is written for a code of the closed list and read by the shared reader as BLOCKED with that detail', () => {
    const next = raised('SESSION_KEY_STORE_UNAVAILABLE');
    const alert = next.alerts.at(-1);
    expect(alert).toMatchObject({ severity: 'CRITICAL', kind: 'SYSTEM', active: true, target: SESSION, params: { reason: SEAL_BLOCKED_REASON, cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS', sessionId: SESSION, detail: 'SESSION_KEY_STORE_UNAVAILABLE' } });
    // The shape the shared example promises to the clients is the shape the Core writes.
    expect(Object.keys(alert?.params ?? {}).sort()).toEqual(Object.keys(SEAL_BLOCKED_EXAMPLE_ALERT.params ?? {}).sort());
    expect(sealAttentionOf(next)).toMatchObject({ kind: 'BLOCKED', cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS', detail: 'SESSION_KEY_STORE_UNAVAILABLE', recordingKept: true });
    // THE EXAMPLES the clients build their tests on are the Core's own words, character for character.
    const cause = { cause: 'SESSION_KEY_STORE_UNAVAILABLE' };
    expect(alert?.message).toBe(SEAL_BLOCKED_EXAMPLE_ALERT.message);
    expect(SEAL_BLOCKED_EXAMPLE_FINALIZATION.steps[0]?.detail).toBe(sealWaitingNotice(sealingFailureReason('SEALER_FAILED', cause)));
    expect(SEAL_RETRYING_EXAMPLE_FINALIZATION.steps[0]?.detail).toBe(sealRetryingNotice({ action: 'RETRY', delayMs: 30_000, retry: 2, of: 3 }, sealingFailureReason('SEALER_FAILED', cause)));
    // Resolved when the seal completes or the session ends: nothing is said any more.
    expect(sealBlockedNoticeOf(resolveSealBlockedTransition(next, NOW + 1, { sessionId: SESSION }), SESSION)).toBeNull();
  });

  it('a detail outside the closed list is NOT written - never free text, a path or a key name in an alert (negative control); no detail: the alert of before', () => {
    for (const detail of ['/Users/x/.data/credential-store/KID-SES.key', 'something else', '']) {
      expect(raised(detail).alerts.at(-1)?.params).toEqual({ reason: SEAL_BLOCKED_REASON, cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS', sessionId: SESSION });
    }
    expect(raised().alerts.at(-1)?.params).toEqual({ reason: SEAL_BLOCKED_REASON, cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS', sessionId: SESSION });
    expect(sealAttentionOf(raised())).toMatchObject({ kind: 'BLOCKED', detail: null });
  });
});
