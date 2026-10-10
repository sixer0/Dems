// Fix pass F-M7 (review row 88, R88-08 (3); decision D178): the seal refuses to sign a package
// whose sources are ALL production with a DEVELOPMENT signing key. The boot check already refuses
// such a key in REAL_PRODUCTION (`capture/boot`), so this cannot happen in a running Core; the
// pipeline holds the rule itself, and this file pins it.
//
// Controls: the same key signs a package of development sources; a key without the mark signs a
// package of production sources.
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PackageFile, type SessionCaptureSourceRow } from '@dems/shared/evidence-package';
import { afterAll, describe, expect, it } from 'vitest';
import { isDevelopmentSigningCertificate, loadSealingSigner, provisionDevelopmentSigningKey, sealingFailureReason } from '../index';
import { removePackages } from './package-support';
import { CLOCK_START, harnessOf, recordSession, removeRecordings } from './pipeline-support';

const scratch: string[] = [];
afterAll(() => {
  removeRecordings();
  removePackages();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const PRODUCTION_ROWS: readonly SessionCaptureSourceRow[] = [
  { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'ONVIF_RTSP' },
  { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'ONVIF_RTSP' },
  { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'USB_AUDIO' },
  { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'USB_AUDIO' },
];
const developmentSigner = () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'dems-fm7-devkey-'));
  scratch.push(dataDir);
  const certificate = provisionDevelopmentSigningKey({ dataDir, now: CLOCK_START - 100_000 });
  expect(isDevelopmentSigningCertificate(certificate)).toBe(true);
  return loadSealingSigner({ dataDir, now: CLOCK_START });
};

describe('R88-08 (3): a development key never signs a package of production sources', () => {
  it('all four sources PRODUCTION and the signing key is a development key: SIGN_MANIFEST fails by name, nothing is signed, nothing is committed', async () => {
    const recording = recordSession();
    const h = harnessOf(recording, { signer: developmentSigner() as never, facts: { sourceRows: PRODUCTION_ROWS } });
    const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    expect(outcome).toMatchObject({ status: 'FAILED', step: 'SIGN_MANIFEST', code: 'DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES', retriable: false });
    expect(existsSync(recording.path(PackageFile.MANIFEST))).toBe(false);
    expect(existsSync(recording.path(PackageFile.SIGNATURE))).toBe(false);
    expect(h.engine.sealed).toHaveLength(0);
    expect(h.engine.progress.at(-1)?.steps.find((step) => step.id === 'SIGN_MANIFEST')?.detail).toBe(sealingFailureReason('DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES'));
    // The recordings are untouched.
    expect(existsSync(recording.recordingFile('VIDEO-01'))).toBe(true);
  });

  it('CONTROL: the development key signs a package of development sources (what it is for)', async () => {
    const recording = recordSession();
    const h = harnessOf(recording, { signer: developmentSigner() as never });
    expect((await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' })).status).toBe('SEALED');
  });

  it('CONTROL: a key without the mark signs a package of production sources', async () => {
    const recording = recordSession();
    const h = harnessOf(recording, { facts: { sourceRows: PRODUCTION_ROWS } });
    const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    expect(outcome.status).toBe('SEALED');
    expect(h.engine.sealed[0]?.input.developmentSources).toBe(false);
  });
});
