/**
 * The cursor of the evidence list (plan row W35; spec §7.1 API-9; database contract §4.17).
 *
 * The list is ordered "newest recording first": `recorded_at DESC, id DESC`, the order of the
 * index `evidence_items_recorded_at_idx`. A cursor is the position of the last item of a page
 * in that order: its recording instant and its ID, joined by a hyphen, for example
 * `1790823600000-EV-20260930-0004`. The next page holds the items that come strictly after it
 * (a keyset), so a page never repeats an item and never skips one, however many items are
 * sealed while a client walks the list: a new item is newer than every position and lands
 * before the first page.
 *
 * To a client the value is opaque. It fits the contract's `LIST_CURSOR_PATTERN` (letters, digits
 * and hyphens, no underscore, at most 128), so it can never be mistaken for a bearer value in a
 * URL. It holds nothing the page did not already give the client, and no server state: a cursor
 * stays valid for as long as the item it names is where it was, which is for ever (an evidence
 * item is never deleted and its recording instant is a sealed column).
 *
 * Pure: no database, no clock.
 */

/** A position in the order of the list. */
export interface EvidenceCursor {
  /** `recorded_at` of the item: epoch milliseconds. */
  readonly recordedAt: number;
  /** The evidence ID, `EV-{YYYYMMDD}-NNNN`. */
  readonly id: string;
}

/** A non-negative integer of at most 16 digits without a leading zero, a hyphen, an evidence ID. */
const CURSOR_FORM = /^(0|[1-9]\d{0,15})-(EV-\d{8}-\d{4})$/;

export function encodeEvidenceCursor(position: EvidenceCursor): string {
  return `${position.recordedAt}-${position.id}`;
}

/** The position a cursor names, or null for a value this server never gave out. */
export function decodeEvidenceCursor(cursor: string): EvidenceCursor | null {
  const match = CURSOR_FORM.exec(cursor);
  const instant = match?.[1];
  const id = match?.[2];
  if (instant === undefined || id === undefined) return null;
  const recordedAt = Number(instant);
  return Number.isSafeInteger(recordedAt) ? { recordedAt, id } : null;
}
