// Fix pass F-M4 (review R69-02; ux spec §8f.3; decision D178) — Session Live says "Core Mac's camera
// is on" / "Core Mac's microphone is on" from the Core's `sourceOpen` fact, on the camera on screen
// and on the mic card. LIVE mode: the app's own Live source over the contract-checked fake transport
// (`session-live/testing/live-monitor-bed`); the fixture SAYS the devices are the Core Mac's local
// devices and opens nothing (decision D163). NOT proven here: a device, a real Core (gate 75).
import '@/features/session-live/testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, within } from '@testing-library/react-native';
import { promisify } from 'node:util';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from '@/features/session-live/testing/live-monitor-bed';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('source on session live', () => {
unmountBeforeTheHooksOfThisGroup();

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

function mark(engine: TestSim, marks: Readonly<Record<string, Mark>>): void {
  engine.sim.store.setState((s) => ({
    captureDevices: {
      ...s.captureDevices,
      devices: s.captureDevices.devices.map((device) => {
        const { sourceClass: _sourceClass, adapter: _adapter, sourceOpen: _sourceOpen, ...bare } = device as typeof device & { sourceClass?: string; adapter?: string; sourceOpen?: boolean };
        const found = marks[device.id];
        return (found === undefined ? bare : { ...bare, ...found }) as typeof device;
      }),
    },
  }));
}

const LOCAL: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' };
// D61 (2026-11-04): the badge testIDs are channel-keyed (`monitor-mic-source-${mic.channel}`) — MIC-01..04, not 1..N slots.
const ON = ['monitor-feed-source-on', 'monitor-mic-source-MIC-01-on', 'monitor-mic-source-MIC-02-on'] as const;
const on = () => ON.filter((id) => screen.queryByTestId(id) !== null);

describe('Session Live: the "is on" state of the Core Mac\'s devices (LIVE)', () => {
  it('absent or false `sourceOpen`: the badge only; true: the fixed line on the feed and on that mic card; a test source that is open: nothing', async () => {
    const b = await renderLiveMonitor({ setup: (engine) => mark(engine, { 'CAM-01': LOCAL, 'MIC-01': LOCAL }) });
    bed = b;
    await b.openMonitor();
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
    expect(b.state().activeCameraId).toBe('VIDEO-01');
    // CONTROL: the badge is drawn, the Core sent no `sourceOpen`.
    expect(screen.getByTestId('monitor-feed-source')).toBeTruthy();
    expect(on()).toEqual([]);

    await b.changeOnCore((engine) => mark(engine, { 'CAM-01': { ...LOCAL, sourceOpen: true }, 'MIC-01': { ...LOCAL, sourceOpen: true } }));
    // D61 (2026-11-04): channel-keyed badge testIDs (`monitor-mic-source-MIC-01-on`).
    expect(on()).toEqual(['monitor-feed-source-on', 'monitor-mic-source-MIC-01-on']);
    expect(screen.getByTestId('monitor-feed-source-on')).toHaveTextContent("Core Mac's camera is on");
    expect(screen.getByTestId('monitor-mic-source-MIC-01-on')).toHaveTextContent("Core Mac's microphone is on");

    await b.changeOnCore((engine) => mark(engine, { 'CAM-01': { ...LOCAL, sourceOpen: false }, 'MIC-01': LOCAL }));
    expect(on()).toEqual([]);

    await b.changeOnCore((engine) => mark(engine, { 'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE', sourceOpen: true }, 'MIC-01': LOCAL }));
    expect(on()).toEqual([]);
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-no-preview-session-live.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave H — G70-03 / G75-13 (ruling D196) on Session Live (tablet and phone), LIVE mode: the app's
// own Live source over the contract-checked fake transport (`session-live/testing/live-monitor-bed`).
// During a REAL recording the monitor drew the bundled room loop where the camera picture would be.
// The fixture marks the built-in devices as a development Core's test sources and opens nothing (D163).
describe('no stock picture on Session Live', () => {
unmountBeforeTheHooksOfThisGroup();
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
// D247 (row 232, M3 c2 F5): pin moved to the reworded tile label.
const NO_PREVIEW_LABEL = /No preview: the live preview is not open\./;

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
});
