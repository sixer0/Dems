// The device registry at volume, on the bulk template (plan row W32; spec §6.5, §7.7 operations
// 16, 19, 20; database contract §11: 40 devices in every state, 60 codes in every state, 8
// rotations pending). A clone of `tpl_bulk`, the code under test as `dems_app`, the server clock
// at the template's instant, a SEEDED operator signed in.
//
// The fixture's hash columns hold hashes of fake texts: no fixture device, code or session can
// authenticate. What is tested here is what the portal READS of them, and that the module's
// state changes work on rows it did not write itself.
import { randomBytes } from 'node:crypto';
import { createManualClock } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readTrail } from '../../../../test/support/core';
import { BULK_TEMPLATE_NOW } from '../../../db/fixtures/__tests__/template-hook.bulk';
import { get, type Headers } from '../../../../test/support/identity';
import { CODE, DEVICE, DEVICES, SUPERVISOR, deviceGet, expectContract, issueCode, outcomeOf, pairingApp, portalPost, redeem, revokeUrl, storedCodes, storedDevices, supervisorCookie, type PairingApp } from '../../../../test/support/pairing';

const db = useTestDatabase({ template: 'bulk' });
let pairing: PairingApp;
let owner: Pool;
let cookie: Headers;
const clock = createManualClock(BULK_TEMPLATE_NOW);

interface Listed {
  id: string;
  state: string;
  pairedAt: number;
  lastSeenAt: number;
  online: boolean;
  signedInOperatorId: string | null;
  credentialRotatedAt: number | null;
  revokedAt: number | null;
  revokedBy: string | null;
  revokeReason: string | null;
  unpairedAt: number | null;
  pairedWithCodeId: string;
  codeIssuedBy: string;
  name: string;
}

beforeAll(async () => {
  owner = db.ownerPool();
  pairing = await pairingApp(db);
  // The template's instant: nothing of the fixture lies in the future, and its one ACTIVE code has four minutes left.
  pairing.app.seams.replace('clock', clock);
  cookie = await supervisorCookie(pairing);
});

const list = async (): Promise<Listed[]> => {
  const response = await get(pairing.app, DEVICES, cookie);
  expect(response.statusCode).toBe(200);
  expectContract('listPairedDevices', response);
  return (response.json() as { devices: Listed[] }).devices;
};

describe('operation 19 on 40 fixture devices', () => {
  it('lists every device ever paired, newest first, in every state, each valid against the contract and with no hash', async () => {
    const started = performance.now();
    const response = await get(pairing.app, DEVICES, cookie);
    const elapsed = performance.now() - started;
    expectContract('listPairedDevices', response);
    const devices = (response.json() as { devices: Listed[] }).devices;

    expect(devices).toHaveLength(40);
    const states = devices.reduce<Record<string, number>>((count, device) => ({ ...count, [device.state]: (count[device.state] ?? 0) + 1 }), {});
    expect(states).toEqual({ PAIRED: 20, REVOKED: 10, UNPAIRED: 10 });
    // Newest first, by the pairing time; equal times by the higher ID.
    for (let index = 1; index < devices.length; index += 1) {
      const [previous, current] = [devices[index - 1], devices[index]];
      if (previous === undefined || current === undefined) throw new Error('a device is missing from the list');
      expect(previous.pairedAt >= current.pairedAt, `${previous.id} before ${current.id}`).toBe(true);
    }
    expect(new Set(devices.map((device) => device.id)).size).toBe(40);
    // No member of an entry is a hash or a credential: the bytes of the fixture's hash columns are nowhere in the answer.
    const { rows: hashes } = await owner.query<{ hex: string }>("SELECT encode(current_hash, 'hex') AS hex FROM public.device_credentials UNION ALL SELECT encode(next_hash, 'hex') FROM public.device_credentials WHERE next_hash IS NOT NULL");
    expect(hashes.length).toBe(48);
    for (const { hex } of hashes) expect(response.body.includes(hex)).toBe(false);
    expect(response.body).not.toMatch(/hash|credential"|dvc_/i);
    console.info(`[w32] listPairedDevices on tpl_bulk: 40 devices ${JSON.stringify(states)}, ${response.body.length} bytes, ${elapsed.toFixed(1)} ms in process`);
  });

  it('every entry equals what the tables hold: the code\'s issuer, the rotation time, the end of life, and nobody online', async () => {
    const devices = await list();
    const { rows } = await owner.query<{
      id: string;
      state: string;
      paired_at: string;
      last_seen_at: string;
      paired_with_code_id: string;
      issuer: string;
      rotated_at: string | null;
      revoked_at: string | null;
      revoked_by_operator_id: string | null;
      revoke_reason: string | null;
      unpaired_at: string | null;
      name: string;
    }>(
      'SELECT d.id, d.state, d.paired_at, d.last_seen_at, d.paired_with_code_id, p.issued_by_operator_id AS issuer, c.rotated_at, d.revoked_at, d.revoked_by_operator_id, d.revoke_reason, d.unpaired_at, d.name ' +
        'FROM public.paired_devices d JOIN public.pairing_codes p ON p.id = d.paired_with_code_id JOIN public.device_credentials c ON c.device_id = d.id',
    );
    const stored = new Map(rows.map((row) => [row.id, row]));
    const number = (value: string | null): number | null => (value === null ? null : Number(value));
    for (const device of devices) {
      const row = stored.get(device.id);
      expect(row, device.id).toBeDefined();
      expect(
        [device.state, device.pairedAt, device.lastSeenAt, device.pairedWithCodeId, device.codeIssuedBy, device.credentialRotatedAt, device.revokedAt, device.revokedBy, device.revokeReason, device.unpairedAt, device.name],
        device.id,
      ).toEqual([
        row?.state,
        Number(row?.paired_at),
        Number(row?.last_seen_at),
        row?.paired_with_code_id,
        row?.issuer,
        number(row?.rotated_at ?? null),
        number(row?.revoked_at ?? null),
        row?.revoked_by_operator_id ?? null,
        row?.revoke_reason ?? null,
        number(row?.unpaired_at ?? null),
        row?.name,
      ]);
      expect(device.online, device.id).toBe(false);
    }
    // Text outside ASCII comes back as it is stored.
    expect(devices.some((device) => /[^\x20-\x7e]/.test(device.name))).toBe(true);
    expect(devices.filter((device) => device.credentialRotatedAt !== null)).toHaveLength(14);
    expect(devices.filter((device) => device.state === 'REVOKED').every((device) => device.revokedAt !== null && device.revokedBy !== null && (device.revokeReason ?? '').length >= 5)).toBe(true);
  });

  it('signedInOperatorId is the operator of the newest open session inside its limits, for a PAIRED device only', async () => {
    const devices = await list();
    const now = clock.now();
    const { rows } = await owner.query<{ device_id: string; operator_id: string }>(
      'SELECT DISTINCT ON (s.device_id) s.device_id, s.operator_id FROM public.auth_sessions s JOIN public.paired_devices d ON d.id = s.device_id ' +
        "WHERE d.state = 'PAIRED' AND s.ended_at IS NULL AND s.absolute_expires_at > $1 AND s.last_seen_at > $2 ORDER BY s.device_id, s.issued_at DESC, s.id DESC",
      [now, now - 15 * 60_000],
    );
    const expected = new Map(rows.map((row) => [row.device_id, row.operator_id]));
    expect(expected.size).toBeGreaterThanOrEqual(1);
    for (const device of devices) expect(device.signedInOperatorId, device.id).toBe(expected.get(device.id) ?? null);
    expect(devices.filter((device) => device.state !== 'PAIRED' && device.signedInOperatorId !== null)).toEqual([]);

    // An hour later every fixture session is past its idle limit, swept or not: nobody is shown as signed in.
    clock.advance(60 * 60_000);
    cookie = await supervisorCookie(pairing);
    expect((await list()).filter((device) => device.signedInOperatorId !== null)).toEqual([]);
  });
});

describe('the resolver on fixture rows', () => {
  it('answers by the stored state for a device ID; no value can be presented that resolves to a fixture credential', async () => {
    const resolver = pairing.app.deviceResolver;
    const stored = await storedDevices(owner);
    const pick = (state: string): string => stored.find((device) => device.state === state)?.id ?? '';
    expect(await resolver.resolveDevice(pick('PAIRED'))).toEqual({ status: 'PAIRED', deviceId: pick('PAIRED') });
    expect(await resolver.resolveDevice(pick('REVOKED'))).toEqual({ status: 'RETIRED', deviceId: pick('REVOKED') });
    expect(await resolver.resolveDevice(pick('UNPAIRED'))).toEqual({ status: 'RETIRED', deviceId: pick('UNPAIRED') });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const credential = `dvc_${randomBytes(32).toString('base64url')}`;
      expect(await resolver.resolveCredential(credential)).toBeNull();
      expect(outcomeOf(await deviceGet(pairing.app, DEVICE, credential))).toEqual([401, 'NOT_SIGNED_IN']);
    }
  });
});

describe('the module\'s state changes on rows it did not write', () => {
  it('16 and 15: the fixture\'s ACTIVE code is read by the status operation (no code in it), and a new issue closes it; the counters continue above the fixture', async () => {
    const before = (await storedCodes(owner)).filter((code) => code.state === 'ACTIVE');
    // The fixture's one ACTIVE code expired during the hour of the test above: a fresh clone
    // would show it; here the status is null and the row is still ACTIVE until something closes it.
    expect(before).toHaveLength(1);
    expect((await get(pairing.app, CODE, cookie)).json()).toEqual({ active: null });

    const trail = (await readTrail(owner)).length;
    const issued = await issueCode(pairing, cookie);
    expect(issued.codeId).toBe('PCD-000061');
    expect((await storedCodes(owner)).find((code) => code.id === before[0]?.id)).toMatchObject({ state: 'EXPIRED', closedBy: null });
    expect((await readTrail(owner)).slice(trail).map((row) => [row.type, row.details['codeId'], row.details['reason'] ?? null])).toEqual([
      ['PAIRING_CODE_CLOSED', before[0]?.id, 'EXPIRED'],
      ['PAIRING_CODE_ISSUED', 'PCD-000061', null],
    ]);
    const status = await get(pairing.app, CODE, cookie);
    expectContract('getPairingCodeStatus', status);
    expect(status.json()).toMatchObject({ active: { codeId: 'PCD-000061', issuedBy: SUPERVISOR.id, attemptsRemaining: 5 } });

    const paired = await redeem(pairing.app, issued.code);
    expect(paired.statusCode).toBe(201);
    expect((paired.json() as { deviceId: string }).deviceId).toBe('DEV-0041');
    const devices = await list();
    expect(devices).toHaveLength(41);
    expect(devices[0]).toMatchObject({ id: 'DEV-0041', state: 'PAIRED', pairedWithCodeId: 'PCD-000061', codeIssuedBy: SUPERVISOR.id });
  });

  it('20: a fixture device with open sessions and a pending rotation is revoked with all of them; a retired one answers 409; an unknown one 404', async () => {
    const { rows: candidates } = await owner.query<{ id: string; open: string; pending: boolean }>(
      "SELECT d.id, count(s.id) FILTER (WHERE s.ended_at IS NULL) AS open, c.next_hash IS NOT NULL AS pending FROM public.paired_devices d JOIN public.device_credentials c ON c.device_id = d.id " +
        "LEFT JOIN public.auth_sessions s ON s.device_id = d.id WHERE d.state = 'PAIRED' AND d.id <> 'DEV-0041' GROUP BY d.id, c.next_hash ORDER BY count(s.id) FILTER (WHERE s.ended_at IS NULL) DESC, d.id LIMIT 1",
    );
    const target = candidates[0];
    if (target === undefined) throw new Error('the fixture holds no PAIRED device');
    const open = Number(target.open);
    expect(open).toBeGreaterThanOrEqual(1);
    const trail = (await readTrail(owner)).length;

    const revoked = await portalPost(pairing.app, revokeUrl(target.id), cookie, { reason: 'Fixture device revoked by the registry test' });
    expect(revoked.statusCode).toBe(200);
    expectContract('revokeDevice', revoked);
    expect(revoked.json()).toMatchObject({ id: target.id, state: 'REVOKED', revokedBy: SUPERVISOR.id, signedInOperatorId: null, online: false });
    expect((await readTrail(owner)).slice(trail).map((row) => [row.type, row.deviceId, row.details['sessionsEnded']])).toEqual([['DEVICE_REVOKED', target.id, open]]);
    const { rows: left } = await owner.query<{ n: string }>('SELECT count(*) AS n FROM public.auth_sessions WHERE device_id = $1 AND ended_at IS NULL', [target.id]);
    expect(Number(left[0]?.n)).toBe(0);
    const { rows: ended } = await owner.query<{ n: string }>("SELECT count(*) AS n FROM public.auth_sessions WHERE device_id = $1 AND end_reason = 'DEVICE_REVOKED' AND ended_at = $2", [target.id, clock.now()]);
    expect(Number(ended[0]?.n)).toBe(open);
    const { rows: live } = await owner.query<{ n: string }>('SELECT count(*) AS n FROM public.biometric_tokens WHERE device_id = $1 AND used_at IS NULL AND revoked_at IS NULL', [target.id]);
    expect(Number(live[0]?.n)).toBe(0);

    const stored = await storedDevices(owner);
    const retired = stored.find((device) => device.state === 'UNPAIRED')?.id ?? '';
    expect(outcomeOf(await portalPost(pairing.app, revokeUrl(target.id), cookie, { reason: 'A second revoke of it' }))).toEqual([409, 'INVALID_STATE']);
    expect(outcomeOf(await portalPost(pairing.app, revokeUrl(retired), cookie, { reason: 'It was unpaired long ago' }))).toEqual([409, 'INVALID_STATE']);
    expect(outcomeOf(await portalPost(pairing.app, revokeUrl('DEV-4040'), cookie, { reason: 'No such device at all' }))).toEqual([404, 'NOT_FOUND']);
    expect((await list()).filter((device) => device.state === 'REVOKED')).toHaveLength(11);
  });
});
