// Static guard of the test helper's own files (plan row W11; TI-9, TI-17; decision D26; CR-2,
// CR-4). It reads `test/helpers/db/**` and `test/global-setup.db.ts` as text.
//
//   - the superuser's password file is named nowhere; the superuser's role only where it is
//     refused (one constant) and in tests;
//   - the driver is imported and a client or pool is built in one file, `session.ts`;
//   - statements that create, change or drop a database are written in one file, `ddl.ts`;
//   - no host or port comes from the environment; the environment is read in one place, for
//     the row label;
//   - no connection URL, no password in a process argument or a child environment, no file is
//     written by the helper.
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, literal, occurrences, readTree, type SourceFile } from '../../../static/scan';
import { REFUSED_SUPERUSER_ROLE } from '../constants';

/** The files of plan row W11, with paths relative to `apps/core-server`. */
const files = readTree(WORKSPACE).filter((file) => file.path.startsWith('test/helpers/db/') || file.path === 'test/global-setup.db.ts');

/** The helper itself: everything that is not one of its tests, test support or self-check fixtures. */
const isHelperCode = (path: string): boolean =>
  !path.includes('/__tests__/') && !path.includes('/testing/') && !path.includes('/selfcheck/');
/** The helper with its comments removed: these rules are about what the code does. */
const helperCode = codeOnly(files.filter((file) => isHelperCode(file.path)));

function filesWith(sources: readonly SourceFile[], pattern: RegExp): string[] {
  return [...new Set(occurrences(sources, pattern).map((place) => place.slice(0, place.lastIndexOf(':'))))];
}

const SUPERUSER_FILE = ['pg', 'pwfile'].join('.');
const SUPERUSER_ROLE = ['dems', 'admin'].join('_');
const PASSWORD_VARIABLE = ['PG', 'PASSWORD'].join('');
const ENV_FILE_OPTION = ['--env', 'file'].join('-');
const CONNECTION_URL = new RegExp(`${['postgres', '(?:ql)?:'].join('')}//`, 'gi');

describe('the scan itself', () => {
  it('reads the helper, its tests and the global setup', () => {
    const paths = files.map((file) => file.path);
    for (const expected of [
      'test/global-setup.db.ts',
      'test/helpers/db/constants.ts',
      'test/helpers/db/credentials.ts',
      'test/helpers/db/ddl.ts',
      'test/helpers/db/endpoint.ts',
      'test/helpers/db/errors.ts',
      'test/helpers/db/global-setup.ts',
      'test/helpers/db/hooks.ts',
      'test/helpers/db/index.ts',
      'test/helpers/db/names.ts',
      'test/helpers/db/provided.ts',
      'test/helpers/db/run.ts',
      'test/helpers/db/session.ts',
      'test/helpers/db/__tests__/static.test.ts',
    ]) {
      expect(paths, expected).toContain(expected);
    }
    expect(helperCode.map((file) => file.path)).toEqual([
      'test/global-setup.db.ts',
      'test/helpers/db/constants.ts',
      'test/helpers/db/credentials.ts',
      'test/helpers/db/ddl.ts',
      'test/helpers/db/endpoint.ts',
      'test/helpers/db/errors.ts',
      'test/helpers/db/global-setup.ts',
      'test/helpers/db/hooks.ts',
      'test/helpers/db/index.ts',
      'test/helpers/db/names.ts',
      'test/helpers/db/provided.ts',
      'test/helpers/db/run.ts',
      'test/helpers/db/session.ts',
    ]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `open('.data/${SUPERUSER_FILE}')\nuser: '${SUPERUSER_ROLE}'` },
      { path: 'b.ts', text: `process.env.${PASSWORD_VARIABLE}\nnode ${ENV_FILE_OPTION}=x` },
      { path: 'c.ts', text: `"${'postgres'}://dems_owner:x@127.0.0.1:4432/postgres"` },
    ];
    expect(occurrences(planted, literal(SUPERUSER_FILE))).toEqual(['a.ts:1']);
    expect(occurrences(planted, literal(SUPERUSER_ROLE))).toEqual(['a.ts:2']);
    expect(occurrences(planted, literal(PASSWORD_VARIABLE))).toEqual(['b.ts:1']);
    expect(occurrences(planted, literal(ENV_FILE_OPTION))).toEqual(['b.ts:2']);
    expect(occurrences(planted, CONNECTION_URL)).toEqual(['c.ts:1']);
  });
});

describe('TI-9, HC-1: nothing in test:db is the bootstrap superuser', () => {
  it("the superuser's password file is named by no file of the helper, tests included", () => {
    expect(occurrences(files, literal(SUPERUSER_FILE))).toEqual([]);
  });

  it("the superuser's role is written once in the helper: the constant that is refused", () => {
    expect(REFUSED_SUPERUSER_ROLE).toBe(SUPERUSER_ROLE);
    const places = occurrences(helperCode, literal(SUPERUSER_ROLE));
    expect(filesWith(helperCode, literal(SUPERUSER_ROLE))).toEqual(['test/helpers/db/constants.ts']);
    expect(places).toHaveLength(1);
    const constants = helperCode.find((file) => file.path === 'test/helpers/db/constants.ts')?.text ?? '';
    expect(constants).toContain(`export const REFUSED_SUPERUSER_ROLE = '${SUPERUSER_ROLE}';`);
  });

  it('the refused role is used only to refuse: compared, or printed in a refusal message', () => {
    const uses = helperCode.flatMap((file) =>
      file.text
        .split('\n')
        .map((line, index) => ({ place: `${file.path}:${index + 1}`, line: line.trim() }))
        .filter(({ line }) => line.includes('REFUSED_SUPERUSER_ROLE')),
    );
    expect(uses.length).toBeGreaterThanOrEqual(6);
    const allowed = [
      /^export const REFUSED_SUPERUSER_ROLE = /,
      /^import \{[^}]*\bREFUSED_SUPERUSER_ROLE\b[^}]*\} from '\.\/constants';$/,
      /^REFUSED_SUPERUSER_ROLE,$/,
      /=== REFUSED_SUPERUSER_ROLE\) \{$/,
      /^`refused: [^`]*\$\{REFUSED_SUPERUSER_ROLE\}[^`]*`(?:,| \+)?$/,
    ];
    const other = uses.filter(({ line }) => !allowed.some((pattern) => pattern.test(line)));
    expect(other).toEqual([]);
  });

  it('outside the helper code the role appears in tests only, where its refusal is asserted', () => {
    const elsewhere = filesWith(
      files.filter((file) => !isHelperCode(file.path)),
      literal(SUPERUSER_ROLE),
    );
    for (const path of elsewhere) expect(path, path).toMatch(/\/__tests__\/[a-z-]+\.test\.ts$/);
  });
});

describe('D26: one place builds a connection, and it takes host and port from the connection file', () => {
  it('the driver is imported by session.ts only (type imports apart)', () => {
    const runtimeImport = /^import (?!type\b)[^;]*from 'pg';$/gm;
    expect(filesWith(helperCode, runtimeImport)).toEqual(['test/helpers/db/session.ts']);
  });

  it('a client or a pool is built in session.ts only', () => {
    expect(filesWith(helperCode, /\bnew (?:Client|Pool)\(/g)).toEqual(['test/helpers/db/session.ts']);
    const session = helperCode.find((file) => file.path === 'test/helpers/db/session.ts')?.text ?? '';
    expect(occurrences([{ path: 'session.ts', text: session }], /\bnew (?:Client|Pool)\(/g)).toHaveLength(2);
    // Both are built from `driverOptions`, which checks the endpoint first.
    expect(session).toContain('new Client(options)');
    expect(session).toContain(
      'new Pool({ ...driverOptions(credentials, database, options.applicationName), max: options.max, connectionTimeoutMillis: options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS })',
    );
    // Three places hold the words: the option type, the constant the driver gets, and the pool
    // that a caller may state a longer wait for (decision D134). It defaults to the constant.
    expect(occurrences([{ path: 'session.ts', text: session }], /\bconnectionTimeoutMillis:/g)).toHaveLength(3);
    expect(session).toContain('connectionTimeoutMillis: options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS');
    expect(session).toMatch(/export function driverOptions\([^)]*\): DriverOptions \{\n\s+const endpoint = assertProjectEndpoint\(credentials\.host, credentials\.port\);/);
  });

  it('the environment is read in two places: the row label, and the scrub of driver variables', () => {
    const reads = occurrences(helperCode, /\bprocess\s*\.\s*env\b/g).map((place) => place.slice(0, place.lastIndexOf(':')));
    expect([...new Set(reads)].sort()).toEqual(['test/helpers/db/run.ts', 'test/helpers/db/session.ts']);
    const run = helperCode.find((file) => file.path === 'test/helpers/db/run.ts')?.text ?? '';
    expect(occurrences([{ path: 'run.ts', text: run }], /\bprocess\s*\.\s*env\b/g)).toHaveLength(1);
    expect(run).toContain('runLabel((options.env ?? process.env)[ENV_TEST_STEP])');
  });

  it('no file of the helper names a host, port, user or password variable of the driver', () => {
    const driverVariable = new RegExp(`\\b${'PG'}(?:HOST|HOSTADDR|PORT|USER|DATABASE|PASSFILE|SERVICE|SSLMODE|OPTIONS|APPNAME)\\b`, 'g');
    expect(occurrences(helperCode, driverVariable)).toEqual([]);
    expect(occurrences(files, literal(PASSWORD_VARIABLE))).toEqual([]);
  });

  it('the default port of PostgreSQL is not written in the helper: it comes from the one constant that refuses it', () => {
    expect(occurrences(helperCode, new RegExp(`\\b${[54, 32].join('')}\\b`, 'g'))).toEqual([]);
    const constants = helperCode.find((file) => file.path === 'test/helpers/db/constants.ts')?.text ?? '';
    expect(constants).toContain('export const FOREIGN_PORT = FOREIGN_DATABASE_PORT;');
    expect(constants).toContain('export const PROJECT_DATABASE_PORT = 4432;');
  });
});

describe('CR-1, CR-2, CR-4: credentials stay in the connection files', () => {
  it('no connection URL, no env-file option', () => {
    expect(occurrences(files, CONNECTION_URL)).toEqual([]);
    expect(occurrences(files, literal(ENV_FILE_OPTION))).toEqual([]);
  });

  it('the helper writes no file and starts no child process', () => {
    expect(occurrences(helperCode, /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\b/g)).toEqual([]);
    expect(occurrences(helperCode, new RegExp(`['"](?:node:)?${['child', 'process'].join('_')}['"]`, 'g'))).toEqual([]);
  });

  it('a password is revealed in one place: the function handed to the driver', () => {
    const reveals = occurrences(helperCode, /\.reveal\(\)/g);
    expect(reveals).toHaveLength(1);
    expect(reveals[0]).toMatch(/^test\/helpers\/db\/session\.ts:\d+$/);
  });

  it('the one child process of the tests gets paths and names only', () => {
    const spawning = filesWith(files, new RegExp(`['"](?:node:)?${['child', 'process'].join('_')}['"]`, 'g'));
    expect(spawning).toEqual(['test/helpers/db/__tests__/nested-run.db.test.ts']);
    const nested = files.find((file) => file.path === 'test/helpers/db/__tests__/nested-run.db.test.ts')?.text ?? '';
    expect(nested).toContain("[VITEST, 'run', '--config', CONFIG, '--root', WORKSPACE_ROOT, '--project', project, '--reporter', 'default']");
    expect(nested).not.toMatch(/readOwnerCredentials|readAppCredentials|\.reveal\(|password/i);
  });
});

describe('TI-3: statements on databases are written in one file', () => {
  it('CREATE, ALTER and DROP DATABASE occur in ddl.ts only, and each takes a guarded name', () => {
    const statement = /\b(?:CREATE|ALTER|DROP)\s+DATABASE\s+(?:IF\s+EXISTS\s+)?\$\{/g;
    expect(filesWith(helperCode, statement)).toEqual(['test/helpers/db/ddl.ts']);
    const ddl = helperCode.find((file) => file.path === 'test/helpers/db/ddl.ts')?.text ?? '';
    const written = [...ddl.matchAll(/`((?:CREATE|ALTER|DROP) DATABASE [^`]*)`/g)].map((match) => match[1]);
    expect(written).toEqual([
      "CREATE DATABASE ${quoteDatabaseName(name)} OWNER ${OWNER_IDENTIFIER} TEMPLATE ${EMPTY_TEMPLATE} ENCODING 'UTF8' LOCALE 'C'",
      'CREATE DATABASE ${quoteDatabaseName(name)} TEMPLATE ${quoteDatabaseName(template)} OWNER ${OWNER_IDENTIFIER}',
      'ALTER DATABASE ${quoteDatabaseName(name)} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false',
      'ALTER DATABASE ${quoteDatabaseName(name)} WITH IS_TEMPLATE false',
      'DROP DATABASE IF EXISTS ${quoteDatabaseName(name)} WITH (FORCE)',
    ]);
    // `quoteDatabaseName` accepts a guarded name only, and only the guard makes one.
    const names = helperCode.find((file) => file.path === 'test/helpers/db/names.ts')?.text ?? '';
    expect(names).toContain('export function quoteDatabaseName(name: GuardedDatabaseName): string');
    expect(occurrences(helperCode, /\bas GuardedDatabaseName\b/g).map((place) => place.slice(0, place.lastIndexOf(':')))).toEqual([
      'test/helpers/db/names.ts',
      'test/helpers/db/names.ts',
    ]);
  });

  it('no other statement that changes the cluster: no role, no setting, no trigger, no function', () => {
    const forbidden = [
      ['CREATE', 'ROLE'],
      ['ALTER', 'ROLE'],
      ['DROP', 'ROLE'],
      ['ALTER', 'SYSTEM'],
      ['DISABLE', 'TRIGGER'],
      ['DROP', 'TRIGGER'],
      ['CREATE', 'OR', 'REPLACE'],
      [['pg', 'signal', 'backend'].join('_')],
      [['pg', 'terminate', 'backend'].join('_')],
      [['pg', 'cancel', 'backend'].join('_')],
      [['session', 'replication', 'role'].join('_')],
    ].map((words) => new RegExp(`\\b${words.join('\\s+')}\\b`, 'gi'));
    for (const pattern of forbidden) expect(occurrences(files, pattern), String(pattern)).toEqual([]);
  });
});

describe('F-8: a catalog read of the shared cluster is keyed by the session that asks', () => {
  /** Built from fragments, so that this file is not itself a match. */
  const LOCKS_READ = new RegExp(`\\bFROM ${['pg_l', 'ocks'].join('')}\\b`, 'g');
  const OWN_SESSION = new RegExp(`\\bpid\\s*<>\\s*${['pg_back', 'end_pid\\(\\)'].join('')}`, 'g');

  it('the clone-lock queue is read in ddl.ts only', () => {
    expect(filesWith(helperCode, LOCKS_READ)).toEqual(['test/helpers/db/ddl.ts']);
  });

  it('and that one read leaves its own session out (decision D134)', () => {
    const ddl = helperCode.find((file) => file.path === 'test/helpers/db/ddl.ts')?.text ?? '';
    expect(occurrences([{ path: 'ddl.ts', text: ddl }], LOCKS_READ)).toHaveLength(1);
    expect(occurrences([{ path: 'ddl.ts', text: ddl }], OWN_SESSION)).toHaveLength(1);
  });
});
