// Backend task W51: `LIVE` as a Core link source (04_client_integration_spec §3.1 MD-3,
// MD-7, §9.5; AC-C-28 as revised by D163: a release build carries LIVE only; AC-C-32), the banner
// rule, and the debug parameter `core=`.
// Since 2026-11-05 the device runs LIVE only: it is the default and the only source Settings
// offers, while SIMULATED and HEARTBEAT stay reachable for the tests and the debug `core=` link.
//
// The release cases flip the global `__DEV__`, as the existing release-gate test does
// (`features/settings/heartbeat-release-gate.test.tsx`, which stays as it is: these are the LIVE
// cases beside it, decision D17).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { createCoreClient } from '@dems/shared/client';
import { asSim, createLiveSim } from '@dems/shared/live/source';
import { createFakeTransport } from '@dems/shared/live/testing';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { MOBILE_PREFS_KEY } from '@/motion';
import { nextBannerKind, type ConnectionBannerKind } from './connection-banner';
import { PAIRING_CHECKING, PAIRING_NOT_REQUIRED, createRuntimeContract, isPairingBlocked, type CoreLinkInfo, type CoreLinkSource, type PairingInfo } from './contract';
import {
  CORE_LINK_SOURCES,
  DEFAULT_CORE_LINK_SOURCE,
  coreLinkStateFor,
  effectiveCoreLinkSource,
  getCoreLinkSource,
  hydrateCoreLinkSource,
  isCoreLinkSourceAvailable,
  KNOWN_CORE_LINK_SOURCES,
  parseCoreLinkSource,
  resetCoreLinkPrefsForTests,
  setCoreLinkSource,
  useCoreLinkSource,
} from './core-link';
import { applyLaunchCoreSource, coreSourceFromUrl, resetDebugLaunchForTests, useDebugScenarioLinks } from './debug';
import { CORE_LINK_SOURCES as INDEX_CORE_LINK_SOURCES, KNOWN_CORE_LINK_SOURCES as INDEX_KNOWN_CORE_LINK_SOURCES } from './index';
import { runtimeLog } from './log';
import { FALLBACK_DEVICE_NAME, liveDeviceDescription } from './sim-adapters';
import { decideCoreLinkSource, simulatorLinkSource } from './sim-runtime-provider';
import { createTestSim, flushAsync } from './testing/test-sim';

type DevGlobal = typeof globalThis & { __DEV__: boolean };
const devGlobal = globalThis as DevGlobal;
const originalDev = devGlobal.__DEV__;
const asReleaseBuild = () => {
  devGlobal.__DEV__ = false;
};

async function storedPrefs(): Promise<Record<string, unknown>> {
  return JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY)) ?? '{}') as Record<string, unknown>;
}

let initialUrl: jest.SpiedFunction<typeof Linking.getInitialURL>;
let linkListeners: ((event: { url: string }) => void)[] = [];

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  linkListeners = [];
  // React Native's jest set-up makes this a spy already: the calls of earlier tests are forgotten here.
  initialUrl = jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  initialUrl.mockClear();
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((_type: string, listener: (event: { url: string }) => void) => {
    linkListeners.push(listener);
    return { remove: () => undefined };
  }) as never);
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  jest.restoreAllMocks();
});

describe('the sources (MD-3): LIVE is the default and the only one offered', () => {
  it('LIVE is the default; the list Settings builds holds LIVE alone', () => {
    expect(DEFAULT_CORE_LINK_SOURCE).toBe('LIVE');
    expect(CORE_LINK_SOURCES).toEqual(['LIVE']);
    expect(getCoreLinkSource()).toBe('LIVE');
  });

  it('pure gate (L5, RT-1, D163): LIVE in every build; a release build allows LIVE only; a debug build keeps the known sources', () => {
    // The three RT-1 asserts of S62 M3-01. Moved pins (D163): before RT-1 a release build answered
    // LIVE false and SIMULATED true.
    expect(isCoreLinkSourceAvailable('SIMULATED', false)).toBe(false);
    expect(isCoreLinkSourceAvailable('LIVE', false)).toBe(true);
    expect(isCoreLinkSourceAvailable('SIMULATED', true)).toBe(true);
    // Release: LIVE alone. Debug: every known source (the `core=` link and the tests), nothing else.
    expect(isCoreLinkSourceAvailable('HEARTBEAT', false)).toBe(false);
    expect(KNOWN_CORE_LINK_SOURCES.filter((source) => isCoreLinkSourceAvailable(source, false))).toEqual(['LIVE']);
    expect(KNOWN_CORE_LINK_SOURCES.filter((source) => isCoreLinkSourceAvailable(source, true))).toEqual(['SIMULATED', 'HEARTBEAT', 'LIVE']);
    expect(isCoreLinkSourceAvailable('CORE' as CoreLinkSource, true)).toBe(false);
    expect(isCoreLinkSourceAvailable('CORE' as CoreLinkSource, false)).toBe(false);
    // An unavailable choice falls back to the default, LIVE (D163: release SIMULATED now reads LIVE).
    expect(effectiveCoreLinkSource('LIVE', false)).toBe('LIVE');
    expect(effectiveCoreLinkSource('LIVE', true)).toBe('LIVE');
    expect(effectiveCoreLinkSource('HEARTBEAT', false)).toBe('LIVE');
    expect(effectiveCoreLinkSource('SIMULATED', false)).toBe('LIVE');
    expect(effectiveCoreLinkSource('HEARTBEAT', true)).toBe('HEARTBEAT');
    expect(effectiveCoreLinkSource('SIMULATED', true)).toBe('SIMULATED');
    // The default argument is the build flag (jest is a debug build).
    expect(isCoreLinkSourceAvailable('LIVE')).toBe(true);
    expect(isCoreLinkSourceAvailable('SIMULATED')).toBe(true);
    expect(effectiveCoreLinkSource('LIVE')).toBe('LIVE');
    asReleaseBuild();
    expect(isCoreLinkSourceAvailable('LIVE')).toBe(true);
    expect(isCoreLinkSourceAvailable('SIMULATED')).toBe(false);
    expect(effectiveCoreLinkSource('HEARTBEAT')).toBe('LIVE');
    expect(effectiveCoreLinkSource('SIMULATED')).toBe('LIVE');
  });

  it('`KNOWN_CORE_LINK_SOURCES` is exported by the runtime index beside `CORE_LINK_SOURCES` (KD-13, M3-01 R4)', () => {
    expect(INDEX_KNOWN_CORE_LINK_SOURCES).toBe(KNOWN_CORE_LINK_SOURCES);
    expect(INDEX_KNOWN_CORE_LINK_SOURCES).toEqual(['SIMULATED', 'HEARTBEAT', 'LIVE']);
    expect(INDEX_CORE_LINK_SOURCES).toEqual(['LIVE']);
  });

  it('the stored value: only LIVE is honoured, every older choice is read as LIVE', () => {
    expect(parseCoreLinkSource(JSON.stringify({ coreLinkSource: 'LIVE' }))).toBe('LIVE');
    expect(parseCoreLinkSource(JSON.stringify({ coreLinkSource: 'HEARTBEAT' }))).toBe('LIVE');
    expect(parseCoreLinkSource(JSON.stringify({ coreLinkSource: 'SIMULATED' }))).toBe('LIVE');
    for (const other of ['live', 'Live', 'CORE', '', null, 1, true, ['LIVE'], { source: 'LIVE' }]) {
      expect(parseCoreLinkSource(JSON.stringify({ coreLinkSource: other }))).toBe('LIVE');
    }
    expect(parseCoreLinkSource(null)).toBe('LIVE');
  });

  it('the link state: HEARTBEAT and LIVE follow the heartbeat they are given, SIMULATED the tablet link', () => {
    for (const source of ['HEARTBEAT', 'LIVE'] as const) {
      expect(coreLinkStateFor(source, 'LIVE', 'OFFLINE')).toBe('ONLINE');
      for (const heartbeat of ['CONNECTING', 'STALE', 'OFFLINE'] as const) expect(coreLinkStateFor(source, heartbeat, 'CONNECTED')).toBe('OFFLINE');
    }
    expect(coreLinkStateFor('SIMULATED', 'OFFLINE', 'CONNECTED')).toBe('ONLINE');
    expect(coreLinkStateFor('SIMULATED', 'LIVE', 'OFFLINE')).toBe('OFFLINE');
  });

  it('a runtime that holds a simulator never reports LIVE', () => {
    expect(simulatorLinkSource('LIVE')).toBe('SIMULATED');
    expect(simulatorLinkSource('HEARTBEAT')).toBe('HEARTBEAT');
    expect(simulatorLinkSource('SIMULATED')).toBe('SIMULATED');
  });

  it('debug: LIVE is stored by merge, and an older stored choice hydrates as LIVE', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ reduceMotion: true, railCollapsed: true }));
    const { result } = renderHook(() => useCoreLinkSource());
    act(() => setCoreLinkSource('LIVE'));
    await flushAsync();
    expect(result.current).toBe('LIVE');
    expect(await storedPrefs()).toEqual({ reduceMotion: true, railCollapsed: true, coreLinkSource: 'LIVE' });

    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'SIMULATED' }));
    resetCoreLinkPrefsForTests();
    expect(getCoreLinkSource()).toBe('LIVE');
    await act(async () => {
      await hydrateCoreLinkSource();
    });
    expect(getCoreLinkSource()).toBe('LIVE');
  });
});

describe('the setter follows the RT-1 rule (L5, D163)', () => {
  it('debug: every known source is reachable through the setter the `core=` link uses, and is stored', async () => {
    const { result } = renderHook(() => useCoreLinkSource());
    for (const source of KNOWN_CORE_LINK_SOURCES) {
      act(() => setCoreLinkSource(source));
      await flushAsync();
      expect(result.current).toBe(source);
      expect((await storedPrefs()).coreLinkSource).toBe(source);
    }
  });

  it('release: `setCoreLinkSource(SIMULATED)` is refused and nothing is written; `setCoreLinkSource(LIVE)` is taken and stored', async () => {
    asReleaseBuild();
    const { result } = renderHook(() => useCoreLinkSource());
    const recordsBefore = runtimeLog.records().length;
    act(() => setCoreLinkSource('SIMULATED'));
    await flushAsync();
    expect(result.current).toBe('LIVE');
    expect(await storedPrefs()).not.toHaveProperty('coreLinkSource');
    expect(runtimeLog.records().slice(recordsBefore).some((record) => record.source === 'runtime.coreLink.unavailableSource' && record.context?.source === 'SIMULATED')).toBe(true);
    act(() => setCoreLinkSource('LIVE'));
    await flushAsync();
    expect(result.current).toBe('LIVE');
    expect(await storedPrefs()).toEqual({ coreLinkSource: 'LIVE' });
  });
});

describe('release build: LIVE only (RT-1, D163; AC-C-28 revised)', () => {
  it('a LIVE value stored by a debug build still hydrates as LIVE, and the stored value is left alone', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'LIVE' }));
    asReleaseBuild();
    const { result } = renderHook(() => useCoreLinkSource());
    await act(async () => {
      await hydrateCoreLinkSource();
    });
    expect(result.current).toBe('LIVE');
    // The stored value is left alone: nothing is deleted when the mode cannot apply (§3.4).
    expect(await storedPrefs()).toEqual({ coreLinkSource: 'LIVE' });
  });

  it('`setCoreLinkSource(HEARTBEAT)` is ignored and nothing is written', async () => {
    asReleaseBuild();
    const { result } = renderHook(() => useCoreLinkSource());
    act(() => setCoreLinkSource('HEARTBEAT'));
    await flushAsync();
    expect(result.current).toBe('LIVE');
    expect(await storedPrefs()).not.toHaveProperty('coreLinkSource');
    expect(runtimeLog.records().some((record) => record.source === 'runtime.coreLink.unavailableSource' && record.context?.source === 'HEARTBEAT')).toBe(true);
  });

  it('the source decision of the runtime is LIVE whatever is stored, and the launch URL is not read', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'HEARTBEAT' }));
    initialUrl.mockResolvedValue('demsdemo:///pair?core=HEARTBEAT');
    asReleaseBuild();
    await expect(decideCoreLinkSource()).resolves.toBe('LIVE');
    // The launch URL was not even read.
    expect(initialUrl).not.toHaveBeenCalled();
  });
});

describe('the connection banner follows the link in LIVE as in HEARTBEAT', () => {
  const link = (source: CoreLinkSource, state: CoreLinkInfo['state'], heartbeat?: CoreLinkInfo['heartbeat']): CoreLinkInfo => ({ source, state, ...(heartbeat ? { heartbeat } : {}) });

  it.each(['HEARTBEAT', 'LIVE'] as const)('%s: CONNECTING is a transient and keeps the banner; OFFLINE and STALE show it; coming back shows "Resynced"', (source) => {
    for (const current of ['hidden', 'offline', 'resynced'] as const) {
      expect(nextBannerKind(current, link(source, 'OFFLINE', 'CONNECTING'))).toBe(current);
    }
    expect(nextBannerKind('hidden', link(source, 'OFFLINE', 'OFFLINE'))).toBe('offline');
    expect(nextBannerKind('hidden', link(source, 'OFFLINE', 'STALE'))).toBe('offline');
    expect(nextBannerKind('offline', link(source, 'ONLINE', 'LIVE'))).toBe('resynced');
    expect(nextBannerKind('hidden', link(source, 'ONLINE', 'LIVE'))).toBe('hidden');
    expect(nextBannerKind('resynced', link(source, 'ONLINE', 'LIVE'))).toBe('resynced');
  });

  it('SIMULATED is as before: the simulator has no CONNECTING state to wait out', () => {
    const kinds: ConnectionBannerKind[] = ['hidden', 'offline', 'resynced'];
    for (const current of kinds) expect(nextBannerKind(current, link('SIMULATED', 'OFFLINE'))).toBe('offline');
    expect(nextBannerKind('offline', link('SIMULATED', 'ONLINE'))).toBe('resynced');
    expect(nextBannerKind('hidden', link('SIMULATED', 'ONLINE'))).toBe('hidden');
    // The rule goes by the source, not by the presence of a heartbeat member.
    expect(nextBannerKind('hidden', link('SIMULATED', 'OFFLINE', 'CONNECTING'))).toBe('offline');
  });
});

describe('the pairing member of the contract (MP-9, MP-11)', () => {
  it('is optional: a contract built without it has no such member, and the gate does not block', () => {
    const contract = createRuntimeContract();
    expect(contract).not.toHaveProperty('pairing');
    expect(isPairingBlocked(contract.pairing)).toBe(false);
    expect(isPairingBlocked(PAIRING_NOT_REQUIRED)).toBe(false);
  });

  it('blocks while a required pairing is not PAIRED, the check included', () => {
    const paired: PairingInfo = { required: true, state: 'PAIRED', notice: null, deviceId: 'DEV-0003' };
    expect(isPairingBlocked(PAIRING_CHECKING)).toBe(true);
    expect(isPairingBlocked({ required: true, state: 'UNPAIRED', notice: 'revoked', deviceId: null })).toBe(true);
    expect(isPairingBlocked(paired)).toBe(false);
    // Not required: never blocked, whatever the state says.
    expect(isPairingBlocked({ ...paired, required: false, state: 'UNPAIRED' })).toBe(false);
    expect(createRuntimeContract({ pairing: paired }).pairing).toBe(paired);
  });
});

describe('the debug parameter `core=` (MD-7, AC-C-32)', () => {
  it.each([
    ['demsdemo:///pair?core=LIVE', 'LIVE'],
    ['demsdemo:///stack-check?motion=slow&core=LIVE', 'LIVE'],
    ['demsdemo:///?core=SIMULATED', 'SIMULATED'],
    ['demsdemo:///home?core=HEARTBEAT#x', 'HEARTBEAT'],
    ['demsdemo:///pair?core=%4CIVE', 'LIVE'],
    ['demsdemo:///pair?core=live', null],
    ['demsdemo:///pair?core=LIVE2', null],
    ['demsdemo:///pair?core=', null],
    ['demsdemo:///pair?score=LIVE', null],
    ['demsdemo:///pair?core=%E0%A4%A', null],
    ['demsdemo:///pair', null],
    [`demsdemo:///pair?x=${'a'.repeat(600)}&core=LIVE`, null],
    [null, null],
  ])('%s → %s', (url, source) => {
    expect(coreSourceFromUrl(url)).toBe(source);
  });

  it('debug build, launch URL: `core=HEARTBEAT` sets and stores the source before the runtime decides its data source', async () => {
    initialUrl.mockResolvedValue('demsdemo:///pair?core=HEARTBEAT');
    await expect(decideCoreLinkSource()).resolves.toBe('HEARTBEAT');
    expect(getCoreLinkSource()).toBe('HEARTBEAT');
    await flushAsync();
    expect(await storedPrefs()).toEqual({ coreLinkSource: 'HEARTBEAT' });
    // Once per process: a second decision does not read the launch URL again.
    await decideCoreLinkSource();
    expect(initialUrl).toHaveBeenCalledTimes(1);
  });

  it('debug build: a launch with `core=SIMULATED` sets the older source over a stored LIVE (RT-1: debug only)', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'LIVE', haptics: false }));
    initialUrl.mockResolvedValue('demsdemo:///?core=SIMULATED');
    await expect(decideCoreLinkSource()).resolves.toBe('SIMULATED');
    await flushAsync();
    expect(await storedPrefs()).toEqual({ coreLinkSource: 'SIMULATED', haptics: false });
  });

  it('a value that is already the source changes and stores nothing', async () => {
    initialUrl.mockResolvedValue('demsdemo:///?core=LIVE');
    await expect(decideCoreLinkSource()).resolves.toBe('LIVE');
    await flushAsync();
    expect(await AsyncStorage.getItem(MOBILE_PREFS_KEY)).toBeNull();
  });

  it('debug build, a later deep link: `core=` switches the source while the app runs', async () => {
    const { sim } = createTestSim();
    const { unmount } = renderHook(() => useDebugScenarioLinks(sim));
    await flushAsync();
    expect(getCoreLinkSource()).toBe('LIVE');
    act(() => linkListeners.forEach((listener) => listener({ url: 'demsdemo:///pair?core=SIMULATED' })));
    expect(getCoreLinkSource()).toBe('SIMULATED');
    act(() => linkListeners.forEach((listener) => listener({ url: 'demsdemo:///home?core=HEARTBEAT' })));
    expect(getCoreLinkSource()).toBe('HEARTBEAT');
    unmount();
  });

  it('release build: `core=HEARTBEAT` does nothing, at launch and as a later link', async () => {
    initialUrl.mockResolvedValue('demsdemo:///pair?core=HEARTBEAT');
    asReleaseBuild();
    await applyLaunchCoreSource();
    const { sim } = createTestSim();
    const { unmount } = renderHook(() => useDebugScenarioLinks(sim));
    await flushAsync();
    // The hook is off in a release build: it reads no URL and listens to none.
    expect(initialUrl).not.toHaveBeenCalled();
    expect(linkListeners).toHaveLength(0);
    expect(getCoreLinkSource()).toBe('LIVE');
    expect(await AsyncStorage.getItem(MOBILE_PREFS_KEY)).toBeNull();
    unmount();
  });

  it('release build: even a hook that is forced on applies no `core=` (the block is under the build flag)', async () => {
    asReleaseBuild();
    const { sim } = createTestSim();
    const { unmount } = renderHook(() => useDebugScenarioLinks(sim, true));
    await flushAsync();
    const recordsBefore = runtimeLog.records().length;
    act(() => linkListeners.forEach((listener) => listener({ url: 'demsdemo:///pair?core=HEARTBEAT' })));
    act(() => linkListeners.forEach((listener) => listener({ url: 'demsdemo:///pair?core=SIMULATED' })));
    expect(getCoreLinkSource()).toBe('LIVE');
    expect(await AsyncStorage.getItem(MOBILE_PREFS_KEY)).toBeNull();
    // "Does nothing": the parameter is not even handed to the preference, which would refuse it and say so.
    expect(runtimeLog.records().slice(recordsBefore).map((record) => record.source)).toEqual([]);
    unmount();
  });
});

describe('what the redeem request says about the device (MP-5)', () => {
  it('the model name, at most 60 characters; "Android device" when the platform gives none; no hardware identifier', () => {
    expect(liveDeviceDescription('sdk_gphone64_arm64', '0.1.0')).toEqual({ deviceName: 'sdk_gphone64_arm64', platform: 'android', appVersion: '0.1.0' });
    expect(liveDeviceDescription('  Pixel Tablet  ', ' 0.2.0 ')).toEqual({ deviceName: 'Pixel Tablet', platform: 'android', appVersion: '0.2.0' });
    const long = liveDeviceDescription(`${'M'.repeat(59)} ${'x'.repeat(40)}`, 'v'.repeat(50));
    expect(long.deviceName).toBe('M'.repeat(59));
    expect(long.deviceName.length).toBeLessThanOrEqual(60);
    expect(long.appVersion).toBe('v'.repeat(32));
    for (const absent of [null, undefined, '', '   ']) {
      expect(liveDeviceDescription(absent, absent)).toEqual({ deviceName: FALLBACK_DEVICE_NAME, platform: 'android', appVersion: 'unknown' });
    }
    expect(FALLBACK_DEVICE_NAME).toBe('Android device');
    expect(Object.keys(liveDeviceDescription('x', 'y')).sort()).toEqual(['appVersion', 'deviceName', 'platform']);
  });
});

describe('`scenario=` in LIVE mode (MD-7, AC-C-32)', () => {
  it('is ignored and logged when the data source is the Live source: no demo control is called', async () => {
    const fake = createFakeTransport();
    const live = createLiveSim({
      client: createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: () => null, fetch: fake.fetch }),
      socket: { url: 'ws://127.0.0.1:4420/ws', factory: fake.socketFactory },
      now: fake.clock.now,
      timers: fake.clock.timers,
      autoStart: false,
    });
    const loadScenario = jest.spyOn(live.actions, 'loadScenario');
    initialUrl.mockResolvedValue('demsdemo:///session/live?scenario=recording');
    const { unmount } = renderHook(() => useDebugScenarioLinks(asSim(live)));
    await flushAsync();
    await flushAsync();
    act(() => linkListeners.forEach((listener) => listener({ url: 'demsdemo:///home?scenario=fault-demo' })));
    await flushAsync();

    expect(loadScenario).not.toHaveBeenCalled();
    // Nothing was sent to the Core server, and nothing was opened.
    expect(fake.log.entries).toHaveLength(0);
    const ignored = runtimeLog.records().filter((record) => record.source === 'runtime.debug.scenario' && record.message.startsWith('Scenario ignored'));
    expect(ignored.map((record) => record.context?.scenario)).toEqual(expect.arrayContaining(['recording', 'fault-demo']));
    unmount();
    fake.assertNoViolations();
  });

  it('is ignored when the same URL asks for LIVE: the simulator that is about to be replaced loads nothing', async () => {
    const { sim } = createTestSim();
    expect(sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const { unmount } = renderHook(() => useDebugScenarioLinks(sim));
    await flushAsync();
    act(() => linkListeners.forEach((listener) => listener({ url: 'demsdemo:///session/live?core=LIVE&scenario=recording' })));
    await flushAsync();
    expect(getCoreLinkSource()).toBe('LIVE');
    expect(sim.store.getState().session).toBeNull();
    unmount();
  });

  it('with the simulator it loads as before', async () => {
    const { sim } = createTestSim();
    const { unmount } = renderHook(() => useDebugScenarioLinks(sim));
    await flushAsync();
    act(() => linkListeners.forEach((listener) => listener({ url: 'demsdemo:///session/live?scenario=recording' })));
    await flushAsync();
    expect(sim.store.getState().session?.state).toBe('RECORDING');
    unmount();
  });
});
