/**
 * The one slice-to-table mapping (plan row W20; hand-built element HB-13, mapping half; database
 * contract MR-1 to MR-9).
 *
 *   toRows(state, context)      the 28 durable slices as rows of 16 tables      seed, reset
 *   fromRows(rows)              the rows back to the 28 durable slices           rehydration
 *   diffSlices(prev, next, at)  the row changes between two states               write-through
 *
 * All three are built from the same row builders (`rows.ts`), so there is one mapping, in both
 * directions, whoever writes. Everything in this folder is PURE: no database, no clock, no
 * random source, no file. The database side (the statements that write and read these rows) is
 * `../store`.
 *
 * What is not mapped, and why: `slices.ts`. What the mapping refuses: `guards.ts`.
 */
export {
  DURABLE_SLICE_KEYS,
  SNAPSHOT_SLICE_COLUMNS,
  SNAPSHOT_SLICE_KEYS,
  STORED_SLICE_KEYS,
  STORED_SLICE_TABLES,
  UNMAPPED_SLICES,
  pickDurable,
  type DurableSliceKey,
  type DurableSlices,
  type MappableState,
  type SnapshotSliceKey,
  type StoredSliceKey,
  type UnmappedSliceKey,
} from './slices';
export {
  MappingError,
  isStorableText,
  safeInteger,
  safeIntegerOrNull,
  storableJson,
  storableText,
  storableTextOrNull,
  type MappingErrorCode,
} from './guards';
export {
  COUNTER_NAMES,
  activeSessionFromRow,
  activeSessionToRow,
  alertFromRow,
  alertReasonOf,
  alertToRow,
  auditRowFromRow,
  auditRowToRow,
  coreDeviceFromRow,
  coreDeviceToRow,
  coreStateToRow,
  countersFromRows,
  countersToRows,
  eventFromRow,
  eventToRow,
  evidenceCustodyToRows,
  evidenceItemFromRows,
  evidenceItemToRow,
  evidenceTracksToRows,
  hardwareSnapshotToRow,
  metaFromRows,
  operatorFromRow,
  operatorToRow,
  sessionHistoryFromRow,
  sessionHistoryToRow,
  settingsFromRow,
  settingsToRow,
  snapshotSlicesFromRow,
  storagePolicyFromRow,
  storagePolicyToRow,
  type RowContext,
  type SealedEvidenceItem,
  type SealedItemMembers,
  type SealedLabelsStatus,
} from './rows';
export {
  TABLE_SQL_NAMES,
  WRITE_ORDER,
  assertCompleteRings,
  countRows,
  toRows,
  type MappedRow,
  type MappedRows,
  type MappedTable,
  type WrittenTable,
} from './to-rows';
export { RING_LIMITS, fromRows, type FromRowsOptions, type StoredRows } from './from-rows';
export type { CaptureDeviceListing } from './rows';
export {
  RUNTIME_UPDATABLE_COLUMNS,
  diffSlices,
  diffSnapshot,
  diffStored,
  newAuditRows,
  newEvents,
  summariseChanges,
  type DeleteChange,
  type InsertChange,
  type RowChange,
  type UpdateChange,
  type UpdatedTable,
} from './changes';
export { verifyStoredAuditRows, type StoredDigestContext, type StoredDigestFailureCode, type StoredDigestVerdict } from './audit-verify';
export { exportRowFromAudit, exportRowsFromAudit } from './exports';
export { matrixFromRows, rbacRows, type RbacRows } from './rbac';
export { healthSnapshotToRow, type HealthSnapshotCause } from './health-snapshot';
