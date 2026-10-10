/**
 * ONE EXPORT of a sealed v2 package (blueprint row 91 / M8-W2; evidence package spec §A.2, §A.4,
 * §G.1-§G.4; OD-16; SEC35-09).
 *
 *   export/EXP-<id>.zip             the archive: the camera files DECRYPTED, and every clear file
 *                                   of the package byte for byte (the sealed manifest, the seal's
 *                                   signature and certificate, `fragments.json`, the transcript
 *                                   and its revisions, the audit extract, retained certificates);
 *                                   with a composite: `composite/composite.mp4`
 *   export/EXP-<id>.manifest.json   the export manifest of THIS export, and its signature
 *   export/EXP-<id>.manifest.sig    (the completion mark: it is written last)
 *   export/export-manifest.json     the same two files under the names of spec §A.2: the export
 *   export/export-manifest.sig      that was made last (decision D-91-3)
 *
 * THE ORDER OF ONE RUN
 *
 *   1. refuse without a session-key opener, a signer, or (for a composite) a selected encoder -
 *      before anything is written;
 *   2. VERIFY THE SOURCE with the one verifier and the one decryption path of the Core
 *      (`verifyPackageV2`, plaintext REQUIRED, the item's anchors): a package that does not
 *      verify is not exported, and without the live session key an export is impossible while
 *      the stored-bytes checks still pass (SEC35-09 - no key escrow);
 *   3. write the archive under a `.partial` name. A camera file is decrypted fragment by fragment
 *      through the SAME `FragmentOpener` the verifier uses and goes straight into the archive; its
 *      plaintext is hashed on the way and must equal the SEALED `tracks[].sha256Plain`;
 *   4. the composite, when asked for: encoded from the two decrypted streams into a `.partial`
 *      file of the export folder, copied into the archive, hashed, removed;
 *   5. hash the archive, build the export manifest (the 9 fields of §B.11 in it), sign it;
 *   6. THE SECRET SWEEP over every clear text of the artefact (`secret-sweep.ts`);
 *   7. give the files their names: archive, manifest, signature - the signature last.
 *
 * PLAINTEXT exists in the archive, in the composite's `.partial` file while step 4 runs, and in
 * memory one fragment at a time. Nowhere else: no staging folder.
 *
 * A FAILURE at any step removes every file this run created (the partials, and names it had
 * already given) and the export folder if this run made it and it is empty; then it throws an
 * `ExportFailure` with a code. THE SEALED PACKAGE IS NEVER WRITTEN TO: its files are opened for
 * reading through the verifier's package reader, and the only folder written is `export/`.
 *
 * Nothing here logs. A failure carries a code, never a path, a value or key material.
 */
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { sep } from 'node:path';
import { EXPORT_ID_PATTERN } from '@dems/shared/api';
import { PackageFile, cameraFilePath, exportArchivePath, parseManifestV2, sha256Hex, type ManifestFragment, type ManifestTrack, type ManifestV2 } from '@dems/shared/evidence-package';
import { VERIFY_MAX_LISTED_FILES, VERIFY_MAX_MANIFEST_BYTES, VERIFY_MAX_OPEN_FRAGMENT_BYTES, retainedCertificatePath, verifyPackageV2, type FragmentOpener, type PackageReader } from '@dems/shared/evidence-verify';
import { verifyEd25519, type LoadedSigner } from '../capture';
import { corePorts, createPackageReader, type RealEvidenceItem } from '../evidence-verify';
import { compositeEncoderAllowed, type CompositeEncoder, type CompositeSource } from './composite';
import {
  COMPOSITE_ENTRY,
  EXPORT_MANIFEST_FILE,
  EXPORT_PERMISSION,
  EXPORT_REPRESENTATION,
  EXPORT_SIGNATURE_FILE,
  ExportManifestError,
  buildExportManifest,
  serializeExportManifest,
  serializeExportSignature,
  signExportManifest,
  type ExportManifest,
  type ExportSignature,
} from './export-manifest';
import { sweepForSecrets, type SecretFinding } from './secret-sweep';
import { createArchive, type ArchiveWriter } from './zip-store';

export const ExportKind = { PACKAGE: 'PACKAGE', COMPOSITE: 'COMPOSITE' } as const;
export type ExportKind = (typeof ExportKind)[keyof typeof ExportKind];

/** Why an export failed. The same code is the job's `failureReason` and the audit row's `reason`. */
export const ExportFailureCode = {
  EXPORT_ID_INVALID: 'EXPORT_ID_INVALID',
  /** No opener, or the session key of the package is not in the store (SEC35-09: key lost = no export). */
  SESSION_KEY_UNAVAILABLE: 'SESSION_KEY_UNAVAILABLE',
  SIGNER_UNAVAILABLE: 'SIGNER_UNAVAILABLE',
  /** The licence gate of `composite.ts`: no encoder is selected. */
  COMPOSITE_ENCODER_NOT_SELECTED: 'COMPOSITE_ENCODER_NOT_SELECTED',
  COMPOSITE_ENCODER_REFUSED: 'COMPOSITE_ENCODER_REFUSED',
  COMPOSITE_FAILED: 'COMPOSITE_FAILED',
  /** The package did not pass the Core's verification: it is not exported. */
  SOURCE_VERIFY_FAILED: 'SOURCE_VERIFY_FAILED',
  SOURCE_UNREADABLE: 'SOURCE_UNREADABLE',
  FRAGMENT_OPEN_FAILED: 'FRAGMENT_OPEN_FAILED',
  /** The decrypted file does not hash to the sealed plaintext hash. */
  PLAINTEXT_HASH_MISMATCH: 'PLAINTEXT_HASH_MISMATCH',
  EXPORT_DIR_UNSAFE: 'EXPORT_DIR_UNSAFE',
  /** An archive of that export ID exists already: it is never replaced. */
  EXPORT_EXISTS: 'EXPORT_EXISTS',
  EXPORT_WRITE_FAILED: 'EXPORT_WRITE_FAILED',
  SIGNATURE_FAILED: 'SIGNATURE_FAILED',
  SECRET_SHAPE_FOUND: 'SECRET_SHAPE_FOUND',
  /** The request row of the export is not in the trail any more. */
  EXPORT_REQUEST_NOT_FOUND: 'EXPORT_REQUEST_NOT_FOUND',
  /** The server stopped while the job ran (reported for a job found unfinished after a restart). */
  EXPORT_INTERRUPTED: 'EXPORT_INTERRUPTED',
  EXPORT_FAILED: 'EXPORT_FAILED',
} as const;
export type ExportFailureCode = (typeof ExportFailureCode)[keyof typeof ExportFailureCode];

export class ExportFailure extends Error {
  readonly code: ExportFailureCode;
  /** For `SECRET_SHAPE_FOUND`: the files and forms. Never the text that matched. */
  readonly findings: readonly SecretFinding[];
  constructor(code: ExportFailureCode, findings: readonly SecretFinding[] = []) {
    super(code);
    this.name = 'ExportFailure';
    this.code = code;
    this.findings = findings;
  }
}

/** What the export has from outside the package: the committed request of operation 42. */
export interface ExportRequestFacts {
  /** `EXP-NNNNNN`. */
  readonly exportId: string;
  readonly kind: ExportKind;
  /** The server clock of the run. */
  readonly exportedAt: number;
  /** The operator ID of the session that asked. */
  readonly exportedBy: string;
  /** The ID of the audit row `EVIDENCE_EXPORTED` of the request. */
  readonly authorizationRef: string;
  readonly destination: string;
  readonly purpose: string;
}

export interface ExportPorts {
  /** The ONE decryption path: the opener verify v2 uses (`coreFragmentOpener(app)`). */
  readonly opener: FragmentOpener | null;
  /** The Core's evidence signer with its certificate. */
  readonly signer: LoadedSigner | null;
  /** SHA-256 of the Core's own certificates, the retained ones included. */
  readonly trustedCertificateSha256: readonly string[];
  /** Null: the licence gate is closed (`composite.ts`). */
  readonly composite: CompositeEncoder | null;
  /** A test reads in small chunks. */
  readonly chunkBytes?: number;
  /** A test plants a failure at a named step (`'BEFORE_NAMES'`: everything written, nothing named yet). */
  readonly probe?: (step: 'ARCHIVE_WRITTEN' | 'BEFORE_NAMES') => void | Promise<void>;
}

export interface ExportOutcome {
  readonly exportId: string;
  readonly kind: ExportKind;
  readonly derived: boolean;
  /** `export.manifestSha256`. */
  readonly manifestSha256: string;
  /** The export signature, lowercase hex. */
  readonly signature: string;
  readonly manifest: ExportManifest;
  /** Paths inside the package folder, `/` separated. */
  readonly files: { readonly archive: string; readonly manifest: string; readonly signature: string };
}

/** `export/EXP-<id>.manifest.json` and `.sig`: the manifest and signature of ONE export. */
export function exportManifestPathOf(exportId: string): string {
  return `${PackageFile.EXPORT_DIR}/${exportId}.manifest.json`;
}
export function exportSignaturePathOf(exportId: string): string {
  return `${PackageFile.EXPORT_DIR}/${exportId}.manifest.sig`;
}

const PARTIAL = '.partial';
const CLEAR_FILE_MAX_BYTES = VERIFY_MAX_MANIFEST_BYTES;
const DEFAULT_CHUNK_BYTES = 1024 * 1024;

const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (codeOf(error) === 'ENOENT') return false;
    throw error;
  }
}

/** `[offset, offset + length)` of a package file, whole. Throws `SOURCE_UNREADABLE` when the file is shorter. */
async function readExact(reader: PackageReader, path: string, offset: number, length: number): Promise<Buffer> {
  const bytes = Buffer.alloc(length);
  let filled = 0;
  let delivered: number;
  try {
    delivered = await reader.readRange(path, offset, length, (chunk) => {
      bytes.set(chunk, filled);
      filled += chunk.byteLength;
    });
  } catch {
    throw new ExportFailure(ExportFailureCode.SOURCE_UNREADABLE);
  }
  if (delivered !== length) throw new ExportFailure(ExportFailureCode.SOURCE_UNREADABLE);
  return bytes;
}

/** The DECRYPTED bytes of one camera file, in order: clear boxes as they are, each sealed range opened. */
async function* decryptedCameraFile(
  reader: PackageReader,
  opener: FragmentOpener,
  track: ManifestTrack,
  fragments: readonly ManifestFragment[],
  chunkBytes: number,
): AsyncGenerator<Uint8Array> {
  const path = cameraFilePath(track.trackId);
  async function* clear(from: number, to: number): AsyncGenerator<Uint8Array> {
    for (let at = from; at < to; at += chunkBytes) yield await readExact(reader, path, at, Math.min(chunkBytes, to - at));
  }
  let cursor = 0;
  for (const fragment of fragments) {
    if (fragment.byteOffset < cursor || fragment.byteLength > VERIFY_MAX_OPEN_FRAGMENT_BYTES) throw new ExportFailure(ExportFailureCode.SOURCE_VERIFY_FAILED);
    yield* clear(cursor, fragment.byteOffset);
    const stored = await readExact(reader, path, fragment.byteOffset, fragment.byteLength);
    let plain: Uint8Array;
    try {
      plain = await opener.open(
        { trackId: track.trackId, seq: fragment.seq, byteOffset: fragment.byteOffset, byteLength: fragment.byteLength, gcmIv: fragment.gcmIv, gcmTag: fragment.gcmTag, keyId: fragment.keyId },
        stored,
      );
    } catch {
      throw new ExportFailure(ExportFailureCode.FRAGMENT_OPEN_FAILED);
    }
    if (plain.byteLength !== fragment.byteLength) throw new ExportFailure(ExportFailureCode.FRAGMENT_OPEN_FAILED);
    yield plain;
    cursor = fragment.byteOffset + fragment.byteLength;
  }
  if (track.bytes < cursor) throw new ExportFailure(ExportFailureCode.SOURCE_VERIFY_FAILED);
  yield* clear(cursor, track.bytes);
}

interface ArchivedEntry {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

async function addEntry(archive: ArchiveWriter, path: string, pieces: AsyncIterable<Uint8Array> | Iterable<Uint8Array>, onBytes: (count: number) => void): Promise<ArchivedEntry> {
  const hash = createHash('sha256');
  const bytes = await archive.add(path, async (write) => {
    for await (const piece of pieces) {
      hash.update(piece);
      await write(piece);
      onBytes(piece.byteLength);
    }
  });
  return { path, bytes, sha256: hash.digest('hex') };
}

async function* fileChunks(file: string, chunkBytes: number): AsyncGenerator<Uint8Array> {
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(chunkBytes);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, chunkBytes, null);
      if (bytesRead === 0) return;
      yield Buffer.from(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
}

async function hashFile(file: string, chunkBytes: number): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of fileChunks(file, chunkBytes)) {
    hash.update(chunk);
    bytes += chunk.byteLength;
  }
  return { sha256: hash.digest('hex'), bytes };
}

function failureOf(error: unknown): ExportFailure {
  if (error instanceof ExportFailure) return error;
  if (error instanceof ExportManifestError) {
    return new ExportFailure(error.code === 'SIGNATURE_FAILED' || error.code === 'SIGNER_MISMATCH' ? ExportFailureCode.SIGNATURE_FAILED : ExportFailureCode.EXPORT_FAILED);
  }
  const code = codeOf(error);
  // A code of the file system (ENOSPC, EACCES, EEXIST, ...) or of the archive writer.
  if (code !== undefined && /^E[A-Z]+$/.test(code)) return new ExportFailure(ExportFailureCode.EXPORT_WRITE_FAILED);
  if (error instanceof Error && error.message.startsWith('ARCHIVE_')) return new ExportFailure(ExportFailureCode.EXPORT_WRITE_FAILED);
  return new ExportFailure(ExportFailureCode.EXPORT_FAILED);
}

/**
 * Runs one export. `packageDir` is the folder of the sealed package; `item` holds what the Core
 * knows of the item from outside it. `onProgress` is called with a whole percentage, rising.
 */
export async function exportPackage(
  packageDir: string,
  item: RealEvidenceItem,
  request: ExportRequestFacts,
  ports: ExportPorts,
  onProgress: (percent: number) => void = () => undefined,
): Promise<ExportOutcome> {
  // 1. Before anything is written.
  if (!EXPORT_ID_PATTERN.test(request.exportId)) throw new ExportFailure(ExportFailureCode.EXPORT_ID_INVALID);
  const { opener, signer } = ports;
  if (opener === null) throw new ExportFailure(ExportFailureCode.SESSION_KEY_UNAVAILABLE);
  if (signer === null) throw new ExportFailure(ExportFailureCode.SIGNER_UNAVAILABLE);
  const withComposite = request.kind === ExportKind.COMPOSITE;
  const encoder = withComposite ? ports.composite : null;
  if (withComposite && encoder === null) throw new ExportFailure(ExportFailureCode.COMPOSITE_ENCODER_NOT_SELECTED);
  if (encoder !== null && !compositeEncoderAllowed(encoder.name)) throw new ExportFailure(ExportFailureCode.COMPOSITE_ENCODER_REFUSED);

  const chunkBytes = ports.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  const place = (relative: string): string => `${packageDir}${sep}${relative.split('/').join(sep)}`;
  const exportDir = place(PackageFile.EXPORT_DIR);
  const names = {
    archive: exportArchivePath(request.exportId),
    manifest: exportManifestPathOf(request.exportId),
    signature: exportSignaturePathOf(request.exportId),
  };
  const compositePartial = place(`${PackageFile.EXPORT_DIR}/${request.exportId}.composite${PARTIAL}`);
  /** Every file this run created, newest last: what a failure removes. */
  const created: string[] = [];
  let madeExportDir = false;
  let archive: ArchiveWriter | null = null;

  try {
    // 2. The source verifies, with the session key, against the item's anchors.
    const report = await verifyPackageV2(corePorts(packageDir, opener, ports.chunkBytes), {
      plaintext: 'REQUIRED',
      expected: {
        evidenceId: item.evidenceId,
        sessionId: item.sessionId,
        manifestSha256: item.manifestSha256,
        transcriptSha256: item.transcriptSha256,
        revisionCount: item.revisionCount,
        trustedCertificateSha256: ports.trustedCertificateSha256,
      },
    });
    if (!report.ok) {
      const keyLost = report.checks.some((check) => check.findings.some((finding) => finding.code === 'SESSION_KEY_UNAVAILABLE'));
      throw new ExportFailure(keyLost ? ExportFailureCode.SESSION_KEY_UNAVAILABLE : ExportFailureCode.SOURCE_VERIFY_FAILED);
    }
    onProgress(30);

    const reader = createPackageReader(packageDir, { chunkBytes });
    let manifestText: string;
    let manifest: ManifestV2;
    try {
      manifestText = await reader.readText(PackageFile.MANIFEST, VERIFY_MAX_MANIFEST_BYTES);
      manifest = parseManifestV2(JSON.parse(manifestText));
    } catch {
      throw new ExportFailure(ExportFailureCode.SOURCE_UNREADABLE);
    }
    const listed = await reader.list(VERIFY_MAX_LISTED_FILES);
    if (listed === null) throw new ExportFailure(ExportFailureCode.SOURCE_UNREADABLE);
    const cameraPaths = new Set<string>(manifest.tracks.map((track) => cameraFilePath(track.trackId)));
    const clearPaths = listed
      .filter((path) => !path.startsWith(`${PackageFile.EXPORT_DIR}/`) && !path.startsWith(`${PackageFile.COMPOSITE_DIR}/`) && !cameraPaths.has(path))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    // 3. The export folder and the archive.
    try {
      const facts = await lstat(exportDir);
      if (!facts.isDirectory()) throw new ExportFailure(ExportFailureCode.EXPORT_DIR_UNSAFE);
    } catch (error) {
      if (error instanceof ExportFailure) throw error;
      if (codeOf(error) !== 'ENOENT') throw error;
      await mkdir(exportDir, { mode: 0o700 });
      madeExportDir = true;
    }
    for (const name of [names.archive, names.manifest, names.signature]) if (await exists(place(name))) throw new ExportFailure(ExportFailureCode.EXPORT_EXISTS);
    // A partial of this export ID is a leftover of a run of this unit that the server did not survive.
    for (const leftover of [`${names.archive}${PARTIAL}`, `${names.manifest}${PARTIAL}`, `${names.signature}${PARTIAL}`]) await rm(place(leftover), { force: true });
    await rm(compositePartial, { force: true });

    const archivePartial = place(`${names.archive}${PARTIAL}`);
    archive = await createArchive(archivePartial);
    created.push(archivePartial);

    const totalBytes = Math.max(1, manifest.tracks.reduce((sum, track) => sum + track.bytes, 0));
    let copied = 0;
    const copyShare = withComposite ? 30 : 55;
    const counted = (count: number): void => {
      copied += count;
      onProgress(30 + Math.min(copyShare, Math.floor((copied / totalBytes) * copyShare)));
    };

    const entries: ArchivedEntry[] = [];
    const texts: { file: string; text: string }[] = [];
    for (const path of clearPaths) {
      const entry = await reader.entry(path);
      if (entry.kind !== 'FILE' || entry.size > CLEAR_FILE_MAX_BYTES) throw new ExportFailure(ExportFailureCode.SOURCE_UNREADABLE);
      const bytes = await readExact(reader, path, 0, entry.size);
      entries.push(await addEntry(archive, path, [bytes], () => undefined));
      texts.push({ file: path, text: bytes.toString('utf8') });
    }

    const payload: ExportManifest['payload']['files'] = [];
    for (const [index, track] of manifest.tracks.entries()) {
      const path = cameraFilePath(track.trackId);
      const archived = await addEntry(archive, path, decryptedCameraFile(reader, opener, track, manifest.files[index]?.fragments ?? [], chunkBytes), counted);
      if (archived.sha256 !== track.sha256Plain || archived.bytes !== track.bytes) throw new ExportFailure(ExportFailureCode.PLAINTEXT_HASH_MISMATCH);
      entries.push(archived);
      payload.push({ trackId: track.trackId, path, bytes: archived.bytes, sha256Plain: archived.sha256 });
    }

    // The certificate of the export signature, when it is not one the package already carries.
    const exportCertificate = retainedCertificatePath(signer.certificate.sha256);
    if (signer.certificate.sha256 !== manifest.signature.certificate.sha256 && !clearPaths.includes(exportCertificate)) {
      entries.push(await addEntry(archive, exportCertificate, [Buffer.from(signer.certificate.pemText, 'utf8')], () => undefined));
    }

    // 4. The composite.
    let composite: ExportManifest['composite'] = null;
    if (encoder !== null) {
      const [first, second] = manifest.tracks;
      if (first === undefined || second === undefined) throw new ExportFailure(ExportFailureCode.SOURCE_VERIFY_FAILED);
      const sourceOf = (track: ManifestTrack, index: number): CompositeSource => ({
        trackId: track.trackId,
        read: () => decryptedCameraFile(reader, opener, track, manifest.files[index]?.fragments ?? [], chunkBytes),
      });
      created.push(compositePartial);
      try {
        await encoder.encode([sourceOf(first, 0), sourceOf(second, 1)], compositePartial);
      } catch (error) {
        throw error instanceof ExportFailure ? error : new ExportFailure(ExportFailureCode.COMPOSITE_FAILED);
      }
      if (!(await exists(compositePartial))) throw new ExportFailure(ExportFailureCode.COMPOSITE_FAILED);
      const archived = await addEntry(archive, COMPOSITE_ENTRY, fileChunks(compositePartial, chunkBytes), () => undefined);
      if (archived.bytes === 0) throw new ExportFailure(ExportFailureCode.COMPOSITE_FAILED);
      entries.push(archived);
      await rm(compositePartial, { force: true });
      composite = { derived: true, path: COMPOSITE_ENTRY, bytes: archived.bytes, sha256: archived.sha256, encoder: encoder.name, sources: [first.trackId, second.trackId] };
      onProgress(85);
    }

    await archive.finish();
    archive = null;
    await ports.probe?.('ARCHIVE_WRITTEN');
    const archiveFacts = await hashFile(archivePartial, chunkBytes);
    onProgress(90);

    // 5. The export manifest and its signature.
    const exportManifest = buildExportManifest({
      payload: { representation: EXPORT_REPRESENTATION, files: payload },
      sessionManifest: {
        path: PackageFile.MANIFEST,
        sha256: sha256Hex(Buffer.from(manifestText, 'utf8')),
        manifestSha256: manifest.manifestSha256,
        manifestVersion: 2,
        developmentSources: manifest.developmentSources,
      },
      signature: {
        path: PackageFile.SIGNATURE,
        algorithm: manifest.signature.algorithm,
        keyId: manifest.signature.keyId,
        certificate: PackageFile.CERTIFICATE,
        certificateSha256: manifest.signature.certificate.sha256,
      },
      export: {
        exportId: request.exportId,
        exportedAt: request.exportedAt,
        exportedBy: request.exportedBy,
        authorizationRef: request.authorizationRef,
        derived: composite !== null,
        composite: { included: composite !== null, encoder: composite?.encoder ?? null, sha256: composite?.sha256 ?? null },
      },
      source: { evidenceId: manifest.evidenceId, sessionId: manifest.sessionId, deviceId: manifest.device.deviceId },
      destination: { id: request.destination },
      package: { file: `${request.exportId}.zip`, bytes: archiveFacts.bytes, hashAlgorithm: 'SHA-256', sha256: archiveFacts.sha256, entries },
      authorization: { purpose: request.purpose, reference: request.authorizationRef, permission: EXPORT_PERMISSION },
      composite,
    });
    const signature: ExportSignature = await signExportManifest(signer.signer, signer.certificate, exportManifest, request.exportedAt, verifyEd25519);
    const manifestBytes = serializeExportManifest(exportManifest);
    const signatureBytes = serializeExportSignature(signature);

    // 6. The secret sweep: every clear text of the artefact, the two files of this run included.
    const findings = sweepForSecrets([
      ...texts,
      { file: EXPORT_MANIFEST_FILE, text: Buffer.from(manifestBytes).toString('utf8') },
      { file: EXPORT_SIGNATURE_FILE, text: Buffer.from(signatureBytes).toString('utf8') },
    ]);
    if (findings.length > 0) throw new ExportFailure(ExportFailureCode.SECRET_SHAPE_FOUND, findings);

    const manifestPartial = place(`${names.manifest}${PARTIAL}`);
    const signaturePartial = place(`${names.signature}${PARTIAL}`);
    await writeFile(manifestPartial, manifestBytes, { flag: 'wx', mode: 0o600 });
    created.push(manifestPartial);
    await writeFile(signaturePartial, signatureBytes, { flag: 'wx', mode: 0o600 });
    created.push(signaturePartial);
    await ports.probe?.('BEFORE_NAMES');

    // 7. The names: the signature last. Each name replaces its partial in the list of what a failure removes.
    for (const [partial, name] of [
      [archivePartial, names.archive],
      [manifestPartial, names.manifest],
      [signaturePartial, names.signature],
    ] as const) {
      await rename(partial, place(name));
      created[created.indexOf(partial)] = place(name);
    }
    onProgress(98);

    // The names of spec §A.2 hold the export that was made last. A failure here fails the export
    // as a whole (the three files of this run are removed again): an export whose hand-out names
    // could not be written is not reported as complete.
    for (const [bytes, name] of [
      [manifestBytes, PackageFile.EXPORT_MANIFEST],
      [signatureBytes, PackageFile.EXPORT_MANIFEST_SIGNATURE],
    ] as const) {
      const latestPartial = place(`${name}.${request.exportId}${PARTIAL}`);
      await rm(latestPartial, { force: true });
      await writeFile(latestPartial, bytes, { flag: 'wx', mode: 0o600 });
      created.push(latestPartial);
      await rename(latestPartial, place(name));
      created.pop();
    }
    onProgress(100);

    return Object.freeze({
      exportId: request.exportId,
      kind: request.kind,
      derived: exportManifest.export.derived,
      manifestSha256: exportManifest.export.manifestSha256,
      signature: signature.signature,
      manifest: exportManifest,
      files: names,
    });
  } catch (error) {
    if (archive !== null) await archive.abandon().catch(() => undefined);
    for (const file of created.reverse()) await rm(file, { force: true }).catch(() => undefined);
    if (madeExportDir) {
      const rest = await readdir(exportDir).catch(() => null);
      if (rest !== null && rest.length === 0) await rmdir(exportDir).catch(() => undefined);
    }
    throw failureOf(error);
  }
}
