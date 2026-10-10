// The development-key line of the verify report and the op 41 member `signature.developmentKey`
// (integration pass D4; controller decision D147; row 82's `evidence:dev-key`).
//
// Real packages: row 83's signer signs them, the product verifier reads them. The development key
// is made by row 82's own provisioning function, so the mark that is looked for here is the mark
// that function writes - not a text of this file.
import { EvidenceVerifyResultSchema } from '@dems/shared/api';
import { DEVELOPMENT_KEY_REPORT_LINE, DEVELOPMENT_KEY_SUBJECT_MARK, verifyPackageV2, verifyReportLines, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { PackageFile } from '@dems/shared/evidence-package';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEVELOPMENT_KEY_UNIT, isDevelopmentSigningCertificate, loadSealingSigner, provisionDevelopmentSigningKey } from '../../sealing';
import { contractBodyOf, corePorts } from '../index';
import { NOW, buildPackage, flipByte, removeScratch, scratch, type BuiltPackage } from './support';

afterAll(removeScratch);

const EVIDENCE_ID = 'EV-20261009-0001';

const developmentSigner = () => {
  const dataDir = scratch('devkey');
  const certificate = provisionDevelopmentSigningKey({ dataDir, now: NOW });
  expect(isDevelopmentSigningCertificate(certificate)).toBe(true);
  return loadSealingSigner({ dataDir, now: NOW + 1_000 });
};
const verify = (built: BuiltPackage): Promise<PackageVerifyResult> =>
  verifyPackageV2(corePorts(built.dir, built.opener, 256), { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [built.signer.certificate.sha256] } });
const statusOf = (result: PackageVerifyResult, id: string): string => result.checks.find((check) => check.id === id)?.status ?? 'none';

describe('the development-key line (D147)', () => {
  it('the shared mark is the unit row 82 writes into the certificate subject', () => {
    expect(DEVELOPMENT_KEY_SUBJECT_MARK).toBe(`OU=${DEVELOPMENT_KEY_UNIT}`);
  });

  it('a package signed with a development key: the line directly after the source block, before the verdict; the signature passes on its own merits', async () => {
    const built = await buildPackage({ signer: developmentSigner() });
    expect(built.manifest.device.certificate.subject).toContain(DEVELOPMENT_KEY_SUBJECT_MARK);
    const result = await verify(built);
    expect(result.checks.filter((check) => check.status !== 'PASS').map((check) => [check.id, check.findings])).toEqual([]);
    expect(result).toMatchObject({ ok: true, overall: 'PASS' });
    expect(statusOf(result, 'V-09')).toBe('PASS');
    expect(result.signature).toMatchObject({ ok: true, developmentKey: true });
    const lines = verifyReportLines(result);
    const after = 1 + result.sources.lines.length;
    expect(lines[0]).toBe(result.sources.report);
    expect(lines[after]).toBe(DEVELOPMENT_KEY_REPORT_LINE);
    expect(lines[after]).toBe('Signed with a DEVELOPMENT key — not a production signature.');
    expect(lines[after + 1]).toBe('Integrity: PASS');
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf(EVIDENCE_ID, NOW, result));
    expect(body.signature).toEqual({ developmentKey: true });
    expect(body.signatureOk).toBe(true);
  });

  it('CONTROL: a package signed with a key that carries no mark prints no such line and answers developmentKey false', async () => {
    const built = await buildPackage({});
    expect(built.manifest.device.certificate.subject).not.toContain('DEVELOPMENT');
    const result = await verify(built);
    expect(result.signature).toMatchObject({ ok: true, developmentKey: false });
    const lines = verifyReportLines(result);
    expect(lines).not.toContain(DEVELOPMENT_KEY_REPORT_LINE);
    expect(lines[1 + result.sources.lines.length]).toBe('Integrity: PASS');
    expect(EvidenceVerifyResultSchema.parse(contractBodyOf(EVIDENCE_ID, NOW, result)).signature).toEqual({ developmentKey: false });
  });

  it('the mark never decides the signature: a development package whose signature file is altered FAILS V-09 and still says which key', async () => {
    const built = await buildPackage({ signer: developmentSigner() });
    flipByte(join(built.dir, PackageFile.SIGNATURE), 10);
    const result = await verify(built);
    expect(result.ok).toBe(false);
    expect(statusOf(result, 'V-09')).toBe('FAIL');
    expect(result.signature).toMatchObject({ ok: false, developmentKey: true });
    const lines = verifyReportLines(result);
    expect(lines).toContain(DEVELOPMENT_KEY_REPORT_LINE);
    expect(lines.some((line) => line.startsWith('Integrity: FAIL'))).toBe(true);
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf(EVIDENCE_ID, NOW, result));
    expect(body.signatureOk).toBe(false);
    expect(body.signature).toEqual({ developmentKey: true });
  });
});
