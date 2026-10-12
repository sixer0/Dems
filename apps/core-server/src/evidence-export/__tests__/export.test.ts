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

