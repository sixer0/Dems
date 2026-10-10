// Tidy pass F-Y, items 3 and 4: what the capture facts of a session hold since this pass, and where
// manifest field 40 (`tracks[].clockOffsetMs`) comes from.
//
//   syncLevel              per camera file: the durability level the worker stated with its first
//                          durable fragment (ruling D188: NOT a manifest field);
//   measuredClockOffsetMs  per camera: the offset the WORKER measured when it anchored the camera
//                          (camera clock minus Core clock). Field 40 is this value; the adapter's
//                          report (`clockOffsetMs`) is the fallback when the worker reported none.
import { describe, expect, it } from 'vitest';
import { READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS, READ_SEAL_SOURCE_ROWS, STAND_INS, createSealSessionReader, type SealCaptureFacts, type SealStateView } from '../../sealing-host/session-reader';
import { parseSessionCaptureFacts } from '../facts';

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
