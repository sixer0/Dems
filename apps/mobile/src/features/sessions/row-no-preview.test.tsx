// Fix wave H, closing pass Z2 (driver D's note 124, section 3: "`sessions/session-row.tsx:47` still
// draws the demo poster on a real Core"; gate 70 finding G70-03, ruling D196: a Core in REAL capture
// shows no stock picture as a preview). The Sessions hub row drew the bundled live poster for the open
// session and the bundled room still for a session without demo media - on a Core in real capture
// too, where an operator could read either as the camera.
//
// The rule is driver D's (`useRealCaptureView`, `PreviewThumb` of `features/devices/camera-preview`):
// Live mode and the Core states the class of a source -> the neutral "No preview" thumb, and no LIVE
// badge over it. CONTROL: the simulated Core (and Simulated client mode) keeps the pictures.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { act, screen, within } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderSessionsApp, settle, type SessionsHarness } from './testing/sessions-harness';

/** What `useMobileLive()` answers: null = Simulated client mode; an object = Live. */
let mockLive: { client: { call: () => Promise<unknown> } } | null = null;
jest.mock('@/runtime', () => {
  const actual = jest.requireActual<typeof import('@/runtime')>('@/runtime');
  return { ...actual, useMobileLive: () => mockLive };
});

// D247 (row 232, M3 c2 F5): pin moved to the reworded thumb label.
const NO_PREVIEW = /No preview: the live preview is not open/;
const realCapture = (h: SessionsHarness) =>
  act(() => h.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => ({ ...device, sourceClass: 'DEVELOPMENT' as const, adapter: 'FAKE' })) } })));
/** Whether a picture is drawn inside a row's thumb (an image carries a `source`; the kit renders it through several nodes). */
const pictures = (id: string): boolean => within(screen.getByTestId(`session-row-thumb-${id}`)).UNSAFE_queryAllByProps({ contentFit: 'cover' }).some((node) => node.props.source !== undefined);

describe('the Sessions hub row on a Core in real capture: no stock picture', () => {
  beforeEach(() => {
    mockLive = null;
    resetMissingKeys();
  });
  afterEach(() => expect(getMissingKeys()).toEqual([]));

  it('real capture: the open session\'s row and a closed session\'s row draw the neutral thumb, with no LIVE badge', async () => {
    mockLive = { client: { call: async () => ({ ok: false, status: 503, error: { code: 'NOT_READY' } }) } };
    const h = renderSessionsApp({ prepare: (test) => test.sim.actions.loadScenario('recording') });
    await settle();
    realCapture(h);
    await settle();
    const state = h.sim.store.getState();
    const open = state.session!.id;
    expect(pictures(open)).toBe(false);
    expect(within(screen.getByTestId(`session-row-thumb-${open}`)).getByLabelText(NO_PREVIEW)).toBeTruthy();
    expect(screen.queryByTestId(`session-row-live-${open}`)).toBeNull();
    const closed = state.sessionHistory.find((entry) => entry.id !== open && screen.queryByTestId(`session-row-thumb-${entry.id}`) !== null);
    expect(closed).toBeDefined();
    expect(pictures(closed!.id)).toBe(false);
  });

  it('CONTROL - the same hub on a simulated Core (Live mode, no source class) and in Simulated client mode keeps its pictures and the LIVE badge', async () => {
    mockLive = { client: { call: async () => ({ ok: false, status: 503, error: { code: 'NOT_READY' } }) } };
    const h = renderSessionsApp({ prepare: (test) => test.sim.actions.loadScenario('recording') });
    await settle();
    const open = h.sim.store.getState().session!.id;
    expect(pictures(open)).toBe(true);
    expect(screen.getByTestId(`session-row-live-${open}`)).toBeTruthy();
    expect(within(screen.getByTestId(`session-row-thumb-${open}`)).queryByLabelText(NO_PREVIEW)).toBeNull();
  });
});
