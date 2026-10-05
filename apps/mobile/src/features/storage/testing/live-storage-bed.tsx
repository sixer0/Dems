/**
 * Test-only bed for the Live tests of Storage and Network & Time (backend task, plan row W79). Never
 * import it from app code.
 *
 * - The app's REAL Live source (`createMobileLive`) over the contract-checked fake transport
 *   (`createFakeTransport`), mounted by the real `AppProviders` around the REAL route files `/storage`
 *   and `/network-time`, as the Simulated suites mount them around a test simulator.
 * - The device is paired (its credential is the fake transport's placeholder in the secure-store mock)
 *   and a demo operator signs in through the Live source's own sign-in: answer, a new socket, the
 *   snapshot of that socket. The session the Core answers names that operator, with the permissions of
 *   the role (the Core's matrix is seeded from the shared table, [SP:AC-B-17]).
 * - The Core server's engine is a real simulator (`createTestSim`, signed in as the same operator). A
 *   storage policy change the app sends (operation 55) runs `setStoragePolicy` there; the replicated
 *   slices it changed travel back as ONE delta whose revision the answer names (API-7, RT-5), before the
 *   answer (`delta-first`) or after it, when the test calls `sendHeldDeltas()` (`answer-first`). The
 *   Live source holds the action's continuation until the store holds that revision (CL-16). A refusal
 *   of the engine is answered as the Core answers it: the contract's own example of that refusal (403
 *   `notPermitted`, 422 `invalidInput`).
 * - `runCore(ms)` runs the engine on its own clock and pushes what changed as one unsolicited delta: a
 *   GNSS loss, a filling disk, a tablet that drops, as the Core's realtime channel sends them.
 *
 * Rules the fake's authors gave every client row (decision F59): connect scripts add up (one script
 * here, installed once); the fake clock is advanced in steps with the promise jobs in between
 * (`elapse`); the session read after a reconnect names the session the test signed in with. No
 * credential value is printed or stored by this file; the password is a marker that opens nothing.
 *
 * Import order: `./storage-test-setup` (or network-time's own setup) first, then
 * `@/navigation/testing/router-harness`, then this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack, router, type Href } from 'expo-router';
import { StrictMode } from 'react';
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
import { FAKE_CREDENTIALS, createFakeTransport, type FakeAnswer, type FakeConnection, type FakeHttpCall, type FakeReply, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ROLE_PERMISSIONS, SimErrorCode, SimPermissionError, SimTransitionError, type SimState, type StoragePolicy } from '@dems/shared/sim';
import NetworkTimeRoute from '@/app/(app)/(tabs)/network-time';
import StorageRoute from '@/app/(app)/(tabs)/storage';
import { resetMotionStateForTests } from '@/motion';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { createMobileLive, resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests, type MobileLive } from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { FakeHeartbeatSocket, createTestSim, type TestSim } from '@/runtime/testing/test-sim';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** The contract's session of a paired device: the times and the device the bed's sessions copy. */
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The credential the device holds: the fake transport's placeholder, in the contract's shape. */
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w79'].join('-');

/** The seeded demo operators: INVESTIGATOR, SUPERVISOR (holds EVIDENCE_REVIEW), TECHNICIAN (holds MAINTENANCE). */
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
export type LiveScreen = '/storage' | '/network-time';

export interface LiveStorageBedOptions {
  window?: WindowName;
  /** The operator who signs in on the device: `andi.pratama` SUPERVISOR (default), `rina.wijaya` TECHNICIAN, `budi.santoso` INVESTIGATOR. */
  user?: DemoUsername;
  /** Runs on the signed-in engine before the device signs in (a policy, a fault, a slice of its own). */
  setup?: (engine: TestSim) => void;
  /** Delivers every hosted answer this much later on the fake clock (the delta is not delayed). */
  answerDelayMs?: number;
  /**
   * The route tree renders under React `<StrictMode>` (inside the providers, so the Live source is
   * mounted once): every effect of the screens runs twice at mount, as in a development build
   * (decision D158, finding F69-1).
   */
  strict?: boolean;
}

export interface LiveStorageBed {
  readonly fake: FakeTransport;
  /** The Core server's engine. */
  readonly engine: TestSim;
  readonly mobile: MobileLive;
  readonly app: ReturnType<typeof renderRoutes>;
  /** The order of the answer and the delta of the next hosted commands (default `delta-first`). */
  order: DeltaOrder;
  /** Every hosted answer is delivered this much later on the fake clock. */
  answerDelayMs: number;
  /** Sends the deltas `answer-first` held back, in order. */
  sendHeldDeltas(): void;
  /**
   * Runs `change` on the engine (a command of another client, a fault), then the engine's own clock for
   * `ms`, and pushes what changed as one unsolicited delta.
   */
  runCore(ms: number, change?: (engine: TestSim) => void): Promise<void>;
  /** Moves the fake clock in steps, with the promise jobs in between. */
  elapse(ms: number, step?: number): Promise<void>;
  flush(turns?: number): Promise<void>;
  /** Pushes a route, as a row of More does on a phone. */
  open(href: LiveScreen): Promise<void>;
  requests(operationId: string): readonly FakeHttpCall[];
  /** Every request the app sent, as `<operationId>`, in order. */
  operations(): string[];
  /** The socket opened last (the signed-in one after the sign-in). */
  connection(): FakeConnection;
  /** The app's store: the Live source's replica. */
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

/** Resets what the runtime keeps between tests. Call it in `beforeEach`, before `renderLiveStorage`. */
export async function resetLiveStorageBed(): Promise<void> {
  await AsyncStorage.clear();
  resetShellState();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  globalThis.__DEMS_SECURE_STORE_MOCK__.reset();
}

/** The Core's answer to a refusal of its engine: the contract's example of that refusal. */
function engineRefusal(fake: FakeTransport, operationId: string, error: unknown): FakeAnswer {
  if (operationId === 'setStoragePolicy' && error instanceof SimPermissionError) return fake.example('setStoragePolicy', 403, 'notPermitted');
  if (operationId === 'setStoragePolicy' && error instanceof SimTransitionError && error.code === SimErrorCode.POLICY_RANGE) {
    return fake.example('setStoragePolicy', 422, 'invalidInput');
  }
  throw new Error(`live storage bed: no Core answer is scripted for a refusal of ${operationId} (${error instanceof Error ? error.name : 'unknown'})`);
}

export async function renderLiveStorage({
  window = 'phonePortrait',
  user = 'andi.pratama',
  setup,
  answerDelayMs = 0,
  strict = false,
}: LiveStorageBedOptions = {}): Promise<LiveStorageBed> {
  setWindow(window);
  const fake = createFakeTransport({ epoch: 2, revision: 10 });
  const now = () => fake.clock.now();
  const engine = createTestSim({ start: now() });
  const operator = OPERATORS.find((candidate) => candidate.username === user);
  if (operator === undefined || !engine.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok) {
    throw new Error('live storage bed: the engine could not sign in the operator');
  }
  setup?.(engine);

  let session: { token: string; info: AuthSessionInfo } | null = null;
  const held: (() => void)[] = [];

  fake.answer('getAuthSession', (call) =>
    session !== null && bearerOf(call.headers) === session.token ? { status: 200, body: { ...session.info, serverTime: now() } } : fake.example('getAuthSession', 401),
  );
  fake.answer('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  fake.answer('getDeviceRegistration', (call) =>
    bearerOf(call.headers) === STORED.deviceCredential || (session !== null && bearerOf(call.headers) === session.token)
      ? { status: 200, body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core } }
      : fake.example('getDeviceRegistration', 401),
  );
  fake.answer('signIn', (call) => {
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
  fake.answer('signOut', () => ({ status: 204 }));
  fake.answer('touchSession', () => fake.example('touchSession'));

  const bed: LiveStorageBed = {
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
    async runCore(ms, change) {
      const before = engine.sim.store.getState();
      change?.(engine);
      engine.advance(ms);
      const ops = changedSlices(before, engine.sim.store.getState());
      if (ops.length > 0) act(() => void bed.connection().delta(ops));
      await flushJobs();
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
    operations: () => [...fake.log.operationIds()],
    connection: () => fake.connection(),
    state: () => bed.mobile.sim.store.getState(),
    stop() {
      bed.mobile.stop();
      fake.assertNoViolations();
    },
  };

  /**
   * Operation 55, hosted: the engine runs it; the 200 answer is the policy after the change and names
   * the revision of the delta that holds what changed (or the present revision when nothing replicated
   * changed). A refusal of the engine is the Core's refusal.
   */
  fake.answer('setStoragePolicy', (call): FakeReply => {
    const before = engine.sim.store.getState();
    try {
      engine.sim.actions.setStoragePolicy(call.body as Partial<StoragePolicy>);
    } catch (error) {
      return engineRefusal(fake, 'setStoragePolicy', error);
    }
    const after = engine.sim.store.getState();
    const answer: FakeAnswer = { status: 200, body: JSON.parse(JSON.stringify(after.storagePolicy)) as StoragePolicy };
    const ops = changedSlices(before, after);
    const delay = bed.answerDelayMs > 0 ? { delayMs: bed.answerDelayMs } : {};
    if (ops.length === 0) return { ...answer, ...delay };
    const revision = fake.position.revision + 1;
    const connection = bed.connection();
    const send = (): void => void connection.delta(ops, { revision });
    if (bed.order === 'delta-first') send();
    else held.push(send);
    return { ...answer, revision, ...delay };
  });

  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
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
    const stack = <Stack screenOptions={{ headerShown: false }} />;
    return (
      <AppProviders sim={liveSim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new InertSocket()}>
        {strict ? <StrictMode>{stack}</StrictMode> : stack}
      </AppProviders>
    );
  }
  const routes = {
    _layout: LiveRoot,
    index: () => <Text testID="screen-index">index</Text>,
    storage: StorageRoute,
    'network-time': NetworkTimeRoute,
  };
  (bed as { app: ReturnType<typeof renderRoutes> }).app = renderRoutes(routes, '/');
  await flushJobs();
  await bed.elapse(1_000, 250);

  // The operator signs in on the device, through the Live source.
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
    throw new Error(`live storage bed: the Live sign-in did not land (${JSON.stringify(signedIn)}; auth ${auth.status})`);
  }
  return bed;
}

/**
 * The same two route files in SIMULATED mode: a test simulator (manual clock) in place of the Live
 * source, signed in as `user`. The control group of the Live tests: the call sites settle before the
 * press returns, so nothing is ever marked busy and the copy says "simulated".
 */
export function renderSimulatedStorage({ window = 'phonePortrait', user = 'rina.wijaya', initialUrl = '/storage' }: { window?: WindowName; user?: DemoUsername; initialUrl?: LiveScreen } = {}): {
  test: TestSim;
  app: ReturnType<typeof renderRoutes>;
} {
  setWindow(window);
  const test = createTestSim();
  if (!test.sim.actions.signIn(user, DEMO_OPERATOR_PASSWORD).ok) throw new Error('live storage bed: the simulator could not sign in the operator');
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
  function SimulatedRoot() {
    return (
      <AppProviders sim={test.sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
  }
  const app = renderRoutes(
    { _layout: SimulatedRoot, index: () => <Text testID="screen-index">index</Text>, storage: StorageRoute, 'network-time': NetworkTimeRoute },
    initialUrl,
  );
  return { test, app };
}
