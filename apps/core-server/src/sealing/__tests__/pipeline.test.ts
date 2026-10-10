// Row 82 (M7-W1): the sealing pipeline v2 on generated fragments (`pipeline-support.ts` says what
// is real and what is not). Evidence integrity: every verdict here has its control.
//
//   - the FIRST PRODUCT-SEALED PACKAGE: a session sealed by `createSealingPipeline` verifies PASS
//     through the verifier of rows 85 / 141, with every anchor the Core holds; M7-REF-1 (function
//     half: the reference hashes of a clean fake session, recomputed here by other code);
//   - one altered fragment of the product-sealed package is named exactly (ev §F.2 constants);
//   - a stopped run resumes from its checkpoints (smoke for row 86: every hook point once);
//   - the interrupted durable-prefix seal and the truncated tail (OD-08; AU2-08);
//   - what must never seal, does not.
//
// No database, no process, no worker, no wall-clock wait.
import { createHash } from 'node:crypto';
import { existsSync, linkSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FRAGMENT_CHAIN_GENESIS, PackageFile, declaredPackageFiles, fragmentsJsonMatchesManifest, nextFragmentChainHash, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
import { VERIFY_MAX_OPEN_FRAGMENT_BYTES, VERIFY_V2_CHECKS, verifyPackageV2, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { DEMO_TAMPERED_FRAGMENT_SEQ, DEMO_TAMPERED_FRAGMENT_TRACK } from '@dems/shared/sim';
import { createMemoryChunkMirror } from '@dems/transcriber';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../../evidence-verify';
import { SEALING_HOOK_PHASES, SEALING_MAX_FRAGMENT_BYTES, SEALING_STEP_ORDER, SealingStop, createSealingController, createSealingPipeline, durableMediaOnDisk, sealEngineOf, sealOnCaptureHandOff, sealingFailureReason, type SealOutcome, type SealingHookPoint, type SealingStepId } from '../index';
import { listPackageFiles } from '../pipeline/camera-files';
import { removePackages, throwAwaySigner } from './package-support';
import { CLOCK_START, TRACKS, harnessOf, recordSession, removeRecordings, sessionFacts, sha256Hex, type Harness, type Recording } from './pipeline-support';
import { manualClock, snapshotOf, transcribedSession } from './support';

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
const failedOf = (outcome: SealOutcome): Extract<SealOutcome, { status: 'FAILED' }> => {
  if (outcome.status !== 'FAILED') throw new Error(`not failed: ${outcome.status}`);
  return outcome;
};
const rowOf = (h: Harness, step: SealingStepId) => h.journal.rows.get(`${h.recording.sessionId}#${step}`);
const stopAt = (step: SealingStepId, phase: SealingHookPoint['phase']) => (point: SealingHookPoint) => {
  if (point.step === step && point.phase === phase) throw new SealingStop(point);
};
const nothingSigned = (recording: Recording): boolean => !existsSync(recording.path(PackageFile.MANIFEST)) && !existsSync(recording.path(PackageFile.SIGNATURE));

describe('the first product-sealed package (M7-REF-1, function half)', () => {
  it('a session sealed by the pipeline verifies PASS on all 15 checks with the Core\'s anchors, and its hashes are the bytes\' own', async () => {
    const recording = recordSession();
    // What the worker wrote, read before the seal (the last step removes the plaintext recordings).
    const recorded = Object.fromEntries(TRACKS.map((trackId) => [trackId, readFileSync(recording.recordingFile(trackId))]));
    const h = harnessOf(recording);
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome).toMatchObject({ attempt: 1, interrupted: false, skipped: [], transcriptSha256: null });

    const result = await verify(h);
    expect([result.ok, result.overall, result.interrupted, passing(result)]).toEqual([true, 'PASS', false, ALL]);
    expect(result.sources).toMatchObject({ code: 'DEVELOPMENT', development: true });

    // The package folder holds exactly what the package declares, in the D133 form.
    expect(recording.packageDir.endsWith(`SESSION-${recording.sessionId}`)).toBe(true);
    expect(await listPackageFiles(recording.packageDir)).toEqual([...declaredPackageFiles({ transcript: false })].sort());
    const manifest = manifestOf(recording);
    expect(fragmentsJsonMatchesManifest(readFileSync(recording.path(PackageFile.FRAGMENTS_JSON), 'utf8'), manifest.files)).toBe(true);
    expect(manifest).toMatchObject({ integrity: 'REAL', demo: false, developmentSources: true, sessionId: recording.sessionId, timeline: { interrupted: false, stoppedAt: CLOCK_START - 50_000, sealedAt: CLOCK_START } });
    expect(manifest.sealing.steps.map((step) => [step.step, step.status, step.attempt])).toEqual([['CLOSE_TRACKS', 'DONE', 1], ['FINALIZE_HASHES', 'DONE', 1], ['FINALIZE_TRANSCRIPT', 'DONE', 1]]);
    expect(manifest.audio.sourceIntervals.at(-1)).toMatchObject({ toMs: 10_000 });

    // M7-REF-1: the reference hashes, recomputed here from the sealed files and the worker's own bytes.
    for (const [index, trackId] of TRACKS.entries()) {
      const bytes = readFileSync(recording.cameraFile(trackId));
      const plain = recorded[trackId]!;
      const rows = recording.tracks[trackId].rows;
      const track = manifest.tracks[index];
      const reference = outcome.tracks[index];
      expect(track).toMatchObject({ trackId, bytes: bytes.length, sha256: sha256Hex(bytes), fragmentCount: 5, sourceClass: 'FAKE' });
      // THE CORE SEALED (D147): the init segment is clear and unchanged, every fragment range is
      // ciphertext of the same length at the same offset, and the plaintext hash is the recording's.
      const initLength = rows[0]!.byteOffset;
      expect(bytes.length).toBe(plain.length);
      expect(bytes.subarray(0, initLength).equals(plain.subarray(0, initLength))).toBe(true);
      expect(track?.sha256Plain).toBe(sha256Hex(plain));
      let chain = FRAGMENT_CHAIN_GENESIS;
      for (const [position, row] of rows.entries()) {
        const stored = bytes.subarray(row.byteOffset, row.byteOffset + row.byteLength);
        expect(stored.equals(plain.subarray(row.byteOffset, row.byteOffset + row.byteLength)), `${trackId} ${row.seq} is sealed`).toBe(false);
        chain = nextFragmentChainHash(chain, sha256Hex(stored));
        // Stored-bytes digest and chain are the sealed file's; the worker's recording-time digest is the plaintext digest.
        expect(manifest.files[index]?.fragments[position]).toMatchObject({ seq: row.seq, byteOffset: row.byteOffset, byteLength: row.byteLength, sha256: sha256Hex(stored), chainHash: chain, sha256Plain: row.sha256, keyId: `KID-${recording.sessionId}`, keyframe: true, interrupted: false, truncated: false });
      }
      expect(track?.fragmentChainHead).toBe(chain);
      expect(track?.fragmentChainHead).not.toBe(rows.at(-1)?.chainHash);
      expect(reference).toMatchObject({ sha256: track?.sha256, sha256Plain: track?.sha256Plain, fragmentChainHead: track?.fragmentChainHead });
      const third = manifest.files[index]?.fragments[2];
      expect(third?.prefixSha256).toBe(sha256Hex(bytes.subarray(0, (third?.byteOffset ?? 0) + (third?.byteLength ?? 0))));
      // The plaintext recording is gone once the item is committed; no key is beside the media.
      expect(existsSync(recording.recordingFile(trackId))).toBe(false);
    }
    expect(new Set(manifest.files.flatMap((file) => file.fragments.map((fragment) => fragment.gcmIv))).size).toBe(10);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')?.checkpoint).toMatchObject({ committed: 'SEALED', recordingsRemoved: 2 });

    // The item the engine was handed is the signed manifest's, and it was handed once.
    expect(h.engine.sealed).toHaveLength(1);
    expect(h.engine.sealed[0]?.input).toMatchObject({ manifestSha256: manifest.manifestSha256, sealedAt: manifest.timeline.sealedAt, interrupted: false, developmentSources: true, signature: { value: manifest.signature.value, keyId: manifest.signature.keyId, algorithm: 'Ed25519' } });
    expect(h.engine.sealed[0]?.input.tracks.map((track) => track.sha256)).toEqual(manifest.tracks.map((track) => track.sha256));
    // Every step has its DONE row; the session record was told each step, and never a failed one.
    for (const step of SEALING_STEP_ORDER) expect(rowOf(h, step), step).toMatchObject({ status: 'DONE', progress: 100, attempt: 1, errorCode: null });
    expect(h.engine.progress.at(-1)?.steps.map((step) => step.status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE', 'DONE', 'RUNNING']);
    expect(h.engine.progress.flatMap((entry) => entry.steps).some((step) => step.status === 'FAILED')).toBe(false);
    expect(h.log.entries).toEqual([]);
  });

  it('CONTROL and ev §F.2: one altered fragment of the product-sealed package is TAMPERED and named exactly', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    const row = recording.tracks[DEMO_TAMPERED_FRAGMENT_TRACK].rows[DEMO_TAMPERED_FRAGMENT_SEQ - 1]!;
    const file = recording.cameraFile(DEMO_TAMPERED_FRAGMENT_TRACK);
    const bytes = readFileSync(file);
    bytes[row.byteOffset + 100] = (bytes[row.byteOffset + 100] ?? 0) ^ 0x01;
    writeFileSync(file, bytes);
    const result = await verify(h);
    expect([result.ok, result.overall]).toEqual([false, 'TAMPERED']);
    expect(result.fragments.map((fragment) => [fragment.trackId, fragment.seq])).toEqual([[DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_FRAGMENT_SEQ]]);
    // The manifest, its digest, the signature and the certificate still pass: media was changed, not the seal.
    expect(passing(result)).toEqual(expect.arrayContaining(['V-01', 'V-03', 'V-09', 'V-13']));
  });

  it('with a machine transcript: the transcript is inside the seal, the item binds its hash, verify passes', async () => {
    const recording = recordSession();
    const mirror = createMemoryChunkMirror();
    const session = transcribedSession(recording.sessionId, { mirror });
    await session.finish();
    const h = harnessOf(recording, { transcript: { seam: session.seam, snapshot: snapshotOf({ backend: 'cpu-local' }), mirror } });
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    const manifest = manifestOf(recording);
    expect(manifest.transcript).toMatchObject({ state: 'ASSEMBLED', file: PackageFile.TRANSCRIPT_JSON, sha256: sha256Hex(readFileSync(session.files.json)) });
    expect(outcome.transcriptSha256).toBe(manifest.transcript.sha256);
    expect(h.engine.sealed[0]?.input).toMatchObject({ transcriptSha256: manifest.transcript.sha256 });
    expect(h.engine.sealed[0]?.transcript.transcriptRow?.jsonSha256).toBe(manifest.transcript.sha256);
    expect(readFileSync(recording.path(PackageFile.TRANSCRIPT_JSON)).equals(readFileSync(session.files.json))).toBe(true);
    expect(await listPackageFiles(recording.packageDir)).toEqual([...declaredPackageFiles({ transcript: true })].sort());
    const result = await verify(h);
    expect([result.ok, result.overall, passing(result)]).toEqual([true, 'PASS', ALL]);
    expect(result.transcriptState.code).toBe('READY');
    // Sealing asked the transcriber for nothing but the assembled transcript: no speech was decoded by the seal.
    expect(session.decoded.length).toBeGreaterThan(0);
  });
});

describe('a stopped run resumes from its checkpoints (smoke for the kill matrix of row 86)', () => {
  it('stopped after BUILD_MANIFEST did its work: the resumed run signs the SAME digest as an uninterrupted run, later', async () => {
    const original = recordSession();
    const signer = throwAwaySigner();
    const reference = harnessOf(original.clone(), { signer });
    const clean = sealedOf(await reference.pipeline.run({ sessionId: original.sessionId, cause: 'STOPPED' }));

    const h = harnessOf(original.clone(), { signer });
    h.hook = stopAt('BUILD_MANIFEST', 'AFTER_WORK');
    await expect(h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    // The stopped run left its row RUNNING with the frozen instants, wrote no FAILED row and signed nothing.
    expect(rowOf(h, 'BUILD_MANIFEST')).toMatchObject({ status: 'RUNNING', attempt: 1, checkpoint: { sealedAt: CLOCK_START, signedAt: CLOCK_START } });
    expect([...h.journal.rows.values()].some((row) => row.status === 'FAILED')).toBe(false);
    expect(nothingSigned(h.recording)).toBe(true);
    expect(h.engine.sealed).toHaveLength(0);
    // A package is never without media: the worker's recordings are there until the item is committed.
    expect(TRACKS.map((trackId) => existsSync(h.recording.recordingFile(trackId)))).toEqual([true, true]);

    h.clock.advance(60_000);
    h.hook = null;
    const resumed = sealedOf(await h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' }));
    expect(resumed).toMatchObject({ attempt: 2, skipped: ['CLOSE_TRACKS', 'FINALIZE_HASHES', 'FINALIZE_TRANSCRIPT'] });
    expect(resumed.manifestSha256).toBe(clean.manifestSha256);
    expect(manifestOf(h.recording).signature.value).toBe(manifestOf(reference.recording).signature.value);
    expect(readFileSync(h.recording.path(PackageFile.MANIFEST)).equals(readFileSync(reference.recording.path(PackageFile.MANIFEST)))).toBe(true);
    const result = await verify(h);
    expect([result.ok, passing(result)]).toEqual([true, ALL]);
  });

  it('CONTROL: without the frozen instants a resumed build has another digest (so the equality above is the checkpoint\'s doing)', async () => {
    const original = recordSession();
    const signer = throwAwaySigner();
    const reference = harnessOf(original.clone(), { signer });
    const clean = sealedOf(await reference.pipeline.run({ sessionId: original.sessionId, cause: 'STOPPED' }));
    const h = harnessOf(original.clone(), { signer });
    h.hook = stopAt('BUILD_MANIFEST', 'AFTER_WORK');
    await expect(h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    // The row loses its checkpoint: what a pipeline without the freeze would resume from.
    const row = rowOf(h, 'BUILD_MANIFEST')!;
    h.journal.rows.set(`${original.sessionId}#BUILD_MANIFEST`, { ...row, checkpoint: null });
    h.clock.advance(60_000);
    h.hook = null;
    const resumed = sealedOf(await h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' }));
    expect(resumed.manifestSha256).not.toBe(clean.manifestSha256);
  });

  it('every hook point once: stop there, start again, and the package is sealed, verifies, and has the reference media hashes', async () => {
    const original = recordSession({ fragments: 3 });
    const signer = throwAwaySigner();
    const reference = harnessOf(original.clone(), { signer });
    const clean = sealedOf(await reference.pipeline.run({ sessionId: original.sessionId, cause: 'STOPPED' }));
    const media = (outcome: Extract<SealOutcome, { status: 'SEALED' }>) => outcome.tracks.map((track) => [track.sha256, track.sha256Plain, track.fragmentChainHead, track.fragmentCount]);
    const seen: string[] = [];
    for (const [index, step] of SEALING_STEP_ORDER.entries()) {
      for (const phase of SEALING_HOOK_PHASES) {
        const h = harnessOf(original.clone(), { signer });
        h.hook = stopAt(step, phase);
        await expect(h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' }), `${step} ${phase}`).rejects.toBeInstanceOf(SealingStop);
        h.clock.advance(5_000);
        h.hook = null;
        const resumed = sealedOf(await h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' }));
        // A step whose row said DONE is not run again; the step that was stopped before its DONE row is.
        // (FINALIZE_TRANSCRIPT keeps its own row and writes DONE inside its work: its AFTER_WORK is after its checkpoint.)
        const rowDone = phase === 'AFTER_CHECKPOINT' || (step === 'FINALIZE_TRANSCRIPT' && phase === 'AFTER_WORK');
        expect(resumed.skipped, `${step} ${phase}`).toEqual(SEALING_STEP_ORDER.slice(0, rowDone ? index + 1 : index));
        expect(media(resumed), `${step} ${phase}`).toEqual(media(clean));
        const result = await verify(h);
        expect([result.ok, passing(result)], `${step} ${phase}`).toEqual([true, ALL]);
        // The item is committed exactly once, also when the stop came after the commit.
        expect(h.engine.sealed, `${step} ${phase}`).toHaveLength(1);
        seen.push(`${step}/${phase}`);
      }
    }
    expect(seen).toHaveLength(18);
  });
});

describe('the interrupted durable-prefix seal and the truncated tail (OD-08; ev §E.4; AU2-08)', () => {
  /** What a worker that died mid-write leaves after the last recorded fragment: the start of a sealed fragment, no record. */
  const tornTail = (): Buffer => Buffer.from(createHash('sha512').update('an unfinished fragment').digest()).subarray(0, 37);

  it('seals the durable prefix, drops and FLAGS the torn tail, marks the package, and the package still verifies (V-12)', async () => {
    const recording = recordSession();
    const before = statSync(recording.recordingFile('VIDEO-02')).size;
    recording.appendTail('VIDEO-02', tornTail());
    const h = harnessOf(recording, { facts: { stoppedAt: null } });
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'INTERRUPTED' }));
    expect(outcome.interrupted).toBe(true);
    // The tail is not in the sealed file, and it is said: checkpoint, session record, error log, manifest.
    expect(statSync(recording.cameraFile('VIDEO-02')).size).toBe(before);
    expect((rowOf(h, 'CLOSE_TRACKS')!.checkpoint as { tracks: { trackId: string; droppedBytes: number; tailReason: string | null }[] }).tracks.map((track) => [track.trackId, track.droppedBytes, track.tailReason !== null])).toEqual([['VIDEO-01', 0, false], ['VIDEO-02', 37, true]]);
    expect(h.engine.progress.find((entry) => entry.truncatedTails !== undefined)?.truncatedTails).toEqual([{ trackId: 'VIDEO-02', droppedBytes: 37 }]);
    expect(h.log.entries.map((entry) => entry.code)).toEqual(['SEALING_TORN_TAIL_DROPPED']);
    const manifest = manifestOf(recording);
    expect(manifest.timeline).toMatchObject({ interrupted: true, stoppedAt: null, durableEndMs: CLOCK_START - 60_000 + 10_000, recordingDurationMs: 10_000 });
    expect(manifest.files.flatMap((file) => file.fragments).every((fragment) => fragment.interrupted)).toBe(true);
    expect(manifest.files.map((file) => file.fragments.map((fragment) => fragment.truncated))).toEqual([[false, false, false, false, false], [false, false, false, false, true]]);
    expect(h.engine.sealed[0]?.input).toMatchObject({ interrupted: true, durableEndAt: CLOCK_START - 50_000 });
    const result = await verify(h);
    expect([result.ok, result.overall, result.interrupted, passing(result)]).toEqual([true, 'PASS', true, ALL]);
  });

  it('a torn tail after a clean stop is not sealed as whole: the seal is an interrupted one', async () => {
    const recording = recordSession();
    recording.appendTail('VIDEO-01', tornTail());
    const h = harnessOf(recording);
    expect(sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' })).interrupted).toBe(true);
    expect(manifestOf(recording).timeline).toMatchObject({ interrupted: true, stoppedAt: null });
  });

  it('CONTROL: the same recording without a torn tail, interrupted, drops nothing and flags no fragment as truncated', async () => {
    const recording = recordSession();
    const h = harnessOf(recording, { facts: { stoppedAt: null } });
    expect(sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'INTERRUPTED' })).interrupted).toBe(true);
    expect(h.engine.progress.some((entry) => entry.truncatedTails !== undefined)).toBe(false);
    expect(manifestOf(recording).files.flatMap((file) => file.fragments).some((fragment) => fragment.truncated)).toBe(false);
    expect(h.log.entries).toEqual([]);
  });

  it('AU2-08: a recording cut INSIDE an mdat is found by the box walk; the cut fragment is left out and flagged, the durable prefix is sealed and verifies', async () => {
    const recording = recordSession();
    const file = recording.recordingFile('VIDEO-01');
    const rows = recording.tracks['VIDEO-01'].rows;
    const durable = rows[3]!.byteOffset + rows[3]!.byteLength;
    // The fifth fragment was being written when the worker died: its record never came, its mdat is cut.
    rows.pop();
    writeFileSync(file, readFileSync(file).subarray(0, durable + 200));
    const h = harnessOf(recording, { facts: { stoppedAt: null } });
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'INTERRUPTED' }));
    expect(statSync(recording.cameraFile('VIDEO-01')).size).toBe(durable);
    expect((rowOf(h, 'CLOSE_TRACKS')!.checkpoint as { tracks: { droppedBytes: number; tailReason: string; fragments: number }[] }).tracks[0]).toMatchObject({ droppedBytes: 200, tailReason: 'DECLARED_SIZE_EXCEEDS_BYTES_PRESENT', fragments: 4 });
    expect(outcome.tracks.map((track) => track.fragmentCount)).toEqual([4, 5]);
    const result = await verify(h);
    expect([result.ok, result.interrupted, passing(result)]).toEqual([true, true, ALL]);
  });

  it('whole fragments the live recorder is behind with (`fragmentRowsBehind`): their rows are rebuilt from the validated file, nothing is left out, the seal is a whole one', async () => {
    const recording = recordSession();
    const rows = recording.tracks['VIDEO-02'].rows;
    const reference = rows.map((row) => ({ ...row }));
    const size = statSync(recording.recordingFile('VIDEO-02')).size;
    rows.splice(3);
    const h = harnessOf(recording);
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome.interrupted).toBe(false);
    expect(statSync(recording.cameraFile('VIDEO-02')).size).toBe(size);
    expect((rowOf(h, 'CLOSE_TRACKS')!.checkpoint as { tracks: { tailReason: string | null; rowsAdded: number; fragments: number }[] }).tracks[1]).toMatchObject({ tailReason: null, rowsAdded: 2, fragments: 5 });
    // The rebuilt rows are the rows the worker's records would have given: range, digest, chain, media time.
    expect(rows.map(({ durableAt: _at, ...row }) => row)).toEqual(reference.map(({ durableAt: _at, ...row }) => row));
    expect((await verify(h)).ok).toBe(true);
  });

  describe('a failed start is decided by WALKING THE FILES, never by the rows alone (ruling D144 (2))', () => {
    /** A Core that died between the worker's write and the row insert: whole fragments on the disk, no row. */
    const withoutRows = () => {
      const recording = recordSession();
      for (const trackId of TRACKS) recording.tracks[trackId].rows.length = 0;
      return recording;
    };

    it('a durable fragment on the disk and no row is an INTERRUPTED recording: durable, its rows are inserted from the file, the seal is an interrupted one', async () => {
      const recording = withoutRows();
      expect(await durableMediaOnDisk(recording.packageDir)).toBe(true);
      const h = harnessOf(recording, { facts: { stoppedAt: null } });
      const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'INTERRUPTED' }));
      const closed = rowOf(h, 'CLOSE_TRACKS')!.checkpoint as { interrupted: boolean; tracks: { rowsAdded: number; fragments: number }[] };
      expect(closed).toMatchObject({ interrupted: true, tracks: [{ rowsAdded: 5, fragments: 5 }, { rowsAdded: 5, fragments: 5 }] });
      expect(TRACKS.map((trackId) => recording.tracks[trackId].rows.map((row) => row.seq))).toEqual([[1, 2, 3, 4, 5], [1, 2, 3, 4, 5]]);
      expect(outcome.interrupted).toBe(true);
      const result = await verify(h);
      expect([result.ok, result.interrupted, passing(result)]).toEqual([true, true, ALL]);
    });

    it('CONTROL: no valid fragment on the disk (an init segment and a cut first fragment) and no row is a FAILED START: no row of sealing_jobs, no item, nothing told', async () => {
      const recording = withoutRows();
      for (const trackId of TRACKS) {
        const bytes = readFileSync(recording.recordingFile(trackId));
        const first = bytes.indexOf(Buffer.from('moof', 'ascii')) - 4;
        writeFileSync(recording.recordingFile(trackId), bytes.subarray(0, first + 300));
      }
      expect(await durableMediaOnDisk(recording.packageDir)).toBe(false);
      const h = harnessOf(recording, { facts: { stoppedAt: null } });
      expect(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'INTERRUPTED' })).toEqual({ status: 'NOTHING_DURABLE', sessionId: recording.sessionId });
      expect(h.journal.writes).toHaveLength(0);
      expect(h.engine.progress).toHaveLength(0);
      expect(h.engine.sealed).toHaveLength(0);
      // The files are left exactly where and as they were: nothing was moved or cut.
      expect(existsSync(recording.path(PackageFile.FRAGMENTS_DIR))).toBe(false);
    });

    it('no file at all and no row: a failed start as well', async () => {
      const recording = withoutRows();
      for (const trackId of TRACKS) rmSync(recording.recordingFile(trackId));
      expect(await durableMediaOnDisk(recording.packageDir)).toBe(false);
      const h = harnessOf(recording);
      expect((await h.pipeline.run({ sessionId: recording.sessionId, cause: 'INTERRUPTED' })).status).toBe('NOTHING_DURABLE');
      expect(h.journal.writes).toHaveLength(0);
    });
  });
});

describe('what must never seal, does not (each fails closed, with its row and its log entry)', () => {
  async function refused(prepare: (recording: Recording, h: Harness) => void, options: Parameters<typeof harnessOf>[1] = {}): Promise<{ h: Harness; outcome: Extract<SealOutcome, { status: 'FAILED' }> }> {
    const recording = recordSession();
    const h = harnessOf(recording, options);
    prepare(recording, h);
    const outcome = failedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(rowOf(h, outcome.step)).toMatchObject({ status: 'FAILED', errorCode: outcome.code });
    expect(h.log.entries.some((entry) => entry.level === 'error' && entry.code === outcome.code)).toBe(true);
    expect(h.engine.sealed).toHaveLength(0);
    return { h, outcome };
  }

  it('a byte of the recording was changed before the seal: it is not the fragment its row recorded, and nothing is sealed', async () => {
    const { h, outcome } = await refused((recording) => {
      const row = recording.tracks['VIDEO-01'].rows[1]!;
      const bytes = readFileSync(recording.recordingFile('VIDEO-01'));
      bytes[row.byteOffset + 90] = (bytes[row.byteOffset + 90] ?? 0) ^ 0x80;
      writeFileSync(recording.recordingFile('VIDEO-01'), bytes);
    });
    expect(outcome).toMatchObject({ step: 'CLOSE_TRACKS', code: 'FRAGMENT_MISMATCH', retriable: false, detail: { trackId: 'VIDEO-01', seq: 2, member: 'fragSha256' } });
    expect(nothingSigned(h.recording)).toBe(true);
    expect(existsSync(h.recording.cameraFile('VIDEO-01'))).toBe(false);
  });

  it('a row whose digest is not the bytes\' (the recording-time chain disagrees with the file): CORRUPT, the fragment is named', async () => {
    const { h, outcome } = await refused((recording) => {
      const row = recording.tracks['VIDEO-02'].rows[2]!;
      recording.tracks['VIDEO-02'].rows[2] = { ...row, sha256: sha256Hex(Buffer.from('another fragment')) };
    });
    expect(outcome).toMatchObject({ step: 'CLOSE_TRACKS', code: 'FRAGMENT_MISMATCH', detail: { trackId: 'VIDEO-02', seq: 3, member: 'fragSha256' } });
    expect(nothingSigned(h.recording)).toBe(true);
  });

  it('bytes that were recorded as durable are gone from the recording', async () => {
    const { outcome } = await refused((recording) => {
      const last = recording.tracks['VIDEO-01'].rows.at(-1)!;
      writeFileSync(recording.recordingFile('VIDEO-01'), readFileSync(recording.recordingFile('VIDEO-01')).subarray(0, last.byteOffset));
    });
    expect(outcome).toMatchObject({ step: 'CLOSE_TRACKS', code: 'DURABLE_BYTES_MISSING' });
  });

  // THE KNOWN LIMIT (ev §B.4 "tracks[] of exactly 2"; ruling D147): a session whose second camera
  // never produced a whole fragment cannot be sealed. It must END - in a named failure with a
  // sentence an operator reads - and never hang or be presented as sealed (row 82b).
  it.each([
    ['holds an init segment and a cut first fragment (the box walk names it by its first flag)', 'NO_INIT_SEGMENT', (recording: Recording) => writeFileSync(recording.recordingFile('VIDEO-02'), readFileSync(recording.recordingFile('VIDEO-02')).subarray(0, recording.tracks['VIDEO-02'].rows[0]!.byteOffset + 10))],
    ['was never written', 'MISSING', (recording: Recording) => rmSync(recording.recordingFile('VIDEO-02'))],
  ] as const)('the second camera file %s while the first recorded: a NAMED failure with an operator-readable reason, nothing signed, and the next attempt ends the same way', async (_label, reason, damage) => {
    const { h, outcome } = await refused((recording) => {
      damage(recording);
      recording.tracks['VIDEO-02'].rows.length = 0;
    });
    expect(outcome).toMatchObject({ status: 'FAILED', step: 'CLOSE_TRACKS', code: 'CAMERA_FILE_UNUSABLE', retriable: false, attempt: 1, detail: { trackId: 'VIDEO-02', reason } });
    // What the session record (operation 83, the Finalizing screen) is told: the step FAILED, and why, in words.
    const told = h.engine.progress.at(-1)?.steps.find((step) => step.id === 'CLOSE_TRACKS');
    expect(told).toMatchObject({ status: 'FAILED', etaMs: null, detail: `Camera file VIDEO-02 holds no whole recording (${reason}): this session cannot be sealed.` });
    expect(h.engine.progress.at(-1)?.steps.filter((step) => step.status === 'RUNNING')).toEqual([]);
    expect(nothingSigned(h.recording)).toBe(true);
    expect(existsSync(h.recording.path(PackageFile.FRAGMENTS_JSON))).toBe(false);
    // The recording of the camera that did record is still there, untouched: nothing was lost by trying.
    expect(sha256Hex(readFileSync(h.recording.recordingFile('VIDEO-01')))).toBe(sha256Hex(Buffer.concat([readFileSync(h.recording.recordingFile('VIDEO-01')).subarray(0, h.recording.tracks['VIDEO-01'].rows[0]!.byteOffset), ...h.recording.tracks['VIDEO-01'].plain])));
    // NOT A HANG AND NOT A LOOP: a second run is one more attempt, ends at once, with the same name.
    const again = failedOf(await h.again().run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    expect(again).toMatchObject({ step: 'CLOSE_TRACKS', code: 'CAMERA_FILE_UNUSABLE', attempt: 2 });
    expect(h.engine.sealed).toHaveLength(0);
  });

  it('CONTROL of the reason: a step that did not fail carries no failure sentence, and a failed one carries the sentence of ITS code', async () => {
    const good = harnessOf(recordSession());
    sealedOf(await good.pipeline.run({ sessionId: good.recording.sessionId, cause: 'STOPPED' }));
    expect(good.engine.progress.flatMap((report) => report.steps).filter((step) => /cannot be sealed|seal stopped|nothing was/i.test(step.detail ?? ''))).toEqual([]);
    const { h } = await refused((recording) => {
      const last = recording.tracks['VIDEO-01'].rows.at(-1)!;
      writeFileSync(recording.recordingFile('VIDEO-01'), readFileSync(recording.recordingFile('VIDEO-01')).subarray(0, last.byteOffset));
    });
    expect(h.engine.progress.at(-1)?.steps.find((step) => step.status === 'FAILED')?.detail).toBe('Recorded bytes of camera file VIDEO-01 are missing: this session cannot be sealed.');
  });

  it('field 50 `keyframeAligned` is what the box walk found of the sealed fragments, not a statement of the session record', async () => {
    const h = harnessOf(recordSession(), { facts: { tracks: [{ ...sessionFacts('SES-20261009-0001').tracks[0], keyframeAligned: false }, { ...sessionFacts('SES-20261009-0001').tracks[1], keyframeAligned: false }] } });
    sealedOf(await h.pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    const manifest = manifestOf(h.recording);
    expect(manifest.files.flatMap((file) => file.fragments.map((fragment) => fragment.keyframe)).every(Boolean)).toBe(true);
    expect(manifest.tracks.map((track) => track.keyframeAligned)).toEqual([true, true]);
  });

  it('the SEALED file was altered between CLOSE_TRACKS and FINALIZE_HASHES: the re-read finds the fragment, nothing is signed', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    h.hook = stopAt('CLOSE_TRACKS', 'AFTER_CHECKPOINT');
    await expect(h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    const row = recording.tracks['VIDEO-02'].rows[3]!;
    const bytes = readFileSync(recording.cameraFile('VIDEO-02'));
    bytes[row.byteOffset + 17] = (bytes[row.byteOffset + 17] ?? 0) ^ 0x01;
    writeFileSync(recording.cameraFile('VIDEO-02'), bytes);
    h.hook = null;
    const outcome = failedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome).toMatchObject({ step: 'FINALIZE_HASHES', code: 'FRAGMENT_MISMATCH', detail: { trackId: 'VIDEO-02', seq: 4, member: 'sha256' } });
    expect(nothingSigned(recording)).toBe(true);
    // The plaintext recording is still there: a package is never left without media.
    expect(existsSync(recording.recordingFile('VIDEO-02'))).toBe(true);
  });

  it('a cipher record of the fragment table was altered (the IV): the stored bytes are the sealed ones, yet the range does not open', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    h.hook = stopAt('CLOSE_TRACKS', 'AFTER_CHECKPOINT');
    await expect(h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    const table = JSON.parse(readFileSync(recording.path(PackageFile.FRAGMENTS_JSON), 'utf8'));
    table.files[0].fragments[0].gcmIv = '00'.repeat(12);
    writeFileSync(recording.path(PackageFile.FRAGMENTS_JSON), JSON.stringify(table));
    h.hook = null;
    expect(failedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }))).toMatchObject({ step: 'FINALIZE_HASHES', code: 'FRAGMENT_NOT_OPENABLE', detail: { trackId: 'VIDEO-01', seq: 1 } });
  });

  it('no session key to open with: the sealed files are not taken on trust', async () => {
    const { outcome } = await refused((_recording, h) => Object.assign(h.ports, { opener: null }));
    expect(outcome).toMatchObject({ step: 'FINALIZE_HASHES', code: 'FRAGMENT_NOT_OPENABLE', retriable: true });
  });

  it('the session key cannot be made: nothing is sealed, the recording stays', async () => {
    const { h, outcome } = await refused((_recording, harness) =>
      Object.assign(harness.ports, {
        sealer: {
          seal: () => {
            throw new Error('the credential store is not ready');
          },
        },
      }),
    );
    expect(outcome).toMatchObject({ step: 'CLOSE_TRACKS', code: 'SEALER_FAILED', retriable: true });
    expect(existsSync(h.recording.recordingFile('VIDEO-01'))).toBe(true);
    expect(existsSync(h.recording.cameraFile('VIDEO-01'))).toBe(false);
  });

  it('a session without its four source rows: the manifest is not built, nothing is signed, PRODUCTION is never written by default (ev §E.6)', async () => {
    const { h, outcome } = await refused((_recording, harness) => {
      harness.facts = { ...harness.facts, sourceRows: harness.facts.sourceRows.slice(0, 3) };
    });
    expect(outcome).toMatchObject({ step: 'BUILD_MANIFEST', code: 'MANIFEST_INVALID', detail: { packageCode: 'SOURCE_RECORD_MISSING' } });
    expect(nothingSigned(h.recording)).toBe(true);
  });

  it('a file the package does not declare is in its folder: the package is not stored and the item is not committed', async () => {
    const { h, outcome } = await refused((recording) => writeFileSync(recording.path('notes.txt'), 'left behind'));
    expect(outcome).toMatchObject({ step: 'STORE_SEALED_PACKAGE', code: 'PACKAGE_NOT_CLEAN', detail: { undeclared: 1 } });
    expect(h.engine.completeCalls).toBe(0);
  });

  it('the session record changed between BUILD_MANIFEST and a resumed SIGN_MANIFEST: the signer signs the digest of the checkpoint or nothing', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    h.hook = stopAt('BUILD_MANIFEST', 'AFTER_CHECKPOINT');
    await expect(h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    h.facts = { ...h.facts, caseNumber: 'LP/2026/9999-0001' };
    h.hook = null;
    const outcome = failedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome).toMatchObject({ step: 'SIGN_MANIFEST', code: 'MANIFEST_NOT_REPRODUCIBLE', retriable: false });
    expect(nothingSigned(recording)).toBe(true);
    expect(h.engine.sealed).toHaveLength(0);
  });

  it('an engine that is not running fails the run as retriable, and the next run seals', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    h.engine.refuseProgress = true;
    expect(failedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }))).toMatchObject({ step: 'CLOSE_TRACKS', code: 'ENGINE_REFUSED', retriable: true });
    h.engine.refuseProgress = false;
    expect(sealedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).attempt).toBe(2);
    expect((await verify(h)).ok).toBe(true);
  });
});

describe('`.part` names beside a camera file (pair-58 R-5)', () => {
  it('a second name of the camera file is removed as a name; a file of its own is moved out with its bytes; the package is clean and verifies', async () => {
    const recording = recordSession();
    const camera = recording.recordingFile('VIDEO-01');
    linkSync(camera, `${camera}.4711.part`);
    expect(statSync(camera).nlink).toBe(2);
    writeFileSync(`${recording.recordingFile('VIDEO-02')}.4712.part`, 'an orphan of a dead worker');
    const h = harnessOf(recording);
    sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect((rowOf(h, 'CLOSE_TRACKS')!.checkpoint as { tracks: { partNamesRemoved: number; orphansMoved: number }[] }).tracks.map((track) => [track.partNamesRemoved, track.orphansMoved])).toEqual([[1, 0], [0, 1]]);
    expect(readFileSync(join(recording.stagingDir, 'orphans', 'VIDEO-02.mp4.4712.part'), 'utf8')).toBe('an orphan of a dead worker');
    expect((await verify(h)).ok).toBe(true);
    expect(await listPackageFiles(recording.packageDir)).toEqual([...declaredPackageFiles({ transcript: false })].sort());
  });
});

describe('the controller: one run per session, the engine port, and what a restart needs', () => {
  const state = (session: { id: string; state: string; stoppedAt: number | null; fault: { fromState: string } | null } | null, evidence: { sessionId: string; manifestHash: string; integritySource?: string }[] = []) => ({ session, evidence });

  it('a second call while a run is under way joins it; a later call is a new attempt', async () => {
    const recording = recordSession({ fragments: 2 });
    const h = harnessOf(recording);
    const controller = createSealingController({ pipeline: h.pipeline, engine: () => ({ applySealingProgress: async () => undefined, completeSeal: async () => undefined, state: () => state(null) }), hasDurableMedia: async () => true, hasSealingRows: async () => false, hasOpenSealingRows: async () => false });
    const [first, second] = [controller.seal(recording.sessionId, 'STOPPED'), controller.seal(recording.sessionId, 'STOPPED')];
    expect(second).toBe(first);
    expect(controller.running()).toBe(recording.sessionId);
    expect(sealedOf(await first).attempt).toBe(1);
    expect(controller.running()).toBeNull();
    expect(h.engine.completeCalls).toBe(1);
  });

  it.each([
    ['no session', null, false, false, { action: 'NONE' }],
    ['a sealed session whose journal is closed', { state: 'SEALED', stoppedAt: 5, fault: null }, true, true, { action: 'NONE' }],
    ['faulted before it recorded', { state: 'FAULT', stoppedAt: null, fault: { fromState: 'PRECHECK' } }, true, false, { action: 'NONE' }],
    ['faulted while recording, nothing durable (a failed start)', { state: 'FAULT', stoppedAt: null, fault: { fromState: 'RECORDING' } }, false, false, { action: 'NONE' }],
    ['faulted while recording, a fragment is durable', { state: 'FAULT', stoppedAt: null, fault: { fromState: 'RECORDING' } }, true, false, { action: 'SEAL', cause: 'INTERRUPTED' }],
    ['faulted while finalizing after a stop (a process start)', { state: 'FAULT', stoppedAt: 5, fault: { fromState: 'FINALIZING' } }, true, true, { action: 'SEAL', cause: 'STOPPED' }],
    ['an interrupted seal that had begun', { state: 'FAULT', stoppedAt: null, fault: { fromState: 'FINALIZING' } }, true, true, { action: 'SEAL', cause: 'INTERRUPTED' }],
  ] as const)('decide: %s', async (_name, session, durable, rows, expected) => {
    const controller = createSealingController({
      pipeline: { run: async () => ({ status: 'NOTHING_DURABLE', sessionId: 'SES-20261009-0001' }) },
      engine: () => ({ applySealingProgress: async () => undefined, completeSeal: async () => undefined, state: () => state(session === null ? null : { id: 'SES-20261009-0001', ...session, fault: session.fault === null ? null : { ...session.fault } }) }),
      hasDurableMedia: async () => durable,
      hasSealingRows: async () => rows,
      hasOpenSealingRows: async () => false,
    });
    expect(await controller.decide()).toMatchObject(expected);
  });

  // Row 82c, finding F-86-2: SEALED is not always finished.
  it.each([
    ['its REAL item is committed and its journal is open: the last step is finished', 'SEALED', 'REAL', true, { action: 'FINISH', sessionId: 'SES-20261009-0001', cause: 'STOPPED' }],
    ['CONTROL: the journal is closed', 'SEALED', 'REAL', false, { action: 'NONE' }],
    ['CONTROL: the engine holds no REAL item of the session (a simulated seal)', 'SEALED', 'SIMULATED', true, { action: 'NONE' }],
    ['CONTROL: the item is of another session', 'SEALED', null, true, { action: 'NONE' }],
  ] as const)('decide for a SEALED session: %s', async (_name, sessionState, source, open, expected) => {
    const evidence = source === null ? [{ sessionId: 'SES-20261009-0002', manifestHash: 'ab'.repeat(32), integritySource: 'REAL' }] : [{ sessionId: 'SES-20261009-0001', manifestHash: 'ab'.repeat(32), integritySource: source }];
    const controller = createSealingController({
      pipeline: { run: async () => ({ status: 'NOTHING_DURABLE', sessionId: 'SES-20261009-0001' }) },
      engine: () => ({ applySealingProgress: async () => undefined, completeSeal: async () => undefined, state: () => state({ id: 'SES-20261009-0001', state: sessionState, stoppedAt: 5, fault: null }, evidence) }),
      hasDurableMedia: async () => true,
      hasSealingRows: async () => true,
      hasOpenSealingRows: async () => open,
    });
    expect(await controller.decide()).toEqual(expected);
  });

  it('the engine port: a sealed item is not committed twice, and a late report after the commit is dropped', async () => {
    const calls: string[] = [];
    let held = state({ id: 'SES-20261009-0001', state: 'FINALIZING', stoppedAt: 5, fault: null });
    const engine = sealEngineOf(
      () => ({ applySealingProgress: async () => void calls.push('progress'), completeSeal: async (_input, also) => void (calls.push('complete'), await also?.({} as never, 'EV-20261009-0001')), state: () => held }),
      async (_unit, evidenceId) => void calls.push(`transcript ${evidenceId}`),
    );
    const input = { sessionId: 'SES-20261009-0001', manifestSha256: 'ab'.repeat(32), sealedAt: 9 } as never;
    await engine.applySealingProgress({ sessionId: 'SES-20261009-0001', steps: [] });
    expect(engine.isSealed('SES-20261009-0001', 'ab'.repeat(32))).toBe(false);
    expect(await engine.completeSeal(input, {} as never)).toBe('SEALED');
    held = state({ id: 'SES-20261009-0001', state: 'SEALED', stoppedAt: 5, fault: null }, [{ sessionId: 'SES-20261009-0001', manifestHash: 'ab'.repeat(32), integritySource: 'REAL' }]);
    expect(await engine.completeSeal(input, {} as never)).toBe('ALREADY_SEALED');
    expect(engine.isSealed('SES-20261009-0001', 'ab'.repeat(32))).toBe(true);
    expect(engine.isSealed('SES-20261009-0001', 'cd'.repeat(32))).toBe(false);
    await engine.applySealingProgress({ sessionId: 'SES-20261009-0001', steps: [] });
    expect(calls).toEqual(['progress', 'complete', 'transcript EV-20261009-0001']);
  });
});

describe('the seal\'s entry on the capture hand-off (ruling D144 (1))', () => {
  it('STOPPED starts the normal seal, INTERRUPTED the interrupted one; FAILED_START and every other event start nothing', async () => {
    const listeners: ((event: { type: string; sessionId: string; firstVideo?: readonly unknown[] }) => void)[] = [];
    const asked: string[] = [];
    const firstVideo: unknown[] = [];
    const errors: string[] = [];
    const off = sealOnCaptureHandOff({
      capture: { on: (listener) => (listeners.push(listener), () => void listeners.splice(0)) },
      controller: {
        seal: async (sessionId, cause) => {
          asked.push(`${sessionId} ${cause}`);
          if (sessionId.endsWith('0003')) throw new Error('stopped');
          return { status: 'NOTHING_DURABLE', sessionId };
        },
      },
      onError: (sessionId) => void errors.push(sessionId),
      onFirstVideo: (_sessionId, entries) => void firstVideo.push(...entries),
    });
    const say = (type: string, sessionId: string, more: object = {}) => listeners[0]?.({ type, sessionId, ...more });
    say('CONNECTING', 'SES-20261009-0001');
    say('DURABLE', 'SES-20261009-0001');
    say('FAILED_START', 'SES-20261009-0001');
    say('STOPPED', 'SES-20261009-0001', { firstVideo: [{ deviceId: 'CAM-01', skippedSpanMs: 480 }] });
    say('INTERRUPTED', 'SES-20261009-0002');
    say('STOPPED', 'SES-20261009-0003');
    await new Promise((resolve) => setImmediate(resolve));
    expect(asked).toEqual(['SES-20261009-0001 STOPPED', 'SES-20261009-0002 INTERRUPTED', 'SES-20261009-0003 STOPPED']);
    expect(firstVideo).toEqual([{ deviceId: 'CAM-01', skippedSpanMs: 480 }]);
    expect(errors).toEqual(['SES-20261009-0003']);
    off();
    expect(listeners).toHaveLength(0);
  });
});

describe('progress while a step runs (ev §E.2; D121)', () => {
  it('a running step reports forward-only progress and ITS OWN remaining time from the Core clock', async () => {
    const recording = recordSession({ fragments: 8 });
    const clock = manualClock(CLOCK_START);
    const h = harnessOf(recording, { clock });
    // Every read of the opener takes "time": the Core clock moves, so the throttle lets reports through.
    const opener = recording.opener;
    Object.assign(h.ports, { opener: { hasKey: opener.hasKey, open: (record: never, stored: Uint8Array) => (clock.advance(400), opener.open(record, stored)) } });
    sealedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    const hashing = h.engine.progress.map((entry) => entry.steps[1]!).filter((step) => step.status === 'RUNNING');
    const values = hashing.map((step) => step.progress);
    expect(values.length).toBeGreaterThan(3);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(Math.max(...values)).toBeLessThan(100);
    const etas = hashing.map((step) => step.etaMs).filter((eta): eta is number => eta !== null);
    expect(etas.length).toBeGreaterThan(1);
    // The step's own remaining time shrinks toward 0; it is never the remaining time of the run.
    expect(etas.at(-1)!).toBeLessThan(etas[0]!);
    expect(hashing.at(-1)?.detail).toMatch(/fragments \(VIDEO-02\)/);
  });
});

// ── Row 82c ───────────────────────────────────────────────────────────────────────────────────────
describe('ONE fragment bound for the pipeline and its verifier (row 82c; finding F-86-1)', () => {
  const largestOf = (recording: Recording): { trackId: (typeof TRACKS)[number]; seq: number; bytes: number } =>
    TRACKS.flatMap((trackId) => recording.tracks[trackId].rows.map((row) => ({ trackId, seq: row.seq, bytes: row.byteLength }))).reduce((largest, row) => (row.bytes > largest.bytes ? row : largest));
  const verifyAt = (h: Harness, maxOpenFragmentBytes: number): Promise<PackageVerifyResult> => verifyPackageV2(corePorts(h.recording.packageDir, h.recording.opener, 256), { plaintext: 'REQUIRED', expected: h.anchors(), maxOpenFragmentBytes });

  it('the bound of the pipeline IS the constant of the verifier (imported, not a second number)', () => {
    expect(SEALING_MAX_FRAGMENT_BYTES).toBe(VERIFY_MAX_OPEN_FRAGMENT_BYTES);
    expect(SEALING_MAX_FRAGMENT_BYTES).toBe(64 * 1024 * 1024);
  });

  it('THE CAUSE OF F-86-1, reproduced: a verifier whose bound is below a sealed fragment answers ok false / CORRUPT / exactly V-05, by the code FRAGMENT_TOO_LARGE', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    sealedOf(await h.pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    const largest = largestOf(h.recording);
    const refused = await verifyAt(h, largest.bytes - 1);
    expect({ ok: refused.ok, overall: refused.overall }).toEqual({ ok: false, overall: 'CORRUPT' });
    expect(refused.checks.filter((check) => check.status === 'FAIL').map((check) => check.id)).toEqual(['V-05']);
    expect(refused.checks.find((check) => check.id === 'V-05')?.findings.map((finding) => finding.code)).toEqual(['FRAGMENT_TOO_LARGE']);
    expect(refused.checks.find((check) => check.id === 'V-05')?.findings[0]).toMatchObject({ trackId: largest.trackId, seq: largest.seq });
    // CONTROL: the same package under a bound that holds its largest fragment passes all 15 checks.
    const held = await verifyAt(h, largest.bytes);
    expect(held.ok).toBe(true);
    expect(passing(held)).toEqual(ALL);
  });

  it('a fragment above the bound is refused at CLOSE_TRACKS, BY NAME, before a sealed byte exists and before anything is signed', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    const largest = largestOf(h.recording);
    const pipeline = createSealingPipeline({ ...h.ports, maxFragmentBytes: largest.bytes - 1 });
    const outcome = failedOf(await pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    expect(outcome).toMatchObject({ step: 'CLOSE_TRACKS', code: 'FRAGMENT_TOO_LARGE', retriable: false, attempt: 1 });
    expect(outcome.detail).toEqual({ trackId: largest.trackId, seq: largest.seq, bytes: largest.bytes, limitBytes: largest.bytes - 1 });
    // Nothing sealed, nothing signed, nothing committed; the recordings are untouched.
    expect(nothingSigned(h.recording)).toBe(true);
    for (const trackId of TRACKS) {
      expect(existsSync(h.recording.cameraFile(trackId))).toBe(false);
      expect(existsSync(h.recording.recordingFile(trackId))).toBe(true);
    }
    expect(existsSync(h.recording.path(PackageFile.FRAGMENTS_JSON))).toBe(false);
    expect(h.engine.completeCalls).toBe(0);
    expect(SEALING_STEP_ORDER.map((step) => rowOf(h, step)?.status ?? null)).toEqual(['FAILED', null, null, null, null, null]);
    expect(rowOf(h, 'CLOSE_TRACKS')?.errorCode).toBe('FRAGMENT_TOO_LARGE');
    expect(h.log.entries.filter((entry) => entry.code === 'FRAGMENT_TOO_LARGE')).toHaveLength(1);
    // What an operator reads (operation 83): the file, the fragment, both sizes.
    const told = h.engine.progress.at(-1)?.steps.find((step) => step.id === 'CLOSE_TRACKS');
    expect(told?.status).toBe('FAILED');
    expect(told?.detail).toBe(sealingFailureReason('FRAGMENT_TOO_LARGE', outcome.detail));
    expect(told?.detail).toContain(`Fragment ${largest.seq} of camera file ${largest.trackId} is too large to be verified`);
    expect(told?.detail).not.toMatch(/[/\\]|[0-9a-f]{32}/);
  });

  it('CONTROL: at exactly the bound the session seals, and the verifier AT THE SAME BOUND passes it - the pipeline produced nothing its verifier refuses', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    const largest = largestOf(h.recording);
    sealedOf(await createSealingPipeline({ ...h.ports, maxFragmentBytes: largest.bytes }).run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    const result = await verifyAt(h, largest.bytes);
    expect(result.ok).toBe(true);
    expect(passing(result)).toEqual(ALL);
  });

  it('a port cannot RAISE the bound above the verifier\'s: a session of ordinary fragments seals the same under an absurd value', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    sealedOf(await createSealingPipeline({ ...h.ports, maxFragmentBytes: Number.MAX_SAFE_INTEGER }).run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    expect((await verify(h)).ok).toBe(true);
  });
});

describe('a Core that ended after the commit of the item is FINISHED at the next start (row 82c; finding F-86-2)', () => {
  const sealedState = (h: Harness) => () => ({
    session: { id: h.recording.sessionId, state: 'SEALED', stoppedAt: h.facts.stoppedAt, fault: null },
    evidence: h.engine.sealed.map((entry) => ({ sessionId: entry.input.sessionId, manifestHash: entry.input.manifestSha256, integritySource: 'REAL' })),
  });
  /** What the composition hands the controller: the journal is open while a row is missing or not DONE. */
  const openRows = (h: Harness) => async (): Promise<boolean> => {
    const rows = SEALING_STEP_ORDER.map((step) => rowOf(h, step));
    return rows.some((row) => row !== undefined) && rows.some((row) => row === undefined || row.status !== 'DONE');
  };
  const controllerOf = (h: Harness) =>
    createSealingController({ pipeline: h.again(), engine: () => ({ applySealingProgress: async () => undefined, completeSeal: async () => undefined, state: sealedState(h) }), hasDurableMedia: async () => true, hasSealingRows: async () => true, hasOpenSealingRows: openRows(h) });
  /** The process ends INSIDE the last step, right after the engine committed the item: no removal, no DONE row. */
  const killedAfterCommit = async (h: Harness): Promise<void> => {
    const point = { step: 'STORE_SEALED_PACKAGE', phase: 'AFTER_WORK', attempt: 1 } as const;
    const pipeline = createSealingPipeline({
      ...h.ports,
      engine: {
        ...h.ports.engine,
        completeSeal: async (input, transcript) => {
          await h.ports.engine.completeSeal(input, transcript);
          throw new SealingStop(point);
        },
      },
    });
    await expect(pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
  };

  it('killed between the commit and the removal of the plaintext recordings: the next start removes them, writes the DONE row, and commits NOTHING again', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    await killedAfterCommit(h);
    // What the killed process left: the item, the last row RUNNING, and BOTH plaintext recordings beside the sealed package.
    expect(h.engine.sealed).toHaveLength(1);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toMatchObject({ status: 'RUNNING', attempt: 1 });
    for (const trackId of TRACKS) expect(existsSync(h.recording.recordingFile(trackId))).toBe(true);
    const signedBefore = [PackageFile.MANIFEST, PackageFile.SIGNATURE].map((name) => sha256Hex(readFileSync(h.recording.path(name))));
    const progressBefore = h.engine.progress.length;

    const controller = controllerOf(h);
    expect(await controller.decide()).toEqual({ action: 'FINISH', sessionId: h.recording.sessionId, cause: 'STOPPED' });
    const outcome = sealedOf((await controller.resume()) as SealOutcome);
    expect(outcome.attempt).toBe(2);
    expect(outcome.skipped).toEqual(SEALING_STEP_ORDER.slice(0, 5));
    // No second item, no second commit call, and the signed bytes are the ones the killed run wrote.
    expect(h.engine.sealed).toHaveLength(1);
    expect(h.engine.completeCalls).toBe(1);
    expect([PackageFile.MANIFEST, PackageFile.SIGNATURE].map((name) => sha256Hex(readFileSync(h.recording.path(name))))).toEqual(signedBefore);
    // The recordings are gone; the folder is the package and nothing else; the journal is closed.
    for (const trackId of TRACKS) expect(existsSync(h.recording.recordingFile(trackId))).toBe(false);
    expect(await listPackageFiles(h.recording.packageDir)).toEqual([...declaredPackageFiles({ transcript: false })].sort());
    expect(SEALING_STEP_ORDER.map((step) => rowOf(h, step)?.status)).toEqual(Array.from({ length: 6 }, () => 'DONE'));
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toMatchObject({ attempt: 2, checkpoint: { committed: 'ALREADY_SEALED', recordingsRemoved: 2, recordingsKept: 0 } });
    expect(h.log.entries.filter((entry) => entry.level === 'error')).toEqual([]);
    expect(h.engine.progress.length).toBeGreaterThanOrEqual(progressBefore);
    const result = await verify(h);
    expect(result.ok).toBe(true);
    expect(passing(result)).toEqual(ALL);
    // The journal is closed: the start after that finds nothing to do.
    expect(await controllerOf(h).decide()).toEqual({ action: 'NONE' });
  });

  it('CONTROL of the kill: the same session NOT restarted keeps its recordings and its RUNNING row (the removal above is the resumed run\'s doing)', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    await killedAfterCommit(h);
    for (const trackId of TRACKS) expect(existsSync(h.recording.recordingFile(trackId))).toBe(true);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')?.status).toBe('RUNNING');
  });

  it('CONTAINMENT: only a recording the package\'s own manifest accounts for is removed - another file under a recording\'s name, a link, and every other file of the folder stay', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    await killedAfterCommit(h);
    const outside = mkdtempSync(join(tmpdir(), 'dems-row82c-outside-'));
    try {
      // (1) VIDEO-02.mp4 is ANOTHER file of the same length under the recording's name.
      const second = h.recording.recordingFile('VIDEO-02');
      const foreign = Buffer.from(readFileSync(second));
      foreign[foreign.length - 5] = foreign[foreign.length - 5]! ^ 0xff;
      writeFileSync(second, foreign);
      // (2) VIDEO-01.mp4 is a LINK to the true recording bytes kept outside the session folder.
      const first = h.recording.recordingFile('VIDEO-01');
      const target = join(outside, 'VIDEO-01.mp4');
      writeFileSync(target, readFileSync(first));
      rmSync(first);
      symlinkSync(target, first);
      // (3) Files the manifest knows nothing of, in the session folder.
      writeFileSync(h.recording.path('notes.txt'), 'kept');
      writeFileSync(h.recording.path('VIDEO-03.mp4'), 'kept');

      const outcome = sealedOf((await controllerOf(h).resume()) as SealOutcome);
      expect(outcome.attempt).toBe(2);
      expect(lstatSync(first).isSymbolicLink()).toBe(true);
      expect(existsSync(target)).toBe(true);
      expect(sha256Hex(readFileSync(second))).toBe(sha256Hex(foreign));
      expect(readFileSync(h.recording.path('notes.txt'), 'utf8')).toBe('kept');
      expect(readFileSync(h.recording.path('VIDEO-03.mp4'), 'utf8')).toBe('kept');
      expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toMatchObject({ status: 'DONE', attempt: 2, checkpoint: { committed: 'ALREADY_SEALED', recordingsRemoved: 0, recordingsKept: 2 } });
      // Each file that was left is SAID, by track and reason, in the persistent log.
      expect(h.log.entries.filter((entry) => entry.code === 'SEALING_RECORDING_NOT_OF_PACKAGE').map((entry) => [entry.context?.trackId, entry.context?.reason])).toEqual([
        ['VIDEO-01', 'NOT_A_REGULAR_FILE'],
        ['VIDEO-02', 'NOT_THE_SEALED_BYTES'],
      ]);
      expect(h.engine.completeCalls).toBe(1);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('the plaintext never goes while its sealed media is not there: a sealed camera file that is missing fails the step and removes nothing', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    await killedAfterCommit(h);
    rmSync(h.recording.cameraFile('VIDEO-01'));
    const outcome = failedOf((await controllerOf(h).resume()) as SealOutcome);
    expect(outcome).toMatchObject({ step: 'STORE_SEALED_PACKAGE', code: 'STORAGE_FAILED', attempt: 2 });
    for (const trackId of TRACKS) expect(existsSync(h.recording.recordingFile(trackId))).toBe(true);
    expect(h.engine.completeCalls).toBe(1);
  });

  it('killed after the removal and before the DONE row (the kill point of M7-KM-*-S6): the next start writes the DONE row only', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    h.hook = stopAt('STORE_SEALED_PACKAGE', 'AFTER_WORK');
    await expect(h.again().run({ sessionId: h.recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    h.hook = null;
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toMatchObject({ status: 'RUNNING', attempt: 1 });
    const outcome = sealedOf((await controllerOf(h).resume()) as SealOutcome);
    expect(outcome.attempt).toBe(2);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toMatchObject({ status: 'DONE', attempt: 2, checkpoint: { committed: 'ALREADY_SEALED', recordingsRemoved: 0, recordingsKept: 0 } });
    expect(h.engine.completeCalls).toBe(1);
    expect((await verify(h)).ok).toBe(true);
  });
});
