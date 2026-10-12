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
import { act, cleanup, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SimState } from '@dems/shared/sim';
import { LiveLinkState } from '@dems/shared/live';
import { createHomeBed, flush, type HomeBed } from '@/features/dashboard/testing/live-home-bed';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from './index';
import { watchLiveResync, type LiveResyncSource } from './live-resync-watch';
import { resetForeignSessionSignalForTests, subscribeForeignSession, type ForeignSessionSignal } from './foreign-session-signal';
import {
  ATTENDED_STORAGE_KEY,
  SessionRouteSync,
  hydrateAttendedSessions,
  isSessionAttended,
  isSessionFlowPath,
  markSessionAttended,
  resetAttendedSessionsForTests,
} from './session-route-sync';
import { QuickActions } from '@/features/dashboard/quick-actions';
import { primaryActionFor } from '@/features/dashboard/home-model';
import { useBootHref } from '@/navigation/root-navigator';
import { signInSessionHref } from '@/navigation/session-routes';
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
/** Fix wave Q (CT-05): what the route sync told instead of navigating. */
const told: ForeignSessionSignal[] = [];

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  mockReplace.mockClear();
  mockRoute.pathname = '/sessions';
  told.length = 0;
  resetAttendedSessionsForTests();
  resetForeignSessionSignalForTests();
  subscribeForeignSession((signal) => told.push(signal));
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
  // Fix wave Q (CT-05; ruling of D246) REPLACES "opens the summary of the session the snapshot brought (Y)": Y was
  // sealed on the Core while this device was away - a session it never took part in. Such a session never moves
  // the operator; it is told. D169's own rule stays and is what the telling proves: the route sync reads the
  // session the SNAPSHOT brought (Y), never the one rendered before the outage (X).
  it('a session sealed elsewhere during the outage (Y) is TOLD, not opened; the stale one (X) is neither opened nor told', async () => {
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
    for (let waited = 0; waited < 20_000 && told.length === 0; waited += 250) await bed.elapse(250, 250);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(told).toEqual([{ sessionId: y, phase: 'sealed' }]);
  });

  // CONTROL of the rule above, and D169 as it was: a session this device DID take part in is followed.
  it('CONTROL: the same reconnect for a session this device took part in opens its summary (Y), never the stale one (X)', async () => {
    const { state: before, sessionId: x } = sealedPending();
    const y = nextSessionId(x);
    markSessionAttended(y);
    bed = createHomeBed();
    bed.state = before;
    bed.mount(<SessionRouteSync />);
    await bed.signIn();
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();

    bed.goDown();
    await flush();
    bed.state = acknowledgedAndNewer(before, y);
    await bed.elapse(1_500, 250);
    bed.comeBack();
    for (let waited = 0; waited < 20_000 && mockReplace.mock.calls.length === 0; waited += 250) await bed.elapse(250, 250);

    expect(mockReplace.mock.calls.map((call) => call[0])).toEqual([`/session/summary/${y}`]);
    expect(mockReplace).not.toHaveBeenCalledWith(`/session/summary/${x}`);
    expect(told).toEqual([]);
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
  it('a recording this device took part in, the operator elsewhere: after the confirmation it opens the monitor once (as before D169)', async () => {
    const recording = createTestSim({ scenario: 'recording' });
    const state = recording.sim.store.getState();
    expect(state.session?.state).toBe('RECORDING');
    // Fix wave Q (CT-05): the operator started this recording here (they stood on its monitor), then went to Evidence.
    markSessionAttended(state.session!.id);
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
    expect(told).toEqual([]);
  });

  // Fix wave Q (CT-05, seen three times on the tablet and on the phone in the confirmation: the operator was taken
  // from Evidence and from Network & Time to the Finalizing and the Summary of sessions run from the web console).
  it('CT-05: a recording run from ANOTHER console, the operator on Evidence: the reconnect moves nobody and tells it once', async () => {
    const recording = createTestSim({ scenario: 'recording' });
    const state = recording.sim.store.getState();
    mockRoute.pathname = '/evidence';
    bed = createHomeBed();
    bed.state = state;
    bed.mount(<SessionRouteSync />);
    await bed.signIn();
    await flush();
    bed.goDown();
    await flush();
    await bed.elapse(1_500, 250);
    bed.comeBack();
    for (let waited = 0; waited < 20_000 && told.length === 0; waited += 250) await bed.elapse(250, 250);
    await bed.elapse(2_000, 250);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(told).toEqual([{ sessionId: state.session!.id, phase: 'recording' }]);
    // A second outage of the same recording says nothing again.
    bed.goDown();
    await flush();
    await bed.elapse(1_500, 250);
    bed.comeBack();
    for (let waited = 0; waited < 12_000; waited += 250) await bed.elapse(250, 250);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(told).toHaveLength(1);
  });

  it('CT-05: the screens of a session\'s flow are what "taking part" means - and only the Summary of THAT session', () => {
    expect(isSessionFlowPath('/session/new', 'SES-1')).toBe(true);
    expect(isSessionFlowPath('/session/live', 'SES-1')).toBe(true);
    expect(isSessionFlowPath('/session/finalizing', 'SES-1')).toBe(true);
    expect(isSessionFlowPath('/session/recovery', 'SES-1')).toBe(true);
    expect(isSessionFlowPath('/session/summary/SES-1', 'SES-1')).toBe(true);
    expect(isSessionFlowPath('/session/summary/SES-0', 'SES-1')).toBe(false);
    expect(isSessionFlowPath('/evidence', 'SES-1')).toBe(false);
    expect(isSessionFlowPath('/home', 'SES-1')).toBe(false);
    expect(isSessionFlowPath('/session/live', null)).toBe(false);
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

// Decision D247 item 6 (note 176 decision 3; the ruling of CT-05 extended): CT-05 stopped the ROUTE SYNC from
// moving an operator to a session of another console, but right after a SIGN-IN the boot router still opened
// the unacknowledged Summary of whatever session the Core held (seen twice on 12 Oct: the Summaries of the web
// console's sessions). The boot target is now the Summary only for a session this device ran; for any other
// one it is Home (or the pending link), and Home says the Summary is there.
function BootProbe() {
  return <Text testID="boot-href">{useBootHref()}</Text>;
}
const bootHref = (): string => String(screen.getByTestId('boot-href').props.children);

describe('D247 item 6: after a sign-in, the unacknowledged Summary of a session run elsewhere is not opened', () => {
  it('the rule: SEALED and unacknowledged opens its Summary only when the session ran on this device; no other state changes', () => {
    const pending = { sessionId: 'SES-20261012-0118', summaryAcknowledged: false };
    expect(signInSessionHref('SEALED', pending, true)).toBe('/session/summary/SES-20261012-0118');
    expect(signInSessionHref('SEALED', pending, false)).toBeNull();
    expect(signInSessionHref('SEALED', { ...pending, summaryAcknowledged: true }, true)).toBeNull();
    // A session that still runs is the Core's one session whoever started it: the sign-in goes to it as before.
    expect(signInSessionHref('RECORDING', pending, false)).toBe('/session/live');
    expect(signInSessionHref('FINALIZING', pending, false)).toBe('/session/finalizing');
    expect(signInSessionHref('FAULT', pending, false)).toBe('/session/recovery');
    expect(signInSessionHref(null, {}, false)).toBeNull();
  });

  it('a session sealed from another console waits for its acknowledgement: the sign-in lands on Home, and Home offers the Summary', async () => {
    const { state, sessionId } = sealedPending();
    bed = createHomeBed();
    bed.state = state;
    bed.mount(
      <>
        <BootProbe />
        <QuickActions action={primaryActionFor('SEALED', { sessionId, summaryAcknowledged: false })} />
      </>,
    );
    await bed.signIn();
    await flush();
    expect(isSessionAttended(sessionId)).toBe(false);
    expect(bootHref()).toBe('/home');
    expect(String(screen.getByTestId('home-action-summary-elsewhere').props.children)).toBe(
      `Session ${sessionId} was sealed on another console. Summary not yet acknowledged.`,
    );
    // The operator may open it: the way is Home's own "View session summary".
    expect(screen.getByTestId('home-action-primary').props.accessibilityLabel).toBe('View session summary');

    // Once this device stands on that Summary it takes part in the session (CT-05's own rule): no line any more.
    act(() => markSessionAttended(sessionId));
    expect(screen.queryByTestId('home-action-summary-elsewhere')).toBeNull();
  });

  it('CONTROL: a session this device ran opens its Summary after the sign-in, and Home draws no such line', async () => {
    const { state, sessionId } = sealedPending();
    markSessionAttended(sessionId);
    bed = createHomeBed();
    bed.state = state;
    bed.mount(
      <>
        <BootProbe />
        <QuickActions action={primaryActionFor('SEALED', { sessionId, summaryAcknowledged: false })} />
      </>,
    );
    await bed.signIn();
    await flush();
    expect(bootHref()).toBe(`/session/summary/${sessionId}`);
    expect(screen.queryByTestId('home-action-summary-elsewhere')).toBeNull();
  });

  it('this device remembers the sessions it ran across a relaunch: the newest ids are stored and read back', async () => {
    markSessionAttended('SES-20261012-0118');
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem(ATTENDED_STORAGE_KEY)) ?? '[]')).toEqual(['SES-20261012-0118']);
    // The relaunch: the module's memory is gone, the stored list is read.
    resetAttendedSessionsForTests();
    expect(isSessionAttended('SES-20261012-0118')).toBe(false);
    await hydrateAttendedSessions();
    expect(isSessionAttended('SES-20261012-0118')).toBe(true);
    // A damaged stored value is no session, and no error reaches the operator.
    resetAttendedSessionsForTests();
    await AsyncStorage.setItem(ATTENDED_STORAGE_KEY, '{not json');
    await hydrateAttendedSessions();
    expect(isSessionAttended('SES-20261012-0118')).toBe(false);
  });
});

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
