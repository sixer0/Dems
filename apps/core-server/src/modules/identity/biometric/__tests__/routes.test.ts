// The routes of the biometric token against the contract registry (plan row W41; module gate
// MODG; spec §7.5 operations 7 to 9, §7.3). In-process, no database: the route table of the real
// app factory, the real stages 5 and 6, a stand-in at stage 4, and a pool that records what it is
// asked. The allowed call of every operation is in the database tests.
import {
  CORE_API_OPERATIONS,
  CoreApiAccessCondition,
  CoreApiAccessKind,
  IDENTITY_OPERATIONS,
  matchCoreApiOperation,
  validateCoreApiResponse,
} from '@dems/shared/api';
import { ROLE_PERMISSIONS, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, RouteOptions } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../app';
import type { Principal } from '../../../../plugins/authenticate';
import { captureLog, createFakePool, unitTestConfig, type CapturedLog } from '../../../../../test/support/config';
import { permissionGuard } from '../../../../plugins/permission-guard';
import { throttleControl } from '../../../../plugins/throttle';
import { identityControl } from '../../index';
import { BIOMETRIC_OPERATION_IDS } from '../index';

const BIOMETRIC = '/api/v1/auth/biometric';
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

/** The real app; stage 4 is a stand-in, stages 5 and 6 are the real ones; the pool records every statement. */
async function build(): Promise<Built> {
  const log = captureLog();
  const fake = createFakePool();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream });
  apps.push(app);
  const registered: RouteOptions[] = [];
  // Before the units load: every route they add is seen.
  app.addHook('onRoute', (route) => void registered.push(route));
  let current: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  return { app, registered, log, queries: fake.queries, actAs: (principal) => void (current = principal) };
}

const operator = (role: OperatorRole, deviceId: string | null): Principal => ({
  kind: 'OPERATOR',
  operatorId: 'OPR-001',
  sessionId: 'session',
  deviceId,
  role,
  permissions: ROLE_PERMISSIONS[role],
});
const device: Principal = { kind: 'DEVICE', deviceId: 'DEV-0001' };
const mine = (route: RouteOptions): boolean => route.url.startsWith(BIOMETRIC);
const signature = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;
const outcome = (response: { statusCode: number; json: () => unknown }): [number, string] => [
  response.statusCode,
  (response.json() as { error: { code: string } }).error.code,
];

/** Each operation with a body that validates and a body that does not. */
const CALLS: ReadonlyArray<readonly [operationId: string, url: string, valid: Record<string, unknown>, invalid: Record<string, unknown>]> = [
  ['setBiometricEnrollment', BIOMETRIC, { enabled: true }, { enabled: 'yes' }],
  ['signInWithBiometric', `${BIOMETRIC}/sign-in`, { token: `bio_${'A'.repeat(43)}` }, { token: '' }],
  ['reportBiometricFailure', `${BIOMETRIC}/failure`, { operatorId: null }, { operatorId: 'nobody' }],
];

describe('MODG: the route list of the folder equals the registry operations it owns', () => {
  it('the routes under /api/v1/auth/biometric are exactly registry operations 7 to 9, with the method, the path and the operation ID of the registry', async () => {
    const { registered } = await build();
    const fromRegistry = IDENTITY_OPERATIONS.filter((operation) => (BIOMETRIC_OPERATION_IDS as readonly string[]).includes(operation.operationId)).map(
      (operation) => `${signature(operation.method, operation.path)} ${operation.operationId}`,
    );
    const fromModule = registered.filter(mine).map((route) => `${signature(String(route.method), route.url)} ${String(route.config?.operationId)}`);

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'POST /api/v1/auth/biometric setBiometricEnrollment',
      'POST /api/v1/auth/biometric/sign-in signInWithBiometric',
      'POST /api/v1/auth/biometric/failure reportBiometricFailure',
    ]);
    console.info(`[w41] MODG routes of src/modules/identity/biometric:\n  ${fromModule.join('\n  ')}`);
    console.info(`[w41] MODG registry, operations 7 to 9:\n  ${fromRegistry.join('\n  ')}`);
    for (const route of registered.filter(mine)) {
      expect(matchCoreApiOperation(String(route.method), route.url)?.operation.operationId).toBe(route.config?.operationId);
    }
  });

  it('the three operations are numbered 7, 8 and 9 in the registry, and every registry operation under /api/v1/auth/biometric is one of them', () => {
    const numberOf = (operationId: string): number =>
      Number(/operation (\d+)/.exec(CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId)?.source ?? '')?.[1]);
    expect(BIOMETRIC_OPERATION_IDS.map(numberOf)).toEqual([7, 8, 9]);
    expect(CORE_API_OPERATIONS.filter((operation) => operation.path.startsWith(BIOMETRIC)).map((operation) => operation.operationId)).toEqual([...BIOMETRIC_OPERATION_IDS]);
  });

  it('the rule the guard applies to each route is the registry\'s: AUTHENTICATED with DEVICE_SESSION for the enrolment, DEVICE for the sign-in and the report, the sign-in with DEVICE_CREDENTIAL; no permission, and a retired device is refused on all three', async () => {
    const { app } = await build();
    const rules = new Map(permissionGuard(app).registeredRules().map((rule) => [rule.operationId, rule]));
    expect(rules.get('setBiometricEnrollment')).toMatchObject({
      kind: CoreApiAccessKind.AUTHENTICATED,
      permissions: [],
      conditions: [CoreApiAccessCondition.DEVICE_SESSION],
      denial: null,
      refusesRetiredDevice: true,
    });
    // Finding F77, decision D118: the sign-in needs the device's own credential. The report takes a
    // session of the device too.
    for (const operationId of ['signInWithBiometric', 'reportBiometricFailure']) {
      expect(rules.get(operationId), operationId).toMatchObject({
        kind: CoreApiAccessKind.DEVICE,
        permissions: [],
        conditions: operationId === 'signInWithBiometric' ? [CoreApiAccessCondition.DEVICE_CREDENTIAL] : [],
        denial: null,
        refusesRetiredDevice: true,
      });
    }
  });

  it('no route carries a check of its own: no hook beside the stage hooks, no attached validation', async () => {
    const { registered } = await build();
    expect(registered.filter(mine)).toHaveLength(3);
    for (const route of registered.filter(mine)) {
      const name = String(route.config?.operationId);
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization'] as const) expect(route[hook], `${name} ${hook}`).toBeUndefined();
      expect(route.attachValidation, name).not.toBe(true);
    }
  });
});

describe('who may call is stage 6: one refused call per operation, before the body is read and without the database', () => {
  it('nobody without a principal: 401 NOT_SIGNED_IN on all three, also with a body that breaks its schema or is no JSON', async () => {
    const built = await build();
    for (const [operationId, url, , invalid] of CALLS) {
      for (const payload of [invalid, '{"token": ']) {
        const response = await built.app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload });
        expect(outcome(response), operationId).toEqual([401, 'NOT_SIGNED_IN']);
        expect(validateCoreApiResponse(operationId, 401, response.json()), operationId).toEqual({ ok: true });
        expect(response.headers['set-cookie']).toBeUndefined();
      }
    }
    expect(built.queries).toEqual([]);
  });

  it('a paired device without an operator: 401 on the enrolment (it needs a session); it reaches the sign-in and the report', async () => {
    const built = await build();
    built.actAs(device);
    expect(outcome(await built.app.inject({ method: 'POST', url: BIOMETRIC, payload: { enabled: true } }))).toEqual([401, 'NOT_SIGNED_IN']);
    // Past stage 6: the next stage judges the body.
    for (const [operationId, url, , invalid] of CALLS.slice(1)) {
      expect(outcome(await built.app.inject({ method: 'POST', url, payload: invalid })), operationId).toEqual([422, 'INVALID_INPUT']);
    }
    expect(built.queries).toEqual([]);
  });

  it('an operator on the web console, whatever the role: 403 DEVICE_NOT_PAIRED on all three, and no query', async () => {
    const built = await build();
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      built.actAs(operator(role, null));
      for (const [operationId, url, valid] of CALLS) {
        const response = await built.app.inject({ method: 'POST', url, payload: valid });
        expect(outcome(response), `${role} ${operationId}`).toEqual([403, 'DEVICE_NOT_PAIRED']);
        expect(validateCoreApiResponse(operationId, 403, response.json()), operationId).toEqual({ ok: true });
      }
    }
    expect(built.queries).toEqual([]);
  });

  // Finding F77, decision D118: a session of the device, still open, must not be able to renew
  // itself with a biometric token. Operation 8 carries the registry's condition DEVICE_CREDENTIAL.
  it('an operator on a paired device, whatever the role: passes stage 6 on the enrolment and the report (none carries a permission); on the sign-in the session is refused with 403 DEVICE_NOT_PAIRED and the reason DEVICE_CREDENTIAL_REQUIRED, before the body is read, without a query, an attempt or a place in the budget', async () => {
    const built = await build();
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      built.actAs(operator(role, 'DEV-0001'));
      for (const [operationId, url, valid, invalid] of CALLS) {
        if (operationId !== 'signInWithBiometric') {
          expect(outcome(await built.app.inject({ method: 'POST', url, payload: invalid })), `${role} ${operationId}`).toEqual([422, 'INVALID_INPUT']);
          continue;
        }
        // A body that validates, one that breaks the schema and one that is no JSON: the same refusal.
        for (const payload of [valid, invalid, '{"token": ']) {
          const response = await built.app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload });
          expect(outcome(response), `${role} ${operationId}`).toEqual([403, 'DEVICE_NOT_PAIRED']);
          expect((response.json() as { error: { message: string; details?: Record<string, unknown> } }).error).toMatchObject({
            message: "This operation needs the device's own credential.",
            details: { reason: 'DEVICE_CREDENTIAL_REQUIRED' },
          });
          expect(validateCoreApiResponse(operationId, 403, response.json()), operationId).toEqual({ ok: true });
          expect(response.headers['set-cookie']).toBeUndefined();
        }
      }
    }
    expect(built.queries).toEqual([]);
    // The refusal took no attempt from the device's lockout and no place in the operator's denial budget.
    expect(await identityControl(built.app).lockout.status('DEV-0001', built.app.clock.now())).toMatchObject({ locked: false, attemptsRemaining: 5 });
    expect(await throttleControl(built.app).inspect('operator:OPR-001')).toMatchObject({ used: 0 });
    // The device itself, with its own credential, passes stage 6: the next stage judges the body.
    built.actAs(device);
    expect(outcome(await built.app.inject({ method: 'POST', url: `${BIOMETRIC}/sign-in`, payload: { token: '' } }))).toEqual([422, 'INVALID_INPUT']);
  });
});

describe('what the body holds is stage 7: a refused body takes no attempt and asks the database nothing', () => {
  it('every body that breaks its schema answers 422 INVALID_INPUT; malformed JSON answers 400 INVALID_JSON; the device\'s lockout is untouched', async () => {
    const built = await build();
    built.actAs(device);
    const bodies: Record<string, unknown[]> = {
      [`${BIOMETRIC}/sign-in`]: [{}, { token: '' }, { token: 1 }, { token: null }, { token: 'x'.repeat(257) }, { token: `bio_\u0000${'A'.repeat(42)}` }],
      [`${BIOMETRIC}/failure`]: [{}, { operatorId: 'OPR-1' }, { operatorId: 'opr-001' }, { operatorId: 3 }, { operatorId: 'OPR-0001' }, { operatorId: ' OPR-001' }],
    };
    for (const [url, payloads] of Object.entries(bodies)) {
      for (const payload of payloads) {
        const response = await built.app.inject({ method: 'POST', url, payload: payload as object });
        expect(outcome(response), `${url} ${JSON.stringify(payload).slice(0, 40)}`).toEqual([422, 'INVALID_INPUT']);
        expect(validateCoreApiResponse(matchCoreApiOperation('POST', url)?.operation.operationId ?? '', 422, response.json())).toEqual({ ok: true });
      }
      // No JSON, and JSON that is no object: 400 before any schema is asked.
      for (const payload of ['{"x": ', '[]', '"bio_text"']) {
        const malformed = await built.app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload });
        expect(outcome(malformed), `${url} ${payload}`).toEqual([400, 'INVALID_JSON']);
      }
    }
    built.actAs(operator('INVESTIGATOR', 'DEV-0001'));
    for (const payload of [{}, { enabled: 'true' }, { enabled: 0 }, { enabled: null }]) {
      expect(outcome(await built.app.inject({ method: 'POST', url: BIOMETRIC, payload })), JSON.stringify(payload)).toEqual([422, 'INVALID_INPUT']);
    }

    expect(built.queries).toEqual([]);
    expect(await identityControl(built.app).lockout.status('DEV-0001', built.app.clock.now())).toMatchObject({ locked: false, attemptsRemaining: 5 });
  });

  it('the longest value the schema lets through is 256 characters, and it counts as an attempt like any other value', async () => {
    const built = await build();
    built.actAs(device);
    // The fake pool cannot open a unit: the request passes the schema and stops at the database.
    const response = await built.app.inject({ method: 'POST', url: `${BIOMETRIC}/sign-in`, payload: { token: 'x'.repeat(256) } });
    expect(response.statusCode).toBe(503);
    expect(outcome(response)[1]).toBe('NOT_READY');
    expect(validateCoreApiResponse('signInWithBiometric', 503, response.json())).toEqual({ ok: true });
  });
});

describe('the database is not there: 503, and nothing leaves the server', () => {
  it('the sign-in and the report answer 503 NOT_READY; the answer and the log hold nothing of the body; the attempt was taken before the database was asked (ENG-24), so the device is counted, never opened', async () => {
    const built = await build();
    const marker = `bio_${'M'.repeat(43)}`;
    const { lockout } = identityControl(built.app);
    const state = (): Promise<unknown> => lockout.status('DEV-0001', built.app.clock.now());
    built.actAs(device);

    const signIn = await built.app.inject({ method: 'POST', url: `${BIOMETRIC}/sign-in`, payload: { token: marker } });
    expect(outcome(signIn)).toEqual([503, 'NOT_READY']);
    expect(signIn.body).not.toContain(marker);
    expect(signIn.headers['x-dems-revision']).toBeUndefined();
    // Its attempt is taken; nothing was verified, so no failure is recorded.
    expect(await state()).toMatchObject({ locked: false, attemptsRemaining: 5 });

    const report = await built.app.inject({ method: 'POST', url: `${BIOMETRIC}/failure`, payload: { operatorId: 'OPR-001' } });
    expect(outcome(report)).toEqual([503, 'NOT_READY']);
    // A report IS a failure: it is counted although its row could not be written.
    expect(await state()).toMatchObject({ locked: false, attemptsRemaining: 4 });

    // Three more attempts take the device to its limit of five: it is locked, not opened.
    for (let attempt = 0; attempt < 3; attempt += 1) await built.app.inject({ method: 'POST', url: `${BIOMETRIC}/sign-in`, payload: { token: marker } });
    expect(await state()).toMatchObject({ locked: true, attemptsRemaining: 0 });
    expect(outcome(await built.app.inject({ method: 'POST', url: `${BIOMETRIC}/sign-in`, payload: { token: marker } }))).toEqual([503, 'NOT_READY']);
    // (The enrolment needs the session that the real stage 4 resolves: its failing statement is in
    // the database tests of the folder.)

    expect(built.log.text()).not.toContain(marker);
    expect(built.log.text()).not.toMatch(/bio_[A-Za-z0-9_-]{43}/);
  });
});
