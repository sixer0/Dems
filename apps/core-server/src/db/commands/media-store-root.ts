/**
 * WHERE THE CORE KEEPS ITS MEDIA, AS THE DATABASE STORES IT (table T-43 `core_media_store`;
 * database contract erratum PE-0013-01, migration 0013; controller ruling D166 on finding D11-9).
 *
 * WHY. The reset must refuse while a real sealed package exists, and it looks for packages below
 * the media store root. The SERVER knows that root: its configuration (`config.mediaStoreDir`).
 * The command line (`db:reset`) knows it only when its shell carries the server's
 * `DEMS_MEDIA_DIR`; without it the command used to judge the default folder below the data
 * directory, where an installation that keeps its media elsewhere holds nothing - a package
 * without a row would have been missed.
 *
 * WHAT. One row, kept across a reset:
 *   the Core STATES its root at every start, as the runtime role (`recordMediaStoreRoot`, called by
 *   the boot step of `plugins/db`), with one statement that inserts the row, or replaces it WHEN
 *   THE ROOT IS ANOTHER ONE. A start with the root the row already holds writes nothing: a restart
 *   changes no stored row but the ones a start is known to write (acceptance check AC-B-04);
 *   the reset READS it as the owner inside its one read-only pass (`readMediaStoreRoot`), and the
 *   command line uses it when the variable is not set.
 *
 * A PATH, NOTHING ELSE. The value is an absolute path (the table's CHECK holds that too): no
 * address, no user information, nothing secret. It may be printed and logged.
 *
 * This file opens no connection and reads no file: the caller hands it something that can run a
 * statement. It reads no clock either - the instant is the caller's.
 */
import { isAbsolute, resolve } from 'node:path';

/** The table, for a message. */
export const MEDIA_STORE_TABLE = 'core_media_store';
/** The longest path the table admits (`core_media_store_root_check`). */
export const MEDIA_STORE_ROOT_MAX_LENGTH = 1024;

/**
 * `$1` the absolute root, `$2` the instant (epoch ms). Inserts the one row, or replaces its two
 * values when the stored root differs; the same root again changes nothing (0 rows).
 */
export const RECORD_MEDIA_STORE_ROOT =
  'INSERT INTO public.core_media_store AS stored (singleton, media_root, recorded_at) VALUES (true, $1::text, $2::bigint) ' +
  'ON CONFLICT (singleton) DO UPDATE SET media_root = EXCLUDED.media_root, recorded_at = EXCLUDED.recorded_at ' +
  'WHERE stored.media_root IS DISTINCT FROM EXCLUDED.media_root';
/** The one row, or none. `recorded_at` as text: a bigint keeps every digit. */
export const READ_MEDIA_STORE_ROOT = 'SELECT media_root, recorded_at::text AS recorded_at FROM public.core_media_store WHERE singleton';

/** What can run one statement: a pool, a client, or a stand-in of a test. */
export interface MediaStoreQueryable {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

/** The stored root and when the Core wrote it. */
export interface StoredMediaStoreRoot {
  readonly root: string;
  /** Epoch milliseconds of the Core start that FIRST stated this root (a later start with the same root leaves the row). */
  readonly recordedAt: number;
}

export type MediaStoreRootErrorCode = 'MEDIA_STORE_ROOT_NOT_STORABLE';

/** A root this file refuses to write. The message names the rule, never more than the path's length. */
export class MediaStoreRootError extends Error {
  readonly code: MediaStoreRootErrorCode = 'MEDIA_STORE_ROOT_NOT_STORABLE';
  constructor(message: string) {
    super(message);
    this.name = 'MediaStoreRootError';
  }
}

/**
 * The root in the form the table holds: absolute and normalised (`resolve`: no `.`/`..` segment,
 * no doubled or trailing separator). A relative root is resolved against the process directory -
 * that is the directory the Core itself would write to. Refused, never repaired: an empty value, a
 * value longer than the table admits, one with a control character, one that holds `://`.
 */
export function storableMediaStoreRoot(configured: string): string {
  if (typeof configured !== 'string' || configured === '') throw new MediaStoreRootError('the media store root is empty.');
  const root = isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured);
  if (root.length > MEDIA_STORE_ROOT_MAX_LENGTH) throw new MediaStoreRootError(`the media store root is ${root.length} characters long; at most ${MEDIA_STORE_ROOT_MAX_LENGTH} are stored.`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(root)) throw new MediaStoreRootError('the media store root holds a control character.');
  if (root.includes('://')) throw new MediaStoreRootError('the media store root is not a path.');
  return root;
}

/**
 * States the root of this Core and returns what the table holds afterwards: this root, with the
 * instant it was first stated. Rejects with the driver's error when a statement fails, and when
 * the table does not hold this root after the write.
 */
export async function recordMediaStoreRoot(queryable: MediaStoreQueryable, configured: string, at: number): Promise<StoredMediaStoreRoot> {
  const root = storableMediaStoreRoot(configured);
  await queryable.query(RECORD_MEDIA_STORE_ROOT, [root, at]);
  const stored = await readMediaStoreRoot(queryable);
  if (stored === null || stored.root !== root) throw new MediaStoreRootError('the media store root is not in the table after it was written.');
  return stored;
}

/** The stored root, or null when no Core has started on this database since migration 0013. A row that is not one is null as well. */
export async function readMediaStoreRoot(queryable: MediaStoreQueryable): Promise<StoredMediaStoreRoot | null> {
  const row = (await queryable.query(READ_MEDIA_STORE_ROOT)).rows[0] as { media_root?: unknown; recorded_at?: unknown } | undefined;
  if (row === undefined || typeof row.media_root !== 'string' || !isAbsolute(row.media_root)) return null;
  const recordedAt = Number(row.recorded_at);
  return { root: row.media_root, recordedAt: Number.isSafeInteger(recordedAt) ? recordedAt : 0 };
}
