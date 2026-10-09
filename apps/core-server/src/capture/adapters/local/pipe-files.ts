/**
 * The file-system half of the microphone pipe (blueprint row 135; capture spec §A.7.1 ML-2, §G.1
 * G-R6; check `M4-SEC-HELPER-1`, pipe path).
 *
 * THIS IS THE ONE FILE OF THE MICROPHONE HELPER THAT TOUCHES THE FILE SYSTEM, and it does four
 * things only: look at an entry WITHOUT following a link, make a directory, resolve a path, and
 * remove an entry. Node has no call that creates a named pipe; the pipe itself is created by
 * `/usr/bin/mkfifo` through the process door (`mic-pipe.ts`). What a fact means is decided in
 * `mic-pipe.ts`, a pure function of these facts: a test passes a facade that holds a planted tree.
 * Nothing here reads or writes a byte of a file, and nothing here is logged.
 */
import { lstatSync, mkdirSync, realpathSync, unlinkSync } from 'node:fs';

export type PipeEntryKind = 'absent' | 'fifo' | 'file' | 'directory' | 'symlink' | 'other';

/** What the file system says about one path, taken with `lstat`: a link is a link, never its target. */
export interface PipeEntryFacts {
  readonly kind: PipeEntryKind;
  readonly ownerUid: number;
  /** The permission bits (`mode & 0o7777`). */
  readonly mode: number;
}

export interface PipeFiles {
  /** The user the server runs as; -1 when the platform does not say. */
  readonly serverUid: number;
  inspect(path: string): PipeEntryFacts;
  /** The path with every link resolved, or null when it does not resolve. */
  realpath(path: string): string | null;
  /** Makes the directory and the missing ones above it with `mode`. An existing directory is left as it is. Throws when it cannot. */
  makeDirectory(path: string, mode: number): void;
  /** Removes one directory entry. Throws when it cannot. */
  remove(path: string): void;
}

const NOTHING: PipeEntryFacts = Object.freeze({ kind: 'absent', ownerUid: -1, mode: 0 });
const UNKNOWN: PipeEntryFacts = Object.freeze({ kind: 'other', ownerUid: -1, mode: 0 });

export function createPipeFiles(): PipeFiles {
  return {
    serverUid: typeof process.getuid === 'function' ? process.getuid() : -1,
    inspect(path) {
      try {
        const status = lstatSync(path);
        const kind: PipeEntryKind = status.isFIFO() ? 'fifo' : status.isFile() ? 'file' : status.isDirectory() ? 'directory' : status.isSymbolicLink() ? 'symlink' : 'other';
        return { kind, ownerUid: status.uid, mode: status.mode & 0o7777 };
      } catch (error) {
        // Only "no such entry" is absence. Anything else (no permission, a loop) is an entry we cannot vouch for.
        return (error as { code?: unknown }).code === 'ENOENT' ? NOTHING : UNKNOWN;
      }
    },
    realpath(path) {
      try {
        return realpathSync(path);
      } catch {
        return null;
      }
    },
    makeDirectory(path, mode) {
      mkdirSync(path, { recursive: true, mode });
    },
    remove(path) {
      unlinkSync(path);
    },
  };
}
