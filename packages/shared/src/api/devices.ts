/**
 * Area 6 of the Core API: devices and inputs (backend task: 2026-10-04 01_specs §7.10, §7.17; plan
 * row W27, contract C).
 *
 * Nine operations make up the area. Three are design-book operations and live in `core-api.ts`
 * (44 `getDeviceHealth`, 45 `getAudioStatus`, 46 `getVideoStatus`); the six below are answered by
 * the Core server only.
 *
 * | # | operationId | Access | Audit on success | Simulator action |
 * |--:|-------------|--------|------------------|------------------|
 * | 47 | `getDeviceInventory` | AUTHENTICATED | NONE-R | reads seven slices |
 * | 48 | `restartDevice` | DEVICE_MANAGE | DEVICE_COMMAND | `deviceCommand` (RESTART) |
 * | 49 | `testDeviceSignal` | DIAGNOSTICS_RUN | DEVICE_COMMAND | `deviceCommand` (TEST_SIGNAL) |
 * | 50 | `identifyDevice` | DIAGNOSTICS_RUN | DEVICE_COMMAND | `deviceCommand` (IDENTIFY) |
 * | 51 | `setActiveCamera` | AUTHENTICATED | NONE-P | `setActiveCamera` |
 * | 52 | `resetMicClip` | AUTHENTICATED | NONE-P | `resetClip` |
 *
 * The simulator's `deviceCommand` needs a different permission per command, so it is three
 * operations here and each has one permission. `{id}` is a device of the Core itself (`CAM-01`,
 * `MIC-02`, `GNSS`, `TPM`, `FRONT-PANEL`), never a paired device of the registry (`DEV-NNNN`).
 */
import { z } from 'zod';
import { VIDEO_TRACK_IDS, TrackId } from '../domain/enums';
import { MIC_CHANNEL_IDS } from '../sim/vocabulary'; // D61 (2026-11-04): the four microphone channels
import { AuditType, DeviceCommand, Permission } from '../sim/vocabulary';
import { CAMERA_PREVIEW_SESSION_TTL_MS, CAMERA_PREVIEW_TOKEN_PREFIX, IDLE_METER_LEASE_MS } from './capture';
import { API_BASE_PATH } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAccessCondition,
  CoreApiAccessKind,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  WEB_CONSOLE_ONLY_REASON,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, apiErrorExample, deniedExamples, simRefusalExample } from './example-parts';
import type { OperationExamples } from './examples';
import {
  INVALID_INPUT,
  INVALID_JSON,
  CORE_SERVER_NOTE,
  INVALID_PATH_PARAMETER,
  NOT_SIGNED_IN,
  SIM_V2_NOTE,
  STATE_READ_NOTE,
  backendSource,
  forbidden,
  hostedNote,
  notPermitted,
} from './operation-parts';
import { HARDWARE_DEVICE_ID_PATTERN, MIC_INPUT_ID_PATTERN } from './patterns';
import { epochMs, trimmedText } from './schema-parts';
import { apiText } from './text';
import { EXAMPLE_SLICES, STATE_EXAMPLE_IDS } from './state-examples';
import { REPLICATED_SLICE_SCHEMAS } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

export const DeviceInventorySchema = z
  .strictObject({
    device: REPLICATED_SLICE_SCHEMAS.device,
    cameras: REPLICATED_SLICE_SCHEMAS.cameras,
    mics: REPLICATED_SLICE_SCHEMAS.mics,
    otherDevices: REPLICATED_SLICE_SCHEMAS.otherDevices,
    ports: REPLICATED_SLICE_SCHEMAS.ports,
    activeCameraId: REPLICATED_SLICE_SCHEMAS.activeCameraId,
    tabletLink: REPLICATED_SLICE_SCHEMAS.tabletLink,
    // Schema v2 (task 3 M2-W7; register SH-12; C3 §3 op 47): the capture-config snapshot joins the
    // inventory. It is the replicated slice in its wire form (API-6) — never the paired-client
    // registry (E-04) and never a credential (RK-12).
    captureConfig: REPLICATED_SLICE_SCHEMAS.captureConfig,
  })
  .describe('The devices of the Core: eight slices of the Core state, each in its wire form (schema v2 adds `captureConfig`).');
export type DeviceInventory = z.output<typeof DeviceInventorySchema>;

export const ActiveCameraRequestSchema = z
  .object({
    cameraId: z.enum([TrackId.VIDEO_01, TrackId.VIDEO_02, TrackId.VIDEO_03, TrackId.VIDEO_04]).describe('The camera the monitor shows: one of the four video tracks (D60, 2026-11-04).'), // D60: the enum was widened; the text still said two
  })
  .describe('Request body of `POST /api/v1/video/active-camera`.');
export type ActiveCameraRequest = z.output<typeof ActiveCameraRequestSchema>;

export const MicClipResetRequestSchema = z
  .object({
    channel: z.enum([TrackId.AUDIO_01, TrackId.AUDIO_02, TrackId.AUDIO_03, TrackId.AUDIO_04]).describe('The audio channel whose CLIP latch is reset: `AUDIO-01`..`AUDIO-04` (D61, 2026-11-04: four simultaneous channels).'),
  })
  .describe('Request body of `POST /api/v1/audio/clip/reset`.');
export type MicClipResetRequest = z.output<typeof MicClipResetRequestSchema>;

/**
 * Optional request body of `restartDevice` (schema v2; C3 §3 op 48; OD-22). A camera restart is a
 * PoE cycle and requires `{ confirm: true }`; mics and other devices keep the bodyless restart.
 */
export const RestartDeviceRequestSchema = z
  .strictObject({
    confirm: z.boolean().optional().describe('Must be `true` to cycle the PoE port of a camera (OD-22); ignored for other devices.'),
  })
  .describe('Optional request body of `POST /api/v1/device/{id}/restart` (schema v2: the PoE-cycle confirmation).');
export type RestartDeviceRequest = z.output<typeof RestartDeviceRequestSchema>;

// ── Operations 76-80 and 89: the capture-config selector (task 3 M2-W7; register SH-12; C3 §2) ──

/** One camera line of the whole-config update (op 78): the device and profile per video track. */
export const CaptureConfigCameraUpdateSchema = z
  .strictObject({
    trackId: z.enum([TrackId.VIDEO_01, TrackId.VIDEO_02, TrackId.VIDEO_03, TrackId.VIDEO_04]),
    deviceId: z.string().regex(HARDWARE_DEVICE_ID_PATTERN).describe('A capture device of the registry, e.g. `CAM-01` (`dbc-3 §B.2`).'),
    profile: trimmedText(64)
      .optional()
      .describe('Media profile code (open set, OD-06/OD-07); absent: the device default.'),
  })
  .describe('One camera line of `CaptureConfigUpdate`: which capture device feeds which video track.');
export type CaptureConfigCameraUpdate = z.output<typeof CaptureConfigCameraUpdateSchema>;

/**
 * One mic line of the whole-config update (op 78). Two forms (decision D133 (1) generalized by
 * D61 of 2026-11-04: the roles became the four numbered channels; task 4 rule MIC-ASSIGN, decision
 * C21 (8), names register of row 161 section 4.2):
 *
 *   - WITHOUT `channel` (the form published first, still valid): the line edits the input it names,
 *     which must be one of the inputs the selector holds; the transcription channel moves through op 80;
 *   - WITH `channel` on every line (by channel): one to four lines, no channel twice, each
 *     `deviceId` equal to its `inputId`. Each line puts its input on the slot of its channel; the
 *     slot of a channel the body does not name keeps what it holds. The lines over the channels a
 *     plan carries are the replacing set of D133 (1). It is the only way to put a microphone
 *     registered later (`MIC-05` and up) behind the capture, and the only way to fill a microphone
 *     channel that is not assigned.
 *
 * A body that mixes the two forms is `422 INVALID_INPUT`.
 */
export const CaptureConfigMicUpdateSchema = z
  .strictObject({
    inputId: z.string().regex(MIC_INPUT_ID_PATTERN).describe('A mic input of the selector, `MIC-NN`.'),
    deviceId: z.string().regex(HARDWARE_DEVICE_ID_PATTERN).describe('A capture device of the registry, e.g. `MIC-01`.'),
    transport: trimmedText(32)
      .optional()
      .describe('Transport code (open set, e.g. `POE`, `USB`, `ANALOG`); absent: the device default.'),
    channel: z
      .enum(MIC_CHANNEL_IDS)
      .optional()
      .describe('BY CHANNEL (D133 (1) generalized by D61, 2026-11-04: a channel is assignable alone): when every line carries `channel`, each line puts its input on the slot of its channel - one to four lines, no channel twice, each with `deviceId` equal to `inputId`, any registered `MIC-NN`; the slot of a channel the body does not name keeps what it holds, and the named channels are the replacing set. Absent on every line: the line edits the input it names (the earlier form).'),
  })
  .describe('One mic line of `CaptureConfigUpdate`: which capture device stands behind which input; with `channel`, the input that takes the slot of that channel (D61: four numbered channels).');
export type CaptureConfigMicUpdate = z.output<typeof CaptureConfigMicUpdateSchema>;

/**
 * The EIGHT slots of the device selector, in their order (task 4 row 28; WP-13a; names register
 * N2; D60 of 2026-11-04: four video tracks; D61 of 2026-11-04: the two microphone roles became the
 * four numbered channels): the FOUR video tracks, then the four microphone channels. They are the
 * values the member `unassign` of operation 78 takes - the `trackId` of a camera line and the
 * `channel` of a mic line of the same body, never the stored value set of `session_capture_sources`.
 */
export const CAPTURE_SELECTOR_SLOTS = [...VIDEO_TRACK_IDS, ...MIC_CHANNEL_IDS] as const; // D61 (2026-11-04): eight slots, four per medium

/** The slots a body of operation 78 assigns: the `trackId` of each camera line and the `channel` of each mic line that states one. */
function slotsAssignedBy(body: {
  readonly cameras?: readonly { readonly trackId: string }[] | undefined;
  readonly mics?: readonly { readonly channel?: string | undefined }[] | undefined;
}): ReadonlySet<string> {
  const slots = new Set<string>();
  for (const camera of body.cameras ?? []) slots.add(camera.trackId);
  for (const mic of body.mics ?? []) if (mic.channel !== undefined) slots.add(mic.channel);
  return slots;
}

/**
 * Request body of op 78: the whole selector at once; every member optional (partial update).
 *
 * `unassign` (task 4 row 28; decision C14; security requirement AD-10): the slots the body CLEARS.
 * An unassigned slot is an absent line of the selector. Two rules of the body are held here
 * (AD-10 (3); names register section 4.3), both `422 INVALID_INPUT` on the path `unassign`:
 * no slot twice, and no slot that the same body assigns (the `trackId` of a camera line, the
 * `channel` of a mic line). A mic line WITHOUT `channel` that edits the input a cleared slot holds
 * is refused by the hosted action, which knows which channel holds an input; the schema cannot.
 */
export const CaptureConfigUpdateRequestSchema = z
  .strictObject({
    cameras: z.array(CaptureConfigCameraUpdateSchema).min(1).max(VIDEO_TRACK_IDS.length).optional(), // D60: four video lines
    mics: z.array(CaptureConfigMicUpdateSchema).min(1).max(MIC_CHANNEL_IDS.length).optional(), // D61 (2026-11-04): four mic lines
    unassign: z
      .array(z.enum(CAPTURE_SELECTOR_SLOTS))
      .min(1)
      .max(8) // D61 (2026-11-04): the eight-slot selector
      .optional()
      .describe('The selector slots this body clears: a video track (`VIDEO-01`..`VIDEO-04`) or a microphone channel (`MIC-01`..`MIC-04`; D61, 2026-11-04: the roles became the numbered channels), each at most once. A cleared slot has no line in the answer. A slot that the same body assigns (the `trackId` of a camera line, the `channel` of a mic line) is `422 INVALID_INPUT`. Clearing a slot that is already empty changes nothing and writes no audit row.'),
  })
  // Two refinements, like the text rule: the JSON Schema of the component does not change.
  .refine((body) => body.unassign === undefined || new Set(body.unassign).size === body.unassign.length, {
    error: 'A slot is named at most once in `unassign`.',
    path: ['unassign'],
  })
  .refine(
    (body) => {
      if (body.unassign === undefined) return true;
      const assigned = slotsAssignedBy(body);
      return body.unassign.every((slot) => !assigned.has(slot));
    },
    { error: 'A slot is never cleared and assigned by the same body.', path: ['unassign'] },
  )
  .describe('Request body of `POST /api/v1/capture/config` (C3 §2.3 op 78): a partial `{ cameras?[], mics?[], unassign?[] }`.');
export type CaptureConfigUpdateRequest = z.output<typeof CaptureConfigUpdateRequestSchema>;

/** Request body of op 79: the video track the camera in the path is assigned to. */
export const CaptureCameraSourceRequestSchema = z
  .strictObject({
    trackId: z.enum([TrackId.VIDEO_01, TrackId.VIDEO_02, TrackId.VIDEO_03, TrackId.VIDEO_04]).describe('The video track this camera becomes the source of.'),
  })
  .describe('Request body of `POST /api/v1/capture/cameras/{id}/source` (C3 §2.3 op 79).');
export type CaptureCameraSourceRequest = z.output<typeof CaptureCameraSourceRequestSchema>;

/**
 * The characters of a camera credential (`C3 §2.3` op 89, §2.6 ops 95 and 96; erratum PE-128-27;
 * SEC35-35): printable ASCII, and for the username none of `<`, `>`, `&`, `"`, `'` and backslash.
 * Anything else is `422 INVALID_INPUT` before any network request. A limit of this phase: a camera
 * whose password holds a non-ASCII character cannot be tested or stored.
 */
export const CAPTURE_CREDENTIAL_USERNAME_PATTERN = /^[\x20\x21\x23-\x25\x28-\x3B\x3D\x3F-\x5B\x5D-\x7E]+$/;
export const CAPTURE_CREDENTIAL_SECRET_PATTERN = /^[\x20-\x7E]+$/;
/** The longest camera username: the bound of the stored column (`capture_device_credentials`; decision D117). */
export const CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH = 120;
export const CAPTURE_CREDENTIAL_SECRET_MAX_LENGTH = 1024;

/**
 * Request body of op 89 (`setCaptureDeviceCredential`; SEC35-01; RK-12; specs C-N8), and the
 * `credential` member of ops 95 and 96 (`C3 §2.6`: one schema for the three). Both fields
 * are **write-only**: the answer, every slice, every log line and the audit row carry none of them,
 * and no operation ever returns them. The store is encrypted at rest (`dbc-3 §B.3`) and read only
 * through the single owning module plus the audited supervisor reveal path (SEC35-02).
 */
export const CaptureCredentialWriteRequestSchema = z
  .strictObject({
    username: trimmedText(CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH)
      .regex(CAPTURE_CREDENTIAL_USERNAME_PATTERN)
      .describe('Camera credential username: 1 to 120 printable ASCII characters without `<`, `>`, `&`, `"`, `\'` and backslash. Write-only: never returned, logged or audited (RK-12).'),
    // NEVER trimmed, never altered (decision D117): a password is stored and sent exactly as it was typed,
    // leading and trailing spaces included. The text rule, the length and the character set are all that is checked.
    secret: apiText()
      .min(1)
      .max(CAPTURE_CREDENTIAL_SECRET_MAX_LENGTH)
      .regex(CAPTURE_CREDENTIAL_SECRET_PATTERN)
      .describe('Camera credential secret: 1 to 1024 printable ASCII characters, taken exactly as sent (never trimmed). Write-only: never returned, logged or audited (RK-12; C-N8).'),
  })
  .describe(
    'Request body of `POST /api/v1/capture/devices/{id}/credential` (C3 §2.3 op 89). A write-only pair: the value never comes back on any path.',
  );
export type CaptureCredentialWriteRequest = z.output<typeof CaptureCredentialWriteRequestSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const DEVICE_SCHEMAS = {
  DeviceInventory: DeviceInventorySchema,
  ActiveCameraRequest: ActiveCameraRequestSchema,
  MicClipResetRequest: MicClipResetRequestSchema,
  RestartDeviceRequest: RestartDeviceRequestSchema,
} as const;

/** The schemas operations 76-80 and 89 add (task 3 M2-W7; merged into `CORE_API_SCHEMAS`). */
export const CAPTURE_CONFIG_SCHEMAS = {
  CaptureConfigCameraUpdate: CaptureConfigCameraUpdateSchema,
  CaptureConfigMicUpdate: CaptureConfigMicUpdateSchema,
  CaptureConfigUpdateRequest: CaptureConfigUpdateRequestSchema,
  CaptureCameraSourceRequest: CaptureCameraSourceRequestSchema,
  CaptureCredentialWriteRequest: CaptureCredentialWriteRequestSchema,
} as const;

// ── Decisions D51 / D53: the live camera preview and the lease of the idle microphone meters ──

/** `details.reason` of the `429 RATE_LIMITED` of operation 112: the bound of the live previews is reached. */
export const CAMERA_PREVIEW_LIMIT_REASON = 'PREVIEW_LIMIT';
/** `details.reason` of the `409 INVALID_STATE` of operation 112: this Core has no live preview for this device. */
export const CAMERA_PREVIEW_NOT_AVAILABLE_REASON = 'PREVIEW_NOT_AVAILABLE';
/** `details.reason` of the `409 INVALID_STATE` of operation 113: this Core has no idle meters. */
export const IDLE_METERS_NOT_AVAILABLE_REASON = 'IDLE_METERS_NOT_AVAILABLE';
/** The bounds of the live preview (decision D53; widened by the principal 2026-11-05: preview is a MUST, so every video track of D60 gets its own pipeline): pipelines per camera and in all, viewers per camera and in all. */
export const CAMERA_PREVIEW_LIMITS = Object.freeze({ pipelinesPerCamera: 1, pipelines: 4, viewersPerCamera: 4, viewers: 16 });
/** What the stream of a preview is: motion JPEG of about this rate and size (decision D53). */
export const CAMERA_PREVIEW_PICTURE = Object.freeze({ fps: 8, width: 640, height: 360 });

/** Success of op 112: a live preview session of one camera. The URL is a BEARER value. */
export const CameraPreviewSessionSchema = z
  .strictObject({
    url: z
      .string()
      .regex(new RegExp(`^http://127\\.0\\.0\\.1(?::\\d{1,5})?/preview/${CAMERA_PREVIEW_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`))
      .describe(`Loopback URL of the live preview stream with the ${CAMERA_PREVIEW_TOKEN_PREFIX} token. Bearer value: never logged, never audited, never replicated.`),
    expiresAt: epochMs().describe(`Core instant until which the URL may be opened (${String(CAMERA_PREVIEW_SESSION_TTL_MS / 1000)} s). A stream already open is cut when the sign-in session ends, not by this instant.`),
  })
  .describe('A live camera preview session (op 112; LIVE only - Simulated mode has no camera to show).');
export type CameraPreviewSessionBody = z.output<typeof CameraPreviewSessionSchema>;

/** Success of op 113: the lease of the idle microphone meters. */
export const IdleMeterLeaseSchema = z
  .strictObject({
    expiresAt: epochMs().describe(`Core instant the lease ends (${String(IDLE_METER_LEASE_MS / 1000)} s after the call) unless it is held again.`),
  })
  .describe('The lease of the idle microphone meters (op 113).');
export type IdleMeterLeaseBody = z.output<typeof IdleMeterLeaseSchema>;

/** The schemas operations 112 and 113 add (merged into `CORE_API_SCHEMAS`). */
export const CAPTURE_PREVIEW_SCHEMAS = {
  CameraPreviewSession: CameraPreviewSessionSchema,
  IdleMeterLease: IdleMeterLeaseSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.10';
const DEVICE_PATH = `${API_BASE_PATH}/device`;
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;
const DEVICE_PARAM = {
  name: 'id',
  description: 'A device of the Core, e.g. `CAM-01`, `MIC-02`, `GNSS`, `TPM`, `FRONT-PANEL`.',
  pattern: HARDWARE_DEVICE_ID_PATTERN,
} as const;
const UNKNOWN_DEVICE = { description: 'The Core has no device with this ID (NOT_FOUND).', schema: 'ApiError' } as const;
const DIAGNOSTICS_RUN = permissionAccess(Permission.DIAGNOSTICS_RUN);
const DEVICE_COMMAND_AUDIT = { success: AuditType.DEVICE_COMMAND, ...DENIED } as const;
const commandNote = (command: DeviceCommand) => hostedNote(`deviceCommand(deviceId, '${command}')`);

export const DEVICE_OPERATIONS = [
  {
    operationId: 'getDeviceInventory',
    method: 'get',
    path: `${DEVICE_PATH}/inventory`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Device inventory',
    description: [
      'The devices of the Core: the Core itself, the cameras, the four microphones (D61, 2026-11-04), the other devices, the ports, the camera the monitor shows, the link of the tablet and — schema v2 (C3 §3 op 47; SH-12) — the `captureConfig` snapshot. Slices `device`, `cameras`, `mics`, `otherDevices`, `ports`, `activeCameraId`, `tabletLink` and `captureConfig`.',
      'Distinct from `GET /api/v1/device/health`, the design-book snapshot. The inventory never holds the paired-client registry (E-04) and never a credential (RK-12).',
      STATE_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 47),
    responses: {
      200: { description: 'The seven slices.', schema: 'DeviceInventory' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'restartDevice',
    method: 'post',
    path: `${DEVICE_PATH}/{id}/restart`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Restart a device',
    description: [
      'Restarts a camera, a microphone or another device of the Core (simulated). It is refused while a recording runs, and the platform devices GNSS, TPM and FRONT-PANEL cannot be restarted.',
      'Schema v2 (C3 §3 op 48; OD-22; NM-01): for a **camera** the restart is a PoE power cycle. It is allowed **only when that camera\'s stream is LOST** — otherwise `409 CAMERA_NOT_LOST` with `details.streamState` — and it requires the body `{ "confirm": true }`. A cycle during RECORDING is refused `409 RECORDING_ACTIVE` as before. The `captureConfig` slice marks the gap. Mics and other devices keep the plain restart.',
      'Writes DEVICE_COMMAND with `details.command: RESTART`, or `POE_CYCLE` plus a second CAMERA_POE_CYCLED row for a camera cycle (E-12; the CAMERA_POE_CYCLED detail is `deviceId`, `poePort`, `streamWasLost: true`, `confirmed: true` and the optional gap markers — never a credential).',
      commandNote(DeviceCommand.RESTART),
    ].join('\n\n'),
    source: backendSource(SECTION, 48),
    pathParam: DEVICE_PARAM,
    requestBody: { schema: 'RestartDeviceRequest', required: false },
    responses: {
      204: { description: 'The device restarted, or the camera power-cycled.' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.DEVICE_MANAGE),
      404: UNKNOWN_DEVICE,
      409: {
        description:
          'A recording is running (RECORDING_ACTIVE), the device accepts no restart (COMMAND_UNSUPPORTED), or a camera whose stream is not lost was asked for a PoE cycle (CAMERA_NOT_LOST, with `details.streamState: LIVE`; OD-22).',
        schema: 'ApiError',
      },
      422: INVALID_PATH_PARAMETER,
    },
    access: permissionAccess(Permission.DEVICE_MANAGE),
    audit: { success: AuditType.DEVICE_COMMAND, ...DENIED, also: [AuditType.CAMERA_POE_CYCLED] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'testDeviceSignal',
    method: 'post',
    path: `${DEVICE_PATH}/{id}/test-signal`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Send a test signal',
    description: [
      'Sends a test signal to a device (simulated): a microphone plays a steady tone of -18 dBFS on its meter for two seconds. The platform devices GNSS, TPM and FRONT-PANEL accept no test signal.',
      'Writes DEVICE_COMMAND with `details.command: TEST_SIGNAL`.',
      commandNote(DeviceCommand.TEST_SIGNAL),
    ].join('\n\n'),
    source: backendSource(SECTION, 49),
    pathParam: DEVICE_PARAM,
    responses: {
      204: { description: 'The test signal was sent.' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.DIAGNOSTICS_RUN),
      404: UNKNOWN_DEVICE,
      409: { description: 'The device accepts no test signal (COMMAND_UNSUPPORTED).', schema: 'ApiError' },
      422: INVALID_PATH_PARAMETER,
    },
    access: DIAGNOSTICS_RUN,
    audit: DEVICE_COMMAND_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'identifyDevice',
    method: 'post',
    path: `${DEVICE_PATH}/{id}/identify`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Identify a device',
    description: [
      'Makes the indicator of a device blink three times (simulated). Every device accepts it, the platform devices GNSS, TPM and FRONT-PANEL included.',
      'Writes DEVICE_COMMAND with `details.command: IDENTIFY`.',
      commandNote(DeviceCommand.IDENTIFY),
    ].join('\n\n'),
    source: backendSource(SECTION, 50),
    pathParam: DEVICE_PARAM,
    responses: {
      204: { description: 'The indicator blinks.' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.DIAGNOSTICS_RUN),
      404: UNKNOWN_DEVICE,
      422: INVALID_PATH_PARAMETER,
    },
    access: DIAGNOSTICS_RUN,
    audit: DEVICE_COMMAND_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'setActiveCamera',
    method: 'post',
    path: `${API_BASE_PATH}/video/active-camera`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Choose the camera the monitor shows',
    description: [
      'Chooses which of the two cameras the monitor shows. It is a view selection for every console of this Core: both tracks keep recording, and no evidence is affected.',
      'Every signed-in role may call it. Writes no audit row.',
      hostedNote('setActiveCamera'),
    ].join('\n\n'),
    source: backendSource(SECTION, 51),
    requestBody: { schema: 'ActiveCameraRequest', required: true },
    responses: {
      204: { description: 'The monitor shows that camera.' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: forbidden(),
      422: INVALID_INPUT,
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'resetMicClip',
    method: 'post',
    path: `${API_BASE_PATH}/audio/clip/reset`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Reset the CLIP latch',
    description: [
      'Resets the CLIP indicator of one audio channel, which stays lit after a clipped peak until someone resets it. The recorded audio is not changed.',
      'Every signed-in role may call it: the indicator is on the meter every role sees. Writes no audit row.',
      hostedNote('resetClip'),
    ].join('\n\n'),
    source: backendSource(SECTION, 52),
    requestBody: { schema: 'MicClipResetRequest', required: true },
    responses: {
      204: { description: 'The latch of that channel is clear.' },
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
// Operations 76-80 and 89: the capture-config selector and its credential store
// (task 3 M2-W7, blueprint row 48; register SH-12/NM-09; C3 §2.2/§2.3/§2.4; OD-01/OD-05/OD-10)
// ═══════════════════════════════════════════════════════════════════════════════════════

const CAPTURE_PATH = `${API_BASE_PATH}/capture`;
const CAPTURE_CONFIG = permissionAccess(Permission.CAPTURE_CONFIG);
/** The idle-lock refusal (SEC35-19): a state refusal, not an access refusal — RB-4 scopes ACCESS_DENIED to access-rule refusals, so this 409 writes NO audit row at all. */
const CONFIG_LOCKED = {
  description: 'A session is open: the selector is locked (CAPTURE_CONFIG_LOCKED). No audit row is written for this refusal (SEC35-19).',
  schema: 'ApiError',
} as const;
const UNKNOWN_CAPTURE_DEVICE = { description: 'The capture registry has no device with this ID (NOT_FOUND).', schema: 'ApiError' } as const;
const CAPTURE_DEVICE_PARAM = {
  name: 'id',
  description:
    'A registered capture device (`dbc-4 §N`): a built-in one (`CAM-01`..`CAM-04`, `MIC-01`..`MIC-04`, `POE-SWITCH`; D61, 2026-11-04: four microphones) or one that operation 96 added. Never a candidate id of a camera search.',
  pattern: HARDWARE_DEVICE_ID_PATTERN,
} as const;

export const CAPTURE_CONFIG_OPERATIONS = [
  {
    operationId: 'getCaptureConfig',
    method: 'get',
    path: `${CAPTURE_PATH}/config`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Capture configuration',
    description: [
      'The device selector: which capture device feeds each video track and which mic input stands on each of the FOUR microphone channels `MIC-01`..`MIC-04` (D61 of 2026-11-04: four simultaneous audio channels; the OD-01 T1 one-track premise and its PRIMARY/STANDBY roles are superseded — channel 1 keeps the transcription duty), with the `locked` flag — true while a session is open (OD-10).',
      'The answer is the `captureConfig` slice in its wire form (API-6). It never holds a credential: the camera credential store is write-only (RK-12; op 89).',
      'Needs a signed-in operator. Every role may read it: the operation needs no permission.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 76; register NM-09/SH-12 (not in the design book)',
    responses: {
      200: { description: 'The capture-config slice.', schema: 'CaptureConfigSlice' },
      401: NOT_SIGNED_IN,
      // RECON-A (row 51a §5 B2b): every role may read this slice, so no seeded role can be refused it.
      // The 403 originates in the Origin / revoked-device guards the simulator does not implement
      // (01_specs §7.19); only the Core server sends it. Mirrors the five baseline reads.
      403: { ...forbidden(), services: CORE_SERVER_ONLY },
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getCaptureDevices',
    method: 'get',
    path: `${CAPTURE_PATH}/devices`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Capture devices',
    description: [
      'The capture-device registry: id, kind, model, firmware, host, PoE port, online flag, stream state and capabilities — the field list of `C3 §2.3` op 77. **No credential member exists** (RK-12), and a host is a host only, never a `user:password@` URL (specs C-N8).',
      'Fed by supervisor telemetry (`applyCaptureTelemetry`, SH-18). The answer is the `captureDevices` slice in its wire form (API-6); it is its own slice, never the paired-client registry (E-04).',
      'Fix wave J round two (finding JW-23): `online` is the registry flag of a device, not a statement that it is reachable now. A Core in its own capture asks a source in a pre-check, at a session start, in a microphone re-scan and - since decisions D51 / D53 - while an operator watches its live preview (`createCameraPreviewSession`) or holds the idle microphone meters (`holdIdleMeters`); a device nobody has asked (a camera registered on a port where nothing answers) reads `online: true` until one of them finds it unreachable. Neither the preview nor the idle meters change this flag. Clients show such a device as "Not checked" at rest.',
      'Needs a signed-in operator. Every role may read it.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 77; register NM-09/E-04 (not in the design book)',
    responses: {
      200: { description: 'The capture-devices slice.', schema: 'CaptureDevicesSlice' },
      401: NOT_SIGNED_IN,
      // RECON-A (row 51a §5 B2b): every role may read this registry, so no seeded role can be refused
      // it; the 403 is the Origin / revoked-device guard only the Core server sends (01_specs §7.19).
      403: { ...forbidden(), services: CORE_SERVER_ONLY },
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'updateCaptureConfig',
    method: 'post',
    path: `${CAPTURE_PATH}/config`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Replace the capture configuration',
    description: [
      'Writes the whole selector at once (the camera lines and the mic lines over the eight-slot selector are optional members of the body; D61, 2026-11-04: four channels per medium). Needs CAPTURE_CONFIG (TECHNICIAN holds it since the 0034 revocation, and the vendor `root` account holds it by identity too (D55); OD-10 before the revocation) — and is **editable only while idle**: with a session open it refuses `409 CAPTURE_CONFIG_LOCKED` with no state change and **no audit row at all** (SEC35-19: neither CAPTURE_CONFIG_CHANGED nor ACCESS_DENIED — the lock is a state refusal, not an access one).',
      'On success writes one CAPTURE_CONFIG_CHANGED row whose details are exactly the keys of `C3 §5.2` (operationId, scope, field, the optional track/input/device/from/to/permission members) — names and previous/new values, never a credential.',
      'A selector slot may be unassigned. The optional member `unassign` names the slots to clear (a video track `VIDEO-01`..`VIDEO-04`, a microphone channel `MIC-01`..`MIC-04`; D61, 2026-11-04): a cleared slot has no line in the answer, and it is the only way a slot becomes empty. It needs the same permission and is refused by the same lock; each cleared slot writes one CAPTURE_CONFIG_CHANGED row that carries `from` (the device that held the slot) and no `to`, and clearing an empty slot writes none. A body that clears a slot and assigns the same slot is `422 INVALID_INPUT`. A mic line with `channel` fills the slot of that channel, also alone. A Core in its own capture refuses a session start while a slot is unassigned.',
      'Publishes the `captureConfig` slice. 503 NOT_READY carries `details.reason: CAPTURE_NOT_READY` when the capture stack is not ready (CS-22).',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 78; register SH-03/SH-04/CS-12/NM-09 (not in the design book)',
    requestBody: { schema: 'CaptureConfigUpdateRequest', required: true },
    responses: {
      200: { description: 'The new capture-config slice.', schema: 'CaptureConfigSlice' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG),
      409: CONFIG_LOCKED,
      422: INVALID_INPUT,
    },
    access: CAPTURE_CONFIG,
    audit: { success: AuditType.CAPTURE_CONFIG_CHANGED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'setCaptureCameraSource',
    method: 'post',
    path: `${CAPTURE_PATH}/cameras/{id}/source`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Assign a camera to a video track',
    description: [
      'Assigns the camera named in the path (`CAM-01`/`CAM-02`) to the video track named in the body (`VIDEO-01`/`VIDEO-02`). Both topologies work because the config names a device per track, not a lens (OD-05): one dual-lens camera or two PoE cameras.',
      'Needs CAPTURE_CONFIG and is idle-only (`409 CAPTURE_CONFIG_LOCKED`, no audit row — SEC35-19). An unknown `{id}` answers 404. Writes CAPTURE_CONFIG_CHANGED with `scope: CAMERA`, `field: SOURCE`, `trackId`, `deviceId` and the previous/new device in `from`/`to`.',
      'Publishes the `captureConfig` slice.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 79; register SH-12/NM-09 (not in the design book)',
    pathParam: CAPTURE_DEVICE_PARAM,
    requestBody: { schema: 'CaptureCameraSourceRequest', required: true },
    responses: {
      200: { description: 'The new capture-config slice.', schema: 'CaptureConfigSlice' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG),
      404: UNKNOWN_CAPTURE_DEVICE,
      409: CONFIG_LOCKED,
      422: INVALID_INPUT,
    },
    access: CAPTURE_CONFIG,
    audit: { success: AuditType.CAPTURE_CONFIG_CHANGED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'setPrimaryMic',
    method: 'post',
    path: `${CAPTURE_PATH}/mics/{id}/primary`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Make a mic input the transcribed channel',
    description: [
      'Makes the mic input named in the path the input of channel `MIC-01` — the channel that feeds the transcribed track `AUDIO-01` (D61 of 2026-11-04: the operation keeps its path and its name; what it moves is the transcription channel, and the input that held channel 1 takes the moved input\'s old channel. The earlier wording made it PRIMARY inside one `AUDIO-01` with the other STANDBY, OD-01 T1 / OD-09; all four channels now record simultaneously). No body.',
      'Needs CAPTURE_CONFIG and is idle-only (`409 CAPTURE_CONFIG_LOCKED`, no audit row — SEC35-19). An unknown `{id}` answers 404. Writes CAPTURE_CONFIG_CHANGED with `scope: MIC`, `field: CHANNEL`, `inputId` and the previous/new channel in `from`/`to`.',
      'Publishes the `captureConfig` slice. The in-session toggle is a different operation (`switchAudioSource`, op 81) with different access.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 80; register SH-03/SH-12/NM-09 (not in the design book)',
    pathParam: CAPTURE_DEVICE_PARAM,
    responses: {
      200: { description: 'The new capture-config slice.', schema: 'CaptureConfigSlice' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG),
      404: UNKNOWN_CAPTURE_DEVICE,
      409: CONFIG_LOCKED,
      // RECON-A (row 51a §5, same class as the already-marked startSession 422): the simulator answers
      // an unknown `{id}` with 404 and does no path-parameter format check (D-51a-6), so this 422 is
      // produced only by the Core server's schema validation.
      422: { ...INVALID_PATH_PARAMETER, services: CORE_SERVER_ONLY },
    },
    access: CAPTURE_CONFIG,
    audit: { success: AuditType.CAPTURE_CONFIG_CHANGED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

/**
 * Operation 89 — the write-only credential path (SEC35-01 remediation; RK-12; T-33; E-30). The
 * response is the config snapshot; the credential is never echoed, logged or audited, and the
 * CAPTURE_CREDENTIAL_SET detail carries `deviceId` only (`C3 §5.2`). No operation returns a
 * credential; the reveal path is the single owning module plus the audited supervisor function
 * (`dbc-3 §B.3/§D`; SEC35-02), never an API operation (M2-CRD-1).
 */
export const CAPTURE_CREDENTIAL_OPERATION = {
  operationId: 'setCaptureDeviceCredential',
  method: 'post',
  path: `${CAPTURE_PATH}/devices/{id}/credential`,
  tag: CoreApiTag.DEVICE,
  mode: CoreApiMode.SIMULATED,
  summary: 'Store a camera credential (write-only)',
  description: [
    'Stores the `{ username, secret }` pair for the camera in the path, encrypted at rest (`dbc-3 §B.3`). Needs CAPTURE_CONFIG (TECHNICIAN since 0034; the vendor `root` by identity, D55 — D4 OD-10 before the revocation) and is idle-only (`409 CAPTURE_CONFIG_LOCKED`, no audit row — SEC35-19).',
    '**Web console only** (`C3 §3.1`, erratum PE-121-05; D80(3)): the condition `WEB_CONSOLE_SESSION` refuses a session of a tablet or a phone with `403 NOT_PERMITTED`, `details.reason: WEB_CONSOLE_ONLY` and one ACCESS_DENIED row, before the body is used. `{id}` is always a registered capture device: a candidate of a camera search is adopted with operation 96, which stores its credential in the same transaction. Both fields are printable ASCII. On the Core server the answer is `503 NOT_READY` with `details.reason: CREDENTIAL_STORE_NOT_READY` while the Core credential store is not available; nothing is stored then.',
    '**Write-only** (RK-12; specs C-N8; M2-CRD-1): the answer is the plain `CaptureConfig` snapshot and never echoes either field; no slice, log line or audit row carries the username, the secret, the ciphertext, the nonce or the key; no operation returns a credential. The CAPTURE_CREDENTIAL_SET row names `deviceId` (and the optional operationId/permission) only (`C3 §5.2`).',
    'Reading the store belongs to the single owning module and the audited supervisor reveal path (`dbc-3 §B.3/§D`; SEC35-02; the CAPTURE_CREDENTIAL_REVEALED row carries `deviceId` and a SCREAMING_SNAKE reason, never the value).',
    SIM_V2_NOTE,
  ].join('\n\n'),
  source: 'Task 3 M2-W7; C3 §2.2 operation 89; SEC35-01 remediation; register RK-12/T-33/E-30 (not in the design book)',
  pathParam: CAPTURE_DEVICE_PARAM,
  requestBody: { schema: 'CaptureCredentialWriteRequest', required: true },
  responses: {
    200: { description: 'The capture-config snapshot. Neither credential field is ever echoed.', schema: 'CaptureConfigSlice' },
    400: INVALID_JSON,
    401: NOT_SIGNED_IN,
    403: notPermitted(
      Permission.CAPTURE_CONFIG,
      `the operator's session is bound to a paired tablet or phone (NOT_PERMITTED, \`details.reason: ${WEB_CONSOLE_ONLY_REASON}\`; one ACCESS_DENIED audit row; refused before the body is used)`,
    ),
    404: UNKNOWN_CAPTURE_DEVICE,
    409: CONFIG_LOCKED,
    422: INVALID_INPUT,
  },
  // Task 3 R-9 (blueprint row 132, D106; C3 §3.1): CAPTURE_CONFIG on a web console session only.
  access: { ...CAPTURE_CONFIG, conditions: [CoreApiAccessCondition.WEB_CONSOLE_SESSION] },
  audit: { success: AuditType.CAPTURE_CREDENTIAL_SET, ...DENIED },
  services: CORE_SERVER_ONLY,
} as const satisfies CoreApiRegistryOperation;

/** Who may watch a live preview (decision D53, answer "Semua yang bisa mulai sesi"): any one of the three. */
const PREVIEW_VIEWERS = { kind: CoreApiAccessKind.ANY_OF, permissions: [Permission.SESSION_START, Permission.CAPTURE_CONFIG, Permission.DEVICE_MANAGE] } as const;
/** Who may hold the idle microphone meters (decision D53): any one of the three. */
const IDLE_METER_HOLDERS = { kind: CoreApiAccessKind.ANY_OF, permissions: [Permission.CAPTURE_CONFIG, Permission.DEVICE_MANAGE, Permission.SESSION_START] } as const;
const notPermittedAnyOfThree = (permissions: readonly [Permission, Permission, Permission]) =>
  forbidden(`the operator's role holds none of ${permissions.join(', ')} (NOT_PERMITTED; one ACCESS_DENIED audit row)`);

/**
 * Operations 112 and 113 (decisions D51 / D53): the live camera preview and the lease of the idle
 * microphone meters. Both are LIVE only and answered by the Core server only. RECORDING ALWAYS HAS
 * PRIORITY: a preview yields its camera before a pre-check and before a session opens the camera,
 * and comes back after the recording's push stands, while viewers remain.
 */
export const CAPTURE_PREVIEW_OPERATIONS = [
  {
    operationId: 'createCameraPreviewSession',
    method: 'post',
    path: `${CAPTURE_PATH}/devices/{id}/preview-sessions`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Open a live camera preview',
    description: [
      `Returns a short-lived URL of the registry-external route \`GET /preview/{token}\`, which streams the camera in the path as motion JPEG (\`multipart/x-mixed-replace\`, about ${String(CAMERA_PREVIEW_PICTURE.fps)} pictures per second at ${String(CAMERA_PREVIEW_PICTURE.width)}x${String(CAMERA_PREVIEW_PICTURE.height)}; \`Cache-Control: no-store\`). The token (prefix \`${CAMERA_PREVIEW_TOKEN_PREFIX}\`) is a random bearer value bound to the operator, the sign-in session and the camera; it must be opened within ${String(CAMERA_PREVIEW_SESSION_TTL_MS / 1000)} s and never enters a log or an audit row. A stream that is open is cut when its sign-in session ends (checked every 10 s).`,
      'Needs SESSION_START, CAPTURE_CONFIG or DEVICE_MANAGE (decision D53: everyone who can start a session). The route `GET /preview/{token}` has the same rule. The camera must be a registered production camera: the Core reads its stored credential for the preview (one CAPTURE_CREDENTIAL_REVEALED row, `reason: PREVIEW_OPEN`, when the stream is started), never returns it.',
      `**Recording always has priority.** A preview yields its camera before a pre-check and before a session opens it, and resumes after the recording's push stands, while viewers remain. Bounds: ${String(CAMERA_PREVIEW_LIMITS.pipelinesPerCamera)} stream per camera, ${String(CAMERA_PREVIEW_LIMITS.pipelines)} in all, ${String(CAMERA_PREVIEW_LIMITS.viewersPerCamera)} viewers per camera and ${String(CAMERA_PREVIEW_LIMITS.viewers)} in all; over a bound the Core answers \`429 RATE_LIMITED\` with \`details.reason: ${CAMERA_PREVIEW_LIMIT_REASON}\` (an envelope-level answer) and writes no row. A Core without a live preview answers \`409 INVALID_STATE\` with \`details.reason: ${CAMERA_PREVIEW_NOT_AVAILABLE_REASON}\`.`,
      'Writes CAMERA_PREVIEW_OPENED before the answer: the device, `expiresAt` and the operation - never the token or the URL.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: 'Task 4, row D53 (bare-metal bench; decisions D51, D53): operation 112, the live camera preview',
    pathParam: CAPTURE_DEVICE_PARAM,
    responses: {
      201: { description: 'The live preview session.', schema: 'CameraPreviewSession' },
      401: NOT_SIGNED_IN,
      403: notPermittedAnyOfThree(PREVIEW_VIEWERS.permissions),
      404: UNKNOWN_CAPTURE_DEVICE,
      409: { description: `This Core has no live preview of this device (INVALID_STATE, \`details.reason: ${CAMERA_PREVIEW_NOT_AVAILABLE_REASON}\`): not a production Core, or not a registered production camera. No row is written.`, schema: 'ApiError' },
      422: INVALID_PATH_PARAMETER,
    },
    access: PREVIEW_VIEWERS,
    audit: { success: AuditType.CAMERA_PREVIEW_OPENED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'holdIdleMeters',
    method: 'post',
    path: `${CAPTURE_PATH}/idle-meters/lease`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Hold the idle microphone meters',
    description: [
      `Asks the Core to show the level of the registered microphones while no session records ("Level check - not recording"), for ${String(IDLE_METER_LEASE_MS / 1000)} s from the call. A client that shows the meters holds the lease again before it ends; when no lease is held the Core closes the cards. The levels arrive on the realtime channel as meters do; nothing is recorded, nothing is stored.`,
      'Needs CAPTURE_CONFIG, DEVICE_MANAGE or SESSION_START. A session that records has priority: the idle meters stand down while it runs. Writes no audit row (a level is no fact of the trail).',
      `A Core without idle meters answers \`409 INVALID_STATE\` with \`details.reason: ${IDLE_METERS_NOT_AVAILABLE_REASON}\`.`,
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: 'Task 4, row D53 (bare-metal bench; decisions D51, D53): operation 113, the idle microphone meters',
    responses: {
      200: { description: 'The lease, and when it ends.', schema: 'IdleMeterLease' },
      401: NOT_SIGNED_IN,
      403: notPermittedAnyOfThree(IDLE_METER_HOLDERS.permissions),
      409: { description: `This Core has no idle meters (INVALID_STATE, \`details.reason: ${IDLE_METERS_NOT_AVAILABLE_REASON}\`).`, schema: 'ApiError' },
    },
    access: IDLE_METER_HOLDERS,
    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const BAD_PATH = { invalidPathParameter: ERROR_EXAMPLES.invalidPathParameter } as const;
const BODY_REFUSALS = {
  400: { invalidJson: ERROR_EXAMPLES.invalidJson },
  422: { invalidInput: ERROR_EXAMPLES.invalidInput },
} as const;
const NOT_FOUND = {
  notFound: simRefusalExample('Unknown device', 'NOT_FOUND', `Device ${STATE_EXAMPLE_IDS.unknownDeviceId} not found.`, 'NOT_FOUND'),
} as const;
const unsupported = (command: DeviceCommand) =>
  simRefusalExample(
    `${STATE_EXAMPLE_IDS.platformDeviceId} accepts IDENTIFY only`,
    'COMMAND_UNSUPPORTED',
    `${STATE_EXAMPLE_IDS.platformDeviceId} does not support ${command}.`,
    'COMMAND_UNSUPPORTED',
    { event: 'deviceCommand' },
  );

export const DEVICE_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getDeviceInventory: {
    responses: {
      200: {
        idle: {
          summary: 'Idle, every device online',
          value: {
            device: EXAMPLE_SLICES.device,
            cameras: EXAMPLE_SLICES.cameras,
            mics: EXAMPLE_SLICES.mics,
            otherDevices: EXAMPLE_SLICES.otherDevices,
            ports: EXAMPLE_SLICES.ports,
            activeCameraId: EXAMPLE_SLICES.activeCameraId,
            tabletLink: EXAMPLE_SLICES.tabletLink,
            captureConfig: EXAMPLE_SLICES.captureConfig,
          } satisfies DeviceInventory,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  restartDevice: {
    pathParams: { id: STATE_EXAMPLE_IDS.cameraDeviceId },
    // Task 3 M2-W7 (C3 §3 op 48): a camera cycle needs `{ confirm: true }`; mics keep the bodyless restart.
    request: {
      confirm: { summary: 'Confirm the PoE cycle of a lost-stream camera', value: { confirm: true } satisfies RestartDeviceRequest },
    },
    responses: {
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: deniedExamples('restartDevice', 'DEVICE_MANAGE', 'SUPERVISOR'),
      404: NOT_FOUND,
      409: {
        recordingActive: simRefusalExample(
          'A recording is running',
          'RECORDING_ACTIVE',
          'Restart is unavailable while recording.',
          'RECORDING_ACTIVE',
          { from: 'RECORDING', event: 'deviceCommand' },
        ),
        commandUnsupported: unsupported(DeviceCommand.RESTART),
      },
      422: BAD_PATH,
    },
  },
  testDeviceSignal: {
    pathParams: { id: STATE_EXAMPLE_IDS.micDeviceId },
    responses: {
      401: SIGNED_OUT,
      // Every seeded role holds DIAGNOSTICS_RUN, so no seeded operator can be shown as refused for it.
      403: BASIC_403_EXAMPLES,
      404: NOT_FOUND,
      409: { commandUnsupported: unsupported(DeviceCommand.TEST_SIGNAL) },
      422: BAD_PATH,
    },
  },
  identifyDevice: {
    pathParams: { id: STATE_EXAMPLE_IDS.platformDeviceId },
    responses: {
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      404: NOT_FOUND,
      422: BAD_PATH,
    },
  },
  setActiveCamera: {
    request: {
      second: { summary: 'Show camera 2', value: { cameraId: 'VIDEO-02' } satisfies ActiveCameraRequest },
    },
    responses: { ...BODY_REFUSALS, 401: SIGNED_OUT, 403: BASIC_403_EXAMPLES },
  },
  resetMicClip: {
    request: {
      subject: { summary: 'Reset the latch of MIC 2', value: { channel: 'AUDIO-02' } satisfies MicClipResetRequest },
    },
    responses: { ...BODY_REFUSALS, 401: SIGNED_OUT, 403: BASIC_403_EXAMPLES },
  },
  // ── Operations 76-80 and 89 (task 3 M2-W7; C3 §2.2) ─────────────────────────────────────────
  getCaptureConfig: {
    responses: {
      200: {
        idle: { summary: 'The built-in selector, idle (locked: false)', value: EXAMPLE_SLICES.captureConfig },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  getCaptureDevices: {
    responses: {
      200: {
        idle: { summary: 'The nine built-in capture devices (D61: four cameras, four microphones, the PoE switch)', value: EXAMPLE_SLICES.captureDevices },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  updateCaptureConfig: {
    request: {
      cameras: {
        summary: 'Point both tracks at the dual-lens camera',
        value: {
          cameras: [
            { trackId: 'VIDEO-01', deviceId: 'CAM-01' },
            { trackId: 'VIDEO-02', deviceId: 'CAM-01' },
          ],
        } satisfies CaptureConfigUpdateRequest,
      },
      // Task 4 rows 28, 162, 29 (decision C14; AD-10): a slot is cleared by naming it. The in-app
      // answerer and the Core both honour the member; the answer is the selector without that line.
      unassign: {
        // D61 (2026-11-04): the standby role is channel MIC-02.
        summary: 'Clear the second microphone channel',
        value: { unassign: ['MIC-02'] } satisfies CaptureConfigUpdateRequest,
      },
    },
    responses: {
      200: { updated: { summary: 'The new capture-config slice', value: EXAMPLE_SLICES.captureConfig } },
      ...BODY_REFUSALS,
      401: SIGNED_OUT,
      403: deniedExamples('updateCaptureConfig', 'CAPTURE_CONFIG', 'INVESTIGATOR'),
      409: {
        locked: simRefusalExample(
          'A session is open',
          'CAPTURE_CONFIG_LOCKED',
          'The capture configuration cannot be changed while a session is open.',
          'CAPTURE_CONFIG_LOCKED',
        ),
      },
    },
  },
  setCaptureCameraSource: {
    pathParams: { id: STATE_EXAMPLE_IDS.cameraDeviceId },
    request: {
      second: { summary: 'Feed VIDEO-02 from this camera', value: { trackId: 'VIDEO-02' } satisfies CaptureCameraSourceRequest },
    },
    responses: {
      200: { updated: { summary: 'The new capture-config slice', value: EXAMPLE_SLICES.captureConfig } },
      ...BODY_REFUSALS,
      401: SIGNED_OUT,
      403: deniedExamples('setCaptureCameraSource', 'CAPTURE_CONFIG', 'INVESTIGATOR'),
      404: NOT_FOUND,
      409: {
        locked: simRefusalExample(
          'A session is open',
          'CAPTURE_CONFIG_LOCKED',
          'The capture configuration cannot be changed while a session is open.',
          'CAPTURE_CONFIG_LOCKED',
        ),
      },
    },
  },
  setPrimaryMic: {
    pathParams: { id: STATE_EXAMPLE_IDS.micDeviceId },
    responses: {
      200: { updated: { summary: 'The new capture-config slice', value: EXAMPLE_SLICES.captureConfig } },
      401: SIGNED_OUT,
      403: deniedExamples('setPrimaryMic', 'CAPTURE_CONFIG', 'INVESTIGATOR'),
      404: NOT_FOUND,
      409: {
        locked: simRefusalExample(
          'A session is open',
          'CAPTURE_CONFIG_LOCKED',
          'The capture configuration cannot be changed while a session is open.',
          'CAPTURE_CONFIG_LOCKED',
        ),
      },
      422: BAD_PATH,
    },
  },
  setCaptureDeviceCredential: {
    pathParams: { id: STATE_EXAMPLE_IDS.cameraDeviceId },
    // The body example shows PLACEHOLDERS only: an OpenAPI example must never carry anything that
    // reads like a real credential (E-30; the API Reference offers no "Try it" for this operation).
    request: {
      pair: {
        summary: 'Store the ONVIF credential pair of CAM-01 (placeholders; the value never returns)',
        value: { username: 'USERNAME', secret: 'SECRET' } satisfies CaptureCredentialWriteRequest,
      },
    },
    responses: {
      200: { updated: { summary: 'The capture-config snapshot (no credential echoed)', value: EXAMPLE_SLICES.captureConfig } },
      ...BODY_REFUSALS,
      401: SIGNED_OUT,
      403: {
        ...deniedExamples('setCaptureDeviceCredential', 'CAPTURE_CONFIG', 'INVESTIGATOR'),
        webConsoleOnly: {
          summary: 'A tablet or phone session on a web-console-only operation',
          description: 'The caller holds CAPTURE_CONFIG, but the session is bound to a paired device. One ACCESS_DENIED row is written; the body is not used.',
          value: apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
            operationId: 'setCaptureDeviceCredential',
            permission: 'CAPTURE_CONFIG',
            role: 'TECHNICIAN',
            reason: WEB_CONSOLE_ONLY_REASON,
          }),
        },
      },
      404: NOT_FOUND,
      409: {
        locked: simRefusalExample(
          'A session is open',
          'CAPTURE_CONFIG_LOCKED',
          'The capture configuration cannot be changed while a session is open.',
          'CAPTURE_CONFIG_LOCKED',
        ),
      },
    },
  },
  createCameraPreviewSession: {
    pathParams: { id: STATE_EXAMPLE_IDS.cameraDeviceId },
    responses: {
      201: {
        // The token is a PLACEHOLDER: a real preview URL is a bearer value and never an example body.
        opened: {
          summary: 'Sixty seconds to open the live preview of CAM-01 (token placeholder)',
          value: { url: `http://127.0.0.1:4420/preview/${CAMERA_PREVIEW_TOKEN_PREFIX}${'0'.repeat(43)}`, expiresAt: 1_790_825_000_000 } satisfies CameraPreviewSessionBody,
        },
      },
      401: SIGNED_OUT,
      // Every seeded role holds one of the three permissions: no seeded operator can be shown as refused for them.
      403: BASIC_403_EXAMPLES,
      404: NOT_FOUND,
      409: { notAvailable: { summary: 'No live preview of this device', value: apiErrorExample('INVALID_STATE', 'There is no live preview of this device on this Core.', { reason: CAMERA_PREVIEW_NOT_AVAILABLE_REASON }) } },
      422: BAD_PATH,
    },
  },
  holdIdleMeters: {
    responses: {
      200: { held: { summary: 'The meters are held for thirty seconds', value: { expiresAt: 1_790_825_030_000 } satisfies IdleMeterLeaseBody } },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
      409: { notAvailable: { summary: 'No idle meters on this Core', value: apiErrorExample('INVALID_STATE', 'This Core shows no microphone level while it is idle.', { reason: IDLE_METERS_NOT_AVAILABLE_REASON }) } },
    },
  },
};
