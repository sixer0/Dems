// Operation 7 `setBiometricEnrollment` against PostgreSQL (plan row W41; spec §5.6 steps 1 and 8,
// §7.5; SR-36; module gate MODG for operation 7: every documented status the module can produce,
// each answer validated against the contract). A clone of the seed template, the code under test
// as `dems_app`, the real stages 3 to 6 and the real device registry.
//
// No token is printed: an assertion compares forms, states and booleans (P19).
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readEvents } from '../../../../../test/support/core';
import { MINUTE, SESSION, closeOpenSessions, errorOf, sessionOfToken, signInOnWeb } from '../../../../../test/support/identity';
import { deviceGet } from '../../../../../test/support/pairing';
import { ENROLMENT_UNIT_LABEL } from '../enrolment';
import {
  BIO_FORM,
  BIOMETRIC,
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  THIRTY_DAYS,
  biometricApp,
  biometricSignIn,
  enrol,
  enrolledOperator,
  expectContract,
  forgetLimits,
  outcomeOf,
  pairDevice,
  passwordSession,
  portalPost,
  clearTokens,
  revokeUrl,
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
const sessionAnswers = async (sessionToken: string): Promise<number> => (await deviceGet(bio.app, SESSION, sessionToken)).statusCode;
const changed = (operatorId: string, deviceId: string, enabled: boolean): ReturnType<typeof shapeOf> => ({
  type: 'BIOMETRIC_ENROLLMENT_CHANGED',
  actorId: operatorId,
  deviceId,
  details: { enabled, deviceId },
});

describe('SR-36: a token is issued inside a password session on a paired device', () => {
  it('answers 200 with the token ONCE and its expiry; stores its SHA-256 with the device, the operator and a family; writes BIOMETRIC_ENROLLMENT_CHANGED and no event', async () => {
    const sessionToken = await passwordSession(bio.app, tablet, INVESTIGATOR.username);
    // The sign-in on the device told the channel its operator changed (E-fix FX-C, R4); the enrolment below publishes nothing.
    expect(bio.published).toEqual([{ kind: 'device.session', deviceIds: [tablet.deviceId] }]);
    bio.published.length = 0;
    const before = await trailLength(owner);
    const events = (await readEvents(owner)).length;
    bio.clock.advance(3_000);

    const response = await setEnrolment(bio.app, sessionToken, { enabled: true });

    expect(response.statusCode).toBe(200);
    expectContract('setBiometricEnrollment', response);
    const body = response.json() as { enabled: boolean; token: string; expiresAt: number };
    expect(Object.keys(body).sort()).toEqual(['enabled', 'expiresAt', 'token']);
    expect(body.enabled).toBe(true);
    expect(BIO_FORM.test(body.token)).toBe(true);
    expect(body.expiresAt).toBe(now() + THIRTY_DAYS);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(Number(response.headers['x-dems-epoch'])).toBe(bio.app.engine.epoch);
    expect(Number(response.headers['x-dems-revision'])).toBe(bio.app.engine.revision);

    // The device and the operator are the session's; the family is new; the hash is 32 bytes.
    const stored = await tokenRow(owner, body.token);
    expect(stored).toMatchObject({ deviceId: tablet.deviceId, operatorId: INVESTIGATOR.id, issuedAt: now(), expiresAt: now() + THIRTY_DAYS, usedAt: null, revokedAt: null, hashBytes: 32 });
    expect(stored?.familyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await storedTokens(owner)).toHaveLength(1);

    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([changed(INVESTIGATOR.id, tablet.deviceId, true)]);
    expect((await trailSince(owner, before))[0]).toMatchObject({ category: 'AUTH', severity: 'INFO', message: `Biometric sign-in turned on (${tablet.deviceId})` });
    expect((await readEvents(owner)).length).toBe(events);
    expect(bio.published).toEqual([]);
    // The session it was issued in stays as it is.
    expect(await sessionAnswers(sessionToken)).toBe(200);
  });

  it('enrolling again replaces the enrolment: the earlier token is revoked (REENROLLED), a new family starts, and one token of the pair is usable', async () => {
    const sessionToken = await passwordSession(bio.app, tablet, INVESTIGATOR.username);
    const first = await enrol(bio.app, sessionToken);
    bio.clock.advance(MINUTE);
    const before = await trailLength(owner);
    const second = await enrol(bio.app, sessionToken);

    expect(second.token === first.token).toBe(false);
    const [old, fresh] = [await tokenRow(owner, first.token), await tokenRow(owner, second.token)];
    expect(old).toMatchObject({ revokedAt: now(), revokeReason: 'REENROLLED', usedAt: null });
    expect(stateOf(fresh, now())).toBe('LIVE');
    expect(fresh?.familyId === old?.familyId).toBe(false);
    expect((await storedTokens(owner)).map((row) => stateOf(row, now()))).toEqual(['REVOKED(REENROLLED)', 'LIVE']);
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([changed(INVESTIGATOR.id, tablet.deviceId, true)]);

    // After a rotation the used rows of the earlier family are revoked with it.
    bio.clock.advance(MINUTE);
    const signedIn = await signInWithToken(bio.app, tablet.credential, second.token);
    bio.clock.advance(MINUTE);
    await enrol(bio.app, sessionToken);
    expect((await storedTokens(owner)).map((row) => stateOf(row, now()))).toEqual(['REVOKED(REENROLLED)', 'USED+REVOKED(REENROLLED)', 'REVOKED(REENROLLED)', 'LIVE']);
    expect(outcomeOf(await biometricSignIn(bio.app, tablet.credential, signedIn.biometricToken))).toEqual([401, 'INVALID_CREDENTIALS']);
  });

  it('a token is bound to ONE device and ONE operator: two operators on one device and one operator on two devices hold four enrolments that do not touch each other', async () => {
    const sessions = {
      investigatorOnTablet: await passwordSession(bio.app, tablet, INVESTIGATOR.username),
      technicianOnTablet: await passwordSession(bio.app, tablet, TECHNICIAN.username),
      investigatorOnPhone: await passwordSession(bio.app, phone, INVESTIGATOR.username),
      technicianOnPhone: await passwordSession(bio.app, phone, TECHNICIAN.username),
    };
    const tokens = {
      investigatorOnTablet: (await enrol(bio.app, sessions.investigatorOnTablet)).token,
      technicianOnTablet: (await enrol(bio.app, sessions.technicianOnTablet)).token,
      investigatorOnPhone: (await enrol(bio.app, sessions.investigatorOnPhone)).token,
      technicianOnPhone: (await enrol(bio.app, sessions.technicianOnPhone)).token,
    };
    const rows = await storedTokens(owner);
    expect(rows.map((row) => [row.deviceId, row.operatorId, stateOf(row, now())]).sort()).toEqual(
      [
        [tablet.deviceId, INVESTIGATOR.id, 'LIVE'],
        [tablet.deviceId, TECHNICIAN.id, 'LIVE'],
        [phone.deviceId, INVESTIGATOR.id, 'LIVE'],
        [phone.deviceId, TECHNICIAN.id, 'LIVE'],
      ].sort(),
    );
    expect(new Set(rows.map((row) => row.familyId)).size).toBe(4);

    // One of the four is turned off: the three others are as they were.
    expect((await setEnrolment(bio.app, sessions.investigatorOnTablet, { enabled: false })).statusCode).toBe(200);
    expect(stateOf(await tokenRow(owner, tokens.investigatorOnTablet), now())).toBe('REVOKED(DISABLED)');
    for (const other of [tokens.technicianOnTablet, tokens.investigatorOnPhone, tokens.technicianOnPhone]) expect(stateOf(await tokenRow(owner, other), now())).toBe('LIVE');
    // And each signs in its own operator on its own device, and nobody else.
    expect((await signInWithToken(bio.app, tablet.credential, tokens.technicianOnTablet)).session).toMatchObject({ operator: { id: TECHNICIAN.id }, deviceId: tablet.deviceId });
    expect((await signInWithToken(bio.app, phone.credential, tokens.investigatorOnPhone)).session).toMatchObject({ operator: { id: INVESTIGATOR.id }, deviceId: phone.deviceId });
  });

  it('enabled: true in a session that was created with a token: 403 DEVICE_NOT_PAIRED with details.reason; nothing is issued, no row, and the enrolment that stood still stands', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    const before = await trailLength(owner);
    const tokens = await storedTokens(owner);

    const response = await setEnrolment(bio.app, signedIn.sessionToken, { enabled: true });

    expect(outcomeOf(response)).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expect(errorOf(response)).toMatchObject({ message: 'Sign in with your password to turn biometric sign-in on.', details: { reason: 'PASSWORD_SESSION_REQUIRED' } });
    expectContract('setBiometricEnrollment', response);
    expect(Object.keys(response.json() as object)).toEqual(['error']);
    expect(await trailLength(owner)).toBe(before);
    // The unit rolled back: the token of the rotation is not revoked, and it still signs in.
    expect(await storedTokens(owner)).toEqual(tokens);
    expect(stateOf(await tokenRow(owner, signedIn.biometricToken), now())).toBe('LIVE');
    expect((await signInWithToken(bio.app, tablet.credential, signedIn.biometricToken)).session.method).toBe('BIOMETRIC');
  });
});

describe('spec §5.6 step 8: turning biometric sign-in off revokes the family', () => {
  it('revokes every token of the operator on that device (DISABLED), answers { enabled: false } without a token, writes the row; the token then signs nobody in', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    // The password sign-in and the biometric sign-in each told the channel the device's operator changed (R4).
    expect(bio.published).toEqual([
      { kind: 'device.session', deviceIds: [tablet.deviceId] },
      { kind: 'device.session', deviceIds: [tablet.deviceId] },
    ]);
    bio.published.length = 0;
    const before = await trailLength(owner);
    bio.clock.advance(MINUTE);

    const response = await setEnrolment(bio.app, enrolled.sessionToken, { enabled: false });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ enabled: false });
    expectContract('setBiometricEnrollment', response);
    expect(Number(response.headers['x-dems-revision'])).toBe(bio.app.engine.revision);
    expect((await storedTokens(owner)).map((row) => [stateOf(row, now()), row.revokedAt])).toEqual([
      ['USED+REVOKED(DISABLED)', now()],
      ['REVOKED(DISABLED)', now()],
    ]);
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([changed(INVESTIGATOR.id, tablet.deviceId, false)]);
    expect((await trailSince(owner, before))[0]?.message).toBe(`Biometric sign-in turned off (${tablet.deviceId})`);
    // The BIOMETRIC session that the family had issued is not ended by it (this is no reuse).
    expect(await sessionAnswers(signedIn.sessionToken)).toBe(200);
    expect(bio.published).toEqual([]);
    expect(outcomeOf(await biometricSignIn(bio.app, tablet.credential, signedIn.biometricToken))).toEqual([401, 'INVALID_CREDENTIALS']);
  });

  it('turning off what is off changes nothing: 200 { enabled: false } and no row', async () => {
    const sessionToken = await passwordSession(bio.app, tablet, INVESTIGATOR.username);
    const before = await trailLength(owner);
    const tokens = await storedTokens(owner);
    for (let call = 0; call < 2; call += 1) {
      const response = await setEnrolment(bio.app, sessionToken, { enabled: false });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ enabled: false });
    }
    expect(await trailLength(owner)).toBe(before);
    expect(await storedTokens(owner)).toEqual(tokens);
  });

  it('a session that was created with the token may turn it off, and stays open', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    const before = await trailLength(owner);

    const response = await setEnrolment(bio.app, signedIn.sessionToken, { enabled: false });

    expect(response.statusCode).toBe(200);
    expect((await trailSince(owner, before)).map(shapeOf)).toEqual([changed(INVESTIGATOR.id, tablet.deviceId, false)]);
    expect(stateOf(await tokenRow(owner, signedIn.biometricToken), now())).toBe('REVOKED(DISABLED)');
    expect(await sessionAnswers(signedIn.sessionToken)).toBe(200);
    expect((await sessionOfToken(owner, signedIn.sessionToken)).endReason).toBeNull();
  });
});

describe('who may call is stage 6; what the body holds is stage 7', () => {
  it('no credential and a device credential without a session: 401; a web console session: 403 DEVICE_NOT_PAIRED; no row, nothing issued', async () => {
    const onWeb = await signInOnWeb(bio, SUPERVISOR.username);
    const before = await trailLength(owner);
    const tokens = (await storedTokens(owner)).length;

    for (const bearerValue of [null, tablet.credential, `ses_${'z'.repeat(43)}`]) {
      const response = await setEnrolment(bio.app, bearerValue, { enabled: true });
      expect(outcomeOf(response)).toEqual([401, 'NOT_SIGNED_IN']);
      expectContract('setBiometricEnrollment', response);
    }
    const web = await portalPost(bio.app, BIOMETRIC, onWeb.cookie, { enabled: true });
    expect(outcomeOf(web)).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expectContract('setBiometricEnrollment', web);
    expect(web.headers['set-cookie']).toBeUndefined();

    expect(await trailLength(owner)).toBe(before);
    expect((await storedTokens(owner)).length).toBe(tokens);
  });

  it('a session of a device that was revoked: 403 DEVICE_REVOKED from stage 6 with its one row; the pairing module had revoked the device\'s live token', async () => {
    const cookie = await supervisorCookie(bio);
    const spare = await pairDevice(bio, cookie, 'Tablet to revoke');
    const enrolled = await enrolledOperator(bio.app, spare, INVESTIGATOR.username);
    expect((await portalPost(bio.app, revokeUrl(spare.deviceId), cookie, { reason: 'Revoked for the enrolment test' })).statusCode).toBe(200);
    expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('REVOKED(DEVICE_REVOKED)');
    const before = await trailLength(owner);
    const tokens = (await storedTokens(owner)).length;

    const response = await setEnrolment(bio.app, enrolled.sessionToken, { enabled: true });

    expect(outcomeOf(response)).toEqual([403, 'DEVICE_REVOKED']);
    expectContract('setBiometricEnrollment', response);
    expect((await trailSince(owner, before)).map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['ACCESS_DENIED', null, spare.deviceId, { operationId: 'setBiometricEnrollment', reason: 'DEVICE_REVOKED' }],
    ]);
    expect((await storedTokens(owner)).length).toBe(tokens);
  });

  it('a body that breaks the schema: 422 INVALID_INPUT; malformed JSON: 400; nothing is issued and no row is written', async () => {
    const sessionToken = await passwordSession(bio.app, tablet, INVESTIGATOR.username);
    const before = await trailLength(owner);
    const tokens = (await storedTokens(owner)).length;
    for (const body of [{}, { enabled: 'yes' }, { enabled: 1 }, { enabled: null }, { enable: true }]) {
      const response = await setEnrolment(bio.app, sessionToken, body);
      expect(outcomeOf(response), JSON.stringify(body)).toEqual([422, 'INVALID_INPUT']);
      expectContract('setBiometricEnrollment', response);
    }
    const malformed = await bio.app.inject({
      method: 'POST',
      url: BIOMETRIC,
      headers: { authorization: `Bearer ${sessionToken}`, 'content-type': 'application/json' },
      payload: '{"enabled": tr',
    });
    expect(outcomeOf(malformed)).toEqual([400, 'INVALID_JSON']);
    expectContract('setBiometricEnrollment', malformed);
    expect(await trailLength(owner)).toBe(before);
    expect((await storedTokens(owner)).length).toBe(tokens);
  });
});

describe('the issue is one statement: what changed between stage 4 and the unit is seen by it', () => {
  /** Runs `change` as `dems_owner` at the moment the enrolment unit is submitted, as another process on the database could. */
  function beforeTheUnit(change: () => Promise<unknown>): { restore(): void } {
    const { pipeline } = bio.app;
    const run = pipeline.run.bind(pipeline);
    const spy = vi.spyOn(pipeline, 'run').mockImplementation(((label: string, work: never) =>
      label === ENROLMENT_UNIT_LABEL.enrol ? change().then(() => run(label, work)) : run(label, work)) as typeof pipeline.run);
    return { restore: () => spy.mockRestore() };
  }

  it('the session ended meanwhile: 401 NOT_SIGNED_IN; nothing is issued, no row, and the earlier enrolment is not revoked', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const session = await sessionOfToken(owner, enrolled.sessionToken);
    const before = await trailLength(owner);
    const tokens = await storedTokens(owner);
    const hook = beforeTheUnit(() => owner.query("UPDATE public.auth_sessions SET ended_at = $2, end_reason = 'SIGNED_OUT' WHERE id = $1", [session.id, now()]));
    try {
      const response = await setEnrolment(bio.app, enrolled.sessionToken, { enabled: true });
      expect(outcomeOf(response)).toEqual([401, 'NOT_SIGNED_IN']);
      expectContract('setBiometricEnrollment', response);
    } finally {
      hook.restore();
    }
    expect(await trailLength(owner)).toBe(before);
    expect(await storedTokens(owner)).toEqual(tokens);
    expect(stateOf(await tokenRow(owner, enrolled.token), now())).toBe('LIVE');
  });

  it('the operator was disabled meanwhile: 401; the device stopped being PAIRED meanwhile: 403 DEVICE_REVOKED; nothing is issued either time', async () => {
    const sessionToken = await passwordSession(bio.app, tablet, TECHNICIAN.username);
    const before = await trailLength(owner);
    const tokens = await storedTokens(owner);
    const disabled = beforeTheUnit(() => owner.query('UPDATE public.operators SET enabled = false WHERE id = $1', [TECHNICIAN.id]));
    try {
      expect(outcomeOf(await setEnrolment(bio.app, sessionToken, { enabled: true }))).toEqual([401, 'NOT_SIGNED_IN']);
    } finally {
      disabled.restore();
      await owner.query('UPDATE public.operators SET enabled = true WHERE id = $1', [TECHNICIAN.id]);
    }

    const cookie = await supervisorCookie(bio);
    const spare = await pairDevice(bio, cookie, 'Tablet that leaves');
    const onSpare = await passwordSession(bio.app, spare, INVESTIGATOR.username);
    const unpaired = beforeTheUnit(() => owner.query("UPDATE public.paired_devices SET state = 'UNPAIRED', unpaired_at = $2, updated_at = $2 WHERE id = $1", [spare.deviceId, now()]));
    try {
      const response = await setEnrolment(bio.app, onSpare, { enabled: true });
      expect(outcomeOf(response)).toEqual([403, 'DEVICE_REVOKED']);
      expectContract('setBiometricEnrollment', response);
    } finally {
      unpaired.restore();
    }
    expect((await trailSince(owner, before)).filter((row) => row.type === 'BIOMETRIC_ENROLLMENT_CHANGED')).toEqual([]);
    expect((await storedTokens(owner)).length).toBe(tokens.length);
  });
});
