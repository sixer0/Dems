// Static guard: credentials (database contract T-CR-2; spec SR-68, SR-77, AC-B-86, server part).
//
// What must never appear, and where:
//   (a) the name of the bootstrap superuser's password file: nowhere under `apps/` and
//       `packages/` (HC-1: only the provisioning scripts read it);
//   (b) a variable that hands a password to the driver, a connection URL with a user part, or
//       the Node option that loads an env file: nowhere under `apps/core-server/`;
//   (c) the name of the owner-role file: under `apps/core-server/src/` only in the reset routine
//       and the command folder (HC-2, HC-3).
// Every forbidden text is built from fragments, so that this file does not contain it.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REPOSITORY,
  WORKSPACE,
  isProductionSource,
  literal,
  occurrences,
  readTree,
  under,
  type SourceFile,
} from './scan';

const SUPERUSER_FILE = ['pg', 'pwfile'].join('.');
const OWNER_FILE = ['pg', 'owner', 'env'].join('.');
const PASSWORD_VARIABLE = ['PG', 'PASSWORD'].join('');
const URL_VARIABLE = ['DATABASE', 'URL'].join('_');
const ENV_FILE_OPTION = ['--env', 'file'].join('-');

/** A connection URL of either PostgreSQL scheme with a user part, with or without a password. */
const CONNECTION_URL = new RegExp(`${['postgres', '(?:ql)?:'].join('')}//[^\\s/'"\`@]+@`, 'gi');
/** A shell `source` (or `.`) of a file under the data directory. */
const SOURCED_DATA_FILE = new RegExp(`(?:^|[\\s;&|])(?:${['sou', 'rce'].join('')}|\\.)\\s+\\S*\\.data/`, 'gm');

/** Where the owner-role file may be named inside `src/` (database contract T-CR-2 c). */
const OWNER_FILE_PLACES = ['src/db/reset/', 'src/db/commands/'];
/** The files of plan row W08: the loader and everything around it never name either file. */
const SCAFFOLD_PLACES = ['src/index.ts', 'src/app.ts', 'src/config.ts', 'src/plugins/', 'src/modules/health/'];

const server = readTree(WORKSPACE);
const workspaces = [...readTree(join(REPOSITORY, 'apps')), ...readTree(join(REPOSITORY, 'packages'))];

describe('the scan itself', () => {
  it('reads the server sources, the tests and the manifest, and no dependency', () => {
    const paths = server.map((file) => file.path);
    for (const expected of ['package.json', 'src/app.ts', 'src/config.ts', 'src/index.ts', 'test/static/scan.ts']) {
      expect(paths, expected).toContain(expected);
    }
    expect(paths.filter((path) => path.includes('node_modules'))).toEqual([]);
    expect(workspaces.length).toBeGreaterThan(server.length);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/a.ts', text: `open("${SUPERUSER_FILE}")\nread("${OWNER_FILE}")` },
      { path: 'src/b.ts', text: `process.env.${PASSWORD_VARIABLE}\nprocess.env.${URL_VARIABLE}` },
      { path: 'package.json', text: `"start": "node ${ENV_FILE_OPTION}=x src/index.ts"` },
      { path: 'src/c.ts', text: `const url = "${'postgres'}ql://dems_app:secret@127.0.0.1:4432/dems_demo";` },
      { path: 'src/d.ts', text: `const url = "${'postgres'}://dems_app@127.0.0.1/dems_demo";` },
      { path: 'run.sh', text: `${['sou', 'rce'].join('')} ../../.data/pg.env` },
    ];
    expect(occurrences(planted, literal(SUPERUSER_FILE))).toEqual(['src/a.ts:1']);
    expect(occurrences(planted, literal(OWNER_FILE))).toEqual(['src/a.ts:2']);
    expect(occurrences(planted, literal(PASSWORD_VARIABLE))).toEqual(['src/b.ts:1']);
    expect(occurrences(planted, literal(URL_VARIABLE))).toEqual(['src/b.ts:2']);
    expect(occurrences(planted, literal(ENV_FILE_OPTION))).toEqual(['package.json:1']);
    expect(occurrences(planted, CONNECTION_URL)).toEqual(['src/c.ts:1', 'src/d.ts:1']);
    expect(occurrences(planted, SOURCED_DATA_FILE)).toEqual(['run.sh:1']);
    // A URL without a user part is not a credential.
    expect(occurrences([{ path: 'x.ts', text: `"${'postgres'}://127.0.0.1:4432/dems_demo"` }], CONNECTION_URL)).toEqual([]);
  });
});

describe('T-CR-2 (a): the superuser password file', () => {
  it('is named by no file under apps/ and packages/', () => {
    expect(occurrences(workspaces, literal(SUPERUSER_FILE))).toEqual([]);
  });
});

describe('T-CR-2 (b), AC-B-86: no secret outside the connection file', () => {
  it.each([
    ['a password variable of the driver', literal(PASSWORD_VARIABLE)],
    ['a connection-URL variable', literal(URL_VARIABLE)],
    ['the Node option that loads an env file', literal(ENV_FILE_OPTION)],
    ['a connection URL with a user part', CONNECTION_URL],
    ['a shell that sources a file of the data directory', SOURCED_DATA_FILE],
  ])('apps/core-server holds no %s', (_label, pattern) => {
    expect(occurrences(server, pattern)).toEqual([]);
  });

  it('no npm script of the workspace carries a secret or reads the data directory', () => {
    const manifest = server.find((file) => file.path === 'package.json');
    const scripts = (JSON.parse(manifest?.text ?? '{}') as { scripts?: Record<string, string> }).scripts ?? {};
    expect(Object.keys(scripts).length).toBeGreaterThan(0);
    const suspicious = Object.entries(scripts)
      .filter(([, command]) => /passw|secret|token|credential|\.data\//i.test(command))
      .map(([name]) => name);
    expect(suspicious).toEqual([]);
  });

  it('SR-9: the script `operator:set-password` runs exactly its entry file, with no further argument', () => {
    // WHY THE ENTRY IS NAMED `cli/operator-set.ts` (task 4 row 215; decisions C64, C71 (b), C72;
    // security review 221 section 7 (b); code review 222 F-08). The rule above reads the COMMAND
    // TEXT of every script and refuses a word that looks like a secret in it. The logic of this
    // command is `cli/operator-set-password-command.ts`; an entry named after it would put that
    // word into the script line, so the entry carries the shorter name. Ruled in C72: THE CODE IS
    // RIGHT, AND THE RULE IS WIDE ON PURPOSE - its purpose is that no script line carries a secret,
    // a file name is not one, and the rule is not narrowed for it. So the name is not an oversight:
    // do not "repair" it to match the other commands (`X.ts` / `X-command.ts`), do not add an
    // exception to the rule above, and do not widen the script. The command is pinned here BY NAME:
    // the script is these two words and nothing else - no option, no variable, no value. Everything
    // the command needs is typed after `--` by the person, and a password only at the terminal.
    const manifest = server.find((file) => file.path === 'package.json');
    const scripts = (JSON.parse(manifest?.text ?? '{}') as { scripts?: Record<string, string> }).scripts ?? {};
    const entry = ['cli', 'operator-set.ts'].join('/');
    const pinned = (given: Record<string, string>): boolean => given['operator:set-password'] === `tsx ${entry}`;
    expect(scripts['operator:set-password']).toBe(`tsx ${entry}`);
    expect(pinned(scripts)).toBe(true);
    expect(server.map((file) => file.path)).toContain(entry);
    // The one script of its family, and the only script that names this entry.
    expect(Object.keys(scripts).filter((name) => name.startsWith('operator:'))).toEqual(['operator:set-password']);
    expect(Object.entries(scripts).filter(([, command]) => command.includes(entry)).map(([name]) => name)).toEqual(['operator:set-password']);
    // Positive control: the pin is exact. An argument, a variable before the program or the other file name is not this command.
    for (const other of [`tsx ${entry} --all-demo`, `DEMS_X=1 tsx ${entry}`, `tsx ${entry.replace('.ts', '-command.ts')}`, `node ${entry}`]) {
      expect(pinned({ ...scripts, 'operator:set-password': other }), other).toBe(false);
    }
    expect(pinned({})).toBe(false);
  });

  it('the server runtime starts no child process but the capture worker, so no secret can become a process argument', () => {
    // ONE file may import the process module: the process channel of the capture supervisor
    // (task 3 row 57; capture spec §G G-R2, SEC35-25). Its own guard,
    // `src/capture/__tests__/static.test.ts`, holds what makes that safe: one spawn, no shell,
    // never the server's environment, fixed arguments. Every other runtime source is refused here
    // as before.
    const CAPTURE_PROCESS_CHANNEL = 'src/capture/ipc.ts';
    const childProcess = new RegExp(`['"](?:node:)?${['child', 'process'].join('_')}['"]`, 'g');
    const runtime = (path: string): boolean => isProductionSource(path) && !path.startsWith('src/db/');
    // A SECOND pinned file (task 3 row 134; decision D95; capture spec §A.6.4 HL-2): the door of the
    // local-device helpers. Same rules, held by `src/capture/adapters/local/__tests__/camera-helper.test.ts`.
    const LOCAL_HELPER_DOOR = 'src/capture/adapters/local/process-door.ts';
    // A THIRD pinned file (task 4 row 21, WP-02; decision text SR-1 entry 1): the door of the production
    // programs. It is the one place a secret goes to a child, and it goes to standard input: never an
    // argument. Held by `src/capture/adapters/__tests__/static.test.ts` (A-8) and `production-door.test.ts`.
    const PRODUCTION_DOOR = 'src/capture/adapters/production-door.ts';
    expect(occurrences(server, childProcess, (path) => runtime(path) && path !== CAPTURE_PROCESS_CHANNEL && path !== LOCAL_HELPER_DOOR && path !== PRODUCTION_DOOR)).toEqual([]);
    expect([...new Set(occurrences(server, childProcess, runtime).map((place) => place.replace(/:\d+$/, '')))].sort()).toEqual([LOCAL_HELPER_DOOR, PRODUCTION_DOOR, CAPTURE_PROCESS_CHANNEL]);
  });
});

describe('T-CR-2 (c): the owner-role file', () => {
  it('is named under src/ only by the reset routine and the command folder', () => {
    const elsewhere = (path: string): boolean => path.startsWith('src/') && !under(path, OWNER_FILE_PLACES);
    expect(occurrences(server, literal(OWNER_FILE), elsewhere)).toEqual([]);
  });

  it('the scaffold of plan row W08 names neither of the two other credential files', () => {
    const scaffold = (path: string): boolean => under(path, SCAFFOLD_PLACES);
    expect(occurrences(server, literal(OWNER_FILE), scaffold)).toEqual([]);
    expect(occurrences(server, literal(SUPERUSER_FILE), scaffold)).toEqual([]);
  });

  it('the loader opens exactly one file of the data directory', () => {
    const loader = server.filter((file) => file.path.startsWith('src/plugins/config/') && isProductionSource(file.path));
    expect(loader.map((file) => file.path).sort()).toEqual([
      'src/plugins/config/connection-file.ts',
      'src/plugins/config/index.ts',
      'src/plugins/config/load-config.ts',
    ]);
    // One call that reads a file, and it reads the path it was given.
    const reads = occurrences(loader, /\breadFileSync\(/g);
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatch(/^src\/plugins\/config\/connection-file\.ts:\d+$/);
    expect(occurrences(loader, /\b(?:readFile|createReadStream|openSync|open)\(/g)).toEqual([]);
  });
});
