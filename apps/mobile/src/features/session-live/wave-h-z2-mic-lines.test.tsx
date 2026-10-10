// Fix wave H, closing pass Z2 (item 4, the mobile half; driver D's note 124 section 4 item 2 for the
// web; ruling D137: channel 1 is the FIRST microphone line of the capture configuration, channel 2 the
// second, whatever their ids). The Session Live mic cards drew the "Development source" badge of
// `mic.deviceId` - the simulator's channel record, a constant `MIC-01` / `MIC-02` that no selector
// edit moves - so with another pair on the lines a card carried the badge of the WRONG microphone.
//
// Proven with the pair MIC-03 (line 1, the Core Mac's microphone) / MIC-01 (line 2, a generated
// source), LIVE: card 1 carries MIC-03's badge, card 2 MIC-01's; MIC-02 (a production source, on no
// line) marks nothing. CONTROL: the built-in pair, as `development-source-mounts.test.tsx` holds it.
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

const MARKS: Readonly<Record<string, { sourceClass: 'DEVELOPMENT' | 'PRODUCTION'; adapter: string }>> = {
  'MIC-01': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' },
  'MIC-02': { sourceClass: 'PRODUCTION', adapter: 'USB_AUDIO' },
  'MIC-03': { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' },
};

/** The Core's devices with their classes and a third microphone; `pair`: MIC-03 / MIC-01 on the lines of the selector and of the open session. */
function prepare(engine: TestSim, pair: boolean): void {
  engine.sim.store.setState((s) => {
    const like = s.captureDevices.devices.find((device) => device.kind === 'MIC')!;
    const devices = [...s.captureDevices.devices.filter((device) => device.id !== 'MIC-03'), { ...like, id: 'MIC-03' }].map((device) => ({ ...device, ...(MARKS[device.id] ?? {}) }) as typeof like);
    const mics = pair
      ? [
          { ...s.captureConfig.mics[0]!, inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' as const },
          { ...s.captureConfig.mics[0]!, inputId: 'MIC-01', deviceId: 'MIC-01', role: 'STANDBY' as const },
        ]
      : s.captureConfig.mics;
    const captureConfig = { ...s.captureConfig, mics } as typeof s.captureConfig;
    const session = s.session === null ? null : ({ ...s.session, captureConfig: s.session.captureConfig ? { ...s.session.captureConfig, mics } : s.session.captureConfig } as typeof s.session);
    return { captureDevices: { ...s.captureDevices, devices }, captureConfig, session };
  });
}

describe('Session Live mic cards follow the selector\'s lines (pair MIC-03 / MIC-01)', () => {
  it('card 1 carries the badge of MIC-03 (the Core Mac\'s microphone), card 2 the badge of MIC-01 (a test source)', async () => {
    const b = await renderLiveMonitor({ setup: (engine) => prepare(engine, true) });
    bed = b;
    await b.openMonitor();
    expect(within(screen.getByTestId('monitor-mic-1')).getByText("Core Mac's microphone")).toBeTruthy();
    expect(within(screen.getByTestId('monitor-mic-1')).queryByText('Test source')).toBeNull();
    expect(within(screen.getByTestId('monitor-mic-2')).getByText('Test source')).toBeTruthy();
    expect(screen.getByTestId('monitor-mic-source-1')).toBeTruthy();
    expect(screen.getByTestId('monitor-mic-source-2')).toBeTruthy();
  });

  it('CONTROL - the built-in pair: card 1 is MIC-01 (a test source), card 2 is MIC-02 (production: no badge)', async () => {
    const b = await renderLiveMonitor({ setup: (engine) => prepare(engine, false) });
    bed = b;
    await b.openMonitor();
    expect(within(screen.getByTestId('monitor-mic-1')).getByText('Test source')).toBeTruthy();
    expect(screen.queryByTestId('monitor-mic-source-2')).toBeNull();
  });
});
