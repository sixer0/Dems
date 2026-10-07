/**
 * Area 3 of the Core API: pairing and the device registry (backend task: 2026-10-04 01_specs §6,
 * §7.7, §7.18).
 *
 * Nine operations, answered by the Core server only. A Supervisor issues a one-time code on the
 * portal; the operator types its six digits into the app; the redeem gives the device its ID and
 * its credential, once. The portal itself does not pair.
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 15 | `issuePairingCode` | PAIRING_MANAGE | PAIRING_CODE_ISSUED (a replaced code: also PAIRING_CODE_CLOSED) |
 * | 16 | `getPairingCodeStatus` | PAIRING_MANAGE | NONE-R |
 * | 17 | `cancelPairingCode` | PAIRING_MANAGE | PAIRING_CODE_CLOSED (none when no code is active) |
 * | 18 | `redeemPairingCode` | PUBLIC (the code is the proof) | PAIRING_SUCCESS (a failure: PAIRING_FAILED or PAIRING_LOCKED) |
 * | 19 | `listPairedDevices` | PAIRING_MANAGE | NONE-R |
 * | 20 | `revokeDevice` | PAIRING_MANAGE | DEVICE_REVOKED |
 * | 21 | `getDeviceRegistration` | DEVICE | NONE-R |
 * | 22 | `unpairDevice` | DEVICE | UNPAIRED |
 * | 23 | `rotateDeviceCredential` | DEVICE, and the device credential itself (`DEVICE_CREDENTIAL`) | DEVICE_CREDENTIAL_ROTATED |
 *
 * `{id}` in operation 20 is a device ID (`DEV-NNNN`).
 *
 * Secrets: the answers of operations 15, 18 and 23 hold one (the code, the device credential),
 * and so does the body of operation 18. No operation ever returns a code or a credential again,
 * and no row, event or log line holds one (SR-28, SR-30). The examples show placeholders only.
 */
import { z } from 'zod';
import { AuditType, Permission } from '../sim/vocabulary';
import { API_BASE_PATH } from './constants';
import {
  CORE_SERVER_ONLY,
  CoreApiAccessCondition,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  DEVICE_ACCESS,
  DEVICE_CREDENTIAL_REQUIRED_REASON,
  PUBLIC_ACCESS,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import {
  ERROR_EXAMPLES,
  EXAMPLE_PLACEHOLDERS,
  SERVER_EXAMPLE_IDS,
  apiErrorExample,
  exampleTime,
  lockedExample,
  notPermittedExample,
} from './example-parts';
import type { OperationExamples } from './examples';
import {
  CORE_SERVER_NOTE,
  DEVICE_CREDENTIAL_REFUSED,
  INVALID_INPUT,
  INVALID_JSON,
  NOT_SIGNED_IN,
  NO_DEVICE_CREDENTIAL,
  ORIGIN_REFUSED,
  SECRET_NOTE,
  backendSource,
  forbidden,
  notPermitted,
  WEB_SESSION_REFUSED,
} from './operation-parts';
import {
  DEVICE_CREDENTIAL_PATTERN,
  DEVICE_ID_PATTERN,
  PAIRING_CODE_ID_PATTERN,
  PAIRING_CODE_PATTERN,
  PAIRING_QR_PAYLOAD_PATTERN,
} from './patterns';
import { count, deviceId, displayText, epochMs, nullableEpochMs, operatorId, trimmedText } from './schema-parts';
import { apiText } from './text';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Limits of the pairing input; the database holds the same bounds (03_database_contract §4.8). */
export const PAIRING_INPUT_LIMITS = {
  deviceNameMax: 60,
  platformMax: 32,
  appVersionMax: 32,
  revokeReasonMin: 5,
  revokeReasonMax: 500,
} as const;

// Contract close-out W83 (gap W32-4, gap W81-1): the numbers and words of a pairing
// code that the server and the portal share. The server's `modules/pairing/limits.ts` holds the same
// values; test/api-closeout.test.ts holds the descriptions below to these constants.
/** PR-P2: a pairing code is valid this long after its issue (300 s). */
export const PAIRING_CODE_LIFETIME_MS = 300_000;
/** PR-P5: failed redeems of one code before it is closed as EXHAUSTED. */
export const PAIRING_CODE_MAX_FAILED_REDEEMS = 5;
/** PR-P7: the QR payload is this text followed by the code (`PAIRING_QR_PAYLOAD_PATTERN`). Not a URL. */
export const PAIRING_QR_PREFIX = 'DEMS-PAIR:1:';
/**
 * `details.reason` of a PAIRING_CODE_CLOSED audit row: the code ran out of time, used up its failed
 * redeems, or was cancelled. A code that a new issue replaces is closed as CANCELLED too.
 */
export const PairingCodeCloseReason = { EXPIRED: 'EXPIRED', EXHAUSTED: 'EXHAUSTED', CANCELLED: 'CANCELLED' } as const;
export type PairingCodeCloseReason = (typeof PairingCodeCloseReason)[keyof typeof PairingCodeCloseReason];


/** Life of a paired device (01_specs §6.3). REVOKED and UNPAIRED are final: pairing again makes a new device. */
export const PairedDeviceState = { PAIRED: 'PAIRED', REVOKED: 'REVOKED', UNPAIRED: 'UNPAIRED' } as const;
export type PairedDeviceState = (typeof PairedDeviceState)[keyof typeof PairedDeviceState];

const pairingCodeId = () => z.string().regex(PAIRING_CODE_ID_PATTERN);

export const PairingCodeIssuedSchema = z
  .strictObject({
    codeId: pairingCodeId().describe('Names the code in audit rows and in the registry. It is not the code.'),
    code: z.string().regex(PAIRING_CODE_PATTERN).describe('The six digits, returned here once. No operation can read them again.'),
    qrPayload: z
      .string()
      .regex(PAIRING_QR_PAYLOAD_PATTERN)
      .describe(`\`${PAIRING_QR_PREFIX}\` (\`PAIRING_QR_PREFIX\`) and the code, for the QR on the portal. Not a URL: a code must not appear in one.`),
    issuedAt: epochMs(),
    expiresAt: epochMs().describe(`\`issuedAt\` plus ${PAIRING_CODE_LIFETIME_MS / 1000} s (\`PAIRING_CODE_LIFETIME_MS\`).`),
    attemptsAllowed: z
      .int()
      .positive()
      .describe(`Failed redeems before the code is closed: ${PAIRING_CODE_MAX_FAILED_REDEEMS} (\`PAIRING_CODE_MAX_FAILED_REDEEMS\`).`),
  })
  .describe('A freshly issued pairing code. One code is active at a time: issuing closes the previous one.');
export type PairingCodeIssued = z.output<typeof PairingCodeIssuedSchema>;

export const PairingCodeStatusSchema = z
  .object({
    codeId: pairingCodeId(),
    issuedBy: operatorId(),
    issuedAt: epochMs(),
    expiresAt: epochMs(),
    attemptsRemaining: count(),
  })
  .describe('What an operator may read of the active code. Never the code.');
export type PairingCodeStatus = z.output<typeof PairingCodeStatusSchema>;

export const ActivePairingCodeSchema = z
  .strictObject({ active: PairingCodeStatusSchema.nullable().describe('Null when no code is active.') })
  .describe('Response of `GET /api/v1/pairing/code`.');
export type ActivePairingCode = z.output<typeof ActivePairingCodeSchema>;

export const PairingRedeemRequestSchema = z
  .object({
    code: z.string().regex(PAIRING_CODE_PATTERN).describe('The six digits the operator typed.'),
    deviceName: trimmedText(PAIRING_INPUT_LIMITS.deviceNameMax).describe(
      `What the registry shows for this device, 1 to ${PAIRING_INPUT_LIMITS.deviceNameMax} characters after trimming. It must not hold the pairing code or anything of the form of a credential: such a body is refused with 422 INVALID_INPUT.`,
    ),
    platform: trimmedText(PAIRING_INPUT_LIMITS.platformMax).describe('e.g. `android`.'),
    appVersion: trimmedText(PAIRING_INPUT_LIMITS.appVersionMax).describe('The app\'s version, e.g. `0.2.0`.'),
  })
  .describe('Request body of `POST /api/v1/pairing/redeem`.');
export type PairingRedeemRequest = z.output<typeof PairingRedeemRequestSchema>;

export const CoreIdentitySchema = z
  .object({
    deviceId: displayText().describe('The Core\'s device ID, e.g. `DEMS-IR-01`.'),
    name: displayText(),
    certificateFingerprint: displayText(),
  })
  .describe('The Core a device is paired with: the members the app\'s `pairing` slice shows.');
export type CoreIdentity = z.output<typeof CoreIdentitySchema>;

export const PairingRedeemedSchema = z
  .strictObject({
    deviceId: deviceId(),
    deviceCredential: z
      .string()
      .regex(DEVICE_CREDENTIAL_PATTERN)
      .describe('Returned here once. The app keeps it in secure storage and sends it as `Authorization: Bearer`.'),
    pairedAt: epochMs(),
    core: CoreIdentitySchema,
  })
  .describe('A device that has just been paired.');
export type PairingRedeemed = z.output<typeof PairingRedeemedSchema>;

export const PairedDeviceSchema = z
  .strictObject({
    id: deviceId(),
    name: displayText(),
    platform: displayText(),
    appVersion: displayText(),
    state: z.enum(PairedDeviceState),
    pairedAt: epochMs(),
    pairedWithCodeId: pairingCodeId(),
    codeIssuedBy: operatorId(),
    lastSeenAt: epochMs().describe('Last authenticated request or socket of the device; written at most once a minute.'),
    online: z.boolean().describe('True while the device has an open authenticated socket.'),
    signedInOperatorId: operatorId().nullable().describe('The operator of the device\'s newest open session, or null.'),
    credentialRotatedAt: nullableEpochMs(),
    revokedAt: nullableEpochMs(),
    revokedBy: operatorId().nullable(),
    revokeReason: apiText().nullable(),
    unpairedAt: nullableEpochMs(),
  })
  .describe('A device of the registry. It never carries a credential or its hash.');
export type PairedDevice = z.output<typeof PairedDeviceSchema>;

export const PairedDeviceListSchema = z
  .strictObject({ devices: z.array(PairedDeviceSchema) })
  .describe('Response of `GET /api/v1/pairing/devices`: every device ever paired, newest first.');
export type PairedDeviceList = z.output<typeof PairedDeviceListSchema>;

export const DeviceRevokeRequestSchema = z
  .object({
    reason: apiText()
      .overwrite((value) => value.trim())
      .min(PAIRING_INPUT_LIMITS.revokeReasonMin)
      .max(PAIRING_INPUT_LIMITS.revokeReasonMax)
      .describe(
        `Why the device is revoked: ${PAIRING_INPUT_LIMITS.revokeReasonMin} to ${PAIRING_INPUT_LIMITS.revokeReasonMax} characters after trimming. Written to the audit row. It must not hold anything of the form of a credential (422 INVALID_INPUT).`,
      ),
  })
  .describe('Request body of `POST /api/v1/pairing/devices/{id}/revoke`.');
export type DeviceRevokeRequest = z.output<typeof DeviceRevokeRequestSchema>;

export const DeviceRegistrationSchema = z
  .strictObject({
    deviceId: deviceId(),
    name: displayText(),
    state: z.enum(PairedDeviceState),
    pairedAt: epochMs(),
    credentialRotatedAt: nullableEpochMs(),
    core: CoreIdentitySchema,
  })
  .describe('A device\'s own registration, read at app start.');
export type DeviceRegistration = z.output<typeof DeviceRegistrationSchema>;

export const DeviceCredentialRotatedSchema = z
  .strictObject({
    deviceCredential: z
      .string()
      .regex(DEVICE_CREDENTIAL_PATTERN)
      .describe('The next credential, returned here once. It replaces the old one at its first use; until then the old one stays valid.'),
    rotatedAt: epochMs(),
  })
  .describe('Response of `POST /api/v1/pairing/device/credential`.');
export type DeviceCredentialRotated = z.output<typeof DeviceCredentialRotatedSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const PAIRING_SCHEMAS = {
  PairingCodeIssued: PairingCodeIssuedSchema,
  PairingCodeStatus: PairingCodeStatusSchema,
  ActivePairingCode: ActivePairingCodeSchema,
  PairingRedeemRequest: PairingRedeemRequestSchema,
  CoreIdentity: CoreIdentitySchema,
  PairingRedeemed: PairingRedeemedSchema,
  PairedDevice: PairedDeviceSchema,
  PairedDeviceList: PairedDeviceListSchema,
  DeviceRevokeRequest: DeviceRevokeRequestSchema,
  DeviceRegistration: DeviceRegistrationSchema,
  DeviceCredentialRotated: DeviceCredentialRotatedSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.7';
const PAIRING_PATH = `${API_BASE_PATH}/pairing`;
const PAIRING_MANAGE = permissionAccess(Permission.PAIRING_MANAGE);

export const PAIRING_OPERATIONS = [
  {
    operationId: 'issuePairingCode',
    method: 'post',
    path: `${PAIRING_PATH}/code`,
    tag: CoreApiTag.PAIRING,
    mode: CoreApiMode.LIVE,
    summary: 'Issue a pairing code',
    description: [
      'Issues a one-time pairing code: six digits, valid for 300 s, closed after five failed redeems. The answer is the only place the code ever appears; reloading the portal cannot show it again.',
      'One code is active at a time: issuing a new one cancels the previous one. Writes PAIRING_CODE_ISSUED, and PAIRING_CODE_CLOSED (`details.reason: CANCELLED`) for a code it replaced.',
      SECRET_NOTE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 15),
    responses: {
      201: { description: 'The code, once.', schema: 'PairingCodeIssued' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.PAIRING_MANAGE),
    },
    access: PAIRING_MANAGE,
    audit: { success: AuditType.PAIRING_CODE_ISSUED, denial: AuditType.ACCESS_DENIED, also: [AuditType.PAIRING_CODE_CLOSED] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getPairingCodeStatus',
    method: 'get',
    path: `${PAIRING_PATH}/code`,
    tag: CoreApiTag.PAIRING,
    mode: CoreApiMode.LIVE,
    summary: 'Active pairing code',
    description: [
      'What an operator may read of the active code: its ID, who issued it, when it expires and how many attempts are left. Never the code.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 16),
    responses: {
      200: { description: 'The active code, or null.', schema: 'ActivePairingCode' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.PAIRING_MANAGE),
    },
    access: PAIRING_MANAGE,
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'cancelPairingCode',
    method: 'post',
    path: `${PAIRING_PATH}/code/cancel`,
    tag: CoreApiTag.PAIRING,
    mode: CoreApiMode.LIVE,
    summary: 'Cancel the pairing code',
    description: [
      'Cancels the active code. Writes PAIRING_CODE_CLOSED with `details.reason: CANCELLED`; when no code is active it writes nothing and still answers `204`. The other close reasons are EXPIRED and EXHAUSTED (`PairingCodeCloseReason`).',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 17),
    responses: {
      204: { description: 'No code is active now.' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.PAIRING_MANAGE),
    },
    access: PAIRING_MANAGE,
    audit: { success: AuditType.PAIRING_CODE_CLOSED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'redeemPairingCode',
    method: 'post',
    path: `${PAIRING_PATH}/redeem`,
    tag: CoreApiTag.PAIRING,
    mode: CoreApiMode.LIVE,
    summary: 'Redeem a pairing code',
    description: [
      'Pairs the calling device. The caller has no credential yet: the code is the proof. On success the device gets its ID and its credential, once, and the registry shows it as PAIRED.',
      'A wrong, expired, used or cancelled code answers the same `401 INVALID_CODE`; the answer never says which. Three failures within 300 s lock redeeming for 60 s (`423 LOCKED`); the fifth failure closes the code.',
      'Every attempt writes exactly one audit row: PAIRING_SUCCESS, PAIRING_FAILED or PAIRING_LOCKED. A successful redeem yields a paired device, not a session: a sign-in still follows.',
      SECRET_NOTE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 18),
    requestBody: { schema: 'PairingRedeemRequest', required: true },
    responses: {
      201: { description: 'Paired; the device credential is returned once.', schema: 'PairingRedeemed' },
      400: INVALID_JSON,
      401: {
        description:
          'The code is not accepted (INVALID_CODE; the same answer for every cause), or the request carried two credentials (NOT_SIGNED_IN, `details.reason: CREDENTIAL_CONFLICT`).',
        schema: 'ApiError',
      },
      403: ORIGIN_REFUSED,
      422: INVALID_INPUT,
      423: {
        description:
          'Redeeming is locked for 60 s after 3 failures (LOCKED); `details.lockedUntil` and `details.retryInMs` say how long. The failure that locks answers this too and writes PAIRING_FAILED; an attempt during the lock is not compared and writes PAIRING_LOCKED.',
        schema: 'ApiError',
      },
    },
    access: PUBLIC_ACCESS,
    audit: {
      success: AuditType.PAIRING_SUCCESS,
      denial: AuditType.ACCESS_DENIED,
      also: [AuditType.PAIRING_FAILED, AuditType.PAIRING_LOCKED, AuditType.PAIRING_CODE_CLOSED],
    },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'listPairedDevices',
    method: 'get',
    path: `${PAIRING_PATH}/devices`,
    tag: CoreApiTag.PAIRING,
    mode: CoreApiMode.LIVE,
    summary: 'List paired devices',
    description: [
      'The device registry: every device ever paired, with its state, when it was last seen, whether it is online and who is signed in on it. It never returns a credential or its hash.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 19),
    responses: {
      200: { description: 'The registry.', schema: 'PairedDeviceList' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.PAIRING_MANAGE),
    },
    access: PAIRING_MANAGE,
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'revokeDevice',
    method: 'post',
    path: `${PAIRING_PATH}/devices/{id}/revoke`,
    tag: CoreApiTag.PAIRING,
    mode: CoreApiMode.LIVE,
    summary: 'Revoke a device',
    description: [
      'Revokes a paired device, with a mandatory reason. In the same transaction its sessions are ended and its biometric tokens revoked; its sockets receive `device.revoked` and are closed with 4403 within 1 s. The device returns to its pairing screen.',
      'REVOKED is final: pairing again creates a new device with a new ID. A recording that the device started belongs to the Core and continues; any operator with SESSION_START stops it from another client.',
      'Writes DEVICE_REVOKED with the reason and the number of sessions ended.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 20),
    pathParam: { name: 'id', description: 'Device ID `DEV-NNNN`.', pattern: DEVICE_ID_PATTERN },
    requestBody: { schema: 'DeviceRevokeRequest', required: true },
    responses: {
      200: { description: 'The device, now REVOKED.', schema: 'PairedDevice' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.PAIRING_MANAGE),
      404: { description: 'No device has this ID (NOT_FOUND).', schema: 'ApiError' },
      409: { description: 'The device is not PAIRED any more (INVALID_STATE).', schema: 'ApiError' },
      422: {
        description:
          'The reason is shorter than 5 characters (INVALID_REASON), or the body or the path parameter does not match its schema (INVALID_INPUT; API-13).',
        schema: 'ApiError',
      },
    },
    access: PAIRING_MANAGE,
    audit: { success: AuditType.DEVICE_REVOKED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getDeviceRegistration',
    method: 'get',
    path: `${PAIRING_PATH}/device`,
    tag: CoreApiTag.PAIRING,
    mode: CoreApiMode.LIVE,
    summary: 'Own device registration',
    description: [
      'The calling device\'s own registration and the Core it is paired with. The app reads it at start: `403 DEVICE_REVOKED` means the stored credential must be deleted and the pairing screen shown.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 21),
    responses: {
      200: { description: 'The registration.', schema: 'DeviceRegistration' },
      401: NO_DEVICE_CREDENTIAL,
      403: forbidden(WEB_SESSION_REFUSED),
    },
    access: DEVICE_ACCESS,
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'unpairDevice',
    method: 'post',
    path: `${PAIRING_PATH}/device/unpair`,
    tag: CoreApiTag.PAIRING,
    mode: CoreApiMode.LIVE,
    summary: 'Unpair this device',
    description: [
      'The calling device ends its own pairing. Its sessions are ended and its biometric tokens revoked; the app then deletes its credential. UNPAIRED is final: pairing again creates a new device.',
      'Writes UNPAIRED with the device ID, and the signed-in operator when there is one.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 22),
    responses: {
      204: { description: 'Unpaired.' },
      401: NO_DEVICE_CREDENTIAL,
      403: forbidden(WEB_SESSION_REFUSED),
    },
    access: DEVICE_ACCESS,
    audit: { success: AuditType.UNPAIRED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'rotateDeviceCredential',
    method: 'post',
    path: `${PAIRING_PATH}/device/credential`,
    tag: CoreApiTag.PAIRING,
    mode: CoreApiMode.LIVE,
    summary: 'Rotate the device credential',
    description: [
      'Gives the calling device a new credential, in two phases: the new one is stored as "next" and promoted at its first use; only then is the old one refused. An answer that is lost leaves the old credential valid.',
      `The request must present the device credential itself. The session token of an operator who is signed in on this device is refused with \`403 DEVICE_NOT_PAIRED\` (\`details.reason: ${DEVICE_CREDENTIAL_REQUIRED_REASON}\`): a session ends by itself, and it must not be able to leave behind a credential that never expires.`,
      'Writes DEVICE_CREDENTIAL_ROTATED with the device ID. No client of this release calls it, so such a row outside the server\'s own tests deserves a look: revoking the device ends it.',
      SECRET_NOTE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 23),
    responses: {
      200: { description: 'The next credential, once.', schema: 'DeviceCredentialRotated' },
      401: NO_DEVICE_CREDENTIAL,
      403: forbidden(WEB_SESSION_REFUSED, DEVICE_CREDENTIAL_REFUSED),
    },
    access: { ...DEVICE_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL] },
    audit: { success: AuditType.DEVICE_CREDENTIAL_ROTATED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The Core of the canonical dataset (`sim/dataset.ts` `DEVICE_ID`, `DEVICE_NAME`, `DEVICE_CERT_FINGERPRINT`). */
const CORE: CoreIdentity = {
  deviceId: 'DEMS-IR-01',
  name: 'Interview Room 1',
  certificateFingerprint: '76:0B:E9:29:6D:40:F7:D8:93:20:FD:C6:5F:76:7A:4B',
};

/** The tablet paired two minutes before the example instant, with the INVESTIGATOR signed in on it. */
const TABLET: PairedDevice = {
  id: SERVER_EXAMPLE_IDS.deviceId,
  name: 'Interview tablet 01',
  platform: 'android',
  appVersion: '0.2.0',
  state: 'PAIRED',
  pairedAt: exampleTime(-2),
  pairedWithCodeId: SERVER_EXAMPLE_IDS.pairingCodeId,
  codeIssuedBy: 'OPR-002',
  lastSeenAt: exampleTime(0),
  online: true,
  signedInOperatorId: 'OPR-001',
  credentialRotatedAt: null,
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  unpairedAt: null,
};

const REVOKE_REASON = 'Tablet reported lost by the investigator';

const TABLET_REVOKED: PairedDevice = {
  ...TABLET,
  state: 'REVOKED',
  online: false,
  signedInOperatorId: null,
  revokedAt: exampleTime(0),
  revokedBy: 'OPR-002',
  revokeReason: REVOKE_REASON,
};

const BASIC_403 = { deviceRevoked: ERROR_EXAMPLES.deviceRevoked, originNotAllowed: ERROR_EXAMPLES.originNotAllowed } as const;
const denied = (operationId: string) => ({
  notPermitted: notPermittedExample(operationId, 'PAIRING_MANAGE', 'INVESTIGATOR'),
  ...BASIC_403,
});

export const PAIRING_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  issuePairingCode: {
    responses: {
      201: {
        issued: {
          summary: 'A code, valid for 300 s',
          description: 'The code and the QR payload are placeholders.',
          value: {
            codeId: SERVER_EXAMPLE_IDS.activePairingCodeId,
            code: EXAMPLE_PLACEHOLDERS.pairingCode,
            qrPayload: EXAMPLE_PLACEHOLDERS.qrPayload,
            issuedAt: exampleTime(0),
            expiresAt: exampleTime(5),
            attemptsAllowed: 5,
          } satisfies PairingCodeIssued,
        },
      },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('issuePairingCode'),
    },
  },
  getPairingCodeStatus: {
    responses: {
      200: {
        active: {
          summary: 'A code is active',
          value: {
            active: {
              codeId: SERVER_EXAMPLE_IDS.activePairingCodeId,
              issuedBy: 'OPR-002',
              issuedAt: exampleTime(0),
              expiresAt: exampleTime(5),
              attemptsRemaining: 5,
            },
          } satisfies ActivePairingCode,
        },
        none: { summary: 'No code is active', value: { active: null } satisfies ActivePairingCode },
      },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('getPairingCodeStatus'),
    },
  },
  cancelPairingCode: {
    responses: {
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('cancelPairingCode'),
    },
  },
  redeemPairingCode: {
    request: {
      tablet: {
        summary: 'The code typed on the tablet',
        description: 'The code is a placeholder.',
        value: {
          code: EXAMPLE_PLACEHOLDERS.pairingCode,
          deviceName: TABLET.name,
          platform: TABLET.platform,
          appVersion: TABLET.appVersion,
        } satisfies PairingRedeemRequest,
      },
    },
    responses: {
      201: {
        paired: {
          summary: 'Paired: the credential is returned once',
          description: 'The credential is a placeholder.',
          value: {
            deviceId: SERVER_EXAMPLE_IDS.secondDeviceId,
            deviceCredential: EXAMPLE_PLACEHOLDERS.deviceCredential,
            pairedAt: exampleTime(0),
            core: CORE,
          } satisfies PairingRedeemed,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: {
        invalidCode: {
          summary: 'Wrong, expired, used or cancelled code',
          value: apiErrorExample('INVALID_CODE', 'The pairing code is not valid.', { attemptsRemaining: 2 }),
        },
      },
      403: { originNotAllowed: ERROR_EXAMPLES.originNotAllowed },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
      423: { locked: lockedExample('Locked for 60 s after three failures', 'Too many failed pairing attempts. Try again shortly.') },
    },
  },
  listPairedDevices: {
    responses: {
      200: { registry: { summary: 'One paired tablet, online', value: { devices: [TABLET] } satisfies PairedDeviceList } },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('listPairedDevices'),
    },
  },
  revokeDevice: {
    pathParams: { id: SERVER_EXAMPLE_IDS.deviceId },
    request: {
      lost: { summary: 'A lost tablet', value: { reason: REVOKE_REASON } satisfies DeviceRevokeRequest },
    },
    responses: {
      200: { revoked: { summary: 'Revoked; its sessions are ended', value: TABLET_REVOKED } },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('revokeDevice'),
      404: { notFound: { summary: 'Unknown device ID', value: apiErrorExample('NOT_FOUND', 'No device has this ID.') } },
      409: {
        invalidState: {
          summary: 'Already revoked',
          value: apiErrorExample('INVALID_STATE', `Device ${SERVER_EXAMPLE_IDS.deviceId} is REVOKED.`),
        },
      },
      422: {
        invalidReason: {
          summary: 'Reason too short',
          value: apiErrorExample('INVALID_REASON', 'A revoke reason of at least 5 characters is required.'),
        },
        invalidInput: ERROR_EXAMPLES.invalidInput,
      },
    },
  },
  getDeviceRegistration: {
    responses: {
      200: {
        paired: {
          summary: 'A paired tablet',
          value: {
            deviceId: TABLET.id,
            name: TABLET.name,
            state: 'PAIRED',
            pairedAt: TABLET.pairedAt,
            credentialRotatedAt: null,
            core: CORE,
          } satisfies DeviceRegistration,
        },
      },
      401: { noDeviceCredential: ERROR_EXAMPLES.noDeviceCredential },
      403: { webConsoleSession: ERROR_EXAMPLES.webConsoleSession, ...BASIC_403 },
    },
  },
  unpairDevice: {
    responses: {
      401: { noDeviceCredential: ERROR_EXAMPLES.noDeviceCredential },
      403: { webConsoleSession: ERROR_EXAMPLES.webConsoleSession, ...BASIC_403 },
    },
  },
  rotateDeviceCredential: {
    responses: {
      200: {
        rotated: {
          summary: 'The next credential, once',
          description: 'The credential is a placeholder.',
          value: {
            deviceCredential: EXAMPLE_PLACEHOLDERS.deviceCredential,
            rotatedAt: exampleTime(0),
          } satisfies DeviceCredentialRotated,
        },
      },
      401: { noDeviceCredential: ERROR_EXAMPLES.noDeviceCredential },
      403: { deviceCredentialRequired: ERROR_EXAMPLES.deviceCredentialRequired, webConsoleSession: ERROR_EXAMPLES.webConsoleSession, ...BASIC_403 },
    },
  },
};
