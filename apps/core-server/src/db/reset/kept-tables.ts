/**
 * The eight kept tables and how their rows cross a reset (plan row W29; database contract §8.5
 * "Kept tables", R-3, R-5c, R-5d, R-5e, R-6; spec §12.4; SA-08).
 *
 * Pure: this file builds statement text from the typed schema and compares row images. It opens
 * nothing and sends nothing.
 *
 * HOW A ROW IS CARRIED, UNCHANGED. The old and the new database are two databases of one server,
 * and no extension links them, so a kept row travels through the routine's process. It travels
 * as TEXT that only PostgreSQL reads and writes:
 *
 *   read    `SELECT to_jsonb(k)::text` in the old database: the row image, one text per row;
 *   write   `jsonb_populate_recordset(NULL::public.<table>, $1::jsonb)` in the new database,
 *           with `$1` the images joined into one JSON array.
 *
 * The routine never parses an image and never turns a value into a JavaScript number, so a
 * `bigint` keeps every digit, a `bytea` keeps every byte (its image is the hex form), and a
 * `uuid`, a `text` or a `boolean` is what it was. R-6 then reads the images back from the new
 * database and compares them with the ones it carried, text for text, before anything is
 * swapped. The images are bind parameters; they are never part of statement text and never
 * part of a message (they hold token and credential hashes, NL-1).
 *
 * THE ONLY STATEMENTS THAT CHANGE A CARRIED VALUE are the two of R-5d, both decided by D14:
 * an ACTIVE pairing code is closed as `CANCELLED`, and `operators.last_sign_in_at` (a seeded
 * table) is set from the carried sessions.
 *
 * Nothing here updates, deletes from or truncates `audit_log` or `audit_chain_history`: the
 * lineage rows are INSERTED into a database that does not hold them yet, and the old chain goes
 * with its database (§6.6).
 */
import { getTableColumns, getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../schema';

/**
 * `update`: the seed has already written the table's rows (the two registry counters, the one
 * settings row); the carried values replace the seeded ones. `insert`: the seed leaves the table
 * empty; the carried rows are inserted with their primary keys.
 */
export type CarryMode = 'update' | 'insert';

export interface KeptTable {
  /** SQL name, in schema `public`. */
  readonly name: string;
  readonly mode: CarryMode;
  /** The primary key column (SQL name): the order of the images and the join of an update. */
  readonly key: string;
  /** Every column, in table order (SQL names), from the typed schema. */
  readonly columns: readonly string[];
}

function kept(table: PgTable, mode: CarryMode, key: string): KeptTable {
  const columns = Object.values(getTableColumns(table)).map((column) => column.name);
  if (!columns.includes(key)) throw new Error(`kept table ${getTableName(table)}: ${key} is not a column.`);
  return Object.freeze({ name: getTableName(table), mode, key, columns: Object.freeze(columns) });
}

/**
 * The eight kept tables, in the carry-over order of R-5c: parents before the rows that name
 * them (a device names its pairing code; a session and a token name a device).
 */
export const KEPT_TABLES: readonly KeptTable[] = Object.freeze([
  kept(schema.registryCounters, 'update', 'name'),
  kept(schema.consoleSettings, 'update', 'singleton'),
  kept(schema.pairingCodes, 'insert', 'id'),
  kept(schema.pairedDevices, 'insert', 'id'),
  kept(schema.deviceCredentials, 'insert', 'device_id'),
  kept(schema.authSessions, 'insert', 'id'),
  kept(schema.biometricTokens, 'insert', 'id'),
  kept(schema.auditChainHistory, 'insert', 'reset_no'),
]);

export const KEPT_TABLE_NAMES: readonly string[] = Object.freeze(KEPT_TABLES.map((table) => table.name));
export const PAIRING_CODES = 'pairing_codes';
export const LINEAGE = 'audit_chain_history';

/** Rows per carried statement: one JSON array parameter each. */
export const CARRY_CHUNK_ROWS = 500;

const quoted = (identifier: string): string => `"${identifier}"`;

// ── Statements (text built from the typed schema only) ─────────────────────────────────────────

/** R-3 and R-6: one row image per row, in primary-key order. */
export function readImagesStatement(table: KeptTable): string {
  return `SELECT to_jsonb(k)::text AS image FROM public.${table.name} AS k ORDER BY k.${quoted(table.key)}`;
}

/** The three columns the reset may rewrite on a pairing code (R-5d). */
const CODE_CLOSE_COLUMNS = ['state', 'closed_at', 'closed_by_operator_id'] as const;

/**
 * R-3 and R-6 for `pairing_codes`: the image, the state, and the image without the three columns
 * that R-5d rewrites on a code that was ACTIVE.
 */
export const READ_PAIRING_CODES_STATEMENT =
  'SELECT k.id::text AS id, k.state::text AS state, to_jsonb(k)::text AS image, ' +
  `(to_jsonb(k)${CODE_CLOSE_COLUMNS.map((column) => ` - '${column}'`).join('')})::text AS rest, ` +
  'k.closed_at::text AS closed_at, k.closed_by_operator_id::text AS closed_by ' +
  'FROM public.pairing_codes AS k ORDER BY k."id"';

/** R-5c, `insert` tables: the carried rows with every column, in primary-key order. `$1` is a JSON array of images. */
export function insertCarriedStatement(table: KeptTable): string {
  const columns = table.columns.map(quoted).join(', ');
  const values = table.columns.map((column) => `c.${quoted(column)}`).join(', ');
  return (
    `INSERT INTO public.${table.name} (${columns}) SELECT ${values} ` +
    `FROM jsonb_populate_recordset(NULL::public.${table.name}, $1::jsonb) AS c ORDER BY c.${quoted(table.key)}`
  );
}

/** R-5c, `update` tables: every column but the key takes the carried value. `$1` is a JSON array of images. */
export function updateCarriedStatement(table: KeptTable): string {
  const assignments = table.columns
    .filter((column) => column !== table.key)
    .map((column) => `${quoted(column)} = c.${quoted(column)}`)
    .join(', ');
  return (
    `UPDATE public.${table.name} AS n SET ${assignments} ` +
    `FROM jsonb_populate_recordset(NULL::public.${table.name}, $1::jsonb) AS c WHERE n.${quoted(table.key)} = c.${quoted(table.key)}`
  );
}

/** The statement of R-5c for a table. */
export function carryStatement(table: KeptTable): string {
  return table.mode === 'insert' ? insertCarriedStatement(table) : updateCarriedStatement(table);
}

/**
 * R-5d (SPEC-GAP-3, decided by D14; GS-25): a code that was ACTIVE is closed by the reset.
 * `$1` is the reset's `now`, `$2` the resetting operator or NULL from the command line. No audit
 * row is written for it: the new chain's SCENARIO_LOADED row and the lineage row are the record.
 */
export const CANCEL_ACTIVE_CODES_STATEMENT =
  "UPDATE public.pairing_codes SET state = 'CANCELLED', closed_at = $1::bigint, closed_by_operator_id = $2::text WHERE state = 'ACTIVE'";

/** R-5d (SPEC-GAP-6, decided by D14): the newest issue time of the operator's carried sessions. */
export const LAST_SIGN_IN_STATEMENT =
  'UPDATE public.operators AS o SET last_sign_in_at = s.newest ' +
  'FROM (SELECT operator_id, max(issued_at) AS newest FROM public.auth_sessions GROUP BY operator_id) AS s ' +
  'WHERE o.id = s.operator_id';

/** R-5e (LN-1, LN-2): the lineage row of the chain being discarded, with bind parameters. */
export const LINEAGE_INSERT_STATEMENT =
  'INSERT INTO public.audit_chain_history ' +
  '(reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason, scenario) ' +
  'VALUES ($1::bigint, $2::bigint, $3::text, $4::bigint, $5::bigint, $6::bigint, $7::bigint, $8::text, $9::text, $10::text)';

/**
 * R-6: the newest lineage row, every column as text. The order names the COLUMN (`h.reset_no`):
 * a bare `reset_no` would be the text of the select list, and '9' sorts after '10'.
 */
export const NEWEST_LINEAGE_STATEMENT =
  'SELECT h.reset_no::text AS reset_no, h.epoch::text AS epoch, h.head_hash, h.row_count::text AS row_count, ' +
  'h.first_seq::text AS first_seq, h.last_seq::text AS last_seq, h.reset_at::text AS reset_at, h.actor_id, h.reason, h.scenario ' +
  'FROM public.audit_chain_history AS h ORDER BY h.reset_no DESC LIMIT 1';

// ── Images ─────────────────────────────────────────────────────────────────────────────────────

/** Row images joined into one JSON array: the `$1` of a carried statement. No image is parsed. */
export function imagesAsJsonArray(images: readonly string[]): string {
  return `[${images.join(',')}]`;
}

/** The images in chunks of at most `size` rows. */
export function chunked<T>(items: readonly T[], size: number = CARRY_CHUNK_ROWS): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

export interface PairingCodeImage {
  readonly id: string;
  readonly state: string;
  readonly image: string;
  /** The image without `state`, `closed_at` and `closed_by_operator_id`. */
  readonly rest: string;
  readonly closedAt: string | null;
  readonly closedBy: string | null;
}

/** What the routine read from one database: the images of the eight kept tables. */
export interface KeptImages {
  /** By SQL table name; each list is in primary-key order. */
  readonly images: Readonly<Record<string, readonly string[]>>;
  readonly pairingCodes: readonly PairingCodeImage[];
}

export interface CarryExpectation {
  /** The reset's `now`, as decimal text. */
  readonly now: string;
  /** The resetting operator; null from the command line. */
  readonly actorId: string | null;
  /** True when R-5e appended a lineage row. */
  readonly lineageAppended: boolean;
}

/**
 * R-6, "carried over unchanged": compares what R-3 read from the old database with what the new
 * database holds after the build. Returns one sentence per difference; an empty list means that
 * every kept row is, text for text, the row that was read.
 *
 * A sentence names a table and a position, never a value.
 *
 *   insert tables   same number of rows, and each image equal;
 *   update tables   the same, when the old database held rows of the table; a database that was
 *                   never seeded has none, and the seed's rows then stay;
 *   pairing codes   a code that was ACTIVE is CANCELLED, closed at `now` by the actor, and equal
 *                   in every other column; every other code is equal as a whole;
 *   lineage         the carried rows equal and first, then exactly one more when a chain was
 *                   discarded.
 */
export function compareCarried(carried: KeptImages, built: KeptImages, expectation: CarryExpectation): string[] {
  const problems: string[] = [];

  for (const table of KEPT_TABLES) {
    const before = carried.images[table.name] ?? [];
    const after = built.images[table.name] ?? [];

    if (table.name === PAIRING_CODES) {
      const codesBefore = carried.pairingCodes;
      const codesAfter = built.pairingCodes;
      if (codesBefore.length !== codesAfter.length) {
        problems.push(`${table.name}: ${codesBefore.length} row(s) were read and ${codesAfter.length} are in the new database.`);
        continue;
      }
      codesBefore.forEach((old, index) => {
        const now = codesAfter[index];
        if (now === undefined || now.id !== old.id) {
          problems.push(`${table.name}: row ${index + 1} is not the row that was read.`);
        } else if (old.state === 'ACTIVE') {
          const closed =
            now.state === 'CANCELLED' && now.closedAt === expectation.now && now.closedBy === expectation.actorId && now.rest === old.rest;
          if (!closed) problems.push(`${table.name}: the code that was ACTIVE (row ${index + 1}) is not closed as CANCELLED by this reset.`);
        } else if (now.image !== old.image) {
          problems.push(`${table.name}: row ${index + 1} differs from the row that was read.`);
        }
      });
      continue;
    }

    if (table.mode === 'update' && before.length === 0) continue;

    const expected = table.name === LINEAGE && expectation.lineageAppended ? before.length + 1 : before.length;
    if (after.length !== expected) {
      problems.push(`${table.name}: ${before.length} row(s) were read, ${expected} are expected and ${after.length} are in the new database.`);
      continue;
    }
    before.forEach((image, index) => {
      if (after[index] !== image) problems.push(`${table.name}: row ${index + 1} differs from the row that was read.`);
    });
  }
  return problems;
}

/** How many rows of each kept table were read, by SQL name. */
export function keptCounts(read: KeptImages): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of KEPT_TABLES) {
    counts[table.name] = table.name === PAIRING_CODES ? read.pairingCodes.length : (read.images[table.name] ?? []).length;
  }
  return counts;
}
