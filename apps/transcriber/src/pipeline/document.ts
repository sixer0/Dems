/**
 * THE MACHINE TRANSCRIPT DOCUMENT `dems.transcript/1` AND ITS HASH (transcript spec §A.5, §0.2
 * `TRANSCRIPT_DOC_VERSION`; evidence package spec §B.7 fields 79-93; blueprint row 78 / M6-W3).
 *
 * THE FORM. One JSON object with exactly five members (§A.5 "Document format"):
 *
 *   header         doc_version, session_id, language, backend, model (identifier + provenance),
 *                  audio (which audio was chunked), state (`ASSEMBLED` | `PARTIAL`),
 *                  partial_reason, chunks, failed_chunks, speaker_reason, diarization
 *   segments[]     { index, start_ms, end_ms, text, speaker | null } — media time of the sealed
 *                  file, whole milliseconds; exactly these five members on every backend (§B.5:
 *                  the QA members of one engine are not part of the sealed document)
 *   speaker_state  `LABELLED` | `UNAVAILABLE`
 *   intervals[]    the audio-source intervals of the session { source, from_ms, to_ms | null }
 *   qa_flags[]     sorted; carries the exact text `speaker labels unavailable` when unlabelled
 *
 * NO INSTANT AND NO DURATION OF A RUN IS IN THE DOCUMENT: the same committed chunks and the same
 * labels give the same bytes on every run and on every machine (and D230 holds by construction).
 *
 * THE CANONICALISATION RULE — the one the product already uses for its audit chain
 * (`canonicalJSON` of `@dems/shared/sim`): members of every object sorted by key in UTF-16
 * code-unit order, no whitespace between tokens, strings and numbers as ECMAScript
 * `JSON.stringify` writes them, arrays in their given order, the whole text encoded as UTF-8, no
 * byte-order mark and no final line break. The order in which a program built the object does not
 * matter; a value JSON cannot hold exactly is refused. The text of a segment is the engine's text
 * as committed, byte for byte: it is NOT re-normalised (it is evidence).
 *
 * THE HASH: SHA-256 over those UTF-8 bytes, lowercase hex (manifest field 81 `transcript.sha256`;
 * `transcripts.json_sha256`; `evidence_items.transcript_sha256`).
 *
 * SRT and WebVTT are RENDERINGS of the document, made by pure functions of it, each with its own
 * SHA-256 (`transcripts.srt_sha256`, `.vtt_sha256`; manifest fields 82, 83).
 *
 * A PARTIAL TRANSCRIPT IS NEVER PRESENTED AS COMPLETE (§A.5 "Failure behaviour"; D-EV-1). `state`
 * is `PARTIAL` when a chunk ended FAILED or when the audio of the session did not (all) reach the
 * transcriber (`TRANSCRIPT_AUDIO_UNAVAILABLE`, the tap signal of row 77); the text of a failed or
 * missing stretch is absent, never made up.
 */
import { createHash } from 'node:crypto';
import { transcriptModelFaults } from '@dems/shared/evidence-package';
import { canonicalJSON } from '@dems/shared/sim';
import { z } from 'zod';
import { TRANSCRIBER_BACKEND_IDS, TRANSCRIBER_LANGUAGE } from '../types';
import { ChunkStatus, type Checkpoint } from './checkpoint';
import { QaFlag, SPEAKER_LABELS_UNAVAILABLE_FLAG, TRANSCRIPT_DOC_VERSION } from './constants';
import { SpeakerState, SpeakerUnavailableReason, type SpeakerLabelling } from './diarization';
import { AudioSourceKind } from './media-time';

/** `transcript.state` of the manifest for an enabled transcriber (ev §B.7 field 92; `DISABLED` is the Core's, R-8). */
export const TranscriptDocumentState = { ASSEMBLED: 'ASSEMBLED', PARTIAL: 'PARTIAL' } as const;
export type TranscriptDocumentState = (typeof TranscriptDocumentState)[keyof typeof TranscriptDocumentState];

/** Why a document is PARTIAL. The first is the existing C3 reason (row 77, D-EV-1). */
export const TranscriptPartialReason = { TRANSCRIPT_AUDIO_UNAVAILABLE: 'TRANSCRIPT_AUDIO_UNAVAILABLE', CHUNKS_FAILED: 'CHUNKS_FAILED' } as const;
export type TranscriptPartialReason = (typeof TranscriptPartialReason)[keyof typeof TranscriptPartialReason];

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const wholeMs = z.number().int().nonnegative();

/**
 * The provenance of the STT model (ev §B.7 fields 84-87; `transcripts.model`). Given by the Core;
 * never a path. RECORDED AS FAR AS THE CORE CAN KNOW IT (decision D160): `version`, `quantisation`
 * and `sha256` are null exactly when the backend of the document is a SERVER (the Core reads no
 * model file of it), and set for every other backend. The members alone cannot say which: the
 * rule is held against the document's `backend` (`modelProvenanceFault`, the shared
 * `transcriptModelFaults`).
 */
export const TranscriptModelProvenanceSchema = z.strictObject({
  name: z.string().min(1),
  version: z.string().min(1).nullable(),
  quantisation: z.string().min(1).nullable(),
  sha256: hex64.nullable(),
});
export type TranscriptModelProvenance = z.output<typeof TranscriptModelProvenanceSchema>;

/** The first member of a provenance that the backend does not allow as it is, or null. A member name, never a value. */
export function modelProvenanceFault(backend: string, model: TranscriptModelProvenance): string | null {
  return transcriptModelFaults(backend, model)[0]?.member ?? null;
}

const DiarizationEngineSchema = z.strictObject({
  engine: z.string().min(1),
  embedding_model: z.string().min(1),
  embedding_model_sha256: hex64,
});

export const TranscriptDocumentSchema = z
  .strictObject({
    header: z.strictObject({
      doc_version: z.literal(TRANSCRIPT_DOC_VERSION),
      session_id: z.string().min(1),
      language: z.literal(TRANSCRIBER_LANGUAGE),
      backend: z.enum(TRANSCRIBER_BACKEND_IDS),
      model: z.strictObject({ id: z.string().min(1), ...TranscriptModelProvenanceSchema.shape }),
      audio: z.strictObject({ kind: z.enum([AudioSourceKind.PCM_TAP, AudioSourceKind.DECODED_FILE]), sample_rate_hz: z.number().int().positive() }),
      state: z.enum([TranscriptDocumentState.ASSEMBLED, TranscriptDocumentState.PARTIAL]),
      partial_reason: z.enum([TranscriptPartialReason.TRANSCRIPT_AUDIO_UNAVAILABLE, TranscriptPartialReason.CHUNKS_FAILED]).nullable(),
      chunks: z.number().int().nonnegative(),
      failed_chunks: z.number().int().nonnegative(),
      speaker_reason: z.enum(Object.values(SpeakerUnavailableReason) as [SpeakerUnavailableReason, ...SpeakerUnavailableReason[]]).nullable(),
      diarization: z.strictObject({
        num_speakers: z.number().int().nonnegative(),
        confidence: z.number().nullable(),
        engine: DiarizationEngineSchema.nullable(),
      }),
    }),
    segments: z.array(
      z.strictObject({
        index: z.number().int().nonnegative(),
        start_ms: wholeMs,
        end_ms: wholeMs,
        text: z.string().min(1),
        speaker: z.enum(['A', 'B']).nullable(),
      }),
    ),
    speaker_state: z.enum([SpeakerState.LABELLED, SpeakerState.UNAVAILABLE]),
    intervals: z.array(z.strictObject({ source: z.string().min(1), from_ms: wholeMs, to_ms: wholeMs.nullable() })),
    qa_flags: z.array(z.string().min(1)),
  })
  // The rules that tie the members together: a document that breaks one is not a transcript document.
  .refine((doc) => doc.segments.every((segment, index) => segment.index === index && segment.end_ms > segment.start_ms), { message: 'segments are numbered in order and have a positive length' })
  .refine((doc) => modelProvenanceFault(doc.header.backend, { name: doc.header.model.name, version: doc.header.model.version, quantisation: doc.header.model.quantisation, sha256: doc.header.model.sha256 }) === null, {
    message: 'the model version, quantisation and file hash are null exactly for a server backend',
  })
  .refine((doc) => (doc.header.state === TranscriptDocumentState.PARTIAL) === (doc.header.partial_reason !== null), { message: 'PARTIAL carries its reason, ASSEMBLED carries none' })
  .refine((doc) => doc.header.failed_chunks === 0 || doc.header.state === TranscriptDocumentState.PARTIAL, { message: 'a failed chunk makes the document PARTIAL' })
  .refine((doc) => (doc.speaker_state === SpeakerState.UNAVAILABLE) === (doc.header.speaker_reason !== null), { message: 'UNAVAILABLE carries its reason, LABELLED carries none' })
  .refine((doc) => (doc.speaker_state === SpeakerState.UNAVAILABLE) === doc.qa_flags.includes(SPEAKER_LABELS_UNAVAILABLE_FLAG), { message: 'the unlabelled flag is present exactly when the state is UNAVAILABLE' })
  .refine((doc) => doc.speaker_state === SpeakerState.LABELLED || doc.segments.every((segment) => segment.speaker === null), { message: 'an UNAVAILABLE document carries no label at all' })
  .refine((doc) => doc.qa_flags.every((flag, index) => index === 0 || (doc.qa_flags[index - 1] ?? '') < flag), { message: 'qa_flags are sorted and unique' });
export type TranscriptDocument = z.output<typeof TranscriptDocumentSchema>;

export interface DocumentInterval {
  readonly source: string;
  readonly fromMs: number;
  readonly toMs: number | null;
}

/** The committed segments of a checkpoint in document order: chunk by chunk, as the engine ordered them. */
export function committedSegments(checkpoint: Checkpoint): { startMs: number; endMs: number; text: string }[] {
  return checkpoint.chunks.flatMap((chunk) => (chunk.status === ChunkStatus.DONE ? (chunk.segments ?? []) : []).map((segment) => ({ startMs: segment.startMs, endMs: segment.endMs, text: segment.text })));
}

/** How many chunks ended FAILED (manifest field 93 `transcript.failedChunks`). */
export function failedChunkCount(checkpoint: Checkpoint): number {
  return checkpoint.chunks.filter((chunk) => chunk.status === ChunkStatus.FAILED).length;
}

/**
 * Builds the document from a checkpoint whose work is over, the label map and the header facts.
 * Pure. Throws (a zod error) when the parts do not make a valid document — for instance a label
 * map of another length than the segments: such a map is never applied in part.
 */
export function buildTranscriptDocument(input: { checkpoint: Checkpoint; labelling: SpeakerLabelling; model: TranscriptModelProvenance; intervals: readonly DocumentInterval[]; intervalsTruncated?: boolean }): TranscriptDocument {
  const { checkpoint, labelling } = input;
  const segments = committedSegments(checkpoint);
  if (labelling.labels.length !== segments.length) throw new RangeError('the label map does not belong to these segments');
  const failed = failedChunkCount(checkpoint);
  const partialReason = checkpoint.audioUnavailable ? TranscriptPartialReason.TRANSCRIPT_AUDIO_UNAVAILABLE : failed > 0 ? TranscriptPartialReason.CHUNKS_FAILED : null;
  const flags = new Set(checkpoint.qaFlags);
  if (labelling.state === SpeakerState.UNAVAILABLE) flags.add(SPEAKER_LABELS_UNAVAILABLE_FLAG);
  // Fix wave K (G81b-04; transcript spec §D.2 "durable-part case"): the caller says that the recording was INTERRUPTED
  // (`intervalsTruncated`). An interval that still has no end is then a TRUNCATED interval map - the recording ended
  // before the interval was closed. The document does not invent the end (the manifest states where the sealed media
  // ends); it records `intervals_incomplete`, as the spec says. A recording that was stopped is not told so: its
  // document is byte for byte what it was (an open last interval there means "until the end of the recording").
  if (input.intervalsTruncated === true && input.intervals.some((interval) => interval.toMs === null)) flags.add(QaFlag.INTERVALS_INCOMPLETE);
  const engine = labelling.engine;
  return TranscriptDocumentSchema.parse({
    header: {
      doc_version: TRANSCRIPT_DOC_VERSION,
      session_id: checkpoint.sessionId,
      language: checkpoint.language,
      backend: checkpoint.backend,
      model: { id: checkpoint.model, ...TranscriptModelProvenanceSchema.parse(input.model) },
      audio: { kind: checkpoint.audio.kind, sample_rate_hz: checkpoint.audio.sampleRateHz },
      state: partialReason === null ? TranscriptDocumentState.ASSEMBLED : TranscriptDocumentState.PARTIAL,
      partial_reason: partialReason,
      chunks: checkpoint.chunks.length,
      failed_chunks: failed,
      speaker_reason: labelling.reason,
      diarization: {
        num_speakers: labelling.numSpeakers,
        confidence: labelling.confidence,
        engine:
          engine === null
            ? null
            : {
                engine: engine.engine,
                embedding_model: engine.embeddingModel,
                embedding_model_sha256: engine.embeddingModelSha256,
              },
      },
    },
    segments: segments.map((segment, index) => ({ index, start_ms: segment.startMs, end_ms: segment.endMs, text: segment.text, speaker: labelling.labels[index] ?? null })),
    speaker_state: labelling.state,
    intervals: input.intervals.map((interval) => ({ source: interval.source, from_ms: interval.fromMs, to_ms: interval.toMs })),
    qa_flags: [...flags].sort(),
  });
}

export const sha256HexOfText = (text: string): string => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');

/** The canonical text of a document (the rule at the head of this file). The document is validated first. */
export function canonicalTranscriptJson(document: TranscriptDocument): string {
  return canonicalJSON(TranscriptDocumentSchema.parse(document));
}

/** The hash of a document: SHA-256 over the UTF-8 bytes of its canonical text. */
export function transcriptDocumentSha256(document: TranscriptDocument): string {
  return sha256HexOfText(canonicalTranscriptJson(document));
}

function clock(ms: number, separator: ',' | '.'): string {
  const pad = (value: number, width: number): string => String(value).padStart(width, '0');
  return `${pad(Math.floor(ms / 3_600_000), 2)}:${pad(Math.floor(ms / 60_000) % 60, 2)}:${pad(Math.floor(ms / 1000) % 60, 2)}${separator}${pad(ms % 1000, 3)}`;
}

/** A cue text may not hold an empty line or the arrow of a timing line: both would break the cue apart. */
const cueText = (text: string): string =>
  text
    .replace(/\r\n?|\n/g, ' ')
    .replace(/-->/g, '->')
    .trim();

/** SubRip rendering: one cue per segment, numbered from 1; a labelled segment starts with `[A] ` or `[B] `. */
export function renderSrt(document: TranscriptDocument): string {
  return document.segments.map((segment) => `${segment.index + 1}\n${clock(segment.start_ms, ',')} --> ${clock(segment.end_ms, ',')}\n${segment.speaker === null ? '' : `[${segment.speaker}] `}${cueText(segment.text)}\n\n`).join('');
}

/** WebVTT rendering: one cue per segment; a labelled segment is a voice span `<v A>`. */
export function renderVtt(document: TranscriptDocument): string {
  const escape = (text: string): string => cueText(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `WEBVTT\n\n${document.segments.map((segment) => `${segment.index + 1}\n${clock(segment.start_ms, '.')} --> ${clock(segment.end_ms, '.')}\n${segment.speaker === null ? '' : `<v ${segment.speaker}>`}${escape(segment.text)}\n\n`).join('')}`;
}

/** The three texts of an assembled transcript and their hashes. Pure. */
export interface RenderedTranscript {
  readonly json: string;
  readonly sha256: string;
  readonly srt: string;
  readonly srtSha256: string;
  readonly vtt: string;
  readonly vttSha256: string;
}

export function renderTranscript(document: TranscriptDocument): RenderedTranscript {
  const json = canonicalTranscriptJson(document);
  const srt = renderSrt(document);
  const vtt = renderVtt(document);
  return { json, sha256: sha256HexOfText(json), srt, srtSha256: sha256HexOfText(srt), vtt, vttSha256: sha256HexOfText(vtt) };
}

/**
 * What the Core stores for a sealed transcript in ONE unit of work (dbc-3 §B.8, §B.11): the row of
 * `transcripts` and the value of `evidence_items.transcript_sha256`. Member names and shapes are
 * the manifest's (ev §B.7 fields 81-93).
 */
export interface TranscriptSealRecord {
  readonly docVersion: typeof TRANSCRIPT_DOC_VERSION;
  /** `transcripts.json_sha256` and `evidence_items.transcript_sha256`. */
  readonly jsonSha256: string;
  readonly srtSha256: string;
  readonly vttSha256: string;
  /** `transcripts.model` (ev fields 84-87). */
  readonly model: { readonly name: string; readonly version: string | null; readonly quantisation: string | null; readonly modelSha256: string | null; readonly params: { readonly backend: string; readonly modelId: string; readonly language: string } };
  /** `transcripts.diarization` (ev fields 88-90), with the reason of an unlabelled transcript. */
  readonly diarization: { readonly numSpeakers: number; readonly status: SpeakerState; readonly confidence: number | null; readonly reason: SpeakerUnavailableReason | null };
  /** `transcripts.labels_status` (ev field 91). */
  readonly labelsStatus: SpeakerState;
  /** Manifest fields 92 and 93. */
  readonly state: TranscriptDocumentState;
  readonly partialReason: TranscriptPartialReason | null;
  readonly failedChunks: number;
}

export function sealRecordOf(document: TranscriptDocument, rendered: RenderedTranscript): TranscriptSealRecord {
  const { header } = document;
  return {
    docVersion: TRANSCRIPT_DOC_VERSION,
    jsonSha256: rendered.sha256,
    srtSha256: rendered.srtSha256,
    vttSha256: rendered.vttSha256,
    model: { name: header.model.name, version: header.model.version, quantisation: header.model.quantisation, modelSha256: header.model.sha256, params: { backend: header.backend, modelId: header.model.id, language: header.language } },
    diarization: { numSpeakers: header.diarization.num_speakers, status: document.speaker_state, confidence: header.diarization.confidence, reason: header.speaker_reason },
    labelsStatus: document.speaker_state,
    state: header.state,
    partialReason: header.partial_reason,
    failedChunks: header.failed_chunks,
  };
}
