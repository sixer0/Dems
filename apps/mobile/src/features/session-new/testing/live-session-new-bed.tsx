/**
 * Test-only bed for the Live tests of Start Session (backend task, plan row W67). Never import it
 * from app code.
 *
 * - The app's REAL Live source (`createMobileLive`) over the contract-checked fake transport
 *   (`createFakeTransport`), mounted by the real `AppProviders` around the REAL `/session/new` route
 *   file, as the Simulated harness (`session-new-harness.tsx`) mounts it around a test simulator.
 * - The device is paired (its credential is the fake transport's placeholder in the secure-store
 *   mock) and the investigator signs in through the Live source's own sign-in: answer, a new socket,
 *   the snapshot of that socket (§5.2).
 * - The Core server's engine is a real simulator (`createTestSim`, signed in as the same
 *   investigator). Each session command the app sends runs the same action there; the replicated
 *   slices it changed travel back as ONE delta whose revision the answer names (API-7, RT-5), in the
 *   order `order` says: the delta before the answer (`delta-first`) or the answer first and the delta
 *   when the test calls `sendHeldDeltas()` (`answer-first`). The Live source holds the action's
 *   continuation until the store holds that revision (CL-16), whatever the order.
 * - `/session/live` is a stand-in with the live route's own policy (anything but RECORDING is sent
 *   back), so a test that lands there proves the monitor opened with the session RECORDING.
 *
 * Rules the fake's authors gave every client row (decision F59): connect scripts add up (one script
 * here, installed once); the fake clock is advanced in steps with the promise jobs in between
 * (`elapse`). No credential value is printed or stored by this file; the password is a marker that
 * opens nothing.
 *
 * Import order: `./session-new-test-setup` first, then `@/navigation/testing/router-harness`, then
 * this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Redirect, Stack, router } from 'expo-router';
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
  OUTAGE,
  createFakeTransport,
  refusal,
  type FakeAnswer,
  type FakeConnection,
  type FakeHttpCall,
  type FakeReply,
  type FakeTransport,
} from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, type SessionCreateInput, type SimState } from '@dems/shared/sim';
import SessionNewRoute from '@/app/(app)/session/new';
import { resetMotionStateForTests } from '@/motion';
import { useSessionLiveRedirect } from '@/navigation';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import {
  createMobileLive,
  resetCoreErrorPresenterForTests,
  resetCoreLinkPrefsForTests,
  resetDebugLaunchForTests,
  type MobileLive,
} from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { createTestSim, type TestSim } from '@/runtime/testing/test-sim';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** The contract's session of a paired device: AKP Budi Santoso, INVESTIGATOR, `SESSION_START` among the permissions. */
export const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The credential the device holds: the fake transport's placeholder, in the contract's shape. */
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w67'].join('-');

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

/** `/session/live` stand-in with the live route's policy (not RECORDING → the §3.7 target). */
function LiveStandIn() {
  const redirect = useSessionLiveRedirect();
  if (redirect !== null) return <Redirect href={redirect} />;
  return <Text testID="screen-session-live">live</Text>;
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

export interface LiveSessionNewBedOptions {
  window?: WindowName;
  /** Runs on the signed-in engine before the device signs in (a session, a fault). */
  setup?: (engine: TestSim) => void;
  /** Delivers every command's answer this much later on the fake clock (AC-C-57). */
  answerDelayMs?: number;
}

export interface LiveSessionNewBed {
  readonly fake: FakeTransport;
  /** The Core server's engine. */
  readonly engine: TestSim;
  readonly mobile: MobileLive;
  readonly app: ReturnType<typeof renderRoutes>;
  /** The order of the answer and the delta of the next session commands (default `delta-first`). */
  order: DeltaOrder;
  /** Every command's answer is delivered this much later on the fake clock. */
  answerDelayMs: number;
  /** Sends the deltas `answer-first` held back, in order. */
  sendHeldDeltas(): void;
  /** Runs the engine (the Core's own clock) for `ms` and pushes what changed as one unsolicited delta. */
  runCore(ms: number): Promise<void>;
  /**
   * The Core stops answering (requests fail, the socket drops, reconnects are refused), or answers
   * again. `'hanging'`: requests fail and a reconnect attempt is left CONNECTING (no answer at all).
   */
  setReachable(reachable: boolean | 'hanging'): void;
  /** Moves the fake clock in steps, with the promise jobs in between. */
  elapse(ms: number, step?: number): Promise<void>;
  flush(turns?: number): Promise<void>;
  /** Pushes `/session/new` over Home, as the Home "Start Session" button does. */
  openFlow(href?: string): Promise<void>;
  requests(operationId: string): readonly FakeHttpCall[];
  /** The socket opened last (the signed-in one after the sign-in). */
  connection(): FakeConnection;
  state(): SimState;
  /** Stops the Live source and throws the first contract violation the fake recorded. */
  stop(): void;
}

/** Promise jobs settle inside `act`: the fake's answers, the connect scripts, the storage mock. */
async function flushJobs(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

/** Resets what the runtime keeps between tests. Call it in `beforeEach`, before `renderLiveSessionNew`. */
export async function resetLiveSessionNewBed(): Promise<void> {
  await AsyncStorage.clear();
  resetShellState();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  globalThis.__DEMS_SECURE_STORE_MOCK__.reset();
}

export async function renderLiveSessionNew({ window = 'phonePortrait', setup, answerDelayMs = 0 }: LiveSessionNewBedOptions = {}): Promise<LiveSessionNewBed> {
  setWindow(window);
  const fake = createFakeTransport({ epoch: 2, revision: 10 });
  const now = () => fake.clock.now();
  const engine = createTestSim({ start: now() });
  const investigator = OPERATORS.find((operator) => operator.id === DEVICE_SESSION.operator.id);
  if (investigator === undefined || !engine.sim.actions.signIn(investigator.username, DEMO_OPERATOR_PASSWORD).ok) {
    throw new Error('live session-new bed: the engine could not sign in the investigator');
  }
  setup?.(engine);

  let reachable: boolean | 'hanging' = true;
  let session: { token: string; info: AuthSessionInfo } | null = null;
  const held: (() => void)[] = [];
  const answered = (operationId: string, reply: (call: FakeHttpCall) => FakeReply): void =>
    fake.answer(operationId, (call) => (reachable === true ? reply(call) : OUTAGE));

  answered('getAuthSession', (call) =>
    session !== null && bearerOf(call.headers) === session.token
      ? { status: 200, body: { ...session.info, serverTime: now() } }
      : fake.example('getAuthSession', 401),
  );
  answered('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  answered('getDeviceRegistration', (call) =>
    bearerOf(call.headers) === STORED.deviceCredential || (session !== null && bearerOf(call.headers) === session.token)
      ? { status: 200, body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core } }
      : fake.example('getDeviceRegistration', 401),
  );
  answered('signIn', (call) => {
    if (bearerOf(call.headers) !== STORED.deviceCredential) return fake.example('signIn', 403, 'deviceNotPaired');
    const info: AuthSessionInfo = {
      ...DEVICE_SESSION,
      method: 'PASSWORD',
      deviceId: STORED.deviceId,
      issuedAt: now(),
      lastActivityAt: now(),
      idleExpiresAt: now() + 900_000,
      absoluteExpiresAt: now() + 28_800_000,
      serverTime: now(),
    };
    session = { token: FAKE_CREDENTIALS.sessionToken, info };
    return { status: 200, body: { session: info, sessionToken: FAKE_CREDENTIALS.sessionToken } };
  });
  answered('signOut', () => ({ status: 204 }));
  answered('touchSession', () => fake.example('touchSession'));

  const bed: LiveSessionNewBed = {
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
    async runCore(ms) {
      const before = engine.sim.store.getState();
      engine.advance(ms);
      const ops = changedSlices(before, engine.sim.store.getState());
      if (ops.length > 0) act(() => void bed.connection().delta(ops));
      await flushJobs();
    },
    setReachable(next) {
      const wasUp = reachable === true;
      reachable = next;
      if (next !== true && wasUp) act(() => void bed.connection().drop());
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
    async openFlow(href = '/session/new') {
      act(() => router.push(href as never));
      await flushJobs();
    },
    requests: (operationId) => fake.log.requestsOf(operationId),
    connection: () => fake.connection(),
    state: () => bed.mobile.sim.store.getState(),
    stop() {
      bed.mobile.stop();
      fake.assertNoViolations();
    },
  };

  /**
   * One hosted session command: the engine runs it; a 2xx answer names the revision of the delta
   * that holds what changed. A refusal of the engine is the Core's 409.
   */
  const hosted = (operationId: string, run: (call: FakeHttpCall) => FakeAnswer): void =>
    answered(operationId, (call) => {
      const before = engine.sim.store.getState();
      let answer: FakeAnswer;
      try {
        answer = run(call);
      } catch {
        return refusal(409, 'INVALID_STATE', 'The session is not in a state that allows this.');
      }
      if (answer.status >= 300) return answer;
      const ops = changedSlices(before, engine.sim.store.getState());
      if (ops.length === 0) throw new Error(`live session-new bed: ${operationId} changed no replicated slice`);
      const revision = fake.position.revision + 1;
      const connection = bed.connection();
      const send = (): void => void connection.delta(ops, { revision });
      if (bed.order === 'delta-first') send();
      else held.push(send);
      return { ...answer, revision, ...(bed.answerDelayMs > 0 ? { delayMs: bed.answerDelayMs } : {}) };
    });
  const sessionIdOf = (): string => engine.sim.store.getState().session?.id ?? 'SES-UNKNOWN';

  hosted('createSession', (call) => {
    const result = engine.sim.actions.createSession(call.body as SessionCreateInput);
    if (result.ok) return { status: result.created ? 201 : 200, body: { sessionId: result.sessionId, state: 'CREATE', created: result.created } };
    if (result.reason === 'SESSION_ACTIVE') return refusal(409, 'SESSION_ACTIVE', 'A session is already active.');
    if (result.reason === 'NOT_PERMITTED') return fake.example('createSession', 403, 'notPermitted');
    return fake.example('createSession', 422, 'invalidInput');
  });
  hosted('beginPrecheck', () => {
    engine.sim.actions.beginPrecheck();
    return { status: 202, body: { sessionId: sessionIdOf(), state: 'PRECHECK' } };
  });
  hosted('acknowledgePrecheckWarnings', () => {
    engine.sim.actions.acknowledgePrecheckWarnings();
    return { status: 200, body: { sessionId: sessionIdOf(), state: 'ARMED' } };
  });
  hosted('retryPrecheck', () => {
    engine.sim.actions.retryPrecheck();
    return { status: 202, body: { sessionId: sessionIdOf(), state: 'PRECHECK' } };
  });
  hosted('startSession', () => {
    engine.sim.actions.startRecording();
    return { status: 200, body: { sessionId: sessionIdOf(), state: 'RECORDING' } };
  });
  hosted('cancelSession', () => {
    engine.sim.actions.cancel();
    return { status: 204 };
  });

  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    if (reachable === 'hanging') return; // left CONNECTING: no answer at all
    if (!reachable) {
      connection.refuse();
      return;
    }
    const bearer = bearerOf(connection.headers);
    if (session !== null && bearer === session.token) connection.startOperator(wire(engine.sim.store.getState())).heartbeat();
    else if (bearer === STORED.deviceCredential) connection.startDevice().heartbeat();
    else connection.startAnonymous().heartbeat();
    connection.beatEvery();
  });

  // The paired device.
  globalThis.__DEMS_SECURE_STORE_MOCK__.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  (bed as { mobile: MobileLive }).mobile = created;
  const liveSim = created.sim;

  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
  function LiveRoot() {
    return (
      <AppProviders sim={liveSim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new InertSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
  }
  const routes = {
    _layout: LiveRoot,
    index: () => <Text testID="screen-index">index</Text>,
    home: () => <Text testID="screen-home">home</Text>,
    'session/new': SessionNewRoute,
    'session/live': LiveStandIn,
    'session/recovery': () => <Text testID="screen-session-recovery">recovery</Text>,
  };
  (bed as { app: ReturnType<typeof renderRoutes> }).app = renderRoutes(routes, '/home');
  await flushJobs();
  await bed.elapse(1_000, 250);

  // The investigator signs in on the device, through the Live source (§5.2).
  let signedIn: unknown = null;
  act(() => {
    settle(() => coreActionsOf(created.sim).signIn(investigator.username, MARKER_PASSWORD), {
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
  if (auth.status !== 'SIGNED_IN' || auth.operatorId !== investigator.id) {
    throw new Error(`live session-new bed: the Live sign-in did not land (${JSON.stringify(signedIn)}; auth ${auth.status})`);
  }
  return bed;
}
