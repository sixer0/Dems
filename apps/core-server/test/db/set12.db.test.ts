// Migration set 12 (`0024_installation_acceptance.sql` +
// `0025_installation_acceptance_privileges.sql`; schema set C of task 4, contract revision
// `dbc-12`, schema version 11; design `docs/2026-10-12_input_av_core_adapter_plan/masterplan/
// 03_db_schema_extension.md` section 2.6; decisions U11 (OQ-2), C2, C9; security finding S13-13):
//
//   T-48 `installation_acceptances`: the record that an installation was accepted, with at most
//   ONE acceptance in force, enforced by the database.
//
//   M12S-1  the pre-state is a genuine (10, 'dbc-11') database that HOLDS ROWS: no table; this
//           code is refused by B-3 naming db:migrate, the code of set 11 is accepted
//   M12S-2  NEGATIVE CONTROL: with 0025 left out the table exists, the runtime role holds nothing
//           on it and the version stays (10, 'dbc-11')
//   M12S-3  set 12 applies exactly its two files, REWRITES NO STORED ROW (MG-8), ends at
//           (11, 'dbc-12'); a second run applies nothing (MG-10)
//   M12S-4  as dems_app: an acceptance is written; A SECOND ACCEPTANCE IN FORCE IS REFUSED BY THE
//           DATABASE (23505); it is revoked, and only then is the next one accepted; what was
//           accepted is never rewritten and a row is never removed
//   M12S-5  NO FREE JSON (S13-13): a forbidden key at any depth, an oversized body, an oversized
//           text, a step that is no flat object and diagnostics deeper than a run are refused
//   M12S-6  the other rules of a row: the version, the site, the address, the revocation
//   M12S-7  who accepted and who revoked are operators (23503; ON DELETE RESTRICT)
//   M12S-8  B-3 across the step, in both directions
//   M12S-9  ROLLBACK: the set inside one transaction, rolled back, leaves the catalog, the rows and
//           the version as they were; the undo statement returns an applied database to the
//           catalog of (10, 'dbc-11')
//   M12S-10 the files: 0024 holds no data statement; 0025 is four statements, no blanket form;
//           0021, 0022 and 0023 hash to what a database of set 11 stores (MG-4)
//
// Every database here is a throw-away of this test run (TI-17). The step ids and the member names
// of the two documents are fixture words: the contract of the acceptance operation names the real
// ones (row 116). No value in this file is a credential.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
  INITIAL_MIGRATION_TAGS,
  MIGRATIONS_FOLDER,
  applyMigrations,
  inspectLedger,
  readAppliedMigrations,
  readMigrationSet,
  readSchemaVersion,
} from '../../src/db/commands/migrations';
import { BootCheckError, checkSchemaVersion } from '../../src/db/schema/boot-checks';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../src/db/schema/meta';
import { AUDIT_DETAIL_FORBIDDEN_KEYS } from '../../src/db/schema/value-sets';
import { useTestDatabase, type TestDatabase } from '../helpers/db';
import { ACCEPTANCE_REVOKED, T, installationAcceptance, insertRbac, insertRow, json } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0024_installation_acceptance', '0025_installation_acceptance_privileges'] as const;
/** The number of files through set 12: this file stops there, whatever set comes later. */
const THROUGH = 26;
/** The files of the sets after set 12, pending on a database of set 12. */
const LATER: readonly string[] = INITIAL_MIGRATION_TAGS.slice(THROUGH);
const TABLE = 'public.installation_acceptances';
const IN_FORCE = 'installation_acceptances_in_force_key';
const SET_11 = { schemaVersion: 10, contractRevision: 'dbc-11' } as const;
const SET_12 = { schemaVersion: 11, contractRevision: 'dbc-12' } as const;
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set12-'));
  temporary.push(folder);
  mkdirSync(join(folder, 'meta'));
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
  writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }));
  for (const tag of INITIAL_MIGRATION_TAGS.slice(0, count)) cpSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), join(folder, `${tag}.sql`));
  return folder;
}

const isThisCode = (pair: { schemaVersion: number; contractRevision: string }): boolean =>
  pair.schemaVersion === DB_SCHEMA_VERSION && pair.contractRevision === DB_CONTRACT_REVISION;

/**
 * Applies the first `count` files and expects the database at `pair`. While a later set exists the
 * applier commits the files and then reports that the version is not this code's; when `pair` IS
 * this code's pair it reports nothing. Either way the files are applied and the pair is asserted.
 */
async function migrateThrough(pool: Pool, count: number, pair: { schemaVersion: number; contractRevision: string }): Promise<void> {
  const error = await applyMigrations(pool, folderOf(count)).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  if (isThisCode(pair)) expect(error).toBeUndefined();
  else expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
  expect(await readSchemaVersion(pool)).toEqual(pair);
}

const outcome = (pending: Promise<{ rowCount: number | null }>): Promise<string> =>
  pending.then(
    (result) => `ok:${result.rowCount}`,
    (error: { code?: string }) => error.code ?? 'error',
  );

/** The statements of one migration file, as the migrator splits them. */
const chunksOf = (tag: string): string[] =>
  readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
    .split('--> statement-breakpoint')
    .filter((chunk) => chunk.trim() !== '');

/** What the tables that existed before the set hold, as digests of whole row images. */
const storedBefore = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT (SELECT count(*)::int FROM public.roles) AS roles,
            (SELECT count(*)::int FROM public.operators) AS operators,
            (SELECT md5(string_agg(to_jsonb(r)::text, '' ORDER BY r.id)) FROM public.roles AS r) AS role_rows,
            (SELECT md5(string_agg(to_jsonb(o)::text, '' ORDER BY o.id)) FROM public.operators AS o) AS operator_rows,
            (SELECT md5(string_agg(to_jsonb(p)::text, '' ORDER BY p.role_id, p.permission_id)) FROM public.role_permissions AS p) AS grant_rows`,
  )).rows;
const objects = "SELECT count(*)::int AS objects FROM pg_class WHERE relnamespace = 'public'::regnamespace";

/** The catalog of schema `public` as one digest (columns, keys and CHECKs, indexes, privileges of the runtime role). */
const catalogDigest = async (owner: Pool): Promise<{ lines: number; digest: string }> =>
  (await owner.query<{ lines: number; digest: string }>(
    `SELECT count(*)::int AS lines, md5(string_agg(line, E'\\n' ORDER BY line)) AS digest FROM (
       SELECT 'column ' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '-') AS line
         FROM information_schema.columns WHERE table_schema = 'public'
       UNION ALL
       SELECT 'constraint ' || conrelid::regclass::text || ' ' || conname || ' ' || pg_get_constraintdef(oid)
         FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype IN ('p', 'u', 'f', 'c')
       UNION ALL
       SELECT 'index ' || indexdef FROM pg_indexes WHERE schemaname = 'public'
       UNION ALL
       SELECT 'table grant ' || table_name || ' ' || privilege_type FROM information_schema.table_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
       UNION ALL
       SELECT 'column grant ' || table_name || '.' || column_name || ' ' || privilege_type FROM information_schema.column_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
     ) AS catalog`,
  )).rows[0] ?? { lines: 0, digest: '' };

const tablePresent = async (pool: Pool): Promise<boolean> =>
  ((await pool.query<{ present: boolean }>(`SELECT to_regclass('${TABLE}') IS NOT NULL AS present`)).rows[0]?.present ?? false) === true;
/** The acceptances in force, and all of them, as counts. */
const held = async (pool: Pool): Promise<unknown> =>
  (await pool.query(`SELECT count(*)::int AS rows, count(*) FILTER (WHERE revoked_at IS NULL)::int AS in_force FROM ${TABLE}`)).rows;

/**
 * THE UNDO OF AN APPLIED SET 12 (schema design 3.5, "Applied, and must be undone"): a NEW forward
 * set that carries this statement and steps the version onward. No precondition is stated by the
 * design. WHAT IT LOSES: the acceptance bodies (the audit entries remain, without the body) - so
 * the code that reads an acceptance, and any gate that asks for one, goes in the same release.
 */
const UNDO_SET_12: readonly string[] = ['DROP TABLE public.installation_acceptances'];

/** A (10, dbc-11) database with the roles and the four operators. */
async function seedSetEleven(owner: Pool): Promise<void> {
  await migrateThrough(owner, 24, SET_11);
  await insertRbac(owner);
}

/** A clone for one case, dropped when the case ends (the run keeps few clones alive at a time). */
async function withClone(slug: string, work: (other: TestDatabase) => Promise<void>): Promise<void> {
  const other = await db.another({ template: EMPTY_DATABASE, slug });
  try {
    await work(other);
  } finally {
    await other.drop();
  }
}

const owner = (): Pool => db.ownerPool();

describe('M12S-1: the pre-state, a (10, dbc-11) database that holds rows', () => {
  it('twenty-four files applied, set 12 pending, no table; this code is refused by B-3 and the code of set 11 passes', async () => {
    await seedSetEleven(owner());
    const ledger = await inspectLedger(owner());
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner(), folderOf(THROUGH))).pending).toEqual([...TAGS]);
    expect(await tablePresent(owner())).toBe(false);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    // The pair this code expects is read from its constants: it moves with every later set.
    expect((error as BootCheckError).message).toBe(
      `B-3: the database is at schema version 10 (dbc-11); this server expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
    await expect(checkSchemaVersion(db.appPool(), SET_11)).resolves.toBeUndefined();
  });

  it('THE STATE THAT IS MISSING: an acceptance has no place - the statement that would write one answers 42P01', async () => {
    expect(await storedBefore(owner())).toMatchObject([{ roles: 3, operators: 4 }]);
    await expectRefused(() => insertRow(db.appPool(), 'installation_acceptances', installationAcceptance()), '42P01');
  });
});

describe('M12S-2: NEGATIVE CONTROL - without 0025 the runtime role holds nothing on the table', () => {
  it('0024 alone: the table exists, SELECT and INSERT answer 42501, the version stays (10, dbc-11)', async () => {
    await withClone('set12_no0025', async (other) => {
      await seedSetEleven(other.ownerPool());
      await migrateThrough(other.ownerPool(), 25, SET_11);
      expect(await tablePresent(other.ownerPool())).toBe(true);
      await expectRefused(() => other.appPool().query(`SELECT 1 FROM ${TABLE}`), SQLSTATE.insufficientPrivilege);
      await expectRefused(() => insertRow(other.appPool(), 'installation_acceptances', installationAcceptance()), SQLSTATE.insufficientPrivilege);
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expect(checkSchemaVersion(other.appPool(), SET_11)).resolves.toBeUndefined();
    });
  });
});

describe('M12S-3: set 12 applies its two files and rewrites no stored row', () => {
  it('db:migrate applies exactly 0024 and 0025 and steps the version to (11, dbc-12); the ledger holds twenty-six files; three new objects; every stored row is what it was', async () => {
    const rowsBefore = await storedBefore(owner());
    const objectsBefore = (await owner().query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    const folder = folderOf(THROUGH);
    expect(await readSchemaVersion(owner())).toEqual(SET_11);
    expect((await inspectLedger(owner(), folder)).pending).toEqual([...TAGS]);
    await migrateThrough(owner(), THROUGH, SET_12);
    const ledger = await inspectLedger(owner(), folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner())).toHaveLength(THROUGH);
    // Exactly three new objects: the table, the index of its primary key, and the partial unique
    // index that holds one acceptance in force.
    expect((await owner().query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore + 3);
    // MG-8: nothing was rewritten and nothing was written: the table is empty.
    expect(await storedBefore(owner())).toEqual(rowsBefore);
    expect(await held(owner())).toEqual([{ rows: 0, in_force: 0 }]);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const before = await readAppliedMigrations(owner());
    const catalogBefore = await catalogDigest(owner());
    await applyMigrations(owner(), folderOf(THROUGH)).catch(() => undefined);
    expect(await readSchemaVersion(owner())).toEqual(SET_12);
    expect(await readAppliedMigrations(owner())).toEqual(before);
    expect(await catalogDigest(owner())).toEqual(catalogBefore);
  });

  it('the table has thirteen columns, in the order of the design; the two documents are jsonb with NO default (an acceptance without them is not one)', async () => {
    const { rows } = await owner().query<{ name: string; type: string; nullable: string; fallback: string | null }>(
      "SELECT column_name::text AS name, data_type::text AS type, is_nullable::text AS nullable, column_default::text AS fallback FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'installation_acceptances' ORDER BY ordinal_position",
    );
    expect(rows).toEqual([
      { name: 'id', type: 'uuid', nullable: 'NO', fallback: 'gen_random_uuid()' },
      { name: 'accepted_at', type: 'bigint', nullable: 'NO', fallback: null },
      { name: 'accepted_by', type: 'text', nullable: 'NO', fallback: null },
      { name: 'software_version', type: 'text', nullable: 'NO', fallback: null },
      { name: 'core_device_id', type: 'text', nullable: 'NO', fallback: null },
      { name: 'site_name', type: 'text', nullable: 'NO', fallback: null },
      { name: 'room', type: 'text', nullable: 'NO', fallback: null },
      { name: 'site_address', type: 'text', nullable: 'YES', fallback: null },
      { name: 'steps', type: 'jsonb', nullable: 'NO', fallback: null },
      { name: 'diagnostics', type: 'jsonb', nullable: 'NO', fallback: null },
      { name: 'revoked_at', type: 'bigint', nullable: 'YES', fallback: null },
      { name: 'revoked_by', type: 'text', nullable: 'YES', fallback: null },
      { name: 'revoke_reason', type: 'text', nullable: 'YES', fallback: null },
    ]);
  });
});

describe('M12S-4: one acceptance in force, enforced by the database', () => {
  const REVOKE = `UPDATE ${TABLE} SET revoked_at = $1, revoked_by = $2, revoke_reason = $3 WHERE revoked_at IS NULL`;

  it('as dems_app: an acceptance is written; its id is the database\'s; it is in force', async () => {
    const app = db.appPool();
    await insertRow(app, 'installation_acceptances', installationAcceptance({ accepted_by: 'OPR-003' }));
    const { rows } = await app.query<{ id: string; accepted_by: string; steps: unknown[]; checks: number }>(
      `SELECT id, accepted_by, steps, jsonb_array_length(diagnostics -> 'checks') AS checks FROM ${TABLE}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(rows[0]?.accepted_by).toBe('OPR-003');
    expect(rows[0]?.steps).toHaveLength(2);
    expect(rows[0]?.checks).toBe(1);
    expect(await held(owner())).toEqual([{ rows: 1, in_force: 1 }]);
  });

  it('A SECOND ACCEPTANCE IN FORCE IS REFUSED BY THE DATABASE (23505) - by another operator, at another time, with other content, as the owner too', async () => {
    const app = db.appPool();
    await expectRefused(() => insertRow(app, 'installation_acceptances', installationAcceptance()), SQLSTATE.uniqueViolation, IN_FORCE);
    await expectRefused(() => insertRow(app, 'installation_acceptances', installationAcceptance({ accepted_by: 'OPR-002', accepted_at: T + 60_000, software_version: '0.7.0', room: 'R-4' })), SQLSTATE.uniqueViolation, IN_FORCE);
    await expectRefused(() => insertRow(owner(), 'installation_acceptances', installationAcceptance({ accepted_at: T + 120_000 })), SQLSTATE.uniqueViolation, IN_FORCE);
    expect(await held(owner())).toEqual([{ rows: 1, in_force: 1 }]);
  });

  it('TWO ACCEPTANCES AT THE SAME MOMENT: of two transactions that each write one, exactly one commits', async () => {
    await withClone('set12_race', async (other) => {
      const pool = other.ownerPool();
      await migrateThrough(pool, THROUGH, SET_12);
      await insertRbac(pool);
      const first = await other.appPool().connect();
      const second = await other.appPool().connect();
      try {
        await first.query('BEGIN');
        await second.query('BEGIN');
        await insertRow(first, 'installation_acceptances', installationAcceptance({ accepted_by: 'OPR-001' }));
        // The second insert waits for the first transaction: the index entry is not yet decided.
        const waiting = insertRow(second, 'installation_acceptances', installationAcceptance({ accepted_by: 'OPR-002' })).then(
          () => 'ok',
          (error: { code?: string; constraint?: string }) => `${error.code}:${error.constraint}`,
        );
        await first.query('COMMIT');
        expect(await waiting).toBe(`${SQLSTATE.uniqueViolation}:${IN_FORCE}`);
        await second.query('ROLLBACK');
      } finally {
        first.release();
        second.release();
      }
      expect((await pool.query(`SELECT accepted_by FROM ${TABLE} WHERE revoked_at IS NULL`)).rows).toEqual([{ accepted_by: 'OPR-001' }]);
    });
  });

  it('the acceptance is revoked - when, by whom and why, together - and only then is the next one accepted; the history stays', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(REVOKE, [T + 5_000, 'OPR-003', 'The Core was moved to another room.']))).toBe('ok:1');
    expect(await held(owner())).toEqual([{ rows: 1, in_force: 0 }]);
    await insertRow(app, 'installation_acceptances', installationAcceptance({ accepted_at: T + 10_000, room: 'R-4' }));
    await expectRefused(() => insertRow(app, 'installation_acceptances', installationAcceptance({ accepted_at: T + 11_000 })), SQLSTATE.uniqueViolation, IN_FORCE);
    expect(await outcome(app.query(REVOKE, [T + 20_000, 'OPR-001', 'Accepted in the wrong room.']))).toBe('ok:1');
    await insertRow(app, 'installation_acceptances', installationAcceptance({ accepted_at: T + 30_000 }));
    expect((await owner().query(`SELECT room, revoked_by, revoke_reason FROM ${TABLE} ORDER BY accepted_at`)).rows).toEqual([
      { room: 'R-3', revoked_by: 'OPR-003', revoke_reason: 'The Core was moved to another room.' },
      { room: 'R-4', revoked_by: 'OPR-001', revoke_reason: 'Accepted in the wrong room.' },
      { room: 'R-3', revoked_by: null, revoke_reason: null },
    ]);
    // Any number of revoked rows, one in force; and a row may be written already revoked (a restore).
    await insertRow(app, 'installation_acceptances', installationAcceptance({ ...ACCEPTANCE_REVOKED, accepted_at: T - 100_000, revoked_at: T - 50_000 }));
    expect(await held(owner())).toEqual([{ rows: 4, in_force: 1 }]);
  });

  it('what was accepted is never rewritten, and a row is never removed (42501)', async () => {
    const app = db.appPool();
    for (const assignment of ["accepted_by = 'OPR-002'", 'accepted_at = 1', "software_version = '9.9.9'", "core_device_id = 'OTHER'", "site_name = 'Other'", "room = 'R-9'", "site_address = 'Elsewhere'", "steps = '[]'::jsonb", "diagnostics = '{}'::jsonb", 'id = gen_random_uuid()']) {
      await expectRefused(() => app.query(`UPDATE ${TABLE} SET ${assignment}`), SQLSTATE.insufficientPrivilege);
    }
    await expectRefused(() => app.query(`DELETE FROM ${TABLE}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`TRUNCATE ${TABLE}`), SQLSTATE.insufficientPrivilege);
    expect(
      (await owner().query<{ name: string }>("SELECT attname::text AS name FROM pg_attribute WHERE attrelid = 'public.installation_acceptances'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('dems_app', attrelid, attnum, 'UPDATE') ORDER BY 1")).rows.map((row) => row.name),
    ).toEqual(['revoke_reason', 'revoked_at', 'revoked_by']);
    expect(await held(owner())).toEqual([{ rows: 4, in_force: 1 }]);
  });

  it('the index is unique and partial: it binds the rows in force only', async () => {
    expect(
      (await owner().query("SELECT indexname::text AS name, indexdef LIKE 'CREATE UNIQUE%' AS is_unique, indexdef LIKE '%WHERE (revoked_at IS NULL)' AS in_force_only FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'installation_acceptances' ORDER BY 1")).rows,
    ).toEqual([
      { name: IN_FORCE, is_unique: true, in_force_only: true },
      { name: 'installation_acceptances_pkey', is_unique: true, in_force_only: false },
    ]);
  });
});

describe('M12S-5: NO FREE JSON - the steps and the diagnostics are held by the database (S13-13)', () => {
  // Every row here is a REVOKED one: a CHECK is evaluated before any index, but a revoked row
  // makes it plain that the refusal is the rule's and not the one-in-force index's.
  const revoked = (overrides: Record<string, unknown>) => installationAcceptance({ ...ACCEPTANCE_REVOKED, ...overrides });
  const big = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `STEP_${index + 1}`, passed: true, detail: 'x'.repeat(200), note: 'y'.repeat(200) }));
  const run = (checks: unknown[]) => ({ id: 'DIAG-000002', startedAt: T, completedAt: T + 1, checks });

  it.each(AUDIT_DETAIL_FORBIDDEN_KEYS.map((key) => [key]))('A FORBIDDEN KEY IS REFUSED (23514), in a step and at the fourth level of the diagnostics: %s', async (key) => {
    await expectRefused(() => insertRow(db.appPool(), 'installation_acceptances', revoked({ steps: json([{ id: 'A', [key]: 'x' }]) })), SQLSTATE.checkViolation, 'installation_acceptances_steps_no_secret_keys_check');
    await expectRefused(() => insertRow(db.appPool(), 'installation_acceptances', revoked({ diagnostics: json(run([{ id: 'A', params: { [key]: 'x' } }])) })), SQLSTATE.checkViolation, 'installation_acceptances_diagnostics_no_secret_keys_check');
  });

  it('the twenty-eight names are the denied names of an audit detail, and a forbidden key is refused at EVERY level of the diagnostics', async () => {
    expect(AUDIT_DETAIL_FORBIDDEN_KEYS).toHaveLength(28);
    const app = db.appPool();
    for (const diagnostics of [{ password: 'x' }, { checks: [{ password: 'x' }] }, { a: { password: 'x' } }, { checks: [{ params: { password: 'x' } }] }]) {
      await expectRefused(() => insertRow(app, 'installation_acceptances', revoked({ diagnostics: json(diagnostics) })), SQLSTATE.checkViolation, 'installation_acceptances_diagnostics_no_secret_keys_check');
    }
  });

  it('a NEAR name is no forbidden key: `tokens`, `passwordAge`, `Password`, `my_code` are accepted (the rule is the exact name, as it is for an audit detail)', async () => {
    await insertRow(db.appPool(), 'installation_acceptances', revoked({ accepted_at: T - 1, steps: json([{ id: 'A', tokens: 2, passwordAge: 3, Password: 'no', my_code: 'X' }]) }));
  });

  it.each([
    ['AN OVERSIZED BODY of steps: 32 flat steps, every text within its bound, more than 8,192 bytes together', { steps: json(big(32)) }, 'installation_acceptances_steps_bound_check'],
    ['AN OVERSIZED BODY of diagnostics: 100 checks, every text within its bound, more than 16,384 bytes together', { diagnostics: json(run(Array.from({ length: 100 }, (_, index) => ({ id: `C${index}`, detail: 'x'.repeat(200) })))) }, 'installation_acceptances_diagnostics_bound_check'],
    ['a text of 201 characters in a step', { steps: json([{ id: 'A', detail: 'x'.repeat(201) }]) }, 'installation_acceptances_steps_bound_check'],
    ['a text of 201 characters at the fourth level of the diagnostics', { diagnostics: json(run([{ id: 'A', params: { note: 'x'.repeat(201) } }])) }, 'installation_acceptances_diagnostics_bound_check'],
    ['a line break in a text of a step', { steps: json([{ id: 'A', detail: 'line one\nline two' }]) }, 'installation_acceptances_steps_bound_check'],
    ['an escape sequence in a text of the diagnostics', { diagnostics: json(run([{ id: 'A', detail: 'ok\u001b[2J' }])) }, 'installation_acceptances_diagnostics_bound_check'],
    ['33 steps', { steps: json(Array.from({ length: 33 }, (_, index) => ({ id: `S${index}` }))) }, 'installation_acceptances_steps_check'],
    ['a step that is a text', { steps: json(['CAMERAS_ASSIGNED']) }, 'installation_acceptances_steps_check'],
    ['a step that is a list', { steps: json([[{ id: 'A' }]]) }, 'installation_acceptances_steps_check'],
    ['a step that is a JSON null', { steps: json([null]) }, 'installation_acceptances_steps_check'],
    ['a step that holds a map (not flat)', { steps: json([{ id: 'A', more: { nested: true } }]) }, 'installation_acceptances_steps_check'],
    ['a step that holds a list (not flat)', { steps: json([{ id: 'A', more: [1, 2] }]) }, 'installation_acceptances_steps_check'],
    ['steps that are a map (free JSON)', { steps: json({ CAMERAS_ASSIGNED: true }) }, 'installation_acceptances_steps_check'],
    ['steps that are a text', { steps: json('all passed') }, 'installation_acceptances_steps_check'],
    ['steps that are a JSON null', { steps: json(null) }, 'installation_acceptances_steps_check'],
    ['diagnostics that are a list', { diagnostics: json([{ id: 'A' }]) }, 'installation_acceptances_diagnostics_check'],
    ['diagnostics that are a text', { diagnostics: json('ok') }, 'installation_acceptances_diagnostics_check'],
    ['diagnostics that are a JSON null', { diagnostics: json(null) }, 'installation_acceptances_diagnostics_check'],
    ['diagnostics one level deeper than a run (a map inside the params of a check)', { diagnostics: json(run([{ id: 'A', params: { more: { nested: 1 } } }])) }, 'installation_acceptances_diagnostics_check'],
    ['diagnostics five maps deep', { diagnostics: json({ a: { b: { c: { d: { e: 1 } } } } }) }, 'installation_acceptances_diagnostics_check'],
  ])('refused (23514): %s', async (_what, overrides, constraint) => {
    await expectRefused(() => insertRow(db.appPool(), 'installation_acceptances', revoked(overrides)), SQLSTATE.checkViolation, constraint);
  });

  it('the bounds of the rules are taken: no step and 32 steps; a text of 200 characters; empty diagnostics and a run four levels deep; bodies just under their byte bounds', async () => {
    const app = db.appPool();
    const thirtyTwo = Array.from({ length: 32 }, (_, index) => ({ id: `STEP_${index + 1}`, passed: index % 2 === 0, detail: null }));
    await insertRow(app, 'installation_acceptances', revoked({ accepted_at: T - 2, steps: json([]), diagnostics: json({}) }));
    await insertRow(app, 'installation_acceptances', revoked({ accepted_at: T - 3, steps: json(thirtyTwo), diagnostics: json(run([{ id: 'A', label: 'x'.repeat(200), status: 'PASS', detail: null, params: { cpuPercent: 3, ok: true, none: null } }])) }));
    // Close under the byte bounds, as the database counts them (its text form of a document has a
    // blank after every colon and comma): 17 steps of two 200-character texts, 68 checks of one.
    const nearSteps = big(17);
    const nearDiagnostics = run(Array.from({ length: 68 }, (_, index) => ({ id: `C${index}`, detail: 'x'.repeat(200) })));
    expect(Buffer.byteLength(JSON.stringify(nearSteps))).toBeLessThan(8192);
    expect(Buffer.byteLength(JSON.stringify(nearDiagnostics))).toBeLessThan(16384);
    await insertRow(app, 'installation_acceptances', revoked({ accepted_at: T - 4, steps: json(nearSteps), diagnostics: json(nearDiagnostics) }));
    const measured = (await owner().query<{ most_steps: number; steps_bytes: number; diagnostics_bytes: number }>(`SELECT max(jsonb_array_length(steps)) AS most_steps, max(octet_length(steps::text)) AS steps_bytes, max(octet_length(diagnostics::text)) AS diagnostics_bytes FROM ${TABLE}`)).rows[0];
    expect(measured?.most_steps).toBe(32);
    // More than nine tenths of each bound was stored, and no more than the bound.
    expect(measured?.steps_bytes).toBeGreaterThan(7_400);
    expect(measured?.steps_bytes).toBeLessThanOrEqual(8_192);
    expect(measured?.diagnostics_bytes).toBeGreaterThan(14_800);
    expect(measured?.diagnostics_bytes).toBeLessThanOrEqual(16_384);
  });
});

describe('M12S-6: the other rules of a row', () => {
  const revoked = (overrides: Record<string, unknown>) => installationAcceptance({ ...ACCEPTANCE_REVOKED, ...overrides });

  it.each([
    ['an empty software version', { software_version: '' }, 'installation_acceptances_software_version_check'],
    ['a software version of 65 characters', { software_version: '9'.repeat(65) }, 'installation_acceptances_software_version_check'],
    ['a software version with a line break', { software_version: '0.6.0\nrm' }, 'installation_acceptances_software_version_check'],
    ['an empty Core id', { core_device_id: '' }, 'installation_acceptances_site_check'],
    ['an empty site name', { site_name: '' }, 'installation_acceptances_site_check'],
    ['an empty room', { room: '' }, 'installation_acceptances_site_check'],
    ['a room of 201 characters', { room: 'R'.repeat(201) }, 'installation_acceptances_site_check'],
    ['a site name with a line break', { site_name: 'Ruang\n3' }, 'installation_acceptances_site_check'],
    ['an empty site address (none is NULL, never empty)', { site_address: '' }, 'installation_acceptances_site_address_check'],
    ['a site address of 501 characters', { site_address: 'J'.repeat(501) }, 'installation_acceptances_site_address_check'],
    ['revoked before it was accepted', { revoked_at: T - 1 }, 'installation_acceptances_revoked_at_check'],
    ['revoked without a reason', { revoke_reason: null }, 'installation_acceptances_revoke_check'],
    ['revoked without who revoked it', { revoked_by: null }, 'installation_acceptances_revoke_check'],
    ['a reason and a revoker on an acceptance that is in force', { revoked_at: null }, 'installation_acceptances_revoke_check'],
    ['a reason of 4 characters', { revoke_reason: 'move' }, 'installation_acceptances_revoke_check'],
    ['a reason of 501 characters', { revoke_reason: 'r'.repeat(501) }, 'installation_acceptances_revoke_check'],
  ])('refused (23514): %s', async (_what, overrides, constraint) => {
    await expectRefused(() => insertRow(db.appPool(), 'installation_acceptances', revoked(overrides)), SQLSTATE.checkViolation, constraint);
  });

  it('the bounds are taken: a version of 64 and a room of 200 characters, an address of 500 with line breaks, no address at all, a reason of 5 and of 500 characters, revoked at the instant it was accepted', async () => {
    const app = db.appPool();
    await insertRow(app, 'installation_acceptances', revoked({ accepted_at: T - 5, software_version: `0.6.0+${'b'.repeat(58)}`, room: 'R'.repeat(200), site_address: `${'J'.repeat(249)}\n${'K'.repeat(250)}`, revoke_reason: 'moved', revoked_at: T - 5 }));
    await insertRow(app, 'installation_acceptances', revoked({ accepted_at: T - 6, site_address: null, revoke_reason: 'r'.repeat(500) }));
    await expectRefused(() => db.appPool().query(`UPDATE ${TABLE} SET revoke_reason = NULL WHERE revoked_at IS NOT NULL`), SQLSTATE.checkViolation, 'installation_acceptances_revoke_check');
  });

  it('a column the design requires cannot be left out (23502): the accepter, the version, the site, the steps, the diagnostics', async () => {
    for (const column of ['accepted_at', 'accepted_by', 'software_version', 'core_device_id', 'site_name', 'room', 'steps', 'diagnostics']) {
      await expectRefused(() => insertRow(db.appPool(), 'installation_acceptances', revoked({ [column]: null })), SQLSTATE.notNullViolation);
    }
  });
});

describe('M12S-7: who accepted and who revoked are operators', () => {
  it('an operator that does not exist is refused (23503), and an operator an acceptance names is not removed (ON DELETE RESTRICT)', async () => {
    const app = db.appPool();
    await expectRefused(() => insertRow(app, 'installation_acceptances', installationAcceptance({ ...ACCEPTANCE_REVOKED, accepted_by: 'OPR-999' })), SQLSTATE.foreignKeyViolation, 'installation_acceptances_accepted_by_fkey');
    await expectRefused(() => insertRow(app, 'installation_acceptances', installationAcceptance({ ...ACCEPTANCE_REVOKED, revoked_by: 'OPR-999' })), SQLSTATE.foreignKeyViolation, 'installation_acceptances_revoked_by_fkey');
    await expectRefused(() => owner().query("DELETE FROM public.operators WHERE id = 'OPR-003'"), SQLSTATE.restrictViolation);
  });
});

describe('M12S-8: B-3 across the step, in both directions', () => {
  it('the code of set 11 (10, dbc-11) on the migrated database is refused; the code of set 12 passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_11).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 11 (dbc-12); this server expects 10 (dbc-11)');
    await expect(checkSchemaVersion(db.appPool(), SET_12)).resolves.toBeUndefined();
    // This code passes exactly while set 12 is the last set; with a later set it names db:migrate.
    const here = await checkSchemaVersion(db.appPool()).then(
      () => 'passes',
      () => 'refused',
    );
    expect(here).toBe(isThisCode(SET_12) ? 'passes' : 'refused');
  });
});

describe('M12S-9: rollback', () => {
  it('FAILS WHILE APPLYING: the two files inside one transaction, rolled back before the commit, leave the catalog, the rows, the version and the ledger as they were', async () => {
    await withClone('set12_rollback_tx', async (other) => {
      const pool = other.ownerPool();
      await seedSetEleven(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      const ledgerBefore = await readAppliedMigrations(pool);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const tag of TAGS) for (const chunk of chunksOf(tag)) await client.query(chunk);
        // Inside the transaction the set is in force: the table exists, takes a row, and the version is stepped.
        await insertRow(client, 'installation_acceptances', installationAcceptance());
        expect((await client.query(`SELECT count(*)::int AS rows FROM ${TABLE}`)).rows).toEqual([{ rows: 1 }]);
        expect((await client.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows).toEqual([{ schema_version: 11, contract_revision: 'dbc-12' }]);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      expect(await tablePresent(pool)).toBe(false);
      expect(await readSchemaVersion(pool)).toEqual(SET_11);
      expect(await readAppliedMigrations(pool)).toEqual(ledgerBefore);
      expect((await inspectLedger(pool)).pending).toEqual([...TAGS, ...LATER]);
      await expect(checkSchemaVersion(other.appPool(), SET_11)).resolves.toBeUndefined();
    });
  });

  it('APPLIED, AND MUST BE UNDONE: the undo statement returns the catalog to the one of (10, dbc-11), every row that existed is what it was, and the code of set 11 starts again - the acceptances written meanwhile are what the undo loses', async () => {
    await withClone('set12_rollback_undo', async (other) => {
      const pool = other.ownerPool();
      await seedSetEleven(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      await migrateThrough(pool, THROUGH, SET_12);
      expect((await catalogDigest(pool)).digest).not.toBe(catalogBefore.digest);
      await insertRow(other.appPool(), 'installation_acceptances', installationAcceptance({ ...ACCEPTANCE_REVOKED }));
      await insertRow(other.appPool(), 'installation_acceptances', installationAcceptance({ accepted_at: T + 10_000 }));
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_12) await client.query(statement);
        // In a delivered forward set the version steps ONWARD; here it is set to the pair of set 11
        // so that the comparison below is with the database as it was.
        await client.query("UPDATE public.schema_meta SET schema_version = 10, contract_revision = 'dbc-11' WHERE singleton");
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      expect(await tablePresent(pool)).toBe(false);
      // The operators the two acceptances named can be removed again: nothing refers to them.
      await expect(checkSchemaVersion(other.appPool(), SET_11)).resolves.toBeUndefined();
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
    });
  });
});

describe('M12S-10: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');

  it('0024 is generated: one CREATE TABLE with eleven CHECKs, two foreign keys, one partial unique index - and no statement that writes a row (MG-2, MG-8)', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toHaveLength(4);
    expect(generated[0]).toMatch(/^CREATE TABLE "installation_acceptances" \(/);
    expect(generated[0]?.match(/CONSTRAINT "installation_acceptances_[a-z_]+_check" CHECK/g)).toHaveLength(11);
    expect(generated.slice(1).map((statement) => /^(?:ALTER TABLE "[a-z_]+" ADD CONSTRAINT|CREATE UNIQUE INDEX) "([a-z0-9_]+)"/.exec(statement)?.[1])).toEqual([
      'installation_acceptances_accepted_by_fkey',
      'installation_acceptances_revoked_by_fkey',
      IN_FORCE,
    ]);
    expect(generated[3]).toBe('CREATE UNIQUE INDEX "installation_acceptances_in_force_key" ON "installation_acceptances" USING btree (("revoked_at" IS NULL)) WHERE "installation_acceptances"."revoked_at" IS NULL;');
    // The two foreign keys state their referential actions; apart from those words, no statement names a write.
    const text = generated.join(' ').replaceAll('ON DELETE restrict ON UPDATE no action', '');
    expect(generated.join(' ').split('ON DELETE restrict ON UPDATE no action')).toHaveLength(3);
    expect(text).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/);
    expect(text).not.toMatch(/NOT VALID|bytea|DROP TABLE|DROP COLUMN|DROP CONSTRAINT|DROP NOT NULL/i);
    // The two documents are the only jsonb columns, and neither has a default.
    expect(text).toContain('"steps" jsonb NOT NULL, "diagnostics" jsonb NOT NULL,');
    // Every one of the 28 denied names stands in the path of both documents.
    for (const key of AUDIT_DETAIL_FORBIDDEN_KEYS) expect(text.split(new RegExp(`[(|]${key}[|)]`)).length, key).toBe(3);
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[0]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('0025 is hand-written: two grants, one boundary revoke and the version row; no blanket form, no role but dems_app', () => {
    const written = statementsOf(TAGS[1]);
    expect(written).toEqual([
      'GRANT SELECT, INSERT ON installation_acceptances TO dems_app;',
      'GRANT UPDATE (revoked_at, revoked_by, revoke_reason) ON installation_acceptances TO dems_app;',
      'REVOKE DELETE, TRUNCATE ON installation_acceptances FROM dems_app;',
      "UPDATE public.schema_meta SET schema_version = 11, contract_revision = 'dbc-12' WHERE singleton;",
    ]);
    expect(written.join(' ')).not.toMatch(/ALL\s+TABLES/i);
    expect(written.join(' ')).not.toMatch(/dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER/i);
  });

  it('0021, 0022 and 0023 hash to what a database of set 11 stores: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0021_profile_codes_data']).toBe('dca5adaf49161879058951bfb2f68ec0be878308206464b6246a9f84237f4095');
    expect(hashes['0022_profile_codes']).toBe('0770ece3fad095d3419dddf767a5a65b534eadc6d27cf818312c0d66e84e470c');
    expect(hashes['0023_profile_codes_privileges']).toBe('700975f3b7ccf8ec59d9602c7f096c3d06b06cfacfb0ec082c27f6750def955b');
  });
});
