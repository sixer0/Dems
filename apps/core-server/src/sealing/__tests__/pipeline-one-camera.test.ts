// Fix pass F-M7 (review row 88; decision D178), findings R88-01 and R88-02 (b):
//
//   R88-01   a session that recorded with ONE usable camera file is sealed with the tracks it has;
//   R88-02b  a cause confined to ONE camera file leaves that file out, and what validates is sealed
//            as INTERRUPTED; the file that was left out is MOVED to the quarantine, never deleted
//            and never left in the package folder.
//
// Evidence integrity: every verdict has its control (a two-camera seal is what it was; a session
// with NO usable camera file is not sealed and nothing is signed).
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PackageFile, declaredPackageFiles, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
import { VERIFY_V2_CHECKS, verifyPackageV2, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../../evidence-verify';
import type { VideoTrackId } from '../../modules/recording-fragments';
import { SEALING_QUARANTINE_DIR, type SealOutcome } from '../index';
import { listPackageFiles } from '../pipeline/camera-files';
import { removePackages } from './package-support';
import { harnessOf, recordSession, removeRecordings, sha256Hex, type Harness, type Recording } from './pipeline-support';

afterAll(() => {
  removeRecordings();
  removePackages();
});

const ALL = VERIFY_V2_CHECKS.map((check) => check.id);
const verify = (h: Harness): Promise<PackageVerifyResult> => verifyPackageV2(corePorts(h.recording.packageDir, h.recording.opener, 256), { plaintext: 'REQUIRED', expected: h.anchors() });
const passing = (result: PackageVerifyResult): string[] => result.checks.filter((check) => check.status === 'PASS').map((check) => check.id);
const manifestOf = (recording: Recording): ManifestV2 => parseManifestV2(JSON.parse(readFileSync(recording.path(PackageFile.MANIFEST), 'utf8')));
const sealedOf = (outcome: SealOutcome): Extract<SealOutcome, { status: 'SEALED' }> => {
  if (outcome.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(outcome)}`);
  return outcome;
};
const other = (trackId: VideoTrackId): VideoTrackId => (trackId === 'VIDEO-01' ? 'VIDEO-02' : 'VIDEO-01');
const quarantined = (recording: Recording, name: string): string => join(recording.mediaDir, SEALING_QUARANTINE_DIR, recording.sessionId, name);
const neverRecorded = (recording: Recording, trackId: VideoTrackId): void => {
  rmSync(recording.recordingFile(trackId));
  recording.tracks[trackId].rows.length = 0;
};

describe('R88-01: a session that recorded with one camera is sealed with the one camera file', () => {
  it.each([['VIDEO-02' as const], ['VIDEO-01' as const]])('camera file %s was never written and has no fragment row: the seal completes with the other file, NOT interrupted, and verifies PASS on all 15 checks', async (absent) => {
    const recording = recordSession();
    const present = other(absent);
    const plain = readFileSync(recording.recordingFile(present));
    neverRecorded(recording, absent);
    const h = harnessOf(recording);
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome).toMatchObject({ attempt: 1, interrupted: false });
    expect(outcome.tracks.map((track) => track.trackId)).toEqual([present]);

    const manifest = manifestOf(recording);
    expect(manifest.tracks.map((track) => track.trackId)).toEqual([present]);
    expect(manifest.files.map((file) => file.trackId)).toEqual([present]);
    expect(manifest.audio.containsIn).toEqual([present]);
    expect(manifest.timeline).toMatchObject({ interrupted: false, stoppedAt: h.facts.stoppedAt });
    expect(manifest.tracks[0]).toMatchObject({ sha256Plain: sha256Hex(plain), fragmentCount: 5, deviceId: h.facts.tracks[present === 'VIDEO-01' ? 0 : 1].deviceId });
    // The camera that is absent is stated under the signature, by an existing member (the step's checkpoint record).
    expect(manifest.sealing.steps[0]).toMatchObject({ step: 'CLOSE_TRACKS', checkpoint: { tracks: 1, absentTracks: absent } });

    const result = await verify(h);
    expect([result.ok, result.overall, result.interrupted, passing(result)]).toEqual([true, 'PASS', false, ALL]);
    expect(result.files.map((file) => file.trackId)).toEqual([present]);
    // The folder holds exactly what a one-camera package declares; the plaintext recording is gone.
    expect(await listPackageFiles(recording.packageDir)).toEqual([...declaredPackageFiles({ transcript: false, tracks: [present] })].sort());
    expect(existsSync(recording.recordingFile(present))).toBe(false);
    // The engine was handed the one file, once: the session ends SEALED and the Core is free.
    expect(h.engine.sealed).toHaveLength(1);
    expect(h.engine.sealed[0]?.input.tracks.map((track) => track.trackId)).toEqual([present]);
    expect(h.log.entries.filter((entry) => entry.level === 'error')).toEqual([]);
    expect(h.log.entries.map((entry) => entry.code)).toContain('SEALING_CAMERA_NOT_RECORDED');
  });

  it('CONTROL: one altered byte of the one sealed camera file is TAMPERED (V-04 holds for one track)', async () => {
    const recording = recordSession();
    neverRecorded(recording, 'VIDEO-02');
    const h = harnessOf(recording);
    sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    const file = recording.cameraFile('VIDEO-01');
    const bytes = readFileSync(file);
    const at = recording.tracks['VIDEO-01'].rows[1]!.byteOffset + 20;
    bytes[at] = (bytes[at] ?? 0) ^ 0xff;
    writeFileSync(file, bytes);
    const result = await verify(h);
    expect([result.ok, result.overall]).toEqual([false, 'TAMPERED']);
    expect(result.checks.find((check) => check.id === 'V-04')?.status).toBe('FAIL');
  });

  it('CONTROL: a second camera file put beside a one-camera package is an undeclared file (V-14), not a second track', async () => {
    const recording = recordSession();
    const stray = readFileSync(recording.recordingFile('VIDEO-02'));
    neverRecorded(recording, 'VIDEO-02');
    const h = harnessOf(recording);
    sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    writeFileSync(recording.cameraFile('VIDEO-02'), stray);
    const result = await verify(h);
    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.id === 'V-14')?.findings.map((finding) => [finding.code, finding.file])).toEqual([['UNEXPECTED_FILE', 'fragments/VIDEO-02.mp4']]);
  });

  it('CONTROL: the two-camera seal is what it was - two tracks, no absent-camera statement', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02']);
    expect(manifestOf(recording).sealing.steps[0]?.checkpoint).toEqual({ tracks: 2, truncatedTails: 0, interrupted: false });
    expect(existsSync(join(recording.mediaDir, SEALING_QUARANTINE_DIR))).toBe(false);
  });
});

describe('R88-02 (b): a cause confined to one camera file - what validates is sealed as INTERRUPTED, the other file goes to the quarantine', () => {
  const cases: readonly (readonly [string, string, (recording: Recording) => void, boolean])[] = [
    [
      'holds an init segment and a cut first fragment, and no fragment row',
      'NO_INIT_SEGMENT',
      (recording) => {
        writeFileSync(recording.recordingFile('VIDEO-02'), readFileSync(recording.recordingFile('VIDEO-02')).subarray(0, recording.tracks['VIDEO-02'].rows[0]!.byteOffset + 10));
        recording.tracks['VIDEO-02'].rows.length = 0;
      },
      true,
    ],
    ['is gone although fragment rows say it recorded', 'MISSING', (recording) => rmSync(recording.recordingFile('VIDEO-02')), false],
    // RULING D183 (fix pass F-M7b): a file is left out only when it has NO valid fragment - here its FIRST
    // fragment is not what its row says. A failure further in seals the durable prefix: `pipeline-prefix.test.ts`
    // (which also holds the former "lost bytes its rows declare durable" case: those bytes' prefix is sealed).
    [
      'holds a FIRST fragment that is not what its row says (CORRUPT): no valid fragment',
      'FRAGMENT_MISMATCH',
      (recording) => {
        const row = recording.tracks['VIDEO-02'].rows[0]!;
        recording.tracks['VIDEO-02'].rows[0] = { ...row, sha256: sha256Hex(Buffer.from('another fragment')) };
      },
      true,
    ],
  ];

  it.each(cases)('camera file VIDEO-02 %s (%s): VIDEO-01 is sealed INTERRUPTED and verifies PASS; the file left out is in the quarantine, owner-only, byte for byte', async (_label, reason, damage, fileLeft) => {
    const recording = recordSession();
    damage(recording);
    const left = fileLeft ? readFileSync(recording.recordingFile('VIDEO-02')) : null;
    const h = harnessOf(recording);
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome.interrupted).toBe(true);
    expect(outcome.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01']);
    const manifest = manifestOf(recording);
    expect(manifest.timeline).toMatchObject({ interrupted: true, stoppedAt: null });
    expect(manifest.files[0]?.fragments.every((fragment) => fragment.interrupted)).toBe(true);
    expect(manifest.sealing.steps[0]?.checkpoint).toMatchObject({ tracks: 1, interrupted: true, absentTracks: 'VIDEO-02' });

    const result = await verify(h);
    expect([result.ok, result.overall, result.interrupted, passing(result)]).toEqual([true, 'PASS', true, ALL]);
    // Nothing of the camera that was left out is in the package folder, and nothing of it was deleted.
    expect(await listPackageFiles(recording.packageDir)).toEqual([...declaredPackageFiles({ transcript: false, tracks: ['VIDEO-01'] })].sort());
    const kept = quarantined(recording, 'VIDEO-02.mp4');
    expect(existsSync(kept)).toBe(fileLeft);
    if (left !== null) {
      expect(readFileSync(kept).equals(left)).toBe(true);
      expect(statSync(kept).mode & 0o077).toBe(0);
      expect(statSync(join(kept, '..')).mode & 0o077).toBe(0);
    }
    // SAID, never silent: the persistent log names the camera and the reason; the step's checkpoint keeps it.
    expect(h.log.entries.some((entry) => entry.code === 'SEALING_CAMERA_LEFT_OUT' && entry.level === 'error' && entry.context?.trackId === 'VIDEO-02' && entry.context?.reason === reason)).toBe(true);
    expect(h.engine.sealed[0]?.input).toMatchObject({ interrupted: true });
  });

  it('NO camera file validates: nothing is sealed, nothing is signed, both recordings stay where they are, and the outcome says UNSEALABLE-in-waiting by its code', async () => {
    const recording = recordSession();
    for (const trackId of ['VIDEO-01', 'VIDEO-02'] as const) {
      // The FIRST fragment of each file (ruling D183: a failure further in would seal the prefix before it).
      const row = recording.tracks[trackId].rows[0]!;
      recording.tracks[trackId].rows[0] = { ...row, sha256: sha256Hex(Buffer.from(`not ${trackId}`)) };
    }
    const before = (['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => sha256Hex(readFileSync(recording.recordingFile(trackId))));
    const h = harnessOf(recording);
    const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    expect(outcome).toMatchObject({ status: 'FAILED', step: 'CLOSE_TRACKS', code: 'NOTHING_SEALABLE', retriable: false });
    expect(existsSync(recording.path(PackageFile.MANIFEST))).toBe(false);
    expect(existsSync(recording.path(PackageFile.SIGNATURE))).toBe(false);
    expect(existsSync(recording.path(PackageFile.FRAGMENTS_JSON))).toBe(false);
    expect((['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => sha256Hex(readFileSync(recording.recordingFile(trackId))))).toEqual(before);
    expect(h.engine.sealed).toHaveLength(0);
  });

  it('a seal that was stopped after CLOSE_TRACKS and resumed keeps the one-camera decision of its checkpoint (the same package)', async () => {
    const recording = recordSession();
    neverRecorded(recording, 'VIDEO-02');
    const h = harnessOf(recording);
    const { SealingStop } = await import('../index');
    h.hook = (point) => {
      if (point.step === 'FINALIZE_HASHES' && point.phase === 'AFTER_CHECKPOINT' && point.attempt === 1) throw new SealingStop(point);
    };
    await expect(h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    const outcome = sealedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome).toMatchObject({ attempt: 2, skipped: ['CLOSE_TRACKS', 'FINALIZE_HASHES'] });
    expect(outcome.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01']);
    const result = await verify(h);
    expect([result.ok, passing(result)]).toEqual([true, ALL]);
  });
});
