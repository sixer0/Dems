// Fix wave K, driver S1 - re-gate 75 finding G75c-06: the Monitor timeline worded EVERY capture fault
// "The capture stopped unexpectedly before the recording was ended. The recording was interrupted."
//   (a) the demo capture fault, while the alert says "The recording is not affected" and the session records;
//   (b) a killed worker, beside the alert's "The capture worker process was killed.";
//   (c) the row was listed twice at one instant.
// CAUSE: the sentence is drawn by the client from `params.reason` of the timeline row
// (`captureFaultSentence(reason, null)`), and the row the shared simulator wrote carried NO reason - so
// the client fell to the sentence of a capture that ended. And an interrupted capture wrote two rows: the
// capture side's own and the one of the session's move to FAULT.
// NOW: the row carries the cause the fault names (`params.reason`), and an interrupted capture has ONE row.
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_CONNECT_MS,
  CAPTURE_FAULT_NO_REASON_SENTENCES,
  CAPTURE_FAULT_SENTENCES,
  captureFaultSentence,
  createManualClock,
  createSim,
  interruptedCaptureTransition,
  raiseCaptureWarningTransition,
  type CaptureWarningInput,
  type SessionCreateInput,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 11, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1011-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

function recording() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture: 'simulated' });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.advance(50);
      sim.tick();
    }
  };
  sim.actions.createSession(INPUT);
  sim.actions.beginPrecheck();
  run(5_000);
  sim.actions.startRecording();
  run(CAPTURE_CONNECT_MS + 3_000);
  expect(state().session?.state).toBe('RECORDING');
  return { sim, clock, state, run, apply: (next: SimState) => void sim.store.setState(next, true) };
}

const faultRows = (state: SimState) => (state.session?.timeline ?? []).filter((item) => item.kind === 'FAULT');
/** What a client draws for a capture-fault row: the shared wording of the row's own reason. */
const drawn = (row: { params?: Record<string, unknown> | null }) => captureFaultSentence(typeof row.params?.['reason'] === 'string' ? (row.params['reason'] as string) : null, null);

describe('G75c-06: one true sentence per capture fault on the timeline, one row per event', () => {
  it('(a) the DEMO capture fault: the session keeps recording, ONE row, and it is drawn "The recording is not affected" - never "was interrupted"', () => {
    const h = recording();
    h.sim.actions.inject('CAPTURE_FAULT');
    expect(h.state().session?.state).toBe('RECORDING');
    const rows = faultRows(h.state());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.params).toMatchObject({ kind: 'CAPTURE_FAULT', critical: false, reason: 'DEMO_CAPTURE_FAULT' });
    expect(drawn(rows[0]!)).toBe(CAPTURE_FAULT_SENTENCES.DEMO_CAPTURE_FAULT);
    expect(drawn(rows[0]!)).toBe('The demo control raised a capture fault. The recording is not affected.');
    expect(drawn(rows[0]!)).not.toBe(CAPTURE_FAULT_NO_REASON_SENTENCES.capture);
    // CONTROL (the finding): the same row without its reason is drawn with the sentence of a capture that ended.
    expect(drawn({ params: { ...rows[0]?.params, reason: undefined } })).toBe('The capture stopped unexpectedly before the recording was ended. The recording was interrupted.');
  });

  it('(b) + (c) a killed worker, in the Core\'s order (the capture side raises the fault, then the session ends): ONE row, drawn "The capture worker process was killed."', () => {
    const h = recording();
    const sessionId = h.state().session?.id ?? '';
    const at = h.clock.now();
    h.apply(raiseCaptureWarningTransition(h.state(), at, { code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_KILLED' } as CaptureWarningInput));
    expect(faultRows(h.state())).toHaveLength(1);
    h.apply(interruptedCaptureTransition(h.state(), at, sessionId));
    expect(h.state().session).toMatchObject({ state: 'FAULT', captureDurable: true, fault: { kind: 'CAPTURE_FAULT', fromState: 'RECORDING' } });
    const rows = faultRows(h.state());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.params).toMatchObject({ kind: 'CAPTURE_FAULT', reason: 'WORKER_KILLED' });
    expect(drawn(rows[0]!)).toBe('The capture worker process was killed.');
  });

  it('the other order (the session ends first, the capture side raises its fault after): still ONE row - the session\'s own, which IS an interruption', () => {
    const h = recording();
    const sessionId = h.state().session?.id ?? '';
    const at = h.clock.now();
    h.apply(interruptedCaptureTransition(h.state(), at, sessionId));
    expect(faultRows(h.state())).toHaveLength(1);
    h.apply(raiseCaptureWarningTransition(h.state(), at, { code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_KILLED' } as CaptureWarningInput));
    const rows = faultRows(h.state());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.params).toMatchObject({ kind: 'CAPTURE_FAULT', critical: true });
    expect(drawn(rows[0]!)).toBe(CAPTURE_FAULT_NO_REASON_SENTENCES.capture);
  });

  it('CONTROL - an interruption nobody told the timeline of (no capture-wide fault raised before) keeps the session\'s row; an EARLIER, cleared demo fault\'s row is not mistaken for it', () => {
    const h = recording();
    const sessionId = h.state().session?.id ?? '';
    h.sim.actions.inject('CAPTURE_FAULT');
    h.run(2_000);
    h.sim.actions.clearFault('CAPTURE_FAULT');
    expect(faultRows(h.state())).toHaveLength(1);
    h.run(2_000);
    h.apply(interruptedCaptureTransition(h.state(), h.clock.now(), sessionId));
    const rows = faultRows(h.state());
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.params?.['critical'])).toEqual([false, true]);
  });
});
