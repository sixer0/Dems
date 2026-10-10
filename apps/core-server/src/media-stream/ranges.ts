/**
 * The `Range` header of the media route (blueprint row 90; RFC 9110 §14; check M8-RNG-1). PURE.
 *
 * ONE byte range per request. What the route answers:
 *
 *   no header                        WHOLE          200, the whole file
 *   `bytes=a-b`, `bytes=a-`,         PARTIAL        206, `content-range: bytes a-b/size`; an end past
 *   `bytes=-n`                                      the file is cut to its last byte
 *   a first byte at or past the      UNSATISFIABLE  416, `content-range: bytes * /size`
 *   end, `bytes=-0`, an empty file
 *   another unit, several ranges,    WHOLE          200: a header this server does not serve is
 *   a malformed value                               ignored, as RFC 9110 §14.2 allows - never guessed at
 *
 * `bytes=5-2` (the end before the start) is a malformed value, not an unsatisfiable one.
 */

/** The bytes a response carries: `[start, end)`. */
export type RangeDecision =
  | { readonly kind: 'WHOLE'; readonly start: 0; readonly end: number }
  | { readonly kind: 'PARTIAL'; readonly start: number; readonly end: number }
  | { readonly kind: 'UNSATISFIABLE' };

/** At most 15 digits: every value is an exact whole number. A longer one is a malformed value. */
const ONE_RANGE = /^bytes=(\d{0,15})-(\d{0,15})$/;

/** Decides a `Range` header value against a file of `size` bytes. */
export function decideRange(header: string | readonly string[] | undefined, size: number): RangeDecision {
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('the size of a file is a whole number of bytes');
  const whole: RangeDecision = { kind: 'WHOLE', start: 0, end: size };
  if (header === undefined) return whole;
  // A header that was sent twice is not one range.
  if (typeof header !== 'string') return whole;
  const found = ONE_RANGE.exec(header.trim());
  if (found === null) return whole;
  const first = found[1] ?? '';
  const last = found[2] ?? '';
  if (first === '' && last === '') return whole;

  if (first === '') {
    // A suffix: the last `n` bytes.
    const count = Number(last);
    if (count === 0 || size === 0) return { kind: 'UNSATISFIABLE' };
    return { kind: 'PARTIAL', start: Math.max(0, size - count), end: size };
  }
  const start = Number(first);
  if (last !== '' && Number(last) < start) return whole;
  if (start >= size) return { kind: 'UNSATISFIABLE' };
  const end = last === '' ? size : Math.min(size, Number(last) + 1);
  return { kind: 'PARTIAL', start, end };
}

/** `bytes 0-1023/4096` for a partial answer. */
export function contentRangeOf(range: { readonly start: number; readonly end: number }, size: number): string {
  return `bytes ${range.start}-${range.end - 1}/${size}`;
}

/** The value of `content-range` on a 416 (RFC 9110 §14.4). */
export function unsatisfiedRangeOf(size: number): string {
  return `bytes */${size}`;
}
