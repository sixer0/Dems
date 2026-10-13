// Migration set 9 (`0017_network_commissioning.sql` + `0018_network_commissioning_privileges.sql`;
// schema set B of task 4, contract revision `dbc-9`, schema version 8; design
// `docs/2026-10-12_input_av_core_adapter_plan/masterplan/03_db_schema_extension.md` sections 2.4
// and 2.5; decisions U10, U11 (OQ-4), C9; plan review P12-F07; findings of rows 67 and 156):
//
//   (a) T-46 `capture_network_config`: the network settings of the commissioning functions;
//   (b) T-47 `host_network_aliases`: the state of the one temporary address on the camera port;
//   (c) `capture_audio_inputs.usb_serial` and `usb_port`: which unit of a product, on which port;
//   (d) the two stored rows of the commissioning permission, on a database that is already seeded.
//
//   M9S-1  the pre-state is a genuine (7, 'dbc-8') database that HOLDS ROWS (roles, operators,
//          devices, two sound-card inputs): this code is refused by B-3 naming db:migrate, the
//          code of set 8 is accepted
//   M9S-2  NEGATIVE CONTROL: with 0018 left out the two tables exist, the runtime role holds
//          nothing on them, no permission row is written and the version stays (7, 'dbc-8')
//   M9S-3  set 9 applies exactly its two files, REWRITES NO STORED ROW (MG-8), ends at
//          (8, 'dbc-9'); a second run applies nothing (MG-10)
//   M9S-4  (d) the permission: one row, held by TECHNICIAN alone, sort order 15; an EMPTY database
//          gets no row; the two statements are idempotent
//   M9S-5  (a) as dems_app: the default row at first use holds input-av's defaults and NO
//          interface; the settings are changed, never removed; what is no setting is refused
//   M9S-6  (b) as dems_app: ONE alias at a time; a second open alias on one address is refused;
//          an alias is extended and closed, never rewritten into another one, never removed
//   M9S-7  (c) as dems_app: the serial and the port of a card are stored and changed; a
//          descriptor string as a device wrote it is refused
//   M9S-8  B-3 across the step, in both directions
//   M9S-9  ROLLBACK: the set inside one transaction, rolled back, leaves the catalog, the rows and
//          the version as they were; the undo statements return an applied database to the
//          catalog and the rows of (7, 'dbc-8') and refuse to run while an alias is open
//   M9S-10 the files: 0017 holds no data statement; 0018 is ten statements, no blanket form;
//          0015 and 0016 hash to what the development databases hold (MG-4)
//
// Every database here is a throw-away of this test run (TI-17). No address in this file is the
// address of a device: they are fixture texts the CHECKs accept or refuse.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROLE_PERMISSIONS } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { rbacRows } from '../../src/db/mapping';
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
import { useTestDatabase } from '../helpers/db';
import { ALIAS_CLOSED, T, captureAudioInput, captureDevice, captureNetworkConfig, hostNetworkAlias, insertRbac, insertRow, json } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0017_network_commissioning', '0018_network_commissioning_privileges'] as const;
/** The files of the sets after set 9 (set 10, task 4 package X-C, and whatever follows it): pending on a database of set 9. */
const LATER: readonly string[] = INITIAL_MIGRATION_TAGS.slice(19);
const NETWORK = 'public.capture_network_config';
const ALIASES = 'public.host_network_aliases';
const INPUTS = 'public.capture_audio_inputs';
const PERMISSION = 'CAPTURE_COMMISSION';
const SET_8 = { schemaVersion: 7, contractRevision: 'dbc-8' } as const;
const SET_9 = { schemaVersion: 8, contractRevision: 'dbc-9' } as const;
const MINUTE = 60_000;
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set9-'));
  temporary.push(folder);
  mkdirSync(join(folder, 'meta'));
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
  writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }));
  for (const tag of INITIAL_MIGRATION_TAGS.slice(0, count)) cpSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), join(folder, `${tag}.sql`));
  return folder;
}

/** Applies the first `count` files; the applier then reports that the version is not this code's. */
async function migrateShort(pool: Pool, count: number): Promise<void> {
  const error = await applyMigrations(pool, folderOf(count)).catch((thrown: unknown) => thrown);
  expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
  expect(await readSchemaVersion(pool)).toEqual(SET_8);
}

/**
 * Applies set 9 and stops there: the applier commits through 0018, then reports that the version
 * is not this code's - the device of set8.db.test.ts, since set 10 exists.
 */
async function migrateSetNine(pool: Pool): Promise<void> {
  const error = await applyMigrations(pool, folderOf(19)).catch((thrown: unknown) => thrown);
  expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
  expect(await readSchemaVersion(pool)).toEqual(SET_9);
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
 * What the tables that existed before the set hold, as digests of whole row images. The image of a
 * sound-card input is taken WITHOUT the two columns the set adds, so "before" and "after" are
 * comparable: the columns themselves are asserted apart (every existing row reads NULL).
 */
const storedBefore = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT (SELECT count(*)::int FROM public.roles) AS roles,
            (SELECT count(*)::int FROM public.operators) AS operators,
            (SELECT count(*)::int FROM public.capture_devices) AS devices,
            (SELECT count(*)::int FROM public.capture_audio_inputs) AS inputs,
            (SELECT md5(string_agg(to_jsonb(r)::text, '' ORDER BY r.id)) FROM public.roles AS r) AS role_rows,
            (SELECT md5(string_agg(to_jsonb(o)::text, '' ORDER BY o.id)) FROM public.operators AS o) AS operator_rows,
            (SELECT md5(string_agg(to_jsonb(d)::text, '' ORDER BY d.id)) FROM public.capture_devices AS d) AS device_rows,
            (SELECT md5(string_agg((to_jsonb(i) - 'usb_serial' - 'usb_port')::text, '' ORDER BY i.device_id)) FROM public.capture_audio_inputs AS i) AS input_rows`,
  )).rows;
/** The permissions and the grants a database holds, in stored order. */
const storedMatrix = async (owner: Pool): Promise<{ permissions: unknown[]; grants: unknown[] }> => ({
  permissions: (await owner.query('SELECT id, sort_order::int AS sort_order FROM public.permissions ORDER BY sort_order')).rows,
  grants: (await owner.query('SELECT role_id, permission_id FROM public.role_permissions ORDER BY 1, 2')).rows,
});
const objects = "SELECT count(*)::int AS objects FROM pg_class WHERE relnamespace = 'public'::regnamespace";

/**
 * The catalog of schema `public` as one digest: every column with type, nullability and default,
 * every key and CHECK with its definition, every index, and every privilege of the runtime role.
 * Two databases with the same digest have the same schema as far as this set can change one.
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

const tablesPresent = async (pool: Pool): Promise<unknown> =>
  (await pool.query(`SELECT to_regclass('${NETWORK}') IS NOT NULL AS network, to_regclass('${ALIASES}') IS NOT NULL AS aliases`)).rows;
const inputColumns = async (pool: Pool): Promise<number> =>
  (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capture_audio_inputs' AND column_name IN ('usb_serial', 'usb_port')")).rows[0]?.n ?? -1;

/**
 * THE UNDO OF AN APPLIED SET 9 (schema design 3.5, "Applied, and must be undone"). The files of an
 * applied set are never edited and no down file exists in this repository, so an undo is delivered
 * as a NEW forward set that carries these statements and steps the version onward. They are kept
 * here, where a test runs them, so that the rollback is measured and not only described.
 * PRECONDITION: no alias row is open - the first statement refuses otherwise. An open row is an
 * address on the host; dropping the table would leave that address with no record of whose it is.
 * Remove the address through the helper first, close the row, then undo.
 * WHAT IT LOSES: the network settings (entered again), the alias history (the audit entries
 * remain), the serial and the port of every registered sound card (read again by a registration),
 * and the commissioning permission of TECHNICIAN - so the code that names the permission must go
 * in the same release, or the boot refuses the stored matrix.
 */
const UNDO_SET_9: readonly string[] = [
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.host_network_aliases WHERE removed_at IS NULL) THEN RAISE EXCEPTION 'an alias is still open: remove the address and close the row first' USING ERRCODE = 'object_not_in_prerequisite_state'; END IF; END $$`,
  'DROP TABLE public.host_network_aliases',
  'DROP TABLE public.capture_network_config',
  'ALTER TABLE public.capture_audio_inputs DROP COLUMN usb_port',
  'ALTER TABLE public.capture_audio_inputs DROP COLUMN usb_serial',
  `DELETE FROM public.role_permissions WHERE permission_id = '${PERMISSION}'`,
  `DELETE FROM public.permissions WHERE id = '${PERMISSION}'`,
];
/** SQLSTATE 55000, `object_not_in_prerequisite_state`: what the guard of the undo raises. */
const NOT_IN_PREREQUISITE_STATE = '55000';

/** A (7, dbc-8) database with the rows of M9S-1. */
async function seedSetEight(owner: Pool): Promise<void> {
  await migrateShort(owner, 17);
  await insertRbac(owner);
  for (const [id, kind] of [['CAM-01', 'CAMERA'], ['MIC-01', 'MIC'], ['MIC-02', 'MIC'], ['MIC-03', 'MIC']] as const) await insertRow(owner, 'capture_devices', captureDevice(id, kind));
  await insertRow(owner, 'capture_audio_inputs', captureAudioInput('MIC-01'));
  await insertRow(owner, 'capture_audio_inputs', captureAudioInput('MIC-02', { usb_id: null, input_number: 2 }));
}

describe('M9S-1: the pre-state, a (7, dbc-8) database that holds rows', () => {
  it('seventeen files applied, set 9 pending, no table and no column; this code is refused by B-3 and the code of set 8 passes', async () => {
    const owner = db.ownerPool();
    await seedSetEight(owner);
    const ledger = await inspectLedger(owner);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner, folderOf(19))).pending).toEqual([...TAGS]);
    expect(await tablesPresent(owner)).toEqual([{ network: false, aliases: false }]);
    expect(await inputColumns(owner)).toBe(0);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    // The pair this code expects is read from its constants: it moves with every later set.
    expect((error as BootCheckError).message).toBe(
      `B-3: the database is at schema version 7 (dbc-8); this server expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
    await expect(checkSchemaVersion(db.appPool(), SET_8)).resolves.toBeUndefined();
  });

  it('rows of the kind a seeded database holds: three roles with TECHNICIAN among them, four operators, four devices, two sound-card inputs; no commissioning permission', async () => {
    const owner = db.ownerPool();
    expect(await storedBefore(owner)).toMatchObject([{ roles: 3, operators: 4, devices: 4, inputs: 2 }]);
    const matrix = await storedMatrix(owner);
    expect(matrix.permissions).toHaveLength(5);
    expect(JSON.stringify(matrix)).not.toContain(PERMISSION);
  });

  it('THE STATE THAT IS MISSING: two cards of one product cannot be told apart - the stored row has no place for a port or a serial number (42703)', async () => {
    await expectRefused(() => db.appPool().query(`UPDATE ${INPUTS} SET usb_port = '1-1.4' WHERE device_id = 'MIC-01'`), '42703');
  });
});

describe('M9S-2: NEGATIVE CONTROL - without 0018 the runtime role holds nothing on the two tables and no permission is written', () => {
  it('0017 alone: the tables and the columns exist, SELECT and INSERT answer 42501, the stored matrix is as it was, the version stays (7, dbc-8)', async () => {
    const other = await db.another({ template: EMPTY_DATABASE, slug: 'set9_no0018' });
    const owner = other.ownerPool();
    await seedSetEight(owner);
    const matrixBefore = await storedMatrix(owner);
    await migrateShort(owner, 18);
    expect(await tablesPresent(owner)).toEqual([{ network: true, aliases: true }]);
    expect(await inputColumns(owner)).toBe(2);
    for (const table of [NETWORK, ALIASES]) await expectRefused(() => other.appPool().query(`SELECT 1 FROM ${table}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => insertRow(other.appPool(), 'capture_network_config', captureNetworkConfig()), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => insertRow(other.appPool(), 'host_network_aliases', hostNetworkAlias()), SQLSTATE.insufficientPrivilege);
    // The new columns are readable (the table-level SELECT of 0016 covers them) and not yet writable.
    expect((await other.appPool().query(`SELECT usb_serial, usb_port FROM ${INPUTS} WHERE device_id = 'MIC-01'`)).rows).toEqual([{ usb_serial: null, usb_port: null }]);
    await expectRefused(() => other.appPool().query(`UPDATE ${INPUTS} SET usb_port = '1-1.4' WHERE device_id = 'MIC-01'`), SQLSTATE.insufficientPrivilege);
    expect(await storedMatrix(owner)).toEqual(matrixBefore);
    await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
    await expect(checkSchemaVersion(other.appPool(), SET_8)).resolves.toBeUndefined();
  });
});

describe('M9S-3: set 9 applies its two files and rewrites no stored row', () => {
  it('db:migrate applies exactly 0017 and 0018 and steps the version to (8, dbc-9); the ledger holds nineteen files (the set stops at 0018); every stored row is what it was', async () => {
    const owner = db.ownerPool();
    const rowsBefore = await storedBefore(owner);
    const objectsBefore = (await owner.query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    // The set stops at 0018: the applier commits the two files, then reports that the version is
    // not this code's - the device of set8.db.test.ts, since set 10 exists.
    const folder = folderOf(19);
    expect(await readSchemaVersion(owner)).toEqual(SET_8);
    expect((await inspectLedger(owner, folder)).pending).toEqual([...TAGS]);
    const error = await applyMigrations(owner, folder).catch((thrown: unknown) => thrown);
    expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
    expect(await readSchemaVersion(owner)).toEqual(SET_9);
    expect({ schemaVersion: DB_SCHEMA_VERSION, contractRevision: DB_CONTRACT_REVISION }).not.toEqual(SET_9);
    const ledger = await inspectLedger(owner, folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner)).toHaveLength(19);
    // Exactly six new objects: two tables, the index of each primary key, and the two partial
    // unique indexes on an open alias.
    expect((await owner.query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore + 6);
    // MG-8: nothing was rewritten and nothing was backfilled.
    expect(await storedBefore(owner)).toEqual(rowsBefore);
    expect((await owner.query(`SELECT device_id, usb_serial, usb_port FROM ${INPUTS} ORDER BY device_id`)).rows).toEqual([
      { device_id: 'MIC-01', usb_serial: null, usb_port: null },
      { device_id: 'MIC-02', usb_serial: null, usb_port: null },
    ]);
    expect((await owner.query(`SELECT (SELECT count(*)::int FROM ${NETWORK}) AS network, (SELECT count(*)::int FROM ${ALIASES}) AS aliases`)).rows).toEqual([{ network: 0, aliases: 0 }]);
    // The CHECKs added to an existing table were validated against the stored rows (no NOT VALID constraint is left).
    expect(
      (await owner.query("SELECT conname::text AS name, convalidated FROM pg_constraint WHERE conname IN ('capture_audio_inputs_usb_serial_check', 'capture_audio_inputs_usb_port_check') ORDER BY 1")).rows,
    ).toEqual([
      { name: 'capture_audio_inputs_usb_port_check', convalidated: true },
      { name: 'capture_audio_inputs_usb_serial_check', convalidated: true },
    ]);
    // The two columns are the LAST of the table, as the typed schema declares them.
    expect(
      (await owner.query<{ name: string }>("SELECT column_name::text AS name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capture_audio_inputs' ORDER BY ordinal_position DESC LIMIT 2")).rows.map((row) => row.name),
    ).toEqual(['usb_port', 'usb_serial']);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const owner = db.ownerPool();
    const before = await readAppliedMigrations(owner);
    const objectsBefore = await owner.query(objects);
    const matrixBefore = await storedMatrix(owner);
    await applyMigrations(owner, folderOf(19)).catch(() => undefined);
    expect(await readSchemaVersion(owner)).toEqual(SET_9);
    expect(await readAppliedMigrations(owner)).toEqual(before);
    expect((await owner.query(objects)).rows).toEqual(objectsBefore.rows);
    expect(await storedMatrix(owner)).toEqual(matrixBefore);
  });
});

describe('M9S-4 (d): the commissioning permission is stored data', () => {
  it('a database that was seeded before the set: one permission row at sort order 15 and one grant - TECHNICIAN, and no other role', async () => {
    const owner = db.ownerPool();
    const matrix = await storedMatrix(owner);
    expect(matrix.permissions).toHaveLength(6);
    expect(matrix.permissions.at(-1)).toEqual({ id: PERMISSION, sort_order: 15 });
    expect((await owner.query(`SELECT role_id FROM public.role_permissions WHERE permission_id = '${PERMISSION}'`)).rows).toEqual([{ role_id: 'TECHNICIAN' }]);
    // The runtime role reads the two rows (the boot reads the stored matrix as dems_app) and writes neither.
    expect((await db.appPool().query(`SELECT count(*)::int AS holders FROM public.role_permissions WHERE permission_id = '${PERMISSION}'`)).rows).toEqual([{ holders: 1 }]);
    await expectRefused(() => db.appPool().query(`INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('SUPERVISOR', '${PERMISSION}')`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => db.appPool().query(`DELETE FROM public.role_permissions WHERE permission_id = '${PERMISSION}'`), SQLSTATE.insufficientPrivilege);
  });

  it('the two statements are idempotent: run again as the owner they write nothing', async () => {
    const owner = db.ownerPool();
    const before = await storedMatrix(owner);
    const inserts = chunksOf(TAGS[1]).filter((chunk) => /INSERT INTO public\.(permissions|role_permissions)/.test(chunk));
    expect(inserts).toHaveLength(2);
    for (const statement of inserts) expect(await outcome(owner.query(statement))).toBe('ok:0');
    expect(await storedMatrix(owner)).toEqual(before);
  });

  it('P12-F07, AGAINST THE REAL SEED: a seeded database without the two rows (what a database seeded before the permission holds) gets from the two statements EXACTLY what the seed of this code writes - the shared vocabulary, row for row', async () => {
    const other = await db.another({ template: 'seed', slug: 'set9_seeded' });
    const owner = other.ownerPool();
    const wanted = rbacRows();
    const seeded = {
      permissions: wanted.permissions.map((row) => ({ id: row.id, sort_order: row.sortOrder })),
      // In the order `storedMatrix` reads them: by role, then by permission, byte by byte (locale C).
      grants: wanted.rolePermissions
        .map((row) => ({ role_id: row.roleId as string, permission_id: row.permissionId as string }))
        .sort((a, b) => (a.role_id !== b.role_id ? (a.role_id < b.role_id ? -1 : 1) : a.permission_id < b.permission_id ? -1 : a.permission_id > b.permission_id ? 1 : 0)),
    };
    // The template was seeded by this code: it holds the fifteen and the twenty-three already.
    expect(await storedMatrix(owner)).toEqual(seeded);
    expect([seeded.permissions.length, seeded.grants.length]).toEqual([15, 23]);
    // Take the two rows away: the stored matrix of a database that was seeded one commit earlier.
    await owner.query(`DELETE FROM public.role_permissions WHERE permission_id = '${PERMISSION}'`);
    await owner.query(`DELETE FROM public.permissions WHERE id = '${PERMISSION}'`);
    expect([(await storedMatrix(owner)).permissions.length, (await storedMatrix(owner)).grants.length]).toEqual([14, 22]);
    const inserts = chunksOf(TAGS[1]).filter((chunk) => /INSERT INTO public\.(permissions|role_permissions)/.test(chunk));
    for (const statement of inserts) expect(await outcome(owner.query(statement))).toBe('ok:1');
    expect(await storedMatrix(owner)).toEqual(seeded);
    // One role holds it (decision U10), and it is the role the shared table names.
    expect(seeded.grants.filter((grant) => grant.permission_id === PERMISSION)).toEqual([{ role_id: 'TECHNICIAN', permission_id: PERMISSION }]);
    expect(Object.entries(ROLE_PERMISSIONS).filter(([, held]) => (held as readonly string[]).includes(PERMISSION)).map(([role]) => role)).toEqual(['TECHNICIAN']);
  });

  it('AN EMPTY DATABASE GETS NO ROW: the migrations hold no role, so the seed writes the whole matrix from the shared vocabulary as before (MG-8)', async () => {
    const other = await db.another({ template: EMPTY_DATABASE, slug: 'set9_empty' });
    await migrateSetNine(other.ownerPool());
    expect(await storedMatrix(other.ownerPool())).toEqual({ permissions: [], grants: [] });
    expect((await other.ownerPool().query('SELECT count(*)::int AS roles FROM public.roles')).rows).toEqual([{ roles: 0 }]);
  });
});

describe('M9S-5 (a): capture_network_config, the network settings of the commissioning functions', () => {
  const FIRST_USE = `INSERT INTO ${NETWORK} (singleton, updated_at) VALUES (true, $1) ON CONFLICT (singleton) DO NOTHING`;
  const settings = async (): Promise<unknown> =>
    (await db.ownerPool().query(`SELECT singleton, interface_name, camera_subnet, factory_addresses, alias_host, alias_minutes, camera_ip_start, revision::int AS revision, updated_by FROM ${NETWORK}`)).rows;

  it('as dems_app: the default row at first use holds the defaults of input-av and NO INTERFACE - the Core never picks the camera port (decision U11, OQ-4)', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(FIRST_USE, [T]))).toBe('ok:1');
    expect(await settings()).toEqual([
      {
        singleton: true,
        interface_name: null,
        camera_subnet: null,
        factory_addresses: ['192.168.1.64', '192.168.1.108', '192.168.0.90', '192.168.1.13'],
        alias_host: 253,
        alias_minutes: 30,
        camera_ip_start: 101,
        revision: 1,
        updated_by: null,
      },
    ]);
    // A second first use writes nothing: one row, the row that was there.
    expect(await outcome(app.query(FIRST_USE, [T + 1]))).toBe('ok:0');
    expect((await db.ownerPool().query(`SELECT count(*)::int AS rows, max(updated_at)::text AS updated_at FROM ${NETWORK}`)).rows).toEqual([{ rows: 1, updated_at: String(T) }]);
    // No column default names an interface: the catalog states it, not only the row.
    expect((await db.ownerPool().query("SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capture_network_config' AND column_name = 'interface_name'")).rows).toEqual([{ column_default: null }]);
  });

  it('the technician chooses the port and changes the settings; the key is never changed and the row never removed (42501)', async () => {
    const app = db.appPool();
    expect(
      await outcome(
        app.query(
          `UPDATE ${NETWORK} SET interface_name = 'enp3s0', camera_subnet = '192.168.50.0/24', factory_addresses = $1::jsonb, alias_host = 250, alias_minutes = 15, camera_ip_start = 110, revision = revision + 1, updated_by = 'OPR-003', updated_at = $2 WHERE singleton AND revision = 1`,
          [json(['192.168.1.64']), T + 2],
        ),
      ),
    ).toBe('ok:1');
    expect(await settings()).toEqual([
      { singleton: true, interface_name: 'enp3s0', camera_subnet: '192.168.50.0/24', factory_addresses: ['192.168.1.64'], alias_host: 250, alias_minutes: 15, camera_ip_start: 110, revision: 2, updated_by: 'OPR-003' },
    ]);
    // The port may be un-chosen again: the commissioning functions then answer "not configured".
    expect(await outcome(app.query(`UPDATE ${NETWORK} SET interface_name = NULL, camera_subnet = NULL WHERE singleton`))).toBe('ok:1');
    await expectRefused(() => app.query(`UPDATE ${NETWORK} SET singleton = true`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`DELETE FROM ${NETWORK}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`TRUNCATE ${NETWORK}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => insertRow(app, 'capture_network_config', captureNetworkConfig()), SQLSTATE.uniqueViolation, 'capture_network_config_pkey');
  });

  it.each([
    ['a second row', "singleton = false", SQLSTATE.insufficientPrivilege, undefined],
    ['an interface with a space', "interface_name = 'Ethernet 1'", SQLSTATE.checkViolation, 'capture_network_config_interface_name_check'],
    ['an interface in upper case', "interface_name = 'ETH1'", SQLSTATE.checkViolation, 'capture_network_config_interface_name_check'],
    ['an interface with a shell sign', "interface_name = 'eth1;reboot'", SQLSTATE.checkViolation, 'capture_network_config_interface_name_check'],
    ['an interface that starts with a dash (an option)', "interface_name = '-eth1'", SQLSTATE.checkViolation, 'capture_network_config_interface_name_check'],
    ['an interface that is a path', "interface_name = '../eth1'", SQLSTATE.checkViolation, 'capture_network_config_interface_name_check'],
    ['an interface of 16 characters', "interface_name = 'enp0s31f6abcdefg'", SQLSTATE.checkViolation, 'capture_network_config_interface_name_check'],
    ['an empty interface (not chosen is NULL, never empty)', "interface_name = ''", SQLSTATE.checkViolation, 'capture_network_config_interface_name_check'],
    ['a subnet without a prefix', "camera_subnet = '192.168.1.0'", SQLSTATE.checkViolation, 'capture_network_config_camera_subnet_check'],
    ['a subnet wider than /16', "camera_subnet = '10.0.0.0/8'", SQLSTATE.checkViolation, 'capture_network_config_camera_subnet_check'],
    ['a subnet narrower than /30', "camera_subnet = '192.168.1.0/31'", SQLSTATE.checkViolation, 'capture_network_config_camera_subnet_check'],
    ['a subnet with a number above 255', "camera_subnet = '192.168.256.0/24'", SQLSTATE.checkViolation, 'capture_network_config_camera_subnet_check'],
    ['a subnet that is a host name', "camera_subnet = 'cameras.local/24'", SQLSTATE.checkViolation, 'capture_network_config_camera_subnet_check'],
    ['an IPv6 subnet', "camera_subnet = 'fd00::/64'", SQLSTATE.checkViolation, 'capture_network_config_camera_subnet_check'],
    ['an alias host of 1', 'alias_host = 1', SQLSTATE.checkViolation, 'capture_network_config_alias_host_check'],
    ['an alias host of 255', 'alias_host = 255', SQLSTATE.checkViolation, 'capture_network_config_alias_host_check'],
    ['an alias lifetime of 4 minutes', 'alias_minutes = 4', SQLSTATE.checkViolation, 'capture_network_config_alias_minutes_check'],
    ['an alias lifetime of 481 minutes', 'alias_minutes = 481', SQLSTATE.checkViolation, 'capture_network_config_alias_minutes_check'],
    ['a first camera address of 1', 'camera_ip_start = 1', SQLSTATE.checkViolation, 'capture_network_config_camera_ip_start_check'],
    ['a first camera address of 251', 'camera_ip_start = 251', SQLSTATE.checkViolation, 'capture_network_config_camera_ip_start_check'],
    ['revision 0', 'revision = 0', SQLSTATE.checkViolation, 'capture_network_config_revision_check'],
    ['an operator that does not exist', "updated_by = 'OPR-999'", SQLSTATE.foreignKeyViolation, 'capture_network_config_updated_by_fkey'],
  ])('a setting that is not one is refused: %s', async (_what, assignment, code, constraint) => {
    await expectRefused(() => db.appPool().query(`UPDATE ${NETWORK} SET ${assignment} WHERE singleton`), code, constraint);
  });

  it.each([
    ['a map in place of the list (free JSON)', { addresses: ['192.168.1.64'] }],
    ['a text in place of the list', '192.168.1.64'],
    ['a number in place of the list', 7],
    ['a JSON null in place of the list', null],
    ['33 addresses', Array.from({ length: 33 }, (_, index) => `192.168.1.${index + 1}`)],
    ['a host name among the addresses', ['192.168.1.64', 'camera.local']],
    ['a locator among the addresses', [['rtsp:', '//192.168.1.64/stream'].join('')]],
    ['an address with a port', ['192.168.1.64:554']],
    ['an address with a prefix', ['192.168.1.64/24']],
    ['a number among the addresses', ['192.168.1.64', 3232235840]],
    ['a nested list', [['192.168.1.64']]],
    ['a map among the addresses', [{ address: '192.168.1.64' }]],
    ['an empty text among the addresses', ['']],
    ['an address with a line break', ['192.168.1.64\n10.0.0.1']],
  ])('THE FACTORY LIST IS A LIST OF ADDRESSES, never free JSON (S13-13): %s is refused (23514)', async (_what, value) => {
    await expectRefused(() => db.appPool().query(`UPDATE ${NETWORK} SET factory_addresses = $1::jsonb WHERE singleton`, [json(value)]), SQLSTATE.checkViolation, 'capture_network_config_factory_addresses_check');
    expect((await db.ownerPool().query(`SELECT factory_addresses FROM ${NETWORK}`)).rows).toEqual([{ factory_addresses: ['192.168.1.64'] }]);
  });

  it('the bounds of the rules are taken: an empty list and one of 32, hosts 2 and 254, 5 and 480 minutes, 2 and 250, /16 and /30, an interface of 15 characters', async () => {
    const app = db.appPool();
    const thirtyTwo = Array.from({ length: 32 }, (_, index) => `10.0.0.${index + 1}`);
    expect(await outcome(app.query(`UPDATE ${NETWORK} SET factory_addresses = '[]'::jsonb, alias_host = 2, alias_minutes = 5, camera_ip_start = 2, camera_subnet = '172.16.0.0/16', interface_name = 'e' WHERE singleton`))).toBe('ok:1');
    expect(await outcome(app.query(`UPDATE ${NETWORK} SET factory_addresses = $1::jsonb, alias_host = 254, alias_minutes = 480, camera_ip_start = 250, camera_subnet = '192.168.1.252/30', interface_name = 'enp0s31f6.vlan1' WHERE singleton`, [json(thirtyTwo)]))).toBe('ok:1');
    expect((await db.ownerPool().query(`SELECT jsonb_array_length(factory_addresses) AS addresses, alias_host, alias_minutes, camera_ip_start, camera_subnet, char_length(interface_name) AS name_length FROM ${NETWORK}`)).rows).toEqual([
      { addresses: 32, alias_host: 254, alias_minutes: 480, camera_ip_start: 250, camera_subnet: '192.168.1.252/30', name_length: 15 },
    ]);
  });

  it('the table has ten columns and no place for a credential; no column is of an address type (the contract keeps its nine types)', async () => {
    const { rows } = await db.ownerPool().query<{ name: string; type: string }>(
      "SELECT column_name::text AS name, data_type::text AS type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capture_network_config' ORDER BY ordinal_position",
    );
    expect(rows).toEqual([
      { name: 'singleton', type: 'boolean' },
      { name: 'interface_name', type: 'text' },
      { name: 'camera_subnet', type: 'text' },
      { name: 'factory_addresses', type: 'jsonb' },
      { name: 'alias_host', type: 'smallint' },
      { name: 'alias_minutes', type: 'smallint' },
      { name: 'camera_ip_start', type: 'smallint' },
      { name: 'revision', type: 'bigint' },
      { name: 'updated_by', type: 'text' },
      { name: 'updated_at', type: 'bigint' },
    ]);
  });
});

describe('M9S-6 (b): host_network_aliases, the state of the one temporary address', () => {
  const open = async (): Promise<unknown> => (await db.ownerPool().query(`SELECT address, reason FROM ${ALIASES} WHERE removed_at IS NULL ORDER BY address`)).rows;

  it('as dems_app: an alias is opened; its id is the database\'s, its lifetime is stored', async () => {
    const app = db.appPool();
    await insertRow(app, 'host_network_aliases', hostNetworkAlias({ interface_name: 'enp3s0', added_by: 'OPR-003' }));
    const { rows } = await app.query<{ id: string; lifetime: string }>(`SELECT id, (expires_at - added_at)::text AS lifetime FROM ${ALIASES}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(rows[0]?.lifetime).toBe(String(30 * MINUTE));
    expect(await open()).toEqual([{ address: '192.168.1.253/24', reason: 'FACTORY_SCAN' }]);
  });

  it('A SECOND OPEN ALIAS ON ONE ADDRESS IS REFUSED BY THE DATABASE (23505), and so is a second open alias on any other address: one alias at a time', async () => {
    const app = db.appPool();
    const same = await expectRefused(() => insertRow(app, 'host_network_aliases', hostNetworkAlias({ interface_name: 'enp3s0', reason: 'SET_CAMERA_ADDRESS' })), SQLSTATE.uniqueViolation);
    expect(same.constraint).toMatch(/^host_network_aliases_(open_address|one_open)_key$/);
    await expectRefused(() => insertRow(app, 'host_network_aliases', hostNetworkAlias({ interface_name: 'enp3s0', address: '192.168.0.253/24' })), SQLSTATE.uniqueViolation, 'host_network_aliases_one_open_key');
    await expectRefused(() => insertRow(app, 'host_network_aliases', hostNetworkAlias({ interface_name: 'eth9', address: '10.1.2.3/24' })), SQLSTATE.uniqueViolation, 'host_network_aliases_one_open_key');
    expect(await open()).toEqual([{ address: '192.168.1.253/24', reason: 'FACTORY_SCAN' }]);
  });

  it('EACH RULE ON ITS OWN: with the one-at-a-time index taken away, the same interface and address is still refused, by the per-address index; another address is then accepted', async () => {
    const other = await db.another({ template: EMPTY_DATABASE, slug: 'set9_address_rule' });
    const owner = other.ownerPool();
    await migrateSetNine(owner);
    await insertRbac(owner);
    await owner.query('DROP INDEX public.host_network_aliases_one_open_key');
    await insertRow(other.appPool(), 'host_network_aliases', hostNetworkAlias());
    await expectRefused(() => insertRow(other.appPool(), 'host_network_aliases', hostNetworkAlias({ reason: 'SET_CAMERA_ADDRESS', added_at: T + 9, expires_at: T + 9 + MINUTE })), SQLSTATE.uniqueViolation, 'host_network_aliases_open_address_key');
    await insertRow(other.appPool(), 'host_network_aliases', hostNetworkAlias({ address: '192.168.0.253/24' }));
    await insertRow(other.appPool(), 'host_network_aliases', hostNetworkAlias({ interface_name: 'eth2' }));
    expect((await owner.query(`SELECT count(*)::int AS open_rows FROM ${ALIASES} WHERE removed_at IS NULL`)).rows).toEqual([{ open_rows: 3 }]);
  });

  it('the lifetime is extended and a failed removal is noted on the open row; then the alias is closed, and only then may the next one be opened', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(`UPDATE ${ALIASES} SET expires_at = $1 WHERE removed_at IS NULL`, [T + 60 * MINUTE]))).toBe('ok:1');
    expect(await outcome(app.query(`UPDATE ${ALIASES} SET remove_error = 'DEL_FAILED' WHERE removed_at IS NULL`))).toBe('ok:1');
    await expectRefused(() => insertRow(app, 'host_network_aliases', hostNetworkAlias({ interface_name: 'enp3s0', address: '192.168.0.253/24' })), SQLSTATE.uniqueViolation, 'host_network_aliases_one_open_key');
    expect(await outcome(app.query(`UPDATE ${ALIASES} SET removed_at = $1, remove_reason = 'JOB_DONE', removed_by = NULL, remove_error = NULL WHERE removed_at IS NULL`, [T + 5 * MINUTE]))).toBe('ok:1');
    expect(await open()).toEqual([]);
    // The same address again, and after it another one: any number of closed rows, one open row.
    await insertRow(app, 'host_network_aliases', hostNetworkAlias({ interface_name: 'enp3s0', added_at: T + 6 * MINUTE, expires_at: T + 36 * MINUTE }));
    expect(await outcome(app.query(`UPDATE ${ALIASES} SET removed_at = $1, remove_reason = 'MANUAL', removed_by = 'OPR-003' WHERE removed_at IS NULL`, [T + 7 * MINUTE]))).toBe('ok:1');
    await insertRow(app, 'host_network_aliases', hostNetworkAlias({ interface_name: 'enp3s0', address: '192.168.0.253/24', reason: 'SET_CAMERA_ADDRESS', added_at: T + 8 * MINUTE, expires_at: T + 38 * MINUTE }));
    expect((await db.ownerPool().query(`SELECT address, remove_reason, removed_by FROM ${ALIASES} ORDER BY added_at`)).rows).toEqual([
      { address: '192.168.1.253/24', remove_reason: 'JOB_DONE', removed_by: null },
      { address: '192.168.1.253/24', remove_reason: 'MANUAL', removed_by: 'OPR-003' },
      { address: '192.168.0.253/24', remove_reason: null, removed_by: null },
    ]);
  });

  it('what the alias IS is never rewritten, and a row is never removed (42501)', async () => {
    const app = db.appPool();
    for (const assignment of ["address = '10.0.0.5/24'", "interface_name = 'eth0'", "reason = 'FACTORY_SCAN'", 'added_at = 1', "added_by = 'OPR-001'", 'id = gen_random_uuid()']) {
      await expectRefused(() => app.query(`UPDATE ${ALIASES} SET ${assignment}`), SQLSTATE.insufficientPrivilege);
    }
    await expectRefused(() => app.query(`DELETE FROM ${ALIASES}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`TRUNCATE ${ALIASES}`), SQLSTATE.insufficientPrivilege);
    expect((await db.ownerPool().query(`SELECT count(*)::int AS rows FROM ${ALIASES}`)).rows).toEqual([{ rows: 3 }]);
  });

  it.each([
    ['a public address', hostNetworkAlias({ address: '8.8.8.8/24' }), 'host_network_aliases_address_check'],
    ['a loopback address', hostNetworkAlias({ address: '127.0.0.1/24' }), 'host_network_aliases_address_check'],
    ['a link-local address', hostNetworkAlias({ address: '169.254.1.1/24' }), 'host_network_aliases_address_check'],
    ['a multicast address', hostNetworkAlias({ address: '224.0.0.1/24' }), 'host_network_aliases_address_check'],
    ['172.15, below the private range', hostNetworkAlias({ address: '172.15.0.1/24' }), 'host_network_aliases_address_check'],
    ['172.32, above the private range', hostNetworkAlias({ address: '172.32.0.1/24' }), 'host_network_aliases_address_check'],
    ['192.169', hostNetworkAlias({ address: '192.169.1.1/24' }), 'host_network_aliases_address_check'],
    ['the network address of the /24', hostNetworkAlias({ address: '192.168.1.0/24' }), 'host_network_aliases_address_check'],
    ['the broadcast address of the /24', hostNetworkAlias({ address: '192.168.1.255/24' }), 'host_network_aliases_address_check'],
    ['a prefix other than /24', hostNetworkAlias({ address: '192.168.1.253/16' }), 'host_network_aliases_address_check'],
    ['no prefix', hostNetworkAlias({ address: '192.168.1.253' }), 'host_network_aliases_address_check'],
    ['a number above 255', hostNetworkAlias({ address: '192.168.300.5/24' }), 'host_network_aliases_address_check'],
    ['a leading zero', hostNetworkAlias({ address: '192.168.01.5/24' }), 'host_network_aliases_address_check'],
    ['an IPv6 address', hostNetworkAlias({ address: 'fd00::5/24' }), 'host_network_aliases_address_check'],
    ['an address followed by an option', hostNetworkAlias({ address: '192.168.1.253/24 dev eth0' }), 'host_network_aliases_address_check'],
    ['an interface that is an option', hostNetworkAlias({ interface_name: '-all' }), 'host_network_aliases_interface_name_check'],
    ['an interface with a shell sign', hostNetworkAlias({ interface_name: 'eth1;reboot' }), 'host_network_aliases_interface_name_check'],
    ['a reason in free text (what input-av stores)', hostNetworkAlias({ reason: 'factory scan' }), 'host_network_aliases_reason_check'],
    ['a reason outside the closed set', hostNetworkAlias({ reason: 'DISCOVERY' }), 'host_network_aliases_reason_check'],
    ['a lifetime of zero', hostNetworkAlias({ expires_at: T }), 'host_network_aliases_expires_at_check'],
    ['an end before the start', hostNetworkAlias({ expires_at: T - 1 }), 'host_network_aliases_expires_at_check'],
    ['removed before it was added', hostNetworkAlias({ removed_at: T - 1, remove_reason: 'MANUAL' }), 'host_network_aliases_removed_at_check'],
    ['closed without a reason', hostNetworkAlias({ removed_at: T + 1 }), 'host_network_aliases_remove_reason_check'],
    ['a reason for the end of an alias that is open', hostNetworkAlias({ remove_reason: 'EXPIRED' }), 'host_network_aliases_remove_reason_check'],
    ['an end reason outside the closed set', hostNetworkAlias({ removed_at: T + 1, remove_reason: 'CRASHED' }), 'host_network_aliases_remove_reason_check'],
    ['a remover of an alias that is open', hostNetworkAlias({ removed_by: 'OPR-003' }), 'host_network_aliases_removed_by_check'],
    ['an error in free text (what input-av stores)', hostNetworkAlias({ remove_error: 'RTNETLINK answers: Cannot assign requested address' }), 'host_network_aliases_remove_error_check'],
  ])('an alias row that is not one is refused (23514): %s', async (_what, row, constraint) => {
    // An alias is open already: a CHECK is evaluated before any index, so the refusal is the rule's.
    await expectRefused(() => insertRow(db.appPool(), 'host_network_aliases', row), SQLSTATE.checkViolation, constraint);
  });

  it('who added and who removed it are operators: one that does not exist is refused (23503)', async () => {
    const app = db.appPool();
    await expectRefused(() => insertRow(app, 'host_network_aliases', hostNetworkAlias({ ...ALIAS_CLOSED, added_by: 'OPR-999' })), SQLSTATE.foreignKeyViolation, 'host_network_aliases_added_by_fkey');
    await expectRefused(() => insertRow(app, 'host_network_aliases', hostNetworkAlias({ ...ALIAS_CLOSED, removed_by: 'OPR-999' })), SQLSTATE.foreignKeyViolation, 'host_network_aliases_removed_by_fkey');
    // ON DELETE RESTRICT, as the owner: an operator an alias names is not removed.
    await expectRefused(() => db.ownerPool().query("DELETE FROM public.operators WHERE id = 'OPR-003'"), SQLSTATE.restrictViolation);
  });

  it('the bounds of the rule are taken: both ends of the host part in each of the three private ranges (six closed rows of history more)', async () => {
    const app = db.appPool();
    for (const address of ['10.0.0.1/24', '10.255.255.254/24', '172.16.0.1/24', '172.31.255.254/24', '192.168.0.1/24', '192.168.255.254/24']) {
      await insertRow(app, 'host_network_aliases', hostNetworkAlias({ ...ALIAS_CLOSED, address, interface_name: 'enp0s31f6.vlan1', removed_at: T + 1, remove_reason: 'BOOT_SWEEP' }));
    }
    expect((await db.ownerPool().query(`SELECT count(*)::int AS rows, count(*) FILTER (WHERE removed_at IS NULL)::int AS open_rows FROM ${ALIASES}`)).rows).toEqual([{ rows: 9, open_rows: 1 }]);
  });

  it('the two indexes are unique and partial: they bind the open rows only', async () => {
    expect(
      (await db.ownerPool().query("SELECT indexname::text AS name, indexdef LIKE 'CREATE UNIQUE%' AS is_unique, indexdef LIKE '%WHERE (removed_at IS NULL)' AS open_only FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'host_network_aliases' ORDER BY 1")).rows,
    ).toEqual([
      { name: 'host_network_aliases_one_open_key', is_unique: true, open_only: true },
      { name: 'host_network_aliases_open_address_key', is_unique: true, open_only: true },
      { name: 'host_network_aliases_pkey', is_unique: true, open_only: false },
    ]);
  });
});

describe('M9S-7 (c): capture_audio_inputs.usb_serial and usb_port, which unit on which port', () => {
  it('as dems_app: a registration stores the port and the serial; two cards of one product on two ports are two different rows', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(`UPDATE ${INPUTS} SET usb_serial = 'Y8KD1AB2C3D4E5', usb_port = '1-1.4' WHERE device_id = 'MIC-01'`))).toBe('ok:1');
    await insertRow(app, 'capture_audio_inputs', captureAudioInput('MIC-03', { card_id: 'USB_1', usb_port: '1-1.2' }));
    expect((await app.query(`SELECT device_id, usb_id, usb_serial, usb_port FROM ${INPUTS} ORDER BY device_id`)).rows).toEqual([
      { device_id: 'MIC-01', usb_id: '1235:8211', usb_serial: 'Y8KD1AB2C3D4E5', usb_port: '1-1.4' },
      { device_id: 'MIC-02', usb_id: null, usb_serial: null, usb_port: null },
      { device_id: 'MIC-03', usb_id: '1235:8211', usb_serial: null, usb_port: '1-1.2' },
    ]);
    // THE QUESTION THE COLUMNS ANSWER: which stored input is the card of this product on port 1-1.2?
    expect((await app.query(`SELECT device_id FROM ${INPUTS} WHERE usb_id = '1235:8211' AND usb_port = '1-1.2'`)).rows).toEqual([{ device_id: 'MIC-03' }]);
  });

  it('a card moved to another port, or replaced by another unit, is an UPDATE of the card facts; a card that states neither stores NULL', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(`UPDATE ${INPUTS} SET usb_port = '3-2', usb_serial = NULL, updated_at = $1 WHERE device_id = 'MIC-01'`, [T + 1]))).toBe('ok:1');
    expect((await app.query(`SELECT usb_serial, usb_port FROM ${INPUTS} WHERE device_id = 'MIC-01'`)).rows).toEqual([{ usb_serial: null, usb_port: '3-2' }]);
    // The rate is still never changed and a row never removed: the grant of set 8 is what it was.
    await expectRefused(() => app.query(`UPDATE ${INPUTS} SET sample_rate = 48000 WHERE device_id = 'MIC-01'`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`DELETE FROM ${INPUTS} WHERE device_id = 'MIC-01'`), SQLSTATE.insufficientPrivilege);
  });

  it.each([
    ['a serial with a space (a descriptor string, AD-07 (1))', "usb_serial = 'SN 0042'", 'capture_audio_inputs_usb_serial_check'],
    ['a serial with markup', "usb_serial = '<b>42</b>'", 'capture_audio_inputs_usb_serial_check'],
    ['a serial with a shell sign', "usb_serial = '42;reboot'", 'capture_audio_inputs_usb_serial_check'],
    ['a serial with a line break', "usb_serial = E'42\\n43'", 'capture_audio_inputs_usb_serial_check'],
    ['a serial in another script', "usb_serial = 'シリアル42'", 'capture_audio_inputs_usb_serial_check'],
    ['a serial of 65 characters', `usb_serial = '${'9'.repeat(65)}'`, 'capture_audio_inputs_usb_serial_check'],
    ['an empty serial (none is NULL, never empty)', "usb_serial = ''", 'capture_audio_inputs_usb_serial_check'],
    ['a port that is a file path', "usb_port = '/sys/bus/usb/devices/1-1.4'", 'capture_audio_inputs_usb_port_check'],
    ['a port with a space', "usb_port = 'usb 1-1.4'", 'capture_audio_inputs_usb_port_check'],
    ['a port of 65 characters', `usb_port = '${'1'.repeat(65)}'`, 'capture_audio_inputs_usb_port_check'],
    ['an empty port', "usb_port = ''", 'capture_audio_inputs_usb_port_check'],
  ])('a card fact that is not one is refused (23514): %s', async (_what, assignment, constraint) => {
    await expectRefused(() => db.appPool().query(`UPDATE ${INPUTS} SET ${assignment} WHERE device_id = 'MIC-01'`), SQLSTATE.checkViolation, constraint);
  });

  it('the bounds are taken: 64 characters with every admitted sign, in both columns', async () => {
    const text = `usb-0000:00:14.0-1.4_A-${'9'.repeat(41)}`;
    expect(text).toHaveLength(64);
    expect(await outcome(db.appPool().query(`UPDATE ${INPUTS} SET usb_serial = $1, usb_port = $1 WHERE device_id = 'MIC-02'`, [text]))).toBe('ok:1');
    expect((await db.ownerPool().query(`SELECT char_length(usb_serial) AS serial, char_length(usb_port) AS port FROM ${INPUTS} WHERE device_id = 'MIC-02'`)).rows).toEqual([{ serial: 64, port: 64 }]);
  });

  it('the runtime role updates ten columns of the table: the eight of set 8 and the two new ones; not the key, not the rate', async () => {
    expect(
      (await db.ownerPool().query("SELECT attname::text AS name FROM pg_attribute WHERE attrelid = 'public.capture_audio_inputs'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('dems_app', attrelid, attnum, 'UPDATE') ORDER BY 1")).rows.map(
        (row: { name: string }) => row.name,
      ),
    ).toEqual(['card_device', 'card_id', 'input_number', 'native_channels', 'sample_bits', 'updated_at', 'updated_by', 'usb_id', 'usb_port', 'usb_serial']);
  });
});

describe('M9S-8: B-3 across the step, in both directions', () => {
  it('the code of set 8 (7, dbc-8) on the migrated database is refused; the code of set 9 passes; this code (a later set) names db:migrate', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_8).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 8 (dbc-9); this server expects 7 (dbc-8)');
    await expect(checkSchemaVersion(db.appPool(), SET_9)).resolves.toBeUndefined();
    await expect(checkSchemaVersion(db.appPool())).rejects.toBeInstanceOf(BootCheckError);
  });
});

describe('M9S-9: rollback', () => {
  /** A (7, dbc-8) database with the rows of M9S-1. */
  async function seededSetEight(slug: string) {
    const other = await db.another({ template: EMPTY_DATABASE, slug });
    await seedSetEight(other.ownerPool());
    return other;
  }

  it('FAILS WHILE APPLYING: the two files inside one transaction, rolled back before the commit, leave the catalog, the rows, the stored matrix, the version and the ledger as they were', async () => {
    const other = await seededSetEight('set9_rollback_tx');
    const owner = other.ownerPool();
    const catalogBefore = await catalogDigest(owner);
    const rowsBefore = await storedBefore(owner);
    const matrixBefore = await storedMatrix(owner);
    const ledgerBefore = await readAppliedMigrations(owner);
    const client = await owner.connect();
    try {
      await client.query('BEGIN');
      for (const tag of TAGS) for (const chunk of chunksOf(tag)) await client.query(chunk);
      // Inside the transaction the set is in force: the tables exist, the permission is stored and the version is stepped.
      expect((await client.query(`SELECT to_regclass('${NETWORK}') IS NOT NULL AS network, to_regclass('${ALIASES}') IS NOT NULL AS aliases`)).rows).toEqual([{ network: true, aliases: true }]);
      expect((await client.query(`SELECT role_id FROM public.role_permissions WHERE permission_id = '${PERMISSION}'`)).rows).toEqual([{ role_id: 'TECHNICIAN' }]);
      expect((await client.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows).toEqual([{ schema_version: 8, contract_revision: 'dbc-9' }]);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    expect(await catalogDigest(owner)).toEqual(catalogBefore);
    expect(await storedBefore(owner)).toEqual(rowsBefore);
    expect(await storedMatrix(owner)).toEqual(matrixBefore);
    expect(await readSchemaVersion(owner)).toEqual(SET_8);
    expect(await readAppliedMigrations(owner)).toEqual(ledgerBefore);
    expect((await inspectLedger(owner)).pending).toEqual([...TAGS, ...LATER]);
    await expect(checkSchemaVersion(other.appPool(), SET_8)).resolves.toBeUndefined();
  });

  it('APPLIED, AND MUST BE UNDONE: the undo statements return the catalog to the one of (7, dbc-8), every row that existed and the stored matrix are what they were, and the code of set 8 starts again', async () => {
    const other = await seededSetEight('set9_rollback_undo');
    const owner = other.ownerPool();
    const catalogBefore = await catalogDigest(owner);
    const rowsBefore = await storedBefore(owner);
    const matrixBefore = await storedMatrix(owner);
    await migrateSetNine(owner);
    expect((await catalogDigest(owner)).digest).not.toBe(catalogBefore.digest);
    // Rows the set made possible, written while it was applied: they are what an undo loses.
    await insertRow(other.appPool(), 'capture_network_config', captureNetworkConfig());
    await insertRow(other.appPool(), 'host_network_aliases', hostNetworkAlias({ ...ALIAS_CLOSED }));
    await other.appPool().query(`UPDATE ${INPUTS} SET usb_serial = 'A1', usb_port = '1-1.4' WHERE device_id = 'MIC-01'`);

    const client = await owner.connect();
    try {
      await client.query('BEGIN');
      for (const statement of UNDO_SET_9) await client.query(statement);
      // In a delivered forward set the version steps ONWARD; here it is set to the pair of set 8
      // so that the comparison below is with the database as it was.
      await client.query("UPDATE public.schema_meta SET schema_version = 7, contract_revision = 'dbc-8' WHERE singleton");
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    expect(await catalogDigest(owner)).toEqual(catalogBefore);
    expect(await storedBefore(owner)).toEqual(rowsBefore);
    expect(await storedMatrix(owner)).toEqual(matrixBefore);
    expect(await tablesPresent(owner)).toEqual([{ network: false, aliases: false }]);
    expect(await inputColumns(owner)).toBe(0);
    await expect(checkSchemaVersion(other.appPool(), SET_8)).resolves.toBeUndefined();
    await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
  });

  it('THE PRECONDITION OF THE UNDO: while an alias is open the undo is refused (55000) and changes nothing - the address would stay on the host with no record', async () => {
    const other = await seededSetEight('set9_rollback_open');
    const owner = other.ownerPool();
    await migrateSetNine(owner);
    await insertRow(other.appPool(), 'host_network_aliases', hostNetworkAlias());
    const catalogApplied = await catalogDigest(owner);
    const client = await owner.connect();
    let refusal: string | undefined;
    try {
      await client.query('BEGIN');
      for (const statement of UNDO_SET_9) await client.query(statement);
      await client.query('COMMIT');
    } catch (error) {
      refusal = (error as { code?: string }).code;
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    expect(refusal).toBe(NOT_IN_PREREQUISITE_STATE);
    expect(await catalogDigest(owner)).toEqual(catalogApplied);
    expect(await readSchemaVersion(owner)).toEqual(SET_9);
    expect((await owner.query(`SELECT count(*)::int AS open_rows FROM ${ALIASES} WHERE removed_at IS NULL`)).rows).toEqual([{ open_rows: 1 }]);
    expect((await owner.query(`SELECT count(*)::int AS holders FROM public.role_permissions WHERE permission_id = '${PERMISSION}'`)).rows).toEqual([{ holders: 1 }]);
  });
});

describe('M9S-10: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');

  it('0017 is generated: two CREATE TABLE, two ADD COLUMN, three foreign keys, two partial unique indexes, two CHECKs - and no statement that writes a row (MG-2, MG-8)', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toHaveLength(11);
    expect(generated[0]).toMatch(/^CREATE TABLE "capture_network_config" \(/);
    expect(generated[1]).toMatch(/^CREATE TABLE "host_network_aliases" \(/);
    expect(generated.slice(2, 4)).toEqual(['ALTER TABLE "capture_audio_inputs" ADD COLUMN "usb_serial" text;', 'ALTER TABLE "capture_audio_inputs" ADD COLUMN "usb_port" text;']);
    expect(generated.slice(4).map((statement) => /^(?:ALTER TABLE "[a-z_]+" ADD CONSTRAINT|CREATE UNIQUE INDEX) "([a-z0-9_]+)"/.exec(statement)?.[1])).toEqual([
      'capture_network_config_updated_by_fkey',
      'host_network_aliases_added_by_fkey',
      'host_network_aliases_removed_by_fkey',
      'host_network_aliases_open_address_key',
      'host_network_aliases_one_open_key',
      'capture_audio_inputs_usb_serial_check',
      'capture_audio_inputs_usb_port_check',
    ]);
    // The three foreign keys state their referential actions; apart from those words, no statement names a write.
    const text = generated.join(' ').replaceAll('ON DELETE restrict ON UPDATE no action', '');
    expect(generated.join(' ').split('ON DELETE restrict ON UPDATE no action')).toHaveLength(4);
    expect(text).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/);
    expect(text).not.toMatch(/NOT VALID|bytea|DROP TABLE|DROP COLUMN|DROP CONSTRAINT|DROP NOT NULL/i);
    // No address type entered the schema: the three address columns are text (TY-1).
    expect(text).not.toMatch(/\b(?:inet|cidr|macaddr)\b/i);
    // The one jsonb column of the set carries its default and its rule.
    expect(text.match(/\bjsonb\b/g)).toHaveLength(2);
    // The interface has no default: nothing in the file chooses a port.
    expect(text).toContain('"interface_name" text, "camera_subnet" text,');
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[0]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('0018 is hand-written: five grants, two boundary revokes, the two rows of the permission and the version row; no blanket form, no role but dems_app', () => {
    const written = statementsOf(TAGS[1]);
    expect(written).toEqual([
      'GRANT SELECT, INSERT ON capture_network_config TO dems_app;',
      'GRANT UPDATE (interface_name, camera_subnet, factory_addresses, alias_host, alias_minutes, camera_ip_start, revision, updated_by, updated_at) ON capture_network_config TO dems_app;',
      'REVOKE DELETE, TRUNCATE ON capture_network_config FROM dems_app;',
      'GRANT SELECT, INSERT ON host_network_aliases TO dems_app;',
      'GRANT UPDATE (expires_at, removed_at, remove_reason, removed_by, remove_error) ON host_network_aliases TO dems_app;',
      'REVOKE DELETE, TRUNCATE ON host_network_aliases FROM dems_app;',
      'GRANT UPDATE (usb_serial, usb_port) ON capture_audio_inputs TO dems_app;',
      "INSERT INTO public.permissions (id, sort_order) SELECT 'CAPTURE_COMMISSION', 15 WHERE EXISTS (SELECT 1 FROM public.roles WHERE id = 'TECHNICIAN') ON CONFLICT DO NOTHING;",
      "INSERT INTO public.role_permissions (role_id, permission_id) SELECT 'TECHNICIAN', 'CAPTURE_COMMISSION' WHERE EXISTS (SELECT 1 FROM public.roles WHERE id = 'TECHNICIAN') AND EXISTS (SELECT 1 FROM public.permissions WHERE id = 'CAPTURE_COMMISSION') ON CONFLICT DO NOTHING;",
      "UPDATE public.schema_meta SET schema_version = 8, contract_revision = 'dbc-9' WHERE singleton;",
    ]);
    expect(written.join(' ')).not.toMatch(/ALL\s+TABLES/i);
    expect(written.join(' ')).not.toMatch(/dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER/i);
    // The permission is granted to ONE role (decision U10): no other role is named by the file.
    expect(written.join(' ')).not.toMatch(/SUPERVISOR|INVESTIGATOR/);
  });

  it('0015 and 0016 hash to what the ledgers of the development databases store: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0015_capture_streams_audio_inputs']).toBe('ad8a0568e12058a39fc79e646c1c3173a52d687b8a1f6789980fb40b2c7ff7eb');
    expect(hashes['0016_capture_streams_audio_inputs_privileges']).toBe('56b8678b3f805b6344a9ae3c87b0bffc7bb4abfb10ad09390930cded3bdeaaea');
  });
});
