/**
 * Removal of ONE package folder of the evidence store (decision D133 (2); `dbc-4` §N.10; D98(1)).
 *
 * A permitted reset erases the item row of a development package. Its folder would then have no
 * exempt row, read as unprovable, and block the next reset (the "orphan" of row 141). So the reset
 * removes the folders it cleared - and this file is the only place of the routine that removes
 * anything from a disk. It decides nothing about WHICH folder: the caller hands in a directory
 * name the guard itself judged exempt (`real-evidence.ts`, `removeClearedDevelopmentPackages`).
 * What this file holds is WHERE a removal may happen:
 *
 *   1. the name is one path segment of the package form `SESSION-<sessionId>` - no separator, no
 *      `..`, no other folder of the store (a live session directory is named after the session
 *      alone and is never a candidate);
 *   2. the entry is a real directory, not a symbolic link (a link is never followed);
 *   3. CONTAINMENT: the resolved path of the entry is a direct child of the resolved path of the
 *      configured store root, under the name that was asked for. A root or an entry that resolves
 *      elsewhere is refused.
 *
 * Every refusal is a code and removes nothing. This file reads no file: it asks the file system
 * what an entry IS, and removes a directory.
 */
import { lstatSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** The directory name of a sealed package: `SESSION-` and a session folder name (`ev` §A.1). */
export const REMOVABLE_PACKAGE_DIRECTORY = /^SESSION-[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

export const PackageRemovalRefusal = {
  /** The name is not one package directory name. */
  NAME_NOT_A_PACKAGE: 'NAME_NOT_A_PACKAGE',
  /** The store root cannot be resolved. */
  ROOT_UNRESOLVED: 'ROOT_UNRESOLVED',
  /** The entry does not exist or cannot be examined. */
  ENTRY_UNRESOLVED: 'ENTRY_UNRESOLVED',
  /** The entry is a symbolic link or not a directory. */
  NOT_A_DIRECTORY: 'NOT_A_DIRECTORY',
  /** The entry resolves outside the store root, or under another name. */
  OUTSIDE_STORE_ROOT: 'OUTSIDE_STORE_ROOT',
  /** The file system refused the removal. */
  REMOVE_FAILED: 'REMOVE_FAILED',
} as const;
export type PackageRemovalRefusal = (typeof PackageRemovalRefusal)[keyof typeof PackageRemovalRefusal];

export type PackageRemoval = { readonly removed: true } | { readonly removed: false; readonly refusal: PackageRemovalRefusal };

/** Removes one package directory below a store root. */
export type PackageFolderRemover = (storeRoot: string, directory: string) => PackageRemoval;

const refused = (refusal: PackageRemovalRefusal): PackageRemoval => Object.freeze({ removed: false, refusal });

/**
 * Removes `<storeRoot>/<directory>` with everything in it, when - and only when - the three rules
 * of the header hold. Never throws: a refusal is its answer.
 */
export const removePackageFolder: PackageFolderRemover = (storeRoot, directory) => {
  if (!REMOVABLE_PACKAGE_DIRECTORY.test(directory)) return refused(PackageRemovalRefusal.NAME_NOT_A_PACKAGE);
  let root: string;
  try {
    root = realpathSync(storeRoot);
  } catch {
    return refused(PackageRemovalRefusal.ROOT_UNRESOLVED);
  }
  const entry = join(root, directory);
  let resolved: string;
  try {
    const found = lstatSync(entry);
    if (found.isSymbolicLink() || !found.isDirectory()) return refused(PackageRemovalRefusal.NOT_A_DIRECTORY);
    resolved = realpathSync(entry);
  } catch {
    return refused(PackageRemovalRefusal.ENTRY_UNRESOLVED);
  }
  // CONTAINMENT: a direct child of the store root, under the name that was asked for.
  if (dirname(resolved) !== root || basename(resolved) !== directory) return refused(PackageRemovalRefusal.OUTSIDE_STORE_ROOT);
  try {
    rmSync(resolved, { recursive: true, force: false });
  } catch {
    return refused(PackageRemovalRefusal.REMOVE_FAILED);
  }
  return Object.freeze({ removed: true });
};

/** A name in the quarantine folder of a store that is one session's: `<store root>/.quarantine/<sessionId>`. */
export const REMOVABLE_QUARANTINE_DIRECTORY = /^SES-[0-9]{8}-[0-9]{4}$/;

/**
 * Removes ONE session folder of the quarantine of a store (fix wave I driver A1; G75b-01): the
 * containment rule of `removePackageFolder`, one level down - the quarantine folder is a real
 * directory directly below the resolved store root, the entry a real directory directly below it
 * under the name asked for. A link anywhere is refused; nothing outside is touched.
 */
export function removeQuarantineFolder(storeRoot: string, quarantineDirectory: string, sessionId: string): PackageRemoval {
  if (!REMOVABLE_QUARANTINE_DIRECTORY.test(sessionId)) return refused(PackageRemovalRefusal.NAME_NOT_A_PACKAGE);
  let quarantine: string;
  try {
    const root = realpathSync(storeRoot);
    const found = lstatSync(join(root, quarantineDirectory));
    if (found.isSymbolicLink() || !found.isDirectory()) return refused(PackageRemovalRefusal.NOT_A_DIRECTORY);
    quarantine = realpathSync(join(root, quarantineDirectory));
    if (dirname(quarantine) !== root || basename(quarantine) !== quarantineDirectory) return refused(PackageRemovalRefusal.OUTSIDE_STORE_ROOT);
  } catch {
    return refused(PackageRemovalRefusal.ROOT_UNRESOLVED);
  }
  const entry = join(quarantine, sessionId);
  let resolved: string;
  try {
    const found = lstatSync(entry);
    if (found.isSymbolicLink() || !found.isDirectory()) return refused(PackageRemovalRefusal.NOT_A_DIRECTORY);
    resolved = realpathSync(entry);
  } catch {
    return refused(PackageRemovalRefusal.ENTRY_UNRESOLVED);
  }
  if (dirname(resolved) !== quarantine || basename(resolved) !== sessionId) return refused(PackageRemovalRefusal.OUTSIDE_STORE_ROOT);
  try {
    rmSync(resolved, { recursive: true, force: false });
  } catch {
    return refused(PackageRemovalRefusal.REMOVE_FAILED);
  }
  return Object.freeze({ removed: true });
}
