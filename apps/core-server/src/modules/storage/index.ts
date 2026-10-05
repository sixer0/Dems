/**
 * Storage module (plan row W37; spec §7.11, §7.17 member 34; contract
 * `packages/shared/src/api/core-api.ts` for operation 53 and `storage.ts` for 54 and 55).
 *
 *   #   operationId        method and path              access (registry)                      audit on success
 *   53  getStorageStatus   GET  /api/v1/storage/status  AUTHENTICATED                          none (a read)
 *   54  getStorageDetail   GET  /api/v1/storage/detail  AUTHENTICATED                          none (a read)
 *   55  setStoragePolicy   POST /api/v1/storage/policy  ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)   STORAGE_POLICY_CHANGED; none when unchanged
 *
 * Method, path and schemas are the registry's: each route is built from its registry entry
 * (`routeOfOperation`) and names it in `config.operationId`.
 *
 * WHO MAY CALL is not checked here. The access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`), before the body is read. Operation 55 is the one any-of rule of
 * the registry: a holder of either permission passes; a holder of neither is refused there with
 * one `ACCESS_DENIED` row. This folder reads no role, no permission, no session and no device,
 * and writes no audit row of its own.
 *
 * THE TWO READS answer from the engine's COMMITTED state (`app.engine.state()`: no pipeline, no
 * transaction, by reference; nothing here changes it). Each takes the state once, so the two
 * slices of an answer belong to one committed state. Operation 53 is the design-book summary
 * (`status.ts`); operation 54 is the slices `storage` and `storagePolicy` in their wire form.
 *
 * THE COMMAND is one hosted action (`app.engine.command`): the shared simulator's
 * `setStoragePolicy` under the caller's identity, in one unit of work. The policy's values, its
 * bounds and what counts as a change are the simulator's. When the policy changed, the unit
 * writes the row of `storage_policy`, one `STORAGE_POLICY_CHANGED` audit row with the session's
 * operator as its actor and one event; when it did not, nothing is written. The answer leaves
 * after the commit and holds the committed policy; the engine's unit gives it the epoch and the
 * revision of the outcome (API-7; `src/engine/api-headers.ts`). A refusal of the simulator, a unit that could not be committed and an engine
 * that is not running arrive as the `ApiFailure` of the engine host and are left to propagate.
 * One of them can follow a commit: an engine that is stopped (a reset, a shutdown) between the
 * commit and the read of the committed policy answers 503 `NOT_READY` although the change is
 * stored; a client learns the policy from the replicated state once the server is back.
 *
 * Every instant in an answer is the engine's, which runs on the server clock (`app.clock`).
 * This folder reads no clock at all.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `storageModule` keeps its name.
 */
import {
  StorageDetailSchema,
  StoragePolicyRequestSchema,
  StoragePolicySliceSchema,
  StorageStatusResponseSchema,
  findCoreApiOperation,
  type CoreApiRegistryOperation,
  type StorageDetail,
  type StoragePolicySliceBody,
  type StorageStatusResponse,
} from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { routeOfOperation } from '../../plugins/permission-guard';
import { policyPatchOf } from './policy';
import { storageStatusOf } from './status';

export { policyPatchOf } from './policy';
export { storageStatusOf, type StorageStatusSource } from './status';

/** The operations this module answers, in registry order (53, 54, 55). */
export const STORAGE_MODULE_OPERATIONS = ['getStorageStatus', 'getStorageDetail', 'setStoragePolicy'] as const;
export type StorageModuleOperation = (typeof STORAGE_MODULE_OPERATIONS)[number];

/** The hosted simulator action behind operation 55 (spec §7.17 member 34). */
export const STORAGE_POLICY_ACTION = 'setStoragePolicy';

function registryEntry(operationId: StorageModuleOperation): CoreApiRegistryOperation {
  const operation = findCoreApiOperation(operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

export const storageModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 53 getStorageStatus
  routes.route({
    ...routeOfOperation(registryEntry('getStorageStatus')),
    schema: { response: { 200: StorageStatusResponseSchema } },
    handler: async (): Promise<StorageStatusResponse> => storageStatusOf(app.engine.state()),
  });

  // 54 getStorageDetail
  routes.route({
    ...routeOfOperation(registryEntry('getStorageDetail')),
    schema: { response: { 200: StorageDetailSchema } },
    handler: async (): Promise<StorageDetail> => {
      const { storage, storagePolicy } = app.engine.state();
      return { storage, storagePolicy };
    },
  });

  // 55 setStoragePolicy
  routes.route({
    ...routeOfOperation(registryEntry('setStoragePolicy')),
    schema: { body: StoragePolicyRequestSchema, response: { 200: StoragePolicySliceSchema } },
    handler: async (request): Promise<StoragePolicySliceBody> => {
      await app.engine.command(request.principal, STORAGE_POLICY_ACTION, policyPatchOf(request.body));
      // The command has committed: this is the policy the tables hold. An engine that stopped in
      // between answers its 503 here, and a 503 carries neither header of API-7.
      return app.engine.slice('storagePolicy');
    },
  });
};
