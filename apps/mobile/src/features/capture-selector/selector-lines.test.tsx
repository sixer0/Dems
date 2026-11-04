// Fix wave H, gate 70 (decision D196) — the capture selector on the tablet and the phone.
//
// | Finding | Proven here |
// |---|---|
// | G70-02 | the sheet of EACH of the FOUR channels (D61, 2026-11-04) offers EVERY registered microphone (MIC-05 too); a microphone on no channel is put on a channel by operation 78's ONE line by channel; a microphone another channel holds is an ENABLED move option that says so (R-FLEX row 133), and its Save is ONE edit `{ unassign: [from], mics: [line] }`, so one microphone never stands on two channels; a refusal of the Core is drawn in place; the badge and the limit sentence of the Core Mac's microphone are on its option in real capture; lock and role keep the new control disabled |
// | G70-02 (cameras) | CONFIRMED: a registered camera (CAM-05, D60: CAM-03/CAM-04 are built-ins) can be put on each of the four video tracks from the tablet and the phone sheet |
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
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';
/** What `useMobileLive()` answers: null = Simulated client mode; an object = Live. */
type Call = (operationId: string, input?: unknown) => Promise<unknown>;
let mockLive: { client: { call: jest.MockedFunction<Call> } } | null = null;
jest.mock('@/runtime', () => {
  const actual = jest.requireActual<typeof import('@/runtime')>('@/runtime');
  return { ...actual, useMobileLive: () => mockLive };
});

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('every registered source on the lines of the selector', () => {
unmountBeforeTheHooksOfThisGroup();


beforeEach(() => {
  mockLive = null;
  resetMissingKeys();
});
afterEach(() => expect(getMissingKeys()).toEqual([]));

type Device = SimState['captureDevices']['devices'][number];
const device = (id: string, kind: Device['kind'], over: Partial<Device> = {}): Device => ({ id, kind, model: null, firmware: null, host: null, poePort: null, online: true, streamState: kind === 'CAMERA' ? 'LIVE' : null, capabilities: [], ...over });
const LOCAL_MIC = device('MIC-05', 'MIC', { model: 'MacBook Air Microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' }); // D61 (2026-11-04): MIC-03/MIC-04 are built-ins of the four-channel plane; an adopted microphone mints as MIC-05
const LOCAL_CAMERA = device('CAM-05', 'CAMERA', { model: 'MacBook Air Camera', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' }); // D60: CAM-03/CAM-04 are built-ins; an adopted camera mints as CAM-05
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
// D61 (2026-11-04): the lines are keyed by CHANNEL; the map reads channel -> input.
const mics = (h: Pick<DevicesHarness, 'sim'>) => Object.fromEntries(h.sim.store.getState().captureConfig.mics.map((line) => [line.channel, line.inputId]));
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

// D61 (2026-11-04): the selector plane is FOUR simultaneous channels MIC-01..MIC-04 - every microphone
// row is a CHANNEL row, operation 78 assigns a line by channel (the pair replacement of D133 (1) is
// superseded), and a microphone another channel holds is an ENABLED move option, never a refusal.
describe.each(WINDOWS)('G70-02 on %s: every registered microphone on each of the four channels (D61)', (window) => {
  it('channel 1 (transcribed): the sheet offers MIC-01..MIC-05; MIC-05 saved takes channel 1 alone, the other channels stay', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    await openLine('MIC-01');
    expect(screen.getByText('Microphone for channel 1')).toBeTruthy();
    for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'MIC-05']) expect(option(id)).toBeTruthy();
    expect(option('MIC-01').props.accessibilityState).toMatchObject({ selected: true });
    await chooseAndSave('MIC-05');
    // D61: a line assigns its channel ALONE - channels 2..4 keep what they hold.
    expect(mics(h)).toEqual({ 'MIC-01': 'MIC-05', 'MIC-02': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' });
    expect(configAudit(h).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('capture-selector-channel-MIC-05').props.accessibilityLabel).toBe('Channel 1 (transcribed)');
    expect(screen.queryByTestId(/^capture-selector-notice-/)).toBeNull();
  });

  it('channel 1: choosing the microphone of channel 2 MOVES it (one operation 78 edit, the old channel clears)', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    await openLine('MIC-01');
    // D61 (R-FLEX row 133 / T-14): the held option is ENABLED and says where it stands.
    expect(option('MIC-02').props.accessibilityState?.disabled).not.toBe(true);
    expect(screen.getByTestId('capture-source-warning-MIC-02')).toHaveTextContent('On channel 2. Choosing it moves the microphone here.');
    await chooseAndSave('MIC-02');
    // The microphone left channel 2 - the old channel is Not assigned, never traded (D61).
    expect(mics(h)).toEqual({ 'MIC-01': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' });
    expect(configAudit(h)).toHaveLength(2);
  });

  it('channel 2: its own sheet; MIC-05 saved becomes channel 2, the transcribed channel stays', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    expect(screen.getByTestId('capture-selector-edit-MIC-02').props.accessibilityLabel).toBe('Change the microphone on channel 2'); // D61: the standby label became the channel label
    await openLine('MIC-02');
    expect(screen.getByText('Microphone for channel 2')).toBeTruthy();
    for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'MIC-05']) expect(option(id)).toBeTruthy();
    expect(option('MIC-02').props.accessibilityState).toMatchObject({ selected: true });
    await chooseAndSave('MIC-05');
    expect(mics(h)).toEqual({ 'MIC-01': 'MIC-01', 'MIC-02': 'MIC-05', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' });
    expect(configAudit(h).length).toBeGreaterThanOrEqual(1);
  });

  it('channel 2: the microphone of channel 1 is an ENABLED move option there — a draft changes nothing until Save', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    await openLine('MIC-02');
    // D61 (2026-11-04): nothing is refused any more - a held microphone moves here.
    expect(option('MIC-01').props.accessibilityState?.disabled).not.toBe(true);
    expect(screen.getByTestId('capture-source-warning-MIC-01')).toHaveTextContent('On channel 1. Choosing it moves the microphone here.');
    fireEvent.press(option('MIC-01'));
    await settle();
    expect(disabled('capture-source-save')).toBe(false);
    expect(screen.queryByTestId('capture-source-warning-MIC-05')).toBeNull(); // an unheld microphone carries no move warning
    fireEvent.press(screen.getByTestId('capture-source-close'));
    await settle();
    expect(mics(h)).toEqual({ 'MIC-01': 'MIC-01', 'MIC-02': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' });
    expect(configAudit(h)).toHaveLength(0);
  });

  it('lock and role keep the channel-2 control as the others: INVESTIGATOR disabled with the role sentence; a session open disabled with the lock sentence', async () => {
    const first = renderDevicesApp({ user: 'budi.santoso', window });
    await settle();
    register(first);
    expect(disabled('capture-selector-edit-MIC-02')).toBe(true);
    expect(screen.getByTestId('capture-selector-edit-MIC-02').props.accessibilityHint).toBe(ROLE_SENTENCE);
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-02'));
    await settle();
    expect(screen.queryByTestId('capture-source-sheet')).toBeNull();
    first.app.unmount();

    renderDevicesApp({ user: 'rina.wijaya', window, recording: true });
    await settle();
    expect(disabled('capture-selector-edit-MIC-02')).toBe(true);
    expect(screen.getByTestId('capture-selector-edit-MIC-02').props.accessibilityHint).toBe('The capture configuration cannot be changed while a session is open.');
  });

  it('real capture (Live): the option of the Core Mac\'s microphone carries the badge and the limit sentence; Save sends ONE operation 78 with the line by channel', async () => {
    const call = liveAnswering(() => ({ ok: true, status: 200, data: { updatedAt: 0 } }));
    mockLive = { client: { call } };
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    await openLine('MIC-01');
    expect(within(screen.getByTestId('capture-source-badge-MIC-05')).getByText("Core Mac's microphone")).toBeTruthy();
    expect(screen.getByTestId('capture-source-limit-MIC-05')).toHaveTextContent(LIMIT);
    expect(screen.queryByTestId('capture-source-limit-MIC-02')).toBeNull();
    await chooseAndSave('MIC-05');
    // D61 (2026-11-04): ONE line by channel - the slots the change does not name keep what they hold.
    expect(selectorCalls(call)).toEqual([
      ['updateCaptureConfig', { body: { mics: [{ channel: 'MIC-01', inputId: 'MIC-05', deviceId: 'MIC-05' }] } }],
    ]);
  });

  it('a refusal of the Core is drawn as the contract words it: 422 DEVELOPMENT_SOURCE_NOT_ALLOWED, and 422 INVALID_INPUT', async () => {
    const answers = [
      { ok: false, status: 422, error: { code: 'INVALID_INPUT', details: { reason: 'DEVELOPMENT_SOURCE_NOT_ALLOWED' } } },
      { ok: false, status: 422, error: { code: 'INVALID_INPUT' } },
    ];
    const call = liveAnswering(() => answers.shift());
    mockLive = { client: { call } };
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    await openLine('MIC-02');
    await chooseAndSave('MIC-05');
    expect(screen.getByTestId('capture-selector-notice-developmentOnly')).toHaveTextContent(/This source can only be used in the development configuration\./);
    await openLine('MIC-02');
    await chooseAndSave('MIC-05');
    expect(screen.getByTestId('capture-selector-notice-invalid')).toHaveTextContent(/The Core did not accept this choice\. Nothing was changed\./);
    expect(selectorCalls(call)).toHaveLength(2);
    expect(mics(h)).toEqual({ 'MIC-01': 'MIC-01', 'MIC-02': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' }); // D61: a refusal changes nothing on any of the four channels
  });

  it('Simulated client mode: no badge and no limit sentence on any microphone option', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    await openLine('MIC-01');
    expect(option('MIC-05')).toBeTruthy();
    expect(screen.queryByTestId('capture-source-badge-MIC-05')).toBeNull();
    expect(screen.queryByText(LIMIT)).toBeNull();
  });
});

describe.each(WINDOWS)('G70-02 (cameras) on %s: a registered camera on each video track', (window) => {
  // D60 (2026-11-04): FOUR video tracks - every track holds a row.
  it.each(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const)('CAM-05 is offered for %s and saved there, one audit row', async (trackId) => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    register(h);
    await openLine(trackId);
    expect(option('CAM-05')).toBeTruthy();
    await chooseAndSave('CAM-05');
    expect(cameraOf(h, trackId)).toBe('CAM-05');
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
    // D61 (2026-11-04): eight selector slots - four camera tracks and four microphone channels.
    for (const id of ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) {
      expect(disabled(`capture-selector-edit-${id}`)).toBe(true);
      expect(screen.getByTestId(`capture-selector-edit-${id}`).props.accessibilityHint).toBe('Checking your permissions…');
    }
    expect(disabled('capture-selector-mic-rescan-action')).toBe(true);
    expect(screen.queryByText(ROLE_SENTENCE)).toBeNull();
  });
});

// Task 4 row W5 (review 060d finding Q-02; decisions C36, C111): a PRODUCTION camera is assigned from the tablet with
// one of its stored stream profiles. The double: the app's own store with a registered `ONVIF_RTSP` camera whose device
// entry carries the list (the member `profiles`; the contract does not carry it yet - see `camera-profile.ts`), and the
// Live stand-in of this file. Seen RED on the mutation "the port sends operation 79 for a command with a profile".
describe('row W5 (Q-02): a production camera is assigned with one of its stored profiles (tabletLandscape)', () => {
  // Row V7: the member in the contract's shape, `{ code, codec, resolution, fps }`.
  const ADOPTED = {
    ...device('CAM-07', 'CAMERA', { model: 'Adopted camera', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' }),
    profiles: [
      { code: 'HEVC_2560X1920P20', codec: 'HEVC', resolution: '2560x1920', fps: 20 },
      { code: 'H264_720P30', codec: 'H.264', resolution: '720p', fps: 30 },
    ],
  } as Device;

  it('the sheet offers the two profiles, Save is ONE operation 78 with the chosen one; a refused profile reads the Core\'s sentence', async () => {
    const answers: unknown[] = [
      { ok: false, status: 422, error: { code: 'INVALID_INPUT', details: { reason: 'CAMERA_PROFILE_NOT_OF_DEVICE', deviceId: 'CAM-07', trackId: 'VIDEO-01' } } },
      { ok: true, status: 200, data: { updatedAt: 0 } },
    ];
    const call = liveAnswering(() => answers.shift());
    mockLive = { client: { call } };
    const h = renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape' });
    await settle();
    register(h);
    act(() => h.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: [...s.captureDevices.devices, ADOPTED] } })));
    await settle();
    await openLine('VIDEO-01');
    fireEvent.press(option('CAM-07'));
    await settle();
    expect(screen.getByTestId('capture-source-profile-hint')).toHaveTextContent('This camera has 2 stored stream profiles. Choose the one this track records, then save.');
    // Nothing is sent without a chosen profile.
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    expect(selectorCalls(call)).toHaveLength(0);
    fireEvent.press(screen.getByTestId('capture-source-profile-H264_720P30'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    await settle();
    expect(selectorCalls(call)).toEqual([['updateCaptureConfig', { body: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-07', profile: 'H264_720P30' }] } }]]);
    // The refusal: the shared sentence of the Core's word, not the word in lower case.
    expect(screen.getByTestId('capture-selector-notice-invalid')).toHaveTextContent(
      /This camera was not assigned: the chosen stream profile is not one of the profiles stored for this camera\. Choose one of them, then assign it again\./,
    );
    expect(screen.getByTestId('capture-selector-notice-invalid')).not.toHaveTextContent(/camera profile not of device/);
    expect(cameraOf(h, 'VIDEO-01')).toBe('CAM-01');
  });

  // Row W6 (request line 565; row V7c, decision C130): the third profile refusal reads ITS shared sentence, which names
  // adoption - a connection test does not repair it. Seen RED on the mutation "the word left out of `PROFILE_REFUSAL_REASONS`"
  // (the notice read "camera profile without stream").
  it('row W6: CAMERA_PROFILE_WITHOUT_STREAM reads the shared sentence, not the word in lower case', async () => {
    const answers: unknown[] = [{ ok: false, status: 422, error: { code: 'INVALID_INPUT', details: { reason: 'CAMERA_PROFILE_WITHOUT_STREAM', deviceId: 'CAM-07', trackId: 'VIDEO-01' } } }];
    const call = liveAnswering(() => answers.shift());
    mockLive = { client: { call } };
    const h = renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape' });
    await settle();
    register(h);
    act(() => h.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: [...s.captureDevices.devices, ADOPTED] } })));
    await settle();
    await openLine('VIDEO-01');
    fireEvent.press(option('CAM-07'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-profile-H264_720P30'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    await settle();
    expect(selectorCalls(call)).toHaveLength(1);
    expect(screen.getByTestId('capture-selector-notice-invalid')).toHaveTextContent(
      /This camera was not assigned: the Core holds no stream facts for this profile, so the camera cannot record it\. A connection test does not repair this\. Adopt the camera again, then assign one of the profiles it states\./,
    );
    expect(screen.getByTestId('capture-selector-notice-invalid')).not.toHaveTextContent(/camera profile without stream/);
    expect(cameraOf(h, 'VIDEO-01')).toBe('CAM-01');
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-i-c-row-labels.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave I, driver C - re-gate 70 finding G70b-03 (accessibility; ux §14.3).
//
// SEEN ON THE TABLET: after a Save in the microphone sheet both microphone rows of Capture Sources
// read only "busy" to accessibility, and stayed so (uiautomator: `capture-selector-row-MIC-01`
// `content-desc="busy"`; before the save "MIC-01, USB condenser microphone UM-1 - USB").
//
// CAUSE (`capture-selector.tsx`, the row's `ListGroup.Item`): the row stated `accessibilityState.busy`
// and had NO `accessibilityLabel`. React Native's Android view builds the content description from
// the label + the state words (`BaseViewManager.updateViewContentDescription`) and does NOT write it
// when the list is empty - so with no label the description became "busy" while the save was out and
// was never rewritten when `busy` went back to false. Both microphone rows share one pending key
// (`MIC`), which is why both were hit; a camera row had the same defect after a camera save.
//
// What jest can hold (the native rewrite itself is the device's): every row carries its own label
// with its name, its detail and its state word at all times, and `busy` is true ONLY while the
// command is out or its answer is not republished yet. Written RED: the label was `undefined`.
describe('row labels and the stream word of a line', () => {
unmountBeforeTheHooksOfThisGroup();

beforeEach(() => {
  mockLive = null;
  resetMissingKeys();
});
afterEach(() => expect(getMissingKeys()).toEqual([]));

type Mark = Record<string, unknown>;
/** What a Core in real capture sends on its capture devices (`sourceClass`). */
function markRealCapture(h: { sim: { store: { setState(update: (s: SimState) => Partial<SimState>): void } } }, marks: Readonly<Record<string, Mark>> = {}): void {
  act(() =>
    h.sim.store.setState((s) => ({
      captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => ({ ...device, sourceClass: 'DEVELOPMENT', adapter: 'FAKE', ...(marks[device.id] ?? {}) }) as typeof device) },
    })),
  );
}
const row = (key: string) => screen.getByTestId(`capture-selector-row-${key}`);
const label = (key: string): unknown => row(key).props.accessibilityLabel;
const busy = (key: string): unknown => row(key).props.accessibilityState?.busy;
// D61 (2026-11-04): eight selector slots - four camera tracks and four microphone channels.
const ROWS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;

describe.each(['tabletLandscape', 'phonePortrait'] as const)('G70b-03 on %s: a selector row keeps its own accessibility label', (window) => {
  it('before any save: each row is labelled with its name, its device and its state; none is busy', async () => {
    renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    expect(label('VIDEO-01')).toMatch(/^Video track 1, CAM-01.*, Live$/);
    expect(label('VIDEO-02')).toMatch(/^Video track 2, CAM-02.*, Live$/);
    // D61 (2026-11-04): the rows are CHANNELS - channel 1 carries the transcribed word.
    expect(label('MIC-01')).toMatch(/^MIC-01, .+, Channel 1 \(transcribed\)$/);
    expect(label('MIC-02')).toMatch(/^MIC-02, .+, Channel 2$/);
    expect(label('MIC-03')).toMatch(/^MIC-03, .+, Channel 3$/);
    expect(label('MIC-04')).toMatch(/^MIC-04, .+, Channel 4$/);
    for (const key of ROWS) expect(busy(key)).toBe(false);
  });

  it('after a Save in the microphone sheet: the microphone rows still carry name and state, and are not busy', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    // The group below holds its own harness (moved here by D233); the registry gain is stated inline (D61: MIC-05 mints above the four built-ins).
    act(() => h.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: [...s.captureDevices.devices, { id: 'MIC-05', kind: 'MIC', model: 'MacBook Air Microphone', firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: [], adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' } as typeof s.captureDevices.devices[number]] } })));
    await settle();
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-01'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-option-MIC-05')); // D61: an unheld microphone takes the channel alone
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    await settle();
    // D61 (2026-11-04): the line assigns channel 1 alone - the other channels keep their inputs.
    expect(Object.fromEntries(h.sim.store.getState().captureConfig.mics.map((line) => [line.channel, line.inputId]))).toEqual({ 'MIC-01': 'MIC-05', 'MIC-02': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' });
    expect(label('MIC-05')).toMatch(/^MIC-05, .+, Channel 1 \(transcribed\)$/);
    expect(label('MIC-02')).toMatch(/^MIC-02, .+, Channel 2$/);
    for (const key of ROWS) {
      if (key === 'MIC-01') continue; // the input left the selector - its row is gone (D61)
      expect(typeof label(key)).toBe('string');
      expect(label(key)).not.toMatch(/busy/i);
      expect(busy(key)).toBe(false);
    }
  });

  it('`busy` is stated only while the request is in flight - and the label then says "Saving…", with the name still first', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const call = jest.fn<Call>((operationId) =>
      operationId === 'updateCaptureConfig'
        ? new Promise((resolve) => {
            answer = resolve;
          })
        : Promise.resolve({ ok: false, status: 503, error: { code: 'NOT_READY' } }),
    );
    renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    mockLive = { client: { call } };
    act(() => undefined);
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-01'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-option-MIC-02')); // D61: a held microphone is a move option
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    // In flight: ALL FOUR microphone rows share one pending key (D61: the plane has four channels); the camera rows are not.
    for (const [key, word] of [['MIC-01', 'Channel 1 \\(transcribed\\)'], ['MIC-02', 'Channel 2'], ['MIC-03', 'Channel 3'], ['MIC-04', 'Channel 4']] as const) {
      expect(busy(key)).toBe(true);
      expect(label(key)).toMatch(new RegExp(`^${key}, Saving…, ${word}$`));
    }
    for (const key of ['VIDEO-01', 'VIDEO-02']) expect(busy(key)).toBe(false);
    // The Core refuses (nothing to republish): the request is over, so no row is busy any more.
    await act(async () => {
      answer({ ok: false, status: 409, error: { code: 'CAPTURE_CONFIG_LOCKED' } });
      await Promise.resolve();
    });
    await settle();
    for (const key of ROWS) {
      expect(busy(key)).toBe(false);
      expect(label(key)).toMatch(new RegExp(`^${key.startsWith('VIDEO') ? `Video track ${key.slice(-1)}` : key}, `));
      expect(label(key)).not.toMatch(/Saving/);
    }
  });
});

describe('G70b-06 (contract note A2 §4): a camera line of a Core in REAL capture says "Live" only while a session records', () => {
  const NOT_READY = { ok: false, status: 503, error: { code: 'NOT_READY' } };
  const chip = (track: string): unknown => screen.getByTestId(`capture-selector-stream-${track}`).props.accessibilityLabel;

  it('idle Core: "Reachable" / "Not reachable" / "Not checked" from what the Core reported - never "Live"', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape' });
    await settle();
    mockLive = { client: { call: jest.fn<Call>(async () => NOT_READY) } };
    markRealCapture(h, { 'CAM-02': { online: false } });
    await settle();
    // Fix wave L (controller ruling on G70c-02): a source at rest of which the Core states no checked fact reads "Not checked" - never "Reachable" / "Ready".
    expect(chip('VIDEO-01')).toBe('Not checked');
    expect(chip('VIDEO-02')).toBe('Not reachable');
    expect(label('VIDEO-01')).toMatch(/^Video track 1, CAM-01.*, Not checked$/);
    expect(screen.queryByText('Live')).toBeNull();
    // The Core says it has not read the device since it started (the planned `checkedAt` member).
    markRealCapture(h, { 'CAM-01': { checkedAt: null } });
    await settle();
    expect(chip('VIDEO-01')).toBe('Not checked');
  });

  it('while a session of the Core is RECORDING: the stream word, as before', async () => {
    const h = renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape', recording: true });
    await settle();
    mockLive = { client: { call: jest.fn<Call>(async () => NOT_READY) } };
    markRealCapture(h);
    await settle();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
    expect(chip('VIDEO-01')).toBe('Live');
  });

  it('CONTROL - the in-app simulator and a Core in SIMULATED capture keep "Live" on an idle line', async () => {
    renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape' });
    await settle();
    expect(chip('VIDEO-01')).toBe('Live');
    mockLive = { client: { call: jest.fn<Call>(async () => NOT_READY) } };
    act(() => undefined);
    await settle();
    expect(chip('VIDEO-01')).toBe('Live');
  });
});
});
