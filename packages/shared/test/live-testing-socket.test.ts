// HB-11, the contract-checked fake transport: its socket half (backend task
// 04_client_integration_spec §12.2, TS-10, TS-12, TS-13; 01_specs §9; plan row W31). The fake socket
// is driven through the REAL heartbeat client (`createHeartbeatClient`), the client whose injected
// socket shape every socket client of the shared package follows. No network, no port; time is the
// fake's clock or the runner's fake timers, never a real timer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_AFTER_MS,
  REALTIME_CLIENT_EXAMPLES,
  REALTIME_CLIENT_MESSAGE_MAX_BYTES,
  REALTIME_CLOSE_CODES,
  REALTIME_SERVER_EXAMPLES,
  REALTIME_SERVER_MESSAGES,
  RECONNECT_BACKOFF_MS,
  RealtimePrincipal,
  WsServerMessageSchema,
  pickReplicatedState,
  realtimeSnapshotExample,
  type ReplicatedState,
  type WsServerMessage,
} from '../src/api';
import {
  ABNORMAL_CLOSURE,
  FAKE_CREDENTIALS,
  FakeMessageViolation,
  FakeSocket,
  FakeSocketMessageError,
  FakeSocketUpgradeError,
  FakeTransportError,
  FakeTransportUsageError,
  FakeUpgradeViolation,
  clockFromTimers,
  createFakeClock,
  createFakeTransport,
  type FakeConnection,
  type FakeSocketEvent,
  type FakeTransport,
} from '../src/live/testing';
import { STALE_CHECK_INTERVAL_MS, createHeartbeatClient, type SocketFactory, type SocketLike } from '../src/realtime/heartbeat-client';
import { DEFAULT_SEED, createIdleState } from '../src/sim';

const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const BEARER = `Bearer ${FAKE_CREDENTIALS.sessionToken}`;

/** A whole replicated state, from the only place one is defined: the simulator (as test/api-realtime.test.ts builds it). */
function idleState(): ReplicatedState {
  const state = createIdleState({ now: createFakeClock().now(), seed: DEFAULT_SEED });
  return pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);
}
const STATE = idleState();

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('nothing was thrown');
}

/** An open socket of a principal, with what its client end received. */
function opened(fake: FakeTransport, principal: RealtimePrincipal | 'ADMIN' = RealtimePrincipal.OPERATOR) {
  const socket = fake.socketFactory(SOCKET_URL);
  const received: unknown[] = [];
  const closes: FakeSocketEvent[] = [];
  socket.onmessage = (event) => received.push(JSON.parse(String(event.data)));
  socket.onclose = (event) => closes.push(event as FakeSocketEvent);
  const connection = fake.connection();
  if (principal === RealtimePrincipal.ANONYMOUS) connection.startAnonymous();
  else if (principal === RealtimePrincipal.DEVICE) connection.startDevice();
  else connection.startOperator(STATE, { admin: principal === 'ADMIN' });
  return { socket, connection, received, closes };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// The real heartbeat client on the fake socket
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('the real heartbeat client on the fake socket', () => {
  let fake: FakeTransport<ReturnType<typeof clockFromTimers>>;

  beforeEach(() => {
    // The heartbeat client takes its clock by injection and its timers from the runtime. The runner
    // fakes those; the fake transport rides on the same fake timers, so one advance moves both.
    vi.useFakeTimers();
    fake = createFakeTransport({
      clock: clockFromTimers({
        now: () => Date.now(),
        setTimeout: (task, ms) => setTimeout(task, ms),
        clearTimeout: (handle) => clearTimeout(handle),
      }),
    });
  });

  function client(onResync?: () => void) {
    // `fake.socketFactory` is passed as it is: it has the shape the client injects.
    const socketFactory: SocketFactory = fake.socketFactory;
    return createHeartbeatClient({
      url: SOCKET_URL,
      socketFactory,
      now: fake.clock.now,
      random: () => 0,
      ...(onResync ? { onResync } : {}),
      onInvalidMessage: () => undefined,
    });
  }

  it('goes CONNECTING → LIVE → STALE → LIVE → OFFLINE → CONNECTING → LIVE, driven by scripted server messages and a close with a code', () => {
    const onResync = vi.fn();
    const heartbeat = client(onResync);
    heartbeat.start();
    expect(fake.connections).toHaveLength(1);
    expect(fake.connection()).toMatchObject({ id: 1, url: SOCKET_URL, state: 'CONNECTING', headers: {}, principal: null });

    fake.connection().startAnonymous().heartbeat();
    expect(heartbeat.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 0, clients: 1, reconnectAttempt: 0, lastBeatAt: Date.now() });

    vi.advanceTimersByTime(HEARTBEAT_STALE_AFTER_MS + STALE_CHECK_INTERVAL_MS);
    expect(heartbeat.getSnapshot().state).toBe('STALE');
    fake.connection().heartbeat();
    expect(heartbeat.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 1 });

    fake.connection().close(1001, 'server shutdown');
    expect(heartbeat.getSnapshot()).toMatchObject({ state: 'OFFLINE', reconnectAttempt: 1 });
    expect(onResync).not.toHaveBeenCalled();

    vi.advanceTimersByTime(RECONNECT_BACKOFF_MS[0]);
    expect(fake.connections).toHaveLength(2);
    expect(heartbeat.getSnapshot().state).toBe('CONNECTING');
    fake.connection().startAnonymous().heartbeat();
    expect(heartbeat.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 2, reconnectAttempt: 0 });
    expect(onResync).toHaveBeenCalledTimes(1);

    heartbeat.stop();
    expect(fake.connection(0)).toMatchObject({ state: 'CLOSED', closed: { by: 'server', code: 1001, reason: 'server shutdown' } });
    expect(fake.connection(1).closed).toEqual({ by: 'client', code: 1000, reason: 'client stopped' });
    fake.assertNoViolations();
  });

  it('a heartbeat series on the clock: one beat per second while the connection is open, with the time of the clock', () => {
    const heartbeat = client();
    heartbeat.start();
    const connection = fake.connection().startAnonymous();
    const stop = connection.beatEvery();
    const start = Date.now();
    vi.advanceTimersByTime(3 * HEARTBEAT_INTERVAL_MS);
    expect(heartbeat.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 2, lastBeatAt: start + 3_000 });
    const beats = connection.sent.filter((message) => (message as WsServerMessage).type === 'heartbeat');
    expect(beats).toMatchObject([
      { seq: 0, serverTime: new Date(start + 1_000).toISOString(), uptimeMs: 0 },
      { seq: 1, serverTime: new Date(start + 2_000).toISOString(), uptimeMs: 1_000 },
      { seq: 2, serverTime: new Date(start + 3_000).toISOString(), uptimeMs: 2_000 },
    ]);
    stop();
    vi.advanceTimersByTime(5 * HEARTBEAT_INTERVAL_MS);
    expect(connection.sent).toHaveLength(4);
    // Without beats the real client turns STALE by itself.
    expect(heartbeat.getSnapshot().state).toBe('STALE');
    expect(() => connection.beatEvery(0)).toThrow(FakeTransportUsageError);
    heartbeat.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the series ends with the connection: a server close, a lost connection and a client close each stop it', () => {
    for (const end of [(connection: FakeConnection) => connection.close(1013), (connection: FakeConnection) => connection.drop(), (connection: FakeConnection) => connection.socket.close(1000)]) {
      fake.socketFactory(SOCKET_URL);
      const connection = fake.connection().startAnonymous();
      connection.beatEvery();
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
      end(connection);
      vi.advanceTimersByTime(3 * HEARTBEAT_INTERVAL_MS);
      expect(connection.sent.filter((message) => (message as WsServerMessage).type === 'heartbeat')).toHaveLength(1);
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a lost connection and a refused upgrade both end in OFFLINE with a reconnect', () => {
    const heartbeat = client();
    heartbeat.start();
    fake.connection().startAnonymous().heartbeat().drop();
    expect(fake.connection().closed).toEqual({ by: 'network', code: ABNORMAL_CLOSURE, reason: '' });
    expect(heartbeat.getSnapshot()).toMatchObject({ state: 'OFFLINE', reconnectAttempt: 1 });
    vi.advanceTimersByTime(RECONNECT_BACKOFF_MS[0]);
    fake.connection().refuse();
    expect(heartbeat.getSnapshot()).toMatchObject({ state: 'OFFLINE', reconnectAttempt: 2 });
    vi.advanceTimersByTime(RECONNECT_BACKOFF_MS[1]);
    expect(fake.connections).toHaveLength(3);
    heartbeat.stop();
  });

  it('a deliberate violation is delivered and the real client drops it; a message that is not the contract is refused before it is sent', () => {
    const dropped: string[] = [];
    const heartbeat = createHeartbeatClient({
      url: SOCKET_URL,
      socketFactory: fake.socketFactory,
      now: fake.clock.now,
      onInvalidMessage: (reason) => dropped.push(reason),
    });
    heartbeat.start();
    const connection = fake.connection().startAnonymous();
    expect(() => connection.send({ type: 'heartbeat', v: 1, seq: -1 })).toThrow(FakeSocketMessageError);
    expect(dropped).toEqual([]);
    connection.send({ type: 'heartbeat', v: 1, seq: -1 }, { violatesContract: true });
    connection.sendRaw('not json');
    expect(dropped).toEqual(['schema mismatch', 'invalid JSON']);
    expect(heartbeat.getSnapshot().state).toBe('CONNECTING');
    expect(connection.frames.map((frame) => [frame.type, frame.deliberate])).toEqual([
      ['hello', false],
      ['heartbeat', true],
      [null, true],
    ]);
    heartbeat.stop();
    fake.assertNoViolations();
  });

  it('a connect script answers every socket the client opens, on a promise job after its handlers are attached', async () => {
    fake.onConnect((connection) => connection.startAnonymous().heartbeat());
    const heartbeat = client();
    heartbeat.start();
    expect(heartbeat.getSnapshot().state).toBe('CONNECTING');
    await Promise.resolve();
    expect(heartbeat.getSnapshot().state).toBe('LIVE');
    fake.connection().close(4408);
    await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    expect(fake.connections).toHaveLength(2);
    expect(heartbeat.getSnapshot()).toMatchObject({ state: 'LIVE', reconnectAttempt: 0 });
    heartbeat.stop();
    fake.assertNoViolations();
  });

  it('an upgrade the contract forbids fails with FakeSocketUpgradeError; the real client swallows it, the fake recorded it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const heartbeat = createHeartbeatClient({ url: `${SOCKET_URL}?token=${FAKE_CREDENTIALS.sessionToken}`, socketFactory: fake.socketFactory, random: () => 0 });
    expect(() => heartbeat.start()).not.toThrow();
    expect(heartbeat.getSnapshot().state).toBe('OFFLINE');
    const [error] = fake.violations;
    expect(error).toBeInstanceOf(FakeSocketUpgradeError);
    expect(error).toMatchObject({ name: 'FakeSocketUpgradeError', reason: FakeUpgradeViolation.CREDENTIAL_IN_URL, issues: ['query.token'] });
    expect(String(error)).not.toContain('FAKE-TRANSPORT');
    expect(fake.log.sockets[0]).toMatchObject({ state: 'CLOSED', closed: { by: 'network', code: null } });
    expect(() => fake.assertNoViolations()).toThrow(FakeSocketUpgradeError);
    heartbeat.stop();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// The manual clock
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('the manual clock: time moves only when the test advances it', () => {
  it('drives the heartbeat series and stamps every frame; no runner timer is involved', () => {
    const fake = createFakeTransport();
    const { connection, received } = opened(fake, RealtimePrincipal.ANONYMOUS);
    const start = fake.clock.now();
    connection.beatEvery();
    expect(fake.clock.pendingTasks).toBe(1);
    fake.clock.advance(2_500);
    expect(received.map((message) => (message as WsServerMessage).type)).toEqual(['hello', 'heartbeat', 'heartbeat']);
    expect(connection.frames.map((frame) => frame.at - start)).toEqual([0, 1_000, 2_000]);
    expect(fake.clock.now()).toBe(start + 2_500);
    connection.close(1001);
    expect(fake.clock.pendingTasks).toBe(0);
  });

  it('its timers run on the clock, for a client that takes timer functions by injection', () => {
    const clock = createFakeClock(1_000);
    const ran: string[] = [];
    const { timers } = clock;
    const once = timers.setTimeout(() => ran.push(`once@${clock.now()}`), 300);
    const cancelled = timers.setTimeout(() => ran.push('cancelled'), 100);
    const every = timers.setInterval(() => ran.push(`every@${clock.now()}`), 200);
    timers.clearTimeout(cancelled);
    clock.advance(650);
    expect(ran).toEqual(['every@1200', 'once@1300', 'every@1400', 'every@1600']);
    timers.clearInterval(every);
    timers.clearTimeout(once);
    clock.advance(1_000);
    expect(ran).toHaveLength(4);
    expect(clock.pendingTasks).toBe(0);
    expect(clock.now()).toBe(2_650);
  });

  it('runs due tasks in time order, lets a task schedule another inside one advance, and refuses a step backwards', () => {
    const clock = createFakeClock(0);
    const ran: number[] = [];
    clock.schedule(30, () => ran.push(clock.now()));
    clock.schedule(10, () => {
      ran.push(clock.now());
      clock.schedule(5, () => ran.push(clock.now()));
    });
    const cancel = clock.schedule(20, () => ran.push(-1));
    cancel();
    clock.advance(30);
    expect(ran).toEqual([10, 15, 30]);
    expect(() => clock.advance(-1)).toThrow(FakeTransportUsageError);
    expect(() => createFakeClock(Number.NaN)).toThrow(FakeTransportUsageError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// The upgrade
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('the upgrade: URL, headers and the forms a socket is opened in', () => {
  it('a constructor of the platform shape: the third argument holds the upgrade headers (the mobile app)', () => {
    const fake = createFakeTransport();
    const socket = new fake.WebSocket(SOCKET_URL, undefined, { headers: { Authorization: BEARER } });
    expect(socket).toBeInstanceOf(fake.WebSocket);
    expect(socket).toBeInstanceOf(FakeSocket);
    expect(socket).toMatchObject({ url: SOCKET_URL, readyState: 0, CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    expect([fake.WebSocket.CONNECTING, fake.WebSocket.OPEN, fake.WebSocket.CLOSING, fake.WebSocket.CLOSED]).toEqual([0, 1, 2, 3]);
    expect(socket.connection).toBe(fake.connection());
    expect(fake.connection().headers).toEqual({ authorization: BEARER });
    fake.connection().accept();
    expect(socket.readyState).toBe(1);
    fake.assertNoViolations();
  });

  it('a factory: headers as the second argument, as an object with headers, or none (the web console)', () => {
    const fake = createFakeTransport();
    fake.socketFactory(SOCKET_URL);
    fake.socketFactory(SOCKET_URL, undefined);
    fake.socketFactory(SOCKET_URL, { Authorization: BEARER });
    fake.socketFactory(SOCKET_URL, { headers: { Authorization: BEARER } });
    fake.socketFactory(SOCKET_URL, undefined, { headers: { Authorization: BEARER } });
    fake.socketFactory(SOCKET_URL, {});
    expect(fake.connections.map((connection) => connection.headers)).toEqual([
      {},
      {},
      { authorization: BEARER },
      { authorization: BEARER },
      { authorization: BEARER },
      {},
    ]);
    expect(fake.connections.map((connection) => connection.id)).toEqual([1, 2, 3, 4, 5, 6]);
    fake.assertNoViolations();
  });

  it('a device credential is a bearer value too; a secure socket URL is accepted', () => {
    const fake = createFakeTransport();
    fake.socketFactory('wss://core.example.test/ws', { Authorization: `Bearer ${FAKE_CREDENTIALS.deviceCredential}` });
    expect(fake.connection().state).toBe('CONNECTING');
    fake.assertNoViolations();
  });

  it.each([
    ['a session token in the query (SR-38)', `${SOCKET_URL}?token=${FAKE_CREDENTIALS.sessionToken}`, [], FakeUpgradeViolation.CREDENTIAL_IN_URL],
    ['a credential as a subprotocol (SR-38)', SOCKET_URL, [FAKE_CREDENTIALS.sessionToken], FakeUpgradeViolation.CREDENTIAL_IN_URL],
    ['a credential in a list of subprotocols', SOCKET_URL, [['dems', FAKE_CREDENTIALS.deviceCredential]], FakeUpgradeViolation.CREDENTIAL_IN_URL],
    ['a user part', 'ws://operator:hunter2@127.0.0.1:4420/ws', [], FakeUpgradeViolation.CREDENTIAL_IN_URL],
    ['a path that is not the socket path', 'ws://127.0.0.1:4420/socket', [], FakeUpgradeViolation.UNKNOWN_ROUTE],
    ['a query the contract does not state', `${SOCKET_URL}?client=web`, [], FakeUpgradeViolation.UNEXPECTED_QUERY],
    ['a scheme that is not a socket scheme', 'http://127.0.0.1:4420/ws', [], FakeUpgradeViolation.INVALID_URL],
    ['a relative URL', '/ws', [], FakeUpgradeViolation.INVALID_URL],
    ['a fragment', `${SOCKET_URL}#x`, [], FakeUpgradeViolation.INVALID_URL],
    ['a bearer value without the form of a token', SOCKET_URL, [{ Authorization: 'Bearer hello' }], FakeUpgradeViolation.INVALID_CREDENTIAL_FORM],
    ['a biometric token as the bearer value', SOCKET_URL, [{ Authorization: `Bearer ${FAKE_CREDENTIALS.biometricToken}` }], FakeUpgradeViolation.INVALID_CREDENTIAL_FORM],
    ['a cookie beside a bearer value (ID-12)', SOCKET_URL, [{ Authorization: BEARER, Cookie: 'dems_session_4420=abc' }], FakeUpgradeViolation.INVALID_CREDENTIAL_FORM],
    ['a header value that is not text', SOCKET_URL, [{ headers: { 'X-Count': 3 } }], FakeUpgradeViolation.INVALID_HEADERS],
  ])('%s is refused: FakeSocketUpgradeError, thrown and recorded, and no value is echoed', (_name, url, rest, reason) => {
    const fake = createFakeTransport();
    const error = thrownBy(() => fake.socketFactory(url, ...rest));
    expect(error).toBeInstanceOf(FakeSocketUpgradeError);
    expect(error).toBeInstanceOf(FakeTransportError);
    expect(error).toMatchObject({ name: 'FakeSocketUpgradeError', reason, operationId: null });
    expect(fake.violations).toEqual([error]);
    expect(String(error)).not.toMatch(/FAKE-TRANSPORT|hunter2|Bearer hello/);
    expect(String(fake.log)).not.toMatch(/FAKE-TRANSPORT|hunter2/);
    // The attempt is in the log, closed; it is no connection a test could script.
    expect(fake.log.sockets).toHaveLength(1);
    expect(fake.log.sockets[0]).toMatchObject({ id: 1, state: 'CLOSED' });
    expect(fake.connections).toEqual([]);
    // The next socket is numbered on, so a socket of the log is never confused with another.
    fake.socketFactory(SOCKET_URL);
    expect(fake.connection().id).toBe(2);
  });

  it('asking for a socket that was never opened is a usage error with a name', () => {
    const fake = createFakeTransport();
    expect(thrownBy(() => fake.connection())).toMatchObject({ name: 'FakeTransportUsageError', reason: 'NO_SOCKET' });
    fake.socketFactory(SOCKET_URL);
    expect(thrownBy(() => fake.connection(3))).toMatchObject({ name: 'FakeTransportUsageError', reason: 'NO_SOCKET' });
    expect(fake.connection(0)).toBe(fake.connection());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Server messages
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('server messages are checked against the realtime union when they are scripted', () => {
  it('every example of the contract can be sent to a principal that may receive it, and arrives as it was written', () => {
    let sent = 0;
    for (const [type, named] of Object.entries(REALTIME_SERVER_EXAMPLES)) {
      for (const example of Object.values(named)) {
        const message = example.value as WsServerMessage;
        const fake = createFakeTransport();
        const socket = fake.socketFactory(SOCKET_URL);
        const received: unknown[] = [];
        socket.onmessage = (event) => received.push(JSON.parse(String(event.data)));
        const connection = fake.connection().accept();
        if (message.type !== 'hello') {
          const principals: readonly RealtimePrincipal[] = REALTIME_SERVER_MESSAGES.find((entry) => entry.type === message.type)?.principals ?? [];
          const principal = principals.includes(RealtimePrincipal.ANONYMOUS) ? RealtimePrincipal.ANONYMOUS : RealtimePrincipal.OPERATOR;
          connection.hello(principal, principal === RealtimePrincipal.OPERATOR ? { topics: ['heartbeat', 'control', 'state', 'meters', 'admin'] } : {});
        }
        connection.send(message);
        expect(received.at(-1), `${type}`).toEqual(message);
        expect(WsServerMessageSchema.safeParse(received.at(-1)).success).toBe(true);
        sent += 1;
      }
    }
    expect(sent).toBeGreaterThanOrEqual(REALTIME_SERVER_MESSAGES.length - 1);
  });

  it('a snapshot of a whole state is sent and arrives; the contract example wrapper is accepted as it is', () => {
    const fake = createFakeTransport();
    const { connection, received } = opened(fake);
    expect(received.map((message) => (message as WsServerMessage).type)).toEqual(['hello', 'snapshot']);
    expect(received[1]).toMatchObject({ type: 'snapshot', epoch: 1, revision: 0, serverTime: fake.clock.now(), state: STATE });
    connection.send(realtimeSnapshotExample(STATE));
    expect(received).toHaveLength(3);
  });

  it.each([
    ['a member the schema refuses', { type: 'heartbeat', v: 1, seq: -1 }, FakeMessageViolation.INVALID_MESSAGE],
    ['an unknown type', { type: 'state.patch', v: 1 }, FakeMessageViolation.INVALID_MESSAGE],
    ['an extra member on a strict message', { type: 'admin.changed', v: 1, resource: 'USERS', rows: [] }, FakeMessageViolation.INVALID_MESSAGE],
    ['a second hello', REALTIME_SERVER_EXAMPLES.hello.operator.value, FakeMessageViolation.HELLO_TWICE],
    ['a topic hello did not give (admin)', REALTIME_SERVER_EXAMPLES['admin.changed'].users.value, FakeMessageViolation.TOPIC_NOT_GIVEN],
  ])('to a signed-in operator, %s is refused: FakeSocketMessageError, thrown by the scripting call', (_name, message, reason) => {
    const fake = createFakeTransport();
    const { connection, received } = opened(fake);
    const before = received.length;
    const error = thrownBy(() => connection.send(message));
    expect(error).toBeInstanceOf(FakeSocketMessageError);
    expect(error).toMatchObject({ name: 'FakeSocketMessageError', reason, direction: 'server', type: message.type });
    expect(received).toHaveLength(before);
    // Thrown into the test body: nothing to record, nothing in the log.
    expect(fake.violations).toEqual([]);
    expect(connection.frames).toHaveLength(before);
  });

  it('the issues of a refused server message name the members, as path and finding', () => {
    const fake = createFakeTransport();
    const { connection } = opened(fake);
    const error = thrownBy(() => connection.send({ type: 'session.ended', v: 1, reason: 'BORED' })) as FakeSocketMessageError;
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toMatch(/^reason: /);
    expect(error.message).toContain('"session.ended"');
    expect(error.message).toContain('violatesContract');
  });

  it.each([
    ['a snapshot to an anonymous connection', RealtimePrincipal.ANONYMOUS, realtimeSnapshotExample(STATE)],
    ['a delta to a paired device', RealtimePrincipal.DEVICE, REALTIME_SERVER_EXAMPLES.delta.tabletConnected.value],
    ['session.updated to a paired device', RealtimePrincipal.DEVICE, REALTIME_SERVER_EXAMPLES['session.updated'].roleChanged.value],
    ['device.revoked to an anonymous connection', RealtimePrincipal.ANONYMOUS, REALTIME_SERVER_EXAMPLES['device.revoked'].revoked.value],
    ['meters to an anonymous connection', RealtimePrincipal.ANONYMOUS, REALTIME_SERVER_EXAMPLES.meters.speaking.value],
  ])('%s is something the Core server never sends (SR-40): refused', (_name, principal, message) => {
    const fake = createFakeTransport();
    const { connection } = opened(fake, principal);
    expect(thrownBy(() => connection.send(message))).toMatchObject({
      name: 'FakeSocketMessageError',
      reason: FakeMessageViolation.NOT_FOR_PRINCIPAL,
      direction: 'server',
    });
    expect(() => connection.send(message, { violatesContract: true })).not.toThrow();
  });

  it('hello comes first: any other message before it is refused, and a hello that does not fit its principal is no hello', () => {
    const fake = createFakeTransport();
    fake.socketFactory(SOCKET_URL);
    const connection = fake.connection().accept();
    expect(thrownBy(() => connection.heartbeat())).toMatchObject({ reason: FakeMessageViolation.HELLO_FIRST });
    expect(thrownBy(() => connection.hello(RealtimePrincipal.ANONYMOUS, { topics: ['heartbeat', 'state'] }))).toMatchObject({
      reason: FakeMessageViolation.INVALID_MESSAGE,
    });
    expect(thrownBy(() => connection.hello(RealtimePrincipal.OPERATOR, { reason: 'SESSION_INVALID' }))).toMatchObject({
      reason: FakeMessageViolation.INVALID_MESSAGE,
    });
    expect(connection.principal).toBeNull();
    connection.hello(RealtimePrincipal.ANONYMOUS, { reason: 'SESSION_INVALID' });
    expect(connection).toMatchObject({ principal: 'ANONYMOUS', topics: ['heartbeat'] });
  });

  it('nothing can be sent on a socket that is not open: before the upgrade is accepted, after a close', () => {
    const fake = createFakeTransport();
    fake.socketFactory(SOCKET_URL);
    const connection = fake.connection();
    for (const script of [() => connection.hello(RealtimePrincipal.ANONYMOUS), () => connection.sendRaw('x'), () => connection.close(1001)]) {
      expect(thrownBy(script)).toMatchObject({ name: 'FakeSocketMessageError', reason: FakeMessageViolation.NOT_OPEN, direction: 'server' });
    }
    connection.startAnonymous().close(1001);
    expect(thrownBy(() => connection.heartbeat())).toMatchObject({ reason: FakeMessageViolation.NOT_OPEN });
    expect(thrownBy(() => connection.accept())).toMatchObject({ name: 'FakeTransportUsageError' });
    expect(thrownBy(() => connection.refuse())).toMatchObject({ name: 'FakeTransportUsageError' });
    expect(connection.drop()).toBe(connection);
  });

  it('messages built by the fake carry its clock and its position; a delta moves the position on', () => {
    const fake = createFakeTransport({ epoch: 3, revision: 128 });
    const { connection, received } = opened(fake, 'ADMIN');
    expect(received[0]).toMatchObject({
      type: 'hello',
      connectionId: 'fake-connection-1',
      epoch: 3,
      principal: 'OPERATOR',
      topics: ['heartbeat', 'control', 'state', 'meters', 'admin'],
      serverTime: fake.clock.now(),
      heartbeatIntervalMs: 1000,
    });
    expect(received[1]).toMatchObject({ type: 'snapshot', epoch: 3, revision: 128 });
    const ops = REALTIME_SERVER_EXAMPLES.delta.tabletConnected.value.ops;
    connection.delta(ops);
    expect(received[2]).toMatchObject({ type: 'delta', epoch: 3, revision: 129, ops });
    expect(fake.position).toEqual({ epoch: 3, revision: 129 });
    connection.delta(ops, { revision: 140 });
    expect(fake.position.revision).toBe(140);
    fake.startEpoch();
    connection.snapshot(STATE);
    expect(received.at(-1)).toMatchObject({ type: 'snapshot', epoch: 4, revision: 0 });
    connection.meters(REALTIME_SERVER_EXAMPLES.meters.speaking.value.audio).meters(REALTIME_SERVER_EXAMPLES.meters.speaking.value.audio);
    expect(received.slice(-2)).toMatchObject([
      { type: 'meters', seq: 0, at: fake.clock.now() },
      { type: 'meters', seq: 1 },
    ]);
    connection.heartbeat({ sessionState: 'RECORDING' });
    expect(received.at(-1)).toMatchObject({ type: 'heartbeat', sessionState: 'RECORDING', clients: 1 });
    // A delta the union refuses does not move the position.
    expect(() => connection.delta([])).toThrow(FakeSocketMessageError);
    expect(fake.position).toEqual({ epoch: 4, revision: 0 });
  });

  it('the four control messages: the two that end a connection are followed by their close code', () => {
    const fake = createFakeTransport();
    const first = opened(fake, 'ADMIN');
    first.connection.sessionUpdated({ id: 'OPR-001', role: 'TECHNICIAN' }, ['EVIDENCE_VIEW', 'DEVICE_MANAGE']).adminChanged('USERS');
    expect(first.received.slice(-2)).toEqual([
      { type: 'session.updated', v: 1, operator: { id: 'OPR-001', role: 'TECHNICIAN' }, permissions: ['EVIDENCE_VIEW', 'DEVICE_MANAGE'], reason: 'ROLE_CHANGED' },
      { type: 'admin.changed', v: 1, resource: 'USERS' },
    ]);
    first.connection.sessionEnded('IDLE_EXPIRED');
    expect(first.received.at(-1)).toEqual({ type: 'session.ended', v: 1, reason: 'IDLE_EXPIRED' });
    expect(first.closes).toMatchObject([{ code: 4401, wasClean: true }]);
    expect(first.connection.closed).toEqual({ by: 'server', code: 4401, reason: '' });

    const device = opened(fake, RealtimePrincipal.DEVICE);
    device.connection.deviceRevoked('REVOKED');
    expect(device.received.at(-1)).toEqual({ type: 'device.revoked', v: 1, reason: 'REVOKED' });
    expect(device.closes).toMatchObject([{ code: 4403 }]);
    expect(device.socket.readyState).toBe(3);
    fake.assertNoViolations();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Closing
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('closing a connection', () => {
  it('the server closes with every code the contract lists; any other code is refused unless it is the test', () => {
    for (const { code } of REALTIME_CLOSE_CODES) {
      const fake = createFakeTransport();
      const { connection, closes } = opened(fake, RealtimePrincipal.ANONYMOUS);
      connection.close(code, 'why');
      expect(closes).toMatchObject([{ type: 'close', code, reason: 'why', wasClean: true }]);
      expect(connection).toMatchObject({ state: 'CLOSED', closed: { by: 'server', code, reason: 'why' } });
    }
    const fake = createFakeTransport();
    const { connection, closes } = opened(fake, RealtimePrincipal.ANONYMOUS);
    for (const code of [1000, 1006, 4000]) {
      expect(thrownBy(() => connection.close(code))).toMatchObject({
        name: 'FakeSocketMessageError',
        reason: FakeMessageViolation.UNDOCUMENTED_CLOSE_CODE,
        direction: 'server',
      });
    }
    expect(connection.state).toBe('OPEN');
    connection.close(4000, '', { violatesContract: true });
    expect(closes).toMatchObject([{ code: 4000 }]);
  });

  it('a lost connection reports an error, then an abnormal close', () => {
    const fake = createFakeTransport();
    const { socket, connection } = opened(fake, RealtimePrincipal.ANONYMOUS);
    const events: string[] = [];
    socket.onerror = () => events.push('error');
    socket.onclose = (event) => events.push(`close ${event.code}`);
    connection.drop();
    expect(events).toEqual(['error', `close ${ABNORMAL_CLOSURE}`]);
    expect(socket.readyState).toBe(3);
  });

  it('the client closes: CLOSING at once, the close event on a promise job, as a platform socket delivers it', async () => {
    const fake = createFakeTransport();
    const { socket, connection, closes } = opened(fake, RealtimePrincipal.ANONYMOUS);
    socket.close(1000, 'client stopped');
    expect(socket.readyState).toBe(2);
    expect(connection).toMatchObject({ state: 'CLOSING', closed: { by: 'client', code: 1000, reason: 'client stopped' } });
    expect(closes).toEqual([]);
    socket.close(1000);
    await Promise.resolve();
    expect(socket.readyState).toBe(3);
    expect(closes).toMatchObject([{ code: 1000, reason: 'client stopped', wasClean: true }]);
    socket.close();
    await Promise.resolve();
    expect(closes).toHaveLength(1);

    const other = opened(fake, RealtimePrincipal.ANONYMOUS);
    other.socket.close();
    await Promise.resolve();
    expect(other.closes).toMatchObject([{ code: 1005 }]);
    expect(other.connection.closed).toEqual({ by: 'client', code: null, reason: '' });
    fake.assertNoViolations();
  });

  it('a close code a socket does not accept from its client is refused: thrown and recorded', () => {
    const fake = createFakeTransport();
    const { socket, connection } = opened(fake, RealtimePrincipal.ANONYMOUS);
    for (const code of [1001, 2999, 5000, 4401.5]) {
      expect(thrownBy(() => socket.close(code))).toMatchObject({
        name: 'FakeSocketMessageError',
        reason: FakeMessageViolation.INVALID_CLOSE_CODE,
        direction: 'client',
      });
    }
    expect(connection.state).toBe('OPEN');
    expect(fake.violations).toHaveLength(4);
    expect(() => socket.close(3000)).not.toThrow();
    expect(() => socket.close(4999)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Client messages
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('client messages are checked against the client union when the client sends them', () => {
  it('every client example of the contract passes on an operator connection and is kept for the test to read', () => {
    const fake = createFakeTransport();
    const { socket, connection } = opened(fake);
    const examples = Object.values(REALTIME_CLIENT_EXAMPLES).flatMap((named) => Object.values(named).map((example) => example.value));
    expect(examples.length).toBeGreaterThanOrEqual(3);
    for (const message of examples) socket.send(JSON.stringify(message));
    expect(connection.received).toEqual(examples);
    expect(connection.receivedOf('resync')).toEqual([{ type: 'resync' }]);
    expect(connection.receivedOf('subscribe')).toEqual([{ type: 'subscribe', topic: 'meters' }]);
    expect(connection.sent.map((message) => (message as WsServerMessage).type)).toEqual(['hello', 'snapshot']);
    expect(connection.frames.slice(-3).map((frame) => [frame.direction, frame.type, typeof frame.data])).toEqual([
      ['client', 'subscribe', 'string'],
      ['client', 'unsubscribe', 'string'],
      ['client', 'resync', 'string'],
    ]);
    fake.assertNoViolations();
  });

  it.each([
    ['text that is not JSON', 'resync', FakeMessageViolation.NOT_JSON],
    ['an unknown type', JSON.stringify({ type: 'ping' }), FakeMessageViolation.INVALID_MESSAGE],
    ['a member the union does not have (a token authenticates nothing, SR-38)', JSON.stringify({ type: 'resync', token: 'x' }), FakeMessageViolation.INVALID_MESSAGE],
    ['a topic a client may not ask for', JSON.stringify({ type: 'subscribe', topic: 'admin' }), FakeMessageViolation.INVALID_MESSAGE],
    ['a frame that is not text', { type: 'resync' }, FakeMessageViolation.NOT_TEXT],
    ['a frame above the size limit (RT-P4)', JSON.stringify({ type: 'resync', pad: 'x'.repeat(REALTIME_CLIENT_MESSAGE_MAX_BYTES) }), FakeMessageViolation.TOO_LARGE],
  ])('%s is refused: FakeSocketMessageError, thrown by send and recorded', (_name, data, reason) => {
    const fake = createFakeTransport();
    const { socket, connection } = opened(fake);
    const error = thrownBy(() => socket.send(data));
    expect(error).toBeInstanceOf(FakeSocketMessageError);
    expect(error).toMatchObject({ name: 'FakeSocketMessageError', reason, direction: 'client' });
    expect(fake.violations).toEqual([error]);
    // What the client sent is in the log, so a failed test shows it.
    expect(connection.frames.at(-1)).toMatchObject({ direction: 'client', data });
    expect(() => fake.assertNoViolations()).toThrow(FakeSocketMessageError);
  });

  it('the issues of a refused client message are paths with issue codes, never a value', () => {
    const fake = createFakeTransport();
    const { socket } = opened(fake);
    const error = thrownBy(() => socket.send(JSON.stringify({ type: 'subscribe', topic: FAKE_CREDENTIALS.sessionToken }))) as FakeSocketMessageError;
    expect(error.issues).toEqual(['topic: invalid_value']);
    expect(String(error)).not.toContain('FAKE-TRANSPORT');
  });

  it.each([RealtimePrincipal.ANONYMOUS, RealtimePrincipal.DEVICE])('a %s connection may send nothing: the Core server would close it with 1008', (principal) => {
    const fake = createFakeTransport();
    const { socket } = opened(fake, principal);
    expect(thrownBy(() => socket.send(JSON.stringify({ type: 'resync' })))).toMatchObject({
      reason: FakeMessageViolation.NOT_FOR_PRINCIPAL,
      direction: 'client',
      type: 'resync',
    });
    expect(fake.violations).toHaveLength(1);
  });

  it('sending while the socket connects is refused; what is sent after a close is discarded, as a platform socket does', async () => {
    const fake = createFakeTransport();
    const socket = fake.socketFactory(SOCKET_URL);
    expect(thrownBy(() => socket.send(JSON.stringify({ type: 'resync' })))).toMatchObject({ reason: FakeMessageViolation.NOT_OPEN, direction: 'client' });
    const connection = fake.connection().startOperator(STATE);
    connection.close(1001);
    socket.send(JSON.stringify({ type: 'resync' }));
    expect(connection.received).toEqual([]);
    expect(fake.violations).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Events and connect scripts
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('events and connect scripts', () => {
  it('addEventListener and the on-handlers both receive open, message, error and close; a removed listener receives nothing', () => {
    const fake = createFakeTransport();
    const socket: SocketLike & FakeSocket = fake.socketFactory(SOCKET_URL);
    const seen: string[] = [];
    const onMessage = (event: FakeSocketEvent) => seen.push(`listener ${event.type} ${typeof event.data}`);
    const removed = () => seen.push('removed');
    socket.onopen = () => seen.push('onopen');
    socket.addEventListener('open', (event) => seen.push(`listener ${event.type} ${event.target === socket}`));
    socket.addEventListener('message', onMessage);
    socket.addEventListener('message', removed);
    socket.removeEventListener('message', removed);
    socket.addEventListener('error', (event) => seen.push(event.type));
    socket.addEventListener('close', (event) => seen.push(`${event.type} ${event.code} ${event.wasClean}`));
    fake.connection().startAnonymous().drop();
    expect(seen).toEqual(['onopen', 'listener open true', 'listener message string', 'error', 'close 1006 false']);
  });

  it('connect scripts run once per socket, in the order they were added; runPendingConnects runs them now', () => {
    const fake = createFakeTransport();
    const order: string[] = [];
    const remove = fake.onConnect((connection) => order.push(`first ${connection.id}`));
    fake.onConnect((connection) => connection.startAnonymous());
    fake.socketFactory(SOCKET_URL);
    expect(fake.connection().state).toBe('CONNECTING');
    fake.runPendingConnects();
    fake.runPendingConnects();
    expect(order).toEqual(['first 1']);
    expect(fake.connection()).toMatchObject({ state: 'OPEN', principal: 'ANONYMOUS' });
    remove();
    fake.socketFactory(SOCKET_URL);
    fake.runPendingConnects();
    expect(order).toEqual(['first 1']);
    expect(fake.connection().principal).toBe('ANONYMOUS');
  });

  it('a connect script that scripts what the Core server may not send: thrown by runPendingConnects, recorded on a promise job', async () => {
    const fake = createFakeTransport();
    fake.onConnect((connection) => connection.accept().heartbeat());
    fake.socketFactory(SOCKET_URL);
    expect(() => fake.runPendingConnects()).toThrow(FakeSocketMessageError);
    expect(fake.violations).toEqual([]);

    fake.socketFactory(SOCKET_URL);
    await Promise.resolve();
    expect(fake.violations).toHaveLength(1);
    expect(fake.violations[0]).toMatchObject({ name: 'FakeSocketMessageError', reason: FakeMessageViolation.HELLO_FIRST });

    fake.reset();
    fake.onConnect(() => {
      throw new RangeError('script broke');
    });
    fake.socketFactory(SOCKET_URL);
    await Promise.resolve();
    expect(fake.violations[0]).toMatchObject({ name: 'FakeTransportUsageError' });
    expect(fake.violations[0]?.message).toContain('script broke');
  });

  it('a socket that is no fake socket of a transport is refused by name', () => {
    const stray = Object.create(FakeSocket.prototype) as FakeSocket;
    expect(thrownBy(() => stray.readyState)).toMatchObject({ name: 'FakeTransportUsageError' });
  });
});
