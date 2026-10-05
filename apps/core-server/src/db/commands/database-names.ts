/**
 * The database names a `db:*` command accepts (database contract §8.4).
 *
 * A command accepts only `dems_demo` and the three lane databases; any other name is refused
 * BEFORE a connection is opened. A database name cannot be a bind parameter (PG-19): it is placed
 * in statement text only after it has matched this closed list. This is the one place where the
 * commands build statement text from a value, so the statement builders take a `TargetDatabase`,
 * which only `guardTargetDatabase` produces.
 *
 * Test seam. A database test proves the commands on a database of its own run, never on
 * `dems_demo` (TI-17). With `allowTestDatabase: true` a name that matches the helper's pattern
 * (TI-3) is accepted as well. The command-line entry points never set that option, and no
 * argument or environment variable reaches it.
 */
import { DbCommandError } from './owner-connection';

/** The main instance's database and the three lane databases. */
export const PROJECT_DATABASES = ['dems_demo', 'dems_lane_1', 'dems_lane_2', 'dems_lane_3'] as const;
export type ProjectDatabase = (typeof PROJECT_DATABASES)[number];

/** The pattern of the test helper's guard (TI-3). */
export const TEST_DATABASE_PATTERN = /^dems_test_[a-z0-9_]+$/;
/** PostgreSQL cuts an identifier at 63 bytes (PG-13). */
const MAX_IDENTIFIER_BYTES = 63;

declare const guarded: unique symbol;
/** A database name that passed the guard. Statement text is built from nothing else. */
export type TargetDatabase = string & { readonly [guarded]: true };

export interface GuardOptions {
  /** Accept a `dems_test_*` name as well. Tests only; never set by a command-line entry point. */
  readonly allowTestDatabase?: boolean | undefined;
}

export function guardTargetDatabase(name: unknown, options: GuardOptions = {}): TargetDatabase {
  const allowed = PROJECT_DATABASES.join(', ');
  if (typeof name !== 'string' || name === '') {
    throw new DbCommandError('DATABASE_NAME_REFUSED', `refused before any connection: --database needs one of ${allowed}.`);
  }
  if ((PROJECT_DATABASES as readonly string[]).includes(name)) return name as TargetDatabase;
  if (
    options.allowTestDatabase === true &&
    TEST_DATABASE_PATTERN.test(name) &&
    Buffer.byteLength(name, 'utf8') <= MAX_IDENTIFIER_BYTES
  ) {
    return name as TargetDatabase;
  }
  // The refused value is not echoed: it is input, and it may be anything.
  throw new DbCommandError(
    'DATABASE_NAME_REFUSED',
    `refused before any connection: the database name is not one of ${allowed}. Test databases are reachable only through the test helper.`,
  );
}

/** `dems_demo` is the one database whose migration runs under the migrate lock (P16, MG-9). */
export const MIGRATE_LOCK_DATABASE: ProjectDatabase = 'dems_demo';
export const MIGRATE_LOCK_HINT = '/usr/bin/lockf -k .locks/db-migrate.lock';
