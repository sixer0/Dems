// Fix wave H — G70-03 / G75-13 (ruling D196) on the Session New previews (tablet and phone), LIVE mode:
// the app's own Live source over the contract-checked fake transport (`session-new/testing/live-session-new-bed`).
// The fixture marks the four built-in devices as TEST sources of a development Core (`FAKE`): a Core
// in real capture, no local device, so no notice stands in the way and nothing is opened (D163).
import '@/features/session-new/testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderLiveSessionNew, resetLiveSessionNewBed, type LiveSessionNewBed, type LiveSessionNewBedOptions } from '@/features/session-new/testing/live-session-new-bed';

let bed: LiveSessionNewBed | null = null;

beforeEach(async () => {
  await resetLiveSessionNewBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

const NO_PREVIEW_LABEL = /No preview: this build shows no live picture of the cameras\./;
const FEEDS = ['session-new-feed-CAM-1', 'session-new-feed-CAM-2'] as const;

function realCapture(engine: TestSim): void {
  engine.sim.store.setState((s) => ({
    captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => (device.kind === 'CAMERA' || device.kind === 'MIC' ? { ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' as const } : device)) },
  }));
}

async function openStep2(options: LiveSessionNewBedOptions): Promise<LiveSessionNewBed> {
  const b = await renderLiveSessionNew(options);
  bed = b;
  await b.openFlow();
  const settleValidation = () => act(async () => {});
  fireEvent.press(screen.getByTestId('session-new-scan'));
  await settleValidation();
  fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
  await settleValidation();
  fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Ahmad Fauzi');
  await settleValidation();
  fireEvent.press(screen.getByTestId('session-new-next'));
  await b.flush();
  await b.elapse(200);
  expect(b.state().session?.state).toBe('PRECHECK');
  return b;
}

describe.each(['tabletLandscape', 'phonePortrait'] as const)('Session New previews on %s', (window) => {
  it('REAL capture: both previews are "No preview" tiles with the device name and its true state; no picture, no LIVE / DEMO text', async () => {
    await openStep2({ window, setup: realCapture });
    for (const [testID, device] of [[FEEDS[0], 'Camera CAM-01'], [FEEDS[1], 'Camera CAM-02']] as const) {
      const tile = screen.getByTestId(testID);
      expect(screen.getByTestId(`${testID}-none`)).toHaveTextContent('No preview');
      expect(screen.getByTestId(`${testID}-name`)).toHaveTextContent(new RegExp(device));
      // Fix wave L (controller ruling on G70c-02): a source at rest of which the Core states no checked fact reads "Not checked" - never "Reachable" / "Ready".
      expect(screen.getByTestId(`${testID}-state`)).toHaveTextContent('Not checked');
      expect(tile.props.accessibilityRole).toBe('text');
      expect(tile.props.accessibilityLabel).toMatch(NO_PREVIEW_LABEL);
      expect(screen.queryByTestId(`${testID}-video`)).toBeNull();
    }
    // On each whole preview (picture area and its microphone meter): no LIVE / DEMO caption.
    for (const id of ['CAM-1', 'CAM-2']) expect(within(screen.getByTestId(`session-new-preview-${id}`)).queryAllByText(/\b(LIVE|DEMO)\b/)).toHaveLength(0);
  });

  it('a Core in SIMULATED capture (no `sourceClass`): the demo previews as before', async () => {
    await openStep2({ window });
    for (const testID of FEEDS) {
      expect(screen.getByTestId(testID).props.accessibilityRole).toBe('image');
      expect(screen.queryByTestId(`${testID}-none`)).toBeNull();
    }
    expect(screen.queryByText('No preview')).toBeNull();
  });
});

// Audit row 183 (M3-04 R4; D5 pairing, D163): step 2 previews one tile per camera-microphone pair, all four, over
// the shared `CAPTURE_PAIRS` - the camera tile "Camera N (Mic N)" (T10 `devices.pairs.cameraOfMic`), the meter
// "Mic N (Camera N)" (T9 `devices.pairs.micOfCamera`; Pair 1 also "Transcribed", as the web row 158 meters).
// It replaced the two-entry `CAMERAS` list (D60 era): pairs 3 and 4 had no preview and no meter.
describe.each(['tabletLandscape', 'phonePortrait'] as const)('row 183: four preview pairs on %s', (window) => {
  const PAIRS = [1, 2, 3, 4] as const;

  it('a Core in SIMULATED capture: four tiles in pair order, each labelled "Camera N (Mic N)" with its meter "Mic N (Camera N)"', async () => {
    await openStep2({ window });
    const tiles = screen.getAllByTestId(/^session-new-preview-CAM-\d$/);
    expect(tiles.map((tile) => tile.props.testID)).toEqual(PAIRS.map((n) => `session-new-preview-CAM-${n}`));
    for (const n of PAIRS) {
      expect(screen.getByTestId(`session-new-feed-CAM-${n}`).props.accessibilityLabel).toBe(`Camera ${n} (Mic ${n})`);
      expect(screen.getByTestId(`session-new-meter-AUDIO-0${n}-label`)).toHaveTextContent(n === 1 ? 'Mic 1 (Camera 1) · Transcribed' : `Mic ${n} (Camera ${n})`, { exact: true });
      // The meter of the pair reads its own channel (AUDIO-0N), inside the pair's tile.
      expect(within(screen.getByTestId(`session-new-preview-CAM-${n}`)).getByTestId(`session-new-meter-AUDIO-0${n}`)).toBeTruthy();
    }
    // Only Pair 1 is transcribed; the old two-entry words ("MIC 1", "MIC 2") are not drawn as meter labels.
    expect(screen.getAllByText(/· Transcribed$/)).toHaveLength(1);
    expect(screen.queryByText(/^MIC [12]$/)).toBeNull();
  });

  it('REAL capture: all four pairs are "No preview" tiles - no picture, no LIVE / DEMO text', async () => {
    await openStep2({ window, setup: realCapture });
    for (const n of PAIRS) {
      expect(screen.getByTestId(`session-new-feed-CAM-${n}-none`)).toHaveTextContent('No preview');
      expect(screen.queryByTestId(`session-new-feed-CAM-${n}-video`)).toBeNull();
      expect(within(screen.getByTestId(`session-new-preview-CAM-${n}`)).queryAllByText(/\b(LIVE|DEMO)\b/)).toHaveLength(0);
    }
  });
});
