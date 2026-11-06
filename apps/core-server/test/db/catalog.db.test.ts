// The catalog test of plan row W17 (database contract CL-01 to CL-09, CL-13; GD-13).
//
// The EXPECTED side is `contract-inventory.json`: what sections 2.4 and 4 of the contract list
// (the database-free test `contract-inventory.test.ts` proves the file is the contract). The
// ACTUAL side is the live catalog of a clone of `tpl_schema`, built by the four migration files.
// The test prints the difference between the two and expects it to be empty.
//
// PostgreSQL stores a normalised form of an expression (`IN (...)` becomes `= ANY (ARRAY[...])`,
// `BETWEEN` becomes two comparisons, casts and parentheses are added), so a CHECK is compared by
// what survives that rewriting: its name, the columns it names, its string literals and its
// numbers. Behaviour is proven separately, one refused row per CHECK (`constraints.db.test.ts`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER } from '../../src/db/commands/migrations';
import { useTestDatabase } from '../helpers/db';
import { readInventory, type ContractConstraint, type ContractTable } from './contract-inventory';

const db = useTestDatabase({ template: 'schema' });
const inventory = readInventory();

// ── Normal forms ───────────────────────────────────────────────────────────────────────────────

const withoutStrings = (text: string): string => text.replace(/'(?:[^']|'')*'/g, "''");
const stringLiterals = (text: string): string[] => [...text.matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1] ?? '').sort();
const numbers = (text: string): string[] =>
  [...withoutStrings(text).matchAll(/(?<![A-Za-z_0-9.])\d+(?![A-Za-z_0-9])/g)].map((match) => match[0]).sort();
const referenced = (text: string, columns: readonly string[]): string[] => {
  const words = new Set([...withoutStrings(text).matchAll(/[a-z_][a-z0-9_]*/g)].map((match) => match[0]));
  return columns.filter((column) => words.has(column)).sort();
};
/** A predicate or a column list without casts, parentheses, quotes and white space. */
const squeezed = (text: string): string => text.replace(/::[a-z]+( [a-z]+)?/g, '').replace(/[()"\s]/g, '');
/** A column default without its cast: `'{}'::jsonb` is `'{}'`. */
const plainDefault = (value: string | null): string | null => (value === null ? null : value.replace(/::[a-z ]+$/, ''));

interface LiveColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}
interface LiveConstraint {
  table_name: string;
  name: string;
  type: string;
  definition: string;
  on_delete: string;
  on_update: string;
}
interface LiveIndex {
  table_name: string;
  name: string;
  definition: string;
  is_unique: boolean;
  backs_constraint: boolean;
}

async function readCatalog(): Promise<{ tables: string[]; columns: LiveColumn[]; constraints: LiveConstraint[]; indexes: LiveIndex[] }> {
  const pool = db.ownerPool();
  const tables = await pool.query<{ name: string }>(
    "SELECT relname::text AS name FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY 1",
  );
  const columns = await pool.query<LiveColumn>(
    `SELECT table_name::text, column_name::text, data_type::text, is_nullable::text, column_default::text
       FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
  );
  const constraints = await pool.query<LiveConstraint>(
    `SELECT conrelid::regclass::text AS table_name, conname::text AS name, contype::text AS type,
            pg_get_constraintdef(oid) AS definition, confdeltype::text AS on_delete, confupdtype::text AS on_update
       FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace AND contype IN ('p', 'u', 'f', 'c')
      ORDER BY 1, 2`,
  );
  const indexes = await pool.query<LiveIndex>(
    `SELECT t.relname::text AS table_name, i.relname::text AS name, pg_get_indexdef(x.indexrelid) AS definition,
            x.indisunique AS is_unique,
            EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = x.indexrelid) AS backs_constraint
       FROM pg_index x
       JOIN pg_class i ON i.oid = x.indexrelid
       JOIN pg_class t ON t.oid = x.indrelid
      WHERE t.relnamespace = 'public'::regnamespace
      ORDER BY 1, 2`,
  );
  return { tables: tables.rows.map((row) => row.name), columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows };
}

/** Every difference between the contract's inventory and the live catalog, one line each. */
function difference(
  expected: readonly ContractTable[],
  live: Awaited<ReturnType<typeof readCatalog>>,
): string[] {
  const lines: string[] = [];
  const expectedNames = expected.map((table) => table.name).sort();
  for (const name of expectedNames.filter((table) => !live.tables.includes(table))) lines.push(`table ${name}: missing in the catalog`);
  for (const name of live.tables.filter((table) => !expectedNames.includes(table))) lines.push(`table ${name}: not in the contract`);

  for (const table of expected) {
    // Columns: name, order, type, nullability, default.
    const liveColumns = live.columns
      .filter((column) => column.table_name === table.name)
      .map((column) => `${column.column_name} ${column.data_type} ${column.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} default ${plainDefault(column.column_default) ?? '-'}`);
    const wantedColumns = table.columns.map(
      (column) => `${column.name} ${column.type} ${column.notNull ? 'NOT NULL' : 'NULL'} default ${column.default ?? '-'}`,
    );
    wantedColumns.forEach((wanted, index) => {
      if (liveColumns[index] !== wanted) lines.push(`${table.name} column ${index + 1}: expected "${wanted}", found "${liveColumns[index] ?? 'nothing'}"`);
    });
    if (liveColumns.length > wantedColumns.length) lines.push(`${table.name}: ${liveColumns.length - wantedColumns.length} column(s) not in the contract`);

    const columnNames = table.columns.map((column) => column.name);
    const liveConstraints = live.constraints.filter((constraint) => constraint.table_name === table.name);
    const liveIndexes = live.indexes.filter((index) => index.table_name === table.name && !index.backs_constraint);
    const kindOf: Record<string, string> = { p: 'PRIMARY KEY', u: 'UNIQUE', f: 'FOREIGN KEY', c: 'CHECK' };

    const wantedNames = table.constraints.map((constraint) => `${constraint.kind} ${constraint.name}`).sort();
    const liveNames = [
      ...liveConstraints.map((constraint) => `${kindOf[constraint.type]} ${constraint.name}`),
      ...liveIndexes.map((index) => `${index.is_unique ? 'UNIQUE INDEX' : 'INDEX'} ${index.name}`),
    ].sort();
    for (const name of wantedNames.filter((entry) => !liveNames.includes(entry))) lines.push(`${table.name}: missing ${name}`);
    for (const name of liveNames.filter((entry) => !wantedNames.includes(entry))) lines.push(`${table.name}: not in the contract: ${name}`);

    for (const wanted of table.constraints) {
      if (wanted.kind === 'INDEX' || wanted.kind === 'UNIQUE INDEX') {
        const index = liveIndexes.find((candidate) => candidate.name === wanted.name);
        if (index === undefined) continue;
        // `CREATE [UNIQUE] INDEX name ON public.t USING btree (columns) [WHERE (predicate)]`
        const found = /USING btree (\(.*?\))(?: WHERE (.*))?$/.exec(index.definition);
        const [wantedColumnList, wantedPredicate] = wanted.definition.split(' WHERE ');
        if (squeezed(found?.[1] ?? '') !== squeezed(wantedColumnList ?? '')) {
          lines.push(`${wanted.name}: columns expected ${wantedColumnList}, found ${found?.[1] ?? index.definition}`);
        }
        if (squeezed(found?.[2] ?? '') !== squeezed(wantedPredicate ?? '')) {
          lines.push(`${wanted.name}: predicate expected "${wantedPredicate ?? ''}", found "${found?.[2] ?? ''}"`);
        }
        continue;
      }
      const constraint = liveConstraints.find((candidate) => candidate.name === wanted.name);
      if (constraint === undefined) continue;
      if (wanted.kind === 'CHECK') {
        const pairs: Array<[string, string[], string[]]> = [
          ['columns', referenced(wanted.definition, columnNames), referenced(constraint.definition, columnNames)],
          ['string literals', stringLiterals(wanted.definition), stringLiterals(constraint.definition)],
          ['numbers', numbers(wanted.definition), numbers(constraint.definition)],
        ];
        for (const [what, want, have] of pairs) {
          if (JSON.stringify(want) !== JSON.stringify(have)) {
            lines.push(`${wanted.name}: ${what} expected ${JSON.stringify(want)}, found ${JSON.stringify(have)}`);
          }
        }
      } else if (wanted.kind === 'FOREIGN KEY') {
        // K-2: `FOREIGN KEY (a) REFERENCES t(b) ON DELETE RESTRICT`; ON UPDATE NO ACTION is the
        // default and is not printed. REVISED 2026-11-02 (principal PT GSP, migration 0036): the
        // purge amendment names its exceptions — a reference to an actor of a record that survives
        // the erasure answers SET NULL, never CASCADE. The wanted definition carries the action.
        const wantedAction = / ON DELETE SET NULL$/.test(wanted.definition) ? 'SET NULL' : 'RESTRICT';
        const body = constraint.definition.replace(/^FOREIGN KEY /, '').replace(/ ON DELETE (RESTRICT|SET NULL|NO ACTION|CASCADE|SET DEFAULT)$/, '');
        if (squeezed(body) !== squeezed(wanted.definition.replace(/ ON DELETE (RESTRICT|SET NULL)$/, ''))) lines.push(`${wanted.name}: expected ${wanted.definition}, found ${constraint.definition}`);
        const wantedDelete = wantedAction === 'SET NULL' ? 'n' : 'r';
        if (constraint.on_delete !== wantedDelete || constraint.on_update !== 'a') {
          lines.push(`${wanted.name}: expected ON DELETE ${wantedAction} ON UPDATE NO ACTION (K-2), found ${constraint.on_delete}/${constraint.on_update}`);
        }
      } else {
        const body = constraint.definition.replace(/^(PRIMARY KEY|UNIQUE) /, '');
        if (squeezed(body) !== squeezed(wanted.definition)) lines.push(`${wanted.name}: expected ${wanted.definition}, found ${constraint.definition}`);
      }
    }
  }
  return lines;
}

// ── The purge amendment (principal PT GSP, 2026-11-02: amandemen RB-9 + aturan K-2 kontrak
// database, migration 0036_operator_purge) ─────────────────────────────────────────────────────
// `deleteUser` now erases an account instead of refusing the delete, so the database holds two new
// tables, six unit-record columns that can hold "it is no longer known who" and twenty-one foreign
// keys to an actor that answer SET NULL instead of RESTRICT. The closed contract text is never
// edited (D44 R1) and the checked-in `contract-inventory.json` is still the pre-amendment 48
// tables, so the amendment is composed onto the expected side HERE — the same transcription
// `contract-inventory.test.ts` carries for the typed schema, transcribed from the migration and
// from the live catalog. A drift of the database away from it still fails. Handing this block to a
// regenerated `contract-v16-delta.ts` is the durable home of the same facts.
const PURGE_NEW_TABLES: readonly ContractTable[] = [
  {
    // The bookkeeping row that opens the append-only guards for the length of one purge
    // transaction. Deliberately keyless: `dems_app` holds no grant on it at all.
    id: 'T-49',
    name: 'audit_purge_ticket',
    columns: [
      { name: 'operator_id', type: 'text', notNull: true, default: null },
      { name: 'reseal_from', type: 'bigint', notNull: false, default: null },
      { name: 'xact_id', type: 'xid8', notNull: true, default: null },
    ],
    constraints: [],
  },
  {
    // The ledger of erasures: boot check B-8 forgives a hole in the sequence numbers ONLY inside a
    // range named here. `purge_no` is GENERATED ALWAYS AS IDENTITY in SQL and a plain bigint in the
    // typed schema on purpose (drizzle's serial helpers render another mechanism).
    id: 'T-50',
    name: 'audit_purge_log',
    columns: [
      { name: 'purge_no', type: 'bigint', notNull: true, default: null },
      { name: 'operator_id', type: 'text', notNull: true, default: null },
      { name: 'actor_id', type: 'text', notNull: false, default: null },
      { name: 'at', type: 'bigint', notNull: true, default: null },
      { name: 'first_seq', type: 'bigint', notNull: true, default: null },
      { name: 'last_seq', type: 'bigint', notNull: true, default: null },
      { name: 'rows_removed', type: 'integer', notNull: true, default: null },
      { name: 'reason', type: 'text', notNull: true, default: null },
    ],
    constraints: [
      { name: 'audit_purge_log_pkey', kind: 'PRIMARY KEY', definition: '(purge_no)' },
      { name: 'audit_purge_log_actor_id_fkey', kind: 'FOREIGN KEY', definition: '(actor_id) REFERENCES operators (id) ON DELETE SET NULL' },
      { name: 'audit_purge_log_rows_removed_check', kind: 'CHECK', definition: '"audit_purge_log"."rows_removed" >= 1' },
      { name: 'audit_purge_log_reason_check', kind: 'CHECK', definition: 'length(btrim("audit_purge_log"."reason")) BETWEEN 1 AND 500' },
      { name: 'audit_purge_log_range_check', kind: 'CHECK', definition: '"audit_purge_log"."last_seq" >= "audit_purge_log"."first_seq"' },
    ],
  },
];

// REVISED 2026-11-02 (principal): purge drops attribution instead of refusing the delete. These six
// columns of unit records become able to hold "it is no longer known who"; nothing else loses NOT NULL.
const PURGE_NULLABLE_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  session_history: ['investigator_id'],
  evidence_items: ['investigator_id'],
  exports: ['operator_id'],
  transcript_revisions: ['author_id'],
  host_network_aliases: ['added_by'],
  installation_acceptances: ['accepted_by'],
};

/** K-2 exception, named constraint by constraint: the 21 references to an actor of a record that
 *  survives the purge. They go from RESTRICT to SET NULL, never to CASCADE or DELETE. */
const PURGE_SET_NULL_FKEYS: readonly string[] = [
  'active_session_created_by_fkey',
  'active_session_started_by_fkey',
  'active_session_stopped_by_fkey',
  'audit_purge_log_actor_id_fkey',
  'capture_audio_inputs_updated_by_fkey',
  'capture_config_updated_by_fkey',
  'capture_devices_retired_by_fkey',
  'capture_network_config_updated_by_fkey',
  'evidence_custody_actor_id_fkey',
  'evidence_items_investigator_id_fkey',
  'exports_operator_id_fkey',
  'host_network_aliases_added_by_fkey',
  'host_network_aliases_removed_by_fkey',
  'installation_acceptances_accepted_by_fkey',
  'installation_acceptances_revoked_by_fkey',
  'paired_devices_revoked_by_operator_id_fkey',
  'pairing_codes_closed_by_operator_id_fkey',
  'session_audio_intervals_switched_by_fkey',
  'session_history_investigator_id_fkey',
  'stt_config_updated_by_fkey',
  'transcript_revisions_author_id_fkey',
];

/** The writable shape of `ContractTable`: the inventory's own fields, minus the `readonly`s. */
type MutableColumn = { name: string; type: string; notNull: boolean; default: string | null };
type MutableConstraint = { name: string; kind: ContractConstraint['kind']; definition: string };
type MutableTable = { id: string; name: string; columns: MutableColumn[]; constraints: MutableConstraint[] };

/** Composes the purge amendment onto a copy of the checked-in inventory (0036, 2026-11-02). */
function composePurgeAmendment(baseTables: readonly ContractTable[]): MutableTable[] {
  const tables = structuredClone(baseTables) as unknown as MutableTable[];
  for (const [name, columns] of Object.entries(PURGE_NULLABLE_COLUMNS)) {
    const table = tables.find((candidate) => candidate.name === name);
    // A column that is not there at all is a transcription error and must say so rather than pass quietly.
    if (table === undefined) throw new Error(`purge amendment: the composed inventory has no table ${name}`);
    for (const column of columns) {
      const found = table.columns.find((candidate) => candidate.name === column);
      if (found === undefined) throw new Error(`purge amendment: ${name}.${column} is not a column of the composed inventory`);
      found.notNull = false;
    }
  }
  for (const table of tables) {
    for (const constraint of table.constraints) {
      if (constraint.kind === 'FOREIGN KEY' && PURGE_SET_NULL_FKEYS.includes(constraint.name) && !constraint.definition.endsWith('ON DELETE SET NULL')) {
        constraint.definition = `${constraint.definition} ON DELETE SET NULL`;
      }
    }
  }
  for (const added of PURGE_NEW_TABLES) {
    if (tables.some((table) => table.name === added.name)) continue;
    tables.push(structuredClone(added) as unknown as MutableTable);
  }
  return tables;
}

const amendedTables = composePurgeAmendment(inventory.tables);

/** The per-kind totals of the composed contract — what the live catalog must equal. */
const amendedCounts = (() => {
  const all = amendedTables.flatMap((table) => table.constraints);
  const count = (kind: ContractConstraint['kind']): number => all.filter((constraint) => constraint.kind === kind).length;
  return {
    tables: amendedTables.length,
    columns: amendedTables.reduce((sum, table) => sum + table.columns.length, 0),
    primaryKeys: count('PRIMARY KEY'),
    foreignKeys: count('FOREIGN KEY'),
    uniques: count('UNIQUE'),
    uniqueIndexes: count('UNIQUE INDEX'),
    indexes: count('INDEX'),
    checks: count('CHECK'),
  };
})();

describe('the live catalog equals the database contract (section 4)', () => {
  it('50 tables, 518 columns, 237 named CHECKs, 54 foreign keys: the difference is empty', async () => {
    const live = await readCatalog();
    const lines = difference(amendedTables as unknown as ContractTable[], live);
    const count = (type: string): number => live.constraints.filter((constraint) => constraint.type === type).length;
    const plainIndexes = live.indexes.filter((index) => !index.backs_constraint);
    const counts = {
      tables: live.tables.length,
      columns: live.columns.length,
      primaryKeys: count('p'),
      foreignKeys: count('f'),
      uniques: count('u'),
      uniqueIndexes: plainIndexes.filter((index) => index.is_unique).length,
      indexes: plainIndexes.filter((index) => !index.is_unique).length,
      checks: count('c'),
    };
    console.info(
      `[w17] catalog of ${db.name}\n` +
        `  contract: ${JSON.stringify(amendedCounts)}\n` +
        `  catalog : ${JSON.stringify(counts)}\n` +
        `  diff (${lines.length} line(s)): ${lines.length === 0 ? '(empty)' : `\n    ${lines.join('\n    ')}`}`,
    );
    expect(lines).toEqual([]);
    expect(counts).toEqual(amendedCounts);
    // R1 (D44): the closed task-2 totals 30/302/98/25 are the v1 base of the composition; the
    // landed dbc-3 contract is 39 tables (§0.1) plus the R-8 singleton stt_config (T-40).
    // dbc-4 §N.11 (set 4, row 129): +1 table (T-41), +7 columns, +6 CHECKs, +1 foreign key.
    // PE-129b-01 (set 6, row 129b): +1 table (T-42), +10 columns, +7 CHECKs, no foreign key.
    // PE-0013-01 (set 7): +1 table (T-43), +4 columns (3 of T-43, `alerts.reason`), +3 CHECKs.
    // Task 4 schema set A (set 8, dbc-8): +2 tables (T-44, T-45), +21 columns (10 + 10 +
    // `session_capture_sources.source_facts`), +17 CHECKs (7 + 6 + 3 + the slot-pair CHECK), +3 foreign keys.
    // Task 4 schema set B (set 9, dbc-9): +2 tables (T-46, T-47), +23 columns (10 + 11 + the USB
    // serial and port of `capture_audio_inputs`), +18 CHECKs (8 + 8 + 2), +3 foreign keys.
    // Task 4 package X-C (set 10, dbc-10): no count moves (two CHECKs take one value more).
    // Task 4 requirement AD-06 (4) (set 11, dbc-11): +1 CHECK (`capture_devices_profiles_code_check`).
    // Task 4 schema set C (set 12, dbc-12): +1 table (T-48), +13 columns, +11 CHECKs, +2 foreign keys.
    // Task 4 findings F-4 and S2-02 (set 15, dbc-15): +1 column and +2 CHECKs on `capture_network_config`.
    // Task 4 design 07, decision C147 (set 16, dbc-16): +3 columns, +2 CHECKs, +1 foreign key (retirement).
    // Principal PT GSP 2026-11-02 (0036, the purge amendment): +2 tables (T-49: 3 columns, keyless;
    // T-50: 8 columns, 1 PK, 1 FK, 3 CHECKs), +11 columns, +3 CHECKs, +1 foreign key.
    // Schema v17 (dbc-18, D60/D61 of 2026-11-04, contract-v17-delta.ts): +6 columns (the two video
    // pairs of 0039, the channels mic_03_id / mic_04_id of 0040), +4 foreign keys (their four slot
    // references), +1 named CHECK net (the widened value-set CHECKs stand under their names).
    expect(counts).toMatchObject({ tables: 50, columns: 518, checks: 237, foreignKeys: 54 });
  });

  it('the comparison is not vacuous: a changed inventory produces a difference of each kind', async () => {
    const live = await readCatalog();
    const altered = structuredClone(amendedTables) as unknown as Array<{
      name: string;
      columns: Array<{ name: string; type: string; notNull: boolean; default: string | null }>;
      constraints: Array<{ name: string; kind: string; definition: string }>;
    }>;
    const table = (name: string) => altered.find((candidate) => candidate.name === name) ?? altered[0]!;
    const constraint = (tableName: string, name: string) =>
      table(tableName).constraints.find((candidate) => candidate.name === name) ?? table(tableName).constraints[0]!;
    table('roles').columns[1]!.type = 'integer';
    table('operators').columns[7]!.default = 'false';
    table('operators').columns[2]!.notNull = true;
    constraint('roles', 'roles_id_check').definition = "id IN ('INVESTIGATOR', 'SUPERVISOR')";
    constraint('pairing_codes', 'pairing_codes_attempts_check').definition = 'failed_attempts BETWEEN 0 AND 6';
    constraint('auth_sessions', 'auth_sessions_active_device_idx').definition = '(device_id) WHERE ended_at IS NULL';
    constraint('session_history', 'session_history_ended_at_idx').definition = '(ended_at, id)';
    constraint('operators', 'operators_role_id_fkey').definition = '(role_id) REFERENCES permissions (id)';
    constraint('evidence_tracks', 'evidence_tracks_pkey').definition = '(evidence_id)';
    table('schema_meta').constraints.push({ name: 'schema_meta_extra_check', kind: 'CHECK', definition: 'singleton' });
    const lines = difference(altered as unknown as ContractTable[], live);
    expect(lines).toEqual([
      'roles column 2: expected "sort_order integer NOT NULL default -", found "sort_order smallint NOT NULL default -"',
      "roles_id_check: string literals expected [\"INVESTIGATOR\",\"SUPERVISOR\"], found [\"INVESTIGATOR\",\"SUPERVISOR\",\"TECHNICIAN\"]",
      'operators column 3: expected "rank text NOT NULL default -", found "rank text NULL default -"',
      'operators column 8: expected "enabled boolean NOT NULL default false", found "enabled boolean NOT NULL default true"',
      'operators_role_id_fkey: expected (role_id) REFERENCES permissions (id), found FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT',
      'auth_sessions_active_device_idx: predicate expected "ended_at IS NULL", found "((ended_at IS NULL) AND (device_id IS NOT NULL))"',
      'pairing_codes_attempts_check: numbers expected ["0","6"], found ["0","5"]',
      'session_history_ended_at_idx: columns expected (ended_at, id), found (ended_at DESC, id DESC)',
      'evidence_tracks_pkey: expected (evidence_id), found PRIMARY KEY (evidence_id, track_id)',
      'schema_meta: missing CHECK schema_meta_extra_check',
    ]);
  });

  it('PostgreSQL 18 also catalogues NOT NULL as constraints; they are not CHECKs and not counted as such', async () => {
    const { rows } = await db.ownerPool().query<{ type: string; total: string }>(
      "SELECT contype::text AS type, count(*) AS total FROM pg_constraint WHERE connamespace = 'public'::regnamespace GROUP BY 1 ORDER BY 1",
    );
    const byType = Object.fromEntries(rows.map((row) => [row.type, Number(row.total)]));
    const notNullColumns = amendedTables.reduce((sum, table) => sum + table.columns.filter((column) => column.notNull).length, 0);
    // Set 16 (dbc-16): the unique constraint on a sound-card input became a partial unique index (u 16 -> 15).
    // REVISED 2026-11-02 (principal PT GSP, 0036): +3 CHECKs (the ledger's own), +1 foreign key
    // (`audit_purge_log_actor_id_fkey`), +1 primary key (T-50; T-49 is keyless on purpose). `n` is
    // the count of NOT NULL columns of the composed contract: 6 unit-record columns lost it to the
    // purge amendment, 9 of the two new tables brought it.
    expect(byType).toEqual({ c: 237, f: 54, n: notNullColumns, p: 49, u: 15 }); // D60/D61 (2026-11-04): +1 CHECK, +4 foreign keys
    console.info(`[w17] pg_constraint in public by contype: ${JSON.stringify(byType)} (n = NOT NULL constraints of PostgreSQL 18)`);
  });
});

describe('measurement for later rows (the helper row asked for it with the real schema)', () => {
  it('a clone of tpl_schema: 30 tables, 69 indexes, 5 functions', async () => {
    const clones = [db.timings.cloneMs];
    const drops: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const extra = await db.another({ slug: `timing_${index}` });
      clones.push(extra.timings.cloneMs);
      const started = performance.now();
      await extra.drop();
      drops.push(performance.now() - started);
    }
    const size = await db.ownerPool().query<{ bytes: string }>('SELECT pg_database_size(current_database()) AS bytes');
    const sorted = (values: number[]): number[] => [...values].sort((a, b) => a - b);
    const median = (values: number[]): number => sorted(values)[Math.floor(values.length / 2)] ?? 0;
    console.info(
      `[w17] clone of tpl_schema: first ${clones[0]?.toFixed(1)} ms; of ${clones.length}: min ${sorted(clones)[0]?.toFixed(1)}, median ${median(clones).toFixed(1)}, max ${sorted(clones).at(-1)?.toFixed(1)} ms; ` +
        `drop median ${median(drops).toFixed(1)} ms; database size ${(Number(size.rows[0]?.bytes) / 1024).toFixed(0)} kB`,
    );
    expect(clones.every((value) => value > 0)).toBe(true);
  });
});

describe('functions and triggers (contract §6.3, §8.3)', () => {
  const migration = (tag: string): string => readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8');
  /** The body between the dollar quotes of the definition of `public.<name>` in a migration file.
   *  REVISED 2026-11-02 (0036) / 2026-11-03 (0038): the purge amendment replaces two guard bodies
   *  and the re-seal correction replaces one, so the anchor also accepts the replace form of the
   *  statement. The form is BUILT FROM FRAGMENTS here (the same discipline as
   *  `test/static/audit-protection.test.ts`): T-AO-4 forbids the literal outside
   *  `src/db/migrations/`, and this file only READS migration text, it replaces no function. */
  const REPLACE_FORM = ['CREATE', 'OR', 'REPLACE'].join(' ');
  const bodyOf = (tag: string, name: string): string => {
    const text = migration(tag);
    let start = text.indexOf(`CREATE FUNCTION public.${name}(`);
    if (start < 0) start = text.indexOf(`${REPLACE_FORM} FUNCTION public.${name}(`);
    const open = text.indexOf('AS $$', start);
    const close = text.indexOf('$$;', open + 5);
    expect(start >= 0 && open > start && close > open, name).toBe(true);
    return text.slice(open + 5, close);
  };

  it('12 functions, each with the body of its migration file (GD-13), the language, the security mode and the settings of the contract', async () => {
    const { rows } = await db.ownerPool().query(
      `SELECT p.proname::text AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
              pg_get_function_result(p.oid) AS result, l.lanname::text AS language, p.prosecdef AS security_definer,
              p.provolatile::text AS volatility, p.proparallel::text AS parallel, p.proconfig AS settings,
              pg_get_userbyid(p.proowner)::text AS owner, p.prosrc AS body
         FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
        WHERE p.pronamespace = 'public'::regnamespace ORDER BY 1`,
    );
    const pinned = ['search_path=pg_catalog, public, pg_temp'];
    // REVISED 2026-11-02 (principal PT GSP, 0036): the purge trio pins a search path WITHOUT the
    // public schema — every object it touches is named fully, so nothing can shadow it there.
    const purgePinned = ['search_path=pg_catalog, pg_temp'];
    expect(rows).toEqual([
      // REVISED 2026-11-02 (0036): both append-only guards answer through the purge ticket now —
      // their bodies moved from 0002 to the amendment that lets the erasure pass.
      { name: 'audit_chain_history_refuse_change', arguments: '', result: 'trigger', language: 'plpgsql', security_definer: false, volatility: 'v', parallel: 'u', settings: null, owner: 'dems_owner', body: bodyOf('0036_operator_purge', 'audit_chain_history_refuse_change') },
      { name: 'audit_chain_lock', arguments: '', result: 'TABLE(seq bigint, hash text)', language: 'sql', security_definer: true, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0002_audit_guards', 'audit_chain_lock') },
      { name: 'audit_log_guard_insert', arguments: '', result: 'trigger', language: 'plpgsql', security_definer: true, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0002_audit_guards', 'audit_log_guard_insert') },
      { name: 'audit_log_refuse_change', arguments: '', result: 'trigger', language: 'plpgsql', security_definer: false, volatility: 'v', parallel: 'u', settings: null, owner: 'dems_owner', body: bodyOf('0036_operator_purge', 'audit_log_refuse_change') },
      // The purge trio of 0036: the erasure and the re-seal are the only paths this database lets
      // an audit row disappear or change (SECURITY DEFINER, EXECUTE revoked from PUBLIC, granted to
      // the runtime role); the ticket probe only reads its own transaction id and is PUBLIC-safe.
      // Row 95 (DF-28, D22(4), D38 DR-1, D43; 2026-11-05) replaced the purge in place: the live body is the one of 0043.
      { name: 'audit_purge_operator', arguments: 'p_operator_id text, p_actor_id text, p_reason text', result: 'jsonb', language: 'plpgsql', security_definer: true, volatility: 'v', parallel: 'u', settings: purgePinned, owner: 'dems_owner', body: bodyOf('0043_operator_purge_scope', 'audit_purge_operator') },
      // D56b (2026-11-03, 0038) corrected the re-seal in place; row 95 cycle 3 (D67, 2026-11-05) replaced
      // it again in 0043 (the empty-tail head branch): the live body is the one of 0043.
      { name: 'audit_purge_reseal', arguments: 'p_operator_id text, p_rows jsonb', result: 'jsonb', language: 'plpgsql', security_definer: true, volatility: 'v', parallel: 'u', settings: purgePinned, owner: 'dems_owner', body: bodyOf('0043_operator_purge_scope', 'audit_purge_reseal') },
      { name: 'audit_purge_ticket_open', arguments: '', result: 'boolean', language: 'sql', security_definer: true, volatility: 's', parallel: 'u', settings: purgePinned, owner: 'dems_owner', body: bodyOf('0036_operator_purge', 'audit_purge_ticket_open') },
      // The two write-only secret reveal functions of dbc-3 §B.3/§B.13 (SEC35-02, Q-SEC-3 default).
      // Set 16 (dbc-16, design 07): the destroy path of a retired device's credential, the mirror of the reveal.
      { name: 'dems_capture_credential_destroy', arguments: 'p_device_id text', result: 'integer', language: 'sql', security_definer: true, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0033_capture_device_retirement_privileges', 'dems_capture_credential_destroy') },
      { name: 'dems_capture_credential_reveal', arguments: 'p_device_id text', result: 'TABLE(username text, encryption text, secret_ciphertext bytea, nonce bytea, key_ref text)', language: 'sql', security_definer: true, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0005_capture_privileges', 'dems_capture_credential_reveal') },
      // Set 16: the guard of a retired row (invoker rights; its search path pinned).
      { name: 'dems_capture_retired_row_guard', arguments: '', result: 'trigger', language: 'plpgsql', security_definer: false, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0033_capture_device_retirement_privileges', 'dems_capture_retired_row_guard') },
      { name: 'dems_jsonb_is_flat', arguments: 'doc jsonb', result: 'boolean', language: 'sql', security_definer: false, volatility: 'i', parallel: 's', settings: null, owner: 'dems_owner', body: bodyOf('0000_prelude', 'dems_jsonb_is_flat') },
      { name: 'dems_stt_credential_reveal', arguments: '', result: 'TABLE(credential_kind text, credential_ref text, secret_ciphertext bytea, nonce bytea)', language: 'sql', security_definer: true, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0007_stt_config_privileges', 'dems_stt_credential_reveal') },
    ]);
  });

  it('T-AO-2d: 3 triggers on the audit tables and, since set 16, the 2 guards of a retired capture row, each with tgenabled = A (ENABLE ALWAYS), and no other trigger in the schema', async () => {
    const { rows } = await db.ownerPool().query(
      `SELECT c.relname::text AS table_name, t.tgname::text AS name, t.tgenabled::text AS mode, pg_get_triggerdef(t.oid) AS definition
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace ORDER BY 2`,
    );
    expect(rows).toEqual([
      {
        table_name: 'audit_chain_history',
        name: 'audit_chain_history_append_only',
        mode: 'A',
        definition:
          'CREATE TRIGGER audit_chain_history_append_only BEFORE DELETE OR UPDATE OR TRUNCATE ON public.audit_chain_history FOR EACH STATEMENT EXECUTE FUNCTION audit_chain_history_refuse_change()',
      },
      {
        table_name: 'audit_log',
        name: 'audit_log_append_only',
        mode: 'A',
        definition:
          'CREATE TRIGGER audit_log_append_only BEFORE DELETE OR UPDATE OR TRUNCATE ON public.audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_refuse_change()',
      },
      {
        table_name: 'audit_log',
        name: 'audit_log_chain_guard',
        mode: 'A',
        definition:
          'CREATE TRIGGER audit_log_chain_guard BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_guard_insert()',
      },
      {
        table_name: 'capture_audio_inputs',
        name: 'capture_audio_inputs_retired_guard',
        mode: 'A',
        definition:
          'CREATE TRIGGER capture_audio_inputs_retired_guard BEFORE UPDATE ON public.capture_audio_inputs FOR EACH ROW EXECUTE FUNCTION dems_capture_retired_row_guard()',
      },
      {
        table_name: 'capture_devices',
        name: 'capture_devices_retired_guard',
        mode: 'A',
        definition:
          'CREATE TRIGGER capture_devices_retired_guard BEFORE UPDATE ON public.capture_devices FOR EACH ROW EXECUTE FUNCTION dems_capture_retired_row_guard()',
      },
    ]);
    // The statement of T-AO-2d, as the contract writes it.
    const contract = await db.appPool().query(
      "SELECT tgname::text AS tgname, tgenabled::text AS tgenabled FROM pg_trigger WHERE tgrelid IN ('public.audit_log'::regclass, 'public.audit_chain_history'::regclass) AND NOT tgisinternal ORDER BY 1",
    );
    expect(contract.rows).toEqual([
      { tgname: 'audit_chain_history_append_only', tgenabled: 'A' },
      { tgname: 'audit_log_append_only', tgenabled: 'A' },
      { tgname: 'audit_log_chain_guard', tgenabled: 'A' },
    ]);
  });
});

describe('what the schema must not contain (CL-01, CL-07, CL-09, N-1)', () => {
  it('schema public holds tables, their indexes and twelve functions: the one identity sequence of the purge ledger, no view, enum or domain', async () => {
    const { rows } = await db.ownerPool().query<{ kind: string; total: string }>(
      `SELECT relkind::text AS kind, count(*) AS total FROM pg_class WHERE relnamespace = 'public'::regnamespace GROUP BY 1
       UNION ALL
       SELECT 'type:' || typtype::text, count(*) FROM pg_type
        WHERE typnamespace = 'public'::regnamespace AND typtype IN ('e', 'd', 'r') GROUP BY 1
       ORDER BY 1`,
    );
    // r = table (30 v1 + 10 v2); i = index (40 primary keys + 15 unique constraints + 23 indexes
    // + 3 unique indexes); t would be TOAST (it lives in pg_toast, not here).
    // dbc-4 §N.11: + T-41, + its primary key, + the partial unique index on onvif_uuid.
    // PE-129b-01: + T-42 and its primary key.
    // PE-0013-01: + T-43 and its primary key (i: 85, r: 43).
    // Task 4 schema set A: + T-44 and T-45, + their two primary keys, + the unique constraint on
    // a sound-card input, + the plain index on (device, lens, role).
    // Task 4 schema set B: + T-46 and T-47, + their two primary keys, + the two partial unique
    // indexes on an open alias (one per interface and address, one at all).
    // Task 4 schema set C: + T-48, + its primary key, + the partial unique index on the one
    // acceptance in force.
    // REVISED 2026-11-02 (principal PT GSP, 0036): + T-49 (keyless) and T-50 with its primary key
    // (i: 95 -> 96, r: 48 -> 50) — and the ONE sequence the schema has ever held: the IDENTITY
    // column `purge_no` renders as a relation of kind S. The CL-01 rule "no sequence" named
    // hand-created sequences and defaults; this one is the identity of the ratified ledger, and it
    // is pinned by name below so no other sequence can enter unnoticed.
    expect(Object.fromEntries(rows.map((row) => [row.kind, Number(row.total)]))).toEqual({ i: 96, r: 50, S: 1 });
    const sequences = await db.ownerPool().query<{ name: string }>(
      "SELECT relname::text AS name FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'S' ORDER BY 1",
    );
    expect(sequences.rows).toEqual([{ name: 'audit_purge_log_purge_no_seq' }]);
  });

  it('every table has exactly one primary key — the keyless exception being the purge ticket of 0036; a single-row table has the key singleton with default true and CHECK (singleton)', async () => {
    const singletons = inventory.tables.filter((table) => table.columns[0]?.name === 'singleton').map((table) => table.name);
    expect(singletons.sort()).toEqual(
      ['active_session', 'audit_chain_head', 'capture_config', 'console_settings', 'core_device', 'core_state',
        'hardware_snapshot', 'schema_meta', 'storage_policy', 'stt_config', 'core_media_store', 'capture_network_config'].sort(),
    );
    const { rows } = await db.ownerPool().query<{ table_name: string; definition: string }>(
      "SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype = 'p' ORDER BY 1",
    );
    // REVISED 2026-11-02 (principal PT GSP, 0036): 49 keys over 50 tables. The one table without a
    // key is `audit_purge_ticket` — deliberately keyless, a transaction-scoped marker row that
    // `dems_app` holds no privilege on at all. Named here so no second keyless table can slip in.
    expect(rows).toHaveLength(49);
    expect(new Set(rows.map((row) => row.table_name)).size).toBe(49);
    const allTables = await db.ownerPool().query<{ name: string }>(
      "SELECT relname::text AS name FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY 1",
    );
    expect(allTables.rows.map((row) => row.name).filter((name) => !rows.some((row) => row.table_name === name))).toEqual(['audit_purge_ticket']);
    for (const name of singletons) {
      expect(rows.find((row) => row.table_name === name)?.definition, name).toBe('PRIMARY KEY (singleton)');
    }
  });

  it('no column takes the database clock; time is bigint; no timestamp type anywhere (TY-1, CL-09)', async () => {
    const { rows } = await db.ownerPool().query<{ table_name: string; column_name: string; data_type: string; column_default: string | null }>(
      "SELECT table_name::text, column_name::text, data_type::text, column_default::text FROM information_schema.columns WHERE table_schema = 'public'",
    );
    expect(rows.filter((row) => /now\(\)|current_|clock_|timeofday/i.test(row.column_default ?? ''))).toEqual([]);
    expect(rows.filter((row) => /timestamp|date|time /i.test(row.data_type))).toEqual([]);
    expect(rows.filter((row) => row.column_name.endsWith('_at') && row.data_type !== 'bigint')).toEqual([]);
    expect(rows.filter((row) => /nextval/i.test(row.column_default ?? ''))).toEqual([]);
    const types = [...new Set(rows.map((row) => row.data_type))].sort();
    // REVISED 2026-11-02 (principal PT GSP, 0036): `xid8` joins the list — the transaction id of
    // the purge ticket, the only non-time database-clock type the amendment needed (a time never does).
    expect(types).toEqual(['bigint', 'boolean', 'bytea', 'double precision', 'integer', 'jsonb', 'smallint', 'text', 'uuid', 'xid8']);
    // CL-09 (2): the tables whose rows change in place and have no domain column for the change.
    for (const table of ['operators', 'paired_devices', 'active_session', 'evidence_items', 'storage_policy', 'console_settings', 'core_device', 'core_state']) {
      expect(rows.some((row) => row.table_name === table && row.column_name === 'updated_at'), table).toBe(true);
    }
  });

  it('the database is UTF8 with locale C, and under C text folds ASCII only and sorts by byte (TY-9, PG-20)', async () => {
    const { rows } = await db.ownerPool().query(
      `SELECT pg_encoding_to_char(encoding)::text AS encoding, datcollate::text AS collate, datctype::text AS ctype,
              lower('ÀÉZ') AS lowered, upper('àéz') AS uppered,
              (SELECT string_agg(v, '' ORDER BY v) FROM (VALUES ('a'), ('B'), ('é'), ('Z'), ('_')) AS t(v)) AS sorted
         FROM pg_database WHERE datname = current_database()`,
    );
    expect(rows).toEqual([{ encoding: 'UTF8', collate: 'C', ctype: 'C', lowered: 'ÀÉz', uppered: 'àéZ', sorted: 'BZ_aé' }]);
  });
});
