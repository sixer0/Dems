/**
 * Writes the clear files of a sealed package (blueprint row 82; evidence package spec §A.1).
 *
 * A file of the package appears under its name whole or not at all: the bytes are written and
 * synced under a name in the STAGING folder (same volume, outside every package), renamed into
 * place, and the directory is synced. A process that dies in between leaves nothing in the
 * package folder that the package does not declare (verify V-14 fails a file nobody sealed);
 * what it leaves in the staging folder is overwritten by the next run.
 *
 * Writing the same bytes again is the resume rule of every step that writes a file.
 */
import { constants as FS } from 'node:fs';
import { copyFile, mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { syncDirectory } from './camera-files';

export interface PackageWriter {
  /** `relative` is a `/`-joined path inside the package (`PackageFile`). */
  write(relative: string, bytes: Uint8Array): Promise<void>;
  /** Copies a file from outside the package (a transcript file of the scratch directory), byte for byte. */
  copyIn(relative: string, from: string): Promise<void>;
  /** The bytes of a file of the package, or null when it is not there. */
  read(relative: string): Promise<Uint8Array | null>;
}

const stagedName = (relative: string): string => relative.replace(/\//g, '__');

export function createPackageWriter(packageDir: string, stagingDir: string): PackageWriter {
  const place = (relative: string): string => join(packageDir, ...relative.split('/'));

  async function land(relative: string, fill: (staged: string) => Promise<void>): Promise<void> {
    const target = place(relative);
    await mkdir(stagingDir, { recursive: true, mode: 0o700 });
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const staged = join(stagingDir, stagedName(relative));
    await fill(staged);
    const handle = await open(staged, FS.O_RDONLY | FS.O_NOFOLLOW);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(staged, target);
    await syncDirectory(dirname(target));
  }

  return Object.freeze({
    write: (relative: string, bytes: Uint8Array) =>
      land(relative, async (staged) => {
        const handle = await open(staged, FS.O_WRONLY | FS.O_CREAT | FS.O_TRUNC | FS.O_NOFOLLOW, 0o600);
        try {
          await handle.writeFile(bytes);
        } finally {
          await handle.close();
        }
      }),
    copyIn: (relative: string, from: string) => land(relative, (staged) => copyFile(from, staged)),
    async read(relative: string): Promise<Uint8Array | null> {
      try {
        return new Uint8Array(await readFile(place(relative)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
  });
}
