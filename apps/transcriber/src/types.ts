/**
 * The contract of the `TranscriberAdapter` (blueprint row 76 / M6-W1; transcript spec §B.1, §B.5).
 *
 * One interface, two backends. Both normalise to `TranscribeResult`, so the document that row 78
 * assembles from it has the same shape whichever engine ran (W1-C12). `start`/`end` are SECONDS
 * relative to the chunk at this boundary; the conversion to integer milliseconds on the session
 * timeline belongs to the assembly stage (§A.5), not to a backend.
 *
 * QA members exist only where the engine reported them: they are omitted, never zero-filled
 * (§B.5; row 12 §8.1).
 */
import { z } from 'zod';

/** The two backends (OD-24; D7). The same two texts as `SttBackend` of `@dems/shared/api`. */
export const TranscriberBackendId = { OMLX_SERVER: 'omlx-server', CPU_LOCAL: 'cpu-local' } as const;
export type TranscriberBackendId = (typeof TranscriberBackendId)[keyof typeof TranscriberBackendId];
export const TRANSCRIBER_BACKEND_IDS = Object.values(TranscriberBackendId) as readonly TranscriberBackendId[];

/** The only language (OD-20). Fixed: no auto-detect on either backend. */
export const TRANSCRIBER_LANGUAGE = 'id';
/** The sample rate of chunk PCM (§0.2 `STT_SAMPLE_RATE_HZ`). */
export const STT_SAMPLE_RATE_HZ = 16_000;

/** Where the audio of a chunk is: a file the engine can read, or 16 kHz mono signed 16-bit PCM. */
export type ChunkAudio =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'pcm16'; readonly samples: Int16Array };

export interface TranscriberChunk {
  readonly audio: ChunkAudio;
  /** 16000 for `pcm16`; for `file` the engine reads the rate from the container. */
  readonly sampleRateHz: number;
  /** Where the chunk starts on the session timeline. Carried, never applied here (§A.5). */
  readonly offsetMs: number;
  readonly durationMs: number;
}

export interface TranscribeOptions {
  readonly language: typeof TRANSCRIBER_LANGUAGE;
  /** Domain-term biasing: whisper `--prompt` / the `prompt` form member. */
  readonly prompt?: string;
  /** Joins the log lines of one piece of work (a session, a chunk). Never a credential. */
  readonly correlationId?: string;
}

export const TranscriptSegmentSchema = z.strictObject({
  id: z.number().int().nonnegative(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string(),
  avgLogprob: z.number().optional(),
  compressionRatio: z.number().optional(),
  noSpeechProb: z.number().optional(),
  seek: z.number().optional(),
  temperature: z.number().optional(),
  tokens: z.array(z.number()).optional(),
  language: z.string().optional(),
});
export type TranscriptSegment = z.output<typeof TranscriptSegmentSchema>;

export const TranscribeResultSchema = z.strictObject({
  engine: z.enum(TRANSCRIBER_BACKEND_IDS),
  model: z.string().min(1),
  language: z.literal(TRANSCRIBER_LANGUAGE),
  text: z.string(),
  segments: z.array(TranscriptSegmentSchema),
});
export type TranscribeResult = z.output<typeof TranscribeResultSchema>;

/** The members every segment carries on every backend. */
export const MANDATORY_SEGMENT_KEYS = ['end', 'id', 'start', 'text'] as const;
/** The members only some engines report. */
export const QA_SEGMENT_KEYS = ['avgLogprob', 'compressionRatio', 'language', 'noSpeechProb', 'seek', 'temperature', 'tokens'] as const;

/**
 * The key sets of a result, without its content: the members of the top level, and the UNION of the
 * members its segments carry. Two results that both pass the strict schema can still differ here,
 * and only in the QA members (`QA_SEGMENT_KEYS`): that is the difference §B.5 allows.
 *
 * "The identical document shape" (M6-AD-1) is proven by the strict schema, not by this helper: a
 * result with one member more or one mandatory member less does not parse under
 * `TranscribeResultSchema`. This helper states what is left to differ, so that a test can say it.
 */
export interface ResultShape {
  readonly top: readonly string[];
  readonly segmentKeys: readonly string[];
}

export function resultShape(result: TranscribeResult): ResultShape {
  const keys = new Set<string>();
  for (const segment of result.segments) for (const key of Object.keys(segment)) keys.add(key);
  return { top: Object.keys(result).sort(), segmentKeys: [...keys].sort() };
}

/** The segment members of `shape` that are not mandatory: empty, or QA members only. */
export function optionalSegmentKeys(shape: ResultShape): string[] {
  return shape.segmentKeys.filter((key) => !(MANDATORY_SEGMENT_KEYS as readonly string[]).includes(key));
}

/** The engine-independent record of one engine run, for evidence. It carries no time and no header. */
export interface EngineRunRecord {
  readonly backend: TranscriberBackendId;
  /** `cpu-local`: the executable and its arguments, as passed. `omlx-server`: empty. */
  readonly argv: readonly string[];
  /** `omlx-server`: the request path. `cpu-local`: null. */
  readonly requestPath: string | null;
  /** Exit code or HTTP status. */
  readonly status: number;
  /** SHA-256 of the bytes the engine answered with, before any normalisation. */
  readonly rawSha256: string;
  readonly rawBytes: number;
  /** `cpu-local`: the niceness the engine was started at (through `nice`), or null when the host cannot lower it. */
  readonly nice: number | null;
}

export interface TranscriberBackend {
  readonly id: TranscriberBackendId;
  readonly model: string;
  transcribe(chunk: TranscriberChunk, options: TranscribeOptions): Promise<TranscribeResult>;
}

export const TranscriberErrorCode = {
  /** The configuration names no known backend, another language, a bad model name or thread bound. */
  CONFIG_INVALID: 'CONFIG_INVALID',
  /** The endpoint is not `http://127.0.0.1` or `http://localhost` (OD-13). */
  ENDPOINT_NOT_LOOPBACK: 'ENDPOINT_NOT_LOOPBACK',
  /** The engine executable is absent or not executable. */
  ENGINE_NOT_FOUND: 'ENGINE_NOT_FOUND',
  /** The model file of the configured backend is absent (CS-22). */
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  /** The server does not serve the configured model. */
  MODEL_NOT_AVAILABLE: 'MODEL_NOT_AVAILABLE',
  /** The model file leads outside the model directory (a link). */
  MODEL_OUTSIDE_MODEL_DIR: 'MODEL_OUTSIDE_MODEL_DIR',
  AUDIO_NOT_FOUND: 'AUDIO_NOT_FOUND',
  /** The chunk audio is not what the engine is given: 16 kHz PCM, or a mono 16-bit PCM WAV file. */
  AUDIO_FORMAT_UNSUPPORTED: 'AUDIO_FORMAT_UNSUPPORTED',
  /** The host cannot lower the priority of the engine, and the configuration requires it. */
  PRIORITY_NOT_APPLIED: 'PRIORITY_NOT_APPLIED',
  /** The engine ran and failed (non-zero exit, HTTP error). */
  ENGINE_FAILED: 'ENGINE_FAILED',
  /** The engine answered with something that is not its documented output. */
  BAD_ENGINE_OUTPUT: 'BAD_ENGINE_OUTPUT',
  /** The engine reported another language than `id`. */
  LANGUAGE_MISMATCH: 'LANGUAGE_MISMATCH',
  UNREACHABLE: 'UNREACHABLE',
  TIMEOUT: 'TIMEOUT',
  CREDENTIAL_REJECTED: 'CREDENTIAL_REJECTED',
  /** The credential reference names a store or a member this loader does not read. */
  CREDENTIAL_REF_UNSUPPORTED: 'CREDENTIAL_REF_UNSUPPORTED',
  /** The referenced credential could not be read. The message never carries file content. */
  CREDENTIAL_UNAVAILABLE: 'CREDENTIAL_UNAVAILABLE',
  /** The fixture bytes are not the sealed ones. */
  FIXTURE_CORRUPT: 'FIXTURE_CORRUPT',
  FIXTURE_NOT_FOUND: 'FIXTURE_NOT_FOUND',
} as const;
export type TranscriberErrorCode = (typeof TranscriberErrorCode)[keyof typeof TranscriberErrorCode];

export type ErrorDetail = Readonly<Record<string, string | number | boolean | null>>;

/** Every refusal and failure of this workspace. `detail` holds codes and counts, never a secret. */
export class TranscriberError extends Error {
  readonly code: TranscriberErrorCode;
  readonly detail: ErrorDetail;

  constructor(code: TranscriberErrorCode, message: string, detail: ErrorDetail = {}) {
    super(message);
    this.name = 'TranscriberError';
    this.code = code;
    this.detail = detail;
  }
}
