// The development-key line as a pure rule (integration pass D4; controller decision D147): what the
// report says of the certificate subject a manifest records, without a file system, a key or a
// signer. Sealed packages with real signatures and a real development key are in
// `apps/core-server/src/evidence-verify/__tests__/development-key.test.ts`.
import { describe, expect, it } from 'vitest';
import { EvidenceVerifyResultSchema } from '../src/api';
import { EXAMPLE_SOURCE_ROWS, PackageFile, attachSignature, buildUnsignedManifest, detachedSignatureOf, exampleManifestInput, serializeDetachedSignature, serializeManifest } from '../src/evidence-package';
import {
  DEVELOPMENT_KEY_REPORT_LINE,
  DEVELOPMENT_KEY_SUBJECT_MARK,
  SIGNING_KEY_NOT_ESTABLISHED_REPORT_LINE,
  isDevelopmentKeySubject,
  verifyPackageV2,
  verifyReportLines,
  type PackageReader,
  type PackageVerifyResult,
} from '../src/evidence-verify';

const readerOf = (text: string | null): PackageReader => ({
  entry: async (path) => (path === PackageFile.MANIFEST && text !== null ? { kind: 'FILE', size: text.length } : { kind: 'ABSENT' }),
  readText: async (path) => (path === PackageFile.MANIFEST && text !== null ? text : Promise.reject(new Error('absent'))),
  readRange: async () => Promise.reject(new Error('absent')),
  list: async () => [],
});
const run = (manifest: unknown): Promise<PackageVerifyResult> =>
  verifyPackageV2({ reader: readerOf(manifest === null ? null : JSON.stringify(manifest)), opener: null, readCertificate: () => null, verifySignature: () => false }, { scope: 'MANIFEST' });

/** A sealed-form manifest (it parses) whose signature value is 64 zero bytes: no check of this file relies on it verifying. */
const manifestWithSubject = (subject: string) => {
  const input = exampleManifestInput();
  input.device.certificate.subject = subject;
  return attachSignature(buildUnsignedManifest(input, EXAMPLE_SOURCE_ROWS), new Uint8Array(64));
};

describe('the development-key line (D147)', () => {
  it('the mark is an organizational unit of the subject text', () => {
    expect(DEVELOPMENT_KEY_SUBJECT_MARK).toBe('OU=DEVELOPMENT KEY - NOT FOR PRODUCTION');
    expect(isDevelopmentKeySubject('CN=DEMS Core Evidence Signing,OU=DEVELOPMENT KEY - NOT FOR PRODUCTION,O=DEMS')).toBe(true);
    expect(isDevelopmentKeySubject('CN=DEMS Core Evidence Signing,O=DEMS')).toBe(false);
    // The words in a common name are not the unit.
    expect(isDevelopmentKeySubject('CN=DEVELOPMENT KEY - NOT FOR PRODUCTION')).toBe(false);
  });

  // FIX PASS F-M7 (review row 88, R88-08; decision D178). The two cases below pinned the reviewed defect at
  // abf742f: `developmentKey: true` / `false` answered from a manifest whose signature did NOT verify and that had
  // no certificate (`readCertificate: () => null`, `verifySignature: () => false`). The mark is now a fact of the
  // certificate that VERIFIED the signature; without one it is NOT ESTABLISHED (null), whatever field 25 says.
  it('an UNVERIFIED manifest whose field 25 carries the mark: developmentKey is null (not established), the development line is not printed, the not-established line is', async () => {
    const result = await run(manifestWithSubject(`CN=DEMS Core,${DEVELOPMENT_KEY_SUBJECT_MARK}`));
    // This run has no certificate and a verifier that says no: V-09 fails, whatever the key is called.
    expect(result.signature).toMatchObject({ ok: false, developmentKey: null });
    const lines = verifyReportLines(result);
    expect(lines[0]).toBe(result.sources.report);
    expect(lines).not.toContain(DEVELOPMENT_KEY_REPORT_LINE);
    expect(lines[1 + result.sources.lines.length]).toBe(SIGNING_KEY_NOT_ESTABLISHED_REPORT_LINE);
    expect(lines[2 + result.sources.lines.length]).toMatch(/^Integrity: FAIL/);
  });

  it('an UNVERIFIED manifest whose field 25 carries NO mark: null as well - never `false` from bytes nobody verified; no manifest: null', async () => {
    const plain = await run(manifestWithSubject('CN=DEMS Core Evidence Signing,O=DEMS'));
    expect(plain.signature.developmentKey).toBeNull();
    expect(verifyReportLines(plain)).not.toContain(DEVELOPMENT_KEY_REPORT_LINE);
    const absent = await run(null);
    expect(absent.signature.developmentKey).toBeNull();
    expect(verifyReportLines(absent)).not.toContain(DEVELOPMENT_KEY_REPORT_LINE);
  });

  // The rule itself, with a package whose manifest, signature and certificate HOLD (scope MANIFEST: V-01, V-03, V-09, V-13, V-15).
  const PEM = '-----BEGIN CERTIFICATE-----\nYWJj\n-----END CERTIFICATE-----\n';
  const PEM_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const DEVELOPMENT = `CN=DEMS Core,${DEVELOPMENT_KEY_SUBJECT_MARK},O=DEMS`;
  const PLAIN = 'CN=DEMS Core,OU=Evidence signing,O=DEMS';
  const verified = (manifestSubject: string, certificateSubject: string | undefined): Promise<PackageVerifyResult> => {
    const input = exampleManifestInput();
    input.device.certificate = { subject: manifestSubject, serialNumber: '0A', sha256: PEM_SHA256 };
    input.signature.certificate.sha256 = PEM_SHA256;
    const manifest = attachSignature(buildUnsignedManifest(input, EXAMPLE_SOURCE_ROWS), new Uint8Array(64));
    const files = new Map<string, string>([
      [PackageFile.MANIFEST, new TextDecoder().decode(serializeManifest(manifest))],
      [PackageFile.SIGNATURE, new TextDecoder().decode(serializeDetachedSignature(detachedSignatureOf(manifest)))],
      [PackageFile.CERTIFICATE, PEM],
    ]);
    const reader: PackageReader = {
      entry: async (path) => (files.has(path) ? { kind: 'FILE', size: files.get(path)!.length } : { kind: 'ABSENT' }),
      readText: async (path) => files.get(path) ?? Promise.reject(new Error('absent')),
      readRange: async () => Promise.reject(new Error('absent')),
      list: async () => [...files.keys()],
    };
    return verifyPackageV2(
      { reader, opener: null, verifySignature: () => true, readCertificate: () => ({ publicKey: new Uint8Array(32), notBefore: 0, notAfter: Number.MAX_SAFE_INTEGER, serialNumber: '0A', ...(certificateSubject === undefined ? {} : { subject: certificateSubject }) }) },
      { scope: 'MANIFEST' },
    );
  };
  const statusOf = (result: PackageVerifyResult, id: string): string => result.checks.find((check) => check.id === id)?.status ?? 'none';

  it('VERIFIED, and the certificate itself carries the mark: true, with the line directly after the source block', async () => {
    const result = await verified(DEVELOPMENT, DEVELOPMENT);
    expect(['V-01', 'V-03', 'V-09', 'V-13'].map((id) => statusOf(result, id))).toEqual(['PASS', 'PASS', 'PASS', 'PASS']);
    expect(result.signature).toMatchObject({ ok: true, developmentKey: true });
    const lines = verifyReportLines(result);
    expect(lines[1 + result.sources.lines.length]).toBe(DEVELOPMENT_KEY_REPORT_LINE);
    expect(lines.filter((line) => line === DEVELOPMENT_KEY_REPORT_LINE)).toHaveLength(1);
  });

  it('CONTROL: VERIFIED and the certificate carries no mark: false, no line of either kind', async () => {
    const result = await verified(PLAIN, PLAIN);
    expect(result.signature).toMatchObject({ ok: true, developmentKey: false });
    expect(verifyReportLines(result)).not.toContain(DEVELOPMENT_KEY_REPORT_LINE);
    expect(verifyReportLines(result)).not.toContain(SIGNING_KEY_NOT_ESTABLISHED_REPORT_LINE);
  });

  it('THE FINDING: the certificate says DEVELOPMENT and manifest field 25 omits the unit - V-13 fails on the member and the answer is null, never false', async () => {
    const result = await verified(PLAIN, DEVELOPMENT);
    expect(statusOf(result, 'V-09')).toBe('PASS');
    expect(result.checks.find((check) => check.id === 'V-13')?.findings.map((finding) => [finding.code, finding.member])).toEqual([['CERTIFICATE_SUBJECT_MISMATCH', 'device.certificate.subject']]);
    expect(result.signature.developmentKey).toBeNull();
  });

  it('a reader that states no subject establishes nothing (null) and fails nothing', async () => {
    const result = await verified(DEVELOPMENT, undefined);
    expect(statusOf(result, 'V-13')).toBe('PASS');
    expect(result.signature.developmentKey).toBeNull();
  });

  it('operation 41: `signature.developmentKey` is an optional member - true, false or null (not established); another member or another type is refused', () => {
    const schema = EvidenceVerifyResultSchema.shape.signature;
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse({ developmentKey: true }).success).toBe(true);
    expect(schema.safeParse({ developmentKey: false }).success).toBe(true);
    expect(schema.safeParse({ developmentKey: null }).success).toBe(true);
    expect(schema.safeParse({ developmentKey: 'yes' }).success).toBe(false);
    expect(schema.safeParse({ developmentKey: true, keyId: 'K' }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});
