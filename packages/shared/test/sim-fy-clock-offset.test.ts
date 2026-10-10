// Tidy pass F-Y, item 4 (fix pass F-M3 decision 3; ruling D179 "a camera clock up to 2 s off is
// accepted and RECORDED, not corrected"): the fifth advisory notice, `CAMERA_CLOCK_OFFSET`. The
// capture side raises it when the offset the worker measured for a camera is above its threshold;
// the alert says the number and that the recording keeps the camera's own timeline.
import { describe, expect, it } from 'vitest';
import { REPLICATED_SLICE_SCHEMAS } from '../src/api';

import {
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  CAPTURE_ADVISORY_DEVICE_KIND,
  CAPTURE_ADVISORY_REASONS,
  CAPTURE_REASON_SEVERITY,
  CaptureAdvisoryReason,
  CaptureNoticeReason,
  cameraClockOffsetSentence,
  captureFaultSentence,
  createManualClock,
  createSim,
  isCaptureFaultReason,
} from '../src/sim';

const START = 1_760_000_000_000;

function recording() {
  const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario: 'recording' });
  const operator = OPERATORS.find((candidate) => candidate.role === 'TECHNICIAN');
  if (operator === undefined) throw new Error('no seeded TECHNICIAN');
  expect(sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  return { sim, state: () => sim.store.getState() };
}

describe('the advisory notice CAMERA_CLOCK_OFFSET', () => {
  it('is an advisory reason of a camera, INFO, with its own sentence', () => {
    expect(CaptureAdvisoryReason.CAMERA_CLOCK_OFFSET).toBe('CAMERA_CLOCK_OFFSET');
    expect(CAPTURE_ADVISORY_DEVICE_KIND.CAMERA_CLOCK_OFFSET).toBe('CAMERA');
    expect(isCaptureFaultReason('CAMERA_CLOCK_OFFSET')).toBe(true);
    expect(CAPTURE_ADVISORY_REASONS).toContain('CAMERA_CLOCK_OFFSET');
    expect(CAPTURE_REASON_SEVERITY.CAMERA_CLOCK_OFFSET).toBe('INFO');
  });

  it('the sentence says the number of ms (its size, whatever the sign) and what the recording does with it', () => {
    expect(cameraClockOffsetSentence(-1_500)).toBe("Camera clock differs from the Core by 1500 ms; the recording keeps the camera's own timeline and records the offset.");
    expect(cameraClockOffsetSentence(732)).toContain('by 732 ms;');
    // No number: the sentence of the table, which a client fills (`{{offsetMs}}`), is never shown raw.
    expect(cameraClockOffsetSentence(null)).not.toMatch(/\{\{|NaN|null/);
    expect(captureFaultSentence('CAMERA_CLOCK_OFFSET', 'CAM-01')).not.toMatch(/\{\{/);
  });

  it('a raise with the measured offset: ONE SYSTEM alert (INFO) on the camera with the number in its text and params; no fault, no audit row; a second raise writes nothing; the clear resolves it', () => {
    const h = recording();
    const before = h.state();
    h.sim.actions.raiseCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-02', offsetMs: -1_500 });
    const raised = h.state();
    const alerts = raised.alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM' && !before.alerts.includes(alert));
    expect(alerts.map((alert) => [alert.severity, alert.target, alert.message, alert.params])).toEqual([
      ['INFO', 'CAM-02', "Camera clock differs from the Core by 1500 ms; the recording keeps the camera's own timeline and records the offset.", { reason: 'CAMERA_CLOCK_OFFSET', deviceId: 'CAM-02', deviceKind: 'CAMERA', sessionId: before.session?.id, offsetMs: -1_500 }],
    ]);
    expect(REPLICATED_SLICE_SCHEMAS.alerts.safeParse(raised.alerts).success).toBe(true);
    expect(raised.faults).toBe(before.faults);
    expect(raised.audit.rows).toHaveLength(before.audit.rows.length);
    expect(raised.session?.state).toBe('RECORDING');
    h.sim.actions.raiseCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-02', offsetMs: -1_900 });
    expect(h.state().alerts).toBe(raised.alerts);
    h.sim.actions.clearCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-02' });
    expect(h.state().alerts.filter((alert) => alert.active && alert.params?.['reason'] === 'CAMERA_CLOCK_OFFSET')).toEqual([]);
  });

  it('CONTROL: the number belongs to this notice alone - another advisory notice given one neither shows nor stores it; a number that is no whole ms is not stored', () => {
    const h = recording();
    h.sim.actions.raiseCaptureWarning({ code: 'AV_OFFSET_NEAR_BOUND', subject: 'CAM-01', offsetMs: 900 });
    const near = h.state().alerts.find((alert) => alert.active && alert.params?.['reason'] === 'AV_OFFSET_NEAR_BOUND');
    expect(near?.params).not.toHaveProperty('offsetMs');
    expect(near?.message).not.toMatch(/900/);
    h.sim.actions.raiseCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-01', offsetMs: Number.NaN });
    const offset = h.state().alerts.find((alert) => alert.active && alert.params?.['reason'] === 'CAMERA_CLOCK_OFFSET');
    expect(offset?.params).not.toHaveProperty('offsetMs');
    expect(offset?.message).not.toMatch(/NaN|\{\{/);
    // A microphone is no camera: refused, as for every camera notice.
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'MIC-01', offsetMs: 900 })).toThrow();
  });
});

// Controller decision D189 (fix F-M7c could not build a boot probe of the sync level: the worker's
// `FIRST_DURABLE_FRAGMENT.syncLevel` is the only truthful source). A session whose first durable
// fragment was NOT synced through the drive cache is told: ONE alert on the session, CRITICAL where
// the sources are production's, advice (INFO) in the development operation. The session records on.
describe('the notice EVIDENCE_VOLUME_SYNC_NOT_FULL', () => {
  const SENTENCE = 'The evidence volume does not confirm full durability; recordings may not survive a power loss.';

  it('has its sentence in the wording source, about the capture as a whole', () => {
    expect(CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL).toBe('EVIDENCE_VOLUME_SYNC_NOT_FULL');
    expect(captureFaultSentence('EVIDENCE_VOLUME_SYNC_NOT_FULL', null)).toBe(SENTENCE);
    expect(CAPTURE_REASON_SEVERITY.EVIDENCE_VOLUME_SYNC_NOT_FULL).toBe('CRITICAL');
  });

  it.each([
    ['critical: true (production sources)', true, 'CRITICAL'],
    ['critical: false (the development operation)', false, 'INFO'],
  ] as const)('%s: ONE SYSTEM alert on the session with that severity; a second camera file of the same session writes nothing; no fault, no audit row, the session keeps recording; the clear resolves it', (_name, critical, severity) => {
    const h = recording();
    const before = h.state();
    h.sim.actions.raiseCaptureWarning({ code: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', subject: null, critical, syncLevel: 'FSYNC' });
    const raised = h.state();
    h.sim.actions.raiseCaptureWarning({ code: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', subject: null, critical, syncLevel: 'FSYNC' });
    expect(h.state().alerts).toBe(raised.alerts);
    const alerts = raised.alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM' && !before.alerts.includes(alert));
    expect(alerts.map((alert) => [alert.severity, alert.target, alert.message, alert.params])).toEqual([[severity, 'EVIDENCE_VOLUME', SENTENCE, { reason: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', sessionId: before.session?.id, syncLevel: 'FSYNC' }]]);
    expect(REPLICATED_SLICE_SCHEMAS.alerts.safeParse(raised.alerts).success).toBe(true);
    expect(raised.faults).toBe(before.faults);
    expect(raised.audit.rows).toHaveLength(before.audit.rows.length);
    expect(raised.session?.state).toBe('RECORDING');
    h.sim.actions.clearCaptureWarning({ code: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', subject: null });
    expect(h.state().alerts.filter((alert) => alert.active && alert.params?.['reason'] === 'EVIDENCE_VOLUME_SYNC_NOT_FULL')).toEqual([]);
  });
});
