// Fix pass F-M7 (review row 88; decision D178), verifier side:
//
//   R88-08   the development-key mark is ANCHORED: it is derived from the certificate that verified
//            the signature (the retained `device-certificate.pem` whose hash the manifest carries),
//            never from a text of the manifest; V-13 holds manifest fields 25 / 26 to that
//            certificate; the answer is `null` ("not trustworthy") unless V-01, V-03, V-09 and
//            V-13 passed - never `false` from bytes that were not verified;
//   R88-06   `audit-session-extract.jsonl` is covered by no hash and no signature (the manifest
//            has no member for it): every v2 result says so, by a NAMED notice that fails nothing.
//
// Real packages, the product signer, the product verifier. One negative control per rule.
import { EvidenceVerifyResultSchema } from '@dems/shared/api';
import { PackageFile } from '@dems/shared/evidence-package';
import { DEVELOPMENT_KEY_REPORT_LINE, SIGNING_KEY_NOT_ESTABLISHED_REPORT_LINE, VERIFY_NOTICE, verifyPackageV2, verifyReportLines, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { isDevelopmentSigningCertificate, loadSealingSigner, provisionDevelopmentSigningKey } from '../../sealing';
import { contractBodyOf, corePorts } from '../index';
import { NOW, buildPackage, editManifest, flipByte, removeScratch, scratch, type BuiltPackage } from './support';

afterAll(removeScratch);

const EVIDENCE_ID = 'EV-20261009-0001';
const developmentSigner = () => {
  const dataDir = scratch('fm7-devkey');
  const certificate = provisionDevelopmentSigningKey({ dataDir, now: NOW });
  expect(isDevelopmentSigningCertificate(certificate)).toBe(true);
  return loadSealingSigner({ dataDir, now: NOW + 1_000 });
};
const verify = (built: BuiltPackage): Promise<PackageVerifyResult> =>
  verifyPackageV2(corePorts(built.dir, built.opener, 256), { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [built.signer.certificate.sha256] } });
const check = (result: PackageVerifyResult, id: string) => result.checks.find((entry) => entry.id === id);
const bodyOf = (result: PackageVerifyResult) => EvidenceVerifyResultSchema.parse(contractBodyOf(EVIDENCE_ID, NOW, result));
const PLAIN_SUBJECT = 'CN=CORE-KEY-EVSIGN-01,OU=Evidence Signing,O=DEMS';

describe('R88-08: the development-key mark comes from the certificate that verified the signature', () => {
  it('THE FINDING: a development-key holder signs a manifest whose field 25 OMITS the unit - the answer is NOT `developmentKey: false`, V-13 names the member, and the package does not pass', async () => {
    const signer = developmentSigner();
    // Sealed wrong on purpose: the subject text of the manifest is changed BEFORE the hash and the signature (validly signed by the development key).
    const built = await buildPackage({ signer, beforeSeal: (input) => void ((input.device.certificate as { subject: string }).subject = PLAIN_SUBJECT) });
    expect(built.manifest.device.certificate.subject).toBe(PLAIN_SUBJECT);
    const result = await verify(built);
    expect(check(result, 'V-09')?.status).toBe('PASS');
    expect(check(result, 'V-13')).toMatchObject({ status: 'FAIL', failureClass: 'TAMPERED' });
    expect(check(result, 'V-13')?.findings.map((finding) => [finding.code, finding.member])).toEqual([['CERTIFICATE_SUBJECT_MISMATCH', 'device.certificate.subject']]);
    expect(result.ok).toBe(false);
    // Never `false` beside a certificate that says DEVELOPMENT: not established.
    expect(result.signature.developmentKey).toBeNull();
    expect(verifyReportLines(result)).toContain(SIGNING_KEY_NOT_ESTABLISHED_REPORT_LINE);
    expect(bodyOf(result).signature).toEqual({ developmentKey: null });
  });

  it('the serial number of field 26 is held to the certificate as well', async () => {
    const built = await buildPackage({ signer: developmentSigner(), beforeSeal: (input) => void ((input.device.certificate as { serialNumber: string }).serialNumber = '00FF') });
    const result = await verify(built);
    expect(check(result, 'V-13')?.findings.map((finding) => [finding.code, finding.member])).toEqual([['CERTIFICATE_SUBJECT_MISMATCH', 'device.certificate.serialNumber']]);
    expect(result.signature.developmentKey).toBeNull();
  });

  it('a manifest that was altered after the seal answers `null`, never `false` (as the source mark does)', async () => {
    const built = await buildPackage({ signer: developmentSigner() });
    editManifest(built, (manifest) => void (manifest.device.certificate.subject = PLAIN_SUBJECT), { recomputeHash: true });
    const result = await verify(built);
    expect(result.ok).toBe(false);
    expect(result.signature.developmentKey).toBeNull();
    expect(result.sources.development).toBeNull();
    expect(bodyOf(result).signature).toEqual({ developmentKey: null });
  });

  it('a signature that does not verify: the key is not established (null) - the development line is not printed as a fact of an unverified package', async () => {
    const built = await buildPackage({ signer: developmentSigner() });
    flipByte(join(built.dir, PackageFile.SIGNATURE), 10);
    const result = await verify(built);
    expect(check(result, 'V-09')?.status).toBe('FAIL');
    expect(result.signature).toMatchObject({ ok: false, developmentKey: null });
    const lines = verifyReportLines(result);
    expect(lines).not.toContain(DEVELOPMENT_KEY_REPORT_LINE);
    expect(lines).toContain(SIGNING_KEY_NOT_ESTABLISHED_REPORT_LINE);
  });

  it('CONTROL: a development key, everything verified -> true, with the line; a key without the mark, everything verified -> false, without it', async () => {
    const development = await verify(await buildPackage({ signer: developmentSigner() }));
    expect(development).toMatchObject({ ok: true, signature: { ok: true, developmentKey: true } });
    expect(verifyReportLines(development)).toContain(DEVELOPMENT_KEY_REPORT_LINE);
    expect(verifyReportLines(development)).not.toContain(SIGNING_KEY_NOT_ESTABLISHED_REPORT_LINE);
    expect(bodyOf(development).signature).toEqual({ developmentKey: true });
    const plain = await verify(await buildPackage({}));
    expect(plain).toMatchObject({ ok: true, signature: { ok: true, developmentKey: false } });
    expect(verifyReportLines(plain)).not.toContain(DEVELOPMENT_KEY_REPORT_LINE);
    expect(bodyOf(plain).signature).toEqual({ developmentKey: false });
  });

  it('a certificate reader that states no subject (a receiver without one) establishes nothing: null, and V-13 is not failed for it', async () => {
    const built = await buildPackage({ signer: developmentSigner() });
    const ports = corePorts(built.dir, built.opener, 256);
    const result = await verifyPackageV2(
      { ...ports, readCertificate: (pem) => { const facts = ports.readCertificate(pem); return facts === null ? null : { publicKey: facts.publicKey, notBefore: facts.notBefore, notAfter: facts.notAfter }; } },
      { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [built.signer.certificate.sha256] } },
    );
    expect(result.ok).toBe(true);
    expect(result.signature.developmentKey).toBeNull();
  });
});

describe('R88-06: the audit extract is not covered by the package signature, and every v2 result says so', () => {
  it('THE FINDING: an altered `audit-session-extract.jsonl` still verifies PASS on all 15 checks - so the result carries the named notice, in the report and in the operation 41 body', async () => {
    const built = await buildPackage({});
    appendFileSync(join(built.dir, PackageFile.AUDIT_EXTRACT), '{"type":"FORGED_ROW"}\n');
    const result = await verify(built);
    expect(result.ok).toBe(true);
    expect(result.notices).toEqual([{ code: VERIFY_NOTICE.AUDIT_EXTRACT_NOT_SIGNED, report: 'Audit extract: present, NOT covered by the package signature.' }]);
    expect(verifyReportLines(result)).toContain('Audit extract: present, NOT covered by the package signature.');
    expect(bodyOf(result).notices).toEqual([{ code: 'AUDIT_EXTRACT_NOT_SIGNED', report: 'Audit extract: present, NOT covered by the package signature.' }]);
  });

  it('an untouched package carries the same notice (it is a statement about the format, not a finding), and it fails nothing', async () => {
    const result = await verify(await buildPackage({}));
    expect(result).toMatchObject({ ok: true, overall: 'PASS' });
    expect(result.notices.map((notice) => notice.code)).toEqual(['AUDIT_EXTRACT_NOT_SIGNED']);
    expect(result.checks.every((entry) => entry.status === 'PASS')).toBe(true);
  });

  it('CONTROL: a removed extract is still a V-14 failure, and the notice then says it is missing - never "present"', async () => {
    const built = await buildPackage({});
    writeFileSync(join(built.dir, 'keep'), '');
    const { rmSync } = await import('node:fs');
    rmSync(join(built.dir, PackageFile.AUDIT_EXTRACT));
    rmSync(join(built.dir, 'keep'));
    const result = await verify(built);
    expect(check(result, 'V-14')?.status).toBe('FAIL');
    expect(result.notices).toEqual([{ code: 'AUDIT_EXTRACT_NOT_SIGNED', report: 'Audit extract: missing; it is NOT covered by the package signature.' }]);
  });
});
