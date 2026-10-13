// Migration set 14 (`0028_alias_removal_reason_unconfirmed.sql` +
// `0029_alias_removal_reason_unconfirmed_privileges.sql`; task 4, contract revision `dbc-14`,
// schema version 13; caution R119-05, answer (d), of
// `docs/2026-10-12_input_av_core_adapter_plan/verification/119_commissioning_security.md` and
// decision C94 (d) of `decisions/decisions.md`; security finding S13-10):
//
//   the value `ADD_UNCONFIRMED` in the removal reasons of an alias address on the camera interface
//   (`host_network_aliases_remove_reason_check`). No table, no column, no index, no grant.
//
//   M14S-1  the pre-state is a genuine (12, 'dbc-13') database that HOLDS ROWS (operators, three
//           closed aliases - `MANUAL`, `JOB_DONE`, `NOT_ADDED` - and one open alias): the reason
//           is refused there (23514), this code is refused by B-3 naming db:migrate, the code of
//           set 13 is accepted
//   M14S-2  NEGATIVE CONTROL: with 0029 left out the CHECK admits the value but the version
//           stays (12, 'dbc-13'), so this code does not start on it
//   M14S-3  set 14 applies exactly its two files, REWRITES NO STORED ROW (MG-8; a row closed
//           `JOB_DONE` before the set keeps that word), adds no object and changes no privilege,
//           ends at (13, 'dbc-14'); a second run applies nothing (MG-10)
//   M14S-4  as dems_app: an open alias is closed with `ADD_UNCONFIRMED` and no operator; every
//           earlier member still is accepted; a foreign reason is STILL REFUSED; the rules beside
//           the value list hold
//   M14S-5  B-3 across the step, in both directions
//   M14S-6  ROLLBACK: the set inside one transaction, rolled back, leaves the catalog, the rows and
//           the version as they were; the undo statements return an applied database to the
//           catalog of (12, 'dbc-13') and refuse to run while a row holds the new reason
//   M14S-7  the files: 0028 is two statements and writes no row; 0029 is the version row alone;
//           0026 and 0027 hash to what they hashed to when set 13 was delivered (MG-4)
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

const TAGS = ['0028_alias_removal_reason_unconfirmed', '0029_alias_removal_reason_unconfirmed_privileges'] as const;
/** The number of files through set 13: the pre-state of this file. */
const BEFORE = 28;
/** The number of files through set 14: this file stops there, whatever set comes later. */
const THROUGH = 30;
/** The files of the sets after set 14, pending on a database of set 14. */
const LATER: readonly string[] = INITIAL_MIGRATION_TAGS.slice(THROUGH);
const ALIASES = 'public.host_network_aliases';
const CHECK = 'host_network_aliases_remove_reason_check';
const NEW_REASON = 'ADD_UNCONFIRMED';
const SET_13 = { schemaVersion: 12, contractRevision: 'dbc-13' } as const;
const SET_14 = { schemaVersion: 13, contractRevision: 'dbc-14' } as const;
/** The set as it stood before the step, in stored order. */
const REASONS_BEFORE = ['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP', 'SHUTDOWN', 'NOT_ADDED'] as const;
const MINUTE = 60_000;
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set14-'));
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
 * THE UNDO OF AN APPLIED SET 14 ("applied, and must be undone"). The files of an applied set are
 * never edited and no down file exists in this repository, so an undo is delivered as a NEW
 * forward set that carries these statements and steps the version onward. They are kept here,
 * where a test runs them, so that the rollback is measured and not only described.
 * PRECONDITION: no alias row holds the reason - the first statement refuses otherwise (and without
 * it the ADD CONSTRAINT statement would answer 23514). A row that holds the reason is history: it
 * is not rewritten into `JOB_DONE` to make an undo pass - that rewrite is exactly the untruth the
 * set was made to end.
 * WHAT IT LOSES: nothing stored. The code that writes the reason (the removal at once after an
 * `add` of unknown effect) must go in the same release, or it answers 23514.
 */
const UNDO_SET_14: readonly string[] = [
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.host_network_aliases WHERE remove_reason = '${NEW_REASON}') THEN RAISE EXCEPTION 'an alias row holds the reason ADD_UNCONFIRMED: the history is not rewritten' USING ERRCODE = 'object_not_in_prerequisite_state'; END IF; END $$`,
  `ALTER TABLE public.host_network_aliases DROP CONSTRAINT ${CHECK}`,
  `ALTER TABLE public.host_network_aliases ADD CONSTRAINT ${CHECK} CHECK ((("host_network_aliases"."remove_reason" IS NULL) = ("host_network_aliases"."removed_at" IS NULL)) AND ("host_network_aliases"."remove_reason" IS NULL OR "host_network_aliases"."remove_reason" IN (${REASONS_BEFORE.map((value) => `'${value}'`).join(', ')})))`,
];
/** SQLSTATE 55000, `object_not_in_prerequisite_state`: what the guard of the undo raises. */
const NOT_IN_PREREQUISITE_STATE = '55000';

/**
 * A (12, dbc-13) database with the rows of M14S-1: the four operators, an alias removed by hand,
 * an alias a job closed, a row whose add never happened (`NOT_ADDED`, a word of set 13) and one
 * alias in place.
 */
async function seedSetThirteen(owner: Pool): Promise<void> {
  await migrateThrough(owner, BEFORE, SET_13);
  await insertRbac(owner);
  await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ removed_at: T + 5_000, remove_reason: 'MANUAL', removed_by: 'OPR-001' }));
  await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ address: '192.168.0.253/24', added_at: T + MINUTE, expires_at: T + 31 * MINUTE, removed_at: T + 2 * MINUTE, remove_reason: 'JOB_DONE' }));
  await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ address: '192.168.8.253/24', added_at: T + 2 * MINUTE, expires_at: T + 32 * MINUTE, removed_at: T + 2 * MINUTE, remove_reason: 'NOT_ADDED' }));
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

describe('M14S-1: the pre-state, a (12, dbc-13) database that holds rows', () => {
  it('twenty-eight files applied, set 14 pending; this code is refused by B-3 and the code of set 13 passes', async () => {
    await seedSetThirteen(owner());
    const ledger = await inspectLedger(owner());
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner(), folderOf(THROUGH))).pending).toEqual([...TAGS]);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    // The pair this code expects is read from its constants: it moves with every later set.
    expect((error as BootCheckError).message).toBe(
      `B-3: the database is at schema version 12 (dbc-13); this server expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
    await expect(checkSchemaVersion(db.appPool(), SET_13)).resolves.toBeUndefined();
  });

  it('rows of the kind a used database holds: four aliases, one in place, one closed JOB_DONE; the CHECK holds the six values', async () => {
    expect(await storedBefore(owner())).toMatchObject([{ aliases: 4, open: 1, job_done: 1 }]);
    expect(await checkedValues(owner())).toEqual([...REASONS_BEFORE]);
  });

  it('THE STATE THAT IS MISSING: ADD_UNCONFIRMED is refused (23514) - a removal at once after an add of unknown effect has no true word', async () => {
    await expectRefused(() => closeOpenWith(db.appPool(), NEW_REASON, T + 4 * MINUTE), SQLSTATE.checkViolation, CHECK);
    expect(await storedBefore(owner())).toMatchObject([{ aliases: 4, open: 1, job_done: 1 }]);
  });
});

describe('M14S-2: NEGATIVE CONTROL - without 0029 the value is admitted but the version is not stepped', () => {
  it('0028 alone: the CHECK holds the new value, the version stays (12, dbc-13), this code does not start on it and the code of set 13 still does', async () => {
    await withClone('set14_no0029', async (other) => {
      await seedSetThirteen(other.ownerPool());
      await migrateThrough(other.ownerPool(), THROUGH - 1, SET_13);
      expect(await checkedValues(other.ownerPool())).toEqual([...REASONS_BEFORE, NEW_REASON]);
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expect(checkSchemaVersion(other.appPool(), SET_13)).resolves.toBeUndefined();
    });
  });
});

describe('M14S-3: set 14 applies its two files and rewrites no stored row', () => {
  it('db:migrate applies exactly 0028 and 0029 and steps the version to (13, dbc-14); the ledger holds thirty files; no object and no privilege is new; every stored row is what it was', async () => {
    const rowsBefore = await storedBefore(owner());
    const objectsBefore = (await owner().query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    const grantsBefore = await grantDigest(owner());
    const checksBefore = await aliasChecks(owner());
    const folder = folderOf(THROUGH);
    expect(await readSchemaVersion(owner())).toEqual(SET_13);
    expect((await inspectLedger(owner(), folder)).pending).toEqual([...TAGS]);
    await migrateThrough(owner(), THROUGH, SET_14);
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
    expect(await storedBefore(owner())).toMatchObject([{ aliases: 4, open: 1, job_done: 1 }]);
    // The CHECK came back under its name, validated against the stored rows, with the value LAST.
    expect((await owner().query(`SELECT conname::text AS name, convalidated FROM pg_constraint WHERE conname = '${CHECK}'`)).rows).toEqual([{ name: CHECK, convalidated: true }]);
    expect(await checkedValues(owner())).toEqual([...REASONS_BEFORE, NEW_REASON]);
    // The catalog holds what the typed schema declares, value for value, in order - its first
    // seven members: a later set adds after them and this file stops at set 14.
    expect([...REASONS_BEFORE, NEW_REASON]).toEqual(HOST_ALIAS_REMOVE_REASON.slice(0, 7));
    // The CHECK count of the table did not move: nothing was added beside the one.
    expect(await aliasChecks(owner())).toBe(checksBefore);
    expect(checksBefore).toBe(8);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const before = await readAppliedMigrations(owner());
    const objectsBefore = await owner().query(objects);
    const catalogBefore = await catalogDigest(owner());
    await applyMigrations(owner(), folderOf(THROUGH)).catch(() => undefined);
    expect(await readSchemaVersion(owner())).toEqual(SET_14);
    expect(await readAppliedMigrations(owner())).toEqual(before);
    expect((await owner().query(objects)).rows).toEqual(objectsBefore.rows);
    expect(await catalogDigest(owner())).toEqual(catalogBefore);
  });
});

describe('M14S-4: the reason is accepted and a foreign reason is still refused', () => {
  it('as dems_app: the alias in place is closed with ADD_UNCONFIRMED and no operator - the statement the removal after an add of unknown effect needs', async () => {
    expect(await outcome(closeOpenWith(db.appPool(), NEW_REASON, T + 4 * MINUTE))).toBe('ok:1');
    expect((await owner().query(`SELECT remove_reason, removed_by, count(*)::int AS rows FROM ${ALIASES} GROUP BY 1, 2 ORDER BY 1`)).rows).toEqual([
      { remove_reason: 'ADD_UNCONFIRMED', removed_by: null, rows: 1 },
      { remove_reason: 'JOB_DONE', removed_by: null, rows: 1 },
      { remove_reason: 'MANUAL', removed_by: 'OPR-001', rows: 1 },
      { remove_reason: 'NOT_ADDED', removed_by: null, rows: 1 },
    ]);
  });

  it('as dems_app: after a row closed ADD_UNCONFIRMED the next alias may be opened, and a job closes it JOB_DONE as before', async () => {
    const app = db.appPool();
    await insertRow(app, 'host_network_aliases', hostNetworkAlias({ address: '192.168.9.253/24', added_at: T + 6 * MINUTE, expires_at: T + 36 * MINUTE }));
    expect(await outcome(closeOpenWith(app, 'JOB_DONE', T + 7 * MINUTE))).toBe('ok:1');
  });

  it('a row may also be INSERTED already closed with ADD_UNCONFIRMED (a fixture, a restore): accepted', async () => {
    await insertRow(db.appPool(), 'host_network_aliases', hostNetworkAlias({ address: '10.20.30.253/24', removed_at: T + 1, remove_reason: NEW_REASON }));
  });

  it.each([...REASONS_BEFORE])('every earlier removal reason is still accepted: %s', async (reason) => {
    await insertRow(db.appPool(), 'host_network_aliases', hostNetworkAlias({ address: '10.20.31.253/24', removed_at: T + 1, remove_reason: reason }));
  });

  it.each([
    ['a word outside the set', 'CRASHED'],
    ['the reason in lower case', 'add_unconfirmed'],
    ['the reason with a trailing blank', 'ADD_UNCONFIRMED '],
    ['a near name', 'ADD_NOT_CONFIRMED'],
    ['another near name', 'UNCONFIRMED'],
    ['a third near name', 'EFFECT_UNKNOWN'],
    ['the audit type of a failed add (a type is not a reason)', 'HOST_ALIAS_ADD_FAILED'],
    ['the empty text', ''],
  ])('A FOREIGN REASON IS STILL REFUSED (23514): %s', async (_what, reason) => {
    await expectRefused(() => insertRow(db.appPool(), 'host_network_aliases', hostNetworkAlias({ address: '10.20.32.253/24', removed_at: T + 1, remove_reason: reason })), SQLSTATE.checkViolation, CHECK);
  });

  it('the rules beside the value list hold: the reason without the time, the time without a reason, an operator on a row that is not closed, and a removal before the add are refused', async () => {
    const app = db.appPool();
    const closedRow = (overrides: Record<string, unknown>): Record<string, unknown> => hostNetworkAlias({ address: '10.20.33.253/24', ...overrides });
    await expectRefused(() => insertRow(app, 'host_network_aliases', closedRow({ remove_reason: NEW_REASON })), SQLSTATE.checkViolation, CHECK);
    await expectRefused(() => insertRow(app, 'host_network_aliases', closedRow({ removed_at: T + 1 })), SQLSTATE.checkViolation, CHECK);
    await expectRefused(() => insertRow(app, 'host_network_aliases', closedRow({ removed_by: 'OPR-001' })), SQLSTATE.checkViolation, 'host_network_aliases_removed_by_check');
    await expectRefused(() => insertRow(app, 'host_network_aliases', closedRow({ removed_at: T - 1, remove_reason: NEW_REASON })), SQLSTATE.checkViolation, 'host_network_aliases_removed_at_check');
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
    expect(await outcome(closeOpenWith(app, NEW_REASON, T + 9 * MINUTE))).toBe('ok:1');
  });
});

describe('M14S-5: B-3 across the step, in both directions', () => {
  it('the code of set 13 (12, dbc-13) on the migrated database is refused; the code of set 14 passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_13).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 13 (dbc-14); this server expects 12 (dbc-13)');
    await expect(checkSchemaVersion(db.appPool(), SET_14)).resolves.toBeUndefined();
    // This code passes exactly while set 14 is the last set; with a later set it names db:migrate.
    const here = await checkSchemaVersion(db.appPool()).then(
      () => 'passes',
      () => 'refused',
    );
    expect(here).toBe(isThisCode(SET_14) ? 'passes' : 'refused');
  });
});

describe('M14S-6: rollback', () => {
  it('FAILS WHILE APPLYING: the two files inside one transaction, rolled back before the commit, leave the catalog, the rows, the version and the ledger as they were', async () => {
    await withClone('set14_rollback_tx', async (other) => {
      const pool = other.ownerPool();
      await seedSetThirteen(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      const ledgerBefore = await readAppliedMigrations(pool);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const tag of TAGS) for (const chunk of chunksOf(tag)) await client.query(chunk);
        // Inside the transaction the set is in force: the value is admitted and the version is stepped.
        await client.query(`UPDATE ${ALIASES} SET removed_at = $1, remove_reason = '${NEW_REASON}' WHERE removed_at IS NULL`, [T + 4 * MINUTE]);
        expect((await client.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows).toEqual([{ schema_version: 13, contract_revision: 'dbc-14' }]);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      expect(await readSchemaVersion(pool)).toEqual(SET_13);
      expect(await readAppliedMigrations(pool)).toEqual(ledgerBefore);
      expect((await inspectLedger(pool)).pending).toEqual([...TAGS, ...LATER]);
      await expect(checkSchemaVersion(other.appPool(), SET_13)).resolves.toBeUndefined();
    });
  });

  it('APPLIED, AND MUST BE UNDONE: the undo statements return the catalog to the one of (12, dbc-13), every row is what it was, and the code of set 13 starts again', async () => {
    await withClone('set14_rollback_undo', async (other) => {
      const pool = other.ownerPool();
      await seedSetThirteen(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      await migrateThrough(pool, THROUGH, SET_14);
      expect((await catalogDigest(pool)).digest).not.toBe(catalogBefore.digest);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_14) await client.query(statement);
        // In a delivered forward set the version steps ONWARD; here it is set to the pair of set 13
        // so that the comparison below is with the database as it was.
        await client.query("UPDATE public.schema_meta SET schema_version = 12, contract_revision = 'dbc-13' WHERE singleton");
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      await expect(checkSchemaVersion(other.appPool(), SET_13)).resolves.toBeUndefined();
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expectRefused(() => closeOpenWith(other.appPool(), NEW_REASON, T + 4 * MINUTE), SQLSTATE.checkViolation, CHECK);
      // The words of set 13 are untouched by the undo of set 14.
      expect(await outcome(closeOpenWith(other.appPool(), 'SHUTDOWN', T + 4 * MINUTE))).toBe('ok:1');
    });
  });

  it('THE PRECONDITION OF THE UNDO: while an alias row holds ADD_UNCONFIRMED the undo is refused (55000) and changes nothing - the history is not rewritten', async () => {
    await withClone('set14_held', async (other) => {
      const pool = other.ownerPool();
      await seedSetThirteen(pool);
      await migrateThrough(pool, THROUGH, SET_14);
      await closeOpenWith(other.appPool(), NEW_REASON, T + 4 * MINUTE);
      const catalogApplied = await catalogDigest(pool);
      const client = await pool.connect();
      let refusal: string | undefined;
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_14) await client.query(statement);
        await client.query('COMMIT');
      } catch (error) {
        refusal = (error as { code?: string }).code;
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(refusal).toBe(NOT_IN_PREREQUISITE_STATE);
      expect(await catalogDigest(pool)).toEqual(catalogApplied);
      expect(await readSchemaVersion(pool)).toEqual(SET_14);
      expect((await pool.query(`SELECT count(*)::int AS held FROM ${ALIASES} WHERE remove_reason = '${NEW_REASON}'`)).rows).toEqual([{ held: 1 }]);
    });
  });
});

describe('M14S-7: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');

  it('0028 is generated: one DROP CONSTRAINT and one ADD CONSTRAINT under the same name - and no statement that writes a row (MG-2, MG-8)', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toEqual([
      `ALTER TABLE "host_network_aliases" DROP CONSTRAINT "${CHECK}";`,
      `ALTER TABLE "host_network_aliases" ADD CONSTRAINT "${CHECK}" CHECK ((("host_network_aliases"."remove_reason" IS NULL) = ("host_network_aliases"."removed_at" IS NULL)) AND ("host_network_aliases"."remove_reason" IS NULL OR "host_network_aliases"."remove_reason" IN (${[...REASONS_BEFORE, NEW_REASON].map((value) => `'${value}'`).join(', ')})));`,
    ]);
    const text = generated.join(' ');
    expect(text).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/);
    expect(text).not.toMatch(/NOT VALID|CREATE TABLE|ADD COLUMN|DROP TABLE|DROP COLUMN|DROP NOT NULL/i);
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[0]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('0029 is hand-written: the version row and nothing else - no grant, no revoke, no role', () => {
    const written = statementsOf(TAGS[1]);
    expect(written).toEqual(["UPDATE public.schema_meta SET schema_version = 13, contract_revision = 'dbc-14' WHERE singleton;"]);
    expect(written.join(' ')).not.toMatch(/GRANT|REVOKE|ALL\s+TABLES|dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER/i);
  });

  it('0026 and 0027 hash to what they hashed to when set 13 was delivered: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0026_alias_removal_reasons']).toBe('45db7cbc7599e0331fab5d78ab5dc40ee730044b60ac9aafef097d40728bcebc');
    expect(hashes['0027_alias_removal_reasons_privileges']).toBe('437accec08b9fd213f45b67968dcffc0ceb633aa444dc24f0d02eae19b95d77a');
  });
});
