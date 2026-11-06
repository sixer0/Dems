/**
 * Live socket client: the one socket of a client in Live mode (backend task 2026-10-04:
 * 04_client_integration_spec §2.2, CL-7 to CL-11b; 01_specs §9; plan row W30).
 *
 * It stands beside `heartbeat-client.ts` and does not replace it: Simulated mode and the packaged
 * build keep the heartbeat client against mock-core. In Live mode this client owns the single
 * socket to the Core server, and the heartbeat view the existing readers use is fed from it.
 *
 * | Rule | How it is met here |
 * |------|--------------------|
 * | CL-7 | `LiveSocketClient` extends `HeartbeatClient`: `subscribe`, `getSnapshot`, `start`, `stop` behave as in the heartbeat client, fed by the `heartbeat` messages of the same socket. At most one socket exists at any time |
 * | CL-8 | Built from `{ url, socketFactory, headers }`. The web console passes no `headers` (the browser attaches the cookie). The mobile app passes a function that returns `{ Authorization: 'Bearer ...' }`; it is asked at every connect and its value goes to the upgrade request only, never into the URL, a subprotocol or a message (01_specs §9.2, SR-38) |
 * | CL-9 | Reconnect delays come from `reconnectDelayMs`, which reads `RECONNECT_BACKOFF_MS` and `RECONNECT_JITTER_MS`; stale after `HEARTBEAT_STALE_AFTER_MS` |
 * | CL-10 | Every text frame is parsed with `WsServerMessageSchema`. A frame that fails is dropped, counted and reported through `onError` with a code; its content is never handed on |
 * | CL-11 | Close 4401 and 4403 end the run and are reported through `onEnd`; nothing reconnects by itself. Every other close reconnects with the backoff. A revision gap or a newer epoch sends `resync`, at most one in `REALTIME_RESYNC_MIN_INTERVAL_MS` |
 * | CL-11a | `reconnect(reason)` closes the socket and opens a new one at once |
 * | CL-11b | `setMetersWanted(wanted)`: `subscribe` or `unsubscribe` of the `meters` topic, sent only on an OPERATOR socket that was given the topic, and again after every reconnect |
 *
 * Phases (internal) and the link state a consumer sees:
 *
 * | Phase | Meaning | Link |
 * |-------|---------|------|
 * | IDLE | Not started, or stopped | CONNECTING before the first `start()`, OFFLINE after `stop()` |
 * | CONNECTING | A socket exists; no `hello` yet | CONNECTING |
 * | OPEN | `hello` arrived | STALE when no `hello` or `heartbeat` for 2,500 ms; else CONNECTING until the snapshot of this connection (only when the `state` topic was given); else RESYNCING while a resync is pending; else ONLINE |
 * | WAITING | No socket; the reconnect timer runs | OFFLINE |
 * | ENDED | No socket, no reconnect: the server ended the session or revoked the device | OFFLINE |
 *
 * | Phase | Event | Next phase | Action |
 * |-------|-------|-----------|--------|
 * | IDLE | `start()` | CONNECTING | Ask `headers`, open a socket, start the 500 ms housekeeping interval, arm the sync deadline |
 * | CONNECTING | `hello` | OPEN | `onHello`; `subscribe` meters when wanted and allowed; arm the deadline for the snapshot when the `state` topic was given |
 * | CONNECTING, OPEN | `heartbeat` | same | Heartbeat view LIVE (attempt reset after a reconnect); `onServerTime` |
 * | OPEN | `snapshot` | OPEN | Take its epoch and revision; end a pending resync; `onSnapshot`, then `onResync` RESYNCED when one was owed |
 * | OPEN | `delta`, revision = last + 1, same epoch | OPEN | `onDelta` |
 * | OPEN | `delta` with a gap, or of a newer epoch | OPEN | Dropped; resync pending; `resync` sent when the 2 s rule allows; `onResync` RESYNCING |
 * | OPEN | `delta` while a resync is pending, or before the snapshot | OPEN | Dropped: the coming snapshot holds its effect |
 * | OPEN | `delta` at or below the last revision, or of an older epoch | OPEN | Dropped as already applied |
 * | OPEN | `meters` | OPEN | Kept as the one latest frame and passed to `onMeters`; dropped when not wanted or not newer |
 * | OPEN | `session.updated`, `session.ended`, `device.revoked`, `admin.changed` | OPEN | `onControl` |
 * | CONNECTING, OPEN | close 4401; or any close after `session.ended`, or after a `hello` that refused a bearer value as SESSION_INVALID | ENDED | `onEnd` SESSION_ENDED |
 * | CONNECTING, OPEN | close 4403; or any close after `device.revoked`, or after a `hello` that refused a bearer value as DEVICE_REVOKED | ENDED | `onEnd` DEVICE_REVOKED |
 * | CONNECTING, OPEN | any other close (1001, 1008, 1013, 4408, 1000, 1006, none), a socket error | WAITING | Reconnect timer of `reconnectDelayMs(attempt)`; attempt + 1 |
 * | CONNECTING, OPEN | sync deadline passed (no `hello`, no snapshot, no answer to `resync`) | WAITING | Reported; the socket is closed; reconnect timer |
 * | WAITING | timer | CONNECTING | Open a socket |
 * | any but IDLE | `reconnect(reason)` | CONNECTING | Cancel the timer, close the socket with 1000, open a new one at once |
 * | any but IDLE | `stop()` | IDLE | Cancel both timers, close the socket with 1000 |
 *
 * Ordering guarantee. `onDelta` is called only when a `snapshot` of the same connection with the
 * same epoch was handed to `onSnapshot` before, and the delta's revision is exactly the revision of
 * the last state message handed on plus 1. After a reconnect no delta is handed on before the
 * snapshot of the new connection.
 *
 * Resync reports. Every `onResync` RESYNCING is followed by exactly one RESYNCED, unless the run
 * ends first (`onEnd`, `stop()`). A lost link is not reported as RESYNCING (the link turns
 * OFFLINE); when the link is back, RESYNCED with the cause RECONNECT is reported once.
 *
 * Nothing thrown inside a socket callback, a timer callback or a consumer's handler leaves this
 * file: it is caught, counted and reported through `onError`. A report holds a code, counters and
 * names from the contract only: no frame content, no header value and no text of an exception.
 * The client writes nothing to the console; the consumer owns the persistent error log.
 *
 * Platform neutral: the socket constructor, the headers, the clock, the random source and the
 * timer functions are injected; the defaults are the global `WebSocket`, `Date.now`,
 * `Math.random` and the global timer functions, which every target runtime provides.
 *
 * Loading this file does nothing: it holds declarations only. A socket is opened only by
 * `createLiveSocketClient(...).start()`, which the Live source calls and no Simulated build does.
 */
import { HEARTBEAT_STALE_AFTER_MS, REALTIME_CLIENT_MESSAGE_LIMIT, REALTIME_RESYNC_MIN_INTERVAL_MS } from '../api/constants';
import {
  REALTIME_SERVER_MESSAGES,
  RealtimeCloseCode,
  RealtimeHelloReason,
  RealtimePrincipal,
  RealtimeTopic,
  WsServerMessageSchema,
  canReceiveRealtimeMessage,
  canSendRealtimeMessage,
  type AdminChangedMessage,
  type DeltaMessage,
  type DeviceRevokedMessage,
  type DeviceRevokedReason,
  type Heartbeat,
  type HelloMessage,
  type MetersMessage,
  type SessionEndedMessage,
  type SessionEndedReason,
  type SessionUpdatedMessage,
  type SnapshotMessage,
  type WsClientMessage,
  type WsServerMessage,
} from '../api/realtime-messages';
import { HeartbeatState } from '../domain/enums';
import type { LiveLinkState } from '../live/mode';
import {
  NORMAL_CLOSURE,
  STALE_CHECK_INTERVAL_MS,
  reconnectDelayMs,
  type HeartbeatClient,
  type HeartbeatSnapshot,
  type SocketLike,
} from './heartbeat-client';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * How long the client waits for the message that must come next: `hello` after the socket was
 * opened, the `snapshot` after an OPERATOR `hello`, the `snapshot` after a `resync`. When it does
 * not come the socket is closed and the reconnect backoff starts, because a new connection always
 * begins with a snapshot (01_specs RT-6). The value of `LIVE_BOOT_TIMEOUT_MS` (§2.4).
 */
export const LIVE_SOCKET_SYNC_TIMEOUT_MS = 4_000;

/**
 * Added to `REALTIME_RESYNC_MIN_INTERVAL_MS` between two `resync` messages, so that two messages
 * sent 2 s apart on the client clock cannot reach the server less than 2 s apart.
 */
export const LIVE_SOCKET_RESYNC_GUARD_MS = 250;

/**
 * Client messages this client sends on one connection within the period of
 * `REALTIME_CLIENT_MESSAGE_LIMIT` (01_specs RT-P5): half of what the server allows. A message
 * beyond it waits for the next housekeeping step.
 */
export const LIVE_SOCKET_SEND_BUDGET = Math.floor(REALTIME_CLIENT_MESSAGE_LIMIT.count / 2);

/** `source` of every error report of this file. */
export const LIVE_SOCKET_ERROR_SOURCE = 'live-socket-client';

/** `ws://` or `wss://`, a host, an optional path: no user information, no query and no fragment (SR-38). */
const SOCKET_URL_PATTERN = /^wss?:\/\/[^\s/?#@]+(?:\/[^\s?#]*)?$/;
const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
/** Printable ASCII: a value that cannot break out of its header line. */
const HEADER_VALUE_PATTERN = /^[\x20-\x7E]{1,4096}$/;
/** A member name that may appear in a reported path. An underscore is refused, so no bearer value fits. */
const REPORTABLE_MEMBER_PATTERN = /^[A-Za-z][A-Za-z0-9-]{0,39}$/;
const REPORTABLE_PATH_DEPTH = 8;

/** The link states, equal by construction to `LiveLinkState` of the light Live API. */
const LINK = {
  CONNECTING: 'CONNECTING',
  ONLINE: 'ONLINE',
  STALE: 'STALE',
  OFFLINE: 'OFFLINE',
  RESYNCING: 'RESYNCING',
} as const satisfies { readonly [State in LiveLinkState]: State };

// ═══════════════════════════════════════════════════════════════════════════════════════
// Injected parts
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The socket this client needs: the heartbeat client's `SocketLike` plus `send`. */
export interface LiveSocketLike extends SocketLike {
  send(data: string): void;
}

/** Headers of the upgrade request. The mobile app sends `{ Authorization: 'Bearer ...' }` (CL-8). */
export type LiveSocketHeaders = Readonly<Record<string, string>>;

/** Opens a socket. `headers` is `undefined` when there is none to send, as on the web console. */
export type LiveSocketFactory = (url: string, headers: LiveSocketHeaders | undefined) => LiveSocketLike;

/** Returns the headers of the next upgrade request, or nothing. Asked at every connect; synchronous. */
export type LiveSocketHeadersProvider = () => LiveSocketHeaders | null | undefined;

/** The timer functions. A handle is opaque: whatever `setTimeout` returned goes back to `clearTimeout`. */
export interface LiveSocketTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// What a consumer is told
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The four control messages of 01_specs §9.4. */
export type LiveSocketControlMessage = SessionUpdatedMessage | SessionEndedMessage | DeviceRevokedMessage | AdminChangedMessage;

/**
 * Why a snapshot arrived.
 * - `CONNECT`: the first snapshot of a connection opened by `start()` or `reconnect()`.
 * - `RECONNECT`: the first snapshot of a connection opened after the link was lost.
 * - `RESYNC`: it ends a pending resync (a gap, a newer epoch, or `requestResync()`).
 * - `EPOCH`: not asked for, and its epoch differs: a demo reset or a scenario load (RT-7).
 * - `REFRESH`: not asked for, same epoch. The server has no reason to send one; it is applied.
 */
export type LiveSocketSnapshotCause = 'CONNECT' | 'RECONNECT' | 'RESYNC' | 'EPOCH' | 'REFRESH';

/** Why the replica stopped being current: a revision gap, a delta of a newer epoch, the consumer's request, a lost link. */
export type LiveSocketResyncCause = 'GAP' | 'EPOCH' | 'REQUESTED' | 'RECONNECT';

/**
 * `RESYNCING`: the replica is behind and a snapshot is awaited (never with the cause `RECONNECT`:
 * a lost link is told by `onLinkChange`). `RESYNCED`: the snapshot arrived, or, on a connection
 * without the `state` topic, the link is back.
 */
export interface LiveSocketResyncEvent {
  readonly phase: 'RESYNCING' | 'RESYNCED';
  readonly cause: LiveSocketResyncCause;
}

export interface LiveSocketConnectionInfo {
  /** Counts the sockets this client opened; 1 is the first. */
  readonly connection: number;
}

export interface LiveSocketSnapshotInfo extends LiveSocketConnectionInfo {
  readonly cause: LiveSocketSnapshotCause;
}

/** A reading of the server clock, in one form whatever the message's own form was (contract B, F-4). */
export interface LiveSocketServerTime {
  /** Epoch milliseconds on the server clock. */
  readonly serverTime: number;
  /** The injected clock at the moment the message arrived. */
  readonly receivedAt: number;
  readonly source: 'hello' | 'heartbeat';
}

/** Why the server ended the run. Nothing reconnects by itself afterwards; `reconnect()` opens a new socket. */
export interface LiveSocketEnd {
  /** `SESSION_ENDED`: close 4401, show the login screen. `DEVICE_REVOKED`: close 4403, delete the credential and show the pairing screen. */
  readonly kind: 'SESSION_ENDED' | 'DEVICE_REVOKED';
  /** The close code as the runtime gave it; `null` when it gave none. */
  readonly closeCode: number | null;
  /** `reason` of the `session.ended` of this connection; `null` when none came (an invalid cookie or bearer value). */
  readonly sessionEnded: SessionEndedReason | null;
  /** `reason` of the `device.revoked` of this connection; `null` when none came. */
  readonly deviceRevoked: DeviceRevokedReason | null;
  /** `hello.reason` of this connection: the server did not accept the credential at the upgrade. */
  readonly helloReason: RealtimeHelloReason | null;
  /** Who the server took the connection for; `null` when it closed before `hello`. */
  readonly principal: RealtimePrincipal | null;
  readonly at: number;
}

export const LiveSocketErrorCode = {
  /** A frame that is not text. */
  NON_TEXT_FRAME: 'NON_TEXT_FRAME',
  /** A text frame that is not JSON. */
  INVALID_JSON: 'INVALID_JSON',
  /** JSON that the contract's union refuses. */
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  /** A message other than `heartbeat` before `hello`. */
  MESSAGE_BEFORE_HELLO: 'MESSAGE_BEFORE_HELLO',
  /** A second `hello` on one connection: the principal is fixed at the upgrade. */
  UNEXPECTED_HELLO: 'UNEXPECTED_HELLO',
  /** A message the principal of this connection is never sent (01_specs §9.2). */
  MESSAGE_NOT_FOR_PRINCIPAL: 'MESSAGE_NOT_FOR_PRINCIPAL',
  /** A delta before the snapshot of its connection. Reported once per connection. */
  DELTA_BEFORE_SNAPSHOT: 'DELTA_BEFORE_SNAPSHOT',
  /** The message that had to come next did not come within `syncTimeoutMs`. */
  SYNC_TIMEOUT: 'SYNC_TIMEOUT',
  /** The socket factory threw. */
  SOCKET_FACTORY_FAILED: 'SOCKET_FACTORY_FAILED',
  /** The headers function threw, or returned a name or a value that cannot be a header. */
  HEADERS_FAILED: 'HEADERS_FAILED',
  /** `send` threw. The socket is closed and the reconnect backoff starts. */
  SEND_FAILED: 'SEND_FAILED',
  /** A handler or a listener of the consumer threw. */
  HANDLER_FAILED: 'HANDLER_FAILED',
  /** Anything else caught at the edge of a socket or timer callback. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type LiveSocketErrorCode = (typeof LiveSocketErrorCode)[keyof typeof LiveSocketErrorCode];

export type LiveSocketHandlerName =
  | 'onHello'
  | 'onSnapshot'
  | 'onDelta'
  | 'onMeters'
  | 'onControl'
  | 'onServerTime'
  | 'onLinkChange'
  | 'onResync'
  | 'onEnd'
  | 'subscribe';

/**
 * One structured report. It never holds frame content, a header value or the text of an
 * exception. `connectionId` is `hello.connectionId`, which names the socket in the server's log.
 */
export interface LiveSocketErrorReport {
  readonly code: LiveSocketErrorCode;
  readonly level: 'error' | 'warn';
  readonly source: typeof LIVE_SOCKET_ERROR_SOURCE;
  /** The injected clock. */
  readonly at: number;
  readonly connection: number;
  readonly connectionId: string | null;
  /** The `type` of the message, when it is one of the contract's nine. */
  readonly messageType?: WsServerMessage['type'];
  /** SCHEMA_MISMATCH: the code of the first issue, e.g. `invalid_type`. */
  readonly issue?: string;
  /** SCHEMA_MISMATCH: where the first issue is. Member names and indices only; a name that is not plain is shown as `?`. */
  readonly path?: string;
  /** SYNC_TIMEOUT: what was awaited. */
  readonly waiting?: 'hello' | 'snapshot' | 'resync';
  /** HANDLER_FAILED: which handler threw. */
  readonly handler?: LiveSocketHandlerName;
  /** The class name of what was caught, e.g. `TypeError`. */
  readonly errorName?: string;
  /** HANDLER_FAILED only: the value the consumer's own handler threw, handed back untouched. */
  readonly cause?: unknown;
}

export interface LiveSocketCounters {
  /** Frames received. */
  readonly received: number;
  /** Frames dropped because they were not a valid message for this connection. */
  readonly invalid: number;
  readonly snapshots: number;
  /** Deltas handed to `onDelta`. */
  readonly deltas: number;
  /** Deltas dropped: a gap, a newer epoch, a pending resync, or before the snapshot. */
  readonly deltasDropped: number;
  /** Deltas dropped because the replica already holds them. */
  readonly deltasStale: number;
  /** Meter frames handed to `onMeters`. */
  readonly meters: number;
  readonly metersDropped: number;
  readonly control: number;
  /** Client messages sent. */
  readonly sent: number;
  /** `resync` messages sent. */
  readonly resyncs: number;
  /** Reconnect timers started after a lost link. */
  readonly reconnects: number;
  /** Error reports made, whether or not `onError` is set. */
  readonly errors: number;
}

/** A label for the consumer's own records. It is not sent to the server. */
export type LiveSocketReconnectReason = 'SIGN_IN' | 'SIGN_OUT' | 'CREDENTIAL' | 'RETRY' | 'OTHER';

export interface LiveSocketStatus {
  readonly link: LiveLinkState;
  /** True between `start()` and `stop()`. */
  readonly running: boolean;
  /** Sockets opened since the client was created. */
  readonly connection: number;
  readonly connectionId: string | null;
  /** From `hello`; `null` while there is no `hello` of the current connection. */
  readonly principal: RealtimePrincipal | null;
  readonly helloReason: RealtimeHelloReason | null;
  readonly topics: readonly RealtimeTopic[];
  /** Epoch and revision of the last state message handed on. Kept after a lost link: the replica still holds that state. */
  readonly epoch: number | null;
  readonly revision: number | null;
  /** True when the snapshot of the current connection was handed on and no resync is pending. */
  readonly synced: boolean;
  /** The cause of the pending resync, or `null`. */
  readonly resync: LiveSocketResyncCause | null;
  readonly metersWanted: boolean;
  /** What the server was last told on the current connection. */
  readonly metersSubscribed: boolean;
  /** Set by close 4401 or 4403 until the next `start()` or `reconnect()`. */
  readonly end: LiveSocketEnd | null;
  /** The code of the last close the runtime reported; `null` when it gave none or the client closed the socket. */
  readonly lastCloseCode: number | null;
  readonly lastReconnectReason: LiveSocketReconnectReason | null;
  readonly serverTime: LiveSocketServerTime | null;
  readonly counters: LiveSocketCounters;
}

/**
 * The consumer's handlers. Each is optional and is called synchronously, in the order the server
 * sent the messages. A handler may call any method of the client, `stop()` included.
 */
export interface LiveSocketHandlers {
  /** First message of every connection: who the server took the caller for (01_specs §9.2). */
  onHello?(hello: HelloMessage, info: LiveSocketConnectionInfo): void;
  /** The whole replicated state. It replaces the replica. */
  onSnapshot?(snapshot: SnapshotMessage, info: LiveSocketSnapshotInfo): void;
  /** One change, with its `replace` and `append` operations in the server's order. See the ordering guarantee above. */
  onDelta?(delta: DeltaMessage): void;
  /** The newest audio frame of both channels. Frames are never queued here: the latest wins (RT-8). */
  onMeters?(meters: MetersMessage): void;
  onControl?(message: LiveSocketControlMessage): void;
  /** A reading of the server clock from every `hello` and every `heartbeat`. */
  onServerTime?(sample: LiveSocketServerTime): void;
  onLinkChange?(link: LiveLinkState, previous: LiveLinkState): void;
  onResync?(event: LiveSocketResyncEvent): void;
  /** The server ended the session (4401) or revoked the device (4403). No reconnect follows by itself. */
  onEnd?(end: LiveSocketEnd): void;
  /** Every dropped message and every caught failure. The consumer writes it to its persistent log. */
  onError?(report: LiveSocketErrorReport): void;
}

export interface LiveSocketClientOptions extends LiveSocketHandlers {
  /** `ws://<host>/ws` or `wss://...`: no query, no fragment, no user information. */
  url: string;
  /** Defaults to the global `WebSocket` constructor. */
  socketFactory?: LiveSocketFactory;
  /** The mobile app's bearer header. The web console leaves it out. */
  headers?: LiveSocketHeadersProvider;
  /** Clock for the stale check, the resync rule and the deadlines. Defaults to `Date.now`. */
  now?: () => number;
  /** Random source for the reconnect jitter, in [0, 1). */
  random?: () => number;
  /** Defaults to the global timer functions. */
  timers?: LiveSocketTimers;
  /** Whether `subscribe` for the `meters` topic is sent after an OPERATOR `hello`. Default true; see `setMetersWanted`. */
  meters?: boolean;
  /** Default `LIVE_SOCKET_SYNC_TIMEOUT_MS`. */
  syncTimeoutMs?: number;
}

export interface LiveSocketClient extends HeartbeatClient {
  /** A new object at every call. */
  getStatus(): LiveSocketStatus;
  /** The newest meter frame of the current connection, or `null`: none yet, not wanted, or the link was lost. */
  getLatestMeters(): MetersMessage | null;
  /**
   * CL-11a: closes the socket and opens a new one at once, with headers asked afresh. Called after
   * a sign-in or a sign-out (the principal is fixed at the upgrade), and for "Retry now". Returns
   * false, and does nothing, when the client is not started.
   */
  reconnect(reason: LiveSocketReconnectReason): boolean;
  /**
   * CL-11b: the page or the app became visible (true) or hidden (false). `subscribe` or
   * `unsubscribe` is sent when an OPERATOR socket with the `meters` topic is open, and the wish is
   * kept across reconnects.
   */
  setMetersWanted(wanted: boolean): void;
  /**
   * Asks for a new snapshot (CL-17). Returns true when a resync is now pending: the link turns
   * RESYNCING and `resync` goes out as soon as the 2 s rule allows. Returns false when there is
   * nothing to resynchronise: no OPERATOR socket with the `state` topic, or its snapshot is still
   * on the way.
   */
  requestResync(): boolean;
}

/** A programming error: a URL that is not a plain socket address, or a deadline that is not a positive number. */
export class LiveSocketUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveSocketUsageError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Defaults and helpers
// ═══════════════════════════════════════════════════════════════════════════════════════

type LiveSocketConstructor = new (url: string, protocols?: undefined, options?: { headers: LiveSocketHeaders }) => LiveSocketLike;

/**
 * The global `WebSocket`. Headers go into the third argument, which the mobile runtime reads
 * (01_specs §9.2) and a browser ignores: a browser cannot set a header on a socket, so the web
 * console passes none.
 */
function defaultSocketFactory(url: string, headers: LiveSocketHeaders | undefined): LiveSocketLike {
  const Ctor = (globalThis as unknown as { WebSocket?: LiveSocketConstructor }).WebSocket;
  if (!Ctor) {
    throw new Error('No global WebSocket available; pass socketFactory to createLiveSocketClient().');
  }
  return headers === undefined ? new Ctor(url) : new Ctor(url, undefined, { headers });
}

/** The global timer functions, looked up at every call. */
export const DEFAULT_TIMERS: LiveSocketTimers = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

const INITIAL_HEARTBEAT: HeartbeatSnapshot = {
  state: HeartbeatState.CONNECTING,
  seq: null,
  serverTime: null,
  lastBeatAt: null,
  clients: null,
  reconnectAttempt: 0,
};

/** `warn` for what the client recovers from by itself; every other code is an error. */
function levelOf(code: LiveSocketErrorCode): LiveSocketErrorReport['level'] {
  return code === LiveSocketErrorCode.DELTA_BEFORE_SNAPSHOT || code === LiveSocketErrorCode.SYNC_TIMEOUT ? 'warn' : 'error';
}

type Phase = 'IDLE' | 'CONNECTING' | 'OPEN' | 'WAITING' | 'ENDED';
type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };
type ReportDetail = Partial<Pick<LiveSocketErrorReport, 'messageType' | 'issue' | 'path' | 'waiting' | 'handler' | 'errorName' | 'cause'>>;

function errorNameOf(caught: unknown): string {
  return caught instanceof Error ? caught.name : typeof caught;
}

/** The `type` of a JSON value, when it is one of the contract's message types. */
function knownMessageType(json: unknown): WsServerMessage['type'] | undefined {
  if (typeof json !== 'object' || json === null) return undefined;
  const type = (json as { type?: unknown }).type;
  return REALTIME_SERVER_MESSAGES.find((message) => message.type === type)?.type;
}

/** A path of member names and indices. A name that is not a plain identifier is replaced, so no value can ride in it. */
function reportablePath(path: readonly PropertyKey[]): string {
  return path
    .slice(0, REPORTABLE_PATH_DEPTH)
    .map((part) => (typeof part === 'number' ? String(part) : typeof part === 'string' && REPORTABLE_MEMBER_PATTERN.test(part) ? part : '?'))
    .join('.');
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The client
// ═══════════════════════════════════════════════════════════════════════════════════════

export function createLiveSocketClient(options: LiveSocketClientOptions): LiveSocketClient {
  const {
    url,
    socketFactory = defaultSocketFactory,
    headers,
    now = Date.now,
    random = Math.random,
    timers = DEFAULT_TIMERS,
    syncTimeoutMs = LIVE_SOCKET_SYNC_TIMEOUT_MS,
  } = options;

  if (typeof url !== 'string' || !SOCKET_URL_PATTERN.test(url)) {
    throw new LiveSocketUsageError('url must be ws:// or wss:// with a host and an optional path: a credential never travels in a URL (SR-38)');
  }
  if (!Number.isFinite(syncTimeoutMs) || syncTimeoutMs <= 0) {
    throw new LiveSocketUsageError('syncTimeoutMs must be a positive number of milliseconds');
  }

  const listeners = new Set<() => void>();
  const counters: Mutable<LiveSocketCounters> = {
    received: 0,
    invalid: 0,
    snapshots: 0,
    deltas: 0,
    deltasDropped: 0,
    deltasStale: 0,
    meters: 0,
    metersDropped: 0,
    control: 0,
    sent: 0,
    resyncs: 0,
    reconnects: 0,
    errors: 0,
  };

  // The run.
  let running = false;
  let everStarted = false;
  let phase: Phase = 'IDLE';
  let link: LiveLinkState = LINK.CONNECTING;
  let heartbeat: HeartbeatSnapshot = INITIAL_HEARTBEAT;
  /** Grows whenever the connection changes; a sequence of handler calls stops when it moved. */
  let generation = 0;
  let reconnectTimer: { handle: unknown } | null = null;
  let housekeepingTimer: { handle: unknown } | null = null;
  let end: LiveSocketEnd | null = null;
  let lastCloseCode: number | null = null;
  let lastReconnectReason: LiveSocketReconnectReason | null = null;
  let lastServerTime: LiveSocketServerTime | null = null;
  /** A RESYNCED report the consumer is owed: after RESYNCING, or after a lost link. */
  let owedResync: LiveSocketResyncCause | null = null;
  /** The clock at the last `resync` sent, on whatever connection. */
  let lastResyncAt: number | null = null;
  let metersWanted = options.meters ?? true;

  // The replica's position. It outlives a connection.
  let epoch: number | null = null;
  let revision: number | null = null;

  // The current connection.
  let socket: LiveSocketLike | null = null;
  let connection = 0;
  let sentHeaders = false;
  let hello: HelloMessage | null = null;
  let expectsState = false;
  let hasSnapshot = false;
  let resync: { cause: LiveSocketResyncCause; sent: boolean } | null = null;
  let syncDeadline: number | null = null;
  let aliveAt: number | null = null;
  let stale = false;
  let metersSubscribed = false;
  let latestMeters: MetersMessage | null = null;
  let sessionEnded: SessionEndedReason | null = null;
  let deviceRevoked: DeviceRevokedReason | null = null;
  let deltaBeforeSnapshotReported = false;
  let sentAt: number[] = [];

  // ── Reports and handler calls ────────────────────────────────────────────────────────

  function report(code: LiveSocketErrorCode, detail: ReportDetail = {}): void {
    counters.errors += 1;
    try {
      options.onError?.({
        code,
        level: levelOf(code),
        source: LIVE_SOCKET_ERROR_SOURCE,
        at: now(),
        connection,
        connectionId: hello?.connectionId ?? null,
        ...detail,
      });
    } catch {
      // The sink itself failed. The counter above holds the report; there is nobody left to tell.
    }
  }

  /** Calls one handler of the consumer. What it throws is reported, never passed on. */
  function emit(name: LiveSocketHandlerName, call: (handlers: LiveSocketHandlers) => void): void {
    try {
      call(options);
    } catch (cause) {
      report(LiveSocketErrorCode.HANDLER_FAILED, { handler: name, errorName: errorNameOf(cause), cause });
    }
  }

  /** The edge of every socket callback and every timer callback: nothing thrown leaves it. */
  function guarded(run: () => void): void {
    try {
      run();
    } catch (caught) {
      report(LiveSocketErrorCode.INTERNAL_ERROR, { errorName: errorNameOf(caught) });
    }
  }

  function invalid(code: LiveSocketErrorCode, detail: ReportDetail = {}): void {
    counters.invalid += 1;
    report(code, detail);
  }

  // ── The two views ────────────────────────────────────────────────────────────────────

  function updateHeartbeat(patch: Partial<HeartbeatSnapshot>): void {
    heartbeat = { ...heartbeat, ...patch };
    for (const listener of listeners) {
      emit('subscribe', () => listener());
    }
  }

  function computeLink(): LiveLinkState {
    switch (phase) {
      case 'IDLE':
        return everStarted ? LINK.OFFLINE : LINK.CONNECTING;
      case 'CONNECTING':
        return LINK.CONNECTING;
      case 'WAITING':
      case 'ENDED':
        return LINK.OFFLINE;
      case 'OPEN':
        if (stale) return LINK.STALE;
        if (expectsState && !hasSnapshot) return LINK.CONNECTING;
        return resync !== null ? LINK.RESYNCING : LINK.ONLINE;
    }
  }

  /** Tells the consumer when the link changed. It reads the current state, so it is safe after any handler. */
  function publishLink(): void {
    const next = computeLink();
    if (next === link) return;
    const previous = link;
    link = next;
    emit('onLinkChange', (handlers) => handlers.onLinkChange?.(next, previous));
  }

  function sampleServerTime(serverTime: number, receivedAt: number, source: LiveSocketServerTime['source']): void {
    if (!Number.isFinite(serverTime)) return;
    const sample: LiveSocketServerTime = { serverTime, receivedAt, source };
    lastServerTime = sample;
    emit('onServerTime', (handlers) => handlers.onServerTime?.(sample));
  }

  /** The RESYNCED report, when one is owed. */
  function settleOwedResync(): void {
    const cause = owedResync;
    if (cause === null) return;
    owedResync = null;
    emit('onResync', (handlers) => handlers.onResync?.({ phase: 'RESYNCED', cause }));
  }

  // ── Sending ──────────────────────────────────────────────────────────────────────────

  function budgetAllows(at: number): boolean {
    const oldest = at - REALTIME_CLIENT_MESSAGE_LIMIT.windowMs;
    sentAt = sentAt.filter((sent) => sent > oldest);
    return sentAt.length < LIVE_SOCKET_SEND_BUDGET;
  }

  /** Sends one client message. False when it was not sent; a socket that cannot send is given up. */
  function send(message: WsClientMessage): boolean {
    const target = socket;
    if (target === null || hello === null || !canSendRealtimeMessage(hello.principal, message.type)) return false;
    try {
      target.send(JSON.stringify(message));
    } catch (caught) {
      report(LiveSocketErrorCode.SEND_FAILED, { errorName: errorNameOf(caught) });
      abandonConnection();
      return false;
    }
    sentAt.push(now());
    counters.sent += 1;
    return true;
  }

  /** Sends what is due and allowed: a pending `resync`, and the `meters` subscription the consumer wants. */
  function pump(): void {
    if (phase !== 'OPEN' || hello === null || hello.principal !== RealtimePrincipal.OPERATOR) return;
    const at = now();
    const pending = resync;
    if (pending !== null && !pending.sent) {
      const spaced = lastResyncAt === null || at - lastResyncAt >= REALTIME_RESYNC_MIN_INTERVAL_MS + LIVE_SOCKET_RESYNC_GUARD_MS;
      if (spaced && budgetAllows(at)) {
        if (!send({ type: 'resync' })) return;
        pending.sent = true;
        lastResyncAt = at;
        syncDeadline = at + syncTimeoutMs;
        counters.resyncs += 1;
      }
    }
    const desired = metersWanted && hello.topics.includes(RealtimeTopic.METERS);
    if (desired !== metersSubscribed && budgetAllows(at)) {
      if (!send({ type: desired ? 'subscribe' : 'unsubscribe', topic: RealtimeTopic.METERS })) return;
      metersSubscribed = desired;
      if (!desired) latestMeters = null;
    }
  }

  // ── Connection life cycle ────────────────────────────────────────────────────────────

  function detach(target: LiveSocketLike): void {
    target.onopen = null;
    target.onmessage = null;
    target.onclose = null;
    target.onerror = null;
  }

  function closeQuietly(target: LiveSocketLike, reason: string): void {
    try {
      target.close(NORMAL_CLOSURE, reason);
    } catch {
      // Closing a socket that never opened can throw in some runtimes; nothing to recover.
    }
  }

  /** Forgets everything that belongs to one connection. The replica's epoch and revision stay. */
  function resetConnection(): void {
    generation += 1;
    sentHeaders = false;
    hello = null;
    expectsState = false;
    hasSnapshot = false;
    resync = null;
    syncDeadline = null;
    aliveAt = null;
    stale = false;
    metersSubscribed = false;
    latestMeters = null;
    sessionEnded = null;
    deviceRevoked = null;
    deltaBeforeSnapshotReported = false;
    sentAt = [];
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer === null) return;
    timers.clearTimeout(reconnectTimer.handle);
    reconnectTimer = null;
  }

  /** The link was lost: wait `reconnectDelayMs(attempt)`, then open a new socket. */
  function scheduleReconnect(): void {
    const attempt = heartbeat.reconnectAttempt;
    const delay = reconnectDelayMs(attempt, random);
    phase = 'WAITING';
    owedResync = 'RECONNECT';
    counters.reconnects += 1;
    reconnectTimer = {
      handle: timers.setTimeout(() => {
        guarded(() => {
          reconnectTimer = null;
          connect();
        });
      }, delay),
    };
    updateHeartbeat({ state: HeartbeatState.OFFLINE, reconnectAttempt: attempt + 1 });
    publishLink();
  }

  /** The client gives the socket up itself: a deadline passed, or it cannot send. */
  function abandonConnection(): void {
    const current = socket;
    if (current === null) return;
    socket = null;
    detach(current);
    closeQuietly(current, 'client gave up');
    lastCloseCode = null;
    resetConnection();
    scheduleReconnect();
  }

  /** The end the server announced, or `null` when the close is an ordinary lost link. */
  function endOf(code: number | null): LiveSocketEnd | null {
    const helloReason = hello?.reason ?? null;
    // A bearer connection whose credential the server refused in `hello` is closed with 4401 or
    // 4403 right after. Its end holds even when the runtime does not hand the close code on.
    const refused = sentHeaders ? helloReason : null;
    let kind: LiveSocketEnd['kind'] | null = null;
    if (code === RealtimeCloseCode.SESSION_ENDED) kind = 'SESSION_ENDED';
    else if (code === RealtimeCloseCode.DEVICE_REVOKED) kind = 'DEVICE_REVOKED';
    else if (deviceRevoked !== null || refused === RealtimeHelloReason.DEVICE_REVOKED) kind = 'DEVICE_REVOKED';
    else if (sessionEnded !== null || refused === RealtimeHelloReason.SESSION_INVALID) kind = 'SESSION_ENDED';
    if (kind === null) return null;
    return { kind, closeCode: code, sessionEnded, deviceRevoked, helloReason, principal: hello?.principal ?? null, at: now() };
  }

  function handleClose(target: LiveSocketLike, code: number | null, failed: boolean): void {
    // Ignore late events from a socket that was already replaced or stopped.
    if (!running || target !== socket) return;
    socket = null;
    detach(target);
    if (failed) closeQuietly(target, 'client saw an error');
    lastCloseCode = code;
    const ended = endOf(code);
    resetConnection();
    if (ended === null) {
      scheduleReconnect();
      return;
    }
    phase = 'ENDED';
    end = ended;
    owedResync = null;
    updateHeartbeat({ state: HeartbeatState.OFFLINE });
    publishLink();
    emit('onEnd', (handlers) => handlers.onEnd?.(ended));
  }

  /** The headers of the next upgrade request. Throws when the provider did, or when a header cannot be sent. */
  function readHeaders(): LiveSocketHeaders | undefined {
    const value = headers?.();
    if (value === null || value === undefined) return undefined;
    const entries = Object.entries(value);
    if (entries.length === 0) return undefined;
    for (const [name, text] of entries) {
      if (!HEADER_NAME_PATTERN.test(name) || typeof text !== 'string' || !HEADER_VALUE_PATTERN.test(text)) {
        throw new LiveSocketUsageError('The headers function returned a name or a value that cannot be a header');
      }
    }
    return Object.fromEntries(entries);
  }

  function connect(): void {
    if (!running || socket !== null) return;
    generation += 1;
    phase = 'CONNECTING';
    end = null;
    updateHeartbeat({ state: HeartbeatState.CONNECTING });
    publishLink();
    if (!running || socket !== null || phase !== 'CONNECTING') return;

    let requestHeaders: LiveSocketHeaders | undefined;
    try {
      requestHeaders = readHeaders();
    } catch (caught) {
      report(LiveSocketErrorCode.HEADERS_FAILED, { errorName: errorNameOf(caught) });
      scheduleReconnect();
      return;
    }
    let next: LiveSocketLike;
    try {
      next = socketFactory(url, requestHeaders);
    } catch (caught) {
      report(LiveSocketErrorCode.SOCKET_FACTORY_FAILED, { errorName: errorNameOf(caught) });
      scheduleReconnect();
      return;
    }
    if (!running || socket !== null) {
      // The headers function or the factory called stop() or reconnect(): this socket is not wanted.
      closeQuietly(next, 'client stopped');
      return;
    }
    socket = next;
    connection += 1;
    sentHeaders = requestHeaders !== undefined;
    next.onopen = null;
    next.onmessage = (event) => guarded(() => handleMessage(next, event?.data));
    next.onclose = (event) => guarded(() => handleClose(next, typeof event?.code === 'number' ? event.code : null, false));
    next.onerror = () => guarded(() => handleClose(next, null, true));
    syncDeadline = now() + syncTimeoutMs;
  }

  // ── Messages ─────────────────────────────────────────────────────────────────────────

  function handleHeartbeat(message: Heartbeat): void {
    const at = now();
    const current = generation;
    // The rule of the heartbeat client: the first beat after a reconnect ends the backoff.
    const resynced = heartbeat.state === HeartbeatState.CONNECTING && heartbeat.reconnectAttempt > 0;
    if (hello !== null) {
      aliveAt = at;
      stale = false;
    }
    updateHeartbeat({
      state: HeartbeatState.LIVE,
      seq: message.seq,
      serverTime: message.serverTime,
      clients: message.clients,
      lastBeatAt: at,
      ...(resynced ? { reconnectAttempt: 0 } : {}),
    });
    if (current !== generation) return;
    sampleServerTime(Date.parse(message.serverTime), at, 'heartbeat');
    if (current === generation) publishLink();
  }

  function handleHello(message: HelloMessage): void {
    if (hello !== null) {
      invalid(LiveSocketErrorCode.UNEXPECTED_HELLO, { messageType: 'hello' });
      return;
    }
    const at = now();
    const current = generation;
    hello = message;
    phase = 'OPEN';
    aliveAt = at;
    stale = false;
    expectsState = message.principal === RealtimePrincipal.OPERATOR && message.topics.includes(RealtimeTopic.STATE);
    syncDeadline = expectsState ? at + syncTimeoutMs : null;
    emit('onHello', (handlers) => handlers.onHello?.(message, { connection }));
    if (current !== generation) return;
    sampleServerTime(message.serverTime, at, 'hello');
    if (current !== generation) return;
    pump();
    if (current !== generation) return;
    publishLink();
    // Without the `state` topic there is no snapshot to wait for: the link is back now.
    if (current === generation && !expectsState) settleOwedResync();
  }

  function handleSnapshot(message: SnapshotMessage): void {
    let cause: LiveSocketSnapshotCause;
    if (!hasSnapshot) cause = owedResync === 'RECONNECT' ? 'RECONNECT' : 'CONNECT';
    else if (resync !== null) cause = 'RESYNC';
    else cause = message.epoch === epoch ? 'REFRESH' : 'EPOCH';
    const current = generation;
    hasSnapshot = true;
    epoch = message.epoch;
    revision = message.revision;
    resync = null;
    syncDeadline = null;
    counters.snapshots += 1;
    emit('onSnapshot', (handlers) => handlers.onSnapshot?.(message, { cause, connection }));
    if (current !== generation) return;
    publishLink();
    if (current === generation) settleOwedResync();
  }

  function beginResync(cause: LiveSocketResyncCause): void {
    const current = generation;
    resync = { cause, sent: false };
    owedResync = cause;
    pump();
    if (current !== generation) return;
    publishLink();
    if (current === generation) emit('onResync', (handlers) => handlers.onResync?.({ phase: 'RESYNCING', cause }));
  }

  function handleDelta(message: DeltaMessage): void {
    if (!hasSnapshot || epoch === null || revision === null) {
      counters.deltasDropped += 1;
      if (!deltaBeforeSnapshotReported) {
        deltaBeforeSnapshotReported = true;
        report(LiveSocketErrorCode.DELTA_BEFORE_SNAPSHOT, { messageType: 'delta' });
      }
      return;
    }
    if (resync !== null) {
      counters.deltasDropped += 1;
      return;
    }
    if (message.epoch < epoch || (message.epoch === epoch && message.revision <= revision)) {
      counters.deltasStale += 1;
      return;
    }
    if (message.epoch === epoch && message.revision === revision + 1) {
      revision = message.revision;
      counters.deltas += 1;
      emit('onDelta', (handlers) => handlers.onDelta?.(message));
      return;
    }
    counters.deltasDropped += 1;
    beginResync(message.epoch === epoch ? 'GAP' : 'EPOCH');
  }

  function handleMeters(message: MetersMessage): void {
    if (!metersWanted || (latestMeters !== null && message.seq <= latestMeters.seq)) {
      counters.metersDropped += 1;
      return;
    }
    latestMeters = message;
    counters.meters += 1;
    emit('onMeters', (handlers) => handlers.onMeters?.(message));
  }

  function handleControl(message: LiveSocketControlMessage): void {
    if (message.type === 'session.ended') sessionEnded = message.reason;
    if (message.type === 'device.revoked') deviceRevoked = message.reason;
    counters.control += 1;
    emit('onControl', (handlers) => handlers.onControl?.(message));
  }

  function handleMessage(target: LiveSocketLike, data: unknown): void {
    if (!running || target !== socket) return;
    counters.received += 1;
    if (typeof data !== 'string') {
      invalid(LiveSocketErrorCode.NON_TEXT_FRAME);
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      invalid(LiveSocketErrorCode.INVALID_JSON);
      return;
    }
    const parsed = WsServerMessageSchema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      invalid(LiveSocketErrorCode.SCHEMA_MISMATCH, {
        messageType: knownMessageType(json),
        ...(first ? { issue: String(first.code), path: reportablePath(first.path) } : {}),
      });
      return;
    }
    const message = parsed.data;
    if (message.type === 'heartbeat') {
      handleHeartbeat(message);
      return;
    }
    if (message.type === 'hello') {
      handleHello(message);
      return;
    }
    if (hello === null) {
      invalid(LiveSocketErrorCode.MESSAGE_BEFORE_HELLO, { messageType: message.type });
      return;
    }
    if (!canReceiveRealtimeMessage(hello.principal, message.type)) {
      invalid(LiveSocketErrorCode.MESSAGE_NOT_FOR_PRINCIPAL, { messageType: message.type });
      return;
    }
    switch (message.type) {
      case 'snapshot':
        handleSnapshot(message);
        return;
      case 'delta':
        handleDelta(message);
        return;
      case 'meters':
        handleMeters(message);
        return;
      default:
        handleControl(message);
    }
  }

  // ── Housekeeping, every STALE_CHECK_INTERVAL_MS ──────────────────────────────────────

  function housekeeping(): void {
    if (!running) return;
    const at = now();
    if (heartbeat.state === HeartbeatState.LIVE && heartbeat.lastBeatAt !== null && at - heartbeat.lastBeatAt >= HEARTBEAT_STALE_AFTER_MS) {
      updateHeartbeat({ state: HeartbeatState.STALE });
    }
    if (phase === 'OPEN' && !stale && aliveAt !== null && at - aliveAt >= HEARTBEAT_STALE_AFTER_MS) {
      stale = true;
      publishLink();
    }
    if (socket !== null && syncDeadline !== null && at >= syncDeadline) {
      report(LiveSocketErrorCode.SYNC_TIMEOUT, { waiting: hello === null ? 'hello' : hasSnapshot ? 'resync' : 'snapshot' });
      abandonConnection();
      return;
    }
    pump();
  }

  // ── The public object ────────────────────────────────────────────────────────────────

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return heartbeat;
    },
    start() {
      if (running) return;
      running = true;
      everStarted = true;
      owedResync = null;
      heartbeat = { ...heartbeat, reconnectAttempt: 0 };
      housekeepingTimer = { handle: timers.setInterval(() => guarded(housekeeping), STALE_CHECK_INTERVAL_MS) };
      connect();
    },
    stop() {
      if (!running) return;
      running = false;
      clearReconnectTimer();
      if (housekeepingTimer !== null) timers.clearInterval(housekeepingTimer.handle);
      housekeepingTimer = null;
      const current = socket;
      socket = null;
      if (current !== null) {
        detach(current);
        closeQuietly(current, 'client stopped');
      }
      resetConnection();
      phase = 'IDLE';
      owedResync = null;
      updateHeartbeat({ state: HeartbeatState.OFFLINE });
      publishLink();
    },
    getStatus() {
      return {
        link,
        running,
        connection,
        connectionId: hello?.connectionId ?? null,
        principal: hello?.principal ?? null,
        helloReason: hello?.reason ?? null,
        topics: hello?.topics ?? [],
        epoch,
        revision,
        synced: phase === 'OPEN' && hasSnapshot && resync === null,
        resync: resync?.cause ?? null,
        metersWanted,
        metersSubscribed,
        end,
        lastCloseCode,
        lastReconnectReason,
        serverTime: lastServerTime,
        counters: { ...counters },
      };
    },
    getLatestMeters() {
      return latestMeters;
    },
    reconnect(reason) {
      if (!running) return false;
      lastReconnectReason = reason;
      clearReconnectTimer();
      const current = socket;
      socket = null;
      if (current !== null) {
        detach(current);
        closeQuietly(current, 'client reconnect');
      }
      lastCloseCode = null;
      resetConnection();
      connect();
      return true;
    },
    setMetersWanted(wanted) {
      metersWanted = wanted;
      if (!wanted) latestMeters = null;
      if (running) pump();
    },
    requestResync() {
      if (phase !== 'OPEN' || !expectsState || !hasSnapshot) return false;
      if (resync === null) beginResync('REQUESTED');
      return true;
    },
  };
}
