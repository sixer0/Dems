/**
 * The socket half of the fake transport (HB-11): a socket constructor and a socket factory of the
 * shape the socket clients take by injection (`SocketFactory` of `../../realtime/heartbeat-client`),
 * and the server's end of every socket, which a test scripts.
 *
 * Two objects per socket:
 * - `FakeSocket`: the client's end. It has the members of a platform socket that the clients use
 *   (`readyState`, the four `on...` handlers, `send`, `close`, `addEventListener`).
 * - `FakeConnection`: the server's end. The test accepts or refuses the upgrade, sends server
 *   messages, reads what the client sent, closes with a code, or drops the connection.
 *
 * Contract checks (04_client_integration_spec TS-12; 01_specs §9):
 * - **The upgrade**: the path is the contract's socket path; no credential in the URL or in a
 *   subprotocol (SR-38); a credential travels only as `Authorization: Bearer` with a session token
 *   or a device credential. Otherwise the constructor throws `FakeSocketUpgradeError`.
 * - **Server messages**: each one parses with the union of the contract; `hello` comes first and
 *   once; a message goes only to a principal that may receive it and only on a topic `hello` gave.
 *   Otherwise the scripting call throws `FakeSocketMessageError`, unless the message is marked
 *   `{ violatesContract: true }`. A close code must be one the contract lists.
 * - **Client messages**: each one must be text, JSON, and parse with the client union, from a
 *   principal that may send it. Otherwise `send` throws `FakeSocketMessageError`, and the error
 *   is recorded for `assertNoViolations()`.
 *
 * Nothing here happens by itself. A socket stays CONNECTING until the test accepts it, messages
 * arrive when the test sends them, and time (`serverTime`, the heartbeat series) is the fake's
 * clock. The one thing that follows without a call is the close event after the CLIENT closed:
 * it arrives on a promise job, as a platform socket delivers it after the closing handshake.
 */
import { HEARTBEAT_INTERVAL_MS, REALTIME_CLIENT_MESSAGE_MAX_BYTES, WS_PATH } from '../../api/constants';
import {
  REALTIME_CLOSE_CODES,
  REALTIME_SERVER_MESSAGES,
  RealtimeCloseCode,
  RealtimePrincipal,
  RealtimeTopic,
  WsClientMessageSchema,
  WsServerMessageSchema,
  canReceiveRealtimeMessage,
  canSendRealtimeMessage,
  type AdminChangedMessage,
  type DeltaMessage,
  type DeviceRevokedMessage,
  type Heartbeat,
  type HelloMessage,
  type MetersMessage,
  type SessionEndedMessage,
  type SessionUpdatedMessage,
  type SnapshotMessage,
  type WsServerMessage,
} from '../../api/realtime-messages';
import type { SocketLike } from '../../realtime/heartbeat-client';
import { credentialFormIssues, credentialPlacesInUrl, issuePaths, parseUrl, utf8Length } from './contract';
import {
  FakeMessageViolation,
  FakeSocketMessageError,
  FakeSocketUpgradeError,
  FakeTransportError,
  FakeTransportUsageError,
  FakeUpgradeViolation,
  holdsCredential,
} from './errors';
import { normaliseHeaders, type FakeContext } from './http';
import type { FakeSocketClosure, FakeSocketFrame, FakeSocketState, MutableSocketRecord } from './log';

const READY_STATE: Readonly<Record<FakeSocketState, number>> = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };

/** The code a socket reports when the connection ended without a close frame. */
export const ABNORMAL_CLOSURE = 1006;
/** The code a socket reports when the peer's close frame carried none. */
const NO_STATUS_RECEIVED = 1005;

type SocketEventType = 'open' | 'message' | 'close' | 'error';
type SocketListener = (event: FakeSocketEvent) => void;

export interface FakeSocketEvent {
  readonly type: SocketEventType;
  readonly target: FakeSocket;
  /** `message`: the frame. */
  readonly data?: unknown;
  /** `close`. */
  readonly code?: number;
  readonly reason?: string;
  readonly wasClean?: boolean;
}

/** The third argument of a React Native socket constructor: the headers of the upgrade request. */
export interface FakeSocketOptions {
  readonly headers?: Readonly<Record<string, string>>;
}

export interface FakeMessageOptions {
  /** A deliberate contract violation, to test what a client does with one. No check is applied. */
  readonly violatesContract?: boolean;
}

/** What the socket classes need from the fake they belong to. */
export interface FakeSocketHub {
  readonly context: FakeContext;
  open(socket: FakeSocket, url: unknown, second: unknown, third: unknown): FakeConnection;
  openCount(): number;
  nextBeat(): number;
  nextMeter(): number;
}

interface Wire {
  readonly hub: FakeSocketHub;
  readonly record: MutableSocketRecord;
  readonly listeners: Map<SocketEventType, Set<SocketListener>>;
  readonly stops: Set<() => void>;
  helloSent: boolean;
  principal: RealtimePrincipal | null;
  topics: readonly RealtimeTopic[];
}

const wires = new WeakMap<FakeSocket, Wire>();

function wireOf(socket: FakeSocket): Wire {
  const wire = wires.get(socket);
  if (!wire) throw new FakeTransportUsageError('this socket was not made by a fake transport');
  return wire;
}

function emit(socket: FakeSocket, type: SocketEventType, detail: Omit<FakeSocketEvent, 'type' | 'target'> = {}): void {
  const event: FakeSocketEvent = { type, target: socket, ...detail };
  if (type === 'open') socket.onopen?.(event);
  else if (type === 'message') socket.onmessage?.({ ...event, data: detail.data });
  else if (type === 'close') socket.onclose?.(event);
  else socket.onerror?.(event);
  // A copy: a listener may remove itself while it runs.
  for (const listener of Array.from(wireOf(socket).listeners.get(type) ?? [])) listener(event);
}

function stopSeries(wire: Wire): void {
  for (const stop of Array.from(wire.stops)) stop();
  wire.stops.clear();
}

function typeOf(message: unknown): string | null {
  const type = typeof message === 'object' && message !== null ? (message as { type?: unknown }).type : undefined;
  return typeof type === 'string' ? type : null;
}

function addFrame(wire: Wire, direction: 'server' | 'client', data: unknown, message: unknown, deliberate: boolean): void {
  const frame: FakeSocketFrame = {
    seq: wire.hub.context.log.nextSeq(),
    at: wire.hub.context.clock.now(),
    direction,
    data,
    message,
    type: typeOf(message),
    deliberate,
  };
  wire.record.frames.push(frame);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The client's end
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * The client's end of a fake socket. Made by `new fake.WebSocket(url, protocols?, options?)` or by
 * `fake.socketFactory(url, ...)`; never by this class directly.
 */
export class FakeSocket implements SocketLike {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readonly url: string;
  readonly protocol = '';
  readonly extensions = '';
  readonly bufferedAmount = 0;
  binaryType = 'blob';
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  /** The server's end of this socket. */
  readonly connection: FakeConnection;

  constructor(hub: FakeSocketHub, url: unknown, second?: unknown, third?: unknown) {
    this.connection = hub.open(this, url, second, third);
    this.url = this.connection.url;
  }

  get readyState(): number {
    return READY_STATE[wireOf(this).record.state];
  }

  /** Sends one client message. It is checked against the client union of the contract. */
  send(data: unknown): void {
    const wire = wireOf(this);
    const { record, hub } = wire;
    const refuse = (reason: FakeMessageViolation, type: string | null, issues: readonly string[] = []): never => {
      throw hub.context.violation(new FakeSocketMessageError({ reason, direction: 'client', type, issues }));
    };
    if (record.state === 'CONNECTING') refuse(FakeMessageViolation.NOT_OPEN, null, ['the socket is still connecting']);
    // A platform socket discards what is sent while it closes or after it closed.
    if (record.state !== 'OPEN') return;
    if (typeof data !== 'string') {
      addFrame(wire, 'client', data, undefined, false);
      return refuse(FakeMessageViolation.NOT_TEXT, null);
    }
    let message: unknown;
    let isJson = true;
    try {
      message = JSON.parse(data) as unknown;
    } catch {
      isJson = false;
    }
    addFrame(wire, 'client', data, message, false);
    if (utf8Length(data) > REALTIME_CLIENT_MESSAGE_MAX_BYTES) refuse(FakeMessageViolation.TOO_LARGE, typeOf(message));
    if (!isJson) refuse(FakeMessageViolation.NOT_JSON, null);
    const parsed = WsClientMessageSchema.safeParse(message);
    if (!parsed.success) return refuse(FakeMessageViolation.INVALID_MESSAGE, typeOf(message), issuePaths(parsed.error.issues));
    if (wire.principal !== null && !canSendRealtimeMessage(wire.principal, parsed.data.type)) {
      refuse(FakeMessageViolation.NOT_FOR_PRINCIPAL, parsed.data.type, [`a ${wire.principal} connection may not send it`]);
    }
  }

  /** Closes from the client's side. The close event follows on a promise job. */
  close(code?: number, reason?: string): void {
    const wire = wireOf(this);
    const { record, hub } = wire;
    if (record.state === 'CLOSING' || record.state === 'CLOSED') return;
    if (code !== undefined && code !== 1000 && !(Number.isInteger(code) && code >= 3000 && code <= 4999)) {
      throw hub.context.violation(
        new FakeSocketMessageError({ reason: FakeMessageViolation.INVALID_CLOSE_CODE, direction: 'client', issues: [`code ${code}`] }),
      );
    }
    stopSeries(wire);
    record.state = 'CLOSING';
    record.closed = { by: 'client', code: code ?? null, reason: reason ?? '' };
    void Promise.resolve().then(() => {
      record.state = 'CLOSED';
      emit(this, 'close', { code: code ?? NO_STATUS_RECEIVED, reason: reason ?? '', wasClean: true });
    });
  }

  addEventListener(type: SocketEventType, listener: SocketListener): void {
    const { listeners } = wireOf(this);
    const set = listeners.get(type) ?? new Set<SocketListener>();
    set.add(listener);
    listeners.set(type, set);
  }

  removeEventListener(type: SocketEventType, listener: SocketListener): void {
    wireOf(this).listeners.get(type)?.delete(listener);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The server's end
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface FakeStateMessageOptions {
  readonly epoch?: number;
  readonly revision?: number;
  readonly serverTime?: number;
}

export interface FakeOperatorStartOptions {
  /** Also give the `admin` topic (an operator who holds USER_ADMIN or PAIRING_MANAGE). */
  readonly admin?: boolean;
}

const DEFAULT_TOPICS = {
  [RealtimePrincipal.ANONYMOUS]: [RealtimeTopic.HEARTBEAT],
  [RealtimePrincipal.DEVICE]: [RealtimeTopic.HEARTBEAT, RealtimeTopic.CONTROL],
  [RealtimePrincipal.OPERATOR]: [RealtimeTopic.HEARTBEAT, RealtimeTopic.CONTROL, RealtimeTopic.STATE, RealtimeTopic.METERS],
} as const satisfies Record<RealtimePrincipal, readonly RealtimeTopic[]>;

/** Why a server message is not the contract's on this connection, or `null`. */
function serverMessageError(wire: Wire, message: unknown): FakeSocketMessageError | null {
  const type = typeOf(message);
  const refuse = (reason: FakeMessageViolation, issues: readonly string[] = []) =>
    new FakeSocketMessageError({ reason, direction: 'server', type, issues });
  const parsed = WsServerMessageSchema.safeParse(message);
  if (!parsed.success) {
    return refuse(
      FakeMessageViolation.INVALID_MESSAGE,
      parsed.error.issues.slice(0, 20).map((issue) => `${issue.path.map((part) => String(part)).join('.') || '(root)'}: ${issue.message}`),
    );
  }
  const known = parsed.data.type;
  if (known === 'hello') return wire.helloSent ? refuse(FakeMessageViolation.HELLO_TWICE) : null;
  if (!wire.helloSent) return refuse(FakeMessageViolation.HELLO_FIRST, ['every connection gets hello first']);
  if (wire.principal !== null && !canReceiveRealtimeMessage(wire.principal, known)) {
    return refuse(FakeMessageViolation.NOT_FOR_PRINCIPAL, [`a ${wire.principal} connection never gets it`]);
  }
  const topic = REALTIME_SERVER_MESSAGES.find((entry) => entry.type === known)?.topic ?? null;
  if (topic !== null && wire.principal !== null && !wire.topics.includes(topic)) {
    return refuse(FakeMessageViolation.TOPIC_NOT_GIVEN, [`hello gave this connection no "${topic}" topic`]);
  }
  return null;
}

/** The server's end of a fake socket: what a test scripts and reads. */
export class FakeConnection {
  /** The client's end. */
  readonly socket: FakeSocket;
  private readonly wire: Wire;

  constructor(socket: FakeSocket, wire: Wire) {
    this.socket = socket;
    this.wire = wire;
  }

  /** Counts the sockets of one fake from 1. */
  get id(): number {
    return this.wire.record.id;
  }
  get url(): string {
    return this.wire.record.url;
  }
  /** The upgrade headers the client passed, by lower-case name; values as given. */
  get headers(): Readonly<Record<string, string>> {
    return this.wire.record.headers;
  }
  get protocols(): readonly string[] {
    return this.wire.record.protocols;
  }
  get state(): FakeSocketState {
    return this.wire.record.state;
  }
  get closed(): FakeSocketClosure | null {
    return this.wire.record.closed;
  }
  /** The principal the `hello` of this connection named; `null` before it. */
  get principal(): RealtimePrincipal | null {
    return this.wire.principal;
  }
  get topics(): readonly RealtimeTopic[] {
    return this.wire.topics;
  }
  /** Every frame of both directions, in order. */
  get frames(): readonly FakeSocketFrame[] {
    return this.wire.record.frames;
  }
  /** The messages the server sent, parsed. */
  get sent(): readonly unknown[] {
    return this.frames.filter((frame) => frame.direction === 'server').map((frame) => frame.message);
  }
  /** The messages the client sent, parsed. */
  get received(): readonly unknown[] {
    return this.frames.filter((frame) => frame.direction === 'client').map((frame) => frame.message);
  }
  /** The client messages of one `type` (`subscribe`, `unsubscribe`, `resync`). */
  receivedOf(type: string): readonly unknown[] {
    return this.frames.filter((frame) => frame.direction === 'client' && frame.type === type).map((frame) => frame.message);
  }

  // ── The upgrade ─────────────────────────────────────────────────────────────────────────

  /** The server accepts the upgrade: the socket opens. */
  accept(): this {
    const { record } = this.wire;
    if (record.state !== 'CONNECTING') throw new FakeTransportUsageError(`socket ${record.id} is ${record.state}: only a connecting socket can be accepted`);
    record.state = 'OPEN';
    emit(this.socket, 'open');
    return this;
  }

  /** The server refuses the upgrade (an HTTP 401 or 403 at the handshake): the socket reports an error and closes abnormally. */
  refuse(): this {
    const { record } = this.wire;
    if (record.state !== 'CONNECTING') throw new FakeTransportUsageError(`socket ${record.id} is ${record.state}: only a connecting socket can be refused`);
    return this.drop();
  }

  // ── Messages ────────────────────────────────────────────────────────────────────────────

  /**
   * Sends one server message. It is checked against the contract here, so a message the Core
   * server may not send throws at this call, unless `violatesContract` marks it as the test.
   */
  send(message: WsServerMessage | Readonly<Record<string, unknown>>, options: FakeMessageOptions = {}): this {
    const wire = this.wire;
    const deliberate = options.violatesContract === true;
    if (wire.record.state !== 'OPEN') {
      throw new FakeSocketMessageError({
        reason: FakeMessageViolation.NOT_OPEN,
        direction: 'server',
        type: typeOf(message),
        issues: [`socket ${wire.record.id} is ${wire.record.state}`],
      });
    }
    const data: unknown = JSON.stringify(message);
    if (typeof data !== 'string') throw new FakeSocketMessageError({ reason: FakeMessageViolation.NOT_JSON, direction: 'server' });
    const travelled = JSON.parse(data) as unknown;
    if (!deliberate) {
      const error = serverMessageError(wire, travelled);
      if (error) throw error;
    }
    if (typeOf(travelled) === 'hello') {
      const hello = travelled as { principal?: unknown; topics?: unknown };
      wire.helloSent = true;
      wire.principal = Object.values(RealtimePrincipal).find((principal) => principal === hello.principal) ?? null;
      wire.topics = Array.isArray(hello.topics) ? Object.values(RealtimeTopic).filter((topic) => (hello.topics as unknown[]).includes(topic)) : [];
    }
    addFrame(wire, 'server', data, travelled, deliberate);
    emit(this.socket, 'message', { data });
    return this;
  }

  /** Sends a frame that is no message of the contract at all (text that is not JSON, for example). Always a deliberate violation. */
  sendRaw(data: string): this {
    const wire = this.wire;
    if (wire.record.state !== 'OPEN') {
      throw new FakeSocketMessageError({ reason: FakeMessageViolation.NOT_OPEN, direction: 'server', issues: [`socket ${wire.record.id} is ${wire.record.state}`] });
    }
    let message: unknown;
    try {
      message = JSON.parse(data) as unknown;
    } catch {
      message = undefined;
    }
    addFrame(wire, 'server', data, message, true);
    emit(this.socket, 'message', { data });
    return this;
  }

  // ── The end of a connection ─────────────────────────────────────────────────────────────

  /** The server closes with one of the contract's close codes (1001, 1008, 1013, 4401, 4403, 4408). */
  close(code: number, reason = '', options: FakeMessageOptions = {}): this {
    const wire = this.wire;
    if (wire.record.state !== 'OPEN') {
      throw new FakeSocketMessageError({ reason: FakeMessageViolation.NOT_OPEN, direction: 'server', issues: [`socket ${wire.record.id} is ${wire.record.state}`] });
    }
    if (options.violatesContract !== true && !REALTIME_CLOSE_CODES.some((entry) => entry.code === code)) {
      throw new FakeSocketMessageError({
        reason: FakeMessageViolation.UNDOCUMENTED_CLOSE_CODE,
        direction: 'server',
        issues: [`code ${code}: the contract lists ${REALTIME_CLOSE_CODES.map((entry) => entry.code).join(', ')}`],
      });
    }
    stopSeries(wire);
    wire.record.state = 'CLOSED';
    wire.record.closed = { by: 'server', code, reason };
    emit(this.socket, 'close', { code, reason, wasClean: true });
    return this;
  }

  /** The connection is lost without a close frame: the socket reports an error, then closes with 1006. */
  drop(): this {
    const wire = this.wire;
    if (wire.record.state === 'CLOSED') return this;
    stopSeries(wire);
    wire.record.state = 'CLOSED';
    wire.record.closed = { by: 'network', code: ABNORMAL_CLOSURE, reason: '' };
    emit(this.socket, 'error');
    emit(this.socket, 'close', { code: ABNORMAL_CLOSURE, reason: '', wasClean: false });
    return this;
  }

  // ── Messages built from the fake's clock and position ───────────────────────────────────

  /** `hello` for a principal, with the topics the contract gives it. */
  hello(principal: RealtimePrincipal, overrides: Partial<Omit<HelloMessage, 'type' | 'v'>> = {}): this {
    const { context } = this.wire.hub;
    const message: HelloMessage = {
      type: 'hello',
      v: 1,
      connectionId: `fake-connection-${this.id}`,
      epoch: context.position.epoch,
      principal,
      topics: [...DEFAULT_TOPICS[principal]],
      serverTime: Math.max(0, Math.floor(context.clock.now())),
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      ...overrides,
    };
    return this.send(message);
  }

  /** One heartbeat: `seq` counts the beats of this fake, `serverTime` is its clock. */
  heartbeat(overrides: Partial<Omit<Heartbeat, 'type' | 'v'>> = {}): this {
    const { hub } = this.wire;
    const seq = hub.nextBeat();
    const message: Heartbeat = {
      type: 'heartbeat',
      v: 1,
      seq,
      serverTime: new Date(hub.context.clock.now()).toISOString(),
      uptimeMs: seq * HEARTBEAT_INTERVAL_MS,
      intervalMs: HEARTBEAT_INTERVAL_MS,
      clients: hub.openCount(),
      sessionState: null,
      ...overrides,
    };
    return this.send(message);
  }

  /** Sends a heartbeat every `intervalMs` of the fake's clock while the connection is open. Returns the stop function. */
  beatEvery(intervalMs: number = HEARTBEAT_INTERVAL_MS): () => void {
    const wire = this.wire;
    if (!(intervalMs > 0)) throw new FakeTransportUsageError('the heartbeat interval must be above 0');
    let cancel: () => void = () => undefined;
    let stopped = false;
    const stop = (): void => {
      stopped = true;
      cancel();
      wire.stops.delete(stop);
    };
    const beat = (): void => {
      if (stopped || wire.record.state !== 'OPEN') return;
      this.heartbeat();
      cancel = wire.hub.context.clock.schedule(intervalMs, beat);
    };
    cancel = wire.hub.context.clock.schedule(intervalMs, beat);
    wire.stops.add(stop);
    return stop;
  }

  /** The whole replicated state, at the fake's position (or the one given, which then becomes the position). */
  snapshot(state: SnapshotMessage['state'], options: FakeStateMessageOptions = {}): this {
    const { context } = this.wire.hub;
    const message: SnapshotMessage = {
      type: 'snapshot',
      v: 1,
      epoch: options.epoch ?? context.position.epoch,
      revision: options.revision ?? context.position.revision,
      serverTime: options.serverTime ?? Math.max(0, Math.floor(context.clock.now())),
      state,
    };
    this.send(message);
    context.position.epoch = message.epoch;
    context.position.revision = message.revision;
    return this;
  }

  /** One delta. Its revision is the fake's position plus 1 (or the one given); the position moves to it. */
  delta(ops: DeltaMessage['ops'], options: FakeStateMessageOptions = {}): this {
    const { context } = this.wire.hub;
    const message: DeltaMessage = {
      type: 'delta',
      v: 1,
      epoch: options.epoch ?? context.position.epoch,
      revision: options.revision ?? context.position.revision + 1,
      serverTime: options.serverTime ?? Math.max(0, Math.floor(context.clock.now())),
      ops,
    };
    this.send(message);
    context.position.epoch = message.epoch;
    context.position.revision = message.revision;
    return this;
  }

  /** One audio frame. */
  meters(audio: MetersMessage['audio']): this {
    const { hub } = this.wire;
    const message: MetersMessage = { type: 'meters', v: 1, at: Math.max(0, Math.floor(hub.context.clock.now())), seq: hub.nextMeter(), audio };
    return this.send(message);
  }

  // ── The four control messages (01_specs §9.4) ───────────────────────────────────────────

  /** `session.updated`: the role of the session's operator changed. */
  sessionUpdated(operator: SessionUpdatedMessage['operator'], permissions: SessionUpdatedMessage['permissions']): this {
    const message: SessionUpdatedMessage = { type: 'session.updated', v: 1, operator, permissions, reason: 'ROLE_CHANGED' };
    return this.send(message);
  }

  /** `session.ended`, then the close with 4401 that the Core server sends right after. */
  sessionEnded(reason: SessionEndedMessage['reason']): this {
    const message: SessionEndedMessage = { type: 'session.ended', v: 1, reason };
    return this.send(message).close(RealtimeCloseCode.SESSION_ENDED);
  }

  /** `device.revoked`, then the close with 4403 that the Core server sends right after. */
  deviceRevoked(reason: DeviceRevokedMessage['reason']): this {
    const message: DeviceRevokedMessage = { type: 'device.revoked', v: 1, reason };
    return this.send(message).close(RealtimeCloseCode.DEVICE_REVOKED);
  }

  /** `admin.changed`: a list of an administration page changed. */
  adminChanged(resource: AdminChangedMessage['resource']): this {
    const message: AdminChangedMessage = { type: 'admin.changed', v: 1, resource };
    return this.send(message);
  }

  // ── Common starts ───────────────────────────────────────────────────────────────────────

  /** An anonymous start: the upgrade is accepted and `hello` names ANONYMOUS, with the reason when a credential was not accepted. */
  startAnonymous(reason?: HelloMessage['reason']): this {
    return this.accept().hello(RealtimePrincipal.ANONYMOUS, reason === undefined ? {} : { reason });
  }

  /** A paired device with nobody signed in: accepted, `hello` names DEVICE. */
  startDevice(): this {
    return this.accept().hello(RealtimePrincipal.DEVICE);
  }

  /** A signed-in start: accepted, `hello` names OPERATOR, then the snapshot of `state`. */
  startOperator(state: SnapshotMessage['state'], options: FakeOperatorStartOptions = {}): this {
    const topics: RealtimeTopic[] = [...DEFAULT_TOPICS[RealtimePrincipal.OPERATOR]];
    if (options.admin) topics.push(RealtimeTopic.ADMIN);
    return this.accept().hello(RealtimePrincipal.OPERATOR, { topics }).snapshot(state);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The socket side of one fake
// ═══════════════════════════════════════════════════════════════════════════════════════

/** A socket constructor of the platform's shape; React Native passes the upgrade headers as `options.headers`. */
export interface FakeWebSocketConstructor {
  new (url: string, protocols?: string | readonly string[] | null, options?: FakeSocketOptions | null): FakeSocket;
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSING: 2;
  readonly CLOSED: 3;
}

/**
 * A socket factory of the shape the socket clients take (`SocketFactory`). Arguments after the URL
 * are read as a platform constructor reads them: a subprotocol or a list of them, and an object
 * that holds the upgrade headers (`{ headers }`, or the headers themselves).
 */
export type FakeSocketFactory = (url: string, ...rest: readonly unknown[]) => FakeSocket;

export type FakeConnectScript = (connection: FakeConnection) => void;

export interface FakeSocketSide {
  readonly WebSocket: FakeWebSocketConstructor;
  readonly socketFactory: FakeSocketFactory;
  readonly connections: readonly FakeConnection[];
  connection(index?: number): FakeConnection;
  onConnect(script: FakeConnectScript): () => void;
  runPendingConnects(): void;
  resetConnectScripts(): void;
}

function upgradeArguments(second: unknown, third: unknown): { protocols: string[]; headers: Record<string, string>; problems: string[] } {
  const protocols: string[] = [];
  let headers: Record<string, string> = {};
  const problems: string[] = [];
  for (const argument of [second, third]) {
    if (argument === undefined || argument === null) continue;
    if (typeof argument === 'string') protocols.push(argument);
    else if (Array.isArray(argument)) {
      for (const protocol of argument as unknown[]) {
        if (typeof protocol === 'string') protocols.push(protocol);
        else problems.push('protocols');
      }
    } else if (typeof argument === 'object') {
      const bag = argument as { headers?: unknown };
      const values = Object.values(argument);
      const source =
        typeof bag.headers === 'object' && bag.headers !== null
          ? bag.headers
          : values.length > 0 && values.every((value) => typeof value === 'string')
            ? argument
            : null;
      if (source === null) continue;
      const read = normaliseHeaders(source);
      headers = { ...headers, ...read.headers };
      problems.push(...read.problems);
    }
  }
  return { protocols, headers, problems };
}

function upgradeError(url: string, protocols: readonly string[], headers: Readonly<Record<string, string>>, problems: readonly string[]): FakeSocketUpgradeError | null {
  const parsed = parseUrl(url);
  if (!parsed) return new FakeSocketUpgradeError(FakeUpgradeViolation.INVALID_URL, ['url: cannot be read']);
  const places = credentialPlacesInUrl(parsed);
  if (protocols.some((protocol) => holdsCredential(protocol))) places.push('subprotocol');
  if (places.length > 0) return new FakeSocketUpgradeError(FakeUpgradeViolation.CREDENTIAL_IN_URL, places);
  if (parsed.scheme !== 'ws' && parsed.scheme !== 'wss') return new FakeSocketUpgradeError(FakeUpgradeViolation.INVALID_URL, ['url: the scheme is neither ws nor wss']);
  if (parsed.hasFragment) return new FakeSocketUpgradeError(FakeUpgradeViolation.INVALID_URL, ['url: has a fragment']);
  if (parsed.pathname !== WS_PATH) return new FakeSocketUpgradeError(FakeUpgradeViolation.UNKNOWN_ROUTE, [`path: the socket path is ${WS_PATH}`]);
  if (parsed.hasQuery) {
    return new FakeSocketUpgradeError(
      FakeUpgradeViolation.UNEXPECTED_QUERY,
      Object.keys(parsed.query).map((name) => `query.${name}: not in the contract`),
    );
  }
  if (problems.length > 0) return new FakeSocketUpgradeError(FakeUpgradeViolation.INVALID_HEADERS, problems.map((name) => `${name}: not text`));
  const credentialIssues = credentialFormIssues(headers, null);
  if (credentialIssues.length > 0) return new FakeSocketUpgradeError(FakeUpgradeViolation.INVALID_CREDENTIAL_FORM, credentialIssues);
  return null;
}

export function createSocketSide(context: FakeContext): FakeSocketSide {
  const connections: FakeConnection[] = [];
  const scripts: FakeConnectScript[] = [];
  let waiting: FakeConnection[] = [];
  let opened = 0;
  let beats = 0;
  let meterFrames = 0;

  function runWaiting(rethrow: boolean): void {
    const batch = waiting;
    waiting = [];
    for (const connection of batch) {
      for (const script of scripts.slice()) {
        try {
          script(connection);
        } catch (error) {
          if (rethrow) throw error;
          // Run on a promise job: nobody could catch it there, so it is recorded instead.
          context.violation(
            error instanceof FakeTransportError
              ? error
              : new FakeTransportUsageError(`a connect script threw: ${error instanceof Error ? error.message : String(error)}`),
          );
        }
      }
    }
  }

  const hub: FakeSocketHub = {
    context,
    openCount: () => connections.filter((connection) => connection.state === 'OPEN').length,
    nextBeat() {
      const seq = beats;
      beats += 1;
      return seq;
    },
    nextMeter() {
      const seq = meterFrames;
      meterFrames += 1;
      return seq;
    },
    open(socket, url, second, third) {
      const named = url as { href?: unknown } | null;
      const text = typeof url === 'string' ? url : typeof named === 'object' && named !== null && typeof named.href === 'string' ? named.href : String(url);
      const { protocols, headers, problems } = upgradeArguments(second, third);
      opened += 1;
      const record: MutableSocketRecord = {
        kind: 'socket',
        seq: context.log.nextSeq(),
        at: context.clock.now(),
        id: opened,
        url: text,
        protocols,
        headers,
        state: 'CONNECTING',
        frames: [],
        closed: null,
      };
      const wire: Wire = { hub, record, listeners: new Map(), stops: new Set(), helloSent: false, principal: null, topics: [] };
      wires.set(socket, wire);
      const connection = new FakeConnection(socket, wire);
      context.log.addSocket(record);
      const error = upgradeError(text, protocols, headers, problems);
      if (error) {
        // The attempt stays in the log; it is no connection a test could script.
        record.state = 'CLOSED';
        record.closed = { by: 'network', code: null, reason: '' };
        throw context.violation(error);
      }
      connections.push(connection);
      if (scripts.length > 0) {
        waiting.push(connection);
        // After the constructor returned, so the client has attached its handlers by then.
        void Promise.resolve().then(() => runWaiting(false));
      }
      return connection;
    },
  };

  /** The constructor of this fake: a platform socket constructor's arguments, and this fake's hub. */
  class BoundFakeSocket extends FakeSocket {
    constructor(url: unknown, second?: unknown, third?: unknown) {
      super(hub, url, second, third);
    }
  }

  return {
    WebSocket: BoundFakeSocket as unknown as FakeWebSocketConstructor,
    socketFactory: (url, ...rest) => new BoundFakeSocket(url, rest[0], rest[1]),
    connections,
    connection(index) {
      const found = index === undefined ? connections[connections.length - 1] : connections[index];
      if (!found) {
        throw new FakeTransportUsageError(
          index === undefined ? 'no socket was opened yet' : `there is no socket at index ${index} (${connections.length} opened)`,
          'NO_SOCKET',
        );
      }
      return found;
    },
    onConnect(script) {
      scripts.push(script);
      return () => {
        const at = scripts.indexOf(script);
        if (at >= 0) scripts.splice(at, 1);
      };
    },
    runPendingConnects: () => runWaiting(true),
    resetConnectScripts() {
      scripts.length = 0;
      waiting = [];
    },
  };
}
