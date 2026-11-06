/**
 * WHAT THE CAPTURE SIDE KNOWS OF A SESSION AND THE SEAL NEEDS (blueprint row 71c, decision D153;
 * evidence package spec §B.4 field 40, §B.12 fields 127 / 128, erratum PE-124-12; decisions D66
 * (4b), D72 (e), D72 (g), D147).
 *
 *   clockOffsetMs   per camera: the camera clock minus the Core clock as the camera's adapter
 *                   reported it at the start of the capture (`CameraAdapter.ntpOffsetMs`); null
 *                   when the adapter reported none. Since tidy pass F-Y the FALLBACK of field 40;
 *   measuredClockOffsetMs
 *                   per camera: the offset the WORKER measured when it anchored the camera - the
 *                   first `TELEMETRY.clocks[].lagMs` of the worker whose file it is, as camera
 *                   clock minus Core clock (`-lagMs`, whole ms; it contains the delivery delay,
 *                   about 20 ms on the fixture). THE SOURCE OF FIELD 40 (fix F-M3 decision 3; ruling
 *                   D179: an offset inside the bound is recorded, never corrected). Null: the
 *                   worker reported none;
 *   syncLevel       per camera file: the durability level the worker stated with its first durable
 *                   fragment (`F_FULLFSYNC` | `FSYNC`; review R63-09). Null: not stated. The
 *                   manifest has NO field for it (ruling D188): it stays here and in the log;
 *   ended           per camera: THE CAMERA WAS GIVEN UP WHILE THE SESSION WENT ON (fix wave H driver A,
 *                   gate 64 condition C3 / gate 89 section 7; ruling D199) - the reason the worker
 *                   gave (`CAMERA_CLOCK_OUT_OF_BOUND`, `CAMERA_STREAM_ENDED`, `CAMERA_NOT_CONNECTED`:
 *                   the supervisor's `CaptureCameraEnd`), the Core instant, and the last durable
 *                   fragment of its file. Null / absent: the camera recorded to the end of the
 *                   session. THE HAND-OFF OF THE PER-CAMERA CAUSE TO THE SEAL: the seal marks that
 *                   track from it (the marking itself is the pipeline's: request filed, note 120);
 *   firstVideo      per camera file: the worker's `FIRST_VIDEO_SAMPLE` record of the LAST worker of
 *                   the session - `pts` and `timescale` (fields 127 / 128), and what arrived before
 *                   the first written sample (`heldMs`, `skipped`, `skippedSpanMs`: the manifest
 *                   has NO field for these three; they are kept here and in the log);
 *   micMissing      per camera file (row 148; D5 pairs, D30 K-3; protocol 6 `CapturePlanCamera.micMissing`):
 *                   THE PAIRED CHANNEL OF THIS CAMERA WAS NOT RECORDED - `NOT_ASSIGNED` (the slot was
 *                   empty) or `NOT_OPENED` (it could not be opened), as the plan of the LAST worker of
 *                   the session stated it; the camera file then carries a silent audio track. Absent:
 *                   its channel was recorded (a file written before row 148 reads so). The hand-off of
 *                   the missing-mic statement to the seal (row 153: `audioTracksMissing[].reason`).
 *                   ONLY camera files are listed here: a channel file (`MIC-0N.m4a`) has no entry.
 *
 * WHY A FILE. The seal reads the session record once per run and a resumed seal must build the
 * manifest of the run it resumes, byte for byte (`MANIFEST_NOT_REPRODUCIBLE` otherwise). Values
 * that lived only in the memory of the Core that recorded would be there for the first run and
 * gone after a restart. No table has a column for them and this row adds no migration, so they
 * are written - while the capture runs, each time one arrives - to ONE small file per session:
 *
 *     <mediaStoreDir>/.capture-session/<sessionId>.json
 *
 * beside the media store, NOT inside the package folder `SESSION-<id>` (a package holds only the
 * files it declares). The file is replaced atomically (sibling file, fsync, rename). It holds
 * device IDs, track IDs and numbers: no path, no address, no credential, no media.
 *
 * HOW LONG IT IS KEPT (fix wave H driver A, G89-07). Until the session is SEALED: the sealing host
 * removes it once the manifest is signed and stored (`removeSessionCaptureFacts`). A FAILED or
 * pending seal keeps it - its next run reads it. A reset removes the file of every session it
 * clears (`db/reset/session-artefacts.ts`).
 *
 * WHOSE FILE IT IS. A reset starts the session counter again, so a session ID can be used twice.
 * The file says `startRecordedAt`: the instant of the session's four `session_capture_sources`
 * rows. A reader holds it against those rows and ignores a file of another session of that ID.
 */
import { constants as FS } from 'node:fs';
import { lstat, open, readFile, rename, rm, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { CAPTURE_PAIRED_MIC_MISSING_REASONS, CaptureSyncLevel, type CapturePairedMicMissingReason } from '@dems/capture-protocol';
import { cameraFileName, cameraFilePath, VIDEO_TRACK_IDS, type PackageVideoTrackId } from '@dems/shared/evidence-package'; // VIDEO_TRACK_IDS: D60 (2026-11-04)
import { videoSampleEntryOf, videoStreamFormatOf, type VideoSampleEntryRead, type VideoStreamFormat } from '../capture';

export const SESSION_CAPTURE_FACTS_FOLDER = '.capture-session';
export const SESSION_CAPTURE_FACTS_VERSION = 1;
/** A facts file larger than this is not one. */
const FACTS_FILE_MAX_BYTES = 16_384;

const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const TRACK_IDS: readonly string[] = VIDEO_TRACK_IDS; // D60 (2026-11-04): the widened domain also accepts facts of VIDEO-03/04; a two-track session's file still parses (superset, never a narrowing)
const DEVICE_ID = /^[A-Z][A-Z0-9]{1,15}-[0-9]{2,4}$/;
const SYNC_LEVELS: readonly CaptureSyncLevel[] = Object.values(CaptureSyncLevel);

export interface SessionCameraFacts {
  readonly trackId: string;
  readonly deviceId: string;
  /** The camera clock minus the Core clock, in whole ms; null: the adapter reported none. */
  readonly clockOffsetMs: number | null;
  /** The offset the worker measured at anchoring (camera minus Core), in whole ms; null: it reported none. Manifest field 40 when there. */
  readonly measuredClockOffsetMs: number | null;
  /** The sync level the worker stated with the first durable fragment of this file; null: not stated. */
  readonly syncLevel: CaptureSyncLevel | null;
  /**
   * The camera was given up while the session went on (C3): why, when (Core clock, epoch ms) and
   * where its file ends (the last durable fragment; null: none was durable). Absent or null: it was not.
   */
  readonly ended?: SessionCameraEnd | null;
  /** Row 148 (D30 K-3): why the paired channel of this camera was not recorded (its file has a silent audio track). Absent or null: it was recorded. */
  readonly micMissing?: CapturePairedMicMissingReason | null;
  /** The worker's `FIRST_VIDEO_SAMPLE` of this camera file; null: no such record arrived. */
  readonly firstVideo: {
    readonly pts: number;
    readonly timescale: number;
    readonly heldMs: number;
    readonly skipped: Readonly<Record<string, number>>;
    readonly skippedSpanMs: number;
  } | null;
}

const whole = (value: unknown, min: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min;

/** A reason code as the capture protocol writes one: capitals, digits, underscores. Never a sentence, never a value of a device. */
const END_REASON = /^[A-Z][A-Z0-9_]{1,63}$/;

export interface SessionCameraEnd {
  readonly reason: string;
  readonly at: number;
  readonly lastDurableFragmentIndex: number | null;
  readonly lastDurableMediaEndMs: number | null;
}

/**
 * The facts with one camera marked as given up (C3). THE FIRST END OF A CAMERA STANDS: a later
 * report for the same camera changes nothing (the file ended where it first ended). The same
 * object when the camera is not of this session, is marked already, or the end is not of the form.
 */
export function withCameraEnded(facts: SessionCaptureFacts, deviceId: string, end: SessionCameraEnd): SessionCaptureFacts {
  const valid = END_REASON.test(end.reason) && whole(end.at, 0) && (end.lastDurableFragmentIndex === null || whole(end.lastDurableFragmentIndex, 1)) && (end.lastDurableMediaEndMs === null || whole(end.lastDurableMediaEndMs, 0));
  if (!valid || !facts.cameras.some((camera) => camera.deviceId === deviceId && (camera.ended ?? null) === null)) return facts;
  const ended: SessionCameraEnd = { reason: end.reason, at: end.at, lastDurableFragmentIndex: end.lastDurableFragmentIndex, lastDurableMediaEndMs: end.lastDurableMediaEndMs };
  return { ...facts, cameras: facts.cameras.map((camera) => (camera.deviceId === deviceId && (camera.ended ?? null) === null ? { ...camera, ended } : camera)) };
}

export interface SessionCaptureFacts {
  readonly version: typeof SESSION_CAPTURE_FACTS_VERSION;
  readonly sessionId: string;
  /** `recorded_at` of the session's `session_capture_sources` rows (epoch ms). */
  readonly startRecordedAt: number;
  /**
   * Row 148 (D128, R153-1): the session was recorded under the camera-microphone pairing (capture protocol 6, D5):
   * the seal then states every pair, also when NO microphone recorded (no `AUDIO-0N` row exists). Written `true` by
   * every start of a protocol-6 Core; absent in a file written before (read as "not stated").
   */
  readonly pairedAudio?: true;
  readonly cameras: readonly SessionCameraFacts[];
}

export function sessionCaptureFactsPath(mediaStoreDir: string, sessionId: string): string {
  if (!SESSION_ID.test(sessionId)) throw new Error('the session ID is not one a facts file is kept for');
  return join(mediaStoreDir, SESSION_CAPTURE_FACTS_FOLDER, `${sessionId}.json`);
}

/** Replaces the facts file of a session atomically. The folder must exist. */
export async function writeSessionCaptureFacts(path: string, facts: SessionCaptureFacts): Promise<void> {
  const staging = `${path}.next`;
  await rm(staging, { force: true });
  const handle = await open(staging, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(facts), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(staging, path);
}

/** The facts a text holds, or null when it is not a facts file of this form. Nothing is repaired. */
export function parseSessionCaptureFacts(text: string): SessionCaptureFacts | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof json !== 'object' || json === null) return null;
  const file = json as Record<string, unknown>;
  if (file['version'] !== SESSION_CAPTURE_FACTS_VERSION || typeof file['sessionId'] !== 'string' || !SESSION_ID.test(file['sessionId']) || !whole(file['startRecordedAt'], 0) || !Array.isArray(file['cameras'])) return null;
  const cameras: SessionCameraFacts[] = [];
  for (const entry of file['cameras'] as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null;
    const camera = entry as Record<string, unknown>;
    const { trackId, deviceId, clockOffsetMs, firstVideo } = camera;
    // The two members of tidy pass F-Y are absent in a file written before it: read as null. Present, they must be of their form.
    const measured = camera['measuredClockOffsetMs'] ?? null;
    const syncLevel = camera['syncLevel'] ?? null;
    if (measured !== null && !(typeof measured === 'number' && Number.isSafeInteger(measured))) return null;
    if (syncLevel !== null && !SYNC_LEVELS.includes(syncLevel as CaptureSyncLevel)) return null;
    // Row 148: absent in a file written before it (read as "its channel was recorded"). Present, one of the protocol's words.
    const micMissing = camera['micMissing'] ?? null;
    if (micMissing !== null && !(CAPTURE_PAIRED_MIC_MISSING_REASONS as readonly unknown[]).includes(micMissing)) return null;
    if (typeof trackId !== 'string' || !TRACK_IDS.includes(trackId) || typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) return null;
    if (clockOffsetMs !== null && !(typeof clockOffsetMs === 'number' && Number.isSafeInteger(clockOffsetMs))) return null;
    // The member of fix wave H (C3) is absent in a file written before it: read as "not given up". Present, it must be of its form.
    let ended: SessionCameraEnd | null = null;
    const rawEnd = camera['ended'] ?? null;
    if (rawEnd !== null) {
      if (typeof rawEnd !== 'object') return null;
      const end = rawEnd as Record<string, unknown>;
      const index = end['lastDurableFragmentIndex'] ?? null;
      const mediaEnd = end['lastDurableMediaEndMs'] ?? null;
      if (typeof end['reason'] !== 'string' || !END_REASON.test(end['reason']) || !whole(end['at'], 0) || (index !== null && !whole(index, 1)) || (mediaEnd !== null && !whole(mediaEnd, 0))) return null;
      ended = { reason: end['reason'], at: end['at'], lastDurableFragmentIndex: index as number | null, lastDurableMediaEndMs: mediaEnd as number | null };
    }
    let first: SessionCameraFacts['firstVideo'] = null;
    if (firstVideo !== null) {
      if (typeof firstVideo !== 'object' || firstVideo === undefined) return null;
      const video = firstVideo as Record<string, unknown>;
      const skipped = video['skipped'];
      if (!whole(video['pts'], 0) || !whole(video['timescale'], 1) || !whole(video['heldMs'], 0) || !whole(video['skippedSpanMs'], 0) || typeof skipped !== 'object' || skipped === null) return null;
      const counts: Record<string, number> = {};
      for (const [reason, count] of Object.entries(skipped as Record<string, unknown>)) {
        if (!whole(count, 0)) return null;
        counts[reason] = count;
      }
      first = { pts: video['pts'], timescale: video['timescale'], heldMs: video['heldMs'], skipped: counts, skippedSpanMs: video['skippedSpanMs'] };
    }
    cameras.push({ trackId, deviceId, clockOffsetMs: clockOffsetMs as number | null, measuredClockOffsetMs: measured as number | null, syncLevel: syncLevel as CaptureSyncLevel | null, ...(ended === null ? {} : { ended }), ...(micMissing === null ? {} : { micMissing: micMissing as CapturePairedMicMissingReason }), firstVideo: first });
  }
  // Row 148 (D128): absent in a file written before it. Present, it is `true` and nothing else.
  const pairedAudio = file['pairedAudio'] ?? null;
  if (pairedAudio !== null && pairedAudio !== true) return null;
  return { version: SESSION_CAPTURE_FACTS_VERSION, sessionId: file['sessionId'], startRecordedAt: file['startRecordedAt'], ...(pairedAudio === true ? { pairedAudio: true as const } : {}), cameras };
}

/**
 * The facts file of a session. Null when there is none (a session recorded before this row, or one
 * whose capture never began). THROWS for a file that is there and cannot be read as this form: a
 * seal does not start on a session record it can read only half of.
 */
export async function readSessionCaptureFacts(mediaStoreDir: string, sessionId: string): Promise<SessionCaptureFacts | null> {
  const path = sessionCaptureFactsPath(mediaStoreDir, sessionId);
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error('the capture facts of the session could not be read', { cause: error });
  }
  const facts = text.length > FACTS_FILE_MAX_BYTES ? null : parseSessionCaptureFacts(text);
  if (facts === null || facts.sessionId !== sessionId) throw new Error('the capture facts of the session are not of the form this Core writes');
  return facts;
}

/**
 * REMOVES THE FACTS FILE OF A SESSION (fix wave H driver A; gate 89 finding G89-07 = R88-27 live).
 * The file is needed until the manifest of the session is signed and stored: from then on the
 * inputs of the manifest are frozen in the seal's own checkpoint (R88-03) and nothing reads the
 * file again - left behind, it would lie beside the facts of the NEXT session of that ID after a
 * reset. Called by the sealing host on a SEALED outcome, never for a FAILED or a pending seal
 * (their next run reads it), and by nothing while a capture runs. True when a file was removed.
 * A name that is not a regular file is not removed: it throws, as a read of it would.
 */
export async function removeSessionCaptureFacts(mediaStoreDir: string, sessionId: string): Promise<boolean> {
  const path = sessionCaptureFactsPath(mediaStoreDir, sessionId);
  let facts;
  try {
    facts = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new Error('the capture facts of the session could not be examined', { cause: error });
  }
  if (!facts.isFile()) throw new Error('the capture facts name of the session is no regular file: it is not removed');
  await rm(path);
  return true;
}

/**
 * THE VIDEO SAMPLE ENTRY OF A SESSION'S CAMERA FILE (integration pass D9; manifest field 43): read
 * from the file's own init segment, never from the plan. The RECORDING file
 * `<package folder>/VIDEO-0n.mp4` is asked first; when it is gone (the last sealing step removes
 * it once the item is committed) the SEALED camera file of the package is asked - its init segment
 * is the same bytes, in the clear (ev §A.3), so a resumed seal reads the same answer.
 *
 * Null when neither file is there. A name that is a link or no regular file is not opened. Reads
 * box headers and the `moov` only: no media, no key.
 */
export async function readSessionVideoSampleEntry(packageDir: string, trackId: PackageVideoTrackId): Promise<VideoSampleEntryRead | null> {
  for (const path of [join(packageDir, cameraFileName(trackId)), join(packageDir, ...cameraFilePath(trackId).split('/'))]) {
    let handle: FileHandle;
    try {
      handle = await open(path, FS.O_RDONLY | FS.O_NOFOLLOW);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new Error('a camera file of the session could not be opened', { cause: error });
    }
    try {
      const facts = await handle.stat();
      if (!facts.isFile()) throw new Error('a camera file name that is no regular file');
      return await videoSampleEntryOf({
        size: facts.size,
        read: async (offset, length) => {
          const buffer = Buffer.alloc(length);
          let done = 0;
          while (done < length) {
            const { bytesRead } = await handle.read(buffer, done, length - done, offset + done);
            if (bytesRead === 0) break;
            done += bytesRead;
          }
          return new Uint8Array(buffer.buffer, buffer.byteOffset, done);
        },
      });
    } finally {
      await handle.close();
    }
  }
  return null;
}

/**
 * WHAT THE VIDEO STREAM OF A SESSION'S CAMERA FILE DECLARES (fix wave K, driver S1; G89b-01, ruling
 * D222 (2); fix 151; manifest field 36): picture size and nominal frame rate, read from the init
 * segment of the file itself (`videoStreamFormatOf`). Asked like the sample entry: the RECORDING
 * file first, then the SEALED camera file - its init segment is the same bytes in the clear, so
 * both give the same answer (no fragment is read).
 * Null when neither file is there or the init segment names no picture size. No media byte, no key.
 */
export async function readSessionVideoFormat(packageDir: string, trackId: PackageVideoTrackId): Promise<VideoStreamFormat | null> {
  for (const path of [join(packageDir, cameraFileName(trackId)), join(packageDir, ...cameraFilePath(trackId).split('/'))]) {
    let handle: FileHandle;
    try {
      handle = await open(path, FS.O_RDONLY | FS.O_NOFOLLOW);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new Error('a camera file of the session could not be opened', { cause: error });
    }
    try {
      const facts = await handle.stat();
      if (!facts.isFile()) throw new Error('a camera file name that is no regular file');
      return await videoStreamFormatOf({
        size: facts.size,
        read: async (offset, length) => {
          const buffer = Buffer.alloc(length);
          let done = 0;
          while (done < length) {
            const { bytesRead } = await handle.read(buffer, done, length - done, offset + done);
            if (bytesRead === 0) break;
            done += bytesRead;
          }
          return new Uint8Array(buffer.buffer, buffer.byteOffset, done);
        },
      });
    } finally {
      await handle.close();
    }
  }
  return null;
}
