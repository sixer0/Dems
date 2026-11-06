/**
 * The health snapshot row (plan row W20; database contract §4.28; spec §8.7, E-25).
 *
 * One row every 60 s and one at every fault raise and clear. The row is a projection of six
 * slices at one instant; it is written, never read back (no operation reads the table in this
 * task), so the mapping has one direction. The engine host decides WHEN a row is due; this
 * function decides WHAT it holds. Pure.
 */
import type { SimState } from '@dems/shared/sim';
import type { FaultKindValue, NewHealthSnapshotRow, SnapshotCauseValue } from '../schema';
import { MappingError, safeInteger } from './guards';

export type HealthSnapshotCause =
  | { readonly cause: Extract<SnapshotCauseValue, 'INTERVAL'> }
  | { readonly cause: Exclude<SnapshotCauseValue, 'INTERVAL'>; readonly faultKind: FaultKindValue };

type HealthSnapshotSource = Pick<SimState, 'health' | 'storage' | 'time' | 'security' | 'session' | 'faults'>;

function finite(value: number, column: string): number {
  if (!Number.isFinite(value)) throw new MappingError('NOT_FINITE', `health_snapshots.${column}`, 'the measured value is not finite.');
  return value;
}

/**
 * The row for `state` at `at`. The `id` is left to the table's default. `fault_kind` is set
 * exactly when the cause is a fault raise or clear, as the table's CHECK requires.
 */
export function healthSnapshotToRow(state: HealthSnapshotSource, at: number, why: HealthSnapshotCause): NewHealthSnapshotRow {
  const evidenceVolume = state.storage.volumes.find((volume) => volume.kind === 'EVIDENCE');
  if (evidenceVolume === undefined) {
    throw new MappingError('ROW_SHAPE', 'health_snapshots.evidence_used_bytes', 'the storage slice has no evidence volume.');
  }
  return {
    at: safeInteger(at, 'health_snapshots.at'),
    cause: why.cause,
    faultKind: why.cause === 'INTERVAL' ? null : why.faultKind,
    cpuPercent: finite(state.health.cpuPercent, 'cpu_percent'),
    cpuTempC: finite(state.health.cpuTempC, 'cpu_temp_c'),
    storageTempC: finite(state.health.storageTempC, 'storage_temp_c'),
    ambientTempC: finite(state.health.ambientTempC, 'ambient_temp_c'),
    fanRpm: safeInteger(state.health.fanRpm, 'health_snapshots.fan_rpm'),
    fanOk: state.health.fanOk,
    storageState: state.storage.state,
    evidenceUsedBytes: safeInteger(evidenceVolume.usedBytes, 'health_snapshots.evidence_used_bytes'),
    timeSource: state.time.source,
    timeOffsetMs: finite(state.time.offsetMs, 'time_offset_ms'),
    securityState: state.security.state,
    sessionState: state.session === null ? null : state.session.state,
    activeFaults: safeInteger(state.faults.active.length, 'health_snapshots.active_faults'),
  };
}
