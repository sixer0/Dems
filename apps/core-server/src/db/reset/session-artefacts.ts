/**
 * THE PER-SESSION ARTEFACTS OF THE SESSIONS A RESET CLEARS, OUTSIDE THE DATABASE (fix wave H driver
 * A; gate 89 findings G89-06 = R88-12 live, G89-07 = R88-27 live; ruling D199).
 *
 * WHY. A reset erases the sessions of a database and their IDs are given out again. Three things
 * of an erased session are kept under its ID outside the database, and each would then belong to
 * the NEXT session of that ID:
 *
 *   its session key      `<dataDir>/credential-store/session-keys-<scope>/KID-<sessionId>.key`
 *                        Gate 89: `KID-SES-20261010-0024` sealed three different recordings in
 *                        one day, over three database epochs. Capture spec §D.2: "one random key
 *                        per session, no reuse". A reset DESTROYS the key of every session it
 *                        clears: what that key sealed is unreadable from then on - which is what
 *                        erasing the session means - and the next session of the ID gets a new one;
 *   its capture facts    `<mediaStoreRoot>/.capture-session/<sessionId>.json` (clock offsets,
 *                        first video samples: `capture-session/facts.ts`);
 *   its sealing staging  `<mediaStoreRoot>/.sealing/<sessionId>/` (the working folder of a seal
 *                        that did not finish).
 *
 * The package folder `SESSION-<id>` and the transcriber scratch are removed by their own files
 * (`package-removal.ts`, `transcriber-scratch.ts`). The QUARANTINE (`.quarantine/<sessionId>`) is
 * not touched here: the real-evidence guard lists it and decides about it.
 *
 * WHICH. The sessions of the database BEING RESET that can have such an artefact, read at R-3
 * before the swap (`READ_CLEARED_ARTEFACT_SESSIONS`): every session that started a capture
 * (`session_capture_sources`), has a sealing job (`sealing_jobs`) or an evidence item
 * (`evidence_items`). Never "every file that is there". MINUS the sessions of the demo packages the
 * same reset sealed anew: their keys were renewed by the reseed (`renewSessionKey`) and are the
 * keys of the NEW rows.
 *
 * A KEY WHOSE PACKAGE IS STILL IN THE STORE STAYS (`PACKAGE_STILL_THERE`): a package folder
 * `SESSION-<sessionId>` that the reset did not remove is reported by the package removal and blocks
 * the next reset until it is examined - and it can only be examined with its key. Fail-safe: a key
 * is destroyed only when what it sealed is gone.
 *
 * AND EVERY OTHER SESSION KEY OF THE STORE BEING RESET (fix wave I driver A1; re-gate 75 finding
 * G75b-01; ruling D216 (4)). The list above is what the database BEING RESET knows. A key of a
 * session an EARLIER reset erased - by a build that did not destroy keys yet - is known to no
 * database any more, so the rule "the sessions this reset clears" left it for ever, while the
 * session numbers start again: at re-gate 75 `KID-SES-20261010-0025.key` of 13:29 met the session
 * of that number recorded at 19:52, and its seal was refused. The two rules are made one: A RESET
 * DESTROYS EVERY SESSION KEY IN THE KEY FOLDER OF THE MEDIA STORE ROOT IT RESETS - listed by name
 * (`KID-SES-<date>-<number>.key` / `.blob`, nothing else in the folder is touched) - with the same
 * two exceptions as above: the keys of the demo packages this reset sealed anew, and a key whose
 * package folder is still in the store. The capture facts file and the sealing staging of such a
 * session go with its key. After a reset no key is left under a session ID the new database gives
 * out, unless its package folder stayed - and that folder blocks the next reset, and the START of a
 * session of that ID is refused by name (`sealing-host/session-key.ts`), before anything is
 * recorded. The keys destroyed this way are counted apart (`keysOfUnknownSessions`).
 *
 * WHEN. After the swap, as the other removals: a reset that fails keeps the old database, and its
 * packages must stay readable. It never fails a reset that has succeeded: what stays is reported.
 *
 * WHERE - the containment rule of `package-removal.ts`. A name is one session ID; the folder asked
 * in is a real, private directory (a link is never followed); the entry is a regular file (the
 * key, the facts file) or a real directory (the staging) that resolves to a direct child of the
 * resolved folder under the name asked for. A link in the place of a key file is removed as a name:
 * what it points at is never written to.
 *
 * A KEY IS DESTROYED AS THE KEY STORE DESTROYS IT (`credential-store/key-store.ts`): overwritten,
 * then removed. On a copy-on-write file system that means "the Core can no longer read it", not
 * forensic erasure. NO KEY BYTE IS READ, RETURNED OR LOGGED: the answer names key IDs (public: they
 * are in every manifest) and counts.
 *
 * The reset imports no unit of the server: the folder names and the scope rule are constants here,
 * held equal to the credential store's and the capture session's by the test of this file.
 */
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readdirSync, realpathSync, rmSync, unlinkSync, writeSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

/** `<dataDir>/credential-store`: `CREDENTIAL_STORE_FOLDER` of `src/credential-store`. */
export const RESET_CREDENTIAL_STORE_FOLDER = 'credential-store';
/** `<mediaStoreRoot>/.capture-session`: `SESSION_CAPTURE_FACTS_FOLDER` of `src/capture-session`. */
export const RESET_CAPTURE_FACTS_FOLDER = '.capture-session';
/** `<mediaStoreRoot>/.sealing`: the staging folder of the sealing host. */
export const RESET_SEALING_STAGING_FOLDER = '.sealing';

/** `SESSION-<sessionId>`: `packageFolderName` of `@dems/shared/evidence-package`. */
export const resetPackageFolderOf = (sessionId: string): string => `SESSION-${sessionId}`;

/** The folder of one Core's session keys: `sessionKeyFolderOf` of `src/credential-store` (ruling D180). */
export function resetSessionKeyFolderOf(mediaStoreRoot: string): string {
  return `session-keys-${createHash('sha256').update(`dems.session-keys/1\n${resolve(mediaStoreRoot)}`, 'utf8').digest('hex').slice(0, 32)}`;
}
/** `KID-<sessionId>`: `sessionKeyIdOf` of `src/sealing-host`. */
export const resetSessionKeyIdOf = (sessionId: string): string => `KID-${sessionId}`;

/** The sessions of a database that can have an artefact outside it. Read on the owner connection at R-3. */
export const READ_CLEARED_ARTEFACT_SESSIONS =
  'SELECT session_id::text AS session_id FROM public.session_capture_sources UNION SELECT session_id::text FROM public.sealing_jobs UNION SELECT session_id::text FROM public.evidence_items ORDER BY session_id';

const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const OVERWRITE_MAX_BYTES = 4096;

export type SessionArtefactKind = 'SESSION_KEY' | 'CAPTURE_FACTS' | 'SEALING_STAGING';
export type SessionArtefactKeptReason = 'SESSION_ID_INVALID' | 'PACKAGE_STILL_THERE' | 'FOLDER_NOT_A_DIRECTORY' | 'NOT_A_FILE' | 'NOT_A_DIRECTORY' | 'OUTSIDE_FOLDER' | 'REMOVE_FAILED';

export interface SessionArtefactRemoval {
  /** Key IDs (`KID-<sessionId>`) whose key was destroyed. */
  readonly keysDestroyed: readonly string[];
  /** Session IDs whose capture facts file was removed. */
  readonly factsRemoved: readonly string[];
  /** Session IDs whose sealing staging folder was removed. */
  readonly stagingRemoved: readonly string[];
  /**
   * The subset of `keysDestroyed` whose session the database being reset did not name: keys an
   * earlier reset left behind (fix wave I, G75b-01). Empty when `everyKey` was not asked.
   */
  readonly keysOfUnknownSessions: readonly string[];
  /** What is there and was NOT removed, each with its reason. */
  readonly kept: readonly { readonly sessionId: string; readonly kind: SessionArtefactKind; readonly reason: SessionArtefactKeptReason }[];
}

export interface SessionArtefactInput {
  /** The data directory of the installation (`<repository>/.data`): the credential store is below it. */
  readonly dataDir: string;
  /** The media store root of the database being reset - the root the guard of this reset read. */
  readonly storeRoot: string;
  /** The sessions the reset cleared. */
  readonly sessionIds: readonly string[];
  /** Sessions whose key belongs to the NEW database (the demo packages this reset sealed): never touched. */
  readonly keep?: readonly string[];
  /**
   * Fix wave I (G75b-01; D216 (4)): ALSO every other session key the key folder of this store root
   * holds (`KID-SES-…`), with the capture facts and staging of its session. What a reset asks for.
   */
  readonly everyKey?: boolean;
}

/** A session key file or its binding in the key folder: `KID-<sessionId>.key` / `.blob`. Nothing else in the folder is a session key. */
const SESSION_KEY_FILE = /^KID-(SES-[0-9]{8}-[0-9]{4})\.(?:key|blob)$/;

/** The session IDs that have a key file or a binding file in the folder, in name order. A folder that cannot be listed gives none. */
function sessionsWithAKey(folder: Folder): string[] {
  if (folder.state !== 'THERE') return [];
  try {
    const found = new Set<string>();
    for (const name of readdirSync(folder.path)) {
      const id = SESSION_KEY_FILE.exec(name)?.[1];
      if (id !== undefined) found.add(id);
    }
    return [...found].sort();
  } catch {
    return [];
  }
}

type Folder = { readonly state: 'ABSENT' } | { readonly state: 'REFUSED' } | { readonly state: 'THERE'; readonly path: string };

/** A real directory reached through real directories only; a link anywhere on the way is refused. */
function folderOf(base: string, segments: readonly string[]): Folder {
  let path = base;
  try {
    for (const segment of segments) {
      path = join(path, segment);
      const found = lstatSync(path);
      if (found.isSymbolicLink() || !found.isDirectory()) return { state: 'REFUSED' };
    }
    return { state: 'THERE', path: realpathSync(path) };
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? { state: 'ABSENT' } : { state: 'REFUSED' };
  }
}

/** Overwrites and removes one key file. A link is removed as a name; what it points at is not written to. */
function destroyFile(file: string): void {
  let handle = -1;
  try {
    handle = openSync(file, constants.O_WRONLY | constants.O_NOFOLLOW);
    const size = Math.min(fstatSync(handle).size, OVERWRITE_MAX_BYTES);
    writeSync(handle, Buffer.alloc(size), 0, size, 0);
    fsyncSync(handle);
  } catch {
    // The removal below is what makes the key unreadable to the Core.
  } finally {
    if (handle !== -1) closeSync(handle);
  }
  unlinkSync(file);
}

/** Destroys the session keys and removes the capture facts and the sealing staging of the given sessions. Never throws. */
export function removeSessionArtefactsOf(input: SessionArtefactInput): SessionArtefactRemoval {
  const keysDestroyed: string[] = [];
  const factsRemoved: string[] = [];
  const stagingRemoved: string[] = [];
  const kept: { sessionId: string; kind: SessionArtefactKind; reason: SessionArtefactKeptReason }[] = [];
  const spared = new Set(input.keep ?? []);
  const keyFolder = folderOf(resolve(input.dataDir), [RESET_CREDENTIAL_STORE_FOLDER, resetSessionKeyFolderOf(input.storeRoot)]);
  const factsFolder = folderOf(resolve(input.storeRoot), [RESET_CAPTURE_FACTS_FOLDER]);
  const stagingFolder = folderOf(resolve(input.storeRoot), [RESET_SEALING_STAGING_FOLDER]);

  /** One entry of a folder, by the containment rule. `remove` runs only for an entry that is there and is what it must be. */
  const entry = (folder: Folder, name: string, sessionId: string, kind: SessionArtefactKind, wants: 'FILE' | 'DIRECTORY', remove: (path: string) => void, done: () => void): void => {
    if (folder.state === 'ABSENT') return;
    if (folder.state === 'REFUSED') {
      kept.push({ sessionId, kind, reason: 'FOLDER_NOT_A_DIRECTORY' });
      return;
    }
    const path = join(folder.path, name);
    try {
      const found = lstatSync(path);
      if (wants === 'DIRECTORY') {
        if (found.isSymbolicLink() || !found.isDirectory()) {
          kept.push({ sessionId, kind, reason: 'NOT_A_DIRECTORY' });
          return;
        }
        const resolved = realpathSync(path);
        if (dirname(resolved) !== folder.path || basename(resolved) !== name) {
          kept.push({ sessionId, kind, reason: 'OUTSIDE_FOLDER' });
          return;
        }
      } else if (!found.isSymbolicLink() && !found.isFile()) {
        kept.push({ sessionId, kind, reason: 'NOT_A_FILE' });
        return;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') kept.push({ sessionId, kind, reason: wants === 'FILE' ? 'NOT_A_FILE' : 'NOT_A_DIRECTORY' });
      return;
    }
    try {
      remove(path);
      done();
    } catch {
      kept.push({ sessionId, kind, reason: 'REMOVE_FAILED' });
    }
  };

  const named = new Set(input.sessionIds);
  const keysOfUnknownSessions: string[] = [];
  // G75b-01: the sessions the database named, then every other session that has a key in the folder.
  const all = new Set([...named, ...(input.everyKey === true ? sessionsWithAKey(keyFolder) : [])]);
  for (const sessionId of all) {
    if (spared.has(sessionId)) continue;
    if (!SESSION_ID.test(sessionId)) {
      kept.push({ sessionId, kind: 'SESSION_KEY', reason: 'SESSION_ID_INVALID' });
      continue;
    }
    const keyId = resetSessionKeyIdOf(sessionId);
    let packageThere = true;
    try {
      lstatSync(join(resolve(input.storeRoot), resetPackageFolderOf(sessionId)));
    } catch (error) {
      packageThere = (error as NodeJS.ErrnoException).code !== 'ENOENT';
    }
    if (packageThere) {
      kept.push({ sessionId, kind: 'SESSION_KEY', reason: 'PACKAGE_STILL_THERE' });
      continue;
    }
    entry(keyFolder, `${keyId}.key`, sessionId, 'SESSION_KEY', 'FILE', destroyFile, () => {
      keysDestroyed.push(keyId);
      if (!named.has(sessionId)) keysOfUnknownSessions.push(keyId);
    });
    // The binding of the key to its session (`KID-<id>.blob`, `SessionKeys.create`) goes with the key.
    entry(keyFolder, `${keyId}.blob`, sessionId, 'SESSION_KEY', 'FILE', destroyFile, () => undefined);
    entry(factsFolder, `${sessionId}.json`, sessionId, 'CAPTURE_FACTS', 'FILE', (path) => unlinkSync(path), () => void factsRemoved.push(sessionId));
    entry(stagingFolder, sessionId, sessionId, 'SEALING_STAGING', 'DIRECTORY', (path) => rmSync(path, { recursive: true, force: false }), () => void stagingRemoved.push(sessionId));
  }
  return { keysDestroyed, keysOfUnknownSessions, factsRemoved, stagingRemoved, kept };
}
