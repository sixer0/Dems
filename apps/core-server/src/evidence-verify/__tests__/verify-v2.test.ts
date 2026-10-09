// Verify v2, the 14 checks V-01 to V-14 (blueprint row 85 / M7-W4; evidence package spec §D;
// checks M7-VV-SRV and M7-TP-1 of the test strategy, at the level of this row: a package built by
// the test support, not one sealed by the pipeline of row 82).
//
// THE RULE OF THIS FILE: every check is shown to PASS on a sealed package and to FAIL on its
// tamper, and where the tamper touches one thing the failing checks are asserted as an exact
// list - a tamper that also fails a check it should not, or a check that stays PASS on a tampered
// package, turns a test red. Real bytes on disk, real SHA-256, real AES-256-GCM, real Ed25519.
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PackageFile, cameraFilePath, serializeFragmentsJson, type ManifestFile } from '@dems/shared/evidence-package';
import {
  VERIFY_FAILURES,
  VERIFY_V2_CHECKS,
  pemCertificateSha256,
  retainedCertificatePath,
  verifyPackageV2,
  type PackageReader,
  type PackageVerifyResult,
  type VerifyCheckId,
  type VerifyOptions,
} from '@dems/shared/evidence-verify';
import { afterAll, describe, expect, it } from 'vitest';
import { verifyEd25519, verifyManifestSeal } from '../../capture';
import { corePorts } from '../index';
import {
  NOW,
  buildPackage,
  editManifest,
  flipByte,
  readJson,
  removeScratch,
  retainCertificate,
  revisionRecord,
  sha256Hex,
  testOpener,
  throwAwaySigner,
  writeRevisions,
  type BuildOptions,
  type BuiltPackage,
} from './support';

afterAll(removeScratch);

const CHUNK = 256;
const ALL = VERIFY_V2_CHECKS.map((check) => check.id);

/** A run with a session key and NO anchor from outside the package: what the package says of itself. */
const verify = (built: BuiltPackage, options: VerifyOptions = {}, opener: BuiltPackage['opener'] | null = built.opener): Promise<PackageVerifyResult> =>
  verifyPackageV2(corePorts(built.dir, opener, CHUNK), options);

/** A run as the Core runs it: every anchor the Core has. */
const verifyAnchored = (built: BuiltPackage, item = built.item, trusted: readonly string[] = [built.signer.certificate.sha256]): Promise<PackageVerifyResult> =>
  verify(built, { plaintext: 'REQUIRED', expected: { ...item, trustedCertificateSha256: trusted } });

const withStatus = (result: PackageVerifyResult, status: string): VerifyCheckId[] => result.checks.filter((check) => check.status === status).map((check) => check.id);
const failing = (result: PackageVerifyResult): VerifyCheckId[] => withStatus(result, 'FAIL');
const skipped = (result: PackageVerifyResult): VerifyCheckId[] => withStatus(result, 'SKIPPED');
const check = (result: PackageVerifyResult, id: VerifyCheckId) => {
  const found = result.checks.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no check ${id}`);
  return found;
};
const codes = (result: PackageVerifyResult, id: VerifyCheckId): string[] => check(result, id).findings.map((finding) => finding.code);
const named = (result: PackageVerifyResult): string[] => result.fragments.map((fragment) => `${fragment.trackId}#${fragment.seq}`);

/** Every failing check of a result is a failure of the verdict, in every test of this file. */
function expectFailed(result: PackageVerifyResult, exactly: readonly VerifyCheckId[]): void {
  expect(failing(result)).toEqual(exactly);
  expect(result.ok).toBe(false);
  expect(result.overall).not.toBe('PASS');
}

describe('a sealed package: the 14 checks pass (M7-VV-SRV at the level of this row)', () => {
  it('V-01 to V-14 are 14 checks in order, each PASS, on a package with a transcript and revisions', async () => {
    const built = await buildPackage({ revisions: 2 });
    const result = await verifyAnchored(built);
    expect(result.checks.map((entry) => entry.id)).toEqual(['V-01', 'V-02', 'V-03', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08', 'V-09', 'V-10', 'V-11', 'V-12', 'V-13', 'V-14', 'V-15']);
    expect(result.checks.map((entry) => entry.status)).toEqual(ALL.map(() => 'PASS'));
    expect(result).toMatchObject({ ok: true, overall: 'PASS', interrupted: false, plaintextChecked: true, fragments: [] });
    expect(result.files.map((file) => [file.trackId, file.storedOk, file.plainOk, file.chainOk, file.sequenceOk, file.fragmentCount])).toEqual([
      ['VIDEO-01', true, true, true, true, 5],
      ['VIDEO-02', true, true, true, true, 5],
    ]);
    expect(result.transcript).toEqual({ state: 'VERIFIED', revisions: 2 });
    expect(result.signature).toMatchObject({ ok: true, algorithm: 'Ed25519', keyId: 'CORE-KEY-EVSIGN-01', simulated: false, integrityCheckedWithoutKey: true });
    // Every fragment of both files was opened: the plaintext check ran on real ciphertext.
    expect(built.opener.opened.map((record) => `${record.trackId}#${record.seq}`)).toEqual(['VIDEO-01', 'VIDEO-02'].flatMap((track) => [1, 2, 3, 4, 5].map((seq) => `${track}#${seq}`)));
  });

  it('agrees with the signer unit of row 83 on the hash and the signature of the same manifest', async () => {
    const built = await buildPackage();
    expect(verifyManifestSeal(readJson(built.path(PackageFile.MANIFEST)), built.signer.certificate.publicKey, verifyEd25519)).toEqual({ hashOk: true, signatureOk: true });
    // ... and on the SHA-256 of the certificate, computed here without a certificate parser.
    expect(pemCertificateSha256(readFileSync(built.path(PackageFile.CERTIFICATE), 'utf8'))).toBe(built.signer.certificate.sha256);
  });

  it('every failure code belongs to one of the 14 checks and to one of the four classes', () => {
    for (const rule of Object.values(VERIFY_FAILURES)) {
      expect(ALL).toContain(rule.check);
      expect(['TAMPERED', 'CORRUPT', 'MISSING', 'UNREADABLE']).toContain(rule.failureClass);
    }
    expect(new Set(Object.values(VERIFY_FAILURES).map((rule) => rule.check)).size).toBe(15);
  });

  it('a transcript disabled by configuration is a declared absence: every check passes and nothing of a transcript is expected', async () => {
    const built = await buildPackage({ transcript: 'DISABLED' });
    const result = await verifyAnchored(built);
    expect(failing(result)).toEqual([]);
    expect(result).toMatchObject({ ok: true, transcript: { state: 'DISABLED', revisions: null } });
    // ... and a transcript file in such a package is a file nobody sealed.
    mkdirSync(built.path('transcript'), { recursive: true });
    writeFileSync(built.path(PackageFile.TRANSCRIPT_JSON), '{}');
    const planted = await verifyAnchored(built);
    expectFailed(planted, ['V-14']);
    expect(check(planted, 'V-14').findings).toEqual([{ code: 'UNEXPECTED_FILE', failureClass: 'TAMPERED', file: PackageFile.TRANSCRIPT_JSON }]);
  });
});

describe('V-01 manifest structure', () => {
  it('a manifest that is no JSON: UNREADABLE, and nothing that needs it is called a pass', async () => {
    const built = await buildPackage();
    writeFileSync(built.path(PackageFile.MANIFEST), '{"schema":');
    const result = await verify(built);
    expectFailed(result, ['V-01']);
    expect(check(result, 'V-01')).toMatchObject({ failureClass: 'UNREADABLE', findings: [{ code: 'MANIFEST_UNREADABLE' }] });
    expect(skipped(result)).toEqual(['V-02', 'V-03', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08', 'V-09', 'V-10', 'V-11', 'V-12', 'V-13', 'V-15']);
    expect(result.overall).toBe('UNREADABLE');
  });

  it('a required field removed: MISSING with the name of the field (and the hash no longer matches)', async () => {
    const built = await buildPackage();
    editManifest(built, (manifest) => delete manifest.caseNumber);
    const result = await verify(built);
    expectFailed(result, ['V-01', 'V-03']);
    expect(check(result, 'V-01').findings).toEqual([{ code: 'MANIFEST_FIELD_MISSING', failureClass: 'MISSING', member: 'caseNumber' }]);
  });

  it('a field of the wrong type, a member nobody sealed, a v1 manifest and no manifest at all', async () => {
    const wrongType = await buildPackage();
    editManifest(wrongType, (manifest) => (manifest.timeline.sealedAt = 'yesterday'));
    expect(codes(await verify(wrongType), 'V-01')).toEqual(['MANIFEST_FIELD_INVALID']);

    const extra = await buildPackage();
    editManifest(extra, (manifest) => (manifest.verified = true), { recomputeHash: true });
    expect(failing(await verify(extra))).toContain('V-01');

    const v1 = await buildPackage();
    editManifest(v1, (manifest) => (manifest.schema = 'dems.evidence-manifest/1'));
    expect(codes(await verify(v1), 'V-01')).toEqual(['MANIFEST_VERSION_UNSUPPORTED']);

    const none = await buildPackage();
    rmSync(none.path(PackageFile.MANIFEST));
    const result = await verify(none);
    expectFailed(result, ['V-01', 'V-14']);
    expect(check(result, 'V-01')).toMatchObject({ failureClass: 'MISSING', findings: [{ code: 'MANIFEST_MISSING' }] });
  });
});

describe('V-02 manifest internal consistency', () => {
  it('a fragment count that is not the number of fragment records fails exactly V-02', async () => {
    const built = await buildPackage({ beforeSeal: (input) => void Object.assign(input.tracks[0] ?? {}, { fragmentCount: 4 }) });
    const result = await verify(built);
    expectFailed(result, ['V-02']);
    expect(check(result, 'V-02').findings).toEqual([{ code: 'FRAGMENT_COUNT_MISMATCH', failureClass: 'CORRUPT', trackId: 'VIDEO-01', member: 'tracks.0.fragmentCount' }]);
  });

  it('a chain head that is not the last chain hash fails exactly V-02', async () => {
    const built = await buildPackage({ beforeSeal: (input) => void Object.assign(input.tracks[1] ?? {}, { fragmentChainHead: sha256Hex(Buffer.from('other')) }) });
    const result = await verify(built);
    expectFailed(result, ['V-02']);
    expect(codes(result, 'V-02')).toEqual(['CHAIN_HEAD_MISMATCH']);
  });

  it('a byte range that reaches into the range before it is refused', async () => {
    const built = await buildPackage({ beforeSeal: (input) => void Object.assign(input.files[0]?.fragments[2] ?? {}, { byteOffset: (input.files[0]?.fragments[1]?.byteOffset ?? 0) + 10 }) });
    const result = await verify(built);
    expect(codes(result, 'V-02')).toContain('BYTE_RANGE_INVALID');
    expect(result.ok).toBe(false);
  });

  it('SEC35-11: fragments.json altered - one nonce character, or one byte of white space - fails exactly V-02 as TAMPERED', async () => {
    const edited = await buildPackage();
    const files = structuredClone(edited.manifest.files) as ManifestFile[];
    const fragment = files[1]?.fragments[0];
    if (fragment === undefined) throw new Error('no fragment');
    fragment.gcmIv = `${fragment.gcmIv.startsWith('0') ? '1' : '0'}${fragment.gcmIv.slice(1)}`;
    writeFileSync(edited.path(PackageFile.FRAGMENTS_JSON), serializeFragmentsJson(files));
    const result = await verify(edited);
    expectFailed(result, ['V-02']);
    expect(check(result, 'V-02').findings).toEqual([{ code: 'FRAGMENTS_JSON_MISMATCH', failureClass: 'TAMPERED', file: PackageFile.FRAGMENTS_JSON }]);

    const spaced = await buildPackage();
    appendFileSync(spaced.path(PackageFile.FRAGMENTS_JSON), '\n');
    expectFailed(await verify(spaced), ['V-02']);
  });

  it('fragments.json removed: V-02 and the completeness check', async () => {
    const built = await buildPackage();
    rmSync(built.path(PackageFile.FRAGMENTS_JSON));
    const result = await verify(built);
    expectFailed(result, ['V-02', 'V-14']);
    expect(check(result, 'V-02').failureClass).toBe('MISSING');
  });

  it('SEC35-10: a fragment sealed for another position does not open at its own - exactly V-02, and the plaintext is not called verified', async () => {
    const built = await buildPackage({ sealAs: (trackId, seq, byteOffset) => (trackId === 'VIDEO-01' && seq === 2 ? { trackId, seq: 3, byteOffset } : null) });
    const result = await verify(built);
    expectFailed(result, ['V-02']);
    expect(check(result, 'V-02').findings).toEqual([{ code: 'GCM_RECORD_MISMATCH', failureClass: 'CORRUPT', trackId: 'VIDEO-01', seq: 2 }]);
    expect(check(result, 'V-05')).toMatchObject({ status: 'SKIPPED', skipped: 'BLOCKED' });
    expect(result.files[0]?.plainOk).toBeNull();
    expect(result.plaintextChecked).toBe(false);

    // The other track ID and another offset are bound in the same way.
    for (const sealAs of [
      (trackId: string, seq: number, byteOffset: number) => (trackId === 'VIDEO-02' && seq === 1 ? { trackId: 'VIDEO-01', seq, byteOffset } : null),
      (trackId: string, seq: number, byteOffset: number) => (trackId === 'VIDEO-02' && seq === 4 ? { trackId, seq, byteOffset: byteOffset + 1 } : null),
    ]) {
      expect(codes(await verify(await buildPackage({ sealAs })), 'V-02')).toEqual(['GCM_RECORD_MISMATCH']);
    }
  });

  it('a session key that is not the key the package was sealed with opens nothing', async () => {
    const built = await buildPackage();
    const result = await verify(built, {}, testOpener(new Map([[built.keyId, Buffer.alloc(32, 7)]])));
    expectFailed(result, ['V-02']);
    expect(codes(result, 'V-02')).toEqual(['GCM_RECORD_MISMATCH', 'GCM_RECORD_MISMATCH']);
  });
});

describe('V-03 manifest hash', () => {
  it('one text of the manifest changed fails exactly V-03 as TAMPERED: the signature over the recorded digest still verifies', async () => {
    const built = await buildPackage();
    editManifest(built, (manifest) => (manifest.notice = `${manifest.notice as string} `));
    const result = await verify(built);
    expectFailed(result, ['V-03']);
    expect(check(result, 'V-03').findings).toEqual([{ code: 'MANIFEST_HASH_MISMATCH', failureClass: 'TAMPERED', member: 'manifestSha256' }]);
    expect(result.overall).toBe('TAMPERED');
    expect(check(result, 'V-09').status).toBe('PASS');
  });

  it('the source class of a camera edited after sealing, the interrupted flag flipped, a recorded hash replaced: V-03 each time', async () => {
    for (const change of [
      (manifest: Record<string, any>) => (manifest.tracks[0].deviceId = 'CAM-09'),
      (manifest: Record<string, any>) => (manifest.timeline.recordingDurationMs += 1),
      (manifest: Record<string, any>) => (manifest.transcript.failedChunks = 3),
    ]) {
      const built = await buildPackage();
      editManifest(built, change);
      expectFailed(await verify(built), ['V-03']);
    }
  });

  it('the same value in another byte form is not the sealed file', async () => {
    const built = await buildPackage();
    writeFileSync(built.path(PackageFile.MANIFEST), JSON.stringify(readJson(built.path(PackageFile.MANIFEST)), null, 2));
    const result = await verify(built);
    expectFailed(result, ['V-03']);
    expect(codes(result, 'V-03')).toEqual(['MANIFEST_NOT_CANONICAL']);
  });

  it('signature.sig naming another digest fails exactly V-03', async () => {
    const built = await buildPackage();
    const detached = readJson(built.path(PackageFile.SIGNATURE));
    detached.signedDigest = sha256Hex(Buffer.from('another manifest'));
    writeFileSync(built.path(PackageFile.SIGNATURE), JSON.stringify(detached));
    const result = await verify(built);
    expectFailed(result, ['V-03']);
    expect(codes(result, 'V-03')).toEqual(['SIGNED_DIGEST_MISMATCH']);
  });

  it('a whole package swapped for another validly sealed one verifies against itself and fails against the item (the anchor)', async () => {
    const signer = throwAwaySigner();
    const sealed = await buildPackage({ signer });
    const other = await buildPackage({ signer });
    expect((await verify(other)).ok).toBe(true);
    const result = await verifyAnchored(other, sealed.item);
    expectFailed(result, ['V-03']);
    expect(check(result, 'V-03').findings).toEqual([{ code: 'MANIFEST_NOT_OF_ITEM', failureClass: 'TAMPERED', member: 'manifestSha256' }]);
    // The item's own identity is an anchor too.
    const foreign = await verify(sealed, { expected: { evidenceId: 'EV-20261009-0002', sessionId: 'SES-20261009-0002' } });
    expect(check(foreign, 'V-03').findings.map((finding) => finding.member)).toEqual(['evidenceId', 'sessionId']);
  });
});

describe('V-04, V-06, V-08: one tampered fragment fails exactly that fragment (M7-TP-1)', () => {
  it('for EVERY fragment of both files: one byte altered -> that fragment and no other, the chain from it on, TAMPERED', async () => {
    for (const trackId of ['VIDEO-01', 'VIDEO-02'] as const) {
      for (const seq of [1, 2, 3, 4, 5]) {
        const built = await buildPackage();
        const record = built.fragment(trackId, seq);
        flipByte(built.path(cameraFilePath(trackId)), record.byteOffset + (seq * 97) % record.byteLength);
        const result = await verifyAnchored(built);

        expectFailed(result, ['V-04', 'V-06', 'V-08']);
        expect(named(result)).toEqual([`${trackId}#${seq}`]);
        expect(result.fragments[0]).toEqual({ trackId, seq, ok: false, reason: 'TAMPERED', storedOk: false, plainOk: null });
        expect(result.overall).toBe('TAMPERED');
        expect(check(result, 'V-04').findings).toEqual([
          { code: 'FRAGMENT_HASH_MISMATCH', failureClass: 'TAMPERED', trackId, seq },
          { code: 'FILE_HASH_MISMATCH', failureClass: 'TAMPERED', trackId, file: cameraFilePath(trackId) },
        ]);
        expect(check(result, 'V-06').findings).toEqual([{ code: 'CHAIN_BROKEN', failureClass: 'TAMPERED', trackId, seq }]);
        expect(check(result, 'V-08').findings).toEqual([{ code: 'FRAGMENT_TAMPERED', failureClass: 'TAMPERED', trackId, seq }]);
        // The manifest, the signature, the certificate, the transcript: untouched, and they say so.
        for (const id of ['V-01', 'V-02', 'V-03', 'V-07', 'V-09', 'V-10', 'V-11', 'V-12', 'V-13', 'V-14'] as const) expect(check(result, id).status).toBe('PASS');
        // The plaintext of the altered file is not called verified, and not called failed.
        expect(check(result, 'V-05')).toMatchObject({ status: 'SKIPPED', skipped: 'BLOCKED' });
        const [touched, other] = trackId === 'VIDEO-01' ? [result.files[0], result.files[1]] : [result.files[1], result.files[0]];
        expect(touched).toMatchObject({ storedOk: false, chainOk: false, chainBrokenFromSeq: seq, plainOk: null });
        expect(other).toMatchObject({ storedOk: true, chainOk: true, chainBrokenFromSeq: null, plainOk: true, fragments: [] });
      }
    }
  });

  it('the stored-bytes checks need no key: the same tamper is found by a verifier that holds none (OD-03)', async () => {
    const built = await buildPackage();
    const clean = await verify(built, { plaintext: 'WHEN_KEY_AVAILABLE' }, null);
    expect(clean).toMatchObject({ ok: true, plaintextChecked: false });
    expect(check(clean, 'V-05')).toMatchObject({ status: 'SKIPPED', skipped: 'KEY_UNAVAILABLE' });
    expect(clean.files.map((file) => file.plainOk)).toEqual([null, null]);

    flipByte(built.path(cameraFilePath('VIDEO-01')), built.fragment('VIDEO-01', 4).byteOffset);
    const result = await verify(built, { plaintext: 'WHEN_KEY_AVAILABLE' }, null);
    expectFailed(result, ['V-04', 'V-06', 'V-08']);
    expect(named(result)).toEqual(['VIDEO-01#4']);
  });

  it('a truncated tail: the last fragment is short, the file is short, nothing before it is touched', async () => {
    const built = await buildPackage();
    const file = built.path(cameraFilePath('VIDEO-02'));
    truncateSync(file, readFileSync(file).byteLength - 17 - 300);
    const result = await verify(built);
    expectFailed(result, ['V-04', 'V-06', 'V-08']);
    expect(named(result)).toEqual(['VIDEO-02#5']);
    expect(codes(result, 'V-04')).toEqual(['FILE_SIZE_MISMATCH', 'FRAGMENT_BYTES_TRUNCATED', 'FILE_HASH_MISMATCH']);
    expect(result.files[1]?.chainBrokenFromSeq).toBe(5);
  });

  it('a file cut in the middle of fragment 2: fragments 2 to 5, each named', async () => {
    const built = await buildPackage();
    truncateSync(built.path(cameraFilePath('VIDEO-01')), built.fragment('VIDEO-01', 2).byteOffset + 5);
    const result = await verify(built);
    expectFailed(result, ['V-04', 'V-06', 'V-08']);
    expect(named(result)).toEqual(['VIDEO-01#2', 'VIDEO-01#3', 'VIDEO-01#4', 'VIDEO-01#5']);
  });

  it('two fragments of one file exchanged (reordered): exactly those two, the chain from the first', async () => {
    const built = await buildPackage();
    const file = built.path(cameraFilePath('VIDEO-01'));
    const bytes = readFileSync(file);
    const [two, four] = [built.fragment('VIDEO-01', 2), built.fragment('VIDEO-01', 4)];
    const copy = Buffer.from(bytes);
    bytes.copy(copy, two.byteOffset, four.byteOffset, four.byteOffset + four.byteLength);
    bytes.copy(copy, four.byteOffset, two.byteOffset, two.byteOffset + two.byteLength);
    writeFileSync(file, copy);
    const result = await verify(built);
    expectFailed(result, ['V-04', 'V-06', 'V-08']);
    expect(named(result)).toEqual(['VIDEO-01#2', 'VIDEO-01#4']);
    expect(result.files[0]?.chainBrokenFromSeq).toBe(2);
    expect(result.overall).toBe('TAMPERED');
  });

  it('a fragment exchanged between the two cameras: exactly that fragment of each file', async () => {
    const built = await buildPackage();
    const [one, two] = [built.path(cameraFilePath('VIDEO-01')), built.path(cameraFilePath('VIDEO-02'))];
    const [first, second] = [readFileSync(one), readFileSync(two)];
    const record = built.fragment('VIDEO-01', 3);
    const [a, b] = [Buffer.from(first), Buffer.from(second)];
    second.copy(a, record.byteOffset, record.byteOffset, record.byteOffset + record.byteLength);
    first.copy(b, record.byteOffset, record.byteOffset, record.byteOffset + record.byteLength);
    writeFileSync(one, a);
    writeFileSync(two, b);
    const result = await verify(built);
    expectFailed(result, ['V-04', 'V-06', 'V-08']);
    expect(named(result)).toEqual(['VIDEO-01#3', 'VIDEO-02#3']);
  });

  it('the two camera files exchanged whole: every fragment of both', async () => {
    const built = await buildPackage({ fragments: 2 });
    const [one, two] = [built.path(cameraFilePath('VIDEO-01')), built.path(cameraFilePath('VIDEO-02'))];
    renameSync(one, `${one}.x`);
    renameSync(two, one);
    renameSync(`${one}.x`, two);
    expect(named(await verify(built))).toEqual(['VIDEO-01#1', 'VIDEO-01#2', 'VIDEO-02#1', 'VIDEO-02#2']);
  });

  it('a byte outside every fragment (the clear header, the clear tail) is under the whole-file hash: no fragment is named', async () => {
    for (const offset of [3, -1]) {
      const built = await buildPackage();
      const file = built.path(cameraFilePath('VIDEO-01'));
      flipByte(file, offset < 0 ? readFileSync(file).byteLength + offset : offset);
      const result = await verify(built);
      // The clear bytes are part of the decrypted file as well.
      expectFailed(result, ['V-04', 'V-05']);
      expect(named(result)).toEqual([]);
      expect(codes(result, 'V-04')).toEqual(['FILE_HASH_MISMATCH']);
      expect(check(result, 'V-08').status).toBe('PASS');
    }
  });

  it('bytes appended to a camera file are found', async () => {
    const built = await buildPackage();
    appendFileSync(built.path(cameraFilePath('VIDEO-02')), Buffer.alloc(64, 1));
    const result = await verify(built);
    expectFailed(result, ['V-04', 'V-05']);
    expect(codes(result, 'V-04')).toEqual(['FILE_SIZE_MISMATCH', 'FILE_HASH_MISMATCH']);
  });

  it('a camera file that is gone: MISSING, and no fragment is called tampered', async () => {
    const built = await buildPackage();
    rmSync(built.path(cameraFilePath('VIDEO-02')));
    const result = await verify(built);
    expectFailed(result, ['V-04', 'V-14']);
    expect(check(result, 'V-04').findings).toEqual([{ code: 'CAMERA_FILE_MISSING', failureClass: 'MISSING', trackId: 'VIDEO-02', file: cameraFilePath('VIDEO-02') }]);
    expect(check(result, 'V-05').status).toBe('SKIPPED');
    expect(result.overall).toBe('MISSING');
  });
});

describe('V-05 plaintext hash after decryption', () => {
  it('at the Core the plaintext check is required: without a session key it FAILS (never a silent pass)', async () => {
    const built = await buildPackage();
    for (const opener of [null, testOpener(new Map())]) {
      const result = await verify(built, { plaintext: 'REQUIRED' }, opener);
      expectFailed(result, ['V-05']);
      expect(check(result, 'V-05').findings.map((finding) => [finding.code, finding.failureClass, finding.trackId])).toEqual([
        ['SESSION_KEY_UNAVAILABLE', 'MISSING', 'VIDEO-01'],
        ['SESSION_KEY_UNAVAILABLE', 'MISSING', 'VIDEO-02'],
      ]);
      expect(result.files.map((file) => [file.storedOk, file.chainOk, file.plainOk])).toEqual([[true, true, null], [true, true, null]]);
    }
  });

  it('a sealed plaintext hash of a file that is not the hash of its decrypted bytes fails exactly V-05', async () => {
    const built = await buildPackage({ beforeSeal: (input) => void Object.assign(input.tracks[1] ?? {}, { sha256Plain: sha256Hex(Buffer.from('not this file')) }) });
    const result = await verify(built);
    expectFailed(result, ['V-05']);
    expect(check(result, 'V-05').findings).toEqual([{ code: 'PLAINTEXT_HASH_MISMATCH', failureClass: 'TAMPERED', trackId: 'VIDEO-02', file: cameraFilePath('VIDEO-02') }]);
    expect(result.files.map((file) => file.plainOk)).toEqual([true, false]);
  });

  it('a sealed plaintext hash of ONE fragment that is wrong fails exactly V-05 and names that fragment', async () => {
    const built = await buildPackage({ beforeSeal: (input) => void Object.assign(input.files[0]?.fragments[3] ?? {}, { sha256Plain: sha256Hex(Buffer.from('not this fragment')) }) });
    const result = await verify(built);
    expectFailed(result, ['V-05']);
    expect(result.fragments).toEqual([{ trackId: 'VIDEO-01', seq: 4, ok: false, reason: 'TAMPERED', storedOk: true, plainOk: false }]);
    expect(result.files[0]?.plainOk).toBe(false);
  });

  it('a file sealed without a plaintext hash cannot pass the plaintext check', async () => {
    const built = await buildPackage({ beforeSeal: (input) => void Object.assign(input.tracks[0] ?? {}, { sha256Plain: null }) });
    const result = await verify(built);
    expectFailed(result, ['V-05']);
    expect(codes(result, 'V-05')).toEqual(['PLAINTEXT_HASH_NOT_RECORDED']);
  });
});

describe('V-06 chain continuity and V-07 sequence contiguity, on a package that was sealed wrong', () => {
  it('one recorded chain hash that is not the rule\'s value fails exactly V-06 as CORRUPT: no byte was altered, so nothing is called tampered', async () => {
    const built = await buildPackage({ beforeSeal: (input) => void Object.assign(input.files[1]?.fragments[2] ?? {}, { chainHash: sha256Hex(Buffer.from('not the chain')) }) });
    const result = await verify(built);
    expectFailed(result, ['V-06']);
    expect(check(result, 'V-06').findings).toEqual([{ code: 'CHAIN_RECORD_INCONSISTENT', failureClass: 'CORRUPT', trackId: 'VIDEO-02', seq: 3 }]);
    expect(check(result, 'V-08').status).toBe('PASS');
    expect(result.files[1]).toMatchObject({ storedOk: true, chainOk: false });
    expect(result.overall).toBe('CORRUPT');
  });

  it('a sequence with a gap fails exactly V-07 and names the gap', async () => {
    const shift = (seq: number): number => (seq >= 3 ? seq + 1 : seq);
    const built = await buildPackage({
      sealAs: (trackId, seq, byteOffset) => ({ trackId, seq: shift(seq), byteOffset }),
      beforeSeal: (input) => {
        for (const fragment of input.files[0]?.fragments ?? []) fragment.seq = shift(fragment.seq);
        for (const fragment of input.files[1]?.fragments ?? []) fragment.seq = shift(fragment.seq);
      },
    });
    const result = await verify(built);
    expectFailed(result, ['V-07']);
    expect(check(result, 'V-07').findings).toEqual([
      { code: 'SEQUENCE_NOT_CONTIGUOUS', failureClass: 'CORRUPT', trackId: 'VIDEO-01', seq: 4 },
      { code: 'SEQUENCE_NOT_CONTIGUOUS', failureClass: 'CORRUPT', trackId: 'VIDEO-02', seq: 4 },
    ]);
    expect(result.files.map((file) => file.sequenceOk)).toEqual([false, false]);
    // The stored bytes are still hashed, fragment by fragment.
    expect(result.files.map((file) => file.storedOk)).toEqual([true, true]);
  });

  it('a duplicate sequence number and offsets that do not increase fail V-07', async () => {
    const duplicate = await buildPackage({ beforeSeal: (input) => void Object.assign(input.files[0]?.fragments[1] ?? {}, { seq: 1 }) });
    expect(codes(await verify(duplicate), 'V-07')).toEqual(['SEQUENCE_NOT_CONTIGUOUS']);
    const backwards = await buildPackage({
      beforeSeal: (input) => {
        const fragments = input.files[1]?.fragments ?? [];
        const [second, third] = [fragments[1], fragments[2]];
        if (second === undefined || third === undefined) throw new Error('no fragments');
        [second.byteOffset, third.byteOffset] = [third.byteOffset, second.byteOffset];
      },
    });
    expect(codes(await verify(backwards), 'V-07')).toEqual(['OFFSET_NOT_INCREASING']);
  });
});

describe('V-09 signature', () => {
  it('the signature value altered fails exactly V-09 (it is outside the digest, so the hash still matches)', async () => {
    const built = await buildPackage();
    editManifest(built, (manifest) => (manifest.signature.value = `${(manifest.signature.value as string).startsWith('0') ? '1' : '0'}${(manifest.signature.value as string).slice(1)}`));
    const result = await verify(built);
    expectFailed(result, ['V-09']);
    expect(codes(result, 'V-09')).toEqual(['SIGNATURE_FILE_MISMATCH', 'SIGNATURE_INVALID']);
    expect(check(result, 'V-03').status).toBe('PASS');
  });

  it('a field edited, the manifest hash recomputed, signature.sig rewritten to match - no key: fails exactly V-09', async () => {
    const built = await buildPackage();
    editManifest(built, (manifest) => (manifest.tracks[0].sourceClass = manifest.tracks[0].sourceClass), { recomputeHash: true });
    expect((await verify(built)).ok).toBe(true); // the positive control of the tool: an edit that changes nothing

    editManifest(built, (manifest) => (manifest.caseNumber = 'LP/2026/1009-0002'), { recomputeHash: true });
    const result = await verify(built);
    expectFailed(result, ['V-09']);
    expect(check(result, 'V-09').findings).toEqual([{ code: 'SIGNATURE_INVALID', failureClass: 'TAMPERED', member: 'signature.value' }]);
    expect(check(result, 'V-03').status).toBe('PASS');
    // The Core holds the digest it signed: there the same edit fails the hash check as well.
    expectFailed(await verifyAnchored(built), ['V-03', 'V-09']);
  });

  it('fragments.json AND the manifest edited consistently, the hash recomputed, no valid signature: V-02 is satisfied, V-09 is not', async () => {
    const built = await buildPackage();
    editManifest(built, (manifest) => (manifest.files[0].fragments[1].durableAt += 1), { recomputeHash: true, rewriteFragmentsJson: true });
    const result = await verify(built);
    expectFailed(result, ['V-09']);
    expect(check(result, 'V-02').status).toBe('PASS');

    // The same with a nonce: with the session key the range no longer opens either.
    const nonce = await buildPackage();
    editManifest(nonce, (manifest) => (manifest.files[0].fragments[1].gcmIv = 'ab'.repeat(12)), { recomputeHash: true, rewriteFragmentsJson: true });
    expectFailed(await verify(nonce, { plaintext: 'WHEN_KEY_AVAILABLE' }, null), ['V-09']);
    expectFailed(await verify(nonce), ['V-02', 'V-09']);
  });

  it('a manifest re-signed with another key, the certificate left in place, fails exactly V-09', async () => {
    const built = await buildPackage();
    editManifest(built, (manifest) => (manifest.subject.name = 'Somebody Else'), { resignWith: throwAwaySigner() });
    const result = await verify(built);
    expectFailed(result, ['V-09']);
    expect(codes(result, 'V-09')).toEqual(['SIGNATURE_INVALID']);
  });

  it('a manifest re-signed with another key AND its certificate put in place is self-consistent: only the anchors of the Core catch it (SEC35-06)', async () => {
    const built = await buildPackage();
    const attacker = throwAwaySigner();
    editManifest(built, (manifest) => (manifest.subject.name = 'Somebody Else'), { resignWith: attacker, replaceCertificate: true });
    // What a verifier without any anchor sees. This is the stated limit, pinned so it is not forgotten.
    expect((await verify(built)).ok).toBe(true);
    // The trusted certificates alone: exactly V-13.
    const trusted = await verify(built, { expected: { trustedCertificateSha256: [built.signer.certificate.sha256] } });
    expectFailed(trusted, ['V-13']);
    expect(codes(trusted, 'V-13')).toEqual(['CERTIFICATE_NOT_TRUSTED']);
    // The sealed digest alone: exactly V-03.
    expectFailed(await verify(built, { expected: { manifestSha256: built.item.manifestSha256 } }), ['V-03']);
    // The Core has both.
    expectFailed(await verifyAnchored(built), ['V-03', 'V-13']);
  });

  it('signature.sig removed, unreadable, or naming another key', async () => {
    const removed = await buildPackage();
    rmSync(removed.path(PackageFile.SIGNATURE));
    const result = await verify(removed);
    expectFailed(result, ['V-09', 'V-14']);
    expect(check(result, 'V-09').failureClass).toBe('MISSING');

    const broken = await buildPackage();
    writeFileSync(broken.path(PackageFile.SIGNATURE), 'not json');
    expect(codes(await verify(broken), 'V-09')).toEqual(['SIGNATURE_FILE_UNREADABLE']);

    const renamed = await buildPackage();
    const detached = readJson(renamed.path(PackageFile.SIGNATURE));
    detached.keyId = 'CORE-KEY-EVSIGN-02';
    writeFileSync(renamed.path(PackageFile.SIGNATURE), JSON.stringify(detached));
    const other = await verify(renamed);
    expectFailed(other, ['V-09']);
    expect(check(other, 'V-09').findings).toEqual([{ code: 'SIGNATURE_FILE_MISMATCH', failureClass: 'TAMPERED', file: PackageFile.SIGNATURE, member: 'keyId' }]);
  });
});

describe('V-10 transcript hash', () => {
  it('one byte of transcript.json, of the .srt or of the .vtt fails exactly V-10 and names the file', async () => {
    for (const file of [PackageFile.TRANSCRIPT_JSON, PackageFile.TRANSCRIPT_SRT, PackageFile.TRANSCRIPT_VTT]) {
      const built = await buildPackage();
      flipByte(built.path(file), 4);
      const result = await verify(built);
      expectFailed(result, ['V-10']);
      expect(check(result, 'V-10').findings).toEqual([{ code: 'TRANSCRIPT_HASH_MISMATCH', failureClass: 'TAMPERED', file }]);
      expect(result.transcript.state).toBe('FAILED');
    }
  });

  it('a transcript file removed: V-10 and the completeness check', async () => {
    const built = await buildPackage();
    rmSync(built.path(PackageFile.TRANSCRIPT_VTT));
    const result = await verify(built);
    expectFailed(result, ['V-10', 'V-14']);
    expect(check(result, 'V-10').failureClass).toBe('MISSING');
  });

  it('the hash the database holds is an anchor: a package whose transcript is not the item\'s fails exactly V-10', async () => {
    const built = await buildPackage();
    const result = await verify(built, { expected: { transcriptSha256: sha256Hex(Buffer.from('the transcript of the item')) } });
    expectFailed(result, ['V-10']);
    expect(codes(result, 'V-10')).toEqual(['TRANSCRIPT_NOT_OF_ITEM']);
    // A disabled package for an item that has a transcript, too.
    const disabled = await buildPackage({ transcript: 'DISABLED' });
    expectFailed(await verify(disabled, { expected: { transcriptSha256: sha256Hex(Buffer.from('x')) } }), ['V-10']);
  });
});

describe('V-11 revision signatures and the per-revision certificate (SEC35-20)', () => {
  const rewrite = (built: BuiltPackage, change: (file: Record<string, any>) => void): void => {
    const file = readJson(built.path(PackageFile.TRANSCRIPT_REVISIONS)) as Record<string, any>;
    change(file);
    writeFileSync(built.path(PackageFile.TRANSCRIPT_REVISIONS), JSON.stringify(file));
  };

  it('a revised text, a replaced hash, a broken parent link, a missing revision: exactly V-11, with the revision number', async () => {
    const text = await buildPackage({ revisions: 3 });
    rewrite(text, (file) => (file.revisions[1].body.changes[0].to = 'another text'));
    const edited = await verify(text);
    expectFailed(edited, ['V-11']);
    expect(check(edited, 'V-11').findings).toEqual([{ code: 'REVISION_BODY_HASH_MISMATCH', failureClass: 'TAMPERED', revisionNo: 2 }]);

    const hash = await buildPackage({ revisions: 3 });
    rewrite(hash, (file) => (file.revisions[1].sha256 = sha256Hex(Buffer.from('another body'))));
    expect(check(await verify(hash), 'V-11').findings.map((finding) => [finding.code, finding.revisionNo])).toEqual([
      ['REVISION_BODY_HASH_MISMATCH', 2],
      ['REVISION_SIGNATURE_INVALID', 2],
      ['REVISION_PARENT_MISMATCH', 3],
    ]);

    const parent = await buildPackage({ revisions: 2 });
    rewrite(parent, (file) => (file.revisions[0].parentSha256 = sha256Hex(Buffer.from('another transcript'))));
    expect(codes(await verify(parent), 'V-11')).toEqual(['REVISION_PARENT_MISMATCH']);

    const reordered = await buildPackage({ revisions: 3 });
    rewrite(reordered, (file) => file.revisions.reverse());
    expect(codes(await verify(reordered), 'V-11')).toEqual(['REVISION_SEQUENCE_BROKEN']);

    // The last revision dropped: the list is still a valid chain. Only the count the database holds shows it.
    const dropped = await buildPackage({ revisions: 3 });
    rewrite(dropped, (file) => file.revisions.pop());
    expect((await verify(dropped)).ok).toBe(true);
    const anchored = await verifyAnchored(dropped);
    expectFailed(anchored, ['V-11']);
    expect(codes(anchored, 'V-11')).toEqual(['REVISION_COUNT_MISMATCH']);
  });

  it('a signature that is another revision\'s, and a list bound to another transcript or item', async () => {
    const built = await buildPackage({ revisions: 2 });
    rewrite(built, (file) => (file.revisions[1].signature.value = file.revisions[0].signature.value));
    const result = await verify(built);
    expectFailed(result, ['V-11']);
    expect(check(result, 'V-11').findings).toEqual([{ code: 'REVISION_SIGNATURE_INVALID', failureClass: 'TAMPERED', revisionNo: 2 }]);

    const foreign = await buildPackage({ revisions: 1 });
    rewrite(foreign, (file) => (file.evidenceId = 'EV-20261009-0002'));
    expect(codes(await verify(foreign), 'V-11')).toEqual(['REVISIONS_NOT_OF_ITEM']);

    const gone = await buildPackage({ revisions: 1 });
    rmSync(gone.path(PackageFile.TRANSCRIPT_REVISIONS));
    expectFailed(await verify(gone), ['V-11', 'V-14']);

    const broken = await buildPackage({ revisions: 1 });
    rewrite(broken, (file) => (file.revisions[0].unknown = true));
    expect(codes(await verify(broken), 'V-11')).toEqual(['REVISIONS_FILE_UNREADABLE']);
  });

  it('after a key rotation an old revision still verifies against ITS certificate, and only against it', async () => {
    const first = throwAwaySigner();
    const second = throwAwaySigner('CORE-KEY-EVSIGN-02');
    const built = await buildPackage({ signer: first, revisions: 1 });
    const kept = (readJson(built.path(PackageFile.TRANSCRIPT_REVISIONS)).revisions as any[])[0];
    const rotated = revisionRecord(second, 2, kept.sha256 as string);
    writeRevisions(built.dir, built.manifest, [kept, rotated]);
    retainCertificate(built, second);
    const trusted = [first.certificate.sha256, second.certificate.sha256];
    const item = { ...built.item, revisionCount: 2 };
    expect(failing(await verifyAnchored(built, item, trusted))).toEqual([]);

    // The retained certificate of the second key removed: revision 2 cannot be verified.
    rmSync(built.path(retainedCertificatePath(second.certificate.sha256)));
    const missing = await verifyAnchored(built, item, trusted);
    expectFailed(missing, ['V-11']);
    expect(check(missing, 'V-11').findings).toEqual([{ code: 'REVISION_CERTIFICATE_MISSING', failureClass: 'MISSING', revisionNo: 2 }]);

    // A file of that name that holds ANOTHER certificate is not that certificate.
    mkdirSync(built.path('certificates'), { recursive: true });
    writeFileSync(built.path(retainedCertificatePath(second.certificate.sha256)), first.certificate.pemText);
    expect(codes(await verifyAnchored(built, item, trusted), 'V-11')).toEqual(['REVISION_CERTIFICATE_MISSING']);

    // Revision 2 claiming the FIRST certificate: signed by the second key, it does not verify under the first.
    writeRevisions(built.dir, built.manifest, [kept, revisionRecord(second, 2, kept.sha256 as string, first.certificate.sha256)]);
    expect(codes(await verifyAnchored(built, item, trusted), 'V-11')).toEqual(['REVISION_SIGNATURE_INVALID']);

    // A revision without a recorded certificate cannot be verified at all.
    writeRevisions(built.dir, built.manifest, [kept, revisionRecord(second, 2, kept.sha256 as string, null)]);
    expect(codes(await verifyAnchored(built, item, trusted), 'V-11')).toEqual(['REVISION_CERTIFICATE_MISSING']);

    // A revision signed by a key the Core never had, its certificate retained in the package.
    const stranger = throwAwaySigner('CORE-KEY-EVSIGN-03');
    writeRevisions(built.dir, built.manifest, [kept, revisionRecord(stranger, 2, kept.sha256 as string)]);
    retainCertificate(built, stranger);
    const forged = await verifyAnchored(built, item, trusted);
    expectFailed(forged, ['V-11']);
    expect(codes(forged, 'V-11')).toEqual(['REVISION_CERTIFICATE_NOT_TRUSTED']);
  });
});

describe('V-12 the interrupted-seal flag', () => {
  const interrupted: BuildOptions = { beforeSeal: (input) => void Object.assign(input.timeline, { interrupted: true, stoppedAt: null }) };

  it('an interrupted package verifies and is marked: a state beside ok, not a failure', async () => {
    const result = await verifyAnchored(await buildPackage(interrupted));
    expect(result).toMatchObject({ ok: true, interrupted: true });
    expect(check(result, 'V-12').status).toBe('PASS');
  });

  it('an interrupted package whose durable prefix does not verify fails V-12 with the rest', async () => {
    const built = await buildPackage(interrupted);
    flipByte(built.path(cameraFilePath('VIDEO-01')), built.fragment('VIDEO-01', 2).byteOffset);
    const result = await verifyAnchored(built);
    expectFailed(result, ['V-04', 'V-06', 'V-08', 'V-12']);
    expect(check(result, 'V-12').findings).toEqual([{ code: 'INTERRUPTED_PREFIX_NOT_VERIFIED', failureClass: 'TAMPERED', trackId: 'VIDEO-01' }]);
    expect(result.interrupted).toBe(true);
  });

  it('the flag itself cannot be removed after sealing: the hash check answers', async () => {
    const built = await buildPackage(interrupted);
    editManifest(built, (manifest) => {
      manifest.timeline.interrupted = false;
      manifest.timeline.stoppedAt = manifest.timeline.durableEndMs;
    });
    expectFailed(await verify(built), ['V-03']);
  });
});

describe('V-13 certificate', () => {
  it('a signature made outside the validity of the certificate fails exactly V-13', async () => {
    const built = await buildPackage({ signedAt: NOW - 10_000 });
    const result = await verify(built);
    expectFailed(result, ['V-13']);
    expect(codes(result, 'V-13')).toEqual(['CERTIFICATE_NOT_VALID_AT_SIGNING']);
  });

  it('another certificate in its place: the hash is not the sealed one and the signature does not verify under it', async () => {
    const built = await buildPackage();
    writeFileSync(built.path(PackageFile.CERTIFICATE), throwAwaySigner().certificate.pemText);
    const result = await verify(built);
    expectFailed(result, ['V-09', 'V-13']);
    expect(codes(result, 'V-13')).toEqual(['CERTIFICATE_HASH_MISMATCH', 'CERTIFICATE_HASH_MISMATCH']);
    expect(check(result, 'V-13').failureClass).toBe('TAMPERED');
  });

  it('a certificate with one altered byte, no certificate, and one the verifier does not trust', async () => {
    const altered = await buildPackage();
    const pem = readFileSync(altered.path(PackageFile.CERTIFICATE), 'utf8');
    const at = pem.indexOf('\n') + 40;
    writeFileSync(altered.path(PackageFile.CERTIFICATE), `${pem.slice(0, at)}${pem.charAt(at) === 'A' ? 'B' : 'A'}${pem.slice(at + 1)}`);
    const result = await verify(altered);
    expectFailed(result, ['V-09', 'V-13']);
    expect(codes(result, 'V-13')).toContain('CERTIFICATE_HASH_MISMATCH');

    const none = await buildPackage();
    rmSync(none.path(PackageFile.CERTIFICATE));
    const missing = await verify(none);
    expectFailed(missing, ['V-09', 'V-13', 'V-14']);
    expect(check(missing, 'V-13').failureClass).toBe('MISSING');
    expect(codes(missing, 'V-09')).toEqual(['SIGNATURE_KEY_UNAVAILABLE']);

    const untrusted = await buildPackage();
    expectFailed(await verify(untrusted, { expected: { trustedCertificateSha256: [sha256Hex(Buffer.from('the only certificate I know'))] } }), ['V-13']);
  });
});

describe('V-14 file completeness', () => {
  it('each declared file removed is named as MISSING', async () => {
    const built = await buildPackage();
    rmSync(built.path(PackageFile.AUDIT_EXTRACT));
    const result = await verify(built);
    expectFailed(result, ['V-14']);
    expect(check(result, 'V-14').findings).toEqual([{ code: 'DECLARED_FILE_MISSING', failureClass: 'MISSING', file: PackageFile.AUDIT_EXTRACT }]);
  });

  it('a file nobody sealed fails exactly V-14; an export and a retained certificate beside the sealed set do not', async () => {
    const built = await buildPackage();
    mkdirSync(built.path('export'), { recursive: true });
    writeFileSync(built.path('export/EXP-000040.zip'), 'derived');
    retainCertificate(built, built.signer);
    expect((await verify(built)).ok).toBe(true);

    writeFileSync(built.path('fragments/VIDEO-03.mp4'), 'a third camera');
    writeFileSync(built.path('notes.txt'), 'x');
    const result = await verify(built);
    expectFailed(result, ['V-14']);
    expect(check(result, 'V-14').findings).toEqual([
      { code: 'UNEXPECTED_FILE', failureClass: 'TAMPERED', file: 'fragments/VIDEO-03.mp4' },
      { code: 'UNEXPECTED_FILE', failureClass: 'TAMPERED', file: 'notes.txt' },
    ]);
  });

  it('a link is never followed: a camera file replaced by a link to the very same bytes is unreadable', async () => {
    const built = await buildPackage();
    const file = built.path(cameraFilePath('VIDEO-01'));
    const elsewhere = join(built.dir, '..', 'VIDEO-01.elsewhere.mp4');
    renameSync(file, elsewhere);
    symlinkSync(elsewhere, file);
    const result = await verify(built);
    expectFailed(result, ['V-04', 'V-14']);
    expect(codes(result, 'V-04')).toEqual(['CAMERA_FILE_UNREADABLE']);
    expect(codes(result, 'V-14')).toEqual(['DECLARED_FILE_UNREADABLE']);
  });
});

describe('streaming: a recording is never held whole', () => {
  it('a camera file passes through the hashes in chunks of the reader; with a key, one sealed range at a time', async () => {
    const built = await buildPackage({ fragments: 4, fragmentBytes: 200_000, headerBytes: 5_000 });
    const ports = corePorts(built.dir, built.opener, 4_096);
    let largest = 0;
    let chunks = 0;
    const counting: PackageReader = {
      ...ports.reader,
      readRange: (path, offset, length, onChunk) =>
        ports.reader.readRange(path, offset, length, (chunk) => {
          largest = Math.max(largest, chunk.byteLength);
          chunks += 1;
          onChunk(chunk);
        }),
    };
    const stored: number[] = [];
    const opener = { hasKey: built.opener.hasKey, open: (record: Parameters<typeof built.opener.open>[0], bytes: Uint8Array) => (stored.push(bytes.byteLength), built.opener.open(record, bytes)) };
    const result = await verifyPackageV2({ ...ports, reader: counting, opener });
    expect(result.ok).toBe(true);
    expect(largest).toBe(4_096);
    expect(chunks).toBeGreaterThan((2 * 4 * 200_000) / 4_096);
    // What is held for opening is one sealed range, never more.
    expect(new Set(stored)).toEqual(new Set([200_000]));
  });

  it('a sealed range above the limit is not opened: V-05 fails, and its stored bytes are still hashed in chunks', async () => {
    const built = await buildPackage({ fragments: 2, fragmentBytes: 5_000 });
    const result = await verify(built, { maxOpenFragmentBytes: 4_999 });
    expectFailed(result, ['V-05']);
    expect(codes(result, 'V-05')).toEqual(['FRAGMENT_TOO_LARGE', 'FRAGMENT_TOO_LARGE']);
    expect(result.files.map((file) => [file.storedOk, file.chainOk])).toEqual([[true, true], [true, true]]);
    expect(built.opener.opened).toEqual([]);
  });
});

describe('what a result may hold', () => {
  it('names and codes only: no hash, no nonce, no tag, no key, no signature, no host path - also for a tampered package', async () => {
    const built = await buildPackage({ revisions: 1 });
    flipByte(built.path(cameraFilePath('VIDEO-02')), built.fragment('VIDEO-02', 3).byteOffset);
    flipByte(built.path(PackageFile.TRANSCRIPT_JSON), 2);
    editManifest(built, (manifest) => (manifest.notice = 'edited'));
    const text = JSON.stringify(await verifyAnchored(built));
    expect(text).not.toMatch(/[0-9a-f]{24,}/i);
    expect(text).not.toContain(built.key.toString('hex'));
    expect(text).not.toContain(built.key.toString('base64'));
    expect(text).not.toContain(built.dir);
    expect(text).not.toContain('edited');
  });
});
