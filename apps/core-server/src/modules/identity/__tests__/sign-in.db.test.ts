// Operation 2, `signIn`, against PostgreSQL (plan row W24; spec §5.1, §5.2 ID-1 to ID-7, §7.5;
// SR-05 to SR-10, SR-18, SR-22, SR-23, SR-69; AC-B-23, AC-B-24, AC-B-25, AC-B-30). A clone of
// the seed template, the code under test as `dems_app`, a manual clock, no listener.
//
// The seeded operators are signed in with the shared demo constant, imported by name; no
// credential, token or cookie value appears in a test name, a message or a log line (P19).
import { createHash } from 'node:crypto';
import { validateCoreApiResponse } from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD, OPERATOR_IDS, OPERATORS, ROLE_PERMISSIONS } from '@dems/shared/sim';
import type { AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readEvents, readTrail } from '../../../../test/support/core';
import type { Publication } from '../../../realtime';
import { throttleControl } from '../../../plugins/throttle';
import { PASSWORD_HASH_PARAMETERS, createPasswordHasher, deriveArgon2id } from '../password-hash';
import {
  CLOCK_START,
  FOREIGN_ORIGIN,
  MINUTE,
  OWN_ORIGIN,
  SESSION,
  SIGN_IN,
  STATUS,
  WEB_ORIGIN,
  bearer,
  cookieValue,
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
  webSignIn,
  type DeviceRegistryDouble,
  type IdentityApp,
} from '../../../../test/support/identity';

const db = useTestDatabase({ template: 'seed' });
let identity: IdentityApp;
let owner: Pool;
let devices: DeviceRegistryDouble;
let deviceCredential: string;
const published: Publication[] = [];

const SUPERVISOR = OPERATORS[1]!;
const INVESTIGATOR = OPERATORS[0]!;
const TECHNICIAN = OPERATORS[2]!;
const DEVICE = 'DEV-0001';
/** A username no operator has. It must be in no row afterwards. */
const UNKNOWN_USERNAME = 'nobody.w24-marker';
const WRONG_PASSWORD = 'not-the-password-w24';

beforeAll(async () => {
  owner = db.ownerPool();
  identity = await identityApp(db);
  devices = deviceRegistryDouble();
  identity.app.seams.replace('deviceResolver', devices.resolver);
  identity.app.seams.replace('publish', (publication) => void published.push(publication));
  await insertPairedDevice(owner, DEVICE, OPERATOR_IDS.ANDI, CLOCK_START);
  deviceCredential = devices.pair(DEVICE);
});

beforeEach(() => {
  forgetCounters(identity);
  published.length = 0;
});

/** The audit rows written since `from`. */
async function trailSince(from: number): Promise<AuditRow[]> {
  return (await readTrail(owner)).slice(from);
}
const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const derivations = (): number => identity.derive.mock.calls.length;

/** A failure body with the one member that differs from request to request blanked. */
const withoutRequestId = (response: LightMyRequestResponse): string =>
  response.body.replace(/"requestId":"[0-9a-f-]{36}"/, '"requestId":"-"');

describe('AC-B-23: a web console signs in', () => {
  it('sets dems_session_<listen port> with exactly HttpOnly; SameSite=Strict; Path=/ and puts no token into the body', async () => {
    const before = await trailLength();
    const response = await webSignIn(identity.app, SUPERVISOR.username);

    expect(response.statusCode).toBe(200);
    const cookies = setCookies(response);
    expect(cookies).toHaveLength(1);
    const [pair, ...attributes] = (cookies[0] ?? '').split('; ');
    expect(pair?.startsWith('dems_session_4420=ses_')).toBe(true);
    expect([...attributes].sort()).toEqual(['HttpOnly', 'Path=/', 'SameSite=Strict']);
    expect(cookies[0]).not.toMatch(/secure|domain|max-age|expires|__host-/i);

    const token = cookieValue(response, identity.cookieName) ?? '';
    expect(token).toMatch(/^ses_[A-Za-z0-9_-]{43}$/);
    // The body holds the session and nothing that is, or looks like, a token.
    const body = response.json() as { session: { operator: { id: string }; deviceId: string | null; method: string }; sessionToken?: string };
    expect(Object.keys(body)).toEqual(['session']);
    expect(response.body.includes(token)).toBe(false);
    expect(response.body).not.toMatch(/ses_|dvc_|bio_/);
    expect(validateCoreApiResponse('signIn', 200, body)).toEqual({ ok: true });
    expect(body.session.operator.id).toBe(SUPERVISOR.id);
    expect(body.session.deviceId).toBeNull();
    expect(body.session.method).toBe('PASSWORD');

    // API-7: the state revision of the engine, as non-negative integers.
    expect(response.headers['x-dems-epoch']).toMatch(/^[0-9]+$/);
    expect(response.headers['x-dems-revision']).toMatch(/^[0-9]+$/);

    // One audit row and its event; the row names the operator, the method and no device.
    const rows = await trailSince(before);
    expect(rows.map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['AUTH_SUCCESS', SUPERVISOR.id, null, { method: 'PASSWORD' }],
    ]);
    const event = (await readEvents(owner)).at(-1);
    expect([event?.type, event?.params]).toEqual(['AUTH_LOGIN', { operatorId: SUPERVISOR.id, method: 'PASSWORD' }]);
  });

  it('stores only the SHA-256 of the token, 32 bytes, and answers the session with the role and its permissions as read now', async () => {
    const web = await signInOnWeb(identity, INVESTIGATOR.username);
    const digest = createHash('sha256').update(web.token, 'utf8').digest();
    const stored = await owner.query<{ id: string; device_id: string | null; method: string }>(
      'SELECT id, device_id, method FROM public.auth_sessions WHERE token_hash = $1',
      [digest],
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]).toMatchObject({ device_id: null, method: 'PASSWORD' });
    const session = (await storedSessions(owner)).find((row) => row.id === stored.rows[0]?.id);
    expect(session).toMatchObject({
      operatorId: INVESTIGATOR.id,
      issuedAt: identity.clock.now(),
      lastSeenAt: identity.clock.now(),
      absoluteExpiresAt: identity.clock.now() + 8 * 60 * MINUTE,
      endedAt: null,
      endReason: null,
      tokenHashBytes: 32,
    });

    const info = (web.response.json() as { session: Record<string, unknown> }).session;
    expect(info).toMatchObject({
      operator: { ...INVESTIGATOR },
      permissions: [...ROLE_PERMISSIONS.INVESTIGATOR],
      issuedAt: identity.clock.now(),
      lastActivityAt: identity.clock.now(),
      idleExpiresAt: identity.clock.now() + 15 * MINUTE,
      absoluteExpiresAt: identity.clock.now() + 8 * 60 * MINUTE,
      demoControls: false,
      serverTime: identity.clock.now(),
    });
    const lastSignIn = await owner.query<{ last_sign_in_at: string }>('SELECT last_sign_in_at FROM public.operators WHERE id = $1', [INVESTIGATOR.id]);
    expect(Number(lastSignIn.rows[0]?.last_sign_in_at)).toBe(identity.clock.now());
  });

  it('a second sign-in ends the presented session (ROTATED), and the old cookie no longer resolves', async () => {
    const first = await signInOnWeb(identity, SUPERVISOR.username);
    const before = await trailLength();
    identity.clock.advance(1_000);

    const second = await webSignIn(identity.app, TECHNICIAN.username, DEMO_OPERATOR_PASSWORD, first.cookie);
    expect(second.statusCode).toBe(200);
    const newToken = cookieValue(second, identity.cookieName) ?? '';
    expect(newToken).not.toBe(first.token);

    const rows = await trailSince(before);
    expect(rows.map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['AUTH_SUCCESS', TECHNICIAN.id, { method: 'PASSWORD', replaced: true }],
    ]);
    const rotated = await sessionOfToken(owner, first.token);
    expect(rotated).toMatchObject({ operatorId: SUPERVISOR.id, endedAt: identity.clock.now(), endReason: 'ROTATED' });
    expect(published).toEqual([{ kind: 'session.ended', sessionIds: [rotated.id], reason: 'ROTATED' }]);

    expect((await get(identity.app, SESSION, first.cookie)).statusCode).toBe(401);
    const current = await get(identity.app, SESSION, { cookie: `${identity.cookieName}=${newToken}` });
    expect(current.statusCode).toBe(200);
    expect((current.json() as { operator: { id: string } }).operator.id).toBe(TECHNICIAN.id);
  });

  it('a sign-in that presents no valid session ends nothing', async () => {
    await signInOnWeb(identity, SUPERVISOR.username);
    const open = (await storedSessions(owner)).filter((session) => session.endedAt === null).length;
    const before = await trailLength();
    const stale = await webSignIn(identity.app, SUPERVISOR.username, DEMO_OPERATOR_PASSWORD, {
      cookie: `${identity.cookieName}=ses_${'A'.repeat(43)}`,
    });
    expect(stale.statusCode).toBe(200);
    expect((await trailSince(before)).map((row) => row.details)).toEqual([{ method: 'PASSWORD' }]);
    expect((await storedSessions(owner)).filter((session) => session.endedAt === null)).toHaveLength(open + 1);
    expect(published).toEqual([]);
  });
});

describe('AC-B-23: a paired device signs in', () => {
  it('gets the token in the body, bound to the device, and no Set-Cookie header at all', async () => {
    const before = await trailLength();
    const response = await deviceSignIn(identity.app, deviceCredential, INVESTIGATOR.username);

    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    const body = response.json() as { session: { deviceId: string | null; operator: { id: string } }; sessionToken?: string };
    expect(validateCoreApiResponse('signIn', 200, body)).toEqual({ ok: true });
    expect(body.sessionToken).toMatch(/^ses_[A-Za-z0-9_-]{43}$/);
    expect(body.session.deviceId).toBe(DEVICE);

    const stored = await sessionOfToken(owner, body.sessionToken ?? '');
    expect(stored).toMatchObject({ operatorId: INVESTIGATOR.id, deviceId: DEVICE, method: 'PASSWORD', endedAt: null, tokenHashBytes: 32 });
    const rows = await trailSince(before);
    expect(rows.map((row) => [row.type, row.actorId, row.deviceId])).toEqual([['AUTH_SUCCESS', INVESTIGATOR.id, DEVICE]]);

    // The token is a bearer credential of this device, and of nothing else (ID-13).
    const asBearer = await get(identity.app, SESSION, bearer(body.sessionToken ?? ''));
    expect(asBearer.statusCode).toBe(200);
    expect(asBearer.headers['set-cookie']).toBeUndefined();
    const asCookie = await get(identity.app, SESSION, { cookie: `${identity.cookieName}=${body.sessionToken ?? ''}` });
    expect(asCookie.statusCode).toBe(401);
  });

  it('a sign-in that presents the device\'s own session token is the device\'s console too, and that session is rotated', async () => {
    const first = (await deviceSignIn(identity.app, deviceCredential, INVESTIGATOR.username)).json() as { sessionToken: string };
    const before = await trailLength();
    identity.clock.advance(1_000);

    const response = await identity.app.inject({
      method: 'POST',
      url: SIGN_IN,
      headers: bearer(first.sessionToken),
      payload: { username: SUPERVISOR.username, password: DEMO_OPERATOR_PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    const body = response.json() as { session: { deviceId: string | null; operator: { id: string } }; sessionToken: string };
    expect(body.sessionToken).not.toBe(first.sessionToken);
    expect(body.session).toMatchObject({ deviceId: DEVICE, operator: { id: SUPERVISOR.id } });

    expect(await sessionOfToken(owner, first.sessionToken)).toMatchObject({ endReason: 'ROTATED', endedAt: identity.clock.now() });
    expect(await sessionOfToken(owner, body.sessionToken)).toMatchObject({ operatorId: SUPERVISOR.id, deviceId: DEVICE, endedAt: null });
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['AUTH_SUCCESS', SUPERVISOR.id, DEVICE, { method: 'PASSWORD', replaced: true }],
    ]);
    expect((await get(identity.app, SESSION, bearer(first.sessionToken))).statusCode).toBe(401);
  });

  it('a web session token sent as a bearer value resolves to nothing', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const response = await get(identity.app, SESSION, bearer(web.token));
    expect(response.statusCode).toBe(401);
    expect(errorOf(response).code).toBe('NOT_SIGNED_IN');
    // The row is not ended by that attempt.
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);
  });
});

describe('ID-1, SR-69: who may sign in at all', () => {
  const body = { username: SUPERVISOR.username, password: DEMO_OPERATOR_PASSWORD };

  it.each([
    ['no Origin and no device credential', {}],
    ['the instance\'s own origin and no device credential', { origin: OWN_ORIGIN }],
  ])('%s: 403 DEVICE_NOT_PAIRED, no attempt, no derivation, no row, no cookie', async (_name, headers) => {
    const before = await trailLength();
    const calls = derivations();
    const response = await identity.app.inject({ method: 'POST', url: SIGN_IN, headers, payload: body });
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toMatchObject({ code: 'DEVICE_NOT_PAIRED' });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(derivations()).toBe(calls);
    expect(await trailLength()).toBe(before);
    expect(await identity.control.lockout.status('web', identity.clock.now())).toMatchObject({ attemptsRemaining: 5, locked: false });
  });

  it('an unknown device credential is no console identity either', async () => {
    const response = await identity.app.inject({ method: 'POST', url: SIGN_IN, headers: bearer(`dvc_${'B'.repeat(43)}`), payload: body });
    expect(response.statusCode).toBe(403);
    expect(errorOf(response).code).toBe('DEVICE_NOT_PAIRED');
  });

  it('the refusal comes before the body is read: malformed JSON and a missing member still answer 403', async () => {
    const malformed = await identity.app.inject({
      method: 'POST',
      url: SIGN_IN,
      headers: { 'content-type': 'application/json' },
      payload: '{"username": "x", "password": ',
    });
    expect(malformed.statusCode).toBe(403);
    const missing = await identity.app.inject({ method: 'POST', url: SIGN_IN, headers: { origin: OWN_ORIGIN }, payload: { username: 'x' } });
    expect(missing.statusCode).toBe(403);
  });

  it('a foreign Origin, and a bearer value with a web console origin, are refused by the Origin guard before anything else', async () => {
    const foreign = await identity.app.inject({ method: 'POST', url: SIGN_IN, headers: { origin: FOREIGN_ORIGIN }, payload: body });
    expect([foreign.statusCode, errorOf(foreign).code]).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    const mixed = await identity.app.inject({ method: 'POST', url: SIGN_IN, headers: { origin: WEB_ORIGIN, ...bearer(deviceCredential) }, payload: body });
    expect([mixed.statusCode, errorOf(mixed).code]).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
  });

  it('a retired device is told so, and writes no session', async () => {
    await insertPairedDevice(owner, 'DEV-0009', OPERATOR_IDS.ANDI, CLOCK_START);
    const credential = devices.pair('DEV-0009');
    devices.retire('DEV-0009');
    const sessions = (await storedSessions(owner)).length;
    const response = await deviceSignIn(identity.app, credential, SUPERVISOR.username);
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toMatchObject({ code: 'DEVICE_REVOKED', details: { reason: 'DEVICE_REVOKED' } });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await storedSessions(owner)).toHaveLength(sessions);
    const status = await get(identity.app, STATUS, bearer(credential));
    expect([status.statusCode, errorOf(status).code]).toEqual([403, 'DEVICE_REVOKED']);
  });
});

describe('the body of signIn is validated before an attempt is taken (spec §7.3 line 8 before line 9)', () => {
  it.each([
    ['no password', 422, 'INVALID_INPUT', { username: 'budi.santoso' }],
    ['an empty username', 422, 'INVALID_INPUT', { username: '', password: 'x' }],
    ['a password of 129 characters', 422, 'INVALID_INPUT', { username: 'budi.santoso', password: 'p'.repeat(129) }],
    ['a password with U+0000', 422, 'INVALID_INPUT', { username: 'budi.santoso', password: 'a\u0000b' }],
    ['a username of 65 characters', 422, 'INVALID_INPUT', { username: 'u'.repeat(65), password: 'x' }],
  ])('%s answers %i %s and takes no attempt', async (_name, status, code, payload) => {
    const before = await trailLength();
    const calls = derivations();
    const response = await identity.app.inject({ method: 'POST', url: SIGN_IN, headers: { origin: WEB_ORIGIN }, payload });
    expect([response.statusCode, errorOf(response).code]).toEqual([status, code]);
    expect(await trailLength()).toBe(before);
    expect(derivations()).toBe(calls);
    expect(await identity.control.lockout.status('web', identity.clock.now())).toMatchObject({ attemptsRemaining: 5 });
  });

  it('malformed JSON answers 400 INVALID_JSON and takes no attempt', async () => {
    const before = await trailLength();
    const response = await identity.app.inject({
      method: 'POST',
      url: SIGN_IN,
      headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
      payload: '{"username": "budi.santoso", "password": ',
    });
    expect([response.statusCode, errorOf(response).code]).toEqual([400, 'INVALID_JSON']);
    expect(await trailLength()).toBe(before);
  });

  it('the username is trimmed and lower-cased for the lookup; the password is taken as sent', async () => {
    const padded = await webSignIn(identity.app, `  ${SUPERVISOR.username.toUpperCase()} `);
    expect(padded.statusCode).toBe(200);
    const spaced = await webSignIn(identity.app, SUPERVISOR.username, ` ${DEMO_OPERATOR_PASSWORD}`);
    expect(spaced.statusCode).toBe(401);
  });
});

describe('AC-B-24: wrong password, unknown user and disabled user cannot be told apart', () => {
  const DISABLED = TECHNICIAN;

  beforeAll(async () => {
    await owner.query('UPDATE public.operators SET enabled = false WHERE id = $1', [DISABLED.id]);
  });

  it('gives byte-identical bodies, one AUTH_FAILED row each, and exactly one Argon2id derivation per attempt', async () => {
    const cases: ReadonlyArray<readonly [name: string, username: string, password: string, row: Partial<AuditRow>]> = [
      ['wrong password', SUPERVISOR.username, WRONG_PASSWORD, { actorId: SUPERVISOR.id, details: { method: 'PASSWORD', knownOperator: true, attemptsRemaining: 4, lockedUntil: null } }],
      ['unknown user', UNKNOWN_USERNAME, DEMO_OPERATOR_PASSWORD, { actorId: null, details: { method: 'PASSWORD', knownOperator: false, attemptsRemaining: 4, lockedUntil: null } }],
      ['disabled user, wrong password', DISABLED.username, WRONG_PASSWORD, { actorId: DISABLED.id, details: { method: 'PASSWORD', knownOperator: true, attemptsRemaining: 4, lockedUntil: null, reason: 'USER_DISABLED' } }],
      ['disabled user, right password', DISABLED.username, DEMO_OPERATOR_PASSWORD, { actorId: DISABLED.id, details: { method: 'PASSWORD', knownOperator: true, attemptsRemaining: 4, lockedUntil: null, reason: 'USER_DISABLED' } }],
    ];
    const answers: LightMyRequestResponse[] = [];
    const sessions = (await storedSessions(owner)).length;

    for (const [name, username, password, row] of cases) {
      forgetCounters(identity);
      const before = await trailLength();
      const calls = derivations();
      const response = await webSignIn(identity.app, username, password);
      answers.push(response);

      expect(response.statusCode, name).toBe(401);
      expect(response.headers['set-cookie'], name).toBeUndefined();
      expect(derivations() - calls, `${name}: derivations`).toBe(1);
      const rows = await trailSince(before);
      expect(rows.map((written) => written.type), name).toEqual(['AUTH_FAILED']);
      expect(rows[0], name).toMatchObject({ severity: 'WARNING', deviceId: null, ...row });
      expect(validateCoreApiResponse('signIn', 401, response.json()), name).toEqual({ ok: true });
    }

    const [first, ...others] = answers.map(withoutRequestId);
    expect(first).toBe(
      '{"error":{"code":"INVALID_CREDENTIALS","message":"The username or the password is not correct.","details":{"attemptsRemaining":4},"requestId":"-"}}',
    );
    for (const other of others) expect(other).toBe(first);
    expect(new Set(answers.map((answer) => answer.headers['content-length'])).size).toBe(1);
    expect(new Set(answers.map((answer) => Object.keys(answer.headers).sort().join(','))).size).toBe(1);
    // No failed attempt issued a session.
    expect(await storedSessions(owner)).toHaveLength(sessions);
  });

  it('the derivation runs with the stored parameters for a known operator and with the current ones for nobody', async () => {
    identity.derive.mockClear();
    await webSignIn(identity.app, SUPERVISOR.username, WRONG_PASSWORD);
    await webSignIn(identity.app, UNKNOWN_USERNAME, WRONG_PASSWORD);
    expect(identity.derive.mock.calls.map(([request]) => [request.memoryKib, request.passes, request.parallelism, request.salt.byteLength, request.tagLength])).toEqual([
      [PASSWORD_HASH_PARAMETERS.memoryKib, PASSWORD_HASH_PARAMETERS.passes, PASSWORD_HASH_PARAMETERS.parallelism, 16, 32],
      [PASSWORD_HASH_PARAMETERS.memoryKib, PASSWORD_HASH_PARAMETERS.passes, PASSWORD_HASH_PARAMETERS.parallelism, 16, 32],
    ]);
  });

  it('the typed unknown username is in no audit row and no event', async () => {
    await webSignIn(identity.app, UNKNOWN_USERNAME, WRONG_PASSWORD);
    const trail = JSON.stringify(await readTrail(owner));
    const events = JSON.stringify(await readEvents(owner));
    expect(trail.includes(UNKNOWN_USERNAME)).toBe(false);
    expect(events.includes(UNKNOWN_USERNAME)).toBe(false);
    expect(trail.includes(WRONG_PASSWORD)).toBe(false);
  });

  it('an operator disabled between the derivation and unit 2 gets the same answer, and no session (AT-C1)', async () => {
    await owner.query('UPDATE public.operators SET enabled = true WHERE id = $1', [DISABLED.id]);
    const counted = identity.control.hasher;
    // The derivation of this one attempt is followed by the disable, committed by another connection.
    identity.control.hasher = createPasswordHasher({
      derive: async (request) => {
        const tag = await deriveArgon2id(request);
        await owner.query('UPDATE public.operators SET enabled = false WHERE id = $1', [DISABLED.id]);
        return tag;
      },
    });
    const before = await trailLength();
    const sessions = (await storedSessions(owner)).length;
    const lastSignInOf = async (): Promise<string | null> =>
      (await owner.query<{ last_sign_in_at: string | null }>('SELECT last_sign_in_at FROM public.operators WHERE id = $1', [DISABLED.id])).rows[0]
        ?.last_sign_in_at ?? null;
    const lastSignInBefore = await lastSignInOf();
    identity.clock.advance(1_000);
    try {
      const response = await webSignIn(identity.app, DISABLED.username);
      expect(response.statusCode).toBe(401);
      expect(withoutRequestId(response)).toContain('"code":"INVALID_CREDENTIALS"');
      expect(response.headers['set-cookie']).toBeUndefined();
    } finally {
      identity.control.hasher = counted;
    }
    const rows = await trailSince(before);
    expect(rows.map((row) => [row.type, row.actorId, row.details['reason']])).toEqual([['AUTH_FAILED', DISABLED.id, 'USER_DISABLED']]);
    expect(await storedSessions(owner)).toHaveLength(sessions);
    // The compare-and-set statement of unit 2 matched no row: the operator row is untouched.
    expect(await lastSignInOf()).toBe(lastSignInBefore);
  });
});

describe('AC-B-25: the lockout of a console', () => {
  it('the fifth failure locks: 423 with lockedUntil; attempts during the lock write AUTH_LOCKED and are not verified; after 60 s a correct sign-in succeeds', async () => {
    const before = await trailLength();
    const start = identity.clock.now();
    const answers: LightMyRequestResponse[] = [];
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      answers.push(await webSignIn(identity.app, attempt % 2 === 0 ? UNKNOWN_USERNAME : SUPERVISOR.username, WRONG_PASSWORD));
      identity.clock.advance(1_000);
    }
    expect(answers.map((answer) => answer.statusCode)).toEqual([401, 401, 401, 401, 423]);
    expect(answers.slice(0, 4).map((answer) => errorOf(answer).details?.['attemptsRemaining'])).toEqual([4, 3, 2, 1]);
    const lockedUntil = start + 4_000 + MINUTE;
    expect(errorOf(answers[4]!)).toMatchObject({ code: 'LOCKED', details: { lockedUntil, retryInMs: MINUTE } });
    expect(validateCoreApiResponse('signIn', 423, answers[4]!.json())).toEqual({ ok: true });

    const failed = await trailSince(before);
    expect(failed.map((row) => row.type)).toEqual(['AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED']);
    expect(failed.map((row) => [row.details['attemptsRemaining'], row.details['lockedUntil']])).toEqual([
      [4, null],
      [3, null],
      [2, null],
      [1, null],
      [0, lockedUntil],
    ]);
    expect(failed.at(-1)?.message).toBe('Sign-in failed; console locked for 60 s');

    // During the lock: the right password is not even looked at.
    const calls = derivations();
    const during = await webSignIn(identity.app, SUPERVISOR.username);
    expect(during.statusCode).toBe(423);
    expect(errorOf(during)).toMatchObject({ code: 'LOCKED', details: { lockedUntil, retryInMs: MINUTE - 1_000 } });
    expect(during.headers['set-cookie']).toBeUndefined();
    expect(derivations()).toBe(calls);
    const duringUnknown = await webSignIn(identity.app, UNKNOWN_USERNAME, WRONG_PASSWORD);
    expect(duringUnknown.statusCode).toBe(423);
    expect(withoutRequestId(duringUnknown)).toBe(withoutRequestId(during));
    const locked = (await trailSince(before)).slice(5);
    expect(locked.map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['AUTH_LOCKED', SUPERVISOR.id, { method: 'PASSWORD', retryInMs: MINUTE - 1_000, lockedUntil }],
      ['AUTH_LOCKED', null, { method: 'PASSWORD', retryInMs: MINUTE - 1_000, lockedUntil }],
    ]);

    const status = await get(identity.app, STATUS);
    expect(status.json()).toEqual({ locked: true, lockedUntil, retryInMs: MINUTE - 1_000, attemptsRemaining: 0, serverTime: identity.clock.now() });
    expect(validateCoreApiResponse('getSignInStatus', 200, status.json())).toEqual({ ok: true });

    // One millisecond before the end it still holds; at the end it is over, with a fresh count.
    identity.clock.set(lockedUntil - 1);
    expect((await webSignIn(identity.app, SUPERVISOR.username)).statusCode).toBe(423);
    identity.clock.set(lockedUntil);
    expect((await get(identity.app, STATUS)).json()).toMatchObject({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 5 });
    const after = await webSignIn(identity.app, SUPERVISOR.username);
    expect(after.statusCode).toBe(200);
  });

  it('a success clears the count; the window of 300 s starts a fresh count; each console has its own', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) await webSignIn(identity.app, SUPERVISOR.username, WRONG_PASSWORD);
    expect((await get(identity.app, STATUS)).json()).toMatchObject({ locked: false, attemptsRemaining: 1 });
    // The device is another console: its count is untouched, and it reads its own state.
    expect((await get(identity.app, STATUS, bearer(deviceCredential))).json()).toMatchObject({ locked: false, attemptsRemaining: 5 });
    expect((await deviceSignIn(identity.app, deviceCredential, SUPERVISOR.username, WRONG_PASSWORD)).statusCode).toBe(401);
    expect((await get(identity.app, STATUS, bearer(deviceCredential))).json()).toMatchObject({ attemptsRemaining: 4 });
    expect((await get(identity.app, STATUS)).json()).toMatchObject({ attemptsRemaining: 1 });

    // The fifth attempt is taken and is right: no lock, and the count is cleared.
    expect((await webSignIn(identity.app, SUPERVISOR.username)).statusCode).toBe(200);
    expect((await get(identity.app, STATUS)).json()).toMatchObject({ locked: false, attemptsRemaining: 5 });
    const next = await webSignIn(identity.app, SUPERVISOR.username, WRONG_PASSWORD);
    expect(errorOf(next).details).toEqual({ attemptsRemaining: 4 });

    // Three more failures, then 300 s pass since the window opened: a fresh count.
    throttleControl(identity.app).reset();
    for (let attempt = 0; attempt < 3; attempt += 1) await webSignIn(identity.app, SUPERVISOR.username, WRONG_PASSWORD);
    expect((await get(identity.app, STATUS)).json()).toMatchObject({ attemptsRemaining: 1 });
    identity.clock.advance(5 * MINUTE - 1);
    expect((await get(identity.app, STATUS)).json()).toMatchObject({ attemptsRemaining: 1 });
    identity.clock.advance(1);
    expect((await get(identity.app, STATUS)).json()).toMatchObject({ attemptsRemaining: 5 });
    throttleControl(identity.app).reset();
    expect(errorOf(await webSignIn(identity.app, SUPERVISOR.username, WRONG_PASSWORD)).details).toEqual({ attemptsRemaining: 4 });
  });

  it('a locked device console answers 423 to its device, and its rows carry the device ID', async () => {
    const before = await trailLength();
    const answers: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      answers.push((await deviceSignIn(identity.app, deviceCredential, INVESTIGATOR.username, WRONG_PASSWORD)).statusCode);
    }
    expect(answers).toEqual([401, 401, 401, 401, 423, 423]);
    const rows = await trailSince(before);
    expect(rows.map((row) => row.type)).toEqual(['AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_LOCKED']);
    expect(new Set(rows.map((row) => row.deviceId))).toEqual(new Set([DEVICE]));
    // The web console is not locked by the device's failures.
    expect((await webSignIn(identity.app, SUPERVISOR.username)).statusCode).toBe(200);
  });
});

describe('AC-B-30 (the query): what the sign-in verifies against', () => {
  it('every operator has one Argon2id record: 19,456 KiB, 2 passes, parallelism 1, a 16-byte salt of its own and a 32-byte hash', async () => {
    const { rows } = await owner.query<{ operator_id: string; algorithm: string; memory_kib: number; passes: number; parallelism: number; salt_bytes: number; hash_bytes: number; salts: string }>(
      'SELECT operator_id, algorithm, memory_kib, passes, parallelism, octet_length(salt) AS salt_bytes, octet_length(hash) AS hash_bytes, ' +
        '(SELECT count(DISTINCT salt) FROM public.operator_credentials) AS salts FROM public.operator_credentials ORDER BY operator_id',
    );
    expect(rows.map((row) => row.operator_id)).toEqual(OPERATORS.map((operator) => operator.id));
    for (const row of rows) {
      expect([row.algorithm, row.memory_kib, row.passes, row.parallelism, row.salt_bytes, row.hash_bytes, Number(row.salts)]).toEqual(['argon2id', 19_456, 2, 1, 16, 32, 3]);
    }
  });
});

describe('SR-06: a record with weaker parameters is replaced after a successful sign-in', () => {
  it('writes a new Argon2id record that verifies the same password; the sign-in is answered as usual', async () => {
    const real = identity.control.hasher;
    const before = await owner.query<{ hash: Buffer; salt: Buffer }>('SELECT hash, salt FROM public.operator_credentials WHERE operator_id = $1', [INVESTIGATOR.id]);
    identity.control.hasher = { ...real, needsRehash: () => true };
    identity.clock.advance(1_000);
    try {
      expect((await webSignIn(identity.app, INVESTIGATOR.username)).statusCode).toBe(200);
    } finally {
      identity.control.hasher = real;
    }
    const after = await owner.query<{ hash: Buffer; salt: Buffer; hashed_at: string; algorithm: string; memory_kib: number; passes: number; parallelism: number }>(
      'SELECT hash, salt, hashed_at, algorithm, memory_kib, passes, parallelism FROM public.operator_credentials WHERE operator_id = $1',
      [INVESTIGATOR.id],
    );
    const record = after.rows[0]!;
    expect(record.hash.equals(before.rows[0]!.hash)).toBe(false);
    expect(record.salt.equals(before.rows[0]!.salt)).toBe(false);
    expect([record.algorithm, record.memory_kib, record.passes, record.parallelism, record.salt.length, record.hash.length, Number(record.hashed_at)]).toEqual([
      'argon2id',
      19_456,
      2,
      1,
      16,
      32,
      identity.clock.now(),
    ]);
    // The new record is what the next sign-in is verified against.
    expect((await webSignIn(identity.app, INVESTIGATOR.username)).statusCode).toBe(200);
    expect((await webSignIn(identity.app, INVESTIGATOR.username, WRONG_PASSWORD)).statusCode).toBe(401);
  });

  it('a renewal that fails does not fail the sign-in; it is logged by its code', async () => {
    const real = identity.control.hasher;
    identity.control.hasher = {
      ...real,
      needsRehash: () => true,
      hashPassword: async () => {
        throw Object.assign(new Error('a message that must not be logged: marker-w24-rehash'), { code: 'DERIVATION_FAILED' });
      },
    };
    try {
      expect((await webSignIn(identity.app, SUPERVISOR.username)).statusCode).toBe(200);
    } finally {
      identity.control.hasher = real;
    }
    const line = identity.log.lines().find((entry) => entry['msg'] === 'the password hash could not be renewed; the sign-in stands');
    expect(line).toMatchObject({ level: 50, code: 'DERIVATION_FAILED', operatorId: SUPERVISOR.id });
    expect(identity.log.text().includes('marker-w24-rehash')).toBe(false);
  });
});
