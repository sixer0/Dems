// Task 4 row 225 (package X1-4; SX-09 (b); SX-16): THE WRITE OF THE POINTER IS WHOLE OR NOT AT ALL.
//
// Its own file, as `signer-sync.test.ts` is: what a write does step by step cannot be seen from
// outside, so this file puts a RECORDER WITH A STOP around the file-system module. Every function
// is the real one. The recorder notes the steps of a write (create, write, sync of a file, rename,
// sync of a directory) and every call that would replace, remove or cut a file; a test may ARM one
// step, and the armed step throws - for `write` after HALF of the bytes went to the disk, for
// `rename-after` after the rename was done.
//
// WHY A THROWN ERROR STANDS FOR A STOP OF THE PROCESS. `activateSigningKey` has no clean-up: after
// an error it closes its handle and removes, renames and rewrites nothing (asserted below: the
// recorder sees no such call). So the directory after an error at step N is byte for byte the
// directory after a kill at step N. What a kill adds - the loss of bytes that were written and not
// yet synced - can only take the pointer BACK to its earlier whole state: the staged file is synced
// before the rename, and the rename swaps a whole file for a whole file.
//
// Every key is made by the test in a directory of the temporary folder that `afterAll` removes.
import { afterAll, describe, expect, it, vi } from 'vitest';

type Step = 'create' | 'write' | 'sync-file' | 'rename-before' | 'rename-after' | 'sync-directory';
const tape = vi.hoisted(() => ({ steps: [] as string[], armed: null as string | null, renames: [] as Array<[string, string]> }));
vi.mock('node:fs', async (original) => {
  const real = await original<typeof import('node:fs')>();
  const reach = (step: string): void => {
    tape.steps.push(step);
    if (tape.armed === step) {
      tape.armed = null;
      throw new Error('STOP: the test stopped the write here');
    }
  };
  const forbidden = <Name extends 'unlinkSync' | 'rmSync' | 'rmdirSync' | 'truncateSync' | 'ftruncateSync' | 'copyFileSync' | 'writeFileSync' | 'appendFileSync' | 'linkSync' | 'symlinkSync'>(name: Name): (typeof real)[Name] =>
    ((...args: unknown[]) => {
      tape.steps.push(`forbidden:${name}`);
      return (real[name] as (...rest: unknown[]) => unknown)(...args);
    }) as (typeof real)[Name];
  const recorded = {
    ...real,
    openSync: ((path: string, flags?: number | string, mode?: number): number => {
      if (typeof flags === 'number' && (flags & real.constants.O_CREAT) !== 0) reach('create');
      return (real.openSync as (...args: unknown[]) => number)(path, flags, mode);
    }) as typeof real.openSync,
    writeSync: ((handle: number, data: Uint8Array, offset: number, length: number): number => {
      tape.steps.push('write');
      if (tape.armed === 'write') {
        tape.armed = null;
        // HALF of the bytes reach the disk, then the write stops.
        real.writeSync(handle, data, offset, Math.floor(length / 2));
        throw new Error('STOP: the test stopped the write here');
      }
      return real.writeSync(handle, data, offset, length);
    }) as typeof real.writeSync,
    fsyncSync: (handle: number): void => {
      reach(real.fstatSync(handle).isDirectory() ? 'sync-directory' : 'sync-file');
      real.fsyncSync(handle);
    },
    renameSync: ((from: string, to: string): void => {
      tape.renames.push([from, to]);
      reach('rename-before');
      real.renameSync(from, to);
      reach('rename-after');
    }) as typeof real.renameSync,
    unlinkSync: forbidden('unlinkSync'),
    rmSync: forbidden('rmSync'),
    rmdirSync: forbidden('rmdirSync'),
    truncateSync: forbidden('truncateSync'),
    ftruncateSync: forbidden('ftruncateSync'),
    copyFileSync: forbidden('copyFileSync'),
    writeFileSync: forbidden('writeFileSync'),
    appendFileSync: forbidden('appendFileSync'),
    linkSync: forbidden('linkSync'),
    symlinkSync: forbidden('symlinkSync'),
  };
  return { ...recorded, default: recorded };
});

const fs = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const { ACTIVE_KEY_POINTER_NAME, SignerError, activateSigningKey, activeSigningKeyId, loadSoftwareSigner, markSigningKeyCompromised, nextSigningKeyId, provisionSigningKey } = await import('..');

const NOW = 1_792_100_000_000;
const IDS = ['CORE-KEY-EVSIGN-01', 'CORE-KEY-EVSIGN-02', 'CORE-KEY-EVSIGN-03'] as const;
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  for (const root of roots) expect(() => fs.lstatSync(root)).toThrow();
});

/** A store whose active key is `IDS[active]` and whose NEXT key (`IDS[active + 1]`) is provisioned and not active yet. */
function scene(active: 0 | 1): { dir: string; pointer: string; earlier: string; next: string; staged: string } {
  const root = fs.mkdtempSync(join(fs.realpathSync(tmpdir()), 'dems-row225-write-'));
  roots.push(root);
  const dir = join(root, 'signer');
  for (let place = 0; place <= active + 1; place += 1) provisionSigningKey({ dir, now: NOW, keyId: IDS[place] });
  if (active === 1) activateSigningKey({ dir, keyId: IDS[1], now: NOW });
  const next = IDS[active + 1] ?? 'none';
  return { dir, pointer: join(dir, ACTIVE_KEY_POINTER_NAME), earlier: IDS[active], next, staged: join(dir, `${ACTIVE_KEY_POINTER_NAME}.${next}.next`) };
}
/** The bytes of the pointer as they lie on the disk, or null when there is none. */
const pointerBytes = (pointer: string): string | null => (fs.existsSync(pointer) ? fs.readFileSync(pointer, 'latin1') : null);
const entries = (dir: string): Record<string, string> => Object.fromEntries(fs.readdirSync(dir).sort().map((name) => [name, fs.readFileSync(join(dir, name)).toString('hex')]));

describe('the pointer is written whole: a staged file, synced, then one rename, then the directory', () => {
  it('the order of a write, and what it never does: nothing is removed, cut, copied or written in place, and the one rename is onto the pointer', () => {
    for (const active of [0, 1] as const) {
      const made = scene(active);
      const before = entries(made.dir);
      tape.steps.length = 0;
      tape.renames.length = 0;
      activateSigningKey({ dir: made.dir, keyId: made.next, now: NOW });
      expect(tape.steps, String(active)).toEqual(['create', 'write', 'sync-file', 'rename-before', 'rename-after', 'sync-directory']);
      expect(tape.renames, String(active)).toEqual([[made.staged, made.pointer]]);
      expect(pointerBytes(made.pointer)).toBe(`${made.next}\n`);
      expect(fs.existsSync(made.staged)).toBe(false);
      // Every other entry of the store is byte-identical: the pointer's own write touched the pointer only.
      const after = entries(made.dir);
      delete after[ACTIVE_KEY_POINTER_NAME];
      delete before[ACTIVE_KEY_POINTER_NAME];
      expect(after).toEqual(before);
    }
    // Provisioning and the compromise mark rename and remove nothing at all.
    const plain = scene(0);
    tape.steps.length = 0;
    tape.renames.length = 0;
    provisionSigningKey({ dir: plain.dir, now: NOW, keyId: IDS[2] });
    markSigningKeyCompromised({ dir: plain.dir, keyId: IDS[2], at: NOW });
    expect(nextSigningKeyId({ dir: plain.dir })).toBe('CORE-KEY-EVSIGN-04');
    expect(tape.renames).toEqual([]);
    expect(tape.steps.filter((step) => step.startsWith('forbidden:') || step.startsWith('rename'))).toEqual([]);
  });

  it('a stop at ANY step leaves the earlier pointer or the new one, whole - never half a one - and the store answers with a key that loads', () => {
    const stops: ReadonlyArray<readonly [Step, 'earlier' | 'next']> = [
      ['create', 'earlier'],
      ['write', 'earlier'],
      ['sync-file', 'earlier'],
      ['rename-before', 'earlier'],
      ['rename-after', 'next'],
      ['sync-directory', 'next'],
    ];
    for (const active of [0, 1] as const) {
      for (const [step, expected] of stops) {
        const label = `active ${IDS[active]}, stop at ${step}`;
        const made = scene(active);
        const whole = pointerBytes(made.pointer);
        expect(whole, label).toBe(active === 0 ? null : `${made.earlier}\n`);
        tape.steps.length = 0;
        tape.armed = step;
        let thrown: unknown = null;
        try {
          activateSigningKey({ dir: made.dir, keyId: made.next, now: NOW });
        } catch (error) {
          thrown = error;
        }
        // The stop was reached, and what came out is a code of the signer - never the text of the stop.
        expect(tape.armed, label).toBeNull();
        expect(thrown, label).toBeInstanceOf(SignerError);
        expect((thrown as Error).message, label).not.toContain('STOP');
        // After the stop the write did nothing more: no clean-up, no second rename.
        expect(tape.steps.filter((entry) => entry.startsWith('forbidden:')), label).toEqual([]);
        expect(tape.steps.at(-1), label).toBe(step);

        // THE STATE ON THE DISK: the pointer is the earlier one (or none) or the new one, exactly.
        const answer = expected === 'earlier' ? made.earlier : made.next;
        expect(pointerBytes(made.pointer), label).toBe(expected === 'earlier' ? whole : `${made.next}\n`);
        expect(activeSigningKeyId({ dir: made.dir }), label).toBe(answer);
        expect(loadSoftwareSigner({ dir: made.dir, now: NOW }).signer.keyId, label).toBe(answer);
        // A staged file may be left: it is not the pointer, nothing reads it, and half a one changes nothing.
        if (step === 'write') expect(fs.readFileSync(made.staged, 'latin1'), label).toBe(`${made.next}\n`.slice(0, Math.floor((made.next.length + 1) / 2)));
        if (step === 'create' || expected === 'next') expect(fs.existsSync(made.staged), label).toBe(false);
        // The interrupted id is spent either way: the next rotation takes the id after it.
        expect(nextSigningKeyId({ dir: made.dir }), label).toBe(active === 0 ? IDS[2] : 'CORE-KEY-EVSIGN-04');
      }
    }
  });

  it('CONTROL of the recorder: an armed step that is never reached stays armed, and a plain write is seen as its steps', () => {
    const root = fs.mkdtempSync(join(fs.realpathSync(tmpdir()), 'dems-row225-write-'));
    roots.push(root);
    tape.steps.length = 0;
    tape.armed = 'rename-before';
    const handle = fs.openSync(join(root, 'plain'), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    fs.writeSync(handle, Buffer.from('abcd'), 0, 4);
    fs.closeSync(handle);
    expect(tape.steps).toEqual(['create', 'write']);
    expect(tape.armed).toBe('rename-before');
    expect(() => fs.renameSync(join(root, 'plain'), join(root, 'moved'))).toThrow('STOP');
    expect(fs.existsSync(join(root, 'plain'))).toBe(true);
    tape.armed = 'write';
    const half = fs.openSync(join(root, 'half'), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    expect(() => fs.writeSync(half, Buffer.from('abcd'), 0, 4)).toThrow('STOP');
    fs.closeSync(half);
    expect(fs.readFileSync(join(root, 'half'), 'latin1')).toBe('ab');
    fs.unlinkSync(join(root, 'half'));
    expect(tape.steps.at(-1)).toBe('forbidden:unlinkSync');
  });
});
