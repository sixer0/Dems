// Database-free checks of the three database commands (project `unit`; plan row W17; database
// contract §7.6 CR-1 to CR-4, §8.4; decision D26): the argument, the closed list of database
// names, the owner connection file, the ledger comparison, and the order "name first, then the
// file, then a connection".
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FOREIGN_DATABASE_PORT } from '../../src/config';
import { parseDatabaseArgument, runCommand, usage } from '../../src/db/commands/cli';
import { createDatabaseStatement, runCreate } from '../../src/db/commands/create';
import { PROJECT_DATABASES, guardTargetDatabase } from '../../src/db/commands/database-names';
import { runMigrate } from '../../src/db/commands/migrate';
import { compareLedger, type AppliedMigration, type MigrationFile } from '../../src/db/commands/migrations';
import { readInventory } from './contract-inventory';
import {
  DbCommandError,
  OWNER_FILE_KEYS,
  OWNER_FILE_NAME,
  createOwnerPool,
  readOwnerConnection,
  scrubDriverEnvironment,
} from '../../src/db/commands/owner-connection';
import { SCHEMA_TABLE_NAMES, runStatus } from '../../src/db/commands/status';

const scratch: string[] = [];
afterAll(() => {
  for (const folder of scratch) rmSync(folder, { recursive: true, force: true });
});

const MARKER = 'w17-marker-password-value';

/** A data directory with an owner file of the given lines and mode. */
function dataDir(lines: readonly string[], mode = 0o600): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-w17-data-'));
  scratch.push(folder);
  const file = join(folder, OWNER_FILE_NAME);
  writeFileSync(file, `${lines.join('\n')}\n`);
  chmodSync(file, mode);
  return folder;
}

const valid = (overrides: Partial<Record<keyof typeof OWNER_FILE_KEYS, string>> = {}): string[] => {
  const values = { host: '127.0.0.1', port: '4432', database: 'postgres', user: 'dems_owner', password: MARKER, ...overrides };
  return (Object.keys(OWNER_FILE_KEYS) as Array<keyof typeof OWNER_FILE_KEYS>).map((key) => `${OWNER_FILE_KEYS[key]}=${values[key]}`);
};

function failure(work: () => unknown): DbCommandError {
  try {
    work();
  } catch (error) {
    expect(error).toBeInstanceOf(DbCommandError);
    return error as DbCommandError;
  }
  throw new Error('expected a DbCommandError');
}

async function run(command: (argv: readonly string[], options?: object) => Promise<number>, argv: string[], options: object = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const exitCode = await command(argv, { io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) }, ...options });
  return { exitCode, out, err };
}

describe('the argument', () => {
  it('accepts --database <name> and --database=<name>', () => {
    expect(parseDatabaseArgument(['--database', 'dems_demo'], 'db:status')).toBe('dems_demo');
    expect(parseDatabaseArgument(['--database=dems_lane_2'], 'db:status')).toBe('dems_lane_2');
  });

  it.each([[[]], [['--database']], [['--database', '']], [['dems_demo']], [['--database', 'a', '--database', 'b']], [['--force']], [['--database=dems_demo', '--scenario', 'idle']]])(
    'refuses %j as a wrong call (exit code 2)',
    (argv) => {
      const error = failure(() => parseDatabaseArgument(argv, 'db:migrate'));
      expect(error.code).toBe('USAGE');
      expect(error.exitCode).toBe(2);
      expect(error.message).toContain(usage('db:migrate'));
    },
  );

  it('no command takes a secret as an argument: the usage names one option', () => {
    expect(usage('db:create')).toBe('usage: npm run db:create -w @dems/core-server -- --database <dems_demo|dems_lane_1|dems_lane_2|dems_lane_3>');
  });
});

describe('the closed list of database names (contract §8.4)', () => {
  it('accepts exactly dems_demo and the three lane databases', () => {
    expect([...PROJECT_DATABASES]).toEqual(['dems_demo', 'dems_lane_1', 'dems_lane_2', 'dems_lane_3']);
    for (const name of PROJECT_DATABASES) expect(guardTargetDatabase(name)).toBe(name);
  });

  it.each([
    'postgres', 'template0', 'template1', 'dems_lane_4', 'dems_lane_0', 'DEMS_DEMO', 'dems_demo ', 'dems_demo;', 'dems_demo_next', 'dems_demo_prev',
    'dems_test_local_abc12345_f01_x', 'dems_proof_x', '"dems_demo"', "dems_demo'; DROP TABLE x; --", '', 'x',
  ])('refuses %j, and does not echo it', (name) => {
    const error = failure(() => guardTargetDatabase(name));
    expect(error.code).toBe('DATABASE_NAME_REFUSED');
    expect(error.exitCode).toBe(2);
    expect(error.message.startsWith('refused before any connection:')).toBe(true);
    if (name.length > 3) expect(error.message.includes(name)).toBe(false);
  });

  it.each([undefined, null, 42, {}, ['dems_demo']])('refuses a value that is not a string: %j', (name) => {
    expect(failure(() => guardTargetDatabase(name)).code).toBe('DATABASE_NAME_REFUSED');
  });

  it('the test seam accepts a dems_test_ name of at most 63 bytes and nothing wider', () => {
    const options = { allowTestDatabase: true };
    expect(guardTargetDatabase('dems_test_step_39_abc12345_x_created', options)).toBe('dems_test_step_39_abc12345_x_created');
    for (const name of ['dems_test_', 'dems_test_A', 'dems_test_a-b', 'dems_test_a b', 'postgres', 'dems_testx', `dems_test_${'a'.repeat(54)}`, 'dems_test_a"; --']) {
      expect(failure(() => guardTargetDatabase(name, options)).code, name).toBe('DATABASE_NAME_REFUSED');
    }
    expect(guardTargetDatabase(`dems_test_${'a'.repeat(53)}`, options)).toHaveLength(63);
  });

  it('the one statement built from a name: CREATE DATABASE with the owner, the empty template, UTF8 and locale C', () => {
    expect(createDatabaseStatement(guardTargetDatabase('dems_demo'))).toBe(
      "CREATE DATABASE dems_demo OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'",
    );
  });
});

describe('the owner connection file (CR-1 to CR-3; D26)', () => {
  it('reads five discrete fields; the password is wrapped and cannot be printed', () => {
    const connection = readOwnerConnection(dataDir(valid()));
    expect({ ...connection, password: undefined }).toEqual({ host: '127.0.0.1', port: 4432, database: 'postgres', user: 'dems_owner', password: undefined });
    expect(connection.password.reveal()).toBe(MARKER);
    expect(JSON.stringify(connection)).not.toContain(MARKER);
    expect(String(connection.password)).toBe('[redacted]');
  });

  it.each([0o644, 0o640, 0o604, 0o660, 0o666, 0o700 | 0o040, 0o601])('refuses mode %s before reading anything', (mode) => {
    const error = failure(() => readOwnerConnection(dataDir(valid(), mode)));
    expect(error.code).toBe('OWNER_FILE_MODE');
    expect(error.message).toContain('expected 600');
    expect(error.message).toContain('Nothing was read.');
    expect(error.message).not.toContain(MARKER);
  });

  it('a missing file names the provisioning command', () => {
    const error = failure(() => readOwnerConnection(join(tmpdir(), 'dems-w17-no-such-directory')));
    expect(error.code).toBe('OWNER_FILE_MISSING');
    expect(error.message).toContain(OWNER_FILE_NAME);
    expect(error.message).toContain('npm run pg:init');
  });

  it.each([
    ['another role', valid({ user: 'dems_app' }), 'OWNER_FILE_ROLE', OWNER_FILE_KEYS.user],
    ['the bootstrap superuser', valid({ user: ['dems', 'admin'].join('_') }), 'OWNER_FILE_ROLE', OWNER_FILE_KEYS.user],
    ['a host that is not loopback IPv4', valid({ host: 'localhost' }), 'ENDPOINT_REFUSED', OWNER_FILE_KEYS.host],
    ['the wildcard address', valid({ host: [0, 0, 0, 0].join('.') }), 'ENDPOINT_REFUSED', OWNER_FILE_KEYS.host],
    ["PostgreSQL's default port (another server on this host)", valid({ port: String(FOREIGN_DATABASE_PORT) }), 'ENDPOINT_REFUSED', OWNER_FILE_KEYS.port],
    ['a port that is not a number', valid({ port: '44x2' }), 'ENDPOINT_REFUSED', OWNER_FILE_KEYS.port],
    ['port 0', valid({ port: '0' }), 'ENDPOINT_REFUSED', OWNER_FILE_KEYS.port],
    ['a missing key', valid().slice(0, 4), 'OWNER_FILE_FORMAT', OWNER_FILE_KEYS.password],
    ['an empty value', valid({ database: '' }), 'OWNER_FILE_FORMAT', OWNER_FILE_KEYS.database],
    ['an unexpected key', [...valid(), 'DEMS_PG_EXTRA=1'], 'OWNER_FILE_FORMAT', 'DEMS_PG_EXTRA'],
    ['a key twice', [...valid(), `${OWNER_FILE_KEYS.host}=127.0.0.1`], 'OWNER_FILE_FORMAT', OWNER_FILE_KEYS.host],
    ['a line that is not KEY=value', [...valid(), 'export FOO'], 'OWNER_FILE_FORMAT', 'line 6'],
    ["the runtime role's keys", valid().map((line) => line.replace('OWNER', 'APP')), 'OWNER_FILE_FORMAT', 'DEMS_PG_APP_ROLE'],
  ])('refuses %s: the message names the file and the key, never a value', (_label, lines, code, named) => {
    const error = failure(() => readOwnerConnection(dataDir(lines)));
    expect(error.code).toBe(code);
    expect(error.exitCode).toBe(1);
    expect(error.message).toContain(OWNER_FILE_NAME);
    expect(error.message).toContain(named);
    expect(error.message).not.toContain(MARKER);
  });

  it('host and port have no default: a file without them is refused, whatever the environment says', () => {
    const env: Record<string, string | undefined> = { PGHOST: 'elsewhere', PGPORT: '1', PGUSER: 'x', PGDATABASE: 'y', PATH: '/bin', DEMS_CORE_PORT: '4420' };
    expect(scrubDriverEnvironment(env)).toEqual(['PGDATABASE', 'PGHOST', 'PGPORT', 'PGUSER']);
    expect(Object.keys(env).sort()).toEqual(['DEMS_CORE_PORT', 'PATH']);
    const lines = valid().filter((line) => !line.startsWith(OWNER_FILE_KEYS.host) && !line.startsWith(OWNER_FILE_KEYS.port));
    expect(failure(() => readOwnerConnection(dataDir(lines))).code).toBe('OWNER_FILE_FORMAT');
  });

  it('the pool gets five explicit fields, TLS off, and the password through a function', async () => {
    const pool = createOwnerPool(readOwnerConnection(dataDir(valid())), 'dems_demo');
    const options = pool.options as unknown as Record<string, unknown>;
    expect(options).toMatchObject({ host: '127.0.0.1', port: 4432, database: 'dems_demo', user: 'dems_owner', ssl: false, max: 2 });
    expect(typeof options['password']).toBe('function');
    expect(JSON.stringify(options)).not.toContain(MARKER);
    await pool.end();
  });
});

describe('the order of a command: the name, then the file, then a connection', () => {
  const nowhere = join(tmpdir(), 'dems-w17-no-such-directory');

  it.each([
    ['db:create', runCreate],
    ['db:migrate', runMigrate],
    ['db:status', runStatus],
  ] as const)('%s refuses another name with exit code 2 before the owner file is opened', async (name, command) => {
    const result = await run(command, ['--database', 'postgres'], { dataDir: nowhere });
    expect(result.exitCode).toBe(2);
    expect(result.out).toEqual([]);
    // The data directory does not exist; had the file been opened first, the message would name it.
    expect(result.err).toEqual([
      `${name}: refused before any connection: the database name is not one of dems_demo, dems_lane_1, dems_lane_2, dems_lane_3. Test databases are reachable only through the test helper.`,
    ]);
  });

  it.each([
    ['db:create', runCreate],
    ['db:migrate', runMigrate],
    ['db:status', runStatus],
  ] as const)('%s refuses a dems_test_ name without the test seam, and prints the usage for a wrong call', async (name, command) => {
    expect((await run(command, ['--database', 'dems_test_local_abc12345_f01_x'], { dataDir: nowhere })).exitCode).toBe(2);
    const wrong = await run(command, [], { dataDir: nowhere });
    expect(wrong.exitCode).toBe(2);
    expect(wrong.err).toEqual([`${name}: ${usage(name)}`]);
  });

  it('with an accepted name and no owner file: exit code 1, the message names the file and pg:init, and no connection was tried', async () => {
    const result = await run(runStatus, ['--database', 'dems_demo'], { dataDir: nowhere });
    expect(result.exitCode).toBe(1);
    expect(result.err).toHaveLength(1);
    expect(result.err[0]).toContain(`db:status: ${join(nowhere, OWNER_FILE_NAME)} cannot be read (ENOENT)`);
    expect(result.err[0]).toContain('npm run pg:init');
  });

  it('an unexpected failure is reported by its class and code only; a server error by its SQLSTATE and message', async () => {
    const data = dataDir(valid());
    const plain = await runCommand('db:status', ['--database', 'dems_demo'], { dataDir: data, io: { out: () => {}, err: () => {} } }, async () => {
      throw Object.assign(new Error(`a message that quotes ${MARKER}`), { code: 'ESOMETHING' });
    });
    expect(plain).toBe(1);
    const lines: string[] = [];
    await runCommand('db:status', ['--database', 'dems_demo'], { dataDir: data, io: { out: () => {}, err: (line) => lines.push(line) } }, async () => {
      throw Object.assign(new Error(`a message that quotes ${MARKER}`), { code: 'ESOMETHING' });
    });
    await runCommand('db:status', ['--database', 'dems_demo'], { dataDir: data, io: { out: () => {}, err: (line) => lines.push(line) } }, async () => {
      // drizzle-orm wraps the driver error: the SQLSTATE is on `cause`.
      throw new Error('Failed query: SELECT 1 / 0 params: ', { cause: Object.assign(new Error('division by zero'), { name: 'error', code: '22012' }) });
    });
    expect(lines).toEqual(['db:status: failed (Error ESOMETHING).', 'db:status: failed (error 22012: division by zero).']);
  });
});

describe('the ledger comparison (D38)', () => {
  const file = (idx: number, when: number, sha256: string): MigrationFile => ({ idx, tag: `000${idx}_f${idx}`, when, sha256, bytes: 1, file: `/x/000${idx}_f${idx}.sql` });
  const files = [file(0, 100, 'a'.repeat(64)), file(1, 200, 'b'.repeat(64)), file(2, 300, 'c'.repeat(64))];
  const row = (id: number, createdAt: number, hash: string): AppliedMigration => ({ id, createdAt, hash });

  it('nothing applied: every file is pending, the ledger is in order', () => {
    expect(compareLedger(files, null)).toMatchObject({ tablePresent: false, ok: true, pending: ['0000_f0', '0001_f1', '0002_f2'], problems: [] });
    expect(compareLedger(files, [])).toMatchObject({ tablePresent: true, ok: true, pending: ['0000_f0', '0001_f1', '0002_f2'] });
  });

  it('all applied with their hashes: nothing pending; the row IDs may have gaps', () => {
    const report = compareLedger(files, [row(5, 100, 'a'.repeat(64)), row(6, 200, 'b'.repeat(64)), row(9, 300, 'c'.repeat(64))]);
    expect(report).toMatchObject({ ok: true, pending: [], problems: [] });
    expect(report.entries.map((entry) => entry.state)).toEqual(['applied', 'applied', 'applied']);
  });

  it('a newer file is pending', () => {
    const report = compareLedger(files, [row(1, 100, 'a'.repeat(64)), row(2, 200, 'b'.repeat(64))]);
    expect(report).toMatchObject({ ok: true, pending: ['0002_f2'] });
  });

  it('an applied file with another hash is "edited"; a file older than the newest applied one is "skipped"; an applied row without a file is unknown', () => {
    const edited = compareLedger(files, [row(1, 100, 'a'.repeat(64)), row(2, 200, 'f'.repeat(64)), row(3, 300, 'c'.repeat(64))]);
    expect(edited.ok).toBe(false);
    expect(edited.entries.map((entry) => entry.state)).toEqual(['applied', 'edited', 'applied']);
    expect(edited.problems).toHaveLength(1);

    const skipped = compareLedger(files, [row(1, 100, 'a'.repeat(64)), row(3, 300, 'c'.repeat(64))]);
    expect(skipped.entries.map((entry) => entry.state)).toEqual(['applied', 'skipped', 'applied']);
    expect(skipped).toMatchObject({ ok: false, pending: [] });

    const unknown = compareLedger(files.slice(0, 2), [row(1, 100, 'a'.repeat(64)), row(2, 200, 'b'.repeat(64)), row(3, 300, 'c'.repeat(64))]);
    expect(unknown.unknownApplied).toEqual([row(3, 300, 'c'.repeat(64))]);
    expect(unknown.ok).toBe(false);
  });
});

describe('db:status reads the tables of the typed schema', () => {
  it('40 table names, sorted, each a plain identifier', () => {
    // 30 in the closed task-2 contract; dbc-3 adds nine (T-31..T-39) and R-8 adds T-40
    // (`stt_config`). The count equals the composed inventory the contract-inventory test pins.
    expect(SCHEMA_TABLE_NAMES).toHaveLength(readInventory().counts.tables);
    expect([...SCHEMA_TABLE_NAMES]).toEqual([...SCHEMA_TABLE_NAMES].sort());
    for (const name of SCHEMA_TABLE_NAMES) expect(name).toMatch(/^[a-z][a-z_]*$/);
  });
});
