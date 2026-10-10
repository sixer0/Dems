/**
 * The statements of the sealed-transcript store (blueprint row 78 / M6-W3; database contract dbc-3
 * §B.8 `transcripts`, §B.9 `transcript_revisions`, §B.11 `evidence_items.transcript_sha256`, and
 * their privileges, migration `0005_capture_privileges.sql`).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). Every table is named with its schema.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE (0005). `transcripts` and `transcript_revisions`: SELECT and
 * INSERT, nothing else — no UPDATE and no DELETE, so the machine transcript of an item is
 * byte-unchanged for ever and a revision is only ever appended (OD-15). `evidence_items`: the
 * runtime role has NO UPDATE grant on `transcript_sha256` (nor on `labels_status`,
 * `manifest_version`): the value is written by the INSERT of the item and never again. This file
 * therefore holds no statement that writes `evidence_items`; it READS the value the item's insert
 * wrote, inside the same unit of work, and the store refuses a transcript that is not the one the
 * item is bound to.
 *
 * There is no `SELECT … FOR UPDATE` here: a row lock needs an UPDATE privilege the runtime role
 * does not have on these tables. Two revisions racing for the same number are separated by the
 * primary key `(evidence_id, revision_no)`: the second insert fails 23505, which the store reports
 * as the revision conflict it is.
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
 * The two speaker states (`transcripts_labels_check`, dbc-3 §B.8). Written here and not imported
 * from the typed schema: a module does not reach into `db/schema` (import guard, rule 5). The unit
 * test of this folder holds the list to the schema's value set.
 */
export const TRANSCRIPT_LABELS_STATES = ['LABELLED', 'UNAVAILABLE'] as const;
export type TranscriptLabelsStatusValue = (typeof TRANSCRIPT_LABELS_STATES)[number];

/** The two signature algorithms of a revision (`transcript_revisions_signature_check`, dbc-3 §B.9). */
export const TRANSCRIPT_REVISION_ALGORITHMS = ['Ed25519', 'SIMULATED-SHA256'] as const;
export type TranscriptRevisionAlgorithmValue = (typeof TRANSCRIPT_REVISION_ALGORITHMS)[number];

const TRANSCRIPT_COLUMNS = 'evidence_id, json_sha256, srt_sha256, vtt_sha256, model, diarization, labels_status, created_at';
const REVISION_COLUMNS =
  'evidence_id, revision_no, parent_sha256, sha256, author_id, reason, signature_value, signature_key_id, signature_algorithm, signature_simulated, signature_certificate_sha256, created_at';

/** What the INSERT of the item bound it to. One row, or none when the item does not exist (yet). */
export const READ_ITEM_TRANSCRIPT_BINDING = 'SELECT transcript_sha256 FROM public.evidence_items WHERE id = $1';

/** The sealed machine transcript of one item: revision 0. No conflict clause — a second insert must fail. */
export const INSERT_TRANSCRIPT = `INSERT INTO public.transcripts (${TRANSCRIPT_COLUMNS}) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`;

export const READ_TRANSCRIPT = `SELECT ${TRANSCRIPT_COLUMNS} FROM public.transcripts WHERE evidence_id = $1`;

/** The newest revision of one item: its number and its hash (the parent of the next one). */
export const READ_REVISION_HEAD = 'SELECT revision_no, sha256 FROM public.transcript_revisions WHERE evidence_id = $1 ORDER BY revision_no DESC LIMIT 1';

/** One signed revision, appended. No conflict clause: a taken number must fail (23505). */
export const INSERT_TRANSCRIPT_REVISION = `INSERT INTO public.transcript_revisions (${REVISION_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;

/**
 * The newest revision number of every item that has a revision, with what its sealed transcript row
 * says (integration pass D11: the heads a start of the Core publishes on the replicated items).
 */
export const READ_REVISION_HEADS =
  'SELECT r.evidence_id, max(r.revision_no) AS revision, t.json_sha256, t.labels_status FROM public.transcript_revisions r JOIN public.transcripts t ON t.evidence_id = r.evidence_id GROUP BY r.evidence_id, t.json_sha256, t.labels_status ORDER BY r.evidence_id';

export const READ_TRANSCRIPT_REVISIONS = `SELECT ${REVISION_COLUMNS} FROM public.transcript_revisions WHERE evidence_id = $1 ORDER BY revision_no`;
