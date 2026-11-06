/**
 * What the mapping refuses (plan row W20; database contract MR-9, DA-01).
 *
 * The mapping is lossless or it throws. Three kinds of value cannot be stored exactly, and each
 * would otherwise be changed silently on the way into PostgreSQL:
 *
 *   - a number that is not a safe integer, in an integer column (`bigint` is read back as a
 *     JavaScript number, exact only up to 2^53 - 1): MR-9;
 *   - a number that is not finite, inside a JSON column (JSON writes it as `null`);
 *   - a text with U+0000 (PostgreSQL has no such character) or with a lone surrogate (the driver
 *     sends UTF-8, which replaces it by U+FFFD). For an audit row that would be worse than a
 *     changed character: the stored row would no longer hash to its own `hash`, and an audit
 *     row can never be corrected.
 *
 * A refusal is a `MappingError`. Its message names the place (table and column, or the path
 * inside a JSON value) and the kind of value; it never holds the value itself.
 */

export type MappingErrorCode =
  | 'NOT_SAFE_INTEGER'
  | 'NOT_FINITE'
  | 'TEXT_NOT_STORABLE'
  | 'ROW_SHAPE'
  | 'RING_INCOMPLETE'
  | 'IMMUTABLE_CHANGED'
  | 'NOT_WRITABLE'
  | 'EXPORT_NOT_STORABLE';

export class MappingError extends Error {
  readonly code: MappingErrorCode;
  /** `table.column`, or a path into a JSON value. */
  readonly place: string;

  constructor(code: MappingErrorCode, place: string, detail: string) {
    super(`${code} at ${place}: ${detail}`);
    this.name = 'MappingError';
    this.code = code;
    this.place = place;
  }
}

/** MR-9: the value of an integer column. Returns it, or throws. */
export function safeInteger(value: number, place: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new MappingError('NOT_SAFE_INTEGER', place, 'the value is not a safe integer (MR-9).');
  }
  return value;
}

/** MR-9 for a nullable integer column. `undefined` (an absent optional member) is stored as NULL. */
export function safeIntegerOrNull(value: number | null | undefined, place: string): number | null {
  return value === null || value === undefined ? null : safeInteger(value, place);
}

// A lone surrogate (a high one not followed by a low one, or a low one not preceded by a high one).
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** True when PostgreSQL stores the text exactly: no U+0000 and well-formed UTF-16. */
export function isStorableText(text: string): boolean {
  return !text.includes('\u0000') && !LONE_SURROGATE.test(text);
}

/** The value of a text column. Returns it unchanged, or throws. Nothing is sanitised. */
export function storableText(text: string, place: string): string {
  if (!isStorableText(text)) {
    throw new MappingError('TEXT_NOT_STORABLE', place, 'the text holds U+0000 or a lone surrogate and cannot be stored exactly.');
  }
  return text;
}

export function storableTextOrNull(text: string | null | undefined, place: string): string | null {
  return text === null || text === undefined ? null : storableText(text, place);
}

/**
 * Walks a value that goes into a JSON column and throws at the first string that cannot be
 * stored exactly and at the first number that is not finite. Returns the SAME reference: the
 * mapping never copies a slice, so a caller can compare references to see what changed.
 */
export function storableJson<T>(value: T, place: string): T {
  walk(value, place);
  return value;
}

function walk(value: unknown, place: string): void {
  if (typeof value === 'string') {
    if (!isStorableText(value)) {
      throw new MappingError('TEXT_NOT_STORABLE', place, 'the text holds U+0000 or a lone surrogate and cannot be stored exactly.');
    }
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new MappingError('NOT_FINITE', place, 'the number is not finite and has no JSON form.');
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) walk(value[index], `${place}[${index}]`);
    return;
  }
  for (const [key, member] of Object.entries(value)) {
    if (!isStorableText(key)) throw new MappingError('TEXT_NOT_STORABLE', place, 'a member name cannot be stored exactly.');
    walk(member, `${place}.${key}`);
  }
}
