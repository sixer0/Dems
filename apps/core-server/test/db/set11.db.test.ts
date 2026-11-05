// Migration set 11 (`0021_profile_codes_data.sql` + `0022_profile_codes.sql` +
// `0023_profile_codes_privileges.sql`; contract revision `dbc-11`, schema version 10; requirement
// AD-06 (4) of `docs/2026-10-12_input_av_core_adapter_plan/verification/04_security_addendum.md`,
// listed by blueprint row 17, deferred by it, built in code by row 51 and handed over to the
// migration writer; decisions C29 (2), C36):
//
//   (a) the DATA STEP: a stored profile list that holds anything but codes of the Core becomes the
//       empty list (an ONVIF token list of an adoption before row 51);
//   (b) `capture_devices_profiles_code_check`: every element of `capture_devices.profiles` is a
//       code of the Core.
//
//   M11S-1  the pre-state is a genuine (9, 'dbc-10') database SEEDED WITH THE OLD FORM: ten
//           devices, of which five hold a list that is no list of codes; the database accepts a
//           token list there; this code is refused by B-3, the code of set 10 is accepted
//   M11S-2  NEGATIVE CONTROLS: the CHECK without the data step cannot be added (23514, nothing
//           changes); the data step without the CHECK empties the lists and leaves the door open
//   M11S-3  set 11 applies exactly its three files: FIVE rows changed, each to the empty list and
//           in no other column; the five other devices, the stream rows and the selector are what
//           they were; ends at (10, 'dbc-11'); a second run applies nothing (MG-10)
//   M11S-4  (b) as dems_app: the empty list and lists of codes are accepted; what adoption wrote
//           before row 51 and every other shape are refused (23514)
//   M11S-5  B-3 across the step, in both directions
//   M11S-6  ROLLBACK: the set inside one transaction, rolled back, leaves the catalog, EVERY ROW
//           (the old lists included) and the version as they were; the undo statements return an
//           applied database to the catalog of (9, 'dbc-10') - and do NOT bring a list back
//   M11S-7  the files: 0021 is one UPDATE whose predicate is the CHECK negated, letter for letter;
//           0022 is one ADD CONSTRAINT; 0023 is the version row; 0019 and 0020 are unedited (MG-4)
//
// Every database here is a throw-away of this test run (TI-17). No camera was involved: the
// devices are fixture rows and their tokens are fixture texts of the form a camera uses.
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
import { captureConfigHistoric, captureDevice, captureDeviceStream, insertRbac, insertRow, json } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0021_profile_codes_data', '0022_profile_codes', '0023_profile_codes_privileges'] as const;
/** The number of files through set 11: this file stops there, whatever set comes later. */
const THROUGH = 24;
/** The files of the sets after set 11, pending on a database of set 11. */
const LATER: readonly string[] = INITIAL_MIGRATION_TAGS.slice(THROUGH);
const DEVICES = 'public.capture_devices';
const CHECK = 'capture_devices_profiles_code_check';
const SET_10 = { schemaVersion: 9, contractRevision: 'dbc-10' } as const;
const SET_11 = { schemaVersion: 10, contractRevision: 'dbc-11' } as const;
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set11-'));
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

/**
 * THE OLD FORM, AND WHAT STANDS BESIDE IT. Ten devices as a database holds them that a Core ran
 * on before row 51 and after it:
 *
 *   id          adapter      profiles                          after the data step
 *   CAM-01      FAKE         ["H264_1080P25"]                  unchanged (a code)
 *   CAM-02      FAKE         []                                unchanged (already empty)
 *   CAM-03      ONVIF_RTSP   ["profile_1"]                     EMPTIED  (one ONVIF token)
 *   CAM-04      ONVIF_RTSP   ["Profile_1", "Profile_2"]        EMPTIED  (two ONVIF tokens)
 *   CAM-05      ONVIF_RTSP   ["HEVC_1080P", "profile_2"]       EMPTIED  (one foreign element: the whole list goes)
 *   CAM-06      ONVIF_RTSP   ["HEVC_1080P", "H264_720P"]       unchanged (minted codes, with their two stream rows)
 *   CAM-07      ONVIF_RTSP   ["MainStream.0"]                  EMPTIED  (a token with a dot)
 *   CAM-08      ONVIF_RTSP   [7, null, ["HEVC_1080P"]]         EMPTIED  (no texts at all: a hand edit)
 *   MIC-01      FAKE         ["PCM_48K16"]                     unchanged
 *   POE-SWITCH  FAKE         []                                unchanged
 *
 * The selector names CAM-03 on its first video slot: a camera whose list is about to be emptied.
 */
const OLD_FORM: ReadonlyArray<readonly [id: string, kind: 'CAMERA' | 'MIC' | 'POE', adapter: string, profiles: unknown, emptied: boolean]> = [
  ['CAM-01', 'CAMERA', 'FAKE', ['H264_1080P25'], false],
  ['CAM-02', 'CAMERA', 'FAKE', [], false],
  ['CAM-03', 'CAMERA', 'ONVIF_RTSP', ['profile_1'], true],
  ['CAM-04', 'CAMERA', 'ONVIF_RTSP', ['Profile_1', 'Profile_2'], true],
  ['CAM-05', 'CAMERA', 'ONVIF_RTSP', ['HEVC_1080P', 'profile_2'], true],
  ['CAM-06', 'CAMERA', 'ONVIF_RTSP', ['HEVC_1080P', 'H264_720P'], false],
  ['CAM-07', 'CAMERA', 'ONVIF_RTSP', ['MainStream.0'], true],
  ['CAM-08', 'CAMERA', 'ONVIF_RTSP', [7, null, ['HEVC_1080P']], true],
  ['MIC-01', 'MIC', 'FAKE', ['PCM_48K16'], false],
  ['POE-SWITCH', 'POE', 'FAKE', [], false],
];
const EMPTIED = OLD_FORM.filter(([, , , , emptied]) => emptied).map(([id]) => id);
const KEPT = OLD_FORM.filter(([, , , , emptied]) => !emptied).map(([id]) => id);

/** A (9, dbc-10) database with the ten devices, two stream rows of CAM-06 and the selector. */
async function seedOldForm(owner: Pool): Promise<void> {
  await migrateThrough(owner, 21, SET_10);
  await insertRbac(owner);
  for (const [id, kind, adapter, profiles] of OLD_FORM) await insertRow(owner, 'capture_devices', captureDevice(id, kind, { adapter_kind: adapter, profiles: json(profiles) }));
  await insertRow(owner, 'capture_device_streams', captureDeviceStream('CAM-06', 'HEVC_1080P'));
  await insertRow(owner, 'capture_device_streams', captureDeviceStream('CAM-06', 'H264_720P', { onvif_profile_token: 'profile_2', stream_role: 'SUB', codec: 'H264', width: 1280, height: 720 }));
  // D61 (2026-11-05): the pre-D61 shape (mic_primary_id/mic_standby_id, six slot columns) — at
  // this (9, 'dbc-10') boundary 0039/0040 have not run and mic_01_id.. do not exist; see
  // captureConfigHistoric in fixtures.ts.
  await insertRow(owner, 'capture_config', captureConfigHistoric({ video_01_device_id: 'CAM-03', video_01_profile: 'H264_1080P25', video_02_device_id: 'CAM-01', video_02_profile: 'H264_1080P25', mic_standby_id: null }));
}

/** The profile list of every device, by id. */
const lists = async (pool: Pool): Promise<Record<string, unknown>> =>
  Object.fromEntries((await pool.query<{ id: string; profiles: unknown }>(`SELECT id, profiles FROM ${DEVICES} ORDER BY id`)).rows.map((row) => [row.id, row.profiles]));
/** Every device row WITHOUT its profile list, as one digest per id: what the data step must not touch. */
const otherColumns = async (pool: Pool): Promise<unknown> =>
  (await pool.query(`SELECT id, md5((to_jsonb(d) - 'profiles')::text) AS rest FROM ${DEVICES} AS d ORDER BY id`)).rows;
/** The tables beside the registry that the step must not touch. */
const beside = async (pool: Pool): Promise<unknown> =>
  (await pool.query(
    `SELECT (SELECT md5(string_agg(to_jsonb(s)::text, '' ORDER BY s.device_id, s.profile)) FROM public.capture_device_streams AS s) AS stream_rows,
            (SELECT count(*)::int FROM public.capture_device_streams) AS streams,
            (SELECT md5(string_agg(to_jsonb(c)::text, '')) FROM public.capture_config AS c) AS selector_row,
            (SELECT md5(string_agg(to_jsonb(o)::text, '' ORDER BY o.id)) FROM public.operators AS o) AS operator_rows`,
  )).rows;
const checkPresent = async (pool: Pool): Promise<boolean> =>
  ((await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = '${CHECK}'`)).rows[0]?.n ?? 0) === 1;

/** A clone for one case, dropped when the case ends (the run keeps few clones alive at a time). */
async function withClone(slug: string, work: (other: TestDatabase) => Promise<void>): Promise<void> {
  const other = await db.another({ template: EMPTY_DATABASE, slug });
  try {
    await work(other);
  } finally {
    await other.drop();
  }
}

/**
 * THE UNDO OF AN APPLIED SET 11 ("applied, and must be undone"): a NEW forward set that carries
 * this statement and steps the version onward. No precondition: dropping a CHECK refuses nothing.
 * WHAT IT DOES NOT BRING BACK: the lists the data step emptied. The tokens were not kept anywhere
 * (they were no codes, and nothing but that list held them); the cameras are tested again, which
 * is what they need under this set as well.
 */
const UNDO_SET_11: readonly string[] = [`ALTER TABLE public.capture_devices DROP CONSTRAINT ${CHECK}`];

const owner = (): Pool => db.ownerPool();

describe('M11S-1: the pre-state, a (9, dbc-10) database seeded with the old form', () => {
  it('twenty-one files applied, set 11 pending, no CHECK on the elements; this code is refused by B-3 and the code of set 10 passes', async () => {
    await seedOldForm(owner());
    const ledger = await inspectLedger(owner());
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner(), folderOf(THROUGH))).pending).toEqual([...TAGS]);
    expect(await checkPresent(owner())).toBe(false);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    // The pair this code expects is read from its constants: it moves with every later set.
    expect((error as BootCheckError).message).toBe(
      `B-3: the database is at schema version 9 (dbc-10); this server expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
    await expect(checkSchemaVersion(db.appPool(), SET_10)).resolves.toBeUndefined();
  });

  it('ten devices; five hold a list that is no list of codes (four token lists and one that holds no text at all), five hold codes or nothing', async () => {
    expect(await lists(owner())).toEqual(Object.fromEntries(OLD_FORM.map(([id, , , profiles]) => [id, profiles])));
    expect(EMPTIED).toEqual(['CAM-03', 'CAM-04', 'CAM-05', 'CAM-07', 'CAM-08']);
    expect(KEPT).toEqual(['CAM-01', 'CAM-02', 'CAM-06', 'MIC-01', 'POE-SWITCH']);
    // The question the data step asks, asked here read-only: which rows will it change?
    const { rows } = await owner().query<{ id: string }>(
      `SELECT id FROM ${DEVICES} WHERE jsonb_typeof(profiles) = 'array' AND jsonb_path_exists(profiles, 'strict $[*]?(@.type() != "string" || !(@ like_regex "^[A-Z][A-Z0-9_]{0,63}$"))') ORDER BY id`,
    );
    expect(rows.map((row) => row.id)).toEqual(EMPTIED);
  });

  it('THE RULE THAT IS MISSING: as dems_app a token list is written into a registry row and stored (ok:1) - only the code of row 51 stands between a camera text and this column', async () => {
    expect(await outcome(db.appPool().query(`UPDATE ${DEVICES} SET profiles = $1::jsonb WHERE id = 'CAM-03'`, [json(['profile_1'])]))).toBe('ok:1');
    expect((await lists(owner()))['CAM-03']).toEqual(['profile_1']);
  });
});

describe('M11S-2: NEGATIVE CONTROLS - each half of the set without the other', () => {
  it('THE CHECK WITHOUT THE DATA STEP cannot be added: 0022 alone answers 23514 on the stored rows and nothing changes', async () => {
    await withClone('set11_no0021', async (other) => {
      const pool = other.ownerPool();
      await seedOldForm(pool);
      const before = await lists(pool);
      const [statement] = chunksOf(TAGS[1]);
      const refusal = await expectRefused(() => pool.query(statement ?? ''), SQLSTATE.checkViolation);
      expect(refusal.constraint).toBe(CHECK);
      expect(await checkPresent(pool)).toBe(false);
      expect(await lists(pool)).toEqual(before);
      expect(await readSchemaVersion(pool)).toEqual(SET_10);
    });
  });

  it('THE DATA STEP WITHOUT THE CHECK: 0021 alone empties the five lists, the version stays (9, dbc-10), and a token list is accepted again afterwards', async () => {
    await withClone('set11_no0022', async (other) => {
      const pool = other.ownerPool();
      await seedOldForm(pool);
      await migrateThrough(pool, 22, SET_10);
      const after = await lists(pool);
      for (const id of EMPTIED) expect(after[id], id).toEqual([]);
      expect(await checkPresent(pool)).toBe(false);
      expect(await outcome(other.appPool().query(`UPDATE ${DEVICES} SET profiles = $1::jsonb WHERE id = 'CAM-03'`, [json(['profile_1'])]))).toBe('ok:1');
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      await expect(checkSchemaVersion(other.appPool(), SET_10)).resolves.toBeUndefined();
    });
  });
});

describe('M11S-3: set 11 applies its three files; the data step changes five rows and nothing else', () => {
  it('db:migrate applies exactly 0021, 0022 and 0023 and steps the version to (10, dbc-11): FIVE of ten devices get the empty list, in no other column; the five others, the stream rows, the selector and the operators are what they were', async () => {
    const listsBefore = await lists(owner());
    const restBefore = await otherColumns(owner());
    const besideBefore = await beside(owner());
    const objectsBefore = (await owner().query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    const folder = folderOf(THROUGH);
    expect((await inspectLedger(owner(), folder)).pending).toEqual([...TAGS]);
    await migrateThrough(owner(), THROUGH, SET_11);
    const ledger = await inspectLedger(owner(), folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner())).toHaveLength(THROUGH);

    // THE COUNT: the rows whose list differs from before.
    const listsAfter = await lists(owner());
    const changed = Object.keys(listsBefore).filter((id) => JSON.stringify(listsBefore[id]) !== JSON.stringify(listsAfter[id]));
    expect(changed).toEqual(EMPTIED);
    expect(changed).toHaveLength(5);
    for (const id of EMPTIED) expect(listsAfter[id], id).toEqual([]);
    for (const id of KEPT) expect(listsAfter[id], id).toEqual(listsBefore[id]);
    // A camera whose minted codes stand beside their stream rows keeps both.
    expect(listsAfter['CAM-06']).toEqual(['HEVC_1080P', 'H264_720P']);
    // No other column of any device moved: address, model, adapter, endpoint reference, enabled.
    expect(await otherColumns(owner())).toEqual(restBefore);
    // The tables beside the registry: the stream rows, the selector (it still names CAM-03), the operators.
    expect(await beside(owner())).toEqual(besideBefore);
    expect((await owner().query('SELECT video_01_device_id, video_01_profile FROM public.capture_config')).rows).toEqual([{ video_01_device_id: 'CAM-03', video_01_profile: 'H264_1080P25' }]);
    // No table, no index: the count of objects is what it was. The CHECK is there and validated.
    expect((await owner().query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore);
    expect((await owner().query(`SELECT conname::text AS name, convalidated FROM pg_constraint WHERE conname = '${CHECK}'`)).rows).toEqual([{ name: CHECK, convalidated: true }]);
    // After the step no stored list breaks the rule: the data step's own question finds nothing.
    expect(
      (await owner().query(`SELECT count(*)::int AS left_over FROM ${DEVICES} WHERE jsonb_path_exists(profiles, 'strict $[*]?(@.type() != "string" || !(@ like_regex "^[A-Z][A-Z0-9_]{0,63}$"))')`)).rows,
    ).toEqual([{ left_over: 0 }]);
  });

  it('WHAT THE EMPTIED CAMERA NEEDS: its row, address and adapter are there, its list is empty - a connection test writes its codes (as dems_app: an UPDATE of the list)', async () => {
    const app = db.appPool();
    expect((await app.query(`SELECT id, adapter_kind, address, enabled, profiles FROM ${DEVICES} WHERE id = 'CAM-03'`)).rows).toEqual([{ id: 'CAM-03', adapter_kind: 'ONVIF_RTSP', address: '127.0.0.1', enabled: true, profiles: [] }]);
    expect(await outcome(app.query(`UPDATE ${DEVICES} SET profiles = $1::jsonb WHERE id = 'CAM-03'`, [json(['HEVC_1080P'])]))).toBe('ok:1');
    expect(await outcome(app.query(`UPDATE ${DEVICES} SET profiles = '[]'::jsonb WHERE id = 'CAM-03'`))).toBe('ok:1');
  });

  it('a second run applies nothing and changes nothing (MG-10): no list is emptied twice, no code list is touched', async () => {
    const before = await readAppliedMigrations(owner());
    const listsBefore = await lists(owner());
    const catalogBefore = await catalogDigest(owner());
    await applyMigrations(owner(), folderOf(THROUGH)).catch(() => undefined);
    expect(await readSchemaVersion(owner())).toEqual(SET_11);
    expect(await readAppliedMigrations(owner())).toEqual(before);
    expect(await lists(owner())).toEqual(listsBefore);
    expect(await catalogDigest(owner())).toEqual(catalogBefore);
  });

  it('A DATABASE WITHOUT THE OLD FORM: on an empty database and on one whose devices hold codes only, the data step changes NO row', async () => {
    await withClone('set11_clean', async (other) => {
      const pool = other.ownerPool();
      await migrateThrough(pool, 21, SET_10);
      await insertRbac(pool);
      for (const [id, kind, adapter, profiles, emptied] of OLD_FORM) if (!emptied) await insertRow(pool, 'capture_devices', captureDevice(id, kind, { adapter_kind: adapter, profiles: json(profiles) }));
      const [update] = chunksOf(TAGS[0]);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        expect((await client.query(update ?? '')).rowCount).toBe(0);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      const before = await lists(pool);
      await migrateThrough(pool, THROUGH, SET_11);
      expect(await lists(pool)).toEqual(before);
    });
  });
});

describe('M11S-4 (b): every element of the profile list is a code of the Core', () => {
  const sixtyFour = `H${'9'.repeat(63)}`;

  it.each([
    ['the empty list (what adoption stores when no stream half ran)', []],
    ['one minted code', ['HEVC_1080P']],
    ['two minted codes', ['HEVC_2160P25', 'H264_720P30']],
    ['the codes of the simulated and development devices', ['H264_1080P25', 'PCM_48K16', 'UHD', 'HD']],
    ['a code of one letter', ['H']],
    ['a code of 64 characters', [sixtyFour]],
  ])('as dems_app, ACCEPTED: %s', async (_what, value) => {
    expect(sixtyFour).toHaveLength(64);
    expect(await outcome(db.appPool().query(`UPDATE ${DEVICES} SET profiles = $1::jsonb WHERE id = 'CAM-04'`, [json(value)]))).toBe('ok:1');
    expect((await lists(owner()))['CAM-04']).toEqual(value);
  });

  it.each([
    ['an ONVIF token as adoption stored it before row 51', ['profile_1']],
    ['a token in mixed case', ['Profile_1']],
    ['a token with a dot', ['MainStream.0']],
    ['a token with a colon and a hyphen', ['urn:profile-1']],
    ['one token among codes', ['HEVC_1080P', 'profile_2']],
    ['a code with a hyphen (the simulator\'s older spelling)', ['H264-1080P25']],
    ['a code that starts with a digit', ['1080P_HEVC']],
    ['a code that starts with an underscore', ['_HEVC']],
    ['a code of 65 characters', [`H${'9'.repeat(64)}`]],
    ['a code with a trailing blank', ['HEVC_1080P ']],
    ['a code with a leading blank', [' HEVC_1080P']],
    ['a code with a line break after it', ['HEVC_1080P\n']],
    ['two codes in one text', ['HEVC_1080P,H264_720P']],
    ['the empty text', ['']],
    ['a locator', [['rtsp:', '//192.168.1.64/stream1'].join('')]],
    ['a number', [1080]],
    ['a JSON null', [null]],
    ['a boolean', [true]],
    ['a map (a profile with its facts: they belong to capture_device_streams)', [{ code: 'HEVC_1080P' }]],
    ['a list inside the list (lax mode would unwrap it)', [['HEVC_1080P']]],
    ['a code followed by a nested token list', ['HEVC_1080P', ['profile_1']]],
  ])('as dems_app, REFUSED (23514) by the element CHECK: %s', async (_what, value) => {
    const before = (await lists(owner()))['CAM-04'];
    await expectRefused(() => db.appPool().query(`UPDATE ${DEVICES} SET profiles = $1::jsonb WHERE id = 'CAM-04'`, [json(value)]), SQLSTATE.checkViolation, CHECK);
    await expectRefused(() => insertRow(db.appPool(), 'capture_devices', captureDevice('CAM-90', 'CAMERA', { adapter_kind: 'ONVIF_RTSP', profiles: json(value) })), SQLSTATE.checkViolation, CHECK);
    expect((await lists(owner()))['CAM-04']).toEqual(before);
  });

  it('THE STATED LIMIT: the database holds the FORM, not the origin - a camera token that happens to be of the code form (`PROFILE_1`) is stored, and the data step did not empty such a list. That an element is a MINTED code (one with its stream row) is held by adoption (`assertAdoptedProfiles`), not by this CHECK', async () => {
    expect(await outcome(db.appPool().query(`UPDATE ${DEVICES} SET profiles = $1::jsonb WHERE id = 'CAM-04'`, [json(['PROFILE_1'])]))).toBe('ok:1');
    // The data step's own question does not find it either: the predicate is the CHECK negated.
    expect(
      (await owner().query(`SELECT count(*)::int AS found FROM ${DEVICES} WHERE id = 'CAM-04' AND jsonb_path_exists(profiles, 'strict $[*]?(@.type() != "string" || !(@ like_regex "^[A-Z][A-Z0-9_]{0,63}$"))')`)).rows,
    ).toEqual([{ found: 0 }]);
    // No stream row says what `PROFILE_1` means on that camera: the production adapter refuses its open.
    expect((await owner().query("SELECT count(*)::int AS streams FROM public.capture_device_streams WHERE device_id = 'CAM-04'")).rows).toEqual([{ streams: 0 }]);
    expect(await outcome(db.appPool().query(`UPDATE ${DEVICES} SET profiles = '[]'::jsonb WHERE id = 'CAM-04'`))).toBe('ok:1');
  });

  it.each([
    ['a map in place of the list', {}],
    ['a text in place of the list', 'HEVC_1080P'],
    ['a number in place of the list', 7],
    ['a JSON null in place of the list', null],
  ])('what is no list at all is refused as a RULE (23514), never as a path error: %s', async (_what, value) => {
    const refusal = await expectRefused(() => db.appPool().query(`UPDATE ${DEVICES} SET profiles = $1::jsonb WHERE id = 'CAM-04'`, [json(value)]), SQLSTATE.checkViolation);
    // Two CHECKs refuse it; PostgreSQL names the first in name order, the older one.
    expect(refusal.constraint).toBe('capture_devices_profiles_check');
  });

  it('EACH RULE ON ITS OWN: with the older array CHECK taken away, what is no list is still refused by the element CHECK (its ELSE branch), as a rule', async () => {
    await withClone('set11_own_rule', async (other) => {
      const pool = other.ownerPool();
      await migrateThrough(pool, THROUGH, SET_11);
      await insertRow(pool, 'capture_devices', captureDevice('CAM-01', 'CAMERA'));
      await pool.query('ALTER TABLE public.capture_devices DROP CONSTRAINT capture_devices_profiles_check');
      for (const value of [{}, 'HEVC_1080P', 7, null]) {
        await expectRefused(() => other.appPool().query(`UPDATE ${DEVICES} SET profiles = $1::jsonb WHERE id = 'CAM-01'`, [json(value)]), SQLSTATE.checkViolation, CHECK);
      }
    });
  });

  it('the column default still satisfies the rule: a device inserted without a list holds the empty list', async () => {
    const row = captureDevice('CAM-91', 'CAMERA', { adapter_kind: 'ONVIF_RTSP' });
    delete (row as Record<string, unknown>)['profiles'];
    await insertRow(db.appPool(), 'capture_devices', row);
    expect((await lists(owner()))['CAM-91']).toEqual([]);
  });

  it('the privileges of the runtime role on the registry are what they were: it updates the ten columns of 0005, removes no row', async () => {
    expect(
      (await owner().query<{ name: string }>("SELECT attname::text AS name FROM pg_attribute WHERE attrelid = 'public.capture_devices'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('dems_app', attrelid, attnum, 'UPDATE') ORDER BY 1")).rows.map((row) => row.name),
    ).toEqual(['address', 'enabled', 'firmware', 'last_seen_at', 'mac', 'model', 'onvif_uuid', 'poe_port', 'profiles', 'transport']);
    await expectRefused(() => db.appPool().query(`DELETE FROM ${DEVICES} WHERE id = 'CAM-91'`), SQLSTATE.insufficientPrivilege);
  });
});

describe('M11S-5: B-3 across the step, in both directions', () => {
  it('the code of set 10 (9, dbc-10) on the migrated database is refused; the code of set 11 passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_10).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 10 (dbc-11); this server expects 9 (dbc-10)');
    await expect(checkSchemaVersion(db.appPool(), SET_11)).resolves.toBeUndefined();
    // This code passes exactly while set 11 is the last set; with a later set it names db:migrate.
    const here = await checkSchemaVersion(db.appPool()).then(
      () => 'passes',
      () => 'refused',
    );
    expect(here).toBe(isThisCode(SET_11) ? 'passes' : 'refused');
  });
});

describe('M11S-6: rollback', () => {
  it('FAILS WHILE APPLYING: the three files inside one transaction - the UPDATE reports FIVE rows - rolled back before the commit, leave the catalog, EVERY LIST (the old form included), the version and the ledger as they were', async () => {
    await withClone('set11_rollback_tx', async (other) => {
      const pool = other.ownerPool();
      await seedOldForm(pool);
      const catalogBefore = await catalogDigest(pool);
      const listsBefore = await lists(pool);
      const restBefore = await otherColumns(pool);
      const ledgerBefore = await readAppliedMigrations(pool);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const counts: Array<number | null> = [];
        for (const tag of TAGS) for (const chunk of chunksOf(tag)) counts.push((await client.query(chunk)).rowCount);
        // 0021: the UPDATE changed five rows. 0022: a constraint. 0023: the one version row.
        expect(counts[0]).toBe(5);
        expect(counts.at(-1)).toBe(1);
        expect(counts).toHaveLength(3);
        expect((await client.query(`SELECT count(*)::int AS emptied FROM ${DEVICES} WHERE profiles = '[]'::jsonb`)).rows).toEqual([{ emptied: 7 }]);
        expect((await client.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows).toEqual([{ schema_version: 10, contract_revision: 'dbc-11' }]);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await lists(pool)).toEqual(listsBefore);
      expect(await otherColumns(pool)).toEqual(restBefore);
      expect(await readSchemaVersion(pool)).toEqual(SET_10);
      expect(await readAppliedMigrations(pool)).toEqual(ledgerBefore);
      expect((await inspectLedger(pool)).pending).toEqual([...TAGS, ...LATER]);
      await expect(checkSchemaVersion(other.appPool(), SET_10)).resolves.toBeUndefined();
    });
  });

  it('APPLIED, AND MUST BE UNDONE: the undo statement returns the catalog to the one of (9, dbc-10) and the code of set 10 starts again - THE EMPTIED LISTS STAY EMPTY (an undo does not bring a token back)', async () => {
    await withClone('set11_rollback_undo', async (other) => {
      const pool = other.ownerPool();
      await seedOldForm(pool);
      const catalogBefore = await catalogDigest(pool);
      const restBefore = await otherColumns(pool);
      await migrateThrough(pool, THROUGH, SET_11);
      expect((await catalogDigest(pool)).digest).not.toBe(catalogBefore.digest);
      const applied = await lists(pool);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const statement of UNDO_SET_11) await client.query(statement);
        // In a delivered forward set the version steps ONWARD; here it is set to the pair of set 10
        // so that the comparison below is with the database as it was.
        await client.query("UPDATE public.schema_meta SET schema_version = 9, contract_revision = 'dbc-10' WHERE singleton");
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      expect(await catalogDigest(pool)).toEqual(catalogBefore);
      expect(await otherColumns(pool)).toEqual(restBefore);
      // What an undo loses is what the data step took: the five lists are still empty.
      expect(await lists(pool)).toEqual(applied);
      for (const id of EMPTIED) expect(applied[id], id).toEqual([]);
      await expect(checkSchemaVersion(other.appPool(), SET_10)).resolves.toBeUndefined();
      await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
      // The door is open again, as it was before the set.
      expect(await outcome(other.appPool().query(`UPDATE ${DEVICES} SET profiles = $1::jsonb WHERE id = 'CAM-03'`, [json(['profile_1'])]))).toBe('ok:1');
    });
  });
});

describe('M11S-7: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');
  const PATH = `'strict $[*]?(@.type() != "string" || !(@ like_regex "^[A-Z][A-Z0-9_]{0,63}$"))'`;

  it('0021 is hand-written: ONE statement, an UPDATE of one column of one table to the empty list, whose predicate is the CHECK of 0022 negated, letter for letter', () => {
    const written = statementsOf(TAGS[0]);
    expect(written).toEqual([`UPDATE public.capture_devices SET profiles = '[]'::jsonb WHERE jsonb_typeof(profiles) = 'array' AND jsonb_path_exists(profiles, ${PATH});`]);
    expect(written.join(' ')).not.toMatch(/DELETE|INSERT|TRUNCATE|GRANT|REVOKE|ALTER|DROP|capture_config|capture_device_streams|dems_owner|dems_admin/i);
  });

  it('0022 is generated: ONE ADD CONSTRAINT, with the same path literal, and no statement that writes a row (MG-2)', () => {
    const generated = statementsOf(TAGS[1]);
    expect(generated).toEqual([
      `ALTER TABLE "capture_devices" ADD CONSTRAINT "${CHECK}" CHECK (CASE WHEN jsonb_typeof("capture_devices"."profiles") = 'array' THEN NOT jsonb_path_exists("capture_devices"."profiles", ${PATH}) ELSE false END);`,
    ]);
    expect(generated.join(' ')).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/);
    expect(generated.join(' ')).not.toMatch(/NOT VALID/i);
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[1]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('0023 is hand-written: the version row and nothing else - no grant, no revoke, no role', () => {
    const written = statementsOf(TAGS[2]);
    expect(written).toEqual(["UPDATE public.schema_meta SET schema_version = 10, contract_revision = 'dbc-11' WHERE singleton;"]);
    expect(written.join(' ')).not.toMatch(/GRANT|REVOKE|ALL\s+TABLES|dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER/i);
  });

  it('the pattern of the path is the CODE form of the schema folder: a profile code is what every other code column holds', () => {
    expect(PATH).toContain('"^[A-Z][A-Z0-9_]{0,63}$"');
    expect(chunksOf('0004_capture').join(' ')).toContain("~ '^[A-Z][A-Z0-9_]{0,63}$'");
  });

  it('0019 and 0020 hash to what a database of set 10 stores: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0019_credential_replaced_reason']).toBe('8d92674b0605a9fa7e460f84b33405ee39b4e68b39c12cd0e13614bc182e8d97');
    expect(hashes['0020_credential_replaced_reason_privileges']).toBe('94a132452e5195ae635441577b0997678513eaa2da9d5ba8878ec53d3d6d4f78');
  });
});
