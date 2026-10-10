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
