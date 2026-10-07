// Backend task 2026-10-04, plan row W22 (contract B): the messages of WS `/ws` (01_specs §9.2, §9.4,
// §9.5; SR-15, SR-28, SR-38, SR-40; AC-B-46, schema side). The union the Core server sends, with the
// existing heartbeat as one unchanged member; the three client messages; and what no message can
// carry. State messages are built from the real simulator, never from a hand-written state.
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  ADMIN_RESOURCE_PERMISSION,
  AdminChangedMessageSchema,
  CORE_API_SCHEMAS,
  CORE_SERVER_WS_URL,
  CORE_WS_URL,
  DeltaMessageSchema,
  DeltaOpSchema,
  DeviceRevokedMessageSchema,
  HEARTBEAT_EXAMPLE,
  HEARTBEAT_INTERVAL_MS,
  HeartbeatSchema,
  HelloMessageSchema,
  MetersMessageSchema,
  REALTIME_CLIENT_EXAMPLES,
  REALTIME_CLIENT_MESSAGE_LIMIT,
  REALTIME_CLIENT_MESSAGE_MAX_BYTES,
  REALTIME_CLIENT_MESSAGES,
  REALTIME_CLOSE_CODES,
  REALTIME_CONNECTION_ID_PATTERN,
  REALTIME_EXAMPLE_EPOCH,
  REALTIME_PRINCIPAL_TOPICS,
  REALTIME_RESYNC_MIN_INTERVAL_MS,
  REALTIME_SCHEMAS,
  REALTIME_SERVER_EXAMPLES,
  REALTIME_SERVER_MESSAGES,
  REPLICATED_SLICE_NAMES,
  RealtimeCloseCode,
  RealtimePrincipal,
  ResyncMessageSchema,
  SessionEndedMessageSchema,
  SessionEndedReason,
  SessionUpdatedMessageSchema,
  SnapshotMessageSchema,
  SubscribeMessageSchema,
  UNREPLICATED_SLICE_NAMES,
  UnsubscribeMessageSchema,
  WsClientMessageSchema,
  WsServerMessageSchema,
  canReceiveRealtimeMessage,
  canSendRealtimeMessage,
  createOpenApiDocument,
  pickReplicatedState,
  realtimeSnapshotExample,
  serializeOpenApiDocument,
  type DeltaMessage,
  type DeltaOp,
  type DeltaReplaceOp,
  type Heartbeat,
  type MetersMessage,
  type ReplicatedSliceName,
  type ReplicatedState,
  type SessionEndedMessage,
  type SnapshotMessage,
  type WsClientMessage,
  type WsServerMessage,
} from '../src/api';
import { EXAMPLE_INSTANT_MS, EXAMPLE_PLACEHOLDERS } from '../src/api/example-parts';
import { createHeartbeatClient, type SocketLike } from '../src/realtime/heartbeat-client';
import {
  AUDIT_RING_SIZE,
  DEFAULT_SEED,
  DEMO_OPERATOR_PASSWORD,
  DEMO_PAIRING_CODE,
  EVENT_RING_SIZE,
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
  buildScenarioState,
  createIdleState,
  createManualClock,
  createSim,
  pushRing,
  verifyAuditChain,
  type SimState,
} from '../src/sim';

// ── Compile-time proofs ──────────────────────────────────────────────────────────────────────────
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const nineServerMessages: Exact<
  WsServerMessage['type'],
  'hello' | 'heartbeat' | 'snapshot' | 'delta' | 'meters' | 'session.updated' | 'session.ended' | 'device.revoked' | 'admin.changed'
> = true;
const threeClientMessages: Exact<WsClientMessage['type'], 'subscribe' | 'unsubscribe' | 'resync'> = true;
const heartbeatMemberIsTheInterface: Exact<Extract<WsServerMessage, { type: 'heartbeat' }>, Heartbeat> = true;
const unionIsTheSchema: Exact<z.output<typeof WsServerMessageSchema>, WsServerMessage> = true;
const tokenReuseIsAReason: 'TOKEN_REUSE' extends SessionEndedMessage['reason'] ? true : false = true;
const snapshotStateIsThe28Slices: Exact<SnapshotMessage['state'], Pick<SimState, ReplicatedSliceName>> = true;
const metersCarryTheAudioSlice: Exact<MetersMessage['audio'], SimState['audio']> = true;
/** A `replace` of a slice carries exactly the simulator's type of that slice. */
const everyReplaceCarriesItsSlice: {
  [Name in ReplicatedSliceName]: Exact<Extract<DeltaReplaceOp, { slice: Name }>['value'], SimState[Name]>;
} = {
  meta: true, device: true, operators: true, tabletLink: true, session: true, lastSealedSessionId: true, lastSealedAcknowledged: true,
  sessionHistory: true, activeCameraId: true, cameras: true, mics: true, storage: true, storagePolicy: true, time: true, network: true,
  security: true, services: true, health: true, otherDevices: true, ports: true, evidence: true, events: true, alerts: true, audit: true,
  faults: true, diagnostics: true, update: true, settings: true,
};
void [
  nineServerMessages,
  threeClientMessages,
  heartbeatMemberIsTheInterface,
  unionIsTheSchema,
  tokenReuseIsAReason,
  snapshotStateIsThe28Slices,
  metersCarryTheAudioSlice,
  everyReplaceCarriesItsSlice,
];

// ── Real states and the messages built from them ────────────────────────────────────────────────

const AT = EXAMPLE_INSTANT_MS;

function wire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function harness() {
  const clock = createManualClock(AT);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'idle' });
  return {
    sim,
    clock,
    run(ms: number, step = 50) {
      for (let elapsed = 0; elapsed < ms; elapsed += step) {
        clock.advance(step);
        sim.tick();
      }
    },
    state: () => sim.store.getState(),
  };
}

const idleSnapshot = (): SnapshotMessage => realtimeSnapshotExample(pickReplicatedState(wire(createIdleState({ now: AT, seed: DEFAULT_SEED }))));

/**
 * The delta a server would send for the step from `before` to `after`: a slice whose reference
 * changed is replaced; new rows of `audit` and `events` are appended (01_specs RT-3).
 */
function deltaBetween(before: SimState, after: SimState, revision: number): DeltaMessage {
  const ops: DeltaOp[] = [];
  for (const name of REPLICATED_SLICE_NAMES) {
    if (before[name] === after[name]) continue;
    if (name === 'audit' && after.audit.total > before.audit.total) {
      const { head, total, dropped } = after.audit;
      ops.push({ op: 'append', slice: 'audit', rows: after.audit.rows.slice(before.audit.total - after.audit.total), head, total, dropped });
    } else if (name === 'events') {
      const last = before.events.at(-1)?.seq ?? 0;
      ops.push({ op: 'append', slice: 'events', rows: after.events.filter((event) => event.seq > last) });
    } else {
      ops.push({ op: 'replace', slice: name, value: after[name] } as DeltaOp);
    }
  }
  return wire({ type: 'delta', v: 1, epoch: REALTIME_EXAMPLE_EPOCH, revision, serverTime: after.clock.now, ops });
}

/** What a client does with a delta, as far as the contract defines it (RT-3; CL-14 for the two rings). */
function applyDelta(state: ReplicatedState, delta: DeltaMessage): ReplicatedState {
  let next: ReplicatedState = { ...state };
  for (const op of delta.ops) {
    if (op.op === 'replace') next = { ...next, [op.slice]: op.value };
    else if (op.slice === 'audit') {
      next = { ...next, audit: { rows: pushRing(next.audit.rows, op.rows, AUDIT_RING_SIZE), head: op.head, total: op.total, dropped: op.dropped } };
    } else next = { ...next, events: pushRing(next.events, op.rows, EVENT_RING_SIZE) };
  }
  return next;
}

/** One example value of every server message: the contract's examples, and a snapshot of the real idle state. */
function serverExamples(): [string, WsServerMessage][] {
  const out: [string, WsServerMessage][] = [];
  for (const [type, named] of Object.entries(REALTIME_SERVER_EXAMPLES)) {
    for (const [name, example] of Object.entries(named)) out.push([`${type} (${name})`, example.value as WsServerMessage]);
  }
  out.push(['snapshot (the idle state at the fixed instant)', idleSnapshot()]);
  return out;
}

function clientExamples(): [string, WsClientMessage][] {
  const out: [string, WsClientMessage][] = [];
  for (const [type, named] of Object.entries(REALTIME_CLIENT_EXAMPLES)) {
    for (const [name, example] of Object.entries(named)) out.push([`${type} (${name})`, example.value as WsClientMessage]);
  }
  return out;
}

/** The table of 01_specs §9.4, server to client: type, topic, members besides `type` and `v`. */
const SPEC_SERVER_MESSAGES = [
  ['hello', null, ['connectionId', 'epoch', 'principal', 'reason', 'topics', 'serverTime', 'heartbeatIntervalMs']],
  ['heartbeat', 'heartbeat', ['seq', 'serverTime', 'uptimeMs', 'intervalMs', 'clients', 'sessionState']],
  ['snapshot', 'state', ['epoch', 'revision', 'serverTime', 'state']],
  ['delta', 'state', ['epoch', 'revision', 'serverTime', 'ops']],
  ['meters', 'meters', ['at', 'seq', 'audio']],
  ['session.updated', 'control', ['operator', 'permissions', 'reason']],
  ['session.ended', 'control', ['reason']],
  ['device.revoked', 'control', ['reason']],
  ['admin.changed', 'admin', ['resource']],
] as const;

/** Names a secret would have, with values of the right form that open nothing. */
const SECRET_MEMBERS: Readonly<Record<string, unknown>> = {
  password: EXAMPLE_PLACEHOLDERS.password,
  passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$EXAMPLE$EXAMPLE',
  salt: 'EXAMPLE',
  token: EXAMPLE_PLACEHOLDERS.sessionToken,
  sessionToken: EXAMPLE_PLACEHOLDERS.sessionToken,
  authorization: `Bearer ${EXAMPLE_PLACEHOLDERS.sessionToken}`,
  cookie: `dems_session_4420=${EXAMPLE_PLACEHOLDERS.sessionToken}`,
  deviceCredential: EXAMPLE_PLACEHOLDERS.deviceCredential,
  biometricToken: EXAMPLE_PLACEHOLDERS.biometricToken,
  code: EXAMPLE_PLACEHOLDERS.pairingCode,
  pairingCode: EXAMPLE_PLACEHOLDERS.pairingCode,
  qrPayload: EXAMPLE_PLACEHOLDERS.qrPayload,
};

/** Every string inside a JSON value. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) strings(child, strings(key, out));
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════

describe('the heartbeat member is unchanged', () => {
  const heartbeat: Heartbeat = {
    type: 'heartbeat',
    v: 1,
    seq: 12,
    serverTime: '2026-09-30T16:41:00.000Z',
    uptimeMs: 12_345,
    intervalMs: 1000,
    clients: 1,
    sessionState: null,
  };

  it('a mock-core heartbeat parses with its schema and with the union, to the same value', () => {
    expect(HeartbeatSchema.parse(heartbeat)).toEqual(heartbeat);
    expect(WsServerMessageSchema.parse(heartbeat)).toEqual(heartbeat);
    expect(WsServerMessageSchema.parse(HEARTBEAT_EXAMPLE)).toEqual(HEARTBEAT_EXAMPLE);
    expect(Object.keys(heartbeat)).toEqual(['type', 'v', 'seq', 'serverTime', 'uptimeMs', 'intervalMs', 'clients', 'sessionState']);
  });

  it('its time stays an ISO-8601 string and its interval the constant; every bound holds as before', () => {
    for (const bad of [{ serverTime: AT }, { serverTime: 'yesterday' }, { intervalMs: 500 }, { seq: -1 }, { seq: 1.5 }, { v: 2 }, { clients: -1 }, { sessionState: 'PAUSED' }]) {
      expect(WsServerMessageSchema.safeParse({ ...heartbeat, ...bad }).success, JSON.stringify(bad)).toBe(false);
      expect(HeartbeatSchema.safeParse({ ...heartbeat, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
    expect(HEARTBEAT_INTERVAL_MS).toBe(1000);
    expect(WsServerMessageSchema.safeParse({ ...heartbeat, sessionState: 'RECORDING' }).success).toBe(true);
  });

  it('is the same schema object in the union, in the registry and in the offline document', () => {
    expect(WsServerMessageSchema.options).toContain(HeartbeatSchema);
    expect(CORE_API_SCHEMAS.Heartbeat).toBe(HeartbeatSchema);
    const offline = createOpenApiDocument();
    expect(Object.keys(offline.components.schemas.Heartbeat?.properties as object)).toEqual(Object.keys(heartbeat));
    // The offline document describes mock-core's socket only: no other message is in it.
    for (const name of Object.keys(REALTIME_SCHEMAS)) expect(offline.components.schemas[name], name).toBeUndefined();
    expect(serializeOpenApiDocument(offline)).not.toContain('### Core server');
  });

  it('the heartbeat client of the released build keeps working on a socket that also sends the new messages', () => {
    const invalid: string[] = [];
    let socket: SocketLike | undefined;
    const client = createHeartbeatClient({
      url: CORE_WS_URL,
      socketFactory: () => {
        socket = { readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null, close: () => undefined };
        return socket;
      },
      now: () => 0,
      random: () => 0,
      onInvalidMessage: (reason) => invalid.push(reason),
    });
    client.start();
    socket?.onopen?.({});
    socket?.onmessage?.({ data: JSON.stringify(REALTIME_SERVER_EXAMPLES.hello.anonymous.value) });
    // A message that is not a heartbeat is neither a beat nor an invalid message.
    expect(client.getSnapshot().seq).toBeNull();
    expect(invalid).toEqual([]);
    socket?.onmessage?.({ data: JSON.stringify(heartbeat) });
    expect(client.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 12, clients: 1 });
    socket?.onmessage?.({ data: JSON.stringify({ type: 'nope' }) });
    expect(invalid).toEqual(['schema mismatch']);
    client.stop();
  });
});

describe('the union: one example of every message of 01_specs §9.4', () => {
  it('has exactly the nine members of the table, in its order, with its topics', () => {
    expect(REALTIME_SERVER_MESSAGES.map((message) => [message.type, message.topic])).toEqual(SPEC_SERVER_MESSAGES.map(([type, topic]) => [type, topic]));
    expect(WsServerMessageSchema.options).toHaveLength(9);
    // The catalogue names the option of the union, and the registry holds it under that name.
    REALTIME_SERVER_MESSAGES.forEach((message, index) => {
      const schemas: Readonly<Record<string, unknown>> = CORE_API_SCHEMAS;
      expect(schemas[message.schema], message.type).toBe(WsServerMessageSchema.options[index]);
    });
    expect(REALTIME_SCHEMAS.RealtimeServerMessage).toBe(WsServerMessageSchema);
    expect(REALTIME_SCHEMAS.RealtimeClientMessage).toBe(WsClientMessageSchema);
    expect(Object.keys(REALTIME_SCHEMAS)).toHaveLength(11);
  });

  it('each member has exactly the members the table lists, besides `type` and `v`', () => {
    const components = createOpenApiDocument({ scope: 'all' }).components.schemas;
    for (const [type, , members] of SPEC_SERVER_MESSAGES) {
      const info = REALTIME_SERVER_MESSAGES.find((message) => message.type === type);
      const component = components[info?.schema ?? ''] as { properties: Record<string, unknown>; required: string[] };
      expect(Object.keys(component.properties), type).toEqual(['type', 'v', ...members]);
      // Only `hello.reason` is optional.
      expect(component.required, type).toEqual(['type', 'v', ...members.filter((member) => member !== 'reason' || type !== 'hello')]);
      for (const member of members) expect(info?.members, `${type}.${member}`).toContain(`\`${member}`);
    }
  });

  const examples = serverExamples();

  it('there is at least one example of every member', () => {
    const types = new Set(examples.map(([, message]) => message.type));
    expect([...types].sort()).toEqual(SPEC_SERVER_MESSAGES.map(([type]) => type).sort());
    expect(examples.length).toBeGreaterThanOrEqual(22);
  });

  it.each(examples)('%s parses with the union and with its own schema, unchanged', (_label, message) => {
    const sent = wire(message);
    expect(WsServerMessageSchema.parse(sent)).toStrictEqual(sent);
    const info = REALTIME_SERVER_MESSAGES.find((entry) => entry.type === sent.type);
    const schemas: Readonly<Record<string, z.ZodType>> = CORE_API_SCHEMAS;
    expect(schemas[info?.schema ?? '']?.parse(sent)).toStrictEqual(sent);
    expect(sent.v).toBe(1);
  });

  it('the snapshot example is the real idle state: 28 slices, about 120 kB', () => {
    const snapshot = idleSnapshot();
    expect(Object.keys(snapshot.state)).toEqual([...REPLICATED_SLICE_NAMES]);
    expect(SnapshotMessageSchema.parse(snapshot)).toStrictEqual(snapshot);
    const bytes = JSON.stringify(snapshot).length;
    expect(bytes).toBeGreaterThan(50_000);
    expect(bytes).toBeLessThan(400_000);
    const recording = realtimeSnapshotExample(pickReplicatedState(wire(buildScenarioState('recording', createIdleState({ now: AT, seed: DEFAULT_SEED })))));
    expect(WsServerMessageSchema.parse(recording)).toStrictEqual(recording);
  });

  it('the examples tell one story and follow the role matrix', () => {
    const updated = REALTIME_SERVER_EXAMPLES['session.updated'].roleChanged.value;
    expect(updated.permissions).toEqual([...ROLE_PERMISSIONS[updated.operator.role]]);
    expect(REALTIME_SERVER_EXAMPLES.hello.supervisor.value.topics).toContain('admin');
    expect(REALTIME_SERVER_EXAMPLES.hello.operator.value.topics).not.toContain('admin');
    for (const example of Object.values(REALTIME_SERVER_EXAMPLES.hello)) {
      expect(example.value.epoch).toBe(REALTIME_EXAMPLE_EPOCH);
      expect(example.value.serverTime).toBe(AT);
    }
    const ids = Object.values(REALTIME_SERVER_EXAMPLES.hello).map((example) => example.value.connectionId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('hello: the principal and what it is given (01_specs §9.2, SR-40)', () => {
  const hello = REALTIME_SERVER_EXAMPLES.hello.operator.value;
  const anonymous = REALTIME_SERVER_EXAMPLES.hello.anonymous.value;

  it('the topics of a principal are the table of §9.2', () => {
    expect(REALTIME_PRINCIPAL_TOPICS).toEqual({
      ANONYMOUS: ['heartbeat'],
      DEVICE: ['heartbeat', 'control'],
      OPERATOR: ['heartbeat', 'control', 'state', 'meters', 'admin'],
    });
    expect(Object.values(RealtimePrincipal)).toEqual(['ANONYMOUS', 'DEVICE', 'OPERATOR']);
  });

  it('an unauthenticated connection cannot be given a topic beyond the heartbeat', () => {
    for (const topics of [['heartbeat', 'state'], ['heartbeat', 'control'], ['heartbeat', 'meters'], ['heartbeat', 'admin'], ['state']]) {
      expect(HelloMessageSchema.safeParse({ ...anonymous, topics }).success, topics.join()).toBe(false);
      expect(WsServerMessageSchema.safeParse({ ...anonymous, topics }).success, topics.join()).toBe(false);
    }
    expect(HelloMessageSchema.safeParse({ ...anonymous, topics: ['heartbeat'] }).success).toBe(true);
  });

  it('a device is given the heartbeat and control only; an operator any of the five', () => {
    const device = REALTIME_SERVER_EXAMPLES.hello.device.value;
    for (const topic of ['state', 'meters', 'admin']) expect(HelloMessageSchema.safeParse({ ...device, topics: ['heartbeat', 'control', topic] }).success, topic).toBe(false);
    expect(HelloMessageSchema.safeParse({ ...device, topics: ['heartbeat'] }).success).toBe(true);
    expect(HelloMessageSchema.safeParse({ ...hello, topics: ['heartbeat', 'control', 'state', 'meters', 'admin'] }).success).toBe(true);
    expect(HelloMessageSchema.safeParse({ ...hello, topics: ['heartbeat', 'control', 'state'] }).success).toBe(true);
  });

  it('the heartbeat is always among the topics, and none is listed twice or unknown', () => {
    for (const topics of [[], ['control', 'state'], ['heartbeat', 'heartbeat'], ['heartbeat', 'audit'], 'heartbeat']) {
      expect(HelloMessageSchema.safeParse({ ...hello, topics }).success, JSON.stringify(topics)).toBe(false);
    }
  });

  it('only an ANONYMOUS connection has a reason, and the reason is one of two', () => {
    expect(HelloMessageSchema.safeParse({ ...anonymous, reason: 'SESSION_INVALID' }).success).toBe(true);
    expect(HelloMessageSchema.safeParse({ ...anonymous, reason: 'DEVICE_REVOKED' }).success).toBe(true);
    expect(HelloMessageSchema.safeParse({ ...anonymous, reason: 'WRONG_PASSWORD' }).success).toBe(false);
    expect(HelloMessageSchema.safeParse({ ...hello, reason: 'SESSION_INVALID' }).success).toBe(false);
    expect(HelloMessageSchema.safeParse({ ...REALTIME_SERVER_EXAMPLES.hello.device.value, reason: 'DEVICE_REVOKED' }).success).toBe(false);
  });

  it('epoch and time are integers that are not negative; the interval is the heartbeat constant', () => {
    for (const bad of [{ epoch: -1 }, { epoch: 1.5 }, { epoch: '3' }, { serverTime: '2026-10-01T03:00:00.000Z' }, { serverTime: -1 }, { heartbeatIntervalMs: 500 }, { v: 2 }, { principal: 'ADMIN' }]) {
      expect(HelloMessageSchema.safeParse({ ...hello, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
    const { connectionId: _id, ...withoutId } = hello;
    expect(HelloMessageSchema.safeParse(withoutId).success).toBe(false);
  });

  it('who can receive which message', () => {
    const receives = (principal: RealtimePrincipal) => REALTIME_SERVER_MESSAGES.filter((message) => canReceiveRealtimeMessage(principal, message.type)).map((message) => message.type);
    expect(receives('ANONYMOUS')).toEqual(['hello', 'heartbeat']);
    expect(receives('DEVICE')).toEqual(['hello', 'heartbeat', 'device.revoked']);
    expect(receives('OPERATOR')).toEqual(SPEC_SERVER_MESSAGES.map(([type]) => type));
    // A message is never sent on a topic its principal cannot be given.
    for (const message of REALTIME_SERVER_MESSAGES) {
      for (const principal of message.principals) {
        if (message.topic !== null) expect(REALTIME_PRINCIPAL_TOPICS[principal] as readonly string[], `${message.type} to ${principal}`).toContain(message.topic);
      }
    }
    expect(ADMIN_RESOURCE_PERMISSION).toEqual({ USERS: 'USER_ADMIN', DEVICES: 'PAIRING_MANAGE', PAIRING_CODE: 'PAIRING_MANAGE' });
  });
});

describe('the control and admin messages', () => {
  it('session.ended has the six reasons of §9.4, TOKEN_REUSE among them, and no other', () => {
    expect(Object.values(SessionEndedReason)).toEqual(['SIGNED_OUT', 'IDLE_EXPIRED', 'ABSOLUTE_EXPIRED', 'ROTATED', 'USER_DISABLED', 'TOKEN_REUSE']);
    for (const reason of Object.values(SessionEndedReason)) {
      expect(WsServerMessageSchema.parse({ type: 'session.ended', v: 1, reason })).toEqual({ type: 'session.ended', v: 1, reason });
    }
    expect(Object.values(REALTIME_SERVER_EXAMPLES['session.ended']).map((example) => example.value.reason)).toEqual(Object.values(SessionEndedReason));
    // The stored end reasons of a revoked or unpaired device are told by `device.revoked`, not here.
    for (const reason of ['DEVICE_REVOKED', 'DEVICE_UNPAIRED', 'REVOKED', 'token_reuse', '', null]) {
      expect(SessionEndedMessageSchema.safeParse({ type: 'session.ended', v: 1, reason }).success, String(reason)).toBe(false);
    }
    expect(SessionEndedMessageSchema.safeParse({ type: 'session.ended', v: 1 }).success).toBe(false);
  });

  it('device.revoked has two reasons', () => {
    for (const reason of ['REVOKED', 'UNPAIRED']) expect(DeviceRevokedMessageSchema.safeParse({ type: 'device.revoked', v: 1, reason }).success, reason).toBe(true);
    for (const reason of ['DEVICE_REVOKED', 'SIGNED_OUT', 'TOKEN_REUSE']) expect(DeviceRevokedMessageSchema.safeParse({ type: 'device.revoked', v: 1, reason }).success, reason).toBe(false);
  });

  it('session.updated names the operator by ID and role, lists permissions of the vocabulary, and has one reason', () => {
    const updated = REALTIME_SERVER_EXAMPLES['session.updated'].roleChanged.value;
    for (const role of Object.values(OperatorRole)) {
      const message = { ...updated, operator: { id: 'OPR-002', role }, permissions: [...ROLE_PERMISSIONS[role]] };
      expect(SessionUpdatedMessageSchema.parse(message)).toStrictEqual(message);
    }
    expect(SessionUpdatedMessageSchema.safeParse({ ...updated, permissions: Object.values(Permission) }).success).toBe(true);
    for (const bad of [
      { permissions: ['ROOT'] },
      { reason: 'DISABLED' },
      { operator: { id: 'budi.santoso', role: 'TECHNICIAN' } },
      { operator: { id: 'OPR-001', role: 'ADMIN' } },
      { operator: { id: 'OPR-001' } },
      { operator: 'OPR-001' },
    ]) {
      expect(SessionUpdatedMessageSchema.safeParse({ ...updated, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('admin.changed names one of three lists', () => {
    for (const resource of ['USERS', 'DEVICES', 'PAIRING_CODE']) expect(AdminChangedMessageSchema.safeParse({ type: 'admin.changed', v: 1, resource }).success, resource).toBe(true);
    for (const resource of ['SESSIONS', 'AUDIT', 'users', ['USERS']]) expect(AdminChangedMessageSchema.safeParse({ type: 'admin.changed', v: 1, resource }).success, String(resource)).toBe(false);
  });

  it('an unknown type is not a message', () => {
    for (const type of ['nope', 'session.started', 'device.paired', 'state', 'HELLO', undefined]) {
      expect(WsServerMessageSchema.safeParse({ type, v: 1 }).success, String(type)).toBe(false);
    }
    for (const notAnObject of [null, 'heartbeat', 1, [], []]) expect(WsServerMessageSchema.safeParse(notAnObject).success).toBe(false);
  });
});

describe('state: snapshot, then deltas of the real engine', () => {
  it('a `replace` of each of the 28 slices carries the real slice; a value of another slice is refused', () => {
    const state = wire(buildScenarioState('recording', createIdleState({ now: AT, seed: DEFAULT_SEED })));
    for (const name of REPLICATED_SLICE_NAMES) {
      const op = { op: 'replace', slice: name, value: state[name] };
      expect(DeltaOpSchema.parse(op), name).toStrictEqual(op);
    }
    expect(DeltaOpSchema.safeParse({ op: 'replace', slice: 'storage', value: state.time }).success).toBe(false);
    expect(DeltaOpSchema.safeParse({ op: 'replace', slice: 'operators', value: state.evidence }).success).toBe(false);
    expect(DeltaOpSchema.safeParse({ op: 'replace', slice: 'tabletLink' }).success).toBe(false);
    expect(DeltaOpSchema.safeParse({ op: 'merge', slice: 'tabletLink', value: state.tabletLink }).success).toBe(false);
    expect(DeltaOpSchema.safeParse({ op: 'replace', slice: 'everything', value: state }).success).toBe(false);
  });

  it.each([...UNREPLICATED_SLICE_NAMES])('no delta can replace `%s`', (name) => {
    const state = wire(createIdleState({ now: AT, seed: DEFAULT_SEED }));
    expect(DeltaOpSchema.safeParse({ op: 'replace', slice: name, value: state[name] }).success).toBe(false);
    const delta = { ...REALTIME_SERVER_EXAMPLES.delta.tabletConnected.value, ops: [{ op: 'replace', slice: name, value: state[name] }] };
    expect(WsServerMessageSchema.safeParse(delta).success).toBe(false);
  });

  it('the deltas of a real command and of real ticks parse, and applying them gives the engine\'s state', () => {
    const h = harness();
    let replica = pickReplicatedState(wire(h.state()));
    let revision = 0;
    const deltas: DeltaMessage[] = [];
    const step = (act: () => void) => {
      const before = h.state();
      act();
      const after = h.state();
      if (REPLICATED_SLICE_NAMES.every((name) => before[name] === after[name])) return;
      revision += 1;
      const delta = deltaBetween(before, after, revision);
      expect(WsServerMessageSchema.parse(delta)).toStrictEqual(delta);
      deltas.push(delta);
      replica = applyDelta(replica, delta);
      expect(replica).toEqual(pickReplicatedState(wire(after)));
    };
    const { actions } = h.sim;
    step(() => actions.signInWithBiometric('OPR-001'));
    step(() =>
      actions.createSession({
        caseNumber: actions.scanCaseNumber(),
        subjectType: 'SAKSI',
        subjectName: 'Dewi Lestari',
        investigatorId: 'OPR-001',
        room: 'Interview Room 1',
        profileId: 'STANDARD_1080P25',
      }),
    );
    step(() => actions.beginPrecheck());
    for (let tick = 0; tick < 130; tick += 1) step(() => h.run(50));
    step(() => actions.startRecording());
    step(() => actions.addMarker('Key statement'));
    step(() => actions.addNote('A note during the recording'));
    step(() => actions.inject('MIC_CLIP'));
    for (let tick = 0; tick < 100; tick += 1) step(() => h.run(50));
    step(() => actions.stopRecording('Interview completed'));
    for (let tick = 0; tick < 400; tick += 1) step(() => h.run(50));
    expect(h.state().session?.state).toBe('SEALED');
    expect(h.sim.errors()).toEqual([]);

    // Revisions without a gap, in one epoch.
    expect(deltas.map((delta) => delta.revision)).toEqual(deltas.map((_, index) => index + 1));
    expect(new Set(deltas.map((delta) => delta.epoch))).toEqual(new Set([REALTIME_EXAMPLE_EPOCH]));
    const ops = deltas.flatMap((delta) => delta.ops);
    expect(ops.some((op) => op.op === 'append' && op.slice === 'audit')).toBe(true);
    expect(ops.some((op) => op.op === 'append' && op.slice === 'events')).toBe(true);
    const replaced = new Set(ops.filter((op) => op.op === 'replace').map((op) => op.slice));
    for (const name of ['session', 'meta', 'evidence', 'sessionHistory', 'storage', 'health', 'faults', 'alerts', 'mics', 'lastSealedSessionId'] as const) {
      expect(replaced.has(name), name).toBe(true);
    }
    // The audio slice changed twenty times a second and is in no delta.
    expect(JSON.stringify(deltas)).not.toContain('"audio"');
    // The replica's audit ring, built from appends alone, still verifies with the shared check (CL-14).
    expect(replaced.has('audit')).toBe(false);
    expect(verifyAuditChain(replica.audit)).toEqual({ ok: true, checked: replica.audit.rows.length, head: replica.audit.head });
    expect(replica.audit.total).toBe(h.state().audit.total);
  });

  it('an append carries rows of `audit` (with head, total and dropped) or of `events`, never of another slice, never none', () => {
    const state = wire(createIdleState({ now: AT, seed: DEFAULT_SEED }));
    const { head, total, dropped } = state.audit;
    const rows = state.audit.rows.slice(-2);
    const audit = { op: 'append', slice: 'audit', rows, head, total, dropped };
    expect(DeltaOpSchema.parse(audit)).toStrictEqual(audit);
    for (const member of ['head', 'total', 'dropped', 'rows'] as const) {
      const { [member]: _removed, ...rest } = audit;
      expect(DeltaOpSchema.safeParse(rest).success, `without ${member}`).toBe(false);
    }
    expect(DeltaOpSchema.safeParse({ ...audit, rows: [] }).success).toBe(false);
    expect(DeltaOpSchema.safeParse({ ...audit, head: 'short' }).success).toBe(false);
    expect(DeltaOpSchema.safeParse({ ...audit, rows: state.events.slice(-1) }).success).toBe(false);
    const events = { op: 'append', slice: 'events', rows: state.events.slice(-2) };
    expect(DeltaOpSchema.parse(events)).toStrictEqual(events);
    expect(DeltaOpSchema.safeParse({ ...events, rows: [] }).success).toBe(false);
    expect(DeltaOpSchema.safeParse({ ...events, head }).success).toBe(false);
    for (const slice of ['alerts', 'evidence', 'sessionHistory', 'operators']) {
      expect(DeltaOpSchema.safeParse({ op: 'append', slice, rows: [state.events.at(-1)] }).success, slice).toBe(false);
    }
  });

  it('epoch and revision are integers that are not negative; a delta has at least one operation', () => {
    const delta = REALTIME_SERVER_EXAMPLES.delta.tabletConnected.value;
    for (const bad of [{ revision: -1 }, { revision: 1.5 }, { revision: '7' }, { epoch: -1 }, { epoch: null }, { ops: [] }, { ops: undefined }, { serverTime: 'now' }]) {
      expect(DeltaMessageSchema.safeParse({ ...delta, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
    expect(DeltaMessageSchema.safeParse({ ...delta, revision: 0, epoch: 0 }).success).toBe(true);
    const snapshot = idleSnapshot();
    for (const bad of [{ revision: -1 }, { epoch: 0.5 }, { state: null }, { state: {} }]) {
      expect(SnapshotMessageSchema.safeParse({ ...snapshot, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('a meter frame of the real engine parses; it has no revision', () => {
    const h = harness();
    h.run(1_000);
    const audio = wire(h.state().audio);
    const frame = { type: 'meters', v: 1, at: h.state().clock.now, seq: audio.channels['AUDIO-01'].seq, audio };
    expect(WsServerMessageSchema.parse(frame)).toStrictEqual(frame);
    expect(audio.channels['AUDIO-01'].seq).toBeGreaterThan(10);
    expect(MetersMessageSchema.safeParse({ ...frame, revision: 3 }).success).toBe(false);
    expect(MetersMessageSchema.safeParse({ ...frame, audio: { channels: { 'AUDIO-01': audio.channels['AUDIO-01'] } } }).success).toBe(false);
  });
});

describe('client to server', () => {
  it.each(clientExamples())('%s parses, unchanged', (_label, message) => {
    expect(WsClientMessageSchema.parse(wire(message))).toStrictEqual(message);
  });

  it('there are three messages: subscribe and unsubscribe of the meters, and resync', () => {
    expect(REALTIME_CLIENT_MESSAGES.map((message) => message.type)).toEqual(['subscribe', 'unsubscribe', 'resync']);
    expect(WsClientMessageSchema.options).toEqual([SubscribeMessageSchema, UnsubscribeMessageSchema, ResyncMessageSchema]);
    expect(WsClientMessageSchema.parse({ type: 'subscribe', topic: 'meters' })).toEqual({ type: 'subscribe', topic: 'meters' });
    expect(WsClientMessageSchema.parse({ type: 'resync' })).toEqual({ type: 'resync' });
  });

  it('anything else is refused: another topic, another type, a server message, a member too many', () => {
    for (const bad of [
      { type: 'subscribe', topic: 'state' },
      { type: 'subscribe', topic: 'admin' },
      { type: 'subscribe', topic: 'control' },
      { type: 'subscribe' },
      { type: 'unsubscribe', topic: 'heartbeat' },
      { type: 'resync', topic: 'meters' },
      { type: 'resync', epoch: 3 },
      { type: 'resync', v: 1 },
      { type: 'ping' },
      { type: 'hello' },
      { type: 'auth', token: EXAMPLE_PLACEHOLDERS.sessionToken },
      REALTIME_SERVER_EXAMPLES['session.ended'].signedOut.value,
      HEARTBEAT_EXAMPLE,
      {},
      null,
      'resync',
    ]) {
      expect(WsClientMessageSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('only an OPERATOR may send them', () => {
    for (const message of REALTIME_CLIENT_MESSAGES) {
      expect(canSendRealtimeMessage('OPERATOR', message.type), message.type).toBe(true);
      expect(canSendRealtimeMessage('DEVICE', message.type), message.type).toBe(false);
      expect(canSendRealtimeMessage('ANONYMOUS', message.type), message.type).toBe(false);
    }
  });
});

describe('what no message can carry (01_specs §9.5; SR-15, SR-28, SR-38)', () => {
  const server = serverExamples();
  const client = clientExamples();

  it('a server message with a member named like a secret is refused; the heartbeat drops it', () => {
    let refused = 0;
    for (const [label, message] of server) {
      for (const [member, value] of Object.entries(SECRET_MEMBERS)) {
        const result = WsServerMessageSchema.safeParse({ ...wire(message), [member]: value });
        if (message.type === 'heartbeat') {
          // The released member is not strict: it parses, and the member is gone from the result.
          expect(result.success, `${label} + ${member}`).toBe(true);
          expect(result.data, `${label} + ${member}`).toEqual(message);
          expect(Object.keys(result.data ?? {})).not.toContain(member);
        } else {
          expect(result.success, `${label} + ${member}`).toBe(false);
          refused += 1;
        }
      }
    }
    expect(refused).toBe((server.length - 2) * Object.keys(SECRET_MEMBERS).length);
    expect(Object.keys(SECRET_MEMBERS)).toHaveLength(12);
  });

  it('a session.ended or a device.revoked cannot carry a token, and neither names a session or a device', () => {
    const ended = REALTIME_SERVER_EXAMPLES['session.ended'].tokenReuse.value;
    const revoked = REALTIME_SERVER_EXAMPLES['device.revoked'].revoked.value;
    for (const extra of [
      { token: EXAMPLE_PLACEHOLDERS.biometricToken },
      { sessionToken: EXAMPLE_PLACEHOLDERS.sessionToken },
      { deviceCredential: EXAMPLE_PLACEHOLDERS.deviceCredential },
      { biometricToken: EXAMPLE_PLACEHOLDERS.biometricToken },
      { sessionId: 'AS-000001' },
      { deviceId: 'DEV-0001' },
      { operatorId: 'OPR-001' },
      { details: { token: EXAMPLE_PLACEHOLDERS.sessionToken } },
    ]) {
      expect(SessionEndedMessageSchema.safeParse({ ...ended, ...extra }).success, JSON.stringify(Object.keys(extra))).toBe(false);
      expect(DeviceRevokedMessageSchema.safeParse({ ...revoked, ...extra }).success, JSON.stringify(Object.keys(extra))).toBe(false);
    }
    // The reason is a closed value set: a token is not a reason.
    for (const secret of [EXAMPLE_PLACEHOLDERS.sessionToken, EXAMPLE_PLACEHOLDERS.deviceCredential, EXAMPLE_PLACEHOLDERS.biometricToken, EXAMPLE_PLACEHOLDERS.pairingCode]) {
      expect(SessionEndedMessageSchema.safeParse({ ...ended, reason: secret }).success).toBe(false);
      expect(DeviceRevokedMessageSchema.safeParse({ ...revoked, reason: secret }).success).toBe(false);
    }
  });

  it('session.updated holds the operator\'s ID and role, not the operator: no username, no enabled flag, no session list', () => {
    const updated = REALTIME_SERVER_EXAMPLES['session.updated'].roleChanged.value;
    for (const extra of [{ username: 'budi.santoso' }, { enabled: true }, { passwordHash: 'x' }, { sessions: [] }, { activeSessions: 1 }, { displayName: 'AKP Budi Santoso' }]) {
      expect(SessionUpdatedMessageSchema.safeParse({ ...updated, operator: { ...updated.operator, ...extra } }).success, JSON.stringify(extra)).toBe(false);
    }
    expect(SessionUpdatedMessageSchema.safeParse({ ...updated, sessions: [] }).success).toBe(false);
  });

  it('admin.changed names the list and holds no row of it: no user, no paired device, no pairing code', () => {
    const changed = REALTIME_SERVER_EXAMPLES['admin.changed'].devices.value;
    for (const extra of [
      { devices: [{ id: 'DEV-0001', name: 'Tablet 1' }] },
      { users: [{ id: 'OPR-001', enabled: false }] },
      { rows: [] },
      { items: [] },
      { device: { id: 'DEV-0001' } },
      { code: EXAMPLE_PLACEHOLDERS.pairingCode },
      { codeId: 'PCD-000001' },
      { qrPayload: EXAMPLE_PLACEHOLDERS.qrPayload },
    ]) {
      expect(AdminChangedMessageSchema.safeParse({ ...changed, ...extra }).success, JSON.stringify(Object.keys(extra))).toBe(false);
    }
    expect(AdminChangedMessageSchema.safeParse({ ...changed, resource: EXAMPLE_PLACEHOLDERS.pairingCode }).success).toBe(false);
  });

  it('the connection ID of hello cannot be a bearer value, and hello names no operator, session or device', () => {
    const hello = REALTIME_SERVER_EXAMPLES.hello.operator.value;
    for (const secret of [EXAMPLE_PLACEHOLDERS.sessionToken, EXAMPLE_PLACEHOLDERS.deviceCredential, EXAMPLE_PLACEHOLDERS.biometricToken, EXAMPLE_PLACEHOLDERS.qrPayload]) {
      expect(secret).not.toMatch(REALTIME_CONNECTION_ID_PATTERN);
      expect(HelloMessageSchema.safeParse({ ...hello, connectionId: secret }).success).toBe(false);
    }
    for (const connectionId of ['', 'a'.repeat(65), 'has space', 'under_score']) {
      expect(HelloMessageSchema.safeParse({ ...hello, connectionId }).success, connectionId).toBe(false);
    }
    expect(HelloMessageSchema.safeParse({ ...hello, connectionId: 'c-42' }).success).toBe(true);
    for (const extra of [{ operatorId: 'OPR-001' }, { operator: { id: 'OPR-001' } }, { deviceId: 'DEV-0001' }, { session: {} }, { permissions: [] }]) {
      expect(HelloMessageSchema.safeParse({ ...hello, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it('a snapshot cannot carry the slices that stay on the server, or an operator with more than identity and role', () => {
    const snapshot = idleSnapshot();
    const whole = wire(createIdleState({ now: AT, seed: DEFAULT_SEED }));
    for (const name of UNREPLICATED_SLICE_NAMES) {
      const leaked = { ...snapshot, state: { ...snapshot.state, [name]: whole[name] } };
      expect(WsServerMessageSchema.safeParse(leaked).success, name).toBe(false);
    }
    expect(WsServerMessageSchema.safeParse({ ...snapshot, state: whole }).success).toBe(false);
    const [first, ...others] = snapshot.state.operators;
    for (const extra of [{ enabled: true }, { passwordHash: 'x' }, { lastSignInAt: AT }, { activeSessions: 1 }]) {
      const leaked = { ...snapshot, state: { ...snapshot.state, operators: [{ ...first, ...extra }, ...others] } };
      expect(WsServerMessageSchema.safeParse(leaked).success, JSON.stringify(extra)).toBe(false);
      const delta = { ...REALTIME_SERVER_EXAMPLES.delta.tabletConnected.value, ops: [{ op: 'replace', slice: 'operators', value: leaked.state.operators }] };
      expect(WsServerMessageSchema.safeParse(delta).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it('a client message has no member for a credential: a token in a message is refused, never read (SR-38)', () => {
    let refused = 0;
    for (const [label, message] of client) {
      for (const [member, value] of Object.entries(SECRET_MEMBERS)) {
        expect(WsClientMessageSchema.safeParse({ ...message, [member]: value }).success, `${label} + ${member}`).toBe(false);
        refused += 1;
      }
    }
    expect(refused).toBe(3 * 12);
  });

  it('no example holds a secret or anything with the form of one', () => {
    // The values of the contract's own examples (the snapshot is the simulator's state, not an example).
    const values = [...server.filter(([, message]) => message.type !== 'snapshot'), ...client].map(([, message]) => message);
    const texts = strings(values);
    expect(values).toHaveLength(server.length - 1 + client.length);
    expect(texts.length).toBeGreaterThan(100);
    for (const text of texts) {
      expect(text).not.toMatch(/(?:ses|dvc|bio)_/);
      expect(text).not.toMatch(/^\d{6}$/);
      expect(text).not.toContain('DEMS-PAIR');
      expect(text).not.toContain(DEMO_OPERATOR_PASSWORD);
      expect(text).not.toContain(DEMO_PAIRING_CODE);
    }
    // `strings` also yields every member name, at every depth: none is the name of a secret.
    for (const member of Object.keys(SECRET_MEMBERS)) expect(texts).not.toContain(member);
    expect(texts).toContain('connectionId');
  });
});

describe('the protocol\'s constants', () => {
  // Changed by design (W83, gap W42-1; decision D111 DN-1): 1009 for a message over 65,536 bytes joins the six of §9.4.
  it('close codes are the six of §9.4 and 1009 (a client message that is too big)', () => {
    expect(RealtimeCloseCode).toEqual({ GOING_AWAY: 1001, POLICY_VIOLATION: 1008, MESSAGE_TOO_BIG: 1009, TRY_AGAIN_LATER: 1013, SESSION_ENDED: 4401, DEVICE_REVOKED: 4403, SLOW_CONSUMER: 4408 });
    expect(REALTIME_CLOSE_CODES.map((entry) => entry.code)).toEqual([1001, 1008, 1009, 1013, 4401, 4403, 4408]);
    for (const entry of REALTIME_CLOSE_CODES) {
      expect(entry.when.length, String(entry.code)).toBeGreaterThan(10);
      expect(entry.reaction.length, String(entry.code)).toBeGreaterThan(5);
    }
  });

  it('one resync in 2 s; a client message of at most 65,536 bytes; 30 client messages in 10 s', () => {
    expect(REALTIME_RESYNC_MIN_INTERVAL_MS).toBe(2_000);
    expect(REALTIME_CLIENT_MESSAGE_MAX_BYTES).toBe(65_536);
    expect(REALTIME_CLIENT_MESSAGE_LIMIT).toEqual({ count: 30, windowMs: 10_000 });
    // Every client message is far below the limit.
    for (const [, message] of clientExamples()) expect(JSON.stringify(message).length).toBeLessThan(64);
  });
});

describe('the Realtime tag of the OpenAPI documents', () => {
  const offline = createOpenApiDocument();
  const all = createOpenApiDocument({ scope: 'all' });
  const tagOf = (document: typeof all) => document.tags.find((tag) => tag.name === 'Realtime')?.description ?? '';
  const blocks = (text: string) => [...text.matchAll(/```json\n([\s\S]+?)\n```/g)].map((match) => JSON.parse(match[1] ?? 'null') as { type: string });

  it('the offline scope describes mock-core\'s heartbeat, as before: one example, a Heartbeat', () => {
    const found = blocks(tagOf(offline));
    expect(found).toHaveLength(1);
    expect(HeartbeatSchema.safeParse(found[0]).success).toBe(true);
    expect(tagOf(offline)).toContain(CORE_WS_URL);
  });

  it('the `all` scope names both sockets, then gives the Core server\'s protocol (every message, every close code) and mock-core\'s heartbeat', () => {
    // Changed by design (W27, contract C): until the committed document of this scope, the tag
    // began with the offline text and named no host for the Core server. It now names both sockets
    // (`ws://127.0.0.1:4420/ws`, then `ws://127.0.0.1:4400/ws`), describes the Core server first,
    // and keeps the rules and the example of mock-core's heartbeat in a section of their own.
    const text = tagOf(all);
    const coreServerAt = text.indexOf('### Core server');
    const mockCoreAt = text.indexOf('### mock-core');
    expect(coreServerAt).toBeGreaterThan(0);
    expect(mockCoreAt).toBeGreaterThan(coreServerAt);
    const intro = text.slice(0, coreServerAt);
    const added = text.slice(coreServerAt, mockCoreAt);
    const mockCore = text.slice(mockCoreAt);
    expect(intro).toContain(`\`${CORE_SERVER_WS_URL}\``);
    expect(intro).toContain(`\`${CORE_WS_URL}\``);
    // The rules of mock-core's socket and its example are those of the offline text, word for word.
    const [, ...offlineRest] = tagOf(offline).split('\n\n');
    expect(offlineRest.length).toBeGreaterThan(1);
    expect(mockCore).toBe(['### mock-core', ...offlineRest].join('\n\n'));
    expect(text).not.toContain('served by mock-core.');
    for (const message of REALTIME_SERVER_MESSAGES) {
      expect(added, message.type).toContain(`| \`${message.type}\` | ${message.topic ?? 'none'} |`);
      expect(added, message.schema).toContain(`| ${message.schema} |`);
    }
    for (const message of REALTIME_CLIENT_MESSAGES) expect(added, message.type).toContain(`| \`${message.type}\` |`);
    for (const entry of REALTIME_CLOSE_CODES) expect(added, String(entry.code)).toContain(`| ${entry.code} |`);
    for (const name of UNREPLICATED_SLICE_NAMES) expect(added, name).toContain(`\`${name}\``);
    expect(added).toContain('| ANONYMOUS | `hello`, `heartbeat` |');
    expect(added).toContain('| DEVICE | `hello`, `heartbeat`, `device.revoked` |');
    // The only hosts of the whole tag are the two sockets, each named with its URL.
    const urls = [...text.matchAll(/(?:https?|wss?):\/\/[^\s`"')]+/g)].map((match) => match[0]);
    expect([...new Set(urls)]).toEqual([CORE_SERVER_WS_URL, CORE_WS_URL]);
    expect(text).not.toMatch(/localhost/);
  });

  it('every JSON block of the `all` scope is a message of the contract, and all but the snapshot are shown', () => {
    const found = blocks(tagOf(all));
    expect(found.length).toBeGreaterThanOrEqual(11);
    const types: string[] = [];
    for (const block of found) {
      const asServer = WsServerMessageSchema.safeParse(block);
      const asClient = WsClientMessageSchema.safeParse(block);
      expect(asServer.success || asClient.success, JSON.stringify(block).slice(0, 80)).toBe(true);
      types.push(block.type);
    }
    expect([...new Set(types)].sort()).toEqual(
      ['hello', 'heartbeat', 'delta', 'meters', 'session.updated', 'session.ended', 'device.revoked', 'admin.changed', 'subscribe', 'resync'].sort(),
    );
    // Changed by design (W27): the Core server's examples come first, mock-core's heartbeat last.
    expect(found[0]?.type).toBe('hello');
    expect(found[found.length - 1]?.type).toBe('heartbeat');
    expect(HeartbeatSchema.safeParse(found[found.length - 1]).success).toBe(true);
  });

  it('the messages are components of the `all` scope, closed to unknown members; the union refers to its nine members', () => {
    const schemas = all.components.schemas;
    const union = schemas.RealtimeServerMessage as { oneOf: { $ref: string }[] };
    expect(union.oneOf.map((entry) => entry.$ref.replace('#/components/schemas/', ''))).toEqual(REALTIME_SERVER_MESSAGES.map((message) => message.schema));
    for (const message of REALTIME_SERVER_MESSAGES) {
      if (message.type === 'heartbeat') continue;
      expect((schemas[message.schema] as { additionalProperties?: boolean }).additionalProperties, message.schema).toBe(false);
    }
    expect((schemas.RealtimeSnapshot as { properties: { state: { $ref: string } } }).properties.state.$ref).toBe('#/components/schemas/ReplicatedState');
    expect(JSON.stringify(schemas.RealtimeDelta)).toContain('#/components/schemas/RealtimeDeltaOp');
    expect(JSON.stringify(schemas.RealtimeMeters)).toContain('#/components/schemas/AudioSlice');
    const ops = JSON.stringify(schemas.RealtimeDeltaOp);
    for (const name of ['MetaSlice', 'OperatorsSlice', 'AuditSlice', 'SettingsSlice', 'AuditRow', 'SimEvent']) expect(ops, name).toContain(`#/components/schemas/${name}"`);
    for (const client of (schemas.RealtimeClientMessage as { oneOf: { additionalProperties?: boolean }[] }).oneOf) expect(client.additionalProperties).toBe(false);
    expect((schemas.RealtimeSessionEnded as { properties: { reason: { enum: string[] } } }).properties.reason.enum).toContain('TOKEN_REUSE');
  });
});
