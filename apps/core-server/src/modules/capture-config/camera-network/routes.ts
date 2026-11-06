/**
 * The live paths of operations 106 and 107 (task 4 blueprint row 111, package WP-22b; the contract
 * `packages/shared/src/api/capture-commissioning.ts`, row 102).
 *
 *   #    operationId          method and path                               access (registry)                         audit on success
 *   106  setCameraNetwork     POST /api/v1/capture/network/cameras/address  CAPTURE_COMMISSION + WEB_CONSOLE_SESSION  CAMERA_NETWORK_SET
 *   107  getCameraNetworkJob  GET  /api/v1/capture/network/jobs/{id}        CAPTURE_COMMISSION + WEB_CONSOLE_SESSION  none (a read)
 *
 * RBAC AND THE CLIENT KIND ARE STAGE 6 (`plugins/permission-guard`), from the registry entry: a
 * role without CAPTURE_COMMISSION (every role but TECHNICIAN, decision U10) and a session of a
 * tablet or a phone (`WEB_CONSOLE_ONLY`) never reach a handler.
 *
 * THE ONE PLACE WHERE WHAT THE TECHNICIAN TYPED IS READ (decisions C1, C7). The handler of 106
 * reads the two members of the body's account ONCE, wraps them at once into the opaque object of
 * the adapter layer and that into its one holder, takes the member off the request body, and hands
 * the service the addresses and the holder - never the two texts. Nothing else of this folder names
 * either member. A body outside the schema is `422` and one that is no JSON `400`; neither refusal
 * quotes the input. What the operations do, and the order of their refusals, is `service.ts`.
 */
import { CAMERA_NETWORK_JOB_ID_PATTERN, CAPTURE_COMMISSIONING_OPERATIONS, CameraNetworkJobSchema, CameraNetworkSetRequestSchema, type CameraNetworkJob, type CoreApiRegistryOperation } from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sealCredential } from '../../../capture/adapters';
import { notSignedIn } from '../../../plugins/authenticate';
import { routeOfOperation } from '../../../plugins/permission-guard';
import { holdTypedAccount, readCameraNetworkJob, startCameraNetworkJob, type CameraNetworkCaller, type CameraNetworkSeams } from './service';

/** The operations this folder answers (operations 106 and 107). */
export const CAPTURE_CAMERA_NETWORK_MODULE_OPERATIONS = ['setCameraNetwork', 'getCameraNetworkJob'] as const;
export type CaptureCameraNetworkModuleOperation = (typeof CAPTURE_CAMERA_NETWORK_MODULE_OPERATIONS)[number];

/** The registry entry of an operation. Throws at load for a name the registry does not hold. */
export function captureCameraNetworkOperation(operationId: CaptureCameraNetworkModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_COMMISSIONING_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** Stage 6 lets only an operator reach these routes; the refusal here is the same backstop the engine host has. */
function callerOf(request: FastifyRequest): CameraNetworkCaller {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { operatorId: principal.operatorId, sessionId: principal.sessionId, deviceId: principal.deviceId };
}

/** Registers operations 106 and 107 on the app. Called once, by the mount of this folder. The seams are read at each call. */
export function registerCaptureCameraNetworkRoutes(app: FastifyInstance, seams: () => CameraNetworkSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 106 setCameraNetwork
  routes.route({
    ...routeOfOperation(captureCameraNetworkOperation('setCameraNetwork')),
    schema: { body: CameraNetworkSetRequestSchema, response: { 202: CameraNetworkJobSchema } },
    handler: async (request, reply): Promise<CameraNetworkJob> => {
      const { body } = request;
      // THE ONE READ of the typed account: into the opaque object, into its holder, and off the request.
      const account = holdTypedAccount(sealCredential({ username: body.credential.username, secret: body.credential.secret }));
      Reflect.deleteProperty(body, 'credential');
      const job = await startCameraNetworkJob(seams(), callerOf(request), { fromAddress: body.fromAddress, scannedMac: body.scannedMac, toAddress: body.toAddress, gateway: body.gateway }, account);
      void reply.code(202);
      return job;
    },
  });

  // 107 getCameraNetworkJob
  routes.route({
    ...routeOfOperation(captureCameraNetworkOperation('getCameraNetworkJob')),
    schema: { params: z.object({ id: z.string().regex(CAMERA_NETWORK_JOB_ID_PATTERN) }), response: { 200: CameraNetworkJobSchema } },
    handler: async (request): Promise<CameraNetworkJob> => readCameraNetworkJob(seams(), callerOf(request), request.params.id),
  });
}
