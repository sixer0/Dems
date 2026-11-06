/**
 * Realtime channel (plan row W42; hand-built element HB-8; spec §9, §4.7, §14.2; SR-38 to SR-42,
 * SR-51, SR-69, SR-70, SR-74, SR-75).
 *
 * This unit fills the seam `publish` of the scaffold (P25) and registers the one socket route:
 *
 *   `app.publish`        what a unit of work says after its commit; the hub decides which
 *                        sockets get which message and which are closed (`hub.ts`).
 *   `GET /ws`            through `@fastify/websocket` 11 and `ws` 8. It is the one route outside
 *                        the registry that the permission guard accepts (decision D83 DN-3).
 *
 * AUTHENTICATION IS NOT DECIDED HERE. Node hands an upgrade to `@fastify/websocket`, which
 * dispatches it through the router, so the upgrade request passes stages 2 to 6 like any
 * request: a foreign `Origin`, a cookie without a web console origin, two credentials and a
 * throttled caller are answered with the HTTP status of the handshake (403, 401, 429) and never
 * reach this file. The route reads `request.principal` and `authenticationOf(request)`, the
 * single resolver, and applies the socket decision table (`admission.ts`). Nothing here reads a
 * header, a cookie, the URL, its query string or a subprotocol: a `?token=` authenticates
 * nothing (SR-38) and is never logged (SR-49).
 *
 * SOCKET SERVER OPTIONS (spec §9.1).
 *   maxPayload           `REALTIME_CLIENT_MESSAGE_MAX_BYTES` (RT-P4). The library refuses a
 *                        larger frame before it is buffered and closes with 1009.
 *   perMessageDeflate    false (RT-P7): an offered `permessage-deflate` is not negotiated.
 *   handleProtocols      none is ever selected: whatever a client offers as a subprotocol is
 *                        neither used nor echoed.
 *
 * AN UPGRADE ANYWHERE ELSE answers 404 `NOT_FOUND` at the handshake. Without this the socket
 * library would accept the upgrade on any route and log the path it was asked for, query
 * string included. A plain GET of `/ws` answers the same 404: there is no REST endpoint there.
 *
 * A HANDSHAKE THAT DOES NOT BECOME A SOCKET LEAVES NONE. Node hands the socket of an upgrade
 * request over and manages it no longer: no parser, no keep-alive time-out, no `error` listener.
 * The socket plugin destroys it after an HTTP answer only when its own `onRequest` hook saw the
 * request, and that hook is registered after the stages: a refusal by stage 2 to 6 (503, 403,
 * 401, 429) never reaches it; an upgrade on a path the router cannot decode reaches no hook at
 * all. So this unit keeps the socket of every upgrade from the `upgrade` event on
 * (`handshake.ts`): it is released when the route takes it as a WebSocket, destroyed when the
 * request was answered over HTTP or the peer ended or reset first, and destroyed at the pace step
 * after `REALTIME_HANDSHAKE_TIMEOUT_MS` when none of that happened. At most
 * `REALTIME_MAX_PENDING_HANDSHAKES` sockets wait at one time; one more destroys the oldest.
 *
 * TIMERS. Three, from the injected timer, running only while the server listens: the heartbeat
 * (1 s), the pace step (250 ms) and the protocol ping (30 s). They say WHEN the hub acts; every
 * instant in a message or a deadline is `app.clock`'s. A test passes a manual timer with
 * `realtimeControl(app).useTimer(...)` before the listener opens, or calls the steps by hand.
 *
 * STOP (spec §8.6). The engine's `preClose` hook runs before this unit's, so its last change is
 * published while the sockets are open. Then: the timers stop, every socket is closed with
 * 1001, and what has not answered the close frame after `REALTIME_CLOSE_GRACE_MS` is destroyed.
 * The tablet link is not touched: the engine has stopped, and the next start sets it OFFLINE
 * and writes the truthful row.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `realtimePlugin`, `Publish` and
 * `Publication` keep their names and shapes.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { HEARTBEAT_INTERVAL_MS, REALTIME_CLIENT_MESSAGE_MAX_BYTES, WS_PATH } from '@dems/shared/api';
import fastifyWebsocket from '@fastify/websocket';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import { followClock } from '../core';
import { createSystemTimer, type EngineTimer } from '../engine';
import type { DevicePresence } from '../modules/pairing';
import { authenticationOf } from '../plugins/authenticate';
import { notFound } from '../plugins/error-envelope';
import { admissionOf } from './admission';
import { createHandshakeGuard, type HandshakeStats } from './handshake';
import { createRealtimeHub } from './hub';
import type { ConnectionHandle, ConnectionSummary, HubStats, RealtimeHub, RealtimeTransport } from './hub-types';
import {
  REALTIME_CLOSE_GRACE_MS,
  REALTIME_DELTA_PACE_MS,
  REALTIME_HANDSHAKE_TIMEOUT_MS,
  REALTIME_MAX_PENDING_HANDSHAKES,
  REALTIME_PING_INTERVAL_MS,
  type RealtimeLimits,
} from './limits';
import type { Publication, Publish } from './publication';

export {
  admissionOf,
  beyondCap,
  deviceRetired,
  displacedBy,
  isRefused,
  principalCapOf,
  principalKeyOf,
  sessionInvalid,
  topicsOf,
  type Admission,
  type AnonymousAdmission,
  type ConnectionCaps,
  type DeviceAdmission,
  type OpenCounts,
  type OperatorAdmission,
  type PrincipalCaps,
  type PrincipalKey,
  type RefusedAdmission,
} from './admission';
export { createHandshakeGuard, type HandshakeGuard, type HandshakeLimits, type HandshakeStats } from './handshake';
export { createRealtimeHub } from './hub';
export {
  ClientMessageRefusal,
  type ConnectionCounters,
  type ConnectionHandle,
  type ConnectionSummary,
  type HubDependencies,
  type HubEngine,
  type HubStats,
  type RealtimeHub,
  type RealtimeTransport,
} from './hub-types';
export {
  CLOSE_REASON,
  DEVICES_CHANGED_DEBOUNCE_MS,
  DEVICES_CHANGED_MAX_WAIT_MS,
  REALTIME_CLOSE_GRACE_MS,
  REALTIME_CONTROL_DEADLINE_MS,
  REALTIME_DELTA_PACE_MS,
  REALTIME_ENDED_MEMORY_MS,
  REALTIME_HANDSHAKE_TIMEOUT_MS,
  REALTIME_HARD_BUFFER_BYTES,
  REALTIME_LIMITS,
  REALTIME_MAX_ANONYMOUS,
  REALTIME_MAX_CONNECTIONS,
  REALTIME_MAX_PENDING_HANDSHAKES,
  REALTIME_MAX_PER_DEVICE,
  REALTIME_MAX_PER_SESSION,
  REALTIME_METER_SKIP_BYTES,
  REALTIME_METER_WIRE_RATE_HZ,
  REALTIME_PING_INTERVAL_MS,
  TABLET_LINK_DEBOUNCE_MS,
  TABLET_LINK_RETRY_MS,
  type RealtimeLimits,
} from './limits';
export type { Publication, Publish, SessionEndedReason } from './publication';
export { createTabletLink, type TabletLink, type TabletLinkDependencies, type TabletLinkEngine } from './tablet-link';

// ── The controls behind the seam (tests, measurements) ─────────────────────────────────────────

/** What this unit provides behind the seam `publish` besides the function itself. */
export interface RealtimeControl {
  /** Replaces the timer of the three steps. Call it before the server listens. */
  useTimer(timer: EngineTimer): void;
  /** One heartbeat, one pace step, one protocol ping: what the timers call. */
  beat(): void;
  pace(): void;
  ping(): void;
  /** The sockets the hub knows, without any secret: IDs, principal, position, buffer. */
  connections(): ConnectionSummary[];
  stats(): HubStats;
  /** The sockets of upgrade requests that the route has not taken yet, and what became of the others. */
  handshakes(): HandshakeStats;
  /** Called after a socket was admitted, closed or forgotten. Returns the way to stop listening. */
  onChange(listener: () => void): () => void;
  /** Resolves when no `setTabletLink` call of the channel is in flight. */
  settled(): Promise<void>;
  /** True while the three timers run (between listen and close). */
  readonly running: boolean;
  readonly limits: RealtimeLimits;
}

const CONTROL = Symbol('realtime.control');
type ControlledPublish = Publish & { readonly [CONTROL]: RealtimeControl };

function isControlled(publish: Publish): publish is ControlledPublish {
  return CONTROL in publish;
}

/** The channel's controls of an app. Throws when a test put another function behind the seam. */
export function realtimeControl(app: FastifyInstance): RealtimeControl {
  const publish = app.publish;
  if (!isControlled(publish)) throw new Error('app.publish is not the channel of src/realtime: the seam was replaced');
  return publish[CONTROL];
}

// ── The socket library behind the hub's transport ──────────────────────────────────────────────

function transportOf(socket: WebSocket): RealtimeTransport {
  return {
    // Text frames only, never compressed (RT-P7).
    send: (text) => socket.send(text, { binary: false, compress: false }),
    get bufferedAmount() {
      return socket.bufferedAmount;
    },
    close: (code, reason) => socket.close(code, reason),
    terminate: () => socket.terminate(),
    ping: () => socket.ping(),
  };
}

function bufferOf(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  return Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
}

/**
 * The presence counter of the pairing module, through its seam (P25). Null when a test put
 * another resolver behind the seam: then nobody keeps a device list to feed.
 */
function presenceOf(app: FastifyInstance): DevicePresence | null {
  const resolver: object = app.deviceResolver;
  return 'presence' in resolver ? (resolver.presence as DevicePresence) : null;
}

const SOCKET_ERROR = 'a socket of the realtime channel reported an error';

export const realtimePlugin: FastifyPluginAsync = async (app) => {
  const hub: RealtimeHub = createRealtimeHub({
    // Read through the seams at each use: what a test puts in place after `ready()` is what runs.
    clock: followClock(() => app.clock),
    engine: () => app.engine,
    presence: () => presenceOf(app),
    log: app.log,
    errorLog: app.errorLog,
    newId: () => randomUUID(),
  });

  const handshakes = createHandshakeGuard(followClock(() => app.clock), {
    handshakeTimeoutMs: REALTIME_HANDSHAKE_TIMEOUT_MS,
    maxPendingHandshakes: REALTIME_MAX_PENDING_HANDSHAKES,
  });

  /** The pace step: the hub's, then the sockets of handshakes that nobody took in time. */
  function pace(): void {
    hub.pace();
    const destroyed = handshakes.sweep();
    if (destroyed > 0) {
      app.log.info({ destroyed, boundMs: REALTIME_HANDSHAKE_TIMEOUT_MS }, 'upgrade sockets destroyed: not taken by the socket route within the bound');
    }
  }

  let timer: EngineTimer = createSystemTimer();
  let cancelTimers: Array<() => void> = [];

  function startTimers(): void {
    if (cancelTimers.length > 0) return;
    cancelTimers = [
      timer.every(HEARTBEAT_INTERVAL_MS, () => hub.beat()),
      timer.every(REALTIME_DELTA_PACE_MS, pace),
      timer.every(REALTIME_PING_INTERVAL_MS, () => hub.ping()),
    ];
  }

  function stopTimers(): void {
    for (const cancel of cancelTimers) cancel();
    cancelTimers = [];
  }

  /** Resolves when the hub knows no socket any more; what is left at the deadline is destroyed. */
  function drained(): Promise<void> {
    if (hub.stats().sockets === 0) return Promise.resolve();
    return new Promise((resolve) => {
      let cancelDeadline = (): void => {};
      const stopListening = hub.onChange(() => {
        if (hub.stats().sockets > 0) return;
        stopListening();
        cancelDeadline();
        resolve();
      });
      cancelDeadline = timer.every(REALTIME_CLOSE_GRACE_MS, () => {
        stopListening();
        cancelDeadline();
        hub.terminateAll();
        resolve();
      });
    });
  }

  const control: RealtimeControl = {
    useTimer(next) {
      if (cancelTimers.length > 0) throw new Error('the realtime channel is running: replace its timer before the server listens');
      timer = next;
    },
    beat: () => hub.beat(),
    pace,
    ping: () => hub.ping(),
    connections: () => hub.connections(),
    stats: () => hub.stats(),
    handshakes: () => handshakes.stats(),
    onChange: (listener) => hub.onChange(listener),
    settled: () => hub.tabletLink.settled(),
    get running() {
      return cancelTimers.length > 0;
    },
    limits: hub.limits,
  };

  const publish: ControlledPublish = Object.assign((publication: Publication): void => hub.publish(publication), { [CONTROL]: control });
  app.seams.provide('publish', publish);

  /** The handle of each socket the route admitted: the error handler finds it here. */
  const handles = new WeakMap<WebSocket, ConnectionHandle>();

  await app.register(fastifyWebsocket, {
    options: {
      maxPayload: REALTIME_CLIENT_MESSAGE_MAX_BYTES,
      perMessageDeflate: false,
      handleProtocols: () => false,
    },
    // A socket error (a frame the library refuses, a reset connection) or a failure of the route.
    // The library closes a socket whose frame it refused by itself; the hub destroys what is
    // still there at the close deadline.
    errorHandler(error, socket, request) {
      request.log.warn({ err: error }, SOCKET_ERROR);
      const handle = handles.get(socket);
      if (handle === undefined) socket.terminate();
      else handle.failed();
    },
    // Spec §8.6 "Stop". Registered after the engine's `preClose` hook, so it runs after it.
    preClose: async () => {
      stopTimers();
      handshakes.clear();
      hub.shutdown();
      await drained();
    },
  });

  // The socket of every upgrade request, until the route takes it as a WebSocket (see the header).
  const onUpgrade = (rawRequest: IncomingMessage, socket: Duplex): void => handshakes.begin(rawRequest, socket);
  // First among the listeners: the socket is known before the socket plugin dispatches the request.
  app.server.prependListener('upgrade', onUpgrade);
  // The request was answered over HTTP: a refusal of a stage, the 404 below, a failure.
  app.addHook('onResponse', async (request) => {
    handshakes.answered(request.raw);
  });

  // An upgrade is offered on `/ws` only. On any other route it is refused before the handler,
  // which would otherwise complete the handshake and log the raw path.
  app.addHook('onRequest', async (request) => {
    if (!request.ws || request.is404) return;
    if (request.routeOptions.url === WS_PATH) return;
    throw notFound();
  });

  function onSocket(socket: WebSocket, request: FastifyRequest): void {
    // From here on the socket is the socket library's, with its own listeners.
    handshakes.taken(request.raw);
    const handle = hub.admit(admissionOf(request.principal, authenticationOf(request)), transportOf(socket));
    handles.set(socket, handle);
    socket.on('message', (data: RawData, isBinary: boolean) => handle.receive(bufferOf(data), isBinary));
    socket.on('pong', () => handle.pong());
    socket.on('close', (code: number) => handle.closed(code));
  }

  app.route({
    method: 'GET',
    url: WS_PATH,
    // A GET without an upgrade: no REST endpoint is here.
    handler: async () => {
      throw notFound();
    },
    wsHandler: onSocket,
  });

  app.addHook('onListen', async () => {
    startTimers();
  });
  // After `preClose` in every close; alone when a close never reached it.
  app.addHook('onClose', async () => {
    stopTimers();
    hub.terminateAll();
    handshakes.clear();
    app.server.removeListener('upgrade', onUpgrade);
  });
};
