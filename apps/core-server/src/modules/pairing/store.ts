/**
 * The statements of the pairing module (plan row W32; database contract §4.7 to §4.11, §5.2,
 * §5.3, §5.6 AT-3 to AT-5, AT-C2, AT-C3; spec §6; SR-28, SR-31, SR-33, SR-34, SR-67).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67, NL-3). The quoted words are the fixed state names of the schema. A function takes
 * the connection to run on: the pool for a read, the unit of work for a change. Every table is
 * named with its schema.
 *
 * WHAT IS NEVER SELECTED INTO AN ANSWER OR A LOG (NL-1, NL-6): `pairing_codes.code_hash` and
 * every column of `device_credentials` but `rotated_at`. A credential hash is a WHERE parameter
 * and an INSERT or SET value, never a selected or returned column. The code hash is returned by
 * ONE statement, the consuming update of a redeem, to the one request that took an attempt, for
 * the constant-time comparison in `secrets.ts`, and goes nowhere else.
 *
 * TRANSITIONS ARE COMPARE-AND-SET (AT-3): one UPDATE whose WHERE states the expected state and
 * whose returned rows decide. The server never decides from a value that an earlier statement
 * read without a lock. A COUNTER moves by one statement that reads and advances it (AT-5).
 */
import type { PairedDeviceState } from '@dems/shared/api';
import type { QueryResultRow } from 'pg';
import {
  DEVICE_ID_MIN_DIGITS,
  DEVICE_ID_PREFIX,
  PAIRING_CODE_ID_MIN_DIGITS,
  PAIRING_CODE_ID_PREFIX,
  PAIRING_CODE_MAX_FAILED_REDEEMS,
} from './limits';

/** A connection that runs one parameterised statement: the runtime pool, or a unit of work. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

// The driver hands a `bigint` column over as text; every time of this module is a safe integer.
const time = (value: string | number): number => Number(value);
const optionalTime = (value: string | number | null): number | null => (value === null ? null : Number(value));

/** A row a statement returned, or null when it returned none. */
const first = <Row>(rows: readonly Row[]): Row | null => rows[0] ?? null;

// ── Identifiers: the two registry counters ─────────────────────────────────────────────────────

/** The two counters of `registry_counters` (database contract §4.11). They survive a demo reset. */
export type RegistryCounter = 'device' | 'pairingCode';

/** AT-5: read and advance in one statement. The row stays locked until the transaction ends. */
export const NEXT_REGISTRY_NUMBER =
  'UPDATE public.registry_counters SET next_value = next_value + 1 WHERE name = $1 RETURNING next_value - 1 AS number';

export async function nextRegistryNumber(db: Queryable, counter: RegistryCounter): Promise<number> {
  const { rows } = await db.query<{ number: string }>(NEXT_REGISTRY_NUMBER, [counter]);
  const number = Number(rows[0]?.number);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`the registry counter ${counter} returned no number`);
  return number;
}

/** `DEV-NNNN` for the number the `device` counter gave (PR-P9). */
export function deviceIdOf(number: number): string {
  return `${DEVICE_ID_PREFIX}${String(number).padStart(DEVICE_ID_MIN_DIGITS, '0')}`;
}

/** `PCD-NNNNNN` for the number the `pairingCode` counter gave. It names a code; it is not the code. */
export function pairingCodeIdOf(number: number): string {
  return `${PAIRING_CODE_ID_PREFIX}${String(number).padStart(PAIRING_CODE_ID_MIN_DIGITS, '0')}`;
}

// ── Pairing codes ──────────────────────────────────────────────────────────────────────────────

/** What an operator may read of the active code (spec §6.2). Never the code, never its hash. */
export interface ActiveCode {
  readonly id: string;
  readonly issuedBy: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  /** Failed redeems so far, 0 to 5. */
  readonly failedAttempts: number;
}

interface ActiveCodeRow extends QueryResultRow {
  id: string;
  issued_by_operator_id: string;
  issued_at: string;
  expires_at: string;
  failed_attempts: number;
}

/** The one ACTIVE row (the unique index `pairing_codes_one_active_key`), if it has not expired. */
export const READ_ACTIVE_CODE =
  'SELECT id, issued_by_operator_id, issued_at, expires_at, failed_attempts FROM public.pairing_codes ' +
  "WHERE state = 'ACTIVE' AND expires_at > $1";

export async function readActiveCode(db: Queryable, now: number): Promise<ActiveCode | null> {
  const row = first((await db.query<ActiveCodeRow>(READ_ACTIVE_CODE, [now])).rows);
  if (row === null) return null;
  return {
    id: row.id,
    issuedBy: row.issued_by_operator_id,
    issuedAt: time(row.issued_at),
    expiresAt: time(row.expires_at),
    failedAttempts: row.failed_attempts,
  };
}

/** T4: the active code whose 300 s have passed becomes EXPIRED. No row: not expired, or closed meanwhile. */
export const EXPIRE_ACTIVE_CODE =
  "UPDATE public.pairing_codes SET state = 'EXPIRED', closed_at = $1 WHERE state = 'ACTIVE' AND expires_at <= $1 RETURNING id";

export async function expireActiveCode(db: Queryable, now: number): Promise<string | null> {
  return first((await db.query<{ id: string }>(EXPIRE_ACTIVE_CODE, [now])).rows)?.id ?? null;
}

/** The sweeper's question before it takes a unit: is there anything to expire? A read; it decides nothing. */
export const ANY_EXPIRED_CODE = "SELECT 1 AS found FROM public.pairing_codes WHERE state = 'ACTIVE' AND expires_at <= $1 LIMIT 1";

export async function anyExpiredCode(db: Queryable, now: number): Promise<boolean> {
  return (await db.query(ANY_EXPIRED_CODE, [now])).rows.length > 0;
}

/** T3: the active code becomes CANCELLED, by an operator. No row: no code is active. */
export const CANCEL_ACTIVE_CODE =
  "UPDATE public.pairing_codes SET state = 'CANCELLED', closed_at = $1, closed_by_operator_id = $2 WHERE state = 'ACTIVE' RETURNING id";

export async function cancelActiveCode(db: Queryable, now: number, operatorId: string): Promise<string | null> {
  return first((await db.query<{ id: string }>(CANCEL_ACTIVE_CODE, [now, operatorId])).rows)?.id ?? null;
}

export interface NewCode {
  readonly id: string;
  /** SHA-256 of `<code ID>:<six digits>`. The code itself reaches no statement. */
  readonly codeHash: Buffer;
  readonly issuedBy: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

/** T1. `pairing_codes_one_active_key` refuses a second ACTIVE row, whatever ran before. */
export const INSERT_CODE =
  'INSERT INTO public.pairing_codes (id, code_hash, state, issued_by_operator_id, issued_at, expires_at) ' +
  "VALUES ($1, $2, 'ACTIVE', $3, $4, $5)";

export async function insertCode(db: Queryable, code: NewCode): Promise<void> {
  await db.query(INSERT_CODE, [code.id, code.codeHash, code.issuedBy, code.issuedAt, code.expiresAt]);
}

/** What the consuming update hands to the one request that took an attempt. */
export interface ConsumedAttempt {
  readonly codeId: string;
  /** For the constant-time comparison only. Never logged, never returned, never kept. */
  readonly codeHash: Buffer;
  /** Failed redeems of the code INCLUDING this attempt, 1 to 5. */
  readonly failedAttempts: number;
}

/**
 * AT-C2, AT-4: one attempt is taken from the active code, and its row is locked, BEFORE anything
 * is compared. No row: no usable code (none, closed, expired, or five attempts used); nothing
 * is compared then. `$2` is the limit of PR-P5.
 */
export const CONSUME_REDEEM_ATTEMPT =
  'UPDATE public.pairing_codes SET failed_attempts = failed_attempts + 1 ' +
  "WHERE state = 'ACTIVE' AND expires_at > $1 AND failed_attempts < $2 RETURNING id, code_hash, failed_attempts";

export async function consumeRedeemAttempt(db: Queryable, now: number): Promise<ConsumedAttempt | null> {
  const row = first(
    (await db.query<{ id: string; code_hash: Buffer; failed_attempts: number }>(CONSUME_REDEEM_ATTEMPT, [now, PAIRING_CODE_MAX_FAILED_REDEEMS])).rows,
  );
  return row === null ? null : { codeId: row.id, codeHash: row.code_hash, failedAttempts: row.failed_attempts };
}

/** T5: the code whose fifth attempt failed becomes EXHAUSTED. `$3` is the limit of PR-P5. */
export const EXHAUST_CODE =
  "UPDATE public.pairing_codes SET state = 'EXHAUSTED', closed_at = $1 WHERE id = $2 AND state = 'ACTIVE' AND failed_attempts = $3 RETURNING id";

export async function exhaustCode(db: Queryable, now: number, codeId: string): Promise<boolean> {
  return (await db.query(EXHAUST_CODE, [now, codeId, PAIRING_CODE_MAX_FAILED_REDEEMS])).rows.length === 1;
}

/**
 * AT-C3, T2: the code becomes REDEEMED only where it is still ACTIVE and not expired; the
 * attempt the consuming update took is given back, so `failed_attempts` still means "failed
 * redeems". No row: another request redeemed or closed it; the caller gives the generic answer.
 */
export const REDEEM_CODE =
  "UPDATE public.pairing_codes SET state = 'REDEEMED', closed_at = $1, failed_attempts = failed_attempts - 1 " +
  "WHERE id = $2 AND state = 'ACTIVE' AND expires_at > $1 RETURNING id";

export async function redeemCode(db: Queryable, now: number, codeId: string): Promise<boolean> {
  return (await db.query(REDEEM_CODE, [now, codeId])).rows.length === 1;
}

// ── Paired devices and their credentials ───────────────────────────────────────────────────────

export interface NewDevice {
  readonly id: string;
  readonly name: string;
  readonly platform: string;
  readonly appVersion: string;
  readonly pairedAt: number;
  readonly pairedWithCodeId: string;
}

/** T6. `paired_devices_paired_with_code_id_key` is the last line: a second device for one code fails with 23505. */
export const INSERT_DEVICE =
  'INSERT INTO public.paired_devices (id, name, platform, app_version, state, paired_at, paired_with_code_id, last_seen_at, updated_at) ' +
  "VALUES ($1, $2, $3, $4, 'PAIRED', $5, $6, $5, $5)";

export async function insertDevice(db: Queryable, device: NewDevice): Promise<void> {
  await db.query(INSERT_DEVICE, [device.id, device.name, device.platform, device.appVersion, device.pairedAt, device.pairedWithCodeId]);
}

/** One credential row per device, created with it. `$2` is the SHA-256 of the credential. */
export const INSERT_DEVICE_CREDENTIAL = 'INSERT INTO public.device_credentials (device_id, current_hash) VALUES ($1, $2)';

export async function insertDeviceCredential(db: Queryable, deviceId: string, credentialHash: Buffer): Promise<void> {
  await db.query(INSERT_DEVICE_CREDENTIAL, [deviceId, credentialHash]);
}

/** A device as the resolver reads it. */
export interface FoundDevice {
  readonly deviceId: string;
  readonly state: PairedDeviceState;
  readonly lastSeenAt: number;
  /** True when the presented value is the not-yet-promoted credential of a rotation. */
  readonly pending: boolean;
}

interface FoundDeviceRow extends QueryResultRow {
  device_id: string;
  state: PairedDeviceState;
  last_seen_at: string;
  pending: boolean;
}

const found = (row: FoundDeviceRow): FoundDevice => ({
  deviceId: row.device_id,
  state: row.state,
  lastSeenAt: time(row.last_seen_at),
  pending: row.pending,
});

/**
 * Database contract §5.2 "Device credential": by the hash of the presented value, as the current
 * or as the next credential of a rotation. The row stays after REVOKED and UNPAIRED, so a
 * retired credential is still recognised. Neither hash is selected: only whether `$1` is the
 * pending one.
 */
export const FIND_DEVICE_BY_CREDENTIAL =
  'SELECT c.device_id, d.state, d.last_seen_at, (c.next_hash IS NOT NULL AND c.next_hash = $1) AS pending ' +
  'FROM public.device_credentials c JOIN public.paired_devices d ON d.id = c.device_id ' +
  'WHERE c.current_hash = $1 OR c.next_hash = $1';

/** Null when no device, or more than one, has this credential hash: only one row is an answer. */
export async function findDeviceByCredential(db: Queryable, credentialHash: Buffer): Promise<FoundDevice | null> {
  const { rows } = await db.query<FoundDeviceRow>(FIND_DEVICE_BY_CREDENTIAL, [credentialHash]);
  return rows.length === 1 && rows[0] !== undefined ? found(rows[0]) : null;
}

/**
 * One device by its registry ID, for a session that is bound to it. A device is a device of the
 * registry only with its credential row (one per device, created with it): a row without one
 * cannot have been paired through this module and resolves to nothing.
 */
export const FIND_DEVICE =
  'SELECT d.id AS device_id, d.state, d.last_seen_at, false AS pending ' +
  'FROM public.paired_devices d JOIN public.device_credentials c ON c.device_id = d.id WHERE d.id = $1';

export async function findDevice(db: Queryable, deviceId: string): Promise<FoundDevice | null> {
  const row = first((await db.query<FoundDeviceRow>(FIND_DEVICE, [deviceId])).rows);
  return row === null ? null : found(row);
}

/**
 * T7, second phase (database contract §5.2): the next credential is promoted at its first use;
 * from then on the old one is unknown. No row: another request promoted it first, and the value
 * is looked up again.
 */
export const PROMOTE_CREDENTIAL =
  'UPDATE public.device_credentials SET current_hash = next_hash, next_hash = NULL WHERE device_id = $2 AND next_hash = $1 RETURNING device_id';

export async function promoteCredential(db: Queryable, credentialHash: Buffer, deviceId: string): Promise<boolean> {
  return (await db.query(PROMOTE_CREDENTIAL, [credentialHash, deviceId])).rows.length === 1;
}

/**
 * T7, first phase: the hash of the new credential is stored as "next", only while the device is
 * PAIRED. The current credential is not touched, so an answer that is lost leaves it valid. No
 * row: the device is not PAIRED any more.
 */
export const SET_NEXT_CREDENTIAL =
  'UPDATE public.device_credentials c SET next_hash = $2, rotated_at = $3 FROM public.paired_devices d ' +
  "WHERE c.device_id = $1 AND d.id = c.device_id AND d.state = 'PAIRED' RETURNING c.device_id";

export async function setNextCredential(db: Queryable, deviceId: string, credentialHash: Buffer, now: number): Promise<boolean> {
  return (await db.query(SET_NEXT_CREDENTIAL, [deviceId, credentialHash, now])).rows.length === 1;
}

/**
 * Spec §6.5 `lastSeenAt`: written only on a PAIRED device whose last entry is `$3` (now minus one
 * minute) or older, so at most once a minute, and never backwards.
 */
export const MARK_DEVICE_SEEN =
  "UPDATE public.paired_devices SET last_seen_at = $2 WHERE id = $1 AND state = 'PAIRED' AND last_seen_at <= $3 RETURNING id";

export async function markDeviceSeen(db: Queryable, deviceId: string, now: number, notAfter: number): Promise<boolean> {
  return (await db.query(MARK_DEVICE_SEEN, [deviceId, now, notAfter])).rows.length === 1;
}

/** T8 (AT-3): PAIRED to REVOKED. No row: not PAIRED any more, or no such device. */
export const REVOKE_DEVICE =
  "UPDATE public.paired_devices SET state = 'REVOKED', revoked_at = $2, revoked_by_operator_id = $3, revoke_reason = $4, updated_at = $2 " +
  "WHERE id = $1 AND state = 'PAIRED' RETURNING id";

export async function revokeDevice(db: Queryable, deviceId: string, now: number, operatorId: string, reason: string): Promise<boolean> {
  return (await db.query(REVOKE_DEVICE, [deviceId, now, operatorId, reason])).rows.length === 1;
}

/** T9 (AT-3): PAIRED to UNPAIRED. No row: not PAIRED any more. */
export const UNPAIR_DEVICE =
  "UPDATE public.paired_devices SET state = 'UNPAIRED', unpaired_at = $2, updated_at = $2 WHERE id = $1 AND state = 'PAIRED' RETURNING id";

export async function unpairDevice(db: Queryable, deviceId: string, now: number): Promise<boolean> {
  return (await db.query(UNPAIR_DEVICE, [deviceId, now])).rows.length === 1;
}

/** The state of one device; null when no device has this ID. For the 404 or 409 of a revoke, and for another module's unit. */
export const READ_DEVICE_STATE = 'SELECT state FROM public.paired_devices WHERE id = $1';

export async function readDeviceState(db: Queryable, deviceId: string): Promise<PairedDeviceState | null> {
  return first((await db.query<{ state: PairedDeviceState }>(READ_DEVICE_STATE, [deviceId])).rows)?.state ?? null;
}

// SR-34: the biometric tokens of a device that can still be used (not used, not revoked) are
// revoked in the unit that retires the device. This store holds no statement for it: the one
// function that revokes a token is `revokeBiometricTokens` of `modules/identity/biometric`
// (scope `DEVICE`; decision D105), which `devices.ts` calls in the unit of a revoke and of an
// unpair.

// ── The registry as the portal reads it ────────────────────────────────────────────────────────

/** A device of the registry without what the connection registry adds (`online`). No credential, no hash. */
export interface RegistryDevice {
  readonly id: string;
  readonly name: string;
  readonly platform: string;
  readonly appVersion: string;
  readonly state: PairedDeviceState;
  readonly pairedAt: number;
  readonly pairedWithCodeId: string;
  readonly codeIssuedBy: string;
  readonly lastSeenAt: number;
  /** The operator of the device's newest open session that is inside its limits, or null. */
  readonly signedInOperatorId: string | null;
  readonly credentialRotatedAt: number | null;
  readonly revokedAt: number | null;
  readonly revokedBy: string | null;
  readonly revokeReason: string | null;
  readonly unpairedAt: number | null;
}

interface RegistryRow extends QueryResultRow {
  id: string;
  name: string;
  platform: string;
  app_version: string;
  state: PairedDeviceState;
  paired_at: string;
  paired_with_code_id: string;
  code_issued_by: string;
  last_seen_at: string;
  signed_in_operator_id: string | null;
  rotated_at: string | null;
  revoked_at: string | null;
  revoked_by_operator_id: string | null;
  revoke_reason: string | null;
  unpaired_at: string | null;
}

const registryDevice = (row: RegistryRow): RegistryDevice => ({
  id: row.id,
  name: row.name,
  platform: row.platform,
  appVersion: row.app_version,
  state: row.state,
  pairedAt: time(row.paired_at),
  pairedWithCodeId: row.paired_with_code_id,
  codeIssuedBy: row.code_issued_by,
  lastSeenAt: time(row.last_seen_at),
  signedInOperatorId: row.signed_in_operator_id,
  credentialRotatedAt: optionalTime(row.rotated_at),
  revokedAt: optionalTime(row.revoked_at),
  revokedBy: row.revoked_by_operator_id,
  revokeReason: row.revoke_reason,
  unpairedAt: optionalTime(row.unpaired_at),
});

/**
 * Spec §6.5. `codeIssuedBy` comes from the code the device was paired with, `credentialRotatedAt`
 * from the credential row (its one public column), `signedInOperatorId` from the newest session
 * of a PAIRED device that is open and inside both limits at `$1` (`$2` is `$1` minus the idle
 * limit). Several open sessions per device are possible; the registry shows the newest (D14).
 */
const REGISTRY =
  'SELECT d.id, d.name, d.platform, d.app_version, d.state, d.paired_at, d.paired_with_code_id, p.issued_by_operator_id AS code_issued_by, ' +
  'd.last_seen_at, d.revoked_at, d.revoked_by_operator_id, d.revoke_reason, d.unpaired_at, c.rotated_at, ' +
  "CASE WHEN d.state = 'PAIRED' THEN (SELECT s.operator_id FROM public.auth_sessions s " +
  'WHERE s.device_id = d.id AND s.ended_at IS NULL AND s.absolute_expires_at > $1 AND s.last_seen_at > $2 ' +
  'ORDER BY s.issued_at DESC, s.id DESC LIMIT 1) END AS signed_in_operator_id ' +
  'FROM public.paired_devices d JOIN public.pairing_codes p ON p.id = d.paired_with_code_id ' +
  'LEFT JOIN public.device_credentials c ON c.device_id = d.id';

/** Operation 19: every device ever paired, newest first. The registry is listed whole (no paging). */
export const READ_REGISTRY = `${REGISTRY} ORDER BY d.paired_at DESC, length(d.id) DESC, d.id DESC`;
/** One device of the registry: the answer of a revoke. */
export const READ_REGISTRY_DEVICE = `${REGISTRY} WHERE d.id = $3`;

export async function readRegistry(db: Queryable, now: number, idleCutoff: number): Promise<RegistryDevice[]> {
  return (await db.query<RegistryRow>(READ_REGISTRY, [now, idleCutoff])).rows.map(registryDevice);
}

export async function readRegistryDevice(db: Queryable, now: number, idleCutoff: number, deviceId: string): Promise<RegistryDevice | null> {
  const row = first((await db.query<RegistryRow>(READ_REGISTRY_DEVICE, [now, idleCutoff, deviceId])).rows);
  return row === null ? null : registryDevice(row);
}

/** A device's own registration (operation 21). */
export interface Registration {
  readonly deviceId: string;
  readonly name: string;
  readonly state: PairedDeviceState;
  readonly pairedAt: number;
  readonly credentialRotatedAt: number | null;
}

export const READ_REGISTRATION =
  'SELECT d.id, d.name, d.state, d.paired_at, c.rotated_at FROM public.paired_devices d ' +
  'JOIN public.device_credentials c ON c.device_id = d.id WHERE d.id = $1';

export async function readRegistration(db: Queryable, deviceId: string): Promise<Registration | null> {
  const row = first(
    (await db.query<{ id: string; name: string; state: PairedDeviceState; paired_at: string; rotated_at: string | null }>(READ_REGISTRATION, [deviceId])).rows,
  );
  if (row === null) return null;
  return { deviceId: row.id, name: row.name, state: row.state, pairedAt: time(row.paired_at), credentialRotatedAt: optionalTime(row.rotated_at) };
}

// ── The Core a device is paired with ───────────────────────────────────────────────────────────

/** The members of the contract's `CoreIdentity`: what the app's `pairing` slice shows. */
export interface CoreIdentityRow {
  readonly deviceId: string;
  readonly name: string;
  readonly certificateFingerprint: string;
}

/** The one row of `core_device`. The fingerprint is an integrity value, not a secret. */
export const READ_CORE_IDENTITY = 'SELECT id, name, certificate_fingerprint FROM public.core_device';

export async function readCoreIdentity(db: Queryable): Promise<CoreIdentityRow | null> {
  const row = first((await db.query<{ id: string; name: string; certificate_fingerprint: string }>(READ_CORE_IDENTITY)).rows);
  return row === null ? null : { deviceId: row.id, name: row.name, certificateFingerprint: row.certificate_fingerprint };
}
