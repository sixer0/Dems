/**
 * The live paths of operations 109 and 110 (task 4 blueprint row 117, package WP-26b; the contract
 * `packages/shared/src/api/installation-acceptance.ts`, row 116).
 *
 *   #    operationId                   method and path                               access (registry)                           audit on success
 *   109  acceptInstallation            POST /api/v1/installation/acceptance          CAPTURE_COMMISSION + WEB_CONSOLE_SESSION    INSTALLATION_ACCEPTED
 *   110  revokeInstallationAcceptance  POST /api/v1/installation/acceptance/revoke   CAPTURE_COMMISSION + WEB_CONSOLE_SESSION    INSTALLATION_ACCEPTANCE_REVOKED
 *
 * RBAC AND THE CLIENT KIND ARE STAGE 6 (`plugins/permission-guard`), from the registry entry: a
 * role without CAPTURE_COMMISSION (every role but TECHNICIAN, decision U10) and a session of a
 * tablet or a phone (`WEB_CONSOLE_ONLY`) never reach a handler here and get their one
 * ACCESS_DENIED row there, before the body is read.
 *
 * NO FREE JSON (S13-13). Both bodies are the contract's STRICT objects, at every level: a member
 * outside a closed key list - each of the 28 denied key names among them - is `422` HERE, before
 * a statement is sent; the CHECKs of the table are the backstop behind it. A body that is no JSON
 * is `400`. Neither refusal quotes the input. What the operations do, and the order of their
 * refusals, is `service.ts`.
 */
import {
  INSTALLATION_ACCEPTANCE_OPERATIONS,
  InstallationAcceptRequestSchema,
  InstallationAcceptanceRevokeRequestSchema,
  InstallationAcceptanceSchema,
  type CoreApiRegistryOperation,
  type InstallationAcceptance,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { notSignedIn } from '../../../plugins/authenticate';
import { routeOfOperation } from '../../../plugins/permission-guard';
import { acceptInstallation, revokeInstallationAcceptance, type InstallationAcceptanceCaller, type InstallationAcceptanceSeams } from './service';

/** The operations this folder answers, in registry order (operations 109 and 110). */
export const INSTALLATION_ACCEPTANCE_MODULE_OPERATIONS = ['acceptInstallation', 'revokeInstallationAcceptance'] as const;
export type InstallationAcceptanceModuleOperation = (typeof INSTALLATION_ACCEPTANCE_MODULE_OPERATIONS)[number];

/** The registry entry of one of these operations. Throws at load for a name the registry does not hold. */
export function installationAcceptanceOperation(operationId: InstallationAcceptanceModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = INSTALLATION_ACCEPTANCE_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** Stage 6 lets only an operator reach these routes; the refusal here is the same backstop the engine host has. */
function callerOf(request: FastifyRequest): InstallationAcceptanceCaller {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { operatorId: principal.operatorId, deviceId: principal.deviceId };
}

/** Registers operations 109 and 110 on the app. Called once, by the mount of this folder. The seams are read at each call. */
export function registerInstallationAcceptanceRoutes(app: FastifyInstance, seams: () => InstallationAcceptanceSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 109 acceptInstallation
  routes.route({
    ...routeOfOperation(installationAcceptanceOperation('acceptInstallation')),
    schema: { body: InstallationAcceptRequestSchema, response: { 200: InstallationAcceptanceSchema } },
    handler: async (request): Promise<InstallationAcceptance> => acceptInstallation(seams(), callerOf(request), request.body),
  });

  // 110 revokeInstallationAcceptance
  routes.route({
    ...routeOfOperation(installationAcceptanceOperation('revokeInstallationAcceptance')),
    schema: { body: InstallationAcceptanceRevokeRequestSchema, response: { 200: InstallationAcceptanceSchema } },
    handler: async (request): Promise<InstallationAcceptance> => revokeInstallationAcceptance(seams(), callerOf(request), request.body),
  });
}
