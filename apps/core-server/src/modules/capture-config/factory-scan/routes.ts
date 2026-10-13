/**
 * The live path of operation 103 (task 4 blueprint row 107, package WP-19c; the contract
 * `packages/shared/src/api/capture-commissioning.ts`, row 102).
 *
 *   #    operationId         method and path                     access (registry)                           audit on success
 *   103  scanFactoryCameras  POST /api/v1/capture/network/scan   CAPTURE_COMMISSION + WEB_CONSOLE_SESSION    CAMERA_FACTORY_SCANNED
 *
 * RBAC AND THE CLIENT KIND ARE STAGE 6 (`plugins/permission-guard`), from the registry entry: a
 * role without CAPTURE_COMMISSION (every role but TECHNICIAN, decision U10) and a session of a
 * tablet or a phone (`WEB_CONSOLE_ONLY`) never reach the handler and get their one ACCESS_DENIED
 * row there, before the body is read.
 *
 * THE BODY is optional: no body and `{}` scan the stored list; `address` adds ONE typed address.
 * It is a strict object: a list, a range, a subnet, a port, an interface or a timeout is `422`,
 * and a body that is no JSON is `400`; neither refusal quotes the input. What the operation does,
 * and the order of its refusals, is `service.ts`.
 */
import { CAPTURE_COMMISSIONING_OPERATIONS, CameraFactoryScanRequestSchema, CameraFactoryScanSchema, type CameraFactoryScan, type CoreApiRegistryOperation } from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { notSignedIn } from '../../../plugins/authenticate';
import { routeOfOperation } from '../../../plugins/permission-guard';
import { scanFactoryCameras, type FactoryScanCaller, type FactoryScanSeams } from './service';

/** The operation this folder answers (operation 103). */
export const CAPTURE_FACTORY_SCAN_MODULE_OPERATIONS = ['scanFactoryCameras'] as const;
export type CaptureFactoryScanModuleOperation = (typeof CAPTURE_FACTORY_SCAN_MODULE_OPERATIONS)[number];

/** The registry entry of the operation. Throws at load for a name the registry does not hold. */
export function captureFactoryScanOperation(operationId: CaptureFactoryScanModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_COMMISSIONING_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** Stage 6 lets only an operator reach this route; the refusal here is the same backstop the engine host has. */
function callerOf(request: FastifyRequest): FactoryScanCaller {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { operatorId: principal.operatorId, deviceId: principal.deviceId };
}

/** Registers operation 103 on the app. Called once, by the mount of this folder. The seams are read at each call. */
export function registerCaptureFactoryScanRoutes(app: FastifyInstance, seams: () => FactoryScanSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 103 scanFactoryCameras
  routes.route({
    ...routeOfOperation(captureFactoryScanOperation('scanFactoryCameras')),
    schema: { body: CameraFactoryScanRequestSchema.optional(), response: { 200: CameraFactoryScanSchema } },
    handler: async (request): Promise<CameraFactoryScan> => scanFactoryCameras(seams(), callerOf(request), request.body),
  });
}
