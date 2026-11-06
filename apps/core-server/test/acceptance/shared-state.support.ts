/**
 * Support of the acceptance test "two-client shared state with resync" (plan row W49; not a test
 * file). What the scenarios of `shared-state.test.ts` share:
 *
 *   stage       the real app on a clone of the seed, as `dems_app`, BOOTED, on a manual clock and
 *               manual timers, listening on `127.0.0.1` at an ephemeral port (port 0);
 *   stations    a browser tab and a tablet app as stand-ins over Node's own `fetch` and
 *               `WebSocket`: each sends what its platform sends and nothing else, and RECORDS
 *               every frame its sockets receive and every answer its requests get;
 *   clients     the shared Live source (`createLiveSim`) with the typed client and the Live socket
 *               client, unchanged, on a station;
 *   relay       a TCP relay of the test: the network between one client and the Core, which the
 *               test can cut and hold down;
 *   shadow      a second replica per client, built by this file from the recorded frames by the
 *               rule of spec §9.3 alone, without any code of the Live source;
 *   comparison  slices in a canonical form, digests, the problems of a frame, of a socket's
 *               sequence of state messages, and of what a principal may be sent.
 *
 * TIME. The server clock is a manual clock; the engine ticks and the channel beats, paces and
 * pings only when a test says so. The clients run on the platform's real clock and timers, as in
 * an app. The only real waiting is `until`: a poll for an EVENT of a socket or a request, with a
 * cap that turns an event that never comes into a failure. It sends a heartbeat every 400 ms of
 * real waiting, so that no client's link goes stale (2,500 ms) while the test waits.
 *
 * SECRETS (P19). A cookie value, a session token and a device credential are taken from an answer
 * and handed on as a header. None is printed, put into a record of this file, a test name or the
 * message of an assertion: a frame is recorded as its parsed JSON and its problems, an answer as
 * method, path, status and the two counters of API-7.
 */
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { connect, createServer, type AddressInfo, type Socket } from 'node:net';
import { performance } from 'node:perf_hooks';
import {
  EPOCH_HEADER_NAME,
  HEARTBEAT_INTERVAL_MS,
  REALTIME_SERVER_MESSAGES,
  REPLICATED_SLICE_NAMES,
  REVISION_HEADER_NAME,
  WsServerMessageSchema,
  canReceiveRealtimeMessage,
  type HelloMessage,
  type WsServerMessage,
} from '@dems/shared/api';
import { createCoreClient, type CoreClient, type CoreClientReport, type CoreFetch } from '@dems/shared/client';
import { createLiveSim, type CreateLiveSimOptions, type LiveSessionEnd, type LiveSim } from '@dems/shared/live/source';
import { AUDIT_RING_SIZE, EVENT_RING_SIZE, createManualClock, type SimErrorReport } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { WebSocket as ServerSocket } from 'ws';
// By file, not through `@dems/shared/realtime`: that entry point also exports a React context from
// a `.tsx` file, which this workspace's compiler options (no `jsx`) cannot type-check (decision
// D111 DN-7).
import {
  createLiveSocketClient,
  type LiveSocketClient,
  type LiveSocketControlMessage,
  type LiveSocketFactory,
  type LiveSocketLike,
  type LiveSocketResyncEvent,
} from '../../../../packages/shared/src/realtime/live-socket-client';
import { buildApp } from '../../src/app';
import type { DatabaseConnection } from '../../src/config';
import { engineControl, type EngineControl, type EngineHost } from '../../src/engine';
import { identityControl } from '../../src/modules/identity';
import { pairingControl } from '../../src/modules/pairing';
import { REALTIME_DELTA_PACE_MS, realtimeControl, type RealtimeControl } from '../../src/realtime';
import { captureLog, credentialLeaks, unitTestConfig, type CapturedLog } from '../support/config';
import { manualTimer } from '../support/engine';
import { CLOCK_START, OWN_ORIGIN, WEB_ORIGIN, identityApp, type IdentityApp, type IdentityTarget, type ManualClock } from '../support/identity';
import type { PairingApp } from '../support/pairing';

// ── Bounds of the real waits (each is a cap, never a pause) ────────────────────────────────────

/** A socket event or an answered request that the test waits for: loopback, so milliseconds; the cap is for a loaded host. */
export const EVENT_CAP_MS = 15_000;
/** A client's own reconnect: its first delay is 500 ms plus up to 250 ms of jitter (RT-P2), the second 1,000 ms. */
export const RECONNECT_CAP_MS = 30_000;
/** While `until` waits, a heartbeat this often: a client's link is stale after 2,500 ms without one. */
const KEEP_ALIVE_MS = 400;
/** The engine's timer period: one timer call per 50 ms of the server clock. */
export const TICK_MS = 50;
/** How long a close of the app may take before the test fires the channel's close deadline itself. */
const CLOSE_GRACE_MS = 3_000;

const SOCKET_CLOSED = 3;
const SOCKET_OPEN = 1;

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ── Slices in a canonical form ─────────────────────────────────────────────────────────────────

/** The replicated slices of a state, by name. */
export type Slices = Readonly<Record<string, unknown>>;

export interface Position {
  readonly epoch: number;
  readonly revision: number;
}

export const positionText = (position: Position | null): string => (position === null ? 'none' : `${position.epoch}/${position.revision}`);

/**
 * A value as JSON with the members of every object in name order: two values with equal canonical
 * texts are equal as they travel over the wire. The order of the members of an object is not part
 * of a slice (a client's parser writes them in the schema's order).
 */
export function canonical(value: unknown): string {
  const text = JSON.stringify(value, (_key, inner: unknown) => {
    if (inner === null || typeof inner !== 'object' || Array.isArray(inner)) return inner;
    const source = inner as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = source[key];
    return sorted;
  });
  return text ?? 'undefined';
}

/** The 30 replicated slices of a state that may hold more (a Live store holds 35). */
export function replicatedOf(state: Readonly<Record<string, unknown>>): Slices {
  const picked: Record<string, unknown> = {};
  for (const name of REPLICATED_SLICE_NAMES) picked[name] = state[name];
  return picked;
}

/** The names of the replicated slices in which two states differ, in state order. */
export function differingSlices(left: Slices, right: Slices): string[] {
  return REPLICATED_SLICE_NAMES.filter((name) => canonical(left[name]) !== canonical(right[name]));
}

/** Twelve hexadecimal digits of the SHA-256 over the 30 slices in canonical form: equal digests, equal states. */
export function digestOf(state: Slices): string {
  const hash = createHash('sha256');
  for (const name of REPLICATED_SLICE_NAMES) hash.update(`${name}\n${canonical(state[name])}\n`, 'utf8');
  return hash.digest('hex').slice(0, 12);
}

/** A value as it arrives over the wire. */
export const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// ── A frame and the socket it arrived on ───────────────────────────────────────────────────────

export interface Frame {
  /** Its place among the frames of its socket, from 0. */
  readonly index: number;
  /** `server`: it arrived on the socket. `test`: the test made it and handed it to the client (rule 7). */
  readonly origin: 'server' | 'test';
  /** The frame as JSON; `undefined` for a frame that is no JSON text. */
  readonly json: unknown;
  /** `type` of the JSON when it is text; else null. */
  readonly type: string | null;
  /** The frame as a message of the contract's union; null when the union refuses it. */
  readonly message: WsServerMessage | null;
  /** Why the frame is no message of the contract: issue codes, paths and member names; never a value. */
  readonly problems: readonly string[];
  /** What in its text looks like a credential: kinds only (`credentialLeaks`). */
  readonly leaks: readonly string[];
  readonly bytes: number;
  /** False when the test kept the frame from the client (rule 7). */
  delivered: boolean;
}

export interface WireClose {
  /** The close code the runtime reported: 1006 when no close frame arrived. */
  readonly code: number;
  readonly clean: boolean;
}

/** One socket a station opened, with everything that arrived on it. */
export interface Wire {
  /** Who opened it: `A`, `B`, `C`, `anonymous`, `link`. */
  readonly owner: string;
  /** Counts the sockets of that owner; 1 is the first. */
  readonly number: number;
  readonly frames: Frame[];
  /** The `type` of every message the client sent on it. */
  readonly sent: string[];
  /** The first frame, when it was a valid `hello`. */
  hello: HelloMessage | null;
  /** `seq` of the newest heartbeat; -1 before the first. */
  heartbeatSeq: number;
  /** True once the handshake completed. */
  opened: boolean;
  closed: WireClose | null;
  /** How often the runtime reported an error on it. */
  errors: number;
  /** `readyState` of the socket underneath: 3 is closed. */
  readyState(): number;
}

const TYPES_OF_THE_CONTRACT: ReadonlySet<string> = new Set(REALTIME_SERVER_MESSAGES.map((entry) => entry.type));

interface Inspection {
  readonly json: unknown;
  readonly type: string | null;
  readonly message: WsServerMessage | null;
  readonly problems: string[];
  readonly leaks: string[];
  readonly bytes: number;
}

/** A frame against the contract's union (AC-B-46): the message, or why it is none. */
export function inspect(data: unknown): Inspection {
  if (typeof data !== 'string') return { json: undefined, type: null, message: null, problems: ['a frame that is not text'], leaks: [], bytes: 0 };
  const bytes = Buffer.byteLength(data, 'utf8');
  const leaks = credentialLeaks(data).map((leak) => leak.replace(/ in line \d+$/, ''));
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return { json: undefined, type: null, message: null, problems: ['a text frame that is not JSON'], leaks, bytes };
  }
  const named = typeof json === 'object' && json !== null ? (json as { type?: unknown }).type : undefined;
  const type = typeof named === 'string' ? named : null;
  const parsed = WsServerMessageSchema.safeParse(json);
  if (parsed.success) return { json, type, message: parsed.data, problems: [], leaks, bytes };
  const problems = parsed.error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.length === 0 ? '(the message)' : issue.path.map(String).join('.');
    const keys = issue.code === 'unrecognized_keys' ? ` [${issue.keys.join(', ')}]` : '';
    return `${type !== null && TYPES_OF_THE_CONTRACT.has(type) ? type : 'a message of no type of the contract'}: ${issue.code}${keys} at ${path}`;
  });
  return { json, type, message: null, problems, leaks, bytes };
}

// ── A second replica, by the rule of spec §9.3 alone ───────────────────────────────────────────

type StateMessage = Extract<WsServerMessage, { type: 'snapshot' | 'delta' }>;

export interface Shadow {
  position(): Position | null;
  /** The 30 slices now; null before the first snapshot. */
  slices(): Slices | null;
  /** The slices when the shadow stood at that position; `undefined` when it never stood there. */
  at(position: Position): Slices | undefined;
  /** True between a delta that did not continue the position and the next snapshot (RT-6). */
  behind(): boolean;
  /** Every delta that did not continue the position: `delta 2/7 does not continue 2/5`. */
  readonly gaps: string[];
  readonly counts: { snapshots: number; deltas: number; stale: number; dropped: number };
  apply(message: StateMessage): void;
}

/**
 * What a client holds that applies state messages as spec §9.3 says and nothing more: a `snapshot`
 * replaces everything; a `delta` must be the last revision plus 1 in the same epoch (RT-2);
 * `replace` sets one slice, `append` adds rows to the ring of `audit` (with `head`, `total`,
 * `dropped`) or of `events` (RT-3). A delta at or below the position is already held and ignored;
 * any other delta is a gap: the client is behind until the next snapshot (RT-6).
 */
export function createShadow(): Shadow {
  let position: Position | null = null;
  let state: Record<string, unknown> | null = null;
  let behind = false;
  const history = new Map<string, Slices>();
  const gaps: string[] = [];
  const counts = { snapshots: 0, deltas: 0, stale: 0, dropped: 0 };
  const remember = (): void => {
    if (position !== null && state !== null) history.set(positionText(position), state);
  };
  return {
    position: () => position,
    slices: () => state,
    at: (asked) => history.get(positionText(asked)),
    behind: () => behind,
    gaps,
    counts,
    apply(message) {
      if (message.type === 'snapshot') {
        position = { epoch: message.epoch, revision: message.revision };
        state = { ...(wire(message.state) as unknown as Record<string, unknown>) };
        behind = false;
        counts.snapshots += 1;
        remember();
        return;
      }
      if (position === null || state === null || behind) {
        counts.dropped += 1;
        return;
      }
      if (message.epoch < position.epoch || (message.epoch === position.epoch && message.revision <= position.revision)) {
        counts.stale += 1;
        return;
      }
      if (message.epoch !== position.epoch || message.revision !== position.revision + 1) {
        gaps.push(`delta ${message.epoch}/${message.revision} does not continue ${positionText(position)}`);
        behind = true;
        counts.dropped += 1;
        return;
      }
      // A new object per revision, slices by reference: an earlier position keeps what it held.
      const next: Record<string, unknown> = { ...state };
      for (const op of wire(message.ops)) {
        if (op.op === 'replace') {
          next[op.slice] = op.value;
        } else if (op.slice === 'audit') {
          const ring = next['audit'] as { rows: unknown[] };
          const rows = [...ring.rows, ...op.rows];
          next['audit'] = { rows: rows.slice(Math.max(0, rows.length - AUDIT_RING_SIZE)), head: op.head, total: op.total, dropped: op.dropped };
        } else {
          const events = [...(next['events'] as unknown[]), ...op.rows];
          next['events'] = events.slice(Math.max(0, events.length - EVENT_RING_SIZE));
        }
      }
      state = next;
      position = { epoch: message.epoch, revision: message.revision };
      counts.deltas += 1;
      remember();
    },
  };
}

// ── Stations: a browser tab, a tablet app, a bare socket ───────────────────────────────────────

/** One answered (or unanswered) request of a station: nothing of its body, its headers or its query. */
export interface Answer {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  /** null: no answer (the network was down). */
  readonly status: number | null;
  /** `x-dems-epoch` and `x-dems-revision` of the answer (API-7); null when absent. */
  readonly epoch: number | null;
  readonly revision: number | null;
  /** Milliseconds on the test's own clock. */
  readonly at: number;
}

export interface Station {
  readonly name: string;
  readonly kind: 'web' | 'tablet';
  /** Node's `fetch`, sending what the platform sends. */
  readonly fetch: CoreFetch;
  /** Node's `WebSocket`, sending what the platform sends on the upgrade, behind a recorder. */
  readonly socketFactory: LiveSocketFactory;
  /** Every socket the station opened, in order. */
  readonly wires: Wire[];
  /** Every request of the station, in the order of the answers. */
  readonly answers: Answer[];
  /** The replica this file builds from the frames that were DELIVERED to the client. */
  readonly shadow: Shadow;
  /** The newest socket. */
  wire(): Wire;
  /**
   * Rule 7: from now on every frame of the server that matches is recorded and NOT handed to the
   * client, until `stop()`. `taken` holds the frames that were withheld.
   */
  withhold(matches: (message: WsServerMessage) => boolean): Withholding;
  /** Rule 7: hands the client a frame the test made, on its newest socket; recorded with origin `test`. */
  inject(text: string): Frame;
}

export interface Withholding {
  readonly taken: Frame[];
  stop(): void;
}

export interface BrowserStation extends Station {
  readonly kind: 'web';
  /** Puts a cookie into the jar, as an earlier sign-in of this browser left it: `name=value`. */
  give(cookie: string): void;
  hasCookie(name: string): boolean;
}

export interface TabletStation extends Station {
  readonly kind: 'tablet';
  /** The app's secrets, in memory: what its credential providers return. Never printed. */
  readonly secrets: { deviceCredential: string | null; sessionToken: string | null };
  /** The bearer value of the next request: the session token when signed in, else the device credential. */
  bearer(): string | null;
  /** The headers of the next upgrade. */
  headers(): Record<string, string> | null;
}

/** A socket no client drives: the anonymous observer, the device that holds the Core link. */
export interface BareSocket {
  readonly wire: Wire;
  close(): void;
}

interface Recorder {
  readonly wires: Wire[];
  readonly shadow: Shadow;
  /** Opens a recorded socket with exactly these request headers. */
  open(url: string, headers: Record<string, string>): LiveSocketLike;
  withhold: Station['withhold'];
  inject: Station['inject'];
}

const counterOf = (value: string | null): number | null => (value !== null && /^\d+$/.test(value) ? Number(value) : null);

/**
 * Node's own `WebSocket`. Its second argument also takes the request headers of the upgrade (the
 * runtime's extension, which the type of the global does not name): how a test gives a stand-in
 * the `Origin`, the cookie or the bearer value its platform would send.
 */
const NodeWebSocket = WebSocket as unknown as new (url: string, options: { readonly headers: Record<string, string> }) => WebSocket;

/** The sockets of one owner behind a recorder, and the test's two ways into the stream (rule 7). */
function recorder(owner: string, every: Wire[]): Recorder {
  const wires: Wire[] = [];
  const shadow = createShadow();
  const deliver = new WeakMap<Wire, (text: string) => void>();
  const withholding: Array<{ readonly matches: (message: WsServerMessage) => boolean; readonly taken: Frame[]; active: boolean }> = [];

  function record(target: Wire, data: unknown, origin: Frame['origin']): Frame {
    const inspected = inspect(data);
    const frame: Frame = { index: target.frames.length, origin, delivered: true, ...inspected };
    target.frames.push(frame);
    return frame;
  }

  /** What a recorded frame means for the socket and for the shadow of its owner. */
  function note(target: Wire, frame: Frame): void {
    const message = frame.message;
    if (message === null) return;
    if (message.type === 'hello' && frame.index === 0) target.hello = message;
    if (message.type === 'heartbeat') target.heartbeatSeq = Math.max(target.heartbeatSeq, message.seq);
    if (frame.delivered && (message.type === 'snapshot' || message.type === 'delta')) shadow.apply(message);
  }

  return {
    wires,
    shadow,
    open(url, headers) {
      const real = new NodeWebSocket(url, { headers });
      const target: Wire = {
        owner,
        number: wires.length + 1,
        frames: [],
        sent: [],
        hello: null,
        heartbeatSeq: -1,
        opened: false,
        closed: null,
        errors: 0,
        readyState: () => real.readyState,
      };
      wires.push(target);
      every.push(target);
      // What the client sees of the socket: the members of `LiveSocketLike`, and its own handlers.
      const seen: LiveSocketLike = {
        get readyState() {
          return real.readyState;
        },
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        send(data) {
          let type = 'not JSON';
          try {
            type = String((JSON.parse(data) as { type?: unknown }).type);
          } catch {
            // Recorded as what it is.
          }
          target.sent.push(type);
          real.send(data);
        },
        close(code, reason) {
          real.close(code, reason);
        },
      };
      deliver.set(target, (text) => seen.onmessage?.({ data: text }));
      real.addEventListener('open', (event) => {
        target.opened = true;
        seen.onopen?.(event);
      });
      real.addEventListener('message', (event) => {
        const frame = record(target, event.data, 'server');
        const held = frame.message === null ? undefined : withholding.find((entry) => entry.active && entry.matches(frame.message as WsServerMessage));
        if (held !== undefined) {
          held.taken.push(frame);
          frame.delivered = false;
        }
        note(target, frame);
        if (frame.delivered) seen.onmessage?.({ data: event.data });
      });
      real.addEventListener('close', (event) => {
        target.closed = { code: event.code, clean: event.wasClean };
        seen.onclose?.({ code: event.code, reason: event.reason });
      });
      real.addEventListener('error', (event) => {
        target.errors += 1;
        seen.onerror?.(event);
      });
      return seen;
    },
    withhold(matches) {
      const entry = { matches, taken: [] as Frame[], active: true };
      withholding.push(entry);
      return {
        taken: entry.taken,
        stop() {
          entry.active = false;
        },
      };
    },
    inject(text) {
      const target = wires.at(-1);
      const hand = target === undefined ? undefined : deliver.get(target);
      if (target === undefined || hand === undefined) throw new Error(`${owner} has no socket to take a frame`);
      const frame = record(target, text, 'test');
      note(target, frame);
      hand(text);
      return frame;
    },
  };
}

function newestWire(owner: string, wires: readonly Wire[]): Wire {
  const newest = wires.at(-1);
  if (newest === undefined) throw new Error(`${owner} opened no socket yet`);
  return newest;
}

/** What a request of a station was answered, without anything a credential could be in. */
function answerOf(method: 'GET' | 'POST', input: string, response: { status: number; headers: { get(name: string): string | null } } | null): Answer {
  return {
    method,
    path: new URL(input).pathname,
    status: response?.status ?? null,
    epoch: response === null ? null : counterOf(response.headers.get(EPOCH_HEADER_NAME)),
    revision: response === null ? null : counterOf(response.headers.get(REVISION_HEADER_NAME)),
    at: performance.now(),
  };
}

/**
 * A browser tab on a web console's origin: a cookie jar for the host, the page's `Origin` on a
 * POST and on the upgrade, the cookie on a same-origin request and on the upgrade. No header that
 * a browser cannot set on a socket.
 */
function browserStation(name: string, every: Wire[]): BrowserStation {
  const jar = new Map<string, string>();
  const cookieHeader = (): Record<string, string> => (jar.size === 0 ? {} : { cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') });
  const answers: Answer[] = [];
  const recorded = recorder(name, every);
  return {
    name,
    kind: 'web',
    wires: recorded.wires,
    answers,
    shadow: recorded.shadow,
    wire: () => newestWire(name, recorded.wires),
    withhold: recorded.withhold,
    inject: recorded.inject,
    async fetch(input, init) {
      let response: Response;
      try {
        response = await fetch(input, {
          method: init.method,
          headers: { ...init.headers, ...(init.credentials === 'same-origin' ? cookieHeader() : {}), ...(init.method === 'POST' ? { origin: WEB_ORIGIN } : {}) },
          ...(init.body === undefined ? {} : { body: init.body }),
          ...(init.signal === undefined ? {} : { signal: init.signal }),
        });
      } catch (error) {
        answers.push(answerOf(init.method, input, null));
        throw error;
      }
      for (const line of response.headers.getSetCookie()) {
        const [pair = '', ...attributes] = line.split(';').map((part) => part.trim());
        const at = pair.indexOf('=');
        const key = pair.slice(0, at);
        const value = pair.slice(at + 1);
        const expired = value === '' || attributes.some((attribute) => /^max-age=0$/i.test(attribute) || /^expires=thu, 01 jan 1970/i.test(attribute));
        if (expired) jar.delete(key);
        else jar.set(key, value);
      }
      answers.push(answerOf(init.method, input, response));
      return response;
    },
    socketFactory: (url) => recorded.open(url, { origin: WEB_ORIGIN, ...cookieHeader() }),
    give(cookie) {
      const at = cookie.indexOf('=');
      jar.set(cookie.slice(0, at), cookie.slice(at + 1));
    },
    hasCookie: (key) => jar.has(key),
  };
}

/**
 * The tablet app (measured on the emulator, decision D69): no `Origin` and no cookie on REST, one
 * bearer value; on the upgrade the origin of the URL it opens as React Native adds it (one of the
 * instance's own origins) and the same bearer value.
 */
function tabletStation(name: string, deviceCredential: string, every: Wire[]): TabletStation {
  const secrets: TabletStation['secrets'] = { deviceCredential, sessionToken: null };
  const answers: Answer[] = [];
  const recorded = recorder(name, every);
  const bearer = (): string | null => secrets.sessionToken ?? secrets.deviceCredential;
  return {
    name,
    kind: 'tablet',
    wires: recorded.wires,
    answers,
    shadow: recorded.shadow,
    wire: () => newestWire(name, recorded.wires),
    withhold: recorded.withhold,
    inject: recorded.inject,
    secrets,
    bearer,
    headers() {
      const value = bearer();
      return value === null ? null : { Authorization: `Bearer ${value}` };
    },
    async fetch(input, init) {
      let response: Response;
      try {
        // The typed client asks with `credentials: 'omit'`: no cookie, and this platform adds no `Origin`.
        response = await fetch(input, {
          method: init.method,
          headers: init.headers,
          ...(init.body === undefined ? {} : { body: init.body }),
          ...(init.signal === undefined ? {} : { signal: init.signal }),
        });
      } catch (error) {
        answers.push(answerOf(init.method, input, null));
        throw error;
      }
      answers.push(answerOf(init.method, input, response));
      return response;
    },
    socketFactory: (url, headers) => recorded.open(url, { origin: OWN_ORIGIN, ...headers }),
  };
}

// ── A client: the shared Live source on a station ──────────────────────────────────────────────

export interface LiveClient {
  readonly name: string;
  readonly station: Station;
  readonly live: LiveSim<CoreClient>;
  /** Every report of the Live source (`onError`): level, source and message. */
  readonly reports: SimErrorReport[];
  /** Every report of the typed client: an answer that was not the contract's, or no answer. */
  readonly clientReports: CoreClientReport[];
  readonly ends: LiveSessionEnd[];
  /** The control messages the Live source handed on. */
  readonly control: LiveSocketControlMessage[];
  readonly resyncs: LiveSocketResyncEvent[];
  /** The link states the source went through, without repetitions. */
  readonly links: string[];
  /** The Live socket client the source built: for an explicit `requestResync()`. */
  socketClient(): LiveSocketClient;
  /** The 30 replicated slices of the store, as they are now. */
  replica(): Slices;
  /** The position of the last state message the socket client handed on. */
  position(): Position | null;
}

export interface Urls {
  readonly httpUrl: string;
  readonly wsUrl: string;
}

// ── A relay: the network between one client and the Core ───────────────────────────────────────

export interface Relay extends Urls {
  readonly port: number;
  /** Refuses new connections; the open ones stay. */
  refuse(): void;
  /** Destroys every connection through the relay, both legs, and refuses new ones: the cable is cut. */
  cut(): number;
  /** Accepts connections again. */
  accept(): void;
  /** The local ports of the open legs towards the Core: the remote ports under which the server sees this client. */
  upstreamPorts(): number[];
  readonly counters: { accepted: number; refused: number; destroyedByCut: number };
  listening(): boolean;
  close(): Promise<void>;
}

async function openRelay(targetPort: number): Promise<Relay> {
  const legs = new Set<{ readonly client: Socket; readonly upstream: Socket }>();
  const counters = { accepted: 0, refused: 0, destroyedByCut: 0 };
  let refusing = false;
  const server = createServer((client) => {
    if (refusing) {
      counters.refused += 1;
      client.destroy();
      return;
    }
    counters.accepted += 1;
    const upstream = connect({ host: '127.0.0.1', port: targetPort });
    const leg = { client, upstream };
    legs.add(leg);
    const end = (): void => {
      legs.delete(leg);
      client.destroy();
      upstream.destroy();
    };
    // A reset of either side is told by its `close`; an `error` without a listener would end the process.
    client.on('error', () => undefined);
    upstream.on('error', () => undefined);
    client.on('close', end);
    upstream.on('close', end);
    client.pipe(upstream);
    upstream.pipe(client);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return {
    port,
    httpUrl: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}/ws`,
    counters,
    refuse() {
      refusing = true;
    },
    cut() {
      refusing = true;
      const open = [...legs];
      for (const leg of open) {
        leg.client.destroy();
        leg.upstream.destroy();
      }
      counters.destroyedByCut += open.length;
      return open.length;
    },
    accept() {
      refusing = false;
    },
    upstreamPorts: () => [...legs].flatMap((leg) => (leg.upstream.localPort === undefined ? [] : [leg.upstream.localPort])),
    listening: () => server.listening,
    close() {
      for (const leg of legs) {
        leg.client.destroy();
        leg.upstream.destroy();
      }
      if (!server.listening) return Promise.resolve();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Resolves true when nothing accepts a TCP connection on that loopback port. */
export function refusesConnections(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = connect({ host: '127.0.0.1', port });
    probe.once('connect', () => {
      probe.destroy();
      resolve(false);
    });
    probe.once('error', () => resolve(true));
  });
}

// ── The stage ──────────────────────────────────────────────────────────────────────────────────

/** What was left when a stage closed: every member must be the empty value. */
export interface EndState {
  /** Listeners of the test that still listen: the app's, a relay's. */
  readonly listening: string[];
  /** Ports of the test that still accept a connection. */
  readonly accepting: number[];
  /** Sockets a station opened that are not closed. */
  readonly openClientSockets: string[];
  /** Sockets the server accepted that are not closed. */
  readonly openServerSockets: number;
  /** Sockets the hub still knew when the clients had stopped. */
  readonly hubSockets: number;
}

export interface StageCore extends Urls {
  readonly app: FastifyInstance;
  /** The server clock: it moves only when the test moves it. */
  readonly clock: ManualClock;
  readonly log: CapturedLog;
  readonly engine: EngineHost & EngineControl;
  readonly channel: RealtimeControl;
  /** The ephemeral loopback port the server listens on. */
  readonly port: number;
  /** Every socket any station of this stage opened, in order. */
  readonly wires: Wire[];
  readonly clients: LiveClient[];
  /** A browser tab with the shared Live source on it; `through` is its network path (default: direct). */
  web(name: string, options?: { through?: Urls; cookie?: string }): LiveClient;
  /** The tablet app with the shared Live source on it, holding the credential of a paired device. */
  tablet(name: string, device: { credential: string; name: string }, options?: { through?: Urls }): LiveClient;
  /** A recorded socket no client drives, opened with exactly these headers. */
  bare(owner: string, headers: Record<string, string>): BareSocket;
  /** A TCP relay in front of the server. */
  relay(): Promise<Relay>;
  /**
   * The server destroys the stream of every open socket it accepted from one of these remote
   * ports: no close frame, no `session.ended`. Returns how many it destroyed.
   */
  terminateServerSide(remotePorts: readonly number[]): number;
  /** The engine and the channel at real cadence, without real time: 50 ms of the server clock per step. */
  drive(ms: number): Promise<void>;
  /** Polls until the condition holds; fails after the cap with what `describe` says. Returns the turns it waited. */
  until(what: string, holds: () => boolean, capMs?: number, describe?: () => string): Promise<number>;
  /**
   * One heartbeat, awaited on each of the sockets: everything the server sent to a socket before
   * it has arrived when this resolves (frames keep their order).
   */
  barrier(what: string, sockets: readonly Wire[]): Promise<void>;
  /** Stops the clients, closes the bare sockets, the relays and the app, and says what was left. Idempotent. */
  close(): Promise<EndState>;
}

/** A stage built by the identity support: with what `signInOnWeb` and `pairDevice` take. */
export interface Stage extends StageCore {
  /** For `signInOnWeb` of the identity support. */
  readonly identity: IdentityApp;
  /** For `pairDevice` of the pairing support. */
  readonly pairing: PairingApp;
}

/**
 * The real app on a clone: every stage as the server has it, the engine BOOTED on a manual timer
 * (set before the boot, rule M9), the channel on a manual timer, a listener on `127.0.0.1` at
 * port 0. The identity support registers the app's close with the helper, so the clone is never
 * dropped under an open app.
 */
export async function openStage(target: IdentityTarget): Promise<Stage> {
  const identity = await identityApp(target);
  const core = await stageOf(identity);
  return { ...core, identity, pairing: { ...identity, pairing: pairingControl(identity.app), published: [] } };
}

/**
 * The same with the demo controls ON (`DEMS_DEMO_CONTROLS=1`), for the one test that asks for a
 * real demo reset. Built by the app factory directly, as the restart acceptance test does, and
 * NOT registered with the helper: a reset closes everything the helper holds on the database, so
 * the caller closes this stage itself, before the clone is dropped.
 */
export async function openDemoStage(target: { readonly runtime: DatabaseConnection; readonly dataDir: string }): Promise<StageCore> {
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: target.dataDir, logLevel: 'info', port: 4420, demoControls: true }),
    logStream: log.stream,
  });
  try {
    await app.ready();
    const clock = createManualClock(CLOCK_START);
    app.seams.replace('clock', clock);
    return await stageOf({ app, clock, log });
  } catch (error) {
    // Nobody else knows this app: an opening that failed must not leave it behind.
    await app.close().catch(() => undefined);
    throw error;
  }
}

async function stageOf(built: { readonly app: FastifyInstance; readonly clock: ManualClock; readonly log: CapturedLog }): Promise<StageCore> {
  const { app, clock, log } = built;
  const engine = engineControl(app);
  const engineTimer = manualTimer();
  engine.useTimer(engineTimer.timer);
  await app.readiness.boot();
  await engine.idle();
  await app.pipeline.drain();

  const channel = realtimeControl(app);
  // The channel's three timers never fire by themselves: the test beats and paces.
  const channelTimer = manualTimer();
  channel.useTimer(channelTimer.timer);

  // Every socket the server accepts, with the remote port of its connection.
  const accepted: Array<{ readonly socket: ServerSocket; readonly remotePort: number | undefined }> = [];
  app.websocketServer.on('connection', (socket: ServerSocket, request: IncomingMessage) => {
    accepted.push({ socket, remotePort: request.socket.remotePort });
  });

  await app.listen({ host: '127.0.0.1', port: 0 });
  // The two expiry sweepers start with the listener, on the system timer. Nothing expires here.
  identityControl(app).sweeper.stop();
  pairingControl(app).sweeper.stop();

  const { port } = app.server.address() as AddressInfo;
  const direct: Urls = { httpUrl: `http://127.0.0.1:${port}`, wsUrl: `ws://127.0.0.1:${port}/ws` };
  const wires: Wire[] = [];
  const clients: LiveClient[] = [];
  const relays: Relay[] = [];
  const bares: BareSocket[] = [];
  const stoppers: Array<() => void> = [];
  let driven = 0;
  let ended: Promise<EndState> | null = null;

  async function until(what: string, holds: () => boolean, capMs: number = EVENT_CAP_MS, describe?: () => string): Promise<number> {
    const started = performance.now();
    let lastBeat = started;
    let turns = 0;
    while (!holds()) {
      const now = performance.now();
      if (now - started > capMs) throw new Error(`${what}: not within ${capMs} ms${describe === undefined ? '' : `; ${describe()}`}`);
      if (now - lastBeat >= KEEP_ALIVE_MS && channel.running) {
        channel.beat();
        lastBeat = now;
      }
      turns += 1;
      // The first turns cost nothing; a longer wait leaves the processor to whoever is awaited.
      await (turns <= 200 ? new Promise<void>((resolve) => setImmediate(resolve)) : sleep(2));
    }
    return turns;
  }

  function attach(name: string, station: Station, through: Urls, extra: Pick<CreateLiveSimOptions, 'secrets' | 'device'>): LiveClient {
    const reports: SimErrorReport[] = [];
    const clientReports: CoreClientReport[] = [];
    const ends: LiveSessionEnd[] = [];
    const control: LiveSocketControlMessage[] = [];
    const resyncs: LiveSocketResyncEvent[] = [];
    const links: string[] = [];
    let socketClient: LiveSocketClient | null = null;
    const typed = createCoreClient({
      baseUrl: through.httpUrl,
      credentials: station.kind === 'web' ? 'browser-cookie' : () => (station as TabletStation).bearer(),
      fetch: station.fetch,
      report: (report) => void clientReports.push(report),
    });
    const live = createLiveSim({
      client: typed,
      socket: {
        url: through.wsUrl,
        factory: station.socketFactory,
        ...(station.kind === 'tablet' ? { headers: () => (station as TabletStation).headers() } : {}),
        create(options) {
          socketClient = createLiveSocketClient(options);
          return socketClient;
        },
      },
      onError: (report) => void reports.push(report),
      ...extra,
    });
    stoppers.push(() => live.stop());
    live.onSessionEnd((end) => void ends.push(end));
    live.onControl((message) => void control.push(message));
    live.onResync((event) => void resyncs.push(event));
    live.onLiveChange(() => {
      if (links.at(-1) !== live.link) links.push(live.link);
    });
    const client: LiveClient = {
      name,
      station,
      live,
      reports,
      clientReports,
      ends,
      control,
      resyncs,
      links,
      socketClient() {
        if (socketClient === null) throw new Error(`${name}: the Live source built no socket client`);
        return socketClient;
      },
      replica: () => replicatedOf(live.store.getState() as unknown as Record<string, unknown>),
      position() {
        const status = live.socketStatus();
        return status.epoch === null || status.revision === null ? null : { epoch: status.epoch, revision: status.revision };
      },
    };
    clients.push(client);
    return client;
  }

  const stage: StageCore = {
    app,
    clock,
    log,
    engine,
    channel,
    port,
    ...direct,
    wires,
    clients,
    web(name, options = {}) {
      const station = browserStation(name, wires);
      if (options.cookie !== undefined) station.give(options.cookie);
      return attach(name, station, options.through ?? direct, {});
    },
    tablet(name, device, options = {}) {
      const station = tabletStation(name, device.credential, wires);
      return attach(name, station, options.through ?? direct, {
        secrets: {
          sessionIssued(issued) {
            station.secrets.sessionToken = issued.sessionToken;
          },
          sessionCleared() {
            station.secrets.sessionToken = null;
          },
          deviceUnpaired() {
            station.secrets.deviceCredential = null;
            station.secrets.sessionToken = null;
          },
        },
        device: () => ({ deviceName: device.name, platform: 'android', appVersion: '0.2.0' }),
      });
    },
    bare(owner, headers) {
      const recorded = recorder(owner, wires);
      const socket = recorded.open(direct.wsUrl, headers);
      const bare: BareSocket = { wire: newestWire(owner, recorded.wires), close: () => socket.close(1000, 'the test is over') };
      bares.push(bare);
      return bare;
    },
    async relay() {
      const relay = await openRelay(port);
      relays.push(relay);
      return relay;
    },
    terminateServerSide(remotePorts) {
      const mine = accepted.filter((entry) => entry.remotePort !== undefined && remotePorts.includes(entry.remotePort) && entry.socket.readyState === SOCKET_OPEN);
      for (const entry of mine) entry.socket.terminate();
      return mine.length;
    },
    async drive(ms) {
      for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
        clock.advance(TICK_MS);
        driven += TICK_MS;
        if (driven % REALTIME_DELTA_PACE_MS === 0) channel.pace();
        if (driven % HEARTBEAT_INTERVAL_MS === 0) channel.beat();
        engineTimer.fire();
        await engine.idle();
      }
    },
    until,
    async barrier(what, sockets) {
      channel.beat();
      const seq = channel.stats().beats;
      const open = sockets.filter((socket) => socket.closed === null);
      await until(
        `${what}: heartbeat ${seq} on ${open.map((socket) => socket.owner).join(', ')}`,
        () => open.every((socket) => socket.closed !== null || socket.heartbeatSeq >= seq),
        EVENT_CAP_MS,
        () => open.map((socket) => `${socket.owner} at heartbeat ${socket.heartbeatSeq}`).join(', '),
      );
    },
    close() {
      ended ??= (async (): Promise<EndState> => {
        for (const stop of stoppers.splice(0).reverse()) stop();
        for (const bare of bares) bare.close();
        // The clients closed their sockets; the server answers each close and the hub forgets it.
        await until('the hub to know no socket', () => channel.stats().sockets === 0).catch(() => undefined);
        const hubSockets = channel.stats().sockets;
        for (const relay of relays) await relay.close();
        const closing = app.close();
        // A socket that never answered the close frame is destroyed at the channel's close
        // deadline, which is on the manual timer: fire it when the close did not end by itself.
        const closedInTime = await Promise.race([closing.then(() => true), sleep(CLOSE_GRACE_MS).then(() => false)]);
        if (!closedInTime) channelTimer.fire();
        await closing;
        const accepting: number[] = [];
        for (const candidate of [port, ...relays.map((relay) => relay.port)]) {
          if (!(await refusesConnections(candidate))) accepting.push(candidate);
        }
        // A socket the client closed reports CLOSED once the server answered; the app is closed, so nothing is pending.
        await until('every socket of the stations to be closed', () => wires.every((socket) => socket.readyState() === SOCKET_CLOSED), EVENT_CAP_MS).catch(() => undefined);
        return {
          listening: [...(app.server.listening ? ['the app'] : []), ...relays.flatMap((relay) => (relay.listening() ? [`a relay on ${relay.port}`] : []))],
          accepting,
          openClientSockets: wires.filter((socket) => socket.readyState() !== SOCKET_CLOSED).map((socket) => `${socket.owner} #${socket.number}`),
          openServerSockets: accepted.filter((entry) => entry.socket.readyState !== SOCKET_CLOSED).length,
          hubSockets,
        };
      })();
      return ended;
    },
  };
  return stage;
}

// ── What the frames of a socket must and must not be ───────────────────────────────────────────

const TOPIC_OF: ReadonlyMap<string, string | null> = new Map(REALTIME_SERVER_MESSAGES.map((entry) => [entry.type, entry.topic]));
/** The members of `heartbeat` (contract: `HeartbeatSchema`), which is the one member of the union that is not strict. */
const HEARTBEAT_MEMBERS = ['clients', 'intervalMs', 'seq', 'serverTime', 'sessionState', 'type', 'uptimeMs', 'v'];
/** The slices the channel never publishes (spec §3.2, §9.5), and the streamed one. */
export const NEVER_A_SLICE = ['auth', 'authLockout', 'pairing', 'clock', 'audio'];

const label = (socket: Wire, frame: Frame): string => `${socket.owner} #${socket.number} frame ${frame.index} (${frame.type ?? 'no type'})`;

/**
 * AC-B-46: every frame that arrived on these sockets, of every kind, as a message of the
 * contract's union. Returns one line per frame that is none; an empty list means every frame
 * validates. `origin` narrows it to the frames the server sent (rule 7 hands a client frames of
 * the test's own).
 */
export function frameProblems(sockets: readonly Wire[], origin?: Frame['origin']): string[] {
  return sockets.flatMap((socket) =>
    socket.frames.filter((frame) => origin === undefined || frame.origin === origin).flatMap((frame) => frame.problems.map((problem) => `${label(socket, frame)}: ${problem}`)),
  );
}

/**
 * What a socket must NOT have been sent (spec §9.2, §9.5), read from the frames as they arrived:
 * a first frame that is no `hello`; a message its principal is never sent, or of a topic it was
 * not given; a `snapshot` whose `state` is not exactly the 30 replicated slices; a `delta` op on
 * a slice the channel does not publish; a `heartbeat` with a member the contract does not name,
 * or with a session state for a socket that is no operator's; `meters` nobody subscribed to;
 * anything that looks like a credential. By default only the frames the server sent are looked
 * at; `any` includes the frames the test handed a client itself (rule 7).
 */
export function forbiddenContent(sockets: readonly Wire[], origin: Frame['origin'] | 'any' = 'server'): string[] {
  const found: string[] = [];
  const replicated: readonly string[] = REPLICATED_SLICE_NAMES;
  for (const socket of sockets) {
    const frames = socket.frames.filter((frame) => origin === 'any' || frame.origin === origin);
    if (frames.length === 0) continue;
    const hello = socket.hello;
    if (hello === null) {
      found.push(`${socket.owner} #${socket.number}: the first frame is no valid hello`);
      continue;
    }
    for (const frame of frames) {
      const where = label(socket, frame);
      for (const leak of frame.leaks) found.push(`${where}: holds what looks like a credential (${leak})`);
      const message = frame.message;
      if (message === null) continue;
      if (message.type === 'hello') {
        if (frame.index !== 0) found.push(`${where}: a second hello`);
        continue;
      }
      if (!canReceiveRealtimeMessage(hello.principal, message.type)) found.push(`${where}: never sent to a socket of principal ${hello.principal}`);
      const topic = TOPIC_OF.get(message.type);
      if (typeof topic === 'string' && !(hello.topics as readonly string[]).includes(topic)) found.push(`${where}: the socket was not given the topic ${topic}`);
      const raw = frame.json as Record<string, unknown>;
      if (message.type === 'heartbeat') {
        const members = Object.keys(raw).sort();
        if (canonical(members) !== canonical(HEARTBEAT_MEMBERS)) found.push(`${where}: members ${members.join(', ')}`);
        if (hello.principal !== 'OPERATOR' && message.sessionState !== null) found.push(`${where}: a session state on a socket of principal ${hello.principal}`);
      }
      if (message.type === 'snapshot') {
        const slices = Object.keys(raw['state'] as Record<string, unknown>).sort();
        if (canonical(slices) !== canonical([...replicated].sort())) found.push(`${where}: the state holds ${slices.length} slices, not exactly the 30 replicated ones`);
        for (const never of NEVER_A_SLICE) if (slices.includes(never)) found.push(`${where}: the slice ${never}`);
      }
      if (message.type === 'delta') {
        for (const op of raw['ops'] as Array<{ slice?: unknown }>) {
          if (typeof op.slice !== 'string' || !replicated.includes(op.slice)) found.push(`${where}: an op on the slice ${String(op.slice)}`);
        }
      }
      if (message.type === 'meters' && !socket.sent.includes('subscribe')) found.push(`${where}: a meter frame without a subscribe`);
    }
  }
  return found;
}

/**
 * RT-1, RT-2, AC-B-46 for one socket, on what the SERVER sent (withheld frames included): the
 * first state message is a snapshot; every delta is the previous revision plus 1 in the same
 * epoch; a snapshot never goes back (a later epoch, or the same epoch at the same or a later
 * revision). Returns one line per violation.
 */
export function sequenceProblems(sockets: readonly Wire[]): string[] {
  const found: string[] = [];
  for (const socket of sockets) {
    let position: Position | null = null;
    for (const frame of socket.frames) {
      const message = frame.message;
      if (frame.origin !== 'server' || message === null || (message.type !== 'snapshot' && message.type !== 'delta')) continue;
      const here: Position = { epoch: message.epoch, revision: message.revision };
      const where = `${label(socket, frame)} ${positionText(here)}`;
      if (message.type === 'delta') {
        if (position === null) found.push(`${where}: a delta before any snapshot`);
        else if (here.epoch !== position.epoch || here.revision !== position.revision + 1) found.push(`${where}: does not continue ${positionText(position)}`);
      } else if (position !== null && (here.epoch < position.epoch || (here.epoch === position.epoch && here.revision < position.revision))) {
        found.push(`${where}: a snapshot behind ${positionText(position)}`);
      }
      position = here;
    }
  }
  return found;
}

/** How many frames of each type the sockets received from the server, in the contract's order of types. */
export function kindsOf(sockets: readonly Wire[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of REALTIME_SERVER_MESSAGES) counts[entry.type] = 0;
  for (const socket of sockets) {
    for (const frame of socket.frames) {
      if (frame.origin !== 'server') continue;
      const type = frame.type ?? 'no type';
      counts[type] = (counts[type] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0));
}

/** The state messages the server sent on a socket, in order: `snapshot 2/0`, `delta 2/1`, … */
export function stateMessagesOf(socket: Wire): Array<{ readonly type: 'snapshot' | 'delta'; readonly position: Position; readonly delivered: boolean; readonly frame: Frame }> {
  return socket.frames.flatMap((frame) => {
    const message = frame.message;
    if (frame.origin !== 'server' || message === null || (message.type !== 'snapshot' && message.type !== 'delta')) return [];
    return [{ type: message.type, position: { epoch: message.epoch, revision: message.revision }, delivered: frame.delivered, frame }];
  });
}

// ── The equality of replicas ───────────────────────────────────────────────────────────────────

/**
 * What stands between "every client holds the engine's state at this position" and the truth,
 * one line per departure; an empty list means equal. Looked at per client: the position of its
 * socket client, its Live store slice by slice, and the shadow replica slice by slice.
 */
export function replicaProblems(clients: readonly LiveClient[], engineState: Slices, position: Position): string[] {
  const found: string[] = [];
  const at = positionText(position);
  for (const client of clients) {
    const status = client.live.socketStatus();
    const held = positionText(client.position());
    if (!status.synced || held !== at) found.push(`${client.name}: its socket client is at ${held}${status.synced ? '' : ' and not synced'}, the engine at ${at}`);
    const store = differingSlices(client.replica(), engineState);
    if (store.length > 0) found.push(`${client.name}: slices of its store that differ from app.engine.state() at ${at}: ${store.join(', ')}`);
    const shadow = client.station.shadow.slices();
    const shadowAt = positionText(client.station.shadow.position());
    if (shadow === null || shadowAt !== at || client.station.shadow.behind()) {
      found.push(`${client.name}: the frames it was handed end at ${shadowAt}${client.station.shadow.behind() ? ' (behind: a gap)' : ''}, the engine at ${at}`);
    } else {
      const replayed = differingSlices(shadow, engineState);
      if (replayed.length > 0) found.push(`${client.name}: slices of the replay of its frames that differ from app.engine.state() at ${at}: ${replayed.join(', ')}`);
    }
  }
  return found;
}
