// Fix wave H driver A, C3 (gate 64 condition C3 = review R63-16; gate 89 section 7: "does a sealed
// package mark a track whose camera was given up by the clock floor? NO"; decisions D199, D202).
//
// RULED: from the instant a camera is given up, its track is INTERRUPTED, stated with the EXISTING
// members - no new manifest field:
//   files[].fragments[].interrupted (field 73)   true on every fragment record of THAT file;
//   sealing.steps[CLOSE_TRACKS].checkpoint       `endedTracks: "VIDEO-02:<reason>"`, under the signature.
// The session itself is not made an interrupted one: the other camera recorded to the operator's stop.
import { readFileSync } from 'node:fs';
import { PackageFile, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
import { verifyPackageV2 } from '@dems/shared/evidence-verify';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../../evidence-verify';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings } from '../../sealing/__tests__/pipeline-support';
import { READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS, READ_SEAL_SOURCE_ROWS, createSealSessionReader, type SealCaptureFacts, type SealStateView } from '../session-reader';

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
      [READ_SEAL_SOURCE_ROWS]: [{ slot: 'MIC-PRIMARY', device_id: 'MIC-01', adapter_kind: 'FAKE', recorded_at: '5000' }, { slot: 'MIC-STANDBY', device_id: 'MIC-02', adapter_kind: 'FAKE', recorded_at: '5000' }, { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE', recorded_at: '5000' }, { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: 'FAKE', recorded_at: '5000' }],
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
