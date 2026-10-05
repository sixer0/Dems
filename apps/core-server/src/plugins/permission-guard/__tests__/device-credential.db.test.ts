// The condition DEVICE_CREDENTIAL through the real pipeline, against PostgreSQL (plan row W28,
// follow-up; finding CPS1-3 of the security checkpoint CP-S1; decisions D113 and D118; spec
// §4.2, §6.3 T7, §7.2, §7.7 operation 23).
//
// THE REAL APP, every module as it is in the tree, on a clone of the seed template, as
// `dems_app`: the device is paired through the pairing module, the operator signs in on it
// through the identity module, and stages 3 to 6 are the server's own. This file registers no
// route and replaces no stage (standing rule M10).
//
// What is proven, for an operation that needs the device's own credential:
//   - the device credential is let through, and the operation does what it does (200);
//   - the session token of an operator who is signed in on that device is refused by stage 6
//     with 403 `DEVICE_NOT_PAIRED` and `details.reason: DEVICE_CREDENTIAL_REQUIRED`, before the
//     body is read; it writes no row, takes no place in the denial budget and changes nothing;
//   - a web console session still gets the refusal of the marker `DEVICE`, without the reason;
//   - a retired device still gets `DEVICE_REVOKED` with its row: the order of stage 6 is as it was.
//
// What the rotation itself does (two phases, the promotion, a lost answer) is the pairing
// module's and is tested there; here it is only shown to be reached.
//
// No code, credential, token or hash is printed: a failure names a status, a code, a count, an
// identifier or a yes/no.
import { CoreApiAccessCondition, CoreApiAccessKind, DEVICE_CREDENTIAL_REQUIRED_REASON } from '@dems/shared/api';
import { ROLE_PERMISSIONS, type AuditRow, type Permission } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { credentialLeaks } from '../../../../test/support/config';
import { readTrail } from '../../../../test/support/core';
import { MALFORMED_JSON } from '../../../../test/support/guard';
import { MINUTE, SESSION, bearer, deviceSignIn, errorOf, type Headers } from '../../../../test/support/identity';
import {
  DEVICE,
  INVESTIGATOR,
  ROTATE,
  SUPERVISOR,
  TECHNICIAN,
  deviceGet,
  devicePost,
  expectContract,
  forgetLimits,
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
import { throttleControl } from '../../throttle';
import { permissionGuard, type AccessRule } from '../index';

const db = useTestDatabase({ template: 'seed' });
let pairing: PairingApp;
let owner: Pool;
let cookie: Headers;

const ROTATE_OPERATION = 'rotateDeviceCredential';
const OWN_CREDENTIAL_TEXT = "This operation needs the device's own credential.";
const REFUSED_LINE = 'request refused by the access rule';

beforeAll(async () => {
  owner = db.ownerPool();
  pairing = await pairingApp(db);
});

beforeEach(async () => {
  forgetLimits(pairing);
  pairing.clock.advance(10 * MINUTE);
  cookie = await supervisorCookie(pairing);
});

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const trailSince = async (from: number): Promise<AuditRow[]> => (await readTrail(owner)).slice(from);

/** The session token of an operator who signs in on the device. Held by the test only. */
async function tokenOf(device: PairedTestDevice, username: string): Promise<string> {
  const response = await deviceSignIn(pairing.app, device.credential, username);
  if (response.statusCode !== 200) throw new Error(`the device sign-in answered ${response.statusCode}`);
  return (response.json() as { sessionToken: string }).sessionToken;
}

/** What is stored for the credential of a device: bytes that are compared and never printed. */
interface CredentialRow {
  readonly current: Buffer;
  readonly next: Buffer | null;
  readonly rotatedAt: string | null;
}

async function credentialRow(deviceId: string): Promise<CredentialRow> {
  const { rows } = await owner.query<{ current_hash: Buffer; next_hash: Buffer | null; rotated_at: string | null }>(
    'SELECT current_hash, next_hash, rotated_at FROM public.device_credentials WHERE device_id = $1',
    [deviceId],
  );
  const row = rows[0];
  if (row === undefined) throw new Error(`no stored credential for ${deviceId}`);
  return { current: row.current_hash, next: row.next_hash, rotatedAt: row.rotated_at };
}

/** True when two stored credential rows are the same, byte for byte. */
function sameCredential(one: CredentialRow, other: CredentialRow): boolean {
  const sameNext = one.next === null ? other.next === null : other.next !== null && one.next.equals(other.next);
  return one.current.equals(other.current) && sameNext && one.rotatedAt === other.rotatedAt;
}

/** The rules the server registered with the condition. No test below names an operation to find them. */
const ownCredentialRules = (): AccessRule[] =>
  permissionGuard(pairing.app)
    .registeredRules()
    .filter((rule) => rule.conditions.includes(CoreApiAccessCondition.DEVICE_CREDENTIAL));

/** The stage's own lines for refused calls of one operation, written since `from`. */
const refusedLines = (from: number, operationId: string): Array<Record<string, unknown>> =>
  pairing.log
    .lines()
    .slice(from)
    .filter((line) => line['msg'] === REFUSED_LINE && line['operationId'] === operationId);

describe("finding CPS1-3: operation 23 needs the device's own credential (the real app, stages 3 to 6 as the server has them)", () => {
  it('the rule the server registered for operation 23 is the marker DEVICE with the condition, and no permission', () => {
    const rule = permissionGuard(pairing.app)
      .registeredRules()
      .find((candidate) => candidate.operationId === ROTATE_OPERATION);
    expect(rule).toMatchObject({ kind: CoreApiAccessKind.DEVICE, method: 'POST', url: ROTATE, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL], permissions: [], denial: null });
    expect(ownCredentialRules().map((candidate) => candidate.operationId)).toContain(ROTATE_OPERATION);
    for (const candidate of ownCredentialRules()) expect(candidate.kind, candidate.operationId).toBe(CoreApiAccessKind.DEVICE);
  });

  it('the session token of an operator who is signed in on the device is refused: 403 DEVICE_NOT_PAIRED with the reason; no row, no place in the denial budget, nothing changed', async () => {
    const device = await pairDevice(pairing, cookie);
    const token = await tokenOf(device, INVESTIGATOR.username);
    const key = `operator:${INVESTIGATOR.id}` as const;
    const before = await trailLength();
    const stored = await credentialRow(device.deviceId);
    const linesBefore = pairing.log.lines().length;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const refused = await devicePost(pairing.app, ROTATE, token);
      expect(outcomeOf(refused)).toEqual([403, 'DEVICE_NOT_PAIRED']);
      expect(errorOf(refused)).toMatchObject({ message: OWN_CREDENTIAL_TEXT, details: { reason: DEVICE_CREDENTIAL_REQUIRED_REASON } });
      expectContract(ROTATE_OPERATION, refused);
      // The answer is the error envelope and nothing else: no credential comes back.
      expect(Object.keys(refused.json() as Record<string, unknown>)).toEqual(['error']);
    }

    // No row, and no place in the denial budget.
    expect(await trailSince(before)).toEqual([]);
    expect(await throttleControl(pairing.app).inspect(key)).toMatchObject({ used: 0 });
    // Nothing changed: the stored credential and its "next" are the same bytes, and no rotation is recorded.
    expect(sameCredential(stored, await credentialRow(device.deviceId))).toBe(true);
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ state: 'PAIRED', hasNextHash: false, rotatedAt: null });
    // The session is as it was: it answers elsewhere, also on a DEVICE operation without the
    // condition; and the device credential is as valid as before.
    expect((await deviceGet(pairing.app, SESSION, token)).json()).toMatchObject({ deviceId: device.deviceId, operator: { id: INVESTIGATOR.id } });
    expect((await deviceGet(pairing.app, DEVICE, token)).statusCode).toBe(200);
    expect((await deviceGet(pairing.app, DEVICE, device.credential)).statusCode).toBe(200);

    // What the stage logged: one warn line per refusal, naming the condition under a key of its
    // own (standing rule M14: no log member `reason` or `cause`), and nothing of a credential.
    const lines = refusedLines(linesBefore, ROTATE_OPERATION);
    expect(lines.map((line) => [line['level'], line['code'], line['access'], line['refusedBy'], line['audited']])).toEqual(
      [0, 1, 2].map(() => [40, 'DEVICE_NOT_PAIRED', 'DEVICE', CoreApiAccessCondition.DEVICE_CREDENTIAL, false]),
    );
    for (const line of lines) expect(Object.keys(line).filter((name) => ['reason', 'cause', 'error', 'e'].includes(name))).toEqual([]);
    expect(credentialLeaks(pairing.log.text())).toEqual([]);

    // Positive control of "no place": the budget of this very session counts. A refusal that IS
    // audited (an operation whose permission the role lacks, whichever the server registered)
    // takes one place and writes one row; a further rotation attempt adds neither.
    const held: readonly Permission[] = ROLE_PERMISSIONS[INVESTIGATOR.role];
    const lacking = permissionGuard(pairing.app)
      .registeredRules()
      .find((rule) => rule.method === 'GET' && !rule.url.includes(':') && rule.denial !== null && rule.denial.export === null && !rule.permissions.some((permission) => held.includes(permission)));
    if (lacking === undefined) throw new Error('the server registered no read that the role lacks the permission for');
    const audited = await deviceGet(pairing.app, lacking.url, token);
    expect([lacking.operationId, ...outcomeOf(audited)]).toEqual([lacking.operationId, 403, 'NOT_PERMITTED']);
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.deviceId, row.details['operationId']])).toEqual([
      ['ACCESS_DENIED', INVESTIGATOR.id, device.deviceId, lacking.operationId],
    ]);
    expect(await throttleControl(pairing.app).inspect(key)).toMatchObject({ used: 1 });
    expect(outcomeOf(await devicePost(pairing.app, ROTATE, token))).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expect(await trailSince(before)).toHaveLength(1);
    expect(await throttleControl(pairing.app).inspect(key)).toMatchObject({ used: 1 });
  });

  it('the refusal is decided before the body is read, on every route the server registered with the condition: the session gets 403, the device passes stage 6 (400 for a body that is no JSON)', async () => {
    const device = await pairDevice(pairing, cookie);
    const token = await tokenOf(device, SUPERVISOR.username);
    const before = await trailLength();
    const stored = await credentialRow(device.deviceId);
    const send = (rule: AccessRule, credential: string): Promise<LightMyRequestResponse> =>
      pairing.app.inject({ method: rule.method, url: rule.url, headers: { ...bearer(credential), ...MALFORMED_JSON.headers }, payload: MALFORMED_JSON.payload });

    let asked = 0;
    for (const rule of ownCredentialRules()) {
      if (rule.method !== 'POST') continue;
      asked += 1;
      const bySession = await send(rule, token);
      expect([rule.operationId, ...outcomeOf(bySession), errorOf(bySession).details]).toEqual([rule.operationId, 403, 'DEVICE_NOT_PAIRED', { reason: DEVICE_CREDENTIAL_REQUIRED_REASON }]);
      // The device itself is past stage 6: stage 7 answers for the body, and no handler runs.
      const byDevice = await send(rule, device.credential);
      expect([rule.operationId, ...outcomeOf(byDevice)]).toEqual([rule.operationId, 400, 'INVALID_JSON']);
    }
    expect(asked).toBeGreaterThan(0);
    // The role does not matter (this session is the supervisor's), and nothing was written or changed.
    expect(await trailSince(before)).toEqual([]);
    expect(sameCredential(stored, await credentialRow(device.deviceId))).toBe(true);
  });

  it('the device credential rotates: 200 and the one row of the rotation, with an operator signed in on the device or not; the open session is not touched and still cannot rotate', async () => {
    const device = await pairDevice(pairing, cookie);
    const token = await tokenOf(device, TECHNICIAN.username);
    const before = await trailLength();
    const stored = await credentialRow(device.deviceId);

    const rotated = await devicePost(pairing.app, ROTATE, device.credential);
    expect(rotated.statusCode).toBe(200);
    expectContract(ROTATE_OPERATION, rotated);
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.deviceId])).toEqual([['DEVICE_CREDENTIAL_ROTATED', null, device.deviceId]]);
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ state: 'PAIRED', hasNextHash: true });
    expect(sameCredential(stored, await credentialRow(device.deviceId))).toBe(false);

    // The operator's session of the device is open as before, and is still refused.
    expect((await deviceGet(pairing.app, SESSION, token)).statusCode).toBe(200);
    const pending = await credentialRow(device.deviceId);
    expect(outcomeOf(await devicePost(pairing.app, ROTATE, token))).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expect(sameCredential(pending, await credentialRow(device.deviceId))).toBe(true);
    expect(await trailSince(before)).toHaveLength(1);

    // A device nobody is signed in on rotates the same way.
    const idle = await pairDevice(pairing, cookie, 'Tablet without a session');
    expect((await devicePost(pairing.app, ROTATE, idle.credential)).statusCode).toBe(200);
    expect((await storedDevice(owner, idle.deviceId)).hasNextHash).toBe(true);
  });

  it('a web console session still gets the refusal of the marker DEVICE: the same code, the old text, no reason, no row, no place', async () => {
    const before = await trailLength();
    const linesBefore = pairing.log.lines().length;
    const refused = await portalPost(pairing.app, ROTATE, cookie);
    expect(outcomeOf(refused)).toEqual([403, 'DEVICE_NOT_PAIRED']);
    expect(errorOf(refused).message).toBe('This operation is available on a paired device only.');
    expect(errorOf(refused).details).toBeUndefined();
    expectContract(ROTATE_OPERATION, refused);
    expect(await trailSince(before)).toEqual([]);
    expect(await throttleControl(pairing.app).inspect(`operator:${SUPERVISOR.id}`)).toMatchObject({ used: 0 });
    // It never reached the condition: the marker refused.
    expect(refusedLines(linesBefore, ROTATE_OPERATION).map((line) => [line['code'], line['refusedBy'], line['audited']])).toEqual([['DEVICE_NOT_PAIRED', 'DEVICE_OPERATION', false]]);
  });

  it('a retired device still gets 403 DEVICE_REVOKED with its one row: it is refused before the condition is looked at, and its former session never gets the condition\'s answer', async () => {
    const device = await pairDevice(pairing, cookie);
    const token = await tokenOf(device, INVESTIGATOR.username);
    expect((await portalPost(pairing.app, revokeUrl(device.deviceId), cookie, { reason: 'Tablet reported lost by the investigator' })).statusCode).toBe(200);
    const before = await trailLength();

    const byDevice = await devicePost(pairing.app, ROTATE, device.credential);
    expect(outcomeOf(byDevice)).toEqual([403, 'DEVICE_REVOKED']);
    expect(errorOf(byDevice).details).toEqual({ reason: 'DEVICE_REVOKED' });
    expectContract(ROTATE_OPERATION, byDevice);
    expect((await trailSince(before)).map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['ACCESS_DENIED', null, device.deviceId, { operationId: ROTATE_OPERATION, reason: 'DEVICE_REVOKED' }],
    ]);

    // The session that was open on the device ended with it. Whatever its token is answered now
    // (that is the identity module's), it is not the refusal of the condition, and nothing rotates.
    const bySession = await devicePost(pairing.app, ROTATE, token);
    expect([401, 403]).toContain(bySession.statusCode);
    if (bySession.statusCode === 403) expect(errorOf(bySession).code).toBe('DEVICE_REVOKED');
    expect(errorOf(bySession).details?.['reason'] === DEVICE_CREDENTIAL_REQUIRED_REASON).toBe(false);
    expect(await storedDevice(owner, device.deviceId)).toMatchObject({ state: 'REVOKED', hasNextHash: false });
  });
});
