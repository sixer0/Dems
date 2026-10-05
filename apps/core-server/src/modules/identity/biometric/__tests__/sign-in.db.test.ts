// Operation 8 `signInWithBiometric` against PostgreSQL (plan row W41; spec §4.7, §5.4, §5.6 steps
// 4 to 6, §7.5; SR-36, SR-37, SR-74; AC-B-31, AC-B-82 (the session end); module gate MODG for
// operation 8: every documented status the module can produce, each answer validated against
// the contract). A clone of the seed template, the code under test as `dems_app`, the real
// stages 3 to 6, the real device registry: two paired devices, each with a credential the server
// issued.
//
// No token is printed: an assertion compares forms, states and booleans (P19).
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readEvents } from '../../../../../test/support/core';
import { rateLimited, throttleControl } from '../../../../plugins/throttle';
import { disableUrl, enableUrl } from '../../../../../test/support/admin';
import {
  MINUTE,
  SESSION,
  SIGN_OUT,
  STATUS,
  closeOpenSessions,
  deviceSignIn,
  errorOf,
  sessionOfToken,
  signInOnWeb,
  storedSessions,
  type Headers,
} from '../../../../../test/support/identity';
import { deviceGet } from '../../../../../test/support/pairing';
import {
  BIO_FORM,
  BIOMETRIC_SIGN_IN,
  INVESTIGATOR,
  SES_FORM,
  SUPERVISOR,
  TECHNICIAN,
  THIRTY_DAYS,
  biometricApp,
  biometricSignIn,
  devicePost,
  enrol,
  enrolledOperator,
  expectContract,
  forgetLimits,
  madeUpToken,
  outcomeOf,
  pairDevice,
  portalPost,
  clearTokens,
  revokeUrl,
  sessionCount,
  sessionsOf,
  setEnrolment,
  shapeOf,
  signInWithToken,
  stateOf,
  storedTokens,
  supervisorCookie,
  tokenRow,
  trailLength,
  trailSince,
  type BiometricApp,
  type PairedTestDevice,
} from './support';

// A clone, a booted app and many requests: under the load of parallel rows the default limits are too short (finding F-9 of the administration row).
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const db = useTestDatabase({ template: 'seed' });
let bio: BiometricApp;
let owner: Pool;
let tablet: PairedTestDevice;
let phone: PairedTestDevice;

const NOT_ACCEPTED = 'Biometric sign-in was not accepted. Sign in with the password.';

beforeAll(async () => {
  owner = db.ownerPool();
  bio = await biometricApp(db);
  const cookie = await supervisorCookie(bio);
  tablet = await pairDevice(bio, cookie, 'Interview tablet 01');
  phone = await pairDevice(bio, cookie, 'Second tablet');
});

beforeEach(async () => {
  await bio.app.pipeline.drain();
  await clearTokens(owner);
  await closeOpenSessions(owner);
  forgetLimits(bio);
  bio.published.length = 0;
  // Each test in its own minutes of the server clock.
  bio.clock.advance(2 * MINUTE);
});

const now = (): number => bio.clock.now();
const lockState = async (credential: string): Promise<Record<string, unknown>> => (await deviceGet(bio.app, STATUS, credential)).json() as Record<string, unknown>;
const sessionAnswers = async (sessionToken: string): Promise<number> => (await deviceGet(bio.app, SESSION, sessionToken)).statusCode;
const sessionEndedPublications = (): Array<{ sessionIds: readonly string[]; reason: string }> =>
  bio.published.flatMap((publication) => (publication.kind === 'session.ended' ? [{ sessionIds: publication.sessionIds, reason: publication.reason }] : []));

/** A refused token: the one answer, and no session. */
function expectNotAccepted(response: LightMyRequestResponse, attemptsRemaining: number): void {
  expect(outcomeOf(response)).toEqual([401, 'INVALID_CREDENTIALS']);
  expect(errorOf(response)).toMatchObject({ message: NOT_ACCEPTED, details: { attemptsRemaining } });
  expect(Object.keys(response.json() as object)).toEqual(['error']);
  expectContract('signInWithBiometric', response);
  expect(response.headers['set-cookie']).toBeUndefined();
  // API-7 speaks of 2xx answers.
  expect(response.headers['x-dems-revision']).toBeUndefined();
}

describe('AC-B-31: a valid token signs in with method BIOMETRIC and is replaced', () => {
  it('answers 200 with a session bound to the device, its token and the NEXT biometric token; the used one is marked, the next is live in the same family; AUTH_SUCCESS names the method', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const before = await trailLength(owner);
    const events = (await readEvents(owner)).length;
    bio.clock.advance(5_000);

    const response = await biometricSignIn(bio.app, tablet.credential, enrolled.token);

    expect(response.statusCode).toBe(200);
    expectContract('signInWithBiometric', response);
    const body = response.json() as { session: Record<string, unknown>; sessionToken: string; biometricToken: string };
    expect(Object.keys(body).sort()).toEqual(['biometricToken', 'session', 'sessionToken']);
    expect(body.session).toMatchObject({
      method: 'BIOMETRIC',
      deviceId: tablet.deviceId,
      operator: { id: INVESTIGATOR.id, role: 'INVESTIGATOR' },
      issuedAt: now(),
      lastActivityAt: now(),
      absoluteExpiresAt: now() + 8 * 60 * MINUTE,
      serverTime: now(),
    });
    expect(SES_FORM.test(body.sessionToken)).toBe(true);
    expect(BIO_FORM.test(body.biometricToken)).toBe(true);
    expect(body.biometricToken === enrolled.token).toBe(false);
    // A device: no cookie (decision D69). API-7: the two headers of a POST.
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(Number(response.headers['x-dems-epoch'])).toBe(bio.app.engine.epoch);
    expect(Number(response.headers['x-dems-revision'])).toBe(bio.app.engine.revision);

    // One row and one event, as a password sign-in writes them, with the method.
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([
      { type: 'AUTH_SUCCESS', actorId: INVESTIGATOR.id, deviceId: tablet.deviceId, details: { method: 'BIOMETRIC' } },
    ]);
    expect((await readEvents(owner)).slice(events).map((event) => [event.type, event.params, event.deviceId])).toEqual([
      ['AUTH_LOGIN', { operatorId: INVESTIGATOR.id, method: 'BIOMETRIC' }, tablet.deviceId],
    ]);

    // The token that was sent is used; the next one is the family's live token, for 30 days.
    const used = await tokenRow(owner, enrolled.token);
    const next = await tokenRow(owner, body.biometricToken);
    expect(used).toMatchObject({ usedAt: now(), revokedAt: null });
    expect(next).toMatchObject({
      familyId: used?.familyId,
      deviceId: tablet.deviceId,
      operatorId: INVESTIGATOR.id,
      issuedAt: now(),
      expiresAt: now() + THIRTY_DAYS,
      usedAt: null,
      revokedAt: null,
      hashBytes: 32,
    });
    expect((await storedTokens(owner)).filter((token) => token.revokedAt === null).map((token) => stateOf(token, now()))).toEqual(['USED', 'LIVE']);

    // The session is real: its token resolves on the bearer transport, bound to the device.
    const session = await sessionOfToken(owner, body.sessionToken);
    expect(session).toMatchObject({ operatorId: INVESTIGATOR.id, deviceId: tablet.deviceId, method: 'BIOMETRIC', endedAt: null, tokenHashBytes: 32 });
    const own = await deviceGet(bio.app, SESSION, body.sessionToken);
    expect(own.statusCode).toBe(200);
    expect(own.json()).toMatchObject({ method: 'BIOMETRIC', deviceId: tablet.deviceId, operator: { id: INVESTIGATOR.id } });
    // The password session in which the operator enrolled was not presented: it stays open.
    expect(await sessionAnswers(enrolled.sessionToken)).toBe(200);
  });

  it('every use hands out the next token of the same family: three sign-ins, three used rows, one live', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    let token = enrolled.token;
    const seen = new Set<string>([token]);
    for (let round = 0; round < 3; round += 1) {
      bio.clock.advance(MINUTE);
      const signedIn = await signInWithToken(bio.app, tablet.credential, token);
      expect(signedIn.session.method).toBe('BIOMETRIC');
      token = signedIn.biometricToken;
      seen.add(token);
    }
    expect(seen.size).toBe(4);
    const family = (await storedTokens(owner)).filter((row) => row.revokedAt === null);
    expect(new Set(family.map((row) => row.familyId)).size).toBe(1);
    expect(family.map((row) => stateOf(row, now()))).toEqual(['USED', 'USED', 'USED', 'LIVE']);
    expect(await sessionsOf(owner, tablet.deviceId).then((rows) => rows.filter(([, , end]) => end === 'OPEN'))).toEqual([
      [INVESTIGATOR.id, 'PASSWORD', 'OPEN'],
      [INVESTIGATOR.id, 'BIOMETRIC', 'OPEN'],
      [INVESTIGATOR.id, 'BIOMETRIC', 'OPEN'],
      [INVESTIGATOR.id, 'BIOMETRIC', 'OPEN'],
    ]);
  });

  it('the token decides who signs in: the request names no operator, and a body that names one beside the token changes nothing', async () => {
    const technician = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    // What a caller adds to the body is not read: the contract's schema has the one member `token`.
    const response = await devicePost(bio.app, BIOMETRIC_SIGN_IN, tablet.credential, {
      token: technician.token,
      operatorId: SUPERVISOR.id,
      username: SUPERVISOR.username,
      method: 'PASSWORD',
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { session: { operator: { id: string }; method: string } }).session).toMatchObject({ operator: { id: TECHNICIAN.id }, method: 'BIOMETRIC' });
    expect((await sessionsOf(owner, tablet.deviceId)).filter(([operator, , end]) => operator === SUPERVISOR.id && end === 'OPEN')).toEqual([]);
  });
});

describe('AC-B-31, AC-B-82 (SR-74): a used token presented again', () => {
  it('answers the generic 401, revokes the family, ends the BIOMETRIC session with TOKEN_REUSE, publishes session.ended after the commit, writes AUTH_FAILED; every password session of that operator stays open', async () => {
    // The same operator: a password session on this device, one on another device, one on the web.
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const onOtherDevice = await enrolledOperator(bio.app, phone, INVESTIGATOR.username);
    const onWeb = await signInOnWeb(bio, INVESTIGATOR.username);
    // Another operator signed in with a token of his own on this device.
    const other = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    const otherSignedIn = await signInWithToken(bio.app, tablet.credential, other.token);
    // The same operator signed in with a token on the OTHER device.
    const elsewhere = await signInWithToken(bio.app, phone.credential, onOtherDevice.token);

    bio.clock.advance(MINUTE);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    const biometricSession = await sessionOfToken(owner, signedIn.sessionToken);
    expect(await sessionAnswers(signedIn.sessionToken)).toBe(200);
    const before = await trailLength(owner);
    const sessions = await sessionCount(owner);
    bio.published.length = 0;
    bio.clock.advance(MINUTE);

    const replay = await biometricSignIn(bio.app, tablet.credential, enrolled.token);

    expectNotAccepted(replay, 4);
    expect(await sessionCount(owner)).toBe(sessions);
    // One row: the reuse, who it concerns, what it ended.
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([
      {
        type: 'AUTH_FAILED',
        actorId: INVESTIGATOR.id,
        deviceId: tablet.deviceId,
        details: { method: 'BIOMETRIC', knownOperator: true, attemptsRemaining: 4, lockedUntil: null, reason: 'TOKEN_REUSE', sessionsEnded: 1 },
      },
    ]);
    // The whole family is revoked: the token that was used, and the one that followed it.
    const familyId = (await tokenRow(owner, enrolled.token))?.familyId;
    const family = (await storedTokens(owner)).filter((row) => row.familyId === familyId);
    expect(family.map((row) => [stateOf(row, now()), row.revokedAt])).toEqual([
      ['USED+REVOKED(TOKEN_REUSE)', now()],
      ['REVOKED(TOKEN_REUSE)', now()],
    ]);
    // The session the token had issued is ended, with the reason, at this instant.
    expect((await storedSessions(owner)).find((row) => row.id === biometricSession.id)).toMatchObject({ endedAt: now(), endReason: 'TOKEN_REUSE', method: 'BIOMETRIC' });
    expect(sessionEndedPublications()).toEqual([{ sessionIds: [biometricSession.id], reason: 'TOKEN_REUSE' }]);
    expect(await sessionAnswers(signedIn.sessionToken)).toBe(401);

    // Not touched: the password sessions of the same operator (this device, the other device, the
    // web console), the same operator's BIOMETRIC session on the other device, and another
    // operator's BIOMETRIC session on this device.
    expect(await sessionAnswers(enrolled.sessionToken)).toBe(200);
    expect(await sessionAnswers(onOtherDevice.sessionToken)).toBe(200);
    expect((await bio.app.inject({ method: 'GET', url: SESSION, headers: onWeb.cookie })).statusCode).toBe(200);
    expect(await sessionAnswers(elsewhere.sessionToken)).toBe(200);
    expect(await sessionAnswers(otherSignedIn.sessionToken)).toBe(200);
    expect((await storedSessions(owner)).filter((row) => row.endReason === 'TOKEN_REUSE')).toHaveLength(1);
    // Nor another family: the other operator's next token still signs in, and so does this operator's on the other device.
    expect((await signInWithToken(bio.app, tablet.credential, otherSignedIn.biometricToken)).session.operator.id).toBe(TECHNICIAN.id);
    expect((await signInWithToken(bio.app, phone.credential, elsewhere.biometricToken)).session.operator.id).toBe(INVESTIGATOR.id);

    // The token the rotation had handed out is dead with its family: it signs nobody in.
    forgetLimits(bio);
    const next = await biometricSignIn(bio.app, tablet.credential, signedIn.biometricToken);
    expectNotAccepted(next, 4);
    expect((await trailSince(owner, before)).at(-1)).toMatchObject({ type: 'AUTH_FAILED', actorId: INVESTIGATOR.id, details: { reason: 'TOKEN_REVOKED' } });
    expect(sessionEndedPublications().filter((publication) => publication.reason === 'TOKEN_REUSE')).toHaveLength(1);
  });

  it('a second replay is a reuse again and changes nothing more: the same answer, a row with sessionsEnded 0, no publication', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    await signInWithToken(bio.app, tablet.credential, enrolled.token);
    expectNotAccepted(await biometricSignIn(bio.app, tablet.credential, enrolled.token), 4);
    const before = await trailLength(owner);
    const tokens = await storedTokens(owner);
    bio.published.length = 0;

    expectNotAccepted(await biometricSignIn(bio.app, tablet.credential, enrolled.token), 3);

    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([
      {
        type: 'AUTH_FAILED',
        actorId: INVESTIGATOR.id,
        deviceId: tablet.deviceId,
        details: { method: 'BIOMETRIC', knownOperator: true, attemptsRemaining: 3, lockedUntil: null, reason: 'TOKEN_REUSE', sessionsEnded: 0 },
      },
    ]);
    expect(await storedTokens(owner)).toEqual(tokens);
    expect(sessionEndedPublications()).toEqual([]);
  });

  it('a used token presented by ANOTHER paired device is a reuse all the same: the sessions of the token\'s device and operator end; the row names the device that presented it', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    const before = await trailLength(owner);

    expectNotAccepted(await biometricSignIn(bio.app, phone.credential, enrolled.token), 4);

    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([
      {
        type: 'AUTH_FAILED',
        actorId: INVESTIGATOR.id,
        deviceId: phone.deviceId,
        details: { method: 'BIOMETRIC', knownOperator: true, attemptsRemaining: 4, lockedUntil: null, reason: 'TOKEN_REUSE', sessionsEnded: 1 },
      },
    ]);
    expect(await sessionAnswers(signedIn.sessionToken)).toBe(401);
    expect(await sessionAnswers(enrolled.sessionToken)).toBe(200);
    // Counted on the device that presented it, not on the token's.
    expect(await lockState(phone.credential)).toMatchObject({ attemptsRemaining: 4 });
    expect(await lockState(tablet.credential)).toMatchObject({ attemptsRemaining: 5 });
  });
});

describe('security checkpoint CPS1-7 (SR-36, SR-74): a LIVE token presented by ANOTHER paired device is handled as a reuse', () => {
  // A token is issued to one device and is never sent to another. A device that presents the live
  // token of another one shows that the token has left its device, so it must not stay usable:
  // the family is revoked and the BIOMETRIC sessions of the TOKEN's device and operator are ended,
  // through the path a used token takes. Device A is the tablet, device B the phone.
  const reuseRow = (deviceId: string, sessionsEnded: number, attemptsRemaining = 4): ReturnType<typeof shapeOf> => ({
    type: 'AUTH_FAILED',
    actorId: INVESTIGATOR.id,
    deviceId,
    details: { method: 'BIOMETRIC', knownOperator: true, attemptsRemaining, lockedUntil: null, reason: 'TOKEN_REUSE', sessionsEnded },
  });

  it('B presents A\'s live token: the generic 401; A\'s family is revoked and A\'s BIOMETRIC session ended with TOKEN_REUSE, published after the commit; A\'s password session, B\'s sessions and enrolment and every other family stay; ONE row; the token then fails on A too', async () => {
    // Device A: the investigator's password session, the enrolment, a BIOMETRIC session. The live token of the family is the rotated one.
    const onA = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedInOnA = await signInWithToken(bio.app, tablet.credential, onA.token);
    const liveOnA = signedInOnA.biometricToken;
    // Another operator with a BIOMETRIC session and a family of his own on A.
    const other = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    const otherSignedIn = await signInWithToken(bio.app, tablet.credential, other.token);
    // Device B: the SAME operator's password session, enrolment and BIOMETRIC session; and the web console.
    const onB = await enrolledOperator(bio.app, phone, INVESTIGATOR.username);
    const signedInOnB = await signInWithToken(bio.app, phone.credential, onB.token);
    const onWeb = await signInOnWeb(bio, INVESTIGATOR.username);

    const sessionOnA = await sessionOfToken(owner, signedInOnA.sessionToken);
    expect(stateOf(await tokenRow(owner, liveOnA), now())).toBe('LIVE');
    // What B is answered for a value that is no token at all, to hold the answer against.
    const unknown = await biometricSignIn(bio.app, phone.credential, madeUpToken('k'));
    expectNotAccepted(unknown, 4);
    forgetLimits(bio);
    bio.clock.advance(MINUTE);
    const tokensOfB = (await storedTokens(owner)).filter((row) => row.deviceId === phone.deviceId);
    const sessionsOfB = await sessionsOf(owner, phone.deviceId);
    const before = await trailLength(owner);
    const sessions = await sessionCount(owner);
    bio.published.length = 0;

    const presented = await biometricSignIn(bio.app, phone.credential, liveOnA);

    // The presenter learns nothing new: the generic refusal, word for word what a value that is no token gets.
    expectNotAccepted(presented, 4);
    expect({ ...errorOf(presented), requestId: null }).toEqual({ ...errorOf(unknown), requestId: null });
    expect(await sessionCount(owner)).toBe(sessions);

    // ONE row: the token's operator, the device that presented it, the reason of a reuse and what it ended.
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([reuseRow(phone.deviceId, 1)]);
    // A's family is revoked whole, at this instant: the token that was used and the live one.
    const familyId = (await tokenRow(owner, liveOnA))?.familyId;
    expect((await storedTokens(owner)).filter((row) => row.familyId === familyId).map((row) => [row.deviceId, row.operatorId, stateOf(row, now()), row.revokedAt])).toEqual([
      [tablet.deviceId, INVESTIGATOR.id, 'USED+REVOKED(TOKEN_REUSE)', now()],
      [tablet.deviceId, INVESTIGATOR.id, 'REVOKED(TOKEN_REUSE)', now()],
    ]);
    // A's BIOMETRIC session is ended as a reuse ends it, and its sockets are told so after the commit.
    expect((await storedSessions(owner)).find((row) => row.id === sessionOnA.id)).toMatchObject({ deviceId: tablet.deviceId, method: 'BIOMETRIC', endedAt: now(), endReason: 'TOKEN_REUSE' });
    expect(sessionEndedPublications()).toEqual([{ sessionIds: [sessionOnA.id], reason: 'TOKEN_REUSE' }]);
    expect(await sessionAnswers(signedInOnA.sessionToken)).toBe(401);
    expect((await storedSessions(owner)).filter((row) => row.endedAt === now()).map((row) => row.id)).toEqual([sessionOnA.id]);

    // Not touched on A: the operator's PASSWORD session, and the other operator's BIOMETRIC session.
    expect(await sessionAnswers(onA.sessionToken)).toBe(200);
    expect(await sessionAnswers(otherSignedIn.sessionToken)).toBe(200);
    // Not touched on B: its sessions, by password and by token, and its enrolment, row for row. Nor the web console.
    expect(await sessionAnswers(onB.sessionToken)).toBe(200);
    expect(await sessionAnswers(signedInOnB.sessionToken)).toBe(200);
    expect(await sessionsOf(owner, phone.deviceId)).toEqual(sessionsOfB);
    expect((await storedTokens(owner)).filter((row) => row.deviceId === phone.deviceId)).toEqual(tokensOfB);
    expect((await bio.app.inject({ method: 'GET', url: SESSION, headers: onWeb.cookie })).statusCode).toBe(200);
    // Counted on the device that presented it, not on the token's.
    expect(await lockState(phone.credential)).toMatchObject({ attemptsRemaining: 4 });
    expect(await lockState(tablet.credential)).toMatchObject({ attemptsRemaining: 5 });

    // The token then fails on A too: it is revoked, it signs nobody in, and nothing more is ended.
    const onItsOwnDevice = await biometricSignIn(bio.app, tablet.credential, liveOnA);
    expectNotAccepted(onItsOwnDevice, 4);
    expect((await trailSince(owner, before)).map(shapeOf).slice(1)).toEqual([
      { type: 'AUTH_FAILED', actorId: INVESTIGATOR.id, deviceId: tablet.deviceId, details: { method: 'BIOMETRIC', knownOperator: true, attemptsRemaining: 4, lockedUntil: null, reason: 'TOKEN_REVOKED' } },
    ]);
    expect(await sessionCount(owner)).toBe(sessions);
    expect(sessionEndedPublications()).toHaveLength(1);
    // The other families are as good as before: B's own token signs in on B, the other operator's on A.
    expect((await signInWithToken(bio.app, phone.credential, signedInOnB.biometricToken)).session).toMatchObject({ deviceId: phone.deviceId, operator: { id: INVESTIGATOR.id } });
    expect((await signInWithToken(bio.app, tablet.credential, otherSignedIn.biometricToken)).session.operator.id).toBe(TECHNICIAN.id);
  });

  it('a live token that was never used: the family is that one token; it is revoked, no session is ended (sessionsEnded 0), nothing is published; the operator\'s password session stays and the token is dead on its own device', async () => {
    const onA = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const before = await trailLength(owner);

    expectNotAccepted(await biometricSignIn(bio.app, phone.credential, onA.token), 4);

    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([reuseRow(phone.deviceId, 0)]);
    expect(await tokenRow(owner, onA.token)).toMatchObject({ deviceId: tablet.deviceId, usedAt: null, revokedAt: now(), revokeReason: 'TOKEN_REUSE' });
    expect(sessionEndedPublications()).toEqual([]);
    expect(await sessionAnswers(onA.sessionToken)).toBe(200);
    expectNotAccepted(await biometricSignIn(bio.app, tablet.credential, onA.token), 4);
    // Presented by B a second time it is a dead token of another device: a plain refusal that changes nothing.
    const tokens = await storedTokens(owner);
    expectNotAccepted(await biometricSignIn(bio.app, phone.credential, onA.token), 3);
    expect((await trailSince(owner, before)).map((row) => [row.deviceId, row.details['reason'], row.details['sessionsEnded']])).toEqual([
      [phone.deviceId, 'TOKEN_REUSE', 0],
      [tablet.deviceId, 'TOKEN_REVOKED', undefined],
      [phone.deviceId, 'OTHER_DEVICE', undefined],
    ]);
    expect(await storedTokens(owner)).toEqual(tokens);
    // The operator enrols again in the password session and signs in with the new token.
    const fresh = await enrol(bio.app, onA.sessionToken);
    expect((await signInWithToken(bio.app, tablet.credential, fresh.token)).session.method).toBe('BIOMETRIC');
  });

  it('with no place left in the denial budget the row of that change is written all the same; the answer is the budget\'s 429', async () => {
    const onA = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedInOnA = await signInWithToken(bio.app, tablet.credential, onA.token);
    const before = await trailLength(owner);
    const spy = vi.spyOn(bio.app.denialBudget, 'consume').mockRejectedValueOnce(rateLimited(41));
    let presented: LightMyRequestResponse;
    try {
      presented = await biometricSignIn(bio.app, phone.credential, signedInOnA.biometricToken);
    } finally {
      spy.mockRestore();
    }

    expect(outcomeOf(presented)).toEqual([429, 'RATE_LIMITED']);
    expect(presented.headers['retry-after']).toBe('41');
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([reuseRow(phone.deviceId, 1)]);
    expect(await sessionOfToken(owner, signedInOnA.sessionToken)).toMatchObject({ endedAt: now(), endReason: 'TOKEN_REUSE' });
    expect(stateOf(await tokenRow(owner, signedInOnA.biometricToken), now())).toBe('REVOKED(TOKEN_REUSE)');
  });

  it('only the holder of a token\'s value can cause it: B presenting values that are no token of A, however often, ends nothing on A', async () => {
    const onA = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedInOnA = await signInWithToken(bio.app, tablet.credential, onA.token);
    const tokens = await storedTokens(owner);
    // A value of the form, the token with one character changed, and the token in another letter case.
    const last = signedInOnA.biometricToken.slice(-1);
    const nearly = `${signedInOnA.biometricToken.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
    for (const [index, value] of [madeUpToken('n'), nearly, signedInOnA.biometricToken.toUpperCase(), ` ${signedInOnA.biometricToken}`].entries()) {
      expectNotAccepted(await biometricSignIn(bio.app, phone.credential, value), 4 - index);
    }
    expect(await storedTokens(owner)).toEqual(tokens);
    expect(sessionEndedPublications()).toEqual([]);
    expect(await sessionAnswers(signedInOnA.sessionToken)).toBe(200);
    expect((await signInWithToken(bio.app, tablet.credential, signedInOnA.biometricToken)).session.deviceId).toBe(tablet.deviceId);
  });
});

describe('no request without a valid token creates a session: every refusal path', () => {
  /** Runs one refused sign-in and returns its row. No session row is written by it. */
  async function refused(credential: string, token: string, attemptsRemaining = 4): Promise<ReturnType<typeof shapeOf>> {
    const before = await trailLength(owner);
    const sessions = await sessionCount(owner);
    const tokens = (await storedTokens(owner)).length;
    const response = await biometricSignIn(bio.app, credential, token);
    expectNotAccepted(response, attemptsRemaining);
    expect(await sessionCount(owner)).toBe(sessions);
    expect((await storedTokens(owner)).length).toBe(tokens);
    const rows = await trailSince(owner, before);
    expect(rows).toHaveLength(1);
    return shapeOf(rows[0]!);
  }
  const failed = (actorId: string | null, deviceId: string, reason?: string): ReturnType<typeof shapeOf> => ({
    type: 'AUTH_FAILED',
    actorId,
    deviceId,
    details: { method: 'BIOMETRIC', knownOperator: actorId !== null, attemptsRemaining: 4, lockedUntil: null, ...(reason === undefined ? {} : { reason }) },
  });

  it('an unknown token: nobody is named', async () => {
    expect(await refused(tablet.credential, madeUpToken('u'))).toEqual(failed(null, tablet.deviceId));
  });

  it('a value that has not the form of a token counts as an attempt like any other: the same answer, the same row', async () => {
    const values = ['not-a-token', `ses_${'s'.repeat(43)}`, `dvc_${'d'.repeat(43)}`, `bio_${'b'.repeat(42)}`];
    for (const [index, value] of values.entries()) {
      const row = await refused(tablet.credential, value, 4 - index);
      expect(row).toMatchObject({ type: 'AUTH_FAILED', actorId: null, deviceId: tablet.deviceId, details: { knownOperator: false, attemptsRemaining: 4 - index } });
      expect('reason' in row.details).toBe(false);
    }
  });

  it('the value is taken as it was sent: a token with a space before or after it, or in another letter case, is another value; the token itself is untouched and then signs in', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const variants = [` ${enrolled.token}`, `${enrolled.token} `, enrolled.token.toUpperCase()];
    for (const [index, value] of variants.entries()) {
      expect(await refused(tablet.credential, value, 4 - index)).toMatchObject({ type: 'AUTH_FAILED', actorId: null, details: { knownOperator: false } });
    }
    expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('LIVE');
    expect((await signInWithToken(bio.app, tablet.credential, enrolled.token)).session.operator.id).toBe(INVESTIGATOR.id);
  });

  // A LIVE token of another device is no plain refusal: it is handled as a reuse (the block
  // "security checkpoint CPS1-7" above). What stays a plain refusal is a token of another device
  // that is dead already: nothing is left to revoke or to end.
  it('a token of another device that is no longer live (turned off, or past its 30 days): refused on the device that presents it, named as another device\'s, and nothing is changed', async () => {
    const off = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    expect((await setEnrolment(bio.app, off.sessionToken, { enabled: false })).statusCode).toBe(200);
    const revoked = await tokenRow(owner, off.token);
    expect(await refused(phone.credential, off.token)).toEqual(failed(INVESTIGATOR.id, phone.deviceId, 'OTHER_DEVICE'));
    expect(await tokenRow(owner, off.token)).toEqual(revoked);
    expect(stateOf(revoked, now())).toBe('REVOKED(DISABLED)');
    // No session of the token's device was ended by it.
    expect(await sessionAnswers(off.sessionToken)).toBe(200);

    const old = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    bio.clock.advance(THIRTY_DAYS);
    forgetLimits(bio);
    const expired = await tokenRow(owner, old.token);
    expect(await refused(phone.credential, old.token)).toEqual(failed(TECHNICIAN.id, phone.deviceId, 'OTHER_DEVICE'));
    expect(await tokenRow(owner, old.token)).toEqual(expired);
    expect(stateOf(expired, now())).toBe('EXPIRED');
    expect(sessionEndedPublications()).toEqual([]);
  });

  it('a token past its 30 days: good one millisecond before, refused at the limit', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    expect(enrolled.expiresAt).toBe(now() + THIRTY_DAYS);
    bio.clock.advance(THIRTY_DAYS - 1);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    // The next token has 30 days of its own, from its issue.
    expect(await tokenRow(owner, signedIn.biometricToken)).toMatchObject({ issuedAt: now(), expiresAt: now() + THIRTY_DAYS });
    bio.clock.advance(THIRTY_DAYS);
    forgetLimits(bio);
    expect(await refused(tablet.credential, signedIn.biometricToken)).toEqual(failed(INVESTIGATOR.id, tablet.deviceId, 'TOKEN_EXPIRED'));
    expect(stateOf(await tokenRow(owner, signedIn.biometricToken), now())).toBe('EXPIRED');
  });

  it('a family the operator turned off, and a family that a new enrolment replaced', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    expect((await setEnrolment(bio.app, enrolled.sessionToken, { enabled: false })).statusCode).toBe(200);
    expect(await refused(tablet.credential, enrolled.token)).toEqual(failed(INVESTIGATOR.id, tablet.deviceId, 'TOKEN_REVOKED'));

    forgetLimits(bio);
    const first = await enrol(bio.app, enrolled.sessionToken);
    const second = await enrol(bio.app, enrolled.sessionToken);
    expect(await refused(tablet.credential, first.token)).toEqual(failed(INVESTIGATOR.id, tablet.deviceId, 'TOKEN_REVOKED'));
    expect(stateOf(await tokenRow(owner, first.token), now())).toBe('REVOKED(REENROLLED)');
    expect((await signInWithToken(bio.app, tablet.credential, second.token)).session.operator.id).toBe(INVESTIGATOR.id);
  });

  it('a disabled operator: the administration module revoked the token with the account; enabling the operator again does not bring it back', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    const cookie: Headers = await supervisorCookie(bio);
    expect((await portalPost(bio.app, disableUrl(TECHNICIAN.id), cookie)).statusCode).toBe(200);
    try {
      expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('REVOKED(USER_DISABLED)');
      expect(await refused(tablet.credential, enrolled.token)).toEqual(failed(TECHNICIAN.id, tablet.deviceId, 'USER_DISABLED'));
    } finally {
      expect((await portalPost(bio.app, enableUrl(TECHNICIAN.id), cookie)).statusCode).toBe(200);
    }
    const again = await refused(tablet.credential, enrolled.token, 3);
    expect(again).toMatchObject({ actorId: TECHNICIAN.id, details: { reason: 'USER_DISABLED' } });
    // The operator signs in with the password and enrols again.
    forgetLimits(bio);
    const fresh = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    expect((await signInWithToken(bio.app, tablet.credential, fresh.token)).session.operator.id).toBe(TECHNICIAN.id);
  });

  it('an operator who is disabled while the token is still live: the claim is made, nobody is signed in, the token stays used and its family ends', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    // The flag alone, as `dems_owner`: no unit of the administration module ran, so the token is live.
    const { rows: stamp } = await owner.query<{ last_sign_in_at: string | null }>('UPDATE public.operators SET enabled = false WHERE id = $1 RETURNING last_sign_in_at', [TECHNICIAN.id]);
    try {
      const before = await trailLength(owner);
      const sessions = await sessionCount(owner);
      const response = await biometricSignIn(bio.app, tablet.credential, enrolled.token);
      expectNotAccepted(response, 4);
      expect(await sessionCount(owner)).toBe(sessions);
      expect((await trailSince(owner, before)).map(shapeOf)).toEqual([failed(TECHNICIAN.id, tablet.deviceId, 'USER_DISABLED')]);
      expect(await tokenRow(owner, enrolled.token)).toMatchObject({ usedAt: now(), revokedAt: now(), revokeReason: 'USER_DISABLED' });
      // No next token was issued, and the time of the last sign-in did not move.
      expect((await storedTokens(owner)).filter((row) => row.operatorId === TECHNICIAN.id && row.revokedAt === null)).toEqual([]);
      const { rows } = await owner.query<{ last_sign_in_at: string | null }>('SELECT last_sign_in_at FROM public.operators WHERE id = $1', [TECHNICIAN.id]);
      expect(rows[0]?.last_sign_in_at).toBe(stamp[0]?.last_sign_in_at);
    } finally {
      await owner.query('UPDATE public.operators SET enabled = true WHERE id = $1', [TECHNICIAN.id]);
    }
    // Presented again it is a used token: a reuse, with nothing left to end.
    const before = await trailLength(owner);
    expectNotAccepted(await biometricSignIn(bio.app, tablet.credential, enrolled.token), 3);
    expect((await trailSince(owner, before))[0]).toMatchObject({ type: 'AUTH_FAILED', details: { reason: 'TOKEN_REUSE', sessionsEnded: 0 } });
  });

  it('a device that stops being PAIRED between stage 4 and the unit: the claim is made, nobody is signed in, the family ends with the device\'s reason', async () => {
    const cookie = await supervisorCookie(bio);
    const spare = await pairDevice(bio, cookie, 'Tablet that leaves');
    const enrolled = await enrolledOperator(bio.app, spare, INVESTIGATOR.username);
    const { lockout } = bio.control;
    const take = lockout.take.bind(lockout);
    // The first thing the unit does is take the attempt: at that moment the device is unpaired by
    // a statement of `dems_owner`, as another process on the same database could do it.
    const spy = vi.spyOn(lockout, 'take').mockImplementationOnce(async (key, at) => {
      await owner.query("UPDATE public.paired_devices SET state = 'UNPAIRED', unpaired_at = $2, updated_at = $2 WHERE id = $1", [spare.deviceId, at]);
      return take(key, at);
    });
    try {
      const before = await trailLength(owner);
      const sessions = await sessionCount(owner);
      const response = await biometricSignIn(bio.app, spare.credential, enrolled.token);
      expectNotAccepted(response, 4);
      expect(await sessionCount(owner)).toBe(sessions);
      expect((await trailSince(owner, before)).map(shapeOf)).toEqual([failed(INVESTIGATOR.id, spare.deviceId, 'DEVICE_NOT_PAIRED')]);
      expect(await tokenRow(owner, enrolled.token)).toMatchObject({ usedAt: now(), revokedAt: now(), revokeReason: 'DEVICE_UNPAIRED' });
    } finally {
      spy.mockRestore();
    }
  });

  it('a retired device never reaches the handler: stage 6 answers 403 DEVICE_REVOKED with its one row; no attempt is taken and no AUTH_FAILED is written', async () => {
    const cookie = await supervisorCookie(bio);
    const spare = await pairDevice(bio, cookie, 'Tablet to revoke');
    const enrolled = await enrolledOperator(bio.app, spare, INVESTIGATOR.username);
    expect((await portalPost(bio.app, revokeUrl(spare.deviceId), cookie, { reason: 'Revoked for the biometric test' })).statusCode).toBe(200);
    // The pairing module revoked the device's live token in its own unit.
    expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('REVOKED(DEVICE_REVOKED)');
    const before = await trailLength(owner);
    const sessions = await sessionCount(owner);

    const response = await biometricSignIn(bio.app, spare.credential, enrolled.token);

    expect(outcomeOf(response)).toEqual([403, 'DEVICE_REVOKED']);
    expectContract('signInWithBiometric', response);
    expect((await trailSince(owner, before)).map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['ACCESS_DENIED', null, spare.deviceId, { operationId: 'signInWithBiometric', reason: 'DEVICE_REVOKED' }],
    ]);
    expect(await sessionCount(owner)).toBe(sessions);
    expect(await bio.control.lockout.status(spare.deviceId, now())).toMatchObject({ attemptsRemaining: 5, locked: false });
  });

  it('a caller that is no paired device: 401 without a credential, 401 with an unknown one, 403 from a web console session; none takes an attempt or writes a row', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const onWeb = await signInOnWeb(bio, SUPERVISOR.username);
    const before = await trailLength(owner);
    const sessions = await sessionCount(owner);

    const none = await biometricSignIn(bio.app, null, enrolled.token);
    expect(outcomeOf(none)).toEqual([401, 'NOT_SIGNED_IN']);
    expectContract('signInWithBiometric', none);
    expect(outcomeOf(await biometricSignIn(bio.app, `dvc_${'x'.repeat(43)}`, enrolled.token))).toEqual([401, 'NOT_SIGNED_IN']);
    // The token itself sent as the bearer value: `bio_` is never a credential of a request.
    expect(outcomeOf(await biometricSignIn(bio.app, enrolled.token, enrolled.token))).toEqual([401, 'NOT_SIGNED_IN']);
    const web = await portalPost(bio.app, BIOMETRIC_SIGN_IN, onWeb.cookie, { token: enrolled.token });
    expect(outcomeOf(web)).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expectContract('signInWithBiometric', web);

    expect(await trailLength(owner)).toBe(before);
    expect(await sessionCount(owner)).toBe(sessions);
    expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('LIVE');
    expect(await lockState(tablet.credential)).toMatchObject({ attemptsRemaining: 5 });
  });

  it('a body that breaks the schema answers 422 INVALID_INPUT before anything is taken: no attempt, no row, no session; malformed JSON answers 400', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const before = await trailLength(owner);
    const sessions = await sessionCount(owner);
    const bodies: unknown[] = [{}, { token: '' }, { token: 7 }, { token: null }, { token: ['x'] }, { token: 'x'.repeat(257) }, { token: `bio_\u0000${'x'.repeat(42)}` }, { token: `bio_\ud800${'x'.repeat(42)}` }];
    for (const body of bodies) {
      const response = await devicePost(bio.app, BIOMETRIC_SIGN_IN, tablet.credential, body as Record<string, unknown>);
      expect(outcomeOf(response), JSON.stringify(Object.keys(body as object))).toEqual([422, 'INVALID_INPUT']);
      expectContract('signInWithBiometric', response);
    }
    const malformed = await bio.app.inject({
      method: 'POST',
      url: BIOMETRIC_SIGN_IN,
      headers: { authorization: `Bearer ${tablet.credential}`, 'content-type': 'application/json' },
      payload: '{"token": "bio_',
    });
    expect(outcomeOf(malformed)).toEqual([400, 'INVALID_JSON']);
    expectContract('signInWithBiometric', malformed);

    expect(await trailLength(owner)).toBe(before);
    expect(await sessionCount(owner)).toBe(sessions);
    expect(await lockState(tablet.credential)).toMatchObject({ attemptsRemaining: 5 });
    expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('LIVE');
  });

  // Finding F77, decision D118: operation 8 carries the registry's condition DEVICE_CREDENTIAL. A
  // session of the device that is still open must not be able to renew itself through the
  // biometric chain (enrol in the session, then sign in with the token while it is open). Before
  // the decision this request signed the token's operator in and ended the presented session as
  // ROTATED (ID-6); that branch is gone from the handler, and stage 6 answers instead.
  it('a SESSION token of the device on the sign-in is refused by stage 6: 403 DEVICE_NOT_PAIRED with the reason DEVICE_CREDENTIAL_REQUIRED, no row, no attempt, no place in the budget, nothing stored, and the presented session stays open; the same token with the DEVICE credential signs in the token\'s operator, is rotated, and ends no session', async () => {
    const investigator = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const technician = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    const before = await trailLength(owner);
    const sessions = await storedSessions(owner);
    const tokens = await storedTokens(owner);
    bio.published.length = 0;
    bio.clock.advance(MINUTE);

    // The investigator's session is the credential of the request: with its OWN token (the
    // chain of the finding) and with the technician's.
    for (const token of [investigator.token, technician.token]) {
      const refused = await biometricSignIn(bio.app, investigator.sessionToken, token);
      expect(outcomeOf(refused)).toEqual([403, 'DEVICE_NOT_PAIRED']);
      expect(errorOf(refused)).toMatchObject({ message: "This operation needs the device's own credential.", details: { reason: 'DEVICE_CREDENTIAL_REQUIRED' } });
      expect(Object.keys(refused.json() as object)).toEqual(['error']);
      expectContract('signInWithBiometric', refused);
      expect(refused.headers['set-cookie']).toBeUndefined();
      expect(refused.headers['x-dems-revision']).toBeUndefined();
    }
    // Decided before the body is read: a body that breaks the schema and one that is no JSON get the same refusal.
    expect(outcomeOf(await devicePost(bio.app, BIOMETRIC_SIGN_IN, investigator.sessionToken, { token: '' }))).toEqual([403, 'DEVICE_NOT_PAIRED']);
    const malformed = await bio.app.inject({
      method: 'POST',
      url: BIOMETRIC_SIGN_IN,
      headers: { authorization: `Bearer ${investigator.sessionToken}`, 'content-type': 'application/json' },
      payload: '{"token": ',
    });
    expect(outcomeOf(malformed)).toEqual([403, 'DEVICE_NOT_PAIRED']);

    // No row, no publication, nothing stored: the sessions and the tokens are row for row what they were.
    expect(await trailLength(owner)).toBe(before);
    expect(sessionEndedPublications()).toEqual([]);
    expect(await storedSessions(owner)).toEqual(sessions);
    expect(await storedTokens(owner)).toEqual(tokens);
    // No attempt was taken from the device's lockout, and no place in the denial budget of the operator's key.
    expect(await lockState(tablet.credential)).toMatchObject({ locked: false, attemptsRemaining: 5 });
    expect(await throttleControl(bio.app).inspect(`operator:${INVESTIGATOR.id}`)).toMatchObject({ used: 0 });
    // The presented session is alive: it was not ended, and it still answers.
    expect(await sessionOfToken(owner, investigator.sessionToken)).toMatchObject({ operatorId: INVESTIGATOR.id, endedAt: null, endReason: null });
    expect(await sessionAnswers(investigator.sessionToken)).toBe(200);

    // The same token, sent with the device's own credential: the TOKEN decides who signs in
    // (nobody can choose), and it is rotated.
    const response = await biometricSignIn(bio.app, tablet.credential, technician.token);
    expect(response.statusCode).toBe(200);
    expectContract('signInWithBiometric', response);
    const body = response.json() as { session: { operator: { id: string }; method: string }; sessionToken: string; biometricToken: string };
    expect(body.session).toMatchObject({ operator: { id: TECHNICIAN.id }, method: 'BIOMETRIC' });
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([
      { type: 'AUTH_SUCCESS', actorId: TECHNICIAN.id, deviceId: tablet.deviceId, details: { method: 'BIOMETRIC' } },
    ]);
    // The rotation of the TOKEN: the one that was sent is used, the next one of its family is live.
    const used = await tokenRow(owner, technician.token);
    expect(used).toMatchObject({ usedAt: now(), revokedAt: null });
    expect(await tokenRow(owner, body.biometricToken)).toMatchObject({
      familyId: used?.familyId,
      operatorId: TECHNICIAN.id,
      deviceId: tablet.deviceId,
      issuedAt: now(),
      usedAt: null,
      revokedAt: null,
    });
    // It ended no session (the rotation of a SESSION, ID-6, is the password sign-in's): nothing
    // was published, every session that was open is open, and the new one answers.
    expect(sessionEndedPublications()).toEqual([]);
    expect((await storedSessions(owner)).filter((row) => row.endedAt === now())).toEqual([]);
    expect(await sessionAnswers(investigator.sessionToken)).toBe(200);
    expect(await sessionAnswers(technician.sessionToken)).toBe(200);
    expect(await sessionAnswers(body.sessionToken)).toBe(200);
    // The investigator's own token was not touched by any of it.
    expect(stateOf(await tokenRow(owner, investigator.token), now())).toBe('LIVE');
  });
});

describe('ENG-24, ID-5: the attempt is taken from the device\'s lockout, the one the password sign-in counts on', () => {
  it('five refused tokens: four answer 401 with 4, 3, 2 and 1 attempts left, the fifth locks the device and answers 423; its row says so', async () => {
    const before = await trailLength(owner);
    const answers: LightMyRequestResponse[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) answers.push(await biometricSignIn(bio.app, tablet.credential, madeUpToken(String(attempt))));

    expect(answers.map((answer) => answer.statusCode)).toEqual([401, 401, 401, 401, 423]);
    expect(answers.slice(0, 4).map((answer) => errorOf(answer).details?.['attemptsRemaining'])).toEqual([4, 3, 2, 1]);
    const lockedUntil = now() + MINUTE;
    expect(errorOf(answers[4]!)).toMatchObject({ code: 'LOCKED', details: { lockedUntil, retryInMs: MINUTE } });
    expectContract('signInWithBiometric', answers[4]!);
    const rows = await trailSince(owner, before);
    expect(rows.map((row) => row.type)).toEqual(['AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED']);
    expect(rows.at(-1)).toMatchObject({ message: 'Sign-in failed; console locked for 60 s', details: { method: 'BIOMETRIC', attemptsRemaining: 0, lockedUntil } });
    expect(await lockState(tablet.credential)).toMatchObject({ locked: true, lockedUntil, attemptsRemaining: 0 });
  });

  it('during the lock a VALID token is not looked at: 423, AUTH_LOCKED naming nobody, the token untouched; after 60 s it signs in', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    for (let attempt = 0; attempt < 5; attempt += 1) await biometricSignIn(bio.app, tablet.credential, madeUpToken('k'));
    const before = await trailLength(owner);
    const lockedUntil = now() + MINUTE;
    bio.clock.advance(MINUTE - 1);

    const locked = await biometricSignIn(bio.app, tablet.credential, enrolled.token);

    expect(outcomeOf(locked)).toEqual([423, 'LOCKED']);
    expect(errorOf(locked)).toMatchObject({ details: { lockedUntil, retryInMs: 1 } });
    expectContract('signInWithBiometric', locked);
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([
      { type: 'AUTH_LOCKED', actorId: null, deviceId: tablet.deviceId, details: { method: 'BIOMETRIC', retryInMs: 1, lockedUntil } },
    ]);
    expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('LIVE');
    // The password sign-in of the same device is locked by the same counter.
    expect((await deviceSignIn(bio.app, tablet.credential, INVESTIGATOR.username)).statusCode).toBe(423);

    bio.clock.advance(1);
    throttleControl(bio.app).reset();
    expect((await signInWithToken(bio.app, tablet.credential, enrolled.token)).session.method).toBe('BIOMETRIC');
    expect(await lockState(tablet.credential)).toMatchObject({ locked: false, attemptsRemaining: 5 });
  });

  it('one counter for both ways in: three refused tokens and two wrong passwords lock the device; a success of either clears it', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    for (let attempt = 0; attempt < 3; attempt += 1) await biometricSignIn(bio.app, tablet.credential, madeUpToken('m'));
    expect(await lockState(tablet.credential)).toMatchObject({ attemptsRemaining: 2 });
    // A token that signs in clears the count: five attempts again.
    await signInWithToken(bio.app, tablet.credential, enrolled.token);
    expect(await lockState(tablet.credential)).toMatchObject({ attemptsRemaining: 5 });

    for (let attempt = 0; attempt < 3; attempt += 1) await biometricSignIn(bio.app, tablet.credential, madeUpToken('n'));
    expect((await deviceSignIn(bio.app, tablet.credential, INVESTIGATOR.username, 'not-the-password-w41')).statusCode).toBe(401);
    const fifth = await deviceSignIn(bio.app, tablet.credential, INVESTIGATOR.username, 'not-the-password-w41');
    expect(fifth.statusCode).toBe(423);
    expect(await lockState(tablet.credential)).toMatchObject({ locked: true });
    // Another device and the web console are not locked by it.
    expect(await lockState(phone.credential)).toMatchObject({ locked: false, attemptsRemaining: 5 });
    expect((await bio.app.inject({ method: 'GET', url: STATUS })).json()).toMatchObject({ locked: false, attemptsRemaining: 5 });
  });

  it('a sign-out ends a BIOMETRIC session like any other and leaves the token family alone', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    const signOut = await devicePost(bio.app, SIGN_OUT, signedIn.sessionToken, {});
    expect(signOut.statusCode).toBe(204);
    expect(signOut.headers['set-cookie']).toBeUndefined();
    expect((await sessionOfToken(owner, signedIn.sessionToken)).endReason).toBe('SIGNED_OUT');
    expect((await signInWithToken(bio.app, tablet.credential, signedIn.biometricToken)).session.method).toBe('BIOMETRIC');
  });
});
