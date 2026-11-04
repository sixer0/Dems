/**
 * The statements of the `recording_fragments` store (blueprint row 59 / M3-W3; database contract
 * dbc-3 §B.6 and its privileges, migration `0005_capture_privileges.sql`; capture spec §A.5, §C.3).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). Every table is named with its schema.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE (0005): SELECT and INSERT. No UPDATE and no DELETE: a fragment
 * row is written once and never changed (the table is append-only for `dems_app`; 42501 otherwise).
 *
 * THE ZERO-GAP RULE IS PART OF THE INSERT. The table has no CHECK that can see the row before (a
 * CHECK sees one row), so the rule the contract leaves "in mapping" (dbc-3 §B.6: `byte_offset` is
 * seq-derived; the chain anchor of the first row is the empty digest) is held by the statement
 * itself, atomically, in the database:
 *
 *   - fragment 1 of a camera file is taken when its chain value is
 *     SHA-256(SHA-256("") as 32 raw bytes || sha256 as 32 raw bytes);
 *   - fragment n > 1 is taken ONLY IF fragment n - 1 of the same session and track is stored,
 *     ends at the byte this one starts at, and chains into it:
 *     chain_hash(n) = SHA-256(chain_hash(n - 1) raw || sha256(n) raw).
 *
 * A row that fails the rule inserts nothing (no error: the caller tells "already stored" from "a
 * gap" by reading the row at that key). A row whose key exists is left exactly as it is
 * (`ON CONFLICT DO NOTHING`): a replay never rewrites a stored fragment. So one row per fragment
 * per camera, in order, without a gap, whatever is replayed and however often.
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
 * The camera tracks (`recording_fragments_track_check`, dbc-3 §B.6). Written here and not
 * imported from the typed schema: a module does not reach into `db/schema` (import guard, rule 5).
 * The unit test of this folder holds the list to the schema's value set.
 *
 * D60 (2026-11-04): the Core records FOUR video tracks at once - the check of migration 0039 names
 * VIDEO-01 to VIDEO-04; fragments of older two-track sessions keep their rows (a widening, not a rewrite).
 */
export const VIDEO_TRACK_IDS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const;
export type VideoTrackId = (typeof VIDEO_TRACK_IDS)[number];

/** `chain_0`: SHA-256 of nothing (spec §C.3; S1 §3.1). The fifth test of this folder holds it to the protocol's constant. */
export const CHAIN_GENESIS_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const COLUMNS = 'session_id, track_id, seq, byte_offset, byte_length, media_start_ms, media_duration_ms, sha256, chain_hash, durable_at';

/**
 * One fragment row, under the zero-gap rule. Parameters: the ten columns in order, then the
 * genesis digest. Returns the row's `seq` when it was inserted and no row otherwise.
 */
export const INSERT_RECORDING_FRAGMENT = `INSERT INTO public.recording_fragments (${COLUMNS})
SELECT $1::text, $2::text, $3::integer, $4::bigint, $5::bigint, $6::bigint, $7::bigint, $8::text, $9::text, $10::bigint
WHERE ($3::integer = 1 AND $9::text = encode(sha256(decode($11::text, 'hex') || decode($8::text, 'hex')), 'hex'))
   OR EXISTS (
        SELECT 1 FROM public.recording_fragments before
        WHERE before.session_id = $1::text AND before.track_id = $2::text AND before.seq = $3::integer - 1
          AND before.byte_offset + before.byte_length = $4::bigint
          AND $9::text = encode(sha256(decode(before.chain_hash, 'hex') || decode($8::text, 'hex')), 'hex'))
ON CONFLICT (session_id, track_id, seq) DO NOTHING
RETURNING seq`;

/** One row by its key. */
export const READ_RECORDING_FRAGMENT = `SELECT ${COLUMNS} FROM public.recording_fragments WHERE session_id = $1 AND track_id = $2 AND seq = $3`;

/** Every row of one camera file of one session, in fragment order (the primary key covers the scan). */
export const READ_RECORDING_FRAGMENTS = `SELECT ${COLUMNS} FROM public.recording_fragments WHERE session_id = $1 AND track_id = $2 ORDER BY seq`;

/** The last stored fragment of one camera file of one session: where the chain stands. */
export const READ_RECORDING_FRAGMENT_HEAD = `SELECT ${COLUMNS} FROM public.recording_fragments WHERE session_id = $1 AND track_id = $2 ORDER BY seq DESC LIMIT 1`;
