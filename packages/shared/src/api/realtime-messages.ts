/**
 * The messages of WS `/ws`: one JSON object per text frame, discriminated on `type`.
 *
 * Two services send them:
 * - **mock-core** (and the packaged 0.1.0 web build that reads it) sends `heartbeat` only. That
 *   member is unchanged, byte for byte: `Heartbeat` and `HeartbeatSchema` below are as they were.
 * - **The Core server** sends the whole union (backend task: 2026-10-04 01_specs §9; plan row W22,
 *   contract B; AC-B-46 "every message validates against the contract's union").
 *
 * Server to client (`WsServerMessageSchema`; every message carries `type` and `v: 1`):
 *
 * | `type` | Topic | Members | Sent to |
 * |--------|-------|---------|---------|
 * | `hello` | none | `connectionId`, `epoch`, `principal`, `reason?`, `topics`, `serverTime`, `heartbeatIntervalMs` | Every connection, first |
 * | `heartbeat` | heartbeat | `seq`, `serverTime` (ISO-8601), `uptimeMs`, `intervalMs`, `clients`, `sessionState` | Every connection, 1 Hz; `sessionState` is null unless the principal is OPERATOR |
 * | `snapshot` | state | `epoch`, `revision`, `serverTime`, `state` (the 28 replicated slices) | OPERATOR: after `hello`, on `resync`, on a new epoch |
 * | `delta` | state | `epoch`, `revision`, `serverTime`, `ops` | OPERATOR |
 * | `meters` | meters | `at`, `seq`, `audio` | OPERATOR that subscribed |
 * | `session.updated` | control | `operator` (`id`, `role`), `permissions`, `reason` | Sockets of the operator's sessions |
 * | `session.ended` | control | `reason` | Sockets of the session, then close 4401 |
 * | `device.revoked` | control | `reason` | Sockets of the device, then close 4403 |
 * | `admin.changed` | admin | `resource` | OPERATOR holding the permission of the list |
 *
 * Client to server (`WsClientMessageSchema`): `subscribe` and `unsubscribe` with `topic: meters`,
 * and `resync`. Anything else, or a message from a principal that may not send it, closes the
 * connection with 1008.
 *
 * Time. `heartbeat.serverTime` stays an ISO-8601 string, as mock-core writes it. Every new member
 * that is a time (`hello.serverTime`, `snapshot.serverTime`, `delta.serverTime`, `meters.at`) is
 * epoch milliseconds (API-5). A client that learns its clock offset reads both forms.
 *
 * What a message can never carry (01_specs §9.5; SR-15, SR-28, SR-38). Every new member is a
 * strict object whose members are numbers, booleans, closed value sets or identifiers with a
 * pattern, so there is no member that could hold a password, a session token, a cookie value, a
 * device credential, a biometric token, a pairing code or a QR payload, and an unknown member is
 * refused. `session.updated` names the operator by ID and role only; `admin.changed` names the
 * list that changed and holds no row of it; a snapshot holds the 28 replicated slices and no
 * other (`state-slices.ts`). No client message has a member for a credential: authentication
 * happens at the upgrade only, from the request headers.
 */
import { z } from 'zod';
import { SessionState } from '../domain/enums';
import { OperatorRole, Permission } from '../sim/vocabulary';
import { HEARTBEAT_INTERVAL_MS } from './constants';
import { SHA256_HEX_PATTERN } from './patterns';
import { count, epochMs, operatorId } from './schema-parts';
import {
  AudioSliceSchema,
  AuditRowSchema,
  REPLICATED_SLICE_SCHEMAS,
  ReplicatedStateSchema,
  SimEventSchema,
  type ReplicatedSliceName,
} from './state-slices';

/** Server → client heartbeat, one JSON object per WS text frame (masterplan/01_specs.md §2.5). */
export interface Heartbeat {
  type: 'heartbeat';
  /** Message schema version. */
  v: 1;
  /** Global tick counter since server start; the connect-time message carries the current value (0 before the first tick). */
  seq: number;
  /** ISO-8601 UTC. */
  serverTime: string;
  /** Integer, >= 0. */
  uptimeMs: number;
  intervalMs: 1000;
  /** Connected WS clients at send time. */
  clients: number;
  /** Always null in this phase (D4: no simulator in mock-core). */
  sessionState: SessionState | null;
}

export const HeartbeatSchema = z.object({
  type: z.literal('heartbeat'),
  v: z.literal(1),
  seq: z.int().nonnegative(),
  serverTime: z.iso.datetime(),
  uptimeMs: z.int().nonnegative(),
  intervalMs: z.literal(1000),
  clients: z.int().nonnegative(),
  sessionState: z.enum(SessionState).nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Value sets of the Core server's protocol (01_specs §9.2, §9.4)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Who a connection is. Fixed at the upgrade: after a sign-in or a sign-out a client opens a new socket. */
export const RealtimePrincipal = { ANONYMOUS: 'ANONYMOUS', DEVICE: 'DEVICE', OPERATOR: 'OPERATOR' } as const;
export type RealtimePrincipal = (typeof RealtimePrincipal)[keyof typeof RealtimePrincipal];

export const RealtimeTopic = {
  HEARTBEAT: 'heartbeat',
  CONTROL: 'control',
  STATE: 'state',
  METERS: 'meters',
  ADMIN: 'admin',
} as const;
export type RealtimeTopic = (typeof RealtimeTopic)[keyof typeof RealtimeTopic];

/**
 * The topics a principal can be given (01_specs §9.2). An unauthenticated connection gets the
 * heartbeat and nothing else (SR-40). A DEVICE gets `device.revoked` from the control topic. An
 * OPERATOR gets `meters` only after `subscribe`, and `admin` only while it holds USER_ADMIN or
 * PAIRING_MANAGE.
 */
export const REALTIME_PRINCIPAL_TOPICS = {
  [RealtimePrincipal.ANONYMOUS]: [RealtimeTopic.HEARTBEAT],
  [RealtimePrincipal.DEVICE]: [RealtimeTopic.HEARTBEAT, RealtimeTopic.CONTROL],
  [RealtimePrincipal.OPERATOR]: [
    RealtimeTopic.HEARTBEAT,
    RealtimeTopic.CONTROL,
    RealtimeTopic.STATE,
    RealtimeTopic.METERS,
    RealtimeTopic.ADMIN,
  ],
} as const satisfies Record<RealtimePrincipal, readonly RealtimeTopic[]>;

/**
 * Why a connection that presented a credential is ANONYMOUS (01_specs §9.2).
 * - `SESSION_INVALID`: the cookie or the bearer value resolves to nothing the server accepts
 *   (unknown, expired or ended). A web console stays connected for the heartbeat; a bearer
 *   connection is then closed with 4401. The server does not say which of the causes it was.
 * - `DEVICE_REVOKED`: the bearer value belongs to a device that was revoked or unpaired; the
 *   connection is then closed with 4403.
 */
export const RealtimeHelloReason = { SESSION_INVALID: 'SESSION_INVALID', DEVICE_REVOKED: 'DEVICE_REVOKED' } as const;
export type RealtimeHelloReason = (typeof RealtimeHelloReason)[keyof typeof RealtimeHelloReason];

/** `session.updated.reason`: the one cause in this task (01_specs §4.7). */
export const SessionUpdatedReason = { ROLE_CHANGED: 'ROLE_CHANGED' } as const;
export type SessionUpdatedReason = (typeof SessionUpdatedReason)[keyof typeof SessionUpdatedReason];

/**
 * `session.ended.reason` (01_specs §9.4, §5.4). `TOKEN_REUSE`: a used biometric token of the
 * session's device and operator was presented again, or a live one was presented by another paired
 * device (CPS1-7), which ends the open sessions that were created by biometric sign-in (SD-10). The stored end reasons `DEVICE_REVOKED` and
 * `DEVICE_UNPAIRED` are not values here: those sockets get `device.revoked` and close 4403.
 */
export const SessionEndedReason = {
  SIGNED_OUT: 'SIGNED_OUT',
  IDLE_EXPIRED: 'IDLE_EXPIRED',
  ABSOLUTE_EXPIRED: 'ABSOLUTE_EXPIRED',
  ROTATED: 'ROTATED',
  USER_DISABLED: 'USER_DISABLED',
  TOKEN_REUSE: 'TOKEN_REUSE',
} as const;
export type SessionEndedReason = (typeof SessionEndedReason)[keyof typeof SessionEndedReason];

/** `device.revoked.reason`: a Supervisor revoked the device, or the device unpaired itself. */
export const DeviceRevokedReason = { REVOKED: 'REVOKED', UNPAIRED: 'UNPAIRED' } as const;
export type DeviceRevokedReason = (typeof DeviceRevokedReason)[keyof typeof DeviceRevokedReason];

/** `admin.changed.resource`: the list a client refetches through REST. The message holds no row. */
export const AdminResource = { USERS: 'USERS', DEVICES: 'DEVICES', PAIRING_CODE: 'PAIRING_CODE' } as const;
export type AdminResource = (typeof AdminResource)[keyof typeof AdminResource];

/** The permission an OPERATOR needs to be told that a list changed (01_specs §9.2). */
export const ADMIN_RESOURCE_PERMISSION = {
  [AdminResource.USERS]: Permission.USER_ADMIN,
  [AdminResource.DEVICES]: Permission.PAIRING_MANAGE,
  [AdminResource.PAIRING_CODE]: Permission.PAIRING_MANAGE,
} as const satisfies Record<AdminResource, Permission>;

/** Close codes of `/ws` and what a client does (01_specs §9.4). */
export const RealtimeCloseCode = {
  /** Server shutdown: reconnect with the backoff. */
  GOING_AWAY: 1001,
  /** Protocol violation: reconnect. */
  POLICY_VIOLATION: 1008,
  /** A client message larger than `REALTIME_CLIENT_MESSAGE_MAX_BYTES` (W83, gap W42-1): reconnect. */
  MESSAGE_TOO_BIG: 1009,
  /** Connection cap: reconnect later. */
  TRY_AGAIN_LATER: 1013,
  /** The session ended (any reason of `session.ended`), or an invalid bearer: show the login screen. */
  SESSION_ENDED: 4401,
  /** The device was revoked or unpaired: delete the credential, show the pairing screen. */
  DEVICE_REVOKED: 4403,
  /** Slow consumer: reconnect and resynchronise. */
  SLOW_CONSUMER: 4408,
} as const;
export type RealtimeCloseCode = (typeof RealtimeCloseCode)[keyof typeof RealtimeCloseCode];

/** The close codes with their cause and the client's reaction, in the order of 01_specs §9.4. */
export const REALTIME_CLOSE_CODES = [
  { code: RealtimeCloseCode.GOING_AWAY, when: 'Server shutdown.', reaction: 'Reconnect with the backoff.' },
  { code: RealtimeCloseCode.POLICY_VIOLATION, when: 'Protocol violation: an unknown message, one the principal may not send, or too many.', reaction: 'Reconnect.' },
  { code: RealtimeCloseCode.MESSAGE_TOO_BIG, when: 'A client message larger than 65,536 bytes; the socket library refuses it before it is buffered.', reaction: 'Reconnect.' },
  { code: RealtimeCloseCode.TRY_AGAIN_LATER, when: 'The connection cap is reached.', reaction: 'Reconnect later.' },
  {
    code: RealtimeCloseCode.SESSION_ENDED,
    when: 'The session ended (any reason of `session.ended`), or the bearer value is not valid.',
    reaction: 'Show the login screen. A web console opens an anonymous socket for the heartbeat.',
  },
  {
    code: RealtimeCloseCode.DEVICE_REVOKED,
    when: 'The device was revoked or unpaired.',
    reaction: 'Delete the device credential and show the pairing screen.',
  },
  { code: RealtimeCloseCode.SLOW_CONSUMER, when: 'The client did not read fast enough; no state delta is dropped instead.', reaction: 'Reconnect and resynchronise.' },
] as const satisfies readonly { code: RealtimeCloseCode; when: string; reaction: string }[];

/** `connectionId` of `hello`: 1 to 64 letters, digits or hyphens (a UUID fits). It names the socket in the server's log; it is not a credential and has no underscore, so no bearer value fits. */
export const REALTIME_CONNECTION_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Server to client
// ═══════════════════════════════════════════════════════════════════════════════════════

const TOPIC_RULE_MESSAGE = 'The topics do not fit the principal: heartbeat is always present, each topic appears once, and none is outside the principal\'s set.';
const REASON_RULE_MESSAGE = 'Only an ANONYMOUS connection has a reason.';

/** The counter of demo resets, scenario loads and server starts; it continues and is never reused. */
const epoch = () => count();
/** The position of a state message inside its epoch: it starts at 0 and each delta is the previous plus 1. */
const revision = () => count();

function topicsFit(principal: RealtimePrincipal, topics: readonly RealtimeTopic[]): boolean {
  const allowed: readonly RealtimeTopic[] = REALTIME_PRINCIPAL_TOPICS[principal];
  return (
    topics.includes(RealtimeTopic.HEARTBEAT) &&
    new Set(topics).size === topics.length &&
    topics.every((topic) => allowed.includes(topic))
  );
}

export const HelloMessageSchema = z
  .strictObject({
    type: z.literal('hello'),
    v: z.literal(1),
    connectionId: z.string().regex(REALTIME_CONNECTION_ID_PATTERN).describe('Names this socket in the server\'s log. Not a credential.'),
    epoch: epoch().describe('The epoch of the Core state when the connection opened.'),
    principal: z.enum(RealtimePrincipal).describe('Who the server took this connection for, from the upgrade request\'s headers only.'),
    reason: z
      .enum(RealtimeHelloReason)
      .optional()
      .describe('Only with ANONYMOUS: the connection presented a credential the server did not accept.'),
    topics: z
      .array(z.enum(RealtimeTopic))
      .min(1)
      .describe('The topics this connection is given. Always `heartbeat`; never more than the principal\'s set.'),
    serverTime: epochMs().describe('Epoch milliseconds on the server clock.'),
    heartbeatIntervalMs: z.literal(HEARTBEAT_INTERVAL_MS),
  })
  .refine((message) => topicsFit(message.principal, message.topics), { error: TOPIC_RULE_MESSAGE, path: ['topics'] })
  .refine((message) => message.reason === undefined || message.principal === RealtimePrincipal.ANONYMOUS, {
    error: REASON_RULE_MESSAGE,
    path: ['reason'],
  })
  .describe('First message of every connection: who the server took the caller for, and what it will send.');
export type HelloMessage = z.output<typeof HelloMessageSchema>;

export const SnapshotMessageSchema = z
  .strictObject({
    type: z.literal('snapshot'),
    v: z.literal(1),
    epoch: epoch(),
    revision: revision(),
    serverTime: epochMs(),
    state: ReplicatedStateSchema,
  })
  .describe('The whole replicated state: after `hello`, as the answer to `resync`, and when a new epoch starts.');
export type SnapshotMessage = z.output<typeof SnapshotMessageSchema>;

const replaceOp = <Name extends ReplicatedSliceName>(slice: Name) =>
  z.strictObject({ op: z.literal('replace'), slice: z.literal(slice), value: REPLICATED_SLICE_SCHEMAS[slice] });

/** `replace`: one whole slice. A slice that did not change is not sent, so a client keeps its reference. */
export const DeltaReplaceOpSchema = z.discriminatedUnion('slice', [
  replaceOp('meta'),
  replaceOp('device'),
  replaceOp('operators'),
  replaceOp('tabletLink'),
  replaceOp('session'),
  replaceOp('lastSealedSessionId'),
  replaceOp('lastSealedAcknowledged'),
  replaceOp('sessionHistory'),
  replaceOp('activeCameraId'),
  replaceOp('cameras'),
  replaceOp('mics'),
  replaceOp('storage'),
  replaceOp('storagePolicy'),
  replaceOp('time'),
  replaceOp('network'),
  replaceOp('security'),
  replaceOp('services'),
  replaceOp('health'),
  replaceOp('otherDevices'),
  replaceOp('ports'),
  replaceOp('evidence'),
  replaceOp('events'),
  replaceOp('alerts'),
  replaceOp('audit'),
  replaceOp('faults'),
  replaceOp('diagnostics'),
  replaceOp('update'),
  replaceOp('settings'),
]);
export type DeltaReplaceOp = z.output<typeof DeltaReplaceOpSchema>;

/**
 * `append`: new rows at the end of a ring. For `audit` the op carries the slice's other three
 * members after the append, so a client rebuilds the ring as the simulator does and its own chain
 * check works on server rows. The `events` slice is a plain list, so its op carries rows only.
 */
export const DeltaAppendOpSchema = z.discriminatedUnion('slice', [
  z.strictObject({
    op: z.literal('append'),
    slice: z.literal('audit'),
    rows: z.array(AuditRowSchema).min(1),
    head: z.string().regex(SHA256_HEX_PATTERN).describe('Hash of the newest row after the append.'),
    total: count().describe('Rows ever appended, after the append.'),
    dropped: count().describe('Rows dropped off the front of the ring, after the append.'),
  }),
  z.strictObject({
    op: z.literal('append'),
    slice: z.literal('events'),
    rows: z.array(SimEventSchema).min(1),
  }),
]);
export type DeltaAppendOp = z.output<typeof DeltaAppendOpSchema>;

export const DeltaOpSchema = z
  .discriminatedUnion('op', [DeltaReplaceOpSchema, DeltaAppendOpSchema])
  .describe('One operation of a delta: `replace` one whole slice, or `append` rows to `audit` or `events`.');
export type DeltaOp = z.output<typeof DeltaOpSchema>;

export const DeltaMessageSchema = z
  .strictObject({
    type: z.literal('delta'),
    v: z.literal(1),
    epoch: epoch(),
    revision: revision().describe('Exactly the previous revision plus 1 within the epoch. Revisions are gap-free.'),
    serverTime: epochMs(),
    ops: z.array(DeltaOpSchema).min(1).describe('Applied in order. A slice no op names is not touched.'),
  })
  .describe('One change of the replicated state. State deltas are never dropped.');
export type DeltaMessage = z.output<typeof DeltaMessageSchema>;

export const MetersMessageSchema = z
  .strictObject({
    type: z.literal('meters'),
    v: z.literal(1),
    at: epochMs(),
    seq: count().describe('Counts the frames the server produced; a skipped frame leaves a gap, by design. It never goes back on a connection, also across a new epoch.'),
    audio: AudioSliceSchema,
  })
  .describe('One audio frame of both channels. Sent only after `subscribe`; it carries no revision, and the latest value wins.');
export type MetersMessage = z.output<typeof MetersMessageSchema>;

export const SessionUpdatedMessageSchema = z
  .strictObject({
    type: z.literal('session.updated'),
    v: z.literal(1),
    operator: z.strictObject({ id: operatorId(), role: z.enum(OperatorRole) }).describe('The operator of the session: ID and new role, nothing else.'),
    permissions: z.array(z.enum(Permission)).describe('The permissions of the new role. A display hint: the server decides every call.'),
    reason: z.enum(SessionUpdatedReason),
  })
  .describe('The role of the session\'s operator changed. The session stays; nobody is signed out.');
export type SessionUpdatedMessage = z.output<typeof SessionUpdatedMessageSchema>;

export const SessionEndedMessageSchema = z
  .strictObject({
    type: z.literal('session.ended'),
    v: z.literal(1),
    reason: z.enum(SessionEndedReason),
  })
  .describe('The session of this socket ended. The server closes the connection with 4401 right after.');
export type SessionEndedMessage = z.output<typeof SessionEndedMessageSchema>;

export const DeviceRevokedMessageSchema = z
  .strictObject({
    type: z.literal('device.revoked'),
    v: z.literal(1),
    reason: z.enum(DeviceRevokedReason),
  })
  .describe('The device of this socket is no longer paired. The server closes the connection with 4403 right after.');
export type DeviceRevokedMessage = z.output<typeof DeviceRevokedMessageSchema>;

export const AdminChangedMessageSchema = z
  .strictObject({
    type: z.literal('admin.changed'),
    v: z.literal(1),
    resource: z.enum(AdminResource),
  })
  .describe('A list of an administration page changed. It names the list only; the client refetches it through REST.');
export type AdminChangedMessage = z.output<typeof AdminChangedMessageSchema>;

/** Every message a service sends on `/ws`, discriminated on `type`. mock-core sends the `heartbeat` member only. */
export type WsServerMessage =
  | HelloMessage
  | Heartbeat
  | SnapshotMessage
  | DeltaMessage
  | MetersMessage
  | SessionUpdatedMessage
  | SessionEndedMessage
  | DeviceRevokedMessage
  | AdminChangedMessage;

export const WsServerMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  HeartbeatSchema,
  SnapshotMessageSchema,
  DeltaMessageSchema,
  MetersMessageSchema,
  SessionUpdatedMessageSchema,
  SessionEndedMessageSchema,
  DeviceRevokedMessageSchema,
  AdminChangedMessageSchema,
]);

// ═══════════════════════════════════════════════════════════════════════════════════════
// Client to server
// ═══════════════════════════════════════════════════════════════════════════════════════

const meterTopic = () => z.literal(RealtimeTopic.METERS);

export const SubscribeMessageSchema = z
  .strictObject({ type: z.literal('subscribe'), topic: meterTopic() })
  .describe('Start the `meters` frames on this connection.');
export type SubscribeMessage = z.output<typeof SubscribeMessageSchema>;

export const UnsubscribeMessageSchema = z
  .strictObject({ type: z.literal('unsubscribe'), topic: meterTopic() })
  .describe('Stop the `meters` frames on this connection.');
export type UnsubscribeMessage = z.output<typeof UnsubscribeMessageSchema>;

export const ResyncMessageSchema = z
  .strictObject({ type: z.literal('resync') })
  .describe('Ask for a new `snapshot` after a revision gap or another epoch. At most one in 2 s; one that comes sooner is answered when the 2 s have passed.');
export type ResyncMessage = z.output<typeof ResyncMessageSchema>;

/**
 * Every message a client may send, all of them only as OPERATOR. None has a member for a
 * credential: a token in a message authenticates nothing (SR-38).
 */
export const WsClientMessageSchema = z
  .discriminatedUnion('type', [SubscribeMessageSchema, UnsubscribeMessageSchema, ResyncMessageSchema])
  .describe('A message a client sends on `/ws`. Anything else closes the connection with 1008; a message larger than 65,536 bytes closes it with 1009.');
export type WsClientMessage = z.output<typeof WsClientMessageSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// The catalogue: topic and recipients of every message
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface RealtimeServerMessageInfo {
  type: WsServerMessage['type'];
  /** The topic the message belongs to; null for `hello`, which precedes every topic. */
  topic: RealtimeTopic | null;
  /** The principals that can receive it. */
  principals: readonly RealtimePrincipal[];
  /** Its `components.schemas` name. */
  schema: string;
  /** The members besides `type` and `v`. */
  members: string;
  sentTo: string;
}

const EVERY_PRINCIPAL = [RealtimePrincipal.ANONYMOUS, RealtimePrincipal.DEVICE, RealtimePrincipal.OPERATOR] as const;
const OPERATOR_ONLY = [RealtimePrincipal.OPERATOR] as const;

/** One entry per member of `WsServerMessageSchema`, in the order of 01_specs §9.4. */
export const REALTIME_SERVER_MESSAGES = [
  {
    type: 'hello',
    topic: null,
    principals: EVERY_PRINCIPAL,
    schema: 'RealtimeHello',
    members: '`connectionId`, `epoch`, `principal`, `reason?`, `topics`, `serverTime`, `heartbeatIntervalMs`',
    sentTo: 'Every connection, first.',
  },
  {
    type: 'heartbeat',
    topic: RealtimeTopic.HEARTBEAT,
    principals: EVERY_PRINCIPAL,
    schema: 'Heartbeat',
    members: '`seq`, `serverTime`, `uptimeMs`, `intervalMs`, `clients`, `sessionState`',
    sentTo: 'Every connection, once a second. `sessionState` is null unless the principal is OPERATOR.',
  },
  {
    type: 'snapshot',
    topic: RealtimeTopic.STATE,
    principals: OPERATOR_ONLY,
    schema: 'RealtimeSnapshot',
    members: '`epoch`, `revision`, `serverTime`, `state`',
    sentTo: 'OPERATOR: after `hello`, as the answer to `resync`, and when a new epoch starts.',
  },
  {
    type: 'delta',
    topic: RealtimeTopic.STATE,
    principals: OPERATOR_ONLY,
    schema: 'RealtimeDelta',
    members: '`epoch`, `revision`, `serverTime`, `ops`',
    sentTo: 'OPERATOR, for every change of a replicated slice.',
  },
  {
    type: 'meters',
    topic: RealtimeTopic.METERS,
    principals: OPERATOR_ONLY,
    schema: 'RealtimeMeters',
    members: '`at`, `seq`, `audio`',
    sentTo: 'OPERATOR, after `subscribe`.',
  },
  {
    type: 'session.updated',
    topic: RealtimeTopic.CONTROL,
    principals: OPERATOR_ONLY,
    schema: 'RealtimeSessionUpdated',
    members: '`operator` (`id`, `role`), `permissions`, `reason`',
    sentTo: 'The sockets of the operator\'s sessions.',
  },
  {
    type: 'session.ended',
    topic: RealtimeTopic.CONTROL,
    principals: OPERATOR_ONLY,
    schema: 'RealtimeSessionEnded',
    members: '`reason`',
    sentTo: 'The sockets of the session, which are then closed with 4401.',
  },
  {
    type: 'device.revoked',
    topic: RealtimeTopic.CONTROL,
    principals: [RealtimePrincipal.DEVICE, RealtimePrincipal.OPERATOR],
    schema: 'RealtimeDeviceRevoked',
    members: '`reason`',
    sentTo: 'The sockets of the device, signed in or not, which are then closed with 4403.',
  },
  {
    type: 'admin.changed',
    topic: RealtimeTopic.ADMIN,
    principals: OPERATOR_ONLY,
    schema: 'RealtimeAdminChanged',
    members: '`resource`',
    sentTo: 'OPERATOR holding USER_ADMIN (`USERS`) or PAIRING_MANAGE (`DEVICES`, `PAIRING_CODE`).',
  },
] as const satisfies readonly RealtimeServerMessageInfo[];

export interface RealtimeClientMessageInfo {
  type: WsClientMessage['type'];
  principals: readonly RealtimePrincipal[];
  members: string;
  effect: string;
}

/** One entry per member of `WsClientMessageSchema`. */
export const REALTIME_CLIENT_MESSAGES = [
  { type: 'subscribe', principals: OPERATOR_ONLY, members: '`topic: meters`', effect: 'The server starts the `meters` frames.' },
  { type: 'unsubscribe', principals: OPERATOR_ONLY, members: '`topic: meters`', effect: 'The server stops them.' },
  { type: 'resync', principals: OPERATOR_ONLY, members: 'none', effect: 'The server answers with a new `snapshot`. At most one in 2 s; one that comes sooner is answered when the 2 s have passed.' },
] as const satisfies readonly RealtimeClientMessageInfo[];

/** True when a connection of `principal` may be sent a message of `type` (01_specs §9.2). */
export function canReceiveRealtimeMessage(principal: RealtimePrincipal, type: WsServerMessage['type']): boolean {
  const info: RealtimeServerMessageInfo | undefined = REALTIME_SERVER_MESSAGES.find((entry) => entry.type === type);
  return info !== undefined && info.principals.includes(principal);
}

/** True when a connection of `principal` may send a message of `type`; otherwise the server closes it with 1008. */
export function canSendRealtimeMessage(principal: RealtimePrincipal, type: WsClientMessage['type']): boolean {
  const info: RealtimeClientMessageInfo | undefined = REALTIME_CLIENT_MESSAGES.find((entry) => entry.type === type);
  return info !== undefined && info.principals.includes(principal);
}

/**
 * The named schemas of the Core server's messages, by their `components.schemas` name. The
 * `heartbeat` member is the existing `Heartbeat` component.
 */
export const REALTIME_SCHEMAS = {
  RealtimeHello: HelloMessageSchema,
  RealtimeSnapshot: SnapshotMessageSchema,
  RealtimeDeltaOp: DeltaOpSchema,
  RealtimeDelta: DeltaMessageSchema,
  RealtimeMeters: MetersMessageSchema,
  RealtimeSessionUpdated: SessionUpdatedMessageSchema,
  RealtimeSessionEnded: SessionEndedMessageSchema,
  RealtimeDeviceRevoked: DeviceRevokedMessageSchema,
  RealtimeAdminChanged: AdminChangedMessageSchema,
  RealtimeServerMessage: WsServerMessageSchema,
  RealtimeClientMessage: WsClientMessageSchema,
} as const;

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const heartbeatSchemaMatches: Exact<z.infer<typeof HeartbeatSchema>, Heartbeat> = true;
const wsSchemaMatches: Exact<z.infer<typeof WsServerMessageSchema>, WsServerMessage> = true;
void heartbeatSchemaMatches;
void wsSchemaMatches;
