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
 *                                         reads). REPLACED WHOLE by one rename, so a reader sees
 *                                         the list before or after an append, never half of one.
 *   transcript/transcript-revisions.json.next
 *                                         THE STAGED LIST of an append (closing pass F-X, finding
 *                                         R80-08): the whole next list, written and synced INSIDE
 *                                         the unit of work, renamed over the real list only AFTER
 *                                         the commit. The table is the judge of it
 *                                         (`settleRevisionFiles`): it is promoted when it is the
 *                                         table's chain, removed when it is not. It is the only
 *                                         carrier of a new revision's signed BODY between the
 *                                         commit and the rename - no column stores the body.
 *   certificates/<sha256>.pem             the certificate of the key that signed a revision, when
 *                                         it is not the package's own `device-certificate.pem`
 *                                         (SEC35-20: the package retains the certificate set).
 *
 * The package folder is `<mediaStoreDir>/SESSION-<sessionId>` (`sessionPackageDir` of the verify
 * unit: the one place that builds that path). Every file name is a constant of the shared layout;
 * no part of a path comes from a request.
 */
import { PackageFile, canonicalJsonBytes, manifestHashMatches, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
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

/** The largest sealed manifest this module reads whole: a manifest lists every fragment of both camera files. */
export const SEALED_MANIFEST_MAX_BYTES = 64 * 1024 * 1024;

/**
 * THE TRANSCRIPT BLOCK OF THE MANIFEST AN ITEM WAS SEALED WITH (fix pass F-M6, R80-01), or null.
 * Answered only when the file is a manifest of the form, its recorded digest is the hash of its
 * own canonical body, AND that digest is the one the item holds (`evidence_items.manifest_hash`,
 * the digest that was signed): a block of any other manifest states nothing about the item. The
 * signature itself is operation 41's to verify; the summary this feeds is a label, not a verdict.
 */
export async function readSealedManifestTranscript(packageDir: string, expectedManifestSha256: string): Promise<ManifestV2['transcript'] | null> {
  let bytes: Uint8Array;
  try {
    const path = pathIn(packageDir, PackageFile.MANIFEST);
    const found = await stat(path);
    if (!found.isFile() || found.size > SEALED_MANIFEST_MAX_BYTES) return null;
    bytes = new Uint8Array(await readFile(path));
  } catch {
    return null;
  }
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!manifestHashMatches(value)) return null;
    const manifest = parseManifestV2(value);
    return manifest.manifestSha256 === expectedManifestSha256 ? manifest.transcript : null;
  } catch {
    return null;
  }
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

const canonicalList = (list: RevisionListInput): Uint8Array => {
  const file: TranscriptRevisionsFile = { schema: TRANSCRIPT_REVISIONS_SCHEMA_ID, evidenceId: list.evidenceId, machineTranscriptSha256: list.machineTranscriptSha256, revisions: [...list.revisions] };
  return canonicalJsonBytes(file);
};

export interface RevisionListInput {
  readonly evidenceId: string;
  readonly machineTranscriptSha256: string;
  readonly revisions: readonly TranscriptRevisionRecord[];
}

/** Replaces the revision list of a package with `records` (canonical JSON, as the seal wrote the empty list). */
export async function writeRevisionList(packageDir: string, list: RevisionListInput): Promise<void> {
  await replaceFile(pathIn(packageDir, PackageFile.TRANSCRIPT_REVISIONS), canonicalList(list));
}

// ── The staged list and its judge (closing pass F-X, R80-08) ─────────────────────────────────────

/** The staged list of an append, relative to the package: the real list's name with this suffix. */
export const STAGED_REVISIONS_SUFFIX = '.next';
const stagedPathIn = (packageDir: string): string => `${pathIn(packageDir, PackageFile.TRANSCRIPT_REVISIONS)}${STAGED_REVISIONS_SUFFIX}`;

/**
 * Writes the WHOLE next list under the fixed staged name and syncs it (file and folder). The real
 * list is not touched. Called inside the unit of work, after the row was accepted; a staged list of
 * an earlier append that never committed is overwritten.
 */
export async function stageRevisionList(packageDir: string, list: RevisionListInput): Promise<void> {
  const staged = stagedPathIn(packageDir);
  const handle = await open(staged, 'w', 0o600);
  try {
    await handle.writeFile(canonicalList(list));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(dirname(staged));
}

/** Renames the staged list over the real one (after the commit). False when there is no staged list. */
export async function promoteStagedRevisionList(packageDir: string): Promise<boolean> {
  const staged = stagedPathIn(packageDir);
  try {
    await rename(staged, pathIn(packageDir, PackageFile.TRANSCRIPT_REVISIONS));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  await syncDirectory(dirname(staged));
  return true;
}

/** What the table says of one stored revision: the judge's side of `settleRevisionFiles`. */
export interface StoredRevisionFacts {
  readonly revisionNo: number;
  readonly sha256: string;
  readonly signatureValue: string;
}

/** A record that IS the stored row: its number, its hash, its signature, and a body that hashes to the row's hash. */
function isRecordOfRow(record: TranscriptRevisionRecord | undefined, row: StoredRevisionFacts): record is TranscriptRevisionRecord {
  if (record === undefined || record.revisionNo !== row.revisionNo || record.sha256 !== row.sha256 || record.signature.value !== row.signatureValue || record.body === undefined) return false;
  try {
    return sha256HexOf(canonicalJsonBytes(record.body)) === row.sha256;
  } catch {
    return false;
  }
}

/**
 * True when `records` holds every stored row, record for row, in order. `STRICT` (a staged list,
 * before it may become the real one): each record is the row's by number, hash, signature and a
 * body that hashes to the row's hash. `BY_HASH` (the real list, as the routes always read it): by
 * number and hash - what is inside a record of the real list is verify V-11's to judge.
 */
function holdsTheRows(records: readonly TranscriptRevisionRecord[], rows: readonly StoredRevisionFacts[], how: 'STRICT' | 'BY_HASH'): boolean {
  return rows.every((row, index) => {
    const record = records[index];
    return how === 'STRICT' ? isRecordOfRow(record, row) : record !== undefined && record.revisionNo === row.revisionNo && record.sha256 === row.sha256;
  });
}

async function parseList(path: string, expected: { evidenceId: string; machineTranscriptSha256: string }): Promise<TranscriptRevisionsFile | null> {
  const bytes = await readBounded(path);
  if (bytes === null) return null;
  try {
    const parsed = TranscriptRevisionsFileSchema.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    return parsed.success && parsed.data.evidenceId === expected.evidenceId && parsed.data.machineTranscriptSha256 === expected.machineTranscriptSha256 ? parsed.data : null;
  } catch {
    return null;
  }
}

const present = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

/**
 * The staged list of a package READ ONLY, when it holds every stored row (record for row): the
 * records of the rows, in order. Null otherwise. For a reader between a commit and its rename.
 */
export async function readStagedRevisionRecords(packageDir: string, expected: { evidenceId: string; machineTranscriptSha256: string }, rows: readonly StoredRevisionFacts[]): Promise<TranscriptRevisionRecord[] | null> {
  const staged = await parseList(stagedPathIn(packageDir), expected);
  if (staged === null || !holdsTheRows(staged.revisions, rows, 'STRICT')) return null;
  return staged.revisions.slice(0, rows.length);
}

/** What `settleRevisionFiles` did to the staged list. */
export type StagedSettlement =
  /** There was none. */
  | 'NONE'
  /** It was the table's chain, record for row: renamed over the real list (a commit whose rename never happened). */
  | 'PROMOTED'
  /** The table's chain plus exactly one record more: the remains of an append whose unit did not commit. Removed. */
  | 'DISCARDED_UNCOMMITTED'
  /** The real list already was the table's chain: a staged list beside it is nothing. Removed. */
  | 'DISCARDED_SUPERSEDED'
  /** Not a list of this item, or not the table's chain. Removed. */
  | 'DISCARDED_UNACCEPTABLE';

export interface RevisionFilesSettlement {
  readonly staged: StagedSettlement;
  /** Records the real list held AFTER the last stored row: signed revisions the table never recorded. They were removed. */
  readonly orphansRemoved: number;
  /** True when the real list could not be read as a list of this item. */
  readonly listUnreadable: boolean;
  /**
   * The records of the real list as it now is, one per stored row; null when the list does not hold
   * the stored chain and nothing in the package can complete it (nothing is made up: no column
   * stores a revision's body).
   */
  readonly records: TranscriptRevisionRecord[] | null;
}

/**
 * THE TABLE IS THE JOURNAL (closing pass F-X, R80-08). Brings the two list files of a package to
 * what `rows` - the stored revisions of the item, oldest first - say, and answers what it did:
 *
 *   staged list = the table's chain          -> renamed over the real list (crash after the commit);
 *   staged list = anything else              -> removed (it never committed, or is not a list);
 *   real list holds records after the rows   -> rewritten without them (an orphan of the old order);
 *   real list = the table's chain            -> NOT WRITTEN: byte-identical;
 *   real list lacks a stored row, no staged  -> left as it is, `records: null` (not healable).
 *
 * Call it only where no append of this package can be between its staging and its rename: at boot,
 * or under `withRevisionLock`. Throws what the file system throws.
 */
export async function settleRevisionFiles(packageDir: string, expected: { evidenceId: string; machineTranscriptSha256: string }, rows: readonly StoredRevisionFacts[]): Promise<RevisionFilesSettlement> {
  const realPath = pathIn(packageDir, PackageFile.TRANSCRIPT_REVISIONS);
  const stagedPath = stagedPathIn(packageDir);
  let list = await parseList(realPath, expected);

  let staged: StagedSettlement = 'NONE';
  if (await present(stagedPath)) {
    const next = await parseList(stagedPath, expected);
    const isChain = next !== null && next.revisions.length === rows.length && holdsTheRows(next.revisions, rows, 'STRICT');
    if (isChain && !(list !== null && list.revisions.length === rows.length && holdsTheRows(list.revisions, rows, 'BY_HASH'))) {
      await promoteStagedRevisionList(packageDir);
      list = next;
      staged = 'PROMOTED';
    } else {
      await rm(stagedPath, { force: true });
      await syncDirectory(dirname(stagedPath));
      staged = isChain ? 'DISCARDED_SUPERSEDED' : next !== null && next.revisions.length === rows.length + 1 && holdsTheRows(next.revisions, rows, 'STRICT') ? 'DISCARDED_UNCOMMITTED' : 'DISCARDED_UNACCEPTABLE';
    }
  }

  if (list === null) return { staged, orphansRemoved: 0, listUnreadable: true, records: null };
  if (!holdsTheRows(list.revisions, rows, 'BY_HASH')) return { staged, orphansRemoved: 0, listUnreadable: false, records: null };
  const kept = list.revisions.slice(0, rows.length);
  const orphansRemoved = list.revisions.length - kept.length;
  if (orphansRemoved > 0) await writeRevisionList(packageDir, { ...expected, revisions: kept });
  return { staged, orphansRemoved, listUnreadable: false, records: kept };
}

const revisionLocks = new Map<string, Promise<unknown>>();

/**
 * Runs `work` alone for this package in this process: one append (its settling, its staged list,
 * its commit and its rename) at a time, so no rename ever promotes another append's staged list.
 * One Core process owns a media store.
 */
export function withRevisionLock<T>(packageDir: string, work: () => Promise<T>): Promise<T> {
  const before = revisionLocks.get(packageDir) ?? Promise.resolve();
  const run = before.then(work, work);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  revisionLocks.set(packageDir, settled);
  void settled.then(() => {
    if (revisionLocks.get(packageDir) === settled) revisionLocks.delete(packageDir);
  });
  return run;
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
