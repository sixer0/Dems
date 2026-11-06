/**
 * The number of a camera search ID, unique across restarts of the Core within one database (fix
 * wave I, driver A2; re-gate 70, finding G70b-07).
 *
 * A search ID is `DSC-` and a counter (`CAPTURE_SEARCH_ID_PATTERN`). The counter lived in the
 * memory of the process, so it began at 1 again after every start and the audit chain of one
 * database held `DSC-000001` once per start. The chain itself is the durable record of every ID
 * that was given: the FIRST search of a process reads the highest number its
 * `CAPTURE_DISCOVERY_SEARCHED` rows hold and goes on from there. One read per process, no table,
 * no column, no migration.
 *
 * ONLY THE CAMERA SEARCH'S OWN IDS ARE READ: six to nine digits. The re-read of the microphone
 * inputs (operation 97) writes the same audit type with an ID of thirteen digits made from the
 * clock (`rescanSearchId`); it is no counter and is left out by the pattern.
 *
 * What the read cannot see: a search whose window never closed (the process ended first) wrote no
 * row, so its number is given again - to a search that then is the only one in the chain with it.
 */

/** The highest camera-search number in the stored audit rows; NULL when there is none. */
export const READ_LAST_SEARCH_NUMBER =
  "SELECT max(substring(details->>'searchId' from 5)::bigint) AS last FROM public.audit_log WHERE type = 'CAPTURE_DISCOVERY_SEARCHED' AND details->>'searchId' ~ '^DSC-[0-9]{6,9}$'";

export interface SearchNumberReader {
  query(text: string): Promise<{ rows: Array<{ last: unknown }> }>;
}

/** The number the next search goes on from: 0 for a chain without a camera search. A value that is no count reads as 0. */
export async function readLastSearchNumber(reader: SearchNumberReader): Promise<number> {
  const { rows } = await reader.query(READ_LAST_SEARCH_NUMBER);
  const last = Number(rows[0]?.last ?? 0);
  return Number.isSafeInteger(last) && last > 0 ? last : 0;
}

/** `DSC-NNNNNN`: six digits at least. */
export const searchIdOf = (number: number): string => `DSC-${String(number).padStart(6, '0')}`;
