// Integration pass D2, item 2 (row 138's request; ux spec §8f.2 "Session Monitor tiles", MB-03;
// decision D131) — Session Live carries the one "Development source" badge on the camera on screen
// and on each mic card, drawn from the Core's `sourceClass` only. LIVE mode: the app's own Live
// source over the contract-checked fake transport (`testing/live-monitor-bed`); the Core's engine is
// a real simulator and its devices are marked as a Core in real capture would send them.
// NOT proven here: a device, a real Core (gate flow F6).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, within } from '@testing-library/react-native';
import { promisify } from 'node:util';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from './testing/live-monitor-bed';

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

const SPOTS = ['monitor-feed-source', 'monitor-mic-source-1', 'monitor-mic-source-2'] as const;
const badged = () => SPOTS.filter((id) => screen.queryByTestId(id) !== null);

/** Marks the engine's devices; every other device carries no `sourceClass` at all. */
function mark(engine: TestSim, marks: Readonly<Record<string, { sourceClass: 'DEVELOPMENT' | 'PRODUCTION'; adapter: string }>>): void {
  engine.sim.store.setState((s) => ({
    captureDevices: {
      ...s.captureDevices,
      devices: s.captureDevices.devices.map((device) => {
        const { sourceClass: _sourceClass, adapter: _adapter, ...bare } = device as typeof device & { sourceClass?: string; adapter?: string };
        const found = marks[device.id];
        return (found === undefined ? bare : { ...bare, ...found }) as typeof device;
      }),
    },
  }));
}

describe('Session Live: the development-source badge (LIVE)', () => {
  it('no device carries `sourceClass`: nothing is drawn; the Core marks CAM-01 and MIC-02: the feed and that mic card carry the badge', async () => {
    const b = await renderLiveMonitor({ setup: (engine) => mark(engine, {}) });
    bed = b;
    await b.openMonitor();
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
    expect(badged()).toEqual([]);
    expect(screen.queryByText('Development source')).toBeNull();

    await b.changeOnCore((engine) => mark(engine, { 'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' }, 'MIC-02': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }, 'MIC-01': { sourceClass: 'PRODUCTION', adapter: 'USB_AUDIO' } }));
    // The camera on screen is VIDEO-01, fed by CAM-01 in the session's selector.
    expect(b.state().activeCameraId).toBe('VIDEO-01');
    expect(badged()).toEqual(['monitor-feed-source', 'monitor-mic-source-2']);
    expect(within(screen.getByTestId('monitor-feed-source')).getByText("Core Mac's camera")).toBeTruthy();
    expect(within(screen.getByTestId('monitor-mic-2')).getByText('Test source')).toBeTruthy();
    expect(within(screen.getByTestId('monitor-mic-1')).queryByText('Development source')).toBeNull();

    await b.changeOnCore((engine) => mark(engine, {}));
    expect(badged()).toEqual([]);
  });
});
