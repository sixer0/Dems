/**
 * What the three database commands share: the argument, the output, the exit code and the
 * owner pools (database contract §8.4; plan row W17).
 *
 *   npm run db:create  -w @dems/core-server -- --database <name>
 *   npm run db:migrate -w @dems/core-server -- --database <name>
 *   npm run db:status  -w @dems/core-server -- --database <name>
 *
 * Exit codes: 0 done; 1 the command could not do its work, or the database is not in the state
 * this code expects (the message says which); 2 a wrong call (usage, a refused database name).
 * A refused name stops the command before any file is read and before any connection.
 *
 * A command never prints a value of the credential file, and takes no secret as an argument or
 * from the environment (CR-4). Its messages name a file, a key, a role or a database.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import type { DatabaseConnection } from '../../config';
import { guardTargetDatabase, PROJECT_DATABASES, type TargetDatabase } from './database-names';
import {
  DbCommandError,
  MAINTENANCE_DATABASE,
  connectionFailure,
  createOwnerPool,
  readOwnerConnection,
  scrubDriverEnvironment,
  verifyOwnerSession,
  type OwnerSessionFacts,
} from './owner-connection';

export interface CommandIo {
  out(line: string): void;
  err(line: string): void;
}

export interface CommandOptions {
  /** Where the lines go. Default: standard output and standard error. */
  readonly io?: CommandIo;
  /** The directory that holds the owner connection file. Default: `<repository>/.data`. */
  readonly dataDir?: string;
  /** Tests only: accept a `dems_test_*` database of the test's own run (never `dems_demo`). */
  readonly allowTestDatabase?: boolean;
  /** Tests only: another migration folder (a copy with an edited file). */
  readonly migrationsFolder?: string;
}

const processIo: CommandIo = {
  out: (line) => void process.stdout.write(`${line}\n`),
  err: (line) => void process.stderr.write(`${line}\n`),
};

export function usage(command: string): string {
  return `usage: npm run ${command} -w @dems/core-server -- --database <${PROJECT_DATABASES.join('|')}>`;
}

/** Parses `--database <name>` or `--database=<name>`. Anything else is a wrong call. */
export function parseDatabaseArgument(argv: readonly string[], command: string): string {
  let database: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';
    let value: string | undefined;
    if (argument === '--database') {
      value = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--database=')) {
      value = argument.slice('--database='.length);
    } else {
      throw new DbCommandError('USAGE', `${usage(command)}\nunexpected argument.`);
    }
    if (value === undefined || value === '' || database !== undefined) {
      throw new DbCommandError('USAGE', `${usage(command)}\n--database takes one name, once.`);
    }
    database = value;
  }
  if (database === undefined) throw new DbCommandError('USAGE', usage(command));
  return database;
}

export interface CommandContext {
  readonly io: CommandIo;
  readonly target: TargetDatabase;
  readonly owner: DatabaseConnection;
  readonly options: CommandOptions;
  /** Runs `work` with an owner pool on `database`, verifies the role first, and ends the pool. */
  withPool<T>(database: string, work: (pool: Pool, facts: OwnerSessionFacts) => Promise<T>): Promise<T>;
  /** The same on the maintenance database. */
  withMaintenancePool<T>(work: (pool: Pool, facts: OwnerSessionFacts) => Promise<T>): Promise<T>;
}

/** A printable description of an unexpected failure: its class and code, and a server's own message. */
function describeUnexpected(error: unknown): string {
  // drizzle-orm wraps the driver error: the SQLSTATE and the server's message are on `cause` (D38).
  // The wrapper's own message repeats the whole statement, so it is not printed.
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string') {
      const name = typeof candidate.name === 'string' ? candidate.name : 'Error';
      // A five-character SQLSTATE: the message is the server's and names objects, not credentials.
      return /^[0-9A-Z]{5}$/.test(candidate.code) && typeof candidate.message === 'string'
        ? `${name} ${candidate.code}: ${candidate.message}`
        : `${name} ${candidate.code}`;
    }
    current = candidate.cause;
  }
  return error instanceof Error ? error.name : 'an unexpected failure';
}

/**
 * The frame of a command: parse, guard the name, read the owner file, run, map failures to an
 * exit code. It returns the exit code and never throws.
 */
export async function runCommand(
  command: string,
  argv: readonly string[],
  options: CommandOptions,
  body: (context: CommandContext) => Promise<number>,
): Promise<number> {
  const io = options.io ?? processIo;
  try {
    // The name is checked first: a refused name reads no file and opens no connection.
    const target = guardTargetDatabase(parseDatabaseArgument(argv, command), {
      allowTestDatabase: options.allowTestDatabase,
    });
    const owner = readOwnerConnection(options.dataDir);

    const withPool: CommandContext['withPool'] = async (database, work) => {
      const pool = createOwnerPool(owner, database);
      try {
        let facts: OwnerSessionFacts;
        try {
          facts = await verifyOwnerSession(pool);
        } catch (error) {
          throw connectionFailure(error, owner, database);
        }
        return await work(pool, facts);
      } finally {
        await pool.end();
      }
    };

    return await body({
      io,
      target,
      owner,
      options,
      withPool,
      withMaintenancePool: (work) => withPool(MAINTENANCE_DATABASE, work),
    });
  } catch (error) {
    if (error instanceof DbCommandError) {
      io.err(`${command}: ${error.message}`);
      return error.exitCode;
    }
    io.err(`${command}: failed (${describeUnexpected(error)}).`);
    return 1;
  }
}

export interface DatabaseFacts {
  readonly owner: string;
  readonly encoding: string;
  readonly collate: string;
  readonly ctype: string;
}

/** The catalog row of a database, read from the maintenance database; `null` when it does not exist. */
export async function readDatabaseFacts(pool: Pool, target: TargetDatabase): Promise<DatabaseFacts | null> {
  const { rows } = await pool.query<{ owner: string; encoding: string; collate: string; ctype: string }>(
    'SELECT pg_get_userbyid(datdba)::text AS owner, pg_encoding_to_char(encoding)::text AS encoding, ' +
      'datcollate::text AS collate, datctype::text AS ctype FROM pg_database WHERE datname = $1',
    [target],
  );
  return rows[0] ?? null;
}

/** True when the module at `metaUrl` is the file the process was started with. */
export function isEntryPoint(metaUrl: string): boolean {
  const started = process.argv[1];
  return started !== undefined && resolve(started) === fileURLToPath(metaUrl);
}

/**
 * The entry of a command-line run: removes the driver's own variables from the environment,
 * runs the command with the process arguments and sets the exit code.
 */
export async function main(run: (argv: readonly string[]) => Promise<number>): Promise<void> {
  scrubDriverEnvironment(process.env);
  process.exitCode = await run(process.argv.slice(2));
}
