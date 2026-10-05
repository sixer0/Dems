/**
 * The type of the seam `app.publish` (plan row W42; the scaffold's contract, P25). Types only.
 *
 * Rows that landed before the realtime channel already call the seam (the engine host, the
 * identity core, pairing, user administration, the biometric token), so the members below are
 * binding: a kind may be added, an existing one is not changed.
 */
import type { OperatorRole, Permission } from '@dems/shared/sim';
import type { EngineMeterFrame, EngineStateChange } from '../engine';

/** `reason` of the control message `session.ended` (spec §9.4). */
export type SessionEndedReason =
  | 'SIGNED_OUT'
  | 'IDLE_EXPIRED'
  | 'ABSOLUTE_EXPIRED'
  | 'ROTATED'
  | 'USER_DISABLED'
  | 'TOKEN_REUSE';

/**
 * Something that happened and that connected clients must learn (spec §4.7, §9.4). The caller
 * says what happened; the realtime channel decides which sockets get which message and which
 * are closed. A publication never holds a secret (spec §9.5).
 */
export type Publication =
  /** The replicated state changed: a `delta` to every OPERATOR socket; a `snapshot` for a new epoch. */
  | { readonly kind: 'state'; readonly change: EngineStateChange }
  /** A 20 Hz meter frame for the sockets that subscribed. */
  | { readonly kind: 'meters'; readonly frame: EngineMeterFrame }
  /** An operator's role changed: `session.updated` to the sockets of that operator's sessions. */
  | {
      readonly kind: 'session.updated';
      readonly operatorId: string;
      readonly role: OperatorRole;
      readonly permissions: readonly Permission[];
    }
  /** Auth sessions ended: `session.ended`, then close 4401, on the sockets of those sessions. */
  | { readonly kind: 'session.ended'; readonly sessionIds: readonly string[]; readonly reason: SessionEndedReason }
  /** A device was revoked or unpaired: `device.revoked`, then close 4403, on its sockets. */
  | { readonly kind: 'device.revoked'; readonly deviceId: string; readonly reason: 'REVOKED' | 'UNPAIRED' }
  /** A list of a portal page changed: `admin.changed` to the holders of the matching permission. */
  | { readonly kind: 'admin.changed'; readonly resource: 'USERS' | 'DEVICES' | 'PAIRING_CODE' };

/**
 * The seam `publish`. Called after the commit (deadlines are measured from it, RT-P12). It
 * returns at once and never throws: a failed send is the channel's concern, not the caller's.
 */
export type Publish = (publication: Publication) => void;
