/**
 * Backend `omlx-server`: the oMLX server of this Mac, an OpenAI-compatible endpoint on loopback
 * (transcript spec §B.2; D7). DEVELOPMENT AND FUNCTIONAL CHECKS ONLY: it runs on the Apple GPU by
 * design and is not the shipped engine.
 *
 * Request: `POST /v1/audio/transcriptions`, multipart `file` / `model` / `language` [/ `prompt`].
 * Answer: `text`, `language`, `segments[]`. Whisper reports QA members per segment; qwen3 reports
 * `start`/`end`/`text` only, so every QA member is optional and is carried only when present.
 *
 * THE `duration` MEMBER OF THE ANSWER IS NEVER READ: the server reports 0.0 or a wrong value
 * (row 12 §6; D10(d)).
 *
 * DEMS never starts, stops, restarts or upgrades this server and never binds its port (D7(d)).
 * Calls are serialised by the adapter's queue.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { OmlxServerConfig } from '../config';
import type { TranscriberLog } from '../log';
import {
  TRANSCRIBER_LANGUAGE,
  TranscribeResultSchema,
  TranscriberBackendId,
  TranscriberError,
  TranscriberErrorCode,
  type EngineRunRecord,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscriberBackend,
  type TranscriberChunk,
  type TranscriptSegment,
} from '../types';
import { assertChunkAudio, encodeWavPcm16, WAV_HEAD_BYTES } from '../wav';
import { OMLX_PATHS, type OmlxHttp } from './omlx-http';

const SOURCE = 'transcriber.omlxServer';

const finite = z.number().refine((value) => Number.isFinite(value));

const OmlxSegmentSchema = z.looseObject({
  start: finite,
  end: finite,
  text: z.string(),
  avg_logprob: finite.nullish(),
  compression_ratio: finite.nullish(),
  no_speech_prob: finite.nullish(),
  seek: finite.nullish(),
  temperature: finite.nullish(),
  tokens: z.array(finite).nullish(),
});

const OmlxTranscriptionSchema = z.looseObject({
  text: z.string(),
  language: z.string().nullish(),
  segments: z.array(OmlxSegmentSchema),
});

/** The names an engine uses for Indonesian. Anything else is a `LANGUAGE_MISMATCH`. */
const INDONESIAN = new Set(['id', 'indonesian', 'ind']);

export interface OmlxServerDeps {
  readonly http: OmlxHttp;
  readonly log: TranscriberLog;
  readonly onEngineRun?: (record: EngineRunRecord) => void;
}

function optional<K extends string>(key: K, value: number | null | undefined): Partial<Record<K, number>> {
  return value === null || value === undefined ? {} : ({ [key]: value } as Record<K, number>);
}

export function createOmlxServerBackend(config: OmlxServerConfig, deps: OmlxServerDeps): TranscriberBackend {
  const { http, log } = deps;

  async function transcribe(chunk: TranscriberChunk, options: TranscribeOptions): Promise<TranscribeResult> {
    const correlationId = options.correlationId;
    const fail = (code: TranscriberErrorCode, message: string, detail: Record<string, string | number | boolean | null>): TranscriberError => {
      const error = new TranscriberError(code, message, detail);
      log.error({ source: `${SOURCE}.transcribe`, message: 'omlx-server transcription failed', error, context: { code, model: config.model, ...detail }, correlationId });
      return error;
    };

    if (options.language !== TRANSCRIBER_LANGUAGE) throw fail(TranscriberErrorCode.CONFIG_INVALID, 'the transcriber transcribes Indonesian only', { reason: 'LANGUAGE_NOT_SUPPORTED' });

    if (chunk.audio.kind === 'pcm16') {
      try {
        assertChunkAudio(chunk, null);
      } catch (error) {
        if (error instanceof TranscriberError) throw fail(error.code, error.message, { ...error.detail });
        throw error;
      }
    }
    let audio: Uint8Array<ArrayBuffer>;
    try {
      // A copy into a plain ArrayBuffer: what a Blob part must be.
      audio = new Uint8Array(chunk.audio.kind === 'file' ? await readFile(chunk.audio.path) : encodeWavPcm16(chunk.audio.samples, chunk.sampleRateHz));
    } catch {
      throw fail(TranscriberErrorCode.AUDIO_NOT_FOUND, 'the chunk audio could not be read', { reason: 'AUDIO_NOT_FOUND' });
    }

    if (chunk.audio.kind === 'file') {
      try {
        assertChunkAudio(chunk, audio.subarray(0, WAV_HEAD_BYTES));
      } catch (error) {
        if (error instanceof TranscriberError) throw fail(error.code, error.message, { ...error.detail });
        throw error;
      }
    }

    const form = new FormData();
    form.set('file', new Blob([audio], { type: 'audio/wav' }), 'chunk.wav');
    form.set('model', config.model);
    form.set('language', config.language);
    if (options.prompt !== undefined && options.prompt !== '') form.set('prompt', options.prompt);

    let response;
    try {
      response = await http.postForm(OMLX_PATHS.TRANSCRIPTIONS, form);
    } catch (error) {
      if (error instanceof TranscriberError) throw fail(error.code, error.message, { ...error.detail });
      throw fail(TranscriberErrorCode.UNREACHABLE, 'the transcriber server could not be reached', { reason: 'UNREACHABLE' });
    }
    deps.onEngineRun?.({
      backend: TranscriberBackendId.OMLX_SERVER,
      argv: [],
      requestPath: OMLX_PATHS.TRANSCRIPTIONS,
      status: response.status,
      rawSha256: createHash('sha256').update(response.body).digest('hex'),
      rawBytes: response.body.length,
      nice: null,
    });

    if (response.status === 401 || response.status === 403) {
      throw fail(TranscriberErrorCode.CREDENTIAL_REJECTED, 'the transcriber server refused the credential', { reason: 'CREDENTIAL_REJECTED', status: response.status });
    }
    if (response.status === 404) {
      throw fail(TranscriberErrorCode.MODEL_NOT_AVAILABLE, 'the transcriber server does not serve the configured model', { reason: 'MODEL_NOT_AVAILABLE', status: response.status });
    }
    if (response.status < 200 || response.status > 299) {
      // The body of an error answer is not quoted: only its status.
      throw fail(TranscriberErrorCode.ENGINE_FAILED, 'the transcriber server answered with an error', { reason: 'HTTP_ERROR', status: response.status });
    }

    let json: unknown;
    try {
      json = JSON.parse(Buffer.from(response.body).toString('utf8'));
    } catch {
      throw fail(TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'the transcriber server answer is not JSON', { reason: 'OUTPUT_NOT_JSON' });
    }
    const parsed = OmlxTranscriptionSchema.safeParse(json);
    if (!parsed.success) throw fail(TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'the transcriber server answer has an unknown form', { reason: 'OUTPUT_FORM_UNKNOWN' });

    const reported = parsed.data.language;
    if (reported !== null && reported !== undefined && reported !== '' && !INDONESIAN.has(reported.toLowerCase())) {
      throw fail(TranscriberErrorCode.LANGUAGE_MISMATCH, 'the transcriber server reported another language', { reason: 'LANGUAGE_MISMATCH' });
    }
    const text = parsed.data.text.trim();
    if (parsed.data.segments.length === 0 && text !== '') {
      // Text without a single timestamp: a segment would have to be invented. It is not.
      throw fail(TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'the transcriber server answered text without segments', { reason: 'SEGMENTS_MISSING' });
    }

    const segments: TranscriptSegment[] = parsed.data.segments.map((segment, index) => ({
      id: index,
      start: Math.max(0, segment.start),
      end: Math.max(0, segment.end),
      text: segment.text.trim(),
      ...optional('avgLogprob', segment.avg_logprob),
      ...optional('compressionRatio', segment.compression_ratio),
      ...optional('noSpeechProb', segment.no_speech_prob),
      ...optional('seek', segment.seek),
      ...optional('temperature', segment.temperature),
      ...(segment.tokens === null || segment.tokens === undefined ? {} : { tokens: segment.tokens }),
    }));
    return TranscribeResultSchema.parse({ engine: TranscriberBackendId.OMLX_SERVER, model: config.model, language: TRANSCRIBER_LANGUAGE, text, segments });
  }

  return Object.freeze({ id: TranscriberBackendId.OMLX_SERVER, model: config.model, transcribe });
}
