/**
 * The file-system side of verify v2 (blueprint row 85): one sealed package folder as a
 * `PackageReader`. The ONE file of this unit that touches the file system.
 *
 * READ ONLY. Every file is opened for reading, never created, never written. A camera file is
 * handed out in chunks of `PACKAGE_READ_CHUNK_BYTES` through one buffer that is reused: the
 * reader never holds more than one chunk, whatever the size of the recording.
 *
 * WHAT IT REFUSES. A path of the package is a fixed name of the layout or a name the manifest
 * rules produce; it is still held to a plain relative form here (no `..`, no absolute path, no
 * empty part). A link is never followed: a file that is a link, and a file that lies outside the
 * folder once the folders above it are resolved, is UNREADABLE - a package cannot make the
 * verifier hash a file of another package or of the host.
 */
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { sep } from 'node:path';
import type { PackageEntry, PackageReader } from '@dems/shared/evidence-verify';

export const PACKAGE_READ_CHUNK_BYTES = 1024 * 1024;
/** How deep the listing of a package folder goes: the layout has two levels. */
const LIST_DEPTH = 4;
const RELATIVE_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

function plain(path: string): boolean {
  return RELATIVE_PATH.test(path) && !path.split('/').some((part) => part === '.' || part === '..');
}

const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;

export function createPackageReader(packageDir: string, options: { readonly chunkBytes?: number } = {}): PackageReader {
  const chunkBytes = options.chunkBytes ?? PACKAGE_READ_CHUNK_BYTES;
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1) throw new Error('the chunk size of a package reader is a whole number of bytes, 1 or more');
  const place = (path: string): string => `${packageDir}${sep}${path.split('/').join(sep)}`;
  let root: Promise<string> | null = null;
  const rootOf = (): Promise<string> => (root ??= realpath(packageDir));

  /** The file is a plain file inside the folder, reached through no link. */
  async function entry(path: string): Promise<PackageEntry> {
    if (!plain(path)) return { kind: 'UNREADABLE' };
    try {
      const facts = await lstat(place(path));
      if (!facts.isFile()) return { kind: 'UNREADABLE' };
      const resolved = await realpath(place(path));
      if (resolved !== `${await rootOf()}${sep}${path.split('/').join(sep)}`) return { kind: 'UNREADABLE' };
      return { kind: 'FILE', size: facts.size };
    } catch (error) {
      const code = codeOf(error);
      return code === 'ENOENT' || code === 'ENOTDIR' ? { kind: 'ABSENT' } : { kind: 'UNREADABLE' };
    }
  }

  async function opened<Value>(path: string, work: (handle: Awaited<ReturnType<typeof open>>) => Promise<Value>): Promise<Value> {
    if ((await entry(path)).kind !== 'FILE') throw new Error('PACKAGE_FILE_UNREADABLE');
    const handle = await open(place(path), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return await work(handle);
    } finally {
      await handle.close();
    }
  }

  return {
    entry,

    readText: (path, maxBytes) =>
      opened(path, async (handle) => {
        const size = (await handle.stat()).size;
        if (size > maxBytes) throw new Error('PACKAGE_FILE_TOO_LARGE');
        const buffer = Buffer.alloc(size);
        let filled = 0;
        while (filled < size) {
          const { bytesRead } = await handle.read(buffer, filled, size - filled, filled);
          if (bytesRead === 0) break;
          filled += bytesRead;
        }
        // Not UTF-8 is unreadable, not "read with replacement characters".
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, filled));
      }),

    readRange: (path, offset, length, onChunk) =>
      opened(path, async (handle) => {
        const buffer = Buffer.alloc(Math.min(chunkBytes, Math.max(length, 1)));
        let delivered = 0;
        while (delivered < length) {
          const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.byteLength, length - delivered), offset + delivered);
          if (bytesRead === 0) break;
          onChunk(buffer.subarray(0, bytesRead));
          delivered += bytesRead;
        }
        return delivered;
      }),

    async list(limit) {
      const found: string[] = [];
      const walk = async (relative: string, depth: number): Promise<boolean> => {
        const entries = await readdir(relative === '' ? packageDir : place(relative), { withFileTypes: true });
        for (const item of entries) {
          const path = relative === '' ? item.name : `${relative}/${item.name}`;
          if (item.isDirectory()) {
            // A folder deeper than the layout knows is named as it is: it is not walked.
            if (depth >= LIST_DEPTH) found.push(path);
            else if (!(await walk(path, depth + 1))) return false;
          } else found.push(path);
          if (found.length > limit) return false;
        }
        return true;
      };
      try {
        return (await walk('', 1)) ? found : null;
      } catch {
        return null;
      }
    },
  };
}
