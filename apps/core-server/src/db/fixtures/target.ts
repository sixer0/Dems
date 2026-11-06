/**
 * Where the bulk fixture may be loaded, and how it fails (plan row W25; database contract BF-1,
 * TI-13, TI-17).
 *
 * THE NAME GUARD. The fixture is loaded into a test database of the helper and into nothing
 * else: a name that matches `^dems_test_[a-z0-9_]+$` (the pattern of the helper's own guard,
 * TI-3) and fits PostgreSQL's 63 bytes. `dems_demo`, a lane database, the staging copy of one,
 * the maintenance database and the templates of PostgreSQL do not match, and are named here once
 * more so that the refusal does not depend on the pattern alone.
 *
 * The guard decides on the NAME, before a connection is opened and before a statement is sent:
 * the loader reads the name its pool is configured for and refuses there. Only afterwards does
 * it ask the session which database it is on, and that name must be the same one.
 *
 * A message of this file never echoes the refused value (it is input, and may be anything) and
 * never holds a credential or a value of a row.
 */
import { PROJECT_DATABASES, TEST_DATABASE_PATTERN } from '../commands/database-names';

export type BulkFixtureErrorCode =
  | 'TARGET_REFUSED'
  | 'OPTION_INVALID'
  | 'NOT_MIGRATED'
  | 'NOT_SEEDED'
  | 'BASE_UNEXPECTED'
  | 'BUILD_INVALID'
  | 'WRITE_FAILED'
  | 'VERIFY_FAILED';

/** A refused or failed load. `message` is safe to print. */
export class BulkFixtureError extends Error {
  readonly code: BulkFixtureErrorCode;

  constructor(code: BulkFixtureErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'BulkFixtureError';
    this.code = code;
  }
}

/** PostgreSQL cuts an identifier at 63 bytes (PG-13). */
const MAX_IDENTIFIER_BYTES = 63;
/** The suffixes the reset routine gives the copies it builds beside a project database (R-4, R-7). */
const PROJECT_COPY_SUFFIXES = ['_next', '_prev'] as const;
/** Databases of the cluster that are never a target, whatever a pattern says. */
const NEVER_A_TARGET: readonly string[] = [
  ...PROJECT_DATABASES,
  ...PROJECT_DATABASES.flatMap((name) => PROJECT_COPY_SUFFIXES.map((suffix) => `${name}${suffix}`)),
  'postgres',
  'template0',
  'template1',
];

const REFUSAL =
  'refused before any connection: the bulk fixture is loaded only into a test database of the helper ' +
  '(its name starts with dems_test_). It is never loaded into dems_demo, a lane database or the maintenance database.';

/** True when `name` is a test database of the helper. */
export function isBulkFixtureTarget(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    !NEVER_A_TARGET.includes(name) &&
    TEST_DATABASE_PATTERN.test(name) &&
    Buffer.byteLength(name, 'utf8') <= MAX_IDENTIFIER_BYTES
  );
}

/** Returns `name`, or throws `TARGET_REFUSED`. Pure: it looks at the name and at nothing else. */
export function assertBulkFixtureTarget(name: unknown): string {
  if (!isBulkFixtureTarget(name)) throw new BulkFixtureError('TARGET_REFUSED', REFUSAL);
  return name;
}

/**
 * The database a pool is configured for, read from its options without connecting. `undefined`
 * when the pool does not state one (a pool built from a connection text, or a stand-in): such a
 * pool is refused like any other name that is not a test database.
 */
export function configuredDatabase(pool: unknown): unknown {
  if (typeof pool !== 'object' || pool === null || !('options' in pool)) return undefined;
  const options: unknown = pool.options;
  if (typeof options !== 'object' || options === null || !('database' in options)) return undefined;
  return options.database;
}
