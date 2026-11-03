/**
 * Area 1 of the Core API: identity and sign-in (backend task: 2026-10-04 01_specs §5, §7.5, §7.18).
 *
 * Eight operations, answered by the Core server only. Identity is server-native: the simulator's
 * sign-in actions, its idle expiry and its lockout slice are not used in Live mode.
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 2 | `signIn` | PUBLIC plus the console rule ID-1 | AUTH_SUCCESS (a failure: AUTH_FAILED or AUTH_LOCKED) |
 * | 3 | `getSignInStatus` | PUBLIC | NONE-R |
 * | 4 | `getAuthSession` | AUTHENTICATED | NONE-R |
 * | 5 | `signOut` | AUTHENTICATED | AUTH_SIGNED_OUT |
 * | 6 | `touchSession` | AUTHENTICATED | NONE-P |
 * | 7 | `setBiometricEnrollment` | AUTHENTICATED, on a device session | BIOMETRIC_ENROLLMENT_CHANGED |
 * | 8 | `signInWithBiometric` | DEVICE | AUTH_SUCCESS (a failure: AUTH_FAILED or AUTH_LOCKED) |
 * | 9 | `reportBiometricFailure` | DEVICE | AUTH_FAILED (AUTH_LOCKED while locked) |
 *
 * Time is epoch milliseconds on the server clock (API-5). Every free-text member carries the text
 * rule (`text.ts`, API-13), the password included (D30 D-b).
 *
 * Secrets: the bodies of operations 2, 7 and 8 hold one (a password, a biometric token, a session
 * token). The schemas describe their form; the examples show placeholders only.
 */
import { z } from 'zod';
import { AuditType, AuthMethod, OperatorRole, Permission, SignOutReason } from '../sim/vocabulary';
import { API_BASE_PATH } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAccessCondition,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  DEVICE_ACCESS,
  DEVICE_CREDENTIAL_REQUIRED_REASON,
  PASSWORD_SESSION_REQUIRED_REASON,
  PUBLIC_ACCESS,
  type CoreApiRegistryOperation,
} from './contract-model';
import {
  ERROR_EXAMPLES,
  EXAMPLE_INSTANT_MS,
  EXAMPLE_PLACEHOLDERS,
  SERVER_EXAMPLE_IDS,
  apiErrorExample,
  exampleTime,
  lockedExample,
} from './example-parts';
import type { OperationExamples } from './examples';
import {
  CORE_SERVER_NOTE,
  DEVICE_CREDENTIAL_REFUSED,
  INVALID_INPUT,
  INVALID_JSON,
  NOT_SIGNED_IN,
  NO_DEVICE_CREDENTIAL,
  SECRET_NOTE,
  backendSource,
  forbidden,
  WEB_SESSION_REFUSED,
} from './operation-parts';
import { BIOMETRIC_TOKEN_PATTERN, SESSION_TOKEN_PATTERN } from './patterns';
import { count, deviceId, displayText, epochMs, nullableEpochMs, operatorId } from './schema-parts';
import { apiText } from './text';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Limits of the sign-in input (ID-P10). Forms set `maxLength` from these. */
export const SIGN_IN_LIMITS = {
  usernameMax: 64,
  /**
   * Counted in UTF-16 code units (D30 D-a), which is what the server's password hash wrapper
   * counts (`password.length`). zod's `.max()` counts code points, so the schema adds the
   * code-unit bound itself: a password of 65 astral characters is 130 units and is refused.
   */
  passwordMax: 128,
  /** A bearer secret is 47 characters; this bounds a request member that carries one. */
  tokenMax: 256,
} as const;

/**
 * ID-P11: a biometric token is valid this long after its issue, 30 days (W83, gap W41-1). The
 * answer of `signInWithBiometric` carries the rotated token without its expiry: it is this long after
 * the new session's `issuedAt`.
 */
export const BIOMETRIC_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60_000;

/**
 * `details.reason` of the AUTH_FAILED row of a refused biometric token (W83, gap W41-4). The
 * caller's answer is the same generic `401 INVALID_CREDENTIALS` for all of them; the row is for whoever
 * reads the trail.
 */
export const BiometricTokenRefusalReason = {
  /** The token was used before, or it is live and another paired device presented it. The row also carries `sessionsEnded`. */
  TOKEN_REUSE: 'TOKEN_REUSE',
  /** The operator is disabled, or the token was revoked when the operator was disabled. */
  USER_DISABLED: 'USER_DISABLED',
  /** The token was revoked: turned off, replaced by a new enrolment, a reused family, a retired device. */
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  /** The token was not used within `BIOMETRIC_TOKEN_LIFETIME_MS`. */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** A token of another device that is no longer live (revoked or expired). */
  OTHER_DEVICE: 'OTHER_DEVICE',
  /** The token was right and its device is no longer PAIRED. */
  DEVICE_NOT_PAIRED: 'DEVICE_NOT_PAIRED',
} as const;
export type BiometricTokenRefusalReason = (typeof BiometricTokenRefusalReason)[keyof typeof BiometricTokenRefusalReason];


/** Message of the code-unit bound of the password. It quotes no input. */
export const PASSWORD_TOO_LONG_MESSAGE = `The password is longer than ${SIGN_IN_LIMITS.passwordMax} UTF-16 code units.`;

export const SignInRequestSchema = z
  .object({
    username: apiText()
      .min(1)
      .max(SIGN_IN_LIMITS.usernameMax)
      .describe('Operator username, e.g. `budi.santoso`. The server trims and lower-cases it before the lookup (ID-2).'),
    password: apiText()
      .min(1)
      .max(SIGN_IN_LIMITS.passwordMax)
      .refine((value) => value.length <= SIGN_IN_LIMITS.passwordMax, { error: PASSWORD_TOO_LONG_MESSAGE })
      .describe(
        `The password: 1 to ${SIGN_IN_LIMITS.passwordMax} UTF-16 code units, taken as sent (ID-P10). It travels in this body only and is never logged, stored or echoed.`,
      ),
  })
  .describe('Request body of `POST /api/v1/auth/sign-in`.');
export type SignInRequest = z.output<typeof SignInRequestSchema>;

export const OperatorSchema = z
  .object({
    id: operatorId().describe('Operator ID `OPR-NNN`. Never a username.'),
    username: displayText(),
    rank: apiText().nullable().describe('e.g. "AKP"; null when the operator has no rank.'),
    name: displayText(),
    displayName: displayText().describe('Rank and name, e.g. "AKP Andi Pratama".'),
    initials: displayText(),
    role: z.enum(OperatorRole),
  })
  .describe('An operator, with the members of the simulator\'s `operators` slice. Seeded and synthetic.');
export type OperatorBody = z.output<typeof OperatorSchema>;

export const AuthSessionInfoSchema = z
  .strictObject({
    operator: OperatorSchema,
    permissions: z
      .array(z.enum(Permission))
      .describe('The permissions of the operator\'s role as read for this request (RB-3). A display hint: the server decides every call.'),
    method: z
      .enum([AuthMethod.PASSWORD, AuthMethod.BIOMETRIC])
      .describe('How the session was created. No Live session has the simulated security key.'),
    issuedAt: epochMs(),
    lastActivityAt: epochMs().describe('Last POST or `touchSession` (ID-P9). GET requests and the socket do not count.'),
    idleExpiresAt: epochMs().describe('`lastActivityAt` plus 15 minutes.'),
    absoluteExpiresAt: epochMs().describe('`issuedAt` plus 8 hours; activity does not move it.'),
    deviceId: deviceId().nullable().describe('The paired device the session is bound to; null for a web console session.'),
    demoControls: z.boolean().describe('True when the server-side demo flag is on (DC-3), so a client can hide the panel.'),
    serverTime: epochMs(),
  })
  .describe('The caller\'s own auth session.');
export type AuthSessionInfo = z.output<typeof AuthSessionInfoSchema>;

export const SignInResponseSchema = z
  .strictObject({
    session: AuthSessionInfoSchema,
    sessionToken: z
      .string()
      .regex(SESSION_TOKEN_PATTERN)
      .optional()
      .describe('Device sign-in only, returned once: the bearer value of this session. A web console gets the cookie instead and no token.'),
    biometricToken: z
      .string()
      .regex(BIOMETRIC_TOKEN_PATTERN)
      .optional()
      .describe(
        '`signInWithBiometric` only: the rotated token for the next biometric sign-in. The one that was sent is used up. It expires `BIOMETRIC_TOKEN_LIFETIME_MS` (30 days) after `session.issuedAt`.',
      ),
  })
  .describe('Result of a sign-in.');
export type SignInResponse = z.output<typeof SignInResponseSchema>;

export const SignInStatusSchema = z
  .strictObject({
    locked: z.boolean(),
    lockedUntil: nullableEpochMs().describe('End of the 60 s lock; null when not locked.'),
    retryInMs: count().describe('0 when not locked.'),
    attemptsRemaining: count().describe('Failures left before the lock (5 within 5 minutes).'),
    serverTime: epochMs(),
  })
  .describe('Lock state of one console: the members of the simulator\'s `LockoutStatus`, plus the server time.');
export type SignInStatus = z.output<typeof SignInStatusSchema>;

export const SignOutRequestSchema = z
  .object({
    reason: z
      .enum(SignOutReason)
      .optional()
      .describe('`USER` (the avatar menu; the default) or `LOCK` ("Lock console"). Written to the audit row.'),
  })
  .describe('Optional request body of `POST /api/v1/auth/sign-out`.');
export type SignOutRequest = z.output<typeof SignOutRequestSchema>;

export const AuthSessionExpirySchema = z
  .strictObject({
    idleExpiresAt: epochMs(),
    absoluteExpiresAt: epochMs(),
  })
  .describe('The two expiry times of the caller\'s session after a touch.');
export type AuthSessionExpiry = z.output<typeof AuthSessionExpirySchema>;

export const BiometricEnrollmentRequestSchema = z
  .object({
    enabled: z.boolean().describe('`true` enrols (needs a session created by password); `false` revokes the token family.'),
  })
  .describe('Request body of `POST /api/v1/auth/biometric`.');
export type BiometricEnrollmentRequest = z.output<typeof BiometricEnrollmentRequestSchema>;

export const BiometricEnrollmentSchema = z
  .strictObject({
    enabled: z.boolean(),
    token: z
      .string()
      .regex(BIOMETRIC_TOKEN_PATTERN)
      .optional()
      .describe('After `enabled: true` only, returned once: the token the app keeps in the device\'s protected storage.'),
    expiresAt: epochMs().optional().describe('After `enabled: true` only: the issue plus `BIOMETRIC_TOKEN_LIFETIME_MS`, 30 days (ID-P11).'),
  })
  .describe('Biometric sign-in of the caller on this device.');
export type BiometricEnrollment = z.output<typeof BiometricEnrollmentSchema>;

export const BiometricSignInRequestSchema = z
  .object({
    token: apiText()
      .min(1)
      .max(SIGN_IN_LIMITS.tokenMax)
      .describe('The token the biometric prompt released. Every value that is sent counts as an attempt; the form is not checked here.'),
  })
  .describe('Request body of `POST /api/v1/auth/biometric/sign-in`.');
export type BiometricSignInRequest = z.output<typeof BiometricSignInRequestSchema>;

export const BiometricFailureRequestSchema = z
  .object({
    operatorId: operatorId()
      .nullable()
      .describe('The operator the app believes was trying to sign in, or null. The server does not take it as an actor (SR-37, SR-65).'),
  })
  .describe('Request body of `POST /api/v1/auth/biometric/failure`.');
export type BiometricFailureRequest = z.output<typeof BiometricFailureRequestSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const IDENTITY_SCHEMAS = {
  SignInRequest: SignInRequestSchema,
  Operator: OperatorSchema,
  AuthSessionInfo: AuthSessionInfoSchema,
  SignInResponse: SignInResponseSchema,
  SignInStatus: SignInStatusSchema,
  SignOutRequest: SignOutRequestSchema,
  AuthSessionExpiry: AuthSessionExpirySchema,
  BiometricEnrollmentRequest: BiometricEnrollmentRequestSchema,
  BiometricEnrollment: BiometricEnrollmentSchema,
  BiometricSignInRequest: BiometricSignInRequestSchema,
  BiometricFailureRequest: BiometricFailureRequestSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.5';
const AUTH_PATH = `${API_BASE_PATH}/auth`;
const AUTH_ATTEMPT_ROWS = [AuditType.AUTH_FAILED, AuditType.AUTH_LOCKED] as const;

const LOCKED = {
  description:
    'The console is locked after 5 failures within 5 minutes (LOCKED), for 60 s; `details.lockedUntil` and `details.retryInMs` say how long. The failure that locks the console also answers 423; it was verified and writes AUTH_FAILED with `details.lockedUntil`. An attempt during the lock is not verified and writes AUTH_LOCKED.',
  schema: 'ApiError',
} as const;

export const IDENTITY_OPERATIONS = [
  {
    operationId: 'signIn',
    method: 'post',
    path: `${AUTH_PATH}/sign-in`,
    tag: CoreApiTag.IDENTITY,
    mode: CoreApiMode.LIVE,
    summary: 'Sign in',
    description: [
      'Creates an auth session from a username and a password. It is accepted from exactly two kinds of caller (ID-1):',
      [
        '- a **web console**: the request carries a web console `Origin` and no `Authorization` header. The session is delivered only as an `HttpOnly` cookie; the body holds no token.',
        '- a **paired device**: the request carries the device credential as `Authorization: Bearer`. The session token is returned once in `sessionToken` and is bound to that device; no cookie is set.',
      ].join('\n'),
      'Any other caller gets `403 DEVICE_NOT_PAIRED`: pairing is mandatory for everything that is not a web console.',
      'An unknown username, a wrong password and a disabled operator give the same `401 INVALID_CREDENTIALS`, with `details.attemptsRemaining`. Every attempt writes exactly one audit row: AUTH_SUCCESS, AUTH_FAILED or AUTH_LOCKED. A valid session presented with the request is ended (rotation, ID-6).',
      SECRET_NOTE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 2),
    requestBody: { schema: 'SignInRequest', required: true },
    responses: {
      200: { description: 'Signed in. A device also gets `sessionToken`; a web console gets `Set-Cookie`.', schema: 'SignInResponse' },
      400: INVALID_JSON,
      401: {
        description:
          'Sign-in failed (INVALID_CREDENTIALS; the same answer for every cause, ID-3), or the request carried two credentials (NOT_SIGNED_IN, `details.reason: CREDENTIAL_CONFLICT`).',
        schema: 'ApiError',
      },
      403: forbidden('the caller is neither a web console nor a paired device (DEVICE_NOT_PAIRED)'),
      422: INVALID_INPUT,
      423: LOCKED,
    },
    access: { ...PUBLIC_ACCESS, conditions: [CoreApiAccessCondition.CONSOLE_IDENTITY] },
    audit: { success: AuditType.AUTH_SUCCESS, denial: AuditType.ACCESS_DENIED, also: AUTH_ATTEMPT_ROWS },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getSignInStatus',
    method: 'get',
    path: `${AUTH_PATH}/status`,
    tag: CoreApiTag.IDENTITY,
    mode: CoreApiMode.LIVE,
    summary: 'Sign-in lock state',
    description: [
      'The lock state of one console, so that a login screen can show the lock after a reload. It issues nothing and needs no console identity.',
      'It reads the device\'s lock state when the request carries a valid device credential, and the web console\'s otherwise (ID-1, OP-1).',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 3),
    responses: {
      200: { description: 'The lock state.', schema: 'SignInStatus' },
      403: forbidden(),
    },
    access: PUBLIC_ACCESS,
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getAuthSession',
    method: 'get',
    path: `${AUTH_PATH}/session`,
    tag: CoreApiTag.IDENTITY,
    mode: CoreApiMode.LIVE,
    summary: 'Own auth session',
    description: [
      'The caller\'s own session: the operator, the permissions of the role as read for this request (RB-3), the expiry times, the device it is bound to and whether the demo controls are enabled (DC-3).',
      'A web console calls it at start to learn whether its cookie still resolves.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 4),
    responses: {
      200: { description: 'The session.', schema: 'AuthSessionInfo' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'signOut',
    method: 'post',
    path: `${AUTH_PATH}/sign-out`,
    tag: CoreApiTag.IDENTITY,
    mode: CoreApiMode.LIVE,
    summary: 'Sign out',
    description: [
      'Ends the caller\'s own session, closes its sockets (`session.ended`, then close 4401) and, for a web console, clears the cookie.',
      '`reason` is `USER` (the default) or `LOCK` ("Lock console"). Writes AUTH_SIGNED_OUT with that reason.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 5),
    requestBody: { schema: 'SignOutRequest', required: false },
    responses: {
      204: { description: 'Signed out; the cookie is cleared.' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: forbidden(),
      422: INVALID_INPUT,
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: AuditType.AUTH_SIGNED_OUT, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'touchSession',
    method: 'post',
    path: `${AUTH_PATH}/touch`,
    tag: CoreApiTag.IDENTITY,
    mode: CoreApiMode.LIVE,
    summary: 'Mark activity',
    description: [
      'Marks activity, so that the idle timeout of 15 minutes starts again (ID-P4, ID-P9). The absolute timeout of 8 hours from issue is not moved.',
      'GET requests and the socket do not extend a session, so an open page cannot keep itself alive; a client sends this at most once a minute while the operator is active. Writes no audit row.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 6),
    responses: {
      200: { description: 'The new expiry times.', schema: 'AuthSessionExpiry' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.PARITY, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'setBiometricEnrollment',
    method: 'post',
    path: `${AUTH_PATH}/biometric`,
    tag: CoreApiTag.IDENTITY,
    mode: CoreApiMode.LIVE,
    summary: 'Turn biometric sign-in on or off',
    description: [
      'Turns biometric sign-in on or off for the caller on the device of this session (§5.6).',
      [
        '- `enabled: true` needs a session that was created **by password**. The answer carries a single-use token once; the app keeps it in the device\'s protected storage, where only the biometric prompt releases it.',
        '- `enabled: false` revokes the token family. Revoking the device, unpairing it and disabling the user revoke it too.',
      ].join('\n'),
      'A session that is not bound to a device gets `403 DEVICE_NOT_PAIRED`. Writes BIOMETRIC_ENROLLMENT_CHANGED.',
      SECRET_NOTE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 7),
    requestBody: { schema: 'BiometricEnrollmentRequest', required: true },
    responses: {
      200: { description: 'The enrolment after the change.', schema: 'BiometricEnrollment' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: forbidden(
        `the session is not bound to a device, or \`enabled: true\` was sent on a session that was not created by password (DEVICE_NOT_PAIRED with \`details.reason: ${PASSWORD_SESSION_REQUIRED_REASON}\`)`,
      ),
      422: INVALID_INPUT,
    },
    access: { ...AUTHENTICATED_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_SESSION] },
    audit: { success: AuditType.BIOMETRIC_ENROLLMENT_CHANGED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'signInWithBiometric',
    method: 'post',
    path: `${AUTH_PATH}/biometric/sign-in`,
    tag: CoreApiTag.IDENTITY,
    mode: CoreApiMode.LIVE,
    summary: 'Sign in with the biometric token',
    description: [
      'Creates a session from the token that the device\'s biometric prompt released (§5.6). The server never accepts a claim that a biometric check passed; it accepts only the token, sent with the device credential.',
      `The request must present the device credential itself. The session token of an operator who is signed in on this device is refused with \`403 DEVICE_NOT_PAIRED\` (\`details.reason: ${DEVICE_CREDENTIAL_REQUIRED_REASON}\`): a session that is still open must not be able to renew itself with a token.`,
      'Each use rotates the token: the answer carries the next one in `biometricToken`. A token that was already used, or a live one presented by another paired device, revokes its whole family, ends the open biometric sessions of that device and operator, and answers the generic `401 INVALID_CREDENTIALS`.',
      'Every attempt counts toward the device\'s lockout and writes one audit row: AUTH_SUCCESS (`details.method: BIOMETRIC`), AUTH_FAILED or AUTH_LOCKED.',
      SECRET_NOTE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 8),
    requestBody: { schema: 'BiometricSignInRequest', required: true },
    responses: {
      200: { description: 'Signed in; `sessionToken` and the rotated `biometricToken` are returned once.', schema: 'SignInResponse' },
      400: INVALID_JSON,
      401: {
        description:
          'The token is not accepted (INVALID_CREDENTIALS; the same answer for every cause), or the request has no valid device credential (NOT_SIGNED_IN).',
        schema: 'ApiError',
      },
      403: forbidden(WEB_SESSION_REFUSED, DEVICE_CREDENTIAL_REFUSED),
      422: INVALID_INPUT,
      423: LOCKED,
    },
    access: { ...DEVICE_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL] },
    audit: { success: AuditType.AUTH_SUCCESS, denial: AuditType.ACCESS_DENIED, also: AUTH_ATTEMPT_ROWS },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'reportBiometricFailure',
    method: 'post',
    path: `${AUTH_PATH}/biometric/failure`,
    tag: CoreApiTag.IDENTITY,
    mode: CoreApiMode.LIVE,
    summary: 'Report a failed biometric check',
    description: [
      'Reports that the operating system\'s biometric check failed on this device. It adds one failure toward the device\'s lockout and writes one AUTH_FAILED row (AUTH_LOCKED while locked). It can never create a session.',
      '`operatorId` is the operator the app believes was trying to sign in. The row names that operator only when a biometric token of this device and that operator exists; otherwise the actor is null and the row carries the device ID only (SR-37).',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 9),
    requestBody: { schema: 'BiometricFailureRequest', required: true },
    responses: {
      200: { description: 'The device\'s lock state after the failure was counted.', schema: 'SignInStatus' },
      400: INVALID_JSON,
      401: NO_DEVICE_CREDENTIAL,
      403: forbidden(WEB_SESSION_REFUSED),
      422: INVALID_INPUT,
    },
    access: DEVICE_ACCESS,
    audit: { success: AuditType.AUTH_FAILED, denial: AuditType.ACCESS_DENIED, also: [AuditType.AUTH_LOCKED] },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The SUPERVISOR of the canonical dataset (`sim/dataset.ts` `OPERATORS`). */
export const EXAMPLE_SUPERVISOR: OperatorBody = {
  id: 'OPR-002',
  username: 'andi.pratama',
  rank: 'AKP',
  name: 'Andi Pratama',
  displayName: 'AKP Andi Pratama',
  initials: 'AP',
  role: 'SUPERVISOR',
};
/** The INVESTIGATOR of the canonical dataset. */
export const EXAMPLE_INVESTIGATOR: OperatorBody = {
  id: 'OPR-001',
  username: 'budi.santoso',
  rank: 'AKP',
  name: 'Budi Santoso',
  displayName: 'AKP Budi Santoso',
  initials: 'BS',
  role: 'INVESTIGATOR',
};

const IDLE_MS = 15 * 60_000;
const ABSOLUTE_MS = 8 * 60 * 60_000;

/** A web console session of the SUPERVISOR, signed in five minutes before the example instant. */
const WEB_SESSION: AuthSessionInfo = {
  operator: EXAMPLE_SUPERVISOR,
  // The SUPERVISOR's grants as the enforced table has them (sim/auth.ts ROLE_PERMISSIONS.SUPERVISOR;
  // the 0034 revocation of CAPTURE_CONFIG on 2026-10-29 is reflected here). Deliberately a literal:
  // importing the table would pull sim/dataset into the api barrel, and the Live source must stay
  // platform-neutral (see live-source-platform-neutral.test.ts). api-examples.test.ts is the pin
  // that keeps this list from drifting from the table again.
  permissions: [
    'SESSION_START',
    'SESSION_NOTE',
    'EVIDENCE_VIEW',
    'DIAGNOSTICS_RUN',
    // OD-15 (SH-04): a supervisor inherits the investigator's revise grant.
    'TRANSCRIPT_REVISE',
    'EVIDENCE_REVIEW',
    'EVIDENCE_EXPORT',
    'AUDIT_EXPORT',
    'PAIRING_MANAGE',
    'USER_ADMIN',
    'DEMO_CONTROL',
  ],
  method: 'PASSWORD',
  issuedAt: exampleTime(-5),
  lastActivityAt: exampleTime(-1),
  idleExpiresAt: exampleTime(-1) + IDLE_MS,
  absoluteExpiresAt: exampleTime(-5) + ABSOLUTE_MS,
  deviceId: null,
  demoControls: false,
  serverTime: EXAMPLE_INSTANT_MS,
};

/** A session of the INVESTIGATOR on the paired tablet, signed in at the example instant. */
const DEVICE_SESSION: AuthSessionInfo = {
  operator: EXAMPLE_INVESTIGATOR,
  // OD-15 (SH-04): an investigator holds TRANSCRIPT_REVISE.
  permissions: ['SESSION_START', 'SESSION_NOTE', 'EVIDENCE_VIEW', 'DIAGNOSTICS_RUN', 'TRANSCRIPT_REVISE'],
  method: 'PASSWORD',
  issuedAt: EXAMPLE_INSTANT_MS,
  lastActivityAt: EXAMPLE_INSTANT_MS,
  idleExpiresAt: EXAMPLE_INSTANT_MS + IDLE_MS,
  absoluteExpiresAt: EXAMPLE_INSTANT_MS + ABSOLUTE_MS,
  deviceId: SERVER_EXAMPLE_IDS.deviceId,
  demoControls: false,
  serverTime: EXAMPLE_INSTANT_MS,
};

const STATUS_OPEN: SignInStatus = {
  locked: false,
  lockedUntil: null,
  retryInMs: 0,
  attemptsRemaining: 5,
  serverTime: EXAMPLE_INSTANT_MS,
};
const STATUS_LOCKED: SignInStatus = {
  locked: true,
  lockedUntil: EXAMPLE_INSTANT_MS + 18_000,
  retryInMs: 18_000,
  attemptsRemaining: 0,
  serverTime: EXAMPLE_INSTANT_MS,
};

const INVALID_CREDENTIALS = {
  summary: 'Unknown username, wrong password or disabled operator',
  value: apiErrorExample('INVALID_CREDENTIALS', 'The username or the password is not correct.', { attemptsRemaining: 3 }),
} as const;
const SIGN_IN_LOCKED = lockedExample('Locked for 60 s after five failures', 'Too many failed attempts. Try again shortly.');
const BASIC_403 = { deviceRevoked: ERROR_EXAMPLES.deviceRevoked, originNotAllowed: ERROR_EXAMPLES.originNotAllowed } as const;

export const IDENTITY_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  signIn: {
    request: {
      password: {
        summary: 'Username and password',
        description: 'The password is a placeholder. No example holds a credential.',
        value: { username: 'andi.pratama', password: EXAMPLE_PLACEHOLDERS.password } satisfies SignInRequest,
      },
    },
    responses: {
      200: {
        webConsole: {
          summary: 'Web console: the session travels in the cookie',
          value: { session: WEB_SESSION } satisfies SignInResponse,
        },
        pairedDevice: {
          summary: 'Paired device: the token is returned once',
          description: 'The token is a placeholder.',
          value: { session: DEVICE_SESSION, sessionToken: EXAMPLE_PLACEHOLDERS.sessionToken } satisfies SignInResponse,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { invalidCredentials: INVALID_CREDENTIALS, credentialConflict: ERROR_EXAMPLES.credentialConflict },
      403: { deviceNotPaired: ERROR_EXAMPLES.deviceNotPaired, ...BASIC_403 },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
      423: { locked: SIGN_IN_LOCKED },
    },
  },
  getSignInStatus: {
    responses: {
      200: {
        open: { summary: 'Not locked', value: STATUS_OPEN },
        locked: { summary: 'Locked, 18 s left', value: STATUS_LOCKED },
      },
      403: BASIC_403,
    },
  },
  getAuthSession: {
    responses: {
      200: {
        webConsole: { summary: 'SUPERVISOR on the web console', value: WEB_SESSION },
        pairedDevice: { summary: 'INVESTIGATOR on the paired tablet', value: DEVICE_SESSION },
      },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: BASIC_403,
    },
  },
  signOut: {
    request: {
      lock: { summary: 'Lock console', value: { reason: 'LOCK' } satisfies SignOutRequest },
    },
    responses: {
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: BASIC_403,
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  touchSession: {
    responses: {
      200: {
        touched: {
          summary: 'Idle expiry moved to 15 minutes from now',
          value: {
            idleExpiresAt: EXAMPLE_INSTANT_MS + IDLE_MS,
            absoluteExpiresAt: exampleTime(-5) + ABSOLUTE_MS,
          } satisfies AuthSessionExpiry,
        },
      },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: BASIC_403,
    },
  },
  setBiometricEnrollment: {
    request: {
      enable: { summary: 'Turn biometric sign-in on', value: { enabled: true } satisfies BiometricEnrollmentRequest },
    },
    responses: {
      200: {
        enabled: {
          summary: 'Enrolled: the token is returned once',
          description: 'The token is a placeholder.',
          value: {
            enabled: true,
            token: EXAMPLE_PLACEHOLDERS.biometricToken,
            expiresAt: EXAMPLE_INSTANT_MS + BIOMETRIC_TOKEN_LIFETIME_MS,
          } satisfies BiometricEnrollment,
        },
        disabled: { summary: 'Turned off: the token family is revoked', value: { enabled: false } satisfies BiometricEnrollment },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: {
        notADeviceSession: {
          summary: 'A web console session',
          value: apiErrorExample('DEVICE_NOT_PAIRED', 'Biometric sign-in is set up on a paired device.'),
        },
        passwordSessionRequired: {
          summary: 'Turning it on in a session that no password opened',
          value: apiErrorExample('DEVICE_NOT_PAIRED', 'Sign in with your password to turn biometric sign-in on.', {
            reason: PASSWORD_SESSION_REQUIRED_REASON,
          }),
        },
        ...BASIC_403,
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  signInWithBiometric: {
    request: {
      token: {
        summary: 'The token the biometric prompt released',
        description: 'The token is a placeholder.',
        value: { token: EXAMPLE_PLACEHOLDERS.biometricToken } satisfies BiometricSignInRequest,
      },
    },
    responses: {
      200: {
        signedIn: {
          summary: 'Signed in; the token is rotated',
          description: 'Both tokens are placeholders.',
          value: {
            session: { ...DEVICE_SESSION, method: 'BIOMETRIC' },
            sessionToken: EXAMPLE_PLACEHOLDERS.sessionToken,
            biometricToken: EXAMPLE_PLACEHOLDERS.biometricToken,
          } satisfies SignInResponse,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: {
        invalidCredentials: {
          summary: 'Unknown, expired, revoked or reused token',
          value: apiErrorExample('INVALID_CREDENTIALS', 'Biometric sign-in was not accepted. Sign in with the password.', {
            attemptsRemaining: 4,
          }),
        },
        noDeviceCredential: ERROR_EXAMPLES.noDeviceCredential,
      },
      403: { deviceCredentialRequired: ERROR_EXAMPLES.deviceCredentialRequired, webConsoleSession: ERROR_EXAMPLES.webConsoleSession, ...BASIC_403 },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
      423: { locked: SIGN_IN_LOCKED },
    },
  },
  reportBiometricFailure: {
    request: {
      knownOperator: {
        summary: 'The operator the app believes was trying',
        value: { operatorId: 'OPR-001' } satisfies BiometricFailureRequest,
      },
      nobody: { summary: 'No operator known', value: { operatorId: null } satisfies BiometricFailureRequest },
    },
    responses: {
      200: {
        counted: { summary: 'Counted: four attempts left', value: { ...STATUS_OPEN, attemptsRemaining: 4 } satisfies SignInStatus },
        locked: { summary: 'This failure locked the device', value: STATUS_LOCKED },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { noDeviceCredential: ERROR_EXAMPLES.noDeviceCredential },
      403: { webConsoleSession: ERROR_EXAMPLES.webConsoleSession, ...BASIC_403 },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
};
