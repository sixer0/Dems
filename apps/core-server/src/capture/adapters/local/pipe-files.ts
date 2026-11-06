/**
 * The file-system half of the microphone pipe (blueprint row 135; capture spec §A.7.1 ML-2, §G.1
 * G-R6; check `M4-SEC-HELPER-1`, pipe path).
 *
 * THIS IS THE ONE FILE OF THE MICROPHONE HELPER THAT TOUCHES THE FILE SYSTEM, and it does four
 * things only: look at an entry WITHOUT following a link, make a directory, resolve a path, and
 * remove an entry. Node has no call that creates a named pipe; the pipe itself is created by
 * `/usr/bin/mkfifo` through the process door (`mic-pipe.ts`). What a fact means is decided in
 * `mic-pipe.ts`, a pure function of these facts: a test passes a facade that holds a planted tree.
 * Nothing here writes a byte of a file, and nothing here is logged.
 *
 * THE PIPE KEEPER (task 4 row N10; decision C118 (1); request line 552 of row N9): the fifth thing,
 * and the only one that reads. The macOS microphone helper writes ONE process for the two inputs of
 * a device; a reader that closes its pipe ends the WHOLE helper. So the adapter holds its own reader
 * on every pipe of a launch: `hold` opens the pipe for reading WITHOUT WAITING for a writer
 * (`O_RDONLY | O_NONBLOCK`) and reads nothing while the worker reads; `drain` reads and DROPS what
 * arrives once the worker has let go of the pipe; `release` closes it. Three calls of the file
 * system and no other: open (for reading, non-blocking), read, close. What is read is never kept,
 * copied, decoded or handed on: it lands in one scratch buffer of the held pipe and is overwritten.
 */
import { closeSync, constants, lstatSync, mkdirSync, openSync, readSync, realpathSync, unlinkSync } from 'node:fs';
import type { CaptureTimers } from '../../types';

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

// ── The pipe keeper (row N10; decision C118 (1)) ─────────────────────────────────────────────────

/** One pipe the keeper holds open. `drain` and `release` never throw; each is once, a second call does nothing. */
export interface HeldPipe {
  /** Starts reading and dropping what arrives, one turn per `PIPE_DRAIN_INTERVAL_MS`, until `release`. */
  drain(): void;
  /** Closes the reader. A drain stops with it. */
  release(): void;
}

/** The keeper of the macOS adapter's own readers (its `MacosPipeKeeper`, by shape). */
export interface PipeKeeper {
  /** Opens the pipe for reading without waiting for a writer and reads NOTHING. Rejects when the pipe cannot be opened. */
  hold(path: string): Promise<HeldPipe>;
}

/**
 * The pause between two turns of a drain. At 48,000 samples of 4 bytes a second (the helper's one
 * output, 192,000 bytes a second) a turn finds about 3,840 bytes: far below the 16 KiB a pipe of
 * this Mac holds before its writer would wait (the helper's queue of the OTHER output then fills).
 */
export const PIPE_DRAIN_INTERVAL_MS = 20;
/** Bytes asked by one read, and reads of one turn at most (so a turn never holds the event loop for long). */
const DRAIN_READ_BYTES = 65_536;
const DRAIN_READS_PER_TURN = 16;

/**
 * THE PRODUCT'S PIPE KEEPER. Its turns are the capture timers' (`timers.after`): this file names no
 * global timer. A read that finds nothing (`EAGAIN`: the writer wrote nothing yet) or no writer (0
 * bytes) ends the turn; any other failure of a read ends the turn too, and the next turn tries again.
 */
export function createPipeKeeper(timers: CaptureTimers): PipeKeeper {
  return {
    async hold(path) {
      const descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
      let open = true;
      let draining = false;
      let cancel: (() => void) | null = null;
      let scratch: Buffer | null = null;
      const turn = (): void => {
        cancel = null;
        const buffer = scratch;
        if (!open || buffer === null) return;
        for (let reads = 0; reads < DRAIN_READS_PER_TURN; reads += 1) {
          let got = 0;
          try {
            got = readSync(descriptor, buffer, 0, buffer.length, null);
          } catch {
            break;
          }
          if (got === 0) break;
        }
        cancel = timers.after(PIPE_DRAIN_INTERVAL_MS, turn);
      };
      return {
        drain() {
          if (!open || draining) return;
          draining = true;
          try {
            scratch = Buffer.alloc(DRAIN_READ_BYTES);
            turn();
          } catch {
            // Never throws: a drain that could not start leaves the reader open (the helper still has a reader).
          }
        },
        release() {
          if (!open) return;
          open = false;
          cancel?.();
          cancel = null;
          scratch = null;
          try {
            closeSync(descriptor);
          } catch {
            // Never throws: a descriptor that cannot be closed is closed with the process.
          }
        },
      };
    },
  };
}
