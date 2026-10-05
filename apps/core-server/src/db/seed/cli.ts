/**
 * `db:seed`: loads the shared dataset into a freshly migrated project database, as the owner
 * role (database contract §8.4, §9; plan row W20; decision D27 names this entry file).
 *
 *   npm run db:seed -w @dems/core-server -- --database <name>
 *
 * The dataset is built AS OF THE SERVER CLOCK: the command reads the clock once and passes that
 * instant down (DR-1). Session, evidence and case identifiers carry that WIB date; the demo
 * evidence packages stay frozen and join on any day.
 *
 * Exit codes, as for the other database commands: 0 seeded; 1 not seeded (the database does not
 * exist, is not migrated, or IS ALREADY SEEDED: a repeat is a reset, `db:reset`); 2 a wrong
 * call (usage, a refused database name). A refusal writes nothing.
 *
 * On `dems_demo` the command is run under the migrate lock, like `db:migrate`, so that it
 * cannot overlap a migration or a reset of that database (P16):
 *
 *   /usr/bin/lockf -k .locks/db-migrate.lock npm run db:seed -w @dems/core-server -- --database dems_demo
 *
 * It prints the row count of every table and the audit head. It prints no credential: the demo
 * password never leaves the hash function, and a hash record is never printed.
 */
import { isEntryPoint, main, readDatabaseFacts, runCommand, type CommandOptions } from '../commands/cli';
import { MIGRATE_LOCK_DATABASE, MIGRATE_LOCK_HINT, TEST_DATABASE_PATTERN } from '../commands/database-names';
import { DbCommandError, OWNER_ROLE } from '../commands/owner-connection';
import { SeedError, seedDatabase, type SeedDependencies, type SeedReport } from './seed';

const COMMAND = 'db:seed';

export interface SeedCommandOptions extends CommandOptions {
  /**
   * The server clock: read ONCE, at the start of the seed. Default: the real clock. A test
   * passes a clock that returns a fixed instant.
   */
  readonly clock?: () => number;
  /** Tests only: another password hasher. */
  readonly dependencies?: SeedDependencies;
}

const iso = (ms: number): string => `${new Date(ms).toISOString()} (${ms})`;
const round = (ms: number): number => Math.round(ms);

/** The lines `db:seed` prints for a finished seed, without the command prefix on the table lines. */
export function formatSeedReport(report: SeedReport): string[] {
  const filled = Object.entries(report.counts).filter(([, rows]) => rows > 0);
  const total = filled.reduce((sum, [, rows]) => sum + rows, 0);
  const lines = [
    `${COMMAND}: ${report.database} on PostgreSQL ${report.serverVersion} as ${report.role}`,
    `${COMMAND}: dataset as of ${iso(report.now)}; scenario ${report.scenario}; seed ${report.seed}; epoch ${report.epoch}`,
    `${COMMAND}: seeded in ${round(report.totalMs)} ms (dataset and hashes ${round(report.prepareMs)} ms, transaction ${round(report.writeMs)} ms); the database now holds ${total} row(s) in ${filled.length} of ${Object.keys(report.counts).length} table(s)`,
    `row counts       ${Object.keys(report.counts).length} table(s)`,
  ];
  for (const [table, rows] of Object.entries(report.counts)) lines.push(`  ${table.padEnd(24)} ${rows}`);
  lines.push(`audit head       seq ${report.auditHead.seq}; hash ${report.auditHead.hash.slice(0, 16)}...`);
  return lines;
}

export async function runSeed(argv: readonly string[], options: SeedCommandOptions = {}): Promise<number> {
  return runCommand(COMMAND, argv, options, async ({ io, target, withPool, withMaintenancePool }) => {
    const facts = await withMaintenancePool((pool) => readDatabaseFacts(pool, target));
    if (facts === null) {
      throw new DbCommandError(
        'DATABASE_MISSING',
        `The database ${target} does not exist. Create and migrate it first: npm run db:create -w @dems/core-server -- --database ${target}`,
      );
    }
    if (facts.owner !== OWNER_ROLE) {
      throw new DbCommandError(
        'DATABASE_NOT_OURS',
        `The database ${target} belongs to ${facts.owner}, not to ${OWNER_ROLE}. The seed writes a database of the owner role only.`,
      );
    }
    if (target === MIGRATE_LOCK_DATABASE) {
      io.out(`${COMMAND}: ${target} is seeded under the migrate lock: this command must be run as "${MIGRATE_LOCK_HINT} npm run ${COMMAND} ...".`);
    }

    return withPool(target, async (pool) => {
      // DR-1: the clock is read once, here, and the instant is passed down.
      const now = (options.clock ?? Date.now)();
      let report: SeedReport;
      try {
        report = await seedDatabase(
          pool,
          // A test database is reachable only when a test set `allowTestDatabase` (the name guard
          // of the command refused it otherwise); the seed then insists on a test name (TI-13).
          { now, target: TEST_DATABASE_PATTERN.test(target) ? 'test' : 'project' },
          options.dependencies,
        );
      } catch (error) {
        if (!(error instanceof SeedError)) throw error;
        io.err(`${COMMAND}: ${error.message}`);
        if (error.code === 'ALREADY_SEEDED') {
          io.err(`${COMMAND}: to rebuild the dataset: npm run db:reset -w @dems/core-server -- --database ${target}`);
        }
        io.err(`${COMMAND}: NOT SEEDED (${error.code}).`);
        return 1;
      }
      for (const line of formatSeedReport(report)) io.out(line);
      io.out(`${COMMAND}: OK: ${target} is seeded. State: npm run db:status -w @dems/core-server -- --database ${target}`);
      return 0;
    });
  });
}

if (isEntryPoint(import.meta.url)) await main(runSeed);
