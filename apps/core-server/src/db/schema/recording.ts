/**
 * Typed schema, group `recording`: T-34 `session_audio_intervals`, T-35 `recording_fragments`,
 * T-39 `sealing_jobs` (database contract dbc-3 §B.5, §B.6, §B.4).
 *
 * None of these three tables carries a foreign key to `session_history`: their rows are written
 * while the session is still `RECORDING` or `FINALIZING`, before the history row exists (D-DB-07).
 * The session id is format-checked instead and the join is a mapping rule. All three are rebuilt by
 * a demo reset (dbc-3 §B.0): they describe how a recording was made, not what it proves.
 *
 * The media-pts domain is normative here: `from_media_ms`/`to_media_ms` are positions inside the
 * `AUDIO-01` media timeline, never the operator wall clock (S2 §6 finding 3, specs §E.2). The
 * wall-clock pair `from_at`/`to_at` records alongside them and must open and close with it.
 */
import { sql } from 'drizzle-orm';
import { bigint, check, foreignKey, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { code, hex64, oneOf, sessionId } from './checks';
import { captureDevices } from './capture';
import { operators } from './rbac';
import {
  AUDIO_INTERVAL_REASON,
  MIC_ROLE,
  SEALING_JOB_STATUS,
  VIDEO_TRACK_ID,
  type AudioIntervalReasonValue,
  type MicRoleValue,
  type SealingJobStatusValue,
  type VideoTrackIdValue,
} from './value-sets';

/**
 * T-34. One row per interval of one mic inside `AUDIO-01`; feeds the manifest v2
 * `audio.sourceIntervals` and the playback band. The runtime role may close the open row
 * (`to_media_ms`, `to_at`) and nothing else; exactly one open row per session is the partial
 * unique index below, which PostgreSQL can enforce because the open row is identified by
 * `to_media_ms IS NULL` (PG-08).
 */
export const sessionAudioIntervals = pgTable(
  'session_audio_intervals',
  {
    sessionId: text('session_id').notNull(),
    seq: integer('seq').notNull(),
    micDeviceId: text('mic_device_id').notNull(),
    role: text('role').$type<MicRoleValue>().notNull(),
    fromMediaMs: bigint('from_media_ms', { mode: 'number' }).notNull(),
    toMediaMs: bigint('to_media_ms', { mode: 'number' }),
    fromAt: bigint('from_at', { mode: 'number' }).notNull(),
    toAt: bigint('to_at', { mode: 'number' }),
    switchedBy: text('switched_by'),
    reason: text('reason').$type<AudioIntervalReasonValue>().notNull(),
  },
  (t) => [
    primaryKey({ name: 'session_audio_intervals_pkey', columns: [t.sessionId, t.seq] }),
    uniqueIndex('session_audio_intervals_one_open_key')
      .on(t.sessionId)
      .where(sql`${t.toMediaMs} IS NULL`),
    foreignKey({
      name: 'session_audio_intervals_mic_device_id_fkey',
      columns: [t.micDeviceId],
      foreignColumns: [captureDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'session_audio_intervals_switched_by_fkey',
      columns: [t.switchedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('session_audio_intervals_session_check', sessionId(t.sessionId)),
    check('session_audio_intervals_seq_check', sql`${t.seq} >= 1`),
    check('session_audio_intervals_role_check', oneOf(t.role, MIC_ROLE)),
    check('session_audio_intervals_reason_check', oneOf(t.reason, AUDIO_INTERVAL_REASON)),
    // A closed interval is a closed span of media time (R-3).
    check(
      'session_audio_intervals_media_check',
      sql`${t.fromMediaMs} >= 0 AND (${t.toMediaMs} IS NULL OR ${t.toMediaMs} >= ${t.fromMediaMs})`,
    ),
    // Media pts and wall clock open and close together (dbc-3 §B.5, named `..._open_check`).
    check(
      'session_audio_intervals_open_check',
      sql`(${t.toMediaMs} IS NULL) = (${t.toAt} IS NULL)`,
    ),
  ],
);

/**
 * T-35. One row per closed fragment per camera file: the byte range, the SHA-256 of the STORED
 * fragment bytes, the chain hash and the running prefix anchor, so crash detection and the
 * one-fragment tamper demo are locatable writer-independently (S1 §3.1 SP-7, §5.4). Append-only:
 * the runtime role has INSERT and nothing else (map §6). `chain_hash` of the first row is
 * `SHA-256("")`, recomputed by the mapping, never stored as a zero-length value (row 31).
 */
export const recordingFragments = pgTable(
  'recording_fragments',
  {
    sessionId: text('session_id').notNull(),
    trackId: text('track_id').$type<VideoTrackIdValue>().notNull(),
    seq: integer('seq').notNull(),
    byteOffset: bigint('byte_offset', { mode: 'number' }).notNull(),
    byteLength: bigint('byte_length', { mode: 'number' }).notNull(),
    mediaStartMs: bigint('media_start_ms', { mode: 'number' }).notNull(),
    mediaDurationMs: bigint('media_duration_ms', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    chainHash: text('chain_hash').notNull(),
    durableAt: bigint('durable_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ name: 'recording_fragments_pkey', columns: [t.sessionId, t.trackId, t.seq] }),
    check('recording_fragments_session_check', sessionId(t.sessionId)),
    check('recording_fragments_track_check', oneOf(t.trackId, VIDEO_TRACK_ID)),
    check('recording_fragments_seq_check', sql`${t.seq} >= 1`),
    check(
      'recording_fragments_bytes_check',
      sql`${t.byteOffset} >= 0 AND ${t.byteLength} >= 1`,
    ),
    check(
      'recording_fragments_media_check',
      sql`${t.mediaStartMs} >= 0 AND ${t.mediaDurationMs} >= 1`,
    ),
    check('recording_fragments_hashes_check', sql`${hex64(t.sha256)} AND ${hex64(t.chainHash)}`),
  ],
);

/**
 * T-39. One row per sealing step of one session: the per-step progress/ETA source for every
 * client, and the RECOVERY resume point read from `checkpoint` (OD-08, MB-06). Forward-only
 * progress is a code rule, not a DB CHECK: a resumed attempt legitimately rewrites progress.
 * The step names are an open `CODE` set pinned by the shared vocabulary test (SH-01), never by a
 * DB CHECK (MG-11).
 */
export const sealingJobs = pgTable(
  'sealing_jobs',
  {
    sessionId: text('session_id').notNull(),
    step: text('step').notNull(),
    status: text('status').$type<SealingJobStatusValue>().notNull(),
    progress: integer('progress').notNull().default(0),
    etaMs: bigint('eta_ms', { mode: 'number' }),
    attempt: integer('attempt').notNull().default(1),
    checkpoint: jsonb('checkpoint'),
    errorCode: text('error_code'),
    startedAt: bigint('started_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ name: 'sealing_jobs_pkey', columns: [t.sessionId, t.step] }),
    check('sealing_jobs_session_check', sessionId(t.sessionId)),
    check('sealing_jobs_step_check', code(t.step)),
    check('sealing_jobs_status_check', oneOf(t.status, SEALING_JOB_STATUS)),
    check('sealing_jobs_progress_check', sql`${t.progress} BETWEEN 0 AND 100`),
    check('sealing_jobs_eta_check', sql`${t.etaMs} IS NULL OR ${t.etaMs} >= 0`),
    check('sealing_jobs_attempt_check', sql`${t.attempt} >= 1`),
    check('sealing_jobs_checkpoint_check', sql`${t.checkpoint} IS NULL OR jsonb_typeof(${t.checkpoint}) = 'object'`),
    check('sealing_jobs_error_code_check', sql`${t.errorCode} IS NULL OR ${code(t.errorCode)}`),
  ],
);

export type SessionAudioIntervalRow = typeof sessionAudioIntervals.$inferSelect;
export type NewSessionAudioIntervalRow = typeof sessionAudioIntervals.$inferInsert;
export type RecordingFragmentRow = typeof recordingFragments.$inferSelect;
export type NewRecordingFragmentRow = typeof recordingFragments.$inferInsert;
export type SealingJobRow = typeof sealingJobs.$inferSelect;
export type NewSealingJobRow = typeof sealingJobs.$inferInsert;
