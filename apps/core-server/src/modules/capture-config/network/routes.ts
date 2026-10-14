/**
 * The live paths of operations 101 and 102 (task 4 blueprint row 108, package WP-19d; the contract
 * `packages/shared/src/api/capture-commissioning.ts`, row 102).
 *
 *   #    operationId                 method and path                      access (registry)                           audit on success
 *   101  getCaptureNetworkConfig     GET  /api/v1/capture/network/config  CAPTURE_COMMISSION + WEB_CONSOLE_SESSION    none (a read)
 *   102  updateCaptureNetworkConfig  POST /api/v1/capture/network/config  CAPTURE_COMMISSION + WEB_CONSOLE_SESSION    CAPTURE_NETWORK_CONFIG_CHANGED
 *
 * RBAC AND THE CLIENT KIND ARE STAGE 6 (`plugins/permission-guard`), from the registry entry: a
 * role without CAPTURE_COMMISSION (every role but TECHNICIAN, decision U10) and a session of a
 * tablet or a phone (`WEB_CONSOLE_ONLY`) never reach a handler here and get their one
 * ACCESS_DENIED row there, before the body is read.
 *
 * OPERATION 102 takes a strict object: `revision` and up to seven settings (the seventh, `onvifPorts`, row V7b). A body that is no JSON
 * is `400`, one that does not match is `422`; neither refusal quotes the input. What the
 * operations do, and the order of their refusals, is `service.ts`.
 */
import {
  CAPTURE_COMMISSIONING_OPERATIONS,
  CaptureNetworkConfigSchema,
  CaptureNetworkConfigUpdateRequestSchema,
  type CaptureNetworkConfig,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { notSignedIn } from '../../../plugins/authenticate';
import { routeOfOperation } from '../../../plugins/permission-guard';
import { changeNetworkConfig, readNetworkConfig, type NetworkConfigCaller, type NetworkConfigSeams } from './service';

/** The operations this folder answers, in registry order (operations 101 and 102). */
export const CAPTURE_NETWORK_CONFIG_MODULE_OPERATIONS = ['getCaptureNetworkConfig', 'updateCaptureNetworkConfig'] as const;
export type CaptureNetworkConfigModuleOperation = (typeof CAPTURE_NETWORK_CONFIG_MODULE_OPERATIONS)[number];

/** The registry entry of one of these operations. Throws at load for a name the registry does not hold. */
export function captureNetworkConfigOperation(operationId: CaptureNetworkConfigModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_COMMISSIONING_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** Stage 6 lets only an operator reach these routes; the refusal here is the same backstop the engine host has. */
function callerOf(request: FastifyRequest): NetworkConfigCaller {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { operatorId: principal.operatorId, deviceId: principal.deviceId };
}

/** Registers operations 101 and 102 on the app. Called once, by the mount of this folder. The seams are read at each call. */
export function registerCaptureNetworkConfigRoutes(app: FastifyInstance, seams: () => NetworkConfigSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 101 getCaptureNetworkConfig
  routes.route({
    ...routeOfOperation(captureNetworkConfigOperation('getCaptureNetworkConfig')),
    schema: { response: { 200: CaptureNetworkConfigSchema } },
    handler: async (): Promise<CaptureNetworkConfig> => readNetworkConfig(seams()),
  });

  // 102 updateCaptureNetworkConfig
  routes.route({
    ...routeOfOperation(captureNetworkConfigOperation('updateCaptureNetworkConfig')),
    schema: { body: CaptureNetworkConfigUpdateRequestSchema, response: { 200: CaptureNetworkConfigSchema } },
    handler: async (request): Promise<CaptureNetworkConfig> => changeNetworkConfig(seams(), callerOf(request), request.body),
  });
}
