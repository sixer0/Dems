/**
 * `db:reset`: returns ONE project database to the seed state, as the owner role (database
 * contract §8.4, §8.5; plan row W29; decision D27 names this entry file).
 *
 *   npm run db:reset -w @dems/core-server -- --database <name> [--scenario <name>]
 *
 * It builds a new database beside the named one (migrations, the seed as of the server clock at
 * this moment), copies the thirteen kept tables into it unchanged, swaps the two names and drops
 * the old database last. Sessions, paired devices, device credentials, biometric tokens,
 * settings, pairing codes, the two registry counters, the capture configuration with its devices
 * and credentials, the STT configuration row and the lineage of discarded audit chains
 * survive; everything else is the seed. A database that does not exist yet is created (a first
 * build): that is how the lane databases come into being.
 *
 * THE DATABASE MUST NOT BE IN USE. The command ends nobody's session: stop the server of that
 * database first (a lane's backend before `db:reset --database dems_lane_k`). With a session
 * open on the target it exits 1 and changes nothing.
 *
 * Exit codes, as for the other database commands: 0 reset; 1 not reset (the message says why,
 * and whether the database is unchanged); 2 a wrong call (usage, a refused database name, an
 * unknown scenario): nothing was read and no connection was opened.
 *
 * THE MIGRATE LOCK. On `dems_demo` the command is run under the migrate lock, like `db:migrate`
 * and `db:seed`, so that it cannot overlap a migration of that database (P16, MG-9):
 *
 *   /usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset -w @dems/core-server -- --database dems_demo
 *
 * The lock is the caller's: this command starts no child process (decision D54, DN-8). What the
 * routine takes itself is the advisory lock (442001, slot) on the maintenance database, so two
 * resets of one database can never run at the same time, whoever called them.
 *
 * WHICH FOLDER THE REAL-EVIDENCE GUARD JUDGES (erratum PE-0013-01; ruling D166). The reset is
 * refused while a real sealed package exists below the Core's media store root. This command
 * learns that root in this order, PRINTS it before the guard reads it, and refuses by name when
 * it cannot know it - it never falls back to a default folder:
 *
 *   1. `DEMS_MEDIA_DIR` of its own environment (the variable the server is configured with);
 *   2. else the root the Core of that database recorded at its last start (`core_media_store`);
 *   3. neither: `RESET_STORE_ROOT_UNKNOWN`. Both, and they differ: `RESET_STORE_ROOT_CONFLICT`.
 *
 * In both refusals nothing was changed. A first build (the database does not exist) has nothing
 * to judge and asks for no root.
 *
 * It prints the row count of every table, the audit head and the lineage row of the discarded
 * chain. It prints no credential and no row of a kept table. The head hash of an audit chain is
 * an integrity value, not a secret.
 */
import { resolve } from 'node:path';
import { ENV_MEDIA_DIR, parseCapturePath } from '../../config';
import { isEntryPoint, main, type CommandIo } from '../commands/cli';
import type { StoredMediaStoreRoot } from '../commands/media-store-root';
import { MIGRATE_LOCK_DATABASE, MIGRATE_LOCK_HINT, PROJECT_DATABASES } from '../commands/database-names';
import { SCENARIO } from '../schema';
import { SEED_DEMO_NOT_ASKED, demoPackagesOfEnvironment, seedDemoLines, type SeedDemoPackages } from '../seed';
import { ResetError } from './errors';
import { DISCARD_UNSEALED_FAKE_OPTION } from './real-evidence';
import { resetDatabase, type ResetInternals, type ResetLogEntry, type ResetOptions, type ResetReport } from './routine';

const COMMAND = 'db:reset';

export interface ResetCommandOptions {
  /** Where the lines go. Default: standard output and standard error. */
  readonly io?: CommandIo;
  /** The directory that holds the owner connection file. Default: `<repository>/.data`. */
  readonly dataDir?: string;
  /** The evidence-store root, stated by the caller: it is judged as it is, and neither the environment nor the database is asked. A test passes its own. */
  readonly evidenceStoreDir?: string;
  /** The environment `DEMS_MEDIA_DIR` is read from. Default: the process environment. A test passes its own. */
  readonly environment?: Readonly<Record<string, string | undefined>>;
  /** The server clock: read ONCE by the routine. Default: the real clock. A test passes a fixed instant. */
  readonly clock?: () => number;
  /**
   * The v2 demo packages of the reseed (pass E3). Default: the port of the Core this command's
   * environment describes (`demoPackagesOfEnvironment`) for a project database, none for a test
   * database. `null`: none is asked for. A test passes its own port.
   */
  readonly demoPackages?: SeedDemoPackages | null;
  /** Tests only: observes, or stops, the routine at a checkpoint. */
  readonly onCheckpoint?: ResetOptions['onCheckpoint'];
  /** Tests only: a shorter wait for sessions to end. */
  readonly sessionDrainMs?: number;
  /** Tests only: the seams of the routine (a test database of the test's own run, a stand-in pool). */
  readonly internals?: ResetInternals;
}

const processIo: CommandIo = {
  out: (line) => void process.stdout.write(`${line}\n`),
  err: (line) => void process.stderr.write(`${line}\n`),
};

export function resetUsage(): string {
  return `usage: npm run ${COMMAND} -w @dems/core-server -- --database <${PROJECT_DATABASES.join('|')}> [--scenario <${SCENARIO.join('|')}>] [${DISCARD_UNSEALED_FAKE_OPTION}]`;
}

/** A wrong call: exit code 2. */
export class ResetUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResetUsageError';
  }
}

export interface ResetArguments {
  readonly database: string;
  readonly scenario: string | undefined;
  /** Rule (15) of the real-evidence guard: present (true) only when the option was written. */
  readonly discardUnsealedFakeRecordings?: boolean;
}

/**
 * Parses `--database <name>` and the optional `--scenario <name>`, each also as `--x=<name>`,
 * each at most once. Anything else is a wrong call. No value is echoed.
 */
export function parseResetArguments(argv: readonly string[]): ResetArguments {
  const found: { database?: string; scenario?: string } = {};
  let discardUnsealedFakeRecordings = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';
    // Rule (15) of the real-evidence guard (fix wave I, G75b-01): a word without a value, at most once.
    if (argument === DISCARD_UNSEALED_FAKE_OPTION) {
      if (discardUnsealedFakeRecordings) throw new ResetUsageError(`${resetUsage()}\n${DISCARD_UNSEALED_FAKE_OPTION} is given once.`);
      discardUnsealedFakeRecordings = true;
      continue;
    }
    let key: 'database' | 'scenario' | undefined;
    let value: string | undefined;
    for (const option of ['database', 'scenario'] as const) {
      if (argument === `--${option}`) {
        key = option;
        value = argv[index + 1];
        index += 1;
      } else if (argument.startsWith(`--${option}=`)) {
        key = option;
        value = argument.slice(`--${option}=`.length);
      }
    }
    if (key === undefined) throw new ResetUsageError(`${resetUsage()}\nunexpected argument.`);
    if (value === undefined || value === '' || value.startsWith('--') || found[key] !== undefined) {
      throw new ResetUsageError(`${resetUsage()}\n--${key} takes one name, once.`);
    }
    found[key] = value;
  }
  if (found.database === undefined) throw new ResetUsageError(resetUsage());
  return { database: found.database, scenario: found.scenario, ...(discardUnsealedFakeRecordings ? { discardUnsealedFakeRecordings } : {}) };
}

const iso = (ms: number): string => `${new Date(ms).toISOString()} (${ms})`;
const round = (ms: number): number => Math.round(ms);

/**
 * The media store root this command lets the real-evidence guard judge (see the header), said
 * through `say` BEFORE it is returned. `fromEnvironment`: the value of `DEMS_MEDIA_DIR`, already
 * checked to be an absolute path, or undefined. `stored`: what the Core recorded, or null.
 * Throws the named refusal when the root is not known or the two sources disagree.
 */
export function resetStoreRootOf(database: string, fromEnvironment: string | undefined, stored: StoredMediaStoreRoot | null, say: (line: string) => void): string {
  if (fromEnvironment !== undefined) {
    const root = resolve(fromEnvironment);
    if (stored !== null && stored.root !== root) {
      throw new ResetError(
        'RESET_STORE_ROOT_CONFLICT',
        'R-3',
        `refused: ${ENV_MEDIA_DIR} of this command names the media store root ${root}, and the Core of ${database} recorded ${stored.root} at its start of ${iso(stored.recordedAt)}. The guard judges one folder and will not choose. Run the command with the server's ${ENV_MEDIA_DIR}, or without the variable to judge the recorded root. Nothing was changed.`,
      );
    }
    say(`media store root the real-evidence guard judges: ${root} (${ENV_MEDIA_DIR} of this command${stored === null ? '; the database records none' : '; equal to the root the Core recorded'})`);
    return root;
  }
  if (stored !== null) {
    say(`media store root the real-evidence guard judges: ${stored.root} (recorded by the Core of ${database} at its start of ${iso(stored.recordedAt)}; ${ENV_MEDIA_DIR} is not set for this command)`);
    return stored.root;
  }
  throw new ResetError(
    'RESET_STORE_ROOT_UNKNOWN',
    'R-3',
    `refused: this command cannot tell where the Core of ${database} keeps its media: ${ENV_MEDIA_DIR} is not set in its environment, and the database records no root (no Core has started on it since migration 0013). Set ${ENV_MEDIA_DIR} to the server's media store root, or start the Core once. Nothing was changed.`,
  );
}

/** The lines `db:reset` prints for a finished reset. */
export function formatResetReport(report: ResetReport): string[] {
  const filled = Object.entries(report.counts).filter(([, rows]) => rows > 0);
  const total = filled.reduce((sum, [, rows]) => sum + rows, 0);
  const lines = [
    `${COMMAND}: ${report.database} on PostgreSQL ${report.serverVersion} as ${report.role}`,
    `${COMMAND}: dataset as of ${iso(report.now)}; scenario ${report.scenario}; reason ${report.reason}; actor ${report.actorId ?? 'none (command line)'}`,
  ];
  if (report.firstBuild) {
    lines.push(`${COMMAND}: first build: ${report.database} did not exist. Nothing was carried over and no chain was discarded; epoch ${report.epoch}.`);
  } else {
    const kept = Object.entries(report.kept)
      .map(([table, rows]) => `${table} ${rows}`)
      .join(', ');
    lines.push(`${COMMAND}: epoch ${report.previousEpoch ?? 'none (never seeded)'} -> ${report.epoch}`);
    lines.push(`${COMMAND}: kept tables carried over unchanged (rows): ${kept}`);
    lines.push(
      `${COMMAND}: pairing codes that were ACTIVE, now CANCELLED: ${report.cancelledPairingCodes}; operators with a last sign-in from a kept session: ${report.operatorsWithSignIn}`,
    );
    const appended = report.lineage.appended;
    lines.push(
      appended === null
        ? `${COMMAND}: discarded chain: none (the audit log was empty); no lineage row was written`
        : `${COMMAND}: discarded chain: reset_no ${appended.resetNo}, epoch ${appended.epoch}, rows ${appended.rowCount}, first_seq ${appended.firstSeq}, last_seq ${appended.lastSeq}, head ${appended.headHash}`,
    );
    lines.push(`${COMMAND}: SCENARIO_LOADED is audit row ${report.scenarioLoadedSeq ?? 'none'} of the new chain`);
  }
  if (report.leftoversRemoved.length > 0) lines.push(`${COMMAND}: removed leftovers of an earlier run: ${report.leftoversRemoved.join(', ')}`);
  if (report.previousDropped === false) lines.push(`${COMMAND}: the previous database could not be dropped; the next reset removes it`);
  lines.push(
    `${COMMAND}: done in ${round(report.totalMs)} ms (${Object.entries(report.stepMs)
      .map(([step, ms]) => `${step} ${round(ms)}`)
      .join(', ')}); the database now holds ${total} row(s) in ${filled.length} of ${Object.keys(report.counts).length} table(s)`,
  );
  lines.push(`row counts       ${Object.keys(report.counts).length} table(s)`);
  for (const [table, rows] of Object.entries(report.counts)) lines.push(`  ${table.padEnd(24)} ${rows}`);
  lines.push(`audit head       seq ${report.auditHead.seq}; hash ${report.auditHead.hash.slice(0, 16)}...`);
  lines.push(`lineage          ${report.lineage.total} row(s); ${report.lineage.carried} carried over, ${appendedCount(report)} appended`);
  return lines;
}

function appendedCount(report: ResetReport): number {
  return report.lineage.appended === null ? 0 : 1;
}

/** Runs the command and returns its exit code. It never throws. */
export async function runReset(argv: readonly string[], options: ResetCommandOptions = {}): Promise<number> {
  const io = options.io ?? processIo;
  let parsed: ResetArguments;
  try {
    parsed = parseResetArguments(argv);
  } catch (error) {
    io.err(`${COMMAND}: ${error instanceof ResetUsageError ? error.message : resetUsage()}`);
    return 2;
  }

  const log = (entry: ResetLogEntry): void => {
    if (entry.level === 'info') io.out(`${COMMAND}: ${entry.message}`);
    else io.err(`${COMMAND}: ${entry.message}`);
  };
  if (parsed.database === MIGRATE_LOCK_DATABASE) {
    io.out(`${COMMAND}: ${parsed.database} is reset under the migrate lock: this command must be run as "${MIGRATE_LOCK_HINT} npm run ${COMMAND} ...".`);
  }

  try {
    // A value of the variable that is no absolute path is refused as the configuration refuses it, before anything is opened.
    const fromEnvironment = options.evidenceStoreDir === undefined ? parseCapturePath(ENV_MEDIA_DIR, (options.environment ?? process.env)[ENV_MEDIA_DIR]) ?? undefined : undefined;
    // DR-1 holds for the packages too: they are sealed at the routine's one clock reading, whenever it is taken.
    let sealedAt: number | null = null;
    const clock = (): number => (sealedAt ??= (options.clock ?? Date.now)());
    const project: readonly string[] = PROJECT_DATABASES;
    const demoPackages =
      options.demoPackages === undefined
        ? project.includes(parsed.database)
          ? demoPackagesOfEnvironment({ environment: options.environment ?? process.env, dataDir: options.dataDir, now: clock })
          : null
        : options.demoPackages;
    const report = await resetDatabase(
      {
        database: parsed.database,
        // A wrong scenario name is refused by the routine before it opens anything.
        scenario: parsed.scenario as ResetOptions['scenario'],
        // DC-9: a reset from the command line has no actor.
        actorId: null,
        reason: 'RESET',
        clock,
        dataDir: options.dataDir,
        ...(demoPackages === null ? {} : { demoPackages }),
        // Rulings D165 / D166: the guard reads the directory the Core seals into - `DEMS_MEDIA_DIR` of this
        // command, else the root the Core recorded in the database; never a default folder. The root is
        // printed before it is judged. A caller's own root (a test) is judged as stated.
        evidenceStoreDir: options.evidenceStoreDir,
        // Rule (15) of the guard: only when the caller wrote the option.
        discardUnsealedFakeRecordings: parsed.discardUnsealedFakeRecordings === true,
        resolveEvidenceStoreDir:
          options.evidenceStoreDir !== undefined ? undefined : (stored) => resetStoreRootOf(parsed.database, fromEnvironment, stored, (line) => io.out(`${COMMAND}: ${line}`)),
        onCheckpoint: options.onCheckpoint,
        sessionDrainMs: options.sessionDrainMs,
        // A command-line run owns its process: the routine cleans the driver's variables of it
        // (its `main` already did; again is a no-op). The server never passes this (W91-7).
        driverEnvironment: process.env,
        log,
      },
      options.internals,
    );
    for (const line of formatResetReport(report)) io.out(line);
    const demo = seedDemoLines(report.demoPackages ?? SEED_DEMO_NOT_ASKED, report.demoPlacement ?? null);
    for (const line of demo.out) io.out(`${COMMAND}: ${line}`);
    // A package that was not put in place is in the routine's own log line already (RESET_DEMO_PACKAGE_NOT_PLACED).
    io.out(`${COMMAND}: OK: ${report.database} is reset. State: npm run db:status -w @dems/core-server -- --database ${report.database}`);
    return 0;
  } catch (error) {
    if (error instanceof ResetError) {
      io.err(`${COMMAND}: ${error.message}`);
      if (error.code === 'RESET_TARGET_REFUSED' || error.code === 'RESET_OPTIONS_INVALID') return 2;
      io.err(
        error.code === 'RESET_RECOVERED_PREVIOUS'
          ? `${COMMAND}: NOT RESET (${error.code} at ${error.step}).`
          : `${COMMAND}: NOT RESET (${error.code} at ${error.step}); ${error.targetUntouched ? 'the database is unchanged' : 'the state of the database is not known'}.`,
      );
      return 1;
    }
    io.err(`${COMMAND}: failed (${error instanceof Error ? error.name : 'an unexpected failure'}).`);
    return 1;
  }
}

if (isEntryPoint(import.meta.url)) await main((argv) => runReset(argv));
