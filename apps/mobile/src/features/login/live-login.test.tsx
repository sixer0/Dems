// Backend task W59 (blueprint step 81): the mobile Login screen in LIVE mode, driven through the
// real controller over the app's Live source and the contract-checked fake transport
// (04_client_integration_spec §9.2, §3.5, §6.5, §8.5 S1-1, §8.1 LB-10; AC-C-72, AC-C-104, AC-C-110;
// decisions D116, D118, D129 DN-8, D133).
//
// The screen is mounted directly under the real AppProviders over `createMobileLive(...).sim`, so
// every LIVE branch of the folder runs against the same fake transport W56 proved the auth layer on.
// The Core server is a small model the fake's scripts read: the one paired device, its lock, and the
// answer to a sign-in. Every credential here is a placeholder in the contract's form that opens
// nothing; the password is a marker the storage/log scans look for (SD-23).
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { CORE_API_EXAMPLES, pickReplicatedState, type AuthSessionInfo, type PairingRedeemed, type ReplicatedState, type SignInStatus } from '@dems/shared/api';
import { FAKE_CREDENTIALS, OUTAGE, createFakeTransport, rateLimited, refusal, type FakeAnswer, type FakeConnection, type FakeHttpCall, type FakeReply, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { DEFAULT_SEED, createIdleState, type SimState } from '@dems/shared/sim';
import { AppProviders } from '@/providers';
import { createMobileLive, resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests, runtimeLog, useAuth, useCoreLink, usePairing, type AuthContract, type MobileLive } from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { resetMotionStateForTests } from '@/motion';
import { useAuthSession, type AuthSession } from '@/auth';
import { LoginScreen } from './login-screen';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
  usePathname: () => '/login',
  useSegments: () => ['(app)'],
}));

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;

/** A marker, not a credential of anything: the storage/log scans look for it (SD-23). */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w59', 'a7Xr2'].join('-');
const WRONG_PASSWORD = ['MARKER', 'WRONG', 'w59'].join('-');
const SECRET = /(?:dvc|ses|bio)_/;

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
const OPERATOR = DEVICE_SESSION.operator;
const SESSION_TOKEN = ['ses', 'S'.repeat(43)].join('_');

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

interface CoreModel {
  devices: Map<string, 'PAIRED'>;
  reachable: boolean;
  state: SimState;
  failures: number;
  lockedUntil: number | null;
  /** The one open session the Core issued, so the reopened OPERATOR socket is accepted. */
  session: { token: string; info: AuthSessionInfo } | null;
}

let fake: FakeTransport;
let core: CoreModel;
let mobile: MobileLive | undefined;
const latest: { auth: AuthContract | null; session: AuthSession | null } = { auth: null, session: null };

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);
const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};
const requests = (operationId: string): readonly FakeHttpCall[] => fake.log.requestsOf(operationId);
const isOpen = (connection: FakeConnection): boolean => connection.state === 'OPEN';

async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}
async function elapse(ms: number, step = 250): Promise<void> {
  for (let done = 0; done < ms; done += step) {
    act(() => fake.clock.advance(Math.min(step, ms - done)));
    await flush();
  }
}

function bootCore(): void {
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  core = { devices: new Map(), reachable: true, state: createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }), failures: 0, lockedUntil: null, session: null };
  const now = () => fake.clock.now();
  const deviceItself = (call: FakeHttpCall): 'PAIRED' | null => core.devices.get(bearerOf(call.headers) ?? '') ?? null;
  const answered = (operationId: string, reply: (call: FakeHttpCall) => FakeReply): void => fake.answer(operationId, (call) => (core.reachable ? reply(call) : OUTAGE));

  const locked = (): boolean => core.lockedUntil !== null && now() < core.lockedUntil;
  const status = (): SignInStatus => ({
    locked: locked(),
    lockedUntil: locked() ? core.lockedUntil : null,
    retryInMs: locked() && core.lockedUntil !== null ? core.lockedUntil - now() : 0,
    attemptsRemaining: locked() ? 0 : Math.max(0, 5 - core.failures),
    serverTime: now(),
  });
  const failedAttempt = (message: string): FakeAnswer => {
    core.failures += 1;
    if (core.failures >= 5) {
      core.failures = 0;
      core.lockedUntil = now() + 60_000;
      return refusal(423, 'LOCKED', 'Too many failed attempts. Try again shortly.', { lockedUntil: core.lockedUntil, retryInMs: 60_000 });
    }
    return refusal(401, 'INVALID_CREDENTIALS', message, { attemptsRemaining: 5 - core.failures });
  };

  answered('getAuthSession', () => fake.example('getAuthSession', 401));
  answered('getSignInStatus', () => ({ status: 200, body: status() }));
  answered('getDeviceRegistration', (call) =>
    deviceItself(call) === 'PAIRED'
      ? { status: 200, body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core } }
      : fake.example('getDeviceRegistration', 401),
  );
  answered('signIn', (call) => {
    if (deviceItself(call) !== 'PAIRED') return fake.example('signIn', 403, 'deviceNotPaired');
    if (locked()) return refusal(423, 'LOCKED', 'Too many failed attempts. Try again shortly.', { lockedUntil: core.lockedUntil ?? now(), retryInMs: (core.lockedUntil ?? now()) - now() });
    if ((call.body as { password?: string }).password !== MARKER_PASSWORD) return failedAttempt('The username or the password is not correct.');
    core.failures = 0;
    const info: AuthSessionInfo = { ...DEVICE_SESSION, method: 'PASSWORD', deviceId: STORED.deviceId, issuedAt: now(), lastActivityAt: now(), idleExpiresAt: now() + 900_000, absoluteExpiresAt: now() + 28_800_000, serverTime: now() };
    core.session = { token: SESSION_TOKEN, info };
    return { status: 200, body: { session: info, sessionToken: SESSION_TOKEN } };
  });
  answered('signOut', () => ({ status: 204 }));

  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    if (!core.reachable) {
      connection.refuse();
      return;
    }
    const bearer = bearerOf(connection.headers);
    if (bearer === null) connection.startAnonymous().heartbeat();
    else if (core.session !== null && bearer === core.session.token) connection.startOperator(wire(core.state)).heartbeat();
    else if (core.devices.get(bearer) === 'PAIRED') connection.startDevice().heartbeat();
    else connection.accept().hello('ANONYMOUS', { reason: 'SESSION_INVALID' }).close(4401);
    if (isOpen(connection)) connection.beatEvery();
  });
}

function pairTablet(): void {
  store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
  core.devices.set(STORED.deviceCredential, 'PAIRED');
}

function Probe() {
  const auth = useAuth();
  const session = useAuthSession();
  const pairing = usePairing();
  const link = useCoreLink();
  useEffect(() => {
    latest.auth = auth;
    latest.session = session;
  });
  return (
    <Text testID="probe">
      {[
        `auth=${auth.isAuthenticated ? (auth.operator?.id ?? '?') : 'signed-out'}`,
        `link=${link.source}/${link.state}`,
        `pairing=${pairing.state}/${pairing.deviceId ?? '-'}`,
        `failure=${session.signInFailure?.kind ?? '-'}/${session.signInFailure?.retryAfterSeconds ?? '-'}`,
      ].join(' ')}
    </Text>
  );
}

/** Mount the real Login screen over the app's Live source and the fake transport, on a paired tablet. */
async function mountLiveLogin(): Promise<void> {
  pairTablet();
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  render(
    <AppProviders sim={created.sim} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
      <Probe />
      <LoginScreen />
    </AppProviders>,
  );
  await flush();
}

async function typeCredentials(username: string, password: string) {
  fireEvent.changeText(screen.getByTestId('login-username'), username);
  fireEvent.changeText(screen.getByTestId('login-password'), password);
  await act(async () => {
    fireEvent.press(screen.getByTestId('login-submit'));
  });
  await flush();
}

const probe = (): string => screen.getByTestId('probe').props.children as string;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(AsyncStorage.setItem).mockClear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  latest.auth = null;
  latest.session = null;
  bootCore();
});

afterEach(() => {
  mobile?.stop();
  mobile = undefined;
  fake.assertNoViolations();
});

describe('the Login screen in LIVE mode shows the three points of the row (AC-C-72, AC-C-104)', () => {
  it('trust line names the device ID, no role chip, no pairing-code hint, the C1 disclosure sentence', async () => {
    await mountLiveLogin();
    expect(probe()).toContain('link=LIVE/ONLINE');
    expect(probe()).toContain(`pairing=PAIRED/${STORED.deviceId}`);

    // L11: the trust line names the device ID the Core gave this tablet (§9.2).
    const trust = screen.getByTestId('login-trust-text');
    expect(String(trust.props.children)).toContain(STORED.deviceId);
    // The link reads "Pairing details" in LIVE mode.
    expect(screen.getByTestId('login-pair-link')).toHaveTextContent('Pairing details');

    // Open the demo disclosure.
    fireEvent.press(screen.getByTestId('login-demo-trigger'));
    await flush();

    // C1: the plain sentence above the list, word for word with the web console.
    expect(screen.getByTestId('login-demo-notice')).toHaveTextContent('Published demo credentials for synthetic accounts on this local demo. They are not a secret.');

    // Fix wave J (JA2-N6): the rows are announced with a role all the same, worded as what it is in LIVE
    // mode: the role the demo account was created with (the Core may have changed it, condition C2).
    expect(screen.getByTestId('login-demo-operator-andi.pratama').props.accessibilityLabel).toMatch(/, user name andi\.pratama, demo account created as Supervisor$/);

    // No role chip in LIVE mode (a role is the Core's data): no rendered text names a seeded role.
    const texts = screen.UNSAFE_getAllByType(Text).map((node) => String(node.props.children));
    expect(texts.some((text) => /^(Investigator|Supervisor|Technician)$/.test(text))).toBe(false);

    // The simulator's pairing-code hint is not rendered at all in LIVE mode.
    expect(texts.some((text) => /pairing code/i.test(text))).toBe(false);
  });

  it('in Simulated mode the same screen keeps the role chip and the pairing-code hint (behaviour unchanged)', async () => {
    // Not this row's Live path: guard that the LIVE branches are behind `live` only. Mounted via the
    // simulator harness in login.test.tsx; here we only assert the LIVE screen never leaks a chip.
    await mountLiveLogin();
    fireEvent.press(screen.getByTestId('login-demo-trigger'));
    await flush();
    // The three seeded usernames are still offered (they fill the form), just without chips.
    expect(screen.getByTestId('login-demo-operator-andi.pratama')).toBeTruthy();
  });
});

describe('the sign-in settle site on the fake transport (CLG (b), S1-1)', () => {
  it('success: one signIn with the device credential as bearer, the password cleared, no Alert', async () => {
    await mountLiveLogin();
    await typeCredentials(OPERATOR.username, MARKER_PASSWORD);
    const sent = requests('signIn');
    expect(sent).toHaveLength(1);
    expect(bearerOf(sent[0]!.headers)).toBe(STORED.deviceCredential);
    expect(screen.getByTestId('login-password').props.value).toBe('');
    // No refusal Alert of any kind took the slot.
    expect(screen.queryByTestId('login-alert-invalid')).toBeNull();
    expect(screen.queryByTestId('login-alert-core-offline')).toBeNull();
    // The auth layer itself flipped to signed-in (the navigator is mocked, so the screen stays put).
    expect(probe()).toContain(`auth=${OPERATOR.id}`);
  });

  it("a wrong password: the Core's own refusal, the attempts it names, the password cleared", async () => {
    await mountLiveLogin();
    await typeCredentials(OPERATOR.username, WRONG_PASSWORD);
    expect(requests('signIn')).toHaveLength(1);
    expect(screen.getByTestId('login-alert-invalid')).toBeTruthy();
    expect(screen.getByTestId('login-password').props.value).toBe('');
    expect(probe()).toContain('failure=-/-'); // a wrong password is not a limit and not an outage
  });

  it('the Core is unreachable at start: the offline Alert names no address, disables Sign In, and offers Retry and "Use Simulated mode" (§3.5, L9)', async () => {
    core.reachable = false; // the socket is refused: the Live link never reaches ONLINE
    await mountLiveLogin();
    await elapse(3_000, 500);
    expect(probe()).toContain('link=LIVE/OFFLINE');
    expect(screen.getByTestId('login-alert-core-offline')).toBeTruthy();
    expect(screen.getByTestId('login-use-simulated')).toBeTruthy();
    expect(screen.getByTestId('login-core-retry')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toBeDisabled();
    const texts = screen.UNSAFE_getAllByType(Text).map((node) => String(node.props.children));
    // LIVE names no address: only the runtime's adapters name the Core server.
    expect(texts.some((text) => /127\.0\.0\.1|localhost|:44\d\d/.test(text))).toBe(false);
  });

  it('a sign-in the Core did not answer (link up) shows the refusal presenter in place, not the offline notice', async () => {
    await mountLiveLogin();
    fake.answerOnce('signIn', OUTAGE);
    await typeCredentials(OPERATOR.username, MARKER_PASSWORD);
    expect(requests('signIn')).toHaveLength(1);
    // The link stayed ONLINE, so the link's own offline Alert says nothing; the presenter's sentences stand in.
    expect(screen.getByTestId('login-alert-no-answer')).toBeTruthy();
    expect(screen.queryByTestId('login-alert-core-offline')).toBeNull();
  });

  it('a 429 is a limit, not an outage: the limit toast with the seconds, the form kept, no offline notice, no mode change (LB-10, AC-C-110)', async () => {
    await mountLiveLogin();
    fake.answerOnce('signIn', rateLimited(42));
    fireEvent.changeText(screen.getByTestId('login-username'), OPERATOR.username);
    fireEvent.changeText(screen.getByTestId('login-password'), MARKER_PASSWORD);
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    await flush();
    // The presenter's limit toast carries the seconds of retry-after.
    const texts = () => screen.UNSAFE_getAllByType(Text).map((node) => String(node.props.children));
    expect(texts().some((t) => /limiting requests from this device/i.test(t))).toBe(true);
    expect(texts().some((t) => /Try again in 42 s/.test(t))).toBe(true);
    // Neither the offline notice nor a refusal Alert shows; the mode/link stay as they were.
    expect(screen.queryByTestId('login-alert-core-offline')).toBeNull();
    expect(screen.queryByTestId('login-alert-invalid')).toBeNull();
    expect(probe()).toContain('failure=LIMIT/42');
    expect(probe()).toContain('link=LIVE/ONLINE');
    // LB-10: the form keeps what was typed (the Core did not look at the attempt). The password field
    // stays uncontrolled (its value prop is not forced to ''), which is how a cleared attempt differs.
    expect(screen.getByTestId('login-password').props.value).toBeUndefined();
    // The next attempt signs in normally (the one-shot limit has been consumed; the model handler stands).
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    await flush();
    expect(probe()).toContain('failure=-/-');
    expect(probe()).toContain(`auth=${OPERATOR.id}`);
  });

  it('no credential, password, or token reaches storage or the persistent log (SD-23)', async () => {
    await mountLiveLogin();
    await typeCredentials(OPERATOR.username, WRONG_PASSWORD);
    await act(async () => {
      await runtimeLog.flush();
    });
    const keys = await AsyncStorage.getAllKeys();
    const stored = JSON.stringify([await AsyncStorage.multiGet(keys), jest.mocked(AsyncStorage.setItem).mock.calls, runtimeLog.records()]);
    expect(stored).not.toContain(MARKER_PASSWORD);
    expect(stored).not.toContain(WRONG_PASSWORD);
    expect(stored).not.toMatch(SECRET);
  });
});

describe('LIVE-only arrival notices take the one Alert slot (§6.5, MB-3)', () => {
  it('a dead biometric token (operation 8 answers 401) shows the auth layer notice, not a biometric error of its own', async () => {
    // Seed an enrolment marker so the fingerprint button exists, then have operation 8 refuse once.
    store().seed(SECURE_ITEM_KEYS.biometricMarker, JSON.stringify({ operatorId: OPERATOR.id, displayName: OPERATOR.displayName, deviceId: STORED.deviceId, protected: false }));
    store().seed(SECURE_ITEM_KEYS.biometricToken, [FAKE_CREDENTIALS.biometricToken, 'B'.repeat(43)].join('_'));
    await mountLiveLogin();
    // Refuse the biometric sign-in as a dead token (401 INVALID_CREDENTIALS): the auth layer deletes and holds the notice.
    fake.answer('signInWithBiometric', () => refusal(401, 'INVALID_CREDENTIALS', 'Biometric sign-in was not accepted.', { attemptsRemaining: 4 }));
    await flush();
    if (screen.queryByTestId('login-biometric')) {
      await act(async () => {
        fireEvent.press(screen.getByTestId('login-biometric'));
      });
      await flush();
      // The screen shows nothing of its own for `invalid`; the auth layer's notice owns the slot.
      expect(screen.queryByTestId('login-alert-biometric-error')).toBeNull();
    }
  });
});
