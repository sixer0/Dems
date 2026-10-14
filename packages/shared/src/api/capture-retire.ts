/**
 * Operation 111 `retireCaptureDevice`: RETIRING a registered camera or microphone (task 4, row RD2;
 * design `masterplan/07_design_retire_readopt.md` sections 4.2 to 4.4; decision C147, rulings Q1 to
 * Q4; the gap of decision C146 / request 570: a registered device could not be re-adopted and no
 * operation removed one, while input-av - the default scheme, U1 - has `DELETE /cameras/{id}`).
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 111 | `retireCaptureDevice` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | CAPTURE_DEVICE_RETIRED |
 *
 * WHAT RETIRING IS (design option B). The device's STORED CREDENTIAL IS DESTROYED and its registry
 * row is KEPT, marked retired (`retiredAt`, `retiredBy` of the device entry): it is never assigned
 * again, never tested, never re-addressed, and it is not "registered" for the identity rule of an
 * adoption any more. Adopting the same unit again goes through the existing operations 95/96
 * (cameras) and 99 (microphones) and gives a NEW id: an id is never reused, so the ids in sealed
 * packages and audit rows keep meaning what they meant (design section 2). There is NO hard delete,
 * not even of a never-used device (Q4), and no "un-retire".
 *
 * WHO (Q1). The permission `CAPTURE_COMMISSION` - TECHNICIAN only (decision U10) - on a web console
 * session only, as operations 101 to 110: retiring is decommissioning. Idle only.
 *
 * WHERE THE RETIRED DEVICE STILL SHOWS (Q2). In the `captureDevices` slice and in operation 77's
 * registry list, with `retiredAt` set, so a client lists it with a 'Retired' state; every selector
 * and assignment list leaves it out (`isCaptureDeviceRetired` of `sim/capture-registry.ts`). The
 * engine never lets a device leave the registry (`db/mapping/changes.ts:232`).
 *
 * THIS FILE IS THE CONTRACT. The Core's handler is row RD3 (until then the route is a NAMED
 * DEFERRAL of the acceptance lists); the in-app simulator answers it (`sim/api.ts`).
 */
import { z } from 'zod';
import { AuditType, Permission } from '../sim/vocabulary';
import { CAPTURE_COMMISSION_ACCESS } from './capture-commissioning';
import { CaptureDiscoveryReason } from './capture-discovery';
import { API_BASE_PATH } from './constants';
import { CORE_SERVER_ONLY, CoreApiMode, CoreApiTag, WEB_CONSOLE_ONLY_REASON, type CoreApiRegistryOperation } from './contract-model';
import { ERROR_EXAMPLES, EXAMPLE_INSTANT_MS, apiErrorExample, deniedExamples } from './example-parts';
import type { OperationExamples } from './examples';
import { INVALID_JSON, NOT_SIGNED_IN, SIM_V2_NOTE, notPermitted } from './operation-parts';
import { HARDWARE_DEVICE_ID_PATTERN, OPERATOR_ID_PATTERN } from './patterns';
import { epochMs } from './schema-parts';
import { CaptureDeviceStatusSchema } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Closed sets and sentences
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Why a device is retired: the `reason` of the body - a CLOSED set, so no free text reaches the audit row (NL-1). */
export const CaptureDeviceRetireReason = {
  /** Taken out of the room for good. */
  REMOVED: 'REMOVED',
  /** A new unit takes its place (the same address may come back as a NEW device). */
  REPLACED: 'REPLACED',
  /** The camera now states other stream profiles than the ones the Core stored (operation 108's `STREAM_PROFILE_DIFFERS`). */
  STATEMENT_CHANGED: 'STATEMENT_CHANGED',
} as const;
export type CaptureDeviceRetireReason = (typeof CaptureDeviceRetireReason)[keyof typeof CaptureDeviceRetireReason];

/** The device kinds that can be retired: a camera or a microphone. The PoE switch cannot. */
export const CAPTURE_RETIRABLE_KINDS = ['CAMERA', 'MIC'] as const;
export type CaptureRetirableKind = (typeof CAPTURE_RETIRABLE_KINDS)[number];

/**
 * The ids of the BUILT-IN devices of the demonstration model (`DEFAULT_CAPTURE_DEVICES` of
 * `sim/initial-state.ts`; the Core's built-in rows, `db/mapping/rows.ts`). They cannot be retired
 * (`CAPTURE_DEVICE_BUILT_IN`), nor can any device of kind `POE`. A test holds this list equal to the
 * simulator's. HYPOTHESIS for row RD3: every Core registry holds these five rows, so no adopted
 * device carries one of these ids (adoption mints the highest number plus one).
 */
export const CAPTURE_BUILT_IN_DEVICE_IDS = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH'] as const;

/** A device that can be retired is a registered camera or microphone: `CAM-NN` or `MIC-NN`. The form of `deviceId` of CAPTURE_DEVICE_RETIRED. */
export const CAPTURE_RETIRABLE_DEVICE_ID_PATTERN = /^(?:CAM|MIC)-\d{2,8}$/;

/**
 * `details.reason` of the three refusals operation 111 adds (each `409 INVALID_STATE`; nothing is
 * stored and no audit row is written). `CONNECTION_TEST_IN_PROGRESS` of operation 108 is the fourth
 * reason, reused. `CAPTURE_DEVICE_RETIRED` is also the reason operations 78 to 80, 89, 100 and 108
 * answer for a retired id (rows RD3, RD4a, RD4b) and the reason of the shared action
 * `setCaptureConfig` (`CAPTURE_CONFIG_DEVICE_RETIRED`).
 */
export const CaptureRetireRefusalReason = {
  /** A slot of the device selector names the device. */
  CAPTURE_DEVICE_ASSIGNED: 'CAPTURE_DEVICE_ASSIGNED',
  /** The device is retired already. */
  CAPTURE_DEVICE_RETIRED: 'CAPTURE_DEVICE_RETIRED',
  /** A built-in device of the demonstration model, or the PoE switch. */
  CAPTURE_DEVICE_BUILT_IN: 'CAPTURE_DEVICE_BUILT_IN',
} as const;
export type CaptureRetireRefusalReason = (typeof CaptureRetireRefusalReason)[keyof typeof CaptureRetireRefusalReason];

/**
 * The sentence of each `409 INVALID_STATE` refusal of operation 111: the `message` of the envelope.
 * It names no slot and no device - `details.slot` names the slot of `CAPTURE_DEVICE_ASSIGNED`; a
 * client words it with `common.captureRetire.refusal`, which places the source and the slot.
 */
export const CAPTURE_RETIRE_REFUSAL_SENTENCES = Object.freeze({
  [CaptureRetireRefusalReason.CAPTURE_DEVICE_ASSIGNED]: 'This device is assigned to a slot of the device selector. Unassign it first, then retire it. Nothing was changed.',
  [CaptureRetireRefusalReason.CAPTURE_DEVICE_RETIRED]: 'This device is already retired. Nothing was changed.',
  [CaptureRetireRefusalReason.CAPTURE_DEVICE_BUILT_IN]: 'The demo devices of the simulator and the PoE switch cannot be retired. Nothing was changed.',
  [CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS]: 'Another connection test is running. Try again shortly.',
} as const);
export type CaptureRetireRefusal = keyof typeof CAPTURE_RETIRE_REFUSAL_SENTENCES;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CaptureDeviceRetireRequestSchema = z
  .strictObject({
    reason: z.enum(CaptureDeviceRetireReason).describe('Why the device is retired: REMOVED (taken out for good), REPLACED (a new unit takes its place) or STATEMENT_CHANGED (the camera now states other stream profiles). A closed set: no free text.'),
  })
  .describe('The body of operation 111. Only the reason: no credential, no address, no profile.');
export type CaptureDeviceRetireRequest = z.output<typeof CaptureDeviceRetireRequestSchema>;

export const CaptureDeviceRetirementSchema = z
  .strictObject({
    deviceId: z.string().regex(CAPTURE_RETIRABLE_DEVICE_ID_PATTERN).describe('The retired device: `CAM-NN` or `MIC-NN`. Never assigned again; never reused.'),
    device: CaptureDeviceStatusSchema.describe('The device entry after the change: `retiredAt` and `retiredBy` are set. No credential member exists.'),
    reason: z.enum(CaptureDeviceRetireReason),
    credentialDestroyed: z.boolean().describe('True when a stored credential existed and was destroyed in the same unit (a camera with a stored password). False for a microphone, a camera without one, and always in the simulator, which stores none.'),
  })
  .describe('The answer of operation 111: the retired device entry.');
export type CaptureDeviceRetirement = z.output<typeof CaptureDeviceRetirementSchema>;

/** The schemas operation 111 adds (merged into `CORE_API_SCHEMAS`). */
export const CAPTURE_RETIRE_SCHEMAS = {
  CaptureDeviceRetireRequest: CaptureDeviceRetireRequestSchema,
  CaptureDeviceRetirement: CaptureDeviceRetirementSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// The audit row
// ═══════════════════════════════════════════════════════════════════════════════════════

type AuditDetails = Record<string, string | number | boolean>;

/** `operationId` of CAPTURE_DEVICE_RETIRED: the one operation that retires a device. */
export const CAPTURE_DEVICE_RETIRE_OPERATION_ID = 'retireCaptureDevice';

export interface CaptureDeviceRetiredFacts {
  deviceId: string;
  kind: CaptureRetirableKind;
  reason: CaptureDeviceRetireReason;
  /** True when a stored credential existed and the retire unit destroyed it. */
  credentialDestroyed: boolean;
  /** The stream rows of the device kept for history (a whole number; 0 for a microphone). */
  streamRowsKept: number;
  permission?: string | null;
}

/**
 * `details` of CAPTURE_DEVICE_RETIRED: six required keys and one optional (the closed list of the
 * Core server's `core/audit-details.ts`). An id, two closed words, a flag, a count and the operation
 * - NEVER an address, an `onvif_uuid`, a serial, a port, a credential or text a device announced:
 * the function takes none of them, so no caller can hand one in.
 */
export function captureDeviceRetiredDetails(facts: CaptureDeviceRetiredFacts): AuditDetails {
  return {
    deviceId: facts.deviceId,
    kind: facts.kind,
    reason: facts.reason,
    credentialDestroyed: facts.credentialDestroyed,
    streamRowsKept: facts.streamRowsKept,
    operationId: CAPTURE_DEVICE_RETIRE_OPERATION_ID,
    ...(facts.permission ? { permission: facts.permission } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The operation
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CAPTURE_DEVICE_RETIRE_PATH = `${API_BASE_PATH}/capture/devices/{id}/retire`;

const R = CaptureRetireRefusalReason;
const RETIRE_409_REASONS = Object.keys(CAPTURE_RETIRE_REFUSAL_SENTENCES).join(', ');
const RETIRE_DEVICE_PARAM = {
  name: 'id',
  description: 'A registered camera or microphone of the capture devices, e.g. `CAM-03` or `MIC-03`. Never a candidate id and never an address.',
  pattern: HARDWARE_DEVICE_ID_PATTERN,
} as const;
const WEB_ONLY_REFUSED = `the operator's session is bound to a paired tablet or phone (NOT_PERMITTED, \`details.reason: ${WEB_CONSOLE_ONLY_REASON}\`; one ACCESS_DENIED audit row; refused before the body is used)`;

export const CAPTURE_RETIRE_OPERATIONS = [
  {
    operationId: CAPTURE_DEVICE_RETIRE_OPERATION_ID,
    method: 'post',
    path: CAPTURE_DEVICE_RETIRE_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Retire a registered camera or microphone',
    description: [
      '**Retires ONE registered camera or microphone for good.** Its stored credential is **destroyed** in the same unit of work; its registry row is **kept** with `retiredAt` and `retiredBy` set, together with its stream rows and its audio input row, so every sealed package and every audit row that names its id keeps its meaning. A retired device is **never assigned again**, never tested (operation 108), never given a credential (89) or an address (100), and it is no longer "registered" for an adoption: **adopting the same unit again (operations 95/96, or 99 for a microphone) gives a NEW id** - an id is never reused. There is no way back and no hard delete.',
      '**TECHNICIAN only, web console only.** Needs CAPTURE_COMMISSION, which the TECHNICIAN role alone holds, and a web console session (`WEB_CONSOLE_SESSION`): a session of a tablet or a phone is refused `403 NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and one ACCESS_DENIED row.',
      '**Idle only.** With a session open it answers `409 CAPTURE_CONFIG_LOCKED` and writes no audit row.',
      `**The body is the reason only**: \`REMOVED\`, \`REPLACED\` or \`STATEMENT_CHANGED\` - a closed set, so no free text reaches the audit row. No credential, address or profile member exists.`,
      `Refusals, each storing nothing and writing no audit row, in this order after the role, the web console and the idle lock: \`422 INVALID_INPUT\` for a body of another form; \`404 NOT_FOUND\` for an id the registry does not hold; \`409 INVALID_STATE\` with \`details.reason\` \`${R.CAPTURE_DEVICE_BUILT_IN}\` (a built-in device of the demonstration model - \`${CAPTURE_BUILT_IN_DEVICE_IDS.join('`, `')}\` - or any PoE switch), \`${R.CAPTURE_DEVICE_RETIRED}\` (retired already), \`${R.CAPTURE_DEVICE_ASSIGNED}\` (a slot of the device selector names it; \`details.slot\` names the slot: unassign it first) or \`${CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS}\` (operation 108 is testing this camera).`,
      '**On success writes one CAPTURE_DEVICE_RETIRED row** (category SECURITY): `deviceId`, `kind` (CAMERA or MIC), `reason`, `credentialDestroyed`, `streamRowsKept` (a count), `operationId` and `permission` - never an address, a hardware id, a serial or a credential. The answer is the device entry after the change. The `captureDevices` slice keeps the entry with `retiredAt` set: a client lists it as Retired and leaves it out of every selector and assignment list.',
      `${SIM_V2_NOTE} The simulator holds no credential: it retires a device it registered itself (an adopted camera) in its own state and writes the same CAPTURE_DEVICE_RETIRED row with \`credentialDestroyed: false\` and \`streamRowsKept: 0\`; its built-in devices answer \`${R.CAPTURE_DEVICE_BUILT_IN}\`. Same order of refusals as the Core server's.`,
    ].join('\n\n'),
    source: 'Task 4, row RD2 (design 07 sections 4.2-4.4), operation 111; decisions C146, C147 (rulings Q1-Q4) (not in the design book)',
    pathParam: RETIRE_DEVICE_PARAM,
    requestBody: { schema: 'CaptureDeviceRetireRequest', required: true },
    responses: {
      200: { description: 'The device is retired: its entry with `retiredAt` and `retiredBy`. No credential member exists.', schema: 'CaptureDeviceRetirement' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
      404: { description: 'The id names no device of the capture registry (NOT_FOUND). Nothing is changed.', schema: 'ApiError' },
      409: {
        description: `A session is open (CAPTURE_CONFIG_LOCKED; no audit row), or the device cannot be retired (INVALID_STATE, \`details.reason\`: ${RETIRE_409_REASONS}). Nothing is changed and no audit row is written.`,
        schema: 'ApiError',
      },
      422: { description: 'The body or the path parameter does not match its form (INVALID_INPUT). The refusal never quotes the input. Nothing is changed.', schema: 'ApiError' },
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: AuditType.CAPTURE_DEVICE_RETIRED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const retireRefusal = (summary: string, reason: CaptureRetireRefusal, details: Record<string, string> = {}) => ({
  summary,
  value: apiErrorExample('INVALID_STATE', CAPTURE_RETIRE_REFUSAL_SENTENCES[reason], { reason, ...details }),
});

const EXAMPLE_RETIRED_CAMERA = {
  id: 'CAM-03',
  kind: 'CAMERA',
  model: 'Example camera',
  firmware: null,
  host: '192.168.10.101',
  poePort: null,
  online: true,
  streamState: null,
  capabilities: ['VIDEO'],
  adapter: 'ONVIF_RTSP',
  sourceClass: 'PRODUCTION',
  // No stored profile in the example: a `code` member would read as a secret to the example rule (api-examples.test.ts).
  profiles: [],
  retiredAt: EXAMPLE_INSTANT_MS,
  retiredBy: 'OPR-003',
} as const satisfies z.output<typeof CaptureDeviceStatusSchema>;

export const CAPTURE_RETIRE_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  retireCaptureDevice: {
    pathParams: { id: 'CAM-03' },
    request: {
      statementChanged: { summary: 'The camera now states other stream profiles', value: { reason: CaptureDeviceRetireReason.STATEMENT_CHANGED } satisfies CaptureDeviceRetireRequest },
      replaced: { summary: 'A new unit takes its place', value: { reason: CaptureDeviceRetireReason.REPLACED } satisfies CaptureDeviceRetireRequest },
    },
    responses: {
      200: {
        retired: {
          summary: 'The camera is retired and its stored credential destroyed',
          value: { deviceId: 'CAM-03', device: EXAMPLE_RETIRED_CAMERA, reason: CaptureDeviceRetireReason.REPLACED, credentialDestroyed: true } satisfies CaptureDeviceRetirement,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: {
        ...deniedExamples(CAPTURE_DEVICE_RETIRE_OPERATION_ID, Permission.CAPTURE_COMMISSION, 'SUPERVISOR'),
        webConsoleOnly: {
          summary: 'A tablet or phone session on a web-console-only operation',
          description: 'The caller holds CAPTURE_COMMISSION, but the session is bound to a paired device. One ACCESS_DENIED row is written; the body is not used.',
          value: apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
            operationId: CAPTURE_DEVICE_RETIRE_OPERATION_ID,
            permission: Permission.CAPTURE_COMMISSION,
            role: 'TECHNICIAN',
            reason: WEB_CONSOLE_ONLY_REASON,
          }),
        },
      },
      404: { notFound: { summary: 'No such device', value: apiErrorExample('NOT_FOUND', 'The capture registry has no such device.') } },
      409: {
        locked: { summary: 'A session is open', value: apiErrorExample('CAPTURE_CONFIG_LOCKED', 'The capture configuration cannot be changed while a session is open.', { simCode: 'CAPTURE_CONFIG_LOCKED' }) },
        assigned: retireRefusal('A slot of the device selector names the device', R.CAPTURE_DEVICE_ASSIGNED, { slot: 'VIDEO-01' }),
        retired: retireRefusal('The device is retired already', R.CAPTURE_DEVICE_RETIRED),
        builtIn: retireRefusal('A built-in device of the demonstration model', R.CAPTURE_DEVICE_BUILT_IN),
        inProgress: retireRefusal('A connection test of this camera is running', CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS),
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput, invalidPathParameter: ERROR_EXAMPLES.invalidPathParameter },
    },
  },
};
