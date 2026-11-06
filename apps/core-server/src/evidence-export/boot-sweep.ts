/**
 * THE BOOT SWEEP of interrupted exports (fix pass F-M8; review finding R93-04, ruling D178).
 *
 * An export writes its archive under `export/EXP-<id>.zip.partial` (and a composite under
 * `EXP-<id>.composite.partial`) - DECRYPTED evidence - and gives the files their names last. A
 * run that throws removes its partials itself; a PROCESS THAT DIES during an export cannot. Export
 * IDs never repeat, so nothing would ever remove such a file again. This sweep does, once, at the
 * start of the Core:
 *
 *   for every package folder `SESSION-<id>` directly under the media store root,
 *     for every REGULAR FILE directly in its `export/` folder whose name ends in `.partial`:
 *       remove it.
 *
 * CONTAINMENT. Only names read from a directory listing are used - never a value of a request or a
 * row. A package folder and its `export/` folder must be REAL directories: a symbolic link in
 * either place is not followed and nothing behind it is touched (it is reported as `skipped`).
 * A `.partial` entry that is no regular file (a link, a folder) is not removed either: `unlink`
 * of a link would not follow it, but an entry of an unexpected kind is something an operator
 * should see, not something to tidy away. Nothing outside `<root>/SESSION-<id>/export/` is opened,
 * listed or removed, and no file that does not end in `.partial` is touched.
 *
 * Pure of the app: a root in, what was removed out. It logs nothing; names and IDs only.
 */
import { lstat, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { EXPORT_ID_PATTERN } from '@dems/shared/api';
import { PACKAGE_FOLDER_PREFIX, PackageFile } from '@dems/shared/evidence-package';

export const EXPORT_PARTIAL_SUFFIX = '.partial';

export interface SweptPartial {
  /** The session ID of the package folder (`SESSION-<this>`). */
  readonly sessionId: string;
  /** The file name inside `export/`. */
  readonly file: string;
  /** `EXP-NNNNNN` when the name starts with one, else null. */
  readonly exportId: string | null;
  /** True for the partial of a composite (`EXP-<id>.composite.partial`). */
  readonly composite: boolean;
}

export interface ExportSweepResult {
  readonly removed: readonly SweptPartial[];
  /** Entries that were NOT touched, each with why (a code): a link where a folder belongs, a `.partial` that is no regular file, a file that could not be removed. */
  readonly skipped: readonly { readonly sessionId: string | null; readonly entry: string; readonly reason: 'PACKAGE_FOLDER_NOT_A_DIRECTORY' | 'EXPORT_FOLDER_NOT_A_DIRECTORY' | 'PARTIAL_NOT_A_REGULAR_FILE' | 'REMOVE_FAILED' }[];
}

const codeOf = (error: unknown): string | undefined => (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined);

/** `EXP-NNNNNN` at the start of a partial's name, or null. */
function exportIdOfPartial(name: string): string | null {
  const head = name.slice(0, 'EXP-000000'.length);
  return EXPORT_ID_PATTERN.test(head) && name.charAt(head.length) === '.' ? head : null;
}

/** Removes every `.partial` export artefact under every package folder of `mediaStoreDir`. A root that does not exist holds nothing. */
export async function sweepExportPartials(mediaStoreDir: string): Promise<ExportSweepResult> {
  const removed: SweptPartial[] = [];
  const skipped: ExportSweepResult['skipped'][number][] = [];
  let folders: import('node:fs').Dirent[];
  try {
    folders = await readdir(mediaStoreDir, { withFileTypes: true });
  } catch (error) {
    if (codeOf(error) === 'ENOENT' || codeOf(error) === 'ENOTDIR') return { removed, skipped };
    throw error;
  }
  for (const folder of folders.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (!folder.name.startsWith(PACKAGE_FOLDER_PREFIX)) continue;
    const sessionId = folder.name.slice(PACKAGE_FOLDER_PREFIX.length);
    // A directory entry of a listing is never followed: a link reads as a link here.
    if (!folder.isDirectory()) {
      skipped.push({ sessionId, entry: folder.name, reason: 'PACKAGE_FOLDER_NOT_A_DIRECTORY' });
      continue;
    }
    const exportDir = join(mediaStoreDir, folder.name, PackageFile.EXPORT_DIR);
    let facts: import('node:fs').Stats;
    try {
      facts = await lstat(exportDir);
    } catch (error) {
      if (codeOf(error) === 'ENOENT') continue;
      throw error;
    }
    if (!facts.isDirectory()) {
      skipped.push({ sessionId, entry: `${folder.name}/${PackageFile.EXPORT_DIR}`, reason: 'EXPORT_FOLDER_NOT_A_DIRECTORY' });
      continue;
    }
    const entries = await readdir(exportDir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (!entry.name.endsWith(EXPORT_PARTIAL_SUFFIX)) continue;
      if (!entry.isFile()) {
        skipped.push({ sessionId, entry: entry.name, reason: 'PARTIAL_NOT_A_REGULAR_FILE' });
        continue;
      }
      try {
        await unlink(join(exportDir, entry.name));
      } catch (error) {
        if (codeOf(error) !== 'ENOENT') skipped.push({ sessionId, entry: entry.name, reason: 'REMOVE_FAILED' });
        continue;
      }
      removed.push({ sessionId, file: entry.name, exportId: exportIdOfPartial(entry.name), composite: entry.name.includes('.composite.') });
    }
  }
  return { removed, skipped };
}
