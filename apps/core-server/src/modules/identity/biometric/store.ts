/**
 * The statements of the biometric token (plan row W41; database contract §4.10, §5.2, §5.3,
 * §5.6 AT-3 and AT-C4; spec §5.6, ENG-25; SR-36, SR-37, SR-67, SR-72).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67, NL-3). A function takes the connection to run on: here always a unit of work,
 * because every operation of this folder changes something. Every table is named with its
 * schema.
 *
 * WHAT IS NEVER SELECTED OR RETURNED (NL-1, NL-6): `biometric_tokens.token_hash`. It is written
 * by the two inserts and is a WHERE parameter of the claim and of the read that follows a failed
 * claim. No function of this file hands a hash out.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE (database contract §7.3): SELECT and INSERT on
 * `biometric_tokens`, UPDATE of `used_at`, `revoked_at` and `revoke_reason` only. It can neither
 * delete a token nor move one to another device, operator or family.
 *
 * THE LIFE OF A TOKEN is three columns: `used_at`, `revoked_at`, `expires_at`.
 *
 *   live      not used, not revoked, not past `expires_at`   the one state that signs in
 *   used      `used_at` is set                               presented again: a REUSE
 *   revoked   `revoked_at` is set, with its reason
 *   expired   30 days after its issue, never used
 *
 * At most one row of a device and an operator is "not used and not revoked" (a unique index).
 *
 * TRANSITIONS ARE COMPARE-AND-SET (AT-3): one statement whose WHERE states the expected state
 * and whose returned rows decide. `CLAIM_TOKEN` is the one statement that uses a token: of any
 * number of requests that present the same value, to one process or to several, it returns a
 * row to exactly one.
 */
import type { PairedDeviceState } from '@dems/shared/api';
import type { QueryResultRow } from 'pg';
import { unitContextOf, type UnitOfWork } from '../../../core';
import type { AuthMethodValue, BioRevokeReason } from '../../../db/schema';
import type { Queryable } from '../session-store';

// The driver hands a `bigint` column over as text; every time of this module is a safe integer.
const time = (value: string | number): number => Number(value);
const optionalTime = (value: string | number | null): number | null => (value === null ? null : Number(value));

// ── Use: the consuming compare-and-set, and what follows it ────────────────────────────────────

/** The token a request now owns the use of. No hash. */
export interface ClaimedToken {
  /** The row's UUID: safe to log (NL-7), never the token. */
  readonly id: string;
  readonly familyId: string;
  readonly operatorId: string;
}

/**
 * AT-C4, the first statement: the token becomes used only where it is this device's, not used,
 * not revoked and not past its time. One row: this request owns the use. No row: it does not,
 * whatever the reason, and nothing was changed.
 */
export const CLAIM_TOKEN =
  'UPDATE public.biometric_tokens SET used_at = $2 ' +
  'WHERE token_hash = $1 AND device_id = $3 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $2 ' +
  'RETURNING id, family_id, operator_id';

export async function claimToken(db: Queryable, tokenHash: Buffer, deviceId: string, now: number): Promise<ClaimedToken | null> {
  const { rows } = await db.query<{ id: string; family_id: string; operator_id: string }>(CLAIM_TOKEN, [tokenHash, now, deviceId]);
  const row = rows[0];
  return row === undefined ? null : { id: row.id, familyId: row.family_id, operatorId: row.operator_id };
}

export interface NewToken {
  readonly tokenHash: Buffer;
  readonly familyId: string;
  readonly deviceId: string;
  readonly operatorId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

/** AT-C4, rotation: the next token of the family, in the unit that used the one before it. */
export const INSERT_TOKEN =
  'INSERT INTO public.biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at) ' +
  'VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';

export async function insertToken(db: Queryable, token: NewToken): Promise<string> {
  const { rows } = await db.query<{ id: string }>(INSERT_TOKEN, [
    token.tokenHash,
    token.familyId,
    token.deviceId,
    token.operatorId,
    token.issuedAt,
    token.expiresAt,
  ]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('the token insert returned no row');
  return id;
}

/** A stored token as the read after a failed claim finds it. No hash. */
export interface TokenState {
  readonly id: string;
  readonly familyId: string;
  readonly deviceId: string;
  readonly operatorId: string;
  readonly usedAt: number | null;
  readonly revokedAt: number | null;
  readonly revokeReason: BioRevokeReason | null;
  readonly expiresAt: number;
}

/**
 * AT-C4, "no row: read why". Asked only by a request whose claim returned nothing, to tell a
 * reuse from every other refusal. It decides no use: the claim did.
 */
export const READ_TOKEN_STATE =
  'SELECT id, family_id, device_id, operator_id, used_at, revoked_at, revoke_reason, expires_at ' +
  'FROM public.biometric_tokens WHERE token_hash = $1';

interface TokenStateRow extends QueryResultRow {
  id: string;
  family_id: string;
  device_id: string;
  operator_id: string;
  used_at: string | null;
  revoked_at: string | null;
  revoke_reason: BioRevokeReason | null;
  expires_at: string;
}

export async function readTokenState(db: Queryable, tokenHash: Buffer): Promise<TokenState | null> {
  const { rows } = await db.query<TokenStateRow>(READ_TOKEN_STATE, [tokenHash]);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    id: row.id,
    familyId: row.family_id,
    deviceId: row.device_id,
    operatorId: row.operator_id,
    usedAt: optionalTime(row.used_at),
    revokedAt: optionalTime(row.revoked_at),
    revokeReason: row.revoke_reason,
    expiresAt: time(row.expires_at),
  };
}

// ── Revocation: one function, four scopes ──────────────────────────────────────────────────────

/**
 * Why and how far tokens are revoked. A revoked token is never usable again; a token that was
 * revoked before stays as it is (each statement states `revoked_at IS NULL`).
 */
export type BiometricRevocation =
  /**
   * The whole family of one token, used rows included: a reused token (AT-C4), or a claim whose
   * operator or device turned out to be retired.
   */
  | {
      readonly scope: 'FAMILY';
      readonly familyId: string;
      readonly reason: Extract<BioRevokeReason, 'TOKEN_REUSE' | 'USER_DISABLED' | 'DEVICE_REVOKED' | 'DEVICE_UNPAIRED'>;
    }
  /**
   * Every token of one operator on one device, used rows included: the operator turned biometric
   * sign-in off there, or enrolled again (spec §5.6 step 8).
   */
  | {
      readonly scope: 'ENROLMENT';
      readonly deviceId: string;
      readonly operatorId: string;
      readonly reason: Extract<BioRevokeReason, 'DISABLED' | 'REENROLLED'>;
    }
  /** The live tokens of a device that was revoked or unpaired (SR-34). For the pairing module. */
  | { readonly scope: 'DEVICE'; readonly deviceId: string; readonly reason: Extract<BioRevokeReason, 'DEVICE_REVOKED' | 'DEVICE_UNPAIRED'> }
  /** The live tokens of an operator who was disabled (AT-C5). For the administration module. */
  | { readonly scope: 'OPERATOR'; readonly operatorId: string; readonly reason: Extract<BioRevokeReason, 'USER_DISABLED'> };

export type BiometricRevocationScope = BiometricRevocation['scope'];

const REVOKE = 'UPDATE public.biometric_tokens SET revoked_at = $1, revoke_reason = $2 WHERE ';

/** The statement of each scope. `$1` is the time, `$2` the reason, `$3` (and `$4`) what the scope names. */
export const REVOKE_TOKENS: Readonly<Record<BiometricRevocationScope, string>> = {
  FAMILY: `${REVOKE}family_id = $3 AND revoked_at IS NULL RETURNING id`,
  ENROLMENT: `${REVOKE}device_id = $3 AND operator_id = $4 AND revoked_at IS NULL RETURNING id`,
  DEVICE: `${REVOKE}device_id = $3 AND used_at IS NULL AND revoked_at IS NULL RETURNING id`,
  OPERATOR: `${REVOKE}operator_id = $3 AND used_at IS NULL AND revoked_at IS NULL RETURNING id`,
};

function namedBy(revocation: BiometricRevocation): string[] {
  switch (revocation.scope) {
    case 'FAMILY':
      return [revocation.familyId];
    case 'ENROLMENT':
      return [revocation.deviceId, revocation.operatorId];
    case 'DEVICE':
      return [revocation.deviceId];
    case 'OPERATOR':
      return [revocation.operatorId];
  }
}

async function revokeTokens(db: Queryable, revocation: BiometricRevocation, now: number): Promise<number> {
  return (await db.query(REVOKE_TOKENS[revocation.scope], [now, revocation.reason, ...namedBy(revocation)])).rows.length;
}

/**
 * Revokes biometric tokens inside the CALLER's unit of work and returns how many rows it
 * changed. It writes no audit row and publishes nothing: the caller's row says what happened.
 *
 * This folder uses the scopes `FAMILY` and `ENROLMENT`. The scopes `DEVICE` and `OPERATOR` are
 * what a device's end of life (pairing module) and a disabled operator (administration module)
 * need: each states the predicate of the statement that module runs itself today (the live
 * tokens of the device, of the operator), so calling this instead changes no behaviour.
 */
export async function revokeBiometricTokens(unit: UnitOfWork, revocation: BiometricRevocation, now: number): Promise<number> {
  return revokeTokens(unitContextOf(unit), revocation, now);
}

// ── Enrolment ──────────────────────────────────────────────────────────────────────────────────

/** A token as its enrolment stored it. The device and the operator are the session's. */
export interface EnrolledToken {
  readonly id: string;
  readonly deviceId: string;
  readonly operatorId: string;
}

/**
 * SR-36: a token is issued ONLY INSIDE A PASSWORD SESSION ON A PAIRED DEVICE, and that is this
 * statement's WHERE, not a check before it: the row is inserted only where the caller's session
 * is still open, was created by password, belongs to an enabled operator and is bound to a
 * device that is PAIRED. The device and the operator of the token are read from that session
 * row, never from the request. No row: nothing was issued.
 */
export const ENROL_TOKEN =
  'INSERT INTO public.biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at) ' +
  'SELECT $1::bytea, $2::uuid, s.device_id, s.operator_id, $4::bigint, $5::bigint ' +
  'FROM public.auth_sessions s JOIN public.operators o ON o.id = s.operator_id JOIN public.paired_devices d ON d.id = s.device_id ' +
  "WHERE s.id = $3 AND s.ended_at IS NULL AND s.method = 'PASSWORD' AND o.enabled AND d.state = 'PAIRED' " +
  'RETURNING id, device_id, operator_id';

export async function enrolToken(
  db: Queryable,
  token: { readonly tokenHash: Buffer; readonly familyId: string; readonly sessionId: string; readonly issuedAt: number; readonly expiresAt: number },
): Promise<EnrolledToken | null> {
  const { rows } = await db.query<{ id: string; device_id: string; operator_id: string }>(ENROL_TOKEN, [
    token.tokenHash,
    token.familyId,
    token.sessionId,
    token.issuedAt,
    token.expiresAt,
  ]);
  const row = rows[0];
  return row === undefined ? null : { id: row.id, deviceId: row.device_id, operatorId: row.operator_id };
}

/** What the session of a refused enrolment is, for the answer. */
export interface EnrolmentSession {
  readonly open: boolean;
  readonly method: AuthMethodValue;
  readonly operatorEnabled: boolean;
  /** Null for a session without a device (a web console session). */
  readonly deviceState: PairedDeviceState | null;
}

/** Asked only after `ENROL_TOKEN` returned no row: why. It decides nothing. */
export const READ_ENROLMENT_SESSION =
  'SELECT s.ended_at IS NULL AS open, s.method, o.enabled, d.state ' +
  'FROM public.auth_sessions s JOIN public.operators o ON o.id = s.operator_id LEFT JOIN public.paired_devices d ON d.id = s.device_id ' +
  'WHERE s.id = $1';

export async function readEnrolmentSession(db: Queryable, sessionId: string): Promise<EnrolmentSession | null> {
  const { rows } = await db.query<{ open: boolean; method: AuthMethodValue; enabled: boolean; state: PairedDeviceState | null }>(READ_ENROLMENT_SESSION, [
    sessionId,
  ]);
  const row = rows[0];
  return row === undefined ? null : { open: row.open, method: row.method, operatorEnabled: row.enabled, deviceState: row.state };
}

// ── The failure report ─────────────────────────────────────────────────────────────────────────

/**
 * SR-37: does this operator have an enrolment on this device: a token of the pair that was not
 * revoked, live or used, OF AN OPERATOR WHO IS ENABLED. The answer decides only whether a failure
 * row may name the operator.
 *
 * The statement asks `operators.enabled` itself (security checkpoint CPS1-8). A disable revokes
 * the operator's live tokens only (the scope OPERATOR, database contract AT-C5): the used rows
 * of a family stay unrevoked, as the history the reuse rule reads. Without the join such a row
 * would keep counting as an enrolment and a report could name an operator who was disabled. The
 * rule is stated here, where it is decided, so it holds for every way an operator can come to be
 * disabled, and for the rows a disable left behind before this statement had the join.
 */
export const FIND_ENROLMENT =
  'SELECT 1 AS found FROM public.biometric_tokens t JOIN public.operators o ON o.id = t.operator_id ' +
  'WHERE t.device_id = $1 AND t.operator_id = $2 AND t.revoked_at IS NULL AND o.enabled LIMIT 1';

export async function hasEnrolment(db: Queryable, deviceId: string, operatorId: string): Promise<boolean> {
  return (await db.query(FIND_ENROLMENT, [deviceId, operatorId])).rows.length > 0;
}
