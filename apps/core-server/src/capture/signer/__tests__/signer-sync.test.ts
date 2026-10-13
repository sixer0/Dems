// Task 4 row 210 (SX-16 first half): the three files and the directory of a provisioning are SYNCED.
//
// Its own file, apart from `signer.test.ts`: a sync cannot be seen from outside, so this file puts a
// RECORDER around the file-system module - every function is the real one; `fsyncSync` and
// `writeSync` also note which entry (by inode) they were called on. The existing cases of
// `signer.test.ts` keep running on the module as it is. The key is made in a directory of the
// temporary folder that `afterAll` removes.
import { afterAll, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ list: [] as Array<{ call: 'write' | 'sync'; inode: number; directory: boolean }> }));
vi.mock('node:fs', async (original) => {
  const real = await original<typeof import('node:fs')>();
  const note = (call: 'write' | 'sync', handle: number): void => {
    const status = real.fstatSync(handle);
    calls.list.push({ call, inode: status.ino, directory: status.isDirectory() });
  };
  const recorded = {
    ...real,
    fsyncSync: (handle: number): void => {
      note('sync', handle);
      real.fsyncSync(handle);
    },
    writeSync: ((handle: number, ...rest: unknown[]): number => {
      note('write', handle);
      return (real.writeSync as (handle: number, ...rest: unknown[]) => number)(handle, ...rest);
    }) as typeof real.writeSync,
  };
  return { ...recorded, default: recorded };
});

const fs = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const { loadSoftwareSigner, markSigningKeyCompromised, provisionSigningKey } = await import('..');

const NOW = 1_791_500_000_000;
const KEY = 'CORE-KEY-EVSIGN-01';
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

describe('SX-16: provisioning syncs what it writes', () => {
  it('each of the three files is synced AFTER its last write, then the directory, then the directory that holds it', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'dems-row210-sync-'));
    roots.push(root);
    const dir = join(root, 'signer');
    calls.list.length = 0;
    provisionSigningKey({ dir, now: NOW });
    const made = [...calls.list];
    const inodeOf = (path: string): number => fs.lstatSync(path).ino;
    const order = made.map((entry) => `${entry.call}:${entry.inode}`);
    for (const extension of ['wrap', 'p8', 'crt']) {
      const inode = inodeOf(join(dir, `${KEY}.${extension}`));
      const writes = order.lastIndexOf(`write:${inode}`);
      const syncs = order.indexOf(`sync:${inode}`);
      expect(writes, extension).toBeGreaterThanOrEqual(0);
      expect(syncs, extension).toBeGreaterThan(writes);
    }
    // The directory after the last file, and its parent (this call made the directory) after that.
    const directories = made.filter((entry) => entry.call === 'sync' && entry.directory).map((entry) => entry.inode);
    expect(directories).toEqual([inodeOf(dir), inodeOf(root)]);
    const lastFileSync = Math.max(...['wrap', 'p8', 'crt'].map((extension) => order.indexOf(`sync:${inodeOf(join(dir, `${KEY}.${extension}`))}`)));
    expect(order.indexOf(`sync:${inodeOf(dir)}`)).toBeGreaterThan(lastFileSync);
    expect(made.filter((entry) => entry.call === 'sync')).toHaveLength(5);
    // The store that was synced is a store that loads.
    expect(loadSoftwareSigner({ dir, now: NOW + 1_000 }).signer.keyId).toBe(KEY);

    // A second key in a directory that is already there: the directory is synced again, its parent is not.
    calls.list.length = 0;
    provisionSigningKey({ dir, now: NOW, keyId: 'CORE-KEY-EVSIGN-02' });
    expect(calls.list.filter((entry) => entry.call === 'sync' && entry.directory).map((entry) => entry.inode)).toEqual([inodeOf(dir)]);

    // The compromise mark: the file, then the directory.
    calls.list.length = 0;
    markSigningKeyCompromised({ dir, at: NOW + 5 });
    expect(calls.list.filter((entry) => entry.call === 'sync').map((entry) => entry.inode)).toEqual([inodeOf(join(dir, `${KEY}.compromised`)), inodeOf(dir)]);
  });

  it('CONTROL of the recorder: a write without a sync is seen as one', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'dems-row210-sync-'));
    roots.push(root);
    calls.list.length = 0;
    const handle = fs.openSync(join(root, 'plain'), 'wx', 0o600);
    fs.writeSync(handle, Buffer.from('x'));
    fs.closeSync(handle);
    expect(calls.list.map((entry) => entry.call)).toEqual(['write']);
  });
});
