/**
 * `db:migrate`: applies the pending migrations to a project database, as the owner role
 * (database contract §8.4; MG-9, MG-10; spec §8.6).
 *
 *   npm run db:migrate -w @dems/core-server -- --database <name>
 *
 * It prints the schema version before and after. A second run applies nothing (AC-B-01). The
 * running server never applies a migration: it connects as the runtime role and only checks
 * the schema version (boot check B-3).
 *
 * On `dems_demo` the command is run under the migrate lock, so that it cannot overlap a reset
 * of the same database (P16, MG-9):
 *
 *   /usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -w @dems/core-server -- --database dems_demo
 *
 * The lock is the caller's: this command starts no child process. Lane and test databases
 * migrate freely.
 *
 * The command refuses a database whose applied migrations do not match the files (an applied
 * file that was edited, a file the migrator would skip): see `migrations.ts`.
 */
import { isEntryPoint, main, readDatabaseFacts, runCommand, type CommandOptions } from './cli';
import { MIGRATE_LOCK_DATABASE, MIGRATE_LOCK_HINT } from './database-names';
import { applyMigrations, type SchemaVersion } from './migrations';
import { DbCommandError, OWNER_ROLE, assertProjectRoles } from './owner-connection';

const COMMAND = 'db:migrate';

function shown(version: SchemaVersion | null): string {
  return version === null ? 'none (not migrated)' : `${version.schemaVersion} (${version.contractRevision})`;
}

export async function runMigrate(argv: readonly string[], options: CommandOptions = {}): Promise<number> {
  return runCommand(COMMAND, argv, options, async ({ io, target, withPool, withMaintenancePool }) => {
    await withMaintenancePool(async (pool) => {
      await assertProjectRoles(pool);
      const facts = await readDatabaseFacts(pool, target);
      if (facts === null) {
        throw new DbCommandError(
          'DATABASE_MISSING',
          `The database ${target} does not exist. Create it first: npm run db:create -w @dems/core-server -- --database ${target}`,
        );
      }
      if (facts.owner !== OWNER_ROLE) {
        throw new DbCommandError(
          'DATABASE_NOT_OURS',
          `The database ${target} belongs to ${facts.owner}, not to ${OWNER_ROLE}. Migrations are applied to a database of the owner role only.`,
        );
      }
    });

    if (target === MIGRATE_LOCK_DATABASE) {
      io.out(`${COMMAND}: ${target} is migrated under the migrate lock: this command must be run as "${MIGRATE_LOCK_HINT} npm run ${COMMAND} ...".`);
    }

    return withPool(target, async (pool, session) => {
      const result = await applyMigrations(pool, options.migrationsFolder);
      io.out(`${COMMAND}: ${target} on PostgreSQL ${session.serverVersion} as ${session.role}`);
      io.out(`${COMMAND}: schema version before: ${shown(result.versionBefore)}`);
      io.out(
        result.applied.length === 0
          ? `${COMMAND}: no pending migration; nothing was applied.`
          : `${COMMAND}: applied ${result.applied.length} migration(s): ${result.applied.join(', ')}`,
      );
      io.out(`${COMMAND}: schema version after: ${shown(result.versionAfter)}`);
      return 0;
    });
  });
}

if (isEntryPoint(import.meta.url)) await main(runMigrate);
