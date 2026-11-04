/**
 * Area 13 of the Core API: demo controls (backend task: 2026-10-04 01_specs §7.16, §7.18, §12).
 *
 * Five operations, answered by the Core server only. All five need DEMO_CONTROL **and** the
 * server-side demo flag: a caller without the permission gets `403 NOT_PERMITTED` whatever the
 * flag; a permitted caller with the flag off gets `403 DEMO_DISABLED` (DC-1, DC-2). In Simulated
 * mode the same controls need no sign-in; that stays as it is.
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 71 | `getDemoStatus` | DEMO_CONTROL and the demo flag | NONE-R |
 * | 72 | `loadScenario` | DEMO_CONTROL and the demo flag | SCENARIO_LOADED |
 * | 73 | `injectFault` | DEMO_CONTROL and the demo flag | FAULT_RAISED (AUDIT_CHAIN_DISCONTINUITY for the kind AUDIT_TAMPER) |
 * | 74 | `clearFault` | DEMO_CONTROL and the demo flag | FAULT_CLEARED (none when nothing matches) |
 * | 75 | `resetDemo` | DEMO_CONTROL and the demo flag | SCENARIO_LOADED (`details.reset: true`) |
 *
 * The fault kinds, their targets and the scenario names are the shared ones (`sim/vocabulary.ts`,
 * `sim/types.ts` `FaultTarget`).
 */
import { z } from 'zod';
import { TimeSource, TrackId, VIDEO_TRACK_IDS } from '../domain/enums'; // VIDEO_TRACK_IDS: D60 (2026-11-04), the four-track CAMERA_LOSS target enum
import { AuditType, FaultKind, Permission, ScenarioName } from '../sim/vocabulary';
import { API_BASE_PATH } from './constants';
import {
  CORE_SERVER_ONLY,
  CoreApiAccessCondition,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { ERROR_EXAMPLES, apiErrorExample, exampleTime, notPermittedExample } from './example-parts';
import type { OperationExamples } from './examples';
import {
  CORE_SERVER_NOTE,
  DEMO_FLAG_OFF,
  INVALID_INPUT,
  INVALID_JSON,
  NOT_SIGNED_IN,
  backendSource,
  notPermitted,
} from './operation-parts';
import { EVIDENCE_ID_PATTERN } from './patterns';
import { epochMs, nullableEpochMs } from './schema-parts';
import { apiText } from './text';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Counts demo resets and scenario loads; it continues (previous plus 1) and is never reused. */
const epoch = () => z.int().nonnegative();

export const FaultTargetSchema = z
  .strictObject({
    channel: z
      .enum([TrackId.AUDIO_01, TrackId.AUDIO_02])
      .optional()
      .describe('For MIC_NO_SIGNAL (default AUDIO-01) and MIC_CLIP (default AUDIO-02).'),
    // D60 (2026-11-04): CAMERA_LOSS can target any of the FOUR recorded tracks (was the two-track pair).
    cameraId: z.enum(VIDEO_TRACK_IDS).optional().describe('For CAMERA_LOSS (default: the active camera; D60: one of the four video tracks).'),
    auditIndex: z
      .int()
      .nonnegative()
      .optional()
      .describe('For AUDIT_TAMPER: the position in the audit view (default: 5 rows from the end).'),
    fallback: z
      .enum([TimeSource.NTP, TimeSource.RTC])
      .optional()
      .describe('For GNSS_LOSS: the tier the time service lands on (default NTP).'),
    evidenceId: z
      .string()
      .regex(EVIDENCE_ID_PATTERN)
      .optional()
      .describe('Turns TAMPER into the evidence media tamper instead of the enclosure tamper switch.'),
    trackId: z.enum(TrackId).optional().describe('With `evidenceId`: the track that fails verification (default AUDIO-02).'),
  })
  .describe('Optional target of a fault: the members of the simulator\'s `FaultTarget`.');
export type FaultTargetBody = z.output<typeof FaultTargetSchema>;

/**
 * STRICT (wave H closing pass Z1; ruling D206 (3); gate findings G70-09 / G75-14): a member the
 * contract does not name is `422 INVALID_INPUT`, here and inside `target`. A body with a top-level
 * `cameraId` used to be accepted with the member dropped, and the fault was raised on the default
 * camera - a request that says one thing and does another.
 */
export const DemoFaultRequestSchema = z
  .strictObject({
    kind: z.enum(FaultKind),
    target: FaultTargetSchema.optional(),
  })
  .describe('Request body of `POST /api/v1/demo/faults` and `POST /api/v1/demo/faults/clear`. Strict: an unknown member, here or in `target`, is refused with 422.');
export type DemoFaultRequest = z.output<typeof DemoFaultRequestSchema>;

export const ScenarioLoadRequestSchema = z
  .object({
    name: z.enum(ScenarioName).describe('`idle`, `recording`, `finalizing` or `fault-demo`.'),
  })
  .describe('Request body of `POST /api/v1/demo/scenario`.');
export type ScenarioLoadRequest = z.output<typeof ScenarioLoadRequestSchema>;

export const DemoEpochSchema = z
  .strictObject({
    epoch: epoch().describe('The epoch the Core state now has. Every operator socket receives a new snapshot with it.'),
  })
  .describe('Result of a scenario load or a reset.');
export type DemoEpoch = z.output<typeof DemoEpochSchema>;

export const DemoStatusSchema = z
  .strictObject({
    scenarios: z.array(z.enum(ScenarioName)).describe('The scenarios the server can load.'),
    scenario: z.enum(ScenarioName).describe('The scenario that is loaded.'),
    activeFaults: z
      .array(
        z.object({
          kind: z.enum(FaultKind),
          since: epochMs(),
          target: apiText().nullable(),
        }),
      )
      .describe('The faults that are injected and not cleared: the simulator\'s `faults` slice.'),
    seededAt: epochMs(),
    lastResetAt: nullableEpochMs().describe('Null until the first reset or scenario load.'),
    epoch: epoch(),
    // Schema v2 (task 3 M2-W7; C3 §3 op 71; CS-23; OD-18): in real-capture mode the status names
    // the demo state explicitly. Optional until the demo module reports it (M2-W10, row 52).
    demo: z
      .enum(['ENABLED', 'DISABLED'])
      .optional()
      .describe('Schema v2: DISABLED in real-capture mode, where hardware faults are off (OD-18).'),
  })
  .describe('State of the demo controls (schema v2 adds the explicit `demo` state).');
export type DemoStatus = z.output<typeof DemoStatusSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const DEMO_SCHEMAS = {
  FaultTarget: FaultTargetSchema,
  DemoFaultRequest: DemoFaultRequestSchema,
  ScenarioLoadRequest: ScenarioLoadRequestSchema,
  DemoEpoch: DemoEpochSchema,
  DemoStatus: DemoStatusSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.16';
const DEMO_PATH = `${API_BASE_PATH}/demo`;
const DEMO_CONTROL = {
  ...permissionAccess(Permission.DEMO_CONTROL),
  conditions: [CoreApiAccessCondition.DEMO_FLAG],
} as const;
const DEMO_REFUSED = notPermitted(Permission.DEMO_CONTROL, DEMO_FLAG_OFF);
const GATE = 'Needs DEMO_CONTROL and the server-side demo flag, which is off unless the server was started with it.';
/** Schema v2 (task 3 M2-W7; C3 §3 ops 71-74; CS-23; OD-18): the real-capture fence, enforced by M2-W10 (row 52). */
const REAL_FENCE =
  'Schema v2 (C3 §3; OD-18; CS-23): in **real-capture mode** the capture-config module keeps the demo flag off, so this operation answers `403 DEMO_DISABLED` after the permission check — hardware faults are never injected into a real capture. Simulated mode is unchanged.';

/**
 * `details.reason` of the `503 NOT_READY` of a scenario load or a reset that did not happen (W83,
 * gap W43-1). The 503 that another request gets WHILE a rebuild runs names no reason.
 */
export const DemoRebuildRefusalReason = {
  /** Another reset of this Core's database is running: try again. */
  RESET_IN_PROGRESS: 'RESET_IN_PROGRESS',
  /** This rebuild did not happen: the state is unchanged, or the server is not ready. */
  RESET_FAILED: 'RESET_FAILED',
} as const;
export type DemoRebuildRefusalReason = (typeof DemoRebuildRefusalReason)[keyof typeof DemoRebuildRefusalReason];

const REBUILD_REFUSED =
  'When the rebuild cannot run, the answer is `503 NOT_READY` with `details.reason`: `RESET_IN_PROGRESS` when another reset of this Core\'s database is running (try again), or `RESET_FAILED` when this one did not happen (the state is unchanged, or the server is not ready).';
const REBUILD =
  'The Core state is rebuilt from the seed, so the audit chain restarts; the discarded chain is kept in the chain lineage. Auth sessions, paired devices, biometric tokens, settings and pairing codes are kept: nobody is signed out and no device has to pair again. While the rebuild runs, every other request answers `503 NOT_READY`.';

export const DEMO_OPERATIONS = [
  {
    operationId: 'getDemoStatus',
    method: 'get',
    path: `${DEMO_PATH}/status`,
    tag: CoreApiTag.DEMO,
    mode: CoreApiMode.LIVE,
    summary: 'Demo status',
    description: [
      'The scenarios the server can load, the one that is loaded, the injected faults, and when the state was seeded and last reset.',
      'Schema v2 (C3 §3 op 71; OD-18): in real-capture mode the answer reports `demo: DISABLED` — hardware faults are off there.',
      GATE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 71),
    responses: {
      200: { description: 'The demo status.', schema: 'DemoStatus' },
      401: NOT_SIGNED_IN,
      403: DEMO_REFUSED,
    },
    access: DEMO_CONTROL,
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'loadScenario',
    method: 'post',
    path: `${DEMO_PATH}/scenario`,
    tag: CoreApiTag.DEMO,
    mode: CoreApiMode.LIVE,
    summary: 'Load a scenario',
    description: [
      'Loads one of the four scenarios: `idle`, `recording`, `finalizing`, `fault-demo`.',
      REBUILD,
      'Writes SCENARIO_LOADED as the first row after the seed history of the new chain; it names the operator, the scenario, and the head hash and row count of the discarded chain.',
      REBUILD_REFUSED,
      REAL_FENCE,
      GATE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 72),
    requestBody: { schema: 'ScenarioLoadRequest', required: true },
    responses: {
      200: { description: 'Loaded; the new epoch.', schema: 'DemoEpoch' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: DEMO_REFUSED,
      422: INVALID_INPUT,
    },
    access: DEMO_CONTROL,
    audit: { success: AuditType.SCENARIO_LOADED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'injectFault',
    method: 'post',
    path: `${DEMO_PATH}/faults`,
    tag: CoreApiTag.DEMO,
    mode: CoreApiMode.LIVE,
    summary: 'Inject a fault',
    description: [
      'Raises one of the twelve fault kinds, with an optional target. A critical fault during a session moves it to FAULT. Every raised fault creates an alert.',
      'Writes FAULT_RAISED; the kind AUDIT_TAMPER writes AUDIT_CHAIN_DISCONTINUITY instead. A fault that is already active writes nothing and still answers `204`.',
      'AUDIT_TAMPER alters only the audit view the engine holds, never the stored table. TAMPER with an evidence target sets the item\'s tamper flag; the sealed hashes, the manifest hash and the signature are not changed.',
      REAL_FENCE,
      GATE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 73),
    requestBody: { schema: 'DemoFaultRequest', required: true },
    responses: {
      204: { description: 'The fault is active.' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: DEMO_REFUSED,
      404: { description: 'The target does not exist, for example an unknown evidence ID (NOT_FOUND).', schema: 'ApiError' },
      422: INVALID_INPUT,
    },
    access: DEMO_CONTROL,
    audit: { success: AuditType.FAULT_RAISED, denial: AuditType.ACCESS_DENIED, also: [AuditType.AUDIT_CHAIN_DISCONTINUITY] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'clearFault',
    method: 'post',
    path: `${DEMO_PATH}/faults/clear`,
    tag: CoreApiTag.DEMO,
    mode: CoreApiMode.LIVE,
    summary: 'Clear a fault',
    description: [
      'Clears an injected fault of that kind and target. Writes FAULT_CLEARED; when nothing matches it writes nothing and still answers `204`.',
      REAL_FENCE,
      GATE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 74),
    requestBody: { schema: 'DemoFaultRequest', required: true },
    responses: {
      204: { description: 'No such fault is active now.' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: DEMO_REFUSED,
      422: INVALID_INPUT,
    },
    access: DEMO_CONTROL,
    audit: { success: AuditType.FAULT_CLEARED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'resetDemo',
    method: 'post',
    path: `${DEMO_PATH}/reset`,
    tag: CoreApiTag.DEMO,
    mode: CoreApiMode.LIVE,
    summary: 'Reset to the seed state',
    description: [
      'Resets the Core to the seed state: the scenario `idle`.',
      REBUILD,
      'Schema v2 (C3 §3 op 75; CS-21; OD-19; SEC35-22): while a REAL sealed package exists — in the store or on disk — the reset refuses `409 RESET_BLOCKED_REAL_EVIDENCE` and audits the refusal; capture_config, capture_devices and capture_device_credentials are KEPT tables (row 54\'s keep-set), so the selector and its credentials survive every allowed reset.',
      'Writes SCENARIO_LOADED with `details.reset: true`.',
      REBUILD_REFUSED,
      GATE,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 75),
    responses: {
      200: { description: 'Reset; the new epoch.', schema: 'DemoEpoch' },
      401: NOT_SIGNED_IN,
      403: DEMO_REFUSED,
      409: {
        description: 'Real sealed evidence exists and the reset would destroy it (RESET_BLOCKED_REAL_EVIDENCE; C3 §3 op 75).',
        schema: 'ApiError',
      },
    },
    access: DEMO_CONTROL,
    audit: { success: AuditType.SCENARIO_LOADED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const DENIED_403 = (operationId: string) => ({
  notPermitted: notPermittedExample(operationId, 'DEMO_CONTROL', 'TECHNICIAN'),
  demoDisabled: ERROR_EXAMPLES.demoDisabled,
  deviceRevoked: ERROR_EXAMPLES.deviceRevoked,
  originNotAllowed: ERROR_EXAMPLES.originNotAllowed,
});

const MIC_FAULT = { kind: 'MIC_NO_SIGNAL', target: { channel: 'AUDIO-02' } } as const satisfies DemoFaultRequest;

export const DEMO_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getDemoStatus: {
    responses: {
      200: {
        idle: {
          summary: 'Seeded, never reset, no fault',
          value: {
            scenarios: ['idle', 'recording', 'finalizing', 'fault-demo'],
            scenario: 'idle',
            activeFaults: [],
            seededAt: exampleTime(-60),
            lastResetAt: null,
            epoch: 0,
          } satisfies DemoStatus,
        },
        withFault: {
          summary: 'The recording scenario with one microphone fault',
          value: {
            scenarios: ['idle', 'recording', 'finalizing', 'fault-demo'],
            scenario: 'recording',
            activeFaults: [{ kind: 'MIC_NO_SIGNAL', since: exampleTime(-1), target: 'AUDIO-02' }],
            seededAt: exampleTime(-60),
            lastResetAt: exampleTime(-10),
            epoch: 1,
          } satisfies DemoStatus,
        },
      },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: DENIED_403('getDemoStatus'),
    },
  },
  loadScenario: {
    request: {
      recording: { summary: 'The recording scenario', value: { name: 'recording' } satisfies ScenarioLoadRequest },
    },
    responses: {
      200: { loaded: { summary: 'Loaded: the epoch moved on', value: { epoch: 1 } satisfies DemoEpoch } },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: DENIED_403('loadScenario'),
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  injectFault: {
    request: {
      micNoSignal: { summary: 'No signal on MIC 2', value: MIC_FAULT },
      storageFull: { summary: 'Storage full (critical)', value: { kind: 'STORAGE_FULL' } satisfies DemoFaultRequest },
    },
    responses: {
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: DENIED_403('injectFault'),
      404: { notFound: { summary: 'Unknown evidence target', value: apiErrorExample('NOT_FOUND', 'Evidence not found.') } },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  clearFault: {
    request: {
      micNoSignal: { summary: 'Clear the fault on MIC 2', value: MIC_FAULT },
    },
    responses: {
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: DENIED_403('clearFault'),
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  resetDemo: {
    responses: {
      200: { reset: { summary: 'Reset: the epoch moved on', value: { epoch: 2 } satisfies DemoEpoch } },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: DENIED_403('resetDemo'),
      409: {
        realEvidence: {
          summary: 'Real sealed evidence exists (C3 §3 op 75; SEC35-22)',
          value: apiErrorExample('RESET_BLOCKED_REAL_EVIDENCE', 'The demo reset is blocked because real sealed evidence exists.'),
        },
      },
    },
  },
};
