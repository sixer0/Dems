// The search path of the runtime pool against the real PostgreSQL, as `dems_app` (checkpoint
// CP-B1, finding CPB1-3; finding F53, decision D87).
//
//   - every connection the runtime pool opens has `search_path = public,pg_temp`, and the server
//     reports exactly that text;
//   - on such a connection a temporary table called like a real one is NOT found by the bare
//     name: the real table is (a read on the pool, outside any unit of work);
//   - boot step B-1 passes for the runtime pool and stops the boot, by its code, for a pool that
//     was built without the start-up option;
//   - the start-up option wins over a default that is stored for the database.
//
// Everything runs on clones of this file's run.
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { runtimePool } from '../../../../test/db/support';
import { useTestDatabase, type TestDatabase } from '../../../../test/helpers/db';
import { buildApp } from '../../../app';
import type { DatabaseConnection } from '../../../config';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { BootError } from '../../readiness';
import { RUNTIME_SEARCH_PATH, SEARCH_PATH_NOT_PINNED, createRuntimePool } from '../index';

const db = useTestDatabase({ template: 'schema' });

const pathOf = async (pool: Pick<Pool, 'query'>): Promise<string | undefined> =>
  (await pool.query<{ path: string }>("SELECT current_setting('search_path') AS path")).rows[0]?.path;

/** The runtime pool of the server on `target`, closed before the clone is dropped. */
function serverPool(target: { runtime: DatabaseConnection; onCleanup(close: () => Promise<unknown>): void }): Pool {
  const pool = createRuntimePool(target.runtime);
  pool.on('error', () => undefined);
  target.onCleanup(() => pool.end());
  return pool;
}

async function bootOn(target: TestDatabase, createPool?: (connection: DatabaseConnection) => Pool) {
  const log = captureLog();
  const app: FastifyInstance = buildApp({
    config: unitTestConfig({ database: db.run.connectionOn(target.name, 'app'), dataDir: db.run.dataDir, logLevel: 'info' }),
    logStream: log.stream,
    ...(createPool === undefined ? {} : { createPool }),
  });
  target.onCleanup(() => app.close());
  await app.ready();
  const error: unknown = await app.readiness.boot().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  const passed = log
    .lines()
    .filter((line) => line['msg'] === 'boot step passed')
    .map((line) => line['step']);
  return { app, log, error, passed };
}

describe('every connection of the runtime pool', () => {
  it('has the pinned search path, reported by the server in exactly that text', async () => {
    const pool = serverPool(db);
    // Four connections at the same time: each is opened with the option.
    const clients = await Promise.all([pool.connect(), pool.connect(), pool.connect(), pool.connect()]);
    try {
      const seen = await Promise.all(clients.map(async (client) => ({ pid: Number((await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid), path: await pathOf(client) })));
      expect(new Set(seen.map((entry) => entry.pid)).size).toBe(4);
      expect(seen.map((entry) => entry.path)).toEqual(Array.from({ length: 4 }, () => RUNTIME_SEARCH_PATH));
      expect(RUNTIME_SEARCH_PATH).toBe('public,pg_temp');
      // It is the default of the SESSION: a transaction that changes it locally gets it back.
      const [client] = clients;
      await client?.query('BEGIN');
      await client?.query("SET LOCAL search_path = 'pg_temp'");
      await client?.query('ROLLBACK');
      expect(client === undefined ? undefined : await pathOf(client)).toBe(RUNTIME_SEARCH_PATH);
    } finally {
      for (const client of clients) client.release();
    }
  });

  it('finds the real table by its bare name although a temporary table of that name is on the connection', async () => {
    const pool = serverPool(db);
    const client = await pool.connect();
    try {
      await client.query('CREATE TEMP TABLE audit_log (LIKE public.audit_log)');
      await client.query('CREATE TEMP TABLE events (LIKE public.events)');
      const named = await client.query<{ audit: boolean; events: boolean }>(
        "SELECT 'audit_log'::regclass = 'public.audit_log'::regclass AS audit, 'events'::regclass = 'public.events'::regclass AS events",
      );
      expect(named.rows[0]).toEqual({ audit: true, events: true });
      // The temporary tables exist, and are reached only by their schema.
      expect((await client.query("SELECT 'pg_temp.audit_log'::regclass <> 'public.audit_log'::regclass AS other")).rows[0]).toEqual({ other: true });
    } finally {
      client.release(true);
    }
  });

  it('the control: a pool WITHOUT the option has the default path, and there the temporary table is found first', async () => {
    const pool = runtimePool(db.runtime, 1, 'dems-cpb1a-default');
    db.onCleanup(() => pool.end());
    expect(await pathOf(pool)).toBe('"$user", public');
    await pool.query('CREATE TEMP TABLE audit_log (LIKE public.audit_log)');
    expect((await pool.query("SELECT 'audit_log'::regclass = 'public.audit_log'::regclass AS real")).rows[0]).toEqual({ real: false });
  });
});

describe('boot step B-1 against the server', () => {
  it('passes for the runtime pool: the boot goes on to the checks after it', async () => {
    const target = await db.another({ slug: 'path_boot_ok' });
    const { error, passed, log } = await bootOn(target);
    // A migrated clone that was never seeded: the boot stops later, at B-6. B-1 passed.
    expect((error as BootError).stepId).toBe('B-6');
    expect(passed.slice(0, 1)).toEqual(['B-1']);
    expect(log.lines().some((line) => line['code'] === SEARCH_PATH_NOT_PINNED)).toBe(false);
  });

  it('stops the boot for a pool that was built without the option: B-1, SEARCH_PATH_NOT_PINNED, and what was found', async () => {
    const target = await db.another({ slug: 'path_boot_default' });
    const { app, error, passed, log } = await bootOn(target, (connection) => runtimePool(connection, 2, 'dems-cpb1a-boot'));
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe('B-1');
    expect((error as BootError).cause).toMatchObject({ name: 'DatabaseBootError', code: SEARCH_PATH_NOT_PINNED });
    expect(passed).toEqual([]);
    expect(log.lines().find((line) => line['msg'] === 'boot check failed')).toMatchObject({
      level: 50,
      step: 'B-1',
      code: SEARCH_PATH_NOT_PINNED,
      expected: 'public,pg_temp',
      found: '"$user", public',
    });
    expect(app.readiness.isReady()).toBe(false);
    expect(app.server.listening).toBe(false);
  });

  it('stops the boot for a pool whose option names the temporary schema first', async () => {
    const target = await db.another({ slug: 'path_boot_first' });
    const { error, log } = await bootOn(
      target,
      (connection) =>
        new Pool({
          host: connection.host,
          port: connection.port,
          database: connection.database,
          user: connection.user,
          password: () => connection.password.reveal(),
          ssl: false,
          application_name: 'dems-cpb1a-first',
          options: '-c search_path=pg_temp,public',
          max: 2,
        }),
    );
    expect((error as BootError).stepId).toBe('B-1');
    expect(log.lines().find((line) => line['msg'] === 'boot check failed')).toMatchObject({ code: SEARCH_PATH_NOT_PINNED, found: 'pg_temp,public' });
  });
});

describe('a default that is stored for the database', () => {
  it('does not reach a connection of the runtime pool: the start-up option of the client wins', async () => {
    const target = await db.another({ slug: 'path_db_default' });
    // On this clone only, as its owner: a default that puts the temporary schema first. No role
    // and no setting of the server is touched; the default goes with the clone.
    await target.ownerPool().query(`ALTER DATABASE "${target.name}" SET search_path = pg_temp, public`);

    const plain = runtimePool(db.run.connectionOn(target.name, 'app'), 1, 'dems-cpb1a-dbdefault');
    target.onCleanup(() => plain.end());
    expect(await pathOf(plain)).toBe('pg_temp, public');

    const pool = serverPool({ runtime: db.run.connectionOn(target.name, 'app'), onCleanup: (close) => target.onCleanup(close) });
    expect(await pathOf(pool)).toBe(RUNTIME_SEARCH_PATH);

    // And the boot check sees the same on the app's own pool.
    const { error, passed } = await bootOn(target);
    expect((error as BootError).stepId).toBe('B-6');
    expect(passed.slice(0, 1)).toEqual(['B-1']);
  });
});
