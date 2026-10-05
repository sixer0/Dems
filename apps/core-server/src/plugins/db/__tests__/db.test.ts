// Database pool plugin (plan row W08; spec §7.4; database contract §7.4, §8.5; decision D26):
// the pool is lazy, `ready.database` follows it, and it can be closed and opened again for a
// reset. No test here needs a database: a stand-in pool, or a real pool at a closed port.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type BuildAppOptions } from '../../../app';
import { Secret } from '../../../config';
import { CLOSED_PORT, captureLog, createFakePool, unitTestConfig } from '../../../../test/support/config';
import { BootError } from '../../readiness';
import {
  BOOT_STEP_DATABASE_ANSWERS,
  PROBE_REUSE_MS,
  RUNTIME_SEARCH_PATH,
  SEARCH_PATH_QUESTION,
  createRuntimePool,
  removeDriverEnvironment,
} from '../index';

const PASSWORD_MARKER = 'pw-MARKER-d41b07';

const apps: FastifyInstance[] = [];
const dirs: string[] = [];

async function readyApp(options: Partial<BuildAppOptions> = {}): Promise<FastifyInstance> {
  const app = buildApp({ config: unitTestConfig(), ...options });
  apps.push(app);
  await app.ready();
  return app;
}

function refusing(code: string): (text: string) => Promise<never> {
  return async () => {
    throw Object.assign(new Error(`connect ${code} ${PASSWORD_MARKER}`), { code });
  };
}

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('the pool is lazy', () => {
  it('building and readying the app sends nothing to the database', async () => {
    const fake = createFakePool();
    const app = await readyApp({ createPool: () => fake.pool });
    expect(fake.queries).toEqual([]);
    expect(app.db.pool).toBe(fake.pool);
    expect(app.db.generation).toBe(1);
    expect(app.readiness.snapshot().database).toBe(false);
  });

  it('the real pool is created from the five fields and connects to nothing by itself', () => {
    const { database } = unitTestConfig();
    const pool = createRuntimePool(database);
    expect(pool).toBeInstanceOf(Pool);
    expect(pool.options).toMatchObject({
      host: '127.0.0.1',
      port: CLOSED_PORT,
      database: 'dems_unit_test',
      user: 'dems_app',
      ssl: false,
      application_name: 'dems-core-server',
    });
    expect(pool.totalCount).toBe(0);
    return pool.end();
  });

  it('the pool keeps no printable copy of the password', () => {
    const pool = createRuntimePool({ ...unitTestConfig().database, password: new Secret(PASSWORD_MARKER) });
    expect(JSON.stringify(pool.options)).not.toContain(PASSWORD_MARKER);
    expect(Object.values(pool.options)).not.toContain(PASSWORD_MARKER);
    return pool.end();
  });
});

describe('probe() and ready.database', () => {
  it('a database that answers sets the flag; the statement is SELECT 1', async () => {
    const fake = createFakePool();
    const app = await readyApp({ createPool: () => fake.pool });
    await expect(app.db.probe()).resolves.toBe(true);
    expect(fake.queries).toEqual(['SELECT 1']);
    expect(app.readiness.snapshot().database).toBe(true);
  });

  it('a database that does not answer leaves the flag off and never throws', async () => {
    const app = await readyApp({ createPool: () => createFakePool(refusing('ECONNREFUSED')).pool });
    await expect(app.db.probe()).resolves.toBe(false);
    expect(app.readiness.snapshot().database).toBe(false);
  });

  it('a real pool pointed at a closed port: false, quickly, and the process stays up', async () => {
    const app = await readyApp();
    const started = performance.now();
    await expect(app.db.probe()).resolves.toBe(false);
    expect(performance.now() - started).toBeLessThan(3000);
    expect(app.readiness.snapshot().database).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
  });

  it('a result is reused for one second, and concurrent probes share one statement', async () => {
    const fake = createFakePool();
    const app = await readyApp({ createPool: () => fake.pool });
    await Promise.all([app.db.probe(), app.db.probe(), app.db.probe()]);
    await app.db.probe();
    expect(fake.queries).toHaveLength(1);
    await app.db.probe({ fresh: true });
    expect(fake.queries).toHaveLength(2);
    expect(PROBE_REUSE_MS).toBe(1000);
  });

  it('follows the database: off when it stops, on again when it is back', async () => {
    let up = true;
    const fake = createFakePool(async () => {
      if (!up) throw Object.assign(new Error('terminating connection'), { code: '57P01' });
      return { rows: [] };
    });
    const app = await readyApp({ createPool: () => fake.pool });
    expect(await app.db.probe({ fresh: true })).toBe(true);
    up = false;
    expect(await app.db.probe({ fresh: true })).toBe(false);
    expect(app.readiness.snapshot().database).toBe(false);
    up = true;
    expect(await app.db.probe({ fresh: true })).toBe(true);
    expect(app.readiness.snapshot().database).toBe(true);
  });

  it("an error on an idle connection sets the flag off at once and does not end the process", async () => {
    const fake = createFakePool();
    const app = await readyApp({ createPool: () => fake.pool });
    await app.db.probe();
    expect(app.readiness.snapshot().database).toBe(true);
    fake.emitError(Object.assign(new Error('Connection terminated unexpectedly'), { code: 'ECONNRESET' }));
    expect(app.readiness.snapshot().database).toBe(false);
  });

  it('a failure is logged and persisted by its code, once per outage, without the driver message', async () => {
    const log = captureLog();
    const dir = mkdtempSync(join(tmpdir(), 'dems-w08-db-'));
    dirs.push(dir);
    const errorLogFile = join(dir, 'errors.log');
    const app = await readyApp({
      config: unitTestConfig({ logLevel: 'info' }),
      logStream: log.stream,
      errorLogFile,
      createPool: () => createFakePool(refusing('ECONNREFUSED')).pool,
    });
    await app.db.probe({ fresh: true });
    await app.db.probe({ fresh: true });
    await app.db.probe({ fresh: true });

    const warnings = log.lines().filter((line) => line.msg === 'the database does not answer');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ level: 40, code: 'ECONNREFUSED' });
    const persisted = readFileSync(errorLogFile, 'utf8');
    expect(persisted.split('\n').filter((row) => row !== '')).toHaveLength(1);
    expect(JSON.parse(persisted)).toMatchObject({
      level: 'warn',
      source: 'db.probe',
      code: 'ECONNREFUSED',
      context: { database: 'dems_unit_test', generation: 1 },
    });
    expect(log.text() + persisted).not.toContain(PASSWORD_MARKER);
  });
});

describe('connectionLost(): a holder of a connection lost it (checkpoint CP-B1, finding CPB1-6)', () => {
  it('sets the flag off at once, forgets the last probe result and starts a probe; the flag is on again when the database answers', async () => {
    const log = captureLog();
    const fake = createFakePool();
    const app = await readyApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream });
    expect(await app.db.probe()).toBe(true);
    expect(fake.queries).toHaveLength(1);

    app.db.connectionLost();
    // At once, before any answer of the database: the flag is off and a probe is under way.
    expect(app.readiness.snapshot().database).toBe(false);
    expect(fake.queries).toEqual(['SELECT 1', 'SELECT 1']);
    // The answer of a moment ago is not reused, although it is younger than a second.
    await expect(app.db.probe()).resolves.toBe(false);
    // The probe that was started with the loss answers: the flag follows it, with no statement more.
    for (let attempt = 0; attempt < 100 && !app.readiness.snapshot().database; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(app.readiness.snapshot().database).toBe(true);
    expect(fake.queries).toEqual(['SELECT 1', 'SELECT 1']);
    const flags = log
      .lines()
      .filter((line) => line.msg === 'readiness changed' && line.part === 'database')
      .map((line) => line.ready);
    expect(flags).toEqual([true, false, true]);
  });

  it('while the database stays away the flag stays off; on a closed pool it does nothing', async () => {
    let up = true;
    const fake = createFakePool(async () => {
      if (!up) throw Object.assign(new Error(`connect ECONNREFUSED ${PASSWORD_MARKER}`), { code: 'ECONNREFUSED' });
      return { rows: [] };
    });
    const app = await readyApp({ createPool: () => fake.pool });
    expect(await app.db.probe()).toBe(true);
    up = false;
    app.db.connectionLost();
    await expect(app.db.probe({ fresh: true })).resolves.toBe(false);
    expect(app.readiness.snapshot().database).toBe(false);

    await app.db.close();
    const sent = fake.queries.length;
    app.db.connectionLost();
    await expect(app.db.probe({ fresh: true })).resolves.toBe(false);
    expect(fake.queries).toHaveLength(sent);
  });
});

describe('close() and reopen() (reset steps R-1 and R-9)', () => {
  it('close() ends the pool, sets the flag off, and probe() then gives false without a statement', async () => {
    const fake = createFakePool();
    const app = await readyApp({ createPool: () => fake.pool });
    await app.db.probe();
    await app.db.close();
    await app.db.close();
    expect(fake.ended()).toBe(1);
    expect(app.readiness.snapshot().database).toBe(false);
    await expect(app.db.probe({ fresh: true })).resolves.toBe(false);
    expect(fake.queries).toHaveLength(1);
  });

  it('reopen() creates a new pool from the same configuration and raises the generation', async () => {
    const fakes = [createFakePool(), createFakePool()];
    const seen: string[] = [];
    let created = 0;
    const app = await readyApp({
      createPool: (connection) => {
        seen.push(`${connection.host}:${connection.port}/${connection.database} as ${connection.user}`);
        const fake = fakes[created];
        created += 1;
        if (fake === undefined) throw new Error('unexpected third pool');
        return fake.pool;
      },
    });
    const first = app.db.pool;
    await app.db.probe();
    await app.db.reopen();
    expect(fakes[0]?.ended()).toBe(1);
    expect(app.db.pool).not.toBe(first);
    expect(app.db.pool).toBe(fakes[1]?.pool);
    expect(app.db.generation).toBe(2);
    expect(app.readiness.snapshot().database).toBe(false);
    await expect(app.db.probe()).resolves.toBe(true);
    expect(fakes[1]?.queries).toEqual(['SELECT 1']);
    expect(seen).toEqual([
      '127.0.0.1:1/dems_unit_test as dems_app',
      '127.0.0.1:1/dems_unit_test as dems_app',
    ]);
  });

  it('closing the app closes the pool', async () => {
    const fake = createFakePool();
    const app = buildApp({ config: unitTestConfig(), createPool: () => fake.pool });
    await app.ready();
    await app.close();
    expect(fake.ended()).toBe(1);
  });

  it('a real closed pool: every query is rejected and health still answers 200', async () => {
    const app = await readyApp();
    await app.db.close();
    await expect(app.db.pool.query('SELECT 1')).rejects.toThrow();
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { ready: { database: boolean } }).ready.database).toBe(false);
  });
});

describe('boot step B-1', () => {
  it('passes when the database answers and sets the flag', async () => {
    const log = captureLog();
    // By-design change (decision D87, finding F53): B-1 has a second half, the search path of a
    // pooled connection, so the stand-in answers that question as a database does.
    const fake = createFakePool(async (text) => (text === SEARCH_PATH_QUESTION ? { rows: [{ search_path: RUNTIME_SEARCH_PATH }] } : { rows: [] }));
    const app = await readyApp({
      config: unitTestConfig({ logLevel: 'info' }),
      createPool: () => fake.pool,
      logStream: log.stream,
    });
    // By-design change (decision D40, plan row W21): the core services register the boot checks
    // B-2 to B-9 after B-1, and a stand-in pool answers none of them. So B-1 passes, as before,
    // and the boot then stops at B-2 instead of ending.
    const error = await app.readiness.boot().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe('B-2');
    expect(
      log
        .lines()
        .filter((line) => line.msg === 'boot step passed')
        .map((line) => line.step),
    ).toEqual([BOOT_STEP_DATABASE_ANSWERS]);
    expect(app.readiness.snapshot().database).toBe(true);
    // B-1 is two statements on the pool: the probe, then the search path.
    expect(fake.queries.slice(0, 2)).toEqual(['SELECT 1', SEARCH_PATH_QUESTION]);
  });

  it('stops the boot, by its ID, when the database does not answer', async () => {
    const app = await readyApp({ createPool: () => createFakePool(refusing('ECONNREFUSED')).pool });
    const error = await app.readiness.boot().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe(BOOT_STEP_DATABASE_ANSWERS);
    expect(BOOT_STEP_DATABASE_ANSWERS).toBe('B-1');
  });
});

describe('removeDriverEnvironment (decision D26)', () => {
  it('removes every variable the driver would read on its own and returns the names only', () => {
    const driver = (suffix: string): string => `PG${suffix}`;
    const env: Record<string, string | undefined> = {
      [driver('HOST')]: 'db.example',
      [driver('PORT')]: '1',
      [driver('SSLMODE')]: 'require',
      [driver('OPTIONS')]: '-c x=1',
      DEMS_CORE_PORT: '4421',
      DEMS_PG_HOST: 'kept: the project prefix is not the driver prefix',
      PATH: '/usr/bin',
    };
    const removed = removeDriverEnvironment(env);
    expect(removed.sort()).toEqual(['HOST', 'OPTIONS', 'PORT', 'SSLMODE'].map(driver).sort());
    expect(Object.keys(env).sort()).toEqual(['DEMS_CORE_PORT', 'DEMS_PG_HOST', 'PATH']);
    expect(removeDriverEnvironment(env)).toEqual([]);
  });
});
