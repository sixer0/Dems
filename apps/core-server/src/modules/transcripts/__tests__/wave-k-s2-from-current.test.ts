/**
 * Fix wave K, driver S2 - G81b-01 (ruling D221 (2)): the rule of "current text" of operation 85.
 * The route test (`transcript-routes.db.test.ts`, describe "FIX WAVE K, G81b-01") proves that a
 * refusal signs and writes nothing; this file pins the rule itself, incl. the stored data the
 * re-gate planted (a revision whose own `from` is false is NOT re-judged: only its `to` counts).
 */
import { describe, expect, it } from 'vitest';
import { staleFromOf } from '../routes.js';

const SEALED = ['Selamat pagi.', 'Terima kasih, Pak.', 'Berapa lama?'];
const record = (changes: unknown): { body: unknown } => ({ body: { changes } });

describe('staleFromOf: the first change that does not start from the current text of its segment', () => {
  it('no stored revision: the current text is the sealed text', () => {
    expect(staleFromOf(SEALED, [], [{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'x' }])).toBeNull();
    expect(staleFromOf(SEALED, [], [{ segmentIndex: 1, from: 'terima kasih, pak.', to: 'x' }])).toBe(1);
    expect(staleFromOf(SEALED, [], [{ segmentIndex: 1, from: '', to: 'x' }])).toBe(1);
  });

  it('the newest stored revision that changed the segment gives its text; other segments keep the sealed text', () => {
    const stored = [record([{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'one' }]), record([{ segmentIndex: 0, from: 'Selamat pagi.', to: 'zero' }]), record([{ segmentIndex: 1, from: 'one', to: 'two' }])];
    expect(staleFromOf(SEALED, stored, [{ segmentIndex: 1, from: 'two', to: 'three' }, { segmentIndex: 0, from: 'zero', to: 'z' }, { segmentIndex: 2, from: 'Berapa lama?', to: 'q' }])).toBeNull();
    expect(staleFromOf(SEALED, stored, [{ segmentIndex: 1, from: 'one', to: 'three' }])).toBe(1);
    expect(staleFromOf(SEALED, stored, [{ segmentIndex: 1, from: 'Terima kasih, Pak.', to: 'three' }])).toBe(1);
    expect(staleFromOf(SEALED, stored, [{ segmentIndex: 2, from: 'Berapa lama?', to: 'q' }, { segmentIndex: 0, from: 'Selamat pagi.', to: 'z' }])).toBe(0);
  });

  it('STORED DATA IS NOT RE-JUDGED (the planted revision 4 of the re-gate): a stored `from` that was false does not refuse the next revision; its `to` is the current text', () => {
    const planted = [record([{ segmentIndex: 2, from: 'not the sealed text', to: 'Berapa lama?!' }])];
    expect(staleFromOf(SEALED, planted, [{ segmentIndex: 2, from: 'Berapa lama?!', to: 'Berapa lama?' }])).toBeNull();
    expect(staleFromOf(SEALED, planted, [{ segmentIndex: 2, from: 'not the sealed text', to: 'x' }])).toBe(2);
  });

  it('a stored record without a body states no change; two changes of one request apply in order; a segment outside the transcript is never current', () => {
    expect(staleFromOf(SEALED, [{}, { body: null }, { body: { changes: 'x' } }], [{ segmentIndex: 0, from: 'Selamat pagi.', to: 'a' }])).toBeNull();
    expect(staleFromOf(SEALED, [], [{ segmentIndex: 0, from: 'Selamat pagi.', to: 'a' }, { segmentIndex: 0, from: 'a', to: 'b' }])).toBeNull();
    expect(staleFromOf(SEALED, [], [{ segmentIndex: 0, from: 'Selamat pagi.', to: 'a' }, { segmentIndex: 0, from: 'Selamat pagi.', to: 'b' }])).toBe(0);
    expect(staleFromOf(SEALED, [], [{ segmentIndex: 9, from: '', to: 'b' }])).toBe(9);
  });
});
