/**
 * Operation 7 `setBiometricEnrollment`: biometric sign-in is turned on or off for the caller on
 * the device of the caller's session (plan row W41; spec §5.6 steps 1 and 8, §7.5; SR-36;
 * database contract §4.10, §5.6 AT-1 to AT-3).
 *
 * WHO MAY CALL is stage 6's: an operator's session that is bound to a device (the access rule
 * `AUTHENTICATED` with the condition `DEVICE_SESSION`). What is left for this file is the rule
 * that depends on the body: turning it ON needs a session that was created by PASSWORD.
 *
 * ON (`enabled: true`), one unit of work `identity.biometric.enrol`:
 *
 *   1  REVOKE_TOKENS.ENROLMENT   whatever the operator had on this device before ends, reason
 *                                `REENROLLED`: at most one token of a pair is usable;
 *   2  ENROL_TOKEN               THE ISSUE IS ONE STATEMENT: the row is inserted only where the
 *                                caller's session is still open, was created by password, belongs
 *                                to an enabled operator and to a PAIRED device. The device and the
 *                                operator of the token are that session row's. The row count
 *                                decides;
 *   3  the audit row             `BIOMETRIC_ENROLLMENT_CHANGED`, `enabled: true`.
 *
 * No row from statement 2: nothing is issued. The unit reads why, throws, and ROLLS BACK, so the
 * enrolment that stood before stands again.
 *
 * OFF (`enabled: false`), one unit `identity.biometric.disable`: every token of the pair is
 * revoked, reason `DISABLED`, with the row when something was revoked. Turning off what is off
 * changes nothing and writes no row. It needs no password session: a session that was created
 * with the token may turn it off (and stays open).
 *
 * THE TOKEN is generated here, returned ONCE in the answer, and stored as its SHA-256. It reaches
 * no row, no event, no publication and no log line (SR-36, NL-2).
 */
import { ApiErrorCode, type BiometricEnrollment } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { notSignedIn } from '../../../plugins/authenticate';
import { ApiFailure } from '../../../plugins/error-envelope';
import { deviceRevoked } from '../console';
import { enrolmentChanged } from './activity';
import { enrolToken, readEnrolmentSession, revokeBiometricTokens, type EnrolmentSession } from './store';
import { BIOMETRIC_TOKEN_LIFETIME_MS, biometricTokenHash, newBiometricToken, newFamilyId } from './tokens';

/** The labels of the two units. They appear in the pipeline's log lines. */
export const ENROLMENT_UNIT_LABEL = { enrol: 'identity.biometric.enrol', disable: 'identity.biometric.disable' } as const;

/** `details.reason` of the 403 for `enabled: true` in a session that was not created by password. */
export const PASSWORD_SESSION_REQUIRED = 'PASSWORD_SESSION_REQUIRED';

/** The answer the contract defines for a session that is not bound to a device. */
export function notADeviceSession(): ApiFailure {
  return new ApiFailure(403, ApiErrorCode.DEVICE_NOT_PAIRED, 'Biometric sign-in is set up on a paired device.');
}

/** The answer for `enabled: true` in a session that was created with a biometric token (spec §7.5 operation 7). */
export function passwordSessionRequired(): ApiFailure {
  return new ApiFailure(403, ApiErrorCode.DEVICE_NOT_PAIRED, 'Sign in with your password to turn biometric sign-in on.', {
    details: { reason: PASSWORD_SESSION_REQUIRED },
  });
}

/** Why the issuing statement returned no row, as the answer. `session` is what is stored now. */
export function enrolmentRefusal(session: EnrolmentSession | null): ApiFailure {
  // Ended meanwhile (a sign-out, an expiry, a disable), or its operator is disabled: no session.
  if (session === null || !session.open || !session.operatorEnabled) return notSignedIn();
  if (session.deviceState === null) return notADeviceSession();
  if (session.deviceState !== 'PAIRED') return deviceRevoked();
  if (session.method !== 'PASSWORD') return passwordSessionRequired();
  // Every condition of the statement holds now and it returned no row: it did not see this
  // state. Nothing was issued, and the caller signs in again.
  return notSignedIn();
}

/** The caller's session as stage 4 resolved it: the references of the rows, nothing a caller sent. */
export interface EnrolmentCaller {
  readonly sessionId: string;
  readonly operatorId: string;
  readonly deviceId: string;
}

export async function setBiometricEnrollment(app: FastifyInstance, caller: EnrolmentCaller, enabled: boolean): Promise<BiometricEnrollment> {
  const { sessionId, operatorId, deviceId } = caller;

  if (!enabled) {
    await app.pipeline.run(ENROLMENT_UNIT_LABEL.disable, async (unit) => {
      const revoked = await revokeBiometricTokens(unit, { scope: 'ENROLMENT', deviceId, operatorId, reason: 'DISABLED' }, app.clock.now());
      if (revoked > 0) await unit.audit.append(enrolmentChanged({ operatorId, deviceId, enabled: false }));
    });
    return { enabled: false };
  }

  const token = newBiometricToken();
  const expiresAt = await app.pipeline.run(ENROLMENT_UNIT_LABEL.enrol, async (unit) => {
    const now = app.clock.now();
    await revokeBiometricTokens(unit, { scope: 'ENROLMENT', deviceId, operatorId, reason: 'REENROLLED' }, now);
    const enrolled = await enrolToken(unit, {
      tokenHash: biometricTokenHash(token),
      familyId: newFamilyId(),
      sessionId,
      issuedAt: now,
      expiresAt: now + BIOMETRIC_TOKEN_LIFETIME_MS,
    });
    // Nothing was issued: the throw rolls the unit back, the revocation above included.
    if (enrolled === null) throw enrolmentRefusal(await readEnrolmentSession(unit, sessionId));
    await unit.audit.append(enrolmentChanged({ operatorId: enrolled.operatorId, deviceId: enrolled.deviceId, enabled: true }));
    return now + BIOMETRIC_TOKEN_LIFETIME_MS;
  });
  return { enabled: true, token, expiresAt };
}
