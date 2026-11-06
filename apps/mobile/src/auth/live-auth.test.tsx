// Backend task W56: the auth layer in LIVE mode (`LiveAuthProvider`), mounted by the real
// `AppProviders` over the app's Live source and the contract-checked fake transport
// (04_client_integration_spec §6.5, §8.5 S1-1 to S1-3, §9.2, §9.3; AC-C-65, AC-C-67 to AC-C-70,
// AC-C-105, AC-C-108; implementation/41 section 8; finding F72).
//
// The Core server is a small model the fake's scripts read (`core`): the devices it knows, the one
// open session, the lock of the device, and the biometric token family (single use, rotation,
// reuse). The secure store and the OS prompt are the mocks of `jest.setup.ts`. Every credential
// here is a placeholder in the contract's form that opens nothing; the password and the pairing
// code are markers the storage scans look for.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect } from 'react';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import {
  CORE_API_EXAMPLES,
  pickReplicatedState,
  type AuthSessionInfo,
  type DeviceRegistration,
  type PairingRedeemed,
  type ReplicatedState,
  type SignInStatus,
} from '@dems/shared/api';
import { FAKE_CREDENTIALS, OUTAGE, createFakeTransport, notReady, rateLimited, refusal, type FakeAnswer, type FakeConnection, type FakeHttpCall, type FakeReply, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { DEFAULT_SEED, createIdleState, type SimState } from '@dems/shared/sim';
import { useBootHref } from '@/navigation';
import { AppProviders } from '@/providers';
import {
  createMobileLive,
  isPairingBlocked,
  resetCoreErrorPresenterForTests,
  resetCoreLinkPrefsForTests,
  resetDebugLaunchForTests,
  runtimeLog,
  useAuth,
  useCoreLink,
  usePairing,
  type AuthContract,
  type MobileLive,
  type SignInResult,
} from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { AuthNoticeAlert } from './auth-notice';
import { MOBILE_AUTH_KEY, resetAuthPrefsForTests } from './auth-prefs';
import { useAuthSession, type AuthSession } from './auth-session';
import type { BiometricSignInResult } from './biometric';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
};
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;
const device = () => globalThis.__DEMS_DEVICE_MOCK__;
const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);

/** A marker, not a credential of anything: the storage scans look for it (SD-23). */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w56', 'k3Zq9'].join('-');
const MARKER_PAIRING_CODE = ['918', '273'].join('');
const WRONG_PASSWORD = ['MARKER', 'WRONG', 'w56'].join('-');
/** Placeholders in the contract's form (`bio_` / `ses_` and 43 characters). They open nothing. */
const placeholder = (prefix: 'bio' | 'ses', fill: string): string => [prefix, fill.repeat(43)].join('_');
const BIO = [FAKE_CREDENTIALS.biometricToken, placeholder('bio', 'B'), placeholder('bio', 'C'), placeholder('bio', 'D')] as const;
const SESSIONS = [FAKE_CREDENTIALS.sessionToken, placeholder('ses', 'S'), placeholder('ses', 'T'), placeholder('ses', 'U')] as const;
const SECRET = /(?:dvc|ses|bio)_/;

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
const OPERATOR = DEVICE_SESSION.operator;
const REGISTRATION: DeviceRegistration = {
  deviceId: STORED.deviceId,
  name: 'Android device',
  state: 'PAIRED',
  pairedAt: STORED.pairedAt,
  credentialRotatedAt: null,
  core: STORED.core,
};
const IDLE_MS = 15 * 60_000;
const ABSOLUTE_MS = 8 * 60 * 60_000;
const LOCK_MS = 60_000;

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

/** What the Core server knows: the model the fake's scripts read and change. */
interface CoreModel {
  devices: Map<string, 'PAIRED' | 'REVOKED'>;
  session: { token: string; info: AuthSessionInfo } | null;
  sessionsIssued: number;
  reachable: boolean;
  state: SimState;
  /** The token family of the tablet's operator: the live one, the used ones, how many were issued. */
  bio: { live: string | null; used: Set<string>; issued: number };
  failures: number;
  lockedUntil: number | null;
  /** An OPERATOR socket gets `hello` and no snapshot until the test sends it. */
  holdSnapshot: boolean;
  held: FakeConnection[];
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
const operatorSocket = (): FakeConnection => {
  const found = [...fake.connections].reverse().find((connection) => connection.principal === 'OPERATOR' && connection.state === 'OPEN');
  if (!found) throw new Error('no open OPERATOR socket');
  return found;
};

async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}
async function elapse(ms: number, step = 250): Promise<void> {
  for (let done = 0; done < ms; done += step) {
    act(() => {
      fake.clock.advance(Math.min(step, ms - done));
    });
    await flush();
  }
}

function bootCore(): void {
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  core = {
    devices: new Map(),
    session: null,
    sessionsIssued: 0,
    reachable: true,
    state: createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }),
    bio: { live: null, used: new Set(), issued: 0 },
    failures: 0,
    lockedUntil: null,
    holdSnapshot: false,
    held: [],
  };
  const now = () => fake.clock.now();
  const sessionOf = (call: FakeHttpCall): CoreModel['session'] => (core.session !== null && bearerOf(call.headers) === core.session.token ? core.session : null);
  /** The device the request's own credential names: never a session token. */
  const deviceItself = (call: FakeHttpCall): 'PAIRED' | 'REVOKED' | null => core.devices.get(bearerOf(call.headers) ?? '') ?? null;
  const deviceOf = (call: FakeHttpCall): 'PAIRED' | 'REVOKED' | null => (sessionOf(call) !== null ? 'PAIRED' : deviceItself(call));
  const answered = (operationId: string, reply: (call: FakeHttpCall) => FakeReply): void => fake.answer(operationId, (call) => (core.reachable ? reply(call) : OUTAGE));

  const locked = (): boolean => core.lockedUntil !== null && now() < core.lockedUntil;
  const status = (): SignInStatus => ({
    locked: locked(),
    lockedUntil: locked() ? core.lockedUntil : null,
    retryInMs: locked() && core.lockedUntil !== null ? core.lockedUntil - now() : 0,
    attemptsRemaining: locked() ? 0 : Math.max(0, 5 - core.failures),
    serverTime: now(),
  });
  const lockedAnswer = (): FakeAnswer =>
    refusal(423, 'LOCKED', 'Too many failed attempts. Try again shortly.', { lockedUntil: core.lockedUntil ?? now(), retryInMs: (core.lockedUntil ?? now()) - now() });
  /** One failure on the device's counter; the fifth locks the device and answers 423 itself. */
  const failedAttempt = (message: string): FakeAnswer => {
    core.failures += 1;
    if (core.failures >= 5) {
      core.failures = 0;
      core.lockedUntil = now() + LOCK_MS;
      return lockedAnswer();
    }
    return refusal(401, 'INVALID_CREDENTIALS', message, { attemptsRemaining: 5 - core.failures });
  };
  const issue = (method: 'PASSWORD' | 'BIOMETRIC', biometricToken?: string): FakeAnswer => {
    const token = SESSIONS[core.sessionsIssued]!;
    core.sessionsIssued += 1;
    core.failures = 0;
    const info: AuthSessionInfo = {
      ...DEVICE_SESSION,
      method,
      deviceId: STORED.deviceId,
      issuedAt: now(),
      lastActivityAt: now(),
      idleExpiresAt: now() + IDLE_MS,
      absoluteExpiresAt: now() + ABSOLUTE_MS,
      serverTime: now(),
    };
    core.session = { token, info };
    return { status: 200, body: { session: info, sessionToken: token, ...(biometricToken === undefined ? {} : { biometricToken }) } };
  };
  const nextBiometricToken = (): string => {
    const token = BIO[core.bio.issued]!;
    core.bio.issued += 1;
    core.bio.live = token;
    return token;
  };

  answered('getAuthSession', (call) => {
    const session = sessionOf(call);
    return session ? { status: 200, body: { ...session.info, serverTime: now() } } : fake.example('getAuthSession', 401);
  });
  answered('getSignInStatus', () => ({ status: 200, body: status() }));
  answered('getDeviceRegistration', (call) => {
    const state = deviceOf(call);
    if (state === 'PAIRED') return { status: 200, body: REGISTRATION };
    if (state === 'REVOKED') return refusal(403, 'DEVICE_REVOKED', 'This device was revoked.');
    return fake.example('getDeviceRegistration', 401);
  });
  answered('redeemPairingCode', (call) => {
    if ((call.body as { code?: string }).code !== MARKER_PAIRING_CODE) return fake.example('redeemPairingCode', 401);
    core.devices.set(STORED.deviceCredential, 'PAIRED');
    return { status: 201, body: STORED };
  });
  answered('signIn', (call) => {
    if (deviceItself(call) !== 'PAIRED') return fake.example('signIn', 403, 'deviceNotPaired');
    if (locked()) return lockedAnswer();
    if ((call.body as { password?: string }).password !== MARKER_PASSWORD) return failedAttempt('The username or the password is not correct.');
    return issue('PASSWORD');
  });
  answered('signOut', (call) => {
    if (sessionOf(call) === null) return fake.example('signOut', 401);
    core.session = null;
    return { status: 204 };
  });
  answered('touchSession', (call) => {
    const session = sessionOf(call);
    if (session === null) return fake.example('touchSession', 401);
    return { status: 200, body: { idleExpiresAt: now() + IDLE_MS, absoluteExpiresAt: session.info.absoluteExpiresAt } };
  });
  answered('setBiometricEnrollment', (call) => {
    const session = sessionOf(call);
    if (session === null) return fake.example('setBiometricEnrollment', 401);
    if ((call.body as { enabled: boolean }).enabled === false) {
      core.bio.live = null;
      return { status: 200, body: { enabled: false } };
    }
    if (session.info.method !== 'PASSWORD') {
      return refusal(403, 'DEVICE_NOT_PAIRED', 'Sign in with your password to turn biometric sign-in on.', { reason: 'PASSWORD_SESSION_REQUIRED' });
    }
    return { status: 200, body: { enabled: true, token: nextBiometricToken(), expiresAt: now() + 30 * 24 * 60 * 60_000 } };
  });
  answered('signInWithBiometric', (call) => {
    // Decision D118: only the device's own credential; a session token of the device is refused.
    if (sessionOf(call) !== null) return refusal(403, 'DEVICE_NOT_PAIRED', 'This operation needs the device credential.', { reason: 'DEVICE_CREDENTIAL_REQUIRED' });
    if (deviceItself(call) !== 'PAIRED') return fake.example('signInWithBiometric', 401, 'noDeviceCredential');
    if (locked()) return lockedAnswer();
    const presented = (call.body as { token: string }).token;
    if (core.bio.used.has(presented)) {
      // A reuse: the family is revoked and the session it opened is ended, as the Core does it.
      core.bio.live = null;
      if (core.session !== null && core.session.info.method === 'BIOMETRIC') {
        core.session = null;
        operatorSocket().sessionEnded('TOKEN_REUSE');
      }
      return failedAttempt('Biometric sign-in was not accepted. Sign in with the password.');
    }
    if (core.bio.live === null || presented !== core.bio.live) return failedAttempt('Biometric sign-in was not accepted. Sign in with the password.');
    core.bio.used.add(presented);
    return issue('BIOMETRIC', nextBiometricToken());
  });
  answered('reportBiometricFailure', (call) => {
    if (deviceOf(call) !== 'PAIRED') return fake.example('reportBiometricFailure', 401);
    if (!locked()) {
      core.failures += 1;
      if (core.failures >= 5) {
        core.failures = 0;
        core.lockedUntil = now() + LOCK_MS;
      }
    }
    return { status: 200, body: status() };
  });

  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    if (!core.reachable) {
      connection.refuse();
      return;
    }
    const bearer = bearerOf(connection.headers);
    if (bearer === null) connection.startAnonymous().heartbeat();
    else if (core.session !== null && bearer === core.session.token) {
      if (core.holdSnapshot) {
        connection.accept().hello('OPERATOR').heartbeat();
        core.held.push(connection);
      } else connection.startOperator(wire(core.state)).heartbeat();
    } else if (core.devices.get(bearer) === 'PAIRED') connection.startDevice().heartbeat();
    else if (core.devices.get(bearer) === 'REVOKED') connection.accept().hello('ANONYMOUS', { reason: 'DEVICE_REVOKED' }).close(4403);
    else connection.accept().hello('ANONYMOUS', { reason: 'SESSION_INVALID' }).close(4401);
    // The link stays up while the test moves the clock.
    if (isOpen(connection)) connection.beatEvery();
  });
}

/** The tablet holds a device credential the Core knows. */
function pairTablet(): void {
  store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
  core.devices.set(STORED.deviceCredential, 'PAIRED');
}

/** The tablet holds an enrolment of the operator: the token the Core issued, and its marker. */
function enrolTablet(options: { protectedItem?: boolean; token?: string } = {}): void {
  const token = options.token ?? BIO[0];
  core.bio.live = token;
  core.bio.issued = Math.max(core.bio.issued, BIO.indexOf(token as (typeof BIO)[number]) + 1);
  store().seed(SECURE_ITEM_KEYS.biometricToken, token, options.protectedItem === true);
  store().seed(
    SECURE_ITEM_KEYS.biometricMarker,
    JSON.stringify({ operatorId: OPERATOR.id, displayName: OPERATOR.displayName, deviceId: STORED.deviceId, protected: options.protectedItem === true }),
  );
}

function Probe() {
  const auth = useAuth();
  const session = useAuthSession();
  const pairing = usePairing();
  const link = useCoreLink();
  const boot = useBootHref();
  // What the tests call: the values of the last commit.
  useEffect(() => {
    latest.auth = auth;
    latest.session = session;
  });
  return (
    <>
      <Text testID="probe">
        {[
          `auth=${auth.isAuthenticated ? (auth.operator?.id ?? '?') : 'signed-out'}`,
          `role=${auth.operator?.role ?? '-'}`,
          `boot=${boot}`,
          `link=${link.source}/${link.state}`,
          `pairing=${pairing.state}/${pairing.deviceId ?? '-'}`,
          `blocked=${isPairingBlocked(pairing)}`,
          `lastSignOut=${session.lastSignOut ?? '-'}`,
          `notice=${session.notice?.kind ?? '-'}`,
          `bio=${session.biometric.enabled ? session.biometric.lastOperatorId : 'off'}/${String(session.biometric.protected)}/${session.biometric.changeBlocked ? 'blocked' : 'open'}`,
          `locked=${session.lockout.locked}/${session.lockout.retryInSeconds}/${session.lockout.attemptsRemaining}`,
          `failure=${session.signInFailure?.kind ?? '-'}/${session.signInFailure?.retryAfterSeconds ?? '-'}`,
        ].join(' ')}
      </Text>
      <AuthNoticeAlert />
    </>
  );
}
const probe = () => screen.getByTestId('probe').props.children as string;

function mountApp() {
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  const view = render(
    <AppProviders sim={created.sim} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
      <Probe />
    </AppProviders>,
  );
  return { ...view, live: created };
}

/** A paired tablet, mounted, with the link up. */
async function startPaired() {
  pairTablet();
  const mounted = mountApp();
  await flush();
  expect(probe()).toContain('link=LIVE/ONLINE');
  expect(probe()).toContain(`pairing=PAIRED/${STORED.deviceId}`);
  return mounted;
}

async function signIn(username = OPERATOR.username, password = MARKER_PASSWORD): Promise<SignInResult> {
  let result: SignInResult | undefined;
  await act(async () => {
    result = await latest.auth!.signIn(username, password);
  });
  await flush();
  return result!;
}

async function fingerprint(): Promise<BiometricSignInResult> {
  let result: BiometricSignInResult | undefined;
  await act(async () => {
    result = await latest.session!.signInWithBiometric();
  });
  await flush();
  return result!;
}

async function signOut(reason: 'USER' | 'LOCK' = 'USER'): Promise<void> {
  act(() => {
    if (reason === 'LOCK') latest.session!.lockConsole();
    else latest.auth!.signOut('USER');
  });
  await flush();
}

/**
 * What a storage keeps without the secure store: AsyncStorage (with the persisted runtime log
 * `dems.mobile.log.v1`), every value ever written to it, and the log in memory.
 */
async function persisted(): Promise<string> {
  await act(async () => {
    await runtimeLog.flush();
  });
  const keys = await AsyncStorage.getAllKeys();
  return JSON.stringify([await AsyncStorage.multiGet(keys), jest.mocked(AsyncStorage.setItem).mock.calls, runtimeLog.records()]);
}

/** `persisted()`, and what the app can read back in memory: the replica, the session, the reports, the gate, the auth session. */
async function readable(live: MobileLive): Promise<string> {
  return JSON.stringify([
    await persisted(),
    live.live.store.getState(),
    live.live.session,
    live.live.errors(),
    live.getPairing(),
    latest.session?.biometric,
    latest.session?.notice,
    latest.session?.signInFailure,
  ]);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(AsyncStorage.setItem).mockClear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetAuthPrefsForTests();
  authenticate.mockClear();
  latest.auth = null;
  latest.session = null;
  bootCore();
});

afterEach(() => {
  mobile?.stop();
  mobile = undefined;
  fake.assertNoViolations();
});

describe('a cold start in LIVE mode (AC-C-67, §9.2)', () => {
  it('a paired tablet opens the Login screen: nobody is signed in, the gate is open, and no sign-in request was sent', async () => {
    const { unmount } = await startPaired();
    expect(probe()).toContain('auth=signed-out');
    expect(probe()).toContain('boot=/login');
    expect(probe()).toContain('blocked=false');
    expect(probe()).toContain('bio=off/null/open');
    // The session token lives in memory only (SR-16): a start has none, so the socket is the device's.
    expect(fake.connection().principal).toBe('DEVICE');
    expect(requests('signIn')).toHaveLength(0);
    expect(requests('signInWithBiometric')).toHaveLength(0);
    // The lock state of this device is the Core's, read at start.
    expect(requests('getSignInStatus').length).toBeGreaterThan(0);
    expect(latest.session!.lockout).toMatchObject({ locked: false, attemptsRemaining: 5 });
    unmount();
  });

  it('a paired tablet with an enrolment shows the fingerprint button from the marker alone: no prompt, no token read', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    expect(probe()).toContain(`bio=${OPERATOR.id}/false/open`);
    expect(latest.session!.biometric).toMatchObject({
      enabled: true,
      lastOperatorId: OPERATOR.id,
      lastOperator: { id: OPERATOR.id, displayName: OPERATOR.displayName, initials: 'BS' },
      protected: false,
      changeBlocked: false,
    });
    // The marker holds no role: a role is the Core's data.
    expect(latest.session!.biometric.lastOperator).not.toHaveProperty('role');
    expect(store().prompts).toHaveLength(0);
    expect(authenticate).not.toHaveBeenCalled();
    unmount();
  });

  it('a tablet that is not paired: the gate is closed and a sign-in sends nothing', async () => {
    const { unmount } = mountApp();
    await flush();
    expect(probe()).toContain('pairing=UNPAIRED/-');
    expect(probe()).toContain('blocked=true');
    const calls = fake.calls.length;
    await expect(signIn()).resolves.toEqual({ ok: false, reason: 'UNAVAILABLE' });
    await expect(fingerprint()).resolves.toEqual({ kind: 'unavailable' });
    expect(fake.calls).toHaveLength(calls);
    expect(requests('signIn')).toHaveLength(0);
    // The secure store was asked for the device credential and for nothing else.
    expect(store().keys()).toEqual([]);
    unmount();
  });

  it('the simulated binding is neither read nor written (MP-2)', async () => {
    const reads = jest.mocked(AsyncStorage.getItem);
    reads.mockClear();
    const { unmount } = await startPaired();
    await signIn();
    expect(reads.mock.calls.map(([key]) => key)).not.toContain(MOBILE_AUTH_KEY);
    expect(jest.mocked(AsyncStorage.setItem).mock.calls.map(([key]) => key)).not.toContain(MOBILE_AUTH_KEY);
    unmount();
  });
});

describe('password sign-in on a paired tablet (S1-1, §9.2)', () => {
  it('signs in with the device credential as the bearer, takes the operator from the replica, and keeps the session token out of everything readable', async () => {
    const { unmount, live } = await startPaired();
    const result = await signIn();
    expect(result).toEqual({
      ok: true,
      operator: { id: OPERATOR.id, displayName: OPERATOR.displayName, initials: OPERATOR.initials, role: OPERATOR.role, username: OPERATOR.username },
    });
    expect(probe()).toContain(`auth=${OPERATOR.id}`);
    expect(probe()).toContain(`role=${OPERATOR.role}`);
    const sent = requests('signIn');
    expect(sent).toHaveLength(1);
    expect(bearerOf(sent[0]!.headers)).toBe(STORED.deviceCredential);
    expect(sent[0]!.credentials).toBe('omit');
    // The socket was reopened for the session (CL-11a), and the next call carries the session token.
    expect(fake.connection().principal).toBe('OPERATOR');
    expect(bearerOf(fake.connection().headers)).toBe(SESSIONS[0]);
    const text = await readable(live);
    expect(text).not.toMatch(SECRET);
    expect(text).not.toContain(MARKER_PASSWORD);
    // The username is the Core's data in the replica; no storage and no log line keeps it.
    expect(await persisted()).not.toContain(OPERATOR.username);
    unmount();
  });

  it('a wrong password is the Core`s own result, with its attempts left; the lockout view follows it', async () => {
    const { unmount } = await startPaired();
    await expect(signIn(OPERATOR.username, WRONG_PASSWORD)).resolves.toEqual({ ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining: 4 });
    expect(probe()).toContain('auth=signed-out');
    expect(probe()).toContain('locked=false/0/4');
    expect(probe()).toContain('failure=-/-');
    unmount();
  });

  it('lockout: the fifth failure locks the device for 60 s on the Core`s clock; during the lock even the right password is refused; then it opens', async () => {
    const { unmount } = await startPaired();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(signIn(OPERATOR.username, WRONG_PASSWORD)).resolves.toMatchObject({ reason: 'INVALID_CREDENTIALS', attemptsRemaining: 5 - attempt });
    }
    const lockedUntil = fake.clock.now() + LOCK_MS;
    await expect(signIn(OPERATOR.username, WRONG_PASSWORD)).resolves.toEqual({ ok: false, reason: 'LOCKED', lockedUntilMs: lockedUntil });
    expect(latest.session!.lockout).toMatchObject({ locked: true, lockedUntilMs: lockedUntil, retryInSeconds: 60 });
    await expect(signIn()).resolves.toMatchObject({ ok: false, reason: 'LOCKED' });
    expect(probe()).toContain('auth=signed-out');
    await elapse(30_000, 1_000);
    expect(latest.session!.lockout.retryInSeconds).toBe(30);
    await elapse(31_000, 1_000);
    expect(latest.session!.lockout.locked).toBe(false);
    await expect(signIn()).resolves.toMatchObject({ ok: true });
    unmount();
  });

  it('an outage: the result is CORE_OFFLINE, nothing is toasted twice, and with the link down no request is sent at all', async () => {
    const { unmount } = await startPaired();
    fake.answerOnce('signIn', OUTAGE);
    await expect(signIn()).resolves.toEqual({ ok: false, reason: 'CORE_OFFLINE' });
    expect(probe()).toContain('failure=OFFLINE/-');
    expect(screen.queryAllByText('Core server unreachable')).toHaveLength(0);
    expect(probe()).toContain('auth=signed-out');

    core.reachable = false;
    act(() => {
      fake.connection().drop();
    });
    await elapse(20_000, 1_000);
    expect(probe()).toContain('link=LIVE/OFFLINE');
    const before = requests('signIn').length;
    await expect(signIn()).resolves.toEqual({ ok: false, reason: 'CORE_OFFLINE' });
    await expect(fingerprint()).resolves.toEqual({ kind: 'core-offline' });
    expect(requests('signIn')).toHaveLength(before);
    expect(authenticate).not.toHaveBeenCalled();
    unmount();
  });

  it('a 429 is a limit: the limit toast with the seconds of `retry-after`, never a wrong password and never an outage (decision D116, LB-10)', async () => {
    const { unmount } = await startPaired();
    fake.answerOnce('signIn', rateLimited(42));
    await expect(signIn()).resolves.toEqual({ ok: false, reason: 'UNAVAILABLE' });
    expect(probe()).toContain('failure=LIMIT/42');
    expect(latest.session!.signInFailure).toMatchObject({ kind: 'LIMIT', outage: false, retryAfterSeconds: 42 });
    expect(screen.queryAllByText('The Core server is limiting requests from this device').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Try again in 42 s.').length).toBeGreaterThan(0);
    // No failed attempt was counted, the link is as it was, and the next attempt signs in.
    expect(probe()).toContain('locked=false/0/5');
    expect(probe()).toContain('link=LIVE/ONLINE');
    await expect(signIn()).resolves.toMatchObject({ ok: true });
    expect(probe()).toContain('failure=-/-');
    unmount();
  });

  it('403 `DEVICE_NOT_PAIRED` is an ordinary failed action: UNAVAILABLE, the credential and the gate stay', async () => {
    const { unmount } = await startPaired();
    fake.answerOnce('signIn', refusal(403, 'DEVICE_NOT_PAIRED', 'This operation needs the device credential.', { reason: 'DEVICE_CREDENTIAL_REQUIRED' }));
    await expect(signIn()).resolves.toEqual({ ok: false, reason: 'UNAVAILABLE' });
    expect(probe()).toContain('failure=REFUSED/-');
    expect(probe()).toContain(`pairing=PAIRED/${STORED.deviceId}`);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    unmount();
  });
});

describe('sign out, Lock console and the server-driven idle (§6.5, §9.2, DR-11)', () => {
  it('Sign out and Lock console: the notice is read from why the session ended; the pairing stays', async () => {
    const { unmount } = await startPaired();
    await signIn();
    await signOut('LOCK');
    expect(probe()).toContain('auth=signed-out');
    expect(probe()).toContain('lastSignOut=LOCK');
    expect(probe()).toContain('boot=/login');
    expect(requests('signOut')[0]!.body).toEqual({ reason: 'LOCK' });
    expect(bearerOf(requests('signOut')[0]!.headers)).toBe(SESSIONS[0]);

    await signIn();
    // Signed in again: the earlier notice is over.
    expect(probe()).toContain('lastSignOut=-');
    await signOut('USER');
    expect(probe()).toContain('lastSignOut=USER');
    expect(requests('signOut')[1]!.body).toEqual({ reason: 'USER' });
    expect(probe()).toContain(`pairing=PAIRED/${STORED.deviceId}`);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    unmount();
  });

  it('Lock console with the link down ends the session here at once (DR-11)', async () => {
    const { unmount } = await startPaired();
    await signIn();
    core.reachable = false;
    act(() => {
      fake.connection().drop();
    });
    await elapse(20_000, 1_000);
    expect(probe()).toContain('link=LIVE/OFFLINE');
    const sent = requests('signOut').length;
    await signOut('LOCK');
    expect(probe()).toContain('auth=signed-out');
    expect(probe()).toContain('lastSignOut=LOCK');
    expect(requests('signOut')).toHaveLength(sent);
    unmount();
  });

  it('the Core ends an idle session: the "Session expired" dialog opens and the Login notice says so', async () => {
    const { unmount } = await startPaired();
    await signIn();
    core.session = null;
    act(() => {
      operatorSocket().sessionEnded('IDLE_EXPIRED');
    });
    await flush();
    expect(probe()).toContain('auth=signed-out');
    expect(probe()).toContain('lastSignOut=IDLE');
    expect(probe()).toContain('notice=-');
    expect(screen.getByTestId('idle-lock-dialog')).toBeTruthy();
    expect(screen.getByText('Your session expired after 15 minutes without activity. Sign in again. Recording on the Core is not affected.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('idle-lock-confirm'));
    expect(screen.queryByTestId('idle-lock-dialog')).toBeNull();
    // The device credential is presented again: the tablet is still paired.
    expect(fake.connection().principal).toBe('DEVICE');
    await signIn();
    expect(probe()).toContain('lastSignOut=-');
    unmount();
  });

  it('the 8-hour limit: the dialog and the Alert carry its own sentence, not the idle one (WS-14)', async () => {
    const { unmount } = await startPaired();
    await signIn();
    core.session = null;
    act(() => {
      operatorSocket().sessionEnded('ABSOLUTE_EXPIRED');
    });
    await flush();
    expect(probe()).toContain('lastSignOut=-');
    expect(probe()).toContain('notice=absolute-expired');
    expect(screen.getByText('Your session reached its 8-hour limit. Sign in again. Recording on the Core is not affected.')).toBeTruthy();
    expect(screen.getByTestId('auth-notice-absolute-expired')).toBeTruthy();
    expect(screen.queryByText(/15 minutes/)).toBeNull();
    // A sign-in ends the dialog and the Alert, also when nobody closed the dialog.
    expect(screen.getByTestId('idle-lock-dialog')).toBeTruthy();
    await signIn();
    expect(screen.queryByTestId('idle-lock-dialog')).toBeNull();
    expect(screen.queryByTestId('auth-notice-absolute-expired')).toBeNull();
    expect(probe()).toContain('notice=-');
    unmount();
  });

  it('a disabled account: signed out, with the Alert of §6.4', async () => {
    const { unmount } = await startPaired();
    await signIn();
    core.session = null;
    act(() => {
      operatorSocket().sessionEnded('USER_DISABLED');
    });
    await flush();
    expect(probe()).toContain('auth=signed-out');
    expect(probe()).toContain('notice=user-disabled');
    expect(screen.getByText('This account was disabled by an administrator.')).toBeTruthy();
    expect(screen.queryByTestId('idle-lock-dialog')).toBeNull();
    unmount();
  });

  it('activity is reported to the Core: a touch inside the app becomes one `touchSession` of the session', async () => {
    const { unmount } = await startPaired();
    await signIn();
    expect(requests('touchSession')).toHaveLength(0);
    fireEvent(screen.getByTestId('auth-activity-boundary'), 'touchStart', {});
    await elapse(61_000, 1_000);
    const touches = requests('touchSession');
    expect(touches).toHaveLength(1);
    expect(bearerOf(touches[0]!.headers)).toBe(SESSIONS[0]);
    expect(probe()).toContain(`auth=${OPERATOR.id}`);
    unmount();
  });

  it('without a touch nothing is reported: an open screen cannot keep a session alive', async () => {
    const { unmount } = await startPaired();
    await signIn();
    await elapse(125_000, 1_000);
    expect(requests('touchSession')).toHaveLength(0);
    unmount();
  });
});

describe('biometric enrolment (MB-1, MB-2, AC-C-68)', () => {
  it('the offer after a password sign-in: Enable calls operation 7 once, in the password session; the token and its marker go into the secure store', async () => {
    const { unmount, live } = await startPaired();
    await signIn();
    expect(screen.getByTestId('biometric-offer-dialog')).toBeTruthy();
    // LIVE mode says what it is, and nothing about a simulation or about hardware protection.
    expect(screen.getByText("Biometric sign-in asks for this device's screen-lock check.")).toBeTruthy();
    expect(screen.queryByText('Simulated identity binding')).toBeNull();
    expect(requests('setBiometricEnrollment')).toHaveLength(0);

    await act(async () => {
      fireEvent.press(screen.getByTestId('biometric-offer-enable'));
    });
    await flush();
    expect(screen.queryByTestId('biometric-offer-dialog')).toBeNull();
    const sent = requests('setBiometricEnrollment');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toEqual({ enabled: true });
    expect(bearerOf(sent[0]!.headers)).toBe(SESSIONS[0]);

    // Decision D71 DN37-2: stored without the authentication requirement where MB-6a allows it
    // (jest is a debug build and no physical device), with a marker that says so.
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    expect(store().isProtected(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.biometricMarker)!)).toEqual({
      operatorId: OPERATOR.id,
      displayName: OPERATOR.displayName,
      deviceId: STORED.deviceId,
      protected: false,
    });
    expect(store().prompts).toHaveLength(0);
    expect(probe()).toContain(`bio=${OPERATOR.id}/false/open`);
    expect(await readable(live)).not.toMatch(SECRET);

    // Signing in again by password as the same operator does not offer again.
    await signOut();
    await signIn();
    expect(screen.queryByTestId('biometric-offer-dialog')).toBeNull();
    expect(requests('setBiometricEnrollment')).toHaveLength(1);
    unmount();
  });

  it('Not now stores nothing and calls nothing', async () => {
    const { unmount } = await startPaired();
    await signIn();
    fireEvent.press(screen.getByTestId('biometric-offer-decline'));
    await flush();
    expect(requests('setBiometricEnrollment')).toHaveLength(0);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(probe()).toContain('bio=off/null/open');
    unmount();
  });

  it('in a session created with the fingerprint nothing is offered, the switch is blocked, and turning it on sends NO operation 7', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    await expect(fingerprint()).resolves.toEqual({ kind: 'signed-in', operatorId: OPERATOR.id });
    expect(screen.queryByTestId('biometric-offer-dialog')).toBeNull();
    expect(probe()).toContain(`bio=${OPERATOR.id}/false/blocked`);
    let failure: unknown;
    await act(async () => {
      await latest.session!.setBiometricEnabled(true).catch((error: unknown) => {
        failure = error;
      });
    });
    await flush();
    expect(failure).toBeInstanceOf(Error);
    expect(requests('setBiometricEnrollment')).toHaveLength(0);
    // The enrolment that exists is as it was: the token of this session's rotation.
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[1]);
    unmount();
  });

  it('the Settings switch in a password session: on calls operation 7 and stores; off calls it first and then deletes both items', async () => {
    const { unmount } = await startPaired();
    await signIn();
    fireEvent.press(screen.getByTestId('biometric-offer-decline'));
    await act(async () => {
      await latest.session!.setBiometricEnabled(true);
    });
    await flush();
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    expect(probe()).toContain(`bio=${OPERATOR.id}/false/open`);

    await act(async () => {
      await latest.session!.setBiometricEnabled(false);
    });
    await flush();
    expect(requests('setBiometricEnrollment').map((call) => call.body)).toEqual([{ enabled: true }, { enabled: false }]);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    expect(probe()).toContain('bio=off/null/open');
    expect(core.bio.live).toBeNull();
    unmount();
  });

  it('turning it off while the Core cannot be told deletes nothing and rejects; the two sides stay equal', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    await signIn();
    fake.answerOnce('setBiometricEnrollment', OUTAGE);
    let failure: unknown;
    await act(async () => {
      await latest.session!.setBiometricEnabled(false).catch((error: unknown) => {
        failure = error;
      });
    });
    await flush();
    expect(failure).toBeInstanceOf(Error);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    expect(probe()).toContain(`bio=${OPERATOR.id}/false/open`);
    expect(latest.session!.biometric.prefsError).toBe('write');
    expect(core.bio.live).toBe(BIO[0]);
    unmount();
  });

  it('an enrolment the Core refuses: the presenter says so, nothing is stored', async () => {
    const { unmount } = await startPaired();
    await signIn();
    fake.answerOnce('setBiometricEnrollment', rateLimited(7));
    await act(async () => {
      fireEvent.press(screen.getByTestId('biometric-offer-enable'));
    });
    await flush();
    expect(screen.queryAllByText('Try again in 7 s.').length).toBeGreaterThan(0);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(probe()).toContain('bio=off/null/open');
    expect(probe()).toContain(`auth=${OPERATOR.id}`);
    unmount();
  });
});

describe('the DEPARTURE-6 conditions (MB-6a, AC-C-105)', () => {
  type DevGlobal = typeof globalThis & { __DEV__: boolean };
  const dev = globalThis as DevGlobal;

  it('a physical device in a build that is not a debug build: a failing protected write turns biometric sign-in off and stores no token', async () => {
    const { unmount } = await startPaired();
    await signIn();
    expect(screen.getByTestId('biometric-offer-dialog')).toBeTruthy();
    const debug = dev.__DEV__;
    try {
      device().isDevice = true;
      dev.__DEV__ = false;
      store().protectedWrite = 'fail';
      await act(async () => {
        fireEvent.press(screen.getByTestId('biometric-offer-enable'));
      });
      await flush();
    } finally {
      dev.__DEV__ = debug;
    }
    // Nothing fell back to an item without the authentication requirement: nothing is stored at all.
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(probe()).toContain('bio=off/null/open');
    expect(screen.queryAllByText('Biometric sign-in could not be turned on on this device.').length).toBeGreaterThan(0);
    // The session stays, and the Core was told: it holds no live token that nobody has.
    expect(probe()).toContain(`auth=${OPERATOR.id}`);
    expect(requests('setBiometricEnrollment').map((call) => call.body)).toEqual([{ enabled: true }, { enabled: false }]);
    expect(core.bio.live).toBeNull();
    expect(runtimeLog.records().some((record) => record.source === 'auth.biometric.enrol' && record.level === 'error')).toBe(true);
    unmount();
  });

  it('the same device with a protected write that works: the token is stored WITH the authentication requirement, and the marker says so', async () => {
    const { unmount } = await startPaired();
    await signIn();
    const debug = dev.__DEV__;
    try {
      device().isDevice = true;
      dev.__DEV__ = false;
      await act(async () => {
        fireEvent.press(screen.getByTestId('biometric-offer-enable'));
      });
      await flush();
    } finally {
      dev.__DEV__ = debug;
    }
    expect(store().isProtected(SECURE_ITEM_KEYS.biometricToken)).toBe(true);
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.biometricMarker)!)).toMatchObject({ protected: true });
    expect(probe()).toContain(`bio=${OPERATOR.id}/true/open`);
    unmount();
  });

  it('while the marker says `protected: false`, no rendered text says the token is protected by the device`s hardware', async () => {
    const { unmount } = await startPaired();
    await signIn();
    const claims = /hardware|keystore|secure (?:enclave|element|chip)|protected by|encrypted by/i;
    const texts = () => screen.root === undefined ? [] : screen.UNSAFE_getAllByType(Text).map((node) => String(node.props.children));
    expect(texts().some((text) => claims.test(text))).toBe(false);
    await act(async () => {
      fireEvent.press(screen.getByTestId('biometric-offer-enable'));
    });
    await flush();
    expect(probe()).toContain(`bio=${OPERATOR.id}/false/open`);
    expect(texts().some((text) => claims.test(text))).toBe(false);
    unmount();
  });
});

describe('biometric sign-in with rotation (MB-3 to MB-6, AC-C-69, finding F72)', () => {
  it('one OS check, then operation 8 with the stored token under the DEVICE credential; the next token is in the store BEFORE the action settles', async () => {
    enrolTablet();
    const { unmount, live } = await startPaired();
    core.holdSnapshot = true;
    let result: BiometricSignInResult | undefined;
    await act(async () => {
      void latest.session!.signInWithBiometric().then((value) => {
        result = value;
      });
      for (let turn = 0; turn < 80; turn += 1) await Promise.resolve();
    });
    await flush();
    // The Core answered and the new socket is open, but its snapshot has not arrived: the action is still out …
    expect(core.held).toHaveLength(1);
    expect(result).toBeUndefined();
    expect(probe()).toContain('auth=signed-out');
    // … and the next token is already the stored one (MB-6); the one that was sent is gone.
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[1]);
    expect(store().isProtected(SECURE_ITEM_KEYS.biometricToken)).toBe(false);

    act(() => {
      core.held[0]!.snapshot(wire(core.state));
    });
    await flush();
    expect(result).toEqual({ kind: 'signed-in', operatorId: OPERATOR.id });
    expect(probe()).toContain(`auth=${OPERATOR.id}`);
    expect(probe()).toContain(`bio=${OPERATOR.id}/false/blocked`);

    const sent = requests('signInWithBiometric');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toEqual({ token: BIO[0] });
    expect(bearerOf(sent[0]!.headers)).toBe(STORED.deviceCredential);
    // Exactly one check (MB-5 case c): the existing OS prompt, with the operator's name; the read showed none.
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(authenticate).toHaveBeenCalledWith(expect.objectContaining({ promptMessage: 'Sign in to DEMS', promptSubtitle: OPERATOR.displayName, disableDeviceFallback: true }));
    expect(store().prompts).toHaveLength(0);
    expect(await readable(live)).not.toMatch(SECRET);
    unmount();
  });

  it('every sign-in presents the token of the sign-in before it, never one twice; the marker stays', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    core.holdSnapshot = false;
    for (let round = 0; round < 3; round += 1) {
      await expect(fingerprint()).resolves.toEqual({ kind: 'signed-in', operatorId: OPERATOR.id });
      await signOut();
    }
    const presented = requests('signInWithBiometric').map((call) => (call.body as { token: string }).token);
    expect(presented).toEqual([BIO[0], BIO[1], BIO[2]]);
    expect(new Set(presented).size).toBe(presented.length);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[3]);
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.biometricMarker)!)).toMatchObject({ operatorId: OPERATOR.id, protected: false });
    // The Core never saw a reuse.
    expect(core.bio.live).toBe(BIO[3]);
    unmount();
  });

  it('a double tap is ONE sign-in: one check, one request, one token', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    let first: BiometricSignInResult | undefined;
    let second: BiometricSignInResult | undefined;
    await act(async () => {
      const a = latest.session!.signInWithBiometric();
      const b = latest.session!.signInWithBiometric();
      [first, second] = await Promise.all([a, b]);
    });
    await flush();
    expect(first).toEqual({ kind: 'signed-in', operatorId: OPERATOR.id });
    expect(second).toEqual(first);
    expect(requests('signInWithBiometric')).toHaveLength(1);
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(core.bio.used.size).toBe(1);
    expect(probe()).toContain(`auth=${OPERATOR.id}`);
    unmount();
  });

  it('a 401 deletes the token and the marker, keeps the pairing, and the Login Alert says so (MB-3)', async () => {
    enrolTablet();
    // The Core revoked the family meanwhile (the operator turned it off elsewhere, or enrolled anew).
    core.bio.live = null;
    const { unmount, live } = await startPaired();
    await expect(fingerprint()).resolves.toEqual({ kind: 'invalid' });
    expect(requests('signInWithBiometric')).toHaveLength(1);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    expect(probe()).toContain('auth=signed-out');
    expect(probe()).toContain('notice=biometric-invalid');
    expect(probe()).toContain('bio=off/null/open');
    expect(probe()).toContain(`pairing=PAIRED/${STORED.deviceId}`);
    expect(screen.getByText('Biometric sign-in is no longer valid on this device. Sign in with your password to enable it again.')).toBeTruthy();
    // The button is gone: a second press sends nothing.
    await expect(fingerprint()).resolves.toEqual({ kind: 'unavailable' });
    expect(requests('signInWithBiometric')).toHaveLength(1);
    // A password sign-in ends the Alert and offers the enrolment again.
    await signIn();
    expect(probe()).toContain('notice=-');
    expect(screen.getByTestId('biometric-offer-dialog')).toBeTruthy();
    expect(await readable(live)).not.toMatch(SECRET);
    // The Alert is over for good: it does not come back with the next sign-out.
    fireEvent.press(screen.getByTestId('biometric-offer-decline'));
    await signOut();
    expect(probe()).toContain('lastSignOut=USER');
    expect(probe()).toContain('notice=-');
    unmount();
  });

  it('a lost answer is NOT retried with the same token: both items are deleted and the next press sends nothing', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    // The request reaches the Core`s address and no answer comes back: the Core may have used the token.
    fake.answerOnce('signInWithBiometric', OUTAGE);
    await expect(fingerprint()).resolves.toEqual({ kind: 'invalid' });
    expect(requests('signInWithBiometric')).toHaveLength(1);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(probe()).toContain('notice=biometric-invalid');
    expect(probe()).toContain('failure=OFFLINE/-');

    await expect(fingerprint()).resolves.toEqual({ kind: 'unavailable' });
    await expect(fingerprint()).resolves.toEqual({ kind: 'unavailable' });
    expect(requests('signInWithBiometric')).toHaveLength(1);
    // The token that was sent once was never sent again: the Core saw no reuse.
    expect(core.bio.used.size).toBe(0);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    unmount();
  });

  it('answers that say the token was not looked at keep it: a lock (423), a limit (429), a Core that is not ready (503)', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    fake.answerOnce('signInWithBiometric', refusal(423, 'LOCKED', 'Too many failed attempts. Try again shortly.', { lockedUntil: fake.clock.now() + 18_000, retryInMs: 18_000 }));
    await expect(fingerprint()).resolves.toEqual({ kind: 'locked', lockedUntilMs: fake.clock.now() + 18_000 });
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    await elapse(19_000, 1_000);

    fake.answerOnce('signInWithBiometric', rateLimited(9));
    await expect(fingerprint()).resolves.toEqual({ kind: 'error' });
    expect(probe()).toContain('failure=LIMIT/9');
    expect(screen.queryAllByText('Try again in 9 s.').length).toBeGreaterThan(0);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);

    fake.answerOnce('signInWithBiometric', notReady());
    await expect(fingerprint()).resolves.toEqual({ kind: 'core-offline' });
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    expect(probe()).toContain('notice=-');
    expect(probe()).toContain(`bio=${OPERATOR.id}/false/open`);

    // The token is still the one the Core holds: the next press signs in with it.
    await expect(fingerprint()).resolves.toEqual({ kind: 'signed-in', operatorId: OPERATOR.id });
    expect(requests('signInWithBiometric').map((call) => (call.body as { token: string }).token)).toEqual([BIO[0], BIO[0], BIO[0], BIO[0]]);
    expect(core.bio.used).toEqual(new Set([BIO[0]]));
    unmount();
  });

  it('while the device is locked nothing is asked and nothing is sent', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    for (let attempt = 0; attempt < 5; attempt += 1) await signIn(OPERATOR.username, WRONG_PASSWORD);
    expect(latest.session!.lockout.locked).toBe(true);
    await expect(fingerprint()).resolves.toMatchObject({ kind: 'locked' });
    expect(authenticate).not.toHaveBeenCalled();
    expect(requests('signInWithBiometric')).toHaveLength(0);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    unmount();
  });

  it('a rotated token that cannot be written costs the enrolment, not the session (MB-6)', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    // The read of the token passes; the write of the next one fails.
    store().failNext('write');
    await expect(fingerprint()).resolves.toEqual({ kind: 'signed-in', operatorId: OPERATOR.id });
    expect(probe()).toContain(`auth=${OPERATOR.id}`);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(probe()).toContain('bio=off/null/blocked');
    expect(runtimeLog.records().some((record) => record.source === 'auth.biometric.store.rotation' && record.level === 'warn')).toBe(true);
    unmount();
  });

  it('an enrolment of an earlier pairing of this tablet is deleted, not presented', async () => {
    enrolTablet();
    store().seed(SECURE_ITEM_KEYS.biometricMarker, JSON.stringify({ operatorId: OPERATOR.id, displayName: OPERATOR.displayName, deviceId: 'DEV-9999', protected: false }));
    const { unmount } = await startPaired();
    expect(probe()).toContain('bio=off/null/open');
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    await expect(fingerprint()).resolves.toEqual({ kind: 'unavailable' });
    expect(requests('signInWithBiometric')).toHaveLength(0);
    unmount();
  });
});

describe('the OS check (MB-4, AC-C-70)', () => {
  it('a failed check calls operation 9 with the operator the marker names, and no operation 8; the fifth locks the device', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    authenticate.mockResolvedValueOnce({ success: false, error: 'authentication_failed' });
    await expect(fingerprint()).resolves.toEqual({ kind: 'failed', attemptsRemaining: 4 });
    const reported = requests('reportBiometricFailure');
    expect(reported).toHaveLength(1);
    expect(reported[0]!.body).toEqual({ operatorId: OPERATOR.id });
    expect(bearerOf(reported[0]!.headers)).toBe(STORED.deviceCredential);
    expect(requests('signInWithBiometric')).toHaveLength(0);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    expect(probe()).toContain('locked=false/0/4');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      authenticate.mockResolvedValueOnce({ success: false, error: 'authentication_failed' });
      await fingerprint();
    }
    authenticate.mockResolvedValueOnce({ success: false, error: 'authentication_failed' });
    await expect(fingerprint()).resolves.toMatchObject({ kind: 'locked' });
    expect(requests('reportBiometricFailure')).toHaveLength(5);
    expect(latest.session!.lockout.locked).toBe(true);
    // The token was never sent, so it is still good after the lock.
    await elapse(61_000, 1_000);
    await expect(fingerprint()).resolves.toEqual({ kind: 'signed-in', operatorId: OPERATOR.id });
    unmount();
  });

  it('a cancelled prompt calls nothing at all', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    const calls = fake.calls.length;
    for (const error of ['user_cancel', 'system_cancel', 'app_cancel', 'user_fallback'] as const) {
      authenticate.mockResolvedValueOnce({ success: false, error });
      await expect(fingerprint()).resolves.toEqual({ kind: 'cancelled' });
    }
    expect(fake.calls).toHaveLength(calls);
    expect(requests('reportBiometricFailure')).toHaveLength(0);
    expect(requests('signInWithBiometric')).toHaveLength(0);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    expect(probe()).toContain('notice=-');
    unmount();
  });

  it('an OS lockout and a device without an enrolled fingerprint call nothing either', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    const calls = fake.calls.length;
    authenticate.mockResolvedValueOnce({ success: false, error: 'lockout' });
    await expect(fingerprint()).resolves.toEqual({ kind: 'lockout' });
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValueOnce(false);
    await expect(fingerprint()).resolves.toEqual({ kind: 'not-enrolled' });
    expect(fake.calls).toHaveLength(calls);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    unmount();
  });

  it('a failure report that the Core limits is a limit: no result of a failed attempt is made up', async () => {
    enrolTablet();
    const { unmount } = await startPaired();
    authenticate.mockResolvedValueOnce({ success: false, error: 'authentication_failed' });
    fake.answerOnce('reportBiometricFailure', rateLimited(5));
    await expect(fingerprint()).resolves.toEqual({ kind: 'error' });
    expect(probe()).toContain('failure=LIMIT/5');
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[0]);
    unmount();
  });
});

describe('`session.ended` with `TOKEN_REUSE` (AC-C-108, §6.5)', () => {
  it('signs out to the Login screen, deletes the token and its marker, keeps the device credential, and shows the Alert', async () => {
    enrolTablet();
    const { unmount, live } = await startPaired();
    await expect(fingerprint()).resolves.toEqual({ kind: 'signed-in', operatorId: OPERATOR.id });
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO[1]);
    expect(probe()).toContain('boot=/home');

    // The Core saw the used token again (a copy of it, somewhere): it revokes the family and ends this session.
    core.session = null;
    core.bio.live = null;
    act(() => {
      operatorSocket().sessionEnded('TOKEN_REUSE');
    });
    await flush();

    expect(probe()).toContain('auth=signed-out');
    expect(probe()).toContain('boot=/login');
    expect(probe()).toContain('notice=token-reuse');
    expect(probe()).toContain('lastSignOut=-');
    expect(screen.getByTestId('auth-notice-token-reuse')).toBeTruthy();
    expect(screen.getByText('Biometric sign-in was turned off on this device because its token was used a second time. Sign in with your password.')).toBeTruthy();
    expect(screen.queryByTestId('idle-lock-dialog')).toBeNull();

    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(probe()).toContain('bio=off/null/open');
    // The tablet is still paired: the credential is stored and presented, and the gate is open.
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.deviceCredential)!)).toEqual(STORED);
    expect(probe()).toContain(`pairing=PAIRED/${STORED.deviceId}`);
    expect(probe()).toContain('blocked=false');
    expect(fake.connection().principal).toBe('DEVICE');
    expect(bearerOf(fake.connection().headers)).toBe(STORED.deviceCredential);
    // No token is left to send.
    await expect(fingerprint()).resolves.toEqual({ kind: 'unavailable' });
    expect(requests('signInWithBiometric')).toHaveLength(1);
    expect(runtimeLog.records().some((record) => record.source === 'auth.sessionEnd' && record.context?.reason === 'TOKEN_REUSE')).toBe(true);
    expect(await readable(live)).not.toMatch(SECRET);

    // The password signs in, the Alert ends, and biometric sign-in can be enabled again.
    await expect(signIn()).resolves.toMatchObject({ ok: true });
    expect(probe()).toContain('notice=-');
    expect(screen.getByTestId('biometric-offer-dialog')).toBeTruthy();
    unmount();
  });
});

describe('nothing secret is readable (AC-C-65, SR-16, SD-23)', () => {
  it('after pairing, a wrong and a right password, enrolment and two biometric sign-ins: no token, no password and no pairing code in AsyncStorage, the log or the replica', async () => {
    const { unmount, live } = mountApp();
    await flush();
    expect(probe()).toContain('pairing=UNPAIRED/-');
    // Pairing with a marker code, through the Core action the Pair screen uses.
    await act(async () => {
      await live.live.actions.pair(MARKER_PAIRING_CODE);
    });
    await flush();
    expect(probe()).toContain(`pairing=PAIRED/${STORED.deviceId}`);
    await signIn(OPERATOR.username, WRONG_PASSWORD);
    await expect(signIn()).resolves.toMatchObject({ ok: true });
    await act(async () => {
      fireEvent.press(screen.getByTestId('biometric-offer-enable'));
    });
    await flush();
    await signOut('LOCK');
    await expect(fingerprint()).resolves.toMatchObject({ kind: 'signed-in' });
    fireEvent(screen.getByTestId('auth-activity-boundary'), 'touchStart', {});
    await signOut();
    await expect(fingerprint()).resolves.toMatchObject({ kind: 'signed-in' });
    await signOut();

    // Positive control: the secrets exist, in the one place they belong.
    expect(store().peek(SECURE_ITEM_KEYS.deviceCredential)).toMatch(/dvc_/);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toMatch(/^bio_/);
    expect(store().keys()).toEqual([SECURE_ITEM_KEYS.biometricMarker, SECURE_ITEM_KEYS.biometricToken, SECURE_ITEM_KEYS.deviceCredential].sort());
    expect(requests('redeemPairingCode')[0]!.body).toMatchObject({ code: MARKER_PAIRING_CODE });
    expect(requests('signIn').map((call) => (call.body as { password: string }).password)).toEqual([WRONG_PASSWORD, MARKER_PASSWORD]);

    const text = await readable(live);
    expect(text).not.toMatch(SECRET);
    for (const marker of [MARKER_PASSWORD, WRONG_PASSWORD, MARKER_PAIRING_CODE]) expect(text).not.toContain(marker);
    expect(await persisted()).not.toContain(OPERATOR.username);
    // The persisted log was part of that text: it exists and holds this journey.
    const persistedLog = await AsyncStorage.getItem('dems.mobile.log.v1');
    expect(persistedLog).toContain('auth.biometric.signIn');
    expect(persistedLog).not.toMatch(SECRET);
    // The session token is nowhere a store can keep it: only the three secure items exist, and none is a session.
    for (const key of store().keys()) expect(store().peek(key)).not.toMatch(/ses_/);
    expect(await AsyncStorage.getAllKeys()).not.toContain(MOBILE_AUTH_KEY);
    unmount();
  });
});
