// Fix pass F-M5, review R74-03: every capture fault is worded by its REASON, from one source
// (`src/sim/capture-fault-wording.ts`). Written RED against `abf742f`, where every reason read
// "Capture fault: a recording file stopped growing (<device>)".
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
} from '../src/sim';

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
