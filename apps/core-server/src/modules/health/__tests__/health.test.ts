// Health operation (plan row W08; spec §7.4; AC-B-08 in unit form): `GET /api/v1/health`
// answers 200 for as long as the process answers; `ready` says what is usable. Every answer is
// checked against the shared `HealthResponseSchema`. No database is needed: a stand-in pool, or
// a real pool pointed at a closed port.
import { CORE_API_OPERATIONS, HEALTH_PATH, HealthResponseSchema } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type BuildAppOptions } from '../../../app';
import manifest from '../../../../package.json' with { type: 'json' };
import { createFakePool, unitTestConfig } from '../../../../test/support/config';
import { HEALTH_OPERATION_ID, type CoreServerHealth } from '../index';

const apps: FastifyInstance[] = [];

async function readyApp(options: Partial<BuildAppOptions> = {}): Promise<FastifyInstance> {
  const app = buildApp({ config: unitTestConfig(), ...options });
  apps.push(app);
  await app.ready();
  return app;
}

/** The answer, validated against the shared schema; it must be this server's, with `ready`. */
async function health(app: FastifyInstance, url: string = HEALTH_PATH): Promise<CoreServerHealth> {
  const response = await app.inject({ method: 'GET', url });
  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
  const body = HealthResponseSchema.parse(response.json());
  const { service, ready } = body;
  if (service !== 'dems-core-server' || ready === undefined) {
    throw new Error(`not the Core server's health answer: service ${service}, ready ${String(ready !== undefined)}`);
  }
  return { ...body, service, ready };
}

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe('GET /api/v1/health', () => {
  it('answers service dems-core-server, version 0.2.0 and validates against HealthResponseSchema', async () => {
    const app = await readyApp({ createPool: () => createFakePool().pool });
    const before = Date.now();
    const body = await health(app);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('dems-core-server');
    expect(body.version).toBe('0.2.0');
    expect(body.version).toBe(manifest.version);
    expect(body.apiVersion).toBe('v1');
    expect(body.ws).toEqual({ path: '/ws', heartbeatIntervalMs: 1000, clients: 0 });
    expect(Number.isInteger(body.uptimeMs) && body.uptimeMs >= 0).toBe(true);
    expect(Date.parse(body.serverTime)).toBeGreaterThanOrEqual(before - 1);
    expect(Object.keys(body).sort()).toEqual(
      ['apiVersion', 'ready', 'serverTime', 'service', 'status', 'uptimeMs', 'version', 'ws'].sort(),
    );
  });

  it('is a valid shared HealthResponse as it stands: the schema knows every member it sends', async () => {
    const app = await readyApp({ createPool: () => createFakePool().pool });
    const response = await app.inject({ method: 'GET', url: HEALTH_PATH });
    const body: unknown = response.json();

    expect(HealthResponseSchema.safeParse(body).success).toBe(true);
    // Nothing is dropped by the parse, so no member is outside the shared schema.
    expect(HealthResponseSchema.parse(body)).toEqual(body);
    expect(HealthResponseSchema.strict().safeParse(body).success).toBe(true);
  });

  it('always sends ready, which the shared schema leaves optional for mock-core', async () => {
    const app = await readyApp({ createPool: () => createFakePool().pool });
    const body = (await app.inject({ method: 'GET', url: HEALTH_PATH })).json() as Record<string, unknown>;
    expect(body.ready).toEqual({ database: true, engine: false });
    // The same answer under mock-core's name and without `ready` is still a valid shared answer,
    // which is why this test, not the schema, holds the server to sending it.
    const { ready: _ready, ...withoutReady } = body;
    expect(HealthResponseSchema.safeParse({ ...withoutReady, service: 'dems-mock-core' }).success).toBe(true);
    expect(HealthResponseSchema.safeParse({ ...body, service: 'another-service' }).success).toBe(false);
    expect(HealthResponseSchema.safeParse({ ...body, ready: { database: 'yes', engine: false } }).success).toBe(false);
  });

  it('with the pool pointed at a closed port: 200 with ready.database false', async () => {
    const app = await readyApp();
    const body = await health(app);
    expect(body.ready).toEqual({ database: false, engine: false });
    // The process stays up and keeps answering.
    expect((await health(app)).ready.database).toBe(false);
  });

  it('with a closed pool: 200 with ready.database false', async () => {
    const fake = createFakePool();
    const app = await readyApp({ createPool: () => fake.pool });
    expect((await health(app)).ready.database).toBe(true);
    await app.db.close();
    expect((await health(app)).ready.database).toBe(false);
  });

  it('ready follows the pool and the engine flag', async () => {
    let up = false;
    const fake = createFakePool(async () => {
      if (!up) throw Object.assign(new Error('refused'), { code: 'ECONNREFUSED' });
      return { rows: [] };
    });
    const app = await readyApp({ createPool: () => fake.pool });
    expect((await health(app)).ready).toEqual({ database: false, engine: false });

    up = true;
    await app.db.probe({ fresh: true });
    app.readiness.set('engine', true);
    expect((await health(app)).ready).toEqual({ database: true, engine: true });

    up = false;
    await app.db.probe({ fresh: true });
    expect((await health(app)).ready).toEqual({ database: false, engine: true });
  });

  it('answers while the server is not ready and while a hold is active', async () => {
    const app = await readyApp();
    app.readiness.hold('demo-reset');
    expect((await health(app)).status).toBe('ok');
  });

  it('serverTime follows the clock seam', async () => {
    const app = await readyApp({ createPool: () => createFakePool().pool });
    app.seams.replace('clock', { now: () => Date.UTC(2026, 9, 1, 3, 0, 0) });
    expect((await health(app)).serverTime).toBe('2026-10-01T03:00:00.000Z');
  });

  // By-design change (plan row W42, decision D99): the realtime channel now registers the socket
  // server itself, so no stand-in is decorated here. The count of real open sockets is asserted
  // where sockets exist (`src/realtime/__tests__/upgrade.db.test.ts`).
  it('counts the sockets of the realtime channel: none on a fresh app', async () => {
    const app = await readyApp({ createPool: () => createFakePool().pool });
    expect((await health(app)).ws.clients).toBe(0);
  });

  it('ignores a query string and carries no Core data', async () => {
    const app = await readyApp({ createPool: () => createFakePool().pool });
    const body = await health(app, `${HEALTH_PATH}?token=abc`);
    expect(JSON.stringify(body)).not.toContain('abc');
  });

  it('is GET only', async () => {
    const app = await readyApp();
    const response = await app.inject({ method: 'POST', url: HEALTH_PATH });
    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toBe('GET');
  });

  it('is registered under the operationId of the shared registry', () => {
    const operation = CORE_API_OPERATIONS.find((entry) => entry.path === HEALTH_PATH);
    expect(operation?.operationId).toBe(HEALTH_OPERATION_ID);
    expect(operation?.method).toBe('get');
    expect(HEALTH_PATH).toBe('/api/v1/health');
  });
});
