// Operations 11 and 12 against PostgreSQL, through the real stages 3 to 6 (plan row W33; spec
// §4.6 RB-3 and RB-8, §4.7, §7.6, §13.1; SR-13, SR-47; AC-B-18, AC-B-21 for a demotion; module
// gate MODG; decision D83 DN-2).
//
// The real app factory on a clone of the seed, as `dems_app`, BOOTED: the engine runs on a manual
// timer (decision D77), so a unit's audit row reaches the engine's ring, a role change is
// mirrored into the `operators` slice, and the two headers of API-7 carry real revisions. No
// stage is replaced; the sessions are real sign-ins of the seeded operators.
import { ADMINISTRATION_EXAMPLES, validateCoreApiResponse, type AdminUser } from '@dems/shared/api';
import { OPERATORS, ROLE_PERMISSIONS } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { permissionGuard } from '../../../plugins/permission-guard';
import { SESSION, errorOf, insertPairedDevice, storedSessions, type Headers } from '../../../../test/support/identity';
import {
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  USERS,
  adminApp,
  forgetCounters,
  outcome,
  publicationLines,
  putOperator,
  roleUrl,
  signInDevice,
  signInWeb,
  storedAdministrators,
  storedOperator,
  storedOperators,
  web,
  type AdminApp,
} from './support';

const db = useTestDatabase({ template: 'seed' });

// Under the load of several rows' runs a clone, a boot or a sign-in takes many times its usual
// time (seen: a 0.2 s test past the default 5 s). The limits of this file are wide enough for
// that; a real hang still fails, later.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });
let admin: AdminApp;
let owner: Pool;
/** The sessions of the three seeded operators on the web console: the cookie header of each. */
let supervisor: Headers;
let investigator: Headers;
let technician: Headers;
/** The TECHNICIAN on a paired device: a bearer header. */
let technicianOnDevice: Headers;

const DEVICE = 'DEV-0001';
const MARKER = 'MARK-w33-reason covers the interview shift';

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const since = async (from: number) => (await readTrail(owner)).slice(from);
const user = (response: LightMyRequestResponse): AdminUser => response.json() as AdminUser;
const revision = (response: LightMyRequestResponse): number => Number(response.headers['x-dems-revision']);

/**
 * Everything a refusal must leave as it was. The last activity of a session is left out: a POST
 * of an operator is activity whatever it answers (ID-P9), recorded by the hook of the
 * `authenticate` plugin before the handler runs.
 */
async function everything() {
  return {
    operators: await storedOperators(owner),
    sessions: (await storedSessions(owner)).map(({ lastSeenAt: _activity, ...session }) => session),
    trail: await trailLength(),
    events: (await readEvents(owner)).length,
    revision: admin.app.engine.revision,
    engineOperators: admin.app.engine.slice('operators'),
  };
}

beforeAll(async () => {
  owner = db.ownerPool();
  admin = await adminApp(db);
  await insertPairedDevice(owner, DEVICE, SUPERVISOR.id, admin.clock.now());
  const credential = admin.devices.pair(DEVICE);
  supervisor = await signInWeb(admin, SUPERVISOR.username);
  investigator = await signInWeb(admin, INVESTIGATOR.username);
  technician = await signInWeb(admin, TECHNICIAN.username);
  technicianOnDevice = await signInDevice(admin, credential, TECHNICIAN.username);
  await admin.app.pipeline.drain();
});

beforeEach(() => {
  forgetCounters(admin);
  admin.published.length = 0;
});

afterEach(async () => {
  // Every test leaves the three operators as the seed has them.
  await admin.app.pipeline.drain();
  for (const seeded of OPERATORS) await putOperator(owner, seeded.id, { role: seeded.role, enabled: true });
  await owner.query('UPDATE public.operators SET role_changed_at = NULL');
  await admin.app.engine.mirrorOperators();
});

describe('operation 11 listUsers', () => {
  it('the SUPERVISOR lists every operator in ID order: 200, valid against the contract, equal to what is stored; a read writes nothing', async () => {
    const before = await everything();
    const response = await web(admin.app, supervisor, 'GET', USERS);
    expect(response.statusCode).toBe(200);
    const body = response.json() as { users: AdminUser[] };
    expect(validateCoreApiResponse('listUsers', 200, body)).toEqual({ ok: true });
    expect(body.users.map((entry) => entry.id)).toEqual(['OPR-001', 'OPR-002', 'OPR-003']);
    // The public members are the seeded operators'; the flag, the times and the count are the tables'.
    const stored = await storedOperators(owner);
    expect(body.users).toEqual(
      OPERATORS.map((seeded, index) => ({
        ...seeded,
        enabled: true,
        lastSignInAt: stored[index]?.lastSignInAt,
        activeSessions: seeded.id === TECHNICIAN.id ? 2 : 1,
        roleChangedAt: null,
      })),
    );
    expect(body.users.every((entry) => entry.lastSignInAt === admin.clock.now())).toBe(true);
    // The same shape as the contract's example: the same keys per user.
    const example = ADMINISTRATION_EXAMPLES['listUsers']?.responses?.[200]?.['seeded']?.value as { users: AdminUser[] } | undefined;
    expect(example?.users).toHaveLength(3);
    expect(Object.keys(body.users[0] ?? {}).sort()).toEqual(Object.keys(example?.users[0] ?? {}).sort());
    // NONE-R: no audit row, no event, no publication, no cookie, no state revision header.
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['x-dems-revision']).toBeUndefined();
    expect(response.headers['x-dems-epoch']).toBeUndefined();
  });

  it('counts the sessions that are open: a signed-out session leaves the count, an ended one never comes back', async () => {
    const extra = await signInWeb(admin, INVESTIGATOR.username);
    const count = async (): Promise<number | undefined> =>
      ((await web(admin.app, supervisor, 'GET', USERS)).json() as { users: AdminUser[] }).users.find((entry) => entry.id === INVESTIGATOR.id)?.activeSessions;
    expect(await count()).toBe(2);
    expect((await web(admin.app, extra, 'POST', '/api/v1/auth/sign-out', {})).statusCode).toBe(204);
    expect(await count()).toBe(1);
  });

  it('a session on a paired device lists too, when its operator holds the permission', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'SUPERVISOR', enabled: true });
    const response = await admin.app.inject({ method: 'GET', url: USERS, headers: technicianOnDevice });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { users: AdminUser[] }).users).toHaveLength(3);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('refusals are the guard\'s: nobody without a session (401, no row); a role without USER_ADMIN (403 NOT_PERMITTED with ONE ACCESS_DENIED row)', async () => {
    const before = await trailLength();
    const anonymous = await admin.app.inject({ method: 'GET', url: USERS });
    expect(outcome(anonymous)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('listUsers', 401, anonymous.json())).toEqual({ ok: true });
    expect(await trailLength()).toBe(before);

    for (const [session, role, actor] of [
      [investigator, 'INVESTIGATOR', INVESTIGATOR.id],
      [technician, 'TECHNICIAN', TECHNICIAN.id],
    ] as const) {
      const from = await trailLength();
      const denied = await web(admin.app, session, 'GET', USERS);
      expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(denied).details).toEqual({ operationId: 'listUsers', permission: 'USER_ADMIN', role });
      expect(validateCoreApiResponse('listUsers', 403, denied.json())).toEqual({ ok: true });
      expect((await since(from)).map((row) => [row.type, row.actorId, row.details])).toEqual([['ACCESS_DENIED', actor, { operationId: 'listUsers', permission: 'USER_ADMIN', role }]]);
    }
  });
});

describe('operation 12 assignUserRole', () => {
  it('200: the role is changed in one unit; ROLE_CHANGED names actor, target, old and new role; the sessions stay; the publications leave after the commit in order; the headers carry the revision that holds the effect', async () => {
    const before = await everything();
    const sessionsBefore = (await storedSessions(owner)).filter((session) => session.operatorId === TECHNICIAN.id);
    admin.clock.advance(1_000);
    const response = await web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR', reason: `  ${MARKER}  ` });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('assignUserRole', 200, response.json())).toEqual({ ok: true });
    expect(user(response)).toEqual({ ...TECHNICIAN, role: 'INVESTIGATOR', enabled: true, lastSignInAt: before.operators[2]?.lastSignInAt, activeSessions: 2, roleChangedAt: admin.clock.now() });

    // The row of the operator: the role and the two times, nothing else.
    expect(await storedOperator(owner, TECHNICIAN.id)).toEqual({ ...before.operators[2], role: 'INVESTIGATOR', roleChangedAt: admin.clock.now(), updatedAt: admin.clock.now() });
    expect((await storedOperators(owner)).slice(0, 2)).toEqual(before.operators.slice(0, 2));
    // The sessions stay (spec §4.7): the same rows, still open.
    expect((await storedSessions(owner)).filter((session) => session.operatorId === TECHNICIAN.id)).toEqual(sessionsBefore);

    // Exactly one audit row, and no event (spec §13.1: audit-only).
    const rows = await since(before.trail);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'ROLE_CHANGED',
      category: 'SECURITY',
      severity: 'INFO',
      actorId: SUPERVISOR.id,
      deviceId: null,
      at: admin.clock.now(),
      message: 'Role of OPR-003 changed from TECHNICIAN to INVESTIGATOR',
      // The reason as the schema left it: trimmed. It is in the details and nowhere else.
      details: { targetOperatorId: TECHNICIAN.id, from: 'TECHNICIAN', to: 'INVESTIGATOR', reason: MARKER },
    });
    expect((await readEvents(owner)).length).toBe(before.events);
    const trail = await readTrail(owner);
    expect(linkProblems(trail)).toEqual([]);
    const head = await readHead(owner);
    expect(verifyTrail(trail, head)).toEqual({ ok: true, checked: trail.length, head: head.hash });

    // After the commit, in this order: the audit row as a state change, the two publications of
    // the unit, then the mirrored `operators` slice.
    expect(publicationLines(admin.published)).toEqual([
      `state native r${before.revision + 1}: append audit[ROLE_CHANGED]`,
      `session.updated OPR-003 INVESTIGATOR [${ROLE_PERMISSIONS.INVESTIGATOR.length} permissions]`,
      'admin.changed USERS',
      `state operators r${before.revision + 2}: replace operators`,
    ]);
    const updated = admin.published.find((publication) => publication.kind === 'session.updated');
    expect(updated).toEqual({ kind: 'session.updated', operatorId: TECHNICIAN.id, role: 'INVESTIGATOR', permissions: ROLE_PERMISSIONS.INVESTIGATOR });

    // API-7: the revision of the newest change that holds the command's effect.
    expect(response.headers['x-dems-epoch']).toBe(String(admin.app.engine.epoch));
    expect(revision(response)).toBe(before.revision + 2);
    expect(admin.app.engine.revision).toBe(before.revision + 2);
    // ENG-3: the engine's slice equals the table.
    expect(admin.app.engine.slice('operators').find((entry) => entry.id === TECHNICIAN.id)).toEqual({ ...TECHNICIAN, role: 'INVESTIGATOR' });
    expect(admin.app.engine.slice('audit').rows.at(-1)).toMatchObject({ type: 'ROLE_CHANGED', seq: rows[0]?.seq });
    expect(response.headers['set-cookie']).toBeUndefined();
    // The reason is in the row; no log line carries it.
    expect(admin.log.text()).not.toContain('MARK-w33-reason');
    expect(admin.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });

  it('a reason that is empty after trimming is no reason: the row has no such key; no reason at all is the same', async () => {
    for (const [body, to] of [
      [{ role: 'INVESTIGATOR', reason: '   ' }, 'INVESTIGATOR'],
      [{ role: 'TECHNICIAN' }, 'TECHNICIAN'],
    ] as const) {
      const from = await trailLength();
      expect((await web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), body)).statusCode).toBe(200);
      const rows = await since(from);
      expect(rows.map((row) => row.type)).toEqual(['ROLE_CHANGED']);
      expect(Object.keys(rows[0]?.details ?? {}).sort()).toEqual(['from', 'targetOperatorId', 'to']);
      expect(rows[0]?.details).toMatchObject({ to });
    }
  });

  it('the role the operator already has: 200 with the operator, and NOTHING else: no row, no publication, no changed time; the headers carry the current revision', async () => {
    const before = await everything();
    admin.clock.advance(1_000);
    const response = await web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'TECHNICIAN', reason: 'no change at all' });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('assignUserRole', 200, response.json())).toEqual({ ok: true });
    expect(user(response)).toMatchObject({ id: TECHNICIAN.id, role: 'TECHNICIAN', roleChangedAt: null });
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
    expect(revision(response)).toBe(before.revision);
    expect(response.headers['x-dems-epoch']).toBe(String(admin.app.engine.epoch));
  });

  it('404: no operator has this ID; valid against the contract; nothing changed', async () => {
    const before = await everything();
    const response = await web(admin.app, supervisor, 'POST', roleUrl('OPR-999'), { role: 'INVESTIGATOR' });
    expect(outcome(response)).toEqual([404, 'NOT_FOUND']);
    expect(errorOf(response).message).toBe('No operator has this ID.');
    expect(validateCoreApiResponse('assignUserRole', 404, response.json())).toEqual({ ok: true });
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
    expect(response.headers['x-dems-revision']).toBeUndefined();
  });

  it('422 and 400 through the real stages: a bad body, a malformed ID and a credential-shaped reason are refused before any unit; nothing changed', async () => {
    const before = await everything();
    const units = admin.app.pipeline.snapshot().completed;
    const shaped = `see ${['ses', 'B'.repeat(43)].join('_')}`;
    for (const [url, body, where] of [
      [roleUrl(TECHNICIAN.id), { role: 'ROOT' }, 'body'],
      [roleUrl(TECHNICIAN.id), {}, 'body'],
      [roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR', reason: 'x'.repeat(501) }, 'body'],
      [roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR', reason: shaped }, 'body'],
      [roleUrl('OPR-3'), { role: 'INVESTIGATOR' }, 'params'],
    ] as const) {
      const response = await web(admin.app, supervisor, 'POST', url, body);
      expect(outcome(response)).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(response).details).toEqual({ in: where });
      expect(validateCoreApiResponse('assignUserRole', 422, response.json())).toEqual({ ok: true });
    }
    const malformed = await admin.app.inject({ method: 'POST', url: roleUrl(TECHNICIAN.id), headers: { ...supervisor, origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' }, payload: '{"role":' });
    expect(outcome(malformed)).toEqual([400, 'INVALID_JSON']);
    expect(validateCoreApiResponse('assignUserRole', 400, malformed.json())).toEqual({ ok: true });
    expect(await everything()).toEqual(before);
    expect(admin.app.pipeline.snapshot().completed).toBe(units);
    expect(admin.published).toEqual([]);
  });

  it('refusals are the guard\'s and come before the body is read: 401 without a session; 403 NOT_PERMITTED with ONE ACCESS_DENIED row for a role without USER_ADMIN, also for a body that would fail validation', async () => {
    const before = await everything();
    const anonymous = await admin.app.inject({ method: 'POST', url: roleUrl(TECHNICIAN.id), headers: { origin: 'http://127.0.0.1:5173' }, payload: { role: 'SUPERVISOR' } });
    expect(outcome(anonymous)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('assignUserRole', 401, anonymous.json())).toEqual({ ok: true });
    expect(await trailLength()).toBe(before.trail);

    // The TECHNICIAN tries to make itself a SUPERVISOR, with a good body and with a bad one.
    for (const body of [{ role: 'SUPERVISOR' }, { role: 'ROOT', reason: 7 }]) {
      const from = await trailLength();
      const denied = await web(admin.app, technician, 'POST', roleUrl(TECHNICIAN.id), body);
      expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(denied).details).toEqual({ operationId: 'assignUserRole', permission: 'USER_ADMIN', role: 'TECHNICIAN' });
      expect(validateCoreApiResponse('assignUserRole', 403, denied.json())).toEqual({ ok: true });
      expect((await since(from)).map((row) => [row.type, row.actorId])).toEqual([['ACCESS_DENIED', TECHNICIAN.id]]);
    }
    expect(await storedOperators(owner)).toEqual(before.operators);
    expect(admin.published.filter((publication) => publication.kind !== 'state')).toEqual([]);
  });

  it('the actor of the row is the session: a SUPERVISOR on a paired device writes its operator and its device, whatever the body says', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'SUPERVISOR', enabled: true });
    const from = await trailLength();
    // Members a caller might hope to be taken as the actor or the time: dropped by the schema.
    const response = await admin.app.inject({
      method: 'POST',
      url: roleUrl(INVESTIGATOR.id),
      headers: technicianOnDevice,
      payload: { role: 'TECHNICIAN', actorId: SUPERVISOR.id, operatorId: SUPERVISOR.id, deviceId: 'DEV-9999', at: 1 },
    });
    expect(response.statusCode).toBe(200);
    const rows = await since(from);
    expect(rows.map((row) => [row.type, row.actorId, row.deviceId, row.at])).toEqual([['ROLE_CHANGED', TECHNICIAN.id, DEVICE, admin.clock.now()]]);
    expect(rows[0]?.details).toEqual({ targetOperatorId: INVESTIGATOR.id, from: 'INVESTIGATOR', to: 'TECHNICIAN' });
    // No Set-Cookie on an answer to a device's bearer request.
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('a disabled operator\'s role can be changed: the rule counts enabled holders only', async () => {
    await putOperator(owner, INVESTIGATOR.id, { role: 'INVESTIGATOR', enabled: false });
    const response = await web(admin.app, supervisor, 'POST', roleUrl(INVESTIGATOR.id), { role: 'TECHNICIAN' });
    expect(response.statusCode).toBe(200);
    expect(user(response)).toMatchObject({ id: INVESTIGATOR.id, role: 'TECHNICIAN', enabled: false });
  });
});

describe('AC-B-21, RB-8: demoting the last enabled SUPERVISOR answers 409 LAST_ADMIN and changes nothing', () => {
  it('the only SUPERVISOR cannot be demoted, to either role, by itself: 409, valid against the contract, and nothing at all is different afterwards', async () => {
    expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id]);
    const before = await everything();
    admin.clock.advance(1_000);
    for (const role of ['INVESTIGATOR', 'TECHNICIAN'] as const) {
      const response = await web(admin.app, supervisor, 'POST', roleUrl(SUPERVISOR.id), { role, reason: 'stepping down' });
      expect(outcome(response)).toEqual([409, 'LAST_ADMIN']);
      expect(errorOf(response).message).toBe('At least one enabled operator must keep user administration.');
      expect(validateCoreApiResponse('assignUserRole', 409, response.json())).toEqual({ ok: true });
      expect(response.headers['x-dems-revision']).toBeUndefined();
    }
    // The operator rows (their `updated_at` included), the sessions, the trail, the events, the
    // engine: all as before. No publication.
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
    // The session that asked still holds user administration.
    expect((await web(admin.app, supervisor, 'GET', USERS)).statusCode).toBe(200);
  });

  it('a second SUPERVISOR that is disabled does not count: still 409', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'SUPERVISOR', enabled: false });
    const before = await everything();
    const response = await web(admin.app, supervisor, 'POST', roleUrl(SUPERVISOR.id), { role: 'INVESTIGATOR' });
    expect(outcome(response)).toEqual([409, 'LAST_ADMIN']);
    expect(await everything()).toEqual(before);
  });

  it('with a second ENABLED SUPERVISOR the demotion is allowed, and the one who is left then is the last', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'SUPERVISOR', enabled: true });
    expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id, TECHNICIAN.id]);
    // The first SUPERVISOR demotes the second ...
    expect((await web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR' })).statusCode).toBe(200);
    expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id]);
    // ... and is now the last one.
    expect(outcome(await web(admin.app, supervisor, 'POST', roleUrl(SUPERVISOR.id), { role: 'INVESTIGATOR' }))).toEqual([409, 'LAST_ADMIN']);
    expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id]);
  });

  it('the rule reads the STORED matrix inside the unit: with USER_ADMIN granted to TECHNICIAN as well, the SUPERVISOR may be demoted while an enabled TECHNICIAN exists', async () => {
    await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('TECHNICIAN', 'USER_ADMIN')");
    try {
      expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id, TECHNICIAN.id]);
      const response = await web(admin.app, supervisor, 'POST', roleUrl(SUPERVISOR.id), { role: 'INVESTIGATOR' });
      expect(response.statusCode).toBe(200);
      // The TECHNICIAN is the last holder now.
      expect(outcome(await web(admin.app, technician, 'POST', roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR' }))).toEqual([409, 'LAST_ADMIN']);
    } finally {
      await owner.query("DELETE FROM public.role_permissions WHERE role_id = 'TECHNICIAN' AND permission_id = 'USER_ADMIN'");
    }
  });
});

describe('an operator changing the OWN role: allowed unless it is the last administrator', () => {
  it('a SUPERVISOR beside another one demotes itself: 200; the same session keeps running with the new role and has lost user administration', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'SUPERVISOR', enabled: true });
    const from = await trailLength();
    const response = await web(admin.app, technician, 'POST', roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR' });
    expect(response.statusCode).toBe(200);
    expect(user(response)).toMatchObject({ id: TECHNICIAN.id, role: 'INVESTIGATOR', activeSessions: 2 });
    expect((await since(from)).map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['ROLE_CHANGED', TECHNICIAN.id, { targetOperatorId: TECHNICIAN.id, from: 'SUPERVISOR', to: 'INVESTIGATOR' }],
    ]);
    // Not signed out: the session answers, with the new role; the page it came from is closed to it.
    const session = await web(admin.app, technician, 'GET', SESSION);
    expect(session.statusCode).toBe(200);
    expect((session.json() as { operator: { role: string } }).operator.role).toBe('INVESTIGATOR');
    expect(outcome(await web(admin.app, technician, 'GET', USERS))).toEqual([403, 'NOT_PERMITTED']);
    expect(outcome(await web(admin.app, technician, 'POST', roleUrl(TECHNICIAN.id), { role: 'SUPERVISOR' }))).toEqual([403, 'NOT_PERMITTED']);
  });
});

describe('AC-B-18, RB-3, SR-13: a role change applies to the NEXT request of the same session, both ways, with no new sign-in', () => {
  it('the same web session and the same device session get 403 before, 2xx after, and 403 again after the change back; nothing is called on the guard', async () => {
    const reload = vi.spyOn(permissionGuard(admin.app), 'reloadMatrix');
    const loaded = permissionGuard(admin.app).matrix();
    const sessionsBefore = (await storedSessions(owner)).filter((session) => session.operatorId === TECHNICIAN.id);
    expect(sessionsBefore).toHaveLength(2);
    const onWeb = (): Promise<LightMyRequestResponse> => web(admin.app, technician, 'GET', USERS);
    const onDevice = (): Promise<LightMyRequestResponse> => admin.app.inject({ method: 'GET', url: USERS, headers: technicianOnDevice });
    const permissionsOf = async (session: Headers): Promise<{ role: string; userAdmin: boolean }> => {
      const body = (await admin.app.inject({ method: 'GET', url: SESSION, headers: session })).json() as { operator: { role: string }; permissions: string[] };
      return { role: body.operator.role, userAdmin: body.permissions.includes('USER_ADMIN') };
    };

    // Before: refused, with one row each.
    const from = await trailLength();
    expect(outcome(await onWeb())).toEqual([403, 'NOT_PERMITTED']);
    expect(outcome(await onDevice())).toEqual([403, 'NOT_PERMITTED']);
    expect((await since(from)).map((row) => row.type)).toEqual(['ACCESS_DENIED', 'ACCESS_DENIED']);
    expect(await permissionsOf(technician)).toEqual({ role: 'TECHNICIAN', userAdmin: false });

    // The change, by another operator's session.
    expect((await web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'SUPERVISOR' })).statusCode).toBe(200);

    // After: the SAME two sessions are let through, and write no denial row.
    const allowedFrom = await trailLength();
    expect((await onWeb()).statusCode).toBe(200);
    expect((await onDevice()).statusCode).toBe(200);
    expect(await trailLength()).toBe(allowedFrom);
    expect(await permissionsOf(technician)).toEqual({ role: 'SUPERVISOR', userAdmin: true });
    expect(await permissionsOf(technicianOnDevice)).toEqual({ role: 'SUPERVISOR', userAdmin: true });
    // The promoted session can use what it gained: a command, not only a read.
    expect((await web(admin.app, technician, 'POST', roleUrl(INVESTIGATOR.id), { role: 'INVESTIGATOR' })).statusCode).toBe(200);

    // And the reverse.
    expect((await web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'TECHNICIAN' })).statusCode).toBe(200);
    const deniedFrom = await trailLength();
    expect(outcome(await onWeb())).toEqual([403, 'NOT_PERMITTED']);
    expect(outcome(await onDevice())).toEqual([403, 'NOT_PERMITTED']);
    expect((await since(deniedFrom)).map((row) => [row.type, row.details])).toEqual([
      ['ACCESS_DENIED', { operationId: 'listUsers', permission: 'USER_ADMIN', role: 'TECHNICIAN' }],
      ['ACCESS_DENIED', { operationId: 'listUsers', permission: 'USER_ADMIN', role: 'TECHNICIAN' }],
    ]);

    // No new sign-in: the same two session rows, open, issued when they were.
    expect((await storedSessions(owner)).filter((session) => session.operatorId === TECHNICIAN.id)).toEqual(sessionsBefore);
    // Nothing was called on the guard, and the matrix it loaded at boot is the same object.
    expect(reload).not.toHaveBeenCalled();
    expect(permissionGuard(admin.app).matrix()).toBe(loaded);
    reload.mockRestore();
  });
});
