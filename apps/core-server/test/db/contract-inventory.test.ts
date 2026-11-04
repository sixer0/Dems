// Database-free checks of plan row W17 (project `unit`, so they run in every gate):
//
//   1. the checked-in inventory `contract-inventory.json` IS what the database contract says
//      today: sections 2.4 and 4 of the closed task-2 contract (30 tables, 302 columns, 98 named
//      CHECKs, 25 foreign keys) COMPOSED with the schema-v2 delta of dbc-3 (ruling D44 R1: the
//      closed document is never edited; `contract-v2-delta.ts` carries dbc-3 §A/§B/§C/§B.13).
//      Together with the schema-v3 delta of dbc-4 §N (`contract-v3-delta.ts`, row 129):
//      41 tables, 426 columns, 172 named CHECKs, 40 foreign keys; and with T-42 of erratum
//      PE-129b-01 (`contract-v5-delta.ts`, row 129b): 42 tables, 436 columns, 179 CHECKs; with
//      T-43 and `alerts.reason` of erratum PE-0013-01 (`contract-v6-delta.ts`): 43 tables, 440
//      columns, 182 CHECKs; with T-44, T-45, `session_capture_sources.source_facts` and the
//      nullable slot columns of task 4 schema set A (`contract-v7-delta.ts`): 45 tables, 461
//      columns, 199 CHECKs, 43 foreign keys; with T-46, T-47 and the USB serial and port of
//      `capture_audio_inputs` of task 4 schema set B (`contract-v8-delta.ts`): 47 tables, 484
//      columns, 217 CHECKs, 46 foreign keys; with `CREDENTIAL_REPLACED` in two reason sets
//      (`contract-v9-delta.ts`): no count moves; with the element CHECK on
//      `capture_devices.profiles` (`contract-v10-delta.ts`): 218 CHECKs; with T-48 of task 4
//      schema set C (`contract-v11-delta.ts`): 48 tables, 497 columns, 229 CHECKs, 48 foreign keys;
//      and with the purge amendment of 2026-11-02 (principal; migration 0036_operator_purge, composed
//      in this file below because the closed contract text is never edited): 50 tables, 512 columns,
//      236 CHECKs, 50 foreign keys;
//   2. the typed schema declares the same tables, columns, types, nullability and defaults;
//   3. the hand-written migration files are the statements of contract §6.3 and §8.3;
//   4. CL-12: every closed value set of the contract equals the shared constant it cites, and
//      the key deny list equals the server constant;
//   5. the migration files hold nothing the migrator would mis-split.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuthMethod, AuditCategory, AuditType, CaptureDeviceKind, EvidenceStatus, FaultKind, IntegritySource, OperatorRole, Permission, RecordingProfileId, ROLE_PERMISSIONS, RetentionPolicyId, ScenarioName, SessionOutcome, Severity, SimEventCategory, SimEventType, SubjectType, VerificationStatus } from '@dems/shared/sim';
import { EvidenceLifecycleStage, MicRole, SecurityState, SessionState, StorageState, TimeSource, TrackId } from '@dems/shared/domain';
import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { INITIAL_MIGRATION_TAGS, MIGRATIONS_FOLDER, readMigrationSet } from '../../src/db/commands/migrations';
import { SCHEMA_TABLE_NAMES } from '../../src/db/commands/status';
import * as schema from '../../src/db/schema';
import {
  authSessionPublicColumns,
  biometricTokenPublicColumns,
  operatorPublicColumns,
  pairedDevicePublicColumns,
  pairingCodePublicColumns,
} from '../../src/db/schema/public-columns';
import { CONTRACT_FILE, DBC3_FILE, type ContractConstraint, type ContractInventory, type ContractTable, parseContract, readInventory, serialise } from './contract-inventory';

const inventory = readInventory();
const contractText = readFileSync(CONTRACT_FILE, 'utf8');
const dbc3Text = readFileSync(DBC3_FILE, 'utf8');
const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable => is(value, PgTable));

// ── The purge amendment (principal PT GSP, 2026-11-02: amandemen RB-9 + aturan K-2 kontrak
// database, migration 0036_operator_purge) ─────────────────────────────────────────────────────
// `deleteUser` now erases an account instead of refusing the delete: its audit rows go with it and
// the chain is resealed, so the database holds two new tables and twenty-one foreign keys that
// survive the loss of an account by dropping the attribution instead of blocking the erasure. The
// closed contract text is never edited (D44 R1) and the checked-in `contract-inventory.json` is
// still the pre-amendment 48 tables, so the amendment is composed onto the inventory HERE, the way
// contract-inventory.ts composes a `contract-v*-delta.ts`, transcribed from the migration and from
// the live catalog. Every comparison below runs against `amendedInventory`; a drift of the typed
// schema away from it still fails. Handing this block to a regenerated `contract-v16-delta.ts` is
// the durable home of the same facts.
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

/** K-2 unchanged for the 7 references that belong to the account itself: the row disappears with
 *  the account, so deleting the account must still be refused while the row is there. */
const PURGE_RESTRICT_FKEYS: readonly string[] = [
  'active_session_investigator_id_fkey',
  'audit_chain_history_actor_id_fkey',
  'audit_log_actor_id_fkey',
  'auth_sessions_operator_id_fkey',
  'biometric_tokens_operator_id_fkey',
  'operator_credentials_operator_id_fkey',
  'pairing_codes_issued_by_operator_id_fkey',
];

/** The writable shape of `ContractTable`: the inventory's own fields, minus the `readonly`s. */
type MutableColumn = { name: string; type: string; notNull: boolean; default: string | null };
type MutableConstraint = { name: string; kind: ContractConstraint['kind']; definition: string };
type MutableTable = { id: string; name: string; columns: MutableColumn[]; constraints: MutableConstraint[] };

/** Composes the amendment onto a copy of the checked-in inventory, counting as contract-inventory.ts does. */
function composePurgeAmendment(base: ContractInventory): ContractInventory {
  const tables = structuredClone(base.tables) as unknown as MutableTable[];
  for (const [name, columns] of Object.entries(PURGE_NULLABLE_COLUMNS)) {
    const table = tables.find((candidate) => candidate.name === name);
    if (table === undefined) throw new Error(`purge amendment: the composed inventory has no table ${name}`);
    for (const column of columns) {
      const found = table.columns.find((candidate) => candidate.name === column);
      // A column that is not there at all is a transcription error and must say so rather than pass
      // quietly; one that is already nullable means the base inventory carries the amendment itself.
      if (found === undefined) throw new Error(`purge amendment: ${name}.${column} is not a column of the composed inventory`);
      found.notNull = false;
    }
  }
  for (const added of PURGE_NEW_TABLES) {
    if (tables.some((table) => table.name === added.name)) continue;
    tables.push(structuredClone(added) as unknown as MutableTable);
  }
  const all = tables.flatMap((table) => table.constraints);
  const count = (kind: ContractConstraint['kind']): number => all.filter((constraint) => constraint.kind === kind).length;
  return {
    ...base,
    tables,
    counts: {
      tables: tables.length,
      columns: tables.reduce((sum, table) => sum + table.columns.length, 0),
      primaryKeys: count('PRIMARY KEY'),
      foreignKeys: count('FOREIGN KEY'),
      uniques: count('UNIQUE'),
      uniqueIndexes: count('UNIQUE INDEX'),
      indexes: count('INDEX'),
      checks: count('CHECK'),
    },
  };
}

const amendedInventory = composePurgeAmendment(inventory);

describe('the inventory is the contract (sections 2.4 and 4)', () => {
  it('parsing the contract today gives exactly the checked-in inventory', () => {
    // A contract revision that changes a table must come with a regenerated inventory:
    //   node apps/core-server/test/db/contract-inventory.ts --write
    expect(serialise(parseContract(contractText))).toBe(serialise(inventory));
  });

  it("holds the composed counts: the closed §4 base plus the dbc-3, dbc-4, dbc-6, dbc-7, dbc-8, dbc-9, dbc-10, dbc-11, dbc-12, dbc-13, dbc-14, dbc-15, dbc-16, dbc-17 deltas and the purge amendment of 2026-11-02 = 50 tables, 516 columns, 237 CHECKs, 52 foreign keys", () => {
    // The base is the CLOSED task-2 contract (§15.6 states its own totals — re-pinned in
    // contract-inventory.ts's composition header); the delta is dbc-3 §A/§B/§B.13/§C transcribed
    // in contract-v2-delta.ts. The per-kind totals below are the composition's measured output;
    // `catalog.db.test.ts` re-checks them against the LIVE catalog built by 0000..0009, so the
    // composition is verified by two separately authored transcriptions, as it was in v1.
    expect(inventory.counts).toEqual({
      // dbc-4 §N.11 (set 4): +1 table, +7 columns, +1 PK, +1 FK, +1 unique index, +6 CHECKs.
      // PE-129b-01 (set 6): +1 table (T-42), +10 columns, +1 PK, +7 CHECKs.
      // PE-0013-01 (set 7): +1 table (T-43, 3 columns, 1 PK, 2 CHECKs), +1 column and +1 CHECK on
      // `alerts`; `transcript_revisions_key_id_check` keeps its name (count unchanged).
      // Task 4 schema set A (set 8, dbc-8): +2 tables (T-44: 10 columns, 1 PK, 1 FK, 1 index,
      // 7 CHECKs; T-45: 10 columns, 1 PK, 2 FKs, 1 unique, 6 CHECKs), +1 column and +3 CHECKs on
      // `session_capture_sources`, +1 CHECK on `capture_config` (six of its columns nullable).
      // Task 4 schema set B (set 9, dbc-9): +2 tables (T-46: 10 columns, 1 PK, 1 FK, 8 CHECKs;
      // T-47: 11 columns, 1 PK, 2 FKs, 2 partial unique indexes, 8 CHECKs), +2 columns and
      // +2 CHECKs on `capture_audio_inputs` (the USB serial and port of a sound card).
      // Task 4 package X-C (set 10, dbc-10): no count moves - two CHECKs keep their names and
      // take one value more (`CREDENTIAL_REPLACED`).
      // Task 4 requirement AD-06 (4) (set 11, dbc-11): +1 CHECK on `capture_devices` (every
      // element of the profile list is a code of the Core).
      // Task 4 schema set C (set 12, dbc-12): +1 table (T-48: 13 columns, 1 PK, 2 FKs, 1 partial
      // unique index - the one acceptance in force - and 11 CHECKs).
      // Task 4 decisions C74 D-2 / D-3 (set 13, dbc-13): two values in one value set; no count moves.
      // Task 4 caution R119-05 (d), decision C94 (d) (set 14, dbc-14): one value more in that set; no count moves.
      // Task 4 findings F-4 and S2-02, decisions C114 and C116 (set 15, dbc-15): +1 column and
      // +2 CHECKs on `capture_network_config` (the allowed ONVIF ports); the two interface-name
      // CHECKs keep their names and take the alias helper's own form.
      // Task 4 design 07, decision C147 (set 16, dbc-16): +3 columns (`retired_at`, `retired_by` of
      // `capture_devices`, `retired_at` of `capture_audio_inputs`), +1 FK (`retired_by`), +2 CHECKs
      // on `capture_devices`; `capture_audio_inputs_card_input_key` goes from a unique constraint
      // to a partial unique index under its name (-1 unique, +1 unique index).
      // D60 (2026-11-04), contract revision dbc-17 (set 17, migration 0039): +4 columns and
      // +2 foreign keys on `capture_config` (the video_03/video_04 pair), +1 CHECK
      // (`capture_config_profile_34_check`); the selector, slot-pair and five track CHECKs keep
      // their names; three value sets widen in place.
      // The checked-in base, before the amendment below.
      tables: 48,
      columns: 505,
      primaryKeys: 48,
      foreignKeys: 51,
      uniques: 15,
      uniqueIndexes: 8,
      indexes: 24,
      checks: 234,
    });
    // REVISED 2026-11-02 (principal): the purge amendment (migration 0036) adds T-49
    // `audit_purge_ticket` (3 columns, no key of its own) and T-50 `audit_purge_log` (8 columns,
    // 1 PK, 1 FK, 3 CHECKs); no column, CHECK or key of an existing table changes its kind or count.
    expect(amendedInventory.counts).toEqual({
      tables: 50,
      columns: 516,
      primaryKeys: 49,
      foreignKeys: 52,
      uniques: 15,
      uniqueIndexes: 8,
      indexes: 24,
      checks: 237,
    });
    expect(amendedInventory.tables.map((table) => table.id).sort()).toEqual(
      Array.from({ length: 50 }, (_, index) => `T-${String(index + 1).padStart(2, '0')}`),
    );
    // The counts the closed contract states in its own text (§15.6), and the ones dbc-3 claims:
    // 30 -> 39 tables (§0.1, the 9-new/5-changed reconciliation) plus the R-8 singleton T-40
    // (§B.13, confirmed by decision D24) = 40, plus T-41 of dbc-4 §N.3 = 41, plus T-42 of PE-129b-01 = 42, plus T-43 of PE-0013-01 = 43, plus T-44 and T-45 of task 4 schema set A = 45, plus T-46 and T-47 of task 4 schema set B = the 47 pinned above.
    expect(contractText).toContain('30 tables; boot checks B-1 to B-9; PostgreSQL behaviours PG-01 to PG-28; 98 named CHECKs; 25 foreign keys; 302 columns');
    expect(dbc3Text).toContain('| Table count | 30 -> 39 |');
    // The stable prefix only: the status wording after it is documentation (it moved from "proposed"
    // to "CONFIRMED - D24" with erratum PE-R8-02 and may move again). Controller ruling, row 113 fix round 1.
    expect(dbc3Text).toContain('### B.13 `stt_config` (T-40)');
  });

  it('every name is lower-case snake_case, at most 63 bytes, with the suffix of its kind (N-1 to N-4, CL-06)', () => {
    const suffix = { 'PRIMARY KEY': '_pkey', 'FOREIGN KEY': '_fkey', UNIQUE: '_key', 'UNIQUE INDEX': '_key', INDEX: '_idx', CHECK: '_check' } as const;
    // REVISED 2026-11-02 (principal): the amended inventory, so the names of the purge tables are held to the same rule.
    for (const table of amendedInventory.tables) {
      const names = [table.name, ...table.columns.map((column) => column.name), ...table.constraints.map((constraint) => constraint.name)];
      for (const name of names) {
        expect(name, name).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(Buffer.byteLength(name), name).toBeLessThanOrEqual(63);
      }
      for (const constraint of table.constraints) {
        expect(constraint.name.startsWith(`${table.name}_`), constraint.name).toBe(true);
        expect(constraint.name.endsWith(suffix[constraint.kind]), constraint.name).toBe(true);
      }
    }
    const all = amendedInventory.tables.flatMap((table) => table.constraints.map((constraint) => constraint.name));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('the typed schema declares what the contract lists', () => {
  it('the 50 tables with the same names', () => {
    // REVISED 2026-11-02 (principal): the purge amendment (migration 0036) adds T-49 `audit_purge_ticket`
    // and T-50 `audit_purge_log`, so the typed schema declares fifty tables and the names must still be
    // the same set, sorted, as the amended inventory's.
    expect(tables).toHaveLength(amendedInventory.counts.tables);
    expect([...SCHEMA_TABLE_NAMES]).toEqual(amendedInventory.tables.map((table) => table.name).sort());
  });

  it('each table: the same columns in the same order, with type, nullability and default', () => {
    const sqlType: Record<string, string> = {
      PgText: 'text',
      PgBigInt53: 'bigint',
      PgBoolean: 'boolean',
      PgInteger: 'integer',
      PgSmallInt: 'smallint',
      PgUUID: 'uuid',
      PgJsonb: 'jsonb',
      PgDoublePrecision: 'double precision',
      PgCustomColumn: 'bytea',
    };
    const differences: string[] = [];
    // REVISED 2026-11-02 (principal): purge drops attribution instead of refusing the delete — the six
    // columns of PURGE_NULLABLE_COLUMNS are compared as nullable, every other column as before.
    for (const expected of amendedInventory.tables) {
      const table = tables.find((candidate) => getTableName(candidate) === expected.name);
      if (table === undefined) {
        differences.push(`missing table ${expected.name}`);
        continue;
      }
      const columns = Object.values(getTableColumns(table));
      const declared = columns.map((column) => ({
        name: column.name,
        type: column.columnType === 'PgCustomColumn' ? column.getSQLType() : (sqlType[column.columnType] ?? column.columnType),
        notNull: column.notNull,
        hasDefault: column.hasDefault,
      }));
      const wanted = expected.columns.map((column) => ({
        name: column.name,
        type: column.type,
        notNull: column.notNull,
        hasDefault: column.default !== null,
      }));
      if (JSON.stringify(declared) !== JSON.stringify(wanted)) {
        differences.push(`${expected.name}: declared ${JSON.stringify(declared)} expected ${JSON.stringify(wanted)}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it('each table: the same constraint and index names, by kind', () => {
    const differences: string[] = [];
    // REVISED 2026-11-02 (principal): the two purge tables are held to the same naming rule as the rest.
    for (const expected of amendedInventory.tables) {
      const table = tables.find((candidate) => getTableName(candidate) === expected.name);
      if (table === undefined) continue;
      const config = getTableConfig(table);
      const declared = [
        ...config.checks.map((check) => `CHECK ${check.name}`),
        ...config.foreignKeys.map((key) => `FOREIGN KEY ${key.getName()}`),
        ...config.uniqueConstraints.map((unique) => `UNIQUE ${unique.name ?? '?'}`),
        ...config.indexes.map((index) => `${index.config.unique ? 'UNIQUE INDEX' : 'INDEX'} ${index.config.name ?? '?'}`),
      ].sort();
      // A single-column primary key takes PostgreSQL's default name, which is the contract's.
      const wanted = expected.constraints
        .filter((constraint) => constraint.kind !== 'PRIMARY KEY')
        .map((constraint) => `${constraint.kind} ${constraint.name}`)
        .sort();
      if (JSON.stringify(declared) !== JSON.stringify(wanted)) {
        differences.push(`${expected.name}: declared ${declared.join(', ')} | expected ${wanted.join(', ')}`);
      }
      // K-2, as amended by the purge decision of 2026-11-02 (principal): a foreign key that points at
      // the account whose OWN record it is must still refuse the delete (the row goes with the account),
      // and a foreign key that only names WHO did something to a record that survives must SET NULL.
      // Both lists are named constraint by constraint above — a key of neither list keeps the original
      // RESTRICT / NO ACTION rule and fails with the original message.
      for (const key of config.foreignKeys) {
        const name = key.getName();
        if (PURGE_SET_NULL_FKEYS.includes(name)) {
          if (key.onDelete !== 'set null' || key.onUpdate !== 'no action') differences.push(`${name}: not SET NULL / NO ACTION (K-2 exception, purge amendment 2026-11-02)`);
          continue;
        }
        if (key.onDelete !== 'restrict' || key.onUpdate !== 'no action') differences.push(`${name}: not RESTRICT / NO ACTION (K-2)`);
      }
      for (const primary of config.primaryKeys) {
        const wantedKey = expected.constraints.find((constraint) => constraint.kind === 'PRIMARY KEY');
        if (primary.getName() !== wantedKey?.name) differences.push(`${expected.name}: primary key named ${primary.getName()}`);
      }
    }
    // The two lists are exhaustive over the references to an account: the foreign keys of the amended
    // inventory that point at `operators` are exactly these twenty-eight names — twenty-one that ride
    // the purge by losing their attribution, seven that belong to the account itself. Neither list can
    // lose or gain a name without this line failing, and no declared key is left outside both rules.
    const toOperators = amendedInventory.tables
      .flatMap((table) => table.constraints)
      .filter((constraint) => constraint.kind === 'FOREIGN KEY' && constraint.definition.includes('REFERENCES operators'))
      .map((constraint) => constraint.name);
    expect(toOperators).toHaveLength(28);
    expect([...toOperators].sort()).toEqual([...PURGE_SET_NULL_FKEYS, ...PURGE_RESTRICT_FKEYS].sort());
    expect(PURGE_SET_NULL_FKEYS).toHaveLength(21);
    expect(PURGE_RESTRICT_FKEYS).toHaveLength(7);
    expect(PURGE_SET_NULL_FKEYS.filter((name) => PURGE_RESTRICT_FKEYS.includes(name))).toEqual([]);
    const declaredKeys = tables.flatMap((table) => getTableConfig(table).foreignKeys.map((key) => key.getName()));
    expect(declaredKeys).toHaveLength(amendedInventory.counts.foreignKeys);
    for (const name of toOperators) expect(declaredKeys, name).toContain(name);
    expect(differences).toEqual([]);
  });

  it('time and byte counts are bigint read as a JavaScript number; no timestamp, no serial, no enum (TY-1, TY-3, CL-07)', () => {
    const allowed = new Set(['PgText', 'PgBigInt53', 'PgBoolean', 'PgInteger', 'PgSmallInt', 'PgUUID', 'PgJsonb', 'PgDoublePrecision', 'PgCustomColumn']);
    for (const table of tables) {
      for (const column of Object.values(getTableColumns(table))) {
        expect(allowed.has(column.columnType), `${getTableName(table)}.${column.name}: ${column.columnType}`).toBe(true);
        if (column.name.endsWith('_at')) expect(column.columnType, `${getTableName(table)}.${column.name}`).toBe('PgBigInt53');
        // MR-8: no automatic update hook anywhere.
        expect(column.onUpdateFn, `${getTableName(table)}.${column.name}`).toBeUndefined();
      }
    }
  });

  it('one bytea type, used by exactly the hash, salt and write-only secret columns the contract declares (TY-5, D38; dbc-3 §B.3, §B.13)', () => {
    const custom = tables.flatMap((table) =>
      Object.values(getTableColumns(table))
        .filter((column) => column.columnType === 'PgCustomColumn')
        .map((column) => `${getTableName(table)}.${column.name}:${column.getSQLType()}`),
    );
    // Derived from the contract first, then pinned: the seven v1 hash/salt columns plus the two
    // write-only secret pairs of `capture_device_credentials` (T-33) and `stt_config` (T-40).
    const declaredByContract = amendedInventory.tables
      .flatMap((table) => table.columns.filter((column) => column.type === 'bytea').map((column) => `${table.name}.${column.name}:bytea`))
      .sort();
    // REVISED 2026-11-02 (principal): the purge ticket adds the SECOND custom type of the schema,
    // `xid8` on `audit_purge_ticket.xact_id` (migration 0036; drizzle-orm has no column for it). It is
    // named here so a third custom type cannot arrive unheard of; the bytea rule itself is unchanged.
    expect(custom.filter((entry) => !entry.endsWith(':bytea')).sort()).toEqual(['audit_purge_ticket.xact_id:xid8']);
    expect(custom.filter((entry) => entry.endsWith(':bytea')).sort()).toEqual(declaredByContract);
    expect(declaredByContract).toEqual([
      'auth_sessions.token_hash:bytea',
      'biometric_tokens.token_hash:bytea',
      'capture_device_credentials.nonce:bytea',
      'capture_device_credentials.secret_ciphertext:bytea',
      'device_credentials.current_hash:bytea',
      'device_credentials.next_hash:bytea',
      'operator_credentials.hash:bytea',
      'operator_credentials.salt:bytea',
      'pairing_codes.code_hash:bytea',
      'stt_config.nonce:bytea',
      'stt_config.secret_ciphertext:bytea',
    ]);
  });

  it('NL-6: the public column sets leave the hash columns out and nothing else', () => {
    const names = (columns: Record<string, { name: string }>): string[] => Object.values(columns).map((column) => column.name);
    const all = (table: PgTable): string[] => Object.values(getTableColumns(table)).map((column) => column.name);
    expect(names(operatorPublicColumns)).toEqual(all(schema.operators));
    expect(names(pairedDevicePublicColumns)).toEqual(all(schema.pairedDevices));
    expect(names(authSessionPublicColumns)).toEqual(all(schema.authSessions).filter((name) => name !== 'token_hash'));
    expect(names(pairingCodePublicColumns)).toEqual(all(schema.pairingCodes).filter((name) => name !== 'code_hash'));
    expect(names(biometricTokenPublicColumns)).toEqual(all(schema.biometricTokens).filter((name) => name !== 'token_hash'));
  });
});

describe('the hand-written migration files are the statements of the contract', () => {
  /** Statements only: comment lines (the breakpoint marker is one) and white space are dropped. */
  const statements = (sql: string): string =>
    sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  const sqlBlocks = [...contractText.matchAll(/```sql\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
  const block = (firstLine: string): string => {
    const found = sqlBlocks.filter((candidate) => candidate.startsWith(firstLine));
    expect(found, firstLine).toHaveLength(1);
    return found[0] ?? '';
  };
  const file = (tag: string): string => readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8');

  it('0000_prelude is the function of §8.3', () => {
    expect(statements(file('0000_prelude'))).toBe(statements(block('-- 0000_prelude')));
  });

  it('0002_audit_guards is the six statement groups of §6.3', () => {
    expect(statements(file('0002_audit_guards'))).toBe(statements(block('-- 1. The chain head')));
  });

  it('0003_privileges is the statements of §8.3: INSERT on 16 tables, audit_chain_history not among them', () => {
    const text = statements(file('0003_privileges'));
    expect(text).toBe(statements(block('-- 0003_privileges')));
    const insert = /GRANT INSERT ON ([a-z_, ]+) TO dems_app;/.exec(text)?.[1]?.split(',').map((name) => name.trim()) ?? [];
    expect(insert).toHaveLength(16);
    expect(insert).not.toContain('audit_chain_history');
    expect(text).toContain("VALUES (true, 1, 'dbc-2')");
  });

  it('the set is forty files; the twenty-one hand-written ones never hold the marker inside a comment or a string (D38; dbc-3 §A.1; dbc-4 §N.8; errata PE-129a-01, PE-129b-01, PE-0013-01; task 4 schema sets A, B and C; task 4 package X-C; the profile-code CHECK; the alias removal reasons, both steps; the allowed ONVIF ports; retiring a capture device; the supervisor revocation of the capture lane; the operator-administration privileges and the operator purge of the RB-9 amendment of 2026-11-02; the four video tracks of D60)', () => {
    // REVISED 2026-11-03 (D56b): the constant in src now carries the whole set through 0038 — the
    // RB-9 trio (0034 to 0036), the credential-creation grant of D56 (0037) and the re-seal
    // correction of D56b (0038) — so the separate tail this row used to name is retired: the set
    // equality holds against INITIAL_MIGRATION_TAGS alone.
    expect(readMigrationSet().map((entry) => entry.tag)).toEqual([...INITIAL_MIGRATION_TAGS]);
    const marker = ['-->', 'statement-breakpoint'].join(' ');
    // Hand-written: the v1 trio plus the two privilege migrations row 46/row 112 wrote by hand
    // and the privilege migration of set 4, row 129, and of set 5, row 129a (0004, 0006 and 0008 are drizzle-generated
    // and legitimately carry the marker as lines).
    // D56/D56b (2026-11-03): 0037 and 0038 land, 37 -> 39. D60 (2026-11-04): 0039 lands, 39 -> 40.
    expect(readMigrationSet()).toHaveLength(40);
    // REVISED 2026-11-02 (principal): 0034 and 0036 join the scanned list. 0035 is NOT added yet: its
    // comment block holds three non-ASCII lines (an em dash and a section sign), and the plain-ASCII
    // rule below exists because the migrator hashes the decoded text — so the file has to be corrected
    // by its own row first, and this test refuses to look away from that. Reported, not waived.
    for (const tag of ['0000_prelude', '0002_audit_guards', '0003_privileges', '0005_capture_privileges', '0007_stt_config_privileges', '0009_capture_sources_privileges', '0010_credential_replace_privileges', '0012_session_stt_config_privileges', '0014_key_id_fault_reason_media_root_privileges', '0016_capture_streams_audio_inputs_privileges', '0018_network_commissioning_privileges', '0020_credential_replaced_reason_privileges', '0021_profile_codes_data', '0023_profile_codes_privileges', '0025_installation_acceptance_privileges', '0027_alias_removal_reasons_privileges', '0029_alias_removal_reason_unconfirmed_privileges', '0031_network_config_onvif_ports_privileges', '0033_capture_device_retirement_privileges', '0034_capture_config_supervisor_revocation', '0036_operator_purge', '0037_operator_credential_creation', '0038_operator_purge_reseal_correction']) {
      for (const line of file(tag).split('\n')) {
        if (line.includes(marker)) expect(line, `${tag}: the marker must be a line of its own`).toBe(marker);
      }
      // Plain ASCII: the migrator hashes the decoded text, so the file must not depend on an encoding.
      // eslint-disable-next-line no-control-regex
      expect(/^[\x09\x0a\x20-\x7e]*$/.test(file(tag)), tag).toBe(true);
    }
  });
});

describe('CL-12: the closed value sets equal the shared vocabulary', () => {
  const shared: Record<string, readonly string[]> = {
    ROLE: Object.values(OperatorRole),
    SEVERITY: Object.values(Severity),
    AUDIT_CATEGORY: Object.values(AuditCategory),
    EVENT_CATEGORY: Object.values(SimEventCategory),
    SESSION_STATE: Object.values(SessionState),
    SESSION_OUTCOME: Object.values(SessionOutcome),
    SUBJECT_TYPE: Object.values(SubjectType),
    PROFILE: Object.values(RecordingProfileId),
    TIME_SOURCE: Object.values(TimeSource),
    TRACK_ID: Object.values(TrackId),
    // D60 (2026-11-04): four video tracks.
    VIDEO_TRACK_ID: [TrackId.VIDEO_01, TrackId.VIDEO_02, TrackId.VIDEO_03, TrackId.VIDEO_04],
    FAULT_KIND: Object.values(FaultKind),
    EVIDENCE_STATUS: Object.values(EvidenceStatus),
    LIFECYCLE_STAGE: Object.values(EvidenceLifecycleStage),
    VERIFICATION: Object.values(VerificationStatus),
    INTEGRITY_SOURCE: Object.values(IntegritySource),
    RETENTION: Object.values(RetentionPolicyId),
    SCENARIO: Object.values(ScenarioName),
    STORAGE_STATE: Object.values(StorageState),
    SECURITY_STATE: Object.values(SecurityState),
    // The shared set also has SECURITY_KEY; no Live session can have it (spec §7.17 X-1).
    AUTH_METHOD: Object.values(AuthMethod).filter((method) => method !== 'SECURITY_KEY'),
    // dbc-3 §B.2 sets that joined the shared vocabulary with rows 45/47 (CL-12 stays equality in
    // both directions: the contract's lists and the shared constants must agree, element-wise).
    CAPTURE_DEVICE_KIND: Object.values(CaptureDeviceKind),
    MIC_ROLE: Object.values(MicRole),
  };

  it.each(Object.keys(shared))('%s: contract list = shared constant', (name) => {
    expect(inventory.valueSets[name], name).toEqual(shared[name]);
  });

  it('every value set of the contract is a constant of the typed schema, with the same values in the same order', () => {
    const declared = schema as unknown as Record<string, unknown>;
    // 28 sets in §2.4 of the closed contract + 14 added or swapped by dbc-3 §C.6/§E.3/§B (R1)
    // + 2 of dbc-4 §N.2/§N.3 (CAPTURE_ADAPTER_KIND, CAPTURE_SOURCE_SLOT)
    // + 2 of task 4 schema set A (CAPTURE_STREAM_ROLE, CAPTURE_STREAM_CODEC)
    // + 2 of task 4 schema set B (HOST_ALIAS_REASON, HOST_ALIAS_REMOVE_REASON).
    expect(Object.keys(inventory.valueSets)).toHaveLength(48);
    for (const [name, values] of Object.entries(inventory.valueSets)) {
      expect(declared[name], name).toEqual(values);
    }
  });

  it('the twenty-five server-native sets have no shared constant yet; they are the lists of the contract', () => {
    const serverNative = [
      'SESSION_END_REASON', 'DEVICE_STATE', 'CODE_STATE', 'BIO_REVOKE_REASON', 'EXPORT_SCOPE',
      'SNAPSHOT_CAUSE', 'CHAIN_DISCARD_REASON',
      // Added with schema v2 (dbc-3 §B/§C.6/§E.3 and §B.13); CAPTURE_DEVICE_KIND and MIC_ROLE are
      // NOT here: they joined the shared vocabulary with rows 45/47 and sit in `shared` above.
      'TRACK_KIND', 'LABELS_STATUS', 'SEALING_JOB_STATUS', 'TRANSCRIPT_CHUNK_STATUS',
      'SIGNATURE_ALGORITHM', 'TRANSCRIPT_SIGNATURE_ALGORITHM', 'STT_BACKEND', 'STT_CREDENTIAL_KIND',
      'AUDIO_INTERVAL_REASON', 'TIME_FORMAT', 'ENGINE_COUNTER', 'REGISTRY_COUNTER',
      // Added with schema v3 (dbc-4 §N.2/§N.3). CAPTURE_ADAPTER_KIND moves to `shared` above when
      // row 136 adds the shared constant of the five kinds (the CL-12 equality then pins it).
      'CAPTURE_ADAPTER_KIND', 'CAPTURE_SOURCE_SLOT',
      // Added with schema v7 (task 4 schema set A): the role and the codec of a camera stream.
      'CAPTURE_STREAM_ROLE', 'CAPTURE_STREAM_CODEC',
      // Added with schema v8 (task 4 schema set B): why a temporary address was added and how it ended.
      'HOST_ALIAS_REASON', 'HOST_ALIAS_REMOVE_REASON',
    ];
    expect(Object.keys(inventory.valueSets).filter((name) => !(name in shared)).sort()).toEqual([...serverNative].sort());
    // Nine since schema v9 (task 4 package X-C): `CREDENTIAL_REPLACED`, last, in both reason sets.
    expect(inventory.valueSets['SESSION_END_REASON']).toHaveLength(9);
    expect(inventory.valueSets['SESSION_END_REASON']).toContain('TOKEN_REUSE');
    expect(inventory.valueSets['SESSION_END_REASON']?.at(-1)).toBe('CREDENTIAL_REPLACED');
    expect(inventory.valueSets['BIO_REVOKE_REASON']).toHaveLength(7);
    expect(inventory.valueSets['BIO_REVOKE_REASON']?.at(-1)).toBe('CREDENTIAL_REPLACED');
    // Six since schema v12 (task 4 decisions C74 D-2 / D-3): `SHUTDOWN` and `NOT_ADDED`; seven since
    // schema v13 (caution R119-05, decision C94 (d)): `ADD_UNCONFIRMED`, last.
    expect(inventory.valueSets['HOST_ALIAS_REMOVE_REASON']).toEqual(['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP', 'SHUTDOWN', 'NOT_ADDED', 'ADD_UNCONFIRMED']);
  });

  it('the 28 denied key names: the CHECK text of the contract = the server constant', () => {
    const denied = [...(inventory.formats['NO_SECRET_KEYS'] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
    // 17 in the closed contract; dbc-3 §C.6 grew it and row 112 added credentialRef,
    // credentialValue and apiKey for stt_config (AUDIT_DETAIL_FORBIDDEN_KEYS = 28).
    expect(denied).toHaveLength(28);
    expect(denied).toEqual([...schema.AUDIT_DETAIL_FORBIDDEN_KEYS]);
  });

  it('open sets pass the format check, so additive vocabulary needs no migration (MG-11)', () => {
    const code = new RegExp(/'([^']+)'/.exec(inventory.formats['CODE'] ?? '')?.[1] ?? 'x^');
    for (const value of [...Object.values(AuditType), ...Object.values(SimEventType), ...Object.values(Permission)]) {
      expect(code.test(value), value).toBe(true);
    }
    // R3 (D44): the permission count is recomputed from the landed role table, never hardcoded —
    // every declared permission must be granted to at least one role, and none may be missing.
    expect(new Set(Object.values(ROLE_PERMISSIONS).flat()).size).toBe(Object.values(Permission).length);
  });
});
