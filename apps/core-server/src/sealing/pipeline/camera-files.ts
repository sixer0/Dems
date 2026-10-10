/**
 * The camera files of a session on the file system (blueprint row 82): the bytes for the box walk
 * of `src/capture/fragments.ts`, the writer of a sealed camera file, and the `.part` names beside
 * a recording file.
 *
 * The worker's RECORDING file is read here and never changed; the SEALED camera file is written
 * under a name of its own, exclusively, and renamed when it is whole and synced (ruling D147).
 *
 * Nothing here decides: the pipeline acts on what these functions return.
 */
import { createHash } from 'node:crypto';
import { constants as FS } from 'node:fs';
import { chmod, lstat, mkdir, open, readdir, rename, unlink, type FileHandle } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { cameraFileName, type PackageVideoTrackId } from '@dems/shared/evidence-package';
import { walkCameraFile, type ByteSource, type NameFacts, type Sha256Factory } from '../../capture';

export const nodeSha256: Sha256Factory = () => {
  const hash = createHash('sha256');
  const wrap = (inner: ReturnType<typeof createHash>) => ({ update: (bytes: Uint8Array) => inner.update(bytes), copy: () => wrap(inner.copy()), digest: () => new Uint8Array(inner.digest()) });
  return wrap(hash);
};

export interface OpenCameraFile {
  readonly source: ByteSource;
  close(): Promise<void>;
}

async function readAt(handle: FileHandle, offset: number, length: number): Promise<Uint8Array> {
  const buffer = Buffer.alloc(length);
  let done = 0;
  while (done < length) {
    const { bytesRead } = await handle.read(buffer, done, length - done, offset + done);
    if (bytesRead === 0) break;
    done += bytesRead;
  }
  return new Uint8Array(buffer.buffer, buffer.byteOffset, done);
}

/** Opens a camera file for reading. Refuses a link and anything that is no regular file. Null when there is no such name. */
export async function openCameraFile(path: string): Promise<OpenCameraFile | null> {
  let handle: FileHandle;
  try {
    handle = await open(path, FS.O_RDONLY | FS.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const facts = await handle.stat();
  if (!facts.isFile()) {
    await handle.close();
    throw new Error('a camera file name that is no regular file');
  }
  return { source: { size: facts.size, read: (offset, length) => readAt(handle, offset, length) }, close: () => handle.close() };
}

/** Makes a directory of the package (owner-only) when it is not there. */
export async function ensureDirectory(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
}

/** A new file for writing. Fails when the name exists (`O_EXCL`), follows no link. */
export async function createExclusive(path: string): Promise<{ write(bytes: Uint8Array): Promise<void>; sync(): Promise<void>; close(): Promise<void> }> {
  const handle = await open(path, FS.O_WRONLY | FS.O_CREAT | FS.O_EXCL | FS.O_NOFOLLOW, 0o600);
  return { write: async (bytes) => void (await handle.writeFile(bytes)), sync: () => handle.sync(), close: () => handle.close() };
}

/** Removes a name when it is there. True when it was. */
export async function removeIfThere(dir: string, name: string): Promise<boolean> {
  try {
    await unlink(join(dir, name));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** Gives a file of `dir` its final name and syncs the directory. */
export async function renameWithin(dir: string, from: string, to: string): Promise<void> {
  await rename(join(dir, from), join(dir, to));
  await syncDirectory(dir);
}

/** Syncs a directory, so that the names in it are durable. */
export async function syncDirectory(dir: string): Promise<void> {
  const handle = await open(dir, FS.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Syncs one file that is already written. */
export async function syncFile(path: string): Promise<void> {
  const handle = await open(path, FS.O_RDONLY | FS.O_NOFOLLOW);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

const factsOf = async (dir: string, name: string): Promise<NameFacts | null> => {
  try {
    const facts = await lstat(join(dir, name), { bigint: true });
    return facts.isFile() ? { name, device: facts.dev, inode: facts.ino, size: Number(facts.size) } : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

/** The camera file and the `<camera file>.<pid>.part` names beside it, as the file system gives them. */
export async function cameraFileNames(dir: string, fileName: string): Promise<{ readonly file: NameFacts | null; readonly parts: readonly NameFacts[] }> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { file: null, parts: [] };
    throw error;
  }
  const pattern = new RegExp(`^${fileName.replace(/[.]/g, '\\.')}\\.[0-9]+\\.part$`);
  const parts: NameFacts[] = [];
  for (const name of names.filter((entry) => pattern.test(entry)).sort()) {
    const facts = await factsOf(dir, name);
    if (facts !== null) parts.push(facts);
  }
  return { file: await factsOf(dir, fileName), parts };
}

/** Removes a NAME (never the last name of a camera file: the caller asked `classifyPartNames` first). */
export async function removeName(dir: string, name: string): Promise<void> {
  await unlink(join(dir, name));
}

/** Moves a file of its own out of the package folder: its bytes are kept, under the staging folder. */
export async function moveOut(dir: string, name: string, toDir: string): Promise<void> {
  await mkdir(toDir, { recursive: true, mode: 0o700 });
  await rename(join(dir, name), join(toDir, name));
}

/**
 * MOVES A RECORDING FILE THE CORE COULD NOT SEAL TO THE QUARANTINE (fix pass F-M7; D178): never a
 * delete. `toDir` is `<mediaStoreRoot>/.quarantine/<sessionId>`; it and its parent are made and
 * held owner-only (0700), the file 0600. A name that is taken there (a second move after a
 * restart) gets a counted suffix: nothing in the quarantine is ever overwritten. False when there
 * is no such name in `dir`. No link is followed: a link is moved as the link it is.
 */
export async function moveToQuarantine(dir: string, name: string, toDir: string): Promise<boolean> {
  let facts;
  try {
    facts = await lstat(join(dir, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  await mkdir(toDir, { recursive: true, mode: 0o700 });
  await chmod(dirname(toDir), 0o700);
  await chmod(toDir, 0o700);
  let target = name;
  for (let count = 1; ; count += 1) {
    try {
      await lstat(join(toDir, target));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw error;
    }
    target = `${name}.${count}`;
  }
  await rename(join(dir, name), join(toDir, target));
  if (facts.isFile()) await chmod(join(toDir, target), 0o600);
  await syncDirectory(toDir);
  await syncDirectory(dir);
  return true;
}

/** Every file below `dir`, as `/`-joined relative paths, sorted. Links are listed and never followed. */
export async function listPackageFiles(dir: string, below = ''): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(below === '' ? dir : join(dir, ...below.split('/')), { withFileTypes: true })) {
    const relative = below === '' ? entry.name : `${below}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await listPackageFiles(dir, relative)));
    else found.push(relative);
  }
  return found.sort();
}

/** How many whole fragments the RECORDING file of a session (`<package folder>/VIDEO-0n.mp4`, what the worker wrote) holds, by box walk; 0 when there is no file or no init segment. */
export async function wholeFragmentsOnDisk(packageDir: string, trackId: PackageVideoTrackId): Promise<number> {
  const file = await openCameraFile(join(packageDir, cameraFileName(trackId))).catch(() => null);
  if (file === null) return 0;
  try {
    return (await walkCameraFile(file.source, nodeSha256)).fragments.length;
  } finally {
    await file.close();
  }
}

/**
 * WHAT "DURABLE" MEANS AFTER A RESTART (ruling D144 (2)): the file is the truth, the row is a
 * hint. True when a camera file of the session holds a whole fragment that the box walk can read.
 * A Core that died between the worker's write and the row insert has no fragment row and still
 * answers true here: that session is an interrupted recording, never a failed start.
 */
export async function durableMediaOnDisk(packageDir: string): Promise<boolean> {
  for (const trackId of ['VIDEO-01', 'VIDEO-02'] as const) if ((await wholeFragmentsOnDisk(packageDir, trackId)) > 0) return true;
  return false;
}
