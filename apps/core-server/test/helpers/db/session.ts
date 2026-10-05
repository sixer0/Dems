/**
 * The one place of the test helper that builds a PostgreSQL client or pool.
 *
 * Every connection carries five discrete fields, each passed explicitly, TLS off (loopback
 * only). Nothing falls back to a default host or port or to a variable the driver would read on
 * its own (decision D26): the endpoint is checked again right here, immediately before the
 * driver sees it, and the variables the driver reads are removed first.
 *
 * Roles (TI-9). The helper connects as `dems_owner`; the code under test connects as
 * `dems_app`. A role name that is neither is refused before a client exists, and a session that
 * turns out to be a superuser is closed at once and refused (`verifySession`).
 */
import { Client, Pool } from 'pg';
import {
  APP_ROLE,
  CONNECT_TIMEOUT_MS,
  DEFAULT_LOCK_TIMEOUT_MS,
  MAINTENANCE_DATABASE,
  OWNER_ROLE,
  PROJECT_DATABASE_HOST,
  PROJECT_DATABASE_PORT,
  REFUSED_SUPERUSER_ROLE,
} from './constants';
import type { RoleCredentials } from './credentials';
import { PROJECT_ENDPOINT, assertProjectEndpoint, unreachableError } from './endpoint';
import { DbTestHelperError, errorCode, errorMessage } from './errors';
import type { GuardedDatabaseName } from './names';

export type Row = Record<string, unknown>;

/** Sends statements. `statementCount` is how many were handed to the driver so far. */
export interface StatementRunner {
  run<R extends Row = Row>(text: string, values?: readonly unknown[]): Promise<R[]>;
  readonly statementCount: number;
}

/**
 * Removes every variable whose name starts with `PG` from an environment object and returns the
 * removed NAMES. The driver reads such variables for whatever its options leave unset.
 */
export function scrubDriverEnvironment(env: Record<string, string | undefined> = process.env): string[] {
  const removed = Object.keys(env).filter((name) => /^PG[A-Z0-9_]*$/.test(name));
  for (const name of removed) delete env[name];
  return removed.sort();
}

export interface DriverOptions {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: () => string;
  readonly ssl: false;
  readonly application_name: string;
  readonly connectionTimeoutMillis: number;
}

/**
 * The options handed to the driver. Throws before a client exists when the endpoint is not the
 * project's or the role is not one of the two project roles.
 */
export function driverOptions(credentials: RoleCredentials, database: string, applicationName: string): DriverOptions {
  const endpoint = assertProjectEndpoint(credentials.host, credentials.port);
  if (credentials.user === REFUSED_SUPERUSER_ROLE) {
    throw new DbTestHelperError(
      'ROLE_REFUSED',
      `refused: the test helper never connects as the bootstrap superuser ${REFUSED_SUPERUSER_ROLE} (TI-9).`,
    );
  }
  if (credentials.user !== OWNER_ROLE && credentials.user !== APP_ROLE) {
    throw new DbTestHelperError('ROLE_REFUSED', `refused: the test helper connects as ${OWNER_ROLE} or ${APP_ROLE} only.`);
  }
  if (database === '') {
    throw new DbTestHelperError('NAME_INVALID', 'refused: a connection needs a database name.');
  }
  return {
    host: endpoint.host,
    port: endpoint.port,
    database,
    user: credentials.user,
    // A function, so that the driver's options hold no copy of the password.
    password: () => credentials.password.reveal(),
    ssl: false,
    application_name: applicationName,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  };
}

// ── Role check ─────────────────────────────────────────────────────────────────────────────────

const VERIFY_SQL =
  'SELECT current_user::text AS role, r.rolsuper AS superuser, r.rolcreatedb AS createdb, ' +
  'r.rolcreaterole AS createrole, host(inet_server_addr()) AS address, inet_server_port() AS port, ' +
  "current_setting('server_version') AS version " +
  'FROM pg_roles r WHERE r.rolname = current_user';

export interface SessionFacts {
  readonly role: string;
  readonly address: string;
  readonly port: number;
  readonly version: string;
}

/**
 * Asks the session who it is. A superuser session is refused whatever its name; so is a role
 * other than the expected one, and a server that is not on `127.0.0.1:4432`.
 */
export async function verifySession(runner: Pick<StatementRunner, 'run'>, expectedRole: string): Promise<SessionFacts> {
  const rows = await runner.run(VERIFY_SQL);
  const row = rows[0];
  if (row === undefined) {
    throw new DbTestHelperError('ROLE_REFUSED', 'refused: the session could not be identified (no row for current_user).');
  }
  if (row['superuser'] !== false) {
    throw new DbTestHelperError(
      'SUPERUSER_REFUSED',
      'refused: this session is a superuser. The test helper and the code under test never run as one ' +
        `(TI-9, TI-17); expected the role ${expectedRole}.`,
    );
  }
  if (row['role'] !== expectedRole) {
    throw new DbTestHelperError('ROLE_REFUSED', `refused: the session is not the role ${expectedRole}.`);
  }
  if (expectedRole === APP_ROLE && (row['createdb'] !== false || row['createrole'] !== false)) {
    throw new DbTestHelperError('ROLE_REFUSED', `refused: ${APP_ROLE} may create databases or roles; it must hold no such attribute.`);
  }
  if (expectedRole === OWNER_ROLE && row['createrole'] !== false) {
    throw new DbTestHelperError('ROLE_REFUSED', `refused: ${OWNER_ROLE} may create roles; it must not.`);
  }
  if (row['address'] !== PROJECT_DATABASE_HOST || Number(row['port']) !== PROJECT_DATABASE_PORT) {
    throw new DbTestHelperError(
      'ENDPOINT_REFUSED',
      `refused: the server of this session is not on ${PROJECT_DATABASE_HOST}:${PROJECT_DATABASE_PORT}.`,
    );
  }
  return {
    role: expectedRole,
    address: PROJECT_DATABASE_HOST,
    port: PROJECT_DATABASE_PORT,
    version: typeof row['version'] === 'string' ? row['version'] : 'unknown',
  };
}

// ── The helper's own session on the maintenance database ───────────────────────────────────────

/** What the driver hands to a listener of `notification`. */
export interface DriverNotification {
  readonly channel: string;
  readonly payload?: string | undefined;
}

/** What the session needs from a driver client. Tests pass a fake through `clientFactory`. */
export interface DriverClient {
  connect(): Promise<unknown>;
  query(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<unknown>;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'notification', listener: (message: DriverNotification) => void): unknown;
}

export type ClientFactory = (options: DriverOptions) => DriverClient;

/** The real driver. Test support wraps it to inject a refusal; nothing else builds a client. */
export const defaultClientFactory: ClientFactory = (options) => new Client(options);

/** A notification channel is written as a quoted identifier: letters, digits and underscores only. */
const CHANNEL_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export interface OwnerSessionOptions {
  readonly applicationName?: string;
  /** Longest wait for a lock (the clone lock included), in milliseconds. */
  readonly lockTimeoutMs?: number;
  readonly clientFactory?: ClientFactory;
}

function connectFailure(error: unknown): DbTestHelperError {
  const code = errorCode(error);
  if (code === 'ECONNREFUSED') return unreachableError(PROJECT_ENDPOINT, { state: 'closed', code });
  if (code === 'EPERM' || code === 'EACCES') return unreachableError(PROJECT_ENDPOINT, { state: 'blocked', code });
  if (code === '28P01' || code === '28000') {
    return new DbTestHelperError(
      'ROLE_REFUSED',
      `PostgreSQL refused the role of the connection file (SQLSTATE ${code}). The file and the cluster do not belong together; nothing was changed.`,
    );
  }
  return new DbTestHelperError('POSTGRES_UNREACHABLE', `test:db cannot open a session on PostgreSQL: ${errorMessage(error)}`, {
    cause: error,
  });
}

/**
 * One session of `dems_owner` on the maintenance database. Database-level statements, the
 * advisory locks and the catalog reads of the helper go through it, one after the other.
 */
export class OwnerSession implements StatementRunner {
  readonly facts: SessionFacts;
  readonly #client: DriverClient;
  /** Statements go to the driver one at a time; the driver's own queue is not relied on. */
  #queue: Promise<unknown> = Promise.resolve();
  #statements = 0;
  #closed = false;

  private constructor(client: DriverClient, facts: SessionFacts) {
    this.#client = client;
    this.facts = facts;
  }

  static async open(credentials: RoleCredentials, options: OwnerSessionOptions = {}): Promise<OwnerSession> {
    scrubDriverEnvironment();
    if (credentials.user !== OWNER_ROLE) {
      // Covers the superuser's name too; `driverOptions` words that refusal.
      driverOptions(credentials, MAINTENANCE_DATABASE, 'refused');
      throw new DbTestHelperError('ROLE_REFUSED', `refused: the helper's own session is ${OWNER_ROLE}.`);
    }
    const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    if (!Number.isInteger(lockTimeoutMs) || lockTimeoutMs < 1) {
      throw new DbTestHelperError('NAME_INVALID', 'The lock timeout must be a positive integer of milliseconds.');
    }
    const driver = driverOptions(credentials, MAINTENANCE_DATABASE, options.applicationName ?? 'dems-test-helper');
    const client = (options.clientFactory ?? defaultClientFactory)(driver);
    // A session that the server ends must not crash the test process.
    client.on('error', () => undefined);
    try {
      await client.connect();
    } catch (error) {
      throw connectFailure(error);
    }
    let statements = 0;
    const probe: Pick<StatementRunner, 'run'> = {
      async run<R extends Row = Row>(text: string, values?: readonly unknown[]): Promise<R[]> {
        statements += 1;
        return (await client.query(text, values === undefined ? undefined : [...values])).rows as R[];
      },
    };
    try {
      // The first statement of the session. For a superuser it is also the last.
      const facts = await verifySession(probe, OWNER_ROLE);
      await probe.run(`SET lock_timeout = ${lockTimeoutMs}`);
      const session = new OwnerSession(client, facts);
      session.#statements = statements;
      return session;
    } catch (error) {
      await Promise.resolve(client.end()).catch(() => undefined);
      throw error;
    }
  }

  get statementCount(): number {
    return this.#statements;
  }

  get closed(): boolean {
    return this.#closed;
  }

  /**
   * Sends one statement. Calls are served in the order they are made; a statement that waits
   * for a lock therefore holds back every later statement of this session.
   */
  async run<R extends Row = Row>(text: string, values?: readonly unknown[]): Promise<R[]> {
    if (this.#closed) throw new DbTestHelperError('RUN_CLOSED', "The helper's session is closed.");
    this.#statements += 1;
    const sent = this.#queue.then(() => this.#client.query(text, values === undefined ? undefined : [...values]));
    this.#queue = sent.catch(() => undefined);
    return (await sent).rows as R[];
  }

  /**
   * Subscribes the session to a notification channel of the maintenance database; `listener`
   * gets the payload of each notification on it. The server delivers a notification while the
   * session is idle and, at the latest, before it answers the session's next statement.
   */
  async listen(channel: string, listener: (payload: string) => void): Promise<void> {
    if (!CHANNEL_PATTERN.test(channel)) {
      throw new DbTestHelperError('NAME_INVALID', 'A notification channel is 1 to 63 characters of [a-z0-9_] and starts with a letter.');
    }
    this.#client.on('notification', (message) => {
      if (message.channel === channel) listener(message.payload ?? '');
    });
    // A utility statement takes no bind parameter (PG-19); the pattern has limited the name.
    await this.run(`LISTEN "${channel}"`);
  }

  /** Ends the session. Its advisory locks go with it. */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await Promise.resolve(this.#client.end()).catch(() => undefined);
  }
}

// ── Pools on a database of the run ─────────────────────────────────────────────────────────────

export interface RolePoolOptions {
  readonly max: number;
  readonly applicationName: string;
  /**
   * Longest wait for a connection, which in a pool is also the wait for a free one out of `max`.
   * Default `CONNECT_TIMEOUT_MS`; a test file that needs to state a longer one does it through
   * `needs.connectTimeoutMs` (`index.ts`, decision D134). Raise-only where the helper uses it.
   */
  readonly connectTimeoutMs?: number;
}

/**
 * A pool of one project role on a database of the caller's own run. The database name must have
 * passed the guard, so no pool of the helper can point at the demo database, a lane or the
 * maintenance database (TI-17).
 */
export function createRolePool(credentials: RoleCredentials, database: GuardedDatabaseName, options: RolePoolOptions): Pool {
  scrubDriverEnvironment();
  const pool = new Pool({ ...driverOptions(credentials, database, options.applicationName), max: options.max, connectionTimeoutMillis: options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS });
  // Without a listener, an error on an idle connection (a forced drop) would end the process.
  pool.on('error', () => undefined);
  return pool;
}

/** A `StatementRunner` over a pool, for the role check and for tests. */
export function runnerOf(pool: Pool): Pick<StatementRunner, 'run'> {
  return {
    async run<R extends Row = Row>(text: string, values?: readonly unknown[]): Promise<R[]> {
      const result = await pool.query(text, values === undefined ? undefined : [...values]);
      return result.rows as R[];
    },
  };
}

/**
 * Connects once as the runtime role, to the maintenance database, and checks that it is
 * `dems_app` with no superuser, create-database or create-role attribute. Called once per run by
 * the global setup; the code under test then uses the same connection file.
 */
export async function verifyAppRole(credentials: RoleCredentials, clientFactory: ClientFactory = defaultClientFactory): Promise<SessionFacts> {
  scrubDriverEnvironment();
  if (credentials.user !== APP_ROLE) {
    driverOptions(credentials, MAINTENANCE_DATABASE, 'refused');
    throw new DbTestHelperError('ROLE_REFUSED', `refused: the code under test connects as ${APP_ROLE}.`);
  }
  const client = clientFactory(driverOptions(credentials, MAINTENANCE_DATABASE, 'dems-test-role-check'));
  client.on('error', () => undefined);
  try {
    await client.connect();
  } catch (error) {
    throw connectFailure(error);
  }
  try {
    return await verifySession(
      {
        async run<R extends Row = Row>(text: string): Promise<R[]> {
          return (await client.query(text)).rows as R[];
        },
      },
      APP_ROLE,
    );
  } finally {
    await Promise.resolve(client.end()).catch(() => undefined);
  }
}
