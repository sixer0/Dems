// Post-review fix pass FXR-S (decision D241 DN-W91-1: HBX-4, the persistent error log, is
// accepted as hand-built WITH a rotation test; review finding W91-8). The rotation keeps one
// generation, a path without `.log` still rotates, the mode stays 0600 across a rotation, and an
// append in the steady state makes no folder or mode call. Files live in a temporary folder.
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_LOG_ROTATE_BYTES, createErrorLog, rotatedErrorLogFile, type ErrorLogEntry } from '../error-log';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, mkdirSync: vi.fn(actual.mkdirSync), chmodSync: vi.fn(actual.chmodSync) };
});

const ENTRY: ErrorLogEntry = { level: 'error', source: 'test.rotation', message: 'a fixed text' };
const lines = (file: string): unknown[] =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as unknown);
const modeOf = (file: string): string => (fs.statSync(file).mode & 0o777).toString(8);

let dir = '';
beforeEach(() => {
  dir = fs.mkdtempSync(join(tmpdir(), 'dems-fxr-s-errlog-'));
  vi.mocked(fs.mkdirSync).mockClear();
  vi.mocked(fs.chmodSync).mockClear();
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('the rotation of the persistent error log (HBX-4, W91-8)', () => {
  it('rotates at 5 MiB by default, to `<name>.1.log`', () => {
    expect(ERROR_LOG_ROTATE_BYTES).toBe(5 * 1024 * 1024);
    expect(rotatedErrorLogFile('/x/logs/errors.log')).toBe('/x/logs/errors.1.log');
  });

  it('a file at the limit is moved to the one older generation and a new file starts with the entry', () => {
    const file = join(dir, 'logs', 'errors.log');
    const log = createErrorLog(file, { rotateBytes: 400 });
    let appended = 0;
    while (!fs.existsSync(join(dir, 'logs', 'errors.1.log'))) {
      log.append({ ...ENTRY, context: { n: appended } });
      appended += 1;
      expect(appended).toBeLessThan(100);
    }
    const older = lines(join(dir, 'logs', 'errors.1.log'));
    const current = lines(file);
    // Nothing is lost at the rotation: the older file holds every entry before it, the new one the entry that found the limit.
    expect(older.length + current.length).toBe(appended);
    expect(current).toEqual([expect.objectContaining({ context: { n: appended - 1 } })]);
    expect(fs.statSync(join(dir, 'logs', 'errors.1.log')).size).toBeGreaterThanOrEqual(400);
    expect(modeOf(file)).toBe('600');
  });

  it('keeps ONE generation: a second rotation replaces the older file', () => {
    const file = join(dir, 'errors.log');
    const log = createErrorLog(file, { rotateBytes: 300 });
    for (let n = 0; n < 40; n += 1) log.append({ ...ENTRY, context: { n } });
    expect(fs.readdirSync(dir).sort()).toEqual(['errors.1.log', 'errors.log']);
    const older = lines(join(dir, 'errors.1.log')) as { context: { n: number } }[];
    // The older file starts after entry 0: the first generation was replaced at least once.
    expect(older[0]?.context.n).toBeGreaterThan(0);
  });

  it('a path that does not end in `.log` still rotates, to `<path>.1` (the latent no-op rename)', () => {
    const file = join(dir, 'errors.jsonl');
    expect(rotatedErrorLogFile(file)).toBe(`${file}.1`);
    const log = createErrorLog(file, { rotateBytes: 300 });
    for (let n = 0; n < 20; n += 1) log.append({ ...ENTRY, context: { n } });
    expect(fs.existsSync(`${file}.1`)).toBe(true);
    expect(fs.statSync(file).size).toBeLessThan(300 + 200);
  });

  it('an existing file with a wider mode is set to 0600 by the first append of the process, and after a rotation', () => {
    const file = join(dir, 'errors.log');
    fs.writeFileSync(file, '', { mode: 0o644 });
    fs.chmodSync(file, 0o644);
    const log = createErrorLog(file, { rotateBytes: 300 });
    log.append(ENTRY);
    expect(modeOf(file)).toBe('600');
    for (let n = 0; n < 20; n += 1) log.append({ ...ENTRY, context: { n } });
    expect(fs.existsSync(join(dir, 'errors.1.log'))).toBe(true);
    expect(modeOf(file)).toBe('600');
    expect(modeOf(join(dir, 'errors.1.log'))).toBe('600');
  });

  it('the steady state makes no folder or mode call: once per file, again after a rotation', () => {
    const file = join(dir, 'logs', 'errors.log');
    const log = createErrorLog(file);
    for (let n = 0; n < 10; n += 1) log.append(ENTRY);
    expect(lines(file)).toHaveLength(10);
    expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fs.chmodSync)).toHaveBeenCalledTimes(1);
  });

  it('a failed append never throws, and the next append prepares the file again', () => {
    const file = join(dir, 'gone', 'errors.log');
    const log = createErrorLog(file);
    log.append(ENTRY);
    fs.rmSync(join(dir, 'gone'), { recursive: true, force: true });
    expect(() => log.append(ENTRY)).not.toThrow();
    log.append(ENTRY);
    expect(lines(file)).toHaveLength(1);
  });

  it('persistence off (no file) writes nothing', () => {
    expect(() => createErrorLog(null).append(ENTRY)).not.toThrow();
    expect(vi.mocked(fs.mkdirSync)).not.toHaveBeenCalled();
  });
});
