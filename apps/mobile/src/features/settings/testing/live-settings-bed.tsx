/**
 * Test-only bed for the Live tests of Settings (backend task, plan row W82). Never import it from
 * app code. The model is W78's `features/devices/testing/live-devices-bed.tsx`.
 *
 * - The app's REAL Live source (`createMobileLive`) over the contract-checked fake transport
 *   (`createFakeTransport`), mounted by the real `AppProviders` around the REAL settings route files
 *   (`/settings`, `/settings/[section]` and their stack), plus a probe of the auth layer.
 * - The device is paired (its credential is the fake transport's placeholder in the secure-store
 *   mock) and a demo operator signs in through the Live source's own sign-in: answer, a new socket,
 *   the snapshot of that socket (§5.2). The session the Core answers names that operator, with the
 *   permissions of the role and the Core's demo flag (`demoControls`, DC-3) as the test asks.
 * - The Core server's engine is a real simulator (`createTestSim`, signed in as the same operator).
 *   Each command of the Settings screens runs the same action there; the replicated slices it changed
 *   travel back as ONE delta whose revision the answer names (API-7, RT-5), in the order `order` says:
 *   the delta before the answer (`delta-first`) or the answer first and the delta when the test calls
 *   `sendHeldDeltas()` (`answer-first`). A scenario load starts a new epoch: the answer names it and
 *   the snapshot of that epoch follows (CL-18). A refusal of the engine is answered as the Core
 *   answers it: the contract's own example of that refusal.
 * - Biometric sign-in (MB-1, MB-3): `enrolled` seeds the token and its marker, as an earlier password
 *   session on this tablet left them; `fingerprint()` signs in through the auth layer's own
 *   biometric path (the OS prompt is the jest mock), so the session is created with the fingerprint.
 *
 * Rules the fake's authors gave every client row (decision F59): connect scripts add up (one script
 * here, installed once); the fake clock is advanced in steps with the promise jobs in between
 * (`elapse`); the session read after a reconnect names the session the test signed in with. No
 * credential value is printed or stored by this file; the password is a marker that opens nothing,
 * and the biometric tokens are markers assembled from parts.
 *
 * Import order: `./settings-test-setup` first, then `@/navigation/testing/router-harness`, then this
 * module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack, router, type Href } from 'expo-router';
import { StrictMode, useEffect } from 'react';
import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import {
  CORE_API_EXAMPLES,
  REPLICATED_SLICE_NAMES,
  pickReplicatedState,
  type AuthSessionInfo,
  type DeltaMessage,
  type PairingRedeemed,
  type ReplicatedState,
} from '@dems/shared/api';
import { coreActionsOf, settle } from '@dems/shared/live';
import {
  FAKE_CREDENTIALS,
  createFakeTransport,
  refusal,
  type FakeAnswer,
  type FakeConnection,
  type FakeHttpCall,
  type FakeReply,
  type FakeTransport,
} from '@dems/shared/live/testing';
import type { AudioTrackId } from '@dems/shared/domain';
import type { SocketLike } from '@dems/shared/realtime';
import {
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  ROLE_PERMISSIONS,
  ScenarioName,
  SimErrorCode,
  SimPermissionError,
  SimTransitionError,
  type FaultKind,
  type FaultTarget,
  type OperatorRole,
  type SimState,
} from '@dems/shared/sim';
import SettingsSectionRoute from '@/app/(app)/(tabs)/settings/[section]';
import SettingsLayout from '@/app/(app)/(tabs)/settings/_layout';
import SettingsRoute from '@/app/(app)/(tabs)/settings/index';
import { useAuthSession, type AuthSession } from '@/auth';
import { resetMotionStateForTests } from '@/motion';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import {
  createMobileLive,
  resetCoreErrorPresenterForTests,
  resetCoreLinkPrefsForTests,
  resetDebugLaunchForTests,
  useAuth,
  type AuthContract,
  type MobileLive,
} from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { createTestSim, type TestSim } from '@/runtime/testing/test-sim';
import { resetSettingsPrefsForTests } from '../settings-prefs';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** The contract's session of a paired device: the times and the device the bed's sessions copy. */
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The credential the device holds: the fake transport's placeholder, in the contract's shape. */
export const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w82'].join('-');
/** Biometric tokens: markers in the token's shape, assembled from parts (no scan finds a whole value in this file). */
export const BIO_TOKENS = [1, 2, 3].map((n) => `${['b', 'io'].join('')}_${['w', '82'].join('')}${String(n).repeat(40)}`);

export type DemoUsername = 'budi.santoso' | 'andi.pratama' | 'rina.wijaya';

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

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);

/** The replicated slices that changed between two states of the engine, as `replace` ops (the simulator keeps unchanged slices by reference). */
function changedSlices(before: SimState, after: SimState): DeltaMessage['ops'] {
  const ops: DeltaMessage['ops'][number][] = [];
  const from = before as unknown as Readonly<Record<string, unknown>>;
  const to = after as unknown as Readonly<Record<string, unknown>>;
  for (const slice of REPLICATED_SLICE_NAMES) {
    if (from[slice] === to[slice]) continue;
    ops.push({ op: 'replace', slice, value: JSON.parse(JSON.stringify(to[slice])) } as DeltaMessage['ops'][number]);
  }
  return ops;
}

const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};

export type DeltaOrder = 'delta-first' | 'answer-first';

export interface LiveSettingsBedOptions {
  window?: WindowName;
  /** The operator who signs in on the device (default `andi.pratama`, SUPERVISOR: the role that holds DEMO_CONTROL). */
  user?: DemoUsername;
  /** The Core server runs with its demo flag on (`session.demoControls`, DC-3). Default true. */
  demoControls?: boolean;
  /** Runs on the signed-in engine before the device signs in (a fault, a scenario). */
  setup?: (engine: TestSim) => void;
  /** Delivers every hosted answer this much later on the fake clock (the delta is not delayed). */
  answerDelayMs?: number;
  /** The tablet holds a biometric enrolment of the operator (token and marker). `protectedItem`: the marker says `protected: true`. */
  enrolled?: { protectedItem: boolean } | false;
  /** No sign-in at the start (the test signs in itself, for example with the fingerprint). */
  signedOut?: boolean;
  /** The first route. Default `/settings`. */
  initialUrl?: string;
  /**
   * The route tree renders under React `<StrictMode>` (inside the providers, so the Live source is
   * mounted once): every effect of the screens runs twice at mount, as in a development build
   * (decision D158, finding F69-1).
   */
  strict?: boolean;
}

export interface LiveSettingsBed {
  readonly fake: FakeTransport;
  /** The Core server's engine. */
  readonly engine: TestSim;
  readonly mobile: MobileLive;
  readonly app: ReturnType<typeof renderRoutes>;
  /** The order of the answer and the delta of the next hosted commands (default `delta-first`). */
  order: DeltaOrder;
  /** Every hosted answer is delivered this much later on the fake clock. */
  answerDelayMs: number;
  /** Sends the deltas (and epoch snapshots) `answer-first` held back, in order. */
  sendHeldDeltas(): void;
  /** Moves the fake clock in steps, with the promise jobs in between. */
  elapse(ms: number, step?: number): Promise<void>;
  flush(turns?: number): Promise<void>;
  /** Pushes a route, as a row press does on a phone. */
  open(href: string): Promise<void>;
  requests(operationId: string): readonly FakeHttpCall[];
  /** The socket opened last (the signed-in one after the sign-in). */
  connection(): FakeConnection;
  /** The app's store: the Live source's replica. */
  state(): SimState;
  /** The auth layer as the screens read it (the values of the last commit). */
  auth(): AuthContract;
  session(): AuthSession;
  /** Signs in through the auth layer's biometric path (the OS prompt is the jest mock); resolves with its result kind. */
  fingerprint(): Promise<string>;
  /**
   * The Core changes the signed-in operator's role (§6.3): `session.updated` on the socket, and the
   * delta of the `operators` slice that the same change writes.
   */
  changeRole(role: OperatorRole): Promise<void>;
  /** Stops the Live source and throws the first contract violation the fake recorded. */
  stop(): void;
}

/** Promise jobs settle inside `act`: the fake's answers, the connect scripts, the storage mock. */
async function flushJobs(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

/** Resets what the runtime keeps between tests. Call it in `beforeEach`, before `renderLiveSettings`. */
export async function resetLiveSettingsBed(): Promise<void> {
  await AsyncStorage.clear();
  resetShellState();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetSettingsPrefsForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  globalThis.__DEMS_SECURE_STORE_MOCK__.reset();
}

/** The Core's answer to a refusal of its engine: the contract's example of that refusal. */
function engineRefusal(fake: FakeTransport, operationId: string, error: unknown): FakeAnswer {
  if (error instanceof SimTransitionError && error.code === SimErrorCode.SESSION_ACTIVE && operationId === 'startSoftwareUpdate') {
    return fake.example('startSoftwareUpdate', 409);
  }
  if (error instanceof SimPermissionError && operationId === 'startSoftwareUpdate') return fake.example('startSoftwareUpdate', 403, 'notPermitted');
  throw new Error(`live settings bed: no Core answer is scripted for a refusal of ${operationId} (${error instanceof Error ? `${error.name} ${(error as { code?: string }).code ?? ''}` : 'unknown'})`);
}

/** The probe's view of the auth layer, written after each commit. */
const latest: { auth: AuthContract | null; session: AuthSession | null } = { auth: null, session: null };

function AuthProbe() {
  const auth = useAuth();
  const session = useAuthSession();
  useEffect(() => {
    latest.auth = auth;
    latest.session = session;
  });
  return null;
}

export async function renderLiveSettings({
  window = 'phonePortrait',
  user = 'andi.pratama',
  demoControls = true,
  setup,
  answerDelayMs = 0,
  enrolled = false,
  signedOut = false,
  initialUrl = '/settings',
  strict = false,
}: LiveSettingsBedOptions = {}): Promise<LiveSettingsBed> {
  setWindow(window);
  latest.auth = null;
  latest.session = null;
  const fake = createFakeTransport({ epoch: 2, revision: 10 });
  const now = () => fake.clock.now();
  const engine = createTestSim({ start: now() });
  const operator = OPERATORS.find((candidate) => candidate.username === user);
  if (operator === undefined || !engine.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok) {
    throw new Error('live settings bed: the engine could not sign in the operator');
  }
  setup?.(engine);

  let session: { token: string; info: AuthSessionInfo } | null = null;
  const bio = { live: enrolled === false ? null : BIO_TOKENS[0]!, next: 1 };
  const held: (() => void)[] = [];

  const issue = (method: 'PASSWORD' | 'BIOMETRIC'): AuthSessionInfo => {
    const info: AuthSessionInfo = {
      ...DEVICE_SESSION,
      operator: {
        id: operator.id,
        username: operator.username,
        rank: operator.rank,
        name: operator.name,
        displayName: operator.displayName,
        initials: operator.initials,
        role: operator.role,
      },
      permissions: [...ROLE_PERMISSIONS[operator.role]],
      method,
      deviceId: STORED.deviceId,
      issuedAt: now(),
      lastActivityAt: now(),
      idleExpiresAt: now() + 900_000,
      absoluteExpiresAt: now() + 28_800_000,
      demoControls,
      serverTime: now(),
    };
    session = { token: FAKE_CREDENTIALS.sessionToken, info };
    return info;
  };
  const sessionOf = (call: FakeHttpCall) => (session !== null && bearerOf(call.headers) === session.token ? session : null);

  fake.answer('getAuthSession', (call) => {
    const current = sessionOf(call);
    return current !== null ? { status: 200, body: { ...current.info, serverTime: now() } } : fake.example('getAuthSession', 401);
  });
  fake.answer('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  fake.answer('getDeviceRegistration', (call) =>
    bearerOf(call.headers) === STORED.deviceCredential || sessionOf(call) !== null
      ? { status: 200, body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core } }
      : fake.example('getDeviceRegistration', 401),
  );
  fake.answer('signIn', (call) => {
    if (bearerOf(call.headers) !== STORED.deviceCredential) return fake.example('signIn', 403, 'deviceNotPaired');
    const info = issue('PASSWORD');
    return { status: 200, body: { session: info, sessionToken: FAKE_CREDENTIALS.sessionToken } };
  });
  fake.answer('signInWithBiometric', (call) => {
    if (bearerOf(call.headers) !== STORED.deviceCredential) return refusal(403, 'DEVICE_NOT_PAIRED', 'This operation needs the device credential.', { reason: 'DEVICE_CREDENTIAL_REQUIRED' });
    if (bio.live === null || (call.body as { token: string }).token !== bio.live) return fake.example('signInWithBiometric', 401);
    const rotated = BIO_TOKENS[bio.next] ?? BIO_TOKENS[BIO_TOKENS.length - 1]!;
    bio.next += 1;
    bio.live = rotated;
    const info = issue('BIOMETRIC');
    return { status: 200, body: { session: info, sessionToken: FAKE_CREDENTIALS.sessionToken, biometricToken: rotated } };
  });
  fake.answer('setBiometricEnrollment', (call) => {
    const current = sessionOf(call);
    if (current === null) return fake.example('setBiometricEnrollment', 401);
    if ((call.body as { enabled: boolean }).enabled === false) {
      bio.live = null;
      return { status: 200, body: { enabled: false } };
    }
    if (current.info.method !== 'PASSWORD') {
      return refusal(403, 'DEVICE_NOT_PAIRED', 'Sign in with your password to turn biometric sign-in on.', { reason: 'PASSWORD_SESSION_REQUIRED' });
    }
    const token = BIO_TOKENS[bio.next] ?? BIO_TOKENS[BIO_TOKENS.length - 1]!;
    bio.next += 1;
    bio.live = token;
    return { status: 200, body: { enabled: true, token, expiresAt: now() + 30 * 24 * 60 * 60_000 } };
  });
  fake.answer('signOut', (call) => {
    if (sessionOf(call) === null) return fake.example('signOut', 401);
    session = null;
    return { status: 204 };
  });
  fake.answer('touchSession', () => fake.example('touchSession'));

  const bed: LiveSettingsBed = {
    fake,
    engine,
    mobile: undefined as unknown as MobileLive,
    app: undefined as unknown as ReturnType<typeof renderRoutes>,
    order: 'delta-first',
    answerDelayMs,
    sendHeldDeltas() {
      act(() => {
        for (const send of held.splice(0)) send();
      });
    },
    async elapse(ms, step = 100) {
      for (let done = 0; done < ms; done += step) {
        act(() => {
          fake.clock.advance(Math.min(step, ms - done));
        });
        await flushJobs(20);
      }
    },
    flush: flushJobs,
    async open(href) {
      act(() => router.push(href as Href));
      await flushJobs();
    },
    requests: (operationId) => fake.log.requestsOf(operationId),
    connection: () => fake.connection(),
    state: () => bed.mobile.sim.store.getState(),
    auth() {
      if (latest.auth === null) throw new Error('live settings bed: the auth probe has not rendered');
      return latest.auth;
    },
    session() {
      if (latest.session === null) throw new Error('live settings bed: the auth probe has not rendered');
      return latest.session;
    },
    async fingerprint() {
      let kind = 'none';
      await act(async () => {
        kind = (await bed.session().signInWithBiometric()).kind;
      });
      await flushJobs();
      await bed.elapse(1_000, 250);
      return kind;
    },
    async changeRole(role) {
      const operators = bed.state().operators.map((entry) => (entry.id === operator.id ? { ...entry, role } : entry));
      const revision = fake.position.revision + 1;
      act(() => {
        const connection = bed.connection();
        connection.sessionUpdated({ id: operator.id, role }, [...ROLE_PERMISSIONS[role]]);
        connection.delta([{ op: 'replace', slice: 'operators', value: JSON.parse(JSON.stringify(operators)) } as DeltaMessage['ops'][number]], { revision });
      });
      await flushJobs();
      await bed.elapse(300);
    },
    stop() {
      bed.mobile.stop();
      fake.assertNoViolations();
    },
  };

  /** Sends what one hosted command changed: a delta of the next revision, or held back for `answer-first`. */
  const pushChanges = (before: SimState): number | null => {
    const ops = changedSlices(before, engine.sim.store.getState());
    if (ops.length === 0) return null;
    const revision = fake.position.revision + 1;
    const connection = bed.connection();
    const send = (): void => void connection.delta(ops, { revision });
    if (bed.order === 'delta-first') send();
    else held.push(send);
    return revision;
  };

  /**
   * One hosted command: the engine runs it; a 2xx answer names the revision of the delta that holds
   * what changed (or the present revision when nothing replicated changed). A refusal of the engine
   * is the Core's refusal.
   */
  const hosted = (operationId: string, run: (call: FakeHttpCall) => FakeAnswer): void =>
    fake.answer(operationId, (call): FakeReply => {
      const before = engine.sim.store.getState();
      let answer: FakeAnswer;
      try {
        answer = run(call);
      } catch (error) {
        return engineRefusal(fake, operationId, error);
      }
      const delay = bed.answerDelayMs > 0 ? { delayMs: bed.answerDelayMs } : {};
      const revision = pushChanges(before);
      return revision === null ? { ...answer, ...delay } : { ...answer, revision, ...delay };
    });

  hosted('runDiagnostics', () => ({ status: 202, body: { runId: engine.sim.actions.runDiagnostics() } }));
  hosted('startSoftwareUpdate', () => {
    engine.sim.actions.startSoftwareUpdate();
    return { status: 202 };
  });
  hosted('injectFault', (call) => {
    const body = call.body as { kind: FaultKind; target?: FaultTarget };
    engine.sim.actions.inject(body.kind, body.target);
    return { status: 204 };
  });
  hosted('clearFault', (call) => {
    const body = call.body as { kind: FaultKind; target?: FaultTarget };
    engine.sim.actions.clearFault(body.kind, body.target);
    return { status: 204 };
  });
  hosted('resetMicClip', (call) => {
    engine.sim.actions.resetClip((call.body as { channel: AudioTrackId }).channel);
    return { status: 204 };
  });
  hosted('recoverSession', () => {
    engine.sim.actions.recover();
    const state = engine.sim.store.getState().session;
    return { status: 202, body: { sessionId: state?.id ?? '', state: 'RECOVERY' } };
  });
  // A scenario load starts a new epoch: the answer names it, and the snapshot of that epoch follows (CL-18).
  fake.answer('loadScenario', (call): FakeReply => {
    engine.sim.actions.loadScenario((call.body as { name: ScenarioName }).name);
    const position = fake.startEpoch();
    const connection = bed.connection();
    const send = (): void => void connection.snapshot(wire(engine.sim.store.getState()), { epoch: position.epoch, revision: position.revision });
    if (bed.order === 'delta-first') send();
    else held.push(send);
    const delay = bed.answerDelayMs > 0 ? { delayMs: bed.answerDelayMs } : {};
    return { status: 200, body: { epoch: position.epoch }, epoch: position.epoch, revision: position.revision, ...delay };
  });

  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    const bearer = bearerOf(connection.headers);
    if (session !== null && bearer === session.token) connection.startOperator(wire(engine.sim.store.getState())).heartbeat();
    else if (bearer === STORED.deviceCredential) connection.startDevice().heartbeat();
    else connection.startAnonymous().heartbeat();
    connection.beatEvery();
  });

  // The paired device, and the enrolment an earlier password session on it left.
  const secure = globalThis.__DEMS_SECURE_STORE_MOCK__;
  secure.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
  if (enrolled !== false) {
    secure.seed(SECURE_ITEM_KEYS.biometricToken, BIO_TOKENS[0]!, enrolled.protectedItem);
    secure.seed(
      SECURE_ITEM_KEYS.biometricMarker,
      JSON.stringify({ operatorId: operator.id, displayName: operator.displayName, deviceId: STORED.deviceId, protected: enrolled.protectedItem }),
    );
  }
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  (bed as { mobile: MobileLive }).mobile = created;
  const liveSim = created.sim;

  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
  function LiveRoot() {
    const stack = <Stack screenOptions={{ headerShown: false }} />;
    return (
      <AppProviders sim={liveSim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new InertSocket()}>
        <AuthProbe />
        {strict ? <StrictMode>{stack}</StrictMode> : stack}
      </AppProviders>
    );
  }
  const routes = {
    _layout: LiveRoot,
    index: () => <Text testID="screen-index">index</Text>,
    'settings/_layout': SettingsLayout,
    'settings/index': SettingsRoute,
    'settings/[section]': SettingsSectionRoute,
  };
  (bed as { app: ReturnType<typeof renderRoutes> }).app = renderRoutes(routes, initialUrl);
  await flushJobs();
  await bed.elapse(1_000, 250);
  if (signedOut) return bed;

  // The operator signs in on the device, through the Live source (§5.2).
  let signedIn: unknown = null;
  act(() => {
    settle(() => coreActionsOf(created.sim).signIn(operator.username, MARKER_PASSWORD), {
      ok: (result) => {
        signedIn = result;
      },
      fail: (error) => {
        signedIn = error;
      },
    });
  });
  await flushJobs();
  await bed.elapse(1_000, 250);
  const auth = created.sim.store.getState().auth;
  if (auth.status !== 'SIGNED_IN' || auth.operatorId !== operator.id) {
    throw new Error(`live settings bed: the Live sign-in did not land (${JSON.stringify(signedIn)}; auth ${auth.status})`);
  }
  return bed;
}

/**
 * The same route files around a signed-in test SIMULATOR (SIMULATED mode), for the cases that pin what
 * SIMULATED shows next to the LIVE ones. No transport is involved.
 */
export async function renderSimulatedSettings({ window = 'phonePortrait', user = 'budi.santoso', initialUrl = '/settings' }: Pick<LiveSettingsBedOptions, 'window' | 'user' | 'initialUrl'> = {}) {
  setWindow(window);
  const test = createTestSim();
  if (!test.sim.actions.signIn(user, DEMO_OPERATOR_PASSWORD).ok) throw new Error('settings bed: the simulator could not sign in the operator');
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
  function SimulatedRoot() {
    return (
      <AppProviders sim={test.sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new InertSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
  }
  const routes = {
    _layout: SimulatedRoot,
    index: () => <Text testID="screen-index">index</Text>,
    'settings/_layout': SettingsLayout,
    'settings/index': SettingsRoute,
    'settings/[section]': SettingsSectionRoute,
  };
  const app = renderRoutes(routes, initialUrl);
  await flushJobs();
  return { app, test };
}

/** A 403 `NOT_PERMITTED` as the Core's permission guard answers it (RB-4), for an operation whose 403 examples hold none (every seeded role holds DIAGNOSTICS_RUN). */
export function notPermitted(operationId: string, permission: string, role: string): FakeAnswer {
  return refusal(403, 'NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', { operationId, permission, role });
}

export { ScenarioName };
