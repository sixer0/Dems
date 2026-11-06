// Backend task, plan row W82: crossing the LIVE boundary from Settings → App Preferences → "Core link
// source" (04_client_integration_spec §3.3, §9.5; AC-C-31, AC-C-83; finding CPM1-2 of gateway_check/09).
//
// What is rendered: the app's REAL route tree (`src/app`, the real `BootGate` and `RootNavigator`, as
// `src/app/_layout.tsx` nests them) inside the real `AppProviders`, whose runtime builds its OWN data source from the Core link preference, as on a device
// (no injected source: an injected one would ignore the preference). What is faked: the transport only,
// installed where the runtime looks up its `fetch` and socket constructor (`installFakeTransport`), on
// the runner's clock. A probe inside the providers hands the test the current data source's actions.
//
// Proven here: selecting LIVE opens the dialog; confirming signs the operator out of the simulator and
// lands on `/pair` (no credential) or `/login` (a credential the Core confirms); leaving LIVE signs out
// at the Core (operation 5, the switch waits for its answer while the dialog holds) and lands on the
// simulator's `/login`; Cancel changes nothing; SIMULATED <-> HEARTBEAT stays instant; a release build
// offers LIVE (M3-02, RT-1, D163; was "offers no LIVE at all"): unpaired it opens on `/pair`, paired it
// signs in at the Core, and Settings shows it no Core link control. M3-01 (KD-15, D160): the LIVE-only tablet keeps the three LIVE → SIMULATED
// guarantees on the paths that remain (the debug `core=` link, the link-down owed sign-out, no
// control that offers SIMULATED); see the describe "LIVE-only".
//
// Import order: the test setup, then the router harness (see their headers).
import './testing/settings-test-setup';
import { appContext, renderRoutes, resetShellState, setWindow, TEST_INSETS, WINDOWS } from '@/navigation/testing/router-harness';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { promisify } from 'node:util';
import { CORE_API_EXAMPLES, pickReplicatedState, type AuthSessionInfo, type PairingRedeemed, type ReplicatedState } from '@dems/shared/api';
import { settle, useCoreActions, type CoreActions } from '@dems/shared/live';
import { FAKE_CREDENTIALS, clockFromTimers, createFakeTransport, installFakeTransport, type FakeClock, type FakeHttpCall, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ROLE_PERMISSIONS, useSimInstance, type Sim, type SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { MOBILE_PREFS_KEY, resetMotionStateForTests } from '@/motion';
import { RootNavigator } from '@/navigation/root-navigator';
import { AppProviders, BootGate } from '@/providers';
import {
  resetCoreErrorPresenterForTests,
  resetCoreLinkPrefsForTests,
  setCoreLinkSource,
  resetDebugLaunchForTests,
  useAuth,
  useCoreLink,
  type CoreLinkSource,
} from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { createTestSim } from '@/runtime/testing/test-sim';
import { resetSettingsPrefsForTests } from './settings-prefs';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w82', 'b'].join('-');
const OPERATOR = OPERATORS.find((candidate) => candidate.username === 'andi.pratama')!;

type DevGlobal = typeof globalThis & { __DEV__: boolean };
const devGlobal = globalThis as DevGlobal;
const originalDev = devGlobal.__DEV__;

class InertSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

/** What the probe inside the providers saw at its last commit. */
const probe: { actions: CoreActions | null; sim: Sim | null; signedIn: boolean; source: CoreLinkSource | null; online: boolean } = { actions: null, sim: null, signedIn: false, source: null, online: false };

function Probe() {
  const actions = useCoreActions();
  const sim = useSimInstance();
  const auth = useAuth();
  const link = useCoreLink();
  useEffect(() => {
    probe.actions = actions;
    probe.sim = sim;
    probe.signedIn = auth.isAuthenticated;
    probe.source = link.source;
    probe.online = link.state === 'ONLINE';
  });
  return null;
}

let fake: FakeTransport<FakeClock>;
let restoreTransport: () => void = () => undefined;
let unmount: () => void = () => undefined;
let lastApp: { getPathname(): string } | null = null;
/** The Core's session of the device, once it signed in. */
let coreSession: AuthSessionInfo | null = null;
/** The Core answers nothing and refuses every socket (the link down). */
let coreDown = false;

const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};
const sessionOf = (call: FakeHttpCall): AuthSessionInfo | null => (coreSession !== null && bearerOf(call.headers) === FAKE_CREDENTIALS.sessionToken ? coreSession : null);

/** The Core server as the tablet meets it: the paired device's registration, a password sign-in, the sign-out. */
function scriptCore(engine: Sim): void {
  const now = () => Date.now();
  fake.answer('getAuthSession', (call) => {
    if (coreDown) return { outage: true };
    const session = sessionOf(call);
    return session !== null ? { status: 200, body: { ...session, serverTime: now() } } : fake.example('getAuthSession', 401);
  });
  fake.answer('getSignInStatus', () => (coreDown ? { outage: true } : fake.example('getSignInStatus', 200, 'open')));
  fake.answer('getDeviceRegistration', (call) => {
    if (coreDown) return { outage: true };
    return bearerOf(call.headers) === STORED.deviceCredential || sessionOf(call) !== null
      ? { status: 200, body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core } }
      : fake.example('getDeviceRegistration', 401);
  });
  fake.answer('signIn', (call) => {
    if (bearerOf(call.headers) !== STORED.deviceCredential) return fake.example('signIn', 403, 'deviceNotPaired');
    coreSession = {
      ...DEVICE_SESSION,
      operator: { id: OPERATOR.id, username: OPERATOR.username, rank: OPERATOR.rank, name: OPERATOR.name, displayName: OPERATOR.displayName, initials: OPERATOR.initials, role: OPERATOR.role },
      permissions: [...ROLE_PERMISSIONS[OPERATOR.role]],
      method: 'PASSWORD',
      deviceId: STORED.deviceId,
      issuedAt: now(),
      lastActivityAt: now(),
      idleExpiresAt: now() + 900_000,
      absoluteExpiresAt: now() + 28_800_000,
      demoControls: false,
      serverTime: now(),
    };
    return { status: 200, body: { session: coreSession, sessionToken: FAKE_CREDENTIALS.sessionToken } };
  });
  fake.answer('signOut', (call) => {
    if (sessionOf(call) === null) return fake.example('signOut', 401);
    coreSession = null;
    return { status: 204 };
  });
  fake.answer('touchSession', () => fake.example('touchSession'));
  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    if (coreDown) {
      connection.refuse();
      return;
    }
    const bearer = bearerOf(connection.headers);
    if (coreSession !== null && bearer === FAKE_CREDENTIALS.sessionToken) {
      connection.startOperator(pickReplicatedState(JSON.parse(JSON.stringify(engine.store.getState() as SimState)) as ReplicatedState)).heartbeat();
    } else if (bearer === STORED.deviceCredential) connection.startDevice().heartbeat();
    else connection.startAnonymous().heartbeat();
  });
}

/** `ms` of runner time passes inside `act`: the runner's fake clock advances and promise jobs settle. */
async function wait(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    // The bed's own flush convention (`live-monitor-bed.tsx:167-171`): let the promise jobs run.
    for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
  });
}

async function until(predicate: () => boolean, what: string, ms = 8_000): Promise<void> {
  for (let waited = 0; waited < ms; waited += 50) {
    if (predicate()) return;
    await wait(50);
  }
  throw new Error(`boundary test: timed out waiting for ${what} (path ${String(lastApp?.getPathname())}, source ${String(probe.source)}, signed in ${probe.signedIn}, requests ${fake.calls.map((call) => `${call.operationId}`).join(',')})`);
}

function mountApp(initialUrl: string) {
  setWindow('phonePortrait');
  const { width, height } = WINDOWS.phonePortrait;
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
  function Root() {
    return (
      <AppProviders safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new InertSocket()}>
        <Probe />
        {/* As `src/app/_layout.tsx`: the boot gate holds the navigator until the runtime is ready. */}
        <BootGate>
          <RootNavigator />
        </BootGate>
      </AppProviders>
    );
  }
  const app = renderRoutes(appContext({ _layout: Root }), initialUrl);
  unmount = app.unmount;
  lastApp = app;
  return app;
}

/** What the kit's overlay tap and the hardware back button do to an open dialog: its `onOpenChange(false)`. */
function dismissDialog(): void {
  const roots = screen.UNSAFE_root.findAll((node) => node.props.isOpen === true && typeof node.props.onOpenChange === 'function');
  if (roots.length === 0) throw new Error('boundary test: no open dialog to dismiss');
  act(() => (roots[0]!.props.onOpenChange as (open: boolean) => void)(false));
}

async function storedSource(): Promise<unknown> {
  return (JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY)) ?? '{}') as Record<string, unknown>).coreLinkSource;
}

/** Signs in through the data source the app runs now (the simulator, or the Core server through the Live source). */
async function signInWith(password: string, username = OPERATOR.username): Promise<void> {
  act(() => {
    settle(() => probe.actions!.signIn(username, password), { fail: () => undefined });
  });
  await until(() => probe.signedIn, 'the sign-in');
}

async function openPreferences(app: ReturnType<typeof mountApp>): Promise<void> {
  await until(() => app.getPathname() === '/home', 'the Home screen after the sign-in');
  act(() => router.push('/settings/preferences' as Href));
  await until(() => screen.queryByTestId('settings-preferences') !== null, 'Settings → App Preferences');
}

/** One turn of the event loop's queue: a hand-over, never a duration wait (no timer is involved). */
const nextTurn = promisify(setImmediate) as () => Promise<void>;

beforeAll(async () => {
  // Reanimated prepares its UI-side frame-callback registry through one 0 ms timer that the worklets
  // mock runs when the module loads, on the real queue (S72-12). Yield two scheduler turns so that
  // timer has run before the first test takes the clock in `beforeEach`: a registration on the
  // runner's fake clock then always finds the registry. Turns, not duration waits.
  await nextTurn();
  await nextTurn();
});

beforeEach(async () => {
  // The runner owns the clock for the whole test: every timer this file and the fake transport
  // schedule runs on it (`clockFromTimers` reads these globals at call time, clock.ts:9-11).
  // `nextTick`, `queueMicrotask` and `setImmediate` stay real: promise jobs, `act` hand-overs and
  // the worklets mock's `runOnJS` must not wait on a clock advance (probe-failure.test.ts:213).
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  resetMissingKeys();
  await AsyncStorage.clear();
  resetShellState();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetSettingsPrefsForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  globalThis.__DEMS_SECURE_STORE_MOCK__.reset();
  coreSession = null;
  coreDown = false;
  probe.actions = null;
  probe.sim = null;
  probe.signedIn = false;
  probe.source = null;
  probe.online = false;
  fake = createFakeTransport({
    epoch: 2,
    revision: 10,
    clock: clockFromTimers({ now: () => Date.now(), setTimeout: (task, ms) => setTimeout(task, ms), clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) }),
  });
  restoreTransport = installFakeTransport(fake);
});

afterEach(async () => {
  unmount();
  unmount = () => undefined;
  await wait(20);
  devGlobal.__DEV__ = originalDev;
  restoreTransport();
  fake.assertNoViolations();
  expect(getMissingKeys()).toEqual([]);
  jest.useRealTimers();
});

describe('SIMULATED → LIVE (§3.3, AC-C-31)', () => {
  it('selecting LIVE shows the dialog; confirming signs the operator out of the simulator and lands on /pair (no credential)', async () => {
    const engine = createTestSim().sim;
    setCoreLinkSource('SIMULATED'); // the device default is LIVE since 2026-11-05
    scriptCore(engine);
    const app = mountApp('/login');
    await until(() => probe.actions !== null && probe.source === 'SIMULATED', 'the simulator runtime');
    await signInWith(DEMO_OPERATOR_PASSWORD);
    await openPreferences(app);
    const simulator = probe.sim!;

    fireEvent.press(screen.getByTestId('settings-core-link-LIVE'));
    await wait(20);
    expect(screen.getByTestId('settings-core-mode-dialog')).toBeTruthy();
    expect(screen.getByText('Switch to Live mode?')).toBeTruthy();
    expect(screen.getByText('You will be signed out and the console reloads. Simulated data and Live data are separate.')).toBeTruthy();
    // Nothing happened yet: still signed in, the source unchanged, nothing sent to the Core server.
    expect(simulator.store.getState().auth.status).toBe('SIGNED_IN');
    // Nothing was written by the dialog: the store still holds the SIMULATED this test started from.
    expect(await storedSource()).toBe('SIMULATED');
    expect(fake.calls).toHaveLength(0);

    fireEvent.press(screen.getByTestId('settings-core-mode-confirm'));
    await until(() => app.getPathname() === '/pair', 'the Pair screen of LIVE mode');
    expect(simulator.store.getState().auth.status).not.toBe('SIGNED_IN');
    expect(simulator.store.getState().audit.rows.some((row) => row.type === 'AUTH_SIGNED_OUT')).toBe(true);
    expect(await storedSource()).toBe('LIVE');
    expect(probe.source).toBe('LIVE');
    expect(probe.signedIn).toBe(false);
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
    // The simulator's sign-out is local: no sign-out request reached the Core server.
    expect(fake.log.requestsOf('signOut')).toHaveLength(0);
  });

  it('with a credential the Core confirms, the same switch lands on /login', async () => {
    globalThis.__DEMS_SECURE_STORE_MOCK__.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
    const engine = createTestSim().sim;
    setCoreLinkSource('SIMULATED'); // the device default is LIVE since 2026-11-05
    scriptCore(engine);
    const app = mountApp('/login');
    await until(() => probe.actions !== null && probe.source === 'SIMULATED', 'the simulator runtime');
    await signInWith(DEMO_OPERATOR_PASSWORD);
    await openPreferences(app);

    fireEvent.press(screen.getByTestId('settings-core-link-LIVE'));
    await wait(20);
    fireEvent.press(screen.getByTestId('settings-core-mode-confirm'));
    await until(() => app.getPathname() === '/login' && probe.source === 'LIVE', 'the Login screen of LIVE mode');
    expect(screen.getByTestId('screen-login')).toBeTruthy();
    expect(await storedSource()).toBe('LIVE');
    expect(fake.log.requestsOf('getDeviceRegistration').length).toBeGreaterThan(0);
  });

  it('Cancel changes nothing: still signed in, still SIMULATED, nothing stored, nothing sent', async () => {
    const engine = createTestSim().sim;
    setCoreLinkSource('SIMULATED'); // the device default is LIVE since 2026-11-05
    scriptCore(engine);
    const app = mountApp('/login');
    await until(() => probe.actions !== null && probe.source === 'SIMULATED', 'the simulator runtime');
    await signInWith(DEMO_OPERATOR_PASSWORD);
    await openPreferences(app);

    fireEvent.press(screen.getByTestId('settings-core-link-LIVE'));
    await wait(20);
    fireEvent.press(screen.getByTestId('settings-core-mode-cancel'));
    await wait(100);
    expect(screen.queryByTestId('settings-core-mode-dialog')).toBeNull();
    // A dismissal (overlay, hardware back) of an idle dialog is a Cancel as well.
    fireEvent.press(screen.getByTestId('settings-core-link-LIVE'));
    await wait(20);
    expect(screen.getByTestId('settings-core-mode-dialog')).toBeTruthy();
    dismissDialog();
    await wait(100);
    expect(screen.queryByTestId('settings-core-mode-dialog')).toBeNull();
    expect(app.getPathname()).toBe('/settings/preferences');
    expect(probe.signedIn).toBe(true);
    expect(probe.source).toBe('SIMULATED');
    expect(await storedSource()).toBe('SIMULATED');
    expect(fake.calls).toHaveLength(0);
  });

  it('the control offers no other segment: nothing to press, no dialog, nothing stored', async () => {
    const engine = createTestSim().sim;
    setCoreLinkSource('SIMULATED'); // the device default is LIVE since 2026-11-05
    scriptCore(engine);
    const app = mountApp('/login');
    await until(() => probe.actions !== null && probe.source === 'SIMULATED', 'the simulator runtime');
    await signInWith(DEMO_OPERATOR_PASSWORD);
    await openPreferences(app);

    // LIVE alone: the older sources are not drawn, so no other boundary can be crossed from here.
    expect(screen.getByTestId('settings-core-link-LIVE')).toBeTruthy();
    expect(screen.queryByTestId('settings-core-link-HEARTBEAT')).toBeNull();
    expect(screen.queryByTestId('settings-core-link-SIMULATED')).toBeNull();
    await wait(100);
    expect(screen.queryByTestId('settings-core-mode-dialog')).toBeNull();
    expect(probe.signedIn).toBe(true);
    expect(app.getPathname()).toBe('/settings/preferences');
  });
});

// KD-15 (D160; S62 §3.15 #10): the three cases of `describe('LIVE → SIMULATED (§3.3; CPM1-2)')`
// that the HOLD deleted, rewritten for the LIVE-only tablet (M3-01). The Settings control draws
// LIVE alone now, so the boundary is no longer crossed from Settings; what the three cases
// guaranteed is pinned on the paths that remain:
//   (1) was "the sign-out (operation 5) is sent once and answered; then SIMULATED, on /login" and
//       "LIVE → HEARTBEAT crosses the boundary too": the source still changes through the debug
//       `core=` link (RT-1, debug builds only), and a stored LIVE session is not left behind.
//   (2) was "the link down: the sign-out ends the session here (D80) … the Core is owed it (W100)":
//       the debt (D90) is kept by the Live source and paid at the next link-up.
//   (3) the segment the old cases pressed is gone, and no other control offers SIMULATED.
describe('LIVE-only: the LIVE → SIMULATED guarantees (§3.3; CPM1-2; KD-15, D160)', () => {
  async function liveSignedIn() {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'LIVE' }));
    globalThis.__DEMS_SECURE_STORE_MOCK__.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
    const engine = createTestSim().sim;
    expect(engine.actions.signIn(OPERATOR.username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    scriptCore(engine);
    const app = mountApp('/login');
    // The Core link is up before the sign-in: a sign-in while it still connects is refused (CORE_OFFLINE).
    await until(() => probe.actions !== null && probe.source === 'LIVE' && probe.online && app.getPathname() === '/login', 'the Login screen of LIVE mode, the link up');
    await signInWith(MARKER_PASSWORD);
    await openPreferences(app);
    expect(coreSession).not.toBeNull();
    return app;
  }

  it('(1) a stored LIVE session is not left behind when the debug `core=` link changes the source: the sign-out (operation 5) is sent exactly once', async () => {
    // The runtime's deep-link listener (`runtime/debug.ts` `useDebugScenarioLinks`), captured so the
    // test can deliver a warm link the way the system does.
    const linking = Linking as unknown as { addEventListener: unknown };
    const originalAddEventListener = linking.addEventListener;
    const urlListeners: ((event: { url: string }) => void)[] = [];
    linking.addEventListener = (_type: string, listener: (event: { url: string }) => void) => {
      urlListeners.push(listener);
      return { remove: () => void urlListeners.splice(urlListeners.indexOf(listener), 1) };
    };
    try {
      const app = await liveSignedIn();
      expect(fake.log.requestsOf('signOut')).toHaveLength(0);
      expect(urlListeners.length).toBeGreaterThan(0);

      act(() => [...urlListeners].forEach((listener) => listener({ url: 'demsdemo:///home?core=SIMULATED' })));
      await until(() => probe.source === 'SIMULATED' && app.getPathname() === '/login', 'the Login screen of SIMULATED mode');
      await wait(300);
      // Exactly once, for THIS session (its bearer), and answered: the Core holds no session of the tablet.
      expect(fake.log.requestsOf('signOut')).toHaveLength(1);
      expect(fake.log.requestsOf('signOut')[0]!.body).toEqual({ reason: 'USER' });
      expect(bearerOf(fake.log.requestsOf('signOut')[0]!.headers)).toBe(FAKE_CREDENTIALS.sessionToken);
      expect(coreSession).toBeNull();
      expect(await storedSource()).toBe('SIMULATED');
      expect(probe.signedIn).toBe(false);
      expect(screen.getByTestId('screen-login')).toBeTruthy();
    } finally {
      linking.addEventListener = originalAddEventListener;
    }
  });

  it('(2) the link down: the sign-out ends the session here (D80); the Core is owed it, and it is sent once at the next link-up (D90)', async () => {
    const app = await liveSignedIn();
    coreDown = true;
    act(() => void fake.connection().drop());
    await until(() => screen.queryByTestId('settings-preferences') !== null, 'Settings after the drop', 2_000);
    await wait(300);

    act(() => router.push('/settings/security' as Href));
    await until(() => screen.queryByTestId('settings-security-sign-out') !== null, 'Settings → Security');
    fireEvent.press(screen.getByTestId('settings-security-sign-out'));
    await until(() => !probe.signedIn && app.getPathname() === '/login', 'the Login screen after the local sign-out');
    // Nothing could be sent: the session ended here, the Core still holds it, and the source is LIVE.
    expect(fake.log.requestsOf('signOut')).toHaveLength(0);
    expect(coreSession).not.toBeNull();
    expect(probe.source).toBe('LIVE');

    // The link comes back: the owed sign-out is sent, once, and the Core's session is closed.
    coreDown = false;
    await until(() => fake.log.requestsOf('signOut').length > 0, 'the owed sign-out at the link-up', 60_000);
    await wait(2_000);
    expect(fake.log.requestsOf('signOut')).toHaveLength(1);
    expect(fake.log.requestsOf('signOut')[0]!.body).toEqual({ reason: 'USER' });
    expect(coreSession).toBeNull();
    expect(probe.signedIn).toBe(false);
    expect(probe.source).toBe('LIVE');
    expect(await storedSource()).toBe('LIVE');
  });

  it('(3) no control offers SIMULATED: the Settings LIVE segment alone, and no way out on the Login', async () => {
    const app = await liveSignedIn();
    expect(screen.getByTestId('settings-core-link-LIVE')).toBeTruthy();
    expect(screen.queryByTestId('settings-core-link-SIMULATED')).toBeNull();
    expect(screen.queryByTestId('settings-core-link-HEARTBEAT')).toBeNull();
    expect(screen.queryByText('Use Simulated mode')).toBeNull();
    // Pressing the one segment there is changes nothing: it is the source already.
    fireEvent.press(screen.getByTestId('settings-core-link-LIVE'));
    await wait(100);
    expect(screen.queryByTestId('settings-core-mode-dialog')).toBeNull();
    expect(probe.signedIn).toBe(true);

    // The Login, with the link down (where the way out used to be offered, L6): Retry alone.
    coreDown = true;
    act(() => void fake.connection().drop());
    act(() => router.push('/settings/security' as Href));
    await until(() => screen.queryByTestId('settings-security-sign-out') !== null, 'Settings → Security');
    fireEvent.press(screen.getByTestId('settings-security-sign-out'));
    await until(() => !probe.signedIn && app.getPathname() === '/login', 'the Login screen after the sign-out');
    await wait(300);
    expect(screen.getByTestId('screen-login')).toBeTruthy();
    expect(screen.queryByTestId('login-use-simulated')).toBeNull();
    expect(screen.queryByText('Use Simulated mode')).toBeNull();
    expect(probe.source).toBe('LIVE');
    expect(await storedSource()).toBe('LIVE');
  });
});

// M3-02 (I63 §4.2; RT-1, D163): the release truth flipped. Was `describe('a release build offers no
// LIVE (MD-3, AC-C-83)')`, whose one case signed in to the simulator and found no Core link control.
// A release build now runs the Live source (row 174 lifted the gates), so:
//   - unpaired, it is a LIVE client on `/pair`, with no simulator and no way to one;
//   - paired, it signs in at the Core, and Settings still shows no Core link control (Fix wave J,
//     JA2-29, N-03): nothing to press, no dialog, nobody signed out, nothing stored.
describe('a release build offers LIVE (MD-3, AC-C-83; RT-1, D163)', () => {
  it('unpaired, it opens on /pair as a LIVE client: no simulator, no "Use Simulated mode", nobody signed in, nothing stored (D163)', async () => {
    const engine = createTestSim().sim;
    scriptCore(engine);
    devGlobal.__DEV__ = false;
    const app = mountApp('/login');
    await until(() => probe.actions !== null && probe.source === 'LIVE' && app.getPathname() === '/pair', 'the Pair screen of LIVE mode');
    await wait(300);
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
    expect(app.getPathname()).toBe('/pair');
    expect(probe.source).toBe('LIVE');
    expect(probe.signedIn).toBe(false);
    expect(screen.queryByTestId('pairing-use-simulated')).toBeNull();
    expect(screen.queryByText('Use Simulated mode')).toBeNull();
    // The Live source asked the Core server, with no credential: nothing was signed in or out.
    expect(fake.log.requestsOf('signIn')).toHaveLength(0);
    expect(fake.log.requestsOf('signOut')).toHaveLength(0);
    expect(await storedSource()).toBeUndefined();
  });

  it('paired, it signs in at the Core; the Core link source is not shown: no segment, no dialog, nobody signed out, nothing stored (D163)', async () => {
    globalThis.__DEMS_SECURE_STORE_MOCK__.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
    const engine = createTestSim().sim;
    scriptCore(engine);
    devGlobal.__DEV__ = false;
    const app = mountApp('/login');
    // The Core link is up before the sign-in: a sign-in while it still connects is refused (CORE_OFFLINE).
    await until(() => probe.actions !== null && probe.source === 'LIVE' && probe.online && app.getPathname() === '/login', 'the Login screen of LIVE mode, the link up');
    await signInWith(MARKER_PASSWORD);
    await openPreferences(app);
    expect(coreSession).not.toBeNull();
    expect(fake.log.requestsOf('signIn')).toHaveLength(1);
    expect(screen.getByTestId('settings-reduce-motion')).toBeTruthy();
    expect(screen.queryByTestId('settings-core-link-LIVE')).toBeNull();
    expect(screen.queryByTestId('settings-core-link-SIMULATED')).toBeNull();
    expect(screen.queryByTestId('settings-core-link-HEARTBEAT')).toBeNull();
    expect(screen.queryByText(/Core link source|developer setup/i)).toBeNull();
    await wait(100);
    expect(screen.queryByTestId('settings-core-mode-dialog')).toBeNull();
    expect(probe.signedIn).toBe(true);
    expect(probe.source).toBe('LIVE');
    expect(await storedSource()).toBeUndefined();
    expect(fake.log.requestsOf('signOut')).toHaveLength(0);
  });
});
