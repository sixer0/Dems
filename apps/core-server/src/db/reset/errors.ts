/**
 * The failures of the reset routine (plan row W29; database contract §8.5, the column
 * "On failure" of R-0 to R-9).
 *
 * A `ResetError` says which step failed and whether the name of the target still points at the
 * database it pointed at before the routine started (`targetUntouched`). That is true for every
 * failure before the swap of R-7 has committed: the routine builds beside the live database and
 * drops the old one last.
 *
 * WHAT A MESSAGE MAY HOLD. A database name that passed the name guard, a role name, a table or
 * constraint name, an SQLSTATE, a count. Never a value of a row and never a value of the owner
 * connection file. The driver's and the query builder's own messages are not passed on: a
 * `DETAIL` line quotes the key of a violated constraint, and the query builder quotes the whole
 * statement with its parameters, which here are the carried rows (token hashes among them, NL-1).
 * For the same reason a `ResetError` never carries the original error as `cause`.
 */

/** The ten steps of contract §8.5. */
export const RESET_STEPS = ['R-0', 'R-1', 'R-2', 'R-3', 'R-4', 'R-5', 'R-6', 'R-7', 'R-8', 'R-9'] as const;
export type ResetStep = (typeof RESET_STEPS)[number];

/**
 * The points at which the routine reports where it is, in order. Each is announced BEFORE the
 * first statement of what it names, so an observer that throws there stands for a failure of
 * that part with nothing of it done.
 *
 *   R-0          the owner connection is about to be opened (the name passed the guard)
 *   R-1          the caller's quiesce, then "no session on the target"
 *   R-2          leftovers of an earlier run
 *   R-3          the read of the kept data
 *   R-4          CREATE DATABASE of the staging database
 *   R-5a         the migrations
 *   R-5b         BEGIN, then the seed
 *   R-5c         the carry-over
 *   R-5d         the ACTIVE pairing code; `operators.last_sign_in_at`
 *   R-5e         the lineage row
 *   R-5f         the SCENARIO_LOADED row and event
 *   R-5:commit   COMMIT of the build transaction
 *   R-6          the verification
 *   R-7          "no session on the target or the staging database"
 *   R-7:rename   BEGIN and the two renames
 *   R-8          DROP DATABASE of the previous database
 *   R-9          the advisory lock is released and the owner connection closed
 */
export const RESET_CHECKPOINTS = [
  'R-0',
  'R-1',
  'R-2',
  'R-3',
  'R-4',
  'R-5a',
  'R-5b',
  'R-5c',
  'R-5d',
  'R-5e',
  'R-5f',
  'R-5:commit',
  'R-6',
  'R-7',
  'R-7:rename',
  'R-8',
  'R-9',
] as const;
export type ResetCheckpoint = (typeof RESET_CHECKPOINTS)[number];

/** The step a checkpoint belongs to. */
export function stepOf(checkpoint: ResetCheckpoint): ResetStep {
  return checkpoint.slice(0, 3) as ResetStep;
}

export type ResetErrorCode =
  /** Before R-0: an option of the call is not usable (scenario, reason, actor, clock). */
  | 'RESET_OPTIONS_INVALID'
  /** R-0: the name is not a database this routine may reset. No file was read, no connection opened. */
  | 'RESET_TARGET_REFUSED'
  /** R-0: the owner connection file is missing, readable by others, or malformed. */
  | 'RESET_OWNER_CREDENTIALS'
  /** R-0: PostgreSQL does not answer, or refused the owner role. */
  | 'RESET_DATABASE_UNREACHABLE'
  /** R-0: the session is a superuser, or is not `dems_owner`. A configuration defect. */
  | 'RESET_ROLE_PRIVILEGED'
  /** R-0: another reset of this target holds the advisory lock. */
  | 'RESET_ALREADY_RUNNING'
  /**
   * R-0: real sealed evidence exists, in the database, on disk, or in both (`dbc-3` §E.2; OD-19,
   * RK-16, SEC35-22). A precondition of the routine: it refuses before R-1, so nothing was
   * quiesced and the target is exactly what it was.
   */
  | 'RESET_BLOCKED_REAL_EVIDENCE'
  /**
   * R-3: the caller cannot tell which folder holds this Core's media, so the real-evidence guard
   * has nothing to judge (erratum PE-0013-01; ruling D166). The command line: its environment
   * carries no media root and the database stores none. Read-only pass; the target is untouched.
   */
  | 'RESET_STORE_ROOT_UNKNOWN'
  /**
   * R-3: the caller's environment names one media root and the database stores another (what the
   * Core recorded at its last start). The guard can judge one folder; it refuses to choose.
   */
  | 'RESET_STORE_ROOT_CONFLICT'
  /** R-1: the caller's quiesce hook failed. */
  | 'RESET_QUIESCE_FAILED'
  /** R-1, R-7: a session is open on the target (or on the staging database). Nobody's session is ended. */
  | 'RESET_TARGET_IN_USE'
  /** R-2: the target, or a leftover of it, does not belong to `dems_owner` or is a template. */
  | 'RESET_TARGET_NOT_OURS'
  /** R-2: a leftover could not be removed. */
  | 'RESET_LEFTOVER_FAILED'
  /** R-2: the target was missing and its previous copy existed: it was renamed back. Run again. */
  | 'RESET_RECOVERED_PREVIOUS'
  /** R-3: the target is not at the schema version this code builds. Migrate first. */
  | 'RESET_SCHEMA_MISMATCH'
  /** R-3: the kept data could not be read. */
  | 'RESET_READ_FAILED'
  /** R-4: the staging database could not be created. */
  | 'RESET_CREATE_FAILED'
  /** R-5: migrations, seed, carry-over, lineage row or SCENARIO_LOADED row failed. */
  | 'RESET_BUILD_FAILED'
  /** R-6: the built database is not what the routine expects; it is not swapped in. */
  | 'RESET_VERIFY_FAILED'
  /** R-7: the swap did not happen. */
  | 'RESET_SWAP_FAILED';

export interface ResetErrorFacts {
  /** The SQLSTATE the server answered, when a statement failed. */
  readonly sqlState?: string | undefined;
  /** The constraint the server named, when there was one. */
  readonly constraint?: string | undefined;
  /** The table the server named, when there was one. */
  readonly table?: string | undefined;
  /**
   * False only when the swap may have committed: the name of the target then points, or may
   * point, at the new database. Default true.
   */
  readonly targetUntouched?: boolean;
}

/** A refused or failed reset. `message` is safe to print and to log. */
export class ResetError extends Error {
  readonly code: ResetErrorCode;
  readonly step: ResetStep;
  readonly targetUntouched: boolean;
  readonly sqlState: string | undefined;
  readonly constraint: string | undefined;
  readonly table: string | undefined;

  constructor(code: ResetErrorCode, step: ResetStep, message: string, facts: ResetErrorFacts = {}) {
    super(message);
    this.name = 'ResetError';
    this.code = code;
    this.step = step;
    this.targetUntouched = facts.targetUntouched ?? true;
    this.sqlState = facts.sqlState;
    this.constraint = facts.constraint;
    this.table = facts.table;
  }
}

export interface ServerAnswer {
  readonly sqlState: string | undefined;
  readonly constraint: string | undefined;
  readonly table: string | undefined;
}

const SQLSTATE = /^[0-9A-Z]{5}$/;
const NAME = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * What the server said about a failed statement: its SQLSTATE, and the constraint and table it
 * named. The query builder wraps the driver's error, so the answer is looked for on `cause` as
 * well. Nothing else of the error is read: not its message, not its detail, not its parameters.
 */
export function serverAnswer(error: unknown): ServerAnswer {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; constraint?: unknown; table?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string' && SQLSTATE.test(candidate.code)) {
      return {
        sqlState: candidate.code,
        constraint: typeof candidate.constraint === 'string' && NAME.test(candidate.constraint) ? candidate.constraint : undefined,
        table: typeof candidate.table === 'string' && NAME.test(candidate.table) ? candidate.table : undefined,
      };
    }
    current = candidate.cause;
  }
  return { sqlState: undefined, constraint: undefined, table: undefined };
}

/** The operating-system error code of a failed connection (`ECONNREFUSED`, `EPERM`, ...), or `undefined`. */
export function systemErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string' && /^E[A-Z]{2,}$/.test(candidate.code)) return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

/** A printable description of a server answer: "SQLSTATE 23503 (constraint x on table y)". */
export function describeAnswer(answer: ServerAnswer): string {
  if (answer.sqlState === undefined) return 'the statement failed before the server answered';
  const named = [
    answer.constraint === undefined ? '' : `constraint ${answer.constraint}`,
    answer.table === undefined ? '' : `table ${answer.table}`,
  ].filter((part) => part !== '');
  return `the server answered SQLSTATE ${answer.sqlState}${named.length === 0 ? '' : ` (${named.join(', ')})`}`;
}
