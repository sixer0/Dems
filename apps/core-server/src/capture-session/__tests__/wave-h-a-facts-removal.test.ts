// Fix wave H, driver A, finding G89-07 (= R88-27 live; gate 89): `.capture-session/<sessionId>.json`
// survived the seal and the reset, and a new session of the same ID wrote over it.
// RULED: once the manifest is signed and stored the file is removed (the sealing host calls
// `removeSessionCaptureFacts` on a SEALED outcome only); a FAILED or pending seal keeps it.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { SESSION_CAPTURE_FACTS_FOLDER, parseSessionCaptureFacts, readSessionCaptureFacts, removeSessionCaptureFacts, sessionCaptureFactsPath, withCameraEnded, writeSessionCaptureFacts, type SessionCaptureFacts } from '../facts';

const store = mkdtempSync(join(tmpdir(), 'dems-wha-facts-'));
afterAll(() => rmSync(store, { recursive: true, force: true }));
mkdirSync(join(store, SESSION_CAPTURE_FACTS_FOLDER));

const A = 'SES-20261010-0024';
const B = 'SES-20261010-0025';
const factsOf = (sessionId: string): SessionCaptureFacts => ({ version: 1, sessionId, startRecordedAt: 5_000, cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: null, measuredClockOffsetMs: 0, syncLevel: null, firstVideo: null }] });

describe('G89-07: the capture facts file of a sealed session', () => {
  it('is removed, and only it: the file of another session (a failed or pending seal) stays readable (control)', async () => {
    await writeSessionCaptureFacts(sessionCaptureFactsPath(store, A), factsOf(A));
    await writeSessionCaptureFacts(sessionCaptureFactsPath(store, B), factsOf(B));
    expect(await removeSessionCaptureFacts(store, A)).toBe(true);
    expect(existsSync(sessionCaptureFactsPath(store, A))).toBe(false);
    expect(await readSessionCaptureFacts(store, A)).toBeNull();
    // CONTROL: B was not sealed - its facts are what they were.
    expect(await readSessionCaptureFacts(store, B)).toEqual(factsOf(B));
    expect(JSON.parse(readFileSync(sessionCaptureFactsPath(store, B), 'utf8'))).toEqual(factsOf(B));
  });

  it('a session that has none: nothing is removed and that is the answer', async () => {
    expect(await removeSessionCaptureFacts(store, 'SES-20261010-0099')).toBe(false);
  });

  it('a name that is no session ID, or a folder in the place of the file, removes nothing', async () => {
    await expect(removeSessionCaptureFacts(store, '../SES-20261010-0025')).rejects.toThrow('not one a facts file is kept for');
    const folder = sessionCaptureFactsPath(store, 'SES-20261010-0026');
    mkdirSync(folder);
    await expect(removeSessionCaptureFacts(store, 'SES-20261010-0026')).rejects.toThrow('no regular file');
    expect(existsSync(folder)).toBe(true);
    expect(existsSync(sessionCaptureFactsPath(store, B))).toBe(true);
  });
});

// C3 (gate 64 condition C3, gate 89 section 7; ruling D199): the facts file is where the capture side
// hands the seal the per-camera end - which camera was given up, why, and where its file ends.
describe('C3: a camera given up while the session went on', () => {
  const END = { reason: 'CAMERA_CLOCK_OUT_OF_BOUND', at: 1_791_600_000_500, lastDurableFragmentIndex: 3, lastDurableMediaEndMs: 6_000 };

  it('is marked on its camera only, is written and read back, and the FIRST end stands', async () => {
    const marked = withCameraEnded({ ...factsOf(A), cameras: [...factsOf(A).cameras, { trackId: 'VIDEO-02', deviceId: 'CAM-02', clockOffsetMs: null, measuredClockOffsetMs: -1_950, syncLevel: null, firstVideo: null }] }, 'CAM-02', END);
    expect(marked.cameras.map((camera) => [camera.deviceId, camera.ended ?? null])).toEqual([['CAM-01', null], ['CAM-02', END]]);
    await writeSessionCaptureFacts(sessionCaptureFactsPath(store, A), marked);
    expect(await readSessionCaptureFacts(store, A)).toEqual(marked);
    // A later report of the same camera changes nothing: the file ended where it first ended.
    expect(withCameraEnded(marked, 'CAM-02', { ...END, reason: 'CAMERA_STREAM_ENDED', at: END.at + 9_000 })).toBe(marked);
    // A camera that is not of this session, or an end that is no code, changes nothing.
    expect(withCameraEnded(marked, 'CAM-09', END)).toBe(marked);
    expect(withCameraEnded(factsOf(A), 'CAM-01', { ...END, reason: 'the clock of camera 10.0.0.7 is off' })).toEqual(factsOf(A));
    await removeSessionCaptureFacts(store, A);
  });

  it('CONTROL - a file written before this member is read as "not given up"; a member that is there and is not of its form makes the file unreadable', () => {
    const before = JSON.stringify(factsOf(A));
    expect(parseSessionCaptureFacts(before)?.cameras[0]?.ended).toBeUndefined();
    const bad = (ended: unknown): string => JSON.stringify({ ...factsOf(A), cameras: [{ ...factsOf(A).cameras[0], ended }] });
    expect(parseSessionCaptureFacts(bad({ reason: 'CAMERA_CLOCK_OUT_OF_BOUND', at: 5, lastDurableFragmentIndex: null, lastDurableMediaEndMs: null }))?.cameras[0]?.ended).toEqual({ reason: 'CAMERA_CLOCK_OUT_OF_BOUND', at: 5, lastDurableFragmentIndex: null, lastDurableMediaEndMs: null });
    expect(parseSessionCaptureFacts(bad({ reason: 'lower case', at: 5 }))).toBeNull();
    expect(parseSessionCaptureFacts(bad({ reason: 'CAMERA_STREAM_ENDED', at: -1 }))).toBeNull();
    expect(parseSessionCaptureFacts(bad('CAMERA_STREAM_ENDED'))).toBeNull();
  });
});
