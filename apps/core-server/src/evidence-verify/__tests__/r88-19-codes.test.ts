// Review row 88, finding R88-19 (tidy pass F-Y, item 10; controller decision D189): nine of the
// verifier's failure codes were produced by no test. Each has ONE failing package here that makes
// the verifier say exactly that code, on the check and with the failure class the table gives it
// (`VERIFY_FAILURES`), beside a sealed package that says none of them. No code was removed: every
// one of the nine can occur on a package on disk. The verifier is unchanged.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { PackageFile } from '@dems/shared/evidence-package';
import { VERIFY_FAILURES, verifyPackageV2, type PackageVerifyResult, type VerifyFailureCode, type VerifyPorts } from '@dems/shared/evidence-verify';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../index';
import { buildPackage, editManifest, removeScratch, type BuildOptions, type BuiltPackage } from './support';

afterAll(removeScratch);

const NINE = ['FRAGMENTS_JSON_MISSING', 'FRAGMENT_PLAINTEXT_HASH_MISMATCH', 'STORED_BYTES_INCONSISTENT', 'SIGNATURE_FILE_MISSING', 'REVISIONS_FILE_MISSING', 'CERTIFICATE_MISSING', 'CERTIFICATE_UNREADABLE', 'PACKAGE_UNLISTABLE', 'TRANSCRIPT_FILE_UNREADABLE'] as const satisfies readonly VerifyFailureCode[];

const run = (built: BuiltPackage, ports: (own: VerifyPorts) => VerifyPorts = (own) => own): Promise<PackageVerifyResult> =>
  verifyPackageV2(ports(corePorts(built.dir, built.opener, 256)), { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [built.signer.certificate.sha256] } });
const findings = (result: PackageVerifyResult) => result.checks.flatMap((check) => check.findings.map((finding) => ({ check: check.id, status: check.status, ...finding })));
const said = (result: PackageVerifyResult): string[] => [...new Set(findings(result).map((finding) => finding.code))];

/** The package of each code: how it is built, what is done to it on disk, and how it is read. */
const CASES: Record<(typeof NINE)[number], { readonly build?: BuildOptions; readonly tamper?: (built: BuiltPackage) => void; readonly ports?: (own: VerifyPorts) => VerifyPorts; readonly where?: Record<string, unknown> }> = {
  // V-02: the fragment table beside the manifest is gone.
  FRAGMENTS_JSON_MISSING: { tamper: (built) => rmSync(built.path(PackageFile.FRAGMENTS_JSON)), where: { file: PackageFile.FRAGMENTS_JSON } },
  // V-05: a package SEALED with a wrong plaintext hash of one fragment - the stored bytes are the sealed ones and open, the clear bytes are not what the record says.
  FRAGMENT_PLAINTEXT_HASH_MISMATCH: {
    tamper: (built) => editManifest(built, (manifest) => void (manifest.files[0].fragments[1].sha256Plain = 'ab'.repeat(32)), { resignWith: built.signer, rewriteFragmentsJson: true }),
    where: { trackId: 'VIDEO-01', seq: 2 },
  },
  // V-08: the RECORD of one fragment's stored hash is wrong while the bytes and the chain over them are whole - no altered fragment, an inconsistent record.
  STORED_BYTES_INCONSISTENT: {
    tamper: (built) => editManifest(built, (manifest) => void (manifest.files[1].fragments[2].sha256 = 'cd'.repeat(32)), { resignWith: built.signer, rewriteFragmentsJson: true }),
    where: { trackId: 'VIDEO-02', seq: 3 },
  },
  // V-09: the detached signature file is gone.
  SIGNATURE_FILE_MISSING: { tamper: (built) => rmSync(built.path(PackageFile.SIGNATURE)), where: { file: PackageFile.SIGNATURE } },
  // V-11: a package that declares a transcript has no revision list.
  REVISIONS_FILE_MISSING: { build: { revisions: 1 }, tamper: (built) => rmSync(built.path(PackageFile.TRANSCRIPT_REVISIONS)), where: { file: PackageFile.TRANSCRIPT_REVISIONS } },
  // V-13: the certificate is gone / is no certificate.
  CERTIFICATE_MISSING: { tamper: (built) => rmSync(built.path(PackageFile.CERTIFICATE)), where: { file: PackageFile.CERTIFICATE } },
  CERTIFICATE_UNREADABLE: { tamper: (built) => writeFileSync(built.path(PackageFile.CERTIFICATE), 'this is no certificate\n'), where: { file: PackageFile.CERTIFICATE } },
  // V-14: the folder cannot be listed (a reader that gives up on it: more entries than it lists, or a folder it may not read).
  PACKAGE_UNLISTABLE: { ports: (own) => ({ ...own, reader: { ...own.reader, entry: own.reader.entry.bind(own.reader), readText: own.reader.readText.bind(own.reader), readRange: own.reader.readRange.bind(own.reader), list: async () => null } }) },
  // V-10: a transcript file's name is there and is no file that can be read.
  TRANSCRIPT_FILE_UNREADABLE: {
    tamper: (built) => {
      rmSync(built.path(PackageFile.TRANSCRIPT_SRT));
      mkdirSync(built.path(PackageFile.TRANSCRIPT_SRT));
    },
    where: { file: PackageFile.TRANSCRIPT_SRT },
  },
};

/**
 * Every code the verifier says for each package, in its order. What stands beside the code under test
 * follows from the same cause: a file that is gone is also a declared file that is missing (V-14); no
 * certificate means no key to check the signature with (V-09); and the two packages that were SEALED
 * wrong carry a new manifest hash, so they are not the item's manifest (V-12) - and a wrong stored
 * hash of a fragment also disagrees with the recorded chain (V-04, V-06).
 */
const ALONE: Record<(typeof NINE)[number], readonly string[]> = {
  FRAGMENTS_JSON_MISSING: ['FRAGMENTS_JSON_MISSING', 'DECLARED_FILE_MISSING'],
  FRAGMENT_PLAINTEXT_HASH_MISMATCH: ['MANIFEST_NOT_OF_ITEM', 'FRAGMENT_PLAINTEXT_HASH_MISMATCH'],
  STORED_BYTES_INCONSISTENT: ['MANIFEST_NOT_OF_ITEM', 'FRAGMENT_HASH_MISMATCH', 'CHAIN_RECORD_INCONSISTENT', 'STORED_BYTES_INCONSISTENT'],
  SIGNATURE_FILE_MISSING: ['SIGNATURE_FILE_MISSING', 'DECLARED_FILE_MISSING'],
  REVISIONS_FILE_MISSING: ['REVISIONS_FILE_MISSING', 'DECLARED_FILE_MISSING'],
  CERTIFICATE_MISSING: ['SIGNATURE_KEY_UNAVAILABLE', 'CERTIFICATE_MISSING', 'DECLARED_FILE_MISSING'],
  CERTIFICATE_UNREADABLE: ['SIGNATURE_KEY_UNAVAILABLE', 'CERTIFICATE_UNREADABLE'],
  PACKAGE_UNLISTABLE: ['PACKAGE_UNLISTABLE'],
  TRANSCRIPT_FILE_UNREADABLE: ['TRANSCRIPT_FILE_UNREADABLE', 'DECLARED_FILE_UNREADABLE'],
};

describe('R88-19: every failure code of the verifier is produced by a package', () => {
  it('CONTROL: a sealed package says none of the nine (and nothing else)', async () => {
    const result = await run(await buildPackage({ revisions: 1 }));
    expect(result.ok).toBe(true);
    expect(said(result)).toEqual([]);
  });

  it('the nine are codes of the table', () => {
    for (const code of NINE) expect(VERIFY_FAILURES[code], code).toBeDefined();
  });

  it.each(NINE)('%s', async (code) => {
    const of = CASES[code];
    const built = await buildPackage(of.build ?? {});
    of.tamper?.(built);
    const result = await run(built, of.ports);
    const mine = findings(result).filter((finding) => finding.code === code);
    expect(mine.length, `codes said: ${said(result).join(', ')}`).toBeGreaterThanOrEqual(1);
    // On its own check, with its own class, at the place that was changed.
    for (const finding of mine) expect([finding.check, finding.status]).toEqual([VERIFY_FAILURES[code].check, 'FAIL']);
    expect(mine[0]).toMatchObject({ failureClass: VERIFY_FAILURES[code].failureClass, ...of.where });
    expect(result.ok).toBe(false);
    expect(result.overall).not.toBe('PASS');
    // None of the OTHER eight is said for this package: one cause, one of these codes.
    expect(said(result).filter((other) => (NINE as readonly string[]).includes(other))).toEqual([code]);
    // The WHOLE answer of the verifier for this package: the code, and what necessarily comes with that cause.
    expect(said(result)).toEqual(ALONE[code]);
  });
});
