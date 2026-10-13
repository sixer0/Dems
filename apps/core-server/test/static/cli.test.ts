// Static guard: the host commands in `cli/` (task 4 row X4; code review 222 finding F-06; decisions
// C54 (1) and C72).
//
// WHY THIS FILE EXISTS. The commands under `cli/` write the signing key store and operator
// credentials. They lie outside `src/` on purpose (a command is not the server), and every other
// static rule of this workspace reads `src/**` only (`scan.ts` `isProductionSource`), so until this
// file nothing but the typecheck looked at them. The rules here are the ones `src/` would have held:
//
//   A. THE CLOSED LIST. Which files `cli/` holds, and what each one is: a process ENTRY (thin: the
//      arguments of the process, its streams, its terminal, its exit status - no logic), a COMMAND
//      (a function with ports that owns no process and no terminal), or the PROMPT (the terminal
//      port of the hidden line, with its attended check).
//   B. WHAT A COMMAND MAY IMPORT. Every import that leaves `cli/` is on a named list with its
//      reason, and the list says which of them reach INSIDE a closed unit. A new one is a decision.
//   C. NO SECRET REACHES OUTPUT. No output call, error-log call or error constructor takes a
//      variable named for a secret or anything the prompt returned; the prompt's value is never
//      part of a string; every use of the typed value, of the stored hash set and of the database
//      credential is one of a closed list of named uses; no cli file that holds a secret can start
//      a process, and nothing writes the environment or the argument list.
//   D. NO SECRET FROM THE ENVIRONMENT. The environment is read in two named places and for no
//      secret; the password command refuses password-like variable NAMES before anything is read.
//   E. THE SCRIPTS. An npm script that runs a cli entry is `tsx cli/<entry>.ts` and nothing else:
//      it carries no value.
//   F. THE REST OF WHAT `src/` HOLDS: no cryptography, no file read, one written table, no audit
//      table by name; the folder is typechecked and counted in coverage.
//
// Every rule is a function over source texts and is run twice: on the real files (no finding) and
// on planted files (the finding it must make). A forbidden text is built from fragments where
// another guard of this workspace would otherwise find it in this file.
import { describe, expect, it } from 'vitest';
import { relativeImports, topFoldersOf, unitOf } from './imports';
import { SCAN_COVERS, WORKSPACE, codeOnly, occurrences, readTree, scanCoverage, type SourceFile } from './scan';

const tree = readTree(WORKSPACE);
const all = tree.filter((file) => file.path.startsWith('cli/') && file.path.endsWith('.ts'));
const code = codeOnly(all);
const topFolders = topFoldersOf(tree);
const treePaths = new Set(tree.map((file) => file.path));

const fileOf = (path: string, where: readonly SourceFile[] = code): SourceFile => where.find((file) => file.path === path) ?? { path, text: '' };
const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

// ── A. The closed list ─────────────────────────────────────────────────────────────────────────

interface EntrySpec {
  /** The one command function the entry starts. */
  readonly runs: string;
  /** Where that function is imported from. */
  readonly from: string;
  /** The npm script that runs the entry. */
  readonly script: string;
  /** How many `if` the entry holds (its terminal test, its unanswered line, its own start). */
  readonly branches: number;
}

/** The process entries: thin files. Each is started by exactly one npm script. */
const ENTRIES: Readonly<Record<string, EntrySpec>> = {
  'cli/mark-compromised.ts': { runs: 'runMarkCompromisedCommand', from: './mark-compromised-command', script: 'evidence:mark-compromised', branches: 1 },
  'cli/operator-set.ts': { runs: 'runSetPasswordCommand', from: './operator-set-password-command', script: 'operator:set-password', branches: 3 },
  'cli/production-key.ts': { runs: 'runProductionKeyCommand', from: './production-key-command', script: 'evidence:production-key', branches: 3 },
  'cli/rotate-key.ts': { runs: 'runRotateKeyCommand', from: './rotate-key-command', script: 'evidence:rotate-key', branches: 1 },
  // The receiver's entry (task 3): its command function lies in `src/evidence-export/receiver-cli.ts`.
  'cli/verify-export.ts': { runs: 'runReceiverCommand', from: '../src/evidence-export/receiver-cli', script: 'evidence:verify-export', branches: 3 },
};

/** The command functions: logic with ports. They own no process, no stream and no terminal. */
const COMMANDS: Readonly<Record<string, string>> = {
  'cli/mark-compromised-command.ts': 'runMarkCompromisedCommand',
  'cli/operator-set-password-command.ts': 'runSetPasswordCommand',
  'cli/production-key-command.ts': 'runProductionKeyCommand',
  'cli/rotate-key-command.ts': 'runRotateKeyCommand',
};

/**
 * The terminal port of the hidden line (row 213). It is neither of the two kinds: it owns the
 * terminal (as an entry does) and holds the read loop (logic), and it carries the attended check a
 * person runs with `npx tsx cli/secret-prompt.ts` - which has NO npm script (review 222, 5.4).
 */
const PROMPT = 'cli/secret-prompt.ts';

const CLI_FILES = [...Object.keys(ENTRIES), ...Object.keys(COMMANDS), PROMPT].sort();

/** A thin entry holds at most this many lines of code. The largest today holds 47. */
const ENTRY_CODE_LINES_MAX = 50;

/** The members of `process` each file names. A command names none. */
const PROCESS_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  'cli/mark-compromised.ts': ['argv', 'exitCode', 'stderr'],
  'cli/operator-set.ts': ['argv', 'env', 'exitCode', 'getuid', 'stderr', 'stdin', 'stdout'],
  'cli/production-key.ts': ['argv', 'exitCode', 'getuid', 'stderr', 'stdin', 'stdout'],
  'cli/rotate-key.ts': ['argv', 'exitCode', 'stderr'],
  'cli/verify-export.ts': ['argv', 'cwd', 'env', 'exitCode', 'stderr', 'stdout'],
  [PROMPT]: ['argv', 'exitCode', 'kill', 'listenerCount', 'off', 'on', 'pid', 'stderr', 'stdin', 'stdout'],
};

const PROCESS_MEMBER = new RegExp(`\\b${'process'}\\s*\\.\\s*([A-Za-z_]\\w*)`, 'g');
const PROCESS_INDEXED = new RegExp(`\\b${'process'}\\s*\\[`, 'g');
const PROCESS_EXIT_CALL = new RegExp(`\\b${'process'}\\s*\\.\\s*exit\\s*\\(`, 'g');
const OWN_START = (base: string): string => `const invoked = process.argv[1] !== undefined && /${base}\\.[cm]?[jt]s$/.test(process.argv[1]);`;
const count = (text: string, pattern: RegExp): number => [...text.matchAll(pattern)].length;
const processMembersOf = (text: string): string[] => [...new Set([...text.matchAll(PROCESS_MEMBER)].map((match) => match[1] ?? ''))].sort();
const codeLinesOf = (text: string): number => text.split('\n').filter((line) => line.trim() !== '').length;

/** What is wrong with one entry file. */
function entryProblems(file: SourceFile, spec: EntrySpec): string[] {
  const problems: string[] = [];
  const base = file.path.replace(/^cli\//, '').replace(/\.ts$/, '');
  const say = (what: string): void => void problems.push(`${file.path}: ${what}`);
  if (!file.text.includes(OWN_START(base))) say('does not start on its own file name only');
  if (count(file.text, /\bif \(invoked\) \{/g) !== 1) say('does not hold exactly one start block');
  if (count(file.text, /\brun[A-Z]\w*\(/g) !== 1 || !file.text.includes(`${spec.runs}(process.argv.slice(2), `)) say(`does not start ${spec.runs} exactly once, with the arguments of the process`);
  if (file.text.indexOf(`${spec.runs}(`) < file.text.indexOf('if (invoked) {')) say('starts its command outside the start block');
  if (!new RegExp(`\\b${spec.runs}\\b[^;]*\\bfrom '${spec.from.replace(/[.]/g, '\\.')}';`).test(file.text)) say(`does not import ${spec.runs} from ${spec.from}`);
  if (count(file.text, /\bprocess\.exitCode = /g) !== 2) say('does not set the exit status in exactly two places (done, failed)');
  if (count(file.text, /\bif\s*\(/g) !== spec.branches) say(`holds ${count(file.text, /\bif\s*\(/g)} branches, not ${spec.branches}`);
  const logic = [...file.text.matchAll(/\b(?:for|while|switch|try|catch|parseArgs|class)\b|['"`](?:SELECT|INSERT|UPDATE|DELETE)\s/g)].map((match) => match[0].trim());
  if (logic.length > 0) say(`holds logic: ${[...new Set(logic)].join(', ')}`);
  if (codeLinesOf(file.text) > ENTRY_CODE_LINES_MAX) say(`holds ${codeLinesOf(file.text)} lines of code, more than ${ENTRY_CODE_LINES_MAX}`);
  return problems;
}

/** What is wrong with one command file. */
function commandProblems(file: SourceFile, runs: string): string[] {
  const problems: string[] = [];
  const say = (what: string): void => void problems.push(`${file.path}: ${what}`);
  if (!new RegExp(`export async function ${runs}\\(arg(?:s|v): readonly string\\[\\], ports: \\w+\\)`).test(file.text)) say(`does not export ${runs}(argv, ports)`);
  if (processMembersOf(file.text).length > 0) say(`names the process: ${processMembersOf(file.text).join(', ')}`);
  if (/\bconst invoked\b/.test(file.text)) say('holds a start block');
  if (new RegExp(`\\b${'console'}\\s*\\.`).test(file.text)) say('writes to the console');
  if (/['"]node:(?:readline|tty)['"]/.test(file.text)) say('owns a terminal');
  return problems;
}

describe('A. the closed list of cli files', () => {
  it('the scan reads the folder, the whole of it and nothing else, and the folder holds the pinned files', () => {
    expect(scanCoverage(all, ['cli/'])).toEqual(SCAN_COVERS);
    expect(all.map((file) => file.path)).toEqual(CLI_FILES);
    // Nothing but TypeScript sources lies in the folder: no script, no data file, no sub-folder.
    expect(tree.filter((file) => file.path.startsWith('cli/')).map((file) => file.path)).toEqual(CLI_FILES);
  });

  it('every entry is thin: it starts one command with the arguments of the process and sets the exit status', () => {
    for (const [path, spec] of Object.entries(ENTRIES)) expect(entryProblems(fileOf(path), spec), path).toEqual([]);
  });

  it('every command is a function with ports: no process, no console, no terminal, no start block', () => {
    for (const [path, runs] of Object.entries(COMMANDS)) expect(commandProblems(fileOf(path), runs), path).toEqual([]);
  });

  it('each file names exactly its pinned members of the process, never by index and never an exit call', () => {
    const named = Object.fromEntries(code.map((file) => [file.path, processMembersOf(file.text)]).filter(([, members]) => (members as string[]).length > 0));
    expect(named).toEqual(PROCESS_MEMBERS);
    expect(occurrences(code, PROCESS_INDEXED)).toEqual([]);
    expect(occurrences(code, PROCESS_EXIT_CALL)).toEqual([]);
  });

  it('finds an entry with logic, a command that owns the process and a file outside the list (planted control)', () => {
    const entry: SourceFile = {
      path: 'cli/rotate-key.ts',
      text: [
        "import { parseArgs } from 'node:util';",
        "import { RotateKeyExit, runRotateKeyCommand } from './rotate-key-command';",
        'const invoked = process.argv[1] !== undefined;',
        'for (const argument of process.argv) if (argument === "x") process.exitCode = 2;',
        'if (invoked) {',
        '  runRotateKeyCommand(process.argv.slice(2), ports()).then((run) => { process.exitCode = run.code; }, () => { process.exitCode = RotateKeyExit.REFUSED; });',
        '}',
      ].join('\n'),
    };
    expect(entryProblems(entry, ENTRIES['cli/rotate-key.ts'] as EntrySpec)).toEqual([
      'cli/rotate-key.ts: does not start on its own file name only',
      'cli/rotate-key.ts: does not set the exit status in exactly two places (done, failed)',
      'cli/rotate-key.ts: holds 2 branches, not 1',
      'cli/rotate-key.ts: holds logic: parseArgs, for',
    ]);
    const command: SourceFile = {
      path: 'cli/rotate-key-command.ts',
      text: `import { isatty } from 'node:tty';\nexport async function runRotateKeyCommand(argv: readonly string[], ports: P) { ${'console'}.log(process.argv); process.stdout.write('x'); }\nconst invoked = true;`,
    };
    expect(commandProblems(command, 'runRotateKeyCommand')).toEqual([
      'cli/rotate-key-command.ts: names the process: argv, stdout',
      'cli/rotate-key-command.ts: holds a start block',
      'cli/rotate-key-command.ts: writes to the console',
      'cli/rotate-key-command.ts: owns a terminal',
    ]);
    expect(commandProblems({ path: 'cli/x-command.ts', text: 'export function other() {}' }, 'runX')).toEqual(['cli/x-command.ts: does not export runX(argv, ports)']);
    expect(occurrences([{ path: 'cli/x.ts', text: `process['env']; process.exit(1);` }], PROCESS_INDEXED)).toEqual(['cli/x.ts:1']);
    expect(occurrences([{ path: 'cli/x.ts', text: `process['env']; process.exit(1);` }], PROCESS_EXIT_CALL)).toEqual(['cli/x.ts:1']);
    expect(scanCoverage([...all, { path: 'cli/new-command.ts', text: '' }], ['cli/']).unexpected).toEqual(['cli/new-command.ts']);
  });
});

// ── B. What a cli file may import ──────────────────────────────────────────────────────────────

/**
 * How an import reaches the server: the index of a unit, the index of a sub-folder a unit offers,
 * a file directly under `src/` (in no unit), or a file INSIDE a unit, past its index. The last
 * kind is what review 222 F-06 named: the server's own rule ("a closed unit through its index",
 * `imports.test.ts`) does not read `cli/`, so each such import is held here, by name.
 */
type Reach = 'INDEX' | 'SUB_INDEX' | 'TOP_FILE' | 'INSIDE';

/** Every server module a cli file imports today. A new line here is a decision, not a convenience. */
const SERVER_IMPORTS: Readonly<Record<string, { readonly reach: Reach; readonly why: string }>> = {
  'src/capture': { reach: 'INDEX', why: 'the signer store through the capture unit\'s index: provision, load, rotate, mark; the certificate type' },
  'src/capture/boot': { reach: 'SUB_INDEX', why: 'the statement and predicate of boot check 4c, so the command counts what the boot will count (R-X2-11)' },
  'src/capture/boot/checks': { reach: 'INSIDE', why: 'the closed list of reserved installation ids of boot check 4b-3, asked where the boot asks it: a key command makes no key for an id a production start refuses (decision C86, row K6); the boot index does not export it' },
  'src/config': { reach: 'TOP_FILE', why: 'the names the loader uses: runtime role, database host, connection file name, the installation id pattern' },
  'src/version': { reach: 'TOP_FILE', why: 'the program version written into a provisioning record' },
  'src/sealing/signing': { reach: 'INSIDE', why: 'the REAL load of the sealing signer, so a command proves the store with the function the Core uses (SX-05)' },
  'src/core/audit-details': { reach: 'INSIDE', why: 'the fixed severity of OPERATOR_PASSWORD_SET (SX-14); the core index does not export it' },
  'src/core/clock': { reach: 'INSIDE', why: 'the server clock and its floor: nothing reads the time before the floor is raised (decision D110)' },
  'src/core/pipeline': { reach: 'INSIDE', why: 'the Core\'s own unit of work, so the credential and its audit row are one transaction on the chain (SX-02)' },
  'src/core/types': { reach: 'INSIDE', why: 'the type of that unit of work (types only)' },
  'src/db/schema/boot-checks': { reach: 'INSIDE', why: 'the schema version check the Core runs at boot (SX-12, R-X2-8)' },
  'src/engine/rehydrate': { reach: 'INSIDE', why: 'the newest stored instant, for the clock floor (decision D110)' },
  'src/modules/identity': { reach: 'INDEX', why: 'the password policy and the repeat guard of one run (SX-13, R-X2-6)' },
  'src/modules/identity/biometric': { reach: 'SUB_INDEX', why: 'biometric tokens of the operator are revoked with the credential (CREDENTIAL_REPLACED)' },
  'src/modules/identity/password-hash': { reach: 'SUB_INDEX', why: 'the one hasher of the server and the type of its record (R-X2-5)' },
  'src/modules/identity/session-store': { reach: 'INSIDE', why: 'the statement that ends an operator\'s sessions; the identity index does not export it' },
  'src/plugins/config/connection-file': { reach: 'INSIDE', why: 'the server\'s own reader of the connection file: the command parses nothing itself (SX-03)' },
  'src/plugins/db': { reach: 'INDEX', why: 'the pool of the runtime role, as the Core opens it (SX-03)' },
  'src/plugins/logger': { reach: 'INDEX', why: 'the persistent error log: codes and ids of a failure' },
  'src/evidence-export/receiver-cli': { reach: 'INSIDE', why: 'the receiver\'s command function (task 3, ruling D200): its entry is the cli file' },
};

/** Which file imports which server module. */
const SERVER_IMPORTS_OF: Readonly<Record<string, readonly string[]>> = {
  'cli/mark-compromised-command.ts': ['src/capture', 'src/sealing/signing'],
  'cli/operator-set-password-command.ts': [
    'src/capture/boot',
    'src/config',
    'src/core/audit-details',
    'src/core/clock',
    'src/core/pipeline',
    'src/core/types',
    'src/db/schema/boot-checks',
    'src/engine/rehydrate',
    'src/modules/identity',
    'src/modules/identity/biometric',
    'src/modules/identity/password-hash',
    'src/modules/identity/session-store',
    'src/plugins/config/connection-file',
    'src/plugins/logger',
  ],
  'cli/operator-set.ts': ['src/core/clock', 'src/modules/identity/password-hash', 'src/plugins/db', 'src/plugins/logger'],
  'cli/production-key-command.ts': ['src/capture', 'src/capture/boot/checks', 'src/config', 'src/sealing/signing', 'src/version'],
  'cli/rotate-key-command.ts': ['src/capture', 'src/config', 'src/sealing/signing', 'src/version'],
  'cli/verify-export.ts': ['src/evidence-export/receiver-cli'],
};

/** The imports inside the folder. */
const SIBLING_IMPORTS_OF: Readonly<Record<string, readonly string[]>> = {
  'cli/mark-compromised-command.ts': ['cli/production-key-command'],
  'cli/mark-compromised.ts': ['cli/mark-compromised-command', 'cli/production-key'],
  'cli/operator-set-password-command.ts': ['cli/production-key-command', 'cli/secret-prompt'],
  'cli/operator-set.ts': ['cli/operator-set-password-command', 'cli/secret-prompt'],
  'cli/production-key.ts': ['cli/production-key-command'],
  'cli/rotate-key-command.ts': ['cli/production-key-command'],
  'cli/rotate-key.ts': ['cli/production-key', 'cli/rotate-key-command'],
};

const PROCESS_MODULE = ['node:child', 'process'].join('_');
/** The packages and built-ins each file imports. `fastify` and `pg` are imported for their types only. */
const PACKAGE_IMPORTS_OF: Readonly<Record<string, readonly string[]>> = {
  'cli/mark-compromised-command.ts': ['node:path', 'node:util'],
  'cli/operator-set-password-command.ts': ['@dems/shared/sim', 'fastify', 'node:path', 'node:util', 'pg'],
  'cli/operator-set.ts': ['node:readline', 'node:tty'],
  'cli/production-key-command.ts': ['@dems/shared/evidence-verify', 'node:fs', 'node:path', 'node:util'],
  'cli/production-key.ts': ['node:readline'],
  'cli/rotate-key-command.ts': ['@dems/shared/evidence-verify', 'node:fs', 'node:path', 'node:util'],
  [PROMPT]: ['node:buffer', 'node:tty'],
  'cli/verify-export.ts': [PROCESS_MODULE],
};
const TYPE_ONLY_PACKAGES = ['fastify', 'pg'];

const PACKAGE_SPECIFIER = /\b(?:from|import)\s*(['"])([^.'"\n][^'"\n]*)\1/g;
const LOADED_AT_RUN_TIME = /\brequire\s*\(|\bimport\s*\(/g;

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();
function grouped(pairs: ReadonlyArray<readonly [string, string]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [file, value] of pairs) out[file] = sorted([...(out[file] ?? []), value]);
  return out;
}
const withoutIndex = (target: string): string => target.replace(/\/index$/, '');

/** How `target` reaches the server, read from the tree. */
function reachOf(target: string, paths: ReadonlySet<string>, folders: ReadonlySet<string>): Reach {
  const unit = unitOf(target, folders);
  if (unit === null) return 'TOP_FILE';
  if (target === unit) return 'INDEX';
  return paths.has(`${target}/index.ts`) ? 'SUB_INDEX' : 'INSIDE';
}

interface ImportFacts {
  readonly server: Record<string, string[]>;
  readonly siblings: Record<string, string[]>;
  readonly packages: Record<string, string[]>;
  /** Imports that leave `cli/` for anything but `src/` (test code, another workspace by path). */
  readonly elsewhere: string[];
}

function importFacts(files: readonly SourceFile[]): ImportFacts {
  const relative = relativeImports(files).map((entry) => ({ ...entry, target: withoutIndex(entry.target) }));
  return {
    server: grouped(relative.filter((entry) => entry.target.startsWith('src/')).map((entry) => [entry.file, entry.target] as const)),
    siblings: grouped(relative.filter((entry) => entry.target.startsWith('cli/')).map((entry) => [entry.file, entry.target] as const)),
    packages: grouped(files.flatMap((file) => [...file.text.matchAll(PACKAGE_SPECIFIER)].map((match) => [file.path, match[2] ?? ''] as const))),
    elsewhere: relative.filter((entry) => !entry.target.startsWith('src/') && !entry.target.startsWith('cli/')).map((entry) => `${entry.file}:${entry.line} ${entry.specifier}`),
  };
}

describe('B. what a cli file may import', () => {
  const facts = importFacts(code);

  it('every import of the server is on the named list, file by file', () => {
    expect(facts.server).toEqual(SERVER_IMPORTS_OF);
    expect(sorted(Object.values(SERVER_IMPORTS_OF).flat())).toEqual(Object.keys(SERVER_IMPORTS).sort());
    for (const [target, entry] of Object.entries(SERVER_IMPORTS)) expect(entry.why.length, target).toBeGreaterThan(20);
  });

  it('the list says truly which imports reach inside a unit, past its index', () => {
    for (const [target, entry] of Object.entries(SERVER_IMPORTS)) expect(reachOf(target, treePaths, topFolders), target).toBe(entry.reach);
    expect(Object.entries(SERVER_IMPORTS).filter(([, entry]) => entry.reach === 'INSIDE').map(([target]) => target).sort()).toEqual([
      'src/capture/boot/checks',
      'src/core/audit-details',
      'src/core/clock',
      'src/core/pipeline',
      'src/core/types',
      'src/db/schema/boot-checks',
      'src/engine/rehydrate',
      'src/evidence-export/receiver-cli',
      'src/modules/identity/session-store',
      'src/plugins/config/connection-file',
      'src/sealing/signing',
    ]);
  });

  it('nothing leaves the folder for test code or another place, and nothing is loaded at run time', () => {
    expect(facts.elsewhere).toEqual([]);
    expect(facts.siblings).toEqual(SIBLING_IMPORTS_OF);
    for (const target of Object.values(SIBLING_IMPORTS_OF).flat()) expect(CLI_FILES, target).toContain(`${target}.ts`);
    expect(occurrences(code, LOADED_AT_RUN_TIME)).toEqual([]);
  });

  it('the packages and built-ins are pinned; the web framework and the database driver are types only', () => {
    expect(facts.packages).toEqual(PACKAGE_IMPORTS_OF);
    for (const name of TYPE_ONLY_PACKAGES) {
      expect(occurrences(code, new RegExp(`\\bimport\\s+type\\s[^;]*\\bfrom '${name}';`, 'g'))).toHaveLength(1);
      expect(occurrences(code, new RegExp(`\\bfrom '${name}';`, 'g'))).toHaveLength(1);
    }
  });

  it('finds a new deep import, an import of test code, a new package and a run-time load (planted control)', () => {
    const planted: SourceFile[] = [
      { path: 'cli/rotate-key-command.ts', text: "import { auditInputOf } from '../src/core/audit-writer';\nimport { rig } from '../test/support/rig';\nimport { hkdf } from 'node:crypto';\nconst late = await import('../src/app');" },
    ];
    const found = importFacts(planted);
    expect(found.server).toEqual({ 'cli/rotate-key-command.ts': ['src/app', 'src/core/audit-writer'] });
    expect(found.server).not.toEqual(SERVER_IMPORTS_OF);
    expect(Object.keys(SERVER_IMPORTS)).not.toContain('src/core/audit-writer');
    expect(reachOf('src/core/audit-writer', treePaths, topFolders)).toBe('INSIDE');
    expect(found.elsewhere).toEqual(['cli/rotate-key-command.ts:2 ../test/support/rig']);
    expect(found.packages).toEqual({ 'cli/rotate-key-command.ts': ['node:crypto'] });
    expect(occurrences(planted, LOADED_AT_RUN_TIME)).toEqual(['cli/rotate-key-command.ts:4']);
  });
});

// ── C. No secret reaches output ────────────────────────────────────────────────────────────────

/** The index just past the string that opens at `at` (a quote or a backquote). */
function skipString(text: string, at: number): number {
  const quote = text[at];
  let index = at + 1;
  while (index < text.length) {
    const char = text[index];
    if (char === '\\') index += 2;
    else if (quote === '`' && char === '$' && text[index + 1] === '{') index = skipGroup(text, index + 1);
    else if (char === quote) return index + 1;
    else index += 1;
  }
  return index;
}

/** The index just past the bracket that closes the one at `at`. */
function skipGroup(text: string, at: number): number {
  let depth = 0;
  let index = at;
  while (index < text.length) {
    const char = text[index] ?? '';
    if (char === "'" || char === '"' || char === '`') {
      index = skipString(text, index);
      continue;
    }
    if ('({['.includes(char)) depth += 1;
    else if (')}]'.includes(char)) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return index;
}

/** The `${…}` expressions directly inside one template literal (its text without the backquotes). */
function expressionsOfTemplate(inner: string): string[] {
  const found: string[] = [];
  let index = 0;
  while (index < inner.length) {
    if (inner[index] === '\\') index += 2;
    else if (inner[index] === '$' && inner[index + 1] === '{') {
      const close = skipGroup(inner, index + 1);
      found.push(inner.slice(index + 2, close - 1));
      index = close;
    } else index += 1;
  }
  return found;
}

/**
 * What of a text is CODE: the words of a plain string are dropped, and of a template only its
 * `${…}` expressions are kept. Line breaks stay, so that a place keeps its line.
 */
function codeParts(text: string): string {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index] ?? '';
    if (char === "'" || char === '"' || char === '`') {
      const end = skipString(text, index);
      const whole = text.slice(index, end);
      out += ' ';
      if (char === '`') out += expressionsOfTemplate(whole.slice(1, -1)).map((expression) => ` ${codeParts(expression)} `).join('');
      out += whole.replace(/[^\n]/g, '');
      index = end;
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
}

/** Every `${…}` expression of every template literal of a text, with its line. */
function templateExpressions(text: string): Array<{ line: number; expression: string }> {
  const found: Array<{ line: number; expression: string }> = [];
  const visit = (part: string, offset: number): void => {
    let index = 0;
    while (index < part.length) {
      const char = part[index] ?? '';
      if (char === "'" || char === '"') index = skipString(part, index);
      else if (char === '`') {
        const end = skipString(part, index);
        for (const expression of expressionsOfTemplate(part.slice(index + 1, end - 1))) {
          found.push({ line: lineOf(text, offset + index), expression });
          visit(expression, offset + index);
        }
        index = end;
      } else index += 1;
    }
  };
  visit(text, 0);
  return found;
}

/** The argument text of every call whose callee matches `callee` (a global pattern that ends at the `(`). */
function callArguments(text: string, callee: RegExp): Array<{ line: number; argument: string }> {
  return [...text.matchAll(callee)].map((match) => {
    const open = match.index + match[0].length - 1;
    return { line: lineOf(text, open), argument: text.slice(open + 1, skipGroup(text, open) - 1) };
  });
}

/**
 * THE OUTPUT CALLS of the folder: the console, the two process streams, the `out` / `err` of a
 * port, the line functions of the commands (`say`, `refuse`), the error log (`persist`,
 * `errorLog.append`), a logger, the label of a prompt (`ask`, `readSecretLine`, `question`,
 * `terminal.write`), and the one file write of the key commands (`writeSync`).
 */
const OUTPUT_CALL = new RegExp(
  [
    `\\b${'console'}\\s*\\.\\s*\\w+\\(`,
    `\\b${'process'}\\s*\\.\\s*(?:stdout|stderr)\\s*\\.\\s*write\\(`,
    '\\b(?:ports|io)\\s*\\.\\s*(?:out|err|ask)\\(',
    '(?<![.\\w])(?:say|refuse|persist)\\(',
    '\\berrorLog\\s*\\.\\s*append\\(',
    '\\b(?:log|logger)\\s*\\.\\s*(?:trace|debug|info|warn|error|fatal)\\(',
    '\\breadSecretLine\\(',
    '\\b(?:terminal|reader)\\s*\\.\\s*(?:write|question)\\(',
    '\\bwriteSync\\(',
  ].join('|'),
  'g',
);
/** An error that is made or handed on: its text can end in a line, a log or a stack. */
const ERROR_CALL = /\bnew\s+\w*(?:Error|Stop)\(|\breject\(|\bsuper\(/g;
/** Every call that writes to a stream must be one of the output calls above. */
const ANY_STREAM_WRITE = /\.\s*write\(/g;

/**
 * A lower-case name that says "secret". Constants (`SET_PASSWORD_COMMAND`) and types
 * (`SetPasswordRefusal`) hold fixed words, never a value, and are not meant.
 */
const SECRET_NAME = /passw|secret|token|credential|wrap|privat|seed|pepper|salt|^hash$/i;

interface Held {
  /** What the prompt answered: an object. Only the named members may be written anywhere. */
  readonly answers: readonly string[];
  /** Names that hold a secret value, or bytes of one: never in an output call, an error or a string. */
  readonly values: readonly string[];
  /** Names that hold a secret among other members: only the named members may be written. */
  readonly partly: Readonly<Record<string, readonly string[]>>;
}
const NOTHING_HELD: Held = { answers: [], values: [], partly: {} };
const ANSWER_MEMBERS = ['code', 'cause'];

/** The files that hold a secret in a variable, and under which names. */
const HELD: Readonly<Record<string, Held>> = {
  'cli/operator-set-password-command.ts': {
    answers: ['first', 'second'],
    // The typed value and its aliases; the bytes; the hash set made of it; the fields of the connection file.
    values: ['typed', 'accepted', 'buffers', 'buffer', 'record', 'hashSet', 'fields'],
    partly: { connection: ['port'] },
  },
  [PROMPT]: {
    answers: ['answer'],
    // The prompt's own copies of what is typed.
    values: ['held', 'chunk'],
    partly: {},
  },
};

const word = (names: readonly string[]): string => (names.length === 0 ? '(?!)' : `(?:${names.join('|')})`);

/** What of a secret an expression names. Empty = nothing. */
function secretsIn(expression: string, held: Held): string[] {
  const text = codeParts(expression);
  const found: string[] = [];
  if (/\.\s*secret\b/.test(text)) found.push('.secret');
  for (const match of text.matchAll(new RegExp(`(?<![.\\w])${word(held.values)}\\b`, 'g'))) found.push(match[0]);
  for (const match of text.matchAll(new RegExp(`(?<![.\\w])(${word(held.answers)})\\b(?!\\s*\\.\\s*(?:${ANSWER_MEMBERS.join('|')})\\b)`, 'g'))) found.push(match[1] ?? '');
  for (const [name, members] of Object.entries(held.partly)) {
    for (const match of text.matchAll(new RegExp(`(?<![.\\w])(${name})\\b(?!\\s*\\.\\s*(?:${members.join('|')})\\b)`, 'g'))) found.push(match[1] ?? '');
  }
  for (const match of text.matchAll(/[A-Za-z_$][\w$]*/g)) if (/^[a-z]/.test(match[0]) && SECRET_NAME.test(match[0])) found.push(match[0]);
  return sorted(found);
}

/** Every output call, error and string of the files that names a secret: `path:line kind: names`. */
function outputProblems(files: readonly SourceFile[], heldOf: Readonly<Record<string, Held>> = HELD): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const held = heldOf[file.path] ?? NOTHING_HELD;
    const check = (kind: string, line: number, expression: string): void => {
      const names = secretsIn(expression, held);
      if (names.length > 0) problems.push(`${file.path}:${line} ${kind}: ${names.join(', ')}`);
    };
    for (const call of callArguments(file.text, OUTPUT_CALL)) check('output', call.line, call.argument);
    for (const call of callArguments(file.text, ERROR_CALL)) check('error', call.line, call.argument);
    for (const part of templateExpressions(file.text)) check('string', part.line, part.expression);
    for (const match of file.text.matchAll(/\bthrow\s+(?!new\b)([^;\n]+)/g)) check('error', lineOf(file.text, match.index), match[1] ?? '');
  }
  return sorted(problems);
}

/** The names a file binds to what the prompt answered, and to the value inside it (aliases, containers, loop names). */
function discoveredHeld(text: string): { answers: string[]; values: string[] } {
  const answers = sorted([...text.matchAll(/\b([A-Za-z_]\w*)\s*=\s*(?:await\s+)?[\w.]*\breadSecretLine\s*\(/g)].map((match) => match[1] ?? ''));
  const values = new Set<string>();
  for (let grew = true; grew; ) {
    const before = values.size;
    const from = `(?:${word(answers)}\\s*\\.\\s*secret\\b|${word([...values])}\\b(?!\\s*[!=]==))`;
    for (const match of text.matchAll(new RegExp(`\\b([A-Za-z_]\\w*)\\s*(?::[^=;\\n]*)?=\\s*(?:await\\s+)?${from}`, 'g'))) values.add(match[1] ?? '');
    for (const match of text.matchAll(new RegExp(`\\b([A-Za-z_]\\w*)\\s*\\.\\s*push\\(\\s*${from}`, 'g'))) values.add(match[1] ?? '');
    for (const match of text.matchAll(new RegExp(`\\bfor\\s*\\(\\s*const\\s+(\\w+)\\s+of\\s+${word([...values])}\\s*\\)`, 'g'))) values.add(match[1] ?? '');
    grew = values.size > before;
  }
  return { answers, values: [...values].sort() };
}

/**
 * THE NAMED USES of a secret in the password command. Each line is one form; `A` stands for an
 * answer of the prompt. After every form is taken out of the file, nothing of the names may be
 * left: a new use of the typed value, of the hash set or of the database credential fails here
 * and is a decision.
 */
const PASSWORD_COMMAND = 'cli/operator-set-password-command.ts';
const A = '(?:first|second)';
const NAMED_USES: ReadonlyArray<readonly [RegExp, string]> = [
  [new RegExp(`const ${A} = await ports\\.prompt\\.readSecretLine\\(`, 'g'), 'the two hidden entries of one operator'],
  [new RegExp(`\\bbuffers\\.push\\(${A}\\.secret\\);`, 'g'), 'the bytes are remembered only to be zeroed'],
  [/const buffers: Buffer\[\] = \[\];/g, 'the list of what is to be zeroed'],
  [/for \(const buffer of buffers\) buffer\.fill\(0\);/g, 'zeroed on every way out'],
  [new RegExp(`\\b${A}\\.secret\\.length === 0`, 'g'), 'an empty first entry skips the operator'],
  [new RegExp(`!${A}\\.secret\\.equals\\(${A}\\.secret\\)`, 'g'), 'the two entries are compared as bytes'],
  [new RegExp(`const typed = ${A}\\.secret\\.toString\\('utf8'\\);`, 'g'), 'the one text copy, for the policy and the hasher'],
  [/checkNewPassword\(typed, \{ username: target\.username \}\)/g, 'the policy, before hashing (R-X2-6)'],
  [/guard\.refusalOf\(typed\)/g, 'the repeat check of the run (SX-13)'],
  [/\brecord = await ports\.hasher\(typed\);/g, 'the one hasher (R-X2-5)'],
  [/\baccepted = typed;/g, 'kept until its unit has committed'],
  [/let accepted: string \| null = null;/g, 'declared empty'],
  [/\baccepted === null\b/g, 'asked whether there is one'],
  [/await guard\.remember\(accepted\);/g, 'remembered as a keyed digest, after the commit'],
  [/\baccepted = null;/g, 'dropped'],
  [new RegExp(`\\b${A}\\.(?:kind|code)\\b`, 'g'), 'the outcome of an entry and the code of a refused one: fixed words'],
  [/let record: PasswordHashRecord \| null = null;/g, 'the hash set of this operator, declared empty'],
  [/\brecord === null\b/g, 'asked whether there is one'],
  [/const hashSet = record;/g, 'handed to the unit'],
  [/\[target\.operatorId, hashSet\.algorithm, hashSet\.memoryKib, hashSet\.passes, hashSet\.parallelism, hashSet\.salt, hashSet\.hash, now\]/g, 'the parameters of the ONE credential statement'],
  [/const fields = readConnectionFile\(file\);/g, 'the connection file, by the server\'s reader'],
  // Before the next form: a form is taken out of the text in this order.
  [/connection = \{ host: DATABASE_HOST, port: Number\(fields\.port\), database: args\.database, user: fields\.user, password: fields\.password \};/g, 'the credential goes into the connection object'],
  [/\bfields\.(?:user|host|port)\b/g, 'the three fields that are judged'],
  [/let connection: DatabaseConnection;/g, 'declared'],
  [/openPool\(connection: DatabaseConnection\): Pool;/g, 'the port that opens the pool'],
  [/ports\.openPool\(connection\)/g, 'the connection object goes to the pool of the runtime role, and nowhere else'],
  [/\bconnection\.port\b/g, 'the port number, shown'],
];
const HELD_NAMES = ['first', 'second', 'typed', 'accepted', 'buffers', 'buffer', 'record', 'hashSet', 'fields', 'connection'];

/** The uses of a secret in the password command that are not one of the named uses: `line: name`. */
function unnamedUses(text: string): string[] {
  let rest = text;
  for (const [form] of NAMED_USES) rest = rest.replace(form, (match) => match.replace(/[^\n]/g, ' '));
  const left = codeParts(rest);
  return [...left.matchAll(new RegExp(`\\.\\s*secret\\b|(?<![.\\w])${word(HELD_NAMES)}\\b`, 'g'))].map((match) => `${lineOf(left, match.index)}: ${match[0]}`);
}

/** The files that can start another process, and the files that hold a secret in a variable. */
const STARTS_A_PROCESS = ['cli/verify-export.ts'];
const HOLDS_A_SECRET = ['cli/operator-set-password-command.ts', 'cli/operator-set.ts', PROMPT];
const PROCESS_START = new RegExp(`['"](?:node:)?${['child', 'process'].join('_')}['"]|['"](?:node:)?(?:worker_threads|cluster)['"]|\\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\\s*\\(`, 'g');
const ENVIRONMENT_OR_ARGUMENT_WRITE = new RegExp(
  `\\b${'process'}\\s*\\.\\s*(?:env|argv)\\b(?:\\s*\\.\\s*\\w+|\\s*\\[[^\\]]*\\])?\\s*=(?!=)|\\b${'process'}\\s*\\.\\s*argv\\s*\\.\\s*(?:push|unshift|splice)\\(|\\bObject\\s*\\.\\s*assign\\(\\s*${'process'}\\s*\\.\\s*env\\b|\\b${'process'}\\s*\\.\\s*title\\b`,
  'g',
);

describe('C. no secret reaches output', () => {
  it('no output call, no error and no string names a secret or what the prompt returned', () => {
    expect(outputProblems(code)).toEqual([]);
    // The rule looks at something: the folder holds output calls, errors and built strings.
    expect(code.flatMap((file) => callArguments(file.text, OUTPUT_CALL)).length).toBeGreaterThan(100);
    expect(code.flatMap((file) => callArguments(file.text, ERROR_CALL)).length).toBeGreaterThanOrEqual(8);
    expect(code.flatMap((file) => templateExpressions(file.text)).length).toBeGreaterThan(100);
  });

  it('every write to a stream is one of the output calls the rule reads', () => {
    expect(occurrences(code, ANY_STREAM_WRITE).length).toBe(code.flatMap((file) => callArguments(file.text, /\b(?:process\s*\.\s*(?:stdout|stderr)|terminal)\s*\.\s*write\(/g)).length);
    expect(occurrences(code, ANY_STREAM_WRITE).length).toBeGreaterThanOrEqual(10);
  });

  it('the names that hold a secret are the pinned ones: the prompt is read in two files, and its value has no other alias', () => {
    const readers = code.filter((file) => /\breadSecretLine\s*\(/.test(file.text)).map((file) => file.path);
    expect(readers).toEqual(['cli/operator-set-password-command.ts', PROMPT]);
    expect(discoveredHeld(fileOf(PASSWORD_COMMAND).text)).toEqual({ answers: ['first', 'second'], values: ['accepted', 'buffer', 'buffers', 'typed'] });
    expect(discoveredHeld(fileOf(PROMPT).text)).toEqual({ answers: ['answer'], values: [] });
    for (const [path, held] of Object.entries(HELD)) {
      const found = discoveredHeld(fileOf(path).text);
      expect(held.answers, path).toEqual(found.answers);
      for (const name of found.values) expect(held.values, path).toContain(name);
    }
    // The answer is never taken apart into loose names.
    expect(occurrences(code, /\{[^{}\n]*\bsecret\b[^{}\n]*\}\s*=\s*(?!>)/g)).toEqual([]);
  });

  it('every use of the typed value, the hash set and the database credential in the password command is a named use', () => {
    const text = fileOf(PASSWORD_COMMAND).text;
    expect(unnamedUses(text)).toEqual([]);
    for (const [form, why] of NAMED_USES) expect(count(text, form), why).toBeGreaterThanOrEqual(1);
    // Once each: one text copy, one hasher call, one remembered digest, one pool, one written credential.
    for (const once of [/\.secret\.toString\(/g, /\bports\.hasher\(/g, /\bguard\.remember\(/g, /\bports\.openPool\(/g, /\bfields\.password\b/g, /\bhashSet\.hash\b/g]) expect(count(text, once), String(once)).toBe(1);
    // The bytes are zeroed in a `finally`, and the prompt zeroes its own copy before it answers.
    expect(text).toMatch(/\} finally \{\s*for \(const buffer of buffers\) buffer\.fill\(0\);\s*\}/);
    expect(fileOf(PROMPT).text).toMatch(/held\.fill\(0\);/);
  });

  it('the prompt answers its failures with fixed words: its one error takes a code, never a value or a cause', () => {
    const prompt = fileOf(PROMPT).text;
    expect(callArguments(prompt, /\bnew\s+\w*Error\(/g).map((call) => call.argument).sort()).toEqual(["'BUSY'", "'NOT_A_TERMINAL'", "'TERMINAL_ERROR'"]);
    expect(prompt).toMatch(/constructor\(code: SecretPromptFailureCode\) \{\s*super\(SECRET_PROMPT_FAILURE\[code\]\);/);
    // No error of the runtime is handed on inside it, and none is caught by name to be thrown again.
    expect(prompt).not.toMatch(/\{\s*cause\s*:\s*\w*err\w*\s*\}|\bcatch\s*\(\s*\w+\s*\)\s*\{\s*throw\b/i);
  });

  it('no file that holds a secret can start a process, and nothing writes the environment or the argument list', () => {
    const starters = sorted(occurrences(code, PROCESS_START).map((place) => place.replace(/:\d+$/, '')));
    // ONE file starts a process: the receiver's entry runs the system `unzip` with a fixed argument
    // list (task 3, ruling D200). It holds no secret, reads no prompt and imports no command.
    expect(starters).toEqual(STARTS_A_PROCESS);
    expect(STARTS_A_PROCESS.filter((path) => HOLDS_A_SECRET.includes(path))).toEqual([]);
    for (const path of STARTS_A_PROCESS) {
      expect(SIBLING_IMPORTS_OF[path], path).toBeUndefined();
      expect(fileOf(path).text, path).not.toMatch(/readSecretLine|secret-prompt/);
    }
    // The files that hold a secret: who reads the prompt, who is handed the hasher's input, the prompt itself.
    expect(sorted([...Object.keys(HELD), ...code.filter((file) => /from '\.\/secret-prompt'/.test(file.text)).map((file) => file.path)])).toEqual(HOLDS_A_SECRET);
    expect(occurrences(code, ENVIRONMENT_OR_ARGUMENT_WRITE)).toEqual([]);
  });

  it('finds a secret in an output call, in an error, in a string, under a new alias and in a new use (planted control)', () => {
    const held: Record<string, Held> = { 'cli/x-command.ts': HELD[PASSWORD_COMMAND] as Held, 'cli/y-command.ts': NOTHING_HELD };
    const planted: SourceFile[] = [
      {
        path: 'cli/x-command.ts',
        text: [
          'say(`set to ${typed}`);',
          'ports.out(first.secret.toString());',
          "persist('failed', code, { step: 'hash', value: accepted });",
          'throw new Error(`bad entry ${second}`);',
          'say(`not accepted (${first.code})`);',
          'const text = `at ${connection.port} as ${connection.password}`;',
          'process.stderr.write(String(hashSet.hash));',
          'reject(fields);',
          'throw record;',
        ].join('\n'),
      },
      {
        path: 'cli/y-command.ts',
        text: ['say(`the wrap is ${wrapSecret}`);', `${'console'}.log(privateKey, SET_PASSWORD_COMMAND, SetPasswordRefusal.ABORTED, 'the password is typed');`, 'log.info({ token });'].join('\n'),
      },
    ];
    expect(outputProblems(planted, held)).toEqual([
      'cli/x-command.ts:1 output: typed',
      'cli/x-command.ts:1 string: typed',
      'cli/x-command.ts:2 output: .secret, first, secret',
      'cli/x-command.ts:3 output: accepted',
      'cli/x-command.ts:4 error: second',
      'cli/x-command.ts:4 string: second',
      'cli/x-command.ts:6 string: connection, password',
      'cli/x-command.ts:7 output: hash, hashSet',
      'cli/x-command.ts:8 error: fields',
      'cli/x-command.ts:9 error: record',
      'cli/y-command.ts:1 output: wrapSecret',
      'cli/y-command.ts:1 string: wrapSecret',
      'cli/y-command.ts:2 output: privateKey',
      'cli/y-command.ts:3 output: token',
    ]);

    const real = fileOf(PASSWORD_COMMAND).text;
    const anchor = "const typed = first.secret.toString('utf8');";
    expect(real).toContain(anchor);
    // A new alias is discovered, and a new use is not a named use.
    const aliased = real.replace(anchor, `${anchor}\n          const copy = typed;\n          const again = second.secret.toString('hex');`);
    expect(discoveredHeld(aliased).values).toEqual(['accepted', 'again', 'buffer', 'buffers', 'copy', 'typed']);
    expect(unnamedUses(aliased).map((use) => use.replace(/^\d+: /, ''))).toEqual(['typed', 'second', '.secret']);
    const used = real.replace(anchor, `${anchor}\n          ports.errorLog.append({ level: 'info', source: SOURCE, message: typed });\n          await writeFile(file, fields.password + connection.password + hashSet.salt);`);
    expect(unnamedUses(used).map((use) => use.replace(/^\d+: /, ''))).toEqual(['typed', 'fields', 'connection', 'hashSet']);
    expect(discoveredHeld('const { secret } = await prompt.readSecretLine(label);').answers).toEqual([]);
    expect(occurrences([{ path: 'cli/x.ts', text: 'const { secret } = first;' }], /\{[^{}\n]*\bsecret\b[^{}\n]*\}\s*=\s*(?!>)/g)).toEqual(['cli/x.ts:1']);

    const process: SourceFile[] = [
      { path: 'cli/x-command.ts', text: `import { spawn } from '${PROCESS_MODULE}';\nspawn('tool', [typed]);\nexecFileSync('tool', { env: { NEW: typed } });` },
      { path: 'cli/x.ts', text: `process.env.NEW = typed;\nprocess.env['NEW'] = typed;\nprocess.argv.push(typed);\nObject.assign(process.env, { NEW: typed });\nif (process.env.NEW === 'x') process.title = typed;` },
    ];
    expect(occurrences(process, PROCESS_START)).toEqual(['cli/x-command.ts:1', 'cli/x-command.ts:2', 'cli/x-command.ts:3']);
    expect(occurrences(process, ENVIRONMENT_OR_ARGUMENT_WRITE)).toEqual(['cli/x.ts:1', 'cli/x.ts:2', 'cli/x.ts:3', 'cli/x.ts:4', 'cli/x.ts:5']);
  });
});

// ── D. No secret from the environment ──────────────────────────────────────────────────────────

/** How one read of the environment looks: the NAMES of all variables, or the VALUE of one named variable. */
const ENVIRONMENT_READ = new RegExp(`(\\bObject\\s*\\.\\s*keys\\(\\s*)?\\b${'process'}\\s*\\.\\s*env\\b(\\s*\\)|\\s*\\[\\s*'([A-Za-z_0-9]+)'\\s*\\]|\\s*\\.\\s*([A-Za-z_]\\w*))?`, 'g');

function environmentReads(files: readonly SourceFile[]): string[] {
  return files.flatMap((file) =>
    [...file.text.matchAll(ENVIRONMENT_READ)].map((match) => {
      const name = match[3] ?? match[4];
      if (name !== undefined) return `${file.path}: VALUE ${name}`;
      return match[1] !== undefined && (match[2] ?? '').trim() === ')' ? `${file.path}: NAMES` : `${file.path}: WHOLE`;
    }),
  );
}

/** The two reads of the environment in the folder. Neither is a secret. */
const ENVIRONMENT_READS = [
  // The NAMES only, for the refusal below. A value is never read.
  'cli/operator-set.ts: NAMES',
  // The folder the person typed the receiver's command in (npm runs a workspace script inside the workspace).
  'cli/verify-export.ts: VALUE INIT_CWD',
];

/** The refusal list of the password command, read from its source text. */
function passwordVariableName(text: string): RegExp | null {
  const match = /export const PASSWORD_VARIABLE_NAME = \/(.+)\/([a-z]*);/.exec(text);
  return match === null ? null : new RegExp(match[1] ?? '', match[2] ?? '');
}

describe('D. no secret from the environment', () => {
  it('the environment is read in two named places: the names of its variables, and one folder', () => {
    expect(environmentReads(code)).toEqual(ENVIRONMENT_READS);
    // No built-in that hands out the environment under another name.
    expect(sorted(Object.values(PACKAGE_IMPORTS_OF).flat())).not.toContain('node:process');
    expect(occurrences(code, /\b(?:env|argv)\s*\}\s*=\s*process\b|\bdotenv\b/g)).toEqual([]);
    for (const read of ENVIRONMENT_READS) expect(read).not.toMatch(/VALUE .*(?:passw|secret|token|credential|key|pwd)/i);
  });

  it('the password command holds a refusal list of password-like variable names', () => {
    const refusalList = passwordVariableName(fileOf(PASSWORD_COMMAND).text);
    expect(refusalList).not.toBeNull();
    for (const name of ['PASSWORD', 'NEW_PASSWORD', 'password', 'DEMS_PASSWORD', 'DEMS_OPERATOR_PASSWORD', 'DEMS_NEW_PASSWORD_1', 'OPERATOR_PASSWORD', 'new_operator_password']) expect(refusalList?.test(name), name).toBe(true);
    // Narrow on purpose: an unrelated variable must not stop an installer.
    for (const name of ['PATH', 'HOME', 'INIT_CWD', 'DEMS_DATA_DIR', 'DEMS_INSTALLATION_DEVICE_ID', 'SSH_ASKPASS']) expect(refusalList?.test(name), name).toBe(false);
  });

  it('the refusal runs on the NAMES, once, before the connection file is opened, the pool is opened or anybody is prompted', () => {
    const command = fileOf(PASSWORD_COMMAND).text;
    const refusal = 'if (ports.environmentNames().some((name) => PASSWORD_VARIABLE_NAME.test(name))) {';
    expect(command.split(refusal)).toHaveLength(2);
    const at = command.indexOf(refusal);
    expect(command.slice(at, at + 400)).toMatch(/return refuse\(SetPasswordRefusal\.PASSWORD_VARIABLE_SET,/);
    for (const later of ['readConnectionFile(file)', 'ports.openPool(', 'ports.prompt.readSecretLine(', 'ports.ask(']) {
      expect(command.indexOf(later), later).toBeGreaterThan(at);
      expect(command.slice(0, at), later).not.toContain(later);
    }
    expect(count(command, /\benvironmentNames\b/g)).toBe(2);
    expect(fileOf('cli/operator-set.ts').text).toContain('environmentNames: () => Object.keys(process.env),');
  });

  it('finds a value read from the environment, and a refusal list that was emptied (planted control)', () => {
    const variable = ['DEMS', 'OPERATOR', 'PASSWORD'].join('_');
    const planted: SourceFile[] = [
      { path: 'cli/x.ts', text: `const a = process.env.${variable};\nconst b = process.env['${variable}'];\nconst all = process.env;\nconst names = Object.keys(process.env);\nconst { env } = process;` },
    ];
    expect(environmentReads(planted)).toEqual([`cli/x.ts: VALUE ${variable}`, `cli/x.ts: VALUE ${variable}`, 'cli/x.ts: WHOLE', 'cli/x.ts: NAMES']);
    expect(environmentReads(planted)).not.toEqual(ENVIRONMENT_READS);
    expect(occurrences(planted, /\b(?:env|argv)\s*\}\s*=\s*process\b|\bdotenv\b/g)).toEqual(['cli/x.ts:5']);
    expect(passwordVariableName('export const OTHER = 1;')).toBeNull();
    expect(passwordVariableName('export const PASSWORD_VARIABLE_NAME = /^(?:NEVER_SET_BY_ANYONE)$/i;')?.test('NEW_PASSWORD')).toBe(false);
  });
});

// ── E. The scripts ─────────────────────────────────────────────────────────────────────────────

/** The script that runs each entry. `secret-prompt.ts` has none: its attended check is typed by a person. */
const ENTRY_SCRIPTS: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(ENTRIES).map(([path, spec]) => [spec.script, path]));

/** A command text that names a path of the folder `cli/` (not a file that merely ends in `cli.ts`). */
const NAMES_THE_FOLDER = /(?:^|[\s"'=:(])(?:\.\/)?cli\//;

/** What is wrong with the scripts that name the folder. */
function scriptProblems(scripts: Readonly<Record<string, string>>, entries: readonly string[]): string[] {
  const problems: string[] = [];
  for (const [name, command] of Object.entries(scripts)) {
    if (!NAMES_THE_FOLDER.test(command)) continue;
    const match = /^tsx (cli\/[a-z-]+\.ts)$/.exec(command);
    if (match === null) problems.push(`${name}: is not exactly "tsx cli/<entry>.ts"`);
    else if (!entries.includes(match[1] ?? '')) problems.push(`${name}: runs ${match[1]}, which is not an entry`);
  }
  return problems;
}

describe('E. the scripts that run a cli entry', () => {
  const manifest = tree.find((file) => file.path === 'package.json');
  const scripts = (JSON.parse(manifest?.text ?? '{}') as { scripts?: Record<string, string> }).scripts ?? {};
  const naming = Object.fromEntries(Object.entries(scripts).filter(([, command]) => NAMES_THE_FOLDER.test(command)));

  it('each is "tsx cli/<entry>.ts" and nothing else: no argument, no variable, no value', () => {
    expect(scriptProblems(scripts, Object.keys(ENTRIES))).toEqual([]);
    expect(Object.fromEntries(Object.entries(naming).map(([name, command]) => [name, command.replace(/^tsx /, '')]))).toEqual(ENTRY_SCRIPTS);
  });

  it('every entry has exactly one script, and no script names a command file or the prompt', () => {
    expect(Object.values(ENTRY_SCRIPTS).sort()).toEqual(Object.keys(ENTRIES).sort());
    expect(Object.keys(ENTRY_SCRIPTS)).toHaveLength(Object.keys(ENTRIES).length);
    for (const command of Object.values(scripts)) expect(command).not.toMatch(/-command\b|secret-prompt/);
  });

  it('finds a script that carries a value, an option or a file that is no entry (planted control)', () => {
    const planted = {
      'operator:set-password': 'tsx cli/operator-set.ts --database dems_demo',
      'evidence:rotate-key': 'DEMS_DATA_DIR=/x tsx cli/rotate-key.ts',
      'evidence:production-key': 'tsx cli/production-key-command.ts',
      'evidence:both': 'tsx cli/rotate-key.ts && tsx cli/mark-compromised.ts',
      'evidence:verify-export': 'tsx cli/verify-export.ts',
      test: 'vitest run --project unit',
    };
    expect(scriptProblems(planted, Object.keys(ENTRIES))).toEqual([
      'operator:set-password: is not exactly "tsx cli/<entry>.ts"',
      'evidence:rotate-key: is not exactly "tsx cli/<entry>.ts"',
      'evidence:production-key: runs cli/production-key-command.ts, which is not an entry',
      'evidence:both: is not exactly "tsx cli/<entry>.ts"',
    ]);
  });
});

// ── F. The rest of what `src/` holds ───────────────────────────────────────────────────────────

const CRYPTOGRAPHY = new RegExp(`['"](?:node:)?${'crypto'}['"]|\\bglobalThis\\s*\\.\\s*${'crypto'}\\b|\\.\\s*subtle\\b|\\bgetRandom${'Values'}\\b|\\bweb${'crypto'}\\b|\\bMath\\s*\\.\\s*${'random'}\\b`, 'g');
const FILE_READ = /\b(?:readFileSync|readFile|createReadStream|readSync|readlinkSync|readdirSync|readdir)\b/g;
const WRITING_STATEMENT = /['"`](?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT)\s/g;
const AUDIT_TABLE = new RegExp(`\\b${['audit', 'log'].join('_')}\\b`, 'g');
/** The calls of `node:fs` the folder may make: look at an entry, make a directory, write a NEW file. None reads. */
const FILE_SYSTEM_NAMES: Readonly<Record<string, string>> = {
  'cli/production-key-command.ts': 'closeSync, constants, fchmodSync, fsyncSync, lstatSync, mkdirSync, openSync, writeSync',
  'cli/rotate-key-command.ts': 'mkdirSync',
};

describe('F. no cryptography, no file read, one written table', () => {
  it('no cli file names a cryptography module, Web Crypto or a weak random source: keys are made by the signer store, hashes by the hasher', () => {
    expect(occurrences(code, CRYPTOGRAPHY)).toEqual([]);
  });

  it('no cli file reads the content of a file itself: the connection file is the server reader\'s, a key file the store\'s', () => {
    expect(occurrences(code, FILE_READ)).toEqual([]);
    const named = Object.fromEntries(code.flatMap((file) => [...file.text.matchAll(/import \{ ([^}]+) \} from 'node:fs';/g)].map((match) => [file.path, match[1] ?? ''])));
    expect(named).toEqual(FILE_SYSTEM_NAMES);
    expect(occurrences(code, /\b(?:unlink|unlinkSync|rm|rmSync|rename|renameSync|rmdirSync)\s*\(/g)).toEqual([]);
  });

  it('the folder holds ONE statement that writes, on one table, and never names the audit table', () => {
    expect(occurrences(code, WRITING_STATEMENT)).toHaveLength(1);
    expect(fileOf(PASSWORD_COMMAND).text).toMatch(/export const SET_CREDENTIAL =\s*'UPDATE public\.operator_credentials SET /);
    expect(occurrences(code, AUDIT_TABLE)).toEqual([]);
    // The audit row goes through the unit's writer.
    expect(count(fileOf(PASSWORD_COMMAND).text, /\bunit\.audit\.append\(/g)).toBe(1);
  });

  it('the folder is typechecked and counted in coverage', () => {
    const typecheck = JSON.parse(tree.find((file) => file.path === 'tsconfig.json')?.text ?? '{}') as { include?: string[] };
    expect(typecheck.include).toContain('cli');
    expect(tree.find((file) => file.path === 'vitest.config.ts')?.text).toMatch(/include: \[[^\]]*'cli\/\*\*\/\*\.ts'[^\]]*\]/);
  });

  it('finds each when it is present (planted control)', () => {
    const planted: SourceFile[] = [
      { path: 'cli/a.ts', text: `import { randomBytes } from 'node:${'crypto'}';\nconst key = await globalThis.${'crypto'}.subtle.generateKey(a, true, u);\nconst r = Math.${'random'}();` },
      { path: 'cli/b.ts', text: `const text = readFileSync(join(dataDir, 'signer', name));\nunlinkSync(file);` },
      { path: 'cli/c.ts', text: `await pool.query('INSERT INTO public.${['audit', 'log'].join('_')} (seq) VALUES ($1)');\nawait pool.query("DELETE FROM public.operators");` },
    ];
    expect(occurrences(planted, CRYPTOGRAPHY)).toEqual(['cli/a.ts:1', 'cli/a.ts:2', 'cli/a.ts:2', 'cli/a.ts:3']);
    expect(occurrences(planted, FILE_READ)).toEqual(['cli/b.ts:1']);
    expect(occurrences(planted, /\b(?:unlink|unlinkSync|rm|rmSync|rename|renameSync|rmdirSync)\s*\(/g)).toEqual(['cli/b.ts:2']);
    expect(occurrences(planted, WRITING_STATEMENT)).toEqual(['cli/c.ts:1', 'cli/c.ts:2']);
    expect(occurrences(planted, AUDIT_TABLE)).toEqual(['cli/c.ts:1']);
  });
});
