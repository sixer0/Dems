// `app.db.read(source, work)`, database-free (checkpoint CP-B1, finding CPB1-8; spec §2.3 stage
// 9, ENG-5; standing rule M5): a read on the pool outside a unit of work. A read that fails is
// the database's failure: 503 `NOT_READY`, one error line and one persistent entry by its code,
// and readiness follows the pool. The block existed twice, in the identity module and in the
// RBAC module; this is the one the pool plugin offers.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DrizzleQueryError } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { captureLog, createFakePool, unitTestConfig } from '../../../../test/support/config';
import { ApiFailure } from '../../error-envelope';

const MARK = 'MARK-statement-text-7c2d';

const apps: FastifyInstance[] = [];
const dirs: string[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function appWith(answer?: (text: string) => Promise<unknown>, beforeReady: (app: FastifyInstance) => void = () => {}) {
  const log = captureLog();
  const dir = mkdtempSync(join(tmpdir(), 'dems-cpb1a-read-'));
  dirs.push(dir);
  const errorLogFile = join(dir, 'errors.log');
  const fake = createFakePool(answer);
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream, errorLogFile });
  apps.push(app);
  beforeReady(app);
  await app.ready();
  const persisted = (): Array<Record<string, unknown>> => {
    try {
      return readFileSync(errorLogFile, 'utf8')
        .split('\n')
        .filter((row) => row !== '')
        .map((row) => JSON.parse(row) as Record<string, unknown>);
    } catch {
      return [];
    }
  };
  return { app, log, fake, persisted };
}

const caught = <T>(work: Promise<T>): Promise<unknown> =>
  work.then(
    () => null,
    (error: unknown) => error,
  );

describe('a read that succeeds', () => {
  it('gets the current pool and returns what the work returned; nothing is logged and nothing is probed', async () => {
    const { app, fake, log, persisted } = await appWith(async (text) => ({ rows: [{ text }] }));
    let given: Pool | undefined;
    const rows = await app.db.read('test.read', async (pool) => {
      given = pool;
      return (await pool.query('SELECT name FROM public.roles')).rows;
    });
    expect(given).toBe(app.db.pool);
    expect(rows).toEqual([{ text: 'SELECT name FROM public.roles' }]);
    expect(fake.queries).toEqual(['SELECT name FROM public.roles']);
    expect(log.lines().filter((line) => Number(line['level']) >= 40)).toEqual([]);
    expect(persisted()).toEqual([]);
  });

  it('after a reopen the work gets the new pool', async () => {
    const fakes = [createFakePool(), createFakePool()];
    let created = 0;
    const app = buildApp({ config: unitTestConfig(), createPool: () => (fakes[created++] ?? createFakePool()).pool });
    apps.push(app);
    await app.ready();
    await app.db.reopen();
    await app.db.read('test.read', (pool) => pool.query('SELECT 1'));
    expect(fakes[0]?.queries).toEqual([]);
    expect(fakes[1]?.queries).toEqual(['SELECT 1']);
  });
});

describe('a read that fails', () => {
  it('rejects with 503 NOT_READY; one error line and one persistent entry by the code; the probe follows', async () => {
    let up = true;
    const { app, log, fake, persisted } = await appWith(async (text) => {
      if (!up) throw Object.assign(new Error(`terminating connection due to administrator command ${MARK}`), { code: '57P01' });
      return { rows: [{ text }] };
    });
    expect(await app.db.probe({ fresh: true })).toBe(true);
    up = false;

    const error = await caught(app.db.read('identity.findSession', (pool) => pool.query(`SELECT '${MARK}'`)));
    expect(error).toBeInstanceOf(ApiFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', message: 'The server is not ready. Try again shortly.' });
    // The envelope's own refusal: it carries nothing of the failure.
    expect((error as ApiFailure).cause).toBeUndefined();
    expect((error as ApiFailure).details).toBeUndefined();

    const line = log.lines().find((entry) => entry['msg'] === 'a read on the pool failed');
    expect(line).toMatchObject({ level: 50, source: 'identity.findSession', err: { type: 'Error', code: '57P01', message: '57P01' } });
    expect(persisted().filter((entry) => entry['message'] === 'a read on the pool failed')).toHaveLength(1);
    expect(persisted().find((entry) => entry['message'] === 'a read on the pool failed')).toMatchObject({
      level: 'error',
      source: 'identity.findSession',
      errorName: 'Error',
      code: '57P01',
      context: { database: 'dems_unit_test', generation: 1 },
    });

    // Readiness follows the pool: the probe that the read started finds the database away.
    expect(await app.db.probe()).toBe(false);
    expect(app.readiness.snapshot().database).toBe(false);
    expect(fake.queries.filter((text) => text === 'SELECT 1')).toHaveLength(2);
    expect(log.text() + JSON.stringify(persisted())).not.toContain(MARK);

    up = true;
    await expect(app.db.read('identity.findSession', (pool) => pool.query('SELECT 2'))).resolves.toMatchObject({ rows: [{ text: 'SELECT 2' }] });
  });

  it('a failure the query builder wrapped: the SQLSTATE of the driver is in the line, the statement is not', async () => {
    const { app, log, persisted } = await appWith();
    const driver = Object.assign(new Error(`relation does not exist ${MARK}`), { code: '42P01' });
    const error = await caught(
      app.db.read('rbac.getRoleMatrix', async () => {
        throw new DrizzleQueryError(`select '${MARK}' from "roles"`, [MARK], driver);
      }),
    );
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    expect(log.lines().find((entry) => entry['msg'] === 'a read on the pool failed')).toMatchObject({ source: 'rbac.getRoleMatrix', err: { code: '42P01' } });
    expect(persisted()[0]).toMatchObject({ source: 'rbac.getRoleMatrix', code: '42P01' });
    expect(log.text() + JSON.stringify(persisted())).not.toContain(MARK);
  });

  it('a refusal the work throws passes unchanged: it is an answer, not a failure of the database', async () => {
    const { app, log, fake, persisted } = await appWith();
    const refusal = new ApiFailure(404, 'NOT_FOUND', 'No such session.');
    const error = await caught(
      app.db.read('test.read', async () => {
        throw refusal;
      }),
    );
    expect(error).toBe(refusal);
    expect(log.lines().some((entry) => entry['msg'] === 'a read on the pool failed')).toBe(false);
    expect(persisted()).toEqual([]);
    expect(fake.queries).toEqual([]);
  });

  it('a closed pool: 503, and the probe leaves the flag off', async () => {
    const app = buildApp({ config: unitTestConfig() });
    apps.push(app);
    await app.ready();
    await app.db.close();
    const error = await caught(app.db.read('test.read', (pool) => pool.query('SELECT 1')));
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    expect(await app.db.probe()).toBe(false);
  });

  it('in a handler: the request answers 503 with the envelope, and no "unexpected error" is written', async () => {
    const log = captureLog();
    const fake = createFakePool(async (text) => {
      if (text === 'SELECT 1') return { rows: [] };
      throw Object.assign(new Error(`connection failure ${MARK}`), { code: '08006' });
    });
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream });
    apps.push(app);
    app.get('/api/v1/scratch/read', async () => app.db.read('scratch.read', (pool) => pool.query('SELECT name FROM public.roles')));
    await app.ready();
    for (const stage of ['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule'] as const) app.stages.replace(stage, () => {});
    const response = await app.inject({ method: 'GET', url: '/api/v1/scratch/read' });
    expect(response.statusCode).toBe(503);
    expect((response.json() as { error: { code: string } }).error.code).toBe('NOT_READY');
    expect(log.lines().some((entry) => entry['msg'] === 'unexpected error while handling a request')).toBe(false);
    expect(log.lines().find((entry) => entry['msg'] === 'a read on the pool failed')).toMatchObject({ source: 'scratch.read', err: { code: '08006' } });
    expect(log.text()).not.toContain(MARK);
  });
});

describe('the request a read belongs to (fix round B1, finding F-3; fix round B2b item 7)', () => {
  const failing = async (): Promise<never> => {
    throw Object.assign(new Error(`terminating connection ${MARK}`), { code: '57P01' });
  };

  it('with a request: the line is written with the request\'s logger and carries its request ID; the entry holds it as context.requestId', async () => {
    let read: unknown;
    // A scratch route, added before `ready()`. It is no registry operation, so stage 6 is taken out.
    const { app, log, persisted } = await appWith(failing, (instance) => {
      instance.stages.replace('accessRule', () => {});
      instance.get('/api/v1/test/read', async (request) => {
        read = await caught(instance.db.read('test.withRequest', (pool) => pool.query('SELECT 1'), request));
        return { requestId: request.id };
      });
    });
    app.readiness.set('database', true);
    app.readiness.set('engine', true);
    const response = await app.inject({ method: 'GET', url: '/api/v1/test/read' });
    expect(response.statusCode).toBe(200);
    const { requestId } = response.json<{ requestId: string }>();

    expect(read).toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    const lines = log.lines().filter((entry) => entry['msg'] === 'a read on the pool failed');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 50, source: 'test.withRequest', reqId: requestId, err: { code: '57P01' } });
    const entries = persisted().filter((entry) => entry['source'] === 'test.withRequest');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ level: 'error', message: 'a read on the pool failed', code: '57P01', context: { database: 'dems_unit_test', generation: 1, requestId } });
    expect(log.text() + JSON.stringify(persisted())).not.toContain(MARK);
  });

  it('without one (a lookup of stage 4, a sweep, a reset): the app\'s logger, no request ID in the line, no requestId in the entry', async () => {
    const { app, log, persisted } = await appWith(failing);
    expect(await caught(app.db.read('test.withoutRequest', (pool) => pool.query('SELECT 1')))).toMatchObject({ statusCode: 503 });
    const line = log.lines().find((entry) => entry['msg'] === 'a read on the pool failed');
    expect(line).toMatchObject({ level: 50, source: 'test.withoutRequest', err: { code: '57P01' } });
    expect(Object.keys(line ?? {})).not.toContain('reqId');
    const entry = persisted().find((candidate) => candidate['source'] === 'test.withoutRequest');
    expect(entry?.['context']).toEqual({ database: 'dems_unit_test', generation: 1 });
  });

  it('the context is the request\'s ID and its logger, and nothing else of it is read', async () => {
    const { app, persisted } = await appWith(failing);
    const written: Array<[unknown, unknown]> = [];
    const touched: string[] = [];
    const context = new Proxy(
      { id: 'req-test-0001', log: { error: (merge: unknown, text: unknown) => void written.push([merge, text]) } },
      {
        get(target, member, receiver) {
          touched.push(String(member));
          return Reflect.get(target, member, receiver) as unknown;
        },
      },
    );
    await caught(app.db.read('test.context', (pool) => pool.query('SELECT 1'), context as unknown as Parameters<typeof app.db.read>[2]));
    expect([...new Set(touched)].sort()).toEqual(['id', 'log']);
    expect(written).toHaveLength(1);
    expect(written[0]?.[0]).toMatchObject({ source: 'test.context' });
    expect(written[0]?.[1]).toBe('a read on the pool failed');
    expect(persisted().find((candidate) => candidate['source'] === 'test.context')).toMatchObject({ context: { requestId: 'req-test-0001' } });
  });
});
