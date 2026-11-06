// Integration pass D6: the two pure transitions of `sim/core-facts.ts` and the INTERNAL action
// `applyStorageVolume` (CS-09) on the simulator itself.
import { describe, expect, it } from 'vitest';
import { SIM_ACTION_OPERATIONS, SimActionExecution } from '../src/api';
import { CaptureDeviceStatusSchema } from '../src/api/state-slices';
import { applyCaptureSourceFactsTransition, applyStorageVolumeTransition, createManualClock, createSim, noteTranscriptRevisionTransition, raiseCaptureWarningTransition, type SimState } from '../src/sim';

const GB = 1_000_000_000;

function freshState(): SimState {
  const sim = createSim();
  const state = sim.store.getState();
  sim.stop();
  return state;
}

describe('applyStorageVolume (CS-09)', () => {
  it('is an INTERNAL action with no operation; a simulator nobody calls it on keeps its own volume', () => {
    expect(SIM_ACTION_OPERATIONS.applyStorageVolume).toEqual({ operations: [], execution: SimActionExecution.INTERNAL });
    const state = freshState();
    expect(state.storage.volumes.find((volume) => volume.kind === 'EVIDENCE')?.totalBytes).toBe(4_000 * GB);
  });

  it('sets total and used of the evidence volume and recomputes the state; the system volume and the history are untouched; the action is the transition', () => {
    const state = freshState();
    const next = applyStorageVolumeTransition(state, { totalBytes: 500 * GB, freeBytes: 40 * GB });
    expect(next.storage.volumes.find((volume) => volume.kind === 'EVIDENCE')).toMatchObject({ totalBytes: 500 * GB, usedBytes: 460 * GB });
    expect(next.storage.state).toBe('LOW');
    expect(applyStorageVolumeTransition(state, { totalBytes: 500 * GB, freeBytes: 1 * GB }).storage.state).toBe('FULL');
    expect(next.storage.volumes.find((volume) => volume.kind === 'SYSTEM')).toBe(state.storage.volumes.find((volume) => volume.kind === 'SYSTEM'));
    expect(next.storage.history).toBe(state.storage.history);
    // The same figures again: the same state object.
    expect(applyStorageVolumeTransition(next, { totalBytes: 500 * GB, freeBytes: 40 * GB })).toBe(next);

    const sim = createSim();
    sim.actions.applyStorageVolume({ totalBytes: 500 * GB, freeBytes: 40 * GB });
    expect(sim.store.getState().storage.volumes.find((volume) => volume.kind === 'EVIDENCE')).toMatchObject({ totalBytes: 500 * GB, usedBytes: 460 * GB });
    const audited = sim.store.getState().audit.rows.length;
    sim.actions.applyStorageVolume({ totalBytes: 600 * GB, freeBytes: 300 * GB });
    // A measurement is no act of an operator: no audit row.
    expect(sim.store.getState().audit.rows.length).toBe(audited);
    sim.stop();
  });

  it('figures that are no measurement change nothing', () => {
    const state = freshState();
    for (const bad of [{ totalBytes: 0, freeBytes: 0 }, { totalBytes: 10, freeBytes: 11 }, { totalBytes: -1, freeBytes: 0 }, { totalBytes: 1.5, freeBytes: 1 }, { totalBytes: Number.NaN, freeBytes: 0 }, { totalBytes: 10, freeBytes: Number.POSITIVE_INFINITY }]) {
      expect(applyStorageVolumeTransition(state, bad), JSON.stringify(bad)).toBe(state);
    }
  });
});

describe('noteTranscriptRevisionTransition (operation 85 on a Core publishes evidence)', () => {
  const HASH = 'ab'.repeat(32);
  it('names the new head on the item; the head only moves forward; an unknown item changes nothing; no audit row', () => {
    const state = freshState();
    const item = state.evidence[0];
    if (item === undefined) throw new Error('the dataset holds no evidence item');
    const note = { evidenceId: item.id, revision: 1, state: 'READY', machineTranscriptHash: HASH, labelsStatus: 'LABELLED' } as const;
    const first = noteTranscriptRevisionTransition(state, note);
    expect(first.evidence.find((candidate) => candidate.id === item.id)?.transcript).toEqual({ state: 'READY', sha256: HASH, machineTranscriptHash: HASH, labelsStatus: 'LABELLED', revision: 1 });
    expect(first.audit).toBe(state.audit);
    expect(first.evidence.filter((candidate) => candidate.id !== item.id)).toEqual(state.evidence.filter((candidate) => candidate.id !== item.id));
    expect(noteTranscriptRevisionTransition(first, note)).toBe(first);
    expect(noteTranscriptRevisionTransition(first, { ...note, revision: 0 })).toBe(first);
    expect(noteTranscriptRevisionTransition(first, { ...note, revision: 2 }).evidence.find((candidate) => candidate.id === item.id)?.transcript?.revision).toBe(2);
    expect(noteTranscriptRevisionTransition(state, { ...note, evidenceId: 'EV-19700101-9999' })).toBe(state);
    expect(noteTranscriptRevisionTransition(state, { ...note, revision: 1.5 })).toBe(state);
  });
});

describe('a capture fault carries its reason and its file count (pass D6 item 14, D160)', () => {
  const raised = (warning: Record<string, unknown>) => {
    const state = freshState();
    const next = raiseCaptureWarningTransition(state, 1_790_000_000_000, warning as never);
    const alert = next.alerts.find((candidate) => candidate.kind === 'CAPTURE_FAULT' && candidate.active);
    const row = next.audit.rows.at(-1);
    return { params: alert?.params as Record<string, unknown> | undefined, type: row?.type, details: row?.details as Record<string, unknown> | undefined };
  };

  it('CAPTURE_FAULT without a subject: reason (a code) and evidenceFiles (a count) are on the alert params and in the FAULT_RAISED details', () => {
    const { params, type, details } = raised({ code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
    expect(params).toMatchObject({ kind: 'CAPTURE_FAULT', target: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
    expect(type).toBe('FAULT_RAISED');
    expect(details).toMatchObject({ kind: 'CAPTURE_FAULT', target: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
  });

  it('CONTROL: without them nothing is added; free text, a wrong number and unknown keys are dropped; a fault ABOUT a device carries its reason (the fault key, D146) and no file count', () => {
    const plain = raised({ code: 'CAPTURE_FAULT', subject: null });
    expect(Object.keys(plain.params ?? {}).sort()).toEqual(['eventKind', 'evt', 'kind', 'target']);
    expect(plain.details).not.toHaveProperty('reason');
    for (const bad of [{ reason: 'no camera connected' }, { reason: 'x' }, { reason: 7 }, { evidenceFiles: -1 }, { evidenceFiles: 1.5 }, { evidenceFiles: '0' }, { note: 'free text', password: 'x' }]) {
      const { params, details } = raised({ code: 'CAPTURE_FAULT', subject: null, ...bad });
      expect(Object.keys(params ?? {}).sort(), JSON.stringify(bad)).toEqual(['eventKind', 'evt', 'kind', 'target']);
      expect(Object.keys(details ?? {}).some((key) => ['reason', 'evidenceFiles', 'note', 'password'].includes(key)), JSON.stringify(bad)).toBe(false);
    }
    const onDevice = raised({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
    expect(onDevice.params).toMatchObject({ target: 'CAM-01', reason: 'NO_CAMERA_CONNECTED' });
    expect(onDevice.params).not.toHaveProperty('evidenceFiles');
    expect(onDevice.details).toMatchObject({ target: 'CAM-01', reason: 'NO_CAMERA_CONNECTED' });
    expect(onDevice.details).not.toHaveProperty('evidenceFiles');
  });
});

// Integration pass D10, item 2 (pass D6 item 15; row 140's findings F-2 and F-5): the source facts
// of a real capture operation, as the pure transition a door of the engine host applies.
describe('applyCaptureSourceFactsTransition: the class of a built-in test source and "is on"', () => {
  const idle = (): SimState => createSim({ clock: createManualClock(Date.UTC(2026, 9, 1, 3, 0, 0)), storage: null, authStorage: null }).store.getState();
  const marks = (state: SimState): string[] => state.captureDevices.devices.map((device) => `${device.id} ${device.adapter ?? '-'} ${device.sourceClass ?? '-'} ${device.sourceOpen === true ? 'on' : '-'}`);

  it('CONTROL - simulated capture never calls it: no built-in device carries a class or "is on"; the slice passes its schema', () => {
    const state = idle();
    expect(marks(state).every((mark) => mark.endsWith(' - - -'))).toBe(true);
    expect(JSON.stringify(state.captureDevices)).not.toMatch(/sourceClass|sourceOpen|"adapter"/);
  });

  it('a development operation: the four built-in test sources gain adapter FAKE and class DEVELOPMENT; nothing else moves', () => {
    const state = idle();
    const next = applyCaptureSourceFactsTransition(state, ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'].map((deviceId) => ({ deviceId, adapter: 'FAKE', open: false })));
    expect(marks(next).filter((mark) => /^(CAM|MIC)-0[12] /.test(mark))).toEqual(['CAM-01 FAKE DEVELOPMENT -', 'CAM-02 FAKE DEVELOPMENT -', 'MIC-01 FAKE DEVELOPMENT -', 'MIC-02 FAKE DEVELOPMENT -']);
    // The PoE switch was not named: it carries nothing.
    expect(marks(next).find((mark) => mark.startsWith('POE'))).toMatch(/ - - -$/);
    for (const device of next.captureDevices.devices) expect(CaptureDeviceStatusSchema.safeParse(device).success, device.id).toBe(true);
    const { captureDevices: _before, ...restBefore } = state;
    const { captureDevices: _after, ...restAfter } = next;
    expect(restAfter).toEqual(restBefore);
    // The same facts again: the same state object (nothing is written or published twice).
    expect(applyCaptureSourceFactsTransition(next, ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'].map((deviceId) => ({ deviceId, adapter: 'FAKE', open: false })))).toBe(next);
  });

  it('"is on": true while the source is open, the member removed when it closes; a device the list does not name is not open', () => {
    const state = idle();
    const opened = applyCaptureSourceFactsTransition(state, [{ deviceId: 'CAM-01', open: true }]);
    expect(opened.captureDevices.devices.find((device) => device.id === 'CAM-01')?.sourceOpen).toBe(true);
    expect(opened.captureDevices.devices.filter((device) => device.sourceOpen === true).map((device) => device.id)).toEqual(['CAM-01']);
    const closed = applyCaptureSourceFactsTransition(opened, []);
    expect(closed.captureDevices.devices.some((device) => 'sourceOpen' in device)).toBe(false);
    expect(CaptureDeviceStatusSchema.safeParse(opened.captureDevices.devices[0]).success).toBe(true);
  });

  it('a fact never rewrites a stored adapter, names no unknown device, and takes no adapter that is no code', () => {
    const state = idle();
    const first = state.captureDevices.devices[0];
    if (first === undefined) throw new Error('no capture device');
    const adopted: SimState = { ...state, captureDevices: { ...state.captureDevices, devices: [{ ...first, adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' }, ...state.captureDevices.devices.slice(1)] } };
    const next = applyCaptureSourceFactsTransition(adopted, [{ deviceId: first.id, adapter: 'FAKE', open: false }, { deviceId: 'CAM-99', adapter: 'FAKE', open: true }, { deviceId: 'MIC-01', adapter: 'not a code', open: false }]);
    expect(next).toBe(adopted);
  });
});
