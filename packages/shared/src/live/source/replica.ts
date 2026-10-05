/**
 * The replica: how a `snapshot` and a `delta` of the Core server become a change of the client's
 * store (HB-14; backend task 04_client_integration_spec §2.3 CL-13, CL-14; 01_specs §9.3 RT-1 to
 * RT-3).
 *
 * The store has the shape of the simulator's `SimState`. 28 of its 33 slices are replicated: they
 * are exactly the members of `snapshot.state` and the slices a delta may name
 * (`REPLICATED_SLICE_NAMES` of the contract). The other five are built by the client
 * (`./neutral-state`) and no function of this file touches them.
 *
 * | Message | What changes |
 * |---------|--------------|
 * | `snapshot` | Every replicated slice is taken from the message, through structural sharing: a slice that is deeply equal to the current one keeps the current reference, so a snapshot equal to the state changes nothing at all |
 * | `delta`, op `replace` | The one named slice, through structural sharing. A slice no op names is not touched |
 * | `delta`, op `append` on `audit` | The new rows go to the end of the ring of `AUDIT_RING_SIZE`; `head`, `total` and `dropped` are the message's. The rows already held keep their references, so the web's own chain check runs over server rows |
 * | `delta`, op `append` on `events` | The new rows go to the end of the ring of `EVENT_RING_SIZE` |
 *
 * `foldStateMessages` applies a list of messages in order and returns ONE patch: the members that
 * differ from the state it was given, and nothing else. The caller commits it with one store
 * update, so subscribers are told once however many messages were folded. An empty patch means
 * "nothing changed": the caller then does not touch the store.
 *
 * Pure. The ring function and the ring sizes are the simulator's own (`../../sim/events`,
 * `../../sim/constants`), so a ring here and a ring there cannot differ.
 */
import type { DeltaMessage, DeltaOp, SnapshotMessage } from '../../api/realtime-messages';
import { REPLICATED_SLICE_NAMES, type ReplicatedSliceName } from '../../api/state-slices';
import { AUDIT_RING_SIZE, EVENT_RING_SIZE } from '../../sim/constants';
import { pushRing } from '../../sim/events';
import type { SimState } from '../../sim/types';
import type { StructuralSharing } from './structural-sharing';

/** The replicated part of the store. */
export type ReplicatedSlices = Pick<SimState, ReplicatedSliceName>;

/** The replicated slices that change, with their new values. */
export type ReplicaPatch = Partial<ReplicatedSlices>;

/** One state message of the socket, with the connection that delivered it. */
export interface StateMessage {
  readonly message: SnapshotMessage | DeltaMessage;
  /** The number of the socket that delivered it (`LiveSocketStatus.connection`). */
  readonly connection: number;
}

/** Where the replica stands: the epoch and revision of the last state message applied. */
export interface ReplicaPosition {
  readonly epoch: number;
  readonly revision: number;
}

/** True when `position` holds everything up to `target`: a later epoch, or the same epoch at or beyond its revision. */
export function hasReached(position: ReplicaPosition | null, target: ReplicaPosition): boolean {
  if (position === null) return false;
  return position.epoch > target.epoch || (position.epoch === target.epoch && position.revision >= target.revision);
}

type Working = Record<string, unknown>;

function applyOp(working: Working, op: DeltaOp, share: StructuralSharing): void {
  if (op.op === 'replace') {
    working[op.slice] = share(working[op.slice], op.value);
    return;
  }
  if (op.slice === 'audit') {
    const current = working.audit as SimState['audit'];
    working.audit = {
      rows: pushRing(current.rows, op.rows as SimState['audit']['rows'], AUDIT_RING_SIZE),
      head: op.head,
      total: op.total,
      dropped: op.dropped,
    } satisfies SimState['audit'];
    return;
  }
  working.events = pushRing(working.events as SimState['events'], op.rows as SimState['events'], EVENT_RING_SIZE);
}

/**
 * Applies `messages` in order to the replicated slices of `state` and returns what changed.
 * `state` is not modified.
 */
export function foldStateMessages(state: ReplicatedSlices, messages: readonly StateMessage[], share: StructuralSharing): ReplicaPatch {
  const source: Readonly<Record<string, unknown>> = state;
  const working: Working = {};
  for (const name of REPLICATED_SLICE_NAMES) working[name] = source[name];

  for (const { message } of messages) {
    if (message.type === 'snapshot') {
      const incoming: Readonly<Record<string, unknown>> = message.state;
      for (const name of REPLICATED_SLICE_NAMES) working[name] = share(working[name], incoming[name]);
    } else {
      for (const op of message.ops) applyOp(working, op, share);
    }
  }

  const patch: Working = {};
  for (const name of REPLICATED_SLICE_NAMES) {
    if (!Object.is(working[name], source[name])) patch[name] = working[name];
  }
  return patch as ReplicaPatch;
}

/**
 * The patch that turns the replicated slices of `state` into those of `next`, through structural
 * sharing: a slice that already equals its replacement is not in the patch. Used to drop the Core
 * data of a session that ended (`next` is then the neutral state).
 */
export function replacementPatch(state: ReplicatedSlices, next: ReplicatedSlices, share: StructuralSharing): ReplicaPatch {
  const before: Readonly<Record<string, unknown>> = state;
  const after: Readonly<Record<string, unknown>> = next;
  const patch: Working = {};
  for (const name of REPLICATED_SLICE_NAMES) {
    const shared = share(before[name], after[name]);
    if (!Object.is(shared, before[name])) patch[name] = shared;
  }
  return patch as ReplicaPatch;
}
