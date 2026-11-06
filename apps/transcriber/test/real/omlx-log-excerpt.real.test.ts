// The evidence excerpt of the oMLX server log of a real run (fix round 1, N-4). The excerpt step
// removes every timestamp and every duration or rate the server prints (D230) and refuses to write
// a line in which one is left. The path of the server log is given by the person who runs this, in
// the variable DEMS_OMLX_SERVE_LOG: this workspace names the server's files in no test.
//
// Run:  DEMS_OMLX_SERVE_LOG=<path of the server log> npm run test:real:omlx-log-excerpt -w @dems/transcriber
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { excerptServerLog, holdsTimingFigure } from './log-excerpt';
import { createRunDir, writeEvidence } from './real-support';

describe('the server-log excerpt of a real oMLX run', () => {
  it('is written without any timing figure, and shows the device the server engine runs on', () => {
    const path = process.env['DEMS_OMLX_SERVE_LOG'];
    expect(path, 'set DEMS_OMLX_SERVE_LOG to the path of the server log').toBeTruthy();
    const excerpt = excerptServerLog(readFileSync(String(path), 'utf8'));
    expect(excerpt.length).toBeGreaterThan(0);
    expect(excerpt.some(holdsTimingFigure)).toBe(false);
    expect(excerpt.join('\n')).not.toMatch(/Bearer [A-Za-z0-9]/);
    expect(excerpt.some((line) => line.includes('Device('))).toBe(true);
    writeEvidence(createRunDir('omlx-log-excerpt'), 'omlx-serve.excerpt.log', `${excerpt.join('\n')}\n`);
  });
});
