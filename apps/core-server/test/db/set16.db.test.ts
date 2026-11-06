// Migration set 16 (`0032_capture_device_retirement.sql` +
// `0033_capture_device_retirement_privileges.sql`; task 4, contract revision `dbc-16`, schema
// version 15; design `docs/2026-10-12_input_av_core_adapter_plan/masterplan/07_design_retire_readopt.md`
// section 4.1 and its security points 1, 3, 4 and 5, adopted by decision C147 of
// `decisions/decisions.md`): RETIRING a capture device.
//
//   (1) `capture_devices.retired_at` / `retired_by` (FK operators, RESTRICT) with two CHECKs: both
//       or neither, and never a PoE row; `capture_audio_inputs.retired_at`, the mirror;
//   (2) the two identity rules made partial on rows IN SERVICE: `capture_devices_onvif_uuid_key`
//       and `capture_audio_inputs_card_input_key` (a unique constraint until now);
//   (3) the guard trigger on both tables: a retired row is never changed again but for
//       `last_seen_at` and `enabled`, and never un-retired (SQLSTATE ZD001, for every role);
//   (4) `dems_capture_credential_destroy(text)`: owner-owned, SECURITY DEFINER, deletes the
//       credential of a RETIRED device only; the runtime role may execute it and still deletes
//       nothing itself;
//   (5) the UPDATE grants of the three columns and the version row.
//
//   M16S-1  the pre-state is a genuine (14, 'dbc-15') database that HOLDS ROWS (an adopted camera
//           with its credential and stream row, a registered microphone with its input, a PoE
//           switch): the columns do not exist (42703), the same ONVIF reference or card input
//           cannot be held twice, this code is refused by B-3 and the code of set 15 is accepted
//   M16S-2  NEGATIVE CONTROL: with 0033 left out the columns are there but the runtime role may
//           not write them (42501), the destroy function does not exist (42883), there is no
//           guard, and the version stays (14, 'dbc-15')
//   M16S-3  set 16 applies exactly its two files; EVERY STORED ROW IS WHAT IT WAS and in service;
//           nine column-privilege lines are new and no other moved; ends at (15, 'dbc-16'); a
//           second run applies nothing; a database migrated FROM EMPTY has the same catalog
//   M16S-4  as dems_app: what the database accepts and refuses around a retirement - the two
//           CHECKs and the FK, the credential destroyed only once retired (and restored by a
//           rollback), the guard, a new id adopting the same camera / card input again, the
//           mirror held equal, still no DELETE
//   M16S-5  B-3 across the step, in both directions
//   M16S-6  ROLLBACK: the set inside one transaction, rolled back; the undo statements return an
//           applied database to the catalog of (14, 'dbc-15') and refuse to run while a row is
//           retired
//   M16S-7  the files: 0032 is ten generated statements and writes no row; 0033 is the grants,
//           the guard, the destroy function and the version row; 0030 and 0031 hash to what they
//           hashed to when set 15 was delivered
//   M16S-8  THE DEMO RESET (`db/reset/kept-tables.ts`, read only): the carried images hold the
//           new columns, and a retired camera and microphone cross a reset unchanged
//
// Every database here is a throw-away of this test run (TI-17). No device, credential, address or
// operator here is a real one: the rows are fixture rows, and nothing in this file reaches a
// camera, a microphone or the network.
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
import { KEPT_TABLES, carryStatement, imagesAsJsonArray, readImagesStatement } from '../../src/db/reset/kept-tables';
import { BootCheckError, checkSchemaVersion } from '../../src/db/schema/boot-checks';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../src/db/schema/meta';
import { useTestDatabase, type TestDatabase } from '../helpers/db';
import { T, captureAudioInput, captureDevice, captureDeviceCredential, captureDeviceStream, insertRbac, insertRow, json } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0032_capture_device_retirement', '0033_capture_device_retirement_privileges'] as const;
/** The number of files through set 15: the pre-state of this file. */
const BEFORE = 32;
/** The number of files through set 16: this file stops there, whatever set comes later. */
const THROUGH = 34;
/** The files of the sets after set 16, pending on a database of set 16. */
const LATER: readonly string[] = INITIAL_MIGRATION_TAGS.slice(THROUGH);
const DEVICES = 'public.capture_devices';
const INPUTS = 'public.capture_audio_inputs';
const CREDENTIALS = 'public.capture_device_credentials';
const STREAMS = 'public.capture_device_streams';
const RETIRED_CHECK = 'capture_devices_retired_check';
const RETIRED_KIND_CHECK = 'capture_devices_retired_kind_check';
const RETIRED_BY_FKEY = 'capture_devices_retired_by_fkey';
const ONVIF_KEY = 'capture_devices_onvif_uuid_key';
const CARD_INPUT_KEY = 'capture_audio_inputs_card_input_key';
const GUARD_FUNCTION = 'dems_capture_retired_row_guard';
const DESTROY_FUNCTION = 'dems_capture_credential_destroy';
const GUARD_TRIGGERS = ['capture_audio_inputs_retired_guard', 'capture_devices_retired_guard'] as const;
const SET_15 = { schemaVersion: 14, contractRevision: 'dbc-15' } as const;
const SET_16 = { schemaVersion: 15, contractRevision: 'dbc-16' } as const;
/** The SQLSTATE the guard raises: a retired row is not changed. */
const RETIRED_ROW = 'ZD001';
/** SQLSTATE 42703, `undefined_column`. */
const UNDEFINED_COLUMN = '42703';
/** SQLSTATE 42883, `undefined_function`. */
const UNDEFINED_FUNCTION = '42883';
/** SQLSTATE 55000, `object_not_in_prerequisite_state`: what the guard of the undo raises. */
const NOT_IN_PREREQUISITE_STATE = '55000';
/** The adopted camera of the fixture: its ONVIF endpoint reference (a fixture text). */
const CAMERA_UUID = 'urn:uuid:set16-cam-03';
/** The technician of the fixture operators. */
const TECHNICIAN = 'OPR-003';
const RETIRED_AT = T + 60_000;
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set16-'));
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
 * What the four capture tables hold, as digests of whole row images. The rows are read WITHOUT the
 * new columns, so that the same statement runs before and after the set and "nothing else moved"
 * is one comparison.
 */
const storedBefore = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT (SELECT count(*)::int FROM ${DEVICES}) AS devices,
            (SELECT md5(string_agg((to_jsonb(d) - 'retired_at' - 'retired_by')::text, '' ORDER BY d.id)) FROM ${DEVICES} AS d) AS device_rows,
            (SELECT md5(string_agg((to_jsonb(i) - 'retired_at')::text, '' ORDER BY i.device_id)) FROM ${INPUTS} AS i) AS input_rows,
            (SELECT md5(string_agg(to_jsonb(c)::text, '' ORDER BY c.device_id)) FROM ${CREDENTIALS} AS c) AS credential_rows,
            (SELECT md5(string_agg(to_jsonb(s)::text, '' ORDER BY s.device_id, s.profile)) FROM ${STREAMS} AS s) AS stream_rows,
            (SELECT md5(string_agg(to_jsonb(o)::text, '' ORDER BY o.id)) FROM public.operators AS o) AS operator_rows`,
  )).rows;
const objects = "SELECT count(*)::int AS objects FROM pg_class WHERE relnamespace = 'public'::regnamespace";

/**
 * The catalog of schema `public` as one digest: every column with type, nullability and default,
 * every key and CHECK with its definition, every index, every privilege of the runtime role, and
 * every function and trigger.
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
       UNION ALL
       SELECT 'function ' || proname::text || '(' || pg_get_function_identity_arguments(oid) || ') ' || md5(prosrc) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
       UNION ALL
       SELECT 'trigger ' || pg_get_triggerdef(t.oid) || ' ' || t.tgenabled::text FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal
     ) AS catalog`,
  )).rows[0] ?? { lines: 0, digest: '' };

/** The privileges of the runtime role, line by line. */
const grantLines = async (owner: Pool): Promise<string[]> =>
  (await owner.query<{ line: string }>(
    `SELECT line FROM (
       SELECT 'table grant ' || table_name || ' ' || privilege_type AS line FROM information_schema.table_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
       UNION ALL
       SELECT 'column grant ' || table_name || '.' || column_name || ' ' || privilege_type FROM information_schema.column_privileges WHERE table_schema = 'public' AND grantee = 'dems_app'
     ) AS grants ORDER BY 1`,
  )).rows.map((row) => row.line);

const checksOn = async (pool: Pool, table: string): Promise<number> =>
  (await pool.query<{ checks: number }>(`SELECT count(*)::int AS checks FROM pg_constraint WHERE contype = 'c' AND conrelid = '${table}'::regclass`)).rows[0]?.checks ?? -1;

/** The functions and the triggers of the set that exist, by name. */
const setObjects = async (pool: Pool): Promise<{ functions: string[]; triggers: string[] }> => ({
  functions: (await pool.query<{ name: string }>(`SELECT proname::text AS name FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('${GUARD_FUNCTION}', '${DESTROY_FUNCTION}') ORDER BY 1`)).rows.map((row) => row.name),
  triggers: (await pool.query<{ name: string }>(`SELECT tgname::text AS name FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('${GUARD_TRIGGERS.join("', '")}') ORDER BY 1`)).rows.map((row) => row.name),
});

/**
 * THE UNDO OF AN APPLIED SET 16 ("applied, and must be undone"). The files of an applied set are
 * never edited and no down file exists in this repository, so an undo is delivered as a NEW
 * forward set that carries these statements and steps the version onward. They are kept here,
 * where a test runs them, so that the rollback is measured and not only described.
 * PRECONDITION: NO ROW IS RETIRED, in either table. The first statement refuses otherwise: a
 * retired row is history (its id is named by audit rows and sealed packages), the earlier schema
 * cannot say "retired", and a camera or card input adopted again under a new id would break the
 * earlier, non-partial identity rules. A database that ever retired a device cannot take this undo.
 * WHAT IT LOSES: nothing stored - no row is retired, so the three columns hold NULL only. A
 * credential destroyed before is not restored by any undo. The code that reads the columns must go
 * in the same release, or it answers 42703.
 * THE TWO GUARD TRIGGERS go with their function (CASCADE): the static rule T-AO-4
 * (`test/static/audit-protection.test.ts`) admits no statement that drops a trigger by name
 * anywhere under the server, and the cascade reaches exactly the two triggers that call the
 * guard - the catalog comparison below (functions and triggers included) shows that no other
 * trigger, the three audit triggers among them, was touched.
 */
const UNDO_SET_16: readonly string[] = [
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM ${DEVICES} WHERE retired_at IS NOT NULL OR retired_by IS NOT NULL) OR EXISTS (SELECT 1 FROM ${INPUTS} WHERE retired_at IS NOT NULL) THEN RAISE EXCEPTION 'a retired row is history: it is not rewritten' USING ERRCODE = 'object_not_in_prerequisite_state'; END IF; END $$`,
  `DROP FUNCTION public.${GUARD_FUNCTION}() CASCADE`,
  `DROP FUNCTION public.${DESTROY_FUNCTION}(text)`,
  `DROP INDEX public.${ONVIF_KEY}`,
  `CREATE UNIQUE INDEX ${ONVIF_KEY} ON ${DEVICES} USING btree (onvif_uuid) WHERE onvif_uuid IS NOT NULL`,
  `DROP INDEX public.${CARD_INPUT_KEY}`,
  `ALTER TABLE ${INPUTS} ADD CONSTRAINT ${CARD_INPUT_KEY} UNIQUE (card_id, card_device, input_number)`,
  `ALTER TABLE ${DEVICES} DROP CONSTRAINT ${RETIRED_KIND_CHECK}, DROP CONSTRAINT ${RETIRED_CHECK}, DROP CONSTRAINT ${RETIRED_BY_FKEY}, DROP COLUMN retired_by, DROP COLUMN retired_at`,
  `ALTER TABLE ${INPUTS} DROP COLUMN retired_at`,
];

/**
 * A (14, dbc-15) database with the rows of M16S-1: the four operators, the simulator's camera
 * `CAM-01`, an adopted camera `CAM-03` with its credential and one stream row, a registered
 * microphone `MIC-03` with its sound-card input, and a PoE switch.
 */
async function seedSetFifteen(owner: Pool): Promise<void> {
  await migrateThrough(owner, BEFORE, SET_15);
  await insertRbac(owner);
  await insertRow(owner, 'capture_devices', captureDevice('CAM-01', 'CAMERA'));
  await insertRow(owner, 'capture_devices', captureDevice('CAM-03', 'CAMERA', { adapter_kind: 'ONVIF_RTSP', onvif_uuid: CAMERA_UUID, profiles: json(['HEVC_1080P']), last_seen_at: T }));
  await insertRow(owner, 'capture_device_credentials', captureDeviceCredential('CAM-03'));
  await insertRow(owner, 'capture_device_streams', captureDeviceStream('CAM-03', 'HEVC_1080P'));
  await insertRow(owner, 'capture_devices', captureDevice('MIC-03', 'MIC', { adapter_kind: 'USB_AUDIO' }));
  await insertRow(owner, 'capture_audio_inputs', captureAudioInput('MIC-03', { usb_serial: 'SN0042', usb_port: '1-1.4' }));
  await insertRow(owner, 'capture_devices', captureDevice('POE-A1', 'POE', { poe_port: 'P1' }));
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
const retire = (pool: Pool, id: string, at: number | null, by: string | null): Promise<{ rowCount: number | null }> =>
  pool.query(`UPDATE ${DEVICES} SET retired_at = $1, retired_by = $2 WHERE id = $3`, [at, by, id]);
const destroy = async (pool: Pool, id: string): Promise<number> =>
  (await pool.query<{ destroyed: number }>(`SELECT public.${DESTROY_FUNCTION}($1) AS destroyed`, [id])).rows[0]?.destroyed ?? -1;
const credentialsOf = async (id: string): Promise<number> =>
  (await owner().query<{ rows: number }>(`SELECT count(*)::int AS rows FROM ${CREDENTIALS} WHERE device_id = $1`, [id])).rows[0]?.rows ?? -1;
const retiredOf = async (pool: Pool, id: string): Promise<unknown> =>
  (await pool.query(`SELECT retired_at::text AS retired_at, retired_by FROM ${DEVICES} WHERE id = $1`, [id])).rows;

describe('M16S-1: the pre-state, a (14, dbc-15) database that holds rows', () => {
  it('thirty-two files applied, set 16 pending; this code is refused by B-3 and the code of set 15 passes', async () => {
    await seedSetFifteen(owner());
    const ledger = await inspectLedger(owner());
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner(), folderOf(THROUGH))).pending).toEqual([...TAGS]);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    // The pair this code expects is read from its constants: it moves with every later set.
    expect((error as BootCheckError).message).toBe(
      `B-3: the database is at schema version 14 (dbc-15); this server expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
    await expect(checkSchemaVersion(db.appPool(), SET_15)).resolves.toBeUndefined();
  });

  it('THE STATE THAT IS MISSING: a device cannot be retired - the columns do not exist (42703), the destroy function neither (42883)', async () => {
    await expectRefused(() => db.appPool().query(`SELECT retired_at FROM ${DEVICES}`), UNDEFINED_COLUMN);
    await expectRefused(() => db.appPool().query(`SELECT retired_at FROM ${INPUTS}`), UNDEFINED_COLUMN);
    await expectRefused(() => destroy(db.appPool(), 'CAM-03'), UNDEFINED_FUNCTION);
  });

  it('THE GAP OF THE DESIGN (section 0): the same camera or the same card input cannot be held by a second id (23505)', async () => {
    await expectRefused(() => insertRow(db.appPool(), 'capture_devices', captureDevice('CAM-04', 'CAMERA', { onvif_uuid: CAMERA_UUID })), SQLSTATE.uniqueViolation, ONVIF_KEY);
    await insertRow(db.appPool(), 'capture_devices', captureDevice('MIC-04', 'MIC', { adapter_kind: 'USB_AUDIO' }));
    await expectRefused(() => insertRow(db.appPool(), 'capture_audio_inputs', captureAudioInput('MIC-04')), SQLSTATE.uniqueViolation, CARD_INPUT_KEY);
    // The microphone row stays in the registry (no DELETE for anyone at run time); its input was never stored.
    expect((await owner().query(`SELECT count(*)::int AS inputs FROM ${INPUTS}`)).rows).toEqual([{ inputs: 1 }]);
  });
});

describe('M16S-2: NEGATIVE CONTROL - without 0033 the columns are there but not writable, there is no guard and no destroy path', () => {
  it('0032 alone: every row in service, the runtime role may not retire (42501), the destroy function is absent (42883), an owner change of a row is not guarded, the version stays (14, dbc-15)', async () => {
    await withClone('set16_no0033', async (other) => {
      await seedSetFifteen(other.ownerPool());
      await migrateThrough(other.ownerPool(), THROUGH - 1, SET_15);
      expect((await other.ownerPool().query(`SELECT count(*)::int AS retired FROM ${DEVICES} WHERE retired_at IS NOT NULL OR retired_by IS NOT NULL`)).rows).toEqual([{ retired: 0 }]);
      await expectRefused(() => retire(other.appPool(), 'CAM-03', RETIRED_AT, TECHNICIAN), SQLSTATE.insufficientPrivilege);
      await expectRefused(() => other.appPool().query(`UPDATE ${INPUTS} SET retired_at = $1 WHERE device_id = 'MIC-03'`, [RETIRED_AT]), SQLSTATE.insufficientPrivilege);
      await expectRefused(() => destroy(other.appPool(), 'CAM-03'), UNDEFINED_FUNCTION);
      expect(await setObjects(other.ownerPool())).toEqual({ functions: [], triggers: [] });
      // Without the guard a retired row could still be rewritten: the owner retires it and edits it.
      await retire(other.ownerPool(), 'CAM-03', RETIRED_AT, TECHNICIAN);
      expect(await outcome(other.ownerPool().query(`UPDATE ${DEVICES} SET model = 'Another model' WHERE id = 'CAM-03'`))).toBe('ok:1');
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expect(checkSchemaVersion(other.appPool(), SET_15)).resolves.toBeUndefined();
    });
  });
});

describe('M16S-3: set 16 applies its two files; every stored row is what it was and in service', () => {
  it('db:migrate applies exactly 0032 and 0033 and steps the version to (15, dbc-16); the ledger holds thirty-four files; nine column-privilege lines are new; no stored value moved', async () => {
    const rowsBefore = await storedBefore(owner());
    const objectsBefore = (await owner().query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    const grantsBefore = await grantLines(owner());
    const folder = folderOf(THROUGH);
    expect(await readSchemaVersion(owner())).toEqual(SET_15);
    expect((await inspectLedger(owner(), folder)).pending).toEqual([...TAGS]);
    expect([await checksOn(owner(), DEVICES), await checksOn(owner(), INPUTS)]).toEqual([9, 8]);
    await migrateThrough(owner(), THROUGH, SET_16);
    const ledger = await inspectLedger(owner(), folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner())).toHaveLength(THROUGH);
    // No table and no sequence; the two identity rules are still one index each (one replaces a
    // constraint's own index), so the count of objects is what it was.
    expect((await owner().query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore);
    // THE STORED ROWS: every value is what it was (MG-8) ...
    expect(await storedBefore(owner())).toEqual(rowsBefore);
    // ... and every device and input is in service.
    expect((await owner().query(`SELECT id, retired_at, retired_by FROM ${DEVICES} ORDER BY id`)).rows).toEqual(
      ['CAM-01', 'CAM-03', 'MIC-03', 'MIC-04', 'POE-A1'].map((id) => ({ id, retired_at: null, retired_by: null })),
    );
    expect((await owner().query(`SELECT device_id, retired_at FROM ${INPUTS}`)).rows).toEqual([{ device_id: 'MIC-03', retired_at: null }]);
    // The columns as the catalog holds them: the last ones, nullable, no default.
    expect(
      (await owner().query("SELECT table_name::text AS table_name, column_name::text AS name, data_type::text AS type, is_nullable::text AS nullable, column_default AS fallback FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('retired_at', 'retired_by') ORDER BY 1, ordinal_position")).rows,
    ).toEqual([
      { table_name: 'capture_audio_inputs', name: 'retired_at', type: 'bigint', nullable: 'YES', fallback: null },
      { table_name: 'capture_devices', name: 'retired_at', type: 'bigint', nullable: 'YES', fallback: null },
      { table_name: 'capture_devices', name: 'retired_by', type: 'text', nullable: 'YES', fallback: null },
    ]);
    // The privileges of the NEW COLUMNS are the only new lines, and no other moved: UPDATE is the
    // grant of 0033; INSERT and SELECT are the table-level grants of 0005 / 0016, which the catalog
    // view states for every column of the table. Still no DELETE on either table.
    const grantsAfter = await grantLines(owner());
    expect(grantsAfter.filter((line) => !grantsBefore.includes(line))).toEqual([
      'column grant capture_audio_inputs.retired_at INSERT',
      'column grant capture_audio_inputs.retired_at SELECT',
      'column grant capture_audio_inputs.retired_at UPDATE',
      'column grant capture_devices.retired_at INSERT',
      'column grant capture_devices.retired_at SELECT',
      'column grant capture_devices.retired_at UPDATE',
      'column grant capture_devices.retired_by INSERT',
      'column grant capture_devices.retired_by SELECT',
      'column grant capture_devices.retired_by UPDATE',
    ]);
    expect(grantsBefore.filter((line) => !grantsAfter.includes(line))).toEqual([]);
    expect(grantsAfter.filter((line) => /^table grant (capture_devices|capture_audio_inputs|capture_device_credentials) (DELETE|TRUNCATE)$/.test(line))).toEqual([]);
    // The two CHECKs and the FK are there, validated; the two identity rules are partial unique indexes.
    expect((await owner().query(`SELECT conname::text AS name, contype::text AS kind, convalidated FROM pg_constraint WHERE conname IN ('${RETIRED_CHECK}', '${RETIRED_KIND_CHECK}', '${RETIRED_BY_FKEY}', '${CARD_INPUT_KEY}') ORDER BY 1`)).rows).toEqual([
      { name: RETIRED_BY_FKEY, kind: 'f', convalidated: true },
      { name: RETIRED_CHECK, kind: 'c', convalidated: true },
      { name: RETIRED_KIND_CHECK, kind: 'c', convalidated: true },
    ]);
    expect((await owner().query(`SELECT indexname::text AS name, indexdef AS definition FROM pg_indexes WHERE indexname IN ('${ONVIF_KEY}', '${CARD_INPUT_KEY}') ORDER BY 1`)).rows).toEqual([
      { name: CARD_INPUT_KEY, definition: `CREATE UNIQUE INDEX ${CARD_INPUT_KEY} ON public.capture_audio_inputs USING btree (card_id, card_device, input_number) WHERE (retired_at IS NULL)` },
      { name: ONVIF_KEY, definition: `CREATE UNIQUE INDEX ${ONVIF_KEY} ON public.capture_devices USING btree (onvif_uuid) WHERE ((onvif_uuid IS NOT NULL) AND (retired_at IS NULL))` },
    ]);
    expect([await checksOn(owner(), DEVICES), await checksOn(owner(), INPUTS)]).toEqual([11, 8]);
    // The guard on both tables, ENABLE ALWAYS; the two functions belong to the owner role.
    expect(await setObjects(owner())).toEqual({ functions: [DESTROY_FUNCTION, GUARD_FUNCTION], triggers: [...GUARD_TRIGGERS] });
    expect((await owner().query(`SELECT tgname::text AS name, tgenabled::text AS mode FROM pg_trigger WHERE tgname IN ('${GUARD_TRIGGERS.join("', '")}') ORDER BY 1`)).rows).toEqual(
      GUARD_TRIGGERS.map((name) => ({ name, mode: 'A' })),
    );
    expect((await owner().query(`SELECT proname::text AS name, pg_get_userbyid(proowner)::text AS owner, prosecdef AS definer FROM pg_proc WHERE proname IN ('${GUARD_FUNCTION}', '${DESTROY_FUNCTION}') ORDER BY 1`)).rows).toEqual([
      { name: DESTROY_FUNCTION, owner: 'dems_owner', definer: true },
      { name: GUARD_FUNCTION, owner: 'dems_owner', definer: false },
    ]);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const before = await readAppliedMigrations(owner());
    const objectsBefore = await owner().query(objects);
    const catalogBefore = await catalogDigest(owner());
    await applyMigrations(owner(), folderOf(THROUGH)).catch(() => undefined);
    expect(await readSchemaVersion(owner())).toEqual(SET_16);
    expect(await readAppliedMigrations(owner())).toEqual(before);
    expect((await owner().query(objects)).rows).toEqual(objectsBefore.rows);
    expect(await catalogDigest(owner())).toEqual(catalogBefore);
  });

  it('FROM EMPTY: a database migrated from nothing to set 16 has the same catalog as the one stepped from (14, dbc-15)', async () => {
    const stepped = await catalogDigest(owner());
    await withClone('set16_from_empty', async (other) => {
      await migrateThrough(other.ownerPool(), THROUGH, SET_16);
      expect(await catalogDigest(other.ownerPool())).toEqual(stepped);
      expect(await readAppliedMigrations(other.ownerPool())).toHaveLength(THROUGH);
    });
  });
});

describe('M16S-4: what the database accepts and what it refuses around a retirement, as dems_app', () => {
  it.each([
    ['an instant without an operator', T, null, RETIRED_CHECK],
    ['an operator without an instant', null, TECHNICIAN, RETIRED_CHECK],
  ] as const)('BOTH OR NEITHER: %s is refused (23514) and the row stays in service', async (_what, at, by, constraint) => {
    await expectRefused(() => retire(db.appPool(), 'CAM-03', at, by), SQLSTATE.checkViolation, constraint);
    expect(await retiredOf(owner(), 'CAM-03')).toEqual([{ retired_at: null, retired_by: null }]);
  });

  it('THE POE SWITCH IS NEVER RETIRED: instant and operator both set on POE-A1 is refused (23514)', async () => {
    await expectRefused(() => retire(db.appPool(), 'POE-A1', RETIRED_AT, TECHNICIAN), SQLSTATE.checkViolation, RETIRED_KIND_CHECK);
    expect(await retiredOf(owner(), 'POE-A1')).toEqual([{ retired_at: null, retired_by: null }]);
  });

  it('an operator the database does not know is refused (23503)', async () => {
    await expectRefused(() => retire(db.appPool(), 'CAM-03', RETIRED_AT, 'OPR-777'), SQLSTATE.foreignKeyViolation, RETIRED_BY_FKEY);
  });

  it('THE DESTROY PATH REFUSES A DEVICE IN SERVICE: 0 rows, the credential of CAM-03 is kept', async () => {
    expect(await destroy(db.appPool(), 'CAM-03')).toBe(0);
    expect(await credentialsOf('CAM-03')).toBe(1);
    expect(await destroy(db.appPool(), 'CAM-99')).toBe(0);
  });

  it('A ROLLBACK RESTORES IT: retired and destroyed inside a unit that rolls back, the camera is in service and its credential is there', async () => {
    const client = await db.appPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE ${DEVICES} SET retired_at = $1, retired_by = $2 WHERE id = 'CAM-03'`, [RETIRED_AT, TECHNICIAN]);
      expect((await client.query(`SELECT public.${DESTROY_FUNCTION}('CAM-03') AS destroyed`)).rows).toEqual([{ destroyed: 1 }]);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    expect(await credentialsOf('CAM-03')).toBe(1);
    expect(await retiredOf(owner(), 'CAM-03')).toEqual([{ retired_at: null, retired_by: null }]);
  });

  it('THE RETIREMENT, in one unit as the runtime role: the camera is retired, its credential destroyed (1, then 0), its registry row and stream row kept', async () => {
    const client = await db.appPool().connect();
    try {
      await client.query('BEGIN');
      expect((await client.query(`UPDATE ${DEVICES} SET retired_at = $1, retired_by = $2 WHERE id = 'CAM-03'`, [RETIRED_AT, TECHNICIAN])).rowCount).toBe(1);
      expect((await client.query(`SELECT public.${DESTROY_FUNCTION}('CAM-03') AS destroyed`)).rows).toEqual([{ destroyed: 1 }]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    expect(await retiredOf(owner(), 'CAM-03')).toEqual([{ retired_at: String(RETIRED_AT), retired_by: TECHNICIAN }]);
    expect(await credentialsOf('CAM-03')).toBe(0);
    expect(await destroy(db.appPool(), 'CAM-03')).toBe(0);
    expect((await owner().query(`SELECT model, firmware, onvif_uuid, profiles FROM ${DEVICES} WHERE id = 'CAM-03'`)).rows).toEqual([
      { model: 'Fixture model', firmware: '1.2.3', onvif_uuid: CAMERA_UUID, profiles: ['HEVC_1080P'] },
    ]);
    expect((await owner().query(`SELECT device_id, profile FROM ${STREAMS}`)).rows).toEqual([{ device_id: 'CAM-03', profile: 'HEVC_1080P' }]);
  });

  it('the runtime role still deletes nothing: registry, credential, stream and input rows (42501)', async () => {
    for (const statement of [`DELETE FROM ${DEVICES} WHERE id = 'CAM-03'`, `DELETE FROM ${CREDENTIALS} WHERE device_id = 'CAM-03'`, `DELETE FROM ${STREAMS} WHERE device_id = 'CAM-03'`, `DELETE FROM ${INPUTS} WHERE device_id = 'MIC-03'`]) {
      await expectRefused(() => db.appPool().query(statement), SQLSTATE.insufficientPrivilege);
    }
  });

  it.each([
    ['the model (a pending seal reads it)', `SET model = 'Another model'`],
    ['the firmware', `SET firmware = '9.9.9'`],
    ['the address', `SET address = '127.0.0.2'`],
    ['the profile list', `SET profiles = '["H264_1080P"]'::jsonb`],
    ['UN-RETIRE: both columns back to NULL', 'SET retired_at = NULL, retired_by = NULL'],
    ['another instant', `SET retired_at = ${RETIRED_AT + 1}`],
    ['another operator', "SET retired_by = 'OPR-002'"],
  ])('THE GUARD: a retired camera is not changed - %s is refused (ZD001), as dems_app and as the owner', async (_what, assignment) => {
    const before = (await owner().query(`SELECT to_jsonb(d)::text AS image FROM ${DEVICES} AS d WHERE id = 'CAM-03'`)).rows;
    await expectRefused(() => db.appPool().query(`UPDATE ${DEVICES} ${assignment} WHERE id = 'CAM-03'`), RETIRED_ROW);
    await expectRefused(() => owner().query(`UPDATE ${DEVICES} ${assignment} WHERE id = 'CAM-03'`), RETIRED_ROW);
    expect((await owner().query(`SELECT to_jsonb(d)::text AS image FROM ${DEVICES} AS d WHERE id = 'CAM-03'`)).rows).toEqual(before);
  });

  it('what still moves on a retired camera: last_seen_at and enabled; a statement that writes the stored values again is no change', async () => {
    expect(await outcome(db.appPool().query(`UPDATE ${DEVICES} SET last_seen_at = $1, enabled = false WHERE id = 'CAM-03'`, [RETIRED_AT + 5]))).toBe('ok:1');
    expect(await outcome(db.appPool().query(`UPDATE ${DEVICES} SET model = model, profiles = profiles, retired_at = retired_at WHERE id = 'CAM-03'`))).toBe('ok:1');
    expect((await owner().query(`SELECT last_seen_at::text AS last_seen_at, enabled FROM ${DEVICES} WHERE id = 'CAM-03'`)).rows).toEqual([{ last_seen_at: String(RETIRED_AT + 5), enabled: false }]);
  });

  it('ADOPTED AGAIN UNDER A NEW ID: the retired camera no longer holds its ONVIF reference - CAM-04 takes it; a second device in service with it is refused (23505)', async () => {
    await insertRow(db.appPool(), 'capture_devices', captureDevice('CAM-04', 'CAMERA', { adapter_kind: 'ONVIF_RTSP', onvif_uuid: CAMERA_UUID }));
    await expectRefused(() => insertRow(db.appPool(), 'capture_devices', captureDevice('CAM-05', 'CAMERA', { onvif_uuid: CAMERA_UUID })), SQLSTATE.uniqueViolation, ONVIF_KEY);
    expect((await owner().query(`SELECT id, retired_at IS NOT NULL AS retired FROM ${DEVICES} WHERE onvif_uuid = $1 ORDER BY id`, [CAMERA_UUID])).rows).toEqual([
      { id: 'CAM-03', retired: true },
      { id: 'CAM-04', retired: false },
    ]);
  });

  it('THE MICROPHONE: retired with its input in one unit, the mirror holds the same instant; the card input is free for a NEW id, and once only (23505)', async () => {
    const client = await db.appPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE ${DEVICES} SET retired_at = $1, retired_by = $2 WHERE id = 'MIC-03'`, [RETIRED_AT, TECHNICIAN]);
      await client.query(`UPDATE ${INPUTS} SET retired_at = $1 WHERE device_id = 'MIC-03'`, [RETIRED_AT]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    expect((await owner().query(`SELECT d.retired_at = i.retired_at AS equal FROM ${DEVICES} AS d JOIN ${INPUTS} AS i ON i.device_id = d.id WHERE d.id = 'MIC-03'`)).rows).toEqual([{ equal: true }]);
    // MIC-04 was registered in M16S-1 and could not take the card input then; now it can.
    await insertRow(db.appPool(), 'capture_audio_inputs', captureAudioInput('MIC-04', { usb_serial: 'SN0042', usb_port: '1-1.4' }));
    await insertRow(db.appPool(), 'capture_devices', captureDevice('MIC-05', 'MIC', { adapter_kind: 'USB_AUDIO' }));
    await expectRefused(() => insertRow(db.appPool(), 'capture_audio_inputs', captureAudioInput('MIC-05')), SQLSTATE.uniqueViolation, CARD_INPUT_KEY);
    expect((await owner().query(`SELECT device_id, retired_at IS NOT NULL AS retired FROM ${INPUTS} ORDER BY device_id`)).rows).toEqual([
      { device_id: 'MIC-03', retired: true },
      { device_id: 'MIC-04', retired: false },
    ]);
  });

  it.each([
    ['the card', "SET card_id = 'USB2'"],
    ['the operator who touched it', "SET updated_by = 'OPR-002'"],
    ['UN-RETIRE', 'SET retired_at = NULL'],
  ])('THE GUARD: a retired input is not changed - %s is refused (ZD001)', async (_what, assignment) => {
    await expectRefused(() => db.appPool().query(`UPDATE ${INPUTS} ${assignment} WHERE device_id = 'MIC-03'`), RETIRED_ROW);
  });

  it('a row in service is not touched by the guard: CAM-04 and the input of MIC-04 change as before', async () => {
    expect(await outcome(db.appPool().query(`UPDATE ${DEVICES} SET model = 'Replacement unit' WHERE id = 'CAM-04'`))).toBe('ok:1');
    expect(await outcome(db.appPool().query(`UPDATE ${INPUTS} SET usb_port = '1-1.5' WHERE device_id = 'MIC-04'`))).toBe('ok:1');
  });
});

describe('M16S-5: B-3 across the step, in both directions', () => {
  it('the code of set 15 (14, dbc-15) on the migrated database is refused; the code of set 16 passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_15).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 15 (dbc-16); this server expects 14 (dbc-15)');
    await expect(checkSchemaVersion(db.appPool(), SET_16)).resolves.toBeUndefined();
    // This code passes exactly while set 16 is the last set; with a later set it names db:migrate.
    const here = await checkSchemaVersion(db.appPool()).then(
      () => 'passes',
      () => 'refused',
    );
    expect(here).toBe(isThisCode(SET_16) ? 'passes' : 'refused');
  });
});

describe('M16S-6: rollback', () => {
  it('FAILS WHILE APPLYING: the two files inside one transaction, rolled back before the commit, leave the catalog, the rows, the version and the ledger as they were', async () => {
    await withClone('set16_rollback_tx', async (other) => {
      const pool = other.ownerPool();
      await seedSetFifteen(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      const ledgerBefore = await readAppliedMigrations(pool);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const tag of TAGS) for (const chunk of chunksOf(tag)) await client.query(chunk);
        // Inside the transaction the set is in force: a camera is retired, its credential destroyed, the version stepped.
        await client.query(`UPDATE ${DEVICES} SET retired_at = ${RETIRED_AT}, retired_by = '${TECHNICIAN}' WHERE id = 'CAM-03'`);
        expect((await client.query(`SELECT public.${DESTROY_FUNCTION}('CAM-03') AS destroyed`)).rows).toEqual([{ destroyed: 1 }]);
        expect((await client.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows).toEqual([{ schema_version: 15, contract_revision: 'dbc-16' }]);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      expect(await readSchemaVersion(pool)).toEqual(SET_15);
      expect(await readAppliedMigrations(pool)).toEqual(ledgerBefore);
      expect((await inspectLedger(pool)).pending).toEqual([...TAGS, ...LATER]);
      expect(await setObjects(pool)).toEqual({ functions: [], triggers: [] });
      await expect(checkSchemaVersion(other.appPool(), SET_15)).resolves.toBeUndefined();
      await expectRefused(() => other.appPool().query(`SELECT retired_at FROM ${DEVICES}`), UNDEFINED_COLUMN);
    });
  });

  it('APPLIED, AND MUST BE UNDONE: with no row retired, the undo statements return the catalog to the one of (14, dbc-15), every stored value is what it was, and the code of set 15 starts again', async () => {
    await withClone('set16_rollback_undo', async (other) => {
      const pool = other.ownerPool();
      await seedSetFifteen(pool);
      const catalogBefore = await catalogDigest(pool);
      const rowsBefore = await storedBefore(pool);
      await migrateThrough(pool, THROUGH, SET_16);
      expect((await catalogDigest(pool)).digest).not.toBe(catalogBefore.digest);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_16) await client.query(statement);
        // In a delivered forward set the version steps ONWARD; here it is set to the pair of set 15
        // so that the comparison below is with the database as it was.
        await client.query("UPDATE public.schema_meta SET schema_version = 14, contract_revision = 'dbc-15' WHERE singleton");
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await storedBefore(pool)).toEqual(rowsBefore);
      await expect(checkSchemaVersion(other.appPool(), SET_15)).resolves.toBeUndefined();
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expectRefused(() => other.appPool().query(`SELECT retired_at FROM ${DEVICES}`), UNDEFINED_COLUMN);
      await expectRefused(() => insertRow(other.appPool(), 'capture_devices', captureDevice('CAM-04', 'CAMERA', { onvif_uuid: CAMERA_UUID })), SQLSTATE.uniqueViolation, ONVIF_KEY);
    });
  });

  it('THE PRECONDITION OF THE UNDO: while one device is retired the undo is refused (55000) and changes nothing - a retired row is not rewritten', async () => {
    await withClone('set16_held', async (other) => {
      const pool = other.ownerPool();
      await seedSetFifteen(pool);
      await migrateThrough(pool, THROUGH, SET_16);
      await retire(other.appPool(), 'CAM-03', RETIRED_AT, TECHNICIAN);
      const catalogApplied = await catalogDigest(pool);
      const rowsApplied = await storedBefore(pool);
      const client = await pool.connect();
      let refusal: string | undefined;
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_16) await client.query(statement);
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
      expect(await readSchemaVersion(pool)).toEqual(SET_16);
      expect(await retiredOf(pool, 'CAM-03')).toEqual([{ retired_at: String(RETIRED_AT), retired_by: TECHNICIAN }]);
    });
  });
});

describe('M16S-7: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');

  it('0032 is generated: the two identity rules dropped, three columns added, the FK, the two rules again as partial unique indexes, the two CHECKs - and no statement that writes a row (MG-2, MG-8)', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toEqual([
      `ALTER TABLE "capture_audio_inputs" DROP CONSTRAINT "${CARD_INPUT_KEY}";`,
      `DROP INDEX "${ONVIF_KEY}";`,
      'ALTER TABLE "capture_audio_inputs" ADD COLUMN "retired_at" bigint;',
      'ALTER TABLE "capture_devices" ADD COLUMN "retired_at" bigint;',
      'ALTER TABLE "capture_devices" ADD COLUMN "retired_by" text;',
      `ALTER TABLE "capture_devices" ADD CONSTRAINT "${RETIRED_BY_FKEY}" FOREIGN KEY ("retired_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;`,
      `CREATE UNIQUE INDEX "${CARD_INPUT_KEY}" ON "capture_audio_inputs" USING btree ("card_id","card_device","input_number") WHERE "capture_audio_inputs"."retired_at" IS NULL;`,
      `CREATE UNIQUE INDEX "${ONVIF_KEY}" ON "capture_devices" USING btree ("onvif_uuid") WHERE "capture_devices"."onvif_uuid" IS NOT NULL AND "capture_devices"."retired_at" IS NULL;`,
      `ALTER TABLE "capture_devices" ADD CONSTRAINT "${RETIRED_CHECK}" CHECK (("capture_devices"."retired_at" IS NULL) = ("capture_devices"."retired_by" IS NULL));`,
      `ALTER TABLE "capture_devices" ADD CONSTRAINT "${RETIRED_KIND_CHECK}" CHECK ("capture_devices"."retired_at" IS NULL OR "capture_devices"."kind" <> 'POE');`,
    ]);
    // No statement BEGINS with a row-writing or privilege verb (the FK's own "ON DELETE restrict
    // ON UPDATE no action" is a clause, not a statement).
    expect(generated.filter((statement) => /^(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/.test(statement))).toEqual([]);
    const text = generated.join(' ');
    expect(text).not.toMatch(/NOT VALID|CREATE TABLE|DROP TABLE|DROP COLUMN|DROP NOT NULL|SET DEFAULT/i);
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[0]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('0033 is hand-written: two grants, the guard and its two triggers, the destroy function, the version row - no DELETE grant, no blanket form, no owner role', () => {
    const written = statementsOf(TAGS[1]);
    expect(written.map((statement) => /^(?:GRANT [A-Z]+|REVOKE ALL|CREATE FUNCTION public\.[a-z_]+|CREATE TRIGGER [a-z_]+|ALTER TABLE public\.[a-z_]+|UPDATE public\.schema_meta)/.exec(statement)?.[0])).toEqual([
      'GRANT UPDATE',
      'GRANT UPDATE',
      `CREATE FUNCTION public.${GUARD_FUNCTION}`,
      'REVOKE ALL',
      `CREATE TRIGGER ${GUARD_TRIGGERS[1]}`,
      `CREATE TRIGGER ${GUARD_TRIGGERS[0]}`,
      'ALTER TABLE public.capture_devices',
      'ALTER TABLE public.capture_audio_inputs',
      `CREATE FUNCTION public.${DESTROY_FUNCTION}`,
      'REVOKE ALL',
      'GRANT EXECUTE',
      'UPDATE public.schema_meta',
    ]);
    expect(written).toContain('GRANT UPDATE (retired_at, retired_by) ON capture_devices TO dems_app;');
    expect(written).toContain('GRANT UPDATE (retired_at) ON capture_audio_inputs TO dems_app;');
    expect(written).toContain(`GRANT EXECUTE ON FUNCTION public.${DESTROY_FUNCTION}(text) TO dems_app;`);
    expect(written.at(-1)).toBe("UPDATE public.schema_meta SET schema_version = 15, contract_revision = 'dbc-16' WHERE singleton;");
    const text = written.join(' ');
    expect(text).not.toMatch(/GRANT\s+(?:ALL|DELETE|TRUNCATE|SELECT|INSERT)|ALL\s+TABLES|dems_owner|dems_admin|DISABLE\s+TRIGGER/i);
    // The definer function names its search path and deletes only behind the retired test.
    expect(text).toMatch(/SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS \$\$ WITH gone AS \( DELETE FROM public\.capture_device_credentials AS c WHERE c\.device_id = p_device_id AND EXISTS \(SELECT 1 FROM public\.capture_devices AS d WHERE d\.id = c\.device_id AND d\.retired_at IS NOT NULL\)/);
  });

  it('0030 and 0031 hash to what they hashed to when set 15 was delivered: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0030_network_config_onvif_ports']).toBe('32f40e9df9c4a4f5634da9ac554ecfdb03a69b1896a31c7ce3b6f8e70762b111');
    expect(hashes['0031_network_config_onvif_ports_privileges']).toBe('fed56c865b48a8f9075acafa91b5565962dbff887cea8a10add4814d595e0c5c');
  });
});

describe('M16S-8: the demo reset carries a retired device unchanged (db/reset/kept-tables.ts, read only)', () => {
  it('the kept images hold the new columns: the carry reads every column of the typed schema', () => {
    const columnsOf = (name: string): readonly string[] => KEPT_TABLES.find((table) => table.name === name)?.columns ?? [];
    expect(columnsOf('capture_devices')).toEqual(expect.arrayContaining(['retired_at', 'retired_by']));
    expect(columnsOf('capture_audio_inputs')).toContain('retired_at');
  });

  it('a retired camera and microphone, their stream and input rows, cross the carry statements into a new set-16 database text for text; the guard lets the seeded built-in be replaced', async () => {
    const carried = ['capture_devices', 'capture_device_credentials', 'capture_device_streams', 'capture_audio_inputs'];
    const tables = KEPT_TABLES.filter((table) => carried.includes(table.name));
    expect(tables.map((table) => table.mode)).toEqual(['upsert', 'upsert', 'upsert', 'upsert']);
    await withClone('set16_carry', async (other) => {
      const target = other.ownerPool();
      await migrateThrough(target, THROUGH, SET_16);
      await insertRbac(target);
      // What the seed writes by key before the carry: the simulator's camera, in service.
      await insertRow(target, 'capture_devices', captureDevice('CAM-01', 'CAMERA', { model: 'Seeded model' }));
      for (const table of tables) {
        const images = (await owner().query<{ image: string }>(readImagesStatement(table))).rows.map((row) => row.image);
        await target.query(carryStatement(table), [imagesAsJsonArray(images)]);
        expect((await target.query<{ image: string }>(readImagesStatement(table))).rows.map((row) => row.image), table.name).toEqual(images);
      }
      expect((await target.query(`SELECT id, retired_at::text AS retired_at, retired_by FROM ${DEVICES} WHERE retired_at IS NOT NULL ORDER BY id`)).rows).toEqual([
        { id: 'CAM-03', retired_at: String(RETIRED_AT), retired_by: TECHNICIAN },
        { id: 'MIC-03', retired_at: String(RETIRED_AT), retired_by: TECHNICIAN },
      ]);
      // On the new side the guard holds the carried retired rows as on the old.
      await expectRefused(() => target.query(`UPDATE ${DEVICES} SET retired_at = NULL, retired_by = NULL WHERE id = 'CAM-03'`), RETIRED_ROW);
    });
  });
});
