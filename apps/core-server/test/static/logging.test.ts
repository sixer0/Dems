// Static guard: logging (spec SR-48, SR-49). The server's log is safe because every line goes
// through the logger of `plugins/logger` and because nothing but that folder and the error
// envelope reads the raw request URL. Two things would bypass it:
//   - a console call (no serializer, no redaction; `console.log(config)` is the classic one);
//   - reading `request.url`, `request.originalUrl` or `request.raw.url` to log or compare it.
// `src/db/` holds command-line programs, which print their result; the rule is for the server
// runtime.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, under, type SourceFile } from './scan';

const CONSOLE_CALL = new RegExp(`\\b${['con', 'sole'].join('')}\\s*\\.\\s*[a-z]+\\s*\\(`, 'g');
const RAW_URL = /\b(?:request|req|raw)\s*\.\s*(?:url|originalUrl)\b/g;

/** The two folders that may read the raw URL: to cut the query off, and to tell 405 from 404. */
const RAW_URL_PLACES = ['src/plugins/logger/', 'src/plugins/error-envelope/'];

// Comments are left out: a sentence about the console or the URL is not a use of it.
const runtime = codeOnly(
  readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && !file.path.startsWith('src/db/')),
);

describe('SR-48, SR-49: one way into the log', () => {
  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/a.ts', text: `${['con', 'sole'].join('')}.log(config);\n${['con', 'sole'].join('')} . error (e);` },
      { path: 'src/b.ts', text: 'log.info(request.url);\nconst u = request.raw.url;\nreq.originalUrl;' },
    ];
    expect(occurrences(planted, CONSOLE_CALL)).toEqual(['src/a.ts:1', 'src/a.ts:2']);
    expect(occurrences(planted, RAW_URL)).toEqual(['src/b.ts:1', 'src/b.ts:2', 'src/b.ts:3']);
    // The route pattern is what may be read and logged.
    expect(occurrences([{ path: 'x.ts', text: 'request.routeOptions.url' }], RAW_URL)).toEqual([]);
  });

  it('the server runtime makes no console call', () => {
    expect(occurrences(runtime, CONSOLE_CALL)).toEqual([]);
  });

  it('only the logger and the error envelope read the raw request URL', () => {
    expect(occurrences(runtime, RAW_URL, (path) => !under(path, RAW_URL_PLACES))).toEqual([]);
  });
});
