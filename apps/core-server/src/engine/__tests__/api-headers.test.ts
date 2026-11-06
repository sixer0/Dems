// API-7 in ONE place (plan row W26, fix round B2a; decisions D78 DN-8, D87; review
// `gateway_check/04_cp_backend_foundation.md` §7.3). Database-free.
//
//   part 1   the hook by itself, on a bare Fastify instance: which answers get the two headers,
//            from which source, and that two requests at once never get each other's outcome;
//   part 2   the hook as the engine's unit adds it, on the real app WITHOUT the domain modules:
//            every POST operation of the contract registry, with a stand-in handler that sets
//            nothing, answers with both headers; no GET does.
//
// The app of part 2 must not depend on which module has landed (decision D85): the helper below
// is imported FIRST, so the domain modules add no route and a stand-in never stands beside a
// module's own route. The real routes of that app (identity, rbac, health) need a database; two
// real operations are called in `api-headers.db.test.ts`.
import '../../plugins/permission-guard/__tests__/without-domain-modules';

import { CORE_API_OPERATIONS, EPOCH_HEADER_NAME, REVISION_HEADER_NAME } from '@dems/shared/api';
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { REQUEST_STAGES, buildApp } from '../../app';
import { routeOfOperation } from '../../plugins/permission-guard';
import { captureLog, createFakePool, unitTestConfig } from '../../../test/support/config';
import { registerStatePositionHeaders, statePositionOf, type EngineHost, type StatePosition } from '../index';

const apps: FastifyInstance[] = [];

/** The name of a POST operation of the contract registry, and of a GET operation. */
const A_POST_OPERATION = CORE_API_OPERATIONS.find((operation) => operation.method === 'post')?.operationId ?? '';
const A_GET_OPERATION = CORE_API_OPERATIONS.find((operation) => operation.method === 'get')?.operationId ?? '';

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

/** `[x-dems-epoch, x-dems-revision]` of an answer; null for a header that is not there. */
function headersOf(response: LightMyRequestResponse): [string | null, string | null] {
  const read = (name: string): string | null => {
    const value = response.headers[name];
    return value === undefined ? null : String(value);
  };
  return [read(EPOCH_HEADER_NAME), read(REVISION_HEADER_NAME)];
}

describe('the header names', () => {
  it('are the contract\'s', () => {
    expect([EPOCH_HEADER_NAME, REVISION_HEADER_NAME]).toEqual(['x-dems-epoch', 'x-dems-revision']);
    expect([A_POST_OPERATION, A_GET_OPERATION].every((name) => name.length > 0)).toBe(true);
  });
});

describe('statePositionOf: what can stand in the two headers', () => {
  it('is the two numbers of an engine; null when one of them is missing or is no count', () => {
    expect(statePositionOf({ epoch: 7, revision: 41 })).toEqual({ epoch: 7, revision: 41 });
    expect(statePositionOf({ epoch: 0, revision: 0 })).toEqual({ epoch: 0, revision: 0 });
    for (const not of [{}, { epoch: 7 }, { revision: 41 }, { epoch: '7', revision: 41 }, { epoch: 7, revision: -1 }, { epoch: 1.5, revision: 1 }, { epoch: Number.NaN, revision: 1 }]) {
      expect(statePositionOf(not), JSON.stringify(not)).toBeNull();
    }
    // Nothing else of the object is taken along.
    expect(Object.keys(statePositionOf({ epoch: 1, revision: 2, running: true } as never) ?? {})).toEqual(['epoch', 'revision']);
  });
});

describe('part 1: the hook by itself', () => {
  /** What a route of the server has in its config: the operation of the contract registry it is (a POST operation). */
  const OPERATION = { config: { operationId: A_POST_OPERATION } } as const;

  /** A bare instance with the two hooks; `position` is what the engine says when an answer is sent. */
  function bare(position: { current: StatePosition | null } = { current: { epoch: 7, revision: 41 } }) {
    const app = Fastify();
    apps.push(app);
    const headers = registerStatePositionHeaders(app, () => position.current);
    return { app, headers, position };
  }

  it.each([200, 201, 202, 204, 299])('a POST answered %i gets both headers, from the engine as it is when the answer is sent', async (status) => {
    const { app, position } = bare();
    app.post('/command', OPERATION, async (_request, reply) => {
      // The engine moves while the handler runs: the answer carries what it is at the end.
      position.current = { epoch: 7, revision: 44 };
      return reply.code(status).send(status === 204 ? undefined : { done: true });
    });
    const response = await app.inject({ method: 'POST', url: '/command' });
    expect(response.statusCode).toBe(status);
    expect(headersOf(response)).toEqual(['7', '44']);
  });

  it('a POST whose handler returns a value, sends a body, or answers with a JSON body it parsed gets them too', async () => {
    const { app } = bare();
    app.post('/returns', OPERATION, async () => ({ ok: true }));
    app.post('/sends', OPERATION, (_request, reply) => {
      void reply.send({ ok: true });
    });
    app.post('/echo', OPERATION, async (request) => ({ got: request.body }));
    expect(headersOf(await app.inject({ method: 'POST', url: '/returns' }))).toEqual(['7', '41']);
    expect(headersOf(await app.inject({ method: 'POST', url: '/sends' }))).toEqual(['7', '41']);
    const echoed = await app.inject({ method: 'POST', url: '/echo', payload: { reason: 'Interview completed' } });
    expect(echoed.json()).toEqual({ got: { reason: 'Interview completed' } });
    expect(headersOf(echoed)).toEqual(['7', '41']);
  });

  it('the outcome of the unit the request ran wins over the engine\'s later position', async () => {
    const { app, headers, position } = bare();
    app.post('/command', OPERATION, async () => {
      // What the host does when the unit of this request committed.
      headers.note({ epoch: 7, revision: 42 });
      await new Promise((resolve) => setImmediate(resolve));
      // A tick and another client's command committed before this answer is sent.
      position.current = { epoch: 7, revision: 50 };
      return { done: true };
    });
    expect(headersOf(await app.inject({ method: 'POST', url: '/command' }))).toEqual(['7', '42']);
  });

  it('of several units of one request, the last committed outcome is the one', async () => {
    const { app, headers } = bare();
    app.post('/two', OPERATION, async () => {
      headers.note({ epoch: 7, revision: 42 });
      await Promise.resolve();
      headers.note({ epoch: 7, revision: 43 });
      return { done: true };
    });
    expect(headersOf(await app.inject({ method: 'POST', url: '/two' }))).toEqual(['7', '43']);
  });

  it('a header that the handler set stays; the other one is filled from the same position', async () => {
    const { app, headers } = bare();
    app.post('/both', OPERATION, async (_request, reply) => {
      headers.note({ epoch: 7, revision: 42 });
      void reply.header(EPOCH_HEADER_NAME, 3).header(REVISION_HEADER_NAME, 9);
      return { done: true };
    });
    app.post('/revision-only', OPERATION, async (_request, reply) => {
      void reply.header(REVISION_HEADER_NAME, 9);
      return { done: true };
    });
    app.post('/epoch-only', OPERATION, async (_request, reply) => {
      void reply.header(EPOCH_HEADER_NAME, 3);
      return { done: true };
    });
    expect(headersOf(await app.inject({ method: 'POST', url: '/both' }))).toEqual(['3', '9']);
    expect(headersOf(await app.inject({ method: 'POST', url: '/revision-only' }))).toEqual(['7', '9']);
    expect(headersOf(await app.inject({ method: 'POST', url: '/epoch-only' }))).toEqual(['3', '41']);
  });

  it('no GET gets them, whatever it answers; a GET that notes a position changes nothing', async () => {
    const { app, headers } = bare();
    app.get('/read', OPERATION, async () => {
      headers.note({ epoch: 9, revision: 99 });
      return { ok: true };
    });
    const response = await app.inject({ method: 'GET', url: '/read' });
    expect(response.statusCode).toBe(200);
    expect(headersOf(response)).toEqual([null, null]);
  });

  it.each([
    ['a handler that throws a 409', 409],
    ['a handler that throws a 403', 403],
    ['a handler that answers 400 itself', 400],
    ['a handler that fails', 500],
    ['a handler that redirects', 303],
  ] as const)('%s: no header, also when a unit of the request had committed', async (_what, status) => {
    const { app, headers } = bare();
    app.post('/command', OPERATION, async (_request, reply) => {
      headers.note({ epoch: 7, revision: 42 });
      if (status === 400 || status === 303) return reply.code(status).send({ refused: true });
      throw Object.assign(new Error('refused by the test'), { statusCode: status });
    });
    const response = await app.inject({ method: 'POST', url: '/command' });
    expect(response.statusCode).toBe(status);
    expect(headersOf(response)).toEqual([null, null]);
  });

  it('a POST that never reached its handler gets none: refused by a hook before it, a body that is no JSON, a route that does not exist', async () => {
    const { app } = bare();
    app.addHook('onRequest', async (request, reply) => {
      // A stand-in for a request stage that answers by itself, with a 2xx at that: not a handler's answer.
      if (request.url === '/stage') return reply.code(200).send({ stage: true });
      return undefined;
    });
    let reached = 0;
    app.post('/stage', OPERATION, async () => ({ reached: (reached += 1) }));
    app.post('/command', OPERATION, async () => ({ reached: (reached += 1) }));
    const staged = await app.inject({ method: 'POST', url: '/stage' });
    expect([staged.statusCode, headersOf(staged)]).toEqual([200, [null, null]]);
    const malformed = await app.inject({ method: 'POST', url: '/command', headers: { 'content-type': 'application/json' }, payload: '{"b2a": ' });
    expect([malformed.statusCode, headersOf(malformed)]).toEqual([400, [null, null]]);
    const unknown = await app.inject({ method: 'POST', url: '/nowhere' });
    expect([unknown.statusCode, headersOf(unknown)]).toEqual([404, [null, null]]);
    expect(reached).toBe(0);
  });

  it('with no position to tell (a test double behind the seam without the two numbers) nothing is set, and nothing fails', async () => {
    const { app } = bare({ current: null });
    app.post('/command', OPERATION, async () => ({ done: true }));
    const response = await app.inject({ method: 'POST', url: '/command' });
    expect([response.statusCode, headersOf(response)]).toEqual([200, [null, null]]);
  });

  it('two requests at once: each answer carries the outcome of ITS unit, however their work interleaves', async () => {
    const { app, headers } = bare();
    const gates = new Map<string, () => void>();
    const waiting = (name: string): Promise<void> => new Promise((resolve) => gates.set(name, resolve));
    const entered: string[] = [];
    app.post('/command/:name', OPERATION, async (request) => {
      const { name } = request.params as { name: string };
      entered.push(name);
      await waiting(`${name}:before`);
      headers.note({ epoch: 7, revision: name === 'first' ? 42 : 43 });
      await waiting(`${name}:after`);
      return { name };
    });
    const first = app.inject({ method: 'POST', url: '/command/first', payload: { a: 1 } });
    const second = app.inject({ method: 'POST', url: '/command/second', payload: { b: 2 } });
    const until = async (key: string): Promise<() => void> => {
      for (let turn = 0; turn < 1_000; turn += 1) {
        const open = gates.get(key);
        if (open !== undefined) return open;
        await new Promise((resolve) => setImmediate(resolve));
      }
      throw new Error(`the handler never waited at ${key}`);
    };
    // second notes first, first answers last: the order of the notes is not the order of the answers.
    (await until('second:before'))();
    (await until('first:before'))();
    (await until('first:after'))();
    (await until('second:after'))();
    const [a, b] = await Promise.all([first, second]);
    expect(entered.sort()).toEqual(['first', 'second']);
    expect([a.json(), headersOf(a)]).toEqual([{ name: 'first' }, ['7', '42']]);
    expect([b.json(), headersOf(b)]).toEqual([{ name: 'second' }, ['7', '43']]);
  });

  it('a POST route that names no operation of the registry (a scratch route of a test) gets none: API-7 is a rule of the contract\'s operations', async () => {
    const { app, headers } = bare();
    app.post('/scratch', async () => {
      headers.note({ epoch: 7, revision: 42 });
      return { done: true };
    });
    // A name of its own is not an operation of the registry; neither is the name of a GET operation.
    app.post('/named', { config: { operationId: 'scratchCommand' } }, async () => ({ done: true }));
    app.post('/read', { config: { operationId: A_GET_OPERATION } }, async () => ({ done: true }));
    app.post('/operation', OPERATION, async () => ({ done: true }));
    const scratch = await app.inject({ method: 'POST', url: '/scratch' });
    expect([scratch.statusCode, headersOf(scratch)]).toEqual([200, [null, null]]);
    for (const url of ['/named', '/read']) {
      const response = await app.inject({ method: 'POST', url });
      expect([response.statusCode, headersOf(response)], url).toEqual([200, [null, null]]);
    }
    // The note of the scratch route went nowhere: the next operation reads the engine.
    expect(headersOf(await app.inject({ method: 'POST', url: '/operation' }))).toEqual(['7', '41']);
  });

  it('a note outside any request does nothing, and does not reach the next request', async () => {
    const { app, headers } = bare();
    headers.note({ epoch: 9, revision: 99 });
    app.post('/command', OPERATION, async () => ({ done: true }));
    expect(headersOf(await app.inject({ method: 'POST', url: '/command' }))).toEqual(['7', '41']);
    headers.note({ epoch: 9, revision: 99 });
    expect(headersOf(await app.inject({ method: 'POST', url: '/command' }))).toEqual(['7', '41']);
  });
});

describe('part 2: every POST operation of the contract registry, on the real app without the domain modules', () => {
  const POSTS = CORE_API_OPERATIONS.filter((operation) => operation.method === 'post');
  const GETS = CORE_API_OPERATIONS.filter((operation) => operation.method === 'get');
  /** A concrete URL for a route pattern: every path parameter gets a value. */
  const urlOf = (pattern: string): string => pattern.replace(/:[A-Za-z]+/g, 'X-1');

  /**
   * The real app factory, database-free, with a stand-in handler for every registry operation
   * that no unit of this app registered. The request stages are taken out AFTER the boot check
   * of the routes ran: this test is about what follows them. The engine behind the seam is a
   * double with a known position.
   */
  async function standInApp(position: { epoch: number; revision: number }) {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'warn' }), logStream: log.stream, createPool: () => createFakePool().pool });
    apps.push(app);
    const standIns: string[] = [];
    const reached: string[] = [];
    // A plugin registered after the units, as a module is: every unit's route exists when it looks.
    void app.register(async (instance) => {
      for (const operation of CORE_API_OPERATIONS) {
        const route = routeOfOperation(operation);
        if (instance.hasRoute({ method: route.method, url: route.url })) continue;
        instance.route({
          ...route,
          handler: async () => {
            reached.push(operation.operationId);
            return { reached: operation.operationId };
          },
        });
        standIns.push(operation.operationId);
      }
    });
    await app.ready();
    for (const stage of REQUEST_STAGES) app.stages.replace(stage, () => {});
    app.seams.replace('engine', position as unknown as EngineHost);
    return { app, standIns, reached };
  }

  it('the registry has POST operations and GET operations, and a stand-in stands for every operation of a domain module', async () => {
    const { standIns } = await standInApp({ epoch: 7, revision: 41 });
    expect(POSTS.length).toBeGreaterThan(30);
    expect(GETS.length).toBeGreaterThan(20);
    const real = CORE_API_OPERATIONS.filter((operation) => !standIns.includes(operation.operationId));
    // The units that stay real in this app: health, identity (with biometric) and rbac. Their six POST operations
    // need a database: `api-headers.db.test.ts` calls each of them on the real server.
    expect(real.filter((operation) => operation.method === 'post').map((operation) => operation.operationId)).toEqual([
      'signIn',
      'signOut',
      'touchSession',
      'setBiometricEnrollment',
      'signInWithBiometric',
      'reportBiometricFailure',
    ]);
    // Operation 114 `getPanelFirmware` is NOT in this list: this app is built without the domain modules, so the devices unit registers no route and the operation keeps its stand-in.
    expect(real.filter((operation) => operation.method === 'get').map((operation) => operation.operationId)).toEqual(['getServiceHealth', 'getSignInStatus', 'getAuthSession', 'getRoleMatrix']);
    expect(standIns).toHaveLength(CORE_API_OPERATIONS.length - 10);
    console.info(`[b2a] API-7 table: ${POSTS.length} POST and ${GETS.length} GET operations in the registry; stand-ins for ${standIns.length}; real in this app: ${real.map((operation) => `${operation.method.toUpperCase()} ${operation.operationId}`).join(', ')}`);
  });

  it('every POST operation with a stand-in handler, which sets no header, answers 200 with both headers of the engine', async () => {
    const { app, standIns, reached } = await standInApp({ epoch: 7, revision: 41 });
    const table = POSTS.filter((operation) => standIns.includes(operation.operationId));
    expect(table.length).toBeGreaterThan(30);
    const answers: Array<[string, number, [string | null, string | null]]> = [];
    for (const operation of table) {
      const response = await app.inject({ method: 'POST', url: urlOf(routeOfOperation(operation).url), payload: {} });
      answers.push([operation.operationId, response.statusCode, headersOf(response)]);
    }
    expect(answers).toEqual(table.map((operation) => [operation.operationId, 200, ['7', '41']]));
    expect(reached).toEqual(table.map((operation) => operation.operationId));
  });

  it('no GET operation with a stand-in handler gets a header', async () => {
    const { app, standIns } = await standInApp({ epoch: 7, revision: 41 });
    const table = GETS.filter((operation) => standIns.includes(operation.operationId));
    expect(table.length).toBeGreaterThan(20);
    const answers: Array<[string, number, [string | null, string | null]]> = [];
    for (const operation of table) {
      const response = await app.inject({ method: 'GET', url: urlOf(routeOfOperation(operation).url) });
      answers.push([operation.operationId, response.statusCode, headersOf(response)]);
    }
    expect(answers).toEqual(table.map((operation) => [operation.operationId, 200, [null, null]]));
  });

  it('a POST that a request stage refuses gets none, on every operation: the stages run before the hook\'s record exists', async () => {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'fatal' }), logStream: log.stream, createPool: () => createFakePool().pool });
    apps.push(app);
    await app.ready();
    app.seams.replace('engine', { epoch: 7, revision: 41 } as unknown as EngineHost);
    // The server is not ready (no boot): stage 2 answers every operation with 503.
    const statuses = new Set<number>();
    for (const operation of POSTS) {
      const response = await app.inject({ method: 'POST', url: urlOf(routeOfOperation(operation).url), payload: {} });
      statuses.add(response.statusCode);
      expect(headersOf(response), operation.operationId).toEqual([null, null]);
    }
    expect([...statuses].every((status) => status >= 400)).toBe(true);
  });

  it('the real engine before a start says epoch 0, revision 0: the headers are there and say so', async () => {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'warn' }), logStream: log.stream, createPool: () => createFakePool().pool });
    apps.push(app);
    const operation = POSTS.find((candidate) => candidate.operationId === 'setStoragePolicy');
    if (operation === undefined) throw new Error('the registry has no POST operation');
    void app.register(async (instance) => {
      instance.route({ ...routeOfOperation(operation), handler: async () => ({ done: true }) });
    });
    await app.ready();
    for (const stage of REQUEST_STAGES) app.stages.replace(stage, () => {});
    const response = await app.inject({ method: 'POST', url: urlOf(routeOfOperation(operation).url), payload: {} });
    expect([response.statusCode, headersOf(response)]).toEqual([200, ['0', '0']]);
  });
});
