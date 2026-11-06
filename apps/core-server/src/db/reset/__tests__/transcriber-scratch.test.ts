// Fix pass F-M6 (code review row 80, finding R80-04): a reset reuses session IDs, so the transcriber
// scratch of the sessions it clears - a raw PCM tap first of all - is removed with them. Otherwise
// the next STT-enabled session of a reused ID is refused its tap (`TAP_PATH_OCCUPIED`), and raw
// session audio of an erased session stays on the disk. On a real directory tree in a scratch folder.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { TRANSCRIBER_SCRATCH_FOLDER, TRANSCRIPTION_SESSIONS_FOLDER, TRANSCRIPTION_TAP_FILE, sessionScratchDir } from '../../../transcription';
import { READ_CLEARED_TRANSCRIBER_SESSIONS, TRANSCRIBER_SCRATCH_SUBPATH, removeTranscriberScratchOf } from '../transcriber-scratch';

const base = mkdtempSync(join(tmpdir(), 'dems-fm6-reset-scratch-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));
let caseNo = 0;
function dataDirOf(): string {
  caseNo += 1;
  const dir = join(base, `case-${caseNo}`, 'data');
  mkdirSync(join(dir, '.transcriber', 'sessions'), { recursive: true });
  writeFileSync(join(dir, '.transcriber', 'host.json'), '{"version":1}');
  return dir;
}
function scratch(dataDir: string, sessionId: string): string {
  const dir = join(dataDir, '.transcriber', 'sessions', sessionId);
  mkdirSync(join(dir, 'work'), { recursive: true });
  writeFileSync(join(dir, 'tap.pcm'), 'raw audio');
  writeFileSync(join(dir, 'work', 'chunk-1.wav'), 'audio');
  return dir;
}
const A = 'SES-20261010-0001';
const B = 'SES-20261010-0002';

describe('R80-04: the reset removes the transcriber scratch of the sessions it clears', () => {
  it('the path is the transcription unit\'s own (the reset imports no unit: the constants are held equal here), and the statement reads the sessions that took a snapshot', () => {
    // Pin moved by fix pass F-M7c (ruling D180): the scratch is below the MEDIA STORE ROOT of the database being reset, in its hidden `.transcriber` folder.
    expect(TRANSCRIBER_SCRATCH_SUBPATH).toEqual([TRANSCRIBER_SCRATCH_FOLDER, TRANSCRIPTION_SESSIONS_FOLDER]);
    expect(join('/store', ...TRANSCRIBER_SCRATCH_SUBPATH, A)).toBe(sessionScratchDir('/store', A));
    expect(TRANSCRIPTION_TAP_FILE).toBe('tap.pcm');
    expect(READ_CLEARED_TRANSCRIBER_SESSIONS).toBe('SELECT session_id::text AS session_id FROM public.session_stt_config ORDER BY session_id');
  });

  it('removes the folders of the named sessions with their taps; another session\'s folder and the host file stay; a session without a folder is not an error', () => {
    const dataDir = dataDirOf();
    const a = scratch(dataDir, A);
    const b = scratch(dataDir, B);
    expect(removeTranscriberScratchOf(dataDir, [A, 'SES-20261010-0009'])).toEqual({ removed: [A], kept: [] });
    expect(existsSync(a)).toBe(false);
    expect(readFileSync(join(b, 'tap.pcm'), 'utf8')).toBe('raw audio');
    expect(existsSync(join(dataDir, '.transcriber', 'host.json'))).toBe(true);
    // Idempotent.
    expect(removeTranscriberScratchOf(dataDir, [A])).toEqual({ removed: [], kept: [] });
  });

  it('CONTAINMENT: a name that is no session ID, a folder that is a link, and a sessions folder that is a link remove nothing and are reported; a link is never followed', () => {
    const dataDir = dataDirOf();
    const outside = join(dataDir, '..', 'outside');
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'keep.txt'), 'kept');
    symlinkSync(outside, join(dataDir, '.transcriber', 'sessions', A));
    expect(removeTranscriberScratchOf(dataDir, [A, '..', '../outside', 'SES-1/..'])).toEqual({
      removed: [],
      kept: [
        { sessionId: A, reason: 'NOT_A_DIRECTORY' },
        { sessionId: '..', reason: 'SESSION_ID_INVALID' },
        { sessionId: '../outside', reason: 'SESSION_ID_INVALID' },
        { sessionId: 'SES-1/..', reason: 'SESSION_ID_INVALID' },
      ],
    });
    expect(readFileSync(join(outside, 'keep.txt'), 'utf8')).toBe('kept');

    const linked = dataDirOf();
    rmSync(join(linked, '.transcriber', 'sessions'), { recursive: true });
    mkdirSync(join(outside, B), { recursive: true });
    writeFileSync(join(outside, B, 'tap.pcm'), 'raw audio');
    symlinkSync(outside, join(linked, '.transcriber', 'sessions'));
    expect(removeTranscriberScratchOf(linked, [B])).toEqual({ removed: [], kept: [{ sessionId: B, reason: 'ROOT_NOT_A_DIRECTORY' }] });
    expect(existsSync(join(outside, B, 'tap.pcm'))).toBe(true);
  });

  it('a data directory without a transcriber folder: nothing to do, nothing reported', () => {
    expect(removeTranscriberScratchOf(join(base, 'never-made'), [A])).toEqual({ removed: [], kept: [] });
  });
});

// Fix pass F-M7c (item 3 (i); ruling D180): the reset of ONE database removes the scratch of ITS sessions from ITS media store root only.
describe('D180: two databases on one data directory, the SAME session ID', () => {
  it('the reset of one removes its own scratch; the folder of the other database\'s session of that ID - which may be recording - is untouched', () => {
    const data = dataDirOf();
    const rootA = join(data, 'media', 'dems_lane_1', 'sessions');
    const rootB = join(data, 'media', 'dems_lane_2', 'sessions');
    const a = scratch(rootA, A);
    const b = scratch(rootB, A);
    // What an earlier build left under the shared data directory is not this reset's either.
    const old = join(data, 'transcriber', 'sessions', A);
    mkdirSync(old, { recursive: true });
    writeFileSync(join(old, 'tap.pcm'), 'old');
    expect(removeTranscriberScratchOf(rootA, [A])).toEqual({ removed: [A], kept: [] });
    expect(existsSync(a)).toBe(false);
    expect(readFileSync(join(b, 'tap.pcm'), 'utf8')).toBe('raw audio');
    expect(readFileSync(join(old, 'tap.pcm'), 'utf8')).toBe('old');
  });
});
