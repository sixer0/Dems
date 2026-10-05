/**
 * The registry entries of the identity operations (spec §7.5; operations 2 to 9 of the shared
 * registry, `IDENTITY_OPERATIONS` of the contract).
 *
 * One lookup for the module: the identity core's routes (`routes.ts`, operations 2 to 6) and the
 * biometric row's (`biometric/routes.ts`, operations 7 to 9) each had a copy of it (fix round
 * B1, finding F-8). A route is registered from what this returns:
 * `routes.route({ ...routeOfOperation(operationOf('signIn')), … })`.
 */
import { IDENTITY_OPERATIONS } from '@dems/shared/api';

/** One entry of the registry's identity table. */
export type IdentityOperation = (typeof IDENTITY_OPERATIONS)[number];
/** The operation IDs of that table: a name that is no identity operation does not compile. */
export type IdentityOperationId = IdentityOperation['operationId'];

/** The registry entry of one identity operation. A missing one stops the start. */
export function operationOf(operationId: IdentityOperationId): IdentityOperation {
  const operation = IDENTITY_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}
