/**
 * Test support of the realtime channel over REAL sockets (plan row W42; not a test file). Other
 * rows import it: a listening server on manual time, and a test socket that sends exactly the
 * headers a test names.
 *
 * NEUTRAL TEST SUPPORT (decisions D113, D116; review finding CPB1-12). This file lives in
 * `apps/core-server/test/support/` because tests of several rows use it; it moved here from
 * `src/realtime/__tests__/support.ts`, which re-exports it. No production source imports anything
 * under `test/` (static test `test/static/imports.test.ts`).
 *
 * Database tests (`*.db.test.ts`, project `db`): the real app factory on the file's own clone of
 * the seed template, connected as `dems_app`, with every stage as the server has it, a BOOTED
 * engine on a manual timer, the channel on a manual step timer, and a real listener on
 * `127.0.0.1` at an EPHEMERAL port (port 0; never a port of the plan's table, P4).
 *
 * TIME. The server clock is a manual clock and the channel's three timers are a step timer
 * bound to it: `advance(ms)` moves the clock and calls what is due, in order. Nothing here
 * sleeps. A test waits for an EVENT of a socket (a message, the close); a guard time-out turns a
 * message that never comes into a failure with the list of what did come.
 *
 * SECRETS (P19). A session token, a cookie value and a device credential are taken from an
 * answer and handed on as a header; none is written to a log, a test name or the message of an
 * assertion. A failure message names message TYPES and close codes only.
 */
import type { AddressInfo } from 'node:net';
import { WsServerMessageSchema, type WsServerMessage } from '@dems/shared/api';
import { OPERATORS } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, expect } from 'vitest';
import WebSocket from 'ws';
import { engineControl, type EngineControl, type EngineHost, type EngineTimer } from '../../src/engine';
import { identityControl } from '../../src/modules/identity';
import { pairingControl } from '../../src/modules/pairing';
import { throttleControl } from '../../src/plugins/throttle';
import { realtimeControl, type RealtimeControl } from '../../src/realtime';
import { manualTimer, type ManualTimer } from './engine';
import {
  OWN_ORIGIN,
  WEB_ORIGIN,
  bearer,
  deviceSignIn,
  identityApp,
  signInOnWeb,
  type Headers,
  type IdentityApp,
  type IdentityAppOptions,
  type IdentityTarget,
  type ManualClock,
} from './identity';
import { pairDevice, type PairedTestDevice, type PairingApp } from './pairing';

export { OWN_ORIGIN, WEB_ORIGIN, bearer, type Headers };

export const INVESTIGATOR = OPERATORS[0]!;
/** The seeded operator who holds `USER_ADMIN` and `PAIRING_MANAGE`. */
export const SUPERVISOR = OPERATORS[1]!;
export const TECHNICIAN = OPERATORS[2]!;

/** How long a test waits for a socket event before it fails. A guard, never a pause. */
export const EVENT_GUARD_MS = 5_000;
export const ENGINE_TICK_MS = 50;

// ── The step timer ─────────────────────────────────────────────────────────────────────────────

export interface StepTimer {
  /** Pass as `realtimeControl(app).useTimer(steps.timer)`. */
  readonly timer: EngineTimer;
  /** Moves the clock forward by `ms` and calls every repeating callback that falls due, in time order. */
  advance(ms: number): void;
  /** How many repeating callbacks are registered now. */
  active(): number;
}

/** A timer whose intervals pass on the manual clock: the heartbeat every 1,000 ms of it, the pace step every 250. */
export function stepTimer(clock: ManualClock): StepTimer {
  interface Entry {
    readonly intervalMs: number;
    readonly callback: () => void;
    nextAt: number;
  }
  const entries = new Set<Entry>();
  return {
    timer: {
      every(intervalMs, callback) {
        const entry: Entry = { intervalMs, callback, nextAt: clock.now() + intervalMs };
        entries.add(entry);
        return () => {
          entries.delete(entry);
        };
      },
    },
    advance(ms) {
      const start = clock.now();
      const end = start + ms;
      // A test that moved the clock by hand did not want the steps in between: an interval that
      // is overdue starts again from now, as a timer does after a pause; it does not fire in a burst.
      for (const entry of entries) {
        if (entry.nextAt <= start) entry.nextAt = start + entry.intervalMs;
      }
      for (;;) {
        let due: Entry | undefined;
        for (const entry of entries) {
          if (entry.nextAt <= end && (due === undefined || entry.nextAt < due.nextAt)) due = entry;
        }
        if (due === undefined) break;
        clock.set(due.nextAt);
        due.nextAt += due.intervalMs;
        due.callback();
      }
      clock.set(end);
    },
    active: () => entries.size,
  };
}

// ── The app ────────────────────────────────────────────────────────────────────────────────────

export interface RealtimeApp extends IdentityApp {
  /** The channel's controls. (`control` is the identity module's.) */
  readonly channel: RealtimeControl;
  readonly engine: EngineHost & EngineControl;
  /** The timer of the channel's heartbeat, pace step and ping. */
  readonly steps: StepTimer;
  /** The timer of the engine's scheduler: `fire()` is one tick. */
  readonly engineTimer: ManualTimer;
  /** The ephemeral loopback port the server listens on. */
  readonly port: number;
  /** `ws://127.0.0.1:<port>/ws`. */
  readonly wsUrl: string;
  /** `http://127.0.0.1:<port>`. */
  readonly httpUrl: string;
  /** For `pairDevice` of the pairing module's support: the same app, with nothing replaced. */
  readonly pairing: PairingApp;
  /**
   * The engine and the channel at real cadence, without real time: the clock moves `stepMs` at a
   * time, what is due of the channel's timers is called, the engine ticks and its unit ends.
   */
  drive(ms: number, stepMs?: number): Promise<void>;
  /** Starts every throttle window, denial budget and console lockout afresh. */
  forgetCounters(): void;
}

/**
 * The real app on a clone: booted, listening on an ephemeral loopback port, on manual time. It
 * is closed before the clone is dropped (the identity support registers that).
 */
export async function realtimeApp(target: IdentityTarget, options: IdentityAppOptions = {}): Promise<RealtimeApp> {
  const identity = await identityApp(target, options);
  const { app, clock } = identity;
  const engine = engineControl(app);
  const engineTimer = manualTimer();
  engine.useTimer(engineTimer.timer);
  await app.readiness.boot();
  await engine.idle();
  await app.pipeline.drain();

  const channel = realtimeControl(app);
  const steps = stepTimer(clock);
  channel.useTimer(steps.timer);

  await app.listen({ host: '127.0.0.1', port: 0 });
  // The two expiry sweepers start with the listener, on the system timer. A test calls the sweep
  // itself, at the instant it chose on the manual clock.
  identityControl(app).sweeper.stop();
  pairingControl(app).sweeper.stop();

  const { port } = app.server.address() as AddressInfo;
  const pairing: PairingApp = { ...identity, pairing: pairingControl(app), published: [] };
  return {
    ...identity,
    channel,
    engine,
    steps,
    engineTimer,
    port,
    wsUrl: `ws://127.0.0.1:${port}/ws`,
    httpUrl: `http://127.0.0.1:${port}`,
    pairing,
    async drive(ms, stepMs = ENGINE_TICK_MS) {
      for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
        steps.advance(stepMs);
        engineTimer.fire();
        await engine.idle();
      }
    },
    forgetCounters() {
      identity.control.lockout.reset();
      throttleControl(app).reset();
    },
  };
}

// ── A socket of a test ─────────────────────────────────────────────────────────────────────────

export interface Refusal {
  /** The HTTP status of the handshake. */
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  /** `error.code` of the envelope; null when the body is no envelope. */
  readonly code: string | null;
  readonly details: Record<string, unknown> | null;
}

export interface Closed {
  readonly code: number;
  readonly reason: string;
}

export interface TestSocket {
  readonly ws: WebSocket;
  /** Every message received, in order, each parsed with the contract's union (AC-B-46). */
  readonly messages: WsServerMessage[];
  /** Frames that were no message of the contract's union: the reason, never the frame. */
  readonly invalid: string[];
  /** Resolves when the handshake completed (101); rejects when it was refused. */
  readonly opened: Promise<void>;
  /** Resolves with the HTTP answer of a refused handshake; rejects when it completed. */
  readonly refused: Promise<Refusal>;
  /**
   * Resolves when the socket closed, with the code the server sent; rejects when it has not
   * closed `EVENT_GUARD_MS` after THIS PROPERTY WAS READ. The guard starts at the read, not when
   * the socket was created: read it where it is awaited (`await socket.closed`), however long
   * the socket has lived by then.
   */
  readonly closed: Promise<Closed>;
  /** The same with a bound the caller names, counted from the call. */
  closedWithin(boundMs: number): Promise<Closed>;
  /** Resolves at the close, whenever it comes, and never rejects: for a socket a test holds open. */
  readonly whenClosed: Promise<Closed>;
  /** The headers of the 101 answer (set once the socket is open). */
  upgradeHeaders: Record<string, string | string[] | undefined>;
  types(): string[];
  /** The first message that matches, among those received and those to come. */
  next<Message extends WsServerMessage = WsServerMessage>(what: string, matches: (message: WsServerMessage) => boolean): Promise<Message>;
  /** The first message of that type after position `from` of `messages`. */
  nextOf<Type extends WsServerMessage['type']>(type: Type, from?: number): Promise<Extract<WsServerMessage, { type: Type }>>;
  send(message: unknown): void;
  sendRaw(data: string | Buffer, binary?: boolean): void;
  /** Destroys the socket without a close frame. */
  terminate(): void;
}

interface Waiter {
  readonly matches: (message: WsServerMessage, index: number) => boolean;
  readonly resolve: (message: WsServerMessage) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

const opened = new Set<TestSocket>();

/**
 * `promise`, or a rejection when it has not settled `boundMs` after this call. The guard is a
 * bound, never a pause: its timer is cleared the moment `promise` settles. A caller that does
 * not look at the result gets no unhandled rejection from it.
 */
function guarded<T>(what: string, promise: Promise<T>, describe: () => string, boundMs: number = EVENT_GUARD_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not happen within ${boundMs} ms; ${describe()}`)), boundMs);
  });
  const raced = Promise.race([promise, guard]).finally(() => clearTimeout(timer));
  raced.catch(() => {});
  return raced;
}

export interface SocketOptions {
  /** Offer `permessage-deflate`, as a browser and React Native do. Default true. */
  readonly offerCompression?: boolean;
  readonly protocols?: string[];
}

/**
 * Opens a socket with exactly these request headers. Nothing is added: no `Origin` unless one
 * is given (a browser and React Native add theirs; a test says which).
 */
export function openSocket(url: string, headers: Headers = {}, options: SocketOptions = {}): TestSocket {
  const ws = new WebSocket(url, options.protocols ?? [], { headers, perMessageDeflate: options.offerCompression ?? true });
  const messages: WsServerMessage[] = [];
  const invalid: string[] = [];
  const waiters = new Set<Waiter>();
  const describe = (): string => `received so far: [${messages.map((message) => message.type).join(', ')}], socket state ${ws.readyState}`;

  /** The first message at position `from` or later that matches: one already received, or the next that comes. */
  function wait(what: string, from: number, matches: (message: WsServerMessage) => boolean): Promise<WsServerMessage> {
    const found = messages.slice(from).find(matches);
    if (found !== undefined) return Promise.resolve(found);
    return new Promise<WsServerMessage>((resolve, reject) => {
      const waiter: Waiter = {
        matches: (message, index) => index >= from && matches(message),
        resolve,
        timer: setTimeout(() => {
          waiters.delete(waiter);
          reject(new Error(`${what} did not arrive within ${EVENT_GUARD_MS} ms; ${describe()}`));
        }, EVENT_GUARD_MS),
      };
      waiters.add(waiter);
    });
  }

  let resolveOpened!: () => void;
  let rejectOpened!: (error: Error) => void;
  let resolveRefused!: (refusal: Refusal) => void;
  let rejectRefused!: (error: Error) => void;
  let resolveClosed!: (closed: Closed) => void;
  const openedPromise = new Promise<void>((resolve, reject) => {
    resolveOpened = resolve;
    rejectOpened = reject;
  });
  const refusedPromise = new Promise<Refusal>((resolve, reject) => {
    resolveRefused = resolve;
    rejectRefused = reject;
  });
  const closedPromise = new Promise<Closed>((resolve) => {
    resolveClosed = resolve;
  });
  // A test reads the one it expects; the other must not count as an unhandled rejection.
  openedPromise.catch(() => {});
  refusedPromise.catch(() => {});

  const socket: TestSocket = {
    ws,
    messages,
    invalid,
    // The handshake is expected right after the socket was created: its guard starts here.
    opened: guarded('the handshake', openedPromise, describe),
    refused: guarded('the refusal of the handshake', refusedPromise, describe),
    // The close is expected when a test asks for it: its guard starts at the read (see `TestSocket`).
    get closed() {
      return guarded('the close', closedPromise, describe);
    },
    closedWithin: (boundMs) => guarded('the close', closedPromise, describe, boundMs),
    whenClosed: closedPromise,
    upgradeHeaders: {},
    types: () => messages.map((message) => message.type),
    next<Message extends WsServerMessage>(what: string, matches: (message: WsServerMessage) => boolean): Promise<Message> {
      return wait(what, 0, matches) as Promise<Message>;
    },
    nextOf(type, from = 0) {
      return wait(`a ${type} message at position ${from} or later`, from, (message) => message.type === type) as Promise<Extract<WsServerMessage, { type: typeof type }>>;
    },
    send: (message) => ws.send(JSON.stringify(message)),
    sendRaw: (data, binary = false) => ws.send(data, { binary }),
    terminate: () => ws.terminate(),
  };
  opened.add(socket);

  ws.on('upgrade', (response) => {
    socket.upgradeHeaders = response.headers;
  });
  ws.on('open', () => {
    resolveOpened();
    rejectRefused(new Error('the handshake completed'));
  });
  ws.on('unexpected-response', (_request, response) => {
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));
    response.on('end', () => {
      let code: string | null = null;
      let details: Record<string, unknown> | null = null;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { error?: { code?: string; details?: Record<string, unknown> } };
        code = body.error?.code ?? null;
        details = body.error?.details ?? null;
      } catch {
        // Not an envelope: the status says what there is to say.
      }
      const refusal: Refusal = { status: response.statusCode ?? 0, headers: response.headers, code, details };
      resolveRefused(refusal);
      rejectOpened(new Error(`the handshake was refused with HTTP ${refusal.status}`));
      ws.terminate();
    });
  });
  ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
    if (isBinary) {
      invalid.push('a binary frame');
      return;
    }
    let message: WsServerMessage;
    try {
      message = WsServerMessageSchema.parse(JSON.parse(data.toString()));
    } catch (error) {
      invalid.push(error instanceof Error ? error.name : 'not a message');
      return;
    }
    messages.push(message);
    for (const waiter of waiters) {
      if (!waiter.matches(message, messages.length - 1)) continue;
      waiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    }
  });
  ws.on('close', (code: number, reason: Buffer) => {
    resolveClosed({ code, reason: reason.toString('utf8') });
    rejectOpened(new Error(`the socket closed with ${code} before it opened`));
  });
  ws.on('error', () => {
    // The outcome is told by `open`, `unexpected-response` or `close`.
  });
  return socket;
}

/** Destroys every socket the tests of this file opened and that is still open. */
export function closeAllSockets(): void {
  for (const socket of opened) {
    if (socket.ws.readyState !== WebSocket.CLOSED) socket.terminate();
  }
  opened.clear();
}

/**
 * Register once per test file: after each test every frame every socket received must have been
 * a message of the contract's union (AC-B-46), the sockets are destroyed, and the server knows
 * none any more before the next test starts.
 */
export function useSockets(realtime: () => RealtimeApp | undefined): void {
  afterEach(async () => {
    const problems = [...opened].flatMap((socket) => socket.invalid);
    closeAllSockets();
    const rt = realtime();
    if (rt !== undefined) await untilSockets(rt, 0);
    expect(problems).toEqual([]);
  });
}

/** Resolves when the hub knows exactly `count` sockets (those it is closing included). */
export function untilSockets(rt: RealtimeApp, count: number): Promise<void> {
  return until(rt, `the hub to know ${count} socket(s)`, () => rt.channel.stats().sockets === count);
}

/** Resolves when the condition holds, checked after every change of the hub's sockets. */
export function until(rt: RealtimeApp, what: string, holds: () => boolean): Promise<void> {
  if (holds()) return Promise.resolve();
  const waiting = new Promise<void>((resolve) => {
    const stop = rt.channel.onChange(() => {
      if (!holds()) return;
      stop();
      resolve();
    });
  });
  return guarded(what, waiting, () => `sockets ${rt.channel.stats().sockets}, connections ${rt.channel.stats().connections}`);
}

/**
 * Resolves when the condition holds, looked at once per turn of the event loop. For what follows
 * a message a CLIENT sent (the server reads it in a later turn): a guard bounds it, nothing sleeps.
 */
export async function eventually(what: string, holds: () => boolean): Promise<void> {
  const deadline = Date.now() + EVENT_GUARD_MS;
  while (!holds()) {
    if (Date.now() > deadline) throw new Error(`${what} did not happen within ${EVENT_GUARD_MS} ms`);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

/** Sends `subscribe` or `unsubscribe` for the meters and resolves when the server has read it. */
export async function setMeters(rt: RealtimeApp, socket: TestSocket, wanted: boolean): Promise<void> {
  const before = rt.channel.connections().filter((connection) => connection.meters).length;
  socket.send({ type: wanted ? 'subscribe' : 'unsubscribe', topic: 'meters' });
  await eventually(`the server reading the ${wanted ? 'subscribe' : 'unsubscribe'}`, () => rt.channel.connections().filter((connection) => connection.meters).length === before + (wanted ? 1 : -1));
}

/**
 * One heartbeat, awaited on each socket: everything the server sent to a socket before it has
 * arrived when this resolves (frames keep their order), so a test can say "and nothing else".
 */
export async function settle(rt: RealtimeApp, ...sockets: TestSocket[]): Promise<void> {
  rt.channel.beat();
  const seq = rt.channel.stats().beats;
  await Promise.all(sockets.map((socket) => socket.next(`heartbeat ${seq}`, (message) => message.type === 'heartbeat' && message.seq === seq)));
}

// ── Who connects ───────────────────────────────────────────────────────────────────────────────

/** What a browser of the web console sends on its upgrade: the origin and the cookie. */
export const webHeaders = (cookie: Headers): Headers => ({ origin: WEB_ORIGIN, ...cookie });

/**
 * What the mobile app sends on its upgrade (measured, decision D69): the own origin and the
 * bearer value, with the device-side `Host` and the HTTP library's agent.
 */
export const deviceHeaders = (value: string): Headers => ({ origin: OWN_ORIGIN, 'user-agent': 'okhttp/4.12.0', ...bearer(value) });

export interface WebOperator {
  readonly cookie: Headers;
  readonly operatorId: string;
}

/** A seeded operator signed in on the web console. */
export async function webOperator(rt: RealtimeApp, operator: { username: string; id: string }): Promise<WebOperator> {
  const session = await signInOnWeb(rt, operator.username);
  return { cookie: session.cookie, operatorId: operator.id };
}

export interface DeviceOperator {
  readonly device: PairedTestDevice;
  /** The session token of the operator on that device. Held by the test only. */
  readonly token: string;
  readonly operatorId: string;
}

/** A real paired device (a code issued by the supervisor and redeemed). */
export async function pairedDevice(rt: RealtimeApp, supervisor: WebOperator, name?: string): Promise<PairedTestDevice> {
  return pairDevice(rt.pairing, supervisor.cookie, name);
}

/** A seeded operator signed in on a paired device. */
export async function deviceOperator(rt: RealtimeApp, device: PairedTestDevice, operator: { username: string; id: string }): Promise<DeviceOperator> {
  const response = await deviceSignIn(rt.app, device.credential, operator.username);
  if (response.statusCode !== 200) throw new Error(`the device sign-in answered ${response.statusCode}`);
  const token = (response.json() as { sessionToken?: string }).sessionToken;
  if (token === undefined) throw new Error('the device sign-in returned no session token');
  return { device, token, operatorId: operator.id };
}

/** An open OPERATOR socket of the web console, past its snapshot. */
export async function operatorSocket(rt: RealtimeApp, headers: Headers): Promise<TestSocket> {
  const socket = openSocket(rt.wsUrl, headers);
  await socket.opened;
  await socket.nextOf('snapshot');
  await socket.nextOf('heartbeat');
  return socket;
}

/** A POST of the web console through the real stages: the cookie and the web console origin. */
export function webPost(app: FastifyInstance, url: string, cookie: Headers, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...cookie }, ...(payload === undefined ? {} : { payload }) });
}
