// SimRuntimeProvider (04_mobile_specs §3.2 slot 9, §5.2, §5.5, §6.6): the hydration gate, the
// Core link in both modes with the connection banner (MA-10 unit form), keep-awake (MA-19 unit
// form) and the debug-build `&scenario=` deep links.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import * as KeepAwake from 'expo-keep-awake';
import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { DEMO_OPERATOR_PASSWORD, createManualClock, selectPrecheck, useSim } from '@dems/shared/sim';
import { resetAuthPrefsForTests } from '@/auth';
import { useActiveSession, useCoreLink, useRuntimeStatus } from './contract';
import { RESYNCED_BANNER_MS, useConnectionBanner } from './connection-banner';
import { resetCoreLinkPrefsForTests, setCoreLinkSource } from './core-link';
import { scenarioFromUrl, type DemsDebugHandle } from './debug';
import { createKeepAwakeManager, KEEP_AWAKE_TAG, KeepAwakeController, shouldKeepAwake } from './keep-awake';
import { createAsyncStoragePersistStorage, createMobileSim } from './sim-adapters';
import { FakeHeartbeatSocket, RuntimeTestProviders, TEST_START, createManualScheduler, createTestSim, flushAsync } from './testing/test-sim';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetAuthPrefsForTests();
  jest.mocked(KeepAwake.activateKeepAwakeAsync).mockClear();
  jest.mocked(KeepAwake.deactivateKeepAwake).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Every runtime value the tests look at, as one line of text. */
function Probe() {
  const status = useRuntimeStatus();
  const link = useCoreLink();
  const session = useActiveSession();
  const banner = useConnectionBanner();
  const tablet = useSim((s) => s.tabletLink.state);
  return (
    <Text testID="probe">
      {[
        `ready=${status.ready}`,
        `link=${link.source}/${link.state}/${link.heartbeat ?? '-'}`,
        `banner=${banner.kind}`,
        `tablet=${tablet}`,
        `session=${session.state ?? 'none'}`,
      ].join(' ')}
    </Text>
  );
}
const probe = () => screen.getByTestId('probe').props.children as string;

describe('hydration gate (04 §5.2, §3.2)', () => {
  it('reports ready only after the AsyncStorage snapshot has hydrated, and exposes the restored session', async () => {
    // A recording saved by an earlier run.
    const earlier = createMobileSim({ clock: createManualClock(TEST_START), scheduler: createManualScheduler().scheduler });
    await earlier.ready;
    earlier.actions.loadScenario('recording');
    earlier.flush();
    earlier.stop();

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sim = createMobileSim({
      clock: createManualClock(TEST_START + 5_000),
      scheduler: createManualScheduler().scheduler,
      storage: createAsyncStoragePersistStorage({
        getItem: async (key) => {
          await gate;
          return AsyncStorage.getItem(key);
        },
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        removeItem: (key) => AsyncStorage.removeItem(key),
      }),
    });
    render(
      <RuntimeTestProviders sim={sim}>
        <Probe />
      </RuntimeTestProviders>,
    );
    await flushAsync();
    expect(probe()).toContain('ready=false');

    release();
    await flushAsync();
    await flushAsync();
    expect(probe()).toContain('ready=true');
    expect(probe()).toContain('session=RECORDING');
    sim.stop();
  });
});

describe('Core link, SIMULATED mode (default, Q-M8)', () => {
  it('follows the simulator tablet link; a demo drop shows the banner, a reconnect shows "Resynced" for 3 s', async () => {
    jest.useFakeTimers();
    const { sim } = createTestSim();
    render(
      <RuntimeTestProviders sim={sim}>
        <Probe />
      </RuntimeTestProviders>,
    );
    await flushAsync();
    expect(probe()).toBe('ready=true link=SIMULATED/ONLINE/- banner=hidden tablet=CONNECTED session=none');

    act(() => sim.actions.setTabletLink('OFFLINE'));
    expect(probe()).toContain('link=SIMULATED/OFFLINE/-');
    expect(probe()).toContain('banner=offline');

    act(() => sim.actions.setTabletLink('CONNECTED'));
    expect(probe()).toContain('banner=resynced');
    act(() => {
      jest.advanceTimersByTime(RESYNCED_BANNER_MS);
    });
    expect(probe()).toContain('banner=hidden');
  });
});

describe('Core link, HEARTBEAT mode (MA-10 unit form)', () => {
  it('drives the tablet link from the heartbeat: offline banner and precheck CORE BLOCK, then Resynced', async () => {
    jest.useFakeTimers();
    setCoreLinkSource('HEARTBEAT');
    const { sim, advance } = createTestSim();
    const sockets: FakeHeartbeatSocket[] = [];
    const onHeartbeatResync = jest.fn();
    render(
      <RuntimeTestProviders sim={sim} sockets={sockets} onHeartbeatResync={onHeartbeatResync}>
        <Probe />
      </RuntimeTestProviders>,
    );
    await flushAsync();
    // CONNECTING: the contract says OFFLINE, but the banner waits and the tablet link is untouched.
    expect(probe()).toBe('ready=true link=HEARTBEAT/OFFLINE/CONNECTING banner=hidden tablet=CONNECTED session=none');

    act(() => sockets[0]!.beat(1));
    expect(probe()).toContain('link=HEARTBEAT/ONLINE/LIVE banner=hidden tablet=CONNECTED');

    // mock-core stops: the socket closes.
    act(() => sockets[0]!.drop());
    expect(probe()).toContain('link=HEARTBEAT/OFFLINE/OFFLINE banner=offline tablet=OFFLINE');
    const lastAudit = sim.store.getState().audit.rows.at(-1)!;
    expect(lastAudit.type).toBe('TABLET_LINK_CHANGED');

    // The precheck Core check blocks while the Core link is down (§4.4 step 2).
    act(() => {
      sim.actions.signIn('budi.santoso', 'demo-2026');
      sim.actions.createSession({
        caseNumber: 'LP/2026/1001-0007',
        subjectName: 'Ahmad Fauzi',
        subjectType: 'TERSANGKA',
        investigatorId: 'OPR-001',
        room: 'Interview Room 1',
        profileId: 'STANDARD_1080P25',
      });
      sim.actions.beginPrecheck();
      advance(6_000);
    });
    const core = selectPrecheck(sim.store.getState())!.items.find((item) => item.id === 'CORE')!;
    expect(core.status).toBe('BLOCK');

    // mock-core is back: the client reconnects after its backoff and delivers a beat.
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    const latest = sockets[sockets.length - 1]!;
    expect(sockets.length).toBeGreaterThan(1);
    act(() => latest.beat(2));
    expect(probe()).toContain('link=HEARTBEAT/ONLINE/LIVE banner=resynced tablet=CONNECTED');
    expect(onHeartbeatResync).toHaveBeenCalledTimes(1);
    // Beats keep coming once a second (a gap of 2.5 s would make the link STALE → OFFLINE).
    for (let seq = 3; seq < 3 + RESYNCED_BANNER_MS / 1000; seq += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
        latest.beat(seq);
      });
    }
    expect(probe()).toContain('link=HEARTBEAT/ONLINE/LIVE banner=hidden');

    // Back to SIMULATED: the simulated link is reconnected.
    act(() => sockets[sockets.length - 1]!.drop());
    expect(probe()).toContain('tablet=OFFLINE');
    act(() => setCoreLinkSource('SIMULATED'));
    expect(probe()).toContain('link=SIMULATED/ONLINE/- ');
    expect(probe()).toContain('tablet=CONNECTED');
    expect(await AsyncStorage.getItem('dems.mobile.prefs.v1')).toBe(JSON.stringify({ coreLinkSource: 'SIMULATED' }));
  });

  it('keeps the other owners’ fields of dems.mobile.prefs.v1 when writing the source (D57)', async () => {
    await AsyncStorage.setItem('dems.mobile.prefs.v1', JSON.stringify({ reduceMotion: true, haptics: false, railCollapsed: true }));
    setCoreLinkSource('HEARTBEAT');
    await flushAsync();
    expect(JSON.parse((await AsyncStorage.getItem('dems.mobile.prefs.v1'))!)).toEqual({
      reduceMotion: true,
      haptics: false,
      railCollapsed: true,
      coreLinkSource: 'HEARTBEAT',
    });
  });
});

describe('keep-awake (04 §6.6; MA-19 unit form)', () => {
  it('maps the session states', () => {
    expect(['PRECHECK', 'ARMED', 'RECORDING', 'STOPPING', 'FINALIZING'].every((s) => shouldKeepAwake(s as never))).toBe(true);
    expect([null, 'CREATE', 'SEALED', 'FAULT', 'RECOVERY'].some((s) => shouldKeepAwake(s as never))).toBe(false);
  });

  it('holds the tag while any holder wants it', () => {
    const api = { activate: jest.fn(async () => undefined), deactivate: jest.fn(async () => undefined) };
    const manager = createKeepAwakeManager(api);
    manager.set('runtime', true);
    manager.set('app', true);
    expect(api.activate).toHaveBeenCalledTimes(1);
    manager.set('app', false);
    expect(api.deactivate).not.toHaveBeenCalled();
    manager.set('runtime', false);
    expect(api.deactivate).toHaveBeenCalledWith(KEEP_AWAKE_TAG);
    expect(manager.isHeld()).toBe(false);
  });

  it('keeps the screen on through recording and finalizing, releases it once sealed, and survives sign-out', async () => {
    const { sim, advance } = createTestSim();
    function Harness() {
      const [appMounted, setAppMounted] = useState(true);
      return (
        <>
          {appMounted ? <KeepAwakeController /> : null}
          <Text testID="unmount-app" onPress={() => setAppMounted(false)}>
            x
          </Text>
        </>
      );
    }
    render(
      <RuntimeTestProviders sim={sim}>
        <Harness />
      </RuntimeTestProviders>,
    );
    await flushAsync();
    expect(KeepAwake.activateKeepAwakeAsync).not.toHaveBeenCalled();

    act(() => sim.actions.loadScenario('recording'));
    expect(KeepAwake.activateKeepAwakeAsync).toHaveBeenCalledWith(KEEP_AWAKE_TAG);

    // `(app)` unmounts (sign-out) while recording: the runtime's own holder keeps the tag.
    act(() => screen.getByTestId('unmount-app').props.onPress());
    expect(KeepAwake.deactivateKeepAwake).not.toHaveBeenCalled();

    // Step 54: stopRecording needs a signed-in operator with SESSION_START (SimPermissionError
    // NOT_SIGNED_IN otherwise), so a permitted operator (the demo investigator) signs in to stop it;
    // the sign-in alone does not touch the keep-awake tag.
    act(() => {
      expect(sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    });
    expect(KeepAwake.deactivateKeepAwake).not.toHaveBeenCalled();
    act(() => sim.actions.stopRecording('Interview complete'));
    expect(KeepAwake.deactivateKeepAwake).not.toHaveBeenCalled(); // STOPPING, FINALIZING still hold
    act(() => advance(10_000));
    expect(sim.store.getState().session?.state).toBe('SEALED');
    expect(KeepAwake.deactivateKeepAwake).toHaveBeenCalledWith(KEEP_AWAKE_TAG);
    expect(KeepAwake.activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
  });
});

describe('debug builds: &scenario= deep links (04 §3.5)', () => {
  it.each([
    ['demsdemo:///session/live?scenario=recording', 'recording'],
    ['demsdemo:///home?debug=1&scenario=fault-demo', 'fault-demo'],
    ['demsdemo:///home?scenario=finalizing#x', 'finalizing'],
    ['demsdemo:///home?scenario=idle', 'idle'],
    ['demsdemo:///home?scenario=../../etc', null],
    ['demsdemo:///home?scenario=Recording', null],
    ['demsdemo:///home?notscenario=recording', null],
    ['demsdemo:///home', null],
    [null, null],
  ])('%s → %s', (url, scenario) => {
    expect(scenarioFromUrl(url)).toBe(scenario);
  });

  it('loads the launch URL’s scenario after hydration, keeps the operator, and publishes the debug handle', async () => {
    const spy = jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('demsdemo:///session/live?scenario=recording');
    const { sim } = createTestSim();
    sim.actions.signIn('budi.santoso', 'demo-2026');
    const { unmount } = render(
      <RuntimeTestProviders sim={sim}>
        <Probe />
      </RuntimeTestProviders>,
    );
    await flushAsync();
    await flushAsync();
    expect(probe()).toContain('session=RECORDING');
    expect(sim.store.getState().auth.status).toBe('SIGNED_IN');
    const handle = (globalThis as { __DEMS_DEBUG__?: DemsDebugHandle }).__DEMS_DEBUG__;
    expect(handle?.sim).toBe(sim);
    expect(handle?.runtime()).toMatchObject({
      status: { ready: true },
      coreLink: { source: 'SIMULATED', state: 'ONLINE' },
      banner: 'hidden',
    });
    // D54 (d) proof vector: SHA-256("abc") through the simulator's @noble/hashes path.
    expect(handle?.sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    unmount();
    expect((globalThis as { __DEMS_DEBUG__?: unknown }).__DEMS_DEBUG__).toBeUndefined();
    spy.mockRestore();
  });
});
