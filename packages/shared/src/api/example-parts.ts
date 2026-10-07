/**
 * Shared pieces of the Core-server example payloads (backend task: 2026-10-04 01_specs §7.2, §7.5
 * to §7.7, §7.16). Internal to `src/api`: `index.ts` does not re-export this module.
 *
 * - Time is epoch milliseconds (API-5), frozen at the instant of `examples.ts`
 *   (`OPENAPI_EXAMPLE_INSTANT`, 2026-10-01 10:00:00 WIB), so every build gives the same document.
 * - **No example holds a secret.** A password, a pairing code, a session token, a device
 *   credential and a biometric token appear only as the placeholders below, which have the right
 *   form and can open nothing. test/api-examples.test.ts fails when another value shows up.
 * - `INVALID_JSON` and `INVALID_INPUT` repeat the texts the Core server's envelope sends
 *   (`apps/core-server/src/plugins/error-envelope/api-failure.ts`). The other messages are
 *   examples: the server rows word their own.
 */
import { DEVICE_CREDENTIAL_REQUIRED_REASON } from './contract-model';
import type { ApiError } from './core-api';
import type { OpenApiExample } from './examples';

/** `OPENAPI_EXAMPLE_INSTANT` as epoch milliseconds (test/api-examples.test.ts holds the two together). */
export const EXAMPLE_INSTANT_MS = 1_790_823_600_000;
const MINUTE_MS = 60_000;
/** The example instant plus or minus whole minutes. */
export const exampleTime = (minutes: number): number => EXAMPLE_INSTANT_MS + minutes * MINUTE_MS;

/** A request ID as the Core server mints it (a UUID). */
export const EXAMPLE_REQUEST_ID = '00000000-0000-4000-8000-000000000000';

/** 43 characters with the alphabet of a bearer secret, and nothing secret about them. */
const PLACEHOLDER_BODY = 'EXAMPLE_ONLY_NOT_A_REAL_CREDENTIAL'.padEnd(43, '0');

/** Placeholders for every secret an example has to show. Each matches its pattern and opens nothing. */
export const EXAMPLE_PLACEHOLDERS = {
  password: '<operator password>',
  pairingCode: '000000',
  qrPayload: 'DEMS-PAIR:1:000000',
  sessionToken: `ses_${PLACEHOLDER_BODY}`,
  deviceCredential: `dvc_${PLACEHOLDER_BODY}`,
  biometricToken: `bio_${PLACEHOLDER_BODY}`,
} as const;

/** Identifiers of the Core-server examples (the canonical dataset has no device and no code). */
export const SERVER_EXAMPLE_IDS = {
  deviceId: 'DEV-0001',
  secondDeviceId: 'DEV-0002',
  pairingCodeId: 'PCD-000001',
  activePairingCodeId: 'PCD-000002',
} as const;

type ErrorDetails = NonNullable<ApiError['error']['details']>;

export function apiErrorExample(code: string, message: string, details?: ErrorDetails): ApiError {
  return { error: { code, message, ...(details ? { details } : {}), requestId: EXAMPLE_REQUEST_ID } };
}

function named(summary: string, value: ApiError): OpenApiExample<ApiError> {
  return { summary, value };
}

/** The refusals many operations share, as named examples. */
export const ERROR_EXAMPLES = {
  invalidJson: named('Not a JSON object', apiErrorExample('INVALID_JSON', 'The request body must be a JSON object.')),
  invalidInput: named(
    'The body does not match its schema',
    apiErrorExample('INVALID_INPUT', 'The request does not match the expected input.', { in: 'body' }),
  ),
  invalidPathParameter: named(
    'The path parameter does not match its pattern',
    apiErrorExample('INVALID_INPUT', 'The request does not match the expected input.', { in: 'params' }),
  ),
  invalidQuery: named(
    'A query parameter does not match its schema',
    apiErrorExample('INVALID_INPUT', 'The request does not match the expected input.', { in: 'querystring' }),
  ),
  notSignedIn: named('No valid session', apiErrorExample('NOT_SIGNED_IN', 'Sign in first.')),
  credentialConflict: named(
    'A cookie and an Authorization header in one request',
    apiErrorExample('NOT_SIGNED_IN', 'Send one credential per request.', { reason: 'CREDENTIAL_CONFLICT' }),
  ),
  noDeviceCredential: named(
    'No valid device credential',
    apiErrorExample('NOT_SIGNED_IN', 'This operation needs the credential of a paired device.'),
  ),
  originNotAllowed: named(
    'An Origin outside the allowed lists',
    apiErrorExample('ORIGIN_NOT_ALLOWED', 'This origin may not call the Core server.'),
  ),
  deviceRevoked: named(
    'The device is no longer paired',
    apiErrorExample('DEVICE_REVOKED', 'This device is no longer paired with the Core.', { reason: 'DEVICE_REVOKED' }),
  ),
  deviceNotPaired: named(
    'No console identity',
    apiErrorExample('DEVICE_NOT_PAIRED', 'Pair this device with the Core before signing in.'),
  ),
  /** The condition `DEVICE_CREDENTIAL` does not hold: the caller is a session of the device, not the device. */
  deviceCredentialRequired: {
    summary: 'A session token of the device instead of the device credential',
    description: 'The caller is the session of an operator who is signed in on this device. No audit row is written.',
    value: apiErrorExample('DEVICE_NOT_PAIRED', "This operation needs the device's own credential.", {
      reason: DEVICE_CREDENTIAL_REQUIRED_REASON,
    }),
  },
  /**
   * A device-only operation called by an operator's web console session (spec §7.2; W83,
   * gap W32-3 and gap W52-1): refused by the access rule, no audit row.
   */
  webConsoleSession: {
    summary: 'A web console session on a device-only operation',
    description: 'The caller is an operator signed in on the web console, not a paired device. No audit row is written.',
    value: apiErrorExample('DEVICE_NOT_PAIRED', 'This operation is available on a paired device only.'),
  },
  demoDisabled: named('The demo flag is off', apiErrorExample('DEMO_DISABLED', 'Demo controls are not enabled on this server.')),
} as const;

/** `403 NOT_PERMITTED` as the permission guard answers it (RB-4): the row it wrote names the same three values. */
export function notPermittedExample(operationId: string, permission: string, role: string): OpenApiExample<ApiError> {
  return named(
    `${role} lacks ${permission}`,
    apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
      operationId,
      permission,
      role,
    }),
  );
}

/** The two refusals every operation of an OPERATOR shares on 403: a retired device, the Origin guard. */
export const BASIC_403_EXAMPLES = {
  deviceRevoked: ERROR_EXAMPLES.deviceRevoked,
  originNotAllowed: ERROR_EXAMPLES.originNotAllowed,
} as const;

/** The 403 examples of an operation that needs `permission`; `role` is a role that lacks it. */
export function deniedExamples(operationId: string, permission: string, role: string) {
  return { notPermitted: notPermittedExample(operationId, permission, role), ...BASIC_403_EXAMPLES };
}

/** A refusal the hosted simulator action raised: `details.simCode` names its code (01_specs §7.2). */
export function simRefusalExample(summary: string, code: string, message: string, simCode: string, details?: ErrorDetails): OpenApiExample<ApiError> {
  return named(summary, apiErrorExample(code, message, { simCode, ...details }));
}

/** `423 LOCKED` 42 s into a 60 s lock. */
export function lockedExample(summary: string, message: string): OpenApiExample<ApiError> {
  return named(summary, apiErrorExample('LOCKED', message, { lockedUntil: EXAMPLE_INSTANT_MS + 18_000, retryInMs: 18_000 }));
}
