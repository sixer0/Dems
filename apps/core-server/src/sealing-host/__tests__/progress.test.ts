// Operation 83's answer (blueprint row 82b; C3 §2.2 op 83; D121): derived from the session's
// `finalization` slice only. Pure: no app, no clock.
import { validateCoreApiResponse } from '@dems/shared/api';
import { FINALIZATION_ORDER, SEALING_ETA_STEP_MS, type ActiveSession, SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_RETRYING_EXAMPLE_FINALIZATION, sealAttentionOf, sealBlockedNoticeOf, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { isTimedSeal, sealingProgressOf } from '../progress';
import { SEAL_BLOCKED_REASON, raiseSealBlockedTransition, resolveSealBlockedTransition } from '../../engine/sealing-notice-doors';
import { sealBlockedNotice, sealRetryingNotice, sealWaitingNotice, sealingFailureReason } from '../../sealing';

type Step = ActiveSession['finalization']['steps'][number];
const NOW = 1_791_529_000_000;

/** A seal the Core's pipeline drives: no planned duration on a step that is not done. */
const coreStep = (index: number, running: number, progress: number, etaMs: number | null, attempt = 1): Step => {
  const id = FINALIZATION_ORDER[index]!;
  if (index < running) return { id, status: 'done', startedAt: NOW - 9_000, completedAt: NOW - 8_000, durationMs: 1_000, progress: 100, etaMs: 0, detail: null, attempt };
  if (index === running) return { id, status: 'active', startedAt: NOW - 2_000, completedAt: null, durationMs: null, progress, etaMs, detail: '3 of 9 fragments (VIDEO-01)', attempt };
  return { id, status: 'pending', startedAt: null, completedAt: null, durationMs: null, progress: 0, etaMs: null, detail: null, attempt };
};
const session = (steps: Step[], state: ActiveSession['state'] = 'FINALIZING') => ({ id: 'SES-20261009-0001', state, finalization: { steps, startedAt: NOW - 9_000, completedAt: null } });
const core = (running: number, progress: number, etaMs: number | null, attempt = 1): Step[] => FINALIZATION_ORDER.map((_id, index) => coreStep(index, running, progress, etaMs, attempt));

describe('operation 83: the progress of a seal the pipeline drives', () => {
  it('progressPct is formed from the PER-STEP percent, and etaMs is the RUNNING step\'s own remaining time', () => {
    const body = sealingProgressOf(session(core(1, 50, 4_200)), NOW);
    // One step done (100) + the running step at 50 of six steps: 150 / 600.
    expect(body).toMatchObject({ sessionId: 'SES-20261009-0001', state: 'FINALIZING', progressPct: 25, etaMs: 4_200, resumed: false, updatedAt: NOW });
    expect(body.steps.map((step) => step.status)).toEqual(['done', 'active', 'pending', 'pending', 'pending', 'pending']);
    expect(Object.keys(body.steps[1]!).sort()).toEqual(['completedAt', 'durationMs', 'id', 'startedAt', 'status']);
  });

  it('CONTROL: the percent follows the running step (it is not a count of finished steps) and the ETA is not a figure per remaining step', () => {
    expect(sealingProgressOf(session(core(1, 0, 4_200)), NOW).progressPct).toBe(16);
    expect(sealingProgressOf(session(core(1, 99, 10)), NOW)).toMatchObject({ progressPct: 33, etaMs: 10 });
    expect(sealingProgressOf(session(core(1, 50, 4_200)), NOW).etaMs).not.toBe(Math.round(4.5 * SEALING_ETA_STEP_MS));
  });

  it('no estimate yet is null, a failed step leaves no running step (null), every step done is 0', () => {
    expect(sealingProgressOf(session(core(0, 2, null)), NOW).etaMs).toBeNull();
    const failed = core(1, 40, 900).map((step, index): Step => (index === 1 ? { ...step, status: 'error', etaMs: null, detail: 'Camera file VIDEO-02 holds no whole recording (MISSING): this session cannot be sealed.' } : step));
    expect(sealingProgressOf(session(failed), NOW)).toMatchObject({ etaMs: null, progressPct: 16 });
    expect(sealingProgressOf(session(failed), NOW).steps[1]?.status).toBe('error');
    expect(sealingProgressOf(session(core(6, 0, null), 'SEALED'), NOW)).toMatchObject({ etaMs: 0, progressPct: 100, state: 'SEALED' });
  });

  it('a resumed seal (an attempt above the first) says so', () => {
    expect(sealingProgressOf(session(core(2, 10, 300, 2)), NOW).resumed).toBe(true);
    expect(sealingProgressOf(session(core(2, 10, 300, 1)), NOW).resumed).toBe(false);
  });

  it('every answer has the shape the contract documents for operation 83', () => {
    for (const steps of [core(0, 0, null), core(3, 70, 12), core(6, 0, null)]) {
      expect(validateCoreApiResponse('getSealingProgress', 200, sealingProgressOf(session(steps), NOW))).toMatchObject({ ok: true });
    }
  });
});

describe('operation 83: the timed seal of Simulated mode keeps the simulator\'s own figures', () => {
  const timed = (running: number, progress: number): Step[] =>
    FINALIZATION_ORDER.map((id, index): Step => ({ id, status: index < running ? 'done' : index === running ? 'active' : 'pending', startedAt: index <= running ? NOW - 1_000 : null, completedAt: index < running ? NOW - 500 : null, durationMs: 800, progress: index < running ? 100 : index === running ? progress : 0, etaMs: index === running ? 400 : null, detail: null, attempt: 1 }));

  it('is recognised by a planned duration on every step; its ETA is the simulator\'s figure for the run, not the step\'s', () => {
    expect(isTimedSeal(timed(2, 50))).toBe(true);
    expect(isTimedSeal(core(2, 50, 400))).toBe(false);
    const body = sealingProgressOf(session(timed(2, 50)), NOW);
    expect(body.progressPct).toBe(41);
    expect(body.etaMs).toBe(Math.round(3.5 * SEALING_ETA_STEP_MS));
  });
});

describe('G75b-01 and G75b-02: `resumed` is a fact, the blocked seal names its cause (wave I, driver A1)', () => {
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
});
