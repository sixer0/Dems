// The denial budget (plan row W23; spec §5.1 ID-P13, §4.6 RB-4 and RB-6; SR-71; AC-B-75 in unit
// form; assumption SA-14). In-process: `app.inject`, no listener, no database, no audit writer:
// a stand-in for the permission guard (plan row W28) refuses at stage 6 the way a real caller of
// the seam must, and counts the rows it would write.
//
// WHAT A CALLER OF `app.denialBudget.consume(request)` SEES is the first describe block.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiErrorCode, RETRY_AFTER_HEADER_NAME } from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest, InjectOptions } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { ANONYMOUS_PRINCIPAL, type Principal } from '../../authenticate';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { ApiFailure } from '../../error-envelope';
import {
  CLOCK_START,
  SCRATCH_COMMAND,
  SCRATCH_PATTERN,
  SCRATCH_READ,
  WEB_CONSOLE_ORIGIN,
  authenticateAs,
  buildGuardApp,
  devicePrincipal,
  expectRefusal,
  operatorPrincipal,
  retiredDevice,
  type GuardApp,
  type GuardAppOptions,
} from '../../origin-guard/__tests__/guard-test-app';
import { createDenialBudget } from '../denial-budget';
import { DENIAL_BUDGET_MAX, rateLimited, throttleControl } from '../index';

const RATE_LIMITED = ApiErrorCode.RATE_LIMITED;
const DENIED = '/api/v1/denied';
const DENIED_CALL: InjectOptions = { method: 'POST', url: DENIED, payload: { note: 'x' } };
const READ: InjectOptions = { method: 'GET', url: SCRATCH_READ };
const HEALTH: InjectOptions = { method: 'GET', url: '/api/v1/health' };

const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

interface BudgetApp extends GuardApp {
  /** One entry per audit row the stand-in guard wrote: the key of the request it refused. */
  readonly rows: string[];
  actAs(principal: Principal): void;
}

/**
 * An app whose stage 6 refuses every call of `POST /api/v1/denied` the way a caller of the seam
 * has to: take a place, write the row, refuse. Every other route is allowed.
 */
async function budgetApp(options: GuardAppOptions = {}): Promise<BudgetApp> {
  const guard = await buildGuardApp({
    ...options,
    routes: (instance) => {
      instance.post(DENIED, { config: { operationId: 'denied' } }, async () => ({ reached: 'the handler' }));
      options.routes?.(instance);
    },
  });
  apps.push(guard.app);
  const { app } = guard;
  const rows: string[] = [];
  let current: Principal = ANONYMOUS_PRINCIPAL;
  authenticateAs(app, () => current);
  const control = throttleControl(app);
  app.stages.replace('accessRule', async (request) => {
    if (request.routeOptions.config.operationId !== 'denied') return;
    await app.denialBudget.consume(request);
    // The audit row is written only after a place was taken. A real writer is asynchronous.
    await new Promise((resolve) => setImmediate(resolve));
    rows.push(control.keyOf(request));
    throw new ApiFailure(403, 'NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.');
  });
  return {
    ...guard,
    rows,
    actAs(principal) {
      current = principal;
    },
  };
}

async function statuses(app: FastifyInstance, request: InjectOptions, times: number): Promise<number[]> {
  const out: number[] = [];
  for (let index = 0; index < times; index += 1) out.push((await app.inject(request)).statusCode);
  return out;
}

const all = <Value>(value: Value, times: number): Value[] => Array.from({ length: times }, () => value);
const count = (list: readonly number[], status: number): number => list.filter((value) => value === status).length;

describe('what a caller of app.denialBudget.consume(request) sees', () => {
  it('the first 20 calls of a key within 60 s resolve with nothing: write the row, then refuse', async () => {
    const { app, actAs } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    let request: FastifyRequest | undefined;
    app.stages.replace('accessRule', (incoming) => {
      request = incoming;
    });
    await app.inject(READ);
    if (request === undefined) throw new Error('the request did not reach stage 6');
    for (let index = 0; index < DENIAL_BUDGET_MAX; index += 1) {
      await expect(app.denialBudget.consume(request)).resolves.toBeUndefined();
    }
    expect(await throttleControl(app).inspect('operator:OP-0001')).toMatchObject({ used: 20, remaining: 0, exhausted: true });
  });

  it('the 21st call throws the 429: let it propagate and write no row', async () => {
    const { app, actAs, clock } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    let request: FastifyRequest | undefined;
    app.stages.replace('accessRule', (incoming) => {
      request = incoming;
    });
    await app.inject(READ);
    if (request === undefined) throw new Error('the request did not reach stage 6');
    for (let index = 0; index < DENIAL_BUDGET_MAX; index += 1) await app.denialBudget.consume(request);

    clock.advance(15_000);
    const thrown = await app.denialBudget.consume(request).then(
      () => null,
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(ApiFailure);
    expect(thrown).toMatchObject({
      statusCode: 429,
      code: RATE_LIMITED,
      headers: { [RETRY_AFTER_HEADER_NAME]: '45' },
    });
    // It is the same refusal stage 5 gives, so a caller need not build one.
    expect(thrown).toMatchObject({ message: rateLimited(45).message });
    // And it stays that way until the window ends.
    await expect(app.denialBudget.consume(request)).rejects.toBeInstanceOf(ApiFailure);
  });

  it('used the way the seam asks, a refused call writes one row: 20 rows for 20 refusals', async () => {
    const { app, actAs, rows } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    const answers = await Promise.all(Array.from({ length: 20 }, () => app.inject(DENIED_CALL)));
    for (const answer of answers) expectRefusal(answer, 403, 'NOT_PERMITTED');
    expect(rows).toEqual(all('operator:OP-0001', 20));
  });

  it('it never fails a request because the counter broke: the failure is logged, and the row is written', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dems-w23-budget-'));
    const errorLogFile = join(directory, 'errors.log');
    const log = captureLog();
    try {
      const { app } = await budgetApp({
        config: unitTestConfig({ logLevel: 'trace' }),
        logStream: log.stream,
        errorLogFile,
      });
      // Not a request: the key cannot be read from it.
      const broken = {} as FastifyRequest;
      await expect(app.denialBudget.consume(broken)).resolves.toBeUndefined();

      const logged = log.lines().filter((line) => line.level === 50);
      expect(logged).toHaveLength(1);
      expect(logged[0]).toMatchObject({
        msg: 'the denial budget could not be counted; the refusal is audited without it',
        requestId: null,
        err: { type: 'TypeError' },
      });
      const persisted = readFileSync(errorLogFile, 'utf8')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(persisted).toHaveLength(1);
      expect(persisted[0]).toMatchObject({
        level: 'error',
        source: 'throttle.denialBudget.consume',
        errorName: 'TypeError',
        context: { requestId: null },
      });
      expect(typeof persisted[0]?.stackTrace).toBe('string');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('ID-P13, SR-71: at most 20 audited refusals per key within 60 s', () => {
  it('the 21st refusal of one key answers 429 and writes no row', async () => {
    const { app, actAs, rows } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    expect(await statuses(app, DENIED_CALL, 20)).toEqual(all(403, 20));
    expect(rows).toHaveLength(20);

    const refused = await app.inject(DENIED_CALL);
    expectRefusal(refused, 429, RATE_LIMITED);
    expect(refused.headers[RETRY_AFTER_HEADER_NAME]).toBe('60');
    expect(rows).toHaveLength(20);
  });

  it('AC-B-75, one after the other: 100 denied calls of one operator write exactly 20 rows; the other 80 answer 429', async () => {
    const { app, actAs, rows, clock } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    const seen: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      seen.push((await app.inject(DENIED_CALL)).statusCode);
      clock.advance(100);
    }
    expect(seen).toEqual([...all(403, 20), ...all(429, 80)]);
    expect(rows).toHaveLength(20);
  });

  it('AC-B-75, all at once: 100 concurrent denied calls still write exactly 20 rows', async () => {
    const { app, actAs, rows } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    const answers = await Promise.all(Array.from({ length: 100 }, () => app.inject(DENIED_CALL)));
    const seen = answers.map((answer) => answer.statusCode);
    expect(count(seen, 403)).toBe(20);
    expect(count(seen, 429)).toBe(80);
    expect(rows).toHaveLength(20);
    for (const answer of answers.filter((candidate) => candidate.statusCode === 429)) {
      expectRefusal(answer, 429, RATE_LIMITED);
      expect(answer.headers[RETRY_AFTER_HEADER_NAME]).toBe('60');
    }
  });

  it('while the key holds 20, every REST request of the key answers 429 at stage 5, health excepted', async () => {
    const { app, actAs, handled } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    await statuses(app, DENIED_CALL, 20);
    let reachedStage6 = 0;
    const guard = app.stages.get('accessRule');
    app.stages.replace('accessRule', async (request, reply) => {
      reachedStage6 += 1;
      await guard(request, reply);
    });

    expectRefusal(await app.inject(READ), 429, RATE_LIMITED);
    expectRefusal(await app.inject({ method: 'POST', url: SCRATCH_COMMAND, payload: {} }), 429, RATE_LIMITED);
    expectRefusal(await app.inject(DENIED_CALL), 429, RATE_LIMITED);
    expect(reachedStage6).toBe(0);
    expect(handled).toEqual({ read: 0, command: 0 });

    expect((await app.inject(HEALTH)).statusCode).toBe(200);
    expect(reachedStage6).toBe(1);
  });

  it('an allowed call takes no place: 500 of them leave the budget untouched', async () => {
    const { app, actAs } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    expect(await statuses(app, READ, 500)).toEqual(all(200, 500));
    expect(await throttleControl(app).inspect('operator:OP-0001')).toMatchObject({ used: 0, exhausted: false, windowEndsAt: null });
  });

  it('a request with an Upgrade header is not blocked by the budget', async () => {
    const { app, actAs } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    await statuses(app, DENIED_CALL, 20);
    expect((await app.inject(READ)).statusCode).toBe(429);
    const upgrade = { ...READ, headers: { connection: 'Upgrade', upgrade: 'websocket' } };
    expect((await app.inject(upgrade)).statusCode).toBe(200);
  });

  it('each key has its own budget: another operator, a device and the classes are not affected', async () => {
    const { app, actAs, rows } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    await statuses(app, DENIED_CALL, 21);

    actAs(operatorPrincipal('OP-0002'));
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(403);
    actAs(devicePrincipal('DEV-0001'));
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(403);
    actAs(ANONYMOUS_PRINCIPAL);
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(403);
    expect((await app.inject({ ...DENIED_CALL, headers: { origin: WEB_CONSOLE_ORIGIN } })).statusCode).toBe(403);
    expect(rows.slice(20)).toEqual(['operator:OP-0002', 'device:DEV-0001', 'class:local', 'class:web']);

    // All sessions of one operator share the budget, as they share the key.
    actAs(operatorPrincipal('OP-0001', 'AS-0002', 'DEV-0001'));
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(429);
  });

  it('AC-B-75: 25 calls with five different retired device credentials write at most 20 rows: one class bucket', async () => {
    const { app, actAs, rows } = await budgetApp();
    const seen: number[] = [];
    for (let index = 0; index < 25; index += 1) {
      actAs(retiredDevice(`DEV-000${index % 5}`));
      seen.push((await app.inject(DENIED_CALL)).statusCode);
    }
    expect(seen).toEqual([...all(403, 20), ...all(429, 5)]);
    expect(rows).toEqual(all('class:local', 20));
  });

  it('20 failed sign-ins of the signed-out web console stop that console, and only it (GS-27)', async () => {
    const { app, rows } = await budgetApp();
    const web = { ...DENIED_CALL, headers: { origin: WEB_CONSOLE_ORIGIN } };
    expect(await statuses(app, web, 20)).toEqual(all(403, 20));
    expect((await app.inject(web)).statusCode).toBe(429);
    expect(new Set(rows)).toEqual(new Set(['class:web']));
    // A device that is not paired yet is in the other class.
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(403);
  });
});

describe('SA-14: a test can advance or reset the counter', () => {
  it('after the 60 s window a denied call is audited again (the server clock, advanced by hand)', async () => {
    const { app, actAs, rows, clock } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    await statuses(app, DENIED_CALL, 20);

    clock.advance(59_999);
    const stillRefused = await app.inject(DENIED_CALL);
    expect(stillRefused.statusCode).toBe(429);
    expect(stillRefused.headers[RETRY_AFTER_HEADER_NAME]).toBe('1');
    expect(rows).toHaveLength(20);

    clock.advance(1);
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(403);
    expect(rows).toHaveLength(21);
    // A new window: 20 places again, counted from this refusal.
    expect(await throttleControl(app).inspect('operator:OP-0001')).toEqual({
      key: 'operator:OP-0001',
      limit: 20,
      used: 1,
      remaining: 19,
      exhausted: false,
      windowEndsAt: CLOCK_START + 60_000 + 60_000,
    });
  });

  it('the window opens at the key\'s first refusal and does not slide', async () => {
    const { app, actAs, rows, clock } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(403);
    clock.advance(59_000);
    expect(await statuses(app, DENIED_CALL, 19)).toEqual(all(403, 19));
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(429);
    clock.advance(1_000);
    expect(await statuses(app, DENIED_CALL, 20)).toEqual(all(403, 20));
    expect(rows).toHaveLength(40);
  });

  it('reset of one key: its next denied call is audited again; other keys keep their count', async () => {
    const { app, actAs, rows } = await budgetApp();
    actAs(operatorPrincipal('OP-0002'));
    await statuses(app, DENIED_CALL, 20);
    actAs(operatorPrincipal('OP-0001'));
    await statuses(app, DENIED_CALL, 20);
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(429);

    throttleControl(app).reset('operator:OP-0001');
    expect(await throttleControl(app).inspect('operator:OP-0001')).toMatchObject({ used: 0, exhausted: false });
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(403);
    expect(rows).toHaveLength(41);
    actAs(operatorPrincipal('OP-0002'));
    expect((await app.inject(DENIED_CALL)).statusCode).toBe(429);
  });

  it('reset of everything, as a matrix test does between batches of at most 20 denied cells (GS-20)', async () => {
    const { app, actAs, rows } = await budgetApp();
    actAs(operatorPrincipal('OP-0001'));
    const seen: number[] = [];
    // 31 denied cells of one role, the number the specification names for TECHNICIAN.
    for (let cell = 0; cell < 31; cell += 1) {
      if (cell > 0 && cell % 20 === 0) throttleControl(app).reset();
      seen.push((await app.inject(DENIED_CALL)).statusCode);
    }
    expect(seen).toEqual(all(403, 31));
    expect(rows).toHaveLength(31);
  });

  it('inspect shows the budget as stage 5 sees it', async () => {
    const { app, actAs, clock } = await budgetApp();
    const control = throttleControl(app);
    expect(await control.inspect('operator:OP-0001')).toEqual({
      key: 'operator:OP-0001',
      limit: 20,
      used: 0,
      remaining: 20,
      exhausted: false,
      windowEndsAt: null,
    });
    actAs(operatorPrincipal('OP-0001'));
    clock.advance(5_000);
    await statuses(app, DENIED_CALL, 7);
    expect(await control.inspect('operator:OP-0001')).toEqual({
      key: 'operator:OP-0001',
      limit: 20,
      used: 7,
      remaining: 13,
      exhausted: false,
      windowEndsAt: CLOCK_START + 5_000 + 60_000,
    });
    // More calls than places: the count never shows more than the limit.
    await Promise.all(Array.from({ length: 40 }, () => app.inject(DENIED_CALL)));
    expect(await control.inspect('operator:OP-0001')).toMatchObject({ used: 20, remaining: 0, exhausted: true });
    clock.advance(60_000);
    expect(await control.inspect('operator:OP-0001')).toMatchObject({ used: 0, exhausted: false, windowEndsAt: null });
  });

  it('throttleControl says so when a test put another object behind the seam', async () => {
    const { app } = await budgetApp();
    app.seams.replace('denialBudget', { consume: async () => {} });
    expect(() => throttleControl(app)).toThrow('the seam was replaced');
  });
});

describe('a 429 of the budget is logged, not audited (GS-07)', () => {
  it('one announcement per key and window, and a request line per 429; nothing of the request is logged', async () => {
    const log = captureLog();
    const { app, actAs, rows } = await budgetApp({ config: unitTestConfig({ logLevel: 'trace' }), logStream: log.stream });
    actAs(operatorPrincipal('OP-0003'));
    const marked: InjectOptions = {
      method: 'POST',
      url: `${DENIED}?token=MARK-query-2c7e`,
      headers: { authorization: 'Bearer MARK-auth-91fd' },
      payload: { note: 'MARK-body-a0b3' },
    };
    await statuses(app, marked, 20);
    expect(await statuses(app, marked, 4)).toEqual(all(429, 4));
    expect((await app.inject({ method: 'GET', url: '/api/v1/scratch/MARK-param-55e8' })).statusCode).toBe(429);
    expect(rows).toHaveLength(20);

    const lines = log.lines();
    expect(lines.filter((line) => line.msg === 'rate limit reached')).toMatchObject([
      { level: 40, code: RATE_LIMITED, route: DENIED, limiter: 'denial-budget', key: 'operator:OP-0003', limit: 20 },
    ]);
    const refused = lines.filter((line) => line.msg === 'request completed' && line.status === 429);
    expect(refused).toHaveLength(5);
    expect(refused.map((line) => line.route)).toEqual([DENIED, DENIED, DENIED, DENIED, SCRATCH_PATTERN]);
    for (const line of refused) expect(line).toMatchObject({ code: RATE_LIMITED, principal: 'operator:OP-0003' });

    const text = log.text();
    for (const marker of ['MARK-query-2c7e', 'MARK-auth-91fd', 'MARK-body-a0b3', 'MARK-param-55e8', 'token=', 'Bearer ']) {
      expect(text, marker).not.toContain(marker);
    }
  });

  it('a refusal by consume itself (calls that arrived together) is announced the same way', async () => {
    const log = captureLog();
    const { app, actAs } = await budgetApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream });
    actAs(devicePrincipal('DEV-0004'));
    await Promise.all(Array.from({ length: 30 }, () => app.inject(DENIED_CALL)));
    expect(log.lines().filter((line) => line.msg === 'rate limit reached')).toMatchObject([
      { limiter: 'denial-budget', key: 'device:DEV-0004', limit: 20 },
    ]);
  });
});

describe('the limiter by itself (no app)', () => {
  const T0 = 5_000_000;

  it('take: 20 places per key and window, then a refusal with the seconds until the window ends', async () => {
    const budget = createDenialBudget();
    for (let index = 0; index < 20; index += 1) expect(await budget.take('class:local', T0 + index)).toBeNull();
    expect(await budget.take('class:local', T0 + 30_000)).toEqual({ retryAfterSeconds: 30, first: true });
    expect(await budget.take('class:local', T0 + 30_001)).toEqual({ retryAfterSeconds: 30, first: false });
    expect(await budget.take('class:web', T0 + 30_001)).toBeNull();
  });

  it('check: takes nothing, and refuses only once the key holds 20', async () => {
    const budget = createDenialBudget();
    expect(await budget.check('operator:OP-1', T0)).toBeNull();
    for (let index = 0; index < 19; index += 1) await budget.take('operator:OP-1', T0);
    for (let index = 0; index < 50; index += 1) expect(await budget.check('operator:OP-1', T0)).toBeNull();
    expect(await budget.inspect('operator:OP-1', T0)).toMatchObject({ used: 19, remaining: 1 });
    await budget.take('operator:OP-1', T0);
    expect(await budget.check('operator:OP-1', T0 + 1_500)).toEqual({ retryAfterSeconds: 59, first: true });
    expect(await budget.check('operator:OP-1', T0 + 60_000)).toBeNull();
  });

  it('two budgets do not share a counter: each app has its own', async () => {
    const one = createDenialBudget();
    const other = createDenialBudget();
    for (let index = 0; index < 20; index += 1) await one.take('class:web', T0);
    expect(await one.check('class:web', T0)).not.toBeNull();
    expect(await other.check('class:web', T0)).toBeNull();
    expect(await other.take('class:web', T0)).toBeNull();
  });
});
