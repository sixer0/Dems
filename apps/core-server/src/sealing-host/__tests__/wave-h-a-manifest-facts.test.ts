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
import { readFileSync } from 'node:fs';
import { PackageFile, parseManifestV2 } from '@dems/shared/evidence-package';
import { verifyPackageV2 } from '@dems/shared/evidence-verify';
import { DEVICE_IDENTITY, SOFTWARE_VERSION, createSim } from '@dems/shared/sim';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../../evidence-verify';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings } from '../../sealing/__tests__/pipeline-support';
import { CORE_SERVER_VERSION } from '../../version';
import { CORE_TIME_SOURCE, NOT_CONFIGURED, NOT_REPORTED, READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS, READ_SEAL_SOURCE_ROWS, SOURCE_WORDS, createSealSessionReader, type SealStateView } from '../session-reader';

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
  { slot: 'MIC-PRIMARY', device_id: 'MIC-01', adapter_kind: 'FAKE' },
  { slot: 'MIC-STANDBY', device_id: 'MIC-02', adapter_kind: 'FAKE' },
  { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: video1 },
  { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: video2 },
];

async function read(view: SealStateView, sourceRows: unknown[]) {
  const rows: Record<string, unknown[]> = { [READ_SEAL_SOURCE_ROWS]: sourceRows, [READ_SEAL_AUDIO_INTERVALS]: [{ seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', from_media_ms: '21', to_media_ms: null, reason: 'START', switched_by: null }], [READ_SEAL_AUDIT_ROWS]: [] };
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
    // this reader was handed none: NOT_CONFIGURED, never the stored seed record (`wave-h-z1-installation-identity.test.ts`).
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
    h.facts = { ...h.facts, timeSource: facts.timeSource, device: facts.device, tracks: [{ ...h.facts.tracks[0], model: facts.tracks[0].model, firmware: facts.tracks[0].firmware }, { ...h.facts.tracks[1], model: facts.tracks[1].model, firmware: facts.tracks[1].firmware }] };
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
