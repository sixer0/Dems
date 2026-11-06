/**
 * Test support (not a test file): the body of the two isolation test files, which differ only
 * in the marker they write (database contract §10.2, test ideas T-TI-1 and T-TI-3).
 *
 * Each file gets its own clone of the helper's private one-table template through
 * `useTestDatabase`, exactly as a module row's test file does. Both files write a row with THE
 * SAME token hash, as the runtime role, and each must then see one row: its own.
 */
import { describe, expect, it } from 'vitest';
import { APP_ROLE, LOG_PREFIX, OWNER_ROLE } from '../constants';
import { errorCode } from '../errors';
import { providedRun, useTestDatabase } from '../index';
import { PROBE_TABLE, SELFTEST_TEMPLATE } from './probe-hooks';

/** The same key in both files: in one shared database the second insert would fail. */
export const SAME_TOKEN_HASH = 'sha256:9f2c1b7e-the-same-in-both-files';

async function sqlState(work: Promise<unknown>): Promise<string | undefined> {
  try {
    await work;
  } catch (error) {
    return errorCode(error);
  }
  return 'NO_ERROR';
}

export function defineIsolationSuite(marker: string): void {
  const db = useTestDatabase({ template: SELFTEST_TEMPLATE });

  describe(`T-TI-1: one database per test file (${marker})`, () => {
    it('the file has its own clone, named by the scheme of TI-2', async () => {
      const run = providedRun();
      expect(db.name.startsWith(run.prefix)).toBe(true);
      expect(db.name).toMatch(new RegExp(`^dems_test_(?:local|step_[a-z0-9]{1,12})_[0-9a-z]{8}_f[0-9]{2}_${marker}$`));
      expect(Buffer.byteLength(db.name)).toBeLessThanOrEqual(63);
      const rows = await db.appPool().query<{ db: string }>('SELECT current_database()::text AS db');
      expect(rows.rows[0]?.db).toBe(db.name);
      console.log(
        `${LOG_PREFIX} ${marker}: clone ${db.name} in ${Math.round(db.timings.cloneMs)} ms ` +
          `(waited ${Math.round(db.timings.lockWaitMs)} ms for the clone lock)`,
      );
    });

    it('the code under test is dems_app: no superuser, no create-database, not the owner', async () => {
      const rows = await db.appPool().query<{ role: string; superuser: boolean; createdb: boolean; setting: string }>(
        'SELECT current_user::text AS role, r.rolsuper AS superuser, r.rolcreatedb AS createdb, ' +
          "current_setting('is_superuser') AS setting FROM pg_roles r WHERE r.rolname = current_user",
      );
      expect(rows.rows[0]).toEqual({ role: APP_ROLE, superuser: false, createdb: false, setting: 'off' });
      expect(db.runtime).toMatchObject({ host: '127.0.0.1', port: 4432, database: db.name, user: APP_ROLE });
      // The connection the helper hands out cannot print its password.
      expect(JSON.stringify(db.runtime)).toContain('[redacted]');
    });

    it('writes the same token hash as the other file and sees only its own row', async () => {
      const app = db.appPool();
      await app.query(`INSERT INTO ${PROBE_TABLE} (token_hash, origin) VALUES ($1, $2)`, [SAME_TOKEN_HASH, marker]);
      const rows = await app.query(`SELECT token_hash, origin, written_by FROM ${PROBE_TABLE} ORDER BY origin`);
      expect(rows.rows).toEqual([{ token_hash: SAME_TOKEN_HASH, origin: marker, written_by: APP_ROLE }]);
      // In this database the key is taken: the clone is a real database, not a view of a shared one.
      expect(await sqlState(app.query(`INSERT INTO ${PROBE_TABLE} (token_hash, origin) VALUES ($1, $2)`, [SAME_TOKEN_HASH, 'again']))).toBe('23505');
    });

    it('the privileges of the template came with the clone, and nothing more (OW-7)', async () => {
      const app = db.appPool();
      // Granted by the one-table migration: SELECT and INSERT. Not granted: everything else.
      expect(await sqlState(app.query(`UPDATE ${PROBE_TABLE} SET origin = 'x'`))).toBe('42501');
      expect(await sqlState(app.query(`DELETE FROM ${PROBE_TABLE}`))).toBe('42501');
      expect(await sqlState(app.query(`TRUNCATE ${PROBE_TABLE}`))).toBe('42501');
      expect(await sqlState(app.query('CREATE TABLE not_allowed (id int)'))).toBe('42501');
      expect(await sqlState(app.query(`DROP TABLE ${PROBE_TABLE}`))).toBe('42501');
      const owner = await db.ownerPool().query<{ owner: string }>(
        'SELECT r.rolname::text AS owner FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE c.relname = $1',
        [PROBE_TABLE],
      );
      expect(owner.rows).toEqual([{ owner: OWNER_ROLE }]);
    });
  });

  describe(`T-TI-3: owners and roles (${marker})`, () => {
    it('pg_database.datdba is dems_owner for the template and for every clone of the run', async () => {
      const databases = await db.run.listDatabases();
      const template = databases.find((row) => row.name.endsWith('tpl_x_selftest'));
      const clone = databases.find((row) => row.name === db.name);
      expect(template).toMatchObject({ owner: OWNER_ROLE, isTemplate: true, allowConnections: false });
      expect(clone).toMatchObject({ owner: OWNER_ROLE, isTemplate: false, allowConnections: true });
      expect(databases.every((row) => row.owner === OWNER_ROLE)).toBe(true);
      expect(databases.every((row) => row.name.startsWith(providedRun().prefix))).toBe(true);
      const table = databases
        .map((row) => `  ${row.name}  datdba=${row.owner}  template=${row.isTemplate}  connections=${row.allowConnections}`)
        .join('\n');
      console.log(`${LOG_PREFIX} ${marker}: pg_database of the run while the file runs\n${table}`);
    });

    it('the sessions on the databases of the run are dems_owner and dems_app only', async () => {
      await db.appPool().query('SELECT 1');
      await db.ownerPool().query('SELECT 1');
      const roles = await db.run.sessionRoles();
      expect(roles).toContain(APP_ROLE);
      expect(roles.every((role) => role === APP_ROLE || role === OWNER_ROLE)).toBe(true);
      const mine = await db.ownerPool().query<{ role: string }>(
        'SELECT DISTINCT usename::text AS role FROM pg_stat_activity WHERE datname = current_database() AND usename IS NOT NULL ORDER BY 1',
      );
      expect(mine.rows.map((row) => row.role)).toEqual([APP_ROLE, OWNER_ROLE]);
    });
  });
}
