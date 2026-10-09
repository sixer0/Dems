// Plan row W44 (HB-14), the session side of the Live source: 04_client_integration_spec §2.3
// (`auth`, `authLockout`, `pairing`, `clock`, `audio`), §5.1, §5.2, §5.6, §6.5, §9; CL-15, CL-23,
// CL-27; AC-C-13, AC-C-39, AC-C-54; 01_specs §9.4 (`session.ended` with `TOKEN_REUSE`).
//
// Everything runs on the fake transport and the fake clock. A test scripts what each new socket
// gets (`script.start`), because the principal of a socket changes with a sign-in and a sign-out.
import { afterEach, describe, expect, it } from 'vitest';
import { CORE_API_EXAMPLES, pickReplicatedState, type AuthSessionInfo, type PairingRedeemed, type ReplicatedState, type SignInStatus } from '../src/api';
import { createCoreClient } from '../src/client';
import { CoreRefusalError, LiveTransportError, coreActionsOf, coreModeOf, corePermissionOf, liveLinkOf, liveOf, type CoreActions } from '../src/live';
import {
  LIVE_BOOT_TIMEOUT_MS,
  LIVE_PERMISSION_REFRESH_MS,
  LIVE_SESSION_PROBE_RETRY_MS,
  LIVE_TOUCH_INTERVAL_MS,
  asSim,
  createLiveClock,
  createLiveSim,
  createTouchThrottle,
  lockoutSliceOf,
  type CreateLiveSimOptions,
  type LiveSecretsPort,
  type LiveSessionEnd,
  type LiveSim,
} from '../src/live/source';
import { FAKE_CREDENTIALS, createFakeClock, createFakeTransport, rateLimited, refusal, type FakeConnection, type FakeTransport } from '../src/live/testing';
import {
  AUTH_IDLE_TIMEOUT_MS,
  AUTH_MAX_FAILURES,
  CLOCK_TICK_MS,
  DEFAULT_SEED,
  buildScenarioState,
  createIdleState,
  lockoutStatus,
  selectAttemptsRemaining,
  selectIsLocked,
  selectIsSignedIn,
  selectLockout,
  selectOperator,
  type SimErrorReport,
  type SimState,
  type VisibilityAdapter,
} from '../src/sim';

const BASE_URL = 'http://127.0.0.1:4420';
const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const PASSWORD = 'MARKER-PASSWORD-7f3a';

let fake: FakeTransport;
let live: LiveSim | undefined;

afterEach(() => {
  live?.stop();
  live = undefined;
  (fake as FakeTransport | undefined)?.assertNoViolations();
});

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);
const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
};
/** Moves the clock on in small steps and lets the promise jobs run in between: a socket that is opened inside a step gets its script before the next one. */
const elapse = async (ms: number): Promise<void> => {
  for (let elapsed = 0; elapsed < ms; elapsed += 250) {
    fake.clock.advance(Math.min(250, ms - elapsed));
    await flush();
  }
};
const example = <T>(operationId: string, status: number, name: string): T => {
  const found = CORE_API_EXAMPLES[operationId]?.responses[status]?.[name];
  if (!found) throw new Error(`no example ${operationId} ${status} ${name}`);
  return found.value as T;
};

const WEB_SESSION = example<AuthSessionInfo>('getAuthSession', 200, 'webConsole');

interface Rig {
  source: LiveSim;
  reports: SimErrorReport[];
  recording: SimState;
  /** What every socket opened from now on gets. */
  script: { start(connection: FakeConnection): void };
  operator(): (connection: FakeConnection) => void;
  ends: LiveSessionEnd[];
}

/** A web console (cookie, no headers). `signedIn`: the cookie resolves and every socket is an OPERATOR socket. */
function web(options: { signedIn: boolean; start?: boolean } & Partial<CreateLiveSimOptions> = { signedIn: false }): Rig {
  const { signedIn, start, ...rest } = options;
  fake = createFakeTransport({ epoch: 3, revision: 40 });
  const recording = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
  const operator = () => (connection: FakeConnection) => {
    connection.startOperator(wire(recording)).beatEvery();
  };
  const anonymous = (connection: FakeConnection): void => {
    connection.startAnonymous().beatEvery();
  };
  const script = { start: signedIn ? operator() : anonymous };
  fake.onConnect((connection) => script.start(connection));
  if (signedIn) fake.answerFromExample('getAuthSession', 200, 'webConsole');
  else fake.answerFromExample('getAuthSession', 401);
  fake.answerFromExample('getSignInStatus', 200, 'open');
  const reports: SimErrorReport[] = [];
  const ends: LiveSessionEnd[] = [];
  const source = createLiveSim({
    client: createCoreClient({ baseUrl: BASE_URL, credentials: 'browser-cookie', fetch: fake.fetch }),
    socket: { url: SOCKET_URL, factory: fake.socketFactory },
    now: fake.clock.now,
    timers: fake.clock.timers,
    random: () => 0,
    onError: (report) => reports.push(report),
    autoStart: start ?? true,
    ...rest,
  });
  live = source;
  source.onSessionEnd((end) => ends.push(end));
  return { source, reports, recording, script, operator, ends };
}

async function signedInWeb(options: Partial<CreateLiveSimOptions> = {}): Promise<Rig> {
  const rig = web({ signedIn: true, ...options });
  await rig.source.ready;
  expect(rig.source.store.getState().auth.status).toBe('SIGNED_IN');
  return rig;
}

/** Nothing of the Core is left in the store. */
function expectNoCoreData(source: LiveSim): void {
  const state = source.store.getState();
  expect(state.operators).toEqual([]);
  expect(state.evidence).toEqual([]);
  expect(state.audit.rows).toEqual([]);
  expect(state.events).toEqual([]);
  expect(state.sessionHistory).toEqual([]);
  expect(state.session).toBeNull();
  expect(state.device.id).toBe('');
  expect(state.audio.inputs['MIC-01'].noSignal).toBe(true);
  expect(source.session).toBeNull();
  expect(source.auditChain).toBeNull();
}

describe('the bootstrap (§5.1) and `ready`', () => {
  it('signed out: the probe answers 401, the socket is anonymous, the lock state fills the lockout view, and no Core data is held', async () => {
    const { source, reports } = web({ signedIn: false });
    expect(source.isReady()).toBe(false);
    expect(source.link).toBe('CONNECTING');
    await source.ready;
    await flush();
    expect(source.isReady()).toBe(true);
    expect(source.link).toBe('ONLINE');
    expect(selectIsSignedIn(source.store.getState())).toBe(false);
    expectNoCoreData(source);
    expect([...fake.log.operationIds()].sort()).toEqual(['getAuthSession', 'getSignInStatus']);
    expect(fake.connections).toHaveLength(1);
    expect(fake.connection().principal).toBe('ANONYMOUS');
    // An anonymous connection may send nothing, and the source sends nothing.
    expect(fake.connection().received).toEqual([]);
    expect(selectLockout(source.store.getState())).toMatchObject({ locked: false, attemptsRemaining: 5 });
    expect(source.lastSessionEnd).toBeNull();
    expect(reports).toEqual([]);
  });

  it('signed in (a reload with a valid cookie): `auth` and the snapshot arrive in ONE store update, then `ready` resolves', async () => {
    const { source, recording } = web({ signedIn: true, start: false });
    const seen: string[] = [];
    source.store.subscribe((state) => seen.push(`${state.auth.status} operators=${state.operators.length} session=${state.session?.state ?? 'none'}`));
    source.start();
    await source.ready;
    // Never signed in without data, never data without being signed in.
    expect(seen).toEqual(['SIGNED_IN operators=3 session=RECORDING']);
    expect(source.session).toEqual(WEB_SESSION);
    expect(selectOperator(source.store.getState())?.id).toBe(WEB_SESSION.operator.id);
    expect(source.store.getState().auth).toEqual({
      status: 'SIGNED_IN',
      operatorId: WEB_SESSION.operator.id,
      method: 'PASSWORD',
      issuedAt: WEB_SESSION.issuedAt,
      lastActivityAt: WEB_SESSION.lastActivityAt,
    });
    expect(source.store.getState().evidence).toHaveLength(recording.evidence.length);
    expect(fake.log.operationIds()).toEqual(['getAuthSession']);
    // CL-11b: an OPERATOR socket of a visible page subscribes to the meters.
    expect(fake.connection().received).toEqual([{ type: 'subscribe', topic: 'meters' }]);
  });

  it('the Live handle of the light API: the mode, the link and the permission hint follow the source', async () => {
    const { source } = await signedInWeb();
    const sim = asSim(source);
    expect(coreModeOf(sim)).toBe('LIVE');
    expect(liveOf(sim)).toBe(source);
    expect(liveLinkOf(sim)).toBe('ONLINE');
    expect(corePermissionOf(sim, 'USER_ADMIN')).toBe(true);
    expect(corePermissionOf(sim, 'MAINTENANCE')).toBe(false);
    // The actions a call site reads through the light API are the source's own object, and its
    // type is assignable to `CoreActions` (a compile-time statement: this line must type-check).
    const viaLight: CoreActions = source.actions;
    expect(coreActionsOf(sim)).toBe(viaLight);
    expect(source.client).toBeDefined();
    expect(source.wasRestored()).toBe(false);
    expect(source.seed).toBe(DEFAULT_SEED);
    expect(source.rng.get('precheck').next()).toBe(0);
    // No-ops of the `Sim` contract, and the simulated REST surface is not served in Live mode.
    source.tick();
    source.flush();
    expect(source.request({ method: 'GET', path: '/api/v1/session/current' })).toMatchObject({ status: 501, headers: {}, body: { error: { code: 'SIMULATOR_ERROR' } } });
  });

  it('the session is known but no snapshot comes: `ready` resolves after the boot time-out with nobody signed in; the snapshot signs in when it comes', async () => {
    const { source, script, operator } = web({ signedIn: true, start: false });
    // The socket is never accepted: the server is not answering upgrades yet.
    script.start = () => undefined;
    let resolved = false;
    void source.ready.then(() => (resolved = true));
    source.start();
    await flush();
    expect(resolved).toBe(false);
    expect(source.session).toEqual(WEB_SESSION);
    expect(selectIsSignedIn(source.store.getState())).toBe(false);

    fake.clock.advance(LIVE_BOOT_TIMEOUT_MS - 1);
    await flush();
    expect(resolved).toBe(false);
    fake.clock.advance(1);
    await flush();
    expect(resolved).toBe(true);
    expect(source.isReady()).toBe(true);
    expect(source.link).not.toBe('ONLINE');
    expect(selectIsSignedIn(source.store.getState())).toBe(false);

    // The link comes back: the next socket is an OPERATOR socket with a snapshot.
    script.start = operator();
    await elapse(5_000);
    expect(source.link).toBe('ONLINE');
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
  });

  it('no answer to the probe: `ready` resolves at once, and the question is asked again until the server answers', async () => {
    const { source, script, operator } = web({ signedIn: true, start: false });
    script.start = (connection) => {
      connection.refuse();
    };
    fake.fail('getAuthSession');
    source.start();
    await source.ready;
    expect(source.session).toBeNull();
    expect(selectIsSignedIn(source.store.getState())).toBe(false);
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(1);

    fake.clock.advance(LIVE_SESSION_PROBE_RETRY_MS);
    await flush();
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(2);

    // The server is back.
    fake.answerFromExample('getAuthSession', 200, 'webConsole');
    script.start = operator();
    await elapse(LIVE_SESSION_PROBE_RETRY_MS + 8_000);
    expect(source.session).toEqual(WEB_SESSION);
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
    expect(source.link).toBe('ONLINE');
  });

  it('an OPERATOR socket whose session the server does not name: nothing of it is shown, and the question is asked once for that socket', async () => {
    // The socket says OPERATOR and sends a snapshot; `getAuthSession` says 401.
    const { source, operator, script, reports } = web({ signedIn: false, start: false });
    script.start = operator();
    source.start();
    await source.ready;
    await flush();
    expect(fake.connection().principal).toBe('OPERATOR');
    expect(selectIsSignedIn(source.store.getState())).toBe(false);
    expectNoCoreData(source);
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(1);
    // Later deltas of that socket are dropped, and none of them asks again.
    const before = source.store.getState();
    for (let index = 0; index < 5; index += 1) {
      fake.connection().delta([{ op: 'replace', slice: 'activeCameraId', value: index % 2 === 0 ? 'VIDEO-02' : 'VIDEO-01' }]);
      await flush();
    }
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(1);
    expect(source.socketStatus().counters.deltas).toBe(5);
    expect(source.store.getState().activeCameraId).toBe(before.activeCameraId);
    expectNoCoreData(source);
    expect(reports).toEqual([]);
  });

  it('with autoStart false nothing is sent and no socket is opened until start(); start and stop are idempotent; stop leaves no timer', async () => {
    const { source } = web({ signedIn: true, start: false });
    await flush();
    expect(fake.calls).toHaveLength(0);
    expect(fake.connections).toHaveLength(0);
    expect(fake.clock.pendingTasks).toBe(0);
    expect(source.isRunning()).toBe(false);

    source.start();
    source.start();
    expect(source.isRunning()).toBe(true);
    expect(fake.connections).toHaveLength(1);
    await source.ready;
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(1);

    source.stop();
    source.stop();
    source.destroy();
    expect(source.isRunning()).toBe(false);
    expect(source.link).toBe('OFFLINE');
    expect(fake.connection().closed).toMatchObject({ by: 'client', code: 1000 });
    await flush();
    expect(fake.clock.pendingTasks).toBe(0);
    // The store keeps what it held: the screen shows the last state received (§3.5).
    expect(selectIsSignedIn(source.store.getState())).toBe(true);

    source.start();
    await flush();
    expect(fake.connections).toHaveLength(2);
    expect(source.link).toBe('ONLINE');
  });

  it('a source that is stopped before its bootstrap ended still resolves `ready`', async () => {
    const { source, script } = web({ signedIn: true, start: false });
    script.start = () => undefined;
    source.start();
    source.stop();
    await expect(source.ready).resolves.toBeUndefined();
  });
});

describe('sign-in (§5.2, WS-1 to WS-4)', () => {
  it('web: the answer, then a new socket, then its snapshot; only then the action settles, with `auth` and the data in one update', async () => {
    const { source, script, operator, reports } = web({ signedIn: false });
    await source.ready;
    await flush();
    fake.answerOnceFromExample('signIn', 200, 'webConsole');
    script.start = operator();
    const seen: string[] = [];
    source.store.subscribe((state) => seen.push(`${state.auth.status} operators=${state.operators.length}`));
    const changes: (string | null)[] = [];
    source.onLiveChange(() => changes.push(source.session?.operator.id ?? null));

    const result = await source.actions.signIn('andi.pratama', PASSWORD);
    expect(result).toEqual({ ok: true, operatorId: 'OPR-002', role: 'SUPERVISOR', method: 'PASSWORD' });
    expect(seen.filter((entry) => entry.startsWith('SIGNED_IN'))).toEqual(['SIGNED_IN operators=3']);
    expect(seen.some((entry) => entry === 'SIGNED_OUT operators=3')).toBe(false);
    expect(source.session?.operator.id).toBe('OPR-002');
    expect(changes).toContain('OPR-002');
    // CL-11a: the anonymous socket was replaced; exactly one socket is open.
    expect(fake.connections).toHaveLength(2);
    expect(fake.connections[0]?.closed).toMatchObject({ by: 'client', code: 1000 });
    expect(fake.connection().principal).toBe('OPERATOR');
    // The web console sends no Authorization header, on the request and on the upgrade.
    expect(fake.log.requestsOf('signIn')[0]?.headers.authorization).toBeUndefined();
    expect(fake.connection().headers).toEqual({});
    // The password travelled in the body of that one request and is nowhere else.
    expect(fake.log.requestsOf('signIn')[0]?.body).toEqual({ username: 'andi.pratama', password: PASSWORD });
    expect(JSON.stringify(source.errors())).not.toContain(PASSWORD);
    expect(JSON.stringify(source.store.getState())).not.toContain(PASSWORD);
    expect(reports).toEqual([]);
  });

  it('a wrong password resolves with INVALID_CREDENTIALS and the attempts left; the lockout view follows (WS-2, WS-3)', async () => {
    const { source, reports } = web({ signedIn: false });
    await source.ready;
    fake.answerOnce('signIn', refusal(401, 'INVALID_CREDENTIALS', 'Invalid username or password.', { attemptsRemaining: 2 }));
    expect(await source.actions.signIn('andi.pratama', PASSWORD)).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining: 2 });
    expect(selectAttemptsRemaining(source.store.getState())).toBe(2);
    expect(selectIsLocked(source.store.getState())).toBe(false);
    expect(fake.connections).toHaveLength(1);
    // A refusal the union carries is an answer, not an error: nothing is reported, and never the password.
    expect(reports).toEqual([]);
  });

  it('a locked console resolves with LOCKED, and the countdown runs on the Live clock to lockedUntil', async () => {
    const { source } = web({ signedIn: false });
    await source.ready;
    const lockedUntil = fake.clock.now() + 42_000;
    fake.answerOnce('signIn', refusal(423, 'LOCKED', 'The console is locked.', { lockedUntil, retryInMs: 42_000 }));
    expect(await source.actions.signIn('andi.pratama', PASSWORD)).toEqual({ ok: false, reason: 'LOCKED', lockedUntil, retryInMs: 42_000 });
    expect(selectLockout(source.store.getState())).toMatchObject({ locked: true, lockedUntil, attemptsRemaining: 0 });
    fake.clock.advance(41_000);
    expect(selectLockout(source.store.getState())).toMatchObject({ locked: true, retryInMs: 1_000 });
    fake.clock.advance(1_000);
    expect(selectLockout(source.store.getState())).toMatchObject({ locked: false, attemptsRemaining: 5 });
  });

  it('403 rejects with CoreRefusalError; 429 rejects with LiveTransportError that keeps status and retry-after (LB-10); neither changes the link', async () => {
    const { source } = web({ signedIn: false });
    await source.ready;
    fake.answerOnceFromExample('signIn', 403, 'deviceNotPaired');
    const refused = await source.actions.signIn('andi.pratama', PASSWORD).then(() => undefined, (error: unknown) => error);
    expect(refused).toBeInstanceOf(CoreRefusalError);
    expect(refused).toMatchObject({ code: 'DEVICE_NOT_PAIRED', status: 403 });

    fake.answerOnce('signIn', rateLimited(37));
    const limited = await source.actions.signIn('andi.pratama', PASSWORD).then(() => undefined, (error: unknown) => error);
    expect(limited).toBeInstanceOf(LiveTransportError);
    expect(limited).toMatchObject({ reason: 'UNAVAILABLE', status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 37 });
    expect(source.link).toBe('ONLINE');
    expect(JSON.stringify(source.errors())).not.toContain(PASSWORD);
  });

  it('the snapshot does not arrive: the action rejects CORE_OFFLINE after the boot time-out; when it arrives later the client is signed in (§5.2 step 6)', async () => {
    const { source, script, operator } = web({ signedIn: false });
    await source.ready;
    fake.answerOnceFromExample('signIn', 200, 'webConsole');
    // The new socket is never accepted.
    script.start = () => undefined;
    let outcome: unknown;
    void source.actions.signIn('andi.pratama', PASSWORD).then(
      (value) => (outcome = value),
      (error: unknown) => (outcome = error),
    );
    await fake.arrived(3);
    await flush();
    expect(outcome).toBeUndefined();
    fake.clock.advance(LIVE_BOOT_TIMEOUT_MS);
    expect(outcome).toBeInstanceOf(LiveTransportError);
    expect(outcome).toMatchObject({ reason: 'CORE_OFFLINE', code: 'SNAPSHOT_TIMEOUT' });
    expect(selectIsSignedIn(source.store.getState())).toBe(false);
    expect(source.session).toBeNull();

    // The cookie exists. The link comes back as an OPERATOR socket: the probe finds the session.
    fake.answerFromExample('getAuthSession', 200, 'webConsole');
    script.start = operator();
    await elapse(6_000);
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
    expect(source.session?.operator.id).toBe('OPR-002');
  });

  it('a sign-in on a client that is signed in: the ROTATED end of its previous session is not an end, and the new snapshot settles it', async () => {
    const { source, ends } = await signedInWeb();
    const answer = fake.hold('signIn');
    const result = source.actions.signIn('andi.pratama', PASSWORD);
    await fake.arrived(2);
    // The server replaced the session the request presented (ID-6) and closes its socket.
    fake.connection().sessionEnded('ROTATED');
    expect(ends).toEqual([]);
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
    answer.release(fake.example('signIn', 200, 'webConsole'));
    await expect(result).resolves.toMatchObject({ ok: true, operatorId: 'OPR-002' });
    await flush();
    expect(ends).toEqual([]);
    expect(fake.connections).toHaveLength(2);
    expect(fake.connection().principal).toBe('OPERATOR');
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
    // The check of a rotation was not needed: the sign-in itself is the check.
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(1);
  });

  it('while the link is not ONLINE the sign-in is not sent', async () => {
    const { source, script } = web({ signedIn: false, start: false });
    script.start = () => undefined;
    source.start();
    await flush();
    const calls = fake.calls.length;
    await expect(source.actions.signIn('andi.pratama', PASSWORD)).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', status: null });
    expect(fake.calls).toHaveLength(calls);
  });
});

describe('AC-C-39: the synthesised authLockout slice makes the shared lockoutStatus() answer what the server said', () => {
  const at = createFakeClock().now();
  const cases: SignInStatus[] = [
    ...Array.from({ length: AUTH_MAX_FAILURES + 1 }, (_, attemptsRemaining) => ({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining, serverTime: at })),
    { locked: true, lockedUntil: at + 18_000, retryInMs: 18_000, attemptsRemaining: 0, serverTime: at },
    { locked: true, lockedUntil: at + 60_000, retryInMs: 60_000, attemptsRemaining: 0, serverTime: at },
  ].filter((status) => status.locked || status.attemptsRemaining > 0);

  it.each(cases.map((status) => [status.locked ? `locked for ${status.retryInMs} ms` : `${status.attemptsRemaining} attempts remaining`, status] as const))('%s', async (_label, status) => {
    // The pure function, at the server's instant.
    const computed = lockoutStatus(lockoutSliceOf(status, status.serverTime), status.serverTime);
    expect(computed).toEqual({ locked: status.locked, lockedUntil: status.lockedUntil, retryInMs: status.retryInMs, attemptsRemaining: status.attemptsRemaining });

    // And through the source: `getSignInStatus` at start, `selectLockout` on the replica.
    const { source } = web({ signedIn: false, start: false });
    fake.answer('getSignInStatus', { status: 200, body: status });
    source.start();
    await source.ready;
    await flush();
    expect(selectLockout(source.store.getState())).toMatchObject({ locked: status.locked, lockedUntil: status.lockedUntil, attemptsRemaining: status.attemptsRemaining });
  });

  it('a successful sign-in clears the view; a biometric failure report fills it from its SignInStatus', async () => {
    const { source, script, operator } = web({ signedIn: false });
    await source.ready;
    fake.answerOnce('signIn', refusal(401, 'INVALID_CREDENTIALS', 'Invalid username or password.', { attemptsRemaining: 1 }));
    await source.actions.signIn('andi.pratama', PASSWORD);
    expect(selectAttemptsRemaining(source.store.getState())).toBe(1);
    fake.answerOnceFromExample('signIn', 200, 'webConsole');
    script.start = operator();
    await source.actions.signIn('andi.pratama', PASSWORD);
    expect(source.store.getState().authLockout).toEqual({ failures: [], lockedUntil: null });
  });
});

describe('`session.ended`, the close codes and the control messages (§6.5; 01_specs §9.4)', () => {
  it.each([
    ['SIGNED_OUT', 'SIGNED_OUT'],
    ['IDLE_EXPIRED', 'EXPIRED'],
    ['ABSOLUTE_EXPIRED', 'EXPIRED'],
    ['USER_DISABLED', 'SIGNED_OUT'],
    ['TOKEN_REUSE', 'SIGNED_OUT'],
  ] as const)('session.ended %s: auth.status becomes %s, the Core data goes, the reason is passed on once, and an anonymous socket is opened', async (reason, status) => {
    const { source, script, ends } = await signedInWeb();
    fake.answerFromExample('getAuthSession', 401);
    script.start = (connection) => {
      connection.startAnonymous().beatEvery();
    };
    const controls: string[] = [];
    source.onControl((message) => controls.push(message.type));
    const seen: string[] = [];
    source.store.subscribe((state) => seen.push(`${state.auth.status} operators=${state.operators.length}`));

    fake.connection().sessionEnded(reason);
    // One update: signed out and empty together.
    expect(seen).toEqual([`${status} operators=0`]);
    expect(source.store.getState().auth).toEqual({ status, operatorId: null, method: null, issuedAt: null, lastActivityAt: null });
    expectNoCoreData(source);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason, source: 'CONTROL', signOut: null, wasSignedIn: true, sessionState: 'RECORDING', at: fake.clock.now() });
    expect(source.lastSessionEnd).toBe(ends[0]);
    expect(controls).toEqual(['session.ended']);

    await flush();
    // The socket the server closed with 4401 is replaced by an anonymous one; nothing loops.
    expect(fake.connections).toHaveLength(2);
    expect(fake.connection().principal).toBe('ANONYMOUS');
    expect(source.link).toBe('ONLINE');
    fake.clock.advance(20_000);
    await flush();
    expect(fake.connections).toHaveLength(2);
    expect(ends).toHaveLength(1);
  });

  it('session.ended ROTATED: unchanged until the check; a valid session stays signed in on a new socket', async () => {
    const { source, ends, recording } = await signedInWeb();
    const before = source.store.getState();
    fake.connection().sessionEnded('ROTATED');
    expect(source.store.getState()).toBe(before);
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
    await flush();
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(2);
    expect(fake.connections).toHaveLength(2);
    expect(fake.connection().principal).toBe('OPERATOR');
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
    expect(source.store.getState().evidence).toHaveLength(recording.evidence.length);
    expect(ends).toEqual([]);
    expect(source.link).toBe('ONLINE');
  });

  it('session.ended ROTATED with no session left: signed out, with the reason ROTATED', async () => {
    const { source, script, ends } = await signedInWeb();
    fake.answerFromExample('getAuthSession', 401);
    script.start = (connection) => {
      connection.startAnonymous().beatEvery();
    };
    fake.connection().sessionEnded('ROTATED');
    await flush();
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'CONTROL' });
    expect(selectIsSignedIn(source.store.getState())).toBe(false);
    expectNoCoreData(source);
    expect(fake.connection().principal).toBe('ANONYMOUS');
  });

  it('close 4401 with no session.ended before it: signed out, no reason', async () => {
    const { source, script, ends } = await signedInWeb();
    fake.answerFromExample('getAuthSession', 401);
    script.start = (connection) => {
      connection.startAnonymous().beatEvery();
    };
    fake.connection().close(4401);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason: null, source: 'CLOSE', principal: 'OPERATOR' });
    expect(source.store.getState().auth.status).toBe('SIGNED_OUT');
    await flush();
    expect(fake.connections).toHaveLength(2);
  });

  it('a `hello` that refuses the cookie of a client that believes it is signed in ends the session', async () => {
    const { source, script, ends } = await signedInWeb();
    fake.answerFromExample('getAuthSession', 401);
    script.start = (connection) => {
      connection.startAnonymous('SESSION_INVALID').beatEvery();
    };
    // The link is lost and comes back; the cookie no longer resolves.
    fake.connection().close(1001);
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
    fake.clock.advance(1_000);
    await flush();
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason: null, source: 'HELLO', helloReason: 'SESSION_INVALID', principal: 'ANONYMOUS' });
    expect(selectIsSignedIn(source.store.getState())).toBe(false);
    fake.clock.advance(10_000);
    await flush();
    expect(ends).toHaveLength(1);
  });

  it('session.updated replaces the session object: the new role and permissions, and the light hint follows', async () => {
    const { source } = await signedInWeb();
    const before = source.session;
    let changes = 0;
    source.onLiveChange(() => (changes += 1));
    const controls: string[] = [];
    source.onControl((message) => controls.push(message.type));
    fake.connection().sessionUpdated({ id: 'OPR-002', role: 'INVESTIGATOR' }, ['SESSION_START', 'SESSION_NOTE', 'EVIDENCE_VIEW', 'DIAGNOSTICS_RUN']);
    expect(source.session).not.toBe(before);
    expect(before?.operator.role).toBe('SUPERVISOR');
    expect(source.session?.operator.role).toBe('INVESTIGATOR');
    expect(source.session?.permissions).toEqual(['SESSION_START', 'SESSION_NOTE', 'EVIDENCE_VIEW', 'DIAGNOSTICS_RUN']);
    expect(corePermissionOf(asSim(source), 'USER_ADMIN')).toBe(false);
    expect(changes).toBe(1);
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
    expect(controls).toEqual(['session.updated']);
  });

  it('admin.changed is passed on to onControl and changes nothing', async () => {
    fake = createFakeTransport();
    const state = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
    fake.scriptSignedInStart(wire(state), { admin: true });
    const source = createLiveSim({
      client: createCoreClient({ baseUrl: BASE_URL, credentials: 'browser-cookie', fetch: fake.fetch }),
      socket: { url: SOCKET_URL, factory: fake.socketFactory },
      now: fake.clock.now,
      timers: fake.clock.timers,
    });
    live = source;
    await source.ready;
    const before = source.store.getState();
    const resources: string[] = [];
    const stop = source.onControl((message) => {
      if (message.type === 'admin.changed') resources.push(message.resource);
    });
    fake.connection().adminChanged('USERS');
    fake.connection().adminChanged('PAIRING_CODE');
    stop();
    fake.connection().adminChanged('DEVICES');
    expect(resources).toEqual(['USERS', 'PAIRING_CODE']);
    expect(source.store.getState()).toBe(before);
  });

  it('a listener that throws is reported and the others still run', async () => {
    const { source, reports } = await signedInWeb();
    const seen: string[] = [];
    source.onControl(() => {
      throw new Error('listener failed');
    });
    source.onControl((message) => seen.push(message.type));
    fake.connection().sessionUpdated({ id: 'OPR-002', role: 'SUPERVISOR' }, ['EVIDENCE_VIEW']);
    expect(seen).toEqual(['session.updated']);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ level: 'error', source: 'live.listener.onControl', message: 'listener failed' });
  });
});

describe('sign-out (WS-12)', () => {
  it.each(['USER', 'LOCK'] as const)('signOut(%s): one request with the reason; signed out, empty, one end with the reason this client sent; an anonymous socket', async (reason) => {
    const { source, script, ends } = await signedInWeb();
    fake.answerFromExample('getAuthSession', 401);
    fake.answerFromExample('signOut');
    script.start = (connection) => {
      connection.startAnonymous().beatEvery();
    };
    await expect(source.actions.signOut(reason)).resolves.toBeUndefined();
    expect(fake.log.requestsOf('signOut')[0]?.body).toEqual({ reason });
    // `LOCKED` is no value of the simulator's AuthStatus: the status is SIGNED_OUT and the end says LOCK.
    expect(source.store.getState().auth.status).toBe('SIGNED_OUT');
    expectNoCoreData(source);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason: 'SIGNED_OUT', source: 'SIGN_OUT', signOut: reason, wasSignedIn: true });
    await flush();
    expect(fake.connections).toHaveLength(2);
    expect(fake.connection().principal).toBe('ANONYMOUS');
    expect(ends).toHaveLength(1);
  });

  it('the server\'s own session.ended may arrive before the answer: still one end, and it carries the reason this client sent', async () => {
    const { source, script, ends } = await signedInWeb();
    fake.answerFromExample('getAuthSession', 401);
    script.start = (connection) => {
      connection.startAnonymous().beatEvery();
    };
    const answer = fake.hold('signOut');
    const result = source.actions.signOut('LOCK');
    await fake.arrived(2);
    fake.connection().sessionEnded('SIGNED_OUT');
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ source: 'CONTROL', reason: 'SIGNED_OUT', signOut: 'LOCK' });
    answer.release();
    await expect(result).resolves.toBeUndefined();
    await flush();
    expect(ends).toHaveLength(1);
    expect(fake.connections).toHaveLength(2);
  });

  it('signed out already: no request; an EXPIRED status becomes SIGNED_OUT, as in the simulator', async () => {
    const { source, script } = await signedInWeb();
    fake.answerFromExample('getAuthSession', 401);
    script.start = (connection) => {
      connection.startAnonymous().beatEvery();
    };
    fake.connection().sessionEnded('IDLE_EXPIRED');
    await flush();
    expect(source.store.getState().auth.status).toBe('EXPIRED');
    const calls = fake.calls.length;
    await expect(source.actions.signOut()).resolves.toBeUndefined();
    expect(source.store.getState().auth.status).toBe('SIGNED_OUT');
    expect(fake.calls).toHaveLength(calls);
  });

  it('a sign-out the server cannot answer does not reject and do nothing (decision D80): the session ends here, and the sign-out is owed', async () => {
    // Before D80 this rejected CORE_OFFLINE and left the client signed in (CL-22, WS-12 as first written).
    // The whole rule is proven in test/live-source-local-end.test.ts.
    const { source, ends } = await signedInWeb();
    fake.failOnce('signOut');
    fake.fail('signOut');
    await expect(source.actions.signOut()).resolves.toBeUndefined();
    expect(selectIsSignedIn(source.store.getState())).toBe(false);
    expectNoCoreData(source);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason: 'SIGNED_OUT', source: 'LOCAL', signOut: 'USER', wasSignedIn: true });
  });
});

describe('AC-C-54: a 403 NOT_PERMITTED refreshes the permission hint once (CL-23)', () => {
  it('one refusal causes one getAuthSession within 1 s; ten of them cause one', async () => {
    const { source } = await signedInWeb();
    const probes = (): number => fake.log.requestsOf('getAuthSession').length;
    const base = probes();
    const demoted: AuthSessionInfo = { ...WEB_SESSION, operator: { ...WEB_SESSION.operator, role: 'INVESTIGATOR' }, permissions: ['SESSION_START', 'SESSION_NOTE', 'EVIDENCE_VIEW', 'DIAGNOSTICS_RUN'] };
    fake.answer('getAuthSession', { status: 200, body: demoted });
    fake.answer('archiveEvidence', refusal(403, 'NOT_PERMITTED', 'Your role does not allow this action.', { permission: 'EVIDENCE_REVIEW' }));

    for (let index = 0; index < 10; index += 1) {
      await expect(source.actions.archiveEvidence('EV-20260930-0004')).rejects.toMatchObject({ name: 'SimPermissionError' });
      fake.clock.advance(50);
    }
    expect(probes()).toBe(base);
    fake.clock.advance(LIVE_PERMISSION_REFRESH_MS - 500);
    await flush();
    // Within 1 s of the first refusal, and exactly one.
    expect(probes()).toBe(base + 1);
    expect(source.session?.permissions).toEqual(demoted.permissions);
    expect(corePermissionOf(asSim(source), 'EVIDENCE_REVIEW')).toBe(false);
    fake.clock.advance(5_000);
    await flush();
    expect(probes()).toBe(base + 1);

    // A later refusal starts a new delay: one more.
    await expect(source.actions.archiveEvidence('EV-20260930-0004')).rejects.toBeDefined();
    fake.clock.advance(LIVE_PERMISSION_REFRESH_MS);
    await flush();
    expect(probes()).toBe(base + 2);
  });

  it('a denied export (403 FORBIDDEN, a result union) refreshes the hint too; other refusals do not', async () => {
    const { source } = await signedInWeb();
    const base = fake.log.requestsOf('getAuthSession').length;
    fake.answerOnce('archiveEvidence', refusal(409, 'NOT_SEALED', 'The item is not sealed.'));
    await expect(source.actions.archiveEvidence('EV-20260930-0004')).rejects.toMatchObject({ code: 'UNSEALED_EVIDENCE' });
    fake.clock.advance(LIVE_PERMISSION_REFRESH_MS);
    await flush();
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(base);

    fake.answerOnce('exportEvidence', refusal(403, 'FORBIDDEN', 'Your role does not allow this export.'));
    expect(await source.actions.exportEvidence('EV-20260930-0004', { reason: 'Prosecutor review', destination: '' })).toMatchObject({ ok: false, reason: 'FORBIDDEN' });
    fake.clock.advance(LIVE_PERMISSION_REFRESH_MS);
    await flush();
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(base + 1);
  });
});

describe('AC-C-13: the touchSession throttle (CL-27)', () => {
  const touches = (): number => fake.log.requestsOf('touchSession').length;

  it('ten activity calls within 60 s send one request at once and one at the end of the window; then none without activity', async () => {
    expect(LIVE_TOUCH_INTERVAL_MS).toBe(60_000);
    const { source } = await signedInWeb();
    fake.answerFromExample('touchSession');
    for (let index = 0; index < 10; index += 1) {
      await expect(source.actions.touch()).resolves.toBeUndefined();
      await flush();
      expect(touches()).toBe(1);
      fake.clock.advance(5_000);
    }
    // 50 s have passed. The window ends at 60 s.
    fake.clock.advance(9_999);
    await flush();
    expect(touches()).toBe(1);
    fake.clock.advance(1);
    await flush();
    expect(touches()).toBe(2);
    // No activity since: nothing more, however long the page stays open.
    fake.clock.advance(10 * LIVE_TOUCH_INTERVAL_MS);
    await flush();
    expect(touches()).toBe(2);
  });

  it('no activity sends none', async () => {
    await signedInWeb();
    fake.clock.advance(5 * LIVE_TOUCH_INTERVAL_MS);
    await flush();
    expect(touches()).toBe(0);
  });

  it('a successful POST restarts the window and clears what was remembered', async () => {
    const { source } = await signedInWeb();
    fake.answerFromExample('touchSession');
    fake.answerFromExample('runDiagnostics');
    void source.actions.touch();
    await flush();
    expect(touches()).toBe(1);
    fake.clock.advance(10_000);
    void source.actions.touch();
    fake.clock.advance(10_000);
    // The server counts this POST as activity, 20 s into the window.
    await source.actions.runDiagnostics();
    fake.clock.advance(40_000);
    await flush();
    // The old window would have ended here with a trailing touch; it was restarted and cleared.
    expect(touches()).toBe(1);
    void source.actions.touch();
    fake.clock.advance(19_999);
    await flush();
    expect(touches()).toBe(1);
    fake.clock.advance(1);
    await flush();
    expect(touches()).toBe(2);
  });

  it('the answer updates the idle expiry of the session and lastActivityAt of the auth slice', async () => {
    const { source } = await signedInWeb();
    fake.answerFromExample('touchSession');
    const touched = example<{ idleExpiresAt: number; absoluteExpiresAt: number }>('touchSession', 200, 'touched');
    const before = source.session;
    void source.actions.touch();
    await flush();
    expect(source.session).not.toBe(before);
    expect(source.session).toMatchObject({ idleExpiresAt: touched.idleExpiresAt, absoluteExpiresAt: touched.absoluteExpiresAt });
    expect(source.store.getState().auth.lastActivityAt).toBe(touched.idleExpiresAt - AUTH_IDLE_TIMEOUT_MS);
  });

  it('nothing is sent while signed out; a failed touch is reported and never thrown', async () => {
    const { source, reports } = web({ signedIn: false });
    await source.ready;
    await source.actions.touch();
    await flush();
    expect(touches()).toBe(0);

    const signedIn = await signedInWeb();
    fake.answerOnce('touchSession', refusal(500, 'INTERNAL_ERROR', 'Unexpected failure.'));
    await expect(signedIn.source.actions.touch()).resolves.toBeUndefined();
    await flush();
    expect(signedIn.reports).toHaveLength(1);
    expect(signedIn.reports[0]).toMatchObject({ level: 'error', source: 'live.action.touch', context: { status: 500, code: 'INTERNAL_ERROR' } });
    expect(reports).toEqual([]);
    source.stop();
  });

  it('the throttle by itself: activity while offline is remembered and sent when the link is back', () => {
    const clock = createFakeClock(0);
    let online = false;
    let sent = 0;
    const throttle = createTouchThrottle({ intervalMs: 60_000, now: clock.now, timers: clock.timers, signedIn: () => true, online: () => online, send: () => (sent += 1) });
    expect(throttle.activity()).toBe(false);
    expect([sent, throttle.pending]).toEqual([0, true]);
    throttle.flush();
    expect(sent).toBe(0);
    online = true;
    throttle.flush();
    expect([sent, throttle.pending]).toEqual([1, false]);
    // Inside the window, then offline at its end: kept, and sent by the next flush.
    clock.advance(1_000);
    throttle.activity();
    online = false;
    clock.advance(59_000);
    expect(sent).toBe(1);
    online = true;
    throttle.flush();
    expect(sent).toBe(2);
    throttle.activity();
    throttle.reset();
    clock.advance(120_000);
    expect([sent, throttle.pending, clock.pendingTasks]).toEqual([2, false, 0]);
  });
});

describe('CPC1-10: activity that was remembered while the link was down is not reported as fresh', () => {
  function throttleRig() {
    const clock = createFakeClock(0);
    const world = { online: false, sent: [] as number[] };
    const throttle = createTouchThrottle({
      intervalMs: LIVE_TOUCH_INTERVAL_MS,
      now: clock.now,
      timers: clock.timers,
      signedIn: () => true,
      online: () => world.online,
      send: () => world.sent.push(clock.now()),
    });
    return { clock, world, throttle };
  }

  it('activity older than the interval is forgotten when the link returns: nothing is sent, so the idle time-out is not moved by the time offline', () => {
    const { clock, world, throttle } = throttleRig();
    expect(throttle.activity()).toBe(false);
    expect(throttle.pending).toBe(true);
    // Five minutes without the Core, and without the operator.
    clock.advance(5 * 60_000);
    world.online = true;
    throttle.flush();
    expect(world.sent).toEqual([]);
    expect(throttle.pending).toBe(false);
    // Nothing follows later either.
    clock.advance(10 * LIVE_TOUCH_INTERVAL_MS);
    expect(world.sent).toEqual([]);
    // New activity counts as usual.
    expect(throttle.activity()).toBe(true);
    expect(world.sent).toEqual([clock.now()]);
  });

  it('activity at most the interval old is still sent ("at most 60 s late", CL-27); one millisecond older is not', () => {
    for (const [age, sent] of [
      [30_000, true],
      [LIVE_TOUCH_INTERVAL_MS, true],
      [LIVE_TOUCH_INTERVAL_MS + 1, false],
    ] as const) {
      const { clock, world, throttle } = throttleRig();
      throttle.activity();
      clock.advance(age);
      world.online = true;
      throttle.flush();
      expect(world.sent, String(age)).toEqual(sent ? [age] : []);
      expect(throttle.pending, String(age)).toBe(false);
    }
  });

  it('the newest activity counts: an operator who was active to the end of the outage is reported', () => {
    const { clock, world, throttle } = throttleRig();
    throttle.activity();
    clock.advance(10 * 60_000);
    throttle.activity();
    clock.advance(20_000);
    world.online = true;
    throttle.flush();
    expect(world.sent).toEqual([clock.now()]);
  });

  it('on a Live source: the link is down for five minutes after the last activity; when it returns no touch is sent', async () => {
    const { source, script, operator } = await signedInWeb();
    fake.answerFromExample('touchSession');
    await source.actions.touch();
    await flush();
    expect(fake.log.requestsOf('touchSession')).toHaveLength(1);
    script.start = (connection) => {
      if (connection.state === 'CONNECTING') connection.refuse();
    };
    fake.connection().close(1001);
    // Activity right after the link was lost; then nothing for five minutes.
    await source.actions.touch();
    await elapse(5 * 60_000);
    script.start = operator();
    await elapse(10_000);
    expect(source.link).toBe('ONLINE');
    await elapse(2 * LIVE_TOUCH_INTERVAL_MS);
    expect(fake.log.requestsOf('touchSession')).toHaveLength(1);
  });
});

describe('the clock, the meters and the heartbeat view (§2.3; CL-7, CL-11b)', () => {
  it('clock.now() is the local clock plus the offset learned from the server, and never moves backwards', () => {
    let local = 1_000_000;
    const clock = createLiveClock(() => local);
    expect(clock.now()).toBe(1_000_000);
    clock.sample(1_005_000, 1_000_000);
    expect(clock.offsetMs()).toBe(5_000);
    expect(clock.now()).toBe(1_005_000);
    local += 250;
    expect(clock.now()).toBe(1_005_250);
    // The server turns out to be behind what was assumed: the clock holds until the corrected time has caught up.
    clock.sample(1_003_250, 1_000_250);
    expect(clock.now()).toBe(1_005_250);
    local += 1_000;
    expect(clock.now()).toBe(1_005_250);
    local += 1_500;
    expect(clock.now()).toBe(1_005_750);
    clock.sample(Number.NaN, local);
    expect(clock.offsetMs()).toBe(3_000);
    expect([clock.tz, clock.tzOffsetMinutes]).toEqual(['+07:00', 420]);
  });

  it('the source learns the offset from hello and heartbeat, and publishes the clock slice in 100 ms steps', async () => {
    const { source } = web({ signedIn: true, start: false });
    fake.onConnect(() => undefined);
    source.start();
    await source.ready;
    // The server's clock is the fake's: no offset yet.
    expect(source.clock.now()).toBe(fake.clock.now());
    // A heartbeat that says the server is 5 s ahead.
    fake.connection().heartbeat({ serverTime: new Date(fake.clock.now() + 5_000).toISOString() });
    expect(source.clock.now()).toBe(fake.clock.now() + 5_000);
    const ticks: number[] = [];
    source.store.subscribe((state) => state.clock.now, (now) => ticks.push(now));
    fake.clock.advance(350);
    expect(ticks).toHaveLength(3);
    expect(ticks.every((now) => now % CLOCK_TICK_MS === 0)).toBe(true);
    expect(source.store.getState().clock).toMatchObject({ tz: '+07:00', tzOffsetMinutes: 420 });
    expect(source.store.getState().clock.now).toBeLessThanOrEqual(source.clock.now());
  });

  it('a meters frame becomes the audio slice; when the link goes STALE the meters fall to no signal', async () => {
    const { source } = web({ signedIn: true, start: false });
    // No heartbeat series in this test: the socket goes stale by itself.
    const state = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
    fake.reset();
    fake.answerFromExample('getAuthSession', 200, 'webConsole');
    fake.onConnect((connection) => {
      connection.startOperator(wire(state));
    });
    source.start();
    await source.ready;
    const frame = { seq: 3, at: fake.clock.now(), dbfs: -20, peak: -14, clip: false, noSignal: false };
    fake.connection().meters({ inputs: { 'MIC-01': frame, 'MIC-02': { ...frame, dbfs: -40 } }, activeInputId: 'MIC-01' });
    expect(source.store.getState().audio.inputs['MIC-01']).toEqual(frame);
    expect(source.link).toBe('ONLINE');
    fake.clock.advance(3_000);
    expect(source.link).toBe('STALE');
    expect(source.store.getState().audio.inputs['MIC-01']).toMatchObject({ noSignal: true, dbfs: -90 });
    expect(source.store.getState().audio.inputs['MIC-02']).toMatchObject({ noSignal: true, dbfs: -90 });
    // The rest of the screen keeps the last state received.
    expect(source.store.getState().session?.state).toBe('RECORDING');
  });

  it('the meters are subscribed only while the page or the app is visible', async () => {
    let hidden = true;
    let changed: () => void = () => undefined;
    const visibility: VisibilityAdapter = {
      isHidden: () => hidden,
      subscribe: (onChange) => {
        changed = onChange;
        return () => {
          changed = () => undefined;
        };
      },
    };
    const { source } = await signedInWeb({ visibility });
    expect(fake.connection().receivedOf('subscribe')).toEqual([]);
    hidden = false;
    changed();
    expect(fake.connection().receivedOf('subscribe')).toEqual([{ type: 'subscribe', topic: 'meters' }]);
    hidden = true;
    changed();
    expect(fake.connection().receivedOf('unsubscribe')).toEqual([{ type: 'unsubscribe', topic: 'meters' }]);
    source.stop();
    hidden = false;
    changed();
    expect(fake.connection().receivedOf('subscribe')).toHaveLength(1);
  });

  it('the heartbeat view is the one socket\'s; a consumer of it can neither start nor stop the socket', async () => {
    const { source } = await signedInWeb();
    let notified = 0;
    const stop = source.heartbeat.subscribe(() => (notified += 1));
    fake.clock.advance(1_000);
    expect(source.heartbeat.getSnapshot()).toMatchObject({ state: 'LIVE', lastBeatAt: fake.clock.now() });
    expect(notified).toBeGreaterThan(0);
    source.heartbeat.stop();
    source.heartbeat.start();
    expect(fake.connections).toHaveLength(1);
    expect(fake.connection().state).toBe('OPEN');
    expect(source.socketStatus()).toMatchObject({ running: true, principal: 'OPERATOR', synced: true });
    stop();
  });

  it('a dropped frame of the socket is reported with its code and no content', async () => {
    const { source, reports } = await signedInWeb();
    fake.connection().sendRaw('{"type":"delta","secret":"MARKER-FRAME-7f3a"}');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ level: 'error', source: 'live.socket', context: { code: 'SCHEMA_MISMATCH', messageType: 'delta' } });
    expect(JSON.stringify(source.errors())).not.toContain('MARKER-FRAME-7f3a');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// A paired device: bearer credentials, the secrets port, pairing (§9)
// ═══════════════════════════════════════════════════════════════════════════════════════

interface DeviceRig extends Rig {
  /** What the app's storage holds. The Live source has no member that returns any of it. */
  vault: { device: string | null; session: string | null; biometric: string | null };
  calls: string[];
}

function device(options: { paired: boolean; secrets?: Partial<LiveSecretsPort>; noPort?: boolean }): DeviceRig {
  fake = createFakeTransport({ epoch: 3, revision: 40 });
  const recording = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
  const vault: DeviceRig['vault'] = { device: options.paired ? FAKE_CREDENTIALS.deviceCredential : null, session: null, biometric: options.paired ? FAKE_CREDENTIALS.biometricToken : null };
  const calls: string[] = [];
  const bearer = (): string | null => vault.session ?? vault.device;
  const operator = () => (connection: FakeConnection) => {
    connection.startOperator(wire(recording)).beatEvery();
  };
  // The server takes each socket for what its upgrade header says.
  const script = {
    start(connection: FakeConnection): void {
      const header = connection.headers.authorization ?? '';
      if (header.startsWith('Bearer ses_')) operator()(connection);
      else if (header.startsWith('Bearer dvc_')) connection.startDevice().beatEvery();
      else connection.startAnonymous().beatEvery();
    },
  };
  fake.onConnect((connection) => script.start(connection));
  fake.answer('getAuthSession', () => (vault.session ? fake.example('getAuthSession', 200, 'pairedDevice') : fake.example('getAuthSession', 401)));
  fake.answerFromExample('getSignInStatus', 200, 'open');
  const secrets: LiveSecretsPort = {
    sessionIssued: ({ sessionToken, biometricToken, operatorId }) => {
      calls.push(`sessionIssued ${operatorId} rotated=${biometricToken !== null}`);
      vault.session = sessionToken;
      if (biometricToken !== null) vault.biometric = biometricToken;
    },
    sessionCleared: (end) => {
      calls.push(`sessionCleared ${end.kind} ${String(end.reason)}`);
      vault.session = null;
    },
    biometricToken: (operatorId) => {
      calls.push(`biometricToken ${operatorId}`);
      return vault.biometric;
    },
    devicePaired: (redeemed) => {
      calls.push(`devicePaired ${redeemed.deviceId}`);
      vault.device = redeemed.deviceCredential;
    },
    deviceUnpaired: (end) => {
      calls.push(`deviceUnpaired ${end.source} ${String(end.reason)}`);
      vault.device = null;
      vault.session = null;
      vault.biometric = null;
    },
    ...options.secrets,
  };
  const reports: SimErrorReport[] = [];
  const ends: LiveSessionEnd[] = [];
  const source = createLiveSim({
    client: createCoreClient({ baseUrl: BASE_URL, credentials: bearer, fetch: fake.fetch }),
    socket: { url: SOCKET_URL, factory: fake.socketFactory, headers: () => (bearer() ? { Authorization: `Bearer ${bearer()}` } : null) },
    ...(options.noPort ? {} : { secrets, device: () => ({ deviceName: 'Pixel Tablet', platform: 'android', appVersion: '0.2.0' }) }),
    now: fake.clock.now,
    timers: fake.clock.timers,
    random: () => 0,
    onError: (report) => reports.push(report),
  });
  live = source;
  source.onSessionEnd((end) => ends.push(end));
  return { source, reports, recording, script, operator, ends, vault, calls };
}

/** Every text a device's secrets could leak into: the reports, the store, and the members of the handle. */
function expectNoSecret(rig: DeviceRig, ...secrets: (string | null | undefined)[]): void {
  const surface = JSON.stringify({
    errors: rig.source.errors(),
    reports: rig.reports,
    state: rig.source.store.getState(),
    session: rig.source.session,
    lastSessionEnd: rig.source.lastSessionEnd,
    auditChain: rig.source.auditChain,
    socket: rig.source.socketStatus(),
    ends: rig.ends,
  });
  for (const secret of [...secrets, FAKE_CREDENTIALS.deviceCredential, FAKE_CREDENTIALS.sessionToken, FAKE_CREDENTIALS.biometricToken]) {
    if (typeof secret === 'string') expect(surface.includes(secret), 'a secret is readable on the Live source').toBe(false);
  }
  expect(/\b(?:ses|dvc|bio)_[A-Za-z0-9_-]{20,}/.test(surface)).toBe(false);
}

describe('a paired device: the bearer value, the secrets port and the session token (§9.1, §9.2; MP-3)', () => {
  it('starts as DEVICE with the device credential on every request and on the upgrade; nobody is signed in', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    await flush();
    expect(fake.connection().principal).toBe('DEVICE');
    expect(fake.connection().headers.authorization).toBe(`Bearer ${FAKE_CREDENTIALS.deviceCredential}`);
    expect(fake.log.requests.every((call) => call.headers.authorization === `Bearer ${FAKE_CREDENTIALS.deviceCredential}`)).toBe(true);
    expect(fake.log.requests.every((call) => call.credentials === 'omit')).toBe(true);
    expect(rig.source.link).toBe('ONLINE');
    expect(selectIsSignedIn(rig.source.store.getState())).toBe(false);
    expectNoSecret(rig);
  });

  it('a password sign-in hands the session token to the app BEFORE the socket is reopened, and keeps no copy', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    fake.answerOnceFromExample('signIn', 200, 'pairedDevice');
    const issued = example<{ sessionToken: string }>('signIn', 200, 'pairedDevice').sessionToken;
    const result = await rig.source.actions.signIn('budi.santoso', PASSWORD);
    expect(result).toEqual({ ok: true, operatorId: 'OPR-001', role: 'INVESTIGATOR', method: 'PASSWORD' });
    expect(rig.calls).toEqual(['sessionIssued OPR-001 rotated=false']);
    expect(rig.vault.session).toBe(issued);
    // The new socket presented the session token: the app's provider already returned it.
    expect(fake.connections).toHaveLength(2);
    expect(fake.connection().headers.authorization).toBe(`Bearer ${issued}`);
    expect(fake.connection().principal).toBe('OPERATOR');
    expect(selectIsSignedIn(rig.source.store.getState())).toBe(true);
    expect(rig.source.session?.deviceId).not.toBeNull();
    expectNoSecret(rig, issued, PASSWORD);
  });

  it('a biometric sign-in sends the token the app released and hands back the rotated one; without a stored token nothing is sent', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    fake.answerOnceFromExample('signInWithBiometric', 200, 'signedIn');
    const answer = example<{ sessionToken: string; biometricToken: string; session: AuthSessionInfo }>('signInWithBiometric', 200, 'signedIn');
    const result = await rig.source.actions.signInWithBiometric('OPR-001');
    expect(result).toMatchObject({ ok: true, operatorId: answer.session.operator.id, method: 'BIOMETRIC' });
    expect(fake.log.requestsOf('signInWithBiometric')[0]?.body).toEqual({ token: FAKE_CREDENTIALS.biometricToken });
    expect(rig.calls).toEqual(['biometricToken OPR-001', `sessionIssued ${answer.session.operator.id} rotated=true`]);
    expect(rig.vault.biometric).toBe(answer.biometricToken);
    expectNoSecret(rig, answer.sessionToken, answer.biometricToken);

    const empty = device({ paired: true, secrets: { biometricToken: () => null } });
    await empty.source.ready;
    const calls = fake.calls.length;
    await expect(empty.source.actions.signInWithBiometric('OPR-001')).rejects.toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    expect(fake.calls).toHaveLength(calls);
    rig.source.stop();
  });

  it('a refused biometric token resolves with the union (the app then deletes it); a failed OS check is reported with operation 9', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    fake.answerOnce('signInWithBiometric', refusal(401, 'INVALID_CREDENTIALS', 'Sign-in failed.', { attemptsRemaining: 4 }));
    expect(await rig.source.actions.signInWithBiometric('OPR-001')).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining: 4 });
    expect(rig.vault.session).toBeNull();

    fake.answerOnceFromExample('reportBiometricFailure', 200, 'locked');
    const locked = example<SignInStatus>('reportBiometricFailure', 200, 'locked');
    expect(await rig.source.actions.recordBiometricFailure('OPR-001')).toEqual({ ok: false, reason: 'LOCKED', lockedUntil: locked.lockedUntil, retryInMs: locked.retryInMs });
    expect(fake.log.requestsOf('reportBiometricFailure')[0]?.body).toEqual({ operatorId: 'OPR-001' });
    expect(selectLockout(rig.source.store.getState())).toMatchObject({ locked: true, lockedUntil: locked.lockedUntil });
    expectNoSecret(rig);
  });

  it('session.ended TOKEN_REUSE is passed on with its reason; the app drops the session token and the device socket takes over; the pairing stays', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    fake.answerOnceFromExample('signIn', 200, 'pairedDevice');
    await rig.source.actions.signIn('budi.santoso', PASSWORD);
    rig.source.setPairing({ core: { deviceId: 'DEMS-IR-01', name: 'Interview Room 1', certificateFingerprint: 'AB:CD' }, pairedAt: 5 });
    rig.calls.length = 0;

    fake.connection().sessionEnded('TOKEN_REUSE');
    expect(rig.ends).toHaveLength(1);
    expect(rig.ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason: 'TOKEN_REUSE', source: 'CONTROL', wasSignedIn: true });
    expect(rig.source.lastSessionEnd?.reason).toBe('TOKEN_REUSE');
    expect(rig.source.store.getState().auth.status).toBe('SIGNED_OUT');
    // The source deleted nothing itself: it told the app, which dropped the session token only.
    await flush();
    expect(rig.calls).toEqual(['sessionCleared SESSION_ENDED TOKEN_REUSE']);
    expect(rig.vault).toMatchObject({ session: null, device: FAKE_CREDENTIALS.deviceCredential });
    expect(rig.vault.biometric).not.toBeNull();
    expect(rig.source.store.getState().pairing.state).toBe('PAIRED');
    expect(fake.connections).toHaveLength(3);
    expect(fake.connection().principal).toBe('DEVICE');
    expectNoCoreData(rig.source);
    expectNoSecret(rig);
  });

  it('a port of the app that throws is reported, and the socket is still reopened', async () => {
    const rig = device({
      paired: true,
      secrets: {
        sessionCleared: () => {
          throw new Error('the storage of the app failed');
        },
      },
    });
    await rig.source.ready;
    fake.answerOnceFromExample('signIn', 200, 'pairedDevice');
    await rig.source.actions.signIn('budi.santoso', PASSWORD);
    // The app could not drop its token; the server ended the session all the same.
    rig.vault.session = null;
    fake.connection().sessionEnded('USER_DISABLED');
    await flush();
    expect(rig.reports).toHaveLength(1);
    // CPC1-26: by the names of the port and of the error; the app's own text and stack do not travel.
    expect(rig.reports[0]).toMatchObject({ level: 'error', source: 'live.secrets', context: { kind: 'SESSION_ENDED', port: 'sessionCleared', errorName: 'Error' } });
    expect(rig.reports[0]?.message).toBe('The storage of the app failed in "sessionCleared".');
    expect(rig.reports[0]?.stack).toBeUndefined();
    expect(rig.ends).toHaveLength(1);
    expect(fake.connections).toHaveLength(3);
    expect(fake.connection().principal).toBe('DEVICE');
    expectNoSecret(rig);
  });

  it('a device sign-in without the app\'s storage cannot keep its token: the action rejects, and nothing is kept', async () => {
    const rig = device({ paired: true, noPort: true });
    await rig.source.ready;
    fake.answerOnceFromExample('signIn', 200, 'pairedDevice');
    await expect(rig.source.actions.signIn('budi.santoso', PASSWORD)).rejects.toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    expect(selectIsSignedIn(rig.source.store.getState())).toBe(false);
    expectNoSecret(rig, example<{ sessionToken: string }>('signIn', 200, 'pairedDevice').sessionToken);
  });

  it('device.revoked (REVOKED and UNPAIRED), with close 4403: signed out, the pairing gone, the app told once, and an anonymous socket', async () => {
    for (const reason of ['REVOKED', 'UNPAIRED'] as const) {
      const rig = device({ paired: true });
      await rig.source.ready;
      rig.source.setPairing({ core: { deviceId: 'DEMS-IR-01', name: 'Interview Room 1', certificateFingerprint: 'AB:CD' }, pairedAt: 5 });
      fake.connection().deviceRevoked(reason);
      expect(rig.ends).toHaveLength(1);
      expect(rig.ends[0]).toMatchObject({ kind: 'DEVICE_REVOKED', reason, source: 'CONTROL', wasSignedIn: false });
      expect(rig.source.store.getState().pairing).toMatchObject({ state: 'UNPAIRED', coreDeviceId: '', pairedAt: null });
      await flush();
      expect(rig.calls).toEqual([`deviceUnpaired CONTROL ${reason}`]);
      expect(rig.vault.device).toBeNull();
      expect(fake.connections).toHaveLength(2);
      expect(fake.connection().principal).toBe('ANONYMOUS');
      expect(fake.connection().headers).toEqual({});
      fake.clock.advance(20_000);
      await flush();
      expect(rig.ends).toHaveLength(1);
      expect(fake.connections).toHaveLength(2);
      rig.source.stop();
      fake.assertNoViolations();
    }
  });

  it('a REST 403 DEVICE_REVOKED is treated as device.revoked (CL-23)', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    fake.answerOnceFromExample('reportBiometricFailure', 403, 'deviceRevoked');
    await expect(rig.source.actions.recordBiometricFailure(null)).rejects.toMatchObject({ name: 'CoreRefusalError', code: 'DEVICE_REVOKED' });
    expect(rig.ends).toHaveLength(1);
    expect(rig.ends[0]).toMatchObject({ kind: 'DEVICE_REVOKED', reason: null, source: 'REST' });
    await flush();
    expect(rig.calls).toEqual(['deviceUnpaired REST null']);
  });

  it('a credential the Core does not know (close 4401 with nobody signed in) is reported and NOT retried by itself; the app replaces it and reconnects', async () => {
    const rig = device({ paired: true });
    rig.script.start = (connection) => {
      connection.startAnonymous('SESSION_INVALID').close(4401);
    };
    await rig.source.ready;
    await flush();
    expect(rig.ends).toHaveLength(1);
    expect(rig.ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason: null, source: 'CLOSE', wasSignedIn: false, helloReason: 'SESSION_INVALID', principal: 'ANONYMOUS' });
    fake.clock.advance(30_000);
    await flush();
    // No loop: one socket, one end.
    expect(fake.connections).toHaveLength(1);
    expect(rig.ends).toHaveLength(1);
    expect(rig.source.link).toBe('OFFLINE');

    // MP-10: the app deletes the unknown credential and reconnects.
    rig.vault.device = null;
    rig.script.start = (connection) => {
      connection.startAnonymous().beatEvery();
    };
    expect(rig.source.reconnect('CREDENTIAL')).toBe(true);
    await flush();
    expect(fake.connections).toHaveLength(2);
    expect(rig.source.link).toBe('ONLINE');
  });
});

describe('pairing on the device (§9.4; MP-5 to MP-7)', () => {
  it('pair: the code and the device description travel; the app stores the credential BEFORE the action settles; the next socket presents it', async () => {
    const rig = device({ paired: false });
    await rig.source.ready;
    await flush();
    expect(fake.connection().principal).toBe('ANONYMOUS');
    fake.answerOnceFromExample('redeemPairingCode', 201, 'paired');
    const redeemed = example<PairingRedeemed>('redeemPairingCode', 201, 'paired');
    const order: string[] = [];
    const result = rig.source.actions.pair('123456').then((value) => {
      order.push(`settled stored=${rig.vault.device !== null}`);
      return value;
    });
    expect(await result).toEqual({ ok: true, pairedAt: redeemed.pairedAt });
    expect(order).toEqual(['settled stored=true']);
    expect(rig.calls).toEqual([`devicePaired ${redeemed.deviceId}`]);
    expect(fake.log.requestsOf('redeemPairingCode')[0]?.body).toEqual({ code: '123456', deviceName: 'Pixel Tablet', platform: 'android', appVersion: '0.2.0' });
    // A redeem carries no credential.
    expect(fake.log.requestsOf('redeemPairingCode')[0]?.headers.authorization).toBeUndefined();
    expect(rig.source.store.getState().pairing).toEqual({
      state: 'PAIRED',
      coreDeviceId: redeemed.core.deviceId,
      coreName: redeemed.core.name,
      certificateFingerprint: redeemed.core.certificateFingerprint,
      pairedAt: redeemed.pairedAt,
      failures: [],
      lockedUntil: null,
    });
    await flush();
    expect(fake.connection().headers.authorization).toBe(`Bearer ${redeemed.deviceCredential}`);
    expect(fake.connection().principal).toBe('DEVICE');
    expectNoSecret(rig, redeemed.deviceCredential);
    // A second pair on a paired tablet answers its pairing and sends nothing.
    const calls = fake.calls.length;
    expect(await rig.source.actions.pair('123456')).toEqual({ ok: true, pairedAt: redeemed.pairedAt });
    expect(fake.calls).toHaveLength(calls);
  });

  it('a refused code resolves with INVALID_CODE and the attempts left; a lock resolves with LOCKED; the pairing slice says FAILED', async () => {
    const rig = device({ paired: false });
    await rig.source.ready;
    fake.answerOnce('redeemPairingCode', refusal(401, 'INVALID_CODE', 'The code was not accepted.', { attemptsRemaining: 2 }));
    expect(await rig.source.actions.pair('000000')).toEqual({ ok: false, reason: 'INVALID_CODE', attemptsRemaining: 2 });
    expect(rig.source.store.getState().pairing).toMatchObject({ state: 'FAILED', lockedUntil: null });
    const lockedUntil = fake.clock.now() + 60_000;
    fake.answerOnce('redeemPairingCode', refusal(423, 'LOCKED', 'Pairing is locked.', { lockedUntil, retryInMs: 60_000 }));
    expect(await rig.source.actions.pair('000000')).toEqual({ ok: false, reason: 'LOCKED', lockedUntil, retryInMs: 60_000 });
    expect(rig.source.store.getState().pairing).toMatchObject({ state: 'FAILED', lockedUntil, failures: [] });
    expect(rig.calls).toEqual([]);
    expect(rig.vault.device).toBeNull();

    fake.answerOnce('redeemPairingCode', rateLimited(20));
    await expect(rig.source.actions.pair('000000')).rejects.toMatchObject({ name: 'LiveTransportError', status: 429, retryAfterSeconds: 20 });
  });

  it('a credential the app could not store rejects the action with a fixed error, never with the app\'s own (CPC1-26)', async () => {
    const failed = new Error('secure storage is not available');
    const rig = device({ paired: false, secrets: { devicePaired: () => Promise.reject(failed) } });
    await rig.source.ready;
    fake.answerOnceFromExample('redeemPairingCode', 201, 'paired');
    const rejection: unknown = await rig.source.actions.pair('123456').catch((error: unknown) => error);
    expect(rejection).not.toBe(failed);
    expect(rejection).toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    expect(rig.reports.filter((report) => report.source === 'live.secrets')).toMatchObject([{ context: { port: 'devicePaired', errorName: 'Error' } }]);
    expect(JSON.stringify(rig.reports)).not.toContain('secure storage is not available');
    expect(rig.source.store.getState().pairing.state).toBe('UNPAIRED');
    expectNoSecret(rig, example<PairingRedeemed>('redeemPairingCode', 201, 'paired').deviceCredential);
  });

  it('the web console has no pairing: `pair` is refused without a request, and `unpair` does nothing', async () => {
    const { source } = web({ signedIn: false });
    await source.ready;
    await flush();
    const calls = fake.calls.length;
    await expect(source.actions.pair('123456')).rejects.toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    await expect(source.actions.unpair()).resolves.toBeUndefined();
    expect(fake.calls).toHaveLength(calls);
    expect(source.store.getState().pairing.state).toBe('UNPAIRED');
  });

  it('unpair: operation 22 with the device credential; then the app deletes its items, the pairing is gone and the socket is anonymous', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    rig.source.setPairing({ core: { deviceId: 'DEMS-IR-01', name: 'Interview Room 1', certificateFingerprint: 'AB:CD' }, pairedAt: 5 });
    fake.answerFromExample('unpairDevice');
    const order: string[] = [];
    await rig.source.actions.unpair().then(() => order.push(`settled deleted=${rig.vault.device === null}`));
    expect(order).toEqual(['settled deleted=true']);
    expect(fake.log.requestsOf('unpairDevice')[0]?.headers.authorization).toBe(`Bearer ${FAKE_CREDENTIALS.deviceCredential}`);
    expect(rig.calls).toEqual(['deviceUnpaired UNPAIR UNPAIRED']);
    expect(rig.ends).toHaveLength(1);
    expect(rig.ends[0]).toMatchObject({ kind: 'DEVICE_REVOKED', reason: 'UNPAIRED', source: 'UNPAIR' });
    expect(rig.source.store.getState().pairing.state).toBe('UNPAIRED');
    await flush();
    expect(fake.connection().principal).toBe('ANONYMOUS');
  });

  it('unpair while the link is down is refused and nothing is deleted (MP-7)', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    rig.source.setPairing({ core: { deviceId: 'DEMS-IR-01', name: 'Interview Room 1', certificateFingerprint: 'AB:CD' }, pairedAt: 5 });
    rig.script.start = () => undefined;
    fake.connection().close(1001);
    expect(rig.source.link).toBe('OFFLINE');
    const calls = fake.calls.length;
    await expect(rig.source.actions.unpair()).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE' });
    expect(fake.calls).toHaveLength(calls);
    expect(rig.calls).toEqual([]);
    expect(rig.vault.device).toBe(FAKE_CREDENTIALS.deviceCredential);
    expect(rig.source.store.getState().pairing.state).toBe('PAIRED');
  });

  it('setPairing fills the client-built slice from the device registration, and null clears it', async () => {
    const { source } = web({ signedIn: false });
    await source.ready;
    source.setPairing({ core: { deviceId: 'DEMS-IR-01', name: 'Interview Room 1', certificateFingerprint: 'AB:CD' }, pairedAt: 1_790_000_000_000 });
    expect(source.store.getState().pairing).toEqual({
      state: 'PAIRED',
      coreDeviceId: 'DEMS-IR-01',
      coreName: 'Interview Room 1',
      certificateFingerprint: 'AB:CD',
      pairedAt: 1_790_000_000_000,
      failures: [],
      lockedUntil: null,
    });
    source.setPairing(null);
    expect(source.store.getState().pairing.state).toBe('UNPAIRED');
  });
});
