// Fix wave H — G70-03 / G75-13 (ruling D196) on Session Live (tablet and phone), LIVE mode: the app's
// own Live source over the contract-checked fake transport (`session-live/testing/live-monitor-bed`).
// During a REAL recording the monitor drew the bundled room loop where the camera picture would be.
// The fixture marks the built-in devices as a development Core's test sources and opens nothing (D163).
import '@/features/session-live/testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, within } from '@testing-library/react-native';
import { promisify } from 'node:util';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from '@/features/session-live/testing/live-monitor-bed';

let bed: LiveMonitorBed | null = null;
const nextTurn = promisify(setImmediate) as () => Promise<void>;

beforeAll(async () => {
  // Reanimated prepares its UI-side frame-callback registry on the real queue (S72-12).
  await nextTurn();
  await nextTurn();
});

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  await resetLiveMonitorBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  jest.useRealTimers();
});

type Mark = { sourceClass: 'DEVELOPMENT' | 'PRODUCTION'; adapter: string; sourceOpen?: boolean };
const LOCAL: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' };
const FAKE: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' };
const NO_PREVIEW_LABEL = /No preview: this build shows no live picture of the cameras\./;

function mark(engine: TestSim, marks: Readonly<Record<string, Mark>>): void {
  engine.sim.store.setState((s) => ({
    captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => ({ ...device, ...(marks[device.id] ?? {}) }) as typeof device) },
  }));
}

describe.each(['tabletLandscape', 'phonePortrait'] as const)('Session Live on %s', (window) => {
  it('a REAL recording: the feed is the "No preview" tile with the device and its true state ("On" only from `sourceOpen`); no picture, no LIVE / DEMO text', async () => {
    const b = await renderLiveMonitor({ window, setup: (engine) => mark(engine, { 'CAM-01': LOCAL, 'CAM-02': FAKE, 'MIC-01': FAKE, 'MIC-02': FAKE }) });
    bed = b;
    await b.openMonitor();
    expect(b.state().activeCameraId).toBe('VIDEO-01');
    const tile = screen.getByTestId('monitor-camera-feed');
    expect(screen.getByTestId('monitor-camera-feed-none')).toHaveTextContent('No preview');
    expect(screen.getByTestId('monitor-camera-feed-name')).toHaveTextContent(/Core Mac's camera/);
    expect(screen.getByTestId('monitor-camera-feed-state')).toHaveTextContent('Ready');
    expect(tile.props.accessibilityRole).toBe('text');
    expect(tile.props.accessibilityLabel).toMatch(NO_PREVIEW_LABEL);
    expect(screen.queryByTestId('monitor-camera-feed-video')).toBeNull();
    // On the whole feed frame (picture area, badge, chips): no LIVE / DEMO caption.
    expect(within(screen.getByTestId('monitor-feed')).queryAllByText(/\b(LIVE|DEMO)\b/)).toHaveLength(0);

    await b.changeOnCore((engine) => mark(engine, { 'CAM-01': { ...LOCAL, sourceOpen: true } }));
    expect(screen.getByTestId('monitor-camera-feed-state')).toHaveTextContent('On');
    // The fixed sentence stays the badge's, once.
    expect(screen.getAllByText("Core Mac's camera is on")).toHaveLength(1);
  });

  it('a Core in SIMULATED capture (no `sourceClass`): the demo feed as before', async () => {
    const b = await renderLiveMonitor({ window });
    bed = b;
    await b.openMonitor();
    expect(screen.getByTestId('monitor-camera-feed').props.accessibilityRole).toBe('image');
    expect(screen.queryByTestId('monitor-camera-feed-none')).toBeNull();
    expect(screen.queryByText('No preview')).toBeNull();
  });
});
