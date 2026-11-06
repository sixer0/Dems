/**
 * Test support (not a test file): a stand-in for the PostgreSQL cluster, behind the driver
 * seam of the helper (`clientFactory`). It understands exactly the statements the helper
 * issues, keeps a catalog of databases in memory and records every statement it receives.
 *
 * With it the database-free project proves what the helper SENDS: which statements, in which
 * order, naming which databases; and what it never sends. The database project proves the same
 * against the real server.
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_ROLE, OWNER_ROLE } from '../constants';
import { APP_FILE_KEYS, APP_FILE_NAME, OWNER_FILE_KEYS, OWNER_FILE_NAME } from '../credentials';
import type { ClientFactory, DriverNotification, DriverOptions, Row } from '../session';

export interface FakeDatabase {
  name: string;
  owner: string;
  isTemplate: boolean;
  allowConnections: boolean;
  /** Client sessions on the database, by role (and, where a test says so, by application name). */
  sessions: Array<{ role: string; sessions: number; application?: string }>;
  /**
   * Backends without a role on the database: an autovacuum worker. As in PostgreSQL, a forced
   * drop by the owner role is refused while one is there.
   */
  background: number;
  /** After this many more refused drops the background backends have left. Unset: they stay. */
  backgroundLeavesAfter?: number | undefined;
  /**
   * The next forced drops that are refused although nothing is left on the database when the
   * helper looks: the backend came and went within the statement.
   */
  refuseNextDrops: number;
}

export interface RecordedStatement {
  readonly text: string;
  readonly values: readonly unknown[];
}

const DATABASE_STATEMENT = /^(?:CREATE|ALTER|DROP) DATABASE\b/;

export class FakeCluster {
  readonly databases = new Map<string, FakeDatabase>();
  readonly statements: RecordedStatement[] = [];
  /** The options of every client the helper built. */
  readonly clients: DriverOptions[] = [];
  /** Liveness keys held by "another session": `pg_try_advisory_lock` on them gives false. */
  readonly locksHeldElsewhere = new Set<number>();
  /**
   * What a read of the clone-lock queue answers: how many sessions OTHER than the reader's hold
   * or wait for the clone lock (decision D134). 0 is a quiet cluster.
   */
  cloneLockBusyElsewhere = 0;
  /** How often the helper has read the clone-lock queue so far. */
  cloneLockReads = 0;
  /** Liveness keys held by a session of the helper: key to session number. Released at `end()`. */
  readonly #heldLocks = new Map<number, number>();
  /** What each session listens to, and whom it tells: session number to channels and listeners. */
  readonly #subscriptions = new Map<number, { channels: Set<string>; listeners: Array<(message: DriverNotification) => void> }>();
  /** Called with every statement before it is executed: a test changes the cluster "meanwhile". */
  beforeStatement: ((text: string) => void) | undefined;
  #sessions = 0;
  /** What the session reports about itself. A test changes it to play a superuser. */
  identity: Row = {
    role: OWNER_ROLE,
    superuser: false,
    createdb: true,
    createrole: false,
    address: '127.0.0.1',
    port: 4432,
    version: '18.4 (fake)',
  };

  constructor(names: readonly string[] = []) {
    // What a fresh project cluster holds, plus what the test adds.
    for (const name of ['postgres', 'template0', 'template1', ...names]) this.add(name);
    const template0 = this.databases.get('template0');
    const template1 = this.databases.get('template1');
    if (template0 !== undefined) Object.assign(template0, { isTemplate: true, allowConnections: false });
    if (template1 !== undefined) Object.assign(template1, { isTemplate: true });
  }

  add(name: string, fields: Partial<FakeDatabase> = {}): FakeDatabase {
    const database: FakeDatabase = {
      name,
      owner: OWNER_ROLE,
      isTemplate: false,
      allowConnections: true,
      sessions: [],
      background: 0,
      refuseNextDrops: 0,
      ...fields,
    };
    this.databases.set(name, database);
    return database;
  }

  /** The names of all databases, sorted. */
  names(): string[] {
    return [...this.databases.keys()].sort();
  }

  /** The texts of the statements that create, change or drop a database, in order. */
  databaseStatements(): string[] {
    return this.statements.map((statement) => statement.text).filter((text) => DATABASE_STATEMENT.test(text));
  }

  /** Every database name that a `CREATE`, `ALTER` or `DROP DATABASE` statement mentioned. */
  namesInDatabaseStatements(): string[] {
    const names = new Set<string>();
    for (const text of this.databaseStatements()) {
      for (const match of text.matchAll(/"([^"]+)"/g)) {
        if (match[1] !== undefined && match[1] !== OWNER_ROLE) names.add(match[1]);
      }
    }
    return [...names].sort();
  }

  readonly factory: ClientFactory = (options) => {
    this.clients.push(options);
    this.#sessions += 1;
    const session = this.#sessions;
    const subscription = { channels: new Set<string>(), listeners: [] as Array<(message: DriverNotification) => void> };
    this.#subscriptions.set(session, subscription);
    return {
      connect: async () => undefined,
      // As in PostgreSQL: the advisory locks and the subscriptions of a session go when it ends.
      end: async () => {
        for (const [key, holder] of this.#heldLocks) if (holder === session) this.#heldLocks.delete(key);
        this.#subscriptions.delete(session);
      },
      on: (event: 'error' | 'notification', listener: ((error: Error) => void) | ((message: DriverNotification) => void)) => {
        if (event === 'notification') subscription.listeners.push(listener as (message: DriverNotification) => void);
        return undefined;
      },
      query: async (text: string, values: unknown[] = []) => ({ rows: this.#execute(session, text, values) }),
    };
  };

  /** The channels that sessions of the helper listen to, sorted. */
  listenedChannels(): string[] {
    return [...new Set([...this.#subscriptions.values()].flatMap((subscription) => [...subscription.channels]))].sort();
  }

  /** A session-level advisory lock that is tried, not waited for: re-entrant within a session. */
  #tryLock(session: number, key: number): boolean {
    if (this.locksHeldElsewhere.has(key)) return false;
    const holder = this.#heldLocks.get(key);
    if (holder !== undefined && holder !== session) return false;
    this.#heldLocks.set(key, session);
    return true;
  }

  #row(database: FakeDatabase): Row {
    return { name: database.name, owner: database.owner, isTemplate: database.isTemplate, allowConnections: database.allowConnections };
  }

  #existing(name: string | undefined, code: string): FakeDatabase {
    const database = name === undefined ? undefined : this.databases.get(name);
    if (database === undefined) throw Object.assign(new Error(`database "${name}" does not exist`), { code });
    return database;
  }

  #refusedToTerminate(): Error {
    return Object.assign(new Error('permission denied to terminate process'), { code: '42501' });
  }

  #execute(session: number, text: string, values: unknown[]): Row[] {
    this.beforeStatement?.(text);
    this.statements.push({ text, values });
    if (text.includes('FROM pg_roles r WHERE r.rolname = current_user')) return [this.identity];
    if (text.startsWith('SET lock_timeout = ')) return [];
    const listen = /^LISTEN "([a-z][a-z0-9_]*)"$/.exec(text);
    if (listen !== null) {
      this.#subscriptions.get(session)?.channels.add(listen[1] ?? '');
      return [];
    }
    if (text.includes('pg_notify($1, $2)')) {
      const message: DriverNotification = { channel: String(values[0]), payload: String(values[1]) };
      // As in PostgreSQL: every session that listens to the channel is told, whoever sent it.
      for (const subscription of this.#subscriptions.values()) {
        if (subscription.channels.has(message.channel)) for (const listener of subscription.listeners) listener(message);
      }
      return [{}];
    }
    // The clone-lock queue (decision D134): what the stand-in answers about the other sessions.
    if (text.includes('FROM pg_locks')) {
      this.cloneLockReads += 1;
      return [{ others: this.cloneLockBusyElsewhere }];
    }
    // Every backend on a database, by role and application: the ones without a role first.
    if (text.includes('FROM pg_stat_activity') && text.includes('AS backends')) {
      const database = this.databases.get(String(values[0]));
      if (database === undefined) return [];
      const groups: Row[] = database.background > 0 ? [{ role: null, application: '', backends: database.background }] : [];
      for (const group of [...database.sessions].sort((a, b) => a.role.localeCompare(b.role))) {
        groups.push({ role: group.role, application: group.application ?? '', backends: group.sessions });
      }
      return groups;
    }
    if (text.includes('FROM pg_database d') && text.includes('starts_with(d.datname, $1)')) {
      const prefix = String(values[0]);
      return this.names()
        .filter((name) => name.startsWith(prefix))
        .map((name) => this.#row(this.#existing(name, '3D000')));
    }
    if (text.includes('FROM pg_database d') && text.includes('d.datname = $1')) {
      const database = this.databases.get(String(values[0]));
      return database === undefined ? [] : [this.#row(database)];
    }
    if (text.includes('FROM pg_stat_activity') && text.includes('datname = $1')) {
      return (this.databases.get(String(values[0]))?.sessions ?? []).map((session) => ({ ...session }));
    }
    if (text.includes('FROM pg_stat_activity') && text.includes('starts_with(datname, $1)')) {
      const prefix = String(values[0]);
      const roles = new Set<string>();
      for (const database of this.databases.values()) {
        if (database.name.startsWith(prefix)) for (const session of database.sessions) roles.add(session.role);
      }
      return [...roles].sort().map((role) => ({ role }));
    }
    if (text.includes('pg_try_advisory_lock')) return [{ locked: this.#tryLock(session, Number(values[1])) }];
    if (text.includes('pg_advisory_unlock')) {
      if (this.#heldLocks.get(Number(values[1])) === session) this.#heldLocks.delete(Number(values[1]));
      return [{}];
    }
    // The clone lock is waited for in PostgreSQL; here it is always free (one process, one queue).
    if (text.includes('pg_advisory_lock')) return [{}];

    const fromEmpty = /^CREATE DATABASE "([^"]+)" OWNER "([^"]+)" TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'$/.exec(text);
    if (fromEmpty !== null) {
      if (this.databases.has(fromEmpty[1] ?? '')) throw Object.assign(new Error('database already exists'), { code: '42P04' });
      this.add(fromEmpty[1] ?? '', { owner: fromEmpty[2] ?? '' });
      return [];
    }
    const clone = /^CREATE DATABASE "([^"]+)" TEMPLATE "([^"]+)" OWNER "([^"]+)"$/.exec(text);
    if (clone !== null) {
      const source = this.#existing(clone[2], '3D000');
      if (source.sessions.length > 0) throw Object.assign(new Error('source database is being accessed by other users'), { code: '55006' });
      if (this.databases.has(clone[1] ?? '')) throw Object.assign(new Error('database already exists'), { code: '42P04' });
      this.add(clone[1] ?? '', { owner: clone[3] ?? '' });
      return [];
    }
    const lock = /^ALTER DATABASE "([^"]+)" WITH IS_TEMPLATE true ALLOW_CONNECTIONS false$/.exec(text);
    if (lock !== null) {
      Object.assign(this.#existing(lock[1], '3D000'), { isTemplate: true, allowConnections: false });
      return [];
    }
    const unlock = /^ALTER DATABASE "([^"]+)" WITH IS_TEMPLATE false$/.exec(text);
    if (unlock !== null) {
      this.#existing(unlock[1], '3D000').isTemplate = false;
      return [];
    }
    const drop = /^DROP DATABASE IF EXISTS "([^"]+)" WITH \(FORCE\)$/.exec(text);
    if (drop !== null) {
      const database = this.databases.get(drop[1] ?? '');
      if (database === undefined) return [];
      if (database.isTemplate) throw Object.assign(new Error('cannot drop a template database'), { code: '42809' });
      if (database.refuseNextDrops > 0) {
        database.refuseNextDrops -= 1;
        throw this.#refusedToTerminate();
      }
      // The server checks every backend before it ends one: a single backend that the owner role
      // may not end refuses the whole statement, and the sessions of the owner role stay too.
      if (database.background > 0) {
        if (database.backgroundLeavesAfter !== undefined) {
          database.backgroundLeavesAfter -= 1;
          if (database.backgroundLeavesAfter <= 0) {
            database.background = 0;
            database.backgroundLeavesAfter = undefined;
          }
        }
        throw this.#refusedToTerminate();
      }
      if (database.sessions.some((session) => session.role !== OWNER_ROLE)) throw this.#refusedToTerminate();
      this.databases.delete(database.name);
      return [];
    }
    throw new Error(`fake cluster: a statement the helper is not expected to send: ${text}`);
  }
}

/** A data directory with two connection files that hold marker values, never real ones. */
export function fakeDataDir(): { readonly dir: string; remove(): void } {
  const dir = mkdtempSync(join(tmpdir(), 'dems-w11-fake-data-'));
  chmodSync(dir, 0o700);
  const write = (file: string, keys: typeof OWNER_FILE_KEYS, database: string, role: string, marker: string): void => {
    const text = [
      `${keys.host}=127.0.0.1`,
      `${keys.port}=4432`,
      `${keys.database}=${database}`,
      `${keys.user}=${role}`,
      `${keys.password}=${marker}`,
      '',
    ].join('\n');
    writeFileSync(join(dir, file), text, { mode: 0o600 });
    chmodSync(join(dir, file), 0o600);
  };
  write(OWNER_FILE_NAME, OWNER_FILE_KEYS, 'postgres', OWNER_ROLE, 'fake-owner-MARKER');
  write(APP_FILE_NAME, APP_FILE_KEYS, 'dems_demo', APP_ROLE, 'fake-app-MARKER');
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}
