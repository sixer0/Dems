/**
 * Typed schema, group `audit`: T-12 `audit_log`, T-13 `audit_chain_head`, T-14 `events`,
 * T-30 `audit_chain_history` (database contract §4.12 to §4.14, §4.30, §6).
 *
 * What is NOT in this file, because `drizzle-kit` does not express it: the genesis row of the
 * chain head, the lock function, the chain guard and the three triggers (`ENABLE ALWAYS`). They
 * are the hand-written migration `0002_audit_guards`. The privileges are `0003_privileges`.
 *
 * `session_id`, `evidence_id` and `device_id` are soft references (K-3): an audit row must be
 * insertable whatever became of the thing it names.
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, index, jsonb, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { code, flat, hex64, noSecretKeys, oneOf } from './checks';
import { operators } from './rbac';
import {
  AUDIT_CATEGORY,
  CHAIN_DISCARD_REASON,
  EVENT_CATEGORY,
  SCENARIO,
  SEVERITY,
  type AuditCategoryValue,
  type ChainDiscardReason,
  type EventCategoryValue,
  type FlatJson,
  type ScenarioValue,
  type SeverityValue,
} from './value-sets';

/**
 * T-12. The hash-chained audit trail: append-only by privilege for the runtime role and by a
 * trigger for every role. Rows are appended only through the append protocol AP-1 to AP-7.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    seq: bigint('seq', { mode: 'number' }).primaryKey(),
    id: text('id').notNull(),
    at: bigint('at', { mode: 'number' }).notNull(),
    type: text('type').notNull(),
    category: text('category').$type<AuditCategoryValue>().notNull(),
    severity: text('severity').$type<SeverityValue>().notNull(),
    actorId: text('actor_id'),
    message: text('message').notNull(),
    sessionId: text('session_id'),
    evidenceId: text('evidence_id'),
    deviceId: text('device_id'),
    details: jsonb('details').$type<FlatJson>().notNull().default({}),
    prevHash: text('prev_hash').notNull(),
    hash: text('hash').notNull(),
  },
  (t) => [
    unique('audit_log_id_key').on(t.id),
    unique('audit_log_prev_hash_key').on(t.prevHash),
    unique('audit_log_hash_key').on(t.hash),
    foreignKey({ name: 'audit_log_actor_id_fkey', columns: [t.actorId], foreignColumns: [operators.id] })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('audit_log_category_seq_idx').on(t.category, t.seq),
    index('audit_log_type_seq_idx').on(t.type, t.seq),
    index('audit_log_actor_id_seq_idx')
      .on(t.actorId, t.seq)
      .where(sql`${t.actorId} IS NOT NULL`),
    index('audit_log_session_id_seq_idx')
      .on(t.sessionId, t.seq)
      .where(sql`${t.sessionId} IS NOT NULL`),
    index('audit_log_evidence_id_seq_idx')
      .on(t.evidenceId, t.seq)
      .where(sql`${t.evidenceId} IS NOT NULL`),
    check('audit_log_seq_check', sql`${t.seq} >= 1`),
    check(
      'audit_log_id_check',
      sql`${t.id} = 'AUD-' || lpad(${t.seq}::text, greatest(6, length(${t.seq}::text)), '0')`,
    ),
    check('audit_log_type_check', code(t.type)),
    check('audit_log_category_check', oneOf(t.category, AUDIT_CATEGORY)),
    check('audit_log_severity_check', oneOf(t.severity, SEVERITY)),
    check(
      'audit_log_hashes_check',
      sql`${hex64(t.prevHash)} AND ${hex64(t.hash)} AND ${t.prevHash} <> ${t.hash}`,
    ),
    check('audit_log_details_flat_check', flat(t.details)),
    check('audit_log_details_no_secret_keys_check', noSecretKeys(t.details)),
  ],
);

/**
 * T-13. One row: the sequence and hash of the newest audit row. It is the lock point of the
 * chain. The runtime role only reads it; the guard trigger moves it.
 */
export const auditChainHead = pgTable(
  'audit_chain_head',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    seq: bigint('seq', { mode: 'number' }).notNull(),
    hash: text('hash').notNull(),
  },
  (t) => [
    check('audit_chain_head_singleton_check', sql`${t.singleton}`),
    check('audit_chain_head_values_check', sql`${t.seq} >= 0 AND ${hex64(t.hash)}`),
  ],
);

/** T-14. Operational events: not chained; append-only for the runtime role by privilege. */
export const events = pgTable(
  'events',
  {
    seq: bigint('seq', { mode: 'number' }).primaryKey(),
    id: text('id').notNull(),
    at: bigint('at', { mode: 'number' }).notNull(),
    type: text('type').notNull(),
    category: text('category').$type<EventCategoryValue>().notNull(),
    severity: text('severity').$type<SeverityValue>().notNull(),
    message: text('message').notNull(),
    params: jsonb('params').$type<FlatJson>().notNull().default({}),
    sessionId: text('session_id'),
    deviceId: text('device_id'),
  },
  (t) => [
    unique('events_id_key').on(t.id),
    index('events_category_seq_idx').on(t.category, t.seq),
    index('events_type_seq_idx').on(t.type, t.seq),
    index('events_severity_seq_idx').on(t.severity, t.seq),
    check('events_seq_check', sql`${t.seq} >= 1`),
    check(
      'events_id_check',
      sql`${t.id} = 'LOG-' || lpad(${t.seq}::text, greatest(6, length(${t.seq}::text)), '0')`,
    ),
    check('events_type_check', code(t.type)),
    check('events_category_check', oneOf(t.category, EVENT_CATEGORY)),
    check('events_severity_check', oneOf(t.severity, SEVERITY)),
    check('events_params_flat_check', flat(t.params)),
    check('events_params_no_secret_keys_check', noSecretKeys(t.params)),
  ],
);

/**
 * T-30. The lineage of discarded audit chains: one row per chain that a reset or a scenario load
 * discarded. Kept across every reset. The runtime role has SELECT only (D18); the reset routine,
 * as the owner, is the only writer; a trigger refuses UPDATE, DELETE and TRUNCATE for every role.
 */
export const auditChainHistory = pgTable(
  'audit_chain_history',
  {
    resetNo: bigint('reset_no', { mode: 'number' }).primaryKey(),
    epoch: bigint('epoch', { mode: 'number' }).notNull(),
    headHash: text('head_hash').notNull(),
    rowCount: bigint('row_count', { mode: 'number' }).notNull(),
    firstSeq: bigint('first_seq', { mode: 'number' }).notNull(),
    lastSeq: bigint('last_seq', { mode: 'number' }).notNull(),
    resetAt: bigint('reset_at', { mode: 'number' }).notNull(),
    actorId: text('actor_id'),
    reason: text('reason').$type<ChainDiscardReason>().notNull(),
    scenario: text('scenario').$type<ScenarioValue>().notNull(),
  },
  (t) => [
    unique('audit_chain_history_epoch_key').on(t.epoch),
    foreignKey({
      name: 'audit_chain_history_actor_id_fkey',
      columns: [t.actorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('audit_chain_history_numbers_check', sql`${t.resetNo} >= 1 AND ${t.epoch} >= 0`),
    check('audit_chain_history_head_hash_check', hex64(t.headHash)),
    check(
      'audit_chain_history_values_check',
      sql`${t.rowCount} >= 1 AND ${t.firstSeq} >= 1 AND ${t.lastSeq} >= ${t.firstSeq}`,
    ),
    check(
      'audit_chain_history_reason_check',
      sql`${oneOf(t.reason, CHAIN_DISCARD_REASON)} AND ${oneOf(t.scenario, SCENARIO)}`,
    ),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
export type AuditChainHeadRow = typeof auditChainHead.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type AuditChainHistoryRow = typeof auditChainHistory.$inferSelect;
export type NewAuditChainHistoryRow = typeof auditChainHistory.$inferInsert;
