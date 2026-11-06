// The connection rules of the test helper, on a fake driver client: no database is involved.
//   - the endpoint and the role are checked before a client exists (D26; TI-9);
//   - a session that is a superuser is refused and closed after its first statement (TI-9, TI-17);
//   - the variables the driver reads on its own are removed.
import { describe, expect, it } from 'vitest';
import { Secret } from '../../../../src/config';
import { APP_ROLE, FOREIGN_PORT, MAINTENANCE_DATABASE, OWNER_ROLE, REFUSED_SUPERUSER_ROLE } from '../constants';
import type { RoleCredentials } from '../credentials';
import { DbTestHelperError } from '../errors';
import {
  OwnerSession,
  driverOptions,
  scrubDriverEnvironment,
  verifyAppRole,
  verifySession,
  type ClientFactory,
  type DriverOptions,
  type Row,
} from '../session';

const PASSWORD_MARKER = 'session-MARKER-0d4be7';

function credentials(overrides: Partial<Record<keyof RoleCredentials, unknown>> = {}): RoleCredentials {
  return {
    host: '127.0.0.1',
    port: 4432,
    database: 'postgres',
    user: OWNER_ROLE,
    password: new Secret(PASSWORD_MARKER),
    ...overrides,
  } as RoleCredentials;
}

function whoAmI(overrides: Row = {}): Row {
  return { role: OWNER_ROLE, superuser: false, createdb: true, createrole: false, address: '127.0.0.1', port: 4432, version: '18.4', ...overrides };
}

interface FakeDriver {
  readonly factory: ClientFactory;
  /** The options of every client that was built. */
  readonly built: DriverOptions[];
  readonly statements: string[];
  connects: number;
  ends: number;
}

function fakeDriver(identity: Row | Error, connectError?: Error & { code?: string }): FakeDriver {
  const driver: FakeDriver = {
    built: [],
    statements: [],
    connects: 0,
    ends: 0,
    factory: (options) => {
      driver.built.push(options);
      return {
        async connect() {
          driver.connects += 1;
          if (connectError !== undefined) throw connectError;
        },
        async query(text: string) {
          driver.statements.push(text);
          if (text.includes('pg_roles')) {
            if (identity instanceof Error) throw identity;
            return { rows: [identity] };
          }
          return { rows: [] };
        },
        async end() {
          driver.ends += 1;
        },
        on() {
          return undefined;
        },
      };
    },
  };
  return driver;
}

async function refusal(action: () => Promise<unknown> | unknown): Promise<DbTestHelperError> {
  try {
    await action();
  } catch (error) {
    if (error instanceof DbTestHelperError) return error;
    throw error;
  }
  throw new Error('not refused');
}

describe('D26: every connection carries the endpoint explicitly', () => {
  it('hands the driver five discrete fields, TLS off, and no copy of the password', () => {
    const options = driverOptions(credentials(), 'dems_test_local_abcdefgh_f01_x', 'unit');
    expect({ ...options, password: undefined }).toEqual({
      host: '127.0.0.1',
      port: 4432,
      database: 'dems_test_local_abcdefgh_f01_x',
      user: OWNER_ROLE,
      password: undefined,
      ssl: false,
      application_name: 'unit',
      connectionTimeoutMillis: 5000,
    });
    expect(typeof options.password).toBe('function');
    expect(options.password()).toBe(PASSWORD_MARKER);
    expect(JSON.stringify(options)).not.toContain(PASSWORD_MARKER);
  });

  it.each([
    ['the foreign default port', { port: FOREIGN_PORT }],
    ['another port', { port: 4433 }],
    ['localhost', { host: 'localhost' }],
    ['IPv6 loopback', { host: '::1' }],
    ['no host', { host: undefined }],
    ['no port', { port: undefined }],
  ])('refuses %s before a client is built', async (_label, overrides) => {
    const driver = fakeDriver(whoAmI());
    const error = await refusal(() => OwnerSession.open(credentials(overrides), { clientFactory: driver.factory }));
    expect(error.code).toBe('ENDPOINT_REFUSED');
    expect(driver.built).toHaveLength(0);
    expect(driver.connects).toBe(0);
    expect(driver.statements).toHaveLength(0);
  });

  it('removes the variables the driver reads on its own, and returns their names only', () => {
    const env: Record<string, string | undefined> = {
      PGHOST: 'example.org',
      PGPORT: String(FOREIGN_PORT),
      PGUSER: 'someone',
      PGDATABASE: 'elsewhere',
      PGSSLMODE: 'require',
      PGOPTIONS: '-c x=y',
      PG: 'x',
      PATH: '/usr/bin',
      DEMS_PG_HOST: '127.0.0.1',
      pghost: 'lower-case is not a driver variable',
    };
    expect(scrubDriverEnvironment(env)).toEqual(['PG', 'PGDATABASE', 'PGHOST', 'PGOPTIONS', 'PGPORT', 'PGSSLMODE', 'PGUSER']);
    expect(Object.keys(env).sort()).toEqual(['DEMS_PG_HOST', 'PATH', 'pghost']);
  });
});

describe('TI-9: the roles the helper may connect as', () => {
  it('refuses the bootstrap superuser by name before a client is built', async () => {
    const driver = fakeDriver(whoAmI());
    const owner = await refusal(() => OwnerSession.open(credentials({ user: REFUSED_SUPERUSER_ROLE }), { clientFactory: driver.factory }));
    expect(owner.code).toBe('ROLE_REFUSED');
    expect(owner.message).toContain('never connects as the bootstrap superuser');
    const app = await refusal(() => verifyAppRole(credentials({ user: REFUSED_SUPERUSER_ROLE }), driver.factory));
    expect(app.code).toBe('ROLE_REFUSED');
    expect(await refusal(() => driverOptions(credentials({ user: REFUSED_SUPERUSER_ROLE }), 'x', 'unit'))).toMatchObject({ code: 'ROLE_REFUSED' });
    expect(driver.built).toHaveLength(0);
    expect(driver.connects).toBe(0);
  });

  it('refuses any role that is not one of the two project roles', async () => {
    const driver = fakeDriver(whoAmI());
    for (const user of ['postgres', 'root', '', 'dems_owner2']) {
      expect((await refusal(() => driverOptions(credentials({ user }), 'x', 'unit'))).code).toBe('ROLE_REFUSED');
      expect((await refusal(() => OwnerSession.open(credentials({ user }), { clientFactory: driver.factory }))).code).toBe('ROLE_REFUSED');
    }
    // The helper's own session is the owner role; the runtime role is not accepted for it.
    expect((await refusal(() => OwnerSession.open(credentials({ user: APP_ROLE }), { clientFactory: driver.factory }))).code).toBe('ROLE_REFUSED');
    expect((await refusal(() => verifyAppRole(credentials({ user: OWNER_ROLE }), driver.factory))).code).toBe('ROLE_REFUSED');
    expect(driver.built).toHaveLength(0);
  });

  it('opens the session on the maintenance database and asks who it is first', async () => {
    const driver = fakeDriver(whoAmI());
    const session = await OwnerSession.open(credentials(), { clientFactory: driver.factory, lockTimeoutMs: 1500 });
    expect(driver.built).toHaveLength(1);
    expect(driver.built[0]?.database).toBe(MAINTENANCE_DATABASE);
    expect(driver.built[0]?.host).toBe('127.0.0.1');
    expect(driver.built[0]?.port).toBe(4432);
    expect(driver.statements[0]).toContain('rolsuper');
    expect(driver.statements[1]).toBe('SET lock_timeout = 1500');
    expect(session.statementCount).toBe(2);
    expect(session.facts).toEqual({ role: OWNER_ROLE, address: '127.0.0.1', port: 4432, version: '18.4' });
    await session.run('SELECT 1');
    expect(session.statementCount).toBe(3);
    await session.close();
    await session.close();
    expect(driver.ends).toBe(1);
    expect((await refusal(() => session.run('SELECT 1'))).code).toBe('RUN_CLOSED');
  });
});

describe('TI-9, TI-17: a superuser session is refused', () => {
  it('the helper closes a session that reports rolsuper, after its first statement', async () => {
    const driver = fakeDriver(whoAmI({ superuser: true }));
    const error = await refusal(() => OwnerSession.open(credentials(), { clientFactory: driver.factory }));
    expect(error.code).toBe('SUPERUSER_REFUSED');
    expect(error.message).toContain('this session is a superuser');
    // One statement was sent, the question itself; then the session was closed.
    expect(driver.statements).toHaveLength(1);
    expect(driver.statements[0]).toContain('rolsuper');
    expect(driver.ends).toBe(1);
  });

  it('a superuser is refused whatever name it carries, and so is an unknown answer', async () => {
    expect((await refusal(() => verifySession({ run: async () => [whoAmI({ superuser: true })] as never }, OWNER_ROLE))).code).toBe('SUPERUSER_REFUSED');
    expect((await refusal(() => verifySession({ run: async () => [whoAmI({ superuser: null })] as never }, OWNER_ROLE))).code).toBe('SUPERUSER_REFUSED');
    expect((await refusal(() => verifySession({ run: async () => [whoAmI({ superuser: 't' })] as never }, OWNER_ROLE))).code).toBe('SUPERUSER_REFUSED');
    expect((await refusal(() => verifySession({ run: async () => [] as never }, OWNER_ROLE))).code).toBe('ROLE_REFUSED');
  });

  it('the runtime role is checked in the same way and must hold no attribute', async () => {
    const superuser = fakeDriver(whoAmI({ role: APP_ROLE, superuser: true, createdb: false }));
    expect((await refusal(() => verifyAppRole(credentials({ user: APP_ROLE }), superuser.factory))).code).toBe('SUPERUSER_REFUSED');
    expect(superuser.ends).toBe(1);
    const createdb = fakeDriver(whoAmI({ role: APP_ROLE, createdb: true }));
    expect((await refusal(() => verifyAppRole(credentials({ user: APP_ROLE }), createdb.factory))).code).toBe('ROLE_REFUSED');
    const good = fakeDriver(whoAmI({ role: APP_ROLE, createdb: false }));
    expect((await verifyAppRole(credentials({ user: APP_ROLE }), good.factory)).role).toBe(APP_ROLE);
    expect(good.built[0]?.database).toBe(MAINTENANCE_DATABASE);
    expect(good.ends).toBe(1);
  });

  it('refuses a session that is another role, or a server on another address or port', async () => {
    expect((await refusal(() => verifySession({ run: async () => [whoAmI({ role: APP_ROLE })] as never }, OWNER_ROLE))).code).toBe('ROLE_REFUSED');
    expect((await refusal(() => verifySession({ run: async () => [whoAmI({ createrole: true })] as never }, OWNER_ROLE))).code).toBe('ROLE_REFUSED');
    expect((await refusal(() => verifySession({ run: async () => [whoAmI({ port: FOREIGN_PORT })] as never }, OWNER_ROLE))).code).toBe('ENDPOINT_REFUSED');
    expect((await refusal(() => verifySession({ run: async () => [whoAmI({ address: '10.0.0.5' })] as never }, OWNER_ROLE))).code).toBe('ENDPOINT_REFUSED');
  });
});

describe('TI-1: a connection that fails', () => {
  it('a refused connection says how to start the server', async () => {
    const driver = fakeDriver(whoAmI(), Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:4432'), { code: 'ECONNREFUSED' }));
    const error = await refusal(() => OwnerSession.open(credentials(), { clientFactory: driver.factory }));
    expect(error.code).toBe('POSTGRES_UNREACHABLE');
    expect(error.message).toContain('npm run pg:start');
    expect(error.message).not.toContain(PASSWORD_MARKER);
  });

  it('a sandbox refusal is named as such', async () => {
    const driver = fakeDriver(whoAmI(), Object.assign(new Error('connect EPERM 127.0.0.1:4432'), { code: 'EPERM' }));
    const error = await refusal(() => OwnerSession.open(credentials(), { clientFactory: driver.factory }));
    expect(error.code).toBe('POSTGRES_UNREACHABLE');
    expect(error.message).toContain('sandbox');
  });

  it('a wrong password is reported by its SQLSTATE, without a value', async () => {
    const driver = fakeDriver(whoAmI(), Object.assign(new Error('password authentication failed'), { code: '28P01' }));
    const error = await refusal(() => OwnerSession.open(credentials(), { clientFactory: driver.factory }));
    expect(error.code).toBe('ROLE_REFUSED');
    expect(error.message).toContain('28P01');
    expect(error.message).not.toContain(PASSWORD_MARKER);
  });
});
