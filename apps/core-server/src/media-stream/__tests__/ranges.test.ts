// The `Range` header of the media route (blueprint row 90; RFC 9110 §14; check M8-RNG-1, parsing). Pure.
import { describe, expect, it } from 'vitest';
import { contentRangeOf, decideRange, unsatisfiedRangeOf } from '../ranges';

const SIZE = 3_646;
const partial = (start: number, end: number) => ({ kind: 'PARTIAL', start, end });
const WHOLE = { kind: 'WHOLE', start: 0, end: SIZE };
const UNSATISFIABLE = { kind: 'UNSATISFIABLE' };

describe('M8-RNG-1: one byte range', () => {
  it.each([
    ['bytes=0-0', partial(0, 1)],
    ['bytes=0-99', partial(0, 100)],
    ['bytes=100-899', partial(100, 900)],
    ['bytes=1000-', partial(1000, SIZE)],
    ['bytes=0-', partial(0, SIZE)],
    [`bytes=${SIZE - 1}-${SIZE - 1}`, partial(SIZE - 1, SIZE)],
    [`bytes=${SIZE - 1}-`, partial(SIZE - 1, SIZE)],
    ['bytes=-17', partial(SIZE - 17, SIZE)],
    ['bytes=-1', partial(SIZE - 1, SIZE)],
    // An end past the file is cut to its last byte; a suffix longer than the file is the whole file as a range.
    ['bytes=3000-999999', partial(3000, SIZE)],
    ['bytes=-999999', partial(0, SIZE)],
    [' bytes=5-9 ', partial(5, 10)],
  ])('%s', (header, expected) => {
    expect(decideRange(header, SIZE)).toEqual(expected);
  });

  it.each([[`bytes=${SIZE}-`], [`bytes=${SIZE}-${SIZE + 10}`], ['bytes=999999-'], ['bytes=-0']])('%s is unsatisfiable (416)', (header) => {
    expect(decideRange(header, SIZE)).toEqual(UNSATISFIABLE);
  });

  it('a header this server does not serve is ignored, never guessed at: the whole file', () => {
    for (const header of ['bytes=0-1,5-9', 'items=0-1', 'bytes=5-2', 'bytes=-', 'bytes=', 'bytes=a-b', 'bytes=1e3-', 'bytes=0x10-', 'bytes=-1-2', 'bytes=1-2-3', `bytes=${'9'.repeat(16)}-`, '']) {
      expect(decideRange(header, SIZE), header).toEqual(WHOLE);
    }
    expect(decideRange(undefined, SIZE)).toEqual(WHOLE);
    expect(decideRange(['bytes=0-1', 'bytes=2-3'], SIZE)).toEqual(WHOLE);
  });

  it('an empty file has no satisfiable range, and no header is its whole (empty) content', () => {
    expect(decideRange('bytes=0-', 0)).toEqual(UNSATISFIABLE);
    expect(decideRange('bytes=-5', 0)).toEqual(UNSATISFIABLE);
    expect(decideRange(undefined, 0)).toEqual({ kind: 'WHOLE', start: 0, end: 0 });
    expect(() => decideRange('bytes=0-', -1)).toThrow();
  });

  it('the header values of the answers', () => {
    expect(contentRangeOf({ start: 100, end: 900 }, SIZE)).toBe('bytes 100-899/3646');
    expect(contentRangeOf({ start: SIZE - 1, end: SIZE }, SIZE)).toBe('bytes 3645-3645/3646');
    expect(unsatisfiedRangeOf(SIZE)).toBe('bytes */3646');
  });
});
