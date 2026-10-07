/**
 * Example messages of the Core server's socket (backend task: 2026-10-04 01_specs §9.4; plan row
 * W22, contract B). One or more for every message of `WsServerMessageSchema` and of
 * `WsClientMessageSchema`; the Realtime tag of the OpenAPI document of the `all` scope shows them,
 * and test/api-realtime.test.ts parses each one with its schema.
 *
 * - They are frozen at the instant of `examples.ts` (2026-10-01 10:00:00 WIB) and tell its story:
 *   the investigator OPR-001 records session SES-20261001-0024, a tablet is paired as DEV-0001.
 * - **No example holds a secret, and none could:** no message has a member for one
 *   (`realtime-messages.ts`). The connection IDs are fixed, made-up UUIDs.
 * - A `snapshot` holds the 28 replicated slices of a whole state, about 120 kB, so there is no
 *   literal for it: `realtimeSnapshotExample(state)` wraps a state the caller built. The tests
 *   build it from the real simulator, which is the only place a whole state is defined.
 */
import { EXAMPLE_INSTANT_MS } from './example-parts';
import { EXAMPLE_IDS, HEARTBEAT_EXAMPLE, type OpenApiExample } from './examples';
import type {
  AdminChangedMessage,
  DeltaMessage,
  DeviceRevokedMessage,
  Heartbeat,
  HelloMessage,
  MetersMessage,
  ResyncMessage,
  SessionEndedMessage,
  SessionUpdatedMessage,
  SnapshotMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  WsClientMessage,
  WsServerMessage,
} from './realtime-messages';
import type { ReplicatedState } from './state-slices';

/** The epoch and the revisions the examples use: the third epoch of the Core state, 128 deltas in. */
export const REALTIME_EXAMPLE_EPOCH = 3;
const REVISION = 128;

const hello = (connectionId: string, rest: Pick<HelloMessage, 'principal' | 'topics'> & Partial<Pick<HelloMessage, 'reason'>>): HelloMessage => ({
  type: 'hello',
  v: 1,
  connectionId,
  epoch: REALTIME_EXAMPLE_EPOCH,
  ...rest,
  serverTime: EXAMPLE_INSTANT_MS,
  heartbeatIntervalMs: 1000,
});

const sessionEnded = (reason: SessionEndedMessage['reason']): SessionEndedMessage => ({ type: 'session.ended', v: 1, reason });

/** A whole-state message around a state the caller built (see the file header). */
export function realtimeSnapshotExample(state: ReplicatedState): SnapshotMessage {
  return { type: 'snapshot', v: 1, epoch: REALTIME_EXAMPLE_EPOCH, revision: REVISION, serverTime: EXAMPLE_INSTANT_MS, state };
}

type Named<T> = Readonly<Record<string, OpenApiExample<T>>>;

/**
 * Examples of every server message except `snapshot`, by `type`. The heartbeat of mock-core is
 * `HEARTBEAT_EXAMPLE` (`examples.ts`), unchanged.
 */
export const REALTIME_SERVER_EXAMPLES = {
  hello: {
    operator: {
      summary: 'A signed-in investigator on the web console',
      value: hello('00000000-0000-4000-8000-0000000000a1', {
        principal: 'OPERATOR',
        topics: ['heartbeat', 'control', 'state', 'meters'],
      }),
    },
    supervisor: {
      summary: 'A signed-in supervisor: also told when a list of an administration page changes',
      value: hello('00000000-0000-4000-8000-0000000000a2', {
        principal: 'OPERATOR',
        topics: ['heartbeat', 'control', 'state', 'meters', 'admin'],
      }),
    },
    device: {
      summary: 'A paired tablet, nobody signed in',
      value: hello('00000000-0000-4000-8000-0000000000a3', { principal: 'DEVICE', topics: ['heartbeat', 'control'] }),
    },
    anonymous: {
      summary: 'No credential: the login page, or a tablet that is not paired',
      value: hello('00000000-0000-4000-8000-0000000000a4', { principal: 'ANONYMOUS', topics: ['heartbeat'] }),
    },
    sessionInvalid: {
      summary: 'A cookie that no longer resolves to a session: the console stays connected for the heartbeat',
      value: hello('00000000-0000-4000-8000-0000000000a5', {
        principal: 'ANONYMOUS',
        reason: 'SESSION_INVALID',
        topics: ['heartbeat'],
      }),
    },
    deviceRevoked: {
      summary: 'A bearer value of a revoked device: this message, then close 4403',
      value: hello('00000000-0000-4000-8000-0000000000a6', {
        principal: 'ANONYMOUS',
        reason: 'DEVICE_REVOKED',
        topics: ['heartbeat'],
      }),
    },
  } satisfies Named<HelloMessage>,
  heartbeat: {
    withoutSession: { summary: 'To an ANONYMOUS or DEVICE connection: no session state', value: HEARTBEAT_EXAMPLE },
    operator: {
      summary: 'To an OPERATOR connection while the session records',
      value: { ...HEARTBEAT_EXAMPLE, sessionState: 'RECORDING' },
    },
  } satisfies Named<Heartbeat>,
  delta: {
    tabletConnected: {
      summary: 'A paired tablet connected: one slice replaced, one event appended',
      value: {
        type: 'delta',
        v: 1,
        epoch: REALTIME_EXAMPLE_EPOCH,
        revision: REVISION + 1,
        serverTime: EXAMPLE_INSTANT_MS,
        ops: [
          { op: 'replace', slice: 'tabletLink', value: { state: 'CONNECTED', changedAt: EXAMPLE_INSTANT_MS } },
          {
            op: 'append',
            slice: 'events',
            rows: [
              {
                id: 'LOG-000061',
                seq: 61,
                at: EXAMPLE_INSTANT_MS,
                type: 'TABLET_CONNECTED',
                severity: 'INFO',
                message: 'Tablet connected',
                params: { state: 'CONNECTED' },
                sessionId: EXAMPLE_IDS.recordingSessionId,
                deviceId: 'TABLET',
              },
            ],
          },
        ],
      },
    },
  } satisfies Named<DeltaMessage>,
  meters: {
    speaking: {
      summary: 'The interviewer speaks, the subject is silent',
      value: {
        type: 'meters',
        v: 1,
        at: EXAMPLE_INSTANT_MS,
        seq: 22_440,
        audio: {
          channels: {
            'AUDIO-01': { seq: 22_440, at: EXAMPLE_INSTANT_MS, dbfs: -18.4, peak: -12.1, clip: false, noSignal: false },
            'AUDIO-02': { seq: 22_440, at: EXAMPLE_INSTANT_MS, dbfs: -51.7, peak: -50.9, clip: false, noSignal: false },
          },
        },
      },
    },
  } satisfies Named<MetersMessage>,
  'session.updated': {
    roleChanged: {
      summary: 'A supervisor made this operator a technician',
      value: {
        type: 'session.updated',
        v: 1,
        operator: { id: EXAMPLE_IDS.investigatorId, role: 'TECHNICIAN' },
        permissions: ['EVIDENCE_VIEW', 'DEVICE_MANAGE', 'DIAGNOSTICS_RUN', 'MAINTENANCE'],
        reason: 'ROLE_CHANGED',
      },
    },
  } satisfies Named<SessionUpdatedMessage>,
  'session.ended': {
    signedOut: { summary: 'The operator signed out, or locked the console', value: sessionEnded('SIGNED_OUT') },
    idleExpired: { summary: '15 minutes without activity', value: sessionEnded('IDLE_EXPIRED') },
    absoluteExpired: { summary: '8 hours after the sign-in', value: sessionEnded('ABSOLUTE_EXPIRED') },
    rotated: { summary: 'A new sign-in presented this session and replaced it', value: sessionEnded('ROTATED') },
    userDisabled: { summary: 'An administrator disabled the account', value: sessionEnded('USER_DISABLED') },
    tokenReuse: {
      summary: 'A used biometric token was presented again, or a live one by another device: biometric sessions of this device and operator end',
      value: sessionEnded('TOKEN_REUSE'),
    },
  } satisfies Named<SessionEndedMessage>,
  'device.revoked': {
    revoked: { summary: 'A supervisor revoked the device', value: { type: 'device.revoked', v: 1, reason: 'REVOKED' } },
    unpaired: { summary: 'The device unpaired itself', value: { type: 'device.revoked', v: 1, reason: 'UNPAIRED' } },
  } satisfies Named<DeviceRevokedMessage>,
  'admin.changed': {
    users: { summary: 'A role changed, or a user was enabled or disabled', value: { type: 'admin.changed', v: 1, resource: 'USERS' } },
    devices: { summary: 'A device was paired, revoked or unpaired', value: { type: 'admin.changed', v: 1, resource: 'DEVICES' } },
    pairingCode: {
      summary: 'A pairing code was issued, redeemed, cancelled, or expired',
      value: { type: 'admin.changed', v: 1, resource: 'PAIRING_CODE' },
    },
  } satisfies Named<AdminChangedMessage>,
} as const satisfies { [Type in Exclude<WsServerMessage['type'], 'snapshot'>]: Named<Extract<WsServerMessage, { type: Type }>> };

/** Examples of every client message, by `type`. */
export const REALTIME_CLIENT_EXAMPLES = {
  subscribe: {
    meters: { summary: 'The page with the meters became visible', value: { type: 'subscribe', topic: 'meters' } },
  } satisfies Named<SubscribeMessage>,
  unsubscribe: {
    meters: { summary: 'The page was hidden', value: { type: 'unsubscribe', topic: 'meters' } },
  } satisfies Named<UnsubscribeMessage>,
  resync: {
    gap: { summary: 'A revision gap, or another epoch', value: { type: 'resync' } },
  } satisfies Named<ResyncMessage>,
} as const satisfies { [Type in WsClientMessage['type']]: Named<Extract<WsClientMessage, { type: Type }>> };
