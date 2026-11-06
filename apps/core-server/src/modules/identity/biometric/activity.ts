/**
 * The audit rows of the biometric operations (plan row W41; spec §4.7, §5.6 steps 1, 5, 6 and 7,
 * §13.1; SR-36, SR-37, SR-54; ENG-12).
 *
 *   audit                          event         when
 *   BIOMETRIC_ENROLLMENT_CHANGED   (none)        biometric sign-in was turned on or off on a device
 *   AUTH_SUCCESS                   AUTH_LOGIN    a token signed in (`details.method: BIOMETRIC`)
 *   AUTH_FAILED                    AUTH_FAILED   a token that was not accepted; a reported failure
 *   AUTH_LOCKED                    AUTH_LOCKED   an attempt, or a report, while the device is locked
 *
 * The three sign-in types are the identity module's own builders, called with the method
 * `BIOMETRIC`, so a biometric attempt reads in the trail exactly as a password attempt does and
 * as the shared simulator writes it. This file adds what only a token can be refused for.
 *
 * WHAT A ROW NEVER HOLDS (SR-54, NL-1, NL-2): a token, a hash of one, a session token. No
 * function here takes such a value. A family is not named either: the details of
 * `BIOMETRIC_ENROLLMENT_CHANGED` are a closed list of the audit writer (`enabled`, `deviceId`).
 *
 * WHO A ROW NAMES. The actor is never a request field (SR-65). A refused token names the
 * operator of the stored token it matched, and nobody when it matched none; a reported failure
 * names an operator only where that operator is enabled and has an enrolment on the reporting
 * device (SR-37; security checkpoint CPS1-8).
 */
import { BiometricTokenRefusalReason } from '@dems/shared/api';
import { AuthMethod } from '@dems/shared/sim';
import type { AuditEntry } from '../../../core';
import { attemptFailed, attemptLocked, signedIn, type Activity } from '../activity';

const BIOMETRIC = AuthMethod.BIOMETRIC;

/**
 * `details.reason` of an `AUTH_FAILED` row of a refused token. The answer to the caller is the
 * same for all of them; the row is for whoever reads the trail.
 */
// The contract's `BiometricTokenRefusalReason` (W83, gap W41-4), under this module's name (review
// findings W91-4, W92-15). TOKEN_REUSE: the token was used before (spec §5.6 step 6), or it is live
// and a device it was not issued to presented it (security checkpoint CPS1-7); the row also
// carries `sessionsEnded`. USER_DISABLED: the operator is disabled, or the token was revoked when
// the operator was disabled (ID-4). TOKEN_REVOKED, TOKEN_EXPIRED (30 days), OTHER_DEVICE (another
// device's token that is no longer live), DEVICE_NOT_PAIRED (the token was right, its device is
// no longer PAIRED).
export const TokenRefusalReason = BiometricTokenRefusalReason;
export type TokenRefusalReason = BiometricTokenRefusalReason;

export interface EnrolmentChanged {
  readonly operatorId: string;
  readonly deviceId: string;
  readonly enabled: boolean;
}

/** Audit only: the specification asks for no event beside it (§13.1). */
export function enrolmentChanged(input: EnrolmentChanged): AuditEntry {
  return {
    type: 'BIOMETRIC_ENROLLMENT_CHANGED',
    message: input.enabled ? `Biometric sign-in turned on (${input.deviceId})` : `Biometric sign-in turned off (${input.deviceId})`,
    actorId: input.operatorId,
    deviceId: input.deviceId,
    details: { enabled: input.enabled, deviceId: input.deviceId },
  };
}

export interface TokenSignedIn {
  readonly operatorId: string;
  readonly displayName: string;
  readonly deviceId: string;
}

/**
 * A token signed in: `AUTH_SUCCESS`. The row never says `replaced`: a biometric sign-in is sent
 * with the device's own credential (the registry's condition `DEVICE_CREDENTIAL` on operation 8,
 * decision D118), so no session is presented with it and none is ended by it (the rotation of
 * ID-6 is the password sign-in's).
 */
export function tokenSignedIn(input: TokenSignedIn): Activity {
  return signedIn({ ...input, method: BIOMETRIC, replaced: false });
}

export interface TokenRefused {
  /** The operator of the stored token the presented value matched; null when it matched none. */
  readonly operatorId: string | null;
  /** The device that presented the value. */
  readonly deviceId: string;
  readonly attemptsRemaining: number;
  /** Set when this failure locked the device, or the device is locked anyway. */
  readonly lockedUntil: number | null;
  /** Null for a value that matched no stored token. */
  readonly reason: TokenRefusalReason | null;
  /** For a reuse: how many open BIOMETRIC sessions it ended. */
  readonly sessionsEnded: number | null;
}

/** A token that was presented and not accepted: `AUTH_FAILED`, as a failed password attempt, with why. */
export function tokenRefused(input: TokenRefused): Activity {
  const activity = attemptFailed({
    method: BIOMETRIC,
    operatorId: input.operatorId,
    deviceId: input.deviceId,
    attemptsRemaining: input.attemptsRemaining,
    lockedUntil: input.lockedUntil,
    disabled: false,
  });
  return {
    audit: {
      ...activity.audit,
      details: {
        ...activity.audit.details,
        ...(input.reason === null ? {} : { reason: input.reason }),
        ...(input.sessionsEnded === null ? {} : { sessionsEnded: input.sessionsEnded }),
      },
    },
    event: activity.event,
  };
}

export interface FailureReported {
  /** The operator the report may name (SR-37), or null. Never the request's value as it came. */
  readonly operatorId: string | null;
  readonly deviceId: string;
  readonly attemptsRemaining: number;
  readonly lockedUntil: number | null;
}

/** A failed biometric check that the device reported: `AUTH_FAILED`. */
export function failureReported(input: FailureReported): Activity {
  return attemptFailed({ method: BIOMETRIC, ...input, disabled: false });
}

export interface AttemptWhileLocked {
  readonly operatorId: string | null;
  readonly deviceId: string;
  readonly lockedUntil: number;
  readonly retryInMs: number;
}

/** A token or a report that arrived while the device is locked: `AUTH_LOCKED`. Nothing was verified. */
export function lockedOut(input: AttemptWhileLocked): Activity {
  return attemptLocked({ method: BIOMETRIC, ...input });
}
