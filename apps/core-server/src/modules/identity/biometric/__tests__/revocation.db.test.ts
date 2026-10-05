// `revokeBiometricTokens`, the one function that revokes a biometric token, against PostgreSQL
// (plan row W41; spec §5.6 steps 6 and 8, SR-34; database contract §5.3, §5.6 AT-C4 and AT-C5;
// decision D91 "until the biometric row takes it over"). Its four scopes on fixture rows of every
// state, inside a caller's unit of work; and, for the two scopes that other modules are offered,
// the SAME outcome as those modules' own statements give today on equal rows.
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { disableUrl, enableUrl } from '../../../../../test/support/admin';
import { MINUTE, closeOpenSessions } from '../../../../../test/support/identity';
import { revokeBiometricTokens, type BiometricRevocation } from '../index';
import {
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  THIRTY_DAYS,
  biometricApp,
  clearTokens,
  forgetLimits,
  pairDevice,
  portalPost,
  revokeUrl,
  stateOf,
  storedTokens,
  supervisorCookie,
  trailLength,
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
type Kind = 'live' | 'used' | 'expired' | 'revoked';

/** A fixture row as `dems_owner`, with a label in place of a token: its hash is of no token. Returns the row's ID. */
async function fixture(deviceId: string, operatorId: string, kind: Kind, familyId: string = randomUUID()): Promise<string> {
  const issuedAt = now() - 10 * MINUTE;
  const { rows } = await owner.query<{ id: string }>(
    'INSERT INTO public.biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at, used_at, revoked_at, revoke_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
    [
      randomBytes(32),
      familyId,
      deviceId,
      operatorId,
      issuedAt,
      kind === 'expired' ? issuedAt + 1 : issuedAt + THIRTY_DAYS,
      kind === 'used' ? issuedAt + MINUTE : null,
      kind === 'revoked' ? issuedAt + MINUTE : null,
      kind === 'revoked' ? 'REENROLLED' : null,
    ],
  );
  return rows[0]!.id;
}

/** The state of each named row, in one word. */
async function states(ids: Record<string, string>): Promise<Record<string, string>> {
  const rows = await storedTokens(owner);
  return Object.fromEntries(Object.entries(ids).map(([name, id]) => [name, stateOf(rows.find((row) => row.id === id) ?? null, now())]));
}

const revoke = (revocation: BiometricRevocation): Promise<number> => bio.app.pipeline.run('test.revokeBiometricTokens', (unit) => revokeBiometricTokens(unit, revocation, now()));

/** The rows of every state for a device, three operators: what a device's or an operator's end of life meets. */
async function everyState(device: PairedTestDevice): Promise<Record<string, string>> {
  const family = randomUUID();
  return {
    used: await fixture(device.deviceId, INVESTIGATOR.id, 'used', family),
    live: await fixture(device.deviceId, INVESTIGATOR.id, 'live', family),
    revoked: await fixture(device.deviceId, TECHNICIAN.id, 'revoked'),
    expired: await fixture(device.deviceId, TECHNICIAN.id, 'expired'),
    usedOnly: await fixture(device.deviceId, SUPERVISOR.id, 'used'),
  };
}

describe('the four scopes', () => {
  it('FAMILY: every row of the family that was not revoked, used rows included, and no row of another family', async () => {
    const family = randomUUID();
    const ids = {
      used: await fixture(tablet.deviceId, INVESTIGATOR.id, 'used', family),
      live: await fixture(tablet.deviceId, INVESTIGATOR.id, 'live', family),
      otherFamily: await fixture(tablet.deviceId, TECHNICIAN.id, 'live'),
      otherDevice: await fixture(phone.deviceId, INVESTIGATOR.id, 'live'),
    };
    expect(await revoke({ scope: 'FAMILY', familyId: family, reason: 'TOKEN_REUSE' })).toBe(2);
    expect(await states(ids)).toEqual({ used: 'USED+REVOKED(TOKEN_REUSE)', live: 'REVOKED(TOKEN_REUSE)', otherFamily: 'LIVE', otherDevice: 'LIVE' });
    // A second time changes nothing: a revoked row keeps its time and its reason.
    const before = await storedTokens(owner);
    bio.clock.advance(MINUTE);
    expect(await revoke({ scope: 'FAMILY', familyId: family, reason: 'USER_DISABLED' })).toBe(0);
    expect(await storedTokens(owner)).toEqual(before);
  });

  it('ENROLMENT: every row of the operator on the device that was not revoked, of every family, and no row of another operator or device', async () => {
    const ids = {
      oldFamilyUsed: await fixture(tablet.deviceId, INVESTIGATOR.id, 'used'),
      oldFamilyRevoked: await fixture(tablet.deviceId, INVESTIGATOR.id, 'revoked'),
      live: await fixture(tablet.deviceId, INVESTIGATOR.id, 'live'),
      otherOperator: await fixture(tablet.deviceId, TECHNICIAN.id, 'live'),
      otherDevice: await fixture(phone.deviceId, INVESTIGATOR.id, 'live'),
    };
    expect(await revoke({ scope: 'ENROLMENT', deviceId: tablet.deviceId, operatorId: INVESTIGATOR.id, reason: 'DISABLED' })).toBe(2);
    expect(await states(ids)).toEqual({
      oldFamilyUsed: 'USED+REVOKED(DISABLED)',
      oldFamilyRevoked: 'REVOKED(REENROLLED)',
      live: 'REVOKED(DISABLED)',
      otherOperator: 'LIVE',
      otherDevice: 'LIVE',
    });
  });

  it('DEVICE: the tokens of the device that could still be used; a used and a revoked one stay as they are; another device is not touched', async () => {
    const ids = await everyState(tablet);
    const elsewhere = { live: await fixture(phone.deviceId, INVESTIGATOR.id, 'live') };
    expect(await revoke({ scope: 'DEVICE', deviceId: tablet.deviceId, reason: 'DEVICE_UNPAIRED' })).toBe(2);
    expect(await states(ids)).toEqual({ used: 'USED', live: 'REVOKED(DEVICE_UNPAIRED)', revoked: 'REVOKED(REENROLLED)', expired: 'REVOKED(DEVICE_UNPAIRED)', usedOnly: 'USED' });
    expect(await states(elsewhere)).toEqual({ live: 'LIVE' });
  });

  it('OPERATOR: the tokens of the operator that could still be used, on every device; another operator is not touched', async () => {
    const ids = {
      tabletUsed: await fixture(tablet.deviceId, INVESTIGATOR.id, 'used'),
      tabletLive: await fixture(tablet.deviceId, INVESTIGATOR.id, 'live'),
      phoneLive: await fixture(phone.deviceId, INVESTIGATOR.id, 'live'),
      otherOperator: await fixture(tablet.deviceId, TECHNICIAN.id, 'live'),
    };
    expect(await revoke({ scope: 'OPERATOR', operatorId: INVESTIGATOR.id, reason: 'USER_DISABLED' })).toBe(2);
    expect(await states(ids)).toEqual({ tabletUsed: 'USED', tabletLive: 'REVOKED(USER_DISABLED)', phoneLive: 'REVOKED(USER_DISABLED)', otherOperator: 'LIVE' });
  });

  it('writes the time it is handed and the reason, on the rows it changed, and returns their number', async () => {
    const id = await fixture(tablet.deviceId, INVESTIGATOR.id, 'live');
    const at = now() + 1_234;
    const changed = await bio.app.pipeline.run('test.revokeBiometricTokens', (unit) => revokeBiometricTokens(unit, { scope: 'DEVICE', deviceId: tablet.deviceId, reason: 'DEVICE_REVOKED' }, at));
    expect(changed).toBe(1);
    expect((await storedTokens(owner)).find((row) => row.id === id)).toMatchObject({ revokedAt: at, revokeReason: 'DEVICE_REVOKED', usedAt: null });
  });

  it('runs in the CALLER\'s unit: it writes no row of its own, publishes nothing, and is undone when the unit rolls back; outside a unit it is refused', async () => {
    const ids = { live: await fixture(tablet.deviceId, INVESTIGATOR.id, 'live') };
    const before = await trailLength(owner);
    await expect(
      bio.app.pipeline.run('test.revokeBiometricTokens', async (unit) => {
        expect(await revokeBiometricTokens(unit, { scope: 'DEVICE', deviceId: tablet.deviceId, reason: 'DEVICE_REVOKED' }, now())).toBe(1);
        throw new Error('the caller\'s unit fails after the revocation');
      }),
    ).rejects.toThrow();
    expect(await states(ids)).toEqual({ live: 'LIVE' });

    expect(await revoke({ scope: 'DEVICE', deviceId: tablet.deviceId, reason: 'DEVICE_REVOKED' })).toBe(1);
    expect(await trailLength(owner)).toBe(before);
    expect(bio.published).toEqual([]);
    // An object that is no unit of the pipeline: refused before any statement.
    await expect(revokeBiometricTokens({ label: 'not.a.unit' }, { scope: 'DEVICE', deviceId: tablet.deviceId, reason: 'DEVICE_REVOKED' }, now())).rejects.toMatchObject({ code: 'UNIT_NOT_ACTIVE' });
  });
});

describe('the two scopes for other modules give what those modules\' own statements give today, on equal rows', () => {
  it('a device that is revoked through the pairing module, and the scope DEVICE on a second device with the same rows: the same states', async () => {
    const cookie = await supervisorCookie(bio);
    const [first, second] = [await pairDevice(bio, cookie, 'Tablet A'), await pairDevice(bio, cookie, 'Tablet B')];
    const [byPairing, byScope] = [await everyState(first), await everyState(second)];

    expect((await portalPost(bio.app, revokeUrl(first.deviceId), cookie, { reason: 'Revoked to compare the two statements' })).statusCode).toBe(200);
    expect(await revoke({ scope: 'DEVICE', deviceId: second.deviceId, reason: 'DEVICE_REVOKED' })).toBe(2);

    const expected = { used: 'USED', live: 'REVOKED(DEVICE_REVOKED)', revoked: 'REVOKED(REENROLLED)', expired: 'REVOKED(DEVICE_REVOKED)', usedOnly: 'USED' };
    expect(await states(byPairing)).toEqual(expected);
    expect(await states(byScope)).toEqual(expected);
  });

  it('an operator who is disabled through the administration module, and the scope OPERATOR for a second operator with the same rows: the same states', async () => {
    const cookie = await supervisorCookie(bio);
    const rowsOf = async (operatorId: string): Promise<Record<string, string>> => ({
      tabletUsed: await fixture(tablet.deviceId, operatorId, 'used'),
      tabletLive: await fixture(tablet.deviceId, operatorId, 'live'),
      phoneRevoked: await fixture(phone.deviceId, operatorId, 'revoked'),
      phoneExpired: await fixture(phone.deviceId, operatorId, 'expired'),
    });
    const [byAdministration, byScope] = [await rowsOf(TECHNICIAN.id), await rowsOf(INVESTIGATOR.id)];

    expect((await portalPost(bio.app, disableUrl(TECHNICIAN.id), cookie)).statusCode).toBe(200);
    try {
      expect(await revoke({ scope: 'OPERATOR', operatorId: INVESTIGATOR.id, reason: 'USER_DISABLED' })).toBe(2);
      const expected = { tabletUsed: 'USED', tabletLive: 'REVOKED(USER_DISABLED)', phoneRevoked: 'REVOKED(REENROLLED)', phoneExpired: 'REVOKED(USER_DISABLED)' };
      expect(await states(byAdministration)).toEqual(expected);
      expect(await states(byScope)).toEqual(expected);
    } finally {
      expect((await portalPost(bio.app, enableUrl(TECHNICIAN.id), cookie)).statusCode).toBe(200);
    }
  });
});
