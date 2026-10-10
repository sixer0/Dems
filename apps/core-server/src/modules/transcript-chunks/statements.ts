/**
 * The statements of the `transcript_chunks` store (blueprint row 77 / M6-W2; database contract
 * dbc-3 §B.7 and its privileges, migration `0005_capture_privileges.sql`; transcript spec §D.1).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). Every table is named with its schema.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE (0005): SELECT, INSERT, and UPDATE of exactly five columns —
 * `status, segments, embedding_ref, model_id, computed_at`. No DELETE: a chunk row is never
 * removed, and a chunk that ended FAILED keeps its row (a re-run is a new row, dbc-3 §G). The
 * audio range and the key of a row are written once, by the insert, and never again.
 *
 * `embedding_ref` is the diarization artifact reference of row 78: this file never writes it in an
 * update, so a later row can add its own statement without touching these.
 */
import type { QueryResultRow } from 'pg';

/** A connection that runs one parameterised statement: the runtime pool, or a unit of work. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

/**
 * The four states of a chunk row (`transcript_chunks_status_check`, dbc-3 §B.7). Written here and
 * not imported from the typed schema: a module does not reach into `db/schema` (import guard,
 * rule 5). The unit test of this folder holds the list to the schema's value set.
 */
export const TRANSCRIPT_CHUNK_STATES = ['PENDING', 'RUNNING', 'DONE', 'FAILED'] as const;
export type TranscriptChunkStatusValue = (typeof TRANSCRIPT_CHUNK_STATES)[number];

const COLUMNS = 'session_id, seq, audio_from_ms, audio_to_ms, status, segments, embedding_ref, model_id, computed_at';

/**
 * THE SEAL CLOSES THE ROWS OF A SESSION (code review row 80, R80-03; defence in depth behind the
 * stop of the session's own runner). Once the `FINALIZE_TRANSCRIPT` step of the session is DONE in
 * `sealing_jobs`, the transcript block of its manifest - `failedChunks` among it - is fixed and is
 * about to be signed: from then on NO chunk row of that session is inserted or changed, whoever
 * asks. While the step runs (the close-out writes its FAILED rows then) the rows are open.
 */
const SESSION_TRANSCRIPT_OPEN = "NOT EXISTS (SELECT 1 FROM public.sealing_jobs j WHERE j.session_id = $1 AND j.step = 'FINALIZE_TRANSCRIPT' AND j.status = 'DONE')";

/**
 * One planned or re-planned chunk row. A row that already exists (same `session_id, seq`) is left
 * exactly as it is: the insert is how a resume brings the table in line with the checkpoint file
 * without ever rewriting a committed row. No row is inserted for a session whose transcript the
 * seal has closed.
 */
export const INSERT_TRANSCRIPT_CHUNK = `INSERT INTO public.transcript_chunks (${COLUMNS}) SELECT $1::text, $2::integer, $3::bigint, $4::bigint, $5::text, $6::jsonb, $7::text, $8::text, $9::bigint WHERE ${SESSION_TRANSCRIPT_OPEN} ON CONFLICT (session_id, seq) DO NOTHING`;

/** The state of one row: four of the five columns the runtime role may update. Not for a session whose transcript the seal has closed. */
export const UPDATE_TRANSCRIPT_CHUNK = `UPDATE public.transcript_chunks SET status = $3, segments = $4::jsonb, model_id = $5, computed_at = $6 WHERE session_id = $1 AND seq = $2 AND ${SESSION_TRANSCRIPT_OPEN}`;

/** Why a write changed no row: is the transcript of the session closed by its seal, and does the row exist. */
export const READ_TRANSCRIPT_CHUNK_WRITE_STATE = `SELECT (NOT ${SESSION_TRANSCRIPT_OPEN}) AS sealed, EXISTS (SELECT 1 FROM public.transcript_chunks c WHERE c.session_id = $1 AND c.seq = $2) AS present`;

/** Every row of one session, in row order. */
export const READ_TRANSCRIPT_CHUNKS = `SELECT ${COLUMNS} FROM public.transcript_chunks WHERE session_id = $1 ORDER BY seq`;
