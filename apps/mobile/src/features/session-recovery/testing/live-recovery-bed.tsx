/**
 * Test-only bed for the Live tests of Recovery Status (backend task, plan row W73). Never import it
 * from app code.
 *
 * - The app's REAL Live source (`createMobileLive`) over the contract-checked fake transport
 *   (`createFakeTransport`), mounted by the real `AppProviders` around the REAL `/session/recovery`
 *   route file, with the runtime's real `SessionRouteSync` (as `(app)/_layout.tsx` mounts it), so
 *   "the Core's session went to FAULT → this screen opens" is the production path.
 * - The device is paired (its credential is the fake transport's placeholder in the secure-store
 *   mock) and a demo operator signs in through the Live source's own sign-in: answer, a new socket,
 *   the snapshot of that socket (§5.2). The session the Core answers names that operator with the
 *   permissions of the role (the Core's matrix is seeded from the shared table, [SP:AC-B-17]).
 * - The Core server's engine is a real simulator (`createTestSim`, signed in as the same operator).
 *   Its clock runs with the fake clock (`elapse` advances both while the Core is up), so the times
 *   the Core stamps (`session.recovery.startedAt`, `completesAt`) and the Live clock agree as they do
 *   on one computer. Each command the app sends runs the same action there; the replicated slices it
 *   changed travel back as ONE delta whose revision the answer names (API-7, RT-5), delta first or
 *   answer first (`order`). What the engine changes by itself while time passes is pushed as
 *   unsolicited deltas.
 * - `restartCore` is a Core restart as 01_specs §8.6 states it (requirement E1): the socket closes
 *   with 1001, the Core answers nothing for a while, then it starts with a NEW epoch (the stored epoch
 *   plus 1, revision 0); a session that was PRECHECK, ARMED, RECORDING, STOPPING or FINALIZING gets
 *   the power-failure fault (raised at the instant the engine last ran, as the server raises it at the
 *   last committed instant), FAULT stays as it is, RECOVERY completes at its stored deadline; the
 *   operator's session survives (restored from the database); the reconnecting socket gets `hello`
 *   and the snapshot of the new epoch. The bed's one approximation: the engine's subsystem timers
 *   run through the downtime (the server's start restarts them), which changes no slice this screen
 *   reads.
 *
 * Rules the fake's authors gave every client row (decision F59): connect scripts add up (one script
 * here, installed once); the fake clock is advanced in steps with the promise jobs in between
 * (`elapse`). No credential value is printed or stored by this file; the password is a marker that
 * opens nothing.
 *
 * Import order: `./recovery-test-setup` first, then `@/navigation/testing/router-harness`, then
 * this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack, router, type Href } from 'expo-router';
import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StrictMode } from 'react';
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
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ROLE_PERMISSIONS, type SimState } from '@dems/shared/sim';
import SessionRecoveryRoute from '@/app/(app)/session/recovery';
import { resetMotionStateForTests } from '@/motion';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import {
  SessionRouteSync,
  createMobileLive,
  resetCoreErrorPresenterForTests,
  resetCoreLinkPrefsForTests,
  resetDebugLaunchForTests,
  type MobileLive,
} from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { createTestSim, type TestSim } from '@/runtime/testing/test-sim';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** The contract's session of a paired device (AKP Budi Santoso, INVESTIGATOR). */
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The credential the device holds: the fake transport's placeholder, in the contract's shape. */
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w73'].join('-');

/** Session states that a Core start turns into FAULT through the power-failure fault (01_specs §8.6). */
const IN_FLIGHT_AT_STOP: readonly string[] = ['PRECHECK', 'ARMED', 'RECORDING', 'STOPPING', 'FINALIZING'];

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

/** Promise jobs settle inside `act`: the fake's answers, the connect scripts, the storage mock. */
async function flushJobs(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

export type DeltaOrder = 'delta-first' | 'answer-first';

export interface LiveRecoveryBedOptions {
  window?: WindowName;
  /** The operator who signs in on the device: `budi.santoso` INVESTIGATOR (default), `andi.pratama` SUPERVISOR, `rina.wijaya` TECHNICIAN. */
  user?: string;
  /** Runs on the signed-in engine before the device signs in (a scenario, a fault). */
  setup?: (engine: TestSim) => void;
  /** The route the app opens on (default `/home`; the route sync opens the recovery screen on FAULT). */
  initialUrl?: string;
  /** Delivers every command's answer this much later on the fake clock (LB-1). */
  answerDelayMs?: number;
  /** Render the app under React's `StrictMode`, as a development build does (decision D158, F69-1). */
  strict?: boolean;
}

export interface LiveRecoveryBed {
  readonly fake: FakeTransport;
  /** The Core server's engine. */
  readonly engine: TestSim;
  readonly mobile: MobileLive;
  readonly app: ReturnType<typeof renderRoutes>;
  /** The order of the answer and the delta of the next commands (default `delta-first`). */
  order: DeltaOrder;
  /** Every command's answer is delivered this much later on the fake clock. */
  answerDelayMs: number;
  /** Sends the deltas `answer-first` held back, in order. */
  sendHeldDeltas(): void;
  /**
   * Moves the fake clock in steps, with the promise jobs in between. While the Core is up its engine
   * runs too, and what it changed is pushed as one delta per step.
   */
  elapse(ms: number, step?: number): Promise<void>;
  /** The Core stops answering (requests fail, the socket drops, reconnects are refused), or answers again. */
  setReachable(reachable: boolean): void;
  /** A Core restart as 01_specs §8.6 states it (see the file header). Resolves when the device holds the new epoch. */
  restartCore(options?: { downMs?: number }): Promise<void>;
  /** Runs something on the Core's engine (a fault the Core raises by itself) and pushes what changed as one delta. */
  onCore(run: (engine: TestSim) => void): Promise<void>;
  flush(turns?: number): Promise<void>;
  open(href: string): Promise<void>;
  requests(operationId: string): readonly FakeHttpCall[];
  /** The socket opened last. */
  connection(): FakeConnection;
  /** The device's replica. */
  state(): SimState;
  /** The epoch the device's replica holds, read from the socket's last state message. */
  epoch(): number;
  /** Stops the Live source and throws the first contract violation the fake recorded. */
  stop(): void;
}

/** Resets what the runtime keeps between tests. Call it in `beforeEach`, before `renderLiveRecovery`. */
export async function resetLiveRecoveryBed(): Promise<void> {
  await AsyncStorage.clear();
  resetShellState();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  globalThis.__DEMS_SECURE_STORE_MOCK__.reset();
}

export async function renderLiveRecovery({
  window = 'phonePortrait',
  user = 'budi.santoso',
  setup,
  initialUrl = '/home',
  answerDelayMs = 0,
  strict = false,
}: LiveRecoveryBedOptions = {}): Promise<LiveRecoveryBed> {
  setWindow(window);
  const fake = createFakeTransport({ epoch: 2, revision: 10 });
  const now = () => fake.clock.now();
  const engine = createTestSim({ start: now() });
  const operator = OPERATORS.find((candidate) => candidate.username === user);
  if (operator === undefined || !engine.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok) {
    throw new Error('live recovery bed: the engine could not sign in the operator');
  }
  setup?.(engine);

  let reachable = true;
  let session: { token: string; info: AuthSessionInfo } | null = null;
  const held: (() => void)[] = [];
  const answered = (operationId: string, reply: (call: FakeHttpCall) => FakeReply): void =>
    fake.answer(operationId, (call) => (reachable ? reply(call) : OUTAGE));

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

  /** Pushes what the engine changed since `before` as one unsolicited delta, when a socket is open to carry it. */
  const pushChanges = (before: SimState): void => {
    const ops = changedSlices(before, engine.sim.store.getState());
    if (ops.length === 0) return;
    const last = fake.connections[fake.connections.length - 1];
    // A change made while no socket is open reaches the device in the snapshot of its next connect.
    if (last === undefined || last.state !== 'OPEN' || last.principal !== 'OPERATOR') return;
    act(() => void last.delta(ops));
  };

  const bed: LiveRecoveryBed = {
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
        const size = Math.min(step, ms - done);
        act(() => {
          fake.clock.advance(size);
        });
        if (reachable) {
          const before = engine.sim.store.getState();
          engine.advance(size);
          pushChanges(before);
        }
        await flushJobs(20);
      }
    },
    setReachable(next) {
      const wasUp = reachable;
      reachable = next;
      const last = fake.connections[fake.connections.length - 1];
      if (!next && wasUp && last !== undefined && last.state === 'OPEN') act(() => void last.drop());
    },
    async restartCore({ downMs = 10_000 } = {}) {
      // Stop (01_specs §8.6): the server closes its sockets with 1001 and answers nothing.
      const last = fake.connections[fake.connections.length - 1];
      reachable = false;
      if (last !== undefined && last.state === 'OPEN') act(() => void last.close(1001, 'Server shutting down'));
      await flushJobs();
      await bed.elapse(downMs, 250);
      // Start: the in-flight session gets the power-failure fault at the instant the engine last ran.
      const state = engine.sim.store.getState().session?.state ?? null;
      if (state !== null && IN_FLIGHT_AT_STOP.includes(state)) engine.sim.actions.inject('POWER_FAIL');
      // The engine catches up with the server clock (a RECOVERY completes at its stored deadline).
      const behind = fake.clock.now() - engine.clock.now();
      if (behind > 0) engine.advance(behind);
      fake.startEpoch();
      reachable = true;
      // The device's next reconnect attempt (at most 8 s of backoff) gets hello and the new snapshot.
      const target = fake.position.epoch;
      for (let waited = 0; waited < 20_000 && bed.epoch() !== target; waited += 250) await bed.elapse(250, 250);
      if (bed.epoch() !== target) throw new Error('live recovery bed: the device did not take the new epoch');
      await bed.elapse(500, 100);
    },
    async onCore(run) {
      const before = engine.sim.store.getState();
      run(engine);
      pushChanges(before);
      await flushJobs();
    },
    flush: flushJobs,
    async open(href) {
      act(() => router.push(href as Href));
      await flushJobs();
    },
    requests: (operationId) => fake.log.requestsOf(operationId),
    connection: () => fake.connection(),
    state: () => bed.mobile.sim.store.getState(),
    epoch() {
      for (let index = fake.connections.length - 1; index >= 0; index -= 1) {
        const connection = fake.connections[index]!;
        const states = connection.sent.filter((message): message is { type: string; epoch: number } => {
          const type = (message as { type?: unknown }).type;
          return type === 'snapshot' || type === 'delta';
        });
        const newest = states[states.length - 1];
        if (newest !== undefined) return newest.epoch;
      }
      return -1;
    },
    stop() {
      bed.mobile.stop();
      fake.assertNoViolations();
    },
  };

  /**
   * One hosted command: the engine runs it; a 2xx answer names the revision of the delta that holds
   * what changed (none for a no-op, such as acknowledging an alert twice). A refusal of the engine
   * is the Core's 409.
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
      const delay = bed.answerDelayMs > 0 ? { delayMs: bed.answerDelayMs } : {};
      const ops = changedSlices(before, engine.sim.store.getState());
      if (ops.length === 0) return { ...answer, ...delay };
      const revision = fake.position.revision + 1;
      const connection = bed.connection();
      const send = (): void => void connection.delta(ops, { revision });
      if (bed.order === 'delta-first') send();
      else held.push(send);
      return { ...answer, revision, ...delay };
    });

  hosted('recoverSession', () => {
    engine.sim.actions.recover();
    return { status: 202, body: { sessionId: engine.sim.store.getState().session?.id ?? 'SES-UNKNOWN', state: 'RECOVERY' } };
  });
  hosted('acknowledgeAlert', (call) => {
    engine.sim.actions.acknowledgeAlert(String(call.params['id']));
    return { status: 204 };
  });

  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
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
    const app = (
      <AppProviders sim={liveSim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new InertSocket()}>
        <SessionRouteSync />
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    return strict ? <StrictMode>{app}</StrictMode> : app;
  }
  const routes = {
    _layout: LiveRoot,
    index: () => <Text testID="screen-index">index</Text>,
    home: () => <Text testID="screen-home">home</Text>,
    'session/live': () => <Text testID="screen-session-live">live</Text>,
    'session/new': () => <Text testID="screen-session-new">new</Text>,
    'session/finalizing': () => <Text testID="screen-session-finalizing">finalizing</Text>,
    'session/recovery': SessionRecoveryRoute,
    'evidence/[evidenceId]': () => <Text testID="screen-evidence-detail">evidence</Text>,
  };
  (bed as { app: ReturnType<typeof renderRoutes> }).app = renderRoutes(routes, initialUrl);
  await flushJobs();
  await bed.elapse(1_000, 250);

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
    throw new Error(`live recovery bed: the Live sign-in did not land (${JSON.stringify(signedIn)}; auth ${auth.status})`);
  }
  return bed;
}
