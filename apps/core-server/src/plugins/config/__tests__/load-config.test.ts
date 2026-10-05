// Configuration loader (plan row W08): the three environment values, the runtime connection
// file with its mode check (T-CR-4, CR-1 to CR-3), the endpoint rules of decision D26 / F27,
// and the rule that a secret cannot be printed by accident.
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import * as sharedApi from '@dems/shared/api';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_LISTEN_PORT,
  FOREIGN_DATABASE_PORT,
  LISTEN_HOST,
  SERVICE_NAME,
  Secret,
  WEB_CONSOLE_ORIGINS,
  createConfig,
  databaseNameFor,
  ownOriginsFor,
  parseDemoControls,
  parseListenPort,
  parseLogLevel,
  sessionCookieNameFor,
} from '../../../config';
import { DEFAULT_DATA_DIR, loadConfig } from '../index';

const PASSWORD_MARKER = 'pw-MARKER-7f3a91';
const OTHER_FILE_MARKER = 'other-MARKER-55c0de';

/** The names of the two credential files the server must never open, built so that this file
 *  does not hold them as text (the static tests search for them). */
const SUPERUSER_FILE = ['pg', 'pwfile'].join('.');
const OWNER_FILE = ['pg', 'owner', 'env'].join('.');

const dirs: string[] = [];

interface FileFields {
  host?: string;
  port?: string;
  database?: string;
  role?: string;
  password?: string;
}

function connectionText(fields: FileFields = {}): string {
  return [
    `DEMS_PG_HOST=${fields.host ?? '127.0.0.1'}`,
    `DEMS_PG_PORT=${fields.port ?? '4432'}`,
    `DEMS_PG_DATABASE=${fields.database ?? 'dems_demo'}`,
    `DEMS_PG_APP_ROLE=${fields.role ?? 'dems_app'}`,
    `DEMS_PG_APP_PASSWORD=${fields.password ?? PASSWORD_MARKER}`,
    '',
  ].join('\n');
}

/** A data directory under the temporary directory with a connection file of the given mode. */
function dataDir(text: string = connectionText(), mode = 0o600): string {
  const dir = mkdtempSync(join(tmpdir(), 'dems-w08-config-'));
  dirs.push(dir);
  const file = join(dir, 'pg.env');
  writeFileSync(file, text, { mode });
  chmodSync(file, mode);
  return dir;
}

function failure(run: () => unknown): ConfigError {
  try {
    run();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected a ConfigError');
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('the three environment values', () => {
  it('DEMS_CORE_PORT: 4420 by default, 4421 to 4423 for a lane, anything else stops the boot', () => {
    expect(parseListenPort(undefined)).toBe(4420);
    expect(parseListenPort('')).toBe(4420);
    expect(['4420', '4421', '4422', '4423'].map(parseListenPort)).toEqual([4420, 4421, 4422, 4423]);
    for (const bad of ['4419', '4424', '4400', '80', '0', '44200', ' 4420', '4420 ', '4420.0', '0x1144', 'abc']) {
      expect(failure(() => parseListenPort(bad)).code, bad).toBe('LISTEN_PORT_NOT_ALLOWED');
    }
  });

  it('DEMS_DEMO_CONTROLS: off by default, on only with 1', () => {
    expect([undefined, '', '0'].map(parseDemoControls)).toEqual([false, false, false]);
    expect(parseDemoControls('1')).toBe(true);
    for (const bad of ['true', 'yes', 'on', '2', ' 1']) {
      expect(failure(() => parseDemoControls(bad)).code, bad).toBe('DEMO_FLAG_INVALID');
    }
  });

  it('DEMS_LOG_LEVEL: info by default; an unknown level stops the boot', () => {
    expect(parseLogLevel(undefined)).toBe('info');
    expect(parseLogLevel('debug')).toBe('debug');
    expect(failure(() => parseLogLevel('verbose')).code).toBe('LOG_LEVEL_INVALID');
  });

  it('a wrong port is reported before any file is opened', () => {
    const error = failure(() => loadConfig({ env: { DEMS_CORE_PORT: '9999' }, dataDir: '/nonexistent/dir' }));
    expect(error.code).toBe('LISTEN_PORT_NOT_ALLOWED');
  });
});

describe('the configuration object', () => {
  it('has the constant host, the port, both origin lists and the cookie name of the instance', () => {
    const config = loadConfig({ env: {}, dataDir: dataDir() });
    expect(config.host).toBe('127.0.0.1');
    expect(config.host).toBe(LISTEN_HOST);
    expect(config.port).toBe(4420);
    expect(config.demoControls).toBe(false);
    expect(config.logLevel).toBe('info');
    expect(config.webConsoleOrigins).toEqual([
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5176',
      'http://127.0.0.1:5177',
      'http://127.0.0.1:5178',
    ]);
    expect(config.ownOrigins).toEqual(['http://127.0.0.1:4420']);
    expect(config.sessionCookieName).toBe('dems_session_4420');
    expect(config.database).toMatchObject({ host: '127.0.0.1', port: 4432, database: 'dems_demo', user: 'dems_app' });
    expect(config.database.password.reveal()).toBe(PASSWORD_MARKER);
  });

  it('a lane instance: its own origin is added, and the cookie and the database follow the port', () => {
    const config = loadConfig({
      env: { DEMS_CORE_PORT: '4422', DEMS_DEMO_CONTROLS: '1', DEMS_LOG_LEVEL: 'warn' },
      // The database named in the file is a default, not the last word.
      dataDir: dataDir(connectionText({ database: 'dems_demo' })),
    });
    expect(config.port).toBe(4422);
    expect(config.demoControls).toBe(true);
    expect(config.logLevel).toBe('warn');
    expect(config.ownOrigins).toEqual(['http://127.0.0.1:4420', 'http://127.0.0.1:4422']);
    expect(config.sessionCookieName).toBe('dems_session_4422');
    expect(config.database.database).toBe('dems_lane_2');
  });

  it('the derivations: database by port, own origins, cookie name', () => {
    expect([4420, 4421, 4422, 4423].map((port) => databaseNameFor(parseListenPort(String(port))))).toEqual([
      'dems_demo',
      'dems_lane_1',
      'dems_lane_2',
      'dems_lane_3',
    ]);
    expect(ownOriginsFor(4423)).toEqual(['http://127.0.0.1:4420', 'http://127.0.0.1:4423']);
    expect(sessionCookieNameFor(4421)).toBe('dems_session_4421');
  });

  it('no origin list holds a localhost entry (OR-7)', () => {
    const all = [...WEB_CONSOLE_ORIGINS, ...ownOriginsFor(4420), ...ownOriginsFor(4423)];
    expect(all.filter((origin) => origin.includes('localhost'))).toEqual([]);
    expect(all.every((origin) => origin.startsWith('http://127.0.0.1:'))).toBe(true);
  });

  it('is frozen', () => {
    const config = loadConfig({ env: {}, dataDir: dataDir() });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.database)).toBe(true);
  });

  it('the default data directory is <workspace root>/.data', () => {
    expect(DEFAULT_DATA_DIR.endsWith('/.data')).toBe(true);
    expect(DEFAULT_DATA_DIR.includes('/apps/')).toBe(false);
  });
});

describe('the connection file (T-CR-4, CR-1 to CR-3)', () => {
  it('a file of mode 0644 stops the loader, which names the file and the mode and prints no content', () => {
    const dir = dataDir(connectionText(), 0o644);
    const error = failure(() => loadConfig({ env: {}, dataDir: dir }));
    expect(error.code).toBe('CONNECTION_FILE_MODE');
    expect(error.message).toContain(join(dir, 'pg.env'));
    expect(error.message).toContain('mode 644');
    expect(error.message).toContain('expected 600');
    expect(error.message).toContain('Nothing was read');
    expect(error.message).not.toContain(PASSWORD_MARKER);
    expect(String(error.stack)).not.toContain(PASSWORD_MARKER);
  });

  it.each([0o640, 0o604, 0o660, 0o666, 0o610, 0o601, 0o620, 0o602])(
    'mode %o (any access for group or others) stops the loader',
    (mode) => {
      expect(failure(() => loadConfig({ env: {}, dataDir: dataDir(connectionText(), mode) })).code).toBe(
        'CONNECTION_FILE_MODE',
      );
    },
  );

  it('mode 0600 and mode 0400 are accepted', () => {
    expect(loadConfig({ env: {}, dataDir: dataDir(connectionText(), 0o600) }).database.port).toBe(4432);
    expect(loadConfig({ env: {}, dataDir: dataDir(connectionText(), 0o400) }).database.port).toBe(4432);
  });

  it('a missing file stops the loader and names the provisioning command', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dems-w08-config-'));
    dirs.push(dir);
    const error = failure(() => loadConfig({ env: {}, dataDir: dir }));
    expect(error.code).toBe('CONNECTION_FILE_MISSING');
    expect(error.message).toContain('npm run pg:init');
  });

  it('never opens the two other credential files: it works while both are unreadable', () => {
    const dir = dataDir();
    for (const name of [SUPERUSER_FILE, OWNER_FILE]) {
      const file = join(dir, name);
      writeFileSync(file, `${OTHER_FILE_MARKER}\n`, { mode: 0o000 });
      chmodSync(file, 0o000);
    }
    const config = loadConfig({ env: { DEMS_DEMO_CONTROLS: '1' }, dataDir: dir });
    expect(config.database.user).toBe('dems_app');
    expect(JSON.stringify(config)).not.toContain(OTHER_FILE_MARKER);
  });

  it.each([
    ['a line that is not KEY=value', `${connectionText()}just text\n`, 'is not KEY=value'],
    ['an unexpected key', `${connectionText()}DEMS_PG_EXTRA=1\n`, 'unexpected key DEMS_PG_EXTRA'],
    ['a key that appears twice', `${connectionText()}DEMS_PG_HOST=127.0.0.1\n`, 'key DEMS_PG_HOST appears twice'],
    ['a missing key', connectionText().replace(/^DEMS_PG_PORT=.*\n/m, ''), 'key DEMS_PG_PORT is missing or empty'],
    ['an empty value', connectionText({ password: '' }), 'key DEMS_PG_APP_PASSWORD is missing or empty'],
    ['a comment line', `# comment\n${connectionText()}`, 'is not KEY=value'],
  ])('%s stops the loader with a message that holds no value', (_label, text, expected) => {
    const error = failure(() => loadConfig({ env: {}, dataDir: dataDir(text) }));
    expect(error.code).toBe('CONNECTION_FILE_FORMAT');
    expect(error.message).toContain(expected);
    expect(error.message).not.toContain(PASSWORD_MARKER);
  });

  it('a role other than dems_app stops the loader', () => {
    const error = failure(() => loadConfig({ env: {}, dataDir: dataDir(connectionText({ role: 'dems_owner' })) }));
    expect(error.code).toBe('CONNECTION_FILE_ROLE');
    expect(error.message).toContain('DEMS_PG_APP_ROLE must be dems_app');
  });
});

describe('the database endpoint (decision D26, finding F27)', () => {
  it.each(['localhost', '0.0.0.0', '::1', '127.0.0.2', '192.168.1.10', 'db.example'])(
    'host %s is refused: loopback IPv4 only',
    (host) => {
      const error = failure(() => loadConfig({ env: {}, dataDir: dataDir(connectionText({ host })) }));
      expect(error.code).toBe('DATABASE_HOST_NOT_LOOPBACK');
    },
  );

  it("PostgreSQL's default port is refused: it is another server on this host", () => {
    const error = failure(() =>
      loadConfig({ env: {}, dataDir: dataDir(connectionText({ port: String(FOREIGN_DATABASE_PORT) })) }),
    );
    expect(error.code).toBe('DATABASE_PORT_FOREIGN');
  });

  it.each(['', 'abc', '0', '65536', '4432x', '-1'])('port "%s" is refused', (port) => {
    const error = failure(() => loadConfig({ env: {}, dataDir: dataDir(connectionText({ port })) }));
    expect(['DATABASE_PORT_INVALID', 'CONNECTION_FILE_FORMAT']).toContain(error.code);
  });

  it('createConfig applies the same endpoint rules to a hand-built configuration', () => {
    const base = {
      port: DEFAULT_LISTEN_PORT,
      demoControls: false,
      logLevel: 'silent' as const,
      dataDir: '/nonexistent',
    };
    const database = { host: '127.0.0.1', port: 4432, database: 'd', user: 'u', password: new Secret('p') };
    expect(createConfig({ ...base, database }).database.port).toBe(4432);
    expect(failure(() => createConfig({ ...base, database: { ...database, host: 'localhost' } })).code).toBe(
      'DATABASE_HOST_NOT_LOOPBACK',
    );
    expect(
      failure(() => createConfig({ ...base, database: { ...database, port: FOREIGN_DATABASE_PORT } })).code,
    ).toBe('DATABASE_PORT_FOREIGN');
    expect(failure(() => createConfig({ ...base, database: { ...database, user: '' } })).code).toBe(
      'DATABASE_FIELD_EMPTY',
    );
  });
});

describe('a secret cannot be printed by accident', () => {
  it('JSON, string conversion and inspect give "[redacted]"; only reveal() gives the value', () => {
    const config = loadConfig({ env: {}, dataDir: dataDir() });
    const printed = [
      JSON.stringify(config),
      inspect(config, { depth: 10 }),
      inspect(config.database.password, { showHidden: true }),
      String(config.database.password),
      `${config.database.password}`,
      JSON.stringify({ password: config.database.password }),
    ];
    for (const text of printed) expect(text).not.toContain(PASSWORD_MARKER);
    expect(JSON.stringify(config)).toContain('[redacted]');
    expect(Object.keys(config.database.password)).toEqual([]);
    expect(config.database.password.reveal()).toBe(PASSWORD_MARKER);
  });
});

describe('server constants and the shared contract', () => {
  it('the service name is dems-core-server', () => {
    expect(SERVICE_NAME).toBe('dems-core-server');
  });

  // `config.ts` is frozen and holds the server's own values; the shared contract holds the same
  // ones for the clients. This test keeps the two together.
  it('equals the shared CORE_SERVER_* constants', () => {
    expect({
      CORE_SERVER_HOST: sharedApi.CORE_SERVER_HOST,
      CORE_SERVER_PORT: sharedApi.CORE_SERVER_PORT,
      CORE_SERVER_HTTP_ORIGIN: sharedApi.CORE_SERVER_HTTP_ORIGIN,
      CORE_SERVER_WS_URL: sharedApi.CORE_SERVER_WS_URL,
      CORE_SERVER_SERVICE_NAME: sharedApi.CORE_SERVER_SERVICE_NAME,
    }).toEqual({
      CORE_SERVER_HOST: LISTEN_HOST,
      CORE_SERVER_PORT: DEFAULT_LISTEN_PORT,
      CORE_SERVER_HTTP_ORIGIN: `http://${LISTEN_HOST}:${DEFAULT_LISTEN_PORT}`,
      CORE_SERVER_WS_URL: `ws://${LISTEN_HOST}:${DEFAULT_LISTEN_PORT}/ws`,
      CORE_SERVER_SERVICE_NAME: SERVICE_NAME,
    });
  });
});
