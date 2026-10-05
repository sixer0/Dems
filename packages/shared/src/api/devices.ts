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
import { TrackId } from '../domain/enums';
import { AuditType, DeviceCommand, Permission } from '../sim/vocabulary';
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
  INVALID_PATH_PARAMETER,
  NOT_SIGNED_IN,
  STATE_READ_NOTE,
  backendSource,
  forbidden,
  hostedNote,
  notPermitted,
} from './operation-parts';
import { HARDWARE_DEVICE_ID_PATTERN } from './patterns';
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
  })
  .describe('The devices of the Core: seven slices of the Core state, each in its wire form.');
export type DeviceInventory = z.output<typeof DeviceInventorySchema>;

export const ActiveCameraRequestSchema = z
  .object({
    cameraId: z.enum([TrackId.VIDEO_01, TrackId.VIDEO_02]).describe('The camera the monitor shows: VIDEO-01 or VIDEO-02.'),
  })
  .describe('Request body of `POST /api/v1/video/active-camera`.');
export type ActiveCameraRequest = z.output<typeof ActiveCameraRequestSchema>;

export const MicClipResetRequestSchema = z
  .object({
    channel: z.enum([TrackId.AUDIO_01, TrackId.AUDIO_02]).describe('The audio channel whose CLIP latch is reset: AUDIO-01 or AUDIO-02.'),
  })
  .describe('Request body of `POST /api/v1/audio/clip/reset`.');
export type MicClipResetRequest = z.output<typeof MicClipResetRequestSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const DEVICE_SCHEMAS = {
  DeviceInventory: DeviceInventorySchema,
  ActiveCameraRequest: ActiveCameraRequestSchema,
  MicClipResetRequest: MicClipResetRequestSchema,
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
      'The devices of the Core: the Core itself, the two cameras, the two microphones, the other devices, the ports, the camera the monitor shows and the link of the tablet. Slices `device`, `cameras`, `mics`, `otherDevices`, `ports`, `activeCameraId` and `tabletLink`.',
      'Distinct from `GET /api/v1/device/health`, the design-book snapshot.',
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
      'Writes DEVICE_COMMAND with `details.command: RESTART`.',
      commandNote(DeviceCommand.RESTART),
    ].join('\n\n'),
    source: backendSource(SECTION, 48),
    pathParam: DEVICE_PARAM,
    responses: {
      204: { description: 'The device restarted.' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.DEVICE_MANAGE),
      404: UNKNOWN_DEVICE,
      409: {
        description: 'A recording is running (RECORDING_ACTIVE), or the device accepts no restart (COMMAND_UNSUPPORTED).',
        schema: 'ApiError',
      },
      422: INVALID_PATH_PARAMETER,
    },
    access: permissionAccess(Permission.DEVICE_MANAGE),
    audit: DEVICE_COMMAND_AUDIT,
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
          } satisfies DeviceInventory,
        },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  restartDevice: {
    pathParams: { id: STATE_EXAMPLE_IDS.cameraDeviceId },
    responses: {
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
};
