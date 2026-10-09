/**
 * SQL fragments for the CHECK constraints of the typed schema (database contract §2.4, "Format
 * rules used by name in section 4").
 *
 * Every fragment is statement TEXT for `drizzle-kit generate`, never a bind parameter: a CHECK
 * has none. The only values placed into text are the literals of this folder (value lists,
 * patterns); no fragment takes a value from outside it.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { AUDIT_DETAIL_FORBIDDEN_KEYS } from './value-sets';

/** A single-quoted SQL string literal. The values of this folder contain no quote; one is doubled anyway. */
function quoted(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** `'A', 'B', 'C'`: the body of an `IN (...)` list. */
export function valueList(values: readonly string[]): SQL {
  return sql.raw(values.map(quoted).join(', '));
}

/** `column IN ('A', 'B', ...)`. */
export function oneOf(column: AnyPgColumn, values: readonly string[]): SQL {
  return sql`${column} IN (${valueList(values)})`;
}

/** `column ~ '<pattern>'`. */
export function matches(column: AnyPgColumn, pattern: string): SQL {
  return sql`${column} ~ ${sql.raw(quoted(pattern))}`;
}

/** `HEX64(c)`: 64 lower-case hexadecimal digits (TY-4). */
export const hex64 = (column: AnyPgColumn): SQL => matches(column, '^[0-9a-f]{64}$');
/** `CODE(c)`: an open set of SCREAMING_SNAKE_CASE values. */
export const code = (column: AnyPgColumn): SQL => matches(column, '^[A-Z][A-Z0-9_]{0,63}$');
/** `SESSION_ID(c)` (`api/patterns.ts:11`). */
export const sessionId = (column: AnyPgColumn): SQL => matches(column, '^SES-[0-9]{8}-[0-9]{4}$');
/** `EVIDENCE_ID(c)` (`api/patterns.ts:14`). */
export const evidenceId = (column: AnyPgColumn): SQL => matches(column, '^EV-[0-9]{8}-[0-9]{4}$');
/** `OPERATOR_ID(c)` (`api/patterns.ts:17`). */
export const operatorId = (column: AnyPgColumn): SQL => matches(column, '^OPR-[0-9]{3}$');
/** `EXPORT_ID(c)` (`api/patterns.ts:20`). */
export const exportId = (column: AnyPgColumn): SQL => matches(column, '^EXP-[0-9]{6}$');
/** `CASE_NUMBER(c)` (`api/patterns.ts:27`). */
export const caseNumber = (column: AnyPgColumn): SQL => matches(column, '^LP/[0-9]{4}/[0-9]{4}-[0-9]{4}$');

/** `FLAT(c)`: the function of migration `0000_prelude`. */
export const flat = (column: AnyPgColumn): SQL => sql`public.dems_jsonb_is_flat(${column})`;

/** `NO_SECRET_KEYS(c)`: the map has none of the 28 denied key names (`?|` is "has any of these keys"). */
export const noSecretKeys = (column: AnyPgColumn): SQL =>
  sql`NOT (${column} ?| ARRAY[${sql.raw(AUDIT_DETAIL_FORBIDDEN_KEYS.map(quoted).join(','))}])`;

/**
 * The signature encoding each algorithm may hold (database contract dbc-3 §C.5, register W1-C10).
 * A real Ed25519 signature is 64 BYTES (128 lower-case hex characters), not 64 hex characters, so
 * the alternations count whole bytes. The `SIMULATED-SHA256` branch keeps every v1 row valid
 * (a 64-hex-char digest stand-in) so 0004 validates against existing data (dbc-3 §A.4).
 */
const SIGNATURE_HEX_BY_ALGORITHM: Readonly<Record<string, string>> = {
  'SIMULATED-SHA256': '^([0-9a-f]{2}){32}$',
  Ed25519: '^([0-9a-f]{2}){64}$',
  'ECDSA-P256-SHA256': '^([0-9a-f]{2}){64,72}$',
};

/** The one algorithm that is a stand-in and therefore must be flagged simulated. */
const SIMULATED_SIGNATURE_ALGORITHM = 'SIMULATED-SHA256';

/**
 * `SIGNATURE_RULE(alg, simulated)`: the algorithm/simulated-flag pair of dbc-3 §C.4, mirrored into
 * the transcript-revision CHECK (B.9). A real algorithm is never flagged simulated and the
 * simulated stand-in always is.
 */
export function signatureRule(
  algorithm: AnyPgColumn,
  simulated: AnyPgColumn,
  algorithms: readonly string[],
): SQL {
  const real = algorithms.filter((name) => name !== SIMULATED_SIGNATURE_ALGORITHM);
  if (real.length === 0) throw new Error('signatureRule needs at least one real algorithm');
  return sql`${oneOf(algorithm, algorithms)} AND ((${algorithm} = ${sql.raw(quoted(SIMULATED_SIGNATURE_ALGORITHM))} AND ${simulated}) OR (${oneOf(algorithm, real)} AND NOT ${simulated}))`;
}

/**
 * `SIGNATURE_VALUE(col, alg)`: the per-algorithm encoding of dbc-3 §C.5, as its own constraint so
 * the hash CHECK next to it carries hash columns only (W1-C10).
 */
export function signatureValue(
  value: AnyPgColumn,
  algorithm: AnyPgColumn,
  algorithms: readonly string[],
): SQL {
  return sql.join(
    algorithms.map((name) => {
      const pattern = SIGNATURE_HEX_BY_ALGORITHM[name];
      if (pattern === undefined) throw new Error(`no signature encoding declared for ${name}`);
      return sql`(${algorithm} = ${sql.raw(quoted(name))} AND ${matches(value, pattern)})`;
    }),
    sql` OR `,
  );
}
