/**
 * The seed program (plan row W20).
 *
 *   seed.ts      `seedDatabase` (the whole seed on an owner pool), `prepareSeed` and `writeSeed`
 *                (its two halves, for the reset routine, which seeds inside its own transaction);
 *   dataset.ts   the shared dataset as of one instant;
 *   cli.ts       `db:seed` (not re-exported here: it is an entry file).
 *
 * The database side of the mapping (`writeRows`, `readStoredRows`, `applyChanges`, the chain
 * lock) lives in `../store` (review finding CPB1-11). Both back-compat shims that round B1 left
 * for one round are gone as of fix round B2b item 9: `store.ts` of this folder and the re-export
 * of the store's names below. Import the store from `src/db/store`.
 */
export { DatasetOptionError, buildSeedState, resolveDatasetOptions, type DatasetOptions, type ResolvedDatasetOptions } from './dataset';
export {
  STAGING_SUFFIX,
  SeedError,
  assertSeedTarget,
  prepareSeed,
  seedDatabase,
  writeSeed,
  type PreparedSeed,
  type SeedDatabaseOptions,
  type SeedDependencies,
  type SeedErrorCode,
  type SeedOptions,
  type SeedReport,
  type SeedTarget,
} from './seed';
