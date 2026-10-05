/**
 * The transaction helper: the state of one unit of work (plan row W21; spec §2.3 stage 9,
 * §8.2 ENG-1, ENG-5, ENG-23; database contract §5.6 AT-1, AT-2, §6.4 AP-1, AP-2, AP-5, AP-7).
 *
 * One unit is one PostgreSQL transaction on one connection of the runtime pool. It is opened
 * at the first statement of the unit, with exactly this sequence:
 *
 *     BEGIN ISOLATION LEVEL READ COMMITTED                    AP-1, stated and not left to a default
 *     SELECT seq, hash FROM public.audit_chain_lock()         AP-2: the first statement; AT-2, AP-7
 *     SELECT set_config('statement_timeout', $1, true),       the unit's time limit, and
 *            set_config('search_path', $2, true)              the unit's search path: both for this transaction only
 *     ... the statements of the unit ...                      AP-4, AP-5
 *     COMMIT                                                  releases the head row lock (PG-06)
 *
 * The chain lock is taken by EVERY unit that opens a transaction, also by one that will append
 * nothing (AT-2): every state change queues at the one head row before it reads anything it
 * decides on, in this process and across processes, and no unit can write another table first
 * and ask for the lock later (AP-7), which is what could make two writers wait on each other.
 *
 * Never a half-written unit:
 *   - a statement that fails marks the unit: it can only roll back, and the pipeline rejects it
 *     with that failure even if the work function caught it;
 *   - a statement that is not a row statement is refused before it is sent (`unit-statement.ts`:
 *     transaction control, a session setting, anything that creates an object, a text with more
 *     than one statement), so `db.transaction()` of the query builder cannot commit the unit
 *     early and nothing of a unit stays behind on its connection. That guard reads the text; it
 *     is a protection against accidents. Behind it, every statement of the unit's user is sent
 *     with the EXTENDED protocol, in which the server itself refuses a text with more than one
 *     command;
 *   - `COMMIT` counts only when the server answers `COMMIT`: for a transaction in the failed
 *     state the server answers `ROLLBACK` to the same statement;
 *   - a connection whose state is not known is closed, never returned to the pool. The server
 *     rolls back what it held;
 *   - a connection that is LOST while the unit holds it (the connection reports an error, or a
 *     statement fails with a code of the connection class) ends the unit as "the database does
 *     not answer": the pipeline rejects with 503 and tells readiness, whatever the work threw.
 *
 * The third statement does two things for this transaction only. It makes the server cancel any
 * statement of the unit that runs longer than the unit may (SQLSTATE 57014), so a unit that the
 * watchdog abandoned cannot keep a lock. And it pins the search path to `public,pg_temp`
 * (finding F53, decision D87): the query builder names its tables without the schema, and
 * PostgreSQL would look into the session's temporary schema first. With the path pinned, the
 * audit insert of every unit finds the real table whatever was done on the connection before,
 * also on a pool that was built without the start-up option of `plugins/db`.
 */
import type { AuditRow, SimEvent } from '@dems/shared/sim';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';
import { RUNTIME_SEARCH_PATH } from '../plugins/db';
import { CoreError, PipelineFailure, PipelineRefusal, isConnectionFailure } from './errors';
import type { ChainHead, UnitContext, UnitDatabase, UnitOfWork } from './types';
import { unitStatementRefusal } from './unit-statement';

/** The statements the unit itself issues, in the order of the header. */
export const UNIT_STATEMENTS = {
  begin: 'BEGIN ISOLATION LEVEL READ COMMITTED',
  chainLock: 'SELECT seq, hash FROM public.audit_chain_lock()',
  /** `$1` the statement limit in milliseconds, `$2` the search path. Both end with the transaction. */
  settings: "SELECT set_config('statement_timeout', $1, true), set_config('search_path', $2, true)",
  commit: 'COMMIT',
  rollback: 'ROLLBACK',
} as const;

/**
 * True when `text` is a statement that a unit of work may not issue: transaction control, a
 * session setting, anything that creates an object, more than one statement. The rules are in
 * `unit-statement.ts`. (The name is the one this function had when it knew transaction control
 * only.)
 */
export function isTransactionControl(text: string): boolean {
  return unitStatementRefusal(text) !== null;
}

/** A statement as the unit sends it: always with the extended protocol (see the header). */
interface UnitQueryConfig extends QueryConfig {
  readonly queryMode: 'extended';
}

/** `query` as the driver gets it from a unit. A copy: the caller's object is not changed. */
export function asUnitQuery(query: string | QueryConfig): UnitQueryConfig {
  return typeof query === 'string' ? { text: query, queryMode: 'extended' } : { ...query, queryMode: 'extended' };
}

/**
 * An INSERT (or MERGE) into `audit_log` or `events`, wherever it stands in the statement. Only
 * the two writers of this folder issue one: a statement of anybody else that names these tables
 * as its target is refused before it is sent, so "the only code path that inserts" is a rule of
 * the unit and not only a convention. The query builder writes the table name in double quotes.
 */
const WRITER_OWNED_INSERT =
  /\b(?:insert|merge)\s+into\s+(?:only\s+)?(?:"?public"?\s*\.\s*)?"?(?:audit_log|events)"?(?![A-Za-z0-9_])/i;

/** True when `text` inserts into a table that only the audit writer or the event writer fills. */
export function isWriterOwnedInsert(text: string): boolean {
  return WRITER_OWNED_INSERT.test(text);
}

export interface UnitDependencies {
  /** The current pool of the runtime role. A function: a reset replaces the pool. */
  readonly pool: () => Pool;
  /** The value of the third statement, in milliseconds. */
  readonly statementTimeoutMs: number;
}

type Phase = 'open' | 'closing' | 'ended';

const ended = (): CoreError =>
  new CoreError('UNIT_ENDED', 'the unit of work has ended: its tools write nothing any more');

/** The handles the pipeline issued, with their state. A handle of anything else is refused. */
const ISSUED = new WeakMap<UnitOfWork, UnitState>();

/** The state behind a handle. Throws `UNIT_NOT_ACTIVE` for an object the pipeline did not issue. */
export function stateOf(unit: UnitOfWork): UnitState {
  const state = ISSUED.get(unit);
  if (state === undefined) {
    throw new CoreError('UNIT_NOT_ACTIVE', 'this is not a unit of work that the pipeline issued (app.pipeline.run)');
  }
  return state;
}

export class UnitState {
  readonly id: number;
  readonly label: string;
  /** Rows and events the unit appended, in order. Read by the pipeline after the commit. */
  readonly auditRows: AuditRow[] = [];
  readonly events: SimEvent[] = [];
  readonly afterCommitTasks: Array<() => void> = [];

  readonly #dependencies: UnitDependencies;
  #phase: Phase = 'open';
  #client: PoolClient | null = null;
  #begun: Promise<void> | null = null;
  #head: ChainHead | null = null;
  /** The first statement that failed. A unit that has one never commits. */
  #failure: { readonly error: unknown } | null = null;
  /** What took the unit's connection away while the unit held it. Such a unit answers 503. */
  #lost: { readonly error: unknown } | null = null;
  #tail: Promise<void> = Promise.resolve();
  #database: UnitDatabase | null = null;
  #writerDatabase: UnitDatabase | null = null;
  #context: UnitContext | null = null;

  constructor(id: number, label: string, dependencies: UnitDependencies) {
    this.id = id;
    this.label = label;
    this.#dependencies = dependencies;
  }

  /** An error on the connection while the unit holds it (the database went away). */
  readonly #onConnectionError = (error: Error): void => {
    this.#lost ??= { error };
    this.#failure ??= { error };
  };

  get ended(): boolean {
    return this.#phase === 'ended';
  }

  /** True once the unit has asked for its transaction. */
  get opened(): boolean {
    return this.#begun !== null;
  }

  /** What the unit is doing, for the log line of a watchdog. */
  get phase(): Phase {
    return this.#phase;
  }

  /** The head after the unit's last append; null while no transaction was opened. */
  get lastHead(): ChainHead | null {
    return this.#head;
  }

  /**
   * What took the unit's connection away while the unit held it: the error the connection
   * reported, or the failure of a statement with a code of the connection class. Null for a unit
   * whose connection is in order. Read by the pipeline when the unit has failed.
   */
  get lostConnection(): { readonly error: unknown } | null {
    return this.#lost;
  }

  /** Binds the handle that the work function receives to this state. */
  issue(context: UnitContext): UnitContext {
    this.#context = context;
    ISSUED.set(context, this);
    return context;
  }

  get context(): UnitContext {
    if (this.#context === null) throw ended();
    return this.#context;
  }

  assertOpen(): void {
    if (this.#phase !== 'open') throw ended();
  }

  // ── The transaction ──────────────────────────────────────────────────────────────────────────

  #ensureBegun(): Promise<void> {
    if (this.#begun === null) {
      this.#begun = this.#begin();
      // Every caller awaits this promise and sees its failure. The handler here only makes sure
      // that a failure nobody awaits (a statement that was started and not awaited) is not an
      // unhandled rejection, which would stop the process.
      this.#begun.catch(() => undefined);
    }
    return this.#begun;
  }

  async #begin(): Promise<void> {
    let client: PoolClient;
    try {
      client = await this.#dependencies.pool().connect();
    } catch (cause) {
      throw new PipelineFailure(PipelineRefusal.DATABASE_UNAVAILABLE, cause);
    }
    if (this.#phase === 'ended') {
      // Abandoned while it waited for a connection: nothing was sent on it.
      client.release();
      throw ended();
    }
    client.on('error', this.#onConnectionError);
    this.#client = client;
    try {
      await client.query(UNIT_STATEMENTS.begin);
      const locked = await client.query<{ seq: string; hash: string }>(UNIT_STATEMENTS.chainLock);
      const row = locked.rows[0];
      const seq = Number(row?.seq);
      if (row === undefined || !Number.isSafeInteger(seq) || seq < 0 || typeof row.hash !== 'string') {
        throw new Error('the chain lock returned no head');
      }
      this.#head = { seq, hash: row.hash };
      await client.query(UNIT_STATEMENTS.settings, [String(this.#dependencies.statementTimeoutMs), RUNTIME_SEARCH_PATH]);
    } catch (cause) {
      this.#release(true);
      throw new PipelineFailure(PipelineRefusal.DATABASE_UNAVAILABLE, cause);
    }
  }

  /** Gives the connection back, or closes it when its state is not known. Once. */
  #release(destroy: boolean): void {
    const client = this.#client;
    if (client === null) return;
    this.#client = null;
    client.removeListener('error', this.#onConnectionError);
    try {
      client.release(destroy ? true : undefined);
    } catch {
      // Already released by the pool (it ended): nothing is left to give back.
    }
  }

  /**
   * One statement of the unit's user (a module, the engine host, the query builder) on the
   * unit's transaction. Refused before it is sent: whatever is not a row statement
   * (`unit-statement.ts`), and an insert into `audit_log` or `events`, which is the writers'
   * alone.
   */
  execute<Row extends QueryResultRow = QueryResultRow>(
    query: string | QueryConfig,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    const text = typeof query === 'string' ? query : query?.text;
    if (typeof text === 'string' && isWriterOwnedInsert(text)) {
      return Promise.reject(
        new CoreError(
          'UNIT_STATEMENT_NOT_ALLOWED',
          'audit rows and events are appended with unit.audit and unit.events: no other statement inserts into those tables',
        ),
      );
    }
    return this.executeAsWriter<Row>(query, values);
  }

  /**
   * One statement on the unit's transaction. The first call opens the transaction. A failure
   * marks the unit, so it cannot commit. Called directly by the two writers only.
   */
  async executeAsWriter<Row extends QueryResultRow = QueryResultRow>(
    query: string | QueryConfig,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    const text = typeof query === 'string' ? query : query?.text;
    const rule = typeof text === 'string' ? unitStatementRefusal(text) : 'NO_TEXT';
    if (rule !== null) {
      // The text of the rule only: the statement itself is never quoted.
      throw new CoreError(
        'UNIT_STATEMENT_NOT_ALLOWED',
        `a unit of work is one transaction that changes rows: transaction control and session settings belong to the pipeline, and a unit creates no object (rule ${rule})`,
      );
    }
    this.assertOpen();
    await this.#ensureBegun();
    const client = this.#client;
    if (this.#phase !== 'open' || client === null) throw ended();
    try {
      const run = client.query.bind(client) as (
        statement: QueryConfig,
        parameters?: unknown[],
      ) => Promise<QueryResult<Row>>;
      // The extended protocol, with or without values: the server takes one command per text.
      const statement = asUnitQuery(query);
      return await (values === undefined ? run(statement) : run(statement, [...values]));
    } catch (error) {
      this.#failure ??= { error };
      if (isConnectionFailure(error)) this.#lost ??= { error };
      throw error;
    }
  }

  /** The head the unit extends next: what AP-2 returned, plus the unit's own appends. */
  async chainHead(): Promise<ChainHead> {
    this.assertOpen();
    await this.#ensureBegun();
    if (this.#phase !== 'open' || this.#head === null) throw ended();
    return this.#head;
  }

  /** Called by the audit writer after each row it inserted. */
  recordAuditRow(row: AuditRow): void {
    this.#head = { seq: row.seq, hash: row.hash };
    this.auditRows.push(row);
  }

  recordEvent(event: SimEvent): void {
    this.events.push(event);
  }

  /**
   * Runs the writers' tasks of this unit strictly one after another, so that two appends that
   * were started together cannot both extend the same head.
   */
  serial<T>(task: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(task);
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** The typed query builder on this transaction. Built at first use. */
  get database(): UnitDatabase {
    if (this.#database === null) {
      const client = {
        query: (query: string | QueryConfig, values?: unknown[]) => this.execute(query, values),
      };
      this.#database = drizzle({ client: client as unknown as PoolClient, logger: false });
    }
    return this.#database;
  }

  /**
   * The same builder for the two writers of this folder: its statements skip the rule that
   * keeps everybody else out of `audit_log` and `events`. It is not reachable from the handle.
   */
  get writerDatabase(): UnitDatabase {
    if (this.#writerDatabase === null) {
      const client = {
        query: (query: string | QueryConfig, values?: unknown[]) => this.executeAsWriter(query, values),
      };
      this.#writerDatabase = drizzle({ client: client as unknown as PoolClient, logger: false });
    }
    return this.#writerDatabase;
  }

  // ── The end of the unit: called by the pipeline only ─────────────────────────────────────────

  /**
   * Commits. Resolves `true` when a transaction was committed and `false` when the unit never
   * opened one. Throws when the unit cannot be committed; nothing of it is stored then.
   */
  async commit(): Promise<boolean> {
    if (this.#phase !== 'open') throw ended();
    this.#phase = 'closing';
    if (this.#begun === null) {
      this.#phase = 'ended';
      return false;
    }
    try {
      await this.#begun;
    } catch (error) {
      this.#phase = 'ended';
      throw error;
    }
    const client = this.#client;
    if (client === null) throw ended();
    if (this.#failure !== null) {
      await this.#rollbackOn(client);
      throw this.#failure.error;
    }
    let command: string;
    try {
      ({ command } = await client.query(UNIT_STATEMENTS.commit));
    } catch (cause) {
      this.#release(true);
      this.#phase = 'ended';
      throw new PipelineFailure(PipelineRefusal.COMMIT_FAILED, cause);
    }
    // A transaction in the failed state answers ROLLBACK to COMMIT. It was not committed.
    const committed = command === 'COMMIT';
    this.#release(!committed);
    this.#phase = 'ended';
    if (committed) return true;
    const failure = this.#failure as { readonly error: unknown } | null;
    if (failure !== null) throw failure.error;
    throw new PipelineFailure(PipelineRefusal.COMMIT_FAILED);
  }

  /** Rolls back. Never throws: a connection that does not answer is closed. */
  async rollback(): Promise<void> {
    if (this.#phase !== 'open') return;
    this.#phase = 'closing';
    if (this.#begun !== null) {
      try {
        await this.#begun;
      } catch {
        // The transaction never opened; `#begin` already dealt with the connection.
      }
      if (this.#client !== null) await this.#rollbackOn(this.#client);
    }
    this.#phase = 'ended';
  }

  async #rollbackOn(client: PoolClient): Promise<void> {
    if (this.#lost !== null) {
      // Nothing can be said to a connection that is gone, and it never goes back to the pool.
      this.#release(true);
      this.#phase = 'ended';
      return;
    }
    try {
      await client.query(UNIT_STATEMENTS.rollback);
      this.#release(false);
    } catch {
      this.#release(true);
    }
    this.#phase = 'ended';
  }

  /**
   * The watchdog's and the shutdown's way out: the unit ends now and its connection is closed,
   * so the server rolls back whatever the unit held. Statements that are still under way fail.
   */
  abandon(): void {
    this.#phase = 'ended';
    this.#release(true);
  }
}
