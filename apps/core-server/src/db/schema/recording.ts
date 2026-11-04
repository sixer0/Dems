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
import { code, flat, hex64, noSecretKeys, oneOf, sessionId } from './checks';
import { captureDevices } from './capture';
import { operators } from './rbac';
import {
  AUDIO_INTERVAL_REASON,
  CAPTURE_ADAPTER_KIND,
  CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND,
  CAPTURE_SOURCE_SLOT,
  MIC_ROLE,
  SEALING_JOB_STATUS,
  VIDEO_TRACK_ID,
  type AudioIntervalReasonValue,
  type CaptureAdapterKindValue,
  type CaptureSourceSlotValue,
  type FlatJson,
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
    // Migration 0036 (principal, 2026-11-02): a reference to a record OF THE UNIT drops its
    // attribution when the operator goes, instead of holding the record in place.
    foreignKey({
      name: 'session_audio_intervals_switched_by_fkey',
      columns: [t.switchedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('set null')
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

/**
 * The SQL/JSON path that finds a text value of `source_facts` outside its bound: a string member
 * that is not 0 to 120 characters free of control characters. A literal of this file: statement
 * text for the CHECK, never a bind parameter and never a value from outside this folder. It is
 * written in the form PostgreSQL prints a path back (no blank around `?`), so that the statement
 * text of the migration and the catalog's text of the CHECK are one text.
 */
const SOURCE_FACT_TEXT_OUT_OF_BOUND = `'$.*?(@.type() == "string" && !(@ like_regex "^[^[:cntrl:]]{0,120}$"))'`;

/**
 * T-41 (dbc-4 §N.3, D-DB-14). The session-start record of what fed each of the four slots: four
 * rows per session, written in ONE statement inside the transaction that persists the transition
 * to `RECORDING` (MR-S1; rows 66 / 71), so they are durable before the first fragment row. The
 * manifest reads the source class from these rows only (MR-S4), never from the registry, the
 * selector or the development flag.
 *
 * INSERT-ONLY for the runtime role: `0009` grants SELECT and INSERT and nothing else, so "never
 * updated" is enforced by the database (42501). No foreign key to `session_history` (D-DB-07) and
 * no composite key to the registry: a simulated session records `FAKE` whatever the registry says
 * (MR-S3). Rebuilt by a demo reset (rows removed, table kept).
 */
export const sessionCaptureSources = pgTable(
  'session_capture_sources',
  {
    sessionId: text('session_id').notNull(),
    slot: text('slot').$type<CaptureSourceSlotValue>().notNull(),
    deviceId: text('device_id').notNull(),
    adapterKind: text('adapter_kind').$type<CaptureAdapterKindValue>().notNull(),
    recordedAt: bigint('recorded_at', { mode: 'number' }).notNull(),
    // ── schema v7 addition (set A of task 4; schema design 2.3). Declared LAST: `0015` appends it
    //    (ALTER ADD COLUMN). The facts of the device AS IT WAS WHEN THE SESSION STARTED: a
    //    point-in-time copy, never a reference to the registry. `DEFAULT '{}'` is permanent, so
    //    every earlier row and every simulated session reads `{}` and no statement had to change.
    //    Written in the INSERT and never updated: `0016` pins `REVOKE UPDATE (source_facts)`. ──
    sourceFacts: jsonb('source_facts').$type<FlatJson>().notNull().default({}),
  },
  (t) => [
    primaryKey({ name: 'session_capture_sources_pkey', columns: [t.sessionId, t.slot] }),
    foreignKey({
      name: 'session_capture_sources_device_id_fkey',
      columns: [t.deviceId],
      foreignColumns: [captureDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('session_capture_sources_session_check', sessionId(t.sessionId)),
    check('session_capture_sources_slot_check', oneOf(t.slot, CAPTURE_SOURCE_SLOT)),
    check('session_capture_sources_adapter_kind_check', oneOf(t.adapterKind, CAPTURE_ADAPTER_KIND)),
    // A video slot is fed by a camera kind and a mic slot by a microphone kind; `SNMP_POE` feeds none.
    check(
      'session_capture_sources_pairing_check',
      sql`(${t.slot} IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04') AND ${oneOf(t.adapterKind, CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND.CAMERA)}) OR (${t.slot} IN ('MIC-01', 'MIC-02', 'MIC-03', 'MIC-04') AND ${oneOf(t.adapterKind, CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND.MIC)}) // D61 (2026-11-04): numbered channels`,
    ),
    // Schema v7: a flat map with none of the 28 denied key names, as an audit detail is - so no
    // user name, no locator and no ONVIF endpoint reference can be a fact (S13-13: no free JSON).
    check('session_capture_sources_source_facts_flat_check', flat(t.sourceFacts)),
    check('session_capture_sources_source_facts_no_secret_keys_check', noSecretKeys(t.sourceFacts)),
    // The bound on device text (S13-13, S13-12 (b)): the whole map is at most 2,048 bytes, and
    // every text value is at most 120 characters (the bound of `capture_devices.model`) with no
    // control character. The character rule of a device string is the adapter's (AD-07 (1)); this
    // is the database's backstop, so an oversized body is refused whoever wrote it.
    check(
      'session_capture_sources_source_facts_bound_check',
      sql`octet_length(${t.sourceFacts}::text) <= 2048 AND NOT jsonb_path_exists(${t.sourceFacts}, ${sql.raw(SOURCE_FACT_TEXT_OUT_OF_BOUND)})`,
    ),
  ],
);

/** A source row AS THE DATABASE HOLDS IT since schema v7: `sourceFacts` is always there (`{}` by default). */
export type StoredSessionCaptureSourceRow = typeof sessionCaptureSources.$inferSelect;
/**
 * SEAM OF TASK 4 ROW 17, TO BE REMOVED BY ROW 71 (the writer of the facts). `sourceFacts` is
 * optional here because the one builder of this type outside the schema folder, the bulk fixture
 * (`db/fixtures/pipeline.ts`), builds rows without it and is not this row's to edit; such a row
 * is inserted with the column's permanent default `{}`. Row 71 states the facts in that builder
 * and replaces this alias by `StoredSessionCaptureSourceRow`.
 */
export type SessionCaptureSourceRow = Omit<StoredSessionCaptureSourceRow, 'sourceFacts'> & { sourceFacts?: FlatJson };
export type NewSessionCaptureSourceRow = typeof sessionCaptureSources.$inferInsert;
