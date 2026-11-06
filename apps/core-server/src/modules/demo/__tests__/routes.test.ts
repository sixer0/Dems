// The routes of the demo-control module against the contract registry (plan row W43; module gate
// MODG; spec §7.16 operations 71 to 75, §7.2, §7.3, §7.17, §12.1). In-process, no database: the
// real app factory with every stage registered, a principal the test chooses behind stage 4, the
// REAL access rule (stage 6), a recording stand-in behind the seam `engine`, and a pool that
// answers the module's two reads.
//
// What is proven here: the route list is the registry's; with the demo flag off no handler runs;
// the read is the pure mapping of the committed state and one stored row; each fault is one
// hosted command with the caller's principal and one log line that names the operator; a reset
// reaches the routine with the caller as its actor, through the REAL wiring of hold, drain,
// engine and pool; every refusal has the documented answer. The same operations against
// PostgreSQL and the real engine: the `*.db.test.ts` files of this folder.
import { CORE_API_OPERATIONS, CoreApiAccessCondition, CoreApiAccessKind, CoreApiAuditNone, CoreApiTag, matchCoreApiOperation, validateCoreApiResponse } from '@dems/shared/api';
import { ScenarioName, SimNotFoundError } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hostedActionsOfOperation, simRefusal } from '../../../engine';
import { notReady } from '../../../plugins/error-envelope';
import { AccessRuleError, permissionGuard, routePatternOf } from '../../../plugins/permission-guard';
import { CLOCK_START, WEB_ORIGIN } from '../../../../test/support/identity';
import { DEMO_MODULE_OPERATIONS, RECOVERY, RESET_REASON_OF_OPERATION, demoControl, demoStatusOf, operationOf, type ResetHost, createDemoReset, createResetHost, type ResetCall } from '../index';
import {
  ANONYMOUS,
  CALLS,
  FAULTS,
  FAULTS_CLEAR,
  FIXED_NOW,
  RESET,
  ROLES,
  SCENARIO,
  STATUS,
  bodyOf,
  committedOf,
  errorOf,
  moduleRoutes,
  operationNumber,
  operatorOf,
  outcome,
  registryEntries,
  resetError,
  scenarioState,
  sharedGrants,
  signature,
  standInRoutine,
  unitApp,
  type UnitApp, recordingHost, recordingLogger,
} from './support';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

async function build(...parameters: Parameters<typeof unitApp>): Promise<UnitApp> {
  const built = await unitApp(...parameters);
  apps.push(built.app);
  return built;
}

const get = (built: UnitApp, url: string): Promise<LightMyRequestResponse> => built.app.inject({ method: 'GET', url });
/** A command as the web console sends it: its `Origin`, and a JSON body when there is one. */
const post = (built: UnitApp, url: string, payload?: object | string, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> =>
  built.app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...headers }, ...(payload === undefined ? {} : { payload }) });
const call = (built: UnitApp, entry: (typeof CALLS)[number]): Promise<LightMyRequestResponse> =>
  entry.method === 'GET' ? get(built, entry.url) : post(built, entry.url, entry.payload);

/**
 * The parts of a reset that need a database, replaced for a unit app: the routine, the boot
 * checks and the stored matrix. Hold, drain, the read of the operators, engine and pool stay the
 * server's own wiring.
 */
function resetParts(built: UnitApp, routine: ResetHost['routine'], overrides: Partial<ResetHost> = {}): void {
  demoControl(built.app).replace({
    routine,
    bootChecks: async () => {
      built.trace.push('boot.checks');
      // What B-1 does on the reopened pool: the database answers.
      built.app.readiness.set('database', true);
    },
    reloadMatrix: async () => {
      built.trace.push('rbac.matrix');
      return sharedGrants();
    },
    ...overrides,
  });
}

describe('MODG: the route list of the module equals its registry operations', () => {
  it('registers operations 71 to 75 with the method, the path and the operation ID of the registry, and nothing else under /api/v1/demo', async () => {
    const { registered } = await build({ demoControls: true });
    const fromRegistry = registryEntries().map((operation) => signature(operation.method, routePatternOf(operation.path), operation.operationId));
    const own = registered.filter((route) => route.url.startsWith('/api/v1/demo/'));
    const fromModule = own.map((route) => signature(String(route.method), route.url, String(route.config?.operationId)));

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'GET /api/v1/demo/status getDemoStatus',
      'POST /api/v1/demo/scenario loadScenario',
      'POST /api/v1/demo/faults injectFault',
      'POST /api/v1/demo/faults/clear clearFault',
      'POST /api/v1/demo/reset resetDemo',
    ]);
    expect(moduleRoutes(registered)).toEqual(own);
    console.info(`[w43] MODG routes of src/modules/demo:    ${fromModule.join(' | ')}`);
    console.info(`[w43] MODG registry, operations 71 to 75: ${fromRegistry.join(' | ')}`);
  });

  it('the area of the registry is these five operations, numbered 71 to 75', () => {
    const area = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.DEMO);
    expect(area.map((operation) => operation.operationId)).toEqual([...DEMO_MODULE_OPERATIONS]);
    expect(area.map(operationNumber)).toEqual([71, 72, 73, 74, 75]);
    for (const operationId of DEMO_MODULE_OPERATIONS) expect(operationOf(operationId).operationId).toBe(operationId);
    expect(CALLS.map((entry) => entry.operationId)).toEqual([...DEMO_MODULE_OPERATIONS]);
    for (const entry of CALLS) expect(matchCoreApiOperation(entry.method, entry.url)?.operation.operationId).toBe(entry.operationId);
  });

  it('each route is the registry\'s route, and the guard holds the registry\'s rule for it: DEMO_CONTROL and the demo flag', async () => {
    const { app, registered } = await build({ demoControls: false });
    const rules = permissionGuard(app).registeredRules();
    for (const route of moduleRoutes(registered)) {
      const operationId = String(route.config?.operationId);
      const rule = rules.find((candidate) => candidate.operationId === operationId);
      expect(rule, operationId).toMatchObject({ method: route.method, url: route.url, kind: CoreApiAccessKind.PERMISSION, permissions: ['DEMO_CONTROL'], conditions: [CoreApiAccessCondition.DEMO_FLAG] });
    }
    expect(moduleRoutes(registered)).toHaveLength(5);
  });

  it('the audit rule of the registry: the read writes nothing, the two resets SCENARIO_LOADED, the two faults their fault rows', () => {
    expect(registryEntries().map((operation) => [operation.operationId, operation.audit.success, operation.audit.denial])).toEqual([
      ['getDemoStatus', CoreApiAuditNone.READ, 'ACCESS_DENIED'],
      ['loadScenario', 'SCENARIO_LOADED', 'ACCESS_DENIED'],
      ['injectFault', 'FAULT_RAISED', 'ACCESS_DENIED'],
      ['clearFault', 'FAULT_CLEARED', 'ACCESS_DENIED'],
      ['resetDemo', 'SCENARIO_LOADED', 'ACCESS_DENIED'],
    ]);
  });

  it('no route carries a check of its own: no hook beside the stage hook of the server, no member of the route config but the operation', async () => {
    const { registered } = await build({ demoControls: true });
    for (const route of moduleRoutes(registered)) {
      expect(route.onRequest, route.url).toBeUndefined();
      expect(route.preParsing, route.url).toBeUndefined();
      expect(route.preValidation, route.url).toBeUndefined();
      expect(route.preHandler, route.url).toBeUndefined();
      expect(Object.keys(route.config ?? {}), route.url).toEqual(['operationId']);
    }
  });

  it('spec §7.17: the two faults are hosted actions, the read and the two resets are not', () => {
    expect(DEMO_MODULE_OPERATIONS.map((operationId) => [operationId, hostedActionsOfOperation(operationId)])).toEqual([
      ['getDemoStatus', []],
      ['loadScenario', []],
      ['injectFault', ['inject']],
      ['clearFault', ['clearFault']],
      ['resetDemo', []],
    ]);
    expect(RESET_REASON_OF_OPERATION).toEqual({ loadScenario: 'SCENARIO_LOAD', resetDemo: 'RESET' });
  });
});

describe('the demo flag is off (DC-2, SR-57, HC-2): no handler of the module runs', () => {
  it('a SUPERVISOR gets 403 DEMO_DISABLED on all five, before the body is read; no command, no statement, the routine is not asked', async () => {
    const built = await build({ demoControls: false });
    let asked = 0;
    resetParts(built, async () => {
      asked += 1;
      throw new Error('the routine must not be reached while the demo flag is off');
    });
    built.actAs(operatorOf('SUPERVISOR'));

    for (const entry of CALLS) {
      const response = await call(built, entry);
      expect(outcome(response), entry.operationId).toEqual([403, 'DEMO_DISABLED']);
      expect(validateCoreApiResponse(entry.operationId, 403, response.json()), entry.operationId).toEqual({ ok: true });
    }
    // A body the schema would refuse, and one that is no JSON at all: still 403, stage 6 is first.
    expect(outcome(await post(built, SCENARIO, { name: 'no-such-scenario' }))).toEqual([403, 'DEMO_DISABLED']);
    expect(outcome(await post(built, FAULTS, '{not json', { 'content-type': 'application/json' }))).toEqual([403, 'DEMO_DISABLED']);

    expect(asked).toBe(0);
    expect(built.engine.commands).toEqual([]);
    expect(built.engine.lifecycle).toEqual([]);
    expect(built.queries).toEqual([]);
    expect(built.pools).toEqual({ built: 1, ended: 0 });
    // DC-2: no audit row (nothing was sent to the pool), one log line per refused call.
    const refused = built.log.lines().filter((line) => line['code'] === 'DEMO_DISABLED' && line['msg'] === 'request refused by the access rule');
    expect(refused).toHaveLength(7);
    expect(refused.every((line) => line['audited'] === false && line['level'] === 40)).toBe(true);
  });

  it('nobody is signed in: 401 NOT_SIGNED_IN on all five, whatever the flag', async () => {
    for (const demoControls of [false, true]) {
      const built = await build({ demoControls });
      built.actAs(ANONYMOUS);
      for (const entry of CALLS) {
        const response = await call(built, entry);
        expect(outcome(response), `${entry.operationId} flag ${demoControls}`).toEqual([401, 'NOT_SIGNED_IN']);
        expect(validateCoreApiResponse(entry.operationId, 401, response.json())).toEqual({ ok: true });
      }
      expect(built.engine.commands).toEqual([]);
    }
  });

  it('the flag is configuration, read at start: the configuration object is frozen and no operation takes a flag', async () => {
    const built = await build({ demoControls: false });
    expect(Object.isFrozen(built.app.config)).toBe(true);
    expect(() => {
      (built.app.config as { demoControls: boolean }).demoControls = true;
    }).toThrow(TypeError);
    built.actAs(operatorOf('SUPERVISOR'));
    // A body that asks for the flag changes nothing: the call is refused before the body is read.
    expect(outcome(await post(built, RESET, { demoControls: true }))).toEqual([403, 'DEMO_DISABLED']);
    expect(built.app.config.demoControls).toBe(false);
  });
});

describe('operation 71 getDemoStatus', () => {
  it('answers the pure mapping of the committed state, the engine\'s epoch and the stored seed facts; one read, no command', async () => {
    const state = committedOf(scenarioState('idle'));
    const built = await build({ demoControls: true, state });
    built.actAs(operatorOf('SUPERVISOR'));

    const response = await get(built, STATUS);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(demoStatusOf(state, 7, { seededAt: FIXED_NOW, lastResetAt: null }));
    expect(response.json()).toEqual({ scenarios: ['idle', 'recording', 'finalizing', 'fault-demo'], scenario: 'idle', activeFaults: [], seededAt: FIXED_NOW, lastResetAt: null, epoch: 7 });
    expect(validateCoreApiResponse('getDemoStatus', 200, response.json())).toEqual({ ok: true });
    expect(built.queries).toEqual(['SELECT seeded_at::text AS seeded_at, last_reset_at::text AS last_reset_at FROM public.core_state']);
    expect(built.engine.commands).toEqual([]);
    // API-7 names the state position on a POST's 2xx; a read carries neither header.
    expect(response.headers['x-dems-revision']).toBeUndefined();
    expect(response.headers['x-dems-epoch']).toBeUndefined();
  });

  it('lists the active faults of the committed state, and the last reset once there was one', async () => {
    const state = committedOf(scenarioState('fault-demo'));
    const built = await build({ demoControls: true, state });
    built.actAs(operatorOf('SUPERVISOR'));
    built.script.seedFacts = { seeded_at: String(FIXED_NOW + 5_000), last_reset_at: String(FIXED_NOW + 5_000) };
    built.engine.epoch = 12;

    const body = (await get(built, STATUS)).json() as { activeFaults: Array<{ kind: string; since: number; target: string | null }>; scenario: string; lastResetAt: number | null; seededAt: number; epoch: number };
    expect(body.scenario).toBe('fault-demo');
    expect(body.activeFaults.length).toBeGreaterThan(0);
    expect(body.activeFaults).toEqual(state.faults.active.map((fault) => ({ kind: fault.kind, since: fault.since, target: fault.target })));
    expect(body).toMatchObject({ seededAt: FIXED_NOW + 5_000, lastResetAt: FIXED_NOW + 5_000, epoch: 12 });
    expect(validateCoreApiResponse('getDemoStatus', 200, body)).toEqual({ ok: true });
    expect(Object.values(ScenarioName)).toEqual(['idle', 'recording', 'finalizing', 'fault-demo']);
  });

  it('a read that fails is the database\'s failure: 503 NOT_READY, one error line by code, never the statement', async () => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    built.script.failWith = Object.assign(new Error('terminating connection: SELECT seeded_at FROM core_state'), { code: '57P01' });
    const response = await get(built, STATUS);
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(validateCoreApiResponse('getDemoStatus', 503, response.json())).toEqual({ ok: true });
    const line = built.log.lines().find((entry) => entry['source'] === 'demo.getDemoStatus');
    expect(line).toMatchObject({ level: 50, msg: 'a read on the pool failed', err: { code: '57P01' } });
    expect(built.log.text()).not.toContain('terminating connection');
  });

  it('an engine that is not running answers 503; a database without the state row is a defect: 500 without a detail', async () => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    built.engine.running = false;
    built.engine.notRunning = notReady();
    expect(outcome(await get(built, STATUS))).toEqual([503, 'NOT_READY']);

    built.engine.running = true;
    built.script.seedFacts = null;
    const response = await get(built, STATUS);
    expect(outcome(response)).toEqual([500, 'INTERNAL_ERROR']);
    expect(response.body).not.toContain('core_state');
  });
});

describe('operations 73 and 74: one hosted command with the caller\'s principal, one log line that names the operator', () => {
  it.each([
    ['injectFault', FAULTS, 'inject', 'demo fault injected'],
    ['clearFault', FAULTS_CLEAR, 'clearFault', 'demo fault cleared'],
  ] as const)('%s runs %s(kind, target) once and answers 204 with the state position', async (operationId, url, action, text) => {
    const built = await build({ demoControls: true });
    const principal = operatorOf('SUPERVISOR');
    built.actAs(principal);

    const targeted = await post(built, url, { kind: 'MIC_NO_SIGNAL', target: { channel: 'AUDIO-02' } });
    expect(targeted.statusCode).toBe(204);
    expect(targeted.body).toBe('');
    expect(validateCoreApiResponse(operationId, 204, bodyOf(targeted))).toEqual({ ok: true });
    expect(targeted.headers['x-dems-epoch']).toBe('7');
    expect(targeted.headers['x-dems-revision']).toBe('42');

    const untargeted = await post(built, url, { kind: 'STORAGE_FULL' });
    expect(untargeted.statusCode).toBe(204);
    expect(untargeted.headers['x-dems-revision']).toBe('43');

    expect(built.engine.commands).toEqual([
      { principal, action, args: ['MIC_NO_SIGNAL', { channel: 'AUDIO-02' }] },
      // No target in the body: none is invented. `clearFault` then clears every fault of the kind.
      { principal, action, args: ['STORAGE_FULL', undefined] },
    ]);
    // The principal of the request, as it is: not a copy, not a request field.
    expect(built.engine.commands.every((command) => command.principal === principal)).toBe(true);
    expect(built.queries).toEqual([]);

    // Decision D28 D-3: the simulator's row names no actor; this line does. Info level, plain fields.
    const lines = built.log.lines().filter((line) => line['msg'] === text);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ level: 30, operationId, operatorId: principal.operatorId, kind: 'MIC_NO_SIGNAL', target: { channel: 'AUDIO-02' }, epoch: 7, revision: 42 });
    expect(lines[1]).toMatchObject({ level: 30, operationId, operatorId: principal.operatorId, kind: 'STORAGE_FULL', target: null });
    expect(lines.every((line) => line['err'] === undefined && typeof line['reqId'] === 'string')).toBe(true);
  });

  it('every fault kind of the vocabulary and every member of a target pass the schema stage as they are', async () => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    const target = { channel: 'AUDIO-01', cameraId: 'VIDEO-02', auditIndex: 3, fallback: 'RTC', evidenceId: 'EV-20260930-0004', trackId: 'VIDEO-01' };
    const response = await post(built, FAULTS, { kind: 'AUDIT_TAMPER', target });
    expect(outcome(response)).toEqual([204, null]);
    expect(built.engine.commands[0]?.args).toEqual(['AUDIT_TAMPER', target]);
  });

  it('a refusal of the simulator leaves as the engine host answers it: 404 for an evidence target the Core does not have; no log line names an injection', async () => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    built.engine.refuseWith = simRefusal(new SimNotFoundError('evidence', 'EV-20991231-9999'));
    const response = await post(built, FAULTS, { kind: 'TAMPER', target: { evidenceId: 'EV-20991231-9999' } });
    expect(outcome(response)).toEqual([404, 'NOT_FOUND']);
    expect(errorOf(response).details).toMatchObject({ simCode: 'NOT_FOUND' });
    expect(validateCoreApiResponse('injectFault', 404, response.json())).toEqual({ ok: true });
    expect(response.headers['x-dems-revision']).toBeUndefined();
    expect(built.log.lines().filter((line) => line['msg'] === 'demo fault injected')).toEqual([]);
  });

  it('an engine that is not running answers 503 NOT_READY on both', async () => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    built.engine.running = false;
    built.engine.notRunning = notReady();
    for (const [operationId, url] of [
      ['injectFault', FAULTS],
      ['clearFault', FAULTS_CLEAR],
    ] as const) {
      const response = await post(built, url, { kind: 'FAN_STALL' });
      expect(outcome(response), url).toEqual([503, 'NOT_READY']);
      expect(validateCoreApiResponse(operationId, 503, response.json()), url).toEqual({ ok: true });
    }
  });

  it.each([
    ['an unknown kind', { kind: 'NOT_A_FAULT' }, 422, 'INVALID_INPUT'],
    ['no kind', { target: { channel: 'AUDIO-01' } }, 422, 'INVALID_INPUT'],
    // D61 (2026-11-04): AUDIO-03 joined the four sealed audio tracks; only a fifth channel is outside the set.
    ['a target member outside its value set', { kind: 'MIC_CLIP', target: { channel: 'AUDIO-05' } }, 422, 'INVALID_INPUT'],
    ['a negative audit index', { kind: 'AUDIT_TAMPER', target: { auditIndex: -1 } }, 422, 'INVALID_INPUT'],
    ['an evidence ID that is not one', { kind: 'TAMPER', target: { evidenceId: '../etc' } }, 422, 'INVALID_INPUT'],
    // Wave H closing pass Z1, item 5 (ruling D206 (3); gate findings G70-09 / G75-14): the body is STRICT.
    // A member the contract does not name is refused, never silently ignored (the gate's top-level
    // `cameraId` raised the fault on the DEFAULT camera instead of the one that was meant).
    ['a top-level cameraId instead of target.cameraId', { kind: 'CAMERA_LOSS', cameraId: 'VIDEO-02' }, 422, 'INVALID_INPUT'],
    ['an unknown member beside a right target', { kind: 'CAMERA_LOSS', target: { cameraId: 'VIDEO-02' }, note: 'x' }, 422, 'INVALID_INPUT'],
    ['an unknown member inside the target', { kind: 'CAMERA_LOSS', target: { camera: 'VIDEO-02' } }, 422, 'INVALID_INPUT'],
    ['a body that is no JSON', '{"kind":', 400, 'INVALID_JSON'],
  ] as const)('%s is refused by the schema stage on both operations, before the engine: %i %s', async (_label, payload, status, code) => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    for (const [operationId, url] of [
      ['injectFault', FAULTS],
      ['clearFault', FAULTS_CLEAR],
    ] as const) {
      const response = await post(built, url, payload, typeof payload === 'string' ? { 'content-type': 'application/json' } : {});
      expect(outcome(response), url).toEqual([status, code]);
      expect(validateCoreApiResponse(operationId, status, response.json()), url).toEqual({ ok: true });
    }
    expect(built.engine.commands).toEqual([]);
  });
});

describe('operations 72 and 75: the reset routine, through the server\'s own wiring', () => {
  it('resetDemo: the caller is the actor, the scenario is idle; hold, drain, roles, engine stop, pool close, the routine, pool reopen, boot checks, matrix, engine reload; 200 with the routine\'s epoch', async () => {
    const built = await build({ demoControls: true });
    const principal = operatorOf('SUPERVISOR');
    built.actAs(principal);
    const ready: string[] = [];
    const routine = standInRoutine(built.trace, { report: { previousEpoch: 7, epoch: 8, cancelledPairingCodes: 0 } });
    const calls: Array<Parameters<ResetHost['routine']>[0]> = [];
    resetParts(built, async (options) => {
      calls.push(options);
      ready.push(`before ${built.app.readiness.isReady()}`);
      const report = await routine({
        ...options,
        quiesce: async () => {
          await options.quiesce?.();
          ready.push(`quiesced ${built.app.readiness.isReady()}`);
          // Every other request answers 503 while the routine works; health still answers.
          expect(outcome(await get(built, STATUS))).toEqual([503, 'NOT_READY']);
          expect((await get(built, '/api/v1/health')).statusCode).toBe(200);
        },
      });
      // What the routine wrote is what the engine reloads with.
      built.engine.epoch = report.epoch;
      return report;
    });

    const response = await post(built, RESET);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ epoch: 8 });
    expect(validateCoreApiResponse('resetDemo', 200, response.json())).toEqual({ ok: true });
    // API-7: the new epoch at its first revision.
    expect(response.headers['x-dems-epoch']).toBe('8');
    expect(response.headers['x-dems-revision']).toBe('0');

    expect(built.trace).toEqual([
      'routine:R-0',
      'routine:R-1',
      'drain',
      'roles',
      'engine.stop',
      'pool.close',
      `routine:clock ${calls[0]?.clock?.()}`,
      'routine:R-2..R-8',
      'routine:R-9',
      'pool.reopen',
      'boot.checks',
      'rbac.matrix',
      'engine.reload',
      'roles',
    ]);
    expect(ready).toEqual(['before true', 'quiesced false']);
    expect(built.app.readiness.isReady()).toBe(true);
    expect(built.pools).toEqual({ built: 2, ended: 1 });
    // A reset that happened: `reload()`, which takes the routine's epoch as it is. No resync.
    expect(built.engine.lifecycle).toEqual(['engine.stop', 'engine.reload']);
    expect(built.engine.epoch).toBe(8);
    expect(built.log.lines().filter((line) => line['code'] === 'DEMO_RESET_NEW_EPOCH')).toEqual([]);
    expect(demoControl(built.app).resetInFlight).toBe(false);

    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0] ?? {}).sort()).toEqual(['actorId', 'clock', 'dataDir', 'database', 'evidenceStoreDir', 'log', 'quiesce', 'reason', 'scenario']);
    // Decision D165: the root the routine's guard reads is the media root of THIS app's configuration.
    expect(calls[0]?.evidenceStoreDir).toBe(built.app.config.mediaStoreDir);
    // The clock the routine reads is the server clock of the app (here: a manual one), not the system's.
    expect(calls[0]?.clock?.()).toBe(CLOCK_START);
    expect(built.trace).toContain(`routine:clock ${CLOCK_START}`);
    expect(calls[0]).toMatchObject({ database: 'dems_unit_test', dataDir: '/nonexistent/dems-unit-test-data', actorId: principal.operatorId, reason: 'RESET', scenario: 'idle' });
    // The two readiness lines of the hold, and the module's own two lines with the operator.
    const lines = built.log.lines();
    expect(lines.filter((line) => line['msg'] === 'readiness hold').map((line) => [line['hold'], line['held']])).toEqual([
      ['demo-reset', true],
      ['demo-reset', false],
    ]);
    expect(lines.find((line) => line['msg'] === 'demo reset requested')).toMatchObject({ level: 30, operation: 'resetDemo', operatorId: principal.operatorId, scenario: 'idle' });
    expect(lines.find((line) => line['msg'] === 'demo reset done')).toMatchObject({ level: 30, operatorId: principal.operatorId, previousEpoch: 7, epoch: 8 });
  });

  it.each(Object.values(ScenarioName))('loadScenario with %s: that scenario, the reason SCENARIO_LOAD, 200 with the epoch', async (name) => {
    const built = await build({ demoControls: true });
    const principal = operatorOf('SUPERVISOR');
    built.actAs(principal);
    const calls: Array<Parameters<ResetHost['routine']>[0]> = [];
    const routine = standInRoutine(built.trace, { report: { previousEpoch: 7, epoch: 8 } });
    resetParts(built, (options) => {
      calls.push(options);
      built.engine.epoch = 8;
      return routine(options);
    });

    const response = await post(built, SCENARIO, { name });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ epoch: 8 });
    expect(validateCoreApiResponse('loadScenario', 200, response.json())).toEqual({ ok: true });
    expect(response.headers['x-dems-epoch']).toBe('8');
    expect(calls).toMatchObject([{ scenario: name, reason: 'SCENARIO_LOAD', actorId: principal.operatorId }]);
  });

  it.each([
    ['an unknown scenario', { name: 'night-shift' }, 422, 'INVALID_INPUT'],
    ['no name', {}, 422, 'INVALID_INPUT'],
    ['a body that is no JSON', '{"name":', 400, 'INVALID_JSON'],
  ] as const)('loadScenario with %s is refused before the routine is asked: %i %s', async (_label, payload, status, code) => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    let asked = 0;
    resetParts(built, async () => {
      asked += 1;
      throw new Error('not reached');
    });
    const response = await post(built, SCENARIO, payload, typeof payload === 'string' ? { 'content-type': 'application/json' } : {});
    expect(outcome(response)).toEqual([status, code]);
    expect(validateCoreApiResponse('loadScenario', status, response.json())).toEqual({ ok: true });
    expect(asked).toBe(0);
    expect(built.trace).toEqual([]);
  });

  it('the routine refuses at R-0 (another reset holds the database): 503 with RESET_IN_PROGRESS, nothing of the server was stopped', async () => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    resetParts(built, standInRoutine(built.trace, { refuse: resetError('RESET_ALREADY_RUNNING', 'R-0') }));

    const response = await post(built, RESET);
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(errorOf(response).details).toEqual({ reason: 'RESET_IN_PROGRESS' });
    expect(validateCoreApiResponse('resetDemo', 503, response.json())).toEqual({ ok: true });
    expect(response.headers['x-dems-epoch']).toBeUndefined();
    expect(built.trace).toEqual(['routine:R-0']);
    expect(built.pools).toEqual({ built: 1, ended: 0 });
    expect(built.engine.lifecycle).toEqual([]);
    // Nothing was stopped: the epoch and the revision are what they were.
    expect([built.engine.epoch, built.engine.revision]).toEqual([7, 41]);
    expect(built.app.readiness.isReady()).toBe(true);
    expect(built.log.lines().filter((line) => line['msg'] === 'readiness hold')).toEqual([]);
    // The next command is served.
    expect(outcome(await post(built, FAULTS, { kind: 'FAN_STALL' }))).toEqual([204, null]);
  });

  it('the routine fails after the quiesce: the pool is reopened, the engine RESYNCHRONISED under a new epoch (decision D101), the hold released; 503 with RESET_FAILED, and the next command is served', async () => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    resetParts(built, standInRoutine(built.trace, { fail: resetError('RESET_BUILD_FAILED', 'R-5') }));

    const response = await post(built, SCENARIO, { name: 'recording' });
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(errorOf(response).details).toEqual({ reason: 'RESET_FAILED' });
    expect(validateCoreApiResponse('loadScenario', 503, response.json())).toEqual({ ok: true });
    expect(built.trace.slice(2)).toEqual(['drain', 'roles', 'engine.stop', 'pool.close', expect.stringMatching(/^routine:clock /), 'routine:R-2..R-8', 'pool.reopen', 'boot.checks', 'rbac.matrix', 'engine.resync', 'roles']);
    // `app.engine.start('resync')`, never `reload()` and never a process start.
    expect(built.engine.lifecycle).toEqual(['engine.stop', 'engine.resync']);
    expect(built.pools).toEqual({ built: 2, ended: 1 });
    expect(built.app.readiness.isReady()).toBe(true);
    // 7 before: nothing was reset, and the epoch is 8, so no client is shown epoch 7 at revision 0.
    expect(built.engine.epoch).toBe(8);
    expect(built.engine.revision).toBe(0);
    const command = await post(built, FAULTS, { kind: 'FAN_STALL' });
    expect(outcome(command)).toEqual([204, null]);
    expect(command.headers['x-dems-epoch']).toBe('8');
    // One line says that the epoch moved although no reset was completed.
    expect(built.log.lines().find((line) => line['code'] === 'DEMO_RESET_NEW_EPOCH')).toMatchObject({ level: 30, operatorId: 'OPR-002', epochBefore: 7, epoch: 8, routineCode: 'RESET_BUILD_FAILED', targetUntouched: true });
    // The routine's code and step are in the log, not in the answer.
    expect(response.body).not.toContain('RESET_BUILD_FAILED');
    expect(built.log.lines().find((line) => line['routineCode'] === 'RESET_BUILD_FAILED')).toMatchObject({ level: 50, routineStep: 'R-5', targetUntouched: true, err: { code: 'RESET_BUILD_FAILED' } });
  });

  it.each(['STORED_GRANTS_MISMATCH', 'STORED_MATRIX_MISMATCH'] as const)(
    'decision D95: the stored matrix of the rebuilt database is refused (%s): the server does not go back to serving; 503 on every request, health still answers',
    async (code) => {
      const built = await build({ demoControls: true });
      built.actAs(operatorOf('SUPERVISOR'));
      const mismatch = new AccessRuleError([{ code, operationId: null, route: null, detail: 'extra grant: TECHNICIAN DEMO_CONTROL' }]);
      const persisted = vi.spyOn(built.app.errorLog, 'append');
      resetParts(built, standInRoutine(built.trace, { report: { previousEpoch: 7, epoch: 8 } }), {
        reloadMatrix: async () => {
          built.trace.push('rbac.matrix');
          throw mismatch;
        },
      });

      const response = await post(built, RESET);
      expect(outcome(response)).toEqual([503, 'NOT_READY']);
      expect(errorOf(response).details).toEqual({ reason: 'RESET_FAILED' });
      expect(validateCoreApiResponse('resetDemo', 503, response.json())).toEqual({ ok: true });
      expect(response.body).not.toContain('grant');
      expect(response.body).not.toContain(code);

      // The resume stopped at the matrix: the engine was not reloaded and the hold was not released.
      expect(built.trace.slice(-3)).toEqual(['pool.reopen', 'boot.checks', 'rbac.matrix']);
      expect(built.engine.lifecycle).toEqual(['engine.stop']);
      const holds = built.log.lines().filter((line) => line['msg'] === 'readiness hold');
      expect(holds.map((line) => line['held'])).toEqual([true]);

      // Even with both readiness flags set, nothing but health is served: the hold decides.
      built.app.readiness.set('database', true);
      built.app.readiness.set('engine', true);
      built.engine.running = true;
      expect(built.app.readiness.snapshot()).toEqual({ database: true, engine: true });
      expect(built.app.readiness.isReady()).toBe(false);
      for (const entry of CALLS) expect(outcome(await call(built, entry)), entry.operationId).toEqual([503, 'NOT_READY']);
      expect((await get(built, '/api/v1/health')).statusCode).toBe(200);
      expect(built.engine.commands).toEqual([]);

      // One error line: the step, the code as a plain field, the state of the server, the recovery.
      const line = built.log.lines().find((entry) => typeof entry['msg'] === 'string' && entry['msg'].startsWith('the server could not resume after a demo reset'));
      expect(line).toMatchObject({ level: 50, step: 'rbac.matrix', code, serving: false, recovery: RECOVERY, operatorId: 'OPR-002', err: { type: 'AccessRuleError', code } });
      expect(RECOVERY).toBe('restart the server: a start runs the boot checks');
      // The guard's own text, which names the grant, is not in the log: the error went under `err`.
      expect(built.log.text()).not.toContain('extra grant');
      // And one fatal entry in the persistent error log of the app, with the request as its correlation.
      const entries = persisted.mock.calls.map(([entry]) => entry).filter((entry) => entry.source === 'demo.reset');
      expect(entries).toMatchObject([{ level: 'fatal', code, errorName: 'AccessRuleError', context: { step: 'rbac.matrix', serving: false, recovery: RECOVERY, operatorId: 'OPR-002', routine: 'done' } }]);
      expect(typeof entries[0]?.context?.['requestId']).toBe('string');
      expect(JSON.stringify(entries)).not.toContain('extra grant');
    },
  );

  it('two resets at once in one server: one runs, the other is answered 503 with RESET_IN_PROGRESS and asks the routine nothing', async () => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('SUPERVISOR'));
    let asked = 0;
    let letGo: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      letGo = resolve;
    });
    const routine = standInRoutine(built.trace, { report: { previousEpoch: 7, epoch: 8 }, beforeQuiesce: () => paused });
    resetParts(built, (options) => {
      asked += 1;
      return routine(options);
    });

    const first = post(built, RESET);
    // The first is inside the routine's R-0: nothing is held yet, so the second reaches its handler.
    await new Promise((resolve) => setImmediate(resolve));
    while (!demoControl(built.app).resetInFlight) await new Promise((resolve) => setImmediate(resolve));
    const second = await post(built, SCENARIO, { name: 'recording' });
    expect(outcome(second)).toEqual([503, 'NOT_READY']);
    expect(errorOf(second).details).toEqual({ reason: 'RESET_IN_PROGRESS' });
    expect(asked).toBe(1);
    expect(built.trace).toEqual(['routine:R-0']);

    built.engine.epoch = 8;
    letGo();
    const done = await first;
    expect(done.statusCode).toBe(200);
    expect(done.json()).toEqual({ epoch: 8 });
    expect(built.pools).toEqual({ built: 2, ended: 1 });
    expect(built.engine.lifecycle).toEqual(['engine.stop', 'engine.reload']);
  });
});

describe('M3: who may call is stage 6, only', () => {
  it.each(ROLES)('with the flag on, a %s reaches a handler exactly when the role holds DEMO_CONTROL', async (role) => {
    const built = await build({ demoControls: true });
    const principal = operatorOf(role);
    built.actAs(principal);
    const response = await post(built, FAULTS, { kind: 'FAN_STALL' });
    if (principal.permissions.includes('DEMO_CONTROL')) {
      expect(role).toBe('SUPERVISOR');
      expect(response.statusCode).toBe(204);
      expect(built.engine.commands).toHaveLength(1);
    } else {
      // The denial row needs the database; here the guard's own unit cannot be written, and the
      // call is refused all the same (the audited 403 is in `gate.db.test.ts`).
      expect([403, 503]).toContain(response.statusCode);
      expect(built.engine.commands).toEqual([]);
    }
  });

  it('a holder of DEMO_CONTROL of any role is let through: the module reads no role', async () => {
    const built = await build({ demoControls: true });
    built.actAs(operatorOf('TECHNICIAN', ['DEMO_CONTROL']));
    expect((await post(built, FAULTS_CLEAR, { kind: 'FAN_STALL' })).statusCode).toBe(204);
    expect((await get(built, STATUS)).statusCode).toBe(200);
  });

  it('without stage 6 (a defect of the server) no handler acts for a caller that is no operator: 500 or 401, the routine is not asked', async () => {
    const built = await build({ demoControls: true, withoutAccessRule: true });
    built.actAs(ANONYMOUS);
    let asked = 0;
    resetParts(built, async () => {
      asked += 1;
      throw new Error('not reached');
    });
    expect(outcome(await post(built, RESET))).toEqual([500, 'INTERNAL_ERROR']);
    expect(outcome(await post(built, SCENARIO, { name: 'idle' }))).toEqual([500, 'INTERNAL_ERROR']);
    expect(asked).toBe(0);
    expect(built.trace).toEqual([]);
  });
});

describe('D216 (2): the refused reset names the sending device (wave K, reconcile pass)', () => {
  // Fix wave K, reconcile pass (S2's leftover; decision D216 (2)): the `ACCESS_DENIED` row of a REFUSED
  // reset names the paired device that sent the request. Operations 73 / 75 are open to a device
  // session that holds DEMO_CONTROL (the access rule asks the permission and the demo flag, not the
  // kind of session), so the sender can be a device. A web console session sends none: the row says
  // null, as before. The lineage row of a reset that RAN has no device column (schema 6): unchanged.

  const call = (overrides: Partial<ResetCall>): ResetCall => ({ operation: 'resetDemo', scenario: 'idle', actorId: 'OPR-002', requestId: 'req-kr-1', log: recordingLogger().log, ...overrides });

  describe('the refused reset names the sending device (D216 (2))', () => {
    it('a paired device sent it: the refusal handed to the host carries the device; a web console session carries none (control)', async () => {
      const fromDevice = recordingHost();
      fromDevice.realSessions = ['SES-20261001-0001'];
      await expect(createDemoReset(fromDevice.host).run(call({ deviceId: 'DEV-0002' }))).rejects.toMatchObject({ statusCode: 409, code: 'RESET_BLOCKED_REAL_EVIDENCE' });
      expect(fromDevice.refusals).toEqual([{ operation: 'resetDemo', actorId: 'OPR-002', deviceId: 'DEV-0002', reason: 'RESET_BLOCKED_REAL_EVIDENCE' }]);

      for (const web of [{}, { deviceId: null }]) {
        const fromWeb = recordingHost();
        fromWeb.realSessions = ['SES-20261001-0001'];
        await expect(createDemoReset(fromWeb.host).run(call(web))).rejects.toMatchObject({ statusCode: 409 });
        expect(fromWeb.refusals).toEqual([{ operation: 'resetDemo', actorId: 'OPR-002', reason: 'RESET_BLOCKED_REAL_EVIDENCE' }]);
      }
    });

    it('the row the host writes: `deviceId` is the sender, null without one - never a constant', async () => {
      const rows: Record<string, unknown>[] = [];
      const app = { pipeline: { run: async (_label: string, work: (unit: unknown) => Promise<void>) => work({ audit: { append: async (row: Record<string, unknown>) => void rows.push(row) } }) } } as unknown as FastifyInstance;
      const host = createResetHost(app, () => {
        throw new Error('no routine is asked for by a refusal');
      });
      await host.auditRefusal({ operation: 'resetDemo', actorId: 'OPR-002', deviceId: 'DEV-0002', reason: 'RESET_BLOCKED_REAL_EVIDENCE' });
      await host.auditRefusal({ operation: 'loadScenario', actorId: 'OPR-002', reason: 'RESET_BLOCKED_REAL_EVIDENCE' });
      expect(rows.map((row) => [row['type'], row['actorId'], row['deviceId'], row['details']])).toEqual([
        ['ACCESS_DENIED', 'OPR-002', 'DEV-0002', { operationId: 'resetDemo', reason: 'RESET_BLOCKED_REAL_EVIDENCE' }],
        ['ACCESS_DENIED', 'OPR-002', null, { operationId: 'loadScenario', reason: 'RESET_BLOCKED_REAL_EVIDENCE' }],
      ]);
    });
  });
});
