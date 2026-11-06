// The named pipe of a local microphone (blueprint row 135; capture spec §A.7.1 ML-2, §G.1 G-R6; check
// M4-SEC-HELPER-1, pipe-path half). These tests use the REAL file system (a throw-away directory)
// and the REAL /usr/bin/mkfifo through the real door: a pipe that a planted tree only pretends to
// make would prove nothing about "created exclusively, never an existing regular file".
import { chmodSync, closeSync, constants, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, symlinkSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../../errors';
import { micPipePath } from '../../mic-transport';
import { LocalSourceError, LocalSourceErrorCode, LocalSourceErrorReason } from '../errors';
import { PIPE_DRAIN_INTERVAL_MS, createPipeFiles, createPipeKeeper, type PipeEntryFacts, type PipeFiles } from '../pipe-files';
import { MKFIFO_BOUND_MS, MKFIFO_PROGRAM, preparePipe, removePipe, runBounded } from '../mic-pipe';
import { inspectProgram, startHelperProcess, type HelperDoor } from '../process-door';
import { exitOf, manualTimers, scriptedProcess, temporaryRoot, trustedInspector } from './mic-support';

const tmp = temporaryRoot();
afterAll(() => tmp.remove());
let counter = 0;
/** A fresh run directory per test, so that no test sees the leftovers of another. */
const fresh = (): string => join(tmp.root, `case-${(counter += 1)}`, 'run', 'capture');

const files = createPipeFiles();
const timers = manualTimers();
const prepare = (runDir: string, over: { sessionId?: string; deviceId?: string; files?: PipeFiles; door?: HelperDoor; inspector?: typeof inspectProgram } = {}): Promise<string> =>
  preparePipe({ runDir, sessionId: over.sessionId ?? 'SES-1', deviceId: over.deviceId ?? 'MIC-03', files: over.files ?? files, door: over.door ?? startHelperProcess, timers, inspector: over.inspector ?? inspectProgram });

async function refusalOf(promise: Promise<unknown>): Promise<LocalSourceError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(LocalSourceError);
    return error as LocalSourceError;
  }
  throw new Error('expected the pipe to be refused');
}

const expectRefused = (error: LocalSourceError, reason: LocalSourceErrorReason = LocalSourceErrorReason.TARGET_REFUSED): void => {
  expect(error.code).toBe(LocalSourceErrorCode.OPEN_FAILED);
  expect(error.reason).toBe(reason);
  expect(error.deviceId).toBe('MIC-03');
};

describe('the real program: /usr/bin/mkfifo passes the path rule', () => {
  it('is owned by root, closed to writing, and so is every directory on the way', () => {
    // Positive control for the rule: a system program passes. The Homebrew FFmpeg path is the negative case (see the implementation note).
    const facts = inspectProgram(MKFIFO_PROGRAM);
    expect(facts.exists).toBe(true);
    expect(facts.file?.ownerUid).toBe(0);
    expect(facts.directoriesAsWritten.every((step) => step.ownerUid === 0 && (step.mode & 0o022) === 0)).toBe(true);
  });
});

describe('creating the pipe', () => {
  it('makes a named pipe at <runDir>/<sessionId>/<deviceId>.pcm, mode 0600, in directories closed to others', async () => {
    const runDir = fresh();
    const path = await prepare(runDir);
    expect(path).toBe(micPipePath(runDir, 'SES-1', 'MIC-03'));
    const status = lstatSync(path);
    expect(status.isFIFO()).toBe(true);
    expect(status.mode & 0o777).toBe(0o600);
    expect(status.uid).toBe(process.getuid?.());
    expect(lstatSync(join(runDir, 'SES-1')).mode & 0o022).toBe(0);
    expect(readdirSync(join(runDir, 'SES-1'))).toEqual(['MIC-03.pcm']);
  });

  it('the path is confined to the run directory: the ids are held to their patterns before any path is built', async () => {
    const runDir = fresh();
    for (const bad of [{ sessionId: '../escape' }, { sessionId: 'a/b' }, { sessionId: '' }, { sessionId: '.hidden' }, { sessionId: '..' }, { deviceId: 'MIC-1' }, { deviceId: '../MIC-03' }, { deviceId: 'CAM-03' }, { deviceId: 'MIC-03/x' }]) {
      let caught: unknown;
      try {
        await prepare(runDir, bad);
      } catch (error) {
        caught = error;
      }
      expect(caught, JSON.stringify(bad)).toBeInstanceOf(CaptureAdapterError);
      expect((caught as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.LOCATOR_INVALID);
    }
    // Nothing was made for any of them, not even a directory.
    expect(existsSync(runDir)).toBe(false);
    expect(existsSync(join(runDir, '..', 'escape'))).toBe(false);
  });

  it('a run directory the helper could not be given as an argument is refused before anything is made', async () => {
    for (const odd of [`${tmp.root}//double`, `${tmp.root}/semi;colon`, `${tmp.root}/us@er`, `${tmp.root}/dollar$`]) {
      expectRefused(await refusalOf(prepare(odd)));
      expect(existsSync(odd), odd).toBe(false);
    }
  });

  it('a relative run directory is refused', async () => {
    let caught: unknown;
    try {
      await prepare('relative/run');
    } catch (error) {
      caught = error;
    }
    expect((caught as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.LOCATOR_INVALID);
  });

  it('a leftover pipe of a crashed run is removed and a fresh one made (not the old inode)', async () => {
    const runDir = fresh();
    const first = await prepare(runDir);
    const before = lstatSync(first, { bigint: true });
    const second = await prepare(runDir);
    expect(second).toBe(first);
    expect(lstatSync(second).isFIFO()).toBe(true);
    // Bench fix 2026-11-04: this filesystem hands an immediately recreated FIFO the SAME inode
    // number the unlink just freed - inode identity cannot prove the removal here. The strict
    // signal that survives any filesystem is the change time of the fresh creation (or, where the
    // fs does not reuse numbers, the new inode itself).
    const after = lstatSync(second, { bigint: true });
    expect(after.ino !== before.ino || after.ctimeNs > before.ctimeNs).toBe(true);
  });
});

describe('never an existing regular file (the pipe half of M4-SEC-HELPER-1)', () => {
  function planted(runDir: string, make: (path: string) => void): string {
    const sessionDir = join(runDir, 'SES-1');
    mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
    const path = join(sessionDir, 'MIC-03.pcm');
    make(path);
    return path;
  }

  it('a regular file at the path is refused and left exactly as it was', async () => {
    const runDir = fresh();
    const path = planted(runDir, (target) => writeFileSync(target, 'evidence that must survive', { mode: 0o600 }));
    expectRefused(await refusalOf(prepare(runDir)));
    expect(readFileSync(path, 'utf8')).toBe('evidence that must survive');
    expect(lstatSync(path).isFile()).toBe(true);
  });

  it('a symbolic link at the path is refused; its target is not touched', async () => {
    const runDir = fresh();
    const target = join(tmp.root, `target-${counter}.txt`);
    writeFileSync(target, 'target content');
    const path = planted(runDir, (link) => symlinkSync(target, link));
    expectRefused(await refusalOf(prepare(runDir)));
    expect(lstatSync(path).isSymbolicLink()).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe('target content');
  });

  it('a directory at the path is refused', async () => {
    const runDir = fresh();
    const path = planted(runDir, (target) => mkdirSync(target));
    expectRefused(await refusalOf(prepare(runDir)));
    expect(lstatSync(path).isDirectory()).toBe(true);
  });

  it('a pipe that belongs to another user is refused and kept (the server removes its own leftovers only)', async () => {
    const runDir = fresh();
    const first = await prepare(runDir);
    // The same file system, seen by a server that runs as somebody else: the pipe is a stranger's.
    const stranger: PipeFiles = { ...files, serverUid: (process.getuid?.() ?? 0) + 1 };
    expectRefused(await refusalOf(prepare(runDir, { files: stranger })));
    expect(lstatSync(first).isFIFO()).toBe(true);
  });

  it('a run directory that is a symbolic link is refused, and nothing is made behind the link', async () => {
    const runDir = fresh();
    const elsewhere = join(tmp.root, `elsewhere-${counter}`);
    mkdirSync(elsewhere, { recursive: true, mode: 0o700 });
    mkdirSync(join(runDir, '..'), { recursive: true });
    symlinkSync(elsewhere, runDir);
    expectRefused(await refusalOf(prepare(runDir)));
    expect(readdirSync(elsewhere)).toEqual([]);
  });

  it('a session directory that is a symbolic link out of the run directory is refused, and the target stays empty', async () => {
    const runDir = fresh();
    mkdirSync(runDir, { recursive: true, mode: 0o700 });
    const elsewhere = join(tmp.root, `outside-${counter}`);
    mkdirSync(elsewhere, { recursive: true, mode: 0o700 });
    symlinkSync(elsewhere, join(runDir, 'SES-1'));
    expectRefused(await refusalOf(prepare(runDir)));
    expect(readdirSync(elsewhere)).toEqual([]);
  });

  it('a session directory that others may write to is refused', async () => {
    const runDir = fresh();
    const sessionDir = join(runDir, 'SES-1');
    mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
    chmodSync(sessionDir, 0o777);
    expectRefused(await refusalOf(prepare(runDir)));
    expect(readdirSync(sessionDir)).toEqual([]);
  });

  it('a run directory that others may write to is refused before anything is made below it', async () => {
    const runDir = fresh();
    mkdirSync(runDir, { recursive: true, mode: 0o700 });
    chmodSync(runDir, 0o775);
    expectRefused(await refusalOf(prepare(runDir)));
    expect(readdirSync(runDir)).toEqual([]);
  });

  it('control: the same checks accept a plain, private tree (they can say yes)', async () => {
    const runDir = fresh();
    mkdirSync(runDir, { recursive: true, mode: 0o700 });
    expect(lstatSync(await prepare(runDir)).isFIFO()).toBe(true);
  });
});

describe('the checks on a planted tree (a facade that can lie, so that every rule can be made to fail)', () => {
  const real = createPipeFiles();
  const facade = (over: Partial<PipeFiles>): PipeFiles => ({ ...real, ...over });

  it('a resolved session directory that is not <resolved run directory>/<sessionId> is refused', async () => {
    const runDir = fresh();
    const lying = facade({ realpath: (path) => (path.endsWith('/SES-1') ? '/somewhere/else' : real.realpath(path)) });
    expectRefused(await refusalOf(prepare(runDir, { files: lying })));
  });

  it('a pipe that reads back with a wrong mode is removed and refused', async () => {
    const runDir = fresh();
    const lying = facade({ inspect: (path): PipeEntryFacts => (path.endsWith('.pcm') ? { ...real.inspect(path), mode: 0o644 } : real.inspect(path)) });
    expectRefused(await refusalOf(prepare(runDir, { files: lying })));
    expect(existsSync(micPipePath(runDir, 'SES-1', 'MIC-03'))).toBe(false);
  });

  it('a pipe that is not a pipe when read back is refused', async () => {
    const runDir = fresh();
    const lying = facade({ inspect: (path): PipeEntryFacts => (path.endsWith('.pcm') && real.inspect(path).kind === 'fifo' ? { ...real.inspect(path), kind: 'file' } : real.inspect(path)) });
    expectRefused(await refusalOf(prepare(runDir, { files: lying })));
  });

  it('a directory that cannot be made is refused', async () => {
    const lying = facade({
      makeDirectory: () => {
        throw new Error('EACCES');
      },
    });
    expectRefused(await refusalOf(prepare(fresh(), { files: lying })));
  });

  it('mkfifo failing, being killed at its bound or not starting is refused', async () => {
    const runDir = fresh();
    const failing: HelperDoor = () => scriptedProcess({ ends: exitOf({ exitCode: 1, diagnostics: 'mkfifo: File exists' }) });
    expectRefused(await refusalOf(prepare(runDir, { door: failing })));
    const notStarted: HelperDoor = () => scriptedProcess({ ends: exitOf({ exitCode: null, spawnFailed: true }) });
    expectRefused(await refusalOf(prepare(runDir, { door: notStarted })));

    const clock = manualTimers();
    let process: ReturnType<typeof scriptedProcess> | null = null;
    const hanging: HelperDoor = () => (process = scriptedProcess({ lives: true }));
    const pending = refusalOf(preparePipe({ runDir, sessionId: 'SES-1', deviceId: 'MIC-03', files, door: hanging, timers: clock, inspector: inspectProgram }));
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    expect(clock.pending()).toContain(MKFIFO_BOUND_MS);
    clock.fire(MKFIFO_BOUND_MS);
    expectRefused(await pending);
    expect((process as unknown as ReturnType<typeof scriptedProcess>).signals).toEqual(['SIGKILL']);
  });

  it('the mkfifo program is held to the same path rule as the helper: a writable directory on the way starts nothing', async () => {
    const writable = (): ReturnType<ReturnType<typeof trustedInspector>> => ({ ...trustedInspector()(), directoriesAsWritten: [{ ownerUid: 0, mode: 0o777 }] });
    let started = 0;
    const counting: HelperDoor = (options) => {
      started += 1;
      return startHelperProcess(options);
    };
    const error = await refusalOf(preparePipe({ runDir: fresh(), sessionId: 'SES-1', deviceId: 'MIC-03', files, door: counting, timers, inspector: writable }));
    expectRefused(error, LocalSourceErrorReason.PROGRAM_REFUSED);
    expect(started).toBe(0);
  });
});

describe('removing the pipe', () => {
  it('removes a pipe of the server, and only that', async () => {
    const runDir = fresh();
    const path = await prepare(runDir);
    expect(removePipe(files, path)).toBe(true);
    expect(existsSync(path)).toBe(false);
    expect(removePipe(files, path)).toBe(true);
  });

  it('leaves a regular file where it is', () => {
    const runDir = fresh();
    mkdirSync(join(runDir, 'SES-1'), { recursive: true });
    const path = join(runDir, 'SES-1', 'MIC-03.pcm');
    writeFileSync(path, 'keep');
    expect(removePipe(files, path)).toBe(false);
    expect(readFileSync(path, 'utf8')).toBe('keep');
  });

  it('leaves a stranger\'s pipe where it is, and never throws', async () => {
    const runDir = fresh();
    const path = await prepare(runDir);
    expect(removePipe({ ...files, serverUid: (process.getuid?.() ?? 0) + 1 }, path)).toBe(false);
    expect(existsSync(path)).toBe(true);
    expect(removePipe({ ...files, remove: () => { throw new Error('EPERM'); } }, path)).toBe(false);
  });
});

describe('the bounded run', () => {
  it('kills a program at the bound and reports it', async () => {
    const clock = manualTimers();
    const hanging = scriptedProcess({ lives: true });
    const run = runBounded(() => hanging, clock, '/x', [], 123);
    clock.fire(123);
    const result = await run;
    expect(result.timedOut).toBe(true);
    expect(hanging.signals).toEqual(['SIGKILL']);
  });

  it('kills a program when the caller gives up', async () => {
    const hanging = scriptedProcess({ lives: true });
    const controller = new AbortController();
    const run = runBounded(() => hanging, manualTimers(), '/x', [], 123, controller.signal);
    controller.abort();
    expect((await run).aborted).toBe(true);
    expect(hanging.signals).toEqual(['SIGKILL']);
  });
});

// Task 4 row N10 (decision C118 (1); request line 552 of row N9): THE PRODUCT'S PIPE KEEPER on a REAL named pipe made by the real
// mkfifo. A writer is played by this test with a non-blocking open for writing, which the system refuses (ENXIO) while no reader
// holds the pipe - so "the keeper holds a reader" is a fact of the system, not of a double. The drain's turns are fired by hand.
// Mutations seen RED: the drain reading nothing (`DRAIN_READS_PER_TURN` 0) - the second case; `release` not closing - the writer
// still finds a reader (cases 1 and 2). The open's flags (`O_RDONLY | O_NONBLOCK`, a blocking open would hold the thread) are
// pinned by text in `mic-static.test.ts`.
describe('row N10: the pipe keeper (hold without a writer, read nothing while held, drain and drop, release)', () => {
  const writerOf = (path: string): number => openSync(path, constants.O_WRONLY | constants.O_NONBLOCK);
  const codeOfThrow = (work: () => unknown): string => {
    try {
      work();
      return 'NONE';
    } catch (error) {
      return String((error as { code?: unknown }).code);
    }
  };
  /** Writes chunks of 4 KiB until the pipe is full; the bytes it took. */
  const fill = (writer: number): number => {
    const chunk = Buffer.alloc(4_096, 7);
    let total = 0;
    for (;;) {
      try {
        total += writeSync(writer, chunk);
      } catch (error) {
        if ((error as { code?: unknown }).code === 'EAGAIN') return total;
        throw error;
      }
    }
  };

  it('holds a pipe that has no writer at once, and is a reader of it: before the hold a writer is refused, after it a writer opens', async () => {
    const path = await prepare(fresh());
    expect(codeOfThrow(() => writerOf(path))).toBe('ENXIO');
    const clock = manualTimers();
    const held = await createPipeKeeper(clock).hold(path);
    const writer = writerOf(path);
    // Held, not drained: nothing is read and no turn is planned.
    expect(clock.pending()).toEqual([]);
    closeSync(writer);
    held.release();
    expect(codeOfThrow(() => writerOf(path))).toBe('ENXIO');
  });

  it('reads NOTHING while held: a full pipe stays full; drained, every turn reads and drops what waits, and the writer can write again', async () => {
    const path = await prepare(fresh());
    const clock = manualTimers();
    const held = await createPipeKeeper(clock).hold(path);
    const writer = writerOf(path);
    const capacity = fill(writer);
    expect(capacity).toBeGreaterThan(0);
    expect(fill(writer)).toBe(0);
    held.drain();
    // The first turn ran at once and planned the next one.
    expect(clock.pending()).toEqual([PIPE_DRAIN_INTERVAL_MS]);
    expect(fill(writer)).toBeGreaterThan(0);
    expect(clock.fire(PIPE_DRAIN_INTERVAL_MS)).toBe(true);
    expect(fill(writer)).toBeGreaterThan(0);
    // A second drain is the first one: one turn is planned, never two.
    held.drain();
    expect(clock.pending()).toEqual([PIPE_DRAIN_INTERVAL_MS]);
    held.release();
    expect(clock.pending()).toEqual([]);
    // Released: the pipe has no reader; the writer's next write is refused by the system.
    expect(codeOfThrow(() => writeSync(writer, Buffer.alloc(1)))).toBe('EPIPE');
    closeSync(writer);
  });

  it('never throws from drain or release: twice, after release, and with the writer gone; a pipe that is not there is a rejected hold', async () => {
    const path = await prepare(fresh());
    const clock = manualTimers();
    const held = await createPipeKeeper(clock).hold(path);
    const writer = writerOf(path);
    closeSync(writer);
    // No writer any more: a turn reads 0 bytes and plans the next one.
    held.drain();
    expect(clock.fire(PIPE_DRAIN_INTERVAL_MS)).toBe(true);
    held.release();
    held.release();
    held.drain();
    expect(clock.pending()).toEqual([]);
    await expect(createPipeKeeper(clock).hold(join(fresh(), 'absent.pcm'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
