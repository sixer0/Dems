/**
 * Simulator reads for the Storage screen (04_mobile_specs §4.13, §5.1; D19). `useSim` re-renders
 * only when the selected value changes (shallow), so every selector returns primitives, flat
 * objects of primitives, or arrays of store-owned objects (F74-13).
 *
 * Every function that calls a hook is named `use…` (D66: the device build runs the React Compiler).
 */
import { selectEvidenceStats, selectStorage, selectStoragePolicy, useSim, type RetentionPolicyId, type SimEvent } from '@dems/shared/sim';
import type { StorageState } from '@dems/shared/domain';
import { selectStorageActivity } from './sim-adapter';

export interface StorageCapacity {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  /** Whole percent (804 GB of 4.0 TB → 20). */
  usedPercent: number;
  /** Unrounded share 0–100 (the ring sweep). */
  usedRatioPercent: number;
  state: StorageState;
}

/** T2: the evidence volume (ring, headline, Used / Free legend rows). */
export function useStorageCapacity(): StorageCapacity {
  return useSim((s) => {
    const summary = selectStorage(s);
    return {
      totalBytes: summary.totalBytes,
      usedBytes: summary.usedBytes,
      freeBytes: summary.freeBytes,
      usedPercent: summary.usedPercent,
      usedRatioPercent: summary.usedRatioPercent,
      state: summary.state,
    };
  });
}

/** T2 legend: Sealed Evidence (sealed today, D61: 7) and Pending (recorded, not sealed: 1). */
export function useEvidenceCounts(): { sealedToday: number; pending: number } {
  return useSim((s) => {
    const stats = selectEvidenceStats(s);
    return { sealedToday: stats.sealedToday, pending: stats.pending };
  });
}

/** Session size granularity (0.01 GB, the shown precision). */
export const SESSION_STEP_BYTES = 10_000_000;

export interface StorageKpis {
  writeBytesPerSec: number;
  recording: boolean;
  sessionId: string | null;
  sessionBytes: number;
  /** Whole minutes left at 8.2 GB/h (minute granularity keeps the 1 Hz tick from re-rendering). */
  remainingMinutes: number;
}

/** Write speed, session size and est. remaining (04 §4.13 T5; 04 §9 #17). */
export function useStorageKpis(): StorageKpis {
  return useSim((s) => ({
    writeBytesPerSec: s.storage.writeBytesPerSec,
    recording: s.session?.state === 'RECORDING',
    sessionId: s.session?.id ?? null,
    // 10 MB steps: the display shows 0.01 GB, and a raw byte count would re-render every tick.
    sessionBytes: Math.floor((s.session?.bytesWritten ?? 0) / SESSION_STEP_BYTES) * SESSION_STEP_BYTES,
    remainingMinutes: Math.floor(selectStorage(s).estimatedRemainingMs / 60_000),
  }));
}

export interface StoragePolicyView {
  retentionPolicy: RetentionPolicyId;
  retentionDays: number;
  autoArchive: boolean;
}

/** T4 / T5: the retention policy (`storagePolicy`). */
export function useStoragePolicy(): StoragePolicyView {
  return useSim((s) => {
    const policy = selectStoragePolicy(s);
    return { retentionPolicy: policy.retentionPolicy, retentionDays: policy.retentionDays, autoArchive: policy.autoArchive };
  });
}

/** T3: the newest storage events (SIM-GAP-M85-1), newest first. */
export function useStorageActivity(count = 5): SimEvent[] {
  return useSim((s) => selectStorageActivity(s, count));
}
