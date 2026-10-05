// Operation 9 `reportBiometricFailure` against PostgreSQL (plan row W41; spec §5.6 step 7, §7.5
// with its note; SR-37, SR-65, SR-71; AC-B-83; review SD-11; module gate MODG for operation 9). A
// clone of the seed template, the code under test as `dems_app`, the real stages 3 to 6 and the
// real device registry.
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readEvents } from '../../../../../test/support/core';
import { throttleControl } from '../../../../plugins/throttle';
import { disableUrl, enableUrl } from '../../../../../test/support/admin';
import { MINUTE, STATUS, closeOpenSessions, deviceSignIn, signInOnWeb } from '../../../../../test/support/identity';
import { deviceGet } from '../../../../../test/support/pairing';
import {
  BIOMETRIC_FAILURE,
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  biometricApp,
  biometricSignIn,
  clearTokens,
  devicePost,
  enrolledOperator,
  expectContract,
  forgetLimits,
  outcomeOf,
  pairDevice,
  passwordSession,
  portalPost,
  reportFailure,
  revokeUrl,
  sessionCount,
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
  bio.clock.advance(2 * MINUTE);
});

const now = (): number => bio.clock.now();
const lockState = async (credential: string): Promise<Record<string, unknown>> => (await deviceGet(bio.app, STATUS, credential)).json() as Record<string, unknown>;
const counted = (attemptsRemaining: number): Record<string, unknown> => ({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining, serverTime: now() });
const failed = (actorId: string | null, deviceId: string, attemptsRemaining = 4): ReturnType<typeof shapeOf> => ({
  type: 'AUTH_FAILED',
  actorId,
  deviceId,
  details: { method: 'BIOMETRIC', knownOperator: actorId !== null, attemptsRemaining, lockedUntil: null },
});

/** One report with fresh counters: the answer, and the one row it wrote. */
async function report(credential: string, operatorId: string | null): Promise<{ response: LightMyRequestResponse; row: ReturnType<typeof shapeOf> }> {
  forgetLimits(bio);
  const before = await trailLength(owner);
  const response = await reportFailure(bio.app, credential, operatorId);
  const rows = await trailSince(owner, before);
  expect(rows).toHaveLength(1);
  return { response, row: shapeOf(rows[0]!) };
}

describe('AC-B-83 (SR-37, SD-11): the row names an operator only where an enrolment of that device exists', () => {
  it('an operator with no biometric token on the device: AUTH_FAILED with a null actor and the device ID; the answer is the device\'s lock state', async () => {
    const events = (await readEvents(owner)).length;
    const { response, row } = await report(tablet.credential, INVESTIGATOR.id);

    expect(response.statusCode).toBe(200);
    expectContract('reportBiometricFailure', response);
    expect(response.json()).toEqual(counted(4));
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(Number(response.headers['x-dems-revision'])).toBe(bio.app.engine.revision);
    expect(row).toEqual(failed(null, tablet.deviceId));
    expect((await readEvents(owner)).slice(events).map((event) => [event.type, event.params, event.deviceId])).toEqual([['AUTH_FAILED', { attemptsRemaining: 4 }, tablet.deviceId]]);
  });

  it('an enrolled operator: the row names that operator; before the first use and after a rotation alike', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    expect((await report(tablet.credential, INVESTIGATOR.id)).row).toEqual(failed(INVESTIGATOR.id, tablet.deviceId));
    forgetLimits(bio);
    await signInWithToken(bio.app, tablet.credential, enrolled.token);
    expect((await report(tablet.credential, INVESTIGATOR.id)).row).toEqual(failed(INVESTIGATOR.id, tablet.deviceId));
  });

  it('the enrolment is the DEVICE\'s: an operator who is enrolled on another device only, another operator, an operator that does not exist and no operator are not named', async () => {
    await enrolledOperator(bio.app, phone, INVESTIGATOR.username);
    await enrolledOperator(bio.app, tablet, TECHNICIAN.username);

    for (const believed of [INVESTIGATOR.id, SUPERVISOR.id, 'OPR-999', null]) {
      expect((await report(tablet.credential, believed)).row, String(believed)).toEqual(failed(null, tablet.deviceId));
    }
    // The same operator reported by the device he is enrolled on IS named.
    expect((await report(phone.credential, INVESTIGATOR.id)).row).toEqual(failed(INVESTIGATOR.id, phone.deviceId));
    expect((await report(tablet.credential, TECHNICIAN.id)).row).toEqual(failed(TECHNICIAN.id, tablet.deviceId));
  });

  it('an enrolment that was turned off, and a family that a reuse revoked, are no enrolment any more', async () => {
    const off = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    expect((await setEnrolment(bio.app, off.sessionToken, { enabled: false })).statusCode).toBe(200);
    expect((await report(tablet.credential, INVESTIGATOR.id)).row).toEqual(failed(null, tablet.deviceId));

    const reused = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    await signInWithToken(bio.app, tablet.credential, reused.token);
    expect((await biometricSignIn(bio.app, tablet.credential, reused.token)).statusCode).toBe(401);
    expect((await storedTokens(owner)).filter((row) => row.operatorId === TECHNICIAN.id && row.revokedAt === null)).toEqual([]);
    expect((await report(tablet.credential, TECHNICIAN.id)).row).toEqual(failed(null, tablet.deviceId));
  });

  // Security checkpoint CPS1-8. "Live or last used" (spec §5.6 step 7) is an enrolment of an
  // operator who is ENABLED. A disable revokes the operator's live token only: the used row of
  // the family stays unrevoked. The lookup therefore asks the operator's flag itself.
  it('a report never names a DISABLED operator: enrol, use the token once, disable, report: nobody is named, in the row and in the answer; the same sequence without the disable names the operator', async () => {
    const cookie = await supervisorCookie(bio);
    // The control, without the disable: enrol, use the token once (a used row exists), report.
    const control = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    await signInWithToken(bio.app, tablet.credential, control.token);
    const named = await report(tablet.credential, INVESTIGATOR.id);
    expect(named.row).toEqual(failed(INVESTIGATOR.id, tablet.deviceId));

    // The same sequence for a second operator, who is then disabled.
    const enrolled = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    await signInWithToken(bio.app, tablet.credential, enrolled.token);
    expect((await report(tablet.credential, TECHNICIAN.id)).row).toEqual(failed(TECHNICIAN.id, tablet.deviceId));
    expect((await portalPost(bio.app, disableUrl(TECHNICIAN.id), cookie)).statusCode).toBe(200);
    try {
      // The administration module revoked the LIVE token; the used one is history and is NOT
      // revoked: the row that, without the operator's flag in the lookup, still counted as an enrolment.
      expect((await storedTokens(owner)).filter((row) => row.operatorId === TECHNICIAN.id).map((row) => [row.deviceId, row.usedAt !== null, row.revokeReason])).toEqual([
        [tablet.deviceId, true, null],
        [tablet.deviceId, false, 'USER_DISABLED'],
      ]);

      const unnamed = await report(tablet.credential, TECHNICIAN.id);
      expect(unnamed.row).toEqual(failed(null, tablet.deviceId));
      // The answer names nobody, as ever: the device's lock state, the body of the report that named an operator.
      expect(unnamed.response.statusCode).toBe(200);
      expectContract('reportBiometricFailure', unnamed.response);
      expect(unnamed.response.json()).toEqual(counted(4));
      expect(unnamed.response.body).toBe(named.response.body);

      // While the device is locked the row is AUTH_LOCKED, and the same rule decides its actor.
      forgetLimits(bio);
      for (let attempt = 0; attempt < 5; attempt += 1) await reportFailure(bio.app, tablet.credential, null);
      const before = await trailLength(owner);
      await reportFailure(bio.app, tablet.credential, TECHNICIAN.id);
      await reportFailure(bio.app, tablet.credential, INVESTIGATOR.id);
      expect((await trailSince(owner, before)).map((row) => [row.type, row.actorId, row.deviceId])).toEqual([
        ['AUTH_LOCKED', null, tablet.deviceId],
        ['AUTH_LOCKED', INVESTIGATOR.id, tablet.deviceId],
      ]);
      // The operator who was not disabled is named on the same device all along.
      expect((await report(tablet.credential, INVESTIGATOR.id)).row).toEqual(failed(INVESTIGATOR.id, tablet.deviceId));
    } finally {
      expect((await portalPost(bio.app, enableUrl(TECHNICIAN.id), cookie)).statusCode).toBe(200);
    }
    // Enabled again: the pair still has its last used token, and the operator is named again.
    expect((await report(tablet.credential, TECHNICIAN.id)).row).toEqual(failed(TECHNICIAN.id, tablet.deviceId));
  });

  it('the rule is the lookup\'s own: an operator whose flag is off is not named even where no unit revoked anything and the token is LIVE; with the flag on again the operator is named', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    // The flag alone, as `dems_owner`: no unit of the administration module ran, so nothing was revoked.
    await owner.query('UPDATE public.operators SET enabled = false WHERE id = $1', [TECHNICIAN.id]);
    try {
      expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('LIVE');
      expect((await report(tablet.credential, TECHNICIAN.id)).row).toEqual(failed(null, tablet.deviceId));
    } finally {
      await owner.query('UPDATE public.operators SET enabled = true WHERE id = $1', [TECHNICIAN.id]);
    }
    expect((await report(tablet.credential, TECHNICIAN.id)).row).toEqual(failed(TECHNICIAN.id, tablet.deviceId));
  });

  it('the answer says nothing about the operator: an enrolled one, one who is not, one that does not exist and none give the same body', async () => {
    await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const bodies: string[] = [];
    for (const believed of [INVESTIGATOR.id, TECHNICIAN.id, 'OPR-999', null]) bodies.push((await report(tablet.credential, believed)).response.body);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!)).toEqual(counted(4));
  });

  it('it can create nothing: no session, no token, whatever is reported and however often', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const sessions = await sessionCount(owner);
    const tokens = await storedTokens(owner);
    for (const believed of [INVESTIGATOR.id, TECHNICIAN.id, null]) {
      const { response } = await report(tablet.credential, believed);
      expect(Object.keys(response.json() as object).sort()).toEqual(['attemptsRemaining', 'locked', 'lockedUntil', 'retryInMs', 'serverTime']);
    }
    expect(await sessionCount(owner)).toBe(sessions);
    expect(await storedTokens(owner)).toEqual(tokens);
    // The token is as good as before.
    forgetLimits(bio);
    expect((await signInWithToken(bio.app, tablet.credential, enrolled.token)).session.method).toBe('BIOMETRIC');
  });
});

describe('the count is the reporting device\'s, on the lockout the two sign-ins use', () => {
  it('five reports lock the device: 4, 3, 2 and 1 attempts left, then locked for 60 s; each answers 200 and writes AUTH_FAILED, the fifth as the locking one', async () => {
    const before = await trailLength(owner);
    const answers: LightMyRequestResponse[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) answers.push(await reportFailure(bio.app, tablet.credential, null));

    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200, 200, 200, 200]);
    const lockedUntil = now() + MINUTE;
    expect(answers.map((answer) => answer.json())).toEqual([counted(4), counted(3), counted(2), counted(1), { locked: true, lockedUntil, retryInMs: MINUTE, attemptsRemaining: 0, serverTime: now() }]);
    for (const answer of answers) expectContract('reportBiometricFailure', answer);
    const rows = await trailSince(owner, before);
    expect(rows.map((row) => [row.type, row.details['attemptsRemaining'], row.details['lockedUntil']])).toEqual([
      ['AUTH_FAILED', 4, null],
      ['AUTH_FAILED', 3, null],
      ['AUTH_FAILED', 2, null],
      ['AUTH_FAILED', 1, null],
      ['AUTH_FAILED', 0, lockedUntil],
    ]);
    expect(await lockState(tablet.credential)).toMatchObject({ locked: true, lockedUntil });
  });

  it('while the device is locked: 200 with the lock state, AUTH_LOCKED with the actor of SR-37, nothing counted; both sign-ins of the device answer 423; 60 s later all is open again', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    for (let attempt = 0; attempt < 5; attempt += 1) await reportFailure(bio.app, tablet.credential, null);
    const lockedUntil = now() + MINUTE;
    const before = await trailLength(owner);
    bio.clock.advance(20_000);

    const named = await reportFailure(bio.app, tablet.credential, INVESTIGATOR.id);
    const unnamed = await reportFailure(bio.app, tablet.credential, TECHNICIAN.id);

    for (const answer of [named, unnamed]) {
      expect(answer.statusCode).toBe(200);
      expectContract('reportBiometricFailure', answer);
      expect(answer.json()).toEqual({ locked: true, lockedUntil, retryInMs: 40_000, attemptsRemaining: 0, serverTime: now() });
    }
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([
      { type: 'AUTH_LOCKED', actorId: INVESTIGATOR.id, deviceId: tablet.deviceId, details: { method: 'BIOMETRIC', retryInMs: 40_000, lockedUntil } },
      { type: 'AUTH_LOCKED', actorId: null, deviceId: tablet.deviceId, details: { method: 'BIOMETRIC', retryInMs: 40_000, lockedUntil } },
    ]);
    expect((await biometricSignIn(bio.app, tablet.credential, enrolled.token)).statusCode).toBe(423);
    expect((await deviceSignIn(bio.app, tablet.credential, INVESTIGATOR.username)).statusCode).toBe(423);

    bio.clock.advance(40_000);
    throttleControl(bio.app).reset();
    expect(await lockState(tablet.credential)).toMatchObject({ locked: false, attemptsRemaining: 5 });
    expect((await signInWithToken(bio.app, tablet.credential, enrolled.token)).session.method).toBe('BIOMETRIC');
  });

  it('a device locks itself and nothing else: another device and the web console keep their five attempts; a session of the device counts on the device', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) await reportFailure(bio.app, tablet.credential, null);
    // A session of an operator on the phone is the phone's console: its report counts on the phone.
    const sessionToken = await passwordSession(bio.app, phone, INVESTIGATOR.username);
    expect((await reportFailure(bio.app, sessionToken, null)).json()).toMatchObject({ attemptsRemaining: 4 });

    expect(await lockState(tablet.credential)).toMatchObject({ locked: false, attemptsRemaining: 2 });
    expect(await lockState(phone.credential)).toMatchObject({ locked: false, attemptsRemaining: 4 });
    expect((await bio.app.inject({ method: 'GET', url: STATUS })).json()).toMatchObject({ locked: false, attemptsRemaining: 5 });
    for (let attempt = 0; attempt < 2; attempt += 1) await reportFailure(bio.app, tablet.credential, null);
    expect(await lockState(tablet.credential)).toMatchObject({ locked: true });
    expect(await lockState(phone.credential)).toMatchObject({ locked: false, attemptsRemaining: 4 });
    // The web console signs in while the tablet is locked.
    expect((await signInOnWeb(bio, SUPERVISOR.username)).response.statusCode).toBe(200);
  });

  it('SR-71: every report inside the denial budget of the device is audited, one row each; from the 21st the answer is 429 and no row is written', async () => {
    const before = await trailLength(owner);
    const answers: LightMyRequestResponse[] = [];
    for (let attempt = 0; attempt < 22; attempt += 1) answers.push(await reportFailure(bio.app, tablet.credential, null));

    expect(answers.map((answer) => answer.statusCode)).toEqual([...Array.from({ length: 20 }, () => 200), 429, 429]);
    expect(outcomeOf(answers[20]!)).toEqual([429, 'RATE_LIMITED']);
    expectContract('reportBiometricFailure', answers[20]!);
    const rows = await trailSince(owner, before);
    expect(rows.map((row) => row.type)).toEqual([...Array.from({ length: 5 }, () => 'AUTH_FAILED'), ...Array.from({ length: 15 }, () => 'AUTH_LOCKED')]);
    expect(await throttleControl(bio.app).inspect(`device:${tablet.deviceId}`)).toMatchObject({ used: 20, exhausted: true });
  });
});

describe('who may call is stage 6; what the body holds is stage 7', () => {
  it('no credential: 401; a web console session: 403 DEVICE_NOT_PAIRED; a revoked device: 403 DEVICE_REVOKED with its one ACCESS_DENIED row; nothing is counted', async () => {
    const onWeb = await signInOnWeb(bio, SUPERVISOR.username);
    const cookie = await supervisorCookie(bio);
    const spare = await pairDevice(bio, cookie, 'Tablet to revoke');
    expect((await portalPost(bio.app, revokeUrl(spare.deviceId), cookie, { reason: 'Revoked for the failure test' })).statusCode).toBe(200);
    const before = await trailLength(owner);

    const none = await reportFailure(bio.app, null, INVESTIGATOR.id);
    expect(outcomeOf(none)).toEqual([401, 'NOT_SIGNED_IN']);
    expectContract('reportBiometricFailure', none);
    const web = await portalPost(bio.app, BIOMETRIC_FAILURE, onWeb.cookie, { operatorId: INVESTIGATOR.id });
    expect(outcomeOf(web)).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expectContract('reportBiometricFailure', web);
    const retired = await reportFailure(bio.app, spare.credential, INVESTIGATOR.id);
    expect(outcomeOf(retired)).toEqual([403, 'DEVICE_REVOKED']);
    expectContract('reportBiometricFailure', retired);

    expect((await trailSince(owner, before)).map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['ACCESS_DENIED', null, spare.deviceId, { operationId: 'reportBiometricFailure', reason: 'DEVICE_REVOKED' }],
    ]);
    expect(await bio.control.lockout.status(spare.deviceId, now())).toMatchObject({ attemptsRemaining: 5 });
    expect(await bio.control.lockout.status('web', now())).toMatchObject({ attemptsRemaining: 5 });
  });

  it('a body that breaks the schema: 422 INVALID_INPUT; malformed JSON: 400; nothing is counted and no row is written', async () => {
    const before = await trailLength(owner);
    for (const body of [{}, { operatorId: 'budi.santoso' }, { operatorId: 7 }, { operatorId: 'OPR-1' }, { operatorId: 'opr-001' }, { operator: 'OPR-001' }]) {
      const response = await devicePost(bio.app, BIOMETRIC_FAILURE, tablet.credential, body);
      expect(outcomeOf(response), JSON.stringify(body)).toEqual([422, 'INVALID_INPUT']);
      expectContract('reportBiometricFailure', response);
    }
    const malformed = await bio.app.inject({
      method: 'POST',
      url: BIOMETRIC_FAILURE,
      headers: { authorization: `Bearer ${tablet.credential}`, 'content-type': 'application/json' },
      payload: '{"operatorId": "OPR-',
    });
    expect(outcomeOf(malformed)).toEqual([400, 'INVALID_JSON']);
    expect(await trailLength(owner)).toBe(before);
    expect(await lockState(tablet.credential)).toMatchObject({ attemptsRemaining: 5 });
  });
});
