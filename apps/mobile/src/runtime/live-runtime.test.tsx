// Backend task W51: the mobile runtime with its three Core link sources (04_client_integration_spec
// §3.1 MD-3, MD-5, MD-6, §3.4, §7.2, §9.5; AC-C-28 as revised by D163: a release build carries
// LIVE only; AC-C-29).
//
// What is rendered: the real `AppProviders` (so `SimRuntimeProvider` sits where it sits in the
// app, under `HeartbeatProvider` and above `AuthProvider`). What is faked: the transport only. In
// this file the runtime builds its own data source from the Core link preference, as the app does,
// so the fake transport stands where the runtime keeps its own `fetch` and socket constructor
// (`installFakeTransport`): every request and every socket of the run is in the fake's log, and
// "nothing of the Live layer started" is "the log is empty".
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { useCoreMode } from '@dems/shared/live';
import { clockFromTimers, createFakeTransport, installFakeTransport, type FakeClock, type FakeTransport } from '@dems/shared/live/testing';
import { useHeartbeat, type SocketLike } from '@dems/shared/realtime';
import { SIM_STORAGE_KEY, createManualClock, useSim } from '@dems/shared/sim';
import { MOBILE_PREFS_KEY } from '@/motion';
import { AppProviders } from '@/providers';
import { useConnectionBanner } from './connection-banner';
import { useActiveSession, useCoreLink, usePairing, useRuntimeStatus } from './contract';
import { DEFAULT_CORE_ADDRESS, coreOriginOf } from './core-address';
import { resetCoreLinkPrefsForTests, setCoreLinkSource } from './core-link';
import { resetDebugLaunchForTests } from './debug';
import { runtimeLog } from './log';
import * as adapters from './sim-adapters';
import { createMobileSim, mobileLiveOf } from './sim-adapters';
import { useMobileLive, useMobileLiveRuntime } from './sim-runtime-provider';
import { TEST_START, createManualScheduler } from './testing/test-sim';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
};
const AUTH_PREFS_KEY = 'dems.mobile.auth.v1';
// D263 (row 236): the origins of the runtime's address source (its default here). Moved pins: were 'ws://127.0.0.1:4420/ws' and
// 'http://127.0.0.1:4420/api/v1/'.
const CORE_SOCKET_URL = coreOriginOf(DEFAULT_CORE_ADDRESS).ws;
const CORE_API_PREFIX = `${coreOriginOf(DEFAULT_CORE_ADDRESS).http}/api/v1/`;

type DevGlobal = typeof globalThis & { __DEV__: boolean };
const devGlobal = globalThis as DevGlobal;
const originalDev = devGlobal.__DEV__;

/** The mock-core heartbeat socket of `HeartbeatProvider`, counted apart from the Core server's sockets. */
class MockCoreSocket implements SocketLike {
  readyState = 0;
  closed = false;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
    this.closed = true;
  }
  beat(seq: number) {
    this.readyState = 1;
    this.onmessage?.({
      data: JSON.stringify({ type: 'heartbeat', v: 1, seq, serverTime: '2026-10-01T03:00:00.000Z', uptimeMs: seq * 1000, intervalMs: 1000, clients: 1, sessionState: null }),
    });
  }
}

let fake: FakeTransport<FakeClock>;
let restoreTransport: () => void = () => undefined;
let mockCoreSockets: MockCoreSocket[] = [];

/** Everything the tests look at, as one line of text. */
function Probe() {
  const status = useRuntimeStatus();
  const link = useCoreLink();
  const pairing = usePairing();
  const banner = useConnectionBanner();
  const beat = useHeartbeat();
  const mode = useCoreMode();
  const live = useMobileLive();
  const runtime = useMobileLiveRuntime();
  const auth = useSim((s) => s.auth.status);
  const operators = useSim((s) => s.operators.length);
  const session = useActiveSession();
  return (
    <Text testID="probe">
      {[
        `ready=${status.ready}`,
        `impl=${status.implementation}`,
        `link=${link.source}/${link.state}/${link.heartbeat ?? '-'}`,
        `pairing=${pairing.required ? 'required' : 'free'}/${pairing.state}/${pairing.notice ?? '-'}/${pairing.deviceId ?? '-'}`,
        `banner=${banner.kind}`,
        `mode=${mode}`,
        `beat=${beat.state}/${beat.seq ?? '-'}`,
        `live=${live ? 'yes' : 'no'}/${runtime ? 'adapters' : 'none'}`,
        `auth=${auth}`,
        `operators=${operators}`,
        `session=${session.state ?? 'none'}`,
        `restored=${status.restored === true}`,
      ].join(' ')}
    </Text>
  );
}
const probe = () => screen.getByTestId('probe').props.children as string;

/** Lets promise jobs settle inside `act`: storage reads, the fake's answers, the connect scripts. */
async function settle(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

function mountApp() {
  return render(
    <AppProviders
      safeAreaMetrics={METRICS}
      heartbeatSocketFactory={() => {
        const socket = new MockCoreSocket();
        mockCoreSockets.push(socket);
        return socket;
      }}
    >
      <Probe />
    </AppProviders>,
  );
}

/** A simulator snapshot and the simulated auth binding, as an earlier Simulated run left them. */
async function seedSimulatedRun(): Promise<{ snapshot: string; authPrefs: string }> {
  const earlier = createMobileSim({ clock: createManualClock(TEST_START), scheduler: createManualScheduler().scheduler });
  await earlier.ready;
  earlier.actions.loadScenario('recording');
  earlier.flush();
  earlier.stop();
  await AsyncStorage.setItem(AUTH_PREFS_KEY, JSON.stringify({ lastOperatorId: 'OPR-001', biometricEnabled: true }));
  const snapshot = await AsyncStorage.getItem(SIM_STORAGE_KEY);
  const authPrefs = await AsyncStorage.getItem(AUTH_PREFS_KEY);
  if (snapshot === null || authPrefs === null) throw new Error('the seed of the Simulated run is missing');
  expect(snapshot).toContain('RECORDING');
  return { snapshot, authPrefs };
}

const coreSockets = () => fake.connections.filter((connection) => connection.url === CORE_SOCKET_URL);

/**
 * The Core server as an unpaired tablet meets it: no session (401), the lock state, and on every
 * socket `hello` ANONYMOUS followed by the connect-time heartbeat the server sends.
 */
function scriptUnpairedCore(): void {
  fake.scriptAnonymousStart();
  fake.onConnect((connection) => {
    if (connection.state === 'OPEN') connection.heartbeat();
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  mockCoreSockets = [];
  // The fake's time is the runner's: the Live source this file mounts takes its clock and its
  // timers from the runtime, as in the app.
  fake = createFakeTransport({
    clock: clockFromTimers({ now: () => Date.now(), setTimeout: (task, ms) => setTimeout(task, ms), clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) }),
  });
  restoreTransport = installFakeTransport(fake);
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  restoreTransport();
  jest.useRealTimers();
  // What a client under test swallowed still fails the test.
  fake.assertNoViolations();
});

describe('SIMULATED and HEARTBEAT: nothing of the Live layer starts (MD-5, SC8)', () => {
  it.each(['SIMULATED', 'HEARTBEAT'] as const)('%s with the simulator the runtime creates: no request, no socket to the Core server, no Live source', async (source) => {
    setCoreLinkSource(source); // the device default is LIVE since 2026-11-05
    const { unmount } = mountApp();
    await settle();
    expect(probe()).toContain(`link=${source}/`);
    expect(probe()).toContain('impl=simulator');
    expect(probe()).toContain('pairing=free/UNPAIRED/-/-');
    expect(probe()).toContain('mode=SIMULATED live=no/none'.replace(' live', ' beat=CONNECTING/- live'));
    // The transport spies: `fetch` and the socket constructor of the runtime were never called.
    expect(fake.calls).toHaveLength(0);
    expect(fake.connections).toHaveLength(0);
    // The mock-core heartbeat client is the one of `HeartbeatProvider`, running as before.
    expect(mockCoreSockets).toHaveLength(1);
    expect(mockCoreSockets[0]!.closed).toBe(false);
    unmount();
    expect(fake.calls).toHaveLength(0);
    expect(fake.connections).toHaveLength(0);
  });

  it('a SIMULATED preference starts the simulator and reads its snapshot', async () => {
    setCoreLinkSource('SIMULATED'); // the device default is LIVE since 2026-11-05
    const { snapshot } = await seedSimulatedRun();
    const { unmount } = mountApp();
    await settle();
    expect(probe()).toContain('ready=true impl=simulator link=SIMULATED/ONLINE/-');
    // The session of the earlier run is back: the snapshot WAS read.
    expect(snapshot).toContain('RECORDING');
    expect(probe()).toContain('session=RECORDING restored=true');
    unmount();
    expect(fake.log.entries).toHaveLength(0);
  });
});

describe('LIVE: the Live source is the data source (MD-5, AC-C-29)', () => {
  it('a stored LIVE at a cold start: the Live source runs, the simulator never reads or writes its snapshot, the mock-core client is stopped', async () => {
    const { snapshot, authPrefs } = await seedSimulatedRun();
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'LIVE', haptics: false }));
    scriptUnpairedCore();
    // The storage mock's functions are spies already: forget the calls of the seeding above.
    const reads = jest.spyOn(AsyncStorage, 'getItem');
    const writes = jest.spyOn(AsyncStorage, 'setItem');
    reads.mockClear();
    writes.mockClear();

    const { unmount } = mountApp();
    // First frame: the preference is not read yet; LIVE is the default, so the Live source is there at once.
    expect(probe()).toContain('ready=false impl=live link=LIVE/');
    await settle();

    expect(probe()).toContain('ready=true impl=live link=LIVE/ONLINE/LIVE');
    expect(probe()).toContain('pairing=required/UNPAIRED/-/-');
    expect(probe()).toContain('mode=LIVE');
    expect(probe()).toContain('live=yes/adapters');
    // A signed-out, unpaired client holds no Core data.
    expect(probe()).toContain('auth=SIGNED_OUT operators=0 session=none restored=false');

    // The one socket is the Core server's; it carries no credential (nothing is stored).
    expect(coreSockets()).toHaveLength(1);
    expect(coreSockets()[0]!.headers).toEqual({});
    expect(fake.log.operationIds()).toEqual(expect.arrayContaining(['getAuthSession', 'getSignInStatus']));
    for (const call of fake.calls) {
      expect(call.url.startsWith(CORE_API_PREFIX)).toBe(true);
      expect(call.credentials).toBe('omit');
      expect(call.headers.authorization).toBeUndefined();
      expect(call.headers.cookie).toBeUndefined();
    }

    // MD-5: the simulator's snapshot was not read and not written; the simulated auth binding is not written.
    expect(reads.mock.calls.map(([key]) => key)).not.toContain(SIM_STORAGE_KEY);
    expect(writes.mock.calls.map(([key]) => key)).not.toContain(SIM_STORAGE_KEY);
    expect(writes.mock.calls.map(([key]) => key)).not.toContain(AUTH_PREFS_KEY);

    // CL-7: one socket. The mock-core client was stopped; the heartbeat the app reads is the Live socket's.
    expect(mockCoreSockets.every((socket) => socket.closed)).toBe(true);
    act(() => {
      fake.connection().heartbeat();
    });
    expect(probe()).toMatch(/beat=LIVE\/\d+/);

    unmount();
    await settle();
    // AC-C-29: byte-equal after the Live session.
    expect(await AsyncStorage.getItem(SIM_STORAGE_KEY)).toBe(snapshot);
    expect(await AsyncStorage.getItem(AUTH_PREFS_KEY)).toBe(authPrefs);
    expect(JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY))!)).toEqual({ coreLinkSource: 'LIVE', haptics: false });
    // The source was stopped with the provider: its socket is closed by the client.
    expect(coreSockets()[0]!.closed).toMatchObject({ by: 'client' });
  });

  it('crossing the LIVE boundary swaps the data source; SIMULATED and HEARTBEAT share the simulator', async () => {
    scriptUnpairedCore();
    setCoreLinkSource('SIMULATED'); // the device default is LIVE since 2026-11-05
    const { unmount } = mountApp();
    await settle();
    expect(probe()).toContain('impl=simulator link=SIMULATED/ONLINE/-');
    expect(mockCoreSockets).toHaveLength(1);
    expect(fake.log.entries).toHaveLength(0);

    act(() => setCoreLinkSource('LIVE'));
    // The mock-core client is stopped in the commit that mounts the Live source, not some time later …
    expect(mockCoreSockets.every((socket) => socket.closed)).toBe(true);
    await settle();
    expect(probe()).toContain('impl=live link=LIVE/ONLINE/LIVE');
    expect(coreSockets()).toHaveLength(1);
    // … and it stays stopped while in LIVE.
    expect(mockCoreSockets.every((socket) => socket.closed)).toBe(true);
    const liveSocket = coreSockets()[0]!;

    act(() => setCoreLinkSource('HEARTBEAT'));
    await settle();
    // … and started again on leaving it. The Live source is stopped: no second Core socket.
    expect(probe()).toContain('impl=simulator link=HEARTBEAT/OFFLINE/CONNECTING');
    expect(liveSocket.closed).toMatchObject({ by: 'client' });
    expect(mockCoreSockets.filter((socket) => !socket.closed)).toHaveLength(1);
    const requestsAfterLive = fake.calls.length;

    act(() => mockCoreSockets[mockCoreSockets.length - 1]!.beat(1));
    expect(probe()).toContain('link=HEARTBEAT/ONLINE/LIVE');
    act(() => setCoreLinkSource('SIMULATED'));
    await settle();
    expect(probe()).toContain('impl=simulator link=SIMULATED/ONLINE/-');
    expect(coreSockets()).toHaveLength(1);
    expect(fake.calls).toHaveLength(requestsAfterLive);
    unmount();
  });

  it('an injected simulator is used as it is: a LIVE preference then reads as SIMULATED and no Live source is built', async () => {
    setCoreLinkSource('LIVE');
    const sim = createMobileSim({ storage: null, clock: createManualClock(TEST_START), scheduler: createManualScheduler().scheduler });
    const { unmount } = render(
      <AppProviders sim={sim} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
        <Probe />
      </AppProviders>,
    );
    await settle();
    expect(probe()).toContain('impl=simulator link=SIMULATED/ONLINE/-');
    expect(probe()).toContain('pairing=free/');
    expect(mobileLiveOf(sim)).toBeNull();
    expect(fake.log.entries).toHaveLength(0);
    unmount();
    sim.stop();
  });
});

// M3-02 (row 174, RT-1, D163): the release cases (a), (b) and (d) are inverted. Before M3-02 a release
// build held no Live source (MD-6): a stored LIVE started the simulator from its snapshot (a), a LIVE
// preference was not followed (b, row 170's interim MD-6 pin), and `createMobileLive()` was `null` (d).
// Since D163 a release build carries LIVE only and builds its Live source as a debug build does. The
// defensive MD-6 fallback (c) stays pinned with an injected `null`.
describe('release build: LIVE only, the Live source is built (RT-1, D163; AC-C-28 revised)', () => {
  it('(a) a LIVE value stored by an earlier build starts the Live source in release: the simulator snapshot is neither read nor written', async () => {
    const { snapshot } = await seedSimulatedRun();
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'LIVE' }));
    scriptUnpairedCore();
    devGlobal.__DEV__ = false;
    const reads = jest.spyOn(AsyncStorage, 'getItem');
    const writes = jest.spyOn(AsyncStorage, 'setItem');
    reads.mockClear();
    writes.mockClear();
    const { unmount } = mountApp();
    await settle();
    // Moved pin (D163): was `impl=simulator link=SIMULATED/ONLINE/-`, `live=no/none`, `restored=true`.
    expect(probe()).toContain('ready=true impl=live link=LIVE/ONLINE/LIVE');
    expect(probe()).toContain('pairing=required/UNPAIRED/-/-');
    expect(probe()).toContain('live=yes/adapters');
    expect(probe()).toContain('session=none restored=false');
    // The one Core socket, with no credential (nothing is stored); every request goes to the loopback Core.
    expect(coreSockets()).toHaveLength(1);
    expect(coreSockets()[0]!.headers).toEqual({});
    for (const call of fake.calls) expect(call.url.startsWith(CORE_API_PREFIX)).toBe(true);
    // MD-5 holds in release too: the simulator's snapshot is neither read nor written.
    expect(reads.mock.calls.map(([key]) => key)).not.toContain(SIM_STORAGE_KEY);
    expect(writes.mock.calls.map(([key]) => key)).not.toContain(SIM_STORAGE_KEY);
    unmount();
    await settle();
    expect(await AsyncStorage.getItem(SIM_STORAGE_KEY)).toBe(snapshot);
    // The stored value is left as it is (§3.4).
    expect(JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY))!)).toEqual({ coreLinkSource: 'LIVE' });
  });

  // S62 §3.15 #15 (D160, D163): row 170's interim MD-6 pin ("falls back to the simulator ... until M3-02")
  // is inverted here by row 174: the LIVE preference that reaches the runtime in a release build is followed.
  it('(b) a LIVE preference that reaches the runtime in a release build is followed: `createMobileLive` builds the Live source, no MD-6 warning', async () => {
    scriptUnpairedCore();
    setCoreLinkSource('LIVE');
    devGlobal.__DEV__ = false;
    const built = jest.spyOn(adapters, 'createMobileLive');
    const unavailableBefore = runtimeLog.records().filter((record) => record.source === 'runtime.live.unavailable').length;
    const { unmount } = mountApp();
    await settle();
    expect(built).toHaveBeenCalled();
    // Moved pin (D163): every result was `null` before M3-02.
    expect(built.mock.results.every((result) => result.type === 'return' && result.value !== null)).toBe(true);
    expect(probe()).toContain('ready=true impl=live link=LIVE/ONLINE/LIVE');
    expect(probe()).toContain('live=yes/adapters');
    expect(coreSockets()).toHaveLength(1);
    // The mock-core heartbeat client is stopped (CL-7), as in a debug build.
    expect(mockCoreSockets.every((socket) => socket.closed)).toBe(true);
    expect(runtimeLog.records().filter((record) => record.source === 'runtime.live.unavailable').length).toBe(unavailableBefore);
    unmount();
    built.mockRestore();
  });

  // (c) kept as the defensive pin (I63 §4.2): the null path of `createMobileLive`'s type survives in the provider.
  it('(c) defensive MD-6: if `createMobileLive` gave no Live source, LIVE falls back to the simulator, and the log says so', async () => {
    // What a release bundle holds in place of the adapters: a function that returns null.
    const none = jest.spyOn(adapters, 'createMobileLive').mockReturnValue(null);
    setCoreLinkSource('LIVE');
    const { unmount } = mountApp();
    await settle();
    expect(none).toHaveBeenCalled();
    expect(probe()).toContain('ready=true impl=simulator link=SIMULATED/ONLINE/-');
    expect(probe()).toContain('pairing=free/');
    expect(probe()).toContain('live=no/none');
    // The mock-core heartbeat client keeps running: nothing of LIVE mode took effect.
    expect(mockCoreSockets.filter((socket) => !socket.closed)).toHaveLength(1);
    expect(fake.log.entries).toHaveLength(0);
    expect(runtimeLog.records().some((record) => record.source === 'runtime.live.unavailable' && record.level === 'warn')).toBe(true);
    unmount();
    none.mockRestore();
  });

  it('(d) `createMobileLive` builds the Live source in a release build, and sends nothing before `start()`', () => {
    devGlobal.__DEV__ = false;
    // Loaded here, so the module sees the flag at call time, as the release bundle sees its constant.
    const { createMobileLive } = jest.requireActual<typeof import('./sim-adapters')>('./sim-adapters');
    const built = createMobileLive();
    // Moved pin (D163): was `toBeNull()` before M3-02.
    expect(built).not.toBeNull();
    expect(built!.live).toBeDefined();
    expect(built!.sim).toBeDefined();
    expect(mobileLiveOf(built!.sim)).toBe(built);
    // MD-5: creating it sends nothing and opens no socket.
    expect(fake.log.entries).toHaveLength(0);
    expect(fake.connections).toHaveLength(0);
    built!.stop();
  });
});

describe('the runtime log of a LIVE start', () => {
  it('holds no credential, and says the Live source is ready', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'LIVE' }));
    scriptUnpairedCore();
    const { unmount } = mountApp();
    await settle();
    const records = runtimeLog.records();
    expect(records.some((record) => record.source === 'runtime.live.ready' && record.context?.pairing === 'UNPAIRED')).toBe(true);
    expect(JSON.stringify(records)).not.toMatch(/(?:dvc|ses|bio)_/);
    unmount();
  });
});
