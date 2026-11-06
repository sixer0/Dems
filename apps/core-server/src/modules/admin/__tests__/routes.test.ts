// The routes of the administration module against the contract registry (plan row W33; module
// gate MODG; spec §7.6 operations 11 to 14, §7.2, §7.3). In-process, no database: the route table
// of the real app factory, stage 4 as a stand-in that says who the caller is, stage 6 the real
// one, and a pool that a test makes answer or fail. What a unit of work does against PostgreSQL
// is in the database tests of this folder.
import {
  ADMINISTRATION_OPERATIONS,
  ADMIN_REASON_MAX_LENGTH,
  AdminUserListSchema,
  AdminUserSchema,
  CORE_API_OPERATIONS,
  DeletedUserSchema,
  CoreApiAccessCondition,
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
/** The response schema the contract names for 200 of an operation, as the object the registry points at. */
const CONTRACT_RESPONSES: Record<string, unknown> = { AdminUserList: AdminUserListSchema, AdminUser: AdminUserSchema, DeletedUser: DeletedUserSchema };
const contractResponse = (operationId: string): unknown => CONTRACT_RESPONSES[ADMINISTRATION_OPERATIONS.find((operation) => operation.operationId === operationId)?.responses[200]?.schema ?? ''];
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
  // REVISED 2026-11-02 (principal): RB-9 amended — area 2 gains createUser/updateUser/deleteUser
  // (operations 15 to 17), all narrowed to the vendor `root` account inside the unit.
  it('registers operations 11 to 17 with the method, the path and the operation ID of the registry, and nothing else under /api/v1/admin', async () => {
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
      'POST /api/v1/admin/users createUser',
      'POST /api/v1/admin/users/:id/profile updateUser',
      'POST /api/v1/admin/users/:id/delete deleteUser',
    ]);
    console.info(`[w33] MODG routes of src/modules/admin:  ${fromModule.join(' | ')}`);
    console.info(`[w33] MODG registry, operations 11-17:   ${fromRegistry.join(' | ')}`);
    for (const route of moduleRoutes(registered)) {
      expect(matchCoreApiOperation(String(route.method), route.url.replace(':id', 'OPR-003'))?.operation.operationId).toBe(route.config?.operationId);
    }
  });

  it('the seven are operations 11 to 17 of the registry, in that order, and the area\'s first (10) is the RBAC module\'s', () => {
    const numberOf = (operationId: string): number =>
      Number(/operation (\d+)/.exec(CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId)?.source ?? '')?.[1]);
    // REVISED 2026-11-02 (principal): RB-9 amended — 15, 16 and 17 join the module.
    expect(ADMIN_OPERATIONS.map(numberOf)).toEqual([11, 12, 13, 14, 15, 16, 17]);
    expect(ADMINISTRATION_OPERATIONS.map((operation) => operation.operationId)).toEqual(['getRoleMatrix', ...ADMIN_OPERATIONS]);
  });

  it('each is guarded by the registry rule USER_ADMIN; the audit rule names the type this module writes', async () => {
    const { app } = await build();
    const rules = permissionGuard(app).registeredRules();
    const audit: Record<string, string> = {};
    for (const operationId of ADMIN_OPERATIONS) {
      const entry = ADMINISTRATION_OPERATIONS.find((candidate) => candidate.operationId === operationId);
      // D59 (2026-11-04, principal): the RB-9 user trio carries the vendor `root` gate - USER_ADMIN
      // plus the VENDOR_ROOT condition; the reads stay plain USER_ADMIN.
      const rootTrio = operationId === 'createUser' || operationId === 'updateUser' || operationId === 'deleteUser';
      expect(entry?.access).toEqual(rootTrio
        ? { kind: CoreApiAccessKind.PERMISSION, permission: 'USER_ADMIN', conditions: [CoreApiAccessCondition.VENDOR_ROOT] }
        : { kind: CoreApiAccessKind.PERMISSION, permission: 'USER_ADMIN' });
      expect(rules.find((rule) => rule.operationId === operationId)).toMatchObject({ kind: CoreApiAccessKind.PERMISSION, permissions: ['USER_ADMIN'] });
      audit[operationId] = String(entry?.audit.success);
    }
    // REVISED 2026-11-02 (principal): RB-9 amended — the three new commands name their own type.
    expect(audit).toEqual({
      listUsers: CoreApiAuditNone.READ,
      assignUserRole: 'ROLE_CHANGED',
      enableUser: 'USER_ENABLED',
      disableUser: 'USER_DISABLED',
      createUser: 'USER_CREATED',
      updateUser: 'USER_UPDATED',
      deleteUser: 'USER_DELETED',
    });
    // The gate of the registry is the permission; the narrowing to `root` is inside the unit (rule.ts).
    expect(ADMIN_OPERATIONS.filter((operationId) => operationId !== 'listUsers').every((operationId) => ADMINISTRATION_OPERATIONS.find((candidate) => candidate.operationId === operationId)?.access?.kind === CoreApiAccessKind.PERMISSION)).toBe(true);
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
      const entry = ADMINISTRATION_OPERATIONS.find((candidate) => candidate.operationId === route.config?.operationId);
      expect(entry, route.url).toBeDefined();
      // The registry entries are a union: only some members name a path parameter or a body, so the
      // question "does this operation name one" is asked through a widened view of the entry.
      const named = entry as { readonly pathParam?: unknown; readonly requestBody?: unknown } | undefined;
      if (route.method === 'POST') {
        expect(schema?.body, route.url).toBeDefined();
        // REVISED 2026-11-02 (principal): RB-9 amended — `createUser` is a POST on the collection
        // itself and the registry gives it no path parameter: the parameter is validated exactly
        // when the registry names one (API-3), which is the same rule as before, stated on the registry.
        expect(schema?.params !== undefined, route.url).toBe(named?.pathParam !== undefined);
      }
      // The schema is the contract's, never one the module wrote: the registry names it by name.
      if (named?.requestBody !== undefined) expect(schema?.body, route.url).toBeDefined();
    }
  });

  // REVISED 2026-11-02 (principal): RB-9 amended — seven routes now. The invariant is unchanged and
  // is proved on all seven: no route of the area is about a secret, no body or answer the registry
  // gives them is a credential schema, and no operation of the area names one. Setting a password
  // stays the host command's alone (decision U19); what the module may do with a credential is
  // remove it together with its account, which `static.test.ts` rule 6 keeps as text.
  it('no operation of the module sets, resets or reads a password: there are seven routes and none of them is about one', async () => {
    const { registered } = await build();
    expect(moduleRoutes(registered)).toHaveLength(7);
    // No operation of the whole area is named for a credential, and none is registered here.
    expect(CORE_API_OPERATIONS.filter((operation) => /password|credential/i.test(operation.operationId) && operation.path.startsWith('/api/v1/admin'))).toEqual([]);
    const SECRET_WORD = /password|passwd|credential|secret|token|hash|salt/i;
    for (const operation of ADMINISTRATION_OPERATIONS) {
      // Neither method, path, operation ID nor the name of the body or the answer schema is one of a secret.
      const withBody = operation as { readonly requestBody?: { readonly schema?: string } };
      const names = [operation.method, operation.path, operation.operationId, withBody.requestBody?.schema ?? '', Object.values(operation.responses).map((response) => response.schema).join(' ')].join(' ');
      expect(SECRET_WORD.test(names), operation.operationId).toBe(false);
    }
    // What the module registers answers with the contract's own schema object of each operation: the
    // operator as the list gives it, or what a delete removed. Compared by identity, so a schema the
    // module wrote for itself could not pass, and none of the three is a credential.
    const answers: Record<string, string> = {};
    for (const route of moduleRoutes(registered)) {
      const operationId = String(route.config?.operationId);
      const response = (route.schema as { response?: Record<number, unknown> } | undefined)?.response?.[200];
      answers[operationId] = response === contractResponse(operationId) ? 'the contract schema' : `not the contract schema for ${operationId}`;
    }
    expect(answers).toEqual(Object.fromEntries(ADMIN_OPERATIONS.map((operationId) => [operationId, 'the contract schema'])));
  });

  it('the unit labels are dotted names of the module', () => {
    // REVISED 2026-11-02 (principal): RB-9 amended — one label per write operation of the seven.
    expect(ADMIN_UNIT_LABEL).toEqual({
      assignUserRole: 'admin.assignUserRole',
      enableUser: 'admin.enableUser',
      disableUser: 'admin.disableUser',
      createUser: 'admin.createUser',
      updateUser: 'admin.updateUser',
      deleteUser: 'admin.deleteUser',
    });
    expect(Object.values(ADMIN_UNIT_LABEL).every((label) => /^admin\.[a-zA-Z]+$/.test(label))).toBe(true);
  });
});

describe('who may call is the guard\'s (401 before anything of the request is read)', () => {
  // REVISED 2026-11-02 (principal): RB-9 amended — the three new commands are guarded the same way:
  // the refusal comes before anything of the request is read, so it does not depend on their body.
  const calls: ReadonlyArray<readonly [string, 'GET' | 'POST', string]> = [
    ['listUsers', 'GET', USERS],
    ['assignUserRole', 'POST', `${USERS}/OPR-003/role`],
    ['enableUser', 'POST', `${USERS}/OPR-003/enable`],
    ['disableUser', 'POST', `${USERS}/OPR-003/disable`],
    ['createUser', 'POST', USERS],
    ['updateUser', 'POST', `${USERS}/OPR-003/profile`],
    ['deleteUser', 'POST', `${USERS}/OPR-003/delete`],
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
      // REVISED 2026-11-02 (principal): RB-9 amended — the three new commands read their actor the
      // same way, with a body that would pass validation: the refusal is the handler's backstop alone.
      for (const [url, body] of [
        [`${USERS}/OPR-003/role`, { role: 'INVESTIGATOR' }],
        [`${USERS}/OPR-003/enable`, {}],
        [`${USERS}/OPR-003/disable`, {}],
        [USERS, { username: 'new.operator', name: 'New Operator', initials: 'NO', role: 'TECHNICIAN' }],
        [`${USERS}/OPR-003/profile`, { name: 'Another Name' }],
        [`${USERS}/OPR-003/delete`, { confirm: 'rina.wijaya' }],
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

  // REVISED 2026-11-02 (principal): RB-9 amended — the three new commands validate at the same stage,
  // on the contract's own schemas: a malformed username, a missing name or initials, a role outside
  // the vocabulary, a `confirm` that is no text, and a reason of every old kind of wrong.
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
    ['createUser', 'no username', USERS, { name: 'New Operator', initials: 'NO', role: 'TECHNICIAN' }, 'body'],
    ['createUser', 'a username with an upper-case letter and a space', USERS, { username: 'New Operator', name: 'New Operator', initials: 'NO', role: 'TECHNICIAN' }, 'body'],
    ['createUser', 'a username starting with a dot', USERS, { username: '.operator', name: 'New Operator', initials: 'NO', role: 'TECHNICIAN' }, 'body'],
    ['createUser', 'no initials', USERS, { username: 'new.operator', name: 'New Operator', role: 'TECHNICIAN' }, 'body'],
    ['createUser', 'initials over four characters', USERS, { username: 'new.operator', name: 'New Operator', initials: 'TOOLONG', role: 'TECHNICIAN' }, 'body'],
    ['createUser', 'a name over 120 characters', USERS, { username: 'new.operator', name: 'x'.repeat(121), initials: 'NO', role: 'TECHNICIAN' }, 'body'],
    ['createUser', 'a role outside the vocabulary', USERS, { username: 'new.operator', name: 'New Operator', initials: 'NO', role: 'ROOT' }, 'body'],
    ['createUser', 'a reason that has the form of a credential', USERS, { username: 'new.operator', name: 'New Operator', initials: 'NO', role: 'TECHNICIAN', reason: tokenShaped }, 'body'],
    ['updateUser', 'an empty profile: nothing is asked', `${USERS}/OPR-003/profile`, { reason: 'only a reason' }, 'body'],
    ['updateUser', 'initials over four characters', `${USERS}/OPR-003/profile`, { initials: 'TOOLONG' }, 'body'],
    ['updateUser', 'a reason over 500 characters', `${USERS}/OPR-003/profile`, { name: 'Another Name', reason: tooLong }, 'body'],
    ['updateUser', 'a malformed operator ID', `${USERS}/USER-003/profile`, { name: 'Another Name' }, 'params'],
    ['deleteUser', 'no confirm', `${USERS}/OPR-003/delete`, { reason: 'a reason' }, 'body'],
    ['deleteUser', 'a confirm that is no text', `${USERS}/OPR-003/delete`, { confirm: 7 }, 'body'],
    ['deleteUser', 'a reason that has the form of a credential', `${USERS}/OPR-003/delete`, { confirm: 'rina.wijaya', reason: tokenShaped }, 'body'],
    ['deleteUser', 'a malformed operator ID', `${USERS}/OPR-0003/delete`, { confirm: 'rina.wijaya' }, 'params'],
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
    ['createUser', USERS],
    ['updateUser', `${USERS}/OPR-003/profile`],
    ['deleteUser', `${USERS}/OPR-003/delete`],
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
