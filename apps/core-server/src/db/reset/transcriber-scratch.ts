/**
 * The transcriber scratch of the sessions a reset clears (code review row 80, finding R80-04).
 *
 * WHY. A reset erases the sessions of a database and their IDs are given out again. The folder
 * `<mediaStoreRoot>/.transcriber/sessions/<sessionId>` of an erased session - its raw, UNENCRYPTED PCM tap
 * if the session was never sealed, a checkpoint of another recording - would then belong to the
 * next session of that ID: the capture worker refuses a start whose tap path is occupied
 * (`TAP_PATH_OCCUPIED`), and a checkpoint of another audio is foreign. And raw session audio of an
 * erased session has no reason to stay on the disk.
 *
 * WHICH. The sessions of the database BEING RESET that took an STT snapshot
 * (`session_stt_config`, read at R-3 before the swap): only such a session ever had a folder.
 * Never "every folder that is there".
 *
 * PER DATABASE (fix pass F-M7c; ruling D180): the folder is below the MEDIA STORE ROOT of the
 * database being reset - the root the real-evidence guard of this reset read - never below the
 * data directory, which every lane of an installation shares: under it the reset of one database
 * removed the live scratch of another database's session of the same ID.
 *
 * WHERE - the containment rule of `package-removal.ts`, for this folder: the name is one session
 * ID, `.transcriber` and `.transcriber/sessions` are real directories, the entry is a real directory
 * (a link is never followed) and resolves to a direct child of the resolved sessions folder under
 * the name that was asked for. A refusal removes nothing and is reported; an absent folder is not
 * a refusal. Never throws.
 *
 * The reset imports no unit of the server: the two path segments are constants here, held equal
 * to the transcription unit's by the test of this file.
 */
import { lstatSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** `<mediaStoreRoot>/.transcriber/sessions`: `TRANSCRIBER_SCRATCH_FOLDER` / `TRANSCRIPTION_SESSIONS_FOLDER` of `src/transcription`. */
export const TRANSCRIBER_SCRATCH_SUBPATH = ['.transcriber', 'sessions'] as const;

/** The sessions of a database that took an STT snapshot: the only ones that can have a scratch folder. Read on the owner connection at R-3. */
export const READ_CLEARED_TRANSCRIBER_SESSIONS = 'SELECT session_id::text AS session_id FROM public.session_stt_config ORDER BY session_id';

const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;

export type TranscriberScratchKeptReason = 'SESSION_ID_INVALID' | 'ROOT_NOT_A_DIRECTORY' | 'NOT_A_DIRECTORY' | 'OUTSIDE_SESSIONS_FOLDER' | 'REMOVE_FAILED';

export interface TranscriberScratchRemoval {
  /** Session IDs whose folder was removed, in the order asked. */
  readonly removed: readonly string[];
  /** Session IDs whose folder is there and was NOT removed, each with its reason. */
  readonly kept: readonly { readonly sessionId: string; readonly reason: TranscriberScratchKeptReason }[];
}

/** `storeRoot`: the media store root of the database being reset. */
export function removeTranscriberScratchOf(storeRoot: string, sessionIds: readonly string[]): TranscriberScratchRemoval {
  const removed: string[] = [];
  const kept: { sessionId: string; reason: TranscriberScratchKeptReason }[] = [];
  let root: string | null = null;
  let rootRefused = false;
  try {
    let path = storeRoot;
    for (const segment of TRANSCRIBER_SCRATCH_SUBPATH) {
      path = join(path, segment);
      const found = lstatSync(path);
      if (found.isSymbolicLink() || !found.isDirectory()) rootRefused = true;
    }
    if (!rootRefused) root = realpathSync(path);
  } catch (error) {
    // No transcriber folder at all: nothing to remove. Anything else: nothing is removed, and it is said.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { removed, kept };
    rootRefused = true;
  }
  for (const sessionId of sessionIds) {
    if (!SESSION_ID.test(sessionId)) {
      kept.push({ sessionId, reason: 'SESSION_ID_INVALID' });
      continue;
    }
    if (root === null) {
      kept.push({ sessionId, reason: 'ROOT_NOT_A_DIRECTORY' });
      continue;
    }
    const entry = join(root, sessionId);
    let resolved: string;
    try {
      const found = lstatSync(entry);
      if (found.isSymbolicLink() || !found.isDirectory()) {
        kept.push({ sessionId, reason: 'NOT_A_DIRECTORY' });
        continue;
      }
      resolved = realpathSync(entry);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') kept.push({ sessionId, reason: 'NOT_A_DIRECTORY' });
      continue;
    }
    if (dirname(resolved) !== root || basename(resolved) !== sessionId) {
      kept.push({ sessionId, reason: 'OUTSIDE_SESSIONS_FOLDER' });
      continue;
    }
    try {
      rmSync(resolved, { recursive: true, force: false });
      removed.push(sessionId);
    } catch {
      kept.push({ sessionId, reason: 'REMOVE_FAILED' });
    }
  }
  return { removed, kept };
}
