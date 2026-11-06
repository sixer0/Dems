/**
 * THE PLAINTEXT A SEALED SESSION LEFT ON THE MEDIA STORE (task 3 fix pass F-M7c; review row 88
 * findings R88-05 and R88-15; rulings D147, D167, D178, D183).
 *
 * Recordings are plaintext on the media store until their session is sealed (D147). After the
 * commit of the item three kinds of plaintext may still lie there, and this file is the ONE place
 * that deals with them - called by the last step of the pipeline and by the sweep a start of the
 * Core runs over EVERY sealed session:
 *
 *   the recordings   `<session folder>/VIDEO-0n.mp4`. REMOVED only by proof (row 82c, F-86-2):
 *                    the package's own signed manifest - the one whose digest the item holds -
 *                    names the file; it is a regular file directly in the session folder; the
 *                    sealed counterpart is in the package with the length the manifest states; its
 *                    first `tracks[].bytes` bytes hash to `tracks[].sha256Plain`. AND (R88-15)
 *                    when the removal does not run in the attempt that hashed the sealed file, the
 *                    sealed file is DECRYPTED AND COMPARED AGAIN first: every fragment's stored
 *                    digest, chain and plaintext digest against the signed fragment table and the
 *                    recording-time rows, and the two whole-file digests of the manifest. A sealed
 *                    file of the right length and the wrong content never lets the good copy go.
 *   kept files       a file under a recording's name that fails the proof is never deleted and
 *                    never one log line (R88-05 (c)): the engine is TOLD first (one alert + one
 *                    audit row naming the session; `noteKeptPlaintext`), then the file is MOVED to
 *                    `<mediaStoreRoot>/.quarantine/<sessionId>/`. When the engine cannot be told,
 *                    nothing is moved: the next start tries again.
 *   orphans          `.sealing/<sessionId>/orphans/VIDEO-0n.mp4.<pid>.part`, files of a dead
 *                    worker that CLOSE_TRACKS moved out of the package folder. Removed once the
 *                    session is sealed, under containment: `orphans` is a real directory directly
 *                    in a real staging directory; only a regular file of exactly that name form
 *                    goes; no link is followed; the two folders go when they are empty.
 *
 * A camera file of which only a PREFIX is sealed (D183) and a camera file LEFT OUT of the seal
 * (D178) are moved to the quarantine BEFORE any removal - the first bytes of a prefix-sealed
 * original ARE the sealed prefix, so the proof alone would delete its unsealed remainder.
 *
 * A cause that may heal (the session key not there, the manifest unreadable, a sealed file
 * missing) is a typed `SealingError`: nothing is removed and nothing is moved.
 */
import { lstat, readFile, readdir, rmdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { FRAGMENT_CHAIN_GENESIS, PackageFile, audioFilePath, cameraFileName, cameraFilePath, nextFragmentChainHash, parseManifestV2, type ManifestFragment, type ManifestV2 } from '@dems/shared/evidence-package';
import type { FragmentOpener } from '@dems/shared/evidence-verify';
import { VIDEO_TRACK_IDS, type FragmentTrackId, type VideoTrackId } from '../../modules/recording-fragments';
import { describeError, type ErrorLog } from '../../plugins/logger';
import type { SealingStepJournal, SealingStepRecord, StepCheckpoint } from '../step-journal';
import { moveToQuarantine, nodeSha256, openCameraFile, removeIfThere, syncDirectory } from './camera-files';
import { MIC_RECORDING_FILE_NAMES, SEALING_STEP_ORDER, SealingError, SealingFailure, micRecordingFileName, type FragmentRows } from './contract';

const SOURCE = 'sealing.plaintext';
const DEFAULT_CHUNK_BYTES = 1024 * 1024;
/** The name the worker gives a part file beside a recording: `<camera file>.<pid>.part`. */
const ORPHAN_PART_NAME = /^VIDEO-0[12]\.mp4\.[0-9]{1,10}\.part$/;
/** The folder of the staging folder CLOSE_TRACKS moves an orphan part file into. */
export const SEALING_ORPHANS_DIR = 'orphans';

const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const errnoOf = (error: unknown): string | undefined => (error as NodeJS.ErrnoException | null)?.code;

/** One file under a recording's name that was not removed, and why. */
export interface KeptPlaintextFile {
  readonly trackId: string;
  readonly name: string;
  /** A CODE: `NOT_A_REGULAR_FILE`, `NO_PLAINTEXT_HASH`, `SHORTER_THAN_SEALED`, `NOT_THE_SEALED_BYTES`, `SEALED_FILE_NOT_PROVEN`. */
  readonly reason: string;
}

/** What the engine is told when plaintext of a sealed session had to be kept: ONE alert + ONE audit row per session. */
export interface KeptPlaintextNote {
  readonly sessionId: string;
  readonly files: readonly KeptPlaintextFile[];
}

/** The tracks of a seal as CLOSE_TRACKS recorded them, as far as this file reads them. */
export interface SealedTrackRecord {
  readonly tracks: readonly { readonly trackId: VideoTrackId; readonly partial?: { readonly reason: string; readonly firstBadSeq: number } }[];
  readonly omitted?: readonly { readonly trackId: VideoTrackId; readonly code: string | null; readonly reason: string }[];
  /** Audit row 153 (D5): the pair audio files of the seal (`ClosedAudio` of the CLOSE_TRACKS record). Absent for a `/2` seal. */
  readonly audio?: {
    readonly tracks: readonly { readonly trackId: string; readonly partial?: { readonly reason: string; readonly firstBadSeq: number } }[];
    readonly omitted: readonly { readonly trackId: string; readonly code: string | null; readonly reason: string }[];
  };
}

/**
 * ONE RECORDING the signed manifest accounts for (row 153): the worker's file beside the package and the sealed file of
 * `fragments/` with the members that state it - a camera file (`VIDEO-0N.mp4` -> `fragments/VIDEO-0N.mp4`, `tracks[]`)
 * or, since D5, a pair audio file (`MIC-0N.m4a` -> `fragments/AUDIO-0N.m4a`, `audioTracks[]`).
 */
interface AccountedRecording {
  readonly trackId: FragmentTrackId;
  readonly recordingName: string;
  readonly sealedPath: string;
  readonly record: { readonly bytes: number; readonly sha256: string; readonly sha256Plain: string | null; readonly fragmentChainHead: string | null };
  readonly fragments: readonly ManifestFragment[] | undefined;
}

/** The recordings of a committed manifest: its camera files, then (D5) its pair audio files. */
function accountedRecordings(manifest: ManifestV2): AccountedRecording[] {
  const cameras = manifest.tracks.flatMap((track): AccountedRecording[] => {
    const trackId = VIDEO_TRACK_IDS.find((id) => id === track.trackId);
    // Not a name this pipeline ever gave a recording: nothing under it is touched.
    if (trackId === undefined || track.file !== cameraFileName(trackId)) return [];
    return [{ trackId, recordingName: track.file, sealedPath: cameraFilePath(trackId), record: track, fragments: manifest.files.find((entry) => entry.trackId === trackId)?.fragments }];
  });
  const audio = (manifest.audioTracks ?? []).map((track): AccountedRecording => ({
    trackId: track.trackId as FragmentTrackId,
    recordingName: micRecordingFileName(track.micChannel),
    sealedPath: audioFilePath(track.trackId),
    record: track,
    fragments: manifest.audioFiles?.find((entry) => entry.trackId === track.trackId)?.fragments,
  }));
  return [...cameras, ...audio];
}

/** The worker's recording name of a sealed track id: `VIDEO-0N.mp4`, or for `AUDIO-0N` the channel recording `MIC-0N.m4a` (N-04, N-20). */
function recordingNameOf(trackId: string): string | null {
  if ((VIDEO_TRACK_IDS as readonly string[]).includes(trackId)) return cameraFileName(trackId as VideoTrackId);
  const pair = /^AUDIO-0([1-4])$/.exec(trackId)?.[1];
  return pair === undefined ? null : micRecordingFileName(`MIC-0${pair}` as 'MIC-01');
}

export interface FinishPlaintextInput {
  readonly sessionId: string;
  readonly packageDir: string;
  readonly stagingDir: string;
  readonly quarantineDir: string;
  /** The digest of the manifest the committed item holds. */
  readonly manifestSha256: string;
  readonly closed: SealedTrackRecord;
  /**
   * R88-15: set when the removal does NOT run in the attempt that hashed the sealed files - the
   * sealed files are then decrypted and compared again. Null: the same attempt (minutes after
   * FINALIZE_HASHES, the same process).
   */
  readonly recheck: { readonly opener: FragmentOpener | null; readonly fragments: Pick<FragmentRows, 'read'> } | null;
  readonly chunkBytes?: number;
  readonly log: ErrorLog;
  /** Resolves when the engine holds the notice (true: written now; false: it held one already). Rejects: nothing is moved. */
  readonly noteKeptPlaintext?: (note: KeptPlaintextNote) => Promise<boolean>;
}

export interface FinishPlaintextResult {
  readonly recordingsRemoved: number;
  readonly recordingsKept: number;
  readonly recordingsQuarantined: number;
  readonly orphansRemoved: number;
}

/** The signed manifest of the committed package, read back. Throws `STORAGE_FAILED` when it is not the item's. */
async function committedManifest(packageDir: string, sessionId: string, manifestSha256: string): Promise<ManifestV2> {
  let manifest: ManifestV2 | null = null;
  try {
    manifest = parseManifestV2(JSON.parse(await readFile(join(packageDir, PackageFile.MANIFEST), 'utf8')));
  } catch {
    manifest = null;
  }
  if (manifest === null || manifest.manifestSha256 !== manifestSha256 || manifest.sessionId !== sessionId) {
    throw new SealingError(SealingFailure.STORAGE_FAILED, 'the manifest of the committed package could not be read back: no recording is removed', { reason: 'MANIFEST_NOT_OF_ITEM' });
  }
  return manifest;
}

/**
 * R88-15, THE REPEATED PROOF OF ONE SEALED CAMERA FILE: true when every stored fragment has the
 * digest and the chain the signed table states, opens with the session key to bytes that hash to
 * the table's plaintext digest AND to the recording-time row, and the whole file has the two
 * digests of the manifest's track. False: the sealed file is not what was signed - the plaintext
 * must not go. Throws `FRAGMENT_NOT_OPENABLE` when the Core cannot open at all (no key): a cause
 * that may heal, nothing is decided.
 */
async function sealedFileProven(input: { packageDir: string; sessionId: string; recording: AccountedRecording; opener: FragmentOpener | null; fragments: Pick<FragmentRows, 'read'>; chunkBytes: number }): Promise<boolean> {
  const { opener, chunkBytes } = input;
  const { trackId, record: track, fragments: records } = input.recording;
  if (records === undefined || records.length === 0) return false;
  const keyId = records[0]?.keyId ?? '';
  if (opener === null || !(await opener.hasKey(keyId))) throw new SealingError(SealingFailure.FRAGMENT_NOT_OPENABLE, 'the session key is not in the credential store: the sealed file cannot be proven, no recording is removed', { trackId });
  const rows = new Map((await input.fragments.read(input.sessionId, trackId)).map((row) => [row.seq, row] as const));
  const file = await openCameraFile(join(input.packageDir, ...input.recording.sealedPath.split('/')));
  if (file === null) return false;
  try {
    if (file.source.size !== track.bytes) return false;
    const whole = nodeSha256();
    const plainWhole = nodeSha256();
    const clear = async (from: number, until: number): Promise<boolean> => {
      for (let at = from; at < until; at += chunkBytes) {
        const bytes = await file.source.read(at, Math.min(chunkBytes, until - at));
        if (bytes.byteLength === 0) return false;
        whole.update(bytes);
        plainWhole.update(bytes);
      }
      return true;
    };
    let cursor = 0;
    let chain = FRAGMENT_CHAIN_GENESIS;
    for (const [index, record] of records.entries()) {
      const row = rows.get(record.seq);
      // The recording-time digest of the fragment: without its row nothing says what was recorded.
      if (record.seq !== index + 1 || row === undefined || record.byteOffset < cursor || record.byteOffset + record.byteLength > track.bytes) return false;
      if (!(await clear(cursor, record.byteOffset))) return false;
      const stored = await file.source.read(record.byteOffset, record.byteLength);
      if (stored.byteLength !== record.byteLength) return false;
      const one = nodeSha256();
      one.update(stored);
      const storedSha = hexOf(one.digest());
      chain = nextFragmentChainHash(chain, storedSha);
      if (storedSha !== record.sha256 || chain !== record.chainHash) return false;
      whole.update(stored);
      let plain: Uint8Array;
      try {
        plain = await opener.open({ trackId, seq: record.seq, byteOffset: record.byteOffset, byteLength: record.byteLength, gcmIv: record.gcmIv, gcmTag: record.gcmTag, keyId: record.keyId }, stored);
      } catch {
        // The key is there (asked above) and the range does not open: not what was sealed.
        return false;
      }
      const plainOne = nodeSha256();
      plainOne.update(plain);
      const plainSha = hexOf(plainOne.digest());
      if (plain.byteLength !== record.byteLength || plainSha !== record.sha256Plain || plainSha !== row.sha256) return false;
      plainWhole.update(plain);
      cursor = record.byteOffset + record.byteLength;
    }
    if (!(await clear(cursor, track.bytes))) return false;
    return hexOf(whole.digest()) === track.sha256 && hexOf(plainWhole.digest()) === track.sha256Plain && chain === track.fragmentChainHead;
  } finally {
    await file.close();
  }
}

/**
 * THE PROOF RULE over the recordings of one committed package: which may go, which must be kept.
 * Decides only - nothing is removed or moved here. Throws for a cause that may heal.
 */
async function judgeRecordings(input: FinishPlaintextInput, manifest: ManifestV2): Promise<{ readonly removable: readonly string[]; readonly kept: readonly KeptPlaintextFile[] }> {
  const chunkBytes = input.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  const home = resolve(input.packageDir);
  const removable: string[] = [];
  const kept: KeptPlaintextFile[] = [];
  // Row 153 (D5): the camera files and the pair audio files of the manifest, by one rule.
  for (const recording of accountedRecordings(manifest)) {
    const { trackId, record: track } = recording;
    const name = recording.recordingName;
    if (basename(name) !== name) continue;
    const path = join(input.packageDir, name);
    if (dirname(resolve(path)) !== home) continue;
    let facts;
    try {
      facts = await lstat(path);
    } catch (error) {
      if (errnoOf(error) === 'ENOENT') continue;
      throw error;
    }
    const keep = (reason: string): void => void kept.push({ trackId, name, reason });
    if (!facts.isFile()) {
      keep('NOT_A_REGULAR_FILE');
      continue;
    }
    let sealedFacts;
    try {
      sealedFacts = await lstat(join(input.packageDir, ...recording.sealedPath.split('/')));
    } catch (error) {
      if (errnoOf(error) !== 'ENOENT') throw error;
      sealedFacts = null;
    }
    if (sealedFacts === null || !sealedFacts.isFile() || sealedFacts.size !== track.bytes) {
      throw new SealingError(SealingFailure.STORAGE_FAILED, 'the sealed media file of the committed package is not as its manifest states: no recording is removed', { trackId });
    }
    if (track.sha256Plain === null || facts.size < track.bytes) {
      keep(track.sha256Plain === null ? 'NO_PLAINTEXT_HASH' : 'SHORTER_THAN_SEALED');
      continue;
    }
    const file = await openCameraFile(path);
    if (file === null) continue;
    let same: boolean;
    try {
      const hash = nodeSha256();
      for (let at = 0; at < track.bytes; at += chunkBytes) {
        const bytes = await file.source.read(at, Math.min(chunkBytes, track.bytes - at));
        if (bytes.byteLength === 0) break;
        hash.update(bytes);
      }
      same = hexOf(hash.digest()) === track.sha256Plain;
    } finally {
      await file.close();
    }
    if (!same) {
      keep('NOT_THE_SEALED_BYTES');
      continue;
    }
    // R88-15: in a later attempt the sealed file is proven AGAIN before its only other copy goes.
    if (input.recheck !== null && !(await sealedFileProven({ packageDir: input.packageDir, sessionId: input.sessionId, recording, opener: input.recheck.opener, fragments: input.recheck.fragments, chunkBytes }))) {
      keep('SEALED_FILE_NOT_PROVEN');
      continue;
    }
    removable.push(name);
  }
  return { removable, kept };
}

/** Removes a folder that is EMPTY; one that is not there or not empty is left. */
async function removeEmpty(dir: string): Promise<void> {
  try {
    await rmdir(dir);
  } catch (error) {
    const code = errnoOf(error);
    if (code !== 'ENOENT' && code !== 'ENOTEMPTY' && code !== 'EEXIST' && code !== 'ENOTDIR') throw error;
  }
}

/**
 * R88-05 (a): the orphan part files of a SEALED session are removed. Containment: the staging
 * folder and `orphans` in it are real directories (never a link), only a REGULAR file of the
 * worker's part-name form goes, and it is unlinked by name inside that folder. Everything else is
 * left and said. Returns the files removed.
 */
export async function removeSealedOrphans(stagingDir: string, log: ErrorLog, sessionId: string): Promise<number> {
  const isRealDirectory = async (path: string): Promise<boolean> => {
    try {
      return (await lstat(path)).isDirectory();
    } catch (error) {
      if (errnoOf(error) === 'ENOENT' || errnoOf(error) === 'ENOTDIR') return false;
      throw error;
    }
  };
  if (!(await isRealDirectory(stagingDir))) return 0;
  const orphans = join(stagingDir, SEALING_ORPHANS_DIR);
  let removed = 0;
  if (await isRealDirectory(orphans)) {
    let left = 0;
    for (const entry of await readdir(orphans, { withFileTypes: true })) {
      if (entry.isFile() && ORPHAN_PART_NAME.test(entry.name)) {
        if (await removeIfThere(orphans, entry.name)) removed += 1;
      } else {
        left += 1;
      }
    }
    if (left > 0) log.append({ level: 'warn', source: SOURCE, message: 'the orphans folder of a sealed session holds entries that are no part file of a worker: they were left', code: 'SEALING_ORPHAN_NOT_REMOVED', context: { sessionId, left } });
    if (removed > 0) await syncDirectory(orphans);
    await removeEmpty(orphans);
  }
  // R88-27: the staging folder of a sealed session goes when nothing is left in it.
  await removeEmpty(stagingDir);
  return removed;
}

/** True when the session folder or its staging folder holds something this file deals with. Cheap: names only. */
export async function sealedSessionHoldsPlaintext(packageDir: string, stagingDir: string): Promise<boolean> {
  // Row 153 (D5): a microphone channel recording `MIC-0N.m4a` is plaintext of the session too.
  for (const name of [...VIDEO_TRACK_IDS.map((trackId) => cameraFileName(trackId)), ...MIC_RECORDING_FILE_NAMES]) {
    try {
      await lstat(join(packageDir, name));
      return true;
    } catch (error) {
      if (errnoOf(error) !== 'ENOENT' && errnoOf(error) !== 'ENOTDIR') throw error;
    }
  }
  try {
    return (await readdir(join(stagingDir, SEALING_ORPHANS_DIR))).length > 0;
  } catch (error) {
    if (errnoOf(error) === 'ENOENT' || errnoOf(error) === 'ENOTDIR') return false;
    throw error;
  }
}

/**
 * AFTER THE COMMIT OF THE ITEM: what was not sealed goes to the quarantine, what was sealed and is
 * proven goes, what cannot be proven is told and quarantined, the orphans go. Every step can be
 * done again (a run that finishes after a restart finds what is done already done).
 */
export async function finishSealedPlaintext(input: FinishPlaintextInput): Promise<FinishPlaintextResult> {
  const { sessionId, packageDir, quarantineDir, log } = input;
  const manifest = await committedManifest(packageDir, sessionId, input.manifestSha256);
  const sealedIds = manifest.tracks.map((track) => track.trackId);
  // DECIDED BEFORE ANYTHING IS TOUCHED: a cause that may heal throws here and leaves every file where it is.
  // Row 153 (D5): a pair audio file of which only the durable prefix is sealed is held like a camera file's.
  const partial = [...input.closed.tracks, ...(input.closed.audio?.tracks ?? [])].filter((track) => track.partial !== undefined);
  const judged = await judgeRecordings(input, manifest);
  const kept = judged.kept.filter((entry) => !partial.some((track) => track.trackId === entry.trackId));
  const removable = judged.removable.filter((name) => !partial.some((track) => recordingNameOf(track.trackId) === name));
  // TOLD FIRST (R88-05 (c)): one alert + one audit row for the session. A rejection moves nothing.
  if (kept.length > 0) {
    if (input.noteKeptPlaintext === undefined) throw new SealingError(SealingFailure.ENGINE_REFUSED, 'a plaintext file of a sealed session must be kept and the engine cannot be told: nothing is moved', { reason: 'NOTICE_NOT_WRITTEN' });
    try {
      await input.noteKeptPlaintext({ sessionId, files: kept.map((entry) => ({ ...entry })) });
    } catch (error) {
      throw new SealingError(SealingFailure.ENGINE_REFUSED, 'a plaintext file of a sealed session must be kept and the engine did not take the notice: nothing is moved', { reason: 'NOTICE_NOT_WRITTEN' }, error);
    }
  }
  let recordingsQuarantined = 0;
  // A camera file of which only the DURABLE PREFIX is sealed (ruling D183): the WHOLE original is
  // moved first - its first bytes are the sealed prefix, and the unsealed remainder must not be lost.
  for (const track of partial) {
    const name = recordingNameOf(track.trackId);
    if (name !== null && (await moveToQuarantine(packageDir, name, quarantineDir))) {
      recordingsQuarantined += 1;
      log.append({ level: 'error', source: SOURCE, message: 'the original recording file of a camera whose prefix was sealed was moved to the quarantine folder', code: 'SEALING_RECORDING_QUARANTINED', context: { sessionId, trackId: track.trackId, reason: track.partial?.reason ?? null, firstBadSeq: track.partial?.firstBadSeq ?? null } });
    }
  }
  let recordingsRemoved = 0;
  for (const name of removable) if (await removeIfThere(packageDir, name)) recordingsRemoved += 1;
  for (const entry of kept) {
    if (await moveToQuarantine(packageDir, entry.name, quarantineDir)) {
      recordingsQuarantined += 1;
      log.append({ level: 'error', source: SOURCE, message: 'a file under the name of a recording could not be proven to be the recording this package sealed: it was moved to the quarantine folder', code: 'SEALING_PLAINTEXT_QUARANTINED', context: { sessionId, trackId: entry.trackId, reason: entry.reason } });
    }
  }
  // A camera file that was LEFT OUT of the seal (R88-02 (b)) is no part of the package: moved, never deleted.
  const sealedAudioIds: readonly string[] = (manifest.audioTracks ?? []).map((track) => track.trackId);
  for (const entry of [...(input.closed.omitted ?? []), ...(input.closed.audio?.omitted ?? [])]) {
    if (sealedIds.includes(entry.trackId as VideoTrackId) || sealedAudioIds.includes(entry.trackId)) continue;
    const name = recordingNameOf(entry.trackId);
    if (name !== null && (await moveToQuarantine(packageDir, name, quarantineDir))) {
      recordingsQuarantined += 1;
      log.append({ level: 'error', source: SOURCE, message: 'a recording file that could not be sealed was moved to the quarantine folder', code: 'SEALING_RECORDING_QUARANTINED', context: { sessionId, trackId: entry.trackId, reason: entry.reason } });
    }
  }
  // Row 153 (S5 §5.3 item 5; the P0-1 risk): a microphone channel recording that the signed manifest does not account for
  // - every one of a session sealed under the `/2` manifest, whose channel files were never sealed - is no part of the
  // package and never evidence of it: moved to the quarantine with the rest, never deleted, never left beside the package.
  for (const name of MIC_RECORDING_FILE_NAMES) {
    if (await moveToQuarantine(packageDir, name, quarantineDir)) {
      recordingsQuarantined += 1;
      log.append({ level: 'warn', source: SOURCE, message: 'a microphone channel recording the sealed package does not account for was moved to the quarantine folder', code: 'SEALING_MIC_RECORDING_QUARANTINED', context: { sessionId, file: name } });
    }
  }
  await syncDirectory(packageDir);
  const orphansRemoved = await removeSealedOrphans(input.stagingDir, log, sessionId);
  return { recordingsRemoved, recordingsKept: kept.length, recordingsQuarantined, orphansRemoved };
}

// ── The sweep of a start of the Core ────────────────────────────────────────────────────────────

export interface SealedSessionSweepPorts {
  readonly packageDir: (sessionId: string) => string;
  readonly stagingDir: (sessionId: string) => string;
  readonly quarantineDir: (sessionId: string) => string;
  readonly opener: FragmentOpener | null;
  readonly fragments: Pick<FragmentRows, 'read'>;
  readonly journal: SealingStepJournal;
  readonly log: ErrorLog;
  readonly now: () => number;
  readonly chunkBytes?: number;
  readonly noteKeptPlaintext?: (note: KeptPlaintextNote) => Promise<boolean>;
}

export type SealedSessionSweepResult =
  | ({ readonly touched: true; readonly journalClosed: boolean } & FinishPlaintextResult)
  /** Nothing to do, or - with `refused` - something is there and was left exactly as it is (the code says why). */
  | { readonly touched: false; readonly refused?: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * R88-05 (b): ONE SEALED SESSION THAT IS NOT THE ONE THE PIPELINE RUNS FOR. Its item is committed
 * (the caller hands the digest the Core holds for it); what the seal left undone - a process that
 * ended between the commit and the removal, and then another session became the current one - is
 * finished here: the plaintext by `finishSealedPlaintext` WITH the repeated proof (this is always
 * a later attempt), and the journal row of the last step. Never throws: a refusal is logged and
 * answered, and every file stays where it is.
 */
export async function sweepSealedSession(ports: SealedSessionSweepPorts, item: { readonly sessionId: string; readonly manifestSha256: string }): Promise<SealedSessionSweepResult> {
  const { sessionId } = item;
  const packageDir = ports.packageDir(sessionId);
  const stagingDir = ports.stagingDir(sessionId);
  try {
    const rows = new Map<string, SealingStepRecord | null>();
    for (const step of SEALING_STEP_ORDER) rows.set(step, await ports.journal.read(sessionId, step));
    const last = SEALING_STEP_ORDER[SEALING_STEP_ORDER.length - 1] as (typeof SEALING_STEP_ORDER)[number];
    const before = SEALING_STEP_ORDER.slice(0, -1);
    const lastRow = rows.get(last) ?? null;
    const journalOpen = [...rows.values()].some((row) => row !== null) && lastRow?.status !== 'DONE';
    if (!journalOpen && !(await sealedSessionHoldsPlaintext(packageDir, stagingDir))) return { touched: false };
    // The record of the seal: without the DONE row of CLOSE_TRACKS nothing says which original is a prefix-sealed one.
    const closedRow = rows.get('CLOSE_TRACKS') ?? null;
    const closed = closedRow?.status === 'DONE' && isRecord(closedRow.checkpoint) && Array.isArray(closedRow.checkpoint.tracks) ? (closedRow.checkpoint as unknown as SealedTrackRecord) : null;
    if (closed === null) throw new SealingError(SealingFailure.JOURNAL_FAILED, 'the journal of a sealed session does not hold the record of its camera files: nothing is removed', { reason: 'NO_SEAL_RECORD' });
    const result = await finishSealedPlaintext({
      sessionId,
      packageDir,
      stagingDir,
      quarantineDir: ports.quarantineDir(sessionId),
      manifestSha256: item.manifestSha256,
      closed,
      recheck: { opener: ports.opener, fragments: ports.fragments },
      ...(ports.chunkBytes === undefined ? {} : { chunkBytes: ports.chunkBytes }),
      log: ports.log,
      ...(ports.noteKeptPlaintext === undefined ? {} : { noteKeptPlaintext: ports.noteKeptPlaintext }),
    });
    // THE JOURNAL IS CLOSED when only the last step was open: the five steps before it are DONE (the item is committed).
    let journalClosed = false;
    if (journalOpen && before.every((step) => rows.get(step)?.status === 'DONE')) {
      const attempt = [...rows.values()].reduce((highest, row) => Math.max(highest, row?.attempt ?? 0), 0) + 1;
      const checkpoint = { manifestSha256: item.manifestSha256, committed: 'ALREADY_SEALED', ...result, finishedBy: 'BOOT_SWEEP' } as unknown as StepCheckpoint;
      await ports.journal.write({ sessionId, step: last, status: 'DONE', progress: 100, etaMs: 0, attempt, checkpoint, errorCode: null, at: ports.now() });
      journalClosed = true;
    }
    return { touched: true, journalClosed, ...result };
  } catch (error) {
    const refused = error instanceof SealingError ? (typeof error.detail.reason === 'string' ? error.detail.reason : error.code) : 'SWEEP_FAILED';
    ports.log.append({ level: 'error', source: SOURCE, message: 'what a sealed session left on the media store could not be finished at the start of the Core: every file was left where it is', ...describeError(error), code: 'SEALING_SWEEP_REFUSED', context: { sessionId, reason: refused } });
    return { touched: false, refused };
  }
}
