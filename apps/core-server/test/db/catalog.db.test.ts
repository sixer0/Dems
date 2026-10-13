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
import { readInventory, type ContractTable } from './contract-inventory';

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
        // `FOREIGN KEY (a) REFERENCES t(b) ON DELETE RESTRICT`; ON UPDATE NO ACTION is the default and is not printed.
        const body = constraint.definition.replace(/^FOREIGN KEY /, '').replace(/ ON DELETE RESTRICT$/, '');
        if (squeezed(body) !== squeezed(wanted.definition)) lines.push(`${wanted.name}: expected ${wanted.definition}, found ${constraint.definition}`);
        if (constraint.on_delete !== 'r' || constraint.on_update !== 'a') {
          lines.push(`${wanted.name}: expected ON DELETE RESTRICT ON UPDATE NO ACTION (K-2), found ${constraint.on_delete}/${constraint.on_update}`);
        }
      } else {
        const body = constraint.definition.replace(/^(PRIMARY KEY|UNIQUE) /, '');
        if (squeezed(body) !== squeezed(wanted.definition)) lines.push(`${wanted.name}: expected ${wanted.definition}, found ${constraint.definition}`);
      }
    }
  }
  return lines;
}

describe('the live catalog equals the database contract (section 4)', () => {
  it('47 tables, 484 columns, 217 named CHECKs, 46 foreign keys: the difference is empty', async () => {
    const live = await readCatalog();
    const lines = difference(inventory.tables, live);
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
        `  contract: ${JSON.stringify(inventory.counts)}\n` +
        `  catalog : ${JSON.stringify(counts)}\n` +
        `  diff (${lines.length} line(s)): ${lines.length === 0 ? '(empty)' : `\n    ${lines.join('\n    ')}`}`,
    );
    expect(lines).toEqual([]);
    expect(counts).toEqual(inventory.counts);
    // R1 (D44): the closed task-2 totals 30/302/98/25 are the v1 base of the composition; the
    // landed dbc-3 contract is 39 tables (§0.1) plus the R-8 singleton stt_config (T-40).
    // dbc-4 §N.11 (set 4, row 129): +1 table (T-41), +7 columns, +6 CHECKs, +1 foreign key.
    // PE-129b-01 (set 6, row 129b): +1 table (T-42), +10 columns, +7 CHECKs, no foreign key.
    // PE-0013-01 (set 7): +1 table (T-43), +4 columns (3 of T-43, `alerts.reason`), +3 CHECKs.
    // Task 4 schema set A (set 8, dbc-8): +2 tables (T-44, T-45), +21 columns (10 + 10 +
    // `session_capture_sources.source_facts`), +17 CHECKs (7 + 6 + 3 + the slot-pair CHECK), +3 foreign keys.
    // Task 4 schema set B (set 9, dbc-9): +2 tables (T-46, T-47), +23 columns (10 + 11 + the USB
    // serial and port of `capture_audio_inputs`), +18 CHECKs (8 + 8 + 2), +3 foreign keys.
    expect(counts).toMatchObject({ tables: 47, columns: 484, checks: 217, foreignKeys: 46 });
  });

  it('the comparison is not vacuous: a changed inventory produces a difference of each kind', async () => {
    const live = await readCatalog();
    const altered = structuredClone(inventory.tables) as unknown as Array<{
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
    const notNullColumns = inventory.tables.reduce((sum, table) => sum + table.columns.filter((column) => column.notNull).length, 0);
    expect(byType).toEqual({ c: 217, f: 46, n: notNullColumns, p: 47, u: 16 });
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
  /** The body between the dollar quotes of `CREATE FUNCTION public.<name>(` in a migration file. */
  const bodyOf = (tag: string, name: string): string => {
    const text = migration(tag);
    const start = text.indexOf(`CREATE FUNCTION public.${name}(`);
    const open = text.indexOf('AS $$', start);
    const close = text.indexOf('$$;', open + 5);
    expect(start >= 0 && open > start && close > open, name).toBe(true);
    return text.slice(open + 5, close);
  };

  it('7 functions, each with the body of its migration file (GD-13), the language, the security mode and the settings of the contract', async () => {
    const { rows } = await db.ownerPool().query(
      `SELECT p.proname::text AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
              pg_get_function_result(p.oid) AS result, l.lanname::text AS language, p.prosecdef AS security_definer,
              p.provolatile::text AS volatility, p.proparallel::text AS parallel, p.proconfig AS settings,
              pg_get_userbyid(p.proowner)::text AS owner, p.prosrc AS body
         FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
        WHERE p.pronamespace = 'public'::regnamespace ORDER BY 1`,
    );
    const pinned = ['search_path=pg_catalog, public, pg_temp'];
    expect(rows).toEqual([
      { name: 'audit_chain_history_refuse_change', arguments: '', result: 'trigger', language: 'plpgsql', security_definer: false, volatility: 'v', parallel: 'u', settings: null, owner: 'dems_owner', body: bodyOf('0002_audit_guards', 'audit_chain_history_refuse_change') },
      { name: 'audit_chain_lock', arguments: '', result: 'TABLE(seq bigint, hash text)', language: 'sql', security_definer: true, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0002_audit_guards', 'audit_chain_lock') },
      { name: 'audit_log_guard_insert', arguments: '', result: 'trigger', language: 'plpgsql', security_definer: true, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0002_audit_guards', 'audit_log_guard_insert') },
      { name: 'audit_log_refuse_change', arguments: '', result: 'trigger', language: 'plpgsql', security_definer: false, volatility: 'v', parallel: 'u', settings: null, owner: 'dems_owner', body: bodyOf('0002_audit_guards', 'audit_log_refuse_change') },
      // The two write-only secret reveal functions of dbc-3 §B.3/§B.13 (SEC35-02, Q-SEC-3 default).
      { name: 'dems_capture_credential_reveal', arguments: 'p_device_id text', result: 'TABLE(username text, encryption text, secret_ciphertext bytea, nonce bytea, key_ref text)', language: 'sql', security_definer: true, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0005_capture_privileges', 'dems_capture_credential_reveal') },
      { name: 'dems_jsonb_is_flat', arguments: 'doc jsonb', result: 'boolean', language: 'sql', security_definer: false, volatility: 'i', parallel: 's', settings: null, owner: 'dems_owner', body: bodyOf('0000_prelude', 'dems_jsonb_is_flat') },
      { name: 'dems_stt_credential_reveal', arguments: '', result: 'TABLE(credential_kind text, credential_ref text, secret_ciphertext bytea, nonce bytea)', language: 'sql', security_definer: true, volatility: 'v', parallel: 'u', settings: pinned, owner: 'dems_owner', body: bodyOf('0007_stt_config_privileges', 'dems_stt_credential_reveal') },
    ]);
  });

  it('T-AO-2d: 3 triggers, each with tgenabled = A (ENABLE ALWAYS), and no other trigger in the schema', async () => {
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
  it('schema public holds tables, their indexes and seven functions: no sequence, view, enum or domain', async () => {
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
    expect(Object.fromEntries(rows.map((row) => [row.kind, Number(row.total)]))).toEqual({ i: 93, r: 47 });
  });

  it('every table has exactly one primary key; a single-row table has the key singleton with default true and CHECK (singleton)', async () => {
    const singletons = inventory.tables.filter((table) => table.columns[0]?.name === 'singleton').map((table) => table.name);
    expect(singletons.sort()).toEqual(
      ['active_session', 'audit_chain_head', 'capture_config', 'console_settings', 'core_device', 'core_state',
        'hardware_snapshot', 'schema_meta', 'storage_policy', 'stt_config', 'core_media_store', 'capture_network_config'].sort(),
    );
    const { rows } = await db.ownerPool().query<{ table_name: string; definition: string }>(
      "SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype = 'p' ORDER BY 1",
    );
    expect(rows).toHaveLength(47);
    expect(new Set(rows.map((row) => row.table_name)).size).toBe(47);
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
    expect(types).toEqual(['bigint', 'boolean', 'bytea', 'double precision', 'integer', 'jsonb', 'smallint', 'text', 'uuid']);
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
