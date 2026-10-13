// The route of the RBAC module against the contract registry (plan row W28; module gate MODG;
// spec §7.6 operation 10, §4.6 RB-9). In-process, no database: the route table of the real app
// factory, and a pool that a test makes answer or fail. The answer against PostgreSQL is in
// `rbac.db.test.ts`.
import { ADMINISTRATION_OPERATIONS, CORE_API_OPERATIONS, CoreApiAccessKind, CoreApiAuditNone, CoreApiTag, matchCoreApiOperation, validateCoreApiResponse } from '@dems/shared/api';
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';
import type { FastifyInstance, RouteOptions } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, createFakePool, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { AccessRuleError, READ_STORED_MATRIX, permissionGuard } from '../../../plugins/permission-guard';
import { RBAC_BOOT_STEP, RBAC_OPERATIONS } from '../index';

const MATRIX = '/api/v1/rbac/matrix';
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

/** The real app; the pool answers the matrix statement with `rows`, or fails it with `failure`. */
async function build(answer: { rows?: unknown[]; failure?: Error } = {}): Promise<Built> {
  const log = captureLog();
  const fake = createFakePool(async (text) => {
    if (text === READ_STORED_MATRIX) {
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
  operatorId: 'OPR-001',
  sessionId: 'session',
  deviceId: null,
  role,
  permissions: ROLE_PERMISSIONS[role],
});

const STORED = {
  roles: ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'],
  permissions: ['SESSION_START', 'EVIDENCE_VIEW'],
  grants: [
    { role: 'INVESTIGATOR', permission: 'SESSION_START' },
    { role: 'TECHNICIAN', permission: 'EVIDENCE_VIEW' },
  ],
};

describe('MODG: the route list of the module equals the registry operation it owns', () => {
  it('registers operation 10 with the method, the path and the operation ID of the registry, and nothing else under /api/v1/rbac', async () => {
    const { registered } = await build();
    const signature = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;
    const fromRegistry = ADMINISTRATION_OPERATIONS.filter((operation) => (RBAC_OPERATIONS as readonly string[]).includes(operation.operationId)).map(
      (operation) => `${signature(operation.method, operation.path)} ${operation.operationId}`,
    );
    const fromModule = registered
      .filter((route) => route.url.startsWith('/api/v1/rbac'))
      .map((route) => `${signature(String(route.method), route.url)} ${String(route.config?.operationId)}`);

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual(['GET /api/v1/rbac/matrix getRoleMatrix']);
    console.info(`[w28] MODG routes of src/modules/rbac: ${fromModule.join(' | ')}`);
    console.info(`[w28] MODG registry, operation 10:     ${fromRegistry.join(' | ')}`);
    for (const route of registered.filter((candidate) => candidate.url.startsWith('/api/v1/rbac'))) {
      expect(matchCoreApiOperation(String(route.method), route.url)?.operation.operationId).toBe(route.config?.operationId);
    }
  });

  it('the area has five operations in the registry: 10 is this module\'s, 11 to 14 are the administration row\'s (W33)', () => {
    const area = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.ADMINISTRATION).map((operation) => operation.operationId);
    expect(area).toEqual([...RBAC_OPERATIONS, 'listUsers', 'assignUserRole', 'enableUser', 'disableUser']);
    const numberOf = (operationId: string): number =>
      Number(/operation (\d+)/.exec(CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId)?.source ?? '')?.[1]);
    expect(area.map(numberOf)).toEqual([10, 11, 12, 13, 14]);
  });

  it('operation 10 is AUTHENTICATED, a read, with no body: the registry rule the guard applies', async () => {
    const { app } = await build();
    const operation = ADMINISTRATION_OPERATIONS.find((candidate) => candidate.operationId === 'getRoleMatrix');
    expect(operation?.access).toEqual({ kind: CoreApiAccessKind.AUTHENTICATED });
    expect(operation?.audit).toEqual({ success: CoreApiAuditNone.READ, denial: 'ACCESS_DENIED' });
    expect(operation && 'requestBody' in operation).toBe(false);
    expect(permissionGuard(app).registeredRules().find((rule) => rule.operationId === 'getRoleMatrix')).toMatchObject({
      method: 'GET',
      url: MATRIX,
      kind: CoreApiAccessKind.AUTHENTICATED,
      permissions: [],
      denial: null,
    });
  });

  it('the route carries no check of its own: no onRequest hook beside the stage hook, and the module adds one boot step', async () => {
    const { registered } = await build();
    const route = registered.find((candidate) => candidate.config?.operationId === 'getRoleMatrix');
    expect(route?.onRequest).toBeUndefined();
    expect(route?.preHandler).toBeUndefined();
    expect(RBAC_BOOT_STEP).toBe('rbac.matrix');
  });
});

describe('operation 10 getRoleMatrix', () => {
  it('answers what the one statement reads, in the contract shape, with editable false; every role may read it', async () => {
    const built = await build({ rows: [STORED] });
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      built.actAs(operator(role));
      const response = await built.app.inject({ method: 'GET', url: MATRIX });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ...STORED, editable: false });
      expect(validateCoreApiResponse('getRoleMatrix', 200, response.json())).toEqual({ ok: true });
    }
    // One read per call, on the pool: nothing is kept between two calls.
    expect(built.queries.filter((text) => text === READ_STORED_MATRIX)).toHaveLength(3);
  });

  it('who may call is the guard\'s: nobody without a session (401), a paired device without an operator (401), a retired device (403)', async () => {
    const built = await build({ rows: [STORED] });
    const call = async (): Promise<[number, string]> => {
      const response = await built.app.inject({ method: 'GET', url: MATRIX });
      return [response.statusCode, (response.json() as { error: { code: string } }).error.code];
    };
    expect(await call()).toEqual([401, 'NOT_SIGNED_IN']);
    built.actAs({ kind: 'DEVICE', deviceId: 'DEV-0001' });
    expect(await call()).toEqual([401, 'NOT_SIGNED_IN']);
    // The 403 of a retired device with its row is in the database test: the row needs a store.
    expect(built.queries.filter((text) => text === READ_STORED_MATRIX)).toHaveLength(0);
  });

  it('a stored name outside the shared vocabulary never leaves the server: the response schema refuses the answer (500)', async () => {
    const built = await build({ rows: [{ ...STORED, permissions: [...STORED.permissions, 'ROOT'] }] });
    built.actAs(operator('SUPERVISOR'));
    const response = await built.app.inject({ method: 'GET', url: MATRIX });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('ROOT');
  });

  it('a read that fails answers 503 NOT_READY, is logged by its code only and probes the database', async () => {
    const marker = 'MARK-w28-statement-text';
    const built = await build({ failure: Object.assign(new Error(`relation missing in ${marker}`), { code: '42P01' }) });
    built.actAs(operator('TECHNICIAN'));
    const response = await built.app.inject({ method: 'GET', url: MATRIX });
    expect(response.statusCode).toBe(503);
    expect((response.json() as { error: { code: string } }).error.code).toBe('NOT_READY');
    const line = built.log.lines().find((entry) => entry['msg'] === 'a read on the pool failed');
    expect(line).toMatchObject({ level: 50, source: 'rbac.getRoleMatrix', err: { code: '42P01' } });
    expect(built.log.text()).not.toContain(marker);
    expect(response.body).not.toContain(marker);
  });

  it('an unseeded database answers three empty lists, not an error', async () => {
    const built = await build({ rows: [] });
    built.actAs(operator('INVESTIGATOR'));
    const response = await built.app.inject({ method: 'GET', url: MATRIX });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ roles: [], permissions: [], grants: [], editable: false });
  });
});

describe('the boot step rbac.matrix on a database that does not hold the vocabulary', () => {
  it('reloadMatrix refuses an empty matrix, names what is missing, logs the problems and keeps nothing', async () => {
    const built = await build({ rows: [] });
    const guard = permissionGuard(built.app);
    const error = await guard.reloadMatrix().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(AccessRuleError);
    const { problems } = error as AccessRuleError;
    // Whichever modules have landed: the two mismatches of the vocabulary are among the problems,
    // and every other problem is a permission that a registered route names and that is not stored.
    expect(problems.filter((problem) => problem.code === 'STORED_MATRIX_MISMATCH').map((problem) => problem.detail)).toEqual([
      'roles not stored: INVESTIGATOR, SUPERVISOR, TECHNICIAN',
      expect.stringMatching(/^permissions not stored: SESSION_START, .*DEMO_CONTROL, CAPTURE_CONFIG, TRANSCRIPT_REVISE, CAPTURE_COMMISSION$/),
    ]);
    const named = guard.registeredRules().flatMap((rule) => rule.permissions.map((permission) => `${rule.operationId} ${permission}`));
    expect(
      problems.filter((problem) => problem.code !== 'STORED_MATRIX_MISMATCH').map((problem) => `${problem.code} ${problem.operationId} ${/names (\w+),/.exec(problem.detail)?.[1]}`),
    ).toEqual(named.map((pair) => `PERMISSION_NOT_STORED ${pair}`));
    expect(['STORED_MATRIX_MISMATCH', 'PERMISSION_NOT_STORED']).toContain((error as AccessRuleError).code);
    expect(guard.matrix()).toBeNull();
    const line = built.log.lines().find((entry) => entry['msg'] === 'the stored role matrix does not fit the access rules');
    expect(line).toMatchObject({ level: 50, code: (error as AccessRuleError).code });
  });

  it('decision D88: reloadMatrix refuses a matrix whose grants are not the shared role table, and passes the one that is', async () => {
    const roles = Object.values(OperatorRole);
    const permissions = Object.values(Permission);
    const grants = roles.flatMap((role) =>
      permissions.filter((permission) => (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission)).map((permission) => ({ role, permission })),
    );
    const good = await build({ rows: [{ roles, permissions, grants }] });
    await expect(permissionGuard(good.app).reloadMatrix()).resolves.toMatchObject({ roles, permissions, grants });

    const extra = await build({ rows: [{ roles, permissions, grants: [...grants, { role: 'TECHNICIAN', permission: 'PAIRING_MANAGE' }] }] });
    await expect(permissionGuard(extra.app).reloadMatrix()).rejects.toMatchObject({
      name: 'AccessRuleError',
      code: 'STORED_GRANTS_MISMATCH',
      problems: [{ code: 'STORED_GRANTS_MISMATCH', operationId: null, route: null, detail: 'extra grant: TECHNICIAN PAIRING_MANAGE' }],
    });
    expect(permissionGuard(extra.app).matrix()).toBeNull();
    // What is logged: the code, and the one problem with its direction, role and permission.
    // No other grant of the stored matrix, and no list of them.
    const refused = extra.log.lines().filter((entry) => entry['msg'] === 'the stored role matrix does not fit the access rules');
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({
      level: 50,
      code: 'STORED_GRANTS_MISMATCH',
      problems: [{ code: 'STORED_GRANTS_MISMATCH', operationId: null, route: null, detail: 'extra grant: TECHNICIAN PAIRING_MANAGE' }],
    });
    expect(JSON.stringify(refused[0])).not.toMatch(/SESSION_START|EVIDENCE_|INVESTIGATOR|SUPERVISOR|grants"/);

    const missing = await build({ rows: [{ roles, permissions, grants: grants.slice(1) }] });
    await expect(permissionGuard(missing.app).reloadMatrix()).rejects.toMatchObject({
      code: 'STORED_GRANTS_MISMATCH',
      problems: [{ detail: 'missing grant: INVESTIGATOR SESSION_START' }],
    });
    expect(permissionGuard(missing.app).matrix()).toBeNull();
  });

  it('reloadMatrix hands a driver failure on, logged by its code only', async () => {
    const built = await build({ failure: Object.assign(new Error('connection refused MARK-w28-driver'), { code: 'ECONNREFUSED' }) });
    await expect(permissionGuard(built.app).reloadMatrix()).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    expect(built.log.lines().find((line) => line['msg'] === 'the stored role matrix could not be read')).toMatchObject({ level: 50, code: 'ECONNREFUSED' });
    expect(built.log.text()).not.toContain('MARK-w28-driver');
  });
});
