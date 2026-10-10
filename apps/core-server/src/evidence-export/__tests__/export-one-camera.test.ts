// Fix pass F-M8, request line of fix F-M7 (R88-01, decision D178): a sealed package holds ONE OR
// TWO camera files. A package SEALED BY THE PRODUCT PIPELINE with one camera file (the recipe of
// `sealing/__tests__/pipeline-one-camera.test.ts`) is exported with that one decrypted file, its
// export manifest names one payload file, and the export verifies at the destination.
// A composite is made of two camera files: for a one-camera package it is refused BEFORE anything
// is written (stated: `COMPOSITE_FAILED`), and the PACKAGE export of it is whole.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { removeScratch, scratch } from '../../evidence-verify/__tests__/support';
import type { RealEvidenceItem } from '../../evidence-verify';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings, type Harness } from '../../sealing/__tests__/pipeline-support';
import { ExportFailure, exportPackage } from '../package-export';
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
