// Fix pass F-M8, request line of fix F-M7 (R88-01, decision D178): a sealed package holds ONE OR
// TWO camera files. A package SEALED BY THE PRODUCT PIPELINE with one camera file (the recipe of
// `sealing/__tests__/pipeline-one-camera.test.ts`) is exported with that one decrypted file, its
// export manifest names one payload file, and the export verifies at the destination.
// A composite is made of two camera files: for a one-camera package it is refused BEFORE anything
// is written (stated: `COMPOSITE_FAILED`), and the PACKAGE export of it is whole.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { verifyPackageV2, verifyReportLines } from '@dems/shared/evidence-verify';
import { removeScratch, scratch } from '../../evidence-verify/__tests__/support';
import { corePorts, type RealEvidenceItem } from '../../evidence-verify';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings, sessionFacts, type Harness } from '../../sealing/__tests__/pipeline-support';
import { ExportFailure, exportPackage } from '../package-export';
import { receiverReportLines } from '../receiver-cli';
import { verifyExportAtDestination } from '../receiver-verify';
import { UNZIP, requestFacts, standInEncoder } from './support';

afterAll(() => {
  removeRecordings();
  removePackages();
  removeScratch();
});

/** A session recorded with VIDEO-01 only, sealed by the product pipeline. */
async function sealedOneCamera(): Promise<{ h: Harness; item: RealEvidenceItem }> {
  const recording = recordSession();
  rmSync(recording.recordingFile('VIDEO-02'));
  recording.tracks['VIDEO-02'].rows.length = 0;
  const h = harnessOf(recording);
  const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
  if (outcome.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(outcome)}`);
  expect(outcome.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01']);
  const anchors = h.anchors();
  return { h, item: { evidenceId: anchors.evidenceId ?? '', sessionId: recording.sessionId, manifestSha256: anchors.manifestSha256 ?? '', transcriptSha256: anchors.transcriptSha256 ?? null, revisionCount: anchors.revisionCount ?? 0 } };
}
const portsOf = (h: Harness, composite: ReturnType<typeof standInEncoder> | null = null) => ({ opener: h.recording.opener, signer: h.signer, trustedCertificateSha256: [h.signer.certificate.sha256], composite, chunkBytes: 512 });

describe('fix F-M8 / R88-01: the export of a package with ONE camera file', () => {
  it('carries the one decrypted camera file, names one payload file in its manifest, and verifies at the destination without a key of the Core', async () => {
    const { h, item } = await sealedOneCamera();
    const dir = h.recording.packageDir;
    const outcome = await exportPackage(dir, item, requestFacts(), portsOf(h));
    expect(outcome.manifest.payload.files.map((file) => file.trackId)).toEqual(['VIDEO-01']);
    expect(outcome.manifest.composite).toBeNull();

    const destination = scratch('one-camera-destination');
    const place = (relative: string): string => join(dir, ...relative.split('/'));
    copyFileSync(place(outcome.files.archive), join(destination, `${outcome.exportId}.zip`));
    // Wave H C1 (G94-03): ONE file is handed over - the archive carries its export manifest and signature.
    const unpacked = join(destination, 'unpacked');
    mkdirSync(unpacked);
    execFileSync(UNZIP, ['-q', join(destination, `${outcome.exportId}.zip`), '-d', unpacked]);
    expect(existsSync(join(unpacked, 'fragments', 'VIDEO-01.mp4'))).toBe(true);
    expect(existsSync(join(unpacked, 'fragments', 'VIDEO-02.mp4'))).toBe(false);
    const received = await verifyExportAtDestination({ unpackedDir: unpacked, archiveFile: join(destination, `${outcome.exportId}.zip`), expectedArchiveSha256: outcome.archive.sha256, trustedCertificateSha256: [h.signer.certificate.sha256], chunkBytes: 512 });
    expect(received.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([]);
    expect(received.ok).toBe(true);
  });

  it('a COMPOSITE of it is refused by name, with nothing left behind: a composite is made of two camera files', async () => {
    const { h, item } = await sealedOneCamera();
    const failure = await exportPackage(h.recording.packageDir, item, requestFacts({ kind: 'COMPOSITE' }), portsOf(h, standInEncoder())).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(ExportFailure);
    expect((failure as ExportFailure).code).toBe('COMPOSITE_FAILED');
    expect(existsSync(join(h.recording.packageDir, 'export'))).toBe(false);
  });
});

describe('task 4 row 191c: a package whose signed manifest states audio absent across a worker restart (`audio.absentOnRestart`, decisions C73, C83)', () => {
  it('is exported whole and verifies at the destination without a key of the Core; the received manifest holds the member, byte for byte the sealed one', async () => {
    const gaps = [{ earlierAttempt: 1, laterAttempt: 2, absentAtLeastMs: 336, absentAtMostMs: 715 }];
    const recording = recordSession();
    const h = harnessOf(recording, {
      facts: {
        audioIntervals: [
          { seq: 1, micDeviceId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 0, reason: 'START', switchedBy: null },
          { seq: 2, micDeviceId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: null, reason: 'START', switchedBy: null },
        ],
        audioRestartGaps: gaps,
      },
    });
    const sealed = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    if (sealed.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(sealed)}`);
    const anchors = h.anchors();
    const item: RealEvidenceItem = { evidenceId: anchors.evidenceId ?? '', sessionId: recording.sessionId, manifestSha256: anchors.manifestSha256 ?? '', transcriptSha256: anchors.transcriptSha256 ?? null, revisionCount: anchors.revisionCount ?? 0 };
    const dir = recording.packageDir;
    const sealedManifest = readFileSync(join(dir, 'session-manifest.json'));
    expect((JSON.parse(sealedManifest.toString('utf8')) as { audio: { absentOnRestart?: unknown } }).audio.absentOnRestart).toEqual(gaps);

    const outcome = await exportPackage(dir, item, requestFacts(), portsOf(h));
    const destination = scratch('restart-gap-destination');
    const archive = join(destination, `${outcome.exportId}.zip`);
    copyFileSync(join(dir, ...outcome.files.archive.split('/')), archive);
    const unpacked = join(destination, 'unpacked');
    mkdirSync(unpacked);
    execFileSync(UNZIP, ['-q', archive, '-d', unpacked]);
    expect(readFileSync(join(unpacked, 'session-manifest.json')).equals(sealedManifest)).toBe(true);
    const received = await verifyExportAtDestination({ unpackedDir: unpacked, archiveFile: archive, expectedArchiveSha256: outcome.archive.sha256, trustedCertificateSha256: [h.signer.certificate.sha256], chunkBytes: 512 });
    expect(received.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([]);
    expect(received.ok).toBe(true);
  });

  // Task 4 row P1 (decisions U21 (2), C66 (1), C71 C-7): the second optional member, field 133.
  it('row P1: a package a production Core sealed on macOS (`hostProfileNotAsked`) is exported whole and verifies at the destination; the received manifest holds the member, byte for byte the sealed one', async () => {
    const recording = recordSession();
    const h = harnessOf(recording, { facts: { hostProfileNotAsked: { platform: 'darwin' } } });
    const sealed = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    if (sealed.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(sealed)}`);
    const anchors = h.anchors();
    const item: RealEvidenceItem = { evidenceId: anchors.evidenceId ?? '', sessionId: recording.sessionId, manifestSha256: anchors.manifestSha256 ?? '', transcriptSha256: anchors.transcriptSha256 ?? null, revisionCount: anchors.revisionCount ?? 0 };
    const dir = recording.packageDir;
    const sealedManifest = readFileSync(join(dir, 'session-manifest.json'));
    expect((JSON.parse(sealedManifest.toString('utf8')) as { hostProfileNotAsked?: unknown }).hostProfileNotAsked).toEqual({ platform: 'darwin' });

    const outcome = await exportPackage(dir, item, requestFacts(), portsOf(h));
    const destination = scratch('host-profile-destination');
    const archive = join(destination, `${outcome.exportId}.zip`);
    copyFileSync(join(dir, ...outcome.files.archive.split('/')), archive);
    const unpacked = join(destination, 'unpacked');
    mkdirSync(unpacked);
    execFileSync(UNZIP, ['-q', archive, '-d', unpacked]);
    expect(readFileSync(join(unpacked, 'session-manifest.json')).equals(sealedManifest)).toBe(true);
    const received = await verifyExportAtDestination({ unpackedDir: unpacked, archiveFile: archive, expectedArchiveSha256: outcome.archive.sha256, trustedCertificateSha256: [h.signer.certificate.sha256], chunkBytes: 512 });
    expect(received.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([]);
    expect(received.ok).toBe(true);

    // Task 4 row V6 (decision C97; row P1's request "the member is not shown in the verdicts"): THE RECEIVER'S COMMAND
    // SAYS IT - one line, in the shared verifier's wording, before the verdict; the verdict itself is the PASS of before.
    expect(received.hostProfileNotAsked).toEqual({ platform: 'darwin' });
    const lines = receiverReportLines(received);
    const said = 'Host profile: NOT ASKED. This package was sealed by a production Core on darwin, where the checks of the host profile are not run.';
    expect(lines.filter((line) => line.startsWith('Host profile:'))).toEqual([said]);
    expect(lines.at(-2)).toBe(said);
    expect(lines.at(-1)).toBe('RESULT: PASS');
    // THE CORE'S OWN VERIFIER SAYS IT TOO: one notice of the package's result, which fails nothing (15 of 15 as before).
    const own = await verifyPackageV2(corePorts(dir, null, 512), { plaintext: 'WHEN_KEY_AVAILABLE', expected: { evidenceId: item.evidenceId, sessionId: item.sessionId, manifestSha256: item.manifestSha256 } });
    expect(own.notices.filter((notice) => notice.code === 'HOST_PROFILE_NOT_ASKED')).toEqual([{ code: 'HOST_PROFILE_NOT_ASKED', report: said }]);
    expect(own.checks.filter((check) => check.status === 'FAIL').map((check) => check.id)).toEqual([]);
    expect(verifyReportLines(own).filter((line) => line === said)).toHaveLength(1);

    // CONTROL - A PACKAGE WITHOUT THE MEMBER (Linux, development, every package of before) READS AS BEFORE: no member of
    // the result, no line, no notice.
    const plain = recordSession();
    const plainHarness = harnessOf(plain);
    const plainSealed = await plainHarness.pipeline.run({ sessionId: plain.sessionId, cause: 'STOPPED' });
    if (plainSealed.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(plainSealed)}`);
    const plainAnchors = plainHarness.anchors();
    const plainOwn = await verifyPackageV2(corePorts(plain.packageDir, null, 512), { plaintext: 'WHEN_KEY_AVAILABLE', expected: { evidenceId: plainAnchors.evidenceId ?? '', sessionId: plain.sessionId, manifestSha256: plainAnchors.manifestSha256 ?? '' } });
    expect(plainOwn.checks.filter((check) => check.status === 'FAIL').map((check) => check.id)).toEqual([]);
    expect(plainOwn.notices.map((notice) => notice.code)).not.toContain('HOST_PROFILE_NOT_ASKED');
    expect(verifyReportLines(plainOwn).some((line) => line.startsWith('Host profile:'))).toBe(false);
    const withoutMember = { ...received } as Record<string, unknown>;
    delete withoutMember['hostProfileNotAsked'];
    expect(receiverReportLines(withoutMember as never).some((line) => line.startsWith('Host profile:'))).toBe(false);
    expect(receiverReportLines(withoutMember as never)).toEqual(lines.filter((line) => line !== said));
  });

  // Task 4 row R1b (decision C99; finding F3-01): the third optional member, fields 134-138.
  it('row R1b: a package whose signed manifest states a camera absent inside the session (`tracks[].absentInSession`) is exported whole and verifies at the destination; the received manifest holds the member, byte for byte the sealed one; the receiver\'s command and the Core\'s verifier SAY it', async () => {
    const absences = [{ attempt: 1, loss: 1, absentAtLeastMs: 3048, absentAtMostMs: 8049, ended: 'RE_OPENED' }];
    const recording = recordSession();
    const [one, two] = sessionFacts(recording.sessionId).tracks; // D60 (2026-11-04): the track list is a 1..4 array; the fixture always holds its two
    const h = harnessOf(recording, { facts: { tracks: [{ ...one!, absentInSession: absences as never }, two!] } });
    const sealed = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    if (sealed.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(sealed)}`);
    const anchors = h.anchors();
    const item: RealEvidenceItem = { evidenceId: anchors.evidenceId ?? '', sessionId: recording.sessionId, manifestSha256: anchors.manifestSha256 ?? '', transcriptSha256: anchors.transcriptSha256 ?? null, revisionCount: anchors.revisionCount ?? 0 };
    const dir = recording.packageDir;
    const sealedManifest = readFileSync(join(dir, 'session-manifest.json'));
    expect((JSON.parse(sealedManifest.toString('utf8')) as { tracks: { absentInSession?: unknown }[] }).tracks.map((track) => track.absentInSession)).toEqual([absences, undefined]);

    const outcome = await exportPackage(dir, item, requestFacts(), portsOf(h));
    const destination = scratch('video-absence-destination');
    const archive = join(destination, `${outcome.exportId}.zip`);
    copyFileSync(join(dir, ...outcome.files.archive.split('/')), archive);
    const unpacked = join(destination, 'unpacked');
    mkdirSync(unpacked);
    execFileSync(UNZIP, ['-q', archive, '-d', unpacked]);
    expect(readFileSync(join(unpacked, 'session-manifest.json')).equals(sealedManifest)).toBe(true);
    const received = await verifyExportAtDestination({ unpackedDir: unpacked, archiveFile: archive, expectedArchiveSha256: outcome.archive.sha256, trustedCertificateSha256: [h.signer.certificate.sha256], chunkBytes: 512 });
    expect(received.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([]);
    expect(received.ok).toBe(true);

    // THE RECEIVER'S COMMAND SAYS IT - one line, in the shared verifier's wording, before the verdict; the verdict is the PASS of before.
    expect(received.videoAbsentInSession).toEqual([{ trackId: 'VIDEO-01', absences: [{ absentAtLeastMs: 3048, absentAtMostMs: 8049, ended: 'RE_OPENED' }] }]);
    const lines = receiverReportLines(received);
    const said = 'Video: CAMERA ABSENT INSIDE THE SESSION. VIDEO-01 1 time, at least 3048 ms, at most 8049 ms. No picture was recorded in that time.';
    expect(lines.filter((line) => line.startsWith('Video:'))).toEqual([said]);
    expect(lines.at(-2)).toBe(said);
    expect(lines.at(-1)).toBe('RESULT: PASS');
    // THE CORE'S OWN VERIFIER SAYS IT TOO: one notice of the package's result, which fails nothing (15 of 15 as before).
    const own = await verifyPackageV2(corePorts(dir, null, 512), { plaintext: 'WHEN_KEY_AVAILABLE', expected: { evidenceId: item.evidenceId, sessionId: item.sessionId, manifestSha256: item.manifestSha256 } });
    expect(own.notices.filter((notice) => notice.code === 'VIDEO_ABSENT_IN_SESSION')).toEqual([{ code: 'VIDEO_ABSENT_IN_SESSION', report: said }]);
    expect(own.checks.filter((check) => check.status === 'FAIL').map((check) => check.id)).toEqual([]);
    expect(verifyReportLines(own).filter((line) => line === said)).toHaveLength(1);

    // CONTROL - a result WITHOUT the member (every package of a session without a loss) reads as before: no line.
    const withoutMember = { ...received } as Record<string, unknown>;
    delete withoutMember['videoAbsentInSession'];
    expect(receiverReportLines(withoutMember as never)).toEqual(lines.filter((line) => line !== said));
  });
});
