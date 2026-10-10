// The parts of the sealing composition that need no database (blueprint row 82b): the seal-time
// cipher over the Core credential store, the session record the seal reads, and what the mount
// builds in each capture mode. The whole composition on a recorded session is the e2e runner of
// this folder (`e2e/seal-e2e.ts`), with the built capture worker.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cameraFilePath } from '@dems/shared/evidence-package';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { buildApp } from '../../app';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { readSessionVideoSampleEntry } from '../../capture-session';
import { coreFragmentOpener } from '../../evidence-verify';
import { SealingError } from '../../sealing';
import { evidenceVerification } from '../../modules/evidence';
import { NO_STT_SNAPSHOT_RECORDED, SEALING_RESUME_BOOT_STEP, STAND_INS, isSttSnapshotNotRecorded, sealingHost, sessionKeyIdOf } from '../index';
import { coreFragmentSealer } from '../session-key';
import { READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS, READ_SEAL_SOURCE_ROWS, createSealSessionReader, type SealStateView } from '../session-reader';

const roots: string[] = [];
const apps: FastifyInstance[] = [];
const fixture = realBootFixture('row82b');
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
afterAll(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
  fixture.remove();
});
const dataDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'dems-row82b-'));
  roots.push(dir);
  return dir;
};

describe('the seal-time cipher over the Core credential store', () => {
  const SESSION = 'SES-20261009-8201';
  const host = () => ({ stages: {}, config: { dataDir: dataDir() } });
  const plain = (seed: number): Uint8Array => Uint8Array.from({ length: 300 }, (_unused, index) => (seed + index * 13) & 255);

  it('makes the session key KID-<sessionId> at the first fragment, opens the same key afterwards, and what it seals opens with the Core\'s one opener to the same bytes', async () => {
    const app = host();
    const sealer = coreFragmentSealer(app);
    const opener = coreFragmentOpener(app);
    expect(opener.hasKey(sessionKeyIdOf(SESSION))).toBe(false);
    const first = sealer.seal(SESSION, { trackId: 'VIDEO-01', seq: 1, byteOffset: 800 }, plain(1)) as Awaited<ReturnType<typeof sealer.seal>>;
    const second = sealer.seal(SESSION, { trackId: 'VIDEO-01', seq: 2, byteOffset: 1_100 }, plain(2)) as Awaited<ReturnType<typeof sealer.seal>>;
    expect(first.keyId).toBe(`KID-${SESSION}`);
    expect(second.keyId).toBe(first.keyId);
    expect(opener.hasKey(first.keyId)).toBe(true);
    expect(first.gcmIv).not.toBe(second.gcmIv);
    expect(Buffer.from(first.ciphertext).equals(Buffer.from(plain(1)))).toBe(false);
    expect(first.ciphertext.byteLength).toBe(300);
    expect(Buffer.from(await opener.open({ trackId: 'VIDEO-01', seq: 1, byteOffset: 800, byteLength: 300, gcmIv: first.gcmIv, gcmTag: first.gcmTag, keyId: first.keyId }, first.ciphertext)).equals(Buffer.from(plain(1)))).toBe(true);
    // CONTROL (AAD, SEC35-10): the same stored bytes under another position do not open.
    expect(() => opener.open({ trackId: 'VIDEO-01', seq: 2, byteOffset: 800, byteLength: 300, gcmIv: first.gcmIv, gcmTag: first.gcmTag, keyId: first.keyId }, first.ciphertext)).toThrow();
    // A sealer built again over the same store (a CLOSE_TRACKS that runs again after a restart) uses the key that is there.
    const again = coreFragmentSealer(app).seal(SESSION, { trackId: 'VIDEO-02', seq: 1, byteOffset: 800 }, plain(3)) as Awaited<ReturnType<typeof sealer.seal>>;
    expect(again.keyId).toBe(first.keyId);
    expect(Buffer.from(await opener.open({ trackId: 'VIDEO-02', seq: 1, byteOffset: 800, byteLength: 300, gcmIv: again.gcmIv, gcmTag: again.gcmTag, keyId: again.keyId }, again.ciphertext)).equals(Buffer.from(plain(3)))).toBe(true);
  });

  it('a Core without a data directory has no store: nothing is sealed (the step fails closed), never a fragment in the clear', () => {
    const sealer = coreFragmentSealer({ stages: {}, config: { dataDir: '/nonexistent/dems-row82b' } });
    expect(() => sealer.seal(SESSION, { trackId: 'VIDEO-01', seq: 1, byteOffset: 800 }, plain(1))).toThrow();
  });
});

describe('the session record the seal reads', () => {
  const SESSION = 'SES-20261009-8202';
  const baseSession = { id: SESSION, state: 'STOPPING', evidenceId: null as string | null, createdAt: 1_000, startedAt: 2_000 as number | null, stoppedAt: 9_000, input: { caseNumber: 'LP/2026/1009-0082', subjectName: 'Test Subject', subjectType: 'SAKSI', investigatorId: 'OPR-001' }, startTimeSource: 'NTP', captureConfig: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'main-1080p25' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'main-1080p25' }] } };
  const view = (session: SealStateView['session']): SealStateView => ({
    session,
    device: { id: 'CORE-01', name: 'Core', softwareVersion: '0.2.0', identity: { serialNumber: 'SN-1', hardwareUuid: 'uuid-1' } },
    operators: [{ id: 'OPR-001', displayName: 'AKP Budi Santoso', role: 'INVESTIGATOR' }],
    cameras: [{ id: 'VIDEO-01', deviceId: 'CAM-01', name: 'Camera 1', model: 'sim-model', firmware: 'sim-fw' }, { id: 'VIDEO-02', deviceId: 'CAM-02', name: 'Camera 2', model: 'sim-model', firmware: 'sim-fw' }],
    time: { source: 'NTP', locked: true },
    captureDevices: { devices: [{ id: 'CAM-01', model: 'FAKE-CAM', firmware: null }] },
  });
  const tables = (overrides: Record<string, unknown[]> = {}) => {
    const asked: string[] = [];
    const rows: Record<string, unknown[]> = {
      [READ_SEAL_SOURCE_ROWS]: [{ slot: 'MIC-PRIMARY', device_id: 'MIC-01', adapter_kind: 'FAKE' }, { slot: 'MIC-STANDBY', device_id: 'MIC-02', adapter_kind: 'FAKE' }, { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE' }, { slot: 'VIDEO-02', device_id: 'CAM-09', adapter_kind: 'FAKE' }],
      [READ_SEAL_AUDIO_INTERVALS]: [{ seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', from_media_ms: '21', to_media_ms: '4021', reason: 'START', switched_by: null }, { seq: 2, mic_device_id: 'MIC-02', role: 'STANDBY', from_media_ms: '4021', to_media_ms: null, reason: 'MANUAL', switched_by: 'OPR-001' }],
      [READ_SEAL_AUDIT_ROWS]: [{ seq: '7', id: 'AUD-000007', at: '2000', type: 'RECORDING_STARTED', category: 'SESSION', severity: 'INFO', actor_id: 'OPR-001', message: 'Recording started', session_id: SESSION, evidence_id: null, device_id: null, details: { a: 1 }, prev_hash: 'p', hash: 'h' }],
      ...overrides,
    };
    return { asked, db: { query: async (text: string, values?: readonly unknown[]) => (asked.push(`${text.split(' FROM ')[1]?.split(' ')[0]}:${String(values?.[0])}`), { rows: (rows[text] ?? []) as never[] }) } };
  };

  it('a session without an evidence ID is moved to FINALIZING first: the ID of the manifest is the engine\'s; every member has its stated source', async () => {
    let session = { ...baseSession };
    const begun: string[] = [];
    const noSnapshot: string[] = [];
    const t = tables();
    const reader = createSealSessionReader({
      state: () => view(session),
      db: () => t.db,
      begin: async (sessionId) => {
        begun.push(sessionId);
        session = { ...session, state: 'FINALIZING', evidenceId: 'EV-20261009-0007' };
      },
      sttSnapshot: async () => null,
      notice: 'NOTICE',
      timezone: '+07:00',
      onNoSttSnapshot: (sessionId) => void noSnapshot.push(sessionId),
    });
    const facts = await reader.read(SESSION);
    expect(begun).toEqual([SESSION]);
    expect(facts).toMatchObject({
      sessionId: SESSION,
      evidenceId: 'EV-20261009-0007',
      caseNumber: 'LP/2026/1009-0082',
      notice: 'NOTICE',
      timezone: '+07:00',
      createdAt: 1_000,
      startedAt: 2_000,
      stoppedAt: 9_000,
      timeSource: { source: 'NTP', state: 'LOCKED', fallbackOrder: ['GNSS', 'NTP', 'RTC'] },
      device: { deviceId: 'CORE-01', name: 'Core', serialNumber: 'SN-1', hardwareUuid: 'uuid-1', softwareVersion: '0.2.0' },
      operator: { investigatorId: 'OPR-001', displayName: 'AKP Budi Santoso', role: 'INVESTIGATOR' },
      subject: { name: 'Test Subject', type: 'SAKSI', authorization: STAND_INS.subjectAuthorization },
      audioIntervals: [
        { seq: 1, micDeviceId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: 4_021, reason: 'START', switchedBy: null },
        { seq: 2, micDeviceId: 'MIC-02', role: 'STANDBY', fromMs: 4_021, toMs: null, reason: 'MANUAL', switchedBy: 'OPR-001' },
      ],
    });
    // The device of a slot is the START record's (VIDEO-02 was recorded from CAM-09), never the selector as it is now.
    expect(facts?.tracks.map((track) => [track.trackId, track.deviceId, track.model, track.firmware, track.profile])).toEqual([['VIDEO-01', 'CAM-01', 'FAKE-CAM', 'sim-fw', 'main-1080p25'], ['VIDEO-02', 'CAM-09', 'sim-model', 'sim-fw', 'main-1080p25']]);
    expect(facts?.tracks.every((track) => track.codec === null && track.avOffsetMs === null && track.firstVideoSamplePts === null && track.firstVideoSampleTimescale === null)).toBe(true);
    // The four rows of the session start go to the builder as they are stored: the classes are its to compute.
    expect(facts?.sourceRows).toEqual([{ slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'FAKE' }, { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'FAKE' }, { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'FAKE' }, { slot: 'VIDEO-02', deviceId: 'CAM-09', adapterKind: 'FAKE' }]);
    expect(Buffer.from(facts!.auditExtract).toString('utf8')).toBe('{"seq":7,"id":"AUD-000007","at":2000,"type":"RECORDING_STARTED","category":"SESSION","severity":"INFO","actorId":"OPR-001","message":"Recording started","sessionId":"SES-20261009-8202","evidenceId":null,"deviceId":null,"details":{"a":1},"prevHash":"p","hash":"h"}\n');
    // No STT snapshot (row 71c): the manifest's field 123 says that NONE WAS RECORDED, never "disabled by configuration", and that is told.
    expect(facts?.sttSnapshot).toEqual(NO_STT_SNAPSHOT_RECORDED);
    expect(facts?.sttSnapshot).toMatchObject({ enabled: true, model: 'not-recorded' });
    expect(isSttSnapshotNotRecorded(facts!.sttSnapshot)).toBe(true);
    expect(noSnapshot).toEqual([SESSION]);
    // No capture facts were asked for: the stand-in of field 40 is written and said (`STAND_INS`).
    expect(facts?.tracks.map((track) => track.clockOffsetMs)).toEqual([STAND_INS.clockOffsetMs, STAND_INS.clockOffsetMs]);
    expect(t.asked).toEqual([`public.session_capture_sources:${SESSION}`, `public.session_audio_intervals:${SESSION}`, `public.audit_log:${SESSION}`]);
  });

  it('a session that has its evidence ID is not moved again, and its own STT snapshot is the one that is sealed', async () => {
    const begun: string[] = [];
    const snapshot = { enabled: false, backend: 'omlx-server' as const, model: 'whisper-large-v3', diarization: true, revision: 4 };
    const reader = createSealSessionReader({ state: () => view({ ...baseSession, state: 'FINALIZING', evidenceId: 'EV-20261009-0003' }), db: () => tables().db, begin: async (id) => void begun.push(id), sttSnapshot: async () => snapshot, notice: 'N', timezone: '+07:00' });
    const facts = await reader.read(SESSION);
    expect(begun).toEqual([]);
    expect(facts).toMatchObject({ evidenceId: 'EV-20261009-0003', sttSnapshot: snapshot });
    expect(isSttSnapshotNotRecorded(facts!.sttSnapshot)).toBe(false);
  });

  it('row 71c: what the capture side reported reaches fields 40, 127 and 128 - joined on the track AND the device of the start record; facts of another session of that ID are not used', async () => {
    const sources = (recordedAt: string) => ({
      [READ_SEAL_SOURCE_ROWS]: [
        { slot: 'MIC-PRIMARY', device_id: 'MIC-01', adapter_kind: 'FAKE', recorded_at: recordedAt },
        { slot: 'MIC-STANDBY', device_id: 'MIC-02', adapter_kind: 'FAKE', recorded_at: recordedAt },
        { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE', recorded_at: recordedAt },
        { slot: 'VIDEO-02', device_id: 'CAM-09', adapter_kind: 'FAKE', recorded_at: recordedAt },
      ],
    });
    const reported = {
      sessionId: SESSION,
      startRecordedAt: 5_000,
      cameras: [
        { trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: -12, firstVideo: { pts: 3_600, timescale: 90_000 } },
        // The facts name CAM-02 for the second track; the START RECORD of the session says CAM-09: not this file's report.
        { trackId: 'VIDEO-02', deviceId: 'CAM-02', clockOffsetMs: 40, firstVideo: { pts: 9_000, timescale: 90_000 } },
      ],
    };
    const foreign: string[] = [];
    const of = (recordedAt: string, facts: typeof reported | null) =>
      createSealSessionReader({ state: () => view({ ...baseSession, state: 'FINALIZING', evidenceId: 'EV-20261009-0004' }), db: () => tables(sources(recordedAt)).db, begin: async () => {}, sttSnapshot: async () => null, captureFacts: async () => facts, notice: 'N', timezone: '+07:00', onForeignCaptureFacts: (id) => void foreign.push(id) });
    const members = (facts: Awaited<ReturnType<ReturnType<typeof of>['read']>>) => facts?.tracks.map((track) => [track.trackId, track.clockOffsetMs, track.firstVideoSamplePts, track.firstVideoSampleTimescale, track.codec, track.avOffsetMs]);

    expect(members(await of('5000', reported).read(SESSION))).toEqual([['VIDEO-01', -12, 3_600, 90_000, null, null], ['VIDEO-02', 0, null, null, null, null]]);
    expect(foreign).toEqual([]);
    // CONTROL: the same facts under the start instant of ANOTHER session of that ID (a reset reuses IDs): none of it is written.
    expect(members(await of('4999', reported).read(SESSION))).toEqual([['VIDEO-01', 0, null, null, null, null], ['VIDEO-02', 0, null, null, null, null]]);
    expect(foreign).toEqual([SESSION]);
    // A session that kept no facts (recorded before this row): the stand-ins, and nothing is told.
    expect(members(await of('5000', null).read(SESSION))).toEqual([['VIDEO-01', 0, null, null, null, null], ['VIDEO-02', 0, null, null, null, null]]);
    expect(foreign).toEqual([SESSION]);
    // A camera whose adapter reported no offset: field 40 is "not null" and holds the stated stand-in; its first sample is still its own.
    expect(members(await of('5000', { ...reported, cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: null as unknown as number, firstVideo: { pts: 1, timescale: 25 } }] }).read(SESSION))).toEqual([['VIDEO-01', 0, 1, 25, null, null], ['VIDEO-02', 0, null, null, null, null]]);
  });

  it('answers null for another session, for none, and for a session that never recorded; throws when the engine gave no evidence ID', async () => {
    const t = tables();
    const of = (session: SealStateView['session'], begin: () => Promise<void> = async () => {}) => createSealSessionReader({ state: () => view(session), db: () => t.db, begin, sttSnapshot: async () => null, notice: 'N', timezone: '+07:00' });
    expect(await of(null).read(SESSION)).toBeNull();
    expect(await of({ ...baseSession, id: 'SES-20261009-9999' }).read(SESSION)).toBeNull();
    expect(await of({ ...baseSession, startedAt: null }).read(SESSION)).toBeNull();
    await expect(of({ ...baseSession }).read(SESSION)).rejects.toThrow(/no evidence ID/);
    expect(t.asked).toEqual([]);
  });

  // Integration pass D9, item 3: field 43 `tracks[].codec` is what each camera file's own init segment says.
  describe('field 43: the video codec is read from the init segment of each camera file', () => {
    const u32 = (value: number): Uint8Array => Uint8Array.of((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
    const text = (value: string): Uint8Array => new TextEncoder().encode(value);
    const box = (type: string, ...payload: Uint8Array[]): Uint8Array => Buffer.concat([u32(8 + payload.reduce((sum, part) => sum + part.length, 0)), text(type), ...payload]);
    /** A generated init segment whose video track has the given sample entry, and one fragment after it. */
    const cameraFile = (entry: string): Uint8Array =>
      Buffer.concat([
        box('ftyp', text('isom'), u32(512), text('isomiso6mp41')),
        box('moov', box('mvhd', new Uint8Array(100)), box('trak', box('tkhd', u32(0), u32(0), u32(0), u32(1), new Uint8Array(68)), box('mdia', box('mdhd', u32(0), u32(0), u32(0), u32(90_000), u32(0), u32(0)), box('hdlr', u32(0), u32(0), text('vide'), new Uint8Array(13)), box('minf', box('stbl', box('stsd', u32(0), u32(1), box(entry, new Uint8Array(78)))))))),
        box('moof', box('mfhd', u32(0), u32(1))),
        box('mdat', new Uint8Array(64)),
      ]);
    const packageWith = (files: Record<string, Uint8Array>): string => {
      const dir = mkdtempSync(join(tmpdir(), 'dems-d9-codec-'));
      roots.push(dir);
      for (const [name, bytes] of Object.entries(files)) {
        mkdirSync(join(dir, name, '..'), { recursive: true });
        writeFileSync(join(dir, name), bytes);
      }
      return dir;
    };
    const readerOver = (dir: string) =>
      createSealSessionReader({ state: () => view({ ...baseSession, state: 'FINALIZING', evidenceId: 'EV-20261009-0005' }), db: () => tables().db, begin: async () => {}, sttSnapshot: async () => null, videoSampleEntry: (_sessionId, trackId) => readSessionVideoSampleEntry(dir, trackId), notice: 'N', timezone: '+07:00' });
    const codecsOf = async (dir: string) => (await readerOver(dir).read(SESSION))?.tracks.map((track) => track.codec);

    it('H.264 (avc1, avc3) is stored as H264 and H.265 (hvc1, hev1) as HEVC, per file - whatever profile the plan asked of the camera', async () => {
      expect(await codecsOf(packageWith({ 'VIDEO-01.mp4': cameraFile('avc1'), 'VIDEO-02.mp4': cameraFile('hvc1') }))).toEqual(['H264', 'HEVC']);
      expect(await codecsOf(packageWith({ 'VIDEO-01.mp4': cameraFile('hev1'), 'VIDEO-02.mp4': cameraFile('avc3') }))).toEqual(['HEVC', 'H264']);
    });

    it('a resumed seal reads the same value from the SEALED camera file once the recording is gone (the init segment is in the clear)', async () => {
      expect(await codecsOf(packageWith({ [cameraFilePath('VIDEO-01')]: cameraFile('avc1'), [cameraFilePath('VIDEO-02')]: cameraFile('avc1') }))).toEqual(['H264', 'H264']);
    });

    it('CONTROL: an init segment whose sample entry has no name here stops the seal with CAMERA_FILE_UNUSABLE - the file and the reason by name, never a guessed codec', async () => {
      const refused = await readerOver(packageWith({ 'VIDEO-01.mp4': cameraFile('avc1'), 'VIDEO-02.mp4': cameraFile('vp09') }))
        .read(SESSION)
        .then(
          () => null,
          (error: unknown) => error,
        );
      expect(refused).toBeInstanceOf(SealingError);
      expect(refused).toMatchObject({ code: 'CAMERA_FILE_UNUSABLE', detail: { trackId: 'VIDEO-02', reason: 'VIDEO_SAMPLE_ENTRY_UNKNOWN', sampleEntry: 'vp09' } });
    });

    it('a camera file that is not there, or has no init segment, leaves the field null: CLOSE_TRACKS names that file (MISSING / NO_INIT_SEGMENT); a reader that is given no port asks nothing', async () => {
      expect(await codecsOf(packageWith({ 'VIDEO-01.mp4': cameraFile('avc1') }))).toEqual(['H264', null]);
      expect(await codecsOf(packageWith({ 'VIDEO-01.mp4': cameraFile('avc1'), 'VIDEO-02.mp4': new Uint8Array(0) }))).toEqual(['H264', null]);
    });
  });
});

describe('the mount in a real capture mode (no database, nothing recorded)', () => {
  it('REAL_DEVELOPMENT: the host is composed and the verification of real packages is provided (CONTROL of the mode rule: the SIMULATED case of modules/sealing)', async () => {
    const failure = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
    const pool = { connect: async () => Promise.reject(failure), query: async () => Promise.reject(failure), on: () => pool, end: async () => {} };
    const app = buildApp({
      config: unitTestConfig({ dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('worker-row82b', 'capture-worker/0.4.0') }),
      createPool: () => pool as unknown as Pool,
      logStream: captureLog().stream,
    });
    apps.push(app);
    await app.ready();
    expect(sealingHost(app).mounted).toBe(true);
    expect(sealingHost(app).controller()).not.toBeNull();
    expect(sealingHost(app).lastOutcome()).toBeNull();
    expect(evidenceVerification(app).current()).not.toBeNull();
    // An item that is not a REAL v2 package is not the provided verification's: it answers null and the hosted action verifies it.
    app.seams.replace('engine', { state: () => ({ session: null, evidence: [{ id: 'EV-20260930-0004', integritySource: 'SIMULATED', manifestVersion: 1 }] }) } as never);
    expect(await evidenceVerification(app).current()?.verify({ kind: 'ANONYMOUS', retiredDeviceId: null }, 'EV-20260930-0004')).toBeNull();
    expect(SEALING_RESUME_BOOT_STEP).toBe('sealing.resume');
  });
});
