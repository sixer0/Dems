/**
 * THE PROVENANCE OF A SESSION'S STT MODEL: manifest fields 84 to 87 (integration pass D8; evidence
 * package spec §B.7 fields 84-87; transcript spec §B.3, §B.4; database contract `transcripts.model`
 * "name, version, quantisation, params, model-file hash").
 *
 * RECORDED AS FAR AS THE CORE CAN KNOW IT, AND THE BACKEND SAYS WHICH KIND IT IS (decision D160,
 * integration pass D9; the rule itself is `transcriptModelFaults` of the shared evidence package,
 * held by the manifest schema and both transcript document schemas). Nothing here is a made-up
 * value.
 *
 *   member        `cpu-local` (the Core reads the model file, tx §B.4)             a SERVER (`omlx-server`)
 *   name          the adapter's model identifier (= the session's snapshot)         the same: the identifier
 *                                                                                   the snapshot names
 *   version       DECLARED BY THE INSTALLATION for that identifier:                 null
 *                 `cpuLocal.modelVersions[<id>]` of the host file (`host.ts`).
 *                 No file member and no engine output states a version; name
 *                 and SHA-256 identify the file, the version is a declared
 *                 value. Not stated -> `MODEL_VERSION_NOT_STATED`
 *   quantisation  the model file's own header: the `ftype` of the ggml              null
 *                 hyper-parameters (the tier of tx §B.3: f16, q5_0, q8_0 ...)
 *   sha256        SHA-256 of the model file `<modelDir>/<id>.bin`, hashed by        null
 *                 the Core ("the model file's sha256 is recorded", tx §B.3;
 *                 "model-file hash", dbc `transcripts.model`). The path is the
 *                 one the adapter hands the engine (`config.modelPath`)
 *
 * A SERVER BACKEND IS A HOST SERVICE THE CORE NEVER STARTS and whose model files it never reads
 * (D7): for it this provider states the name and three nulls, WHATEVER the caller hands in - a
 * `modelPath` beside a server backend is never opened, read or hashed. For `cpu-local` a member
 * without a source is NOT stated: the answer says which one by a code and the session is sealed
 * without a transcript document (`PARTIAL`, `TRANSCRIPT_UNAVAILABLE_AT_SEAL`). A backend that is
 * neither (none exists today) has no source: `MODEL_PROVENANCE_NO_SOURCE_FOR_BACKEND`.
 *
 * `provenanceFitsBackend` is the gate of the PORT (`session-run.ts`): an answer of any provider -
 * a test's, a later one's - that states a version, a quantisation or a hash for a server session,
 * or leaves one out for `cpu-local`, is refused with `MODEL_PROVENANCE_NOT_FOR_BACKEND`.
 *
 * THE HASH IS TAKEN ONCE PER FILE AND PROCESS: kept by the file's identity (device, inode, size,
 * modification instant) and taken again when any of them changes. It is read as a stream; no
 * figure of how long it took is kept or written (D230). No path is ever written to a log: the
 * answers carry codes.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { isServerSttBackend, transcriptModelFaults } from '@dems/shared/evidence-package';
import { TranscriberBackendId, type TranscriptModelProvenance } from '@dems/transcriber';

export const ModelProvenanceCode = {
  /** A backend that is neither a server nor one whose model file the Core reads: nothing has a source. */
  NO_SOURCE_FOR_BACKEND: 'MODEL_PROVENANCE_NO_SOURCE_FOR_BACKEND',
  /** A provider stated members the backend of the session does not allow (a hash for a server; a null for `cpu-local`). */
  NOT_FOR_BACKEND: 'MODEL_PROVENANCE_NOT_FOR_BACKEND',
  /** The host file states no version for the model identifier of the session. */
  VERSION_NOT_STATED: 'MODEL_VERSION_NOT_STATED',
  /** The model file cannot be opened or read. */
  FILE_UNREADABLE: 'MODEL_FILE_UNREADABLE',
  /** The model file does not begin with the ggml header. */
  FILE_NOT_GGML: 'MODEL_FILE_NOT_GGML',
  /** The header names a file type this Core has no name for. */
  QUANTISATION_UNKNOWN: 'MODEL_QUANTISATION_UNKNOWN',
} as const;
export type ModelProvenanceCode = (typeof ModelProvenanceCode)[keyof typeof ModelProvenanceCode];

/** Fields 84 to 87 cannot all be stated: `unknown` says why. A code, never a value. */
export interface ModelProvenanceUnknown {
  readonly unknown: string;
}
/** The four members, or why not; `null` = not known, no reason given (a port that states nothing). */
export type ModelProvenanceAnswer = TranscriptModelProvenance | ModelProvenanceUnknown | null;

export const isProvenanceUnknown = (answer: ModelProvenanceAnswer): answer is ModelProvenanceUnknown => answer !== null && 'unknown' in answer;

/** True when the stated members are what the backend allows (decision D160): the one shared rule. */
export const provenanceFitsBackend = (backend: string, stated: TranscriptModelProvenance): boolean => transcriptModelFaults(backend, stated).length === 0;

/** What the provider reads of a session: its resolved configuration, as the adapter was built with it. */
export interface ModelProvenanceSubject {
  readonly backend: string;
  /** The adapter's model identifier. */
  readonly model: string;
  /** `cpu-local`: the model file the engine is given. Any other backend: null. */
  readonly modelPath: string | null;
}

export interface ModelProvenanceDeps {
  /** What the host file states: model identifier -> version. Asked per session; may throw (a host file that cannot be used). */
  readonly statedVersions: () => Readonly<Record<string, string>>;
}

/** `ggml` as whisper.cpp reads it: a little-endian 32-bit magic, then eleven 32-bit hyper-parameters; the last is `ftype`. */
export const GGML_MAGIC = 0x67676d6c;
export const GGML_HEADER_BYTES = 48;
const GGML_FTYPE_OFFSET = 44;
/** `ftype` carries the quantisation format version in its thousands (whisper.cpp `GGML_QNT_VERSION_FACTOR`). */
const GGML_QNT_VERSION_FACTOR = 1000;
/** ggml's own file types (`enum ggml_ftype`), by its own names in lower case. A number that is not here is not named. */
export const GGML_FTYPE_NAMES: Readonly<Record<number, string>> = Object.freeze({
  0: 'f32',
  1: 'f16',
  2: 'q4_0',
  3: 'q4_1',
  4: 'q4_1_some_f16',
  7: 'q8_0',
  8: 'q5_0',
  9: 'q5_1',
  10: 'q2_k',
  11: 'q3_k',
  12: 'q4_k',
  13: 'q5_k',
  14: 'q6_k',
});

/** The quantisation a ggml header states, or the code of why it states none. Pure. */
export function quantisationOfGgmlHeader(header: Uint8Array): { readonly ok: true; readonly quantisation: string } | { readonly ok: false; readonly code: ModelProvenanceCode } {
  if (header.byteLength < GGML_HEADER_BYTES) return { ok: false, code: ModelProvenanceCode.FILE_NOT_GGML };
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (view.getUint32(0, true) !== GGML_MAGIC) return { ok: false, code: ModelProvenanceCode.FILE_NOT_GGML };
  const ftype = view.getInt32(GGML_FTYPE_OFFSET, true);
  const name = ftype < 0 ? undefined : GGML_FTYPE_NAMES[ftype % GGML_QNT_VERSION_FACTOR];
  return name === undefined ? { ok: false, code: ModelProvenanceCode.QUANTISATION_UNKNOWN } : { ok: true, quantisation: name };
}

interface Hashed {
  readonly identity: string;
  readonly sha256: Promise<string>;
}

function sha256OfFile(path: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path, { highWaterMark: 1 << 20 });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export interface ModelProvenanceProvider {
  of(subject: ModelProvenanceSubject): Promise<ModelProvenanceAnswer>;
}

export function createModelProvenanceProvider(deps: ModelProvenanceDeps): ModelProvenanceProvider {
  const hashes = new Map<string, Hashed>();

  async function hashOf(path: string): Promise<string> {
    const facts = await stat(path);
    if (!facts.isFile()) throw new Error('not a file');
    const identity = `${facts.dev}:${facts.ino}:${facts.size}:${facts.mtimeMs}`;
    const known = hashes.get(path);
    if (known !== undefined && known.identity === identity) return known.sha256;
    const entry: Hashed = { identity, sha256: sha256OfFile(path) };
    hashes.set(path, entry);
    try {
      return await entry.sha256;
    } catch (error) {
      // A read that failed is not kept: the next session asks the file again.
      if (hashes.get(path) === entry) hashes.delete(path);
      throw error;
    }
  }

  async function headerOf(path: string): Promise<Uint8Array> {
    const file = await open(path, 'r');
    try {
      const bytes = new Uint8Array(GGML_HEADER_BYTES);
      const { bytesRead } = await file.read(bytes, 0, GGML_HEADER_BYTES, 0);
      return bytes.subarray(0, bytesRead);
    } finally {
      await file.close();
    }
  }

  return {
    async of(subject) {
      // A server: the identifier, and nothing the Core cannot know. `modelPath` is not looked at.
      if (isServerSttBackend(subject.backend)) return { name: subject.model, version: null, quantisation: null, sha256: null };
      if (subject.backend !== TranscriberBackendId.CPU_LOCAL || subject.modelPath === null) return { unknown: ModelProvenanceCode.NO_SOURCE_FOR_BACKEND };
      // Own property only: an identifier such as `constructor` never reads the prototype.
      const versions = deps.statedVersions();
      const version = Object.prototype.hasOwnProperty.call(versions, subject.model) ? versions[subject.model] : undefined;
      if (typeof version !== 'string' || version === '') return { unknown: ModelProvenanceCode.VERSION_NOT_STATED };
      let header: Uint8Array;
      try {
        header = await headerOf(subject.modelPath);
      } catch {
        return { unknown: ModelProvenanceCode.FILE_UNREADABLE };
      }
      const quantisation = quantisationOfGgmlHeader(header);
      if (!quantisation.ok) return { unknown: quantisation.code };
      let sha256: string;
      try {
        sha256 = await hashOf(subject.modelPath);
      } catch {
        return { unknown: ModelProvenanceCode.FILE_UNREADABLE };
      }
      return { name: subject.model, version, quantisation: quantisation.quantisation, sha256 };
    },
  };
}
