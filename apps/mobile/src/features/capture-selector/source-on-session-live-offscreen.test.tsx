// Fix pass F-M4, follow-up (review R69-02; ux spec §8f.3) — a local device that is OPEN but drawn by
// no tile of the monitor (the camera of the track that is NOT on screen) still shows its fixed line.
// Base case: Session Live says "Core Mac's camera
// is on" / "Core Mac's microphone is on" from the Core's `sourceOpen` fact, on the camera on screen
// and on the mic card. LIVE mode: the app's own Live source over the contract-checked fake transport
// (`session-live/testing/live-monitor-bed`); the fixture SAYS the devices are the Core Mac's local
// devices and opens nothing (decision D163). NOT proven here: a device, a real Core (gate 75).
import '@/features/session-live/testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
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
const SLOT = 'monitor-open-local-sources';
const CAMERA_ON = "Core Mac's camera is on";

describe('Session Live: an open local device that is not on screen (LIVE)', () => {
  it('the local camera feeds VIDEO-02 while VIDEO-01 is on screen: its "is on" line is drawn once; closed: nothing', async () => {
    const b = await renderLiveMonitor({ setup: (engine) => mark(engine, { 'CAM-02': LOCAL }) });
    bed = b;
    await b.openMonitor();
    expect(b.state().activeCameraId).toBe('VIDEO-01');
    // CONTROL: nothing is open -> nothing is drawn, not even the slot.
    expect(screen.queryByTestId(SLOT)).toBeNull();
    expect(screen.queryByText(CAMERA_ON)).toBeNull();

    await b.changeOnCore((engine) => mark(engine, { 'CAM-02': { ...LOCAL, sourceOpen: true } }));
    expect(screen.queryByTestId('monitor-feed-source-on')).toBeNull();
    expect(screen.getByTestId(`${SLOT}-CAM-02`)).toHaveTextContent(CAMERA_ON);
    expect(screen.getAllByText(CAMERA_ON)).toHaveLength(1);

    await b.changeOnCore((engine) => mark(engine, { 'CAM-02': { ...LOCAL, sourceOpen: false } }));
    expect(screen.queryByTestId(SLOT)).toBeNull();
    expect(screen.queryByText(CAMERA_ON)).toBeNull();
  });

  it('CONTROL: the open local camera IS the camera on screen, the open local microphone has a mic card: one line each, as before, and no second one', async () => {
    const b = await renderLiveMonitor({ setup: (engine) => mark(engine, { 'CAM-01': { ...LOCAL, sourceOpen: true }, 'MIC-01': { ...LOCAL, sourceOpen: true } }) });
    bed = b;
    await b.openMonitor();
    expect(screen.getByTestId('monitor-feed-source-on')).toHaveTextContent(CAMERA_ON);
    // D61 (2026-11-04): the badge testID is channel-keyed (`monitor-mic-source-MIC-01-on`).
    expect(screen.getByTestId('monitor-mic-source-MIC-01-on')).toBeTruthy();
    expect(screen.queryByTestId(SLOT)).toBeNull();
    expect(screen.getAllByText(CAMERA_ON)).toHaveLength(1);
    expect(screen.getAllByText("Core Mac's microphone is on")).toHaveLength(1);
  });
});
