/**
 * The owner-role connection of the `db:*` commands (database contract §7.6, §8.4; plan row W17).
 *
 * The commands run as `dems_owner`, the role that owns every project database and is NOT a
 * superuser. Its five connection fields are in `<data dir>/pg.owner.env` (mode 0600), which the
 * command opens and parses itself (CR-2): nothing is exported into the process environment,
 * nothing is passed as an argument, and no connection text with a password exists (CR-1, CR-4).
 *
 * This folder and the reset routine are the only places under `src/` that may name that file
 * (T-CR-2 c). The running server never imports this module: its pool is the runtime role's.
 *
 * ISOLATION (decision D26, finding F27). Another PostgreSQL server, not this project's, listens
 * on the default port of this host. Host and port come from the file and from nowhere else:
 * there is no default for either, the host must be loopback IPv4, the default port is refused,
 * and the variables the driver would read on its own are removed before a client exists.
 *
 * No message of this module holds a value of the file: a message names the file and a key.
 */
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Pool } from 'pg';
import { DATABASE_HOST, FOREIGN_DATABASE_PORT, RUNTIME_ROLE, Secret, type DatabaseConnection } from '../../config';
import { DEFAULT_DATA_DIR } from '../../plugins/config';

/** Owns every project database; migrate, seed, reset and the tests run as it (SD-01). */
export const OWNER_ROLE = 'dems_owner';
/** The runtime role: the grants of `0003_privileges` name it, so it must exist first (OW-8). */
export const APP_ROLE = RUNTIME_ROLE;
/** The owner role's connection file, inside the data directory. */
export const OWNER_FILE_NAME = 'pg.owner.env';
/** The five keys of the owner file, in file order (CR-1). */
export const OWNER_FILE_KEYS = {
  host: 'DEMS_PG_HOST',
  port: 'DEMS_PG_PORT',
  database: 'DEMS_PG_DATABASE',
  user: 'DEMS_PG_OWNER_ROLE',
  password: 'DEMS_PG_OWNER_PASSWORD',
} as const;
/** Where `CREATE DATABASE` and the catalog reads about other databases are issued (DA-12). */
export const MAINTENANCE_DATABASE = 'postgres';
/** The provisioning command a message names when a role or a file is missing. */
export const PROVISIONING_COMMAND = 'npm run pg:init';

const COMMAND_POOL_MAX = 2;
const CONNECT_TIMEOUT_MS = 5_000;
const APPLICATION_NAME = 'dems-db-command';

export type DbCommandErrorCode =
  | 'USAGE'
  | 'DATABASE_NAME_REFUSED'
  | 'OWNER_FILE_MISSING'
  | 'OWNER_FILE_MODE'
  | 'OWNER_FILE_FORMAT'
  | 'OWNER_FILE_ROLE'
  | 'ENDPOINT_REFUSED'
  | 'DATABASE_UNREACHABLE'
  | 'OWNER_ROLE_REFUSED'
  | 'ROLE_MISSING'
  | 'DATABASE_MISSING'
  | 'DATABASE_NOT_OURS'
  | 'MIGRATION_SET_INVALID'
  | 'MIGRATION_LEDGER_MISMATCH'
  | 'SCHEMA_VERSION_MISMATCH'
  | 'SCHEMA_NOT_CURRENT';

/** A failure of a `db:*` command. `message` is safe to print: it never holds a credential. */
export class DbCommandError extends Error {
  readonly code: DbCommandErrorCode;
  /** 2 for a wrong call (usage, a refused name); 1 for everything else. */
  readonly exitCode: 1 | 2;

  constructor(code: DbCommandErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DbCommandError';
    this.code = code;
    this.exitCode = code === 'USAGE' || code === 'DATABASE_NAME_REFUSED' ? 2 : 1;
  }
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
}

/**
 * Removes every variable whose name starts with `PG` from an environment object and returns the
 * removed NAMES. The driver reads such variables for whatever its options leave unset; the
 * command's connection must be exactly what the owner file says (decision D26).
 */
export function scrubDriverEnvironment(env: Record<string, string | undefined>): string[] {
  const removed = Object.keys(env).filter((name) => name.startsWith('PG'));
  for (const name of removed) delete env[name];
  return removed.sort();
}

/** CR-3: a file that group or others may access stops the command. Nothing is read. */
function assertPrivateMode(file: string): void {
  let mode: number;
  try {
    mode = statSync(file).mode & 0o777;
  } catch (error) {
    throw new DbCommandError(
      'OWNER_FILE_MISSING',
      `${file} cannot be read (${errorCode(error)}). It is created with the cluster: run "${PROVISIONING_COMMAND}".`,
    );
  }
  if ((mode & 0o077) !== 0) {
    throw new DbCommandError(
      'OWNER_FILE_MODE',
      `${file} has mode ${mode.toString(8)}; expected 600 (no access for group or others). Nothing was read.`,
    );
  }
}

/**
 * Reads the owner role's five connection fields. The `database` field of the result is the
 * file's default (the maintenance database); a command takes its target from `--database`.
 */
export function readOwnerConnection(dataDir: string = DEFAULT_DATA_DIR): DatabaseConnection {
  const file = join(resolve(dataDir), OWNER_FILE_NAME);
  assertPrivateMode(file);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    throw new DbCommandError('OWNER_FILE_MISSING', `${file} cannot be read (${errorCode(error)}).`);
  }

  const keyNames: readonly string[] = Object.values(OWNER_FILE_KEYS);
  const found = new Map<string, string>();
  text.split('\n').forEach((line, index) => {
    if (line === '') return;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    const key = match?.[1];
    const value = match?.[2];
    if (key === undefined || value === undefined) {
      throw new DbCommandError('OWNER_FILE_FORMAT', `${file}: line ${index + 1} is not KEY=value.`);
    }
    if (!keyNames.includes(key)) throw new DbCommandError('OWNER_FILE_FORMAT', `${file}: unexpected key ${key}.`);
    if (found.has(key)) throw new DbCommandError('OWNER_FILE_FORMAT', `${file}: key ${key} appears twice.`);
    found.set(key, value);
  });
  const field = (key: string): string => {
    const value = found.get(key);
    if (value === undefined || value === '') {
      throw new DbCommandError('OWNER_FILE_FORMAT', `${file}: key ${key} is missing or empty.`);
    }
    return value;
  };

  const password = new Secret(field(OWNER_FILE_KEYS.password));
  const user = field(OWNER_FILE_KEYS.user);
  if (user !== OWNER_ROLE) {
    throw new DbCommandError(
      'OWNER_FILE_ROLE',
      `${file}: ${OWNER_FILE_KEYS.user} must be ${OWNER_ROLE}; the database commands run as no other role.`,
    );
  }
  const host = field(OWNER_FILE_KEYS.host);
  if (host !== DATABASE_HOST) {
    throw new DbCommandError('ENDPOINT_REFUSED', `${file}: ${OWNER_FILE_KEYS.host} must be ${DATABASE_HOST}.`);
  }
  const portText = field(OWNER_FILE_KEYS.port);
  const port = /^[0-9]{1,5}$/.test(portText) ? Number(portText) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new DbCommandError('ENDPOINT_REFUSED', `${file}: ${OWNER_FILE_KEYS.port} must be a port number.`);
  }
  if (port === FOREIGN_DATABASE_PORT) {
    throw new DbCommandError(
      'ENDPOINT_REFUSED',
      `${file}: ${OWNER_FILE_KEYS.port} names PostgreSQL's default port, which is another server on this host, not the project's.`,
    );
  }

  return Object.freeze({ host: DATABASE_HOST, port, database: field(OWNER_FILE_KEYS.database), user, password });
}

/**
 * A pool of the owner role on one database. Every field is passed explicitly, TLS is off
 * (loopback only), and the password is handed over through a function, so the pool's options
 * hold no copy of it. The caller ends the pool.
 */
export function createOwnerPool(owner: DatabaseConnection, database: string, applicationName = APPLICATION_NAME): Pool {
  const pool = new Pool({
    host: owner.host,
    port: owner.port,
    database,
    user: owner.user,
    password: () => owner.password.reveal(),
    ssl: false,
    application_name: applicationName,
    max: COMMAND_POOL_MAX,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  // Without a listener, an error on an idle connection would end the process.
  pool.on('error', () => undefined);
  return pool;
}

/** Turns a failure to connect into a message that says what to do. Other errors pass through. */
export function connectionFailure(error: unknown, owner: DatabaseConnection, database: string): unknown {
  const code = errorCode(error);
  const where = `${owner.host}:${owner.port}`;
  if (code === 'ECONNREFUSED') {
    return new DbCommandError(
      'DATABASE_UNREACHABLE',
      `Nothing answers on ${where}. Start the project's PostgreSQL with "npm run pg:start" (state: "npm run pg:status").`,
      { cause: error },
    );
  }
  if (code === 'EPERM' || code === 'EACCES') {
    return new DbCommandError(
      'DATABASE_UNREACHABLE',
      `The operating system refused the connection to ${where} (${code}). That is a command sandbox, not a stopped server: run the command outside it.`,
      { cause: error },
    );
  }
  if (code === '28P01' || code === '28000') {
    return new DbCommandError(
      'DATABASE_UNREACHABLE',
      `The server on ${where} refused the role ${owner.user} (${code}). Check ${OWNER_FILE_KEYS.password} in ${OWNER_FILE_NAME}; it is written by "${PROVISIONING_COMMAND}".`,
      { cause: error },
    );
  }
  if (code === '3D000') {
    return new DbCommandError('DATABASE_MISSING', `The database ${database} does not exist.`, { cause: error });
  }
  return error;
}

export interface OwnerSessionFacts {
  readonly role: string;
  readonly database: string;
  readonly serverVersion: string;
  readonly serverVersionNum: number;
}

/**
 * Asks the session who it is, as the reset routine does at R-0: the role must be `dems_owner`
 * and must not be a superuser. A database that was created or migrated by a superuser by mistake
 * would make the two SECURITY DEFINER functions run with superuser rights (OW-2).
 */
export async function verifyOwnerSession(pool: Pool): Promise<OwnerSessionFacts> {
  const { rows } = await pool.query<{
    role: string;
    superuser: boolean;
    database: string;
    version: string;
    version_num: number;
  }>(
    'SELECT current_user::text AS role, r.rolsuper AS superuser, current_database()::text AS database, ' +
      "current_setting('server_version') AS version, current_setting('server_version_num')::int AS version_num " +
      'FROM pg_roles r WHERE r.rolname = current_user',
  );
  const row = rows[0];
  if (row === undefined || row.role !== OWNER_ROLE || row.superuser !== false) {
    throw new DbCommandError(
      'OWNER_ROLE_REFUSED',
      `refused: the database commands run as ${OWNER_ROLE}, which is not a superuser; this session is not that role.`,
    );
  }
  return { role: row.role, database: row.database, serverVersion: row.version, serverVersionNum: row.version_num };
}

/**
 * OW-8: both project roles must exist before a database is created or migrated. No `db:*`
 * command creates a role (`dems_owner` cannot); the message names the provisioning command.
 */
export async function assertProjectRoles(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ rolname: string }>('SELECT rolname::text AS rolname FROM pg_roles WHERE rolname = ANY($1)', [
    [OWNER_ROLE, APP_ROLE],
  ]);
  const present = new Set(rows.map((row) => row.rolname));
  const missing = [OWNER_ROLE, APP_ROLE].filter((role) => !present.has(role));
  if (missing.length > 0) {
    throw new DbCommandError(
      'ROLE_MISSING',
      `The role ${missing.join(' and ')} does not exist. Both project roles are created at provisioning: run "${PROVISIONING_COMMAND}". No db command creates a role.`,
    );
  }
}
