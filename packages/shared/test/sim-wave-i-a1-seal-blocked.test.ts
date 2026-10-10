/**
 * Fix wave I driver A1 (re-gate 75, G75b-02): the blocked / retrying seal as BOTH clients read it
 * from the state - the members that exist already, no new contract member.
 */
import { describe, expect, it } from 'vitest';
import { ActiveSessionSchema, AlertsSliceSchema } from '../src/api';
import {
  SEAL_BLOCKED_DETAILS,
  SEAL_BLOCKED_DETAIL_SENTENCE,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  SEAL_BLOCKED_REASON,
  SEAL_RETRYING_EXAMPLE_FINALIZATION,
  sealAttentionOf,
  sealBlockedNoticeOf,
  type SimAlert,
} from '../src/sim';

const session = (finalization: typeof SEAL_BLOCKED_EXAMPLE_FINALIZATION) => ({ id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING' as const, finalization });

describe('a seal that needs attention, read from the state (G75b-02)', () => {
  it('BLOCKED: the alert of the open session, with its cause, step, detail code and the sentence of the failed step', () => {
    const attention = sealAttentionOf({ session: session(SEAL_BLOCKED_EXAMPLE_FINALIZATION), alerts: [SEAL_BLOCKED_EXAMPLE_ALERT] });
    expect(attention).toMatchObject({ kind: 'BLOCKED', sessionId: SEAL_BLOCKED_EXAMPLE_SESSION_ID, cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS', detail: 'SESSION_KEY_STORE_UNAVAILABLE', attempt: 4, recordingKept: true });
    expect(attention?.kind === 'BLOCKED' ? attention.sentence : '').toMatch(/^The Core's key store cannot be used/);
    expect(attention?.kind === 'BLOCKED' ? attention.message : '').toMatch(/^Sealing of this session is blocked\./);
  });

  it('RETRYING: a failed step and no alert', () => {
    const attention = sealAttentionOf({ session: session(SEAL_RETRYING_EXAMPLE_FINALIZATION), alerts: [] });
    expect(attention).toMatchObject({ kind: 'RETRYING', step: 'CLOSE_TRACKS', attempt: 2, recordingKept: true });
    expect(attention?.sentence).toMatch(/^Sealing is being retried \(retry 2 of 3, in 30 s\)\./);
  });

  it('says nothing of a seal that runs, of no session, of a resolved alert and of the alert of another session', () => {
    const running = { ...SEAL_BLOCKED_EXAMPLE_FINALIZATION, steps: SEAL_BLOCKED_EXAMPLE_FINALIZATION.steps.map((step) => (step.status === 'error' ? { ...step, status: 'active' as const, detail: null } : step)) };
    expect(sealAttentionOf({ session: session(running), alerts: [] })).toBeNull();
    expect(sealAttentionOf({ session: null, alerts: [SEAL_BLOCKED_EXAMPLE_ALERT] })).toBeNull();
    const resolved: SimAlert = { ...SEAL_BLOCKED_EXAMPLE_ALERT, active: false, resolvedAt: SEAL_BLOCKED_EXAMPLE_ALERT.at + 1 };
    expect(sealAttentionOf({ session: session(running), alerts: [resolved] })).toBeNull();
    expect(sealBlockedNoticeOf({ alerts: [SEAL_BLOCKED_EXAMPLE_ALERT] }, 'SES-20261010-0099')).toBeNull();
    // Negative control: an alert of another reason is no blocked seal.
    expect(sealBlockedNoticeOf({ alerts: [{ ...SEAL_BLOCKED_EXAMPLE_ALERT, params: { ...SEAL_BLOCKED_EXAMPLE_ALERT.params, reason: 'UNSEALABLE' } }] })).toBeNull();
  });

  it('a detail the list does not hold reads as none; every listed detail has its sentence', () => {
    const other: SimAlert = { ...SEAL_BLOCKED_EXAMPLE_ALERT, params: { ...SEAL_BLOCKED_EXAMPLE_ALERT.params, detail: '/Users/someone/.data/key' } };
    expect(sealBlockedNoticeOf({ alerts: [other] })?.detail).toBeNull();
    for (const detail of SEAL_BLOCKED_DETAILS) expect(SEAL_BLOCKED_DETAIL_SENTENCE[detail]).toMatch(/\.$/);
    expect(SEAL_BLOCKED_REASON).toBe('SEAL_BLOCKED');
  });

  it('the examples are members of the contract as it is: the alert and the finalization slice pass the state schema', () => {
    expect(AlertsSliceSchema.safeParse([SEAL_BLOCKED_EXAMPLE_ALERT]).success).toBe(true);
    const finalization = ActiveSessionSchema.shape.finalization;
    expect(finalization.safeParse(SEAL_BLOCKED_EXAMPLE_FINALIZATION).success).toBe(true);
    expect(finalization.safeParse(SEAL_RETRYING_EXAMPLE_FINALIZATION).success).toBe(true);
  });
});
