// Fix wave L, driver L-S - re-check 75 findings G75d-04 (the sentence of a failed step said "is being
// retried" and "cannot be sealed" at once) and G75d-02 (the bounded retries, as a constant a client
// may print from).
//
// | Rule | Test |
// |------|------|
// | Every failure reason that ends "this session cannot be sealed" loses exactly that conclusion in the retry sentence; every other reason is unchanged | 1 |
// | The retry sentence of a cause that may heal is what it was | 2 |
// | The shared constant of the automatic retries IS the Core's bound: three, 5 s / 30 s / 120 s, and no fourth | 3 |
// The sentence on the real pipeline (a key of another session, attempt 1): `wave-i-a1-way-out.test.ts` (pin moved by delta).
import { SEAL_AUTOMATIC_RETRIES } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { SEAL_RETRY_DEFAULTS, SealerCause, SealingFailure, sealCauseWithoutConclusion, sealRetryingNotice, sealWayOutOf, sealingFailureReason, type SealOutcome, type SealingDetail } from '../index';

type Failed = Extract<SealOutcome, { status: 'FAILED' }>;
const failed = (over: Partial<Failed>): Failed => ({ status: 'FAILED', sessionId: 'SES-20261011-0041', attempt: 1, step: 'CLOSE_TRACKS', code: SealingFailure.SEALER_FAILED, retriable: true, detail: {}, ...over }) as Failed;

describe('G75d-04: the retry sentence states the cause, never the terminal conclusion', () => {
  it('1. every reason that concludes "cannot be sealed" loses the conclusion and keeps the cause; the others are untouched', () => {
    const details: SealingDetail[] = [{}, { trackId: 'VIDEO-02' }, { trackId: 'VIDEO-01', reason: 'NO_FRAGMENT', seq: 3, bytes: 9_000_000, limitBytes: 8_000_000 }, ...Object.values(SealerCause).map((cause) => ({ cause }))];
    let concluded = 0;
    for (const code of Object.values(SealingFailure)) {
      for (const detail of details) {
        const reason = sealingFailureReason(code, detail);
        const cause = sealCauseWithoutConclusion(reason);
        if (/this session cannot be sealed\.$/i.test(reason)) {
          concluded += 1;
          expect(cause).not.toMatch(/cannot be sealed/i);
          expect(cause.endsWith('.')).toBe(true);
          expect(cause.length).toBeGreaterThan(20);
          // Nothing but the conclusion went: the cause is the reason's own beginning.
          expect(reason.startsWith(cause.slice(0, -1))).toBe(true);
        } else {
          expect(cause).toBe(reason);
        }
      }
    }
    // CONTROL: the reasons with that conclusion exist (camera file unusable / missing / mismatch / too large, the key of another session).
    expect(concluded).toBeGreaterThanOrEqual(5);
  });

  it('2. a cause that may heal: the sentence is what it was', () => {
    const reason = sealingFailureReason(SealingFailure.SEALER_FAILED, { cause: SealerCause.SESSION_KEY_STORE_UNAVAILABLE });
    expect(sealRetryingNotice({ action: 'RETRY', delayMs: 30_000, retry: 2, of: 3 }, sealCauseWithoutConclusion(reason))).toBe(
      "Sealing is being retried (retry 2 of 3, in 30 s). The Core's key store cannot be used: the seal stopped and can be tried again.",
    );
  });
});

describe('G75d-02: the bounded design, kept', () => {
  it('3. three automatic retries (5 s, 30 s, 120 s) per process, then WAIT - never a fourth; the shared constant is that bound', () => {
    expect(SEAL_RETRY_DEFAULTS.delaysMs).toEqual([5_000, 30_000, 120_000]);
    expect(SEAL_AUTOMATIC_RETRIES).toBe(SEAL_RETRY_DEFAULTS.delaysMs.length);
    const steps = [0, 1, 2, 3, 4, 50].map((done) => sealWayOutOf(failed({ attempt: done + 1 }), done, SEAL_RETRY_DEFAULTS));
    expect(steps.slice(0, 3)).toEqual([
      { action: 'RETRY', delayMs: 5_000, retry: 1, of: 3 },
      { action: 'RETRY', delayMs: 30_000, retry: 2, of: 3 },
      { action: 'RETRY', delayMs: 120_000, retry: 3, of: 3 },
    ]);
    // After the third retry the Core waits: for a start of the Core or operation 33. However long it stays up.
    expect(steps.slice(3)).toEqual([{ action: 'WAIT' }, { action: 'WAIT' }, { action: 'WAIT' }]);
  });
});
