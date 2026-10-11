// The capture fault in the simulator: its sentence by reason, its life (raised, cleared, worded
// by its cause, never cleared by the demo control), its place on the session timeline, and the
// fault a failed start leaves. Home file of these cases (suite consolidation, 2026-10-11); the
// finding ids stay in the titles.
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n';
import {
  CAPTURE_ADVISORY_REASONS,
  CAPTURE_FAULT_SENTENCES,
  CAPTURE_REASON_SEVERITY,
  CaptureAdvisoryReason,
  captureFaultSentence,
  createManualClock,
  createSim,
  isCaptureFaultReason,
  raiseCaptureWarningTransition,
  systemStatus,
  type CaptureWarningInput,
  type SimState,
  CAPTURE_CONNECT_MS,
  CAPTURE_FAULT_NO_REASON_SENTENCES,
  interruptedCaptureTransition,
  type SessionCreateInput,
  applySealingProgressTransition,
  completeSealTransition,
} from '../src/sim';
import * as sessionFaultBed from './support/session-fault-bed';
import * as failedStartBed from './support/failed-start-bed';

// Fix pass F-M5, review R74-03: every capture fault is worded by its REASON, from one source
// (`src/sim/capture-fault-wording.ts`). Written RED against `abf742f`, where every reason read
// "Capture fault: a recording file stopped growing (<device>)".
describe('worded by its reason', () => {
  const base = (): SimState => createSim({ clock: createManualClock(Date.UTC(2026, 9, 1, 3, 0, 0)), storage: null, authStorage: null }).store.getState();
  const raise = (state: SimState, warning: Record<string, unknown>): SimState => raiseCaptureWarningTransition(state, 1_000, warning as unknown as CaptureWarningInput);
  const newest = (state: SimState) => ({ alert: state.alerts.at(-1), row: state.audit.rows.at(-1) });

  describe('the sentence of a capture fault', () => {
    it('no sentence of any reason is the file-growth sentence, and every one that names a device has the placeholder once', () => {
      for (const [reason, sentence] of Object.entries(CAPTURE_FAULT_SENTENCES)) {
        expect(sentence, reason).not.toMatch(/stopped growing/i);
        expect(sentence.split('{{device}}').length - 1, reason).toBeLessThanOrEqual(1);
        expect(captureFaultSentence(reason, 'Camera 2 (CAM-02)'), reason).not.toMatch(/\{\{/);
      }
    });

    it.each([
      ['MIC_DISCONNECTED', 'MIC-01', /stopped delivering audio/],
      ['CAMERA_STREAM_ENDED', 'CAM-02', /stopped delivering video/],
      ['CAMERA_CLOCK_OUT_OF_BOUND', 'CAM-01', /clock of .*CAM-01/],
      ['CAMERA_NOT_CONNECTED', 'CAM-02', /did not connect/],
    ])('a CAPTURE_FAULT with reason %s on %s: the alert and the FAULT_RAISED row say that cause and name the device', (reason, subject, words) => {
      const { alert, row } = newest(raise(base(), { code: 'CAPTURE_FAULT', subject, reason }));
      expect(alert).toMatchObject({ kind: 'CAPTURE_FAULT', target: subject, params: { reason } });
      for (const message of [alert?.message ?? '', row?.message ?? '']) {
        expect(message).toMatch(words);
        expect(message).toContain(subject);
        expect(message).not.toMatch(/stopped growing/i);
      }
      expect(alert?.message).toBe(row?.message);
    });

    it('the device is named by its name and its id', () => {
      const state = base();
      const camera = state.cameras.find((entry) => entry.deviceId === 'CAM-02');
      const { alert } = newest(raise(state, { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' }));
      expect(camera?.name).toBeTruthy();
      expect(alert?.message).toBe(captureFaultSentence('CAMERA_STREAM_ENDED', `${camera?.name} (CAM-02)`));
    });

    it('an unknown reason gets the neutral sentence with its code; no reason gets the neutral one; never the file-growth sentence', () => {
      const unknown = newest(raise(base(), { code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'SOME_NEW_REASON' })).alert?.message ?? '';
      expect(unknown).toMatch(/^Capture reported a problem on .*CAM-01.* \(SOME_NEW_REASON\)\.$/);
      const none = newest(raise(base(), { code: 'CAPTURE_FAULT', subject: 'CAM-01' })).alert?.message ?? '';
      expect(none).toMatch(/^Capture reported a problem on .*CAM-01.*\.$/);
      expect(none).not.toContain('(undefined)');
      // The capture as a whole, without a cause: an interrupted recording, never a clean stop.
      expect(captureFaultSentence(null, null)).toMatch(/stopped unexpectedly/);
      expect(captureFaultSentence(null, null)).toMatch(/interrupted/);
      expect(captureFaultSentence('WORKER_KILLED_AT_GRACE', null)).toBe('Capture reported a problem (WORKER_KILLED_AT_GRACE).');
      // Free text of another process is never shown.
      expect(captureFaultSentence('rm -rf / <b>', 'X')).toBe('Capture reported a problem on X.');
      // A device sentence for a fault that names no device: the neutral one, not a sentence with a hole.
      expect(captureFaultSentence('MIC_DISCONNECTED', null)).toBe('Capture reported a problem (MIC_DISCONNECTED).');
    });

    it('the failed start says no camera connected', () => {
      const { alert } = newest(raise(base(), { code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 }));
      expect(alert?.message).toBe('No camera connected. Nothing was recorded.');
    });

    it('the system-status flag of an active capture fault is the sentence of that fault', () => {
      const state = raise(base(), { code: 'CAPTURE_FAULT', subject: 'MIC-01', reason: 'MIC_DISCONNECTED' });
      const text = JSON.stringify(systemStatus(state));
      expect(text).not.toMatch(/stopped growing/i);
      expect(text).toMatch(/stopped delivering audio/);
    });

    it('severity: the degraded start is a WARNING, advice is INFO; every reason has one; every advisory notice of the simulator has a sentence', () => {
      expect(CAPTURE_REASON_SEVERITY.CAMERA_NOT_CONNECTED).toBe('WARNING');
      for (const reason of CAPTURE_ADVISORY_REASONS) expect(CAPTURE_REASON_SEVERITY[reason]).toBe('INFO');
      expect(Object.keys(CAPTURE_REASON_SEVERITY).sort()).toEqual(Object.keys(CAPTURE_FAULT_SENTENCES).sort());
      for (const reason of Object.values(CaptureAdvisoryReason)) {
        expect(isCaptureFaultReason(reason), reason).toBe(true);
        expect(CAPTURE_ADVISORY_REASONS, reason).toContain(reason);
      }
    });

    it('the i18n block IS the table: a client that translates and one that calls the function read the same words', () => {
      expect(en.common.captureFault.reason).toBe(CAPTURE_FAULT_SENTENCES);
      expect(en.common.captureFault.unknown.device).toContain('{{reason}}');
    });
  });
});

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
describe('on the session timeline', () => {
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
});

// Wave H, driver B (decision D200; gates 75 and 89): the capture faults of the simulator. One block
// per finding, each written RED against f293221.
//   G75-10  the capture fault of a recording that was sealed as interrupted is over at the seal;
//           the fault a CLOSED failed start left is no critical "blocked" state
//   G75-05  FAULT_CLEARED of a capture fault is worded by ITS cause
//   G75-06  demo operation 74 never clears a capture-originated fault (D72(h))
//   G75-09  the demo control's own capture fault claims no interruption
describe('its life: ended at the seal, worded by its cause, never cleared by the demo control', () => {
  const { harness, report, sealInput, interrupt } = sessionFaultBed;

  describe('G75-10: a capture fault of a closed session neither blocks nor stands as critical', () => {
    it('the interrupted seal ends the capture fault of its recording: one FAULT_CLEARED row, the alert resolved, no critical state left', () => {
      const h = harness();
      const sessionId = h.toRecording();
      interrupt(h, sessionId);
      expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(1);
      const clearedBefore = h.rows('FAULT_CLEARED').length;
      h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(5, 90) }));
      const at = h.clock.now() + 300;
      h.apply(completeSealTransition(h.state(), at, sealInput(sessionId, at, { interrupted: true, durableEndAt: at - 1_000 })));
      expect(h.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toHaveLength(0);
      expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(0);
      expect(h.rows('FAULT_CLEARED').slice(clearedBefore)).toHaveLength(1);
      expect(systemStatus(h.state()).state).not.toBe('CRITICAL');
    });

    it('the fault a CLOSED failed start left stays raised (D84 R-4) as a warning: the system is not CRITICAL while a session can start', () => {
      const h = harness();
      h.failedStart();
      // While the failed start is open it is the critical cause of its session.
      expect(systemStatus(h.state()).state).toBe('CRITICAL');
      h.closeFailedStart();
      expect(h.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(true);
      const status = systemStatus(h.state());
      expect(status.state).not.toBe('CRITICAL');
      expect(status.flags.find((flag) => flag.id === 'CAPTURE_FAULT')).toMatchObject({ severity: 'WARNING', message: 'No camera connected. Nothing was recorded.' });
    });
  });

  describe('G75-05: the clear row of a capture fault is worded by its own cause', () => {
    it('a no-camera fault that the next start ends reads the no-camera sentence, and its details name the reason', () => {
      const h = harness();
      h.failedStart();
      h.closeFailedStart();
      const before = h.rows('FAULT_CLEARED').length;
      h.toRecording();
      const cleared = h.rows('FAULT_CLEARED').slice(before).filter((row) => row.details?.['kind'] === 'CAPTURE_FAULT');
      expect(cleared).toHaveLength(1);
      expect(cleared[0]?.message).toBe('No camera connected. Nothing was recorded. — cleared');
      expect(cleared[0]?.message).not.toMatch(/stopped unexpectedly|interrupted/);
      expect(cleared[0]?.details).toMatchObject({ reason: 'NO_CAMERA_CONNECTED' });
    });
  });

  describe('G75-06: demo operation 74 never clears a capture-originated fault', () => {
    it('the fault of a failed start whose session is CLOSED survives the demo clear: no row, the alert stays active', () => {
      const h = harness();
      h.failedStart();
      h.closeFailedStart();
      const before = h.rows('FAULT_CLEARED').length;
      h.sim.actions.clearFault('CAPTURE_FAULT');
      expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(1);
      expect(h.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(true);
      expect(h.rows('FAULT_CLEARED').slice(before)).toHaveLength(0);
    });

    it('CONTROL - the demo control clears the capture fault it raised itself', () => {
      const h = harness();
      h.sim.actions.inject('CAPTURE_FAULT');
      expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(1);
      h.sim.actions.clearFault('CAPTURE_FAULT');
      expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(0);
      expect(h.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(false);
    });
  });

  describe('G75-09: the demo control capture fault claims no interruption', () => {
    it('the session keeps recording and neither the alert nor its rows say the recording was interrupted', () => {
      const h = harness();
      h.toRecording();
      h.sim.actions.inject('CAPTURE_FAULT');
      expect(h.state().session?.state).toBe('RECORDING');
      const alert = h.captureAlerts().at(-1);
      expect(alert?.message).not.toMatch(/interrupted|stopped unexpectedly/);
      expect(alert?.message).toBe(en.common.captureFault.reason.DEMO_CAPTURE_FAULT);
      expect(h.rows('FAULT_RAISED').at(-1)?.message).toBe(alert?.message);
      h.sim.actions.clearFault('CAPTURE_FAULT');
      expect(h.rows('FAULT_CLEARED').at(-1)?.message).not.toMatch(/interrupted|stopped unexpectedly/);
    });
  });
});

// Fix pass F-M5 (code review row 74, `gateway_check/18_m5_code_review.md`); each block was written
// RED against the tree of `abf742f`.
//   R74-01  two failed starts in a row are two alerts and two FAULT_RAISED rows (D84 R-3), and the
//           fault a failed start left is ended by the next start, failed or not (R-4)
//   R74-11  a demo clear does not take the cause away from a failed start that is still in FAULT
describe('the fault a failed start leaves', () => {
  const { harness } = failedStartBed;

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
});
