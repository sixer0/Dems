/**
 * The stored side of a temporary host address (task 4 row 106, WP-19b; schema set B, table
 * `host_network_aliases`, T-47; record `implementation/099_schema_set_b.md`).
 *
 * ONE OPEN ROW AT MOST. The table's own index refuses a second open row
 * (`host_network_aliases_one_open_key`); `open` below therefore answers null instead of a second
 * row, and the lifecycle reads that as "one alias at a time".
 *
 * A ROW IS OPENED BEFORE THE HELPER IS ASKED (the intent, S13-10 (c)) and closed when the address
 * is known to be gone. An open row therefore means "possibly in place", never "certainly in place".
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text. They run as the runtime role (migration 0018: SELECT, INSERT, UPDATE of `expires_at` and
 * the four removal columns; no DELETE). What an alias IS (interface, address, reason, who, when)
 * is never rewritten. This file imports nothing: the connection is HANDED IN.
 */

/** A connection that runs one parameterised statement: the pool for a read, a unit of work for a write. */
export interface HostAliasQueryable {
  query(text: string, values?: unknown[]): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly rowCount: number | null }>;
}

/** Why an alias was added: the closed set of the table (`HOST_ALIAS_REASON`). */
export const HostAliasReason = { FACTORY_SCAN: 'FACTORY_SCAN', SET_CAMERA_ADDRESS: 'SET_CAMERA_ADDRESS' } as const;
export type HostAliasReason = (typeof HostAliasReason)[keyof typeof HostAliasReason];

/** How an alias left: the closed set of the table (`HOST_ALIAS_REMOVE_REASON`). */
export const HostAliasRemoveReason = { EXPIRED: 'EXPIRED', MANUAL: 'MANUAL', JOB_DONE: 'JOB_DONE', BOOT_SWEEP: 'BOOT_SWEEP', SHUTDOWN: 'SHUTDOWN', NOT_ADDED: 'NOT_ADDED', ADD_UNCONFIRMED: 'ADD_UNCONFIRMED' } as const;
export type HostAliasRemoveReason = (typeof HostAliasRemoveReason)[keyof typeof HostAliasRemoveReason];

/** An open row, as stored. `address` is the table's form, `a.b.c.d/24`. */
export interface StoredHostAlias {
  readonly id: string;
  readonly address: string;
  readonly reason: HostAliasReason;
  readonly addedAt: number;
  readonly addedBy: string;
  readonly expiresAt: number;
  readonly removeError: string | null;
}

/** A stored row that cannot be read as the table defines it. The text names the column, never a value. */
export class HostAliasRowError extends Error {
  readonly code = 'HOST_ALIAS_ROW_INVALID';
  constructor(column: string) {
    // "alias address", not the other word: `test/static/search-path.test.ts` keeps that word out of every string.
    super(`a stored alias address cannot be read: ${column}`);
    this.name = 'HostAliasRowError';
  }
}

const COLUMNS = 'id AS "id", address AS "address", reason AS "reason", added_at AS "addedAt", added_by AS "addedBy", expires_at AS "expiresAt", remove_error AS "removeError"';

/** Every open row: none or one, by the table's index. Oldest first. */
export const READ_OPEN_HOST_ALIASES = `SELECT ${COLUMNS} FROM public.host_network_aliases WHERE removed_at IS NULL ORDER BY added_at, id`;

/**
 * Opens a row: `$1` interface, `$2` address (`a.b.c.d/24`), `$3` reason, `$4` the instant, `$5` the
 * operator, `$6` when it ends. A row that is open already is left as it is and NOTHING is
 * returned: the caller reads no row as "another alias is open".
 */
export const OPEN_HOST_ALIAS =
  'INSERT INTO public.host_network_aliases (interface_name, address, reason, added_at, added_by, expires_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING id AS "id"';

/** The end of the lifetime as the helper's answer dates it: `$1` the row, `$2` the instant. Open rows only. */
export const SET_HOST_ALIAS_EXPIRY = 'UPDATE public.host_network_aliases SET expires_at = $2 WHERE id = $1 AND removed_at IS NULL AND $2 > added_at';

/** Closes a row: `$1` the row, `$2` the instant, `$3` the reason, `$4` the operator or NULL (the system). The code of an earlier failed removal is cleared. */
export const CLOSE_HOST_ALIAS =
  'UPDATE public.host_network_aliases SET removed_at = GREATEST($2::bigint, added_at), remove_reason = $3, removed_by = $4, remove_error = NULL WHERE id = $1 AND removed_at IS NULL';

/** A removal that failed: `$1` the row, `$2` the CODE. The row stays open: the address may be in place. */
export const NOTE_HOST_ALIAS_REMOVE_ERROR = 'UPDATE public.host_network_aliases SET remove_error = $2 WHERE id = $1 AND removed_at IS NULL';

/** The statements of this file that write, for the tests of the folder. */
export const HOST_ALIAS_WRITES: readonly string[] = Object.freeze([OPEN_HOST_ALIAS, SET_HOST_ALIAS_EXPIRY, CLOSE_HOST_ALIAS, NOTE_HOST_ALIAS_REMOVE_ERROR]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STORED_ADDRESS = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/24$/;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/** A whole number the driver answered as a number or, for a wide column, as digits. */
function whole(value: unknown, column: string): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(number) || number < 0) throw new HostAliasRowError(column);
  return number;
}
function text(value: unknown, column: string, form?: RegExp): string {
  if (typeof value !== 'string' || (form !== undefined && !form.test(value))) throw new HostAliasRowError(column);
  return value;
}

function storedOf(row: Record<string, unknown>): StoredHostAlias {
  const reason = text(row['reason'], 'reason');
  if (reason !== HostAliasReason.FACTORY_SCAN && reason !== HostAliasReason.SET_CAMERA_ADDRESS) throw new HostAliasRowError('reason');
  return Object.freeze({
    id: text(row['id'], 'id', UUID),
    address: text(row['address'], 'address', STORED_ADDRESS),
    reason,
    addedAt: whole(row['addedAt'], 'added_at'),
    addedBy: text(row['addedBy'], 'added_by'),
    expiresAt: whole(row['expiresAt'], 'expires_at'),
    removeError: row['removeError'] === null ? null : text(row['removeError'], 'remove_error', CODE),
  });
}

export interface HostAliasOpening {
  readonly interfaceName: string;
  /** `a.b.c.d/24`. */
  readonly address: string;
  readonly reason: HostAliasReason;
  readonly operatorId: string;
  readonly now: number;
  readonly expiresAt: number;
}

export interface HostAliasStore {
  /** Every open row. Throws `HostAliasRowError` for a row outside the table's own definition. */
  readOpen(db: HostAliasQueryable): Promise<readonly StoredHostAlias[]>;
  /** Opens the row and answers its id; null when another row is open: nothing was written. */
  open(db: HostAliasQueryable, opening: HostAliasOpening): Promise<string | null>;
  /** False when no open row has this id. */
  setExpiry(db: HostAliasQueryable, id: string, expiresAt: number): Promise<boolean>;
  close(db: HostAliasQueryable, id: string, now: number, removeReason: HostAliasRemoveReason, removedBy: string | null): Promise<boolean>;
  noteRemoveError(db: HostAliasQueryable, id: string, code: string): Promise<boolean>;
}

export function createHostAliasStore(): HostAliasStore {
  return Object.freeze({
    async readOpen(db: HostAliasQueryable) {
      const { rows } = await db.query(READ_OPEN_HOST_ALIASES);
      return Object.freeze(rows.map(storedOf));
    },
    async open(db: HostAliasQueryable, opening: HostAliasOpening) {
      const { rows } = await db.query(OPEN_HOST_ALIAS, [opening.interfaceName, opening.address, opening.reason, opening.now, opening.operatorId, opening.expiresAt]);
      return rows[0] === undefined ? null : text(rows[0]['id'], 'id', UUID);
    },
    async setExpiry(db: HostAliasQueryable, id: string, expiresAt: number) {
      return (await db.query(SET_HOST_ALIAS_EXPIRY, [id, expiresAt])).rowCount === 1;
    },
    async close(db: HostAliasQueryable, id: string, now: number, removeReason: HostAliasRemoveReason, removedBy: string | null) {
      return (await db.query(CLOSE_HOST_ALIAS, [id, now, removeReason, removedBy])).rowCount === 1;
    },
    async noteRemoveError(db: HostAliasQueryable, id: string, code: string) {
      return (await db.query(NOTE_HOST_ALIAS_REMOVE_ERROR, [id, CODE.test(code) ? code : 'UNNAMED_FAILURE'])).rowCount === 1;
    },
  });
}
