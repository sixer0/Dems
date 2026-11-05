// AC-B-01, MG-9, MG-10 (database contract §8; plan row W17): on an empty database the migration
// set creates the schema, as the owner role, in the order of §8.2; a second run applies nothing.
//
// The file gets an EMPTY clone (the private template `x_empty`: `template0`, UTF8, locale C, no
// hook), so the migrations are applied here, by the function `db:migrate` uses, not by the
// template hook.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_MIGRATION_TAGS,
  MIGRATIONS_FOLDER,
  applyMigrations,
  inspectLedger,
  readAppliedMigrations,
  readMigrationSet,
  readSchemaVersion,
} from '../../src/db/commands/migrations';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../src/db/schema/meta';
import { useTestDatabase } from '../helpers/db';
import { EMPTY_DATABASE } from './support';

const db = useTestDatabase({ template: EMPTY_DATABASE });

async function publicTables(): Promise<string[]> {
  const { rows } = await db
    .ownerPool()
    .query<{ tablename: string }>("SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1");
  return rows.map((row) => row.tablename);
}

describe('AC-B-01: the migration set on an empty database', () => {
  // REVISED 2026-11-02/03 (RB-9 0035, purge amendment 0036 + reseal correction 0038, credential
  // creation 0037; principal PT GSP): the set grew 34 -> 39 with the operator administration
  // privileges, the audit purge, the first-credential grant and the purge reseal correction.
  // REVISED 2026-11-04/05 (D60 / D61, ratified PT GSP): 39 -> 42 — `0039_four_video_tracks` (the
  // four simultaneous video tracks), `0040_four_audio_channels` (the four numbered microphone
  // channels) and `0041_capture_widening_privileges` (the column UPDATE of the six new selector
  // columns, the companion privilege file the widening itself left out).
  // REVISED 2026-11-05 (KD-46 / DF-30, D22(1), row 91): 42 -> 43 — `0042_capture_config_constraint_repair`
  // (the idempotent repair of the selector key names that an edit of applied 0039/0040 left behind).
  // REVISED 2026-11-05 (DF-28, D22(4), D38 DR-1, D43, row 95): 43 -> 44 — `0043_operator_purge_scope`
  // (the purge keeps the evidence-chain audit types, and the account row, disabled, while they name it).
  it('the set is the forty-four files of dbc-3 §A.1, §B.13, dbc-4 §N.8, errata PE-129a-01, PE-129b-01, PE-0013-01, task 4 schema sets A, B and C, task 4 package X-C, the profile-code CHECK, the alias removal reasons (two steps), the allowed ONVIF ports, the retirement of a capture device, the supervisor revocation (0034), the RB-9 add-user privileges (0035), the audit purge amendment (0036), the credential creation (0037), the purge reseal correction (0038), the four video tracks (0039, D60), the four audio channels (0040, D61), the widening privileges (0041), the KD-46 constraint repair (0042) and the purge scope (0043), in order, with rising journal times', () => {
    expect(INITIAL_MIGRATION_TAGS).toHaveLength(44);
    const files = readMigrationSet();
    expect(files.map((file) => file.tag)).toEqual([...INITIAL_MIGRATION_TAGS]);
    expect(files.map((file) => file.idx)).toEqual(Array.from({ length: INITIAL_MIGRATION_TAGS.length }, (_, index) => index));
    for (let index = 1; index < files.length; index += 1) {
      expect(files[index]?.when ?? 0).toBeGreaterThan(files[index - 1]?.when ?? 0);
    }
    console.info(
      `[w17] migration set in ${MIGRATIONS_FOLDER}\n` +
        files.map((file) => `  ${file.tag}.sql  ${file.bytes} bytes  sha256 ${file.sha256}`).join('\n'),
    );
  });

  it('the clone is empty: no table, no migrator table, no schema version', async () => {
    expect(await publicTables()).toEqual([]);
    expect(await readAppliedMigrations(db.ownerPool())).toBeNull();
    expect(await readSchemaVersion(db.ownerPool())).toBeNull();
    const ledger = await inspectLedger(db.ownerPool());
    expect(ledger.tablePresent).toBe(false);
    expect(ledger.pending).toEqual([...INITIAL_MIGRATION_TAGS]);
    expect(ledger.ok).toBe(true);
  });

  it('first run, as dems_owner: applies the forty-four files and sets schema version 15 (dbc-16)', async () => { // D60/D61 (2026-11-04/05): 39 -> 42 files (0039, 0040, 0041); KD-46 (2026-11-05): 42 -> 43 (0042, no version step); DF-28 (2026-11-05, row 95): 43 -> 44 (0043, no version step)
    const who = await db.ownerPool().query<{ role: string; superuser: boolean }>(
      'SELECT current_user::text AS role, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser',
    );
    expect(who.rows[0]).toEqual({ role: 'dems_owner', superuser: false });

    const started = performance.now();
    const result = await applyMigrations(db.ownerPool());
    const ms = performance.now() - started;

    expect(result.versionBefore).toBeNull();
    expect(result.applied).toEqual([...INITIAL_MIGRATION_TAGS]);
    expect(result.versionAfter).toEqual({ schemaVersion: DB_SCHEMA_VERSION, contractRevision: DB_CONTRACT_REVISION });
    expect(result.versionAfter).toEqual({ schemaVersion: 15, contractRevision: 'dbc-16' });
    // 48 until set 16; REVISED 2026-11-02 (purge amendment, principal PT GSP, 0036): +2 —
    // `audit_purge_ticket` (T-49) and `audit_purge_log` (T-50).
    expect(await publicTables()).toHaveLength(50);

    // The migrator stored each file's hash and journal time, in order.
    const files = readMigrationSet();
    const applied = await readAppliedMigrations(db.ownerPool());
    expect(applied?.map((row) => row.hash)).toEqual(files.map((file) => file.sha256));
    expect(applied?.map((row) => row.createdAt)).toEqual(files.map((file) => file.when));
    console.info(`[w17] first migrate: applied ${result.applied.join(', ')} in ${ms.toFixed(1)} ms; 50 tables`);
  });

  it('second run: applies nothing and changes nothing (MG-10)', async () => {
    const pool = db.ownerPool();
    const before = await readAppliedMigrations(pool);
    const catalogBefore = await pool.query(
      "SELECT count(*) AS objects, max(oid::bigint) AS newest FROM pg_class WHERE relnamespace = 'public'::regnamespace",
    );

    const started = performance.now();
    const result = await applyMigrations(pool);
    const ms = performance.now() - started;

    expect(result.applied).toEqual([]);
    expect(result.versionBefore).toEqual({ schemaVersion: 15, contractRevision: 'dbc-16' });
    expect(result.versionAfter).toEqual({ schemaVersion: 15, contractRevision: 'dbc-16' });
    expect(await readAppliedMigrations(pool)).toEqual(before);
    const catalogAfter = await pool.query(
      "SELECT count(*) AS objects, max(oid::bigint) AS newest FROM pg_class WHERE relnamespace = 'public'::regnamespace",
    );
    expect(catalogAfter.rows).toEqual(catalogBefore.rows);
    expect(result.ledger.entries.map((entry) => entry.state)).toEqual(INITIAL_MIGRATION_TAGS.map(() => 'applied'));
    console.info(`[w17] second migrate: applied 0 migration(s) in ${ms.toFixed(1)} ms; the migrator's table still holds ${before?.length} rows`);
  });

  it('the migrations inserted the two mechanism rows and no dataset row (MG-8)', async () => {
    const pool = db.ownerPool();
    const head = await pool.query('SELECT singleton, seq::int AS seq, hash FROM audit_chain_head');
    expect(head.rows).toEqual([{ singleton: true, seq: 0, hash: '0'.repeat(64) }]);
    const meta = await pool.query('SELECT singleton, schema_version, contract_revision FROM schema_meta');
    expect(meta.rows).toEqual([{ singleton: true, schema_version: 15, contract_revision: 'dbc-16' }]);

    // Since 0018 a hand-written file may also write the two rows of the commissioning permission -
    // into a database that is ALREADY SEEDED only. On this empty one it writes nothing: `permissions`
    // and `role_permissions` are among the 48 tables counted empty below (46 until set 16; +2 with
    // the purge amendment of 0036, REVISED 2026-11-02 principal PT GSP — both purge tables empty
    // on a migrated, unseeded database).
    const tables = (await publicTables()).filter((table) => table !== 'audit_chain_head' && table !== 'schema_meta');
    expect(tables).toHaveLength(48);
    for (const table of tables) {
      const { rows } = await pool.query<{ rows: string }>(`SELECT count(*) AS rows FROM public.${table}`);
      expect(rows[0]?.rows, table).toBe('0');
    }
  });

  it("the migrator's table is in schema drizzle, owned by dems_owner, and closed to the runtime role (D38, OW-5)", async () => {
    const { rows } = await db.ownerPool().query(
      `SELECT n.nspname::text AS schema, c.relname::text AS name, pg_get_userbyid(c.relowner)::text AS owner,
              pg_get_userbyid(n.nspowner)::text AS schema_owner,
              has_schema_privilege('dems_app', 'drizzle', 'USAGE') AS app_usage,
              has_table_privilege('dems_app', c.oid, 'SELECT') AS app_select
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'drizzle' AND c.relkind = 'r'`,
    );
    expect(rows).toEqual([
      { schema: 'drizzle', name: '__drizzle_migrations', owner: 'dems_owner', schema_owner: 'dems_owner', app_usage: false, app_select: false },
    ]);
  });

  // KD-46 / DF-30 (2026-11-05, row 91; D22(1)): the production database was migrated through 0039
  // and 0040 BEFORE commit c7cd3679 appended two keys and two renames to them, so it lacks
  // capture_config_video_03/04_device_id_fkey and keeps the mic_primary/standby key names. This case
  // rebuilds that shape on the migrated clone (the 0042 ledger row removed, the four constraints put
  // back to their pre-c7cd3679 state), proves 0042 brings it to the fresh-install names and
  // definitions, and then runs the file's own text again to prove it changes nothing.
  it('KD-46: a database applied before c7cd3679 is repaired by 0042 to the fresh-install key names, and 0042 is idempotent', async () => {
    const pool = db.ownerPool();
    const keysOf = async (): Promise<{ name: string; definition: string; validated: boolean }[]> =>
      (
        await pool.query<{ name: string; definition: string; validated: boolean }>(
          `SELECT conname::text AS name, pg_get_constraintdef(oid) AS definition, convalidated AS validated
             FROM pg_constraint WHERE conrelid = 'public.capture_config'::regclass AND contype = 'f' ORDER BY conname`,
        )
      ).rows;
    const fresh = await keysOf();
    expect(fresh.map((key) => key.name)).toEqual(
      expect.arrayContaining([
        'capture_config_mic_01_id_fkey',
        'capture_config_mic_02_id_fkey',
        'capture_config_mic_03_id_fkey',
        'capture_config_mic_04_id_fkey',
        'capture_config_video_03_device_id_fkey',
        'capture_config_video_04_device_id_fkey',
      ]),
    );

    const repair = readMigrationSet().find((file) => file.tag === '0042_capture_config_constraint_repair');
    if (repair === undefined) throw new Error('0042_capture_config_constraint_repair is not in the migration set');
    // The production shape (research/12_d5_db_impact.md section 2.2): ledger at 0041, two old names, two keys absent.
    // REVISED 2026-11-05 (row 95): the ledger row of every file from 0042 on goes, not 0042's alone. With
    // 0043 left applied the migrator would SKIP 0042 (its journal time is older than the newest applied
    // row) - and production stands at 0041, so both files are pending there, in this order.
    await pool.query('DELETE FROM drizzle.__drizzle_migrations WHERE created_at >= $1', [String(repair.when)]);
    await pool.query(
      'ALTER TABLE capture_config DROP CONSTRAINT capture_config_video_03_device_id_fkey, DROP CONSTRAINT capture_config_video_04_device_id_fkey',
    );
    await pool.query('ALTER TABLE capture_config RENAME CONSTRAINT capture_config_mic_01_id_fkey TO capture_config_mic_primary_id_fkey');
    await pool.query('ALTER TABLE capture_config RENAME CONSTRAINT capture_config_mic_02_id_fkey TO capture_config_mic_standby_id_fkey');
    const broken = (await keysOf()).map((key) => key.name);
    expect(broken).toEqual(expect.arrayContaining(['capture_config_mic_primary_id_fkey', 'capture_config_mic_standby_id_fkey']));
    expect(broken).not.toContain('capture_config_video_03_device_id_fkey');
    expect(broken).not.toContain('capture_config_video_04_device_id_fkey');
    expect((await inspectLedger(pool)).pending).toEqual(['0042_capture_config_constraint_repair', '0043_operator_purge_scope']);

    const result = await applyMigrations(pool);
    // 0043 applied a second time over its own function replaces it with the same body: a no-op.
    expect(result.applied).toEqual(['0042_capture_config_constraint_repair', '0043_operator_purge_scope']);
    expect(result.versionAfter).toEqual({ schemaVersion: 15, contractRevision: 'dbc-16' });
    expect(await keysOf()).toEqual(fresh);

    // Idempotent: the file's own text over the repaired database is a no-op, and the ledger is current.
    await pool.query(readFileSync(repair.file, 'utf8'));
    expect(await keysOf()).toEqual(fresh);
    expect((await applyMigrations(pool)).applied).toEqual([]);
    console.info(`[kd46] repaired keys: ${fresh.map((key) => key.name).join(', ')}`);
  });
});
