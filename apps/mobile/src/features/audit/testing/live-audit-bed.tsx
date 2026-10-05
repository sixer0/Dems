/**
 * Test-only bed for the Live tests of the Operator Audit view (backend task, plan row W80). Never
 * import it from app code.
 *
 * - The app's REAL Live source (`createMobileLive`) over the contract-checked fake transport
 *   (`createFakeTransport`), mounted by the real `AppProviders` around the REAL `/audit` route file,
 *   as the Simulated harness (`audit-harness.tsx`) mounts it around a test simulator.
 * - The device is paired (its credential is the fake transport's placeholder in the secure-store
 *   mock) and a demo operator signs in through the Live source's own sign-in: answer, a new socket,
 *   the snapshot of that socket (§5.2). The session names that operator with the permissions of the
 *   role (the Core's matrix is seeded from the shared table, [SP:AC-B-17]).
 * - The Core server's engine is a real simulator (`createTestSim`, signed in as the same operator):
 *   the snapshot is its replicated state (the audit ring with its hashes, the operators, the
 *   faults), and `onEngine` runs something on it and sends what changed as ONE unsolicited delta,
 *   as the Core publishes its own rows.
 * - Operation 60 `verifyAuditChain` is answered as the Core server answers it
 *   (implementation/39 §6, §12): `view` is the engine's own check of the ring it holds; `stored` is
 *   the check of the table (by default verified through the engine's newest row, and never broken
 *   by the demo fault AUDIT_TAMPER); `lineage` and `lineageTotal` are what `lineage` holds.
 *
 * Rules the fake's authors gave every client row (decision F59): connect scripts add up (one script
 * here, installed once); the fake clock is advanced in steps with the promise jobs in between
 * (`elapse`); the session read after a reconnect names the session the test signed in with. No
 * credential value is printed or stored by this file; the passwords are markers that open nothing.
 *
 * Import order: `./audit-test-setup` first, then `@/navigation/testing/router-harness`, then this
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
  type AuditChainLineageEntry,
  type AuditChainStatus,
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
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ROLE_PERMISSIONS, type SimState } from '@dems/shared/sim';
import AuditRoute from '@/app/(app)/(tabs)/audit';
import { resetMotionStateForTests } from '@/motion';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { createMobileLive, resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests, type MobileLive } from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { createTestSim, type TestSim } from '@/runtime/testing/test-sim';
import { resetPlayedEntrancesForTests } from '../audit-row';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** The contract's session of a paired device (AKP Budi Santoso, INVESTIGATOR); the bed names its own operator in it. */
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The credential the device holds: the fake transport's placeholder, in the contract's shape. */
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** Markers, not credentials of anything. */
export const MARKER_PASSWORD = ['MARKER', 'PW', 'w80'].join('-');

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

/** The replicated slices that changed between two states of the engine, as `replace` ops. */
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

export type DemoUsername = 'budi.santoso' | 'andi.pratama' | 'rina.wijaya';

export interface LiveAuditBedOptions {
  window?: WindowName;
  user?: DemoUsername;
  /** Runs on the engine BEFORE its operator signs in (failed sign-ins: rows the Core holds before the device connects). */
  beforeSignIn?: (engine: TestSim) => void;
  /** Runs on the signed-in engine before the device connects (a fault, a device command). */
  setup?: (engine: TestSim) => void;
  /** Render the app under React's `StrictMode`, as a development build does (decision D158, finding F69-1). */
  strict?: boolean;
}

export interface LiveAuditBed {
  readonly fake: FakeTransport;
  /** The Core server's engine. */
  readonly engine: TestSim;
  readonly mobile: MobileLive;
  readonly app: ReturnType<typeof renderRoutes>;
  /** The operator who signed in on the device. */
  readonly operatorId: string;
  /** `stored` of operation 60; by default verified through the engine's newest row. */
  stored: () => AuditChainStatus['stored'];
  /** `lineage` of operation 60, newest first (`lineageTotal` is its length unless `lineageTotal` is set). */
  lineage: AuditChainLineageEntry[];
  lineageTotal: number | null;
  /** The answer operation 60 gives now. */
  chainAnswer(): FakeAnswer;
  /** Runs `run` on the engine and publishes what changed as one delta (the Core's own rows). */
  onEngine(run: (engine: TestSim) => void): Promise<void>;
  /** The Core stops answering (requests fail, the socket drops, reconnects are refused), or answers again. */
  setReachable(reachable: boolean): void;
  /** Moves the fake clock in steps, with the promise jobs in between. */
  elapse(ms: number, step?: number): Promise<void>;
  flush(turns?: number): Promise<void>;
  /** Lets one animation frame pass (the Verify press calls the action one frame after the Spinner shows). */
  nextFrame(): Promise<void>;
  navigate(href: string): Promise<void>;
  requests(operationId: string): readonly FakeHttpCall[];
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

/** Resets what the runtime keeps between tests. Call it in `beforeEach`, before `renderLiveAudit`. */
export async function resetLiveAuditBed(): Promise<void> {
  await AsyncStorage.clear();
  resetShellState();
  resetPlayedEntrancesForTests();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests();
  globalThis.__DEMS_SECURE_STORE_MOCK__.reset();
}

export async function renderLiveAudit({ window = 'phonePortrait', user = 'budi.santoso', beforeSignIn, setup, strict = false }: LiveAuditBedOptions = {}): Promise<LiveAuditBed> {
  setWindow(window);
  const fake = createFakeTransport({ epoch: 2, revision: 10 });
  const now = () => fake.clock.now();
  const engine = createTestSim({ start: now() });
  const operator = OPERATORS.find((candidate) => candidate.username === user);
  if (operator === undefined) throw new Error(`live audit bed: unknown demo user ${user}`);
  beforeSignIn?.(engine);
  if (!engine.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok) {
    throw new Error(`live audit bed: the engine could not sign in ${user}`);
  }
  setup?.(engine);

  let reachable = true;
  let session: { token: string; info: AuthSessionInfo } | null = null;
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
      demoControls: false,
      serverTime: now(),
    };
    session = { token: FAKE_CREDENTIALS.sessionToken, info };
    return { status: 200, body: { session: info, sessionToken: FAKE_CREDENTIALS.sessionToken } };
  });
  answered('signOut', () => ({ status: 204 }));
  answered('touchSession', () => fake.example('touchSession'));

  const bed: LiveAuditBed = {
    fake,
    engine,
    mobile: undefined as unknown as MobileLive,
    app: undefined as unknown as ReturnType<typeof renderRoutes>,
    operatorId: operator.id,
    stored: () => {
      const audit = engine.sim.store.getState().audit;
      return { ok: true, checked: audit.total, head: audit.head, firstBadSeq: null };
    },
    lineage: [],
    lineageTotal: null,
    chainAnswer() {
      const body: AuditChainStatus = {
        view: engine.sim.actions.verifyAuditChain(),
        stored: bed.stored(),
        lineage: bed.lineage,
        lineageTotal: bed.lineageTotal ?? bed.lineage.length,
      };
      return { status: 200, body: JSON.parse(JSON.stringify(body)) as unknown };
    },
    async onEngine(run) {
      const before = engine.sim.store.getState();
      run(engine);
      const ops = changedSlices(before, engine.sim.store.getState());
      if (ops.length > 0) await act(async () => void bed.connection().delta(ops));
      await flushJobs();
    },
    setReachable(next) {
      reachable = next;
      if (!next) act(() => void bed.connection().drop());
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
    async nextFrame() {
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      });
      await flushJobs();
    },
    async navigate(href) {
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

  answered('verifyAuditChain', () => bed.chainAnswer());

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
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    return strict ? <StrictMode>{app}</StrictMode> : app;
  }
  const routes = {
    _layout: LiveRoot,
    index: () => <Text testID="screen-index">index</Text>,
    audit: AuditRoute,
  };
  (bed as { app: ReturnType<typeof renderRoutes> }).app = renderRoutes(routes, '/');
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
    throw new Error(`live audit bed: the Live sign-in did not land (${JSON.stringify(signedIn)}; auth ${auth.status})`);
  }
  await bed.navigate('/audit');
  return bed;
}
