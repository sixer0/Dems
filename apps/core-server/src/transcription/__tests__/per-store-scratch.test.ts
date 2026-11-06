// Fix pass F-M7c (item 3 (i); ruling D180): EVERY PER-SESSION ARTEFACT OUTSIDE THE DATABASE IS KEYED
// BY THE MEDIA STORE ROOT OF ITS CORE - one root per database - never by the data directory all
// lanes share. The transcriber scratch of a session is `<mediaStoreRoot>/.transcriber/sessions/<id>`.
//
// Two Cores on ONE data directory with two media store roots and THE SAME session ID: neither
// sees, lists, or removes the other's scratch.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { TRANSCRIBER_SCRATCH_FOLDER, createMemorySnapshotStore, mountTranscription, sessionScratchDir, sessionTapPath, type TranscriptionControl } from '../index';
import { listSessionScratch, removeSessionScratch } from '../scratch';
import { answerer, fakeHost, fullHost, makeDataDir, serverRow, writeTap, type FakeHost } from './support';

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});
const SAME = 'SES-20310101-0501';

function twoCores(slug: string): { dataDir: string; rootA: string; rootB: string; a: { host: FakeHost; control: TranscriptionControl }; b: { host: FakeHost; control: TranscriptionControl } } {
  const dir = makeDataDir(slug);
  dirs.push(dir.dataDir);
  dir.writeHost(fullHost(dir));
  const rootA = join(dir.dataDir, 'media', 'dems_lane_1', 'sessions');
  const rootB = join(dir.dataDir, 'media', 'dems_lane_2', 'sessions');
  const core = (root: string) => {
    const host = fakeHost(dir.dataDir, 'real', root);
    const control = mountTranscription(host.app, { readConfig: async () => serverRow('http://127.0.0.1:18912'), snapshots: createMemorySnapshotStore(), fetchImpl: answerer().fetchImpl, sessionStepIntervalMs: 5, modelProvenance: async () => ({ name: 'whisper-large-v3-turbo', version: null, quantisation: null, modelSha256: null, reportedByServer: true, report: null }) as never });
    return { host, control };
  };
  return { dataDir: dir.dataDir, rootA, rootB, a: core(rootA), b: core(rootB) };
}

describe('D180: the transcriber scratch is keyed by the media store root', () => {
  it('the path is below the media store root, in a hidden folder that is no package folder; never below the shared data directory', () => {
    expect(TRANSCRIBER_SCRATCH_FOLDER).toBe('.transcriber');
    expect(sessionScratchDir('/data/media/dems_lane_2/sessions', SAME)).toBe(`/data/media/dems_lane_2/sessions/.transcriber/sessions/${SAME}`);
    expect(sessionTapPath('/data/media/dems_lane_2/sessions', SAME)).toBe(`/data/media/dems_lane_2/sessions/.transcriber/sessions/${SAME}/tap.pcm`);
  });

  it('two Cores, one data directory, the SAME session ID: each has its own scratch folder and tap path; one Core\'s removal and sweep leave the other\'s folder', async () => {
    const t = twoCores('fm7c-two-cores');
    for (const core of [t.a, t.b]) {
      expect(await core.control.snapshotSttConfigForSession(SAME)).toMatchObject({ ok: true });
      await core.control.settled();
    }
    const tapA = await t.a.control.tapPathFor(SAME);
    const tapB = await t.b.control.tapPathFor(SAME);
    expect(tapA).toBe(join(t.rootA, '.transcriber', 'sessions', SAME, 'tap.pcm'));
    expect(tapB).toBe(join(t.rootB, '.transcriber', 'sessions', SAME, 'tap.pcm'));
    expect(t.a.control.scratchDirFor(SAME)).not.toBe(t.b.control.scratchDirFor(SAME));
    // Made owner-only, with the root above them.
    for (const root of [t.rootA, t.rootB]) for (const path of [join(root, '.transcriber'), join(root, '.transcriber', 'sessions'), join(root, '.transcriber', 'sessions', SAME)]) expect(statSync(path).mode & 0o777, path).toBe(0o700);
    // NOTHING per session is below the shared data directory's transcriber folder.
    expect(existsSync(join(t.dataDir, 'transcriber', 'sessions'))).toBe(false);
    writeTap(tapA as string, 3);
    writeFileSync(join(t.b.control.scratchDirFor(SAME), 'tap.pcm'), 'the audio of the OTHER database');

    // Core A seals its session: ITS scratch goes, B's is untouched.
    expect(t.a.control.discardSessionScratch(SAME, 'SEALED')).toBe(true);
    expect(existsSync(t.a.control.scratchDirFor(SAME))).toBe(false);
    expect(readFileSync(join(t.b.control.scratchDirFor(SAME), 'tap.pcm'), 'utf8')).toBe('the audio of the OTHER database');
    // A's boot sweep ("every session is sealed") lists and removes nothing of B.
    expect(t.a.control.sweepSessionScratch(() => true)).toEqual([]);
    expect(listSessionScratch(t.rootA)).toEqual([]);
    expect(listSessionScratch(t.rootB)).toEqual([SAME]);
    expect(existsSync(t.b.control.scratchDirFor(SAME))).toBe(true);
    // CONTROL: B's own removal does remove it.
    expect(removeSessionScratch(t.rootB, SAME)).toEqual({ removed: true });
  });

  it('CONTROL: a folder left under the OLD shared path `<dataDir>/transcriber/sessions/<id>` is neither listed nor removed by a Core (it is no Core\'s to judge)', async () => {
    const t = twoCores('fm7c-old-path');
    const old = join(t.dataDir, 'transcriber', 'sessions', SAME);
    mkdirSync(old, { recursive: true });
    writeFileSync(join(old, 'tap.pcm'), 'left by an earlier build');
    expect(t.a.control.sweepSessionScratch(() => true)).toEqual([]);
    expect(t.a.control.discardSessionScratch(SAME, 'SEALED')).toBe(false);
    expect(readFileSync(join(old, 'tap.pcm'), 'utf8')).toBe('left by an earlier build');
  });
});
