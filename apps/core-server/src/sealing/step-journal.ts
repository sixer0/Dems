/**
 * THE JOURNAL OF ONE SEALING STEP: a row of `sealing_jobs` (database contract dbc-3 §B.4;
 * evidence package spec §B.8, §E.1 "checkpoint", §E.2).
 *
 * One row per `(session_id, step)`. A step writes its row when it starts (`RUNNING`), as it
 * moves, and once more when it ends (`DONE` with its checkpoint, or `FAILED` with a code). A
 * resumed seal reads the row first: that is how it knows what is already committed.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE (migration 0005): SELECT, INSERT, and UPDATE of exactly
 * `status, progress, eta_ms, attempt, checkpoint, error_code, updated_at`. No DELETE. So the one
 * write statement is an insert that, for an existing row, sets those seven columns and nothing
 * else: `started_at` and the key are written once.
 *
 * SCOPE. Built by row 79 for `FINALIZE_TRANSCRIPT`; it knows nothing of that step and row 82 (the
 * pipeline) may use it for every step or replace it. Progress is whatever the caller says:
 * forward-only is a display rule of the clients (ev §E.2), and a resumed attempt may rewrite it.
 *
 * Statements are constant texts with bind parameters (SR-67). Failures are typed and never
 * swallowed; this file has no log, its caller logs.
 */
import type { QueryResultRow } from 'pg';

/** A connection that runs one parameterised statement: the runtime pool, or a unit of work. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

/** `sealing_jobs_status_check`. Held to the schema's value set by the test of this folder. */
export const SEALING_STEP_STATES = ['RUNNING', 'DONE', 'FAILED'] as const;
export type SealingStepStatus = (typeof SEALING_STEP_STATES)[number];

/** A JSON object: what `sealing_jobs.checkpoint` holds (`sealing_jobs_checkpoint_check`). */
export type StepCheckpoint = Readonly<Record<string, unknown>>;

export interface SealingStepRecord {
  readonly sessionId: string;
  readonly step: string;
  readonly status: SealingStepStatus;
  /** 0..100. */
  readonly progress: number;
  readonly etaMs: number | null;
  /** >= 1. */
  readonly attempt: number;
  readonly checkpoint: StepCheckpoint | null;
  /** A `CODE`, or null. */
  readonly errorCode: string | null;
  /** Epoch milliseconds, Core instants. `startedAt` is kept from the first write of the row. */
  readonly startedAt: number;
  readonly updatedAt: number;
}

/** What a write states. `at` becomes `updated_at`, and `started_at` when the row is new. */
export type SealingStepWrite = Omit<SealingStepRecord, 'startedAt' | 'updatedAt'> & { readonly at: number };

export interface SealingStepJournal {
  read(sessionId: string, step: string): Promise<SealingStepRecord | null>;
  write(record: SealingStepWrite): Promise<void>;
}

export type SealingStepJournalErrorCode = 'READ_FAILED' | 'WRITE_FAILED';

export class SealingStepJournalError extends Error {
  readonly code: SealingStepJournalErrorCode;
  /** The SQLSTATE of the database, when it gave one. */
  readonly sqlState: string | null;
  /** The constraint the database named, when it named one. */
  readonly constraint: string | null;

  constructor(code: SealingStepJournalErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'SealingStepJournalError';
    this.code = code;
    const fields = (cause ?? {}) as { code?: unknown; constraint?: unknown };
    this.sqlState = typeof fields.code === 'string' ? fields.code : null;
    this.constraint = typeof fields.constraint === 'string' ? fields.constraint : null;
  }
}

const COLUMNS = 'session_id, step, status, progress, eta_ms, attempt, checkpoint, error_code, started_at, updated_at';

export const READ_SEALING_STEP = `SELECT ${COLUMNS} FROM public.sealing_jobs WHERE session_id = $1 AND step = $2`;

/** Insert, or set the seven columns the runtime role may update. `started_at` is never rewritten. */
export const WRITE_SEALING_STEP = `INSERT INTO public.sealing_jobs (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $9)
ON CONFLICT (session_id, step) DO UPDATE SET status = EXCLUDED.status, progress = EXCLUDED.progress, eta_ms = EXCLUDED.eta_ms, attempt = EXCLUDED.attempt, checkpoint = EXCLUDED.checkpoint, error_code = EXCLUDED.error_code, updated_at = EXCLUDED.updated_at`;

interface StoredRow {
  session_id: string;
  step: string;
  status: string;
  progress: number;
  eta_ms: string | number | null;
  attempt: number;
  checkpoint: unknown;
  error_code: string | null;
  started_at: string | number;
  updated_at: string | number;
}

const isObject = (value: unknown): value is StepCheckpoint => typeof value === 'object' && value !== null && !Array.isArray(value);

export function createSealingStepJournal(connection: Queryable): SealingStepJournal {
  return Object.freeze({
    async read(sessionId: string, step: string): Promise<SealingStepRecord | null> {
      let row: StoredRow | undefined;
      try {
        row = (await connection.query<StoredRow>(READ_SEALING_STEP, [sessionId, step])).rows[0];
      } catch (error) {
        throw new SealingStepJournalError('READ_FAILED', 'the sealing step row could not be read', error);
      }
      if (row === undefined) return null;
      return {
        sessionId: row.session_id,
        step: row.step,
        status: row.status as SealingStepStatus,
        progress: Number(row.progress),
        etaMs: row.eta_ms === null ? null : Number(row.eta_ms),
        attempt: Number(row.attempt),
        checkpoint: isObject(row.checkpoint) ? row.checkpoint : null,
        errorCode: row.error_code,
        startedAt: Number(row.started_at),
        updatedAt: Number(row.updated_at),
      };
    },

    async write(record: SealingStepWrite): Promise<void> {
      try {
        await connection.query(WRITE_SEALING_STEP, [
          record.sessionId,
          record.step,
          record.status,
          record.progress,
          record.etaMs,
          record.attempt,
          record.checkpoint === null ? null : JSON.stringify(record.checkpoint),
          record.errorCode,
          record.at,
        ]);
      } catch (error) {
        throw new SealingStepJournalError('WRITE_FAILED', 'the sealing step row could not be written', error);
      }
    },
  });
}
