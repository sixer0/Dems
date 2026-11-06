// The pairing module under concurrent requests, against PostgreSQL (plan row W32; spec §6.1
// "Guessing bound", §8.2 ENG-23 to ENG-25; SR-27, SR-71, SR-72; AC-B-75 to AC-B-77; database
// contract §5.6 AT-1 to AT-5, AT-C2, AT-C3, T-AT-2, T-AT-3; security design review SD-03, SD-04;
// decision D18 CF-1). A clone of the seed template, the code under test as `dems_app`.
//
// What each test relies on is stated with it. In one process the units of the pipeline are
// serial; the statements are written so that the result is right even if two units ran at the
// same time, and the blocks "statement level" show that on real connections of `dems_app`.
//
// No code and no credential is printed: what is printed are statuses, audit types and counts.
import type { AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { sqlStateOf } from '../../../core';
import { throttleControl } from '../../../plugins/throttle';
import { MINUTE, SESSION, TOUCH, deviceSignIn, errorOf, sessionOfToken, type Headers } from '../../../../test/support/identity';
import { CANCEL_ACTIVE_CODE, CONSUME_REDEEM_ATTEMPT, EXHAUST_CODE, INSERT_CODE, REDEEM_CODE, REVOKE_DEVICE, SET_NEXT_CREDENTIAL, UNPAIR_DEVICE } from '../store';
import {
  CODE,
  DEVICE,
  INVESTIGATOR,
  ROTATE,
  SUPERVISOR,
  UNPAIR,
  deviceGet,
  devicePost,
  forgetLimits,
  issueCode,
  outcomeOf,
  pairDevice,
  pairingApp,
  portalPost,
  redeem,
  revokeUrl,
  statusesOf,
  storedCode,
  storedCodes,
  storedDevice,
  storedDevices,
  supervisorCookie,
  type PairedTestDevice,
  type PairingApp,
} from '../../../../test/support/pairing';

const db = useTestDatabase({ template: 'seed' });
let pairing: PairingApp;
let owner: Pool;
let cookie: Headers;

beforeAll(async () => {
  owner = db.ownerPool();
  pairing = await pairingApp(db);
});

beforeEach(async () => {
  await owner.query("UPDATE public.pairing_codes SET state = 'CANCELLED', closed_at = issued_at WHERE state = 'ACTIVE'");
  forgetLimits(pairing);
  // Each test in its own stretch of the server clock.
  pairing.clock.advance(10 * MINUTE);
  cookie = await supervisorCookie(pairing);
  pairing.published.length = 0;
});

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const trailSince = async (from: number): Promise<AuditRow[]> => (await readTrail(owner)).slice(from);
const typesOf = (rows: readonly AuditRow[]): Record<string, number> =>
  rows.reduce<Record<string, number>>((count, row) => ({ ...count, [row.type]: (count[row.type] ?? 0) + 1 }), {});
/** `count` wrong codes, none of them `code`, all different. */
const wrongCodes = (code: string, count: number): string[] => Array.from({ length: count }, (_, index) => String((Number(code) + 1 + index) % 1_000_000).padStart(6, '0'));

/** The device ID in the one answer of a burst that paired. */
function pairedDeviceIdOf(answers: readonly LightMyRequestResponse[]): string {
  const paired = answers.find((answer) => answer.statusCode === 201);
  if (paired === undefined) throw new Error('no redeem of the burst answered 201');
  return (paired.json() as { deviceId: string }).deviceId;
}

async function expectChainVerifies(): Promise<void> {
  const rows = await readTrail(owner);
  const head = await readHead(owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
}

describe('AC-B-76 (SD-04, AT-C2; decision D18 CF-1): concurrent wrong redeems never get more guesses than PR-P4 and PR-P5 allow', () => {
  // Relies on: (1) the attempt is TAKEN from the redeem lock as the first thing of the unit,
  // before any statement (ENG-24); the counter changes before the unit's first await, and taking
  // the third attempt locks at once. So three redeems reach the code, whatever the order in
  // which the 20 arrive. (2) Each of the three takes its attempt from the code with
  //   UPDATE public.pairing_codes SET failed_attempts = failed_attempts + 1
  //    WHERE state = 'ACTIVE' AND expires_at > $1 AND failed_attempts < $2 RETURNING id, code_hash, failed_attempts
  // BEFORE it compares; the fifth closes the code with
  //   UPDATE public.pairing_codes SET state = 'EXHAUSTED', closed_at = $1 WHERE id = $2 AND state = 'ACTIVE' AND failed_attempts = $3 RETURNING id
  it('of 20 at once exactly three are counted and the other 17 find redeeming locked; after the lock a second burst of 20 counts exactly two more and the code is closed as EXHAUSTED with exactly five', async () => {
    const issued = await issueCode(pairing, cookie);
    const before = await trailLength();
    const start = pairing.clock.now();

    // ── The first burst ──────────────────────────────────────────────────────────────────────
    const first = await Promise.all(wrongCodes(issued.code, 20).map((code) => redeem(pairing.app, code)));
    const firstRows = await trailSince(before);
    const failed = firstRows.filter((row) => row.type === 'PAIRING_FAILED');
    const locked = firstRows.filter((row) => row.type === 'PAIRING_LOCKED');

    expect(typesOf(firstRows)).toEqual({ PAIRING_FAILED: 3, PAIRING_LOCKED: 17 });
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'ACTIVE', failedAttempts: 3 });
    // In the order of the chain: two attempts left, one, and the third failure says it locked.
    expect(failed.map((row) => [row.details['attemptsRemaining'], row.details['lockedUntil']])).toEqual([
      [2, null],
      [1, null],
      [0, start + MINUTE],
    ]);
    expect(locked.every((row) => row.details['lockedUntil'] === start + MINUTE)).toBe(true);
    // The two counted failures before the lock answer 401; the locking failure and the 17 that
    // found redeeming locked answer 423 (the locking failure as in the simulator, decision D78 DN-3).
    expect(statusesOf(first)).toEqual({ 401: 2, 423: 18 });
    for (const answer of first.filter((candidate) => candidate.statusCode === 423)) {
      expect(errorOf(answer)).toMatchObject({ code: 'LOCKED', details: { lockedUntil: start + MINUTE, retryInMs: MINUTE } });
    }
    console.info(
      `[w32] AC-B-76 burst 1: 20 concurrent wrong redeems: statuses ${JSON.stringify(statusesOf(first))}; rows ${JSON.stringify(typesOf(firstRows))}; ` +
        `PAIRING_FAILED attemptsRemaining ${failed.map((row) => String(row.details['attemptsRemaining'])).join(', ')}; failed_attempts of the code 3, state ACTIVE`,
    );

    // The burst used the whole denial budget of the class (20 audited refusals in 60 s): the
    // next request of the key is answered 429 at stage 5 and writes no row (SR-71).
    expect(outcomeOf(await redeem(pairing.app, issued.code))).toEqual([429, 'RATE_LIMITED']);
    expect(await trailSince(before)).toHaveLength(20);

    // ── After the lock: the second burst ─────────────────────────────────────────────────────
    pairing.clock.advance(MINUTE);
    const mark = await trailLength();
    const second = await Promise.all(wrongCodes(issued.code, 20).map((code) => redeem(pairing.app, code)));
    const secondRows = await trailSince(mark);

    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'EXHAUSTED', failedAttempts: 5, closedAt: start + MINUTE, closedBy: null });
    // Two attempts were taken from the code (4, 5: closed). The third attempt of this window
    // found no usable code any more: a failure all the same, and the locking one.
    expect(secondRows.map((row) => row.type).slice(0, 4)).toEqual(['PAIRING_FAILED', 'PAIRING_FAILED', 'PAIRING_CODE_CLOSED', 'PAIRING_FAILED']);
    expect(typesOf(secondRows)).toEqual({ PAIRING_FAILED: 3, PAIRING_CODE_CLOSED: 1, PAIRING_LOCKED: 17 });
    expect(secondRows.find((row) => row.type === 'PAIRING_CODE_CLOSED')?.details).toEqual({ codeId: issued.codeId, reason: 'EXHAUSTED' });
    expect(statusesOf(second)).toEqual({ 401: 2, 423: 18 });
    console.info(
      `[w32] AC-B-76 burst 2 (60 s later): statuses ${JSON.stringify(statusesOf(second))}; rows ${JSON.stringify(typesOf(secondRows))}; ` +
        'failed_attempts of the code 5, state EXHAUSTED',
    );

    // No device came of 40 guesses, and the right code is of no use any more.
    expect((await storedDevices(owner)).filter((device) => device.pairedWithCodeId === issued.codeId)).toEqual([]);
    pairing.clock.advance(MINUTE);
    expect(outcomeOf(await redeem(pairing.app, issued.code))).toEqual([401, 'INVALID_CODE']);
    await expectChainVerifies();
  });

  it('the right code among a burst is one of the three or is refused by the lock: never a fourth comparison', async () => {
    const issued = await issueCode(pairing, cookie);
    const codes = wrongCodes(issued.code, 12);
    codes[7] = issued.code;
    const answers = await Promise.all(codes.map((code) => redeem(pairing.app, code)));
    // The right one arrived eighth: three attempts were taken before it.
    expect(answers[7]?.statusCode).toBe(423);
    expect(statusesOf(answers)).toEqual({ 401: 2, 423: 10 });
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'ACTIVE', failedAttempts: 3 });
    expect((await storedDevices(owner)).filter((device) => device.pairedWithCodeId === issued.codeId)).toEqual([]);
  });

  // Relies on: every statement of the pool runs on its own connection in its own transaction at
  // READ COMMITTED; the consuming UPDATE locks the one ACTIVE row and re-evaluates its WHERE on
  // the committed row [PG-24]. No memory lock is in play at this level.
  it('statement level (T-AT-2, the review\'s wording): of 20 consuming statements on real connections exactly five return a row, with the values 1 to 5; the fifth closes the code', async () => {
    const issued = await issueCode(pairing, cookie);
    const pool = db.appPool();
    const now = pairing.clock.now();
    const results = await Promise.all(Array.from({ length: 20 }, () => pool.query<{ id: string; failed_attempts: number }>(CONSUME_REDEEM_ATTEMPT, [now, 5])));
    const taken = results.filter((result) => result.rowCount === 1).map((result) => result.rows[0]?.failed_attempts);
    expect(taken.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(results.filter((result) => result.rowCount === 0)).toHaveLength(15);
    // Each that got 5 runs the closing statement; only one did, and a second run closes nothing.
    expect((await pool.query(EXHAUST_CODE, [now, issued.codeId, 5])).rowCount).toBe(1);
    expect((await pool.query(EXHAUST_CODE, [now, issued.codeId, 5])).rowCount).toBe(0);
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'EXHAUSTED', failedAttempts: 5, closedAt: now });
    // The table's own bound is the last line: a sixth attempt cannot be stored.
    await expect(owner.query('UPDATE public.pairing_codes SET failed_attempts = 6 WHERE id = $1', [issued.codeId])).rejects.toMatchObject({ code: '23514' });
  });
});

describe('SR-71: the refusals of a redeem count against the denial budget', () => {
  // Relies on: `app.denialBudget.consume(request)` is called inside the unit BEFORE the refusal
  // row is written; with no place left the unit still commits what it counted, and the 429 is
  // thrown after it.
  it('of 25 at once the budget lets 20 write a row; the others answer 429 and write none', async () => {
    const issued = await issueCode(pairing, cookie);
    const before = await trailLength();
    const answers = await Promise.all(wrongCodes(issued.code, 25).map((code) => redeem(pairing.app, code)));
    const rows = await trailSince(before);
    expect(typesOf(rows)).toEqual({ PAIRING_FAILED: 3, PAIRING_LOCKED: 17 });
    expect(statusesOf(answers)).toEqual({ 401: 2, 423: 18, 429: 5 });
    expect(await throttleControl(pairing.app).inspect('class:local')).toMatchObject({ used: 20, exhausted: true });
  });

  it('a counted attempt that finds no place in the budget answers 429 and writes no PAIRING_FAILED row, but stays counted: the code is closed at five all the same', async () => {
    const issued = await issueCode(pairing, cookie);
    const [wrong] = wrongCodes(issued.code, 1);
    // 19 audited refusals: three counted failures and 16 attempts during the lock.
    for (let attempt = 0; attempt < 19; attempt += 1) await redeem(pairing.app, wrong ?? '');
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'ACTIVE', failedAttempts: 3 });
    expect(await throttleControl(pairing.app).inspect('class:local')).toMatchObject({ used: 19, exhausted: false });
    // The lock is lifted by the test (it is memory state); the budget of the key stays as it is.
    pairing.pairing.lock.reset();
    const before = await trailLength();

    // Two at once: both pass stage 5 (19 of 20), the first takes the last place.
    const answers = await Promise.all([redeem(pairing.app, wrong ?? ''), redeem(pairing.app, wrong ?? '')]);
    expect(answers.map((answer) => answer.statusCode)).toEqual([401, 429]);
    expect(answers[1]?.headers['retry-after']).toBeDefined();
    // The second attempt was the fifth of the code: no refusal row, and yet counted and closed.
    expect((await trailSince(before)).map((row) => [row.type, row.details])).toEqual([
      ['PAIRING_FAILED', { attemptsRemaining: 2, lockedUntil: null }],
      ['PAIRING_CODE_CLOSED', { codeId: issued.codeId, reason: 'EXHAUSTED' }],
    ]);
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'EXHAUSTED', failedAttempts: 5 });
    expect(await pairing.pairing.lock.status(pairing.clock.now())).toMatchObject({ locked: false, attemptsRemaining: 1 });
    await expectChainVerifies();
  });
});

describe('AC-B-77 (SD-04, AT-C3): two concurrent redeems of the right code', () => {
  // Relies on: the consuming UPDATE of the first unit locks the code row; its
  //   UPDATE public.pairing_codes SET state = 'REDEEMED', closed_at = $1, failed_attempts = failed_attempts - 1
  //    WHERE id = $2 AND state = 'ACTIVE' AND expires_at > $1 RETURNING id
  // returns one row to exactly one request (ENG-25). The other finds no ACTIVE code and gets
  // the generic answer. The unique key on `paired_with_code_id` is the last line.
  it('give one 201 and one 401 INVALID_CODE; exactly one device row and one PAIRING_SUCCESS row exist', async () => {
    const issued = await issueCode(pairing, cookie);
    const before = await trailLength();
    const devicesBefore = (await storedDevices(owner)).length;

    const answers = await Promise.all([redeem(pairing.app, issued.code), redeem(pairing.app, issued.code)]);
    // Whichever of the two came first: one 201 and one generic 401.
    expect(answers.map(outcomeOf).sort()).toEqual([
      [201, null],
      [401, 'INVALID_CODE'],
    ]);
    const devices = (await storedDevices(owner)).filter((device) => device.pairedWithCodeId === issued.codeId);
    expect(devices).toHaveLength(1);
    expect(await storedDevices(owner)).toHaveLength(devicesBefore + 1);
    expect(devices[0]).toMatchObject({ id: pairedDeviceIdOf(answers), state: 'PAIRED', currentHashBytes: 32 });
    const rows = await trailSince(before);
    expect(rows.map((row) => [row.type, row.deviceId])).toEqual([
      ['PAIRING_SUCCESS', devices[0]?.id],
      ['PAIRING_FAILED', null],
    ]);
    // The code is REDEEMED with the failed-attempt count it had before.
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'REDEEMED', failedAttempts: 0 });
    console.info(`[w32] AC-B-77: two concurrent redeems of the right code: ${JSON.stringify(answers.map(outcomeOf).sort())}; 1 device row, rows ${JSON.stringify(typesOf(rows))}`);
    await expectChainVerifies();
  });

  it('ten at once pair one device', async () => {
    const issued = await issueCode(pairing, cookie);
    const answers = await Promise.all(Array.from({ length: 10 }, () => redeem(pairing.app, issued.code)));
    expect(statusesOf(answers)[201]).toBe(1);
    expect((await storedDevices(owner)).filter((device) => device.pairedWithCodeId === issued.codeId)).toHaveLength(1);
    // The device counter moved by one: the next device gets the next number.
    const paired = pairedDeviceIdOf(answers);
    forgetLimits(pairing);
    const next = await pairDevice(pairing, cookie);
    expect(Number(next.deviceId.slice(4))).toBe(Number(paired.slice(4)) + 1);
  });

  it('statement level (T-AT-3): the second consuming statement waits for the first transaction and then finds no ACTIVE code', async () => {
    const issued = await issueCode(pairing, cookie);
    const pool = db.appPool();
    const now = pairing.clock.now();
    const [first, second] = [await pool.connect(), await pool.connect()];
    try {
      await first.query('BEGIN');
      await second.query('BEGIN');
      expect((await first.query(CONSUME_REDEEM_ATTEMPT, [now, 5])).rows).toMatchObject([{ id: issued.codeId, failed_attempts: 1 }]);
      const waiting = second.query(CONSUME_REDEEM_ATTEMPT, [now, 5]);
      const state = await Promise.race([waiting.then(() => 'answered'), new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 150))]);
      expect(state).toBe('waiting');
      expect((await first.query(REDEEM_CODE, [now, issued.codeId])).rowCount).toBe(1);
      await first.query('COMMIT');
      expect((await waiting).rowCount).toBe(0);
      // And a redeem statement for a code that is REDEEMED changes nothing.
      expect((await second.query(REDEEM_CODE, [now, issued.codeId])).rowCount).toBe(0);
      await second.query('COMMIT');
    } finally {
      first.release();
      second.release();
    }
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'REDEEMED', failedAttempts: 0, closedAt: now });
  });
});

describe('two concurrent issues leave exactly one ACTIVE code (PR-P3)', () => {
  // Relies on: each issue is one unit that closes what stands with
  //   UPDATE public.pairing_codes SET state = 'CANCELLED', closed_at = $1, closed_by_operator_id = $2 WHERE state = 'ACTIVE' RETURNING id
  // and then inserts; the unique index `pairing_codes_one_active_key` refuses a second ACTIVE
  // row, whatever ran before; the two code IDs come from one counter statement each (AT-5).
  it('both answer 201 with different code IDs; the first is cancelled by the second; one row is ACTIVE', async () => {
    const before = await trailLength();
    const answers = await Promise.all([portalPost(pairing.app, CODE, cookie), portalPost(pairing.app, CODE, cookie), portalPost(pairing.app, CODE, cookie)]);
    expect(answers.map((answer) => answer.statusCode)).toEqual([201, 201, 201]);
    const issued = answers.map((answer) => answer.json() as { codeId: string; code: string });
    // In the order in which the three units ran, which is the order of the counter.
    const ids = issued.map((answer) => answer.codeId).sort();
    expect(new Set(ids).size).toBe(3);
    const stored = (await storedCodes(owner)).filter((code) => ids.includes(code.id));
    expect(stored.map((code) => code.state)).toEqual(['CANCELLED', 'CANCELLED', 'ACTIVE']);
    expect((await storedCodes(owner)).filter((code) => code.state === 'ACTIVE')).toHaveLength(1);
    expect((await trailSince(before)).map((row) => [row.type, row.details['codeId']])).toEqual([
      ['PAIRING_CODE_ISSUED', ids[0]],
      ['PAIRING_CODE_CLOSED', ids[0]],
      ['PAIRING_CODE_ISSUED', ids[1]],
      ['PAIRING_CODE_CLOSED', ids[1]],
      ['PAIRING_CODE_ISSUED', ids[2]],
    ]);
    // Only the code that was issued last pairs.
    const last = issued.find((answer) => answer.codeId === ids[2]);
    expect((await redeem(pairing.app, last?.code ?? '')).statusCode).toBe(201);
  });

  it('statement level: a second ACTIVE row waits for the first transaction and is then refused by the unique index (23505); a second cancel cancels nothing', async () => {
    const pool = db.appPool();
    const now = pairing.clock.now();
    const [first, second] = [await pool.connect(), await pool.connect()];
    try {
      await first.query('BEGIN');
      await second.query('BEGIN');
      await first.query(INSERT_CODE, ['PCD-800001', Buffer.alloc(32, 1), SUPERVISOR.id, now, now + 300_000]);
      const waiting = second.query(INSERT_CODE, ['PCD-800002', Buffer.alloc(32, 2), SUPERVISOR.id, now, now + 300_000]).then(
        () => 'inserted',
        (error: unknown) => sqlStateOf(error),
      );
      const state = await Promise.race([waiting, new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 150))]);
      expect(state).toBe('waiting');
      await first.query('COMMIT');
      expect(await waiting).toBe('23505');
      await second.query('ROLLBACK');

      await first.query('BEGIN');
      await second.query('BEGIN');
      expect((await first.query(CANCEL_ACTIVE_CODE, [now, SUPERVISOR.id])).rows).toEqual([{ id: 'PCD-800001' }]);
      const cancel = second.query(CANCEL_ACTIVE_CODE, [now, INVESTIGATOR.id]);
      await first.query('COMMIT');
      expect((await cancel).rowCount).toBe(0);
      await second.query('COMMIT');
    } finally {
      first.release();
      second.release();
    }
    expect(await storedCode(owner, 'PCD-800001')).toMatchObject({ state: 'CANCELLED', closedBy: SUPERVISOR.id });
    expect((await storedCodes(owner)).find((code) => code.id === 'PCD-800002')).toBeUndefined();
  });
});

describe('a revoke racing requests of that device (SR-34, SR-35)', () => {
  // Relies on: the revoke is one unit whose state change is
  //   UPDATE public.paired_devices SET state = 'REVOKED', ... WHERE id = $1 AND state = 'PAIRED' RETURNING id
  // with the end of the device's sessions in the same transaction. A request that stage 4
  // resolved before that commit is in flight; a device operation of such a request states the
  // state again in its own statement (`... AND d.state = 'PAIRED'`, `... WHERE id = $1 AND state
  // = 'PAIRED'`), and a POST of an operator's session is refused by the activity statement,
  // which never writes on an ended session. Every request resolved after the commit is refused.
  it('the device is revoked exactly once; every answer is that of a request in flight or a refusal; nothing of the device succeeds afterwards', async () => {
    const device = await pairDevice(pairing, cookie);
    const token = ((await deviceSignIn(pairing.app, device.credential, INVESTIGATOR.username)).json() as { sessionToken: string }).sessionToken;
    pairing.clock.advance(5_000);
    const before = await trailLength();
    pairing.published.length = 0;

    const answers: LightMyRequestResponse[] = await Promise.all([
      deviceGet(pairing.app, DEVICE, device.credential),
      devicePost(pairing.app, TOUCH, token),
      devicePost(pairing.app, ROTATE, device.credential),
      portalPost(pairing.app, revokeUrl(device.deviceId), cookie, { reason: 'Revoked while it was in use' }),
      deviceGet(pairing.app, SESSION, token),
      devicePost(pairing.app, ROTATE, token),
      portalPost(pairing.app, revokeUrl(device.deviceId), cookie, { reason: 'Revoked a second time' }),
      deviceGet(pairing.app, DEVICE, device.credential),
      devicePost(pairing.app, TOUCH, token),
      // By design (decision D118): one more racer, at the end so that no index moves: a rotation with the device credential.
      devicePost(pairing.app, ROTATE, device.credential),
    ]);
    const [, , , revokeOne, , , revokeTwo] = answers;
    expect([revokeOne?.statusCode, revokeTwo?.statusCode].sort()).toEqual([200, 409]);
    for (const [index, answer] of answers.entries()) {
      if (index === 3 || index === 6) continue;
      // In flight (2xx), refused as a retired device (403), or its session ended under it (401).
      expect([200, 401, 403], `answer ${index}`).toContain(answer.statusCode);
      // By design (finding CPS1-3, decisions D113 and D118): answer 5 is the rotation with the
      // operator's SESSION token. Decided before the revoke commits it is the refusal of the
      // condition (DEVICE_NOT_PAIRED), after it DEVICE_REVOKED; it is never a 200, whoever wins.
      if (index === 5) expect(answer.statusCode, 'a session token never rotates').not.toBe(200);
      if (answer.statusCode === 403) expect(index === 5 ? ['DEVICE_REVOKED', 'DEVICE_NOT_PAIRED'] : ['DEVICE_REVOKED']).toContain(errorOf(answer).code);
    }

    const rows = await trailSince(before);
    expect(rows.filter((row) => row.type === 'DEVICE_REVOKED')).toHaveLength(1);
    expect(rows.filter((row) => !['DEVICE_REVOKED', 'DEVICE_CREDENTIAL_ROTATED', 'ACCESS_DENIED'].includes(row.type))).toEqual([]);
    expect(pairing.published.filter((publication) => publication.kind === 'device.revoked')).toEqual([{ kind: 'device.revoked', deviceId: device.deviceId, reason: 'REVOKED' }]);
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ state: 'REVOKED' });
    expect(await sessionOfToken(owner, token)).toMatchObject({ endReason: 'DEVICE_REVOKED' });

    // After the race: every call of the device is refused, and the ended rows are not written again.
    const stored = await sessionOfToken(owner, token);
    pairing.clock.advance(MINUTE);
    forgetLimits(pairing);
    for (const call of [
      await deviceGet(pairing.app, DEVICE, device.credential),
      await devicePost(pairing.app, ROTATE, device.credential),
      await deviceGet(pairing.app, SESSION, token),
      await devicePost(pairing.app, TOUCH, token),
    ]) {
      expect(outcomeOf(call)).toEqual([403, 'DEVICE_REVOKED']);
    }
    // By design (decision D118): the appended racer is answered in flight (200) or refused as a
    // retired device. A credential it returned succeeds no more than the old one: presented once,
    // it is refused (403 DEVICE_REVOKED; 401 if another rotation in flight replaced it).
    const appended = answers[9];
    expect([200, 403]).toContain(appended?.statusCode);
    if (appended?.statusCode === 200) {
      const [status, code] = outcomeOf(await deviceGet(pairing.app, DEVICE, (appended.json() as { deviceCredential: string }).deviceCredential));
      expect([401, 403]).toContain(status);
      if (status === 403) expect(code).toBe('DEVICE_REVOKED');
    }
    expect(await sessionOfToken(owner, token)).toEqual(stored);
    await expectChainVerifies();
  });

  it('a request that stage 4 resolved a moment before the revoke committed: each device operation states the state again, answers 403 DEVICE_REVOKED, changes nothing and writes no row', async () => {
    const device = await pairDevice(pairing, cookie);
    expect((await portalPost(pairing.app, revokeUrl(device.deviceId), cookie, { reason: 'Revoked between stage 4 and the handler' })).statusCode).toBe(200);
    const real = pairing.app.deviceResolver;
    const stillPaired = { status: 'PAIRED', deviceId: device.deviceId } as const;
    // What stage 4 answered just before the commit: the request is in flight as a paired device.
    // (`deviceState` is the real one: the read of another module's unit is no part of what stage 4 answered.)
    pairing.app.seams.replace('deviceResolver', { resolveCredential: async () => stillPaired, resolveDevice: async () => stillPaired, deviceState: real.deviceState });
    try {
      const before = await trailLength();
      pairing.published.length = 0;
      for (const call of [
        await deviceGet(pairing.app, DEVICE, device.credential),
        await devicePost(pairing.app, ROTATE, device.credential),
        await devicePost(pairing.app, UNPAIR, device.credential),
      ]) {
        expect(outcomeOf(call)).toEqual([403, 'DEVICE_REVOKED']);
        expect(errorOf(call).details).toEqual({ reason: 'DEVICE_REVOKED' });
      }
      // The revocation's own row is the record: the module writes none for these, and publishes nothing.
      expect(await trailSince(before)).toEqual([]);
      expect(pairing.published).toEqual([]);
      expect(await storedDevice(owner, device.deviceId)).toMatchObject({ state: 'REVOKED', hasNextHash: false, rotatedAt: null });
    } finally {
      pairing.app.seams.replace('deviceResolver', real);
    }
    // With the real resolver back the same calls are the guard's refusals.
    expect(outcomeOf(await deviceGet(pairing.app, DEVICE, device.credential))).toEqual([403, 'DEVICE_REVOKED']);
  });

  it('statement level: an unpair that waits behind a revoke changes nothing; a rotation behind a committed revoke stores nothing', async () => {
    const device = await pairDevice(pairing, cookie);
    const pool = db.appPool();
    const now = pairing.clock.now();
    const [first, second] = [await pool.connect(), await pool.connect()];
    try {
      await first.query('BEGIN');
      await second.query('BEGIN');
      expect((await first.query(REVOKE_DEVICE, [device.deviceId, now, SUPERVISOR.id, 'Statement-level revoke'])).rowCount).toBe(1);
      const unpair = second.query(UNPAIR_DEVICE, [device.deviceId, now]);
      const state = await Promise.race([unpair.then(() => 'answered'), new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 150))]);
      expect(state).toBe('waiting');
      await first.query('COMMIT');
      expect((await unpair).rowCount).toBe(0);
      expect((await second.query(SET_NEXT_CREDENTIAL, [device.deviceId, Buffer.alloc(32, 3), now])).rowCount).toBe(0);
      expect((await second.query(REVOKE_DEVICE, [device.deviceId, now, SUPERVISOR.id, 'A second revoke'])).rowCount).toBe(0);
      await second.query('COMMIT');
    } finally {
      first.release();
      second.release();
    }
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ state: 'REVOKED', revokeReason: 'Statement-level revoke', hasNextHash: false });
  });
});

describe('AC-B-75 (SD-03, RB-6): retired device credentials share the class bucket', () => {
  // Relies on: a retired credential is not a principal, so stage 5 and `denialBudget.consume`
  // key its request by the class of its Origin (`class:local`), never by the device it names.
  it('25 calls that present five different retired credentials write at most 20 rows in all; the other five answer 429; after the window a denied call is audited again', async () => {
    const devices: PairedTestDevice[] = [];
    for (let index = 0; index < 5; index += 1) devices.push(await pairDevice(pairing, cookie, `Retired tablet ${index + 1}`));
    for (const device of devices) expect((await portalPost(pairing.app, revokeUrl(device.deviceId), cookie, { reason: 'Retired for the denial budget test' })).statusCode).toBe(200);
    pairing.clock.advance(MINUTE);
    const before = await trailLength();

    const answers: LightMyRequestResponse[] = [];
    for (let call = 0; call < 25; call += 1) answers.push(await deviceGet(pairing.app, DEVICE, devices[call % 5]?.credential ?? null));
    const rows = await trailSince(before);

    expect(rows).toHaveLength(20);
    expect(rows.every((row) => row.type === 'ACCESS_DENIED' && row.actorId === null && row.details['reason'] === 'DEVICE_REVOKED')).toBe(true);
    // Each of the five devices wrote four of them: the bucket is shared, not one per credential.
    expect(typesOf(rows.map((row) => ({ ...row, type: row.deviceId ?? '' }) as AuditRow))).toEqual(Object.fromEntries(devices.map((device) => [device.deviceId, 4])));
    expect(statusesOf(answers)).toEqual({ 403: 20, 429: 5 });
    expect(answers.slice(0, 20).every((answer) => answer.statusCode === 403)).toBe(true);
    const throttle = throttleControl(pairing.app);
    expect(await throttle.inspect('class:local')).toMatchObject({ used: 20, exhausted: true });
    for (const device of devices) expect(await throttle.inspect(`device:${device.deviceId}`)).toMatchObject({ used: 0 });
    console.info(`[w32] AC-B-75: 25 calls with 5 retired device credentials: statuses ${JSON.stringify(statusesOf(answers))}; ${rows.length} ACCESS_DENIED rows, all under class:local`);

    // All at once, in the next window: 20 rows again, never more.
    pairing.clock.advance(MINUTE);
    const mark = await trailLength();
    const burst = await Promise.all(Array.from({ length: 25 }, (_, call) => deviceGet(pairing.app, DEVICE, devices[call % 5]?.credential ?? null)));
    expect(await trailSince(mark)).toHaveLength(20);
    expect(statusesOf(burst)).toEqual({ 403: 20, 429: 5 });

    // After the 60 s window a denied call is audited again.
    pairing.clock.advance(MINUTE);
    expect(outcomeOf(await deviceGet(pairing.app, DEVICE, devices[0]?.credential ?? null))).toEqual([403, 'DEVICE_REVOKED']);
    expect(await trailSince(mark)).toHaveLength(21);
  });
});
