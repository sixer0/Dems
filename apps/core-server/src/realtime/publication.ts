/**
 * The type of the seam `app.publish` (plan row W42; the scaffold's contract, P25). Types only.
 *
 * Rows that landed before the realtime channel already call the seam (the engine host, the
 * identity core, pairing, user administration, the biometric token), so the members below are
 * binding: a kind may be added, an existing one is not changed.
 */
import type { SessionEndedReason } from '@dems/shared/api';
import type { OperatorRole, Permission } from '@dems/shared/sim';
import type { EngineMeterFrame, EngineStateChange } from '../engine';

/**
 * `reason` of the control message `session.ended` (spec §9.4): the contract's type, not a second
 * union (review findings CPB1-18, W91-5). Re-exported under the same name for this seam's callers.
 */
export type { SessionEndedReason };

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
  | { readonly kind: 'admin.changed'; readonly resource: 'USERS' | 'DEVICES' | 'PAIRING_CODE' }
  /**
   * An auth session bound to a paired device began or ended, so the operator the device registry
   * shows signed in on it may have changed (E-fix FX-C, ruling R4; E2E-S-2, RESIDUAL-W70-1). The
   * channel folds it, with the device sockets' own admissions and departures, into one debounced
   * `admin.changed DEVICES` to the holders of the device permission. Added after W42 (a new kind).
   *
   * `deviceIds` is a DIAGNOSTIC payload today (review finding W91-16): the hub does not read it,
   * because `admin.changed DEVICES` names no device and every holder re-reads the whole registry.
   * It names the devices concerned for tests and for a later per-device message; it never holds a
   * secret (only registry IDs, pinned by the two secrets tests).
   */
  | { readonly kind: 'device.session'; readonly deviceIds: readonly string[] };

/**
 * The seam `publish`. Called after the commit (deadlines are measured from it, RT-P12). It
 * returns at once and never throws: a failed send is the channel's concern, not the caller's.
 */
export type Publish = (publication: Publication) => void;
