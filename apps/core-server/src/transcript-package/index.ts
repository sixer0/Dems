/**
 * The transcript files of a sealed package, as the transcript operations use them (task 3
 * integration pass D4; evidence package spec §A.1, §B.7, §D V-10, V-11). A unit of its own, closed
 * from its first day and not registered by `app.ts`: the modules open no file themselves (static
 * rule G-R1), so `modules/transcripts` reaches the package through the functions below.
 *
 *   transcript/transcript.json            READ ONLY. The sealed machine transcript. Its bytes are
 *                                         answered only when their SHA-256 is the hash the item's
 *                                         `transcripts` row holds. Nothing here opens it for
 *                                         writing.
 *   transcript/transcript-revisions.json  the append-only signed revision list
 *                                         (`dems.transcript-revisions/1`, the form verify V-11
 *                                         reads). REPLACED WHOLE on an append: the new list is
 *                                         written to a staging file in the same folder, synced,
 *                                         and renamed over the old one, so a reader sees the list
 *                                         before or after the append, never half of one.
 *   certificates/<sha256>.pem             the certificate of the key that signed a revision, when
 *                                         it is not the package's own `device-certificate.pem`
 *                                         (SEC35-20: the package retains the certificate set).
 *
 * The package folder is `<mediaStoreDir>/SESSION-<sessionId>` (`sessionPackageDir` of the verify
 * unit: the one place that builds that path). Every file name is a constant of the shared layout;
 * no part of a path comes from a request.
 */
import { PackageFile, canonicalJsonBytes } from '@dems/shared/evidence-package';
import {
  TRANSCRIPT_REVISIONS_SCHEMA_ID,
  TranscriptRevisionsFileSchema,
  pemCertificateSha256,
  retainedCertificatePath,
  type TranscriptRevisionRecord,
  type TranscriptRevisionsFile,
} from '@dems/shared/evidence-verify';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** The largest transcript document or revision list this module reads whole (the verifier's own bound for the list). */
export const TRANSCRIPT_FILE_MAX_BYTES = 16 * 1024 * 1024;

const pathIn = (packageDir: string, relative: string): string => join(packageDir, ...relative.split('/'));

async function readBounded(path: string): Promise<Uint8Array | null> {
  try {
    const found = await stat(path);
    if (!found.isFile() || found.size > TRANSCRIPT_FILE_MAX_BYTES) return null;
    return new Uint8Array(await readFile(path));
  } catch {
    return null;
  }
}

export const sha256HexOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The bytes of the sealed `transcript.json` when their hash is `expectedSha256`; null otherwise (absent, too large, or another document). */
export async function readSealedTranscriptBytes(packageDir: string, expectedSha256: string): Promise<Uint8Array | null> {
  const bytes = await readBounded(pathIn(packageDir, PackageFile.TRANSCRIPT_JSON));
  return bytes !== null && sha256HexOf(bytes) === expectedSha256 ? bytes : null;
}

/** The revision list of a package, or null when the file is absent or is not a list of this item and transcript. */
export async function readRevisionList(packageDir: string, expected: { evidenceId: string; machineTranscriptSha256: string }): Promise<TranscriptRevisionsFile | null> {
  const bytes = await readBounded(pathIn(packageDir, PackageFile.TRANSCRIPT_REVISIONS));
  if (bytes === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  const parsed = TranscriptRevisionsFileSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data.evidenceId === expected.evidenceId && parsed.data.machineTranscriptSha256 === expected.machineTranscriptSha256 ? parsed.data : null;
}

async function syncDirectory(dir: string): Promise<void> {
  const handle = await open(dir, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Writes `bytes` to `target` through a synced staging file of the same folder and one rename. */
async function replaceFile(target: string, bytes: Uint8Array): Promise<void> {
  const dir = dirname(target);
  const staging = join(dir, `.${randomBytes(8).toString('hex')}.part`);
  try {
    const handle = await open(staging, 'wx', 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(staging, target);
    await syncDirectory(dir);
  } catch (error) {
    await rm(staging, { force: true });
    throw error;
  }
}

/** Replaces the revision list of a package with `records` (canonical JSON, as the seal wrote the empty list). */
export async function writeRevisionList(packageDir: string, list: { evidenceId: string; machineTranscriptSha256: string; revisions: readonly TranscriptRevisionRecord[] }): Promise<void> {
  const file: TranscriptRevisionsFile = { schema: TRANSCRIPT_REVISIONS_SCHEMA_ID, evidenceId: list.evidenceId, machineTranscriptSha256: list.machineTranscriptSha256, revisions: [...list.revisions] };
  await replaceFile(pathIn(packageDir, PackageFile.TRANSCRIPT_REVISIONS), canonicalJsonBytes(file));
}

/**
 * Makes sure the package holds the certificate of a key that signed a revision: nothing to do when
 * it is the package's own `device-certificate.pem`; otherwise `certificates/<sha256>.pem` is
 * written once (a file of that name that holds that certificate is left as it is).
 */
export async function retainCertificate(packageDir: string, certificate: { readonly sha256: string; readonly pemText: string }): Promise<void> {
  const own = await readBounded(pathIn(packageDir, PackageFile.CERTIFICATE));
  if (own !== null && pemCertificateSha256(new TextDecoder().decode(own)) === certificate.sha256) return;
  const target = pathIn(packageDir, retainedCertificatePath(certificate.sha256));
  const held = await readBounded(target);
  if (held !== null && pemCertificateSha256(new TextDecoder().decode(held)) === certificate.sha256) return;
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await replaceFile(target, new TextEncoder().encode(certificate.pemText));
}
