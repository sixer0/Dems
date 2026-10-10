// Fix pass F-M7b (review row 88, R88-02 (b); RULING D183 on F-M7's decision 2):
//
//   A camera file that fails validation PART-WAY has its DURABLE PREFIX sealed - the fragments
//   before the first bad one, when they validate by box walk and by the recording-time chain - as
//   an INTERRUPTED recording, with `truncated` on the last sealed fragment. Only a file with NO
//   valid fragment is left out. The WHOLE ORIGINAL file goes to the quarantine after the seal: the
//   unsealed remainder is never lost and never stays in the session folder.
//
// Evidence integrity: every rule has its control, and the quarantine-before-removal rule has a
// mutation proof (see the note of this pass: with the move switched off, the plaintext removal
// deletes the original - its first bytes ARE the sealed prefix - and the remainder is gone).
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PackageFile, declaredPackageFiles, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
import { VERIFY_V2_CHECKS, verifyPackageV2, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../../evidence-verify';
import { SEALING_QUARANTINE_DIR, sealingOmittedNotice, type SealOutcome } from '../index';
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
const quarantined = (recording: Recording, name: string): string => join(recording.mediaDir, SEALING_QUARANTINE_DIR, recording.sessionId, name);
const seal = (h: Harness): Promise<SealOutcome> => h.pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' });

type Damage = (recording: Recording) => void;
const wrongDigestAt = (seq: number): Damage => (recording) => {
  const row = recording.tracks['VIDEO-02'].rows[seq - 1]!;
  recording.tracks['VIDEO-02'].rows[seq - 1] = { ...row, sha256: sha256Hex(Buffer.from('another fragment')) };
};
const changedByteAt = (seq: number): Damage => (recording) => {
  const row = recording.tracks['VIDEO-02'].rows[seq - 1]!;
  const bytes = readFileSync(recording.recordingFile('VIDEO-02'));
  bytes[row.byteOffset + 90] = (bytes[row.byteOffset + 90] ?? 0) ^ 0x80;
  writeFileSync(recording.recordingFile('VIDEO-02'), bytes);
};
const wrongChainAt = (seq: number): Damage => (recording) => {
  const row = recording.tracks['VIDEO-02'].rows[seq - 1]!;
  recording.tracks['VIDEO-02'].rows[seq - 1] = { ...row, chainHash: sha256Hex(Buffer.from('another chain')) };
};
const lastFragmentGone: Damage = (recording) => {
  const last = recording.tracks['VIDEO-02'].rows.at(-1)!;
  writeFileSync(recording.recordingFile('VIDEO-02'), readFileSync(recording.recordingFile('VIDEO-02')).subarray(0, last.byteOffset));
};

describe('RULING D183: the durable prefix of a camera file that fails part-way is sealed as INTERRUPTED; the whole original goes to the quarantine', () => {
  const cases: readonly (readonly [string, string, Damage, number])[] = [
    ['a row whose digest is not the bytes\' at fragment 3', 'FRAGMENT_MISMATCH', wrongDigestAt(3), 2],
    ['a byte of fragment 4 changed after it was recorded', 'FRAGMENT_MISMATCH', changedByteAt(4), 3],
    ['the recording-time chain breaks at fragment 2', 'FRAGMENT_MISMATCH', wrongChainAt(2), 1],
    ['the last fragment its rows declare durable is gone', 'DURABLE_BYTES_MISSING', lastFragmentGone, 4],
  ];

  it.each(cases.map(([label, code, damage, count]) => [label, code, count, damage] as const))('VIDEO-02 with %s (%s): its first %i fragment(s) are sealed as INTERRUPTED and the whole original is quarantined', async (_label, code, sealedFragments, damage) => {
    const recording = recordSession();
    damage(recording);
    const original = readFileSync(recording.recordingFile('VIDEO-02'));
    const h = harnessOf(recording);
    const outcome = sealedOf(await seal(h));

    // BOTH camera files are in the seal; VIDEO-02 with its prefix only; the seal is an INTERRUPTED one.
    expect(outcome.interrupted).toBe(true);
    expect(outcome.tracks.map((track) => [track.trackId, track.fragmentCount])).toEqual([
      ['VIDEO-01', 5],
      ['VIDEO-02', sealedFragments],
    ]);
    const manifest = manifestOf(recording);
    expect(manifest.timeline).toMatchObject({ interrupted: true, stoppedAt: null });
    const sealed = manifest.files.find((file) => file.trackId === 'VIDEO-02')!.fragments;
    expect(sealed.map((fragment) => fragment.seq)).toEqual(Array.from({ length: sealedFragments }, (_, index) => index + 1));
    // `truncated` on the LAST sealed fragment, and only there; `interrupted` on every fragment of the seal.
    expect(sealed.map((fragment) => fragment.truncated)).toEqual(sealed.map((_, index) => index === sealed.length - 1));
    expect(manifest.files.every((file) => file.fragments.every((fragment) => fragment.interrupted))).toBe(true);
    // The sealed plaintext of the prefix IS what was recorded: the recording-time digests of the rows.
    expect(sealed.map((fragment) => fragment.sha256Plain)).toEqual(recording.tracks['VIDEO-02'].plain.slice(0, sealedFragments).map((bytes) => sha256Hex(bytes)));

    // The package verifies: 15 of 15, as an interrupted recording.
    const result = await verify(h);
    expect([result.ok, result.overall, result.interrupted, passing(result)]).toEqual([true, 'PASS', true, ALL]);

    // THE WHOLE ORIGINAL IS IN THE QUARANTINE, byte for byte, owner-only - and NOT in the session folder.
    const kept = quarantined(recording, 'VIDEO-02.mp4');
    expect(existsSync(kept)).toBe(true);
    expect(readFileSync(kept).equals(original)).toBe(true);
    expect(statSync(kept).mode & 0o077).toBe(0);
    expect(statSync(join(kept, '..')).mode & 0o077).toBe(0);
    expect(existsSync(recording.recordingFile('VIDEO-02'))).toBe(false);
    expect(await listPackageFiles(recording.packageDir)).toEqual([...declaredPackageFiles({ transcript: false, tracks: ['VIDEO-01', 'VIDEO-02'] })].sort());
    // The clean camera file's recording was removed by the proof rule, not quarantined.
    expect(existsSync(quarantined(recording, 'VIDEO-01.mp4'))).toBe(false);

    // SAID, never silent: the log names the camera, the failure and the first bad fragment; the checkpoint keeps it; the operator reads it.
    const said = h.log.entries.filter((entry) => entry.code === 'SEALING_CAMERA_PREFIX_SEALED');
    expect(said).toHaveLength(1);
    expect(said[0]).toMatchObject({ level: 'error', context: { trackId: 'VIDEO-02', failure: code, firstBadSeq: sealedFragments + 1, sealedFragments } });
    expect(h.log.entries.some((entry) => entry.code === 'SEALING_CAMERA_LEFT_OUT')).toBe(false);
    const checkpoint = h.journal.rows.get(`${recording.sessionId}#CLOSE_TRACKS`)?.checkpoint as unknown as { tracks: { trackId: string; partial?: { code: string; firstBadSeq: number } }[] };
    expect(checkpoint.tracks.map((track) => track.partial ?? null)).toEqual([null, { code, reason: code, firstBadSeq: sealedFragments + 1 }]);
    const told = h.engine.progress.flatMap((report) => report.steps).filter((step) => step.id === 'CLOSE_TRACKS' && step.status === 'DONE').at(-1)?.detail ?? '';
    expect(told).toBe(`Camera file VIDEO-02 is sealed up to fragment ${sealedFragments} only (${code}): the recording is sealed as interrupted, and the whole original file is kept in the quarantine folder.`);
    expect(h.engine.sealed[0]?.input).toMatchObject({ interrupted: true });
  });

  it('a fragment the verifier could not open (too large) part-way: the fragments before it are sealed, the original is quarantined', async () => {
    const recording = recordSession();
    const third = recording.tracks['VIDEO-02'].rows[2]!;
    const original = readFileSync(recording.recordingFile('VIDEO-02'));
    const h = harnessOf(recording);
    // Fragments grow with their number in this fixture: the bound admits fragments 1 and 2 of VIDEO-02 and all of... nothing larger.
    const bounded = harnessOf(recording, { journal: h.journal, engine: h.engine, clock: h.clock, signer: h.signer });
    Object.assign(bounded.ports, { maxFragmentBytes: third.byteLength - 1 });
    const { createSealingPipeline } = await import('../index');
    const outcome = sealedOf(await createSealingPipeline(bounded.ports).run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome.interrupted).toBe(true);
    expect(outcome.tracks.find((track) => track.trackId === 'VIDEO-02')?.fragmentCount).toBe(2);
    expect(readFileSync(quarantined(recording, 'VIDEO-02.mp4')).equals(original)).toBe(true);
    expect(bounded.log.entries.filter((entry) => entry.code === 'SEALING_CAMERA_PREFIX_SEALED').map((entry) => entry.context)).toEqual(expect.arrayContaining([expect.objectContaining({ trackId: 'VIDEO-02', failure: 'FRAGMENT_TOO_LARGE', firstBadSeq: 3 })]));
  });

  it('a resumed run after CLOSE_TRACKS keeps the prefix decision of its checkpoint and still quarantines the original', async () => {
    const recording = recordSession();
    wrongDigestAt(3)(recording);
    const original = readFileSync(recording.recordingFile('VIDEO-02'));
    const h = harnessOf(recording);
    const { SealingStop } = await import('../index');
    h.hook = (point) => {
      if (point.step === 'STORE_SEALED_PACKAGE' && point.phase === 'AFTER_WORK' && point.attempt === 1) throw new SealingStop(point);
    };
    await expect(h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    // The item is committed and the process ended before the DONE row: the next start FINISHES.
    h.hook = null;
    const outcome = sealedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome.interrupted).toBe(true);
    expect(outcome.tracks.map((track) => [track.trackId, track.fragmentCount])).toEqual([
      ['VIDEO-01', 5],
      ['VIDEO-02', 2],
    ]);
    expect(h.engine.sealed).toHaveLength(1);
    expect(readFileSync(quarantined(recording, 'VIDEO-02.mp4')).equals(original)).toBe(true);
    expect(existsSync(recording.recordingFile('VIDEO-02'))).toBe(false);
    const result = await verify(h);
    expect([result.ok, passing(result)]).toEqual([true, ALL]);
  });

  // ── Controls ────────────────────────────────────────────────────────────────────────────────
  it.each([
    ['its FIRST fragment is not what its row says', wrongDigestAt(1)],
    ['a byte of its FIRST fragment changed', changedByteAt(1)],
  ] as const)('CONTROL: VIDEO-02 has NO valid fragment (%s): the whole file is left out, as before the ruling, and quarantined', async (_label, damage) => {
    const recording = recordSession();
    damage(recording);
    const original = readFileSync(recording.recordingFile('VIDEO-02'));
    const h = harnessOf(recording);
    const outcome = sealedOf(await seal(h));
    expect(outcome.interrupted).toBe(true);
    expect(outcome.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01']);
    expect(manifestOf(recording).sealing.steps[0]?.checkpoint).toMatchObject({ tracks: 1, absentTracks: 'VIDEO-02' });
    expect(readFileSync(quarantined(recording, 'VIDEO-02.mp4')).equals(original)).toBe(true);
    expect(h.log.entries.some((entry) => entry.code === 'SEALING_CAMERA_LEFT_OUT' && entry.context?.trackId === 'VIDEO-02')).toBe(true);
    expect(h.log.entries.some((entry) => entry.code === 'SEALING_CAMERA_PREFIX_SEALED')).toBe(false);
  });

  it('CONTROL: NO camera file has a valid first fragment: NOTHING_SEALABLE, nothing signed, both recordings untouched, nothing in the quarantine', async () => {
    const recording = recordSession();
    for (const trackId of ['VIDEO-01', 'VIDEO-02'] as const) {
      const row = recording.tracks[trackId].rows[0]!;
      recording.tracks[trackId].rows[0] = { ...row, sha256: sha256Hex(Buffer.from(`not ${trackId}`)) };
    }
    const before = (['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => sha256Hex(readFileSync(recording.recordingFile(trackId))));
    const h = harnessOf(recording);
    expect(await seal(h)).toMatchObject({ status: 'FAILED', step: 'CLOSE_TRACKS', code: 'NOTHING_SEALABLE', retriable: false });
    expect(existsSync(recording.path(PackageFile.MANIFEST))).toBe(false);
    expect((['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => sha256Hex(readFileSync(recording.recordingFile(trackId))))).toEqual(before);
    expect(existsSync(join(recording.mediaDir, SEALING_QUARANTINE_DIR))).toBe(false);
  });

  it('CONTROL: a clean recording is sealed whole - no prefix, not interrupted, nothing in the quarantine', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    const outcome = sealedOf(await seal(h));
    expect(outcome.interrupted).toBe(false);
    expect(manifestOf(recording).files.flatMap((file) => file.fragments.map((fragment) => fragment.truncated))).toEqual(Array.from({ length: 10 }, () => false));
    expect(h.log.entries.some((entry) => entry.code === 'SEALING_CAMERA_PREFIX_SEALED')).toBe(false);
    expect(existsSync(join(recording.mediaDir, SEALING_QUARANTINE_DIR))).toBe(false);
  });

  it('the operator sentence names a prefix seal and a left-out file each in its own words', () => {
    expect(sealingOmittedNotice([], [])).toBeNull();
    expect(sealingOmittedNotice([{ trackId: 'VIDEO-01', code: 'CAMERA_FILE_UNUSABLE', reason: 'MISSING' }], [{ trackId: 'VIDEO-02', code: 'FRAGMENT_MISMATCH', sealedFragments: 2 }])).toBe(
      'Camera file VIDEO-01 could not be sealed (MISSING) and is left out: the recording is sealed as interrupted, and that file is kept in the quarantine folder. Camera file VIDEO-02 is sealed up to fragment 2 only (FRAGMENT_MISMATCH): the recording is sealed as interrupted, and the whole original file is kept in the quarantine folder.',
    );
  });
});
