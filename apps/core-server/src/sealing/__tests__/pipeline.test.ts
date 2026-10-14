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
import { SEALING_HOOK_PHASES, SEALING_MAX_FRAGMENT_BYTES, SEALING_STEP_ORDER, SealingStop, createSealingController, createSealingPipeline, durableMediaOnDisk, sealEngineOf, sealOnCaptureHandOff, sealingFailureReason, type SealOutcome, type SealSessionFacts, type SealingHookPoint, type SealingStepId } from '../index';
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

describe('task 4 row 191c: audio absent across a worker restart is a SIGNED member of the manifest (fields 129-132; decisions C73, C83)', () => {
  const RESTARTED = {
    audioIntervals: [
      { seq: 1, micDeviceId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 0, reason: 'START', switchedBy: null },
      { seq: 2, micDeviceId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: null, reason: 'START', switchedBy: null },
    ],
    audioRestartGaps: [
      { earlierAttempt: 1, laterAttempt: 2, absentAtLeastMs: 336, absentAtMostMs: 715 },
      { earlierAttempt: 2, laterAttempt: 3, absentAtLeastMs: null, absentAtMostMs: 640 },
    ],
  } as const;
  const manifestBytes = (recording: Recording): Buffer => readFileSync(recording.path(PackageFile.MANIFEST));

  it('a session with restarts seals `audio.absentOnRestart` - one record per restart, the attempts and both bounds - and the Core\'s verify passes all 15 checks; one changed number of the member is refused under the signature', async () => {
    const recording = recordSession();
    const h = harnessOf(recording, { facts: RESTARTED });
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    const manifest = manifestOf(recording);
    expect(manifest.audio.absentOnRestart).toEqual(RESTARTED.audioRestartGaps);
    expect(manifest.audio.sourceIntervals.map((interval) => [interval.seq, interval.reason, interval.fromMs, interval.toMs])).toEqual([[1, 'START', 0, 0], [2, 'START', 21, 10_000]]);
    expect(outcome.manifestSha256).toBe(manifest.manifestSha256);
    const result = await verify(h);
    expect([result.ok, result.overall, passing(result)]).toEqual([true, 'PASS', ALL]);

    // CONTROL: the member is inside the digest. 715 -> 716 in the file: the manifest no longer matches its digest and signature.
    const file = recording.path(PackageFile.MANIFEST);
    const text = readFileSync(file, 'utf8');
    expect(text.split('"absentAtMostMs":715')).toHaveLength(2);
    writeFileSync(file, text.replace('"absentAtMostMs":715', '"absentAtMostMs":716'));
    const altered = await verify(h);
    expect(altered.ok).toBe(false);
    expect(passing(altered)).not.toContain('V-03');
  });

  it('NO RESTART = NO KEY: the same recording sealed with no gap record, with an empty list and with the member absent gives the SAME manifest bytes, and they do not name the member', async () => {
    const original = recordSession();
    const signer = throwAwaySigner();
    const sealedBytes = async (facts: Parameters<typeof sessionFacts>[1] | undefined): Promise<Buffer> => {
      const h = harnessOf(original.clone(), { signer, ...(facts === undefined ? {} : { facts }) });
      sealedOf(await h.pipeline.run({ sessionId: original.sessionId, cause: 'STOPPED' }));
      return manifestBytes(h.recording);
    };
    const absent = await sealedBytes(undefined);
    const empty = await sealedBytes({ audioRestartGaps: [] });
    expect(absent.toString('utf8')).not.toContain('absentOnRestart');
    expect(empty.equals(absent)).toBe(true);
    // The control of the comparison: one gap record changes the bytes.
    const withGap = await sealedBytes({ audioRestartGaps: [{ earlierAttempt: 1, laterAttempt: 2, absentAtLeastMs: null, absentAtMostMs: null }] });
    expect(withGap.equals(absent)).toBe(false);
    expect(withGap.toString('utf8')).toContain('"absentOnRestart":[{"absentAtLeastMs":null,"absentAtMostMs":null,"earlierAttempt":1,"laterAttempt":2}]');
  });

  it('the member is FROZEN with the build: a run stopped after BUILD_MANIFEST resumes to the same digest although the session record no longer states the restart', async () => {
    const original = recordSession();
    const signer = throwAwaySigner();
    const reference = harnessOf(original.clone(), { signer, facts: RESTARTED });
    const clean = sealedOf(await reference.pipeline.run({ sessionId: original.sessionId, cause: 'STOPPED' }));

    const h = harnessOf(original.clone(), { signer, facts: RESTARTED });
    h.hook = stopAt('BUILD_MANIFEST', 'AFTER_WORK');
    await expect(h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    h.facts = sessionFacts(original.sessionId);
    h.hook = null;
    const resumed = sealedOf(await h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' }));
    expect(resumed.manifestSha256).toBe(clean.manifestSha256);
    expect(manifestOf(h.recording).audio.absentOnRestart).toEqual(RESTARTED.audioRestartGaps);
  });

  // ── Task 4 row P1 (decisions U21 (2), C66 (1), C71 C-7): field 133, `hostProfileNotAsked` ──
  it('row P1: a session a production Core seals on macOS states `hostProfileNotAsked` under the signature and the Core\'s verify passes all 15 checks; the platform changed in the file is refused', async () => {
    const recording = recordSession();
    const h = harnessOf(recording, { facts: { hostProfileNotAsked: { platform: 'darwin' } } });
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    const manifest = manifestOf(recording);
    expect(manifest.hostProfileNotAsked).toEqual({ platform: 'darwin' });
    expect(outcome.manifestSha256).toBe(manifest.manifestSha256);
    const result = await verify(h);
    expect([result.ok, result.overall, passing(result)]).toEqual([true, 'PASS', ALL]);

    // CONTROL 1: the member is inside the digest - taken out of the file, the manifest no longer matches its digest and signature.
    const file = recording.path(PackageFile.MANIFEST);
    const text = readFileSync(file, 'utf8');
    expect(text.split('"hostProfileNotAsked":{"platform":"darwin"},')).toHaveLength(2);
    writeFileSync(file, text.replace('"hostProfileNotAsked":{"platform":"darwin"},', ''));
    const removed = await verify(h);
    expect(removed.ok).toBe(false);
    expect(passing(removed)).not.toContain('V-03');
    // CONTROL 2: `linux` written in its place is no manifest at all (V-01): a Linux Core states no such member.
    writeFileSync(file, text.replace('"platform":"darwin"', '"platform":"linux"'));
    const forged = await verify(h);
    expect(forged.ok).toBe(false);
    expect(passing(forged)).not.toContain('V-01');
  });

  it('row P1: THE PROFILE WAS ASKED (Linux), or none is asked by design (development) = NO KEY: the same recording sealed with the member absent gives the SAME manifest bytes as before, and they do not name the member', async () => {
    const original = recordSession();
    const signer = throwAwaySigner();
    const sealedBytes = async (facts: Parameters<typeof sessionFacts>[1] | undefined): Promise<Buffer> => {
      const h = harnessOf(original.clone(), { signer, ...(facts === undefined ? {} : { facts }) });
      sealedOf(await h.pipeline.run({ sessionId: original.sessionId, cause: 'STOPPED' }));
      return manifestBytes(h.recording);
    };
    const absent = await sealedBytes(undefined);
    const again = await sealedBytes({});
    expect(absent.toString('utf8')).not.toContain('hostProfileNotAsked');
    expect(again.equals(absent)).toBe(true);
    // The control of the comparison: the member changes the bytes, by exactly its own text.
    const onMac = await sealedBytes({ hostProfileNotAsked: { platform: 'darwin' } });
    expect(onMac.equals(absent)).toBe(false);
    expect(onMac.toString('utf8')).toContain('"hostProfileNotAsked":{"platform":"darwin"}');
    expect(onMac.length - absent.length).toBe('"hostProfileNotAsked":{"platform":"darwin"},'.length);
  });

  it('row P1: the member is FROZEN with the build - a run stopped after BUILD_MANIFEST resumes to the same digest although the facts no longer state it', async () => {
    const original = recordSession();
    const signer = throwAwaySigner();
    const ON_MAC = { hostProfileNotAsked: { platform: 'darwin' } } as const;
    const clean = sealedOf(await harnessOf(original.clone(), { signer, facts: ON_MAC }).pipeline.run({ sessionId: original.sessionId, cause: 'STOPPED' }));

    const h = harnessOf(original.clone(), { signer, facts: ON_MAC });
    h.hook = stopAt('BUILD_MANIFEST', 'AFTER_WORK');
    await expect(h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    h.facts = sessionFacts(original.sessionId);
    h.hook = null;
    const resumed = sealedOf(await h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' }));
    expect(resumed.manifestSha256).toBe(clean.manifestSha256);
    expect(manifestOf(h.recording).hostProfileNotAsked).toEqual({ platform: 'darwin' });
  });

  it('records the manifest refuses are refused by the SEAL, nothing signed: a later attempt not above the earlier one', async () => {
    const recording = recordSession();
    const h = harnessOf(recording, { facts: { audioRestartGaps: [{ earlierAttempt: 2, laterAttempt: 2, absentAtLeastMs: 1, absentAtMostMs: 2 }] } });
    failedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(nothingSigned(recording)).toBe(true);
  });

  // ── Task 4 row R1b (decision C99; finding F3-01): fields 134-138, `tracks[].absentInSession` ──
  const ABSENCES = [
    { attempt: 1, loss: 1, absentAtLeastMs: 3048, absentAtMostMs: 8049, ended: 'RE_OPENED' },
    { attempt: 1, loss: 2, absentAtLeastMs: null, absentAtMostMs: 46210, ended: 'NOT_RE_OPENED' },
  ] as const;
  /** The session facts with the absences of the given tracks (index 0 = VIDEO-01); every other fact is the fixture's. */
  const withAbsences = (sessionId: string, first: unknown, second?: unknown): Pick<SealSessionFacts, 'tracks'> => {
    const [one, two] = sessionFacts(sessionId).tracks;
    return { tracks: [first === undefined ? one : { ...one, absentInSession: first as never }, second === undefined ? two : { ...two, absentInSession: second as never }] };
  };

  it('row R1b: a session with a camera that was absent seals `tracks[].absentInSession` on THAT track - one record per absence, the attempt, the relay\'s loss number, both bounds, how it ended - and the Core\'s verify passes all 15 checks and SAYS it; one changed number or word is refused under the signature', async () => {
    const recording = recordSession();
    const h = harnessOf(recording, { facts: withAbsences(recording.sessionId, ABSENCES) });
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    const manifest = manifestOf(recording);
    expect(manifest.tracks.map((track) => [track.trackId, track.absentInSession ?? null])).toEqual([['VIDEO-01', ABSENCES], ['VIDEO-02', null]]);
    expect('absentInSession' in (manifest.tracks[1] ?? {})).toBe(false);
    expect(outcome.manifestSha256).toBe(manifest.manifestSha256);
    const result = await verify(h);
    expect([result.ok, result.overall, passing(result)]).toEqual([true, 'PASS', ALL]);
    expect(result.notices.filter((notice) => notice.code === 'VIDEO_ABSENT_IN_SESSION')).toEqual([
      { code: 'VIDEO_ABSENT_IN_SESSION', report: 'Video: CAMERA ABSENT INSIDE THE SESSION. VIDEO-01 2 times, at least not measured, at most 54259 ms, not re-opened. No picture was recorded in that time.' },
    ]);

    // CONTROL: the member is inside the digest. 3048 -> 3049, and RE_OPENED -> NOT_RE_OPENED..RE_OPENED swapped, in the file: no longer the signed manifest.
    const file = recording.path(PackageFile.MANIFEST);
    const text = readFileSync(file, 'utf8');
    expect(text.split('"absentAtLeastMs":3048')).toHaveLength(2);
    writeFileSync(file, text.replace('"absentAtLeastMs":3048', '"absentAtLeastMs":3049'));
    const altered = await verify(h);
    expect(altered.ok).toBe(false);
    expect(passing(altered)).not.toContain('V-03');
    writeFileSync(file, text.replace('"ended":"NOT_RE_OPENED"', '"ended":"RE_OPENED"'));
    const reworded = await verify(h);
    expect(reworded.ok).toBe(false);
    expect(passing(reworded)).not.toContain('V-03');
  });

  it('row R1b: NO ABSENCE = NO KEY: the same recording sealed with the member absent, with `undefined` and with an empty list on both tracks gives the SAME manifest bytes, and they do not name the member; a session without one gets no notice', async () => {
    const original = recordSession();
    const signer = throwAwaySigner();
    const sealedBytes = async (facts: Parameters<typeof sessionFacts>[1] | undefined): Promise<{ bytes: Buffer; notices: readonly string[] }> => {
      const h = harnessOf(original.clone(), { signer, ...(facts === undefined ? {} : { facts }) });
      sealedOf(await h.pipeline.run({ sessionId: original.sessionId, cause: 'STOPPED' }));
      return { bytes: manifestBytes(h.recording), notices: (await verify(h)).notices.map((notice) => notice.code) };
    };
    const absent = await sealedBytes(undefined);
    const [one, two] = sessionFacts(original.sessionId).tracks;
    const handedUndefined = await sealedBytes({ tracks: [{ ...one, absentInSession: undefined }, { ...two, absentInSession: undefined }] } as never);
    const empty = await sealedBytes(withAbsences(original.sessionId, [], []));
    expect(absent.bytes.toString('utf8')).not.toContain('absentInSession');
    expect(absent.notices).not.toContain('VIDEO_ABSENT_IN_SESSION');
    expect([handedUndefined.bytes.equals(absent.bytes), empty.bytes.equals(absent.bytes)]).toEqual([true, true]);
    // The control of the comparison: one absence on the second track changes the bytes, by exactly its own text.
    const lost = await sealedBytes(withAbsences(original.sessionId, undefined, [ABSENCES[0]]));
    expect(lost.bytes.equals(absent.bytes)).toBe(false);
    const member = '"absentInSession":[{"absentAtLeastMs":3048,"absentAtMostMs":8049,"attempt":1,"ended":"RE_OPENED","loss":1}],';
    expect(lost.bytes.toString('utf8')).toContain(member);
    expect(lost.bytes.length - absent.bytes.length).toBe(member.length);
    expect(lost.notices).toContain('VIDEO_ABSENT_IN_SESSION');
  });

  it('row R1b: the member is FROZEN with the build - a run stopped after BUILD_MANIFEST resumes to the same digest although the session record no longer states the absence; a record the manifest refuses fails the SEAL and nothing is signed', async () => {
    const original = recordSession();
    const signer = throwAwaySigner();
    const facts = withAbsences(original.sessionId, ABSENCES);
    const clean = sealedOf(await harnessOf(original.clone(), { signer, facts }).pipeline.run({ sessionId: original.sessionId, cause: 'STOPPED' }));

    const h = harnessOf(original.clone(), { signer, facts });
    h.hook = stopAt('BUILD_MANIFEST', 'AFTER_WORK');
    await expect(h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    h.facts = sessionFacts(original.sessionId);
    h.hook = null;
    const resumed = sealedOf(await h.again().run({ sessionId: original.sessionId, cause: 'STOPPED' }));
    expect(resumed.manifestSha256).toBe(clean.manifestSha256);
    expect(manifestOf(h.recording).tracks[0]?.absentInSession).toEqual(ABSENCES);

    // An absence that did not end before another one, and a least above the most: refused by the manifest, so by the seal.
    for (const refused of [[{ ...ABSENCES[1], loss: 1 }, { ...ABSENCES[0], loss: 2 }], [{ ...ABSENCES[0], absentAtLeastMs: 9000 }]]) {
      const recording = recordSession();
      const failing = harnessOf(recording, { facts: withAbsences(recording.sessionId, refused) });
      failedOf(await failing.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
      expect(nothingSigned(recording)).toBe(true);
    }
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

  // LOAD-SENSITIVE (test/14 consolidation, core-server unit, open items; row 97): no wait and no
  // process - this case is computation and file work (one stopped run and one resumed seal per
  // hook point, each verified) under the runner's default limit of 5 s. On a starved host (a
  // 1-minute load of about 100 was measured) the work itself can pass the limit; at a load below 8
  // it does not. The limit is not raised: a red here is read against the load of the run first.
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

  // Wave 12 row D1 (the open fault of row 184: `WRITE_FAILED` at STORE_SEALED_PACKAGE in 3 of 4 interrupted seals). The
  // worker puts the zero of the media time where its audio began, which may lie BEFORE the session's `startedAt` (426 ms
  // in row 184's run b2); `startedAt + media end` then lay after the seal's own instant, and the item row was refused by
  // `evidence_items_values_check` (`sealed_at >= ended_at`) at every retry, because the instant is frozen.
  // Seen RED before the fix: `durableEndMs` was CLOCK_START + 400 (expected at most CLOCK_START).
  it('D1: an interrupted recording never ends AFTER the instant of its seal - in the manifest and in the item the engine is given', async () => {
    const recording = recordSession();
    // 10,000 ms of durable media; the session says it started 9,600 ms before the seal's instant.
    const h = harnessOf(recording, { facts: { stoppedAt: null, startedAt: CLOCK_START - 9_600 } });
    expect(sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'INTERRUPTED' })).interrupted).toBe(true);
    const timeline = manifestOf(recording).timeline;
    expect(timeline).toMatchObject({ interrupted: true, stoppedAt: null, sealedAt: CLOCK_START, durableEndMs: CLOCK_START, recordingDurationMs: 9_600 });
    expect(h.engine.sealed[0]?.input).toMatchObject({ interrupted: true, sealedAt: CLOCK_START, durableEndAt: CLOCK_START });
    const result = await verify(h);
    expect([result.ok, result.overall, result.interrupted, passing(result)]).toEqual([true, 'PASS', true, ALL]);
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

  // FIX PASS F-M7 (review row 88, decision D178; R88-01, R88-02 (b)). A failure CONFINED TO ONE
  // CAMERA FILE no longer stops the whole seal for ever: THAT file is never sealed - it is left
  // out BY NAME (the same members the failed step used to carry), it is moved to the quarantine,
  // and the camera file that validates is sealed as an INTERRUPTED recording. The same failure in
  // EVERY camera file still seals nothing (`NOTHING_SEALABLE`). `pipeline-one-camera.test.ts`
  // holds the sealed side (verify PASS, quarantine bytes); here: the bad file is never sealed.
  async function leftOut(prepare: (recording: Recording, h: Harness) => void, run: (h: Harness) => Promise<SealOutcome> = (h) => h.pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' })) {
    const recording = recordSession();
    const h = harnessOf(recording);
    prepare(recording, h);
    const outcome = sealedOf(await run(h));
    // RULING D183 (fix pass F-M7b): the fragments BEFORE the first bad one are sealed when they validate;
    // the bad fragment and everything after it never are. (A file with NO valid fragment is left out whole:
    // `pipeline-prefix.test.ts`, `pipeline-one-camera.test.ts`.)
    const entries = h.log.entries.filter((entry) => entry.code === 'SEALING_CAMERA_PREFIX_SEALED' || entry.code === 'SEALING_CAMERA_LEFT_OUT');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ level: 'error', code: 'SEALING_CAMERA_PREFIX_SEALED' });
    const context = entries[0]?.context as Record<string, unknown>;
    const bad = context.trackId as (typeof TRACKS)[number];
    const firstBad = context.firstBadSeq as number;
    // The bad fragment is NOT in the package, and the original recording is not left in the package folder.
    expect(manifestOf(recording).files.find((file) => file.trackId === bad)?.fragments.map((fragment) => fragment.seq)).toEqual(Array.from({ length: firstBad - 1 }, (_, index) => index + 1));
    expect(existsSync(recording.recordingFile(bad))).toBe(false);
    expect(outcome.interrupted).toBe(true);
    expect(outcome.tracks.map((track) => [track.trackId, track.fragmentCount])).toEqual(TRACKS.map((trackId) => [trackId, trackId === bad ? firstBad - 1 : recording.tracks[trackId].plain.length]));
    expect(manifestOf(recording).timeline.interrupted).toBe(true);
    return { h, outcome, context, told: h.engine.progress.flatMap((report) => report.steps).filter((step) => step.id === 'CLOSE_TRACKS' && step.status === 'DONE').at(-1)?.detail ?? null };
  }
  const changeByte = (recording: Recording, trackId: (typeof TRACKS)[number], index = 1): void => {
    const row = recording.tracks[trackId].rows[index]!;
    const bytes = readFileSync(recording.recordingFile(trackId));
    bytes[row.byteOffset + 90] = (bytes[row.byteOffset + 90] ?? 0) ^ 0x80;
    writeFileSync(recording.recordingFile(trackId), bytes);
  };

  it('a byte of the recording was changed before the seal: it is not the fragment its row recorded - THAT camera file is never sealed, and it is named', async () => {
    const { context } = await leftOut((recording) => changeByte(recording, 'VIDEO-01'));
    expect(context).toMatchObject({ failure: 'FRAGMENT_MISMATCH', firstBadSeq: 2, sealedFragments: 1, trackId: 'VIDEO-01', seq: 2, member: 'fragSha256' });
  });

  it('the same change in EVERY camera file: nothing is sealed, nothing is signed (NOTHING_SEALABLE), and the next attempt ends the same way', async () => {
    const { h, outcome } = await refused((recording) => {
      // The FIRST fragment of each file: no file has a valid fragment (ruling D183).
      for (const trackId of TRACKS) changeByte(recording, trackId, 0);
    });
    expect(outcome).toMatchObject({ step: 'CLOSE_TRACKS', code: 'NOTHING_SEALABLE', retriable: false, attempt: 1, detail: { reasons: 'VIDEO-01:FRAGMENT_MISMATCH,VIDEO-02:FRAGMENT_MISMATCH' } });
    expect(nothingSigned(h.recording)).toBe(true);
    for (const trackId of TRACKS) {
      expect(existsSync(h.recording.cameraFile(trackId))).toBe(false);
      expect(existsSync(h.recording.recordingFile(trackId))).toBe(true);
    }
    expect(existsSync(h.recording.path(PackageFile.FRAGMENTS_JSON))).toBe(false);
    // What the session record (operation 83, the Finalizing screen) is told: the step FAILED, and why, in words.
    const told = h.engine.progress.at(-1)?.steps.find((step) => step.id === 'CLOSE_TRACKS');
    expect(told).toMatchObject({ status: 'FAILED', etaMs: null, detail: sealingFailureReason('NOTHING_SEALABLE') });
    expect(h.engine.progress.at(-1)?.steps.filter((step) => step.status === 'RUNNING')).toEqual([]);
    // NOT A HANG AND NOT A LOOP: a second run is one more attempt, ends at once, with the same name.
    const again = failedOf(await h.again().run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    expect(again).toMatchObject({ step: 'CLOSE_TRACKS', code: 'NOTHING_SEALABLE', attempt: 2 });
    expect(h.engine.sealed).toHaveLength(0);
  });

  it('a row whose digest is not the bytes\' (the recording-time chain disagrees with the file): CORRUPT, the fragment is named', async () => {
    const { context } = await leftOut((recording) => {
      const row = recording.tracks['VIDEO-02'].rows[2]!;
      recording.tracks['VIDEO-02'].rows[2] = { ...row, sha256: sha256Hex(Buffer.from('another fragment')) };
    });
    expect(context).toMatchObject({ failure: 'FRAGMENT_MISMATCH', trackId: 'VIDEO-02', seq: 3, member: 'fragSha256' });
  });

  it('bytes that were recorded as durable are gone from the recording', async () => {
    const { context } = await leftOut((recording) => {
      const last = recording.tracks['VIDEO-01'].rows.at(-1)!;
      writeFileSync(recording.recordingFile('VIDEO-01'), readFileSync(recording.recordingFile('VIDEO-01')).subarray(0, last.byteOffset));
    });
    expect(context).toMatchObject({ failure: 'DURABLE_BYTES_MISSING', trackId: 'VIDEO-01' });
  });

  // THE FORMER KNOWN LIMIT (ev §B.4 "tracks[] of exactly 2"; ruling D147) IS GONE (review row 88,
  // R88-01 BLOCKER; decision D178): a session whose second camera never produced a whole fragment
  // IS sealed, with the camera file it has. This case pinned the opposite at abf742f ("a NAMED
  // failure ... and the next attempt ends the same way"): that pin was the reproduction of R88-01.
  it.each([
    ['holds an init segment and a cut first fragment (the box walk names it by its first flag)', 'NO_INIT_SEGMENT', true, (recording: Recording) => writeFileSync(recording.recordingFile('VIDEO-02'), readFileSync(recording.recordingFile('VIDEO-02')).subarray(0, recording.tracks['VIDEO-02'].rows[0]!.byteOffset + 10))],
    ['was never written', 'NOT_RECORDED', false, (recording: Recording) => rmSync(recording.recordingFile('VIDEO-02'))],
  ] as const)('the second camera file %s while the first recorded: the session IS SEALED with the first camera file, the operator is told, and a second run has nothing left to do', async (_label, reason, interrupted, damage) => {
    const recording = recordSession();
    const h = harnessOf(recording);
    damage(recording);
    recording.tracks['VIDEO-02'].rows.length = 0;
    const outcome = sealedOf(await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome).toMatchObject({ attempt: 1, interrupted });
    expect(outcome.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01']);
    expect((rowOf(h, 'CLOSE_TRACKS')!.checkpoint as unknown as { omitted: unknown[] }).omitted).toMatchObject([{ trackId: 'VIDEO-02', reason }]);
    // What the session record (operation 83, the Finalizing screen) is told on the DONE step: which camera, in words.
    const told = h.engine.progress.flatMap((report) => report.steps).filter((step) => step.id === 'CLOSE_TRACKS' && step.status === 'DONE').at(-1)?.detail ?? '';
    expect(told).toContain('VIDEO-02');
    expect(told).not.toMatch(/[/\\]|[0-9a-f]{32}/);
    expect(h.engine.progress.flatMap((report) => report.steps).some((step) => step.status === 'FAILED')).toBe(false);
    expect((await verify(h)).ok).toBe(true);
    expect(h.engine.sealed).toHaveLength(1);
    // A second run commits nothing again.
    sealedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(h.engine.sealed).toHaveLength(1);
  });

  it('CONTROL of the reason: a step that did not fail carries no failure sentence, and a failed one carries the sentence of ITS code', async () => {
    const good = harnessOf(recordSession());
    sealedOf(await good.pipeline.run({ sessionId: good.recording.sessionId, cause: 'STOPPED' }));
    expect(good.engine.progress.flatMap((report) => report.steps).filter((step) => /cannot be sealed|seal stopped|nothing was/i.test(step.detail ?? ''))).toEqual([]);
    const { h } = await refused((recording) => {
      for (const trackId of TRACKS) {
        // Cut inside the FIRST fragment: no file holds a whole fragment (ruling D183: a later cut seals the prefix).
        const first = recording.tracks[trackId].rows[0]!;
        writeFileSync(recording.recordingFile(trackId), readFileSync(recording.recordingFile(trackId)).subarray(0, first.byteOffset + 10));
      }
    });
    expect(h.engine.progress.at(-1)?.steps.find((step) => step.status === 'FAILED')?.detail).toBe(sealingFailureReason('NOTHING_SEALABLE'));
    // ... and a camera file that was LEFT OUT is named on the DONE step, with ITS reason (F-M7).
    const { told } = await leftOut((recording) => {
      const last = recording.tracks['VIDEO-01'].rows.at(-1)!;
      writeFileSync(recording.recordingFile('VIDEO-01'), readFileSync(recording.recordingFile('VIDEO-01')).subarray(0, last.byteOffset));
    });
    expect(told).toBe('Camera file VIDEO-01 is sealed up to fragment 4 only (DURABLE_BYTES_MISSING): the recording is sealed as interrupted, and the whole original file is kept in the quarantine folder.');
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

  // FIX PASS F-M7 (review row 88, R88-03; decision D178). This case pinned the defect at abf742f: a session record
  // that differs at the restart made SIGN_MANIFEST fail `MANIFEST_NOT_REPRODUCIBLE` for ever, although nothing was
  // signed. The inputs of the manifest are now FROZEN in the BUILD_MANIFEST checkpoint: the resume builds from that
  // snapshot, so it seals - with the values of the first build. That the signer still signs "the digest of the
  // checkpoint or nothing" is held by `pipeline-frozen-facts.test.ts` (a package file changed after the build).
  it('the session record changed between BUILD_MANIFEST and a resumed SIGN_MANIFEST: the resume builds from the frozen snapshot and SEALS with the values of the first build', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    const first = h.facts.caseNumber;
    h.hook = stopAt('BUILD_MANIFEST', 'AFTER_CHECKPOINT');
    await expect(h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    h.facts = { ...h.facts, caseNumber: 'LP/2026/9999-0001' };
    h.hook = null;
    const outcome = sealedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect(outcome.manifestSha256).toBe((rowOf(h, 'BUILD_MANIFEST')!.checkpoint as unknown as { manifestSha256: string }).manifestSha256);
    expect(manifestOf(recording).caseNumber).toBe(first);
    expect((await verify(h)).ok).toBe(true);
    expect(h.engine.sealed).toHaveLength(1);
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
  // Pin changed by fix pass F-M7c (R88-05 (a)): the orphan is still MOVED OUT with its bytes by CLOSE_TRACKS (asserted while the
  // seal runs) - and, new, it is REMOVED once the session is sealed: plaintext of a dead worker never outlives a SEALED outcome.
  it('a second name of the camera file is removed as a name; a file of its own is moved out with its bytes and removed once the session is sealed; the package is clean and verifies', async () => {
    const recording = recordSession();
    const camera = recording.recordingFile('VIDEO-01');
    linkSync(camera, `${camera}.4711.part`);
    expect(statSync(camera).nlink).toBe(2);
    writeFileSync(`${recording.recordingFile('VIDEO-02')}.4712.part`, 'an orphan of a dead worker');
    const h = harnessOf(recording);
    const orphan = join(recording.stagingDir, 'orphans', 'VIDEO-02.mp4.4712.part');
    let movedOutWithItsBytes: string | null = null;
    h.hook = async (point) => {
      if (point.step === 'STORE_SEALED_PACKAGE' && point.phase === 'BEFORE') movedOutWithItsBytes = readFileSync(orphan, 'utf8');
    };
    sealedOf(await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }));
    expect((rowOf(h, 'CLOSE_TRACKS')!.checkpoint as { tracks: { partNamesRemoved: number; orphansMoved: number }[] }).tracks.map((track) => [track.partNamesRemoved, track.orphansMoved])).toEqual([[1, 0], [0, 1]]);
    expect(movedOutWithItsBytes).toBe('an orphan of a dead worker');
    expect(existsSync(orphan)).toBe(false);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')?.checkpoint).toMatchObject({ orphansRemoved: 1 });
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

  // Wave H closing pass Z1, item 7 (driver B decision 7; the kill-matrix shape C-S6 / P2-S6): since driver B's
  // fix an INTERRUPTED session has `stoppedAt` set once it is SEALED (the end of its durable media), so
  // `stoppedAt` no longer tells a stop from an interruption there. The FINISH decision reads the
  // interrupted fact of the session's committed item: its custody entry, or the sealed flag where stated.
  it.each([
    ['an interrupted SEALED session (stoppedAt set at the seal, custody RECORDING_INTERRUPTED), store step not DONE', { custody: [{ action: 'SEALED' }, { action: 'RECORDING_INTERRUPTED' }] }, 'INTERRUPTED'],
    ['the same, said by the sealed manifest flag on the item', { custody: [{ action: 'SEALED' }], interrupted: true }, 'INTERRUPTED'],
    ['CONTROL: a stopped SEALED session (no such entry)', { custody: [{ action: 'SEALED' }] }, 'STOPPED'],
    ['CONTROL: the sealed manifest flag says NOT interrupted - it is the answer where it is stated', { custody: [{ action: 'RECORDING_INTERRUPTED' }], interrupted: false }, 'STOPPED'],
  ] as const)('decide for a SEALED session whose journal is open: %s', async (_name, item, cause) => {
    const controller = createSealingController({
      pipeline: { run: async () => ({ status: 'NOTHING_DURABLE', sessionId: 'SES-20261009-0001' }) },
      engine: () => ({
        applySealingProgress: async () => undefined,
        completeSeal: async () => undefined,
        state: () => ({ session: { id: 'SES-20261009-0001', state: 'SEALED', stoppedAt: 5, fault: null }, evidence: [{ sessionId: 'SES-20261009-0001', manifestHash: 'ab'.repeat(32), integritySource: 'REAL', ...item }] }),
      }),
      hasDurableMedia: async () => true,
      hasSealingRows: async () => true,
      hasOpenSealingRows: async () => true,
    });
    expect(await controller.decide()).toEqual({ action: 'FINISH', sessionId: 'SES-20261009-0001', cause });
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

  it('a fragment above the bound is refused at CLOSE_TRACKS, BY NAME: it is never sealed - the fragments before it are (ruling D183), as interrupted, and the package verifies at the same bound', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    const largest = largestOf(h.recording);
    const pipeline = createSealingPipeline({ ...h.ports, maxFragmentBytes: largest.bytes - 1 });
    const outcome = sealedOf(await pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    expect(outcome.interrupted).toBe(true);
    expect(outcome.tracks.map((track) => [track.trackId, track.fragmentCount])).toEqual(TRACKS.map((trackId) => [trackId, trackId === largest.trackId ? largest.seq - 1 : 3]));
    const entry = h.log.entries.filter((candidate) => candidate.code === 'SEALING_CAMERA_PREFIX_SEALED');
    expect(entry).toHaveLength(1);
    expect(entry[0]?.context).toMatchObject({ failure: 'FRAGMENT_TOO_LARGE', trackId: largest.trackId, seq: largest.seq, bytes: largest.bytes, limitBytes: largest.bytes - 1, firstBadSeq: largest.seq });
    // No sealed byte of the refused FRAGMENT; the pipeline produced nothing its verifier refuses at this bound.
    expect(manifestOf(h.recording).files.flatMap((file) => file.fragments).every((fragment) => fragment.byteLength <= largest.bytes - 1)).toBe(true);
    expect((await verifyAt(h, largest.bytes - 1)).ok).toBe(true);
  });

  it('a fragment above the bound in EVERY camera file: nothing sealed, nothing signed, nothing committed; the recordings are untouched', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    // Below the SMALLEST fragment of the session: the first fragment of each file is too large, so no file has a valid fragment (ruling D183).
    const smallest = Math.min(...TRACKS.flatMap((trackId) => h.recording.tracks[trackId].rows.map((row) => row.byteLength)));
    const pipeline = createSealingPipeline({ ...h.ports, maxFragmentBytes: smallest - 1 });
    const outcome = failedOf(await pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    expect(outcome).toMatchObject({ step: 'CLOSE_TRACKS', code: 'NOTHING_SEALABLE', retriable: false, attempt: 1, detail: { reasons: 'VIDEO-01:FRAGMENT_TOO_LARGE,VIDEO-02:FRAGMENT_TOO_LARGE' } });
    expect(nothingSigned(h.recording)).toBe(true);
    for (const trackId of TRACKS) {
      expect(existsSync(h.recording.cameraFile(trackId))).toBe(false);
      expect(existsSync(h.recording.recordingFile(trackId))).toBe(true);
    }
    expect(existsSync(h.recording.path(PackageFile.FRAGMENTS_JSON))).toBe(false);
    expect(h.engine.completeCalls).toBe(0);
    expect(SEALING_STEP_ORDER.map((step) => rowOf(h, step)?.status ?? null)).toEqual(['FAILED', null, null, null, null, null]);
    expect(rowOf(h, 'CLOSE_TRACKS')?.errorCode).toBe('NOTHING_SEALABLE');
    // Each file is named with ITS fragment and both sizes in the persistent log; the operator reads one sentence.
    const named = h.log.entries.filter((entry) => entry.code === 'SEALING_CAMERA_LEFT_OUT').map((entry) => entry.context as Record<string, unknown>);
    expect(named.map((context) => [context.trackId, context.failure, context.limitBytes])).toEqual(TRACKS.map((trackId) => [trackId, 'FRAGMENT_TOO_LARGE', smallest - 1]));
    const told = h.engine.progress.at(-1)?.steps.find((step) => step.id === 'CLOSE_TRACKS');
    expect(told?.status).toBe('FAILED');
    expect(told?.detail).toBe(sealingFailureReason('NOTHING_SEALABLE'));
    expect(told?.detail).not.toMatch(/[/\\]|[0-9a-f]{32}/);
    // The sentence of the single-fragment refusal is still what the contract says of that code (unchanged text).
    expect(sealingFailureReason('FRAGMENT_TOO_LARGE', named[0] as never)).toContain('is too large to be verified');
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

  // Pin changed by fix pass F-M7c (R88-05 (c)): a file under a recording's name that fails the proof is no longer LEFT with
  // one log line - it is told to the engine once and MOVED to the quarantine (never deleted, never followed). Every other file stays.
  it('CONTAINMENT: only a recording the package\'s own manifest accounts for is removed - another file under a recording\'s name and a link go to the QUARANTINE with one notice, every other file of the folder stays', async () => {
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
      const quarantine = join(h.recording.mediaDir, '.quarantine', h.recording.sessionId);
      // Neither is deleted and neither stays beside the sealed package: the link is moved as the link it is (never followed), the foreign file byte for byte.
      expect(existsSync(first)).toBe(false);
      expect(lstatSync(join(quarantine, 'VIDEO-01.mp4')).isSymbolicLink()).toBe(true);
      expect(existsSync(target)).toBe(true);
      expect(existsSync(second)).toBe(false);
      expect(sha256Hex(readFileSync(join(quarantine, 'VIDEO-02.mp4')))).toBe(sha256Hex(foreign));
      expect(readFileSync(h.recording.path('notes.txt'), 'utf8')).toBe('kept');
      expect(readFileSync(h.recording.path('VIDEO-03.mp4'), 'utf8')).toBe('kept');
      expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toMatchObject({ status: 'DONE', attempt: 2, checkpoint: { committed: 'ALREADY_SEALED', recordingsRemoved: 0, recordingsKept: 2, recordingsQuarantined: 2 } });
      // Each file that was kept is SAID: ONE notice to the engine naming the session and both files, and one line each in the persistent log.
      expect(h.engine.kept).toEqual([
        {
          sessionId: h.recording.sessionId,
          files: [
            { trackId: 'VIDEO-01', name: 'VIDEO-01.mp4', reason: 'NOT_A_REGULAR_FILE' },
            { trackId: 'VIDEO-02', name: 'VIDEO-02.mp4', reason: 'NOT_THE_SEALED_BYTES' },
          ],
        },
      ]);
      expect(h.log.entries.filter((entry) => entry.code === 'SEALING_PLAINTEXT_QUARANTINED').map((entry) => [entry.context?.trackId, entry.context?.reason])).toEqual([
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
