/**
 * WHAT THE HOST KNOWS ABOUT THE TRANSCRIBER (blueprint row 115; transcript spec §B.3, §B.4; CS-22).
 *
 * The STT configuration an operator edits lives in the table `stt_config`. Where the engine
 * executables and the model files ARE is not an operator's value and never comes from a request
 * (`TranscriberRuntime` of `@dems/transcriber`). The server's configuration module is frozen (P25)
 * and has no key for it, so the host states it in ONE file inside the data directory, beside the
 * connection file (decision D-115-1, put to the controller):
 *
 *     <dataDir>/transcriber/host.json
 *     { "version": 1,
 *       "cpuLocal":   { "binaryPath": "/abs/whisper-cli", "modelDir": "/abs/models", "threads": 4,
 *                       "modelVersions": { "<model identifier>": "<version>" } },
 *       "vad":        { "binaryPath": "/abs/vad-speech-segments", "modelDir": "/abs/models", "model": "ggml-silero-v5.1.2" },
 *       "omlxServer": { "settingsPath": "/abs/settings.json" } }
 *
 * Every member is optional. NO FILE: the host states nothing; `omlx-server` still works (it needs
 * no host value), `cpu-local` is refused as `CPU_LOCAL_RUNTIME_MISSING` when a configuration
 * selects it. A file that is there and cannot be read as this form is a FAULT, never "no file": the
 * boot step refuses it (CS-22: a wrong host value fails the boot, not the first session).
 *
 * `cpuLocal.modelVersions` (integration pass D8; manifest field 85): the VERSION of a model file is
 * stated by the party that put the file on the host - no member of the file and no output of the
 * engine states one. A model identifier without an entry has no version: its sessions are sealed
 * without a transcript document (`model-provenance.ts`). The Core reads the three other members
 * of the provenance itself and never from this file.
 *
 * NOT IN THE FILE, ON PURPOSE: `nicePath` and `priority`. The row leaves `nicePath` at its default
 * and the controller ruled `priority: 'required'` (D91), which this module states itself.
 *
 * The file holds paths. It holds no credential: the one key reference of the product is a column
 * of `stt_config`, and the key stays in the oMLX settings file (SEC35-14).
 */
import { readFileSync, statSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { detectPhysicalCores, type SileroVadRuntime, type TranscriberRuntime } from '@dems/transcriber';
import { z } from 'zod';

export const TRANSCRIBER_HOST_FOLDER = 'transcriber';
export const TRANSCRIBER_HOST_FILE = 'host.json';
/**
 * Where the transcript work of the sessions lives: `<mediaStoreRoot>/.transcriber/sessions/<id>`
 * (fix pass F-M7c; ruling D180). PER DATABASE: every Core has its own media store root, while the
 * data directory is shared by every lane of an installation - under it two databases with equal
 * session IDs shared one tap path, and a reset of one removed the live folder of the other. A
 * hidden folder of the store root, like `.sealing` and `.quarantine`: no package folder, under the
 * root's owner-only boot rule, on the volume of the recordings.
 */
export const TRANSCRIBER_SCRATCH_FOLDER = '.transcriber';
export const TRANSCRIPTION_SESSIONS_FOLDER = 'sessions';
export const TRANSCRIPTION_TAP_FILE = 'tap.pcm';
/** A host file larger than this is not one. */
const HOST_FILE_MAX_BYTES = 16_384;

const absolutePath = z
  .string()
  .min(2)
  .max(1024)
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused here
  .regex(/^\/[^\u0000-\u001f\u007f]*$/);
const count = z.number().int().min(1).max(256);
/** A stated model version: printable ASCII, no leading or trailing blank. A statement, never parsed. */
const modelVersion = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/);

const HostFileSchema = z.strictObject({
  version: z.literal(1),
  cpuLocal: z.strictObject({ binaryPath: absolutePath, modelDir: absolutePath, threads: count.optional(), processors: count.optional(), modelVersions: z.record(z.string().min(1).max(128), modelVersion).optional() }).optional(),
  vad: z.strictObject({ binaryPath: absolutePath, modelDir: absolutePath, model: z.string().min(1).max(128) }).optional(),
  omlxServer: z.strictObject({ settingsPath: absolutePath.optional() }).optional(),
});

export const TranscriberHostFailure = {
  /** The file is there and is not readable, not JSON, too large, or not of the form above. */
  HOST_FILE_INVALID: 'TRANSCRIBER_HOST_FILE_INVALID',
} as const;

/** Names a reason, never a value of the file. */
export class TranscriberHostError extends Error {
  readonly code = TranscriberHostFailure.HOST_FILE_INVALID;
  readonly reason: string;
  constructor(reason: string) {
    super('the transcriber host file cannot be used');
    this.name = 'TranscriberHostError';
    this.reason = reason;
  }
}

export interface TranscriberHost {
  /** `FILE`: the host file was read. `NONE`: the host states nothing. */
  readonly source: 'FILE' | 'NONE';
  readonly runtime: TranscriberRuntime;
  /** The VAD engine of the host, or null: fixed windows are used and flagged (`vad_fallback`). */
  readonly vad: SileroVadRuntime | null;
  /** `cpuLocal.modelVersions`: model identifier -> the version the host states for it. Empty: none stated. */
  readonly modelVersions: Readonly<Record<string, string>>;
  /** `<dataDir>/transcriber`: the host file and the engine's own work folder. Holds nothing per session (D180). */
  readonly root: string;
}

/** `<mediaStoreRoot>/.transcriber`: the scratch root of ONE Core (one database). */
export function transcriberScratchRoot(mediaStoreDir: string): string {
  return join(mediaStoreDir, TRANSCRIBER_SCRATCH_FOLDER);
}

/** `<mediaStoreRoot>/.transcriber/sessions/<sessionId>`: the tap, the checkpoint, the three transcript files and `work/`. */
export function sessionScratchDir(mediaStoreDir: string, sessionId: string): string {
  if (!/^SES-[0-9]{8}-[0-9]{4}$/.test(sessionId)) throw new TranscriberHostError('SESSION_ID_INVALID');
  return join(transcriberScratchRoot(mediaStoreDir), TRANSCRIPTION_SESSIONS_FOLDER, sessionId);
}

/** The PCM tap of a session: the path the capture plan names as `pcmTapPath` when its snapshot enables STT. */
export function sessionTapPath(mediaStoreDir: string, sessionId: string): string {
  return join(sessionScratchDir(mediaStoreDir, sessionId), TRANSCRIPTION_TAP_FILE);
}

function physicalCores(): number {
  try {
    return detectPhysicalCores().count;
  } catch {
    // The count is a bound for the thread plan, never a measurement: the logical count is the
    // safe answer on a host that does not say (the plan keeps cores back for capture either way).
    return Math.max(1, cpus().length);
  }
}

/**
 * Reads the host file of a data directory. Synchronous and once per app: the paths of a host do
 * not change while the server runs. Throws `TranscriberHostError` for a file that is there and is
 * not of the form; a missing file (or a missing data directory) is `source: 'NONE'`.
 */
export function readTranscriberHost(dataDir: string, cores: () => number = physicalCores): TranscriberHost {
  const root = join(dataDir, TRANSCRIBER_HOST_FOLDER);
  const file = join(root, TRANSCRIBER_HOST_FILE);
  let text: string | null;
  try {
    if (statSync(file).size > HOST_FILE_MAX_BYTES) throw new TranscriberHostError('TOO_LARGE');
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if (error instanceof TranscriberHostError) throw error;
    const errno = (error as NodeJS.ErrnoException).code;
    if (errno !== 'ENOENT' && errno !== 'ENOTDIR') throw new TranscriberHostError(typeof errno === 'string' ? errno : 'UNREADABLE');
    text = null;
  }
  if (text === null) return Object.freeze({ source: 'NONE', runtime: Object.freeze({ physicalCores: cores() }), vad: null, modelVersions: Object.freeze({}), root });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TranscriberHostError('NOT_JSON');
  }
  const parsed = HostFileSchema.safeParse(json);
  // The first path of the issue list is a member NAME of the form above, never a value.
  if (!parsed.success) throw new TranscriberHostError(`FORM:${parsed.error.issues[0]?.path.join('.') ?? ''}`);
  const stated = parsed.data;
  const runtime: TranscriberRuntime = {
    physicalCores: cores(),
    ...(stated.cpuLocal === undefined
      ? {}
      : {
          cpuLocal: {
            binaryPath: stated.cpuLocal.binaryPath,
            modelDir: stated.cpuLocal.modelDir,
            workDir: join(root, 'work'),
            // D91: no engine run on a host that cannot lower the engine's priority.
            priority: 'required' as const,
            ...(stated.cpuLocal.threads === undefined ? {} : { threads: stated.cpuLocal.threads }),
            ...(stated.cpuLocal.processors === undefined ? {} : { processors: stated.cpuLocal.processors }),
          },
        }),
    ...(stated.omlxServer?.settingsPath === undefined ? {} : { omlxServer: { settingsPath: stated.omlxServer.settingsPath } }),
  };
  const vad: SileroVadRuntime | null = stated.vad === undefined ? null : { binaryPath: stated.vad.binaryPath, modelDir: stated.vad.modelDir, model: stated.vad.model, priority: 'required' };
  return Object.freeze({ source: 'FILE', runtime: Object.freeze(runtime), vad, modelVersions: Object.freeze({ ...stated.cpuLocal?.modelVersions }), root });
}
