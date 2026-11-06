/**
 * The statements of the session STT snapshot (blueprint row 115, integration pass B; database
 * contract dbc-6 `session_stt_config`, migrations 0011 and 0012; note 60b section 5).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). Every table is named with its schema. The table is named here and not imported
 * from the typed schema: a unit outside `db/` does not reach into `db/schema` (import guard,
 * rule 2); the db test of this folder holds the column list to the real table by running the
 * statements as `dems_app`.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE (0012). SELECT and INSERT on `session_stt_config`; UPDATE,
 * DELETE and TRUNCATE are revoked (`42501`). The snapshot is WRITE-ONCE by privilege, not only by
 * this code: there is no UPDATE and no DELETE statement in this file, and the unit test of the
 * folder reads the file to hold that. The first row of a session is its snapshot for good.
 *
 * NO CREDENTIAL COLUMN. The table has none (`credential_kind` says how a credential is held and
 * nothing else), and `SttSessionSnapshot` has no member for a reference or a key.
 */
import { STT_BACKENDS, SttCredentialKind, type SttBackend } from '@dems/shared/api';
import type { QueryResultRow } from 'pg';
import type { SttSessionSnapshot } from './snapshot';

/** A connection that runs one parameterised statement: the runtime pool, or a unit of work. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

const COLUMNS = 'session_id, enabled, backend, endpoint, model, language, diarization, credential_kind, config_revision, taken_at';

/**
 * Stores the snapshot when the session has none. `DO NOTHING` on the key: the second of two puts
 * (even a racing one: it waits for the first to commit) leaves the first row alone. A CHECK the
 * row fails (an endpoint that is not loopback, a language other than `id`, …) is `23514` and
 * stores nothing.
 */
export const INSERT_SNAPSHOT = `INSERT INTO public.session_stt_config (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (session_id) DO NOTHING`;

/** What the session HOLDS: zero rows (none taken) or one. */
export const READ_SNAPSHOT = `SELECT ${COLUMNS} FROM public.session_stt_config WHERE session_id = $1`;

/** The row as `pg` answers it: the two bigint columns arrive as text. */
interface SnapshotRow extends QueryResultRow {
  session_id: string;
  enabled: boolean;
  backend: string;
  endpoint: string | null;
  model: string;
  language: string;
  diarization: boolean;
  credential_kind: string | null;
  config_revision: string | number;
  taken_at: string | number;
}

/** A stored row outside the contract the table's CHECKs state. The snapshot is then NOT used. */
export class SnapshotRowError extends Error {
  override readonly name = 'SnapshotRowError';
}

export function insertSnapshotValues(snapshot: SttSessionSnapshot): readonly unknown[] {
  return [
    snapshot.sessionId,
    snapshot.enabled,
    snapshot.backend,
    snapshot.endpoint,
    snapshot.model,
    snapshot.language,
    snapshot.diarization,
    snapshot.credentialKind,
    snapshot.revision,
    snapshot.takenAt,
  ];
}

function integerOf(value: string | number, what: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new SnapshotRowError(`the stored ${what} is not a safe integer`);
  return parsed;
}

export function snapshotOfRow(row: SnapshotRow): SttSessionSnapshot {
  if (!(STT_BACKENDS as readonly string[]).includes(row.backend)) throw new SnapshotRowError('the stored backend is not one of the two');
  const kinds: readonly string[] = Object.values(SttCredentialKind);
  if (row.credential_kind !== null && !kinds.includes(row.credential_kind)) throw new SnapshotRowError('the stored credential kind is not one of the two');
  if (typeof row.enabled !== 'boolean' || typeof row.diarization !== 'boolean') throw new SnapshotRowError('a stored flag is not a boolean');
  return Object.freeze({
    sessionId: row.session_id,
    enabled: row.enabled,
    backend: row.backend as SttBackend,
    endpoint: row.endpoint,
    model: row.model,
    language: row.language,
    diarization: row.diarization,
    credentialKind: row.credential_kind as SttSessionSnapshot['credentialKind'],
    revision: integerOf(row.config_revision, 'revision'),
    takenAt: integerOf(row.taken_at, 'instant'),
  });
}

export async function readSnapshot(db: Queryable, sessionId: string): Promise<SttSessionSnapshot | null> {
  const { rows } = await db.query<SnapshotRow>(READ_SNAPSHOT, [sessionId]);
  const row = rows[0];
  return row === undefined ? null : snapshotOfRow(row);
}

export async function insertSnapshot(db: Queryable, snapshot: SttSessionSnapshot): Promise<void> {
  await db.query(INSERT_SNAPSHOT, insertSnapshotValues(snapshot));
}
