/**
 * Test-only bed for the Live tests of Devices & Inputs (backend task, plan row W78). Never import it
 * from app code.
 *
 * - The app's REAL Live source (`createMobileLive`) over the contract-checked fake transport
 *   (`createFakeTransport`), mounted by the real `AppProviders` around the REAL devices route files
 *   (`/devices`, `/devices/[deviceId]` and their stack), as the Simulated harness
 *   (`devices-harness.tsx`) mounts them around a test simulator.
 * - The device is paired (its credential is the fake transport's placeholder in the secure-store
 *   mock) and a demo operator signs in through the Live source's own sign-in: answer, a new socket,
 *   the snapshot of that socket (§5.2). The session the Core answers names that operator, with the
 *   permissions of the role (the Core's matrix is seeded from the shared table, [SP:AC-B-17]).
 * - The Core server's engine is a real simulator (`createTestSim`, signed in as the same operator).
 *   Each device command, diagnostics run and clip reset the app sends runs the same action there; the
 *   replicated slices it changed travel back as ONE delta whose revision the answer names (API-7,
 *   RT-5), in the order `order` says: the delta before the answer (`delta-first`) or the answer first
 *   and the delta when the test calls `sendHeldDeltas()` (`answer-first`). The Live source holds the
 *   action's continuation until the store holds that revision (CL-16), whatever the order. A refusal
 *   of the engine is answered as the Core answers it: the contract's own example of that refusal.
 *
 * Rules the fake's authors gave every client row (decision F59): connect scripts add up (one script
 * here, installed once); the fake clock is advanced in steps with the promise jobs in between
 * (`elapse`); the session read after a reconnect names the session the test signed in with. No
 * credential value is printed or stored by this file; the password is a marker that opens nothing.
 *
 * Import order: `./devices-test-setup` first, then `@/navigation/testing/router-harness`, then this
 * module.
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
  type DeviceCommand,
  type SimState,
} from '@dems/shared/sim';
import DeviceDetailRoute from '@/app/(app)/(tabs)/devices/[deviceId]';
import DevicesLayout from '@/app/(app)/(tabs)/devices/_layout';
import DevicesRoute from '@/app/(app)/(tabs)/devices/index';
import { resetMotionStateForTests } from '@/motion';
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
import type { DemoUsername } from './devices-harness';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** The contract's session of a paired device: the times and the device the bed's sessions copy. */
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The credential the device holds: the fake transport's placeholder, in the contract's shape. */
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w78'].join('-');

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

/** The device command of an operation (operations 48 and 49; the contract's table `DEVICE_COMMAND_OPERATIONS` since W83, gap 3). */
const COMMAND_OF: Readonly<Record<string, DeviceCommand>> = { restartDevice: 'RESTART', testDeviceSignal: 'TEST_SIGNAL' };

export type DeltaOrder = 'delta-first' | 'answer-first';

export interface LiveDevicesBedOptions {
  window?: WindowName;
  /** The operator who signs in on the device: `rina.wijaya` TECHNICIAN (default), `budi.santoso` INVESTIGATOR, `andi.pratama` SUPERVISOR. */
  user?: DemoUsername;
  /** The Core records (the recording scenario) before the device signs in. */
  recording?: boolean;
  /** Runs on the signed-in engine before the device signs in (a fault). */
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

export interface LiveDevicesBed {
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
  /** Runs the engine (the Core's own clock) for `ms` and pushes what changed as one unsolicited delta. */
  runCore(ms: number): Promise<void>;
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
  /** Stops the Live source and throws the first contract violation the fake recorded. */
  stop(): void;
}

/** Promise jobs settle inside `act`: the fake's answers, the connect scripts, the storage mock. */
async function flushJobs(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

/** Resets what the runtime keeps between tests. Call it in `beforeEach`, before `renderLiveDevices`. */
export async function resetLiveDevicesBed(): Promise<void> {
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
  if (error instanceof SimPermissionError && operationId === 'restartDevice') return fake.example('restartDevice', 403, 'notPermitted');
  if (error instanceof SimTransitionError && error.code === SimErrorCode.RECORDING_ACTIVE && operationId === 'restartDevice') {
    return fake.example('restartDevice', 409, 'recordingActive');
  }
  if (error instanceof SimTransitionError && error.code === SimErrorCode.COMMAND_UNSUPPORTED && operationId in COMMAND_OF) {
    return fake.example(operationId, 409, 'commandUnsupported');
  }
  throw new Error(`live devices bed: no Core answer is scripted for a refusal of ${operationId} (${error instanceof Error ? error.name : 'unknown'})`);
}

export async function renderLiveDevices({
  window = 'phonePortrait',
  user = 'rina.wijaya',
  recording = false,
  setup,
  answerDelayMs = 0,
  strict = false,
}: LiveDevicesBedOptions = {}): Promise<LiveDevicesBed> {
  setWindow(window);
  const fake = createFakeTransport({ epoch: 2, revision: 10 });
  const now = () => fake.clock.now();
  const engine = createTestSim({ start: now() });
  const operator = OPERATORS.find((candidate) => candidate.username === user);
  if (operator === undefined || !engine.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok) {
    throw new Error('live devices bed: the engine could not sign in the operator');
  }
  if (recording) engine.sim.actions.loadScenario(ScenarioName.RECORDING);
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

  const bed: LiveDevicesBed = {
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
    stop() {
      bed.mobile.stop();
      fake.assertNoViolations();
    },
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
      const ops = changedSlices(before, engine.sim.store.getState());
      const delay = bed.answerDelayMs > 0 ? { delayMs: bed.answerDelayMs } : {};
      if (ops.length === 0) return { ...answer, ...delay };
      const revision = fake.position.revision + 1;
      const connection = bed.connection();
      const send = (): void => void connection.delta(ops, { revision });
      if (bed.order === 'delta-first') send();
      else held.push(send);
      return { ...answer, revision, ...delay };
    });
  const deviceIdOf = (call: FakeHttpCall): string => {
    const id = call.params.id;
    if (typeof id !== 'string') throw new Error('live devices bed: a device command without a device ID');
    return id;
  };
  for (const operationId of Object.keys(COMMAND_OF)) {
    hosted(operationId, (call) => {
      engine.sim.actions.deviceCommand(deviceIdOf(call), COMMAND_OF[operationId]!);
      return { status: 204 };
    });
  }
  hosted('runDiagnostics', () => ({ status: 202, body: { runId: engine.sim.actions.runDiagnostics() } }));
  hosted('resetMicClip', (call) => {
    engine.sim.actions.resetClip((call.body as { channel: AudioTrackId }).channel);
    return { status: 204 };
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
    'devices/_layout': DevicesLayout,
    'devices/index': DevicesRoute,
    'devices/[deviceId]': DeviceDetailRoute,
  };
  (bed as { app: ReturnType<typeof renderRoutes> }).app = renderRoutes(routes, '/devices');
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
    throw new Error(`live devices bed: the Live sign-in did not land (${JSON.stringify(signedIn)}; auth ${auth.status})`);
  }
  return bed;
}

/** A 403 `NOT_PERMITTED` as the Core's permission guard answers it (RB-4), for an operation whose 403 examples hold none (every seeded role holds DIAGNOSTICS_RUN). */
export function notPermitted(operationId: string, permission: string, role: string): FakeAnswer {
  return refusal(403, 'NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', { operationId, permission, role });
}

