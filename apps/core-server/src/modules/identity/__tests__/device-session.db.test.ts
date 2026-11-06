// E-fix FX-C (decision D201 ruling R4; E2E-S-2, RESIDUAL-W70-1): every way an auth session bound
// to a paired device begins or ends publishes `device.session` with the device's ID after the
// commit, so the realtime channel tells Paired Devices (one debounced `admin.changed DEVICES`;
// `src/realtime/__tests__/hub.devices-changed.test.ts`). A console session publishes none, a unit
// that rolls back publishes none, and `endForDevice` publishes none of its own: its callers, the
// revoke and the unpair, publish `admin.changed DEVICES` at once.
//
// A clone of the seed template, the code under test as `dems_app`, a manual clock: no test waits.
import { OPERATOR_IDS, OPERATORS } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import type { Publication } from '../../../realtime';
import {
  CLOCK_START,
  HOUR,
  MINUTE,
  SIGN_OUT,
  bearer,
  closeOpenSessions,
  deviceRegistryDouble,
  deviceSignIn,
  forgetCounters,
  identityApp,
  insertPairedDevice,
  sessionOfToken,
  signInOnWeb,
  storedSessions,
  webPost,
  type IdentityApp,
} from '../../../../test/support/identity';

const db = useTestDatabase({ template: 'seed' });
let identity: IdentityApp;
let owner: Pool;
let deviceCredential: string;
const published: Publication[] = [];

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const DEVICE = 'DEV-0001';

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
});

const tokenOf = (response: { json(): unknown }): string => (response.json() as { sessionToken: string }).sessionToken;
const ofKind = (kind: Publication['kind']): Publication[] => published.filter((publication) => publication.kind === kind);
const DEVICE_SESSION: Publication = { kind: 'device.session', deviceIds: [DEVICE] };

describe('device.session: a paired device\'s operator may have changed (R4)', () => {
  it('a password sign-in on the device publishes it once; a sign-in on the web console publishes nothing', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    expect(web.token).toBeTruthy();
    expect(published).toEqual([]);

    const response = await deviceSignIn(identity.app, deviceCredential, INVESTIGATOR.username);
    expect(response.statusCode).toBe(200);
    expect(published).toEqual([DEVICE_SESSION]);
  });

  it('a sign-out on the device: session.ended, then device.session; a sign-out on the web: session.ended only', async () => {
    const token = tokenOf(await deviceSignIn(identity.app, deviceCredential, INVESTIGATOR.username));
    const session = await sessionOfToken(owner, token);
    published.length = 0;
    const response = await identity.app.inject({ method: 'POST', url: SIGN_OUT, headers: bearer(token) });
    expect(response.statusCode).toBe(204);
    expect(published).toEqual([{ kind: 'session.ended', sessionIds: [session.id], reason: 'SIGNED_OUT' }, DEVICE_SESSION]);

    const web = await signInOnWeb(identity, SUPERVISOR.username);
    published.length = 0;
    expect((await webPost(identity.app, SIGN_OUT, web.cookie)).statusCode).toBe(204);
    expect(ofKind('device.session')).toEqual([]);
    expect(ofKind('session.ended')).toHaveLength(1);
  });

  it('an idle expiry by the sweeper names the device once, however many of its sessions ended', async () => {
    await deviceSignIn(identity.app, deviceCredential, TECHNICIAN.username);
    await deviceSignIn(identity.app, deviceCredential, INVESTIGATOR.username);
    await signInOnWeb(identity, SUPERVISOR.username);
    published.length = 0;
    identity.clock.advance(15 * MINUTE);
    const ended = await identity.control.sweep();
    expect(ended).toHaveLength(3);
    expect(ofKind('device.session')).toEqual([DEVICE_SESSION]);
  });

  it('endForOperator (a disabled user) publishes it after the caller\'s commit, and nothing when the unit rolls back', async () => {
    await deviceSignIn(identity.app, deviceCredential, TECHNICIAN.username);
    published.length = 0;
    await expect(
      identity.app.pipeline.run('test.rollback', async (unit) => {
        await identity.app.sessionRegistry.endForOperator(unit, TECHNICIAN.id, 'USER_DISABLED');
        throw new Error('the caller changed its mind');
      }),
    ).rejects.toThrow('the caller changed its mind');
    expect(published).toEqual([]);

    const ids = await identity.app.pipeline.run('test.disableUser', (unit) => identity.app.sessionRegistry.endForOperator(unit, TECHNICIAN.id, 'USER_DISABLED'));
    expect(ids).toHaveLength(1);
    expect(published).toEqual([DEVICE_SESSION]);
  });

  it('endBiometricSessions (a reused token) publishes it; endForDevice (revoke, unpair) publishes nothing of its own', async () => {
    await owner.query(
      "INSERT INTO public.auth_sessions (token_hash, operator_id, device_id, method, issued_at, last_seen_at, absolute_expires_at) VALUES ($1, $2, $3, 'BIOMETRIC', $4, $4, $5)",
      [Buffer.alloc(32, 7), SUPERVISOR.id, DEVICE, identity.clock.now(), identity.clock.now() + 8 * HOUR],
    );
    expect((await storedSessions(owner)).some((session) => session.method === 'BIOMETRIC' && session.endedAt === null)).toBe(true);
    const reused = await identity.app.pipeline.run('test.tokenReuse', (unit) => identity.app.sessionRegistry.endBiometricSessions(unit, DEVICE, SUPERVISOR.id));
    expect(reused).toHaveLength(1);
    expect(published).toEqual([DEVICE_SESSION]);

    await deviceSignIn(identity.app, deviceCredential, INVESTIGATOR.username);
    published.length = 0;
    const revoked = await identity.app.pipeline.run('test.revokeDevice', (unit) => identity.app.sessionRegistry.endForDevice(unit, DEVICE, 'DEVICE_REVOKED'));
    expect(revoked).toHaveLength(1);
    expect(published).toEqual([]);
  });
});
