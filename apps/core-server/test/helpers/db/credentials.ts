/**
 * The two connection files the test helper reads (database contract §7.6; TI-9):
 *
 *   <data dir>/pg.owner.env   role `dems_owner`: the helper, the templates, the clones
 *   <data dir>/pg.env         role `dems_app`:   handed to the code under test
 *
 * The helper opens and parses each file itself (CR-2): nothing goes into the process
 * environment, on a command line or into another file. A password is wrapped in `Secret` the
 * moment it is read, so it cannot be printed by accident. Every message names the file and,
 * where it applies, a key; no message holds a value.
 *
 * The third credential file of the data directory, the one of the bootstrap superuser, is not
 * named anywhere in this folder: nothing in `test:db` reads it or connects as that role.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Secret } from '../../../src/config';
import { APP_ROLE, OWNER_ROLE, REFUSED_SUPERUSER_ROLE } from './constants';
import { assertProjectEndpoint } from './endpoint';
import { DbTestHelperError, errorCode } from './errors';

/** The workspace root of the repository: this folder is five levels below it. */
export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
/** `apps/core-server`. */
export const WORKSPACE_ROOT = resolve(REPOSITORY_ROOT, 'apps', 'core-server');
/** `<repository>/.data`: git-ignored, mode 0700, created by `npm run pg:init`. */
export const DEFAULT_DATA_DIR = join(REPOSITORY_ROOT, '.data');

export const OWNER_FILE_NAME = 'pg.owner.env';
export const APP_FILE_NAME = 'pg.env';

interface KeySet {
  readonly host: string;
  readonly port: string;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

/** The five keys of each file, in file order (02_plan §3.4; CR-1). */
export const OWNER_FILE_KEYS: KeySet = Object.freeze({
  host: 'DEMS_PG_HOST',
  port: 'DEMS_PG_PORT',
  database: 'DEMS_PG_DATABASE',
  user: 'DEMS_PG_OWNER_ROLE',
  password: 'DEMS_PG_OWNER_PASSWORD',
});
export const APP_FILE_KEYS: KeySet = Object.freeze({
  host: 'DEMS_PG_HOST',
  port: 'DEMS_PG_PORT',
  database: 'DEMS_PG_DATABASE',
  user: 'DEMS_PG_APP_ROLE',
  password: 'DEMS_PG_APP_PASSWORD',
});

/** Five discrete connection fields of one role. There is no connection URL (CR-1). */
export interface RoleCredentials {
  readonly host: '127.0.0.1';
  readonly port: number;
  /** The default database of the file. The helper never uses it as the last word. */
  readonly database: string;
  readonly user: string;
  readonly password: Secret;
}

/** A path as shown to a person: relative to the repository when it lies inside it. */
function shown(file: string): string {
  const fromRoot = relative(REPOSITORY_ROOT, file);
  return fromRoot !== '' && !fromRoot.startsWith('..') && !isAbsolute(fromRoot) ? fromRoot : file;
}

/** CR-3: a file that group or others may access stops the helper. Nothing is read. */
function assertPrivateMode(file: string): void {
  let mode: number;
  try {
    mode = statSync(file).mode & 0o777;
  } catch (error) {
    throw new DbTestHelperError(
      'CREDENTIAL_FILE_MISSING',
      `${shown(file)} cannot be read (${errorCode(error) ?? 'UNKNOWN'}). ` +
        'The credential files are created with the cluster: run "npm run pg:init".',
    );
  }
  if ((mode & 0o077) !== 0) {
    throw new DbTestHelperError(
      'CREDENTIAL_FILE_MODE',
      `${shown(file)} has mode ${mode.toString(8)}; expected 600 (no access for group or others). Nothing was read.`,
    );
  }
}

function readConnectionFile(file: string, keys: KeySet, expectedRole: string): RoleCredentials {
  assertPrivateMode(file);
  const name = shown(file);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    throw new DbTestHelperError('CREDENTIAL_FILE_MISSING', `${name} cannot be read (${errorCode(error) ?? 'UNKNOWN'}).`);
  }

  const keyNames = Object.values(keys);
  const found = new Map<string, string>();
  text.split('\n').forEach((line, index) => {
    if (line === '') return;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    const key = match?.[1];
    const value = match?.[2];
    if (key === undefined || value === undefined) {
      throw new DbTestHelperError('CREDENTIAL_FILE_FORMAT', `${name}: line ${index + 1} is not KEY=value.`);
    }
    if (!keyNames.includes(key)) {
      throw new DbTestHelperError('CREDENTIAL_FILE_FORMAT', `${name}: unexpected key ${key}.`);
    }
    if (found.has(key)) {
      throw new DbTestHelperError('CREDENTIAL_FILE_FORMAT', `${name}: key ${key} appears twice.`);
    }
    found.set(key, value);
  });
  const field = (key: string): string => {
    const value = found.get(key);
    if (value === undefined || value === '') {
      throw new DbTestHelperError('CREDENTIAL_FILE_FORMAT', `${name}: key ${key} is missing or empty.`);
    }
    return value;
  };

  const password = new Secret(field(keys.password));
  const user = field(keys.user);
  if (user === REFUSED_SUPERUSER_ROLE) {
    throw new DbTestHelperError(
      'ROLE_REFUSED',
      `refused: ${name} names the bootstrap superuser ${REFUSED_SUPERUSER_ROLE} in ${keys.user}. ` +
        'Nothing in test:db connects as it (TI-9).',
    );
  }
  if (user !== expectedRole) {
    throw new DbTestHelperError('ROLE_REFUSED', `refused: ${name}: ${keys.user} must be ${expectedRole}.`);
  }

  let endpoint;
  try {
    endpoint = assertProjectEndpoint(field(keys.host), field(keys.port));
  } catch (error) {
    if (error instanceof DbTestHelperError) {
      throw new DbTestHelperError(error.code, `${name} (${keys.host}, ${keys.port}): ${error.message}`);
    }
    throw error;
  }

  return Object.freeze({
    host: '127.0.0.1',
    port: endpoint.port,
    database: field(keys.database),
    user,
    password,
  });
}

/** The owner role's connection fields. Used by the helper only, never by the code under test (TI-17). */
export function readOwnerCredentials(dataDir: string = DEFAULT_DATA_DIR): RoleCredentials {
  return readConnectionFile(join(resolve(dataDir), OWNER_FILE_NAME), OWNER_FILE_KEYS, OWNER_ROLE);
}

/** The runtime role's connection fields: what the code under test connects with (TI-9). */
export function readAppCredentials(dataDir: string = DEFAULT_DATA_DIR): RoleCredentials {
  return readConnectionFile(join(resolve(dataDir), APP_FILE_NAME), APP_FILE_KEYS, APP_ROLE);
}
