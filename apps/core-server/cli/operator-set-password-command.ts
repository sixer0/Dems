/**
 * `npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <dir> (--username <u> | --all-demo)`
 * (task 4 row 215, package X2-3; decision U19; design `05_design_x1_x2.md` part B; security review
 * SX-01, SX-02, SX-03, SX-11, SX-12, SX-14, SX-19; requirements R-X2-1 to R-X2-11).
 *
 * WHAT IT DOES. With the Core of that database STOPPED, it sets the password of ONE
 * named operator (`--username`): it replaces the stored credential, or - since decision D56
 * (2026-11-03) - writes the FIRST credential row of an account the factory seed left without
 * one. With `--all-demo` it walks every operator whose stored credential still verifies
 * against the published demo password. Each password is typed twice at
 * the terminal, not shown, judged by the password policy, and stored only as the hash set the
 * identity module writes (`hashPassword`). It creates, enables, disables and renames no operator
 * and changes no role: it writes one thing, a credential.
 *
 * THIS FILE IS THE COMMAND WITHOUT A PROCESS: arguments and ports in, an exit code and lines out.
 * The process entry is `cli/operator-set.ts`. Nothing here reads the environment, the
 * system time or a terminal by itself. It lies in `cli/`, as the production key command does
 * (decision C54 (1)): no file under `src/` imports it, so the server never loads it.
 *
 * THE CONNECTION (SX-03). The command opens and parses `<data dir>/pg.env` with the server's own
 * reader, and connects with what that file says - the runtime role `dems_app`, never the owner -
 * to the database NAMED ON THE COMMAND LINE (the server, too, takes the name from elsewhere than
 * the file). The database itself then holds R-X2-10: that role can insert no operator and no
 * credential, change no role, and alter nothing of the schema.
 *
 * WHERE THAT FILE IS (row 215b, decision C66 (4)). The Core locates its connection file in ONE way:
 * `join(resolve(<data dir>), CONNECTION_FILE_NAME)` (`src/plugins/config/load-config.ts`). This
 * command builds the same path from the directory the person STATED with `--data-dir`, and from
 * nothing else: there is no default directory, no variable and no second place. The summary shows
 * the directory AND the full path of the file before the word is asked, so the person confirms the
 * file that was really read. Before the reader opens it, the entry AS IT IS (a link is a link, never
 * its target) must be a regular file, owned by the calling user, without access for group or
 * others; each failure is a named refusal before the first prompt.
 *
 * THE ORDER. Everything that can refuse runs BEFORE the first prompt:
 *
 *   1. the arguments (strict: an unknown option, `--password` among them, is a usage error)  -> exit 2
 *   2. no variable of the environment may be named like a password for this command (names only
 *      are looked at; no value is read), and standard input must be a terminal
 *   3. the connection file, its role and its host
 *   4. the database: the role in force, the schema version, the two CHECK constraints that must
 *      hold `CREDENTIAL_REPLACED` (SX-12: one path, no second meaning for another reason), and
 *      "no other session on this database" (SX-01)
 *   5. the operators: the named one, or the walk's list by the predicate of boot check 4c; a
 *      SYSTEM PRINCIPAL among them (`isSystemPrincipal`: the reserved id `OPR-000` the auto-attach
 *      path acts as, or the username `system`) is refused here, whole command, nothing asked
 *      (DF-29, decision D20(d), 2026-11-05: that row stands for the Core itself and must never be
 *      able to sign in, so no credential of it is ever written - neither replaced nor created by D56);
 *      the predicate lives in `src/modules/admin/rule.ts` (D38 DR-4). The named operator is also
 *      refused when it is a PURGE-KEPT account (decision D51, row 133: `isPurgeKept` of the admin
 *      statements). The walk never meets one: the purge removed its credential row.
 *   6. the summary - database, data directory, the connection file's full path, operators, and what "the Core is stopped" can and
 *      cannot mean here - and the word `SET`
 *
 * PER OPERATOR, ONE UNIT OF WORK of the Core's own pipeline (SX-02): `BEGIN`, the chain lock and
 * the transaction settings are the unit's; then, in this order,
 *
 *   a. the clock floor: the newest stored instant is read and the command's clock is raised to it
 *      (decision D110; a host clock behind the stored state would otherwise fail the session end)
 *   b. "no other session on this database", asked AGAIN, now behind the chain lock
 *   c. the credential: one UPDATE of the seven columns; exactly one row, or the unit rolls back
 *   d. the operator's open sessions are ended and the live biometric tokens revoked, both with
 *      `CREDENTIAL_REPLACED`, by the identity module's own functions
 *   e. ONE audit row `OPERATOR_PASSWORD_SET`, by the unit's audit writer - the only code path
 *      into the audit chain. No statement of this file names the audit table.
 *
 * The password is hashed BEFORE the unit (a derivation is slow; the unit holds the chain lock)
 * and nobody is prompted inside one. A failure at operator N leaves operators 1 to N-1 committed
 * and N untouched; the command says exactly which, and stops.
 *
 * WHAT "THE CORE IS STOPPED" MEANS HERE. The Core holds no lock and writes no process file, so
 * the only test there is, is the list of CONNECTIONS to the database. The command sees
 * connections, not a process. It says so before it asks for the word.
 *
 * NOTHING SECRET LEAVES. A typed value is never printed, logged, put into an error, an audit
 * detail or a refusal: every line this file can print is fixed words, a code, a username, a role,
 * a count. The typed bytes are zeroed once the hash exists. One honest limit: the policy and the
 * hash take the value as text, and text of this runtime cannot be wiped - it lives until the
 * short-lived process ends.
 */
import { join, isAbsolute, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import { AuditType } from '@dems/shared/sim';
import { SELECT_STORED_HASH_SETS, demoPasswordHashSetsAmong, storedHashSetIsDemoPassword, type StoredHashSetRow } from '../src/capture/boot';
import { CONNECTION_FILE_NAME, ConfigError, DATABASE_HOST, RUNTIME_ROLE, type DatabaseConnection } from '../src/config';
import { fixedSeverityOf } from '../src/core/audit-details';
import { raiseClockFloor, type FloorClock } from '../src/core/clock';
import { createPipeline } from '../src/core/pipeline';
import type { Pipeline } from '../src/core/types';
import { BootCheckError, checkSchemaVersion } from '../src/db/schema/boot-checks';
import { readNewestStoredInstant } from '../src/engine/rehydrate';
import { isSystemPrincipal } from '../src/modules/admin/rule';
import { isPurgeKept } from '../src/modules/admin/statements';
import { PASSWORD_POLICY_REFUSAL, checkNewPassword, createRunRepeatGuard, type RunRepeatGuard } from '../src/modules/identity';
import { revokeBiometricTokens } from '../src/modules/identity/biometric';
import type { PasswordHashRecord } from '../src/modules/identity/password-hash';
import { endSessionsOfOperator } from '../src/modules/identity/session-store';
import { readConnectionFile } from '../src/plugins/config/connection-file';
import type { ErrorLog } from '../src/plugins/logger';
import { inspectEntry, type EntryFacts } from './production-key-command';
import { SecretPromptError, type SecretPromptPort } from './secret-prompt';

export const SET_PASSWORD_COMMAND = 'operator:set-password';
/** The word the person types before the first prompt. */
export const SET_WORD = 'SET';
/** How often one operator's password may be refused, mistyped or not repeated before the command ends. */
export const TRIES_PER_OPERATOR = 3;
/** The reason of the ended sessions and of the revoked tokens (schema version 9, row 202). */
export const REPLACED_REASON = 'CREDENTIAL_REPLACED';
/** The fixed text of the audit row. It names nobody: the row's details do. */
export const AUDIT_MESSAGE = 'Operator password set from the host';
const SOURCE = 'cli.operatorSetPassword';

export const SetPasswordExit = { DONE: 0, REFUSED: 1, USAGE: 2 } as const;
export type SetPasswordExit = (typeof SetPasswordExit)[keyof typeof SetPasswordExit];

/** Why the command refused or stopped. A line holds one of these words, never a typed value. */
export const SetPasswordRefusal = {
  /** A variable of the environment is named like a password for this command. Its value was not read. */
  PASSWORD_VARIABLE_SET: 'PASSWORD_VARIABLE_SET',
  /** Standard input is not a terminal: a pipe, a file, a job without one. No flag lifts this. */
  NOT_A_TERMINAL: 'NOT_A_TERMINAL',
  /** The connection file could not be used; the line adds the reader's own code. */
  CONNECTION_FILE: 'CONNECTION_FILE',
  /** The connection file names another role than the runtime role, or another host than this one. */
  CONNECTION_NOT_RUNTIME: 'CONNECTION_NOT_RUNTIME',
  DATABASE_UNREACHABLE: 'DATABASE_UNREACHABLE',
  /** The session is not the runtime role, is a superuser, or is on another database than the one named. */
  ROLE_NOT_RUNTIME: 'ROLE_NOT_RUNTIME',
  /** The database is not migrated to the schema this command was built for. */
  SCHEMA_NOT_CURRENT: 'SCHEMA_NOT_CURRENT',
  /** A CHECK of the session or token reasons does not hold `CREDENTIAL_REPLACED`. */
  REASON_NOT_IN_SCHEMA: 'REASON_NOT_IN_SCHEMA',
  /** Another session is connected to this database. */
  DATABASE_IN_USE: 'DATABASE_IN_USE',
  OPERATOR_NOT_FOUND: 'OPERATOR_NOT_FOUND',
  /** The operator is a system principal (DF-29, D20(d)): it stands for the Core and never signs in, so it gets no password. */
  SYSTEM_PRINCIPAL: 'SYSTEM_PRINCIPAL',
  /** The account was purged and KEPT, disabled, under its evidence-chain rows (D38 DR-1, migration 0043): it is terminal (D51), so it gets no password. */
  PURGE_KEPT: 'PURGE_KEPT',
  OPERATORS_UNREADABLE: 'OPERATORS_UNREADABLE',
  NOT_CONFIRMED: 'NOT_CONFIRMED',
  /** The repeat check of the run could not be prepared. */
  REPEAT_CHECK_UNAVAILABLE: 'REPEAT_CHECK_UNAVAILABLE',
  /** A password was set and committed, and the repeat check could not remember it: the walk stops there (row 215c). */
  REPEAT_CHECK_LOST: 'REPEAT_CHECK_LOST',
  /** The prompt was abandoned (interrupt, end of input, a signal). */
  ABORTED: 'ABORTED',
  TRIES_EXHAUSTED: 'TRIES_EXHAUSTED',
  /** The credential UPDATE did not change exactly one row. */
  CREDENTIAL_ROW_COUNT: 'CREDENTIAL_ROW_COUNT',
  /** The unit of one operator failed and was rolled back. */
  UNIT_FAILED: 'UNIT_FAILED',
  /** The final count could not be read. */
  COUNT_UNREADABLE: 'COUNT_UNREADABLE',
  /** The walk ended with operators that still have the demo password. */
  DEMO_PASSWORD_REMAINS: 'DEMO_PASSWORD_REMAINS',
} as const;
export type SetPasswordRefusal = (typeof SetPasswordRefusal)[keyof typeof SetPasswordRefusal];

/**
 * Why the connection file was not used: the word in brackets at the end of a `CONNECTION_FILE`
 * refusal (row 215b). The first two are the reader's own codes; the reader may add its
 * `CONNECTION_FILE_FORMAT`. Checked on the entry as it is, before anything is opened.
 */
export const ConnectionFileProblem = {
  /** No entry of that name in the stated directory. */
  MISSING: 'CONNECTION_FILE_MISSING',
  /** Group or others have access. */
  MODE: 'CONNECTION_FILE_MODE',
  /** The entry is a link. Its target is not looked at. */
  LINK: 'CONNECTION_FILE_LINK',
  /** The entry is a directory or a special file. */
  NOT_A_FILE: 'CONNECTION_FILE_NOT_A_FILE',
  /** The entry belongs to another user than the one that runs the command. */
  OWNER: 'CONNECTION_FILE_OWNER',
} as const;
export type ConnectionFileProblem = (typeof ConnectionFileProblem)[keyof typeof ConnectionFileProblem];

/** The path the Core itself reads for a data directory (`loadConfig`): the stated directory, resolved, and the one file name. */
export function connectionFileOf(dataDir: string): { readonly dataDir: string; readonly file: string } {
  const resolved = resolve(dataDir);
  return { dataDir: resolved, file: join(resolved, CONNECTION_FILE_NAME) };
}

/** What is wrong with the entry of the connection file, or null. Opens nothing. A negative uid (the host cannot say) skips the owner. */
export function connectionFileProblem(file: string, uid: number, inspect: (path: string) => EntryFacts | null = inspectEntry): ConnectionFileProblem | null {
  const entry = inspect(file);
  if (entry === null) return ConnectionFileProblem.MISSING;
  if (entry.kind === 'link') return ConnectionFileProblem.LINK;
  if (entry.kind !== 'file') return ConnectionFileProblem.NOT_A_FILE;
  if (uid >= 0 && entry.ownerUid !== uid) return ConnectionFileProblem.OWNER;
  if ((entry.mode & 0o077) !== 0) return ConnectionFileProblem.MODE;
  return null;
}

/**
 * THE SYSTEM PRINCIPALS (DF-29, decision D20(d), 2026-11-05) are defined ONCE, in the admin module's
 * rule (`src/modules/admin/rule.ts`, decision D38 DR-4, row 133): the same predicate refuses there the
 * edit, the disable and the purge of such a row, and here its credential. See that file for who they are.
 */

/**
 * A name of an environment variable that reads as "a password for this command". Only NAMES are
 * ever looked at. Narrow on purpose: an unrelated tool's variable must not stop an installer.
 */
export const PASSWORD_VARIABLE_NAME = /^(?:PASSWORD|NEW_PASSWORD|DEMS_\w*PASSWORD\w*|\w*OPERATOR\w*PASSWORD\w*)$/i;

/** The other client sessions of this database, every role, without the asking backend (SX-01). */
export const OTHER_SESSIONS =
  'SELECT usename::text AS role, count(*)::int AS sessions FROM pg_stat_activity ' +
  'WHERE datname = current_database() AND usename IS NOT NULL AND pid <> pg_backend_pid() GROUP BY 1 ORDER BY 1';
/** Who this session is, and where. */
export const SESSION_IDENTITY =
  'SELECT current_user::text AS role, current_database()::text AS database, ' +
  '(SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser';
/** The two CHECK constraints that must hold the reason of this command (SX-12). */
export const REASON_CONSTRAINTS = ['auth_sessions_end_reason_check', 'biometric_tokens_revoke_check'] as const;
export const SELECT_REASON_CONSTRAINTS =
  'SELECT conname::text AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = ANY($1::text[])';
const CREDENTIAL_COLUMNS = 'c.algorithm, c.memory_kib, c.passes, c.parallelism, c.salt, c.hash';
/** Every operator that has a credential row, the Supervisor first (decision U20: the Supervisor types first). */
export const SELECT_OPERATOR_CREDENTIALS =
  `SELECT o.id::text AS operator_id, o.username::text AS username, o.role_id::text AS role, ${CREDENTIAL_COLUMNS} ` +
  "FROM public.operators o JOIN public.operator_credentials c ON c.operator_id = o.id ORDER BY (o.role_id = 'SUPERVISOR') DESC, o.username";
/** One operator by username, with the credential row when there is one. */
export const SELECT_OPERATOR_BY_USERNAME =
  `SELECT o.id::text AS operator_id, o.username::text AS username, o.role_id::text AS role, (c.operator_id IS NOT NULL) AS has_credential, ${CREDENTIAL_COLUMNS} ` +
  'FROM public.operators o LEFT JOIN public.operator_credentials c ON c.operator_id = o.id WHERE o.username = $1';
/** The seven credential columns of one operator. The row count decides (SX-11). */
export const SET_CREDENTIAL =
  'UPDATE public.operator_credentials SET algorithm = $2, memory_kib = $3, passes = $4, parallelism = $5, salt = $6, hash = $7, hashed_at = $8 ' +
  'WHERE operator_id = $1 RETURNING operator_id';
/** The same eight parameters, of an account born without a credential row (D56; migration 0037 opens the gate). */
export const CREATE_CREDENTIAL =
  'INSERT INTO public.operator_credentials (operator_id, algorithm, memory_kib, passes, parallelism, salt, hash, hashed_at) ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING operator_id';

export interface SetPasswordPorts {
  /** The command's clock: the server clock of `core/clock`, which has a floor to raise. */
  readonly clock: FloorClock;
  /** The numeric id of the OS user that runs the command; negative when the host cannot say. */
  uid(): number;
  /** One line of output, written as it is made. */
  out(line: string): void;
  /** Whether standard input is a terminal. */
  isTerminal(): boolean;
  /** The NAMES of the variables of the environment. Never a value. */
  environmentNames(): readonly string[];
  /** One line typed at the terminal, ECHOED (the confirmation word: not a secret). Null when no line can be read. */
  ask(prompt: string): Promise<string | null>;
  /** The secret prompt (row 213): nothing is echoed. */
  readonly prompt: SecretPromptPort;
  /** The hasher: `hashPassword` of the identity module in every real run. */
  hasher(password: string): Promise<PasswordHashRecord>;
  /** Opens the pool of the runtime role: `createRuntimePool` in every real run. */
  openPool(connection: DatabaseConnection): Pool;
  /** The persistent error log. Entries hold codes and ids, never a typed value. */
  readonly errorLog: ErrorLog;
}

export interface SetPasswordRun {
  readonly code: SetPasswordExit;
  readonly lines: readonly string[];
  /** The usernames whose password was set and committed, in order. */
  readonly set: readonly string[];
  /** The count boot check 4c will compute, or null when it was not read. */
  readonly demoPasswordOperators: number | null;
  /** True when a password was set and the repeat check of the run could not remember it (`REPEAT_CHECK_LOST`). */
  readonly repeatCheckLost: boolean;
}

interface Arguments {
  readonly database: string;
  readonly dataDir: string;
  readonly target: { readonly kind: 'USERNAME'; readonly username: string } | { readonly kind: 'ALL_DEMO' };
}

interface OperatorRow extends StoredHashSetRow {
  readonly operator_id: string;
  readonly username: string;
  readonly role: string;
}

interface Target {
  readonly operatorId: string;
  readonly username: string;
  readonly role: string;
  readonly earlierWasDemo: boolean;
  /** D56 (2026-11-03): the account exists with NO credential row (a factory-born vendor account); this command writes its first one. */
  readonly create: boolean;
}

/** A stop of one operator's unit, with the word a line may hold. */
class UnitStop extends Error {
  readonly code: SetPasswordRefusal;
  constructor(code: SetPasswordRefusal) {
    super(code);
    this.name = 'UnitStop';
    this.code = code;
  }
}

const USAGE = [
  `usage: npm run ${SET_PASSWORD_COMMAND} -w @dems/core-server -- --database <name> --data-dir <absolute directory> (--username <username> | --all-demo)`,
  '  --database   the database whose operators are meant. Required: there is no default.',
  '  --data-dir   the data directory of that Core (it holds the connection file). Required and absolute: there is no default.',
  '  --username   set the password of this one operator, whatever it has now.',
  '  --all-demo   walk every operator that still has the published demo password.',
  '  A password is never an argument, a variable or piped input: it is typed at the terminal, twice, and is not shown.',
];

const DATABASE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;
// A username as an argument: printable ASCII without a space, bounded. Whether it exists is the database's answer.
const USERNAME_ARGUMENT = /^[\x21-\x7e]{1,128}$/;

function parseArguments(argv: readonly string[]): Arguments | null {
  let values: { database?: string; 'data-dir'?: string; username?: string; 'all-demo'?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: { database: { type: 'string' }, 'data-dir': { type: 'string' }, username: { type: 'string' }, 'all-demo': { type: 'boolean' } },
      strict: true,
      allowPositionals: false,
    }));
  } catch {
    return null;
  }
  const database = values.database;
  const dataDir = values['data-dir'];
  if (database === undefined || !DATABASE_NAME.test(database)) return null;
  if (dataDir === undefined || dataDir.includes('\0') || !isAbsolute(dataDir)) return null;
  const allDemo = values['all-demo'] === true;
  if (allDemo === (values.username !== undefined)) return null;
  if (allDemo) return { database, dataDir, target: { kind: 'ALL_DEMO' } };
  const username = values.username ?? '';
  if (!USERNAME_ARGUMENT.test(username)) return null;
  return { database, dataDir, target: { kind: 'USERNAME', username } };
}

/** A logger that writes nothing: the terminal shows the command's own lines only; failures go to the error log. */
function silentLog(): FastifyBaseLogger {
  const nothing = (): void => undefined;
  const log: Record<string, unknown> = { level: 'silent', silent: nothing, trace: nothing, debug: nothing, info: nothing, warn: nothing, error: nothing, fatal: nothing };
  log['child'] = () => log;
  return log as unknown as FastifyBaseLogger;
}

/** A code a line may hold: the word of this file, a code of the server or the database, or the fixed word. */
function codeOf(error: unknown): string {
  if (error instanceof UnitStop) return error.code;
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : SetPasswordRefusal.UNIT_FAILED;
}

function describeSessions(rows: ReadonlyArray<{ readonly role: string; readonly sessions: number }>): string {
  return rows.map((row) => `${row.role}: ${row.sessions}`).join(', ');
}

/** What "the Core is stopped" can mean here, in plain words. Shown before the word is asked for. */
export const STOPPED_LIMIT = [
  'The Core of this database must be STOPPED while this command runs.',
  'This command cannot see a Core process: the Core holds no lock and writes no process file.',
  'It can only see CONNECTIONS to the database. It sees none now, and it asks again before each password is stored.',
  'A Core that is started while this command runs is not stopped by it: that Core answers 503 for a moment and reloads.',
] as const;

export async function runSetPasswordCommand(argv: readonly string[], ports: SetPasswordPorts): Promise<SetPasswordRun> {
  const lines: string[] = [];
  const set: string[] = [];
  let remaining: number | null = null;
  let repeatCheckLost = false;
  const say = (line: string): void => {
    lines.push(line);
    ports.out(line);
  };
  const finish = (code: SetPasswordExit): SetPasswordRun => ({ code, lines, set, demoPasswordOperators: remaining, repeatCheckLost });
  const refuse = (reason: SetPasswordRefusal, detail = ''): SetPasswordRun => {
    say(`${SET_PASSWORD_COMMAND}: REFUSED (${reason})${detail === '' ? '' : ` ${detail}`}`);
    return finish(SetPasswordExit.REFUSED);
  };

  // 1. The arguments.
  const args = parseArguments(argv);
  if (args === null) {
    for (const line of USAGE) say(line);
    return finish(SetPasswordExit.USAGE);
  }
  // 2. No password by variable, none by pipe.
  if (ports.environmentNames().some((name) => PASSWORD_VARIABLE_NAME.test(name))) {
    return refuse(SetPasswordRefusal.PASSWORD_VARIABLE_SET, 'a variable of the environment is named like a password. This command takes a password from the terminal only; unset the variable and run again. Its value was not read.');
  }
  if (!ports.isTerminal()) return refuse(SetPasswordRefusal.NOT_A_TERMINAL, 'standard input is not a terminal. A password is typed by a person; it is never piped or read from a file.');

  // 3. The connection file: located as the Core locates it, from the STATED directory and nothing else
  //    (row 215b); the entry as it is must be a private regular file of the caller; then the server's own reader.
  const { dataDir, file } = connectionFileOf(args.dataDir);
  const problem = connectionFileProblem(file, ports.uid());
  if (problem !== null) return refuse(SetPasswordRefusal.CONNECTION_FILE, `${file} could not be used (${problem}). Nothing was read.`);
  let connection: DatabaseConnection;
  try {
    const fields = readConnectionFile(file);
    if (fields.user !== RUNTIME_ROLE || fields.host !== DATABASE_HOST || !/^[0-9]{1,5}$/.test(fields.port)) {
      return refuse(SetPasswordRefusal.CONNECTION_NOT_RUNTIME, `${file} must name the role ${RUNTIME_ROLE} on ${DATABASE_HOST}. This command holds no other role.`);
    }
    connection = { host: DATABASE_HOST, port: Number(fields.port), database: args.database, user: fields.user, password: fields.password };
  } catch (error) {
    // The reader's messages name the file and a key, never a value; only its code is passed on.
    return refuse(SetPasswordRefusal.CONNECTION_FILE, `${file} could not be used (${error instanceof ConfigError ? error.code : 'UNREADABLE'}).`);
  }

  const pool = ports.openPool(connection);
  // An idle connection that fails must not stop the process; the next statement reports it.
  pool.on('error', () => undefined);
  let pipeline: Pipeline | null = null;
  const persist = (message: string, code: string, context: Record<string, string | number | boolean | null>): void => {
    ports.errorLog.append({ level: 'error', source: SOURCE, message, code, context: { command: SET_PASSWORD_COMMAND, database: args.database, ...context } });
  };

  try {
    // 4. The database, before anybody is prompted.
    let targets: Target[];
    try {
      const identity = (await pool.query<{ role: string; database: string; superuser: boolean | null }>(SESSION_IDENTITY)).rows[0];
      if (identity === undefined || identity.role !== RUNTIME_ROLE || identity.superuser !== false || identity.database !== args.database) {
        return refuse(SetPasswordRefusal.ROLE_NOT_RUNTIME, `the session is not the role ${RUNTIME_ROLE} on ${args.database}.`);
      }
    } catch (error) {
      persist('the database could not be reached', codeOf(error), { step: 'connect' });
      return refuse(SetPasswordRefusal.DATABASE_UNREACHABLE, `${args.database} on ${DATABASE_HOST}:${connection.port} did not answer (${codeOf(error)}).`);
    }
    try {
      await checkSchemaVersion(pool);
    } catch (error) {
      if (!(error instanceof BootCheckError)) persist('the schema version could not be read', codeOf(error), { step: 'schema' });
      return refuse(SetPasswordRefusal.SCHEMA_NOT_CURRENT, `${args.database} is not at the schema version of this program. Apply the migrations first: npm run db:migrate -w @dems/core-server -- --database ${args.database}`);
    }
    try {
      const constraints = (await pool.query<{ name: string; definition: string }>(SELECT_REASON_CONSTRAINTS, [[...REASON_CONSTRAINTS]])).rows;
      const holding = REASON_CONSTRAINTS.filter((name) => constraints.some((row) => row.name === name && row.definition.includes(`'${REPLACED_REASON}'`)));
      if (holding.length !== REASON_CONSTRAINTS.length) {
        return refuse(SetPasswordRefusal.REASON_NOT_IN_SCHEMA, `the schema of ${args.database} does not hold the reason ${REPLACED_REASON}. Apply the migrations first; no other reason is used in its place.`);
      }
      const others = (await pool.query<{ role: string; sessions: number }>(OTHER_SESSIONS)).rows;
      if (others.length > 0) {
        return refuse(SetPasswordRefusal.DATABASE_IN_USE, `${args.database} has other connections (${describeSessions(others)}). Stop the Core of this database and close every other client, then run again. Nothing was changed. (This test sees connections, not a process.)`);
      }
      // 5. The operators.
      if (args.target.kind === 'USERNAME') {
        const found = (await pool.query<OperatorRow & { has_credential: boolean }>(SELECT_OPERATOR_BY_USERNAME, [args.target.username])).rows;
        const row = found[0];
        if (row === undefined || found.length !== 1) return refuse(SetPasswordRefusal.OPERATOR_NOT_FOUND, 'no operator has that username. This command creates no operator.');
        // DF-29 / D20(d): BEFORE the D56 create path and before any derivation - a system principal gets no credential.
        if (isSystemPrincipal({ operatorId: row.operator_id, username: row.username })) {
          return refuse(SetPasswordRefusal.SYSTEM_PRINCIPAL, `${row.username} (${row.operator_id}) is a system principal: it stands for the Core itself and never signs in, so this command sets no password of it. Nothing was changed.`);
        }
        // D51 (row 133): a purge-kept account is terminal. The purge took its credential and left the row only
        // because evidence-chain rows name it; the D56 create path below would otherwise give it one again.
        if (await isPurgeKept(pool, row.operator_id)) {
          return refuse(SetPasswordRefusal.PURGE_KEPT, `${row.username} (${row.operator_id}) was deleted and is kept, disabled, only because evidence-chain records name it. It never signs in again, so this command sets no password of it. Nothing was changed.`);
        }
        // D56 (2026-11-03): an account with no credential row is not refused - a factory seed deliberately
        // leaves the vendor accounts without one, and this command is the only writer of a credential, so
        // here it CREATES the row. Still no operator is created (R-X2-10): the person must exist first.
        const create = row.has_credential !== true;
        targets = [{ operatorId: row.operator_id, username: row.username, role: row.role, earlierWasDemo: create ? false : await storedHashSetIsDemoPassword(row), create }];
      } else {
        targets = [];
        const systemPrincipals: string[] = [];
        for (const row of (await pool.query<OperatorRow>(SELECT_OPERATOR_CREDENTIALS)).rows) {
          // The predicate of boot check 4c (R-X2-11), one derivation after another.
          if (!(await storedHashSetIsDemoPassword(row))) continue;
          // DF-29 / D20(d): a system principal that holds the demo password is not walked past in silence.
          if (isSystemPrincipal({ operatorId: row.operator_id, username: row.username })) systemPrincipals.push(`${row.username} (${row.operator_id})`);
          else targets.push({ operatorId: row.operator_id, username: row.username, role: row.role, earlierWasDemo: true, create: false });
        }
        if (systemPrincipals.length > 0) {
          return refuse(SetPasswordRefusal.SYSTEM_PRINCIPAL, `${systemPrincipals.join(', ')}: a system principal holds the published demo password. It never signs in and this command sets no password of it; its stored credential must be removed by the security procedure, not replaced. Nothing was changed.`);
        }
      }
    } catch (error) {
      persist('the operators could not be read', codeOf(error), { step: 'operators' });
      return refuse(SetPasswordRefusal.OPERATORS_UNREADABLE, `the operators of ${args.database} could not be read (${codeOf(error)}). Nothing was changed.`);
    }

    const countRemaining = async (): Promise<boolean> => {
      try {
        // The statement and the count of boot check 4c: every row of the table, enabled or not.
        remaining = await demoPasswordHashSetsAmong((await pool.query<StoredHashSetRow>(SELECT_STORED_HASH_SETS)).rows);
        say(`operators that still have the demo password: ${remaining}`);
        return true;
      } catch (error) {
        persist('the count of operators with the demo password could not be read', codeOf(error), { step: 'count' });
        say(`operators that still have the demo password: could not be read (${SetPasswordRefusal.COUNT_UNREADABLE})`);
        return false;
      }
    };

    if (targets.length === 0) {
      say(`${SET_PASSWORD_COMMAND}: no operator of ${args.database} has the demo password. Nothing to do.`);
      return finish((await countRemaining()) && remaining === 0 ? SetPasswordExit.DONE : SetPasswordExit.REFUSED);
    }

    // 6. The summary and the word.
    say(SET_PASSWORD_COMMAND);
    say(`  database:        ${args.database} on ${DATABASE_HOST}:${connection.port}, as the role ${RUNTIME_ROLE}`);
    say(`  data directory:  ${dataDir}`);
    say(`  connection file: ${file} (the file this command read; the Core of this data directory reads the same one)`);
    say(`  operators:       ${targets.length}${args.target.kind === 'ALL_DEMO' ? ' (every operator that still has the published demo password)' : ''}`);
    for (const target of targets) say(`    - ${target.username} (${target.role})${target.create ? ' - no credential yet: one will be created' : ''}`);
    for (const line of STOPPED_LIMIT) say(`  ${line}`);
    say('  Each password is typed twice and is not shown, not even as marks. An empty first entry skips that operator.');
    say('  Every open session of an operator ends when the password is set.');
    const word = await ports.ask(`Type ${SET_WORD} to continue: `);
    if (word !== SET_WORD) return refuse(SetPasswordRefusal.NOT_CONFIRMED, 'the word was not typed. Nothing was changed.');

    let guard: RunRepeatGuard;
    try {
      guard = await createRunRepeatGuard();
    } catch {
      return refuse(SetPasswordRefusal.REPEAT_CHECK_UNAVAILABLE, 'Nothing was changed.');
    }
    const clock = ports.clock;
    const unitPipeline = createPipeline({ pool: () => pool, clock, log: silentLog(), errorLog: ports.errorLog });
    pipeline = unitPipeline;
    const uid = ports.uid();
    const committedSoFar = (): string => (set.length === 0 ? 'no password was set before it' : `set and committed before it: ${set.join(', ')}`);
    let skipped = 0;

    for (const target of targets) {
      // The typed value of this operator, or why there is none.
      let record: PasswordHashRecord | null = null;
      let accepted: string | null = null;
      let outcome: 'SET' | 'SKIPPED' | 'ABORTED' | 'EXHAUSTED' = 'EXHAUSTED';
      for (let attempt = 1; attempt <= TRIES_PER_OPERATOR && record === null; attempt += 1) {
        const buffers: Buffer[] = [];
        try {
          const first = await ports.prompt.readSecretLine(`New password for ${target.username} (${target.role}): `);
          if (first.kind === 'ABORTED') {
            outcome = 'ABORTED';
            break;
          }
          if (first.kind === 'ENTRY_REFUSED') {
            say(`  not accepted (${first.code}): type the password with plain keys only.`);
            continue;
          }
          buffers.push(first.secret);
          if (first.secret.length === 0) {
            outcome = 'SKIPPED';
            break;
          }
          const second = await ports.prompt.readSecretLine('Again: ');
          if (second.kind === 'ABORTED') {
            outcome = 'ABORTED';
            break;
          }
          if (second.kind === 'ENTRY_REFUSED') {
            say(`  not accepted (${second.code}): type the password with plain keys only.`);
            continue;
          }
          buffers.push(second.secret);
          if (!first.secret.equals(second.secret)) {
            say('  the two entries are not the same. Nothing was stored.');
            continue;
          }
          const typed = first.secret.toString('utf8');
          // The policy of row 212, BEFORE hashing (R-X2-6); then the repeat check of this run (SX-13).
          const refusal = checkNewPassword(typed, { username: target.username }) ?? (await guard.refusalOf(typed));
          if (refusal !== null) {
            say(`  not accepted (${refusal.code}): ${PASSWORD_POLICY_REFUSAL[refusal.code]}`);
            continue;
          }
          record = await ports.hasher(typed);
          accepted = typed;
          outcome = 'SET';
        } catch (error) {
          if (error instanceof SecretPromptError) {
            say(`${SET_PASSWORD_COMMAND}: REFUSED (${error.code === 'NOT_A_TERMINAL' ? SetPasswordRefusal.NOT_A_TERMINAL : SetPasswordRefusal.ABORTED}) the terminal could not be read. ${target.username}: NOT set; ${committedSoFar()}.`);
          } else {
            persist('a password could not be judged or hashed', codeOf(error), { step: 'hash', targetOperatorId: target.operatorId });
            say(`${SET_PASSWORD_COMMAND}: REFUSED (${SetPasswordRefusal.UNIT_FAILED}) ${target.username}: NOT set; ${committedSoFar()}.`);
          }
          await countRemaining();
          return finish(SetPasswordExit.REFUSED);
        } finally {
          // The typed bytes are zeroed on every way out of a try.
          for (const buffer of buffers) buffer.fill(0);
        }
      }
      if (outcome === 'SKIPPED') {
        skipped += 1;
        say(`${target.username}: skipped, nothing stored`);
        continue;
      }
      if (outcome === 'ABORTED' || record === null || accepted === null) {
        const reason = outcome === 'ABORTED' ? SetPasswordRefusal.ABORTED : SetPasswordRefusal.TRIES_EXHAUSTED;
        say(`${SET_PASSWORD_COMMAND}: REFUSED (${reason}) ${target.username}: NOT set, nothing of this operator was stored; ${committedSoFar()}.`);
        await countRemaining();
        return finish(SetPasswordExit.REFUSED);
      }

      // ONE unit of work for this operator. `BEGIN`, the chain lock and the settings are the unit's own.
      const hashSet = record;
      let sessionsEnded: number;
      try {
        sessionsEnded = await unitPipeline.run('operator.setPassword', async (unit) => {
          // a. The clock floor first: nothing reads the time before it (decision D110).
          raiseClockFloor(clock, await readNewestStoredInstant(unit));
          const now = clock.now();
          // b. "No other session", again, behind the chain lock (SX-01).
          if ((await unit.query(OTHER_SESSIONS)).rows.length > 0) throw new UnitStop(SetPasswordRefusal.DATABASE_IN_USE);
          // c. Exactly one credential row written (SX-11): replaced, or created for a factory-born account (D56).
          const updated = await unit.query(target.create ? CREATE_CREDENTIAL : SET_CREDENTIAL, [target.operatorId, hashSet.algorithm, hashSet.memoryKib, hashSet.passes, hashSet.parallelism, hashSet.salt, hashSet.hash, now]);
          if (updated.rows.length !== 1) throw new UnitStop(SetPasswordRefusal.CREDENTIAL_ROW_COUNT);
          // d. Replacing a credential ends no session by itself: both, here, with the one reason.
          const ended = await endSessionsOfOperator(unit, target.operatorId, now, REPLACED_REASON);
          await revokeBiometricTokens(unit, { scope: 'OPERATOR', operatorId: target.operatorId, reason: REPLACED_REASON }, now);
          // e. The one audit row, by the unit's writer (SX-02). Five keys, none of them secret (SX-14).
          await unit.audit.append({
            type: AuditType.OPERATOR_PASSWORD_SET,
            actorId: null,
            deviceId: null,
            severity: fixedSeverityOf(AuditType.OPERATOR_PASSWORD_SET) ?? 'WARNING',
            message: AUDIT_MESSAGE,
            details: {
              targetOperatorId: target.operatorId,
              method: 'HOST_COMMAND',
              sessionsEnded: ended.length,
              earlierWasDemo: target.earlierWasDemo,
              ...(Number.isSafeInteger(uid) && uid >= 0 ? { invokerUid: uid } : {}),
            },
          });
          return ended.length;
        });
      } catch (error) {
        const code = codeOf(error);
        persist('the unit of one operator failed and was rolled back', code, { step: 'unit', targetOperatorId: target.operatorId, committedBefore: set.length });
        const why = code === SetPasswordRefusal.DATABASE_IN_USE ? ' Another connection to the database appeared: stop the Core and run again.' : '';
        say(`${SET_PASSWORD_COMMAND}: REFUSED (${code}) ${target.username}: NOT set, its unit was rolled back and nothing of this operator was stored; ${committedSoFar()}.${why}`);
        await countRemaining();
        return finish(SetPasswordExit.REFUSED);
      }
      // Committed. Only now is the value remembered for the repeat check - as a keyed digest, in memory.
      let remembered = true;
      try {
        await guard.remember(accepted);
      } catch {
        remembered = false;
      }
      accepted = null;
      set.push(target.username);
      say(`${target.username}: password set, ${sessionsEnded} session(s) ended`);
      if (!remembered) {
        // Row 215c (security review C-2, code review F-10 (a)): a guard that could not remember must never
        // read as "no repeat" (SX-13). The password of THIS operator is set and committed; what is lost is
        // the check of the operators after it, so nobody after it is prompted. A code and ids, never the value.
        repeatCheckLost = true;
        persist('the repeat check of the run could not remember a password that was set', SetPasswordRefusal.REPEAT_CHECK_LOST, { step: 'remember', targetOperatorId: target.operatorId, committed: set.length });
        if (target !== targets[targets.length - 1]) {
          say(`${SET_PASSWORD_COMMAND}: REFUSED (${SetPasswordRefusal.REPEAT_CHECK_LOST}) set and committed: ${set.join(', ')}; the repeat check of this run is no longer available, so no further password is asked. Run the command again for the operators that are left.`);
          await countRemaining();
          return finish(SetPasswordExit.REFUSED);
        }
        say(`${SET_PASSWORD_COMMAND}: NOTE (${SetPasswordRefusal.REPEAT_CHECK_LOST}) the repeat check of this run was lost after the last password was set; no password was asked after it.`);
      }
    }

    // The final line: the count boot check 4c will compute.
    const counted = await countRemaining();
    if (!counted) return finish(SetPasswordExit.REFUSED);
    if (skipped > 0) {
      say(`${SET_PASSWORD_COMMAND}: NOT COMPLETE, ${skipped} operator(s) skipped.`);
      return finish(SetPasswordExit.REFUSED);
    }
    // Reachable (row 215c, review F-03): every listed operator was set and none skipped, yet the count is not 0 -
    // a credential row that verifies against the demo password appeared AFTER the walk's list was read (a writer
    // the session test did not see, between two of its asks). Kept: the last line must not say "complete" then.
    if (args.target.kind === 'ALL_DEMO' && remaining !== 0) {
      say(`${SET_PASSWORD_COMMAND}: NOT COMPLETE (${SetPasswordRefusal.DEMO_PASSWORD_REMAINS}): a production Core refuses to start until this count is 0.`);
      return finish(SetPasswordExit.REFUSED);
    }
    return finish(SetPasswordExit.DONE);
  } finally {
    if (pipeline !== null) await pipeline.close().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}
