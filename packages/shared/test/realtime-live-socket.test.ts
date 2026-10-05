// Plan row W30 (blueprint step 52): the Live socket client (04_client_integration_spec §2.2, CL-7 to
// CL-11b; 01_specs §9; AC-C-15, AC-C-16). Every test drives the client with a fake socket and a
// manual clock that also owns the timers, so "no timer left" is counted, not assumed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HEARTBEAT_STALE_AFTER_MS,
  REALTIME_CLIENT_MESSAGE_LIMIT,
  REALTIME_RESYNC_MIN_INTERVAL_MS,
  RECONNECT_BACKOFF_MS,
  RECONNECT_JITTER_MS,
} from '../src/api/constants';
import { EXAMPLE_INSTANT_MS } from '../src/api/example-parts';
import { REALTIME_SERVER_EXAMPLES } from '../src/api/realtime-examples';
import {
  RealtimeCloseCode,
  WsClientMessageSchema,
  WsServerMessageSchema,
  type DeltaMessage,
  type DeviceRevokedMessage,
  type Heartbeat,
  type HelloMessage,
  type MetersMessage,
  type SessionEndedMessage,
  type SnapshotMessage,
} from '../src/api/realtime-messages';
import { pickReplicatedState, type ReplicatedState } from '../src/api/state-slices';
import { createHeartbeatClient, type HeartbeatClient, type SocketLike } from '../src/realtime/heartbeat-client';
import {
  LIVE_SOCKET_ERROR_SOURCE,
  LIVE_SOCKET_RESYNC_GUARD_MS,
  LIVE_SOCKET_SEND_BUDGET,
  LIVE_SOCKET_SYNC_TIMEOUT_MS,
  LiveSocketUsageError,
  createLiveSocketClient,
  type LiveSocketClientOptions,
  type LiveSocketEnd,
  type LiveSocketErrorReport,
  type LiveSocketHeaders,
  type LiveSocketHeadersProvider,
  type LiveSocketLike,
  type LiveSocketTimers,
} from '../src/realtime/live-socket-client';
import * as realtimeIndex from '../src/realtime';
import { DEFAULT_SEED } from '../src/sim/constants';
import { createIdleState } from '../src/sim/initial-state';

// ── The fake socket ──────────────────────────────────────────────────────────────────────────────

class FakeSocket implements LiveSocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  /** Text frames the client sent, in order. */
  readonly frames: string[] = [];
  /** When each frame was sent, on the manual clock. */
  readonly frameTimes: number[] = [];
  closedWith: { code: number | undefined; reason: string | undefined } | null = null;
  failSend = false;
  readonly url: string;
  readonly headers: LiveSocketHeaders | undefined;
  private readonly clock: () => number;

  constructor(url: string, headers: LiveSocketHeaders | undefined, clock: () => number) {
    this.url = url;
    this.headers = headers;
    this.clock = clock;
  }

  send(data: string): void {
    if (this.failSend) throw new TypeError('the socket is not open');
    this.frames.push(data);
    this.frameTimes.push(this.clock());
  }

  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason };
    this.readyState = 3;
  }

  /** The server sends one message. */
  deliver(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  /** The server sends a frame as it is. */
  raw(data: unknown): void {
    this.onmessage?.({ data });
  }

  /** The server (or the network) closes the connection. */
  serverClose(code?: number): void {
    this.readyState = 3;
    this.onclose?.(code === undefined ? {} : { code });
  }

  fail(): void {
    this.onerror?.({});
  }

  /** The client messages sent so far, parsed with the contract's schema. */
  sent(): { type: string; topic?: string }[] {
    return this.frames.map((frame) => WsClientMessageSchema.parse(JSON.parse(frame)));
  }

  /** True while the client holds this socket: it has not closed it and still listens to it. */
  held(): boolean {
    return this.closedWith === null && this.onmessage !== null;
  }
}

// ── The manual clock, which also owns the timers ─────────────────────────────────────────────────

interface ManualTimer {
  at: number;
  every: number | null;
  run: () => void;
}

function manualClock(start: number) {
  let nowMs = start;
  let nextId = 1;
  const pending = new Map<number, ManualTimer>();
  /** The delay of every `setTimeout`, in call order: the reconnect delays. */
  const timeouts: number[] = [];
  const timers: LiveSocketTimers = {
    setTimeout(run, delayMs) {
      const id = nextId++;
      pending.set(id, { at: nowMs + delayMs, every: null, run });
      timeouts.push(delayMs);
      return id;
    },
    clearTimeout(handle) {
      pending.delete(handle as number);
    },
    setInterval(run, intervalMs) {
      const id = nextId++;
      pending.set(id, { at: nowMs + intervalMs, every: intervalMs, run });
      return id;
    },
    clearInterval(handle) {
      pending.delete(handle as number);
    },
  };
  function advance(ms: number): void {
    const until = nowMs + ms;
    for (;;) {
      let dueId: number | null = null;
      let due: ManualTimer | null = null;
      for (const [id, timer] of pending) {
        if (timer.at <= until && (due === null || timer.at < due.at)) {
          dueId = id;
          due = timer;
        }
      }
      if (dueId === null || due === null) break;
      nowMs = due.at;
      if (due.every === null) pending.delete(dueId);
      else due.at += due.every;
      due.run();
    }
    nowMs = until;
  }
  return {
    now: () => nowMs,
    timers,
    advance,
    timeouts,
    pending: () => pending.size,
    pendingTimeouts: () => [...pending.values()].filter((timer) => timer.every === null).length,
  };
}

// ── Messages ─────────────────────────────────────────────────────────────────────────────────────

const T0 = EXAMPLE_INSTANT_MS;
const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const EPOCH = 3;
const HOUSEKEEPING_MS = 500;
/** The earliest moment a second `resync` may leave. */
const RESYNC_SPACING_MS = REALTIME_RESYNC_MIN_INTERVAL_MS + LIVE_SOCKET_RESYNC_GUARD_MS;

/** A real state of the simulator in its wire form: the 28 replicated slices. */
const STATE: ReplicatedState = pickReplicatedState(JSON.parse(JSON.stringify(createIdleState({ now: T0, seed: DEFAULT_SEED }))) as ReplicatedState);

const HELLO = REALTIME_SERVER_EXAMPLES.hello;
const OPERATOR: HelloMessage = HELLO.operator.value;
const SUPERVISOR: HelloMessage = HELLO.supervisor.value;
const DEVICE: HelloMessage = HELLO.device.value;
const ANONYMOUS: HelloMessage = HELLO.anonymous.value;
const SESSION_INVALID: HelloMessage = HELLO.sessionInvalid.value;
const DEVICE_REVOKED: HelloMessage = HELLO.deviceRevoked.value;

const snapshot = (revision: number, epoch = EPOCH): SnapshotMessage => ({ type: 'snapshot', v: 1, epoch, revision, serverTime: T0, state: STATE });

const delta = (revision: number, epoch = EPOCH): DeltaMessage => ({
  type: 'delta',
  v: 1,
  epoch,
  revision,
  serverTime: T0,
  ops: [{ op: 'replace', slice: 'tabletLink', value: { state: 'CONNECTED', changedAt: T0 } }],
});

const meters = (seq: number): MetersMessage => ({ ...REALTIME_SERVER_EXAMPLES.meters.speaking.value, seq });

const beat = (seq: number, at = T0): Heartbeat => ({
  type: 'heartbeat',
  v: 1,
  seq,
  serverTime: new Date(at).toISOString(),
  uptimeMs: seq * 1000,
  intervalMs: 1000,
  clients: 1,
  sessionState: null,
});

/** A valid row of the `events` slice: the one of the contract's delta example. */
const EVENT_ROW = REALTIME_SERVER_EXAMPLES.delta.tabletConnected.value.ops.flatMap((op) => (op.op === 'append' ? op.rows : []))[0];

const SESSION_ENDED = REALTIME_SERVER_EXAMPLES['session.ended'];
const DEVICE_REVOKED_MESSAGE = REALTIME_SERVER_EXAMPLES['device.revoked'];

// ── The harness ──────────────────────────────────────────────────────────────────────────────────

function harness(options: Partial<LiveSocketClientOptions> = {}) {
  const clock = manualClock(T0);
  const sockets: FakeSocket[] = [];
  /** Every handler call, in order. */
  const log: string[] = [];
  const errors: LiveSocketErrorReport[] = [];
  const ends: LiveSocketEnd[] = [];
  const client = createLiveSocketClient({
    url: SOCKET_URL,
    socketFactory: (url, headers) => {
      const socket = new FakeSocket(url, headers, clock.now);
      sockets.push(socket);
      return socket;
    },
    now: clock.now,
    random: () => 0,
    timers: clock.timers,
    onHello: (hello, info) => log.push(`hello:${hello.principal}#${info.connection}`),
    onSnapshot: (message, info) => log.push(`snapshot:${message.epoch}/${message.revision}:${info.cause}`),
    onDelta: (message) => log.push(`delta:${message.epoch}/${message.revision}`),
    onMeters: (message) => log.push(`meters:${message.seq}`),
    onControl: (message) => log.push(`control:${message.type}`),
    onLinkChange: (link, previous) => log.push(`link:${previous}>${link}`),
    onResync: (event) => log.push(`resync:${event.phase}:${event.cause}`),
    onEnd: (end) => {
      ends.push(end);
      log.push(`end:${end.kind}`);
    },
    onError: (report) => errors.push(report),
    ...options,
  });
  const socket = (index = sockets.length - 1): FakeSocket => {
    const found = sockets[index];
    if (!found) throw new Error(`no socket ${index}`);
    return found;
  };
  /** Takes the log and empties it. */
  const take = (): string[] => log.splice(0, log.length);
  /** Start, an OPERATOR `hello`, and the snapshot at revision 10. */
  const online = (hello: HelloMessage = OPERATOR): FakeSocket => {
    client.start();
    socket().deliver(hello);
    socket().deliver(snapshot(10));
    return socket();
  };
  const resyncsOf = (target: FakeSocket) => target.sent().filter((message) => message.type === 'resync').length;
  /** Lets time pass while the server keeps sending its 1 Hz heartbeat, so the link does not turn STALE. */
  let beats = 0;
  const advanceAlive = (ms: number): void => {
    for (let left = ms; left > 0; left -= 1_000) {
      if (socket().held()) socket().deliver(beat((beats += 1), clock.now()));
      clock.advance(Math.min(left, 1_000));
    }
  };
  return { client, clock, sockets, socket, log, take, errors, ends, online, resyncsOf, advanceAlive };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Connect, hello, subscribe, snapshot, deltas
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('connect, hello, subscribe, snapshot, deltas', () => {
  it('the fixtures are messages of the contract', () => {
    for (const message of [OPERATOR, SUPERVISOR, DEVICE, ANONYMOUS, SESSION_INVALID, DEVICE_REVOKED, snapshot(10), delta(11), meters(1), beat(1)]) {
      expect(WsServerMessageSchema.safeParse(message).success, message.type).toBe(true);
    }
  });

  it('is exported by @dems/shared/realtime beside the heartbeat client', () => {
    expect(realtimeIndex.createLiveSocketClient).toBe(createLiveSocketClient);
    expect(realtimeIndex.createHeartbeatClient).toBe(createHeartbeatClient);
  });

  it('opens one socket at the injected URL, without headers on the web, and sends nothing before hello', () => {
    const h = harness();
    expect(h.client.getStatus()).toMatchObject({ link: 'CONNECTING', running: false, connection: 0, principal: null });
    h.client.start();
    expect(h.sockets).toHaveLength(1);
    expect(h.socket().url).toBe(SOCKET_URL);
    expect(h.socket().headers).toBeUndefined();
    expect(h.socket().frames).toEqual([]);
    expect(h.client.getStatus()).toMatchObject({ link: 'CONNECTING', running: true, connection: 1 });
    h.client.start();
    expect(h.sockets).toHaveLength(1);
    h.client.stop();
  });

  it('OPERATOR: hello, then subscribe, then the snapshot, then deltas in order; ONLINE only at the snapshot', () => {
    const h = harness();
    h.client.start();
    h.socket().deliver(OPERATOR);
    expect(h.take()).toEqual(['hello:OPERATOR#1']);
    expect(h.socket().sent()).toEqual([{ type: 'subscribe', topic: 'meters' }]);
    expect(h.client.getStatus()).toMatchObject({ link: 'CONNECTING', principal: 'OPERATOR', synced: false, metersSubscribed: true });

    h.socket().deliver(snapshot(10));
    expect(h.take()).toEqual(['snapshot:3/10:CONNECT', 'link:CONNECTING>ONLINE']);
    h.socket().deliver(delta(11));
    h.socket().deliver(delta(12));
    h.socket().deliver(delta(13));
    expect(h.take()).toEqual(['delta:3/11', 'delta:3/12', 'delta:3/13']);
    expect(h.client.getStatus()).toMatchObject({
      link: 'ONLINE',
      synced: true,
      epoch: EPOCH,
      revision: 13,
      connectionId: OPERATOR.connectionId,
      topics: OPERATOR.topics,
      counters: { received: 5, snapshots: 1, deltas: 3, sent: 1, invalid: 0, errors: 0 },
    });
    expect(h.errors).toEqual([]);
    h.client.stop();
  });

  it('ordering: a delta before the snapshot of its connection is never handed on, and is reported once', () => {
    const h = harness();
    h.client.start();
    h.socket().deliver(OPERATOR);
    h.socket().deliver(delta(9));
    h.socket().deliver(delta(10));
    h.socket().deliver(snapshot(10));
    h.socket().deliver(delta(11));
    expect(h.take()).toEqual(['hello:OPERATOR#1', 'snapshot:3/10:CONNECT', 'link:CONNECTING>ONLINE', 'delta:3/11']);
    expect(h.errors.map((report) => [report.code, report.level, report.messageType])).toEqual([['DELTA_BEFORE_SNAPSHOT', 'warn', 'delta']]);
    expect(h.client.getStatus().counters).toMatchObject({ deltas: 1, deltasDropped: 2 });
    // No `resync` was needed: the snapshot of the connection was on its way.
    expect(h.resyncsOf(h.socket())).toBe(0);
    h.client.stop();
  });

  it('ordering: after a reconnect no delta is handed on before the snapshot of the new connection', () => {
    const h = harness();
    h.online().deliver(delta(11));
    h.socket().serverClose(RealtimeCloseCode.GOING_AWAY);
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    expect(h.sockets).toHaveLength(2);
    h.take();
    h.socket().deliver(OPERATOR);
    // The revision the old connection would have expected next: still not handed on.
    h.socket().deliver(delta(12));
    expect(h.take()).toEqual(['hello:OPERATOR#2']);
    expect(h.client.getStatus()).toMatchObject({ link: 'CONNECTING', synced: false, epoch: EPOCH, revision: 11 });
    h.socket().deliver(snapshot(40));
    h.socket().deliver(delta(41));
    expect(h.take()).toEqual(['snapshot:3/40:RECONNECT', 'link:CONNECTING>ONLINE', 'resync:RESYNCED:RECONNECT', 'delta:3/41']);
    h.client.stop();
  });

  const WITHOUT_STATE: [string, HelloMessage][] = [
    ['ANONYMOUS', ANONYMOUS],
    ['DEVICE', DEVICE],
  ];

  it.each(WITHOUT_STATE)('%s: ONLINE at hello, and no client message is ever sent', (_name, hello) => {
    const h = harness();
    h.client.start();
    h.socket().deliver(hello);
    expect(h.take()).toEqual([`hello:${hello.principal}#1`, 'link:CONNECTING>ONLINE']);
    h.client.setMetersWanted(false);
    h.client.setMetersWanted(true);
    expect(h.client.requestResync()).toBe(false);
    h.clock.advance(10_000);
    expect(h.socket().frames).toEqual([]);
    h.client.stop();
  });

  it('a state message or a meter frame sent to a connection that is not OPERATOR is dropped and reported', () => {
    const h = harness();
    h.client.start();
    h.socket().deliver(DEVICE);
    h.take();
    h.socket().deliver(snapshot(10));
    h.socket().deliver(delta(11));
    h.socket().deliver(meters(1));
    h.socket().deliver(SESSION_ENDED.signedOut.value);
    expect(h.take()).toEqual([]);
    expect(h.errors.map((report) => [report.code, report.messageType])).toEqual([
      ['MESSAGE_NOT_FOR_PRINCIPAL', 'snapshot'],
      ['MESSAGE_NOT_FOR_PRINCIPAL', 'delta'],
      ['MESSAGE_NOT_FOR_PRINCIPAL', 'meters'],
      ['MESSAGE_NOT_FOR_PRINCIPAL', 'session.ended'],
    ]);
    // What a DEVICE is sent does arrive.
    h.socket().deliver(DEVICE_REVOKED_MESSAGE.revoked.value);
    expect(h.take()).toEqual(['control:device.revoked']);
    h.client.stop();
  });

  it('the control messages are handed on in the order the server sent them', () => {
    const h = harness();
    h.online(SUPERVISOR);
    h.take();
    h.socket().deliver(REALTIME_SERVER_EXAMPLES['session.updated'].roleChanged.value);
    h.socket().deliver(REALTIME_SERVER_EXAMPLES['admin.changed'].users.value);
    h.socket().deliver(delta(11));
    h.socket().deliver(REALTIME_SERVER_EXAMPLES['admin.changed'].pairingCode.value);
    expect(h.take()).toEqual(['control:session.updated', 'control:admin.changed', 'delta:3/11', 'control:admin.changed']);
    expect(h.client.getStatus().counters.control).toBe(3);
    h.client.stop();
  });

  it('mobile: the headers function is asked at every connect and its value goes to the factory, never into the URL', () => {
    let bearer = 'Bearer dvc_fixture-one';
    const asked: string[] = [];
    const h = harness({
      headers: () => {
        asked.push(bearer);
        return { Authorization: bearer };
      },
    });
    h.client.start();
    expect(h.socket().headers).toEqual({ Authorization: 'Bearer dvc_fixture-one' });
    expect(h.socket().url).toBe(SOCKET_URL);
    // A sign-in changed the bearer value: the new socket carries the new one (CL-11a).
    bearer = 'Bearer ses_fixture-two';
    expect(h.client.reconnect('SIGN_IN')).toBe(true);
    expect(h.sockets).toHaveLength(2);
    expect(h.socket().headers).toEqual({ Authorization: 'Bearer ses_fixture-two' });
    expect(h.socket().url).toBe(SOCKET_URL);
    expect(asked).toEqual(['Bearer dvc_fixture-one', 'Bearer ses_fixture-two']);
    // No client message has a member for a credential (SR-38).
    h.socket().deliver(OPERATOR);
    expect(h.socket().frames.join('')).not.toMatch(/Bearer|fixture/);
    h.client.stop();
  });

  const NO_HEADERS: [string, LiveSocketHeadersProvider][] = [
    ['null', () => null],
    ['undefined', () => undefined],
    ['an empty object', () => ({})],
  ];

  it.each(NO_HEADERS)('a headers function that returns %s opens the socket without headers', (_name, headers) => {
    const h = harness({ headers });
    h.client.start();
    expect(h.socket().headers).toBeUndefined();
    h.client.stop();
  });

  it('the default factory calls the global WebSocket with the URL alone, or with the headers as the third argument', () => {
    const calls: unknown[][] = [];
    class GlobalSocket extends FakeSocket {
      constructor(...args: unknown[]) {
        super(String(args[0]), undefined, () => 0);
        calls.push(args);
      }
    }
    vi.stubGlobal('WebSocket', GlobalSocket);
    const clock = manualClock(T0);
    const web = createLiveSocketClient({ url: SOCKET_URL, now: clock.now, timers: clock.timers });
    web.start();
    web.stop();
    const mobile = createLiveSocketClient({ url: SOCKET_URL, now: clock.now, timers: clock.timers, headers: () => ({ Authorization: 'Bearer dvc_fixture' }) });
    mobile.start();
    mobile.stop();
    expect(calls).toEqual([[SOCKET_URL], [SOCKET_URL, undefined, { headers: { Authorization: 'Bearer dvc_fixture' } }]]);
    expect(clock.pending()).toBe(0);
  });

  it('without a global WebSocket and without a factory the client reports it and keeps retrying; nothing is thrown', () => {
    vi.stubGlobal('WebSocket', undefined);
    const clock = manualClock(T0);
    const errors: LiveSocketErrorReport[] = [];
    const client = createLiveSocketClient({ url: SOCKET_URL, now: clock.now, timers: clock.timers, random: () => 0, onError: (report) => errors.push(report) });
    expect(() => client.start()).not.toThrow();
    expect(errors.map((report) => report.code)).toEqual(['SOCKET_FACTORY_FAILED']);
    expect(client.getStatus().link).toBe('OFFLINE');
    expect(clock.timeouts).toEqual([RECONNECT_BACKOFF_MS[0]]);
    client.stop();
    expect(clock.pending()).toBe(0);
  });

  it.each([
    'http://127.0.0.1:4420/ws',
    'ws://127.0.0.1:4420/ws?token=ses_fixture',
    'ws://127.0.0.1:4420/ws#ses_fixture',
    'ws://operator:fixture@127.0.0.1:4420/ws',
    'ws://',
    '/ws',
    '',
  ])('refuses the URL %j: a credential never travels in a URL (SR-38)', (url) => {
    expect(() => createLiveSocketClient({ url })).toThrow(LiveSocketUsageError);
  });

  it.each(['ws://127.0.0.1:4420/ws', 'wss://core.example/ws', 'ws://127.0.0.1:5173/ws', 'ws://localhost:4421'])('accepts the URL %j', (url) => {
    expect(() => createLiveSocketClient({ url })).not.toThrow();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('refuses syncTimeoutMs %s', (syncTimeoutMs) => {
    expect(() => createLiveSocketClient({ url: SOCKET_URL, syncTimeoutMs })).toThrow(LiveSocketUsageError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// The heartbeat view (CL-7)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('the heartbeat view is fed from the one socket (CL-7)', () => {
  it('gives the same snapshots as the heartbeat client, step by step, for the same messages', () => {
    vi.useFakeTimers();
    let clock = 0;
    const plainSockets: FakeSocket[] = [];
    const liveSockets: FakeSocket[] = [];
    const plain = createHeartbeatClient({
      url: SOCKET_URL,
      socketFactory: (url) => {
        const socket = new FakeSocket(url, undefined, () => clock);
        plainSockets.push(socket);
        return socket;
      },
      now: () => clock,
      random: () => 0,
      onInvalidMessage: () => undefined,
    });
    // No `timers` option: the default, the global timer functions, is what runs here.
    const live = createLiveSocketClient({
      url: SOCKET_URL,
      socketFactory: (url, headers) => {
        const socket = new FakeSocket(url, headers, () => clock);
        liveSockets.push(socket);
        return socket;
      },
      now: () => clock,
      random: () => 0,
    });
    const both = (act: (socket: FakeSocket) => void): void => {
      act(plainSockets.at(-1) as FakeSocket);
      act(liveSockets.at(-1) as FakeSocket);
      expect(live.getSnapshot()).toEqual(plain.getSnapshot());
    };

    expect(live.getSnapshot()).toEqual(plain.getSnapshot());
    plain.start();
    live.start();
    expect(live.getSnapshot()).toEqual(plain.getSnapshot());
    both((socket) => socket.deliver(ANONYMOUS));
    expect(live.getSnapshot().state).toBe('CONNECTING');
    both((socket) => socket.deliver(beat(7)));
    expect(live.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 7, clients: 1, reconnectAttempt: 0, lastBeatAt: 0 });

    clock += HEARTBEAT_STALE_AFTER_MS;
    vi.advanceTimersByTime(HOUSEKEEPING_MS);
    expect(live.getSnapshot()).toEqual(plain.getSnapshot());
    expect(live.getSnapshot().state).toBe('STALE');
    both((socket) => socket.deliver(beat(8)));
    expect(live.getSnapshot().state).toBe('LIVE');

    both((socket) => socket.serverClose(RealtimeCloseCode.GOING_AWAY));
    expect(live.getSnapshot()).toMatchObject({ state: 'OFFLINE', reconnectAttempt: 1 });
    vi.advanceTimersByTime(RECONNECT_BACKOFF_MS[0]);
    expect([plainSockets.length, liveSockets.length]).toEqual([2, 2]);
    expect(live.getSnapshot()).toEqual(plain.getSnapshot());
    expect(live.getSnapshot().state).toBe('CONNECTING');
    both((socket) => socket.deliver(ANONYMOUS));
    both((socket) => socket.deliver(beat(12)));
    expect(live.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 12, reconnectAttempt: 0 });

    plain.stop();
    live.stop();
    expect(live.getSnapshot()).toEqual(plain.getSnapshot());
    expect(live.getSnapshot().state).toBe('OFFLINE');
    expect(liveSockets[1]?.closedWith).toEqual({ code: 1000, reason: 'client stopped' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is a HeartbeatClient: unbound subscribe and getSnapshot work, and the snapshot keeps its identity between changes', () => {
    const h = harness();
    const asHeartbeat: HeartbeatClient = h.client;
    const { subscribe, getSnapshot } = asHeartbeat;
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    const before = getSnapshot();
    expect(getSnapshot()).toBe(before);
    h.client.start();
    h.socket().deliver(OPERATOR);
    const afterHello = getSnapshot();
    h.socket().deliver(snapshot(10));
    h.socket().deliver(delta(11));
    h.socket().deliver(meters(1));
    // Only a heartbeat changes the heartbeat view: state messages and meter frames do not notify.
    expect(getSnapshot()).toBe(afterHello);
    const calls = listener.mock.calls.length;
    h.socket().deliver(beat(5));
    expect(listener.mock.calls.length).toBe(calls + 1);
    expect(getSnapshot()).not.toBe(afterHello);
    expect(getSnapshot()).toMatchObject({ state: 'LIVE', seq: 5 });
    unsubscribe();
    h.socket().deliver(beat(6));
    expect(listener.mock.calls.length).toBe(calls + 1);
    h.client.stop();
  });

  it('reads both forms of the server time: epoch milliseconds in hello, ISO-8601 in heartbeat', () => {
    const samples: unknown[] = [];
    const h = harness({ onServerTime: (sample) => samples.push(sample) });
    h.client.start();
    h.clock.advance(20);
    h.socket().deliver({ ...OPERATOR, serverTime: T0 + 7_000 });
    h.clock.advance(100);
    h.socket().deliver(beat(1, T0 + 7_100));
    expect(samples).toEqual([
      { serverTime: T0 + 7_000, receivedAt: T0 + 20, source: 'hello' },
      { serverTime: T0 + 7_100, receivedAt: T0 + 120, source: 'heartbeat' },
    ]);
    expect(h.client.getStatus().serverTime).toEqual(samples[1]);
    // The heartbeat view keeps the string as the server wrote it.
    expect(h.client.getSnapshot().serverTime).toBe(new Date(T0 + 7_100).toISOString());
    h.client.stop();
  });

  it('the link turns STALE after HEARTBEAT_STALE_AFTER_MS without a heartbeat, and back on the next one', () => {
    const h = harness();
    h.online();
    h.socket().deliver(beat(1));
    h.take();
    h.clock.advance(HEARTBEAT_STALE_AFTER_MS - 1);
    expect(h.client.getStatus().link).toBe('ONLINE');
    h.clock.advance(HOUSEKEEPING_MS);
    expect(h.take()).toEqual(['link:ONLINE>STALE']);
    expect(h.client.getSnapshot().state).toBe('STALE');
    // A state message is not a heartbeat: the link stays STALE, the delta is still applied.
    h.socket().deliver(delta(11));
    expect(h.take()).toEqual(['delta:3/11']);
    h.socket().deliver(beat(2));
    expect(h.take()).toEqual(['link:STALE>ONLINE']);
    expect(h.client.getSnapshot().state).toBe('LIVE');
    h.client.stop();
  });

  it('a hello that is followed by no heartbeat at all still turns the link STALE', () => {
    const h = harness();
    h.online();
    h.take();
    h.clock.advance(HEARTBEAT_STALE_AFTER_MS);
    expect(h.take()).toEqual(['link:ONLINE>STALE']);
    // The heartbeat view never saw a beat, so it is still CONNECTING, as the heartbeat client would be.
    expect(h.client.getSnapshot().state).toBe('CONNECTING');
    h.client.stop();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Resync (AC-C-15)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('resync on a revision gap or a newer epoch (AC-C-15)', () => {
  it('a gap sends one resync, drops deltas until the snapshot, and reports RESYNCING then RESYNCED', () => {
    const h = harness();
    h.online();
    h.take();
    h.socket().deliver(delta(12));
    expect(h.take()).toEqual(['link:ONLINE>RESYNCING', 'resync:RESYNCING:GAP']);
    expect(h.socket().sent()).toEqual([{ type: 'subscribe', topic: 'meters' }, { type: 'resync' }]);
    expect(h.client.getStatus()).toMatchObject({ link: 'RESYNCING', synced: false, resync: 'GAP', revision: 10 });

    // Deltas on the way while the snapshot is awaited: dropped, the snapshot holds their effect.
    h.socket().deliver(delta(13));
    h.socket().deliver(delta(14));
    expect(h.take()).toEqual([]);
    h.socket().deliver(snapshot(14));
    expect(h.take()).toEqual(['snapshot:3/14:RESYNC', 'link:RESYNCING>ONLINE', 'resync:RESYNCED:GAP']);
    h.socket().deliver(delta(15));
    expect(h.take()).toEqual(['delta:3/15']);
    expect(h.client.getStatus()).toMatchObject({ link: 'ONLINE', synced: true, resync: null, revision: 15, counters: { resyncs: 1, deltasDropped: 3, deltas: 1 } });
    expect(h.errors).toEqual([]);
    h.client.stop();
  });

  it('at most one resync in 2 s: a storm of gaps sends exactly one', () => {
    const h = harness();
    h.online();
    for (let step = 0; step < 40; step += 1) {
      h.socket().deliver(delta(12 + step * 2));
      h.clock.advance(49);
    }
    expect(h.clock.now() - T0).toBeLessThan(REALTIME_RESYNC_MIN_INTERVAL_MS);
    expect(h.resyncsOf(h.socket())).toBe(1);
    expect(h.log.filter((entry) => entry.startsWith('resync:'))).toEqual(['resync:RESYNCING:GAP']);
    h.client.stop();
  });

  it('at most one resync in 2 s: a second gap inside the interval waits, and no two resyncs are closer than 2 s', () => {
    const h = harness();
    h.online();
    h.socket().deliver(delta(12));
    h.advanceAlive(100);
    h.socket().deliver(snapshot(20));
    h.advanceAlive(100);
    // A second gap 200 ms after the first resync.
    h.socket().deliver(delta(25));
    expect(h.client.getStatus()).toMatchObject({ link: 'RESYNCING', resync: 'GAP' });
    expect(h.resyncsOf(h.socket())).toBe(1);
    h.advanceAlive(REALTIME_RESYNC_MIN_INTERVAL_MS - 200 - 1);
    // 1 ms before the 2 s are over: the link waits as RESYNCING, and nothing was sent.
    expect(h.client.getStatus()).toMatchObject({ link: 'RESYNCING', counters: { resyncs: 1 } });
    expect(h.resyncsOf(h.socket())).toBe(1);
    h.advanceAlive(HOUSEKEEPING_MS + LIVE_SOCKET_RESYNC_GUARD_MS);
    expect(h.resyncsOf(h.socket())).toBe(2);
    h.socket().deliver(snapshot(30));
    expect(h.client.getStatus()).toMatchObject({ link: 'ONLINE', revision: 30 });

    // A third and a fourth gap, each right after the snapshot: the spacing still holds.
    h.socket().deliver(delta(35));
    h.advanceAlive(RESYNC_SPACING_MS + HOUSEKEEPING_MS);
    h.socket().deliver(snapshot(40));
    h.socket().deliver(delta(45));
    h.advanceAlive(RESYNC_SPACING_MS + HOUSEKEEPING_MS);
    expect(h.errors).toEqual([]);
    const times = h.socket().frameTimes.filter((_, index) => h.socket().sent()[index]?.type === 'resync');
    expect(times).toHaveLength(4);
    // Each waiting resync left at the first housekeeping step after 2,250 ms.
    expect(times.map((at) => at - T0)).toEqual([0, 2_500, 5_000, 7_500]);
    for (let index = 1; index < times.length; index += 1) {
      expect((times[index] as number) - (times[index - 1] as number)).toBeGreaterThanOrEqual(RESYNC_SPACING_MS);
    }
    expect(RESYNC_SPACING_MS).toBeGreaterThanOrEqual(REALTIME_RESYNC_MIN_INTERVAL_MS);
    expect(REALTIME_RESYNC_MIN_INTERVAL_MS).toBe(2_000);
    h.client.stop();
  });

  it('the 2 s rule holds across a reconnect', () => {
    const h = harness();
    h.online();
    h.socket().deliver(delta(12));
    expect(h.resyncsOf(h.socket())).toBe(1);
    h.socket().serverClose(RealtimeCloseCode.SLOW_CONSUMER);
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    h.socket().deliver(OPERATOR);
    h.socket().deliver(snapshot(50));
    h.socket().deliver(delta(60));
    // 500 ms after the first resync: the new connection may not send one yet.
    expect(h.client.getStatus().link).toBe('RESYNCING');
    expect(h.resyncsOf(h.socket())).toBe(0);
    h.clock.advance(RESYNC_SPACING_MS);
    expect(h.resyncsOf(h.socket())).toBe(1);
    h.client.stop();
  });

  it('a delta of a newer epoch sends resync; the snapshot of that epoch replaces the replica', () => {
    const h = harness();
    h.online();
    h.take();
    h.socket().deliver(delta(1, EPOCH + 1));
    expect(h.take()).toEqual(['link:ONLINE>RESYNCING', 'resync:RESYNCING:EPOCH']);
    expect(h.resyncsOf(h.socket())).toBe(1);
    h.socket().deliver(snapshot(1, EPOCH + 1));
    h.socket().deliver(delta(2, EPOCH + 1));
    expect(h.take()).toEqual(['snapshot:4/1:RESYNC', 'link:RESYNCING>ONLINE', 'resync:RESYNCED:EPOCH', 'delta:4/2']);
    expect(h.client.getStatus()).toMatchObject({ epoch: EPOCH + 1, revision: 2 });
    h.client.stop();
  });

  it('a snapshot of a new epoch that the server sends by itself is applied without a resync (RT-7)', () => {
    const h = harness();
    h.online();
    h.take();
    h.socket().deliver(snapshot(0, EPOCH + 1));
    h.socket().deliver(delta(1, EPOCH + 1));
    expect(h.take()).toEqual(['snapshot:4/0:EPOCH', 'delta:4/1']);
    expect(h.resyncsOf(h.socket())).toBe(0);
    // A delta of the epoch that is over is ignored, not a reason to resync.
    h.socket().deliver(delta(11, EPOCH));
    expect(h.take()).toEqual([]);
    expect(h.client.getStatus()).toMatchObject({ link: 'ONLINE', epoch: EPOCH + 1, revision: 1, counters: { deltasStale: 1, resyncs: 0 } });
    h.client.stop();
  });

  it('a delta the replica already holds is dropped without a resync', () => {
    const h = harness();
    h.online();
    h.socket().deliver(delta(11));
    h.take();
    h.socket().deliver(delta(10));
    h.socket().deliver(delta(11));
    h.socket().deliver(delta(12));
    expect(h.take()).toEqual(['delta:3/12']);
    expect(h.resyncsOf(h.socket())).toBe(0);
    expect(h.client.getStatus()).toMatchObject({ link: 'ONLINE', revision: 12, counters: { deltasStale: 2 } });
    h.client.stop();
  });

  it('requestResync: the consumer asks for a snapshot, under the same 2 s rule', () => {
    const h = harness();
    h.client.start();
    expect(h.client.requestResync()).toBe(false);
    h.socket().deliver(OPERATOR);
    // The snapshot of the connection is still on its way: nothing to ask for.
    expect(h.client.requestResync()).toBe(false);
    h.socket().deliver(snapshot(10));
    h.take();
    expect(h.client.requestResync()).toBe(true);
    expect(h.client.requestResync()).toBe(true);
    expect(h.take()).toEqual(['link:ONLINE>RESYNCING', 'resync:RESYNCING:REQUESTED']);
    expect(h.resyncsOf(h.socket())).toBe(1);
    h.socket().deliver(delta(11));
    h.socket().deliver(snapshot(11));
    expect(h.take()).toEqual(['snapshot:3/11:RESYNC', 'link:RESYNCING>ONLINE', 'resync:RESYNCED:REQUESTED']);
    h.client.stop();
    expect(h.client.requestResync()).toBe(false);
  });

  it('no answer to a resync within the deadline: the socket is given up, and the new connection resynchronises', () => {
    const h = harness();
    const first = h.online();
    first.deliver(delta(12));
    h.take();
    h.clock.advance(LIVE_SOCKET_SYNC_TIMEOUT_MS - 1);
    expect(h.sockets).toHaveLength(1);
    expect(first.held()).toBe(true);
    h.clock.advance(HOUSEKEEPING_MS);
    expect(first.closedWith).toEqual({ code: 1000, reason: 'client gave up' });
    expect(h.errors.map((report) => [report.code, report.level, report.waiting])).toEqual([['SYNC_TIMEOUT', 'warn', 'resync']]);
    expect(h.take()).toEqual(['link:RESYNCING>STALE', 'link:STALE>OFFLINE']);
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    expect(h.sockets).toHaveLength(2);
    h.socket().deliver(OPERATOR);
    h.socket().deliver(snapshot(30));
    expect(h.take()).toEqual(['link:OFFLINE>CONNECTING', 'hello:OPERATOR#2', 'snapshot:3/30:RECONNECT', 'link:CONNECTING>ONLINE', 'resync:RESYNCED:RECONNECT']);
    h.client.stop();
  });

  const AWAITED: [string, (socket: FakeSocket) => void][] = [
    ['hello', () => undefined],
    ['snapshot', (socket) => socket.deliver(OPERATOR)],
  ];

  it.each(AWAITED)('no %s within the deadline: the socket is given up and the backoff starts', (waiting, prepare) => {
    const h = harness();
    h.client.start();
    prepare(h.socket());
    // Heartbeats keep arriving: the link is alive, only the awaited message is missing.
    for (let second = 1; second <= 4; second += 1) {
      h.clock.advance(1_000);
      if (h.socket().held()) h.socket().deliver(beat(second));
    }
    expect(h.socket(0).closedWith).toEqual({ code: 1000, reason: 'client gave up' });
    expect(h.errors.map((report) => [report.code, report.waiting])).toEqual([['SYNC_TIMEOUT', waiting]]);
    expect(h.client.getStatus().link).toBe('OFFLINE');
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    expect(h.sockets).toHaveLength(2);
    h.client.stop();
  });

  it('an ANONYMOUS connection has no deadline after hello: it stays open for the heartbeat', () => {
    const h = harness();
    h.client.start();
    h.socket().deliver(ANONYMOUS);
    for (let second = 1; second <= 30; second += 1) {
      h.clock.advance(1_000);
      h.socket().deliver(beat(second));
    }
    expect(h.sockets).toHaveLength(1);
    expect(h.client.getStatus().link).toBe('ONLINE');
    expect(h.errors).toEqual([]);
    h.client.stop();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Meter frames (RT-8, CL-11b)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('meter frames: the latest wins, nothing is queued (RT-8, CL-11b)', () => {
  it('each frame goes to onMeters at once; the client keeps one frame, the newest', () => {
    const h = harness();
    h.online();
    h.take();
    expect(h.client.getLatestMeters()).toBeNull();
    for (const seq of [100, 101, 105]) h.socket().deliver(meters(seq));
    expect(h.take()).toEqual(['meters:100', 'meters:101', 'meters:105']);
    expect(h.client.getLatestMeters()).toEqual(meters(105));
    // A frame that is not newer is dropped; a gap in `seq` is by design.
    h.socket().deliver(meters(105));
    h.socket().deliver(meters(102));
    expect(h.take()).toEqual([]);
    expect(h.client.getLatestMeters()?.seq).toBe(105);
    expect(Object.keys(h.client.getLatestMeters()?.audio.channels ?? {})).toEqual(['AUDIO-01', 'AUDIO-02']);
    expect(h.client.getStatus().counters).toMatchObject({ meters: 3, metersDropped: 2 });
    h.client.stop();
  });

  it('meter frames are handed on while a resync is pending: they carry no revision and are never held', () => {
    const h = harness();
    h.online();
    h.socket().deliver(delta(12));
    h.take();
    h.socket().deliver(meters(7));
    expect(h.take()).toEqual(['meters:7']);
    h.client.stop();
  });

  it('meters: false sends no subscribe; setMetersWanted sends subscribe and unsubscribe once each', () => {
    const h = harness({ meters: false });
    h.online();
    expect(h.socket().sent()).toEqual([]);
    h.take();
    h.socket().deliver(meters(1));
    expect(h.take()).toEqual([]);

    h.client.setMetersWanted(true);
    h.client.setMetersWanted(true);
    expect(h.socket().sent()).toEqual([{ type: 'subscribe', topic: 'meters' }]);
    h.socket().deliver(meters(2));
    expect(h.take()).toEqual(['meters:2']);

    h.client.setMetersWanted(false);
    h.client.setMetersWanted(false);
    expect(h.socket().sent()).toEqual([
      { type: 'subscribe', topic: 'meters' },
      { type: 'unsubscribe', topic: 'meters' },
    ]);
    // Frames still on the way after the unsubscribe are dropped, and no stale level is kept.
    h.socket().deliver(meters(3));
    expect(h.take()).toEqual([]);
    expect(h.client.getLatestMeters()).toBeNull();
    expect(h.client.getStatus()).toMatchObject({ metersWanted: false, metersSubscribed: false });
    h.client.stop();
  });

  it('the wish survives a reconnect, and the kept frame does not', () => {
    const h = harness();
    h.online();
    h.socket().deliver(meters(9));
    h.socket().serverClose(RealtimeCloseCode.GOING_AWAY);
    expect(h.client.getLatestMeters()).toBeNull();
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    h.socket().deliver(OPERATOR);
    expect(h.socket().sent()).toEqual([{ type: 'subscribe', topic: 'meters' }]);
    // The frame counter of a new connection starts where the server says.
    h.socket().deliver(meters(1));
    expect(h.client.getLatestMeters()?.seq).toBe(1);
    h.client.stop();
  });

  it('an OPERATOR hello without the meters topic gets no subscribe', () => {
    const h = harness();
    h.client.start();
    h.socket().deliver({ ...OPERATOR, topics: ['heartbeat', 'control', 'state'] });
    h.socket().deliver(snapshot(10));
    expect(h.socket().frames).toEqual([]);
    expect(h.client.getStatus()).toMatchObject({ link: 'ONLINE', metersWanted: true, metersSubscribed: false });
    h.client.stop();
  });

  it('never sends more than LIVE_SOCKET_SEND_BUDGET client messages in the period of the server limit', () => {
    const h = harness();
    h.online();
    for (let flip = 0; flip < 199; flip += 1) {
      h.client.setMetersWanted(flip % 2 === 1);
      h.clock.advance(10);
    }
    // The budget ran out while the server was last told "subscribe"; the last wish is "not wanted".
    expect(h.socket().frames).toHaveLength(LIVE_SOCKET_SEND_BUDGET);
    expect(h.client.getStatus()).toMatchObject({ metersWanted: false, metersSubscribed: true });
    const times = h.socket().frameTimes;
    expect(LIVE_SOCKET_SEND_BUDGET).toBeLessThan(REALTIME_CLIENT_MESSAGE_LIMIT.count);
    for (const start of times) {
      const inPeriod = times.filter((at) => at >= start && at < start + REALTIME_CLIENT_MESSAGE_LIMIT.windowMs).length;
      expect(inPeriod).toBeLessThanOrEqual(LIVE_SOCKET_SEND_BUDGET);
    }
    // The last wish is told to the server once the budget allows it.
    h.clock.advance(REALTIME_CLIENT_MESSAGE_LIMIT.windowMs + HOUSEKEEPING_MS);
    expect(h.client.getStatus()).toMatchObject({ metersWanted: false, metersSubscribed: false });
    expect(h.socket().sent().at(-1)).toEqual({ type: 'unsubscribe', topic: 'meters' });
    const all = h.socket().frameTimes;
    for (const start of all) {
      expect(all.filter((at) => at >= start && at < start + REALTIME_CLIENT_MESSAGE_LIMIT.windowMs).length).toBeLessThanOrEqual(LIVE_SOCKET_SEND_BUDGET);
    }
    h.client.stop();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Close codes and reconnect (AC-C-16)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('close codes (AC-C-16)', () => {
  /** A minute passes and nothing reconnects: one socket, and the housekeeping interval is the only timer. */
  function expectNoReconnect(h: ReturnType<typeof harness>, sockets: number): void {
    expect(h.clock.pendingTimeouts()).toBe(0);
    h.clock.advance(60_000);
    expect(h.sockets).toHaveLength(sockets);
    expect(h.clock.pendingTimeouts()).toBe(0);
    expect(h.clock.timeouts).toEqual([]);
  }

  it.each(Object.values(SESSION_ENDED).map((example): [string, SessionEndedMessage] => [example.value.reason, example.value]))(
    '4401 after session.ended %s: reported as SESSION_ENDED with the reason, and nothing reconnects',
    (reason, message) => {
      const h = harness();
      h.online();
      h.socket().deliver(beat(1));
      h.take();
      h.socket().deliver(message);
      h.socket().serverClose(RealtimeCloseCode.SESSION_ENDED);
      expect(h.take()).toEqual(['control:session.ended', 'link:ONLINE>OFFLINE', 'end:SESSION_ENDED']);
      expect(h.ends).toEqual([
        { kind: 'SESSION_ENDED', closeCode: 4401, sessionEnded: reason, deviceRevoked: null, helloReason: null, principal: 'OPERATOR', at: T0 },
      ]);
      expect(h.client.getStatus()).toMatchObject({ link: 'OFFLINE', running: true, principal: null, synced: false, lastCloseCode: 4401, end: { kind: 'SESSION_ENDED' } });
      expect(h.client.getSnapshot()).toMatchObject({ state: 'OFFLINE', reconnectAttempt: 0 });
      expectNoReconnect(h, 1);
      h.client.stop();
    },
  );

  it('4401 with no session.ended before it (an invalid bearer value): SESSION_ENDED without a reason, no reconnect', () => {
    const h = harness({ headers: () => ({ Authorization: 'Bearer ses_fixture' }) });
    h.client.start();
    h.socket().deliver(SESSION_INVALID);
    h.socket().serverClose(4401);
    expect(h.ends).toMatchObject([{ kind: 'SESSION_ENDED', closeCode: 4401, sessionEnded: null, helloReason: 'SESSION_INVALID', principal: 'ANONYMOUS' }]);
    expectNoReconnect(h, 1);
    h.client.stop();
  });

  const BARE_ENDS: [number, LiveSocketEnd['kind']][] = [
    [4401, 'SESSION_ENDED'],
    [4403, 'DEVICE_REVOKED'],
  ];

  it.each(BARE_ENDS)('%i alone on an open OPERATOR connection, with no control message before it: %s, and nothing reconnects', (code, kind) => {
    const h = harness();
    h.online();
    h.socket().deliver(beat(1));
    h.take();
    h.socket().serverClose(code);
    expect(h.take()).toEqual(['link:ONLINE>OFFLINE', `end:${kind}`]);
    expect(h.ends).toEqual([{ kind, closeCode: code, sessionEnded: null, deviceRevoked: null, helloReason: null, principal: 'OPERATOR', at: T0 }]);
    expect(h.client.getSnapshot()).toMatchObject({ state: 'OFFLINE', reconnectAttempt: 0 });
    expectNoReconnect(h, 1);
    h.client.stop();
  });

  it('4403 before hello: DEVICE_REVOKED, no reconnect', () => {
    const h = harness({ headers: () => ({ Authorization: 'Bearer dvc_fixture' }) });
    h.client.start();
    h.socket().serverClose(4403);
    expect(h.ends).toMatchObject([{ kind: 'DEVICE_REVOKED', closeCode: 4403, deviceRevoked: null, helloReason: null, principal: null }]);
    expect(h.take()).toEqual(['link:CONNECTING>OFFLINE', 'end:DEVICE_REVOKED']);
    expectNoReconnect(h, 1);
    h.client.stop();
  });

  it('4401 before hello: SESSION_ENDED, no reconnect', () => {
    const h = harness();
    h.client.start();
    h.socket().serverClose(4401);
    expect(h.ends).toMatchObject([{ kind: 'SESSION_ENDED', closeCode: 4401, sessionEnded: null, helloReason: null, principal: null }]);
    expect(h.take()).toEqual(['link:CONNECTING>OFFLINE', 'end:SESSION_ENDED']);
    expectNoReconnect(h, 1);
    h.client.stop();
  });

  it.each(Object.values(DEVICE_REVOKED_MESSAGE).map((example): [string, DeviceRevokedMessage] => [example.value.reason, example.value]))(
    '4403 after device.revoked %s: reported as DEVICE_REVOKED with the reason, and nothing reconnects',
    (reason, message) => {
      const h = harness({ headers: () => ({ Authorization: 'Bearer dvc_fixture' }) });
      h.client.start();
      h.socket().deliver(DEVICE);
      h.take();
      h.socket().deliver(message);
      h.socket().serverClose(RealtimeCloseCode.DEVICE_REVOKED);
      expect(h.take()).toEqual(['control:device.revoked', 'link:ONLINE>OFFLINE', 'end:DEVICE_REVOKED']);
      expect(h.ends).toEqual([
        { kind: 'DEVICE_REVOKED', closeCode: 4403, sessionEnded: null, deviceRevoked: reason, helloReason: null, principal: 'DEVICE', at: T0 },
      ]);
      expect(h.client.getStatus()).toMatchObject({ link: 'OFFLINE', lastCloseCode: 4403, end: { kind: 'DEVICE_REVOKED' } });
      expectNoReconnect(h, 1);
      h.client.stop();
    },
  );

  it('4403 right after the hello of a revoked bearer value: DEVICE_REVOKED, no reconnect', () => {
    const h = harness({ headers: () => ({ Authorization: 'Bearer dvc_fixture' }) });
    h.client.start();
    h.socket().deliver(DEVICE_REVOKED);
    h.socket().serverClose(4403);
    expect(h.ends).toMatchObject([{ kind: 'DEVICE_REVOKED', closeCode: 4403, deviceRevoked: null, helloReason: 'DEVICE_REVOKED', principal: 'ANONYMOUS' }]);
    expectNoReconnect(h, 1);
    h.client.stop();
  });

  const RECONNECTING_CLOSES: [string, number | undefined][] = [
    ['1001 server shutdown', 1001],
    ['1013 connection cap', 1013],
    ['4408 slow consumer', 4408],
    ['1008 protocol violation', 1008],
    ['1000 normal closure by the server', 1000],
    ['1006 abnormal closure', 1006],
    ['1011 server error', 1011],
    ['no code at all', undefined],
  ];

  it.each(RECONNECTING_CLOSES)('%s: reconnects after RECONNECT_BACKOFF_MS[0] and expects a snapshot', (_name, code) => {
    const h = harness();
    h.online();
    h.socket().deliver(beat(1));
    h.take();
    h.socket().serverClose(code);
    expect(h.take()).toEqual(['link:ONLINE>OFFLINE']);
    expect(h.ends).toEqual([]);
    expect(h.client.getStatus()).toMatchObject({ link: 'OFFLINE', end: null, lastCloseCode: code ?? null, synced: false, counters: { reconnects: 1 } });
    expect(h.client.getSnapshot()).toMatchObject({ state: 'OFFLINE', reconnectAttempt: 1 });
    expect(h.clock.timeouts).toEqual([RECONNECT_BACKOFF_MS[0]]);

    h.clock.advance(RECONNECT_BACKOFF_MS[0] - 1);
    expect(h.sockets).toHaveLength(1);
    h.clock.advance(1);
    expect(h.sockets).toHaveLength(2);
    expect(h.take()).toEqual(['link:OFFLINE>CONNECTING']);
    h.socket().deliver(OPERATOR);
    h.socket().deliver(snapshot(20));
    expect(h.take()).toEqual(['hello:OPERATOR#2', 'snapshot:3/20:RECONNECT', 'link:CONNECTING>ONLINE', 'resync:RESYNCED:RECONNECT']);
    h.client.stop();
  });

  it.each([1001, 1013, 4408])('%i again and again: the delays are RECONNECT_BACKOFF_MS, and the last one repeats', (code) => {
    const h = harness();
    h.client.start();
    for (let attempt = 0; attempt < 7; attempt += 1) {
      h.socket().deliver(OPERATOR);
      h.socket().serverClose(code);
      expect(h.client.getSnapshot().reconnectAttempt).toBe(attempt + 1);
      h.clock.advance(RECONNECT_BACKOFF_MS[Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1)] as number);
      expect(h.sockets).toHaveLength(attempt + 2);
    }
    expect(h.clock.timeouts).toEqual([...RECONNECT_BACKOFF_MS, RECONNECT_BACKOFF_MS[4], RECONNECT_BACKOFF_MS[4]]);
    expect(h.clock.timeouts).toEqual([500, 1000, 2000, 4000, 8000, 8000, 8000]);
    h.client.stop();
  });

  it('the jitter is RECONNECT_JITTER_MS at most', () => {
    const h = harness({ random: () => 0.9999 });
    h.client.start();
    h.socket().serverClose(1001);
    h.socket(0).serverClose(1001);
    expect(h.clock.timeouts).toEqual([RECONNECT_BACKOFF_MS[0] + RECONNECT_JITTER_MS]);
    h.clock.advance(RECONNECT_BACKOFF_MS[0] + RECONNECT_JITTER_MS);
    h.socket().serverClose(1013);
    expect(h.clock.timeouts).toEqual([750, 1250]);
    h.client.stop();
  });

  it('the first heartbeat of the new connection ends the backoff: the next loss waits RECONNECT_BACKOFF_MS[0] again', () => {
    const h = harness();
    h.online();
    h.socket().serverClose(1001);
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    h.socket().serverClose(1001);
    h.clock.advance(RECONNECT_BACKOFF_MS[1]);
    expect(h.client.getSnapshot().reconnectAttempt).toBe(2);
    h.socket().deliver(OPERATOR);
    h.socket().deliver(snapshot(10));
    // hello and the snapshot alone do not end the backoff: the heartbeat view decides, as before.
    expect(h.client.getSnapshot().reconnectAttempt).toBe(2);
    h.socket().deliver(beat(3));
    expect(h.client.getSnapshot()).toMatchObject({ state: 'LIVE', reconnectAttempt: 0 });
    h.socket().serverClose(4408);
    expect(h.clock.timeouts).toEqual([RECONNECT_BACKOFF_MS[0], RECONNECT_BACKOFF_MS[1], RECONNECT_BACKOFF_MS[0]]);
    h.client.stop();
  });

  it('a socket error reconnects with the backoff; the late close of that socket is ignored', () => {
    const h = harness();
    const first = h.online();
    const { onclose } = first;
    h.take();
    first.fail();
    expect(h.take()).toEqual(['link:ONLINE>OFFLINE']);
    expect(first.closedWith).toEqual({ code: 1000, reason: 'client saw an error' });
    expect(first.onclose).toBeNull();
    // The runtime reports the close of the same socket afterwards, even with 4401: one loss, not two.
    onclose?.({ code: 4401 });
    expect(h.ends).toEqual([]);
    expect(h.clock.timeouts).toEqual([RECONNECT_BACKOFF_MS[0]]);
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    expect(h.sockets).toHaveLength(2);
    h.client.stop();
  });

  it('a close whose code the runtime did not hand on is still the end the server announced', () => {
    // session.ended, then a close without a code.
    const web = harness();
    web.online();
    web.socket().deliver(SESSION_ENDED.idleExpired.value);
    web.socket().serverClose();
    expect(web.ends).toMatchObject([{ kind: 'SESSION_ENDED', closeCode: null, sessionEnded: 'IDLE_EXPIRED' }]);
    expect(web.clock.timeouts).toEqual([]);
    web.client.stop();

    // device.revoked, then an abnormal close.
    const tablet = harness({ headers: () => ({ Authorization: 'Bearer ses_fixture' }) });
    tablet.online();
    tablet.socket().deliver(DEVICE_REVOKED_MESSAGE.revoked.value);
    tablet.socket().serverClose(1006);
    expect(tablet.ends).toMatchObject([{ kind: 'DEVICE_REVOKED', closeCode: 1006, deviceRevoked: 'REVOKED' }]);
    expect(tablet.clock.timeouts).toEqual([]);
    tablet.client.stop();

    // A bearer value the server refused in hello, then a socket error: no loop with the same value.
    for (const [hello, kind] of [
      [SESSION_INVALID, 'SESSION_ENDED'],
      [DEVICE_REVOKED, 'DEVICE_REVOKED'],
    ] as const) {
      const refused = harness({ headers: () => ({ Authorization: 'Bearer dvc_fixture' }) });
      refused.client.start();
      refused.socket().deliver(hello);
      refused.socket().fail();
      expect(refused.ends).toMatchObject([{ kind, closeCode: null, helloReason: hello.reason }]);
      expect(refused.clock.timeouts).toEqual([]);
      refused.client.stop();
    }
  });

  it('web: a cookie that no longer resolves stays connected as ANONYMOUS, and an ordinary close reconnects', () => {
    const h = harness();
    h.client.start();
    h.socket().deliver(SESSION_INVALID);
    expect(h.client.getStatus()).toMatchObject({ link: 'ONLINE', principal: 'ANONYMOUS', helloReason: 'SESSION_INVALID' });
    h.socket().deliver(beat(1));
    h.socket().serverClose(1001);
    expect(h.ends).toEqual([]);
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    expect(h.sockets).toHaveLength(2);
    h.client.stop();
  });

  it('reconnect(reason) after an end opens a new socket at once, with headers asked afresh', () => {
    let bearer: string | null = 'Bearer ses_fixture';
    const h = harness({ headers: () => (bearer === null ? null : { Authorization: bearer }) });
    h.online();
    h.socket().deliver(SESSION_ENDED.signedOut.value);
    h.socket().serverClose(4401);
    h.take();
    // The app dropped the session token; the device credential is what is left.
    bearer = 'Bearer dvc_fixture';
    expect(h.client.reconnect('SIGN_OUT')).toBe(true);
    expect(h.sockets).toHaveLength(2);
    expect(h.socket().headers).toEqual({ Authorization: 'Bearer dvc_fixture' });
    expect(h.client.getStatus()).toMatchObject({ link: 'CONNECTING', end: null, lastReconnectReason: 'SIGN_OUT', lastCloseCode: null });
    h.socket().deliver(DEVICE);
    expect(h.take()).toEqual(['link:OFFLINE>CONNECTING', 'hello:DEVICE#2', 'link:CONNECTING>ONLINE']);
    h.client.stop();
  });

  it('reconnect(reason) on an open socket closes it with 1000 and holds exactly one socket', () => {
    const h = harness();
    const first = h.online();
    h.take();
    expect(h.client.reconnect('SIGN_IN')).toBe(true);
    expect(first.closedWith).toEqual({ code: 1000, reason: 'client reconnect' });
    expect(h.sockets.filter((socket) => socket.held())).toHaveLength(1);
    // A late message and a late close of the old socket change nothing.
    first.deliver(delta(11));
    first.serverClose(4401);
    expect(h.take()).toEqual(['link:ONLINE>CONNECTING']);
    expect(h.clock.timeouts).toEqual([]);
    h.socket().deliver(OPERATOR);
    h.socket().deliver(snapshot(11));
    // A deliberate reconnect is not a lost link: the cause is CONNECT and no RESYNCED is owed.
    expect(h.take()).toEqual(['hello:OPERATOR#2', 'snapshot:3/11:CONNECT', 'link:CONNECTING>ONLINE']);
    h.client.stop();
  });

  it('reconnect(reason) while waiting for the backoff cancels the timer: "Retry now" connects at once', () => {
    const h = harness();
    h.online();
    h.socket().serverClose(1001);
    expect(h.clock.pendingTimeouts()).toBe(1);
    expect(h.client.reconnect('RETRY')).toBe(true);
    expect(h.clock.pendingTimeouts()).toBe(0);
    expect(h.sockets).toHaveLength(2);
    h.clock.advance(60_000);
    // Only the deadline of the new socket acted since; the cancelled timer opened nothing.
    expect(h.sockets.filter((socket) => socket.held()).length).toBeLessThanOrEqual(1);
    h.client.stop();
  });

  it('reconnect(reason) does nothing before start() and after stop()', () => {
    const h = harness();
    expect(h.client.reconnect('RETRY')).toBe(false);
    h.client.start();
    h.client.stop();
    expect(h.client.reconnect('RETRY')).toBe(false);
    expect(h.sockets).toHaveLength(1);
    expect(h.clock.pending()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// stop()
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('stop() closes cleanly and leaves no timer', () => {
  const PHASES: [string, (h: ReturnType<typeof harness>) => void][] = [
    ['just started', (h) => h.client.start()],
    [
      'after hello',
      (h) => {
        h.client.start();
        h.socket().deliver(OPERATOR);
      },
    ],
    ['online', (h) => void h.online()],
    ['a resync pending', (h) => h.online().deliver(delta(12))],
    [
      'a second resync waiting for the 2 s rule',
      (h) => {
        h.online().deliver(delta(12));
        h.socket().deliver(snapshot(20));
        h.socket().deliver(delta(30));
      },
    ],
    ['waiting for the backoff', (h) => h.online().serverClose(1001)],
    ['ended by 4401', (h) => h.online().serverClose(4401)],
    ['ended by 4403', (h) => h.online().serverClose(4403)],
    [
      'closed before hello, waiting for the backoff',
      (h) => {
        h.client.start();
        h.socket().serverClose(1006);
      },
    ],
  ];

  it.each(PHASES)('%s: no timer is left, the socket is closed with 1000, both views are OFFLINE', (_name, arrange) => {
    const h = harness();
    arrange(h);
    const held = h.sockets.filter((socket) => socket.held());
    expect(h.clock.pending()).toBeGreaterThan(0);
    h.client.stop();
    expect(h.clock.pending()).toBe(0);
    for (const socket of held) expect(socket.closedWith).toEqual({ code: 1000, reason: 'client stopped' });
    expect(h.sockets.filter((socket) => socket.held())).toEqual([]);
    expect(h.client.getStatus()).toMatchObject({ link: 'OFFLINE', running: false, principal: null, synced: false, resync: null });
    expect(h.client.getSnapshot().state).toBe('OFFLINE');

    // Nothing happens afterwards: no timer fires, no socket opens, no handler is called.
    const sockets = h.sockets.length;
    h.take();
    h.clock.advance(120_000);
    for (const socket of h.sockets) {
      socket.deliver(snapshot(99));
      socket.serverClose(1001);
    }
    h.client.setMetersWanted(false);
    expect(h.sockets).toHaveLength(sockets);
    expect(h.take()).toEqual([]);
    expect(h.clock.pending()).toBe(0);
    h.client.stop();
  });

  it('messages and a close of the stopped socket that were kept by the runtime are ignored', () => {
    const h = harness();
    const first = h.online();
    const { onmessage, onclose } = first;
    h.client.stop();
    h.take();
    onmessage?.({ data: JSON.stringify(delta(11)) });
    onclose?.({ code: 4401 });
    expect(h.take()).toEqual([]);
    expect(h.ends).toEqual([]);
    expect(h.clock.pending()).toBe(0);
  });

  it('start() after stop() begins a new run: a new socket, attempt 0, CONNECT as the cause', () => {
    const h = harness();
    h.online().serverClose(1001);
    expect(h.client.getSnapshot().reconnectAttempt).toBe(1);
    h.client.stop();
    h.take();
    h.client.start();
    expect(h.sockets).toHaveLength(2);
    expect(h.client.getSnapshot()).toMatchObject({ state: 'CONNECTING', reconnectAttempt: 0 });
    h.socket().deliver(OPERATOR);
    h.socket().deliver(snapshot(10));
    expect(h.take()).toEqual(['link:OFFLINE>CONNECTING', 'hello:OPERATOR#2', 'snapshot:3/10:CONNECT', 'link:CONNECTING>ONLINE']);
    h.client.stop();
    expect(h.clock.pending()).toBe(0);
  });

  it('stop() called from inside the headers function: the socket that was being opened is closed and not kept', () => {
    const h = harness({
      headers: () => {
        h.client.stop();
        return { Authorization: 'Bearer dvc_fixture' };
      },
    });
    h.client.start();
    expect(h.sockets).toHaveLength(1);
    expect(h.socket().closedWith).toEqual({ code: 1000, reason: 'client stopped' });
    expect(h.socket().held()).toBe(false);
    expect(h.client.getStatus()).toMatchObject({ link: 'OFFLINE', running: false, connection: 0 });
    expect(h.clock.pending()).toBe(0);
  });

  it('a socket whose close() throws does not stop stop()', () => {
    const h = harness();
    h.client.start();
    h.socket().close = () => {
      throw new Error('not open yet');
    };
    expect(() => h.client.stop()).not.toThrow();
    expect(h.clock.pending()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Validation and errors (CL-10)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('every incoming frame is validated; nothing is thrown out of a socket callback (CL-10)', () => {
  const LEAK = 'ses_LEAK-fixture';

  it('an invalid frame is dropped, counted and reported with a code, and the report never holds the frame', () => {
    const h = harness();
    h.online();
    h.take();
    const before = h.client.getStatus();
    const frames: [string, () => void][] = [
      ['NON_TEXT_FRAME', () => h.socket().raw({ secret: LEAK })],
      ['NON_TEXT_FRAME', () => h.socket().raw(new Uint8Array([1, 2, 3]))],
      ['INVALID_JSON', () => h.socket().raw(`${LEAK} is not json`)],
      ['SCHEMA_MISMATCH', () => h.socket().deliver({ type: LEAK })],
      ['SCHEMA_MISMATCH', () => h.socket().deliver(null)],
      ['SCHEMA_MISMATCH', () => h.socket().deliver({ ...snapshot(11), state: { ...STATE, token: LEAK } })],
      ['SCHEMA_MISMATCH', () => h.socket().deliver({ ...delta(11), revision: LEAK })],
      ['SCHEMA_MISMATCH', () => h.socket().deliver({ ...OPERATOR, connectionId: LEAK })],
      ['SCHEMA_MISMATCH', () => h.socket().deliver({ ...meters(1), bearer: LEAK })],
      ['SCHEMA_MISMATCH', () => h.socket().deliver({ ...beat(1), serverTime: LEAK })],
      ['SCHEMA_MISMATCH', () => h.socket().deliver({ ...SESSION_ENDED.signedOut.value, reason: LEAK })],
    ];
    for (const [, send] of frames) expect(send).not.toThrow();

    expect(h.errors.map((report) => report.code)).toEqual(frames.map(([code]) => code));
    expect(h.take()).toEqual([]);
    expect(JSON.stringify(h.errors)).not.toContain('LEAK');
    for (const report of h.errors) {
      expect(report).toMatchObject({ level: 'error', source: LIVE_SOCKET_ERROR_SOURCE, at: T0, connection: 1, connectionId: OPERATOR.connectionId });
    }
    const after = h.client.getStatus();
    expect(after.counters.invalid - before.counters.invalid).toBe(frames.length);
    expect(after.counters.errors - before.counters.errors).toBe(frames.length);
    expect(after.counters.received - before.counters.received).toBe(frames.length);
    // The state did not move, and the next valid delta is still applied.
    expect(after).toMatchObject({ link: 'ONLINE', revision: 10, principal: 'OPERATOR' });
    h.socket().deliver(delta(11));
    expect(h.take()).toEqual(['delta:3/11']);
    h.client.stop();
  });

  it('a schema report names the message type, the issue and the place, with member names only', () => {
    const h = harness();
    h.online();
    h.socket().deliver({ ...delta(11), revision: 'eleven' });
    h.socket().deliver({ ...snapshot(11), state: { ...STATE, token: LEAK } });
    h.socket().deliver({
      ...delta(11),
      ops: [{ op: 'append', slice: 'events', rows: [{ ...EVENT_ROW, params: { [LEAK]: { nested: true } } }] }],
    });
    h.socket().deliver({ type: 'unknown.message' });
    expect(h.errors.map((report) => [report.messageType, report.issue, report.path])).toEqual([
      ['delta', 'invalid_type', 'revision'],
      ['snapshot', 'unrecognized_keys', 'state'],
      ['delta', expect.any(String), 'ops.0.rows.0.params.?'],
      [undefined, expect.any(String), 'type'],
    ]);
    expect(JSON.stringify(h.errors)).not.toContain('LEAK');
    h.client.stop();
  });

  it('a delta the schema refuses is dropped; the next delta shows the gap and the client resynchronises', () => {
    const h = harness();
    h.online();
    h.take();
    h.socket().deliver({ ...delta(11), ops: [] });
    expect(h.client.getStatus()).toMatchObject({ link: 'ONLINE', revision: 10 });
    h.socket().deliver(delta(12));
    expect(h.take()).toEqual(['link:ONLINE>RESYNCING', 'resync:RESYNCING:GAP']);
    expect(h.resyncsOf(h.socket())).toBe(1);
    h.client.stop();
  });

  it('a message before hello, and a second hello, are dropped and reported; a heartbeat before hello feeds the view', () => {
    const h = harness();
    h.client.start();
    h.socket().deliver(snapshot(10));
    h.socket().deliver(delta(11));
    h.socket().deliver(beat(4));
    expect(h.client.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 4 });
    expect(h.client.getStatus().link).toBe('CONNECTING');
    h.socket().deliver(OPERATOR);
    h.socket().deliver(SUPERVISOR);
    expect(h.errors.map((report) => [report.code, report.messageType, report.connectionId])).toEqual([
      ['MESSAGE_BEFORE_HELLO', 'snapshot', null],
      ['MESSAGE_BEFORE_HELLO', 'delta', null],
      ['UNEXPECTED_HELLO', 'hello', OPERATOR.connectionId],
    ]);
    // The principal is the one of the first hello.
    expect(h.client.getStatus()).toMatchObject({ principal: 'OPERATOR', topics: OPERATOR.topics, counters: { invalid: 3 } });
    expect(h.take()).toEqual(['hello:OPERATOR#1']);
    h.client.stop();
  });

  it('a handler that throws never escapes a socket callback: it is reported, and the client goes on', () => {
    const boom = new RangeError(`handler failed on ${LEAK}`);
    const errors: LiveSocketErrorReport[] = [];
    const fail = () => {
      throw boom;
    };
    const h = harness({
      onHello: fail,
      onSnapshot: fail,
      onDelta: fail,
      onMeters: fail,
      onControl: fail,
      onServerTime: fail,
      onLinkChange: fail,
      onResync: fail,
      onEnd: fail,
      onError: (report) => errors.push(report),
    });
    h.client.subscribe(fail);
    expect(() => {
      h.client.start();
      h.socket().deliver(OPERATOR);
      h.socket().deliver(snapshot(10));
      h.socket().deliver(delta(11));
      h.socket().deliver(meters(1));
      h.socket().deliver(beat(1));
      h.socket().deliver(delta(20));
      h.socket().deliver(SESSION_ENDED.signedOut.value);
      h.socket().serverClose(4401);
    }).not.toThrow();
    expect(new Set(errors.map((report) => report.code))).toEqual(new Set(['HANDLER_FAILED']));
    expect(new Set(errors.map((report) => report.handler))).toEqual(
      new Set(['onHello', 'onSnapshot', 'onDelta', 'onMeters', 'onControl', 'onServerTime', 'onLinkChange', 'onResync', 'onEnd', 'subscribe']),
    );
    for (const report of errors) {
      expect(report).toMatchObject({ level: 'error', errorName: 'RangeError' });
      // The consumer's own exception is handed back as it is; the client copies no text of it.
      expect(report.cause).toBe(boom);
      expect(JSON.stringify({ ...report, cause: undefined })).not.toContain('LEAK');
    }
    // The client's own state was kept right throughout.
    expect(h.client.getStatus()).toMatchObject({ link: 'OFFLINE', end: { kind: 'SESSION_ENDED', sessionEnded: 'SIGNED_OUT' }, revision: 11, counters: { deltas: 1, snapshots: 1 } });
    h.client.stop();
    expect(h.clock.pending()).toBe(0);
  });

  it('an onError that throws never escapes either, and the report is still counted', () => {
    const h = harness({
      onError: () => {
        throw new Error('the sink is down');
      },
    });
    h.client.start();
    expect(() => h.socket().raw('not json')).not.toThrow();
    expect(() => h.socket().deliver({ type: 'nope' })).not.toThrow();
    expect(h.client.getStatus().counters).toMatchObject({ invalid: 2, errors: 2 });
    h.client.stop();
  });

  it('a failure inside the client itself does not escape a socket callback or a timer callback either', () => {
    let broken = false;
    const clock = manualClock(T0);
    const sockets: FakeSocket[] = [];
    const reports: LiveSocketErrorReport[] = [];
    const client = createLiveSocketClient({
      url: SOCKET_URL,
      socketFactory: (url, headers) => {
        const socket = new FakeSocket(url, headers, clock.now);
        sockets.push(socket);
        return socket;
      },
      // The injected clock is the one function the client calls outside a handler: it fails here.
      now: () => {
        if (broken) throw new EvalError('the clock failed');
        return clock.now();
      },
      timers: clock.timers,
      onError: (report) => reports.push(report),
    });
    client.start();
    sockets[0]?.deliver(ANONYMOUS);
    broken = true;
    expect(() => sockets[0]?.deliver(beat(1))).not.toThrow();
    expect(() => clock.advance(HOUSEKEEPING_MS)).not.toThrow();
    broken = false;
    // Both failures were counted; the report of each could not be built while the clock failed.
    expect(client.getStatus().counters.errors).toBe(2);
    expect(reports).toEqual([]);
    sockets[0]?.raw('not json');
    expect(reports.map((report) => report.code)).toEqual(['INVALID_JSON']);
    client.stop();
    expect(clock.pending()).toBe(0);
  });

  it('without an onError the client still counts, and writes nothing to the console', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const clock = manualClock(T0);
    const sockets: FakeSocket[] = [];
    const client = createLiveSocketClient({
      url: SOCKET_URL,
      socketFactory: (url, headers) => {
        const socket = new FakeSocket(url, headers, clock.now);
        sockets.push(socket);
        return socket;
      },
      now: clock.now,
      timers: clock.timers,
    });
    client.start();
    sockets[0]?.raw('not json');
    sockets[0]?.deliver({ type: 'nope' });
    sockets[0]?.raw(42);
    expect(client.getStatus().counters).toMatchObject({ received: 3, invalid: 3, errors: 3 });
    client.stop();
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  it('a socket factory that throws is reported and retried with the backoff', () => {
    let fail = true;
    const clock = manualClock(T0);
    const errors: LiveSocketErrorReport[] = [];
    const sockets: FakeSocket[] = [];
    const client = createLiveSocketClient({
      url: SOCKET_URL,
      socketFactory: (url, headers) => {
        if (fail) throw new TypeError(`cannot open ${LEAK}`);
        const socket = new FakeSocket(url, headers, clock.now);
        sockets.push(socket);
        return socket;
      },
      now: clock.now,
      random: () => 0,
      timers: clock.timers,
      onError: (report) => errors.push(report),
    });
    expect(() => client.start()).not.toThrow();
    expect(client.getStatus()).toMatchObject({ link: 'OFFLINE', connection: 0 });
    expect(client.getSnapshot()).toMatchObject({ state: 'OFFLINE', reconnectAttempt: 1 });
    clock.advance(RECONNECT_BACKOFF_MS[0]);
    expect(clock.timeouts).toEqual([RECONNECT_BACKOFF_MS[0], RECONNECT_BACKOFF_MS[1]]);
    fail = false;
    clock.advance(RECONNECT_BACKOFF_MS[1]);
    expect(sockets).toHaveLength(1);
    expect(errors.map((report) => [report.code, report.errorName])).toEqual([
      ['SOCKET_FACTORY_FAILED', 'TypeError'],
      ['SOCKET_FACTORY_FAILED', 'TypeError'],
    ]);
    expect(JSON.stringify(errors)).not.toContain('LEAK');
    client.stop();
    expect(clock.pending()).toBe(0);
  });

  const BAD_HEADERS: [string, LiveSocketHeadersProvider][] = [
    [
      'throws',
      () => {
        throw new Error(`secure store failed for ${LEAK}`);
      },
    ],
    ['returns a value with a line break', () => ({ Authorization: `Bearer ${LEAK}\r\nX-Injected: 1` })],
    ['returns a name that is not a header name', () => ({ 'Bad Name': 'value' })],
    ['returns a value that is not text', () => ({ Authorization: 42 as unknown as string })],
  ];

  it.each(BAD_HEADERS)('a headers function that %s opens no socket, is reported without its text, and is asked again', (_name, headers) => {
    const h = harness({ headers });
    expect(() => h.client.start()).not.toThrow();
    expect(h.sockets).toHaveLength(0);
    expect(h.errors.map((report) => report.code)).toEqual(['HEADERS_FAILED']);
    expect(JSON.stringify(h.errors)).not.toContain('LEAK');
    expect(h.client.getStatus().link).toBe('OFFLINE');
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    expect(h.errors).toHaveLength(2);
    expect(h.sockets).toHaveLength(0);
    h.client.stop();
    expect(h.clock.pending()).toBe(0);
  });

  it('a send that throws is reported; the socket is given up and the backoff starts', () => {
    const h = harness();
    h.client.start();
    const first = h.socket();
    first.failSend = true;
    expect(() => first.deliver(OPERATOR)).not.toThrow();
    expect(h.errors.map((report) => [report.code, report.errorName])).toEqual([['SEND_FAILED', 'TypeError']]);
    expect(first.closedWith).toEqual({ code: 1000, reason: 'client gave up' });
    expect(h.client.getStatus()).toMatchObject({ link: 'OFFLINE', metersSubscribed: false });
    expect(h.clock.timeouts).toEqual([RECONNECT_BACKOFF_MS[0]]);
    h.clock.advance(RECONNECT_BACKOFF_MS[0]);
    h.socket().deliver(OPERATOR);
    expect(h.socket().sent()).toEqual([{ type: 'subscribe', topic: 'meters' }]);
    h.client.stop();
  });

  it('a handler may call stop(): nothing more is handed on, and no timer is left', () => {
    const stopOnSnapshot = harness({
      onSnapshot: () => {
        stopOnSnapshot.log.push('snapshot');
        stopOnSnapshot.client.stop();
      },
    });
    stopOnSnapshot.online();
    expect(stopOnSnapshot.log).toEqual(['hello:OPERATOR#1', 'snapshot', 'link:CONNECTING>OFFLINE']);
    expect(stopOnSnapshot.clock.pending()).toBe(0);
    expect(stopOnSnapshot.socket().closedWith).toEqual({ code: 1000, reason: 'client stopped' });
  });

  it('a handler may call reconnect(): onEnd opens the anonymous socket of the web console at once', () => {
    const h = harness({
      onEnd: (end) => {
        h.log.push(`end:${end.kind}`);
        h.client.reconnect('SIGN_OUT');
      },
    });
    h.online();
    h.take();
    h.socket().deliver(SESSION_ENDED.idleExpired.value);
    h.socket().serverClose(4401);
    expect(h.take()).toEqual(['control:session.ended', 'link:ONLINE>OFFLINE', 'end:SESSION_ENDED', 'link:OFFLINE>CONNECTING']);
    expect(h.sockets).toHaveLength(2);
    expect(h.sockets.filter((socket) => socket.held())).toHaveLength(1);
    h.socket().deliver(SESSION_INVALID);
    expect(h.take()).toEqual(['hello:ANONYMOUS#2', 'link:CONNECTING>ONLINE']);
    expect(h.client.getStatus()).toMatchObject({ link: 'ONLINE', principal: 'ANONYMOUS', end: null });
    h.client.stop();
    expect(h.clock.pending()).toBe(0);
  });
});
