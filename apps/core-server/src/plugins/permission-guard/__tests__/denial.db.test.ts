// The refusals of stage 6 against PostgreSQL (plan row W28; spec §4.6 RB-2 to RB-6, §5.1 ID-P13,
// §6.6, §7.3, §13.1; SR-13, SR-44, SR-45, SR-71; AC-B-16, AC-B-18, AC-B-75 (one operator);
// decisions D13 DEPARTURE-3, D64 DN-12, D78 DN-9).
//
// The real app factory on a clone of the seed, as `dems_app`, on a manual clock, with EVERY stage
// as the server has it: no stage is replaced. Operators sign in with the seeded credential. The
// device registry behind the seam `deviceResolver` is a stand-in the test steers.
//
// THE APP HAS NO DOMAIN MODULE (decision D85): `without-domain-modules` is the first import, so
// the eleven domain modules and the realtime channel add no route, whichever of them have
// landed. The operations a test calls get a stand-in route built from their registry entry, so
// the rule that is applied is the registry's, and a stand-in never stands beside a module's
// route. Every STAGE is the server's own.
//
// No credential is printed: a token is taken from an answer and handed on in a header.
import './without-domain-modules';
import { UserRoleRequestSchema, validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS, OPERATOR_IDS, type AuditRow } from '@dems/shared/sim';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { identityControl } from '../../../modules/identity';
import {
  CLOCK_START,
  OWN_ORIGIN,
  SESSION,
  SIGN_IN,
  STATUS,
  WEB_ORIGIN,
  bearer,
  errorOf,
  expectAbsent,
  insertPairedDevice,
  type Headers,
} from '../../../../test/support/identity';
import { credentialLeaks } from '../../../../test/support/config';
import { throttleControl } from '../../throttle';
import { routeOfOperation } from '../index';
import { deviceOperator, guardApp, operationOf, outcome, webOperator, type GuardApp } from '../../../../test/support/guard';

const db = useTestDatabase({ template: 'seed' });
let guard: GuardApp;
let owner: Pool;
/** The sessions of the three seeded operators on the web console: the cookie header of each. */
let investigator: Headers;
let supervisor: Headers;
let technician: Headers;
/** The TECHNICIAN on the paired device: a bearer header. */
let technicianOnDevice: Headers;

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const DEVICE = 'DEV-0001';

const STAND_INS = [
  'startSession',
  'listUsers',
  'setStoragePolicy',
  'exportEvidence',
  'exportAudit',
  'exportLogs',
  'listEvidence',
  'runDiagnostics',
  'resetDemo',
  'unpairDevice',
  'setBiometricEnrollment',
  'redeemPairingCode',
];

const START = '/api/v1/session/SES-20261001-0001/start';
const USERS = '/api/v1/admin/users';
const ROLE = '/api/v1/admin/users/OPR-003/role';
const POLICY = '/api/v1/storage/policy';
const EVIDENCE = '/api/v1/evidence';
const EVIDENCE_ID = 'EV-20261001-0001';

/** A request of the web console: the cookie, and for a command the web console `Origin`. */
function web(session: Headers, method: 'GET' | 'POST', url: string, payload?: InjectOptions['payload']): Promise<LightMyRequestResponse> {
  return guard.app.inject({ method, url, headers: method === 'POST' ? { ...session, origin: WEB_ORIGIN } : session, ...(payload === undefined ? {} : { payload }) });
}

const trail = (): Promise<AuditRow[]> => readTrail(owner);
const trailLength = async (): Promise<number> => (await trail()).length;
const since = async (from: number): Promise<AuditRow[]> => (await trail()).slice(from);
const denials = (rows: readonly AuditRow[]): AuditRow[] => rows.filter((row) => row.type === 'ACCESS_DENIED' || row.type === 'EXPORT_DENIED');

beforeAll(async () => {
  owner = db.ownerPool();
  guard = await guardApp(db, {
    standIns: STAND_INS,
    routes: (instance, reached) => {
      // With the registry's body schema: a permitted caller with a bad body gets the 422 of stage 7.
      instance.withTypeProvider<ZodTypeProvider>().route({
        ...routeOfOperation(operationOf('assignUserRole')),
        schema: { body: UserRoleRequestSchema },
        handler: async () => {
          reached.push('assignUserRole');
          return { reached: 'assignUserRole' };
        },
      });
    },
  });
  await insertPairedDevice(owner, DEVICE, OPERATOR_IDS.ANDI, CLOCK_START);
  const credential = guard.devices.pair(DEVICE);
  investigator = await webOperator(guard, INVESTIGATOR.username);
  supervisor = await webOperator(guard, SUPERVISOR.username);
  technician = await webOperator(guard, TECHNICIAN.username);
  technicianOnDevice = await deviceOperator(guard, credential, TECHNICIAN.username);
});

beforeEach(() => {
  // Each test starts with fresh throttle windows, denial budgets and sign-in lockouts.
  throttleControl(guard.app).reset();
  identityControl(guard.app).lockout.reset();
  guard.reached.length = 0;
});

describe('RB-4, SR-45: one row per refused call, none for an allowed call', () => {
  it('a denied call answers 403 NOT_PERMITTED and writes exactly one ACCESS_DENIED row naming actor, operation, permission and role, before the answer', async () => {
    const before = await trailLength();
    const units = guard.app.pipeline.snapshot().completed;
    guard.clock.advance(1_234);
    const response = await web(technician, 'POST', START);

    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toMatchObject({
      code: 'NOT_PERMITTED',
      message: 'Your role does not allow this action. The attempt was audited.',
      details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' },
    });
    expect(validateCoreApiResponse('startSession', 403, response.json())).toEqual({ ok: true });
    expect(guard.reached).toEqual([]);

    // The row is committed when the answer is there.
    const rows = await since(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'ACCESS_DENIED',
      category: 'SECURITY',
      severity: 'WARNING',
      actorId: TECHNICIAN.id,
      deviceId: null,
      sessionId: null,
      evidenceId: null,
      at: guard.clock.now(),
      message: 'Access denied: role TECHNICIAN lacks SESSION_START (startSession)',
      details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' },
    });
    expect(guard.app.pipeline.snapshot().completed).toBe(units + 1);
    // One chain: the row continues the head, and every stored row verifies.
    const stored = await trail();
    expect(linkProblems(stored)).toEqual([]);
    expect(verifyTrail(stored, await readHead(owner))).toMatchObject({ ok: true });
  });

  it('an allowed call writes no row, takes no place in the budget and reaches its handler', async () => {
    const before = await trailLength();
    expect((await web(investigator, 'POST', START)).statusCode).toBe(200);
    expect((await web(supervisor, 'GET', USERS)).statusCode).toBe(200);
    expect((await web(technician, 'POST', POLICY)).statusCode).toBe(200);
    expect(await trailLength()).toBe(before);
    for (const operator of [INVESTIGATOR, SUPERVISOR, TECHNICIAN]) {
      expect(await throttleControl(guard.app).inspect(`operator:${operator.id}`)).toMatchObject({ used: 0 });
    }
    expect(guard.reached).toEqual(['startSession', 'listUsers', 'setStoragePolicy']);
  });

  it('SR-46: nothing a client says about its role or its permissions is read: the server decides from what it stored', async () => {
    const before = await trailLength();
    const response = await guard.app.inject({
      method: 'POST',
      url: `${START}?role=SUPERVISOR&permission=SESSION_START`,
      headers: { ...technician, origin: WEB_ORIGIN, 'x-dems-role': 'SUPERVISOR', 'x-dems-permissions': 'SESSION_START,USER_ADMIN', 'x-operator-id': SUPERVISOR.id },
      payload: { role: 'SUPERVISOR', permissions: ['SESSION_START'], operatorId: SUPERVISOR.id },
    });
    expect(outcome(response)).toEqual([403, 'NOT_PERMITTED']);
    const rows = await since(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: TECHNICIAN.id, details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' } });
    expect(guard.reached).toEqual([]);
  });

  it('a 401 writes no row and takes no place in the denial budget: no actor can be named (RB-6)', async () => {
    const before = await trailLength();
    for (const request of [
      { method: 'POST', url: START } as const,
      { method: 'GET', url: USERS } as const,
      { method: 'POST', url: '/api/v1/pairing/device/unpair' } as const,
      { method: 'GET', url: SESSION } as const,
    ]) {
      expect(outcome(await guard.app.inject(request))).toEqual([401, 'NOT_SIGNED_IN']);
    }
    expect(await trailLength()).toBe(before);
    expect(await throttleControl(guard.app).inspect('class:local')).toMatchObject({ used: 0 });
  });

  it('a session on a paired device: the row names the device of the session', async () => {
    const before = await trailLength();
    // A mobile call: the bearer value and no Origin (decision D69).
    const response = await guard.app.inject({ method: 'POST', url: START, headers: technicianOnDevice });
    expect(outcome(response)).toEqual([403, 'NOT_PERMITTED']);
    const rows = await since(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'ACCESS_DENIED', actorId: TECHNICIAN.id, deviceId: DEVICE, details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' } });
    expect(await throttleControl(guard.app).inspect(`operator:${TECHNICIAN.id}`)).toMatchObject({ used: 1 });
  });

  it('the any-of: a holder of either permission is allowed, a holder of neither gets one row that names both as one code', async () => {
    const before = await trailLength();
    expect((await web(supervisor, 'POST', POLICY)).statusCode).toBe(200); // EVIDENCE_REVIEW
    expect((await web(technician, 'POST', POLICY)).statusCode).toBe(200); // MAINTENANCE
    const denied = await web(investigator, 'POST', POLICY);
    expect(denied.statusCode).toBe(403);
    expect(errorOf(denied)).toMatchObject({ code: 'NOT_PERMITTED', details: { operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role: 'INVESTIGATOR' } });
    const rows = await since(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'ACCESS_DENIED',
      actorId: INVESTIGATOR.id,
      message: 'Access denied: role INVESTIGATOR holds none of EVIDENCE_REVIEW, MAINTENANCE (setStoragePolicy)',
      details: { operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role: 'INVESTIGATOR' },
    });
  });

  it('DEVICE_NOT_PAIRED and DEMO_DISABLED write no row; a caller without DEMO_CONTROL gets NOT_PERMITTED with its row, whatever the flag (DC-1)', async () => {
    const before = await trailLength();
    expect(outcome(await web(supervisor, 'POST', '/api/v1/pairing/device/unpair'))).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expect(outcome(await web(supervisor, 'POST', '/api/v1/auth/biometric'))).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expect(outcome(await web(supervisor, 'POST', '/api/v1/demo/reset'))).toEqual([403, 'DEMO_DISABLED']);
    expect(await trailLength()).toBe(before);
    expect(await throttleControl(guard.app).inspect(`operator:${SUPERVISOR.id}`)).toMatchObject({ used: 0 });

    expect(outcome(await web(investigator, 'POST', '/api/v1/demo/reset'))).toEqual([403, 'NOT_PERMITTED']);
    expect(denials(await since(before)).map((row) => [row.actorId, row.details['operationId'], row.details['permission']])).toEqual([[INVESTIGATOR.id, 'resetDemo', 'DEMO_CONTROL']]);
    expect(guard.reached).toEqual([]);
  });
});

describe('RB-5: the three exports keep EXPORT_DENIED and its event', () => {
  it('exportEvidence: 403 FORBIDDEN, one EXPORT_DENIED row that names the evidence of the path, and one EXPORT_DENIED event', async () => {
    const before = await trailLength();
    const eventsBefore = (await readEvents(owner)).length;
    const response = await web(investigator, 'POST', `${EVIDENCE}/${EVIDENCE_ID}/export`, { reason: 'A reason of the test' });
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toMatchObject({ code: 'FORBIDDEN', details: { operationId: 'exportEvidence', permission: 'EVIDENCE_EXPORT', role: 'INVESTIGATOR' } });
    expect(validateCoreApiResponse('exportEvidence', 403, response.json())).toEqual({ ok: true });

    const rows = await since(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'EXPORT_DENIED',
      category: 'SECURITY',
      severity: 'WARNING',
      actorId: INVESTIGATOR.id,
      evidenceId: EVIDENCE_ID,
      message: `Export of ${EVIDENCE_ID} denied: role INVESTIGATOR lacks EVIDENCE_EXPORT`,
      details: { operationId: 'exportEvidence', permission: 'EVIDENCE_EXPORT', role: 'INVESTIGATOR', eventKind: 'UNAUTHORIZED_EXPORT' },
    });
    const events = (await readEvents(owner)).slice(eventsBefore);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'EXPORT_DENIED', severity: 'WARNING', params: { evidenceId: EVIDENCE_ID, role: 'INVESTIGATOR' } });
    expect(guard.reached).toEqual([]);
  });

  it('a path whose ID has not the form of an evidence ID: the same refusal, and nothing of the path is stored', async () => {
    const before = await trailLength();
    const marker = 'MARK-w28-path';
    const response = await web(technician, 'POST', `${EVIDENCE}/${marker}/export`, { reason: 'A reason of the test' });
    expect(outcome(response)).toEqual([403, 'FORBIDDEN']);
    const rows = await since(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'EXPORT_DENIED', evidenceId: null, message: 'Export of an evidence package denied: role TECHNICIAN lacks EVIDENCE_EXPORT' });
    expect(JSON.stringify(rows[0])).not.toContain(marker);
    expect(JSON.stringify((await readEvents(owner)).at(-1))).not.toContain(marker);
  });

  it.each([
    ['exportAudit', '/api/v1/audit/export', 'AUDIT', 'Audit export denied: role TECHNICIAN lacks AUDIT_EXPORT'],
    ['exportLogs', '/api/v1/logs/export', 'LOGS', 'Log export denied: role TECHNICIAN lacks AUDIT_EXPORT'],
  ])('%s: 403 NOT_PERMITTED, one EXPORT_DENIED row with the scope, and its event', async (operationId, url, scope, message) => {
    const before = await trailLength();
    const eventsBefore = (await readEvents(owner)).length;
    const response = await web(technician, 'POST', url, { reason: 'A reason of the test' });
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toMatchObject({ code: 'NOT_PERMITTED', details: { operationId, permission: 'AUDIT_EXPORT', role: 'TECHNICIAN' } });
    const rows = await since(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'EXPORT_DENIED',
      actorId: TECHNICIAN.id,
      evidenceId: null,
      message,
      details: { operationId, permission: 'AUDIT_EXPORT', role: 'TECHNICIAN', scope, eventKind: 'UNAUTHORIZED_EXPORT' },
    });
    expect((await readEvents(owner)).slice(eventsBefore).map((event) => [event.type, event.params])).toEqual([['EXPORT_DENIED', { role: 'TECHNICIAN', scope }]]);
    // The holder of the permission reaches the handler and writes no denial.
    expect((await web(supervisor, 'POST', url, { reason: 'A reason of the test' })).statusCode).toBe(200);
    expect(denials(await since(before))).toHaveLength(1);
  });
});

describe('SR-44: the refusal is decided before the body is read', () => {
  const json = { 'content-type': 'application/json' };
  const bodies = {
    'a body above 65,536 bytes': JSON.stringify({ role: 'TECHNICIAN', reason: 'x'.repeat(70_000) }),
    'malformed JSON': '{"role": "TECHNICIAN"',
    'a body that breaks its schema': JSON.stringify({ role: 'ADMIRAL' }),
    'a body that is no object': '"TECHNICIAN"',
  };
  const send = (session: Headers | null, payload: string): Promise<LightMyRequestResponse> =>
    guard.app.inject({ method: 'POST', url: ROLE, headers: { ...session, ...json, origin: WEB_ORIGIN }, payload });

  it.each(Object.entries(bodies))('%s: nobody gets 401, a role without USER_ADMIN gets 403 with its row; neither learns anything about the body', async (_label, payload) => {
    const before = await trailLength();
    expect(outcome(await send(null, payload))).toEqual([401, 'NOT_SIGNED_IN']);
    const denied = await send(technician, payload);
    expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(denied).details).toEqual({ operationId: 'assignUserRole', permission: 'USER_ADMIN', role: 'TECHNICIAN' });
    const rows = await since(before);
    expect(rows).toHaveLength(1);
    // The row holds nothing of the body: the three names and nothing else.
    expect(rows[0]?.details).toEqual({ operationId: 'assignUserRole', permission: 'USER_ADMIN', role: 'TECHNICIAN' });
    expect(guard.reached).toEqual([]);
  });

  it('the holder of USER_ADMIN is answered by stage 7 for the same bodies: 413, 400, 422, 400; and 200 for a good one', async () => {
    const before = await trailLength();
    expect(outcome(await send(supervisor, bodies['a body above 65,536 bytes']))).toEqual([413, 'PAYLOAD_TOO_LARGE']);
    expect(outcome(await send(supervisor, bodies['malformed JSON']))).toEqual([400, 'INVALID_JSON']);
    expect(outcome(await send(supervisor, bodies['a body that breaks its schema']))).toEqual([422, 'INVALID_INPUT']);
    expect(outcome(await send(supervisor, bodies['a body that is no object']))).toEqual([400, 'INVALID_JSON']);
    expect((await send(supervisor, JSON.stringify({ role: 'INVESTIGATOR' }))).statusCode).toBe(200);
    expect(await trailLength()).toBe(before);
    expect(guard.reached).toEqual(['assignUserRole']);
  });
});

describe('AC-B-75, SR-71: the denial budget of one operator', () => {
  const key = `operator:${TECHNICIAN.id}` as const;

  it('100 denied calls within 10 s write exactly 20 rows while the other 80 answer 429; after the 60 s window a denial is audited again', async () => {
    const before = await trailLength();
    const start = guard.clock.now();
    const answers: Array<[number, string | null]> = [];
    for (let call = 0; call < 100; call += 1) {
      answers.push(outcome(await web(technician, 'POST', START)));
      guard.clock.advance(100);
    }
    expect(guard.clock.now() - start).toBe(10_000);
    expect(answers.slice(0, 20)).toEqual(Array.from({ length: 20 }, () => [403, 'NOT_PERMITTED']));
    expect(answers.slice(20)).toEqual(Array.from({ length: 80 }, () => [429, 'RATE_LIMITED']));

    const rows = await since(before);
    expect(rows).toHaveLength(20);
    expect(rows.every((row) => row.type === 'ACCESS_DENIED' && row.actorId === TECHNICIAN.id && row.details['operationId'] === 'startSession')).toBe(true);
    expect(await throttleControl(guard.app).inspect(key)).toMatchObject({ used: 20, remaining: 0, exhausted: true, windowEndsAt: start + 60_000 });

    // While the key holds 20, every REST request of the operator answers 429, an allowed one included; health is exempt.
    const blocked = await web(technician, 'POST', POLICY);
    expect(outcome(blocked)).toEqual([429, 'RATE_LIMITED']);
    expect(Number(blocked.headers['retry-after'])).toBe(50);
    expect((await guard.app.inject({ method: 'GET', url: '/api/v1/health', headers: technician })).statusCode).toBe(200);
    // Another operator is not affected.
    expect((await web(investigator, 'POST', START)).statusCode).toBe(200);

    // One millisecond before the window ends: still 429 and no row. At its end: audited again.
    guard.clock.advance(49_999);
    expect(outcome(await web(technician, 'POST', START))).toEqual([429, 'RATE_LIMITED']);
    expect(await since(before)).toHaveLength(20);
    guard.clock.advance(1);
    expect(outcome(await web(technician, 'POST', START))).toEqual([403, 'NOT_PERMITTED']);
    const after = await since(before);
    expect(after).toHaveLength(21);
    expect(after[20]).toMatchObject({ type: 'ACCESS_DENIED', actorId: TECHNICIAN.id, at: start + 60_000 });
    expect(await throttleControl(guard.app).inspect(key)).toMatchObject({ used: 1 });

    const stored = await trail();
    expect(linkProblems(stored)).toEqual([]);
    expect(verifyTrail(stored, await readHead(owner))).toMatchObject({ ok: true });
  });

  it('100 denied calls at once write exactly 20 rows: 20 answer 403 and 80 answer 429, on the web and on the device together', async () => {
    const before = await trailLength();
    // One key for all sessions of the operator: 50 calls with the cookie, 50 with the bearer value.
    const calls = Array.from({ length: 100 }, (_unused, index) =>
      index % 2 === 0 ? web(technician, 'POST', START) : guard.app.inject({ method: 'POST', url: START, headers: technicianOnDevice }),
    );
    const statuses = (await Promise.all(calls)).map((response) => response.statusCode);
    expect(statuses.filter((status) => status === 403)).toHaveLength(20);
    expect(statuses.filter((status) => status === 429)).toHaveLength(80);
    const rows = await since(before);
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map((row) => row.seq)).size).toBe(20);
    expect(linkProblems(await trail())).toEqual([]);
    expect(guard.reached).toEqual([]);
  });

  it('a request with an Upgrade header is not blocked by the budget check of stage 5, and still cannot write a 21st row: the place it must take first refuses it', async () => {
    const before = await trailLength();
    const upgrade = { ...technicianOnDevice, upgrade: 'websocket', connection: 'Upgrade' };
    const statuses: number[] = [];
    for (let call = 0; call < 25; call += 1) statuses.push((await guard.app.inject({ method: 'POST', url: START, headers: upgrade })).statusCode);
    expect(statuses).toEqual([...Array.from({ length: 20 }, () => 403), ...Array.from({ length: 5 }, () => 429)]);
    expect(await since(before)).toHaveLength(20);
    expect(guard.reached).toEqual([]);
  });

  it('the budget is per key: the three operators each have their own 20', async () => {
    const before = await trailLength();
    for (let call = 0; call < 20; call += 1) expect((await web(technician, 'POST', START)).statusCode).toBe(403);
    expect(outcome(await web(technician, 'POST', START))).toEqual([429, 'RATE_LIMITED']);
    expect(outcome(await web(investigator, 'GET', USERS))).toEqual([403, 'NOT_PERMITTED']);
    expect(outcome(await web(supervisor, 'POST', '/api/v1/system/diagnostics'))).toEqual([200, null]);
    expect(denials(await since(before))).toHaveLength(21);
  });
});

describe('RB-6, decision D78: a retired device', () => {
  const RETIRED = 'DEV-0003';
  let credential: Headers;

  beforeAll(async () => {
    await insertPairedDevice(owner, RETIRED, OPERATOR_IDS.ANDI, CLOCK_START);
    credential = bearer(guard.devices.pair(RETIRED));
    guard.devices.retire(RETIRED);
  });

  it('answers 403 DEVICE_REVOKED with one ACCESS_DENIED row that names the device and no actor, counted in the class bucket', async () => {
    const before = await trailLength();
    const response = await guard.app.inject({ method: 'GET', url: SESSION, headers: credential });
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toMatchObject({ code: 'DEVICE_REVOKED', message: 'This device is no longer paired with the Core.', details: { reason: 'DEVICE_REVOKED' } });
    const rows = await since(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'ACCESS_DENIED',
      severity: 'WARNING',
      actorId: null,
      deviceId: RETIRED,
      message: `Access denied: device ${RETIRED} is no longer paired (getAuthSession)`,
      details: { operationId: 'getAuthSession', reason: 'DEVICE_REVOKED' },
    });
    expect(await throttleControl(guard.app).inspect('class:local')).toMatchObject({ used: 1 });
  });

  it('also on the PUBLIC operations 2 and 3: ONE row each, although the identity module has its own check behind the guard', async () => {
    const before = await trailLength();
    const signIn = await guard.app.inject({ method: 'POST', url: SIGN_IN, headers: credential, payload: { username: SUPERVISOR.username, password: 'not-the-password' } });
    expect(outcome(signIn)).toEqual([403, 'DEVICE_REVOKED']);
    const status = await guard.app.inject({ method: 'GET', url: STATUS, headers: { ...credential, origin: OWN_ORIGIN } });
    expect(outcome(status)).toEqual([403, 'DEVICE_REVOKED']);
    const rows = await since(before);
    expect(rows.map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['ACCESS_DENIED', null, RETIRED, { operationId: 'signIn', reason: 'DEVICE_REVOKED' }],
      ['ACCESS_DENIED', null, RETIRED, { operationId: 'getSignInStatus', reason: 'DEVICE_REVOKED' }],
    ]);
    // No sign-in attempt was taken or audited: the refusal came before the body.
    expect(await identityControl(guard.app).lockout.status(RETIRED, guard.clock.now())).toMatchObject({ attemptsRemaining: 5 });
  });

  it('spec §6.6: health and the pairing redeem stay open to it, and write no row', async () => {
    const before = await trailLength();
    expect((await guard.app.inject({ method: 'GET', url: '/api/v1/health', headers: credential })).statusCode).toBe(200);
    expect((await guard.app.inject({ method: 'POST', url: '/api/v1/pairing/redeem', headers: credential, payload: {} })).statusCode).toBe(200);
    expect(guard.reached).toEqual(['redeemPairingCode']);
    expect(await trailLength()).toBe(before);
    expect(await throttleControl(guard.app).inspect('class:local')).toMatchObject({ used: 0 });
  });

  it('AC-B-75: 25 calls that present five different retired device credentials write at most 20 rows in all: they share the class bucket', async () => {
    const credentials: Headers[] = [credential];
    for (const deviceId of ['DEV-0004', 'DEV-0005', 'DEV-0006', 'DEV-0007']) {
      await insertPairedDevice(owner, deviceId, OPERATOR_IDS.ANDI, CLOCK_START);
      credentials.push(bearer(guard.devices.pair(deviceId)));
      guard.devices.retire(deviceId);
    }
    const before = await trailLength();
    const statuses: number[] = [];
    for (let call = 0; call < 25; call += 1) statuses.push((await guard.app.inject({ method: 'GET', url: USERS, headers: credentials[call % 5] ?? {} })).statusCode);
    expect(statuses).toEqual([...Array.from({ length: 20 }, () => 403), ...Array.from({ length: 5 }, () => 429)]);
    const rows = await since(before);
    expect(rows).toHaveLength(20);
    expect([...new Set(rows.map((row) => row.deviceId))].sort()).toEqual([RETIRED, 'DEV-0004', 'DEV-0005', 'DEV-0006', 'DEV-0007']);
    expect(rows.every((row) => row.actorId === null && row.details['reason'] === 'DEVICE_REVOKED')).toBe(true);
    // Every caller without a principal shares that budget; a signed-in operator has a key of its own.
    expect(outcome(await guard.app.inject({ method: 'GET', url: STATUS }))).toEqual([429, 'RATE_LIMITED']);
    expect((await web(supervisor, 'GET', USERS)).statusCode).toBe(200);
  });
});

describe('AC-B-18, RB-2, RB-3: nothing about privilege is kept between two requests', () => {
  const roleOf = async (operatorId: string): Promise<string> => (await owner.query<{ role_id: string }>('SELECT role_id FROM public.operators WHERE id = $1', [operatorId])).rows[0]?.role_id ?? '';
  const setRole = (operatorId: string, role: string): Promise<unknown> => owner.query('UPDATE public.operators SET role_id = $2 WHERE id = $1', [operatorId, role]);

  it('a role change applies to the next request of the SAME session, with no new sign-in and no reload: 403 before, 200 after, and the reverse', async () => {
    expect(await roleOf(TECHNICIAN.id)).toBe('TECHNICIAN');
    const before = await trailLength();
    expect(outcome(await web(technician, 'POST', START))).toEqual([403, 'NOT_PERMITTED']);
    expect(outcome(await web(technician, 'GET', USERS))).toEqual([403, 'NOT_PERMITTED']);

    await setRole(TECHNICIAN.id, 'SUPERVISOR');
    expect((await web(technician, 'POST', START)).statusCode).toBe(200);
    expect((await web(technician, 'GET', USERS)).statusCode).toBe(200);
    // What the session answer says is the same read: the hint and the decision cannot differ.
    const session = (await web(technician, 'GET', SESSION)).json() as { operator: { role: string }; permissions: string[] };
    expect(session.operator.role).toBe('SUPERVISOR');
    expect(session.permissions).toContain('USER_ADMIN');
    // The device session of the same operator follows at once as well.
    expect((await guard.app.inject({ method: 'POST', url: START, headers: technicianOnDevice })).statusCode).toBe(200);

    await setRole(TECHNICIAN.id, 'TECHNICIAN');
    expect(outcome(await web(technician, 'POST', START))).toEqual([403, 'NOT_PERMITTED']);
    expect(outcome(await web(technician, 'GET', USERS))).toEqual([403, 'NOT_PERMITTED']);

    const rows = denials(await since(before));
    expect(rows.map((row) => [row.details['operationId'], row.details['role']])).toEqual([
      ['startSession', 'TECHNICIAN'],
      ['listUsers', 'TECHNICIAN'],
      ['startSession', 'TECHNICIAN'],
      ['listUsers', 'TECHNICIAN'],
    ]);
  });

  it('a demotion is refused under the new role: the row names the role of this request', async () => {
    const before = await trailLength();
    await setRole(SUPERVISOR.id, 'INVESTIGATOR');
    try {
      expect(outcome(await web(supervisor, 'GET', USERS))).toEqual([403, 'NOT_PERMITTED']);
      expect((await since(before))[0]).toMatchObject({ actorId: SUPERVISOR.id, details: { operationId: 'listUsers', permission: 'USER_ADMIN', role: 'INVESTIGATOR' } });
    } finally {
      await setRole(SUPERVISOR.id, 'SUPERVISOR');
    }
    expect((await web(supervisor, 'GET', USERS)).statusCode).toBe(200);
  });

  it('a changed GRANT applies to the next request too: the stored matrix is read with every request, never from a copy', async () => {
    const before = await trailLength();
    expect((await web(technician, 'GET', EVIDENCE)).statusCode).toBe(200);
    // F-8 of the contract row: every seeded role holds EVIDENCE_VIEW, so its operations have no
    // denied case with seeded data. Here the grant is taken away in the clone, as `dems_owner`.
    await owner.query("DELETE FROM public.role_permissions WHERE role_id = 'TECHNICIAN' AND permission_id = 'EVIDENCE_VIEW'");
    try {
      const denied = await web(technician, 'GET', EVIDENCE);
      expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(denied).details).toEqual({ operationId: 'listEvidence', permission: 'EVIDENCE_VIEW', role: 'TECHNICIAN' });
      expect((await web(investigator, 'GET', EVIDENCE)).statusCode).toBe(200);
    } finally {
      await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('TECHNICIAN', 'EVIDENCE_VIEW')");
    }
    expect((await web(technician, 'GET', EVIDENCE)).statusCode).toBe(200);
    // The other permission of F-8, DIAGNOSTICS_RUN, the other way round: granted to nobody, then back.
    await owner.query("DELETE FROM public.role_permissions WHERE permission_id = 'DIAGNOSTICS_RUN'");
    try {
      for (const session of [investigator, supervisor, technician]) expect(outcome(await web(session, 'POST', '/api/v1/system/diagnostics'))).toEqual([403, 'NOT_PERMITTED']);
    } finally {
      await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) SELECT id, 'DIAGNOSTICS_RUN' FROM public.roles");
    }
    expect((await web(technician, 'POST', '/api/v1/system/diagnostics')).statusCode).toBe(200);
    expect(denials(await since(before)).map((row) => [row.actorId, row.details['permission']])).toEqual([
      [TECHNICIAN.id, 'EVIDENCE_VIEW'],
      [INVESTIGATOR.id, 'DIAGNOSTICS_RUN'],
      [SUPERVISOR.id, 'DIAGNOSTICS_RUN'],
      [TECHNICIAN.id, 'DIAGNOSTICS_RUN'],
    ]);
  });
});

describe('what the rows, the events and the log never hold', () => {
  it('no token, no cookie value and no credential: every denial row of this file holds identifiers and codes only', async () => {
    const rows = denials(await trail());
    expect(rows.length).toBeGreaterThan(90);
    const allowedKeys = new Set(['operationId', 'permission', 'role', 'reason', 'scope', 'eventKind']);
    for (const row of rows) expect(Object.keys(row.details).filter((key) => !allowedKeys.has(key))).toEqual([]);

    const secrets: Record<string, string> = {};
    for (const [label, headers] of Object.entries({ investigator, supervisor, technician, technicianOnDevice })) {
      const value = headers['cookie']?.split('=')[1] ?? headers['authorization']?.split(' ')[1] ?? '';
      expect(value.length).toBeGreaterThan(40);
      secrets[label] = value;
    }
    const stored = JSON.stringify([await trail(), await readEvents(owner)]);
    expectAbsent(stored, secrets);
    expectAbsent(guard.log.text(), secrets);
    expect(credentialLeaks(guard.log.text())).toEqual([]);
  });

  it('every 403 of the guard is one warn line with the code, the operation and the rule; a 401 has none', () => {
    const refused = guard.log.lines().filter((line) => line['msg'] === 'request refused by the access rule');
    expect(refused.length).toBeGreaterThan(90);
    expect(new Set(refused.map((line) => line['code']))).toEqual(new Set(['NOT_PERMITTED', 'FORBIDDEN', 'DEVICE_REVOKED', 'DEVICE_NOT_PAIRED', 'DEMO_DISABLED']));
    expect(refused.every((line) => line['level'] === 40 && typeof line['operationId'] === 'string' && typeof line['access'] === 'string')).toBe(true);
    expect(refused.filter((line) => line['code'] === 'DEVICE_NOT_PAIRED' || line['code'] === 'DEMO_DISABLED').every((line) => line['audited'] === false)).toBe(true);
    expect(refused.filter((line) => line['code'] === 'NOT_PERMITTED').every((line) => line['audited'] === true)).toBe(true);
  });
});
