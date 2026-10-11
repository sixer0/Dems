// T-M07 (04_mobile_specs §10.1; MA-08): the mobile simulator adapters — AsyncStorage round trip,
// no tick before hydration, AppState pause and resume. Uses the AsyncStorage 2.2.0 jest mock
// (jest.setup.ts) and the shared engine through `createMobileSim`, with a manual clock and scheduler.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTH_STORAGE_KEY,
  DEMO_OPERATOR_PASSWORD,
  createManualClock,
  createSim,
  ENGINE_INTERVAL_MS,
  selectElapsedMs,
  type Sim,
} from '@dems/shared/sim';
import {
  SIM_SNAPSHOT_KEY,
  createAppStateVisibility,
  createAsyncStoragePersistStorage,
  createMobileSim,
  isHiddenAppState,
  type AppStateLike,
} from './sim-adapters';
import { TEST_START, createManualScheduler } from './testing/test-sim';

/** An AppState the test drives: `set()` changes `currentState` and fires `change`. */
function fakeAppState(initial = 'active') {
  const listeners = new Set<(state: string) => void>();
  const appState: AppStateLike & { set(next: string): void; listenerCount(): number } = {
    currentState: initial,
    addEventListener(_type, listener) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    set(next) {
      (this as { currentState: string }).currentState = next;
      for (const listener of [...listeners]) listener(next);
    },
    listenerCount: () => listeners.size,
  };
  return appState;
}

/** The stored snapshot, parsed (zustand persist writes `{ state, version }`). */
async function storedSnapshot(): Promise<{ version: number; state: Record<string, unknown> } | null> {
  const raw = await AsyncStorage.getItem(SIM_SNAPSHOT_KEY);
  return raw ? (JSON.parse(raw) as { version: number; state: Record<string, unknown> }) : null;
}

function mobileSim(options: { appState?: AppStateLike; storage?: ReturnType<typeof createAsyncStoragePersistStorage> } = {}) {
  const clock = createManualClock(TEST_START);
  const scheduler = createManualScheduler();
  const sim = createMobileSim({
    clock,
    scheduler: scheduler.scheduler,
    visibility: createAppStateVisibility(options.appState ?? fakeAppState()),
    ...(options.storage ? { storage: options.storage } : {}),
  });
  built.push(sim);
  return { sim, clock, scheduler };
}

/**
 * Every simulator this file builds is stopped when its case ends. These are the app's own simulators
 * (`createMobileSim`, the global timers): one that changed its store and was not stopped left the
 * store's 1 s snapshot timer pending behind the file, and a Jest worker that ended on it was "force
 * exited" (test/14_consolidation_mobile.md). `stop()` writes the pending snapshot and clears the timer.
 */
const built: Sim[] = [];
afterEach(() => {
  for (const sim of built.splice(0)) sim.stop();
});

const sessionOf = (sim: Sim) => sim.store.getState().session;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('AsyncStorage persistence (04 §5.3 key dems.sim.v1)', () => {
  it('round-trips a recording session through AsyncStorage and resumes it after a relaunch', async () => {
    const first = mobileSim();
    await first.sim.ready;
    expect(first.sim.wasRestored()).toBe(false);
    first.sim.actions.loadScenario('recording');
    const recording = sessionOf(first.sim)!;
    expect(recording.state).toBe('RECORDING');
    const historyBefore = first.sim.store.getState().sessionHistory.length;
    first.sim.flush();

    const snapshot = await storedSnapshot();
    // SH-10: SIM_SNAPSHOT_VERSION is 2 since RECON-F2a; the envelope carries that version.
    expect(snapshot?.version).toBe(2);
    expect((snapshot?.state.session as { id: string; state: string }).state).toBe('RECORDING');
    // The audio, clock and auth slices are never persisted; neither is an operator record (§6.4).
    expect(snapshot?.state).not.toHaveProperty('audio');
    expect(snapshot?.state).not.toHaveProperty('clock');
    expect(snapshot?.state).not.toHaveProperty('auth');
    expect(await AsyncStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    first.sim.stop();

    // "force-stop and relaunch": a new simulator on the same storage, 90 s later.
    const second = mobileSim();
    second.clock.set(TEST_START + 90_000);
    expect(second.sim.isReady()).toBe(false); // AsyncStorage is asynchronous
    await second.sim.ready;
    expect(second.sim.wasRestored()).toBe(true);
    const resumed = sessionOf(second.sim)!;
    expect(resumed).toMatchObject({ id: recording.id, state: 'RECORDING', startedAt: recording.startedAt });
    // The timer derives from the simulator clock (S4): it kept running while the app was gone.
    second.sim.tick();
    expect(selectElapsedMs(second.sim.store.getState())).toBe(TEST_START + 90_000 - recording.startedAt!);
    // No second session was created.
    expect(second.sim.store.getState().sessionHistory).toHaveLength(historyBefore);
    expect(second.sim.store.getState().auth.status).toBe('SIGNED_OUT');
  });

  it('writes the snapshot at most once per throttle interval', async () => {
    const { sim } = mobileSim();
    await sim.ready;
    const calls = jest.mocked(AsyncStorage.setItem).mock.calls.length;
    sim.actions.setTabletLink('OFFLINE');
    sim.actions.setTabletLink('CONNECTED');
    sim.actions.setTabletLink('OFFLINE');
    expect(jest.mocked(AsyncStorage.setItem).mock.calls.length).toBe(calls); // pending, not yet written
    sim.flush();
    expect(jest.mocked(AsyncStorage.setItem).mock.calls.length).toBe(calls + 1);
    expect((await storedSnapshot())?.state.tabletLink).toMatchObject({ state: 'OFFLINE' });
    sim.stop();
  });
});

describe('hydration gate (04 §5.2)', () => {
  it('never ticks before hydration, so a saved session is not overwritten', async () => {
    // A saved recording session from an earlier run.
    const earlier = mobileSim();
    await earlier.sim.ready;
    earlier.sim.actions.loadScenario('recording');
    const saved = sessionOf(earlier.sim)!;
    earlier.sim.flush();
    earlier.sim.stop();

    // Storage whose reads wait until the test releases them.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = createAsyncStoragePersistStorage({
      getItem: async (key) => {
        await gate;
        return AsyncStorage.getItem(key);
      },
      setItem: (key, value) => AsyncStorage.setItem(key, value),
      removeItem: (key) => AsyncStorage.removeItem(key),
    });
    const { sim, scheduler } = mobileSim({ storage: slow });

    sim.start(); // allowed before ready; it must wait
    expect(sim.isReady()).toBe(false);
    expect(sim.isRunning()).toBe(false);
    expect(scheduler.state.tick).toBeNull();
    // A change before hydration is not written (the throttled storage is disabled until ready).
    sim.actions.setTabletLink('OFFLINE');
    sim.flush();
    expect((await storedSnapshot())?.state.session).toMatchObject({ id: saved.id, state: 'RECORDING' });

    release();
    await sim.ready;
    expect(sim.isRunning()).toBe(true);
    expect(scheduler.state.intervalMs).toBe(ENGINE_INTERVAL_MS);
    expect(sessionOf(sim)).toMatchObject({ id: saved.id, state: 'RECORDING' });
    sim.stop();
  });
});

describe('AppState visibility (04 §5.2)', () => {
  it.each([
    ['active', false],
    ['background', true],
    ['inactive', true],
    ['unknown', false],
    [null, false],
  ])('AppState %s → hidden %s', (state, hidden) => {
    expect(isHiddenAppState(state)).toBe(hidden);
  });

  it('pauses in the background (flushing the snapshot) and catches up when active again', async () => {
    const appState = fakeAppState('active');
    const { sim, clock, scheduler } = mobileSim({ appState });
    await sim.ready;
    sim.start();
    expect(sim.isRunning()).toBe(true);
    sim.actions.loadScenario('recording');
    const startedAt = sessionOf(sim)!.startedAt!;

    appState.set('background');
    expect(sim.isRunning()).toBe(false);
    expect(scheduler.state.tick).toBeNull();
    expect((await storedSnapshot())?.state.session).toMatchObject({ state: 'RECORDING' }); // flushed on hide

    clock.advance(60_000);
    appState.set('active');
    expect(sim.isRunning()).toBe(true);
    expect(scheduler.state.starts).toBe(2);
    // One catch-up tick published the elapsed time at once.
    expect(sim.store.getState().clock.now).toBe(TEST_START + 60_000);
    expect(selectElapsedMs(sim.store.getState())).toBe(TEST_START + 60_000 - startedAt);

    sim.stop();
    expect(appState.listenerCount()).toBe(0);
  });

  it('starts paused when the app launches in the background, and runs on the first active event', async () => {
    const appState = fakeAppState('background');
    const { sim } = mobileSim({ appState });
    await sim.ready;
    sim.start();
    expect(sim.isRunning()).toBe(false);
    appState.set('active');
    expect(sim.isRunning()).toBe(true);
    sim.stop();
  });
});

// Task 3 row 138 (row 132's request; C3 §2.6 "Simulator"; D80(3)): inside a tablet or phone app the
// simulator refuses the three credential-carrying operations as the Core server refuses a device session.
describe('device console: operations 89, 95 and 96 are web-console-only', () => {
  const WEB_ONLY = [
    '/api/v1/capture/devices/CAM-01/credential',
    '/api/v1/capture/discovery/candidates/CND-000000000001/test',
    '/api/v1/capture/discovery/candidates/CND-000000000001/adopt',
  ];
  const signInSupervisor = (sim: Sim): void => {
    expect(sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  };

  it('the mobile simulator answers 403 NOT_PERMITTED / WEB_CONSOLE_ONLY and writes nothing; search, read and re-read still answer', () => {
    const { sim } = mobileSim();
    signInSupervisor(sim);
    expect(sim.request({ method: 'POST', path: '/api/v1/capture/discovery' }).status).toBe(202);
    const devices = sim.store.getState().captureDevices.devices.length;
    for (const path of WEB_ONLY) {
      const answer = sim.request({ method: 'POST', path, body: {} });
      expect([path, answer.status]).toEqual([path, 403]);
      expect(answer.body).toMatchObject({ error: { code: 'NOT_PERMITTED', details: { reason: 'WEB_CONSOLE_ONLY' } } });
    }
    expect(sim.store.getState().captureDevices.devices).toHaveLength(devices);
    expect(sim.request({ method: 'GET', path: '/api/v1/capture/discovery' }).status).toBe(200);
    expect(sim.request({ method: 'POST', path: '/api/v1/capture/inputs/rescan' }).status).toBe(200);
  });

  it('no caller can turn it off; and the web default does not refuse (negative control)', () => {
    const forced = createMobileSim({ clock: createManualClock(TEST_START), scheduler: createManualScheduler().scheduler, storage: null, deviceConsole: false });
    built.push(forced);
    signInSupervisor(forced);
    forced.request({ method: 'POST', path: '/api/v1/capture/discovery' });
    expect(forced.request({ method: 'POST', path: WEB_ONLY[1]!, body: {} }).status).toBe(403);

    const web = createSim({ clock: createManualClock(TEST_START), scheduler: createManualScheduler().scheduler, storage: null, authStorage: null });
    built.push(web);
    signInSupervisor(web);
    web.request({ method: 'POST', path: '/api/v1/capture/discovery' });
    expect(web.request({ method: 'POST', path: WEB_ONLY[1]!, body: {} }).status).toBe(200);
  });
});
