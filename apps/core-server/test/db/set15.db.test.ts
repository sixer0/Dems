// Migration set 15 (`0030_network_config_onvif_ports.sql` +
// `0031_network_config_onvif_ports_privileges.sql`; task 4, contract revision `dbc-15`, schema
// version 14; finding F-4 of `docs/2026-10-12_input_av_core_adapter_plan/verification/
// 120_m10_review.md` with decision C114, and finding S2-02 of `120b_m10_review_second_pass.md` with
// decision C116, of `decisions/decisions.md`; security requirement S13-11 point 3):
//
//   (1) the form of an interface name, widened to the alias helper's own (upper case admitted) in
//       the two CHECKs that hold one (`capture_network_config`, `host_network_aliases`);
//   (2) the column `capture_network_config.onvif_ports`: the allowed ONVIF ports, a list of 1 to 8
//       whole numbers 1 to 65535, no two equal, default `[80]`, with its two CHECKs and its grant.
//
//   M15S-1  the pre-state is a genuine (13, 'dbc-14') database that HOLDS ROWS (the settings row,
//           two aliases): a name with a capital is refused there in both tables (23514), the column
//           does not exist (42703), this code is refused by B-3, the code of set 14 is accepted
//   M15S-2  NEGATIVE CONTROL: with 0031 left out the column is there but the runtime role may not
//           write it (42501) and the version stays (13, 'dbc-14')
//   M15S-3  set 15 applies exactly its two files; THE EXISTING ROW KEEPS ITS INTERFACE NAME AND
//           GAINS `[80]`, nothing else of it moves, no alias row moves; one grant is new and
//           nothing else of the privileges; ends at (14, 'dbc-15'); a second run applies nothing
//   M15S-4  as dems_app: names with a capital and port lists inside the bounds are accepted; A ROW
//           FOR EACH BOUND IS REFUSED BY THE DATABASE (nine ports, port 0, 65536, a port twice, an
//           element that is no whole number, no list, a name outside the form)
//   M15S-5  B-3 across the step, in both directions
//   M15S-6  ROLLBACK: the set inside one transaction, rolled back; the undo statements return an
//           applied database to the catalog of (13, 'dbc-14') and refuse to run while a stored
//           name does not fit the earlier form
//   M15S-7  the files: 0030 is seven generated statements and writes no row; 0031 is one grant and
//           the version row; 0028 and 0029 hash to what they hashed to when set 14 was delivered
//
// Every database here is a throw-away of this test run (TI-17). No name here is a host's port and
// no address a host's: the rows are fixture rows, and nothing in this file asks the alias helper,
// a camera or the network anything.
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
import { useTestDatabase, type TestDatabase } from '../helpers/db';
import { ALIAS_CLOSED, T, captureNetworkConfig, hostNetworkAlias, insertRbac, insertRow, json } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0030_network_config_onvif_ports', '0031_network_config_onvif_ports_privileges'] as const;
/** The number of files through set 14: the pre-state of this file. */
const BEFORE = 30;
/** The number of files through set 15: this file stops there, whatever set comes later. */
const THROUGH = 32;
/** The files of the sets after set 15, pending on a database of set 15. */
const LATER: readonly string[] = INITIAL_MIGRATION_TAGS.slice(THROUGH);
const CONFIG = 'public.capture_network_config';
const ALIASES = 'public.host_network_aliases';
const NAME_CHECK = 'capture_network_config_interface_name_check';
const ALIAS_NAME_CHECK = 'host_network_aliases_interface_name_check';
const PORTS_CHECK = 'capture_network_config_onvif_ports_check';
const DISTINCT_CHECK = 'capture_network_config_onvif_ports_distinct_check';
/** The form before the step (migration `0017`). */
const NAME_BEFORE = '^[a-z0-9][a-z0-9._-]{0,14}$';
/** The alias helper's own form (`scripts/host/netalias/dems-core-netalias`, `INTERFACE_NAME`), as the table holds it. */
const NAME_AFTER = '^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$';
/** The predictable name of a port behind a PCI domain: the name finding F-4 is about. */
const CAPITAL_NAME = 'enP2p1s0';
const SET_14 = { schemaVersion: 13, contractRevision: 'dbc-14' } as const;
const SET_15 = { schemaVersion: 14, contractRevision: 'dbc-15' } as const;
const MINUTE = 60_000;
/** SQLSTATE 42703, `undefined_column`. */
const UNDEFINED_COLUMN = '42703';
/** SQLSTATE 55000, `object_not_in_prerequisite_state`: what the guard of the undo raises. */
const NOT_IN_PREREQUISITE_STATE = '55000';
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set15-'));
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

/**
 * What the two tables hold, as digests of whole row images. The settings row is read WITHOUT the
 * new column, so that the same statement runs before and after the set and "nothing else moved"
 * is one comparison.
 */
const storedBefore = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT (SELECT count(*)::int FROM ${CONFIG}) AS settings,
            (SELECT interface_name FROM ${CONFIG}) AS interface_name,
            (SELECT md5(string_agg((to_jsonb(c) - 'onvif_ports')::text, '')) FROM ${CONFIG} AS c) AS settings_row,
            (SELECT count(*)::int FROM ${ALIASES}) AS aliases,
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

/** The privileges of the runtime role, line by line: the set adds ONE and moves no other. */
const grantLines = async (owner: Pool): Promise<string[]> =>
  (await owner.query<{ line: string }>(
    `SELECT line FROM (
       SELECT 'table grant ' || table_name || ' ' || privilege_type AS line FROM information_schema.table_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
       UNION ALL
       SELECT 'column grant ' || table_name || '.' || column_name || ' ' || privilege_type FROM information_schema.column_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
     ) AS grants ORDER BY 1`,
  )).rows.map((row) => row.line);

/** The pattern a named CHECK holds, read back from the catalog. */
const patternOf = async (pool: Pool, name: string): Promise<string> => {
  const { rows } = await pool.query<{ definition: string }>(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = '${name}'`);
  return /~ '([^']+)'::text/.exec(rows[0]?.definition ?? '')?.[1] ?? '';
};

const checksOn = async (pool: Pool, table: string): Promise<number> =>
  (await pool.query<{ checks: number }>(`SELECT count(*)::int AS checks FROM pg_constraint WHERE contype = 'c' AND conrelid = '${table}'::regclass`)).rows[0]?.checks ?? -1;

/**
 * THE UNDO OF AN APPLIED SET 15 ("applied, and must be undone"). The files of an applied set are
 * never edited and no down file exists in this repository, so an undo is delivered as a NEW
 * forward set that carries these statements and steps the version onward. They are kept here,
 * where a test runs them, so that the rollback is measured and not only described.
 * PRECONDITION: no stored interface name is outside the EARLIER form - neither the settings row
 * nor any alias row, open or closed. The first statement refuses otherwise (and without it the
 * ADD CONSTRAINT statements would answer 23514). An alias row is history and is not rewritten, so
 * a database that ever held an alias on a port named with a capital cannot take this undo.
 * WHAT IT LOSES: the stored port list (the column goes, with its two CHECKs and its grant); the
 * destination rule is back at port 80 alone, and a camera whose ONVIF service answers elsewhere
 * is not reachable again until the list is stored again. The code that reads the column must go
 * in the same release, or it answers 42703.
 */
const UNDO_SET_15: readonly string[] = [
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.capture_network_config WHERE interface_name IS NOT NULL AND interface_name !~ '${NAME_BEFORE}') OR EXISTS (SELECT 1 FROM public.host_network_aliases WHERE interface_name !~ '${NAME_BEFORE}') THEN RAISE EXCEPTION 'a stored interface name does not fit the earlier form: it is not rewritten' USING ERRCODE = 'object_not_in_prerequisite_state'; END IF; END $$`,
  'ALTER TABLE public.capture_network_config DROP COLUMN onvif_ports',
  `ALTER TABLE public.capture_network_config DROP CONSTRAINT ${NAME_CHECK}`,
  `ALTER TABLE public.capture_network_config ADD CONSTRAINT ${NAME_CHECK} CHECK ("capture_network_config"."interface_name" IS NULL OR "capture_network_config"."interface_name" ~ '${NAME_BEFORE}')`,
  `ALTER TABLE public.host_network_aliases DROP CONSTRAINT ${ALIAS_NAME_CHECK}`,
  `ALTER TABLE public.host_network_aliases ADD CONSTRAINT ${ALIAS_NAME_CHECK} CHECK ("host_network_aliases"."interface_name" ~ '${NAME_BEFORE}')`,
];

/**
 * A (13, dbc-14) database with the rows of M15S-1: the four operators, the settings row (the port
 * `eth1`, a subnet, a revision above the default so that "nothing else moved" has something to
 * hold), an alias removed by hand and one alias in place.
 */
async function seedSetFourteen(owner: Pool): Promise<void> {
  await migrateThrough(owner, BEFORE, SET_14);
  await insertRbac(owner);
  await insertRow(owner, 'capture_network_config', captureNetworkConfig({ alias_minutes: 45, revision: 7, factory_addresses: json(['192.168.1.64', '10.0.0.2']) }));
  await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ ...ALIAS_CLOSED }));
  await insertRow(owner, 'host_network_aliases', hostNetworkAlias({ address: '192.168.0.253/24', added_at: T + MINUTE, expires_at: T + 31 * MINUTE }));
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
const setName = (pool: Pool, name: string): Promise<{ rowCount: number | null }> => pool.query(`UPDATE ${CONFIG} SET interface_name = $1`, [name]);
const setPorts = (pool: Pool, ports: string | null): Promise<{ rowCount: number | null }> => pool.query(`UPDATE ${CONFIG} SET onvif_ports = $1::jsonb`, [ports]);
const portsNow = async (pool: Pool): Promise<unknown> => (await pool.query(`SELECT onvif_ports FROM ${CONFIG}`)).rows;

describe('M15S-1: the pre-state, a (13, dbc-14) database that holds rows', () => {
  it('thirty files applied, set 15 pending; this code is refused by B-3 and the code of set 14 passes', async () => {
    await seedSetFourteen(owner());
    const ledger = await inspectLedger(owner());
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner(), folderOf(THROUGH))).pending).toEqual([...TAGS]);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    // The pair this code expects is read from its constants: it moves with every later set.
    expect((error as BootCheckError).message).toBe(
      `B-3: the database is at schema version 13 (dbc-14); this server expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
    await expect(checkSchemaVersion(db.appPool(), SET_14)).resolves.toBeUndefined();
  });

  it('rows of the kind a used database holds: the settings row on eth1, two aliases; both CHECKs hold the lower-case form', async () => {
    expect(await storedBefore(owner())).toMatchObject([{ settings: 1, interface_name: 'eth1', aliases: 2 }]);
    expect(await patternOf(owner(), NAME_CHECK)).toBe(NAME_BEFORE);
    expect(await patternOf(owner(), ALIAS_NAME_CHECK)).toBe(NAME_BEFORE);
  });

  it('THE STATE THAT IS MISSING (F-4): a port the kernel names with a capital cannot be stored - 23514 in the settings and in an alias row', async () => {
    await expectRefused(() => setName(db.appPool(), CAPITAL_NAME), SQLSTATE.checkViolation, NAME_CHECK);
    await expectRefused(() => insertRow(owner(), 'host_network_aliases', hostNetworkAlias({ interface_name: CAPITAL_NAME, ...ALIAS_CLOSED, address: '10.9.9.253/24' })), SQLSTATE.checkViolation, ALIAS_NAME_CHECK);
    expect(await storedBefore(owner())).toMatchObject([{ settings: 1, interface_name: 'eth1', aliases: 2 }]);
  });

  it('THE STATE THAT IS MISSING (S2-02): there is no stored port list - the column does not exist (42703)', async () => {
    await expectRefused(() => db.appPool().query(`SELECT onvif_ports FROM ${CONFIG}`), UNDEFINED_COLUMN);
  });
});

describe('M15S-2: NEGATIVE CONTROL - without 0031 the column is there but not writable, and the version is not stepped', () => {
  it('0030 alone: the default is in the row and both forms are widened, the runtime role may not write the list (42501), the version stays (13, dbc-14)', async () => {
    await withClone('set15_no0031', async (other) => {
      await seedSetFourteen(other.ownerPool());
      await migrateThrough(other.ownerPool(), THROUGH - 1, SET_14);
      expect(await portsNow(other.ownerPool())).toEqual([{ onvif_ports: [80] }]);
      expect(await patternOf(other.ownerPool(), NAME_CHECK)).toBe(NAME_AFTER);
      await expectRefused(() => setPorts(other.appPool(), json([80, 8080])), SQLSTATE.insufficientPrivilege);
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expect(checkSchemaVersion(other.appPool(), SET_14)).resolves.toBeUndefined();
    });
  });
});

describe('M15S-3: set 15 applies its two files; the existing row keeps its interface name and gains [80]', () => {
  it('db:migrate applies exactly 0030 and 0031 and steps the version to (14, dbc-15); the ledger holds thirty-two files; one grant is new; no other stored value moved', async () => {
    const rowsBefore = await storedBefore(owner());
    const objectsBefore = (await owner().query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    const grantsBefore = await grantLines(owner());
    const folder = folderOf(THROUGH);
    expect(await readSchemaVersion(owner())).toEqual(SET_14);
    expect((await inspectLedger(owner(), folder)).pending).toEqual([...TAGS]);
    expect([await checksOn(owner(), CONFIG), await checksOn(owner(), ALIASES)]).toEqual([8, 8]);
    await migrateThrough(owner(), THROUGH, SET_15);
    const ledger = await inspectLedger(owner(), folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner())).toHaveLength(THROUGH);
    // No table, no index, no sequence: the count of objects is what it was.
    expect((await owner().query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore);
    // THE EXISTING ROW: its interface name and every other value are what they were (MG-8) ...
    expect(await storedBefore(owner())).toEqual(rowsBefore);
    expect(await storedBefore(owner())).toMatchObject([{ settings: 1, interface_name: 'eth1', aliases: 2 }]);
    // ... and it gained the list of port 80 alone: today's behaviour of the destination rule.
    expect(await portsNow(owner())).toEqual([{ onvif_ports: [80] }]);
    expect((await owner().query(`SELECT revision::int AS revision, alias_minutes::int AS alias_minutes, factory_addresses FROM ${CONFIG}`)).rows).toEqual([
      { revision: 7, alias_minutes: 45, factory_addresses: ['192.168.1.64', '10.0.0.2'] },
    ]);
    // The column as the catalog holds it: the last one, jsonb, NOT NULL, default the list of 80.
    expect(
      (await owner().query("SELECT column_name::text AS name, data_type::text AS type, is_nullable::text AS nullable, column_default::text AS fallback, ordinal_position::int AS place FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capture_network_config' ORDER BY ordinal_position DESC LIMIT 1")).rows,
    ).toEqual([{ name: 'onvif_ports', type: 'jsonb', nullable: 'NO', fallback: "'[80]'::jsonb", place: 11 }]);
    // The privileges of the NEW COLUMN are the only new lines, and no other moved: UPDATE is the
    // grant of 0031; INSERT and SELECT are the table-level grants of 0018, which the catalog view
    // states for every column of the table.
    const grantsAfter = await grantLines(owner());
    expect(grantsAfter.filter((line) => !grantsBefore.includes(line))).toEqual([
      'column grant capture_network_config.onvif_ports INSERT',
      'column grant capture_network_config.onvif_ports SELECT',
      'column grant capture_network_config.onvif_ports UPDATE',
    ]);
    expect(grantsBefore.filter((line) => !grantsAfter.includes(line))).toEqual([]);
    // Both name CHECKs came back under their names, validated, with the helper's own form; two CHECKs are new.
    expect((await owner().query(`SELECT conname::text AS name, convalidated FROM pg_constraint WHERE conname IN ('${NAME_CHECK}', '${ALIAS_NAME_CHECK}', '${PORTS_CHECK}', '${DISTINCT_CHECK}') ORDER BY 1`)).rows).toEqual([
      { name: NAME_CHECK, convalidated: true },
      { name: PORTS_CHECK, convalidated: true },
      { name: DISTINCT_CHECK, convalidated: true },
      { name: ALIAS_NAME_CHECK, convalidated: true },
    ]);
    expect(await patternOf(owner(), NAME_CHECK)).toBe(NAME_AFTER);
    expect(await patternOf(owner(), ALIAS_NAME_CHECK)).toBe(NAME_AFTER);
    expect([await checksOn(owner(), CONFIG), await checksOn(owner(), ALIASES)]).toEqual([10, 8]);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const before = await readAppliedMigrations(owner());
    const objectsBefore = await owner().query(objects);
    const catalogBefore = await catalogDigest(owner());
    await applyMigrations(owner(), folderOf(THROUGH)).catch(() => undefined);
    expect(await readSchemaVersion(owner())).toEqual(SET_15);
    expect(await readAppliedMigrations(owner())).toEqual(before);
    expect((await owner().query(objects)).rows).toEqual(objectsBefore.rows);
    expect(await catalogDigest(owner())).toEqual(catalogBefore);
  });

  it('a FIRST-USE row (a database migrated empty, the row inserted by the runtime role without naming the column) starts with [80]', async () => {
    await withClone('set15_first_use', async (other) => {
      await migrateThrough(other.ownerPool(), THROUGH, SET_15);
      await insertRbac(other.ownerPool());
      await insertRow(other.appPool(), 'capture_network_config', captureNetworkConfig({ interface_name: null, camera_subnet: null }));
      expect((await other.appPool().query(`SELECT interface_name, onvif_ports FROM ${CONFIG}`)).rows).toEqual([{ interface_name: null, onvif_ports: [80] }]);
    });
  });
});

describe('M15S-4: what the database accepts and what it refuses, as dems_app', () => {
  it.each([
    ['the name of finding F-4 (a PCI domain)', CAPITAL_NAME],
    ['upper case throughout', 'ETH0'],
    ['one character', 'a'],
    ['a leading digit', '0eth'],
    ['fifteen characters, the longest', 'Abcdefghij_.-45'],
    ['a bridge with a VLAN', 'br-lan.10'],
    ['the name the row held', 'eth1'],
  ])('AN INTERFACE NAME OF THE HELPER\'S FORM IS ACCEPTED: %s', async (_what, name) => {
    expect(await outcome(setName(db.appPool(), name))).toBe('ok:1');
    expect((await owner().query(`SELECT interface_name FROM ${CONFIG}`)).rows).toEqual([{ interface_name: name }]);
  });

  it.each([
    ['a blank inside', 'eth 0'],
    ['a shell character', 'eth0;reboot'],
    ['a slash', 'eth/0'],
    ['a leading hyphen (an option to a program)', '-eth0'],
    ['a leading dot', '.eth0'],
    ['a leading underscore', '_eth0'],
    ['sixteen characters', 'abcdefghijklmnop'],
    ['the empty text', ''],
    ['a line end after the name', 'eth0\n'],
    ['a letter outside ASCII', 'éth0'],
    ['a colon (an alias label of the old tools)', 'eth0:1'],
  ])('AN INTERFACE NAME OUTSIDE THE FORM IS REFUSED (23514): %s', async (_what, name) => {
    await expectRefused(() => setName(db.appPool(), name), SQLSTATE.checkViolation, NAME_CHECK);
    await expectRefused(() => insertRow(db.appPool(), 'host_network_aliases', hostNetworkAlias({ interface_name: name, ...ALIAS_CLOSED, address: '10.20.40.253/24' })), SQLSTATE.checkViolation, ALIAS_NAME_CHECK);
  });

  it('an alias row on a port named with a capital is accepted (closed, so that the one alias in place stays the one)', async () => {
    await insertRow(db.appPool(), 'host_network_aliases', hostNetworkAlias({ interface_name: CAPITAL_NAME, ...ALIAS_CLOSED, address: '10.20.41.253/24' }));
    expect((await owner().query(`SELECT count(*)::int AS rows FROM ${ALIASES} WHERE interface_name = '${CAPITAL_NAME}'`)).rows).toEqual([{ rows: 1 }]);
  });

  it.each([
    ['port 80 alone, the default', [80]],
    ['two ports, 80 first', [80, 8080]],
    ['two ports, 8080 first: the order is kept, the first is the port of an address that names none', [8080, 80]],
    ['the two ends of the range', [1, 65535]],
    ['eight ports, the bound of the rule', [80, 81, 8000, 8080, 8081, 8899, 2020, 5000]],
  ])('A PORT LIST INSIDE THE BOUNDS IS ACCEPTED: %s', async (_what, ports) => {
    expect(await outcome(setPorts(db.appPool(), json(ports)))).toBe('ok:1');
    expect(await portsNow(owner())).toEqual([{ onvif_ports: ports }]);
  });

  it.each([
    ['NINE PORTS', '[80, 81, 82, 83, 84, 85, 86, 87, 88]', PORTS_CHECK],
    ['PORT 0', '[0]', PORTS_CHECK],
    ['PORT 0 beside a good one', '[80, 0]', PORTS_CHECK],
    ['PORT 65536', '[65536]', PORTS_CHECK],
    ['a negative port', '[-80]', PORTS_CHECK],
    ['a number that is not whole', '[80.5]', PORTS_CHECK],
    ['the port as a text', '["80"]', PORTS_CHECK],
    ['a null element', '[80, null]', PORTS_CHECK],
    ['a truth value', '[true]', PORTS_CHECK],
    ['a list inside the list', '[[80]]', PORTS_CHECK],
    ['an object inside the list', '[{"port": 80}]', PORTS_CHECK],
    ['the empty list (the rule refuses it too: PORT_LIST_INVALID)', '[]', PORTS_CHECK],
    ['a number that is no list', '80', PORTS_CHECK],
    ['a text that is no list', '"80"', PORTS_CHECK],
    ['an object that is no list', '{"0": 80}', PORTS_CHECK],
    ['the JSON null', 'null', PORTS_CHECK],
    ['A PORT TWICE', '[80, 80]', DISTINCT_CHECK],
    ['a port twice, apart', '[80, 8080, 80]', DISTINCT_CHECK],
    ['a port twice at the last two of eight places', '[1, 2, 3, 4, 5, 6, 7, 7]', DISTINCT_CHECK],
    ['a port twice at the first and the last of eight places', '[1, 2, 3, 4, 5, 6, 7, 1]', DISTINCT_CHECK],
    ['one port written two ways', '[80, 80.0]', DISTINCT_CHECK],
  ])('A PORT LIST OUTSIDE A BOUND IS REFUSED (23514): %s', async (_what, ports, constraint) => {
    const before = await portsNow(owner());
    await expectRefused(() => setPorts(db.appPool(), ports), SQLSTATE.checkViolation, constraint);
    expect(await portsNow(owner())).toEqual(before);
  });

  it('no list at all is refused: the column is NOT NULL (23502)', async () => {
    await expectRefused(() => setPorts(db.appPool(), null), SQLSTATE.notNullViolation);
  });

  it('every pair of places is held: a list of eight with ANY two equal is refused (28 pairs)', async () => {
    const distinct = [11, 12, 13, 14, 15, 16, 17, 18];
    let refusedPairs = 0;
    for (let first = 0; first < distinct.length; first += 1) {
      for (let second = first + 1; second < distinct.length; second += 1) {
        const ports = [...distinct];
        ports[second] = ports[first] ?? 0;
        await expectRefused(() => setPorts(db.appPool(), json(ports)), SQLSTATE.checkViolation, DISTINCT_CHECK);
        refusedPairs += 1;
      }
    }
    expect(refusedPairs).toBe(28);
    expect(await outcome(setPorts(db.appPool(), json(distinct)))).toBe('ok:1');
  });

  it('the runtime role writes every column of the settings but the key, and removes nothing (42501)', async () => {
    const app = db.appPool();
    const { rows } = await owner().query<{ name: string }>(`SELECT attname::text AS name FROM pg_attribute WHERE attrelid = '${CONFIG}'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('dems_app', attrelid, attnum, 'UPDATE') ORDER BY attnum`);
    expect(rows.map((row) => row.name)).toEqual(['interface_name', 'camera_subnet', 'factory_addresses', 'alias_host', 'alias_minutes', 'camera_ip_start', 'revision', 'updated_by', 'updated_at', 'onvif_ports']);
    await expectRefused(() => app.query(`UPDATE ${CONFIG} SET singleton = true`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`DELETE FROM ${CONFIG}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`TRUNCATE ${CONFIG}`), SQLSTATE.insufficientPrivilege);
  });

  it('the rules beside the two hold: the subnet, the factory list and the bounds of set 9 still refuse', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query(`UPDATE ${CONFIG} SET camera_subnet = '192.168.1.0/8'`), SQLSTATE.checkViolation, 'capture_network_config_camera_subnet_check');
    await expectRefused(() => app.query(`UPDATE ${CONFIG} SET factory_addresses = '[["192.168.1.64"]]'::jsonb`), SQLSTATE.checkViolation, 'capture_network_config_factory_addresses_check');
    await expectRefused(() => app.query(`UPDATE ${CONFIG} SET alias_minutes = 481`), SQLSTATE.checkViolation, 'capture_network_config_alias_minutes_check');
  });
});

describe('M15S-5: B-3 across the step, in both directions', () => {
  it('the code of set 14 (13, dbc-14) on the migrated database is refused; the code of set 15 passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_14).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 14 (dbc-15); this server expects 13 (dbc-14)');
    await expect(checkSchemaVersion(db.appPool(), SET_15)).resolves.toBeUndefined();
    // This code passes exactly while set 15 is the last set; with a later set it names db:migrate.
    const here = await checkSchemaVersion(db.appPool()).then(
      () => 'passes',
      () => 'refused',
    );
    expect(here).toBe(isThisCode(SET_15) ? 'passes' : 'refused');
  });
});

describe('M15S-6: rollback', () => {
  it('FAILS WHILE APPLYING: the two files inside one transaction, rolled back before the commit, leave the catalog, the rows, the version and the ledger as they were', async () => {
    await withClone('set15_rollback_tx', async (other) => {
      const pool = other.ownerPool();
      await seedSetFourteen(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      const ledgerBefore = await readAppliedMigrations(pool);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const tag of TAGS) for (const chunk of chunksOf(tag)) await client.query(chunk);
        // Inside the transaction the set is in force: the name and the list are admitted and the version is stepped.
        await client.query(`UPDATE ${CONFIG} SET interface_name = '${CAPITAL_NAME}', onvif_ports = '[80, 8080]'::jsonb`);
        expect((await client.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows).toEqual([{ schema_version: 14, contract_revision: 'dbc-15' }]);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      expect(await readSchemaVersion(pool)).toEqual(SET_14);
      expect(await readAppliedMigrations(pool)).toEqual(ledgerBefore);
      expect((await inspectLedger(pool)).pending).toEqual([...TAGS, ...LATER]);
      await expect(checkSchemaVersion(other.appPool(), SET_14)).resolves.toBeUndefined();
      await expectRefused(() => other.appPool().query(`SELECT onvif_ports FROM ${CONFIG}`), UNDEFINED_COLUMN);
    });
  });

  it('APPLIED, AND MUST BE UNDONE: the undo statements return the catalog to the one of (13, dbc-14), every other stored value is what it was, and the code of set 14 starts again', async () => {
    await withClone('set15_rollback_undo', async (other) => {
      const pool = other.ownerPool();
      await seedSetFourteen(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      await migrateThrough(pool, THROUGH, SET_15);
      expect((await catalogDigest(pool)).digest).not.toBe(catalogBefore.digest);
      // A port list was stored in between: the undo loses it, and says so (the comment of UNDO_SET_15).
      await setPorts(other.appPool(), json([80, 8080]));
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_15) await client.query(statement);
        // In a delivered forward set the version steps ONWARD; here it is set to the pair of set 14
        // so that the comparison below is with the database as it was.
        await client.query("UPDATE public.schema_meta SET schema_version = 13, contract_revision = 'dbc-14' WHERE singleton");
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      await expect(checkSchemaVersion(other.appPool(), SET_14)).resolves.toBeUndefined();
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expectRefused(() => setName(other.appPool(), CAPITAL_NAME), SQLSTATE.checkViolation, NAME_CHECK);
      await expectRefused(() => other.appPool().query(`SELECT onvif_ports FROM ${CONFIG}`), UNDEFINED_COLUMN);
      // The settings of set 9 are untouched by the undo of set 15.
      expect(await outcome(setName(other.appPool(), 'eth2'))).toBe('ok:1');
    });
  });

  it.each([
    ['the settings row', async (other: TestDatabase): Promise<void> => void (await setName(other.appPool(), CAPITAL_NAME))],
    ['a CLOSED alias row (history)', async (other: TestDatabase): Promise<void> => insertRow(other.appPool(), 'host_network_aliases', hostNetworkAlias({ interface_name: CAPITAL_NAME, ...ALIAS_CLOSED, address: '10.20.42.253/24' }))],
  ])('THE PRECONDITION OF THE UNDO: while %s holds a name with a capital the undo is refused (55000) and changes nothing - a stored name is not rewritten', async (_where, plant) => {
    await withClone('set15_held', async (other) => {
      const pool = other.ownerPool();
      await seedSetFourteen(pool);
      await migrateThrough(pool, THROUGH, SET_15);
      await plant(other);
      const catalogApplied = await catalogDigest(pool);
      const rowsApplied = await storedBefore(pool);
      const client = await pool.connect();
      let refusal: string | undefined;
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_15) await client.query(statement);
        await client.query('COMMIT');
      } catch (error) {
        refusal = (error as { code?: string }).code;
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(refusal).toBe(NOT_IN_PREREQUISITE_STATE);
      expect(await catalogDigest(pool)).toEqual(catalogApplied);
      expect(await storedBefore(pool)).toEqual(rowsApplied);
      expect(await readSchemaVersion(pool)).toEqual(SET_15);
      expect(await portsNow(pool)).toEqual([{ onvif_ports: [80] }]);
    });
  });
});

describe('M15S-7: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');
  const PORTS = '"capture_network_config"."onvif_ports"';
  const pairs: string[] = [];
  for (let first = 0; first < 8; first += 1) for (let second = first + 1; second < 8; second += 1) pairs.push(`(${PORTS} -> ${first}) = (${PORTS} -> ${second})`);

  it('0030 is generated: two CHECKs dropped, the column added with its default, its two CHECKs, the two name CHECKs added again under their names - and no statement that writes a row (MG-2, MG-8)', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toEqual([
      `ALTER TABLE "capture_network_config" DROP CONSTRAINT "${NAME_CHECK}";`,
      `ALTER TABLE "host_network_aliases" DROP CONSTRAINT "${ALIAS_NAME_CHECK}";`,
      `ALTER TABLE "capture_network_config" ADD COLUMN "onvif_ports" jsonb DEFAULT '[80]'::jsonb NOT NULL;`,
      `ALTER TABLE "capture_network_config" ADD CONSTRAINT "${PORTS_CHECK}" CHECK (CASE WHEN jsonb_typeof(${PORTS}) = 'array' THEN jsonb_array_length(${PORTS}) BETWEEN 1 AND 8 AND NOT jsonb_path_exists(${PORTS}, 'strict $[*]?(@.type() != "number")') AND NOT jsonb_path_exists(${PORTS}, 'strict $[*]?(@ < 1 || @ > 65535)') AND NOT jsonb_path_exists(${PORTS}, 'strict $[*]?(@ != @.floor())') ELSE false END);`,
      `ALTER TABLE "capture_network_config" ADD CONSTRAINT "${DISTINCT_CHECK}" CHECK (CASE WHEN jsonb_typeof(${PORTS}) = 'array' THEN NOT (${pairs.join(' OR ')}) ELSE false END);`,
      `ALTER TABLE "capture_network_config" ADD CONSTRAINT "${NAME_CHECK}" CHECK ("capture_network_config"."interface_name" IS NULL OR "capture_network_config"."interface_name" ~ '${NAME_AFTER}');`,
      `ALTER TABLE "host_network_aliases" ADD CONSTRAINT "${ALIAS_NAME_CHECK}" CHECK ("host_network_aliases"."interface_name" ~ '${NAME_AFTER}');`,
    ]);
    expect(pairs).toHaveLength(28);
    const text = generated.join(' ');
    expect(text).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/);
    expect(text).not.toMatch(/NOT VALID|CREATE TABLE|DROP TABLE|DROP COLUMN|DROP NOT NULL/i);
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[0]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('THE FORM IS THE HELPER\'S OWN: the pattern of the table and the pattern of the helper script admit and refuse the same names', () => {
    // The helper is read, never run: its pattern line is taken from the script as it stands.
    const helper = readFileSync(join(MIGRATIONS_FOLDER, '..', '..', '..', '..', '..', 'scripts', 'host', 'netalias', 'dems-core-netalias'), 'utf8');
    const line = /^INTERFACE_NAME = re\.compile\(r"\\A(.+)\\Z"\)$/m.exec(helper)?.[1];
    expect(line).toBe('[A-Za-z0-9][A-Za-z0-9_.-]{0,14}');
    expect(`^${line}$`).toBe(NAME_AFTER);
  });

  it('0031 is hand-written: the one grant and the version row - no revoke, no blanket form, no owner role', () => {
    // A hand-written file carries no marker (D38): it is one chunk, read here statement by statement.
    const written = statementsOf(TAGS[1]).flatMap((chunk) => chunk.split(/(?<=;)\s+/));
    expect(written).toEqual([
      'GRANT UPDATE (onvif_ports) ON capture_network_config TO dems_app;',
      "UPDATE public.schema_meta SET schema_version = 14, contract_revision = 'dbc-15' WHERE singleton;",
    ]);
    expect(written.join(' ')).not.toMatch(/REVOKE|ALL\s+TABLES|dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER|DELETE/i);
  });

  it('0028 and 0029 hash to what they hashed to when set 14 was delivered: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0028_alias_removal_reason_unconfirmed']).toBe('41a87891bff9384a434c5d3352b6298671853affe8e718d96397e0006be67674');
    expect(hashes['0029_alias_removal_reason_unconfirmed_privileges']).toBe('4fdfef3ea2d05eaa4efeb121995180f3c005e254f9454e71aba7eb9de066ef0f');
  });
});
