// The export of a sealed v2 package (blueprint row 91 / M8-W2): checks M8-EXP-1, M8-CMP-1 (with a
// STAND-IN encoder: the product encoder is blocked on the licence decision), the secret sweep and
// the file half of M8-XAU-1, the development mark in an export, SEC35-09, and the clean-up.
//
// Every package is built by the builder of verify v2 from real bytes (decision D133). A package is
// exported, its three files are copied to a destination folder, the archive is unpacked there with
// the system's `unzip`, and the receiver's verification runs on that folder WITHOUT any key of the
// Core. Each proof has a negative control: the same check on something altered must fail.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PackageFile, cameraFilePath, canonicalJson } from '@dems/shared/evidence-package';
import { EXPORT_KINDS_EXAMPLE } from '@dems/shared/api';
import { verifyPackageV2 } from '@dems/shared/evidence-verify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackage, flipByte, removeScratch, sha256Hex, throwAwaySigner, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { corePorts } from '../../evidence-verify';
import { COMPOSITE_ENCODER_GATE, GPL_ONLY_ENCODERS, compositeEncoderAllowed, exportKindsOf, selectedCompositeEncoder } from '../composite';
import { buildExportManifest, computeExportManifestSha256, parseExportManifest, signExportManifest, serializeExportSignature, type ExportManifest } from '../export-manifest';
import { ExportFailure, ExportFailureCode, exportPackage } from '../package-export';
import { verifyExportAtDestination, type ReceiverVerifyResult } from '../receiver-verify';
import { SecretForm, secretFormsIn } from '../secret-sweep';
import { verifyEd25519 } from '../../capture';
import { EXPORTED_AT, deliver, portsOf, productionPackage, requestFacts, standInEncoder, treeHashes, type Delivered } from './support';
// Task 4 row 227b (the last describe of this file): the signer store of a test, and the export's trust list.
import { lstatSync, mkdirSync, mkdtempSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pemCertificateSha256 } from '@dems/shared/evidence-verify';
import { afterAll } from 'vitest';
import { activateSigningKey, markSigningKeyCompromised, provisionSigningKey, type LoadedSigner } from '../../capture';
import { NOW } from '../../evidence-verify/__tests__/support';
import { isDevelopmentSigningCertificate, loadSealingSigner, provisionDevelopmentSigningKey, sealingSignerDir, sealingVerifyTrust } from '../../sealing';
import { parseExportSignature } from '../export-manifest';
import { exportTrustedCertificates } from '../host';
import type { ExportPorts } from '../package-export';
// Task 4 row 226c (the last describe of this file): the signer's reason of a refused export.
import { SignerError, signerHeldToBoot } from '../../capture';
import { EXPORT_SIGNER_REFUSAL_SOURCE, exportSignerWithRefusal, reportExportSignerRefusal } from '../host';
// Task 4 row V5 (the last describe of this file): both lists of the store for a job, and the receiver's verdict lines.
import { exportVerifyTrust } from '../host';
import { RECEIVER_EXIT, RECEIVER_RESULT_KEY_REPORTED, RECEIVER_RESULT_PASS_UNDER_MARK, receiverReportLines, receiverVerdictOf } from '../receiver-cli';

afterEach(removeScratch);

const outsideExport = (path: string): boolean => path === 'export' || path.startsWith('export/');
const failedChecks = (result: ReceiverVerifyResult): string[] => result.checks.filter((check) => !check.ok).map((check) => check.id);
const codeOf = async (run: Promise<unknown>): Promise<string> =>
  run.then(
    () => 'NO_FAILURE',
    (error: unknown) => (error instanceof ExportFailure ? error.code : `NOT_AN_EXPORT_FAILURE:${String(error)}`),
  );
const receive = (delivered: Delivered, built: BuiltPackage) =>
  verifyExportAtDestination({ unpackedDir: delivered.unpackedDir, archiveFile: delivered.archive, expectedArchiveSha256: delivered.archiveSha256, trustedCertificateSha256: [built.signer.certificate.sha256], chunkBytes: 512 });

/** Rewrites the delivered export manifest with a change; optionally re-hashes it and signs it again. */
async function editExportManifest(delivered: Delivered, change: (manifest: Record<string, any>) => void, options: { rehash?: boolean; resign?: BuiltPackage['signer'] } = {}): Promise<void> {
  const file = delivered.manifestFile;
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, any>;
  change(manifest);
  if (options.rehash === true || options.resign !== undefined) manifest.export.manifestSha256 = computeExportManifestSha256(manifest);
  writeFileSync(file, canonicalJson(manifest));
  if (options.resign !== undefined) {
    const signature = await signExportManifest(options.resign.signer, options.resign.certificate, manifest as ExportManifest, EXPORTED_AT, verifyEd25519);
    writeFileSync(delivered.signatureFile, serializeExportSignature(signature));
  }
}

describe('M8-EXP-1: an exported package verifies at its destination, without a key of the Core', () => {
  it('the decrypted copy, the sealed manifest, the seal, the transcript with its revisions and the export manifest with its signature all verify; the sealed package is untouched', async () => {
    const built = await buildPackage({ revisions: 2 });
    const before = treeHashes(built.dir);
    const outcome = await exportPackage(built.dir, built.item, requestFacts(), portsOf(built));

    // The original package: every file as it was; what is new lies in export/ only.
    expect(treeHashes(built.dir, outsideExport)).toEqual(before);
    expect(readdirSync(built.path('export')).sort()).toEqual(['EXP-000032.manifest.json', 'EXP-000032.manifest.sig', 'EXP-000032.zip', 'export-manifest.json', 'export-manifest.sig']);
    expect(readFileSync(built.path(PackageFile.EXPORT_MANIFEST)).equals(readFileSync(built.path(outcome.files.manifest)))).toBe(true);
    expect(readFileSync(built.path(PackageFile.EXPORT_MANIFEST_SIGNATURE)).equals(readFileSync(built.path(outcome.files.signature)))).toBe(true);
    // The package still verifies at the Core with the export beside it (V-14 allows export/).
    expect((await verifyPackageV2(corePorts(built.dir, built.opener, 512), { plaintext: 'REQUIRED', expected: built.item })).ok).toBe(true);

    const delivered = deliver(built, outcome);
    const result = await receive(delivered, built);
    expect(result.checks.map((check) => [check.id, check.ok, check.findings])).toEqual(['X-01', 'X-02', 'X-03', 'X-04', 'X-05', 'X-06', 'X-07'].map((id) => [id, true, []]));
    expect(result).toMatchObject({ ok: true, exportId: 'EXP-000032', derived: false, anchored: true });

    // The 9 fields of spec §B.11, and the job's two values.
    const manifest = parseExportManifest(readFileSync(delivered.manifestFile, 'utf8'));
    expect(manifest.export).toEqual({
      exportId: 'EXP-000032',
      exportedAt: EXPORTED_AT,
      exportedBy: 'OPR-002',
      authorizationRef: 'AUD-000101',
      derived: false,
      composite: { included: false, encoder: null, sha256: null },
      manifestSha256: outcome.manifestSha256,
    });
    expect(outcome.signature).toMatch(/^[0-9a-f]{128}$/);

    // The copy is DECRYPTED: the unpacked camera file is not the stored one, and it is what the opener gives.
    for (const track of built.manifest.tracks) {
      const stored = readFileSync(built.path(cameraFilePath(track.trackId)));
      const unpacked = readFileSync(join(delivered.unpackedDir, 'fragments', track.file));
      expect(unpacked.byteLength).toBe(stored.byteLength);
      expect(unpacked.equals(stored)).toBe(false);
      const fragment = built.fragment(track.trackId, 2);
      const plain = await built.opener.open({ trackId: track.trackId, ...fragment }, stored.subarray(fragment.byteOffset, fragment.byteOffset + fragment.byteLength));
      expect(unpacked.subarray(fragment.byteOffset, fragment.byteOffset + fragment.byteLength).equals(Buffer.from(plain))).toBe(true);
    }
    // The sealed manifest travels byte for byte.
    expect(readFileSync(join(delivered.unpackedDir, PackageFile.MANIFEST)).equals(readFileSync(built.path(PackageFile.MANIFEST)))).toBe(true);
  });

  it('NEGATIVE CONTROLS: an altered camera file, archive, export manifest, re-hashed export manifest, foreign signature, removed entry and altered revision each fail their check', async () => {
    const built = await buildPackage({ revisions: 1 });
    const outcome = await exportPackage(built.dir, built.item, requestFacts(), portsOf(built));
    const fresh = (): Delivered => deliver(built, outcome);

    let delivered = fresh();
    flipByte(join(delivered.unpackedDir, 'fragments', 'VIDEO-02.mp4'), built.fragment('VIDEO-02', 3).byteOffset + 5);
    let result = await receive(delivered, built);
    expect(result.ok).toBe(false);
    expect(failedChecks(result)).toEqual(['X-04', 'X-06']);
    expect(result.checks.find((check) => check.id === 'X-06')?.findings).toEqual(['PLAINTEXT_HASH_MISMATCH:VIDEO-02', 'FRAGMENT_PLAINTEXT_MISMATCH:VIDEO-02:3']);

    delivered = fresh();
    flipByte(delivered.archive, 400);
    expect(failedChecks(await receive(delivered, built))).toEqual(['X-03']);

    // An edit of the export manifest that leaves its digest: the digest no longer matches.
    delivered = fresh();
    await editExportManifest(delivered, (manifest) => void (manifest.destination.id = 'Somewhere else'));
    result = await receive(delivered, built);
    expect(result.checks.find((check) => check.id === 'X-01')?.findings).toEqual(['EXPORT_MANIFEST_HASH_MISMATCH']);

    // The same edit with the digest recomputed: the signature is not of this manifest.
    delivered = fresh();
    await editExportManifest(delivered, (manifest) => void (manifest.destination.id = 'Somewhere else'), { rehash: true });
    result = await receive(delivered, built);
    expect(failedChecks(result)).toEqual(['X-02']);
    expect(result.checks.find((check) => check.id === 'X-02')?.findings).toContain('EXPORT_SIGNATURE_NOT_OF_MANIFEST');

    // Signed again with a key that is not the Core's: its certificate is not trusted and not in the archive.
    delivered = fresh();
    await editExportManifest(delivered, (manifest) => void (manifest.destination.id = 'Somewhere else'), { resign: throwAwaySigner() });
    result = await receive(delivered, built);
    expect(failedChecks(result)).toEqual(['X-02']);
    expect(result.checks.find((check) => check.id === 'X-02')?.findings).toEqual(['EXPORT_CERTIFICATE_NOT_TRUSTED', 'EXPORT_CERTIFICATE_MISSING']);

    // The signature bytes altered.
    delivered = fresh();
    const signatureFile = delivered.signatureFile;
    const signature = JSON.parse(readFileSync(signatureFile, 'utf8')) as { signature: string };
    signature.signature = `${signature.signature.slice(0, -2)}${signature.signature.endsWith('00') ? '01' : '00'}`;
    writeFileSync(signatureFile, canonicalJson(signature));
    result = await receive(delivered, built);
    expect(result.checks.find((check) => check.id === 'X-02')?.findings).toEqual(['EXPORT_SIGNATURE_INVALID']);

    delivered = fresh();
    rmSync(join(delivered.unpackedDir, PackageFile.AUDIT_EXTRACT));
    result = await receive(delivered, built);
    expect(result.checks.find((check) => check.id === 'X-04')?.findings).toEqual([`ENTRY_MISSING:${PackageFile.AUDIT_EXTRACT}`]);
    expect(failedChecks(result)).toContain('X-05');

    // A transcript revision altered at the destination: the one verifier's V-11 reports it through X-05.
    delivered = fresh();
    const revisionsFile = join(delivered.unpackedDir, PackageFile.TRANSCRIPT_REVISIONS);
    writeFileSync(revisionsFile, readFileSync(revisionsFile, 'utf8').replace('"to":"example 1"', '"to":"example 2"'));
    expect(readFileSync(revisionsFile, 'utf8')).toContain('"to":"example 2"');
    result = await receive(delivered, built);
    expect(result.checks.find((check) => check.id === 'X-05')?.findings.some((finding) => finding.startsWith('V-11:FAIL'))).toBe(true);
  });

  it('SEC35-06, stated: without an anchor a re-signed export verifies against itself only when its certificate travels with it - and with the anchor it never does', async () => {
    const built = await buildPackage();
    const delivered = deliver(built, await exportPackage(built.dir, built.item, requestFacts(), portsOf(built)));
    const unanchored = await verifyExportAtDestination({ unpackedDir: delivered.unpackedDir, archiveFile: delivered.archive, chunkBytes: 512 });
    expect(unanchored).toMatchObject({ ok: true, anchored: false });
    const other = await verifyExportAtDestination({ unpackedDir: delivered.unpackedDir, archiveFile: delivered.archive, trustedCertificateSha256: ['0'.repeat(64)], chunkBytes: 512 });
    expect(failedChecks(other)).toEqual(['X-02', 'X-05']);
  });
});

describe('the development-source mark stays in an export (row 141; spec §G.2)', () => {
  it('a package recorded from development sources is exported, and its export says so at the destination, under both signatures', async () => {
    const built = await buildPackage();
    expect(built.manifest.developmentSources).toBe(true);
    const outcome = await exportPackage(built.dir, built.item, requestFacts(), portsOf(built));
    expect(outcome.manifest.sessionManifest.developmentSources).toBe(true);
    const delivered = deliver(built, outcome);
    expect(await receive(delivered, built)).toMatchObject({ ok: true, development: true });

    // NEGATIVE CONTROL: the mark removed from the export manifest and the manifest signed again
    // WITH THE CORE'S OWN KEY still fails: the sealed manifest in the archive says otherwise.
    await editExportManifest(delivered, (manifest) => void (manifest.sessionManifest.developmentSources = false), { resign: built.signer });
    const result = await receive(delivered, built);
    expect(failedChecks(result)).toEqual(['X-05']);
    expect(result.checks.find((check) => check.id === 'X-05')?.findings).toEqual(['DEVELOPMENT_MARK_MISMATCH']);
    expect(result.development).toBeNull();
  });

  it('CONTROL of the mark: a package of production sources is exported unmarked', async () => {
    const built = await productionPackage();
    expect(built.manifest.developmentSources).toBe(false);
    const outcome = await exportPackage(built.dir, built.item, requestFacts(), portsOf(built));
    expect(await receive(deliver(built, outcome), built)).toMatchObject({ ok: true, development: false });
  });
});

describe('M8-CMP-1: the composite is made on demand, marked derived and hashed into the export manifest (STAND-IN encoder)', () => {
  it('the licence gate is closed: no encoder is selected, and a COMPOSITE export without one fails before anything is written', async () => {
    expect(COMPOSITE_ENCODER_GATE).toBe('BLOCKED_LICENCE_DECISION');
    expect(selectedCompositeEncoder()).toBeNull();
    const built = await buildPackage();
    const before = treeHashes(built.dir);
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts({ kind: 'COMPOSITE' }), portsOf(built, { composite: selectedCompositeEncoder() })))).toBe('COMPOSITE_ENCODER_NOT_SELECTED');
    expect(treeHashes(built.dir)).toEqual(before);
    expect(existsSync(built.path('export'))).toBe(false);
  });

  it('an encoder that exists only in a GPL build is refused by name, whatever hands it in', async () => {
    const built = await buildPackage();
    for (const name of GPL_ONLY_ENCODERS) {
      expect(compositeEncoderAllowed(name), name).toBe(false);
      expect(await codeOf(exportPackage(built.dir, built.item, requestFacts({ kind: 'COMPOSITE' }), portsOf(built, { composite: standInEncoder(name) })))).toBe('COMPOSITE_ENCODER_REFUSED');
    }
    expect(compositeEncoderAllowed('LIBX264')).toBe(false);
    expect(compositeEncoderAllowed('h264_videotoolbox')).toBe(true);
    expect(existsSync(built.path('export'))).toBe(false);
  });

  it('with an encoder: export.derived is true, the composite block is marked derived, its SHA-256 is in the export manifest and holds at the destination; the encoder read both decrypted files whole', async () => {
    const built = await buildPackage();
    const before = treeHashes(built.dir);
    const encoder = standInEncoder();
    const outcome = await exportPackage(built.dir, built.item, requestFacts({ kind: 'COMPOSITE' }), portsOf(built, { composite: encoder }));
    expect(outcome.derived).toBe(true);
    expect(encoder.read).toEqual({ 'VIDEO-01': built.manifest.tracks[0]?.bytes, 'VIDEO-02': built.manifest.tracks[1]?.bytes });
    // Nothing of the composite is left outside the archive; the sealed files are untouched.
    expect(treeHashes(built.dir, outsideExport)).toEqual(before);
    expect(readdirSync(built.path('export')).some((name) => name.includes('partial') || name.includes('composite'))).toBe(false);
    expect(existsSync(built.path('composite'))).toBe(false);

    const delivered = deliver(built, outcome);
    const manifest = parseExportManifest(readFileSync(delivered.manifestFile, 'utf8'));
    const composite = readFileSync(join(delivered.unpackedDir, 'composite', 'composite.mp4'));
    const sha256 = treeHashes(join(delivered.unpackedDir, 'composite'))['composite.mp4'];
    expect(manifest.export.derived).toBe(true);
    expect(manifest.export.composite).toEqual({ included: true, encoder: 'stand-in-encoder', sha256 });
    expect(manifest.composite).toEqual({ derived: true, path: 'composite/composite.mp4', bytes: composite.byteLength, sha256, encoder: 'stand-in-encoder', sources: ['VIDEO-01', 'VIDEO-02'] });
    expect(await receive(delivered, built)).toMatchObject({ ok: true, derived: true });

    // NEGATIVE CONTROL: another composite at the destination.
    writeFileSync(join(delivered.unpackedDir, 'composite', 'composite.mp4'), 'another video');
    const result = await receive(delivered, built);
    expect(failedChecks(result)).toEqual(['X-04', 'X-07']);
    expect(result.checks.find((check) => check.id === 'X-07')?.findings).toEqual(['COMPOSITE_HASH_MISMATCH']);
  });

  it('NEGATIVE CONTROL of the marking: an export manifest that includes a composite and is not marked derived cannot be built, and one altered so is refused at the destination', async () => {
    const built = await buildPackage();
    const outcome = await exportPackage(built.dir, built.item, requestFacts({ kind: 'COMPOSITE' }), portsOf(built, { composite: standInEncoder() }));
    const { schema: _schema, export: block, ...rest } = outcome.manifest;
    const { manifestSha256: _digest, ...unhashed } = block;
    expect(() => buildExportManifest({ ...rest, export: unhashed })).not.toThrow();
    expect(() => buildExportManifest({ ...rest, export: { ...unhashed, derived: false } })).toThrow('EXPORT_COMPOSITE_MARKING');
    expect(() => buildExportManifest({ ...rest, export: { ...unhashed, composite: { ...unhashed.composite, sha256: '1'.repeat(64) } } })).toThrow('EXPORT_COMPOSITE_MARKING');
    expect(() => buildExportManifest({ ...rest, composite: null, export: unhashed })).toThrow('EXPORT_COMPOSITE_MARKING');

    const delivered = deliver(built, outcome);
    await editExportManifest(delivered, (manifest) => void (manifest.export.derived = false), { resign: built.signer });
    expect((await receive(delivered, built)).checks.find((check) => check.id === 'X-01')?.findings).toEqual(['EXPORT_COMPOSITE_MARKING']);
  });

  it('an encoder that fails, or writes nothing, fails the export and leaves no file behind', async () => {
    const built = await buildPackage();
    const failing = { name: 'stand-in-encoder', encode: async () => Promise.reject(new Error('boom')) };
    const silent = { name: 'stand-in-encoder', encode: async () => undefined };
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts({ kind: 'COMPOSITE' }), portsOf(built, { composite: failing })))).toBe('COMPOSITE_FAILED');
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts({ kind: 'COMPOSITE' }), portsOf(built, { composite: silent })))).toBe('COMPOSITE_FAILED');
    expect(existsSync(built.path('export'))).toBe(false);
  });
});

describe('the secret sweep and M8-XAU-1 (file half): no credential-shaped value in the artefact', () => {
  it('knows the four forms, and does not take a hash, an ID or a certificate for one (control)', () => {
    expect(secretFormsIn(`token ses_${'a'.repeat(43)} here`)).toEqual([SecretForm.CONTRACT_TOKEN]);
    expect(secretFormsIn(`http://127.0.0.1:4420/media/mts_${'0'.repeat(45)}`)).toEqual([SecretForm.MEDIA_TOKEN]);
    expect(secretFormsIn('rtsp://admin:hunter2@192.168.1.10:554/stream1')).toEqual([SecretForm.URL_USERINFO]);
    expect(secretFormsIn('-----BEGIN PRIVATE KEY-----')).toEqual([SecretForm.PRIVATE_KEY]);
    expect(secretFormsIn('-----BEGIN ENCRYPTED PRIVATE KEY-----')).toEqual([SecretForm.PRIVATE_KEY]);
    for (const clean of ['a'.repeat(64), 'EV-20261007-0005', 'KID-SES-20261007-0015', '-----BEGIN CERTIFICATE-----', 'rtsp://192.168.1.10:554/stream1', 'http://127.0.0.1:4420/media/', 'formats_and_items', '00:00:01,000 --> 00:00:02,000']) {
      expect(secretFormsIn(clean), clean).toEqual([]);
    }
  });

  it('a real export is clean: the sweep passes, and neither the session key nor a private key is anywhere in the three files', async () => {
    const built = await buildPackage({ revisions: 1 });
    const outcome = await exportPackage(built.dir, built.item, requestFacts(), portsOf(built));
    for (const file of [outcome.files.archive, outcome.files.manifest, outcome.files.signature]) {
      const bytes = readFileSync(built.path(file));
      expect(bytes.includes(built.key), file).toBe(false);
      expect(bytes.includes(Buffer.from(built.key.toString('hex'))), file).toBe(false);
      expect(bytes.includes(Buffer.from(built.key.toString('base64'))), file).toBe(false);
      expect(bytes.includes(Buffer.from('PRIVATE KEY')), file).toBe(false);
    }
    // CONTROL of the search itself: a value that IS in the archive is found by the same search.
    expect(readFileSync(built.path(outcome.files.archive)).includes(Buffer.from(built.manifest.manifestSha256))).toBe(true);
  });

  it.each([
    ['a camera credential in the purpose (it would enter the export manifest)', { purpose: 'copy from rtsp://admin:hunter2@192.168.1.10/stream' }, 'export-manifest.json:URL_USERINFO'],
    ['a media token in the destination', { destination: `mts_${'k'.repeat(40)}` }, 'export-manifest.json:MEDIA_TOKEN'],
  ])('NEGATIVE CONTROL: %s fails the export closed and removes the artefact', async (_name, planted, finding) => {
    const built = await buildPackage();
    const before = treeHashes(built.dir);
    const failure = await exportPackage(built.dir, built.item, requestFacts(planted), portsOf(built)).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ExportFailure);
    expect((failure as ExportFailure).code).toBe('SECRET_SHAPE_FOUND');
    expect((failure as ExportFailure).findings.map((entry) => `${entry.file}:${entry.form}`)).toEqual([finding]);
    // The failure names the file and the form, never the value.
    expect(JSON.stringify([(failure as ExportFailure).message, (failure as ExportFailure).findings])).not.toMatch(/hunter2|kkkk/);
    expect(treeHashes(built.dir)).toEqual(before);
    expect(existsSync(built.path('export'))).toBe(false);
  });
});

describe('SEC35-09 and the failure paths: nothing half-written stays, and nothing is exported that did not verify', () => {
  it('without the session key the export is impossible while the stored-bytes verification still passes', async () => {
    const built = await buildPackage();
    const noKey = { hasKey: () => false, open: () => Promise.reject(new Error('no key')) };
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), portsOf(built, { opener: noKey })))).toBe('SESSION_KEY_UNAVAILABLE');
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), portsOf(built, { opener: null })))).toBe('SESSION_KEY_UNAVAILABLE');
    expect(existsSync(built.path('export'))).toBe(false);
    expect((await verifyPackageV2(corePorts(built.dir, null, 512), { plaintext: 'WHEN_KEY_AVAILABLE', expected: built.item })).ok).toBe(true);
  });

  it('a package that does not verify is not exported: one altered stored byte, another item, no signer', async () => {
    const built = await buildPackage();
    expect(await codeOf(exportPackage(built.dir, { ...built.item, manifestSha256: 'f'.repeat(64) }, requestFacts(), portsOf(built)))).toBe('SOURCE_VERIFY_FAILED');
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), portsOf(built, { signer: null })))).toBe('SIGNER_UNAVAILABLE');
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts({ exportId: '../EXP-000032' }), portsOf(built)))).toBe('EXPORT_ID_INVALID');
    flipByte(built.path(cameraFilePath('VIDEO-01')), built.fragment('VIDEO-01', 2).byteOffset + 9);
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), portsOf(built)))).toBe('SOURCE_VERIFY_FAILED');
    expect(existsSync(built.path('export'))).toBe(false);
  });

  it('a failure while the archive is written, and one just before the names are given, remove every partial file and the folder they made', async () => {
    const built = await buildPackage();
    const before = treeHashes(built.dir);
    // The opener serves the verification (2 files x 5 fragments) and then fails inside the copy.
    let opens = 0;
    const failingLater = { hasKey: built.opener.hasKey, open: (...args: Parameters<typeof built.opener.open>) => ((opens += 1) > 13 ? Promise.reject(new Error('gone')) : built.opener.open(...args)) };
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), portsOf(built, { opener: failingLater })))).toBe('FRAGMENT_OPEN_FAILED');
    expect(opens).toBe(14);
    expect(treeHashes(built.dir)).toEqual(before);
    expect(existsSync(built.path('export'))).toBe(false);

    let seen: string[] = [];
    const probe = (step: string): void => {
      if (step !== 'BEFORE_NAMES') return;
      seen = readdirSync(built.path('export')).sort();
      throw new Error('stopped by the test');
    };
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), portsOf(built, { probe })))).toBe('EXPORT_FAILED');
    // CONTROL: the partial files did exist when the failure came.
    expect(seen).toEqual(['EXP-000032.manifest.json.partial', 'EXP-000032.manifest.sig.partial', 'EXP-000032.zip.partial']);
    expect(treeHashes(built.dir)).toEqual(before);
    expect(existsSync(built.path('export'))).toBe(false);
  });

  it('an archive is never replaced; a later export keeps the earlier one and takes the hand-out names', async () => {
    const built = await buildPackage();
    const first = await exportPackage(built.dir, built.item, requestFacts(), portsOf(built));
    const kept = treeHashes(built.dir);
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), portsOf(built)))).toBe('EXPORT_EXISTS');
    expect(treeHashes(built.dir)).toEqual(kept);

    const second = await exportPackage(built.dir, built.item, requestFacts({ exportId: 'EXP-000033', exportedAt: EXPORTED_AT + 5_000 }), portsOf(built));
    const after = treeHashes(built.dir);
    for (const file of [first.files.archive, first.files.manifest, first.files.signature]) expect(after[file], file).toBe(kept[file]);
    expect(readFileSync(built.path(PackageFile.EXPORT_MANIFEST)).equals(readFileSync(built.path(second.files.manifest)))).toBe(true);
    expect(await receive(deliver(built, first), built)).toMatchObject({ ok: true, exportId: 'EXP-000032' });
    expect(await receive(deliver(built, second), built)).toMatchObject({ ok: true, exportId: 'EXP-000033' });
  });

  it('REPRODUCIBLE (ruling D139): two exports of the same package give byte-identical archives, so the recorded archive hash can be recomputed', async () => {
    const built = await buildPackage({ revisions: 1 });
    const first = await exportPackage(built.dir, built.item, requestFacts(), portsOf(built));
    const second = await exportPackage(built.dir, built.item, requestFacts({ exportId: 'EXP-000033', exportedAt: EXPORTED_AT + 86_400_000 }), portsOf(built, { chunkBytes: 4_096 }));
    const one = readFileSync(built.path(first.files.archive));
    const two = readFileSync(built.path(second.files.archive));
    expect(one.byteLength).toBeGreaterThan(7_000);
    // Wave H C1 (ruling D200): an archive carries the export manifest and signature of ITS export as its
    // last two entries, so two exports are byte-identical UP TO those entries - every entry the signed
    // manifest lists is reproduced bit for bit, in the same place - and each archive has its own hash.
    const payloadEnd = (archive: Buffer, exportId: string): number => archive.indexOf(Buffer.from(`export/${exportId}.manifest.json`)) - 30;
    expect(payloadEnd(one, 'EXP-000032')).toBeGreaterThan(7_000);
    expect(payloadEnd(two, 'EXP-000033')).toBe(payloadEnd(one, 'EXP-000032'));
    expect(two.subarray(0, payloadEnd(two, 'EXP-000033')).equals(one.subarray(0, payloadEnd(one, 'EXP-000032')))).toBe(true);
    expect(second.manifest.package.entries).toEqual(first.manifest.package.entries);
    expect(two.equals(one)).toBe(false);
    expect(second.archive.sha256).not.toBe(first.archive.sha256);
    // The manifest inside an archive names no hash of that archive; the outcome states it.
    expect(first.manifest.package).not.toHaveProperty('sha256');
    expect(first.manifest.package).not.toHaveProperty('bytes');
    expect(first.archive).toEqual({ bytes: one.byteLength, sha256: sha256Hex(one) });
    // CONTROL: the comparison can fail - a composite makes another archive.
    const third = await exportPackage(built.dir, built.item, requestFacts({ exportId: 'EXP-000034', kind: 'COMPOSITE' }), portsOf(built, { composite: standInEncoder() }));
    expect(readFileSync(built.path(third.files.archive)).equals(one)).toBe(false);
  });

  it('the export signature is made by the Core signer of the day: another key than the sealing one travels as a retained certificate and verifies', async () => {
    const built = await buildPackage();
    const today = throwAwaySigner();
    const outcome = await exportPackage(built.dir, built.item, requestFacts(), portsOf(built, { signer: today }));
    const delivered = deliver(built, outcome);
    expect(existsSync(join(delivered.unpackedDir, 'certificates', `${today.certificate.sha256}.pem`))).toBe(true);
    const anchors = [built.signer.certificate.sha256, today.certificate.sha256];
    expect(await verifyExportAtDestination({ unpackedDir: delivered.unpackedDir, archiveFile: delivered.archive, trustedCertificateSha256: anchors, chunkBytes: 512 })).toMatchObject({ ok: true });
    // NEGATIVE CONTROL: with the sealing certificate as the only anchor the export signature is not trusted.
    expect(failedChecks(await receive(delivered, built))).toEqual(['X-02']);
  });
});

// Fix wave J (decision D243; truth rule 3d; findings JA2-03 / JW-03): what operation 40 states of the export outputs.
describe('exportKindsOf: the export outputs this Core can produce (fix wave J)', () => {
  it('this build selects no encoder: a PACKAGE is available, a COMPOSITE is not and names the code the job itself failed with - the contract\'s example', () => {
    expect(selectedCompositeEncoder()).toBeNull();
    const kinds = exportKindsOf(selectedCompositeEncoder() !== null);
    expect(kinds).toEqual([...EXPORT_KINDS_EXAMPLE]);
    expect(kinds[1]).toEqual({ kind: 'COMPOSITE', available: false, reason: ExportFailureCode.COMPOSITE_ENCODER_NOT_SELECTED });
  });

  it('CONTROL - with a selected encoder the kind is available and carries no reason', () => {
    expect(exportKindsOf(true)).toEqual([{ kind: 'PACKAGE', available: true }, { kind: 'COMPOSITE', available: true }]);
  });
});

// ── Task 4 row 227b (package X1-4; SX-09 (c), (d); decision C77): THE EXPORT AFTER A ROTATION ─────────────────
//
// The trust list of an export is the retained certificate set of the Core's own verify (`exportTrustedCertificates`
// of `host.ts`), not the ACTIVE certificate alone. The packages are the row-85 builder's, signed with keys of a
// signer store this test makes; the export is the product's (`exportPackage`) with the product's list; the receiver
// is the repository's own (`verifyExportAtDestination`) over the unpacked archive and nothing else.
//
// SECRETS: every key is generated by this test in a directory of the temporary folder that `afterAll` removes and
// asserts gone. A key file of such a store is read only to search an archive for its bytes; nothing prints it (the
// assertions compare booleans).
describe('row 227b: the trust list of an export is the retained certificate set', () => {
  const FIRST = 'CORE-KEY-EVSIGN-01';
  const SECOND = 'CORE-KEY-EVSIGN-02';
  const THIRD = 'CORE-KEY-EVSIGN-03';
  /** Before the builder's signing instant, so every certificate covers the seal and the export. */
  const PROVISIONED = NOW - 100_000;
  const SUBJECT = { organization: 'SYNTHETIC TEST ORG - NOT AN INSTALLATION', organizationalUnit: 'Evidence signing DEMS-TEST-227B' };
  const LATER_ITEM = { sessionId: 'SES-20261009-0227', evidenceId: 'EV-20261009-0227' };

  const roots: string[] = [];
  function dataDirectory(): string {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row227b-export-'));
    roots.push(root);
    const dataDir = join(root, 'data');
    mkdirSync(dataDir, { mode: 0o700 });
    return dataDir;
  }
  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    for (const root of roots) expect(() => lstatSync(root)).toThrow();
  });

  /** A production-like store (no development mark) with its first key, and the signer of a Core started on it. */
  function productionStore(): { dataDir: string; first: LoadedSigner } {
    const dataDir = dataDirectory();
    provisionSigningKey({ dir: sealingSignerDir(dataDir), now: PROVISIONED, subject: SUBJECT });
    return { dataDir, first: loadSealingSigner({ dataDir, now: NOW }) };
  }
  /** A rotation: the next key is provisioned and made the active one; the signer of a Core restarted on the store. */
  function rotate(dataDir: string, keyId: string): LoadedSigner {
    const dir = sealingSignerDir(dataDir);
    provisionSigningKey({ dir, now: PROVISIONED, keyId, subject: SUBJECT });
    activateSigningKey({ dir, keyId, now: NOW });
    return loadSealingSigner({ dataDir, now: NOW });
  }
  /** The ports of a job as `provideCoreEvidenceExport` builds them: the signer of the day and the list of the store. */
  const corePortsOf = (built: BuiltPackage, dataDir: string, production: boolean, signer: LoadedSigner): ExportPorts => ({
    opener: built.opener,
    signer,
    trustedCertificateSha256: exportTrustedCertificates({ dataDir, production }),
    composite: null,
    chunkBytes: 512,
  });
  /** A receiver that holds the archive and nothing else of the Core; `anchors` are fingerprints handed over out of band. */
  const receiveOnly = (delivered: Delivered, anchors?: readonly string[]) =>
    verifyExportAtDestination({ unpackedDir: delivered.unpackedDir, archiveFile: delivered.archive, expectedArchiveSha256: delivered.archiveSha256, chunkBytes: 512, ...(anchors === undefined ? {} : { trustedCertificateSha256: anchors }) });
  const findingsOf = (result: ReceiverVerifyResult): string[] => result.checks.flatMap((check) => check.findings.map((finding) => `${check.id}:${finding}`));
  const filesBelow = (dir: string): string[] => Object.keys(treeHashes(dir));

  /**
   * THE PRIVATE-KEY ENCODINGS THE SIGNER HANDLES, as needles: the PEM armour of any private key, the DER head of an
   * unencrypted Ed25519 PKCS#8 key (raw and base64), and - of every key of the store - the stored encrypted PKCS#8
   * file and the secret that opens it, raw, hex and base64, whole and in slices.
   */
  function privateKeyNeedles(dataDir: string): Buffer[] {
    const needles: Buffer[] = [Buffer.from('PRIVATE KEY'), Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from('MC4CAQAwBQYDK2VwBCIEI')];
    const dir = sealingSignerDir(dataDir);
    let keyFiles = 0;
    for (const name of readdirSync(dir)) {
      if (!/\.(?:p8|wrap)$/.test(name)) continue;
      keyFiles += 1;
      const bytes = readFileSync(join(dir, name));
      expect(bytes.byteLength, name).toBeGreaterThanOrEqual(32);
      needles.push(bytes, Buffer.from(bytes.toString('hex')), Buffer.from(bytes.toString('base64')));
      for (let at = 0; at + 24 <= bytes.byteLength; at += 24) needles.push(bytes.subarray(at, at + 24));
    }
    // Two files of each key of the store (the key and its secret): the search has something to look for.
    expect(keyFiles).toBeGreaterThanOrEqual(2);
    return needles;
  }
  /** True when ANY needle is anywhere in the archive file or in a file of the unpacked archive. */
  function carriesAny(delivered: Delivered, needles: readonly Buffer[]): boolean {
    const haystacks = [readFileSync(delivered.archive), ...filesBelow(delivered.unpackedDir).map((file) => readFileSync(join(delivered.unpackedDir, file)))];
    return haystacks.some((bytes) => needles.some((needle) => bytes.includes(needle)));
  }
  /** The certificates an unpacked archive carries: path -> SHA-256 of the certificate. */
  function certificatesIn(delivered: Delivered): Record<string, string | null> {
    const found: Record<string, string | null> = {};
    for (const file of filesBelow(delivered.unpackedDir)) if (file.endsWith('.pem') || file.endsWith('.crt')) found[file] = pemCertificateSha256(readFileSync(join(delivered.unpackedDir, file), 'utf8'));
    return found;
  }

  it('seal under key 1, rotate, seal under key 2, export both: each verifies at the destination with only what its archive carries', async () => {
    const { dataDir, first } = productionStore();
    const earlier = await buildPackage({ signer: first, revisions: 1 });
    const second = rotate(dataDir, SECOND);
    expect([first.signer.keyId, second.signer.keyId]).toEqual([FIRST, SECOND]);
    const later = await buildPackage({ signer: second, ...LATER_ITEM });
    const sealedBefore = treeHashes(earlier.dir);

    // The list of a production Core: both certificates, as the Core's own verify trusts them.
    const trusted = exportTrustedCertificates({ dataDir, production: true });
    expect([...trusted].sort()).toEqual([first.certificate.sha256, second.certificate.sha256].sort());
    expect(trusted).toEqual(sealingVerifyTrust({ dataDir, production: true }).trusted);

    // CONTROL - the list before this row (the ACTIVE certificate alone): the package of the earlier key is not exported.
    const activeOnly = { ...corePortsOf(earlier, dataDir, true, second), trustedCertificateSha256: [second.certificate.sha256] };
    expect(await codeOf(exportPackage(earlier.dir, earlier.item, requestFacts(), activeOnly))).toBe('SOURCE_VERIFY_FAILED');
    expect(existsSync(earlier.path('export'))).toBe(false);

    // Both are exported by the Core of today: its signer is the second key.
    const earlierOutcome = await exportPackage(earlier.dir, earlier.item, requestFacts(), corePortsOf(earlier, dataDir, true, second));
    const laterOutcome = await exportPackage(later.dir, later.item, requestFacts({ exportId: 'EXP-000033' }), corePortsOf(later, dataDir, true, second));
    // Nothing sealed is rewritten: every file of the sealed package outside `export/` is byte for byte what it was.
    expect(treeHashes(earlier.dir, outsideExport)).toEqual(sealedBefore);
    // No manifest is signed again: the export names the SEAL's own signature and certificate - the first key's.
    expect(earlierOutcome.manifest.signature).toMatchObject({ keyId: FIRST, certificateSha256: first.certificate.sha256 });
    expect(earlierOutcome.manifest.sessionManifest.manifestSha256).toBe(earlier.manifest.manifestSha256);
    expect(laterOutcome.manifest.signature).toMatchObject({ keyId: SECOND, certificateSha256: second.certificate.sha256 });

    const earlierDelivered = deliver(earlier, earlierOutcome);
    const laterDelivered = deliver(later, laterOutcome);
    // WHAT THE ARCHIVE CARRIES: the certificate that signed the package, and the certificate of the export signature.
    expect(certificatesIn(earlierDelivered)).toEqual({ [PackageFile.CERTIFICATE]: first.certificate.sha256, [`certificates/${second.certificate.sha256}.pem`]: second.certificate.sha256 });
    expect(certificatesIn(laterDelivered)).toEqual({ [PackageFile.CERTIFICATE]: second.certificate.sha256 });
    expect(parseExportSignature(readFileSync(earlierDelivered.signatureFile, 'utf8'))).toMatchObject({ keyId: SECOND, certificateSha256: second.certificate.sha256 });

    // THE RECEIVER, with the archive alone (no key, no store, no list of the Core): both verify.
    for (const delivered of [earlierDelivered, laterDelivered]) {
      const alone = await receiveOnly(delivered);
      expect(findingsOf(alone)).toEqual([]);
      expect(alone).toMatchObject({ ok: true, anchored: false, selfContained: true });
    }
    // ... and with the two fingerprints of the hand-over records (public values): both verify, anchored.
    const fingerprints = [first.certificate.sha256, second.certificate.sha256];
    expect(await receiveOnly(earlierDelivered, fingerprints)).toMatchObject({ ok: true, anchored: true });
    expect(await receiveOnly(laterDelivered, fingerprints)).toMatchObject({ ok: true, anchored: true });
    expect(await receiveOnly(laterDelivered, [second.certificate.sha256])).toMatchObject({ ok: true, anchored: true });
    // NEGATIVE CONTROL: a receiver that was handed the ACTIVE fingerprint alone does not trust the seal of the earlier key.
    const activeAnchor = await receiveOnly(earlierDelivered, [second.certificate.sha256]);
    expect(failedChecks(activeAnchor)).toEqual(['X-05']);
    // The seal (V-13) and the revision the earlier key signed (V-11) are named; nothing else of the export fails.
    expect(findingsOf(activeAnchor)).toEqual(expect.arrayContaining(['X-05:V-13:FAIL:CERTIFICATE_NOT_TRUSTED', 'X-05:V-11:FAIL:REVISION_CERTIFICATE_NOT_TRUSTED']));

    // NO PRIVATE KEY in what is handed out - and the search finds what IS there (a public certificate).
    const needles = privateKeyNeedles(dataDir);
    expect(carriesAny(earlierDelivered, needles)).toBe(false);
    expect(carriesAny(laterDelivered, needles)).toBe(false);
    expect(carriesAny(earlierDelivered, [Buffer.from(first.certificate.pemText, 'utf8')])).toBe(true);
    expect(carriesAny(earlierDelivered, [Buffer.from(second.certificate.pemText, 'utf8')])).toBe(true);
    for (const file of Object.keys(certificatesIn(earlierDelivered))) expect(readFileSync(join(earlierDelivered.unpackedDir, file), 'utf8'), file).toMatch(/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/);
    expect(statSync(earlierDelivered.archive).size).toBe(earlierOutcome.archive.bytes);
  });

  it('a development-marked retained certificate: a production Core does not export its package; a development Core does (control)', async () => {
    const dataDir = dataDirectory();
    const marked = provisionDevelopmentSigningKey({ dataDir, now: PROVISIONED });
    expect(isDevelopmentSigningCertificate(marked)).toBe(true);
    const development = loadSealingSigner({ dataDir, now: NOW });
    const built = await buildPackage({ signer: development });
    const second = rotate(dataDir, SECOND);
    const before = treeHashes(built.dir);

    // The production Core's list has the production key alone.
    expect(exportTrustedCertificates({ dataDir, production: true })).toEqual([second.certificate.sha256]);
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), corePortsOf(built, dataDir, true, second)))).toBe('SOURCE_VERIFY_FAILED');
    expect(existsSync(built.path('export'))).toBe(false);
    expect(treeHashes(built.dir)).toEqual(before);
    // What a production Core does export carries no development certificate.
    const later = await buildPackage({ signer: second, ...LATER_ITEM });
    const delivered = deliver(later, await exportPackage(later.dir, later.item, requestFacts(), corePortsOf(later, dataDir, true, second)));
    expect(Object.values(certificatesIn(delivered))).toEqual([second.certificate.sha256]);
    expect(carriesAny(delivered, [Buffer.from(marked.pemText, 'utf8')])).toBe(false);

    // CONTROL - a development Core on the same store trusts it, and the same package is exported and verifies.
    expect([...exportTrustedCertificates({ dataDir, production: false })].sort()).toEqual([marked.sha256, second.certificate.sha256].sort());
    const outcome = await exportPackage(built.dir, built.item, requestFacts(), corePortsOf(built, dataDir, false, second));
    expect(await receiveOnly(deliver(built, outcome))).toMatchObject({ ok: true });
  });

  it('a never-active key is not on the list; a package under a key MARKED COMPROMISED is not exported, and what was exported before stays as it was', async () => {
    const { dataDir, first } = productionStore();
    const earlier = await buildPackage({ signer: first });
    const second = rotate(dataDir, SECOND);
    const later = await buildPackage({ signer: second, ...LATER_ITEM });
    const dir = sealingSignerDir(dataDir);

    // A third key, provisioned and never made active (a rotation that stopped before the pointer moved).
    const never = provisionSigningKey({ dir, now: PROVISIONED, keyId: THIRD, subject: SUBJECT });
    expect(exportTrustedCertificates({ dataDir, production: true })).not.toContain(never.sha256);
    expect(exportTrustedCertificates({ dataDir, production: false })).not.toContain(never.sha256);

    // An export made BEFORE the mark.
    const before = await exportPackage(earlier.dir, earlier.item, requestFacts(), corePortsOf(earlier, dataDir, true, second));
    const exported = treeHashes(earlier.dir);

    markSigningKeyCompromised({ dir, keyId: FIRST, at: NOW });
    expect(exportTrustedCertificates({ dataDir, production: true })).toEqual([second.certificate.sha256]);
    expect(sealingVerifyTrust({ dataDir, production: true }).compromised).toEqual([first.certificate.sha256]);
    // The list is read when a job starts: the next export of that package is refused, and nothing is written.
    expect(await codeOf(exportPackage(earlier.dir, earlier.item, requestFacts({ exportId: 'EXP-000033' }), corePortsOf(earlier, dataDir, true, second)))).toBe('SOURCE_VERIFY_FAILED');
    expect(treeHashes(earlier.dir)).toEqual(exported);
    expect(existsSync(earlier.path(before.files.archive))).toBe(true);
    // A package of the key that is not marked is exported as before.
    const outcome = await exportPackage(later.dir, later.item, requestFacts({ exportId: 'EXP-000034' }), corePortsOf(later, dataDir, true, second));
    expect(await receiveOnly(deliver(later, outcome), [second.certificate.sha256])).toMatchObject({ ok: true, anchored: true });

    // A store that cannot be taken lists nothing (fail closed).
    expect(exportTrustedCertificates({ dataDir: join(dataDir, 'absent'), production: true })).toEqual([]);
  });

  it('THE WIRING: the composition hands the jobs the list of the store and the operation of this Core - never the active certificate alone', () => {
    const host = readFileSync(join(__dirname, '..', 'host.ts'), 'utf8');
    expect(host).toContain('trustedCertificateSha256: () => exportTrustedCertificates({ dataDir: app.config.dataDir, production }),');
    expect(host).toContain("const production = captureOperationOf(app.config) === 'REAL_PRODUCTION';");
    // The export is no wiring unit of the adapter layer: the operation comes from the fence's one definition.
    expect(host).not.toContain("'../capture/adapters'");
    expect(host).toContain('return sealingVerifyTrust({ dataDir: options.dataDir, production: options.production }).trusted;');
    expect(host).not.toContain('loaded.certificate.sha256');
    expect(host.match(/trustedCertificateSha256: \(\) =>/g)).toHaveLength(1);
  });
});

// Task 4 row 226c (decision C81 (4); difference D-1 of the rotation scenario, test/229): an export the evidence signer
// refuses ends `SIGNATURE_FAILED` or `SIGNER_UNAVAILABLE` - the job's closed codes, unchanged - and nothing said WHY.
// `exportSignerWithRefusal` (`host.ts`) keeps the signer's own code of the job, and `reportExportSignerRefusal` says it in
// the Core's log and its persistent error log. The export is the product's (`exportPackage`); the packages are the row-85
// builder's; every key is generated by this test in a directory of the temporary folder that `afterAll` removes and asserts gone.
describe('row 226c: a refused export carries the reason of the evidence signer', () => {
  const FIRST = 'CORE-KEY-EVSIGN-01';
  const SECOND = 'CORE-KEY-EVSIGN-02';
  const PROVISIONED = NOW - 100_000;
  const SUBJECT = { organization: 'SYNTHETIC TEST ORG - NOT AN INSTALLATION', organizationalUnit: 'Evidence signing DEMS-TEST-226C' };

  const roots: string[] = [];
  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    for (const root of roots) expect(() => lstatSync(root)).toThrow();
  });
  /** A store with its first key, and a Core's clock. */
  function scene(validityDays?: number): { dataDir: string; dir: string; clock: { at: number }; notAfter: number } {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row226c-export-'));
    roots.push(root);
    const dataDir = join(root, 'data');
    mkdirSync(dataDir, { mode: 0o700 });
    const dir = sealingSignerDir(dataDir);
    const certificate = provisionSigningKey({ dir, now: PROVISIONED, subject: SUBJECT, ...(validityDays === undefined ? {} : { validityDays }) });
    return { dataDir, dir, clock: { at: NOW }, notAfter: certificate.notAfter };
  }
  function rotate(dir: string): void {
    provisionSigningKey({ dir, now: PROVISIONED, keyId: SECOND, subject: SUBJECT });
    activateSigningKey({ dir, keyId: SECOND, now: NOW });
  }
  /** What the sealing composition hands the export jobs: the kept signer of the store, through the hold of the boot's key and the clock. */
  function composition(place: { dataDir: string; clock: { at: number } }, bootKeyId: string): () => LoadedSigner {
    let kept: LoadedSigner | null = null;
    return () => signerHeldToBoot((kept ??= loadSealingSigner({ dataDir: place.dataDir, now: place.clock.at })), { bootKeyId, now: () => place.clock.at });
  }
  const portsWith = (built: BuiltPackage, dataDir: string, signer: LoadedSigner | null): ExportPorts => ({ opener: built.opener, signer, trustedCertificateSha256: exportTrustedCertificates({ dataDir, production: true }), composite: null, chunkBytes: 512 });
  /** The Core's log and error log, as doubles that keep what they were handed. */
  function logs(): { app: Parameters<typeof reportExportSignerRefusal>[0]; lines: unknown[]; entries: unknown[] } {
    const lines: unknown[] = [];
    const entries: unknown[] = [];
    return { lines, entries, app: { log: { error: (fields, message) => void lines.push({ ...fields, message }) }, errorLog: { append: (entry) => void entries.push(entry) } } };
  }
  const MESSAGE = 'an export job was refused by the evidence signer of the Core';

  it('a signer that REFUSES THE SIGNATURE (rotated, then marked, while the Core runs): the job`s code stays SIGNATURE_FAILED, the signer`s code is kept and said; nothing is written', async () => {
    const place = scene();
    const signing = exportSignerWithRefusal(composition(place, FIRST));
    const built = await buildPackage({ signer: loadSealingSigner({ dataDir: place.dataDir, now: NOW }) });

    // CONTROL: an export that signs keeps no refusal.
    const first = await exportPackage(built.dir, built.item, requestFacts(), portsWith(built, place.dataDir, signing.signer()));
    expect(first.manifest.signature.keyId).toBe(FIRST);
    expect(signing.refusal()).toBeNull();
    const before = treeHashes(built.dir);

    rotate(place.dir);
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts({ exportId: 'EXP-000033' }), portsWith(built, place.dataDir, signing.signer())))).toBe('SIGNATURE_FAILED');
    expect(signing.refusal()).toEqual({ code: 'ACTIVE_KEY_CHANGED', keyId: FIRST });
    expect(treeHashes(built.dir)).toEqual(before);

    // The failure of the job, as the composition records it.
    const told = logs();
    reportExportSignerRefusal(told.app, { jobId: 'EXPJ-000033', evidenceId: built.item.evidenceId, reason: 'SIGNATURE_FAILED' }, signing.refusal());
    const context = { jobId: 'EXPJ-000033', evidenceId: built.item.evidenceId, signerReason: 'ACTIVE_KEY_CHANGED', signingKeyId: FIRST };
    expect(told.lines).toEqual([{ code: 'SIGNATURE_FAILED', source: EXPORT_SIGNER_REFUSAL_SOURCE, ...context, message: MESSAGE }]);
    expect(told.entries).toEqual([{ level: 'error', source: EXPORT_SIGNER_REFUSAL_SOURCE, message: MESSAGE, code: 'SIGNATURE_FAILED', context }]);
    // Nothing of a place or of key material: codes and IDs only.
    expect(JSON.stringify([told.lines, told.entries])).not.toMatch(/\/|PRIVATE|\.p8|\.wrap/);

    // The mark of the same key, on the same running Core: the next job says THAT reason (the one before is forgotten).
    markSigningKeyCompromised({ dir: place.dir, keyId: FIRST, at: NOW });
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts({ exportId: 'EXP-000034' }), portsWith(built, place.dataDir, signing.signer())))).toBe('SOURCE_VERIFY_FAILED');
    // Refused before any signature (the package is under the marked key): the signer refused nothing in THIS job.
    expect(signing.refusal()).toBeNull();
    const other = await buildPackage({ signer: loadSealingSigner({ dataDir: place.dataDir, now: NOW }), sessionId: 'SES-20261009-0226', evidenceId: 'EV-20261009-0226' });
    expect(other.manifest.signature.keyId).toBe(SECOND);
    expect(await codeOf(exportPackage(other.dir, other.item, requestFacts({ exportId: 'EXP-000035' }), portsWith(other, place.dataDir, signing.signer())))).toBe('SIGNATURE_FAILED');
    expect(signing.refusal()).toEqual({ code: 'KEY_COMPROMISED', keyId: FIRST });
    expect(existsSync(other.path('export'))).toBe(false);
  });

  it('a signer that CANNOT BE TAKEN: rotated before the Core`s first signature (ACTIVE_KEY_CHANGED), and past its certificate`s validity (CERTIFICATE_NOT_VALID_NOW) - the job`s code stays SIGNER_UNAVAILABLE, the reason is kept and said', async () => {
    // THE LAZY ORDER: the Core booted on the first key and has taken no signer yet.
    const lazy = scene();
    const built = await buildPackage({ signer: loadSealingSigner({ dataDir: lazy.dataDir, now: NOW }) });
    rotate(lazy.dir);
    const signing = exportSignerWithRefusal(composition(lazy, FIRST));
    const taken = signing.signer();
    expect(taken).toBeNull();
    expect(await codeOf(exportPackage(built.dir, built.item, requestFacts(), portsWith(built, lazy.dataDir, taken)))).toBe('SIGNER_UNAVAILABLE');
    expect(signing.refusal()).toEqual({ code: 'ACTIVE_KEY_CHANGED', keyId: FIRST });
    expect(existsSync(built.path('export'))).toBe(false);
    const told = logs();
    reportExportSignerRefusal(told.app, { jobId: 'EXPJ-000032', evidenceId: built.item.evidenceId, reason: 'SIGNER_UNAVAILABLE' }, signing.refusal());
    expect(told.entries).toEqual([{ level: 'error', source: EXPORT_SIGNER_REFUSAL_SOURCE, message: MESSAGE, code: 'SIGNER_UNAVAILABLE', context: { jobId: 'EXPJ-000032', evidenceId: built.item.evidenceId, signerReason: 'ACTIVE_KEY_CHANGED', signingKeyId: FIRST } }]);
    expect(told.lines).toHaveLength(1);

    // THE VALIDITY: a Core that took its signer while the certificate was valid, and runs past its end.
    const aged = scene(3);
    const ageing = exportSignerWithRefusal(composition(aged, FIRST));
    expect(ageing.signer()?.signer.keyId).toBe(FIRST);
    aged.clock.at = aged.notAfter + 1;
    expect(ageing.signer()).toBeNull();
    expect(ageing.refusal()).toEqual({ code: 'CERTIFICATE_NOT_VALID_NOW', keyId: FIRST });
  });

  it('a signer taken while valid whose certificate ends BEFORE the signature: the signature is refused by name (the hold asks the clock again)', async () => {
    const place = scene(3);
    const signing = exportSignerWithRefusal(composition(place, FIRST));
    const taken = signing.signer();
    if (taken === null) throw new Error('the signer was not taken');
    place.clock.at = place.notAfter + 1;
    await expect(taken.signer.sign(new Uint8Array(32))).rejects.toMatchObject({ code: 'CERTIFICATE_NOT_VALID_NOW' });
    expect(signing.refusal()).toEqual({ code: 'CERTIFICATE_NOT_VALID_NOW', keyId: FIRST });
    // The error is passed on AS IT WAS THROWN: the job's own steps still map it to their code.
    await expect(taken.signer.sign(new Uint8Array(32))).rejects.toBeInstanceOf(SignerError);
  });

  it('CONTROLS: nothing is said for a failure the signer is not the cause of, for a refusal without a name, and without a refusal; the watched signer signs as the one handed in', async () => {
    const told = logs();
    // Another code of the job, although a refusal is at hand.
    reportExportSignerRefusal(told.app, { jobId: 'EXPJ-000040', evidenceId: 'EV-20261009-0226', reason: 'SOURCE_VERIFY_FAILED' }, { code: 'KEY_COMPROMISED', keyId: FIRST });
    // The signer's code of the job, and no refusal was kept.
    reportExportSignerRefusal(told.app, { jobId: 'EXPJ-000040', evidenceId: 'EV-20261009-0226', reason: 'SIGNATURE_FAILED' }, null);
    expect([told.lines, told.entries]).toEqual([[], []]);
    // A refusal that names no key id is said with an empty one.
    reportExportSignerRefusal(told.app, { jobId: 'EXPJ-000041', evidenceId: 'EV-20261009-0226', reason: 'SIGNER_UNAVAILABLE' }, { code: 'ACTIVE_KEY_POINTER_INVALID', keyId: null });
    expect(told.entries).toEqual([{ level: 'error', source: EXPORT_SIGNER_REFUSAL_SOURCE, message: MESSAGE, code: 'SIGNER_UNAVAILABLE', context: { jobId: 'EXPJ-000041', evidenceId: 'EV-20261009-0226', signerReason: 'ACTIVE_KEY_POINTER_INVALID', signingKeyId: '' } }]);

    // Something thrown that is no refusal of the signer: no reason is invented, at the taking and at a signature.
    const nameless = exportSignerWithRefusal(() => {
      throw new Error('the store is on fire at /some/place');
    });
    expect(nameless.signer()).toBeNull();
    expect(nameless.refusal()).toBeNull();
    const throwing = throwAwaySigner();
    const broken = exportSignerWithRefusal(() => ({ certificate: throwing.certificate, signer: { ...throwing.signer, sign: () => Promise.reject(new Error('device error')) } }));
    await expect(broken.signer()?.signer.sign(new Uint8Array(32))).rejects.toThrow('device error');
    expect(broken.refusal()).toBeNull();
    // The watched signer: the same key id, algorithm, public key and certificate, and a signature that verifies.
    const plain = throwAwaySigner();
    const watched = exportSignerWithRefusal(() => plain).signer();
    if (watched === null) throw new Error('the signer was not taken');
    expect([watched.signer.keyId, watched.signer.algorithm, watched.certificate]).toEqual([plain.signer.keyId, plain.signer.algorithm, plain.certificate]);
    const message = new Uint8Array(32).fill(3);
    expect(verifyEd25519(watched.signer.publicKey(), message, await watched.signer.sign(message))).toBe(true);
  });

  it('THE WIRING: the composition takes the signer of every job through the watch and says the reason before the failure row of the job is committed', () => {
    const host = readFileSync(join(__dirname, '..', 'host.ts'), 'utf8');
    expect(host).toContain('const signing = exportSignerWithRefusal(() => composition.signer());');
    expect(host).toContain('const signer = (): LoadedSigner | null => signing.signer();');
    expect(host).toContain('reportExportSignerRefusal(app, failure, signing.refusal());\n      await host.recordFailure(failure);');
    // The audit row of a failed job keeps its three keys (C3 §5.2): the reason of the signer is not a member of it.
    expect(host).toContain('details: { jobId: failure.jobId, kind: failure.kind, reason: failure.reason },');
  });
});

// Task 4 row V5 (decision C84, cautions R-2 and R-3 of security review 230; SX-09 (d)). EARLIER EVIDENCE UNDER A MARKED KEY
// IS EXPORTABLE WITH THE NOTICE, and A RECEIVER CAN LEARN OF A MARK. The export is the product's (`exportPackage`) with the
// ports as `provideCoreEvidenceExport` builds them (`exportVerifyTrust`); the packages are the row-85 builder's; the receiver
// is the product's (`verifyExportAtDestination`, `receiverReportLines`). Every key is generated by this test into a directory
// of the OS temporary folder that `afterAll` removes and asserts gone; no key file is opened by the test.
describe('row V5: a package under a key MARKED COMPROMISED is exported with the notice; a receiver is told of a mark', () => {
  const FIRST = 'CORE-KEY-EVSIGN-01';
  const SECOND = 'CORE-KEY-EVSIGN-02';
  const PROVISIONED = NOW - 100_000;
  const SUBJECT = { organization: 'SYNTHETIC TEST ORG - NOT AN INSTALLATION', organizationalUnit: 'Evidence signing DEMS-TEST-ROWV5' };
  const roots: string[] = [];
  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    for (const root of roots) expect(() => lstatSync(root)).toThrow();
  });
  /** A production-like store with its first key, in a temporary directory of this test. */
  function productionStore(): { dataDir: string; first: LoadedSigner } {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-rowv5-export-'));
    roots.push(root);
    const dataDir = join(root, 'data');
    mkdirSync(dataDir, { mode: 0o700 });
    provisionSigningKey({ dir: sealingSignerDir(dataDir), now: PROVISIONED, subject: SUBJECT });
    return { dataDir, first: loadSealingSigner({ dataDir, now: NOW }) };
  }
  function rotate(dataDir: string): LoadedSigner {
    const dir = sealingSignerDir(dataDir);
    provisionSigningKey({ dir, now: PROVISIONED, keyId: SECOND, subject: SUBJECT });
    activateSigningKey({ dir, keyId: SECOND, now: NOW });
    return loadSealingSigner({ dataDir, now: NOW });
  }
  /** The ports of a job as the composition builds them since this row: BOTH lists of one read of the store. */
  const corePortsOf = (built: BuiltPackage, dataDir: string, signer: LoadedSigner): ExportPorts => {
    const trust = exportVerifyTrust({ dataDir, production: true });
    return { opener: built.opener, signer, trustedCertificateSha256: trust.trusted, compromisedCertificateSha256: trust.compromised, composite: null, chunkBytes: 512 };
  };
  /** The item as the composition hands it: with the head of the revisions the database holds (here: the package's own, read by the test). */
  const itemOf = (built: BuiltPackage): BuiltPackage['item'] => {
    if (built.item.revisionCount === 0) return { ...built.item, revisionHeadSha256: null };
    const list = JSON.parse(readFileSync(built.path(PackageFile.TRANSCRIPT_REVISIONS), 'utf8')) as { revisions: { sha256: string }[] };
    return { ...built.item, revisionHeadSha256: list.revisions.at(-1)?.sha256 ?? null };
  };
  const receiveWith = (delivered: Delivered, options: { trust?: readonly string[]; marked?: readonly string[] } = {}) =>
    verifyExportAtDestination({
      unpackedDir: delivered.unpackedDir,
      archiveFile: delivered.archive,
      expectedArchiveSha256: delivered.archiveSha256,
      chunkBytes: 512,
      ...(options.trust === undefined ? {} : { trustedCertificateSha256: options.trust }),
      ...(options.marked === undefined ? {} : { compromisedCertificateSha256: options.marked }),
    });
  const findingsOf = (result: ReceiverVerifyResult): string[] => result.checks.flatMap((check) => check.findings.map((finding) => `${check.id}:${finding}`));
  /** NO PRIVATE KEY: the PEM armour of any private key and the DER head of an unencrypted Ed25519 PKCS#8 key (raw and base64), in the archive and in every unpacked file. */
  const KEY_NEEDLES = [Buffer.from(['PRIVATE', 'KEY'].join(' ')), Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from('MC4CAQAwBQYDK2VwBCIEI')];
  const carriesPrivateKey = (delivered: Delivered): boolean =>
    [readFileSync(delivered.archive), ...Object.keys(treeHashes(delivered.unpackedDir)).map((file) => readFileSync(join(delivered.unpackedDir, file)))].some((bytes) => KEY_NEEDLES.some((needle) => bytes.includes(needle)));

  it('R-3: sealed under key 1, rotated, key 1 marked - the package is EXPORTED, the export manifest (signed by key 2) STATES the mark and names the marked certificate; a receiver with no list sees that statement and never a plain pass; nothing sealed is rewritten; no private key in the archive', async () => {
    const { dataDir, first } = productionStore();
    const built = await buildPackage({ signer: first, revisions: 1 });
    const second = rotate(dataDir);
    const sealedBefore = treeHashes(built.dir);
    markSigningKeyCompromised({ dir: sealingSignerDir(dataDir), keyId: FIRST, at: NOW + 1 });
    expect(exportVerifyTrust({ dataDir, production: true })).toEqual({ trusted: [second.certificate.sha256], compromised: [first.certificate.sha256] });

    const outcome = await exportPackage(built.dir, itemOf(built), requestFacts(), corePortsOf(built, dataDir, second));
    // THE STATEMENT, under the export signature of the ACTIVE key.
    expect(outcome.manifest.sourceSigningKey).toEqual({ state: 'MARKED_COMPROMISED', certificateSha256: [first.certificate.sha256], verifiedAs: 'STORED_DIGEST' });
    expect(outcome.manifest.signature).toMatchObject({ keyId: FIRST, certificateSha256: first.certificate.sha256 });
    const delivered = deliver(built, outcome);
    const exportSignature = parseExportSignature(readFileSync(delivered.signatureFile, 'utf8'));
    expect([exportSignature.keyId, exportSignature.certificateSha256]).toEqual([SECOND, second.certificate.sha256]);
    expect(parseExportManifest(readFileSync(delivered.manifestFile, 'utf8')).sourceSigningKey?.certificateSha256).toEqual([first.certificate.sha256]);
    // THE TRUST MATERIAL of the archive: the marked certificate (the seal's own, byte for byte) and the export signer's - PUBLIC certificates only.
    expect(pemCertificateSha256(readFileSync(join(delivered.unpackedDir, PackageFile.CERTIFICATE), 'utf8'))).toBe(first.certificate.sha256);
    expect(pemCertificateSha256(readFileSync(join(delivered.unpackedDir, `certificates/${second.certificate.sha256}.pem`), 'utf8'))).toBe(second.certificate.sha256);
    expect(carriesPrivateKey(delivered)).toBe(false);
    // CONTROL of the search: the public certificate IS found by the same kind of search.
    expect(readFileSync(delivered.archive).includes(Buffer.from('BEGIN CERTIFICATE'))).toBe(true);
    // Nothing sealed was rewritten: every file outside `export/` is as before the mark.
    expect(treeHashes(built.dir, (path) => path === 'export' || path.startsWith('export/'))).toEqual(sealedBefore);

    const both = [first.certificate.sha256, second.certificate.sha256];
    // A RECEIVER WITH NO MARKS LIST sees the export's own statement: every check passes, and the verdict is the NAMED pass.
    for (const trust of [undefined, both]) {
      const result = await receiveWith(delivered, trust === undefined ? {} : { trust });
      expect(findingsOf(result)).toEqual([]);
      expect(result.ok).toBe(true);
      expect(result.keyMark).toEqual({ statedByExport: [first.certificate.sha256], listSupplied: false, reportedByList: false, onlyMarkFails: false });
      const lines = receiverReportLines(result);
      expect(lines.at(-1)).toBe(RECEIVER_RESULT_PASS_UNDER_MARK);
      expect(lines.filter((line) => line === 'RESULT: PASS')).toEqual([]);
      expect(lines.find((line) => line.startsWith('source signing key:'))).toContain(`MARKED COMPROMISED - stated by this export for the certificate ${first.certificate.sha256}`);
      expect(receiverVerdictOf(result).status).toBe(RECEIVER_EXIT.OK);
    }
    // A receiver who WAS told (the same fingerprint in his list), anchored on both keys: the export's statement covers it - the named pass.
    const told = await receiveWith(delivered, { trust: both, marked: [first.certificate.sha256] });
    expect([told.ok, findingsOf(told), receiverReportLines(told).at(-1)]).toEqual([true, [], RECEIVER_RESULT_PASS_UNDER_MARK]);
    expect(told.keyMark).toEqual({ statedByExport: [first.certificate.sha256], listSupplied: true, reportedByList: false, onlyMarkFails: false });
    // WITHOUT AN ANCHOR the statement covers nothing (the holder of the marked key could have made the export himself): not a pass.
    const unanchored = await receiveWith(delivered, { marked: [first.certificate.sha256] });
    expect(unanchored.ok).toBe(false);
    expect(findingsOf(unanchored)).toEqual(['X-05:V-11:FAIL:REVISION_CERTIFICATE_KEY_COMPROMISED', 'X-05:V-13:FAIL:CERTIFICATE_KEY_COMPROMISED']);
    expect([receiverReportLines(unanchored).at(-1), receiverVerdictOf(unanchored).status]).toEqual([RECEIVER_RESULT_KEY_REPORTED, RECEIVER_EXIT.KEY_REPORTED_COMPROMISED]);
    // The key that signed the EXPORT in the list: its statement attests nothing.
    const exportKeyMarked = await receiveWith(delivered, { trust: both, marked: [second.certificate.sha256] });
    expect(findingsOf(exportKeyMarked)).toEqual(['X-02:EXPORT_CERTIFICATE_KEY_COMPROMISED']);
    expect(receiverReportLines(exportKeyMarked).at(-1)).toBe(RECEIVER_RESULT_KEY_REPORTED);

    // NEGATIVE CONTROLS of the statement. Taken out of the manifest (re-hashed): the export signature is not of that manifest.
    await editExportManifest(delivered, (manifest) => delete manifest.sourceSigningKey, { rehash: true });
    const stripped = await receiveWith(delivered, { trust: both });
    expect(stripped.ok).toBe(false);
    expect(findingsOf(stripped)).toContain('X-02:EXPORT_SIGNATURE_NOT_OF_MANIFEST');
    // A statement about a certificate that is not in the archive, even validly signed by the active key: refused by name.
    await editExportManifest(delivered, (manifest) => (manifest.sourceSigningKey = { state: 'MARKED_COMPROMISED', certificateSha256: ['00'.repeat(32)], verifiedAs: 'STORED_DIGEST' }), { resign: second });
    expect(findingsOf(await receiveWith(delivered, { trust: both }))).toContain('X-01:EXPORT_SOURCE_KEY_STATEMENT_UNFOUNDED');
    // A statement in another form is no export manifest.
    for (const bad of [{ state: 'MARKED_COMPROMISED', certificateSha256: [], verifiedAs: 'STORED_DIGEST' }, { state: 'OK', certificateSha256: [first.certificate.sha256], verifiedAs: 'STORED_DIGEST' }, { state: 'MARKED_COMPROMISED', certificateSha256: [second.certificate.sha256, first.certificate.sha256].sort().reverse(), verifiedAs: 'STORED_DIGEST' }]) {
      await editExportManifest(delivered, (manifest) => (manifest.sourceSigningKey = bad), { rehash: true });
      expect(findingsOf(await receiveWith(delivered, { trust: both }))).toContain('X-01:EXPORT_MANIFEST_INVALID');
    }
  });

  it('R-3: a source under the marked key that is NOT the one of record still FAILS the job, by name, and nothing is written: another digest, another revision head, a head the database does not state', async () => {
    const { dataDir, first } = productionStore();
    const sealed = await buildPackage({ signer: first, revisions: 1 });
    // What the holder of the key could make: another package of the same item, validly signed with the SAME key.
    const forged = await buildPackage({ signer: first, revisions: 1 });
    expect(forged.item.manifestSha256).not.toBe(sealed.item.manifestSha256);
    const second = rotate(dataDir);
    markSigningKeyCompromised({ dir: sealingSignerDir(dataDir), keyId: FIRST, at: NOW + 1 });
    const ports = corePortsOf(forged, dataDir, second);
    // The forged package in the place of the item whose digest the database stored.
    const before = treeHashes(forged.dir);
    expect(await codeOf(exportPackage(forged.dir, itemOf(sealed), requestFacts(), ports))).toBe('SOURCE_SIGNED_BY_COMPROMISED_KEY');
    expect(treeHashes(forged.dir)).toEqual(before);
    expect(existsSync(forged.path('export'))).toBe(false);
    // The stored digest matches and the head of the revisions does not, or is not stated at all: nothing is anchored.
    const sealedPorts = corePortsOf(sealed, dataDir, second);
    expect(await codeOf(exportPackage(sealed.dir, { ...sealed.item, revisionHeadSha256: 'ab'.repeat(32) }, requestFacts(), sealedPorts))).toBe('SOURCE_SIGNED_BY_COMPROMISED_KEY');
    expect(await codeOf(exportPackage(sealed.dir, sealed.item, requestFacts(), sealedPorts))).toBe('SOURCE_SIGNED_BY_COMPROMISED_KEY');
    expect(existsSync(sealed.path('export'))).toBe(false);
    // CONTROL - a job that is handed no marked certificate (the ports of before this row): the general refusal of before.
    expect(await codeOf(exportPackage(sealed.dir, itemOf(sealed), requestFacts(), { ...sealedPorts, compromisedCertificateSha256: [] }))).toBe('SOURCE_VERIFY_FAILED');
    const { compromisedCertificateSha256: _marked, ...portsBefore } = sealedPorts;
    expect(await codeOf(exportPackage(sealed.dir, itemOf(sealed), requestFacts(), portsBefore))).toBe('SOURCE_VERIFY_FAILED');
    // CONTROL - the package of record, with its anchors, IS exported (the case above).
    expect((await exportPackage(sealed.dir, itemOf(sealed), requestFacts(), sealedPorts)).manifest.sourceSigningKey?.state).toBe('MARKED_COMPROMISED');
  });

  it('NOTHING CHANGES FOR A PACKAGE NO MARK TOUCHES: its export has no such member and is BYTE FOR BYTE the export of a job that is handed no marked certificate - also while another key of the store is marked; an export made BEFORE a mark verifies as before, and a receiver who is later TOLD gets the state', async () => {
    const { dataDir, first } = productionStore();
    const earlier = await buildPackage({ signer: first });
    const second = rotate(dataDir);
    const later = await buildPackage({ signer: second, sessionId: 'SES-20261009-0235', evidenceId: 'EV-20261009-0235' });

    // An export of the EARLIER package made BEFORE any mark: the manifest of before - no member, not even as a key.
    const beforeMark = await exportPackage(earlier.dir, itemOf(earlier), requestFacts(), corePortsOf(earlier, dataDir, second));
    expect('sourceSigningKey' in beforeMark.manifest).toBe(false);
    expect(readFileSync(earlier.path(beforeMark.files.manifest), 'utf8')).not.toContain('sourceSigningKey');
    const deliveredBefore = deliver(earlier, beforeMark);
    const both = [first.certificate.sha256, second.certificate.sha256];
    const plain = await receiveWith(deliveredBefore, { trust: both });
    expect(plain.ok).toBe(true);
    // The result of before: the eight members, and no `keyMark`.
    expect(Object.keys(plain)).toEqual(['ok', 'checks', 'exportId', 'development', 'derived', 'anchored', 'archive', 'selfContained']);
    expect(receiverReportLines(plain).at(-1)).toBe('RESULT: PASS');

    markSigningKeyCompromised({ dir: sealingSignerDir(dataDir), keyId: FIRST, at: NOW + 1 });
    // The LATER package, key 2, exported while key 1 is marked: byte for byte the export of a job without the marked list (ruling D139: exports are reproducible).
    const withList = await exportPackage(later.dir, itemOf(later), requestFacts({ exportId: 'EXP-000041' }), corePortsOf(later, dataDir, second));
    expect('sourceSigningKey' in withList.manifest).toBe(false);
    const { compromisedCertificateSha256: _marked, ...portsBefore } = corePortsOf(later, dataDir, second);
    // The same export once more, from the same package: its `export/` folder (derived files, never part of the sealed set) is emptied first.
    rmSync(later.path('export'), { recursive: true, force: true });
    const withoutList = await exportPackage(later.dir, later.item, requestFacts({ exportId: 'EXP-000041' }), portsBefore);
    expect(withoutList.archive).toEqual(withList.archive);
    expect(withoutList.manifestSha256).toBe(withList.manifestSha256);

    // THE EXPORT MADE BEFORE THE MARK, at a receiver: unchanged without a list; with the list handed over out of band, the state - never a plain pass.
    expect(await receiveWith(deliveredBefore, { trust: both })).toEqual(plain);
    const told = await receiveWith(deliveredBefore, { trust: both, marked: [first.certificate.sha256] });
    expect(told.ok).toBe(false);
    expect(findingsOf(told)).toEqual(['X-05:V-13:FAIL:CERTIFICATE_KEY_COMPROMISED']);
    expect(told.keyMark).toEqual({ statedByExport: [], listSupplied: true, reportedByList: true, onlyMarkFails: true });
    expect([receiverReportLines(told).at(-1), receiverVerdictOf(told).status]).toEqual(['RESULT: NOT A PASS - signature valid, key reported compromised by the list supplied', 3]);
    // A list that names neither certificate of this export: the pass of before, said with the list.
    const unrelated = await receiveWith(deliveredBefore, { trust: both, marked: ['ab'.repeat(32)] });
    expect([unrelated.ok, receiverReportLines(unrelated).at(-1)]).toEqual([true, 'RESULT: PASS']);
    expect(unrelated.keyMark).toEqual({ statedByExport: [], listSupplied: true, reportedByList: false, onlyMarkFails: false });
  });

  it('THE WIRING: the composition hands a job both lists of ONE read of the store and the head of the revisions the database holds; the export verifies its source by the function of operation 41', () => {
    const host = readFileSync(join(__dirname, '..', 'host.ts'), 'utf8');
    expect(host).toContain('verifyTrust: () => exportVerifyTrust({ dataDir: app.config.dataDir, production }),');
    expect(host).toContain('const trust = wiring.verifyTrust?.();');
    expect(host).toContain('revisionHeadSha256: head === null || head.revisionNo === 0 ? null : head.parentSha256 };');
    expect(host.match(/ sealingVerifyTrust\(\{/g)).toHaveLength(2);
    const job = readFileSync(join(__dirname, '..', 'package-export.ts'), 'utf8');
    expect(job.match(/verifySealedPackageUnderCoreTrust\(/g)).toHaveLength(1);
    // The job itself calls no verifier but that one: the rule "under a compromised key" exists once, in `evidence-verify`.
    expect(job).not.toContain('verifyPackageV2(');
    expect(readFileSync(join(__dirname, '..', '..', 'evidence-verify', 'index.ts'), 'utf8').match(/const admitted = await verifyTrusting\(/g)).toHaveLength(1);
  });
});

