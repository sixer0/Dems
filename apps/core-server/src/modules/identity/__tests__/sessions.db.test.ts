// Operations 4 to 6 and the life of a session, against PostgreSQL (plan row W24; spec §5.1
// ID-P4 to ID-P9, §5.2 ID-8, ID-9, §5.4, §4.7; SR-11 to SR-13, SR-17; AC-B-26, AC-B-27). A clone
// of the seed template, the code under test as `dems_app`, a manual clock: no test waits.
import { validateCoreApiResponse } from '@dems/shared/api';
import { OPERATOR_IDS, OPERATORS, ROLE_PERMISSIONS, type AuditRow } from '@dems/shared/sim';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readEvents, readTrail } from '../../../../test/support/core';
import { authenticationOf } from '../../../plugins/authenticate';
import type { Publication } from '../../../realtime';
import {
  CLOCK_START,
  HOUR,
  MINUTE,
  SESSION,
  SIGN_OUT,
  TOUCH,
  WEB_ORIGIN,
  bearer,
  closeOpenSessions,
  deviceRegistryDouble,
  deviceSignIn,
  errorOf,
  forgetCounters,
  get,
  identityApp,
  insertPairedDevice,
  sessionOfToken,
  setCookies,
  signInOnWeb,
  storedSessions,
  webPost,
  type DeviceRegistryDouble,
  type IdentityApp,
  type StoredSession,
} from '../../../../test/support/identity';

const db = useTestDatabase({ template: 'seed' });
let identity: IdentityApp;
let owner: Pool;
let devices: DeviceRegistryDouble;
let deviceCredential: string;
const published: Publication[] = [];

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const DEVICE = 'DEV-0001';
const SCRATCH = '/api/v1/scratch';
const SCRATCH_VALIDATED = '/api/v1/scratch/validated';

beforeAll(async () => {
  owner = db.ownerPool();
  identity = await identityApp(db, {
    routes: (app) => {
      app.get(SCRATCH, { config: { operationId: 'scratchRead' } }, async () => ({ ok: true }));
      app.post(SCRATCH, { config: { operationId: 'scratchCommand' } }, async (request) => ({
        lastSeenAt: authenticationOf(request).session?.lastSeenAt ?? null,
      }));
      app
        .withTypeProvider<ZodTypeProvider>()
        .post(SCRATCH_VALIDATED, { config: { operationId: 'scratchValidated' }, schema: { body: z.object({ n: z.number() }) } }, async () => ({ ok: true }));
    },
  });
  devices = deviceRegistryDouble();
  identity.app.seams.replace('deviceResolver', devices.resolver);
  identity.app.seams.replace('publish', (publication) => void published.push(publication));
  await insertPairedDevice(owner, DEVICE, OPERATOR_IDS.ANDI, CLOCK_START);
  deviceCredential = devices.pair(DEVICE);
});

beforeEach(async () => {
  // Every test starts with no open session, fresh counters and an empty list of publications.
  await closeOpenSessions(owner);
  forgetCounters(identity);
  published.length = 0;
});

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const trailSince = async (from: number): Promise<AuditRow[]> => (await readTrail(owner)).slice(from);
const sessionById = async (id: string): Promise<StoredSession | undefined> => (await storedSessions(owner)).find((session) => session.id === id);
const sessionOf = (token: string): Promise<StoredSession> => sessionOfToken(owner, token);
const tokenOf = (response: { json(): unknown }): string => (response.json() as { sessionToken: string }).sessionToken;
const units = (): number => identity.app.pipeline.snapshot().completed;

describe('operation 4, getAuthSession', () => {
  it('answers the caller\'s own session, valid against the contract; without a session 401', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    identity.clock.advance(2 * MINUTE);
    const response = await get(identity.app, SESSION, web.cookie);
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('getAuthSession', 200, response.json())).toEqual({ ok: true });
    expect(response.json()).toEqual({
      operator: { ...SUPERVISOR },
      permissions: [...ROLE_PERMISSIONS.SUPERVISOR].sort((a, b) => permissionOrder(a) - permissionOrder(b)),
      method: 'PASSWORD',
      issuedAt: identity.clock.now() - 2 * MINUTE,
      lastActivityAt: identity.clock.now() - 2 * MINUTE,
      idleExpiresAt: identity.clock.now() + 13 * MINUTE,
      absoluteExpiresAt: identity.clock.now() - 2 * MINUTE + 8 * HOUR,
      deviceId: null,
      demoControls: false,
      serverTime: identity.clock.now(),
    });
    expect(response.headers['set-cookie']).toBeUndefined();

    const anonymous = await get(identity.app, SESSION);
    expect([anonymous.statusCode, errorOf(anonymous).code]).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('getAuthSession', 401, anonymous.json())).toEqual({ ok: true });
    const unknown = await get(identity.app, SESSION, { cookie: `${identity.cookieName}=ses_${'C'.repeat(43)}` });
    expect(unknown.statusCode).toBe(401);
  });

  it('RB-3, SR-13: a role change applies to the next request of the same session, with no new sign-in', async () => {
    const web = await signInOnWeb(identity, INVESTIGATOR.username);
    const before = (await get(identity.app, SESSION, web.cookie)).json() as { operator: { role: string }; permissions: string[] };
    expect(before.operator.role).toBe('INVESTIGATOR');
    await owner.query("UPDATE public.operators SET role_id = 'TECHNICIAN' WHERE id = $1", [INVESTIGATOR.id]);
    try {
      const after = (await get(identity.app, SESSION, web.cookie)).json() as { operator: { role: string }; permissions: string[] };
      expect(after.operator.role).toBe('TECHNICIAN');
      expect(after.permissions).toEqual([...ROLE_PERMISSIONS.TECHNICIAN].sort((a, b) => permissionOrder(a) - permissionOrder(b)));
      expect(after.permissions).not.toEqual(before.permissions);
    } finally {
      await owner.query("UPDATE public.operators SET role_id = 'INVESTIGATOR' WHERE id = $1", [INVESTIGATOR.id]);
    }
    // Nothing about the role is stored with the session: the table has no such column.
    const columns = await owner.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'auth_sessions' ORDER BY ordinal_position",
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      'id',
      'token_hash',
      'operator_id',
      'device_id',
      'method',
      'issued_at',
      'last_seen_at',
      'absolute_expires_at',
      'ended_at',
      'end_reason',
    ]);
  });

  it('a session whose operator is disabled resolves to nothing, even while its row is open', async () => {
    const web = await signInOnWeb(identity, TECHNICIAN.username);
    await owner.query('UPDATE public.operators SET enabled = false WHERE id = $1', [TECHNICIAN.id]);
    try {
      expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(401);
    } finally {
      await owner.query('UPDATE public.operators SET enabled = true WHERE id = $1', [TECHNICIAN.id]);
    }
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);
  });
});

/** The place of a permission in the permission table (its `sort_order`): the shared declaration order. */
function permissionOrder(permission: string): number {
  return [
    'SESSION_START',
    'SESSION_NOTE',
    'EVIDENCE_VIEW',
    'EVIDENCE_REVIEW',
    'EVIDENCE_EXPORT',
    'AUDIT_EXPORT',
    'DEVICE_MANAGE',
    'DIAGNOSTICS_RUN',
    'MAINTENANCE',
    'PAIRING_MANAGE',
    'USER_ADMIN',
    'DEMO_CONTROL',
  ].indexOf(permission);
}

describe('AC-B-26: idle expiry at 15 minutes, absolute expiry at 8 hours, on the server clock', () => {
  it('15 minutes without activity end the session: 401, AUTH_EXPIRED, the row ended, session.ended published', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const session = await sessionOf(web.token);
    const before = await trailLength();

    identity.clock.advance(15 * MINUTE - 1);
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);
    expect(await trailLength()).toBe(before);

    identity.clock.advance(1);
    const expired = await get(identity.app, SESSION, web.cookie);
    expect([expired.statusCode, errorOf(expired).code]).toEqual([401, 'NOT_SIGNED_IN']);

    const rows = await trailSince(before);
    expect(rows.map((row) => [row.type, row.actorId, row.deviceId, row.details, row.at])).toEqual([
      ['AUTH_EXPIRED', SUPERVISOR.id, null, { reason: 'IDLE' }, identity.clock.now()],
    ]);
    const event = (await readEvents(owner)).at(-1);
    expect([event?.type, event?.params]).toEqual(['AUTH_EXPIRED', { operatorId: SUPERVISOR.id }]);
    expect(await sessionById(session.id)).toMatchObject({ endedAt: identity.clock.now(), endReason: 'IDLE_EXPIRED' });
    expect(published).toEqual([{ kind: 'session.ended', sessionIds: [session.id], reason: 'IDLE_EXPIRED' }]);

    // Ended once: the next request writes nothing more.
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(401);
    expect(await trailSince(before)).toHaveLength(1);
  });

  it('a GET does not extend the session; a POST and touchSession do', async () => {
    const web = await signInOnWeb(identity, INVESTIGATOR.username);
    const session = await sessionOf(web.token);
    const issuedAt = identity.clock.now();

    for (const minutes of [5, 5, 4]) {
      identity.clock.advance(minutes * MINUTE);
      expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);
      expect((await get(identity.app, SCRATCH, web.cookie)).statusCode).toBe(200);
    }
    // 14 minutes of reads: the last activity is still the sign-in.
    expect((await sessionById(session.id))?.lastSeenAt).toBe(issuedAt);

    const touched = await webPost(identity.app, TOUCH, web.cookie);
    expect(touched.statusCode).toBe(200);
    expect(validateCoreApiResponse('touchSession', 200, touched.json())).toEqual({ ok: true });
    expect(touched.json()).toEqual({ idleExpiresAt: identity.clock.now() + 15 * MINUTE, absoluteExpiresAt: issuedAt + 8 * HOUR });
    expect(touched.headers['x-dems-revision']).toMatch(/^[0-9]+$/);
    expect(touched.headers['set-cookie']).toBeUndefined();
    expect((await sessionById(session.id))?.lastSeenAt).toBe(identity.clock.now());

    // 28 minutes after the sign-in, 14 after the touch: still open.
    identity.clock.advance(14 * MINUTE);
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);
    // Any POST of the operator that reaches its handler is activity.
    const command = await webPost(identity.app, SCRATCH, web.cookie, {});
    expect(command.json()).toEqual({ lastSeenAt: identity.clock.now() });
    identity.clock.advance(15 * MINUTE - 1);
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);
    identity.clock.advance(1);
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(401);
    expect(await sessionById(session.id)).toMatchObject({ endReason: 'IDLE_EXPIRED' });
  });

  it('activity is written at most once a second, and a POST that fails its validation is not activity', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const session = await sessionOf(web.token);
    const issuedAt = identity.clock.now();

    identity.clock.advance(999);
    const before = units();
    expect((await webPost(identity.app, TOUCH, web.cookie)).json()).toMatchObject({ idleExpiresAt: issuedAt + 15 * MINUTE });
    expect(units()).toBe(before);
    expect((await sessionById(session.id))?.lastSeenAt).toBe(issuedAt);

    identity.clock.advance(MINUTE);
    const refused = await webPost(identity.app, SCRATCH_VALIDATED, web.cookie, { n: 'not a number' });
    expect(refused.statusCode).toBe(422);
    expect((await sessionById(session.id))?.lastSeenAt).toBe(issuedAt);

    expect((await webPost(identity.app, SCRATCH_VALIDATED, web.cookie, { n: 1 })).statusCode).toBe(200);
    expect((await sessionById(session.id))?.lastSeenAt).toBe(identity.clock.now());
    expect(units()).toBe(before + 1);
  });

  it('8 hours end the session regardless of activity (ABSOLUTE)', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const session = await sessionOf(web.token);
    const before = await trailLength();

    // Activity every 10 minutes for 7 hours and 50 minutes.
    for (let step = 0; step < 47; step += 1) {
      identity.clock.advance(10 * MINUTE);
      expect((await webPost(identity.app, TOUCH, web.cookie)).statusCode).toBe(200);
      forgetCounters(identity);
    }
    identity.clock.advance(10 * MINUTE - 1);
    const last = await webPost(identity.app, TOUCH, web.cookie);
    expect(last.statusCode).toBe(200);
    // The absolute limit is not moved by activity.
    expect((last.json() as { absoluteExpiresAt: number }).absoluteExpiresAt).toBe(session.issuedAt + 8 * HOUR);

    identity.clock.advance(1);
    expect(identity.clock.now()).toBe(session.issuedAt + 8 * HOUR);
    const expired = await webPost(identity.app, TOUCH, web.cookie);
    expect([expired.statusCode, errorOf(expired).code]).toEqual([401, 'NOT_SIGNED_IN']);
    expect((await trailSince(before)).map((row) => [row.type, row.details])).toEqual([['AUTH_EXPIRED', { reason: 'ABSOLUTE' }]]);
    expect(await sessionById(session.id)).toMatchObject({ endedAt: identity.clock.now(), endReason: 'ABSOLUTE_EXPIRED' });
    expect(published.at(-1)).toEqual({ kind: 'session.ended', sessionIds: [session.id], reason: 'ABSOLUTE_EXPIRED' });
  });

  it('a touch never revives a session that is past its limit', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const session = await sessionOf(web.token);
    identity.clock.advance(15 * MINUTE);
    const outcome = await identity.control.touch(session.id);
    expect(outcome).toEqual({ status: 'ENDED' });
    expect(await sessionById(session.id)).toMatchObject({ lastSeenAt: session.issuedAt, endReason: 'IDLE_EXPIRED' });
    // And a session that ended stays ended.
    expect(await identity.control.touch(session.id)).toEqual({ status: 'ENDED' });
    expect(await identity.control.touch('00000000-0000-4000-8000-000000000000')).toEqual({ status: 'ENDED' });
  });
});

describe('the sweeper (ID-P8)', () => {
  it('ends every session past a limit with one AUTH_EXPIRED row each, publishes them by reason, and does nothing a second time', async () => {
    // One session that is kept active for 8 hours; then a fresh web session and a device session.
    const old = await signInOnWeb(identity, INVESTIGATOR.username);
    const oldSession = await sessionOf(old.token);
    for (let step = 0; step < 47; step += 1) {
      identity.clock.advance(10 * MINUTE);
      expect((await webPost(identity.app, TOUCH, old.cookie)).statusCode).toBe(200);
      forgetCounters(identity);
    }
    const fresh = await signInOnWeb(identity, SUPERVISOR.username);
    const freshSession = await sessionOf(fresh.token);
    const deviceToken = tokenOf(await deviceSignIn(identity.app, deviceCredential, TECHNICIAN.username));
    const deviceSession = await sessionOf(deviceToken);

    // 8 hours after the first sign-in: its last activity is 10 minutes old, its absolute limit is reached.
    identity.clock.advance(10 * MINUTE);
    const before = await trailLength();
    published.length = 0;
    const ended = await identity.control.sweep();
    expect(ended.map((session) => [session.id, session.endReason])).toEqual([[oldSession.id, 'ABSOLUTE_EXPIRED']]);
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['AUTH_EXPIRED', INVESTIGATOR.id, { reason: 'ABSOLUTE' }],
    ]);
    expect(published).toEqual([{ kind: 'session.ended', sessionIds: [oldSession.id], reason: 'ABSOLUTE_EXPIRED' }]);
    expect((await get(identity.app, SESSION, fresh.cookie)).statusCode).toBe(200);

    // Five more minutes: the two others are 15 minutes idle.
    identity.clock.advance(5 * MINUTE);
    published.length = 0;
    const second = await identity.control.sweep();
    expect(new Set(second.map((session) => session.id))).toEqual(new Set([freshSession.id, deviceSession.id]));
    expect(new Set(second.map((session) => session.endReason))).toEqual(new Set(['IDLE_EXPIRED']));
    const rows = (await trailSince(before)).slice(1);
    expect(rows.map((row) => row.type)).toEqual(['AUTH_EXPIRED', 'AUTH_EXPIRED']);
    expect(new Set(rows.map((row) => `${row.actorId} ${row.deviceId} ${String(row.details['reason'])}`))).toEqual(
      new Set([`${SUPERVISOR.id} null IDLE`, `${TECHNICIAN.id} ${DEVICE} IDLE`]),
    );
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ kind: 'session.ended', reason: 'IDLE_EXPIRED' });

    expect((await get(identity.app, SESSION, fresh.cookie)).statusCode).toBe(401);
    expect((await get(identity.app, SESSION, bearer(deviceToken))).statusCode).toBe(401);

    // Nothing left to end: no row, no publication, and not even a unit of work.
    const after = await trailLength();
    const completed = units();
    published.length = 0;
    expect(await identity.control.sweep()).toEqual([]);
    expect(await trailLength()).toBe(after);
    expect(units()).toBe(completed);
    expect(published).toEqual([]);
  });

  it('a session past both limits is ended as ABSOLUTE: the absolute limit wins, by the sweeper and by a request alike', async () => {
    const swept = await signInOnWeb(identity, SUPERVISOR.username);
    const requested = await signInOnWeb(identity, INVESTIGATOR.username);
    const [sweptSession, requestedSession] = [await sessionOf(swept.token), await sessionOf(requested.token)];
    identity.clock.advance(8 * HOUR);
    const before = await trailLength();

    expect((await get(identity.app, SESSION, requested.cookie)).statusCode).toBe(401);
    expect(await sessionById(requestedSession.id)).toMatchObject({ endReason: 'ABSOLUTE_EXPIRED' });
    const ended = await identity.control.sweep();
    expect(ended.map((session) => [session.id, session.endReason])).toEqual([[sweptSession.id, 'ABSOLUTE_EXPIRED']]);
    expect((await trailSince(before)).map((row) => row.details)).toEqual([{ reason: 'ABSOLUTE' }, { reason: 'ABSOLUTE' }]);
  });

  it('does not run in an app that does not listen', () => {
    expect(identity.control.sweeper.running).toBe(false);
  });
});

describe('AC-B-27: operation 5, signOut', () => {
  it('a web console: 204, the cookie cleared with the same name and attributes and Max-Age=0, the token unusable, AUTH_SIGNED_OUT', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const session = await sessionOf(web.token);
    const before = await trailLength();
    published.length = 0;
    identity.clock.advance(MINUTE);

    const response = await webPost(identity.app, SIGN_OUT, web.cookie);
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    const cookies = setCookies(response);
    expect(cookies).toHaveLength(1);
    const [pair, ...attributes] = (cookies[0] ?? '').split('; ');
    expect(pair).toBe(`${identity.cookieName}=`);
    expect([...attributes].sort()).toEqual(['HttpOnly', 'Max-Age=0', 'Path=/', 'SameSite=Strict']);
    expect(response.headers['x-dems-epoch']).toMatch(/^[0-9]+$/);

    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.deviceId, row.details, row.message])).toEqual([
      ['AUTH_SIGNED_OUT', SUPERVISOR.id, null, { reason: 'USER' }, 'Operator signed out'],
    ]);
    const event = (await readEvents(owner)).at(-1);
    expect([event?.type, event?.params]).toEqual(['AUTH_LOGOUT', { operatorId: SUPERVISOR.id, reason: 'USER' }]);
    expect(await sessionById(session.id)).toMatchObject({ endedAt: identity.clock.now(), endReason: 'SIGNED_OUT' });
    expect(published).toEqual([{ kind: 'session.ended', sessionIds: [session.id], reason: 'SIGNED_OUT' }]);

    // The token is unusable at once, for a read and for a second sign-out; no second row.
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(401);
    const again = await webPost(identity.app, SIGN_OUT, web.cookie);
    expect([again.statusCode, errorOf(again).code]).toEqual([401, 'NOT_SIGNED_IN']);
    expect(await trailSince(before)).toHaveLength(1);
  });

  it('"Lock console": the reason LOCK is written to the row', async () => {
    const web = await signInOnWeb(identity, INVESTIGATOR.username);
    const before = await trailLength();
    const response = await webPost(identity.app, SIGN_OUT, web.cookie, { reason: 'LOCK' });
    expect(response.statusCode).toBe(204);
    expect((await trailSince(before)).map((row) => [row.type, row.details, row.message])).toEqual([
      ['AUTH_SIGNED_OUT', { reason: 'LOCK' }, 'Console locked by operator'],
    ]);
  });

  it('a device: 204 and NO Set-Cookie header; the bearer token is unusable; the row carries the device', async () => {
    const token = tokenOf(await deviceSignIn(identity.app, deviceCredential, INVESTIGATOR.username));
    const before = await trailLength();

    const response = await identity.app.inject({ method: 'POST', url: SIGN_OUT, headers: bearer(token) });
    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.deviceId])).toEqual([['AUTH_SIGNED_OUT', INVESTIGATOR.id, DEVICE]]);
    expect((await get(identity.app, SESSION, bearer(token))).statusCode).toBe(401);
    // The device itself is still paired: its credential still reads its lock state.
    expect((await get(identity.app, '/api/v1/auth/status', bearer(deviceCredential))).statusCode).toBe(200);
  });

  it('a body that breaks its schema answers 422 and leaves the session open; without a session the answer is 401, whatever the body', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const before = await trailLength();
    const invalid = await webPost(identity.app, SIGN_OUT, web.cookie, { reason: 'BECAUSE' });
    expect([invalid.statusCode, errorOf(invalid).code]).toEqual([422, 'INVALID_INPUT']);
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);

    const anonymous = await identity.app.inject({ method: 'POST', url: SIGN_OUT, headers: { origin: WEB_ORIGIN }, payload: { reason: 'BECAUSE' } });
    expect([anonymous.statusCode, errorOf(anonymous).code]).toEqual([401, 'NOT_SIGNED_IN']);
    const anonymousTouch = await identity.app.inject({ method: 'POST', url: TOUCH, headers: { origin: WEB_ORIGIN } });
    expect([anonymousTouch.statusCode, errorOf(anonymousTouch).code]).toEqual([401, 'NOT_SIGNED_IN']);
    expect(await trailLength()).toBe(before);
  });
});

describe('the seam sessionRegistry: what other modules end', () => {
  it('endForOperator ends every open session of the operator inside the caller\'s unit, returns their IDs and writes no row of its own', async () => {
    const one = await signInOnWeb(identity, TECHNICIAN.username);
    const first = await sessionOf(one.token);
    const two = await signInOnWeb(identity, TECHNICIAN.username);
    const second = await sessionOf(two.token);
    const other = await signInOnWeb(identity, SUPERVISOR.username);
    const before = await trailLength();
    identity.clock.advance(1_000);

    const ended = await identity.app.pipeline.run('test.disableUser', (unit) => identity.app.sessionRegistry.endForOperator(unit, TECHNICIAN.id, 'USER_DISABLED'));
    expect(new Set(ended)).toEqual(new Set([first.id, second.id]));
    expect(await trailLength()).toBe(before);
    for (const id of [first.id, second.id]) {
      expect(await sessionById(id)).toMatchObject({ endedAt: identity.clock.now(), endReason: 'USER_DISABLED' });
    }
    expect((await get(identity.app, SESSION, one.cookie)).statusCode).toBe(401);
    expect((await get(identity.app, SESSION, two.cookie)).statusCode).toBe(401);
    expect((await get(identity.app, SESSION, other.cookie)).statusCode).toBe(200);
    // A second call finds nothing open.
    expect(await identity.app.pipeline.run('test.disableUser', (unit) => identity.app.sessionRegistry.endForOperator(unit, TECHNICIAN.id, 'USER_DISABLED'))).toEqual([]);
  });

  it('a unit that rolls back ends nothing', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    await expect(
      identity.app.pipeline.run('test.rollback', async (unit) => {
        await identity.app.sessionRegistry.endForOperator(unit, SUPERVISOR.id, 'USER_DISABLED');
        throw new Error('the caller changed its mind');
      }),
    ).rejects.toThrow('the caller changed its mind');
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);
  });

  it('endForDevice ends the device\'s sessions; their tokens then answer 403 DEVICE_REVOKED, the web session of the same operator stays', async () => {
    const web = await signInOnWeb(identity, INVESTIGATOR.username);
    const token = tokenOf(await deviceSignIn(identity.app, deviceCredential, INVESTIGATOR.username));
    const session = await sessionOf(token);

    const ended = await identity.app.pipeline.run('test.revokeDevice', (unit) => identity.app.sessionRegistry.endForDevice(unit, DEVICE, 'DEVICE_REVOKED'));
    expect(ended).toEqual([session.id]);
    expect(await sessionById(session.id)).toMatchObject({ endReason: 'DEVICE_REVOKED' });

    // The registry double still says PAIRED: the session's own end reason already retires it.
    const refused = await get(identity.app, SESSION, bearer(token));
    expect([refused.statusCode, errorOf(refused).code]).toEqual([403, 'DEVICE_REVOKED']);
    expect(refused.headers['set-cookie']).toBeUndefined();
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);
  });

  it('endBiometricSessions ends only BIOMETRIC sessions of that device and operator (TOKEN_REUSE)', async () => {
    const password = await sessionOf(tokenOf(await deviceSignIn(identity.app, deviceCredential, SUPERVISOR.username)));
    // A BIOMETRIC session as plan row W41 will issue it, written here as a fixture row.
    await owner.query(
      "INSERT INTO public.auth_sessions (token_hash, operator_id, device_id, method, issued_at, last_seen_at, absolute_expires_at) VALUES ($1, $2, $3, 'BIOMETRIC', $4, $4, $5)",
      [Buffer.alloc(32, 9), SUPERVISOR.id, DEVICE, identity.clock.now(), identity.clock.now() + 8 * HOUR],
    );
    const biometric = (await storedSessions(owner)).find((session) => session.method === 'BIOMETRIC' && session.endedAt === null)!;

    const ended = await identity.app.pipeline.run('test.tokenReuse', (unit) => identity.app.sessionRegistry.endBiometricSessions(unit, DEVICE, SUPERVISOR.id));
    expect(ended).toEqual([biometric.id]);
    expect(await sessionById(biometric.id)).toMatchObject({ endReason: 'TOKEN_REUSE' });
    expect(await sessionById(password.id)).toMatchObject({ endedAt: null });
  });
});

describe('SR-17: sessions are rows', () => {
  it('a second app on the same database resolves a session the first one issued (a restart), and its lockout starts fresh', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await identity.app.inject({ method: 'POST', url: '/api/v1/auth/sign-in', headers: { origin: WEB_ORIGIN }, payload: { username: 'x', password: 'y' } });
    }
    expect((await get(identity.app, '/api/v1/auth/status')).json()).toMatchObject({ locked: true });

    const restarted = await identityApp(db);
    restarted.clock.set(identity.clock.now());
    const response = await get(restarted.app, SESSION, web.cookie);
    expect(response.statusCode).toBe(200);
    expect((response.json() as { operator: { id: string } }).operator.id).toBe(SUPERVISOR.id);
    // SR-25: the counters are memory state.
    expect((await get(restarted.app, '/api/v1/auth/status')).json()).toMatchObject({ locked: false, attemptsRemaining: 5 });
    await restarted.app.close();
  });
});
