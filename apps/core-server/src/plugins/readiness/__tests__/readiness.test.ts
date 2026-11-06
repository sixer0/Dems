// Readiness, the request stages and the seams (plan row W08; spec §2.3, §7.3; P25): the order
// of the stages is fixed by the scaffold, a refusal stops the later stages, and a unit that
// forgets its seam or its stage stops the boot by name.
import type { ApiErrorCode } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { REQUEST_STAGES, SEAM_PROVIDERS, STAGE_PROVIDERS, buildApp } from '../../../app';
import { createSystemClock } from '../../../core';
import { captureLog, createFakePool, unitTestConfig } from '../../../../test/support/config';
import { ApiFailure } from '../../error-envelope';
import { BootError, READINESS_EXEMPT_OPERATION, createReadiness } from '../index';

const apps: FastifyInstance[] = [];

async function readyApp(prepare?: (app: FastifyInstance) => void): Promise<FastifyInstance> {
  const app = buildApp({ config: unitTestConfig() });
  apps.push(app);
  app.get('/api/v1/anything/:id', { config: { operationId: 'anything' } }, async () => ({ ok: true }));
  app.post('/api/v1/anything', { config: { operationId: 'postAnything' } }, async () => ({ ok: true }));
  prepare?.(app);
  // By-design change (plan row W28): not about stage 6; a scratch route is no registry operation.
  app.stages.replace('accessRule', () => {});
  await app.ready();
  return app;
}

function code(response: { json: () => unknown }): string {
  return (response.json() as { error: { code: string } }).error.code;
}

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe('the app factory', () => {
  it('performs no listen: it answers through inject() and its server is never bound', async () => {
    const app = await readyApp();
    expect(app.server.listening).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
    expect(app.server.listening).toBe(false);
    expect(app.server.address()).toBeNull();
  });

  it('exposes the configuration it was given, unchanged', async () => {
    const config = unitTestConfig();
    const app = buildApp({ config });
    apps.push(app);
    expect(app.config).toBe(config);
    expect(app.config.host).toBe('127.0.0.1');
  });
});

describe('stage 2: readiness', () => {
  it('refuses everything except the health operation with 503 NOT_READY while not ready', async () => {
    const app = await readyApp();
    expect(app.readiness.snapshot()).toEqual({ database: false, engine: false });
    expect(app.readiness.isReady()).toBe(false);

    const refused = await app.inject({ method: 'GET', url: '/api/v1/anything/1' });
    expect(refused.statusCode).toBe(503);
    expect(code(refused)).toBe('NOT_READY');
    expect((await app.inject({ method: 'POST', url: '/api/v1/anything' })).statusCode).toBe(503);
    expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
    expect(READINESS_EXEMPT_OPERATION).toBe('getServiceHealth');
  });

  it('needs both flags: the database alone or the engine alone is not ready', async () => {
    const app = await readyApp();
    app.readiness.set('database', true);
    expect((await app.inject({ method: 'GET', url: '/api/v1/anything/1' })).statusCode).toBe(503);
    app.readiness.set('database', false);
    app.readiness.set('engine', true);
    expect((await app.inject({ method: 'GET', url: '/api/v1/anything/1' })).statusCode).toBe(503);
    app.readiness.set('database', true);
    expect(app.readiness.isReady()).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/v1/anything/1' })).statusCode).toBe(200);
  });

  it('a hold refuses requests until every hold is released (a demo reset, the shutdown)', async () => {
    // A pool that answers, so that the health call below does not switch the database flag off.
    const app = buildApp({ config: unitTestConfig(), createPool: () => createFakePool().pool });
    apps.push(app);
    app.get('/api/v1/anything/:id', { config: { operationId: 'anything' } }, async () => ({ ok: true }));
    app.stages.replace('accessRule', () => {});
    await app.ready();
    app.readiness.set('database', true);
    app.readiness.set('engine', true);
    const releaseReset = app.readiness.hold('demo-reset');
    const releaseShutdown = app.readiness.hold('shutdown');
    expect((await app.inject({ method: 'GET', url: '/api/v1/anything/1' })).statusCode).toBe(503);
    expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
    // The flags still say what is usable; the hold is separate.
    expect(app.readiness.snapshot()).toEqual({ database: true, engine: true });
    releaseReset();
    releaseReset();
    expect(app.readiness.isReady()).toBe(false);
    releaseShutdown();
    expect((await app.inject({ method: 'GET', url: '/api/v1/anything/1' })).statusCode).toBe(200);
  });

  it('a hold writes two log lines, taken and released, with its name under the key hold and under no key that names something caught (decision D96, ruling 2)', async () => {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => createFakePool().pool, logStream: log.stream });
    apps.push(app);
    await app.ready();
    const before = log.lines().length;
    const release = app.readiness.hold('demo-reset');
    release();
    // Released twice: no third line.
    release();
    const lines = log.lines().slice(before).filter((line) => line['msg'] === 'readiness hold');
    expect(lines.map((line) => [line['level'], line['hold'], line['held']])).toEqual([
      [30, 'demo-reset', true],
      [30, 'demo-reset', false],
    ]);
    for (const line of lines) expect(Object.keys(line).sort()).toEqual(['held', 'hold', 'hostname', 'level', 'msg', 'pid', 'time']);
  });

  it('an unknown path answers 404 while not ready: routing comes first (spec §7.3)', async () => {
    const app = await readyApp();
    expect((await app.inject({ method: 'GET', url: '/api/v1/nope' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/anything' })).statusCode).toBe(405);
  });
});

describe('the request stages (spec §2.3)', () => {
  it('are these five, in this order', () => {
    expect(REQUEST_STAGES).toEqual(['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule']);
    expect(Object.keys(STAGE_PROVIDERS)).toEqual([...REQUEST_STAGES]);
  });

  it('run in the order of the specification, once per request, before the handler', async () => {
    const order: string[] = [];
    const app = await readyApp((instance) => {
      instance.get('/api/v1/traced', async () => {
        order.push('handler');
        return {};
      });
    });
    // Replaced in another order on purpose: the scaffold, not the caller, decides the order.
    for (const stage of [...REQUEST_STAGES].reverse()) {
      app.stages.replace(stage, () => {
        order.push(stage);
      });
    }
    expect((await app.inject({ method: 'GET', url: '/api/v1/traced' })).statusCode).toBe(200);
    expect(order).toEqual(['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule', 'handler']);
  });

  it.each(REQUEST_STAGES.map((stage, index) => [stage, index] as const))(
    'a refusal at %s stops every later stage and the handler',
    async (refusing, index) => {
      const order: string[] = [];
      const app = await readyApp();
      for (const stage of REQUEST_STAGES) {
        app.stages.replace(stage, () => {
          order.push(stage);
          // A made-up code that names the stage: `ApiFailure.code` is the contract's vocabulary (review finding
          // CPB1-9), and no code of the contract says which stage refused.
          if (stage === refusing) throw new ApiFailure(403, `REFUSED_AT_${index}` as ApiErrorCode, 'Refused.');
        });
      }
      const response = await app.inject({ method: 'POST', url: '/api/v1/anything', payload: { a: 1 } });
      expect(response.statusCode).toBe(403);
      expect(code(response)).toBe(`REFUSED_AT_${index}`);
      expect(order).toEqual(REQUEST_STAGES.slice(0, index + 1));
    },
  );

  it('a stage may also answer by itself; the later stages do not run', async () => {
    const order: string[] = [];
    const app = await readyApp();
    for (const stage of REQUEST_STAGES) {
      app.stages.replace(stage, async (_request, reply) => {
        order.push(stage);
        if (stage === 'throttle') await reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Slow down.' } });
      });
    }
    const response = await app.inject({ method: 'GET', url: '/api/v1/anything/1' });
    expect(response.statusCode).toBe(429);
    expect(order).toEqual(['readiness', 'originGuard', 'authenticate', 'throttle']);
  });

  it('an asynchronous stage is awaited before the next one starts', async () => {
    const order: string[] = [];
    const app = await readyApp();
    app.stages.replace('readiness', () => {});
    app.stages.replace('authenticate', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push('authenticate done');
    });
    app.stages.replace('throttle', () => {
      order.push('throttle');
    });
    await app.inject({ method: 'GET', url: '/api/v1/anything/1' });
    expect(order).toEqual(['authenticate done', 'throttle']);
  });

  it('a request that matched no route skips the stages', async () => {
    const order: string[] = [];
    const app = await readyApp();
    for (const stage of REQUEST_STAGES) app.stages.replace(stage, () => void order.push(stage));
    expect((await app.inject({ method: 'GET', url: '/api/v1/nope' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: '/api/v1/anything' })).statusCode).toBe(405);
    expect(order).toEqual([]);
  });

  it('every request starts as ANONYMOUS; stage 4 may set the principal for the later stages', async () => {
    const seen: string[] = [];
    const app = await readyApp();
    app.stages.replace('readiness', (request) => void seen.push(`2:${request.principal.kind}`));
    app.stages.replace('authenticate', (request) => {
      request.principal = { kind: 'DEVICE', deviceId: 'DEV-0001' };
    });
    app.stages.replace('throttle', (request) => void seen.push(`5:${request.principal.kind}`));
    await app.inject({ method: 'GET', url: '/api/v1/anything/1' });
    await app.inject({ method: 'GET', url: '/api/v1/anything/2' });
    expect(seen).toEqual(['2:ANONYMOUS', '5:DEVICE', '2:ANONYMOUS', '5:DEVICE']);
  });

  it('request.cookies is parsed before the stages run', async () => {
    let cookies: unknown;
    const app = await readyApp();
    app.stages.replace('readiness', () => {});
    app.stages.replace('originGuard', (request) => {
      cookies = request.cookies;
    });
    await app.inject({ method: 'GET', url: '/api/v1/anything/1', headers: { cookie: 'dems_session_4420=abc; x=1' } });
    expect(cookies).toEqual({ dems_session_4420: 'abc', x: '1' });
  });
});

describe('the seams (P25)', () => {
  it('are these ten besides readiness, each with a named provider: the nine of the scaffold and `capture` (task 3 row 57, OD-14 waiver)', () => {
    expect(Object.keys(SEAM_PROVIDERS).sort()).toEqual(
      [
        'auditWriter',
        'capture',
        'clock',
        'denialBudget',
        'deviceResolver',
        'engine',
        'originDecision',
        'pipeline',
        'publish',
        'sessionRegistry',
      ].sort(),
    );
  });

  it('every seam and readiness is a decorator of the app after ready()', async () => {
    const app = await readyApp();
    for (const name of [...Object.keys(SEAM_PROVIDERS), 'readiness', 'config', 'db', 'errorLog', 'seams', 'stages']) {
      expect(app.hasDecorator(name), name).toBe(true);
    }
    expect(app.hasRequestDecorator('principal')).toBe(true);
    for (const name of Object.keys(SEAM_PROVIDERS)) expect(app.seams.has(name as keyof typeof SEAM_PROVIDERS), name).toBe(true);
    for (const stage of REQUEST_STAGES) expect(app.stages.has(stage), stage).toBe(true);
  });

  it('the seams that answer as they are: a working clock, and the budget, which resolves for a request it cannot read', async () => {
    const app = await readyApp();
    const before = Date.now();
    expect(app.clock.now()).toBeGreaterThanOrEqual(before);
    const request = {} as Parameters<typeof app.denialBudget.consume>[0];
    await expect(app.denialBudget.consume(request)).resolves.toBeUndefined();
  });

  it('a seam is a getter: replace() takes effect at once, also from a child scope', async () => {
    let fromChild = 0;
    const app = await readyApp((instance) => {
      instance.register(async (child) => {
        child.get('/api/v1/time', async () => {
          fromChild = child.clock.now();
          return {};
        });
      });
    });
    app.stages.replace('readiness', () => {});
    app.seams.replace('clock', { now: () => 1234 });
    expect(app.clock.now()).toBe(1234);
    await app.inject({ method: 'GET', url: '/api/v1/time' });
    expect(fromChild).toBe(1234);
  });

  it('replace() before ready() still wins over the unit that provides the seam later', async () => {
    const app = buildApp({ config: unitTestConfig() });
    apps.push(app);
    app.seams.replace('clock', { now: () => 42 });
    app.stages.replace('readiness', () => {});
    await app.ready();
    expect(app.clock.now()).toBe(42);
  });

  it('the registry gives the same value as the decorator', async () => {
    const app = await readyApp();
    expect(app.seams.get('clock')).toBe(app.clock);
    expect(app.seams.get('publish')).toBe(app.publish);
    const handler = (): void => {};
    app.stages.replace('throttle', handler);
    expect(app.stages.get('throttle')).toBe(handler);
  });

  it('providing a seam or a stage twice is an error', async () => {
    const app = await readyApp();
    expect(() => app.seams.provide('clock', createSystemClock())).toThrow('seam "clock" was provided twice');
    expect(() => app.stages.provide('throttle', () => {})).toThrow('request stage "throttle" was provided twice');
  });

  it('the system clock never moves backwards', () => {
    const clock = createSystemClock();
    const values = Array.from({ length: 1000 }, () => clock.now());
    expect(values.every((value, index) => index === 0 || value >= (values[index - 1] ?? 0))).toBe(true);
  });
});

describe('boot steps', () => {
  it('run in the order they were added and stop at the first that throws', async () => {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream });
    apps.push(app);
    await app.ready();
    const readiness = createReadiness(app.log);
    const order: string[] = [];
    readiness.addBootStep({ id: 'B-1', run: async () => void order.push('B-1') });
    readiness.addBootStep({
      id: 'B-4',
      run: async () => {
        order.push('B-4');
        throw new Error('the runtime role is privileged');
      },
    });
    readiness.addBootStep({ id: 'engine.rehydrate', run: async () => void order.push('engine') });

    const error = await readiness.boot().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe('B-4');
    expect((error as BootError).message).toBe('boot step B-4 failed');
    expect(((error as BootError).cause as Error).message).toBe('the runtime role is privileged');
    expect(order).toEqual(['B-1', 'B-4']);
    expect(log.lines().filter((line) => line.msg === 'boot step passed').map((line) => line.step)).toEqual(['B-1']);
  });

  it('the app has one boot step from the scaffold, B-1, and it fails when the database does not answer', async () => {
    const app = await readyApp();
    const error = await app.readiness.boot().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe('B-1');
    expect(app.readiness.snapshot().database).toBe(false);
  });

  it('readiness changes are logged once per change', async () => {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream });
    apps.push(app);
    await app.ready();
    app.readiness.set('engine', true);
    app.readiness.set('engine', true);
    app.readiness.set('engine', false);
    const changes = log.lines().filter((line) => line.msg === 'readiness changed');
    expect(changes.map((line) => `${String(line.part)}=${String(line.ready)}`)).toEqual(['engine=true', 'engine=false']);
  });
});
