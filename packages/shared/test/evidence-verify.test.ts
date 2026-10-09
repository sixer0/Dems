// Verify v2 in the shared package (blueprint row 85): what can be held WITHOUT a file system, a
// key or a signer - the folder is platform neutral, the check table is complete, and a verdict is
// never a pass by default. The 14 checks against real packages on disk (real bytes, AES-256-GCM,
// Ed25519) are in `apps/core-server/src/evidence-verify/__tests__/`.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PackageFile } from '../src/evidence-package';
import { VERIFY_FAILURES, VERIFY_V2_CHECKS, pemCertificateSha256, verifyPackageV2, type PackageReader, type VerifyPorts } from '../src/evidence-verify';

const DIR = fileURLToPath(new URL('../src/evidence-verify/', import.meta.url));
const files = readdirSync(DIR).filter((name) => name.endsWith('.ts'));
const code = (name: string): string =>
  readFileSync(`${DIR}${name}`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');

describe('the folder is platform neutral: the Core and a receiver of a copy run the same rules', () => {
  it('holds the five files of the unit', () => {
    expect(files.sort()).toEqual(['index.ts', 'report.ts', 'revisions.ts', 'types.ts', 'verify.ts']);
  });

  it('imports zod, the hash library and the package format only: no Node built-in, no file system, no cryptography module', () => {
    const seen = new Set<string>();
    for (const name of files) for (const match of code(name).matchAll(/\bfrom\s+'([^']+)'/g)) seen.add(match[1] ?? '');
    expect([...seen].sort()).toEqual(['../evidence-package', './report', './revisions', './types', './verify', '@noble/hashes/sha2.js', '@noble/hashes/utils.js', 'zod']);
  });

  it('uses no Node global, no clock, no chance and no log', () => {
    const refused = /\bBuffer\b|\bprocess\b|\brequire\s*\(|\bDate\b|\bperformance\b|\bMath\s*\.\s*random\b|\bconsole\b|\bsetTimeout\b|\bfetch\s*\(/;
    expect(files.filter((name) => refused.test(code(name)))).toEqual([]);
    // Positive control: the scan reads code.
    expect(code('verify.ts')).toMatch(/export async function verifyPackageV2/);
  });
});

describe('the check table', () => {
  it('is V-01 to V-15, in order, and every check has a failure code', () => {
    expect(VERIFY_V2_CHECKS.map((check) => check.id)).toEqual(Array.from({ length: 15 }, (_, index) => `V-${String(index + 1).padStart(2, '0')}`));
    const used = new Set(Object.values(VERIFY_FAILURES).map((rule) => rule.check));
    expect([...used].sort()).toEqual(VERIFY_V2_CHECKS.map((check) => check.id));
  });
});

describe('a verdict is never a pass by default', () => {
  const empty: PackageReader = {
    entry: async () => ({ kind: 'ABSENT' }),
    readText: async () => Promise.reject(new Error('absent')),
    readRange: async () => Promise.reject(new Error('absent')),
    list: async () => [],
  };
  const ports = (reader: PackageReader): VerifyPorts => ({ reader, opener: null, readCertificate: () => null, verifySignature: () => true });

  it('an empty folder: not ok, V-01 and V-14 fail, and no other check is called PASS', async () => {
    const result = await verifyPackageV2(ports(empty));
    expect(result.ok).toBe(false);
    expect(result.overall).toBe('MISSING');
    // V-15 (row 141) has no mark to read without a manifest: SKIPPED, not PASS.
    expect(result.checks.map((check) => check.status)).toEqual(['FAIL', ...Array.from({ length: 12 }, () => 'SKIPPED'), 'FAIL', 'SKIPPED']);
    expect(result.sources).toMatchObject({ ok: false, code: 'UNKNOWN', development: null, tracks: [], audioIntervals: [] });
    expect(result.checks.every((check) => check.status !== 'PASS')).toBe(true);
    expect(result.checks.find((check) => check.id === 'V-14')?.findings.map((finding) => finding.file)).toContain(PackageFile.MANIFEST);
  });

  it('a reader that fails on everything: not ok, and nothing thrown', async () => {
    const broken: PackageReader = { ...empty, entry: async () => ({ kind: 'UNREADABLE' }), list: async () => null };
    const result = await verifyPackageV2(ports(broken), { plaintext: 'WHEN_KEY_AVAILABLE' });
    expect(result.ok).toBe(false);
    expect(result.checks.filter((check) => check.status === 'PASS')).toEqual([]);
  });
});

describe('the SHA-256 of a PEM certificate', () => {
  it('is the hash of the decoded bytes, for every padding; anything that is not exactly one certificate has none', () => {
    const pem = (body: string): string => `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
    // SHA-256 of the bytes "a", "ab", "abc".
    expect(pemCertificateSha256(pem('YQ=='))).toBe('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
    expect(pemCertificateSha256(pem('YWI='))).toBe('fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603');
    expect(pemCertificateSha256(pem('YW\nJj'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    for (const text of ['', 'YWJj', pem(''), pem('YWJ'), pem('YW=j'), pem('YWJj') + pem('YWJj'), pem('YWJj').replace('CERTIFICATE', 'PRIVATE KEY')]) {
      expect(pemCertificateSha256(text)).toBeNull();
    }
  });
});
