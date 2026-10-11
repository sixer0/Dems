// Fix wave L, driver L-S - re-check 75 findings G75d-01 (the UNSEALABLE alert nothing ended, and
// that was read as the fault of a LATER session) and G75d-02 (who may retry a blocked seal);
// rulings D228 (1), (2).
//
// | Rule | Test |
// |------|------|
// | CONTROL (the finding): the acknowledgement as it was (no instant handed in) leaves the notice active, and so does a later recorded and sealed session | 1 |
// | A SUPERVISOR's acknowledgement RESOLVES it: `active false`, `resolvedAt`, ONE `FAULT_CLEARED` row of the notice's OWN session with the operator, no timeline event | 2 |
// | ... also when another role acknowledged it before (lane 2's `ALR-000049`) | 3 |
// | ... and the row names the paired device that sent it (the sending-device rule) | 4 |
// | An INVESTIGATOR's and a TECHNICIAN's acknowledgement: acknowledged, STILL active, no row | 5 |
// | The rule is the notice's alone: the alert of a fault is acknowledged and stays active for a supervisor too | 6 |
// | The readers: one open notice that blocks nothing, of ITS session - never the fault of the session that is open | 7, 8 |
// | Who may retry a blocked seal, and the bound of the automatic retries | 9 |
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_CONNECT_MS,
  FINALIZATION_ORDER,
  FaultKind,
  Permission,
  SEAL_AUTOMATIC_RETRIES,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_RETRY_PERMISSION,
  SEAL_UNSEALABLE_EXAMPLE_ALERT,
  SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED,
  SEAL_UNSEALABLE_EXAMPLE_SESSION_ID,
  SEAL_UNSEALABLE_PLAIN_SENTENCE,
  UNSEALABLE_ACKNOWLEDGE_PERMISSION,
  acknowledgeAlertTransition,
  alertBlocksRecording,
  applySealingProgressTransition,
  canResolveUnsealable,
  canRetryBlockedSeal,
  createManualClock,
  createSim,
  endUnsealableTransition,
  isUnsealableAlert,
  openUnsealableNoticesOf,
  unsealableNoticeOf,
  unsealableSentence,
  type AuditRow,
  type SealingStepReport,
  type SessionCreateInput,
  type SimAlert,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 11, 1, 30, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1011-0041', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
const CAUSE = 'SESSION_KEY_NOT_OF_SESSION';
const INVESTIGATOR = 'budi.santoso';
const SUPERVISOR = 'andi.pratama';
const TECHNICIAN = 'rina.wijaya';

const failedAtFirst = (): SealingStepReport[] => FINALIZATION_ORDER.map((id, index) => ({ id, status: index === 0 ? 'FAILED' : 'PENDING', progress: 0, etaMs: null, attempt: 3, detail: null }));

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture: 'simulated' });
  sim.actions.signIn(INVESTIGATOR, 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const record = (): string => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
    sim.actions.startRecording();
    run(CAPTURE_CONNECT_MS + 3_000);
    return state().session?.id ?? '';
  };
  const signInAs = (username: string): void => {
    sim.actions.signOut();
    sim.actions.signIn(username, 'demo-2026');
  };
  /** The hosted action as an operator sends it, optionally from a paired device (the Core's actor scope). Returns the rows it wrote. */
  const acknowledge = (alertId: string, deviceId: string | null = null): AuditRow[] => {
    const from = state().audit.total;
    const before = state().auth;
    if (deviceId !== null) sim.store.setState({ ...state(), auth: { ...before, deviceId } }, true);
    try {
      sim.actions.acknowledgeAlert(alertId);
    } finally {
      if (deviceId !== null) {
        const { deviceId: _dropped, ...auth } = state().auth;
        sim.store.setState({ ...state(), auth }, true);
      }
    }
    return state().audit.rows.filter((row) => row.seq > from);
  };
  return { sim, clock, state, run, record, signInAs, acknowledge };
}

/** A Core whose session ended UNSEALABLE, as its engine door leaves it: no open session, the notice active. */
function afterUnsealableEnd() {
  const h = harness();
  const sessionId = h.record();
  h.sim.actions.stopRecording('Interview complete - test stop');
  const failed = applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: failedAtFirst() });
  h.sim.store.setState(endUnsealableTransition(failed, h.clock.now(), { sessionId, cause: CAUSE, quarantinedFiles: 5 }), true);
  const alert = h.state().alerts.find((candidate) => isUnsealableAlert(candidate));
  if (alert === undefined) throw new Error('the unsealable end raised no alert');
  return { ...h, sessionId, alertId: alert.id };
}

const alertOf = (state: SimState, id: string): SimAlert => {
  const alert = state.alerts.find((candidate) => candidate.id === id);
  if (alert === undefined) throw new Error(`no alert ${id}`);
  return alert;
};

describe('G75d-01: the notice of an unsealable session is ended by a supervisor\'s acknowledgement, and by nothing else', () => {
  it('1. CONTROL (the finding): the acknowledgement as it was leaves it active - and so does a later session that records and seals', () => {
    const h = afterUnsealableEnd();
    h.signInAs(SUPERVISOR);
    // The rule before this fix: no instant, so nothing but the mark.
    const before = acknowledgeAlertTransition(h.state(), h.alertId);
    expect(alertOf(before, h.alertId)).toMatchObject({ acknowledged: true, active: true, resolvedAt: null });
    expect(before.audit.total).toBe(h.state().audit.total);
    // A later session records and seals: the notice of the earlier one is still open.
    h.signInAs(INVESTIGATOR);
    const later = h.record();
    expect(later).not.toBe(h.sessionId);
    h.sim.actions.stopRecording('Interview complete - test stop');
    h.run(60_000, 250);
    expect(h.state().session?.state).toBe('SEALED');
    expect(alertOf(h.state(), h.alertId).active).toBe(true);
    expect(openUnsealableNoticesOf(h.state()).map((notice) => notice.sessionId)).toEqual([h.sessionId]);
  });

  it('2. a SUPERVISOR acknowledges: resolved, with ONE FAULT_CLEARED row of the notice\'s own session and no timeline event', () => {
    const h = afterUnsealableEnd();
    // Another session is open when the supervisor acknowledges: the row must not name it.
    const open = h.record();
    h.signInAs(SUPERVISOR);
    const events = h.state().events.length;
    h.clock.advance(1_000);
    const rows = h.acknowledge(h.alertId);
    expect(alertOf(h.state(), h.alertId)).toMatchObject({ acknowledged: true, active: false, resolvedAt: h.clock.now() });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'FAULT_CLEARED',
      sessionId: h.sessionId,
      actorId: h.state().auth.operatorId,
      deviceId: null,
      details: { reason: 'UNSEALABLE', cause: CAUSE, alertId: h.alertId, operationId: 'acknowledgeAlert' },
    });
    expect(rows[0]?.sessionId).not.toBe(open);
    expect(rows[0]?.message).toContain(h.sessionId);
    expect(h.state().events).toHaveLength(events);
    expect(openUnsealableNoticesOf(h.state())).toEqual([]);
    expect(unsealableNoticeOf(h.state(), h.sessionId)).toBeNull();
    // Once: a second acknowledgement changes nothing and writes nothing.
    expect(h.acknowledge(h.alertId)).toEqual([]);
  });

  it('3. an alert another role had ALREADY acknowledged (it stayed active) is resolved by the supervisor all the same', () => {
    const h = afterUnsealableEnd();
    expect(h.acknowledge(h.alertId)).toEqual([]);
    expect(alertOf(h.state(), h.alertId)).toMatchObject({ acknowledged: true, active: true });
    h.signInAs(SUPERVISOR);
    const rows = h.acknowledge(h.alertId);
    expect(rows.map((row) => row.type)).toEqual(['FAULT_CLEARED']);
    expect(alertOf(h.state(), h.alertId).active).toBe(false);
  });

  it('4. sent from a paired device: the row names that device', () => {
    const h = afterUnsealableEnd();
    h.signInAs(SUPERVISOR);
    const rows = h.acknowledge(h.alertId, 'DEV-0001');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'FAULT_CLEARED', deviceId: 'DEV-0001', sessionId: h.sessionId });
  });

  it('5. an INVESTIGATOR and a TECHNICIAN acknowledge: acknowledged, still active, no row', () => {
    for (const username of [INVESTIGATOR, TECHNICIAN]) {
      const h = afterUnsealableEnd();
      h.signInAs(username);
      expect(h.acknowledge(h.alertId)).toEqual([]);
      expect(alertOf(h.state(), h.alertId)).toMatchObject({ acknowledged: true, active: true, resolvedAt: null });
      expect(openUnsealableNoticesOf(h.state())).toEqual([expect.objectContaining({ sessionId: h.sessionId, alertId: h.alertId, acknowledged: true, cause: CAUSE })]);
    }
  });

  it('6. the rule is the notice\'s alone: the alert of a FAULT stays active when a supervisor acknowledges it', () => {
    const h = harness();
    h.signInAs(SUPERVISOR);
    h.sim.actions.inject(FaultKind.FAN_STALL);
    const alert = h.state().alerts.find((candidate) => candidate.kind === FaultKind.FAN_STALL);
    if (alert === undefined) throw new Error('the fault raised no alert');
    expect(h.acknowledge(alert.id)).toEqual([]);
    expect(alertOf(h.state(), alert.id)).toMatchObject({ acknowledged: true, active: true });
  });
});

describe('G75d-01: what a client reads', () => {
  it('7. ONE fact for the open notice; it blocks nothing; it is the notice of ITS session only', () => {
    const h = afterUnsealableEnd();
    const later = h.record();
    const notices = openUnsealableNoticesOf(h.state());
    expect(notices).toEqual([{ sessionId: h.sessionId, cause: CAUSE, at: expect.any(Number), alertId: h.alertId, acknowledged: false }]);
    const alert = alertOf(h.state(), h.alertId);
    expect(alertBlocksRecording(alert)).toBe(false);
    // The session that records now is another one: the notice is not ITS state.
    expect(alert.params?.['sessionId']).toBe(h.sessionId);
    expect(alert.params?.['sessionId']).not.toBe(later);
    expect(unsealableNoticeOf(h.state(), later)).toBeNull();
    expect(unsealableNoticeOf(h.state(), h.sessionId)).toMatchObject({ sessionId: h.sessionId });
    expect(h.state().session?.state).toBe('RECORDING');
  });

  it('8. the examples are what the Core writes; a blocked seal blocks, a fault alert does not say', () => {
    expect(isUnsealableAlert(SEAL_UNSEALABLE_EXAMPLE_ALERT)).toBe(true);
    expect(SEAL_UNSEALABLE_EXAMPLE_ALERT.message).toBe(unsealableSentence('SESSION_KEY_NOT_OF_SESSION'));
    expect(SEAL_UNSEALABLE_EXAMPLE_ALERT.message.startsWith(SEAL_UNSEALABLE_PLAIN_SENTENCE)).toBe(true);
    expect(SEAL_UNSEALABLE_PLAIN_SENTENCE).not.toMatch(/[({]/);
    expect(openUnsealableNoticesOf({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] })).toEqual([expect.objectContaining({ sessionId: SEAL_UNSEALABLE_EXAMPLE_SESSION_ID, alertId: SEAL_UNSEALABLE_EXAMPLE_ALERT.id })]);
    expect(openUnsealableNoticesOf({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED] })).toEqual([]);
    expect(isUnsealableAlert(SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED)).toBe(true);
    expect(alertBlocksRecording(SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED)).toBe(false);
    expect(alertBlocksRecording(SEAL_BLOCKED_EXAMPLE_ALERT)).toBe(true);
    expect(alertBlocksRecording({ ...SEAL_BLOCKED_EXAMPLE_ALERT, active: false })).toBe(false);
    expect(alertBlocksRecording({ kind: FaultKind.CAMERA_LOSS, active: true, params: { kind: FaultKind.CAMERA_LOSS } })).toBeNull();
    expect(isUnsealableAlert(SEAL_BLOCKED_EXAMPLE_ALERT)).toBe(false);
  });

  it('9. who closes the notice, who may retry a blocked seal, and the bound of the automatic retries', () => {
    expect(UNSEALABLE_ACKNOWLEDGE_PERMISSION).toBe(Permission.EVIDENCE_REVIEW);
    expect([canResolveUnsealable('SUPERVISOR'), canResolveUnsealable('INVESTIGATOR'), canResolveUnsealable('TECHNICIAN'), canResolveUnsealable(null)]).toEqual([true, false, false, false]);
    expect(SEAL_RETRY_PERMISSION).toBe(Permission.SESSION_START);
    expect([canRetryBlockedSeal('SUPERVISOR'), canRetryBlockedSeal('INVESTIGATOR'), canRetryBlockedSeal('TECHNICIAN'), canRetryBlockedSeal(undefined)]).toEqual([true, true, false, false]);
    expect(SEAL_AUTOMATIC_RETRIES).toBe(3);
  });
});
