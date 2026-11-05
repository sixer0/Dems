// The parts of the sealing composition that need no database (blueprint row 82b): the seal-time
// cipher over the Core credential store, the session record the seal reads, and what the mount
// builds in each capture mode. The whole composition on a recorded session is the e2e runner of
// this folder (`e2e/seal-e2e.ts`), with the built capture worker.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cameraFilePath, PackageFile, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { buildApp } from '../../app';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { readSessionVideoSampleEntry } from '../../capture-session';
import { coreFragmentOpener, corePorts } from '../../evidence-verify';
import { SealingError } from '../../sealing';
import { evidenceVerification } from '../../modules/evidence';
import { NO_STT_SNAPSHOT_RECORDED, SEALING_RESUME_BOOT_STEP, STAND_INS, isSttSnapshotNotRecorded, sealingHost, sessionKeyIdOf } from '../index';
import { coreFragmentSealer } from '../session-key';
import { MANIFEST_HOST_PROFILE_NOT_ASKED_PLATFORMS } from '@dems/shared/evidence-package';
import { PRODUCTION_PLATFORMS, hostProfileStatementOf } from '../../capture/boot/checks';
import { READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS, READ_SEAL_SOURCE_ROWS, SOURCE_WORDS, audioRestartGapsOf, hostProfileNotAskedOf, videoAbsencesOf, createSealSessionReader, type SealStateView, type SealCaptureFacts, CORE_TIME_SOURCE, NOT_CONFIGURED, NOT_REPORTED } from '../session-reader';
import { CORE_SERVER_VERSION } from '../../version';
import { verifyPackageV2 } from '@dems/shared/evidence-verify';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings } from '../../sealing/__tests__/pipeline-support';
import { DEVICE_IDENTITY, SOFTWARE_VERSION, createSim } from '@dems/shared/sim';

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
      [READ_SEAL_SOURCE_ROWS]: [{ slot: 'MIC-01', device_id: 'MIC-01', adapter_kind: 'FAKE' }, { slot: 'MIC-02', device_id: 'MIC-02', adapter_kind: 'FAKE' }, { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE' }, { slot: 'VIDEO-02', device_id: 'CAM-09', adapter_kind: 'FAKE' }],
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
      // Closing pass Z1 (D207): fields 20 / 21 are the configured installation identity, not the state's stored record (`CORE-01`, `Core`).
      identity: { deviceId: 'DEMS-JKT-07', name: 'Ruang Pemeriksaan 3' },
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
      // Fix wave H driver A (G89-01): the Core's own clock, build and (not configured) identity - never the hosted simulator's
      // `time` slice (NTP / locked here), `startTimeSource`, `device.identity` (SN-1, uuid-1) or `device.softwareVersion`.
      timeSource: { source: 'RTC', state: 'HOST_SYSTEM_CLOCK', fallbackOrder: [] },
      device: { deviceId: 'DEMS-JKT-07', name: 'Ruang Pemeriksaan 3', serialNumber: 'NOT_CONFIGURED', hardwareUuid: 'NOT_CONFIGURED', softwareVersion: CORE_SERVER_VERSION },
      operator: { investigatorId: 'OPR-001', displayName: 'AKP Budi Santoso', role: 'INVESTIGATOR' },
      subject: { name: 'Test Subject', type: 'SAKSI', authorization: STAND_INS.subjectAuthorization },
      audioIntervals: [
        { seq: 1, micDeviceId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: 4_021, reason: 'START', switchedBy: null },
        { seq: 2, micDeviceId: 'MIC-02', role: 'STANDBY', fromMs: 4_021, toMs: null, reason: 'MANUAL', switchedBy: 'OPR-001' },
      ],
    });
    // The device of a slot is the START record's (VIDEO-02 was recorded from CAM-09), never the selector as it is now.
    expect(facts?.tracks.map((track) => [track.trackId, track.deviceId, track.model, track.firmware, track.profile])).toEqual([['VIDEO-01', 'CAM-01', SOURCE_WORDS.FAKE.model, SOURCE_WORDS.FAKE.firmware, 'main-1080p25'], ['VIDEO-02', 'CAM-09', SOURCE_WORDS.FAKE.model, SOURCE_WORDS.FAKE.firmware, 'main-1080p25']]);
    // G89-01: both slots are generated sources (adapter FAKE in the START rows): neither the registry's label ('FAKE-CAM') nor the simulator camera's model / firmware ('sim-model', 'sim-fw') is a fact of the source.
    expect(facts?.tracks.every((track) => track.codec === null && track.avOffsetMs === null && track.firstVideoSamplePts === null && track.firstVideoSampleTimescale === null)).toBe(true);
    // The four rows of the session start go to the builder as they are stored: the classes are its to compute.
    expect(facts?.sourceRows).toEqual([{ slot: 'MIC-01', deviceId: 'MIC-01', adapterKind: 'FAKE' }, { slot: 'MIC-02', deviceId: 'MIC-02', adapterKind: 'FAKE' }, { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'FAKE' }, { slot: 'VIDEO-02', deviceId: 'CAM-09', adapterKind: 'FAKE' }]);
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

  // KD-37 (audit row 153; S5 §5.3 item 7): the fixtures name the D61 slots MIC-01..04 (0040 renamed the two roles); a 4+4
  // session's eight start rows reach the builder as stored, so the pipeline can pair each AUDIO-0N with the device of MIC-0N.
  it('KD-37: a 4+4 session - four cameras and four pair microphones on MIC-01..04 - hands its EIGHT start rows on as stored, and one track per camera', async () => {
    const eight = [
      ...['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'].map((slot, index) => ({ slot, device_id: `CAM-0${String(index + 3)}`, adapter_kind: 'FAKE' })),
      ...['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'].map((slot, index) => ({ slot, device_id: `MIC-0${String(index + 3)}`, adapter_kind: 'FAKE' })),
    ];
    const t = tables({ [READ_SEAL_SOURCE_ROWS]: eight, [READ_SEAL_AUDIO_INTERVALS]: [{ seq: 1, mic_device_id: 'MIC-03', role: 'PRIMARY', from_media_ms: '21', to_media_ms: null, reason: 'START', switched_by: null }] });
    const reader = createSealSessionReader({ state: () => view({ ...baseSession, state: 'FINALIZING', evidenceId: 'EV-20261009-0004' }), db: () => t.db, begin: async () => undefined, sttSnapshot: async () => null, notice: 'N', timezone: '+07:00' });
    const facts = await reader.read(SESSION);
    expect(facts?.sourceRows).toEqual(eight.map((row) => ({ slot: row.slot, deviceId: row.device_id, adapterKind: row.adapter_kind })));
    expect(facts?.tracks.map((track) => [track.trackId, track.deviceId])).toEqual([['VIDEO-01', 'CAM-03'], ['VIDEO-02', 'CAM-04'], ['VIDEO-03', 'CAM-05'], ['VIDEO-04', 'CAM-06']]);
    expect(facts?.audioIntervals).toEqual([{ seq: 1, micDeviceId: 'MIC-03', role: 'PRIMARY', fromMs: 21, toMs: null, reason: 'START', switchedBy: null }]);
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
        { slot: 'MIC-01', device_id: 'MIC-01', adapter_kind: 'FAKE', recorded_at: recordedAt },
        { slot: 'MIC-02', device_id: 'MIC-02', adapter_kind: 'FAKE', recorded_at: recordedAt },
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

  // Fix pass F-M7b (R88-02 (a)): the retry ON DEMAND the recovery operation asks for.
  it('retryFailedSeal: true ONLY for the open session that is FINALIZING with a FAILED sealing step; false for every other session and state (controls)', async () => {
    const failure = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
    const pool = { connect: async () => Promise.reject(failure), query: async () => Promise.reject(failure), on: () => pool, end: async () => {} };
    const app = buildApp({
      config: unitTestConfig({ dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('worker-fm7b', 'capture-worker/0.4.0') }),
      createPool: () => pool as unknown as Pool,
      logStream: captureLog().stream,
    });
    apps.push(app);
    await app.ready();
    const host = sealingHost(app);
    const sessionOf = (state: string, steps: string[]) => ({ id: 'SES-20261010-0007', state, stoppedAt: 1, fault: null, finalization: { steps: steps.map((status, index) => ({ id: `STEP-${index}`, status })) } });
    const engine = (session: unknown) => app.seams.replace('engine', { state: () => ({ session, evidence: [] }) } as never);
    engine(null);
    expect(host.retryFailedSeal('SES-20261010-0007')).toBe(false);
    engine(sessionOf('FINALIZING', ['done', 'active', 'pending']));
    expect(host.retryFailedSeal('SES-20261010-0007')).toBe(false);
    engine(sessionOf('RECORDING', ['error']));
    expect(host.retryFailedSeal('SES-20261010-0007')).toBe(false);
    engine(sessionOf('FINALIZING', ['done', 'error', 'pending']));
    expect(host.retryFailedSeal('SES-20261010-0001')).toBe(false);
    // THE CASE: the seal is started again in the background (here it cannot reach a database: the run rejects and is logged, the answer stands).
    expect(host.resumedSeal('SES-20261010-0007')).toBe(false);
    expect(host.retryFailedSeal('SES-20261010-0007')).toBe(true);
    // Fix wave L (re-check 75 findings G75d-04, G75d-09 (a)): the retry ON DEMAND is no resume - `resumed` of operation 83 says
    // "a START of the Core ran the seal again" and a client words it "Resumed after restart". Before the fix this read true with no restart.
    expect(host.resumedSeal('SES-20261010-0007')).toBe(false);
    await host.settled();
    expect(host.resumedSeal('SES-20261010-0007')).toBe(false);
    // In Simulated mode there is no host: the recovery operation does what it always did.
    expect(sealingHost({ stages: {} }).retryFailedSeal('SES-20261010-0007')).toBe(false);
  });

  // Fix pass F-M7c (ruling D186 (8)): the retry on demand is AUDITED - who asked, which session, the cause being retried.
  it('retryFailedSeal writes ONE audit note through the engine door with the operator who asked; a refused retry (control) writes none', async () => {
    const failure = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
    const pool = { connect: async () => Promise.reject(failure), query: async () => Promise.reject(failure), on: () => pool, end: async () => {} };
    const app = buildApp({
      config: unitTestConfig({ dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('worker-fm7c', 'capture-worker/0.4.0') }),
      createPool: () => pool as unknown as Pool,
      logStream: captureLog().stream,
    });
    apps.push(app);
    await app.ready();
    const host = sealingHost(app);
    const notes: unknown[] = [];
    const doors = { noteSealedPlaintextKept: async () => ({ value: false }), raiseSealBlocked: async () => ({ value: false }), resolveSealBlocked: async () => ({ value: false }), noteSealRetryOnDemand: async (note: unknown) => (notes.push(note), { value: true }) };
    const engine = (session: unknown) => app.seams.replace('engine', { state: () => ({ session, evidence: [], alerts: [] }), ...doors } as never);
    const sessionOf = (state: string, steps: string[]) => ({ id: 'SES-20261010-0008', state, stoppedAt: 1, fault: null, finalization: { steps: steps.map((status, index) => ({ id: `STEP-${index}`, status })) } });
    // Pass F-Z: the caller hands the principal on as it is; the host reads who asked.
    const asked = { kind: 'OPERATOR', operatorId: 'OP-0003', sessionId: 'AS-1', deviceId: null, role: 'INVESTIGATOR', permissions: [] } as never;
    // CONTROL: no failed step - no retry, no audit note.
    engine(sessionOf('FINALIZING', ['done', 'active']));
    expect(host.retryFailedSeal('SES-20261010-0008', asked)).toBe(false);
    await host.settled();
    expect(notes).toEqual([]);
    engine(sessionOf('FINALIZING', ['done', 'error', 'pending']));
    expect(host.retryFailedSeal('SES-20261010-0008', asked)).toBe(true);
    await host.settled();
    // The journal cannot be read here (no database): the row is written all the same, without a cause - never skipped.
    expect(notes).toEqual([{ sessionId: 'SES-20261010-0008', actorId: 'OP-0003', cause: null, step: null }]);
  });

  // Task 4 row 226c (decision C81): THE WIRING of the one held signer. The behaviour is proved where it can run - the hold in
  // `capture/signer/__tests__/sign-time-guard.test.ts` (with the boot's door), the running Core in
  // `evidence-export/__tests__/export-trust-list.db.test.ts`; this holds the composition to it: no taker gets the kept
  // signer but through the hold, and the three takers are the seal, the export jobs and the transcript revisions.
  it('row 226c: the kept signer is handed out ONLY through the hold of the boot`s key and the Core`s clock - to the seal, the export jobs and the transcript revisions', () => {
    const source = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
    const code = source.replace(/^\s*\/\/.*$/gm, '');
    // The one load, inside the one hold; the key id is the boot's door, the clock is the Core's.
    expect(code).toContain('return signerHeldToBoot((signing ??= loadSealingSigner({ dataDir: app.config.dataDir, now: now() })), hold);');
    expect(code).toContain('const hold = { bootKeyId: captureBootControl(app).judgedSigningKey(), now };');
    expect(code.match(/\bloadSealingSigner\(/g)).toHaveLength(1);
    expect(code.match(/\bsignerHeldToBoot\(/g)).toHaveLength(1);
    // The kept signer itself is read in ONE more place: to drop a signer of a key the boot did not judge.
    expect(code).toContain('if (signing !== null && hold.bootKeyId !== null && signing.signer.keyId !== hold.bootKeyId) signing = null;');
    expect(code.match(/\bsigning\.(?:signer|certificate)\b/g)).toEqual(['signing.signer']);
    // The three takers.
    expect(code).toMatch(/get signing\(\) \{\n\s+return signingNow\(\);\n\s+\},/);
    expect(code).toContain('provideCoreEvidenceExport(app, { signer: signingNow });');
    expect(code).toContain('provideRevisionSigner(app, () => signingNow());');
    expect(code.match(/\bsigningNow\(\)|\bsigningNow\b(?=\s*\}\))/g)).toHaveLength(3);
  });

  // Task 4 row 226d (review 230 caution R-7): THE WIRING of the null door. The behaviour - the real boot step's door, null before
  // the pass, after a refused boot and on key seams - is proved in `capture/signer/__tests__/sign-time-guard.test.ts` with the
  // function this unit calls; this holds the composition to it: the refusal comes BEFORE the one load and outside its `try`,
  // and the unit is mounted in the two real operations only (where a boot judges a key).
  it('row 226d (R-7): a null door refuses the signer BEFORE anything of the store is loaded, in the one place every taker goes through; SIMULATED is not mounted here', () => {
    const source = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
    const code = source.replace(/^\s*\/\/.*$/gm, '');
    const taker = code.slice(code.indexOf('const signingNow = '), code.indexOf('const profileDiffersTold'));
    const at = (needle: string): number => taker.indexOf(needle);
    const order = [at('const hold = { bootKeyId: captureBootControl(app).judgedSigningKey(), now };'), at('refuseHoldWithoutBootKey(hold);'), at('try {'), at('loadSealingSigner(')];
    expect(order.every((place) => place >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
    expect(code.match(/\brefuseHoldWithoutBootKey\(/g)).toHaveLength(1);
    // Where no boot judges a key this unit does not exist: the mount answers the inert host before anything else is built.
    const mount = code.slice(code.indexOf('export function mountSealingHost'), code.indexOf('const signingNow = '));
    expect(mount).toMatch(/const operation = captureOperationOf\(app\.config\);\n\s+if \(operation === CaptureOperation\.SIMULATED\) \{\n\s+hosts\.set\(app\.stages, INERT\);\n\s+return INERT;\n\s+\}/);
    // SIMULATED and the seed command stay as review 230 accepted them, and the place says so.
    const said = source.slice(source.indexOf('THE NULL DOOR REFUSES'), source.indexOf('const signingNow = '));
    expect(said).toContain('LEFT AS REVIEW 230 ACCEPTED THEM');
    expect(said).toContain('capture mode `simulated`');
    expect(said).toContain('demo-seed/seed-hook.ts');
  });
});

describe('gate 89 C3: the camera end in the package and in the reader (wave H, driver A)', () => {
  // Fix wave H driver A, C3 (gate 64 condition C3 = review R63-16; gate 89 section 7: "does a sealed
  // package mark a track whose camera was given up by the clock floor? NO"; decisions D199, D202).
  //
  // RULED: from the instant a camera is given up, its track is INTERRUPTED, stated with the EXISTING
  // members - no new manifest field:
  //   files[].fragments[].interrupted (field 73)   true on every fragment record of THAT file;
  //   sealing.steps[CLOSE_TRACKS].checkpoint       `endedTracks: "VIDEO-02:<reason>"`, under the signature.
  // The session itself is not made an interrupted one: the other camera recorded to the operator's stop.

  afterAll(() => {
    removeRecordings();
    removePackages();
  });

  async function sealed(cameraEnds?: readonly { trackId: string; reason: string }[]): Promise<{ manifest: ManifestV2; pass: [boolean, string] }> {
    const recording = recordSession();
    const h = harnessOf(recording);
    if (cameraEnds !== undefined) h.facts = { ...h.facts, cameraEnds };
    const outcome = await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    if (outcome.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(outcome)}`);
    const manifest = parseManifestV2(JSON.parse(readFileSync(recording.path(PackageFile.MANIFEST), 'utf8')));
    const result = await verifyPackageV2(corePorts(recording.packageDir, recording.opener, 256), { plaintext: 'REQUIRED', expected: h.anchors() });
    return { manifest, pass: [result.ok, result.overall] };
  }
  const flags = (manifest: ManifestV2, trackId: string): boolean[] => [...new Set(manifest.files.find((file) => file.trackId === trackId)?.fragments.map((fragment) => fragment.interrupted))];
  const closeTracks = (manifest: ManifestV2) => manifest.sealing.steps.find((step) => step.step === 'CLOSE_TRACKS')?.checkpoint ?? {};

  describe('C3: the package of a session one of whose cameras was given up', () => {
    it('marks THAT track interrupted on every fragment record and names the cause in the signed CLOSE_TRACKS record; the other track and the session are not interrupted; the package verifies', async () => {
      const { manifest, pass } = await sealed([{ trackId: 'VIDEO-02', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' }]);
      expect(flags(manifest, 'VIDEO-02')).toEqual([true]);
      expect(flags(manifest, 'VIDEO-01')).toEqual([false]);
      expect(closeTracks(manifest)).toMatchObject({ endedTracks: 'VIDEO-02:CAMERA_CLOCK_OUT_OF_BOUND', interrupted: false });
      expect(manifest.timeline.interrupted).toBe(false);
      expect(manifest.timeline.stoppedAt).not.toBeNull();
      expect(pass).toEqual([true, 'PASS']);
    });

    it('both cameras given up: both named, in track order', async () => {
      const { manifest } = await sealed([{ trackId: 'VIDEO-02', reason: 'CAMERA_STREAM_ENDED' }, { trackId: 'VIDEO-01', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' }]);
      expect(closeTracks(manifest)).toMatchObject({ endedTracks: 'VIDEO-01:CAMERA_CLOCK_OUT_OF_BOUND,VIDEO-02:CAMERA_STREAM_ENDED' });
      expect([flags(manifest, 'VIDEO-01'), flags(manifest, 'VIDEO-02')]).toEqual([[true], [true]]);
    });

    it('CONTROL - no camera was given up: no fragment says interrupted and the CLOSE_TRACKS record has no `endedTracks`; a reason that is no code is not written', async () => {
      const plain = await sealed();
      expect([flags(plain.manifest, 'VIDEO-01'), flags(plain.manifest, 'VIDEO-02')]).toEqual([[false], [false]]);
      expect('endedTracks' in closeTracks(plain.manifest)).toBe(false);
      expect(plain.pass).toEqual([true, 'PASS']);
      const sentence = await sealed([{ trackId: 'VIDEO-02', reason: 'the camera at 10.0.0.7 lost its clock' }]);
      expect('endedTracks' in closeTracks(sentence.manifest)).toBe(false);
    });
  });

  describe('C3: the reader takes the camera end from the capture facts of THIS session, by track and device', () => {
    const SESSION = 'SES-20261010-0130';
    const view: SealStateView = {
      session: { id: SESSION, state: 'FINALIZING', evidenceId: 'EV-20261010-0130', createdAt: 1_000, startedAt: 2_000, stoppedAt: 9_000, input: { caseNumber: 'LP/2026/1010-0130', subjectName: 'Test Subject', subjectType: 'SAKSI', investigatorId: 'OPR-001' }, captureConfig: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'p' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'p' }] } },
      device: { id: 'CORE-01', name: 'Core' },
      operators: [{ id: 'OPR-001', displayName: 'AKP Budi Santoso', role: 'INVESTIGATOR' }],
      cameras: [{ id: 'VIDEO-01', name: 'Camera 1' }, { id: 'VIDEO-02', name: 'Camera 2' }],
      captureDevices: { devices: [] },
    };
    const read = async (cameras: SealCaptureFacts['cameras']) => {
      const rows: Record<string, unknown[]> = {
        [READ_SEAL_SOURCE_ROWS]: [{ slot: 'MIC-01', device_id: 'MIC-01', adapter_kind: 'FAKE', recorded_at: '5000' }, { slot: 'MIC-02', device_id: 'MIC-02', adapter_kind: 'FAKE', recorded_at: '5000' }, { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE', recorded_at: '5000' }, { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: 'FAKE', recorded_at: '5000' }],
        [READ_SEAL_AUDIO_INTERVALS]: [],
        [READ_SEAL_AUDIT_ROWS]: [],
      };
      const reader = createSealSessionReader({ state: () => view, db: () => ({ query: async (text: string) => ({ rows: (rows[text] ?? []) as never[] }) }), begin: async () => undefined, sttSnapshot: async () => null, captureFacts: async () => ({ sessionId: SESSION, startRecordedAt: 5_000, cameras }), notice: 'N', timezone: '+07:00' });
      return (await reader.read(SESSION))?.cameraEnds;
    };
    const camera = (trackId: string, deviceId: string, ended?: { reason: string } | null) => ({ trackId, deviceId, clockOffsetMs: null, firstVideo: null, ...(ended === undefined ? {} : { ended }) });

    it('a camera whose facts say `ended` is a camera end of its track; a report of ANOTHER device under that track is not this file\'s; none: the member is absent', async () => {
      expect(await read([camera('VIDEO-01', 'CAM-01'), camera('VIDEO-02', 'CAM-02', { reason: 'CAMERA_CLOCK_OUT_OF_BOUND' })])).toEqual([{ trackId: 'VIDEO-02', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' }]);
      expect(await read([camera('VIDEO-01', 'CAM-01'), camera('VIDEO-02', 'CAM-09', { reason: 'CAMERA_STREAM_ENDED' })])).toBeUndefined();
      expect(await read([camera('VIDEO-01', 'CAM-01', null), camera('VIDEO-02', 'CAM-02')])).toBeUndefined();
    });
  });
});

describe('G89-01: the manifest of a real session states only facts (wave H, driver A)', () => {
  // Fix wave H, driver A, finding G89-01 (gate 89 section 6, B-2; ruling D199): the SIGNED manifest of
  // a real-capture package stated values of the simulator's DATASET as facts - time source `GNSS` /
  // `LOCKED`, the device serial and hardware UUID, `softwareVersion 2.4.1` (the Core is 0.2.0), the
  // model and firmware of a camera that is a generated test source.
  //
  // RULED: a real-capture manifest carries only facts the Core has. The reader is fed the engine's
  // state AS THE SEED MAKES IT (the simulator's own initial state: every dataset constant is in it)
  // and what it hands to the seal is held against those constants. Then such a package is sealed by
  // the pipeline and verified.
  //
  // CONTROLS: a real camera (adapter ONVIF_RTSP) whose registry row holds what its adapter reported
  // states THAT; one whose row holds nothing says so; the values that ARE the Core's stay.

  afterAll(() => {
    removeRecordings();
    removePackages();
  });

  const SESSION = 'SES-20261010-8901';
  /** The state of a Core as its seed makes it: the simulator's own initial state, dataset constants and all. */
  const seeded = createSim({ storage: null, authStorage: null, scheduler: () => () => undefined }).store.getState();
  /** Every value of the simulator's dataset the gate found under the signature. */
  const DATASET = {
    serialNumber: DEVICE_IDENTITY.serialNumber,
    hardwareUuid: DEVICE_IDENTITY.hardwareUuid,
    softwareVersion: SOFTWARE_VERSION,
    cameraModel: seeded.captureDevices.devices.find((device) => device.id === 'CAM-01')?.model ?? '',
    simulatorCameraModel: seeded.cameras[0]!.model,
    cameraFirmware: seeded.cameras[0]!.firmware,
    timeSource: seeded.time.source,
  };

  function viewOf(devices: SealStateView['captureDevices']['devices'] = seeded.captureDevices.devices): SealStateView {
    return {
      ...seeded,
      session: {
        id: SESSION,
        state: 'FINALIZING',
        evidenceId: 'EV-20261010-0089',
        createdAt: 1_000,
        startedAt: 2_000,
        stoppedAt: 9_000,
        input: { caseNumber: 'LP/2026/1010-0089', subjectName: 'Test Subject', subjectType: 'SAKSI', investigatorId: seeded.operators[0]!.id },
        // What the session machine wrote at the start: the simulator's time source.
        startTimeSource: seeded.time.source,
        captureConfig: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P30' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_720P30' }] },
      },
      captureDevices: { devices },
    } as SealStateView;
  }

  const sources = (video1: string, video2: string) => [
    { slot: 'MIC-01', device_id: 'MIC-01', adapter_kind: 'FAKE' },
    { slot: 'MIC-02', device_id: 'MIC-02', adapter_kind: 'FAKE' },
    { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: video1 },
    { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: video2 },
  ];

  async function read(view: SealStateView, sourceRows: unknown[], intervalRows: unknown[] = [{ seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', from_media_ms: '21', to_media_ms: null, reason: 'START', switched_by: null }]) {
    const rows: Record<string, unknown[]> = { [READ_SEAL_SOURCE_ROWS]: sourceRows, [READ_SEAL_AUDIO_INTERVALS]: intervalRows, [READ_SEAL_AUDIT_ROWS]: [] };
    const reader = createSealSessionReader({
      state: () => view,
      db: () => ({ query: async (text: string) => ({ rows: (rows[text] ?? []) as never[] }) }),
      begin: async () => undefined,
      sttSnapshot: async () => null,
      notice: 'NOTICE',
      timezone: '+07:00',
    });
    const facts = await reader.read(SESSION);
    if (facts === null) throw new Error('the session was not read');
    return facts;
  }

  describe('task 4 row 191b: the interval rows of a capture worker that was replaced (decision C57)', () => {
    const row = (seq: number, mic: string, role: string, from: string, to: string | null, reason: string, by: string | null = null) => ({ seq, mic_device_id: mic, role, from_media_ms: from, to_media_ms: to, reason, switched_by: by });
    const spans = (facts: Awaited<ReturnType<typeof read>>) => facts.audioIntervals.map((interval) => [interval.seq, interval.micDeviceId, interval.reason, interval.fromMs, interval.toMs]);
    /** The manifest's own rule of §B.5 (`manifest.ts`): no interval starts before the previous one ended, only the last is open. */
    const forward = (facts: Awaited<ReturnType<typeof read>>) => facts.audioIntervals.every((interval, index, all) => (index === 0 || (all[index - 1]?.toMs ?? Number.NaN) <= interval.fromMs) && (interval.toMs !== null || index === all.length - 1));

    it('BOTH rows are in what the seal reads - the audio source began twice, no continuity is claimed; the earlier worker\'s row claims no part of the file (0..0), also when the later worker\'s audio begins EARLIER in its file than the earlier worker\'s did in its own (31 < 42: stated as stored, the manifest would be refused)', async () => {
      const facts = await read(viewOf(), sources('FAKE', 'FAKE'), [row(1, 'MIC-01', 'PRIMARY', '42', '42', 'START'), row(2, 'MIC-01', 'PRIMARY', '31', null, 'START')]);
      expect(spans(facts)).toEqual([
        [1, 'MIC-01', 'START', 0, 0],
        [2, 'MIC-01', 'START', 31, null],
      ]);
      expect(forward(facts)).toBe(true);
    });

    it('a SWITCH made before the restart is of the earlier worker too: every row before the LAST start row is 0..0; the rows after it are as stored', async () => {
      const facts = await read(viewOf(), sources('FAKE', 'FAKE'), [row(1, 'MIC-01', 'PRIMARY', '21', '1500', 'START'), row(2, 'MIC-02', 'STANDBY', '1500', '1500', 'MANUAL', 'OP-1'), row(3, 'MIC-01', 'PRIMARY', '21', '5021', 'START'), row(4, 'MIC-02', 'STANDBY', '5021', null, 'MANUAL', 'OP-1')]);
      expect(spans(facts)).toEqual([
        [1, 'MIC-01', 'START', 0, 0],
        [2, 'MIC-02', 'MANUAL', 0, 0],
        [3, 'MIC-01', 'START', 21, 5_021],
        [4, 'MIC-02', 'MANUAL', 5_021, null],
      ]);
      expect(forward(facts)).toBe(true);
    });

    it('CONTROL: a session without a restart is read exactly as stored (one start row, a switch after it)', async () => {
      const facts = await read(viewOf(), sources('FAKE', 'FAKE'), [row(1, 'MIC-01', 'PRIMARY', '21', '4021', 'START'), row(2, 'MIC-02', 'STANDBY', '4021', null, 'MANUAL', 'OP-1')]);
      expect(spans(facts)).toEqual([
        [1, 'MIC-01', 'START', 21, 4_021],
        [2, 'MIC-02', 'MANUAL', 4_021, null],
      ]);
    });
  });

  describe('task 4 row 191c: the restarts that cost audio, out of the audit rows the reader already reads (decisions C73, C83)', () => {
    const auditRow = (seq: number, type: string, details: Record<string, unknown>) => ({ seq, id: `AUD-${String(seq)}`, at: 1_791_529_000_000 + seq, type, category: 'DEVICE', severity: 'WARNING', actor_id: null, message: 'm', session_id: SESSION, evidence_id: null, device_id: 'MIC-01', details, prev_hash: 'a'.repeat(64), hash: 'b'.repeat(64) });
    const gap = (seq: number, details: Record<string, unknown>) => auditRow(seq, 'CAPTURE_AUDIO_ABSENT_ON_RESTART', { sessionId: SESSION, ...details });
    async function readWithAudit(auditRows: unknown[]) {
      const statements: string[] = [];
      const rows: Record<string, unknown[]> = {
        [READ_SEAL_SOURCE_ROWS]: sources('FAKE', 'FAKE'),
        [READ_SEAL_AUDIO_INTERVALS]: [{ seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', from_media_ms: '21', to_media_ms: null, reason: 'START', switched_by: null }],
        [READ_SEAL_AUDIT_ROWS]: auditRows,
      };
      const reader = createSealSessionReader({
        state: () => viewOf(),
        db: () => ({ query: async (text: string) => (statements.push(text), { rows: (rows[text] ?? []) as never[] }) }),
        begin: async () => undefined,
        sttSnapshot: async () => null,
        notice: 'NOTICE',
        timezone: '+07:00',
      });
      const facts = await reader.read(SESSION);
      if (facts === null) throw new Error('the session was not read');
      return { facts, statements };
    }

    it('one record per stored entry, in the order of the chain, with the attempts and BOTH bounds; a bound the entry leaves out is null; the numbers are the entry\'s own and the extract holds the same rows', async () => {
      const { facts, statements } = await readWithAudit([
        auditRow(88, 'RECORDING_STARTED', {}),
        gap(89, { earlierAttempt: 1, laterAttempt: 2, audioAbsentAtLeastMs: 336, audioAbsentAtMostMs: 715 }),
        gap(93, { earlierAttempt: 2, laterAttempt: 3, audioAbsentAtMostMs: 640 }),
        gap(97, { earlierAttempt: 3, laterAttempt: 5 }),
      ]);
      expect(facts.audioRestartGaps).toEqual([
        { earlierAttempt: 1, laterAttempt: 2, absentAtLeastMs: 336, absentAtMostMs: 715 },
        { earlierAttempt: 2, laterAttempt: 3, absentAtLeastMs: null, absentAtMostMs: 640 },
        { earlierAttempt: 3, laterAttempt: 5, absentAtLeastMs: null, absentAtMostMs: null },
      ]);
      // No second statement: the three reads of before, the audit rows once.
      expect(statements.filter((text) => text === READ_SEAL_AUDIT_ROWS)).toHaveLength(1);
      expect(statements.every((text) => [READ_SEAL_SOURCE_ROWS, READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS].includes(text))).toBe(true);
      const extract = Buffer.from(facts.auditExtract).toString('utf8').trim().split('\n').map((line) => JSON.parse(line) as { type: string; details: Record<string, unknown> });
      expect(extract.filter((line) => line.type === 'CAPTURE_AUDIO_ABSENT_ON_RESTART').map((line) => line.details.audioAbsentAtMostMs)).toEqual([715, 640, undefined]);
    });

    it('CONTROL: a session WITHOUT such an entry hands NO member at all (not an empty list): its facts have the keys of before', async () => {
      const { facts } = await readWithAudit([auditRow(88, 'RECORDING_STARTED', {}), auditRow(89, 'CAPTURE_AUDIO_BEGINS_AFTER_RESTART', { earlierAttempt: 1, laterAttempt: 2 })]);
      expect('audioRestartGaps' in facts).toBe(false);
      expect(audioRestartGapsOf([])).toEqual([]);
    });

    it('an entry whose numbers are not of the form its writer enforces is neither skipped nor repaired: the read throws and no seal starts on it', async () => {
      for (const details of [{ laterAttempt: 2 }, { earlierAttempt: 1, laterAttempt: 2.5 }, { earlierAttempt: 0, laterAttempt: 2 }, { earlierAttempt: 1, laterAttempt: 2, audioAbsentAtLeastMs: -1 }, { earlierAttempt: 1, laterAttempt: 2, audioAbsentAtMostMs: 86_400_001 }, { earlierAttempt: 1, laterAttempt: 2, audioAbsentAtMostMs: '715' }]) {
        await expect(readWithAudit([gap(89, details)])).rejects.toThrow(/AUD-89 of a worker restart/);
      }
    });

    // ── Task 4 row R1b (decision C99; finding F3-01): the absences of a camera inside the session, out of the SAME rows ──
    const absence = (seq: number, camera: string, details: Record<string, unknown>) => ({ ...auditRow(seq, 'CAPTURE_VIDEO_ABSENT_IN_SESSION', { sessionId: SESSION, deviceId: camera, ...details }), device_id: camera });
    const FULL = { trackId: 'VIDEO-01', attempt: 1, loss: 1, tries: 1, videoAbsentAtLeastMs: 3048, videoAbsentAtMostMs: 8049, ended: 'RE_OPENED' };

    it('row R1b: one record per stored entry ON THE TRACK ITS ENTRY NAMES, in the order of the chain, with both bounds and how it ended; a bound the entry leaves out is null; the audit rows are read ONCE and the extract holds the same rows', async () => {
      const second = sources('FAKE', 'FAKE').find((row) => row.slot === 'VIDEO-02')?.device_id as string;
      const { facts, statements } = await readWithAudit([
        auditRow(88, 'RECORDING_STARTED', {}),
        absence(89, 'CAM-01', FULL),
        absence(91, second, { trackId: 'VIDEO-02', attempt: 1, loss: 1, videoAbsentAtMostMs: 46210, ended: 'NOT_RE_OPENED' }),
        absence(93, 'CAM-01', { trackId: 'VIDEO-01', attempt: 1, loss: 2, ended: 'NOT_RE_OPENED' }),
      ]);
      expect(facts.tracks.map((track) => [track.trackId, track.absentInSession])).toEqual([
        ['VIDEO-01', [{ attempt: 1, loss: 1, absentAtLeastMs: 3048, absentAtMostMs: 8049, ended: 'RE_OPENED' }, { attempt: 1, loss: 2, absentAtLeastMs: null, absentAtMostMs: null, ended: 'NOT_RE_OPENED' }]],
        ['VIDEO-02', [{ attempt: 1, loss: 1, absentAtLeastMs: null, absentAtMostMs: 46210, ended: 'NOT_RE_OPENED' }]],
      ]);
      // No second statement: the three reads of before, the audit rows once.
      expect(statements.filter((text) => text === READ_SEAL_AUDIT_ROWS)).toHaveLength(1);
      expect(statements.every((text) => [READ_SEAL_SOURCE_ROWS, READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS].includes(text))).toBe(true);
      const extract = Buffer.from(facts.auditExtract).toString('utf8').trim().split('\n').map((line) => JSON.parse(line) as { type: string; details: Record<string, unknown> });
      expect(extract.filter((line) => line.type === 'CAPTURE_VIDEO_ABSENT_IN_SESSION').map((line) => [line.details.trackId, line.details.loss, line.details.videoAbsentAtMostMs])).toEqual([['VIDEO-01', 1, 8049], ['VIDEO-02', 1, 46210], ['VIDEO-01', 2, undefined]]);
    });

    it('row R1b, CONTROL: a session WITHOUT such an entry hands NO member on either track (not an empty list): its track facts have the keys of before', async () => {
      const { facts } = await readWithAudit([auditRow(88, 'RECORDING_STARTED', {}), auditRow(89, 'FAULT_RAISED', { kind: 'CAPTURE_FAULT', reason: 'CAMERA_STREAM_ENDED', target: 'CAM-01' })]);
      for (const track of facts.tracks) expect('absentInSession' in track).toBe(false);
      expect(videoAbsencesOf([])).toEqual([]);
    });

    it('row R1b: ONLY THE ATTEMPT WHOSE MEDIA IS IN THE FILES - an absence that ended inside an attempt a later worker superseded stays in the extract and is not stated; the last attempt is the highest the stored entries name', async () => {
      // The absence of attempt 1 was written (the camera came back), then the worker was replaced: the files begin with attempt 2.
      const superseded = await readWithAudit([absence(89, 'CAM-01', FULL), gap(93, { earlierAttempt: 1, laterAttempt: 2, audioAbsentAtMostMs: 640 })]);
      for (const track of superseded.facts.tracks) expect('absentInSession' in track).toBe(false);
      expect(superseded.facts.audioRestartGaps).toHaveLength(1);
      expect(Buffer.from(superseded.facts.auditExtract).toString('utf8')).toContain('CAPTURE_VIDEO_ABSENT_IN_SESSION');
      // Absences of two attempts: the later one is the files'.
      const two = await readWithAudit([absence(89, 'CAM-01', FULL), absence(95, 'CAM-01', { ...FULL, attempt: 2, videoAbsentAtLeastMs: 12 })]);
      expect(two.facts.tracks[0]!.absentInSession).toEqual([{ attempt: 2, loss: 1, absentAtLeastMs: 12, absentAtMostMs: 8049, ended: 'RE_OPENED' }]); // D60 (2026-11-04): the track list is a 1..4 array
      // An absence of the attempt the restart led to IS stated.
      const later = await readWithAudit([gap(90, { earlierAttempt: 1, laterAttempt: 2 }), absence(95, 'CAM-01', { ...FULL, attempt: 2 })]);
      expect(later.facts.tracks[0]!.absentInSession).toHaveLength(1);
    });

    it('row R1b: an entry that is not of the form its writer enforces - or that names another device than its row, or than the track\'s start record - is neither skipped nor repaired: the read throws and no seal starts on it', async () => {
      const malformed: Record<string, unknown>[] = [
        { ...FULL, trackId: 'VIDEO-05' }, // D60 (2026-11-04): VIDEO-03 is of the form now - the outside-the-form case needs an id beyond the four tracks
        { ...FULL, trackId: undefined },
        { ...FULL, attempt: 0 },
        { ...FULL, attempt: '1' },
        { ...FULL, loss: 1.5 },
        { ...FULL, loss: undefined },
        { ...FULL, videoAbsentAtLeastMs: -1 },
        { ...FULL, videoAbsentAtMostMs: 86_400_001 },
        { ...FULL, videoAbsentAtMostMs: '8049' },
        { ...FULL, ended: 'REOPENED' },
        { ...FULL, ended: undefined },
      ];
      for (const details of malformed) await expect(readWithAudit([absence(89, 'CAM-01', details)]), JSON.stringify(details)).rejects.toThrow(/AUD-89 of a camera absent inside the session/);
      // The row's device column and the details disagree.
      await expect(readWithAudit([{ ...absence(89, 'CAM-01', FULL), device_id: 'CAM-02' }])).rejects.toThrow(/AUD-89 of a camera absent inside the session/);
      await expect(readWithAudit([{ ...absence(89, 'CAM-01', FULL), details: null }])).rejects.toThrow(/AUD-89 of a camera absent inside the session/);
      // Well formed, but VIDEO-02 of this session was started with another device than the entry names.
      await expect(readWithAudit([absence(89, 'CAM-01', { ...FULL, trackId: 'VIDEO-02' })])).rejects.toThrow(/not the one the session started that track with/);
    });
  });

  // Task 4 row P1 (decisions U21 (2), C66 (1), C71 C-7): manifest field 133 out of what the boot checks found of the host profile.
  describe('task 4 row P1: the host profile of the Core that seals - stated only where a production Core did not ask it', () => {
    async function readOn(hostProfileNotAsked?: () => { platform: 'darwin' } | null) {
      const rows: Record<string, unknown[]> = {
        [READ_SEAL_SOURCE_ROWS]: sources('FAKE', 'FAKE'),
        [READ_SEAL_AUDIO_INTERVALS]: [{ seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', from_media_ms: '21', to_media_ms: null, reason: 'START', switched_by: null }],
      };
      const reader = createSealSessionReader({
        state: () => viewOf(),
        db: () => ({ query: async (text: string) => ({ rows: (rows[text] ?? []) as never[] }) }),
        begin: async () => undefined,
        sttSnapshot: async () => null,
        notice: 'NOTICE',
        timezone: '+07:00',
        ...(hostProfileNotAsked === undefined ? {} : { hostProfileNotAsked }),
      });
      const facts = await reader.read(SESSION);
      if (facts === null) throw new Error('the session was not read');
      return facts;
    }

    it('what the boot checks found becomes the member or nothing: asked (Linux) and never asked by design (development: no statement) = null; not asked on macOS = the platform; a platform the manifest has no word for throws', () => {
      expect(hostProfileNotAskedOf(undefined)).toBeNull();
      expect(hostProfileNotAskedOf(hostProfileStatementOf('linux') ?? undefined)).toBeNull();
      expect(hostProfileNotAskedOf(hostProfileStatementOf('darwin') ?? undefined)).toEqual({ platform: 'darwin' });
      // Fail closed: "not asked" on a platform the manifest cannot state never becomes "nothing to state".
      expect(() => hostProfileNotAskedOf({ platform: 'freebsd', asked: false })).toThrow(/cannot state/);
      expect(hostProfileNotAskedOf({ platform: 'freebsd', asked: true })).toBeNull();
      // THE TWO LISTS AGREE: every platform a production Core starts on without its host profile has a word in the manifest, and no other has.
      expect(Object.entries(PRODUCTION_PLATFORMS).filter(([, profile]) => profile === 'NOT_ASKED').map(([platform]) => platform)).toEqual([...MANIFEST_HOST_PROFILE_NOT_ASKED_PLATFORMS]);
      // THE ONE HAND-OVER in the product: the sealing host asks the outcome of THIS Core's boot checks at every seal, through that function.
      const host = readFileSync(join(import.meta.dirname, '..', 'index.ts'), 'utf8');
      expect(host.match(/hostProfileNotAsked: .*$/gm)).toEqual(['hostProfileNotAsked: () => hostProfileNotAskedOf(captureBootControl(app).outcome()?.hostProfile),']);
    });

    it('the reader hands the member on only when there is one: no option, and an option that answers null, give the facts of before (NO key)', async () => {
      const before = await readOn();
      expect('hostProfileNotAsked' in before).toBe(false);
      const asked = await readOn(() => null);
      expect('hostProfileNotAsked' in asked).toBe(false);
      expect(Object.keys(asked)).toEqual(Object.keys(before));
      const onMac = await readOn(() => ({ platform: 'darwin' }));
      expect(onMac.hostProfileNotAsked).toEqual({ platform: 'darwin' });
      const { hostProfileNotAsked: _member, ...rest } = onMac;
      expect(Object.keys(rest)).toEqual(Object.keys(before));
    });
  });

  describe('G89-01: what the session reader hands to the seal', () => {
    it('the dataset is in the state it reads (the test can fail): serial, UUID, 2.4.1, GNSS / locked, the camera model and firmware', () => {
      expect(DATASET).toEqual({ serialNumber: 'DEC-2026-IR01-000117', hardwareUuid: seeded.device.identity.hardwareUuid, softwareVersion: '2.4.1', cameraModel: 'Dual-lens IP camera DL-2', simulatorCameraModel: 'Dual-lens IP camera DL-2 (lens 1)', cameraFirmware: '3.8.14', timeSource: 'GNSS' });
      expect(seeded.device.softwareVersion).toBe(SOFTWARE_VERSION);
      expect(seeded.time.locked).toBe(true);
      expect(seeded.captureDevices.devices.find((device) => device.id === 'CAM-01')).toMatchObject({ model: DATASET.cameraModel, firmware: DATASET.cameraFirmware });
    });

    it('holds NONE of the simulator dataset\'s values: the Core\'s own version, its own clock, an identity that says it is not configured, and the truthful words for a generated source', async () => {
      const facts = await read(viewOf(), sources('FAKE', 'FAKE'));
      const text = JSON.stringify({ timeSource: facts.timeSource, device: facts.device, tracks: facts.tracks });
      for (const value of [DATASET.serialNumber, DATASET.hardwareUuid, DATASET.cameraModel, DATASET.simulatorCameraModel, DATASET.cameraFirmware, 'GNSS', 'LOCKED', 'NTP']) expect(text, value).not.toContain(value);
      expect(facts.device.softwareVersion).not.toBe(DATASET.softwareVersion);

      // Field 24: the Core build.
      expect(facts.device.softwareVersion).toBe(CORE_SERVER_VERSION);
      // Fields 22, 23: no installation identity is configured for a Core.
      expect([facts.device.serialNumber, facts.device.hardwareUuid]).toEqual([NOT_CONFIGURED, NOT_CONFIGURED]);
      // Fields 20, 21 - pin moved by closing pass Z1 (decision D207): the configured installation identity, and
      // this reader was handed none: NOT_CONFIGURED, never the stored seed record (`installation-identity.test.ts`).
      expect([facts.device.deviceId, facts.device.name]).toEqual([NOT_CONFIGURED, NOT_CONFIGURED]);
      // Fields 17-19: the clock the Core reads; no receiver, no lock, no fallback chain.
      expect(facts.timeSource).toEqual(CORE_TIME_SOURCE);
      expect(facts.timeSource).toEqual({ source: 'RTC', state: 'HOST_SYSTEM_CLOCK', fallbackOrder: [] });
      // Fields 38, 39 of a generated source.
      expect(facts.tracks.map((track) => [track.trackId, track.model, track.firmware])).toEqual([
        ['VIDEO-01', SOURCE_WORDS.FAKE.model, SOURCE_WORDS.FAKE.firmware],
        ['VIDEO-02', SOURCE_WORDS.FAKE.model, SOURCE_WORDS.FAKE.firmware],
      ]);
    });

    it('CONTROL - a real camera states what its adapter reported (the registry row); one whose row holds nothing says NOT_REPORTED, never a value of another device', async () => {
      const devices = [
        { id: 'CAM-01', model: 'Vendor X 4MP dome', firmware: '5.7.1 build 2401' },
        { id: 'CAM-02', model: null, firmware: null },
      ];
      const facts = await read(viewOf(devices), sources('ONVIF_RTSP', 'ONVIF_RTSP'));
      expect(facts.tracks.map((track) => [track.trackId, track.model, track.firmware])).toEqual([
        ['VIDEO-01', 'Vendor X 4MP dome', '5.7.1 build 2401'],
        ['VIDEO-02', NOT_REPORTED, NOT_REPORTED],
      ]);
    });

    it('a local development device states the name its registry row holds and that no firmware is reported', async () => {
      const facts = await read(viewOf([{ id: 'CAM-01', model: 'Built-in camera of this computer', firmware: null }, { id: 'CAM-02', model: null, firmware: null }]), sources('LOCAL_DEVICE', 'LOCAL_DEVICE'));
      expect(facts.tracks.map((track) => [track.model, track.firmware])).toEqual([
        ['Built-in camera of this computer', SOURCE_WORDS.LOCAL_DEVICE.firmware],
        [SOURCE_WORDS.LOCAL_DEVICE.model, SOURCE_WORDS.LOCAL_DEVICE.firmware],
      ]);
    });
  });

  describe('G89-01: a package sealed with those facts', () => {
    it('is signed, holds none of the dataset\'s values in its manifest, and verifies PASS', async () => {
      const facts = await read(viewOf(), sources('FAKE', 'FAKE'));
      const recording = recordSession();
      const h = harnessOf(recording);
      h.facts = { ...h.facts, timeSource: facts.timeSource, device: facts.device, tracks: [{ ...h.facts.tracks[0]!, model: facts.tracks[0]!.model, firmware: facts.tracks[0]!.firmware }, { ...h.facts.tracks[1]!, model: facts.tracks[1]!.model, firmware: facts.tracks[1]!.firmware }] }; // D60 (2026-11-04): the track list is a 1..4 array; the two-file harness grafts the first two lines
      const outcome = await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' });
      expect(outcome.status).toBe('SEALED');
      const raw = readFileSync(recording.path(PackageFile.MANIFEST), 'utf8');
      for (const value of Object.values(DATASET)) expect(raw, value).not.toContain(`"${value}"`);
      expect(raw).not.toContain('"LOCKED"');
      const manifest = parseManifestV2(JSON.parse(raw));
      expect(manifest.device).toMatchObject({ softwareVersion: CORE_SERVER_VERSION, serialNumber: NOT_CONFIGURED, hardwareUuid: NOT_CONFIGURED });
      expect(manifest.timeline.timeSource).toEqual(CORE_TIME_SOURCE);
      const result = await verifyPackageV2(corePorts(recording.packageDir, recording.opener, 256), { plaintext: 'REQUIRED', expected: h.anchors() });
      expect([result.ok, result.overall]).toEqual([true, 'PASS']);
    });
  });
});
