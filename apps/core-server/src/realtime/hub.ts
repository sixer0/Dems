/**
 * The hub of the realtime channel (plan row W42; hand-built element HB-8; spec §9, §4.7). It
 * knows every open socket and decides what each is sent and when it is closed. It holds no
 * Fastify instance and no socket library: a socket is a `RealtimeTransport`, so everything here
 * runs in a test without a listener.
 *
 * ONE SOCKET'S LIFETIME
 *
 *   admit      `hello` first, always. Then, for an OPERATOR, one `snapshot` (RT-1), and for
 *              everybody a connect-time `heartbeat`. A bearer value that did not resolve gets
 *              `hello` with its reason and is closed with 4401 or 4403. A socket beyond a cap
 *              shared by everybody (16 in all, 6 without a principal) is closed with 1013 and
 *              gets nothing. At the cap of ONE principal (4 sockets of an operator session, 2
 *              of a device credential) the newest is admitted and that principal's oldest is
 *              closed with 1013 (`admission.ts`, review finding CPS1-5).
 *   state      every committed change of the engine as a `delta`, in commit order, to every
 *              OPERATOR socket; `revision` is the socket's last one plus 1, always (RT-2).
 *   resync     a new `snapshot` (RT-6). A new epoch: a `snapshot` to every OPERATOR socket (RT-7).
 *   meters     to OPERATOR sockets that subscribed (RT-8).
 *   control    `session.updated`, `session.ended` then close 4401, `device.revoked` then close
 *              4403, `admin.changed` to the holders of the permission.
 *   heartbeat  every second, to every socket.
 *
 * ORDER. `publish` is called after each commit, in commit order, and sends in the same turn, so
 * every socket sees state messages in commit order. A socket's position (epoch and revision of
 * the last state message it was sent) is checked before every delta: a delta at or below it is
 * inside the socket's snapshot and is not sent; the next one is sent; anything else is answered
 * with a new snapshot, so a gap can never leave this file.
 *
 * THE SEND POLICY (spec RT-4, RT-8, RT-P9 to RT-P11). The queue of a socket is its send buffer
 * (`transport.bufferedAmount`); the hub keeps no second one.
 *   - A meter frame is not sent to a socket whose buffer holds more than `meterSkipBytes`; the
 *     next frame that finds room is the newest (the latest value wins). Frames are never queued
 *     here.
 *   - A state message is never dropped. After each one, and at every pace step, a socket whose
 *     buffer holds more than `hardBufferBytes` is closed with 4408: it reconnects and starts
 *     with a snapshot. So the buffer of a socket is at most `hardBufferBytes` plus the one
 *     message that crossed the line.
 *   - Deltas caused only by the 1 Hz steps (`cause: 'tick'`, no record changed) wait for the
 *     pace step, at most `REALTIME_DELTA_PACE_MS`; any other delta sends the waiting ones first,
 *     then itself, at once.
 *
 * WHO IS TOLD (spec §4.7; SR-41). The hub maps a publication to sockets by the IDs the upgrade
 * resolved: `sessionId` for `session.ended`, `operatorId` for `session.updated`, `deviceId` for
 * `device.revoked` (the device's own sockets and those of sessions bound to it). It never holds
 * a token, a cookie or a credential. It remembers for a short time which sessions ended and
 * which devices were retired, and the last published role of an operator: an upgrade that was
 * resolved before such a commit and arrives after its publication is admitted as the
 * publication left things, not as stage 4 saw them.
 *
 * NOTHING IS LOGGED OF A MESSAGE (SR-51): a refused client message is logged by the reason it
 * was refused for, a socket by its connection ID and a principal reference.
 */
import {
  ADMIN_RESOURCE_PERMISSION,
  RealtimeCloseCode,
  RealtimePrincipal,
  WsClientMessageSchema,
  canSendRealtimeMessage,
  type AdminResource,
  type DeviceRevokedReason,
  type Heartbeat,
  type SessionEndedReason,
} from '@dems/shared/api';
import type { OperatorRole, Permission } from '@dems/shared/sim';
import type { EngineMeterFrame, EngineStateChange } from '../engine';
import { describeError } from '../plugins/logger';
import {
  beyondCap,
  deviceRetired,
  displacedBy,
  isRefused,
  principalCapOf,
  principalKeyOf,
  sessionInvalid,
  topicsOf,
  type Admission,
  type PrincipalKey,
} from './admission';
import { ClientMessageRefusal, type ConnectionHandle, type HubDependencies, type RealtimeHub, type RealtimeTransport } from './hub-types';
import { CLOSE_REASON, REALTIME_LIMITS } from './limits';
import {
  adminChangedText,
  deltaText,
  deviceRevokedText,
  heartbeatText,
  helloText,
  metersText,
  sessionEndedText,
  sessionUpdatedText,
  snapshotText,
} from './messages';
import type { Publication } from './publication';
import { createTabletLink } from './tablet-link';

// ── The hub ────────────────────────────────────────────────────────────────────────────────────

interface Closing {
  /** The code the server sent; 0 for a socket that failed. */
  readonly code: number;
  /** When the socket is destroyed if the peer has not answered. */
  readonly deadline: number;
  terminated: boolean;
}

interface Connection {
  readonly id: string;
  readonly kind: RealtimePrincipal;
  readonly transport: RealtimeTransport;
  readonly openedAt: number;
  readonly operatorId: string | null;
  readonly sessionId: string | null;
  readonly deviceId: string | null;
  /** What the principal's own cap is counted under; null without a principal. */
  readonly key: PrincipalKey | null;
  role: OperatorRole | null;
  permissions: readonly Permission[];
  meters: boolean;
  position: { epoch: number; revision: number } | null;
  /** When the last `resync` was answered. */
  lastResyncAt: number | null;
  /** A `resync` that arrived inside the minimum interval is answered at this time. */
  resyncDueAt: number | null;
  /** Arrival times of the client messages of the last window (RT-P5). */
  inbound: number[];
  /** False from a ping until its pong. */
  alive: boolean;
  closing: Closing | null;
  /** True while the socket is open and admitted: it counts for the caps and is sent messages. */
  counted: boolean;
  /** True while the socket is registered as a device's socket (the presence counter, the tablet link). */
  present: boolean;
  snapshots: number;
  deltas: number;
  metersSent: number;
  metersSkipped: number;
}

interface HeldDelta {
  readonly epoch: number;
  readonly revision: number;
  readonly text: string;
}

const PUBLISH_FAILED = 'a publication could not be handed to the sockets';
const SEND_FAILED = 'a message could not be queued on a socket; the socket is destroyed';
const SECOND_MS = 1_000;

function principalReference(connection: Pick<Connection, 'operatorId' | 'deviceId' | 'kind'>): string | null {
  if (connection.kind === RealtimePrincipal.OPERATOR) return `operator:${connection.operatorId}`;
  if (connection.kind === RealtimePrincipal.DEVICE) return `device:${connection.deviceId}`;
  return null;
}

export function createRealtimeHub(dependencies: HubDependencies): RealtimeHub {
  const { clock, log, errorLog } = dependencies;
  const limits = dependencies.limits ?? REALTIME_LIMITS;

  const connections = new Map<string, Connection>();
  const listeners = new Set<() => void>();
  const tabletLink = createTabletLink({ clock, engine: dependencies.engine, log, errorLog, limits });

  let stopped = false;
  let startedAt: number | null = null;
  let beats = 0;
  /** Paced deltas, oldest first. */
  let held: HeldDelta[] = [];

  // Meter frames: the wire number continues when the engine's own count starts again (a reload).
  let meterBase = 0;
  let lastEngineMeterSeq = 0;
  let lastWireMeterSeq = 0;
  let meterWindowStart = Number.NEGATIVE_INFINITY;
  let meterWindowCount = 0;

  // What publications left behind, for an upgrade that was resolved before them (see the header).
  const endedSessions = new Map<string, number>();
  const retiredDevices = new Map<string, number>();
  const publishedRoles = new Map<string, { readonly role: OperatorRole; readonly permissions: readonly Permission[] }>();

  const counters = { refusedByCap: 0, displaced: 0, slowConsumers: 0, metersOverRate: 0, healed: 0, terminated: 0 };

  function notify(): void {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // A listener is a test's or the plugin's own wait; what it throws is not the hub's.
      }
    }
  }

  /** True from the admission until the socket is closed by either side: `close` and `abandon` clear the flag. */
  const live = (connection: Connection): boolean => connection.counted;

  function openCounts(): { total: number; anonymous: number; devices: number; operators: number } {
    const counts = { total: 0, anonymous: 0, devices: 0, operators: 0 };
    for (const connection of connections.values()) {
      if (!live(connection)) continue;
      counts.total += 1;
      if (connection.kind === RealtimePrincipal.ANONYMOUS) counts.anonymous += 1;
      else if (connection.kind === RealtimePrincipal.DEVICE) counts.devices += 1;
      else counts.operators += 1;
    }
    return counts;
  }

  function operators(): Connection[] {
    const found: Connection[] = [];
    for (const connection of connections.values()) {
      if (connection.kind === RealtimePrincipal.OPERATOR && live(connection)) found.push(connection);
    }
    return found;
  }

  // ── Leaving ──────────────────────────────────────────────────────────────────────────────────

  /** The socket no longer counts for the caps; if it was registered as a device's socket, that is undone once. */
  function depart(connection: Connection): void {
    connection.counted = false;
    if (!connection.present || connection.deviceId === null) return;
    connection.present = false;
    dependencies.presence()?.socketClosed(connection.deviceId);
    tabletLink.deviceClosed();
  }

  function destroy(connection: Connection): void {
    try {
      connection.transport.terminate();
    } catch {
      // Already gone.
    }
  }

  /** Sends the close frame. The socket is destroyed at the deadline if the peer does not answer. */
  function close(connection: Connection, code: number, reason: string): void {
    if (connection.closing !== null) return;
    connection.closing = { code, deadline: clock.now() + limits.closeGraceMs, terminated: false };
    depart(connection);
    try {
      connection.transport.close(code, reason);
    } catch {
      connection.closing.terminated = true;
      destroy(connection);
    }
    notify();
  }

  /** The socket cannot be written to, or reported an error: no close frame, destroyed at the deadline. */
  function abandon(connection: Connection, destroyNow: boolean): void {
    if (connection.closing === null) {
      connection.closing = { code: 0, deadline: clock.now() + limits.closeGraceMs, terminated: destroyNow };
      depart(connection);
      notify();
    }
    if (destroyNow) {
      connection.closing.terminated = true;
      destroy(connection);
    }
  }

  // ── Sending ──────────────────────────────────────────────────────────────────────────────────

  /** Queues one frame. False when the socket is being closed or could not take it. */
  function deliver(connection: Connection, text: string): boolean {
    if (connection.closing !== null) return false;
    try {
      connection.transport.send(text);
      return true;
    } catch (error) {
      log.warn({ err: error, connectionId: connection.id }, SEND_FAILED);
      abandon(connection, true);
      return false;
    }
  }

  /** RT-P10: a socket that does not take what it is sent is closed, never skipped. */
  function enforceBuffer(connection: Connection): void {
    if (connection.closing !== null) return;
    const buffered = connection.transport.bufferedAmount;
    if (buffered <= limits.hardBufferBytes) return;
    counters.slowConsumers += 1;
    log.warn({ connectionId: connection.id, code: RealtimeCloseCode.SLOW_CONSUMER, bufferedBytes: buffered }, 'socket closed: slow consumer');
    close(connection, RealtimeCloseCode.SLOW_CONSUMER, CLOSE_REASON.SLOW_CONSUMER);
  }

  /** The whole committed state at the engine's position. False while the engine does not run. */
  function sendSnapshot(connection: Connection, now: number, shared?: { epoch: number; revision: number; text: string }): boolean {
    let snapshot = shared;
    if (snapshot === undefined) {
      const engine = dependencies.engine();
      // While the engine is stopped (a reset) there is no committed state to send; its start
      // publishes a new epoch, and that sends a snapshot to every OPERATOR socket.
      if (!engine.running) return false;
      const { epoch, revision } = engine;
      snapshot = { epoch, revision, text: snapshotText(epoch, revision, now, engine.state()) };
    }
    if (!deliver(connection, snapshot.text)) return false;
    connection.position = { epoch: snapshot.epoch, revision: snapshot.revision };
    connection.snapshots += 1;
    connection.resyncDueAt = null;
    enforceBuffer(connection);
    return true;
  }

  function sendDelta(connection: Connection, delta: HeldDelta, now: number): void {
    const position = connection.position;
    // Inside the snapshot the socket already holds.
    if (position !== null && delta.epoch === position.epoch && delta.revision <= position.revision) return;
    if (position === null || delta.epoch !== position.epoch || delta.revision !== position.revision + 1) {
      // The socket's position does not fit. It is never sent a delta it cannot apply: a snapshot
      // at the engine's position replaces what it holds, and later deltas continue from there.
      counters.healed += 1;
      log.warn(
        { connectionId: connection.id, epoch: delta.epoch, revision: delta.revision, heldEpoch: position?.epoch ?? null, heldRevision: position?.revision ?? null },
        'a delta did not continue the socket\'s position; a snapshot is sent instead',
      );
      sendSnapshot(connection, now);
      return;
    }
    if (!deliver(connection, delta.text)) return;
    connection.position = { epoch: delta.epoch, revision: delta.revision };
    connection.deltas += 1;
    enforceBuffer(connection);
  }

  function flushHeld(now: number): void {
    if (held.length === 0) return;
    const waiting = held;
    held = [];
    const receivers = operators();
    for (const delta of waiting) {
      for (const connection of receivers) sendDelta(connection, delta, now);
    }
  }

  // ── Publications ─────────────────────────────────────────────────────────────────────────────

  function onState(change: EngineStateChange): void {
    const now = clock.now();
    if (change.cause === 'start') {
      // A new epoch (RT-7): what waited belongs to the old one, and a reset re-seeds the roles.
      held = [];
      publishedRoles.clear();
      const receivers = operators();
      if (receivers.length === 0) return;
      const engine = dependencies.engine();
      if (!engine.running) return;
      const shared = { epoch: engine.epoch, revision: engine.revision, text: snapshotText(engine.epoch, engine.revision, now, engine.state()) };
      for (const connection of receivers) sendSnapshot(connection, now, shared);
      return;
    }
    const receivers = operators();
    if (receivers.length === 0) {
      // Nobody to tell. Whoever connects next starts with a snapshot at the engine's position.
      held = [];
      return;
    }
    // Serialised now: the engine's values are held by reference and may not be kept.
    const delta: HeldDelta = { epoch: change.epoch, revision: change.revision, text: deltaText(change) };
    if (change.cause === 'tick' && !change.records) {
      held.push(delta);
      return;
    }
    flushHeld(now);
    for (const connection of receivers) sendDelta(connection, delta, now);
  }

  function onMeters(frame: EngineMeterFrame): void {
    // The engine counts from 1 at each of its starts; the wire number never goes back.
    if (frame.seq <= lastEngineMeterSeq) meterBase = lastWireMeterSeq;
    lastEngineMeterSeq = frame.seq;
    const seq = meterBase + frame.seq;
    lastWireMeterSeq = seq;

    const now = clock.now();
    if (now - meterWindowStart >= SECOND_MS || now < meterWindowStart) {
      meterWindowStart = now;
      meterWindowCount = 0;
    }
    if (meterWindowCount >= limits.meterWireRateHz) {
      counters.metersOverRate += 1;
      return;
    }
    meterWindowCount += 1;

    let text: string | null = null;
    for (const connection of connections.values()) {
      if (!connection.meters || !live(connection)) continue;
      if (connection.transport.bufferedAmount > limits.meterSkipBytes) {
        connection.metersSkipped += 1;
        continue;
      }
      text ??= metersText(frame.at, seq, frame.audio);
      if (deliver(connection, text)) connection.metersSent += 1;
    }
  }

  function onSessionUpdated(operatorId: string, role: OperatorRole, permissions: readonly Permission[]): void {
    publishedRoles.set(operatorId, { role, permissions });
    let text: string | null = null;
    for (const connection of connections.values()) {
      if (connection.operatorId !== operatorId || !live(connection)) continue;
      // The topic membership follows at once: `admin.changed` is decided by these permissions.
      connection.role = role;
      connection.permissions = permissions;
      text ??= sessionUpdatedText(operatorId, role, permissions);
      deliver(connection, text);
    }
  }

  function onSessionEnded(sessionIds: readonly string[], reason: SessionEndedReason): void {
    const now = clock.now();
    const ended = new Set(sessionIds);
    for (const sessionId of ended) endedSessions.set(sessionId, now);
    const text = sessionEndedText(reason);
    for (const connection of connections.values()) {
      if (connection.sessionId === null || !ended.has(connection.sessionId) || !live(connection)) continue;
      deliver(connection, text);
      close(connection, RealtimeCloseCode.SESSION_ENDED, CLOSE_REASON.SESSION_ENDED);
    }
  }

  function onDeviceRevoked(deviceId: string, reason: DeviceRevokedReason): void {
    retiredDevices.set(deviceId, clock.now());
    const text = deviceRevokedText(reason);
    for (const connection of connections.values()) {
      if (connection.deviceId !== deviceId || !live(connection)) continue;
      deliver(connection, text);
      close(connection, RealtimeCloseCode.DEVICE_REVOKED, CLOSE_REASON.DEVICE_REVOKED);
    }
    // That device cannot reconnect: the link is compared again now, without the debounce.
    tabletLink.deviceRetired();
  }

  function onAdminChanged(resource: AdminResource): void {
    const permission: Permission = ADMIN_RESOURCE_PERMISSION[resource];
    let text: string | null = null;
    for (const connection of connections.values()) {
      if (connection.kind !== RealtimePrincipal.OPERATOR || !live(connection)) continue;
      if (!connection.permissions.includes(permission)) continue;
      text ??= adminChangedText(resource);
      deliver(connection, text);
    }
  }

  function dispatch(publication: Publication): void {
    switch (publication.kind) {
      case 'state':
        onState(publication.change);
        return;
      case 'meters':
        onMeters(publication.frame);
        return;
      case 'session.updated':
        onSessionUpdated(publication.operatorId, publication.role, publication.permissions);
        return;
      case 'session.ended':
        onSessionEnded(publication.sessionIds, publication.reason);
        return;
      case 'device.revoked':
        onDeviceRevoked(publication.deviceId, publication.reason);
        return;
      case 'admin.changed':
        onAdminChanged(publication.resource);
        return;
    }
  }

  function publish(publication: Publication): void {
    try {
      dispatch(publication);
    } catch (error) {
      // The seam promises not to throw: a commit is never undone by its publication.
      log.error({ err: error, kind: publication.kind }, PUBLISH_FAILED);
      errorLog.append({ level: 'error', source: 'realtime.publish', message: PUBLISH_FAILED, ...describeError(error), context: { kind: publication.kind } });
    }
  }

  // ── Client messages ──────────────────────────────────────────────────────────────────────────

  function refuse(connection: Connection, why: ClientMessageRefusal): void {
    log.info({ connectionId: connection.id, code: RealtimeCloseCode.POLICY_VIOLATION, refusal: why }, 'socket closed: client message refused');
    close(connection, RealtimeCloseCode.POLICY_VIOLATION, CLOSE_REASON.VIOLATION);
  }

  function answerResync(connection: Connection, now: number): void {
    connection.resyncDueAt = null;
    connection.lastResyncAt = now;
    sendSnapshot(connection, now);
  }

  function receive(connection: Connection, data: Buffer, isBinary: boolean): void {
    if (connection.closing !== null) return;
    const now = clock.now();

    const oldest = now - limits.clientMessageLimit.windowMs;
    connection.inbound = connection.inbound.filter((at) => at > oldest);
    connection.inbound.push(now);
    if (connection.inbound.length > limits.clientMessageLimit.count) return refuse(connection, ClientMessageRefusal.RATE);

    if (isBinary) return refuse(connection, ClientMessageRefusal.NOT_TEXT);
    let json: unknown;
    try {
      json = JSON.parse(data.toString('utf8'));
    } catch {
      return refuse(connection, ClientMessageRefusal.NOT_JSON);
    }
    const parsed = WsClientMessageSchema.safeParse(json);
    if (!parsed.success) return refuse(connection, ClientMessageRefusal.NOT_A_CLIENT_MESSAGE);
    const message = parsed.data;
    if (!canSendRealtimeMessage(connection.kind, message.type)) return refuse(connection, ClientMessageRefusal.NOT_ALLOWED);

    switch (message.type) {
      case 'subscribe':
        connection.meters = true;
        return;
      case 'unsubscribe':
        connection.meters = false;
        return;
      case 'resync': {
        // At most one snapshot in the minimum interval: a `resync` that comes sooner is answered
        // when the interval has passed, once, however many came.
        const last = connection.lastResyncAt;
        if (last !== null && now - last < limits.resyncMinIntervalMs) {
          connection.resyncDueAt = last + limits.resyncMinIntervalMs;
          return;
        }
        answerResync(connection, now);
        return;
      }
    }
  }

  // ── Admission ────────────────────────────────────────────────────────────────────────────────

  /** The admission as the publications since stage 4 left it (see the header). */
  function current(requested: Admission): Admission {
    if (requested.kind === RealtimePrincipal.OPERATOR) {
      if (requested.deviceId !== null && retiredDevices.has(requested.deviceId)) return deviceRetired();
      if (endedSessions.has(requested.sessionId)) return sessionInvalid(requested.deviceId === null ? 'COOKIE' : 'BEARER');
      const published = publishedRoles.get(requested.operatorId);
      return published === undefined ? requested : { ...requested, role: published.role, permissions: published.permissions };
    }
    if (requested.kind === RealtimePrincipal.DEVICE && retiredDevices.has(requested.deviceId)) return deviceRetired();
    return requested;
  }

  /**
   * Closes, oldest first, as many open sockets of the newcomer's principal as its cap asks for:
   * none below the cap, one at it. The loser is told 1013 and may reconnect; nobody else's
   * socket is touched, and a socket without a principal has no cap of its own.
   */
  function displaceOldest(newcomer: Connection): void {
    const key = newcomer.key;
    if (key === null) return;
    // The map keeps the order of admission, so the first ones found are the oldest.
    const own: Connection[] = [];
    for (const connection of connections.values()) {
      if (connection.key === key && live(connection)) own.push(connection);
    }
    for (const oldest of own.slice(0, displacedBy(own.length, principalCapOf(key, limits)))) {
      counters.displaced += 1;
      log.info(
        { connectionId: oldest.id, code: RealtimeCloseCode.TRY_AGAIN_LATER, principal: principalReference(oldest), replacedBy: newcomer.id },
        'socket closed: replaced by a newer socket of its principal',
      );
      close(oldest, RealtimeCloseCode.TRY_AGAIN_LATER, CLOSE_REASON.REPLACED);
    }
  }

  function sessionStateOf(connection: Connection): Heartbeat['sessionState'] {
    if (connection.kind !== RealtimePrincipal.OPERATOR) return null;
    const engine = dependencies.engine();
    return engine.running ? (engine.slice('session')?.state ?? null) : null;
  }

  function heartbeat(connection: Connection, now: number, clients: number): void {
    deliver(
      connection,
      heartbeatText({ seq: beats, now, uptimeMs: Math.max(0, now - (startedAt ?? now)), clients, sessionState: sessionStateOf(connection) }),
    );
  }

  function handleOf(connection: Connection): ConnectionHandle {
    return {
      connectionId: connection.id,
      receive: (data, isBinary) => {
        try {
          receive(connection, data, isBinary);
        } catch (error) {
          log.error({ err: error, connectionId: connection.id }, 'a client message could not be handled; the socket is destroyed');
          abandon(connection, true);
        }
      },
      pong: () => {
        connection.alive = true;
      },
      failed: () => abandon(connection, false),
      closed: (code) => {
        if (!connections.delete(connection.id)) return;
        depart(connection);
        log.info(
          {
            connectionId: connection.id,
            code,
            closedBy: connection.closing === null ? 'peer' : 'server',
            principal: principalReference(connection),
            durationMs: Math.max(0, clock.now() - connection.openedAt),
          },
          'socket closed',
        );
        notify();
      },
    };
  }

  function admit(requested: Admission, transport: RealtimeTransport): ConnectionHandle {
    const now = clock.now();
    startedAt ??= now;
    const admission = current(requested);
    const operator = admission.kind === RealtimePrincipal.OPERATOR ? admission : null;
    const connection: Connection = {
      id: dependencies.newId(),
      kind: admission.kind,
      transport,
      openedAt: now,
      operatorId: operator?.operatorId ?? null,
      sessionId: operator?.sessionId ?? null,
      deviceId: admission.kind === RealtimePrincipal.ANONYMOUS ? null : admission.deviceId,
      key: principalKeyOf(admission),
      role: operator?.role ?? null,
      permissions: operator?.permissions ?? [],
      meters: false,
      position: null,
      lastResyncAt: null,
      resyncDueAt: null,
      inbound: [],
      alive: true,
      closing: null,
      counted: false,
      present: false,
      snapshots: 0,
      deltas: 0,
      metersSent: 0,
      metersSkipped: 0,
    };
    connections.set(connection.id, connection);
    const handle = handleOf(connection);
    const reference = principalReference(connection);

    if (stopped) {
      close(connection, RealtimeCloseCode.GOING_AWAY, CLOSE_REASON.SHUTDOWN);
      return handle;
    }

    const hello = helloText({
      connectionId: connection.id,
      epoch: dependencies.engine().epoch,
      principal: admission.kind,
      reason: admission.kind === RealtimePrincipal.ANONYMOUS ? admission.reason : null,
      topics: topicsOf(admission),
      serverTime: now,
    });

    if (isRefused(admission)) {
      // A bearer value that did not resolve: the client reads the reason, then the close code.
      deliver(connection, hello);
      log.info({ connectionId: connection.id, code: admission.closeCode, helloReason: admission.reason }, 'socket refused: the credential does not resolve');
      close(connection, admission.closeCode, admission.closeCode === RealtimeCloseCode.DEVICE_REVOKED ? CLOSE_REASON.DEVICE_REVOKED : CLOSE_REASON.CREDENTIAL);
      return handle;
    }

    // The principal's own cap first (CPS1-5): at it, the newest socket takes the place of the
    // principal's oldest, so the caps shared by everybody are asked with that place already free.
    displaceOldest(connection);

    const open = openCounts();
    if (beyondCap(admission, open, limits)) {
      counters.refusedByCap += 1;
      log.warn(
        { connectionId: connection.id, code: RealtimeCloseCode.TRY_AGAIN_LATER, principal: admission.kind, open: open.total, anonymous: open.anonymous },
        'socket refused: connection cap',
      );
      close(connection, RealtimeCloseCode.TRY_AGAIN_LATER, CLOSE_REASON.CAP);
      return handle;
    }

    connection.counted = true;
    deliver(connection, hello);
    if (connection.kind === RealtimePrincipal.OPERATOR) sendSnapshot(connection, now);
    heartbeat(connection, now, open.total + 1);
    log.info({ connectionId: connection.id, principal: reference, kind: connection.kind }, 'socket opened');
    // Last: the link may change with this socket, and that change is a delta like any other. A
    // socket that was closed on the way here (its first snapshot crossed the hard limit) is no
    // socket of its device.
    if (connection.deviceId !== null && live(connection)) {
      connection.present = true;
      dependencies.presence()?.socketOpened(connection.deviceId);
      tabletLink.deviceOpened();
    }
    notify();
    return handle;
  }

  // ── The three timers ─────────────────────────────────────────────────────────────────────────

  function beat(): void {
    const now = clock.now();
    startedAt ??= now;
    beats += 1;
    const clients = openCounts().total;
    for (const connection of connections.values()) {
      if (live(connection)) heartbeat(connection, now, clients);
    }
  }

  function forget(memory: Map<string, number>, before: number): void {
    for (const [id, at] of memory) {
      if (at <= before) memory.delete(id);
    }
  }

  function pace(): void {
    const now = clock.now();
    flushHeld(now);
    for (const connection of connections.values()) {
      const closing = connection.closing;
      if (closing !== null) {
        if (!closing.terminated && now >= closing.deadline) {
          closing.terminated = true;
          counters.terminated += 1;
          destroy(connection);
        }
        continue;
      }
      if (connection.kind !== RealtimePrincipal.OPERATOR) continue;
      enforceBuffer(connection);
      if (connection.closing === null && connection.resyncDueAt !== null && now >= connection.resyncDueAt) answerResync(connection, now);
    }
    tabletLink.step();
    forget(endedSessions, now - limits.endedMemoryMs);
    forget(retiredDevices, now - limits.endedMemoryMs);
  }

  function ping(): void {
    for (const connection of connections.values()) {
      if (connection.closing !== null) continue;
      if (!connection.alive) {
        log.info({ connectionId: connection.id }, 'socket destroyed: no answer to the last ping');
        abandon(connection, true);
        continue;
      }
      connection.alive = false;
      try {
        connection.transport.ping();
      } catch {
        abandon(connection, true);
      }
    }
  }

  return {
    publish,
    admit,
    beat,
    pace,
    ping,
    shutdown() {
      stopped = true;
      held = [];
      // A socket that reports its close inside the loop is removed from the map; iterating a map tolerates that.
      for (const connection of connections.values()) close(connection, RealtimeCloseCode.GOING_AWAY, CLOSE_REASON.SHUTDOWN);
    },
    terminateAll() {
      for (const connection of connections.values()) abandon(connection, true);
    },
    connections() {
      return [...connections.values()].map((connection) => ({
        connectionId: connection.id,
        principal: connection.kind,
        operatorId: connection.operatorId,
        sessionId: connection.sessionId,
        deviceId: connection.deviceId,
        role: connection.role,
        permissions: connection.permissions,
        meters: connection.meters,
        position: connection.position === null ? null : { ...connection.position },
        closing: connection.closing?.code ?? null,
        alive: connection.alive,
        bufferedAmount: connection.transport.bufferedAmount,
        sent: { snapshots: connection.snapshots, deltas: connection.deltas, meters: connection.metersSent, metersSkipped: connection.metersSkipped },
      }));
    },
    stats() {
      const open = openCounts();
      return {
        connections: open.total,
        anonymous: open.anonymous,
        devices: open.devices,
        operators: open.operators,
        sockets: connections.size,
        beats,
        heldDeltas: held.length,
        ...counters,
      };
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    tabletLink,
    limits,
  };
}
