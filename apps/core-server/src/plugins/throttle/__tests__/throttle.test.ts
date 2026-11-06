// Stage 5, the request throttle, in the real app factory (plan row W23; spec §2.3, §5.1 ID-P12;
// SR-24, SR-75; AC-B-14 for 429 and 413, AC-B-84 in unit form). In-process: `app.inject`, no
// listener, no database. The server clock is a manual clock; principals are put at stage 4 by a
// stand-in, because the real stage 4 is plan row W24's.
import { ApiErrorCode, RETRY_AFTER_HEADER_NAME } from '@dems/shared/api';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { BODY_LIMIT_BYTES } from '../../../config';
import { ANONYMOUS_PRINCIPAL, type Principal } from '../../authenticate';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import {
  FOREIGN_ORIGIN,
  OWN_ORIGIN,
  SCRATCH_COMMAND,
  SCRATCH_PATTERN,
  SCRATCH_READ,
  SESSION_COOKIE,
  WEB_CONSOLE_ORIGIN,
  authenticateAs,
  authenticateBySpecification,
  buildGuardApp,
  devicePrincipal,
  expectRefusal,
  operatorPrincipal,
  retiredDevice,
  type GuardApp,
  type GuardAppOptions,
} from '../../origin-guard/__tests__/guard-test-app';
import { throttleControl } from '../index';

const RATE_LIMITED = ApiErrorCode.RATE_LIMITED;
const HEALTH: InjectOptions = { method: 'GET', url: '/api/v1/health' };
const READ: InjectOptions = { method: 'GET', url: SCRATCH_READ };
const COMMAND: InjectOptions = { method: 'POST', url: SCRATCH_COMMAND, payload: { note: 'x' } };
const UPGRADE_HEADERS = { connection: 'Upgrade', upgrade: 'websocket' };

const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

async function guardApp(options: GuardAppOptions = {}): Promise<GuardApp> {
  const guard = await buildGuardApp(options);
  apps.push(guard.app);
  return guard;
}

/** The app with a principal that the test sets; ANONYMOUS until it does. */
async function appWithPrincipal(options: GuardAppOptions = {}): Promise<GuardApp & { actAs(principal: Principal): void }> {
  const guard = await guardApp(options);
  let current: Principal = ANONYMOUS_PRINCIPAL;
  authenticateAs(guard.app, () => current);
  return {
    ...guard,
    actAs(principal) {
      current = principal;
    },
  };
}

/** Sends the request `times` times, one after the other, and returns the status codes. */
async function send(app: FastifyInstance, request: InjectOptions, times: number): Promise<number[]> {
  const statuses: number[] = [];
  for (let index = 0; index < times; index += 1) statuses.push((await app.inject(request)).statusCode);
  return statuses;
}

function withHeaders(request: InjectOptions, headers: Record<string, string>): InjectOptions {
  return { ...request, headers: { ...(request.headers as Record<string, string> | undefined), ...headers } };
}

function retryAfter(response: LightMyRequestResponse): number {
  const value = response.headers[RETRY_AFTER_HEADER_NAME];
  expect(typeof value).toBe('string');
  expect(String(value)).toMatch(/^[1-9][0-9]*$/);
  return Number(value);
}

const all = (status: number, times: number): number[] => Array.from({ length: times }, () => status);

describe('the class buckets: 30 requests per 60 s (ID-P12)', () => {
  it('the 31st request of class:local in 60 s answers 429 RATE_LIMITED with retry-after', async () => {
    const { app, clock, handled } = await guardApp();
    expect(await send(app, READ, 30)).toEqual(all(200, 30));

    clock.advance(10_000);
    const refused = await app.inject(READ);
    expectRefusal(refused, 429, RATE_LIMITED);
    expect(retryAfter(refused)).toBe(50);
    // The answer says nothing about the key or the count, and carries no counter header.
    expect(refused.json()).toMatchObject({ error: { code: RATE_LIMITED, message: 'Too many requests. Try again shortly.' } });
    expect(Object.keys(refused.headers).filter((name) => name.includes('ratelimit'))).toEqual([]);
    expect(handled.read).toBe(30);
  });

  it('counts every request of the class together: GET and POST, any route', async () => {
    const { app } = await guardApp();
    expect(await send(app, READ, 15)).toEqual(all(200, 15));
    expect(await send(app, COMMAND, 15)).toEqual(all(200, 15));
    expect((await app.inject(READ)).statusCode).toBe(429);
    expect((await app.inject(COMMAND)).statusCode).toBe(429);
  });

  it('class:web is the signed-out console (a web console origin); class:local everything else', async () => {
    const { app } = await guardApp();
    const web = withHeaders(COMMAND, { origin: WEB_CONSOLE_ORIGIN });
    expect(await send(app, web, 30)).toEqual(all(200, 30));
    expect((await app.inject(web)).statusCode).toBe(429);
    // The other class still has its 30: no Origin, and one of the instance's own origins.
    expect(await send(app, COMMAND, 15)).toEqual(all(200, 15));
    expect(await send(app, withHeaders(COMMAND, { origin: OWN_ORIGIN }), 15)).toEqual(all(200, 15));
    expect((await app.inject(COMMAND)).statusCode).toBe(429);
    expect((await app.inject(withHeaders(COMMAND, { origin: OWN_ORIGIN }))).statusCode).toBe(429);
    // The other lane's console shares class:web: the class is one of two fixed values.
    expect((await app.inject(withHeaders(COMMAND, { origin: 'http://127.0.0.1:5176' }))).statusCode).toBe(429);
  });

  it('AC-B-84: 31 requests with 31 different unknown bearer values share one bucket', async () => {
    // Stage 4 resolves none of them. It is the real stage (the identity row's): a bearer value
    // that has not the form of a credential of this server resolves to nothing, without a lookup.
    const { app } = await guardApp();
    const statuses: number[] = [];
    for (let index = 0; index < 31; index += 1) {
      statuses.push((await app.inject(withHeaders(READ, { authorization: `Bearer dvc_unknown-${index}` }))).statusCode);
    }
    expect(statuses).toEqual([...all(200, 30), 429]);
  });

  it('SR-75: nothing a caller sends chooses the key', async () => {
    const { app } = await guardApp();
    const variants: Array<Record<string, string>> = [
      { 'x-forwarded-for': '10.0.0.1' },
      { 'x-forwarded-for': '10.0.0.2', 'x-real-ip': '10.0.0.3' },
      { forwarded: 'for=10.0.0.4' },
      { 'user-agent': 'another-client' },
      { cookie: 'dems_session_4421=a-lane-cookie' },
      { cookie: 'other=1' },
      { authorization: 'Bearer ses_unknown' },
      { 'x-throttle-key': 'operator:OP-0001' },
    ];
    const statuses: number[] = [];
    for (let index = 0; index < 31; index += 1) {
      statuses.push((await app.inject(withHeaders(READ, variants[index % variants.length] ?? {}))).statusCode);
    }
    expect(statuses).toEqual([...all(200, 30), 429]);
  });

  it('a retired device credential counts in class:local (RB-6)', async () => {
    const { app, actAs } = await appWithPrincipal();
    for (let index = 0; index < 30; index += 1) {
      actAs(retiredDevice(`DEV-000${index % 5}`));
      expect((await app.inject(READ)).statusCode).toBe(200);
    }
    actAs(retiredDevice('DEV-0009'));
    expect((await app.inject(READ)).statusCode).toBe(429);
    actAs(ANONYMOUS_PRINCIPAL);
    expect((await app.inject(READ)).statusCode).toBe(429);
  });

  it('a request with an Upgrade header is counted like any request (RT-P14)', async () => {
    const { app } = await guardApp();
    const upgrade = withHeaders(READ, UPGRADE_HEADERS);
    expect(await send(app, upgrade, 30)).toEqual(all(200, 30));
    expectRefusal(await app.inject(upgrade), 429, RATE_LIMITED);
    expect((await app.inject(READ)).statusCode).toBe(429);
  });
});

describe('health is counted apart, at 600 per 60 s', () => {
  it('a class that used up its 30 still gets health, and health does not use up the 30', async () => {
    const { app } = await guardApp();
    expect(await send(app, HEALTH, 40)).toEqual(all(200, 40));
    expect(await send(app, READ, 30)).toEqual(all(200, 30));
    expect((await app.inject(READ)).statusCode).toBe(429);
    expect(await send(app, HEALTH, 40)).toEqual(all(200, 40));
  });

  it('the 601st health request of a class in 60 s answers 429', async () => {
    const { app } = await guardApp();
    expect(await send(app, HEALTH, 600)).toEqual(all(200, 600));
    expectRefusal(await app.inject(HEALTH), 429, RATE_LIMITED);
    // The class's other counter is untouched.
    expect((await app.inject(READ)).statusCode).toBe(200);
  });
});

describe('a resolved principal has its own key', () => {
  it('an operator: 600 per 60 s for every request, shared by all of the operator\'s sessions', async () => {
    const { app, actAs } = await appWithPrincipal();
    actAs(operatorPrincipal('OP-0001', 'AS-0001'));
    expect(await send(app, READ, 300)).toEqual(all(200, 300));
    actAs(operatorPrincipal('OP-0001', 'AS-0002', 'DEV-0001'));
    expect(await send(app, COMMAND, 299)).toEqual(all(200, 299));
    expect((await app.inject(HEALTH)).statusCode).toBe(200);
    expectRefusal(await app.inject(READ), 429, RATE_LIMITED);
    expect((await app.inject(HEALTH)).statusCode).toBe(429);

    // Another operator, a device and the classes are not affected.
    actAs(operatorPrincipal('OP-0002'));
    expect((await app.inject(READ)).statusCode).toBe(200);
    actAs(devicePrincipal('DEV-0001'));
    expect((await app.inject(READ)).statusCode).toBe(200);
    actAs(ANONYMOUS_PRINCIPAL);
    expect((await app.inject(READ)).statusCode).toBe(200);
  });

  it('an operator is not held to the class limit, whatever Origin the request has', async () => {
    const { app, actAs } = await appWithPrincipal();
    actAs(operatorPrincipal('OP-0001'));
    const web = withHeaders(COMMAND, { origin: WEB_CONSOLE_ORIGIN, cookie: `${SESSION_COOKIE}=ses_x` });
    expect(await send(app, web, 31)).toEqual(all(200, 31));
    // And the operator's requests left the class bucket of the same console untouched.
    actAs(ANONYMOUS_PRINCIPAL);
    expect(await send(app, withHeaders(COMMAND, { origin: WEB_CONSOLE_ORIGIN }), 30)).toEqual(all(200, 30));
  });

  it('a device: operations 2, 3, 8 and 9 at 30 per 60 s, every other request at 600', async () => {
    const entryPoints = ['signIn', 'getSignInStatus', 'signInWithBiometric', 'reportBiometricFailure'];
    const { app, actAs } = await appWithPrincipal({
      routes: (instance) => {
        for (const operationId of entryPoints) {
          instance.get(`/api/v1/entry/${operationId}`, { config: { operationId } }, async () => ({ ok: true }));
        }
      },
    });
    actAs(devicePrincipal('DEV-0001'));
    const statuses: number[] = [];
    for (let index = 0; index < 30; index += 1) {
      const operationId = entryPoints[index % entryPoints.length] ?? 'signIn';
      statuses.push((await app.inject({ method: 'GET', url: `/api/v1/entry/${operationId}` })).statusCode);
    }
    expect(statuses).toEqual(all(200, 30));
    for (const operationId of entryPoints) {
      expectRefusal(await app.inject({ method: 'GET', url: `/api/v1/entry/${operationId}` }), 429, RATE_LIMITED);
    }
    // The device's other requests have their own, wider counter.
    expect(await send(app, READ, 100)).toEqual(all(200, 100));
    expect((await app.inject(HEALTH)).statusCode).toBe(200);
    // Another device has its own 30.
    actAs(devicePrincipal('DEV-0002'));
    expect((await app.inject({ method: 'GET', url: '/api/v1/entry/signIn' })).statusCode).toBe(200);
  });

  it('a device: the 601st other request in 60 s answers 429, while its sign-in entry points still answer', async () => {
    const { app, actAs } = await appWithPrincipal({
      routes: (instance) => {
        instance.get('/api/v1/entry/signIn', { config: { operationId: 'signIn' } }, async () => ({ ok: true }));
      },
    });
    actAs(devicePrincipal('DEV-0001'));
    expect(await send(app, READ, 600)).toEqual(all(200, 600));
    expectRefusal(await app.inject(READ), 429, RATE_LIMITED);
    expect((await app.inject({ method: 'GET', url: '/api/v1/entry/signIn' })).statusCode).toBe(200);
  });
});

describe('the window follows the server clock (ENG-13, ENG-16)', () => {
  it('opens at the key\'s first request, and the key is counted afresh 60 s later', async () => {
    const { app, clock } = await guardApp();
    expect(await send(app, READ, 30)).toEqual(all(200, 30));
    expect(retryAfter(await app.inject(READ))).toBe(60);

    clock.advance(59_999);
    const last = await app.inject(READ);
    expect(last.statusCode).toBe(429);
    expect(retryAfter(last)).toBe(1);

    clock.advance(1);
    expect(await send(app, READ, 30)).toEqual(all(200, 30));
    expect((await app.inject(READ)).statusCode).toBe(429);
  });

  it('retry-after counts down with the clock, in whole seconds', async () => {
    const { app, clock } = await guardApp();
    await send(app, READ, 30);
    const seen: number[] = [];
    for (const step of [0, 500, 500, 29_000, 29_500]) {
      clock.advance(step);
      seen.push(retryAfter(await app.inject(READ)));
    }
    expect(seen).toEqual([60, 60, 59, 30, 1]);
  });

  it('the window does not slide: requests late in a window do not extend it', async () => {
    const { app, clock } = await guardApp();
    expect((await app.inject(READ)).statusCode).toBe(200);
    clock.advance(59_000);
    expect(await send(app, READ, 29)).toEqual(all(200, 29));
    expect((await app.inject(READ)).statusCode).toBe(429);
    clock.advance(1_000);
    expect((await app.inject(READ)).statusCode).toBe(200);
  });

  it('refused requests do not extend the window either', async () => {
    const { app, clock } = await guardApp();
    await send(app, READ, 30);
    clock.advance(30_000);
    expect(await send(app, READ, 50)).toEqual(all(429, 50));
    clock.advance(30_000);
    expect((await app.inject(READ)).statusCode).toBe(200);
  });

  it('a test can also reset the counters: of one key, or of all', async () => {
    const { app, actAs } = await appWithPrincipal();
    await send(app, READ, 30);
    expect((await app.inject(READ)).statusCode).toBe(429);
    actAs(devicePrincipal('DEV-0001'));
    await send(app, READ, 600);
    expect((await app.inject(READ)).statusCode).toBe(429);

    throttleControl(app).reset('device:DEV-0001');
    expect((await app.inject(READ)).statusCode).toBe(200);
    actAs(ANONYMOUS_PRINCIPAL);
    expect((await app.inject(READ)).statusCode).toBe(429);

    throttleControl(app).reset();
    expect(await send(app, READ, 30)).toEqual(all(200, 30));
    expect((await app.inject(READ)).statusCode).toBe(429);
  });
});

describe('error precedence around stage 5 (spec §7.3)', () => {
  it('line 5 before lines 6 to 8: a 429 is decided before the access rule and before the body is read', async () => {
    const { app, handled } = await guardApp();
    await send(app, READ, 30);
    let accessRuleRan = 0;
    app.stages.replace('accessRule', () => {
      accessRuleRan += 1;
    });
    const json = { 'content-type': 'application/json' };
    const malformed = await app.inject({ method: 'POST', url: SCRATCH_COMMAND, headers: json, payload: '{"note": ' });
    expectRefusal(malformed, 429, RATE_LIMITED);
    const tooLarge = await app.inject({
      method: 'POST',
      url: SCRATCH_COMMAND,
      headers: json,
      payload: JSON.stringify({ note: 'x'.repeat(BODY_LIMIT_BYTES) }),
    });
    expectRefusal(tooLarge, 429, RATE_LIMITED);
    expect(accessRuleRan).toBe(0);
    expect(handled.command).toBe(0);
  });

  it('AC-B-14: a body above 65,536 bytes answers 413 PAYLOAD_TOO_LARGE once the guards let it through', async () => {
    const { app } = await guardApp();
    const response = await app.inject({
      method: 'POST',
      url: SCRATCH_COMMAND,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ note: 'x'.repeat(BODY_LIMIT_BYTES) }),
    });
    expectRefusal(response, 413, ApiErrorCode.PAYLOAD_TOO_LARGE);
    const exact = JSON.stringify({ note: '' });
    const fits = await app.inject({
      method: 'POST',
      url: SCRATCH_COMMAND,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ note: 'x'.repeat(BODY_LIMIT_BYTES - exact.length) }),
    });
    expect(fits.statusCode).toBe(200);
  });

  it('line 3 before line 5: a refused Origin answers 403 while the class is throttled, and is not counted', async () => {
    const { app } = await guardApp();
    // 40 requests with a foreign Origin: none of them reaches stage 5.
    expect(await send(app, withHeaders(READ, { origin: FOREIGN_ORIGIN }), 40)).toEqual(all(403, 40));
    expect(await send(app, READ, 30)).toEqual(all(200, 30));
    expect((await app.inject(READ)).statusCode).toBe(429);
    expect((await app.inject(withHeaders(READ, { origin: FOREIGN_ORIGIN }))).statusCode).toBe(403);
  });

  it('line 4 before line 5: two credentials answer 401 while the class is throttled, and are not counted', async () => {
    const { app } = await guardApp();
    authenticateBySpecification(app);
    const both = withHeaders(READ, { cookie: `${SESSION_COOKIE}=ses_x`, authorization: 'Bearer ses_y' });
    expect(await send(app, both, 40)).toEqual(all(401, 40));
    expect(await send(app, READ, 30)).toEqual(all(200, 30));
    expect((await app.inject(READ)).statusCode).toBe(429);
    expect((await app.inject(both)).statusCode).toBe(401);
  });

  it('line 2 before line 5: while the server is not ready nothing is counted, health excepted', async () => {
    const { app } = await guardApp({ notReady: true });
    expect(await send(app, READ, 40)).toEqual(all(503, 40));
    app.readiness.set('database', true);
    app.readiness.set('engine', true);
    expect(await send(app, READ, 30)).toEqual(all(200, 30));
    expect((await app.inject(READ)).statusCode).toBe(429);
  });

  it('line 1 before line 5: an unknown path and another method are not counted', async () => {
    const { app } = await guardApp();
    expect(await send(app, { method: 'GET', url: '/api/v1/nope' }, 40)).toEqual(all(404, 40));
    expect(await send(app, { method: 'DELETE', url: SCRATCH_READ }, 40)).toEqual(all(405, 40));
    expect(await send(app, READ, 30)).toEqual(all(200, 30));
  });
});

describe('how the plugin is used', () => {
  it('@fastify/rate-limit is registered, adds its hook to no route and answers nothing by itself', async () => {
    const { app } = await guardApp({
      routes: (instance) => {
        instance.get('/api/v1/late', async () => ({}));
      },
    });
    expect(app.hasDecorator('createRateLimit')).toBe(true);
    expect(app.hasDecorator('rateLimit')).toBe(true);
    // With its hook on a route, the plugin would set `x-ratelimit-limit`, `-remaining` and
    // `-reset` on every answer of that route.
    const answers = await Promise.all([
      app.inject(READ),
      app.inject(COMMAND),
      app.inject(HEALTH),
      app.inject({ method: 'GET', url: '/api/v1/late' }),
    ]);
    for (const answer of answers) {
      expect(answer.statusCode).toBe(200);
      expect(Object.keys(answer.headers).filter((name) => name.includes('ratelimit') || name === 'retry-after')).toEqual([]);
    }
  });
});

describe('a throttled request is logged, not audited (SR-24, GS-07)', () => {
  it('each 429 has its request line; the limit is announced once per key and window', async () => {
    const log = captureLog();
    const { app, clock } = await guardApp({ config: unitTestConfig({ logLevel: 'trace' }), logStream: log.stream });
    let audited = 0;
    app.seams.replace('auditWriter', {
      append: async () => {
        audited += 1;
      },
    });
    const marked = withHeaders(
      { method: 'GET', url: '/api/v1/scratch/MARK-param-3e1a?token=MARK-query-77c2' },
      { authorization: 'Bearer MARK-auth-0d5f', cookie: 'other=MARK-cookie-b4a9' },
    );
    await send(app, marked, 30);
    expect(await send(app, marked, 5)).toEqual(all(429, 5));
    clock.advance(60_000);
    await send(app, marked, 30);
    expect(await send(app, marked, 2)).toEqual(all(429, 2));

    const lines = log.lines();
    const throttled = lines.filter((line) => line.msg === 'request completed' && line.status === 429);
    expect(throttled).toHaveLength(7);
    for (const line of throttled) {
      expect(line.route).toBe(SCRATCH_PATTERN);
      expect(line.code).toBe(RATE_LIMITED);
    }
    const announced = lines.filter((line) => line.msg === 'rate limit reached');
    expect(announced).toHaveLength(2);
    for (const line of announced) {
      expect(line).toMatchObject({
        level: 40,
        code: RATE_LIMITED,
        route: SCRATCH_PATTERN,
        limiter: 'throttle',
        key: 'class:local',
        limit: 30,
      });
    }
    const text = log.text();
    for (const marker of ['MARK-param-3e1a', 'MARK-query-77c2', 'MARK-auth-0d5f', 'MARK-cookie-b4a9', 'token=', 'Bearer ']) {
      expect(text, marker).not.toContain(marker);
    }
    expect(audited).toBe(0);
  });

  it('the announcement names the principal\'s key, which the request line names as well', async () => {
    const log = captureLog();
    const { app, actAs } = await appWithPrincipal({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream });
    actAs(operatorPrincipal('OP-0007'));
    await send(app, READ, 600);
    expect((await app.inject(READ)).statusCode).toBe(429);
    const lines = log.lines();
    expect(lines.filter((line) => line.msg === 'rate limit reached')).toMatchObject([
      { limiter: 'throttle', key: 'operator:OP-0007', limit: 600 },
    ]);
    expect(lines.filter((line) => line.status === 429)).toMatchObject([{ principal: 'operator:OP-0007', code: RATE_LIMITED }]);
  });
});
