/**
 * THE REMOVAL OF A SESSION'S TRANSCRIBER SCRATCH (code review row 80, finding R80-04; decision
 * D-77-1; pair-77 navigator: "all of it must be removed when the session is sealed or abandoned").
 *
 * WHAT IS IN IT. `<mediaStoreRoot>/.transcriber/sessions/<sessionId>/` (per database, ruling D180) holds the PCM tap of the session
 * (`tap.pcm`: its whole audio, raw), the chunk files of a step under way (`work/`), the checkpoint
 * and the three assembled transcript files. THE TAP AND THE CHUNK FILES ARE PLAINTEXT SESSION AUDIO
 * ON DISK while the session records and until its seal completes - mode 0600 in a 0700 folder,
 * and not encrypted. That is the same class of limitation as the plaintext camera recordings of a
 * session before its seal (decision D147); this file does not change it, it ends it: once the
 * package is stored nothing of the folder is needed (the sealed transcript is in the package), and
 * all of it is removed.
 *
 * WHEN (the callers):
 *   the seal stored the package   `sealing-host`, on the SEALED outcome - a normal seal, an
 *                                 interrupted one, and a run a process start finished;
 *   a failed start                `session-run.ts`, `end(recorded: false)`;
 *   a start of the Core           `sealing-host`'s boot step: every folder whose session is sealed
 *                                 already (a Core that died between the commit and this removal);
 *   a reset                       `db/reset` removes the folders of the sessions it clears with
 *                                 its own copy of the containment rule (it imports no unit).
 *
 * WHERE - THE CONTAINMENT RULE. Never throws; a refusal is a code and removes nothing:
 *   1. the session ID has the form of one (`SES-<8 digits>-<4 digits>`): one path segment;
 *   2. `<mediaStoreRoot>/.transcriber` and its `sessions` folder are real directories, not links;
 *   3. the entry is a real directory, not a link (A LINK IS NEVER FOLLOWED), and resolves to a
 *      direct child of the resolved sessions folder under the name that was asked for;
 *   4. a link INSIDE the folder is unlinked, never followed (the rule of a recursive removal).
 * A folder that is not there is `ABSENT`: the removal is idempotent.
 */
import { chmodSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { TRANSCRIPTION_SESSIONS_FOLDER, transcriberScratchRoot } from './host';

const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;

export const ScratchRemovalRefusal = {
  /** No folder of that session: nothing to remove. */
  ABSENT: 'ABSENT',
  SESSION_ID_INVALID: 'SESSION_ID_INVALID',
  /** `<mediaStoreRoot>/.transcriber` or its `sessions` folder is a link or not a directory. */
  ROOT_NOT_A_DIRECTORY: 'ROOT_NOT_A_DIRECTORY',
  /** The entry is a link or not a directory. */
  NOT_A_DIRECTORY: 'NOT_A_DIRECTORY',
  /** The entry resolves outside the sessions folder, or under another name. */
  OUTSIDE_SESSIONS_FOLDER: 'OUTSIDE_SESSIONS_FOLDER',
  /** The file system refused the removal. */
  REMOVE_FAILED: 'REMOVE_FAILED',
} as const;
export type ScratchRemovalRefusal = (typeof ScratchRemovalRefusal)[keyof typeof ScratchRemovalRefusal];

export type ScratchRemoval = { readonly removed: true } | { readonly removed: false; readonly refusal: ScratchRemovalRefusal };

const refused = (refusal: ScratchRemovalRefusal): ScratchRemoval => ({ removed: false, refusal });

/** The resolved sessions folder, when it and its parent are real directories; `absent` when there is none; null when one of them is a link or no directory. */
function sessionsRoot(mediaStoreDir: string): string | 'absent' | null {
  const root = transcriberScratchRoot(mediaStoreDir);
  try {
    for (const path of [root, join(root, TRANSCRIPTION_SESSIONS_FOLDER)]) {
      const found = lstatSync(path);
      if (found.isSymbolicLink() || !found.isDirectory()) return null;
    }
    return realpathSync(join(root, TRANSCRIPTION_SESSIONS_FOLDER));
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'absent' : null;
  }
}

/** Removes `<mediaStoreRoot>/.transcriber/sessions/<sessionId>` with everything in it, by the containment rule of the header. Never throws. */
export function removeSessionScratch(mediaStoreDir: string, sessionId: string): ScratchRemoval {
  if (!SESSION_ID.test(sessionId)) return refused(ScratchRemovalRefusal.SESSION_ID_INVALID);
  const root = sessionsRoot(mediaStoreDir);
  if (root === 'absent') return refused(ScratchRemovalRefusal.ABSENT);
  if (root === null) return refused(ScratchRemovalRefusal.ROOT_NOT_A_DIRECTORY);
  const entry = join(root, sessionId);
  let resolved: string;
  try {
    const found = lstatSync(entry);
    if (found.isSymbolicLink() || !found.isDirectory()) return refused(ScratchRemovalRefusal.NOT_A_DIRECTORY);
    resolved = realpathSync(entry);
  } catch (error) {
    return refused((error as NodeJS.ErrnoException).code === 'ENOENT' ? ScratchRemovalRefusal.ABSENT : ScratchRemovalRefusal.NOT_A_DIRECTORY);
  }
  if (dirname(resolved) !== root || basename(resolved) !== sessionId) return refused(ScratchRemovalRefusal.OUTSIDE_SESSIONS_FOLDER);
  try {
    rmSync(resolved, { recursive: true, force: false });
  } catch {
    return refused(ScratchRemovalRefusal.REMOVE_FAILED);
  }
  return { removed: true };
}

/** The session IDs that have a scratch folder (real directories of the ID form only), in name order. Never throws. */
export function listSessionScratch(mediaStoreDir: string): string[] {
  const root = sessionsRoot(mediaStoreDir);
  if (root === null || root === 'absent') return [];
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && SESSION_ID.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * MAKES THE SCRATCH FOLDER OF A SESSION, OWNER-ONLY (fix pass F-M7c, item 2): `.transcriber`, its
 * `sessions` folder and the session's folder are created 0700, and a folder this call finds there
 * with a bit for group or others is closed again - the raw audio tap is written into it. The media
 * store root itself is never made here (the boot check of the capture unit makes and judges it).
 * Throws what the file system throws: the caller records without a tap and says so.
 */
export function ensureSessionScratch(mediaStoreDir: string, sessionId: string): string {
  if (!SESSION_ID.test(sessionId)) throw new Error('a scratch folder is asked for a session ID');
  const root = transcriberScratchRoot(mediaStoreDir);
  const folder = join(root, TRANSCRIPTION_SESSIONS_FOLDER, sessionId);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  for (const path of [root, join(root, TRANSCRIPTION_SESSIONS_FOLDER), folder]) {
    const found = lstatSync(path);
    if (found.isDirectory() && (found.mode & 0o077) !== 0) chmodSync(path, 0o700);
  }
  return folder;
}
