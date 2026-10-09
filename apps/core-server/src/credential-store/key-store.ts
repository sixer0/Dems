/**
 * The key files of the Core credential store (blueprint row 84; SEC35-03, SEC35-08; capture spec
 * §D.2; database contract §B.3 "Key store").
 *
 * THE ONLY FILE OF THIS FOLDER THAT TOUCHES THE FILE SYSTEM. One key per file:
 *
 *   <dataDir>/credential-store/keys/<reference>.key      mode 0600, in directories of mode 0700
 *
 * `<dataDir>` is the git-ignored data directory of the server (`/.data/` at the repository root).
 * The media of a session lives in another branch of it (`<dataDir>/media/sessions/`): the keys
 * are never beside the media, never in the worker's output directory, never in the database.
 * ON THIS MAC BOTH BRANCHES ARE ON ONE VOLUME; a separate volume or a hardware store is a
 * deployment decision (class C), stated in the custody note of this row.
 *
 * A key file is 8 bytes of a format mark and 32 bytes of key. It is created once (`wx`: a second
 * creation under one reference fails), synced to the disk before the reference is handed out, and
 * never rewritten. Reading refuses everything that is not a private regular file of this user of
 * exactly that size: a link, a file another user may read, a file of another length.
 *
 * NO ESCROW, NO BACKUP (SEC35-09). A key that is removed, or a data directory that is lost, makes
 * what the key sealed unreadable. This file keeps no second copy.
 *
 * DESTRUCTION. `destroy` overwrites the file and removes it. On a copy-on-write file system (APFS)
 * and on flash storage an overwrite does not guarantee that the old blocks are gone: destruction
 * here means "the server can no longer read it", not forensic erasure.
 *
 * Nothing here logs. A failure is a `CredentialStoreError` with a code and an `errno` name.
 */
import { randomBytes } from 'node:crypto';
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { CredentialStoreError, CredentialStoreFailure, errnoOf } from './errors';
import { KEY_BYTES, keyMaterialOf, type KeyMaterial } from './key-material';

/** The store's branch of the data directory, and the folder of the key files inside it. */
export const CREDENTIAL_STORE_FOLDER = 'credential-store';
export const KEY_FOLDER = 'keys';
const KEY_FILE_SUFFIX = '.key';
/** The format mark of a key file, version 1. */
const KEY_FILE_MARK = Buffer.from('DEMSKEY1', 'ascii');
const KEY_FILE_BYTES = KEY_FILE_MARK.byteLength + KEY_BYTES;
/** A named secret blob (a signing key in its own encoding): another suffix, another mark, at most 4096 bytes. */
const BLOB_FILE_SUFFIX = '.blob';
const BLOB_FILE_MARK = Buffer.from('DEMSBLB1', 'ascii');
export const BLOB_MAX_BYTES = 4096;
const PRIVATE_DIRECTORY = 0o700;
const PRIVATE_FILE = 0o600;
const OTHERS = 0o077;

/** A key reference as a file name: no separator, no dot, no leading hyphen. */
export const KEY_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export type KeyStoreState = 'ABSENT' | 'READY';

export interface KeyStore {
  /** `ABSENT` until the first key is made; throws `STORE_UNSAFE` for a directory that is not private. */
  inspect(): KeyStoreState;
  /** Makes a new random key under `ref`. Fails with `KEY_EXISTS` when the reference is taken. */
  create(ref: string): KeyMaterial;
  open(ref: string): KeyMaterial;
  has(ref: string): boolean;
  /** Overwrites and removes the key. True when a key was there. What it sealed is unreadable from now on. */
  destroy(ref: string): boolean;
  /** Every key reference the store holds, sorted. */
  list(): string[];
  /** Stores a named secret blob once (`KEY_EXISTS` when the name is taken). The caller overwrites its own buffer. */
  putBlob(ref: string, bytes: Uint8Array): void;
  /** A copy of the blob. The caller overwrites it after use. */
  openBlob(ref: string): Buffer;
  hasBlob(ref: string): boolean;
}

export interface FileKeyStoreOptions {
  /** `<dataDir>/credential-store`. Its parent must exist: the store never makes the data directory. */
  readonly root: string;
  /** A test hands in a source of its own. */
  readonly randomKey?: () => Uint8Array;
}

function fail(code: CredentialStoreFailure, error?: unknown): never {
  throw new CredentialStoreError(code, error === undefined ? null : errnoOf(error));
}

/** The server's user, or null where the platform has none. */
function ownUser(): number | null {
  return typeof process.getuid === 'function' ? process.getuid() : null;
}

function isPrivate(stats: { readonly mode: number; readonly uid: number }): boolean {
  const user = ownUser();
  return (stats.mode & OTHERS) === 0 && (user === null || stats.uid === user);
}

function syncDirectory(directory: string): void {
  // Makes the new or removed name durable. Some file systems refuse to sync a directory: the key
  // file itself was synced, so this is not a failure of the write.
  try {
    const handle = openSync(directory, constants.O_RDONLY);
    try {
      fsyncSync(handle);
    } finally {
      closeSync(handle);
    }
  } catch {
    /* see above */
  }
}

/** True when the data directory of the server exists. The store never makes it. */
export function dataDirectoryIsThere(dataDir: string): boolean {
  try {
    return statSync(dataDir).isDirectory();
  } catch (error) {
    const errno = errnoOf(error);
    if (errno === 'ENOENT' || errno === 'ENOTDIR') return false;
    return fail(CredentialStoreFailure.STORE_UNAVAILABLE, error);
  }
}

export function createFileKeyStore(options: FileKeyStoreOptions): KeyStore {
  const { root } = options;
  const directory = join(root, KEY_FOLDER);
  const randomKey = options.randomKey ?? ((): Uint8Array => randomBytes(KEY_BYTES));

  const fileOf = (ref: string, suffix: string = KEY_FILE_SUFFIX): string => {
    if (typeof ref !== 'string' || !KEY_REF_PATTERN.test(ref)) fail(CredentialStoreFailure.KEY_REF_INVALID);
    return join(directory, `${ref}${suffix}`);
  };

  const isThere = (file: string): boolean => {
    try {
      return lstatSync(file).isFile();
    } catch (error) {
      const errno = errnoOf(error);
      if (errno === 'ENOENT' || errno === 'ENOTDIR') return false;
      return fail(CredentialStoreFailure.STORE_UNAVAILABLE, error);
    }
  };

  /** True when the directory is there and private; false when it is not there. */
  const directoryIsThere = (path: string): boolean => {
    let stats;
    try {
      stats = lstatSync(path);
    } catch (error) {
      if (errnoOf(error) === 'ENOENT') return false;
      return fail(CredentialStoreFailure.STORE_UNAVAILABLE, error);
    }
    if (!stats.isDirectory() || !isPrivate(stats)) fail(CredentialStoreFailure.STORE_UNSAFE);
    return true;
  };

  const inspect = (): KeyStoreState => (directoryIsThere(root) && directoryIsThere(directory) ? 'READY' : 'ABSENT');

  const ensure = (): void => {
    for (const path of [root, directory]) {
      if (directoryIsThere(path)) continue;
      try {
        // Not recursive: the data directory is never made here.
        mkdirSync(path, { mode: PRIVATE_DIRECTORY });
      } catch (error) {
        if (errnoOf(error) !== 'EEXIST') fail(CredentialStoreFailure.STORE_UNAVAILABLE, error);
      }
      if (!directoryIsThere(path)) fail(CredentialStoreFailure.STORE_UNAVAILABLE);
    }
  };

  /** Writes a file that must not exist yet, private, synced before the name is handed out. */
  const writeNew = (file: string, content: Buffer): void => {
    ensure();
    let handle: number;
    try {
      handle = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, PRIVATE_FILE);
    } catch (error) {
      return fail(errnoOf(error) === 'EEXIST' ? CredentialStoreFailure.KEY_EXISTS : CredentialStoreFailure.KEY_WRITE_FAILED, error);
    }
    try {
      // The mode again, on the handle: the process mask can only have narrowed it, never widened.
      fchmodSync(handle, PRIVATE_FILE);
      const written = writeSync(handle, content, 0, content.byteLength, 0);
      if (written !== content.byteLength) fail(CredentialStoreFailure.KEY_WRITE_FAILED);
      fsyncSync(handle);
    } catch (error) {
      // Half a file is no key: it is removed, so that the reference stays free.
      try {
        unlinkSync(file);
      } catch {
        /* nothing more can be done here; a read refuses a file of another length */
      }
      if (error instanceof CredentialStoreError) throw error;
      return fail(CredentialStoreFailure.KEY_WRITE_FAILED, error);
    } finally {
      closeSync(handle);
    }
    syncDirectory(directory);
  };

  /** Reads a private regular file of this user whose size is within the two bounds. The caller overwrites the result. */
  const readPrivate = (file: string, minBytes: number, maxBytes: number): Buffer => {
    let handle: number;
    try {
      handle = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      const errno = errnoOf(error);
      if (errno === 'ENOENT' || errno === 'ENOTDIR') return fail(CredentialStoreFailure.KEY_NOT_FOUND);
      // A link in the place of a key file is refused by the open itself.
      if (errno === 'ELOOP' || errno === 'EMLINK') return fail(CredentialStoreFailure.KEY_UNSAFE);
      return fail(CredentialStoreFailure.STORE_UNAVAILABLE, error);
    }
    try {
      const stats = fstatSync(handle);
      if (!stats.isFile() || !isPrivate(stats) || stats.size < minBytes || stats.size > maxBytes) fail(CredentialStoreFailure.KEY_UNSAFE);
      const content = Buffer.alloc(stats.size);
      if (readSync(handle, content, 0, stats.size, 0) !== stats.size) {
        content.fill(0);
        fail(CredentialStoreFailure.KEY_UNSAFE);
      }
      return content;
    } catch (error) {
      if (error instanceof CredentialStoreError) throw error;
      return fail(CredentialStoreFailure.STORE_UNAVAILABLE, error);
    } finally {
      closeSync(handle);
    }
  };

  return {
    inspect,

    create(ref) {
      const file = fileOf(ref);
      const drawn = randomKey();
      if (!(drawn instanceof Uint8Array) || drawn.byteLength !== KEY_BYTES) fail(CredentialStoreFailure.KEY_WRITE_FAILED);
      const content = Buffer.concat([KEY_FILE_MARK, drawn]);
      try {
        writeNew(file, content);
        return keyMaterialOf(drawn);
      } finally {
        content.fill(0);
        drawn.fill(0);
      }
    },

    open(ref) {
      const content = readPrivate(fileOf(ref), KEY_FILE_BYTES, KEY_FILE_BYTES);
      try {
        if (!content.subarray(0, KEY_FILE_MARK.byteLength).equals(KEY_FILE_MARK)) fail(CredentialStoreFailure.KEY_UNSAFE);
        return keyMaterialOf(content.subarray(KEY_FILE_MARK.byteLength));
      } finally {
        content.fill(0);
      }
    },

    putBlob(ref, bytes) {
      const file = fileOf(ref, BLOB_FILE_SUFFIX);
      if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > BLOB_MAX_BYTES) fail(CredentialStoreFailure.PLAINTEXT_INVALID);
      const content = Buffer.concat([BLOB_FILE_MARK, bytes]);
      try {
        writeNew(file, content);
      } finally {
        content.fill(0);
      }
    },

    openBlob(ref) {
      const content = readPrivate(fileOf(ref, BLOB_FILE_SUFFIX), BLOB_FILE_MARK.byteLength + 1, BLOB_FILE_MARK.byteLength + BLOB_MAX_BYTES);
      try {
        if (!content.subarray(0, BLOB_FILE_MARK.byteLength).equals(BLOB_FILE_MARK)) fail(CredentialStoreFailure.KEY_UNSAFE);
        return Buffer.from(content.subarray(BLOB_FILE_MARK.byteLength));
      } finally {
        content.fill(0);
      }
    },

    hasBlob: (ref) => isThere(fileOf(ref, BLOB_FILE_SUFFIX)),

    has: (ref) => isThere(fileOf(ref)),

    destroy(ref) {
      const file = fileOf(ref);
      let handle: number;
      try {
        handle = openSync(file, constants.O_WRONLY | constants.O_NOFOLLOW);
      } catch (error) {
        const errno = errnoOf(error);
        if (errno === 'ENOENT' || errno === 'ENOTDIR') return false;
        if (errno !== 'ELOOP' && errno !== 'EMLINK') return fail(CredentialStoreFailure.STORE_UNAVAILABLE, error);
        // A link in the place of a key file: the name is removed, what it points at is not written to.
        handle = -1;
      }
      try {
        if (handle !== -1) {
          const size = Math.min(fstatSync(handle).size, 4096);
          writeSync(handle, Buffer.alloc(size), 0, size, 0);
          fsyncSync(handle);
        }
      } catch {
        /* the removal below is what makes the key unreadable to the server */
      } finally {
        if (handle !== -1) closeSync(handle);
      }
      try {
        unlinkSync(file);
      } catch (error) {
        return fail(CredentialStoreFailure.STORE_UNAVAILABLE, error);
      }
      syncDirectory(directory);
      return true;
    },

    list() {
      if (inspect() === 'ABSENT') return [];
      try {
        return readdirSync(directory)
          .filter((name) => name.endsWith(KEY_FILE_SUFFIX))
          .map((name) => name.slice(0, -KEY_FILE_SUFFIX.length))
          .filter((ref) => KEY_REF_PATTERN.test(ref))
          .sort();
      } catch (error) {
        return fail(CredentialStoreFailure.STORE_UNAVAILABLE, error);
      }
    },
  };
}
