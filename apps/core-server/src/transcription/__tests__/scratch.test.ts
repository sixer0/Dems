// Fix pass F-M6 (code review row 80, finding R80-04): the raw PCM tap of a session - its whole
// audio, UNENCRYPTED - and the rest of its transcriber scratch are removed when the session is
// sealed, when its start failed, and at a start of the Core for sessions that are sealed already.
// Containment: that session's own folder below `<mediaStoreRoot>/.transcriber/sessions` (moved by fix pass F-M7c, ruling D180), never through a link.
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createMemorySnapshotStore, mountTranscription, sessionScratchDir, sessionTapPath, type TranscriptionControl } from '../index';
import { ScratchRemovalRefusal, listSessionScratch, removeSessionScratch } from '../scratch';
import { answerer, fakeHost, fullHost, makeDataDir, serverRow, writeTap, type DataDir, type FakeHost, mediaOf } from './support';

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});
function dataDir(slug: string): DataDir {
  const dir = makeDataDir(slug);
  dirs.push(dir.dataDir);
  dir.writeHost(fullHost(dir));
  return dir;
}
/** A session folder as a recording leaves it: the tap, a checkpoint, a chunk file. */
function scratchOf(dir: DataDir, sessionId: string): string {
  const folder = sessionScratchDir(mediaOf(dir.dataDir), sessionId);
  writeTap(sessionTapPath(mediaOf(dir.dataDir), sessionId), 1);
  writeFileSync(join(folder, 'transcript-checkpoint.json'), '{}');
  mkdirSync(join(folder, 'work'), { recursive: true });
  writeFileSync(join(folder, 'work', 'chunk-1.wav'), 'audio');
  return folder;
}
const A = 'SES-20310101-0401';
const B = 'SES-20310101-0402';

describe('R80-04: the removal of one session\'s transcriber scratch', () => {
  it('removes the tap and everything else of THAT session, and nothing of another; a second call finds nothing and says so', () => {
    const dir = dataDir('fm6-scratch');
    const a = scratchOf(dir, A);
    const b = scratchOf(dir, B);
    expect(listSessionScratch(mediaOf(dir.dataDir))).toEqual([A, B]);
    expect(removeSessionScratch(mediaOf(dir.dataDir), A)).toEqual({ removed: true });
    expect(existsSync(a)).toBe(false);
    // CONTROL: the other session, and the host file of the transcriber, are untouched.
    expect(existsSync(sessionTapPath(mediaOf(dir.dataDir), B))).toBe(true);
    expect(existsSync(join(b, 'work', 'chunk-1.wav'))).toBe(true);
    expect(existsSync(join(dir.dataDir, 'transcriber', 'host.json'))).toBe(true);
    expect(removeSessionScratch(mediaOf(dir.dataDir), A)).toEqual({ removed: false, refusal: ScratchRemovalRefusal.ABSENT });
    expect(listSessionScratch(mediaOf(dir.dataDir))).toEqual([B]);
  });

  it('never follows a link: a session folder that IS a link is refused and its target stays; a link INSIDE the folder is unlinked and its target stays', () => {
    const dir = dataDir('fm6-scratch-links');
    const outside = join(dir.dataDir, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'keep.txt'), 'kept');
    mkdirSync(join(mediaOf(dir.dataDir), '.transcriber', 'sessions'), { recursive: true });
    symlinkSync(outside, join(mediaOf(dir.dataDir), '.transcriber', 'sessions', A));
    expect(removeSessionScratch(mediaOf(dir.dataDir), A)).toEqual({ removed: false, refusal: ScratchRemovalRefusal.NOT_A_DIRECTORY });
    expect(readFileSync(join(outside, 'keep.txt'), 'utf8')).toBe('kept');
    // A link is no session folder of the sweep either.
    expect(listSessionScratch(mediaOf(dir.dataDir))).toEqual([]);

    const folder = sessionScratchDir(mediaOf(dir.dataDir), B);
    mkdirSync(folder, { recursive: true });
    symlinkSync(join(outside, 'keep.txt'), join(folder, 'tap.pcm'));
    expect(removeSessionScratch(mediaOf(dir.dataDir), B)).toEqual({ removed: true });
    expect(existsSync(folder)).toBe(false);
    expect(readFileSync(join(outside, 'keep.txt'), 'utf8')).toBe('kept');
  });

  it('a sessions folder that is itself a link, and an ID that is no session ID, remove nothing', () => {
    const dir = dataDir('fm6-scratch-root');
    const elsewhere = join(dir.dataDir, 'elsewhere');
    mkdirSync(join(elsewhere, A), { recursive: true });
    writeFileSync(join(elsewhere, A, 'tap.pcm'), 'audio');
    mkdirSync(join(mediaOf(dir.dataDir), '.transcriber'), { recursive: true });
    symlinkSync(elsewhere, join(mediaOf(dir.dataDir), '.transcriber', 'sessions'));
    expect(removeSessionScratch(mediaOf(dir.dataDir), A)).toEqual({ removed: false, refusal: ScratchRemovalRefusal.ROOT_NOT_A_DIRECTORY });
    expect(existsSync(join(elsewhere, A, 'tap.pcm'))).toBe(true);
    expect(listSessionScratch(mediaOf(dir.dataDir))).toEqual([]);
    for (const bad of ['..', '../x', 'SES-1', '', 'SES-20310101-0401/..']) expect(removeSessionScratch(mediaOf(dir.dataDir), bad), bad).toEqual({ removed: false, refusal: ScratchRemovalRefusal.SESSION_ID_INVALID });
  });
});

function mounted(slug: string): { host: FakeHost; control: TranscriptionControl; dir: DataDir } {
  const dir = dataDir(slug);
  const host = fakeHost(dir.dataDir, 'real');
  const control = mountTranscription(host.app, { readConfig: async () => serverRow('http://127.0.0.1:18912'), snapshots: createMemorySnapshotStore(), fetchImpl: answerer().fetchImpl, sessionStepIntervalMs: 5, modelProvenance: async () => ({ name: 'whisper-large-v3-turbo', version: null, quantisation: null, sha256: null }) });
  return { host, control, dir };
}

describe('R80-04: when the Core removes it', () => {
  it('THE SEAL STORED THE PACKAGE: `discardSessionScratch` removes the folder, forgets the run, and is idempotent', async () => {
    const m = mounted('fm6-discard-sealed');
    expect(await m.control.snapshotSttConfigForSession(A)).toMatchObject({ ok: true });
    await m.control.settled();
    writeTap(sessionTapPath(mediaOf(m.dir.dataDir), A), 10);
    m.host.capture.state = { sessionId: A, workerPid: process.pid, phase: 'RECORDING' };
    await m.control.runs.begin(A);
    m.control.runs.end(A, { recorded: true });
    await m.control.runs.idle();
    expect(existsSync(sessionTapPath(mediaOf(m.dir.dataDir), A))).toBe(true);

    expect(m.control.discardSessionScratch(A, 'SEALED')).toBe(true);
    expect(existsSync(sessionScratchDir(mediaOf(m.dir.dataDir), A))).toBe(false);
    expect(m.control.runs.status(A)).toBeNull();
    expect(m.control.discardSessionScratch(A, 'SEALED')).toBe(false);
    expect(m.host.persisted.filter((entry) => entry.code === 'TRANSCRIBER_SCRATCH_NOT_REMOVED')).toEqual([]);
  });

  it('A FAILED START: `end(recorded: false)` removes the tap - with a run and without one - so the next start of that ID finds the tap path free', async () => {
    const m = mounted('fm6-discard-failed-start');
    // Without a run: the worker never acknowledged, `begin` was never called.
    expect(await m.control.snapshotSttConfigForSession(A)).toMatchObject({ ok: true });
    await m.control.settled();
    writeTap(sessionTapPath(mediaOf(m.dir.dataDir), A), 1);
    m.control.runs.end(A, { recorded: false });
    expect(existsSync(sessionTapPath(mediaOf(m.dir.dataDir), A))).toBe(false);
    // With a run.
    expect(await m.control.snapshotSttConfigForSession(B)).toMatchObject({ ok: true });
    await m.control.settled();
    writeTap(sessionTapPath(mediaOf(m.dir.dataDir), B), 5);
    m.host.capture.state = { sessionId: B, workerPid: process.pid, phase: 'RECORDING' };
    await m.control.runs.begin(B);
    m.control.runs.end(B, { recorded: false });
    expect(existsSync(sessionTapPath(mediaOf(m.dir.dataDir), B))).toBe(false);
    // The folder of the next start of the same ID is made again (the tap can be written).
    m.control.sessionStartCommitted(B);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await m.control.settled();
    expect(existsSync(sessionScratchDir(mediaOf(m.dir.dataDir), B))).toBe(true);
    expect(existsSync(sessionTapPath(mediaOf(m.dir.dataDir), B))).toBe(false);
  });

  it('CONTROL: a capture that RECORDED keeps its tap at the end - the transcript still needs it until the seal', async () => {
    const m = mounted('fm6-discard-control');
    expect(await m.control.snapshotSttConfigForSession(A)).toMatchObject({ ok: true });
    await m.control.settled();
    writeTap(sessionTapPath(mediaOf(m.dir.dataDir), A), 5);
    m.host.capture.state = { sessionId: A, workerPid: process.pid, phase: 'RECORDING' };
    await m.control.runs.begin(A);
    m.control.runs.end(A, { recorded: true });
    await m.control.runs.idle();
    expect(existsSync(sessionTapPath(mediaOf(m.dir.dataDir), A))).toBe(true);
  });

  it('AT A START OF THE CORE: the sweep removes the scratch of sessions that are sealed, and of no other', () => {
    const m = mounted('fm6-sweep');
    scratchOf(m.dir, A);
    scratchOf(m.dir, B);
    expect(m.control.sweepSessionScratch((sessionId) => sessionId === A)).toEqual([A]);
    expect(existsSync(sessionScratchDir(mediaOf(m.dir.dataDir), A))).toBe(false);
    expect(existsSync(sessionTapPath(mediaOf(m.dir.dataDir), B))).toBe(true);
    // Idempotent: nothing is left to sweep for A.
    expect(m.control.sweepSessionScratch((sessionId) => sessionId === A)).toEqual([]);
  });
});
