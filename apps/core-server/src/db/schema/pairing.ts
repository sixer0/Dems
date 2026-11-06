/**
 * Typed schema, group `pairing`: T-07 `pairing_codes`, T-08 `paired_devices`,
 * T-09 `device_credentials`, T-10 `biometric_tokens`, T-11 `registry_counters`
 * (database contract §4.7 to §4.11).
 *
 * The pairing code, the device credential and the biometric token are never stored: only their
 * SHA-256 (`bytea`, 32 bytes, §5.1). The hash columns must never be logged or returned (NL-1).
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea } from './bytea';
import { matches, oneOf } from './checks';
import { operators } from './rbac';
import {
  BIO_REVOKE_REASON,
  CODE_STATE,
  DEVICE_STATE,
  REGISTRY_COUNTER,
  type BioRevokeReason,
  type CodeStateValue,
  type DeviceStateValue,
  type RegistryCounterName,
} from './value-sets';

/**
 * T-07. One row per issued code. A redeem attempt first takes one attempt from
 * `failed_attempts` with a single UPDATE and only then compares (AT-C2, AT-C3).
 * There is deliberately no index on `code_hash`: a code is never looked up by its hash (§5.2).
 */
export const pairingCodes = pgTable(
  'pairing_codes',
  {
    id: text('id').primaryKey(),
    codeHash: bytea('code_hash').notNull(),
    state: text('state').$type<CodeStateValue>().notNull(),
    issuedByOperatorId: text('issued_by_operator_id').notNull(),
    issuedAt: bigint('issued_at', { mode: 'number' }).notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    failedAttempts: smallint('failed_attempts').notNull().default(0),
    closedAt: bigint('closed_at', { mode: 'number' }),
    closedByOperatorId: text('closed_by_operator_id'),
  },
  (t) => [
    uniqueIndex('pairing_codes_one_active_key')
      .on(t.state)
      .where(sql`${t.state} = 'ACTIVE'`),
    foreignKey({
      name: 'pairing_codes_issued_by_operator_id_fkey',
      columns: [t.issuedByOperatorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    // Migration 0036 (principal, 2026-11-02): a reference to a record OF THE UNIT drops its
    // attribution when the operator goes, instead of holding the record in place. The operator
    // who OPENED or ISSUED something keeps RESTRICT - that act is the credential trail itself.
    foreignKey({
      name: 'pairing_codes_closed_by_operator_id_fkey',
      columns: [t.closedByOperatorId],
      foreignColumns: [operators.id],
    })
      .onDelete('set null')
      .onUpdate('no action'),
    check('pairing_codes_id_check', matches(t.id, '^PCD-[0-9]{6,}$')),
    check('pairing_codes_code_hash_check', sql`octet_length(${t.codeHash}) = 32`),
    check('pairing_codes_state_check', oneOf(t.state, CODE_STATE)),
    check(
      'pairing_codes_times_check',
      sql`${t.expiresAt} > ${t.issuedAt} AND (${t.closedAt} IS NULL OR ${t.closedAt} >= ${t.issuedAt})`,
    ),
    check('pairing_codes_attempts_check', sql`${t.failedAttempts} BETWEEN 0 AND 5`),
    check(
      'pairing_codes_closed_check',
      sql`(${t.state} = 'ACTIVE') = (${t.closedAt} IS NULL) AND (${t.closedByOperatorId} IS NULL OR ${t.state} = 'CANCELLED')`,
    ),
  ],
);

/** T-08. One row per successful redeem; REVOKED and UNPAIRED are final. */
export const pairedDevices = pgTable(
  'paired_devices',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    platform: text('platform').notNull(),
    appVersion: text('app_version').notNull(),
    state: text('state').$type<DeviceStateValue>().notNull(),
    pairedAt: bigint('paired_at', { mode: 'number' }).notNull(),
    pairedWithCodeId: text('paired_with_code_id').notNull(),
    lastSeenAt: bigint('last_seen_at', { mode: 'number' }).notNull(),
    revokedAt: bigint('revoked_at', { mode: 'number' }),
    revokedByOperatorId: text('revoked_by_operator_id'),
    revokeReason: text('revoke_reason'),
    unpairedAt: bigint('unpaired_at', { mode: 'number' }),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    unique('paired_devices_paired_with_code_id_key').on(t.pairedWithCodeId),
    foreignKey({
      name: 'paired_devices_paired_with_code_id_fkey',
      columns: [t.pairedWithCodeId],
      foreignColumns: [pairingCodes.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'paired_devices_revoked_by_operator_id_fkey',
      columns: [t.revokedByOperatorId],
      foreignColumns: [operators.id],
    })
      .onDelete('set null')
      .onUpdate('no action'),
    check('paired_devices_id_check', matches(t.id, '^DEV-[0-9]{4,}$')),
    check(
      'paired_devices_text_check',
      sql`char_length(${t.name}) BETWEEN 1 AND 60 AND char_length(${t.platform}) BETWEEN 1 AND 32 AND char_length(${t.appVersion}) BETWEEN 1 AND 32`,
    ),
    check('paired_devices_state_check', oneOf(t.state, DEVICE_STATE)),
    check(
      'paired_devices_lifecycle_check',
      sql`(${t.state} = 'PAIRED' AND ${t.revokedAt} IS NULL AND ${t.revokedByOperatorId} IS NULL AND ${t.revokeReason} IS NULL AND ${t.unpairedAt} IS NULL) OR (${t.state} = 'REVOKED' AND ${t.revokedAt} IS NOT NULL AND ${t.revokedByOperatorId} IS NOT NULL AND char_length(${t.revokeReason}) BETWEEN 5 AND 500 AND ${t.unpairedAt} IS NULL) OR (${t.state} = 'UNPAIRED' AND ${t.unpairedAt} IS NOT NULL AND ${t.revokedAt} IS NULL AND ${t.revokedByOperatorId} IS NULL AND ${t.revokeReason} IS NULL)`,
    ),
  ],
);

/**
 * T-09. One row per device, created with it; it stays after REVOKED and UNPAIRED.
 * NO COLUMN OF THIS TABLE MAY BE LOGGED OR RETURNED (NL-1).
 */
export const deviceCredentials = pgTable(
  'device_credentials',
  {
    deviceId: text('device_id').primaryKey(),
    currentHash: bytea('current_hash').notNull(),
    nextHash: bytea('next_hash'),
    rotatedAt: bigint('rotated_at', { mode: 'number' }),
  },
  (t) => [
    foreignKey({
      name: 'device_credentials_device_id_fkey',
      columns: [t.deviceId],
      foreignColumns: [pairedDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    unique('device_credentials_current_hash_key').on(t.currentHash),
    unique('device_credentials_next_hash_key').on(t.nextHash),
    check(
      'device_credentials_lengths_check',
      sql`octet_length(${t.currentHash}) = 32 AND (${t.nextHash} IS NULL OR (octet_length(${t.nextHash}) = 32 AND ${t.nextHash} <> ${t.currentHash}))`,
    ),
  ],
);

/** T-10. One row per issued token; a use is one compare-and-set UPDATE on `used_at` (AT-C4). */
export const biometricTokens = pgTable(
  'biometric_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: bytea('token_hash').notNull(),
    familyId: uuid('family_id').notNull(),
    deviceId: text('device_id').notNull(),
    operatorId: text('operator_id').notNull(),
    issuedAt: bigint('issued_at', { mode: 'number' }).notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    usedAt: bigint('used_at', { mode: 'number' }),
    revokedAt: bigint('revoked_at', { mode: 'number' }),
    revokeReason: text('revoke_reason').$type<BioRevokeReason>(),
  },
  (t) => [
    unique('biometric_tokens_token_hash_key').on(t.tokenHash),
    uniqueIndex('biometric_tokens_one_live_key')
      .on(t.deviceId, t.operatorId)
      .where(sql`${t.usedAt} IS NULL AND ${t.revokedAt} IS NULL`),
    index('biometric_tokens_family_id_idx').on(t.familyId),
    index('biometric_tokens_live_operator_idx')
      .on(t.operatorId)
      .where(sql`${t.usedAt} IS NULL AND ${t.revokedAt} IS NULL`),
    foreignKey({
      name: 'biometric_tokens_device_id_fkey',
      columns: [t.deviceId],
      foreignColumns: [pairedDevices.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'biometric_tokens_operator_id_fkey',
      columns: [t.operatorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('biometric_tokens_token_hash_check', sql`octet_length(${t.tokenHash}) = 32`),
    check(
      'biometric_tokens_times_check',
      sql`${t.expiresAt} > ${t.issuedAt} AND (${t.usedAt} IS NULL OR ${t.usedAt} >= ${t.issuedAt})`,
    ),
    check(
      'biometric_tokens_revoke_check',
      sql`(${t.revokedAt} IS NULL) = (${t.revokeReason} IS NULL) AND (${t.revokeReason} IS NULL OR ${oneOf(t.revokeReason, BIO_REVOKE_REASON)})`,
    ),
  ],
);

/**
 * T-11. Two rows, kept across a reset. A counter moves by ONE statement (AT-5):
 * `UPDATE registry_counters SET next_value = next_value + 1 WHERE name = $1 RETURNING next_value - 1`.
 */
export const registryCounters = pgTable(
  'registry_counters',
  {
    name: text('name').$type<RegistryCounterName>().primaryKey(),
    nextValue: bigint('next_value', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('registry_counters_name_check', oneOf(t.name, REGISTRY_COUNTER)),
    check('registry_counters_value_check', sql`${t.nextValue} >= 1`),
  ],
);

export type PairingCodeRow = typeof pairingCodes.$inferSelect;
export type NewPairingCodeRow = typeof pairingCodes.$inferInsert;
export type PairedDeviceRow = typeof pairedDevices.$inferSelect;
export type NewPairedDeviceRow = typeof pairedDevices.$inferInsert;
export type DeviceCredentialRow = typeof deviceCredentials.$inferSelect;
export type NewDeviceCredentialRow = typeof deviceCredentials.$inferInsert;
export type BiometricTokenRow = typeof biometricTokens.$inferSelect;
export type NewBiometricTokenRow = typeof biometricTokens.$inferInsert;
export type RegistryCounterRow = typeof registryCounters.$inferSelect;
export type NewRegistryCounterRow = typeof registryCounters.$inferInsert;
