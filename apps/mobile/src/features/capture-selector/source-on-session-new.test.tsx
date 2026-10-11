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
