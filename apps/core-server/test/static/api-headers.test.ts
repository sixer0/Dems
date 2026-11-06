// Static guard: the two headers of spec API-7 are set in ONE place (checkpoint CP-B1 §7.3;
// decisions D78 DN-8, D87; fix round B2b item 3).
//
// `x-dems-epoch` and `x-dems-revision` on every 2xx answer of a POST are the engine unit's: one
// pair of hooks in `src/engine/api-headers.ts` sets them for every POST of a registry operation
// that reached its handler, from the outcome of the engine unit the request ran or from the
// engine as it is when the answer is sent. Before that hook every module wrote the two headers
// itself, in thirteen places and three forms. This test keeps the one place: no other production
// source names either header, by the contract's constant or by its text.
//
// What a module's HTTP tests assert is unchanged: each of them still expects both headers on a
// 2xx answer of its POST operations.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from './scan';

/** The one file that sets the two headers. */
const OWNER = 'src/engine/api-headers.ts';

// Built from fragments, so that this file does not find itself.
const CONSTANT = new RegExp(`\\b(?:EPOCH|REVISION)${'_HEADER'}_NAME\\b`, 'g');
const LITERAL = new RegExp(`['"\`]x-dems-(?:epoch|revision)['"\`]`, 'gi');

const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path)));

/** Where a production source names one of the two headers in code; comments are not code. */
function placesOf(files: readonly SourceFile[]): string[] {
  return [...occurrences(files, CONSTANT), ...occurrences(files, LITERAL)].sort();
}

describe('the scan itself', () => {
  it('finds a header set by its constant and by its text (positive control)', () => {
    const constant: SourceFile = { path: 'src/modules/x/index.ts', text: ['void reply.header(EPOCH', '_HEADER', '_NAME, app.engine.epoch);'].join('') };
    const literal: SourceFile = { path: 'src/modules/y/index.ts', text: ["void reply.header('x-dems-", "revision', outcome.revision);"].join('') };
    const comment: SourceFile = { path: 'src/modules/z/index.ts', text: ['// API-7: `x-dems-', 'epoch` is set by the engine unit.\nconst a = 1;'].join('') };
    expect(placesOf([constant, literal, ...codeOnly([comment])])).toEqual(['src/modules/x/index.ts:1', 'src/modules/y/index.ts:1']);
  });
});

describe('API-7: the two headers of the state position', () => {
  it('are named by one production source, the engine unit\'s hook, which sets each of them once', () => {
    const files = [...new Set(placesOf(production).map((place) => place.replace(/:\d+$/, '')))];
    expect(files).toEqual([OWNER]);
    const owner = production.find((file) => file.path === OWNER)?.text ?? '';
    expect(owner.match(/\breply\s*\.\s*header\s*\(/g)).toHaveLength(2);
  });

  it('no module sets a header of an answer at all: what an answer carries beside its body is the scaffold\'s and the engine unit\'s', () => {
    const modules = production.filter((file) => file.path.startsWith('src/modules/'));
    // The session cookie of the identity core is set through the cookie plugin's own call, not through `header(`.
    expect(occurrences(modules, /\breply\s*\.\s*headers?\s*\(/g)).toEqual([]);
  });
});
