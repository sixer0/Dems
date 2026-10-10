/**
 * THE CORE'S OWN READING OF THE MACHINE TRANSCRIPT `dems.transcript/1` (transcript spec §A.5;
 * evidence package spec §B.7; blueprint row 79).
 *
 * The transcriber writes the document; the Core seals it. Before it does, it reads the bytes it
 * is about to seal with a schema of its own — strict, every object closed — and judges two things
 * the transcriber cannot vouch for from inside:
 *
 *   1. the document is a `dems.transcript/1` document and its members agree with each other
 *      (PARTIAL carries its reason; a failed chunk makes it PARTIAL; an unlabelled document
 *      carries the flag and no label);
 *   2. NO TEXT WITHOUT A COMMITTED CHUNK (D-EV-1; ev §E.5 "assembled from committed chunks only").
 *      Every segment of the document must be a segment of a DONE row of `transcript_chunks` of
 *      this session — same start, same end, same text. A chunk that ended FAILED has no segments
 *      in its row, so it can have no text in the document; a placeholder ("[inaudible]", an
 *      ellipsis, a repeated neighbour) is text that no committed row holds, and is refused.
 *
 * The second record is independent of the first: the document comes from the checkpoint FILE of
 * the session, the rows are its mirror in the database, written chunk by chunk as each one was
 * committed. A document that says more than the rows is not sealed.
 *
 * The form is held to the transcriber's by a test of this folder that reads documents the real
 * `@dems/transcriber` wrote. Pure: no file, no statement, no clock.
 */
import { transcriptModelFaults } from '@dems/shared/evidence-package';
import { z } from 'zod';
import type { ChunkAttempt } from '../../modules/transcript-chunks';

export const TRANSCRIPT_DOC_VERSION = 'dems.transcript/1';
/** transcript spec §A.4: the exact flag of a transcript sealed without speaker labels. */
export const SPEAKER_LABELS_UNAVAILABLE_FLAG = 'speaker labels unavailable';

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const wholeMs = z.number().int().nonnegative();
const code = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/);

export const SealedTranscriptDocumentSchema = z
  .strictObject({
    header: z.strictObject({
      doc_version: z.literal(TRANSCRIPT_DOC_VERSION),
      session_id: z.string().min(1),
      language: z.literal('id'),
      backend: z.enum(['omlx-server', 'cpu-local']),
      // D160: version, quantisation and file hash are null exactly for a server backend (the refinement below).
      model: z.strictObject({ id: z.string().min(1), name: z.string().min(1), version: z.string().min(1).nullable(), quantisation: z.string().min(1).nullable(), sha256: hex64.nullable() }),
      audio: z.strictObject({ kind: z.string().min(1), sample_rate_hz: z.number().int().positive() }),
      state: z.enum(['ASSEMBLED', 'PARTIAL']),
      partial_reason: z.enum(['TRANSCRIPT_AUDIO_UNAVAILABLE', 'CHUNKS_FAILED']).nullable(),
      chunks: z.number().int().nonnegative(),
      failed_chunks: z.number().int().nonnegative(),
      speaker_reason: code.nullable(),
      diarization: z.strictObject({
        num_speakers: z.number().int().nonnegative(),
        confidence: z.number().nullable(),
        engine: z.strictObject({ engine: z.string().min(1), embedding_model: z.string().min(1), embedding_model_sha256: hex64 }).nullable(),
      }),
    }),
    segments: z.array(z.strictObject({ index: z.number().int().nonnegative(), start_ms: wholeMs, end_ms: wholeMs, text: z.string().min(1), speaker: z.enum(['A', 'B']).nullable() })),
    speaker_state: z.enum(['LABELLED', 'UNAVAILABLE']),
    intervals: z.array(z.strictObject({ source: z.string().min(1), from_ms: wholeMs, to_ms: wholeMs.nullable() })),
    qa_flags: z.array(z.string().min(1)),
  })
  .refine((doc) => doc.segments.every((segment, index) => segment.index === index && segment.end_ms > segment.start_ms), { message: 'segments are numbered in order and have a positive length' })
  .refine((doc) => transcriptModelFaults(doc.header.backend, doc.header.model).length === 0, { message: 'the model version, quantisation and file hash are null exactly for a server backend' })
  .refine((doc) => (doc.header.state === 'PARTIAL') === (doc.header.partial_reason !== null), { message: 'PARTIAL carries its reason, ASSEMBLED carries none' })
  .refine((doc) => doc.header.failed_chunks === 0 || doc.header.state === 'PARTIAL', { message: 'a failed chunk makes the document PARTIAL' })
  .refine((doc) => doc.header.failed_chunks <= doc.header.chunks, { message: 'no more failed chunks than chunks' })
  .refine((doc) => (doc.speaker_state === 'UNAVAILABLE') === (doc.header.speaker_reason !== null), { message: 'UNAVAILABLE carries its reason, LABELLED carries none' })
  .refine((doc) => (doc.speaker_state === 'UNAVAILABLE') === doc.qa_flags.includes(SPEAKER_LABELS_UNAVAILABLE_FLAG), { message: 'the unlabelled flag is present exactly when the state is UNAVAILABLE' })
  .refine((doc) => doc.speaker_state === 'LABELLED' || doc.segments.every((segment) => segment.speaker === null), { message: 'an UNAVAILABLE document carries no label' });
export type SealedTranscriptDocument = z.output<typeof SealedTranscriptDocumentSchema>;

/** The document of the bytes of `transcript.json`, or null when they are not one. Never throws. */
export function readSealedTranscriptDocument(bytes: Uint8Array): SealedTranscriptDocument | null {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  const parsed = SealedTranscriptDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** One committed segment as a DONE row holds it (the transcriber's `CommittedSegment`; its QA members are not compared). */
const committedKey = (startMs: number, endMs: number, text: string): string => `${startMs}\u0000${endMs}\u0000${text}`;

function committedSegmentKeys(rows: readonly ChunkAttempt[]): Map<string, number> {
  const keys = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== 'DONE' || row.segments === null) continue;
    for (const segment of row.segments) {
      if (typeof segment !== 'object' || segment === null) continue;
      const { startMs, endMs, text } = segment as { startMs?: unknown; endMs?: unknown; text?: unknown };
      if (typeof startMs !== 'number' || typeof endMs !== 'number' || typeof text !== 'string') continue;
      const key = committedKey(startMs, endMs, text);
      keys.set(key, (keys.get(key) ?? 0) + 1);
    }
  }
  return keys;
}

/**
 * The indices of the document segments that NO committed chunk row holds. Empty: every word of
 * the document was committed by a chunk. Every DONE row counts, also one of an earlier plan (a
 * checkpoint file that was lost and rebuilt leaves such rows): text is refused only when no
 * committed row at all holds it.
 */
export function uncommittedSegments(document: SealedTranscriptDocument, rows: readonly ChunkAttempt[]): number[] {
  const committed = committedSegmentKeys(rows);
  return document.segments.filter((segment) => !committed.has(committedKey(segment.start_ms, segment.end_ms, segment.text))).map((segment) => segment.index);
}
