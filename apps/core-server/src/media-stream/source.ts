/**
 * The camera file of a sealed v2 package as a source of PLAINTEXT byte ranges (blueprint row 90,
 * M8-W1; capture spec §D.1, §D.4; evidence package spec §A.1, §B.6; decision D133 (2): the package
 * is the folder `SESSION-<sessionId>/` with `session-manifest.json`).
 *
 * NOTHING OF ITS OWN TOUCHES A FILE, A KEY OR A CIPHER. The bytes on disk come through the
 * `PackageReader` of `src/evidence-verify` (read only, no link followed, nothing outside the
 * folder); a sealed fragment is opened by the ONE fragment opener of the Core
 * (`coreFragmentOpener`, row 84's cipher wired by row 85), which recomputes the AAD from the
 * record and verifies the tag before it returns a byte; the fragments a range touches are chosen
 * by row 84's `planRangeRead`. This file composes the three.
 *
 * WHAT A RANGE COSTS (§D.4). The least unit that can be opened is one fragment: every fragment the
 * range touches is read WHOLE and opened WHOLE, and only the bytes asked for are handed on.
 * Fragments the range does not touch are never read and never opened. One fragment is in memory
 * at a time. NO PLAINTEXT IS EVER WRITTEN TO A FILE: this unit has no way to write one (its
 * static rule).
 *
 * WHICH FRAGMENT TABLE IS BELIEVED. The manifest on disk is believed only when (a) it is a
 * `dems.evidence-manifest/2` manifest by the strict schema, (b) its body hashes to the digest it
 * states and (c) that digest IS the one the database recorded when the item was sealed
 * (`evidence_items.manifest_hash`) and it names this item and this session. A manifest somebody
 * edited or swapped - with a fragment table that points elsewhere - fails (b) or (c) and nothing is
 * played. The clear bytes of a camera file (the container header, boxes left clear) carry no tag:
 * they are served as stored, and their integrity is the stored-bytes hash of verify v2 (operation
 * 41), not of playback.
 *
 * A FRAGMENT WHOSE TAG FAILS IS NOT SERVED: `readPlain` throws a `MediaSourceError` naming the
 * track and the fragment, and no byte of that fragment was handed on.
 */
import { PackageFile, cameraFilePath, manifestHashMatches, packageFolderName, parseManifestV2, type PackageVideoTrackId } from '@dems/shared/evidence-package';
import { VERIFY_MAX_MANIFEST_BYTES, VERIFY_MAX_OPEN_FRAGMENT_BYTES, type FragmentOpener, type PackageReader, type SealedRangeRecord } from '@dems/shared/evidence-verify';
import type { MediaItem } from './items';
import { isFragmentAuthenticationFailure, isKeyNotFound, planRangeRead } from './store-door';

/** Why a file cannot be played, or why a stream stopped. Codes: names, never values. */
export const MediaSourceFailure = {
  /** The session ID is no folder name, or the package folder has no manifest. */
  PACKAGE_MISSING: 'PACKAGE_MISSING',
  MANIFEST_UNREADABLE: 'MANIFEST_UNREADABLE',
  /** The manifest on disk is not the one that was sealed for this item (hash, digest of record, item, session). */
  MANIFEST_NOT_OF_ITEM: 'MANIFEST_NOT_OF_ITEM',
  CAMERA_FILE_MISSING: 'CAMERA_FILE_MISSING',
  /** The sealed manifest names no camera file of that ID: a package of ONE camera has one file (fix pass F-M8; `tracks[]` of 1 or 2). */
  CAMERA_FILE_NOT_IN_PACKAGE: 'CAMERA_FILE_NOT_IN_PACKAGE',
  /** The file on disk is not as long as its sealed record says. */
  CAMERA_FILE_SIZE_MISMATCH: 'CAMERA_FILE_SIZE_MISMATCH',
  FRAGMENT_TABLE_INVALID: 'FRAGMENT_TABLE_INVALID',
  FRAGMENT_TOO_LARGE: 'FRAGMENT_TOO_LARGE',
  /** The Core holds no session key of this package: key lost = data unreadable (SEC35-09). */
  SESSION_KEY_UNAVAILABLE: 'SESSION_KEY_UNAVAILABLE',
  /** Fewer stored bytes than the record says could be read. */
  CAMERA_FILE_UNREADABLE: 'CAMERA_FILE_UNREADABLE',
  /** The tag of a fragment did not verify: its bytes, nonce, tag, position or key ID are not the sealed ones. */
  FRAGMENT_NOT_AUTHENTIC: 'FRAGMENT_NOT_AUTHENTIC',
  /** The opener failed for another reason. Nothing was served either. */
  FRAGMENT_NOT_OPENED: 'FRAGMENT_NOT_OPENED',
} as const;
export type MediaSourceFailure = (typeof MediaSourceFailure)[keyof typeof MediaSourceFailure];

export class MediaSourceError extends Error {
  readonly code: MediaSourceFailure;
  readonly trackId: string | null;
  /** The fragment that stopped the stream, or null. */
  readonly seq: number | null;

  constructor(code: MediaSourceFailure, where: { readonly trackId?: string; readonly seq?: number } = {}) {
    super(code);
    this.name = 'MediaSourceError';
    this.code = code;
    this.trackId = where.trackId ?? null;
    this.seq = where.seq ?? null;
  }
}

/** One camera file, ready to be read: its place in the package, its length and its sealed ranges. */
export interface MediaFilePlan {
  readonly trackId: PackageVideoTrackId;
  /** `fragments/VIDEO-01.mp4`, relative to the package folder. */
  readonly path: string;
  /** The length of the file: the same before and after decryption (§D.1). */
  readonly size: number;
  /** The sealed ranges, ascending, without overlap. */
  readonly records: readonly SealedRangeRecord[];
}

export interface MediaSourcePorts {
  readonly reader: PackageReader;
  readonly opener: FragmentOpener;
}

const SESSION_FOLDER = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
/** How many clear bytes are read and handed on at a time. */
export const CLEAR_CHUNK_BYTES = 1024 * 1024;

/** `SESSION-<sessionId>` when the session ID can be a folder name; null otherwise (decision D133 (2)). */
export function packageFolderOf(sessionId: string): string | null {
  return typeof sessionId === 'string' && SESSION_FOLDER.test(sessionId) ? packageFolderName(sessionId) : null;
}

/**
 * Reads the manifest of the item's package and returns the plan of one camera file. Throws a
 * `MediaSourceError` for everything that makes the file unplayable. Reads no camera byte and
 * opens no key: one `hasKey` question.
 */
export async function planMediaFile(ports: MediaSourcePorts, item: Pick<MediaItem, 'evidenceId' | 'sessionId' | 'manifestSha256'>, trackId: PackageVideoTrackId): Promise<MediaFilePlan> {
  const entry = await ports.reader.entry(PackageFile.MANIFEST);
  if (entry.kind !== 'FILE') throw new MediaSourceError(entry.kind === 'ABSENT' ? MediaSourceFailure.PACKAGE_MISSING : MediaSourceFailure.MANIFEST_UNREADABLE);
  let manifest: ReturnType<typeof parseManifestV2>;
  try {
    manifest = parseManifestV2(JSON.parse(await ports.reader.readText(PackageFile.MANIFEST, VERIFY_MAX_MANIFEST_BYTES)) as unknown);
  } catch {
    throw new MediaSourceError(MediaSourceFailure.MANIFEST_UNREADABLE);
  }
  // The anchor from OUTSIDE the package first: a manifest that is consistent with itself proves nothing.
  if (manifest.manifestSha256 !== item.manifestSha256 || manifest.evidenceId !== item.evidenceId || manifest.sessionId !== item.sessionId || !manifestHashMatches(manifest)) {
    throw new MediaSourceError(MediaSourceFailure.MANIFEST_NOT_OF_ITEM);
  }

  const track = manifest.tracks.find((candidate) => candidate.trackId === trackId);
  const file = manifest.files.find((candidate) => candidate.trackId === trackId);
  // A package of one camera holds one file: asking for the other is no defect of the package.
  if (track === undefined && file === undefined) throw new MediaSourceError(MediaSourceFailure.CAMERA_FILE_NOT_IN_PACKAGE, { trackId });
  if (track === undefined || file === undefined) throw new MediaSourceError(MediaSourceFailure.FRAGMENT_TABLE_INVALID, { trackId });
  const path = cameraFilePath(trackId);
  const onDisk = await ports.reader.entry(path);
  if (onDisk.kind !== 'FILE') throw new MediaSourceError(MediaSourceFailure.CAMERA_FILE_MISSING, { trackId });
  if (onDisk.size !== track.bytes) throw new MediaSourceError(MediaSourceFailure.CAMERA_FILE_SIZE_MISMATCH, { trackId });

  const records: SealedRangeRecord[] = file.fragments.map((fragment) => ({
    trackId,
    seq: fragment.seq,
    byteOffset: fragment.byteOffset,
    byteLength: fragment.byteLength,
    gcmIv: fragment.gcmIv,
    gcmTag: fragment.gcmTag,
    keyId: fragment.keyId,
  }));
  const last = records.at(-1);
  try {
    // Row 84's plan checks the table as it walks it: ascending, no overlap, no empty range.
    if (track.bytes > 0) planRangeRead(records, { start: 0, end: track.bytes });
  } catch {
    throw new MediaSourceError(MediaSourceFailure.FRAGMENT_TABLE_INVALID, { trackId });
  }
  if (last !== undefined && last.byteOffset + last.byteLength > track.bytes) throw new MediaSourceError(MediaSourceFailure.FRAGMENT_TABLE_INVALID, { trackId });
  const tooLarge = records.find((record) => record.byteLength > VERIFY_MAX_OPEN_FRAGMENT_BYTES);
  if (tooLarge !== undefined) throw new MediaSourceError(MediaSourceFailure.FRAGMENT_TOO_LARGE, { trackId, seq: tooLarge.seq });

  for (const keyId of new Set(records.map((record) => record.keyId))) {
    let usable = false;
    try {
      usable = (await ports.opener.hasKey(keyId)) === true;
    } catch {
      usable = false;
    }
    if (!usable) throw new MediaSourceError(MediaSourceFailure.SESSION_KEY_UNAVAILABLE, { trackId });
  }
  return { trackId, path, size: track.bytes, records };
}

async function readStored(reader: PackageReader, plan: MediaFilePlan, offset: number, length: number, seq?: number): Promise<Buffer> {
  const stored = Buffer.alloc(length);
  let filled = 0;
  try {
    await reader.readRange(plan.path, offset, length, (chunk) => {
      stored.set(chunk.subarray(0, Math.min(chunk.byteLength, length - filled)), filled);
      filled += Math.min(chunk.byteLength, length - filled);
    });
  } catch {
    filled = -1;
  }
  if (filled !== length) throw new MediaSourceError(MediaSourceFailure.CAMERA_FILE_UNREADABLE, seq === undefined ? { trackId: plan.trackId } : { trackId: plan.trackId, seq });
  return stored;
}

/**
 * The plaintext of `[start, end)` of one camera file, piece by piece, in file order. A piece is
 * either clear bytes as stored or the wanted part of ONE fragment that was read whole, opened
 * whole and whose tag verified. The first failure throws; nothing of a failed fragment was yielded.
 */
export async function* readPlain(ports: MediaSourcePorts, plan: MediaFilePlan, range: { readonly start: number; readonly end: number }): AsyncGenerator<Buffer, void, undefined> {
  if (range.end <= range.start) return;
  const bySeq = new Map(plan.records.map((record) => [record.seq, record] as const));
  for (const segment of planRangeRead(plan.records, range)) {
    if (segment.kind === 'CLEAR') {
      for (let at = segment.start; at < segment.end; at += CLEAR_CHUNK_BYTES) {
        yield await readStored(ports.reader, plan, at, Math.min(CLEAR_CHUNK_BYTES, segment.end - at));
      }
      continue;
    }
    const record = bySeq.get(Number(segment.record.seq));
    if (record === undefined) throw new MediaSourceError(MediaSourceFailure.FRAGMENT_TABLE_INVALID, { trackId: plan.trackId });
    const where = { trackId: plan.trackId, seq: record.seq };
    const stored = await readStored(ports.reader, plan, record.byteOffset, record.byteLength, record.seq);
    let plain: Uint8Array;
    try {
      plain = await ports.opener.open(record, stored);
    } catch (error) {
      if (isFragmentAuthenticationFailure(error)) throw new MediaSourceError(MediaSourceFailure.FRAGMENT_NOT_AUTHENTIC, where);
      if (isKeyNotFound(error)) throw new MediaSourceError(MediaSourceFailure.SESSION_KEY_UNAVAILABLE, where);
      throw new MediaSourceError(MediaSourceFailure.FRAGMENT_NOT_OPENED, where);
    }
    if (plain.byteLength !== record.byteLength) throw new MediaSourceError(MediaSourceFailure.FRAGMENT_NOT_OPENED, where);
    yield Buffer.from(plain.buffer, plain.byteOffset, plain.byteLength).subarray(segment.from, segment.to);
  }
}
