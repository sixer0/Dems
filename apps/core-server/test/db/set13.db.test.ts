// Migration set 13 (`0026_alias_removal_reasons.sql` + `0027_alias_removal_reasons_privileges.sql`;
// task 4, contract revision `dbc-13`, schema version 12; decisions C74 (D-2, D-3) and C83 of
// `docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md`; security finding S13-10):
//
//   the values `SHUTDOWN` and `NOT_ADDED` in the removal reasons of a temporary host address
//   (`host_network_aliases_remove_reason_check`). No table, no column, no index, no grant.
//
//   M13S-1  the pre-state is a genuine (11, 'dbc-12') database that HOLDS ROWS (operators, two
//           closed aliases - one of them `JOB_DONE` - and one open alias): the two reasons are
//           refused there (23514), this code is refused by B-3 naming db:migrate, the code of
//           set 12 is accepted
//   M13S-2  NEGATIVE CONTROL: with 0027 left out the CHECK admits the values but the version
//           stays (11, 'dbc-12'), so this code does not start on it
//   M13S-3  set 13 applies exactly its two files, REWRITES NO STORED ROW (MG-8; a row closed
//           `JOB_DONE` before the set keeps that word), adds no object and changes no privilege,
//           ends at (12, 'dbc-13'); a second run applies nothing (MG-10)
//   M13S-4  as dems_app: an open alias is closed with `SHUTDOWN`, and a row is closed with
//           `NOT_ADDED` at the moment it was opened; every earlier member still is accepted; a
//           foreign reason is STILL REFUSED; the rules beside the value list hold
//   M13S-5  B-3 across the step, in both directions
//   M13S-6  ROLLBACK: the set inside one transaction, rolled back, leaves the catalog, the rows and
//           the version as they were; the undo statements return an applied database to the
//           catalog of (11, 'dbc-12') and refuse to run while a row holds a new reason
//   M13S-7  the files: 0026 is two statements and writes no row; 0027 is the version row alone;
//           0024 and 0025 hash to what they hashed to when set 12 was delivered (MG-4)
//
// Every database here is a throw-away of this test run (TI-17). No address here is a host's: the
// rows are fixture rows and nothing in this file asks the alias helper or the network anything.
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
import { HOST_ALIAS_REMOVE_REASON } from '../../src/db/schema/value-sets';
import { useTestDatabase, type TestDatabase } from '../helpers/db';
import { T, hostNetworkAlias, insertRbac, insertRow } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0026_alias_removal_reasons', '0027_alias_removal_reasons_privileges'] as const;
/** The number of files through set 13: this file stops there, whatever set comes later. */
const THROUGH = 28;
/** The files of the sets after set 13, pending on a database of set 13. */
const LATER: readonly string[] = INITIAL_MIGRATION_TAGS.slice(THROUGH);
const ALIASES = 'public.host_network_aliases';
const CHECK = 'host_network_aliases_remove_reason_check';
const NEW_REASONS = ['SHUTDOWN', 'NOT_ADDED'] as const;
const SET_12 = { schemaVersion: 11, contractRevision: 'dbc-12' } as const;
const SET_13 = { schemaVersion: 12, contractRevision: 'dbc-13' } as const;
/** The set as it stood before the step, in stored order. */
const REASONS_BEFORE = ['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP'] as const;
const MINUTE = 60_000;
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set13-'));
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

/** What the alias table holds, as a digest of whole row images, with the counts beside it. */
const storedBefore = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT (SELECT count(*)::int FROM ${ALIASES}) AS aliases,
            (SELECT count(*)::int FROM ${ALIASES} WHERE removed_at IS NULL) AS open,
            (SELECT count(*)::int FROM ${ALIASES} WHERE remove_reason = 'JOB_DONE') AS job_done,
            (SELECT md5(string_agg(to_jsonb(a)::text, '' ORDER BY a.added_at, a.address)) FROM ${ALIASES} AS a) AS alias_rows,
            (SELECT md5(string_agg(to_jsonb(o)::text, '' ORDER BY o.id)) FROM public.operators AS o) AS operator_rows`,
  )).rows;
const objects = "SELECT count(*)::int AS objects FROM pg_class WHERE relnamespace = 'public'::regnamespace";

/**
 * The catalog of schema `public` as one digest: every column with type, nullability and default,
 * every key and CHECK with its definition, every index, and every privilege of the runtime role.
 */
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

/** The privileges of the runtime role alone, as one digest: the set must not move it. */
const grantDigest = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT count(*)::int AS lines, md5(string_agg(line, E'\\n' ORDER BY line)) AS digest FROM (
       SELECT 'table grant ' || table_name || ' ' || privilege_type AS line FROM information_schema.table_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
       UNION ALL
       SELECT 'column grant ' || table_name || '.' || column_name || ' ' || privilege_type FROM information_schema.column_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
     ) AS grants`,
  )).rows;

/** The value list the CHECK holds, read back from the catalog. */
const checkedValues = async (pool: Pool): Promise<string[]> => {
  const { rows } = await pool.query<{ definition: string }>(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = '${CHECK}'`);
  return [...(rows[0]?.definition ?? '').matchAll(/'([A-Z_]+)'::text/g)].map((match) => match[1] ?? '');
};

/** The number of CHECKs on the alias table: the set replaces one and adds none. */
const aliasChecks = async (pool: Pool): Promise<number> =>
  (await pool.query<{ checks: number }>(`SELECT count(*)::int AS checks FROM pg_constraint WHERE contype = 'c' AND conrelid = '${ALIASES}'::regclass`)).rows[0]?.checks ?? -1;

/**
 * THE UNDO OF AN APPLIED SET 13 ("applied, and must be undone"). The files of an applied set are
 * never edited and no down file exists in this repository, so an undo is delivered as a NEW
 * forward set that carries these statements and steps the version onward. They are kept here,
 * where a test runs them, so that the rollback is measured and not only described.
 * PRECONDITION: no alias row holds one of the two reasons - the first statement refuses otherwise
 * (and without it the ADD CONSTRAINT statement would answer 23514). A row that holds the reason is
 * history: it is not rewritten into `JOB_DONE` to make an undo pass - that rewrite is exactly the
 * untruth the set was made to end.
 * WHAT IT LOSES: nothing stored. The code that writes the two reasons (the alias journal and the
 * shutdown removal) must go in the same release, or it answers 23514.
 */
const UNDO_SET_13: readonly string[] = [
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.host_network_aliases WHERE remove_reason IN (${NEW_REASONS.map((value) => `'${value}'`).join(', ')})) THEN RAISE EXCEPTION 'an alias row holds the reason SHUTDOWN or NOT_ADDED: the history is not rewritten' USING ERRCODE = 'object_not_in_prerequisite_state'; END IF; END $$`,
  `ALTER TABLE public.host_network_aliases DROP CONSTRAINT ${CHECK}`,
  `ALTER TABLE public.host_network_aliases ADD CONSTRAINT ${CHECK} CHECK ((("host_network_aliases"."remove_reason" IS NULL) = ("host_network_aliases"."removed_at" IS NULL)) AND ("host_network_aliases"."remove_reason" IS NULL OR "host_network_aliases"."remove_reason" IN (${REASONS_BEFORE.map((value) => `'${value}'`).join(', ')})))`,
];
/** SQLSTATE 55000, `object_not_in_prerequisite_state`: what the guard of the undo raises. */
const NOT_IN_PREREQUISITE_STATE = '55000';

/**
 * A (11, dbc-12) database with the rows of M13S-1: the four operators, an alias removed by hand,
 * an alias a job closed (`JOB_DONE`, the word this set stops misusing) and one alias in place.
 */
async function seedSetTwelve(owner: Pool): Promise<void> {
  await migrateThrough(owner, 26, SET_12);
  await insertRbac(owner);
  await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ removed_at: T + 5_000, remove_reason: 'MANUAL', removed_by: 'OPR-001' }));
  await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ address: '192.168.0.253/24', added_at: T + MINUTE, expires_at: T + 31 * MINUTE, removed_at: T + 2 * MINUTE, remove_reason: 'JOB_DONE' }));
  await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ added_at: T + 3 * MINUTE, expires_at: T + 33 * MINUTE }));
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
const closeOpenWith = (pool: Pool, reason: string, at: number): Promise<{ rowCount: number | null }> =>
  pool.query(`UPDATE ${ALIASES} SET removed_at = $1, remove_reason = '${reason}' WHERE removed_at IS NULL`, [at]);

describe('M13S-1: the pre-state, a (11, dbc-12) database that holds rows', () => {
  it('twenty-six files applied, set 13 pending; this code is refused by B-3 and the code of set 12 passes', async () => {
    await seedSetTwelve(owner());
    const ledger = await inspectLedger(owner());
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner(), folderOf(THROUGH))).pending).toEqual([...TAGS]);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    // The pair this code expects is read from its constants: it moves with every later set.
    expect((error as BootCheckError).message).toBe(
      `B-3: the database is at schema version 11 (dbc-12); this server expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
    await expect(checkSchemaVersion(db.appPool(), SET_12)).resolves.toBeUndefined();
  });

  it('rows of the kind a used database holds: three aliases, one in place, one closed JOB_DONE; the CHECK holds the four values', async () => {
    expect(await storedBefore(owner())).toMatchObject([{ aliases: 3, open: 1, job_done: 1 }]);
    expect(await checkedValues(owner())).toEqual([...REASONS_BEFORE]);
  });

  it.each([...NEW_REASONS])('THE STATE THAT IS MISSING: %s is refused (23514) - a removal at shutdown and a row whose add never happened have no true word', async (reason) => {
    await expectRefused(() => closeOpenWith(db.appPool(), reason, T + 4 * MINUTE), SQLSTATE.checkViolation, CHECK);
    expect(await storedBefore(owner())).toMatchObject([{ aliases: 3, open: 1, job_done: 1 }]);
  });
});

describe('M13S-2: NEGATIVE CONTROL - without 0027 the values are admitted but the version is not stepped', () => {
  it('0026 alone: the CHECK holds both new values, the version stays (11, dbc-12), this code does not start on it and the code of set 12 still does', async () => {
    await withClone('set13_no0027', async (other) => {
      await seedSetTwelve(other.ownerPool());
      await migrateThrough(other.ownerPool(), 27, SET_12);
      expect(await checkedValues(other.ownerPool())).toEqual([...REASONS_BEFORE, ...NEW_REASONS]);
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expect(checkSchemaVersion(other.appPool(), SET_12)).resolves.toBeUndefined();
    });
  });
});

describe('M13S-3: set 13 applies its two files and rewrites no stored row', () => {
  it('db:migrate applies exactly 0026 and 0027 and steps the version to (12, dbc-13); the ledger holds twenty-eight files; no object and no privilege is new; every stored row is what it was', async () => {
    const rowsBefore = await storedBefore(owner());
    const objectsBefore = (await owner().query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    const grantsBefore = await grantDigest(owner());
    const checksBefore = await aliasChecks(owner());
    const folder = folderOf(THROUGH);
    expect(await readSchemaVersion(owner())).toEqual(SET_12);
    expect((await inspectLedger(owner(), folder)).pending).toEqual([...TAGS]);
    await migrateThrough(owner(), THROUGH, SET_13);
    const ledger = await inspectLedger(owner(), folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner())).toHaveLength(THROUGH);
    // No table, no index, no sequence: the count of objects is what it was.
    expect((await owner().query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore);
    // A constraint carries no privilege: the runtime role holds exactly what it held.
    expect(await grantDigest(owner())).toEqual(grantsBefore);
    // MG-8: nothing was rewritten and nothing was backfilled - the JOB_DONE row keeps its word.
    expect(await storedBefore(owner())).toEqual(rowsBefore);
    expect(await storedBefore(owner())).toMatchObject([{ aliases: 3, open: 1, job_done: 1 }]);
    // The CHECK came back under its name, validated against the stored rows, with the two values LAST.
    expect((await owner().query(`SELECT conname::text AS name, convalidated FROM pg_constraint WHERE conname = '${CHECK}'`)).rows).toEqual([{ name: CHECK, convalidated: true }]);
    expect(await checkedValues(owner())).toEqual([...REASONS_BEFORE, ...NEW_REASONS]);
    // The catalog holds what the typed schema declares, value for value, in order - its first six
    // members: a later set (set 14) adds after them and this file stops at set 13.
    expect([...REASONS_BEFORE, ...NEW_REASONS]).toEqual(HOST_ALIAS_REMOVE_REASON.slice(0, 6));
    // The CHECK count of the table did not move: nothing was added beside the one.
    expect(await aliasChecks(owner())).toBe(checksBefore);
    expect(checksBefore).toBe(8);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const before = await readAppliedMigrations(owner());
    const objectsBefore = await owner().query(objects);
    const catalogBefore = await catalogDigest(owner());
    await applyMigrations(owner(), folderOf(THROUGH)).catch(() => undefined);
    expect(await readSchemaVersion(owner())).toEqual(SET_13);
    expect(await readAppliedMigrations(owner())).toEqual(before);
    expect((await owner().query(objects)).rows).toEqual(objectsBefore.rows);
    expect(await catalogDigest(owner())).toEqual(catalogBefore);
  });
});

describe('M13S-4: the two reasons are accepted and a foreign reason is still refused', () => {
  it('as dems_app: the alias in place is closed with SHUTDOWN and no operator - the statement the shutdown removal needs', async () => {
    expect(await outcome(closeOpenWith(db.appPool(), 'SHUTDOWN', T + 4 * MINUTE))).toBe('ok:1');
    expect((await owner().query(`SELECT remove_reason, removed_by, count(*)::int AS rows FROM ${ALIASES} GROUP BY 1, 2 ORDER BY 1`)).rows).toEqual([
      { remove_reason: 'JOB_DONE', removed_by: null, rows: 1 },
      { remove_reason: 'MANUAL', removed_by: 'OPR-001', rows: 1 },
      { remove_reason: 'SHUTDOWN', removed_by: null, rows: 1 },
    ]);
  });

  it('as dems_app: a row opened with the intent is closed NOT_ADDED at the very moment it was opened (the helper added nothing), and the next alias may then be opened', async () => {
    const app = db.appPool();
    await insertRow(app, 'host_network_aliases', hostNetworkAlias({ address: '192.168.9.253/24', added_at: T + 5 * MINUTE, expires_at: T + 35 * MINUTE }));
    expect(await outcome(closeOpenWith(app, 'NOT_ADDED', T + 5 * MINUTE))).toBe('ok:1');
    expect((await owner().query(`SELECT address, remove_reason, removed_by, (removed_at = added_at) AS at_once FROM ${ALIASES} WHERE remove_reason = 'NOT_ADDED'`)).rows).toEqual([
      { address: '192.168.9.253/24', remove_reason: 'NOT_ADDED', removed_by: null, at_once: true },
    ]);
    await insertRow(app, 'host_network_aliases', hostNetworkAlias({ address: '192.168.9.253/24', added_at: T + 6 * MINUTE, expires_at: T + 36 * MINUTE }));
    expect(await outcome(closeOpenWith(app, 'JOB_DONE', T + 7 * MINUTE))).toBe('ok:1');
  });

  it.each([...NEW_REASONS])('a row may also be INSERTED already closed with %s (a fixture, a restore): accepted', async (reason) => {
    await insertRow(db.appPool(), 'host_network_aliases', hostNetworkAlias({ address: '10.20.30.253/24', removed_at: T + 1, remove_reason: reason }));
  });

  it.each([...REASONS_BEFORE])('every earlier removal reason is still accepted: %s', async (reason) => {
    await insertRow(db.appPool(), 'host_network_aliases', hostNetworkAlias({ address: '10.20.31.253/24', removed_at: T + 1, remove_reason: reason }));
  });

  it.each([
    ['a word outside the set', 'CRASHED'],
    ['the reason in lower case', 'shutdown'],
    ['the reason with a trailing blank', 'SHUTDOWN '],
    ['a near name', 'SHUT_DOWN'],
    ['another near name', 'NEVER_ADDED'],
    ['a third near name', 'NOT_ADDED_'],
    ['the audit type of a removal (a type is not a reason)', 'HOST_ALIAS_REMOVED'],
    ['the empty text', ''],
  ])('A FOREIGN REASON IS STILL REFUSED (23514): %s', async (_what, reason) => {
    await expectRefused(() => insertRow(db.appPool(), 'host_network_aliases', hostNetworkAlias({ address: '10.20.32.253/24', removed_at: T + 1, remove_reason: reason })), SQLSTATE.checkViolation, CHECK);
  });

  it('the rules beside the value list hold: a reason without the time, the time without a reason, an operator on a row that is not closed, and a removal before the add are refused', async () => {
    const app = db.appPool();
    const closedRow = (overrides: Record<string, unknown>): Record<string, unknown> => hostNetworkAlias({ address: '10.20.33.253/24', ...overrides });
    for (const reason of NEW_REASONS) await expectRefused(() => insertRow(app, 'host_network_aliases', closedRow({ remove_reason: reason })), SQLSTATE.checkViolation, CHECK);
    await expectRefused(() => insertRow(app, 'host_network_aliases', closedRow({ removed_at: T + 1 })), SQLSTATE.checkViolation, CHECK);
    await expectRefused(() => insertRow(app, 'host_network_aliases', closedRow({ removed_by: 'OPR-001' })), SQLSTATE.checkViolation, 'host_network_aliases_removed_by_check');
    await expectRefused(() => insertRow(app, 'host_network_aliases', closedRow({ removed_at: T - 1, remove_reason: 'NOT_ADDED' })), SQLSTATE.checkViolation, 'host_network_aliases_removed_at_check');
  });

  it('one alias at a time still holds, and the runtime role still removes no row and rewrites no column but the five it held (42501)', async () => {
    const app = db.appPool();
    await insertRow(app, 'host_network_aliases', hostNetworkAlias({ address: '10.20.34.253/24', added_at: T + 8 * MINUTE, expires_at: T + 38 * MINUTE }));
    await expectRefused(() => insertRow(app, 'host_network_aliases', hostNetworkAlias({ address: '10.20.35.253/24', added_at: T + 8 * MINUTE, expires_at: T + 38 * MINUTE })), SQLSTATE.uniqueViolation, 'host_network_aliases_one_open_key');
    await expectRefused(() => app.query(`DELETE FROM ${ALIASES}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`UPDATE ${ALIASES} SET address = '10.20.36.253/24'`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`UPDATE ${ALIASES} SET reason = 'SET_CAMERA_ADDRESS'`), SQLSTATE.insufficientPrivilege);
    const { rows } = await owner().query<{ name: string }>(`SELECT attname::text AS name FROM pg_attribute WHERE attrelid = '${ALIASES}'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('dems_app', attrelid, attnum, 'UPDATE') ORDER BY 1`);
    expect(rows.map((row) => row.name)).toEqual(['expires_at', 'remove_error', 'remove_reason', 'removed_at', 'removed_by']);
    expect(await outcome(closeOpenWith(app, 'SHUTDOWN', T + 9 * MINUTE))).toBe('ok:1');
  });
});

describe('M13S-5: B-3 across the step, in both directions', () => {
  it('the code of set 12 (11, dbc-12) on the migrated database is refused; the code of set 13 passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_12).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 12 (dbc-13); this server expects 11 (dbc-12)');
    await expect(checkSchemaVersion(db.appPool(), SET_13)).resolves.toBeUndefined();
    // This code passes exactly while set 13 is the last set; with a later set it names db:migrate.
    const here = await checkSchemaVersion(db.appPool()).then(
      () => 'passes',
      () => 'refused',
    );
    expect(here).toBe(isThisCode(SET_13) ? 'passes' : 'refused');
  });
});

describe('M13S-6: rollback', () => {
  it('FAILS WHILE APPLYING: the two files inside one transaction, rolled back before the commit, leave the catalog, the rows, the version and the ledger as they were', async () => {
    await withClone('set13_rollback_tx', async (other) => {
      const pool = other.ownerPool();
      await seedSetTwelve(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      const ledgerBefore = await readAppliedMigrations(pool);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const tag of TAGS) for (const chunk of chunksOf(tag)) await client.query(chunk);
        // Inside the transaction the set is in force: the value is admitted and the version is stepped.
        await client.query(`UPDATE ${ALIASES} SET removed_at = $1, remove_reason = 'SHUTDOWN' WHERE removed_at IS NULL`, [T + 4 * MINUTE]);
        expect((await client.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows).toEqual([{ schema_version: 12, contract_revision: 'dbc-13' }]);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      expect(await readSchemaVersion(pool)).toEqual(SET_12);
      expect(await readAppliedMigrations(pool)).toEqual(ledgerBefore);
      expect((await inspectLedger(pool)).pending).toEqual([...TAGS, ...LATER]);
      await expect(checkSchemaVersion(other.appPool(), SET_12)).resolves.toBeUndefined();
    });
  });

  it('APPLIED, AND MUST BE UNDONE: the undo statements return the catalog to the one of (11, dbc-12), every row is what it was, and the code of set 12 starts again', async () => {
    await withClone('set13_rollback_undo', async (other) => {
      const pool = other.ownerPool();
      await seedSetTwelve(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      await migrateThrough(pool, THROUGH, SET_13);
      expect((await catalogDigest(pool)).digest).not.toBe(catalogBefore.digest);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_13) await client.query(statement);
        // In a delivered forward set the version steps ONWARD; here it is set to the pair of set 12
        // so that the comparison below is with the database as it was.
        await client.query("UPDATE public.schema_meta SET schema_version = 11, contract_revision = 'dbc-12' WHERE singleton");
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      await expect(checkSchemaVersion(other.appPool(), SET_12)).resolves.toBeUndefined();
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      for (const reason of NEW_REASONS) await expectRefused(() => closeOpenWith(other.appPool(), reason, T + 4 * MINUTE), SQLSTATE.checkViolation, CHECK);
    });
  });

  it.each([...NEW_REASONS])('THE PRECONDITION OF THE UNDO: while an alias row holds %s the undo is refused (55000) and changes nothing - the history is not rewritten', async (reason) => {
    await withClone(`set13_held_${reason.toLowerCase()}`, async (other) => {
      const pool = other.ownerPool();
      await seedSetTwelve(pool);
      await migrateThrough(pool, THROUGH, SET_13);
      await closeOpenWith(other.appPool(), reason, T + 4 * MINUTE);
      const catalogApplied = await catalogDigest(pool);
      const client = await pool.connect();
      let refusal: string | undefined;
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_13) await client.query(statement);
        await client.query('COMMIT');
      } catch (error) {
        refusal = (error as { code?: string }).code;
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(refusal).toBe(NOT_IN_PREREQUISITE_STATE);
      expect(await catalogDigest(pool)).toEqual(catalogApplied);
      expect(await readSchemaVersion(pool)).toEqual(SET_13);
      expect((await pool.query(`SELECT count(*)::int AS held FROM ${ALIASES} WHERE remove_reason = '${reason}'`)).rows).toEqual([{ held: 1 }]);
    });
  });
});

describe('M13S-7: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');

  it('0026 is generated: one DROP CONSTRAINT and one ADD CONSTRAINT under the same name - and no statement that writes a row (MG-2, MG-8)', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toEqual([
      `ALTER TABLE "host_network_aliases" DROP CONSTRAINT "${CHECK}";`,
      `ALTER TABLE "host_network_aliases" ADD CONSTRAINT "${CHECK}" CHECK ((("host_network_aliases"."remove_reason" IS NULL) = ("host_network_aliases"."removed_at" IS NULL)) AND ("host_network_aliases"."remove_reason" IS NULL OR "host_network_aliases"."remove_reason" IN (${[...REASONS_BEFORE, ...NEW_REASONS].map((value) => `'${value}'`).join(', ')})));`,
    ]);
    const text = generated.join(' ');
    expect(text).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/);
    expect(text).not.toMatch(/NOT VALID|CREATE TABLE|ADD COLUMN|DROP TABLE|DROP COLUMN|DROP NOT NULL/i);
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[0]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('0027 is hand-written: the version row and nothing else - no grant, no revoke, no role', () => {
    const written = statementsOf(TAGS[1]);
    expect(written).toEqual(["UPDATE public.schema_meta SET schema_version = 12, contract_revision = 'dbc-13' WHERE singleton;"]);
    expect(written.join(' ')).not.toMatch(/GRANT|REVOKE|ALL\s+TABLES|dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER/i);
  });

  it('0024 and 0025 hash to what they hashed to when set 12 was delivered: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0024_installation_acceptance']).toBe('b6562c0f0f9fa3903e69ee5ba9206637bea8aecf7e58b66b2f347ccf1554851b');
    expect(hashes['0025_installation_acceptance_privileges']).toBe('7db509825a5785d17185b2067faf79002199e3929ba0faf761cf54f1caadd11f');
  });
});
