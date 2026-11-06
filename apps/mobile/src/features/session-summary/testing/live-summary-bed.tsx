/**
 * Test-only bed for the Live tests of Finalization, the Session Summary and the Sessions hub (backend
 * task, plan row W72). Never import it from app code.
 *
 * - The app's REAL Live source (`createMobileLive`) over the contract-checked fake transport
 *   (`createFakeTransport`), mounted by the real `AppProviders` (with the runtime's real
 *   `SessionRouteSync`, as `(app)/_layout.tsx` mounts it) around the REAL route files of
 *   `/session/finalizing`, `/session/summary/[sessionId]`, `/sessions` and `/sessions/[sessionId]`.
 *   Home, Start Session, Recovery and the Evidence detail are one-line stand-ins; `/session/live` is a
 *   stand-in with the live route's own policy (anything but RECORDING is sent to its §3.7 target), so
 *   a stop seen there moves to Finalization as on a device.
 * - The device is paired (its credential is the fake transport's placeholder in the secure-store
 *   mock) and the investigator signs in through the Live source's own sign-in (§5.2): an answer, a new
 *   socket, that socket's snapshot.
 * - The Core server's engine is a real simulator (`createTestSim`, signed in as the same
 *   investigator) whose clock is kept equal to the fake transport's clock, so the Core's instants and
 *   the Live clock agree. `elapse(ms)` lets time pass on the Core: both clocks move and the replicated
 *   slices that changed travel to the app as one delta per step, as the Core pushes them.
 *   `coreDo(run)` runs one engine action that another client sent (the monitor's stop, another
 *   console's acknowledgement) and pushes what changed. The app's own acknowledgement (operation 37)
 *   runs the same action on the engine; a 204 that changed something names the revision of its delta
 *   (API-7, RT-5), a repeat or another ID changes nothing and names none (the contract, `api/sessions.ts`).
 * - `strict` renders the app under React's `StrictMode`, as a development build does (decision D158,
 *   finding F69-1: a command started from a mount effect would run twice there).
 *
 * Rules the fake's authors gave every client row (decision F59): connect scripts add up (one script
 * here, installed once); the fake clock is advanced in steps with the promise jobs in between. No
 * credential value is printed or stored by this file; the password is a marker that opens nothing.
 *
 * Import order: `@/features/sessions/testing/sessions-test-setup` first (the sheet and list mocks),
 * then `@/navigation/testing/router-harness`, then this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Redirect, Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { StrictMode } from 'react';
import { act, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
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
  type FakeAnswer,
  type FakeConnection,
  type FakeHttpCall,
  type FakeReply,
  type FakeTransport,
} from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, PRECHECK_TOTAL_MAX_MS, type SessionCreateInput, type SimState } from '@dems/shared/sim';
import SessionDetailRoute from '@/app/(app)/(tabs)/sessions/[sessionId]';
import SessionsLayout from '@/app/(app)/(tabs)/sessions/_layout';
import SessionsRoute from '@/app/(app)/(tabs)/sessions/index';
import SessionFinalizingRoute from '@/app/(app)/session/finalizing';
import SessionSummaryRoute from '@/app/(app)/session/summary/[sessionId]';
import { resetMotionStateForTests } from '@/motion';
import { useSessionLiveRedirect } from '@/navigation';
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
import { resetStampedForTests } from '../stamp-once';

export type { WindowName };

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** The contract's session of a paired device: AKP Budi Santoso, INVESTIGATOR, `SESSION_START` among the permissions. */
export const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The credential the device holds: the fake transport's placeholder, in the contract's shape. */
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w72'].join('-');

/**
 * Details of a session that exists on the Core only: none of these values is in the bundled demo
 * dataset, so a screen that shows them read the Core's replicated state.
 */
export const CORE_ONLY_INPUT: Omit<SessionCreateInput, 'investigatorId'> = {
  caseNumber: 'LP/2026/1006-0472',
  subjectType: 'SAKSI',
  subjectName: 'Wahyu Core Pratama',
  room: 'Interview Room 2',
  profileId: 'STANDARD_1080P25',
};

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

function stub(id: string) {
  return function StubScreen() {
    const params = useLocalSearchParams();
    return <Text testID={`stub-${id}`}>{JSON.stringify(params)}</Text>;
  };
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

// ── The Core's engine, before the device signs in ───────────────────────────────────────────

/** Creates a session with the Core-only details and records it for `recordMs` (RECORDING at the end). Returns its ID. */
export function recordCoreSession(engine: TestSim, recordMs = 12_000, input: Omit<SessionCreateInput, 'investigatorId'> = CORE_ONLY_INPUT): string {
  const result = engine.sim.actions.createSession({ ...input, investigatorId: DEVICE_SESSION.operator.id });
  if (!result.ok) throw new Error(`live summary bed: the engine refused the create (${result.reason})`);
  engine.sim.actions.beginPrecheck();
  engine.advance(PRECHECK_TOTAL_MAX_MS + 200);
  if (engine.sim.store.getState().session?.state === 'PRECHECK') engine.sim.actions.acknowledgePrecheckWarnings();
  engine.sim.actions.startRecording();
  if (engine.sim.store.getState().session?.state !== 'RECORDING') throw new Error('live summary bed: the engine did not reach RECORDING');
  engine.advance(recordMs);
  return result.sessionId;
}

/** Runs the engine until its current session is SEALED (or `limitMs` passes). */
export function runEngineUntilSealed(engine: TestSim, limitMs = 15_000): void {
  for (let left = limitMs; left > 0 && engine.sim.store.getState().session?.state !== 'SEALED'; left -= 100) engine.advance(100);
}

/** A session recorded, stopped and sealed on the Core; its summary waits for the acknowledgement. Returns its ID. */
export function sealCoreSession(engine: TestSim, recordMs = 12_000, input: Omit<SessionCreateInput, 'investigatorId'> = CORE_ONLY_INPUT): string {
  const id = recordCoreSession(engine, recordMs, input);
  engine.sim.actions.stopRecording('Interview completed');
  runEngineUntilSealed(engine);
  if (engine.sim.store.getState().session?.state !== 'SEALED') throw new Error('live summary bed: the engine did not seal the session');
  return id;
}

// ── The bed ──────────────────────────────────────────────────────────────────────────────────

export interface LiveSummaryBedOptions {
  window?: WindowName;
  /** Builds the Core's state on the signed-in engine before the device signs in (a session, a seal). */
  setup?: (engine: TestSim) => void;
  /** The route the app opens on (default `/home`); the sign-in happens there. */
  initialUrl?: string;
  /** Every acknowledgement's answer is delivered this much later on the fake clock (AC-C-57). */
  answerDelayMs?: number;
  /** Render the app under `StrictMode` (decision D158). */
  strict?: boolean;
}

export interface LiveSummaryBed {
  readonly fake: FakeTransport;
  /** The Core server's engine. */
  readonly engine: TestSim;
  readonly mobile: MobileLive;
  readonly app: ReturnType<typeof renderRoutes>;
  answerDelayMs: number;
  /** Time passes on the Core: both clocks move in steps and what changed is pushed after each step. */
  elapse(ms: number, step?: number): Promise<void>;
  /** Runs one engine action another client sent and pushes what changed as one unsolicited delta. */
  coreDo(run: (engine: TestSim) => void): Promise<void>;
  /** The Core stops answering (requests fail, the socket drops, reconnects are refused), or answers again. */
  setReachable(reachable: boolean): void;
  flush(turns?: number): Promise<void>;
  navigate(href: string): Promise<void>;
  requests(operationId: string): readonly FakeHttpCall[];
  /** Every request after the sign-in that is not a session housekeeping read or touch. */
  commandsSinceSignIn(): readonly string[];
  connection(): FakeConnection;
  /** The app's store (the Live source's replica). */
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

/** Resets what the runtime keeps between tests. Call it in `beforeEach`, before `renderLiveSummary`. */
export async function resetLiveSummaryBed(): Promise<void> {
  await AsyncStorage.clear();
  resetShellState();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  resetStampedForTests();
  globalThis.__DEMS_SECURE_STORE_MOCK__.reset();
}

/** Reads that every signed-in client makes on its own; not commands. */
const HOUSEKEEPING = new Set(['getAuthSession', 'getSignInStatus', 'getDeviceRegistration', 'touchSession', 'signIn', 'getServiceHealth']);

export async function renderLiveSummary({ window = 'phonePortrait', setup, initialUrl = '/home', answerDelayMs = 0, strict = false }: LiveSummaryBedOptions = {}): Promise<LiveSummaryBed> {
  setWindow(window);
  const fake = createFakeTransport({ epoch: 2, revision: 10 });
  const now = () => fake.clock.now();
  const engine = createTestSim({ start: now() });
  const investigator = OPERATORS.find((operator) => operator.id === DEVICE_SESSION.operator.id);
  if (investigator === undefined || !engine.sim.actions.signIn(investigator.username, DEMO_OPERATOR_PASSWORD).ok) {
    throw new Error('live summary bed: the engine could not sign in the investigator');
  }
  setup?.(engine);
  // The Core's clock and the Live clock agree: the fake clock catches up with the engine's set-up time.
  const drift = engine.sim.store.getState().clock.now - fake.clock.now();
  if (drift > 0) fake.clock.advance(drift);

  let reachable = true;
  let session: { token: string; info: AuthSessionInfo } | null = null;
  let signInIndex = Number.POSITIVE_INFINITY;
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

  /** The signed-in socket, if it is open: only an OPERATOR connection gets the `state` topic. */
  const operatorConnection = (): FakeConnection | null => {
    if (fake.connections.length === 0) return null;
    const connection = fake.connection();
    return connection.principal === 'OPERATOR' && connection.state === 'OPEN' ? connection : null;
  };
  const push = (ops: DeltaMessage['ops']): void => {
    const connection = reachable ? operatorConnection() : null;
    if (ops.length > 0 && connection !== null) act(() => void connection.delta(ops));
  };

  const bed: LiveSummaryBed = {
    fake,
    engine,
    mobile: undefined as unknown as MobileLive,
    app: undefined as unknown as ReturnType<typeof renderRoutes>,
    answerDelayMs,
    async elapse(ms, step = 250) {
      for (let done = 0; done < ms; done += step) {
        const slice = Math.min(step, ms - done);
        const before = engine.sim.store.getState();
        act(() => {
          engine.advance(slice);
          fake.clock.advance(slice);
        });
        push(changedSlices(before, engine.sim.store.getState()));
        await flushJobs(20);
      }
    },
    async coreDo(run) {
      const before = engine.sim.store.getState();
      run(engine);
      push(changedSlices(before, engine.sim.store.getState()));
      await flushJobs();
    },
    setReachable(next) {
      const wasUp = reachable;
      reachable = next;
      if (!next && wasUp) act(() => void fake.connection().drop());
    },
    flush: flushJobs,
    async navigate(href) {
      act(() => router.push(href as Href));
      await flushJobs();
    },
    requests: (operationId) => fake.log.requestsOf(operationId),
    commandsSinceSignIn: () =>
      fake.log
        .operationIds()
        .slice(signInIndex)
        .filter((id) => !HOUSEKEEPING.has(id)),
    connection: () => fake.connection(),
    state: () => bed.mobile.sim.store.getState(),
    stop() {
      bed.mobile.stop();
      fake.assertNoViolations();
    },
  };

  // Operation 37 as the Core does it: the engine's own action; a change travels as one delta whose
  // revision the 204 names, a repeat or another ID answers 204 and changes nothing.
  answered('acknowledgeSessionSummary', (call) => {
    const before = engine.sim.store.getState();
    engine.sim.actions.acknowledgeSummary(String(call.params.id));
    const ops = changedSlices(before, engine.sim.store.getState());
    const delay = bed.answerDelayMs > 0 ? { delayMs: bed.answerDelayMs } : {};
    const connection = operatorConnection();
    if (ops.length === 0 || connection === null) return { status: 204, ...delay } satisfies FakeAnswer;
    const revision = fake.position.revision + 1;
    void connection.delta(ops, { revision });
    return { status: 204, revision, ...delay } satisfies FakeAnswer;
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
    'session/new': stub('session-new'),
    'session/live': LiveStandIn,
    'session/recovery': stub('session-recovery'),
    'session/finalizing': SessionFinalizingRoute,
    'session/summary/[sessionId]': SessionSummaryRoute,
    'sessions/_layout': SessionsLayout,
    'sessions/index': SessionsRoute,
    'sessions/[sessionId]': SessionDetailRoute,
    'evidence/index': stub('evidence'),
    'evidence/[evidenceId]': stub('evidence-detail'),
  };
  (bed as { app: ReturnType<typeof renderRoutes> }).app = renderRoutes(routes, initialUrl);
  await flushJobs();
  await bed.elapse(1_000);

  // The investigator signs in on the device, through the Live source (§5.2).
  signInIndex = fake.log.operationIds().length;
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
  await bed.elapse(1_000);
  const auth = created.sim.store.getState().auth;
  if (auth.status !== 'SIGNED_IN' || auth.operatorId !== investigator.id) {
    throw new Error(`live summary bed: the Live sign-in did not land (${JSON.stringify(signedIn)}; auth ${auth.status})`);
  }
  return bed;
}

/** Every text and accessibility string rendered under `testID` (labels, hints, placeholders included). */
export function wordsUnder(testID: string): string[] {
  const words: string[] = [];
  const walk = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') {
      words.push(node);
      return;
    }
    for (const key of ['accessibilityLabel', 'accessibilityHint', 'aria-label', 'placeholder'] as const) {
      const value: unknown = node.props?.[key];
      if (typeof value === 'string') words.push(value);
    }
    node.children.forEach(walk);
  };
  walk(screen.getByTestId(testID));
  return words;
}

/** Copy that would claim a simulation ([CS:§3.2], mobile rule 8: a screen showing server data says nothing about one). */
export const SIMULATION_WORDING = /simulat|mock-core/i;
