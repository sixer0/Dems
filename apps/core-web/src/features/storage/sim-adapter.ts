/**
 * Storage page reads over the simulator (step 49; step 54 moved W49-1 and W49-2 into
 * `packages/shared/src/sim`, so this file re-exports the simulator's views under the page's names).
 *
 * - Per-drive health (W49-1): `driveHealth` / `selectDriveHealth` (synthetic SMART counters, live
 *   temperatures; a hot drive turns SMART to WARNING). A dedicated HDD SMART fault kind is not
 *   modelled yet (it would widen `FaultKind` for every consumer and needs i18n; step 91).
 * - Storage activity (W49-2): `selectStorageActivity` (the event stream filtered to storage writes,
 *   seals, exports, policy changes and the two storage faults).
 * - The 24 h usage history never records the STORAGE_LOW / STORAGE_FULL demo fill (F-49-2), and
 *   `setStoragePolicy` needs SUPERVISOR or TECHNICIAN (F-49-1).
 */
import {
  driveHealth,
  driveTemperature,
  type DriveHealth,
  type DriveTempLevel,
  type SimState,
  type SmartStatus as SimSmartStatus,
  type StorageVolume,
} from '@dems/shared/sim'

export {
  DRIVE_TEMP_LIMITS as TEMP_LIMITS,
  isStorageActivityEvent as isStorageEvent,
  selectStorageActivity,
  STORAGE_ACTIVITY_EVENT_TYPES as STORAGE_EVENT_TYPES,
} from '@dems/shared/sim'

export type SmartStatus = SimSmartStatus
export type TempLevel = DriveTempLevel
export type VolumeHealth = DriveHealth

/** Health of one volume (the simulator's `driveHealth`). */
export function volumeHealth(state: SimState, volume: StorageVolume): VolumeHealth {
  return driveHealth(state, volume)
}

/** Selector for one volume's temperature (primitive, so `useSim` re-renders only on change). */
export function selectVolumeTemperature(state: SimState, kind: StorageVolume['kind']): number {
  return driveTemperature(kind, state.health.storageTempC, state.health.cpuTempC)
}

/** Recent temperature samples of one volume (1 Hz health series), for the sparkline. */
export function selectVolumeTemperatureSeries(state: SimState, kind: StorageVolume['kind']): number[] {
  return state.health.series.map((point) => driveTemperature(kind, point.storageTempC, point.cpuTempC))
}
