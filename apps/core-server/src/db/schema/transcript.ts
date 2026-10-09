/**
 * Typed schema, group `transcript`: T-36 `transcript_chunks`, T-37 `transcripts`,
 * T-38 `transcript_revisions` (database contract dbc-3 §B.7 to §B.9).
 *
 * The three tables separate the three lifetimes of a transcript: the incremental STT work of one
 * recording (`transcript_chunks`, written while the session is still running and rebuilt by a
 * reset), the sealed machine transcript of one evidence item (`transcripts`, revision 0, INSERT
 * only, byte-unchanged forever), and the signed corrections on top of it (`transcript_revisions`,
 * INSERT only, chained by `parent_sha256`) (R-5, OD-15).
 *
 * `transcript_chunks.session_id` carries no foreign key for the same reason as the recording group
 * (D-DB-07): the chunk rows exist before any history row does. `transcripts` and
 * `transcript_revisions` hang off `evidence_items` and are therefore unreachable until the item is
 * sealed, which is exactly when they are written.
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, integer, jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { code, hex64, matches, oneOf, sessionId, signatureRule, signatureValue } from './checks';
import { evidenceItems } from './evidence';
import { operators } from './rbac';
import {
  LABELS_STATUS,
  TRANSCRIPT_CHUNK_STATUS,
  TRANSCRIPT_SIGNATURE_ALGORITHM,
  type LabelsStatusValue,
  type TranscriptChunkStatusValue,
  type TranscriptSignatureAlgorithmValue,
} from './value-sets';

/**
 * T-36. One row per VAD chunk while recording: the resume-after-kill checkpoint and the speaker
 * embeddings of the 2-speaker clustering (OD-20). A DONE chunk must hold its segments and its
 * instant, so a resume never mistakes an unfinished chunk for finished work (NM-06). The model
 * path is configurable (R-7) and the diarization artifact bytes live outside the database in the
 * git-ignored model/cache store (OD-25): both columns are `CODE` references, never payloads.
 */
export const transcriptChunks = pgTable(
  'transcript_chunks',
  {
    sessionId: text('session_id').notNull(),
    seq: integer('seq').notNull(),
    audioFromMs: bigint('audio_from_ms', { mode: 'number' }).notNull(),
    audioToMs: bigint('audio_to_ms', { mode: 'number' }).notNull(),
    status: text('status').$type<TranscriptChunkStatusValue>().notNull().default('PENDING'),
    segments: jsonb('segments'),
    embeddingRef: text('embedding_ref'),
    modelId: text('model_id'),
    computedAt: bigint('computed_at', { mode: 'number' }),
  },
  (t) => [
    primaryKey({ name: 'transcript_chunks_pkey', columns: [t.sessionId, t.seq] }),
    check('transcript_chunks_session_check', sessionId(t.sessionId)),
    check('transcript_chunks_seq_check', sql`${t.seq} >= 1`),
    check(
      'transcript_chunks_audio_check',
      sql`${t.audioFromMs} >= 0 AND ${t.audioToMs} > ${t.audioFromMs}`,
    ),
    check('transcript_chunks_status_check', oneOf(t.status, TRANSCRIPT_CHUNK_STATUS)),
    check('transcript_chunks_segments_check', sql`${t.segments} IS NULL OR jsonb_typeof(${t.segments}) = 'array'`),
    check(
      'transcript_chunks_done_check',
      sql`(${t.status} <> 'DONE') OR (${t.segments} IS NOT NULL AND ${t.computedAt} IS NOT NULL)`,
    ),
    check(
      'transcript_chunks_ref_check',
      sql`(${t.embeddingRef} IS NULL OR ${code(t.embeddingRef)}) AND (${t.modelId} IS NULL OR ${code(t.modelId)})`,
    ),
  ],
);

/**
 * T-37. The sealed machine transcript of one evidence item: its per-format hashes, the model
 * provenance and the diarization status (manifest v2 fields, row 32). The runtime role may INSERT
 * only; the item's revision 0 is never rewritten (OD-15).
 */
export const transcripts = pgTable(
  'transcripts',
  {
    evidenceId: text('evidence_id').primaryKey(),
    jsonSha256: text('json_sha256').notNull(),
    srtSha256: text('srt_sha256').notNull(),
    vttSha256: text('vtt_sha256').notNull(),
    model: jsonb('model').notNull(),
    diarization: jsonb('diarization').notNull(),
    labelsStatus: text('labels_status').$type<LabelsStatusValue>().notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    foreignKey({
      name: 'transcripts_evidence_id_fkey',
      columns: [t.evidenceId],
      foreignColumns: [evidenceItems.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'transcripts_hashes_check',
      sql`${hex64(t.jsonSha256)} AND ${hex64(t.srtSha256)} AND ${hex64(t.vttSha256)}`,
    ),
    check(
      'transcripts_json_check',
      sql`jsonb_typeof(${t.model}) = 'object' AND jsonb_typeof(${t.diarization}) = 'object'`,
    ),
    check('transcripts_labels_check', oneOf(t.labelsStatus, LABELS_STATUS)),
  ],
);

/**
 * T-38. One signed correction per row, chained by `parent_sha256` (the parent of revision 1 is
 * `transcripts.json_sha256`, a mapping rule). `baseRevision` (operation 85) has no column: it is
 * the current `max(revision_no)` read and compared inside the same INSERT transaction that mints
 * `revision_no = max + 1`, with no sequence (D-DB-07); a mismatch is `409
 * TRANSCRIPT_REVISION_CONFLICT` (SEC35-21).
 *
 * The signature columns carry the same two rules as the item's (C.4/C.5): the algorithm/simulated
 * pair, and the encoding of `signature_value` counted in whole bytes.
 * `signature_certificate_sha256` binds the revision to the certificate that signed it, so an old
 * revision still verifies after a key rotation (SEC35-20, `ev §C.3/§D V-11`). The runtime role may
 * INSERT only; the Core key signs, the author is recorded, there is no approval flow (OD-15).
 */
export const transcriptRevisions = pgTable(
  'transcript_revisions',
  {
    evidenceId: text('evidence_id').notNull(),
    revisionNo: integer('revision_no').notNull(),
    parentSha256: text('parent_sha256').notNull(),
    sha256: text('sha256').notNull(),
    authorId: text('author_id').notNull(),
    reason: text('reason').notNull(),
    signatureValue: text('signature_value').notNull(),
    signatureKeyId: text('signature_key_id').notNull(),
    signatureAlgorithm: text('signature_algorithm').$type<TranscriptSignatureAlgorithmValue>().notNull(),
    signatureSimulated: boolean('signature_simulated').notNull().default(false),
    signatureCertificateSha256: text('signature_certificate_sha256'),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ name: 'transcript_revisions_pkey', columns: [t.evidenceId, t.revisionNo] }),
    foreignKey({
      name: 'transcript_revisions_evidence_id_fkey',
      columns: [t.evidenceId],
      foreignColumns: [evidenceItems.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'transcript_revisions_author_id_fkey',
      columns: [t.authorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('transcript_revisions_revision_no_check', sql`${t.revisionNo} >= 1`),
    check('transcript_revisions_hashes_check', sql`${hex64(t.parentSha256)} AND ${hex64(t.sha256)}`),
    check('transcript_revisions_reason_check', sql`char_length(${t.reason}) BETWEEN 5 AND 500`),
    check('transcript_revisions_key_id_check', code(t.signatureKeyId)),
    check(
      'transcript_revisions_certificate_check',
      sql`${t.signatureCertificateSha256} IS NULL OR ${matches(t.signatureCertificateSha256, '^[0-9a-f]{64}$')}`,
    ),
    check(
      'transcript_revisions_signature_check',
      signatureRule(t.signatureAlgorithm, t.signatureSimulated, TRANSCRIPT_SIGNATURE_ALGORITHM),
    ),
    check(
      'transcript_revisions_signature_value_check',
      signatureValue(t.signatureValue, t.signatureAlgorithm, TRANSCRIPT_SIGNATURE_ALGORITHM),
    ),
  ],
);

export type TranscriptChunkRow = typeof transcriptChunks.$inferSelect;
export type NewTranscriptChunkRow = typeof transcriptChunks.$inferInsert;
export type TranscriptRow = typeof transcripts.$inferSelect;
export type NewTranscriptRow = typeof transcripts.$inferInsert;
export type TranscriptRevisionRow = typeof transcriptRevisions.$inferSelect;
export type NewTranscriptRevisionRow = typeof transcriptRevisions.$inferInsert;
