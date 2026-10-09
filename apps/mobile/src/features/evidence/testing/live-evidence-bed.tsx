/**
 * Test-only bed for the Live tests of Evidence (backend task, plan row W74). Never import it from
 * app code.
 *
 * - The app's REAL Live source (`createMobileLive`) over the contract-checked fake transport
 *   (`createFakeTransport`), mounted by the real `AppProviders` around the REAL evidence route files
 *   (`/evidence` and `/evidence/[evidenceId]` with their drill-in stack), as the Simulated harness
 *   (`evidence-harness.tsx`) mounts them around a test simulator.
 * - The device is paired (its credential is the fake transport's placeholder in the secure-store
 *   mock) and the operator signs in through the Live source's own sign-in: answer, a new socket, the
 *   snapshot of that socket (§5.2). `role: 'investigator'` is the contract's paired-device session
 *   (AKP Budi Santoso, no EVIDENCE_EXPORT, no EVIDENCE_REVIEW); `role: 'supervisor'` is the same
 *   device session for the contract's SUPERVISOR (both permissions).
 * - The Core server's engine is a real simulator (`createTestSim`, signed in as the same operator).
 *   Each evidence command the app sends runs the same action there; the replicated slices it changed
 *   travel back as ONE delta whose revision the answer names (API-7), before the answer. The Live
 *   source holds the action's continuation until the store holds that revision (CL-16).
 *   A refusal of the engine is the Core's refusal, named by the contract's own example
 *   (`archiveEvidence` 403 `notPermitted`, `exportEvidence` 403 `forbidden`, 422 `invalidReason`).
 * - Operation 40 answers the item from the engine and the media reference `mediaRef(id)` gives
 *   (default: `DEMO_PACKAGE` with the item's own suffix).
 *
 * **The guard order of operation 42** (RESIDUAL-W74-1, W83 ledger #49). The export wizard's probe for a role
 * without EVIDENCE_EXPORT (site S1-5) sends an empty reason on purpose: a role whose permission the
 * tablet's hint has not caught up with then gets the Core's `422`, never an export (F59). The Core
 * server reads the role BEFORE the body and answers a denied role 403 with one `EXPORT_DENIED` row
 * whatever the body (implementation/35 §6.2: "a short reason … the same 403"). The contract's
 * `EvidenceExportRequest` cannot say "after the guard", so the fake would refuse that body. This bed
 * therefore checks requests against the registry's schemas with ONE addition: operation 42 also
 * accepts exactly `{ reason: '', destination: '' }`, the probe's body, and answers it as the Core does
 * (403 for a denied role, 422 otherwise). Every other request is checked as the registry says.
 *
 * Rules the fake's authors gave every client row (decision F59): connect scripts add up (one script
 * here, installed once); the fake clock is advanced in steps with the promise jobs in between
 * (`elapse`). No credential value is printed or stored by this file; the password is a marker that
 * opens nothing.
 *
 * Import order: `./evidence-test-setup` first, then `@/navigation/testing/router-harness`, then this
 * module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack, router, type Href } from 'expo-router';
import { StrictMode } from 'react';
import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { z } from 'zod';
import {
  CORE_API_EXAMPLES,
  CORE_API_SCHEMAS,
  REPLICATED_SLICE_NAMES,
  pickReplicatedState,
  type AuthSessionInfo,
  type DeltaMessage,
  type EvidenceMediaRef,
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
import { DEMO_OPERATOR_PASSWORD, OPERATORS, type ExportRequest, type SimState } from '@dems/shared/sim';
import EvidenceDetailRoute from '@/app/(app)/(tabs)/evidence/[evidenceId]';
import EvidenceLayout from '@/app/(app)/(tabs)/evidence/_layout';
import EvidenceListRoute from '@/app/(app)/(tabs)/evidence/index';
import { resetMotionStateForTests } from '@/motion';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { createMobileLive, resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests, type MobileLive } from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { createTestSim, type TestSim } from '@/runtime/testing/test-sim';
import { resetDetailIntentForTests } from '../detail-intent';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** The contract's session of a paired device: AKP Budi Santoso, INVESTIGATOR. */
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The contract's SUPERVISOR session (its operator and permission list; the bed binds it to the device). */
const SUPERVISOR_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.webConsole?.value as AuthSessionInfo;
/** The credential the device holds: the fake transport's placeholder, in the contract's shape. */
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w74'].join('-');

/** RESIDUAL-W74-1 (see the header): the registry's schemas, plus the probe's empty body for operation 42. */
const PROBE_BODY = z.strictObject({ reason: z.literal(''), destination: z.literal('') });
const GUARD_ORDER_SCHEMAS = { ...CORE_API_SCHEMAS, EvidenceExportRequest: z.union([CORE_API_SCHEMAS.EvidenceExportRequest, PROBE_BODY]) };

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

export type LiveEvidenceRole = 'investigator' | 'supervisor';

export interface LiveEvidenceBedOptions {
  window?: WindowName;
  role?: LiveEvidenceRole;
  /** Runs on the signed-in engine before the device signs in (a fault, a status). */
  setup?: (engine: TestSim) => void;
  initialUrl?: string;
  /**
   * Render the app under React's `StrictMode`, as a development build does (decision D158, finding
   * F69-1: a command started from a mount effect would run twice there).
   */
  strict?: boolean;
}

export interface LiveEvidenceBed {
  readonly fake: FakeTransport;
  /** The Core server's engine. */
  readonly engine: TestSim;
  readonly mobile: MobileLive;
  readonly app: ReturnType<typeof renderRoutes>;
  /** Every evidence command's answer is delivered this much later on the fake clock (the delta goes first). */
  answerDelayMs: number;
  /** The media reference operation 40 answers for an item (default: `DEMO_PACKAGE`, the item's own suffix). */
  mediaRef: (evidenceId: string) => EvidenceMediaRef;
  /** The Core stops answering (requests fail, the socket drops, reconnects are refused), or answers again. */
  setReachable(reachable: boolean): void;
  /** Moves the fake clock in steps, with the promise jobs in between. */
  elapse(ms: number, step?: number): Promise<void>;
  flush(turns?: number): Promise<void>;
  navigate(href: string): Promise<void>;
  /** The evidence ID with a given number suffix (`'0005'` → `EV-…-0005`). */
  idOf(suffix: string): string;
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

/** Resets what the runtime keeps between tests. Call it in `beforeEach`, before `renderLiveEvidence`. */
export async function resetLiveEvidenceBed(): Promise<void> {
  await AsyncStorage.clear();
  resetShellState();
  resetDetailIntentForTests();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  // Full motion, as the Simulated harness runs: the paced states (LB-2) keep their minimum times.
  resetMotionStateForTests();
  globalThis.__DEMS_SECURE_STORE_MOCK__.reset();
}

export async function renderLiveEvidence({
  window = 'phonePortrait',
  role = 'supervisor',
  setup,
  initialUrl = '/evidence',
  strict = false,
}: LiveEvidenceBedOptions = {}): Promise<LiveEvidenceBed> {
  setWindow(window);
  const fake = createFakeTransport({ epoch: 2, revision: 10, schemas: GUARD_ORDER_SCHEMAS });
  const now = () => fake.clock.now();
  const engine = createTestSim({ start: now() });
  const template = role === 'supervisor' ? SUPERVISOR_SESSION : DEVICE_SESSION;
  const operator = OPERATORS.find((candidate) => candidate.id === template.operator.id);
  if (operator === undefined || !engine.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok) {
    throw new Error(`live evidence bed: the engine could not sign in the ${role}`);
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
      operator: template.operator,
      permissions: template.permissions,
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

  const bed: LiveEvidenceBed = {
    fake,
    engine,
    mobile: undefined as unknown as MobileLive,
    app: undefined as unknown as ReturnType<typeof renderRoutes>,
    answerDelayMs: 0,
    mediaRef: (evidenceId) => ({ source: 'DEMO_PACKAGE', packageSuffix: evidenceId.slice(-4) }),
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
    async navigate(href) {
      act(() => router.push(href as Href));
      await flushJobs();
    },
    idOf(suffix) {
      const item = engine.sim.store.getState().evidence.find((entry) => entry.id.endsWith(`-${suffix}`));
      if (!item) throw new Error(`live evidence bed: no evidence ${suffix}`);
      return item.id;
    },
    requests: (operationId) => fake.log.requestsOf(operationId),
    connection: () => fake.connection(),
    state: () => bed.mobile.sim.store.getState(),
    stop() {
      bed.mobile.stop();
      fake.assertNoViolations();
    },
  };

  /** What the engine changed, as one delta: before the answer that names its revision, or unsolicited. */
  const sendChanges = (before: SimState, solicited: boolean): number | null => {
    const ops = changedSlices(before, engine.sim.store.getState());
    if (ops.length === 0) return null;
    const revision = fake.position.revision + 1;
    if (solicited) void bed.connection().delta(ops, { revision });
    else void bed.connection().delta(ops);
    return revision;
  };
  /** One hosted evidence command: the engine runs it; a 2xx answer names the revision of the delta that holds what changed. */
  const hosted = (operationId: string, run: (call: FakeHttpCall) => FakeAnswer): void =>
    answered(operationId, (call) => {
      const before = engine.sim.store.getState();
      const answer = run(call);
      if (answer.status >= 300) {
        // A refusal the engine audited (a denied export) reaches the replica as the Core's next delta.
        sendChanges(before, false);
        return answer;
      }
      const revision = sendChanges(before, true);
      if (revision === null) throw new Error(`live evidence bed: ${operationId} changed no replicated slice`);
      return { ...answer, revision, ...(bed.answerDelayMs > 0 ? { delayMs: bed.answerDelayMs } : {}) };
    });
  const idParam = (call: FakeHttpCall): string => String(call.params.id);

  hosted('verifyEvidence', (call) => ({ status: 200, body: engine.sim.actions.verify(idParam(call)) }));
  hosted('archiveEvidence', (call) => {
    try {
      engine.sim.actions.archiveEvidence(idParam(call));
    } catch {
      return fake.example('archiveEvidence', 403, 'notPermitted');
    }
    return { status: 204 };
  });
  hosted('exportEvidence', (call) => {
    const id = idParam(call);
    const result = engine.sim.actions.exportEvidence(id, call.body as ExportRequest);
    // op-42's 202 body is `{ exportId, evidenceId, status: 'QUEUED' }` since SH-15 (row 48): the export
    // is accepted as a queued job; the evidence ITEM's own lifecycle status (still EXPORTED) is separate.
    if (result.ok) return { status: 202, body: { exportId: result.exportId, evidenceId: id, status: 'QUEUED' } };
    if (result.status === 403) return fake.example('exportEvidence', 403, 'forbidden');
    if (result.status === 422) return fake.example('exportEvidence', 422, 'invalidReason');
    if (result.status === 409) return fake.example('exportEvidence', 409, 'notSealed');
    return fake.example('exportEvidence', 404, 'notFound');
  });
  answered('getEvidence', (call) => {
    const id = idParam(call);
    const item = engine.sim.store.getState().evidence.find((entry) => entry.id === id);
    if (!item) return fake.example('getEvidence', 404, 'notFound');
    return { status: 200, body: { evidence: JSON.parse(JSON.stringify(item)) as unknown, media: bed.mediaRef(id) } };
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
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    return strict ? <StrictMode>{app}</StrictMode> : app;
  }
  const routes = {
    _layout: LiveRoot,
    index: () => <Text testID="screen-index">index</Text>,
    'evidence/_layout': EvidenceLayout,
    'evidence/index': EvidenceListRoute,
    'evidence/[evidenceId]': EvidenceDetailRoute,
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
    throw new Error(`live evidence bed: the Live sign-in did not land (${JSON.stringify(signedIn)}; auth ${auth.status})`);
  }
  await bed.navigate(initialUrl);
  return bed;
}
