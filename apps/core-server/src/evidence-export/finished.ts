/**
 * THE FINISHED EXPORTS OF A PACKAGE, as its `export/` folder holds them (task 3 wave H, driver C1;
 * gate findings G94-05 and G94-11; ruling D200).
 *
 * WHAT IS A FINISHED EXPORT: `export/EXP-<id>.manifest.sig` (written last: the completion mark)
 * with its manifest - a canonical, valid export manifest of THAT export ID and THAT evidence item
 * whose digest is the one the signature file names - and the archive `export/EXP-<id>.zip` as a
 * plain file. Anything else in the folder is not listed (a `.partial`, a stray file: operation 41
 * reports those as a notice).
 *
 * RETENTION (G94-11). The evidence package spec §G states no retention rule for finished archives,
 * so NONE IS APPLIED: an archive is a decrypted copy of evidence an operator asked for, and the
 * product deletes no such copy silently. They stay until the package is removed (the reset), are
 * LISTED on the item (operation 40 `exports`), and each can be downloaded again by a permitted
 * operator (operation 87 by its job ID). The cost - one decrypted archive per export in the
 * evidence store - is a stated limit of the README.
 *
 * THE HASH OF AN ARCHIVE (ruling D200) cannot be a member of the archive: it is computed from the
 * file and remembered in this process (`archiveFactsOf`), keyed by the file's path, length and
 * modification instant - a file that changed is hashed again. Listing never hashes: a list entry
 * carries the hash only when it is known already.
 *
 * Reads only; nothing here writes, logs or throws for anything the folder can contain.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { sep } from 'node:path';
import { EXPORT_ID_PATTERN, exportJobIdOf as contractJobIdOf, type EvidenceFinishedExport } from '@dems/shared/api';
import { PackageFile, exportArchivePath } from '@dems/shared/evidence-package';
import { computeExportManifestSha256, parseExportManifest, parseExportSignature } from './export-manifest';

/** How many finished exports of one item are listed (the contract's bound). The newest are kept. */
export const FINISHED_EXPORTS_LISTED = 100;

const place = (packageDir: string, relative: string): string => `${packageDir}${sep}${relative.split('/').join(sep)}`;
const manifestPathOf = (exportId: string): string => `${PackageFile.EXPORT_DIR}/${exportId}.manifest.json`;
const signaturePathOf = (exportId: string): string => `${PackageFile.EXPORT_DIR}/${exportId}.manifest.sig`;
const SIGNATURE_NAME = /^(EXP-[0-9]{6})\.manifest\.sig$/;

/** What `export/EXP-<id>.manifest.{json,sig}` of a package say of a finished export, or null. */
export interface CompletedExportFacts {
  readonly manifestSha256: string;
  readonly signature: string;
  readonly derived: boolean;
  readonly exportedAt: number;
  readonly exportedBy: string;
}

export async function completedOnDisk(packageDir: string, exportId: string, evidenceId: string): Promise<CompletedExportFacts | null> {
  try {
    const manifest = parseExportManifest(await readFile(place(packageDir, manifestPathOf(exportId)), 'utf8'));
    const signature = parseExportSignature(await readFile(place(packageDir, signaturePathOf(exportId)), 'utf8'));
    if (manifest.export.exportId !== exportId || manifest.source.evidenceId !== evidenceId) return null;
    if (computeExportManifestSha256(manifest) !== manifest.export.manifestSha256 || signature.signedDigest !== manifest.export.manifestSha256) return null;
    return { manifestSha256: manifest.export.manifestSha256, signature: signature.signature, derived: manifest.export.derived, exportedAt: manifest.export.exportedAt, exportedBy: manifest.export.exportedBy };
  } catch {
    return null;
  }
}

interface KnownArchive {
  readonly bytes: number;
  readonly mtimeMs: number;
  readonly sha256: string;
}
/** Hashes of archive files this process has computed. Bounded; the oldest entry goes first. */
const known = new Map<string, KnownArchive>();
const KNOWN_ARCHIVES = 256;

function remember(file: string, entry: KnownArchive): void {
  known.delete(file);
  if (known.size >= KNOWN_ARCHIVES) {
    const oldest = known.keys().next().value;
    if (oldest !== undefined) known.delete(oldest);
  }
  known.set(file, entry);
}

async function hashOf(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/**
 * The length of an archive file and its SHA-256. `hash: false` answers the hash only when this
 * process knows it for the file as it is now; `hash: true` computes it when it does not. Null: no
 * plain file is there (a link in its place is not followed).
 */
export async function archiveFactsOf(file: string, options: { readonly hash: boolean }): Promise<{ readonly bytes: number; readonly sha256?: string } | null> {
  try {
    const facts = await lstat(file);
    if (!facts.isFile()) return null;
    const held = known.get(file);
    if (held !== undefined && held.bytes === facts.size && held.mtimeMs === facts.mtimeMs) return { bytes: facts.size, sha256: held.sha256 };
    if (!options.hash) return { bytes: facts.size };
    const sha256 = await hashOf(file);
    // Held to the file as it was when the hash was taken: a file that changed meanwhile is hashed again next time.
    const after = await lstat(file);
    if (after.size === facts.size && after.mtimeMs === facts.mtimeMs) remember(file, { bytes: facts.size, mtimeMs: facts.mtimeMs, sha256 });
    return { bytes: facts.size, sha256 };
  } catch {
    return null;
  }
}

/** An archive this process just wrote and hashed: remembered for the file as it is now, so that listing it costs no second pass. Never throws. */
export async function rememberArchive(file: string, archive: { readonly bytes: number; readonly sha256: string }): Promise<void> {
  try {
    const facts = await lstat(file);
    if (facts.isFile() && facts.size === archive.bytes) remember(file, { bytes: facts.size, mtimeMs: facts.mtimeMs, sha256: archive.sha256 });
  } catch {
    // Not there: nothing to remember.
  }
}

/** The path of the archive of one export inside a package folder. */
export function archiveFileOf(packageDir: string, exportId: string): string {
  return place(packageDir, exportArchivePath(exportId));
}

/** The finished exports of one item's package, newest first; empty when the folder has none or cannot be read. */
export async function listFinishedExports(packageDir: string, evidenceId: string): Promise<EvidenceFinishedExport[]> {
  let names: string[];
  try {
    names = await readdir(place(packageDir, PackageFile.EXPORT_DIR));
  } catch {
    return [];
  }
  const listed: EvidenceFinishedExport[] = [];
  for (const name of names) {
    const exportId = SIGNATURE_NAME.exec(name)?.[1];
    if (exportId === undefined || !EXPORT_ID_PATTERN.test(exportId)) continue;
    const jobId = contractJobIdOf(exportId);
    if (jobId === null) continue;
    const done = await completedOnDisk(packageDir, exportId, evidenceId);
    if (done === null) continue;
    const archive = await archiveFactsOf(archiveFileOf(packageDir, exportId), { hash: false });
    if (archive === null) continue;
    listed.push({
      exportId,
      jobId,
      kind: done.derived ? 'COMPOSITE' : 'PACKAGE',
      completedAt: done.exportedAt,
      exportedBy: done.exportedBy,
      archiveBytes: archive.bytes,
      ...(archive.sha256 === undefined ? {} : { archiveSha256: archive.sha256 }),
    });
  }
  listed.sort((a, b) => b.completedAt - a.completedAt || (a.exportId < b.exportId ? 1 : -1));
  return listed.slice(0, FINISHED_EXPORTS_LISTED);
}
