/**
 * Typed schema, group `identity`: T-06 `auth_sessions` (database contract §4.6).
 *
 * One row per sign-in; an ended session stays as a row with its reason. The table has no role,
 * no permission and no token column: only the SHA-256 of the presented value (`token_hash`,
 * never logged or returned, NL-1). `device_id` also states the transport: NULL is a web session
 * (resolved only from the cookie), a value is a device session (resolved only from a bearer).
 */
import { sql } from 'drizzle-orm';
import { bigint, check, foreignKey, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { bytea } from './bytea';
import { oneOf } from './checks';
import { pairedDevices } from './pairing';
import { operators } from './rbac';
import { AUTH_METHOD, SESSION_END_REASON, type AuthMethodValue, type SessionEndReason } from './value-sets';

/** T-06. A session is ended by one compare-and-set statement (AT-3). */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: bytea('token_hash').notNull(),
    operatorId: text('operator_id').notNull(),
    deviceId: text('device_id'),
    method: text('method').$type<AuthMethodValue>().notNull(),
    issuedAt: bigint('issued_at', { mode: 'number' }).notNull(),
    lastSeenAt: bigint('last_seen_at', { mode: 'number' }).notNull(),
    absoluteExpiresAt: bigint('absolute_expires_at', { mode: 'number' }).notNull(),
    endedAt: bigint('ended_at', { mode: 'number' }),
    endReason: text('end_reason').$type<SessionEndReason>(),
  },
  (t) => [
    unique('auth_sessions_token_hash_key').on(t.tokenHash),
    foreignKey({
      name: 'auth_sessions_operator_id_fkey',
      columns: [t.operatorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'auth_sessions_device_id_fkey',
      columns: [t.deviceId],
      foreignColumns: [pairedDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('auth_sessions_active_operator_idx')
      .on(t.operatorId)
      .where(sql`${t.endedAt} IS NULL`),
    index('auth_sessions_active_device_idx')
      .on(t.deviceId)
      .where(sql`${t.endedAt} IS NULL AND ${t.deviceId} IS NOT NULL`),
    index('auth_sessions_active_last_seen_idx')
      .on(t.lastSeenAt)
      .where(sql`${t.endedAt} IS NULL`),
    check('auth_sessions_token_hash_check', sql`octet_length(${t.tokenHash}) = 32`),
    check('auth_sessions_method_check', oneOf(t.method, AUTH_METHOD)),
    check('auth_sessions_biometric_device_check', sql`${t.method} <> 'BIOMETRIC' OR ${t.deviceId} IS NOT NULL`),
    check(
      'auth_sessions_times_check',
      sql`${t.lastSeenAt} >= ${t.issuedAt} AND ${t.absoluteExpiresAt} > ${t.issuedAt} AND (${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.issuedAt})`,
    ),
    check('auth_sessions_end_check', sql`(${t.endedAt} IS NULL) = (${t.endReason} IS NULL)`),
    check(
      'auth_sessions_end_reason_check',
      sql`${t.endReason} IS NULL OR ${oneOf(t.endReason, SESSION_END_REASON)}`,
    ),
    check(
      'auth_sessions_token_reuse_check',
      sql`${t.endReason} IS DISTINCT FROM 'TOKEN_REUSE' OR ${t.method} = 'BIOMETRIC'`,
    ),
  ],
);

export type AuthSessionRow = typeof authSessions.$inferSelect;
export type NewAuthSessionRow = typeof authSessions.$inferInsert;
