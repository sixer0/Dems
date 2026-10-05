// The biometric token under concurrent requests, against PostgreSQL (plan row W41; spec §5.6
// steps 4 to 6, §8.2 ENG-23 to ENG-25; SR-36, SR-71, SR-72, SR-74; AC-B-78; database contract §5.6
// AT-3, AT-4, AT-C4; review SD-04 and SD-10). A clone of the seed template, the code under test
// as `dems_app`, requests issued together with `Promise.all`.
//
// What each test relies on is stated with it. In one process the units of the pipeline are
// serial; the consuming statement is written so that the result is right even if two units ran
// at the same time, and the last block shows that on real connections of `dems_app`.
import { randomBytes, randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../../test/support/core';
import { ApiFailure } from '../../../../plugins/error-envelope';
import { throttleControl } from '../../../../plugins/throttle';
import { disableUrl, enableUrl } from '../../../../../test/support/admin';
import { MINUTE, SESSION, closeOpenSessions, errorOf, sessionOfToken, storedSessions } from '../../../../../test/support/identity';
import { deviceGet } from '../../../../../test/support/pairing';
import { SIGN_IN_UNIT_LABEL } from '../sign-in';
import { CLAIM_TOKEN } from '../store';
import {
  INVESTIGATOR,
  TECHNICIAN,
  THIRTY_DAYS,
  biometricApp,
  biometricSignIn,
  clearTokens,
  enrol,
  enrolledOperator,
  forgetLimits,
  madeUpToken,
  outcomeOf,
  pairDevice,
  passwordSession,
  portalPost,
  reportFailure,
  revokeUrl,
  sessionCount,
  setEnrolment,
  signInWithToken,
  stateOf,
  statusesOf,
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

beforeAll(async () => {
  owner = db.ownerPool();
  bio = await biometricApp(db);
  tablet = await pairDevice(bio, await supervisorCookie(bio), 'Interview tablet 01');
});

beforeEach(async () => {
  await bio.app.pipeline.drain();
  await clearTokens(owner);
  await closeOpenSessions(owner);
  forgetLimits(bio);
  bio.published.length = 0;
  bio.clock.advance(2 * MINUTE);
});

const now = (): number => bio.clock.now();
const sessionAnswers = async (sessionToken: string): Promise<number> => (await deviceGet(bio.app, SESSION, sessionToken)).statusCode;
const reuses = (): Array<readonly string[]> =>
  bio.published.flatMap((publication) => (publication.kind === 'session.ended' && publication.reason === 'TOKEN_REUSE' ? [publication.sessionIds] : []));

async function expectChainVerifies(): Promise<void> {
  const rows = await readTrail(owner);
  const head = await readHead(owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
}

describe('AC-B-78 (SD-04, AT-C4): two concurrent uses of one valid token', () => {
  // Relies on: the claim is ONE statement whose row count decides (ENG-25). Whichever unit runs
  // first gets the row; the other finds the token used, and a used token is a reuse (spec §5.6
  // step 6) whether it comes a millisecond or a month later.
  const ROUNDS = 25;

  it(`issue exactly one session; the other use answers 401 and is handled as a reuse: the family, with the token that was just issued, is revoked and the session that was just issued is ended (${ROUNDS} rounds)`, async () => {
    const passwordToken = await passwordSession(bio.app, tablet, INVESTIGATOR.username);
    const outcomes: string[] = [];
    let winnersFirst = 0;

    for (let round = 0; round < ROUNDS; round += 1) {
      forgetLimits(bio);
      bio.clock.advance(MINUTE);
      const enrolled = await enrol(bio.app, passwordToken);
      const before = await trailLength(owner);
      const sessions = await sessionCount(owner);
      bio.published.length = 0;

      const answers = await Promise.all([biometricSignIn(bio.app, tablet.credential, enrolled.token), biometricSignIn(bio.app, tablet.credential, enrolled.token)]);

      // Exactly one session, exactly one AUTH_SUCCESS; the other use is the reuse.
      expect(answers.map((answer) => answer.statusCode).sort()).toEqual([200, 401]);
      if (answers[0]?.statusCode === 200) winnersFirst += 1;
      const winner = answers.find((answer) => answer.statusCode === 200)!;
      const loser = answers.find((answer) => answer.statusCode === 401)!;
      expect(errorOf(loser)).toMatchObject({ code: 'INVALID_CREDENTIALS', details: { attemptsRemaining: 4 } });
      expect(await sessionCount(owner)).toBe(sessions + 1);
      const rows = await trailSince(owner, before);
      expect(rows.map((row) => [row.type, row.actorId, row.details['method'], row.details['reason'] ?? null, row.details['sessionsEnded'] ?? null])).toEqual([
        ['AUTH_SUCCESS', INVESTIGATOR.id, 'BIOMETRIC', null, null],
        ['AUTH_FAILED', INVESTIGATOR.id, 'BIOMETRIC', 'TOKEN_REUSE', 1],
      ]);

      // What the winner was handed is already dead: its session is ended, its next token revoked.
      const won = winner.json() as { sessionToken: string; biometricToken: string };
      const session = await sessionOfToken(owner, won.sessionToken);
      expect(session).toMatchObject({ method: 'BIOMETRIC', endReason: 'TOKEN_REUSE', endedAt: now() });
      expect(reuses()).toEqual([[session.id]]);
      expect(await sessionAnswers(won.sessionToken)).toBe(401);
      expect([stateOf(await tokenRow(owner, enrolled.token), now()), stateOf(await tokenRow(owner, won.biometricToken), now())]).toEqual([
        'USED+REVOKED(TOKEN_REUSE)',
        'REVOKED(TOKEN_REUSE)',
      ]);
      expect(outcomeOf(await biometricSignIn(bio.app, tablet.credential, won.biometricToken))).toEqual([401, 'INVALID_CREDENTIALS']);
      outcomes.push(answers.map((answer) => answer.statusCode).join('/'));
    }

    // The password session of the same operator on the same device outlived all of it.
    expect(await sessionAnswers(passwordToken)).toBe(200);
    expect((await storedSessions(owner)).filter((row) => row.endReason === 'TOKEN_REUSE')).toHaveLength(ROUNDS);
    expect((await storedTokens(owner)).filter((row) => row.usedAt === null && row.revokedAt === null)).toEqual([]);
    await expectChainVerifies();
    console.info(
      `[w41] AC-B-78: ${ROUNDS} rounds of two concurrent uses of one token: ${ROUNDS} x (one 200, one 401); ${ROUNDS} sessions issued, each ended with TOKEN_REUSE by the other use; the first request won ${winnersFirst} times; 0 live tokens left`,
    );
  });

  it('eight concurrent uses of one token: one session; the seven others are counted on the device: four answer 401, the fifth failure locks, two find the device locked', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const before = await trailLength(owner);
    const sessions = await sessionCount(owner);

    const answers = await Promise.all(Array.from({ length: 8 }, () => biometricSignIn(bio.app, tablet.credential, enrolled.token)));

    expect(statusesOf(answers)).toEqual({ 200: 1, 401: 4, 423: 3 });
    expect(await sessionCount(owner)).toBe(sessions + 1);
    const rows = await trailSince(owner, before);
    expect(rows.map((row) => row.type)).toEqual(['AUTH_SUCCESS', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_LOCKED', 'AUTH_LOCKED']);
    // Every verified failure is a reuse; only the first has a session to end.
    expect(rows.filter((row) => row.type === 'AUTH_FAILED').map((row) => [row.details['reason'], row.details['sessionsEnded'], row.details['attemptsRemaining']])).toEqual([
      ['TOKEN_REUSE', 1, 4],
      ['TOKEN_REUSE', 0, 3],
      ['TOKEN_REUSE', 0, 2],
      ['TOKEN_REUSE', 0, 1],
      ['TOKEN_REUSE', 0, 0],
    ]);
    expect(reuses()).toHaveLength(1);
    console.info(`[w41] eight concurrent uses of one token: statuses ${JSON.stringify(statusesOf(answers))}; rows ${rows.map((row) => row.type).join(', ')}`);
  });

  it('a later replay is the same reuse as the concurrent one: 401, the family revoked, the session ended, AUTH_FAILED with TOKEN_REUSE', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    // In between the session was used, and time passed.
    expect(await sessionAnswers(signedIn.sessionToken)).toBe(200);
    bio.clock.advance(10 * MINUTE);
    const before = await trailLength(owner);

    const replay = await biometricSignIn(bio.app, tablet.credential, enrolled.token);

    expect(outcomeOf(replay)).toEqual([401, 'INVALID_CREDENTIALS']);
    expect((await trailSince(owner, before)).map((row) => [row.type, row.details['reason'], row.details['sessionsEnded']])).toEqual([['AUTH_FAILED', 'TOKEN_REUSE', 1]]);
    expect(await sessionOfToken(owner, signedIn.sessionToken)).toMatchObject({ endReason: 'TOKEN_REUSE', endedAt: now() });
    expect([stateOf(await tokenRow(owner, enrolled.token), now()), stateOf(await tokenRow(owner, signedIn.biometricToken), now())]).toEqual([
      'USED+REVOKED(TOKEN_REUSE)',
      'REVOKED(TOKEN_REUSE)',
    ]);
  });
});

describe('ENG-24 under concurrency: attempts that arrive together are each counted', () => {
  // Relies on: the attempt is TAKEN as the first step of the unit, before anything is read;
  // taking the fifth attempt locks the device at once.
  it('20 concurrent refused tokens: exactly five are looked up (five AUTH_FAILED, the fifth marked as locking), the other 15 answer 423 with AUTH_LOCKED; the 20 rows are the device\'s whole denial budget', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const before = await trailLength(owner);
    const sessions = await sessionCount(owner);

    const answers = await Promise.all(Array.from({ length: 20 }, (_, index) => biometricSignIn(bio.app, tablet.credential, madeUpToken(String(index % 10)))));

    expect(statusesOf(answers)).toEqual({ 401: 4, 423: 16 });
    const rows = await trailSince(owner, before);
    expect(rows.map((row) => row.type)).toEqual([...Array.from({ length: 5 }, () => 'AUTH_FAILED'), ...Array.from({ length: 15 }, () => 'AUTH_LOCKED')]);
    expect(rows.slice(0, 5).map((row) => row.details['attemptsRemaining'])).toEqual([4, 3, 2, 1, 0]);
    expect(rows[4]?.details['lockedUntil']).toBe(now() + MINUTE);
    expect(await sessionCount(owner)).toBe(sessions);
    // The next request of the device is refused by stage 5, and writes nothing.
    const next = await biometricSignIn(bio.app, tablet.credential, enrolled.token);
    expect(outcomeOf(next)).toEqual([429, 'RATE_LIMITED']);
    expect(await trailLength(owner)).toBe(before + 20);
    // 60 s later the lock and the budget are over, and the token that nobody looked at signs in.
    bio.clock.advance(MINUTE);
    expect((await signInWithToken(bio.app, tablet.credential, enrolled.token)).session.method).toBe('BIOMETRIC');
    await expectChainVerifies();
    console.info(`[w41] 20 concurrent refused tokens: statuses ${JSON.stringify(statusesOf(answers))}; 5 AUTH_FAILED (attemptsRemaining 4, 3, 2, 1, 0), 15 AUTH_LOCKED`);
  });

  it('SR-71: 25 at once, tokens and failure reports mixed: 20 rows, and five answers 429 without a row; all 25 were counted or found the device locked', async () => {
    const before = await trailLength(owner);
    const calls = Array.from({ length: 25 }, (_, index) =>
      index % 2 === 0 ? biometricSignIn(bio.app, tablet.credential, madeUpToken('q')) : reportFailure(bio.app, tablet.credential, INVESTIGATOR.id),
    );

    const answers = await Promise.all(calls);

    const rows = await trailSince(owner, before);
    expect(rows).toHaveLength(20);
    expect(rows.map((row) => row.type)).toEqual([...Array.from({ length: 5 }, () => 'AUTH_FAILED'), ...Array.from({ length: 15 }, () => 'AUTH_LOCKED')]);
    expect(statusesOf(answers)[429]).toBe(5);
    expect(await throttleControl(bio.app).inspect(`device:${tablet.deviceId}`)).toMatchObject({ used: 20, exhausted: true });
    expect(await bio.control.lockout.status(tablet.deviceId, now())).toMatchObject({ locked: true, attemptsRemaining: 0 });
    console.info(`[w41] SR-71: 25 concurrent attempts: statuses ${JSON.stringify(statusesOf(answers))}; 20 rows`);
  });

  it('a reuse that finds no place in the denial budget still revokes the family, ends the session and WRITES its row: the row of a state change; the answer is the budget\'s 429', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    const before = await trailLength(owner);
    const noPlace = new ApiFailure(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.', { headers: { 'retry-after': '41' } });
    const spy = vi.spyOn(bio.app.denialBudget, 'consume').mockRejectedValueOnce(noPlace);
    let replay: LightMyRequestResponse;
    try {
      replay = await biometricSignIn(bio.app, tablet.credential, enrolled.token);
    } finally {
      spy.mockRestore();
    }

    expect(outcomeOf(replay)).toEqual([429, 'RATE_LIMITED']);
    expect(replay.headers['retry-after']).toBe('41');
    expect((await trailSince(owner, before)).map((row) => [row.type, row.details['reason'], row.details['sessionsEnded']])).toEqual([['AUTH_FAILED', 'TOKEN_REUSE', 1]]);
    expect(await sessionOfToken(owner, signedIn.sessionToken)).toMatchObject({ endReason: 'TOKEN_REUSE' });
    expect(stateOf(await tokenRow(owner, signedIn.biometricToken), now())).toBe('REVOKED(TOKEN_REUSE)');
    expect(reuses()).toHaveLength(1);
    // Counted on the device like every failure.
    expect(await bio.control.lockout.status(tablet.deviceId, now())).toMatchObject({ attemptsRemaining: 4 });
  });

  it('a SECOND replay changes nothing any more, so with no place in the budget it is a refusal like any other: 429 and no row', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    await signInWithToken(bio.app, tablet.credential, enrolled.token);
    expect(outcomeOf(await biometricSignIn(bio.app, tablet.credential, enrolled.token))).toEqual([401, 'INVALID_CREDENTIALS']);
    const before = await trailLength(owner);
    const tokens = await storedTokens(owner);
    const spy = vi.spyOn(bio.app.denialBudget, 'consume').mockRejectedValueOnce(new ApiFailure(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.'));
    try {
      expect(outcomeOf(await biometricSignIn(bio.app, tablet.credential, enrolled.token))).toEqual([429, 'RATE_LIMITED']);
    } finally {
      spy.mockRestore();
    }
    expect(await trailLength(owner)).toBe(before);
    expect(await storedTokens(owner)).toEqual(tokens);
    expect(await bio.control.lockout.status(tablet.deviceId, now())).toMatchObject({ attemptsRemaining: 3 });
  });

  it('a token that was claimed and signs nobody in (its operator is disabled) and finds no place in the budget: its row is written too, because the token was used up', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    await owner.query('UPDATE public.operators SET enabled = false WHERE id = $1', [TECHNICIAN.id]);
    const before = await trailLength(owner);
    const spy = vi.spyOn(bio.app.denialBudget, 'consume').mockRejectedValueOnce(new ApiFailure(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.'));
    try {
      expect(outcomeOf(await biometricSignIn(bio.app, tablet.credential, enrolled.token))).toEqual([429, 'RATE_LIMITED']);
    } finally {
      spy.mockRestore();
      await owner.query('UPDATE public.operators SET enabled = true WHERE id = $1', [TECHNICIAN.id]);
    }
    expect((await trailSince(owner, before)).map((row) => [row.type, row.actorId, row.details['reason']])).toEqual([['AUTH_FAILED', TECHNICIAN.id, 'USER_DISABLED']]);
    expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('USED+REVOKED(USER_DISABLED)');
  });

  it('a refusal that changed nothing and finds no place in the budget writes NO row and answers 429; it stays counted', async () => {
    const before = await trailLength(owner);
    const noPlace = new ApiFailure(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.');
    const spy = vi.spyOn(bio.app.denialBudget, 'consume').mockRejectedValue(noPlace);
    try {
      expect(outcomeOf(await biometricSignIn(bio.app, tablet.credential, madeUpToken('r')))).toEqual([429, 'RATE_LIMITED']);
      expect(outcomeOf(await reportFailure(bio.app, tablet.credential, null))).toEqual([429, 'RATE_LIMITED']);
      // During the lock as well: three more take the device to its limit, the next finds it locked.
      for (let attempt = 0; attempt < 3; attempt += 1) await reportFailure(bio.app, tablet.credential, null);
      expect(outcomeOf(await biometricSignIn(bio.app, tablet.credential, madeUpToken('r')))).toEqual([429, 'RATE_LIMITED']);
      expect(outcomeOf(await reportFailure(bio.app, tablet.credential, null))).toEqual([429, 'RATE_LIMITED']);
    } finally {
      spy.mockRestore();
    }
    expect(await trailLength(owner)).toBe(before);
    expect(await bio.control.lockout.status(tablet.deviceId, now())).toMatchObject({ locked: true, attemptsRemaining: 0 });
  });
});

describe('a sign-in racing what retires its token', () => {
  // Relies on: each of the two is one unit, and the units are serial. Whichever runs first, the
  // other sees its committed result: no session and no live token survive the revoke or the
  // disable. Both orders are made to happen: the sign-in's unit first; and the other unit first
  // while the sign-in is already past stage 4 (it was let through as a paired device, as an
  // enabled operator's token), which is the order a free-running pair of requests rarely takes.
  /** Runs `change` to its end at the moment the sign-in's unit is submitted: after stage 4 to 7 of the sign-in, before its unit. */
  function beforeTheSignInUnit(change: () => Promise<unknown>): { restore(): void } {
    const { pipeline } = bio.app;
    const run = pipeline.run.bind(pipeline);
    const spy = vi.spyOn(pipeline, 'run').mockImplementation(((label: string, work: never) =>
      label === SIGN_IN_UNIT_LABEL ? change().then(() => run(label, work)) : run(label, work)) as typeof pipeline.run);
    return { restore: () => spy.mockRestore() };
  }

  it('a revoke of the device: the sign-in first (its session is ended and its next token revoked by the revoke); the revoke first (the sign-in, already past stage 4, answers 401 and issues nothing); and free-running pairs', async () => {
    const outcomes: string[] = [];
    const round = async (order: 'sign-in first' | 'revoke first' | 'free'): Promise<void> => {
      forgetLimits(bio);
      const cookie = await supervisorCookie(bio);
      const spare = await pairDevice(bio, cookie, 'Tablet that is revoked');
      const enrolled = await enrolledOperator(bio.app, spare, INVESTIGATOR.username);
      const sessions = await sessionCount(owner);
      const signIn = (): Promise<LightMyRequestResponse> => biometricSignIn(bio.app, spare.credential, enrolled.token);
      const revoke = (): Promise<LightMyRequestResponse> => portalPost(bio.app, revokeUrl(spare.deviceId), cookie, { reason: 'Revoked while a sign-in is under way' });

      let signedIn: LightMyRequestResponse;
      let revoked: LightMyRequestResponse;
      if (order === 'sign-in first') {
        signedIn = await signIn();
        revoked = await revoke();
        expect(signedIn.statusCode).toBe(200);
      } else if (order === 'revoke first') {
        let pending: LightMyRequestResponse | undefined;
        const hook = beforeTheSignInUnit(async () => {
          pending = await revoke();
        });
        try {
          signedIn = await signIn();
        } finally {
          hook.restore();
        }
        revoked = pending!;
        // The device was PAIRED when stage 4 looked; its token was revoked before the unit ran.
        expect(outcomeOf(signedIn)).toEqual([401, 'INVALID_CREDENTIALS']);
        expect(await sessionCount(owner)).toBe(sessions);
        expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('REVOKED(DEVICE_REVOKED)');
      } else {
        [signedIn, revoked] = await Promise.all([signIn(), revoke()]);
        expect([200, 401, 403]).toContain(signedIn.statusCode);
      }

      expect(revoked.statusCode).toBe(200);
      expect((await storedSessions(owner)).filter((row) => row.deviceId === spare.deviceId && row.endedAt === null)).toEqual([]);
      expect((await storedTokens(owner)).filter((row) => row.deviceId === spare.deviceId && row.usedAt === null && row.revokedAt === null)).toEqual([]);
      if (signedIn.statusCode === 200) expect(await sessionAnswers((signedIn.json() as { sessionToken: string }).sessionToken)).toBe(403);
      outcomes.push(`${order}: ${signedIn.statusCode}`);
    };
    for (const order of ['sign-in first', 'revoke first', 'free', 'free', 'free'] as const) await round(order);
    await expectChainVerifies();
    console.info(`[w41] sign-in racing a revoke of its device: ${outcomes.join('; ')}; no open session and no live token of the device after any round`);
  });

  it('a disable of the operator: the sign-in first (the disable ends its session and revokes its next token); the disable first (the sign-in answers 401 and issues nothing); and free-running pairs', async () => {
    const outcomes: string[] = [];
    const round = async (order: 'sign-in first' | 'disable first' | 'free'): Promise<void> => {
      forgetLimits(bio);
      const cookie = await supervisorCookie(bio);
      const enrolled = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
      const sessions = await sessionCount(owner);
      const signIn = (): Promise<LightMyRequestResponse> => biometricSignIn(bio.app, tablet.credential, enrolled.token);
      const disable = (): Promise<LightMyRequestResponse> => portalPost(bio.app, disableUrl(TECHNICIAN.id), cookie);

      let signedIn: LightMyRequestResponse;
      let disabled: LightMyRequestResponse;
      try {
        if (order === 'sign-in first') {
          signedIn = await signIn();
          disabled = await disable();
          expect(signedIn.statusCode).toBe(200);
        } else if (order === 'disable first') {
          let pending: LightMyRequestResponse | undefined;
          const hook = beforeTheSignInUnit(async () => {
            pending = await disable();
          });
          try {
            signedIn = await signIn();
          } finally {
            hook.restore();
          }
          disabled = pending!;
          expect(outcomeOf(signedIn)).toEqual([401, 'INVALID_CREDENTIALS']);
          expect(await sessionCount(owner)).toBe(sessions);
          expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('REVOKED(USER_DISABLED)');
        } else {
          [signedIn, disabled] = await Promise.all([signIn(), disable()]);
          expect([200, 401]).toContain(signedIn.statusCode);
        }
        expect(disabled.statusCode).toBe(200);
        expect((await storedSessions(owner)).filter((row) => row.operatorId === TECHNICIAN.id && row.endedAt === null)).toEqual([]);
        expect((await storedTokens(owner)).filter((row) => row.operatorId === TECHNICIAN.id && row.usedAt === null && row.revokedAt === null)).toEqual([]);
        if (signedIn.statusCode === 200) expect(await sessionAnswers((signedIn.json() as { sessionToken: string }).sessionToken)).toBe(401);
      } finally {
        expect((await portalPost(bio.app, enableUrl(TECHNICIAN.id), cookie)).statusCode).toBe(200);
      }
      outcomes.push(`${order}: ${signedIn.statusCode}`);
    };
    for (const order of ['sign-in first', 'disable first', 'free', 'free', 'free'] as const) await round(order);
    console.info(`[w41] sign-in racing a disable of its operator: ${outcomes.join('; ')}; no open session and no live token of the operator after any round`);
  });

  it('two enrolments of one session at once: both answer 200, each with a token of its own; one of the two is live, the other was replaced by it', async () => {
    const sessionToken = await passwordSession(bio.app, tablet, INVESTIGATOR.username);
    const answers = await Promise.all([setEnrolment(bio.app, sessionToken, { enabled: true }), setEnrolment(bio.app, sessionToken, { enabled: true })]);
    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200]);
    const tokens = answers.map((answer) => (answer.json() as { token: string }).token);
    expect(tokens[0] === tokens[1]).toBe(false);
    const states = [stateOf(await tokenRow(owner, tokens[0]!), now()), stateOf(await tokenRow(owner, tokens[1]!), now())];
    expect(states.sort()).toEqual(['LIVE', 'REVOKED(REENROLLED)']);
    expect((await storedTokens(owner)).filter((row) => row.usedAt === null && row.revokedAt === null)).toHaveLength(1);
  });
});

describe('statement level: the claim on real connections of dems_app, as two server processes on one database would run it', () => {
  // Relies on: PostgreSQL. An UPDATE that meets a row another transaction has updated waits for
  // that transaction, and then evaluates its WHERE again on the committed row (READ COMMITTED).
  // `used_at IS NULL` is then false, and the statement changes nothing.
  /** A live token row of the tablet and the investigator, written as `dems_owner`. Its hash is of no token. */
  async function liveRow(): Promise<Buffer> {
    await owner.query("UPDATE public.biometric_tokens SET revoked_at = issued_at, revoke_reason = 'DISABLED' WHERE revoked_at IS NULL");
    const hash = randomBytes(32);
    await owner.query(
      'INSERT INTO public.biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [hash, randomUUID(), tablet.deviceId, INVESTIGATOR.id, now(), now() + THIRTY_DAYS],
    );
    return hash;
  }

  it('two transactions claim one token: the second WAITS for the first; after its commit it gets no row (12 rounds); after its rollback it gets the row', async () => {
    const pool = db.appPool();
    let waited = 0;
    for (let round = 0; round < 12; round += 1) {
      const hash = await liveRow();
      const [first, second] = [await pool.connect(), await pool.connect()];
      try {
        await first.query('BEGIN');
        await second.query('BEGIN');
        expect((await first.query(CLAIM_TOKEN, [hash, now() + 1, tablet.deviceId])).rowCount).toBe(1);
        const claim = second.query(CLAIM_TOKEN, [hash, now() + 2, tablet.deviceId]);
        const state = await Promise.race([claim.then(() => 'answered'), new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 60))]);
        if (state === 'waiting') waited += 1;
        await first.query('COMMIT');
        expect((await claim).rowCount).toBe(0);
        await second.query('COMMIT');
      } finally {
        first.release();
        second.release();
      }
      const { rows } = await owner.query<{ used_at: string }>('SELECT used_at FROM public.biometric_tokens WHERE token_hash = $1', [hash]);
      expect(Number(rows[0]?.used_at)).toBe(now() + 1);
    }
    expect(waited).toBe(12);

    // The first transaction fails: its claim is undone, and the one that waited owns the use.
    const hash = await liveRow();
    const [first, second] = [await pool.connect(), await pool.connect()];
    try {
      await first.query('BEGIN');
      await second.query('BEGIN');
      expect((await first.query(CLAIM_TOKEN, [hash, now() + 1, tablet.deviceId])).rowCount).toBe(1);
      const claim = second.query(CLAIM_TOKEN, [hash, now() + 2, tablet.deviceId]);
      await first.query('ROLLBACK');
      expect((await claim).rowCount).toBe(1);
      await second.query('COMMIT');
    } finally {
      first.release();
      second.release();
    }
    console.info('[w41] statement level: 12 rounds of two transactions claiming one token: the second waited 12 times and got 0 rows 12 times; after a rollback of the first it got the row');
  });

  it('free-running: 60 rounds of four connections claiming one token at once: one row per round, never two and never none', async () => {
    const pool = db.appPool();
    const perRound: number[] = [];
    for (let round = 0; round < 60; round += 1) {
      const hash = await liveRow();
      const results = await Promise.all(Array.from({ length: 4 }, (_, index) => pool.query(CLAIM_TOKEN, [hash, now() + 1 + index, tablet.deviceId])));
      perRound.push(results.reduce((sum, result) => sum + (result.rowCount ?? 0), 0));
    }
    expect(perRound.every((count) => count === 1)).toBe(true);
    console.info(`[w41] statement level, free-running: 60 rounds x 4 connections: ${perRound.filter((count) => count === 1).length} rounds with exactly one row`);
  });

  it('the claim states its whole predicate: another device, a used, a revoked and an expired token give no row and change nothing', async () => {
    const pool = db.appPool();
    const unchanged = async (hash: Buffer): Promise<void> => {
      const { rows: beforeRows } = await owner.query('SELECT used_at, revoked_at FROM public.biometric_tokens WHERE token_hash = $1', [hash]);
      expect((await pool.query(CLAIM_TOKEN, [hash, now() + 5, tablet.deviceId])).rowCount).toBe(0);
      const { rows: afterRows } = await owner.query('SELECT used_at, revoked_at FROM public.biometric_tokens WHERE token_hash = $1', [hash]);
      expect(afterRows).toEqual(beforeRows);
    };
    // Another device presents it.
    const other = await liveRow();
    expect((await pool.query(CLAIM_TOKEN, [other, now() + 5, 'DEV-9999'])).rowCount).toBe(0);
    // Past its time: at the limit itself it is no longer good.
    expect((await pool.query(CLAIM_TOKEN, [other, now() + THIRTY_DAYS, tablet.deviceId])).rowCount).toBe(0);
    expect((await pool.query(CLAIM_TOKEN, [other, now() + THIRTY_DAYS - 1, tablet.deviceId])).rowCount).toBe(1);
    // Used now.
    await unchanged(other);
    // Revoked.
    const revoked = await liveRow();
    await owner.query("UPDATE public.biometric_tokens SET revoked_at = issued_at, revoke_reason = 'DISABLED' WHERE token_hash = $1", [revoked]);
    await unchanged(revoked);
    // The runtime role cannot do more to a token than its three columns allow.
    await expect(pool.query('UPDATE public.biometric_tokens SET operator_id = $2 WHERE token_hash = $1', [revoked, TECHNICIAN.id])).rejects.toMatchObject({ code: '42501' });
    await expect(pool.query('DELETE FROM public.biometric_tokens WHERE token_hash = $1', [revoked])).rejects.toMatchObject({ code: '42501' });
  });
});
