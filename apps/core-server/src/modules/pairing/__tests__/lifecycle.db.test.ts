// The pairing code and the redeem, against PostgreSQL (plan row W32; spec §6.1, §6.2, §6.4, §6.6,
// §7.7 operations 15 to 18; SR-26 to SR-30; AC-B-32 to AC-B-36). A clone of the seed template,
// the code under test as `dems_app`, every stage as the server has it, the REAL device resolver.
//
// No code and no credential is printed: a failure names an identifier, a status or a count.
import { createHash } from 'node:crypto';
import { DEVICE_CREDENTIAL_PATTERN, PAIRING_CODE_ID_PATTERN, PAIRING_CODE_PATTERN, PAIRING_QR_PAYLOAD_PATTERN } from '@dems/shared/api';
import type { AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { MINUTE, OWN_ORIGIN, SIGN_IN, STATUS, WEB_ORIGIN, errorOf, get, setCookies, signInOnWeb, type Headers } from '../../../../test/support/identity';
import {
  CODE,
  CODE_CANCEL,
  DEVICE,
  DEVICES,
  INVESTIGATOR,
  REDEEM,
  ROTATE,
  SUPERVISOR,
  TABLET,
  UNPAIR,
  deviceGet,
  devicePost,
  expectContract,
  forgetLimits,
  issueCode,
  outcomeOf,
  pairingApp,
  portalPost,
  redeem,
  revokeUrl,
  storedCode,
  storedCodes,
  storedDevices,
  supervisorCookie,
  wrongCodeFor,
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
  // Fixture clean-up as the owner: no code of an earlier test is active, every limit starts afresh,
  // and each test runs in its own stretch of the server clock.
  await owner.query("UPDATE public.pairing_codes SET state = 'CANCELLED', closed_at = issued_at WHERE state = 'ACTIVE'");
  forgetLimits(pairing);
  pairing.clock.advance(10 * MINUTE);
  cookie = await supervisorCookie(pairing);
  pairing.published.length = 0;
});

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const trailSince = async (from: number): Promise<AuditRow[]> => (await readTrail(owner)).slice(from);
const shape = (rows: readonly AuditRow[]): Array<[string, string | null, string | null]> => rows.map((row) => [row.type, row.actorId, row.deviceId]);

async function expectChainVerifies(): Promise<void> {
  const rows = await readTrail(owner);
  const head = await readHead(owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
}

describe('AC-B-32: a device without a credential', () => {
  it('signIn answers 403 DEVICE_NOT_PAIRED with no Origin and with the instance\'s own origin alike; health, redeem and getSignInStatus are open; everything else of the area answers 401 and writes no row', async () => {
    const before = await trailLength();
    for (const headers of [{}, { origin: OWN_ORIGIN }]) {
      const refused = await pairing.app.inject({ method: 'POST', url: SIGN_IN, headers, payload: { username: SUPERVISOR.username, password: 'x' } });
      expect(outcomeOf(refused)).toEqual([403, 'DEVICE_NOT_PAIRED']);
    }
    expect((await deviceGet(pairing.app, '/api/v1/health', null)).statusCode).toBe(200);
    // OP-1 (decision D18): the status read needs no console identity; without a device
    // credential it reads the web console's lock state.
    const status = await deviceGet(pairing.app, STATUS, null);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ locked: false, attemptsRemaining: 5 });
    expect((await get(pairing.app, STATUS, { origin: OWN_ORIGIN })).statusCode).toBe(200);

    const closed: Array<[string, 'GET' | 'POST', string]> = [
      ['issuePairingCode', 'POST', CODE],
      ['getPairingCodeStatus', 'GET', CODE],
      ['cancelPairingCode', 'POST', CODE_CANCEL],
      ['listPairedDevices', 'GET', DEVICES],
      ['revokeDevice', 'POST', revokeUrl('DEV-0001')],
      ['getDeviceRegistration', 'GET', DEVICE],
      ['unpairDevice', 'POST', UNPAIR],
      ['rotateDeviceCredential', 'POST', ROTATE],
    ];
    for (const [operationId, method, url] of closed) {
      const response = method === 'GET' ? await deviceGet(pairing.app, url, null) : await devicePost(pairing.app, url, null, { reason: 'not reached' });
      expect(outcomeOf(response), operationId).toEqual([401, 'NOT_SIGNED_IN']);
      expectContract(operationId, response);
      expect(setCookies(response), operationId).toEqual([]);
    }
    // Nothing of the above is audited: a 401 has no actor (RB-6), and a sign-in without a
    // console identity takes no attempt.
    expect(await trailSince(before)).toEqual([]);

    // The redeem is open to it: with no code active it is a counted, audited failure.
    const failed = await redeem(pairing.app, '000000');
    expect(outcomeOf(failed)).toEqual([401, 'INVALID_CODE']);
    expectContract('redeemPairingCode', failed);
    expect(shape(await trailSince(before))).toEqual([['PAIRING_FAILED', null, null]]);
  });
});

describe('AC-B-33: issuePairingCode', () => {
  it('returns six digits once, valid 300 s; writes PAIRING_CODE_ISSUED without the code; the table holds only the hash of the code ID and the code', async () => {
    const before = await trailLength();
    const now = pairing.clock.now();
    const issued = await issueCode(pairing, cookie);
    const body = issued.response.json() as Record<string, unknown>;

    expectContract('issuePairingCode', issued.response);
    expect(Object.keys(body).sort()).toEqual(['attemptsAllowed', 'code', 'codeId', 'expiresAt', 'issuedAt', 'qrPayload']);
    expect(PAIRING_CODE_PATTERN.test(issued.code)).toBe(true);
    expect(PAIRING_CODE_ID_PATTERN.test(issued.codeId)).toBe(true);
    expect(PAIRING_QR_PAYLOAD_PATTERN.test(String(body['qrPayload']))).toBe(true);
    expect(body['qrPayload'] === `DEMS-PAIR:1:${issued.code}`).toBe(true);
    expect([body['issuedAt'], body['expiresAt'], body['attemptsAllowed']]).toEqual([now, now + 300_000, 5]);
    // API-7 on the 2xx answer of a POST; no cookie is set by this module.
    expect(issued.response.headers['x-dems-epoch']).toBeDefined();
    expect(issued.response.headers['x-dems-revision']).toBeDefined();
    expect(setCookies(issued.response)).toEqual([]);

    // The stored row: ACTIVE, 32 bytes of hash, and that hash is SHA-256("<code ID>:<code>").
    expect(await storedCode(owner, issued.codeId)).toEqual({
      id: issued.codeId,
      state: 'ACTIVE',
      issuedBy: SUPERVISOR.id,
      issuedAt: now,
      expiresAt: now + 300_000,
      failedAttempts: 0,
      closedAt: null,
      closedBy: null,
      hashBytes: 32,
    });
    const digest = createHash('sha256').update(`${issued.codeId}:${issued.code}`, 'utf8').digest();
    const { rows: same } = await owner.query<{ same: boolean }>('SELECT code_hash = $1 AS same FROM public.pairing_codes WHERE id = $2', [digest, issued.codeId]);
    expect(same).toEqual([{ same: true }]);
    // Neither the code alone nor the QR payload is what was hashed.
    for (const other of [issued.code, `DEMS-PAIR:1:${issued.code}`]) {
      const wrong = createHash('sha256').update(other, 'utf8').digest();
      expect((await owner.query<{ same: boolean }>('SELECT code_hash = $1 AS same FROM public.pairing_codes WHERE id = $2', [wrong, issued.codeId])).rows).toEqual([{ same: false }]);
    }

    // One row, by the operator of the session, naming the code by its ID.
    const rows = await trailSince(before);
    expect(rows.map((row) => [row.type, row.category, row.actorId, row.deviceId, row.details])).toEqual([
      ['PAIRING_CODE_ISSUED', 'PAIRING', SUPERVISOR.id, null, { codeId: issued.codeId, expiresAt: now + 300_000 }],
    ]);
    expect(JSON.stringify(rows).includes(issued.code)).toBe(false);
    expect(pairing.published).toContainEqual({ kind: 'admin.changed', resource: 'PAIRING_CODE' });
  });

  it('the status read shows the active code without the code, and nothing once it is closed', async () => {
    expect((await get(pairing.app, CODE, cookie)).json()).toEqual({ active: null });
    const issued = await issueCode(pairing, cookie);
    const status = await get(pairing.app, CODE, cookie);
    expectContract('getPairingCodeStatus', status);
    expect(status.json()).toEqual({
      active: { codeId: issued.codeId, issuedBy: SUPERVISOR.id, issuedAt: issued.issuedAt, expiresAt: issued.expiresAt, attemptsRemaining: 5 },
    });
    expect(status.body.includes(issued.code)).toBe(false);
    // A read: no header of API-7, no row.
    expect(status.headers['x-dems-revision']).toBeUndefined();

    await redeem(pairing.app, wrongCodeFor(issued.code));
    expect((await get(pairing.app, CODE, cookie)).json()).toMatchObject({ active: { codeId: issued.codeId, attemptsRemaining: 4 } });

    // One millisecond before its end it is active; at its end it is not, swept or not.
    pairing.clock.advance(299_999);
    expect((await get(pairing.app, CODE, cookie)).json()).toMatchObject({ active: { codeId: issued.codeId } });
    pairing.clock.advance(1);
    expect((await get(pairing.app, CODE, cookie)).json()).toEqual({ active: null });
    expect((await storedCode(owner, issued.codeId)).state).toBe('ACTIVE');
  });

  it('one code is active at a time: a new issue cancels the one that stands, with its own row', async () => {
    const first = await issueCode(pairing, cookie);
    const before = await trailLength();
    pairing.clock.advance(1_000);
    const second = await issueCode(pairing, cookie);

    expect(second.codeId).not.toBe(first.codeId);
    expect(await storedCode(owner, first.codeId)).toMatchObject({ state: 'CANCELLED', closedAt: pairing.clock.now(), closedBy: SUPERVISOR.id });
    expect((await storedCodes(owner)).filter((code) => code.state === 'ACTIVE').map((code) => code.id)).toEqual([second.codeId]);
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['PAIRING_CODE_CLOSED', SUPERVISOR.id, { codeId: first.codeId, reason: 'CANCELLED' }],
      ['PAIRING_CODE_ISSUED', SUPERVISOR.id, { codeId: second.codeId, expiresAt: pairing.clock.now() + 300_000 }],
    ]);
    // The cancelled code redeems nothing, and the answer does not say why.
    const refused = await redeem(pairing.app, first.code);
    // (If both codes happen to hold the same digits the redeem pairs: the digits are the proof.)
    if (first.code !== second.code) expect(outcomeOf(refused)).toEqual([401, 'INVALID_CODE']);
  });

  it('cancelPairingCode closes the active code; with none active it answers 204 and writes nothing', async () => {
    const issued = await issueCode(pairing, cookie);
    const before = await trailLength();
    const cancelled = await portalPost(pairing.app, CODE_CANCEL, cookie);
    expect(cancelled.statusCode).toBe(204);
    expect(cancelled.body).toBe('');
    expectContract('cancelPairingCode', cancelled);
    expect(cancelled.headers['x-dems-revision']).toBeDefined();
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'CANCELLED', closedBy: SUPERVISOR.id, closedAt: pairing.clock.now() });
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['PAIRING_CODE_CLOSED', SUPERVISOR.id, { codeId: issued.codeId, reason: 'CANCELLED' }],
    ]);

    const again = await portalPost(pairing.app, CODE_CANCEL, cookie);
    expect(again.statusCode).toBe(204);
    expect(await trailSince(before)).toHaveLength(1);
    expect((await get(pairing.app, CODE, cookie)).json()).toEqual({ active: null });
  });

  it('who may call is the guard\'s: an operator without PAIRING_MANAGE gets 403 with one ACCESS_DENIED row on each of the five portal operations', async () => {
    const investigator = (await signInOnWeb(pairing, INVESTIGATOR.username)).cookie;
    const before = await trailLength();
    const calls: Array<[string, () => ReturnType<typeof get>]> = [
      ['issuePairingCode', () => portalPost(pairing.app, CODE, investigator)],
      ['getPairingCodeStatus', () => get(pairing.app, CODE, investigator)],
      ['cancelPairingCode', () => portalPost(pairing.app, CODE_CANCEL, investigator)],
      ['listPairedDevices', () => get(pairing.app, DEVICES, investigator)],
      // A body that would not validate: the caller without the right never reaches validation.
      ['revokeDevice', () => portalPost(pairing.app, revokeUrl('DEV-0001'), investigator, { reason: 7 as unknown as string })],
    ];
    for (const [operationId, call] of calls) {
      const response = await call();
      expect(outcomeOf(response), operationId).toEqual([403, 'NOT_PERMITTED']);
      expectContract(operationId, response);
    }
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.details['operationId'], row.details['permission']])).toEqual(
      calls.map(([operationId]) => ['ACCESS_DENIED', INVESTIGATOR.id, operationId, 'PAIRING_MANAGE']),
    );
    expect(await storedCodes(owner).then((codes) => codes.filter((code) => code.state === 'ACTIVE'))).toEqual([]);
  });
});

describe('AC-B-34: redeemPairingCode', () => {
  it('returns a device ID and a credential once; the device is PAIRED in the registry; PAIRING_SUCCESS and the event PAIRED are written; a second redeem answers the generic 401', async () => {
    const issued = await issueCode(pairing, cookie);
    const before = await trailLength();
    const eventsBefore = (await readEvents(owner)).length;
    pairing.published.length = 0;
    pairing.clock.advance(5_000);
    const now = pairing.clock.now();

    const paired = await redeem(pairing.app, issued.code);
    expect(paired.statusCode).toBe(201);
    expectContract('redeemPairingCode', paired);
    const body = paired.json() as { deviceId: string; deviceCredential: string; pairedAt: number; core: Record<string, string> };
    expect(Object.keys(body).sort()).toEqual(['core', 'deviceCredential', 'deviceId', 'pairedAt']);
    expect(body.deviceId).toMatch(/^DEV-\d{4}$/);
    expect(DEVICE_CREDENTIAL_PATTERN.test(body.deviceCredential)).toBe(true);
    expect(body.pairedAt).toBe(now);
    const { rows: core } = await owner.query<{ id: string; name: string; certificate_fingerprint: string }>('SELECT id, name, certificate_fingerprint FROM public.core_device');
    expect(body.core).toEqual({ deviceId: core[0]?.id, name: core[0]?.name, certificateFingerprint: core[0]?.certificate_fingerprint });
    // A device's answer never sets a cookie (decision D69, rule D34-6 b); API-7 on the POST.
    expect(setCookies(paired)).toEqual([]);
    expect(paired.headers['x-dems-revision']).toBeDefined();

    // Stored: the code REDEEMED with its attempt given back, one device, the hash of its credential.
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'REDEEMED', failedAttempts: 0, closedAt: now, closedBy: null });
    const devices = (await storedDevices(owner)).filter((device) => device.id === body.deviceId);
    expect(devices).toEqual([
      {
        id: body.deviceId,
        state: 'PAIRED',
        name: TABLET.deviceName,
        pairedWithCodeId: issued.codeId,
        lastSeenAt: now,
        revokedBy: null,
        revokeReason: null,
        currentHashBytes: 32,
        hasNextHash: false,
        rotatedAt: null,
      },
    ]);
    const digest = createHash('sha256').update(body.deviceCredential, 'utf8').digest();
    expect((await owner.query<{ same: boolean }>('SELECT current_hash = $1 AS same FROM public.device_credentials WHERE device_id = $2', [digest, body.deviceId])).rows).toEqual([{ same: true }]);

    // The row names the new device, the code by its ID and the Core; the actor is the device (no operator).
    const rows = await trailSince(before);
    expect(rows.map((row) => [row.type, row.category, row.actorId, row.deviceId, row.details])).toEqual([
      ['PAIRING_SUCCESS', 'PAIRING', null, body.deviceId, { coreDeviceId: core[0]?.id, certificateFingerprint: core[0]?.certificate_fingerprint, codeId: issued.codeId }],
    ]);
    const events = (await readEvents(owner)).slice(eventsBefore);
    expect(events.map((event) => [event.type, event.deviceId, event.severity])).toEqual([['PAIRED', body.deviceId, 'SUCCESS']]);
    expect(pairing.published).toEqual([
      { kind: 'admin.changed', resource: 'DEVICES' },
      { kind: 'admin.changed', resource: 'PAIRING_CODE' },
    ]);

    // The portal lists it.
    const list = await get(pairing.app, DEVICES, cookie);
    expectContract('listPairedDevices', list);
    const listed = (list.json() as { devices: Array<Record<string, unknown>> }).devices.find((device) => device['id'] === body.deviceId);
    expect(listed).toEqual({
      id: body.deviceId,
      name: TABLET.deviceName,
      platform: 'android',
      appVersion: '0.2.0',
      state: 'PAIRED',
      pairedAt: now,
      pairedWithCodeId: issued.codeId,
      codeIssuedBy: SUPERVISOR.id,
      lastSeenAt: now,
      online: false,
      signedInOperatorId: null,
      credentialRotatedAt: null,
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
      unpairedAt: null,
    });
    expect(list.body.includes(body.deviceCredential)).toBe(false);

    // The same code again: used. The answer is the generic one, the attempt is audited, no device is added.
    const second = await redeem(pairing.app, issued.code);
    expect(outcomeOf(second)).toEqual([401, 'INVALID_CODE']);
    expectContract('redeemPairingCode', second);
    expect(errorOf(second)).toMatchObject({ message: 'The pairing code is not valid.', details: { attemptsRemaining: 2 } });
    expect(shape(await trailSince(before + 1))).toEqual([['PAIRING_FAILED', null, null]]);
    expect((await storedDevices(owner)).filter((device) => device.pairedWithCodeId === issued.codeId)).toHaveLength(1);
    await expectChainVerifies();
  });

  it('SR-29: a wrong, a used, a cancelled, an expired and an absent code get the same answer, byte for byte apart from the request ID', async () => {
    const answers: Array<Record<string, unknown>> = [];
    const collect = async (code: string): Promise<void> => {
      forgetLimits(pairing);
      const response = await redeem(pairing.app, code);
      expect(response.statusCode).toBe(401);
      const { error } = response.json() as { error: Record<string, unknown> };
      answers.push({ ...error, requestId: null, headers: Object.keys(response.headers).sort() });
    };

    await collect('123456'); // absent: no code is active
    const wrong = await issueCode(pairing, cookie);
    await collect(wrongCodeFor(wrong.code)); // wrong
    await portalPost(pairing.app, CODE_CANCEL, cookie);
    await collect(wrong.code); // cancelled
    const used = await issueCode(pairing, cookie);
    forgetLimits(pairing);
    expect((await redeem(pairing.app, used.code)).statusCode).toBe(201);
    await collect(used.code); // used
    const expired = await issueCode(pairing, cookie);
    pairing.clock.advance(300_000);
    await collect(expired.code); // expired

    expect(answers).toHaveLength(5);
    for (const answer of answers) expect(answer).toEqual(answers[0]);
    expect(answers[0]).toMatchObject({ code: 'INVALID_CODE', message: 'The pairing code is not valid.', details: { attemptsRemaining: 2 } });
  });

  it('a body that does not match the contract is 422 before any attempt is taken: no row, no count, the code untouched', async () => {
    const issued = await issueCode(pairing, cookie);
    const before = await trailLength();
    const bodies: Array<Record<string, unknown>> = [
      { code: '12345', ...TABLET },
      { code: '1234567', ...TABLET },
      { code: 'abcdef', ...TABLET },
      { code: issued.code },
      { code: issued.code, ...TABLET, deviceName: '' },
      { code: issued.code, ...TABLET, deviceName: 'x'.repeat(61) },
      { code: issued.code, ...TABLET, platform: 'p'.repeat(33) },
      { code: issued.code, ...TABLET, deviceName: 'tab\u0000let' },
      // A text that carries a secret into the registry: a credential form, or the code itself.
      { code: issued.code, ...TABLET, deviceName: `dvc_${'A'.repeat(43)}` },
      { code: issued.code, ...TABLET, deviceName: `Tablet ${issued.code}` },
      { code: issued.code, ...TABLET, appVersion: `DEMS-PAIR:1:${issued.code}` },
    ];
    for (const [index, payload] of bodies.entries()) {
      const response = await devicePost(pairing.app, REDEEM, null, payload);
      expect(outcomeOf(response), `body ${index}`).toEqual([422, 'INVALID_INPUT']);
      expectContract('redeemPairingCode', response);
      expect(response.body.includes(issued.code), `body ${index}`).toBe(false);
    }
    const malformed = await pairing.app.inject({ method: 'POST', url: REDEEM, headers: { 'content-type': 'application/json' }, payload: '{"code":"12' });
    expect(outcomeOf(malformed)).toEqual([400, 'INVALID_JSON']);
    expectContract('redeemPairingCode', malformed);

    expect(await trailSince(before)).toEqual([]);
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'ACTIVE', failedAttempts: 0 });
    expect(await pairing.pairing.lock.status(pairing.clock.now())).toMatchObject({ locked: false, attemptsRemaining: 3 });
    // And the code still pairs.
    forgetLimits(pairing);
    expect((await redeem(pairing.app, issued.code)).statusCode).toBe(201);
  });

  it('a web console origin, and an operator\'s session, may redeem too: the row then names the operator', async () => {
    const issued = await issueCode(pairing, cookie);
    const before = await trailLength();
    const response = await pairing.app.inject({ method: 'POST', url: REDEEM, headers: { origin: WEB_ORIGIN, ...cookie }, payload: { code: issued.code, ...TABLET } });
    expect(response.statusCode).toBe(201);
    const { deviceId } = response.json() as { deviceId: string };
    expect(shape(await trailSince(before))).toEqual([['PAIRING_SUCCESS', SUPERVISOR.id, deviceId]]);
    // A foreign origin is stage 3's: 403, no attempt, no row.
    const next = await issueCode(pairing, cookie);
    const foreign = await pairing.app.inject({ method: 'POST', url: REDEEM, headers: { origin: 'http://evil.example' }, payload: { code: next.code, ...TABLET } });
    expect(outcomeOf(foreign)).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    expectContract('redeemPairingCode', foreign);
    expect(await storedCode(owner, next.codeId)).toMatchObject({ state: 'ACTIVE', failedAttempts: 0 });
  });
});

describe('AC-B-35: a code past its 300 s', () => {
  it('redeems until its last millisecond', async () => {
    const issued = await issueCode(pairing, cookie);
    pairing.clock.advance(299_999);
    expect((await redeem(pairing.app, issued.code)).statusCode).toBe(201);
  });

  it('answers 401 INVALID_CODE at 300 s, and a PAIRING_CODE_CLOSED row with reason EXPIRED exists', async () => {
    const issued = await issueCode(pairing, cookie);
    const before = await trailLength();
    pairing.clock.advance(300_000);
    const now = pairing.clock.now();

    const refused = await redeem(pairing.app, issued.code);
    expect(outcomeOf(refused)).toEqual([401, 'INVALID_CODE']);
    expectContract('redeemPairingCode', refused);
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'EXPIRED', closedAt: now, closedBy: null, failedAttempts: 0 });
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['PAIRING_CODE_CLOSED', null, { codeId: issued.codeId, reason: 'EXPIRED' }],
      ['PAIRING_FAILED', null, { attemptsRemaining: 2, lockedUntil: null }],
    ]);
    expect(await storedDevices(owner).then((devices) => devices.filter((device) => device.pairedWithCodeId === issued.codeId))).toEqual([]);
  });

  it('the sweep closes it without a redeem, once; an issue and a cancel record an expired code as EXPIRED, not as cancelled', async () => {
    const swept = await issueCode(pairing, cookie);
    const before = await trailLength();
    expect(await pairing.pairing.sweepCodes()).toBeNull();
    pairing.clock.advance(300_000);
    pairing.published.length = 0;
    expect(await pairing.pairing.sweepCodes()).toBe(swept.codeId);
    expect(await pairing.pairing.sweepCodes()).toBeNull();
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['PAIRING_CODE_CLOSED', null, { codeId: swept.codeId, reason: 'EXPIRED' }],
    ]);
    expect(pairing.published).toEqual([{ kind: 'admin.changed', resource: 'PAIRING_CODE' }]);

    const cancelled = await issueCode(pairing, cookie);
    pairing.clock.advance(300_000);
    const mark = await trailLength();
    expect((await portalPost(pairing.app, CODE_CANCEL, cookie)).statusCode).toBe(204);
    expect(await storedCode(owner, cancelled.codeId)).toMatchObject({ state: 'EXPIRED', closedBy: null });

    const replaced = await issueCode(pairing, cookie);
    pairing.clock.advance(300_000);
    const next = await issueCode(pairing, cookie);
    expect(await storedCode(owner, replaced.codeId)).toMatchObject({ state: 'EXPIRED', closedBy: null });
    expect(await storedCode(owner, next.codeId)).toMatchObject({ state: 'ACTIVE' });
    const closes = (await trailSince(mark)).filter((row) => row.type === 'PAIRING_CODE_CLOSED').map((row) => [row.actorId, row.details]);
    expect(closes).toEqual([
      [null, { codeId: cancelled.codeId, reason: 'EXPIRED' }],
      [null, { codeId: replaced.codeId, reason: 'EXPIRED' }],
    ]);
  });
});

describe('AC-B-36: three wrong codes lock redeeming for 60 s; the fifth wrong code closes the active code', () => {
  it('401, 401, then 423 with lockedUntil; during the lock 423 PAIRING_LOCKED and nothing is compared; after the lock two more close the code as EXHAUSTED', async () => {
    const issued = await issueCode(pairing, cookie);
    const wrong = wrongCodeFor(issued.code);
    const before = await trailLength();
    const eventsBefore = (await readEvents(owner)).length;
    const start = pairing.clock.now();

    const first = await redeem(pairing.app, wrong);
    const second = await redeem(pairing.app, wrong);
    expect([outcomeOf(first), outcomeOf(second)]).toEqual([
      [401, 'INVALID_CODE'],
      [401, 'INVALID_CODE'],
    ]);
    expect([errorOf(first).details, errorOf(second).details]).toEqual([{ attemptsRemaining: 2 }, { attemptsRemaining: 1 }]);

    // The third failure is the locking one: 423 with the end of the lock (the simulator's result).
    const third = await redeem(pairing.app, wrong);
    expect(outcomeOf(third)).toEqual([423, 'LOCKED']);
    expectContract('redeemPairingCode', third);
    expect(errorOf(third)).toMatchObject({ message: 'Too many failed pairing attempts. Try again shortly.', details: { lockedUntil: start + 60_000, retryInMs: 60_000 } });
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'ACTIVE', failedAttempts: 3 });

    // During the lock: also the RIGHT code is refused, not compared and not counted on the code.
    pairing.clock.advance(20_000);
    for (const code of [wrong, issued.code]) {
      const locked = await redeem(pairing.app, code);
      expect(outcomeOf(locked)).toEqual([423, 'LOCKED']);
      expect(errorOf(locked).details).toEqual({ lockedUntil: start + 60_000, retryInMs: 40_000 });
    }
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'ACTIVE', failedAttempts: 3 });
    expect((await get(pairing.app, CODE, cookie)).json()).toMatchObject({ active: { attemptsRemaining: 2 } });

    // One millisecond before the end it is still locked; at the end the count is fresh.
    pairing.clock.advance(39_999);
    expect((await redeem(pairing.app, wrong)).statusCode).toBe(423);
    pairing.clock.advance(1);
    const fourth = await redeem(pairing.app, wrong);
    expect(outcomeOf(fourth)).toEqual([401, 'INVALID_CODE']);
    expect(errorOf(fourth).details).toEqual({ attemptsRemaining: 2 });
    const fifth = await redeem(pairing.app, wrong);
    expect(outcomeOf(fifth)).toEqual([401, 'INVALID_CODE']);
    const closedAt = pairing.clock.now();
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'EXHAUSTED', failedAttempts: 5, closedAt, closedBy: null });

    // The right code after the close: the generic failure (and, being the third of this window, the locking one).
    const late = await redeem(pairing.app, issued.code);
    expect(late.statusCode).toBe(423);
    expect(await storedDevices(owner).then((devices) => devices.filter((device) => device.pairedWithCodeId === issued.codeId))).toEqual([]);

    const rows = await trailSince(before);
    expect(rows.map((row) => [row.type, row.details])).toEqual([
      ['PAIRING_FAILED', { attemptsRemaining: 2, lockedUntil: null }],
      ['PAIRING_FAILED', { attemptsRemaining: 1, lockedUntil: null }],
      ['PAIRING_FAILED', { attemptsRemaining: 0, lockedUntil: start + 60_000 }],
      ['PAIRING_LOCKED', { retryInMs: 40_000, lockedUntil: start + 60_000 }],
      ['PAIRING_LOCKED', { retryInMs: 40_000, lockedUntil: start + 60_000 }],
      ['PAIRING_LOCKED', { retryInMs: 1, lockedUntil: start + 60_000 }],
      ['PAIRING_FAILED', { attemptsRemaining: 2, lockedUntil: null }],
      ['PAIRING_FAILED', { attemptsRemaining: 1, lockedUntil: null }],
      ['PAIRING_CODE_CLOSED', { codeId: issued.codeId, reason: 'EXHAUSTED' }],
      ['PAIRING_FAILED', { attemptsRemaining: 0, lockedUntil: closedAt + 60_000 }],
    ]);
    expect(rows.every((row) => row.actorId === null && row.deviceId === null && row.category === 'PAIRING')).toBe(true);
    // A failure has its event, as in the simulator; a locked attempt has none.
    expect((await readEvents(owner)).slice(eventsBefore).map((event) => [event.type, event.params])).toEqual([
      ['PAIRING_FAILED', { attemptsRemaining: 2 }],
      ['PAIRING_FAILED', { attemptsRemaining: 1 }],
      ['PAIRING_FAILED', { attemptsRemaining: 0 }],
      ['PAIRING_FAILED', { attemptsRemaining: 2 }],
      ['PAIRING_FAILED', { attemptsRemaining: 1 }],
      ['PAIRING_FAILED', { attemptsRemaining: 0 }],
    ]);
    await expectChainVerifies();
  });

  it('a successful redeem clears the count: two failures, a success, and three more attempts are open', async () => {
    const issued = await issueCode(pairing, cookie);
    const wrong = wrongCodeFor(issued.code);
    await redeem(pairing.app, wrong);
    await redeem(pairing.app, wrong);
    expect(await pairing.pairing.lock.status(pairing.clock.now())).toMatchObject({ attemptsRemaining: 1 });
    // The third attempt of the window is the right code: taking it sets the lock, the success lifts it.
    expect((await redeem(pairing.app, issued.code)).statusCode).toBe(201);
    expect(await pairing.pairing.lock.status(pairing.clock.now())).toEqual({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 3 });
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'REDEEMED', failedAttempts: 2 });
    const next = await redeem(pairing.app, wrong);
    expect(errorOf(next).details).toEqual({ attemptsRemaining: 2 });
  });
});
