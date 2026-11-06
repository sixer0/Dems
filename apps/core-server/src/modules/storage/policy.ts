/**
 * Operation 55 `setStoragePolicy`: what of a request body reaches the hosted action (plan row
 * W37; spec §7.11, §7.17 member 34).
 *
 * The body names the members to change (`StoragePolicyRequest`: `retentionPolicy`,
 * `retentionDays`, `autoArchive`, each optional). The shared action takes the same three as a
 * partial policy and keeps the current value of a member that is absent. So the patch holds a
 * member exactly when the body held it, and never anything else of the body.
 *
 * NO RULE OF THE POLICY LIVES HERE. Which policy exists, the range of the days, the days a
 * policy stands for when it is sent alone, and what counts as "unchanged" are the simulator's
 * (`setStoragePolicyTransition`); the contract's request schema refuses a value outside the same
 * bounds at stage 7, before the engine runs.
 */
import type { StoragePolicyRequest } from '@dems/shared/api';
import type { StoragePolicy } from '@dems/shared/sim';

export function policyPatchOf(body: StoragePolicyRequest): Partial<StoragePolicy> {
  const patch: Partial<StoragePolicy> = {};
  if (body.retentionPolicy !== undefined) patch.retentionPolicy = body.retentionPolicy;
  if (body.retentionDays !== undefined) patch.retentionDays = body.retentionDays;
  if (body.autoArchive !== undefined) patch.autoArchive = body.autoArchive;
  return patch;
}
