/**
 * Devices module (plan row W36; spec §7.10, §7.17): operations 44 to 52 of the shared registry,
 * the recording hardware of the Core itself (cameras, microphones, the other devices and the
 * platform devices GNSS, TPM and FRONT-PANEL). The paired mobile devices of the registry
 * (`DEV-NNNN`) are the pairing module's, not this one's.
 *
 *   #   operationId          method and path                        access (registry)  audit on success
 *   44  getDeviceHealth      GET  /api/v1/device/health             AUTHENTICATED      none (a read)
 *   45  getAudioStatus       GET  /api/v1/audio/status              AUTHENTICATED      none (a read)
 *   46  getVideoStatus       GET  /api/v1/video/status              AUTHENTICATED      none (a read)
 *   47  getDeviceInventory   GET  /api/v1/device/inventory          AUTHENTICATED      none (a read)
 *   48  restartDevice        POST /api/v1/device/{id}/restart       DEVICE_MANAGE      DEVICE_COMMAND
 *   49  testDeviceSignal     POST /api/v1/device/{id}/test-signal   DIAGNOSTICS_RUN    DEVICE_COMMAND
 *   50  identifyDevice       POST /api/v1/device/{id}/identify      DIAGNOSTICS_RUN    DEVICE_COMMAND
 *   51  setActiveCamera      POST /api/v1/video/active-camera       AUTHENTICATED      none (parity)
 *   52  resetMicClip         POST /api/v1/audio/clip/reset          AUTHENTICATED      none (parity)
 *
 * READS (44 to 47) answer from the engine's COMMITTED state (`app.engine.state()`): no unit of
 * work, no statement, nothing changes. The mapping is `status.ts`.
 * Task 3 row 140 (R-11; D137 (2)): the mapping reads the selector of that same state, so a track
 * names the device that feeds it now (an adopted camera, this Mac's camera) and a microphone line
 * the input it holds (`MIC-03`), instead of the built-in pair.
 *
 * COMMANDS (48 to 52) are hosted actions of the shared simulator: ONE call of
 * `app.engine.command(request.principal, action, ...args)`, which runs the action as one unit of
 * work, writes its effect and its audit row and resolves after the commit. The answer is 204;
 * the engine's unit gives it `x-dems-epoch` and `x-dems-revision` of that outcome (API-7;
 * `src/engine/api-headers.ts`). What the action does over
 * time (the two seconds of a test tone) is the simulator's, on the engine's ticks.
 *
 * REFUSALS are not built here. A refusal of the simulator arrives as an `ApiFailure` with
 * `details.simCode` and propagates: 404 `NOT_FOUND` for a device the Core does not have,
 * 409 `RECORDING_ACTIVE` for a restart while a recording runs, 409 `COMMAND_UNSUPPORTED` for a
 * platform device that accepts IDENTIFY only. A malformed path ID or body is the schema stage's
 * 422 `INVALID_INPUT`. An engine that is not running is 503 `NOT_READY`.
 *
 * WHO MAY CALL is not checked here: the access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`), which also writes the one `ACCESS_DENIED` row of a refused call.
 * Operations 51 and 52 run actions the simulator does not check at all, so that rule is the
 * only check there is.
 *
 * SOURCE FACTS (integration pass D11; `source-facts.ts`): in a REAL capture operation the module
 * hands the engine what the capture side knows of the registered sources - the class of a test
 * source and whether a source is open now (`adapter` / `sourceClass` / `sourceOpen` of slice
 * `captureDevices`). No route, no actor, no audit row; never in capture operation SIMULATED.
 *
 * ERRORS. The routes catch nothing (the one failure path of the folder is in `source-facts.ts`): an unexpected failure reaches the error envelope, which
 * writes it to the log and to the persistent error log; a hosted action that fails is logged
 * and persisted by the engine host.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `devicesModule` keeps its name.
 */
import {
  ActiveCameraRequestSchema,
  AudioStatusResponseSchema,
  DeviceHealthResponseSchema,
  DeviceInventorySchema,
  MicClipResetRequestSchema,
  VideoStatusResponseSchema,
  type AudioStatusResponse,
  type CoreApiRegistryOperation,
  type DeviceHealthResponse,
  type DeviceInventory,
  type VideoStatusResponse,
} from '@dems/shared/api';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { routeOfOperation } from '../../plugins/permission-guard';
import { DEVICE_COMMAND_OF_OPERATION, operationOf, type DeviceCommandOperation } from './operations';
import { inRealCaptureOperation, mountCaptureSourceFacts } from './source-facts';
import { audioStatusOf, captureSlotsOf, deviceHealthOf, deviceInventoryOf, videoStatusOf } from './status';

export { SOURCE_FACTS_BOOT_STEP, SOURCE_FACTS_NOT_APPLIED, captureSourceFacts, mountCaptureSourceFacts, sourceFactsOf, type CaptureSourceFactsFeed, type RegisteredSource, type SourceFactsPorts } from './source-facts';
export { DEVICES_OPERATIONS, DEVICE_COMMAND_OF_OPERATION, operationOf, type DeviceCommandOperation, type DevicesOperation } from './operations';
export {
  activeInputOf,
  audioChannelsOf,
  audioStatusOf,
  cameraStreamFactsOf,
  captureSlotsOf,
  deviceHealthOf,
  deviceInventoryOf,
  stateLevelsOf,
  storageStatusOf,
  videoStatusOf,
  videoTracksOf,
  withCameraStreamFacts,
  type CameraStreamFacts,
  type CaptureSlots,
  type ChannelLevels,
  type CommittedState,
} from './status';

/**
 * The `{id}` of a device command (API-3: the one path parameter is named `id`), held to the
 * pattern the registry entry gives for it. A value outside it is the schema stage's 422.
 */
function deviceParamsOf(operation: CoreApiRegistryOperation) {
  if (operation.pathParam === undefined) throw new Error(`the registry entry of ${operation.operationId} has no path parameter`);
  return z.object({ id: z.string().regex(operation.pathParam.pattern) });
}

/** The answer of a command that committed: 204, no body. */
const commandDone = (reply: FastifyReply): FastifyReply => reply.code(204).send();

export const devicesModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // Integration pass D11: the class and the "is on" of the sources of a REAL capture operation go
  // into slice `captureDevices` through the engine's fact door (`source-facts.ts`). Nothing in SIMULATED.
  mountCaptureSourceFacts(app);

  // Task 4 row 53 (WP-10b): a Core in REAL capture states the picture, the rate and the codec of a video track from the
  // STORED statement of the stream in its selector slot (`cameraStreamFactsOf`) - HEVC with no rate, never a default.
  // A Core in capture operation SIMULATED answers its slice, as the simulator does. The three camera-bearing reads below
  // take the flag. The operation is asked of the one function that relates the flags (static rule G-R16), through the
  // feed file, the folder's one reader of the fence (static rule M8 of this folder).
  const streamFacts = inRealCaptureOperation(app);

  // 44 getDeviceHealth
  routes.route({
    ...routeOfOperation(operationOf('getDeviceHealth')),
    schema: { response: { 200: DeviceHealthResponseSchema } },
    handler: async (): Promise<DeviceHealthResponse> => {
      const state = app.engine.state();
      return deviceHealthOf(state, app.clock.now(), app.engine.meters(), captureSlotsOf(state), streamFacts);
    },
  });

  // 45 getAudioStatus
  routes.route({
    ...routeOfOperation(operationOf('getAudioStatus')),
    schema: { response: { 200: AudioStatusResponseSchema } },
    handler: async (): Promise<AudioStatusResponse> => audioStatusOf(app.engine.state(), app.clock.now(), app.engine.meters()),
  });

  // 46 getVideoStatus
  routes.route({
    ...routeOfOperation(operationOf('getVideoStatus')),
    schema: { response: { 200: VideoStatusResponseSchema } },
    handler: async (): Promise<VideoStatusResponse> => {
      const state = app.engine.state();
      return videoStatusOf(state, captureSlotsOf(state), streamFacts);
    },
  });

  // 47 getDeviceInventory
  routes.route({
    ...routeOfOperation(operationOf('getDeviceInventory')),
    schema: { response: { 200: DeviceInventorySchema } },
    handler: async (): Promise<DeviceInventory> => deviceInventoryOf(app.engine.state(), undefined, streamFacts),
  });

  // 48 restartDevice, 49 testDeviceSignal, 50 identifyDevice: one hosted action, one command each.
  for (const operationId of Object.keys(DEVICE_COMMAND_OF_OPERATION) as DeviceCommandOperation[]) {
    const operation = operationOf(operationId);
    const command = DEVICE_COMMAND_OF_OPERATION[operationId];
    routes.route({
      ...routeOfOperation(operation),
      schema: { params: deviceParamsOf(operation) },
      handler: async (request, reply) => {
        await app.engine.command(request.principal, 'deviceCommand', request.params.id, command);
        return commandDone(reply);
      },
    });
  }

  // 51 setActiveCamera
  routes.route({
    ...routeOfOperation(operationOf('setActiveCamera')),
    schema: { body: ActiveCameraRequestSchema },
    handler: async (request, reply) => {
      await app.engine.command(request.principal, 'setActiveCamera', request.body.cameraId);
      return commandDone(reply);
    },
  });

  // 52 resetMicClip
  routes.route({
    ...routeOfOperation(operationOf('resetMicClip')),
    schema: { body: MicClipResetRequestSchema },
    handler: async (request, reply) => {
      await app.engine.command(request.principal, 'resetClip', request.body.channel);
      return commandDone(reply);
    },
  });
};
