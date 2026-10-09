// Migration set 5 (`0010_credential_replace_privileges.sql`; database contract section N erratum
// PE-129a-01; finding F-84-1 of blueprint row 84; controller-added row 129a, decision D99).
//
//   M4A-1  the defect on a genuine (3, 'dbc-4') database: the first INSERT works, every statement
//          that replaces a stored camera credential answers 42501 (the control of M4A-3)
//   M4A-2  set 5 applies exactly one file, changes no object and no row, ends at (4, 'dbc-5');
//          a second run applies nothing (MG-10)
//   M4A-3  as dems_app a stored credential is REPLACED - by UPDATE and by upsert
//   M4A-4  the six other columns stay unreadable, by every statement form that would read them
//   M4A-5  a planted blanket grant is caught (the control of M4A-4)
//   M4A-6  B-3 across the step, in both directions
//   M4A-7  stt_config needed no change: its secret is replaced through `WHERE singleton`
//   M4A-8  0010 is three statements and no blanket form; 0008 and 0009 are the files the four
//          development databases hold in their ledgers
//
// SINCE ROW 129b (set 6, schema version 5) this file stops the set at 0010: the database under
// test is a genuine (4, 'dbc-5') database, built from the first eleven real files, and "this code"
// of M4A-2 / M4A-6 is the pair (4, 'dbc-5'). Set 6 has its own file, `set6.db.test.ts`.
//
// Every database here is a throw-away of this test run (TI-17). No value in this file is a
// credential: the "ciphertext" bytes are constant fill of the fixture.
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
import { useTestDatabase } from '../helpers/db';
import { captureDevice, insertRow, sttConfig } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const TAG = '0010_credential_replace_privileges';
const TABLE = 'public.capture_device_credentials';
const HIDDEN = ['username', 'encryption', 'secret_ciphertext', 'nonce', 'key_ref', 'rotated_at'] as const;
const temporary: string[] = [];
/** The pair set 5 ends at; this code's own pair is one step further since row 129b. */
const SET_5 = { schemaVersion: 4, contractRevision: 'dbc-5' } as const;

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files. */
function folderOf(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set5-'));
  temporary.push(folder);
  mkdirSync(join(folder, 'meta'));
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
  writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }));
  for (const tag of INITIAL_MIGRATION_TAGS.slice(0, count)) cpSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), join(folder, `${tag}.sql`));
  return folder;
}

/** Applies the ten files of schema version 3. The applier reports the version it then finds. */
async function migrateToVersion3(pool: Pool): Promise<void> {
  // `applyMigrations` ends by comparing the version with this code's constants, so on a set that
  // stops at 0009 it throws AFTER the files are committed - which is exactly the state wanted.
  const error = await applyMigrations(pool, folderOf(10)).catch((thrown: unknown) => thrown);
  expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
  expect(await readSchemaVersion(pool)).toEqual({ schemaVersion: 3, contractRevision: 'dbc-4' });
}

const outcome = (pending: Promise<{ rowCount: number | null }>): Promise<string> =>
  pending.then(
    (result) => `ok:${result.rowCount}`,
    (error: { code?: string }) => error.code ?? 'error',
  );

/** One envelope of the fixture: 33 bytes of `fill`, a 12-byte nonce, a key reference, a time. */
const envelope = (device: string, fill: number, keyRef: string, at: number): unknown[] => [device, `user.${fill}`, Buffer.alloc(33, fill), Buffer.alloc(12, fill), keyRef, at];
const INSERT = `INSERT INTO ${TABLE} (device_id, username, secret_ciphertext, nonce, key_ref, rotated_at) VALUES ($1, $2, $3, $4, $5, $6)`;
const SET_PARAMETERS = 'username = $2, secret_ciphertext = $3, nonce = $4, key_ref = $5, rotated_at = $6';
const SET_EXCLUDED = 'username = EXCLUDED.username, secret_ciphertext = EXCLUDED.secret_ciphertext, nonce = EXCLUDED.nonce, key_ref = EXCLUDED.key_ref, rotated_at = EXCLUDED.rotated_at';
/** The four statement forms a replacement can take. */
const REPLACE = {
  update: `UPDATE ${TABLE} SET ${SET_PARAMETERS} WHERE device_id = $1`,
  upsertParameters: `${INSERT} ON CONFLICT (device_id) DO UPDATE SET ${SET_PARAMETERS}`,
  upsertExcluded: `${INSERT} ON CONFLICT (device_id) DO UPDATE SET ${SET_EXCLUDED}`,
  upsertByConstraint: `${INSERT} ON CONFLICT ON CONSTRAINT capture_device_credentials_pkey DO UPDATE SET ${SET_PARAMETERS}`,
} as const;

const stored = async (owner: Pool): Promise<unknown[]> =>
  (await owner.query(`SELECT device_id, username, get_byte(secret_ciphertext, 0) AS fill, key_ref, rotated_at::text AS rotated_at FROM ${TABLE} ORDER BY device_id`)).rows;
const objects = "SELECT count(*)::int AS objects, max(oid::bigint)::text AS newest FROM pg_class WHERE relnamespace = 'public'::regnamespace";

describe('M4A-1: the defect on a (3, dbc-4) database', () => {
  it('ten files applied, 0010 (and set 6) pending; this code is refused by B-3 and the code of row 129 passes', async () => {
    const owner = db.ownerPool();
    await migrateToVersion3(owner);
    const ledger = await inspectLedger(owner);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([TAG, '0011_session_stt_config', '0012_session_stt_config_privileges']);
    expect((await inspectLedger(owner, folderOf(11))).pending).toEqual([TAG]);
    const error = await checkSchemaVersion(db.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toBe(
      'B-3: the database is at schema version 3 (dbc-4); this server expects 5 (dbc-6). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>',
    );
    await expect(checkSchemaVersion(db.appPool(), { schemaVersion: 3, contractRevision: 'dbc-4' })).resolves.toBeUndefined();
  });

  it('as dems_app: the first INSERT works; all four replacing statements answer 42501; device_id is not readable', async () => {
    const owner = db.ownerPool();
    const app = db.appPool();
    for (const id of ['CAM-01', 'CAM-02']) await insertRow(owner, 'capture_devices', captureDevice(id, 'CAMERA'));
    expect(await outcome(app.query(INSERT, envelope('CAM-01', 1, 'KEY_A', 1_000)))).toBe('ok:1');
    const refusals: Record<string, string> = {};
    for (const [form, text] of Object.entries(REPLACE)) refusals[form] = await outcome(app.query(text, envelope('CAM-01', 2, 'KEY_B', 2_000)));
    expect(refusals).toEqual({ update: '42501', upsertParameters: '42501', upsertExcluded: '42501', upsertByConstraint: '42501' });
    expect(await outcome(app.query(`SELECT device_id FROM ${TABLE}`))).toBe('42501');
    expect(await stored(owner)).toEqual([{ device_id: 'CAM-01', username: 'user.1', fill: 1, key_ref: 'KEY_A', rotated_at: '1000' }]);
  });
});

describe('M4A-2: set 5 applies one file and changes neither an object nor a row', () => {
  it('db:migrate applies exactly 0010 and steps the version to (4, dbc-5); the ledger holds eleven files', async () => {
    const owner = db.ownerPool();
    const catalogBefore = await owner.query(objects);
    const rowsBefore = await stored(owner);
    // The set stops at 0010, so the applier commits the file and then reports that the version
    // is not this code's (5, 'dbc-6') - the same device as `migrateToVersion3`.
    const folder = folderOf(11);
    expect(await readSchemaVersion(owner)).toEqual({ schemaVersion: 3, contractRevision: 'dbc-4' });
    const error = await applyMigrations(owner, folder).catch((thrown: unknown) => thrown);
    expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
    expect(await readSchemaVersion(owner)).toEqual(SET_5);
    const ledger = await inspectLedger(owner, folder);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual([]);
    expect(await readAppliedMigrations(owner)).toHaveLength(11);
    expect((await owner.query(objects)).rows).toEqual(catalogBefore.rows);
    expect(await stored(owner)).toEqual(rowsBefore);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const owner = db.ownerPool();
    const before = await readAppliedMigrations(owner);
    const catalogBefore = await owner.query(objects);
    await applyMigrations(owner, folderOf(11)).catch(() => undefined);
    expect(await readSchemaVersion(owner)).toEqual(SET_5);
    expect(await readAppliedMigrations(owner)).toEqual(before);
    expect((await owner.query(objects)).rows).toEqual(catalogBefore.rows);
  });

  it('catalog: of the seven columns dems_app may SELECT device_id only; the table-level SELECT is still absent', async () => {
    const { rows } = await db.ownerPool().query<{ column_name: string; can_select: boolean }>(
      `SELECT a.attname::text AS column_name, has_column_privilege('dems_app', a.attrelid, a.attnum, 'SELECT') AS can_select
         FROM pg_attribute a WHERE a.attrelid = '${TABLE}'::regclass AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`,
    );
    expect(rows.filter((row) => row.can_select).map((row) => row.column_name)).toEqual(['device_id']);
    expect(rows.filter((row) => !row.can_select).map((row) => row.column_name)).toEqual([...HIDDEN]);
    const table = await db.ownerPool().query(`SELECT has_table_privilege('dems_app', '${TABLE}', 'SELECT') AS s, has_table_privilege('dems_app', '${TABLE}', 'DELETE') AS d`);
    expect(table.rows).toEqual([{ s: false, d: false }]);
  });
});

describe('M4A-3: as dems_app a stored camera credential is replaced', () => {
  it('UPDATE ... WHERE device_id replaces the row of that camera and no other; an unknown camera matches no row', async () => {
    const owner = db.ownerPool();
    const app = db.appPool();
    expect(await outcome(app.query(INSERT, envelope('CAM-02', 7, 'KEY_OTHER', 7_000)))).toBe('ok:1');
    expect(await outcome(app.query(REPLACE.update, envelope('CAM-01', 2, 'KEY_B', 2_000)))).toBe('ok:1');
    expect(await stored(owner)).toEqual([
      { device_id: 'CAM-01', username: 'user.2', fill: 2, key_ref: 'KEY_B', rotated_at: '2000' },
      { device_id: 'CAM-02', username: 'user.7', fill: 7, key_ref: 'KEY_OTHER', rotated_at: '7000' },
    ]);
    expect(await outcome(app.query(REPLACE.update, envelope('CAM-99', 3, 'KEY_C', 3_000)))).toBe('ok:0');
  });

  it('one-statement upsert: with bind parameters in SET it replaces (by column and by constraint); with EXCLUDED it is still refused', async () => {
    const owner = db.ownerPool();
    const app = db.appPool();
    expect(await outcome(app.query(REPLACE.upsertParameters, envelope('CAM-01', 3, 'KEY_C', 3_000)))).toBe('ok:1');
    expect((await stored(owner))[0]).toEqual({ device_id: 'CAM-01', username: 'user.3', fill: 3, key_ref: 'KEY_C', rotated_at: '3000' });
    expect(await outcome(app.query(REPLACE.upsertByConstraint, envelope('CAM-01', 4, 'KEY_D', 4_000)))).toBe('ok:1');
    expect((await stored(owner))[0]).toEqual({ device_id: 'CAM-01', username: 'user.4', fill: 4, key_ref: 'KEY_D', rotated_at: '4000' });
    // MEASURED, and the reason the store must not send the EXCLUDED form: PostgreSQL asks for
    // SELECT on the target column behind every EXCLUDED reference, and those columns are the
    // secret. The refusal changes nothing.
    expect(await outcome(app.query(REPLACE.upsertExcluded, envelope('CAM-01', 5, 'KEY_E', 5_000)))).toBe('42501');
    expect((await stored(owner))[0]).toEqual({ device_id: 'CAM-01', username: 'user.4', fill: 4, key_ref: 'KEY_D', rotated_at: '4000' });
    // The same upsert on a camera without a row is the first INSERT; still two rows, one per camera.
    await owner.query(`DELETE FROM ${TABLE} WHERE device_id = 'CAM-02'`);
    expect(await outcome(app.query(REPLACE.upsertParameters, envelope('CAM-02', 8, 'KEY_F', 8_000)))).toBe('ok:1');
    expect((await owner.query(`SELECT count(*)::int AS rows FROM ${TABLE}`)).rows).toEqual([{ rows: 2 }]);
  });

  it('the CHECKs still bind a replacement: a 32-byte ciphertext is refused 23514 and the stored row stays', async () => {
    const owner = db.ownerPool();
    const before = await stored(owner);
    const short = ['CAM-01', 'user.9', Buffer.alloc(32, 9), Buffer.alloc(12, 9), 'KEY_G', 9_000];
    expect(await outcome(db.appPool().query(REPLACE.update, short))).toBe(SQLSTATE.checkViolation);
    expect(await stored(owner)).toEqual(before);
  });
});

describe('M4A-4: the credential columns stay unreadable to dems_app', () => {
  it('SELECT of each of the six columns, of the row, and every write form that would hand a value back: 42501', async () => {
    const app = db.appPool();
    for (const column of HIDDEN) await expectRefused(() => app.query(`SELECT ${column} FROM ${TABLE}`), SQLSTATE.insufficientPrivilege);
    const refused = [
      `SELECT * FROM ${TABLE}`,
      `SELECT c FROM ${TABLE} AS c`,
      `SELECT device_id FROM ${TABLE} WHERE key_ref = 'KEY_D'`,
      `SELECT device_id FROM ${TABLE} ORDER BY rotated_at`,
      `SELECT device_id FROM ${TABLE} WHERE get_byte(secret_ciphertext, 0) = 4`,
      `UPDATE ${TABLE} SET rotated_at = 1 WHERE device_id = 'CAM-01' RETURNING secret_ciphertext`,
      `UPDATE ${TABLE} SET rotated_at = 1 WHERE device_id = 'CAM-01' RETURNING *`,
      `UPDATE ${TABLE} SET username = username WHERE device_id = 'CAM-01'`,
      `UPDATE ${TABLE} SET rotated_at = 1 WHERE username = 'user.4'`,
      `INSERT INTO ${TABLE} (device_id, username, secret_ciphertext, nonce, key_ref, rotated_at) SELECT 'CAM-01', username, secret_ciphertext, nonce, key_ref, 1 FROM ${TABLE} ON CONFLICT (device_id) DO NOTHING`,
      `INSERT INTO ${TABLE} (device_id, username, secret_ciphertext, nonce, key_ref, rotated_at) VALUES ('CAM-01', 'u', '\\x${'00'.repeat(33)}', '\\x${'00'.repeat(12)}', 'KEY_H', 1) ON CONFLICT (device_id) DO UPDATE SET rotated_at = 1 WHERE ${TABLE.slice(7)}.key_ref = 'KEY_D'`,
      `COPY ${TABLE} TO STDOUT`,
      `DELETE FROM ${TABLE} WHERE device_id = 'CAM-01'`,
      `TRUNCATE ${TABLE}`,
    ];
    for (const text of refused) await expectRefused(() => app.query(text), SQLSTATE.insufficientPrivilege);
    // Nothing above changed a row.
    expect((await stored(db.ownerPool()))[0]).toEqual({ device_id: 'CAM-01', username: 'user.4', fill: 4, key_ref: 'KEY_D', rotated_at: '4000' });
  });

  it('what the grant does open, stated: the device ids that have a credential, and their count - the credentialSet fact', async () => {
    const app = db.appPool();
    expect((await app.query(`SELECT device_id FROM ${TABLE} ORDER BY device_id`)).rows).toEqual([{ device_id: 'CAM-01' }, { device_id: 'CAM-02' }]);
    expect((await app.query(`SELECT count(*)::int AS rows FROM ${TABLE}`)).rows).toEqual([{ rows: 2 }]);
  });
});

describe('M4A-5: NEGATIVE CONTROL - a planted blanket grant is caught', () => {
  it('after GRANT SELECT ON ALL TABLES the secret columns of both stores answer, so the assertions of M4A-4 would fail', async () => {
    const other = await db.another({ template: 'schema', slug: 'set5_blanket' });
    const app = other.appPool();
    await expectRefused(() => app.query(`SELECT secret_ciphertext FROM ${TABLE}`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('SELECT secret_ciphertext FROM public.stt_config'), SQLSTATE.insufficientPrivilege);
    await other.ownerPool().query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO dems_app');
    await expect(app.query(`SELECT secret_ciphertext FROM ${TABLE}`)).resolves.toMatchObject({ rowCount: 0 });
    await expect(app.query('SELECT secret_ciphertext FROM public.stt_config')).resolves.toBeDefined();
    const catalog = await other.ownerPool().query(`SELECT has_table_privilege('dems_app', '${TABLE}', 'SELECT') AS s`);
    expect(catalog.rows).toEqual([{ s: true }]);
  });
});

describe('M4A-6: B-3 across the step, in both directions', () => {
  it('the code of row 129 (3, dbc-4) on the migrated database is refused; the code of row 129a (4, dbc-5) passes', async () => {
    const error = await checkSchemaVersion(db.appPool(), { schemaVersion: 3, contractRevision: 'dbc-4' }).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 4 (dbc-5); this server expects 3 (dbc-4)');
    await expect(checkSchemaVersion(db.appPool(), SET_5)).resolves.toBeUndefined();
  });
});

describe('M4A-7: stt_config needed no grant - its secret is replaced through WHERE singleton', () => {
  it('on a (3, dbc-4) database, without 0010: two secret writes in a row as dems_app, the second replaces the first; the secret is not readable', async () => {
    const old = await db.another({ template: EMPTY_DATABASE, slug: 'set5_stt' });
    await migrateToVersion3(old.ownerPool());
    await insertRow(old.ownerPool(), 'stt_config', sttConfig({ updated_by: null }));
    const app = old.appPool();
    const write = 'UPDATE public.stt_config SET credential_kind = $1, credential_ref = $2, secret_ciphertext = $3, nonce = $4, revision = revision + 1 WHERE singleton AND revision = $5';
    expect(await outcome(app.query(write, ['ENCRYPTED', 'KEY_S1', Buffer.alloc(17, 1), Buffer.alloc(12, 1), 1]))).toBe('ok:1');
    expect(await outcome(app.query(write, ['ENCRYPTED', 'KEY_S2', Buffer.alloc(17, 2), Buffer.alloc(12, 2), 2]))).toBe('ok:1');
    expect((await old.ownerPool().query('SELECT credential_ref, get_byte(secret_ciphertext, 0) AS fill, revision::int AS revision FROM public.stt_config')).rows).toEqual([
      { credential_ref: 'KEY_S2', fill: 2, revision: 3 },
    ]);
    for (const column of ['secret_ciphertext', 'nonce', 'credential_ref']) await expectRefused(() => app.query(`SELECT ${column} FROM public.stt_config`), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`${write} RETURNING secret_ciphertext`, ['ENCRYPTED', 'KEY_S3', Buffer.alloc(17, 3), Buffer.alloc(12, 3), 3]), SQLSTATE.insufficientPrivilege);
  });
});

describe('M4A-8: the file', () => {
  it('0010 is one GRANT of one column, one boundary REVOKE and the version row; no blanket form', () => {
    const text = readFileSync(join(MIGRATIONS_FOLDER, `${TAG}.sql`), 'utf8');
    const statements = text
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').map((line) => line.trim()).join(' ').trim())
      .filter((part) => part !== '');
    expect(statements).toEqual([
      'GRANT SELECT (device_id) ON capture_device_credentials TO dems_app;',
      'REVOKE SELECT (username, encryption, secret_ciphertext, nonce, key_ref, rotated_at) ON capture_device_credentials FROM dems_app;',
      "UPDATE public.schema_meta SET schema_version = 4, contract_revision = 'dbc-5' WHERE singleton;",
    ]);
    expect(statements.join(' ')).not.toMatch(/ALL\s+TABLES/i);
    expect(statements.join(' ')).not.toMatch(/dems_owner|dems_admin|SECURITY\s+DEFINER/i);
  });

  it('0008 and 0009 hash to what the ledgers of the four development databases store (row 130): they were not edited (MG-4)', () => {
    const hashes = Object.fromEntries(readMigrationSet().map((file) => [file.tag, file.sha256]));
    expect(hashes['0008_capture_sources']).toBe('2c1e485da34bbf17b4ed8aa811ab5590e6a808ea3bf2d9b7cdb1fdcdd16fba8e');
    expect(hashes['0009_capture_sources_privileges']).toBe('3100b5ee098fa10a3d31033c48203e4709343caf3346eee2c331c8691e24bf8b');
  });
});
