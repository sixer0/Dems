/**
 * The pure model and the two ports of the device selector (task 3 row 68; ux spec §2 flow 1; checks
 * M4-PC-1 (unit inventory) and M4-RG-MOB). The simulated port runs against the REAL simulator, so the
 * audit rule of R-1 AC-1 (one row per edit, none for a refusal) is asserted on its audit log.
 *
 * D61 (2026-11-04): FOUR simultaneous microphone channels — the microphone rows, options and
 * commands are keyed by CHANNEL (`MIC-01`..`MIC-04`); operation 78's pair replacement (D133 (1)) is
 * superseded by the line by channel, and a microphone another channel holds MOVES (`micMove`).
 * Audit row 188 (M3-07 R1/R2; D126, D163): onto a channel that holds a microphone that move is the SWAP
 * `{ mics: [to-line, from-line] }` (register S1); onto an empty one it stays the MOVE (S2); either is sent
 * once, only after the confirm (`micMoveGate`).
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
  isEmptySlotRow,
  isNoChange,
  isSelectorEmpty,
  micLineCommand,
  micMoveAskOf,
  micOptions,
  micRows,
  selectorGate,
  updatedAtOf,
} from './capture-selector-model';
import { liveSelectorPort, micLineBody, micMoveBody, micMoveGate, selectorPath, simSelectorPort } from './capture-selector-port';

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
  it('camera rows are VIDEO-01 to VIDEO-04 (D60, 2026-11-04); microphone rows are MIC-01 to MIC-04 (D61, 2026-11-04)', () => {
    const swapped = {
      cameras: [...DEFAULT_CAPTURE_CONFIG.cameras].reverse(),
      mics: DEFAULT_CAPTURE_CONFIG.mics.map((mic) => ({ ...mic, channel: mic.channel === 'MIC-01' ? ('MIC-02' as const) : mic.channel === 'MIC-02' ? ('MIC-01' as const) : mic.channel })),
    };
    expect(cameraRows(swapped, DEFAULT_CAPTURE_DEVICES).map((row) => [row.trackId, row.deviceId, row.model])).toEqual([
      ['VIDEO-01', 'CAM-01', 'Dual-lens IP camera DL-2'],
      ['VIDEO-02', 'CAM-02', 'Dual-lens IP camera DL-2'],
      ['VIDEO-03', 'CAM-03', 'IP camera IP-3'], // D60 (2026-11-04): four video tracks
      ['VIDEO-04', 'CAM-04', 'IP camera IP-4'], // D60
    ]);
    // D61: rows by CHANNEL — the transcribed channel first, whatever order the slice carries.
    expect(micRows(swapped, DEFAULT_CAPTURE_DEVICES).map((row) => [row.inputId, row.channel])).toEqual([
      ['MIC-02', 'MIC-01'],
      ['MIC-01', 'MIC-02'],
      ['MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04'],
    ]);
  });

  it('PE-127-07: an adopted CAM-NN is an option; a microphone, the PoE switch and an unregistered id are not', () => {
    const options = cameraOptions(DEFAULT_CAPTURE_CONFIG, withAdopted);
    // D60 (2026-11-04): four built-in cameras are offered, then the adopted one.
    expect(options.map((option) => option.deviceId)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'CAM-07']);
    expect(options.map((option) => option.assignedTo)).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', null]);
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

describe('task 4 row 32 (D61: eight slots): one row per SLOT, and a command for an empty one (sites M1, M2; decision C18 (3))', () => {
  const [cam1, cam2, cam3, cam4] = DEFAULT_CAPTURE_CONFIG.cameras as [(typeof DEFAULT_CAPTURE_CONFIG.cameras)[number], (typeof DEFAULT_CAPTURE_CONFIG.cameras)[number], (typeof DEFAULT_CAPTURE_CONFIG.cameras)[number], (typeof DEFAULT_CAPTURE_CONFIG.cameras)[number]];
  const ch1Line = DEFAULT_CAPTURE_CONFIG.mics.find((mic) => mic.channel === 'MIC-01')!;
  const ch2Line = DEFAULT_CAPTURE_CONFIG.mics.find((mic) => mic.channel === 'MIC-02')!;
  const ch3Line = DEFAULT_CAPTURE_CONFIG.mics.find((mic) => mic.channel === 'MIC-03')!;
  const ch4Line = DEFAULT_CAPTURE_CONFIG.mics.find((mic) => mic.channel === 'MIC-04')!;

  interface SlotCase {
    readonly name: string;
    readonly cameras: (typeof DEFAULT_CAPTURE_CONFIG.cameras)[number][];
    readonly mics: (typeof DEFAULT_CAPTURE_CONFIG.mics)[number][];
    readonly cameraDevices: (string | null)[];
    readonly micInputs: (string | null)[];
  }
  const SLOT_CASES: SlotCase[] = [
    // D61 (2026-11-04): four camera slots and FOUR microphone slots - eight rows.
    { name: '0 camera lines, 0 microphone lines', cameras: [], mics: [], cameraDevices: [null, null, null, null], micInputs: [null, null, null, null] },
    { name: '1 camera line (VIDEO-01), 1 microphone line (channel 1)', cameras: [cam1], mics: [ch1Line], cameraDevices: ['CAM-01', null, null, null], micInputs: ['MIC-01', null, null, null] },
    { name: '1 camera line (VIDEO-02), 1 microphone line (channel 2)', cameras: [cam2], mics: [ch2Line], cameraDevices: [null, 'CAM-02', null, null], micInputs: [null, 'MIC-02', null, null] },
    { name: '4 camera lines, 4 microphone lines (the seeded selector)', cameras: [cam1, cam2, cam3, cam4], mics: [ch1Line, ch2Line, ch3Line, ch4Line], cameraDevices: ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'], micInputs: ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] },
    { name: '2 camera lines, 0 microphone lines', cameras: [cam2, cam1], mics: [], cameraDevices: ['CAM-01', 'CAM-02', null, null], micInputs: [null, null, null, null] },
    { name: '0 camera lines, 2 microphone lines (channels 2 and 1, out of order)', cameras: [], mics: [ch2Line, ch1Line], cameraDevices: [null, null, null, null], micInputs: ['MIC-01', 'MIC-02', null, null] },
  ];
  it.each(SLOT_CASES)('$name: eight rows, in the order of the slots', ({ cameras, mics, cameraDevices, micInputs }) => {
    const cameraResult = cameraRows({ cameras }, DEFAULT_CAPTURE_DEVICES);
    const micResult = micRows({ mics }, DEFAULT_CAPTURE_DEVICES);
    expect(cameraResult).toHaveLength(4);
    expect(micResult).toHaveLength(4); // D61: four microphone channels
    expect(cameraResult.map((row) => row.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04']);
    expect(micResult.map((row) => row.channel)).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
    expect(cameraResult.map((row) => row.deviceId)).toEqual(cameraDevices);
    expect(micResult.map((row) => row.inputId)).toEqual(micInputs);
    // The row of an empty slot states NOTHING of a device: no id, no model, no stream, no transport, not online.
    for (const row of cameraResult.filter(isEmptySlotRow)) expect(row).toEqual({ trackId: row.trackId, deviceId: null, model: null, online: false, streamState: null, sourceClass: null, adapter: null });
    for (const row of micResult.filter(isEmptySlotRow)) expect(row).toEqual({ inputId: null, deviceId: null, model: null, channel: row.channel, transport: null, online: false, sourceClass: null, adapter: null });
  });

  it('a lone line is found by its track or CHANNEL, never by its place: a lone VIDEO-02 is not row 1, a lone channel 2 line is not the channel 1 row (D61)', () => {
    expect(cameraRows({ cameras: [cam2] }, DEFAULT_CAPTURE_DEVICES)[0]).toMatchObject({ trackId: 'VIDEO-01', deviceId: null });
    expect(micRows({ mics: [ch2Line] }, DEFAULT_CAPTURE_DEVICES)[0]).toMatchObject({ channel: 'MIC-01', inputId: null });
  });

  it('M2 (D61): every channel is assignable ALONE - operation 78 answers ONE line by channel, whatever the other channels hold', () => {
    // No channel held: either channel is assignable alone (rule MIC-ASSIGN, C21 (8), generalized by D61).
    expect(micLineCommand('MIC-01', 'MIC-01', { mics: [] })).toEqual({ kind: 'micLine', channel: 'MIC-01', inputId: 'MIC-01' });
    expect(micLineCommand('MIC-02', 'MIC-02', { mics: [] })).toEqual({ kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' });
    // A channel HELD by another line: the pair replacement of D133 (1) is gone - the line assigns its channel alone.
    expect(micLineCommand('MIC-02', 'MIC-02', { mics: [{ inputId: 'MIC-01', channel: 'MIC-01' }] })).toEqual({ kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' });
    expect(micLineCommand('MIC-01', 'MIC-01', { mics: [{ inputId: 'MIC-02', channel: 'MIC-02' }] })).toEqual({ kind: 'micLine', channel: 'MIC-01', inputId: 'MIC-01' });
    // Replacing a held channel is one line by channel too.
    expect(micLineCommand('MIC-01', 'MIC-05', { mics: [{ inputId: 'MIC-01', channel: 'MIC-01' }] })).toEqual({ kind: 'micLine', channel: 'MIC-01', inputId: 'MIC-05' });
    // Nothing to send: the channel already holds it.
    expect(micLineCommand('MIC-01', 'MIC-01', { mics: [{ inputId: 'MIC-01', channel: 'MIC-01' }] })).toBeNull();
  });

  it('M3-07 (audit row 188; D126, D163 - inverts the R-FLEX row 133 pin): a microphone another channel holds is a SWAP when this channel holds one, a MOVE onto an empty channel', () => {
    const config = { mics: DEFAULT_CAPTURE_CONFIG.mics.map((mic) => ({ inputId: mic.inputId, channel: mic.channel })) };
    // A held target: the microphone this channel holds goes back to `from` (S1).
    expect(micLineCommand('MIC-01', 'MIC-02', config)).toEqual({ kind: 'micMove', from: 'MIC-02', channel: 'MIC-01', inputId: 'MIC-02', other: 'MIC-01' });
    expect(micLineCommand('MIC-03', 'MIC-01', config)).toEqual({ kind: 'micMove', from: 'MIC-01', channel: 'MIC-03', inputId: 'MIC-01', other: 'MIC-03' });
    expect(micLineCommand('MIC-04', 'MIC-04', config)).toBeNull();
    // An empty target: the MOVE (S2), no `other`.
    const noChannel3 = { mics: config.mics.filter((mic) => mic.channel !== 'MIC-03') };
    expect(micLineCommand('MIC-03', 'MIC-04', noChannel3)).toEqual({ kind: 'micMove', from: 'MIC-04', channel: 'MIC-03', inputId: 'MIC-04' });
    // An unheld device on an empty channel: a bare line, not a move.
    expect(micLineCommand('MIC-01', 'MIC-09', { mics: [] })).toEqual({ kind: 'micLine', channel: 'MIC-01', inputId: 'MIC-09' });
  });

  it('the options of an empty selector name no channel, and `micLine` goes to operation 78 with ONE line: `deviceId == inputId`, its channel, no transport', async () => {
    // D61: the built-in set is four microphones (nine built-ins).
    expect(micOptions({ mics: [] }, DEFAULT_CAPTURE_DEVICES).map((option) => option.channel)).toEqual([null, null, null, null]);
    const command = { kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' } as const;
    expect(selectorPath(command)).toBe('/api/v1/capture/config');
    expect(micLineBody(command)).toEqual({ mics: [{ channel: 'MIC-02', inputId: 'MIC-02', deviceId: 'MIC-02' }] });
    expect(isNoChange(command, { cameras: [], mics: [] })).toBe(false);
    expect(isNoChange(command, DEFAULT_CAPTURE_CONFIG)).toBe(true);
    expect(isNoChange({ kind: 'micLine', channel: 'MIC-01', inputId: 'MIC-02' }, DEFAULT_CAPTURE_CONFIG)).toBe(false);
    // The Live port: operation 78 with that body and nothing else.
    const calls: { operationId: string; input: unknown }[] = [];
    const client = {
      call: (operationId: string, input: unknown) => {
        calls.push({ operationId, input });
        return Promise.resolve({ ok: true, status: 200, data: { cameras: [], mics: [], locked: false, updatedAt: 9 } });
      },
    } as unknown as Parameters<typeof liveSelectorPort>[0];
    await expect(liveSelectorPort(client).send(command)).resolves.toMatchObject({ result: 'ok', updatedAt: 9 });
    expect(calls).toEqual([{ operationId: 'updateCaptureConfig', input: { body: { mics: [{ channel: 'MIC-02', inputId: 'MIC-02', deviceId: 'MIC-02' }] } } }]);
    // The simulated port sends the same body to the same path.
    const requests: unknown[] = [];
    const sim = { request: (request: unknown) => (requests.push(request), { status: 200, body: { updatedAt: 5 } }) } as unknown as Parameters<typeof simSelectorPort>[0];
    await expect(simSelectorPort(sim).send(command)).resolves.toMatchObject({ result: 'ok', updatedAt: 5 });
    expect(requests).toEqual([{ method: 'POST', path: '/api/v1/capture/config', body: { mics: [{ channel: 'MIC-02', inputId: 'MIC-02', deviceId: 'MIC-02' }] } }]);
  });

  it('M3-07 R1/R2 (audit row 188; D126, D163 - the D61/T-14 pin kept for the empty target only): `micMoveBody` is the SWAP S1 for a held target, the MOVE S2 for an empty one', () => {
    const swap = { kind: 'micMove', from: 'MIC-02', channel: 'MIC-01', inputId: 'MIC-02', other: 'MIC-01' } as const;
    expect(selectorPath(swap)).toBe('/api/v1/capture/config');
    const swapBody = micMoveBody(swap);
    expect(swapBody).toEqual({ mics: [{ channel: 'MIC-01', inputId: 'MIC-02', deviceId: 'MIC-02' }, { channel: 'MIC-02', inputId: 'MIC-01', deviceId: 'MIC-01' }] });
    expect(swapBody).not.toHaveProperty('unassign');
    const move = { kind: 'micMove', from: 'MIC-02', channel: 'MIC-01', inputId: 'MIC-02' } as const;
    expect(selectorPath(move)).toBe('/api/v1/capture/config');
    expect(micMoveBody(move)).toEqual({ unassign: ['MIC-02'], mics: [{ channel: 'MIC-01', inputId: 'MIC-02', deviceId: 'MIC-02' }] });
    expect(isNoChange(swap, DEFAULT_CAPTURE_CONFIG)).toBe(false);
    expect(isNoChange(move, DEFAULT_CAPTURE_CONFIG)).toBe(false);
    // What the confirm asks (S5/S6 for the swap, S8/S9 for the move): the pair numbers and the two microphones.
    expect(micMoveAskOf(swap)).toEqual({ kind: 'SWAP', from: 'MIC-02', to: 'MIC-01', fromPair: 2, toPair: 1, deviceId: 'MIC-02', other: 'MIC-01' });
    expect(micMoveAskOf(move)).toEqual({ kind: 'MOVE', from: 'MIC-02', to: 'MIC-01', fromPair: 2, toPair: 1, deviceId: 'MIC-02' });
  });

  it('M3-07 (audit row 188): operation 78 is sent ONCE after the confirm, with the SWAP body; nothing before it, nothing on Cancel', async () => {
    const liveClient = () => {
      const calls: { operationId: string; input: unknown }[] = [];
      const client = {
        call: (operationId: string, input: unknown) => {
          calls.push({ operationId, input });
          return Promise.resolve({ ok: true, status: 200, data: { cameras: [], mics: [], locked: false, updatedAt: 11 } });
        },
      } as unknown as Parameters<typeof liveSelectorPort>[0];
      const port = liveSelectorPort(client);
      return { calls, send: (command: Parameters<typeof port.send>[0]) => port.send(command) };
    };
    const swap = { kind: 'micMove', from: 'MIC-02', channel: 'MIC-01', inputId: 'MIC-02', other: 'MIC-01' } as const;
    // Confirm: nothing before it, ONE call with S1 after it; a second confirm sends nothing.
    const confirmed = liveClient();
    const gate = micMoveGate(swap);
    expect(gate.ask.kind).toBe('SWAP');
    expect(confirmed.calls).toHaveLength(0);
    await expect(gate.confirm(confirmed.send)).resolves.toMatchObject({ result: 'ok', updatedAt: 11 });
    await expect(gate.confirm(confirmed.send)).resolves.toBeNull();
    expect(confirmed.calls).toEqual([
      { operationId: 'updateCaptureConfig', input: { body: { mics: [{ channel: 'MIC-01', inputId: 'MIC-02', deviceId: 'MIC-02' }, { channel: 'MIC-02', inputId: 'MIC-01', deviceId: 'MIC-01' }] } } },
    ]);
    // Cancel: nothing - and a confirm pressed after the cancel sends nothing either.
    const cancelled = liveClient();
    const dropped = micMoveGate(swap);
    dropped.cancel();
    await expect(dropped.confirm(cancelled.send)).resolves.toBeNull();
    expect(cancelled.calls).toHaveLength(0);
    // The MOVE onto an empty pair passes the same confirm and sends S2 once.
    const moved = liveClient();
    const moveGate = micMoveGate({ kind: 'micMove', from: 'MIC-02', channel: 'MIC-01', inputId: 'MIC-02' });
    expect(moveGate.ask.kind).toBe('MOVE');
    await moveGate.confirm(moved.send);
    expect(moved.calls).toEqual([{ operationId: 'updateCaptureConfig', input: { body: { unassign: ['MIC-02'], mics: [{ channel: 'MIC-01', inputId: 'MIC-02', deviceId: 'MIC-02' }] } } }]);
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
  it('classifies every documented answer of ops 78 and 79 (D61)', () => {
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

  it('a command that changes nothing is recognised (D61: by channel)', () => {
    expect(isNoChange({ kind: 'micLine', channel: 'MIC-01', inputId: 'MIC-01' }, DEFAULT_CAPTURE_CONFIG)).toBe(true);
    expect(isNoChange({ kind: 'micLine', channel: 'MIC-01', inputId: 'MIC-02' }, DEFAULT_CAPTURE_CONFIG)).toBe(false);
    expect(isNoChange({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-01' }, DEFAULT_CAPTURE_CONFIG)).toBe(true);
    expect(isNoChange({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-02' }, DEFAULT_CAPTURE_CONFIG)).toBe(false);
  });
});

describe('the simulated port (ops 78, 79 of the in-app simulator; D61)', () => {
  it('the paths are the contract paths, ids encoded', () => {
    expect(selectorPath({ kind: 'camera', trackId: 'VIDEO-02', deviceId: 'CAM-01' })).toBe('/api/v1/capture/cameras/CAM-01/source');
    expect(selectorPath({ kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' })).toBe('/api/v1/capture/config'); // D61: every mic edit is operation 78
    expect(selectorPath({ kind: 'camera', trackId: 'VIDEO-01', deviceId: '../x' })).toBe('/api/v1/capture/cameras/..%2Fx/source');
  });

  it('the CAPTURE_CONFIG holder (TECHNICIAN since the 2026-10-29 revocation): a line by channel replaces ONLY that channel and writes its SOURCE row', async () => {
    const test = signedIn('rina.wijaya');
    const answer = await simSelectorPort(test.sim).send({ kind: 'micLine', channel: 'MIC-01', inputId: 'MIC-01' });
    expect(answer.result).toBe('ok');
    // The seeded channel 1 already holds MIC-01: the Core answers and changes nothing.
    expect(test.sim.store.getState().captureConfig.mics.map((mic) => [mic.inputId, mic.channel])).toEqual(expect.arrayContaining([['MIC-01', 'MIC-01'], ['MIC-02', 'MIC-02']]));
    // A real edit: channel 3 takes the input of channel 4 - the MOVE, ONE request, and the old channel is cleared.
    const moved = await simSelectorPort(test.sim).send({ kind: 'micMove', from: 'MIC-04', channel: 'MIC-03', inputId: 'MIC-04' });
    expect(moved.result).toBe('ok');
    const mics = test.sim.store.getState().captureConfig.mics;
    expect(mics.find((mic) => mic.channel === 'MIC-03')?.inputId).toBe('MIC-04');
    expect(mics.some((mic) => mic.channel === 'MIC-04')).toBe(false);
    expect(configAudit(test).length).toBeGreaterThan(0);
    expect(configAudit(test).at(-1)!.details).toMatchObject({ operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-03', to: 'MIC-04' });
  });

  it('M3-07 (audit row 188; D126): the SWAP against the simulator - channels 1 and 2 trade microphones in ONE request, ONE CHANNEL row, no channel left empty', async () => {
    const test = signedIn('rina.wijaya');
    const before = configAudit(test).length;
    const command = micLineCommand('MIC-01', 'MIC-02', { mics: test.sim.store.getState().captureConfig.mics.map((mic) => ({ inputId: mic.inputId, channel: mic.channel })) });
    expect(command).toEqual({ kind: 'micMove', from: 'MIC-02', channel: 'MIC-01', inputId: 'MIC-02', other: 'MIC-01' });
    const answer = await simSelectorPort(test.sim).send(command!);
    expect(answer.result).toBe('ok');
    const mics = test.sim.store.getState().captureConfig.mics;
    expect((['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const).map((channel) => mics.find((mic) => mic.channel === channel)?.inputId)).toEqual(['MIC-02', 'MIC-01', 'MIC-03', 'MIC-04']);
    const rows = configAudit(test).slice(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.details).toMatchObject({ operationId: 'updateCaptureConfig', scope: 'MIC', field: 'CHANNEL', inputId: 'MIC-02', from: 'MIC-02', to: 'MIC-01' });
  });

  it('TECHNICIAN: setCaptureCameraSource assigns the camera to the track, one audit row', async () => {
    const test = signedIn('rina.wijaya');
    // Row 138 fix: one camera on both tracks with one profile is refused since row 66 (422, OD-05), so the
    // legal edit is a camera added later; the refusal itself is the next assertion.
    test.sim.actions.registerCaptureDevice({ id: 'CAM-07', model: 'Test source', host: '127.0.0.1', adapter: 'FAKE' }); // D60/D61: CAM-03/CAM-04 are built-ins - mint above them
    const refused = await simSelectorPort(test.sim).send({ kind: 'camera', trackId: 'VIDEO-02', deviceId: 'CAM-01' });
    expect(refused.result).toBe('invalid');
    expect(configAudit(test)).toHaveLength(0);
    const answer = await simSelectorPort(test.sim).send({ kind: 'camera', trackId: 'VIDEO-02', deviceId: 'CAM-07' });
    expect(answer.result).toBe('ok');
    expect(test.sim.store.getState().captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-07');
    expect(configAudit(test)).toHaveLength(1);
    expect(configAudit(test)[0]!.details).toMatchObject({ operationId: 'setCaptureCameraSource', trackId: 'VIDEO-02', from: 'CAM-02', to: 'CAM-07' });
  });

  it('INVESTIGATOR is denied; an unknown or candidate id is not found; neither changes the selector nor writes a config row', async () => {
    const denied = signedIn('budi.santoso');
    const before = denied.sim.store.getState().captureConfig;
    expect((await simSelectorPort(denied.sim).send({ kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' })).result).toBe('denied');
    expect(denied.sim.store.getState().captureConfig).toBe(before);
    expect(configAudit(denied)).toHaveLength(0);

    const tech = signedIn('rina.wijaya');
    expect((await simSelectorPort(tech.sim).send({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAND-0001' })).result).toBe('notFound');
    // A microphone is not a camera source.
    expect((await simSelectorPort(tech.sim).send({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'MIC-01' })).result).toBe('notFound');
    expect(configAudit(tech)).toHaveLength(0);
  });

  it('OD-10: while a session is open the edit is refused as locked with NO audit row (R-1 AC-1; holder mounted)', async () => {
    const test = signedIn('rina.wijaya');
    test.sim.actions.loadScenario(ScenarioName.RECORDING);
    const before = test.sim.store.getState().captureConfig;
    const answer = await simSelectorPort(test.sim).send({ kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' });
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
    await expect(port.send({ kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' })).resolves.toMatchObject({ result: 'offline', updatedAt: null });
  });
});

describe("the Live port (the app's one typed client)", () => {
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

  it('sends operation 79 with the camera in the path and the track in the body; 78 with the line by channel (D61)', async () => {
    const ok = fakeClient({ ok: true, status: 200, data: { cameras: [], mics: [], locked: false, updatedAt: 77 } });
    const port = liveSelectorPort(ok.client);
    await expect(port.send({ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-07' })).resolves.toMatchObject({ result: 'ok', updatedAt: 77 });
    await expect(port.send({ kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' })).resolves.toMatchObject({ result: 'ok', updatedAt: 77 });
    expect(ok.calls).toEqual([
      { operationId: 'setCaptureCameraSource', input: { params: { id: 'CAM-07' }, body: { trackId: 'VIDEO-01' } } },
      { operationId: 'updateCaptureConfig', input: { body: { mics: [{ channel: 'MIC-02', inputId: 'MIC-02', deviceId: 'MIC-02' }] } } },
    ]);
  });

  it('maps a refusal by status, code and details.reason; a rejected call is offline', async () => {
    const refused = (status: number | null, code: string, details?: Record<string, unknown>) =>
      liveSelectorPort(fakeClient({ ok: false, status, kind: 'REFUSED', error: { code, message: 'm', ...(details ? { details } : {}) } }).client).send({ kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' });
    await expect(refused(409, 'CAPTURE_CONFIG_LOCKED')).resolves.toMatchObject({ result: 'locked', updatedAt: null });
    await expect(refused(403, 'NOT_PERMITTED')).resolves.toMatchObject({ result: 'denied' });
    await expect(refused(503, 'NOT_READY', { reason: 'CAPTURE_NOT_READY' })).resolves.toMatchObject({ result: 'notReady', facts: { reason: 'CAPTURE_NOT_READY' } });
    await expect(refused(null, 'NETWORK')).resolves.toMatchObject({ result: 'offline' });
    const throwing = { call: () => Promise.reject(new Error('socket')) } as unknown as Parameters<typeof liveSelectorPort>[0];
    await expect(liveSelectorPort(throwing).send({ kind: 'micLine', channel: 'MIC-02', inputId: 'MIC-02' })).resolves.toMatchObject({ result: 'offline' });
  });
});

// Task 4 row W6 (request lines 566, 569; decisions C141, C143): the Core states `streamState: null` for an idle registered
// camera. Before this row `cameraLineStatus` read it as LIVE. Seen RED on the mutation "the null branch removed" (back to LIVE).
describe('row W6: a line whose stream nobody reads is NOT_READ', () => {
  it('null is NOT_READ; LIVE and LOST stay; an offline line is OFFLINE first', () => {
    expect(cameraLineStatus({ online: true, streamState: null })).toBe('NOT_READ');
    expect(cameraLineStatus({ online: true, streamState: 'LIVE' })).toBe('LIVE');
    expect(cameraLineStatus({ online: true, streamState: 'LOST' })).toBe('LOST');
    expect(cameraLineStatus({ online: false, streamState: null })).toBe('OFFLINE');
  });
});
