/**
 * The pure model and the two ports of the device selector (task 3 row 68; ux spec §2 flow 1; checks
 * M4-PC-1 (unit inventory) and M4-RG-MOB). The simulated port runs against the REAL simulator, so the
 * audit rule of R-1 AC-1 (one row per edit, none for a refusal) is asserted on its audit log.
 */
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CAPTURE_CONFIG, DEFAULT_CAPTURE_DEVICES, DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName, type CaptureDevicesSlice } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import {
  SELECTOR_GATED_CONTROLS,
  cameraLineStatus,
  cameraOptions,
  cameraRows,
  classifyAnswer,
  factsOfEnvelope,
  isAwaitingRepublish,
  isNoChange,
  isSelectorEmpty,
  micRows,
  selectorGate,
  updatedAtOf,
} from './capture-selector-model';
import { liveSelectorPort, selectorPath, simSelectorPort } from './capture-selector-port';

const withAdopted: CaptureDevicesSlice = {
  devices: [
    ...DEFAULT_CAPTURE_DEVICES.devices,
    { id: 'CAM-07', kind: 'CAMERA', model: 'Adopted camera', firmware: null, host: '127.0.0.1:8557', poePort: null, online: true, streamState: 'LIVE', capabilities: ['VIDEO'] },
  ],
};

function signedIn(username: string) {
  const test = createTestSim();
  const operator = OPERATORS.find((candidate) => candidate.username === username)!;
  expect(test.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  return test;
}

const configAudit = (test: ReturnType<typeof createTestSim>) => test.sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');

describe('rows and options', () => {
  it('camera rows are VIDEO-01 then VIDEO-02; microphone rows are PRIMARY first', () => {
    const swapped = {
      cameras: [...DEFAULT_CAPTURE_CONFIG.cameras].reverse(),
      mics: DEFAULT_CAPTURE_CONFIG.mics.map((mic) => ({ ...mic, role: mic.role === 'PRIMARY' ? ('STANDBY' as const) : ('PRIMARY' as const) })),
    };
    expect(cameraRows(swapped, DEFAULT_CAPTURE_DEVICES).map((row) => [row.trackId, row.deviceId, row.model])).toEqual([
      ['VIDEO-01', 'CAM-01', 'Dual-lens IP camera DL-2'],
      ['VIDEO-02', 'CAM-02', 'Dual-lens IP camera DL-2'],
    ]);
    expect(micRows(swapped, DEFAULT_CAPTURE_DEVICES).map((row) => [row.inputId, row.role])).toEqual([
      ['MIC-02', 'PRIMARY'],
      ['MIC-01', 'STANDBY'],
    ]);
  });

  it('PE-127-07: an adopted CAM-NN is an option; a microphone, the PoE switch and an unregistered id are not', () => {
    const options = cameraOptions(DEFAULT_CAPTURE_CONFIG, withAdopted);
    expect(options.map((option) => option.deviceId)).toEqual(['CAM-01', 'CAM-02', 'CAM-07']);
    expect(options.map((option) => option.assignedTo)).toEqual(['VIDEO-01', 'VIDEO-02', null]);
    // Negative control: without the registry row the camera is not offered.
    expect(cameraOptions(DEFAULT_CAPTURE_CONFIG, DEFAULT_CAPTURE_DEVICES).map((option) => option.deviceId)).not.toContain('CAM-07');
  });

  it('status words are text only: LIVE, LOST, OFFLINE; empty means no line and no device', () => {
    expect(cameraLineStatus({ online: true, streamState: 'LIVE' })).toBe('LIVE');
    expect(cameraLineStatus({ online: true, streamState: 'LOST' })).toBe('LOST');
    expect(cameraLineStatus({ online: false, streamState: 'LIVE' })).toBe('OFFLINE');
    expect(isSelectorEmpty({ cameras: [], mics: [] }, { devices: [] })).toBe(true);
    expect(isSelectorEmpty(DEFAULT_CAPTURE_CONFIG, DEFAULT_CAPTURE_DEVICES)).toBe(false);
  });
});

describe('the gate of G1-G3 (M4-PC-1 inventory)', () => {
  it('names the three gated controls of flow 1 this row draws', () => {
    expect(SELECTOR_GATED_CONTROLS).toEqual(['G1', 'G2', 'G3']);
  });

  it('an unknown role is "checking" whatever else holds: never allowed, never denied', () => {
    for (const permitted of [true, false])
      for (const linkDown of [true, false])
        for (const locked of [true, false]) expect(selectorGate({ roleKnown: false, permitted, linkDown, locked })).toBe('checking');
  });

  it('then waiting (link down), denied (no CAPTURE_CONFIG), locked (session open), allowed', () => {
    expect(selectorGate({ roleKnown: true, permitted: true, linkDown: true, locked: false })).toBe('waiting');
    expect(selectorGate({ roleKnown: true, permitted: false, linkDown: false, locked: true })).toBe('denied');
    expect(selectorGate({ roleKnown: true, permitted: true, linkDown: false, locked: true })).toBe('locked');
    expect(selectorGate({ roleKnown: true, permitted: true, linkDown: false, locked: false })).toBe('allowed');
  });
});

describe('answers (ux §2.5)', () => {
  it('classifies every documented answer of ops 79 and 80', () => {
    const c = (status: number | null, code: string | null = null, reason: string | null = null) => classifyAnswer({ status, code, reason });
    expect(c(200)).toBe('ok');
    expect(c(409, 'CAPTURE_CONFIG_LOCKED')).toBe('locked');
    // A different 409 is not the lock.
    expect(c(409, 'INVALID_STATE')).toBe('failed');
    expect(c(403, 'NOT_PERMITTED')).toBe('denied');
    expect(c(401, 'NOT_SIGNED_IN')).toBe('signedOut');
    expect(c(404, 'NOT_FOUND')).toBe('notFound');
    expect(c(422, 'INVALID_INPUT')).toBe('invalid');
    expect(c(422, 'INVALID_INPUT', 'DEVELOPMENT_SOURCE_NOT_ALLOWED')).toBe('developmentOnly');
    expect(c(400, 'BAD_REQUEST')).toBe('invalid');
    expect(c(503, 'NOT_READY', 'CAPTURE_NOT_READY')).toBe('notReady');
    expect(c(null)).toBe('offline');
    expect(c(500, 'INTERNAL')).toBe('failed');
  });

  it('reads code and reason from an envelope and nothing from anything else', () => {
    expect(factsOfEnvelope(503, { error: { code: 'NOT_READY', message: 'x', details: { reason: 'CAPTURE_NOT_READY' } } })).toEqual({ status: 503, code: 'NOT_READY', reason: 'CAPTURE_NOT_READY' });
    expect(factsOfEnvelope(500, 'boom')).toEqual({ status: 500, code: null, reason: null });
    expect(updatedAtOf({ updatedAt: 12 })).toBe(12);
    expect(updatedAtOf({ updatedAt: '12' })).toBeNull();
  });

  it('a saved change is pending until the store holds a config at least as new as the answer', () => {
    expect(isAwaitingRepublish(2_000, 1_000)).toBe(true);
    expect(isAwaitingRepublish(2_000, 2_000)).toBe(false);
    expect(isAwaitingRepublish(null, 0)).toBe(false);
  });

  it('a command that changes nothing is recognised', () => {
    expect(isNoChange({ kind: 'primaryMic', inputId: 'MIC-01' }, DEFAULT_CAPTURE_CONFIG)).toBe(true);
    expect(isNoChange({ kind: 'primaryMic', inputId: 'MIC-02' }, DEFAULT_CAPTURE_CONFIG)).toBe(false);
    expect(isNoChange({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-01' }, DEFAULT_CAPTURE_CONFIG)).toBe(true);
    expect(isNoChange({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-02' }, DEFAULT_CAPTURE_CONFIG)).toBe(false);
  });
});

describe('the simulated port (ops 79, 80 of the in-app simulator)', () => {
  it('the paths are the contract paths, ids encoded', () => {
    expect(selectorPath({ kind: 'camera', trackId: 'VIDEO-02', deviceId: 'CAM-01' })).toBe('/api/v1/capture/cameras/CAM-01/source');
    expect(selectorPath({ kind: 'primaryMic', inputId: 'MIC-02' })).toBe('/api/v1/capture/mics/MIC-02/primary');
    expect(selectorPath({ kind: 'camera', trackId: 'VIDEO-01', deviceId: '../x' })).toBe('/api/v1/capture/cameras/..%2Fx/source');
  });

  it('SUPERVISOR: setPrimaryMic swaps the roles and writes exactly one CAPTURE_CONFIG_CHANGED row', async () => {
    const test = signedIn('andi.pratama');
    const answer = await simSelectorPort(test.sim).send({ kind: 'primaryMic', inputId: 'MIC-02' });
    expect(answer.result).toBe('ok');
    expect(answer.updatedAt).toBe(test.sim.store.getState().captureConfig.updatedAt);
    expect(test.sim.store.getState().captureConfig.mics.map((mic) => [mic.inputId, mic.role])).toEqual(
      expect.arrayContaining([
        ['MIC-02', 'PRIMARY'],
        ['MIC-01', 'STANDBY'],
      ]),
    );
    expect(configAudit(test)).toHaveLength(1);
    expect(configAudit(test)[0]!.details).toMatchObject({ operationId: 'setPrimaryMic', inputId: 'MIC-02', to: 'PRIMARY' });
  });

  it('TECHNICIAN: setCaptureCameraSource assigns the camera to the track, one audit row', async () => {
    const test = signedIn('rina.wijaya');
    // Row 138 fix: one camera on both tracks with one profile is refused since row 66 (422, OD-05), so the
    // legal edit is a camera added later; the refusal itself is the next assertion.
    test.sim.actions.registerCaptureDevice({ id: 'CAM-03', model: 'Test source', host: '127.0.0.1', adapter: 'FAKE' });
    const refused = await simSelectorPort(test.sim).send({ kind: 'camera', trackId: 'VIDEO-02', deviceId: 'CAM-01' });
    expect(refused.result).toBe('invalid');
    expect(configAudit(test)).toHaveLength(0);
    const answer = await simSelectorPort(test.sim).send({ kind: 'camera', trackId: 'VIDEO-02', deviceId: 'CAM-03' });
    expect(answer.result).toBe('ok');
    expect(test.sim.store.getState().captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-03');
    expect(configAudit(test)).toHaveLength(1);
    expect(configAudit(test)[0]!.details).toMatchObject({ operationId: 'setCaptureCameraSource', trackId: 'VIDEO-02', from: 'CAM-02', to: 'CAM-03' });
  });

  it('INVESTIGATOR is denied; an unknown or candidate id is not found; neither changes the selector nor writes a config row', async () => {
    const denied = signedIn('budi.santoso');
    const before = denied.sim.store.getState().captureConfig;
    expect((await simSelectorPort(denied.sim).send({ kind: 'primaryMic', inputId: 'MIC-02' })).result).toBe('denied');
    expect(denied.sim.store.getState().captureConfig).toBe(before);
    expect(configAudit(denied)).toHaveLength(0);

    const tech = signedIn('rina.wijaya');
    expect((await simSelectorPort(tech.sim).send({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAND-0001' })).result).toBe('notFound');
    // A microphone is not a camera source.
    expect((await simSelectorPort(tech.sim).send({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'MIC-01' })).result).toBe('notFound');
    expect(configAudit(tech)).toHaveLength(0);
  });

  it('OD-10: while a session is open the edit is refused as locked with NO audit row (R-1 AC-1)', async () => {
    const test = signedIn('andi.pratama');
    test.sim.actions.loadScenario(ScenarioName.RECORDING);
    const before = test.sim.store.getState().captureConfig;
    const answer = await simSelectorPort(test.sim).send({ kind: 'primaryMic', inputId: 'MIC-02' });
    expect(answer.result).toBe('locked');
    expect(answer.facts).toMatchObject({ status: 409, code: 'CAPTURE_CONFIG_LOCKED' });
    expect(test.sim.store.getState().captureConfig).toBe(before);
    expect(configAudit(test)).toHaveLength(0);
  });

  it('a simulator that throws is an offline answer, not an exception', async () => {
    const port = simSelectorPort({
      request: () => {
        throw new Error('down');
      },
    });
    await expect(port.send({ kind: 'primaryMic', inputId: 'MIC-02' })).resolves.toMatchObject({ result: 'offline', updatedAt: null });
  });
});

describe('the Live port (the app\'s one typed client)', () => {
  type Call = { operationId: string; input: unknown };
  function fakeClient(answer: unknown) {
    const calls: Call[] = [];
    const client = {
      call: (operationId: string, input: unknown) => {
        calls.push({ operationId, input });
        return Promise.resolve(answer);
      },
    } as unknown as Parameters<typeof liveSelectorPort>[0];
    return { calls, client };
  }

  it('sends operation 79 with the camera in the path and the track in the body; 80 with the input in the path and no body', async () => {
    const ok = fakeClient({ ok: true, status: 200, data: { cameras: [], mics: [], locked: false, updatedAt: 77 } });
    const port = liveSelectorPort(ok.client);
    await expect(port.send({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-07' })).resolves.toMatchObject({ result: 'ok', updatedAt: 77 });
    await expect(port.send({ kind: 'primaryMic', inputId: 'MIC-02' })).resolves.toMatchObject({ result: 'ok', updatedAt: 77 });
    expect(ok.calls).toEqual([
      { operationId: 'setCaptureCameraSource', input: { params: { id: 'CAM-07' }, body: { trackId: 'VIDEO-01' } } },
      { operationId: 'setPrimaryMic', input: { params: { id: 'MIC-02' } } },
    ]);
  });

  it('maps a refusal by status, code and details.reason; a rejected call is offline', async () => {
    const refused = (status: number | null, code: string, details?: Record<string, unknown>) =>
      liveSelectorPort(fakeClient({ ok: false, status, kind: 'REFUSED', error: { code, message: 'm', ...(details ? { details } : {}) } }).client).send({ kind: 'primaryMic', inputId: 'MIC-02' });
    await expect(refused(409, 'CAPTURE_CONFIG_LOCKED')).resolves.toMatchObject({ result: 'locked', updatedAt: null });
    await expect(refused(403, 'NOT_PERMITTED')).resolves.toMatchObject({ result: 'denied' });
    await expect(refused(503, 'NOT_READY', { reason: 'CAPTURE_NOT_READY' })).resolves.toMatchObject({ result: 'notReady', facts: { reason: 'CAPTURE_NOT_READY' } });
    await expect(refused(null, 'NETWORK')).resolves.toMatchObject({ result: 'offline' });
    const throwing = { call: () => Promise.reject(new Error('socket')) } as unknown as Parameters<typeof liveSelectorPort>[0];
    await expect(liveSelectorPort(throwing).send({ kind: 'primaryMic', inputId: 'MIC-02' })).resolves.toMatchObject({ result: 'offline' });
  });
});
