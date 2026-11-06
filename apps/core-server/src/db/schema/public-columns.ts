/**
 * Public column sets (database contract NL-6).
 *
 * For each of the five tables below, the set of columns that may reach an answer, a realtime
 * message or a log line. The hash columns are left out. A repository function that feeds an
 * answer or a log selects one of these sets, never `SELECT *`:
 *
 *   db.select(authSessionPublicColumns).from(authSessions).where(...)
 *
 * `operators` and `paired_devices` hold no hash column (their hashes live in
 * `operator_credentials` and `device_credentials`, of which NO column may be logged or returned,
 * NL-1), so their public set is the whole table; it is exported so that a caller never needs
 * `SELECT *` there either.
 */
import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { authSessions } from './identity';
import { biometricTokens, pairedDevices, pairingCodes } from './pairing';
import { operators } from './rbac';

/** The columns of a table without the named ones. */
function without<T extends PgTable, K extends keyof T['_']['columns']>(
  table: T,
  ...hidden: readonly K[]
): Omit<T['_']['columns'], K> {
  const columns: Record<string, unknown> = { ...getTableColumns(table) };
  for (const name of hidden) delete columns[name as string];
  return columns as Omit<T['_']['columns'], K>;
}

/** The hash columns NL-1 names, by table: what the public sets leave out. */
export const HIDDEN_HASH_COLUMNS = Object.freeze({
  auth_sessions: ['token_hash'],
  pairing_codes: ['code_hash'],
  biometric_tokens: ['token_hash'],
} as const);

export const operatorPublicColumns = without(operators);
export const pairedDevicePublicColumns = without(pairedDevices);
/** `auth_sessions` without `token_hash`. */
export const authSessionPublicColumns = without(authSessions, 'tokenHash');
/** `pairing_codes` without `code_hash`. */
export const pairingCodePublicColumns = without(pairingCodes, 'codeHash');
/** `biometric_tokens` without `token_hash`. */
export const biometricTokenPublicColumns = without(biometricTokens, 'tokenHash');
