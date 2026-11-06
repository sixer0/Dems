// Plan row W44, fix round after checkpoint CP-C1 (decision D80; gateway_check/07_cp_shared_client.md):
// what the Live source does when something around it fails.
//
// | Finding | What is proven here |
// |---------|---------------------|
// | CPC1-2 | A store subscriber that throws, and an answer nobody can read, neither freeze the replica nor cut a session end short |
// | CPC1-1 | One revocation of the device is one end; a credential the app could not delete is asked for again a bounded number of times, with a delay |
// | CPC1-20 | The wait for the app's storage is bounded |
// | CPC1-7 | After `stop()` nothing fires and a late answer changes nothing |
// | CPC1-8 | The session probe backs off, honours `retry-after`; what the gate holds back is bounded |
// | CPC1-9 | A session that was found before the socket said who it is still gets its socket |
// | CPC1-11 | The lock state is read again after `pair` |
//
// Everything runs on the fake transport and the fake clock.
import { afterEach, describe, expect, it } from 'vitest';
import { pickReplicatedState, type ReplicatedState } from '../src/api';
import { createCoreClient } from '../src/client';
import {
  LIVE_DEVICE_CLEANUP_GAVE_UP_CODE,
  LIVE_SETTLE_TIMEOUT_MS,
  createLiveSim,
  type CreateLiveSimOptions,
  type LiveClient,
  type LiveSecretsPort,
  type LiveSessionEnd,
  type LiveSim,
} from '../src/live/source';
import { FAKE_CREDENTIALS, createFakeTransport, rateLimited, type FakeConnection, type FakeTransport } from '../src/live/testing';
import { DEFAULT_SEED, buildScenarioState, createIdleState, selectIsSignedIn, selectLockout, type SimErrorReport, type SimState } from '../src/sim';

// The numbers of the round, as texts of this file on purpose: the tests then fail on the code
// before the round for what that code DOES, not because a constant does not exist there. The
// constants themselves are pinned to these values by test/live-source-platform-neutral.test.ts.
const CLEANUP_RETRY_MS = 2_000;
const CLEANUP_RETRIES = 3;
const HELD_MESSAGES_MAX = 256;
const SECRETS_TIMEOUT_MS = 5_000;

const BASE_URL = 'http://127.0.0.1:4420';
const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const PASSWORD = 'MARKER-PASSWORD-7f3a';

let fake: FakeTransport;
let live: LiveSim | undefined;
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown): void => {
  unhandled.push(reason);
};

afterEach(() => {
  live?.stop();
  live = undefined;
  process.off('unhandledRejection', onUnhandled);
  unhandled.length = 0;
  (fake as FakeTransport | undefined)?.assertNoViolations();
});

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);
const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
};
/** Moves the clock on in small steps and lets the promise jobs run in between. */
const elapse = async (ms: number, step = 250): Promise<void> => {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    fake.clock.advance(Math.min(step, ms - elapsed));
    await flush();
  }
};
/** One real macrotask: the platform reports an unhandled rejection after the promise jobs of a turn. */
const macrotask = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** What became of a Live result, without waiting for it. */
function track(result: Promise<unknown>): { status: 'pending' | 'resolved' | 'rejected'; value: unknown } {
  const outcome: { status: 'pending' | 'resolved' | 'rejected'; value: unknown } = { status: 'pending', value: undefined };
  result.then(
    (value) => Object.assign(outcome, { status: 'resolved', value }),
    (error: unknown) => Object.assign(outcome, { status: 'rejected', value: error }),
  );
  return outcome;
}

interface Rig {
  source: LiveSim;
  reports: SimErrorReport[];
  recording: SimState;
  script: { start(connection: FakeConnection): void };
  operator(): (connection: FakeConnection) => void;
  anonymous(connection: FakeConnection): void;
  ends: LiveSessionEnd[];
}

/** A web console (the browser's own credential, no headers). */
function web(options: { signedIn: boolean; start?: boolean } & Partial<CreateLiveSimOptions<LiveClient>>): Rig {
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
  return { source, reports, recording, script, operator, anonymous, ends };
}

async function signedInWeb(options: Partial<CreateLiveSimOptions<LiveClient>> = {}): Promise<Rig> {
  const rig = web({ signedIn: true, ...options });
  await rig.source.ready;
  expect(rig.source.store.getState().auth.status).toBe('SIGNED_IN');
  return rig;
}

interface DeviceRig extends Rig {
  vault: { device: string | null; session: string | null; socketSession: string | null };
  calls: string[];
}

/**
 * A tablet. `vault` is the app's storage: the typed client reads `session ?? device`, the socket
 * reads `socketSession ?? device`, so a test can let the two disagree (CPC1-9).
 */
function device(options: { paired: boolean; start?: boolean; secrets?: Partial<LiveSecretsPort>; splitSocket?: boolean }): DeviceRig {
  fake = createFakeTransport({ epoch: 3, revision: 40 });
  const recording = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
  const vault: DeviceRig['vault'] = { device: options.paired ? FAKE_CREDENTIALS.deviceCredential : null, session: null, socketSession: null };
  const calls: string[] = [];
  const bearer = (): string | null => vault.session ?? vault.device;
  const socketBearer = (): string | null => (options.splitSocket ? (vault.socketSession ?? vault.device) : bearer());
  const operator = () => (connection: FakeConnection) => {
    connection.startOperator(wire(recording)).beatEvery();
  };
  const anonymous = (connection: FakeConnection): void => {
    connection.startAnonymous().beatEvery();
  };
  const script = {
    start(connection: FakeConnection): void {
      const header = connection.headers.authorization ?? '';
      if (header.startsWith('Bearer ses_')) operator()(connection);
      else if (header.startsWith('Bearer dvc_')) connection.startDevice().beatEvery();
      else anonymous(connection);
    },
  };
  fake.onConnect((connection) => script.start(connection));
  fake.answer('getAuthSession', () => (vault.session ? fake.example('getAuthSession', 200, 'pairedDevice') : fake.example('getAuthSession', 401)));
  fake.answerFromExample('getSignInStatus', 200, 'open');
  const secrets: LiveSecretsPort = {
    sessionIssued: ({ sessionToken }) => {
      calls.push('sessionIssued');
      vault.session = sessionToken;
      vault.socketSession = sessionToken;
    },
    sessionCleared: (end) => {
      calls.push(`sessionCleared ${String(end.reason)}`);
      vault.session = null;
      vault.socketSession = null;
    },
    devicePaired: (redeemed) => {
      calls.push('devicePaired');
      vault.device = redeemed.deviceCredential;
    },
    deviceUnpaired: (end) => {
      calls.push(`deviceUnpaired ${end.source}`);
      vault.device = null;
      vault.session = null;
      vault.socketSession = null;
    },
    ...options.secrets,
  };
  const reports: SimErrorReport[] = [];
  const ends: LiveSessionEnd[] = [];
  const source = createLiveSim({
    client: createCoreClient({ baseUrl: BASE_URL, credentials: bearer, fetch: fake.fetch }),
    socket: { url: SOCKET_URL, factory: fake.socketFactory, headers: () => (socketBearer() ? { Authorization: `Bearer ${socketBearer()}` } : null) },
    secrets,
    device: () => ({ deviceName: 'Pixel Tablet', platform: 'android', appVersion: '0.2.0' }),
    now: fake.clock.now,
    timers: fake.clock.timers,
    random: () => 0,
    onError: (report) => reports.push(report),
    autoStart: options.start ?? true,
  });
  live = source;
  source.onSessionEnd((end) => ends.push(end));
  return { source, reports, recording, script, operator, anonymous, ends, vault, calls };
}

/**
 * The Core as it answers a device whose credential it revoked. Each answer goes by the credential
 * the request itself carried, as a server does: a read that was sent before the app deleted the
 * credential is refused even when its answer arrives after the deletion.
 */
function revoke(rig: DeviceRig): void {
  const presented = (headers: Readonly<Record<string, string>>): boolean => (headers.authorization ?? '').startsWith('Bearer ');
  rig.script.start = (connection) => {
    if (presented(connection.headers)) connection.startAnonymous('DEVICE_REVOKED').close(4403);
    else rig.anonymous(connection);
  };
  fake.answer('getAuthSession', (call) => (presented(call.headers) ? fake.example('getAuthSession', 403, 'deviceRevoked') : fake.example('getAuthSession', 401)));
  fake.answer('getSignInStatus', (call) => (presented(call.headers) ? fake.example('getSignInStatus', 403, 'deviceRevoked') : fake.example('getSignInStatus', 200, 'open')));
}

const bySource = (reports: readonly SimErrorReport[], source: string): SimErrorReport[] => reports.filter((report) => report.source === source);

// ═══════════════════════════════════════════════════════════════════════════════════════
// CPC1-2
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-2: an exception inside a store update, or between a command and its settlement, freezes nothing', () => {
  it('a store subscriber that throws during the session end of a 401 on a command: the end is complete, the gate is free, the action rejects, the subscriber is reported', async () => {
    process.on('unhandledRejection', onUnhandled);
    const { source, reports, ends, script, anonymous } = await signedInWeb();
    fake.answerFromExample('getAuthSession', 401);
    script.start = anonymous;
    const later: string[] = [];
    source.store.subscribe(() => {
      throw new Error('subscriber failed');
    });
    // Subscribed after the one that throws: the store calls its listeners in that order.
    source.store.subscribe((state) => later.push(`${state.auth.status} operators=${state.operators.length}`));

    fake.answerOnceFromExample('addSessionMarker', 401, 'notSignedIn');
    const outcome = track(source.actions.addMarker('Key statement'));
    await flush();
    await macrotask();

    expect(outcome.status).toBe('rejected');
    expect(outcome.value).toMatchObject({ name: 'SimPermissionError', code: 'NOT_SIGNED_IN' });
    // The end was not cut short: the listeners were told, and the socket was reopened.
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ kind: 'SESSION_ENDED', source: 'REST', wasSignedIn: true });
    expect(later).toContain('SIGNED_OUT operators=0');
    expect(fake.connections).toHaveLength(2);
    expect(fake.connection().principal).toBe('ANONYMOUS');
    expect(source.link).toBe('ONLINE');
    // Reported by the names of what changed; no slice content.
    const subscriber = bySource(reports, 'live.subscriber');
    expect(subscriber.length).toBeGreaterThanOrEqual(1);
    expect(subscriber[0]).toMatchObject({ level: 'error', message: 'subscriber failed', context: { errorName: 'Error' } });
    expect(JSON.stringify(subscriber)).not.toContain('OPR-');
    expect(unhandled).toEqual([]);
  });

  it('a subscriber that throws on a delta keeps no other subscriber from the update; one that keeps throwing is reported once a second at most', async () => {
    const { source, reports } = await signedInWeb();
    const seen: string[] = [];
    source.store.subscribe(() => {
      throw new Error('subscriber failed');
    });
    source.store.subscribe(
      (state) => state.tabletLink.state,
      (state) => seen.push(state),
    );
    fake.connection().delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    expect(source.store.getState().tabletLink.state).toBe('OFFLINE');
    expect(seen).toEqual(['OFFLINE']);
    expect(bySource(reports, 'live.subscriber')).toHaveLength(1);
    expect(bySource(reports, 'live.gate')).toEqual([]);

    // The clock slice is published ten times a second: the same failure is not written ten times.
    await elapse(900, 100);
    expect(bySource(reports, 'live.subscriber')).toHaveLength(1);
    await elapse(1_100, 100);
    const all = bySource(reports, 'live.subscriber');
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.length).toBeLessThanOrEqual(3);
    expect(Number(all[1]?.context?.skipped)).toBeGreaterThan(5);
  });

  it('a selector that throws is contained in the same way', async () => {
    const { source, reports } = await signedInWeb();
    const seen: string[] = [];
    source.store.subscribe(
      (state) => {
        if (state.tabletLink.state === 'OFFLINE') throw new Error('selector failed');
        return state.tabletLink.state;
      },
      () => undefined,
    );
    source.store.subscribe(
      (state) => state.tabletLink.state,
      (state) => seen.push(state),
    );
    fake.connection().delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    expect(seen).toEqual(['OFFLINE']);
    expect(bySource(reports, 'live.subscriber')).toMatchObject([{ message: 'selector failed' }]);
  });

  it('an answer the source cannot read (a client that answers outside the contract) leaves the gate: the action rejects, and later state is still applied', async () => {
    process.on('unhandledRejection', onUnhandled);
    fake = createFakeTransport({ epoch: 3, revision: 40 });
    const recording = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
    fake.scriptSignedInStart(wire(recording));
    const real = createCoreClient({ baseUrl: BASE_URL, credentials: 'browser-cookie', fetch: fake.fetch });
    // A success without a body, where the contract says the body names the new epoch.
    const broken = { ok: true, operationId: 'resetDemo', status: 200, data: null, epoch: null, revision: null, requestId: null };
    const client = {
      call: (operationId: string, input: unknown): Promise<unknown> =>
        operationId === 'resetDemo' ? Promise.resolve(broken) : (real.call as (id: string, input: unknown) => Promise<unknown>)(operationId, input),
    };
    const reports: SimErrorReport[] = [];
    const source = createLiveSim({
      client: client as unknown as LiveClient,
      socket: { url: SOCKET_URL, factory: fake.socketFactory },
      now: fake.clock.now,
      timers: fake.clock.timers,
      onError: (report) => reports.push(report),
    });
    live = source;
    await source.ready;
    fake.connection().beatEvery();

    const outcome = track(source.actions.resetDemo());
    await flush();
    await macrotask();
    expect(outcome.status).toBe('rejected');
    expect(outcome.value).toBeInstanceOf(TypeError);
    expect(unhandled).toEqual([]);
    expect(bySource(reports, 'live.action.resetDemo')).toHaveLength(1);

    // The command left the gate: a delta that comes now is applied at once.
    fake.connection().delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    expect(source.store.getState().tabletLink.state).toBe('OFFLINE');
  });

  it('an answer to a question of the source itself that cannot be read is reported and raises no unhandled rejection', async () => {
    process.on('unhandledRejection', onUnhandled);
    fake = createFakeTransport({ epoch: 3, revision: 40 });
    const recording = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
    fake.scriptSignedInStart(wire(recording));
    const real = createCoreClient({ baseUrl: BASE_URL, credentials: 'browser-cookie', fetch: fake.fetch });
    const broken = { ok: true, operationId: 'touchSession', status: 200, data: null, epoch: 3, revision: 40, requestId: null };
    const client = {
      call: (operationId: string, input: unknown): Promise<unknown> =>
        operationId === 'touchSession' ? Promise.resolve(broken) : (real.call as (id: string, input: unknown) => Promise<unknown>)(operationId, input),
    };
    const reports: SimErrorReport[] = [];
    const source = createLiveSim({
      client: client as unknown as LiveClient,
      socket: { url: SOCKET_URL, factory: fake.socketFactory },
      now: fake.clock.now,
      timers: fake.clock.timers,
      onError: (report) => reports.push(report),
    });
    live = source;
    await source.ready;
    fake.connection().beatEvery();

    void source.actions.touch();
    await flush();
    await macrotask();
    expect(unhandled).toEqual([]);
    expect(bySource(reports, 'live.touch')).toMatchObject([{ level: 'error', context: { operationId: 'touchSession' } }]);
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CPC1-1 and CPC1-20
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-1: one revocation of the device is one end, and a credential that stays is not retried without limit', () => {
  it('a cold start with a revoked credential (the probe is refused 403, `hello` names the reason, the socket closes 4403): ONE end, the app told once, no read with the revoked credential, then an anonymous socket', async () => {
    const rig = device({ paired: true, start: false });
    revoke(rig);
    rig.source.start();
    await rig.source.ready;
    await elapse(2_000);
    expect(rig.ends).toHaveLength(1);
    expect(rig.ends[0]).toMatchObject({ kind: 'DEVICE_REVOKED', wasSignedIn: false });
    expect(rig.calls).toEqual([`deviceUnpaired ${rig.ends[0]?.source}`]);
    expect(rig.vault.device).toBeNull();
    expect(fake.connections).toHaveLength(2);
    expect(fake.connection().principal).toBe('ANONYMOUS');
    expect(rig.source.link).toBe('ONLINE');
    // The lock state was read once, as the anonymous client the tablet is now; never with the revoked credential.
    expect(fake.log.requestsOf('getSignInStatus').map((call) => call.headers.authorization)).toEqual([undefined]);
    await elapse(30_000, 1_000);
    expect(rig.ends).toHaveLength(1);
    expect(fake.connections).toHaveLength(2);
  });

  it('device.revoked and the 403 of a request that was in flight are one end', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    const answer = fake.hold('reportBiometricFailure');
    const outcome = track(rig.source.actions.recordBiometricFailure(null));
    await fake.arrived(3);
    fake.connection().deviceRevoked('REVOKED');
    await flush();
    answer.release(fake.example('reportBiometricFailure', 403, 'deviceRevoked'));
    await flush();
    expect(outcome.status).toBe('rejected');
    expect(rig.ends).toHaveLength(1);
    expect(rig.ends[0]).toMatchObject({ kind: 'DEVICE_REVOKED', reason: 'REVOKED', source: 'CONTROL' });
    expect(rig.calls).toEqual(['deviceUnpaired CONTROL']);
  });

  it('a deviceUnpaired that throws and leaves the credential: one end, the storage asked again three times with a growing delay, then one report and a closed socket', async () => {
    const attempts: number[] = [];
    const rig = device({
      paired: true,
      secrets: {
        deviceUnpaired: () => {
          attempts.push(fake.clock.now());
          throw new Error('the protected store failed');
        },
      },
    });
    await rig.source.ready;
    const started = fake.clock.now();
    revoke(rig);
    fake.connection().deviceRevoked('REVOKED');
    await flush();
    // The first reopen presented the credential again, and was refused: nothing more for now.
    expect(rig.ends).toHaveLength(1);
    expect(attempts).toHaveLength(1);
    expect(fake.connections).toHaveLength(2);

    await elapse(60_000);
    // One end, however often the Core said "revoked".
    expect(rig.ends).toHaveLength(1);
    // The storage: once at the end, then after 2 s, 4 s and 8 s.
    expect(attempts.map((at) => at - started)).toEqual([
      0,
      CLEANUP_RETRY_MS,
      CLEANUP_RETRY_MS * 3,
      CLEANUP_RETRY_MS * 7,
    ]);
    expect(attempts).toHaveLength(1 + CLEANUP_RETRIES);
    // The sockets: the first, its reopen, and one per repeat. Then none.
    expect(fake.connections).toHaveLength(2 + CLEANUP_RETRIES);
    expect(rig.source.link).toBe('OFFLINE');
    const secrets = bySource(rig.reports, 'live.secrets');
    // CPC1-26: each failure by the names of the port and of the error, never by the app's text.
    expect(secrets.filter((report) => report.context?.port === 'deviceUnpaired' && report.context.errorName === 'Error')).toHaveLength(1 + CLEANUP_RETRIES);
    expect(JSON.stringify(rig.reports)).not.toContain('the protected store failed');
    // CPC1-30: ONE report says that the clean-up gave up, with a code the app can look for.
    const gaveUp = secrets.filter((report) => report.context?.code === LIVE_DEVICE_CLEANUP_GAVE_UP_CODE);
    expect(gaveUp).toMatchObject([{ level: 'error', context: { code: 'DEVICE_CLEANUP_GAVE_UP', port: 'deviceUnpaired', tries: CLEANUP_RETRIES } }]);
    // And the state the app sees: the link is OFFLINE and the socket ended as revoked.
    expect(rig.source.socketStatus().end?.kind).toBe('DEVICE_REVOKED');
    // No read was repeated with the revoked credential.
    expect(fake.log.requestsOf('getSignInStatus').length).toBeLessThanOrEqual(2);

    // The app deletes the credential and says so: the socket opens, anonymous.
    rig.vault.device = null;
    expect(rig.source.reconnect('CREDENTIAL')).toBe(true);
    await flush();
    expect(fake.connection().principal).toBe('ANONYMOUS');
    expect(rig.source.link).toBe('ONLINE');
    expect(rig.ends).toHaveLength(1);
  });

  it('a new pairing ends the old revocation: a later revocation is a new end', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    fake.connection().deviceRevoked('REVOKED');
    await flush();
    expect(rig.ends).toHaveLength(1);
    expect(fake.connection().principal).toBe('ANONYMOUS');

    fake.answerOnceFromExample('redeemPairingCode', 201, 'paired');
    await rig.source.actions.pair('123456');
    await flush();
    expect(fake.connection().principal).toBe('DEVICE');
    fake.connection().deviceRevoked('UNPAIRED');
    await flush();
    expect(rig.ends).toHaveLength(2);
    expect(rig.ends[1]).toMatchObject({ kind: 'DEVICE_REVOKED', reason: 'UNPAIRED' });
  });

  it.each(['reconnect', 'setPairing'] as const)('the app replaced the credential and says so (%s): a later revocation is a new end', async (how) => {
    const rig = device({ paired: true });
    await rig.source.ready;
    fake.connection().deviceRevoked('REVOKED');
    await flush();
    expect(rig.ends).toHaveLength(1);

    // The app holds a new device credential (it restored its registration by itself).
    rig.vault.device = FAKE_CREDENTIALS.deviceCredential;
    if (how === 'setPairing') rig.source.setPairing({ core: { deviceId: 'DEMS-IR-01', name: 'Interview Room 1', certificateFingerprint: 'AB:CD' }, pairedAt: 5 });
    expect(rig.source.reconnect(how === 'reconnect' ? 'CREDENTIAL' : 'RETRY')).toBe(true);
    await flush();
    expect(fake.connection().principal).toBe('DEVICE');
    fake.connection().deviceRevoked('REVOKED');
    await flush();
    expect(rig.ends).toHaveLength(2);
    expect(rig.calls.filter((entry) => entry.startsWith('deviceUnpaired'))).toHaveLength(2);
  });
});

describe('CPC1-26 / D90: nothing of what the storage of the app throws travels: not into a report, not into a rejection', () => {
  // What a port's own error could hold: the value it failed to store.
  const SECRET = 'MARKER-PORT-SECRET-5d1e';
  const failing = (): never => {
    throw new RangeError(`could not store ${SECRET}`);
  };
  const leaks = (rig: DeviceRig, ...more: unknown[]): boolean => JSON.stringify([rig.reports, rig.source.errors(), rig.ends, ...more.map((value) => (value instanceof Error ? [value.name, value.message, value.stack] : value))]).includes(SECRET);

  it('sessionCleared and deviceUnpaired: reported by port and error name; no message, no stack', async () => {
    const rig = device({ paired: true, secrets: { sessionCleared: failing, deviceUnpaired: failing } });
    await rig.source.ready;
    fake.answerOnceFromExample('signIn', 200, 'pairedDevice');
    await rig.source.actions.signIn('budi.santoso', PASSWORD);
    rig.vault.session = null;
    rig.vault.socketSession = null;
    fake.connection().sessionEnded('USER_DISABLED');
    await flush();
    rig.vault.device = null;
    fake.connection().deviceRevoked('REVOKED');
    await flush();
    const reports = bySource(rig.reports, 'live.secrets');
    expect(reports.map((report) => report.context?.port)).toEqual(['sessionCleared', 'deviceUnpaired']);
    for (const report of reports) {
      expect(report).toMatchObject({ level: 'error', context: { errorName: 'RangeError' } });
      expect(report.message).toBe(`The storage of the app failed in "${String(report.context?.port)}".`);
      expect(report.stack).toBeUndefined();
    }
    expect(leaks(rig)).toBe(false);
  });

  it('sessionIssued: the sign-in rejects with a fixed error; the report of the action and of the port hold no text of the app', async () => {
    const rig = device({ paired: true, secrets: { sessionIssued: failing } });
    await rig.source.ready;
    fake.answerOnceFromExample('signIn', 200, 'pairedDevice');
    const rejection: unknown = await rig.source.actions.signIn('budi.santoso', PASSWORD).catch((error: unknown) => error);
    expect(rejection).toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    expect(bySource(rig.reports, 'live.secrets')).toMatchObject([{ context: { port: 'sessionIssued', errorName: 'RangeError' } }]);
    expect(leaks(rig, rejection)).toBe(false);
    expect(selectIsSignedIn(rig.source.store.getState())).toBe(false);
  });

  it('devicePaired and biometricToken likewise', async () => {
    const pairing = device({ paired: false, secrets: { devicePaired: failing } });
    await pairing.source.ready;
    fake.answerOnceFromExample('redeemPairingCode', 201, 'paired');
    const refused: unknown = await pairing.source.actions.pair('123456').catch((error: unknown) => error);
    expect(refused).toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    expect(bySource(pairing.reports, 'live.secrets')).toMatchObject([{ context: { port: 'devicePaired', errorName: 'RangeError' } }]);
    expect(leaks(pairing, refused)).toBe(false);
    pairing.source.stop();
    fake.assertNoViolations();

    const biometric = device({ paired: true, secrets: { biometricToken: failing } });
    await biometric.source.ready;
    const calls = fake.calls.length;
    const rejected: unknown = await biometric.source.actions.signInWithBiometric('OPR-001').catch((error: unknown) => error);
    expect(rejected).toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    expect(fake.calls).toHaveLength(calls);
    expect(bySource(biometric.reports, 'live.secrets')).toMatchObject([{ context: { port: 'biometricToken', errorName: 'RangeError' } }]);
    expect(leaks(biometric, rejected)).toBe(false);
  });
});

describe('CPC1-20: the wait for the storage of the app is bounded', () => {
  it('a sessionCleared that never answers: given up after 5,000 ms, reported, and the socket is reopened', async () => {
    const rig = device({
      paired: true,
      secrets: {
        sessionCleared: () => {
          // The value is gone; the call just never comes back.
          rig.vault.session = null;
          rig.vault.socketSession = null;
          return new Promise<void>(() => undefined);
        },
      },
    });
    await rig.source.ready;
    fake.answerOnceFromExample('signIn', 200, 'pairedDevice');
    await rig.source.actions.signIn('budi.santoso', PASSWORD);
    const sockets = fake.connections.length;

    fake.connection().sessionEnded('USER_DISABLED');
    await flush();
    expect(rig.ends).toHaveLength(1);
    expect(fake.connections).toHaveLength(sockets);
    fake.clock.advance(SECRETS_TIMEOUT_MS - 1);
    await flush();
    expect(fake.connections).toHaveLength(sockets);
    fake.clock.advance(1);
    await flush();
    expect(fake.connections).toHaveLength(sockets + 1);
    expect(fake.connection().principal).toBe('DEVICE');
    expect(rig.source.link).toBe('ONLINE');
    expect(bySource(rig.reports, 'live.secrets')).toMatchObject([{ level: 'error', context: { port: 'sessionCleared', kind: 'SESSION_ENDED', timedOut: true } }]);
  });

  it('a sessionIssued that never answers: the sign-in rejects after 5,000 ms and the gate is free again', async () => {
    const rig = device({ paired: true, secrets: { sessionIssued: () => new Promise<void>(() => undefined) } });
    await rig.source.ready;
    fake.answerOnceFromExample('signIn', 200, 'pairedDevice');
    const outcome = track(rig.source.actions.signIn('budi.santoso', PASSWORD));
    await flush();
    expect(outcome.status).toBe('pending');
    fake.clock.advance(SECRETS_TIMEOUT_MS);
    await flush();
    expect(outcome.status).toBe('rejected');
    expect(outcome.value).toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    expect(selectIsSignedIn(rig.source.store.getState())).toBe(false);
    expect(bySource(rig.reports, 'live.secrets')).toMatchObject([{ context: { port: 'sessionIssued', timedOut: true } }]);
    // Nothing is held behind that sign-in: the next action goes through.
    fake.answerOnceFromExample('reportBiometricFailure', 200, 'counted');
    await expect(rig.source.actions.recordBiometricFailure(null)).resolves.toMatchObject({ ok: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CPC1-7
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-7: after stop() nothing fires, and a late answer changes nothing', () => {
  it('a command the Core accepted and that waits for its delta resolves inside stop(); no timer is left', async () => {
    const { source } = await signedInWeb();
    const answer = fake.hold('addSessionMarker');
    const outcome = track(source.actions.addMarker('Key statement'));
    await fake.arrived(2);
    answer.release({ status: 204, revision: fake.position.revision + 1 });
    await flush();
    expect(outcome.status).toBe('pending');

    source.stop();
    expect(outcome.status).toBe('resolved');
    await flush();
    expect(fake.clock.pendingTasks).toBe(0);
    const frames = fake.connection().received.length;
    fake.clock.advance(LIVE_SETTLE_TIMEOUT_MS * 3);
    await flush();
    expect(fake.connection().received).toHaveLength(frames);
  });

  it('a command without an answer rejects inside stop() (CORE_OFFLINE, STOPPED); the 401 that arrives afterwards ends no session', async () => {
    const { source, ends, recording } = await signedInWeb();
    const answer = fake.hold('addSessionMarker');
    const outcome = track(source.actions.addMarker('Key statement'));
    await fake.arrived(2);

    source.stop();
    expect(outcome.status).toBe('rejected');
    expect(outcome.value).toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', code: 'STOPPED' });

    answer.release(fake.example('addSessionMarker', 401, 'notSignedIn'));
    await flush();
    // The store keeps what it held; nobody was told of an end.
    expect(ends).toEqual([]);
    expect(source.session).not.toBeNull();
    expect(source.store.getState().evidence).toHaveLength(recording.evidence.length);
    expect(source.lastSessionEnd).toBeNull();
    expect(fake.clock.pendingTasks).toBe(0);
  });

  it('a 403 that arrives after stop() starts no permission refresh', async () => {
    const { source } = await signedInWeb();
    const answer = fake.hold('addSessionMarker');
    void source.actions.addMarker('Key statement').catch(() => undefined);
    await fake.arrived(2);
    source.stop();
    const probes = fake.log.requestsOf('getAuthSession').length;
    answer.release(fake.example('addSessionMarker', 403, 'notPermitted'));
    await flush();
    expect(fake.clock.pendingTasks).toBe(0);
    fake.clock.advance(5_000);
    await flush();
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(probes);
  });

  it('the answer to the session probe that arrives after stop() adopts no session and starts nothing', async () => {
    const { source } = web({ signedIn: true, start: false });
    const probe = fake.hold('getAuthSession');
    source.start();
    await fake.arrived(1);
    source.stop();
    probe.release(fake.example('getAuthSession', 200, 'webConsole'));
    await flush();
    expect(source.session).toBeNull();
    expect(selectIsSignedIn(source.store.getState())).toBe(false);
    expect(fake.clock.pendingTasks).toBe(0);
  });

  it('a sign-in that is out at stop() rejects there; its late answer hands no token to the app', async () => {
    const rig = device({ paired: true });
    await rig.source.ready;
    const answer = fake.hold('signIn');
    const outcome = track(rig.source.actions.signIn('budi.santoso', PASSWORD));
    await fake.arrived(3);
    rig.source.stop();
    expect(outcome.status).toBe('rejected');
    expect(outcome.value).toMatchObject({ name: 'LiveTransportError', code: 'STOPPED' });
    answer.release(fake.example('signIn', 200, 'pairedDevice'));
    await flush();
    expect(rig.calls).toEqual([]);
    expect(rig.vault.session).toBeNull();
    expect(fake.clock.pendingTasks).toBe(0);
    // A new run starts clean.
    rig.source.start();
    await flush();
    expect(rig.source.link).toBe('ONLINE');
    expect(selectIsSignedIn(rig.source.store.getState())).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CPC1-8
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-8: the session probe backs off, honours retry-after, and what is held back is bounded', () => {
  it('with the Core down the probe is repeated after 2 s, 4 s, 8 s, 16 s and then every 30 s', async () => {
    const { source, script } = web({ signedIn: true, start: false });
    script.start = (connection) => {
      connection.refuse();
    };
    fake.fail('getAuthSession');
    const started = fake.clock.now();
    source.start();
    await source.ready;
    await elapse(120_000, 500);
    const at = fake.log.requestsOf('getAuthSession').map((call) => call.at - started);
    expect(at).toEqual([0, 2_000, 6_000, 14_000, 30_000, 60_000, 90_000, 120_000]);
  });

  it('a 429 is not asked again inside its retry-after, also when a new socket says OPERATOR in between', async () => {
    const { source, script, operator } = web({ signedIn: true, start: false });
    script.start = operator();
    fake.answerOnce('getAuthSession', rateLimited(20));
    const started = fake.clock.now();
    source.start();
    await source.ready;
    await flush();
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(1);
    expect(selectIsSignedIn(source.store.getState())).toBe(false);

    // The link is lost and comes back: the new OPERATOR socket does not make the source ask early.
    await elapse(5_000);
    fake.connection().close(1001);
    await elapse(10_000);
    expect(fake.connections.length).toBeGreaterThanOrEqual(2);
    expect(fake.log.requestsOf('getAuthSession')).toHaveLength(1);
    expect(selectIsSignedIn(source.store.getState())).toBe(false);

    await elapse(5_500);
    const calls = fake.log.requestsOf('getAuthSession');
    expect(calls).toHaveLength(2);
    expect((calls[1]?.at ?? 0) - started).toBe(20_000);
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
  });

  it('more than 256 held state messages are dropped, reported, and ONE resync brings the state back when the gate is free', async () => {
    const { source, reports, recording } = web({ signedIn: true, start: false });
    const probe = fake.hold('getAuthSession');
    source.start();
    await fake.arrived(1);
    // The session is not known yet, so everything this socket sends is held back.
    const connection = fake.connection();
    for (let index = 0; index < HELD_MESSAGES_MAX + 20; index += 1) {
      connection.delta([{ op: 'replace', slice: 'activeCameraId', value: index % 2 === 0 ? 'VIDEO-02' : 'VIDEO-01' }]);
    }
    expect(connection.receivedOf('resync')).toHaveLength(0);
    expect(bySource(reports, 'live.gate')).toMatchObject([{ level: 'warn', context: { dropped: HELD_MESSAGES_MAX + 1, limit: HELD_MESSAGES_MAX } }]);

    probe.release(fake.example('getAuthSession', 200, 'webConsole'));
    await flush();
    // Free again: one snapshot is asked for, and until it comes nothing half-built is shown.
    expect(connection.receivedOf('resync')).toHaveLength(1);
    expect(source.store.getState().operators).toEqual([]);
    expect(selectIsSignedIn(source.store.getState())).toBe(false);

    connection.snapshot(wire({ ...recording, activeCameraId: 'VIDEO-02' }));
    await flush();
    expect(selectIsSignedIn(source.store.getState())).toBe(true);
    expect(source.store.getState().activeCameraId).toBe('VIDEO-02');
    expect(source.store.getState().operators).toHaveLength(recording.operators.length);
    expect(connection.receivedOf('resync')).toHaveLength(1);
    expect(bySource(reports, 'live.gate')).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CPC1-9 and CPC1-11
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-9: a session that is found before the socket said who it is still gets its socket', () => {
  it('the probe answers first, then `hello` names DEVICE: one new socket is asked for, and the client is signed in', async () => {
    const rig = device({ paired: true, start: false, splitSocket: true });
    // A cold start: the typed client already presents the session token; the socket was opened with the device credential.
    rig.vault.session = FAKE_CREDENTIALS.sessionToken;
    const accept = rig.script.start;
    rig.script.start = () => undefined;
    rig.source.start();
    await flush();
    expect(rig.source.session).not.toBeNull();
    expect(fake.connections).toHaveLength(1);
    expect(fake.connection().headers.authorization).toBe(`Bearer ${FAKE_CREDENTIALS.deviceCredential}`);

    // By now the app's storage is loaded: the next socket presents the session token.
    rig.vault.socketSession = FAKE_CREDENTIALS.sessionToken;
    rig.script.start = accept;
    fake.connection().startDevice().beatEvery();
    await flush();
    expect(fake.connections).toHaveLength(2);
    expect(fake.connection().principal).toBe('OPERATOR');
    expect(selectIsSignedIn(rig.source.store.getState())).toBe(true);
    expect(rig.reports).toEqual([]);
    await elapse(20_000, 1_000);
    expect(fake.connections).toHaveLength(2);
  });

  it('when the second socket does not carry the session either, that is reported once and nothing loops', async () => {
    const rig = device({ paired: true, start: false, splitSocket: true });
    rig.vault.session = FAKE_CREDENTIALS.sessionToken;
    rig.source.start();
    // No OPERATOR snapshot will come: `ready` resolves at the boot time-out.
    await elapse(20_000, 1_000);
    expect(rig.source.isReady()).toBe(true);
    // The header provider never gives the session token: two sockets, both DEVICE.
    expect(fake.connections).toHaveLength(2);
    expect(fake.connection().principal).toBe('DEVICE');
    expect(selectIsSignedIn(rig.source.store.getState())).toBe(false);
    expect(bySource(rig.reports, 'live.socket')).toMatchObject([{ level: 'error', context: { principal: 'DEVICE' } }]);
  });
});

describe('CPC1-11: the lock state is read again after `pair`', () => {
  it('the view that was read without a device credential is replaced by the one read as this device', async () => {
    const rig = device({ paired: false, start: false });
    // Without a credential the Core answers for the web console, which is locked; this device is not.
    fake.answer('getSignInStatus', () => (rig.vault.device ? fake.example('getSignInStatus', 200, 'open') : fake.example('getSignInStatus', 200, 'locked')));
    rig.source.start();
    await rig.source.ready;
    await flush();
    expect(selectLockout(rig.source.store.getState()).locked).toBe(true);
    const reads = fake.log.requestsOf('getSignInStatus').length;

    fake.answerOnceFromExample('redeemPairingCode', 201, 'paired');
    await rig.source.actions.pair('123456');
    await flush();
    const after = fake.log.requestsOf('getSignInStatus');
    expect(after.length).toBe(reads + 1);
    expect(after.at(-1)?.headers.authorization).toBe(`Bearer ${rig.vault.device}`);
    expect(selectLockout(rig.source.store.getState())).toMatchObject({ locked: false, attemptsRemaining: 5 });
  });
});
