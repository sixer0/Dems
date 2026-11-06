/**
 * The biometric token (plan row W41; spec §5.6, §7.5 operations 7 to 9; a part of the identity
 * module, whose `index.ts` registers these routes).
 *
 * The server never accepts a claim that a biometric check passed. It accepts a secret that the
 * device can read only after its operating system released it:
 *
 *   7  setBiometricEnrollment   inside a session created by PASSWORD on a paired device, the
 *                               server makes a token, stores its SHA-256 with the device, the
 *                               operator and a family, and returns it once (`enrolment.ts`);
 *   8  signInWithBiometric      sent with the device's OWN credential (the registry's condition
 *                               `DEVICE_CREDENTIAL`: a session token of the device is refused by
 *                               stage 6). The token is used ONCE: a compare-and-set marks it
 *                               used, the answer carries the session and the NEXT token of the
 *                               family. A token that was used before revokes its family and ends
 *                               the open BIOMETRIC sessions of its device and operator
 *                               (`sign-in.ts`);
 *   9  reportBiometricFailure   one failure toward the device's own lockout and one row; it can
 *                               create nothing (`failure.ts`).
 *
 * Operations 8 and 9 count on the SAME lockout as the password sign-in of that device: the
 * identity module hands its `ConsoleLockout` to `registerBiometricRoutes`.
 *
 * Every state change is one unit of work of the serial pipeline (ENG-23). No file of this
 * folder opens a database connection of its own or starts a timer.
 *
 * FOR THE PAIRING AND THE ADMINISTRATION MODULE: `revokeBiometricTokens(unit, revocation, now)`
 * is the one function that revokes a token, with the scopes `DEVICE` (a device that was revoked
 * or unpaired) and `OPERATOR` (an operator who was disabled) beside the two this folder uses.
 * Nothing has to be called here when a device is retired or an operator is disabled: a token
 * whose `revoked_at` is set signs nobody in.
 *
 * FOR THE REALTIME CHANNEL: after the commit of a reuse this folder publishes
 * `{ kind: 'session.ended', sessionIds, reason: 'TOKEN_REUSE' }` (and the registry's
 * `endBiometricSessions` registers `device.session` for the device). A biometric sign-in ends no
 * other session, so it publishes no `session.ended`: no session is presented with it (decision
 * D118), and the end reason `ROTATED` comes from the password sign-in only. It does publish
 * `device.session` after its commit (FX-C, R4): the operator signed in on the device changed.
 */
export { TokenRefusalReason } from './activity';
export { ENROLMENT_UNIT_LABEL, PASSWORD_SESSION_REQUIRED } from './enrolment';
export { FAILURE_UNIT_LABEL } from './failure';
export { BIOMETRIC_OPERATION_IDS, registerBiometricRoutes, type BiometricOperationId } from './routes';
export { SIGN_IN_UNIT_LABEL, type BiometricServices } from './sign-in';
export { revokeBiometricTokens, type BiometricRevocation, type BiometricRevocationScope } from './store';
export {
  BIOMETRIC_TOKEN_BYTES,
  BIOMETRIC_TOKEN_LIFETIME_MS,
  BIOMETRIC_TOKEN_PREFIX,
  biometricTokenHash,
  newBiometricToken,
} from './tokens';
