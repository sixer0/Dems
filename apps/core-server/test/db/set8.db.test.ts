// Migration set 8 (`0015_capture_streams_audio_inputs.sql` +
// `0016_capture_streams_audio_inputs_privileges.sql`; schema set A of task 4, contract revision
// `dbc-8`, schema version 7; design `docs/2026-10-12_input_av_core_adapter_plan/masterplan/
// 03_db_schema_extension.md` sections 2.1 to 2.3 with `04_design_addendum.md` sections 1.4 #1 and
// 7.2; decisions U8, U11, C9, C14):
//
//   (a) T-44 `capture_device_streams`: what a profile code means on the camera;
//   (b) T-45 `capture_audio_inputs`: which sound-card input a microphone is;
//   (c) `session_capture_sources.source_facts`: the facts of the device as it was at the start;
//   (d) the six slot columns of `capture_config` nullable, with the slot-pair CHECK.
//
//   M8S-1  the pre-state is a genuine (6, 'dbc-7') database that HOLDS ROWS (the devices, the
//          selector, a session with its four source rows): this code is refused by B-3 naming
//          db:migrate, the code of set 7 is accepted, the six columns are NOT NULL
//   M8S-2  NEGATIVE CONTROL: with 0016 left out the two tables exist, the runtime role holds
//          nothing on them and the version stays (6, 'dbc-7')
//   M8S-3  set 8 applies exactly its two files, REWRITES NO STORED ROW (MG-8; the six slot columns
//          unchanged in content), ends at (7, 'dbc-8'); a second run applies nothing (MG-10)
//   M8S-4  (d) as dems_app: a video slot with a device and no profile is refused, and the reverse;
//          a slot may be unassigned; the three older rules still refuse what they refused
//   M8S-5  (a) as dems_app: streams are stored and re-read; the key is never changed, a row never
//          removed; the index on (device, lens, role) is PLAIN
//   M8S-6  (b) as dems_app: an input is allocated once; an input beyond the card is refused; the
//          rate is never changed
//   M8S-7  (c) as dems_app: the facts are a flat, bounded map with no denied key; never updated
//   M8S-8  B-3 across the step, in both directions
//   M8S-9  ROLLBACK: the set inside one transaction, rolled back, leaves the catalog and the
//          version as they were; the undo statements return an applied database to the catalog
//          of (6, 'dbc-7') and refuse to run while a slot is unassigned
//   M8S-10 the files: 0015 holds no data statement; 0016 is nine statements, no blanket form;
//          0013 and 0014 hash to what the development databases hold (MG-4)
//
// Every database here is a throw-away of this test run (TI-17). No value in this file is a
// credential: the "credential-shaped" keys are fixtures the CHECK must refuse.
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
import { useTestDatabase } from '../helpers/db';
import { captureAudioInput, captureConfig, captureDevice, captureDeviceStream, captureSource, insertRbac, insertRow, json, sessionHistory } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0015_capture_streams_audio_inputs', '0016_capture_streams_audio_inputs_privileges'] as const;
const STREAMS = 'public.capture_device_streams';
const INPUTS = 'public.capture_audio_inputs';
const SOURCES = 'public.session_capture_sources';
const SELECTOR = 'public.capture_config';
const SLOT_COLUMNS = ['video_01_device_id', 'video_01_profile', 'video_02_device_id', 'video_02_profile', 'mic_primary_id', 'mic_standby_id'] as const;
const SET_7 = { schemaVersion: 6, contractRevision: 'dbc-7' } as const;
const SET_8 = { schemaVersion: 7, contractRevision: 'dbc-8' } as const;
const SESSION_B = 'SES-20261012-0002';
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set8-'));
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
  expect(await readSchemaVersion(pool)).toEqual(SET_7);
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
 * source row is taken WITHOUT the column the set adds, so "before" and "after" are comparable: the
 * column itself is asserted apart (every existing row reads `{}`). The selector row is taken
 * WHOLE: the set changes the nullability of six of its columns and not one value.
 */
const storedBefore = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT (SELECT count(*)::int FROM public.capture_devices) AS devices,
            (SELECT count(*)::int FROM public.capture_config) AS selectors,
            (SELECT count(*)::int FROM public.session_capture_sources) AS sources,
            (SELECT md5(string_agg(to_jsonb(d)::text, '' ORDER BY d.id)) FROM public.capture_devices AS d) AS device_rows,
            (SELECT md5(string_agg(to_jsonb(c)::text, '')) FROM public.capture_config AS c) AS selector_rows,
            (SELECT md5(string_agg((to_jsonb(s) - 'source_facts')::text, '' ORDER BY s.session_id, s.slot)) FROM public.session_capture_sources AS s) AS source_rows,
            (SELECT md5(string_agg(to_jsonb(h)::text, '' ORDER BY h.id)) FROM public.session_history AS h) AS session_rows`,
  )).rows;
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

const nullability = async (owner: Pool): Promise<Record<string, string>> =>
  Object.fromEntries(
    (
      await owner.query<{ name: string; nullable: string }>(
        "SELECT column_name::text AS name, is_nullable::text AS nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capture_config' AND column_name = ANY($1::text[])",
        [[...SLOT_COLUMNS]],
      )
    ).rows.map((row) => [row.name, row.nullable]),
  );

/**
 * THE UNDO OF AN APPLIED SET 8 (schema design 3.5, "Applied, and must be undone"). The files of an
 * applied set are never edited and no down file exists in this repository, so an undo is delivered
 * as a NEW forward set that carries these statements and steps the version onward. They are kept
 * here, where a test runs them, so that the rollback is measured and not only described.
 * PRECONDITION: no slot of the selector is unassigned - `SET NOT NULL` refuses otherwise (23502),
 * which is the right answer: the old code cannot read such a row.
 * WHAT IT LOSES: the stream rows and the sound-card rows (re-read by a new connection test and a
 * new registration) and the `source_facts` of the sessions recorded meanwhile (not recoverable;
 * no sealed package is affected, nothing of this set is in a manifest).
 */
const UNDO_SET_8: readonly string[] = [
  'ALTER TABLE public.session_capture_sources DROP COLUMN source_facts',
  'ALTER TABLE public.capture_config DROP CONSTRAINT capture_config_slot_pair_check',
  ...SLOT_COLUMNS.map((column) => `ALTER TABLE public.capture_config ALTER COLUMN ${column} SET NOT NULL`),
  'DROP TABLE public.capture_audio_inputs',
  'DROP TABLE public.capture_device_streams',
];

describe('M8S-1: the pre-state, a (6, dbc-7) database that holds rows', () => {
  it('fifteen files applied, set 8 pending, no table and no column, six slot columns NOT NULL; this code is refused by B-3 and the code of set 7 passes', async () => {
    const owner = db.ownerPool();
    await migrateShort(owner, 15);
    const ledger = await inspectLedger(owner);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS]);
    expect((await owner.query(`SELECT to_regclass('${STREAMS}') IS NOT NULL AS streams, to_regclass('${INPUTS}') IS NOT NULL AS inputs`)).rows).toEqual([{ streams: false, inputs: false }]);
    expect((await owner.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_capture_sources' AND column_name = 'source_facts'")).rows).toEqual([{ n: 0 }]);
    expect(await nullability(owner)).toEqual(Object.fromEntries(SLOT_COLUMNS.map((column) => [column, 'NO'])));
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toBe(
      'B-3: the database is at schema version 6 (dbc-7); this server expects 7 (dbc-8). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>',
    );
    await expect(checkSchemaVersion(db.appPool(), SET_7)).resolves.toBeUndefined();
  });

  it('rows of the kind a development database holds: five devices (one adopted, with the tokens of its camera as its profile list), the selector, a session and its four source rows', async () => {
    const owner = db.ownerPool();
    await insertRbac(owner);
    for (const [id, kind] of [['CAM-01', 'CAMERA'], ['CAM-02', 'CAMERA'], ['MIC-01', 'MIC'], ['MIC-02', 'MIC']] as const) await insertRow(owner, 'capture_devices', captureDevice(id, kind));
    // What adoption stores today: the ONVIF tokens themselves, lower case included (finding F-DB-1).
    await insertRow(owner, 'capture_devices', captureDevice('CAM-03', 'CAMERA', { profiles: json(['profile_1', 'profile_2']) }));
    await insertRow(owner, 'capture_config', captureConfig());
    await insertRow(owner, 'session_history', sessionHistory());
    for (const slot of ['VIDEO-01', 'VIDEO-02', 'MIC-PRIMARY', 'MIC-STANDBY']) await insertRow(owner, 'session_capture_sources', captureSource(slot));
    expect(await storedBefore(owner)).toMatchObject([{ devices: 5, selectors: 1, sources: 4 }]);
  });

  it('THE STATE THAT IS MISSING: a slot cannot be unassigned - the column refuses NULL (23502)', async () => {
    await expectRefused(() => db.appPool().query(`UPDATE ${SELECTOR} SET mic_standby_id = NULL WHERE singleton`), SQLSTATE.notNullViolation);
  });
});

describe('M8S-2: NEGATIVE CONTROL - without 0016 the runtime role holds nothing on the two tables', () => {
  it('0015 alone: the tables exist, SELECT and INSERT answer 42501, the version stays (6, dbc-7)', async () => {
    const other = await db.another({ template: EMPTY_DATABASE, slug: 'set8_no0016' });
    await migrateShort(other.ownerPool(), 16);
    expect((await other.ownerPool().query(`SELECT to_regclass('${STREAMS}') IS NOT NULL AS streams, to_regclass('${INPUTS}') IS NOT NULL AS inputs`)).rows).toEqual([{ streams: true, inputs: true }]);
    for (const table of [STREAMS, INPUTS]) {
      await expectRefused(() => other.appPool().query(`SELECT 1 FROM ${table}`), SQLSTATE.insufficientPrivilege);
    }
    await expectRefused(() => insertRow(other.appPool(), 'capture_device_streams', captureDeviceStream('CAM-01', 'HEVC_1080P')), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => insertRow(other.appPool(), 'capture_audio_inputs', captureAudioInput('MIC-01')), SQLSTATE.insufficientPrivilege);
    await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
    await expect(checkSchemaVersion(other.appPool(), SET_7)).resolves.toBeUndefined();
  });
});

describe('M8S-3: set 8 applies its two files and rewrites no stored row', () => {
  it('db:migrate applies exactly 0015 and 0016 and steps the version to (7, dbc-8); the ledger holds seventeen files; every stored row is what it was', async () => {
    const owner = db.ownerPool();
    const rowsBefore = await storedBefore(owner);
    const objectsBefore = (await owner.query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    const selectorBefore = (await owner.query(`SELECT ${SLOT_COLUMNS.join(', ')}, revision::int AS revision FROM ${SELECTOR}`)).rows;
    const result = await applyMigrations(owner);
    expect(result.versionBefore).toEqual(SET_7);
    expect(result.applied).toEqual([...TAGS]);
    expect(result.versionAfter).toEqual(SET_8);
    expect(result.versionAfter).toEqual({ schemaVersion: DB_SCHEMA_VERSION, contractRevision: DB_CONTRACT_REVISION });
    expect(result.ledger.ok).toBe(true);
    expect(result.ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner)).toHaveLength(17);
    // Exactly six new objects: two tables, the index of each primary key, the index of the unique
    // constraint on a sound-card input, and the plain index on (device, lens, role).
    expect((await owner.query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore + 6);
    // MG-8: nothing was rewritten and nothing was backfilled.
    expect(await storedBefore(owner)).toEqual(rowsBefore);
    // The six slot columns: unchanged in content, value for value; only their nullability moved.
    expect((await owner.query(`SELECT ${SLOT_COLUMNS.join(', ')}, revision::int AS revision FROM ${SELECTOR}`)).rows).toEqual(selectorBefore);
    expect(selectorBefore).toEqual([
      { video_01_device_id: 'CAM-01', video_01_profile: 'UHD', video_02_device_id: 'CAM-02', video_02_profile: 'HD', mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02', revision: 1 },
    ]);
    expect(await nullability(owner)).toEqual(Object.fromEntries(SLOT_COLUMNS.map((column) => [column, 'YES'])));
    // Every source row that existed reads the permanent default, an empty map.
    expect((await owner.query(`SELECT slot, source_facts FROM ${SOURCES} ORDER BY slot`)).rows).toEqual([
      { slot: 'MIC-PRIMARY', source_facts: {} },
      { slot: 'MIC-STANDBY', source_facts: {} },
      { slot: 'VIDEO-01', source_facts: {} },
      { slot: 'VIDEO-02', source_facts: {} },
    ]);
    expect((await owner.query(`SELECT (SELECT count(*)::int FROM ${STREAMS}) AS streams, (SELECT count(*)::int FROM ${INPUTS}) AS inputs`)).rows).toEqual([{ streams: 0, inputs: 0 }]);
    // The CHECKs added to existing tables were validated against the stored rows (no NOT VALID constraint is left).
    expect(
      (await owner.query("SELECT conname::text AS name, convalidated FROM pg_constraint WHERE conname IN ('capture_config_slot_pair_check', 'session_capture_sources_source_facts_flat_check', 'session_capture_sources_source_facts_no_secret_keys_check', 'session_capture_sources_source_facts_bound_check') ORDER BY 1")).rows,
    ).toEqual([
      { name: 'capture_config_slot_pair_check', convalidated: true },
      { name: 'session_capture_sources_source_facts_bound_check', convalidated: true },
      { name: 'session_capture_sources_source_facts_flat_check', convalidated: true },
      { name: 'session_capture_sources_source_facts_no_secret_keys_check', convalidated: true },
    ]);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const owner = db.ownerPool();
    const before = await readAppliedMigrations(owner);
    const objectsBefore = await owner.query(objects);
    const result = await applyMigrations(owner);
    expect(result.applied).toEqual([]);
    expect(result.versionBefore).toEqual(SET_8);
    expect(result.versionAfter).toEqual(SET_8);
    expect(await readAppliedMigrations(owner)).toEqual(before);
    expect((await owner.query(objects)).rows).toEqual(objectsBefore.rows);
  });

  it('NOT IN THIS SET (stated, measured): no rule on the ELEMENTS of capture_devices.profiles - the adopted camera keeps its tokens, and one is still stored', async () => {
    const owner = db.ownerPool();
    // Requirement AD-06 (4) asks for a CHECK holding each element to the code pattern. It is not
    // built here, because adoption still stores the ONVIF tokens (connect.db.test.ts expects
    // ['profile_1']); the CHECK belongs to the set that follows the code-minting adoption.
    expect((await owner.query("SELECT profiles FROM public.capture_devices WHERE id = 'CAM-03'")).rows).toEqual([{ profiles: ['profile_1', 'profile_2'] }]);
    expect(
      (await owner.query("SELECT conname::text AS name FROM pg_constraint WHERE conrelid = 'public.capture_devices'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%profiles%' ORDER BY 1")).rows,
    ).toEqual([{ name: 'capture_devices_profiles_check' }]);
    expect(await outcome(db.appPool().query("UPDATE public.capture_devices SET profiles = '[\"profile_1\"]'::jsonb WHERE id = 'CAM-03'"))).toBe('ok:1');
  });
});

describe('M8S-4 (d): a slot of the selector may be unassigned, and a video slot is a pair', () => {
  const selector = async (): Promise<unknown> => (await db.ownerPool().query(`SELECT ${SLOT_COLUMNS.join(', ')} FROM ${SELECTOR}`)).rows[0];
  const ASSIGNED = { video_01_device_id: 'CAM-01', video_01_profile: 'UHD', video_02_device_id: 'CAM-02', video_02_profile: 'HD', mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02' };

  it('as dems_app: a video slot with a device and no profile is refused (23514), and a profile with no device', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query(`UPDATE ${SELECTOR} SET video_01_profile = NULL WHERE singleton`), SQLSTATE.checkViolation, 'capture_config_slot_pair_check');
    await expectRefused(() => app.query(`UPDATE ${SELECTOR} SET video_01_device_id = NULL WHERE singleton`), SQLSTATE.checkViolation, 'capture_config_slot_pair_check');
    await expectRefused(() => app.query(`UPDATE ${SELECTOR} SET video_02_profile = NULL WHERE singleton`), SQLSTATE.checkViolation, 'capture_config_slot_pair_check');
    await expectRefused(() => app.query(`UPDATE ${SELECTOR} SET video_02_device_id = NULL WHERE singleton`), SQLSTATE.checkViolation, 'capture_config_slot_pair_check');
    expect(await selector()).toEqual(ASSIGNED);
  });

  it('as dems_app: one video slot, one microphone, and then all four slots are unassigned; the row is assigned again', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(`UPDATE ${SELECTOR} SET video_02_device_id = NULL, video_02_profile = NULL WHERE singleton`))).toBe('ok:1');
    expect(await outcome(app.query(`UPDATE ${SELECTOR} SET mic_standby_id = NULL WHERE singleton`))).toBe('ok:1');
    expect(await selector()).toEqual({ ...ASSIGNED, video_02_device_id: null, video_02_profile: null, mic_standby_id: null });
    expect(await outcome(app.query(`UPDATE ${SELECTOR} SET video_01_device_id = NULL, video_01_profile = NULL, mic_primary_id = NULL WHERE singleton`))).toBe('ok:1');
    expect(await selector()).toEqual(Object.fromEntries(SLOT_COLUMNS.map((column) => [column, null])));
    // What the capture fence's own statement reads from such a row: no assigned source at all.
    expect(
      (await db.ownerPool().query(`SELECT count(*)::int AS assigned FROM ${SELECTOR} AS c JOIN public.capture_devices AS d ON d.id IN (c.video_01_device_id, c.video_02_device_id, c.mic_primary_id, c.mic_standby_id)`)).rows,
    ).toEqual([{ assigned: 0 }]);
    expect(
      await outcome(
        app.query(`UPDATE ${SELECTOR} SET video_01_device_id = 'CAM-01', video_01_profile = 'UHD', video_02_device_id = 'CAM-02', video_02_profile = 'HD', mic_primary_id = 'MIC-01', mic_standby_id = 'MIC-02' WHERE singleton`),
      ),
    ).toBe('ok:1');
    expect(await selector()).toEqual(ASSIGNED);
  });

  it('the three older rules keep their text and still refuse: one camera with one profile twice, one microphone twice, a profile that is no code, a device the registry does not hold', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query(`UPDATE ${SELECTOR} SET video_02_device_id = 'CAM-01', video_02_profile = 'UHD' WHERE singleton`), SQLSTATE.checkViolation, 'capture_config_selector_check');
    await expectRefused(() => app.query(`UPDATE ${SELECTOR} SET mic_standby_id = 'MIC-01' WHERE singleton`), SQLSTATE.checkViolation, 'capture_config_mic_check');
    await expectRefused(() => app.query(`UPDATE ${SELECTOR} SET video_01_profile = 'profile_1' WHERE singleton`), SQLSTATE.checkViolation, 'capture_config_profile_check');
    await expectRefused(() => app.query(`UPDATE ${SELECTOR} SET mic_standby_id = 'MIC-09' WHERE singleton`), SQLSTATE.foreignKeyViolation, 'capture_config_mic_standby_id_fkey');
    expect(await selector()).toEqual(ASSIGNED);
  });

  it('no grant moved: the runtime role updates the nine columns of 0005 and still neither inserts nor deletes the row', async () => {
    const app = db.appPool();
    expect(
      (await db.ownerPool().query("SELECT attname::text AS name FROM pg_attribute WHERE attrelid = 'public.capture_config'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('dems_app', attrelid, attnum, 'UPDATE') ORDER BY 1")).rows.map(
        (row: { name: string }) => row.name,
      ),
    ).toEqual([...SLOT_COLUMNS, 'revision', 'updated_at', 'updated_by'].sort());
    await expectRefused(() => app.query(`DELETE FROM ${SELECTOR}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => insertRow(app, 'capture_config', captureConfig({ singleton: false })), SQLSTATE.insufficientPrivilege);
  });
});

describe('M8S-5 (a): capture_device_streams, what a profile code means on the camera', () => {
  it('as dems_app: the main and the sub stream of a camera are stored, and a stream no test has read yet', async () => {
    const app = db.appPool();
    await insertRow(app, 'capture_device_streams', captureDeviceStream('CAM-03', 'HEVC_1080P'));
    await insertRow(app, 'capture_device_streams', captureDeviceStream('CAM-03', 'HEVC_360P', { onvif_profile_token: 'profile_2', stream_role: 'SUB', width: 640, height: 360 }));
    await insertRow(app, 'capture_device_streams', { device_id: 'CAM-02', profile: 'H264_1080P25', onvif_profile_token: 'MainStream', stream_role: 'MAIN', read_at: 1_000 });
    expect((await app.query(`SELECT device_id, profile, onvif_profile_token, video_source_token, lens, stream_role, codec, width, height FROM ${STREAMS} ORDER BY device_id, profile`)).rows).toEqual([
      { device_id: 'CAM-02', profile: 'H264_1080P25', onvif_profile_token: 'MainStream', video_source_token: null, lens: 1, stream_role: 'MAIN', codec: null, width: null, height: null },
      { device_id: 'CAM-03', profile: 'HEVC_1080P', onvif_profile_token: 'profile_1', video_source_token: 'VideoSource_1', lens: 1, stream_role: 'MAIN', codec: 'HEVC', width: 1920, height: 1080 },
      { device_id: 'CAM-03', profile: 'HEVC_360P', onvif_profile_token: 'profile_2', video_source_token: 'VideoSource_1', lens: 1, stream_role: 'SUB', codec: 'HEVC', width: 640, height: 360 },
    ]);
  });

  it('THE INDEX IS PLAIN (addendum 7.2): after the H.264 fallback the same lens and role has a second statement; one code per camera stays the key', async () => {
    const app = db.appPool();
    await insertRow(app, 'capture_device_streams', captureDeviceStream('CAM-03', 'H264_1080P25', { codec: 'H264' }));
    expect((await app.query(`SELECT count(*)::int AS main_of_lens_1 FROM ${STREAMS} WHERE device_id = 'CAM-03' AND lens = 1 AND stream_role = 'MAIN'`)).rows).toEqual([{ main_of_lens_1: 2 }]);
    await expectRefused(() => insertRow(app, 'capture_device_streams', captureDeviceStream('CAM-03', 'H264_1080P25')), SQLSTATE.uniqueViolation, 'capture_device_streams_pkey');
    expect(
      (await db.ownerPool().query("SELECT indexname::text AS name, indexdef LIKE 'CREATE UNIQUE%' AS is_unique FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'capture_device_streams' ORDER BY 1")).rows,
    ).toEqual([
      { name: 'capture_device_streams_device_lens_role_idx', is_unique: false },
      { name: 'capture_device_streams_pkey', is_unique: true },
    ]);
  });

  it('a re-read replaces what the stream test read; the key is never changed and a row never removed (42501)', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(`UPDATE ${STREAMS} SET codec = 'H264', width = 1280, height = 720, read_at = 2000, onvif_profile_token = 'profile_9', video_source_token = NULL, lens = 2, stream_role = 'SUB' WHERE device_id = 'CAM-02' AND profile = 'H264_1080P25'`))).toBe('ok:1');
    await expectRefused(() => app.query(`UPDATE ${STREAMS} SET profile = 'H264_720P25' WHERE device_id = 'CAM-02'`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`UPDATE ${STREAMS} SET device_id = 'CAM-01' WHERE device_id = 'CAM-02'`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`DELETE FROM ${STREAMS} WHERE device_id = 'CAM-02'`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`TRUNCATE ${STREAMS}`), SQLSTATE.insufficientPrivilege);
    expect((await db.ownerPool().query(`SELECT count(*)::int AS rows FROM ${STREAMS}`)).rows).toEqual([{ rows: 4 }]);
  });

  it.each([
    ['a microphone as the device', captureDeviceStream('MIC-01', 'HEVC_1080P'), SQLSTATE.checkViolation, 'capture_device_streams_device_id_check'],
    ['a camera the registry does not hold', captureDeviceStream('CAM-09', 'HEVC_1080P'), SQLSTATE.foreignKeyViolation, 'capture_device_streams_device_id_fkey'],
    ['the ONVIF token as the profile code', captureDeviceStream('CAM-01', 'profile_1'), SQLSTATE.checkViolation, 'capture_device_streams_profile_check'],
    ['a token with a space', captureDeviceStream('CAM-01', 'HEVC_1080P', { onvif_profile_token: 'profile 1' }), SQLSTATE.checkViolation, 'capture_device_streams_token_check'],
    ['a token with markup', captureDeviceStream('CAM-01', 'HEVC_1080P', { onvif_profile_token: '<b>main</b>' }), SQLSTATE.checkViolation, 'capture_device_streams_token_check'],
    ['a token of 65 characters', captureDeviceStream('CAM-01', 'HEVC_1080P', { onvif_profile_token: 't'.repeat(65) }), SQLSTATE.checkViolation, 'capture_device_streams_token_check'],
    ['a video source that is a locator', captureDeviceStream('CAM-01', 'HEVC_1080P', { video_source_token: ['rtsp:', '//host/stream'].join('') }), SQLSTATE.checkViolation, 'capture_device_streams_token_check'],
    ['lens 0', captureDeviceStream('CAM-01', 'HEVC_1080P', { lens: 0 }), SQLSTATE.checkViolation, 'capture_device_streams_lens_check'],
    ['lens 5', captureDeviceStream('CAM-01', 'HEVC_1080P', { lens: 5 }), SQLSTATE.checkViolation, 'capture_device_streams_lens_check'],
    ['a third role', captureDeviceStream('CAM-01', 'HEVC_1080P', { stream_role: 'PREVIEW' }), SQLSTATE.checkViolation, 'capture_device_streams_stream_role_check'],
    ['a codec name a camera wrote (AD-06 (1))', captureDeviceStream('CAM-01', 'HEVC_1080P', { codec: 'h265' }), SQLSTATE.checkViolation, 'capture_device_streams_codec_check'],
    ['a codec outside the closed set', captureDeviceStream('CAM-01', 'HEVC_1080P', { codec: 'MJPEG' }), SQLSTATE.checkViolation, 'capture_device_streams_codec_check'],
    ['a width without a height', captureDeviceStream('CAM-01', 'HEVC_1080P', { height: null }), SQLSTATE.checkViolation, 'capture_device_streams_size_check'],
    ['a width of zero', captureDeviceStream('CAM-01', 'HEVC_1080P', { width: 0 }), SQLSTATE.checkViolation, 'capture_device_streams_size_check'],
    ['a negative height', captureDeviceStream('CAM-01', 'HEVC_1080P', { height: -1080 }), SQLSTATE.checkViolation, 'capture_device_streams_size_check'],
    ['a width beyond the bound', captureDeviceStream('CAM-01', 'HEVC_1080P', { width: 16_385 }), SQLSTATE.checkViolation, 'capture_device_streams_size_check'],
  ])('a stream row that is not one is refused: %s', async (_what, row, code, constraint) => {
    await expectRefused(() => insertRow(db.appPool(), 'capture_device_streams', row), code, constraint);
  });

  it('the bounds of the rules are taken: lens 4, a picture of 16,384 by 1, a token of 64 characters with every admitted sign', async () => {
    const app = db.appPool();
    await insertRow(app, 'capture_device_streams', captureDeviceStream('CAM-01', 'OTHER_16384X1', { lens: 4, codec: 'OTHER', width: 16_384, height: 1, onvif_profile_token: `A.b_c:d-${'9'.repeat(56)}` }));
    expect((await app.query(`SELECT lens, codec, width, height, char_length(onvif_profile_token) AS token FROM ${STREAMS} WHERE device_id = 'CAM-01'`)).rows).toEqual([{ lens: 4, codec: 'OTHER', width: 16_384, height: 1, token: 64 }]);
  });

  it('the table has ten columns and no place for a secret, an address or a locator; a device with a stream is not removed', async () => {
    const { rows } = await db.ownerPool().query<{ name: string; type: string }>(
      "SELECT column_name::text AS name, data_type::text AS type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capture_device_streams' ORDER BY ordinal_position",
    );
    expect(rows).toEqual([
      { name: 'device_id', type: 'text' },
      { name: 'profile', type: 'text' },
      { name: 'onvif_profile_token', type: 'text' },
      { name: 'video_source_token', type: 'text' },
      { name: 'lens', type: 'smallint' },
      { name: 'stream_role', type: 'text' },
      { name: 'codec', type: 'text' },
      { name: 'width', type: 'integer' },
      { name: 'height', type: 'integer' },
      { name: 'read_at', type: 'bigint' },
    ]);
    // ON DELETE RESTRICT, as the owner (the runtime role holds no DELETE on the registry at all).
    await expectRefused(() => db.ownerPool().query("DELETE FROM public.capture_devices WHERE id = 'CAM-03'"), SQLSTATE.restrictViolation);
  });
});

describe('M8S-6 (b): capture_audio_inputs, which sound-card input a microphone is', () => {
  it('as dems_app: two microphones are two inputs of one card; a card that is not USB has no USB id', async () => {
    const app = db.appPool();
    await insertRow(app, 'capture_audio_inputs', captureAudioInput('MIC-01'));
    await insertRow(app, 'capture_audio_inputs', captureAudioInput('MIC-02', { usb_id: null, input_number: 2, updated_by: null }));
    expect((await app.query(`SELECT device_id, usb_id, card_id, card_device, input_number, native_channels, sample_rate, sample_bits FROM ${INPUTS} ORDER BY device_id`)).rows).toEqual([
      { device_id: 'MIC-01', usb_id: '1235:8211', card_id: 'USB', card_device: 0, input_number: 1, native_channels: 4, sample_rate: 48_000, sample_bits: 24 },
      { device_id: 'MIC-02', usb_id: null, card_id: 'USB', card_device: 0, input_number: 2, native_channels: 4, sample_rate: 48_000, sample_bits: 24 },
    ]);
  });

  it('the defaults are the tested request: device 0, 48 kHz, 24 bits', async () => {
    const owner = db.ownerPool();
    await insertRow(owner, 'capture_devices', captureDevice('MIC-03', 'MIC'));
    await insertRow(db.appPool(), 'capture_audio_inputs', { device_id: 'MIC-03', card_id: 'Scarlett_4i4', input_number: 3, native_channels: 4, updated_at: 1_000 });
    expect((await owner.query(`SELECT card_device, sample_rate, sample_bits, usb_id, updated_by FROM ${INPUTS} WHERE device_id = 'MIC-03'`)).rows).toEqual([
      { card_device: 0, sample_rate: 48_000, sample_bits: 24, usb_id: null, updated_by: null },
    ]);
  });

  it('AN INPUT IS ALLOCATED ONCE: the same card, device and input for a second microphone is refused (23505), by an INSERT and by an UPDATE', async () => {
    const owner = db.ownerPool();
    const app = db.appPool();
    await insertRow(owner, 'capture_devices', captureDevice('MIC-04', 'MIC'));
    await expectRefused(() => insertRow(app, 'capture_audio_inputs', captureAudioInput('MIC-04')), SQLSTATE.uniqueViolation, 'capture_audio_inputs_card_input_key');
    await expectRefused(() => app.query(`UPDATE ${INPUTS} SET input_number = 1 WHERE device_id = 'MIC-02'`), SQLSTATE.uniqueViolation, 'capture_audio_inputs_card_input_key');
    // The same input number on ANOTHER card, and on another device of the same card, is another input.
    await insertRow(app, 'capture_audio_inputs', captureAudioInput('MIC-04', { card_device: 1 }));
    expect((await owner.query(`SELECT count(*)::int AS rows FROM ${INPUTS}`)).rows).toEqual([{ rows: 4 }]);
  });

  it('a change of card or input is an UPDATE; the key and the rate are never changed, and a row never removed (42501)', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(`UPDATE ${INPUTS} SET usb_id = '0582:012f', card_id = 'UA_4FX2', card_device = 0, input_number = 4, native_channels = 4, sample_bits = 32, updated_by = 'OPR-001', updated_at = 2000 WHERE device_id = 'MIC-04'`))).toBe('ok:1');
    await expectRefused(() => app.query(`UPDATE ${INPUTS} SET sample_rate = 48000 WHERE device_id = 'MIC-04'`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`UPDATE ${INPUTS} SET device_id = 'MIC-03' WHERE device_id = 'MIC-04'`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`DELETE FROM ${INPUTS} WHERE device_id = 'MIC-04'`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`TRUNCATE ${INPUTS}`), SQLSTATE.insufficientPrivilege);
  });

  it.each([
    ['a camera as the device', captureAudioInput('CAM-01'), SQLSTATE.checkViolation, 'capture_audio_inputs_device_id_check'],
    ['a microphone the registry does not hold', captureAudioInput('MIC-09', { input_number: 3 }), SQLSTATE.foreignKeyViolation, 'capture_audio_inputs_device_id_fkey'],
    ['AN INPUT BEYOND THE CARD', captureAudioInput('MIC-01', { input_number: 5, native_channels: 4 }), SQLSTATE.checkViolation, 'capture_audio_inputs_input_check'],
    ['input 0', captureAudioInput('MIC-01', { input_number: 0 }), SQLSTATE.checkViolation, 'capture_audio_inputs_input_check'],
    ['a card of 65 channels', captureAudioInput('MIC-01', { input_number: 65, native_channels: 65 }), SQLSTATE.checkViolation, 'capture_audio_inputs_input_check'],
    ['a rate that is not the one rate', captureAudioInput('MIC-01', { sample_rate: 44_100 }), SQLSTATE.checkViolation, 'capture_audio_inputs_sample_rate_check'],
    ['20 bits', captureAudioInput('MIC-01', { sample_bits: 20 }), SQLSTATE.checkViolation, 'capture_audio_inputs_sample_bits_check'],
    ['a USB id in upper case', captureAudioInput('MIC-01', { usb_id: '1235:821F' }), SQLSTATE.checkViolation, 'capture_audio_inputs_usb_id_check'],
    ['a USB id that is a product name', captureAudioInput('MIC-01', { usb_id: 'Scarlett 4i4 USB' }), SQLSTATE.checkViolation, 'capture_audio_inputs_usb_id_check'],
    ['a card id with a space (a descriptor string, AD-07 (1))', captureAudioInput('MIC-01', { card_id: 'USB Audio' }), SQLSTATE.checkViolation, 'capture_audio_inputs_card_check'],
    ['a card id with a shell sign', captureAudioInput('MIC-01', { card_id: 'USB;reboot' }), SQLSTATE.checkViolation, 'capture_audio_inputs_card_check'],
    ['a card id of 33 characters', captureAudioInput('MIC-01', { card_id: 'c'.repeat(33) }), SQLSTATE.checkViolation, 'capture_audio_inputs_card_check'],
    ['card device 32', captureAudioInput('MIC-01', { card_device: 32 }), SQLSTATE.checkViolation, 'capture_audio_inputs_card_check'],
  ])('an input row that is not one is refused: %s', async (_what, row, code, constraint) => {
    // MIC-01 has a row already: a CHECK is evaluated before any key, so the refusal is the rule's.
    await expectRefused(() => insertRow(db.appPool(), 'capture_audio_inputs', row), code, constraint);
  });

  it('who changed it is an operator: one that does not exist is refused (23503); the rows are what they were', async () => {
    await expectRefused(() => db.appPool().query(`UPDATE ${INPUTS} SET updated_by = 'OPR-999', updated_at = 3000 WHERE device_id = 'MIC-03'`), SQLSTATE.foreignKeyViolation, 'capture_audio_inputs_updated_by_fkey');
    expect((await db.ownerPool().query(`SELECT device_id, card_id, card_device, input_number FROM ${INPUTS} ORDER BY device_id`)).rows).toEqual([
      { device_id: 'MIC-01', card_id: 'USB', card_device: 0, input_number: 1 },
      { device_id: 'MIC-02', card_id: 'USB', card_device: 0, input_number: 2 },
      { device_id: 'MIC-03', card_id: 'Scarlett_4i4', card_device: 0, input_number: 3 },
      { device_id: 'MIC-04', card_id: 'UA_4FX2', card_device: 0, input_number: 4 },
    ]);
  });
});

describe('M8S-7 (c): session_capture_sources.source_facts, the device as it was when the session started', () => {
  const CAMERA_FACTS = { model: 'DS-2CD2143G2-I', firmware: 'V5.7.3 build 220112', mac: '00:11:22:33:44:55', codec: 'HEVC', width: 2560, height: 1440, lens: 1, streamRole: 'MAIN' };
  const MIC_FACTS = { model: 'Scarlett 4i4 USB', usbId: '1235:8212', cardId: 'USB', cardDevice: 0, inputNumber: 1, nativeChannels: 4, sampleBits: 24 };
  const source = (slot: string, facts?: unknown): Record<string, unknown> =>
    captureSource(slot, { session_id: SESSION_B, ...(facts === undefined ? {} : { source_facts: json(facts) }) });

  it('as dems_app: the four rows of a session carry the facts of a camera and of a sound-card input; a row written without the column reads {}', async () => {
    const app = db.appPool();
    await insertRow(app, 'session_capture_sources', source('VIDEO-01', CAMERA_FACTS));
    await insertRow(app, 'session_capture_sources', source('VIDEO-02'));
    await insertRow(app, 'session_capture_sources', source('MIC-PRIMARY', MIC_FACTS));
    await insertRow(app, 'session_capture_sources', source('MIC-STANDBY', {}));
    expect((await app.query(`SELECT slot, source_facts FROM ${SOURCES} WHERE session_id = $1 ORDER BY slot`, [SESSION_B])).rows).toEqual([
      { slot: 'MIC-PRIMARY', source_facts: MIC_FACTS },
      { slot: 'MIC-STANDBY', source_facts: {} },
      { slot: 'VIDEO-01', source_facts: CAMERA_FACTS },
      { slot: 'VIDEO-02', source_facts: {} },
    ]);
  });

  it.each([
    ['a user name', { model: 'm', username: 'someone' }, 'session_capture_sources_source_facts_no_secret_keys_check'],
    ['a media locator', { model: 'm', mediaUrl: 'x' }, 'session_capture_sources_source_facts_no_secret_keys_check'],
    ['an ONVIF endpoint reference', { onvifUuid: 'x' }, 'session_capture_sources_source_facts_no_secret_keys_check'],
    ['a password', { password: 'x' }, 'session_capture_sources_source_facts_no_secret_keys_check'],
    ['a nested map (free JSON)', { model: { vendor: 'v', name: 'n' } }, 'session_capture_sources_source_facts_flat_check'],
    ['a list', { profiles: ['a', 'b'] }, 'session_capture_sources_source_facts_flat_check'],
    ['a text of 121 characters', { model: 'm'.repeat(121) }, 'session_capture_sources_source_facts_bound_check'],
    ['a text with a line break', { model: 'DS-2CD\n2143' }, 'session_capture_sources_source_facts_bound_check'],
    ['a text with a tab', { firmware: 'V5\t7' }, 'session_capture_sources_source_facts_bound_check'],
    ['a text with an escape character', { model: 'DS\u001b[31m' }, 'session_capture_sources_source_facts_bound_check'],
    ['AN OVERSIZED BODY: 20 texts of 110 characters, each inside its own bound', Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`fact${index}`, 'f'.repeat(110)])), 'session_capture_sources_source_facts_bound_check'],
    ['an oversized body made of keys alone', Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`k${String(index).padStart(5, '0')}`, 1])), 'session_capture_sources_source_facts_bound_check'],
  ])('facts that are not facts are refused by the database (23514): %s', async (_what, facts, constraint) => {
    await expectRefused(() => insertRow(db.appPool(), 'session_capture_sources', captureSource('VIDEO-01', { session_id: 'SES-20261012-0009', source_facts: json(facts) })), SQLSTATE.checkViolation, constraint);
    expect((await db.ownerPool().query(`SELECT count(*)::int AS rows FROM ${SOURCES} WHERE session_id = 'SES-20261012-0009'`)).rows).toEqual([{ rows: 0 }]);
  });

  it('what is no map at all is refused: a list, a text, a number in place of the facts', async () => {
    for (const value of [['a'], 'model', 7]) {
      const refusal = await expectRefused(() => insertRow(db.appPool(), 'session_capture_sources', captureSource('VIDEO-01', { session_id: 'SES-20261012-0009', source_facts: json(value) })), SQLSTATE.checkViolation);
      expect(refusal.constraint).toMatch(/^session_capture_sources_source_facts_(flat|bound)_check$/);
    }
  });

  it('the bounds are taken: a text of exactly 120 characters, an empty text, a text in another script, numbers, flags and null', async () => {
    const facts = { model: 'm'.repeat(120), firmware: '', vendor: 'Kamera Utama カメラ', width: 3840, ratio: 1.5, wide: true, lens: null };
    await insertRow(db.appPool(), 'session_capture_sources', captureSource('VIDEO-01', { session_id: 'SES-20261012-0003', source_facts: json(facts) }));
    expect((await db.ownerPool().query(`SELECT source_facts FROM ${SOURCES} WHERE session_id = 'SES-20261012-0003'`)).rows).toEqual([{ source_facts: facts }]);
  });

  it('the facts are never changed: UPDATE of the column answers 42501, like every column of the table; a row is never removed', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query(`UPDATE ${SOURCES} SET source_facts = '{}'::jsonb WHERE session_id = $1`, [SESSION_B]), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`UPDATE ${SOURCES} SET source_facts = source_facts || '{"model":"other"}'::jsonb WHERE session_id = $1`, [SESSION_B]), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`DELETE FROM ${SOURCES} WHERE session_id = $1`, [SESSION_B]), SQLSTATE.insufficientPrivilege);
    expect(
      (await db.ownerPool().query("SELECT count(*)::int AS updatable FROM pg_attribute WHERE attrelid = 'public.session_capture_sources'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('dems_app', attrelid, attnum, 'UPDATE')")).rows,
    ).toEqual([{ updatable: 0 }]);
  });
});

describe('M8S-8: B-3 across the step, in both directions', () => {
  it('the code of set 7 (6, dbc-7) on the migrated database is refused; this code passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_7).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 7 (dbc-8); this server expects 6 (dbc-7)');
    await expect(checkSchemaVersion(db.appPool())).resolves.toBeUndefined();
  });
});

describe('M8S-9: rollback', () => {
  /** A (6, dbc-7) database with the rows of M8S-1. */
  async function seededSetSeven(slug: string) {
    const other = await db.another({ template: EMPTY_DATABASE, slug });
    const owner = other.ownerPool();
    await migrateShort(owner, 15);
    await insertRbac(owner);
    for (const [id, kind] of [['CAM-01', 'CAMERA'], ['CAM-02', 'CAMERA'], ['MIC-01', 'MIC'], ['MIC-02', 'MIC']] as const) await insertRow(owner, 'capture_devices', captureDevice(id, kind));
    await insertRow(owner, 'capture_config', captureConfig());
    await insertRow(owner, 'session_history', sessionHistory());
    for (const slot of ['VIDEO-01', 'VIDEO-02', 'MIC-PRIMARY', 'MIC-STANDBY']) await insertRow(owner, 'session_capture_sources', captureSource(slot));
    return other;
  }

  it('FAILS WHILE APPLYING: the two files inside one transaction, rolled back before the commit, leave the catalog, the rows, the version and the ledger as they were', async () => {
    const other = await seededSetSeven('set8_rollback_tx');
    const owner = other.ownerPool();
    const catalogBefore = await catalogDigest(owner);
    const rowsBefore = await storedBefore(owner);
    const ledgerBefore = await readAppliedMigrations(owner);
    const client = await owner.connect();
    try {
      await client.query('BEGIN');
      for (const tag of TAGS) for (const chunk of chunksOf(tag)) await client.query(chunk);
      // Inside the transaction the set is in force: the tables exist and the version is stepped.
      expect((await client.query(`SELECT to_regclass('${STREAMS}') IS NOT NULL AS streams, to_regclass('${INPUTS}') IS NOT NULL AS inputs`)).rows).toEqual([{ streams: true, inputs: true }]);
      expect((await client.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows).toEqual([{ schema_version: 7, contract_revision: 'dbc-8' }]);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    expect(await catalogDigest(owner)).toEqual(catalogBefore);
    expect(await storedBefore(owner)).toEqual(rowsBefore);
    expect(await readSchemaVersion(owner)).toEqual(SET_7);
    expect(await readAppliedMigrations(owner)).toEqual(ledgerBefore);
    expect((await inspectLedger(owner)).pending).toEqual([...TAGS]);
    await expect(checkSchemaVersion(other.appPool(), SET_7)).resolves.toBeUndefined();
  });

  it('APPLIED, AND MUST BE UNDONE: the undo statements return the catalog to the one of (6, dbc-7), every row that existed is what it was, and the code of set 7 starts again', async () => {
    const other = await seededSetSeven('set8_rollback_undo');
    const owner = other.ownerPool();
    const catalogBefore = await catalogDigest(owner);
    const rowsBefore = await storedBefore(owner);
    await applyMigrations(owner);
    expect(await readSchemaVersion(owner)).toEqual(SET_8);
    const catalogApplied = await catalogDigest(owner);
    expect(catalogApplied.digest).not.toBe(catalogBefore.digest);
    // Rows the set made possible, written while it was applied: they are what an undo loses.
    await insertRow(other.appPool(), 'capture_device_streams', captureDeviceStream('CAM-01', 'HEVC_1080P'));
    await insertRow(other.appPool(), 'capture_audio_inputs', captureAudioInput('MIC-01'));

    const client = await owner.connect();
    try {
      await client.query('BEGIN');
      for (const statement of UNDO_SET_8) await client.query(statement);
      // In a delivered forward set the version steps ONWARD; here it is set to the pair of set 7
      // so that the comparison below is with the database as it was.
      await client.query("UPDATE public.schema_meta SET schema_version = 6, contract_revision = 'dbc-7' WHERE singleton");
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    expect(await catalogDigest(owner)).toEqual(catalogBefore);
    expect(await storedBefore(owner)).toEqual(rowsBefore);
    expect((await owner.query(`SELECT to_regclass('${STREAMS}') IS NOT NULL AS streams, to_regclass('${INPUTS}') IS NOT NULL AS inputs`)).rows).toEqual([{ streams: false, inputs: false }]);
    expect(await nullability(owner)).toEqual(Object.fromEntries(SLOT_COLUMNS.map((column) => [column, 'NO'])));
    await expect(checkSchemaVersion(other.appPool(), SET_7)).resolves.toBeUndefined();
    await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
  });

  it('THE PRECONDITION OF THE UNDO: while a slot is unassigned the undo is refused (23502) and changes nothing', async () => {
    const other = await seededSetSeven('set8_rollback_null');
    const owner = other.ownerPool();
    await applyMigrations(owner);
    await other.appPool().query(`UPDATE ${SELECTOR} SET mic_standby_id = NULL WHERE singleton`);
    const catalogApplied = await catalogDigest(owner);
    const client = await owner.connect();
    let refusal: string | undefined;
    try {
      await client.query('BEGIN');
      for (const statement of UNDO_SET_8) await client.query(statement);
      await client.query('COMMIT');
    } catch (error) {
      refusal = (error as { code?: string }).code;
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    expect(refusal).toBe(SQLSTATE.notNullViolation);
    expect(await catalogDigest(owner)).toEqual(catalogApplied);
    expect(await readSchemaVersion(owner)).toEqual(SET_8);
  });
});

describe('M8S-10: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');

  it('0015 is generated: two CREATE TABLE, six DROP NOT NULL, one ADD COLUMN, three foreign keys, one plain index, four CHECKs - and no statement that writes a row (MG-2, MG-8)', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toHaveLength(17);
    expect(generated[0]).toMatch(/^CREATE TABLE "capture_audio_inputs" \(/);
    expect(generated[1]).toMatch(/^CREATE TABLE "capture_device_streams" \(/);
    expect(generated.slice(2, 9)).toEqual([
      ...SLOT_COLUMNS.map((column) => `ALTER TABLE "capture_config" ALTER COLUMN "${column}" DROP NOT NULL;`),
      'ALTER TABLE "session_capture_sources" ADD COLUMN "source_facts" jsonb DEFAULT \'{}\'::jsonb NOT NULL;',
    ]);
    expect(generated.slice(9).map((statement) => /^(?:ALTER TABLE "[a-z_]+" ADD CONSTRAINT|CREATE INDEX) "([a-z0-9_]+)"/.exec(statement)?.[1])).toEqual([
      'capture_audio_inputs_device_id_fkey',
      'capture_audio_inputs_updated_by_fkey',
      'capture_device_streams_device_id_fkey',
      'capture_device_streams_device_lens_role_idx',
      'capture_config_slot_pair_check',
      'session_capture_sources_source_facts_flat_check',
      'session_capture_sources_source_facts_no_secret_keys_check',
      'session_capture_sources_source_facts_bound_check',
    ]);
    // The three foreign keys state their referential actions; apart from those words, no statement names a write.
    const text = generated.join(' ').replaceAll('ON DELETE restrict ON UPDATE no action', '');
    expect(generated.join(' ').split('ON DELETE restrict ON UPDATE no action')).toHaveLength(4);
    expect(text).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/);
    expect(text).not.toMatch(/CREATE UNIQUE INDEX|NOT VALID|bytea|DROP TABLE|DROP COLUMN|DROP CONSTRAINT/i);
    // The one jsonb column of the set carries its permanent default and its three rules.
    expect(text.match(/\bjsonb\b/g)).toHaveLength(2);
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[0]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('0016 is hand-written: four grants, four boundary revokes and the version row; no blanket form, no role but dems_app, nothing on capture_config', () => {
    const written = statementsOf(TAGS[1]);
    expect(written).toEqual([
      'GRANT SELECT, INSERT ON capture_device_streams TO dems_app;',
      'GRANT UPDATE (onvif_profile_token, video_source_token, lens, stream_role, codec, width, height, read_at) ON capture_device_streams TO dems_app;',
      'REVOKE DELETE, TRUNCATE ON capture_device_streams FROM dems_app;',
      'GRANT SELECT, INSERT ON capture_audio_inputs TO dems_app;',
      'GRANT UPDATE (usb_id, card_id, card_device, input_number, native_channels, sample_bits, updated_by, updated_at) ON capture_audio_inputs TO dems_app;',
      'REVOKE UPDATE (sample_rate) ON capture_audio_inputs FROM dems_app;',
      'REVOKE DELETE, TRUNCATE ON capture_audio_inputs FROM dems_app;',
      'REVOKE UPDATE (source_facts) ON session_capture_sources FROM dems_app;',
      "UPDATE public.schema_meta SET schema_version = 7, contract_revision = 'dbc-8' WHERE singleton;",
    ]);
    expect(written.join(' ')).not.toMatch(/ALL\s+TABLES/i);
    expect(written.join(' ')).not.toMatch(/dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER|capture_config/i);
  });

  it('0013 and 0014 hash to what the ledgers of the development databases store: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0013_key_id_fault_reason_media_root']).toBe('962328293aeff866ed99cdd3e730e63bb7da056d1e7828bb9497e19965a544a3');
    expect(hashes['0014_key_id_fault_reason_media_root_privileges']).toBe('86aab8c0548822b35d8a242dfa9cae9c9770189b129ed5b1f2b9169b99fd77c7');
  });
});
