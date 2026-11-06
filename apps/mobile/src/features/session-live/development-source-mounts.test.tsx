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
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('development source mounts', () => {
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

const SPOTS = ['monitor-feed-source', 'monitor-mic-source-MIC-01', 'monitor-mic-source-MIC-02', 'monitor-mic-source-MIC-03', 'monitor-mic-source-MIC-04'] as const; // D61 (2026-11-04): the badge spot is keyed by the CHANNEL code; four cards
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
    expect(badged()).toEqual(['monitor-feed-source', 'monitor-mic-source-MIC-02']); // D61 (2026-11-04): the card's badge spot names its channel
    expect(within(screen.getByTestId('monitor-feed-source')).getByText("Core Mac's camera")).toBeTruthy();
    expect(within(screen.getByTestId('monitor-mic-MIC-02')).getByText('Test source')).toBeTruthy(); // D61: the card is keyed by the CHANNEL code
    expect(within(screen.getByTestId('monitor-mic-MIC-01')).queryByText('Development source')).toBeNull();

    await b.changeOnCore((engine) => mark(engine, {}));
    expect(badged()).toEqual([]);
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-z2-mic-lines.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave H, closing pass Z2 (item 4, the mobile half; driver D's note 124 section 4 item 2 for the
// web; ruling D137: channel 1 is the FIRST microphone line of the capture configuration, channel 2 the
// second, whatever their ids). The Session Live mic cards drew the "Development source" badge of
// `mic.deviceId` - the simulator's channel record, a constant `MIC-01` / `MIC-02` that no selector
// edit moves - so with another pair on the lines a card carried the badge of the WRONG microphone.
//
// Proven with the pair MIC-05 (channel 1, the Core Mac's microphone; D61 of 2026-11-04: MIC-03/04 are
// built-ins, an adopted microphone mints as MIC-05) / MIC-01 (channel 2, a generated
// source), LIVE: card 1 carries MIC-05's badge, card 2 MIC-01's; MIC-02 (a production source, on no
// line) marks nothing. CONTROL: the built-in plane, as `development-source-mounts.test.tsx` holds it.
describe('the mic cards follow the lines of the selector', () => {
unmountBeforeTheHooksOfThisGroup();
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
  'MIC-05': { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' }, // D61 (2026-11-04): the Mac's microphone mints past the four built-ins
};

/** The Core's devices with their classes and the Mac's microphone; `pair`: MIC-05 / MIC-01 on channels 1 and 2 (D61). */
function prepare(engine: TestSim, pair: boolean): void {
  engine.sim.store.setState((s) => {
    const like = s.captureDevices.devices.find((device) => device.kind === 'MIC')!;
    const devices = [...s.captureDevices.devices.filter((device) => device.id !== 'MIC-05'), { ...like, id: 'MIC-05' }].map((device) => ({ ...device, ...(MARKS[device.id] ?? {}) }) as typeof like); // D61: MIC-03/04 are built-ins; the adopted one is MIC-05
    const mics = pair
      ? s.captureConfig.mics.map((line) =>
          line.channel === 'MIC-01'
            ? { ...line, inputId: 'MIC-05', deviceId: 'MIC-05' } // channel 1: the Core Mac's microphone
            : line.channel === 'MIC-02'
              ? { ...line, inputId: 'MIC-01', deviceId: 'MIC-01' } // channel 2: the generated source; MIC-02 stands on no line
              : line,
        )
      : s.captureConfig.mics;
    const captureConfig = { ...s.captureConfig, mics } as typeof s.captureConfig;
    const session = s.session === null ? null : ({ ...s.session, captureConfig: s.session.captureConfig ? { ...s.session.captureConfig, mics } : s.session.captureConfig } as typeof s.session);
    return { captureDevices: { ...s.captureDevices, devices }, captureConfig, session };
  });
}

describe('Session Live mic cards follow the selector\'s lines (channels MIC-05 / MIC-01; D61)', () => {
  it('card 1 carries the badge of MIC-05 (the Core Mac\'s microphone), card 2 the badge of MIC-01 (a test source)', async () => {
    const b = await renderLiveMonitor({ setup: (engine) => prepare(engine, true) });
    bed = b;
    await b.openMonitor();
    expect(within(screen.getByTestId('monitor-mic-MIC-01')).getByText("Core Mac's microphone")).toBeTruthy(); // D61 (2026-11-04): the card is keyed by the CHANNEL code
    expect(within(screen.getByTestId('monitor-mic-MIC-01')).queryByText('Test source')).toBeNull();
    expect(within(screen.getByTestId('monitor-mic-MIC-02')).getByText('Test source')).toBeTruthy();
    expect(screen.getByTestId('monitor-mic-source-MIC-01')).toBeTruthy();
    expect(screen.getByTestId('monitor-mic-source-MIC-02')).toBeTruthy();
  });

  it('CONTROL - the built-in plane: card 1 is MIC-01 (a test source), card 2 is MIC-02 (production: no badge)', async () => {
    const b = await renderLiveMonitor({ setup: (engine) => prepare(engine, false) });
    bed = b;
    await b.openMonitor();
    expect(within(screen.getByTestId('monitor-mic-MIC-01')).getByText('Test source')).toBeTruthy(); // D61 (2026-11-04)
    expect(screen.queryByTestId('monitor-mic-source-MIC-02')).toBeNull();
  });
});
});
