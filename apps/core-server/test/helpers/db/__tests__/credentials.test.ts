// The two connection files the test helper reads (database contract §7.6: CR-1 to CR-3, T-CR-4;
// TI-9). Every file here is written to a temporary directory with marker values; the real
// credential files are never opened by this test, and no database is involved.
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_ROLE, FOREIGN_PORT, OWNER_ROLE, REFUSED_SUPERUSER_ROLE } from '../constants';
import {
  APP_FILE_KEYS,
  APP_FILE_NAME,
  OWNER_FILE_KEYS,
  OWNER_FILE_NAME,
  readAppCredentials,
  readOwnerCredentials,
} from '../credentials';
import { DbTestHelperError } from '../errors';

const OWNER_MARKER = 'owner-MARKER-91c4d7e2';
const APP_MARKER = 'app-MARKER-5ab03f18';

const dirs: string[] = [];

interface Fields {
  host?: string;
  port?: string;
  database?: string;
  user?: string;
  password?: string;
}

function ownerText(fields: Fields = {}): string {
  return [
    `${OWNER_FILE_KEYS.host}=${fields.host ?? '127.0.0.1'}`,
    `${OWNER_FILE_KEYS.port}=${fields.port ?? '4432'}`,
    `${OWNER_FILE_KEYS.database}=${fields.database ?? 'postgres'}`,
    `${OWNER_FILE_KEYS.user}=${fields.user ?? OWNER_ROLE}`,
    `${OWNER_FILE_KEYS.password}=${fields.password ?? OWNER_MARKER}`,
    '',
  ].join('\n');
}

function appText(fields: Fields = {}): string {
  return [
    `${APP_FILE_KEYS.host}=${fields.host ?? '127.0.0.1'}`,
    `${APP_FILE_KEYS.port}=${fields.port ?? '4432'}`,
    `${APP_FILE_KEYS.database}=${fields.database ?? 'dems_demo'}`,
    `${APP_FILE_KEYS.user}=${fields.user ?? APP_ROLE}`,
    `${APP_FILE_KEYS.password}=${fields.password ?? APP_MARKER}`,
    '',
  ].join('\n');
}

function dataDir(files: { owner?: string | null; app?: string | null; ownerMode?: number; appMode?: number } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'dems-w11-credentials-'));
  dirs.push(dir);
  chmodSync(dir, 0o700);
  if (files.owner !== null) {
    const file = join(dir, OWNER_FILE_NAME);
    writeFileSync(file, files.owner ?? ownerText(), { mode: 0o600 });
    chmodSync(file, files.ownerMode ?? 0o600);
  }
  if (files.app !== null) {
    const file = join(dir, APP_FILE_NAME);
    writeFileSync(file, files.app ?? appText(), { mode: 0o600 });
    chmodSync(file, files.appMode ?? 0o600);
  }
  return dir;
}

function refusal(action: () => unknown): DbTestHelperError {
  try {
    action();
  } catch (error) {
    if (error instanceof DbTestHelperError) return error;
    throw error;
  }
  throw new Error('not refused');
}

/** No message, and nothing printable of an error, may hold a credential value. */
function expectNoValue(error: DbTestHelperError): void {
  for (const text of [error.message, String(error), inspect(error), JSON.stringify(error), error.stack ?? '']) {
    expect(text).not.toContain(OWNER_MARKER);
    expect(text).not.toContain(APP_MARKER);
  }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('CR-1, CR-2: five discrete fields, read by the helper itself', () => {
  it('reads the owner file and the runtime file', () => {
    const dir = dataDir();
    const owner = readOwnerCredentials(dir);
    const app = readAppCredentials(dir);
    expect({ ...owner, password: undefined }).toEqual({ host: '127.0.0.1', port: 4432, database: 'postgres', user: 'dems_owner', password: undefined });
    expect({ ...app, password: undefined }).toEqual({ host: '127.0.0.1', port: 4432, database: 'dems_demo', user: 'dems_app', password: undefined });
    expect(owner.password.reveal()).toBe(OWNER_MARKER);
    expect(app.password.reveal()).toBe(APP_MARKER);
  });

  it('names the pinned keys of the plan', () => {
    expect(Object.values(OWNER_FILE_KEYS)).toEqual(['DEMS_PG_HOST', 'DEMS_PG_PORT', 'DEMS_PG_DATABASE', 'DEMS_PG_OWNER_ROLE', 'DEMS_PG_OWNER_PASSWORD']);
    expect(Object.values(APP_FILE_KEYS)).toEqual(['DEMS_PG_HOST', 'DEMS_PG_PORT', 'DEMS_PG_DATABASE', 'DEMS_PG_APP_ROLE', 'DEMS_PG_APP_PASSWORD']);
    expect(OWNER_FILE_NAME).toBe('pg.owner.env');
    expect(APP_FILE_NAME).toBe('pg.env');
  });

  it('a password cannot be printed by accident', () => {
    const owner = readOwnerCredentials(dataDir());
    for (const text of [JSON.stringify(owner), inspect(owner, { depth: 5 }), String(owner.password), `${owner.password}`]) {
      expect(text).not.toContain(OWNER_MARKER);
    }
    expect(JSON.stringify(owner)).toContain('[redacted]');
  });

  it('puts nothing into the process environment', () => {
    const before = JSON.stringify(process.env);
    readOwnerCredentials(dataDir());
    expect(JSON.stringify(process.env)).toBe(before);
    expect(before).not.toContain(OWNER_MARKER);
  });
});

describe('CR-3, T-CR-4: a file that group or others may access stops the helper', () => {
  it.each([0o644, 0o640, 0o604, 0o660, 0o666, 0o610, 0o601])('mode %o: refused, the file is named, nothing is read', (mode) => {
    const error = refusal(() => readOwnerCredentials(dataDir({ ownerMode: mode })));
    expect(error.code).toBe('CREDENTIAL_FILE_MODE');
    expect(error.message).toContain(OWNER_FILE_NAME);
    expect(error.message).toContain(`mode ${mode.toString(8)}`);
    expect(error.message).toContain('expected 600');
    expect(error.message).toContain('Nothing was read');
    expectNoValue(error);
  });

  it('the runtime file is checked in the same way', () => {
    const error = refusal(() => readAppCredentials(dataDir({ appMode: 0o644 })));
    expect(error.code).toBe('CREDENTIAL_FILE_MODE');
    expect(error.message).toContain(APP_FILE_NAME);
    expectNoValue(error);
  });

  it('mode 600 and mode 400 pass', () => {
    expect(readOwnerCredentials(dataDir({ ownerMode: 0o600 })).user).toBe(OWNER_ROLE);
    expect(readOwnerCredentials(dataDir({ ownerMode: 0o400 })).user).toBe(OWNER_ROLE);
  });
});

describe('a missing or malformed file', () => {
  it('a missing file: the message names it and the command that creates it', () => {
    const owner = refusal(() => readOwnerCredentials(dataDir({ owner: null })));
    expect(owner.code).toBe('CREDENTIAL_FILE_MISSING');
    expect(owner.message).toContain(OWNER_FILE_NAME);
    expect(owner.message).toContain('ENOENT');
    expect(owner.message).toContain('npm run pg:init');
    const app = refusal(() => readAppCredentials(dataDir({ app: null })));
    expect(app.code).toBe('CREDENTIAL_FILE_MISSING');
    expect(app.message).toContain(APP_FILE_NAME);
    expect(refusal(() => readOwnerCredentials(join(tmpdir(), 'dems-w11-no-such-directory'))).code).toBe('CREDENTIAL_FILE_MISSING');
  });

  it.each([
    ['an unexpected key', `${ownerText()}EXTRA_KEY=${OWNER_MARKER}\n`, 'unexpected key EXTRA_KEY'],
    ['a key of the other file', `${ownerText()}${APP_FILE_KEYS.password}=${APP_MARKER}\n`, `unexpected key ${APP_FILE_KEYS.password}`],
    ['a key twice', `${ownerText()}${OWNER_FILE_KEYS.password}=${OWNER_MARKER}\n`, `key ${OWNER_FILE_KEYS.password} appears twice`],
    ['a line that is not KEY=value', `${ownerText()}${OWNER_MARKER}\n`, 'line 6 is not KEY=value'],
    ['an export statement', `export ${ownerText()}`, 'line 1 is not KEY=value'],
    ['an empty password', ownerText({ password: '' }).replace(`=${OWNER_MARKER}`, '='), `key ${OWNER_FILE_KEYS.password} is missing or empty`],
    ['no role', ownerText().replace(`${OWNER_FILE_KEYS.user}=${OWNER_ROLE}\n`, ''), `key ${OWNER_FILE_KEYS.user} is missing or empty`],
    ['an empty file', '', `key ${OWNER_FILE_KEYS.password} is missing or empty`],
  ])('%s: the message names the key or the line, never a value', (_label, text, expected) => {
    const error = refusal(() => readOwnerCredentials(dataDir({ owner: text })));
    expect(error.code).toBe('CREDENTIAL_FILE_FORMAT');
    expect(error.message).toContain(OWNER_FILE_NAME);
    expect(error.message).toContain(expected);
    expectNoValue(error);
  });
});

describe('D26, F27: the endpoint of a connection file', () => {
  it("refuses PostgreSQL's default port and names the keys", () => {
    const error = refusal(() => readOwnerCredentials(dataDir({ owner: ownerText({ port: String(FOREIGN_PORT) }) })));
    expect(error.code).toBe('ENDPOINT_REFUSED');
    expect(error.message).toContain(OWNER_FILE_NAME);
    expect(error.message).toContain(OWNER_FILE_KEYS.port);
    expect(error.message).toContain('another PostgreSQL server');
    expectNoValue(error);
  });

  it.each(['localhost', '::1', '0.0.0.0', '10.1.2.3'])('refuses the host %s', (host) => {
    const owner = refusal(() => readOwnerCredentials(dataDir({ owner: ownerText({ host }) })));
    expect(owner.code).toBe('ENDPOINT_REFUSED');
    const app = refusal(() => readAppCredentials(dataDir({ app: appText({ host }) })));
    expect(app.code).toBe('ENDPOINT_REFUSED');
    expectNoValue(owner);
    expectNoValue(app);
  });

  it('refuses any port that is not the project port', () => {
    expect(refusal(() => readOwnerCredentials(dataDir({ owner: ownerText({ port: '4433' }) }))).code).toBe('ENDPOINT_REFUSED');
    expect(refusal(() => readAppCredentials(dataDir({ app: appText({ port: 'abc' }) }))).code).toBe('ENDPOINT_REFUSED');
  });
});

describe('TI-9: the roles of the two files', () => {
  it('refuses the bootstrap superuser in either file', () => {
    const owner = refusal(() => readOwnerCredentials(dataDir({ owner: ownerText({ user: REFUSED_SUPERUSER_ROLE }) })));
    expect(owner.code).toBe('ROLE_REFUSED');
    expect(owner.message).toContain('bootstrap superuser');
    expect(owner.message).toContain(OWNER_FILE_KEYS.user);
    expect(owner.message).toContain('Nothing in test:db connects as it');
    const app = refusal(() => readAppCredentials(dataDir({ app: appText({ user: REFUSED_SUPERUSER_ROLE }) })));
    expect(app.code).toBe('ROLE_REFUSED');
    expectNoValue(owner);
    expectNoValue(app);
  });

  it('refuses the runtime role in the owner file, the owner role in the runtime file, and any other role', () => {
    expect(refusal(() => readOwnerCredentials(dataDir({ owner: ownerText({ user: APP_ROLE }) }))).code).toBe('ROLE_REFUSED');
    expect(refusal(() => readAppCredentials(dataDir({ app: appText({ user: OWNER_ROLE }) }))).code).toBe('ROLE_REFUSED');
    expect(refusal(() => readOwnerCredentials(dataDir({ owner: ownerText({ user: 'postgres' }) }))).code).toBe('ROLE_REFUSED');
  });
});
