/**
 * Simulated authentication (masterplan/01_specs.md §14.8; 04_mobile_specs.md §6; SCR-02).
 *
 * Policy (demo):
 * - 5 failed attempts within a rolling 5 min → locked for 60 s. The sim clock is
 *   authoritative. The lockout is console-wide (every username), so guessing across
 *   accounts does not reset it. It clears when it expires, and a success clears the counter.
 * - Every attempt writes exactly one audit row: AUTH_SUCCESS, AUTH_FAILED or AUTH_LOCKED.
 *   The attempt that reaches the limit is an AUTH_FAILED row whose details say it locked.
 * - Credentials never reach state, events, audit rows or storage (§20.1): an audit row names
 *   the operator ID only when the username matched a known operator; a typed username that
 *   matches nobody is not recorded (it may be a mistyped password).
 * - Idle timeout 15 min → EXPIRED.
 *
 * Everything here is pure: each function returns the changed slices plus the result, and
 * the action layer applies them with one `setState`.
 */
import {
  AUTH_FAILURE_WINDOW_MS,
  AUTH_IDLE_TIMEOUT_MS,
  AUTH_LOCKOUT_MS,
  AUTH_MAX_FAILURES,
  AUTH_TOUCH_MIN_INTERVAL_MS,
} from './constants';
import { DEMO_OPERATOR_PASSWORD, SECURITY_KEY_OPERATOR_ID } from './dataset';
import { SimErrorCode, SimPermissionError } from './errors';
import { appendActivity, type ActivityInput, type ActivitySlices } from './events';
import type {
  AuthLockoutSlice,
  AuthSessionRecord,
  AuthSlice,
  EpochMs,
  SignInResult,
  SimOperator,
  SimState,
} from './types';
import {
  AuthMethod,
  AuthStatus,
  OperatorRole,
  Permission,
  SignOutReason,
} from './vocabulary';

// ── RBAC (§14.7 "Roles", demo assumption 01 G1; S20) ────────────────────────────────────
// Task 3 M2-W6 (register SH-04; D4 OD-10 and OD-15; `C3 §2.1`): the two new permissions are
// granted here exactly as the v2 seed grants them (`rbac.matrix` boot equality, specs C-N9):
// `TRANSCRIPT_REVISE` to INVESTIGATOR (and so to SUPERVISOR, which inherits this list) and
// `CAPTURE_CONFIG` to SUPERVISOR and TECHNICIAN. No existing grant changed.
const INVESTIGATOR_PERMISSIONS = [
  Permission.SESSION_START,
  Permission.SESSION_NOTE,
  Permission.EVIDENCE_VIEW,
  Permission.DIAGNOSTICS_RUN,
  // OD-15: officers correct the transcript; the Core key signs the revision, no approval flow.
  Permission.TRANSCRIPT_REVISE,
] as const;

export const ROLE_PERMISSIONS = {
  INVESTIGATOR: INVESTIGATOR_PERMISSIONS,
  SUPERVISOR: [
    ...INVESTIGATOR_PERMISSIONS,
    Permission.EVIDENCE_REVIEW,
    Permission.EVIDENCE_EXPORT,
    Permission.AUDIT_EXPORT,
    // Backend task W16 (2026-10-04 01_specs §4.4, §19.1): additive grants, enforced by the Core
    // server. No simulator action checks them; a screen that lists a role's grants shows them.
    Permission.PAIRING_MANAGE,
    Permission.USER_ADMIN,
    Permission.DEMO_CONTROL,
    // OD-10 held CAPTURE_CONFIG here. REVOKED 2026-10-29 by the product principal (PT GSP):
    // the capture topology is the principal's layer, written by the installing technician
    // (TECHNICIAN: CAPTURE_CONFIG + CAPTURE_COMMISSION + DEVICE_MANAGE), never by an operating
    // role. The supervisor keeps operations 76 and 77 (`AUTHENTICATED_ACCESS`: every role may
    // read the selector and the device registry) - exactly the duty of verifying that a camera is
    // attached and running - and loses the writes 78 / 79 / 89 / 95 / 96 and the credential and
    // commissioning probes that name CAPTURE_CONFIG alone (15 operations: denied cells 13 -> 28).
    // Migration `0034` removes the stored grant from databases seeded before this change (the
    // `0018` exception class: the boot refuses a stored matrix that differs from this table).
    // C3 §4's line for CAPTURE_CONFIG now names TECHNICIAN only; see AC-B-16 counts below.
  ],
  TECHNICIAN: [
    Permission.EVIDENCE_VIEW,
    Permission.DEVICE_MANAGE,
    Permission.DIAGNOSTICS_RUN,
    Permission.MAINTENANCE,
    // OD-10: a technician configures the capture devices; it never starts a session.
    Permission.CAPTURE_CONFIG,
    // Task 4 row 100 (decision U10): the commissioning functions of the camera network are the
    // technician's alone. No other role holds this; the stored grant is the one row of `0018`.
    Permission.CAPTURE_COMMISSION,
  ],
} as const satisfies Record<OperatorRole, readonly Permission[]>;

export function roleHas(role: OperatorRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
}

/**
 * The signed-in operator, who must hold one of `permissions` (step 54, review 40 M5, W52-6).
 * Throws `SimPermissionError` with code NOT_SIGNED_IN or NOT_PERMITTED; returns the operator.
 */
export function requirePermission(
  state: Pick<SimState, 'auth' | 'operators'>,
  action: string,
  ...permissions: Permission[]
): SimOperator {
  const label = permissions.join(' | ');
  const operator =
    state.auth.status === AuthStatus.SIGNED_IN ? findOperatorById(state.operators, state.auth.operatorId) : null;
  if (!operator) throw new SimPermissionError(action, label, SimErrorCode.NOT_SIGNED_IN);
  if (!permissions.some((permission) => roleHas(operator.role, permission))) {
    throw new SimPermissionError(action, label, SimErrorCode.NOT_PERMITTED);
  }
  return operator;
}

// ── Operators ────────────────────────────────────────────────────────────────────────────
export function findOperatorById(
  operators: readonly SimOperator[],
  operatorId: string | null | undefined,
): SimOperator | null {
  if (!operatorId) return null;
  return operators.find((operator) => operator.id === operatorId) ?? null;
}

export function findOperatorByUsername(
  operators: readonly SimOperator[],
  username: string,
): SimOperator | null {
  const wanted = username.trim().toLowerCase();
  if (!wanted) return null;
  return operators.find((operator) => operator.username === wanted) ?? null;
}

export function signedOutAuth(status: AuthStatus = AuthStatus.SIGNED_OUT): AuthSlice {
  return { status, operatorId: null, method: null, issuedAt: null, lastActivityAt: null };
}

// ── Lockout ──────────────────────────────────────────────────────────────────────────────
export interface LockoutStatus {
  locked: boolean;
  lockedUntil: EpochMs | null;
  retryInMs: number;
  /** Failures left before the lockout (the "attempts remaining" copy). */
  attemptsRemaining: number;
}

function recentFailures(lockout: AuthLockoutSlice, now: EpochMs): EpochMs[] {
  return lockout.failures.filter((at) => now - at < AUTH_FAILURE_WINDOW_MS);
}

export function lockoutStatus(lockout: AuthLockoutSlice, now: EpochMs): LockoutStatus {
  if (lockout.lockedUntil !== null && now < lockout.lockedUntil) {
    return {
      locked: true,
      lockedUntil: lockout.lockedUntil,
      retryInMs: lockout.lockedUntil - now,
      attemptsRemaining: 0,
    };
  }
  const failures = lockout.lockedUntil !== null ? [] : recentFailures(lockout, now);
  return {
    locked: false,
    lockedUntil: null,
    retryInMs: 0,
    attemptsRemaining: Math.max(0, AUTH_MAX_FAILURES - failures.length),
  };
}

// ── Transitions ──────────────────────────────────────────────────────────────────────────
export type AuthSlices = ActivitySlices & Pick<SimState, 'auth' | 'authLockout'>;

export interface AuthTransition {
  patch: Partial<AuthSlices>;
  result: SignInResult;
  /** Operator record to store (`dems.auth`): a record to save, null to clear, undefined to keep. */
  record: AuthSessionRecord | null | undefined;
}

type AuthState = Pick<SimState, 'auth' | 'authLockout' | 'audit' | 'events' | 'meta' | 'operators'>;

function methodLabel(method: AuthMethod): string {
  switch (method) {
    case AuthMethod.BIOMETRIC:
      return 'biometric';
    case AuthMethod.SECURITY_KEY:
      return 'security key (simulated)';
    default:
      return 'password';
  }
}

/**
 * The shared attempt path. `operator` is the claimed identity (null when the username
 * matched nobody); `verified` says whether the credential proved it.
 */
function attempt(
  state: AuthState,
  now: EpochMs,
  method: AuthMethod,
  operator: SimOperator | null,
  verified: boolean,
): AuthTransition {
  const status = lockoutStatus(state.authLockout, now);

  if (status.locked && status.lockedUntil !== null) {
    const activity = appendActivity(state, now, {
      audit: {
        type: 'AUTH_LOCKED',
        message: 'Sign-in rejected: console locked after repeated failures',
        severity: 'WARNING',
        actorId: operator?.id ?? null,
        details: { method, retryInMs: status.retryInMs, lockedUntil: status.lockedUntil },
      },
      event: {
        type: 'AUTH_LOCKED',
        message: 'Sign-in rejected — console locked',
        severity: 'WARNING',
        params: { retryInMs: status.retryInMs },
      },
    });
    return {
      patch: activity,
      result: {
        ok: false,
        reason: 'LOCKED',
        lockedUntil: status.lockedUntil,
        retryInMs: status.retryInMs,
      },
      record: undefined,
    };
  }

  // An expired lockout starts a fresh count.
  const baseFailures =
    state.authLockout.lockedUntil !== null ? [] : recentFailures(state.authLockout, now);

  if (verified && operator) {
    const activity = appendActivity(state, now, {
      audit: {
        type: 'AUTH_SUCCESS',
        message: `Operator signed in (${operator.displayName}) via ${methodLabel(method)}`,
        actorId: operator.id,
        details: { method },
      },
      event: {
        type: 'AUTH_LOGIN',
        message: `${operator.displayName} signed in`,
        severity: 'SUCCESS',
        params: { operatorId: operator.id, method },
      },
    });
    return {
      patch: {
        ...activity,
        auth: {
          status: AuthStatus.SIGNED_IN,
          operatorId: operator.id,
          method,
          issuedAt: now,
          lastActivityAt: now,
        },
        authLockout: { failures: [], lockedUntil: null },
      },
      result: { ok: true, operatorId: operator.id, role: operator.role, method },
      record: { operatorId: operator.id, issuedAt: now },
    };
  }

  const failures = [...baseFailures, now];
  const locks = failures.length >= AUTH_MAX_FAILURES;
  const lockedUntil = locks ? now + AUTH_LOCKOUT_MS : null;
  const attemptsRemaining = Math.max(0, AUTH_MAX_FAILURES - failures.length);
  const activity = appendActivity(state, now, {
    audit: {
      type: 'AUTH_FAILED',
      message: locks
        ? 'Sign-in failed; console locked for 60 s'
        : 'Sign-in failed: invalid credentials',
      severity: 'WARNING',
      actorId: operator?.id ?? null,
      details: {
        method,
        knownOperator: operator !== null,
        attemptsRemaining,
        lockedUntil,
      },
    },
    event: {
      type: 'AUTH_FAILED',
      message: locks ? 'Sign-in failed — console locked for 60 s' : 'Sign-in failed',
      severity: 'WARNING',
      params: { attemptsRemaining },
    },
  });
  return {
    patch: {
      ...activity,
      authLockout: locks ? { failures: [], lockedUntil } : { failures, lockedUntil: null },
    },
    result:
      locks && lockedUntil !== null
        ? { ok: false, reason: 'LOCKED', lockedUntil, retryInMs: AUTH_LOCKOUT_MS }
        : { ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining },
    record: undefined,
  };
}

export function passwordSignIn(
  state: AuthState,
  now: EpochMs,
  username: string,
  password: string,
): AuthTransition {
  const operator = findOperatorByUsername(state.operators, username);
  return attempt(state, now, AuthMethod.PASSWORD, operator, operator !== null && password === DEMO_OPERATOR_PASSWORD);
}

/** The OS confirmed the fingerprint (04 §6.3); the simulator trusts that result. */
export function biometricSignIn(state: AuthState, now: EpochMs, operatorId: string): AuthTransition {
  const operator = findOperatorById(state.operators, operatorId);
  return attempt(state, now, AuthMethod.BIOMETRIC, operator, operator !== null);
}

/** The OS reported `authentication_failed`: one failure toward the lockout. */
export function biometricFailure(
  state: AuthState,
  now: EpochMs,
  operatorId: string | null,
): AuthTransition {
  return attempt(state, now, AuthMethod.BIOMETRIC, findOperatorById(state.operators, operatorId), false);
}

/** "Use security key (simulated)": signs in as the SUPERVISOR operator (D28/Q15). */
export function securityKeySignIn(state: AuthState, now: EpochMs): AuthTransition {
  const operator = findOperatorById(state.operators, SECURITY_KEY_OPERATOR_ID);
  return attempt(state, now, AuthMethod.SECURITY_KEY, operator, operator !== null);
}

export function signOutTransition(
  state: AuthState,
  now: EpochMs,
  reason: SignOutReason = SignOutReason.USER,
): Partial<AuthSlices> | null {
  const operatorId = state.auth.operatorId;
  if (state.auth.status !== AuthStatus.SIGNED_IN || !operatorId) {
    return state.auth.status === AuthStatus.SIGNED_OUT ? null : { auth: signedOutAuth() };
  }
  const item: ActivityInput = {
    audit: {
      type: 'AUTH_SIGNED_OUT',
      message: reason === SignOutReason.LOCK ? 'Console locked by operator' : 'Operator signed out',
      actorId: operatorId,
      details: { reason },
    },
    event: {
      type: 'AUTH_LOGOUT',
      message: reason === SignOutReason.LOCK ? 'Console locked' : 'Operator signed out',
      params: { operatorId, reason },
    },
  };
  return { ...appendActivity(state, now, item), auth: signedOutAuth() };
}

/** SIGNED_IN with no activity for 15 min → EXPIRED ("session expired"). */
export function expireIfIdle(state: AuthState, now: EpochMs): Partial<AuthSlices> | null {
  const { auth } = state;
  if (auth.status !== AuthStatus.SIGNED_IN || auth.lastActivityAt === null) return null;
  if (now - auth.lastActivityAt < AUTH_IDLE_TIMEOUT_MS) return null;
  const activity = appendActivity(state, now, {
    audit: {
      type: 'AUTH_EXPIRED',
      message: 'Operator session expired after 15 min idle',
      actorId: auth.operatorId,
    },
    event: {
      type: 'AUTH_EXPIRED',
      message: 'Session expired — sign in again',
      severity: 'WARNING',
      params: { operatorId: auth.operatorId },
    },
  });
  return { ...activity, auth: signedOutAuth(AuthStatus.EXPIRED) };
}

/** Records activity, at most once per second. Null when nothing changes. */
export function touchTransition(state: Pick<SimState, 'auth'>, now: EpochMs): Pick<SimState, 'auth'> | null {
  const { auth } = state;
  if (auth.status !== AuthStatus.SIGNED_IN) return null;
  if (auth.lastActivityAt !== null && now - auth.lastActivityAt < AUTH_TOUCH_MIN_INTERVAL_MS) {
    return null;
  }
  return { auth: { ...auth, lastActivityAt: now } };
}

/** Restores a stored operator record (a reload), if the operator exists. */
export function restoreAuth(
  operators: readonly SimOperator[],
  record: AuthSessionRecord | null,
  now: EpochMs,
): AuthSlice {
  const operator = record ? findOperatorById(operators, record.operatorId) : null;
  if (!record || !operator) return signedOutAuth();
  return {
    status: AuthStatus.SIGNED_IN,
    operatorId: operator.id,
    method: null,
    issuedAt: record.issuedAt,
    lastActivityAt: now,
  };
}
