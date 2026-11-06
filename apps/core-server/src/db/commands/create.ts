/**
 * `db:create`: creates a project database when it is absent (database contract §8.4; OW-1, OW-8).
 *
 *   npm run db:create -w @dems/core-server -- --database <name>
 *
 * It runs as `dems_owner` and creates NO role: both project roles are created at provisioning.
 * When one of them is missing the command stops with a message that names `npm run pg:init`.
 *
 * The statement is `CREATE DATABASE <name> OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8'
 * LOCALE 'C'`. A utility statement takes no bind parameter (PG-19), so the name is part of the
 * statement text: it is a `TargetDatabase`, which exists only after the name matched the closed
 * list of `database-names.ts`.
 *
 * A database that already exists is left as it is and reported; one that exists with another
 * owner, encoding or locale is a defect the command names and does not repair.
 */
import {
  isEntryPoint,
  main,
  readDatabaseFacts,
  runCommand,
  type CommandOptions,
  type DatabaseFacts,
} from './cli';
import type { TargetDatabase } from './database-names';
import { DbCommandError, OWNER_ROLE, assertProjectRoles } from './owner-connection';
import { DATABASE_ENCODING as ENCODING, DATABASE_LOCALE as LOCALE, createEmptyDatabaseStatement } from './statements';

const COMMAND = 'db:create';

/** The one statement of this command. `target` passed the name guard; the rest is constant text (`statements.ts`). */
export function createDatabaseStatement(target: TargetDatabase): string {
  return createEmptyDatabaseStatement(target, OWNER_ROLE);
}

function describe(facts: DatabaseFacts): string {
  return `owner ${facts.owner}, encoding ${facts.encoding}, locale ${facts.collate}`;
}

function assertExpectedShape(target: TargetDatabase, facts: DatabaseFacts): void {
  if (facts.owner !== OWNER_ROLE || facts.encoding !== ENCODING || facts.collate !== LOCALE || facts.ctype !== LOCALE) {
    throw new DbCommandError(
      'DATABASE_NOT_OURS',
      `The database ${target} exists with ${describe(facts)}; expected owner ${OWNER_ROLE}, encoding ${ENCODING}, locale ${LOCALE}. It was not created by this command and is left untouched.`,
    );
  }
}

export async function runCreate(argv: readonly string[], options: CommandOptions = {}): Promise<number> {
  return runCommand(COMMAND, argv, options, async ({ io, target, withMaintenancePool }) =>
    withMaintenancePool(async (pool, session) => {
      await assertProjectRoles(pool);
      const existing = await readDatabaseFacts(pool, target);
      if (existing !== null) {
        assertExpectedShape(target, existing);
        io.out(`${COMMAND}: ${target} already exists (${describe(existing)}); nothing to do.`);
        return 0;
      }
      await pool.query(createDatabaseStatement(target));
      const created = await readDatabaseFacts(pool, target);
      if (created === null) throw new DbCommandError('DATABASE_MISSING', `The database ${target} was not created.`);
      assertExpectedShape(target, created);
      io.out(`${COMMAND}: created ${target} (${describe(created)}) on PostgreSQL ${session.serverVersion} as ${session.role}.`);
      io.out(`${COMMAND}: next: npm run db:migrate -w @dems/core-server -- --database ${target}`);
      return 0;
    }),
  );
}

if (isEntryPoint(import.meta.url)) await main(runCreate);
