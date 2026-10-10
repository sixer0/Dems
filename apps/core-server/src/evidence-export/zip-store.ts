/**
 * The archive of an export (blueprint row 91 / M8-W2; evidence package spec §A.2 `export/EXP-<id>.zip`).
 *
 * THE CONTAINER IS WRITTEN BY A READY-MADE LIBRARY: `yazl` 3.3.1 (MIT; controller ruling D139 - an
 * evidence export is not the place for a home-made container writer). This file is the thin
 * interface the rest of the unit uses and the settings that make an export reproducible:
 *
 *   - every entry is STORED (no compression: the camera files are compressed video already);
 *   - every entry and the end of the archive are written in the ZIP64 form, so one path serves a
 *     2 kB manifest and a recording beyond 4 GiB;
 *   - DETERMINISTIC: entries in the order they are added, one fixed DOS time for all of them
 *     (1980-01-01 00:00, no extended-timestamp field, so the machine's time zone does not enter
 *     the bytes), one fixed mode. The same entries give the same bytes, and the export manifest's
 *     hash of the archive can be reproduced;
 *   - STREAMED: an entry's bytes are handed over in pieces and go into the archive through the
 *     library's stream, with back-pressure. One piece at a time is held, never a whole entry, so
 *     a decrypted camera file exists nowhere but inside the archive.
 *
 * The archive file must not exist (`wx`, mode 0600). The tests read the result back with the
 * system's `unzip`, a reader that neither this file nor the library wrote.
 */
import { createWriteStream, type WriteStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { ZipFile } from 'yazl';

/** 1980-01-01, 00:00:00 in the DOS fields. Built from local parts because the library reads local parts. */
const FIXED_TIME = new Date(1980, 0, 1, 0, 0, 0);
/** A plain file, rw-r--r--. */
const ENTRY_MODE = 0o100644;

/** A plain relative path with `/`: no empty part, no `.` or `..`, nothing absolute. */
const ENTRY_NAME = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

export function isArchiveEntryName(name: string): boolean {
  return name.length <= 512 && ENTRY_NAME.test(name) && !name.split('/').some((part) => part === '.' || part === '..');
}

export interface ArchiveEntry {
  readonly name: string;
  readonly bytes: number;
}

export interface ArchiveSummary {
  /** The length of the archive file. */
  readonly bytes: number;
  readonly entries: readonly ArchiveEntry[];
}

export interface ArchiveWriter {
  /**
   * Adds one entry. `fill` is handed the function that appends a piece to the entry; the entry
   * ends when `fill` resolves. One entry at a time. Resolves with the entry's length.
   */
  add(name: string, fill: (write: (piece: Uint8Array) => Promise<void>) => Promise<void>): Promise<number>;
  /** Writes the directory, flushes the file to the disk and closes it. */
  finish(): Promise<ArchiveSummary>;
  /** Closes the file without finishing it (the failure path). The caller removes the file. */
  abandon(): Promise<void>;
}

const failed = (stream: { once(event: 'error', listener: (error: Error) => void): unknown }): Promise<never> =>
  new Promise((_resolve, reject) => void stream.once('error', reject));

/**
 * Creates the archive file (it must not exist: `wx`, mode 0600) and returns its writer. A name
 * that is no plain relative path, a second entry of a name, and an entry begun while another is
 * open are refused with an `Error` whose message is a code.
 */
export async function createArchive(file: string): Promise<ArchiveWriter> {
  const output: WriteStream = createWriteStream(file, { flags: 'wx', mode: 0o600 });
  // The file exists (or the open failed, e.g. EEXIST) before a writer is handed out.
  await Promise.race([new Promise<void>((resolve) => void output.once('open', () => resolve())), failed(output)]);
  let outputError: Error | null = null;
  output.on('error', (error) => void (outputError ??= error));
  const closed = new Promise<void>((resolve) => void output.once('close', () => resolve()));

  const zip = new ZipFile();
  zip.outputStream.pipe(output);
  const written: ArchiveEntry[] = [];
  const names = new Set<string>();
  let busy = false;
  let ended = false;

  return {
    async add(entryName, fill) {
      if (ended) throw new Error('ARCHIVE_CLOSED');
      if (busy) throw new Error('ARCHIVE_ENTRY_OPEN');
      if (!isArchiveEntryName(entryName)) throw new Error('ARCHIVE_ENTRY_NAME');
      if (names.has(entryName)) throw new Error('ARCHIVE_ENTRY_TWICE');
      busy = true;
      try {
        const source = new PassThrough();
        zip.addReadStream(source, entryName, { mtime: FIXED_TIME, mode: ENTRY_MODE, compress: false, forceZip64Format: true, forceDosTimestamp: true });
        let bytes = 0;
        await fill(async (piece) => {
          if (piece.byteLength === 0) return;
          if (outputError !== null) throw outputError;
          bytes += piece.byteLength;
          // Back-pressure: the next piece waits until the library has taken this one.
          if (!source.write(piece)) await new Promise<void>((resolve) => void source.once('drain', () => resolve()));
        });
        const taken = new Promise<void>((resolve) => void source.once('end', () => resolve()));
        source.end();
        await taken;
        if (outputError !== null) throw outputError;
        names.add(entryName);
        written.push({ name: entryName, bytes });
        return bytes;
      } finally {
        busy = false;
      }
    },

    async finish() {
      if (ended) throw new Error('ARCHIVE_CLOSED');
      if (busy) throw new Error('ARCHIVE_ENTRY_OPEN');
      ended = true;
      zip.end({ forceZip64Format: true, comment: '' });
      await closed;
      if (outputError !== null) throw outputError;
      // On the disk before the caller gives the file its name.
      const handle = await open(file, 'r');
      try {
        await handle.sync();
        return { bytes: (await handle.stat()).size, entries: [...written] };
      } finally {
        await handle.close();
      }
    },

    async abandon() {
      if (ended) return;
      ended = true;
      zip.outputStream.unpipe(output);
      output.destroy();
      await closed;
    },
  };
}
