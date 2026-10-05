// Decision D169 (finding F-2 of row W72, `implementation/72_mobile_finalization_summary_sessions.md` §10,
// `assets/72_f2_reproduction.txt`): on a Live reconnect `SessionRouteSync` must resync with the session the
// Core's snapshot brought, not with the session rendered before the outage.
//
// The Live source applies the snapshot and emits `RESYNCED` at once, before React rendered it; the route
// sync's rendered value (`latest.current`, updated by an effect after the commit) still held the session
// from before. W72's case, rebuilt on the app's real Live source over the contract-checked fake transport
// (W66's bed, `features/dashboard/testing/live-home-bed.tsx`): the summary of session X is pending and the
// operator is on the hub; the link drops; meanwhile the Core acknowledges X and seals Y (pending); the
// link comes back. The route sync must open Y's summary, never X's.
//
// Measured while building the fix: at RESYNCED the store still held X, because after an outage the Live
// source confirms the session for the new socket first (CPC1-35) and holds the snapshot until the Core
// answered; reading the store at the signal (W72's proposal) therefore stayed red. The route sync now
// waits for that confirmation (`live-resync-watch.ts`); its rules are tested here on a fake Live source.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SimState } from '@dems/shared/sim';
import { LiveLinkState } from '@dems/shared/live';
import { createHomeBed, flush, type HomeBed } from '@/features/dashboard/testing/live-home-bed';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from './index';
import { watchLiveResync, type LiveResyncSource } from './live-resync-watch';
import { SessionRouteSync } from './session-route-sync';
import { createTestSim } from './testing/test-sim';

const mockReplace = jest.fn();
const mockRoute = { pathname: '/sessions' };

jest.mock('expo-router/build/hooks', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockRoute.pathname,
}));
jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

/** A Core state whose session X is SEALED with its summary pending (the simulator's own finalizing run). */
function sealedPending(): { state: SimState; sessionId: string } {
  const test = createTestSim({ scenario: 'finalizing' });
  test.advance(8_000);
  const state = test.sim.store.getState();
  expect(state.session?.state).toBe('SEALED');
  expect(state.lastSealedAcknowledged).toBe(false);
  return { state, sessionId: state.session!.id };
}

/** The same Core after the outage: X acknowledged, a newer session Y sealed and pending. */
function acknowledgedAndNewer(before: SimState, nextId: string): SimState {
  return {
    ...before,
    session: { ...before.session!, id: nextId },
    lastSealedSessionId: nextId,
    lastSealedAcknowledged: false,
  };
}

/** The next session ID of the same day (`SES-YYYYMMDD-NNNN`). */
const nextSessionId = (id: string): string => id.replace(/(\d{4})$/, (seq) => String(Number(seq) + 1).padStart(4, '0'));

let bed: HomeBed | null = null;

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  mockReplace.mockClear();
  mockRoute.pathname = '/sessions';
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
});

afterEach(() => {
  if (bed !== null) {
    bed.stop();
    bed.fake.assertNoViolations();
    bed = null;
  }
  cleanup();
});

describe('SessionRouteSync on a Live reconnect (D169, W72 F-2)', () => {
  it('opens the summary of the session the snapshot brought (Y), not the one rendered before the outage (X)', async () => {
    const { state: before, sessionId: x } = sealedPending();
    const y = nextSessionId(x);
    bed = createHomeBed();
    bed.state = before;
    bed.mount(<SessionRouteSync />);
    await bed.signIn();
    await flush();
    // On the hub with X pending: the route sync never navigates by itself (only on a trigger).
    expect(bed.heartbeats[bed.heartbeats.length - 1]).toBe('LIVE/LIVE');
    expect(mockReplace).not.toHaveBeenCalled();

    bed.goDown();
    await flush();
    bed.state = acknowledgedAndNewer(before, y);
    await bed.elapse(1_500, 250);
    bed.comeBack();
    for (let waited = 0; waited < 20_000 && mockReplace.mock.calls.length === 0; waited += 250) await bed.elapse(250, 250);

    expect(mockReplace.mock.calls.map((call) => call[0])).toEqual([`/session/summary/${y}`]);
    expect(mockReplace).not.toHaveBeenCalledWith(`/session/summary/${x}`);
  });

  it('a reconnect whose snapshot changed nothing navigates nowhere new: on the pending summary already, it stays', async () => {
    const { state: before, sessionId: x } = sealedPending();
    mockRoute.pathname = `/session/summary/${x}`;
    bed = createHomeBed();
    bed.state = before;
    bed.mount(<SessionRouteSync />);
    await bed.signIn();
    await flush();
    bed.goDown();
    await flush();
    await bed.elapse(1_500, 250);
    bed.comeBack();
    for (let waited = 0; waited < 12_000; waited += 250) await bed.elapse(250, 250);
    expect(bed.heartbeats[bed.heartbeats.length - 1]).toBe('LIVE/LIVE');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('SessionRouteSync on a Live reconnect whose snapshot changed nothing', () => {
  it('a recording, the operator elsewhere: after the confirmation it opens the monitor once (as before D169)', async () => {
    const recording = createTestSim({ scenario: 'recording' });
    const state = recording.sim.store.getState();
    expect(state.session?.state).toBe('RECORDING');
    mockRoute.pathname = '/evidence';
    bed = createHomeBed();
    bed.state = state;
    bed.mount(<SessionRouteSync />);
    await bed.signIn();
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    bed.goDown();
    await flush();
    await bed.elapse(1_500, 250);
    bed.comeBack();
    for (let waited = 0; waited < 20_000 && mockReplace.mock.calls.length === 0; waited += 250) await bed.elapse(250, 250);
    await bed.elapse(2_000, 250);
    expect(mockReplace.mock.calls.map((call) => call[0])).toEqual(['/session/live']);
  });
});

// ── The watch itself, on a fake Live source ──────────────────────────────────────────────────

function fakeLive() {
  const listeners = new Set<() => void>();
  const live = {
    link: LiveLinkState.ONLINE as LiveLinkState,
    session: { id: 's1' } as unknown,
    connection: 1,
    socketStatus: () => ({ connection: live.connection }),
    onLiveChange: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(change: Partial<{ link: LiveLinkState; session: unknown; connection: number }>) {
      Object.assign(live, change);
      for (const listener of Array.from(listeners)) listener();
    },
    listeners,
  };
  return live as typeof live & LiveResyncSource;
}

describe('watchLiveResync (D169)', () => {
  it('no outage seen: runs at once', () => {
    const live = fakeLive();
    const run = jest.fn();
    watchLiveResync(live).whenSynced(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a new socket after an outage: waits for the confirmation (another session object), then runs once', () => {
    const live = fakeLive();
    const watch = watchLiveResync(live);
    const run = jest.fn();
    live.set({ link: LiveLinkState.OFFLINE });
    live.set({ link: LiveLinkState.CONNECTING, connection: 2 });
    live.set({ link: LiveLinkState.ONLINE, connection: 3 });
    watch.whenSynced(run);
    expect(run).not.toHaveBeenCalled();
    live.set({ link: LiveLinkState.ONLINE });
    expect(run).not.toHaveBeenCalled();
    live.set({ session: { id: 's1' } });
    expect(run).toHaveBeenCalledTimes(1);
    live.set({ session: { id: 's1' } });
    expect(run).toHaveBeenCalledTimes(1);
    // A later outage and confirmation without a signal: what ran is not run again.
    live.set({ link: LiveLinkState.OFFLINE });
    live.set({ link: LiveLinkState.ONLINE, connection: 4 });
    live.set({ session: { id: 's1' } });
    expect(run).toHaveBeenCalledTimes(1);
    // Nothing pending any more: the next signal runs at once.
    const next = jest.fn();
    watch.whenSynced(next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('the session confirmed before the signal (the answer came before the snapshot): runs at once', () => {
    const live = fakeLive();
    const watch = watchLiveResync(live);
    live.set({ link: LiveLinkState.OFFLINE });
    live.set({ link: LiveLinkState.ONLINE, connection: 2 });
    live.set({ session: { id: 's1' } });
    const run = jest.fn();
    watch.whenSynced(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('the link back on the same socket (a STALE that recovered, no new session check): runs at once', () => {
    const live = fakeLive();
    const watch = watchLiveResync(live);
    live.set({ link: LiveLinkState.STALE });
    live.set({ link: LiveLinkState.ONLINE });
    const run = jest.fn();
    watch.whenSynced(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('the session ended while it waited: runs (the store is what the Live source left), once', () => {
    const live = fakeLive();
    const watch = watchLiveResync(live);
    live.set({ link: LiveLinkState.OFFLINE });
    live.set({ link: LiveLinkState.ONLINE, connection: 2 });
    const run = jest.fn();
    watch.whenSynced(run);
    live.set({ session: null });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a newer signal replaces an owed one; dispose drops what is owed and stops listening', () => {
    const live = fakeLive();
    const watch = watchLiveResync(live);
    live.set({ link: LiveLinkState.OFFLINE });
    live.set({ link: LiveLinkState.ONLINE, connection: 2 });
    const first = jest.fn();
    const second = jest.fn();
    watch.whenSynced(first);
    watch.whenSynced(second);
    live.set({ session: { id: 's1' } });
    expect([first.mock.calls.length, second.mock.calls.length]).toEqual([0, 1]);
    live.set({ link: LiveLinkState.OFFLINE });
    live.set({ link: LiveLinkState.ONLINE, connection: 3 });
    const third = jest.fn();
    watch.whenSynced(third);
    watch.dispose();
    live.set({ session: { id: 's1' } });
    expect(third).not.toHaveBeenCalled();
    expect(live.listeners.size).toBe(0);
  });

  it('reads no clock and starts no timer', () => {
    const code = readFileSync(join(__dirname, 'live-resync-watch.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(?<!:)\/\/.*$/gm, '');
    expect(/\bset(?:Timeout|Interval)\b|\bDate\b|\.now\s*\(/.test(code)).toBe(false);
  });
});
