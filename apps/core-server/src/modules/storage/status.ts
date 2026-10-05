/**
 * Operation 53 `getStorageStatus`: the design-book summary of the storage (plan row W37; spec
 * §7.11; design book §21.2; contract `StorageStatusResponse` in `core-api.ts`).
 *
 * The answer is the one the shared simulator gives in Simulated mode (`sim/api.ts`,
 * `storageStatus`, which the shared package does not export): the evidence volume's summary from
 * the shared selector `storageSummary`, the write rate and the bitrate of the `storage` slice,
 * the volumes, and the retention policy of the `storagePolicy` slice. The arithmetic (free bytes,
 * the used percentage, the remaining time at 8.2 GB/h) is the selector's; this file adds only the
 * rounding of the remaining time that the simulator's handler does. A test holds the two answers
 * equal, member by member, on the same state.
 *
 * Pure: it reads the two slices it is given and nothing else, and it changes neither. No instant
 * appears in the answer.
 */
import type { StorageStatusResponse } from '@dems/shared/api';
import { storageSummary, type SimState } from '@dems/shared/sim';

/** The two slices the summary is made of: both from ONE committed state. */
export type StorageStatusSource = Pick<SimState, 'storage' | 'storagePolicy'>;

export function storageStatusOf(state: StorageStatusSource): StorageStatusResponse {
  const summary = storageSummary(state);
  const { storage, storagePolicy } = state;
  return {
    state: summary.state,
    totalBytes: summary.totalBytes,
    usedBytes: summary.usedBytes,
    freeBytes: summary.freeBytes,
    usedPercent: summary.usedPercent,
    estimatedRemainingMs: Math.round(summary.estimatedRemainingMs),
    writeBytesPerSec: storage.writeBytesPerSec,
    bitrateMbps: storage.bitrateMbps,
    volumes: storage.volumes.map((volume) => ({
      id: volume.id,
      kind: volume.kind,
      label: volume.label,
      totalBytes: volume.totalBytes,
      usedBytes: volume.usedBytes,
    })),
    retention: {
      policy: storagePolicy.retentionPolicy,
      days: storagePolicy.retentionDays,
      autoArchive: storagePolicy.autoArchive,
    },
  };
}
