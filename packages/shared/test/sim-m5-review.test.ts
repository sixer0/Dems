// Fix pass F-M5 (code review row 74, `gateway_check/18_m5_code_review.md`): the simulator's model of
// a capture. One block per finding; each was written RED against the tree of `abf742f`.
//
//   R74-01  two failed starts in a row are two alerts and two FAULT_RAISED rows (D84 R-3), and the
//           fault a failed start left is ended by the next start, failed or not (R-4)
//   R74-02  operation 82 lists every interval of the session: 1-based, the input that is the source,
//           its role from the selector line
//   R74-05  the AUDIO_SOURCE_SWITCHED row holds the keys of contract C3 §5.2
//   R74-11  a demo clear does not take the cause away from a failed start that is still in FAULT
import { describe, expect, it } from 'vitest';
import { CAPTURE_CONNECT_MS, RECOVERY_MS, audioSourceIntervalsOf, createManualClock, createSim, type SessionCreateInput, type SimAlert, type SimState } from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture: 'simulated' });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const toArmed = (): void => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
    expect(state().session?.state).toBe('ARMED');
  };
  const captureAlerts = (): SimAlert[] => state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT');
  const raisedRows = () => state().audit.rows.filter((row) => row.type === 'FAULT_RAISED' && row.details?.['kind'] === 'CAPTURE_FAULT');
  /** A start at which no camera connects: the session ends in FAULT with nothing recorded. */
  const failedStart = (): string => {
    // The cameras are back for the pre-check and lost again before the start.
    sim.actions.clearFault('CAMERA_LOSS');
    toArmed();
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    sim.actions.startRecording();
    run(CAPTURE_CONNECT_MS);
    const session = state().session;
    expect(session).toMatchObject({ state: 'FAULT', captureDurable: false });
    return session?.id ?? '';
  };
  const recover = (): void => {
    sim.actions.recover();
    run(RECOVERY_MS + 100);
    expect(state().session).toBeNull();
  };
  return { sim, clock, state, run, toArmed, captureAlerts, raisedRows, failedStart, recover };
}

describe('R74-01: the capture fault of a failed start in the simulator own capture', () => {
  it('two failed starts in a row write two alerts and two FAULT_RAISED rows, each naming its session', () => {
    const h = harness();
    const rowsBefore = h.raisedRows().length;
    const alertsBefore = h.captureAlerts().length;
    const first = h.failedStart();
    expect(h.raisedRows()).toHaveLength(rowsBefore + 1);
    h.recover();
    const second = h.failedStart();
    expect(second).not.toBe(first);
    const rows = h.raisedRows().slice(rowsBefore);
    expect(rows.map((row) => row.sessionId)).toEqual([first, second]);
    for (const row of rows) expect(row.details).toMatchObject({ reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
    const alerts = h.captureAlerts().slice(alertsBefore);
    expect(alerts).toHaveLength(2);
    // The alert of the first session is over; the active one is the second session's, with ITS time.
    expect(alerts.filter((alert) => alert.active)).toHaveLength(1);
    const active = alerts.find((alert) => alert.active);
    expect(active?.id).not.toBe(alerts[0]?.id);
    expect(active?.at).toBeGreaterThan(alerts[0]?.at ?? Number.MAX_SAFE_INTEGER);
    expect(active?.params).toMatchObject({ reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
  });

  it('an acknowledged alert of the first failed start does not silence the second', () => {
    const h = harness();
    h.failedStart();
    const firstAlert = h.captureAlerts().find((alert) => alert.active);
    h.sim.actions.acknowledgeAlert(firstAlert?.id ?? '');
    h.recover();
    h.failedStart();
    const active = h.captureAlerts().filter((alert) => alert.active);
    expect(active).toHaveLength(1);
    expect(active[0]?.acknowledged).toBe(false);
  });

  it('R-3 / R-4: the fault stays after its session is closed and is ended by the NEXT start - a failed one clears it (the row names the new session) and raises its own', () => {
    const h = harness();
    const first = h.failedStart();
    const active = () => h.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT' && fault.target === null);
    const cleared = () => h.state().audit.rows.filter((row) => row.type === 'FAULT_CLEARED' && row.details?.['kind'] === 'CAPTURE_FAULT');
    const clearedBefore = cleared().length;
    h.recover();
    // Kept until a session starts again (the rule the Core's engine has; `sim-capture-start.test.ts` holds the start that connects).
    expect(active()).toHaveLength(1);
    expect(cleared()).toHaveLength(clearedBefore);
    const since = active()[0]?.since;
    const second = h.failedStart();
    expect(second).not.toBe(first);
    expect(active()).toHaveLength(1);
    expect(active()[0]?.since).toBeGreaterThan(since ?? Number.MAX_SAFE_INTEGER);
    expect(cleared()).toHaveLength(clearedBefore + 1);
    expect(cleared().at(-1)?.sessionId).toBe(second);
  });
});

describe('R74-02: operation 82 in the simulator', () => {
  const recording = () => {
    const h = harness();
    h.toArmed();
    h.sim.actions.startRecording();
    h.run(CAPTURE_CONNECT_MS);
    const session = h.state().session;
    if (session === null || session.startedAt === null) throw new Error('no recording session');
    return { h, startedAt: session.startedAt };
  };
  const list = (state: SimState): string[] => {
    const session = state.session;
    if (session === null) return [];
    return audioSourceIntervalsOf(state, session).map((entry) => `${entry.seq}:${entry.inputId}:${entry.role}:${entry.fromMs}-${entry.toMs}:${entry.reason}`);
  };

  it('three switches, both directions: four intervals, newest first, each with the input that was the source and its role', () => {
    const { h, startedAt } = recording();
    expect(list(h.state())).toEqual(['1:MIC-01:PRIMARY:0-null:START']);
    const at: number[] = [];
    for (const input of ['MIC-02', 'MIC-01', 'MIC-02'] as const) {
      h.run(3_000);
      h.sim.actions.switchAudioSource(input);
      at.push(h.clock.now() - startedAt);
    }
    expect(list(h.state())).toEqual([
      `4:MIC-02:STANDBY:${at[2]}-null:MANUAL`,
      `3:MIC-01:PRIMARY:${at[1]}-${at[2]}:MANUAL`,
      `2:MIC-02:STANDBY:${at[0]}-${at[1]}:MANUAL`,
      `1:MIC-01:PRIMARY:0-${at[0]}:START`,
    ]);
    // The wall instants follow the same boundaries, and the last interval is the session's active input.
    const session = h.state().session;
    if (session === null) throw new Error('no session');
    const entries = audioSourceIntervalsOf(h.state(), session);
    expect(entries[0]?.inputId).toBe(session.audioSource?.activeInputId);
    expect(entries.map((entry) => entry.fromAt)).toEqual([startedAt + (at[2] ?? 0), startedAt + (at[1] ?? 0), startedAt + (at[0] ?? 0), startedAt]);
    expect(entries.map((entry) => entry.toAt)).toEqual([null, startedAt + (at[2] ?? 0), startedAt + (at[1] ?? 0), startedAt + (at[0] ?? 0)]);
    expect(entries.map((entry) => entry.switchedBy)).toEqual(['OPR-001', 'OPR-001', 'OPR-001', null]);
  });

  it('CONTROL: a request for the input that is active already opens no interval', () => {
    const { h } = recording();
    h.run(2_000);
    h.sim.actions.switchAudioSource('MIC-01');
    expect(list(h.state())).toHaveLength(1);
  });

  it('the answer of the simulated REST layer is the same list', () => {
    const { h } = recording();
    for (const input of ['MIC-02', 'MIC-01'] as const) {
      h.run(2_000);
      h.sim.actions.switchAudioSource(input);
    }
    const session = h.state().session;
    if (session === null) throw new Error('no session');
    const expected = audioSourceIntervalsOf(h.state(), session);
    expect(expected).toHaveLength(3);
    expect(expected.map((entry) => entry.inputId)).toEqual(['MIC-01', 'MIC-02', 'MIC-01']);
  });
});

describe('R74-05: the AUDIO_SOURCE_SWITCHED row of the simulator', () => {
  it('holds fromInput, toInput, fromMs, toMs (contract C3 §5.2) and none of the old keys', () => {
    const h = harness();
    h.toArmed();
    h.sim.actions.startRecording();
    h.run(CAPTURE_CONNECT_MS);
    const startedAt = h.state().session?.startedAt ?? 0;
    h.run(4_000);
    h.sim.actions.switchAudioSource('MIC-02');
    const first = h.clock.now() - startedAt;
    h.run(2_000);
    h.sim.actions.switchAudioSource('MIC-01');
    const second = h.clock.now() - startedAt;
    const rows = h.state().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED').slice(-2);
    expect(rows.map((row) => row.details)).toEqual([
      { fromInput: 'MIC-01', toInput: 'MIC-02', fromMs: 0, toMs: first },
      { fromInput: 'MIC-02', toInput: 'MIC-01', fromMs: first, toMs: second },
    ]);
  });
});

describe('R74-11: a demo clear and a failed start', () => {
  it('clearFault(CAPTURE_FAULT) changes nothing while the failed start is in FAULT; it clears a capture fault that has no failed start', () => {
    const h = harness();
    h.failedStart();
    const before = h.state();
    h.sim.actions.clearFault('CAPTURE_FAULT');
    expect(h.state().faults).toEqual(before.faults);
    expect(h.captureAlerts().filter((alert) => alert.active && alert.params?.['reason'] === 'NO_CAMERA_CONNECTED')).toHaveLength(1);
    expect(h.state().session).toMatchObject({ state: 'FAULT', captureDurable: false });
    // CONTROL: the same demo clear does clear the kind when no failed start holds it.
    const other = harness();
    other.sim.actions.inject('CAPTURE_FAULT');
    expect(other.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(true);
    other.sim.actions.clearFault('CAPTURE_FAULT');
    expect(other.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(false);
  });
});
