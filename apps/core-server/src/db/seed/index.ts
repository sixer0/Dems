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
  STT_CONFIG_SEED_DEFAULT,
  SeedError,
  assertSeedTarget,
  prepareSeed,
  seedDatabase,
  sttConfigSeedRow,
  writeSeed,
  type PreparedSeed,
  type SeedDatabaseOptions,
  type SeedDependencies,
  type SeedErrorCode,
  type SeedOptions,
  type SeedReport,
  type SeedTarget,
} from './seed';
export {
  SEED_DEMO_NOT_ASKED,
  SEED_DEMO_NO_PAIR,
  seedDemoItemsOf,
  seedDemoSealProblem,
  seedDemoSourceRows,
  withSeedSealedPackages,
  type SeedDemoContext,
  type SeedDemoItem,
  type SeedDemoOutcome,
  type SeedDemoPackages,
  type SeedDemoPlacement,
  type SeedDemoReport,
  type SeedDemoSeal,
} from './demo-packages';
export { DEMO_HELPER_TIMEOUT_MS, SeedHelperProblem, runSeedHelper, seedHelperProblemOf } from './demo-helper';
export { demoPackagesOfEnvironment, seedDemoLines, type DemoCoreEnvironment } from './demo-core';
