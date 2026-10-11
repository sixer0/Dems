// Tidy pass F-Y, items 3 and 4: what the capture facts of a session hold since this pass, and where
// manifest field 40 (`tracks[].clockOffsetMs`) comes from.
//
//   syncLevel              per camera file: the durability level the worker stated with its first
//                          durable fragment (ruling D188: NOT a manifest field);
//   measuredClockOffsetMs  per camera: the offset the WORKER measured when it anchored the camera
//                          (camera clock minus Core clock). Field 40 is this value; the adapter's
//                          report (`clockOffsetMs`) is the fallback when the worker reported none.
import { describe, expect, it, afterAll } from 'vitest';
import { READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS, READ_SEAL_SOURCE_ROWS, STAND_INS, createSealSessionReader, type SealCaptureFacts, type SealStateView } from '../../sealing-host/session-reader';
import { parseSessionCaptureFacts, SESSION_CAPTURE_FACTS_FOLDER, readSessionCaptureFacts, removeSessionCaptureFacts, sessionCaptureFactsPath, withCameraEnded, writeSessionCaptureFacts, type SessionCaptureFacts } from '../facts';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SESSION = 'SES-20261010-0118';
const RECORDED_AT = 5_000;
const camera = (extra: Record<string, unknown> = {}) => ({ trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: -7, firstVideo: null, ...extra });
const file = (cameras: unknown[]): string => JSON.stringify({ version: 1, sessionId: SESSION, startRecordedAt: RECORDED_AT, cameras });

describe('the capture facts file', () => {
  it('holds the sync level and the measured clock offset of each camera file', () => {
    expect(parseSessionCaptureFacts(file([camera({ measuredClockOffsetMs: -1_500, syncLevel: 'FSYNC' })]))?.cameras).toEqual([{ trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: -7, measuredClockOffsetMs: -1_500, syncLevel: 'FSYNC', firstVideo: null }]);
    expect(parseSessionCaptureFacts(file([camera({ measuredClockOffsetMs: null, syncLevel: 'F_FULLFSYNC' })]))?.cameras[0]).toMatchObject({ measuredClockOffsetMs: null, syncLevel: 'F_FULLFSYNC' });
  });

  it('a file written before this pass (neither member) is still read: both are null, nothing is made up', () => {
    expect(parseSessionCaptureFacts(file([camera()]))?.cameras).toEqual([{ trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: -7, measuredClockOffsetMs: null, syncLevel: null, firstVideo: null }]);
  });

  it('CONTROL: a member that is there and is no value of its form makes the file unreadable (nothing is repaired)', () => {
    expect(parseSessionCaptureFacts(file([camera({ syncLevel: 'SYNCED_HARD' })]))).toBeNull();
    expect(parseSessionCaptureFacts(file([camera({ syncLevel: 7 })]))).toBeNull();
    expect(parseSessionCaptureFacts(file([camera({ measuredClockOffsetMs: 1.5 })]))).toBeNull();
    expect(parseSessionCaptureFacts(file([camera({ measuredClockOffsetMs: '12' })]))).toBeNull();
  });
});

describe('manifest field 40 comes from the worker\'s measurement, the adapter\'s report is the fallback', () => {
  const session = { id: SESSION, state: 'FINALIZING', evidenceId: 'EV-20261010-0001', createdAt: 1_000, startedAt: 2_000, stoppedAt: 9_000, input: { caseNumber: 'LP/2026/1010-0118', subjectName: 'Test Subject', subjectType: 'SAKSI', investigatorId: 'OPR-001' }, startTimeSource: 'NTP', captureConfig: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'main' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'main' }], mics: [] } } as unknown as SealStateView['session'];
  const view: SealStateView = {
    session,
    device: { id: 'CORE-01', name: 'Core', softwareVersion: '0.2.0', identity: { serialNumber: 'SN-1', hardwareUuid: 'uuid-1' } },
    operators: [{ id: 'OPR-001', displayName: 'Investigator', role: 'INVESTIGATOR' }],
    cameras: [{ id: 'VIDEO-01', deviceId: 'CAM-01', name: 'Camera 1', model: 'm', firmware: 'f' }, { id: 'VIDEO-02', deviceId: 'CAM-02', name: 'Camera 2', model: 'm', firmware: 'f' }],
    time: { source: 'NTP', locked: true },
    captureDevices: { devices: [] },
  };
  const rows: Record<string, unknown[]> = {
    [READ_SEAL_SOURCE_ROWS]: [
      { slot: 'MIC-PRIMARY', device_id: 'MIC-01', adapter_kind: 'FAKE', recorded_at: RECORDED_AT },
      { slot: 'MIC-STANDBY', device_id: 'MIC-02', adapter_kind: 'FAKE', recorded_at: RECORDED_AT },
      { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE', recorded_at: RECORDED_AT },
      { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: 'FAKE', recorded_at: RECORDED_AT },
    ],
    [READ_SEAL_AUDIO_INTERVALS]: [],
    [READ_SEAL_AUDIT_ROWS]: [],
  };
  const field40 = async (cameras: SealCaptureFacts['cameras']): Promise<(number | undefined)[]> => {
    const reader = createSealSessionReader({ state: () => view, db: () => ({ query: async (text: string) => ({ rows: (rows[text] ?? []) as never[] }) }) as never, begin: async () => {}, sttSnapshot: async () => null, captureFacts: async () => ({ sessionId: SESSION, startRecordedAt: RECORDED_AT, cameras }), notice: 'N', timezone: '+07:00' });
    return (await reader.read(SESSION))?.tracks.map((track) => track.clockOffsetMs) ?? [];
  };

  it('a camera 1.5 s behind the Core: field 40 is the measured value, not the adapter\'s; a camera the worker measured nothing of keeps the adapter\'s', async () => {
    expect(
      await field40([
        { trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: -7, measuredClockOffsetMs: -1_500, firstVideo: null },
        { trackId: 'VIDEO-02', deviceId: 'CAM-02', clockOffsetMs: 12, measuredClockOffsetMs: null, firstVideo: null },
      ]),
    ).toEqual([-1_500, 12]);
  });

  it('a measured offset of 0 is a measurement (not "none"); facts of before this pass read as before; neither source: the stand-in', async () => {
    expect(await field40([{ trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: -7, measuredClockOffsetMs: 0, firstVideo: null }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', clockOffsetMs: 12, firstVideo: null }])).toEqual([0, 12]);
    expect(await field40([{ trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: null, measuredClockOffsetMs: null, firstVideo: null }])).toEqual([STAND_INS.clockOffsetMs, STAND_INS.clockOffsetMs]);
  });
});

describe('G89-07 and gate 89 C3: the capture facts file of a sealed session, and a camera given up (wave H, driver A)', () => {
  // Fix wave H, driver A, finding G89-07 (= R88-27 live; gate 89): `.capture-session/<sessionId>.json`
  // survived the seal and the reset, and a new session of the same ID wrote over it.
  // RULED: once the manifest is signed and stored the file is removed (the sealing host calls
  // `removeSessionCaptureFacts` on a SEALED outcome only); a FAILED or pending seal keeps it.

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
});
