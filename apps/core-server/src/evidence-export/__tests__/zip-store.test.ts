// The archive writer against a reader it did not write: the system's `unzip` (blueprint row 91).
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { removeScratch, scratch } from '../../evidence-verify/__tests__/support';
import { createArchive, isArchiveEntryName } from '../zip-store';
import { UNZIP } from './support';

afterEach(removeScratch);

describe('the archive writer', () => {
  it('writes stored ZIP64 entries that unzip tests and extracts byte for byte; the same input gives the same bytes', async () => {
    const dir = scratch('zip');
    const big = randomBytes(300_000);
    const make = async (file: string) => {
      const archive = await createArchive(file);
      expect(await archive.add('session-manifest.json', async (write) => write(Buffer.from('{"a":1}')))).toBe(7);
      await archive.add('fragments/VIDEO-01.mp4', async (write) => {
        for (let at = 0; at < big.byteLength; at += 7_001) await write(big.subarray(at, at + 7_001));
      });
      await archive.add('empty.txt', async () => undefined);
      return archive.finish();
    };
    const summary = await make(join(dir, 'a.zip'));
    await make(join(dir, 'b.zip'));
    expect(summary.entries).toEqual([
      { name: 'session-manifest.json', bytes: 7 },
      { name: 'fragments/VIDEO-01.mp4', bytes: 300_000 },
      { name: 'empty.txt', bytes: 0 },
    ]);
    expect(readFileSync(join(dir, 'a.zip')).byteLength).toBe(summary.bytes);
    expect(readFileSync(join(dir, 'a.zip')).equals(readFileSync(join(dir, 'b.zip')))).toBe(true);

    expect(execFileSync(UNZIP, ['-t', join(dir, 'a.zip')], { encoding: 'utf8' })).toContain('No errors detected');
    execFileSync(UNZIP, ['-q', join(dir, 'a.zip'), '-d', join(dir, 'out')]);
    expect(readFileSync(join(dir, 'out', 'fragments', 'VIDEO-01.mp4')).equals(big)).toBe(true);
    expect(readFileSync(join(dir, 'out', 'session-manifest.json'), 'utf8')).toBe('{"a":1}');
  });

  it('NEGATIVE CONTROL: one altered byte of an entry makes unzip report an error', async () => {
    const dir = scratch('zip');
    const file = join(dir, 'a.zip');
    const archive = await createArchive(file);
    await archive.add('a.bin', async (write) => write(Buffer.alloc(5_000, 7)));
    await archive.finish();
    const bytes = readFileSync(file);
    bytes[2_000] = (bytes[2_000] ?? 0) ^ 0xff;
    writeFileSync(file, bytes);
    expect(() => execFileSync(UNZIP, ['-t', file], { stdio: 'pipe' })).toThrow();
  });

  it('refuses a name that is no plain relative path, a name twice, and an existing file', async () => {
    for (const name of ['../x', '/abs', 'a//b', 'a/./b', '', 'a b', 'a\\b']) expect(isArchiveEntryName(name), name).toBe(false);
    const dir = scratch('zip');
    const archive = await createArchive(join(dir, 'a.zip'));
    await archive.add('a', async () => undefined);
    await expect(archive.add('a', async () => undefined)).rejects.toThrow('ARCHIVE_ENTRY_TWICE');
    await expect(archive.add('../b', async () => undefined)).rejects.toThrow('ARCHIVE_ENTRY_NAME');
    await archive.abandon();
    await expect(createArchive(join(dir, 'a.zip'))).rejects.toMatchObject({ code: 'EEXIST' });
  });
});
