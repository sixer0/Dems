// Fix wave H, gate 70 (decision D196) — the capture selector on the tablet and the phone.
//
// | Finding | Proven here |
// |---|---|
// | G70-02 | the sheet of the PRIMARY and of the STANDBY line offers EVERY registered microphone (MIC-03 too); a microphone on no line is put on a line by operation 78's pair replacement; the same microphone on both lines is refused in the sheet (the option disabled, with its reason); a refusal of the Core is drawn in place; the badge and the limit sentence of the Core Mac's microphone are on its option in real capture; lock and role keep the new control disabled |
// | G70-02 (cameras) | CONFIRMED: a registered camera (CAM-03) can be put on each video track from the tablet and the phone sheet |
// | G70-06 | INVESTIGATOR: the role sentence is drawn ONCE at the foot of Capture Sources |
// | M4-PC-1 | "Checking your permissions…" renders while no signed-in operator is in the store, and nothing is enabled |
//
// The REAL devices route files over a real test simulator (the simulator IS the Core here). Live mode
// is stood in for by its read member and a recorded `client.call` (as `registered-devices.test.tsx`).
// NOT proven here: a real Core and a device (re-gate M4-SEL-T / -P with MIC-03).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { renderDevicesApp, settle, type DevicesHarness } from '@/features/devices/testing/devices-harness';
import { CaptureSelector } from './capture-selector';

type Call = (operationId: string, input?: unknown) => Promise<unknown>;
/** What `useMobileLive()` answers: null = Simulated client mode; an object = Live. */
let mockLive: { client: { call: jest.MockedFunction<Call> } } | null = null;
jest.mock('@/runtime', () => {
  const actual = jest.requireActual<typeof import('@/runtime')>('@/runtime');
  return { ...actual, useMobileLive: () => mockLive };
});

beforeEach(() => {
  mockLive = null;
  resetMissingKeys();
});
afterEach(() => expect(getMissingKeys()).toEqual([]));

type Device = SimState['captureDevices']['devices'][number];
const device = (id: string, kind: Device['kind'], over: Partial<Device> = {}): Device => ({ id, kind, model: null, firmware: null, host: null, poePort: null, online: true, streamState: kind === 'CAMERA' ? 'LIVE' : null, capabilities: [], ...over });
const LOCAL_MIC = device('MIC-03', 'MIC', { model: 'MacBook Air Microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' });
const LOCAL_CAMERA = device('CAM-03', 'CAMERA', { model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' });
/** The Live stand-in: operation 78 gets the scripted answer; every other operation (the screen's own reads) is "not ready". */
const NOT_READY = { ok: false, status: 503, error: { code: 'NOT_READY' } };
function liveAnswering(answer: () => unknown): jest.MockedFunction<Call> {
  return jest.fn<Call>(async (operationId) => (operationId === 'updateCaptureConfig' ? answer() : NOT_READY));
}
const selectorCalls = (call: jest.MockedFunction<Call>) => call.mock.calls.filter(([operationId]) => operationId === 'updateCaptureConfig' || operationId === 'setPrimaryMic' || operationId === 'setCaptureCameraSource');
const WINDOWS = ['tabletLandscape', 'phonePortrait'] as const;
const LIMIT = 'Not fit for recording yet. Use it for development checks only.';
const ROLE_SENTENCE = 'Requires the Supervisor or Technician role';

/** The Core's registry also holds the Core Mac's microphone and camera, on no line (gate 70: "Not assigned"). */
function register(h: Pick<DevicesHarness, 'sim'>): void {
  act(() => h.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: [...s.captureDevices.devices, LOCAL_MIC, LOCAL_CAMERA] } })));
}
const mics = (h: Pick<DevicesHarness, 'sim'>) => Object.fromEntries(h.sim.store.getState().captureConfig.mics.map((line) => [line.role, line.inputId]));
const cameraOf = (h: Pick<DevicesHarness, 'sim'>, trackId: string) => h.sim.store.getState().captureConfig.cameras.find((line) => line.trackId === trackId)?.deviceId;
const configAudit = (h: Pick<DevicesHarness, 'sim'>) => h.sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');
const option = (id: string) => screen.getByTestId(`capture-source-option-${id}`);
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

async function openLine(inputId: string): Promise<void> {
  fireEvent.press(screen.getByTestId(`capture-selector-edit-${inputId}`));
  await settle();
}
async function chooseAndSave(id: string): Promise<void> {
  fireEvent.press(option(id));
  await settle();
  fireEvent.press(screen.getByTestId('capture-source-save'));
  await settle();
  await settle();
}

describe.each(WINDOWS)('G70-02 on %s: every registered microphone on both lines', (window) => {
  it('PRIMARY line: the sheet offers MIC-01, MIC-02 and MIC-03; MIC-03 saved becomes PRIMARY, the standby stays', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    register(h);
    await openLine('MIC-01');
    expect(screen.getByText('Primary microphone')).toBeTruthy();
    for (const id of ['MIC-01', 'MIC-02', 'MIC-03']) expect(option(id)).toBeTruthy();
    expect(option('MIC-01').props.accessibilityState).toMatchObject({ selected: true });
    await chooseAndSave('MIC-03');
    expect(mics(h)).toEqual({ PRIMARY: 'MIC-03', STANDBY: 'MIC-02' });
    expect(configAudit(h).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('capture-selector-role-MIC-03').props.accessibilityLabel).toBe('Primary');
    expect(screen.queryByTestId(/^capture-selector-notice-/)).toBeNull();
  });

  it('PRIMARY line: choosing the standby microphone still trades the two roles (operation 80, one audit row)', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    register(h);
    await openLine('MIC-01');
    await chooseAndSave('MIC-02');
    expect(mics(h)).toEqual({ PRIMARY: 'MIC-02', STANDBY: 'MIC-01' });
    expect(configAudit(h)).toHaveLength(1);
  });

  it('STANDBY line: its own sheet; MIC-03 saved becomes STANDBY, the primary stays', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    expect(screen.getByTestId('capture-selector-edit-MIC-02').props.accessibilityLabel).toBe('Change the standby microphone');
    await openLine('MIC-02');
    expect(screen.getByText('Standby microphone')).toBeTruthy();
    for (const id of ['MIC-01', 'MIC-02', 'MIC-03']) expect(option(id)).toBeTruthy();
    expect(option('MIC-02').props.accessibilityState).toMatchObject({ selected: true });
    await chooseAndSave('MIC-03');
    expect(mics(h)).toEqual({ PRIMARY: 'MIC-01', STANDBY: 'MIC-03' });
    expect(configAudit(h).length).toBeGreaterThanOrEqual(1);
  });

  it('STANDBY line: the primary microphone is refused there — the option is disabled with its reason, a press changes nothing', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    register(h);
    await openLine('MIC-02');
    expect(option('MIC-01').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('capture-source-refusal-MIC-01')).toHaveTextContent('This is the primary microphone. One microphone cannot be on both lines.');
    fireEvent.press(option('MIC-01'));
    await settle();
    expect(disabled('capture-source-save')).toBe(true);
    expect(screen.queryByTestId('capture-source-refusal-MIC-03')).toBeNull();
    expect(mics(h)).toEqual({ PRIMARY: 'MIC-01', STANDBY: 'MIC-02' });
    expect(configAudit(h)).toHaveLength(0);
  });

  it('lock and role keep the standby control as the others: INVESTIGATOR disabled with the role sentence; a session open disabled with the lock sentence', async () => {
    const first = renderDevicesApp({ user: 'budi.santoso', window });
    await settle();
    register(first);
    expect(disabled('capture-selector-edit-MIC-02')).toBe(true);
    expect(screen.getByTestId('capture-selector-edit-MIC-02').props.accessibilityHint).toBe(ROLE_SENTENCE);
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-02'));
    await settle();
    expect(screen.queryByTestId('capture-source-sheet')).toBeNull();
    first.app.unmount();

    renderDevicesApp({ user: 'andi.pratama', window, recording: true });
    await settle();
    expect(disabled('capture-selector-edit-MIC-02')).toBe(true);
    expect(screen.getByTestId('capture-selector-edit-MIC-02').props.accessibilityHint).toBe('The capture configuration cannot be changed while a session is open.');
  });

  it('real capture (Live): the option of the Core Mac\'s microphone carries the badge and the limit sentence; Save sends ONE operation 78 with the pair by role', async () => {
    const call = liveAnswering(() => ({ ok: true, status: 200, data: { updatedAt: 0 } }));
    mockLive = { client: { call } };
    const h = renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    register(h);
    await openLine('MIC-01');
    expect(within(screen.getByTestId('capture-source-badge-MIC-03')).getByText("Core Mac's microphone")).toBeTruthy();
    expect(screen.getByTestId('capture-source-limit-MIC-03')).toHaveTextContent(LIMIT);
    expect(screen.queryByTestId('capture-source-limit-MIC-02')).toBeNull();
    await chooseAndSave('MIC-03');
    expect(selectorCalls(call)).toEqual([
      ['updateCaptureConfig', { body: { mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' }, { inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' }] } }],
    ]);
  });

  it('a refusal of the Core is drawn as the contract words it: 422 DEVELOPMENT_SOURCE_NOT_ALLOWED, and 422 INVALID_INPUT', async () => {
    const answers = [
      { ok: false, status: 422, error: { code: 'INVALID_INPUT', details: { reason: 'DEVELOPMENT_SOURCE_NOT_ALLOWED' } } },
      { ok: false, status: 422, error: { code: 'INVALID_INPUT' } },
    ];
    const call = liveAnswering(() => answers.shift());
    mockLive = { client: { call } };
    const h = renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    register(h);
    await openLine('MIC-02');
    await chooseAndSave('MIC-03');
    expect(screen.getByTestId('capture-selector-notice-developmentOnly')).toHaveTextContent(/This source can only be used in the development configuration\./);
    await openLine('MIC-02');
    await chooseAndSave('MIC-03');
    expect(screen.getByTestId('capture-selector-notice-invalid')).toHaveTextContent(/The Core did not accept this choice\. Nothing was changed\./);
    expect(selectorCalls(call)).toHaveLength(2);
  });

  it('Simulated client mode: no badge and no limit sentence on any microphone option', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    register(h);
    await openLine('MIC-01');
    expect(option('MIC-03')).toBeTruthy();
    expect(screen.queryByTestId('capture-source-badge-MIC-03')).toBeNull();
    expect(screen.queryByText(LIMIT)).toBeNull();
  });
});

describe.each(WINDOWS)('G70-02 (cameras) on %s: a registered camera on each video track', (window) => {
  it.each(['VIDEO-01', 'VIDEO-02'] as const)('CAM-03 is offered for %s and saved there, one audit row', async (trackId) => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    await openLine(trackId);
    expect(option('CAM-03')).toBeTruthy();
    await chooseAndSave('CAM-03');
    expect(cameraOf(h, trackId)).toBe('CAM-03');
    expect(configAudit(h)).toHaveLength(1);
    expect(screen.queryByTestId(/^capture-selector-notice-/)).toBeNull();
  });
});

describe('G70-06: the role sentence at the foot of Capture Sources', () => {
  it.each(WINDOWS)('%s, INVESTIGATOR: drawn once (the gate line), not a second time under "Search again"', async (window) => {
    renderDevicesApp({ user: 'budi.santoso', window });
    await settle();
    const card = screen.getByTestId('capture-selector');
    expect(within(card).getAllByText(ROLE_SENTENCE)).toHaveLength(1);
    expect(screen.getByTestId('capture-selector-gate')).toHaveTextContent(ROLE_SENTENCE);
    // The control keeps its reason for a screen reader.
    expect(screen.getByTestId('capture-selector-mic-rescan-action').props.accessibilityHint).toBe(ROLE_SENTENCE);
    expect(disabled('capture-selector-mic-rescan-action')).toBe(true);
  });
});

describe('M4-PC-1: the role is not known yet', () => {
  it('no signed-in operator in the store: "Checking your permissions…", every control disabled, never the role sentence', async () => {
    // Held unresolved: a simulator nobody signed in to (Live mode before the first snapshot reads the same: no operator).
    const engine = createTestSim();
    renderWithRuntime(<CaptureSelector />, { sim: engine.sim });
    await flushAsync();
    await flushAsync();
    expect(screen.getByTestId('capture-selector-gate')).toHaveTextContent('Checking your permissions…');
    for (const id of ['VIDEO-01', 'VIDEO-02', 'MIC-01', 'MIC-02']) {
      expect(disabled(`capture-selector-edit-${id}`)).toBe(true);
      expect(screen.getByTestId(`capture-selector-edit-${id}`).props.accessibilityHint).toBe('Checking your permissions…');
    }
    expect(disabled('capture-selector-mic-rescan-action')).toBe(true);
    expect(screen.queryByText(ROLE_SENTENCE)).toBeNull();
  });
});
