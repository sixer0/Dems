// N-14 (fix round 1): a real run never overwrites the evidence of an earlier one.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRunDir, latestRunWith, writeEvidence } from '../../test/real/real-support';
import { scratchDir } from './support';

describe('N-14: evidence of a real run is written once', () => {
  it('every run gets a new directory; the same instant, process and kind twice is refused', () => {
    const root = scratchDir('runs');
    const first = createRunDir('cpu-local', root, new Date('2026-10-09T05:00:00.000Z'));
    const second = createRunDir('cpu-local', root, new Date('2026-10-09T05:00:00.001Z'));
    expect(first).not.toBe(second);
    expect(readdirSync(root)).toHaveLength(2);
    expect(() => createRunDir('cpu-local', root, new Date('2026-10-09T05:00:00.000Z'))).toThrowError(expect.objectContaining({ code: 'EEXIST' }));
  });

  it('a file that exists is never replaced', () => {
    const dir = createRunDir('shape', scratchDir('runs'));
    writeEvidence(dir, 'result.json', { run: 1 });
    expect(() => writeEvidence(dir, 'result.json', { run: 2 })).toThrowError(expect.objectContaining({ code: 'EEXIST' }));
    expect(JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'))).toEqual({ run: 1 });
  });

  it('the newest run that holds a file is found; earlier runs stay as they were', () => {
    const root = scratchDir('runs');
    const old = createRunDir('cpu-local', root, new Date('2026-10-09T05:00:00.000Z'));
    writeEvidence(old, 'cpu-local.result.json', { run: 'old' });
    const other = createRunDir('omlx-server', root, new Date('2026-10-09T06:00:00.000Z'));
    writeEvidence(other, 'omlx-server.result.json', { run: 'server' });
    const fresh = createRunDir('cpu-local', root, new Date('2026-10-09T07:00:00.000Z'));
    writeEvidence(fresh, 'cpu-local.result.json', { run: 'new' });
    expect(latestRunWith('cpu-local.result.json', root)).toBe(fresh);
    expect(latestRunWith('omlx-server.result.json', root)).toBe(other);
    expect(latestRunWith('absent.json', root)).toBeNull();
    expect(latestRunWith('x.json', join(root, 'no-such-root'))).toBeNull();
    expect(JSON.parse(readFileSync(join(old, 'cpu-local.result.json'), 'utf8'))).toEqual({ run: 'old' });
  });
});
