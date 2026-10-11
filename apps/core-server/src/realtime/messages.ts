/**
 * The server's messages on `/ws`, as text frames (plan row W42; spec §9.4; AC-B-46). Pure: each
 * function builds one message of the contract's union (`WsServerMessage`, `@dems/shared/api`)
 * and serialises it. The types are the contract's, so a member that the contract does not have
 * does not compile; the tests parse every message kind with the contract's schema.
 *
 * WHAT GOES IN. Only what the caller hands over, and none of it is a secret (spec §9.5):
 *   - `snapshot.state` is the engine's committed state reduced to the 30 replicated slices
 *     (`pickReplicatedState`); `auth`, `authLockout`, `pairing` and `clock` are never in it;
 *   - `delta.ops` are the engine's operations, unchanged;
 *   - `session.updated` names the operator by ID and role and lists the role's permissions;
 *   - the three other control messages hold a value of a closed set and nothing else.
 *
 * SERIALISE, NEVER CHANGE. The engine hands its slices by reference. Each function turns its
 * message into text in the call, so nothing of the engine's state is kept or altered, and one
 * text serves every socket that is sent the message.
 *
 * Time: `heartbeat.serverTime` is an ISO-8601 string, as mock-core writes it; every other time
 * is epoch milliseconds (API-5).
 */
import {
  HEARTBEAT_INTERVAL_MS,
  SessionUpdatedReason,
  pickReplicatedState,
  type AdminChangedMessage,
  type AdminResource,
  type DeltaMessage,
  type DeviceRevokedMessage,
  type DeviceRevokedReason,
  type Heartbeat,
  type HelloMessage,
  type MetersMessage,
  type RealtimeHelloReason,
  type RealtimePrincipal,
  type RealtimeTopic,
  type ReplicatedState,
  type SessionEndedMessage,
  type SessionEndedReason,
  type SessionUpdatedMessage,
  type SnapshotMessage,
} from '@dems/shared/api';
import type { AudioSlice, OperatorRole, Permission } from '@dems/shared/sim';
import type { DurableSlices } from '../db/mapping';
import type { EngineStateChange } from '../engine';

export interface HelloInput {
  readonly connectionId: string;
  readonly epoch: number;
  readonly principal: RealtimePrincipal;
  readonly reason: RealtimeHelloReason | null;
  readonly topics: readonly RealtimeTopic[];
  readonly serverTime: number;
}

export function helloText(input: HelloInput): string {
  const message: HelloMessage = {
    type: 'hello',
    v: 1,
    connectionId: input.connectionId,
    epoch: input.epoch,
    principal: input.principal,
    ...(input.reason === null ? {} : { reason: input.reason }),
    topics: [...input.topics],
    serverTime: input.serverTime,
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  };
  return JSON.stringify(message);
}

export interface HeartbeatInput {
  /** Beats since the channel started; 0 before the first one. */
  readonly seq: number;
  readonly now: number;
  readonly uptimeMs: number;
  /** Open connections at send time. */
  readonly clients: number;
  /** The state of the recording session for an OPERATOR; null for everybody else (SR-40). */
  readonly sessionState: Heartbeat['sessionState'];
}

export function heartbeatText(input: HeartbeatInput): string {
  const message: Heartbeat = {
    type: 'heartbeat',
    v: 1,
    seq: input.seq,
    serverTime: new Date(input.now).toISOString(),
    uptimeMs: input.uptimeMs,
    intervalMs: HEARTBEAT_INTERVAL_MS,
    clients: input.clients,
    sessionState: input.sessionState,
  };
  return JSON.stringify(message);
}

/**
 * The engine's durable slices are the contract's 30 replicated slices: the same names, and each
 * schema's type is the simulator's (proven at compile time in the contract). The two are
 * declared apart, so the step from one type to the other is stated once, here.
 */
function replicatedOf(state: DurableSlices): ReplicatedState {
  return pickReplicatedState(state as unknown as ReplicatedState);
}

export function snapshotText(epoch: number, revision: number, serverTime: number, state: DurableSlices): string {
  const message: SnapshotMessage = { type: 'snapshot', v: 1, epoch, revision, serverTime, state: replicatedOf(state) };
  return JSON.stringify(message);
}

/** One committed change as a `delta`. `serverTime` is the server clock at the commit. */
export function deltaText(change: EngineStateChange): string {
  const message: Omit<DeltaMessage, 'ops'> & { readonly ops: EngineStateChange['ops'] } = {
    type: 'delta',
    v: 1,
    epoch: change.epoch,
    revision: change.revision,
    serverTime: change.at,
    ops: change.ops,
  };
  return JSON.stringify(message);
}

export function metersText(at: number, seq: number, audio: AudioSlice): string {
  const message: Omit<MetersMessage, 'audio'> & { readonly audio: AudioSlice } = { type: 'meters', v: 1, at, seq, audio };
  return JSON.stringify(message);
}

export function sessionUpdatedText(operatorId: string, role: OperatorRole, permissions: readonly Permission[]): string {
  const message: SessionUpdatedMessage = {
    type: 'session.updated',
    v: 1,
    operator: { id: operatorId, role },
    permissions: [...permissions],
    reason: SessionUpdatedReason.ROLE_CHANGED,
  };
  return JSON.stringify(message);
}

export function sessionEndedText(reason: SessionEndedReason): string {
  const message: SessionEndedMessage = { type: 'session.ended', v: 1, reason };
  return JSON.stringify(message);
}

export function deviceRevokedText(reason: DeviceRevokedReason): string {
  const message: DeviceRevokedMessage = { type: 'device.revoked', v: 1, reason };
  return JSON.stringify(message);
}

export function adminChangedText(resource: AdminResource): string {
  const message: AdminChangedMessage = { type: 'admin.changed', v: 1, resource };
  return JSON.stringify(message);
}
