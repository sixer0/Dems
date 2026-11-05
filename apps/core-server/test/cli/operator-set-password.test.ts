// The host command `operator:set-password` (task 4 row 215, package X2-3; SX-01, SX-02, SX-03,
// SX-11, SX-12, SX-14, SX-19; R-X2-1 to R-X2-11), database-free.
//
// THE COMMAND'S FUNCTION is driven, never its terminal entry: an injected prompt port, the real
// hasher, and a POOL DOUBLE - the stand-in runtime pool of `test/support/core` (it answers the
// unit's own statements, the chain lock and the audit insert, and applies a transaction at COMMIT)
// behind a thin script that answers the command's own statements from an in-memory "world" of
// operators. The Core's real pipeline, unit of work and audit writer run on that pool.
//
// SX-19: every typed value is made from randomness in this run. No password is a literal of this
// file; the published demo password is named by import only. The connection file of each test is a
// file of SYNTHETIC values in a temporary folder, removed after the test: it connects to nothing.
import { randomBytes, randomInt } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import type { Pool, QueryConfig } from 'pg';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AUDIT_MESSAGE,
  CREATE_CREDENTIAL,
  ConnectionFileProblem,
  OTHER_SESSIONS,
  SELECT_OPERATOR_BY_USERNAME,
  SELECT_OPERATOR_CREDENTIALS,
  SELECT_REASON_CONSTRAINTS,
  SESSION_IDENTITY,
  SET_CREDENTIAL,
  SET_WORD,
  STOPPED_LIMIT,
  SetPasswordExit,
  connectionFileOf,
  isSystemPrincipal,
  runSetPasswordCommand,
  type SetPasswordPorts,
} from '../../cli/operator-set-password-command';
import type { SecretLine, SecretPromptPort } from '../../cli/secret-prompt';
import { SELECT_STORED_HASH_SETS } from '../../src/capture/boot';
import { CONNECTION_FILE_KEYS, CONNECTION_FILE_NAME } from '../../src/config';
import { createSystemClock } from '../../src/core/clock';
import { UNIT_STATEMENTS } from '../../src/core/unit-of-work';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../src/db/schema/meta';
import { REVOKE_TOKENS } from '../../src/modules/identity/biometric/store';
import { hashPassword, type PasswordHashRecord } from '../../src/modules/identity/password-hash';
import { RunRepeatGuardError, createRunRepeatGuard as realRunRepeatGuard, type RunRepeatGuard } from '../../src/modules/identity/password-policy';
import { END_SESSIONS_OF_OPERATOR } from '../../src/modules/identity/session-store';
import { SYSTEM_OPERATOR_ID } from '../../src/modules/capture-discovery/connect';
import { recordingErrorLog, standInDatabase, type StandInDatabase } from '../support/core';

// Row 215c: THE ONE MODULE DOUBLE OF THIS FILE. The command makes the repeat guard of a run by calling
// `createRunRepeatGuard` of the identity module; it has no port for it, and none is added for a test.
// The identity module is the real one, whole; only that one function asks `guardHook` first. While
// `guardHook.make` is null (every case that does not set it) the real guard is made, as before.
const guardHook = vi.hoisted(() => ({ make: null as null | (() => Promise<unknown>) }));
vi.mock('../../src/modules/identity', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const real = actual['createRunRepeatGuard'] as () => Promise<unknown>;
  return { ...actual, createRunRepeatGuard: () => (guardHook.make === null ? real() : guardHook.make()) };
});
afterEach(() => {
  guardHook.make = null;
});

const WORKSPACE = resolve(import.meta.dirname, '..', '..');
const DATABASE = 'dems_test_local_row215_double';
const NOW = Date.UTC(2031, 5, 1);
// Row 215b: the command compares the owner of the connection file with the calling user, so the
// rig's user is the one that really owns the temporary files of this run (it was the literal 1000).
const UID = typeof process.getuid === 'function' ? process.getuid() : -1;
const STORED_NEWEST = NOW + 3_600_000; // the stored state is one hour AHEAD of the host clock
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_.:+';
/** A printable value made in this run. */
function runValue(length = 20): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

interface WorldOperator {
  readonly operator_id: string;
  readonly username: string;
  readonly role: string;
  set: PasswordHashRecord | null;
}
interface World {
  readonly operators: WorldOperator[];
  /** What the session question answers, call after call; the last answer repeats. */
  otherSessions: Array<Array<{ role: string; sessions: number }>>;
  /** How many rows the credential UPDATE reports for an operator (default 1). */
  updatedRows: Record<string, number>;
  constraintsHoldReason: boolean;
  schemaVersion: number;
  openSessions: Record<string, number>;
  /** Row 215c: what the session says it is. Absent = the runtime role, no superuser, on the database named. Null = no row. */
  identity?: { readonly role: string; readonly database: string; readonly superuser: boolean | null } | null;
  /** Row 215c: an injected failure of the pool. A statement this answers an error for is rejected with it. */
  fail?: (text: string) => Error | undefined;
}

let demoSet: PasswordHashRecord;
let otherSet: PasswordHashRecord;
beforeAll(async () => {
  demoSet = await hashPassword(DEMO_OPERATOR_PASSWORD);
  otherSet = await hashPassword(runValue(24));
});

function world(overrides: Partial<World> = {}): World {
  return {
    operators: [
      { operator_id: 'OPR-001', username: 'run.investigator', role: 'INVESTIGATOR', set: demoSet },
      { operator_id: 'OPR-002', username: 'run.supervisor', role: 'SUPERVISOR', set: demoSet },
      { operator_id: 'OPR-003', username: 'run.technician', role: 'TECHNICIAN', set: demoSet },
    ],
    otherSessions: [[]],
    updatedRows: {},
    constraintsHoldReason: true,
    schemaVersion: DB_SCHEMA_VERSION,
    openSessions: {},
    ...overrides,
  };
}

const columns = (operator: WorldOperator) => ({
  operator_id: operator.operator_id,
  username: operator.username,
  role: operator.role,
  algorithm: operator.set?.algorithm ?? null,
  memory_kib: operator.set?.memoryKib ?? null,
  passes: operator.set?.passes ?? null,
  parallelism: operator.set?.parallelism ?? null,
  salt: operator.set?.salt ?? null,
  hash: operator.set?.hash ?? null,
});

interface Sent {
  readonly text: string;
  readonly values: readonly unknown[];
}

/** The script in front of the stand-in pool: the command's own statements are answered from the world. */
function scripted(state: World): { readonly pool: Pool; readonly inner: StandInDatabase; readonly sent: Sent[]; opened(): number; count(): number } {
  const inner = standInDatabase();
  const sent: Sent[] = [];
  let pools = 0;
  let sessionAsks = 0;
  const answer = (rows: unknown[]) => ({ rows, rowCount: rows.length, command: 'SELECT', fields: [], oid: 0 });
  const own = (text: string, values: readonly unknown[]): ReturnType<typeof answer> | undefined => {
    const failure = state.fail?.(text);
    if (failure !== undefined) throw failure;
    if (text === SESSION_IDENTITY) return answer(state.identity === null ? [] : [state.identity ?? { role: 'dems_app', database: DATABASE, superuser: false }]);
    if (text === 'SELECT schema_version, contract_revision FROM schema_meta') return answer([{ schema_version: state.schemaVersion, contract_revision: DB_CONTRACT_REVISION }]);
    if (text === SELECT_REASON_CONSTRAINTS) {
      const names = values[0] as string[];
      return answer(names.map((name) => ({ name, definition: state.constraintsHoldReason ? "CHECK (x IN ('USER_DISABLED', 'CREDENTIAL_REPLACED'))" : "CHECK (x IN ('USER_DISABLED'))" })));
    }
    if (text === OTHER_SESSIONS) {
      const rows = state.otherSessions[Math.min(sessionAsks, state.otherSessions.length - 1)] ?? [];
      sessionAsks += 1;
      return answer(rows);
    }
    if (text === SELECT_OPERATOR_BY_USERNAME) {
      return answer(state.operators.filter((operator) => operator.username === values[0]).map((operator) => ({ ...columns(operator), has_credential: operator.set !== null })));
    }
    if (text === SELECT_OPERATOR_CREDENTIALS) {
      const withSet = state.operators.filter((operator) => operator.set !== null);
      return answer([...withSet.filter((operator) => operator.role === 'SUPERVISOR'), ...withSet.filter((operator) => operator.role !== 'SUPERVISOR')].map(columns));
    }
    if (text === SELECT_STORED_HASH_SETS) return answer(state.operators.filter((operator) => operator.set !== null).map(columns));
    if (text === SET_CREDENTIAL) {
      const operator = state.operators.find((candidate) => candidate.operator_id === values[0]);
      const rows = state.updatedRows[String(values[0])] ?? (operator === undefined || operator.set === null ? 0 : 1);
      if (operator !== undefined && rows === 1) {
        operator.set = { algorithm: values[1], memoryKib: values[2], passes: values[3], parallelism: values[4], salt: values[5], hash: values[6] } as PasswordHashRecord;
      }
      return answer(Array.from({ length: rows }, () => ({ operator_id: values[0] })));
    }
    if (text === CREATE_CREDENTIAL) {
      // D56: the row is created where none was - exactly one, and only for an account without one.
      const operator = state.operators.find((candidate) => candidate.operator_id === values[0]);
      const rows = operator !== undefined && operator.set === null ? 1 : 0;
      if (operator !== undefined && rows === 1) {
        operator.set = { algorithm: values[1], memoryKib: values[2], passes: values[3], parallelism: values[4], salt: values[5], hash: values[6] } as PasswordHashRecord;
      }
      return answer(Array.from({ length: rows }, () => ({ operator_id: values[0] })));
    }
    if (text === END_SESSIONS_OF_OPERATOR) {
      const open = state.openSessions[String(values[0])] ?? 0;
      return answer(Array.from({ length: open }, (_, index) => ({ id: `AS-${index}`, operator_id: values[0], device_id: null, end_reason: values[2] })));
    }
    if (text === REVOKE_TOKENS.OPERATOR) return answer([]);
    if (text.startsWith('SELECT greatest(')) return answer([{ newest: String(STORED_NEWEST) }]);
    return undefined;
  };
  const textOf = (query: string | QueryConfig): string => (typeof query === 'string' ? query : query.text);
  const valuesOf = (query: string | QueryConfig, values?: readonly unknown[]): readonly unknown[] => values ?? (typeof query === 'string' ? [] : ((query.values as unknown[] | undefined) ?? []));
  const pool = {
    async connect() {
      const client = await inner.pool.connect();
      const query = async (given: string | QueryConfig, values?: readonly unknown[]) => {
        const text = textOf(given);
        const bound = valuesOf(given, values);
        sent.push({ text, values: [...bound] });
        return own(text, bound) ?? (client.query as unknown as (q: unknown, v?: unknown) => Promise<unknown>)(given, values);
      };
      return new Proxy(client, { get: (target, key) => (key === 'query' ? query : Reflect.get(target, key)) });
    },
    async query(given: string | QueryConfig, values?: readonly unknown[]) {
      const text = textOf(given);
      const bound = valuesOf(given, values);
      sent.push({ text, values: [...bound] });
      return own(text, bound) ?? answer([]);
    },
    on: () => pool,
    end: async () => undefined,
  };
  return { pool: pool as unknown as Pool, inner, sent, opened: () => pools, count: () => (pools += 1) };
}

interface Rig {
  readonly ports: SetPasswordPorts;
  readonly state: World;
  readonly database: ReturnType<typeof scripted>;
  readonly out: string[];
  readonly errorLog: ReturnType<typeof recordingErrorLog>;
  readonly dataDir: string;
  /** Every buffer the prompt handed out. */
  readonly buffers: Buffer[];
  readonly labels: string[];
  readonly asks: string[];
  readonly hashed: { count: number };
  args(...rest: string[]): string[];
}

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function connectionFolder(options: { readonly role?: string; readonly mode?: number } = {}): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-row215-'));
  folders.push(folder);
  const lines = [
    `${CONNECTION_FILE_KEYS.host}=127.0.0.1`,
    `${CONNECTION_FILE_KEYS.port}=4432`,
    `${CONNECTION_FILE_KEYS.database}=dems_not_this_one`,
    `${CONNECTION_FILE_KEYS.user}=${options.role ?? 'dems_app'}`,
    // A synthetic value of this run: the pool is a double, nothing is dialled with it.
    `${CONNECTION_FILE_KEYS.password}=${randomBytes(18).toString('base64url')}`,
  ];
  const file = join(folder, CONNECTION_FILE_NAME);
  writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 });
  chmodSync(file, options.mode ?? 0o600);
  return folder;
}

function rig(options: { readonly state?: World; readonly typed?: Array<string | SecretLine>; readonly word?: string | null; readonly terminal?: boolean; readonly environment?: string[]; readonly dataDir?: string; readonly uid?: number } = {}): Rig {
  const state = options.state ?? world();
  const database = scripted(state);
  const out: string[] = [];
  const errorLog = recordingErrorLog();
  const buffers: Buffer[] = [];
  const labels: string[] = [];
  const asks: string[] = [];
  const hashed = { count: 0 };
  const typed = [...(options.typed ?? [])];
  const dataDir = options.dataDir ?? connectionFolder();
  const prompt: SecretPromptPort = {
    async readSecretLine(label) {
      labels.push(label);
      const next = typed.shift();
      if (next === undefined) return { kind: 'ABORTED', cause: 'INPUT_ENDED' };
      if (typeof next !== 'string') return next;
      const secret = Buffer.from(next, 'utf8');
      buffers.push(secret);
      return { kind: 'LINE', secret };
    },
  };
  const ports: SetPasswordPorts = {
    clock: createSystemClock(() => NOW),
    uid: () => options.uid ?? UID,
    out: (line) => void out.push(line),
    isTerminal: () => options.terminal ?? true,
    environmentNames: () => options.environment ?? ['PATH', 'HOME', 'DEMS_PORT'],
    ask: async (text) => (asks.push(text), options.word === undefined ? SET_WORD : options.word),
    prompt,
    hasher: (password) => ((hashed.count += 1), hashPassword(password)),
    openPool: (connection) => {
      database.count();
      expect(connection).toMatchObject({ host: '127.0.0.1', port: 4432, database: DATABASE, user: 'dems_app' });
      return database.pool;
    },
    errorLog,
  };
  return { ports, state, database, out, errorLog, dataDir, buffers, labels, asks, hashed, args: (...rest) => ['--database', DATABASE, '--data-dir', dataDir, ...rest] };
}

const unitStatements = (sent: readonly Sent[]): string[] => {
  const from = sent.findIndex((statement) => statement.text === UNIT_STATEMENTS.begin);
  return from < 0 ? [] : sent.slice(from).map((statement) => statement.text);
};
const auditInserts = (sent: readonly Sent[]): Sent[] => sent.filter((statement) => statement.text.startsWith('insert into "audit_log" '));
const wrote = (sent: readonly Sent[]): boolean => sent.some((statement) => statement.text === SET_CREDENTIAL || statement.text === END_SESSIONS_OF_OPERATOR || statement.text.startsWith('insert into '));

/** No typed value, and no salt or tag of a stored set, in anything the command said or logged. */
function sweep(r: Rig, values: readonly string[]): void {
  const said = `${r.out.join('\n')}\n${JSON.stringify(r.errorLog.entries)}\n${r.asks.join('\n')}`;
  const audit = JSON.stringify(auditInserts(r.database.sent).map((statement) => statement.values));
  for (const value of values) {
    expect(said).not.toContain(value);
    expect(audit).not.toContain(value);
    // The value is bound to NO statement at all: only its hash set is.
    for (const statement of r.database.sent) for (const bound of statement.values) expect(bound).not.toBe(value);
  }
  for (const operator of r.state.operators) {
    if (operator.set === null) continue;
    for (const secret of [operator.set.salt, operator.set.hash]) {
      for (const form of [secret.toString('hex'), secret.toString('base64'), secret.toString('base64url')]) {
        expect(said).not.toContain(form);
        expect(audit).not.toContain(form);
      }
    }
  }
}

describe('the arguments: strict, and never a password (R-X2-1)', () => {
  it.each([
    ['--password as an option', (dir: string) => ['--database', DATABASE, '--data-dir', dir, '--username', 'run.supervisor', '--password', runValue()]],
    ['--password=<value>', (dir: string) => ['--database', DATABASE, '--data-dir', dir, '--all-demo', `--password=${runValue()}`]],
    ['a positional value', (dir: string) => ['--database', DATABASE, '--data-dir', dir, '--all-demo', runValue()]],
    ['no --data-dir (there is no default)', () => ['--database', DATABASE, '--all-demo']],
    ['a relative --data-dir', () => ['--database', DATABASE, '--data-dir', '.data', '--all-demo']],
    ['no --database', (dir: string) => ['--data-dir', dir, '--all-demo']],
    ['both --username and --all-demo', (dir: string) => ['--database', DATABASE, '--data-dir', dir, '--all-demo', '--username', 'run.supervisor']],
    ['neither --username nor --all-demo', (dir: string) => ['--database', DATABASE, '--data-dir', dir]],
    ['an unknown option', (dir: string) => ['--database', DATABASE, '--data-dir', dir, '--all-demo', '--force']],
  ])('%s is a usage error: exit 2, no file read, no pool opened, nobody prompted', async (_name, argv) => {
    const r = rig({ dataDir: '/nowhere/data' });
    const run = await runSetPasswordCommand(argv('/nowhere/data'), r.ports);
    expect(run.code).toBe(SetPasswordExit.USAGE);
    expect(run.lines[0]).toMatch(/^usage: npm run operator:set-password /);
    expect(r.database.opened()).toBe(0);
    expect(r.labels).toEqual([]);
    expect(r.asks).toEqual([]);
    // The usage text echoes no argument.
    for (const argument of argv('/nowhere/data').filter((value) => !value.startsWith('--') && value !== DATABASE && value !== '/nowhere/data' && value !== '.data' && value !== 'run.supervisor')) {
      expect(run.lines.join('\n')).not.toContain(argument.replace(/^--password=/, ''));
    }
  });

  it.each(['DEMS_OPERATOR_PASSWORD', 'NEW_PASSWORD', 'PASSWORD', 'dems_new_password', 'OPERATOR_PASSWORD_FILE'])('a variable named %s is a refusal before anything is opened; only names are looked at', async (name) => {
    const r = rig({ environment: ['PATH', name] });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(PASSWORD_VARIABLE_SET\)/);
    expect(r.database.opened()).toBe(0);
    expect(r.labels).toEqual([]);
  });

  it('CONTROL: an unrelated variable with the word in it does not stop the command; a piped input does (NOT_A_TERMINAL), with nobody prompted', async () => {
    const piped = rig({ terminal: false, environment: ['KEYCHAIN_PASSWORD_PROMPT_OF_ANOTHER_TOOL', 'PATH'] });
    const run = await runSetPasswordCommand(piped.args('--all-demo'), piped.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(NOT_A_TERMINAL\)/);
    expect(piped.database.opened()).toBe(0);
    expect(piped.labels).toEqual([]);
    expect(piped.asks).toEqual([]);
  });

  it('the command`s two files read no environment value and no process argument by themselves, and name no audit table', () => {
    const command = readFileSync(join(WORKSPACE, 'cli', 'operator-set-password-command.ts'), 'utf8');
    const entry = readFileSync(join(WORKSPACE, 'cli', 'operator-set.ts'), 'utf8');
    expect(command).not.toMatch(/process\.(env|argv|stdin|stdout)/);
    expect(command).not.toMatch(/console\./);
    // D56 (2026-11-03): the ban keeps everything it always protected - no audit table, no delete,
    // no schema words - and narrows only the creation it now allows: exactly ONE INSERT in the file,
    // the credential row of a factory-born account, whose statement shape its own test pins.
    expect(command).not.toMatch(/\baudit_log\b|\bDELETE\b|\bALTER\b|\bTRIGGER\b|\bCREATE\b/);
    expect(command.match(/\bINSERT\b/g)).toEqual(['INSERT']);
    expect(command).not.toMatch(/pg\.owner|owner-connection|dems_owner/);
    expect([...entry.matchAll(/process\.env[^\n]*/g)].map((match) => match[0])).toEqual(['process.env),']);
    expect(entry).toContain('environmentNames: () => Object.keys(process.env),');
    const scripts = (JSON.parse(readFileSync(join(WORKSPACE, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
    expect(scripts['operator:set-password']).toBe('tsx cli/operator-set.ts');
  });
});

describe('the connection file (SX-03): the runtime role, read by the server`s own reader', () => {
  it('a file that group or others can read is refused by the reader`s code; another role is refused; nothing is opened', async () => {
    const open = rig({ dataDir: connectionFolder({ mode: 0o644 }) });
    const first = await runSetPasswordCommand(open.args('--all-demo'), open.ports);
    expect(first.code).toBe(SetPasswordExit.REFUSED);
    expect(first.lines.join('\n')).toMatch(/REFUSED \(CONNECTION_FILE\).*\(CONNECTION_FILE_MODE\)/);
    const owner = rig({ dataDir: connectionFolder({ role: 'dems_owner' }) });
    const second = await runSetPasswordCommand(owner.args('--all-demo'), owner.ports);
    expect(second.lines.join('\n')).toMatch(/REFUSED \(CONNECTION_NOT_RUNTIME\)/);
    const missing = rig({ dataDir: '/nowhere/data' });
    expect((await runSetPasswordCommand(missing.args('--all-demo'), missing.ports)).lines.join('\n')).toMatch(/REFUSED \(CONNECTION_FILE\).*\(CONNECTION_FILE_MISSING\)/);
    for (const r of [open, owner, missing]) {
      expect(r.database.opened()).toBe(0);
      expect(r.labels).toEqual([]);
    }
  });

  // ── Row 215b (decision C66 (4)): WHICH file, and what the person is shown ──────────────────────
  /** A folder with a connection file of this run: its own port and its own synthetic value, both returned. */
  function ownConnectionFolder(port: number): { readonly folder: string; readonly value: string } {
    const folder = mkdtempSync(join(tmpdir(), 'dems-row215b-'));
    folders.push(folder);
    const value = randomBytes(18).toString('base64url');
    const lines = [`${CONNECTION_FILE_KEYS.host}=127.0.0.1`, `${CONNECTION_FILE_KEYS.port}=${port}`, `${CONNECTION_FILE_KEYS.database}=dems_not_this_one`, `${CONNECTION_FILE_KEYS.user}=dems_app`, `${CONNECTION_FILE_KEYS.password}=${value}`];
    writeFileSync(join(folder, CONNECTION_FILE_NAME), `${lines.join('\n')}\n`, { mode: 0o600 });
    return { folder, value };
  }

  it('the path is the Core`s: the stated directory, resolved, and the one file name - no default and no second place', () => {
    expect(connectionFileOf('/srv/dems/data')).toEqual({ dataDir: '/srv/dems/data', file: `/srv/dems/data/${CONNECTION_FILE_NAME}` });
    expect(connectionFileOf('/srv/dems/other/../data/')).toEqual({ dataDir: '/srv/dems/data', file: `/srv/dems/data/${CONNECTION_FILE_NAME}` });
    const command = readFileSync(join(WORKSPACE, 'cli', 'operator-set-password-command.ts'), 'utf8');
    const entry = readFileSync(join(WORKSPACE, 'cli', 'operator-set.ts'), 'utf8');
    // Neither file can fall back to the repository's own data directory: the name of that default is not in them.
    for (const text of [command, entry]) expect(text).not.toMatch(/DEFAULT_DATA_DIR|loadConfig\(|['"`]\.data\b/);
    expect([...command.matchAll(/readConnectionFile\(([^)]*)\)/g)].map((match) => match[1])).toEqual(['file']);
  });

  it('of two directories with a connection file each, the one STATED is the one read: its port and its value reach the pool, the other`s do not', async () => {
    const stated = ownConnectionFolder(4431);
    const other = ownConnectionFolder(4430);
    for (const [given, wanted, unwanted] of [[stated, stated, other], [other, other, stated]] as const) {
      const r = rig({ dataDir: given.folder, word: 'no' });
      const handed: Array<{ port: number; same: boolean; others: boolean }> = [];
      const ports: SetPasswordPorts = {
        ...r.ports,
        openPool: (connection) => {
          // Compared in memory; a value is never an argument of an expectation, so a failure prints none.
          handed.push({ port: connection.port, same: connection.password.reveal() === wanted.value, others: connection.password.reveal() === unwanted.value });
          return r.database.pool;
        },
      };
      const run = await runSetPasswordCommand(r.args('--all-demo'), ports);
      expect(handed).toEqual([{ port: wanted === stated ? 4431 : 4430, same: true, others: false }]);
      const text = run.lines.join('\n');
      expect(text).toContain(`data directory:  ${given.folder}`);
      expect(text).toContain(`connection file: ${join(given.folder, CONNECTION_FILE_NAME)} `);
      expect(text).not.toContain(unwanted.folder);
      expect(text.includes(wanted.value) || text.includes(unwanted.value)).toBe(false);
      // Shown BEFORE the word is asked for, and the word was asked once.
      expect(r.asks).toHaveLength(1);
      expect(run.lines.findIndex((line) => line.startsWith('  connection file: '))).toBeLessThan(run.lines.findIndex((line) => line.includes('REFUSED (NOT_CONFIRMED)')));
      expect(r.labels).toEqual([]);
    }
  });

  it('a stated directory that is not written in its shortest form is shown as the directory and file really used', async () => {
    const good = ownConnectionFolder(4432);
    const r = rig({ dataDir: `${good.folder}/nothing/..`, word: 'no' });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.lines).toContain(`  data directory:  ${good.folder}`);
    expect(run.lines.some((line) => line.startsWith(`  connection file: ${join(good.folder, CONNECTION_FILE_NAME)} `))).toBe(true);
  });

  it('absent, a link, a directory, another user`s, readable by others: each is a named refusal before anything is opened, asked or prompted', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'dems-row215b-'));
    const linked = mkdtempSync(join(tmpdir(), 'dems-row215b-'));
    const asDirectory = mkdtempSync(join(tmpdir(), 'dems-row215b-'));
    folders.push(empty, linked, asDirectory);
    // The link points at a file that would pass every check: the target is never looked at.
    symlinkSync(join(ownConnectionFolder(4432).folder, CONNECTION_FILE_NAME), join(linked, CONNECTION_FILE_NAME));
    mkdirSync(join(asDirectory, CONNECTION_FILE_NAME), { mode: 0o700 });
    const cases: Array<[string, Rig, ConnectionFileProblem]> = [
      ['absent', rig({ dataDir: empty }), ConnectionFileProblem.MISSING],
      ['a link', rig({ dataDir: linked }), ConnectionFileProblem.LINK],
      ['a directory', rig({ dataDir: asDirectory }), ConnectionFileProblem.NOT_A_FILE],
      ['readable by the group', rig({ dataDir: connectionFolder({ mode: 0o640 }) }), ConnectionFileProblem.MODE],
      ['readable by others', rig({ dataDir: connectionFolder({ mode: 0o604 }) }), ConnectionFileProblem.MODE],
    ];
    // Another user's file: the same good file, asked about by a caller with another numeric id.
    if (UID >= 0) cases.push(['of another user', rig({ dataDir: ownConnectionFolder(4432).folder, uid: UID + 1 }), ConnectionFileProblem.OWNER]);
    for (const [label, r, problem] of cases) {
      const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
      expect(run.code, label).toBe(SetPasswordExit.REFUSED);
      // One line: the refusal, the full path of the file that was meant, and the named reason.
      expect(run.lines, label).toEqual([`operator:set-password: REFUSED (CONNECTION_FILE) ${join(r.dataDir, CONNECTION_FILE_NAME)} could not be used (${problem}). Nothing was read.`]);
      expect(r.database.opened(), label).toBe(0);
      expect(r.asks, label).toEqual([]);
      expect(r.labels, label).toEqual([]);
    }
    // CONTROL: the same good file, asked about by its owner, is read (the word is then refused).
    const control = rig({ dataDir: ownConnectionFolder(4432).folder, word: 'no' });
    expect((await runSetPasswordCommand(control.args('--all-demo'), control.ports)).lines.join('\n')).toMatch(/REFUSED \(NOT_CONFIRMED\)/);
    expect(control.database.opened()).toBe(1);
  });
});

describe('refused before the first prompt (SX-01, SX-12, R-X2-8)', () => {
  it('a schema without CREDENTIAL_REPLACED', async () => {
    const r = rig({ state: world({ constraintsHoldReason: false }) });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(REASON_NOT_IN_SCHEMA\)/);
    expect(r.labels).toEqual([]);
    expect(r.asks).toEqual([]);
    expect(wrote(r.database.sent)).toBe(false);
  });

  it('a database that is not at the schema version of the program', async () => {
    const r = rig({ state: world({ schemaVersion: DB_SCHEMA_VERSION - 1 }) });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(SCHEMA_NOT_CURRENT\)/);
    expect(r.labels).toEqual([]);
    expect(wrote(r.database.sent)).toBe(false);
  });

  it('a database with another session: the roles and counts are said, and that the test sees connections', async () => {
    const r = rig({ state: world({ otherSessions: [[{ role: 'dems_app', sessions: 2 }]] }) });
    const run = await runSetPasswordCommand(r.args('--username', 'run.supervisor'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(DATABASE_IN_USE\).*dems_app: 2.*sees connections, not a process/);
    expect(r.labels).toEqual([]);
    expect(r.asks).toEqual([]);
    expect(wrote(r.database.sent)).toBe(false);
  });

  it('an unknown username is refused; an operator WITHOUT a credential row gets its first one created (D56)', async () => {
    const unknown = rig();
    expect((await runSetPasswordCommand(unknown.args('--username', 'run.nobody'), unknown.ports)).lines.join('\n')).toMatch(/REFUSED \(OPERATOR_NOT_FOUND\)/);
    expect(unknown.labels).toEqual([]);
    expect(wrote(unknown.database.sent)).toBe(false);
    const state = world();
    (state.operators[0] as WorldOperator).set = null;
    const value = runValue();
    const bare = rig({ state, typed: [value, value] });
    const run = await runSetPasswordCommand(bare.args('--username', 'run.investigator'), bare.ports);
    expect(run.code).toBe(SetPasswordExit.DONE);
    expect(bare.labels).toEqual(['New password for run.investigator (INVESTIGATOR): ', 'Again: ']);
    expect(run.lines).toContain('run.investigator: password set, 0 session(s) ended');
    expect(bare.database.sent.filter((statement) => statement.text === CREATE_CREDENTIAL)).toHaveLength(1);
    expect(bare.database.sent.some((statement) => statement.text === SET_CREDENTIAL)).toBe(false);
  });

  it('the word is not typed: database, data directory, operators and the limit of "stopped" were shown first; nothing is prompted or written', async () => {
    const r = rig({ word: 'yes' });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    const text = run.lines.join('\n');
    expect(text).toContain(`database:        ${DATABASE} on 127.0.0.1:4432, as the role dems_app`);
    expect(text).toContain(`data directory:  ${r.dataDir}`);
    // The Supervisor first (decision U20), then the others.
    expect(run.lines.filter((line) => line.startsWith('    - '))).toEqual(['    - run.supervisor (SUPERVISOR)', '    - run.investigator (INVESTIGATOR)', '    - run.technician (TECHNICIAN)']);
    for (const line of STOPPED_LIMIT) expect(text).toContain(line);
    expect(text).toMatch(/cannot see a Core process/);
    expect(text).toMatch(/REFUSED \(NOT_CONFIRMED\)/);
    expect(r.asks).toEqual([`Type ${SET_WORD} to continue: `]);
    expect(r.labels).toEqual([]);
    expect(wrote(r.database.sent)).toBe(false);
  });

  // ── Row 215c, review B-01 (SX-03, rank 1): what the SESSION is, not what the connection file names ──
  it.each<[string, World['identity']]>([
    ['another role than the runtime role', { role: 'dems_owner', database: DATABASE, superuser: false }],
    ['the runtime role, made a superuser', { role: 'dems_app', database: DATABASE, superuser: true }],
    ['a superuser flag the database did not answer', { role: 'dems_app', database: DATABASE, superuser: null }],
    ['another database than the one named', { role: 'dems_app', database: 'dems_test_local_row215_other', superuser: false }],
    ['no row at all', null],
  ])('a session that is %s is refused (ROLE_NOT_RUNTIME) before the first prompt: nothing more is asked of the database, nobody is prompted, nothing is written', async (_name, identity) => {
    // The connection file of the rig names the runtime role on this host and passes: only the session differs.
    for (const target of [['--all-demo'], ['--username', 'run.supervisor']]) {
      const r = rig({ state: world({ identity }) });
      const run = await runSetPasswordCommand(r.args(...target), r.ports);
      expect(run.code).toBe(SetPasswordExit.REFUSED);
      expect(run.lines).toEqual([`operator:set-password: REFUSED (ROLE_NOT_RUNTIME) the session is not the role dems_app on ${DATABASE}.`]);
      expect(run.set).toEqual([]);
      // The prompt port was called 0 times, the word was not asked for, no password was hashed.
      expect(r.labels).toEqual([]);
      expect(r.asks).toEqual([]);
      expect(r.hashed.count).toBe(0);
      // The identity question is the ONLY statement such a session was sent: no read of an operator, no unit, no write.
      expect(r.database.opened()).toBe(1);
      expect(r.database.sent.map((statement) => statement.text)).toEqual([SESSION_IDENTITY]);
      expect(wrote(r.database.sent)).toBe(false);
      expect(r.database.inner.committed.auditSeqs).toEqual([]);
    }
  });

  it('CONTROL of the case above: the same rig with the session of the runtime role goes on to the summary and the word', async () => {
    const r = rig({ state: world({ identity: { role: 'dems_app', database: DATABASE, superuser: false } }), word: 'no' });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(NOT_CONFIRMED\)/);
    expect(run.lines.join('\n')).not.toMatch(/ROLE_NOT_RUNTIME/);
    expect(r.asks).toHaveLength(1);
  });

  // ── DF-29, decision D20(d) (2026-11-05): a SYSTEM PRINCIPAL gets no password, before the first prompt ──
  const systemRow = (operatorId: string, username: string, set: PasswordHashRecord | null): WorldOperator => ({ operator_id: operatorId, username, role: 'TECHNICIAN', set });
  const refusedUntouched = (r: Rig): void => {
    expect(r.labels).toEqual([]);
    expect(r.asks).toEqual([]);
    expect(r.hashed.count).toBe(0);
    expect(wrote(r.database.sent)).toBe(false);
    expect(r.database.sent.some((statement) => statement.text === CREATE_CREDENTIAL || statement.text === SET_CREDENTIAL || statement.text === UNIT_STATEMENTS.begin)).toBe(false);
    expect(r.database.inner.committed.auditSeqs).toEqual([]);
    // A refusal by design, not a failure: nothing goes to the persistent error log.
    expect(r.errorLog.entries).toEqual([]);
  };

  it('the installer`s `system` row (OPR-000, NO credential) is refused - the D56 create path never writes its first credential', async () => {
    const state = world();
    state.operators.push(systemRow(SYSTEM_OPERATOR_ID, 'system', null));
    const r = rig({ state, typed: [runValue(), runValue()] });
    const run = await runSetPasswordCommand(r.args('--username', 'system'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines).toEqual([
      'operator:set-password: REFUSED (SYSTEM_PRINCIPAL) system (OPR-000) is a system principal: it stands for the Core itself and never signs in, so this command sets no password of it. Nothing was changed.',
    ]);
    expect(run.set).toEqual([]);
    refusedUntouched(r);
    expect(state.operators.find((operator) => operator.operator_id === SYSTEM_OPERATOR_ID)?.set).toBeNull();
  });

  it.each<[string, string, string]>([
    ['the reserved id under another username', SYSTEM_OPERATOR_ID, 'core.auto'],
    ['the reserved username in another case, under another id', 'OPR-099', 'System'],
  ])('a system principal by %s, even WITH a credential row, is refused: nothing replaced', async (_name, operatorId, username) => {
    const state = world();
    state.operators.push(systemRow(operatorId, username, otherSet));
    const r = rig({ state, typed: [runValue(), runValue()] });
    const run = await runSetPasswordCommand(r.args('--username', username), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(SYSTEM_PRINCIPAL\)/);
    refusedUntouched(r);
    expect(state.operators.find((operator) => operator.operator_id === operatorId)?.set).toBe(otherSet);
  });

  it('--all-demo: a system principal that holds the demo password stops the whole walk before the word - nobody is prompted, no operator changed', async () => {
    const state = world();
    state.operators.push(systemRow(SYSTEM_OPERATOR_ID, 'system', demoSet));
    const r = rig({ state, typed: [runValue(), runValue()] });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines).toHaveLength(1);
    expect(run.lines[0]).toMatch(/^operator:set-password: REFUSED \(SYSTEM_PRINCIPAL\) system \(OPR-000\): a system principal holds the published demo password\./);
    refusedUntouched(r);
    for (const operator of state.operators) expect(operator.set).toBe(demoSet);
  });

  it('CONTROL: a system principal WITHOUT the demo password is not in the walk - the walk lists the other three and goes on to the word', async () => {
    const state = world();
    state.operators.push(systemRow(SYSTEM_OPERATOR_ID, 'system', otherSet));
    const r = rig({ state, word: 'no' });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.lines.join('\n')).not.toMatch(/SYSTEM_PRINCIPAL/);
    expect(run.lines.filter((line) => line.startsWith('    - '))).toEqual(['    - run.supervisor (SUPERVISOR)', '    - run.investigator (INVESTIGATOR)', '    - run.technician (TECHNICIAN)']);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(NOT_CONFIRMED\)/);
    expect(r.asks).toHaveLength(1);
  });

  it('the predicate: the auto-attach actor of capture-discovery IS a system principal; a real operator and a look-alike name are not', () => {
    expect(SYSTEM_OPERATOR_ID).toBe('OPR-000');
    expect(isSystemPrincipal({ operatorId: SYSTEM_OPERATOR_ID, username: 'anything' })).toBe(true);
    expect(isSystemPrincipal({ operatorId: 'OPR-123', username: 'SYSTEM' })).toBe(true);
    expect(isSystemPrincipal({ operatorId: 'OPR-001', username: 'run.technician' })).toBe(false);
    expect(isSystemPrincipal({ operatorId: 'OPR-0001', username: 'systemd' })).toBe(false);
  });
});

describe('row 215c, review F-03: the refusals that had no test, each through an injected failure of a port the command has', () => {
  /** An error as a driver gives it: a code, and a text that must reach no line and no log. */
  function failing(code: string | null): { readonly error: Error; readonly text: string } {
    const text = `synthetic driver text ${runValue(16)}`;
    const error = new Error(text);
    if (code !== null) Object.assign(error, { code });
    return { error, text };
  }
  const said = (r: Rig): string => `${r.out.join('\n')}\n${JSON.stringify(r.errorLog.entries)}`;

  it('DATABASE_UNREACHABLE: the first statement is rejected - the code is said and logged, the driver`s text is not, nobody is prompted', async () => {
    const refused = failing('ECONNREFUSED');
    const r = rig({ state: world({ fail: (text) => (text === SESSION_IDENTITY ? refused.error : undefined) }) });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines).toEqual([`operator:set-password: REFUSED (DATABASE_UNREACHABLE) ${DATABASE} on 127.0.0.1:4432 did not answer (ECONNREFUSED).`]);
    expect(r.errorLog.entries).toHaveLength(1);
    expect(r.errorLog.entries[0]).toMatchObject({ level: 'error', source: 'cli.operatorSetPassword', code: 'ECONNREFUSED', context: { command: 'operator:set-password', database: DATABASE, step: 'connect' } });
    expect(said(r)).not.toContain(refused.text);
    expect(r.labels).toEqual([]);
    expect(r.asks).toEqual([]);
    expect(wrote(r.database.sent)).toBe(false);
    // An error without a usable code: still DATABASE_UNREACHABLE, and still none of its text.
    const bare = failing('not a code: lower case and spaces');
    const second = rig({ state: world({ fail: (text) => (text === SESSION_IDENTITY ? bare.error : undefined) }) });
    const again = await runSetPasswordCommand(second.args('--all-demo'), second.ports);
    expect(again.lines).toHaveLength(1);
    expect(again.lines[0]).toMatch(/^operator:set-password: REFUSED \(DATABASE_UNREACHABLE\) /);
    expect(said(second)).not.toContain(bare.text);
    expect(said(second)).not.toContain('not a code');
    expect(second.labels).toEqual([]);
  });

  it.each<[string, string, string[]]>([
    ['the reason constraints', SELECT_REASON_CONSTRAINTS, ['--all-demo']],
    ['the other sessions', OTHER_SESSIONS, ['--all-demo']],
    ['the operators of the walk', SELECT_OPERATOR_CREDENTIALS, ['--all-demo']],
    ['the one named operator', SELECT_OPERATOR_BY_USERNAME, ['--username', 'run.supervisor']],
  ])('OPERATORS_UNREADABLE: the read of %s is rejected - "Nothing was changed" is true: no word asked, no prompt, no write', async (_name, statement, target) => {
    const refused = failing('57P01');
    const r = rig({ state: world({ fail: (text) => (text === statement ? refused.error : undefined) }) });
    const run = await runSetPasswordCommand(r.args(...target), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines).toEqual([`operator:set-password: REFUSED (OPERATORS_UNREADABLE) the operators of ${DATABASE} could not be read (57P01). Nothing was changed.`]);
    expect(r.errorLog.entries).toHaveLength(1);
    expect(r.errorLog.entries[0]).toMatchObject({ level: 'error', source: 'cli.operatorSetPassword', code: '57P01', context: { step: 'operators', database: DATABASE } });
    expect(said(r)).not.toContain(refused.text);
    expect(r.asks).toEqual([]);
    expect(r.labels).toEqual([]);
    expect(r.hashed.count).toBe(0);
    expect(wrote(r.database.sent)).toBe(false);
  });

  it('COUNT_UNREADABLE: the final count is rejected AFTER a password was set - the set is said as committed, the count as not read, exit 1', async () => {
    const typed = runValue();
    const refused = failing('57014');
    const r = rig({ state: world({ fail: (text) => (text === SELECT_STORED_HASH_SETS ? refused.error : undefined) }), typed: [typed, typed] });
    const run = await runSetPasswordCommand(r.args('--username', 'run.supervisor'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    // What WAS committed is not taken back by the unread count.
    expect(run.set).toEqual(['run.supervisor']);
    expect(r.database.inner.committed.auditSeqs).toEqual([1]);
    expect(run.lines.slice(-2)).toEqual(['run.supervisor: password set, 0 session(s) ended', 'operators that still have the demo password: could not be read (COUNT_UNREADABLE)']);
    expect(run.demoPasswordOperators).toBeNull();
    expect(r.errorLog.entries).toHaveLength(1);
    expect(r.errorLog.entries[0]).toMatchObject({ level: 'error', code: '57014', context: { step: 'count', database: DATABASE } });
    expect(said(r)).not.toContain(refused.text);
    sweep(r, [typed]);
  });

  it('COUNT_UNREADABLE with nothing to do: "nobody has the demo password" is not exit 0 when the count check 4c will make could not be read', async () => {
    const state = world({ fail: (text) => (text === SELECT_STORED_HASH_SETS ? failing('57014').error : undefined) });
    for (const operator of state.operators) operator.set = otherSet;
    const r = rig({ state });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines).toEqual([`operator:set-password: no operator of ${DATABASE} has the demo password. Nothing to do.`, 'operators that still have the demo password: could not be read (COUNT_UNREADABLE)']);
    expect(r.asks).toEqual([]);
    expect(r.labels).toEqual([]);
    expect(wrote(r.database.sent)).toBe(false);
  });

  it('REPEAT_CHECK_UNAVAILABLE: the guard of the run cannot be made - after the word, before any prompt; nothing was changed', async () => {
    guardHook.make = async () => {
      throw new RunRepeatGuardError();
    };
    const r = rig();
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.at(-1)).toBe('operator:set-password: REFUSED (REPEAT_CHECK_UNAVAILABLE) Nothing was changed.');
    expect(r.asks).toHaveLength(1);
    expect(r.labels).toEqual([]);
    expect(r.hashed.count).toBe(0);
    expect(unitStatements(r.database.sent)).toEqual([]);
    expect(wrote(r.database.sent)).toBe(false);
  });

  it('the hasher fails at operator 2 of the walk: operator 1 stays committed, operator 2 is NOT set, operator 3 is never prompted; the typed bytes are zeroed', async () => {
    const values = [runValue(), runValue(), runValue()];
    const refused = failing(null);
    const r = rig({ typed: values.flatMap((value) => [value, value]) });
    let hashes = 0;
    const ports: SetPasswordPorts = { ...r.ports, hasher: (password) => ((hashes += 1) === 2 ? Promise.reject(refused.error) : hashPassword(password)) };
    const run = await runSetPasswordCommand(r.args('--all-demo'), ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.set).toEqual(['run.supervisor']);
    expect(run.lines).toContain('operator:set-password: REFUSED (UNIT_FAILED) run.investigator: NOT set; set and committed before it: run.supervisor.');
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 2');
    expect(r.labels.filter((label) => label.includes('run.technician'))).toEqual([]);
    // One unit ran (operator 1); none was opened for operator 2.
    expect(r.database.sent.filter((statement) => statement.text === UNIT_STATEMENTS.begin)).toHaveLength(1);
    expect(r.database.sent.filter((statement) => statement.text === SET_CREDENTIAL).map((statement) => statement.values[0])).toEqual(['OPR-002']);
    expect(r.database.inner.committed.auditSeqs).toEqual([1]);
    expect(r.errorLog.entries).toHaveLength(1);
    expect(r.errorLog.entries[0]).toMatchObject({ level: 'error', source: 'cli.operatorSetPassword', code: 'UNIT_FAILED', context: { step: 'hash', targetOperatorId: 'OPR-001', database: DATABASE } });
    expect(said(r)).not.toContain(refused.text);
    for (const buffer of r.buffers) expect(buffer.every((byte) => byte === 0)).toBe(true);
    sweep(r, values);
  });

  it('the repeat check fails while a typed value is judged: that operator is NOT set, nothing is hashed, no unit is opened', async () => {
    const typed = runValue();
    guardHook.make = async (): Promise<RunRepeatGuard> => ({
      refusalOf: async () => {
        throw new RunRepeatGuardError();
      },
      remember: async () => undefined,
    });
    const r = rig({ typed: [typed, typed] });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.set).toEqual([]);
    // A broken comparer is never "no repeat": the value is not stored.
    expect(run.lines).toContain('operator:set-password: REFUSED (UNIT_FAILED) run.supervisor: NOT set; no password was set before it.');
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 3');
    expect(r.hashed.count).toBe(0);
    expect(unitStatements(r.database.sent)).toEqual([]);
    expect(r.errorLog.entries).toHaveLength(1);
    expect(r.errorLog.entries[0]).toMatchObject({ level: 'error', code: 'RUN_REPEAT_GUARD_UNAVAILABLE', context: { step: 'hash', targetOperatorId: 'OPR-002' } });
    for (const buffer of r.buffers) expect(buffer.every((byte) => byte === 0)).toBe(true);
    sweep(r, [typed]);
  });

  it('DEMO_PASSWORD_REMAINS can be reached: a credential with the demo password that appears AFTER the walk`s list was read ends the walk "NOT COMPLETE", exit 1', async () => {
    const values = [runValue(), runValue(), runValue()];
    const r = rig({ typed: values.flatMap((value) => [value, value]) });
    let hashes = 0;
    // The world changes behind the command: after the last password was hashed, one more operator has the demo password.
    const ports: SetPasswordPorts = {
      ...r.ports,
      hasher: async (password) => {
        const record = await hashPassword(password);
        if ((hashes += 1) === 3) r.state.operators.push({ operator_id: 'OPR-004', username: 'run.late', role: 'INVESTIGATOR', set: demoSet });
        return record;
      },
    };
    const run = await runSetPasswordCommand(r.args('--all-demo'), ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    // Every LISTED operator was set and committed; the late one was never listed, never prompted.
    expect(run.set).toEqual(['run.supervisor', 'run.investigator', 'run.technician']);
    expect(r.labels.filter((label) => label.includes('run.late'))).toEqual([]);
    expect(run.demoPasswordOperators).toBe(1);
    expect(run.lines.slice(-2)).toEqual([
      'operators that still have the demo password: 1',
      'operator:set-password: NOT COMPLETE (DEMO_PASSWORD_REMAINS): a production Core refuses to start until this count is 0.',
    ]);
    sweep(r, values);
  });
});

describe('row 215c, security review C-2 / code review F-10 (a): a repeat check that cannot REMEMBER is said and logged, never swallowed', () => {
  /** The real guard of a run, whose `remember` fails from the n-th call on. What it refuses is the real guard`s answer. */
  function forgettingFrom(call: number): { remembers(): number } {
    let remembers = 0;
    guardHook.make = async (): Promise<RunRepeatGuard> => {
      const real = await realRunRepeatGuard();
      return {
        refusalOf: (password) => real.refusalOf(password),
        remember: async (password) => {
          if ((remembers += 1) >= call) throw new RunRepeatGuardError();
          await real.remember(password);
        },
      };
    };
    return { remembers: () => remembers };
  }

  it('in the walk: the password of that operator IS set and committed, the walk STOPS, nobody after it is prompted; the result, a line and the error log name it', async () => {
    const first = runValue();
    const guard = forgettingFrom(1);
    // The same value is ready for operator 2: with the failure swallowed it would have been asked for and STORED.
    const r = rig({ typed: [first, first, first, first] });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(guard.remembers()).toBe(1);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.repeatCheckLost).toBe(true);
    expect(run.set).toEqual(['run.supervisor']);
    expect(r.labels).toEqual(['New password for run.supervisor (SUPERVISOR): ', 'Again: ']);
    expect(r.hashed.count).toBe(1);
    expect(r.database.sent.filter((statement) => statement.text === SET_CREDENTIAL).map((statement) => statement.values[0])).toEqual(['OPR-002']);
    expect(r.database.inner.committed.auditSeqs).toEqual([1]);
    expect(run.lines.slice(-3)).toEqual([
      'run.supervisor: password set, 0 session(s) ended',
      'operator:set-password: REFUSED (REPEAT_CHECK_LOST) set and committed: run.supervisor; the repeat check of this run is no longer available, so no further password is asked. Run the command again for the operators that are left.',
      'operators that still have the demo password: 2',
    ]);
    expect(r.errorLog.entries).toHaveLength(1);
    expect(r.errorLog.entries[0]).toMatchObject({ level: 'error', source: 'cli.operatorSetPassword', code: 'REPEAT_CHECK_LOST', context: { command: 'operator:set-password', database: DATABASE, step: 'remember', targetOperatorId: 'OPR-002', committed: 1 } });
    // Never the value: not in a line, not in the log, not in the result.
    sweep(r, [first]);
    expect(JSON.stringify(run)).not.toContain(first);
  });

  it('at operator 2 of 3: operators 1 and 2 are named as committed, operator 3 is not prompted', async () => {
    const values = [runValue(), runValue(), runValue()];
    forgettingFrom(2);
    const r = rig({ typed: values.flatMap((value) => [value, value]) });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.repeatCheckLost).toBe(true);
    expect(run.set).toEqual(['run.supervisor', 'run.investigator']);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(REPEAT_CHECK_LOST\) set and committed: run\.supervisor, run\.investigator; /);
    expect(r.labels.filter((label) => label.includes('run.technician'))).toEqual([]);
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 1');
    expect(r.errorLog.entries.map((entry) => [entry.code, entry.context])).toEqual([['REPEAT_CHECK_LOST', { command: 'operator:set-password', database: DATABASE, step: 'remember', targetOperatorId: 'OPR-001', committed: 2 }]]);
    sweep(r, values);
  });

  it('after the LAST password of the run: nothing is left to protect, so the asked work is done - and it is still said, logged and in the result', async () => {
    const typed = runValue();
    forgettingFrom(1);
    const r = rig({ typed: [typed, typed] });
    const run = await runSetPasswordCommand(r.args('--username', 'run.supervisor'), r.ports);
    expect(run.code).toBe(SetPasswordExit.DONE);
    expect(run.repeatCheckLost).toBe(true);
    expect(run.set).toEqual(['run.supervisor']);
    expect(run.lines.slice(-3)).toEqual([
      'run.supervisor: password set, 0 session(s) ended',
      'operator:set-password: NOTE (REPEAT_CHECK_LOST) the repeat check of this run was lost after the last password was set; no password was asked after it.',
      'operators that still have the demo password: 2',
    ]);
    expect(r.errorLog.entries).toHaveLength(1);
    expect(r.errorLog.entries[0]).toMatchObject({ level: 'error', code: 'REPEAT_CHECK_LOST', context: { step: 'remember', targetOperatorId: 'OPR-002', committed: 1 } });
    sweep(r, [typed]);
  });

  it('CONTROL: a run whose guard remembers says nothing of it - `repeatCheckLost` is false and the error log is empty', async () => {
    const values = [runValue(), runValue(), runValue()];
    const guard = forgettingFrom(99);
    const r = rig({ typed: values.flatMap((value) => [value, value]) });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(guard.remembers()).toBe(3);
    expect([run.code, run.repeatCheckLost]).toEqual([SetPasswordExit.DONE, false]);
    expect(run.lines.join('\n')).not.toMatch(/REPEAT_CHECK_LOST/);
    expect(r.errorLog.entries).toEqual([]);
  });
});

describe('one operator, one unit of work: the statement order (SX-01, SX-02, SX-11, SX-14; R-X2-5, R-X2-7)', () => {
  it('--username: the unit opens with the chain lock, raises the clock floor, asks for other sessions AGAIN, updates one row, ends sessions, revokes tokens, appends one audit row, commits', async () => {
    const typed = runValue();
    const state = world({ openSessions: { 'OPR-002': 2 } });
    const r = rig({ state, typed: [typed, typed] });
    const run = await runSetPasswordCommand(r.args('--username', 'run.supervisor'), r.ports);
    // The asked work is one operator: done, although two others still have the demo password (the count below says so).
    expect(run.code).toBe(SetPasswordExit.DONE);
    expect(run.set).toEqual(['run.supervisor']);
    expect(unitStatements(r.database.sent).slice(0, 10).map((text) => (text.startsWith('SELECT greatest(') ? 'NEWEST' : text.startsWith('insert into "audit_log" ') ? 'AUDIT' : text))).toEqual([
      UNIT_STATEMENTS.begin,
      UNIT_STATEMENTS.chainLock,
      UNIT_STATEMENTS.settings,
      'NEWEST',
      OTHER_SESSIONS,
      SET_CREDENTIAL,
      END_SESSIONS_OF_OPERATOR,
      REVOKE_TOKENS.OPERATOR,
      'AUDIT',
      UNIT_STATEMENTS.commit,
    ]);
    // Before the unit: the pre-checks, in order, and the session question once already.
    const before = r.database.sent.slice(0, r.database.sent.findIndex((statement) => statement.text === UNIT_STATEMENTS.begin)).map((statement) => statement.text);
    expect(before).toEqual([SESSION_IDENTITY, 'SELECT schema_version, contract_revision FROM schema_meta', SELECT_REASON_CONSTRAINTS, OTHER_SESSIONS, SELECT_OPERATOR_BY_USERNAME]);
    // The credential: the hash set of the hasher, stamped with the RAISED clock (the stored state was ahead of the host).
    const update = r.database.sent.find((statement) => statement.text === SET_CREDENTIAL) as Sent;
    expect(update.values.slice(0, 5)).toEqual(['OPR-002', 'argon2id', 19_456, 2, 1]);
    expect(update.values[7]).toBeGreaterThanOrEqual(STORED_NEWEST);
    const end = r.database.sent.find((statement) => statement.text === END_SESSIONS_OF_OPERATOR) as Sent;
    expect(end.values).toEqual(['OPR-002', update.values[7], 'CREDENTIAL_REPLACED']);
    const revoke = r.database.sent.find((statement) => statement.text === REVOKE_TOKENS.OPERATOR) as Sent;
    expect(revoke.values).toEqual([update.values[7], 'CREDENTIAL_REPLACED', 'OPR-002']);
    // The audit row: built and inserted by the Core's writer; one row; the five keys and nothing else.
    const audits = auditInserts(r.database.sent);
    expect(audits).toHaveLength(1);
    const row = (audits[0] as Sent).values;
    expect([row[3], row[4], row[5], row[6], row[7]]).toEqual(['OPERATOR_PASSWORD_SET', 'SECURITY', 'WARNING', null, AUDIT_MESSAGE]);
    expect(row[2]).toBe(update.values[7]);
    const details = typeof row[11] === 'string' ? (JSON.parse(row[11]) as unknown) : row[11];
    expect(details).toEqual({ targetOperatorId: 'OPR-002', method: 'HOST_COMMAND', sessionsEnded: 2, earlierWasDemo: true, ...(UID >= 0 ? { invokerUid: UID } : {}) });
    expect(r.database.inner.committed.auditSeqs).toEqual([1]);
    // What was said: the operator, the sessions, and the count check 4c will compute (two demo sets are left).
    expect(run.lines.slice(-2)).toEqual(['run.supervisor: password set, 2 session(s) ended', 'operators that still have the demo password: 2']);
    expect(run.demoPasswordOperators).toBe(2);
    expect(r.labels).toEqual(['New password for run.supervisor (SUPERVISOR): ', 'Again: ']);
    expect(r.hashed.count).toBe(1);
    // The typed bytes are zeroed; nothing typed is said, logged or bound.
    for (const buffer of r.buffers) expect(buffer.every((byte) => byte === 0)).toBe(true);
    sweep(r, [typed]);
    expect(r.errorLog.entries).toEqual([]);
  });

  it('--username is DONE (exit 0) when the asked work is done, whatever the other operators have', async () => {
    const typed = runValue();
    const state = world();
    for (const operator of state.operators) if (operator.username !== 'run.technician') operator.set = otherSet;
    const r = rig({ state, typed: [typed, typed] });
    const run = await runSetPasswordCommand(r.args('--username', 'run.technician'), r.ports);
    expect(run.code).toBe(SetPasswordExit.DONE);
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 0');
  });

  it('--all-demo: three operators, three units, three audit rows; the final line is 0 and the exit is 0', async () => {
    const values = [runValue(), runValue(), runValue()];
    const r = rig({ typed: values.flatMap((value) => [value, value]) });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.DONE);
    expect(run.set).toEqual(['run.supervisor', 'run.investigator', 'run.technician']);
    expect(r.database.sent.filter((statement) => statement.text === UNIT_STATEMENTS.begin)).toHaveLength(3);
    expect(r.database.sent.filter((statement) => statement.text === UNIT_STATEMENTS.commit)).toHaveLength(3);
    expect(r.database.sent.filter((statement) => statement.text === OTHER_SESSIONS)).toHaveLength(4); // once before the prompt, once in each unit
    expect(r.database.inner.committed.auditSeqs).toEqual([1, 2, 3]);
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 0');
    for (const buffer of r.buffers) expect(buffer.every((byte) => byte === 0)).toBe(true);
    sweep(r, values);
  });
});

describe('what writes NOTHING', () => {
  it('a mismatch of the two entries, three times: no unit is opened, no hash is made, the command ends', async () => {
    const r = rig({ typed: [runValue(), runValue(), runValue(), runValue(), runValue(), runValue()] });
    const run = await runSetPasswordCommand(r.args('--username', 'run.supervisor'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(TRIES_EXHAUSTED\) run\.supervisor: NOT set/);
    expect(run.lines.filter((line) => line.includes('the two entries are not the same'))).toHaveLength(3);
    expect(unitStatements(r.database.sent)).toEqual([]);
    expect(wrote(r.database.sent)).toBe(false);
    expect(r.hashed.count).toBe(0);
    for (const buffer of r.buffers) expect(buffer.every((byte) => byte === 0)).toBe(true);
  });

  it('a policy refusal - too short, the username inside, the published demo password, a repeated character: each is said by its code, nothing is hashed or written', async () => {
    const short = runValue(8);
    const holdsName = `${runValue(6)}RUN.SUPERVISOR${runValue(6)}`;
    const r = rig({ typed: [short, short, holdsName, holdsName, DEMO_OPERATOR_PASSWORD, DEMO_OPERATOR_PASSWORD] });
    const run = await runSetPasswordCommand(r.args('--username', 'run.supervisor'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.filter((line) => line.startsWith('  not accepted')).map((line) => /\((\w+)\)/.exec(line)?.[1])).toEqual(['PASSWORD_TOO_SHORT', 'PASSWORD_HOLDS_USERNAME', 'PASSWORD_IS_DEMONSTRATION']);
    expect(unitStatements(r.database.sent)).toEqual([]);
    expect(r.hashed.count).toBe(0);
    sweep(r, [short, holdsName, DEMO_OPERATOR_PASSWORD]);
  });

  it.each([0, 2])('a credential UPDATE of %i rows: the unit is rolled back, no audit row is committed, the error log holds a code and the operator id', async (rows) => {
    const typed = runValue();
    const r = rig({ state: world({ updatedRows: { 'OPR-002': rows } }), typed: [typed, typed] });
    const run = await runSetPasswordCommand(r.args('--username', 'run.supervisor'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.set).toEqual([]);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(CREDENTIAL_ROW_COUNT\) run\.supervisor: NOT set, its unit was rolled back.*no password was set before it/);
    const unit = unitStatements(r.database.sent);
    expect(unit).toContain(UNIT_STATEMENTS.rollback);
    expect(unit).not.toContain(UNIT_STATEMENTS.commit);
    expect(unit).not.toContain(END_SESSIONS_OF_OPERATOR);
    expect(auditInserts(r.database.sent)).toEqual([]);
    expect(r.database.inner.committed.auditSeqs).toEqual([]);
    expect(r.errorLog.entries.at(-1)).toMatchObject({ level: 'error', source: 'cli.operatorSetPassword', code: 'CREDENTIAL_ROW_COUNT', context: { targetOperatorId: 'OPR-002', database: DATABASE } });
    sweep(r, [typed]);
  });

  it('another session that appears AFTER the first check: seen inside the unit, behind the chain lock; rolled back', async () => {
    const typed = runValue();
    const r = rig({ state: world({ otherSessions: [[], [{ role: 'dems_app', sessions: 1 }]] }), typed: [typed, typed] });
    const run = await runSetPasswordCommand(r.args('--username', 'run.supervisor'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.join('\n')).toMatch(/REFUSED \(DATABASE_IN_USE\) run\.supervisor: NOT set/);
    const unit = unitStatements(r.database.sent);
    expect(unit.indexOf(OTHER_SESSIONS)).toBeGreaterThan(unit.indexOf(UNIT_STATEMENTS.chainLock));
    expect(unit).not.toContain(SET_CREDENTIAL);
    expect(unit).toContain(UNIT_STATEMENTS.rollback);
    expect(r.database.inner.committed.auditSeqs).toEqual([]);
  });

  it('an entry the prompt refused, an abandoned prompt, and an empty first entry (skip): nothing is written', async () => {
    const refusedThenAbandoned = rig({ typed: [{ kind: 'ENTRY_REFUSED', code: 'ESCAPE_SEQUENCE' }, { kind: 'ABORTED', cause: 'INTERRUPT_BYTE' }] });
    const first = await runSetPasswordCommand(refusedThenAbandoned.args('--username', 'run.supervisor'), refusedThenAbandoned.ports);
    expect(first.code).toBe(SetPasswordExit.REFUSED);
    expect(first.lines.join('\n')).toMatch(/not accepted \(ESCAPE_SEQUENCE\)[\s\S]*REFUSED \(ABORTED\)/);
    const skipped = rig({ typed: [''] });
    const second = await runSetPasswordCommand(skipped.args('--username', 'run.supervisor'), skipped.ports);
    expect(second.code).toBe(SetPasswordExit.REFUSED);
    expect(second.lines.join('\n')).toMatch(/run\.supervisor: skipped, nothing stored[\s\S]*NOT COMPLETE, 1 operator\(s\) skipped/);
    for (const r of [refusedThenAbandoned, skipped]) expect(unitStatements(r.database.sent)).toEqual([]);
  });
});

describe('the walk: one transaction per operator', () => {
  it('a failure at operator 2 leaves operator 1 committed and operator 3 untouched, and says exactly which', async () => {
    const values = [runValue(), runValue(), runValue()];
    const r = rig({ state: world({ updatedRows: { 'OPR-001': 0 } }), typed: values.flatMap((value) => [value, value]) });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.set).toEqual(['run.supervisor']);
    expect(run.lines).toContain('run.supervisor: password set, 0 session(s) ended');
    expect(run.lines.join('\n')).toMatch(/REFUSED \(CREDENTIAL_ROW_COUNT\) run\.investigator: NOT set, its unit was rolled back and nothing of this operator was stored; set and committed before it: run\.supervisor\./);
    // The third operator was never prompted and never written.
    expect(r.labels.filter((label) => label.includes('run.technician'))).toEqual([]);
    expect(r.database.sent.filter((statement) => statement.text === SET_CREDENTIAL).map((statement) => statement.values[0])).toEqual(['OPR-002', 'OPR-001']);
    expect(r.database.inner.committed.auditSeqs).toEqual([1]);
    // The final line still says what check 4c will compute: two are left.
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 2');
    sweep(r, values);
  });

  it('the same value for a second operator of one run is refused (SX-13); a skip ends with exit 1 and the remaining count', async () => {
    const first = runValue();
    const other = runValue();
    const r = rig({ typed: [first, first, first, first, other, other, ''] });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.lines.filter((line) => line.startsWith('  not accepted')).map((line) => /\((\w+)\)/.exec(line)?.[1])).toEqual(['PASSWORD_REPEATED_IN_RUN']);
    expect(run.set).toEqual(['run.supervisor', 'run.investigator']);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.lines.slice(-3)).toEqual(['run.technician: skipped, nothing stored', 'operators that still have the demo password: 1', 'operator:set-password: NOT COMPLETE, 1 operator(s) skipped.']);
    sweep(r, [first, other]);
  });

  it('nobody has the demo password: nothing is asked, the count is 0, exit 0', async () => {
    const state = world();
    for (const operator of state.operators) operator.set = otherSet;
    const r = rig({ state });
    const run = await runSetPasswordCommand(r.args('--all-demo'), r.ports);
    expect(run.code).toBe(SetPasswordExit.DONE);
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 0');
    expect(r.asks).toEqual([]);
    expect(r.labels).toEqual([]);
  });
});
