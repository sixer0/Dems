/**
 * The stored side of the installation acceptance (task 4 blueprint row 117, package WP-26b; schema
 * set C, table `installation_acceptances`, T-48; record `implementation/114_schema_set_c.md`
 * section 3 "as built").
 *
 * TWO STATEMENTS, AND NO READ OF ITS OWN. An acceptance is INSERTED; the one in force is REVOKED
 * by ONE UPDATE of its three revoke columns. Nothing here asks "is one in force" first (the INSERT
 * carries one condition on the stored INSTANTS inside itself, row V6b - see its constant):
 *
 *   - THE DATABASE IS THE JUDGE OF "ONE IN FORCE". A second row whose `revoked_at` is NULL answers
 *     23505 by the partial unique index `installation_acceptances_in_force_key` - also for two
 *     requests at the same moment (exactly one commits). `isInForceViolation` names that answer;
 *   - a revocation names no row: `WHERE revoked_at IS NULL` is the one row in force, or none.
 *
 * Both statements are constant texts with bind parameters; no value is ever part of a statement
 * text. They run as the runtime role `dems_app` (migration 0025: SELECT, INSERT, UPDATE of the
 * three revoke columns only; no DELETE, no TRUNCATE) and ONLY on the unit of work of the
 * operation: the row and its one audit entry commit together or not at all.
 *
 * The id of a row is the database's (`gen_random_uuid()`): both statements answer the row they
 * wrote, so the audit entry names it inside the same unit.
 */
import type { QueryResultRow } from 'pg';

/** A connection that runs one parameterised statement: here always the unit of work of the operation. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

/** What the operation hands in for a new row. `steps` and `diagnostics` are the two documents, already held to the contract. */
export interface AcceptanceWrite {
  readonly acceptedAt: number;
  readonly acceptedBy: string;
  readonly softwareVersion: string;
  readonly coreDeviceId: string;
  readonly siteName: string;
  readonly room: string;
  readonly siteAddress: string | null;
  readonly steps: unknown;
  readonly diagnostics: unknown;
}

/** What a revocation writes: the three revoke columns, together. */
export interface RevocationWrite {
  readonly revokedAt: number;
  readonly revokedBy: string;
  readonly revokeReason: string;
}

/** A stored row, as the database answered it. The two documents are what `jsonb` holds. */
export interface StoredAcceptance extends AcceptanceWrite {
  readonly id: string;
  readonly revokedAt: number | null;
  readonly revokedBy: string | null;
  readonly revokeReason: string | null;
}

/** A stored row that cannot be read as the table defines it. The text names the column, never a value. */
export class InstallationAcceptanceRowError extends Error {
  readonly code = 'INSTALLATION_ACCEPTANCE_ROW_INVALID';
  constructor(column: string) {
    super(`the stored installation acceptance cannot be read: ${column}`);
    this.name = 'InstallationAcceptanceRowError';
  }
}

const COLUMNS =
  'id AS "id", accepted_at AS "acceptedAt", accepted_by AS "acceptedBy", software_version AS "softwareVersion", core_device_id AS "coreDeviceId", ' +
  'site_name AS "siteName", room AS "room", site_address AS "siteAddress", steps AS "steps", diagnostics AS "diagnostics", ' +
  'revoked_at AS "revokedAt", revoked_by AS "revokedBy", revoke_reason AS "revokeReason"';

/**
 * A new acceptance: `$1` the instant, `$2` the operator, `$3` the version, `$4` to `$6` the copy of
 * the Core's id, name and room, `$7` the site address or NULL, `$8` and `$9` the two documents as
 * JSON text. NO conflict clause: while a row is in force the database answers 23505.
 *
 * THE STATEMENT CARRIES ITS OWN CONDITION (row V6b; caution R119-08, decision C105 (5)): it writes
 * only when NO stored instant - an `accepted_at` or a `revoked_at` of any row - is later than `$1`.
 * A clock of the Core that reads earlier than the stored record therefore writes NOTHING and the
 * statement answers no row; a row was written exactly when one is answered. This is the ONE place
 * of the folder where the table is read, and it is no question followed by a write: the condition
 * and the write are one statement, its answer goes nowhere but into the row count of that write,
 * and it reads the two instants only - never whether a row is in force (`IS NULL` is not in it).
 * "One in force" stays the index's answer: two requests at the same moment both pass the condition
 * and the database lets one win. The static test of the folder holds these words as its one named
 * entry (`INSERT_CLOCK_FLOOR`).
 */
export const INSERT_CLOCK_FLOOR =
  'WHERE NOT EXISTS (SELECT 1 FROM public.installation_acceptances AS stored WHERE stored.accepted_at > $1::bigint OR stored.revoked_at > $1::bigint)';
export const INSERT_INSTALLATION_ACCEPTANCE =
  'INSERT INTO public.installation_acceptances (accepted_at, accepted_by, software_version, core_device_id, site_name, room, site_address, steps, diagnostics) ' +
  `SELECT $1::bigint, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::jsonb, $9::jsonb ${INSERT_CLOCK_FLOOR} RETURNING ${COLUMNS}`;

/** The revocation of the ONE row in force: `$1` the instant, `$2` the operator, `$3` the reason. No row in force: no row answered. */
export const REVOKE_INSTALLATION_ACCEPTANCE =
  `UPDATE public.installation_acceptances SET revoked_at = $1, revoked_by = $2, revoke_reason = $3 WHERE revoked_at IS NULL RETURNING ${COLUMNS}`;

/** The statements of this file, for the tests of the folder: both write, none only reads. */
export const INSTALLATION_ACCEPTANCE_WRITES: readonly string[] = Object.freeze([INSERT_INSTALLATION_ACCEPTANCE, REVOKE_INSTALLATION_ACCEPTANCE]);

/** The partial unique index that holds at most one row in force (schema set C). */
export const IN_FORCE_CONSTRAINT = 'installation_acceptances_in_force_key';
const UNIQUE_VIOLATION = '23505';

/** True for the database's answer "an acceptance is already in force": 23505 by the in-force index, and nothing else. */
export function isInForceViolation(error: unknown): boolean {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  return code === UNIQUE_VIOLATION && constraint === IN_FORCE_CONSTRAINT;
}

/** The CHECK that holds `revoked_at >= accepted_at` (schema set C). */
export const REVOKED_AT_CONSTRAINT = 'installation_acceptances_revoked_at_check';
const CHECK_VIOLATION = '23514';

/**
 * True for the database's answer "this revocation would stand BEFORE the acceptance it revokes":
 * 23514 by the revoked-at CHECK, and nothing else (row V6; caution R119-08). The server clock reads
 * earlier than the stored `accepted_at`: a named refusal of the operation, not a defect. Every
 * other CHECK of the table stays a defect.
 */
export function isClockBehindViolation(error: unknown): boolean {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  return code === CHECK_VIOLATION && constraint === REVOKED_AT_CONSTRAINT;
}

interface Row extends QueryResultRow {
  id: unknown;
  acceptedAt: unknown;
  acceptedBy: unknown;
  softwareVersion: unknown;
  coreDeviceId: unknown;
  siteName: unknown;
  room: unknown;
  siteAddress: unknown;
  steps: unknown;
  diagnostics: unknown;
  revokedAt: unknown;
  revokedBy: unknown;
  revokeReason: unknown;
}

/** A whole number the driver answered as a number or, for a wide column, as digits. */
function whole(value: unknown, column: string): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(number) || number < 0) throw new InstallationAcceptanceRowError(column);
  return number;
}
function text(value: unknown, column: string): string {
  if (typeof value !== 'string') throw new InstallationAcceptanceRowError(column);
  return value;
}
const textOrNull = (value: unknown, column: string): string | null => (value === null ? null : text(value, column));

function storedOf(row: Row): StoredAcceptance {
  if (!Array.isArray(row.steps)) throw new InstallationAcceptanceRowError('steps');
  if (typeof row.diagnostics !== 'object' || row.diagnostics === null || Array.isArray(row.diagnostics)) throw new InstallationAcceptanceRowError('diagnostics');
  return {
    id: text(row.id, 'id'),
    acceptedAt: whole(row.acceptedAt, 'accepted_at'),
    acceptedBy: text(row.acceptedBy, 'accepted_by'),
    softwareVersion: text(row.softwareVersion, 'software_version'),
    coreDeviceId: text(row.coreDeviceId, 'core_device_id'),
    siteName: text(row.siteName, 'site_name'),
    room: text(row.room, 'room'),
    siteAddress: textOrNull(row.siteAddress, 'site_address'),
    steps: row.steps,
    diagnostics: row.diagnostics,
    revokedAt: row.revokedAt === null ? null : whole(row.revokedAt, 'revoked_at'),
    revokedBy: textOrNull(row.revokedBy, 'revoked_by'),
    revokeReason: textOrNull(row.revokeReason, 'revoke_reason'),
  };
}

export interface InstallationAcceptanceStore {
  /**
   * Writes the acceptance and answers the stored row. REJECTS with the database's own error while
   * a row is in force (`isInForceViolation`): the unit of work is then lost and must be left.
   * NULL when the statement's own condition wrote nothing: a stored instant is LATER than
   * `write.acceptedAt` - the clock of the Core is behind the record (row V6b, R119-08).
   */
  insert(db: Queryable, write: AcceptanceWrite): Promise<StoredAcceptance | null>;
  /** Revokes the one row in force and answers it; null when none is in force (nothing was written). */
  revoke(db: Queryable, write: RevocationWrite): Promise<StoredAcceptance | null>;
}

export function createInstallationAcceptanceStore(): InstallationAcceptanceStore {
  return {
    async insert(db, write) {
      const { rows } = await db.query<Row>(INSERT_INSTALLATION_ACCEPTANCE, [
        write.acceptedAt,
        write.acceptedBy,
        write.softwareVersion,
        write.coreDeviceId,
        write.siteName,
        write.room,
        write.siteAddress,
        JSON.stringify(write.steps),
        JSON.stringify(write.diagnostics),
      ]);
      // No row answered: the condition of the statement held nothing back but the write itself (the clock floor).
      return rows[0] === undefined ? null : storedOf(rows[0]);
    },
    async revoke(db, write) {
      const { rows } = await db.query<Row>(REVOKE_INSTALLATION_ACCEPTANCE, [write.revokedAt, write.revokedBy, write.revokeReason]);
      return rows[0] === undefined ? null : storedOf(rows[0]);
    },
  };
}
