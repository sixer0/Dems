/**
 * WHAT THE CAPTURE SIDE KNOWS OF A SESSION AND THE SEAL NEEDS (blueprint row 71c, decision D153;
 * evidence package spec §B.4 field 40, §B.12 fields 127 / 128, erratum PE-124-12; decisions D66
 * (4b), D72 (e), D72 (g), D147).
 *
 *   clockOffsetMs   per camera: the camera clock minus the Core clock as the camera's adapter
 *                   reported it at the start of the capture (`CameraAdapter.ntpOffsetMs`); null
 *                   when the adapter reported none;
 *   firstVideo      per camera file: the worker's `FIRST_VIDEO_SAMPLE` record of the LAST worker of
 *                   the session - `pts` and `timescale` (fields 127 / 128), and what arrived before
 *                   the first written sample (`heldMs`, `skipped`, `skippedSpanMs`: the manifest
 *                   has NO field for these three; they are kept here and in the log).
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
 * WHOSE FILE IT IS. A reset starts the session counter again, so a session ID can be used twice.
 * The file says `startRecordedAt`: the instant of the session's four `session_capture_sources`
 * rows. A reader holds it against those rows and ignores a file of another session of that ID.
 */
import { constants as FS } from 'node:fs';
import { open, readFile, rename, rm, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { cameraFileName, cameraFilePath, type PackageVideoTrackId } from '@dems/shared/evidence-package';
import { videoSampleEntryOf, type VideoSampleEntryRead } from '../capture';

export const SESSION_CAPTURE_FACTS_FOLDER = '.capture-session';
export const SESSION_CAPTURE_FACTS_VERSION = 1;
/** A facts file larger than this is not one. */
const FACTS_FILE_MAX_BYTES = 16_384;

const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const TRACK_IDS: readonly string[] = ['VIDEO-01', 'VIDEO-02'];
const DEVICE_ID = /^[A-Z][A-Z0-9]{1,15}-[0-9]{2,4}$/;

export interface SessionCameraFacts {
  readonly trackId: string;
  readonly deviceId: string;
  /** The camera clock minus the Core clock, in whole ms; null: the adapter reported none. */
  readonly clockOffsetMs: number | null;
  /** The worker's `FIRST_VIDEO_SAMPLE` of this camera file; null: no such record arrived. */
  readonly firstVideo: {
    readonly pts: number;
    readonly timescale: number;
    readonly heldMs: number;
    readonly skipped: Readonly<Record<string, number>>;
    readonly skippedSpanMs: number;
  } | null;
}

export interface SessionCaptureFacts {
  readonly version: typeof SESSION_CAPTURE_FACTS_VERSION;
  readonly sessionId: string;
  /** `recorded_at` of the session's `session_capture_sources` rows (epoch ms). */
  readonly startRecordedAt: number;
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

const whole = (value: unknown, min: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min;

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
    if (typeof trackId !== 'string' || !TRACK_IDS.includes(trackId) || typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) return null;
    if (clockOffsetMs !== null && !(typeof clockOffsetMs === 'number' && Number.isSafeInteger(clockOffsetMs))) return null;
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
    cameras.push({ trackId, deviceId, clockOffsetMs: clockOffsetMs as number | null, firstVideo: first });
  }
  return { version: SESSION_CAPTURE_FACTS_VERSION, sessionId: file['sessionId'], startRecordedAt: file['startRecordedAt'], cameras };
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
