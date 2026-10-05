// Operations 13 and 14 against PostgreSQL, through the real stages 3 to 6 and the real identity
// routes (plan row W33; spec §4.6 RB-8, §4.7, §5.2 ID-3 and ID-4, §5.4, §7.6, §13.1; SR-12,
// SR-47; AC-B-20 (the session and sign-in part), AC-B-21 for a disable; module gate MODG).
//
// The real app factory on a clone of the seed, as `dems_app`, booted with the engine on a manual
// timer. A disabled operator's sessions are real sessions (a web console and a paired device);
// "the next sign-in" is a real sign-in through `POST /api/v1/auth/sign-in`. That a socket of an
// ended session is closed with 4401 within 1 s is the realtime row's (W42): what is asserted
// here is the publication it acts on.
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { validateCoreApiResponse, type AdminUser } from '@dems/shared/api';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { SESSION, TOUCH, cookieValue, deviceSignIn, errorOf, insertPairedDevice, storedSessions, webSignIn, type Headers } from '../../../../test/support/identity';
import {
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  USERS,
  adminApp,
  disableUrl,
  enableUrl,
  forgetCounters,
  outcome,
  publicationLines,
  putOperator,
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
let supervisor: Headers;
/** The credential of the paired device `DEV-0001`. */
let deviceCredential: string;

const DEVICE = 'DEV-0001';
const OTHER_DEVICE = 'DEV-0002';
const WEB = 'http://127.0.0.1:5173';
const MARKER = 'MARK-w33-status on leave until further notice';
const DAY = 24 * 60 * 60_000;

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const since = async (from: number) => (await readTrail(owner)).slice(from);
const user = (response: LightMyRequestResponse): AdminUser => response.json() as AdminUser;
const sessionsOf = async (operatorId: string) => (await storedSessions(owner)).filter((session) => session.operatorId === operatorId);

/** A digest of every credential row, computed by the database: the hash set itself is never read into the test. */
async function credentialDigest(): Promise<string> {
  const { rows } = await owner.query<{ digest: string }>(
    "SELECT md5(string_agg(operator_id || ':' || encode(salt, 'hex') || ':' || encode(hash, 'hex') || ':' || hashed_at::text, ',' ORDER BY operator_id)) AS digest FROM public.operator_credentials",
  );
  return rows[0]?.digest ?? '';
}

interface StoredToken {
  readonly operatorId: string;
  readonly deviceId: string;
  readonly used: boolean;
  readonly revokedAt: number | null;
  readonly revokeReason: string | null;
}

async function storedTokens(): Promise<StoredToken[]> {
  const { rows } = await owner.query<{ operator_id: string; device_id: string; used_at: string | null; revoked_at: string | null; revoke_reason: string | null }>(
    'SELECT operator_id, device_id, used_at, revoked_at, revoke_reason FROM public.biometric_tokens ORDER BY operator_id, device_id, issued_at',
  );
  return rows.map((row) => ({
    operatorId: row.operator_id,
    deviceId: row.device_id,
    used: row.used_at !== null,
    revokedAt: row.revoked_at === null ? null : Number(row.revoked_at),
    revokeReason: row.revoke_reason,
  }));
}

/** A fixture row of `biometric_tokens`, as `dems_owner`. The hash is not the hash of any token. */
async function insertToken(operatorId: string, deviceId: string, fill: number, issuedAt: number, usedAt: number | null): Promise<void> {
  await owner.query(
    'INSERT INTO public.biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at, used_at) VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, $6)',
    [Buffer.alloc(32, fill), deviceId, operatorId, issuedAt, issuedAt + 30 * DAY, usedAt],
  );
}

/** Everything a refusal must leave as it was (the last activity of a session excepted: a POST is activity, ID-P9). */
async function everything() {
  return {
    operators: await storedOperators(owner),
    sessions: (await storedSessions(owner)).map(({ lastSeenAt: _activity, ...session }) => session),
    tokens: await storedTokens(),
    trail: await trailLength(),
    events: (await readEvents(owner)).length,
    revision: admin.app.engine.revision,
  };
}

beforeAll(async () => {
  owner = db.ownerPool();
  admin = await adminApp(db);
  await insertPairedDevice(owner, DEVICE, SUPERVISOR.id, admin.clock.now());
  await insertPairedDevice(owner, OTHER_DEVICE, SUPERVISOR.id, admin.clock.now());
  deviceCredential = admin.devices.pair(DEVICE);
  admin.devices.pair(OTHER_DEVICE);
  supervisor = await signInWeb(admin, SUPERVISOR.username);
  await admin.app.pipeline.drain();
});

beforeEach(() => {
  forgetCounters(admin);
  admin.published.length = 0;
});

afterEach(async () => {
  // Every test leaves the three operators enabled, in their seeded roles, with no open session
  // but the SUPERVISOR's, and no biometric token.
  await admin.app.pipeline.drain();
  for (const [id, role] of [
    [INVESTIGATOR.id, 'INVESTIGATOR'],
    [SUPERVISOR.id, 'SUPERVISOR'],
    [TECHNICIAN.id, 'TECHNICIAN'],
  ] as const) {
    await putOperator(owner, id, { role, enabled: true });
  }
  await owner.query("UPDATE public.auth_sessions SET ended_at = issued_at, end_reason = 'SIGNED_OUT' WHERE ended_at IS NULL AND operator_id <> $1", [SUPERVISOR.id]);
  await owner.query('DELETE FROM public.biometric_tokens');
  await admin.app.engine.mirrorOperators();
});

describe('AC-B-20, SR-12: disabling a user ends the sessions in the same unit; the next request answers 401, the next sign-in the generic 401, and USER_DISABLED is written', () => {
  it('a user with a web session, a device session and biometric tokens is disabled: one unit, one row, the publications after the commit', async () => {
    const onWeb = await signInWeb(admin, INVESTIGATOR.username);
    const onDevice = await signInDevice(admin, deviceCredential, INVESTIGATOR.username);
    const issued = admin.clock.now();
    await insertToken(INVESTIGATOR.id, DEVICE, 1, issued, null); // live
    await insertToken(INVESTIGATOR.id, OTHER_DEVICE, 2, issued, null); // live, on another device
    await insertToken(INVESTIGATOR.id, OTHER_DEVICE, 3, issued - DAY, issued - DAY + 1); // used before: history
    await insertToken(TECHNICIAN.id, DEVICE, 4, issued, null); // another operator's
    // Both sessions work.
    expect((await web(admin.app, onWeb, 'GET', SESSION)).statusCode).toBe(200);
    expect((await admin.app.inject({ method: 'GET', url: SESSION, headers: onDevice })).statusCode).toBe(200);
    const before = await everything();
    const open = await sessionsOf(INVESTIGATOR.id);
    expect(open.filter((session) => session.endedAt === null)).toHaveLength(2);
    admin.published.length = 0;

    admin.clock.advance(1_000);
    const response = await web(admin.app, supervisor, 'POST', disableUrl(INVESTIGATOR.id), { reason: ` ${MARKER} ` });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('disableUser', 200, response.json())).toEqual({ ok: true });
    expect(user(response)).toEqual({ ...INVESTIGATOR, enabled: false, lastSignInAt: issued, activeSessions: 0, roleChangedAt: null });

    // The operator row: the flag and `updated_at`, nothing else.
    expect(await storedOperator(owner, INVESTIGATOR.id)).toEqual({ ...before.operators[0], enabled: false, updatedAt: admin.clock.now() });
    // SR-12: every open session of the operator is ended, with the reason, at the server clock's time.
    const ended = await sessionsOf(INVESTIGATOR.id);
    expect(ended.map((session) => [session.id, session.endedAt, session.endReason])).toEqual(open.map((session) => [session.id, admin.clock.now(), 'USER_DISABLED']));
    // Nobody else's session was touched.
    expect((await sessionsOf(SUPERVISOR.id)).every((session) => session.endedAt === null)).toBe(true);
    // The live biometric tokens of the operator are revoked; a used one is history; another operator's stays.
    expect(await storedTokens()).toEqual([
      { operatorId: INVESTIGATOR.id, deviceId: DEVICE, used: false, revokedAt: admin.clock.now(), revokeReason: 'USER_DISABLED' },
      { operatorId: INVESTIGATOR.id, deviceId: OTHER_DEVICE, used: true, revokedAt: null, revokeReason: null },
      { operatorId: INVESTIGATOR.id, deviceId: OTHER_DEVICE, used: false, revokedAt: admin.clock.now(), revokeReason: 'USER_DISABLED' },
      { operatorId: TECHNICIAN.id, deviceId: DEVICE, used: false, revokedAt: null, revokeReason: null },
    ]);

    // Exactly one audit row, with the number of sessions ended, and no event.
    const rows = await since(before.trail);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'USER_DISABLED',
      category: 'SECURITY',
      severity: 'WARNING',
      actorId: SUPERVISOR.id,
      deviceId: null,
      at: admin.clock.now(),
      message: 'Operator OPR-001 disabled; sessions ended: 2',
      details: { targetOperatorId: INVESTIGATOR.id, sessionsEnded: 2, reason: MARKER },
    });
    expect((await readEvents(owner)).length).toBe(before.events);
    const trail = await readTrail(owner);
    expect(linkProblems(trail)).toEqual([]);
    const head = await readHead(owner);
    expect(verifyTrail(trail, head)).toEqual({ ok: true, checked: trail.length, head: head.hash });

    // After the commit: the row as a state change, then `session.ended` with exactly those
    // sessions, then the list hint. The `operators` slice holds no `enabled` flag (spec §9.5),
    // so the mirror publishes nothing.
    expect(publicationLines(admin.published)).toEqual([`state native r${before.revision + 1}: append audit[USER_DISABLED]`, 'session.ended USER_DISABLED [2 sessions]', 'admin.changed USERS']);
    const publication = admin.published.find((entry) => entry.kind === 'session.ended');
    expect(publication?.kind === 'session.ended' ? [...publication.sessionIds].sort() : null).toEqual(open.map((session) => session.id).sort());
    expect(response.headers['x-dems-epoch']).toBe(String(admin.app.engine.epoch));
    expect(Number(response.headers['x-dems-revision'])).toBe(before.revision + 1);
    expect(admin.app.engine.slice('operators')).toHaveLength(3);

    // THE NEXT REQUEST of each ended session: 401 NOT_SIGNED_IN, read or command, and no row for it.
    const afterDisable = await trailLength();
    for (const answer of [
      await web(admin.app, onWeb, 'GET', SESSION),
      await web(admin.app, onWeb, 'POST', TOUCH),
      await web(admin.app, onWeb, 'GET', USERS),
      await admin.app.inject({ method: 'GET', url: SESSION, headers: onDevice }),
      await admin.app.inject({ method: 'POST', url: TOUCH, headers: onDevice }),
    ]) {
      expect(outcome(answer)).toEqual([401, 'NOT_SIGNED_IN']);
    }
    expect(await trailLength()).toBe(afterDisable);

    // THE NEXT SIGN-IN, with the right password: the generic 401, the same as a wrong password of
    // an enabled operator in everything but the request ID and the attempts that are left.
    const refused = await webSignIn(admin.app, INVESTIGATOR.username);
    const wrong = await webSignIn(admin.app, TECHNICIAN.username, `${DEMO_OPERATOR_PASSWORD}-not`);
    expect(outcome(refused)).toEqual([401, 'INVALID_CREDENTIALS']);
    expect(outcome(wrong)).toEqual([401, 'INVALID_CREDENTIALS']);
    expect(errorOf(refused).message).toBe(errorOf(wrong).message);
    expect(Object.keys(errorOf(refused).details ?? {})).toEqual(['attemptsRemaining']);
    expect(Object.keys(errorOf(refused)).sort()).toEqual(Object.keys(errorOf(wrong)).sort());
    expect(cookieValue(refused, admin.cookieName)).toBeNull();
    expect(outcome(await deviceSignIn(admin.app, deviceCredential, INVESTIGATOR.username))).toEqual([401, 'INVALID_CREDENTIALS']);
    // The attempt is audited, and its row says why (ID-4); no session was issued.
    const attempts = (await since(afterDisable)).filter((row) => row.actorId === INVESTIGATOR.id);
    expect(attempts.map((row) => [row.type, row.details['reason']])).toEqual([
      ['AUTH_FAILED', 'USER_DISABLED'],
      ['AUTH_FAILED', 'USER_DISABLED'],
    ]);
    expect((await sessionsOf(INVESTIGATOR.id)).filter((session) => session.endedAt === null)).toEqual([]);
    // The reason is in the row; no log line carries it.
    expect(admin.log.text()).not.toContain('MARK-w33-status');
  });

  it('a user without a session is disabled: 200, sessionsEnded 0, and no session.ended publication', async () => {
    const before = await everything();
    const response = await web(admin.app, supervisor, 'POST', disableUrl(TECHNICIAN.id));
    expect(response.statusCode).toBe(200);
    expect(user(response)).toMatchObject({ id: TECHNICIAN.id, enabled: false, activeSessions: 0 });
    const rows = await since(before.trail);
    expect(rows.map((row) => [row.type, row.details])).toEqual([['USER_DISABLED', { targetOperatorId: TECHNICIAN.id, sessionsEnded: 0 }]]);
    expect(publicationLines(admin.published)).toEqual([`state native r${before.revision + 1}: append audit[USER_DISABLED]`, 'admin.changed USERS']);
  });

  it('already disabled: 200 with the operator, and NOTHING else: no row, no publication, no changed time', async () => {
    expect((await web(admin.app, supervisor, 'POST', disableUrl(TECHNICIAN.id))).statusCode).toBe(200);
    const before = await everything();
    admin.published.length = 0;
    admin.clock.advance(1_000);
    const response = await web(admin.app, supervisor, 'POST', disableUrl(TECHNICIAN.id), { reason: 'again' });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('disableUser', 200, response.json())).toEqual({ ok: true });
    expect(user(response)).toMatchObject({ id: TECHNICIAN.id, enabled: false });
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
    expect(Number(response.headers['x-dems-revision'])).toBe(before.revision);
  });

  it('404, 422, 400, 401 and 403: each valid against the contract, and nothing changed', async () => {
    const technician = await signInWeb(admin, TECHNICIAN.username);
    const before = await everything();
    const unknown = await web(admin.app, supervisor, 'POST', disableUrl('OPR-999'), {});
    expect(outcome(unknown)).toEqual([404, 'NOT_FOUND']);
    expect(validateCoreApiResponse('disableUser', 404, unknown.json())).toEqual({ ok: true });
    for (const [url, body, where] of [
      [disableUrl('OPR-03'), {}, 'params'],
      [disableUrl(TECHNICIAN.id), { reason: 'x'.repeat(501) }, 'body'],
    ] as const) {
      const invalid = await web(admin.app, supervisor, 'POST', url, body);
      expect(outcome(invalid)).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(invalid).details).toEqual({ in: where });
      expect(validateCoreApiResponse('disableUser', 422, invalid.json())).toEqual({ ok: true });
    }
    const malformed = await admin.app.inject({ method: 'POST', url: disableUrl(TECHNICIAN.id), headers: { ...supervisor, origin: WEB, 'content-type': 'application/json' }, payload: '[1]' });
    expect(outcome(malformed)).toEqual([400, 'INVALID_JSON']);
    expect(validateCoreApiResponse('disableUser', 400, malformed.json())).toEqual({ ok: true });
    const anonymous = await admin.app.inject({ method: 'POST', url: disableUrl(TECHNICIAN.id), headers: { origin: WEB } });
    expect(outcome(anonymous)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('disableUser', 401, anonymous.json())).toEqual({ ok: true });
    expect(await everything()).toEqual(before);

    // A TECHNICIAN tries to disable the SUPERVISOR: refused by the guard with its one row.
    const denied = await web(admin.app, technician, 'POST', disableUrl(SUPERVISOR.id), { reason: 7 });
    expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(denied).details).toEqual({ operationId: 'disableUser', permission: 'USER_ADMIN', role: 'TECHNICIAN' });
    expect(validateCoreApiResponse('disableUser', 403, denied.json())).toEqual({ ok: true });
    expect((await since(before.trail)).map((row) => [row.type, row.actorId])).toEqual([['ACCESS_DENIED', TECHNICIAN.id]]);
    expect(await storedOperators(owner)).toEqual(before.operators);
  });
});

describe('AC-B-21, RB-8: disabling the last enabled SUPERVISOR answers 409 LAST_ADMIN and changes nothing', () => {
  it('the only SUPERVISOR cannot disable itself: 409, valid against the contract; no session is ended, no token revoked, no row, no publication', async () => {
    await insertToken(SUPERVISOR.id, DEVICE, 5, admin.clock.now(), null);
    expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id]);
    const before = await everything();
    admin.clock.advance(1_000);
    const response = await web(admin.app, supervisor, 'POST', disableUrl(SUPERVISOR.id), { reason: 'leaving' });
    expect(outcome(response)).toEqual([409, 'LAST_ADMIN']);
    expect(errorOf(response).message).toBe('At least one enabled operator must keep user administration.');
    expect(validateCoreApiResponse('disableUser', 409, response.json())).toEqual({ ok: true });
    expect(response.headers['x-dems-revision']).toBeUndefined();
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
    // The session that asked is still a session, and still holds user administration.
    expect((await web(admin.app, supervisor, 'GET', USERS)).statusCode).toBe(200);
  });

  it('a second SUPERVISOR that is disabled does not count: still 409; an INVESTIGATOR or a TECHNICIAN can always be disabled', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'SUPERVISOR', enabled: false });
    expect(outcome(await web(admin.app, supervisor, 'POST', disableUrl(SUPERVISOR.id)))).toEqual([409, 'LAST_ADMIN']);
    expect((await web(admin.app, supervisor, 'POST', disableUrl(INVESTIGATOR.id))).statusCode).toBe(200);
    expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id]);
  });

  it('with a second ENABLED SUPERVISOR the first may be disabled by the second, who is then the last', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'SUPERVISOR', enabled: true });
    const second = await signInWeb(admin, TECHNICIAN.username);
    const extra = await signInWeb(admin, SUPERVISOR.username);
    try {
      const response = await web(admin.app, second, 'POST', disableUrl(SUPERVISOR.id));
      expect(response.statusCode).toBe(200);
      expect(await storedAdministrators(owner)).toEqual([TECHNICIAN.id]);
      // The disabled SUPERVISOR's sessions are gone, so it cannot answer in kind.
      expect(outcome(await web(admin.app, extra, 'POST', disableUrl(TECHNICIAN.id)))).toEqual([401, 'NOT_SIGNED_IN']);
      expect(outcome(await web(admin.app, second, 'POST', disableUrl(TECHNICIAN.id)))).toEqual([409, 'LAST_ADMIN']);
      expect(await storedAdministrators(owner)).toEqual([TECHNICIAN.id]);
    } finally {
      // The file's own SUPERVISOR session was ended by this test: a new one for the tests that follow.
      await putOperator(owner, SUPERVISOR.id, { role: 'SUPERVISOR', enabled: true });
      forgetCounters(admin);
      supervisor = await signInWeb(admin, SUPERVISOR.username);
    }
  });
});

describe('an operator disabling the OWN account: allowed unless it is the last administrator', () => {
  it('a SUPERVISOR beside another one disables itself: 200 with the operator; its own sessions are ended by its own request, and the row names it as actor and as target', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'SUPERVISOR', enabled: true });
    // The fixture changed a role behind the server's back: the engine's slice follows first.
    await admin.app.engine.mirrorOperators();
    const own = await signInWeb(admin, TECHNICIAN.username);
    const ownDevice = await signInDevice(admin, deviceCredential, TECHNICIAN.username);
    const from = await trailLength();
    admin.published.length = 0;
    const response = await web(admin.app, own, 'POST', disableUrl(TECHNICIAN.id), { reason: 'handing the shift over' });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('disableUser', 200, response.json())).toEqual({ ok: true });
    expect(user(response)).toMatchObject({ id: TECHNICIAN.id, enabled: false, activeSessions: 0 });
    // The identity module alone sets and clears the session cookie: this answer carries none.
    expect(response.headers['set-cookie']).toBeUndefined();
    expect((await since(from)).filter((row) => row.type === 'USER_DISABLED').map((row) => [row.actorId, row.details])).toEqual([
      [TECHNICIAN.id, { targetOperatorId: TECHNICIAN.id, sessionsEnded: 2, reason: 'handing the shift over' }],
    ]);
    expect(publicationLines(admin.published).slice(1)).toEqual(['session.ended USER_DISABLED [2 sessions]', 'admin.changed USERS']);
    // Its next request, on either client: 401.
    expect(outcome(await web(admin.app, own, 'GET', SESSION))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcome(await admin.app.inject({ method: 'GET', url: SESSION, headers: ownDevice }))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id]);
  });
});

describe('operation 13 enableUser', () => {
  it('200: a disabled operator is enabled; USER_ENABLED is written; the operator can sign in again, and the sessions that were ended stay ended', async () => {
    const earlier = new Set((await sessionsOf(INVESTIGATOR.id)).map((session) => session.id));
    const old = await signInWeb(admin, INVESTIGATOR.username);
    /** The session rows of this test: those that did not exist before it. */
    const mine = async () => (await sessionsOf(INVESTIGATOR.id)).filter((session) => !earlier.has(session.id));
    await insertToken(INVESTIGATOR.id, DEVICE, 6, admin.clock.now(), null);
    expect((await web(admin.app, supervisor, 'POST', disableUrl(INVESTIGATOR.id))).statusCode).toBe(200);
    expect(outcome(await webSignIn(admin.app, INVESTIGATOR.username))).toEqual([401, 'INVALID_CREDENTIALS']);
    forgetCounters(admin);
    const before = await everything();
    admin.published.length = 0;

    admin.clock.advance(1_000);
    const response = await web(admin.app, supervisor, 'POST', enableUrl(INVESTIGATOR.id), { reason: 'Back from leave' });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('enableUser', 200, response.json())).toEqual({ ok: true });
    expect(user(response)).toMatchObject({ ...INVESTIGATOR, enabled: true, activeSessions: 0, roleChangedAt: null });
    expect(await storedOperator(owner, INVESTIGATOR.id)).toEqual({ ...before.operators[0], enabled: true, updatedAt: admin.clock.now() });

    const rows = await since(before.trail);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'USER_ENABLED',
      category: 'SECURITY',
      severity: 'INFO',
      actorId: SUPERVISOR.id,
      deviceId: null,
      at: admin.clock.now(),
      message: 'Operator OPR-001 enabled',
      details: { targetOperatorId: INVESTIGATOR.id, reason: 'Back from leave' },
    });
    expect((await readEvents(owner)).length).toBe(before.events);
    expect(publicationLines(admin.published)).toEqual([`state native r${before.revision + 1}: append audit[USER_ENABLED]`, 'admin.changed USERS']);
    expect(Number(response.headers['x-dems-revision'])).toBe(before.revision + 1);
    expect(response.headers['x-dems-epoch']).toBe(String(admin.app.engine.epoch));

    // An enable gives nothing back: the ended sessions stay ended and the revoked token stays revoked.
    expect(outcome(await web(admin.app, old, 'GET', SESSION))).toEqual([401, 'NOT_SIGNED_IN']);
    expect((await mine()).map((session) => session.endReason)).toEqual(['USER_DISABLED']);
    expect((await storedTokens()).map((token) => token.revokeReason)).toEqual(['USER_DISABLED']);

    // A REAL sign-in through the identity routes: the web console, then a paired device.
    const again = await webSignIn(admin.app, INVESTIGATOR.username);
    expect(again.statusCode).toBe(200);
    const token = cookieValue(again, admin.cookieName);
    expect(token).not.toBeNull();
    const fresh = { cookie: `${admin.cookieName}=${String(token)}` };
    const session = await web(admin.app, fresh, 'GET', SESSION);
    expect(session.statusCode).toBe(200);
    expect((session.json() as { operator: { id: string; role: string } }).operator).toMatchObject({ id: INVESTIGATOR.id, role: 'INVESTIGATOR' });
    expect((await deviceSignIn(admin.app, deviceCredential, INVESTIGATOR.username)).statusCode).toBe(200);
    expect((await mine()).map((entry) => entry.endReason)).toEqual(['USER_DISABLED', null, null]);
  });

  it('already enabled: 200 with the operator, and NOTHING else', async () => {
    const before = await everything();
    admin.clock.advance(1_000);
    const response = await web(admin.app, supervisor, 'POST', enableUrl(TECHNICIAN.id), { reason: 'again' });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('enableUser', 200, response.json())).toEqual({ ok: true });
    expect(user(response)).toMatchObject({ id: TECHNICIAN.id, enabled: true });
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
    expect(Number(response.headers['x-dems-revision'])).toBe(before.revision);
  });

  it('404, 422, 400, 401 and 403: each valid against the contract, and nothing changed', async () => {
    const investigator = await signInWeb(admin, INVESTIGATOR.username);
    await putOperator(owner, TECHNICIAN.id, { role: 'TECHNICIAN', enabled: false });
    const before = await everything();
    const unknown = await web(admin.app, supervisor, 'POST', enableUrl('OPR-999'));
    expect(outcome(unknown)).toEqual([404, 'NOT_FOUND']);
    expect(validateCoreApiResponse('enableUser', 404, unknown.json())).toEqual({ ok: true });
    for (const [url, body, where] of [
      [enableUrl('opr-003'), {}, 'params'],
      [enableUrl(TECHNICIAN.id), { reason: 'x'.repeat(501) }, 'body'],
    ] as const) {
      const invalid = await web(admin.app, supervisor, 'POST', url, body);
      expect(outcome(invalid)).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(invalid).details).toEqual({ in: where });
      expect(validateCoreApiResponse('enableUser', 422, invalid.json())).toEqual({ ok: true });
    }
    const malformed = await admin.app.inject({ method: 'POST', url: enableUrl(TECHNICIAN.id), headers: { ...supervisor, origin: WEB, 'content-type': 'application/json' }, payload: '{"reason"' });
    expect(outcome(malformed)).toEqual([400, 'INVALID_JSON']);
    expect(validateCoreApiResponse('enableUser', 400, malformed.json())).toEqual({ ok: true });
    const anonymous = await admin.app.inject({ method: 'POST', url: enableUrl(TECHNICIAN.id), headers: { origin: WEB } });
    expect(outcome(anonymous)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('enableUser', 401, anonymous.json())).toEqual({ ok: true });
    expect(await everything()).toEqual(before);

    const denied = await web(admin.app, investigator, 'POST', enableUrl(TECHNICIAN.id));
    expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(denied).details).toEqual({ operationId: 'enableUser', permission: 'USER_ADMIN', role: 'INVESTIGATOR' });
    expect(validateCoreApiResponse('enableUser', 403, denied.json())).toEqual({ ok: true });
    expect((await since(before.trail)).map((row) => [row.type, row.actorId])).toEqual([['ACCESS_DENIED', INVESTIGATOR.id]]);
    expect((await storedOperator(owner, TECHNICIAN.id)).enabled).toBe(false);
  });
});

describe('no password handling: operations 11 to 14 define none', () => {
  it('a role change, a disable and an enable leave every credential row as it was', async () => {
    const before = await credentialDigest();
    expect(before).toMatch(/^[0-9a-f]{32}$/);
    expect((await web(admin.app, supervisor, 'POST', `${USERS}/${TECHNICIAN.id}/role`, { role: 'INVESTIGATOR' })).statusCode).toBe(200);
    expect((await web(admin.app, supervisor, 'POST', disableUrl(TECHNICIAN.id))).statusCode).toBe(200);
    expect((await web(admin.app, supervisor, 'POST', enableUrl(TECHNICIAN.id))).statusCode).toBe(200);
    expect(await credentialDigest()).toBe(before);
    // The operator still signs in with the password it had.
    expect((await webSignIn(admin.app, TECHNICIAN.username)).statusCode).toBe(200);
  });
});
