// The key of a fault is (kind, reason, target) (controller ruling D146; database contract erratum
// PE-0013-01; migration 0013). Two causes of one kind on one device are two faults - each with its
// own entry, alert and audit rows - and a fault without a cause behaves as it always did.
import { describe, expect, it } from 'vitest';
import { FaultsSliceSchema } from '../src/api/state-slices';
import { createManualClock, createSim, isFaultActive, type SimState } from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'recording', capture: 'external' });
  return { sim, clock, state: (): SimState => sim.store.getState() };
}

const captureFaults = (state: SimState) => state.faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT');
const activeAlerts = (state: SimState, target: string | null) => state.alerts.filter((alert) => alert.active && (alert.target ?? null) === target);
const rowsOf = (state: SimState, type: string) => state.audit.rows.filter((row) => row.type === type);

describe('two causes of CAPTURE_FAULT on one camera are two faults', () => {
  it('each raise writes its own entry, alert and FAULT_RAISED row; the same cause again writes nothing', () => {
    const h = harness();
    const raisedBefore = rowsOf(h.state(), 'FAULT_RAISED').length;
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
    h.clock.advance(100);
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' } as never);
    const two = h.state();
    expect(captureFaults(two)).toEqual([
      { kind: 'CAPTURE_FAULT', since: START, target: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' },
      { kind: 'CAPTURE_FAULT', since: START + 100, target: 'CAM-01', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' },
    ]);
    expect(activeAlerts(two, 'CAM-01').map((alert) => [alert.kind, alert.params?.['reason']])).toEqual([
      ['CAPTURE_FAULT', 'CAMERA_STREAM_ENDED'],
      ['CAPTURE_FAULT', 'CAMERA_CLOCK_OUT_OF_BOUND'],
    ]);
    expect(rowsOf(two, 'FAULT_RAISED').length).toBe(raisedBefore + 2);
    expect(rowsOf(two, 'FAULT_RAISED').slice(-2).map((row) => row.details?.['reason'])).toEqual(['CAMERA_STREAM_ENDED', 'CAMERA_CLOCK_OUT_OF_BOUND']);
    // The slice passes its schema with the member, and is refused with a cause that is no code.
    expect(FaultsSliceSchema.safeParse(two.faults).success).toBe(true);
    expect(FaultsSliceSchema.safeParse({ active: [{ kind: 'CAPTURE_FAULT', since: START, target: 'CAM-01', reason: 'stream ended' }] }).success).toBe(false);

    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
    expect(h.state()).toBe(two);
  });

  it('a clear that names its cause clears that fault alone: one FAULT_CLEARED row, the other alert stays active', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' } as never);
    const clearedBefore = rowsOf(h.state(), 'FAULT_CLEARED').length;
    h.clock.advance(500);
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
    const one = h.state();
    expect(captureFaults(one).map((fault) => fault.reason)).toEqual(['CAMERA_CLOCK_OUT_OF_BOUND']);
    expect(activeAlerts(one, 'CAM-01').map((alert) => alert.params?.['reason'])).toEqual(['CAMERA_CLOCK_OUT_OF_BOUND']);
    expect(one.alerts.find((alert) => alert.params?.['reason'] === 'CAMERA_STREAM_ENDED')).toMatchObject({ active: false, resolvedAt: START + 500 });
    expect(rowsOf(one, 'FAULT_CLEARED').length).toBe(clearedBefore + 1);
    expect(rowsOf(one, 'FAULT_CLEARED').at(-1)?.details).toMatchObject({ kind: 'CAPTURE_FAULT', target: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' });
    expect(isFaultActive(one.faults, 'CAPTURE_FAULT', 'CAM-01', 'CAMERA_STREAM_ENDED')).toBe(false);
    expect(isFaultActive(one.faults, 'CAPTURE_FAULT', 'CAM-01', 'CAMERA_CLOCK_OUT_OF_BOUND')).toBe(true);
    expect(isFaultActive(one.faults, 'CAPTURE_FAULT', 'CAM-01')).toBe(true);
    expect(isFaultActive(one.faults, 'CAPTURE_FAULT', 'CAM-01', null)).toBe(false);
    // A clear of a cause that is not active changes nothing.
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_NOT_CONNECTED' } as never);
    expect(h.state()).toBe(one);
  });

  it('a clear WITHOUT a cause clears every cause on that device, and no other device', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' } as never);
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' } as never);
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01' });
    expect(captureFaults(h.state())).toMatchObject([{ target: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' }]);
    expect(activeAlerts(h.state(), 'CAM-01')).toEqual([]);
    expect(activeAlerts(h.state(), 'CAM-02')).toHaveLength(1);
  });
});

describe('one microphone: silent, disconnected, a second capture cause and the rate advice are four alerts', () => {
  it('each has its own alert on the device; clearing one leaves the others', () => {
    const h = harness();
    const micDevice = h.state().captureConfig.mics.find((mic) => mic.inputId === 'MIC-01')?.deviceId ?? 'MIC-01';
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' });
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'MIC-01', reason: 'MIC_DISCONNECTED' } as never);
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'MIC-01', reason: 'MIC_INPUT_STALLED' } as never);
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: micDevice } as never);
    const state = h.state();
    const mine = state.alerts.filter((alert) => alert.active && (alert.target === micDevice || alert.kind === 'MIC_SILENT'));
    expect(mine.map((alert) => `${alert.kind}/${String(alert.params?.['reason'] ?? '-')}`).sort()).toEqual([
      'CAPTURE_FAULT/MIC_DISCONNECTED',
      'CAPTURE_FAULT/MIC_INPUT_STALLED',
      'MIC_SILENT/-',
      'SYSTEM/MIC_RATE_AT_LIMIT',
    ]);
    expect(new Set(mine.map((alert) => alert.id)).size).toBe(4);

    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'MIC-01', reason: 'MIC_DISCONNECTED' } as never);
    const after = h.state().alerts.filter((alert) => alert.active && (alert.target === micDevice || alert.kind === 'MIC_SILENT'));
    expect(after.map((alert) => `${alert.kind}/${String(alert.params?.['reason'] ?? '-')}`).sort()).toEqual([
      'CAPTURE_FAULT/MIC_INPUT_STALLED',
      'MIC_SILENT/-',
      'SYSTEM/MIC_RATE_AT_LIMIT',
    ]);
  });
});

describe('the capture as a whole (no device) holds ONE fault at a time: its cause is a fact, not a key', () => {
  it('two raisers that name different causes (the forwarder and the failed start) make one fault, one alert and one FAULT_RAISED row; the first cause stays on the alert', () => {
    const h = harness();
    const raisedBefore = rowsOf(h.state(), 'FAULT_RAISED').length;
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } as never);
    const one = h.state();
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null, reason: 'CAPTURE_START_FAILED', evidenceFiles: 0 } as never);
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null });
    expect(h.state()).toBe(one);
    expect(captureFaults(one)).toEqual([{ kind: 'CAPTURE_FAULT', since: START, target: null }]);
    expect(activeAlerts(one, null).filter((alert) => alert.kind === 'CAPTURE_FAULT').map((alert) => alert.params?.['reason'])).toEqual(['NO_CAMERA_CONNECTED']);
    expect(rowsOf(one, 'FAULT_RAISED').length).toBe(raisedBefore + 1);
    expect(rowsOf(one, 'FAULT_RAISED').at(-1)?.details).toMatchObject({ reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
    // And the other way round: raised without a cause first, a later raise with one adds nothing.
    const other = harness();
    other.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null });
    const plain = other.state();
    other.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } as never);
    expect(other.state()).toBe(plain);
  });

  it('a clear resolves it whatever cause the clear names, or none; a fault about a device beside it is untouched', () => {
    for (const clear of [{ code: 'CAPTURE_FAULT', subject: null }, { code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED' }, { code: 'CAPTURE_FAULT', subject: null, reason: 'ANOTHER_CODE' }]) {
      const h = harness();
      h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } as never);
      h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
      h.sim.actions.clearCaptureWarning(clear as never);
      expect(captureFaults(h.state()), JSON.stringify(clear)).toEqual([{ kind: 'CAPTURE_FAULT', since: START, target: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' }]);
      expect(h.state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT').map((alert) => [alert.target ?? null, alert.active])).toEqual([[null, false], ['CAM-01', true]]);
    }
  });
});

describe('a fault without a cause behaves as before', () => {
  it('one entry without the member; a second raise writes nothing; the clear resolves it', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    const raised = h.state();
    expect(captureFaults(raised)).toEqual([{ kind: 'CAPTURE_FAULT', since: START, target: 'CAM-02' }]);
    expect(Object.keys(captureFaults(raised)[0] ?? {})).not.toContain('reason');
    expect(activeAlerts(raised, 'CAM-02')[0]?.params).not.toHaveProperty('reason');
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    expect(h.state()).toBe(raised);
    // A cause beside it is another fault; the one without a cause is still its own.
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' } as never);
    expect(captureFaults(h.state())).toHaveLength(2);
    expect(isFaultActive(h.state().faults, 'CAPTURE_FAULT', 'CAM-02', null)).toBe(true);
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    expect(captureFaults(h.state())).toEqual([]);
    expect(activeAlerts(h.state(), 'CAM-02')).toEqual([]);
  });

  it('a demo fault (inject / clearFault) is keyed by kind and target, with no member', () => {
    const h = harness();
    h.sim.actions.inject('FAN_STALL');
    h.sim.actions.inject('FAN_STALL');
    expect(h.state().faults.active.filter((fault) => fault.kind === 'FAN_STALL')).toEqual([{ kind: 'FAN_STALL', since: START, target: null }]);
    h.sim.actions.clearFault('FAN_STALL');
    expect(h.state().faults.active.filter((fault) => fault.kind === 'FAN_STALL')).toEqual([]);
  });
});
