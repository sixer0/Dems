// The guard in the app factory, without a database (plan row W28; spec §2.3 stage 6, §4.6 RB-1,
// RB-4, RB-6; SR-43, SR-45, SR-71; AC-B-12; decisions D82, D85). The pool is the core's stand-in,
// which commits what a unit of work appends; stage 4 is a stand-in that makes the caller whoever
// the test says. The same paths with the real stages 3 to 5 and PostgreSQL are in the database
// tests of this folder.
//
// THE APP OF THIS FILE HAS NO DOMAIN MODULE (decision D85): `./without-domain-modules` is the
// first import, so the eleven domain modules and the realtime channel add no route. The tests
// give the operations they call stand-in handlers, and no stand-in ever stands beside a module's
// route. Nothing here depends on which modules have landed, and nothing pins which operations
// are registered: that is read from the app. What the REAL server registers is asked in
// `registered-routes.test.ts`.
import './without-domain-modules';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CORE_API_OPERATIONS, IDENTITY_OPERATIONS, UserRoleRequestSchema } from '@dems/shared/api';
import { ROLE_PERMISSIONS, createManualClock, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { CLOCK_START, standInDatabase, type StandInDatabase } from '../../../../test/support/core';
import { ANONYMOUS_PRINCIPAL, type Principal } from '../../authenticate';
import { captureLog, credentialLeaks, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { throttleControl } from '../../throttle';
import {
  AccessRuleError,
  AccessRuleErrorCode,
  DENIAL_UNIT_LABEL,
  REALTIME_CHANNEL_ID,
  permissionGuard,
  routeOfOperation,
  routePatternOf,
  routesOfPrintedTable,
} from '../index';
import { channelRoute, operationOf, passScratchRoutes, registryRoutes } from '../../../../test/support/guard';

const scratchDir = mkdtempSync(join(tmpdir(), 'dems-w28-guard-'));
const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

interface Built {
  readonly app: FastifyInstance;
  readonly log: CapturedLog;
  readonly database: StandInDatabase;
  readonly errorLogFile: string;
  /** The operations whose stand-in handler ran, in order. */
  readonly reached: string[];
  /** Who the next requests come from. */
  actAs(principal: Principal): void;
}

interface BuildOptions {
  /** Routes added to the instance itself, before `ready()`: no plugin's hook is shown them. */
  readonly topLevel?: (app: FastifyInstance) => void;
  /** Routes added by a plugin that is registered after the units, as a module's are. */
  readonly routes?: (instance: FastifyInstance, reached: string[]) => void;
  readonly beforeReady?: (app: FastifyInstance) => void;
  readonly database?: StandInDatabase;
  readonly demoControls?: boolean;
}

let builds = 0;

/** The real app factory, not yet ready. */
function build(options: BuildOptions = {}): Built {
  const log = captureLog();
  const database = options.database ?? standInDatabase();
  builds += 1;
  const errorLogFile = join(scratchDir, `errors-${builds}.log`);
  const app = buildApp({
    config: unitTestConfig({ logLevel: 'info', demoControls: options.demoControls ?? false }),
    createPool: () => database.pool,
    logStream: log.stream,
    errorLogFile,
  });
  apps.push(app);
  const reached: string[] = [];
  options.topLevel?.(app);
  if (options.routes !== undefined) {
    const { routes } = options;
    void app.register(async (instance) => routes(instance, reached));
  }
  options.beforeReady?.(app);
  let current: Principal = ANONYMOUS_PRINCIPAL;
  // Stage 4 as a stand-in: the caller is who the test says. Stages 3, 5 and 6 are the real ones.
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  return {
    app,
    log,
    database,
    errorLogFile,
    reached,
    actAs(principal) {
      current = principal;
    },
  };
}

async function ready(options: BuildOptions = {}): Promise<Built> {
  const built = build(options);
  await built.app.ready();
  built.app.seams.replace('clock', createManualClock(CLOCK_START));
  built.app.readiness.set('database', true);
  built.app.readiness.set('engine', true);
  return built;
}

async function rejection(promise: PromiseLike<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('the promise resolved');
    },
    (error: unknown) => error,
  );
}

const OPERATOR_OF: Record<OperatorRole, string> = { INVESTIGATOR: 'OPR-001', SUPERVISOR: 'OPR-002', TECHNICIAN: 'OPR-003' };
const operator = (role: OperatorRole, deviceId: string | null = null): Principal => ({
  kind: 'OPERATOR',
  operatorId: OPERATOR_OF[role],
  sessionId: `session-${role}`,
  deviceId,
  role,
  permissions: ROLE_PERMISSIONS[role],
});

const errorOf = (response: { json(): unknown }): { code: string; message: string; details?: Record<string, unknown> } =>
  (response.json() as { error: { code: string; message: string; details?: Record<string, unknown> } }).error;
const errorLogOf = (built: Built): Array<Record<string, unknown>> => {
  try {
    return readFileSync(built.errorLogFile, 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    return [];
  }
};

/** Every operation of the registry, in registry order. */
const ALL_OPERATIONS = CORE_API_OPERATIONS.map((operation) => operation.operationId);
/** The operations of the real units that the tests of this row call: health (W08), the identity core (W24), this row's module. */
const NEEDED_HERE = ['getServiceHealth', 'signIn', 'getSignInStatus', 'getAuthSession', 'signOut', 'touchSession', 'getRoleMatrix'];
/** What the three real units of this file's app may register: health, the identity area, operation 10. */
const OF_THE_REAL_UNITS = ['getServiceHealth', 'getRoleMatrix', ...IDENTITY_OPERATIONS.map((operation) => operation.operationId)];

describe('RB-1, AC-B-12: the boot check of app.ready()', () => {
  it('the app without the domain modules is ready: every registered route is a registry operation with its rule, none twice, and all are of the three real units', async () => {
    const { app } = await ready();
    const guard = permissionGuard(app);
    expect(guard.routeProblems()).toEqual([]);
    const registered = guard.registeredRules();
    const ids = registered.map((rule) => rule.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of registered) {
      // The rule the guard holds for the route IS the rule of that operation in the registry.
      expect(guard.rules.ruleOf(rule.operationId)).toBe(rule);
      const operation = operationOf(rule.operationId);
      expect([rule.operationId, rule.method, rule.url]).toEqual([rule.operationId, operation.method.toUpperCase(), routePatternOf(operation.path)]);
    }
    // No count and no list of what a module has registered: what this row's tests call is
    // there, and nothing of a domain module is.
    for (const operationId of NEEDED_HERE) expect(ids).toContain(operationId);
    expect(ids.filter((operationId) => !OF_THE_REAL_UNITS.includes(operationId))).toEqual([]);
  });

  it('a route without an access rule and an audit rule stops the boot, by name, with one log line and one entry in the error log', async () => {
    const built = build({ routes: (instance) => instance.get('/api/v1/scratch', async () => ({ open: true })) });
    const error = await rejection(built.app.ready());
    expect(error).toBeInstanceOf(AccessRuleError);
    expect(error).toMatchObject({
      code: AccessRuleErrorCode.ROUTE_WITHOUT_RULES,
      problems: [{ code: 'ROUTE_WITHOUT_RULES', operationId: null, route: 'GET /api/v1/scratch' }],
    });
    const lines = built.log.lines().filter((line) => Number(line['level']) >= 50);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ code: 'ROUTE_WITHOUT_RULES', msg: 'a registered route has no access rule or no audit rule: the server does not start' });
    expect(errorLogOf(built)).toEqual([
      expect.objectContaining({
        level: 'fatal',
        source: 'permissionGuard.routes',
        code: 'ROUTE_WITHOUT_RULES',
        context: {
          codes: 'ROUTE_WITHOUT_RULES',
          operations: '',
          routes: 'GET /api/v1/scratch',
          details: 'the route is no operation of the contract registry: it has no access rule and no audit rule',
        },
      }),
    ]);
  });

  it('a made-up operationId gives a route no rule either', async () => {
    const built = build({ routes: (instance) => instance.post('/api/v1/scratch', { config: { operationId: 'scratchCommand' } }, async () => ({})) });
    expect(await rejection(built.app.ready())).toMatchObject({ code: AccessRuleErrorCode.ROUTE_WITHOUT_RULES });
  });

  it('a route that names a PUBLIC registry operation on a path of its own is refused: it cannot borrow the rule', async () => {
    const built = build({ routes: (instance) => instance.get('/api/v1/secret', { config: { operationId: 'getServiceHealth' } }, async () => ({})) });
    expect(await rejection(built.app.ready())).toMatchObject({
      code: AccessRuleErrorCode.ROUTE_NOT_THE_OPERATION,
      problems: [{ operationId: 'getServiceHealth', route: 'GET /api/v1/secret' }],
    });
  });

  it('a registry route without config.operationId, or with another one, is refused: stages 2 and 5 read that member too', async () => {
    const users = routeOfOperation(operationOf('listUsers'));
    const missing = build({ routes: (instance) => instance.route({ method: users.method, url: users.url, handler: async () => ({}) }) });
    expect(await rejection(missing.app.ready())).toMatchObject({ code: AccessRuleErrorCode.OPERATION_ID_MISMATCH, problems: [{ operationId: 'listUsers' }] });
    const other = build({
      routes: (instance) => instance.route({ method: users.method, url: users.url, config: { operationId: 'getServiceHealth' }, handler: async () => ({}) }),
    });
    expect(await rejection(other.app.ready())).toMatchObject({ code: AccessRuleErrorCode.OPERATION_ID_MISMATCH });
  });

  it('every route without a rule is named, not only the first', async () => {
    const built = build({
      routes: (instance) => {
        instance.get('/api/v1/one', async () => ({}));
        instance.route({ method: ['GET', 'POST'], url: '/api/v1/two', handler: async () => ({}) });
        registryRoutes(instance, ['listUsers']);
      },
    });
    const error = await rejection(built.app.ready());
    expect((error as AccessRuleError).problems.map((problem) => problem.route)).toEqual(['GET /api/v1/one', 'GET /api/v1/two', 'POST /api/v1/two']);
  });

  it('EVERY operation of the registry can be registered under the guard: the real route where a real unit has one, a stand-in for each of the rest, and the socket route', async () => {
    const added: string[] = [];
    let socketAdded = false;
    const { app } = await ready({
      routes: (instance) => {
        // A stand-in only where the app has no route: asked of the app, not of a list.
        added.push(...registryRoutes(instance, ALL_OPERATIONS));
        socketAdded = channelRoute(instance);
      },
    });
    const guard = permissionGuard(app);
    expect(guard.routeProblems()).toEqual([]);
    const registered = guard.registeredRules();
    // What is registered is exactly the registry and the socket route, each once.
    expect(registered.map((rule) => rule.operationId).sort()).toEqual([...ALL_OPERATIONS, REALTIME_CHANNEL_ID].sort());
    expect(ALL_OPERATIONS).toHaveLength(92);
    // Each one with the rule of its registry entry, at its registry route.
    for (const operationId of ALL_OPERATIONS) expect(registered.find((rule) => rule.operationId === operationId)).toBe(guard.rules.ruleOf(operationId));
    // The stand-ins and the routes of the real units make up the registry, and no operation is in both.
    const plain = await ready();
    const real = permissionGuard(plain.app).registeredRules().map((rule) => rule.operationId);
    expect([...added, ...real].sort()).toEqual([...ALL_OPERATIONS].sort());
    expect(socketAdded).toBe(true);
  });

  it('a test that takes stage 6 out before ready() gets its scratch routes: the check is skipped with one warn line', async () => {
    const built = build({
      routes: (instance) => instance.get('/api/v1/scratch', async () => ({ open: true })),
      beforeReady: (app) => app.stages.replace('accessRule', () => {}),
    });
    await built.app.ready();
    built.app.readiness.set('database', true);
    built.app.readiness.set('engine', true);
    expect((await built.app.inject({ method: 'GET', url: '/api/v1/scratch' })).statusCode).toBe(200);
    const warned = built.log.lines().filter((line) => String(line['msg']).startsWith('the access rule stage was replaced'));
    expect(warned).toHaveLength(1);
    expect(warned[0]).toMatchObject({ level: 40, unchecked: 1 });
    // The controls are still there, and still say what the check would have found.
    expect(permissionGuard(built.app).routeProblems()).toHaveLength(1);
  });

  it('permissionGuard(app) is not there before ready()', () => {
    const built = build();
    expect(() => permissionGuard(built.app)).toThrow(/after app.ready/);
  });
});

describe('a route that was added before the plugins ran (decision D82, condition 4)', () => {
  it('is not shown to the boot check of ready(): the app becomes ready, and the route is refused at its first request with 500, logged with the code', async () => {
    const built = await ready({ topLevel: (app) => app.get('/api/v1/scratch', async () => ({ open: true })) });
    expect(permissionGuard(built.app).routeProblems()).toEqual([]);
    const response = await built.app.inject({ method: 'GET', url: '/api/v1/scratch' });
    expect(response.statusCode).toBe(500);
    expect(errorOf(response)).toMatchObject({ code: 'INTERNAL_ERROR', message: 'The server could not complete the request.' });
    expect(built.log.lines().find((line) => line['msg'] === 'unexpected error while handling a request')).toMatchObject({
      level: 50,
      err: { type: 'AccessRuleError', code: 'ROUTE_WITHOUT_RULES' },
    });
    expect(errorLogOf(built)).toEqual([expect.objectContaining({ level: 'error', errorName: 'AccessRuleError', code: 'ROUTE_WITHOUT_RULES' })]);
    // Whoever calls: an operator with every permission is refused as well.
    built.actAs(operator('SUPERVISOR'));
    expect((await built.app.inject({ method: 'GET', url: '/api/v1/scratch' })).statusCode).toBe(500);
  });

  it('checkRouter, the first thing the boot step does, finds it in the router and stops the boot before the listener', async () => {
    const built = await ready({
      topLevel: (app) => {
        app.get('/api/v1/scratch', async () => ({}));
        app.post('/api/v1/scratch/:id/deep', async () => ({}));
        app.get('/api/v1/wild/*', async () => ({}));
      },
    });
    let thrown: unknown;
    try {
      permissionGuard(built.app).checkRouter();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AccessRuleError);
    expect((thrown as AccessRuleError).problems.map((problem) => `${problem.code} ${problem.route}`).sort()).toEqual([
      'ROUTE_WITHOUT_RULES GET /api/v1/scratch',
      'ROUTE_WITHOUT_RULES GET /api/v1/wild/*',
      'ROUTE_WITHOUT_RULES POST /api/v1/scratch/:id/deep',
    ]);
    expect(errorLogOf(built)).toEqual([expect.objectContaining({ level: 'fatal', source: 'permissionGuard.checkRouter', code: 'ROUTE_WITHOUT_RULES' })]);
  });

  it('the boot step rbac.matrix runs checkRouter: the boot stops there even on a database that would pass', async () => {
    const built = await ready({ topLevel: (app) => app.get('/api/v1/scratch', async () => ({})) });
    // The steps before it need PostgreSQL; the step itself is what is asked here.
    const guard = permissionGuard(built.app);
    expect(() => guard.checkRouter()).toThrow(AccessRuleError);
    expect(guard.matrix()).toBeNull();
  });

  it('a registry operation that was added early passes checkRouter, gets its registry rule at its first request and is guarded', async () => {
    const built = await ready({ topLevel: (app) => registryRoutes(app, ['listUsers']) });
    expect(permissionGuard(built.app).registeredRules().map((rule) => rule.operationId)).not.toContain('listUsers');
    expect(() => permissionGuard(built.app).checkRouter()).not.toThrow();
    expect((await built.app.inject({ method: 'GET', url: '/api/v1/admin/users' })).statusCode).toBe(401);
    built.actAs(operator('TECHNICIAN'));
    expect((await built.app.inject({ method: 'GET', url: '/api/v1/admin/users' })).statusCode).toBe(403);
    built.actAs(operator('SUPERVISOR'));
    expect((await built.app.inject({ method: 'GET', url: '/api/v1/admin/users' })).statusCode).toBe(200);
    expect(permissionGuard(built.app).registeredRules().map((rule) => rule.operationId)).toContain('listUsers');
  });

  it('what checkRouter cannot see: the operationId of an early route. A registry path with a wrong one passes the walk and is refused at its request', async () => {
    const users = routeOfOperation(operationOf('listUsers'));
    const built = await ready({
      topLevel: (app) => app.route({ method: users.method, url: users.url, config: { operationId: 'getServiceHealth' }, handler: async () => ({ open: true }) }),
    });
    expect(() => permissionGuard(built.app).checkRouter()).not.toThrow();
    built.actAs(operator('SUPERVISOR'));
    const response = await built.app.inject({ method: 'GET', url: users.url });
    expect(response.statusCode).toBe(500);
    expect(built.log.lines().find((line) => line['msg'] === 'unexpected error while handling a request')).toMatchObject({ err: { code: 'OPERATION_ID_MISMATCH' } });
  });

  it('the printed route table gives back exactly the routes the guard was shown: every operation of the registry and the socket', async () => {
    const { app } = await ready({
      routes: (instance) => {
        registryRoutes(instance, ALL_OPERATIONS);
        channelRoute(instance);
      },
    });
    const printed = routesOfPrintedTable(app.printRoutes()).map((route) => `${route.method} ${route.url}`).sort();
    const shown = permissionGuard(app).registeredRules().map((rule) => `${rule.method} ${rule.url}`).sort();
    expect(printed).toEqual(shown);
    expect(printed).toHaveLength(ALL_OPERATIONS.length + 1);
    expect(() => permissionGuard(app).checkRouter()).not.toThrow();
  });

  it('checkRouter does nothing but warn when a test took stage 6 out', async () => {
    const built = await ready({ topLevel: (app) => app.get('/api/v1/scratch', async () => ({})) });
    built.app.stages.replace('accessRule', () => {});
    expect(() => permissionGuard(built.app).checkRouter()).not.toThrow();
    expect(built.log.lines().filter((line) => String(line['msg']).startsWith('the access rule stage was replaced'))).toHaveLength(1);
  });
});

describe('the printed route table (router-table.ts)', () => {
  it('reads the radix tree: fragments from the root to the node, one route per method', () => {
    const table = [
      '└── /',
      '    ├── api/v1/',
      '    │   ├── scratch (GET, POST)',
      '    │   │   └── /',
      '    │   │       └── :id (GET)',
      '    │   │           └── /deep (POST)',
      '    │   ├── wild/',
      '    │   │   └── * (GET)',
      '    │   └── auth/',
      '    │       ├── s',
      '    │       │   ├── ign-',
      '    │       │   │   ├── in (POST)',
      '    │       │   │   └── out (POST)',
      '    │       │   └── tatus (GET)',
      '    │       └── touch (POST)',
      '    └── ws (GET)',
      '',
    ].join('\n');
    expect(routesOfPrintedTable(table).map((route) => `${route.method} ${route.url}`)).toEqual([
      'GET /api/v1/scratch',
      'POST /api/v1/scratch',
      'GET /api/v1/scratch/:id',
      'POST /api/v1/scratch/:id/deep',
      'GET /api/v1/wild/*',
      'POST /api/v1/auth/sign-in',
      'POST /api/v1/auth/sign-out',
      'GET /api/v1/auth/status',
      'POST /api/v1/auth/touch',
      'GET /ws',
    ]);
    expect(routesOfPrintedTable('')).toEqual([]);
  });

  it('refuses a table it cannot read rather than skip a line of it', () => {
    expect(() => routesOfPrintedTable('GET /api/v1/health')).toThrow(/no node of the route tree/);
    expect(() => routesOfPrintedTable('└── /api/v1/health (GET) {"version":"1.0.0"}')).toThrow(/not known/);
  });
});

describe('stage 6 in the pipeline', () => {
  const standIns = ['startSession', 'listUsers', 'setStoragePolicy', 'unpairDevice', 'resetDemo'];
  const withStandIns = (options: BuildOptions = {}): Promise<Built> =>
    ready({
      ...options,
      routes: (instance, reached) => {
        registryRoutes(instance, standIns, reached);
        options.routes?.(instance, reached);
      },
    });
  const startSession = { method: 'POST', url: '/api/v1/session/SES-20261001-0001/start' } as const;

  it('a denied call answers 403 and commits exactly one row in one unit; an allowed call commits none and reaches the handler', async () => {
    const built = await withStandIns();
    built.actAs(operator('TECHNICIAN'));
    const units = built.app.pipeline.snapshot().completed;
    const denied = await built.app.inject(startSession);
    expect(denied.statusCode).toBe(403);
    expect(errorOf(denied)).toMatchObject({ code: 'NOT_PERMITTED', details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' } });
    expect(built.database.committed.auditSeqs).toEqual([1]);
    expect(built.database.committed.eventSeqs).toEqual([]);
    expect(built.app.pipeline.snapshot().completed).toBe(units + 1);
    expect(built.reached).toEqual([]);

    built.actAs(operator('INVESTIGATOR'));
    expect((await built.app.inject(startSession)).statusCode).toBe(200);
    expect(built.database.committed.auditSeqs).toEqual([1]);
    expect(built.app.pipeline.snapshot().completed).toBe(units + 1);
    expect(built.reached).toEqual(['startSession']);
    expect(DENIAL_UNIT_LABEL).toBe('rbac.denied');
  });

  it('a 401 writes no row, runs no unit and takes no place in the denial budget', async () => {
    const built = await withStandIns();
    const units = built.app.pipeline.snapshot().completed;
    for (const request of [startSession, { method: 'GET', url: '/api/v1/admin/users' } as const, { method: 'POST', url: '/api/v1/pairing/device/unpair' } as const]) {
      const response = await built.app.inject(request);
      expect(response.statusCode).toBe(401);
      expect(errorOf(response).code).toBe('NOT_SIGNED_IN');
    }
    expect(built.database.committed.auditSeqs).toEqual([]);
    expect(built.app.pipeline.snapshot().completed).toBe(units);
    expect(await throttleControl(built.app).inspect('class:local')).toMatchObject({ used: 0 });
  });

  it('DEVICE_NOT_PAIRED and DEMO_DISABLED write no row and take no place; each is one warn line', async () => {
    const built = await withStandIns();
    built.actAs(operator('SUPERVISOR'));
    const unpair = await built.app.inject({ method: 'POST', url: '/api/v1/pairing/device/unpair' });
    expect([unpair.statusCode, errorOf(unpair).code]).toEqual([403, 'DEVICE_NOT_PAIRED']);
    const reset = await built.app.inject({ method: 'POST', url: '/api/v1/demo/reset' });
    expect([reset.statusCode, errorOf(reset).code]).toEqual([403, 'DEMO_DISABLED']);
    expect(built.database.committed.auditSeqs).toEqual([]);
    expect(await throttleControl(built.app).inspect('operator:OPR-002')).toMatchObject({ used: 0 });
    const refused = built.log.lines().filter((line) => line['msg'] === 'request refused by the access rule');
    expect(refused.map((line) => [line['code'], line['operationId'], line['audited'], line['level']])).toEqual([
      ['DEVICE_NOT_PAIRED', 'unpairDevice', false, 40],
      ['DEMO_DISABLED', 'resetDemo', false, 40],
    ]);
    // DC-1: without the permission the answer is NOT_PERMITTED, whatever the flag.
    built.actAs(operator('TECHNICIAN'));
    expect(errorOf(await built.app.inject({ method: 'POST', url: '/api/v1/demo/reset' })).code).toBe('NOT_PERMITTED');
  });

  it('the console rule ID-1 is applied by the stage itself: signIn without a console identity is refused here, with the stage\'s own line', async () => {
    const built = await withStandIns();
    const response = await built.app.inject({ method: 'POST', url: '/api/v1/auth/sign-in', payload: { username: 'someone', password: 'not-a-password' } });
    expect([response.statusCode, errorOf(response).code]).toEqual([403, 'DEVICE_NOT_PAIRED']);
    const lines = built.log.lines().filter((line) => line['msg'] === 'request refused by the access rule');
    expect(lines).toEqual([expect.objectContaining({ code: 'DEVICE_NOT_PAIRED', operationId: 'signIn', access: 'PUBLIC', refusedBy: 'CONSOLE_IDENTITY', audited: false })]);
    expect(built.database.committed.auditSeqs).toEqual([]);
  });

  it("CPS1-3: an operation that needs the device's own credential refuses the session of an operator on the device: 403 DEVICE_NOT_PAIRED with its reason, no row, no unit, no place in the budget; the device itself reaches the handler", async () => {
    const built = await withStandIns({ routes: (instance, reached) => void registryRoutes(instance, ['rotateDeviceCredential'], reached) });
    const rotate = { method: 'POST', url: '/api/v1/pairing/device/credential' } as const;
    const units = built.app.pipeline.snapshot().completed;

    built.actAs(operator('INVESTIGATOR', 'DEV-0001'));
    const refused = await built.app.inject(rotate);
    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toMatchObject({ code: 'DEVICE_NOT_PAIRED', message: "This operation needs the device's own credential.", details: { reason: 'DEVICE_CREDENTIAL_REQUIRED' } });
    expect(built.reached).toEqual([]);
    expect(built.database.committed.auditSeqs).toEqual([]);
    expect(built.app.pipeline.snapshot().completed).toBe(units);
    expect(await throttleControl(built.app).inspect('operator:OPR-001')).toMatchObject({ used: 0 });
    // One warn line of the stage. What refused stands under a key of its own: a log line has no
    // member named `reason` or `cause` (standing rule M14); `details.reason` is the answer's.
    const lines = built.log.lines().filter((line) => line['msg'] === 'request refused by the access rule');
    expect(lines).toEqual([
      expect.objectContaining({ level: 40, code: 'DEVICE_NOT_PAIRED', operationId: 'rotateDeviceCredential', access: 'DEVICE', refusedBy: 'DEVICE_CREDENTIAL', audited: false }),
    ]);
    expect(Object.keys(lines[0] ?? {}).filter((key) => ['reason', 'cause', 'error', 'e'].includes(key))).toEqual([]);

    // A web console session: the refusal of the marker DEVICE, as before, without the reason.
    built.actAs(operator('SUPERVISOR'));
    const web = await built.app.inject(rotate);
    expect([web.statusCode, errorOf(web).code, errorOf(web).message, errorOf(web).details]).toEqual([403, 'DEVICE_NOT_PAIRED', 'This operation is available on a paired device only.', undefined]);
    // A retired device: refused before the condition, with its one row.
    built.actAs({ kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0001' });
    expect(errorOf(await built.app.inject(rotate)).code).toBe('DEVICE_REVOKED');
    expect(built.database.committed.auditSeqs).toHaveLength(1);
    expect(built.reached).toEqual([]);

    // The device itself, by its own credential.
    built.actAs({ kind: 'DEVICE', deviceId: 'DEV-0001' });
    expect((await built.app.inject(rotate)).statusCode).toBe(200);
    expect(built.reached).toEqual(['rotateDeviceCredential']);
    expect(built.database.committed.auditSeqs).toHaveLength(1);
  });

  it('with the demo flag on, a holder of DEMO_CONTROL reaches the demo operation', async () => {
    const built = await withStandIns({ demoControls: true });
    built.actAs(operator('SUPERVISOR'));
    expect((await built.app.inject({ method: 'POST', url: '/api/v1/demo/reset' })).statusCode).toBe(200);
  });

  it('SR-71: the place in the budget is taken before the row: with the budget used up the answer is 429 and no unit runs', async () => {
    const built = await withStandIns();
    built.actAs(operator('TECHNICIAN'));
    const statuses: number[] = [];
    for (let call = 0; call < 20; call += 1) statuses.push((await built.app.inject(startSession)).statusCode);
    expect(statuses).toEqual(Array.from({ length: 20 }, () => 403));
    expect(built.database.committed.auditSeqs).toHaveLength(20);
    const units = built.app.pipeline.snapshot().completed;
    // Stage 5 turns the 21st away; it never reaches the guard.
    const next = await built.app.inject(startSession);
    expect([next.statusCode, errorOf(next).code]).toEqual([429, 'RATE_LIMITED']);
    expect(built.database.committed.auditSeqs).toHaveLength(20);
    expect(built.app.pipeline.snapshot().completed).toBe(units);
  });

  it('100 denied calls at once write exactly 20 rows: the calls that pass stage 5 together are held back by the place they must take first', async () => {
    const built = await withStandIns();
    built.actAs(operator('TECHNICIAN'));
    const answers = await Promise.all(Array.from({ length: 100 }, () => built.app.inject(startSession)));
    const statuses = answers.map((answer) => answer.statusCode);
    expect(statuses.filter((status) => status === 403)).toHaveLength(20);
    expect(statuses.filter((status) => status === 429)).toHaveLength(80);
    expect(built.database.committed.auditSeqs).toEqual(Array.from({ length: 20 }, (_unused, index) => index + 1));
    expect(built.reached).toEqual([]);
  });

  it('a denial whose row cannot be written is still refused, never let through: 503 without a database, 500 when the insert itself fails', async () => {
    const away = standInDatabase({ connectError: Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }) });
    const unreachable = await withStandIns({ database: away });
    unreachable.actAs(operator('TECHNICIAN'));
    const refused = await unreachable.app.inject(startSession);
    expect([refused.statusCode, errorOf(refused).code]).toEqual([503, 'NOT_READY']);
    expect(unreachable.reached).toEqual([]);
    expect(away.committed.auditSeqs).toEqual([]);

    const failing = standInDatabase({ failOn: (text) => (text.startsWith('insert into "audit_log" ') ? Object.assign(new Error('the insert failed'), { code: '53100' }) : undefined) });
    const broken = await withStandIns({ database: failing });
    broken.actAs(operator('TECHNICIAN'));
    const response = await broken.app.inject(startSession);
    expect([response.statusCode, errorOf(response).code]).toEqual([500, 'INTERNAL_ERROR']);
    expect(broken.reached).toEqual([]);
    expect(failing.committed.auditSeqs).toEqual([]);
    // And the caller with the permission is not affected by either.
    broken.actAs(operator('INVESTIGATOR'));
    expect((await broken.app.inject(startSession)).statusCode).toBe(200);
  });

  it('a denial is decided before the body is read: an oversized and a malformed body answer 403 or 401, and the permitted caller gets 413, 400 and 422', async () => {
    const role = routeOfOperation(operationOf('assignUserRole'));
    const built = await ready({
      routes: (instance) => {
        instance.withTypeProvider<ZodTypeProvider>().route({ ...role, schema: { body: UserRoleRequestSchema }, handler: async () => ({ changed: true }) });
      },
    });
    const url = '/api/v1/admin/users/OPR-003/role';
    const json = { 'content-type': 'application/json' };
    const bodies = {
      oversized: JSON.stringify({ role: 'TECHNICIAN', reason: 'x'.repeat(70_000) }),
      malformed: '{"role": "TECHNICIAN"',
      invalid: JSON.stringify({ role: 'ADMIRAL' }),
    };
    const send = async (payload: string): Promise<[number, string]> => {
      const response = await built.app.inject({ method: 'POST', url, headers: json, payload });
      return [response.statusCode, errorOf(response).code];
    };

    // Nobody: 401, whatever the body is.
    for (const payload of Object.values(bodies)) expect(await send(payload)).toEqual([401, 'NOT_SIGNED_IN']);
    // A role without USER_ADMIN: 403, whatever the body is, and one row each.
    built.actAs(operator('TECHNICIAN'));
    for (const payload of Object.values(bodies)) expect(await send(payload)).toEqual([403, 'NOT_PERMITTED']);
    expect(built.database.committed.auditSeqs).toHaveLength(3);
    // The holder of USER_ADMIN: stage 7 now reads the body and refuses each for what it is.
    built.actAs(operator('SUPERVISOR'));
    expect(await send(bodies.oversized)).toEqual([413, 'PAYLOAD_TOO_LARGE']);
    expect(await send(bodies.malformed)).toEqual([400, 'INVALID_JSON']);
    expect(await send(bodies.invalid)).toEqual([422, 'INVALID_INPUT']);
    expect(built.database.committed.auditSeqs).toHaveLength(3);
  });

  it('the log of a refusal holds codes and identifiers and nothing a caller sent', async () => {
    const built = await withStandIns();
    built.actAs(operator('TECHNICIAN', 'DEV-0001'));
    const marker = 'MARK-w28-4f1c';
    await built.app.inject({
      method: 'POST',
      url: `/api/v1/session/SES-20261001-0001/start?token=${marker}`,
      headers: { authorization: `Bearer ses_${'A'.repeat(43)}`, 'x-note': marker },
      payload: { note: marker },
    });
    const line = built.log.lines().find((entry) => entry['msg'] === 'request refused by the access rule');
    expect(line).toMatchObject({
      level: 40,
      code: 'NOT_PERMITTED',
      route: '/api/v1/session/:id/start',
      operationId: 'startSession',
      access: 'SESSION_START',
      principal: 'operator:OPR-003',
      audited: true,
    });
    expect(built.log.text()).not.toContain(marker);
    expect(credentialLeaks(built.log.text())).toEqual([]);
  });
});

describe('passScratchRoutes (test support; decision D82, condition 3)', () => {
  it('lets a route that is no registry operation pass, and leaves the real guard on every registry operation', async () => {
    const built = await ready({
      topLevel: (app) => {
        app.get('/api/v1/scratch', async () => ({ open: true }));
        // A scratch route that borrows a registry name passes too: it is no registry operation.
        app.post('/api/v1/scratch/sign-out', { config: { operationId: 'signOut' } }, async () => ({ open: true }));
        registryRoutes(app, ['startSession', 'listUsers']);
      },
    });
    passScratchRoutes(built.app);

    expect((await built.app.inject({ method: 'GET', url: '/api/v1/scratch' })).statusCode).toBe(200);
    expect((await built.app.inject({ method: 'POST', url: '/api/v1/scratch/sign-out' })).statusCode).toBe(200);

    // The registry operations: nobody, a role without the permission, a role with it.
    const start = { method: 'POST', url: '/api/v1/session/SES-20261001-0001/start' } as const;
    expect((await built.app.inject(start)).statusCode).toBe(401);
    expect((await built.app.inject({ method: 'GET', url: '/api/v1/auth/session' })).statusCode).toBe(401);
    built.actAs(operator('TECHNICIAN'));
    const denied = await built.app.inject(start);
    expect([denied.statusCode, errorOf(denied).code]).toEqual([403, 'NOT_PERMITTED']);
    expect((await built.app.inject({ method: 'GET', url: '/api/v1/admin/users' })).statusCode).toBe(403);
    expect(built.database.committed.auditSeqs).toHaveLength(2);
    built.actAs(operator('SUPERVISOR'));
    expect((await built.app.inject(start)).statusCode).toBe(200);
    expect((await built.app.inject({ method: 'GET', url: '/api/v1/admin/users' })).statusCode).toBe(200);
  });
});
