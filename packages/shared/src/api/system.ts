/**
 * Area 10 of the Core API: system and maintenance (backend task: 2026-10-04 01_specs §7.14, §7.17;
 * plan row W27, contract C).
 *
 * Five operations, answered by the Core server only.
 *
 * | # | operationId | Access | Audit on success | Simulator action |
 * |--:|-------------|--------|------------------|------------------|
 * | 64 | `getSystemStatus` | AUTHENTICATED | NONE-R | reads five slices |
 * | 65 | `runDiagnostics` | DIAGNOSTICS_RUN | DIAGNOSTICS_RUN | `runDiagnostics` |
 * | 66 | `restartServices` | MAINTENANCE | DEVICE_COMMAND (`details.scope: CORE_SERVICES`) | `restartServices` |
 * | 67 | `startSoftwareUpdate` | MAINTENANCE | UPDATE_STARTED (none when already running) | `startSoftwareUpdate` |
 * | 68 | `updateSettings` | AUTHENTICATED | NONE-P | `updateSettings`, `setPresentationMode` |
 *
 * The settings are display preferences of the console, documented as unaudited in the simulator;
 * the server writes no audit row for them and one log line (SR-82).
 */
import { z } from 'zod';
import { AuditType, Permission } from '../sim/vocabulary';
import { API_BASE_PATH } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, deniedExamples, simRefusalExample } from './example-parts';
import type { OperationExamples } from './examples';
import {
  INVALID_INPUT,
  INVALID_JSON,
  NOT_SIGNED_IN,
  STATE_READ_NOTE,
  backendSource,
  forbidden,
  hostedNote,
  notPermitted,
} from './operation-parts';
import { DIAGNOSTICS_RUN_ID_PATTERN } from './patterns';
import { count } from './schema-parts';
import { EXAMPLE_SLICES, STATE_EXAMPLE_IDS } from './state-examples';
import { REPLICATED_SLICE_SCHEMAS, SettingsSliceSchema, type SettingsSliceBody } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The service name of a component: lower-case words joined by `-` (a code, not free text). */
const COMPONENT_NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
/** `<major>.<minor>.<patch>` of a component (no prefix, no build word). */
const COMPONENT_VERSION_PATTERN = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
/** The release word of the capture worker (the form the Core's handshake accepts). */
const CAPTURE_WORKER_VERSION_PATTERN = /^capture-worker\/\d{1,4}\.\d{1,4}\.\d{1,4}$/;

export const SystemStatusSchema = z
  .strictObject({
    device: REPLICATED_SLICE_SCHEMAS.device,
    services: REPLICATED_SLICE_SCHEMAS.services,
    update: REPLICATED_SLICE_SCHEMAS.update,
    diagnostics: REPLICATED_SLICE_SCHEMAS.diagnostics,
    settings: REPLICATED_SLICE_SCHEMAS.settings,
    // Fix wave J, round two (finding JW-26; truth rule 3f): ONE version per component, stated by the Core itself.
    components: z
      .strictObject({
        core: z
          .strictObject({
            name: z.string().regex(COMPONENT_NAME_PATTERN).describe('The service name of the Core, as operation 1 states it (`service`).'),
            version: z.string().regex(COMPONENT_VERSION_PATTERN).describe('The version of the Core server: the value operation 1 answers as `version` and a sealed manifest states as `device.softwareVersion`.'),
          })
          .describe('The Core server itself.'),
        captureWorker: z
          .strictObject({
            version: z.string().regex(CAPTURE_WORKER_VERSION_PATTERN).describe('The release word of the capture worker this Core starts, `capture-worker/<major>.<minor>.<patch>`: the one version it accepts at the handshake.'),
          })
          .optional()
          .describe('The capture worker. Present on a Core in its own capture; absent on a Core in SIMULATED capture, which starts none.'),
        apiContract: z
          .strictObject({
            version: z.string().regex(COMPONENT_VERSION_PATTERN).describe('The version of the API contract document this Core serves (`info.version` of its OpenAPI document).'),
          })
          .describe('The API contract.'),
      })
      .optional()
      .describe(
        'Core server only: the versions of the components of THIS Core, each defined in one place. They are the only version statements about the real system: `device.softwareVersion`, `device.identity.coreSoftwareVersion`, `device.identity.tabletAppVersion` and the versions of the `update` slice are values of the hosted demonstration model and are never shown as the version of a Core in its own capture. The web console and the mobile app each state their OWN build version; the app version of a paired device is `appVersion` of the paired-devices list. Absent: Simulated mode, or an older Core.',
      ),
  })
  .describe('The system page of the Core: five slices of the Core state, each in its wire form, and the versions of its components.');
export type SystemStatus = z.output<typeof SystemStatusSchema>;

/** The versions a Core in its own capture states (fix wave J round two, JW-26). A Core in SIMULATED capture states no `captureWorker`. */
export const SYSTEM_COMPONENTS_EXAMPLE = {
  core: { name: 'dems-core-server', version: '0.2.0' },
  captureWorker: { version: 'capture-worker/0.5.0' },
  apiContract: { version: '0.3.0' },
} as const satisfies NonNullable<SystemStatus['components']>;

export const DiagnosticsRunStartedSchema = z
  .strictObject({
    runId: z.string().regex(DIAGNOSTICS_RUN_ID_PATTERN).describe('ID of the run, `DIAG-NNNNNN`. Its checks resolve in the `diagnostics` slice.'),
  })
  .describe('A diagnostics run was started, or one is still in progress.');
export type DiagnosticsRunStarted = z.output<typeof DiagnosticsRunStartedSchema>;

export const ServicesRestartedSchema = z
  .strictObject({
    restarted: count().describe('How many Core services were restarted: every one that was not stopped.'),
  })
  .describe('Result of a restart of the Core services.');
export type ServicesRestarted = z.output<typeof ServicesRestartedSchema>;

/**
 * The members of the `settings` slice, each optional. An open object, like every request body
 * (API-4): an unknown key is dropped, where the slice itself refuses one.
 */
export const SettingsUpdateRequestSchema = z
  .object(SettingsSliceSchema.shape)
  .partial()
  .describe('Request body of `POST /api/v1/settings`: the display preferences to change. A member that is left out keeps its value.');
export type SettingsUpdateRequest = z.output<typeof SettingsUpdateRequestSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const SYSTEM_SCHEMAS = {
  SystemStatus: SystemStatusSchema,
  DiagnosticsRunStarted: DiagnosticsRunStartedSchema,
  ServicesRestarted: ServicesRestartedSchema,
  SettingsUpdateRequest: SettingsUpdateRequestSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.14';
const SYSTEM_PATH = `${API_BASE_PATH}/system`;
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;
const MAINTENANCE = permissionAccess(Permission.MAINTENANCE);
const MAINTENANCE_REFUSED = notPermitted(Permission.MAINTENANCE);
const SESSION_OPEN = { description: 'A session is open: maintenance waits until it is closed (SESSION_ACTIVE).', schema: 'ApiError' } as const;
const UPDATE_REFUSED = { description: 'A session is open: maintenance waits until it is closed (SESSION_ACTIVE). Or the Core has no software updater (COMMAND_UNSUPPORTED, `details.reason: UPDATER_NOT_AVAILABLE`: a Core in its own capture).', schema: 'ApiError' } as const;

export const SYSTEM_OPERATIONS = [
  {
    operationId: 'getSystemStatus',
    method: 'get',
    path: `${SYSTEM_PATH}/status`,
    tag: CoreApiTag.SYSTEM,
    mode: CoreApiMode.LIVE,
    summary: 'System status',
    description: [
      'The Core device, its services, the software update, the newest diagnostics run and the display preferences. Slices `device`, `services`, `update`, `diagnostics` and `settings`.',
      'Schema v2 (C3 §3 op 64; CS-10; NM-02; OD-24): the services slice adds `capture-worker` and `transcriber`, and capture telemetry feeds their health (the dataset list grows with M2-W9; the B11 surfacing is M3-W6).',
      STATE_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 64),
    responses: {
      200: { description: 'The five slices.', schema: 'SystemStatus' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'runDiagnostics',
    method: 'post',
    path: `${SYSTEM_PATH}/diagnostics`,
    tag: CoreApiTag.SYSTEM,
    mode: CoreApiMode.LIVE,
    summary: 'Run diagnostics',
    description: [
      'Starts a diagnostics run (simulated) and answers `202` with its ID. The checks resolve on the Core over the next seconds, in the `diagnostics` slice.',
      'Writes DIAGNOSTICS_RUN. While a run is in progress the answer is the ID of that run, and nothing is written.',
      hostedNote('runDiagnostics'),
    ].join('\n\n'),
    source: backendSource(SECTION, 65),
    responses: {
      202: { description: 'The run that is in progress.', schema: 'DiagnosticsRunStarted' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.DIAGNOSTICS_RUN),
    },
    access: permissionAccess(Permission.DIAGNOSTICS_RUN),
    audit: { success: AuditType.DIAGNOSTICS_RUN, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'restartServices',
    method: 'post',
    path: `${SYSTEM_PATH}/services/restart`,
    tag: CoreApiTag.SYSTEM,
    mode: CoreApiMode.LIVE,
    summary: 'Restart the Core services',
    description: [
      'Restarts the Core services (simulated): every service that is not stopped starts again now. It is refused while a session is open. The Core server process itself is not restarted.',
      'Schema v2 (C3 §3 op 66; CS-10; OD-24): the restart also covers the capture worker and the transcriber.',
      'Writes DEVICE_COMMAND with `details.scope: CORE_SERVICES`.',
      hostedNote('restartServices'),
    ].join('\n\n'),
    source: backendSource(SECTION, 66),
    responses: {
      200: { description: 'The services restarted.', schema: 'ServicesRestarted' },
      401: NOT_SIGNED_IN,
      403: MAINTENANCE_REFUSED,
      409: SESSION_OPEN,
    },
    access: MAINTENANCE,
    audit: { success: AuditType.DEVICE_COMMAND, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'startSoftwareUpdate',
    method: 'post',
    path: `${SYSTEM_PATH}/update`,
    tag: CoreApiTag.SYSTEM,
    mode: CoreApiMode.LIVE,
    summary: 'Start the software update',
    description: [
      'Starts the simulated A/B software update and answers `202` without a body. Its six steps resolve on the Core, in the `update` slice. It is refused while a session is open. No software is installed: the server and the apps keep their version.',
      'Writes UPDATE_STARTED. When an update is already running, or no version is available, nothing changes, nothing is written, and the answer is still `202`.',
      'Fix wave J: a Core in its own capture has no updater - the `update` slice states `updaterNotAvailable: true` and this operation answers `409 COMMAND_UNSUPPORTED` with `details.reason: UPDATER_NOT_AVAILABLE`; nothing is started and nothing is written.',
      hostedNote('startSoftwareUpdate'),
    ].join('\n\n'),
    source: backendSource(SECTION, 67),
    responses: {
      202: { description: 'The update is running, or nothing changed.' },
      401: NOT_SIGNED_IN,
      403: MAINTENANCE_REFUSED,
      409: UPDATE_REFUSED,
    },
    access: MAINTENANCE,
    audit: { success: AuditType.UPDATE_STARTED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'updateSettings',
    method: 'post',
    path: `${API_BASE_PATH}/settings`,
    tag: CoreApiTag.SYSTEM,
    mode: CoreApiMode.LIVE,
    summary: 'Change the display preferences',
    description: [
      'Changes display preferences of the console: presentation mode, the time format and the two notification switches. The body names the members to change, and the answer is the `settings` slice after the change.',
      'Every signed-in role may call it. Writes no audit row: these are preferences, not evidence.',
      hostedNote('updateSettings'),
    ].join('\n\n'),
    source: backendSource(SECTION, 68),
    requestBody: { schema: 'SettingsUpdateRequest', required: true },
    responses: {
      200: { description: 'The preferences after the change: the `settings` slice.', schema: 'SettingsSlice' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: forbidden(),
      422: INVALID_INPUT,
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const MAINTENANCE_DENIED = (operationId: string) => deniedExamples(operationId, 'MAINTENANCE', 'SUPERVISOR');
const sessionActive = (event: string) => ({
  sessionActive: simRefusalExample(
    'A session is open',
    'SESSION_ACTIVE',
    `Session ${STATE_EXAMPLE_IDS.openSessionId} is active.`,
    'SESSION_ACTIVE',
    { from: 'RECORDING', event },
  ),
});

export const SYSTEM_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getSystemStatus: {
    responses: {
      200: {
        idle: {
          summary: 'Seventeen services running, version 2.5.0 available, no diagnostics run yet',
          value: {
            device: EXAMPLE_SLICES.device,
            services: EXAMPLE_SLICES.services,
            update: EXAMPLE_SLICES.update,
            diagnostics: EXAMPLE_SLICES.diagnostics,
            settings: EXAMPLE_SLICES.settings,
          } satisfies SystemStatus,
        },
        ownCapture: {
          summary: 'A Core in its own capture: the same five slices and the versions of its components (the update and identity values are the demonstration model\'s, not versions of this Core)',
          value: {
            device: EXAMPLE_SLICES.device,
            services: EXAMPLE_SLICES.services,
            update: EXAMPLE_SLICES.update,
            diagnostics: EXAMPLE_SLICES.diagnostics,
            settings: EXAMPLE_SLICES.settings,
            components: SYSTEM_COMPONENTS_EXAMPLE,
          } satisfies SystemStatus,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  runDiagnostics: {
    responses: {
      202: { started: { summary: 'A run was started', value: { runId: STATE_EXAMPLE_IDS.diagnosticsRunId } satisfies DiagnosticsRunStarted } },
      401: SIGNED_OUT,
      // Every seeded role holds DIAGNOSTICS_RUN, so no seeded operator can be shown as refused for it.
      403: BASIC_403_EXAMPLES,
    },
  },
  restartServices: {
    responses: {
      200: { restarted: { summary: 'All seventeen services restarted', value: { restarted: 17 } satisfies ServicesRestarted } },
      401: SIGNED_OUT,
      403: MAINTENANCE_DENIED('restartServices'),
      409: sessionActive('restartServices'),
    },
  },
  startSoftwareUpdate: {
    responses: {
      401: SIGNED_OUT,
      403: MAINTENANCE_DENIED('startSoftwareUpdate'),
      409: {
        ...sessionActive('startSoftwareUpdate'),
        // Fix wave J (JT-06 / JW-06): a Core in its own capture has no updater.
        updaterNotAvailable: simRefusalExample('A Core in its own capture: it has no software updater', 'COMMAND_UNSUPPORTED', 'Software update is not available on this Core.', 'COMMAND_UNSUPPORTED', {
          reason: 'UPDATER_NOT_AVAILABLE',
        }),
      },
    },
  },
  updateSettings: {
    request: {
      presentation: { summary: 'Switch presentation mode on', value: { presentationMode: true } satisfies SettingsUpdateRequest },
      twelveHour: { summary: 'Twelve-hour time, no warning notifications', value: { timeFormat: '12', notifyWarnings: false } satisfies SettingsUpdateRequest },
    },
    responses: {
      200: {
        changed: {
          summary: 'Presentation mode is on',
          value: { ...EXAMPLE_SLICES.settings, presentationMode: true } satisfies SettingsSliceBody,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
};
