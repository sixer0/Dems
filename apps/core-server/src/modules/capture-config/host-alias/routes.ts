/**
 * The live paths of operations 104 and 105 (task 4 row 106b; the contract
 * `packages/shared/src/api/capture-commissioning.ts`, row 102).
 *
 *   #    operationId      method and path                            access (registry)                           audit on success
 *   104  getHostAlias     GET  /api/v1/capture/network/alias         CAPTURE_COMMISSION + WEB_CONSOLE_SESSION    none (a read)
 *   105  removeHostAlias  POST /api/v1/capture/network/alias/remove  CAPTURE_COMMISSION + WEB_CONSOLE_SESSION    HOST_ALIAS_REMOVED
 *
 * RBAC AND THE CLIENT KIND ARE STAGE 6 (`plugins/permission-guard`), from the registry entry: a
 * role without CAPTURE_COMMISSION (every role but TECHNICIAN, decision U10) and a session of a
 * tablet or a phone (`WEB_CONSOLE_ONLY`) never reach a handler and get their one ACCESS_DENIED row
 * there. 105 HAS NO BODY: the address is the lifecycle's own state, never a request's.
 */
import { CAPTURE_COMMISSIONING_OPERATIONS, HostAliasStateSchema, type CoreApiRegistryOperation, type HostAliasState } from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { notSignedIn } from '../../../plugins/authenticate';
import { routeOfOperation } from '../../../plugins/permission-guard';
import { readHostAlias, removeHostAlias, type HostAliasRouteCaller, type HostAliasRouteSeams } from './service';

/** The operations this folder answers, in registry order (operations 104 and 105). */
export const CAPTURE_HOST_ALIAS_MODULE_OPERATIONS = ['getHostAlias', 'removeHostAlias'] as const;
export type CaptureHostAliasModuleOperation = (typeof CAPTURE_HOST_ALIAS_MODULE_OPERATIONS)[number];

/** The registry entry of one of these operations. Throws at load for a name the registry does not hold. */
export function captureHostAliasOperation(operationId: CaptureHostAliasModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_COMMISSIONING_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** Stage 6 lets only an operator reach these routes; the refusal here is the same backstop the engine host has. */
function callerOf(request: FastifyRequest): HostAliasRouteCaller {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { operatorId: principal.operatorId, deviceId: principal.deviceId };
}

/** Registers operations 104 and 105 on the app. Called once, by the mount of this folder. The seams are read at each call. */
export function registerCaptureHostAliasRoutes(app: FastifyInstance, seams: () => HostAliasRouteSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 104 getHostAlias
  routes.route({
    ...routeOfOperation(captureHostAliasOperation('getHostAlias')),
    schema: { response: { 200: HostAliasStateSchema } },
    handler: async (): Promise<HostAliasState> => readHostAlias(seams()),
  });

  // 105 removeHostAlias
  routes.route({
    ...routeOfOperation(captureHostAliasOperation('removeHostAlias')),
    schema: { response: { 200: HostAliasStateSchema } },
    handler: async (request): Promise<HostAliasState> => removeHostAlias(seams(), callerOf(request)),
  });
}
