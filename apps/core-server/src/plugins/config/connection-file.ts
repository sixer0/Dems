/**
 * Reads the runtime connection file (database contract §7.6, CR-1 to CR-3; spec §14.1 rules 2, 3).
 *
 * The server opens and parses the file itself: nothing is exported into the process environment
 * and no variable that the PostgreSQL driver reads on its own is involved. The format is the
 * one the provisioning script writes: plain `KEY=value` lines, exactly the five keys, nothing
 * else.
 *
 * A file that group or others can read is refused before it is opened (CR-3). Every message
 * names the file and, where it applies, a key. No message ever holds a value.
 */
import { readFileSync, statSync } from 'node:fs';
import { CONNECTION_FILE_KEYS, ConfigError, Secret } from '../../config';

/** The five fields as they stand in the file. Only the password is wrapped; nothing is checked yet. */
export interface ConnectionFileFields {
  readonly host: string;
  readonly port: string;
  readonly database: string;
  readonly user: string;
  readonly password: Secret;
}

const EXPECTED_MODE = '600';
const KEY_NAMES: readonly string[] = Object.values(CONNECTION_FILE_KEYS);

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
}

/** Stops on a file that group or others may read, write or execute. Reads nothing. */
function assertPrivateMode(file: string): void {
  let mode: number;
  try {
    mode = statSync(file).mode & 0o777;
  } catch (error) {
    throw new ConfigError(
      'CONNECTION_FILE_MISSING',
      `${file} cannot be read (${errorCode(error)}). Create it with "npm run pg:init".`,
    );
  }
  if ((mode & 0o077) !== 0) {
    throw new ConfigError(
      'CONNECTION_FILE_MODE',
      `${file} has mode ${mode.toString(8)}; expected ${EXPECTED_MODE} (no access for group or others). Nothing was read.`,
    );
  }
}

export function readConnectionFile(file: string): ConnectionFileFields {
  assertPrivateMode(file);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    throw new ConfigError('CONNECTION_FILE_MISSING', `${file} cannot be read (${errorCode(error)}).`);
  }

  const found = new Map<string, string>();
  text.split('\n').forEach((line, index) => {
    if (line === '') return;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    const key = match?.[1];
    const value = match?.[2];
    if (key === undefined || value === undefined) {
      throw new ConfigError('CONNECTION_FILE_FORMAT', `${file}: line ${index + 1} is not KEY=value.`);
    }
    if (!KEY_NAMES.includes(key)) {
      throw new ConfigError('CONNECTION_FILE_FORMAT', `${file}: unexpected key ${key}.`);
    }
    if (found.has(key)) {
      throw new ConfigError('CONNECTION_FILE_FORMAT', `${file}: key ${key} appears twice.`);
    }
    found.set(key, value);
  });

  const field = (key: string): string => {
    const value = found.get(key);
    if (value === undefined || value === '') {
      throw new ConfigError('CONNECTION_FILE_FORMAT', `${file}: key ${key} is missing or empty.`);
    }
    return value;
  };

  return {
    host: field(CONNECTION_FILE_KEYS.host),
    port: field(CONNECTION_FILE_KEYS.port),
    database: field(CONNECTION_FILE_KEYS.database),
    user: field(CONNECTION_FILE_KEYS.user),
    password: new Secret(field(CONNECTION_FILE_KEYS.password)),
  };
}
