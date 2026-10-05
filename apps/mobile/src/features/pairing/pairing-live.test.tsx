// Backend task W57: the Pair screen in LIVE mode, on the app's real Live source (`createMobileLive`)
// over the contract-checked fake transport (04_client_integration_spec §9.4, MP-5 to MP-8a, §6.6,
// §3.2; AC-C-75, AC-C-76, AC-C-77, AC-C-80, AC-C-81; SD-23; decisions D116, D124).
//
// The screen is mounted as the app mounts it (`AppProviders`), the secure store is the in-memory
// one of `jest.setup.ts`, and every clock is the fake transport's: the connection steps, the lock
// countdown, the wait after a limit and the hand-off are driven by `elapse`.
//
// THE CODE of these tests is a MARKER (`MARKER_CODE`): six digits that are neither the simulator's
// demo code nor an example of the contract. After a pairing the test looks for it in everything
// the app keeps or prints (SD-23): it may exist in the redeem request, and nowhere else.
// The credentials are the contract's and the fake transport's placeholders: no real value.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Dimensions } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import type { ReactTestInstance } from 'react-test-renderer';
import {
  CORE_API_EXAMPLES,
  pickReplicatedState,
  type AuthSessionInfo,
  type DeviceRegistration,
  type PairingRedeemed,
  type ReplicatedState,
  type SignInResponse,
} from '@dems/shared/api';
import {
  FAKE_CREDENTIALS,
  OUTAGE,
  createFakeTransport,
  rateLimited,
  refusal,
  type FakeConnection,
  type FakeHttpCall,
  type FakeReply,
  type FakeTransport,
} from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import {
  DEFAULT_SEED,
  DEMO_PAIRING_CODE,
  PairingState,
  SimPermissionError,
  buildScenarioState,
  createIdleState,
  type SimState,
} from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { AppProviders } from '@/providers';
import {
  createMobileLive,
  getCoreLinkSource,
  resetCoreErrorPresenterForTests,
  resetCoreLinkPrefsForTests,
  resetDebugLaunchForTests,
  runtimeLog,
  setCoreLinkSource,
  type MobileLive,
} from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { PAIR_TIMELINE } from './pairing-model';
import { PairingScreen } from './pairing-screen';
import { usePairingFlow, type PairingFlow } from './use-pairing-flow';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => false) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

/** The marker code (SD-23). Put together here, so that a search of the tree for it finds this line only. */
const MARKER_CODE = ['604', '173'].join('');
const WRONG_CODE = '000000';

const WINDOWS = {
  phonePortrait: { width: 411, height: 923 },
  tabletLandscape: { width: 1280, height: 800 },
  tabletPortrait: { width: 800, height: 1280 },
} as const;
const METRICS: Metrics = { frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** What a second pairing of the same tablet answers: another device ID, another credential (MP-8). */
const REDEEMED_AGAIN: PairingRedeemed = { ...REDEEMED, deviceId: 'DEV-0007', deviceCredential: FAKE_CREDENTIALS.deviceCredential };
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** Not a real password: the fake Core accepts any on a paired device. */
const PASSWORD = 'not-a-real-password';

const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;

class MockCoreSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

/** What the Core server knows, and whether it answers: the model the fake's scripts read. */
interface CoreModel {
  /** The registry: device credential → the device's ID and state. */
  devices: Map<string, { id: string; state: 'PAIRED' | 'REVOKED' }>;
  /** `hang`: a socket is neither accepted nor refused (the link reads CONNECTING until the client gives up). */
  reachable: boolean | 'hang';
  /** The open session of the tablet, by its token, and the state its socket gets as the snapshot. */
  session: { token: string; info: AuthSessionInfo } | null;
  state: SimState;
  /** What a redeem answers. */
  redeem: (call: FakeHttpCall) => FakeReply;
}

let fake: FakeTransport;
let core: CoreModel;
let mobile: MobileLive | undefined;
/** Everything the app printed to the console during a test (the runtime log prints its records there in a debug build). */
let printed: string[] = [];
let consoleSpies: { mockRestore: () => void }[] = [];

const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};
const requests = (operationId: string): readonly FakeHttpCall[] => fake.log.requestsOf(operationId);
const lastSocket = (): FakeConnection => fake.connection();
const codeOf = (call: FakeHttpCall): unknown => (call.body as { code?: unknown } | undefined)?.code;

/** Promise jobs settle inside `act`: the fake's answers, the connect scripts, the storage mock, the commit of an attempt. */
async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}
/** Moves the fake's clock (the Live clock and every timer of the Live source run on it) in steps, with the promise jobs in between. */
async function elapse(ms: number, step = 100): Promise<void> {
  for (let done = 0; done < ms; done += step) {
    act(() => {
      fake.clock.advance(Math.min(step, ms - done));
    });
    await flush();
  }
}
/** Real time, for the kit's own timers (a dialog mounts one frame after it is asked for). */
async function settleUi(ms = 40): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** A redeem that accepts the marker code once and answers `redeemed`; anything else is the Core's one refusal. */
function accepting(redeemed: PairingRedeemed): CoreModel['redeem'] {
  let used = false;
  return (call) => {
    if (used || codeOf(call) !== MARKER_CODE) return fake.example('redeemPairingCode', 401);
    used = true;
    core.devices.set(redeemed.deviceCredential, { id: redeemed.deviceId, state: 'PAIRED' });
    return { status: 201, body: redeemed };
  };
}

function bootCore(): void {
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  core = {
    devices: new Map(),
    reachable: true,
    session: null,
    state: createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }),
    redeem: () => fake.example('redeemPairingCode', 401),
  };
  const deviceOf = (call: FakeHttpCall) => {
    const bearer = bearerOf(call.headers);
    if (bearer === null) return null;
    if (core.session !== null && bearer === core.session.token) return [...core.devices.values()][0] ?? null;
    return core.devices.get(bearer) ?? null;
  };
  const answered = (operationId: string, reply: (call: FakeHttpCall) => FakeReply): void => fake.answer(operationId, (call) => (core.reachable === true ? reply(call) : OUTAGE));

  // A session read is answered by the credential the request presented.
  answered('getAuthSession', (call) =>
    core.session !== null && bearerOf(call.headers) === core.session.token
      ? { status: 200, body: { ...core.session.info, serverTime: fake.clock.now() } }
      : fake.example('getAuthSession', 401),
  );
  answered('signIn', (call) => {
    if (deviceOf(call)?.state !== 'PAIRED') return fake.example('signIn', 403, 'deviceNotPaired');
    const info: AuthSessionInfo = { ...DEVICE_SESSION, issuedAt: fake.clock.now(), lastActivityAt: fake.clock.now(), serverTime: fake.clock.now() };
    core.session = { token: FAKE_CREDENTIALS.sessionToken, info };
    return { status: 200, body: { session: info, sessionToken: FAKE_CREDENTIALS.sessionToken } satisfies SignInResponse };
  });
  answered('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  answered('getDeviceRegistration', (call) => {
    const device = deviceOf(call);
    if (device === null) return fake.example('getDeviceRegistration', 401);
    if (device.state === 'REVOKED') return refusal(403, 'DEVICE_REVOKED', 'This device was revoked.');
    const body: DeviceRegistration = { deviceId: device.id, name: 'Android device', state: 'PAIRED', pairedAt: REDEEMED.pairedAt, credentialRotatedAt: null, core: REDEEMED.core };
    return { status: 200, body };
  });
  answered('redeemPairingCode', (call) => core.redeem(call));
  answered('unpairDevice', (call) => {
    const bearer = bearerOf(call.headers);
    if (bearer === null || !core.devices.has(bearer)) return fake.example('unpairDevice', 401);
    core.devices.delete(bearer);
    return { status: 204 };
  });

  fake.onConnect((connection) => {
    // A socket the client already gave up gets no script.
    if (connection.state !== 'CONNECTING') return;
    if (core.reachable === 'hang') return;
    if (!core.reachable) {
      connection.refuse();
      return;
    }
    const bearer = bearerOf(connection.headers);
    const device = bearer === null ? null : (core.devices.get(bearer) ?? null);
    if (bearer === null) connection.startAnonymous().heartbeat();
    else if (core.session !== null && bearer === core.session.token) {
      connection.startOperator(pickReplicatedState(JSON.parse(JSON.stringify(core.state)) as ReplicatedState)).heartbeat();
    } else if (device?.state === 'PAIRED') connection.startDevice().heartbeat();
    else if (device?.state === 'REVOKED') {
      connection.accept().hello('ANONYMOUS', { reason: 'DEVICE_REVOKED' }).close(4403);
      return;
    } else {
      connection.accept().hello('ANONYMOUS', { reason: 'SESSION_INVALID' }).close(4401);
      return;
    }
    // The real server beats once a second: a long wait of a test must not look like a dead link.
    connection.beatEvery();
  });
}

/** The tablet holds a credential the Core knows. */
function pairTablet(redeemed: PairingRedeemed = REDEEMED): void {
  store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(redeemed));
  core.devices.set(redeemed.deviceCredential, { id: redeemed.deviceId, state: 'PAIRED' });
}

function createLive(): MobileLive {
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  return created;
}

function setWindow(name: keyof typeof WINDOWS): void {
  const { width, height } = WINDOWS[name];
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });
}

/** Mounts the Pair screen on a Live source, as the app does, and lets the start settle. */
async function mount(options: { live?: MobileLive; window?: keyof typeof WINDOWS } = {}): Promise<{ live: MobileLive; unmount: () => void }> {
  setWindow(options.window ?? 'phonePortrait');
  const live = options.live ?? createLive();
  const { unmount } = render(
    <AppProviders
      sim={live.sim}
      // No garbage-collection timer: nothing outlives the test.
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } })}
      safeAreaMetrics={METRICS}
      heartbeatSocketFactory={() => new MockCoreSocket()}
    >
      <PairingScreen />
    </AppProviders>,
  );
  await flush();
  return { live, unmount };
}

const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') parts.push(node);
    else node.children.forEach(walk);
  };
  walk(screen.getByTestId(testID));
  return parts.join('');
};
/** Every text the screen draws, as one string. */
const screenText = (): string => textOf('screen-pair');
/** The same without the one control that names the other mode on purpose ("Use Simulated mode"). */
const screenClaims = (): string => screenText().replace('Use Simulated mode', '');
const label = (testID: string): unknown => screen.getByTestId(testID).props.accessibilityLabel;
const typeCode = (code: string): void => fireEvent.changeText(screen.getByTestId('pairing-code-input'), code);
const typedCode = (): unknown => screen.getByTestId('pairing-code-input').props.value;
const disabled = (testID: string): boolean => screen.getByTestId(testID).props.accessibilityState?.disabled === true;
const pressPair = (): void => fireEvent.press(screen.getByTestId('pairing-pair'));

/** Types `code`, presses Pair and lets the connection steps run until the code has left the tablet and the answer landed. */
async function attempt(code: string): Promise<void> {
  typeCode(code);
  pressPair();
  await elapse(PAIR_TIMELINE.commitAt);
  await flush();
}

/**
 * SD-23: `marker` is in nothing the app keeps or prints. Searched: every AsyncStorage value (the
 * persisted runtime log `dems.mobile.log.v1` among them, flushed first), every secure-store item,
 * the runtime log in memory, the reports of the Live source, the replica, and the console.
 */
async function expectMarkerNowhere(marker: string): Promise<void> {
  await act(async () => {
    await runtimeLog.flush();
  });
  const keys = await AsyncStorage.getAllKeys();
  const kept: Record<string, string> = {
    asyncStorage: JSON.stringify(await AsyncStorage.multiGet(keys)),
    secureStore: JSON.stringify(store().keys().map((key) => [key, store().peek(key)])),
    runtimeLog: JSON.stringify(runtimeLog.records()),
    liveReports: JSON.stringify(mobile?.live.errors() ?? []),
    replica: JSON.stringify(mobile?.live.store.getState() ?? null),
    console: printed.join('\n'),
  };
  // The persisted log was written: the scan reads something.
  expect(keys).toContain('dems.mobile.log.v1');
  for (const [place, text] of Object.entries(kept)) expect([place, text.includes(marker)]).toEqual([place, false]);
}

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
  resetMissingKeys();
  jest.clearAllMocks();
  mockRouter.canGoBack.mockImplementation(() => false);
  printed = [];
  consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
    jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      printed.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    }),
  );
  bootCore();
});

afterEach(() => {
  cleanup();
  mobile?.stop();
  // No Core action of this screen was read as a value (the Live source's own misuse report).
  expect(mobile?.live.errors().filter((report) => report.source.startsWith('live.misuse')) ?? []).toEqual([]);
  mobile = undefined;
  for (const spy of consoleSpies) spy.mockRestore();
  // Every Live test ends here: what the client swallowed still fails the test.
  fake.assertNoViolations();
});

describe('LIVE mode, unpaired: the screen says what is true (decision D124, item a; §3.2, §9.4)', () => {
  it('reads LIVE and never "simulated"; shows no Core identity, because the tablet has none; offers no way back while the gate holds', async () => {
    const { unmount } = await mount();
    expect(textOf('pairing-simulated-chip')).toBe('LIVE');
    // The notice of the gate has its place above the code card (LIVE mode only).
    expect(screen.getByTestId('pairing-live-stack')).toBeTruthy();
    expect(screenClaims()).not.toMatch(/simulat/i);
    // The sentence of Simulated mode would read "Ready to pair with ." here: the Core's name is not known.
    expect(textOf('pairing-status-line')).toBe('Not paired. The Core identity is shown after pairing.');
    expect(screenText()).not.toMatch(/pair with \./);
    expect(textOf('pairing-state-chip')).toBe('Not paired');
    // The identity list holds what the tablet does know.
    expect(label('pairing-identity-server')).toBe('Core server, This computer, through adb reverse');
    expect(label('pairing-identity-link')).toBe('Link, Connected');
    expect(label('pairing-identity-tablet')).toBe('This tablet, Not paired');
    expect(screen.queryByTestId('pairing-identity-device')).toBeNull();
    expect(screen.queryByTestId('pairing-identity-room')).toBeNull();
    expect(screen.queryByTestId('pairing-identity-last-audit')).toBeNull();
    expect(label('pairing-fingerprint')).toBe('Certificate fingerprint · SHA-256 (DEMO), Shown after pairing');
    expect(screen.getByText('Enter the 6-digit pairing code that a supervisor issued for this tablet in the web console.')).toBeTruthy();
    expect(screen.queryByText('Enter the 6-digit pairing code issued by the Core.')).toBeNull();
    // The gate holds: no back button, and "Use Simulated mode" in place of Cancel.
    expect(screen.queryByTestId('pairing-back')).toBeNull();
    expect(screen.queryByTestId('pairing-cancel')).toBeNull();
    expect(textOf('pairing-use-simulated')).toBe('Use Simulated mode');
    // No code is shown or hinted at: neither the simulator's, nor the marker.
    expect(screenText()).not.toContain(DEMO_PAIRING_CODE);
    expect(disabled('pairing-pair')).toBe(true);
    typeCode('60417');
    expect(disabled('pairing-pair')).toBe(true);
    typeCode(MARKER_CODE);
    expect(disabled('pairing-pair')).toBe(false);
    // Looking at the screen and typing sends nothing but the two public reads of the bootstrap.
    expect([...fake.log.operationIds()].sort()).toEqual(['getAuthSession', 'getSignInStatus']);
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('tablet landscape: both panes side by side, the step descriptions name no empty Core', async () => {
    const { unmount } = await mount({ window: 'tabletLandscape' });
    expect(screen.getByTestId('pane-connection')).toBeTruthy();
    expect(screen.getByTestId('pane-code')).toBeTruthy();
    const style = Object.assign({}, ...[screen.getByTestId('pairing-panes').props.style].flat(3).filter(Boolean)) as { flexDirection?: string };
    expect(style.flexDirection).toBe('row');
    expect(screen.getByText('Reach the Core server')).toBeTruthy();
    expect(screen.getByText('The Core checks the pairing code')).toBeTruthy();
    expect(screenText()).not.toMatch(/Find +on the management network/);
    expect(screenClaims()).not.toMatch(/simulat/i);
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('"Use Simulated mode" stores the simulator as the source and goes to the boot router', async () => {
    setCoreLinkSource('LIVE');
    const { unmount } = await mount();
    fireEvent.press(screen.getByTestId('pairing-use-simulated'));
    expect(getCoreLinkSource()).toBe('SIMULATED');
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem('dems.mobile.prefs.v1')) ?? '{}')).toMatchObject({ coreLinkSource: 'SIMULATED' });
    // Nothing was sent to the Core for it.
    expect([...fake.log.operationIds()].sort()).toEqual(['getAuthSession', 'getSignInStatus']);
    unmount();
  });
});

describe('a correct code (AC-C-75, MP-5, MP-6)', () => {
  it('stores the credential, opens the gate and hands off; the marker code is in no storage and no log (SD-23)', async () => {
    core.redeem = accepting(REDEEMED);
    const { live, unmount } = await mount();
    typeCode(MARKER_CODE);
    pressPair();
    expect(textOf('pairing-status-line')).toBe('Checking the link to the Core server…');
    expect(textOf('pairing-state-chip')).toBe('Pairing…');
    expect(screen.getByTestId('pairing-pair').props.accessibilityState?.busy).toBe(true);
    // The attempt has a Cancel while the code is still on the tablet.
    expect(disabled('pairing-cancel')).toBe(false);
    await elapse(PAIR_TIMELINE.verifyAt);
    expect(textOf('pairing-status-line')).toBe('About to send the code. Cancel now and nothing is sent.');
    await elapse(PAIR_TIMELINE.commitAt - PAIR_TIMELINE.verifyAt - 100);
    // Nothing has left the tablet before `commitAt`.
    expect(requests('redeemPairingCode')).toHaveLength(0);
    expect(store().keys()).toEqual([]);

    await elapse(100);
    await flush();
    // One request: the code, a device name, the platform and the app version; no hardware identifier (MP-5).
    expect(requests('redeemPairingCode')).toHaveLength(1);
    expect(requests('redeemPairingCode')[0]!.body).toEqual({ code: MARKER_CODE, deviceName: expect.any(String), platform: 'android', appVersion: expect.any(String) });
    expect(bearerOf(requests('redeemPairingCode')[0]!.headers)).toBeNull();
    // MP-6: the credential is in secure storage, without an authentication requirement; the gate is open.
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.deviceCredential)!)).toEqual(REDEEMED);
    expect(store().isProtected(SECURE_ITEM_KEYS.deviceCredential)).toBe(false);
    expect(live.getPairing()).toEqual({ required: true, state: 'PAIRED', notice: null, deviceId: REDEEMED.deviceId });
    // The next socket presents the device credential.
    expect(bearerOf(lastSocket().headers)).toBe(REDEEMED.deviceCredential);

    // The paired view: the Core identity of the answer, and the ID the Core gave this tablet.
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    expect(textOf('pairing-state-chip')).toBe('Paired');
    expect(textOf('pairing-status-line')).toBe(`Paired with ${REDEEMED.core.deviceId} as ${REDEEMED.deviceId}.`);
    expect(label('pairing-identity-device')).toBe(`Core device, ${REDEEMED.core.deviceId}`);
    expect(label('pairing-identity-room')).toBe(`Core name, ${REDEEMED.core.name}`);
    expect(label('pairing-identity-tablet')).toBe(`This tablet, ${REDEEMED.deviceId}`);
    // Nobody is signed in, so the replica holds no audit row: the line is left out, not filled with "No pairing event yet".
    expect(screen.queryByTestId('pairing-identity-last-audit')).toBeNull();
    expect(label('pairing-fingerprint')).toBe(`Certificate fingerprint · SHA-256 (DEMO), ${REDEEMED.core.certificateFingerprint}`);
    expect(textOf('pairing-paired-body')).toBe(`This tablet is registered with ${REDEEMED.core.deviceId} as ${REDEEMED.deviceId}. An operator can now sign in on it.`);
    expect(textOf('pairing-simulated-chip')).toBe('LIVE');
    expect(screenClaims()).not.toMatch(/simulat/i);
    // Nobody is signed in: the hand-off goes on to sign-in.
    expect(textOf('pairing-continue')).toBe('Continue to sign-in');
    expect(screen.getByTestId('pairing-handoff')).toBeTruthy();

    // The hand-off, `handoffAfter` after the answer landed: no screen underneath, so the boot router (it resolves to `/login`).
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await elapse(PAIR_TIMELINE.handoffAfter - 100);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await elapse(200);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    // The redeem answer is the Core's own word: one redeem, and no second one from a re-render.
    expect(requests('redeemPairingCode')).toHaveLength(1);

    // SD-23. The search is not blind: it finds the marker where it must be, in the request the tablet sent.
    await expectMarkerNowhere(MARKER_CODE);
    expect(JSON.stringify(requests('redeemPairingCode').map((call) => call.body))).toContain(MARKER_CODE);
    // AC-C-65's half of this row: nothing the app keeps outside secure storage holds the credential.
    const outside = JSON.stringify([await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()), runtimeLog.records(), live.live.errors(), live.live.store.getState(), printed]);
    expect(outside).not.toContain(REDEEMED.deviceCredential);
    expect(outside).not.toMatch(/dvc_|ses_|bio_/);
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('with a screen underneath (opened from sign-in), the hand-off goes back to it', async () => {
    mockRouter.canGoBack.mockImplementation(() => true);
    core.redeem = accepting(REDEEMED);
    const { unmount } = await mount();
    await attempt(MARKER_CODE);
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    await elapse(PAIR_TIMELINE.handoffAfter + 100);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    unmount();
  });
});

describe('the credential is written before the action settles (MP-6)', () => {
  it('at the moment anything says "paired", secure storage already holds the credential', async () => {
    core.redeem = accepting(REDEEMED);
    const { live, unmount } = await mount();
    const storedWhen: Record<string, boolean> = {};
    const note = (moment: string): void => {
      storedWhen[moment] ??= store().has(SECURE_ITEM_KEYS.deviceCredential);
    };
    live.subscribe(() => {
      if (live.getPairing().state === 'PAIRED') note('the gate opened');
    });
    live.live.store.subscribe((state) => {
      if (state.pairing.state === 'PAIRED') note('the replica said PAIRED');
    });
    await attempt(MARKER_CODE);
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    expect(storedWhen).toEqual({ 'the gate opened': true, 'the replica said PAIRED': true });
    unmount();
  });

  it('the app dies between the answer and the settle: the only copy of the credential is in storage, and the next start is PAIRED', async () => {
    core.redeem = accepting(REDEEMED);
    const { live, unmount } = await mount();
    let storedAtTheKill: boolean | null = null;
    let settled = false;
    const stopWatching = live.subscribe(() => {
      if (live.getPairing().state !== 'PAIRED') return;
      // The Core has answered and the write has returned; the action has not settled yet. The app dies here.
      storedAtTheKill = store().has(SECURE_ITEM_KEYS.deviceCredential);
      settled = live.live.store.getState().pairing.state === 'PAIRED';
      stopWatching();
      live.stop();
    });
    await attempt(MARKER_CODE);
    expect(requests('redeemPairingCode')).toHaveLength(1);
    expect(storedAtTheKill).toBe(true);
    // The kill came before the settle: the replica never said PAIRED, and the screen never showed it.
    expect(settled).toBe(false);
    expect(live.live.store.getState().pairing.state).not.toBe('PAIRED');
    expect(screen.queryByTestId('pairing-paired-card')).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    // (`unmount` only: a `cleanup()` in the middle of a test leaves the next render uncommitted.)
    unmount();
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.deviceCredential)!)).toEqual(REDEEMED);

    // The next start of the app: the stored credential is read, the tablet is PAIRED, nothing is redeemed again.
    const next = createLive();
    expect(next).not.toBe(live);
    const second = await mount({ live: next });
    expect(next.getPairing()).toMatchObject({ state: 'PAIRED', deviceId: REDEEMED.deviceId });
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    expect(label('pairing-identity-tablet')).toBe(`This tablet, ${REDEEMED.deviceId}`);
    expect(bearerOf(lastSocket().headers)).toBe(REDEEMED.deviceCredential);
    expect(requests('redeemPairingCode')).toHaveLength(1);
    second.unmount();
  });

  it('a credential that cannot be stored: "not available", the code is cleared, and the runtime removes the registration with one unpair', async () => {
    core.redeem = accepting(REDEEMED);
    const { live, unmount } = await mount();
    store().failNext('write');
    await attempt(MARKER_CODE);
    await flush();
    expect(screen.getByTestId('pairing-alert-unavailable')).toBeTruthy();
    expect(textOf('pairing-alert-body')).toBe('This tablet could not store its credential and asked the Core to remove the registration. Ask a supervisor for a new pairing code.');
    // The code is used up on the Core: it is not kept for a retry, and no Retry is offered for it.
    expect(typedCode()).toBe('');
    expect(screen.queryByTestId('pairing-retry')).toBeNull();
    expect(requests('unpairDevice')).toHaveLength(1);
    expect(core.devices.size).toBe(0);
    expect(store().keys()).toEqual([]);
    expect(live.getPairing()).toMatchObject({ state: 'UNPAIRED' });
    expect(screen.queryByTestId('pairing-paired-card')).toBeNull();
    await expectMarkerNowhere(MARKER_CODE);
    unmount();
  });
});

describe('a refused code (AC-C-76, SR-29)', () => {
  it('a wrong code: "Code not accepted" with the lock\'s count, the slots cleared; never why', async () => {
    const { live, unmount } = await mount();
    await attempt(WRONG_CODE);
    expect(requests('redeemPairingCode')).toHaveLength(1);
    expect(screen.getByTestId('pairing-alert-invalid')).toBeTruthy();
    expect(screen.getByText('Code not accepted')).toBeTruthy();
    // `attemptsRemaining` is the count before the LOCK: it is worded as that, not as attempts left of a code.
    expect(textOf('pairing-alert-body')).toBe('2 more attempts before pairing is locked for a short time.');
    expect(textOf('pairing-status-line')).toBe('The Core did not accept that code.');
    expect(textOf('pairing-state-chip')).toBe('Pairing failed');
    expect(typedCode()).toBe('');
    expect(disabled('pairing-pair')).toBe(true);
    // The answer does not say whether the code was wrong, expired, used or cancelled, and neither does the screen.
    expect(screenText()).not.toMatch(/wrong|expired|already used|cancelled|closed|invalid/i);
    expect(store().keys()).toEqual([]);
    expect(live.getPairing()).toMatchObject({ state: 'UNPAIRED' });

    core.redeem = () => refusal(401, 'INVALID_CODE', 'The pairing code is not valid.', { attemptsRemaining: 1 });
    await attempt(WRONG_CODE);
    expect(requests('redeemPairingCode')).toHaveLength(2);
    expect(textOf('pairing-alert-body')).toBe('1 more attempt before pairing is locked for a short time.');
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('423: the countdown to the Core\'s `lockedUntil` on the Live clock; the slots are disabled; the text blames nobody', async () => {
    const { unmount } = await mount();
    core.redeem = () => refusal(423, 'LOCKED', 'Too many failed pairing attempts. Try again shortly.', { lockedUntil: fake.clock.now() + 60_000, retryInMs: 60_000 });
    await attempt(WRONG_CODE);
    expect(screen.getByTestId('pairing-alert-locked')).toBeTruthy();
    expect(textOf('pairing-status-line')).toBe('Pairing is locked on the Core for a short time.');
    const countdown = () => screen.getByTestId('pairing-alert-locked').findByProps({ accessibilityLiveRegion: 'polite' }).props.accessibilityLabel as string;
    expect(countdown()).toBe('Pairing locked. Try again in 60 seconds.');
    // The lock is global on the Core (it can come from another device): nothing says "your attempts".
    expect(screenText()).not.toMatch(/your|wrong|expired|invalid/i);
    typeCode(MARKER_CODE);
    expect(disabled('pairing-pair')).toBe(true);

    await elapse(30_000, 500);
    expect(countdown()).toBe('Pairing locked. Try again in 30 seconds.');
    await elapse(30_000, 500);
    expect(screen.queryByTestId('pairing-alert-locked')).toBeNull();
    // During the lock nothing was sent.
    expect(requests('redeemPairingCode')).toHaveLength(1);
    typeCode(MARKER_CODE);
    expect(disabled('pairing-pair')).toBe(false);
    unmount();
  });
});

describe('a 429 on redeem is a limit, never a wrong code (decision D116, finding F76)', () => {
  it('says "wait", counts no attempt, keeps the code, and Retry opens after `retry-after`', async () => {
    const { live, unmount } = await mount();
    const before = live.live.store.getState().pairing;
    core.redeem = () => rateLimited(41);
    await attempt(MARKER_CODE);
    expect(requests('redeemPairingCode')).toHaveLength(1);

    expect(screen.getByTestId('pairing-alert-limited')).toBeTruthy();
    expect(screen.queryByTestId('pairing-alert-invalid')).toBeNull();
    expect(screen.queryByText('Code not accepted')).toBeNull();
    expect(textOf('pairing-alert-limited')).toContain('Pairing is not available right now.');
    expect(textOf('pairing-alert-body')).toBe('The Core server is limiting requests. The code was not checked and no attempt was counted.');
    // No count of attempts, no lock, no "offline": the link is as it was.
    expect(screenText()).not.toMatch(/more attempt|attempts remaining|locked|unreachable/i);
    expect(label('pairing-identity-link')).toBe('Link, Connected');
    expect(textOf('pairing-state-chip')).toBe('Not paired');
    expect(live.live.store.getState().pairing).toEqual(before);
    // The code was not judged: it stays in the slots, without the invalid outline, for the retry.
    expect(typedCode()).toBe(MARKER_CODE);
    expect(textOf('pairing-retry')).toBe('Retry in 41s');
    expect(disabled('pairing-retry')).toBe(true);
    expect(disabled('pairing-pair')).toBe(true);
    // Pressing changes nothing while the wait runs.
    fireEvent.press(screen.getByTestId('pairing-retry'));
    pressPair();
    await elapse(40_000, 500);
    expect(textOf('pairing-retry')).toBe('Retry in 1s');
    expect(requests('redeemPairingCode')).toHaveLength(1);

    await elapse(1_000);
    expect(textOf('pairing-retry')).toBe('Retry');
    expect(disabled('pairing-retry')).toBe(false);
    core.redeem = accepting(REDEEMED);
    fireEvent.press(screen.getByTestId('pairing-retry'));
    await elapse(PAIR_TIMELINE.commitAt);
    await flush();
    expect(requests('redeemPairingCode')).toHaveLength(2);
    expect(codeOf(requests('redeemPairingCode')[1]!)).toBe(MARKER_CODE);
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    await expectMarkerNowhere(MARKER_CODE);
    unmount();
  });
});

describe('no judgement of the code: the error form (§9.4 "failed, error form")', () => {
  it('a 500: "Pairing is not available right now." with a paced Retry (3 s, 6 s, 12 s), then no Retry', async () => {
    const { unmount } = await mount();
    core.redeem = () => refusal(500, 'INTERNAL_ERROR', 'The Core server failed.');
    await attempt(MARKER_CODE);
    expect(screen.getByTestId('pairing-alert-unavailable')).toBeTruthy();
    expect(textOf('pairing-alert-body')).toBe('The Core server could not complete the request.');
    expect(textOf('pairing-status-line')).toBe('Pairing is not available right now.');
    expect(typedCode()).toBe(MARKER_CODE);
    expect(textOf('pairing-retry')).toBe('Retry in 3s');
    expect(disabled('pairing-pair')).toBe(true);

    const waits = [3_000, 6_000, 12_000];
    for (const [index, wait] of waits.entries()) {
      expect(requests('redeemPairingCode')).toHaveLength(index + 1);
      if (index < 2) {
        expect(textOf('pairing-retry')).toBe(`Retry in ${wait / 1_000}s`);
        await elapse(wait, 500);
        expect(textOf('pairing-retry')).toBe('Retry');
        fireEvent.press(screen.getByTestId('pairing-retry'));
        await elapse(PAIR_TIMELINE.commitAt);
        await flush();
      }
    }
    // Three attempts in a row without an answer: the Retry control is withdrawn. Pair, a deliberate new attempt, stays behind the wait.
    expect(requests('redeemPairingCode')).toHaveLength(3);
    expect(screen.queryByTestId('pairing-retry')).toBeNull();
    expect(textOf('pairing-retry-exhausted')).toBe('Still not available. Check the Core server, then press Pair to try again.');
    expect(textOf('pairing-wait')).toBe('Try again in 12 seconds.');
    expect(disabled('pairing-pair')).toBe(true);
    await elapse(12_000, 500);
    expect(screen.queryByTestId('pairing-wait')).toBeNull();
    expect(disabled('pairing-pair')).toBe(false);
    expect(requests('redeemPairingCode')).toHaveLength(3);

    // Pair, pressed after the wait with the same code still in the slots, is a fourth attempt in a row: no Retry control, 12 s again.
    pressPair();
    await elapse(PAIR_TIMELINE.commitAt);
    await flush();
    expect(requests('redeemPairingCode')).toHaveLength(4);
    expect(screen.queryByTestId('pairing-retry')).toBeNull();
    expect(textOf('pairing-wait')).toBe('Try again in 12 seconds.');
    await elapse(12_000, 500);

    // A code the operator types again is a new, deliberate attempt: the pacing starts anew, and Retry is offered again.
    typeCode('');
    await attempt(MARKER_CODE);
    expect(requests('redeemPairingCode')).toHaveLength(5);
    expect(screen.queryByTestId('pairing-retry-exhausted')).toBeNull();
    expect(textOf('pairing-retry')).toBe('Retry in 3s');
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('after an answer that judges the code, and the code typed again, the pacing starts anew', async () => {
    const { unmount } = await mount();
    core.redeem = () => refusal(500, 'INTERNAL_ERROR', 'The Core server failed.');
    await attempt(MARKER_CODE);
    expect(textOf('pairing-retry')).toBe('Retry in 3s');
    await elapse(3_000, 500);
    fireEvent.press(screen.getByTestId('pairing-retry'));
    await elapse(PAIR_TIMELINE.commitAt);
    await flush();
    expect(textOf('pairing-retry')).toBe('Retry in 6s');
    await elapse(6_000, 500);
    // The Core answers again, and refuses the code: that is a judgement.
    core.redeem = () => fake.example('redeemPairingCode', 401);
    fireEvent.press(screen.getByTestId('pairing-retry'));
    await elapse(PAIR_TIMELINE.commitAt);
    await flush();
    expect(screen.getByTestId('pairing-alert-invalid')).toBeTruthy();
    // The next attempt without an answer waits 3 s again, not 12 s.
    core.redeem = () => refusal(500, 'INTERNAL_ERROR', 'The Core server failed.');
    await attempt(MARKER_CODE);
    expect(textOf('pairing-retry')).toBe('Retry in 3s');
    expect(requests('redeemPairingCode')).toHaveLength(4);
    unmount();
  });

  it('a request that left and got no answer: the screen says the code may be used up', async () => {
    const { unmount } = await mount();
    // The connection fails after the request left: the tablet cannot know whether the Core redeemed the code.
    core.redeem = () => OUTAGE;
    await attempt(MARKER_CODE);
    expect(requests('redeemPairingCode')).toHaveLength(1);
    expect(screen.getByTestId('pairing-alert-unavailable')).toBeTruthy();
    expect(textOf('pairing-alert-body')).toBe('The Core server did not answer. If this code is refused now, ask a supervisor for a new one.');
    expect(typedCode()).toBe(MARKER_CODE);
    expect(store().keys()).toEqual([]);
    await expectMarkerNowhere(MARKER_CODE);
    unmount();
  });

  it('the link drops between Pair and `commitAt`: nothing is sent, and the offline notice says why', async () => {
    core.redeem = accepting(REDEEMED);
    const { unmount } = await mount();
    typeCode(MARKER_CODE);
    pressPair();
    await elapse(PAIR_TIMELINE.verifyAt);
    core.reachable = false;
    act(() => {
      lastSocket().drop();
    });
    await elapse(PAIR_TIMELINE.commitAt - PAIR_TIMELINE.verifyAt);
    await flush();
    // The Live source sends while the link is ONLINE only (CL-22): the code never left the tablet.
    expect(requests('redeemPairingCode')).toHaveLength(0);
    expect(screen.getByTestId('pairing-alert-offline')).toBeTruthy();
    // The six digits are still there, and Pair stays closed while the Core cannot be reached.
    expect(typedCode()).toBe(MARKER_CODE);
    expect(disabled('pairing-pair')).toBe(true);
    pressPair();
    await elapse(PAIR_TIMELINE.commitAt + 500);
    expect(requests('redeemPairingCode')).toHaveLength(0);
    // The wait after the failed attempt is over (3 s), the Core is still away: Pair is closed by the link alone.
    await elapse(4_000, 500);
    expect(screen.getByTestId('pairing-alert-offline')).toBeTruthy();
    expect(typedCode()).toBe(MARKER_CODE);
    expect(disabled('pairing-pair')).toBe(true);
    expect(store().keys()).toEqual([]);
    unmount();
  });
});

describe('Cancel (AC-C-77)', () => {
  it('before `commitAt` sends no request; while the gate holds it ends the attempt and stays on the screen', async () => {
    core.redeem = accepting(REDEEMED);
    const { unmount } = await mount();
    typeCode(MARKER_CODE);
    pressPair();
    await elapse(PAIR_TIMELINE.commitAt - 100);
    expect(requests('redeemPairingCode')).toHaveLength(0);
    fireEvent.press(screen.getByTestId('pairing-cancel'));
    await elapse(PAIR_TIMELINE.commitAt + 2_000);
    // Nothing left the tablet, then or later.
    expect(requests('redeemPairingCode')).toHaveLength(0);
    expect(fake.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
    expect(store().keys()).toEqual([]);
    expect(core.devices.size).toBe(0);
    // The gate holds: there is no screen to cancel to.
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(textOf('pairing-status-line')).toBe('Not paired. The Core identity is shown after pairing.');
    expect(typedCode()).toBe(MARKER_CODE);
    expect(screen.getByTestId('pairing-use-simulated')).toBeTruthy();
    unmount();
  });

  it('is disabled once the request is out: the answer decides', async () => {
    core.redeem = accepting(REDEEMED);
    const { live, unmount } = await mount();
    const held = fake.hold('redeemPairingCode');
    typeCode(MARKER_CODE);
    pressPair();
    await elapse(PAIR_TIMELINE.commitAt);
    await flush();
    expect(requests('redeemPairingCode')).toHaveLength(1);
    expect(textOf('pairing-status-line')).toBe('The Core is checking the code…');
    expect(disabled('pairing-cancel')).toBe(true);
    fireEvent.press(screen.getByTestId('pairing-cancel'));
    await flush();
    // Still in flight, and nothing was thrown away.
    expect(textOf('pairing-state-chip')).toBe('Pairing…');
    core.devices.set(REDEEMED.deviceCredential, { id: REDEEMED.deviceId, state: 'PAIRED' });
    held.release({ status: 201, body: REDEEMED });
    await flush();
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    expect(live.getPairing()).toMatchObject({ state: 'PAIRED', deviceId: REDEEMED.deviceId });
    expect(requests('redeemPairingCode')).toHaveLength(1);
    unmount();
  });
});

describe('the Core server unreachable (§3.5, §9.4 "offline")', () => {
  it('slots disabled, a danger Alert with a paced Retry that reconnects, and no flicker while the socket retries', async () => {
    core.reachable = false;
    const { unmount } = await mount();
    await elapse(500);
    expect(screen.getByTestId('pairing-alert-offline')).toBeTruthy();
    expect(screen.getByText('Core server unreachable')).toBeTruthy();
    expect(textOf('pairing-status-line')).toBe('Core server unreachable.');
    // Discover is the step in error: the Core was not reached.
    expect(label('pairing-stepper-step-0')).toMatch(/Discover.*failed$/);
    expect(label('pairing-stepper-step-1')).toMatch(/Verify code.*not started$/);
    expect(label('pairing-identity-link')).toBe('Link, Unreachable');
    expect(screen.getByTestId('pairing-code-input').props.editable).toBe(false);
    expect(disabled('pairing-pair')).toBe(true);
    expect(screen.getByTestId('pairing-use-simulated')).toBeTruthy();
    expect(screenText()).not.toMatch(/simulated in|DEMS-IR/);

    // The Live socket keeps trying; between two attempts the link reads CONNECTING. The Alert stays.
    const sockets = fake.connections.length;
    for (let step = 0; step < 40; step += 1) {
      await elapse(250, 250);
      expect(screen.queryByTestId('pairing-alert-offline')).not.toBeNull();
    }
    expect(fake.connections.length).toBeGreaterThan(sockets);

    // An attempt that hangs: the link reads CONNECTING for as long as the socket neither opens nor fails. Still the Alert.
    core.reachable = 'hang';
    let sawConnecting = false;
    for (let step = 0; step < 240 && !sawConnecting; step += 1) {
      await elapse(250, 250);
      sawConnecting = mobile?.live.link === 'CONNECTING';
    }
    expect(sawConnecting).toBe(true);
    expect(screen.queryByTestId('pairing-alert-offline')).not.toBeNull();
    expect(label('pairing-identity-link')).toBe('Link, Unreachable');
    expect(screen.getByTestId('pairing-code-input').props.editable).toBe(false);
    core.reachable = false;
    await elapse(12_000, 500);

    // Retry asks for a socket now, and then waits 3 s.
    const before = fake.connections.length;
    fireEvent.press(screen.getByTestId('pairing-core-retry'));
    await flush();
    expect(fake.connections.length).toBe(before + 1);
    expect(textOf('pairing-core-retry')).toBe('Retry in 3s');
    expect(disabled('pairing-core-retry')).toBe(true);
    // Nothing but the bootstrap's reads was ever tried, and no redeem.
    expect(requests('redeemPairingCode')).toHaveLength(0);

    // The Core is back: the notice goes, the slots open.
    core.reachable = true;
    await elapse(40_000, 500);
    expect(screen.queryByTestId('pairing-alert-offline')).toBeNull();
    expect(label('pairing-stepper-step-0')).toMatch(/Discover.*current$/);
    expect(label('pairing-identity-link')).toBe('Link, Connected');
    expect(screen.getByTestId('pairing-code-input').props.editable).not.toBe(false);
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });
});

describe('unpair on the device (AC-C-80, MP-7)', () => {
  async function openDialog(): Promise<void> {
    fireEvent.press(screen.getByTestId('pairing-unpair'));
    await settleUi();
    expect(screen.getByTestId('pairing-unpair-dialog')).toBeTruthy();
  }

  it('calls operation 22, deletes the three items and stays on the screen with the notice', async () => {
    pairTablet();
    store().seed(SECURE_ITEM_KEYS.biometricToken, FAKE_CREDENTIALS.biometricToken);
    store().seed(SECURE_ITEM_KEYS.biometricMarker, JSON.stringify({ operatorId: 'OPR-001', displayName: 'AKP Budi Santoso', deviceId: REDEEMED.deviceId, protected: false }));
    const { live, unmount } = await mount();
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    // A paired tablet is not gated: the back button is there, and there is no hand-off of an old pairing.
    expect(screen.getByTestId('pairing-back')).toBeTruthy();
    expect(screen.queryByTestId('pairing-handoff')).toBeNull();
    expect(store().keys()).toHaveLength(3);

    await openDialog();
    expect(screen.getByText('You will be signed out. It needs a new pairing code from a supervisor to be used again. A recording in progress continues on the Core.')).toBeTruthy();
    // Keep paired: nothing is sent.
    fireEvent.press(screen.getByTestId('pairing-unpair-cancel'));
    await settleUi(350);
    expect(requests('unpairDevice')).toHaveLength(0);
    expect(store().keys()).toHaveLength(3);

    await openDialog();
    fireEvent.press(screen.getByTestId('pairing-unpair-confirm'));
    await flush();
    await elapse(500);
    expect(requests('unpairDevice')).toHaveLength(1);
    expect(bearerOf(requests('unpairDevice')[0]!.headers)).toBe(REDEEMED.deviceCredential);
    expect(core.devices.size).toBe(0);
    // The three items are gone; the gate is closed with the notice.
    expect(store().keys()).toEqual([]);
    expect(live.getPairing()).toEqual({ required: true, state: 'UNPAIRED', notice: 'unpaired', deviceId: null });
    // The screen stays: the code prompt, with the info notice above the card.
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('pairing-code-card')).toBeTruthy();
    expect(screen.getByTestId('pairing-notice-unpaired')).toBeTruthy();
    expect(textOf('pairing-notice-body')).toBe('This tablet was unpaired.');
    // The notice says it; no toast repeats it (the notice's title is the only "Tablet unpaired" on screen).
    expect(screen.getAllByText('Tablet unpaired')).toHaveLength(1);
    expect(label('pairing-identity-tablet')).toBe('This tablet, Not paired');
    expect(screen.queryByTestId('pairing-back')).toBeNull();
    // The socket that was reopened presents nothing.
    expect(bearerOf(lastSocket().headers)).toBeNull();
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('while the link is down it is refused: no request, nothing deleted, the tablet stays PAIRED', async () => {
    pairTablet();
    const { live, unmount } = await mount();
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    core.reachable = false;
    act(() => {
      lastSocket().drop();
    });
    await flush();
    const sent = fake.calls.length;

    await openDialog();
    fireEvent.press(screen.getByTestId('pairing-unpair-confirm'));
    await flush();
    await settleUi(350);
    // LB-6: the app's one wording for a dead link.
    expect(screen.getAllByText('Core server unreachable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nothing was changed.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Tablet unpaired')).toBeNull();
    // No local-only unpair: the registry never keeps a device the tablet has forgotten.
    expect(requests('unpairDevice')).toHaveLength(0);
    expect(fake.calls.filter((call) => call.method === 'POST').length).toBe(0);
    expect(fake.calls.length).toBe(sent);
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.deviceCredential)!)).toEqual(REDEEMED);
    expect(live.getPairing()).toMatchObject({ state: 'PAIRED', notice: null, deviceId: REDEEMED.deviceId });
    expect(core.devices.size).toBe(1);
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    expect(screen.queryByTestId('pairing-unpair-dialog')).toBeNull();
    unmount();
  });
});

describe('re-pairing after a reinstall (AC-C-81, MP-8, E7)', () => {
  it('with an empty secure store the tablet is unpaired again, and a new pairing shows a NEW device ID', async () => {
    core.redeem = accepting(REDEEMED);
    const first = await mount();
    await attempt(MARKER_CODE);
    expect(label('pairing-identity-tablet')).toBe(`This tablet, ${REDEEMED.deviceId}`);
    first.unmount();
    first.live.stop();

    // An uninstall takes the secure-store items with it (MP-4); the Core still lists the old device.
    store().reset();
    expect(core.devices.get(REDEEMED.deviceCredential)).toMatchObject({ id: REDEEMED.deviceId, state: 'PAIRED' });

    core.redeem = accepting(REDEEMED_AGAIN);
    const second = await mount({ live: createLive() });
    expect(second.live.getPairing()).toEqual({ required: true, state: 'UNPAIRED', notice: null, deviceId: null });
    expect(screen.getByTestId('pairing-code-card')).toBeTruthy();
    // No notice: nothing was revoked, the tablet simply holds no credential.
    expect(screen.queryByTestId('pairing-notice-revoked')).toBeNull();
    expect(screen.queryByTestId('pairing-notice-unknown')).toBeNull();
    expect(bearerOf(lastSocket().headers)).toBeNull();

    await attempt(MARKER_CODE);
    expect(requests('redeemPairingCode')).toHaveLength(2);
    expect(second.live.getPairing()).toMatchObject({ state: 'PAIRED', deviceId: REDEEMED_AGAIN.deviceId });
    expect(REDEEMED_AGAIN.deviceId).not.toBe(REDEEMED.deviceId);
    expect(label('pairing-identity-tablet')).toBe(`This tablet, ${REDEEMED_AGAIN.deviceId}`);
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.deviceCredential)!)).toEqual(REDEEMED_AGAIN);
    // The old device stays in the registry until a supervisor revokes it; the app does not rotate a credential (MP-8a).
    expect(core.devices.size).toBe(2);
    expect(requests('rotateDeviceCredential')).toHaveLength(0);
    await expectMarkerNowhere(MARKER_CODE);
    second.unmount();
  });
});

describe('the notices of the gate (§9.4, §6.6)', () => {
  it('`unknown`: a stored credential the Core does not know; the notice goes with the next attempt', async () => {
    // Another database: the tablet holds a credential, the Core's registry does not.
    store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(REDEEMED));
    const { live, unmount } = await mount();
    await elapse(500);
    expect(live.getPairing()).toMatchObject({ state: 'UNPAIRED', notice: 'unknown' });
    expect(screen.getByTestId('pairing-notice-unknown')).toBeTruthy();
    expect(textOf('pairing-notice-body')).toBe('This tablet is not registered with this Core. Ask a supervisor for a new pairing code.');
    expect(store().keys()).toEqual([]);
    typeCode(WRONG_CODE);
    pressPair();
    expect(screen.queryByTestId('pairing-notice-unknown')).toBeNull();
    await elapse(PAIR_TIMELINE.commitAt);
    await flush();
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('`revoked`: the Core revoked this tablet while the screen was open', async () => {
    pairTablet();
    const { live, unmount } = await mount();
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    core.devices.set(REDEEMED.deviceCredential, { id: REDEEMED.deviceId, state: 'REVOKED' });
    act(() => {
      lastSocket().deviceRevoked('REVOKED');
    });
    await flush();
    await elapse(500);
    expect(live.getPairing()).toMatchObject({ state: 'UNPAIRED', notice: 'revoked' });
    expect(store().keys()).toEqual([]);
    expect(screen.getByTestId('pairing-code-card')).toBeTruthy();
    expect(screen.getByTestId('pairing-notice-revoked')).toBeTruthy();
    // Nobody was signed in and nothing recorded: the sentence about a recording is not added.
    expect(textOf('pairing-notice-body')).toBe("This tablet's pairing was revoked on the Core. Ask a supervisor for a new pairing code.");
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });
});

describe('`revoked` while a recording ran (§6.6)', () => {
  it('the notice adds that the recording continues on the Core', async () => {
    pairTablet();
    // What the Core shows a signed-in operator of this tablet: a session that is RECORDING.
    core.state = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
    const { live, unmount } = await mount();
    await act(async () => {
      await live.live.actions.signIn('budi.santoso', PASSWORD).then(
        () => undefined,
        () => undefined,
      );
    });
    await flush();
    expect(live.live.store.getState().session?.state).toBe('RECORDING');

    core.devices.set(REDEEMED.deviceCredential, { id: REDEEMED.deviceId, state: 'REVOKED' });
    core.session = null;
    act(() => {
      lastSocket().deviceRevoked('REVOKED');
    });
    await flush();
    await elapse(500);
    expect(live.live.lastSessionEnd).toMatchObject({ kind: 'DEVICE_REVOKED', reason: 'REVOKED', sessionState: 'RECORDING' });
    expect(screen.getByTestId('pairing-notice-revoked')).toBeTruthy();
    expect(textOf('pairing-notice-body')).toBe("This tablet's pairing was revoked on the Core. Ask a supervisor for a new pairing code. The recording continues on the Core.");
    expect(store().keys()).toEqual([]);
    // Nothing more is sent with the retired credential or the ended session (decision D116).
    const sentBefore = fake.calls.length;
    await elapse(3_000, 500);
    for (const call of fake.calls.slice(sentBefore)) expect([call.operationId, bearerOf(call.headers)]).toEqual([call.operationId, null]);
    expect(bearerOf(lastSocket().headers)).toBeNull();
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });
});

describe('the controller itself (`usePairingFlow`)', () => {
  let flow: PairingFlow | null = null;
  function FlowProbe() {
    const current = usePairingFlow();
    useEffect(() => {
      flow = current;
    });
    return null;
  }
  const now = (): PairingFlow => {
    if (flow === null) throw new Error('the probe is not mounted');
    return flow;
  };

  it('`cancel()` does nothing once the request is out, whatever calls it', async () => {
    core.redeem = accepting(REDEEMED);
    const live = createLive();
    const { unmount } = render(
      <AppProviders
        sim={live.sim}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } })}
        safeAreaMetrics={METRICS}
        heartbeatSocketFactory={() => new MockCoreSocket()}
      >
        <FlowProbe />
      </AppProviders>,
    );
    await flush();
    expect(now()).toMatchObject({ live: true, link: 'online', blocked: true, view: 'unpaired', sent: false, canPair: false });
    act(() => now().setCode(`${MARKER_CODE}99`));
    // Six digits at most, digits only.
    expect(now().code).toBe(MARKER_CODE);
    expect(now().canPair).toBe(true);

    const held = fake.hold('redeemPairingCode');
    act(() => now().pair());
    await elapse(PAIR_TIMELINE.commitAt);
    await flush();
    expect(now()).toMatchObject({ view: 'pairing', sent: true });
    expect(requests('redeemPairingCode')).toHaveLength(1);

    act(() => now().cancel());
    await flush();
    // Still in flight: the attempt was not thrown away, and nothing was navigated.
    expect(now()).toMatchObject({ view: 'pairing', sent: true });
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    core.devices.set(REDEEMED.deviceCredential, { id: REDEEMED.deviceId, state: 'PAIRED' });
    held.release({ status: 201, body: REDEEMED });
    await flush();
    expect(now()).toMatchObject({ view: 'paired', sent: false, tabletId: REDEEMED.deviceId, handingOff: true });
    // The redeemed code is dropped from the controller's memory: it is used up.
    expect(now().code).toBe('');
    expect(requests('redeemPairingCode')).toHaveLength(1);
    unmount();
    flow = null;
  });
});

describe('SIMULATED mode, where the existing tests do not reach: a simulator that throws', () => {
  // The simulator's `pair` and `unpair` do not throw today. If one ever does, the screen says what it
  // said before Live mode, whatever the class of the error: none of the LIVE wording, no toast of the
  // refusal presenter.
  const refused = () => new SimPermissionError('pair', 'PAIRING_MANAGE');

  it('`pair` throws: the screen\'s own generic Alert, and the slots are cleared', async () => {
    setWindow('phonePortrait');
    const test = createTestSim({ initialPairing: PairingState.UNPAIRED });
    const thrown = jest.spyOn(test.sim.actions, 'pair').mockImplementation(() => {
      throw refused();
    });
    renderWithRuntime(<PairingScreen />, { sim: test.sim });
    await flushAsync();
    expect(textOf('pairing-simulated-chip')).toBe('SIMULATED');
    // The code card stands where it stood: no LIVE wrapper around it.
    expect(screen.queryByTestId('pairing-live-stack')).toBeNull();
    typeCode(DEMO_PAIRING_CODE);
    pressPair();
    await act(async () => {
      test.advance(PAIR_TIMELINE.commitAt);
      await Promise.resolve();
    });
    expect(thrown).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('pairing-alert-error')).toBeTruthy();
    expect(screen.getByText('Pairing could not be completed')).toBeTruthy();
    expect(textOf('pairing-alert-body')).toBe('Something went wrong. Please try again.');
    expect(screen.queryByTestId('pairing-alert-unavailable')).toBeNull();
    expect(screen.queryByTestId('pairing-retry')).toBeNull();
    expect(typedCode()).toBe('');
    // No wait is imposed: six digits open Pair at once, as before.
    typeCode(DEMO_PAIRING_CODE);
    expect(disabled('pairing-pair')).toBe(false);
    expect(textOf('pairing-cancel')).toBe('Cancel');
    thrown.mockRestore();
  });

  it('`unpair` throws: "Could not unpair. Please try again.", the dialog closes, the tablet stays paired', async () => {
    setWindow('phonePortrait');
    const test = createTestSim({ initialPairing: PairingState.PAIRED });
    const thrown = jest.spyOn(test.sim.actions, 'unpair').mockImplementation(() => {
      throw refused();
    });
    renderWithRuntime(<PairingScreen />, { sim: test.sim });
    await flushAsync();
    fireEvent.press(screen.getByTestId('pairing-unpair'));
    await settleUi();
    // The dialog of Simulated mode, with its own text.
    expect(screen.getByText('The tablet will no longer be bound to DEMS-IR-01. You can pair it again with a new code. The action is written to the audit log.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('pairing-unpair-confirm'));
    await settleUi(350);
    expect(thrown).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Could not unpair. Please try again.').length).toBeGreaterThan(0);
    // Not the refusal presenter's wording, which belongs to LIVE mode.
    expect(screen.queryByText('Not permitted')).toBeNull();
    expect(test.sim.store.getState().pairing.state).toBe('PAIRED');
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    expect(screen.queryByTestId('pairing-unpair-dialog')).toBeNull();
    thrown.mockRestore();
  });
});
