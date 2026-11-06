/**
 * The cursors of the two lists of the security-audit module (plan row W39; spec §7.1 API-9;
 * database contract §4.12, §4.14).
 *
 * Both lists are ordered by `seq`, the primary key of their table: 1, 2, 3, ... in the order the
 * rows were appended. A cursor is the position of the last row of a page: the next page holds
 * the rows strictly beyond it in the order asked for (a keyset). A row that is appended while a
 * client walks a list has a larger `seq` than every row before it, so a walk never repeats a
 * row and never skips one.
 *
 * WHAT A CURSOR NAMES. A position alone ("after sequence 150") would be valid in ANY chain. A
 * demo reset or a scenario load discards the chain and starts a new one in a new database; a
 * client that went on with its old cursor would be given rows of the new chain as the
 * continuation of the pages it holds of the old one. So a cursor names the ROW it stands on:
 *
 *   audit    `AUD-000150-9f86d081884c7d65`   the row's ID, and the first 16 digits of its hash
 *   events   `LOG-000150-1790823600000`      the event's ID, and its instant
 *
 * The read looks that row up before it pages (`reads.ts`): a cursor whose row is not in the
 * table as named is "a cursor that is not one" of this list, and the contract's answer for it is
 * 422 `INVALID_INPUT`. The client starts its walk again; the realtime channel has told it of the
 * new epoch in any case.
 *
 * WHAT A CURSOR CANNOT DO. It is parsed into one whole number and one short text of a fixed
 * alphabet, and both reach the statement as bind parameters. It names no table, no column and
 * no filter: the table is the route's, the access rule is stage 6's, and neither reads the
 * cursor. A forged cursor is either refused, or it is the position of a row its author could
 * read anyway.
 *
 * Both forms fit the contract's `LIST_CURSOR_PATTERN` (letters, digits and hyphens, no
 * underscore, at most 128), so a cursor can never be mistaken for a bearer value in a URL.
 *
 * Pure: no database, no clock.
 */
import { auditId, eventId } from '@dems/shared/sim';

/** How many leading digits of a row's hash a cursor carries. */
export const AUDIT_CURSOR_MARK_LENGTH = 16;

/** The position of one audit row. */
export interface AuditCursor {
  /** `seq` of the row: 1 or more. */
  readonly seq: number;
  /** The first 16 hexadecimal digits of the row's `hash`. */
  readonly mark: string;
}

/** The position of one event. */
export interface EventCursor {
  /** `seq` of the event: 1 or more. */
  readonly seq: number;
  /** `at` of the event: epoch milliseconds. */
  readonly at: number;
}

const AUDIT_FORM = /^(AUD-\d{6,15})-([0-9a-f]{16})$/;
const EVENT_FORM = /^(LOG-\d{6,15})-(0|[1-9]\d{0,15})$/;

/**
 * The sequence an ID names, when the ID is exactly the one the shared code gives that sequence
 * (one text per row: no extra leading zero). At most 15 digits, so the number is exact.
 */
function sequenceOf(id: string, idOf: (seq: number) => string): number | null {
  const seq = Number(id.slice(4));
  return seq >= 1 && idOf(seq) === id ? seq : null;
}

export function encodeAuditCursor(row: { readonly seq: number; readonly hash: string }): string {
  return `${auditId(row.seq)}-${row.hash.slice(0, AUDIT_CURSOR_MARK_LENGTH)}`;
}

/** The position an audit cursor names, or null for a value this server never gave out. */
export function decodeAuditCursor(cursor: string): AuditCursor | null {
  const match = AUDIT_FORM.exec(cursor);
  const id = match?.[1];
  const mark = match?.[2];
  if (id === undefined || mark === undefined) return null;
  const seq = sequenceOf(id, auditId);
  return seq === null ? null : { seq, mark };
}

export function encodeEventCursor(event: { readonly seq: number; readonly at: number }): string {
  return `${eventId(event.seq)}-${event.at}`;
}

/** The position an event cursor names, or null for a value this server never gave out. */
export function decodeEventCursor(cursor: string): EventCursor | null {
  const match = EVENT_FORM.exec(cursor);
  const id = match?.[1];
  const instant = match?.[2];
  if (id === undefined || instant === undefined) return null;
  const seq = sequenceOf(id, eventId);
  const at = Number(instant);
  return seq === null || !Number.isSafeInteger(at) ? null : { seq, at };
}
