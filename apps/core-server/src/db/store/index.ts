/**
 * The store: the database side of the slice-to-table mapping (plan row W20; the database half of
 * hand-built element HB-13; review finding CPB1-11).
 *
 *   store.ts   the statements that write and read the rows of `../mapping`: `writeRows`,
 *              `insertRows`, `readStoredRows`, `applyChanges`, the chain lock, the three RBAC
 *              tables, the row counts.
 *
 * Imported by the seed, the reset routine, the bulk fixture and the engine host, always through
 * this index. It imports the pure mapping and the typed schema, and nothing of its callers.
 */
export {
  ALL_TABLES,
  StoreError,
  applyChanges,
  countAllTables,
  insertRows,
  lockAuditChain,
  readRbacRows,
  readStoredRows,
  writeRbacRows,
  writeRows,
  type ApplyOptions,
  type ChainHead,
  type ReadOptions,
  type RowExecutor,
  type StoreErrorCode,
} from './store';
