// The identity core under concurrent requests, against PostgreSQL (plan row W24; spec §8.2
// ENG-23 to ENG-26; SR-72; AC-B-80; database contract §5.6 AT-3, AT-6, AT-C1; security design
// review SD-04). A clone of the seed template, the code under test as `dems_app`.
//
// What each test relies on is stated with it. In one process the units of the pipeline are
// serial; the statements are written so that the result is right even if two units ran at the
// same time, and the last block shows that on two real connections.
import { OPERATOR_IDS, OPERATORS, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { throttleControl } from '../../../plugins/throttle';
import type { Publication } from '../../../realtime';
import { deriveArgon2id } from '../password-hash';
import { EXPIRE_SESSION, TOUCH_SESSION } from '../session-store';
import {
  CLOCK_START,
  MINUTE,
  SESSION,
  SIGN_OUT,
  STATUS,
  TOUCH,
  WEB_ORIGIN,
  bearer,
  closeOpenSessions,
  cookieValue,
  deviceRegistryDouble,
  deviceSignIn,
  errorOf,
  forgetCounters,
  get,
  identityApp,
  insertPairedDevice,
  sessionOfToken,
  signInOnWeb,
  storedSessions,
  webPost,
  webSignIn,
  type IdentityApp,
} from '../../../../test/support/identity';

const db = useTestDatabase({ template: 'seed' });
let identity: IdentityApp;
let owner: Pool;
let deviceCredential: string;
const published: Publication[] = [];

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const DEVICE = 'DEV-0001';
const WRONG_PASSWORD = 'not-the-password-w24';
/** ID-P13 and ID-P1, stated here on their own so that a test does not take the numbers from the code under test. */
const DENIAL_BUDGET = 20;
const VERIFIED_PER_LOCK_CYCLE = 5;

beforeAll(async () => {
  owner = db.ownerPool();
  identity = await identityApp(db);
  const devices = deviceRegistryDouble();
  identity.app.seams.replace('deviceResolver', devices.resolver);
  identity.app.seams.replace('publish', (publication) => void published.push(publication));
  await insertPairedDevice(owner, DEVICE, OPERATOR_IDS.ANDI, CLOCK_START);
  deviceCredential = devices.pair(DEVICE);
});

beforeEach(async () => {
  await closeOpenSessions(owner);
  forgetCounters(identity);
  published.length = 0;
  // Each test in its own minute of the server clock.
  identity.clock.advance(2 * MINUTE);
});

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const trailSince = async (from: number): Promise<AuditRow[]> => (await readTrail(owner)).slice(from);
const statuses = (answers: readonly LightMyRequestResponse[]): Record<number, number> =>
  answers.reduce<Record<number, number>>((count, answer) => ({ ...count, [answer.statusCode]: (count[answer.statusCode] ?? 0) + 1 }), {});

async function expectChainVerifies(): Promise<void> {
  const rows = await readTrail(owner);
  const head = await readHead(owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
}

describe('AC-B-80 (SD-04, AT-C1): 20 concurrent wrong-password sign-ins on one console', () => {
  // Relies on: the attempt is TAKEN in unit 1 of the serial pipeline, before the derivation
  // (ENG-24); the counter changes before the unit's first await; taking the fifth attempt locks
  // the console at once. So five attempts are verified whatever the order in which the 20
  // derivations and second units end.
  it('verifies exactly five attempts (five AUTH_FAILED rows, the fifth marked as locking) and answers 423 with AUTH_LOCKED to the other 15', async () => {
    const before = await trailLength();
    const sessions = (await storedSessions(owner)).length;
    identity.derive.mockClear();

    const answers = await Promise.all(
      Array.from({ length: 20 }, (_, index) => webSignIn(identity.app, index % 3 === 0 ? 'nobody.at-all' : SUPERVISOR.username, WRONG_PASSWORD)),
    );

    expect(identity.derive).toHaveBeenCalledTimes(5);
    expect(statuses(answers)).toEqual({ 401: 4, 423: 16 });
    const lockedUntil = identity.clock.now() + MINUTE;
    for (const answer of answers.filter((candidate) => candidate.statusCode === 423)) {
      expect(errorOf(answer)).toMatchObject({ code: 'LOCKED', details: { lockedUntil, retryInMs: MINUTE } });
    }
    expect(
      answers
        .filter((answer) => answer.statusCode === 401)
        .map((answer) => errorOf(answer).details?.['attemptsRemaining'])
        .sort(),
    ).toEqual([1, 2, 3, 4]);
    expect(answers.every((answer) => answer.headers['set-cookie'] === undefined)).toBe(true);

    const rows = await trailSince(before);
    const failed = rows.filter((row) => row.type === 'AUTH_FAILED');
    const locked = rows.filter((row) => row.type === 'AUTH_LOCKED');
    expect([rows.length, failed.length, locked.length]).toEqual([20, 5, 15]);
    // In the order of the chain: 4, 3, 2, 1 attempts left, and the fifth failure says it locked.
    expect(failed.map((row) => [row.details['attemptsRemaining'], row.details['lockedUntil']])).toEqual([
      [4, null],
      [3, null],
      [2, null],
      [1, null],
      [0, lockedUntil],
    ]);
    expect(locked.every((row) => row.details['lockedUntil'] === lockedUntil)).toBe(true);
    expect(await storedSessions(owner)).toHaveLength(sessions);
    await expectChainVerifies();
    console.info(
      `[w24] AC-B-80: 20 concurrent wrong sign-ins: ${identity.derive.mock.calls.length} derivations; statuses ${JSON.stringify(statuses(answers))}; ` +
        `${failed.length} AUTH_FAILED (attemptsRemaining ${failed.map((row) => String(row.details['attemptsRemaining'])).join(', ')}), ${locked.length} AUTH_LOCKED`,
    );

    // The burst used the key's whole denial budget (20 audited refusals in 60 s): the next
    // request of the key is answered 429 at stage 5 and writes no row (SR-71).
    const next = await webSignIn(identity.app, SUPERVISOR.username, WRONG_PASSWORD);
    expect([next.statusCode, errorOf(next).code]).toEqual([429, 'RATE_LIMITED']);
    expect(await trailSince(before)).toHaveLength(20);

    // 60 s later the lock and the budget are over, and the right password signs in.
    identity.clock.advance(MINUTE);
    expect((await webSignIn(identity.app, SUPERVISOR.username)).statusCode).toBe(200);
  });

  it('a correct password among a burst is one of the five or is refused with the lock: never a sixth verification', async () => {
    identity.derive.mockClear();
    const answers = await Promise.all(
      Array.from({ length: 12 }, (_, index) => (index === 7 ? webSignIn(identity.app, INVESTIGATOR.username) : webSignIn(identity.app, INVESTIGATOR.username, WRONG_PASSWORD))),
    );
    expect(identity.derive).toHaveBeenCalledTimes(5);
    // The right one arrived eighth: five attempts were taken before it.
    expect(answers[7]?.statusCode).toBe(423);
    expect(statuses(answers)).toEqual({ 401: 4, 423: 8 });
  });

  // SR-71 with SR-23 (security checkpoint CPS1-6). The budget has 20 places and 25 refusals ask
  // for one, so five answer 429, whichever five they are. What does not depend on the order: every
  // VERIFIED failure writes its AUTH_FAILED row, with a place or without one; an attempt during
  // the lock writes its AUTH_LOCKED row only with a place.
  it('SR-71: of 25 at once, 20 take a place in the denial budget and five answer 429; each of the five verified failures has its AUTH_FAILED row all the same', async () => {
    const before = await trailLength();
    identity.derive.mockClear();
    const answers = await Promise.all(Array.from({ length: 25 }, () => webSignIn(identity.app, SUPERVISOR.username, WRONG_PASSWORD)));
    const rows = await trailSince(before);
    const failed = rows.filter((row) => row.type === 'AUTH_FAILED');
    const locked = rows.filter((row) => row.type === 'AUTH_LOCKED');
    expect(statuses(answers)[429]).toBe(5);
    expect(identity.derive).toHaveBeenCalledTimes(5);
    expect(failed).toHaveLength(5);
    // The rows beyond the 20 places are verified failures and nothing else: at most five.
    const beyond = rows.length - DENIAL_BUDGET;
    expect(beyond).toBeGreaterThanOrEqual(0);
    expect(beyond).toBeLessThanOrEqual(VERIFIED_PER_LOCK_CYCLE);
    expect(locked).toHaveLength(DENIAL_BUDGET - (failed.length - beyond));
    expect(await throttleControl(identity.app).inspect('class:web')).toMatchObject({ used: DENIAL_BUDGET, exhausted: true });
    console.info(`[w24b] SR-71, 25 at once: statuses ${JSON.stringify(statuses(answers))}; ${failed.length} AUTH_FAILED, ${locked.length} AUTH_LOCKED; ${beyond} rows beyond the 20 places`);
    // Every REST request of the key (the web console class) is now answered 429 at stage 5.
    expect((await get(identity.app, STATUS, { origin: WEB_ORIGIN })).statusCode).toBe(429);
    throttleControl(identity.app).reset();
    expect((await get(identity.app, STATUS, { origin: WEB_ORIGIN })).json()).toMatchObject({ locked: true });
    await expectChainVerifies();
  });
});

describe('SR-23 (security checkpoint CPS1-6): a verified failed sign-in always writes its AUTH_FAILED row', () => {
  // The case of the finding, made independent of timing: 30 wrong sign-ins of one key (the whole
  // allowance of the request throttle for a signed-out console) pass the throttle stage together.
  // Five take an attempt and are verified; their derivations are HELD until the other 25, which
  // find the console locked, have been answered. Those take the key's 20 places. The verified
  // failures therefore ask for a place last and find none.
  //
  // Relies on: the lockout hands out five attempts per lock cycle (ENG-24); the budget counts a
  // place before the row (SR-71); stage 5 lets no request of the key through once it holds 20.
  //
  // THE BOUND asserted at the end. A caller who cannot sign in causes, per throttle key and
  // window of 60 s, at most 20 rows inside the budget and 5 beyond it: 25. The lock lasts as long
  // as the window, so a second lock cycle cannot begin in it, and stage 5 turns every later
  // request of the key away without a row. (A caller who CAN sign in opens a new lock cycle with
  // each success: review finding CPS1-10. Every row beyond the 25 is then one more wrong password
  // that was really derived, and the request throttle of the key is what caps them.)
  //
  // The time limit: 30 requests, 25 units and five derivations at once are more than the default
  // allows under the load of parallel rows.
  it('30 at once: the 20 places go to attempts during the lock; the five verified failures answer the budget\'s 429 and each writes ONE AUTH_FAILED row; 25 rows are the most a caller who cannot sign in causes in the window', { timeout: 90_000 }, async () => {
    const before = await trailLength();
    const eventsBefore = (await readEvents(owner)).length;
    const sessions = (await storedSessions(owner)).length;
    identity.derive.mockClear();
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    identity.derive.mockImplementation(async (request) => {
      await held;
      return deriveArgon2id(request);
    });

    const answered: LightMyRequestResponse[] = [];
    let unverified: LightMyRequestResponse[] = [];
    let burst: LightMyRequestResponse[] = [];
    try {
      const requests = Array.from({ length: 30 }, (_, index) =>
        webSignIn(identity.app, index % 3 === 0 ? 'nobody.at-all' : SUPERVISOR.username, WRONG_PASSWORD).then((answer) => {
          answered.push(answer);
          return answer;
        }),
      );
      // The 25 that were not verified are answered while the five derivations wait.
      await vi.waitFor(() => expect(answered).toHaveLength(25), { timeout: 45_000, interval: 20 });
      await identity.app.pipeline.drain();
      unverified = [...answered];

      expect(identity.derive).toHaveBeenCalledTimes(VERIFIED_PER_LOCK_CYCLE);
      expect(statuses(unverified)).toEqual({ 423: 20, 429: 5 });
      expect((await trailSince(before)).map((row) => row.type)).toEqual(Array.from({ length: DENIAL_BUDGET }, () => 'AUTH_LOCKED'));
      // No place is left for the key: the five verified attempts are still under way.
      expect(await throttleControl(identity.app).inspect('class:web')).toMatchObject({ used: DENIAL_BUDGET, remaining: 0, exhausted: true });

      release();
      burst = await Promise.all(requests);
    } finally {
      release();
      identity.derive.mockImplementation(deriveArgon2id);
    }
    await identity.app.pipeline.drain();

    // The answer of a verified failure beyond the budget is what it was: the budget's 429, with
    // `retry-after`, the same body as every other 429, and no cookie.
    const verified = burst.filter((answer) => !unverified.includes(answer));
    expect(verified).toHaveLength(VERIFIED_PER_LOCK_CYCLE);
    for (const answer of verified) {
      expect([answer.statusCode, errorOf(answer).code]).toEqual([429, 'RATE_LIMITED']);
      expect(Number(answer.headers['retry-after'])).toBeGreaterThanOrEqual(1);
      expect(Number(answer.headers['retry-after'])).toBeLessThanOrEqual(60);
      expect(answer.headers['set-cookie']).toBeUndefined();
    }
    // Nothing in it tells a verified failure from an attempt that was not looked at.
    const limited = [...verified, ...unverified.filter((answer) => answer.statusCode === 429)];
    expect(limited).toHaveLength(10);
    expect(new Set(limited.map((answer) => JSON.stringify({ ...errorOf(answer), requestId: null }))).size).toBe(1);
    expect(new Set(limited.map((answer) => answer.headers['retry-after'])).size).toBe(1);
    expect(statuses(burst)).toEqual({ 423: 20, 429: 10 });

    // EXACTLY ONE ROW PER VERIFIED FAILURE: five derivations, five AUTH_FAILED rows, written
    // after the 20 places were gone; the fifth is the locking one. One event beside each.
    expect(identity.derive).toHaveBeenCalledTimes(VERIFIED_PER_LOCK_CYCLE);
    const rows = await trailSince(before);
    const failed = rows.slice(DENIAL_BUDGET);
    const lockedUntil = identity.clock.now() + MINUTE;
    expect(failed.map((row) => [row.type, row.details['method'], row.details['attemptsRemaining'], row.details['lockedUntil']])).toEqual([
      ['AUTH_FAILED', 'PASSWORD', 4, null],
      ['AUTH_FAILED', 'PASSWORD', 3, null],
      ['AUTH_FAILED', 'PASSWORD', 2, null],
      ['AUTH_FAILED', 'PASSWORD', 1, null],
      ['AUTH_FAILED', 'PASSWORD', 0, lockedUntil],
    ]);
    // Each names the operator the username matched, or nobody (ID-4): never anything else.
    for (const row of failed) {
      expect([SUPERVISOR.id, null]).toContain(row.actorId);
      expect(row.details['knownOperator']).toBe(row.actorId !== null);
      expect(row.deviceId).toBeNull();
    }
    const events = (await readEvents(owner)).slice(eventsBefore);
    expect(events.filter((event) => event.type === 'AUTH_FAILED')).toHaveLength(VERIFIED_PER_LOCK_CYCLE);
    expect(events).toHaveLength(rows.length);
    // The place count did not move: the five rows took none.
    expect(await throttleControl(identity.app).inspect('class:web')).toMatchObject({ used: DENIAL_BUDGET, exhausted: true });
    expect(await storedSessions(owner)).toHaveLength(sessions);

    // THE BOUND: 20 + 5, and nothing more in this window, whatever the key sends.
    expect(rows).toHaveLength(DENIAL_BUDGET + VERIFIED_PER_LOCK_CYCLE);
    const later = await Promise.all(Array.from({ length: 12 }, (_, index) => webSignIn(identity.app, SUPERVISOR.username, index === 11 ? undefined : WRONG_PASSWORD)));
    expect(statuses(later)).toEqual({ 429: 12 });
    identity.clock.advance(MINUTE - 1);
    expect((await webSignIn(identity.app, SUPERVISOR.username, WRONG_PASSWORD)).statusCode).toBe(429);
    expect(identity.derive).toHaveBeenCalledTimes(VERIFIED_PER_LOCK_CYCLE);
    expect(await trailSince(before)).toHaveLength(DENIAL_BUDGET + VERIFIED_PER_LOCK_CYCLE);
    await expectChainVerifies();
    console.info(
      `[w24b] CPS1-6: 30 wrong sign-ins at once: statuses ${JSON.stringify(statuses(burst))}; ${identity.derive.mock.calls.length} derivations; ` +
        `rows ${rows.length} = ${DENIAL_BUDGET} AUTH_LOCKED inside the budget + ${failed.length} AUTH_FAILED beyond it; 13 later requests of the window: 429, no row`,
    );

    // The window and the lock end together: the right password signs in, and the count starts afresh.
    identity.clock.advance(1);
    expect((await webSignIn(identity.app, SUPERVISOR.username)).statusCode).toBe(200);
  });
});

describe('two sign-ins of one operator at the same time (ID-6, ID-7)', () => {
  // Relies on: each sign-in's second unit is one transaction; the session it ends is ended by
  // `UPDATE ... WHERE id = $1 AND ended_at IS NULL RETURNING`, whose row count decides (AT-3).
  it('on two consoles: two sessions, two tokens, two AUTH_SUCCESS rows', async () => {
    const before = await trailLength();
    const [web, device] = await Promise.all([
      webSignIn(identity.app, SUPERVISOR.username),
      deviceSignIn(identity.app, deviceCredential, SUPERVISOR.username),
    ]);
    expect([web.statusCode, device.statusCode]).toEqual([200, 200]);
    const webToken = cookieValue(web, identity.cookieName) ?? '';
    const deviceToken = (device.json() as { sessionToken: string }).sessionToken;
    expect(webToken).not.toBe(deviceToken);
    const [webSession, deviceSession] = [await sessionOfToken(owner, webToken), await sessionOfToken(owner, deviceToken)];
    expect(webSession.id).not.toBe(deviceSession.id);
    expect([webSession.deviceId, deviceSession.deviceId]).toEqual([null, DEVICE]);
    expect([webSession.endedAt, deviceSession.endedAt]).toEqual([null, null]);
    expect((await trailSince(before)).map((row) => [row.type, row.actorId]).sort()).toEqual([
      ['AUTH_SUCCESS', SUPERVISOR.id],
      ['AUTH_SUCCESS', SUPERVISOR.id],
    ]);
    expect((await get(identity.app, SESSION, { cookie: `${identity.cookieName}=${webToken}` })).statusCode).toBe(200);
    expect((await get(identity.app, SESSION, bearer(deviceToken))).statusCode).toBe(200);
  });

  it('both presenting the same session: it is ended exactly once, one AUTH_SUCCESS says "replaced", and both new sessions are open', async () => {
    const first = await signInOnWeb(identity, SUPERVISOR.username);
    const presented = await sessionOfToken(owner, first.token);
    const before = await trailLength();
    published.length = 0;
    identity.clock.advance(1_000);

    const answers = await Promise.all([
      webSignIn(identity.app, SUPERVISOR.username, undefined, first.cookie),
      webSignIn(identity.app, SUPERVISOR.username, undefined, first.cookie),
    ]);
    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200]);
    const tokens = answers.map((answer) => cookieValue(answer, identity.cookieName) ?? '');
    expect(new Set([first.token, ...tokens]).size).toBe(3);

    expect(await sessionOfToken(owner, first.token)).toMatchObject({ id: presented.id, endReason: 'ROTATED', endedAt: identity.clock.now() });
    const rows = await trailSince(before);
    expect(rows.map((row) => row.type)).toEqual(['AUTH_SUCCESS', 'AUTH_SUCCESS']);
    expect(rows.map((row) => row.details['replaced'] === true)).toEqual([true, false]);
    expect(published).toEqual([{ kind: 'session.ended', sessionIds: [presented.id], reason: 'ROTATED' }]);
    for (const token of tokens) expect(await sessionOfToken(owner, token)).toMatchObject({ endedAt: null, operatorId: SUPERVISOR.id });
    await expectChainVerifies();
  });
});

describe('a sign-out racing other requests of the same session (SR-12)', () => {
  // Relies on: the sign-out is one compare-and-set statement in one unit; a touch is
  // `UPDATE ... WHERE id = $1 AND ended_at IS NULL ...`, so it never writes on an ended session;
  // a request resolved before the commit is in flight, every request after it is refused.
  it('ends the session exactly once, writes one AUTH_SIGNED_OUT row, and no request after it succeeds', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const session = await sessionOfToken(owner, web.token);
    const before = await trailLength();
    identity.clock.advance(5 * MINUTE);
    published.length = 0;

    const answers = await Promise.all([
      get(identity.app, SESSION, web.cookie),
      webPost(identity.app, TOUCH, web.cookie),
      webPost(identity.app, SIGN_OUT, web.cookie),
      get(identity.app, SESSION, web.cookie),
      webPost(identity.app, TOUCH, web.cookie),
      webPost(identity.app, SIGN_OUT, web.cookie, { reason: 'LOCK' }),
      get(identity.app, SESSION, web.cookie),
      webPost(identity.app, TOUCH, web.cookie),
    ]);
    const [, , signOutOne, , , signOutTwo] = answers;
    // Every answer is a success of a request that was in flight, or the 401 of one that came after.
    for (const answer of answers) expect([200, 204, 401]).toContain(answer.statusCode);
    expect([signOutOne?.statusCode, signOutTwo?.statusCode]).toContain(204);

    const rows = await trailSince(before);
    expect(rows.filter((row) => row.type === 'AUTH_SIGNED_OUT')).toHaveLength(1);
    expect(rows.filter((row) => row.type !== 'AUTH_SIGNED_OUT')).toEqual([]);
    expect(published.filter((publication) => publication.kind === 'session.ended')).toEqual([
      { kind: 'session.ended', sessionIds: [session.id], reason: 'SIGNED_OUT' },
    ]);
    const stored = await sessionOfToken(owner, web.token);
    expect(stored).toMatchObject({ endReason: 'SIGNED_OUT', endedAt: identity.clock.now() });
    expect(stored.lastSeenAt).toBeLessThanOrEqual(stored.endedAt ?? 0);

    // After the race: refused, and the ended row is never written again.
    identity.clock.advance(MINUTE);
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(401);
    expect((await webPost(identity.app, TOUCH, web.cookie)).statusCode).toBe(401);
    expect(await sessionOfToken(owner, web.token)).toEqual(stored);
    await expectChainVerifies();
  });
});

describe('the sweeper racing a request (SR-11)', () => {
  // Relies on: the sweeper and the request path end a session with the same statement shape,
  // `UPDATE ... WHERE ended_at IS NULL AND (past a limit) RETURNING`; whichever unit runs first
  // gets the row and writes AUTH_EXPIRED, the other gets no row and writes nothing.
  it('a session past its idle limit is ended once, with one AUTH_EXPIRED row, whoever comes first', async () => {
    const web = await signInOnWeb(identity, INVESTIGATOR.username);
    const other = await signInOnWeb(identity, SUPERVISOR.username);
    const session = await sessionOfToken(owner, web.token);
    identity.clock.advance(15 * MINUTE);
    const before = await trailLength();
    published.length = 0;

    const [sweepOne, read, sweepTwo, touch, readOther] = await Promise.all([
      identity.control.sweep(),
      get(identity.app, SESSION, web.cookie),
      identity.control.sweep(),
      webPost(identity.app, TOUCH, web.cookie),
      get(identity.app, SESSION, other.cookie),
    ]);
    expect([read.statusCode, touch.statusCode, readOther.statusCode]).toEqual([401, 401, 401]);

    const rows = await trailSince(before);
    expect(rows.map((row) => row.type)).toEqual(['AUTH_EXPIRED', 'AUTH_EXPIRED']);
    expect(rows.map((row) => row.actorId).sort()).toEqual([INVESTIGATOR.id, SUPERVISOR.id]);
    // Each session appears in exactly one publication, and in the result of at most one sweep.
    const publishedIds = published.flatMap((publication) => (publication.kind === 'session.ended' ? publication.sessionIds : []));
    expect([...publishedIds].sort()).toEqual([session.id, (await sessionOfToken(owner, other.token)).id].sort());
    const swept = [...sweepOne, ...sweepTwo].map((ended) => ended.id);
    expect(new Set(swept).size).toBe(swept.length);
    expect(await sessionOfToken(owner, web.token)).toMatchObject({ endReason: 'IDLE_EXPIRED', endedAt: identity.clock.now() });
    await expectChainVerifies();
  });

  // The same on two real connections of `dems_app`, each in its own transaction at READ
  // COMMITTED, as two server processes on one database would run them: the second statement
  // waits for the row lock of the first and then evaluates its WHERE again on the committed row.
  it('statement level: an expiry that waits behind a touch ends nothing; a touch that waits behind an expiry writes nothing', async () => {
    const pool = db.appPool();
    const now = identity.clock.now();
    const idle = 15 * MINUTE;

    // (a) the touch commits first.
    const touched = await sessionOfToken(owner, (await signInOnWeb(identity, SUPERVISOR.username)).token);
    const [first, second] = [await pool.connect(), await pool.connect()];
    try {
      await first.query('BEGIN');
      await second.query('BEGIN');
      const later = now + idle + 10;
      // Activity one millisecond before the idle limit, uncommitted.
      expect((await first.query(TOUCH_SESSION, [touched.id, now + idle - 1, now - 1])).rowCount).toBe(1);
      // The expiry, 11 ms later: it sees the committed row (idle), and waits for the row lock.
      const expiry = second.query(EXPIRE_SESSION, [later, later - idle, touched.id]);
      const waited = await Promise.race([expiry.then(() => 'answered'), new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 150))]);
      expect(waited).toBe('waiting');
      await first.query('COMMIT');
      expect((await expiry).rowCount).toBe(0);
      await second.query('COMMIT');
    } finally {
      first.release();
      second.release();
    }
    expect(await storedSessions(owner).then((rows) => rows.find((row) => row.id === touched.id))).toMatchObject({ endedAt: null, lastSeenAt: now + idle - 1 });

    // (b) the expiry commits first.
    const expired = await sessionOfToken(owner, (await signInOnWeb(identity, INVESTIGATOR.username)).token);
    const [third, fourth] = [await pool.connect(), await pool.connect()];
    try {
      await third.query('BEGIN');
      await fourth.query('BEGIN');
      const at = now + idle;
      expect((await third.query(EXPIRE_SESSION, [at, at - idle, expired.id])).rowCount).toBe(1);
      // A touch stamped just before the limit: the committed row is still open and not yet idle for it.
      const touch = fourth.query(TOUCH_SESSION, [expired.id, at - 1, at - 1 - idle]);
      await third.query('COMMIT');
      expect((await touch).rowCount).toBe(0);
      await fourth.query('COMMIT');
    } finally {
      third.release();
      fourth.release();
    }
    expect(await storedSessions(owner).then((rows) => rows.find((row) => row.id === expired.id))).toMatchObject({
      endReason: 'IDLE_EXPIRED',
      lastSeenAt: expired.lastSeenAt,
    });
  });
});
