/**
 * Typed schema, group `sessions`: T-15 `active_session`, T-16 `session_history`
 * (database contract §4.15, §4.16).
 *
 * The JSON columns are bounded value objects owned by the row (J-2), typed with the shared
 * simulator types. An absent value object is SQL NULL, never the JSON literal `null` (J-4).
 */
import type {
  FinalizationSlice,
  PrecheckSlice,
  RecoverySlice,
  SessionFault,
  SessionNote,
  TimelineEvent,
} from '@dems/shared/sim';
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { caseNumber, oneOf, sessionId } from './checks';
import { operators } from './rbac';
import {
  FAULT_KIND,
  PROFILE,
  SESSION_OUTCOME,
  SESSION_STATE,
  SUBJECT_TYPE,
  TIME_SOURCE,
  type FaultKindValue,
  type ProfileId,
  type SessionOutcomeValue,
  type SessionStateValue,
  type SubjectTypeValue,
  type TimeSourceValue,
} from './value-sets';

/**
 * T-15. Zero rows (no session) or one row: the primary key on `singleton` makes "one active
 * session per Core" a database rule. This is the only table the runtime role may DELETE from.
 * A progress write names only the changed columns (MR-8), never the large JSON columns.
 */
export const activeSession = pgTable(
  'active_session',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    id: text('id').notNull(),
    state: text('state').$type<SessionStateValue>().notNull(),
    caseNumber: text('case_number').notNull(),
    subjectType: text('subject_type').$type<SubjectTypeValue>().notNull(),
    subjectName: text('subject_name').notNull(),
    investigatorId: text('investigator_id').notNull(),
    room: text('room').notNull(),
    profileId: text('profile_id').$type<ProfileId>().notNull(),
    inputNotes: text('input_notes').notNull().default(''),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    createdBy: text('created_by'),
    armedAt: bigint('armed_at', { mode: 'number' }),
    startedAt: bigint('started_at', { mode: 'number' }),
    stoppedAt: bigint('stopped_at', { mode: 'number' }),
    stopReason: text('stop_reason'),
    sealedAt: bigint('sealed_at', { mode: 'number' }),
    markerCount: integer('marker_count').notNull().default(0),
    snapshotCount: integer('snapshot_count').notNull().default(0),
    bytesWritten: bigint('bytes_written', { mode: 'number' }).notNull().default(0),
    evidenceId: text('evidence_id'),
    startTimeSource: text('start_time_source').$type<TimeSourceValue>(),
    stopTimeSource: text('stop_time_source').$type<TimeSourceValue>(),
    precheck: jsonb('precheck').$type<PrecheckSlice>().notNull(),
    finalization: jsonb('finalization').$type<FinalizationSlice>().notNull(),
    timeline: jsonb('timeline').$type<TimelineEvent[]>().notNull().default([]),
    notes: jsonb('notes').$type<SessionNote[]>().notNull().default([]),
    fault: jsonb('fault').$type<SessionFault>(),
    recovery: jsonb('recovery').$type<RecoverySlice>(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('active_session_singleton_check', sql`${t.singleton}`),
    foreignKey({
      name: 'active_session_investigator_id_fkey',
      columns: [t.investigatorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'active_session_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('active_session_id_check', sql`${sessionId(t.id)} AND ${caseNumber(t.caseNumber)}`),
    check('active_session_state_check', oneOf(t.state, SESSION_STATE)),
    check(
      'active_session_input_check',
      sql`${oneOf(t.subjectType, SUBJECT_TYPE)} AND ${oneOf(t.profileId, PROFILE)}`,
    ),
    check(
      'active_session_time_source_check',
      sql`(${t.startTimeSource} IS NULL OR ${oneOf(t.startTimeSource, TIME_SOURCE)}) AND (${t.stopTimeSource} IS NULL OR ${oneOf(t.stopTimeSource, TIME_SOURCE)})`,
    ),
    check(
      'active_session_counts_check',
      sql`${t.markerCount} >= 0 AND ${t.snapshotCount} >= 0 AND ${t.bytesWritten} >= 0`,
    ),
    check(
      'active_session_json_check',
      sql`jsonb_typeof(${t.precheck}) = 'object' AND jsonb_typeof(${t.finalization}) = 'object' AND jsonb_typeof(${t.timeline}) = 'array' AND jsonb_array_length(${t.timeline}) <= 200 AND jsonb_typeof(${t.notes}) = 'array' AND (${t.fault} IS NULL OR jsonb_typeof(${t.fault}) = 'object') AND (${t.recovery} IS NULL OR jsonb_typeof(${t.recovery}) = 'object')`,
    ),
  ],
);

/** T-16. One row per finished session, sealed or incomplete; never changed. */
export const sessionHistory = pgTable(
  'session_history',
  {
    id: text('id').primaryKey(),
    outcome: text('outcome').$type<SessionOutcomeValue>().notNull(),
    caseNumber: text('case_number').notNull(),
    subjectName: text('subject_name').notNull(),
    subjectType: text('subject_type').$type<SubjectTypeValue>().notNull(),
    investigatorId: text('investigator_id').notNull(),
    room: text('room').notNull(),
    profileId: text('profile_id').$type<ProfileId>().notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    startedAt: bigint('started_at', { mode: 'number' }),
    endedAt: bigint('ended_at', { mode: 'number' }).notNull(),
    durationMs: bigint('duration_ms', { mode: 'number' }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    faultKind: text('fault_kind').$type<FaultKindValue>(),
    startTimeSource: text('start_time_source').$type<TimeSourceValue>(),
    endTimeSource: text('end_time_source').$type<TimeSourceValue>(),
  },
  (t) => [
    index('session_history_ended_at_idx').on(t.endedAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    foreignKey({
      name: 'session_history_investigator_id_fkey',
      columns: [t.investigatorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('session_history_id_check', sql`${sessionId(t.id)} AND ${caseNumber(t.caseNumber)}`),
    check(
      'session_history_outcome_check',
      sql`${oneOf(t.outcome, SESSION_OUTCOME)} AND (${t.faultKind} IS NULL OR (${t.outcome} = 'INCOMPLETE' AND ${oneOf(t.faultKind, FAULT_KIND)}))`,
    ),
    check(
      'session_history_input_check',
      sql`${oneOf(t.subjectType, SUBJECT_TYPE)} AND ${oneOf(t.profileId, PROFILE)}`,
    ),
    check(
      'session_history_values_check',
      sql`${t.durationMs} >= 0 AND ${t.sizeBytes} >= 0 AND ${t.endedAt} >= ${t.createdAt}`,
    ),
    check(
      'session_history_time_source_check',
      sql`(${t.startTimeSource} IS NULL OR ${oneOf(t.startTimeSource, TIME_SOURCE)}) AND (${t.endTimeSource} IS NULL OR ${oneOf(t.endTimeSource, TIME_SOURCE)})`,
    ),
  ],
);

export type ActiveSessionRow = typeof activeSession.$inferSelect;
export type NewActiveSessionRow = typeof activeSession.$inferInsert;
export type SessionHistoryRow = typeof sessionHistory.$inferSelect;
export type NewSessionHistoryRow = typeof sessionHistory.$inferInsert;
