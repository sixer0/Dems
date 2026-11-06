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
 * WITH `--factory` the same command seeds a unit's database instead (PT GSP, ruling of 30 Oct
 * 2026): the RBAC vocabulary, the two vendor identities of `FACTORY_OPERATORS` with NO credential
 * row, the configuration singletons of THIS unit (its name comes from `DEMS_INSTALLATION_DEVICE_ID`
 * and `DEMS_INSTALLATION_NAME`, its certificate fingerprint from `DEMS_DEVICE_CERT_FINGERPRINT`) and
 * nothing else — no subject, no example session, no evidence row, no export, no pairing code, no
 * example audit row. See `factory.ts` for what that mode writes and why. Without the flag the
 * command is the demonstration seed exactly as before: the flag is what a factory image build adds.
 *
 * Exit codes, as for the other database commands: 0 seeded; 1 not seeded (the database does not
 * exist, is not migrated, IS ALREADY SEEDED — a repeat is a reset, `db:reset` — or, in factory mode,
 * the environment names no unit); 2 a wrong call (usage, a refused database name). A refusal writes
 * nothing.
 *
 * On `dems_demo` the command is run under the migrate lock, like `db:migrate`, so that it
 * cannot overlap a migration or a reset of that database (P16):
 *
 *   /usr/bin/lockf -k .locks/db-migrate.lock npm run db:seed -w @dems/core-server -- --database dems_demo
 *
 * It prints the row count of every table and the audit head. It prints no credential: the demo
 * password never leaves the hash function, and a hash record is never printed. In factory mode no
 * password is derived at all, because a factory account is born without a credential row.
 */
import type { FactoryIdentityInput } from '@dems/shared/sim';
import { isEntryPoint, main, readDatabaseFacts, runCommand, usage, type CommandOptions } from '../commands/cli';
import { MIGRATE_LOCK_DATABASE, MIGRATE_LOCK_HINT, TEST_DATABASE_PATTERN } from '../commands/database-names';
import { DbCommandError, OWNER_ROLE } from '../commands/owner-connection';
import { demoPackagesOfEnvironment, seedDemoLines } from './demo-core';
import type { SeedDemoPackages } from './demo-packages';
import { FactorySeedError, factoryIdentityOfEnvironment, seedFactoryDatabase } from './factory';
import { SeedError, seedDatabase, type SeedDependencies, type SeedReport } from './seed';

const COMMAND = 'db:seed';

/** The mode flag of this command. Absent: the demonstration dataset; present: a factory database. */
export const FACTORY_FLAG = '--factory';

export interface SeedCommandOptions extends CommandOptions {
  /**
   * The server clock: read ONCE, at the start of the seed. Default: the real clock. A test
   * passes a clock that returns a fixed instant.
   */
  readonly clock?: () => number;
  /** Tests only: another password hasher. */
  readonly dependencies?: SeedDependencies;
  /**
   * The v2 demo packages (pass E3). Default: the port of the Core this command's ENVIRONMENT
   * describes (`demoPackagesOfEnvironment`: a development-capture Core gets them, any other Core a
   * named skip). `null`: none is asked for. A test passes its own port.
   * Ignored by `--factory`: a factory seed seals no demonstration package.
   */
  readonly demoPackages?: SeedDemoPackages | null;
  /** The environment of the Core this database is seeded for. Default: the process environment. */
  readonly environment?: Readonly<Record<string, string | undefined>>;
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

/** The line `--factory` says about its mode, before the shared report. It names no credential. */
export function formatFactoryModeLine(): string {
  return `${COMMAND}: FACTORY mode - the two vendor identities with no credential row, this unit's own name, and no row of the demonstration dataset.`;
}

export async function runSeed(argv: readonly string[], options: SeedCommandOptions = {}): Promise<number> {
  // The flag is taken out before the argument parser sees the list: `parseDatabaseArgument` refuses
  // every token but `--database`, and it keeps refusing them — a second `--factory`, a `--factory=`
  // with a value, and every option this command does not know all reach that refusal (exit 2).
  const rest: string[] = [];
  let factory = false;
  for (const argument of argv) {
    if (argument === FACTORY_FLAG && !factory) {
      factory = true;
      continue;
    }
    rest.push(argument);
  }
  return runCommand(COMMAND, rest, options, async ({ io, target, withPool, withMaintenancePool }) => {
    // The unit's own name is asked FIRST: a factory seed that does not know which unit it writes
    // refuses before it reads the owner file or opens a connection.
    let identity: FactoryIdentityInput | null = null;
    if (factory) {
      io.out(formatFactoryModeLine());
      const answer = factoryIdentityOfEnvironment(options.environment ?? process.env);
      if (answer.ok !== true) {
        const keys = answer.problem.keys.join(', ');
        io.err(`${COMMAND}: ${answer.problem.code} - the factory seed needs the unit's own identity in ${keys}. Nothing was written.`);
        io.err(`${COMMAND}: NOT SEEDED (${answer.problem.code}).`);
        return 1;
      }
      identity = answer.identity;
    }
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
    // B16 erratum (iii) (W90 F-6; dbc-3 §H row iii): same wording fix as `db:migrate`, which the
    // original finding named together with this command. The rule stands (P16: the caller holds the
    // migrate lock over a dems_demo seed); the line stops reading as a warning on a command that
    // exits 0 and cannot see the lock.
    if (target === MIGRATE_LOCK_DATABASE) {
      io.out(
        `${COMMAND}: note - ${target} is shared with db:reset, so its caller runs this command under ${MIGRATE_LOCK_HINT}. This command takes no lock of its own and never checks for one; it prints this note on every ${target} run.`,
      );
    }

    return withPool(target, async (pool) => {
      // DR-1: the clock is read once, here, and the instant is passed down.
      const now = (options.clock ?? Date.now)();
      let report: SeedReport;
      if (factory && identity !== null) {
        try {
          report = await seedFactoryDatabase(pool, {
            // A test database is reachable only when a test set `allowTestDatabase` (the name guard
            // of the command refused it otherwise); the seed then insists on a test name (TI-13).
            target: TEST_DATABASE_PATTERN.test(target) ? 'test' : 'project',
            now,
            identity,
          });
        } catch (error) {
          if (!(error instanceof FactorySeedError)) throw error;
          io.err(`${COMMAND}: ${error.message}`);
          if (error.code === 'ALREADY_SEEDED') {
            io.err(`${COMMAND}: to rebuild the database: npm run db:reset -w @dems/core-server -- --database ${target}`);
          }
          io.err(`${COMMAND}: NOT SEEDED (${error.code}).`);
          return 1;
        }
        for (const line of formatSeedReport(report)) io.out(line);
        io.out(`${COMMAND}: OK: ${target} is seeded for the factory. State: npm run db:status -w @dems/core-server -- --database ${target}`);
        return 0;
      }
      try {
        // The v2 demo packages of the Core this environment describes; a test database gets none unless the test hands a port in.
        const test = TEST_DATABASE_PATTERN.test(target);
        const demoPackages = options.demoPackages === undefined ? (test ? null : demoPackagesOfEnvironment({ environment: options.environment ?? process.env, dataDir: options.dataDir, now: () => now })) : options.demoPackages;
        report = await seedDatabase(
          pool,
          // A test database is reachable only when a test set `allowTestDatabase` (the name guard
          // of the command refused it otherwise); the seed then insists on a test name (TI-13).
          { now, target: test ? 'test' : 'project' },
          { ...options.dependencies, ...(demoPackages === null ? {} : { demoPackages }) },
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
      const demo = seedDemoLines(report.demoPackages, report.demoPlacement);
      for (const line of demo.out) io.out(`${COMMAND}: ${line}`);
      for (const line of demo.err) io.err(`${COMMAND}: ${line}`);
      io.out(`${COMMAND}: OK: ${target} is seeded. State: npm run db:status -w @dems/core-server -- --database ${target}`);
      return 0;
    });
  });
}

if (isEntryPoint(import.meta.url)) await main(runSeed);
