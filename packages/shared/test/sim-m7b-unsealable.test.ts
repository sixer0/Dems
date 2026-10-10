// Fix pass F-M7b (review row 88, R88-02 (c); rulings D178 (2), D183): the TERMINAL outcome of a
// session that cannot be sealed, in the shared session machine. The Core's engine door applies the
// same transition (parity): the session ends INCOMPLETE with reason UNSEALABLE and the named
// cause, ONE CRITICAL alert, ONE audit row, and no session blocks the next one.
import { describe, expect, it } from 'vitest';
import {
  applySealingProgressTransition,
  createManualClock,
  createSim,
  endUnsealableTransition,
  FaultKind,
  FINALIZATION_ORDER,
  isSessionActive,
  SEAL_UNSEALABLE_REASON,
  SimTransitionError,
  unsealableNoticeOf,
  unsealableSentence,
  type SealingStepReport,
  type SessionCreateInput,
  type SimState,
} from '../src/sim';
import { SessionOutcome } from '../src/sim/vocabulary';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const toRecording = (): string => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
    sim.actions.startRecording();
    run(4_000);
    return state().session?.id ?? '';
  };
  return { sim, clock, state, run, toRecording };
}

const failedAtFirst = (): SealingStepReport[] => FINALIZATION_ORDER.map((id, index) => ({ id, status: index === 0 ? 'FAILED' : 'PENDING', progress: 0, etaMs: null, attempt: 1, detail: index === 0 ? 'No camera file of this session can be sealed.' : null }));

/** A session the Core's pipeline reported a failed seal for: FINALIZING, its first step in error. */
function finalizingWithFailedSeal() {
  const h = harness();
  const sessionId = h.toRecording();
  h.sim.actions.stopRecording('Interview complete - test stop');
  const failed = applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: failedAtFirst() });
  expect(failed.session?.state).toBe('FINALIZING');
  return { ...h, sessionId, failed };
}

describe('endUnsealableTransition - the terminal outcome of a session that cannot be sealed (R88-02 (c))', () => {
  it('ends the session INCOMPLETE: no open session, one history entry, no evidence item', () => {
    const { failed, sessionId, clock } = finalizingWithFailedSeal();
    const items = failed.evidence.length;
    const next = endUnsealableTransition(failed, clock.now(), { sessionId, cause: 'NOTHING_SEALABLE' });
    expect(next.session).toBeNull();
    expect(isSessionActive(next.session)).toBe(false);
    expect(next.sessionHistory[0]).toMatchObject({ id: sessionId, outcome: SessionOutcome.INCOMPLETE, evidenceId: null });
    // Nothing is presented as evidence: the recordings are in the quarantine, not in an item.
    expect(next.evidence).toHaveLength(items);
  });

  it('writes ONE audit row SESSION_INCOMPLETE with details.reason UNSEALABLE and the named cause', () => {
    const { failed, sessionId, clock } = finalizingWithFailedSeal();
    const next = endUnsealableTransition(failed, clock.now(), { sessionId, cause: 'NOTHING_SEALABLE', quarantinedFiles: 3 });
    const added = next.audit.rows.filter((row) => !failed.audit.rows.some((before) => before.id === row.id));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ type: 'SESSION_INCOMPLETE', severity: 'CRITICAL', sessionId, evidenceId: null });
    expect(added[0]?.details).toMatchObject({ reason: SEAL_UNSEALABLE_REASON, cause: 'NOTHING_SEALABLE', quarantinedFiles: 3 });
  });

  it('raises ONE CRITICAL alert that names the session and carries the sentence an operator reads', () => {
    const { failed, sessionId, clock } = finalizingWithFailedSeal();
    const next = endUnsealableTransition(failed, clock.now(), { sessionId, cause: 'MANIFEST_INVALID' });
    const added = next.alerts.filter((alert) => !failed.alerts.some((before) => before.id === alert.id));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ kind: 'SYSTEM', severity: 'CRITICAL', active: true, target: sessionId });
    expect(added[0]?.params).toMatchObject({ reason: SEAL_UNSEALABLE_REASON, cause: 'MANIFEST_INVALID', sessionId });
    expect(added[0]?.message).toBe(unsealableSentence('MANIFEST_INVALID'));
    expect(unsealableSentence('MANIFEST_INVALID')).toBe('This recording could not be sealed. Its files were kept in quarantine on the Core. (MANIFEST_INVALID)');
    // The clients read the state from the alert, never from an error.
    expect(unsealableNoticeOf(next, sessionId)).toEqual({ sessionId, cause: 'MANIFEST_INVALID', at: clock.now() });
    expect(unsealableNoticeOf(next)).toEqual({ sessionId, cause: 'MANIFEST_INVALID', at: clock.now() });
  });

  it('a new session can be created afterwards (the Core is free)', () => {
    const h = finalizingWithFailedSeal();
    h.sim.store.setState(endUnsealableTransition(h.failed, h.clock.now(), { sessionId: h.sessionId, cause: 'NOTHING_SEALABLE' }), true);
    const created = h.sim.actions.createSession({ ...INPUT, caseNumber: 'LP/2026/1001-0009' });
    expect(created.ok).toBe(true);
  });

  it('also ends an interrupted recording (FAULT) that cannot be sealed, and keeps its fault kind in the history', () => {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.inject(FaultKind.POWER_FAIL);
    expect(h.state().session?.state).toBe('FAULT');
    const next = endUnsealableTransition(h.state(), h.clock.now(), { sessionId, cause: 'NOTHING_SEALABLE' });
    expect(next.session).toBeNull();
    expect(next.sessionHistory[0]).toMatchObject({ id: sessionId, outcome: SessionOutcome.INCOMPLETE, faultKind: 'POWER_FAIL' });
  });

  // ── Controls: the transition refuses what it must not end ─────────────────────────────────────
  it('CONTROL: refuses another session, a cause that is no code, and a session that is still recording', () => {
    const { failed, sessionId, clock } = finalizingWithFailedSeal();
    expect(() => endUnsealableTransition(failed, clock.now(), { sessionId: 'SES-20261001-9999', cause: 'NOTHING_SEALABLE' })).toThrow(SimTransitionError);
    expect(() => endUnsealableTransition(failed, clock.now(), { sessionId, cause: 'a path /Users/x' })).toThrow(SimTransitionError);
    const recording = harness();
    const id = recording.toRecording();
    expect(() => endUnsealableTransition(recording.state(), recording.clock.now(), { sessionId: id, cause: 'NOTHING_SEALABLE' })).toThrow(SimTransitionError);
  });

  it('CONTROL: a state with no such alert has no unsealable notice', () => {
    const { failed, sessionId } = finalizingWithFailedSeal();
    expect(unsealableNoticeOf(failed, sessionId)).toBeNull();
    expect(unsealableNoticeOf(failed)).toBeNull();
  });
});
