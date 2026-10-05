/**
 * The audit rows and events of the identity module (plan row W24; spec §5.2 ID-4, ID-5, ID-8,
 * ID-9, §5.4, §13.2; SR-23, SR-54; ENG-8, ENG-12).
 *
 * Five audit types, each with the event the shared simulator writes beside it
 * (`packages/shared/src/sim/auth.ts`), so the Live trail reads like the Simulated one:
 *
 *   audit             event         when
 *   AUTH_SUCCESS      AUTH_LOGIN    a sign-in that issued a session
 *   AUTH_FAILED       AUTH_FAILED   an attempt that was verified and refused
 *   AUTH_LOCKED       AUTH_LOCKED   an attempt while the console is locked (not verified)
 *   AUTH_SIGNED_OUT   AUTH_LOGOUT   a sign-out
 *   AUTH_EXPIRED      AUTH_EXPIRED  a session past its idle or absolute limit
 *
 * WHAT A ROW NEVER HOLDS (SR-54): a password, a token, a cookie value, a hash, or the username
 * that was typed. A failed attempt names the operator ID only when the username matched a known
 * operator; a typed username that matches nobody may be a mistyped password and is recorded
 * nowhere. The functions below do not even take such a value.
 *
 * The rows go through the unit's writers, which add the sequence, the hash and the time of the
 * server clock; nothing here can set a time (SR-65).
 */
import { AuthMethod, type SignOutReason } from '@dems/shared/sim';
import type { AuditEntry, EventEntry, UnitContext } from '../../core';
import type { AuthMethodValue } from '../../db/schema';

/** One audit row and the event that goes with it. */
export interface Activity {
  readonly audit: AuditEntry;
  readonly event: EventEntry;
}

/** Appends both parts in the caller's unit of work. */
export async function appendActivity(unit: UnitContext, activity: Activity): Promise<void> {
  await unit.audit.append(activity.audit);
  await unit.events.append(activity.event);
}

/** The same for several, in order; each kind shares one time. */
export async function appendActivities(unit: UnitContext, activities: readonly Activity[]): Promise<void> {
  if (activities.length === 0) return;
  await unit.audit.appendMany(activities.map((activity) => activity.audit));
  await unit.events.appendMany(activities.map((activity) => activity.event));
}

function methodLabel(method: AuthMethodValue): string {
  return method === AuthMethod.BIOMETRIC ? 'biometric' : 'password';
}

export interface SignedIn {
  readonly operatorId: string;
  readonly displayName: string;
  readonly method: AuthMethodValue;
  /** The paired device of the session; null for the web console. */
  readonly deviceId: string | null;
  /** True when a valid session was presented with the sign-in and ended by it (ID-6). */
  readonly replaced: boolean;
}

export function signedIn(input: SignedIn): Activity {
  return {
    audit: {
      type: 'AUTH_SUCCESS',
      message: `Operator signed in (${input.displayName}) via ${methodLabel(input.method)}`,
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: input.replaced ? { method: input.method, replaced: true } : { method: input.method },
    },
    event: {
      type: 'AUTH_LOGIN',
      message: `${input.displayName} signed in`,
      severity: 'SUCCESS',
      params: { operatorId: input.operatorId, method: input.method },
      deviceId: input.deviceId,
    },
  };
}

export interface AttemptFailed {
  readonly method: AuthMethodValue;
  /** The operator the username matched, or null. Never a typed username. */
  readonly operatorId: string | null;
  readonly deviceId: string | null;
  readonly attemptsRemaining: number;
  /** Set when this failure locked the console, or the console is locked anyway. */
  readonly lockedUntil: number | null;
  /** True when the matched operator is disabled (ID-4). */
  readonly disabled: boolean;
}

export function attemptFailed(input: AttemptFailed): Activity {
  const locks = input.lockedUntil !== null;
  return {
    audit: {
      type: 'AUTH_FAILED',
      message: locks ? 'Sign-in failed; console locked for 60 s' : 'Sign-in failed: invalid credentials',
      severity: 'WARNING',
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: {
        method: input.method,
        knownOperator: input.operatorId !== null,
        attemptsRemaining: input.attemptsRemaining,
        lockedUntil: input.lockedUntil,
        ...(input.disabled ? { reason: 'USER_DISABLED' } : {}),
      },
    },
    event: {
      type: 'AUTH_FAILED',
      message: locks ? 'Sign-in failed — console locked for 60 s' : 'Sign-in failed',
      severity: 'WARNING',
      params: { attemptsRemaining: input.attemptsRemaining },
      deviceId: input.deviceId,
    },
  };
}

export interface AttemptLocked {
  readonly method: AuthMethodValue;
  /** The operator the username matched, or null. The attempt itself is not verified. */
  readonly operatorId: string | null;
  readonly deviceId: string | null;
  readonly lockedUntil: number;
  readonly retryInMs: number;
}

export function attemptLocked(input: AttemptLocked): Activity {
  return {
    audit: {
      type: 'AUTH_LOCKED',
      message: 'Sign-in rejected: console locked after repeated failures',
      severity: 'WARNING',
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: { method: input.method, retryInMs: input.retryInMs, lockedUntil: input.lockedUntil },
    },
    event: {
      type: 'AUTH_LOCKED',
      message: 'Sign-in rejected — console locked',
      severity: 'WARNING',
      params: { retryInMs: input.retryInMs },
      deviceId: input.deviceId,
    },
  };
}

export interface SignedOut {
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly reason: SignOutReason;
}

export function signedOut(input: SignedOut): Activity {
  const locked = input.reason === 'LOCK';
  return {
    audit: {
      type: 'AUTH_SIGNED_OUT',
      message: locked ? 'Console locked by operator' : 'Operator signed out',
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: { reason: input.reason },
    },
    event: {
      type: 'AUTH_LOGOUT',
      message: locked ? 'Console locked' : 'Operator signed out',
      params: { operatorId: input.operatorId, reason: input.reason },
      deviceId: input.deviceId,
    },
  };
}

/** `details.reason` of an `AUTH_EXPIRED` row (ID-8). */
export type ExpiryReason = 'IDLE' | 'ABSOLUTE';

export interface SessionExpired {
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly reason: ExpiryReason;
}

export function sessionExpired(input: SessionExpired): Activity {
  return {
    audit: {
      type: 'AUTH_EXPIRED',
      message:
        input.reason === 'IDLE'
          ? 'Operator session expired after 15 min idle'
          : 'Operator session expired 8 h after sign-in',
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: { reason: input.reason },
    },
    event: {
      type: 'AUTH_EXPIRED',
      message: 'Session expired — sign in again',
      severity: 'WARNING',
      params: { operatorId: input.operatorId },
      deviceId: input.deviceId,
    },
  };
}
