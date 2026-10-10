// Fix pass F-M4 (review R69-02; ux spec §8f.3; decision D178) — Session Live says "Core Mac's camera
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
const ON = ['monitor-feed-source-on', 'monitor-mic-source-1-on', 'monitor-mic-source-2-on'] as const;
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
    expect(on()).toEqual(['monitor-feed-source-on', 'monitor-mic-source-1-on']);
    expect(screen.getByTestId('monitor-feed-source-on')).toHaveTextContent("Core Mac's camera is on");
    expect(screen.getByTestId('monitor-mic-source-1-on')).toHaveTextContent("Core Mac's microphone is on");

    await b.changeOnCore((engine) => mark(engine, { 'CAM-01': { ...LOCAL, sourceOpen: false }, 'MIC-01': LOCAL }));
    expect(on()).toEqual([]);

    await b.changeOnCore((engine) => mark(engine, { 'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE', sourceOpen: true }, 'MIC-01': LOCAL }));
    expect(on()).toEqual([]);
  });
});
