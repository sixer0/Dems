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
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen } from '@testing-library/react-native';
import type { SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderDevicesApp, settle } from '@/features/devices/testing/devices-harness';

type Call = (operationId: string, input?: unknown) => Promise<unknown>;
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
const ROWS = ['VIDEO-01', 'VIDEO-02', 'MIC-01', 'MIC-02'] as const;

describe.each(['tabletLandscape', 'phonePortrait'] as const)('G70b-03 on %s: a selector row keeps its own accessibility label', (window) => {
  it('before any save: each row is labelled with its name, its device and its state; none is busy', async () => {
    renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    expect(label('VIDEO-01')).toMatch(/^Video track 1, CAM-01.*, Live$/);
    expect(label('VIDEO-02')).toMatch(/^Video track 2, CAM-02.*, Live$/);
    expect(label('MIC-01')).toMatch(/^MIC-01, .+, Primary$/);
    expect(label('MIC-02')).toMatch(/^MIC-02, .+, Standby$/);
    for (const key of ROWS) expect(busy(key)).toBe(false);
  });

  it('after a Save in the microphone sheet: both microphone rows still carry name and state, and are not busy', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-01'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-option-MIC-02'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    await settle();
    // The roles were traded by the Core (the simulator): the labels follow the rows, never "busy" alone.
    expect(Object.fromEntries(h.sim.store.getState().captureConfig.mics.map((line) => [line.role, line.inputId]))).toEqual({ PRIMARY: 'MIC-02', STANDBY: 'MIC-01' });
    expect(label('MIC-02')).toMatch(/^MIC-02, .+, Primary$/);
    expect(label('MIC-01')).toMatch(/^MIC-01, .+, Standby$/);
    for (const key of ROWS) {
      expect(typeof label(key)).toBe('string');
      expect(label(key)).not.toMatch(/busy/i);
      expect(busy(key)).toBe(false);
    }
  });

  it('`busy` is stated only while the request is in flight - and the label then says "Saving…", with the name still first', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const call = jest.fn<Call>((operationId) =>
      operationId === 'setPrimaryMic' || operationId === 'updateCaptureConfig'
        ? new Promise((resolve) => {
            answer = resolve;
          })
        : Promise.resolve({ ok: false, status: 503, error: { code: 'NOT_READY' } }),
    );
    renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    mockLive = { client: { call } };
    act(() => undefined);
    fireEvent.press(screen.getByTestId('capture-selector-edit-MIC-01'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-option-MIC-02'));
    await settle();
    fireEvent.press(screen.getByTestId('capture-source-save'));
    await settle();
    // In flight: both microphone rows (one field) are busy and say so in words; the camera rows are not.
    for (const key of ['MIC-01', 'MIC-02']) {
      expect(busy(key)).toBe(true);
      expect(label(key)).toMatch(new RegExp(`^${key}, Saving…, (Primary|Standby)$`));
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
      expect(label(key)).toMatch(new RegExp(`^${key === 'VIDEO-01' ? 'Video track 1' : key === 'VIDEO-02' ? 'Video track 2' : key}, `));
      expect(label(key)).not.toMatch(/Saving/);
    }
  });
});

describe('G70b-06 (contract note A2 §4): a camera line of a Core in REAL capture says "Live" only while a session records', () => {
  const NOT_READY = { ok: false, status: 503, error: { code: 'NOT_READY' } };
  const chip = (track: string): unknown => screen.getByTestId(`capture-selector-stream-${track}`).props.accessibilityLabel;

  it('idle Core: "Reachable" / "Not reachable" / "Not checked" from what the Core reported - never "Live"', async () => {
    const h = renderDevicesApp({ user: 'andi.pratama', window: 'tabletLandscape' });
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
    const h = renderDevicesApp({ user: 'andi.pratama', window: 'tabletLandscape', recording: true });
    await settle();
    mockLive = { client: { call: jest.fn<Call>(async () => NOT_READY) } };
    markRealCapture(h);
    await settle();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
    expect(chip('VIDEO-01')).toBe('Live');
  });

  it('CONTROL - the in-app simulator and a Core in SIMULATED capture keep "Live" on an idle line', async () => {
    renderDevicesApp({ user: 'andi.pratama', window: 'tabletLandscape' });
    await settle();
    expect(chip('VIDEO-01')).toBe('Live');
    mockLive = { client: { call: jest.fn<Call>(async () => NOT_READY) } };
    act(() => undefined);
    await settle();
    expect(chip('VIDEO-01')).toBe('Live');
  });
});
