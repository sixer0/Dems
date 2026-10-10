// The development-key line as a pure rule (integration pass D4; controller decision D147): what the
// report says of the certificate subject a manifest records, without a file system, a key or a
// signer. Sealed packages with real signatures and a real development key are in
// `apps/core-server/src/evidence-verify/__tests__/development-key.test.ts`.
import { describe, expect, it } from 'vitest';
import { EvidenceVerifyResultSchema } from '../src/api';
import { EXAMPLE_SOURCE_ROWS, PackageFile, attachSignature, buildUnsignedManifest, exampleManifestInput } from '../src/evidence-package';
import {
  DEVELOPMENT_KEY_REPORT_LINE,
  DEVELOPMENT_KEY_SUBJECT_MARK,
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

  it('a subject with the mark: developmentKey true and the line directly after the source block; the signature check is NOT passed by it', async () => {
    const result = await run(manifestWithSubject(`CN=DEMS Core,${DEVELOPMENT_KEY_SUBJECT_MARK}`));
    // This run has no certificate and a verifier that says no: V-09 fails, whatever the key is called.
    expect(result.signature).toMatchObject({ ok: false, developmentKey: true });
    const lines = verifyReportLines(result);
    expect(lines[0]).toBe(result.sources.report);
    expect(lines[1 + result.sources.lines.length]).toBe(DEVELOPMENT_KEY_REPORT_LINE);
    expect(lines[2 + result.sources.lines.length]).toMatch(/^Integrity: FAIL/);
    expect(lines.filter((line) => line === DEVELOPMENT_KEY_REPORT_LINE)).toHaveLength(1);
  });

  it('CONTROL: a subject without the mark has developmentKey false and no line; no manifest, null and no line', async () => {
    const plain = await run(manifestWithSubject('CN=DEMS Core Evidence Signing,O=DEMS'));
    expect(plain.signature.developmentKey).toBe(false);
    expect(verifyReportLines(plain)).not.toContain(DEVELOPMENT_KEY_REPORT_LINE);
    const absent = await run(null);
    expect(absent.signature.developmentKey).toBeNull();
    expect(verifyReportLines(absent)).not.toContain(DEVELOPMENT_KEY_REPORT_LINE);
  });

  it('operation 41: `signature.developmentKey` is an optional boolean member; another member or another type is refused', () => {
    const schema = EvidenceVerifyResultSchema.shape.signature;
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse({ developmentKey: true }).success).toBe(true);
    expect(schema.safeParse({ developmentKey: false }).success).toBe(true);
    expect(schema.safeParse({ developmentKey: 'yes' }).success).toBe(false);
    expect(schema.safeParse({ developmentKey: true, keyId: 'K' }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});
