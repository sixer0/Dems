// Fix wave H, gate 70 finding G70-08 — DEFENCE IN DEPTH: the notice gate itself (`useLocalSourceGate`)
// refuses to send while the device classes are unknown, whatever the button in front of it does.
// The pure rule (`localSourcesKnown`) and the hook, over a real test simulator; Live mode and the
// Live link are stood in for by their read members.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';

import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { SimState } from '@dems/shared/sim';
import { RuntimeTestProviders, createTestSim, flushAsync } from '@/runtime/testing/test-sim';
import { useLocalSourceGate } from './local-source-notice';
import { localSourcesKnown } from './local-source-notice-model';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

let mockLive: object | null = null;
let mockLink: string | null = null;
jest.mock('@/runtime', () => {
  const actual = jest.requireActual<typeof import('@/runtime')>('@/runtime');
  return { ...actual, useMobileLive: () => mockLive };
});
jest.mock('@dems/shared/live', () => {
  const actual = jest.requireActual<typeof import('@dems/shared/live')>('@dems/shared/live');
  return { ...actual, liveLinkOf: () => mockLink, useLiveLink: () => mockLink };
});

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('the one rule and the gate', () => {
unmountBeforeTheHooksOfThisGroup();

beforeEach(() => {
  mockLive = {};
  mockLink = 'ONLINE';
});
afterEach(() => {
  mockLive = null;
  mockLink = null;
});

const SELECTOR = { cameras: [{ deviceId: 'CAM-01' }, { deviceId: 'CAM-02' }], mics: [{ deviceId: 'MIC-01' }, { deviceId: 'MIC-02' }] };
const LIST = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'].map((id) => ({ id }));

describe('localSourcesKnown: the one rule', () => {
  it('Simulated client mode: always known (nothing is opened there)', () => {
    expect(localSourcesKnown({ devices: [], selectors: [null, { cameras: [], mics: [] }], live: false, link: null })).toBe(true);
  });
  it('Live, link ONLINE, every line of the selector is in the device list: known', () => {
    expect(localSourcesKnown({ devices: LIST, selectors: [undefined, SELECTOR], live: true, link: 'ONLINE' })).toBe(true);
  });
  it.each(['CONNECTING', 'RESYNCING', 'STALE', 'OFFLINE', null])('Live, link %s: unknown, whatever the store holds', (link) => {
    expect(localSourcesKnown({ devices: LIST, selectors: [SELECTOR], live: true, link })).toBe(false);
  });
  it('Live, ONLINE, the list misses a device a line names (a session snapshot or the current selector): unknown', () => {
    expect(localSourcesKnown({ devices: LIST.slice(1), selectors: [SELECTOR], live: true, link: 'ONLINE' })).toBe(false);
    expect(localSourcesKnown({ devices: LIST, selectors: [{ cameras: [{ deviceId: 'CAM-03' }], mics: [] }, SELECTOR], live: true, link: 'ONLINE' })).toBe(false);
    expect(localSourcesKnown({ devices: [], selectors: [SELECTOR], live: true, link: 'ONLINE' })).toBe(false);
  });
  it('Live, ONLINE, no selector line at all (no Core data yet): unknown', () => {
    expect(localSourcesKnown({ devices: LIST, selectors: [null, { cameras: [], mics: [] }], live: true, link: 'ONLINE' })).toBe(false);
  });
});

function gateOver(setup?: (state: SimState) => Partial<SimState>) {
  const engine = createTestSim();
  if (setup) engine.sim.store.setState(setup);
  const wrapper = ({ children }: { children: ReactNode }) => <RuntimeTestProviders sim={engine.sim}>{children}</RuntimeTestProviders>;
  return renderHook(() => useLocalSourceGate(), { wrapper });
}
const noDevices = (s: SimState): Partial<SimState> => ({ captureDevices: { ...s.captureDevices, devices: [] } });
const localCamera = (s: SimState): Partial<SimState> => ({
  captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => (device.id === 'CAM-01' ? { ...device, adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' as const } : device)) },
});

describe('useLocalSourceGate: nothing is sent while the classes are unknown', () => {
  it.each(['PRECHECK', 'START'] as const)('%s, the device list is not there: `send` never runs, `cancelled` runs, no notice opens, `checking` is true', async (kind) => {
    const { result } = gateOver(noDevices);
    await flushAsync();
    const send = jest.fn();
    const cancelled = jest.fn();
    expect(result.current.checking).toBe(true);
    act(() => result.current.ask(send, cancelled, kind));
    expect(send).not.toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBeNull();
  });

  it.each(['CONNECTING', 'RESYNCING', 'STALE', 'OFFLINE'])('the link is %s (not loaded, stale after a reconnect, in error): `ask` and `consent` send nothing', async (link) => {
    mockLink = link;
    const { result } = gateOver();
    await flushAsync();
    const send = jest.fn();
    const cancelled = jest.fn();
    const proceed = jest.fn();
    act(() => result.current.ask(send, cancelled));
    act(() => result.current.consent('START', proceed));
    expect(send).not.toHaveBeenCalled();
    expect(proceed).not.toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBeNull();
  });

  it('a consent given while known does not carry a send through a list that became unknown: the grant is dropped', async () => {
    const { result } = gateOver(localCamera);
    await flushAsync();
    const proceed = jest.fn();
    act(() => result.current.consent('START', proceed));
    expect(result.current.notice).toEqual({ camera: 'CAM-01', microphone: null });
    act(() => result.current.confirm());
    expect(proceed).toHaveBeenCalledTimes(1);
    mockLink = 'RESYNCING';
    const send = jest.fn();
    const cancelled = jest.fn();
    act(() => result.current.ask(send, cancelled, 'START'));
    expect(send).not.toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalledTimes(1);
    // Known again: the dropped grant does not come back - the gate asks.
    mockLink = 'ONLINE';
    act(() => result.current.ask(send, cancelled, 'START'));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.notice).toEqual({ camera: 'CAM-01', microphone: null });
  });

  it('CONTROL: known, no local device - `send` runs at once; known, a local camera - the notice as built', async () => {
    const plain = gateOver();
    await flushAsync();
    const send = jest.fn();
    expect(plain.result.current.checking).toBe(false);
    act(() => plain.result.current.ask(send, jest.fn()));
    expect(send).toHaveBeenCalledTimes(1);
    plain.unmount();

    const local = gateOver(localCamera);
    await flushAsync();
    const held = jest.fn();
    act(() => local.result.current.ask(held, jest.fn()));
    expect(held).not.toHaveBeenCalled();
    expect(local.result.current.notice).toEqual({ camera: 'CAM-01', microphone: null });
    act(() => local.result.current.confirm());
    expect(held).toHaveBeenCalledTimes(1);
  });

  it('CONTROL: Simulated client mode - never checking, `send` at once even with an empty list', async () => {
    mockLive = null;
    mockLink = null;
    const { result } = gateOver(noDevices);
    await flushAsync();
    const send = jest.fn();
    expect(result.current.checking).toBe(false);
    act(() => result.current.ask(send, jest.fn()));
    expect(send).toHaveBeenCalledTimes(1);
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-i-c-sources-stale.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave I, driver C - gate 70 finding G70-08 on the tablet, which the re-gate left NOT PROVEN live:
// "with the network path cut the app kept the device list it knew and still showed the notice".
//
// THE RULE, by reading (`local-source-notice-model.ts` `localSourcesKnown`, `local-source-notice.tsx`
// `useLocalSourceGate`) - three states of the device list, and what a press does in each:
//
// | State of the list | How the client tells | A control that opens a device | The gate at a press |
// |---|---|---|---|
// | UNKNOWN - never loaded | no selector line, or a line names a device the list does not hold, or the Live link is CONNECTING for the first time | disabled, "Checking the capture sources…" | sends nothing, opens no notice |
// | STALE - kept from before | the store still holds the list of the socket before and the Live link is not ONLINE (STALE, OFFLINE, CONNECTING again, RESYNCING) | disabled, the same sentence | sends nothing, opens no notice - a kept list is NOT trusted |
// | KEPT, the cut not noticed yet | the link still reads ONLINE (the heartbeat has not timed out); the list is the one the Core sent | enabled | the notice is decided from the list the Core sent and PRECEDES the send; a send goes to a Core that is not there and changes nothing |
//
// That third row is what the re-gate saw on the tablet (it is the safe reading: "it still asks").
// WHAT WAS MISSING, found by this reading and written RED here: a notice that was OPENED while the
// list was known and CONFIRMED after the list had become stale / unknown still ran its send - the
// re-check existed at the press and for a consent's grant, not at Confirm. Now Confirm re-checks:
// the notice closes, nothing is sent, and the operator is told ("Checking the capture sources…").
//
// The hook and the pure rule over a real test simulator; Live mode and the Live link are stood in for
// by their read members (as the cases above, which were `wave-h-sources-known-gate.test.tsx`). Nothing is opened (decision D163).
// NOT proven here: a device with its Core link really cut (re-drive list of note 134).
describe('a kept list: STALE versus UNKNOWN', () => {
unmountBeforeTheHooksOfThisGroup();
beforeEach(() => {
  mockLive = {};
  mockLink = 'ONLINE';
});
afterEach(() => {
  mockLive = null;
  mockLink = null;
});

const SELECTOR = { cameras: [{ deviceId: 'CAM-01' }, { deviceId: 'CAM-02' }], mics: [{ deviceId: 'MIC-01' }, { deviceId: 'MIC-02' }] };
const LIST = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'].map((id) => ({ id }));
const NOT_ONLINE = ['STALE', 'OFFLINE', 'CONNECTING', 'RESYNCING'] as const;

function gateOver(setup?: (state: SimState) => Partial<SimState>) {
  const engine = createTestSim();
  if (setup) engine.sim.store.setState(setup);
  const wrapper = ({ children }: { children: ReactNode }) => <RuntimeTestProviders sim={engine.sim}>{children}</RuntimeTestProviders>;
  return { engine, ...renderHook(() => useLocalSourceGate(), { wrapper }) };
}
const localCamera = (s: SimState): Partial<SimState> => ({
  captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => (device.id === 'CAM-01' ? { ...device, adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' as const } : device)) },
});

describe('G70-08: STALE (a kept list) versus UNKNOWN (never loaded) - the pure rule', () => {
  it('UNKNOWN: no selector line, or a line whose device the list does not hold, is unknown even ONLINE', () => {
    expect(localSourcesKnown({ devices: LIST, selectors: [{ cameras: [], mics: [] }], live: true, link: 'ONLINE' })).toBe(false);
    expect(localSourcesKnown({ devices: [], selectors: [SELECTOR], live: true, link: 'ONLINE' })).toBe(false);
    expect(localSourcesKnown({ devices: LIST, selectors: [SELECTOR], live: true, link: 'CONNECTING' })).toBe(false);
  });

  it.each(NOT_ONLINE)('STALE: a COMPLETE list kept from before is not trusted while the link is %s', (link) => {
    expect(localSourcesKnown({ devices: LIST, selectors: [SELECTOR], live: true, link })).toBe(false);
  });

  it('KEPT with the link ONLINE (the cut not noticed yet, the re-gate\'s observation): known - the notice is decided from the list the Core sent', () => {
    expect(localSourcesKnown({ devices: LIST, selectors: [SELECTOR], live: true, link: 'ONLINE' })).toBe(true);
  });
});

describe('G70-08: the gate on a kept list', () => {
  it('KEPT, link ONLINE, the list names the Core Mac\'s camera: the notice opens BEFORE anything is sent; "Not now" sends nothing', async () => {
    const { result } = gateOver(localCamera);
    await flushAsync();
    const send = jest.fn();
    const cancelled = jest.fn();
    expect(result.current.checking).toBe(false);
    act(() => result.current.ask(send, cancelled, 'PRECHECK'));
    expect(result.current.notice).toEqual({ camera: 'CAM-01', microphone: null });
    expect(send).not.toHaveBeenCalled();
    act(() => result.current.cancel());
    expect(send).not.toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it.each(NOT_ONLINE)('STALE, link %s, the kept list names the Core Mac\'s camera: `checking` is true, a press sends nothing and opens no notice', async (link) => {
    const { result, rerender } = gateOver(localCamera);
    await flushAsync();
    mockLink = link;
    rerender({});
    const send = jest.fn();
    const cancelled = jest.fn();
    expect(result.current.checking).toBe(true);
    act(() => result.current.ask(send, cancelled, 'PRECHECK'));
    act(() => result.current.consent('START', send));
    expect(send).not.toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBeNull();
  });

  it.each(NOT_ONLINE)('a notice OPENED while known and confirmed after the link turned %s: Confirm sends NOTHING, the notice closes, the press is cancelled', async (link) => {
    const { result } = gateOver(localCamera);
    await flushAsync();
    const send = jest.fn();
    const cancelled = jest.fn();
    act(() => result.current.ask(send, cancelled, 'PRECHECK'));
    expect(result.current.notice).toEqual({ camera: 'CAM-01', microphone: null });
    // The Core link drops while the notice stands: the list on screen is now a kept one.
    mockLink = link;
    act(() => result.current.confirm());
    expect(send).not.toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBeNull();
    // Back ONLINE: the next press asks again (no consent was kept).
    mockLink = 'ONLINE';
    act(() => result.current.ask(send, cancelled, 'PRECHECK'));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.notice).toEqual({ camera: 'CAM-01', microphone: null });
  });

  it('a notice OPENED while known and confirmed after the LIST lost a device a line names (UNKNOWN): Confirm sends nothing; a START consent grants nothing', async () => {
    const { engine, result } = gateOver(localCamera);
    await flushAsync();
    const proceed = jest.fn();
    act(() => result.current.consent('START', proceed));
    expect(result.current.notice).toEqual({ camera: 'CAM-01', microphone: null });
    const kept = engine.sim.store.getState().captureDevices;
    act(() => engine.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: [] } })));
    act(() => result.current.confirm());
    expect(proceed).not.toHaveBeenCalled();
    expect(result.current.notice).toBeNull();
    // The list is back: no grant was kept, so the start asks again.
    act(() => engine.sim.store.setState({ captureDevices: kept }));
    const send = jest.fn();
    act(() => result.current.ask(send, jest.fn(), 'START'));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.notice).toEqual({ camera: 'CAM-01', microphone: null });
  });

  it('CONTROL: opened and confirmed while known - Confirm sends once', async () => {
    const { result } = gateOver(localCamera);
    await flushAsync();
    const send = jest.fn();
    act(() => result.current.ask(send, jest.fn(), 'PRECHECK'));
    act(() => result.current.confirm());
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBeNull();
  });
});
});
