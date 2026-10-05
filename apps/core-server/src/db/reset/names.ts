/**
 * Which databases the reset routine may touch, and the text of its database-level statements
 * (plan row W29; database contract §8.4, §8.5; PG-19).
 *
 * The routine can destroy data by design, so this file is its first guard. Everything here is
 * pure: no connection, no file, no clock.
 *
 * WHAT A RESET TOUCHES. Exactly three names, all derived from the ONE name it was asked for:
 *
 *   <t>        the target: one of the four project databases of `database-names.ts`
 *   <t>_next   the staging database the routine builds beside it
 *   <t>_prev   the previous database, between the swap and its drop
 *
 * A database name cannot be a bind parameter (PG-19), so it is part of statement text. The only
 * values that reach statement text are a `TargetDatabase` (it matched the closed list) and a
 * `DisposableDatabase` (the target's name with one of the two suffixes), and both are checked
 * against `[a-z][a-z0-9_]*` again where they are quoted.
 *
 * THE DROP CAN NAME ONLY A DISPOSABLE DATABASE. `dropStatement` takes a `DisposableDatabase`,
 * which only `guardResetTarget` produces, and only as `<t>_next` and `<t>_prev`. There is no way
 * to build `DROP DATABASE <t>` through this file: the live name is removed only by renaming it
 * to `<t>_prev` in the swap, after the new database is complete.
 *
 * Refused before anything is read or opened: `postgres`, `template0`, `template1`, every name
 * outside the closed list, and a name that is itself a staging or previous copy.
 *
 * Test seam. A database test proves the routine on a database of its own test run, never on a
 * project database (TI-17). With `testRunPrefix` set to the prefix of that run, a per-file
 * database of exactly that run is accepted as well; a template, and a database of any other run,
 * stay refused. The command-line entry never sets it, and no argument or environment variable
 * reaches it.
 */
import { PROJECT_DATABASES, TEST_DATABASE_PATTERN, guardTargetDatabase, type TargetDatabase } from '../commands/database-names';
import { DbCommandError, OWNER_ROLE } from '../commands/owner-connection';
import { ResetError } from './errors';

/** The advisory lock class of a reset (02_plan §3.4): `pg_try_advisory_lock(442001, <slot>)`. */
export const RESET_LOCK_CLASS = 442001;
/** `<t>_next`: the staging database (the seed's own name guard knows the same suffix). */
export const STAGING_SUFFIX = '_next';
/** `<t>_prev`: the previous database, from the swap until it is dropped. */
export const PREVIOUS_SUFFIX = '_prev';
/** PostgreSQL cuts an identifier at 63 bytes (PG-13). */
export const MAX_IDENTIFIER_BYTES = 63;
/** Never a target, whatever the list says: the maintenance database and PostgreSQL's templates. */
export const PROTECTED_DATABASES = ['postgres', 'template0', 'template1'] as const;

/** The empty template of PostgreSQL, the encoding and the locale of every project database (R-4). */
const EMPTY_TEMPLATE = 'template0';
const ENCODING = 'UTF8';
const LOCALE = 'C';

const IDENTIFIER = /^[a-z][a-z0-9_]*$/;
/** The prefix of one run of the test helper: `dems_test_<label>_<stamp>_` (TI-2). */
const TEST_RUN_PREFIX = /^dems_test_(?:local|step_[a-z0-9]{1,12})_[0-9a-z]{8}_$/;
/** What follows the prefix for a per-file database. A template is `tpl_...` and never matches. */
const TEST_CLONE_REST = /^f[0-9]{2}_[a-z0-9_]+$/;
/** Slots 0 to 3 are the four project databases; a test database gets a slot at or above this. */
const TEST_SLOT_BASE = 1_000;
const TEST_SLOT_SPACE = 2_000_000_000;

declare const disposable: unique symbol;
/** `<t>_next` or `<t>_prev` of a guarded target: the only names the routine creates and drops. */
export type DisposableDatabase = string & { readonly [disposable]: true };

export interface ResetTarget {
  /** The database to reset: the one name the caller gave. */
  readonly name: TargetDatabase;
  readonly staging: DisposableDatabase;
  readonly previous: DisposableDatabase;
  /** The second key of the advisory lock: 0 for `dems_demo`, 1 to 3 for the lanes. */
  readonly lockSlot: number;
  readonly kind: 'project' | 'test';
}

export interface ResetGuardOptions {
  /** Tests only: the prefix of the caller's own test run. Never set by the command-line entry. */
  readonly testRunPrefix?: string | undefined;
}

function refused(detail: string): ResetError {
  // The refused value is not echoed: it is input, and it may be anything.
  return new ResetError(
    'RESET_TARGET_REFUSED',
    'R-0',
    `refused before any connection: ${detail} A reset takes one of ${PROJECT_DATABASES.join(', ')}.`,
  );
}

/** FNV-1a over the name: a stable slot for a test database. */
function testSlot(name: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return TEST_SLOT_BASE + (hash % TEST_SLOT_SPACE);
}

/**
 * The one way to a `ResetTarget`. Throws `RESET_TARGET_REFUSED` (step R-0) for every name the
 * routine must not touch; nothing has been read or opened at that point.
 */
export function guardResetTarget(name: unknown, options: ResetGuardOptions = {}): ResetTarget {
  if (typeof name !== 'string' || name === '') throw refused('the database name is missing.');
  if ((PROTECTED_DATABASES as readonly string[]).includes(name)) {
    throw refused('the maintenance database and the templates of PostgreSQL are never reset.');
  }
  if (name.endsWith(STAGING_SUFFIX) || name.endsWith(PREVIOUS_SUFFIX)) {
    throw refused('a staging or previous copy of a database is not a target; name the database itself.');
  }

  const projectIndex = (PROJECT_DATABASES as readonly string[]).indexOf(name);
  let kind: ResetTarget['kind'];
  let lockSlot: number;
  if (projectIndex >= 0) {
    kind = 'project';
    lockSlot = projectIndex;
  } else {
    const prefix = options.testRunPrefix;
    const ownTestClone =
      prefix !== undefined &&
      TEST_RUN_PREFIX.test(prefix) &&
      TEST_DATABASE_PATTERN.test(name) &&
      name.startsWith(prefix) &&
      TEST_CLONE_REST.test(name.slice(prefix.length));
    if (!ownTestClone) throw refused('the database name is not a project database.');
    kind = 'test';
    lockSlot = testSlot(name);
  }

  if (!IDENTIFIER.test(name) || Buffer.byteLength(`${name}${STAGING_SUFFIX}`, 'utf8') > MAX_IDENTIFIER_BYTES) {
    throw refused(`the name with the suffix ${STAGING_SUFFIX} does not fit ${MAX_IDENTIFIER_BYTES} bytes.`);
  }

  let guarded: TargetDatabase;
  try {
    // The closed list of the database commands is the authority; a test name passes it only
    // after the checks above tied it to the caller's own run.
    guarded = guardTargetDatabase(name, { allowTestDatabase: kind === 'test' });
  } catch (error) {
    if (error instanceof DbCommandError) throw refused('the database name is not a project database.');
    throw error;
  }
  return Object.freeze({
    name: guarded,
    staging: `${guarded}${STAGING_SUFFIX}` as DisposableDatabase,
    previous: `${guarded}${PREVIOUS_SUFFIX}` as DisposableDatabase,
    lockSlot,
    kind,
  });
}

/** A double-quoted identifier. The name is checked again here, immediately before it becomes text. */
export function quoteDatabase(name: TargetDatabase | DisposableDatabase): string {
  if (!IDENTIFIER.test(name) || Buffer.byteLength(name, 'utf8') > MAX_IDENTIFIER_BYTES) {
    throw new ResetError('RESET_TARGET_REFUSED', 'R-0', 'refused: a database name of the reset is not a plain identifier.');
  }
  return `"${name}"`;
}

/** R-4: the staging database, empty, owned by the owner role. */
export function createStagingStatement(target: ResetTarget): string {
  return `CREATE DATABASE ${quoteDatabase(target.staging)} OWNER ${OWNER_ROLE} TEMPLATE ${EMPTY_TEMPLATE} ENCODING '${ENCODING}' LOCALE '${LOCALE}'`;
}

/**
 * R-7: the statements between `BEGIN` and `COMMIT`. With a live target: the target becomes
 * `<t>_prev`, then the staging database becomes `<t>`. For a first build only the second rename.
 */
export function swapStatements(target: ResetTarget, targetExists: boolean): string[] {
  const takeOver = `ALTER DATABASE ${quoteDatabase(target.staging)} RENAME TO ${quoteDatabase(target.name)}`;
  return targetExists
    ? [`ALTER DATABASE ${quoteDatabase(target.name)} RENAME TO ${quoteDatabase(target.previous)}`, takeOver]
    : [takeOver];
}

/** R-2: the previous database gets its name back when the target is missing. */
export function recoverStatement(target: ResetTarget): string {
  return `ALTER DATABASE ${quoteDatabase(target.previous)} RENAME TO ${quoteDatabase(target.name)}`;
}

/**
 * R-2, R-5 (on failure) and R-8: removes a staging or previous database. The parameter type is
 * the guard: a target name is not accepted, so the live name is never dropped. The statement
 * ends nobody's session: it has no forced form. `ifExists` is for the clean-up after a failure,
 * where the staging database may not have been created.
 */
export function dropStatement(name: DisposableDatabase, options: { readonly ifExists?: boolean } = {}): string {
  if (!name.endsWith(STAGING_SUFFIX) && !name.endsWith(PREVIOUS_SUFFIX)) {
    throw new ResetError('RESET_TARGET_REFUSED', 'R-0', 'refused: only a staging or previous database is dropped.');
  }
  return `DROP DATABASE ${options.ifExists === true ? 'IF EXISTS ' : ''}${quoteDatabase(name)}`;
}
