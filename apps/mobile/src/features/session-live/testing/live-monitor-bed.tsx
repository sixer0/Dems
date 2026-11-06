/**
 * Test-only bed for the Live tests of the Session Monitor (backend task, plan row W68). Never import
 * it from app code.
 *
 * - The app's REAL Live source (`createMobileLive`) over the contract-checked fake transport
 *   (`createFakeTransport`), mounted by the real `AppProviders` around the REAL `/session/live`
 *   route file, as the Simulated harness (`monitor-harness.tsx`) mounts it around a test simulator.
 * - The device is paired (its credential is the fake transport's placeholder in the secure-store
 *   mock) and the investigator signs in through the Live source's own sign-in: answer, a new socket,
 *   the snapshot of that socket (§5.2). The snapshot holds the recording scenario (session 0024,
 *   RECORDING), so `openMonitor()` lands on the monitor as the start-recording hand-off does.
 * - The Core server's engine is a real simulator (`createTestSim`, signed in as the same
 *   investigator). Each session command the app sends runs the same action there; the replicated
 *   slices it changed travel back as ONE delta whose revision the answer names (API-7, RT-5): the
 *   delta first, or the answer first and the delta when the test calls `sendHeldDeltas()`. The Live
 *   source holds the command's continuation until the store holds that revision (CL-16).
 * - The meters are the socket's own `meters` frames (`sendMeters`), never a request (CL-11b, I8).
 * - Task 3 M5 (row 73; register MB-13): the microphones. `sendMeters` names the engine's active input
 *   (it named `MIC-01` always), and `raiseMicSilent()` / `clearMicSilent()` are the warning raiser's
 *   two internal actions on the engine. Audit row 185 (M3-05; D136): operation 81 `switchAudioSource`
 *   is RETIRED - the bed answers every call `409 AUDIO_SOURCE_FIXED_BY_PAIRING`, as the Core does, and
 *   the tablet is expected to send none (`requests('switchAudioSource')` stays empty).
 *
 * Rules the fake's authors gave every client row (decision F59): connect scripts add up (one script
 * here, installed once); the fake clock is advanced in steps with the promise jobs in between
 * (`elapse`). No credential value is printed or stored by this file; the password is a marker that
 * opens nothing.
 *
 * Import order: `./monitor-test-setup` first, then `@/navigation/testing/router-harness`, then this
 * module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profiler, StrictMode, type ProfilerOnRenderCallback, type ReactNode } from 'react';
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
import type { AudioTrackId, MicInputId, VideoTrackId } from '@dems/shared/domain';
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
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName, SimErrorCode, SimTransitionError, type AudioFrame, type SimState } from '@dems/shared/sim';
import SessionLiveRoute from '@/app/(app)/session/live';
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

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
/** The contract's session of a paired device: AKP Budi Santoso, INVESTIGATOR, `SESSION_START` and `SESSION_NOTE` among the permissions. */
export const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The credential the device holds: the fake transport's placeholder, in the contract's shape. */
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w68'].join('-');

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

/** One audio frame as the Core server's engine publishes it. */
export function meterFrame(dbfs: number, at: number, seq: number, overrides: Partial<AudioFrame> = {}): AudioFrame {
  return { seq, at, dbfs, peak: Math.min(0, dbfs + 4), clip: false, noSignal: false, ...overrides };
}

export interface LiveMonitorBedOptions {
  window?: WindowName;
  /** Runs on the signed-in engine after the recording scenario is loaded, before the device signs in. */
  setup?: (engine: TestSim) => void;
  /** Delivers every command's answer this much later on the fake clock (AC-C-57). */
  answerDelayMs?: number;
  /** Wraps the providers in React StrictMode, as a development build renders them (D158, F69-1). */
  strict?: boolean;
  /** Wraps the tree in a React Profiler (render counting). */
  onRender?: ProfilerOnRenderCallback;
}

export interface LiveMonitorBed {
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
  /** Another console changes the Core (for example another operator stops the session): the engine runs `change`, the delta follows. */
  changeOnCore(change: (engine: TestSim) => void): Promise<void>;
  /** One `meters` frame on the signed-in socket (both channels); it names the engine's active input. */
  /** D61 (2026-11-04): the plane holds four channels; this bed's socket lane drives the two interview mics, so the map may name a subset. */
  sendMeters(frames: Readonly<Partial<Record<AudioTrackId, AudioFrame>>>): void;
  /** The Core's warning raiser reports `MIC_SILENT` for `inputId` (it never switches, OD-11); the delta follows. */
  raiseMicSilent(inputId: MicInputId): Promise<void>;
  /** The condition is over: the warning is cleared on the Core; the delta follows. */
  clearMicSilent(inputId: MicInputId): Promise<void>;
  /**
   * The Core stops answering (requests fail, the socket drops, reconnects are refused), or answers
   * again. `'hanging'`: requests fail and a reconnect attempt is left CONNECTING (no answer at all).
   * `drop: false` leaves the open socket alone (the next connect is the one that hangs).
   */
  setReachable(reachable: boolean | 'hanging', options?: { drop?: boolean }): void;
  /** Moves the fake clock in steps, with the promise jobs in between. */
  elapse(ms: number, step?: number): Promise<void>;
  flush(turns?: number): Promise<void>;
  /** Pushes `/session/live` over Home, as the start-recording hand-off and the Home banner do. */
  openMonitor(): Promise<void>;
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

/** Resets what the runtime keeps between tests. Call it in `beforeEach`, before `renderLiveMonitor`. */
export async function resetLiveMonitorBed(): Promise<void> {
  await AsyncStorage.clear();
  resetShellState();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  globalThis.__DEMS_SECURE_STORE_MOCK__.reset();
}

export async function renderLiveMonitor({
  window = 'phonePortrait',
  setup,
  answerDelayMs = 0,
  strict = false,
  onRender,
}: LiveMonitorBedOptions = {}): Promise<LiveMonitorBed> {
  setWindow(window);
  const fake = createFakeTransport({ epoch: 2, revision: 10 });
  const now = () => fake.clock.now();
  const engine = createTestSim({ start: now() });
  const investigator = OPERATORS.find((operator) => operator.id === DEVICE_SESSION.operator.id);
  if (investigator === undefined || !engine.sim.actions.signIn(investigator.username, DEMO_OPERATOR_PASSWORD).ok) {
    throw new Error('live monitor bed: the engine could not sign in the investigator');
  }
  engine.sim.actions.loadScenario(ScenarioName.RECORDING);
  if (engine.sim.store.getState().session?.state !== 'RECORDING') throw new Error('live monitor bed: the recording scenario did not load');
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

  const pushDelta = (before: SimState): void => {
    const ops = changedSlices(before, engine.sim.store.getState());
    if (ops.length > 0) act(() => void bed.connection().delta(ops));
  };

  const bed: LiveMonitorBed = {
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
      pushDelta(before);
      await flushJobs();
    },
    async changeOnCore(change) {
      const before = engine.sim.store.getState();
      change(engine);
      pushDelta(before);
      await flushJobs();
    },
    sendMeters(frames) {
      // The meters slice is keyed by mic input since schema v2 (SH-17): the caller still names a
      // channel, so map each to the input that feeds it and mark the primary input active.
      // D61 (2026-11-04): a channel the bed does not name sends no member at all (as the old `undefined` did on the wire).
      const named = (track: 'AUDIO-01' | 'AUDIO-02', input: 'MIC-01' | 'MIC-02') => (frames[track] === undefined ? {} : { [input]: frames[track] });
      act(() =>
        void bed.connection().meters({
          inputs: { ...named('AUDIO-01', 'MIC-01'), ...named('AUDIO-02', 'MIC-02') },
          // The Core's own member (row 73): `MIC-01` until the engine switched.
          activeInputId: engine.sim.store.getState().audio.activeInputId,
        }),
      );
    },
    raiseMicSilent: (inputId) => bed.changeOnCore((core) => core.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: inputId })),
    clearMicSilent: (inputId) => bed.changeOnCore((core) => core.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: inputId })),
    setReachable(next, { drop = true } = {}) {
      const wasUp = reachable === true;
      reachable = next;
      if (next !== true && wasUp && drop) act(() => void bed.connection().drop());
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
    async openMonitor() {
      act(() => router.push('/session/live' as never));
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
   * that holds what changed. The engine's refusals are the Core's: a short reason is 422
   * `INVALID_REASON` (D94: after 404 and 409), any other transition 409 `INVALID_STATE`.
   */
  const hosted = (operationId: string, run: (call: FakeHttpCall) => FakeAnswer): void =>
    answered(operationId, (call) => {
      const before = engine.sim.store.getState();
      let answer: FakeAnswer;
      try {
        answer = run(call);
      } catch (error) {
        if (error instanceof SimTransitionError && error.code === SimErrorCode.REASON_TOO_SHORT) return fake.example('stopSession', 422, 'invalidReason');
        return refusal(409, 'INVALID_STATE', 'The session is not in a state that allows this.');
      }
      if (answer.status >= 300) return answer;
      const ops = changedSlices(before, engine.sim.store.getState());
      const revision = fake.position.revision + 1;
      const connection = bed.connection();
      const send = (): void => void connection.delta(ops, { revision });
      if (ops.length > 0) {
        if (bed.order === 'delta-first') send();
        else held.push(send);
      }
      return { ...answer, ...(ops.length > 0 ? { revision } : {}), ...(bed.answerDelayMs > 0 ? { delayMs: bed.answerDelayMs } : {}) };
    });
  const sessionIdOf = (): string => engine.sim.store.getState().session?.id ?? 'SES-UNKNOWN';
  const bodyOf = (call: FakeHttpCall): Readonly<Record<string, unknown>> =>
    typeof call.body === 'object' && call.body !== null ? (call.body as Readonly<Record<string, unknown>>) : {};

  hosted('stopSession', (call) => {
    engine.sim.actions.stopRecording(String(bodyOf(call).reason ?? ''));
    return { status: 202, body: { sessionId: sessionIdOf(), state: 'STOPPING' } };
  });
  hosted('addSessionMarker', (call) => {
    const label = bodyOf(call).label;
    engine.sim.actions.addMarker(typeof label === 'string' ? label : undefined);
    return { status: 204 };
  });
  hosted('takeSessionSnapshot', () => {
    engine.sim.actions.snapshot();
    return { status: 204 };
  });
  hosted('setActiveCamera', (call) => {
    engine.sim.actions.setActiveCamera(bodyOf(call).cameraId as VideoTrackId);
    return { status: 204 };
  });
  hosted('resetMicClip', (call) => {
    engine.sim.actions.resetClip(bodyOf(call).channel as AudioTrackId);
    return { status: 204 };
  });
  // Operation 81 is RETIRED (audit row 185, M3-05; D136): the model Core answers EVERY call as the Core does,
  // `409 AUDIO_SOURCE_FIXED_BY_PAIRING` (the contract's `fixedByPairing` example), with nothing changed and no
  // audit row. The tablet sends it nowhere; a request seen here is a regression the tests count.
  answered('switchAudioSource', () => fake.example('switchAudioSource', 409, 'fixedByPairing'));

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
    let tree: ReactNode = (
      <AppProviders sim={liveSim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new InertSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    if (strict) tree = <StrictMode>{tree}</StrictMode>;
    return onRender ? (
      <Profiler id="live-monitor" onRender={onRender}>
        {tree}
      </Profiler>
    ) : (
      tree
    );
  }
  const routes = {
    _layout: LiveRoot,
    index: () => <Text testID="screen-index">index</Text>,
    home: () => <Text testID="screen-home">home</Text>,
    'session/live': SessionLiveRoute,
    'session/finalizing': () => <Text testID="screen-session-finalizing">finalizing</Text>,
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
    throw new Error(`live monitor bed: the Live sign-in did not land (${JSON.stringify(signedIn)}; auth ${auth.status})`);
  }
  if (created.sim.store.getState().session?.state !== 'RECORDING') throw new Error('live monitor bed: the replica does not hold the recording');
  return bed;
}
