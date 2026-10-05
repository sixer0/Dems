/**
 * Text cuts that never split a surrogate pair (SIM-GAP-1; implementation/22_contract_b.md F-1).
 *
 * The simulator bounds a few user texts by UTF-16 code units (a marker label, the timeline
 * line of a note, an export destination). `String.prototype.slice` cuts between any two code
 * units, so a character outside the Basic Multilingual Plane (two units: a high surrogate then
 * a low one) lying across the limit left a lone high surrogate in the state, in one case
 * inside a hashed audit row. Such text is ill-formed: it has no UTF-8 form, so a store that
 * keeps UTF-8 cannot hold the row as it was hashed.
 *
 * Pure and framework-free: no dependency, no platform API. It is used by the transitions
 * only and is not part of the `@dems/shared/sim` surface.
 */

const isHighSurrogate = (unit: number): boolean => unit >= 0xd800 && unit <= 0xdbff;
const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

/**
 * The longest prefix of `text` that holds at most `maxCodeUnits` UTF-16 code units and does not
 * end between the two halves of a surrogate pair.
 *
 * - A text that fits is returned unchanged.
 * - The limit counts **code units**, as `slice(0, maxCodeUnits)` does. For a text made only of
 *   BMP characters the result is exactly that slice, so nothing that was stored or hashed
 *   before this helper existed changes.
 * - When a pair lies across the limit the cut moves one unit back and the whole character is
 *   left out: the result is then one unit shorter than the limit.
 * - Text that is already ill-formed is **not repaired**. A lone surrogate inside the prefix
 *   stays where it is, and a lone low surrogate at the limit is cut exactly like any other
 *   unit. The helper only guarantees that it adds no lone surrogate of its own: well-formed
 *   in, well-formed out. (The API text rule refuses ill-formed input at the boundary.)
 * - A limit that is not a positive number (0, negative, NaN) gives `''`; a fraction is
 *   rounded down.
 */
export function cutText(text: string, maxCodeUnits: number): string {
  const limit = maxCodeUnits > 0 ? Math.floor(maxCodeUnits) : 0;
  if (text.length <= limit) return text;
  // `limit` is the index of the first unit left out. The cut splits a pair exactly when that
  // unit is a low surrogate and the unit before it is the high surrogate it belongs to.
  const splitsPair = limit > 0 && isLowSurrogate(text.charCodeAt(limit)) && isHighSurrogate(text.charCodeAt(limit - 1));
  return text.slice(0, splitsPair ? limit - 1 : limit);
}
