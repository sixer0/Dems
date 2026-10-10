// Fix wave H — gate 70 finding G70-03, gate 75 finding G75-13 (ruling D196): on a Core in REAL capture
// no bundled demo picture stands where a camera picture would be. Devices & Inputs on the tablet and
// the phone: the row thumbnails and the detail's picture, plus the one rule and the tile's words.
//
// The REAL devices route files over a real test simulator whose `captureDevices` slice holds what a
// Core in real capture sends (`sourceClass`). Live mode is stood in for by its read member (as
// `registered-devices.test.tsx`). The caption `CAM-01 | VIDEO-01 | LIVE | DEMO` is INSIDE the bundled
// pictures, so "no caption" is proven by "no bundled picture is drawn" plus "no such text on screen".
// NOT proven here: a device and a real Core (re-gate).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, screen, within } from '@testing-library/react-native';
import type { SimState } from '@dems/shared/sim';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { noPreviewFactsOf, noPreviewWords, previewTrackOf, realCaptureView } from './camera-preview';
import { renderDevicesApp, settle, type DevicesHarness } from './testing/devices-harness';

/** What `useMobileLive()` answers: null = Simulated client mode; an object = Live. */
let mockLive: { client: { call: () => Promise<unknown> } } | null = null;
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
type Mark = Partial<Pick<Device, 'sourceClass' | 'adapter' | 'sourceOpen' | 'online'>>;
const FAKE: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' };
const LOCAL: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' };
const PRODUCTION: Mark = { sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' };
const WINDOWS = ['tabletLandscape', 'phonePortrait'] as const;
const NO_PREVIEW_LABEL = /No preview: this build shows no live picture/;

function mark(h: Pick<DevicesHarness, 'sim'>, marks: Readonly<Record<string, Mark>>): void {
  act(() => h.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => ({ ...device, ...(marks[device.id] ?? {}) })) } })));
}
const live = () => {
  mockLive = { client: { call: async () => ({ ok: false, status: 503, error: { code: 'NOT_READY' } }) } };
};
const ROWS = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'] as const;
/** The rows whose thumbnail is a picture (the image element carries a `source`; the neutral thumb is a plain view without one). */
const bundledPictures = () => ROWS.filter((id) => screen.getByTestId(`device-thumb-${id}`).props.source !== undefined).length;
/** LIVE / DEMO written on a row of the device list or on the detail's picture (the Core link chip of the header is another matter). */
const captions = () => [...screen.queryAllByTestId(/^device-row-/), ...screen.queryAllByTestId('device-detail-feed')].flatMap((node) => within(node).queryAllByText(/\b(LIVE|DEMO)\b/)).length;

describe('realCaptureView: the one rule', () => {
  it('Simulated client mode: never (the demo pictures are the simulator\'s)', () => {
    expect(realCaptureView([{ sourceClass: 'DEVELOPMENT' }], false)).toBe(false);
    expect(realCaptureView([], false)).toBe(false);
  });
  it('Live, a Core in SIMULATED capture (no device carries a class): the demo pictures stay', () => {
    expect(realCaptureView([{}, { sourceClass: undefined }, { sourceClass: null }], true)).toBe(false);
  });
  it.each(['DEVELOPMENT', 'PRODUCTION'])('Live, the Core sent `sourceClass: %s` on a device (REAL capture): no demo picture', (sourceClass) => {
    expect(realCaptureView([{}, { sourceClass }], true)).toBe(true);
  });
  it('Live, no device list yet: no demo picture either', () => {
    expect(realCaptureView([], true)).toBe(true);
  });
  it('the track of a tile', () => {
    expect(['CAM-1', 'CAM-2', 'VIDEO-01', 'VIDEO-02', 'CAM-02'].map(previewTrackOf)).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-01', 'VIDEO-02', 'VIDEO-02']);
  });
});

describe('the words of the tile: the device and its TRUE state, as the Core sent them', () => {
  const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;
  const stateWith = (marks: Readonly<Record<string, Mark>>, cameraOfTrack1 = 'CAM-01') => {
    const h = renderDevicesApp();
    mark(h, marks);
    const state = h.sim.store.getState();
    h.app.unmount();
    return { ...state, captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: cameraOfTrack1 } : line)) } };
  };
  it('the Core Mac\'s camera, not open: named so, "Ready" - never "on"', () => {
    expect(noPreviewWords(t, noPreviewFactsOf(stateWith({ 'CAM-01': LOCAL }), 'VIDEO-01'), true)).toEqual({ device: "Core Mac's camera", state: 'Ready' });
  });
  it('the Core Mac\'s camera with `sourceOpen: true`: "On"; a test source that is open is not "on" (the rule of the badge)', () => {
    expect(noPreviewWords(t, noPreviewFactsOf(stateWith({ 'CAM-01': { ...LOCAL, sourceOpen: true } }), 'VIDEO-01'), true).state).toBe('On');
    expect(noPreviewWords(t, noPreviewFactsOf(stateWith({ 'CAM-01': { ...FAKE, sourceOpen: true } }), 'VIDEO-01'), true).state).toBe('Reachable');
  });
  it('a test source and a production camera: "Camera CAM-01", "Reachable" / "Not reachable"', () => {
    expect(noPreviewWords(t, noPreviewFactsOf(stateWith({ 'CAM-01': FAKE }), 'VIDEO-01'), true)).toEqual({ device: 'Camera CAM-01', state: 'Reachable' });
    expect(noPreviewWords(t, noPreviewFactsOf(stateWith({ 'CAM-01': { ...PRODUCTION, online: false } }), 'VIDEO-01'), true)).toEqual({ device: 'Camera CAM-01', state: 'Not reachable' });
  });
  it('a track whose device the list does not hold: no device name, "State not known"', () => {
    expect(noPreviewWords(t, noPreviewFactsOf(stateWith({}, 'CAM-09'), 'VIDEO-01'), true)).toEqual({ device: null, state: 'State not known' });
  });
});

describe.each(WINDOWS)('Devices & Inputs on %s', (window) => {
  it('REAL capture: no bundled picture and no LIVE / DEMO text on the list; each camera and microphone row has the neutral thumb whose label says there is no live preview', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window });
    mark(h, { 'CAM-01': LOCAL, 'CAM-02': FAKE, 'MIC-01': FAKE, 'MIC-02': FAKE });
    await settle();
    expect(bundledPictures()).toBe(0);
    expect(captions()).toBe(0);
    for (const id of ROWS) {
      expect(screen.getByTestId(`device-thumb-${id}`).props.accessibilityLabel).toMatch(NO_PREVIEW_LABEL);
    }
  });

  it('REAL capture, the camera detail: the "No preview" tile with the name and the true state; the accessibility label says the build has no live preview', async () => {
    live();
    const h = renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-01' });
    mark(h, { 'CAM-01': LOCAL, 'CAM-02': FAKE, 'MIC-01': FAKE, 'MIC-02': FAKE });
    await settle();
    const tile = screen.getByTestId('device-detail-feed');
    expect(screen.getByTestId('device-detail-feed-none')).toHaveTextContent('No preview');
    expect(screen.getByTestId('device-detail-feed-name')).toHaveTextContent(/Core Mac's camera/);
    expect(screen.getByTestId('device-detail-feed-state')).toHaveTextContent('Ready');
    expect(tile.props.accessibilityRole).toBe('text');
    expect(tile.props.accessibilityLabel).toMatch(NO_PREVIEW_LABEL);
    expect(tile.props.accessibilityLabel).toMatch(/Core Mac's camera, Ready\./);
    expect(screen.queryByTestId('device-detail-feed-video')).toBeNull();
    expect(captions()).toBe(0);

    mark(h, { 'CAM-01': { ...LOCAL, sourceOpen: true } });
    await settle();
    expect(screen.getByTestId('device-detail-feed-state')).toHaveTextContent('On');
  });

  it('SIMULATED (the in-app simulator, and a Core in simulated capture): the demo pictures as before, no "No preview" tile', async () => {
    const first = renderDevicesApp({ user: 'rina.wijaya', window });
    await settle();
    expect(bundledPictures()).toBe(4);
    expect(screen.queryByText('No preview')).toBeNull();
    expect(screen.getByTestId('device-thumb-CAM-01').props.accessibilityLabel).not.toMatch(NO_PREVIEW_LABEL);
    first.app.unmount();

    // Live mode, the Core sent no `sourceClass`: simulated capture.
    live();
    renderDevicesApp({ user: 'rina.wijaya', window, initialUrl: '/devices/CAM-01' });
    await settle();
    expect(screen.getByTestId('device-detail-feed').props.accessibilityRole).toBe('image');
    expect(screen.queryByTestId('device-detail-feed-none')).toBeNull();
  });
});
