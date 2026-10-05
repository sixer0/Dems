/**
 * The bulk fixture for volume tests (plan row W25; database contract §11): paging beyond one
 * page and beyond the engine's rings, index use among many rows, chain verification over
 * thousands of rows.
 *
 *   minimums.ts     the contract's table of minimum row counts, as data;
 *   rng.ts          the seeded generator (the shared mulberry32) and the fake secret hashes;
 *   target.ts       the name guard (test databases only) and the error type;
 *   world.ts        the clock, the base, the counters, the list of what happened;
 *   identity.ts     operators, pairing codes, devices, tokens, auth sessions;
 *   recordings.ts   sessions, evidence, tracks, custody; the variant with a recording session;
 *   operations.ts   alerts, health snapshots, refusals, exports, the lineage, the padding;
 *   rows.ts         the shape of the fixture: the rows by table, and the table names;
 *   build.ts        `buildBulkFixture`: the rows, pure and deterministic;
 *   validate.ts     the schema's constraints, checked before a statement is sent;
 *   load.ts         `loadBulkFixture`: one transaction on an owner pool of a test database;
 *   report.ts       the counts against the minimums, as data and as lines.
 *
 * A test asks for the fixture through the helper: `useTestDatabase({ template: 'bulk' })`
 * (`__tests__/template-hook.bulk.ts`). There is no command and no script: the fixture is never
 * loaded into `dems_demo` or a lane database.
 */
export { BULK_MINIMUMS, BULK_MIX, compareWithMinimums, minimumOf, type MinimumComparison, type TableMinimum } from './minimums';
export { BULK_FIXTURE_SEED, FIXTURE_TAG, fakeSecretHash, fakeSecretText, fixtureRng, type FakeSecretKind, type FixtureRng } from './rng';
export { BulkFixtureError, assertBulkFixtureTarget, configuredDatabase, isBulkFixtureTarget, type BulkFixtureErrorCode } from './target';
export { UNICODE_SAMPLE, type BulkBase, type BulkFixtureOptions } from './world';
export { FIXTURE_TABLES, buildBulkFixture, fixtureDigest, type BulkFixture, type BulkFixtureRows, type BulkFixtureUpdates } from './build';
export { validateBulkFixture } from './validate';
export { loadBulkFixture, vacuumFixtureTables, type LoadBulkFixtureOptions } from './load';
export { formatBulkFixtureReport, minimumReport, type BulkFixtureReport } from './report';
