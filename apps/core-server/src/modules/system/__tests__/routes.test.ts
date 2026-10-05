// The five routes of the system module against the contract registry (plan row W40; module gate
// MODG; spec §7.2, §7.3, §7.14, §7.17 members 32, 35, 36, 38, 39, §13.2; SR-82, AC-B-89).
// In-process, no database: the real app factory with a REAL headless simulator behind the seam
// `engine` (`support.ts`, the engine double) and stage 4 as a stand-in. Stage 6 (the access
// rule) and stage 7 (parsing, validation) are the server's own. The same operations against
// PostgreSQL and the real engine host are in `system.db.test.ts` and `effects.db.test.ts`.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CORE_API_SCHEMAS,
  CoreApiAccessKind,
  CoreApiAuditNone,
  CoreApiTag,
  DIAGNOSTICS_RUN_ID_PATTERN,
  EPOCH_HEADER_NAME,
  REVISION_HEADER_NAME,
  SIM_ACTION_OPERATIONS,
  findCoreApiOperation,
  matchCoreApiOperation,
  validateCoreApiResponse,
  type CoreApiSchemaName,
} from '@dems/shared/api';
import { DEFAULT_SETTINGS, Permission, SERVICES_RESTART_SCOPE, type OperatorRole, type SettingsSlice } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { hostedActionsOfOperation } from '../../../engine';
import { ApiFailure } from '../../../plugins/error-envelope';
import { permissionGuard } from '../../../plugins/permission-guard';
import { SETTINGS_CHANGED_MESSAGE, SETTINGS_UNIT_LABEL, SYSTEM_ACTION_OF_OPERATION, SYSTEM_MODULE_OPERATIONS, systemModule, systemStatusOf } from '../index';
import {
  ANONYMOUS,
  DIAGNOSTICS,
  PAIRED_DEVICE,
  ROLES,
  SERVICES_RESTART,
  SETTINGS,
  SYSTEM_STATUS,
  TICK_MS,
  UPDATE,
  bareRoutes,
  bodyOf,
  errorOf,
  linesWith,
  memberNames,
  moduleApp,
  operatorOf,
  outcome,
  ownMembers,
  post,
  registryOperationsOf,
  registrySignatures,
  routeSignatures,
  seeded,
  stringValues,
  type ModuleApp,
  type ModuleAppOptions,
} from './support';

const scratchDir = mkdtempSync(join(tmpdir(), 'dems-w40-system-'));
const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

/** How many lines the log held when the app was handed to the test: the lines of the start-up are not a call's. */
const linesAtBuild = new WeakMap<ModuleApp, number>();

async function build(options: ModuleAppOptions = {}): Promise<ModuleApp> {
  const built = await moduleApp(options);
  apps.push(built.app);
  linesAtBuild.set(built, built.log.lines().length);
  return built;
}

/** The lines written since the app was built that are not the logger's own line of a request. */
const moduleLines = (built: ModuleApp) =>
  built.log
    .lines()
    .slice(linesAtBuild.get(built) ?? 0)
    .filter((line) => line['msg'] !== 'request completed');

/** The engine double at its cadence: the clock moves, then the simulator's own tick. */
function drive(built: ModuleApp, ms: number, stepMs = TICK_MS): void {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    built.clock.advance(stepMs);
    built.engine.tick();
  }
}

const state = (built: ModuleApp) => built.engine.state();
const lastAudit = (built: ModuleApp) => state(built).audit.rows.at(-1);
const auditTotal = (built: ModuleApp): number => state(built).audit.total;
const wire = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;

const SESSION_INPUT = {
  caseNumber: 'LP/2026/1001-0099',
  subjectType: 'SAKSI',
  subjectName: 'Test Subject',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const;

type OpenState = 'CREATE' | 'PRECHECK' | 'ARMED' | 'RECORDING';

/** Brings the double's simulator to an open session in `upTo`, through the simulator's own actions. */
function openSession(built: ModuleApp, upTo: OpenState): void {
  const investigator = seeded('INVESTIGATOR');
  const created = built.engine.act('INVESTIGATOR', (actions) => actions.createSession({ ...SESSION_INPUT, investigatorId: investigator.id }));
  expect(created).toMatchObject({ ok: true, created: true });
  if (upTo !== 'CREATE') {
    built.engine.act('INVESTIGATOR', (actions) => actions.beginPrecheck());
    if (upTo !== 'PRECHECK') {
      drive(built, 5_000);
      if (state(built).session?.state === 'PRECHECK') built.engine.act('INVESTIGATOR', (actions) => actions.acknowledgePrecheckWarnings());
      if (upTo === 'RECORDING') {
        built.engine.act('INVESTIGATOR', (actions) => actions.startRecording());
        drive(built, 1_000);
      }
    }
  }
  expect(state(built).session?.state).toBe(upTo);
}

const SETTINGS_KEYS = ['notifySound', 'notifyWarnings', 'presentationMode', 'timeFormat'] as const;

describe('MODG: the route list of the system module equals its registry operations', () => {
  it('registers exactly the five operations of the registry tag System, each with the method, the path and the operation ID of the registry', async () => {
    const fromModule = routeSignatures(await bareRoutes(systemModule));
    const fromRegistry = registrySignatures(CoreApiTag.SYSTEM);
    console.info(`[w40] MODG routes of src/modules/system:   ${fromModule.join(' | ')}`);
    console.info(`[w40] MODG registry, tag System (64-68):   ${fromRegistry.join(' | ')}`);
    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'GET /api/v1/system/status getSystemStatus',
      'POST /api/v1/system/diagnostics runDiagnostics',
      'POST /api/v1/system/services/restart restartServices',
      'POST /api/v1/system/update startSoftwareUpdate',
      'POST /api/v1/settings updateSettings',
    ]);
    expect(registryOperationsOf(CoreApiTag.SYSTEM).map((operation) => operation.operationId)).toEqual([...SYSTEM_MODULE_OPERATIONS]);
  });

  it('in the real app: the same five routes, nothing else under /api/v1/system or /api/v1/settings, and each matches its registry entry', async () => {
    const { registered } = await build();
    const own = registered.filter((route) => (SYSTEM_MODULE_OPERATIONS as readonly string[]).includes(String(route.config?.operationId)));
    expect(routeSignatures(own)).toEqual(registrySignatures(CoreApiTag.SYSTEM));
    expect(routeSignatures(registered.filter((route) => route.url.startsWith('/api/v1/system') || route.url.startsWith('/api/v1/settings')))).toEqual(routeSignatures(own));
    for (const route of own) expect(matchCoreApiOperation(String(route.method), route.url)?.operation.operationId).toBe(route.config?.operationId);
  });

  it('the operations are 64 to 68 of the specification', () => {
    const numbers = SYSTEM_MODULE_OPERATIONS.map((operationId) => Number(/operation (\d+)/.exec(findCoreApiOperation(operationId)?.source ?? '')?.[1]));
    expect(numbers).toEqual([64, 65, 66, 67, 68]);
  });

  it('the schemas of each route are the registry\'s own objects: the body of 68 and the one success answer of each; 67 has no body to describe', async () => {
    const routes = await bareRoutes(systemModule);
    const named = (name: CoreApiSchemaName | undefined): unknown => (name === undefined ? undefined : CORE_API_SCHEMAS[name]);
    const successOf: Readonly<Record<string, number>> = { getSystemStatus: 200, runDiagnostics: 202, restartServices: 200, startSoftwareUpdate: 202, updateSettings: 200 };
    for (const route of routes) {
      const operationId = String(route.config?.operationId);
      const operation = findCoreApiOperation(operationId);
      const status = successOf[operationId] ?? 0;
      const schema = route.schema as { body?: unknown; querystring?: unknown; params?: unknown; response?: Record<number, unknown> } | undefined;
      expect(Object.keys(operation?.responses ?? {}).filter((code) => code.startsWith('2')), operationId).toEqual([String(status)]);
      expect(schema?.response?.[status], operationId).toBe(named(operation?.responses[status]?.schema));
      expect(Object.keys(schema?.response ?? {}), operationId).toEqual(operation?.responses[status]?.schema === undefined ? [] : [String(status)]);
      expect(schema?.body, operationId).toBe(named(operation?.requestBody?.schema));
      expect(schema?.querystring).toBeUndefined();
      expect(schema?.params).toBeUndefined();
    }
    expect(findCoreApiOperation('updateSettings')?.requestBody).toEqual({ schema: 'SettingsUpdateRequest', required: true });
    expect(findCoreApiOperation('startSoftwareUpdate')?.responses[202]?.schema).toBeUndefined();
    expect(SYSTEM_MODULE_OPERATIONS.filter((operationId) => findCoreApiOperation(operationId)?.requestBody !== undefined)).toEqual(['updateSettings']);
  });

  it('no route carries a hook or a rule of its own: the route configuration is the operation ID and nothing else', async () => {
    for (const route of await bareRoutes(systemModule)) {
      expect(route.config).toEqual({ operationId: route.config?.operationId });
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend', 'onResponse', 'onError'] as const) {
        expect(route[hook], `${String(route.config?.operationId)} ${hook}`).toBeUndefined();
      }
    }
  });

  it('the rules stage 6 applies to the five routes are the registry\'s: two AUTHENTICATED, DIAGNOSTICS_RUN, and MAINTENANCE twice', async () => {
    const { app } = await build();
    const rules = permissionGuard(app)
      .registeredRules()
      .filter((rule) => (SYSTEM_MODULE_OPERATIONS as readonly string[]).includes(rule.operationId));
    expect(rules.map((rule) => [rule.operationId, rule.method, rule.url, rule.kind, rule.permissions])).toEqual([
      ['getSystemStatus', 'GET', SYSTEM_STATUS, CoreApiAccessKind.AUTHENTICATED, []],
      ['runDiagnostics', 'POST', DIAGNOSTICS, CoreApiAccessKind.PERMISSION, [Permission.DIAGNOSTICS_RUN]],
      ['restartServices', 'POST', SERVICES_RESTART, CoreApiAccessKind.PERMISSION, [Permission.MAINTENANCE]],
      ['startSoftwareUpdate', 'POST', UPDATE, CoreApiAccessKind.PERMISSION, [Permission.MAINTENANCE]],
      ['updateSettings', 'POST', SETTINGS, CoreApiAccessKind.AUTHENTICATED, []],
    ]);
    expect(permissionGuard(app).routeProblems()).toEqual([]);
    expect(SYSTEM_MODULE_OPERATIONS.map((operationId) => findCoreApiOperation(operationId)?.audit.success)).toEqual([
      CoreApiAuditNone.READ,
      'DIAGNOSTICS_RUN',
      'DEVICE_COMMAND',
      'UPDATE_STARTED',
      CoreApiAuditNone.PARITY,
    ]);
  });

  it('spec §7.17: each command runs a hosted action the contract maps to its operation; operation 68 has two, and the route runs the one that takes any member', () => {
    expect(hostedActionsOfOperation('getSystemStatus')).toEqual([]);
    expect(hostedActionsOfOperation('runDiagnostics')).toEqual([SYSTEM_ACTION_OF_OPERATION.runDiagnostics]);
    expect(hostedActionsOfOperation('startSoftwareUpdate')).toEqual([SYSTEM_ACTION_OF_OPERATION.startSoftwareUpdate]);
    expect(hostedActionsOfOperation('restartServices')).toEqual([SYSTEM_ACTION_OF_OPERATION.restartServices]);
    expect(hostedActionsOfOperation('updateSettings')).toEqual(['setPresentationMode', 'updateSettings']);
    expect(SYSTEM_ACTION_OF_OPERATION.updateSettings).toBe('updateSettings');
    for (const [operationId, action] of Object.entries(SYSTEM_ACTION_OF_OPERATION)) {
      expect(SIM_ACTION_OPERATIONS[action], operationId).toEqual({ operations: [operationId], execution: 'hosted' });
    }
    expect(Object.keys(SYSTEM_ACTION_OF_OPERATION)).toEqual(SYSTEM_MODULE_OPERATIONS.filter((operationId) => findCoreApiOperation(operationId)?.method === 'post'));
  });
});

describe('64 getSystemStatus', () => {
  it.each(ROLES)('%s reads the five slices of the committed state in their wire form: 200, valid against the contract', async (role) => {
    const built = await build();
    built.actAs(operatorOf(role));
    const response = await built.app.inject({ method: 'GET', url: SYSTEM_STATUS });
    expect(response.statusCode).toBe(200);
    const { device, services, update, diagnostics, settings } = state(built);
    expect(response.json()).toEqual(wire({ device, services, update, diagnostics, settings }));
    expect(Object.keys(response.json() as object)).toEqual(['device', 'services', 'update', 'diagnostics', 'settings']);
    expect(validateCoreApiResponse('getSystemStatus', 200, response.json())).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
  });

  it('takes the committed state ONCE, opens no unit of work and changes nothing', async () => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR'));
    const before = state(built);
    expect((await built.app.inject({ method: 'GET', url: SYSTEM_STATUS })).statusCode).toBe(200);
    expect(built.engine.reads).toEqual({ state: 1, slices: [] });
    expect(built.engine.units).toEqual([]);
    expect(state(built)).toBe(before);
    expect(built.database.committed.auditSeqs).toEqual([]);
  });

  it('the idle Core: sixteen services running, version 2.5.0 available, no diagnostics run yet, the default settings', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const body = (await built.app.inject({ method: 'GET', url: SYSTEM_STATUS })).json() as ReturnType<typeof systemStatusOf>;
    expect(body.services).toHaveLength(16);
    expect(body.services.every((service) => service.status === 'RUNNING')).toBe(true);
    expect(body.update).toMatchObject({ state: 'IDLE', currentVersion: '2.4.1', availableVersion: '2.5.0', activeSlot: 'A' });
    expect(body.diagnostics).toBeNull();
    expect(body.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('follows the state: a diagnostics run, a running update and a changed setting are in the next answer', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const runId = built.engine.act('TECHNICIAN', (actions) => actions.runDiagnostics());
    built.engine.act('TECHNICIAN', (actions) => actions.startSoftwareUpdate());
    built.engine.sim.actions.updateSettings({ timeFormat: '12' });
    drive(built, 1_000);
    const body = (await built.app.inject({ method: 'GET', url: SYSTEM_STATUS })).json() as ReturnType<typeof systemStatusOf>;
    expect(body.diagnostics).toMatchObject({ id: runId, completedAt: null });
    expect(body.diagnostics?.checks).toHaveLength(8);
    expect(body.update.state).toBe('RUNNING');
    expect(body.settings.timeFormat).toBe('12');
    const now = state(built);
    expect(body).toEqual(wire({ device: now.device, services: now.services, update: now.update, diagnostics: now.diagnostics, settings: now.settings }));
    expect(validateCoreApiResponse('getSystemStatus', 200, body)).toEqual({ ok: true });
  });

  it('nobody without a session reads it: 401 NOT_SIGNED_IN for an anonymous caller and for a paired device without an operator', async () => {
    const built = await build();
    for (const caller of [ANONYMOUS, PAIRED_DEVICE]) {
      built.actAs(caller);
      const response = await built.app.inject({ method: 'GET', url: SYSTEM_STATUS });
      expect(outcome(response), caller.kind).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse('getSystemStatus', 401, response.json())).toEqual({ ok: true });
    }
    expect(built.engine.reads.state).toBe(0);
  });

  it('an engine that is not running: 503 NOT_READY', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.engine.running = false;
    const response = await built.app.inject({ method: 'GET', url: SYSTEM_STATUS });
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(validateCoreApiResponse('getSystemStatus', 503, response.json())).toEqual({ ok: true });
  });

  it('the projection is the five slices by reference and nothing else of the state', async () => {
    const built = await build();
    const whole = state(built);
    const status = systemStatusOf(whole);
    expect(Object.keys(status)).toEqual(['device', 'services', 'update', 'diagnostics', 'settings']);
    for (const key of ['device', 'services', 'update', 'diagnostics', 'settings'] as const) expect(status[key]).toBe(whole[key]);
  });
});

describe('65 runDiagnostics', () => {
  it.each(ROLES)('%s starts a run: 202 with its ID, one hosted action in one unit, the DIAGNOSTICS_RUN row names the caller', async (role) => {
    const built = await build();
    const caller = operatorOf(role);
    built.actAs(caller);
    const before = auditTotal(built);
    const response = await post(built.app, DIAGNOSTICS);
    expect(response.statusCode).toBe(202);
    const body = response.json() as { runId: string };
    expect(body).toEqual({ runId: state(built).diagnostics?.id });
    expect(body.runId).toMatch(DIAGNOSTICS_RUN_ID_PATTERN);
    expect(validateCoreApiResponse('runDiagnostics', 202, body)).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(built.engine.position.epoch));
    expect(response.headers[REVISION_HEADER_NAME]).toBe('41');
    expect(built.engine.units).toEqual([{ label: 'engine.runDiagnostics', committed: true, actions: ['runDiagnostics'], pendingReads: 0 }]);
    expect(built.engine.actions).toHaveLength(1);
    expect(built.engine.actions[0]?.principal).toBe(caller);
    expect(built.engine.actions[0]?.args).toEqual([]);
    expect(auditTotal(built)).toBe(before + 1);
    expect(lastAudit(built)).toMatchObject({ type: 'DIAGNOSTICS_RUN', actorId: caller.operatorId, details: { runId: body.runId, checks: 8 } });
    // No line of the module: a diagnostics run is audited.
    expect(moduleLines(built)).toEqual([]);
  });

  it('while a run is in progress the answer is the ID of that run, and nothing is written: no row, no revision', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const first = await post(built.app, DIAGNOSTICS);
    drive(built, 500);
    const rows = auditTotal(built);
    built.actAs(operatorOf('SUPERVISOR'));
    const second = await post(built.app, DIAGNOSTICS);
    expect(second.statusCode).toBe(202);
    expect(second.json()).toEqual(first.json());
    expect(auditTotal(built)).toBe(rows);
    expect(second.headers[REVISION_HEADER_NAME]).toBe(first.headers[REVISION_HEADER_NAME]);
    expect(validateCoreApiResponse('runDiagnostics', 202, second.json())).toEqual({ ok: true });
  });

  it('once the eight checks have resolved, the next call starts a new run with the next ID', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const first = (await post(built.app, DIAGNOSTICS)).json() as { runId: string };
    drive(built, 6_000);
    expect(state(built).diagnostics?.completedAt).not.toBeNull();
    expect(state(built).diagnostics?.checks.map((check) => check.status)).toEqual(Array.from({ length: 8 }, () => 'PASS'));
    const second = (await post(built.app, DIAGNOSTICS)).json() as { runId: string };
    expect(second.runId).not.toBe(first.runId);
    expect(state(built).diagnostics).toMatchObject({ id: second.runId, completedAt: null });
  });

  it('a caller without DIAGNOSTICS_RUN is refused by stage 6: 403 NOT_PERMITTED, one denial row, and the engine is not reached', async () => {
    const built = await build();
    built.actAs({ ...operatorOf('INVESTIGATOR'), permissions: [Permission.SESSION_START] });
    const response = await post(built.app, DIAGNOSTICS);
    expect(outcome(response)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(response).details).toMatchObject({ permission: 'DIAGNOSTICS_RUN' });
    expect(validateCoreApiResponse('runDiagnostics', 403, response.json())).toEqual({ ok: true });
    expect(built.database.committed.auditSeqs).toHaveLength(1);
    expect(built.engine.units).toEqual([]);
    expect(state(built).diagnostics).toBeNull();
  });

  it('nobody without a session starts a run: 401, and the engine is not reached', async () => {
    const built = await build();
    for (const caller of [ANONYMOUS, PAIRED_DEVICE]) {
      built.actAs(caller);
      expect(outcome(await post(built.app, DIAGNOSTICS)), caller.kind).toEqual([401, 'NOT_SIGNED_IN']);
    }
    expect(built.engine.units).toEqual([]);
  });

  it('an engine that is not running: 503 NOT_READY and no revision', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    built.engine.running = false;
    const response = await post(built.app, DIAGNOSTICS);
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
  });
});

describe('66 restartServices', () => {
  it('a TECHNICIAN restarts the services: 200 with the number the action returned, one DEVICE_COMMAND row with the scope CORE_SERVICES, every service started now', async () => {
    const built = await build();
    const caller = operatorOf('TECHNICIAN');
    built.actAs(caller);
    drive(built, 2_000);
    const now = built.clock.now();
    const before = auditTotal(built);
    const response = await post(built.app, SERVICES_RESTART);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ restarted: 16 });
    expect(validateCoreApiResponse('restartServices', 200, response.json())).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(built.engine.position.epoch));
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(built.engine.position.revision));
    expect(built.engine.units.at(-1)).toEqual({ label: 'engine.restartServices', committed: true, actions: ['restartServices'], pendingReads: 0 });
    expect(built.engine.actions.at(-1)?.principal).toBe(caller);
    expect(built.engine.actions.at(-1)?.args).toEqual([]);
    expect(auditTotal(built)).toBe(before + 1);
    expect(lastAudit(built)).toMatchObject({ type: 'DEVICE_COMMAND', actorId: caller.operatorId, at: now, details: { command: 'RESTART', scope: SERVICES_RESTART_SCOPE, services: 16 } });
    expect(state(built).services.map((service) => service.startedAt)).toEqual(Array.from({ length: 16 }, () => now));
  });

  it('the number is the simulator\'s: a service that is stopped is not restarted and not counted', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const services = state(built).services;
    const stopped = services[3];
    if (stopped === undefined) throw new Error('the dataset has fewer than four services');
    built.engine.sim.store.setState({ services: services.map((service) => (service === stopped ? { ...service, status: 'STOPPED' as const } : service)) });
    drive(built, 1_000);
    const response = await post(built.app, SERVICES_RESTART);
    expect(response.json()).toEqual({ restarted: 15 });
    expect(state(built).services.find((service) => service.id === stopped.id)?.startedAt).toBe(stopped.startedAt);
    expect(lastAudit(built)?.details).toMatchObject({ services: 15 });
  });

  it.each(['INVESTIGATOR', 'SUPERVISOR'] as const)('%s lacks MAINTENANCE: 403 NOT_PERMITTED by stage 6 with one denial row; the engine is not reached', async (role) => {
    const built = await build();
    built.actAs(operatorOf(role));
    const before = state(built);
    const response = await post(built.app, SERVICES_RESTART);
    expect(outcome(response)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(response).details).toMatchObject({ permission: 'MAINTENANCE' });
    expect(validateCoreApiResponse('restartServices', 403, response.json())).toEqual({ ok: true });
    expect(built.database.committed.auditSeqs).toHaveLength(1);
    expect(built.engine.units).toEqual([]);
    expect(state(built)).toBe(before);
  });

  it.each(['CREATE', 'PRECHECK', 'ARMED', 'RECORDING'] as const)('while a session is open (%s): 409 SESSION_ACTIVE with the simulator\'s code, no row, no revision, nothing changed', async (open) => {
    const built = await build();
    openSession(built, open);
    built.actAs(operatorOf('TECHNICIAN'));
    const before = state(built);
    const response = await post(built.app, SERVICES_RESTART);
    expect(outcome(response)).toEqual([409, 'SESSION_ACTIVE']);
    expect(errorOf(response).details).toEqual({ simCode: 'SESSION_ACTIVE', from: open, event: 'restartServices' });
    expect(validateCoreApiResponse('restartServices', 409, response.json())).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(built.engine.units.at(-1)).toMatchObject({ label: 'engine.restartServices', committed: false });
    // Set back by the unit: the very state object, and nobody is left signed in on the engine.
    expect(state(built).audit).toBe(before.audit);
    expect(state(built).services).toBe(before.services);
    expect(state(built).auth).toMatchObject({ status: 'SIGNED_OUT', operatorId: null });
  });

  it('nobody without a session restarts the services: 401', async () => {
    const built = await build();
    for (const caller of [ANONYMOUS, PAIRED_DEVICE]) {
      built.actAs(caller);
      expect(outcome(await post(built.app, SERVICES_RESTART)), caller.kind).toEqual([401, 'NOT_SIGNED_IN']);
    }
    expect(built.engine.units).toEqual([]);
  });
});

describe('67 startSoftwareUpdate', () => {
  it('a TECHNICIAN starts the update: 202 without a body, one UPDATE_STARTED row by the caller, the update RUNNING with six scheduled steps', async () => {
    const built = await build();
    const caller = operatorOf('TECHNICIAN');
    built.actAs(caller);
    const before = auditTotal(built);
    const response = await post(built.app, UPDATE);
    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('');
    expect(validateCoreApiResponse('startSoftwareUpdate', 202, bodyOf(response))).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(built.engine.position.epoch));
    expect(response.headers[REVISION_HEADER_NAME]).toBe('41');
    expect(built.engine.units).toEqual([{ label: 'engine.startSoftwareUpdate', committed: true, actions: ['startSoftwareUpdate'], pendingReads: 0 }]);
    expect(built.engine.actions[0]?.principal).toBe(caller);
    expect(built.engine.actions[0]?.args).toEqual([]);
    expect(auditTotal(built)).toBe(before + 1);
    expect(lastAudit(built)).toMatchObject({ type: 'UPDATE_STARTED', actorId: caller.operatorId, details: { from: '2.4.1', to: '2.5.0', targetSlot: 'B' } });
    expect(state(built).update).toMatchObject({ state: 'RUNNING', startedAt: built.clock.now(), completedAt: null });
    expect(state(built).update.steps.map((step) => step.status)).toEqual(['active', 'pending', 'pending', 'pending', 'pending', 'pending']);
  });

  it('a second call while the update runs: 202, nothing changes, nothing is written, the same revision', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const first = await post(built.app, UPDATE);
    drive(built, 1_000);
    const before = state(built);
    const second = await post(built.app, UPDATE);
    expect(second.statusCode).toBe(202);
    expect(second.body).toBe('');
    expect(state(built).update).toBe(before.update);
    expect(state(built).audit).toBe(before.audit);
    expect(second.headers[REVISION_HEADER_NAME]).toBe(first.headers[REVISION_HEADER_NAME]);
  });

  it('once the update has completed no version is available: a further call answers 202 and changes nothing', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    await post(built.app, UPDATE);
    drive(built, 12_000);
    expect(state(built).update).toMatchObject({ state: 'PASS', currentVersion: '2.5.0', availableVersion: null, activeSlot: 'B' });
    const before = state(built);
    const response = await post(built.app, UPDATE);
    expect(response.statusCode).toBe(202);
    expect(state(built).update).toBe(before.update);
    expect(state(built).audit).toBe(before.audit);
  });

  it.each(['CREATE', 'PRECHECK', 'ARMED', 'RECORDING'] as const)('while a session is open (%s): 409 SESSION_ACTIVE with the simulator\'s code, no row, no revision, the update not started', async (open) => {
    const built = await build();
    openSession(built, open);
    built.actAs(operatorOf('TECHNICIAN'));
    const before = state(built);
    const response = await post(built.app, UPDATE);
    expect(outcome(response)).toEqual([409, 'SESSION_ACTIVE']);
    expect(errorOf(response).details).toEqual({ simCode: 'SESSION_ACTIVE', from: open, event: 'startSoftwareUpdate' });
    expect(validateCoreApiResponse('startSoftwareUpdate', 409, response.json())).toEqual({ ok: true });
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(built.engine.units.at(-1)).toMatchObject({ label: 'engine.startSoftwareUpdate', committed: false });
    expect(state(built).update).toBe(before.update);
    expect(state(built).audit).toBe(before.audit);
    expect(state(built).auth).toMatchObject({ status: 'SIGNED_OUT', operatorId: null });
  });

  it('the order is the simulator\'s: with an update already running, or none available, a session does not make the call a conflict (202, nothing changes)', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    await post(built.app, UPDATE);
    openSession(built, 'CREATE');
    const running = state(built);
    const whileRunning = await post(built.app, UPDATE);
    expect(whileRunning.statusCode).toBe(202);
    expect(state(built).update).toBe(running.update);
    drive(built, 12_000);
    expect(state(built).update).toMatchObject({ state: 'PASS', availableVersion: null });
    expect(state(built).session?.state).toBe('CREATE');
    const completed = state(built);
    const afterwards = await post(built.app, UPDATE);
    expect(afterwards.statusCode).toBe(202);
    expect(state(built).update).toBe(completed.update);
    expect(state(built).audit).toBe(completed.audit);
  });

  it.each(['INVESTIGATOR', 'SUPERVISOR'] as const)('%s lacks MAINTENANCE: 403 NOT_PERMITTED by stage 6 with one denial row; the update is not started', async (role) => {
    const built = await build();
    built.actAs(operatorOf(role));
    const response = await post(built.app, UPDATE);
    expect(outcome(response)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(response).details).toMatchObject({ permission: 'MAINTENANCE' });
    expect(validateCoreApiResponse('startSoftwareUpdate', 403, response.json())).toEqual({ ok: true });
    expect(built.database.committed.auditSeqs).toHaveLength(1);
    expect(built.engine.units).toEqual([]);
    expect(state(built).update.state).toBe('IDLE');
  });
});

describe('67 startSoftwareUpdate: nobody without a session', () => {
  it('401 NOT_SIGNED_IN for an anonymous caller and for a paired device without an operator; the engine is not reached', async () => {
    const built = await build();
    for (const caller of [ANONYMOUS, PAIRED_DEVICE]) {
      built.actAs(caller);
      const response = await post(built.app, UPDATE);
      expect(outcome(response), caller.kind).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse('startSoftwareUpdate', 401, response.json())).toEqual({ ok: true });
    }
    expect(built.engine.units).toEqual([]);
    expect(state(built).update.state).toBe('IDLE');
  });
});

describe('the three commands without a request body', () => {
  it.each([
    ['runDiagnostics', DIAGNOSTICS],
    ['restartServices', SERVICES_RESTART],
    ['startSoftwareUpdate', UPDATE],
  ] as const)('%s takes no body: an empty JSON object is accepted, and a body that is no JSON object is still refused at stage 7 (400 INVALID_JSON)', async (operationId, url) => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    for (const payload of ['[1]', '{"broken": ', '"text"']) {
      const response = await post(built.app, url, payload);
      expect(outcome(response), payload).toEqual([400, 'INVALID_JSON']);
      console.info(`[w40] ${operationId}: body ${payload} answers 400 INVALID_JSON; against the contract: ${JSON.stringify(validateCoreApiResponse(operationId, 400, response.json()))}`);
    }
    expect(built.engine.units).toEqual([]);
    const accepted = await post(built.app, url, {});
    expect(accepted.statusCode).toBeLessThan(300);
    expect(built.engine.units).toHaveLength(1);
  });
});

describe('68 updateSettings', () => {
  const settingsOf = (built: ModuleApp): SettingsSlice => state(built).settings;
  const settingsLines = (built: ModuleApp) => linesWith(built.log, SETTINGS_CHANGED_MESSAGE);

  it.each(ROLES)('%s changes a setting: 200 with the settings after the change, valid against the contract, with the epoch and the revision of the unit', async (role) => {
    const built = await build();
    built.actAs(operatorOf(role));
    const response = await post(built.app, SETTINGS, { timeFormat: '12' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...DEFAULT_SETTINGS, timeFormat: '12' });
    expect(response.json()).toEqual(settingsOf(built));
    expect(validateCoreApiResponse('updateSettings', 200, response.json())).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(built.engine.position.epoch));
    expect(response.headers[REVISION_HEADER_NAME]).toBe('41');
  });

  it('one unit of work with ONE hosted action: the caller as it is, and a patch that holds exactly the members the body held', async () => {
    const built = await build();
    const caller = operatorOf('SUPERVISOR');
    built.actAs(caller);
    await post(built.app, SETTINGS, { notifySound: !DEFAULT_SETTINGS.notifySound, presentationMode: true });
    expect(built.engine.units).toEqual([{ label: SETTINGS_UNIT_LABEL, committed: true, actions: ['updateSettings'], pendingReads: 2 }]);
    expect(built.engine.actions).toHaveLength(1);
    expect(built.engine.actions[0]?.principal).toBe(caller);
    expect(built.engine.actions[0]?.unit).toBe('system.updateSettings');
    expect(built.engine.actions[0]?.args).toEqual([{ notifySound: !DEFAULT_SETTINGS.notifySound, presentationMode: true }]);
    expect(Object.keys(built.engine.actions[0]?.args[0] as object).sort()).toEqual(['notifySound', 'presentationMode']);
    // The answer is the COMMITTED slice, read after the unit.
    expect(built.engine.reads.slices).toEqual(['settings']);
  });

  it('SR-82, AC-B-89: a change writes NO audit row and EXACTLY ONE log line with the operator ID and the names of the changed settings, sorted, and no value', async () => {
    const built = await build();
    const caller = operatorOf('INVESTIGATOR');
    built.actAs(caller);
    const rows = auditTotal(built);
    const audit = state(built).audit;
    const response = await post(built.app, SETTINGS, { timeFormat: '12', notifyWarnings: !DEFAULT_SETTINGS.notifyWarnings, presentationMode: !DEFAULT_SETTINGS.presentationMode, notifySound: !DEFAULT_SETTINGS.notifySound });
    expect(response.statusCode).toBe(200);
    // The answer holds each of the four members as it is now.
    expect(response.json()).toEqual({ timeFormat: '12', notifyWarnings: !DEFAULT_SETTINGS.notifyWarnings, presentationMode: !DEFAULT_SETTINGS.presentationMode, notifySound: !DEFAULT_SETTINGS.notifySound });
    expect(response.json()).toEqual(state(built).settings);
    expect(auditTotal(built)).toBe(rows);
    expect(state(built).audit).toBe(audit);
    expect(built.database.committed.auditSeqs).toEqual([]);

    const lines = settingsLines(built);
    expect(lines).toHaveLength(1);
    const line = lines[0] ?? {};
    expect(ownMembers(line)).toEqual({ operatorId: caller.operatorId, changedKeys: [...SETTINGS_KEYS] });
    expect(line['level']).toBe(30);
    // The line of the request and the line of the module carry the same request ID.
    const requestLine = built.log.lines().find((entry) => entry['msg'] === 'request completed');
    expect(line['reqId']).toBeDefined();
    expect(line['reqId']).toBe(requestLine?.['reqId']);
    console.info(`[w40] the log line of updateSettings: ${JSON.stringify({ ...line, time: '<time>', pid: '<pid>', hostname: '<host>', reqId: '<request id>' })}`);

    // No value of a setting anywhere in the captured log: no line has a member named after a
    // setting, the one string value among the settings ("12") is nowhere, and the module's line
    // holds no boolean at all.
    const everyLine = built.log.lines();
    for (const key of SETTINGS_KEYS) expect([...memberNames(everyLine)], key).not.toContain(key);
    expect(everyLine.flatMap((entry) => stringValues(entry))).not.toContain('12');
    expect(built.log.text()).not.toContain('"12"');
    expect(Object.values(ownMembers(line)).some((value) => typeof value === 'boolean')).toBe(false);
    for (const member of ['body', 'settings', 'patch', 'before', 'after', 'value', 'values']) expect([...memberNames(everyLine)], member).not.toContain(member);
  });

  it('the line names only what changed: a member sent with the value it already has is not named', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    await post(built.app, SETTINGS, { timeFormat: DEFAULT_SETTINGS.timeFormat, notifySound: !DEFAULT_SETTINGS.notifySound, notifyWarnings: DEFAULT_SETTINGS.notifyWarnings });
    expect(settingsLines(built).map(ownMembers)).toEqual([{ operatorId: seeded('TECHNICIAN').id, changedKeys: ['notifySound'] }]);
  });

  it('one line per call that changed something, in order, each with its own caller', async () => {
    const built = await build();
    const calls: ReadonlyArray<readonly [OperatorRole, Partial<SettingsSlice>, readonly string[]]> = [
      ['INVESTIGATOR', { presentationMode: true }, ['presentationMode']],
      ['SUPERVISOR', { timeFormat: '12' }, ['timeFormat']],
      ['TECHNICIAN', { presentationMode: false, timeFormat: '24' }, ['presentationMode', 'timeFormat']],
    ];
    for (const [role, body] of calls) {
      built.actAs(operatorOf(role));
      expect((await post(built.app, SETTINGS, body)).statusCode).toBe(200);
    }
    expect(settingsLines(built).map(ownMembers)).toEqual(calls.map(([role, , changedKeys]) => ({ operatorId: seeded(role).id, changedKeys })));
  });

  it.each([
    ['the values the settings already have', { ...DEFAULT_SETTINGS }],
    ['an empty object', {}],
    ['no body at all', undefined],
    ['only a key the settings do not have', { theme: 'w40-dark-value', volume: 11 }],
  ] as const)('a call that changes nothing (%s): 200 with the settings as they are, no line, no row, the same revision', async (_name, body) => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR'));
    const before = state(built);
    const response = await post(built.app, SETTINGS, body);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(DEFAULT_SETTINGS);
    expect(validateCoreApiResponse('updateSettings', 200, response.json())).toEqual({ ok: true });
    expect(response.headers[REVISION_HEADER_NAME]).toBe('40');
    expect(settingsOf(built)).toBe(before.settings);
    expect(state(built).audit).toBe(before.audit);
    expect(settingsLines(built)).toEqual([]);
    // An unknown key was dropped by the schema (API-4): neither its name nor its value reaches the action or the log.
    expect(built.engine.actions.at(-1)?.args).toEqual([body === undefined || 'theme' in body ? {} : body]);
    expect(built.log.text()).not.toContain('w40-dark-value');
    expect(built.log.text()).not.toContain('theme');
  });

  it('an unknown key beside a real change: the change is made, the line names the real setting only', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    const response = await post(built.app, SETTINGS, { notifyWarnings: !DEFAULT_SETTINGS.notifyWarnings, theme: 'w40-dark-value' });
    expect(response.statusCode).toBe(200);
    expect(settingsLines(built).map(ownMembers)).toEqual([{ operatorId: seeded('SUPERVISOR').id, changedKeys: ['notifyWarnings'] }]);
    expect(built.engine.actions[0]?.args).toEqual([{ notifyWarnings: !DEFAULT_SETTINGS.notifyWarnings }]);
    expect(built.log.text()).not.toContain('w40-dark-value');
  });

  it.each([
    ['a text for a switch', { presentationMode: 'yes' }],
    ['a number for a switch', { notifySound: 1 }],
    ['null for a switch', { notifyWarnings: null }],
    ['a time format that does not exist', { timeFormat: '13' }],
    ['a number for the time format', { timeFormat: 12 }],
    ['one valid member beside one invalid', { notifySound: true, timeFormat: 'w40-bad-format' }],
  ] as const)('a wrong type or value (%s) is refused by the contract\'s schema: 422 INVALID_INPUT, no unit, no line, nothing changed', async (_name, body) => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    const before = state(built);
    const response = await post(built.app, SETTINGS, body);
    expect(outcome(response)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(response).details).toMatchObject({ in: 'body' });
    expect(validateCoreApiResponse('updateSettings', 422, response.json())).toEqual({ ok: true });
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(built.engine.units).toEqual([]);
    expect(state(built)).toBe(before);
    expect(settingsLines(built)).toEqual([]);
    expect(built.log.text()).not.toContain('w40-bad-format');
  });

  it.each(['[1]', '{"timeFormat": ', '"12"'])('a body that is no JSON object (%s): 400 INVALID_JSON, no unit, no line', async (payload) => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    const response = await post(built.app, SETTINGS, payload);
    expect(outcome(response)).toEqual([400, 'INVALID_JSON']);
    expect(validateCoreApiResponse('updateSettings', 400, response.json())).toEqual({ ok: true });
    expect(built.engine.units).toEqual([]);
    expect(settingsLines(built)).toEqual([]);
  });

  it('nobody without a session changes a setting: 401 before the body is read, no unit, no line', async () => {
    const built = await build();
    for (const caller of [ANONYMOUS, PAIRED_DEVICE]) {
      built.actAs(caller);
      for (const body of [{ timeFormat: '12' }, { timeFormat: 13 }, '[1]']) {
        const response = await post(built.app, SETTINGS, body);
        expect(outcome(response), caller.kind).toEqual([401, 'NOT_SIGNED_IN']);
        expect(validateCoreApiResponse('updateSettings', 401, response.json())).toEqual({ ok: true });
      }
    }
    expect(built.engine.units).toEqual([]);
    expect(settingsLines(built)).toEqual([]);
    expect(settingsOf(built)).toEqual(DEFAULT_SETTINGS);
  });

  it('a unit that is not committed: 503 NOT_READY, the settings as they were, NO line', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const before = state(built);
    built.engine.failNextCommit(new ApiFailure(503, 'NOT_READY', 'The server is not ready. Try again shortly.'));
    const response = await post(built.app, SETTINGS, { timeFormat: '12' });
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(built.engine.units).toEqual([{ label: SETTINGS_UNIT_LABEL, committed: false, actions: ['updateSettings'], pendingReads: 2 }]);
    expect(settingsOf(built)).toBe(before.settings);
    expect(settingsLines(built)).toEqual([]);
  });

  it('an engine that is not running: 503 NOT_READY, no unit, no line', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    built.engine.running = false;
    expect(outcome(await post(built.app, SETTINGS, { timeFormat: '12' }))).toEqual([503, 'NOT_READY']);
    expect(built.engine.units).toEqual([]);
    expect(settingsLines(built)).toEqual([]);
  });

  it('an engine that stops between the commit and the answer: 503 without a revision, the change is stored, and its line IS in the log', async () => {
    const built = await build();
    const caller = operatorOf('TECHNICIAN');
    built.actAs(caller);
    built.engine.stopAfterUnit = true;
    const response = await post(built.app, SETTINGS, { timeFormat: '12' });
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    expect(built.engine.units).toEqual([{ label: SETTINGS_UNIT_LABEL, committed: true, actions: ['updateSettings'], pendingReads: 2 }]);
    expect(settingsOf(built).timeFormat).toBe('12');
    expect(settingsLines(built).map(ownMembers)).toEqual([{ operatorId: caller.operatorId, changedKeys: ['timeFormat'] }]);
  });

  it('the module logs nothing else: over every call of this file\'s kinds, the only message of the module is the one of a change', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    await built.app.inject({ method: 'GET', url: SYSTEM_STATUS });
    await post(built.app, DIAGNOSTICS);
    await post(built.app, SERVICES_RESTART);
    await post(built.app, UPDATE);
    await post(built.app, SETTINGS, { timeFormat: '12' });
    await post(built.app, SETTINGS, { timeFormat: '12' });
    await post(built.app, SETTINGS, { timeFormat: 12 });
    expect(moduleLines(built).map((line) => line['msg'])).toEqual([SETTINGS_CHANGED_MESSAGE]);
    expect(built.log.lines().filter((line) => line['msg'] === 'request completed')).toHaveLength(7);
  });
});

describe('an unexpected failure', () => {
  it('answers 500 INTERNAL_ERROR with no detail on each of the five operations, and is in the log and in the persistent error log by its name; no line of a settings change is written', async () => {
    const errorLogFile = join(scratchDir, 'errors.log');
    const built = await build({ errorLogFile });
    built.actAs(operatorOf('TECHNICIAN'));
    const marker = 'MARK-w40-system';
    for (const [operationId, call] of [
      ['getSystemStatus', () => built.app.inject({ method: 'GET', url: SYSTEM_STATUS })],
      ['runDiagnostics', () => post(built.app, DIAGNOSTICS)],
      ['restartServices', () => post(built.app, SERVICES_RESTART)],
      ['startSoftwareUpdate', () => post(built.app, UPDATE)],
      ['updateSettings', () => post(built.app, SETTINGS, { timeFormat: '12' })],
    ] as const) {
      built.engine.failNext(Object.assign(new TypeError(`broken ${marker}`), { code: 'W40_TEST' }));
      const response = await call();
      expect([operationId, ...outcome(response)]).toEqual([operationId, 500, 'INTERNAL_ERROR']);
      expect(response.body).not.toContain(marker);
      expect(validateCoreApiResponse(operationId, 500, response.json())).toEqual({ ok: true });
      expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    }
    const lines = built.log.lines().filter((line) => line['msg'] === 'unexpected error while handling a request');
    expect(lines).toHaveLength(5);
    expect(lines.every((line) => line['level'] === 50)).toBe(true);
    expect(linesWith(built.log, SETTINGS_CHANGED_MESSAGE)).toEqual([]);
    expect(state(built).settings).toEqual(DEFAULT_SETTINGS);
    await built.app.close();
    const persisted = readFileSync(errorLogFile, 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(persisted).toHaveLength(5);
    expect(persisted.every((entry) => entry['level'] === 'error' && entry['errorName'] === 'TypeError')).toBe(true);
  });
});
