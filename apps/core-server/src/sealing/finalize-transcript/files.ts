/**
 * The file reader of `FINALIZE_TRANSCRIPT` on the real file system: reads one transcript file
 * whole, for hashing. It writes nothing, lists nothing and follows whatever path the transcriber
 * seam named. The step itself imports no file system; a test hands it another reader.
 */
import { readFile } from 'node:fs/promises';
import type { TranscriptFileReader } from './contract';

export function createTranscriptFileReader(): TranscriptFileReader {
  return Object.freeze({
    read: async (path: string): Promise<Uint8Array> => new Uint8Array(await readFile(path)),
  });
}
