// Migration set 7 (`0013_key_id_fault_reason_media_root.sql` +
// `0014_key_id_fault_reason_media_root_privileges.sql`; database contract section N erratum
// PE-0013-01, contract revision `dbc-7`, schema version 6; controller rulings D146, D162, D166 -
// the rulings call the set "migration 0013"):
//
//   (a) `transcript_revisions_key_id_check` takes the key-id form of the specification;
//   (b) `alerts.reason`, the third member of the fault key (kind, reason, device);
//   (c) T-43 `core_media_store`, the media store root of the Core for the command-line reset.
//
//   M7S-1  the pre-state is a genuine (5, 'dbc-6') database that HOLDS ROWS (a session, an
//          evidence item with its transcript and two revisions, alerts with and without a cause
//          in params): this code is refused by B-3 naming db:migrate, the code of row 129b is
//          accepted, and the product key id is refused by the old rule (the defect)
//   M7S-2  NEGATIVE CONTROL: with 0014 left out the table exists, the runtime role holds nothing
//          on it and the version stays (5, 'dbc-6')
//   M7S-3  set 7 applies exactly its two files, REWRITES NO STORED ROW (MG-8), ends at
//          (6, 'dbc-7'); a second run applies nothing (MG-10)
//   M7S-4  (a) as dems_app: the two key ids of the specification are stored; what is no key id
//          is refused; every id the old rule took is still valid
//   M7S-5  (b) as dems_app: two causes of one kind on one device are two rows; a row without a
//          cause is valid; a cause that is no code is refused; the cause is never changed (42501)
//   M7S-6  (c) as dems_app: the Core's statement stores and replaces the ONE row; it is a path
//          and nothing else (the refused values); it is never removed
//   M7S-7  B-3 across the step, in both directions
//   M7S-8  the files: 0013 holds no data statement; 0014 is five statements, no blanket form;
//          0011 and 0012 hash to what the development databases hold (MG-4)
//
// Every database here is a throw-away of this test run (TI-17). No value in this file is a
// credential: the "credential-shaped" strings are fixtures the CHECK must refuse.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { READ_MEDIA_STORE_ROOT, RECORD_MEDIA_STORE_ROOT, readMediaStoreRoot, recordMediaStoreRoot } from '../../src/db/commands/media-store-root';
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
import { alert, captureDevice, evidenceItem, insertRbac, insertRow, json, sessionHistory, transcript, transcriptRevision } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0013_key_id_fault_reason_media_root', '0014_key_id_fault_reason_media_root_privileges'] as const;
const TABLE = 'public.core_media_store';
const SET_6 = { schemaVersion: 5, contractRevision: 'dbc-6' } as const;
const SET_7 = { schemaVersion: 6, contractRevision: 'dbc-7' } as const;
/** The files of set 8 and of set 9 (task 4 schema sets A and B), pending on every database of this file. */
const LATER: readonly string[] = INITIAL_MIGRATION_TAGS.slice(15);
const PRODUCT_KEY = 'CORE-KEY-EVSIGN-01';
const V1_KEY = 'DEMO-KEY-EVSIGN-01';
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set7-'));
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
  expect(await readSchemaVersion(pool)).toEqual(SET_6);
}

const outcome = (pending: Promise<{ rowCount: number | null }>): Promise<string> =>
  pending.then(
    (result) => `ok:${result.rowCount}`,
    (error: { code?: string }) => error.code ?? 'error',
  );

/**
 * What the tables that existed before the set hold, as digests of whole row images. The image of
 * an alert is taken WITHOUT the column the set adds, so "before" and "after" are comparable: the
 * column itself is asserted apart (every existing row reads NULL).
 */
const storedBefore = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT (SELECT count(*)::int FROM public.session_history) AS sessions,
            (SELECT count(*)::int FROM public.evidence_items) AS items,
            (SELECT count(*)::int FROM public.transcript_revisions) AS revisions,
            (SELECT count(*)::int FROM public.alerts) AS alerts,
            (SELECT md5(string_agg(to_jsonb(e)::text, '' ORDER BY e.id)) FROM public.evidence_items AS e) AS item_rows,
            (SELECT md5(string_agg(to_jsonb(t)::text, '' ORDER BY t.evidence_id)) FROM public.transcripts AS t) AS transcript_rows,
            (SELECT md5(string_agg(to_jsonb(r)::text, '' ORDER BY r.revision_no)) FROM public.transcript_revisions AS r) AS revision_rows,
            (SELECT md5(string_agg((to_jsonb(a) - 'reason')::text, '' ORDER BY a.id)) FROM public.alerts AS a) AS alert_rows,
            (SELECT md5(string_agg(to_jsonb(d)::text, '' ORDER BY d.id)) FROM public.capture_devices AS d) AS device_rows,
            (SELECT md5(string_agg(to_jsonb(s)::text, '' ORDER BY s.id)) FROM public.session_history AS s) AS session_rows`,
  )).rows;
const objects = "SELECT count(*)::int AS objects FROM pg_class WHERE relnamespace = 'public'::regnamespace";
const revision = (no: number, keyId: string): Record<string, unknown> => transcriptRevision(no, { signature_key_id: keyId });

describe('M7S-1: the pre-state, a (5, dbc-6) database that holds rows', () => {
  it('thirteen files applied, set 7 pending, no table and no column; this code is refused by B-3 and the code of row 129b passes', async () => {
    const owner = db.ownerPool();
    await migrateShort(owner, 13);
    const ledger = await inspectLedger(owner);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner, folderOf(15))).pending).toEqual([...TAGS]);
    expect((await owner.query(`SELECT to_regclass('${TABLE}') IS NOT NULL AS present`)).rows).toEqual([{ present: false }]);
    expect((await owner.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'alerts' AND column_name = 'reason'")).rows).toEqual([{ n: 0 }]);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    // The pair this code expects is read from its constants: it moves with every later set.
    expect((error as BootCheckError).message).toBe(
      `B-3: the database is at schema version 5 (dbc-6); this server expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
    await expect(checkSchemaVersion(db.appPool(), SET_6)).resolves.toBeUndefined();
  });

  it('rows of the kind a development database holds: a session, its item, the transcript, two revisions, five alerts, the devices', async () => {
    const owner = db.ownerPool();
    await insertRbac(owner);
    for (const [id, kind] of [['CAM-01', 'CAMERA'], ['CAM-02', 'CAMERA'], ['MIC-01', 'MIC'], ['MIC-02', 'MIC']] as const) await insertRow(owner, 'capture_devices', captureDevice(id, kind));
    await insertRow(owner, 'session_history', sessionHistory());
    await insertRow(owner, 'evidence_items', evidenceItem());
    await insertRow(owner, 'transcripts', transcript());
    // The ids the CODE form took: what every stored revision of today looks like.
    await insertRow(owner, 'transcript_revisions', revision(1, 'KEY_01'));
    await insertRow(owner, 'transcript_revisions', revision(2, 'COREKEYEVSIGN01'));
    // Alerts as passes D6 / D9 / D10 wrote them: the cause, where there is one, in params only.
    await insertRow(owner, 'alerts', alert('ALR-000001'));
    await insertRow(owner, 'alerts', alert('ALR-000002', { kind: 'SYSTEM', severity: 'INFO' }));
    await insertRow(owner, 'alerts', alert('ALR-000003', { kind: 'CAPTURE_FAULT', severity: 'CRITICAL', params: json({ kind: 'CAPTURE_FAULT', target: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 }) }));
    await insertRow(owner, 'alerts', alert('ALR-000004', { kind: 'SYSTEM', severity: 'INFO', target: 'MIC-01', params: json({ reason: 'MIC_RATE_AT_LIMIT' }) }));
    await insertRow(owner, 'alerts', alert('ALR-000005', { kind: 'CAPTURE_FAULT', severity: 'CRITICAL', target: 'CAM-02', active: false, resolved_at: 1_791_000_000_000 }));
    expect(await storedBefore(owner)).toMatchObject([{ sessions: 1, items: 1, revisions: 2, alerts: 5 }]);
  });

  it('THE DEFECT: the product key id, and the v1 id, are refused by the rule of 0004 (23514)', async () => {
    const owner = db.ownerPool();
    await expectRefused(() => insertRow(owner, 'transcript_revisions', revision(3, PRODUCT_KEY)), SQLSTATE.checkViolation, 'transcript_revisions_key_id_check');
    await expectRefused(() => insertRow(owner, 'transcript_revisions', revision(3, V1_KEY)), SQLSTATE.checkViolation, 'transcript_revisions_key_id_check');
  });
});

describe('M7S-2: NEGATIVE CONTROL - without 0014 the runtime role holds nothing on the table', () => {
  it('0013 alone: the table and the column exist, SELECT and the Core\'s statement answer 42501, the version stays (5, dbc-6)', async () => {
    const other = await db.another({ template: EMPTY_DATABASE, slug: 'set7_no0014' });
    await migrateShort(other.ownerPool(), 14);
    expect((await other.ownerPool().query(`SELECT to_regclass('${TABLE}') IS NOT NULL AS present`)).rows).toEqual([{ present: true }]);
    await expectRefused(() => other.appPool().query(READ_MEDIA_STORE_ROOT), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => other.appPool().query(RECORD_MEDIA_STORE_ROOT, ['/srv/dems/media', 1_000]), SQLSTATE.insufficientPrivilege);
    await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
    await expect(checkSchemaVersion(other.appPool(), SET_6)).resolves.toBeUndefined();
  });
});

describe('M7S-3: set 7 applies its two files and rewrites no stored row', () => {
  it('db:migrate applies exactly 0013 and 0014 and steps the version to (6, dbc-7); the ledger holds fifteen files (the set stops at 0014); every stored row is what it was', async () => {
    const owner = db.ownerPool();
    const rowsBefore = await storedBefore(owner);
    const objectsBefore = (await owner.query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    // The set stops at 0014: the applier commits the two files, then reports that the version is
    // not this code's (a later set's) - the device of set6.db.test.ts, since set 8 exists.
    const folder = folderOf(15);
    expect(await readSchemaVersion(owner)).toEqual(SET_6);
    expect((await inspectLedger(owner, folder)).pending).toEqual([...TAGS]);
    const error = await applyMigrations(owner, folder).catch((thrown: unknown) => thrown);
    expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
    expect(await readSchemaVersion(owner)).toEqual(SET_7);
    expect({ schemaVersion: DB_SCHEMA_VERSION, contractRevision: DB_CONTRACT_REVISION }).not.toEqual(SET_7);
    const ledger = await inspectLedger(owner, folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner)).toHaveLength(15);
    // Exactly two new objects: the table and the index of its primary key.
    expect((await owner.query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore + 2);
    // MG-8: nothing was rewritten and nothing was backfilled.
    expect(await storedBefore(owner)).toEqual(rowsBefore);
    expect((await owner.query('SELECT count(*)::int AS rows, count(reason)::int AS with_reason FROM public.alerts')).rows).toEqual([{ rows: 5, with_reason: 0 }]);
    expect((await owner.query("SELECT params->>'reason' AS in_params FROM public.alerts WHERE id = 'ALR-000003'")).rows).toEqual([{ in_params: 'NO_CAMERA_CONNECTED' }]);
    expect((await owner.query('SELECT revision_no, signature_key_id FROM public.transcript_revisions ORDER BY 1')).rows).toEqual([
      { revision_no: 1, signature_key_id: 'KEY_01' },
      { revision_no: 2, signature_key_id: 'COREKEYEVSIGN01' },
    ]);
    expect((await owner.query(`SELECT count(*)::int AS rows FROM ${TABLE}`)).rows).toEqual([{ rows: 0 }]);
    // The re-added CHECK was validated against the stored revisions (no NOT VALID constraint is left).
    expect((await owner.query("SELECT conname::text AS name, convalidated FROM pg_constraint WHERE conname IN ('transcript_revisions_key_id_check', 'alerts_reason_check', 'core_media_store_root_check') ORDER BY 1")).rows).toEqual([
      { name: 'alerts_reason_check', convalidated: true },
      { name: 'core_media_store_root_check', convalidated: true },
      { name: 'transcript_revisions_key_id_check', convalidated: true },
    ]);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const owner = db.ownerPool();
    const before = await readAppliedMigrations(owner);
    const objectsBefore = await owner.query(objects);
    await applyMigrations(owner, folderOf(15)).catch(() => undefined);
    expect(await readSchemaVersion(owner)).toEqual(SET_7);
    expect(await readAppliedMigrations(owner)).toEqual(before);
    expect((await owner.query(objects)).rows).toEqual(objectsBefore.rows);
  });
});

describe('M7S-4 (a): the key-id form on transcript_revisions', () => {
  it('as dems_app: a revision signed with CORE-KEY-EVSIGN-01 and one with DEMO-KEY-EVSIGN-01 are stored; the ids of the old form stay valid', async () => {
    const app = db.appPool();
    await insertRow(app, 'transcript_revisions', revision(3, PRODUCT_KEY));
    await insertRow(app, 'transcript_revisions', revision(4, V1_KEY));
    expect((await app.query('SELECT revision_no, signature_key_id FROM public.transcript_revisions ORDER BY 1')).rows).toEqual([
      { revision_no: 1, signature_key_id: 'KEY_01' },
      { revision_no: 2, signature_key_id: 'COREKEYEVSIGN01' },
      { revision_no: 3, signature_key_id: PRODUCT_KEY },
      { revision_no: 4, signature_key_id: V1_KEY },
    ]);
    // The same ID is what the item row of a package sealed by the product key holds (no rule there, as before).
    expect((await db.ownerPool().query("SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid = 'public.evidence_items'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%signature_key_id%'")).rows).toEqual([{ n: 0 }]);
  });

  it.each([
    ['lower case', 'core-key-evsign-01'],
    ['a space', 'CORE KEY'],
    ['a leading hyphen', '-CORE-KEY'],
    ['a leading underscore', '_CORE_KEY'],
    ['a dot', 'CORE.KEY'],
    ['a slash', 'CORE/KEY'],
    ['65 characters', 'K'.repeat(65)],
    ['the empty string', ''],
    ['a trailing line break', 'CORE-KEY-EVSIGN-01\n'],
  ])('what is no key id is refused (23514): %s', async (_what, keyId) => {
    await expectRefused(() => insertRow(db.appPool(), 'transcript_revisions', revision(9, keyId)), SQLSTATE.checkViolation, 'transcript_revisions_key_id_check');
  });

  it('the longest id (64 characters) and a one-character id are taken: the bounds of the rule', async () => {
    const owner = db.ownerPool();
    await insertRow(owner, 'transcript_revisions', revision(5, `K${'-'.repeat(62)}9`));
    await insertRow(owner, 'transcript_revisions', revision(6, '7'));
    await owner.query('DELETE FROM public.transcript_revisions WHERE revision_no IN (5, 6)');
  });
});

describe('M7S-5 (b): alerts.reason, the third member of the fault key', () => {
  const capture = (id: string, target: string, reason: string | null): Record<string, unknown> =>
    alert(id, { kind: 'CAPTURE_FAULT', severity: 'CRITICAL', target, reason, params: json(reason === null ? { kind: 'CAPTURE_FAULT', target } : { kind: 'CAPTURE_FAULT', target, reason }) });

  it('as dems_app: two causes of CAPTURE_FAULT on one camera are two rows; a row without a cause is valid beside them', async () => {
    const app = db.appPool();
    await insertRow(app, 'alerts', capture('ALR-000011', 'CAM-01', 'CAMERA_STREAM_ENDED'));
    await insertRow(app, 'alerts', capture('ALR-000012', 'CAM-01', 'CAMERA_CLOCK_OUT_OF_BOUND'));
    await insertRow(app, 'alerts', capture('ALR-000013', 'CAM-01', null));
    await insertRow(app, 'alerts', alert('ALR-000014', { kind: 'SYSTEM', severity: 'INFO', target: 'MIC-01', reason: 'MIC_RATE_AT_LIMIT', params: json({ reason: 'MIC_RATE_AT_LIMIT' }) }));
    expect((await app.query("SELECT id, kind, reason, target FROM public.alerts WHERE active AND target = 'CAM-01' ORDER BY id")).rows).toEqual([
      { id: 'ALR-000011', kind: 'CAPTURE_FAULT', reason: 'CAMERA_STREAM_ENDED', target: 'CAM-01' },
      { id: 'ALR-000012', kind: 'CAPTURE_FAULT', reason: 'CAMERA_CLOCK_OUT_OF_BOUND', target: 'CAM-01' },
      { id: 'ALR-000013', kind: 'CAPTURE_FAULT', reason: null, target: 'CAM-01' },
    ]);
    // The key as a query: one active alert per (kind, reason, device).
    expect((await app.query("SELECT kind, coalesce(reason, '') AS reason, coalesce(target, '') AS device, count(*)::int AS n FROM public.alerts WHERE active AND kind = 'CAPTURE_FAULT' AND target = 'CAM-01' GROUP BY 1, 2, 3 HAVING count(*) > 1")).rows).toEqual([]);
  });

  it.each([
    ['free text', 'the stream ended'],
    ['lower case', 'camera_stream_ended'],
    ['a hyphen', 'CAMERA-STREAM-ENDED'],
    ['a leading digit', '1_CAMERA'],
    ['65 characters', 'R'.repeat(65)],
    ['the empty string', ''],
  ])('a cause that is no code is refused (23514): %s', async (_what, reason) => {
    await expectRefused(() => insertRow(db.appPool(), 'alerts', alert('ALR-000019', { reason })), SQLSTATE.checkViolation, 'alerts_reason_check');
  });

  it('the cause of a stored alert is never changed: UPDATE of the column answers 42501; the three life-cycle columns stay writable (control)', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query("UPDATE public.alerts SET reason = 'CAMERA_NOT_CONNECTED' WHERE id = 'ALR-000011'"), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query("UPDATE public.alerts SET reason = NULL WHERE id = 'ALR-000011'"), SQLSTATE.insufficientPrivilege);
    expect(await outcome(app.query("UPDATE public.alerts SET active = false, acknowledged = true, resolved_at = 1791000000000 WHERE id = 'ALR-000011'"))).toBe('ok:1');
    expect((await db.ownerPool().query("SELECT reason, active FROM public.alerts WHERE id = 'ALR-000011'")).rows).toEqual([{ reason: 'CAMERA_STREAM_ENDED', active: false }]);
    expect(
      (await db.ownerPool().query("SELECT attname::text AS name FROM pg_attribute WHERE attrelid = 'public.alerts'::regclass AND attnum > 0 AND NOT attisdropped AND has_column_privilege('dems_app', attrelid, attnum, 'UPDATE') ORDER BY 1")).rows.map(
        (row: { name: string }) => row.name,
      ),
    ).toEqual(['acknowledged', 'active', 'resolved_at']);
  });

  it('NO UNIQUE RULE IN THE DATABASE (stated, measured): the key is held by the engine, which raises a fault once; the table keeps every alert, resolved ones of the same key included', async () => {
    const owner = db.ownerPool();
    expect((await owner.query("SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'alerts' AND indexdef LIKE 'CREATE UNIQUE%' AND indexname <> 'alerts_pkey'")).rows).toEqual([{ n: 0 }]);
  });
});

describe('M7S-6 (c): core_media_store, the media store root of the Core', () => {
  it('as dems_app: the Core\'s statement stores the root, a second start replaces it, and there is one row', async () => {
    const app = db.appPool();
    expect(await readMediaStoreRoot(app)).toBeNull();
    expect(await recordMediaStoreRoot(app, '/srv/dems/media/sessions', 1_000)).toEqual({ root: '/srv/dems/media/sessions', recordedAt: 1_000 });
    expect(await readMediaStoreRoot(app)).toEqual({ root: '/srv/dems/media/sessions', recordedAt: 1_000 });
    // A later start with the SAME root writes nothing: the row is what it was (a restart moves no stored row).
    expect(await outcome(app.query(RECORD_MEDIA_STORE_ROOT, ['/srv/dems/media/sessions', 1_500]))).toBe('ok:0');
    expect(await recordMediaStoreRoot(app, '/srv/dems/media/sessions/', 1_500)).toEqual({ root: '/srv/dems/media/sessions', recordedAt: 1_000 });
    // A later start with another configuration, written unnormalised: the row holds the normalised path.
    expect(await recordMediaStoreRoot(app, '/Volumes/Evidence//dems/./media/', 2_000)).toEqual({ root: '/Volumes/Evidence/dems/media', recordedAt: 2_000 });
    expect((await db.ownerPool().query(`SELECT singleton, media_root, recorded_at::text AS recorded_at FROM ${TABLE}`)).rows).toEqual([{ singleton: true, media_root: '/Volumes/Evidence/dems/media', recorded_at: '2000' }]);
    // The owner reads it as well: that is the command-line reset's read.
    expect(await readMediaStoreRoot(db.ownerPool())).toEqual({ root: '/Volumes/Evidence/dems/media', recordedAt: 2_000 });
  });

  it.each([
    ['a relative path', 'media/sessions'],
    ['the empty string', ''],
    // Built from parts: no source line of this repository holds an address with a user part (T-CR-2).
    ['a URL with user information', ['postgres:', '//someone', ':placeholder', '@127.0.0.1:4432/somewhere'].join('')],
    ['a URL behind a slash', ['/srv/smb:', '//someone', ':placeholder', '@host/share'].join('')],
    ['a line break', '/srv/dems\nmedia'],
    ['a tab', '/srv/dems\tmedia'],
    ['1,025 characters', `/${'m'.repeat(1_024)}`],
  ])('a value that is no bounded absolute path is refused by the CHECK (23514): %s', async (_what, value) => {
    // Sent as the statement sends it, without the writer's own normalisation: the database's rule alone.
    await expectRefused(() => db.appPool().query(RECORD_MEDIA_STORE_ROOT, [value, 3_000]), SQLSTATE.checkViolation, 'core_media_store_root_check');
    expect((await db.ownerPool().query(`SELECT media_root FROM ${TABLE}`)).rows).toEqual([{ media_root: '/Volumes/Evidence/dems/media' }]);
  });

  it('the writer refuses what it would have to guess: an empty root, a control character; the longest path (1,024) is stored', async () => {
    const app = db.appPool();
    await expect(recordMediaStoreRoot(app, '', 4_000)).rejects.toMatchObject({ code: 'MEDIA_STORE_ROOT_NOT_STORABLE' });
    await expect(recordMediaStoreRoot(app, '/srv/dems\nmedia', 4_000)).rejects.toMatchObject({ code: 'MEDIA_STORE_ROOT_NOT_STORABLE' });
    await expect(recordMediaStoreRoot(app, `/${'m'.repeat(1_024)}`, 4_000)).rejects.toMatchObject({ code: 'MEDIA_STORE_ROOT_NOT_STORABLE' });
    const longest = `/${'m'.repeat(1_023)}`;
    expect((await recordMediaStoreRoot(app, longest, 4_000)).root).toBe(longest);
    await recordMediaStoreRoot(app, '/Volumes/Evidence/dems/media', 5_000);
  });

  it('one row, never removed: a second row, DELETE, TRUNCATE and a change of the key are refused', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query(`INSERT INTO ${TABLE} (singleton, media_root, recorded_at) VALUES (false, '/srv/other', 1)`), SQLSTATE.checkViolation, 'core_media_store_singleton_check');
    await expectRefused(() => app.query(`INSERT INTO ${TABLE} (singleton, media_root, recorded_at) VALUES (true, '/srv/other', 1)`), SQLSTATE.uniqueViolation);
    await expectRefused(() => app.query(`DELETE FROM ${TABLE}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`TRUNCATE ${TABLE}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`UPDATE ${TABLE} SET singleton = true`), SQLSTATE.insufficientPrivilege);
    expect((await db.ownerPool().query(`SELECT count(*)::int AS rows FROM ${TABLE}`)).rows).toEqual([{ rows: 1 }]);
  });

  it('the table has three columns - a key, a path, an instant - and no other place for a value', async () => {
    const { rows } = await db.ownerPool().query<{ name: string; type: string }>(
      "SELECT column_name::text AS name, data_type::text AS type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'core_media_store' ORDER BY ordinal_position",
    );
    expect(rows).toEqual([
      { name: 'singleton', type: 'boolean' },
      { name: 'media_root', type: 'text' },
      { name: 'recorded_at', type: 'bigint' },
    ]);
    const table = await db.ownerPool().query<{ owner: string; triggers: number }>(
      "SELECT pg_get_userbyid(c.relowner)::text AS owner, (SELECT count(*)::int FROM pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal) AS triggers FROM pg_class c WHERE c.oid = 'public.core_media_store'::regclass",
    );
    expect(table.rows).toEqual([{ owner: 'dems_owner', triggers: 0 }]);
  });
});

describe('M7S-7: B-3 across the step, in both directions', () => {
  it('the code of row 129b (5, dbc-6) on the migrated database is refused; the code of set 7 passes; this code (set 8) asks for db:migrate', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_6).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 6 (dbc-7); this server expects 5 (dbc-6)');
    await expect(checkSchemaVersion(db.appPool(), SET_7)).resolves.toBeUndefined();
    await expect(checkSchemaVersion(db.appPool())).rejects.toBeInstanceOf(BootCheckError);
  });
});

describe('M7S-8: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');

  it('0013 is generated: one CREATE TABLE, one ADD COLUMN, the swap of one CHECK and one new CHECK - and no statement that writes a row (MG-2, MG-8)', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toHaveLength(5);
    expect(generated[0]).toMatch(/^CREATE TABLE "core_media_store" \(/);
    expect(generated.slice(1)).toEqual([
      'ALTER TABLE "transcript_revisions" DROP CONSTRAINT "transcript_revisions_key_id_check";',
      'ALTER TABLE "alerts" ADD COLUMN "reason" text;',
      'ALTER TABLE "alerts" ADD CONSTRAINT "alerts_reason_check" CHECK ("alerts"."reason" IS NULL OR "alerts"."reason" ~ \'^[A-Z][A-Z0-9_]{0,63}$\');',
      'ALTER TABLE "transcript_revisions" ADD CONSTRAINT "transcript_revisions_key_id_check" CHECK ("transcript_revisions"."signature_key_id" ~ \'^[A-Z0-9][A-Z0-9_-]{0,63}$\');',
    ]);
    const text = generated.join(' ');
    expect(text).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/);
    expect(text).not.toMatch(/\bDEFAULT\b(?! true)/);
    expect(text).not.toMatch(/jsonb|bytea|NOT VALID/i);
    // No hand statement inside the generated file: every line is the generator's.
    expect(readFileSync(join(MIGRATIONS_FOLDER, `${TAGS[0]}.sql`), 'utf8')).not.toMatch(/^--(?!> statement-breakpoint)/m);
  });

  it('0014 is hand-written: two grants, two boundary revokes and the version row; no blanket form, no role but dems_app', () => {
    const written = statementsOf(TAGS[1]);
    expect(written).toEqual([
      'GRANT SELECT, INSERT ON core_media_store TO dems_app;',
      'GRANT UPDATE (media_root, recorded_at) ON core_media_store TO dems_app;',
      'REVOKE DELETE, TRUNCATE ON core_media_store FROM dems_app;',
      'REVOKE UPDATE (reason) ON alerts FROM dems_app;',
      "UPDATE public.schema_meta SET schema_version = 6, contract_revision = 'dbc-7' WHERE singleton;",
    ]);
    expect(written.join(' ')).not.toMatch(/ALL\s+TABLES/i);
    expect(written.join(' ')).not.toMatch(/dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER/i);
  });

  it('0011 and 0012 hash to what the ledgers of the four development databases store: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0011_session_stt_config']).toBe('bdacdd369886521ea90eafe290270d3fdb054cb46a2f6a9ab9bc7a63e7d51642');
    expect(hashes['0012_session_stt_config_privileges']).toBe('55cf8703eb6323fafe91a4ae50234f37540b88f9a608b9f1d404d9e7528ae520');
  });
});
