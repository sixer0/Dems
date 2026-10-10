/**
 * THE RECEIVER'S VERIFICATION of an export (blueprint row 91; evidence package spec §G.2; check
 * M8-EXP-1 "export verifies at the destination").
 *
 * What a receiver holds: the three files of the export - `EXP-<id>.zip`, `export-manifest.json`,
 * `export-manifest.sig` - and the archive unpacked into a folder. What it does NOT hold: the
 * Core's session key and the Core's signing key. It may hold the Core's certificate hash, received
 * out of band (`trustedCertificateSha256`); without it a re-signed export verifies against itself
 * (SEC35-06) and the result says so (`anchored: false`).
 *
 * THE CHECKS (each PASS or FAIL; `ok` is their conjunction):
 *
 *   X-01  the export manifest is a canonical, valid `dems.export-manifest/2`, its composite
 *         marking is consistent, and `export.manifestSha256` is the hash of its canonical body
 *   X-02  the export signature: of this manifest, by the certificate it names, which lies in the
 *         unpacked archive (and is a trusted one when anchors are given)
 *   X-03  the archive file has the recorded length and SHA-256
 *   X-04  the unpacked folder holds exactly the recorded entries, each with its length and SHA-256
 *   X-05  THE SEALED MANIFEST AND ITS FILES, with the ONE verifier of the project
 *         (`verifyPackageV2`) run over the unpacked folder without a key: manifest structure and
 *         hash, the seal's signature and certificate, the transcript and its signed revisions,
 *         file completeness, the source mark (V-01, V-03, V-09, V-10, V-11, V-13, V-14, V-15), and
 *         the manifest is the one the export manifest names
 *   X-06  every DECRYPTED camera file has the sealed length and hashes to the sealed
 *         `tracks[].sha256Plain`, and every fragment range to its `sha256Plain` (spec §G.2
 *         "Plaintext file hash")
 *   X-07  the composite, when included: the recorded hash and the derived mark
 *
 * NOT CHECKABLE on a decrypted copy (spec §G.2): the stored-bytes hashes and the stored-bytes
 * chain (V-02's file hash, V-04, V-06, V-08). They are verified at the Core before the export is
 * written; the verifier's findings for them on this folder are expected and are not read here.
 *
 * `development` repeats the SIGNED mark of the sealed manifest (V-15): an export of a package that
 * was recorded from development sources stays marked at its destination.
 *
 * It writes nothing and never throws for anything an export can contain.
 */
import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { sep } from 'node:path';
import { PackageFile, cameraFilePath, manifestSignedMessage, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
import { pemCertificateSha256, retainedCertificatePath, verifyPackageV2, type VerifyCheckId } from '@dems/shared/evidence-verify';
import { readSigningCertificate, verifyEd25519 } from '../capture';
import { corePorts, createPackageReader } from '../evidence-verify';
import { COMPOSITE_ENTRY, EXPORT_MANIFEST_FILE, EXPORT_SIGNATURE_FILE, compositeMarkingHolds, computeExportManifestSha256, parseExportManifest, parseExportSignature, type ExportManifest } from './export-manifest';

export const RECEIVER_CHECKS = [
  { id: 'X-01', name: 'Export manifest' },
  { id: 'X-02', name: 'Export signature' },
  { id: 'X-03', name: 'Archive hash' },
  { id: 'X-04', name: 'Archive entries' },
  { id: 'X-05', name: 'Sealed manifest, seal and transcript' },
  { id: 'X-06', name: 'Plaintext hashes of the camera files' },
  { id: 'X-07', name: 'Composite marking' },
] as const;
export type ReceiverCheckId = (typeof RECEIVER_CHECKS)[number]['id'];

/** The checks of verify v2 that hold on a decrypted copy and that X-05 requires to PASS. */
export const RECEIVER_VERIFY_V2_CHECKS: readonly VerifyCheckId[] = ['V-01', 'V-03', 'V-09', 'V-10', 'V-11', 'V-13', 'V-14', 'V-15'];

export interface ReceiverCheck {
  readonly id: ReceiverCheckId;
  readonly name: string;
  readonly ok: boolean;
  /** Codes of what did not hold; names of files and checks, never a value. */
  readonly findings: readonly string[];
}

export interface ReceiverVerifyResult {
  readonly ok: boolean;
  readonly checks: readonly ReceiverCheck[];
  readonly exportId: string | null;
  /** The signed development-source mark; null when the sealed manifest could not be relied on. */
  readonly development: boolean | null;
  /** True when a composite is included (and then marked derived). */
  readonly derived: boolean | null;
  /** True when the signing certificates were held against anchors the caller gave. */
  readonly anchored: boolean;
}

export interface ReceiverVerifyInput {
  /** The folder with the three files of the export. */
  readonly exportDir: string;
  /** The archive, unpacked. */
  readonly unpackedDir: string;
  /** SHA-256 of the Core's certificates, received out of band. */
  readonly trustedCertificateSha256?: readonly string[];
  readonly chunkBytes?: number;
}

async function hashRange(file: string, offset: number, length: number | null, chunkBytes: number): Promise<{ sha256: string; bytes: number } | null> {
  try {
    const handle = await open(file, 'r');
    try {
      const hash = createHash('sha256');
      const buffer = Buffer.alloc(chunkBytes);
      let done = 0;
      for (;;) {
        const want = length === null ? chunkBytes : Math.min(chunkBytes, length - done);
        if (want === 0) break;
        const { bytesRead } = await handle.read(buffer, 0, want, offset + done);
        if (bytesRead === 0) break;
        hash.update(buffer.subarray(0, bytesRead));
        done += bytesRead;
      }
      return { sha256: hash.digest('hex'), bytes: done };
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

export async function verifyExportAtDestination(input: ReceiverVerifyInput): Promise<ReceiverVerifyResult> {
  const chunkBytes = input.chunkBytes ?? 1024 * 1024;
  const findings = new Map<ReceiverCheckId, string[]>(RECEIVER_CHECKS.map((check) => [check.id, []]));
  const add = (id: ReceiverCheckId, code: string): void => void findings.get(id)?.push(code);
  const blocked = (...ids: readonly ReceiverCheckId[]): void => ids.forEach((id) => add(id, 'BLOCKED'));
  const inExport = (name: string): string => `${input.exportDir}${sep}${name}`;
  const inUnpacked = (relative: string): string => `${input.unpackedDir}${sep}${relative.split('/').join(sep)}`;
  const anchors = input.trustedCertificateSha256;
  let development: boolean | null = null;

  const result = (manifest: ExportManifest | null): ReceiverVerifyResult => {
    const checks = RECEIVER_CHECKS.map((check) => ({ ...check, ok: (findings.get(check.id) ?? []).length === 0, findings: Object.freeze([...(findings.get(check.id) ?? [])]) }));
    const ok = checks.every((check) => check.ok);
    return Object.freeze({
      ok,
      checks: Object.freeze(checks),
      exportId: manifest?.export.exportId ?? null,
      development: findings.get('X-05')?.length === 0 ? development : null,
      derived: manifest === null ? null : manifest.export.derived,
      anchored: anchors !== undefined,
    });
  };

  // X-01
  let manifest: ExportManifest;
  try {
    manifest = parseExportManifest(await readFile(inExport(EXPORT_MANIFEST_FILE), 'utf8'));
  } catch (error) {
    add('X-01', error instanceof Error && error.message.startsWith('EXPORT_MANIFEST_') ? error.message : 'EXPORT_MANIFEST_UNREADABLE');
    blocked('X-02', 'X-03', 'X-04', 'X-05', 'X-06', 'X-07');
    return result(null);
  }
  if (computeExportManifestSha256(manifest) !== manifest.export.manifestSha256) add('X-01', 'EXPORT_MANIFEST_HASH_MISMATCH');
  if (!compositeMarkingHolds(manifest)) add('X-01', 'EXPORT_COMPOSITE_MARKING');

  // X-02
  try {
    const signature = parseExportSignature(await readFile(inExport(EXPORT_SIGNATURE_FILE), 'utf8'));
    if (signature.signedDigest !== manifest.export.manifestSha256) add('X-02', 'EXPORT_SIGNATURE_NOT_OF_MANIFEST');
    if (anchors !== undefined && !anchors.includes(signature.certificateSha256)) add('X-02', 'EXPORT_CERTIFICATE_NOT_TRUSTED');
    let pemText: string | null = null;
    for (const candidate of [PackageFile.CERTIFICATE, retainedCertificatePath(signature.certificateSha256)]) {
      try {
        const candidateText = await readFile(inUnpacked(candidate), 'utf8');
        if (pemCertificateSha256(candidateText) === signature.certificateSha256) pemText = candidateText;
      } catch {
        // Not there: the next place.
      }
    }
    if (pemText === null) add('X-02', 'EXPORT_CERTIFICATE_MISSING');
    else {
      let verified = false;
      try {
        // Parses and checks the self-signature (the signer unit). The key ID is the one the file names.
        const certificate = readSigningCertificate(pemText, signature.keyId);
        verified =
          signature.algorithm === 'Ed25519' &&
          signature.signedAt >= certificate.notBefore &&
          signature.signedAt <= certificate.notAfter &&
          verifyEd25519(certificate.publicKey, manifestSignedMessage(signature.signedDigest), Uint8Array.from(Buffer.from(signature.signature, 'hex')));
      } catch {
        verified = false;
      }
      if (!verified) add('X-02', 'EXPORT_SIGNATURE_INVALID');
    }
  } catch (error) {
    add('X-02', error instanceof Error && error.message.startsWith('EXPORT_SIGNATURE_') ? error.message : 'EXPORT_SIGNATURE_UNREADABLE');
  }

  // X-03
  const archive = await hashRange(inExport(manifest.package.file), 0, null, chunkBytes);
  if (archive === null) add('X-03', 'ARCHIVE_MISSING');
  else if (archive.bytes !== manifest.package.bytes || archive.sha256 !== manifest.package.sha256) add('X-03', 'ARCHIVE_HASH_MISMATCH');

  // X-04
  const listed = await createPackageReader(input.unpackedDir, { chunkBytes }).list(100_000);
  if (listed === null) add('X-04', 'UNPACKED_FOLDER_UNREADABLE');
  else {
    const recorded = new Map(manifest.package.entries.map((entry) => [entry.path, entry]));
    for (const path of listed) if (!recorded.has(path)) add('X-04', `UNEXPECTED_ENTRY:${path}`);
    for (const entry of manifest.package.entries) {
      const actual = listed.includes(entry.path) ? await hashRange(inUnpacked(entry.path), 0, null, chunkBytes) : null;
      if (actual === null) add('X-04', `ENTRY_MISSING:${entry.path}`);
      else if (actual.bytes !== entry.bytes || actual.sha256 !== entry.sha256) add('X-04', `ENTRY_HASH_MISMATCH:${entry.path}`);
    }
  }

  // X-05: the one verifier, without a key, over the decrypted copy.
  let sealed: ManifestV2 | null = null;
  try {
    const report = await verifyPackageV2(corePorts(input.unpackedDir, null, chunkBytes), {
      plaintext: 'WHEN_KEY_AVAILABLE',
      expected: {
        evidenceId: manifest.source.evidenceId,
        sessionId: manifest.source.sessionId,
        manifestSha256: manifest.sessionManifest.manifestSha256,
        ...(anchors === undefined ? {} : { trustedCertificateSha256: anchors }),
      },
    });
    for (const id of RECEIVER_VERIFY_V2_CHECKS) {
      const check = report.checks.find((candidate) => candidate.id === id);
      if (check?.status !== 'PASS') add('X-05', `${id}:${check?.status ?? 'ABSENT'}${check?.findings[0] === undefined ? '' : `:${check.findings[0].code}`}`);
    }
    const manifestText = await readFile(inUnpacked(PackageFile.MANIFEST), 'utf8');
    if (createHash('sha256').update(manifestText, 'utf8').digest('hex') !== manifest.sessionManifest.sha256) add('X-05', 'SESSION_MANIFEST_NOT_THE_EXPORTED_ONE');
    sealed = parseManifestV2(JSON.parse(manifestText));
    if (report.sources.development !== manifest.sessionManifest.developmentSources || sealed.developmentSources !== manifest.sessionManifest.developmentSources) {
      add('X-05', 'DEVELOPMENT_MARK_MISMATCH');
    }
    development = sealed.developmentSources;
  } catch {
    add('X-05', 'SESSION_MANIFEST_UNREADABLE');
  }

  // X-06
  if (sealed === null) blocked('X-06');
  else {
    for (const [index, track] of sealed.tracks.entries()) {
      const path = cameraFilePath(track.trackId);
      const file = inUnpacked(path);
      const whole = await hashRange(file, 0, null, chunkBytes);
      const recorded = manifest.payload.files.find((candidate) => candidate.trackId === track.trackId);
      if (recorded === undefined || recorded.sha256Plain !== track.sha256Plain || recorded.bytes !== track.bytes || recorded.path !== path) add('X-06', `PAYLOAD_RECORD_MISMATCH:${track.trackId}`);
      if (whole === null) add('X-06', `CAMERA_FILE_MISSING:${track.trackId}`);
      else {
        if (whole.bytes !== track.bytes || whole.sha256 !== track.sha256Plain) add('X-06', `PLAINTEXT_HASH_MISMATCH:${track.trackId}`);
        for (const fragment of sealed.files[index]?.fragments ?? []) {
          const range = await hashRange(file, fragment.byteOffset, fragment.byteLength, chunkBytes);
          if (range === null || range.bytes !== fragment.byteLength || range.sha256 !== fragment.sha256Plain) add('X-06', `FRAGMENT_PLAINTEXT_MISMATCH:${track.trackId}:${fragment.seq}`);
        }
      }
    }
  }

  // X-07
  if (manifest.composite !== null) {
    const composite = await hashRange(inUnpacked(COMPOSITE_ENTRY), 0, null, chunkBytes);
    if (composite === null) add('X-07', 'COMPOSITE_MISSING');
    else if (composite.sha256 !== manifest.composite.sha256 || composite.sha256 !== manifest.export.composite.sha256 || composite.bytes !== manifest.composite.bytes) add('X-07', 'COMPOSITE_HASH_MISMATCH');
    if (!manifest.export.derived) add('X-07', 'COMPOSITE_NOT_MARKED_DERIVED');
  } else if (listed !== null && listed.includes(COMPOSITE_ENTRY)) add('X-07', 'COMPOSITE_NOT_RECORDED');

  return result(manifest);
}
