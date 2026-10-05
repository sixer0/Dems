/**
 * The types of the core services (plan row W21): the pipeline, the unit of work and its two
 * writers. Types only; `index.ts` re-exports them, and that is where other units import from.
 */
import type { AuditRow, AuditType, Details, Severity, SimEvent, SimEventType } from '@dems/shared/sim';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { QueryResult, QueryResultRow } from 'pg';

// ── The unit of work ───────────────────────────────────────────────────────────────────────────

/**
 * The handle of one unit of work: one turn in the serial pipeline and at most one PostgreSQL
 * transaction (ENG-1, ENG-23). A function that takes part in somebody else's unit takes this
 * handle. Only a handle that the pipeline issued, and whose unit has not ended, is accepted by
 * the core services; anything else is refused with `UNIT_NOT_ACTIVE` or `UNIT_ENDED`.
 */
export interface UnitOfWork {
  /** What the unit does, for the log; for example `identity.signIn`. A name, never request data. */
  readonly label: string;
}

/** The newest row of the audit chain: its sequence and its hash (64 zero digits when empty). */
export interface ChainHead {
  readonly seq: number;
  readonly hash: string;
}

/** Drizzle bound to the unit's transaction. Its query logger is off (database contract NL-4). */
export type UnitDatabase = NodePgDatabase<Record<string, never>>;

/**
 * What the pipeline hands to the work function: the handle and the tools that are bound to the
 * unit's one transaction on its one connection.
 *
 * The transaction is opened at the FIRST use of `db`, `query`, `audit` or `events`, with exactly
 * these statements: `BEGIN` at READ COMMITTED, then the chain lock (append protocol AP-2, AP-7;
 * AT-2), then one statement that sets the statement time limit of the unit and pins its search
 * path (`public,pg_temp`: a table named without its schema is the real one, finding F53). A unit
 * that never touches the database opens no transaction and costs no round trip (an engine tick
 * that changed nothing durable).
 *
 * A statement of a unit is a ROW statement: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`, a
 * `WITH` query, `VALUES`, `SET LOCAL`, `SET CONSTRAINTS`; one statement per text. Anything else
 * is refused before it is sent with the `CoreError` `UNIT_STATEMENT_NOT_ALLOWED`, whose text
 * names the rule (`unit-statement.ts`).
 *
 * Every tool refuses to work once the unit has ended, so a reference that outlives the unit
 * cannot write outside it.
 */
export interface UnitContext extends UnitOfWork {
  /** 1, 2, 3, ... in the order in which the units of this process ran. For log lines. */
  readonly id: number;
  /** The typed query builder on the unit's transaction. `db.transaction()` is refused. */
  readonly db: UnitDatabase;
  /** One row statement with bind parameters on the unit's transaction (SR-67). */
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
  /** The audit writer of this unit: the only code path that inserts into `audit_log`. */
  readonly audit: UnitAuditWriter;
  /** The event writer of this unit: the only code path that inserts into `events`. */
  readonly events: UnitEventWriter;
  /**
   * Runs `task` after the unit committed and before the next unit starts, in the order of the
   * calls: the place to publish, so that publications leave in commit order (spec §2.3 stage
   * 10). It does not run when the unit rolls back. `task` is synchronous; what it throws is
   * logged by its code and never undoes the commit.
   */
  afterCommit(task: () => void): void;
}

// ── The audit writer ───────────────────────────────────────────────────────────────────────────

/**
 * A row a server-native module asks for (spec §13; ENG-12). The writer supplies everything
 * else: the sequence, the identifier, the category of the type, the two hashes, and `at` from
 * the server clock. A caller cannot set a time (SR-65, AC-B-55): an entry that carries any other
 * member is refused.
 *
 * `actorId` and `deviceId` are required members on purpose: who did it is a decision of the
 * caller, and `null` says "the system" or "no device" in so many words.
 */
export interface AuditEntry {
  /** One of the 53 shared audit types. */
  readonly type: AuditType;
  /** English fallback text. The clients render their own copy from `type` and `details`. */
  readonly message: string;
  /** Default `INFO`. */
  readonly severity?: Severity;
  /** The operator ID from the session, or null. Never a username that was typed (SR-54). */
  readonly actorId: string | null;
  /** The Core's ID, a hardware ID or a registry ID, or null. */
  readonly deviceId: string | null;
  readonly sessionId?: string | null;
  readonly evidenceId?: string | null;
  /**
   * Flat values. No key that may name a secret, no value that has the form of a credential
   * (SR-54). The nine server-written types accept exactly the keys of spec §13.1.
   */
  readonly details: Details;
}

export interface UnitAuditWriter {
  /**
   * Appends one row to the chain inside this unit (append protocol AP-1 to AP-5, AP-7) and
   * returns it as stored, with its sequence and hash. The row is validated BEFORE a statement
   * is sent; a refusal is a `CoreError` whose `code` names the rule.
   */
  append(entry: AuditEntry): Promise<AuditRow>;
  /** The same for several rows, which share one `at`. Returns them in chain order. */
  appendMany(entries: readonly AuditEntry[]): Promise<AuditRow[]>;
  /**
   * For the engine host (append protocol AP-6): rows that the engine already built in memory
   * with the shared `appendActivity`. They are validated and their digests recomputed, and they
   * must continue the head of this unit. If they do not, another writer exists: the server logs
   * `audit head diverged` and the unit fails with 503 (`AUDIT_HEAD_DIVERGED`).
   */
  appendPrepared(rows: readonly AuditRow[]): Promise<void>;
  /** The head this unit extends next: the stored head of AP-2 plus what the unit appended. */
  head(): Promise<ChainHead>;
  /** The rows this unit has appended so far, in chain order. They are not committed yet. */
  appended(): readonly AuditRow[];
}

/**
 * The seam `app.auditWriter` (P25). `append` is the scaffold's signature, kept as it is; it
 * calls `unit.audit.append(entry)` and drops the result. Code that needs the stored row (its
 * sequence and hash, for a publication) calls `unit.audit.append` itself.
 */
export interface AuditWriter {
  /** Appends one row to the one chain, inside the caller's unit of work (ENG-8). */
  append(unit: UnitOfWork, entry: AuditEntry): Promise<void>;
}

// ── The event writer ───────────────────────────────────────────────────────────────────────────

/** An operational event a server-native module asks for. The writer supplies seq, id and `at`. */
export interface EventEntry {
  /** One of the 46 shared event types. */
  readonly type: SimEventType;
  /** English fallback text. */
  readonly message: string;
  /** Default `INFO`. */
  readonly severity?: Severity;
  /** Flat values, under the same rules as audit details. Default `{}`. */
  readonly params?: Details;
  readonly sessionId?: string | null;
  readonly deviceId?: string | null;
}

export interface UnitEventWriter {
  /**
   * Appends one event inside this unit and returns it as stored. Its sequence is taken from the
   * `event` counter with one statement that reads and advances it (atomicity rule AT-5).
   */
  append(entry: EventEntry): Promise<SimEvent>;
  /** The same for several events, which share one `at` and take consecutive sequences. */
  appendMany(entries: readonly EventEntry[]): Promise<SimEvent[]>;
  /**
   * For the engine host: events the engine already built, with the sequences its own counter
   * gave them. The stored counter is raised to one above the highest of them.
   */
  appendPrepared(events: readonly SimEvent[]): Promise<void>;
  /** The events this unit has appended so far. They are not committed yet. */
  appended(): readonly SimEvent[];
}

// ── The pipeline ───────────────────────────────────────────────────────────────────────────────

/** What a unit that committed a transaction wrote to the trail. */
export interface CommittedUnit {
  readonly id: number;
  readonly label: string;
  /** Every audit row of the unit, in chain order: those the writer built and those prepared. */
  readonly auditRows: readonly AuditRow[];
  readonly events: readonly SimEvent[];
  /** The head of the chain after this commit. */
  readonly head: ChainHead;
}

export interface PipelineSnapshot {
  /** False from `close()` on. */
  readonly accepting: boolean;
  readonly running: { readonly id: number; readonly label: string } | null;
  /** Units that wait for their turn. */
  readonly pending: number;
  /** Units that ended well: committed, or returned without touching the database. */
  readonly completed: number;
  /** Units whose work threw or whose commit failed. Nothing of them is stored. */
  readonly failed: number;
  readonly timedOut: number;
  /** Submissions that were refused because the queue was full or closed. */
  readonly refused: number;
}

/**
 * The serial unit-of-work queue (spec §2.3 stages 8 and 9; ENG-1, ENG-6, ENG-23; SR-72). The
 * engine host and every server-native module share this one instance, `app.pipeline`.
 */
export interface Pipeline {
  /**
   * Runs `work` as one unit: strictly after every unit submitted before it (ENG-6), in at most
   * one transaction on one connection. Resolves with what `work` returned AFTER the commit;
   * rejects, with nothing stored, when `work` throws (with what it threw), when a statement of
   * the unit failed (with that failure, also if `work` caught it), or when the pipeline could
   * not run or commit it (`PipelineFailure`, 503). A unit whose connection went away while it
   * held it rejects with that 503 (`DATABASE_UNAVAILABLE`) whatever `work` threw.
   */
  run<T>(label: string, work: (unit: UnitContext) => Promise<T> | T): Promise<T>;
  /** Resolves when no unit is running or waiting. It does not stop new submissions. */
  drain(): Promise<void>;
  /**
   * `listener` is called after every commit, before the unit's own `afterCommit` tasks and
   * before the next unit starts. Returns the function that removes it. For the engine host,
   * whose in-memory ring must learn the rows that server-native units appended.
   */
  onCommit(listener: (unit: CommittedUnit) => void): () => void;
  snapshot(): PipelineSnapshot;
  /**
   * Shutdown: refuses new units from now on, lets the accepted ones finish, and after
   * `PIPELINE_CLOSE_TIMEOUT_MS` refuses whatever is still waiting and abandons what is running.
   */
  close(): Promise<void>;
}
