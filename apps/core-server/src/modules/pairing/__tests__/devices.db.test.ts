// The device registry and the life of a paired device, against PostgreSQL (plan row W32; spec
// §4.7, §6.3 T7 to T9, §6.5, §6.6, §7.7 operations 19 to 23; SR-31, SR-33 to SR-35; AC-B-37,
// AC-B-38). A clone of the seed template, the code under test as `dems_app`, every stage as the
// server has it, the REAL device resolver: every device here was paired through the module.
//
// No code and no credential is printed: a failure names an identifier, a status or a count.
import { randomBytes } from 'node:crypto';
import { DEVICE_CREDENTIAL_PATTERN } from '@dems/shared/api';
import type { AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import {
  MINUTE,
  SESSION,
  SIGN_IN,
  SIGN_OUT,
  STATUS,
  TOUCH,
  deviceSignIn,
  errorOf,
  get,
  sessionOfToken,
  setCookies,
  storedSessions,
  type Headers,
} from '../../../../test/support/identity';
import {
  CODE,
  DEVICE,
  DEVICES,
  INVESTIGATOR,
  REDEEM,
  ROTATE,
  SUPERVISOR,
  UNPAIR,
  deviceGet,
  devicePost,
  expectContract,
  forgetLimits,
  issueCode,
  outcomeOf,
  pairDevice,
  pairingApp,
  portalPost,
  revokeUrl,
  storedDevice,
  supervisorCookie,
  type PairedTestDevice,
  type PairingApp,
} from '../../../../test/support/pairing';

const db = useTestDatabase({ template: 'seed' });
let pairing: PairingApp;
let owner: Pool;
let cookie: Headers;

const REASON = 'Tablet reported lost by the investigator';

beforeAll(async () => {
  owner = db.ownerPool();
  pairing = await pairingApp(db);
});

beforeEach(async () => {
  forgetLimits(pairing);
  pairing.clock.advance(10 * MINUTE);
  cookie = await supervisorCookie(pairing);
  pairing.published.length = 0;
});

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const trailSince = async (from: number): Promise<AuditRow[]> => (await readTrail(owner)).slice(from);
const tokenOf = async (device: PairedTestDevice, username: string): Promise<string> => {
  const response = await deviceSignIn(pairing.app, device.credential, username);
  if (response.statusCode !== 200) throw new Error(`the device sign-in answered ${response.statusCode}`);
  return (response.json() as { sessionToken: string }).sessionToken;
};
const listed = async (deviceId: string): Promise<Record<string, unknown>> => {
  const list = await get(pairing.app, DEVICES, cookie);
  expectContract('listPairedDevices', list);
  const device = (list.json() as { devices: Array<Record<string, unknown>> }).devices.find((candidate) => candidate['id'] === deviceId);
  if (device === undefined) throw new Error(`the registry does not list ${deviceId}`);
  return device;
};

async function expectChainVerifies(): Promise<void> {
  const rows = await readTrail(owner);
  const head = await readHead(owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
}

describe('AC-B-37: a sign-in on a paired device creates a session bound to it', () => {
  it('the answer carries the token in the body and no cookie; AUTH_SUCCESS and the registry name the device and the operator', async () => {
    const device = await pairDevice(pairing, cookie);
    const before = await trailLength();
    const response = await deviceSignIn(pairing.app, device.credential, INVESTIGATOR.username);
    expect(response.statusCode).toBe(200);
    expect(setCookies(response)).toEqual([]);
    const { sessionToken, session } = response.json() as { sessionToken: string; session: { deviceId: string } };
    expect(session.deviceId).toBe(device.deviceId);

    expect(await sessionOfToken(owner, sessionToken)).toMatchObject({ operatorId: INVESTIGATOR.id, deviceId: device.deviceId, endedAt: null });
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.deviceId])).toEqual([['AUTH_SUCCESS', INVESTIGATOR.id, device.deviceId]]);
    expect(await listed(device.deviceId)).toMatchObject({ state: 'PAIRED', signedInOperatorId: INVESTIGATOR.id, online: false });

    // The session answers on the bearer transport, and the status read is the device's own lock state.
    expect((await deviceGet(pairing.app, SESSION, sessionToken)).json()).toMatchObject({ deviceId: device.deviceId, operator: { id: INVESTIGATOR.id } });
    expect((await deviceGet(pairing.app, STATUS, device.credential)).json()).toMatchObject({ locked: false, attemptsRemaining: 5 });
  });

  it('the registry shows the operator of the NEWEST open session that is inside its limits (decision D14)', async () => {
    const device = await pairDevice(pairing, cookie);
    const first = await tokenOf(device, INVESTIGATOR.username);
    expect((await listed(device.deviceId))['signedInOperatorId']).toBe(INVESTIGATOR.id);
    pairing.clock.advance(1_000);
    // A cold start signs in again without presenting the old token: two open sessions.
    const second = await tokenOf(device, SUPERVISOR.username);
    expect((await storedSessions(owner)).filter((session) => session.deviceId === device.deviceId && session.endedAt === null)).toHaveLength(2);
    expect((await listed(device.deviceId))['signedInOperatorId']).toBe(SUPERVISOR.id);

    expect((await devicePost(pairing.app, SIGN_OUT, second)).statusCode).toBe(204);
    expect((await listed(device.deviceId))['signedInOperatorId']).toBe(INVESTIGATOR.id);

    // Fifteen minutes without activity: the session is not swept yet, and the registry does not show it.
    pairing.clock.advance(15 * MINUTE);
    cookie = await supervisorCookie(pairing);
    expect((await listed(device.deviceId))['signedInOperatorId']).toBeNull();
    expect(await sessionOfToken(owner, first)).toMatchObject({ endedAt: null });
  });

  it('online follows the presence counter that the realtime channel feeds; nothing of it is stored', async () => {
    const device = await pairDevice(pairing, cookie);
    const { presence } = pairing.pairing;
    expect((await listed(device.deviceId))['online']).toBe(false);
    presence.socketOpened(device.deviceId);
    presence.socketOpened(device.deviceId);
    expect((await listed(device.deviceId))['online']).toBe(true);
    presence.socketClosed(device.deviceId);
    expect((await listed(device.deviceId))['online']).toBe(true);
    presence.socketClosed(device.deviceId);
    expect((await listed(device.deviceId))['online']).toBe(false);
    presence.reset();
  });
});

describe('spec §6.5: lastSeenAt is written at most once a minute, by an authenticated request of the device', () => {
  it('a request within the minute writes nothing; at 60 s it is written, by the credential and by a session token; a GET is enough', async () => {
    const device = await pairDevice(pairing, cookie);
    const pairedAt = pairing.clock.now();
    expect((await storedDevice(owner, device.deviceId)).lastSeenAt).toBe(pairedAt);

    pairing.clock.advance(59_999);
    expect((await deviceGet(pairing.app, DEVICE, device.credential)).statusCode).toBe(200);
    expect((await storedDevice(owner, device.deviceId)).lastSeenAt).toBe(pairedAt);

    pairing.clock.advance(1);
    const before = await trailLength();
    expect((await deviceGet(pairing.app, DEVICE, device.credential)).statusCode).toBe(200);
    expect((await storedDevice(owner, device.deviceId)).lastSeenAt).toBe(pairedAt + 60_000);
    // Bookkeeping, not an audited change.
    expect(await trailSince(before)).toEqual([]);

    const token = await tokenOf(device, INVESTIGATOR.username);
    pairing.clock.advance(30_000);
    expect((await deviceGet(pairing.app, SESSION, token)).statusCode).toBe(200);
    expect((await storedDevice(owner, device.deviceId)).lastSeenAt).toBe(pairedAt + 60_000);
    pairing.clock.advance(30_000);
    expect((await deviceGet(pairing.app, SESSION, token)).statusCode).toBe(200);
    expect((await storedDevice(owner, device.deviceId)).lastSeenAt).toBe(pairedAt + 120_000);
    expect((await listed(device.deviceId))['lastSeenAt']).toBe(pairedAt + 120_000);

    // A retired device is not seen any more.
    expect((await portalPost(pairing.app, revokeUrl(device.deviceId), cookie, { reason: REASON })).statusCode).toBe(200);
    pairing.clock.advance(5 * MINUTE);
    expect((await deviceGet(pairing.app, DEVICE, device.credential)).statusCode).toBe(403);
    expect((await storedDevice(owner, device.deviceId)).lastSeenAt).toBe(pairedAt + 120_000);
  });
});

describe('operation 21 getDeviceRegistration', () => {
  it('a paired device reads its own registration and the Core it is paired with; a web session is told that it is no device', async () => {
    const device = await pairDevice(pairing, cookie, 'Registration tablet');
    const response = await deviceGet(pairing.app, DEVICE, device.credential);
    expect(response.statusCode).toBe(200);
    expectContract('getDeviceRegistration', response);
    const { rows: core } = await owner.query<{ id: string; name: string; certificate_fingerprint: string }>('SELECT id, name, certificate_fingerprint FROM public.core_device');
    expect(response.json()).toEqual({
      deviceId: device.deviceId,
      name: 'Registration tablet',
      state: 'PAIRED',
      pairedAt: device.pairedAt,
      credentialRotatedAt: null,
      core: { deviceId: core[0]?.id, name: core[0]?.name, certificateFingerprint: core[0]?.certificate_fingerprint },
    });
    expect(setCookies(response)).toEqual([]);
    // The same through a session of the device.
    const token = await tokenOf(device, INVESTIGATOR.username);
    expect((await deviceGet(pairing.app, DEVICE, token)).json()).toMatchObject({ deviceId: device.deviceId });

    // A web console session is an operator without a device: the guard's 403, no row.
    const before = await trailLength();
    for (const call of [() => get(pairing.app, DEVICE, cookie), () => portalPost(pairing.app, UNPAIR, cookie), () => portalPost(pairing.app, ROTATE, cookie)]) {
      const refused = await call();
      expect(outcomeOf(refused)).toEqual([403, 'DEVICE_NOT_PAIRED']);
    }
    expect(await trailSince(before)).toEqual([]);
    expect((await storedDevice(owner, device.deviceId)).state).toBe('PAIRED');
  });
});

describe('AC-B-38: revokeDevice', () => {
  it('ends the device\'s sessions, revokes its live biometric tokens, writes DEVICE_REVOKED with sessionsEnded, publishes device.revoked; the next call of the device answers 403 DEVICE_REVOKED; a new redeem creates a new device', async () => {
    const device = await pairDevice(pairing, cookie);
    const other = await pairDevice(pairing, cookie, 'Another tablet');
    const investigator = await tokenOf(device, INVESTIGATOR.username);
    const supervisor = await tokenOf(device, SUPERVISOR.username);
    const untouched = await tokenOf(other, INVESTIGATOR.username);
    pairing.pairing.presence.socketOpened(device.deviceId);

    // Biometric tokens are plan row W41's; these are fixture rows: one live and one used of the
    // device, one live of another device.
    const issuedAt = pairing.clock.now();
    const token = async (deviceId: string, operatorId: string, usedAt: number | null): Promise<string> => {
      const { rows } = await owner.query<{ id: string }>(
        'INSERT INTO public.biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at, used_at) VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, $6) RETURNING id',
        [randomBytes(32), deviceId, operatorId, issuedAt, issuedAt + 30 * 24 * 60 * MINUTE, usedAt],
      );
      return rows[0]?.id ?? '';
    };
    const live = await token(device.deviceId, INVESTIGATOR.id, null);
    const used = await token(device.deviceId, SUPERVISOR.id, issuedAt);
    const foreign = await token(other.deviceId, INVESTIGATOR.id, null);

    pairing.clock.advance(5_000);
    const now = pairing.clock.now();
    const before = await trailLength();
    const eventsBefore = (await readEvents(owner)).length;
    pairing.published.length = 0;

    const revoked = await portalPost(pairing.app, revokeUrl(device.deviceId), cookie, { reason: `  ${REASON}  ` });
    expect(revoked.statusCode).toBe(200);
    expectContract('revokeDevice', revoked);
    expect(revoked.headers['x-dems-revision']).toBeDefined();
    expect(revoked.json()).toMatchObject({
      id: device.deviceId,
      state: 'REVOKED',
      online: false,
      signedInOperatorId: null,
      revokedAt: now,
      revokedBy: SUPERVISOR.id,
      revokeReason: REASON,
      unpairedAt: null,
      pairedWithCodeId: device.codeId,
      codeIssuedBy: SUPERVISOR.id,
    });

    // One unit: the state, the sessions, the tokens, the row, the event.
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ state: 'REVOKED', revokedBy: SUPERVISOR.id, revokeReason: REASON, currentHashBytes: 32 });
    for (const sessionToken of [investigator, supervisor]) {
      expect(await sessionOfToken(owner, sessionToken)).toMatchObject({ endedAt: now, endReason: 'DEVICE_REVOKED' });
    }
    expect(await sessionOfToken(owner, untouched)).toMatchObject({ endedAt: null });
    const { rows: tokens } = await owner.query<{ id: string; revoked_at: string | null; revoke_reason: string | null }>(
      'SELECT id, revoked_at, revoke_reason FROM public.biometric_tokens WHERE id = ANY($1::uuid[])',
      [[live, used, foreign]],
    );
    const byId = new Map(tokens.map((row) => [row.id, [row.revoked_at === null ? null : Number(row.revoked_at), row.revoke_reason]]));
    expect([byId.get(live), byId.get(used), byId.get(foreign)]).toEqual([
      [now, 'DEVICE_REVOKED'],
      [null, null],
      [null, null],
    ]);
    expect((await trailSince(before)).map((row) => [row.type, row.category, row.severity, row.actorId, row.deviceId, row.details])).toEqual([
      ['DEVICE_REVOKED', 'PAIRING', 'WARNING', SUPERVISOR.id, device.deviceId, { reason: REASON, sessionsEnded: 2 }],
    ]);
    expect((await readEvents(owner)).slice(eventsBefore).map((event) => [event.type, event.deviceId])).toEqual([['UNPAIRED', device.deviceId]]);
    // After the commit: the realtime channel closes the device's sockets (4403); the portal reads its list again.
    expect(pairing.published).toEqual([
      { kind: 'device.revoked', deviceId: device.deviceId, reason: 'REVOKED' },
      { kind: 'admin.changed', resource: 'DEVICES' },
    ]);
    expect(pairing.pairing.presence.isOnline(device.deviceId)).toBe(false);
    expect(await listed(device.deviceId)).toMatchObject({ state: 'REVOKED', online: false, signedInOperatorId: null });

    // The next call of the device: 403 DEVICE_REVOKED with the guard's one row, for the
    // credential and for each of its session tokens.
    const mark = await trailLength();
    const calls = [
      await deviceGet(pairing.app, DEVICE, device.credential),
      await deviceGet(pairing.app, SESSION, investigator),
      await devicePost(pairing.app, TOUCH, supervisor),
      await devicePost(pairing.app, SIGN_IN, device.credential, { username: INVESTIGATOR.username, password: 'x' }),
    ];
    for (const call of calls) {
      expect(outcomeOf(call)).toEqual([403, 'DEVICE_REVOKED']);
      expect(errorOf(call).details).toEqual({ reason: 'DEVICE_REVOKED' });
      expect(setCookies(call)).toEqual([]);
    }
    expectContract('getDeviceRegistration', calls[0]!);
    expect((await trailSince(mark)).map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['ACCESS_DENIED', null, device.deviceId, { operationId: 'getDeviceRegistration', reason: 'DEVICE_REVOKED' }],
      ['ACCESS_DENIED', null, device.deviceId, { operationId: 'getAuthSession', reason: 'DEVICE_REVOKED' }],
      ['ACCESS_DENIED', null, device.deviceId, { operationId: 'touchSession', reason: 'DEVICE_REVOKED' }],
      ['ACCESS_DENIED', null, device.deviceId, { operationId: 'signIn', reason: 'DEVICE_REVOKED' }],
    ]);
    // The other device is not touched.
    expect((await deviceGet(pairing.app, SESSION, untouched)).statusCode).toBe(200);

    // REVOKED is final. Pairing again, with the retired credential still in the header, makes a NEW device.
    const issued = await issueCode(pairing, cookie);
    const again = await devicePost(pairing.app, REDEEM, device.credential, { code: issued.code, deviceName: 'Same tablet, paired again', platform: 'android', appVersion: '0.2.0' });
    expect(again.statusCode).toBe(201);
    const fresh = again.json() as { deviceId: string; deviceCredential: string };
    expect(fresh.deviceId).not.toBe(device.deviceId);
    expect(DEVICE_CREDENTIAL_PATTERN.test(fresh.deviceCredential)).toBe(true);
    expect(fresh.deviceCredential === device.credential).toBe(false);
    expect((await deviceGet(pairing.app, DEVICE, fresh.deviceCredential)).statusCode).toBe(200);
    expect((await storedDevice(owner, device.deviceId)).state).toBe('REVOKED');
    await expectChainVerifies();
  });

  it('spec §6.6: a retired device may call health and redeem; every other operation answers 403 with exactly one ACCESS_DENIED row', async () => {
    const device = await pairDevice(pairing, cookie);
    expect((await portalPost(pairing.app, revokeUrl(device.deviceId), cookie, { reason: REASON })).statusCode).toBe(200);
    forgetLimits(pairing);
    const before = await trailLength();

    expect((await deviceGet(pairing.app, '/api/v1/health', device.credential)).statusCode).toBe(200);
    // The redeem reaches its handler: with no code active it is the generic failure, audited as a pairing failure.
    const failed = await devicePost(pairing.app, REDEEM, device.credential, { code: '000000', deviceName: 'x', platform: 'android', appVersion: '0.2.0' });
    expect(outcomeOf(failed)).toEqual([401, 'INVALID_CODE']);
    expect((await trailSince(before)).map((row) => [row.type, row.deviceId])).toEqual([['PAIRING_FAILED', null]]);

    const refused: Array<[string, 'GET' | 'POST', string]> = [
      ['getSignInStatus', 'GET', STATUS],
      ['getPairingCodeStatus', 'GET', CODE],
      ['listPairedDevices', 'GET', DEVICES],
      ['getDeviceRegistration', 'GET', DEVICE],
      ['unpairDevice', 'POST', UNPAIR],
      ['rotateDeviceCredential', 'POST', ROTATE],
      ['issuePairingCode', 'POST', CODE],
      ['revokeDevice', 'POST', revokeUrl(device.deviceId)],
    ];
    const mark = await trailLength();
    for (const [operationId, method, url] of refused) {
      const response = method === 'GET' ? await deviceGet(pairing.app, url, device.credential) : await devicePost(pairing.app, url, device.credential);
      expect(outcomeOf(response), operationId).toEqual([403, 'DEVICE_REVOKED']);
    }
    expect((await trailSince(mark)).map((row) => [row.type, row.deviceId, row.details['operationId']])).toEqual(
      refused.map(([operationId]) => ['ACCESS_DENIED', device.deviceId, operationId]),
    );
    expect((await storedDevice(owner, device.deviceId)).hasNextHash).toBe(false);
  });

  it('answers 404 for an unknown device, 409 for one that is not PAIRED, and 422 INVALID_REASON only for a device it could revoke (spec §7.3 line 10)', async () => {
    const device = await pairDevice(pairing, cookie);
    const gone = await pairDevice(pairing, cookie, 'Unpaired tablet');
    expect((await devicePost(pairing.app, UNPAIR, gone.credential)).statusCode).toBe(204);
    const before = await trailLength();
    const post = (deviceId: string, payload: Record<string, unknown>) => portalPost(pairing.app, revokeUrl(deviceId), cookie, payload);

    const unknown = await post('DEV-9999', { reason: REASON });
    expect(outcomeOf(unknown)).toEqual([404, 'NOT_FOUND']);
    expect(errorOf(unknown).message).toBe('No device has this ID.');
    expectContract('revokeDevice', unknown);

    const unpaired = await post(gone.deviceId, { reason: REASON });
    expect(outcomeOf(unpaired)).toEqual([409, 'INVALID_STATE']);
    expect(errorOf(unpaired).message).toBe(`Device ${gone.deviceId} is UNPAIRED.`);
    expectContract('revokeDevice', unpaired);

    // A reason under five characters, after trimming: INVALID_REASON, and nothing is changed.
    for (const reason of ['abc', '   ab   ', '', 'four']) {
      const short = await post(device.deviceId, { reason });
      expect(outcomeOf(short), JSON.stringify(reason)).toEqual([422, 'INVALID_REASON']);
      expect(errorOf(short).message).toBe('A revoke reason of at least 5 characters is required.');
      expectContract('revokeDevice', short);
    }
    // The order: 404, then 409, then the reason.
    expect(outcomeOf(await post('DEV-9999', { reason: 'no' }))).toEqual([404, 'NOT_FOUND']);
    expect(outcomeOf(await post(gone.deviceId, { reason: 'no' }))).toEqual([409, 'INVALID_STATE']);

    // Everything else that does not match the contract: INVALID_INPUT, before any of the above.
    const invalid: Array<[string, string, Record<string, unknown>, string]> = [
      ['a malformed ID', 'DEV-1', { reason: REASON }, 'params'],
      ['an ID of another kind', 'OPR-001', { reason: REASON }, 'params'],
      ['a malformed ID with a short reason', 'DEV-1', { reason: 'no' }, 'params'],
      ['no reason', device.deviceId, {}, 'body'],
      ['a reason that is no text', device.deviceId, { reason: 12345 }, 'body'],
      ['a reason over 500 characters', device.deviceId, { reason: 'r'.repeat(501) }, 'body'],
      ['a reason with U+0000', device.deviceId, { reason: 'lost\u0000tablet' }, 'body'],
      ['a short reason with U+0000', device.deviceId, { reason: 'a\u0000' }, 'body'],
      ['a reason that holds the form of a credential', device.deviceId, { reason: `stolen ses_${'A'.repeat(43)} today` }, 'body'],
    ];
    for (const [name, deviceId, payload, where] of invalid) {
      const response = await post(deviceId, payload);
      expect(outcomeOf(response), name).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(response).details, name).toEqual({ in: where });
      expectContract('revokeDevice', response);
    }
    const malformed = await pairing.app.inject({
      method: 'POST',
      url: revokeUrl(device.deviceId),
      headers: { origin: 'http://127.0.0.1:5173', 'content-type': 'application/json', ...cookie },
      payload: '{"reason":"Tablet rep',
    });
    expect(outcomeOf(malformed)).toEqual([400, 'INVALID_JSON']);
    expectContract('revokeDevice', malformed);

    // None of these wrote a row or changed the device.
    expect(await trailSince(before)).toEqual([]);
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ state: 'PAIRED', revokedBy: null, revokeReason: null });

    // A reason of exactly five and of exactly 500 characters revokes; a second revoke is 409.
    const five = await post(device.deviceId, { reason: 'stole' });
    expect(five.statusCode).toBe(200);
    const again = await post(device.deviceId, { reason: REASON });
    expect(outcomeOf(again)).toEqual([409, 'INVALID_STATE']);
    expect(errorOf(again).message).toBe(`Device ${device.deviceId} is REVOKED.`);
    const long = await pairDevice(pairing, cookie, 'Long reason tablet');
    expect((await post(long.deviceId, { reason: 'r'.repeat(500) })).statusCode).toBe(200);
    expect((await trailSince(before)).filter((row) => row.type === 'DEVICE_REVOKED').map((row) => [row.deviceId, row.details['sessionsEnded']])).toEqual([
      [device.deviceId, 0],
      [long.deviceId, 0],
    ]);
  });
});

describe('operation 22 unpairDevice', () => {
  it('by its credential: 204, UNPAIRED with the device and no operator, its sessions ended, device.revoked published; the next call answers 403', async () => {
    const device = await pairDevice(pairing, cookie);
    const token = await tokenOf(device, INVESTIGATOR.username);
    pairing.clock.advance(2_000);
    const now = pairing.clock.now();
    const before = await trailLength();
    const eventsBefore = (await readEvents(owner)).length;
    pairing.published.length = 0;

    const response = await devicePost(pairing.app, UNPAIR, device.credential);
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expectContract('unpairDevice', response);
    expect(response.headers['x-dems-revision']).toBeDefined();
    expect(setCookies(response)).toEqual([]);

    const { rows } = await owner.query<{ state: string; unpaired_at: string; revoked_at: string | null }>('SELECT state, unpaired_at, revoked_at FROM public.paired_devices WHERE id = $1', [device.deviceId]);
    expect(rows).toEqual([{ state: 'UNPAIRED', unpaired_at: String(now), revoked_at: null }]);
    expect(await sessionOfToken(owner, token)).toMatchObject({ endedAt: now, endReason: 'DEVICE_UNPAIRED' });
    expect((await trailSince(before)).map((row) => [row.type, row.category, row.actorId, row.deviceId, row.details])).toEqual([
      ['UNPAIRED', 'PAIRING', null, device.deviceId, { sessionsEnded: 1 }],
    ]);
    expect((await readEvents(owner)).slice(eventsBefore).map((event) => [event.type, event.deviceId])).toEqual([['UNPAIRED', device.deviceId]]);
    expect(pairing.published).toEqual([
      { kind: 'device.revoked', deviceId: device.deviceId, reason: 'UNPAIRED' },
      { kind: 'admin.changed', resource: 'DEVICES' },
    ]);
    expect(await listed(device.deviceId)).toMatchObject({ state: 'UNPAIRED', unpairedAt: now, revokedAt: null, signedInOperatorId: null });

    // UNPAIRED is final: a second unpair, and everything else, is refused by the guard.
    for (const call of [await devicePost(pairing.app, UNPAIR, device.credential), await deviceGet(pairing.app, SESSION, token)]) {
      expect(outcomeOf(call)).toEqual([403, 'DEVICE_REVOKED']);
    }
    expect((await trailSince(before)).map((row) => row.type)).toEqual(['UNPAIRED', 'ACCESS_DENIED', 'ACCESS_DENIED']);
  });

  it('from an operator\'s session on the device: the row names that operator, and the session that asked is ended with the others', async () => {
    const device = await pairDevice(pairing, cookie);
    const investigator = await tokenOf(device, INVESTIGATOR.username);
    const supervisor = await tokenOf(device, SUPERVISOR.username);
    pairing.clock.advance(2_000);
    const before = await trailLength();
    const response = await devicePost(pairing.app, UNPAIR, investigator);
    expect(response.statusCode).toBe(204);
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['UNPAIRED', INVESTIGATOR.id, device.deviceId, { sessionsEnded: 2 }],
    ]);
    for (const token of [investigator, supervisor]) expect(await sessionOfToken(owner, token)).toMatchObject({ endReason: 'DEVICE_UNPAIRED' });
  });
});

describe('operation 23 rotateDeviceCredential: two phases (SR-33)', () => {
  it('the new credential is returned once and stored as "next"; the old one stays valid until the new one is first used; then the old one is refused', async () => {
    const device = await pairDevice(pairing, cookie);
    pairing.clock.advance(3_000);
    const now = pairing.clock.now();
    const before = await trailLength();
    pairing.published.length = 0;

    const response = await devicePost(pairing.app, ROTATE, device.credential);
    expect(response.statusCode).toBe(200);
    expectContract('rotateDeviceCredential', response);
    expect(setCookies(response)).toEqual([]);
    expect(response.headers['x-dems-revision']).toBeDefined();
    const { deviceCredential: next, rotatedAt } = response.json() as { deviceCredential: string; rotatedAt: number };
    expect(DEVICE_CREDENTIAL_PATTERN.test(next)).toBe(true);
    expect(next === device.credential).toBe(false);
    expect(rotatedAt).toBe(now);

    // Phase one: stored as "next"; the row names the device and no actor (spec §13.1).
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ state: 'PAIRED', currentHashBytes: 32, hasNextHash: true, rotatedAt: now });
    expect((await trailSince(before)).map((row) => [row.type, row.category, row.severity, row.actorId, row.deviceId, row.details])).toEqual([
      ['DEVICE_CREDENTIAL_ROTATED', 'PAIRING', 'WARNING', null, device.deviceId, {}],
    ]);
    expect(pairing.published).toEqual([{ kind: 'admin.changed', resource: 'DEVICES' }]);
    expect(await listed(device.deviceId)).toMatchObject({ credentialRotatedAt: now });

    // The old credential is still valid, any number of times: a lost answer costs nothing.
    for (let call = 0; call < 3; call += 1) expect((await deviceGet(pairing.app, DEVICE, device.credential)).statusCode).toBe(200);
    expect((await storedDevice(owner, device.deviceId)).hasNextHash).toBe(true);

    // Phase two: the first use of the new credential promotes it.
    const first = await deviceGet(pairing.app, DEVICE, next);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ deviceId: device.deviceId, credentialRotatedAt: now });
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ currentHashBytes: 32, hasNextHash: false });
    // No row for the promotion: the rotation's row is the record.
    expect(await trailSince(before)).toHaveLength(1);

    // From then on the old credential is unknown: 401, no row (it names no device any more).
    const old = await deviceGet(pairing.app, DEVICE, device.credential);
    expect(outcomeOf(old)).toEqual([401, 'NOT_SIGNED_IN']);
    expectContract('getDeviceRegistration', old);
    expect(outcomeOf(await devicePost(pairing.app, SIGN_IN, device.credential, { username: INVESTIGATOR.username, password: 'x' }))).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expect(await trailSince(before)).toHaveLength(1);
    // And the new one goes on working, also for a sign-in.
    expect((await deviceSignIn(pairing.app, next, INVESTIGATOR.username)).statusCode).toBe(200);
  });

  it('a second rotation before the first use replaces the pending credential; sessions of the device are not touched by a rotation', async () => {
    const device = await pairDevice(pairing, cookie);
    const token = await tokenOf(device, INVESTIGATOR.username);
    const first = ((await devicePost(pairing.app, ROTATE, device.credential)).json() as { deviceCredential: string }).deviceCredential;
    // By design (finding CPS1-3, decision D113): the operator's session of the device cannot
    // rotate. It is refused, and the pending credential is not replaced by it.
    expect(outcomeOf(await devicePost(pairing.app, ROTATE, token))).toEqual([403, 'DEVICE_NOT_PAIRED']);
    // The second rotation is the device's own, like the first.
    const second = ((await devicePost(pairing.app, ROTATE, device.credential)).json() as { deviceCredential: string }).deviceCredential;
    expect(new Set([device.credential, first, second]).size).toBe(3);

    expect(outcomeOf(await deviceGet(pairing.app, DEVICE, first))).toEqual([401, 'NOT_SIGNED_IN']);
    expect((await deviceGet(pairing.app, DEVICE, device.credential)).statusCode).toBe(200);
    expect((await deviceGet(pairing.app, DEVICE, second)).statusCode).toBe(200);
    expect(outcomeOf(await deviceGet(pairing.app, DEVICE, device.credential))).toEqual([401, 'NOT_SIGNED_IN']);
    expect((await deviceGet(pairing.app, SESSION, token)).statusCode).toBe(200);
    await expectChainVerifies();
  });

  it('two first uses of the new credential at once promote it once, and both are answered', async () => {
    const device = await pairDevice(pairing, cookie);
    const next = ((await devicePost(pairing.app, ROTATE, device.credential)).json() as { deviceCredential: string }).deviceCredential;
    const answers = await Promise.all([deviceGet(pairing.app, DEVICE, next), deviceGet(pairing.app, DEVICE, next), deviceGet(pairing.app, DEVICE, next)]);
    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200, 200]);
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ currentHashBytes: 32, hasNextHash: false });
    expect(outcomeOf(await deviceGet(pairing.app, DEVICE, device.credential))).toEqual([401, 'NOT_SIGNED_IN']);
  });
});

describe('the device resolver, per state (the seam app.deviceResolver)', () => {
  it('answers PAIRED, RETIRED or nothing; a value of another form costs no query', async () => {
    const device = await pairDevice(pairing, cookie);
    const revoked = await pairDevice(pairing, cookie, 'Revoked tablet');
    const unpaired = await pairDevice(pairing, cookie, 'Unpaired tablet');
    expect((await portalPost(pairing.app, revokeUrl(revoked.deviceId), cookie, { reason: REASON })).statusCode).toBe(200);
    expect((await devicePost(pairing.app, UNPAIR, unpaired.credential)).statusCode).toBe(204);
    const resolver = pairing.app.deviceResolver;

    expect(await resolver.resolveCredential(device.credential)).toEqual({ status: 'PAIRED', deviceId: device.deviceId });
    expect(await resolver.resolveCredential(revoked.credential)).toEqual({ status: 'RETIRED', deviceId: revoked.deviceId });
    expect(await resolver.resolveCredential(unpaired.credential)).toEqual({ status: 'RETIRED', deviceId: unpaired.deviceId });
    expect(await resolver.resolveCredential(`dvc_${randomBytes(32).toString('base64url')}`)).toBeNull();
    expect(await resolver.resolveDevice(device.deviceId)).toEqual({ status: 'PAIRED', deviceId: device.deviceId });
    expect(await resolver.resolveDevice(revoked.deviceId)).toEqual({ status: 'RETIRED', deviceId: revoked.deviceId });
    expect(await resolver.resolveDevice(unpaired.deviceId)).toEqual({ status: 'RETIRED', deviceId: unpaired.deviceId });
    expect(await resolver.resolveDevice('DEV-9999')).toBeNull();

    // Not of the form: answered without the database (the pool is closed for the moment).
    const { pool } = pairing.app.db;
    const query = pool.query.bind(pool);
    let asked = 0;
    Object.assign(pool, {
      query: (...args: unknown[]) => {
        asked += 1;
        return (query as (...inner: unknown[]) => unknown)(...args);
      },
    });
    try {
      for (const value of ['', 'dvc_short', `ses_${'A'.repeat(43)}`, `dvc_${'A'.repeat(44)}`, `DVC_${'A'.repeat(43)}`]) expect(await resolver.resolveCredential(value)).toBeNull();
      for (const value of ['', 'DEV-1', 'OPR-001', "DEV-0001' OR '1'='1"]) expect(await resolver.resolveDevice(value)).toBeNull();
      expect(asked).toBe(0);
    } finally {
      Object.assign(pool, { query });
    }
  });

  it('a credential hash that two rows hold names no device: it resolves to nothing (only one row is an answer)', async () => {
    const first = await pairDevice(pairing, cookie, 'First of two');
    const second = await pairDevice(pairing, cookie, 'Second of two');
    expect(await pairing.app.deviceResolver.resolveCredential(first.credential)).toEqual({ status: 'PAIRED', deviceId: first.deviceId });
    // A fixture no request can produce: the current hash of one device is also the next hash of another.
    await owner.query(
      'UPDATE public.device_credentials SET next_hash = (SELECT current_hash FROM public.device_credentials WHERE device_id = $1) WHERE device_id = $2',
      [first.deviceId, second.deviceId],
    );
    expect(await pairing.app.deviceResolver.resolveCredential(first.credential)).toBeNull();
    expect(outcomeOf(await deviceGet(pairing.app, DEVICE, first.credential))).toEqual([401, 'NOT_SIGNED_IN']);
    // The other device's own credential is not touched by it.
    expect(await pairing.app.deviceResolver.resolveCredential(second.credential)).toEqual({ status: 'PAIRED', deviceId: second.deviceId });
    await owner.query('UPDATE public.device_credentials SET next_hash = NULL WHERE device_id = $1', [second.deviceId]);
  });

  it('a device row without its credential row is no device of the registry: it resolves to nothing', async () => {
    await owner.query(
      "INSERT INTO public.pairing_codes (id, code_hash, state, issued_by_operator_id, issued_at, expires_at, failed_attempts, closed_at) VALUES ('PCD-900001', $1, 'REDEEMED', $2, $3, $4, 0, $3)",
      [Buffer.alloc(32, 9), SUPERVISOR.id, pairing.clock.now(), pairing.clock.now() + 300_000],
    );
    await owner.query(
      "INSERT INTO public.paired_devices (id, name, platform, app_version, state, paired_at, paired_with_code_id, last_seen_at, updated_at) VALUES ('DEV-900001', 'Fixture without a credential', 'android', '0.2.0', 'PAIRED', $1, 'PCD-900001', $1, $1)",
      [pairing.clock.now()],
    );
    expect(await pairing.app.deviceResolver.resolveDevice('DEV-900001')).toBeNull();
    // The registry still lists the row: the portal shows what the table holds.
    expect(await listed('DEV-900001')).toMatchObject({ state: 'PAIRED', credentialRotatedAt: null });
  });
});
