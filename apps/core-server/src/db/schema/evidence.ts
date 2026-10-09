/**
 * Typed schema, group `evidence`: T-17 `evidence_items`, T-18 `evidence_tracks`,
 * T-19 `evidence_custody`, T-20 `exports` (database contract §4.17 to §4.20, and the v2 changes of
 * `dbc-3` §B.11, §B.12, §C.4, §C.5, §C.6).
 *
 * The sealed columns of an evidence item, its tracks, its custody entries and the export records
 * are immutable for the runtime role by privilege (§7.3): only seven columns of `evidence_items`
 * may be updated, and none of the v2 sealed columns joins that list (`dbc-3` §B.11).
 *
 * v2 keeps the four-value `track_id`, `position` and `tampered_track_id` sets exactly as v1 wrote
 * them (D-DB-05): narrowing them would make 0004 fail to validate against the v1 rows that are
 * still in the database before the re-seed. The v2 shape — exactly two file rows, positions 1..2,
 * both hashes — is enforced by the mapping, the seed and the M2 tests (CS-18) and re-checked by
 * verify v2 (OD-01/OD-02).
 */
import type { EvidenceMarker, SessionNote } from '@dems/shared/sim';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { caseNumber, code, evidenceId, exportId, hex64, matches, oneOf, signatureRule, signatureValue } from './checks';
import { operators } from './rbac';
import { sessionHistory } from './sessions';
import {
  EVIDENCE_STATUS,
  EXPORT_SCOPE,
  INTEGRITY_SOURCE,
  LABELS_STATUS,
  LIFECYCLE_STAGE,
  PROFILE,
  SIGNATURE_ALGORITHM,
  SUBJECT_TYPE,
  TIME_SOURCE,
  TRACK_ID,
  TRACK_KIND,
  VERIFICATION,
  type EvidenceStatusValue,
  type ExportScopeValue,
  type IntegritySourceValue,
  type LabelsStatusValue,
  type LifecycleStageValue,
  type ProfileId,
  type SignatureAlgorithmValue,
  type SubjectTypeValue,
  type TimeSourceValue,
  type TrackIdValue,
  type TrackKindValue,
  type VerificationValue,
} from './value-sets';

/**
 * T-17. One row per evidence item. The descriptive columns repeat the session's: the item is
 * the sealed record that the manifest hash covers, and the runtime role cannot update them.
 */
export const evidenceItems = pgTable(
  'evidence_items',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    caseNumber: text('case_number').notNull(),
    subjectName: text('subject_name').notNull(),
    subjectType: text('subject_type').$type<SubjectTypeValue>().notNull(),
    investigatorId: text('investigator_id').notNull(),
    room: text('room').notNull(),
    profileId: text('profile_id').$type<ProfileId>().notNull(),
    recordedAt: bigint('recorded_at', { mode: 'number' }).notNull(),
    endedAt: bigint('ended_at', { mode: 'number' }).notNull(),
    sealedAt: bigint('sealed_at', { mode: 'number' }),
    durationMs: bigint('duration_ms', { mode: 'number' }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: text('status').$type<EvidenceStatusValue>().notNull(),
    lifecycleStage: text('lifecycle_stage').$type<LifecycleStageValue>().notNull(),
    manifestHash: text('manifest_hash').notNull(),
    signatureValue: text('signature_value').notNull(),
    signatureKeyId: text('signature_key_id').notNull(),
    signatureAlgorithm: text('signature_algorithm').$type<SignatureAlgorithmValue>().notNull(),
    signatureSimulated: boolean('signature_simulated').notNull().default(true),
    verificationStatus: text('verification_status').$type<VerificationValue>().notNull().default('NOT_RUN'),
    verificationAt: bigint('verification_at', { mode: 'number' }),
    tampered: boolean('tampered').notNull().default(false),
    tamperedTrackId: text('tampered_track_id').$type<TrackIdValue>(),
    caseType: text('case_type').$type<SubjectTypeValue>(),
    markers: jsonb('markers').$type<EvidenceMarker[]>().notNull().default([]),
    notes: jsonb('notes').$type<SessionNote[]>().notNull().default([]),
    integritySource: text('integrity_source').$type<IntegritySourceValue>(),
    startTimeSource: text('start_time_source').$type<TimeSourceValue>(),
    endTimeSource: text('end_time_source').$type<TimeSourceValue>(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    // ── schema v2 additions (dbc-3 §B.11). None of them joins the UPDATE grant list of `0003`:
    //    a sealed value is written once by the seal and never edited afterwards (map §6).
    //    Declared in the physical order `0004_capture.sql` appends them (ALTER ADD COLUMN puts a
    //    new column at the end), so the typed schema, the contract inventory and the live
    //    catalog agree column-by-column and position-by-position. ──
    manifestVersion: smallint('manifest_version').notNull().default(1),
    transcriptSha256: text('transcript_sha256'),
    labelsStatus: text('labels_status').$type<LabelsStatusValue>(),
  },
  (t) => [
    unique('evidence_items_session_id_key').on(t.sessionId),
    foreignKey({
      name: 'evidence_items_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [sessionHistory.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'evidence_items_investigator_id_fkey',
      columns: [t.investigatorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('evidence_items_recorded_at_idx').on(t.recordedAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    index('evidence_items_status_recorded_at_idx').on(
      t.status,
      t.recordedAt.desc().nullsFirst(),
      t.id.desc().nullsFirst(),
    ),
    index('evidence_items_case_type_recorded_at_idx').on(
      t.caseType,
      t.recordedAt.desc().nullsFirst(),
      t.id.desc().nullsFirst(),
    ),
    check('evidence_items_id_check', sql`${evidenceId(t.id)} AND ${caseNumber(t.caseNumber)}`),
    check(
      'evidence_items_status_check',
      sql`${oneOf(t.status, EVIDENCE_STATUS)} AND ${oneOf(t.lifecycleStage, LIFECYCLE_STAGE)}`,
    ),
    check(
      'evidence_items_input_check',
      sql`${oneOf(t.subjectType, SUBJECT_TYPE)} AND ${oneOf(t.profileId, PROFILE)} AND (${t.caseType} IS NULL OR ${oneOf(t.caseType, SUBJECT_TYPE)})`,
    ),
    // v2 (§C.5, register W1-C10): this CHECK carries the true SHA-256 digests only, all 64 hex
    // characters. The signature encoding moved to `evidence_items_signature_value_check` because a
    // real Ed25519 signature is 64 BYTES, i.e. 128 hex characters.
    check(
      'evidence_items_hashes_check',
      sql`${hex64(t.manifestHash)} AND (${t.transcriptSha256} IS NULL OR ${hex64(t.transcriptSha256)})`,
    ),
    // v2 (§C.4, OD-04): the seal may carry a real signature. `Ed25519` is what v2 writes now;
    // `ECDSA-P256-SHA256` is pre-declared for the class-C TPM adapter so no further migration is
    // needed when hardware keys arrive (C-8).
    check('evidence_items_signature_check', signatureRule(t.signatureAlgorithm, t.signatureSimulated, SIGNATURE_ALGORITHM)),
    check(
      'evidence_items_signature_value_check',
      signatureValue(t.signatureValue, t.signatureAlgorithm, SIGNATURE_ALGORITHM),
    ),
    check(
      'evidence_items_verification_check',
      sql`${oneOf(t.verificationStatus, VERIFICATION)} AND ((${t.verificationStatus} = 'NOT_RUN') = (${t.verificationAt} IS NULL))`,
    ),
    check(
      'evidence_items_tamper_check',
      sql`${t.tamperedTrackId} IS NULL OR ${oneOf(t.tamperedTrackId, TRACK_ID)}`,
    ),
    check(
      'evidence_items_values_check',
      sql`${t.durationMs} >= 0 AND ${t.sizeBytes} >= 0 AND ${t.endedAt} >= ${t.recordedAt} AND (${t.sealedAt} IS NULL OR ${t.sealedAt} >= ${t.endedAt})`,
    ),
    // v2 (§B.11, §C.6 D-DB-04): v1 rows keep 1 until the re-seed writes 2 (D-DB-01); the labels
    // column is nullable because an item without a transcript has no label state at all (R-5).
    check('evidence_items_manifest_version_check', sql`${t.manifestVersion} IN (1, 2)`),
    check(
      'evidence_items_labels_check',
      sql`${t.labelsStatus} IS NULL OR ${oneOf(t.labelsStatus, LABELS_STATUS)}`,
    ),
    check(
      'evidence_items_sources_check',
      sql`(${t.integritySource} IS NULL OR ${oneOf(t.integritySource, INTEGRITY_SOURCE)}) AND (${t.startTimeSource} IS NULL OR ${oneOf(t.startTimeSource, TIME_SOURCE)}) AND (${t.endTimeSource} IS NULL OR ${oneOf(t.endTimeSource, TIME_SOURCE)})`,
    ),
    check(
      'evidence_items_json_check',
      sql`jsonb_typeof(${t.markers}) = 'array' AND jsonb_typeof(${t.notes}) = 'array'`,
    ),
  ],
);

/**
 * T-18. In v2, one row per FILE of the item — the two camera files, each carrying the single
 * `AUDIO-01` session track (OD-01 T1, R-4) — where v1 held up to four rows including separate
 * audio rows. The runtime role may insert and read only.
 *
 * Two whole-file hashes per row, never renamed (`dbc-3` §B.12, D-DB-02): `sha256` is the hash of
 * the STORED bytes (the S1 running prefix equals it at close) and `sha256_plain` is the hash of the
 * PLAINTEXT whole file. Both are nullable-at-the-DB level so 0004 adds the column without a data
 * rewrite (A.4); "both recorded on every v2 file" is a mapping, seed and verify rule (row 32).
 */
export const evidenceTracks = pgTable(
  'evidence_tracks',
  {
    evidenceId: text('evidence_id').notNull(),
    trackId: text('track_id').$type<TrackIdValue>().notNull(),
    position: smallint('position').notNull(),
    label: text('label').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    // ── schema v2 additions (dbc-3 §B.12). `kind` is the only value v2 code writes and is a
    //    harmless label on the temporary pre-re-seed v1 rows (A.4). ──
    kind: text('kind').$type<TrackKindValue>().notNull().default('FILE'),
    containsAudio: boolean('contains_audio').notNull().default(true),
    codec: text('codec'),
    durationMs: bigint('duration_ms', { mode: 'number' }),
    fragmentCount: integer('fragment_count'),
    fragmentChainHead: text('fragment_chain_head'),
    sha256Plain: text('sha256_plain'),
  },
  (t) => [
    primaryKey({ name: 'evidence_tracks_pkey', columns: [t.evidenceId, t.trackId] }),
    unique('evidence_tracks_evidence_id_position_key').on(t.evidenceId, t.position),
    foreignKey({
      name: 'evidence_tracks_evidence_id_fkey',
      columns: [t.evidenceId],
      foreignColumns: [evidenceItems.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    // :353 stays exactly as v1 wrote it (D-DB-05); the v2 two-row shape is a mapping rule (CS-18).
    check('evidence_tracks_track_check', sql`${oneOf(t.trackId, TRACK_ID)} AND ${t.position} BETWEEN 1 AND 4`),
    check('evidence_tracks_kind_check', oneOf(t.kind, TRACK_KIND)),
    // R-4: both camera files carry the single session audio track, so a row without it is a bug.
    check('evidence_tracks_audio_check', sql`${t.containsAudio}`),
    // :354 in v2: the v1 rules plus the new-column patterns (C.6). `fragment_count` equaling the
    // `recording_fragments` row count is an invariant of mapping and verify, not a DB CHECK (MR-V1).
    check(
      'evidence_tracks_values_check',
      sql`${t.sizeBytes} >= 0 AND ${hex64(t.sha256)} AND (${t.codec} IS NULL OR ${code(t.codec)}) AND (${t.durationMs} IS NULL OR ${t.durationMs} >= 0) AND (${t.fragmentCount} IS NULL OR ${t.fragmentCount} >= 0) AND (${t.fragmentChainHead} IS NULL OR ${matches(t.fragmentChainHead, '^[0-9a-f]{64}$')}) AND (${t.sha256Plain} IS NULL OR ${matches(t.sha256Plain, '^[0-9a-f]{64}$')})`,
    ),
  ],
);

/** T-19. The custody log of an item; rows are only added. */
export const evidenceCustody = pgTable(
  'evidence_custody',
  {
    evidenceId: text('evidence_id').notNull(),
    seq: integer('seq').notNull(),
    at: bigint('at', { mode: 'number' }).notNull(),
    action: text('action').notNull(),
    actorId: text('actor_id'),
    detail: text('detail'),
  },
  (t) => [
    primaryKey({ name: 'evidence_custody_pkey', columns: [t.evidenceId, t.seq] }),
    foreignKey({
      name: 'evidence_custody_evidence_id_fkey',
      columns: [t.evidenceId],
      foreignColumns: [evidenceItems.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'evidence_custody_actor_id_fkey',
      columns: [t.actorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('evidence_custody_values_check', sql`${t.seq} >= 1 AND ${code(t.action)}`),
  ],
);

/**
 * T-20. One row per accepted export of evidence, of the audit log or of the log bundle.
 *
 * The TypeScript name is `exportRecords`: `exports` is a reserved binding in a CommonJS module,
 * which is how `drizzle-kit` loads this file. The table name is `exports`.
 */
export const exportRecords = pgTable(
  'exports',
  {
    id: text('id').primaryKey(),
    scope: text('scope').$type<ExportScopeValue>().notNull(),
    evidenceId: text('evidence_id'),
    operatorId: text('operator_id').notNull(),
    reason: text('reason').notNull(),
    destination: text('destination').notNull(),
    at: bigint('at', { mode: 'number' }).notNull(),
  },
  (t) => [
    foreignKey({
      name: 'exports_evidence_id_fkey',
      columns: [t.evidenceId],
      foreignColumns: [evidenceItems.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({ name: 'exports_operator_id_fkey', columns: [t.operatorId], foreignColumns: [operators.id] })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('exports_evidence_id_idx')
      .on(t.evidenceId)
      .where(sql`${t.evidenceId} IS NOT NULL`),
    check('exports_id_check', exportId(t.id)),
    check(
      'exports_scope_check',
      sql`${oneOf(t.scope, EXPORT_SCOPE)} AND ((${t.scope} = 'EVIDENCE') = (${t.evidenceId} IS NOT NULL))`,
    ),
    check(
      'exports_text_check',
      sql`char_length(btrim(${t.reason})) >= 5 AND char_length(${t.destination}) BETWEEN 1 AND 120`,
    ),
  ],
);

export type EvidenceItemRow = typeof evidenceItems.$inferSelect;
export type NewEvidenceItemRow = typeof evidenceItems.$inferInsert;
export type EvidenceTrackRow = typeof evidenceTracks.$inferSelect;
export type NewEvidenceTrackRow = typeof evidenceTracks.$inferInsert;
export type EvidenceCustodyRow = typeof evidenceCustody.$inferSelect;
export type NewEvidenceCustodyRow = typeof evidenceCustody.$inferInsert;
export type ExportRow = typeof exportRecords.$inferSelect;
export type NewExportRow = typeof exportRecords.$inferInsert;
