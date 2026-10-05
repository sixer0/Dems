// The routes of the administration module against the contract registry (plan row W33; module
// gate MODG; spec §7.6 operations 11 to 14, §7.2, §7.3). In-process, no database: the route table
// of the real app factory, stage 4 as a stand-in that says who the caller is, stage 6 the real
// one, and a pool that a test makes answer or fail. What a unit of work does against PostgreSQL
// is in the database tests of this folder.
import {
  ADMINISTRATION_OPERATIONS,
  ADMIN_REASON_MAX_LENGTH,
  CORE_API_OPERATIONS,
  CoreApiAccessKind,
  CoreApiAuditNone,
  matchCoreApiOperation,
  validateCoreApiResponse,
} from '@dems/shared/api';
import { ROLE_PERMISSIONS, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse, RouteOptions } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../app';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, createFakePool, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { permissionGuard } from '../../../plugins/permission-guard';
import { ADMIN_OPERATIONS, ADMIN_UNIT_LABEL } from '../index';
import { LIST_USERS } from '../statements';

const USERS = '/api/v1/admin/users';
const ORIGIN = 'http://127.0.0.1:5173';
const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

interface Built {
  readonly app: FastifyInstance;
  readonly registered: RouteOptions[];
  readonly log: CapturedLog;
  readonly queries: string[];
  actAs(principal: Principal): void;
}

/** The real app; the pool answers the list statement with `rows`, or fails it with `failure`. It has no `connect()`: no unit of work can open a transaction. */
async function build(answer: { rows?: unknown[]; failure?: Error } = {}): Promise<Built> {
  const log = captureLog();
  const fake = createFakePool(async (text) => {
    if (text === LIST_USERS) {
      if (answer.failure !== undefined) throw answer.failure;
      return { rows: answer.rows ?? [] };
    }
    return { rows: [] };
  });
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream });
  apps.push(app);
  const registered: RouteOptions[] = [];
  // Before the units load: every route they add is seen.
  app.addHook('onRoute', (route) => void registered.push(route));
  let current: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
  // Stage 4 as a stand-in; stage 6 is the real one.
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  return { app, registered, log, queries: fake.queries, actAs: (principal) => void (current = principal) };
}

const operator = (role: OperatorRole): Principal => ({
  kind: 'OPERATOR',
  operatorId: 'OPR-002',
  sessionId: 'session',
  deviceId: null,
  role,
  permissions: ROLE_PERMISSIONS[role],
});

const post = (app: FastifyInstance, url: string, payload?: unknown, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> =>
  app.inject({ method: 'POST', url, headers: { origin: ORIGIN, ...headers }, ...(payload === undefined ? {} : { payload: payload as object }) });

const outcome = (response: LightMyRequestResponse): [number, string | undefined] => [
  response.statusCode,
  (response.json() as { error?: { code?: string } }).error?.code,
];

const signature = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;
const moduleRoutes = (registered: readonly RouteOptions[]): RouteOptions[] => registered.filter((route) => route.url.startsWith('/api/v1/admin'));

/** A row of the list statement, as the driver returns it. */
const ROW = {
  id: 'OPR-003',
  username: 'rina.wijaya',
  rank: null,
  name: 'Rina Wijaya',
  display_name: 'Rina Wijaya',
  initials: 'RW',
  role_id: 'TECHNICIAN',
  enabled: true,
  last_sign_in_at: '1791000000000',
  role_changed_at: null,
  active_sessions: 2,
};

describe('MODG: the route list of the module equals the registry operations it owns', () => {
  it('registers operations 11 to 14 with the method, the path and the operation ID of the registry, and nothing else under /api/v1/admin', async () => {
    const { registered } = await build();
    const fromRegistry = ADMINISTRATION_OPERATIONS.filter((operation) => (ADMIN_OPERATIONS as readonly string[]).includes(operation.operationId)).map(
      (operation) => `${signature(operation.method, operation.path.replace('{id}', ':id'))} ${operation.operationId}`,
    );
    const fromModule = moduleRoutes(registered).map((route) => `${signature(String(route.method), route.url)} ${String(route.config?.operationId)}`);

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'GET /api/v1/admin/users listUsers',
      'POST /api/v1/admin/users/:id/role assignUserRole',
      'POST /api/v1/admin/users/:id/enable enableUser',
      'POST /api/v1/admin/users/:id/disable disableUser',
    ]);
    console.info(`[w33] MODG routes of src/modules/admin:  ${fromModule.join(' | ')}`);
    console.info(`[w33] MODG registry, operations 11-14:   ${fromRegistry.join(' | ')}`);
    for (const route of moduleRoutes(registered)) {
      expect(matchCoreApiOperation(String(route.method), route.url.replace(':id', 'OPR-003'))?.operation.operationId).toBe(route.config?.operationId);
    }
  });

  it('the four are operations 11, 12, 13 and 14 of the registry, in that order, and the area\'s fifth (10) is the RBAC module\'s', () => {
    const numberOf = (operationId: string): number =>
      Number(/operation (\d+)/.exec(CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId)?.source ?? '')?.[1]);
    expect(ADMIN_OPERATIONS.map(numberOf)).toEqual([11, 12, 13, 14]);
    expect(ADMINISTRATION_OPERATIONS.map((operation) => operation.operationId)).toEqual(['getRoleMatrix', ...ADMIN_OPERATIONS]);
  });

  it('each is guarded by the registry rule USER_ADMIN; the audit rule names the type this module writes', async () => {
    const { app } = await build();
    const rules = permissionGuard(app).registeredRules();
    const audit: Record<string, string> = {};
    for (const operationId of ADMIN_OPERATIONS) {
      const entry = ADMINISTRATION_OPERATIONS.find((candidate) => candidate.operationId === operationId);
      expect(entry?.access).toEqual({ kind: CoreApiAccessKind.PERMISSION, permission: 'USER_ADMIN' });
      expect(rules.find((rule) => rule.operationId === operationId)).toMatchObject({ kind: CoreApiAccessKind.PERMISSION, permissions: ['USER_ADMIN'] });
      audit[operationId] = String(entry?.audit.success);
    }
    expect(audit).toEqual({ listUsers: CoreApiAuditNone.READ, assignUserRole: 'ROLE_CHANGED', enableUser: 'USER_ENABLED', disableUser: 'USER_DISABLED' });
  });

  it('M3: no route carries a hook of its own: who may call is stage 6, only', async () => {
    const { registered } = await build();
    for (const route of moduleRoutes(registered)) {
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler'] as const) expect(route[hook], `${route.url} ${hook}`).toBeUndefined();
    }
  });

  it('every answer has the contract\'s response schema; every command validates its path parameter and its body', async () => {
    const { registered } = await build();
    for (const route of moduleRoutes(registered)) {
      const schema = route.schema as { response?: Record<number, unknown>; body?: unknown; params?: unknown } | undefined;
      expect(schema?.response?.[200], route.url).toBeDefined();
      if (route.method === 'POST') {
        expect(schema?.body, route.url).toBeDefined();
        expect(schema?.params, route.url).toBeDefined();
      }
    }
  });

  it('no operation of the module sets, resets or reads a password: there are four routes and none of them is about one', async () => {
    const { registered } = await build();
    expect(moduleRoutes(registered)).toHaveLength(4);
    expect(CORE_API_OPERATIONS.filter((operation) => /password|credential/i.test(operation.operationId) && operation.path.startsWith('/api/v1/admin'))).toEqual([]);
  });

  it('the unit labels are dotted names of the module', () => {
    expect(ADMIN_UNIT_LABEL).toEqual({ assignUserRole: 'admin.assignUserRole', enableUser: 'admin.enableUser', disableUser: 'admin.disableUser' });
  });
});

describe('who may call is the guard\'s (401 before anything of the request is read)', () => {
  const calls: ReadonlyArray<readonly [string, 'GET' | 'POST', string]> = [
    ['listUsers', 'GET', USERS],
    ['assignUserRole', 'POST', `${USERS}/OPR-003/role`],
    ['enableUser', 'POST', `${USERS}/OPR-003/enable`],
    ['disableUser', 'POST', `${USERS}/OPR-003/disable`],
  ];

  it.each(calls)('%s: nobody without a session, and a paired device without an operator: 401 NOT_SIGNED_IN, valid against the contract, no statement', async (operationId, method, url) => {
    const built = await build({ rows: [ROW] });
    for (const principal of [{ kind: 'ANONYMOUS', retiredDeviceId: null }, { kind: 'DEVICE', deviceId: 'DEV-0001' }] as const) {
      built.actAs(principal);
      // A body that would fail validation: the refusal does not depend on it.
      const response = method === 'GET' ? await built.app.inject({ method, url }) : await post(built.app, url, { role: 'ROOT', reason: 7 });
      expect(outcome(response)).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse(operationId, 401, response.json())).toEqual({ ok: true });
    }
    expect(built.queries.filter((text) => text === LIST_USERS)).toEqual([]);
    expect(built.app.pipeline.snapshot()).toMatchObject({ completed: 0, failed: 0 });
  });
});

describe('the backstop behind the guard', () => {
  it('with stage 6 taken out of the pipeline, a caller that is no operator is still refused 401 by the three commands, before any unit; the handlers read no permission', async () => {
    const built = await build();
    // Test only: the guard is not there. What is left is the handler's own narrowing of the actor.
    built.app.stages.replace('accessRule', () => undefined);
    for (const principal of [{ kind: 'ANONYMOUS', retiredDeviceId: null }, { kind: 'DEVICE', deviceId: 'DEV-0001' }] as const) {
      built.actAs(principal);
      for (const [url, body] of [
        [`${USERS}/OPR-003/role`, { role: 'INVESTIGATOR' }],
        [`${USERS}/OPR-003/enable`, {}],
        [`${USERS}/OPR-003/disable`, {}],
      ] as const) {
        expect(outcome(await post(built.app, url, body))).toEqual([401, 'NOT_SIGNED_IN']);
      }
    }
    expect(built.app.pipeline.snapshot()).toMatchObject({ completed: 0, failed: 0 });
    // An operator WITHOUT the permission passes the handler when the guard is out: the handler
    // holds no second rule (the unit then fails here only because this pool opens no connection).
    built.actAs(operator('TECHNICIAN'));
    expect(outcome(await post(built.app, `${USERS}/OPR-003/enable`, {}))).toEqual([503, 'NOT_READY']);
    expect(built.app.pipeline.snapshot()).toMatchObject({ failed: 1 });
  });
});

describe('operation 11 listUsers', () => {
  it('answers what the one statement reads, in the contract shape: one read per call, on the pool, no unit of work', async () => {
    const built = await build({ rows: [{ ...ROW, id: 'OPR-001', role_id: 'INVESTIGATOR', last_sign_in_at: null, active_sessions: 0, role_changed_at: '1791000000500' }, ROW] });
    built.actAs(operator('SUPERVISOR'));
    for (let call = 0; call < 2; call += 1) {
      const response = await built.app.inject({ method: 'GET', url: USERS });
      expect(response.statusCode).toBe(200);
      expect(validateCoreApiResponse('listUsers', 200, response.json())).toEqual({ ok: true });
      expect(response.json()).toEqual({
        users: [
          { id: 'OPR-001', username: 'rina.wijaya', rank: null, name: 'Rina Wijaya', displayName: 'Rina Wijaya', initials: 'RW', role: 'INVESTIGATOR', enabled: true, lastSignInAt: null, activeSessions: 0, roleChangedAt: 1_791_000_000_500 },
          { id: 'OPR-003', username: 'rina.wijaya', rank: null, name: 'Rina Wijaya', displayName: 'Rina Wijaya', initials: 'RW', role: 'TECHNICIAN', enabled: true, lastSignInAt: 1_791_000_000_000, activeSessions: 2, roleChangedAt: null },
        ],
      });
      // A read: no state revision header (API-7 is about POSTs).
      expect(response.headers['x-dems-revision']).toBeUndefined();
    }
    expect(built.queries.filter((text) => text === LIST_USERS)).toHaveLength(2);
    expect(built.app.pipeline.snapshot()).toMatchObject({ completed: 0, failed: 0 });
  });

  it('an empty operators table answers an empty list, not an error', async () => {
    const built = await build({ rows: [] });
    built.actAs(operator('SUPERVISOR'));
    const response = await built.app.inject({ method: 'GET', url: USERS });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ users: [] });
  });

  it('a stored value outside the contract never leaves the server: the response schema refuses the answer (500)', async () => {
    const built = await build({ rows: [{ ...ROW, role_id: 'ROOT' }] });
    built.actAs(operator('SUPERVISOR'));
    const response = await built.app.inject({ method: 'GET', url: USERS });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('ROOT');
  });

  it('M14: a read that fails answers 503 NOT_READY, is logged by its code only and written to the error log; nothing the driver put on the error reaches the log, the error log or the answer', async () => {
    const marker = 'MARK-w33-statement-text';
    // What a driver's or a query builder's error carries as enumerable members: the statement, its parameters, the server's DETAIL.
    const failure = Object.assign(new Error(`relation missing in ${marker}-message`), {
      code: '42P01',
      detail: `Failing row contains (${marker}-detail)`,
      query: `SELECT ${marker}-query`,
      params: [`${marker}-params`],
      parameters: [`${marker}-parameters`],
      where: `${marker}-where`,
    });
    const built = await build({ failure });
    const persisted: unknown[] = [];
    const append = built.app.errorLog.append.bind(built.app.errorLog);
    built.app.errorLog.append = (entry) => {
      persisted.push(entry);
      append(entry);
    };
    const probe = vi.spyOn(built.app.db, 'probe');
    built.actAs(operator('SUPERVISOR'));
    const response = await built.app.inject({ method: 'GET', url: USERS });
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    // Readiness is told: the pool is probed afresh.
    expect(probe).toHaveBeenCalledWith({ fresh: true });
    // The one line of the pool plugin's helper (`app.db.read`), written with the request's logger.
    const requestId = (response.json() as { error: { requestId: string } }).error.requestId;
    const line = built.log.lines().find((entry) => entry['msg'] === 'a read on the pool failed');
    expect(line).toMatchObject({ level: 50, source: 'admin.listUsers', reqId: requestId, err: { code: '42P01' } });
    // The error is under `err`, as the logger's serializer writes it, and under no other key.
    expect(Object.keys(line ?? {}).filter((key) => ['error', 'cause', 'detail', 'query', 'params', 'parameters', 'where', 'stack'].includes(key))).toEqual([]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ level: 'error', source: 'admin.listUsers', message: 'a read on the pool failed', code: '42P01', errorName: 'Error', context: { requestId } });
    for (const text of [built.log.text(), response.body, JSON.stringify(persisted)]) expect(text).not.toContain(marker);
  });
});

describe('operations 12 to 14: input is refused at stage 7, before any unit of work', () => {
  const role = `${USERS}/OPR-003/role`;
  const enable = `${USERS}/OPR-003/enable`;
  const disable = `${USERS}/OPR-003/disable`;
  const tooLong = 'x'.repeat(ADMIN_REASON_MAX_LENGTH + 1);
  /** A text that has the form of a session token of this server: `ses_` and 43 characters. */
  const tokenShaped = `the token is ${['ses', 'A'.repeat(43)].join('_')} `;

  const invalid: ReadonlyArray<readonly [string, string, string, unknown, string]> = [
    ['assignUserRole', 'no role', role, {}, 'body'],
    ['assignUserRole', 'a role outside the vocabulary', role, { role: 'ROOT' }, 'body'],
    ['assignUserRole', 'a role in lower case', role, { role: 'supervisor' }, 'body'],
    ['assignUserRole', 'a reason that is no text', role, { role: 'INVESTIGATOR', reason: 7 }, 'body'],
    ['assignUserRole', 'a reason over 500 characters: not cut, refused', role, { role: 'INVESTIGATOR', reason: tooLong }, 'body'],
    ['assignUserRole', 'a reason with U+0000', role, { role: 'INVESTIGATOR', reason: 'a\u0000b' }, 'body'],
    ['assignUserRole', 'a reason with an unpaired surrogate', role, { role: 'INVESTIGATOR', reason: 'a\ud800b' }, 'body'],
    ['assignUserRole', 'a reason that has the form of a credential', role, { role: 'INVESTIGATOR', reason: tokenShaped }, 'body'],
    ['assignUserRole', 'a malformed operator ID', `${USERS}/OPR-3/role`, { role: 'INVESTIGATOR' }, 'params'],
    ['assignUserRole', 'an operator ID in lower case', `${USERS}/opr-003/role`, { role: 'INVESTIGATOR' }, 'params'],
    ['enableUser', 'a reason that is no text', enable, { reason: ['x'] }, 'body'],
    ['enableUser', 'a reason over 500 characters', enable, { reason: tooLong }, 'body'],
    ['enableUser', 'a reason that has the form of a credential', enable, { reason: tokenShaped }, 'body'],
    ['enableUser', 'a malformed operator ID', `${USERS}/USER-003/enable`, {}, 'params'],
    ['disableUser', 'a reason that is no text', disable, { reason: { text: 'x' } }, 'body'],
    ['disableUser', 'a reason over 500 characters', disable, { reason: tooLong }, 'body'],
    ['disableUser', 'a reason that has the form of a credential', disable, { reason: tokenShaped }, 'body'],
    ['disableUser', 'a malformed operator ID', `${USERS}/OPR-0003/disable`, {}, 'params'],
  ];

  it.each(invalid)('%s, %s: 422 INVALID_INPUT, valid against the contract, no unit of work', async (operationId, _case, url, body, where) => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    const response = await post(built.app, url, body);
    expect(outcome(response)).toEqual([422, 'INVALID_INPUT']);
    expect((response.json() as { error: { details?: { in?: string } } }).error.details).toEqual({ in: where });
    expect(validateCoreApiResponse(operationId, 422, response.json())).toEqual({ ok: true });
    expect(built.app.pipeline.snapshot()).toMatchObject({ completed: 0, failed: 0 });
    // The answer and the log say which part failed, never what was sent.
    expect(response.body).not.toContain('ROOT');
    expect(built.log.text()).not.toContain('ses_');
  });

  it.each([
    ['assignUserRole', role],
    ['enableUser', enable],
    ['disableUser', disable],
  ] as const)('%s: a body that is not a JSON object answers 400 INVALID_JSON, valid against the contract', async (operationId, url) => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    for (const payload of ['{"role":', '["INVESTIGATOR"]', '"INVESTIGATOR"', 'null']) {
      const response = await built.app.inject({ method: 'POST', url, headers: { origin: ORIGIN, 'content-type': 'application/json' }, payload });
      expect(outcome(response)).toEqual([400, 'INVALID_JSON']);
      expect(validateCoreApiResponse(operationId, 400, response.json())).toEqual({ ok: true });
    }
    expect(built.app.pipeline.snapshot()).toMatchObject({ completed: 0, failed: 0 });
  });

  it('unknown members of a body are dropped by the schema, not refused (API-4): the request reaches its unit', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    // The pool of this test opens no connection, so the unit answers 503: the input was accepted.
    const response = await post(built.app, role, { role: 'INVESTIGATOR', actorId: 'OPR-001', at: 1 });
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(built.app.pipeline.snapshot()).toMatchObject({ completed: 0, failed: 1 });
  });

  it.each([
    ['assignUserRole', role, { role: 'INVESTIGATOR' }],
    ['enableUser', enable, undefined],
    ['disableUser', disable, {}],
  ] as const)('%s: a database that does not answer is 503 NOT_READY; an enable or a disable needs no body at all', async (_operationId, url, body) => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    const response = await post(built.app, url, body);
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    // No state revision header on a refusal.
    expect(response.headers['x-dems-revision']).toBeUndefined();
  });
});
