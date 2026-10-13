/**
 * The expected inventory of the database, read from the database contract ITSELF (not a test
 * file; plan row W17).
 *
 * `parseContract` reads sections 2.4 and 4 of `masterplan/03_database_contract.md`: the value
 * sets, the format rules, and for each of the 30 tables its column table and its "keys,
 * constraints, indexes" table. The result is the inventory the catalog test compares the live
 * catalog with. It is checked in as `contract-inventory.json`, so that the database tests do not
 * depend on the documents folder; the database-free test `contract-inventory.test.ts` parses the
 * contract again and fails when the checked-in inventory is stale.
 *
 * This file is self-contained (node modules only), so it also runs on its own:
 *
 *   node apps/core-server/test/db/contract-inventory.ts --write     regenerates the JSON
 *
 * The typed schema is NOT an input here. That is the point: the inventory comes from the
 * contract's tables, the catalog from the migration files, and the test compares the two.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V2 } from './contract-v2-delta';
import { V3 } from './contract-v3-delta';
import { V5 } from './contract-v5-delta';
import { V6 } from './contract-v6-delta';
import { V7 } from './contract-v7-delta';
import { V8 } from './contract-v8-delta';
import { V9 } from './contract-v9-delta';
import { V10 } from './contract-v10-delta';
import { V11 } from './contract-v11-delta';
import { V12 } from './contract-v12-delta';
import { V13 } from './contract-v13-delta';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The workspace root of the repository: this folder is four levels below it. */
export const REPOSITORY_ROOT = resolve(HERE, '..', '..', '..', '..');
export const CONTRACT_FILE = resolve(
  REPOSITORY_ROOT,
  'docs',
  '2026-10-04_dems_backend_rbac_pairing',
  'masterplan',
  '03_database_contract.md',
);
/**
 * dbc-3, the current contract (ruling D44 R1): the CLOSED task-2 document above is never edited;
 * the schema-v2 delta composes onto it from THIS contract, transcribed in `contract-v2-delta.ts`.
 */
export const DBC3_FILE = resolve(
  REPOSITORY_ROOT,
  'docs',
  '2026-10-07_dems_real_capture_sealing',
  'masterplan',
  '04_database_contract.md',
);
export const INVENTORY_FILE = resolve(HERE, 'contract-inventory.json');

export type ConstraintKind = 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'UNIQUE INDEX' | 'INDEX' | 'CHECK';

export interface ContractColumn {
  readonly name: string;
  /** The PostgreSQL type as the contract writes it: `text`, `bigint`, `double precision`, ... */
  readonly type: string;
  readonly notNull: boolean;
  /** The default as the contract writes it (`true`, `0`, `'{}'`, `gen_random_uuid()`), or null. */
  readonly default: string | null;
}

export interface ContractConstraint {
  readonly name: string;
  readonly kind: ConstraintKind;
  /** The definition with every value set and format rule of §2.4 written out. */
  readonly definition: string;
}

export interface ContractTable {
  /** `T-01` to `T-30`. */
  readonly id: string;
  readonly name: string;
  readonly columns: readonly ContractColumn[];
  readonly constraints: readonly ContractConstraint[];
}

export interface ContractCounts {
  readonly tables: number;
  readonly columns: number;
  readonly primaryKeys: number;
  readonly foreignKeys: number;
  readonly uniques: number;
  readonly uniqueIndexes: number;
  readonly indexes: number;
  readonly checks: number;
}

export interface ContractInventory {
  readonly source: string;
  readonly valueSets: Readonly<Record<string, readonly string[]>>;
  readonly formats: Readonly<Record<string, string>>;
  readonly tables: readonly ContractTable[];
  readonly counts: ContractCounts;
}

const KINDS: readonly ConstraintKind[] = ['PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE INDEX', 'UNIQUE', 'INDEX', 'CHECK'];

/** The cells of a Markdown table row. A pipe written as `\|` belongs to the cell. */
function cells(line: string): string[] {
  const parts = line.split(/(?<!\\)\|/).map((part) => part.trim().replaceAll('\\|', '|'));
  return parts.slice(1, -1);
}

const isRow = (line: string): boolean => line.startsWith('|');
const isSeparator = (line: string): boolean => /^\|[\s:|-]+\|$/.test(line);

/** Every `code span` of a cell, in order. */
function spans(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '');
}

/** The Markdown tables of a block of lines: each as its header cells and its body rows. */
function tablesOf(lines: readonly string[]): Array<{ header: string[]; rows: string[][] }> {
  const found: Array<{ header: string[]; rows: string[][] }> = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    const next = lines[index + 1] ?? '';
    if (isRow(line) && isSeparator(next)) {
      const header = cells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isRow(lines[index] ?? '')) {
        rows.push(cells(lines[index] ?? ''));
        index += 1;
      }
      found.push({ header, rows });
    } else {
      index += 1;
    }
  }
  return found;
}

function section(lines: readonly string[], from: RegExp, to: RegExp): string[] {
  const start = lines.findIndex((line) => from.test(line));
  if (start < 0) throw new Error(`contract: no heading ${from}`);
  const length = lines.slice(start + 1).findIndex((line) => to.test(line));
  return lines.slice(start + 1, length < 0 ? undefined : start + 1 + length);
}

function parseValueSets(lines: readonly string[]): { valueSets: Record<string, string[]>; formats: Record<string, string> } {
  const block = section(lines, /^### 2\.4 /, /^### 2\.5 /);
  const [sets, formats] = tablesOf(block);
  if (sets === undefined || formats === undefined) throw new Error('contract §2.4: two tables expected');

  const valueSets: Record<string, string[]> = {};
  for (const row of sets.rows) {
    const name = spans(row[0] ?? '')[0];
    // Remarks in parentheses may hold code spans of their own; they are not values.
    const values = spans((row[1] ?? '').replace(/\([^)]*\)/g, ''));
    if (name === undefined || values.length === 0) throw new Error(`contract §2.4: unreadable value set row "${row[0]}"`);
    valueSets[name] = values;
  }

  const formatRules: Record<string, string> = {};
  for (const row of formats.rows) {
    const name = /^([A-Z0-9_]+)\(c\)$/.exec(spans(row[0] ?? '')[0] ?? '')?.[1];
    const expression = spans(row[1] ?? '')[0];
    if (name === undefined || expression === undefined) throw new Error(`contract §2.4: unreadable format row "${row[0]}"`);
    formatRules[name] = expression;
  }
  return { valueSets, formats: formatRules };
}

/** Writes out the value sets and the format rules that a definition names. */
function expand(definition: string, valueSets: Record<string, string[]>, formats: Record<string, string>): string {
  let text = definition;
  text = text.replace(/\bIN \(([A-Z][A-Z0-9_]*)\)/g, (whole, name: string) => {
    const values = valueSets[name];
    return values === undefined ? whole : `IN (${values.map((value) => `'${value}'`).join(', ')})`;
  });
  text = text.replace(/\b([A-Z][A-Z0-9_]*)\(([a-z_][a-z0-9_]*)\)/g, (whole, name: string, argument: string) => {
    const expression = formats[name];
    return expression === undefined ? whole : `(${expression.replace(/\bc\b/, argument)})`;
  });
  return text;
}

function parseTable(heading: string, block: readonly string[], sets: Record<string, string[]>, formats: Record<string, string>): {
  table: ContractTable;
  raw: Map<string, string>;
} {
  const match = /^### 4\.\d+ (T-\d{2}) `([a-z_]+)`/.exec(heading);
  if (match === null) throw new Error(`contract §4: unreadable heading "${heading}"`);
  const id = match[1] ?? '';
  const name = match[2] ?? '';
  const tables = tablesOf(block);
  const columnTable = tables.find((table) => table.header[0] === 'Column');
  const keyTable = tables.find((table) => table.header[0] === 'Name' && table.header[1] === 'Kind');
  if (columnTable === undefined || keyTable === undefined) throw new Error(`contract ${id} ${name}: column or key table missing`);

  const columns: ContractColumn[] = [];
  const rules = new Map<string, string>();
  for (const row of columnTable.rows) {
    const names = spans(row[0] ?? '');
    const type = spans(row[1] ?? '')[0];
    const nullability = row[2] ?? '';
    const defaultCell = row[3] ?? '';
    if (names.length === 0 || type === undefined || (nullability !== 'NOT NULL' && nullability !== 'NULL')) {
      throw new Error(`contract ${id} ${name}: unreadable column row "${row.join(' | ')}"`);
    }
    for (const column of names) {
      columns.push({ name: column, type, notNull: nullability === 'NOT NULL', default: spans(defaultCell)[0] ?? null });
      rules.set(column, row[4] ?? '');
    }
  }

  // First pass: the definitions as written. "as above" and "as <other check>" are resolved after it.
  const raw = new Map<string, string>();
  const entries: Array<{ name: string; kind: ConstraintKind; cell: string }> = [];
  for (const row of keyTable.rows) {
    const constraint = spans(row[0] ?? '')[0];
    const kind = KINDS.find((candidate) => candidate === row[1]);
    if (constraint === undefined || kind === undefined) {
      throw new Error(`contract ${id} ${name}: unreadable key row "${row.join(' | ')}"`);
    }
    entries.push({ name: constraint, kind, cell: row[2] ?? '' });
    const written = spans(row[2] ?? '')[0];
    if (written !== undefined && !(row[2] ?? '').startsWith('as ')) raw.set(constraint, written);
  }

  const constraints = entries.map(({ name: constraint, kind, cell }): ContractConstraint => {
    let definition = raw.get(constraint);
    if (definition === undefined && cell === 'as above') {
      // The rule cell of the column the check is named after holds the expression.
      const column = constraint.slice(name.length + 1, -'_check'.length);
      definition = spans(rules.get(column) ?? '').find((span) => / ~ '/.test(span));
    } else if (definition === undefined && cell.startsWith('as `')) {
      // T-16: "as `active_session_time_source_check`, on `start_time_source` and `end_time_source`".
      const [other, , second] = spans(cell);
      const base = other === undefined ? undefined : EARLIER.get(other);
      if (base !== undefined && second !== undefined) definition = base.replaceAll('stop_time_source', second);
    }
    if (definition === undefined) throw new Error(`contract ${id} ${name}: no definition for ${constraint} ("${cell}")`);
    raw.set(constraint, definition);
    EARLIER.set(constraint, definition);
    return { name: constraint, kind, definition: kind === 'CHECK' ? expand(definition, sets, formats) : definition };
  });

  return { table: { id, name, columns, constraints }, raw };
}

/** Definitions of the tables parsed so far, for a later "as `<check>`" reference. */
const EARLIER = new Map<string, string>();

export function parseContract(text: string): ContractInventory {
  EARLIER.clear();
  const lines = text.split('\n');
  const { valueSets, formats } = parseValueSets(lines);
  const body = section(lines, /^## 4\. Tables/, /^## 5\. /);

  const tables: ContractTable[] = [];
  const starts = body.flatMap((line, index) => (/^### 4\.\d+ T-\d{2} /.test(line) ? [index] : []));
  starts.forEach((start, position) => {
    const end = starts[position + 1] ?? body.length;
    tables.push(parseTable(body[start] ?? '', body.slice(start + 1, end), valueSets, formats).table);
  });

  // ── Schema v2 (ruling D44 R1): compose the dbc-3 delta onto the v1 base ──────────────────
  // The task-2 contract stays exactly as closed; dbc-3 (`docs/2026-10-07_.../masterplan/
  // 04_database_contract.md`) adds nine tables and an R-8 tenth (T-31..T-40), changes five, and
  // swaps three CHECKs elsewhere. The delta module states its provenance; see contract-v2-delta.ts.
  for (const [name, swap] of Object.entries(V2.valueSetSwaps)) valueSets[name] = [...swap];
  Object.assign(valueSets, V2.valueSets);
  formats['NO_SECRET_KEYS'] = V2.noSecretKeys;
  for (const added of V2.newTables) {
    tables.push({ id: added.id, name: added.name, columns: added.columns.map((c) => ({ ...c })), constraints: added.constraints.map((c) => ({ ...c })) as ContractConstraint[] });
  }
  // ── Schema v3 (dbc-4 §N; blueprint row 129): T-41, two added columns, six CHECKs, one FK, one
  // partial unique index and two value sets, composed after the dbc-3 delta (contract-v3-delta.ts).
  Object.assign(valueSets, V3.valueSets);
  for (const added of V3.newTables) {
    tables.push({ id: added.id, name: added.name, columns: added.columns.map((c) => ({ ...c })), constraints: added.constraints.map((c) => ({ ...c })) as ContractConstraint[] });
  }
  // ── Schema v5 (section N erratum PE-129b-01; row 129b): T-42 `session_stt_config`, ten columns,
  // seven CHECKs, one primary key (contract-v5-delta.ts). Schema v4 changed no table.
  for (const added of V5.newTables) {
    tables.push({ id: added.id, name: added.name, columns: added.columns.map((c) => ({ ...c })), constraints: added.constraints.map((c) => ({ ...c })) as ContractConstraint[] });
  }
  // ── Schema v6 (section N erratum PE-0013-01; rulings D146, D162, D166): T-43 `core_media_store`,
  // `alerts.reason` with its CHECK, and the key-id form of `transcript_revisions_key_id_check`
  // (contract-v6-delta.ts).
  for (const added of V6.newTables) {
    tables.push({ id: added.id, name: added.name, columns: added.columns.map((c) => ({ ...c })), constraints: added.constraints.map((c) => ({ ...c })) as ContractConstraint[] });
  }
  // ── Schema v7 (schema set A of task 4, contract revision dbc-8): T-44 `capture_device_streams`,
  // T-45 `capture_audio_inputs`, `session_capture_sources.source_facts` with three CHECKs, the six
  // slot columns of `capture_config` nullable with `capture_config_slot_pair_check`, and two value
  // sets (contract-v7-delta.ts).
  Object.assign(valueSets, V7.valueSets);
  for (const added of V7.newTables) {
    tables.push({ id: added.id, name: added.name, columns: added.columns.map((c) => ({ ...c })), constraints: added.constraints.map((c) => ({ ...c })) as ContractConstraint[] });
  }
  for (const change of V7.nullableColumns) {
    const table = tables.find((candidate) => candidate.name === change.table);
    if (table === undefined) throw new Error(`dbc-8 delta: the composed inventory has no table ${change.table}`);
    const mutable = table as unknown as { columns: ContractColumn[] };
    for (const name of change.columns) {
      const position = mutable.columns.findIndex((column) => column.name === name);
      const column = mutable.columns[position];
      if (column === undefined || !column.notNull) throw new Error(`dbc-8 delta: ${change.table}.${name} is not a NOT NULL column of the composed inventory`);
      mutable.columns[position] = { ...column, notNull: false };
    }
  }
  // ── Schema v8 (schema set B of task 4, contract revision dbc-9): T-46 `capture_network_config`,
  // T-47 `host_network_aliases`, the columns `usb_serial` and `usb_port` of `capture_audio_inputs`
  // with their two CHECKs, and two value sets (contract-v8-delta.ts).
  Object.assign(valueSets, V8.valueSets);
  for (const added of V8.newTables) {
    tables.push({ id: added.id, name: added.name, columns: added.columns.map((c) => ({ ...c })), constraints: added.constraints.map((c) => ({ ...c })) as ContractConstraint[] });
  }
  // ── Schema v9 (task 4 package X-C, contract revision dbc-10): the value `CREDENTIAL_REPLACED` in
  // the session-end reasons and in the biometric-revoke reasons; the two CHECKs that name the sets
  // keep their names (contract-v9-delta.ts). No table, no column.
  Object.assign(valueSets, V9.valueSets);
  // ── Schema v10 (task 4 requirement AD-06 (4), contract revision dbc-11): one CHECK on the
  // elements of `capture_devices.profiles` (contract-v10-delta.ts). No table, no column, no set.
  // ── Schema v11 (schema set C of task 4, contract revision dbc-12): T-48
  // `installation_acceptances`, with the partial unique index that holds one acceptance in force
  // (contract-v11-delta.ts). No value set.
  for (const added of V11.newTables) {
    tables.push({ id: added.id, name: added.name, columns: added.columns.map((c) => ({ ...c })), constraints: added.constraints.map((c) => ({ ...c })) as ContractConstraint[] });
  }
  // ── Schema v12 (task 4 decisions C74 D-2 / D-3, contract revision dbc-13): the values `SHUTDOWN`
  // and `NOT_ADDED` in the removal reasons of a temporary host address; the CHECK that names the
  // set keeps its name (contract-v12-delta.ts). No table, no column.
  Object.assign(valueSets, V12.valueSets);
  // ── Schema v13 (task 4 caution R119-05 (d), decision C94 (d), contract revision dbc-14): the
  // value `ADD_UNCONFIRMED` in the same set; the CHECK keeps its name (contract-v13-delta.ts).
  // No table, no column.
  Object.assign(valueSets, V13.valueSets);
  for (const change of [...V2.changedTables, ...V3.changedTables, ...V6.changedTables, ...V7.changedTables, ...V8.changedTables, ...V9.changedTables, ...V10.changedTables, ...V12.changedTables, ...V13.changedTables]) {
    const table = tables.find((candidate) => candidate.name === change.name);
    if (table === undefined) throw new Error(`dbc-3/dbc-4 delta: the composed inventory has no table ${change.name}`);
    const mutable = table as unknown as { columns: ContractColumn[]; constraints: ContractConstraint[] };
    for (const column of change.addColumns) if (!mutable.columns.some((c) => c.name === column.name)) mutable.columns.push({ ...column });
    for (const dropped of change.dropConstraints) mutable.constraints = mutable.constraints.filter((c) => c.name !== dropped);
    for (const constraint of change.addConstraints) {
      mutable.constraints = mutable.constraints.filter((c) => c.name !== constraint.name);
      mutable.constraints.push({ ...constraint } as ContractConstraint);
    }
  }

  const all = tables.flatMap((table) => table.constraints);
  const count = (kind: ConstraintKind): number => all.filter((constraint) => constraint.kind === kind).length;
  return {
    source: 'docs/2026-10-04_dems_backend_rbac_pairing/masterplan/03_database_contract.md (sections 2.4 and 4) composed with docs/2026-10-07_dems_real_capture_sealing/masterplan/04_database_contract.md (dbc-3 sections A.2, B, C, E.3; delta module contract-v2-delta.ts; dbc-4 section N; delta module contract-v3-delta.ts; erratum PE-129b-01; delta module contract-v5-delta.ts; erratum PE-0013-01; delta module contract-v6-delta.ts; task 4 schema set A, docs/2026-10-12_input_av_core_adapter_plan/masterplan/03_db_schema_extension.md sections 2.1 to 2.3 with 04_design_addendum.md sections 1.4 and 7.2; delta module contract-v7-delta.ts; task 4 schema set B, the same document sections 2.4 and 2.5; delta module contract-v8-delta.ts; task 4 package X-C, docs/2026-10-12_input_av_core_adapter_plan/masterplan/05_design_x1_x2.md section 3.6; delta module contract-v9-delta.ts; task 4 requirement AD-06 (4), docs/2026-10-12_input_av_core_adapter_plan/verification/04_security_addendum.md; delta module contract-v10-delta.ts; task 4 schema set C, docs/2026-10-12_input_av_core_adapter_plan/masterplan/03_db_schema_extension.md section 2.6; delta module contract-v11-delta.ts; task 4 honest removal reasons of a temporary host address, docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md C74 D-2 and D-3; delta module contract-v12-delta.ts; task 4 further removal reason ADD_UNCONFIRMED, docs/2026-10-12_input_av_core_adapter_plan/verification/119_commissioning_security.md caution R119-05 answer (d) with decisions/decisions.md C94 (d); delta module contract-v13-delta.ts)',
    valueSets,
    formats,
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

export function readContract(): ContractInventory {
  return parseContract(readFileSync(CONTRACT_FILE, 'utf8'));
}

export function readInventory(): ContractInventory {
  return JSON.parse(readFileSync(INVENTORY_FILE, 'utf8')) as ContractInventory;
}

export function serialise(inventory: ContractInventory): string {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inventory = readContract();
  if (process.argv.includes('--write')) writeFileSync(INVENTORY_FILE, serialise(inventory));
  process.stdout.write(`${JSON.stringify(inventory.counts)}\n`);
}
