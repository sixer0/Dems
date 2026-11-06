// The three routes of the storage module against the contract registry (plan row W37; module
// gate MODG; spec §7.2, §7.11, §7.17 member 34; AC-B-68). In-process, no database: the real app
// factory with a REAL headless simulator behind the seam `engine` (`support.ts`, the engine
// double) and stage 4 as a stand-in. Stage 6 (the access rule) and stage 7 (parsing, validation)
// are the server's own. The same operations against PostgreSQL and the real engine host are in
// `storage.db.test.ts`.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CORE_API_SCHEMAS,
  CoreApiAccessKind,
  CoreApiAuditNone,
  CoreApiTag,
  EPOCH_HEADER_NAME,
  REVISION_HEADER_NAME,
  RETENTION_DAYS_RANGE,
  SIM_ACTION_OPERATIONS,
  StoragePolicyRequestSchema,
  findCoreApiOperation,
  matchCoreApiOperation,
  validateCoreApiResponse,
  type CoreApiSchemaName,
} from '@dems/shared/api';
import { Permission, RETENTION_DAYS, RetentionPolicyId, type StoragePolicy } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { hostedActionsOfOperation } from '../../../engine';
import { ApiFailure } from '../../../plugins/error-envelope';
import { permissionGuard } from '../../../plugins/permission-guard';
import { STORAGE_MODULE_OPERATIONS, STORAGE_POLICY_ACTION, storageModule } from '../index';
import {
  ANONYMOUS,
  PAIRED_DEVICE,
  ROLES,
  SUPERVISOR,
  TECHNICIAN,
  bareRoutes,
  errorOf,
  moduleApp,
  operatorOf,
  outcome,
  post,
  registryOperationsOf,
  registrySignatures,
  routeSignatures,
  type ModuleApp,
  type ModuleAppOptions,
} from './support';

const STATUS = '/api/v1/storage/status';
const DETAIL = '/api/v1/storage/detail';
const POLICY = '/api/v1/storage/policy';

const scratchDir = mkdtempSync(join(tmpdir(), 'dems-w37-storage-'));
const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

async function build(options: ModuleAppOptions = {}): Promise<ModuleApp> {
  const built = await moduleApp(options);
  apps.push(built.app);
  return built;
}

/** The newest rows of the double's audit ring. */
const lastAudit = (built: ModuleApp) => built.engine.sim.store.getState().audit.rows.at(-1);
const auditTotal = (built: ModuleApp): number => built.engine.sim.store.getState().audit.total;
const policyOf = (built: ModuleApp): StoragePolicy => built.engine.sim.store.getState().storagePolicy;

describe('MODG: the route list of the storage module equals its registry operations', () => {
  it('registers exactly the three operations of the registry tag Storage, each with the method, the path and the operation ID of the registry', async () => {
    const fromModule = routeSignatures(await bareRoutes(storageModule));
    const fromRegistry = registrySignatures(CoreApiTag.STORAGE);
    console.info(`[w37] MODG routes of src/modules/storage:   ${fromModule.join(' | ')}`);
    console.info(`[w37] MODG registry, tag Storage (53-55):   ${fromRegistry.join(' | ')}`);
    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'GET /api/v1/storage/status getStorageStatus',
      'GET /api/v1/storage/detail getStorageDetail',
      'POST /api/v1/storage/policy setStoragePolicy',
    ]);
    expect(registryOperationsOf(CoreApiTag.STORAGE).map((operation) => operation.operationId)).toEqual([...STORAGE_MODULE_OPERATIONS]);
  });

  it('in the real app: the same three routes, nothing else under /api/v1/storage, and each matches its registry entry', async () => {
    const { registered } = await build();
    const own = registered.filter((route) => (STORAGE_MODULE_OPERATIONS as readonly string[]).includes(String(route.config?.operationId)));
    expect(routeSignatures(own)).toEqual(registrySignatures(CoreApiTag.STORAGE));
    expect(routeSignatures(registered.filter((route) => route.url.startsWith('/api/v1/storage')))).toEqual(routeSignatures(own));
    for (const route of own) expect(matchCoreApiOperation(String(route.method), route.url)?.operation.operationId).toBe(route.config?.operationId);
  });

  it('the operations are 53 (design book), 54 and 55 of the specification', () => {
    const sources = STORAGE_MODULE_OPERATIONS.map((operationId) => findCoreApiOperation(operationId)?.source);
    expect(sources[0]).toBe('Design book §21.2');
    expect(sources.slice(1).map((source) => Number(/operation (\d+)/.exec(source ?? '')?.[1]))).toEqual([54, 55]);
  });

  it('the schemas of each route are the registry\'s own objects: the body of 55 and the 200 answer of all three', async () => {
    const routes = await bareRoutes(storageModule);
    const named = (name: CoreApiSchemaName | undefined): unknown => (name === undefined ? undefined : CORE_API_SCHEMAS[name]);
    for (const route of routes) {
      const operation = findCoreApiOperation(String(route.config?.operationId));
      const schema = route.schema as { body?: unknown; querystring?: unknown; params?: unknown; response?: Record<number, unknown> } | undefined;
      expect(schema?.response?.[200], operation?.operationId).toBe(named(operation?.responses[200]?.schema));
      expect(Object.keys(schema?.response ?? {})).toEqual(['200']);
      expect(schema?.body, operation?.operationId).toBe(named(operation?.requestBody?.schema));
      expect(schema?.querystring).toBeUndefined();
      expect(schema?.params).toBeUndefined();
    }
    expect(findCoreApiOperation('setStoragePolicy')?.requestBody).toEqual({ schema: 'StoragePolicyRequest', required: true });
  });

  it('no route carries a hook or a rule of its own: the route configuration is the operation ID and nothing else', async () => {
    for (const route of await bareRoutes(storageModule)) {
      expect(route.config).toEqual({ operationId: route.config?.operationId });
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend', 'onResponse', 'onError'] as const) {
        expect(route[hook], `${String(route.config?.operationId)} ${hook}`).toBeUndefined();
      }
    }
  });

  it('the rules stage 6 applies to the three routes are the registry\'s: two AUTHENTICATED reads and the one any-of', async () => {
    const { app } = await build();
    const rules = permissionGuard(app)
      .registeredRules()
      .filter((rule) => (STORAGE_MODULE_OPERATIONS as readonly string[]).includes(rule.operationId));
    expect(rules.map((rule) => [rule.operationId, rule.method, rule.url, rule.kind, rule.permissions, rule.denial?.permission ?? null])).toEqual([
      ['getStorageStatus', 'GET', STATUS, CoreApiAccessKind.AUTHENTICATED, [], null],
      ['getStorageDetail', 'GET', DETAIL, CoreApiAccessKind.AUTHENTICATED, [], null],
      ['setStoragePolicy', 'POST', POLICY, CoreApiAccessKind.ANY_OF, [Permission.EVIDENCE_REVIEW, Permission.MAINTENANCE], 'EVIDENCE_REVIEW_OR_MAINTENANCE'],
    ]);
    expect(permissionGuard(app).routeProblems()).toEqual([]);
    expect(STORAGE_MODULE_OPERATIONS.map((operationId) => findCoreApiOperation(operationId)?.audit.success)).toEqual([
      CoreApiAuditNone.READ,
      CoreApiAuditNone.READ,
      'STORAGE_POLICY_CHANGED',
    ]);
  });

  it('spec §7.17 member 34: operation 55 runs the one hosted action the contract maps to it', () => {
    expect(hostedActionsOfOperation('setStoragePolicy')).toEqual([STORAGE_POLICY_ACTION]);
    expect(SIM_ACTION_OPERATIONS[STORAGE_POLICY_ACTION]).toEqual({ operations: ['setStoragePolicy'], execution: 'hosted' });
    // The two reads stand for no action.
    expect(hostedActionsOfOperation('getStorageStatus')).toEqual([]);
    expect(hostedActionsOfOperation('getStorageDetail')).toEqual([]);
  });
});

describe('operation 53 getStorageStatus', () => {
  it.each(ROLES)('%s reads the summary: 200, valid against the contract, and equal to what the simulator answers in Simulated mode', async (role) => {
    const built = await build();
    built.actAs(operatorOf(role));
    const response = await built.app.inject({ method: 'GET', url: STATUS });
    expect(response.statusCode).toBe(200);
    const body: unknown = response.json();
    expect(validateCoreApiResponse('getStorageStatus', 200, body)).toEqual({ ok: true });
    // The simulator's own REST handler on the same state (`sim/api.ts`).
    const simulated = built.engine.sim.request({ method: 'GET', path: STATUS });
    expect(simulated.status).toBe(200);
    expect(body).toEqual(simulated.body);
    expect(body).toMatchObject({ state: 'READY', retention: { policy: 'DAYS_90', days: 90, autoArchive: true } });
    // A read: the committed state once, no command, no state revision header, no cookie.
    expect(built.engine.reads).toEqual({ state: 1, slices: [] });
    expect(built.engine.commands).toEqual([]);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['x-dems-simulated']).toBeUndefined();
  });

  it('equals the simulator\'s answer while a recording fills the evidence volume, second by second', async () => {
    const built = await build({ scenario: 'recording' });
    built.actAs(operatorOf('INVESTIGATOR'));
    const seen: number[] = [];
    for (let second = 0; second < 5; second += 1) {
      built.clock.advance(1_000);
      built.engine.tick();
      const body = (await built.app.inject({ method: 'GET', url: STATUS })).json() as { usedBytes: number; freeBytes: number; totalBytes: number; writeBytesPerSec: number; estimatedRemainingMs: number };
      expect(body).toEqual(built.engine.sim.request({ method: 'GET', path: STATUS }).body);
      expect(validateCoreApiResponse('getStorageStatus', 200, body)).toEqual({ ok: true });
      expect(body.freeBytes).toBe(body.totalBytes - body.usedBytes);
      expect(Number.isInteger(body.estimatedRemainingMs)).toBe(true);
      expect(body.writeBytesPerSec).toBeGreaterThan(0);
      seen.push(body.usedBytes);
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(5);
  });

  it.each([
    ['STORAGE_LOW', 'LOW'],
    ['STORAGE_FULL', 'FULL'],
  ] as const)('equals the simulator\'s answer under the demo fault %s: state %s', async (fault, state) => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    built.engine.sim.actions.inject(fault);
    const body = (await built.app.inject({ method: 'GET', url: STATUS })).json() as { state: string; usedPercent: number };
    expect(body).toEqual(built.engine.sim.request({ method: 'GET', path: STATUS }).body);
    expect(validateCoreApiResponse('getStorageStatus', 200, body)).toEqual({ ok: true });
    expect(body.state).toBe(state);
    expect(body.usedPercent).toBeGreaterThanOrEqual(state === 'FULL' ? 98 : 85);
    expect(body.usedPercent).toBeLessThanOrEqual(100);
  });

  it('shows the retention policy of the same committed state: after a policy change the summary names the new one', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    expect((await post(built.app, POLICY, { retentionPolicy: 'CASE_CLOSURE', autoArchive: false })).statusCode).toBe(200);
    const body = (await built.app.inject({ method: 'GET', url: STATUS })).json() as { retention: unknown };
    expect(body.retention).toEqual({ policy: 'CASE_CLOSURE', days: 3_650, autoArchive: false });
  });
});

describe('operation 54 getStorageDetail', () => {
  it.each(ROLES)('%s reads the two slices in their wire form: 200, valid against the contract, equal to the committed state', async (role) => {
    const built = await build();
    built.actAs(operatorOf(role));
    const response = await built.app.inject({ method: 'GET', url: DETAIL });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(validateCoreApiResponse('getStorageDetail', 200, body)).toEqual({ ok: true });
    const state = built.engine.sim.store.getState();
    expect(Object.keys(body)).toEqual(['storage', 'storagePolicy']);
    expect(body).toEqual(JSON.parse(JSON.stringify({ storage: state.storage, storagePolicy: state.storagePolicy })));
    expect(body['storagePolicy']).toEqual({ retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true });
    // Both slices from ONE committed state: one read of the state, no second one.
    expect(built.engine.reads).toEqual({ state: 1, slices: [] });
    expect(built.engine.commands).toEqual([]);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
  });

  it('answers the slice as it is, the optional members of the storage slice included, and never changes the engine\'s state', async () => {
    const built = await build({ scenario: 'recording' });
    built.actAs(operatorOf('TECHNICIAN'));
    built.engine.sim.actions.inject('STORAGE_LOW');
    built.clock.advance(1_000);
    built.engine.tick();
    const before = built.engine.sim.store.getState();
    const copy = JSON.stringify({ storage: before.storage, storagePolicy: before.storagePolicy });
    const body = (await built.app.inject({ method: 'GET', url: DETAIL })).json() as { storage: { simulatedFillBytes?: number; writeRateHistory?: unknown[]; history: unknown[] } };
    expect(validateCoreApiResponse('getStorageDetail', 200, body)).toEqual({ ok: true });
    expect(body.storage.simulatedFillBytes).toBeGreaterThan(0);
    expect(body.storage.writeRateHistory?.length).toBeGreaterThan(0);
    expect(body.storage.history.length).toBeGreaterThan(0);
    const after = built.engine.sim.store.getState();
    expect(after.storage).toBe(before.storage);
    expect(after.storagePolicy).toBe(before.storagePolicy);
    expect(JSON.stringify({ storage: after.storage, storagePolicy: after.storagePolicy })).toBe(copy);
  });
});

describe('operation 55 setStoragePolicy: a hosted action', () => {
  it('a holder of EVIDENCE_REVIEW changes the policy: 200 with the committed policy, the action ran as the caller, the headers are the outcome\'s', async () => {
    const built = await build();
    const principal = operatorOf('SUPERVISOR');
    built.actAs(principal);
    const rows = auditTotal(built);
    const { epoch, revision } = built.engine.position;
    built.clock.advance(90_000);

    const response = await post(built.app, POLICY, { retentionPolicy: 'YEAR_1' });
    expect(response.statusCode).toBe(200);
    const body: unknown = response.json();
    expect(validateCoreApiResponse('setStoragePolicy', 200, body)).toEqual({ ok: true });
    expect(body).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true });
    expect(body).toEqual(policyOf(built));

    // ONE hosted action, under the principal of the request as it is, with the members the body named.
    expect(built.engine.commands).toHaveLength(1);
    expect(built.engine.commands[0]?.principal).toBe(principal);
    expect(built.engine.commands[0]?.action).toBe('setStoragePolicy');
    expect(built.engine.commands[0]?.args).toEqual([{ retentionPolicy: 'YEAR_1' }]);
    expect(Object.keys(built.engine.commands[0]?.args[0] as object)).toEqual(['retentionPolicy']);
    // The answer is read after the command, from the committed slice: no read of the whole state.
    expect(built.engine.reads).toEqual({ state: 0, slices: ['storagePolicy'] });

    // API-7: the epoch and the revision of the command's outcome, which moved by one change.
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(epoch));
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(revision + 1));

    // The simulator's row: the actor is the session's operator, the instant is the server clock's.
    expect(auditTotal(built)).toBe(rows + 1);
    expect(lastAudit(built)).toMatchObject({
      type: 'STORAGE_POLICY_CHANGED',
      actorId: SUPERVISOR.id,
      deviceId: 'HDD-EVIDENCE',
      at: built.clock.now(),
      message: 'Retention policy set to YEAR_1 (365 days)',
      details: { retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true },
    });
    expect(built.engine.sim.store.getState().events.at(-1)).toMatchObject({ type: 'STORAGE_POLICY_CHANGED', at: built.clock.now() });
    // Between commands nobody is signed in on the engine.
    expect(built.engine.sim.store.getState().auth.operatorId).toBeNull();
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('a holder of MAINTENANCE changes it too; each member alone keeps the others', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    expect((await post(built.app, POLICY, { autoArchive: false })).json()).toEqual({ retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: false });
    expect((await post(built.app, POLICY, { retentionDays: 45 })).json()).toEqual({ retentionPolicy: 'DAYS_90', retentionDays: 45, autoArchive: false });
    expect((await post(built.app, POLICY, { retentionPolicy: 'DAYS_30' })).json()).toEqual({ retentionPolicy: 'DAYS_30', retentionDays: 30, autoArchive: false });
    expect((await post(built.app, POLICY, { retentionPolicy: 'CASE_CLOSURE', retentionDays: 1_200, autoArchive: true })).json()).toEqual({
      retentionPolicy: 'CASE_CLOSURE',
      retentionDays: 1_200,
      autoArchive: true,
    });
    expect(built.engine.commands.map((command) => command.args[0])).toEqual([
      { autoArchive: false },
      { retentionDays: 45 },
      { retentionPolicy: 'DAYS_30' },
      { retentionPolicy: 'CASE_CLOSURE', retentionDays: 1_200, autoArchive: true },
    ]);
    expect(built.engine.sim.store.getState().audit.rows.slice(-4).map((row) => [row.type, row.actorId])).toEqual(Array(4).fill(['STORAGE_POLICY_CHANGED', TECHNICIAN.id]));
  });

  it.each([
    ['an empty object', {}],
    ['the values the policy already has', { retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true }],
    ['no body at all', undefined],
  ])('a body that changes nothing (%s) answers 200 with the policy, writes no row and keeps the revision', async (_label, payload) => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    const rows = auditTotal(built);
    const events = built.engine.sim.store.getState().events.length;
    const { epoch, revision } = built.engine.position;
    const response = await post(built.app, POLICY, payload);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true });
    expect(validateCoreApiResponse('setStoragePolicy', 200, response.json())).toEqual({ ok: true });
    // The action still ran: "unchanged" is the simulator's finding, not this module's.
    expect(built.engine.commands).toHaveLength(1);
    expect(auditTotal(built)).toBe(rows);
    expect(built.engine.sim.store.getState().events).toHaveLength(events);
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(epoch));
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(revision));
  });

  it('SR-65: nothing else of a body reaches the action: an actor, a role, a time or a revision a client sends is dropped', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    built.clock.advance(5_000);
    const response = await post(
      built.app,
      `${POLICY}?actorId=${SUPERVISOR.id}&role=SUPERVISOR`,
      { retentionDays: 30, actorId: SUPERVISOR.id, operatorId: SUPERVISOR.id, role: 'SUPERVISOR', at: 1, revision: 9_999, permission: 'EVIDENCE_REVIEW' },
      { 'x-operator-id': SUPERVISOR.id, 'x-dems-revision': '9999', 'x-dems-epoch': '1' },
    );
    expect(response.statusCode).toBe(200);
    expect(built.engine.commands[0]?.args).toEqual([{ retentionDays: 30 }]);
    expect(lastAudit(built)).toMatchObject({ type: 'STORAGE_POLICY_CHANGED', actorId: TECHNICIAN.id, at: built.clock.now() });
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(built.engine.position.revision));
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(built.engine.position.epoch));
  });

  it.each([
    ['retentionDays 0', { retentionDays: 0 }],
    ['retentionDays 3,651', { retentionDays: 3_651 }],
    ['retentionDays -1', { retentionDays: -1 }],
    ['retentionDays 1.5', { retentionDays: 1.5 }],
    ['retentionDays as a text', { retentionDays: '30' }],
    ['retentionDays null', { retentionDays: null }],
    ['an unknown policy', { retentionPolicy: 'FOREVER' }],
    ['a policy in another case', { retentionPolicy: 'year_1' }],
    ['autoArchive as a text', { autoArchive: 'yes' }],
    ['autoArchive as a number', { autoArchive: 1 }],
    ['one valid and one invalid member', { retentionPolicy: 'YEAR_1', retentionDays: 4_000 }],
  ])('422 INVALID_INPUT for %s: the engine is not asked and nothing changes', async (_label, payload) => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    const rows = auditTotal(built);
    const response = await post(built.app, POLICY, payload);
    expect(outcome(response)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(response).details).toEqual({ in: 'body' });
    expect(validateCoreApiResponse('setStoragePolicy', 422, response.json())).toEqual({ ok: true });
    expect(built.engine.commands).toEqual([]);
    expect(auditTotal(built)).toBe(rows);
    expect(policyOf(built)).toEqual({ retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true });
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
  });

  it('the bounds are accepted: 1 day and 3,650 days', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    expect((await post(built.app, POLICY, { retentionDays: RETENTION_DAYS_RANGE.min })).json()).toMatchObject({ retentionDays: 1 });
    expect((await post(built.app, POLICY, { retentionDays: RETENTION_DAYS_RANGE.max })).json()).toMatchObject({ retentionDays: 3_650 });
    expect(RETENTION_DAYS_RANGE).toEqual({ min: 1, max: 3_650 });
  });

  it('the bounds are the simulator\'s: the request schema accepts exactly what the hosted action accepts, for the days and for the policy names', async () => {
    const built = await build();
    const supervisor = operatorOf('SUPERVISOR');
    const accepts = async (patch: Partial<StoragePolicy>): Promise<boolean | string> =>
      built.engine.host.command(supervisor, 'setStoragePolicy', patch).then(
        () => true,
        (error: unknown) => (error instanceof ApiFailure ? `${error.statusCode} ${error.code} ${String(error.details?.['simCode'])}` : 'unexpected'),
      );
    for (const days of [-1, 0, 1, 2, 3_649, 3_650, 3_651, 1.5]) {
      const bySchema = StoragePolicyRequestSchema.safeParse({ retentionDays: days }).success;
      expect([days, await accepts({ retentionDays: days })]).toEqual([days, bySchema ? true : '422 INVALID_INPUT POLICY_RANGE']);
    }
    for (const name of [...Object.values(RetentionPolicyId), 'FOREVER']) {
      const bySchema = StoragePolicyRequestSchema.safeParse({ retentionPolicy: name }).success;
      expect([name, await accepts({ retentionPolicy: name as RetentionPolicyId })]).toEqual([name, bySchema ? true : '422 INVALID_INPUT POLICY_RANGE']);
    }
    // A policy sent alone sets the days the simulator's table gives it.
    expect(Object.keys(RETENTION_DAYS)).toEqual(Object.values(RetentionPolicyId));
  });

  it.each([
    ['an array', '[1, 2]'],
    ['a text', '"YEAR_1"'],
    ['null', 'null'],
    ['a number', '365'],
    ['text that is no JSON', '{ retentionDays: 30'],
  ])('400 INVALID_JSON for a body that is %s: the engine is not asked', async (_label, raw) => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const response = await built.app.inject({ method: 'POST', url: POLICY, headers: { origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' }, payload: raw });
    expect(outcome(response)).toEqual([400, 'INVALID_JSON']);
    expect(validateCoreApiResponse('setStoragePolicy', 400, response.json())).toEqual({ ok: true });
    expect(built.engine.commands).toEqual([]);
  });
});

describe('who may call is stage 6\'s, from the registry: this module is never reached by a caller it refuses', () => {
  it('the any-of: a holder of neither permission is refused with one audited row that names both as one code, before the body is read', async () => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR'));
    for (const payload of [{ retentionPolicy: 'YEAR_1' }, { retentionDays: 0 }, undefined]) {
      const before = built.database.committed.auditSeqs.length;
      const response = await post(built.app, POLICY, payload);
      expect(outcome(response)).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(response).details).toEqual({ operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role: 'INVESTIGATOR' });
      expect(validateCoreApiResponse('setStoragePolicy', 403, response.json())).toEqual({ ok: true });
      expect(built.database.committed.auditSeqs).toHaveLength(before + 1);
    }
    // The body of a refused caller is not even parsed.
    const raw = await built.app.inject({ method: 'POST', url: POLICY, headers: { origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' }, payload: '{ not json' });
    expect(outcome(raw)).toEqual([403, 'NOT_PERMITTED']);
    expect(built.engine.commands).toEqual([]);
    expect(built.engine.reads).toEqual({ state: 0, slices: [] });
    expect(policyOf(built)).toEqual({ retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true });
  });

  it('a holder of either permission is allowed and writes no denial row', async () => {
    const built = await build();
    for (const role of ['SUPERVISOR', 'TECHNICIAN'] as const) {
      built.actAs(operatorOf(role));
      expect((await post(built.app, POLICY, {})).statusCode).toBe(200);
    }
    expect(built.database.committed.auditSeqs).toEqual([]);
    expect(built.engine.commands.map((command) => (command.principal.kind === 'OPERATOR' ? command.principal.role : null))).toEqual(['SUPERVISOR', 'TECHNICIAN']);
  });

  it.each([
    ['nobody', ANONYMOUS],
    ['a paired device without an operator', PAIRED_DEVICE],
  ])('%s: 401 NOT_SIGNED_IN on all three operations, no row, the engine untouched', async (_label, principal) => {
    const built = await build();
    built.actAs(principal);
    for (const [operationId, response] of [
      ['getStorageStatus', await built.app.inject({ method: 'GET', url: STATUS })],
      ['getStorageDetail', await built.app.inject({ method: 'GET', url: DETAIL })],
      ['setStoragePolicy', await post(built.app, POLICY, { retentionDays: 30 })],
    ] as const) {
      expect([operationId, ...outcome(response)]).toEqual([operationId, 401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse(operationId, 401, response.json())).toEqual({ ok: true });
    }
    expect(built.database.committed.auditSeqs).toEqual([]);
    expect(built.engine.commands).toEqual([]);
    expect(built.engine.reads).toEqual({ state: 0, slices: [] });
  });

  it('an operator on a paired device calls all three: the principal that reaches the action names the device session', async () => {
    const built = await build();
    const onDevice = operatorOf('TECHNICIAN', 'DEV-0001');
    built.actAs(onDevice);
    expect((await built.app.inject({ method: 'GET', url: STATUS })).statusCode).toBe(200);
    expect((await built.app.inject({ method: 'GET', url: DETAIL })).statusCode).toBe(200);
    // A device sends no Origin (decision D69).
    const response = await built.app.inject({ method: 'POST', url: POLICY, payload: { retentionDays: 60 } });
    expect(response.statusCode).toBe(200);
    expect(built.engine.commands[0]?.principal).toBe(onDevice);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});

describe('the answers that are not this module\'s own', () => {
  it('405 with `allow` for the other method on each path', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    for (const [method, url, allow] of [
      ['POST', STATUS, 'GET'],
      ['POST', DETAIL, 'GET'],
      ['GET', POLICY, 'POST'],
    ] as const) {
      const response = await built.app.inject({ method, url, headers: { origin: 'http://127.0.0.1:5173' } });
      expect([url, ...outcome(response)]).toEqual([url, 405, 'METHOD_NOT_ALLOWED']);
      expect(response.headers['allow']).toBe(allow);
    }
    expect(built.engine.commands).toEqual([]);
  });

  it('503 NOT_READY from the readiness stage while the engine is not ready: no operation reaches the engine', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.app.readiness.set('engine', false);
    for (const [operationId, response] of [
      ['getStorageStatus', await built.app.inject({ method: 'GET', url: STATUS })],
      ['getStorageDetail', await built.app.inject({ method: 'GET', url: DETAIL })],
      ['setStoragePolicy', await post(built.app, POLICY, { retentionDays: 30 })],
    ] as const) {
      expect([operationId, ...outcome(response)]).toEqual([operationId, 503, 'NOT_READY']);
      expect(validateCoreApiResponse(operationId, 503, response.json())).toEqual({ ok: true });
    }
    expect(built.engine.commands).toEqual([]);
    expect(built.engine.reads).toEqual({ state: 0, slices: [] });
  });

  it('a refusal of the engine host is left to propagate as it is: 503 of a host that stopped, and the simulator\'s 422 with its code', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.engine.running = false;
    expect(outcome(await built.app.inject({ method: 'GET', url: STATUS }))).toEqual([503, 'NOT_READY']);
    expect(outcome(await built.app.inject({ method: 'GET', url: DETAIL }))).toEqual([503, 'NOT_READY']);
    const stopped = await post(built.app, POLICY, { retentionDays: 30 });
    expect(outcome(stopped)).toEqual([503, 'NOT_READY']);
    expect(stopped.headers[REVISION_HEADER_NAME]).toBeUndefined();
    built.engine.running = true;

    built.engine.failNext(new ApiFailure(422, 'INVALID_INPUT', 'The request does not match the expected input.', { details: { simCode: 'POLICY_RANGE', from: null, event: 'setStoragePolicy' } }));
    const refused = await post(built.app, POLICY, { retentionDays: 30 });
    expect(outcome(refused)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(refused).details).toEqual({ simCode: 'POLICY_RANGE', from: null, event: 'setStoragePolicy' });
    expect(validateCoreApiResponse('setStoragePolicy', 422, refused.json())).toEqual({ ok: true });
    expect(refused.headers[REVISION_HEADER_NAME]).toBeUndefined();
    // The answer of a refused command is not the policy: the slice was not read.
    expect(built.engine.reads.slices).toEqual([]);
  });

  it('finding F-W37-2: an engine that stops between the commit and the answer: 503 NOT_READY without the two headers, although the change is committed', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    const rows = auditTotal(built);
    built.engine.stopAfterCommand = true;
    const response = await post(built.app, POLICY, { retentionPolicy: 'YEAR_1' });
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    // The hosted action ran and its row is there: the answer, not the change, was lost.
    expect(policyOf(built)).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true });
    expect(auditTotal(built)).toBe(rows + 1);
    // Once the engine runs again the reads answer the committed policy.
    built.engine.running = true;
    expect((await built.app.inject({ method: 'GET', url: DETAIL })).json()).toMatchObject({ storagePolicy: { retentionPolicy: 'YEAR_1', retentionDays: 365 } });
  });

  it('an unexpected failure answers 500 INTERNAL_ERROR with no detail, and is in the log and in the persistent error log by its name', async () => {
    const errorLogFile = join(scratchDir, 'errors.log');
    const built = await build({ errorLogFile });
    built.actAs(operatorOf('TECHNICIAN'));
    const marker = 'MARK-w37-storage-detail';
    for (const [operationId, call] of [
      ['getStorageStatus', () => built.app.inject({ method: 'GET', url: STATUS })],
      ['getStorageDetail', () => built.app.inject({ method: 'GET', url: DETAIL })],
      ['setStoragePolicy', () => post(built.app, POLICY, { retentionDays: 30 })],
    ] as const) {
      built.engine.failNext(Object.assign(new TypeError(`broken ${marker}`), { code: 'W37_TEST' }));
      const response = await call();
      expect([operationId, ...outcome(response)]).toEqual([operationId, 500, 'INTERNAL_ERROR']);
      expect(response.body).not.toContain(marker);
      expect(validateCoreApiResponse(operationId, 500, response.json())).toEqual({ ok: true });
    }
    const lines = built.log.lines().filter((line) => line['msg'] === 'unexpected error while handling a request');
    expect(lines).toHaveLength(3);
    expect(lines.every((line) => line['level'] === 50)).toBe(true);
    await built.app.close();
    const persisted = readFileSync(errorLogFile, 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(persisted).toHaveLength(3);
    expect(persisted.every((entry) => entry['level'] === 'error' && entry['errorName'] === 'TypeError')).toBe(true);
  });
});
