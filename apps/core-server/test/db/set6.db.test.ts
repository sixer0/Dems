// Migration set 6 (`0011_session_stt_config.sql` + `0012_session_stt_config_privileges.sql`;
// database contract section N erratum PE-129b-01; requirement R-8 AC-4, check `M6-STTCFG-NEXT`;
// controller-added row 129b, decision D109): T-42 `session_stt_config`, the STT configuration of
// a session as it was at its start.
//
//   M6S-1  the pre-state is a genuine (4, 'dbc-5') database that holds rows: no table, this code
//          refused by B-3 naming db:migrate, the code of row 129a accepted
//   M6S-2  NEGATIVE CONTROL: with 0012 left out the table exists, the runtime role holds nothing
//          on it and the version stays (4, 'dbc-5')
//   M6S-3  set 6 applies exactly its two files, changes no stored row, ends at (5, 'dbc-6');
//          a second run applies nothing (MG-10)
//   M6S-4  WRITE-ONCE, by the database, as dems_app: the first snapshot of a session is stored;
//          a second one is not; nothing changes or removes one (42501)
//   M6S-5  NO SECRET HAS A PLACE: the column list, the refused column names, and the three hidden
//          columns of `stt_config` cannot be copied in
//   M6S-6  the grants in the catalog; a planted UPDATE grant is caught (control of M6S-4)
//   M6S-7  B-3 across the step, in both directions
//   M6S-8  the files; 0008 to 0010 are the files the four development databases hold
//
// SINCE MIGRATION SET 7 (erratum PE-0013-01) the set of this file stops at 0012: its database is a
// genuine (5, 'dbc-6') one, and the applier - which ends by comparing the version with this code's
// constants - reports SCHEMA_VERSION_MISMATCH after it committed the two files (the device of
// `set5.db.test.ts`). Set 7 on such a database is `set7.db.test.ts`.
//
// Every database here is a throw-away of this test run (TI-17). No value in this file is a
// credential.
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
import { captureDevice, captureSource, insertRbac, insertRow, sessionHistory, sttConfig } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAGS = ['0011_session_stt_config', '0012_session_stt_config_privileges'] as const;
const TABLE = 'public.session_stt_config';
const COLUMNS = ['session_id', 'enabled', 'backend', 'endpoint', 'model', 'language', 'diarization', 'credential_kind', 'config_revision', 'taken_at'] as const;
const SET_5 = { schemaVersion: 4, contractRevision: 'dbc-5' } as const;
const SET_6 = { schemaVersion: 5, contractRevision: 'dbc-6' } as const;
/** The two files of set 7, pending on every database of this file. */
const LATER = ['0013_key_id_fault_reason_media_root', '0014_key_id_fault_reason_media_root_privileges'] as const;
const SESSION_A = 'SES-20261009-0001';
const SESSION_B = 'SES-20261009-0002';
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set6-'));
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
  expect(await readSchemaVersion(pool)).toEqual(SET_5);
}

const outcome = (pending: Promise<{ rowCount: number | null }>): Promise<string> =>
  pending.then(
    (result) => `ok:${result.rowCount}`,
    (error: { code?: string }) => error.code ?? 'error',
  );

// THE TWO STATEMENTS OF THE SNAPSHOT STORE (the port `SttSnapshotStore` of row 115): `put` is the
// INSERT that does nothing when the session has a snapshot, followed by the SELECT; `get` is the
// SELECT alone.
const PUT = `INSERT INTO ${TABLE} (${COLUMNS.join(', ')}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (session_id) DO NOTHING`;
const GET = `SELECT ${COLUMNS.join(', ')} FROM ${TABLE} WHERE session_id = $1`;
const PLAIN_INSERT = `INSERT INTO ${TABLE} (${COLUMNS.join(', ')}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;

const first = [SESSION_A, true, 'omlx-server', 'http://127.0.0.1:8000/v1', 'model-at-start', 'id', true, 'REFERENCE', 3, 1_000];
const later = [SESSION_A, false, 'cpu-local', null, 'model-saved-later', 'id', false, null, 4, 2_000];
const firstRow = {
  session_id: SESSION_A, enabled: true, backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000/v1', model: 'model-at-start', language: 'id',
  diarization: true, credential_kind: 'REFERENCE', config_revision: '3', taken_at: '1000',
};

/** What the tables that existed before the set hold: a count per table and the STT row itself. */
const storedBefore = async (owner: Pool): Promise<unknown> =>
  (await owner.query(
    `SELECT (SELECT count(*)::int FROM public.session_history) AS sessions,
            (SELECT count(*)::int FROM public.capture_devices) AS devices,
            (SELECT count(*)::int FROM public.session_capture_sources) AS sources,
            (SELECT md5(string_agg(to_jsonb(s)::text, '')) FROM public.stt_config AS s) AS stt,
            (SELECT md5(string_agg(to_jsonb(c)::text, '' ORDER BY c.slot)) FROM public.session_capture_sources AS c) AS source_rows`,
  )).rows;
const objects = "SELECT count(*)::int AS objects FROM pg_class WHERE relnamespace = 'public'::regnamespace";

describe('M6S-1: the pre-state, a (4, dbc-5) database that holds rows', () => {
  it('eleven files applied, set 6 pending, no table; this code is refused by B-3 and the code of row 129a passes', async () => {
    const owner = db.ownerPool();
    await migrateShort(owner, 11);
    const ledger = await inspectLedger(owner);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([...TAGS, ...LATER]);
    expect((await inspectLedger(owner, folderOf(13))).pending).toEqual([...TAGS]);
    expect((await owner.query(`SELECT to_regclass('${TABLE}') IS NOT NULL AS present`)).rows).toEqual([{ present: false }]);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toBe(
      'B-3: the database is at schema version 4 (dbc-5); this server expects 6 (dbc-7). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>',
    );
    await expect(checkSchemaVersion(db.appPool(), SET_5)).resolves.toBeUndefined();
  });

  it('rows of the kind a development database holds: the STT configuration, a session, its four source rows', async () => {
    const owner = db.ownerPool();
    await insertRbac(owner);
    for (const [id, kind] of [['CAM-01', 'CAMERA'], ['CAM-02', 'CAMERA'], ['MIC-01', 'MIC'], ['MIC-02', 'MIC']] as const) await insertRow(owner, 'capture_devices', captureDevice(id, kind));
    await insertRow(owner, 'stt_config', sttConfig({ credential_kind: 'REFERENCE', credential_ref: 'fixture-settings:reference.name' }));
    await insertRow(owner, 'session_history', sessionHistory());
    for (const slot of ['VIDEO-01', 'VIDEO-02', 'MIC-PRIMARY', 'MIC-STANDBY']) await insertRow(owner, 'session_capture_sources', captureSource(slot));
    expect(await storedBefore(owner)).toMatchObject([{ sessions: 1, devices: 4, sources: 4 }]);
  });
});

describe('M6S-2: NEGATIVE CONTROL - without 0012 the runtime role holds nothing on the table', () => {
  it('0011 alone: the table exists, SELECT and INSERT answer 42501, the version stays (4, dbc-5)', async () => {
    const other = await db.another({ template: EMPTY_DATABASE, slug: 'set6_no0012' });
    await migrateShort(other.ownerPool(), 12);
    expect((await other.ownerPool().query(`SELECT to_regclass('${TABLE}') IS NOT NULL AS present`)).rows).toEqual([{ present: true }]);
    await expectRefused(() => other.appPool().query(GET, [SESSION_A]), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => other.appPool().query(PUT, first), SQLSTATE.insufficientPrivilege);
    await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
  });
});

describe('M6S-3: set 6 applies its two files and changes no stored row', () => {
  it('db:migrate applies exactly 0011 and 0012 and steps the version to (5, dbc-6); the ledger holds thirteen files (the set stops at 0012)', async () => {
    const owner = db.ownerPool();
    const rowsBefore = await storedBefore(owner);
    const objectsBefore = (await owner.query<{ objects: number }>(objects)).rows[0]?.objects ?? 0;
    // The set stops at 0012: the applier commits the two files, then reports that the version is
    // not this code's (6, 'dbc-7').
    const folder = folderOf(13);
    expect(await readSchemaVersion(owner)).toEqual(SET_5);
    expect((await inspectLedger(owner, folder)).pending).toEqual([...TAGS]);
    const error = await applyMigrations(owner, folder).catch((thrown: unknown) => thrown);
    expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
    expect(await readSchemaVersion(owner)).toEqual(SET_6);
    expect({ schemaVersion: DB_SCHEMA_VERSION, contractRevision: DB_CONTRACT_REVISION }).not.toEqual(SET_6);
    const ledger = await inspectLedger(owner, folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner)).toHaveLength(13);
    // Exactly two new objects: the table and the index of its primary key.
    expect((await owner.query<{ objects: number }>(objects)).rows[0]?.objects).toBe(objectsBefore + 2);
    expect(await storedBefore(owner)).toEqual(rowsBefore);
    expect((await owner.query(`SELECT count(*)::int AS rows FROM ${TABLE}`)).rows).toEqual([{ rows: 0 }]);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const owner = db.ownerPool();
    const before = await readAppliedMigrations(owner);
    const objectsBefore = await owner.query(objects);
    await applyMigrations(owner, folderOf(13)).catch(() => undefined);
    expect(await readSchemaVersion(owner)).toEqual(SET_6);
    expect(await readAppliedMigrations(owner)).toEqual(before);
    expect((await owner.query(objects)).rows).toEqual(objectsBefore.rows);
  });
});

describe('M6S-4: one snapshot per session, written once - held by the database', () => {
  it('as dems_app: the first put stores the snapshot and get reads it back, value for value', async () => {
    const app = db.appPool();
    expect((await app.query(GET, [SESSION_A])).rows).toEqual([]);
    expect(await outcome(app.query(PUT, first))).toBe('ok:1');
    expect((await app.query(GET, [SESSION_A])).rows).toEqual([firstRow]);
  });

  it('a second put for the session stores nothing: the session keeps the configuration of its start', async () => {
    const app = db.appPool();
    // The configuration was saved again while the session is open (operation 91): a restarted
    // Core that takes the snapshot again gets the FIRST one back.
    expect(await outcome(app.query(PUT, later))).toBe('ok:0');
    expect((await app.query(GET, [SESSION_A])).rows).toEqual([firstRow]);
    expect(await outcome(app.query(PLAIN_INSERT, later))).toBe(SQLSTATE.uniqueViolation);
    expect((await db.ownerPool().query(`SELECT count(*)::int AS rows FROM ${TABLE}`)).rows).toEqual([{ rows: 1 }]);
  });

  it('nothing changes or removes a snapshot: UPDATE, the upsert that updates, DELETE and TRUNCATE answer 42501', async () => {
    const app = db.appPool();
    const refused = [
      `UPDATE ${TABLE} SET model = 'model-saved-later' WHERE session_id = '${SESSION_A}'`,
      `UPDATE ${TABLE} SET enabled = false`,
      `UPDATE ${TABLE} SET endpoint = endpoint WHERE false`,
      `INSERT INTO ${TABLE} (${COLUMNS.join(', ')}) VALUES ('${SESSION_A}', false, 'cpu-local', NULL, 'm', 'id', false, NULL, 4, 2) ON CONFLICT (session_id) DO UPDATE SET model = 'm'`,
      `DELETE FROM ${TABLE} WHERE session_id = '${SESSION_A}'`,
      `DELETE FROM ${TABLE}`,
      `TRUNCATE ${TABLE}`,
    ];
    for (const text of refused) await expectRefused(() => app.query(text), SQLSTATE.insufficientPrivilege);
    expect((await app.query(GET, [SESSION_A])).rows).toEqual([firstRow]);
  });

  it('another session has its own snapshot; the CHECKs of stt_config bind the snapshot too', async () => {
    const app = db.appPool();
    expect(await outcome(app.query(PUT, [SESSION_B, ...later.slice(1)]))).toBe('ok:1');
    expect((await app.query(`SELECT session_id, model FROM ${TABLE} ORDER BY session_id`)).rows).toEqual([
      { session_id: SESSION_A, model: 'model-at-start' },
      { session_id: SESSION_B, model: 'model-saved-later' },
    ]);
    const lan = ['SES-20261009-0003', true, 'omlx-server', 'http://192.0.2.10:8000', 'm', 'id', true, null, 1, 1];
    await expectRefused(() => app.query(PUT, lan), SQLSTATE.checkViolation, 'session_stt_config_endpoint_loopback_check');
    await expectRefused(() => app.query(PUT, ['not-a-session', ...lan.slice(1, 3), 'http://127.0.0.1', ...lan.slice(4)]), SQLSTATE.checkViolation, 'session_stt_config_session_check');
  });
});

describe('M6S-5: no secret has a place in a snapshot', () => {
  it('the table is exactly ten typed columns: no JSON, no bytea, no reference and no ciphertext column', async () => {
    const { rows } = await db.ownerPool().query<{ c: string; t: string }>(
      `SELECT column_name::text AS c, data_type::text AS t FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_stt_config' ORDER BY ordinal_position`,
    );
    expect(rows.map((row) => row.c)).toEqual([...COLUMNS]);
    expect([...new Set(rows.map((row) => row.t))].sort()).toEqual(['bigint', 'boolean', 'text']);
    for (const name of rows.map((row) => row.c)) expect(name).not.toMatch(/secret|cipher|nonce|token|password|key|ref/);
  });

  it('a write that names a secret-looking column is refused (42703), whoever sends it', async () => {
    for (const column of ['credential_ref', 'secret_ciphertext', 'nonce', 'api_key', 'password', 'token']) {
      for (const pool of [db.appPool(), db.ownerPool()]) {
        expect(await outcome(pool.query(`INSERT INTO ${TABLE} (${COLUMNS.join(', ')}, ${column}) VALUES ('SES-20261009-0004', true, 'cpu-local', NULL, 'm', 'id', true, NULL, 1, 1, 'x')`))).toBe('42703');
      }
    }
    expect((await db.ownerPool().query(`SELECT count(*)::int AS rows FROM ${TABLE} WHERE session_id = 'SES-20261009-0004'`)).rows).toEqual([{ rows: 0 }]);
  });

  it('the three hidden columns of stt_config cannot be copied into a snapshot by the runtime role; the readable ones can', async () => {
    const app = db.appPool();
    const copy = (session: string, source: string): string =>
      `INSERT INTO ${TABLE} (${COLUMNS.join(', ')}) SELECT '${session}', enabled, backend, endpoint, ${source}, language, diarization, credential_kind, revision, 1 FROM public.stt_config`;
    for (const hidden of ['credential_ref', "encode(secret_ciphertext, 'hex')", "encode(nonce, 'hex')"]) {
      await expectRefused(() => app.query(copy('SES-20261009-0005', hidden)), SQLSTATE.insufficientPrivilege);
    }
    // Positive control: the same statement with a readable column stores the snapshot of the row.
    expect(await outcome(app.query(copy('SES-20261009-0005', 'model')))).toBe('ok:1');
    expect((await app.query(`SELECT model, credential_kind, config_revision::int AS config_revision FROM ${TABLE} WHERE session_id = 'SES-20261009-0005'`)).rows).toEqual([
      { model: 'vosk-id-small', credential_kind: 'REFERENCE', config_revision: 1 },
    ]);
    // The reference name of the stored configuration is in no snapshot.
    const dump = await db.ownerPool().query<{ text: string }>(`SELECT string_agg(to_jsonb(s)::text, '') AS text FROM ${TABLE} AS s`);
    expect(dump.rows[0]?.text).not.toContain('fixture-settings');
  });

  it('no SELECT regression: the credential store and the hidden columns of stt_config still answer 42501', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query('SELECT secret_ciphertext FROM public.capture_device_credentials'), SQLSTATE.insufficientPrivilege);
    for (const column of ['secret_ciphertext', 'nonce', 'credential_ref']) await expectRefused(() => app.query(`SELECT ${column} FROM public.stt_config`), SQLSTATE.insufficientPrivilege);
  });
});

describe('M6S-6: the grants', () => {
  const privileges = `SELECT p AS privilege, has_table_privilege('dems_app', '${TABLE}', p) AS held
                        FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS p ORDER BY 1`;

  it('catalog: dems_app holds SELECT and INSERT on the table and UPDATE on none of its columns; the owner is dems_owner', async () => {
    const owner = db.ownerPool();
    expect((await owner.query<{ privilege: string; held: boolean }>(privileges)).rows.filter((row) => row.held).map((row) => row.privilege)).toEqual(['INSERT', 'SELECT']);
    const columns = await owner.query<{ can: boolean }>(
      `SELECT has_column_privilege('dems_app', a.attrelid, a.attnum, 'UPDATE') AS can FROM pg_attribute a WHERE a.attrelid = '${TABLE}'::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
    );
    expect(columns.rows).toHaveLength(10);
    expect(columns.rows.some((row) => row.can)).toBe(false);
    expect((await owner.query(`SELECT tableowner::text AS owner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'session_stt_config'`)).rows).toEqual([{ owner: 'dems_owner' }]);
    expect((await owner.query(`SELECT count(*)::int AS triggers FROM pg_trigger WHERE tgrelid = '${TABLE}'::regclass AND NOT tgisinternal`)).rows).toEqual([{ triggers: 0 }]);
  });

  it('NEGATIVE CONTROL: after a planted GRANT UPDATE the snapshot of an open session can be replaced - M6S-4 would fail', async () => {
    const other = await db.another({ template: 'schema', slug: 'set6_planted' });
    const app = other.appPool();
    expect(await outcome(app.query(PUT, first))).toBe('ok:1');
    const change = `UPDATE ${TABLE} SET model = 'model-saved-later' WHERE session_id = '${SESSION_A}'`;
    await expectRefused(() => app.query(change), SQLSTATE.insufficientPrivilege);
    await other.ownerPool().query(`GRANT UPDATE ON ${TABLE} TO dems_app`);
    expect(await outcome(app.query(change))).toBe('ok:1');
    expect((await app.query(`SELECT model FROM ${TABLE}`)).rows).toEqual([{ model: 'model-saved-later' }]);
  });
});

describe('M6S-7: B-3 across the step, in both directions', () => {
  it('the code of row 129a (4, dbc-5) on the migrated database is refused; the code of row 129b (5, dbc-6) passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), SET_5).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 5 (dbc-6); this server expects 4 (dbc-5)');
    await expect(checkSchemaVersion(db.appPool(), SET_6)).resolves.toBeUndefined();
    // And the code of set 7 is refused here until 0013 and 0014 are applied (set7.db.test.ts).
    await expect(checkSchemaVersion(db.appPool())).rejects.toBeInstanceOf(BootCheckError);
  });
});

describe('M6S-8: the files', () => {
  const statementsOf = (tag: string): string[] =>
    readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');

  it('0011 is one CREATE TABLE and touches no existing table; 0012 is one GRANT, one boundary REVOKE and the version row', () => {
    const generated = statementsOf(TAGS[0]);
    expect(generated).toHaveLength(1);
    expect(generated[0]).toMatch(/^CREATE TABLE "session_stt_config" \(/);
    expect(generated[0]).not.toMatch(/ALTER|DROP|UPDATE |DELETE |jsonb|bytea/i);
    const written = statementsOf(TAGS[1]);
    expect(written).toEqual([
      'GRANT SELECT, INSERT ON session_stt_config TO dems_app;',
      'REVOKE UPDATE, DELETE, TRUNCATE ON session_stt_config FROM dems_app;',
      "UPDATE public.schema_meta SET schema_version = 5, contract_revision = 'dbc-6' WHERE singleton;",
    ]);
    expect(written.join(' ')).not.toMatch(/ALL\s+TABLES/i);
    expect(written.join(' ')).not.toMatch(/dems_owner|dems_admin|SECURITY\s+DEFINER|TRIGGER/i);
  });

  it('0008, 0009 and 0010 hash to what the ledgers of the four development databases store: they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0008_capture_sources']).toBe('2c1e485da34bbf17b4ed8aa811ab5590e6a808ea3bf2d9b7cdb1fdcdd16fba8e');
    expect(hashes['0009_capture_sources_privileges']).toBe('3100b5ee098fa10a3d31033c48203e4709343caf3346eee2c331c8691e24bf8b');
    expect(hashes['0010_credential_replace_privileges']).toBe('f06d2c292f5c2aba78de59c6470d6ddf559693b3c25e24791f6656e27993d6fb');
  });
});
