// What the REAL server registers, and that the guard stands in front of every one of those
// routes (plan row W28; spec §4.6 RB-1, RB-4; SR-43, SR-44; decision D85).
//
// This is the one file of the row that builds the app WITH every module as it is in the tree,
// so it runs against whatever the module rows have landed. It therefore names no operation of a
// module and no count: everything is derived from `permissionGuard(app).registeredRules()`, and
// it goes on passing when the next module lands. It also registers no route of its own (rule
// M10: no stand-in beside a module's route).
//
// It asks only what does not depend on a route's handler:
//   - a refusal of stage 6 (its status, its code, its row), which is decided before the handler;
//   - whether stage 6 let a request through, for a POST with a body that is no JSON: stage 7
//     answers 400 `INVALID_JSON` for it on every route, and no handler of any module runs.
// A permitted GET would run a module's own read, so the allowed side of a GET is not asked here;
// the role-by-endpoint matrix over every route with real data is the test row W47's.
//
// No database: the pool is the core's stand-in, which commits what a unit of work appends; stage
// 4 is a stand-in that makes the caller whoever the test says.
import { CORE_API_OPERATIONS, CoreApiAccessCondition, CoreApiAccessKind } from '@dems/shared/api';
import { OperatorRole, ROLE_PERMISSIONS, createManualClock, type Permission } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { CLOCK_START, standInDatabase, type StandInDatabase } from '../../../../test/support/core';
import { ANONYMOUS_PRINCIPAL, type Principal } from '../../authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { throttleControl } from '../../throttle';
import { CAMERA_PREVIEW_ROUTE_URL, CAMERA_PREVIEW_SESSION_OPERATION, CAMERA_PREVIEW_STREAM_ID, EVIDENCE_EXPORT_DOWNLOAD_ID, EVIDENCE_EXPORT_DOWNLOAD_URL, EVIDENCE_EXPORT_JOB_OPERATION, EVIDENCE_MEDIA_ROUTE_URL, EVIDENCE_MEDIA_SESSION_OPERATION, EVIDENCE_MEDIA_STREAM_ID, REALTIME_CHANNEL_ID, REALTIME_CHANNEL_RULE, permissionGuard, routePatternOf, routesOfPrintedTable, type AccessRule } from '../index';
import { MALFORMED_JSON, recordPassed, type PassedRequest } from '../../../../test/support/guard';

let app: FastifyInstance;
let log: CapturedLog;
let database: StandInDatabase;
let passed: PassedRequest[];
let current: Principal = ANONYMOUS_PRINCIPAL;
/** The rules of the routes the server registered, without the socket route. */
let operations: AccessRule[];

const ROLES = Object.values(OperatorRole);
/** Whether the role holds one of the permissions a rule names, by the shared table. */
const holdsOne = (role: OperatorRole, rule: AccessRule): boolean => {
  const held: readonly Permission[] = ROLE_PERMISSIONS[role];
  return rule.permissions.some((permission) => held.includes(permission));
};
const OPERATOR_OF: Record<OperatorRole, string> = { INVESTIGATOR: 'OPR-001', SUPERVISOR: 'OPR-002', TECHNICIAN: 'OPR-003' };
const operator = (role: OperatorRole): Principal => ({
  kind: 'OPERATOR',
  operatorId: OPERATOR_OF[role],
  sessionId: `session-${role}`,
  deviceId: null,
  role,
  permissions: ROLE_PERMISSIONS[role],
});

/** The operations this row's own tests call on the real units: health (W08), the identity core (W24), this row's module. */
const NEEDED_HERE = ['getServiceHealth', 'signIn', 'getSignInStatus', 'getAuthSession', 'signOut', 'touchSession', 'getRoleMatrix'];

beforeAll(async () => {
  log = captureLog();
  database = standInDatabase();
  app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => database.pool, logStream: log.stream });
  passed = recordPassed(app);
  // Stage 4 as a stand-in: the caller is who the test says. Stages 3, 5 and 6 are the real ones.
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.seams.replace('clock', createManualClock(CLOCK_START));
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  operations = permissionGuard(app)
    .registeredRules()
    .filter((rule) => rule.operationId !== REALTIME_CHANNEL_ID);
});

afterAll(() => app.close());

beforeEach(() => {
  current = ANONYMOUS_PRINCIPAL;
  throttleControl(app).reset();
});

/** One request to the route of a rule, as `who`. A path parameter gets a value of no form at all. */
async function call(rule: AccessRule, who: Principal, malformedBody = false): Promise<LightMyRequestResponse> {
  current = who;
  // Fresh windows for every call: this file asks what stage 6 decides, not what stage 5 counts.
  throttleControl(app).reset();
  return app.inject({ method: rule.method, url: rule.url.replace(':id', 'X-1'), ...(malformedBody ? MALFORMED_JSON : {}) });
}

const outcomeOf = (response: LightMyRequestResponse): [number, string | undefined] => [
  response.statusCode,
  (response.json() as { error?: { code?: string } }).error?.code,
];

describe('the routes the server registers, whichever modules have landed', () => {
  it('every one is a registry operation at its registry route, with the rule of its registry entry, and none is there twice', () => {
    const guard = permissionGuard(app);
    expect(guard.routeProblems()).toEqual([]);
    const registered = guard.registeredRules();
    const ids = registered.map((rule) => rule.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    const contract = CORE_API_OPERATIONS.map((operation) => operation.operationId);
    for (const rule of registered) {
      if (rule.operationId === REALTIME_CHANNEL_ID) {
        // The one route outside the registry, once the realtime channel has registered it.
        expect(rule).toBe(REALTIME_CHANNEL_RULE);
        continue;
      }
      if (rule.operationId === EVIDENCE_MEDIA_STREAM_ID) {
        // Row 90, ruling D140: the evidence media route, the second route outside the registry. Its
        // rule is the rule of operation 88 at its own method and path - and the walks below ask it
        // of this route like of every other (401 for nobody, 403 with one row without the permission).
        const session = guard.rules.ruleOf(EVIDENCE_MEDIA_SESSION_OPERATION);
        expect(rule).toBe(guard.rules.ruleAt('GET', EVIDENCE_MEDIA_ROUTE_URL));
        expect(rule).toEqual({ ...session, operationId: EVIDENCE_MEDIA_STREAM_ID, method: 'GET', url: EVIDENCE_MEDIA_ROUTE_URL, idPattern: null });
        expect(rule.denial).not.toBeNull();
        continue;
      }
      if (rule.operationId === CAMERA_PREVIEW_STREAM_ID) {
        // Decisions D51, D53: the live camera preview route, the fourth route outside the registry. Its rule
        // is the rule of operation 112 at its own method and path.
        const session = guard.rules.ruleOf(CAMERA_PREVIEW_SESSION_OPERATION);
        expect(rule).toBe(guard.rules.ruleAt('GET', CAMERA_PREVIEW_ROUTE_URL));
        expect(rule).toEqual({ ...session, operationId: CAMERA_PREVIEW_STREAM_ID, method: 'GET', url: CAMERA_PREVIEW_ROUTE_URL, idPattern: null });
        expect(rule.denial).not.toBeNull();
        continue;
      }
      if (rule.operationId === EVIDENCE_EXPORT_DOWNLOAD_ID) {
        // Fix pass F-M8, ruling D178: the export download route, the third route outside the
        // registry. Its rule is the rule of operation 87 at its own method and path.
        const job = guard.rules.ruleOf(EVIDENCE_EXPORT_JOB_OPERATION);
        expect(rule).toBe(guard.rules.ruleAt('GET', EVIDENCE_EXPORT_DOWNLOAD_URL));
        expect(rule).toEqual({ ...job, operationId: EVIDENCE_EXPORT_DOWNLOAD_ID, method: 'GET', url: EVIDENCE_EXPORT_DOWNLOAD_URL, idPattern: null });
        expect(rule.denial).not.toBeNull();
        continue;
      }
      expect(contract).toContain(rule.operationId);
      expect(guard.rules.ruleOf(rule.operationId)).toBe(rule);
      const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === rule.operationId);
      expect([rule.operationId, rule.method, rule.url]).toEqual([rule.operationId, operation?.method.toUpperCase(), routePatternOf(operation?.path ?? '')]);
      expect([rule.operationId, rule.kind]).toEqual([rule.operationId, operation?.access.kind]);
    }
    // What this row's own tests call is among them. Nothing else is named, and nothing is counted.
    for (const operationId of NEEDED_HERE) expect(ids).toContain(operationId);
    // The registry, and the three routes outside it: the realtime channel, the evidence media route, the export download route (fix F-M8).
    expect(ids.length).toBeLessThanOrEqual(contract.length + 3);
  });

  it('the walk of the router finds exactly the routes the boot check was shown, and passes', () => {
    const printed = routesOfPrintedTable(app.printRoutes()).map((route) => `${route.method} ${route.url}`).sort();
    const shown = permissionGuard(app).registeredRules().map((rule) => `${rule.method} ${rule.url}`).sort();
    expect(printed).toEqual(shown);
    expect(() => permissionGuard(app).checkRouter()).not.toThrow();
  });
});

describe('stage 6 stands in front of every registered route (decided before the handler)', () => {
  it('nobody: every operation that needs a principal answers 401 NOT_SIGNED_IN, with no row; a PUBLIC one is not refused for the principal', async () => {
    const before = database.committed.auditSeqs.length;
    const wrong: string[] = [];
    let asked = 0;
    for (const rule of operations) {
      if (rule.kind === CoreApiAccessKind.PUBLIC) continue;
      asked += 1;
      passed.length = 0;
      const [status, code] = outcomeOf(await call(rule, ANONYMOUS_PRINCIPAL, rule.method === 'POST'));
      if (status !== 401 || code !== 'NOT_SIGNED_IN' || passed.length !== 0) wrong.push(`${rule.operationId}: ${status} ${code}, passed ${passed.length}`);
    }
    expect(wrong).toEqual([]);
    expect(asked).toBeGreaterThan(0);
    expect(database.committed.auditSeqs.length).toBe(before);
  });

  it('a role without the permission: every operation that names one answers 403 with the three details and writes exactly one row; the handler is not reached', async () => {
    const wrong: string[] = [];
    let denied = 0;
    for (const rule of operations) {
      if (rule.denial === null) continue;
      for (const role of ROLES) {
        if (holdsOne(role, rule)) continue;
        denied += 1;
        const rows = database.committed.auditSeqs.length;
        passed.length = 0;
        const response = await call(rule, operator(role), rule.method === 'POST');
        const error = (response.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error;
        const written = database.committed.auditSeqs.length - rows;
        const expected = { operationId: rule.operationId, permission: rule.denial.permission, role };
        if (response.statusCode !== 403 || error?.code !== rule.denial.errorCode || written !== 1 || passed.length !== 0 || JSON.stringify(error.details) !== JSON.stringify(expected)) {
          wrong.push(`${rule.operationId} as ${role}: ${response.statusCode} ${error?.code}, rows ${written}, passed ${passed.length}`);
        }
      }
    }
    expect(wrong).toEqual([]);
    // Every refusal was logged by the stage itself, with its operation.
    const lines = log.lines().filter((line) => line['msg'] === 'request refused by the access rule' && line['audited'] === true);
    expect(lines.length).toBeGreaterThanOrEqual(denied);
  });

  it('a role with the permission passes stage 6 on every command that names one: a body that is no JSON answers 400 from stage 7, not 403, and no row is written', async () => {
    const wrong: string[] = [];
    for (const rule of operations) {
      if (rule.denial === null || rule.method !== 'POST') continue;
      for (const role of ROLES) {
        if (!holdsOne(role, rule)) continue;
        const rows = database.committed.auditSeqs.length;
        passed.length = 0;
        const [status, code] = outcomeOf(await call(rule, operator(role), true));
        // A demo operation is refused for the flag, which is off in this app (DC-2): after the permission, with no row.
        // Operation 81 (task 3 row 71; C3 §2.2: SESSION_START **and** SESSION_HOLDER): no session is open in this app, so
        // nobody is its holder - the permission alone does not pass. Only a SUPERVISOR does; anyone else is refused
        // 403 NOT_PERMITTED after the permission, with the ONE audited row of that condition (C3 §5.3).
        const notHolder = rule.conditions.includes(CoreApiAccessCondition.SESSION_HOLDER) && role !== 'SUPERVISOR';
        const want = rule.conditions.includes(CoreApiAccessCondition.DEMO_FLAG) ? [403, 'DEMO_DISABLED', 0] : notHolder ? [403, 'NOT_PERMITTED', 0] : [400, 'INVALID_JSON', 1];
        if (status !== want[0] || code !== want[1] || passed.length !== want[2] || database.committed.auditSeqs.length !== rows + (notHolder ? 1 : 0)) {
          wrong.push(`${rule.operationId} as ${role}: ${status} ${code}, passed ${passed.length}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('a retired device is refused with 403 DEVICE_REVOKED and one row on every operation that refuses it; health stays open', async () => {
    const retired: Principal = { kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0009' };
    const wrong: string[] = [];
    for (const rule of operations) {
      const rows = database.committed.auditSeqs.length;
      passed.length = 0;
      if (!rule.refusesRetiredDevice) {
        // What it may still call: asked without running a module's handler (a POST with no JSON; health reads nothing).
        if (rule.method === 'POST') {
          const [status, code] = outcomeOf(await call(rule, retired, true));
          if (status !== 400 || code !== 'INVALID_JSON') wrong.push(`${rule.operationId}: ${status} ${code}`);
        } else if (rule.operationId === 'getServiceHealth') {
          if ((await call(rule, retired)).statusCode !== 200) wrong.push(`${rule.operationId}: not 200`);
        }
        if (database.committed.auditSeqs.length !== rows) wrong.push(`${rule.operationId}: a row was written`);
        continue;
      }
      const [status, code] = outcomeOf(await call(rule, retired, rule.method === 'POST'));
      const written = database.committed.auditSeqs.length - rows;
      if (status !== 403 || code !== 'DEVICE_REVOKED' || written !== 1 || passed.length !== 0) wrong.push(`${rule.operationId}: ${status} ${code}, rows ${written}`);
    }
    expect(wrong).toEqual([]);
  });
});
