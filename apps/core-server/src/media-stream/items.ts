/**
 * What the media-stream unit reads of an evidence item (blueprint row 90; database contract
 * `evidence_items`; SEC35-16). One statement on the pool of the runtime role, one bind parameter.
 *
 * It names six columns and nothing else of the item: the unit needs to know WHETHER the item has a
 * real sealed v2 package, WHERE that package is (the session), WHAT its manifest must hash to (the
 * anchor from outside the package) and WHO holds the case.
 *
 * THE CASE HOLDER is `investigator_id`. C3 §2.4 words the scope as "the owner of that case/session
 * (the session creator)"; the creator of a session (`active_session.started_by`) is not kept once
 * the session has ended - neither `session_history` nor `evidence_items` has the column, and this
 * row writes no migration. The investigator the session was recorded for is the stored fact that
 * names whose case it is, and it is what the test strategy asks (`M8-EV-SCOPE-1`: "sees only cases
 * they hold"). Recorded as a decision of this row.
 */

/** The item as the unit needs it. */
export interface MediaItem {
  readonly evidenceId: string;
  readonly sessionId: string;
  /** The operator who holds the case. */
  readonly investigatorId: string;
  /** `integrity_source = 'REAL'` and `manifest_version = 2`: a real sealed package. */
  readonly real: boolean;
  /** `evidence_items.manifest_hash`: the digest that was signed when the item was sealed. */
  readonly manifestSha256: string;
}

export const READ_MEDIA_ITEM =
  'SELECT id, session_id, investigator_id, integrity_source, manifest_version, manifest_hash FROM public.evidence_items WHERE id = $1';

/** What the read needs of its reader (the pool of the pool plugin satisfies it). */
export interface MediaItemReader {
  query(text: string, values: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The item of that ID, or null when no item has it. */
export async function readMediaItem(reader: MediaItemReader, evidenceId: string): Promise<MediaItem | null> {
  const { rows } = await reader.query(READ_MEDIA_ITEM, [evidenceId]);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    evidenceId: text(row['id']),
    sessionId: text(row['session_id']),
    investigatorId: text(row['investigator_id']),
    real: row['integrity_source'] === 'REAL' && Number(row['manifest_version']) === 2,
    manifestSha256: text(row['manifest_hash']),
  };
}

/**
 * R93-08 (fix pass F-M8): is the sign-in session a media answer was started in still open? One row
 * by its key, read while a long answer is in flight, so that a stream is cut when its session is
 * signed out, expires or is ended with its operator. It names the ID and `ended_at` and nothing
 * else of the session: never its token hash.
 */
export const READ_SESSION_OPEN = 'SELECT 1 AS open FROM public.auth_sessions WHERE id::text = $1 AND ended_at IS NULL';

/** True while the session of that ID is open. */
export async function readSessionOpen(reader: MediaItemReader, sessionId: string): Promise<boolean> {
  const { rows } = await reader.query(READ_SESSION_OPEN, [sessionId]);
  return rows.length > 0;
}
