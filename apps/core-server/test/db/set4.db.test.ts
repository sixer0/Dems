// Migration set 4 (`0008_capture_sources.sql` + `0009_capture_sources_privileges.sql`; database
// contract dbc-4 §N.8 to §N.12; blueprint row 129). The named checks of the test strategy §A.4a:
//
//   M4-MT-9   set 4 applies on a database at (2, 'dbc-3') that holds rows, and on a fresh one
//   M4-MT-10  the CHECKs, the partial unique index and the foreign key accept the legal and
//             refuse the rest
//   M4-MT-11  privileges as dems_app: INSERT-only T-41, no UPDATE of the two new columns, and NO
//             SELECT regression on the two secret stores
//   M4-MT-16  B-3 across the version step, in both directions
//
// Every database here is a throw-away of this test run (TI-17): `dems_demo` and the lanes are
// neither named nor reached. The "copy of dems_demo" of M4-MT-9 is REBUILT, not copied - the live
// databases may not be read by a test: an empty clone takes the real files 0000..0007 (so it is a
// genuine `(2, 'dbc-3')` database), then the row counts dbc-4 §N.1 records for `dems_demo` in the
// v2 column shape (5 built-in capture devices, 13 evidence items), and only then set 4.
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
  readSchemaVersion,
} from '../../src/db/commands/migrations';
import { runStatus } from '../../src/db/commands/status';
import { BootCheckError, checkSchemaVersion } from '../../src/db/schema/boot-checks';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../src/db/schema/meta';
import { useTestDatabase } from '../helpers/db';
import { captureDevice, captureSource, evidenceItem, insertRbac, insertRow, sessionHistory, type Row } from './fixtures';
import { EMPTY_DATABASE, SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

const SET_3_TAGS = INITIAL_MIGRATION_TAGS.slice(0, 8);
const temporary: string[] = [];

afterAll(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
});

/** A migration folder holding the first `count` real files, optionally with one file's text changed. */
function folderOf(count: number, edit?: { readonly tag: string; readonly append: string }): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-set4-'));
  temporary.push(folder);
  mkdirSync(join(folder, 'meta'));
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
  writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }));
  for (const tag of INITIAL_MIGRATION_TAGS.slice(0, count)) {
    cpSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), join(folder, `${tag}.sql`));
    if (edit?.tag === tag) writeFileSync(join(folder, `${tag}.sql`), `${readFileSync(join(folder, `${tag}.sql`), 'utf8')}${edit.append}`);
  }
  return folder;
}

/** Applies the eight files of schema version 2. The applier reports the version it then finds. */
async function migrateToVersion2(pool: Pool): Promise<void> {
  // `applyMigrations` ends by comparing the version with this code's constants, so on a set that
  // stops at 0007 it throws AFTER the files are committed - which is exactly the state wanted.
  const error = await applyMigrations(pool, folderOf(8)).catch((thrown: unknown) => thrown);
  expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
  expect(await readSchemaVersion(pool)).toEqual({ schemaVersion: 2, contractRevision: 'dbc-3' });
}

const without = (row: Row, ...columns: string[]): Row => Object.fromEntries(Object.entries(row).filter(([column]) => !columns.includes(column)));
const sessionOf = (index: number): string => `SES-20261001-${String(index).padStart(4, '0')}`;
const evidenceOf = (index: number): string => `EV-20261001-${String(index).padStart(4, '0')}`;
const caseOf = (index: number): string => `LP/2026/1001-${String(index).padStart(4, '0')}`;

const BUILT_INS: ReadonlyArray<readonly [string, 'CAMERA' | 'MIC' | 'POE']> = [
  ['CAM-01', 'CAMERA'],
  ['CAM-02', 'CAMERA'],
  ['MIC-01', 'MIC'],
  ['MIC-02', 'MIC'],
  ['POE-SWITCH', 'POE'],
];

describe('M4-MT-9: set 4 applies on a (2, dbc-3) database that holds rows', () => {
  it('the pre-state is schema version 2: 40 tables, no T-41, neither new column, and this code is refused by B-3', async () => {
    const owner = db.ownerPool();
    await migrateToVersion2(owner);
    const shape = await owner.query<{ tables: number; t41: boolean; adapter: number; flag: number; files: number }>(
      `SELECT (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public') AS tables,
              to_regclass('public.session_capture_sources') IS NOT NULL AS t41,
              (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capture_devices' AND column_name = 'adapter_kind') AS adapter,
              (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evidence_items' AND column_name = 'development_sources') AS flag,
              (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS files`,
    );
    expect(shape.rows[0]).toEqual({ tables: 40, t41: false, adapter: 0, flag: 0, files: 8 });
    // The ledger of the real folder: eight applied, nothing edited; pending are the two files of
    // set 4 and, since row 129a, the one file of set 5 (0010); since row 129b the two of set 6.
    const ledger = await inspectLedger(owner);
    expect(ledger.ok).toBe(true);
    expect(ledger.pending).toEqual(['0008_capture_sources', '0009_capture_sources_privileges', '0010_credential_replace_privileges', '0011_session_stt_config', '0012_session_stt_config_privileges']);
  });

  it('the rows a v2 database holds: 5 built-in devices and 13 items, written in the v2 column shape', async () => {
    const owner = db.ownerPool();
    await insertRbac(owner);
    // No `adapter_kind` and no `development_sources`: the columns do not exist yet. The seeded
    // built-ins carry no endpoint reference (`seed.ts`), which is what lets the partial unique
    // index of 0008 validate against existing data.
    for (const [id, kind] of BUILT_INS) await insertRow(owner, 'capture_devices', without(captureDevice(id, kind, { onvif_uuid: null }), 'adapter_kind'));
    for (let index = 1; index <= 13; index += 1) {
      await insertRow(owner, 'session_history', sessionHistory({ id: sessionOf(index), case_number: caseOf(index) }));
      await insertRow(owner, 'evidence_items', evidenceItem({ id: evidenceOf(index), session_id: sessionOf(index), case_number: caseOf(index) }));
    }
    const counts = await owner.query('SELECT (SELECT count(*)::int FROM capture_devices) AS devices, (SELECT count(*)::int FROM evidence_items) AS items');
    expect(counts.rows).toEqual([{ devices: 5, items: 13 }]);
  });

  it('NEGATIVE CONTROL: with 0009 left out the version stays (2, dbc-3) and the applier refuses the result', async () => {
    // On a second database, so the database of this describe keeps its pending set of two.
    const other = await db.another({ template: EMPTY_DATABASE, slug: 'set4_no0009' });
    await migrateToVersion2(other.ownerPool());
    const error = await applyMigrations(other.ownerPool(), folderOf(9)).catch((thrown: unknown) => thrown);
    expect(error).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
    expect((error as Error).message).toContain('After the migration the database is at schema version 2 (dbc-3); this code expects 5 (dbc-6)');
    // 0008 did land (the table exists), and without 0009 the runtime role holds nothing on it.
    expect(await readSchemaVersion(other.ownerPool())).toEqual({ schemaVersion: 2, contractRevision: 'dbc-3' });
    await expect(checkSchemaVersion(other.appPool())).rejects.toBeInstanceOf(BootCheckError);
    await expectRefused(() => other.appPool().query('SELECT 1 FROM public.session_capture_sources'), SQLSTATE.insufficientPrivilege);
  });

  it('db:migrate applies exactly the pending files - set 4, then 0010 of set 5 (row 129a) and set 6 (row 129b) - and ends at (5, dbc-6)', async () => {
    const owner = db.ownerPool();
    const result = await applyMigrations(owner);
    expect(result.versionBefore).toEqual({ schemaVersion: 2, contractRevision: 'dbc-3' });
    expect(result.applied).toEqual(['0008_capture_sources', '0009_capture_sources_privileges', '0010_credential_replace_privileges', '0011_session_stt_config', '0012_session_stt_config_privileges']);
    expect(result.versionAfter).toEqual({ schemaVersion: 5, contractRevision: 'dbc-6' });
    expect(result.versionAfter).toEqual({ schemaVersion: DB_SCHEMA_VERSION, contractRevision: DB_CONTRACT_REVISION });
    // Ledger current with 13 files, each with its own hash.
    expect(result.ledger.ok).toBe(true);
    expect(result.ledger.pending).toEqual([]);
    expect(result.ledger.entries.map((entry) => entry.state)).toEqual(INITIAL_MIGRATION_TAGS.map(() => 'applied'));
    expect(await readAppliedMigrations(owner)).toHaveLength(13);
    expect(SET_3_TAGS).toHaveLength(8);
  });

  it('the existing rows after the step: 5 devices read FAKE, 13 items read NULL, 0 source rows, 42 tables (T-42 of set 6 came with the same run)', async () => {
    const owner = db.ownerPool();
    const devices = await owner.query('SELECT id, kind, adapter_kind FROM capture_devices ORDER BY id');
    expect(devices.rows).toEqual([
      { id: 'CAM-01', kind: 'CAMERA', adapter_kind: 'FAKE' },
      { id: 'CAM-02', kind: 'CAMERA', adapter_kind: 'FAKE' },
      { id: 'MIC-01', kind: 'MIC', adapter_kind: 'FAKE' },
      { id: 'MIC-02', kind: 'MIC', adapter_kind: 'FAKE' },
      { id: 'POE-SWITCH', kind: 'POE', adapter_kind: 'FAKE' },
    ]);
    const facts = await owner.query(
      `SELECT (SELECT count(*)::int FROM evidence_items) AS items,
              (SELECT count(*)::int FROM evidence_items WHERE development_sources IS NULL) AS items_null,
              (SELECT count(*)::int FROM session_capture_sources) AS sources,
              (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public') AS tables`,
    );
    expect(facts.rows).toEqual([{ items: 13, items_null: 13, sources: 0, tables: 42 }]);
    // The physical position of the two columns: last, as the typed schema declares them.
    const last = await owner.query(
      `SELECT table_name::text AS t, column_name::text AS c FROM information_schema.columns AS c
        WHERE table_schema = 'public' AND table_name IN ('capture_devices', 'evidence_items')
          AND ordinal_position = (SELECT max(ordinal_position) FROM information_schema.columns AS m WHERE m.table_schema = 'public' AND m.table_name = c.table_name)
        ORDER BY 1`,
    );
    expect(last.rows).toEqual([
      { t: 'capture_devices', c: 'adapter_kind' },
      { t: 'evidence_items', c: 'development_sources' },
    ]);
  });

  it('a second run applies nothing and changes nothing (MG-10)', async () => {
    const owner = db.ownerPool();
    const before = await readAppliedMigrations(owner);
    const objects = "SELECT count(*)::int AS objects, max(oid::bigint)::text AS newest FROM pg_class WHERE relnamespace = 'public'::regnamespace";
    const catalogBefore = await owner.query(objects);
    const result = await applyMigrations(owner);
    expect(result.applied).toEqual([]);
    expect(result.versionBefore).toEqual({ schemaVersion: 5, contractRevision: 'dbc-6' });
    expect(result.versionAfter).toEqual({ schemaVersion: 5, contractRevision: 'dbc-6' });
    expect(await readAppliedMigrations(owner)).toEqual(before);
    expect((await owner.query(objects)).rows).toEqual(catalogBefore.rows);
  });

  it('NEGATIVE CONTROL: a file whose hash differs from the ledger is reported, and the applier stops', async () => {
    const owner = db.ownerPool();
    const edited = folderOf(11, { tag: '0009_capture_sources_privileges', append: '\n-- one byte more\n' });
    const report = await inspectLedger(owner, edited);
    expect(report.ok).toBe(false);
    expect(report.entries.find((entry) => entry.tag === '0009_capture_sources_privileges')?.state).toBe('edited');
    await expect(applyMigrations(owner, edited)).rejects.toMatchObject({ code: 'MIGRATION_LEDGER_MISMATCH' });
  });

  it('0009 is the four statements of dbc-4 §N.8 and holds no blanket grant; 0004 to 0007 are the files they were', () => {
    const text = readFileSync(join(MIGRATIONS_FOLDER, '0009_capture_sources_privileges.sql'), 'utf8');
    const statements = text
      .split('--> statement-breakpoint')
      .map((part) => part.split('\n').filter((line) => !line.trimStart().startsWith('--') && line.trim() !== '').join(' ').trim())
      .filter((part) => part !== '');
    expect(statements).toEqual([
      'GRANT SELECT, INSERT ON session_capture_sources TO dems_app;',
      'REVOKE UPDATE (adapter_kind) ON capture_devices FROM dems_app;',
      'REVOKE UPDATE (development_sources) ON evidence_items FROM dems_app;',
      "UPDATE public.schema_meta SET schema_version = 3, contract_revision = 'dbc-4' WHERE singleton;",
    ]);
    // No blanket form in any statement of the set (a comment may name it to forbid it).
    expect(statements.join(' ')).not.toMatch(/ALL\s+TABLES/i);
    const generated = readFileSync(join(MIGRATIONS_FOLDER, '0008_capture_sources.sql'), 'utf8');
    expect(generated).not.toMatch(/\b(GRANT|REVOKE)\b/i);
    expect(generated).not.toMatch(/schema_meta/);
    // SEC35-36 (3) is void (D91): the set swaps no forbidden-key CHECK and touches no session state.
    expect(generated).not.toMatch(/no_secret_keys|active_session|health_snapshots/);
  });
});

describe('M4-MT-10: the CHECKs, the unique index and the foreign key of set 4', () => {
  const LEGAL: ReadonlyArray<readonly ['CAMERA' | 'MIC' | 'POE', string]> = [
    ['CAMERA', 'ONVIF_RTSP'], ['CAMERA', 'FAKE'], ['CAMERA', 'LOCAL_DEVICE'],
    ['MIC', 'USB_AUDIO'], ['MIC', 'FAKE'], ['MIC', 'LOCAL_DEVICE'],
    ['POE', 'SNMP_POE'], ['POE', 'FAKE'],
  ];
  const ILLEGAL: ReadonlyArray<readonly ['CAMERA' | 'MIC' | 'POE', string]> = [
    ['CAMERA', 'USB_AUDIO'], ['CAMERA', 'SNMP_POE'],
    ['MIC', 'ONVIF_RTSP'], ['MIC', 'SNMP_POE'],
    ['POE', 'ONVIF_RTSP'], ['POE', 'USB_AUDIO'], ['POE', 'LOCAL_DEVICE'],
  ];
  const idOf = (kind: string, index: number): string => (kind === 'POE' ? `POE-T${String(index).padStart(2, '0')}` : `${kind === 'CAMERA' ? 'CAM' : 'MIC'}-${String(40 + index)}`);

  it('capture_devices: the 8 legal (kind, adapter) pairs are accepted', async () => {
    const owner = db.ownerPool();
    for (const [index, [kind, adapter]] of LEGAL.entries()) {
      await insertRow(owner, 'capture_devices', captureDevice(idOf(kind, index), kind, { adapter_kind: adapter }));
    }
    const { rows } = await owner.query("SELECT count(*)::int AS n FROM capture_devices WHERE id ~ '^(CAM|MIC)-4[0-9]$' OR id ~ '^POE-T'");
    expect(rows[0]?.n).toBe(8);
  });

  it.each(ILLEGAL.map(([kind, adapter], index) => [kind, adapter, index] as const))('capture_devices: (%s, %s) is refused by the pairing CHECK', async (kind, adapter, index) => {
    await expectRefused(
      () => insertRow(db.ownerPool(), 'capture_devices', captureDevice(idOf(kind, 20 + index), kind, { adapter_kind: adapter })),
      SQLSTATE.checkViolation,
      'capture_devices_adapter_pairing_check',
    );
  });

  it('capture_devices: a sixth kind is refused by the set CHECK and NULL by NOT NULL; an INSERT without the column gets FAKE', async () => {
    const owner = db.ownerPool();
    await expectRefused(() => insertRow(owner, 'capture_devices', captureDevice('CAM-60', 'CAMERA', { adapter_kind: 'RTMP' })), SQLSTATE.checkViolation, 'capture_devices_adapter_kind_check');
    await expectRefused(() => insertRow(owner, 'capture_devices', captureDevice('CAM-60', 'CAMERA', { adapter_kind: null })), SQLSTATE.notNullViolation);
    await insertRow(owner, 'capture_devices', without(captureDevice('CAM-61', 'CAMERA'), 'adapter_kind'));
    expect((await owner.query("SELECT adapter_kind FROM capture_devices WHERE id = 'CAM-61'")).rows).toEqual([{ adapter_kind: 'FAKE' }]);
  });

  it('capture_devices: one device per endpoint reference (23505 on the partial unique index); any number of NULLs', async () => {
    const owner = db.ownerPool();
    await insertRow(owner, 'capture_devices', captureDevice('CAM-70', 'CAMERA', { onvif_uuid: 'urn:uuid:set4-a' }));
    await expectRefused(
      () => insertRow(owner, 'capture_devices', captureDevice('CAM-71', 'CAMERA', { onvif_uuid: 'urn:uuid:set4-a' })),
      SQLSTATE.uniqueViolation,
      'capture_devices_onvif_uuid_key',
    );
    await insertRow(owner, 'capture_devices', captureDevice('CAM-72', 'CAMERA', { onvif_uuid: null }));
    await insertRow(owner, 'capture_devices', captureDevice('CAM-73', 'CAMERA', { onvif_uuid: null }));
    expect((await owner.query("SELECT count(*)::int AS n FROM capture_devices WHERE id IN ('CAM-72', 'CAM-73') AND onvif_uuid IS NULL")).rows[0]?.n).toBe(2);
  });

  it('session_capture_sources: the four legal rows of a session are accepted', async () => {
    const owner = db.ownerPool();
    for (const slot of ['VIDEO-01', 'VIDEO-02', 'MIC-PRIMARY', 'MIC-STANDBY']) await insertRow(owner, 'session_capture_sources', captureSource(slot));
    expect((await owner.query('SELECT count(*)::int AS n FROM session_capture_sources')).rows[0]?.n).toBe(4);
  });

  it.each([
    ['a fifth slot', captureSource('VIDEO-03'), SQLSTATE.checkViolation, 'session_capture_sources_pairing_check'],
    ['USB_AUDIO in a VIDEO slot', captureSource('VIDEO-01', { session_id: 'SES-20261001-0002', adapter_kind: 'USB_AUDIO' }), SQLSTATE.checkViolation, 'session_capture_sources_pairing_check'],
    ['ONVIF_RTSP in a MIC slot', captureSource('MIC-PRIMARY', { session_id: 'SES-20261001-0002', adapter_kind: 'ONVIF_RTSP' }), SQLSTATE.checkViolation, 'session_capture_sources_pairing_check'],
    ['SNMP_POE in a VIDEO slot', captureSource('VIDEO-02', { session_id: 'SES-20261001-0002', adapter_kind: 'SNMP_POE' }), SQLSTATE.checkViolation, 'session_capture_sources_pairing_check'],
    ['SNMP_POE in a MIC slot', captureSource('MIC-STANDBY', { session_id: 'SES-20261001-0002', adapter_kind: 'SNMP_POE' }), SQLSTATE.checkViolation, 'session_capture_sources_pairing_check'],
    ['an unknown adapter kind', captureSource('VIDEO-01', { session_id: 'SES-20261001-0002', adapter_kind: 'RTMP' }), SQLSTATE.checkViolation, 'session_capture_sources_adapter_kind_check'],
    ['a second row for one (session, slot)', captureSource('VIDEO-01'), SQLSTATE.uniqueViolation, 'session_capture_sources_pkey'],
    ['an unknown device', captureSource('VIDEO-01', { session_id: 'SES-20261001-0002', device_id: 'CAM-99' }), SQLSTATE.foreignKeyViolation, 'session_capture_sources_device_id_fkey'],
  ] as const)('session_capture_sources: %s is refused', async (_what, row, code, constraint) => {
    await expectRefused(() => insertRow(db.ownerPool(), 'session_capture_sources', row), code, constraint);
  });

  it('the slot CHECK is live on its own: with the pairing CHECK set aside, a fifth slot meets session_capture_sources_slot_check', async () => {
    // The pairing rule comes first in name order and refuses every unknown slot, so the slot list
    // is proven on a second database where the pairing rule is dropped (an accept/refuse pair per
    // CHECK: a dropped slot CHECK would make this INSERT succeed).
    const other = await db.another({ template: 'schema', slug: 'set4_slot' });
    const owner = other.ownerPool();
    await insertRow(owner, 'capture_devices', captureDevice('CAM-01', 'CAMERA'));
    await owner.query('ALTER TABLE public.session_capture_sources DROP CONSTRAINT session_capture_sources_pairing_check');
    await expectRefused(() => insertRow(owner, 'session_capture_sources', captureSource('VIDEO-03')), SQLSTATE.checkViolation, 'session_capture_sources_slot_check');
    await insertRow(owner, 'session_capture_sources', captureSource('VIDEO-01'));
  });
});

describe('M4-MT-11: the privileges of dems_app after set 4', () => {
  it('T-41 is INSERT-only: INSERT and SELECT succeed; UPDATE, DELETE and TRUNCATE fail 42501', async () => {
    const app = db.appPool();
    await insertRow(app, 'session_capture_sources', captureSource('VIDEO-01', { session_id: 'SES-20261001-0500' }));
    expect((await app.query("SELECT slot, adapter_kind FROM public.session_capture_sources WHERE session_id = 'SES-20261001-0500'")).rows).toEqual([
      { slot: 'VIDEO-01', adapter_kind: 'FAKE' },
    ]);
    await expectRefused(() => app.query("UPDATE public.session_capture_sources SET adapter_kind = 'LOCAL_DEVICE' WHERE session_id = 'SES-20261001-0500'"), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query("UPDATE public.session_capture_sources SET recorded_at = 1 WHERE session_id = 'SES-20261001-0500'"), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query("DELETE FROM public.session_capture_sources WHERE session_id = 'SES-20261001-0500'"), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('TRUNCATE public.session_capture_sources'), SQLSTATE.insufficientPrivilege);
  });

  it('the two new columns are written once: no UPDATE of adapter_kind, kind or development_sources; the granted columns still update', async () => {
    const app = db.appPool();
    await expectRefused(() => app.query("UPDATE public.capture_devices SET adapter_kind = 'LOCAL_DEVICE' WHERE id = 'CAM-01'"), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query("UPDATE public.capture_devices SET kind = 'MIC' WHERE id = 'CAM-01'"), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query(`UPDATE public.evidence_items SET development_sources = true WHERE id = '${evidenceOf(1)}'`), SQLSTATE.insufficientPrivilege);
    // Positive control: the same role updates a column the matrix grants, on the same two tables.
    expect((await app.query("UPDATE public.capture_devices SET enabled = false WHERE id = 'CAM-01'")).rowCount).toBe(1);
    expect((await app.query(`UPDATE public.evidence_items SET verification_status = 'PASS', verification_at = 1 WHERE id = '${evidenceOf(1)}'`)).rowCount).toBe(1);
    // The catalog agrees: 10 updatable columns on capture_devices, 7 on evidence_items.
    const granted = await db.ownerPool().query(
      `SELECT c.table_name::text AS t, count(*)::int AS n FROM information_schema.columns AS c
        WHERE c.table_schema = 'public' AND c.table_name IN ('capture_devices', 'evidence_items', 'session_capture_sources')
          AND has_column_privilege('dems_app', format('public.%I', c.table_name)::regclass, c.column_name, 'UPDATE')
        GROUP BY 1 ORDER BY 1`,
    );
    expect(granted.rows).toEqual([{ t: 'capture_devices', n: 10 }, { t: 'evidence_items', n: 7 }]);
  });

  it('no SELECT regression: the credential store and the three hidden stt_config columns still fail 42501', async () => {
    const app = db.appPool();
    // This database is at (5, dbc-6) (the applier ran 0010 too, row 129a, and set 6, row 129b): `SELECT 1` answers
    // since the key column is readable; the row and each column that carries the credential do not.
    await expectRefused(() => app.query('SELECT * FROM public.capture_device_credentials'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('SELECT secret_ciphertext FROM public.capture_device_credentials'), SQLSTATE.insufficientPrivilege);
    for (const column of ['username', 'encryption', 'nonce', 'key_ref', 'rotated_at']) {
      await expectRefused(() => app.query(`SELECT ${column} FROM public.capture_device_credentials`), SQLSTATE.insufficientPrivilege);
    }
    for (const column of ['secret_ciphertext', 'nonce', 'credential_ref']) {
      await expectRefused(() => app.query(`SELECT ${column} FROM public.stt_config`), SQLSTATE.insufficientPrivilege);
    }
    // The non-secret columns stay readable, so the refusals above are the carve-out, not a broken role.
    await app.query('SELECT backend, endpoint FROM public.stt_config');
  });

  it('NEGATIVE CONTROL: a planted blanket GRANT SELECT re-opens both secret stores - the assertions above would fail', async () => {
    const other = await db.another({ template: 'schema', slug: 'set4_blanket' });
    const app = other.appPool();
    await expectRefused(() => app.query('SELECT secret_ciphertext FROM public.capture_device_credentials'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('SELECT secret_ciphertext FROM public.stt_config'), SQLSTATE.insufficientPrivilege);
    await other.ownerPool().query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO dems_app');
    await expect(app.query('SELECT secret_ciphertext FROM public.capture_device_credentials')).resolves.toMatchObject({ rowCount: 0 });
    await expect(app.query('SELECT secret_ciphertext FROM public.stt_config')).resolves.toBeDefined();
  });
});

describe('M4-MT-16: B-3 across the version step, in both directions', () => {
  it('this code on a database at (2, dbc-3) is refused, and the message names db:migrate', async () => {
    const old = await db.another({ template: EMPTY_DATABASE, slug: 'set4_b3old' });
    await migrateToVersion2(old.ownerPool());
    const error = await checkSchemaVersion(old.appPool()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toBe(
      'B-3: the database is at schema version 2 (dbc-3); this server expects 5 (dbc-6). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>',
    );
  });

  it('db:status of this code on a database at (2, dbc-3) still reports: version 2, five pending files, 40 row counts, exit 1', async () => {
    // Row 130 reads `db:status` on the four live databases BEFORE it applies the set, with this
    // code in the tree. The command must not stop at the table the pending file creates.
    const old = await db.another({ template: EMPTY_DATABASE, slug: 'set4_status' });
    await migrateToVersion2(old.ownerPool());
    await old.closeResources();
    const out: string[] = [];
    const err: string[] = [];
    const exitCode = await runStatus(['--database', old.name], {
      allowTestDatabase: true,
      dataDir: db.run.dataDir,
      io: { out: (line) => out.push(line), err: (line) => err.push(line) },
    });
    expect(exitCode).toBe(1);
    expect(out).toContain('schema version   2; contract revision dbc-3; this code expects 5 (dbc-6)');
    expect(out).toContain('migrations       13 file(s); ledger matches');
    expect(out.filter((line) => / pending /.test(line))).toHaveLength(5);
    expect(out).toContain('row counts       40 table(s)');
    expect(out.some((line) => line.includes('session_capture_sources'))).toBe(false);
    expect(out.some((line) => line.includes('session_stt_config  '))).toBe(false);
    expect(err[0]).toContain('5 migration(s) are not applied: 0008_capture_sources, 0009_capture_sources_privileges, 0010_credential_replace_privileges, 0011_session_stt_config, 0012_session_stt_config_privileges. Run "npm run db:migrate".');
    expect(err.at(-1)).toContain(`NOT OK: 2 problem(s) on ${old.name}.`);
  });

  it('code older than row 129 on the migrated database (now at (5, dbc-6), row 129b) is refused', async () => {
    const error = await checkSchemaVersion(db.appPool(), { schemaVersion: 2, contractRevision: 'dbc-3' }).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).message).toContain('the database is at schema version 5 (dbc-6); this server expects 2 (dbc-3)');
  });

  it('positive control: this code on its own version (5, dbc-6) passes', async () => {
    await expect(checkSchemaVersion(db.appPool())).resolves.toBeUndefined();
  });
});
