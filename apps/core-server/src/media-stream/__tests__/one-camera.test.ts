// Fix pass F-M8, request line of fix F-M7 (R88-01, decision D178): a package SEALED BY THE PRODUCT
// PIPELINE with ONE camera file. The file it holds is planned and read whole; asking for the file
// it does not hold is a NAMED refusal at the plan (so operation 88 answers `409 MEDIA_NOT_AVAILABLE`
// with `details.reason: CAMERA_FILE_NOT_IN_PACKAGE` and issues no session that would fail at its
// first range) - never `FRAGMENT_TABLE_INVALID`, which names a defect of a package.
import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createPackageReader } from '../../evidence-verify';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings } from '../../sealing/__tests__/pipeline-support';
import { MediaSourceError, planMediaFile, readPlain } from '../source';

afterAll(() => {
  removeRecordings();
  removePackages();
});

describe('fix F-M8 / R88-01: the media source of a package with ONE camera file', () => {
  it('VIDEO-01 is planned and read whole (its sealed plaintext hash); VIDEO-02 is CAMERA_FILE_NOT_IN_PACKAGE', async () => {
    const recording = recordSession();
    rmSync(recording.recordingFile('VIDEO-02'));
    recording.tracks['VIDEO-02'].rows.length = 0;
    const h = harnessOf(recording);
    const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    if (outcome.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(outcome)}`);
    const anchors = h.anchors();
    const item = { evidenceId: anchors.evidenceId ?? '', sessionId: recording.sessionId, manifestSha256: anchors.manifestSha256 ?? '' };
    const ports = { reader: createPackageReader(recording.packageDir), opener: recording.opener };

    const plan = await planMediaFile(ports, item, 'VIDEO-01');
    const hash = createHash('sha256');
    for await (const piece of readPlain(ports, plan, { start: 0, end: plan.size })) hash.update(piece);
    expect(hash.digest('hex')).toBe(outcome.tracks[0]?.sha256Plain ?? 'the outcome names no plaintext hash');

    const refused = await planMediaFile(ports, item, 'VIDEO-02').then(
      () => null,
      (error: unknown) => error,
    );
    expect(refused).toBeInstanceOf(MediaSourceError);
    expect((refused as MediaSourceError).code).toBe('CAMERA_FILE_NOT_IN_PACKAGE');
  });
});
